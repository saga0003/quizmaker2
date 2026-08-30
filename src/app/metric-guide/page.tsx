import Link from "next/link";
import { ArrowLeft, BookOpenCheck, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/Logo";
import { metricDefinitions } from "@/lib/evidaraMetrics";

const featuredMetrics = [
  metricDefinitions.score,
  metricDefinitions.accuracy,
  metricDefinitions.correctAnswers,
  metricDefinitions.attemptedQuestions,
  metricDefinitions.unansweredQuestions,
  metricDefinitions.timeUsed,
  metricDefinitions.attemptsAvailable,
];

export default function MetricGuide(){return <main>
  <header className="public-nav"><div className="rm-container nav-inner"><Link href="/"><Logo/></Link><nav><Link href="/login/">Open Evidara</Link></nav></div></header>
  <section className="public-section alt"><div className="rm-container">
    <Link href="/" className="ev-guide-link"><ArrowLeft size={16}/>Back to Evidara</Link>
    <div className="so-page-head" style={{marginTop:20}}><div><span className="so-kicker">TRANSPARENT EVIDENCE</span><h1>Assessment result guide</h1><p>V12 explains every result value using the exact submitted attempt and published paper rules.</p></div><BookOpenCheck/></div>
    <div className="ev-metric-guide-intro">
      <section className="so-card so-pad"><span className="so-kicker">HOW TO READ A METRIC</span><h2>Start with context, not the largest number</h2><div className="so-steps"><div><b>1</b><span><strong>Check the evidence window</strong><small>Confirm the paper, dates, sample and number of valid responses.</small></span></div><div><b>2</b><span><strong>Read the calculation</strong><small>Understand what is included, excluded and weighted.</small></span></div><div><b>3</b><span><strong>Use the responsible-use note</strong><small>Do not turn an observation into a diagnosis, promise or permanent label.</small></span></div></div></section>
      <aside className="ev-guide-principle"><ShieldCheck/><span className="so-kicker light">EVIDARA PRINCIPLE</span><h2>Evidence guides the next action.</h2><p>It does not define a learner&apos;s identity, intelligence, potential or future result. Teachers and students should always review the underlying responses before making a high-impact decision.</p></aside>
    </div>
  </div></section>

  <section className="public-section"><div className="rm-container"><div className="section-head"><span className="so-kicker">ACTIVE RESULT VALUES</span><h2>What each measure is saying</h2><p>These are the result values used in the active V12 assessment experience.</p></div><div className="ev-metric-grid">{featuredMetrics.map(metric=><article className="ev-metric-card" key={metric.title}><header><h3>{metric.title}</h3></header><p>{metric.definition}</p><dl><div><dt>Evaluated from</dt><dd>{metric.evaluatedFrom}</dd></div><div><dt>Why it is useful</dt><dd>{metric.whyItMatters}</dd></div>{metric.caution&&<div><dt>Responsible-use note</dt><dd>{metric.caution}</dd></div>}</dl></article>)}</div></div></section>

  <footer className="public-footer"><div className="rm-container footer-inner"><Logo variant="dark"/><div>Evidence-driven assessment and student development.</div><div>© 2026 Evidara</div></div></footer>
</main>}
