"use client";

import { Info } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export type MetricInfoProps = {
  title: string;
  definition: string;
  evaluatedFrom: string;
  whyItMatters: string;
  caution?: string;
  className?: string;
};

export function MetricInfo({ title, definition, evaluatedFrom, whyItMatters, caution, className = "" }: MetricInfoProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return <span ref={rootRef} className={`ev-metric-info ${className}`} onClick={(event) => event.stopPropagation()}>
    <button
      type="button"
      className="ev-info-trigger"
      aria-label={`Explain ${title}`}
      aria-expanded={open}
      aria-controls={panelId}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setOpen((value) => !value);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
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

export function MetricLabel({ children, ...info }: MetricInfoProps & { children: React.ReactNode }) {
  return <span className="ev-metric-label">{children}<MetricInfo {...info}/></span>;
}
