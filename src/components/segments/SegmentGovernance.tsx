import { BookOpenCheck, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { segmentDefinitions, type SegmentKey } from "@/lib/evidaraMetrics";
import { SEGMENT_MINIMUM_ASSESSMENTS, SEGMENT_RULE_VERSION } from "@/lib/evidaraSegments";

const priority: SegmentKey[]=["not_assessed","academic_elite","fast_improver","high_potential_careless","accurate_slow","developing"];

export function SegmentGovernance(){return <div>
  <div className="so-page-head"><div><span className="so-kicker">SEGMENT GOVERNANCE</span><h1>Versioned rules and responsible-use controls</h1><p>Review exactly how Evidara chooses a current development pattern and where the result may—and may not—be used.</p></div><span className="so-status success"><RefreshCw size={14}/>Active rule set {SEGMENT_RULE_VERSION}</span></div>

  <div className="so-grid so-grid-3">
    <div className="so-stat"><BookOpenCheck/><strong>{priority.length}</strong><span>Published patterns</span></div>
    <div className="so-stat"><ShieldCheck/><strong>{SEGMENT_MINIMUM_ASSESSMENTS}</strong><span>Minimum assessments</span></div>
    <div className="so-stat"><RefreshCw/><strong>Every valid test</strong><span>Recalculation trigger</span></div>
  </div>

  <section className="so-card so-table-wrap so-mt"><table className="so-table"><thead><tr><th>Priority</th><th>Pattern</th><th>Published rule</th><th>Recommended use</th></tr></thead><tbody>{priority.map((key,index)=>{const definition=segmentDefinitions[key];return <tr key={key}><td>{index+1}</td><td><strong>{definition.label}</strong><small>{key}</small></td><td>{definition.rule}</td><td>{definition.nextAction}</td></tr>})}</tbody></table></section>

  <div className="so-grid so-grid-2 so-mt">
    <section className="so-card so-pad"><div className="so-section-head"><div><span className="so-kicker">SELECTION METHOD</span><h2>First responsible match</h2></div><BookOpenCheck/></div><div className="so-steps"><div><b>1</b><span><strong>Check evidence sufficiency</strong><small>Fewer than three comparable assessments produces “Not enough evidence”.</small></span></div><div><b>2</b><span><strong>Evaluate published rules in order</strong><small>The first fully matched rule becomes the current pattern.</small></span></div><div><b>3</b><span><strong>Expose qualifying evidence</strong><small>The learner and school can see observed values, thresholds and the evidence window.</small></span></div><div><b>4</b><span><strong>Recalculate, never freeze</strong><small>New valid evidence can change the result immediately.</small></span></div></div></section>
    <section className="so-card so-pad"><div className="so-section-head"><div><span className="so-kicker">PROHIBITED USES</span><h2>What a segment cannot decide</h2></div><TriangleAlert/></div><div className="ev-segment-definition"><span>Never use for</span><p>Admission, discipline, promotion, scholarship, fees, access control, counselling eligibility, employment or prediction of future outcomes.</p><span>Human review required</span><p>Teachers must inspect the underlying responses and context before assigning a support action.</p><span>Language rule</span><p>Describe a current evidence pattern. Never describe intelligence, ability, character, destiny or fixed potential.</p></div></section>
  </div>
</div>}
