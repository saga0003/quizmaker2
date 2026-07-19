import Link from "next/link";
import { ArrowLeft, Filter, Search, ShieldCheck, TableProperties } from "lucide-react";
import { Logo } from "@/components/Logo";

const controls = [
  { title: "Search rows", text: "Searches the text currently rendered in the table, including names, statuses, grades, subjects and dates." },
  { title: "Filter by column", text: "Choose one column and then select an exact value from the records currently available in that table." },
  { title: "Sort a column", text: "Select a column heading to sort ascending. Select it again to sort descending. Numbers, percentages, currency and dates are interpreted correctly." },
  { title: "Combine controls", text: "Search and column filtering work together. This helps narrow a large operational list without changing the stored records." },
];

export default function DataGuidePage(){return <main>
  <header className="public-nav"><div className="rm-container nav-inner"><Link href="/"><Logo/></Link><nav><Link href="/login/">Open Evidara</Link></nav></div></header>
  <section className="public-section alt"><div className="rm-container">
    <Link href="/" className="ev-guide-link"><ArrowLeft size={16}/>Back to Evidara</Link>
    <div className="so-page-head" style={{marginTop:20}}><div><span className="so-kicker">V6.3 DATA NAVIGATION</span><h1>Search, filter and sort operational records</h1><p>Evidara adds the same understandable controls to operational tables so school and platform teams can locate the right record quickly.</p></div><TableProperties/></div>
    <div className="so-grid so-grid-2 so-mt">{controls.map((control,index)=><article className="so-card so-pad" key={control.title}><span className="so-kicker">CONTROL {index+1}</span><h2>{control.title}</h2><p style={{color:"#6B7980",lineHeight:1.7}}>{control.text}</p></article>)}</div>
  </div></section>
  <section className="public-section"><div className="rm-container"><div className="so-grid so-grid-3">
    <article className="so-card so-pad insight-card"><Search/><span className="so-kicker">LOCAL VIEW</span><h3>Controls do not edit data</h3><p>Searching, filtering and sorting only change the current view. They do not modify a student, question, assessment or subscription record.</p></article>
    <article className="so-card so-pad insight-card"><Filter/><span className="so-kicker">VISIBLE RECORDS</span><h3>Filters use rendered data</h3><p>Only the records already available to the signed-in role are included. The controls do not bypass school, organisation or role boundaries.</p></article>
    <article className="so-card so-pad insight-card"><ShieldCheck/><span className="so-kicker">RESPONSIBLE USE</span><h3>Review before acting</h3><p>A filtered list supports navigation. High-impact actions should still be based on the complete record and relevant evidence.</p></article>
  </div></div></section>
  <footer className="public-footer"><div className="rm-container footer-inner"><Logo variant="dark"/><div>Evidence-driven assessment and student development.</div><div>© 2026 Evidara</div></div></footer>
</main>}
