"use client";

import { Info } from "lucide-react";
import { useId, useState } from "react";

type MetricInfoProps = {
  title: string;
  definition: string;
  evaluatedFrom: string;
  whyItMatters: string;
  caution?: string;
  className?: string;
};

export function MetricInfo({
  title,
  definition,
  evaluatedFrom,
  whyItMatters,
  caution,
  className = "",
}: MetricInfoProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return <span className={`ev-metric-info ${className}`}>
    <button
      type="button"
      className="ev-info-trigger"
      aria-label={`Explain ${title}`}
      aria-expanded={open}
      aria-controls={panelId}
      onClick={() => setOpen((value) => !value)}
      onBlur={(event) => {
        if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <Info size={14}/>
    </button>
    {open && <span id={panelId} className="ev-info-panel" role="dialog" aria-label={`${title} explanation`}>
      <strong>{title}</strong>
      <span><b>What it means</b>{definition}</span>
      <span><b>How it is evaluated</b>{evaluatedFrom}</span>
      <span><b>Why it is useful</b>{whyItMatters}</span>
      {caution && <span><b>Responsible-use note</b>{caution}</span>}
    </span>}
  </span>;
}

export function MetricLabel({
  children,
  ...info
}: MetricInfoProps & { children: React.ReactNode }) {
  return <span className="ev-metric-label">{children}<MetricInfo {...info}/></span>;
}
