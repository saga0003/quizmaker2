export function Logo({ compact = false }: { compact?: boolean }) {
  return <span className={`so-logo ev-logo ${compact ? "compact" : ""}`} aria-label="Evidara — Evidence-Driven Student Development">
    <img src="/brand/evidara-master.svg" alt="Evidara — Evidence-Driven Student Development"/>
  </span>;
}
