import { BarChart3, FileCheck2, LockKeyhole, ShieldCheck, TriangleAlert, Users } from "lucide-react";
import { BENCHMARK_PRIVACY_MINIMUM, BENCHMARK_SMALL_CELL_MINIMUM, benchmarkPublications } from "@/lib/evidaraBenchmarks";

const rules=[
  ["Exact paper version","Question content, scoring, duration and version fingerprint must match."],
  ["Minimum sample",`Shared results remain hidden until at least ${BENCHMARK_PRIVACY_MINIMUM} valid attempts exist.`],
  ["Small-cell suppression",`No subgroup result is shown when fewer than ${BENCHMARK_SMALL_CELL_MINIMUM} records contribute.`],
  ["No external identity","Student names, school names, contact details and response sheets never enter the shared result."],
  ["No public leaderboard","Schools receive their private cohort comparison, not a ranked list of institutions."],
  ["Invalid attempts excluded","Cancelled, duplicate, staff, incomplete and integrity-flagged attempts are excluded."],
];

export function BenchmarkGovernance(){
  const ready=benchmarkPublications.filter(item=>item.privacyReady).length;
  return <div>
    <div className="so-page-head"><div><span className="so-kicker">BENCHMARK GOVERNANCE</span><h1>Anonymous comparison with enforceable privacy thresholds</h1><p>Control how shared papers qualify, aggregate and disclose results across Evidara schools.</p></div><span className="so-status success"><ShieldCheck size={14}/>Aggregate only</span></div>

    <div className="so-grid so-grid-4"><div className="so-stat"><FileCheck2/><strong>{benchmarkPublications.length}</strong><span>paper versions</span></div><div className="so-stat"><BarChart3/><strong>{ready}</strong><span>aggregate-ready</span></div><div className="so-stat"><Users/><strong>{BENCHMARK_PRIVACY_MINIMUM}</strong><span>minimum attempts</span></div><div className="so-stat"><LockKeyhole/><strong>{BENCHMARK_SMALL_CELL_MINIMUM}</strong><span>small-cell floor</span></div></div>

    <section className="so-card so-table-wrap so-mt"><table className="so-table"><thead><tr><th>Paper</th><th>Version fingerprint</th><th>Status</th><th>Valid attempts</th><th>Anonymous schools</th><th>Disclosure state</th></tr></thead><tbody>{benchmarkPublications.map(item=><tr key={item.id}><td><strong>{item.title}</strong><small>{item.paperVersion}</small></td><td>{item.fingerprint}</td><td>{item.shareStatus}</td><td>{item.validAttempts}</td><td>{item.participatingSchools}</td><td><span className={`so-status ${item.privacyReady?"success":"warning"}`}>{item.privacyReady?"Aggregate visible":"Privacy locked"}</span></td></tr>)}</tbody></table></section>

    <div className="so-grid so-grid-2 so-mt"><section className="so-card so-pad"><div className="so-section-head"><div><span className="so-kicker">MANDATORY RULES</span><h2>Every publication must satisfy these controls</h2></div><ShieldCheck/></div><div className="benchmark-rule-list">{rules.map(([title,text])=><div key={title}><strong>{title}</strong><p>{text}</p></div>)}</div></section><section className="so-card so-pad"><div className="so-section-head"><div><span className="so-kicker">PROHIBITED DISCLOSURES</span><h2>What the benchmark cannot expose</h2></div><TriangleAlert/></div><div className="ev-segment-definition"><span>External student data</span><p>Name, identifier, contact details, exact score, exact response, device evidence or answer sheet.</p><span>External school data</span><p>School name, staff identity, named cohort performance or a public institutional rank.</p><span>High-impact use</span><p>Benchmark results must not decide admission, employment, discipline, fees, access or scholarship eligibility.</p></div></section></div>
  </div>;
}
