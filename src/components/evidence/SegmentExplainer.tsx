"use client";

import { useState } from "react";
import { ChevronDown, Compass, ShieldCheck } from "lucide-react";
import { MetricInfo } from "./MetricInfo";
import { SEGMENTS } from "@/lib/metrics";

export function SegmentExplainer({ current = "High potential, variable execution" }: { current?: string }) {
  const [open, setOpen] = useState(false);
  const selected = SEGMENTS.find((segment) => segment.name === current) ?? SEGMENTS[2];

  return <section className="ev-segment-card">
    <div className="ev-segment-head">
      <div className="ev-segment-icon"><Compass size={22}/></div>
      <div>
        <span className="so-kicker">CURRENT DEVELOPMENT SEGMENT</span>
        <h3>{selected.name} <MetricInfo metric="segment" compact/></h3>
        <p>{selected.meaning}</p>
      </div>
      <button className="ev-segment-toggle" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        How segments work <ChevronDown size={16}/>
      </button>
    </div>
    <div className="ev-next-step"><strong>Recommended next step</strong><span>{selected.nextStep}</span></div>
    {open && <div className="ev-segment-grid">
      {SEGMENTS.map((segment) => <article key={segment.key} className={segment.name === selected.name ? "active" : ""}>
        <strong>{segment.name}</strong>
        <span>{segment.when}</span>
        <small>{segment.nextStep}</small>
      </article>)}
      <div className="so-notice info"><ShieldCheck size={17}/><span>Segments summarise current evidence. They are never permanent labels, predicted ranks or guarantees.</span></div>
    </div>}
  </section>;
}
