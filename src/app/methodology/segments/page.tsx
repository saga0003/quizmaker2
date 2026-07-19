import Link from "next/link";
import { ArrowLeft, Compass, RefreshCw, ShieldCheck, Target } from "lucide-react";
import { Logo } from "@/components/Logo";
import { SEGMENTS } from "@/lib/metrics";

export default function SegmentsMethodologyPage() {
  return <main className="ev-methodology-page"><header><Link href="/"><Logo/></Link><Link href="/" className="rm-btn-secondary"><ArrowLeft size={16}/> Back</Link></header><section className="ev-methodology-hero"><span className="so-kicker">DEVELOPMENT SEGMENTS</span><h1>Segments describe current evidence, not student identity.</h1><p>Each segment is temporary, rule-based and paired with a practical next action. It can change when new comparable evidence is added.</p></section><div className="ev-segment-method-grid">{SEGMENTS.map((segment, index) => <article className="so-card so-pad" key={segment.key}><div className="ev-segment-index">{String(index + 1).padStart(2, "0")}</div><h2>{segment.name}</h2><dl><div><dt><Compass size={17}/>When it is assigned</dt><dd>{segment.when}</dd></div><div><dt><ShieldCheck size={17}/>What it means</dt><dd>{segment.meaning}</dd></div><div><dt><Target size={17}/>Recommended next step</dt><dd>{segment.nextStep}</dd></div><div><dt><RefreshCw size={17}/>Review rule</dt><dd>Recalculate after a new comparable assessment or a meaningful evidence-window change.</dd></div></dl></article>)}</div></main>;
}
