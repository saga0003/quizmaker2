import fs from 'node:fs';

const route=fs.readFileSync('src/app/api/resources-v14/route.ts','utf8');
const storage=fs.readFileSync('src/lib/server/privateResourceStorage.ts','utf8');
const migration=fs.readFileSync('supabase/migrations/20260831003359_phase1_private_academic_resource_bucket.sql','utf8');

const checks=[
  ['private bucket is explicitly non-public',/academic-resources-private[\s\S]*false/i.test(migration)],
  ['institution uploads use private storage',route.includes('uploadPrivateAcademicResource')],
  ['institution rows do not persist a public URL',/scope==='organization'[\s\S]*content_url:null/.test(route)],
  ['private backend is recorded',route.includes("storage_backend:'supabase-private-v1'")],
  ['private storage creates short-lived signed URLs',storage.includes('createSignedUrl')&&storage.includes('expiresIn ?? 300')],
  ['resource download is re-authorized through authenticated API',route.includes("params.get('resourceId')")&&route.includes('studentEligibleResources')],
  ['legacy institution public resources fail closed',route.includes('legacy institution resource must be migrated to protected storage')],
  ['resource list replaces persisted institution content_url with a signed URL',route.includes('safeResources.map(async({content_url,...resource})')&&route.includes('createPrivateAcademicResourceUrl({admin:ctx.admin,key:resource.storage_key,expiresIn:600})')],
];

const failed=checks.filter(([,ok])=>!ok);
for(const [name,ok] of checks) console.log(`${ok?'PASS':'FAIL'} A5 ${name}`);
if(failed.length){console.error(`A5 protected resource smoke failed: ${failed.map(([name])=>name).join(', ')}`);process.exit(1)}
console.log(`PASS A5 protected resource smoke (${checks.length} assertions)`);
