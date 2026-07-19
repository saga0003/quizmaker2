type LogoVariant = "light" | "dark" | "emblem";

export function Logo({ compact = false, variant = "light" }: { compact?: boolean; variant?: LogoVariant }) {
  const resolvedVariant = compact ? "emblem" : variant;
  const src = resolvedVariant === "dark"
    ? "/brand/evidara-logo-dark.png"
    : resolvedVariant === "emblem"
      ? "/brand/evidara-emblem.png"
      : "/brand/evidara-logo-light.png";
  const alt = resolvedVariant === "emblem" ? "Evidara emblem" : "Evidara — Evidence-Driven Student Development";

  return <span className={`so-logo ev-logo ${compact ? "compact" : ""} ${resolvedVariant}`} aria-label={alt}>
    <img src={src} alt={alt}/>
  </span>;
}
