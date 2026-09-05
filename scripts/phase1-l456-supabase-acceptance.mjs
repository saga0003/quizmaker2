#!/usr/bin/env node

import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

const ACK = 'YES_I_UNDERSTAND_NON_PRODUCTION_ONLY';
const ORIGIN = 'https://xzfozpnzvznqrvcsoail.supabase.co';
const TENANT = 'evidara-school-acceptance';
const PAPER_ID = 'e5801a88-1e7f-4b4f-a715-ad44ce2b3c43';
const STUDENT_DOMAIN = 'evidara.invalid';
const STUDENT_START = 101;
const ACTORS = 500;
const RAMP_MS = 20_000;
const AUTH_CONCURRENCY = 40;
const RPC_CONCURRENCY = 100;
const RETRY_SAMPLE = 25;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const BUDGETS = Object.freeze({
  start: { maxFailureRate: 0.01, maxP95Ms: 5000, maxP99Ms: 10000 },
  save: { maxFailureRate: 0.01, maxP95Ms: 3000, maxP99Ms: 6000 },
  submit: { maxFailureRate: 0.01, maxP95Ms: 8000, maxP99Ms: 15000 },
});

const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? '';
const password = process.env.EVIDARA_ACCEPTANCE_STUDENT_PASSWORD ?? '';
const candidateSha = process.env.CANDIDATE_SHA ?? '';
const outPath = process.env.EVIDENCE_OUT ?? 'phase1-l456-aggregate.json';

function assertGuards() {
  if (process.env.EVIDARA_LOAD_ACCEPTANCE !== ACK) throw new Error(`set EVIDARA_LOAD_ACCEPTANCE=${ACK}`);
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key) && !/^eyJ[A-Za-z0-9._-]+$/.test(key)) throw new Error('missing publishable Supabase key');
  if (!password || password.length < 8) throw new Error('missing acceptance student password');
  if (!/^[0-9a-f]{40}$/.test(candidateSha)) throw new Error('candidate SHA must be exact 40-character SHA');
  if (process.env.GITHUB_REF_NAME && process.env.GITHUB_REF_NAME !== 'phase1-hardening') throw new Error('ref must be phase1-hardening');
  if (process.env.EVIDARA_ACCEPTANCE_TENANT !== TENANT) throw new Error(`tenant must be ${TENANT}`);
}

const headers = (token) => ({ apikey: key, authorization: `Bearer ${token}`, 'content-type': 'application/json', 'user-agent': 'evidara-phase1-l456/1' });
const percentile = (values, p) => { const s=[...values].sort((a,b)=>a-b); return s.length ? Math.round(s[Math.max(0,Math.ceil((p/100)*s.length)-1)]*100)/100 : null; };
const sleep = (ms) => new Promise((r)=>setTimeout(r,ms));

async function fetchMeasured(url, init) {
  const started = performance.now();
  try {
    const res = await fetch(url, { ...init, redirect: 'manual', signal: AbortSignal.timeout(30_000) });
    const text = await res.text();
    const bytes = Buffer.byteLength(text, 'utf8');
    if (bytes > MAX_RESPONSE_BYTES) throw new Error('ResponseTooLarge');
    return { ok: res.ok, status: res.status, latencyMs: performance.now()-started, bytes, text, error: null };
  } catch (e) {
    return { ok:false,status:0,latencyMs:performance.now()-started,bytes:0,text:'',error:e instanceof Error ? e.message : String(e) };
  }
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length); let cursor=0;
  async function worker(){ while(true){ const i=cursor++; if(i>=items.length) return; out[i]=await fn(items[i],i); } }
  await Promise.all(Array.from({length:Math.min(limit,items.length)},worker)); return out;
}

async function authenticateActors() {
  const actors = Array.from({length:ACTORS},(_,i)=>({ actorId:`synthetic-load-student-${String(STUDENT_START+i).padStart(4,'0')}`, email:`load-student-${String(STUDENT_START+i).padStart(4,'0')}@${STUDENT_DOMAIN}` }));
  const sessions = await mapLimit(actors, AUTH_CONCURRENCY, async (actor) => {
    const r = await fetchMeasured(`${ORIGIN}/auth/v1/token?grant_type=password`, { method:'POST', headers:{ apikey:key,'content-type':'application/json' }, body:JSON.stringify({email:actor.email,password}) });
    if (!r.ok) throw new Error(`auth failed for ${actor.actorId}: ${r.status}`);
    const body = JSON.parse(r.text); if (!body.access_token || body.user?.email !== actor.email) throw new Error(`auth identity mismatch for ${actor.actorId}`);
    return { ...actor, userId: body.user.id, token: body.access_token };
  });
  if (new Set(sessions.map(x=>x.userId)).size !== ACTORS || new Set(sessions.map(x=>x.token)).size !== ACTORS) throw new Error('500 distinct authenticated sessions were not obtained');
  return sessions;
}

async function ramped(items, concurrency, fn) {
  const epoch=performance.now();
  return mapLimit(items, concurrency, async (item,i)=>{ const due=(RAMP_MS*i)/(items.length-1); const wait=epoch+due-performance.now(); if(wait>0) await sleep(wait); return fn(item,i); });
}

