import Link from "next/link";
import { ArrowLeft, Calculator, Clock3, ShieldCheck, Target } from "lucide-react";
import { Logo } from "@/components/Logo";
import { METRICS } from "@/lib/metrics";

export default function MetricsMethodologyPage() {
  return <main className="ev-methodology-page"><header><Link href="/"><Logo/></Link><Link href="/" className="rm-btn-secondary"><ArrowLeft size={16}/> Back</Link></header><section className="ev-methodology-hero"><span className="so-kicker">EVIDARA METRIC DICTIONARY</span><h1>Every number should explain itself.</h1><p>Definitions, calculation rules, evidence windows, practical uses and limits for the metrics used across Evidara.</p></section><div className="ev-definition-grid">{Object.values(METRICS).map((metric) => <article className="so-card so-pad" key={metric.key}><span className="so-kicker">{metric.label}</span><h2>{metric.summary}</h2><dl><div><dt><Calculator size={17}/>How it is evaluated</dt><dd>{metric.calculation}</dd></div><div><dt><Clock3 size={17}/>Evidence window</dt><dd>{metric.evidenceWindow}</dd></div><div><dt><Target size={17}/>What it is useful for</dt><dd>{metric.use}</dd></div><div><dt><ShieldCheck size={17}/>Important limitation</dt><dd>{metric.limitation}</dd></div></dl></article>)}</div></main>;
}
