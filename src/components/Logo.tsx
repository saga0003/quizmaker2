export function Logo({ compact = false }: { compact?: boolean }) {
  return <span className={`so-logo ${compact?"compact":""}`}><span className="so-logo-mark"><i/><i/><i/></span>{!compact&&<span><strong>ScholarOS</strong><small>Assessment Intelligence</small></span>}</span>;
}
