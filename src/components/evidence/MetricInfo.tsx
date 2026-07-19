"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Info } from "lucide-react";
import { METRICS, type MetricDefinition } from "@/lib/metrics";

export function MetricInfo({ metric, definition, compact = false }: { metric?: string; definition?: MetricDefinition; compact?: boolean }) {
  const resolved = definition ?? (metric ? METRICS[metric] : undefined);
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    }
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, []);

  if (!resolved) return null;

  return <span className={`ev-metric-info ${compact ? "compact" : ""}`} ref={root}>
    <button type="button" aria-label={`Explain ${resolved.label}`} aria-expanded={open} aria-controls={id} onClick={() => setOpen((value) => !value)}>
      <Info size={compact ? 13 : 14}/>
    </button>
    {open && <span className="ev-metric-popover" role="dialog" id={id} aria-label={`${resolved.label} explanation`}>
      <strong>{resolved.label}</strong>
      <p>{resolved.summary}</p>
      <dl>
        <div><dt>How it is evaluated</dt><dd>{resolved.calculation}</dd></div>
        <div><dt>Evidence used</dt><dd>{resolved.evidenceWindow}</dd></div>
        <div><dt>Why it is useful</dt><dd>{resolved.use}</dd></div>
        <div><dt>Important limit</dt><dd>{resolved.limitation}</dd></div>
      </dl>
    </span>}
  </span>;
}

export function MetricLabel({ metric, children, className = "" }: { metric: string; children?: React.ReactNode; className?: string }) {
  const definition = METRICS[metric];
  return <span className={`ev-metric-label ${className}`}>
    <span>{children ?? definition?.label ?? metric}</span>
    <MetricInfo metric={metric} compact/>
  </span>;
}