function summarize(name, results) {
  const lat=results.map(r=>r.latencyMs), successful=results.filter(r=>r.ok).length, failed=results.length-successful, statuses={};
  for(const r of results) statuses[String(r.status)]=(statuses[String(r.status)]??0)+1;
  const failureRate=failed/results.length; const latencyMs={p50:percentile(lat,50),p95:percentile(lat,95),p99:percentile(lat,99),max:percentile(lat,100)}; const budget=BUDGETS[name];
  return { schemaVersion:1, scenario:name, workloadId:`phase1-l${name==='start'?4:name==='save'?5:6}-500-${candidateSha.slice(0,12)}`, candidateSha, targetOrigin:ORIGIN, tenant:TENANT, attempted:results.length,successful,failed,failureRate,statusDistribution:statuses,latencyMs,responseBytes:results.reduce((a,r)=>a+r.bytes,0),errors:results.reduce((a,r)=>{if(r.error)a[r.error]=(a[r.error]??0)+1;return a;},{}),budget,budgetPassed:failed/results.length<=budget.maxFailureRate&&latencyMs.p95<=budget.maxP95Ms&&latencyMs.p99<=budget.maxP99Ms,maxResponseBytesPerOperation:MAX_RESPONSE_BYTES,secretsIncluded:false,bodiesIncluded:false };
}

async function rpc(token, name, body) { return fetchMeasured(`${ORIGIN}/rest/v1/rpc/${name}`, {method:'POST',headers:headers(token),body:JSON.stringify(body)}); }

async function main(){
  assertGuards(); const startedAt=new Date().toISOString(); const sessions=await authenticateActors();
  const starts=await ramped(sessions,RPC_CONCURRENCY,async(s)=>{const r=await rpc(s.token,'start_exam_attempt',{p_paper_id:PAPER_ID,p_access_code:null}); if(r.ok){try{s.attemptId=JSON.parse(r.text);}catch{r.ok=false;r.error='InvalidStartResponse';}} return r;});
  const startSummary=summarize('start',starts); if(!startSummary.budgetPassed) throw new Error(`L4 budget failed: ${JSON.stringify(startSummary)}`);
  if(sessions.some(s=>!s.attemptId)) throw new Error('L4 missing authoritative attempt ids');

  const retryStarts=await mapLimit(sessions.slice(0,RETRY_SAMPLE),25,async(s)=>rpc(s.token,'start_exam_attempt',{p_paper_id:PAPER_ID,p_access_code:null}));
  for(let i=0;i<RETRY_SAMPLE;i++){ if(!retryStarts[i].ok || JSON.parse(retryStarts[i].text)!==sessions[i].attemptId) throw new Error('L4 start retry was not idempotent'); }

  await mapLimit(sessions,40,async(s)=>{const r=await rpc(s.token,'get_exam_attempt_payload',{p_attempt_id:s.attemptId}); if(!r.ok) throw new Error(`payload failed ${r.status}`); const b=JSON.parse(r.text); const q=b.questions?.[0]; if(!q?.paper_question_id) throw new Error('payload missing question'); s.questionId=q.paper_question_id; s.expectedResponse={selected_option_index:(Number.parseInt(s.userId.slice(0,2),16)||0)%4};});

  const saves=await ramped(sessions,RPC_CONCURRENCY,async(s)=>rpc(s.token,'save_exam_response',{p_attempt_id:s.attemptId,p_paper_question_id:s.questionId,p_response:s.expectedResponse,p_marked_for_review:false,p_time_spent_seconds:7}));
  const saveSummary=summarize('save',saves); if(!saveSummary.budgetPassed) throw new Error(`L5 budget failed: ${JSON.stringify(saveSummary)}`);
  const changed=await mapLimit(sessions.slice(0,RETRY_SAMPLE),25,async(s)=>{s.expectedResponse={selected_option_index:(s.expectedResponse.selected_option_index+1)%4}; return rpc(s.token,'save_exam_response',{p_attempt_id:s.attemptId,p_paper_question_id:s.questionId,p_response:s.expectedResponse,p_marked_for_review:true,p_time_spent_seconds:11});});
  if(changed.some(r=>!r.ok)) throw new Error('L5 changed-answer retry sample failed');

  const readbacks=await mapLimit(sessions,40,async(s)=>{const r=await rpc(s.token,'get_exam_attempt_payload',{p_attempt_id:s.attemptId}); if(!r.ok) return false; const b=JSON.parse(r.text); const row=b.responses?.find(x=>x.paper_question_id===s.questionId); return JSON.stringify(row?.response)===JSON.stringify(s.expectedResponse);});
  if(readbacks.some(x=>!x)) throw new Error(`L5 authoritative readback mismatch count=${readbacks.filter(x=>!x).length}`);

  const submits=await ramped(sessions,RPC_CONCURRENCY,async(s)=>rpc(s.token,'submit_exam_attempt',{p_attempt_id:s.attemptId}));
  const submitSummary=summarize('submit',submits); if(!submitSummary.budgetPassed) throw new Error(`L6 budget failed: ${JSON.stringify(submitSummary)}`);
  const retrySubmit=await mapLimit(sessions.slice(0,RETRY_SAMPLE),25,async(s)=>rpc(s.token,'submit_exam_attempt',{p_attempt_id:s.attemptId}));
  if(retrySubmit.some(r=>!r.ok)) throw new Error('L6 submission retry sample failed');

  const evidence={schemaVersion:1,candidateSha,tenant:TENANT,studentCount:ACTORS,distinctAuthenticatedSessions:ACTORS,paperId:PAPER_ID,startedAt,finishedAt:new Date().toISOString(),rampMs:RAMP_MS,retrySample:RETRY_SAMPLE,start:startSummary,save:saveSummary,submit:submitSummary,authoritativeReadbackMatched:ACTORS,productionProtected:true,secretsIncluded:false,bodiesIncluded:false};
  writeFileSync(outPath,`${JSON.stringify(evidence,null,2)}\n`,{flag:'wx'}); console.log(JSON.stringify(evidence,null,2));
}

main().catch((e)=>{console.error(`L456 ACCEPTANCE FAILED: ${e instanceof Error?e.message:String(e)}`);process.exitCode=1;});
