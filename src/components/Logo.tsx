export function Logo({ compact = false, reversed = false }: { compact?: boolean; reversed?: boolean }) {
  return <span className={`so-logo ev-logo ${compact ? "compact" : ""} ${reversed ? "reversed" : ""}`} aria-label="Evidara — Evidence-Driven Student Development">
    <span className="ev-logo-symbol" aria-hidden="true"><i/><b/><em/><span/></span>
    {!compact && <span className="ev-logo-copy"><strong>Evidara</strong><small>Evidence-Driven Student Development</small></span>}
  </span>;
}
