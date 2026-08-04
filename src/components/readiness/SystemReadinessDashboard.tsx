"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  CreditCard,
  Database,
  FileCheck2,
  KeyRound,
  RefreshCw,
  Route,
  ServerCog,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/context/AuthProvider";
import type { ReadinessArea, ReadinessCheck, ReadinessReport, ReadinessStatus } from "@/lib/readiness";

const areaMeta: Array<{ area: ReadinessArea; title: string; description: string }> = [
  { area: "release", title: "Release boundary", description: "Version identity, deployment scope and launch constraints." },
  { area: "configuration", title: "Runtime configuration", description: "Public and server-only application environment values." },
  { area: "supabase", title: "Supabase database and authentication", description: "Database reachability, service credentials and Auth Admin access." },
  { area: "migration", title: "Migration 24 readiness", description: "Voucher schema, order evidence and zero-value fulfilment guard." },
  { area: "razorpay", title: "Razorpay Test Mode", description: "Safe secret-presence, allow-list and Test Mode API validation." },
  { area: "access", title: "Roles and protected routes", description: "Shared access-control contract used by client guards and QA smoke checks." },
];

const statusText: Record<ReadinessStatus, string> = {
  pass: "Ready",
  warning: "Review",
  fail: "Blocked",
  info: "Info",
};

function StatusIcon({ status }: { status: ReadinessStatus }) {
  if (status === "pass") return <CheckCircle2 size={20} color="#137A3A" />;
  if (status === "fail") return <CircleAlert size={20} color="#B42318" />;
  return <CircleDashed size={20} color={status === "warning" ? "#B76E00" : "#52616A"} />;
}

function AreaIcon({ area }: { area: ReadinessArea }) {
  if (area === "configuration") return <KeyRound size={20} />;
  if (area === "supabase") return <Database size={20} />;
  if (area === "migration") return <FileCheck2 size={20} />;
  if (area === "razorpay") return <CreditCard size={20} />;
  if (area === "access") return <Route size={20} />;
  return <ServerCog size={20} />;
}

function CheckRow({ item }: { item: ReadinessCheck }) {
  return (
    <div className="readiness-row">
      <div className={`readiness-status readiness-${item.status}`}>
        <StatusIcon status={item.status} />
        <span>{statusText[item.status]}</span>
      </div>
      <div>
        <strong>{item.label}</strong>
        <p>{item.message}</p>
        {item.action && <div className="readiness-action"><b>Action:</b> {item.action}</div>}
        {item.details && Object.keys(item.details).length > 0 && (
          <div className="readiness-details">
            {Object.entries(item.details).map(([key, value]) => (
              <span key={key}><b>{key.replaceAll("_", " ")}:</b> {String(value)}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function SystemReadinessDashboard() {
  const { session, configured } = useAuth();
  const accessToken = session?.access_token;
  const [report, setReport] = useState<ReadinessReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; action?: string | null; details?: string | null } | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/readiness", {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        cache: "no-store",
      });
      const payload = await response.json() as ReadinessReport & { error?: string; action?: string | null; details?: string | null };
      if (!response.ok) {
        throw Object.assign(new Error(payload.error || `Readiness API returned HTTP ${response.status}.`), {
          action: payload.action,
          details: payload.details,
        });
      }
      setReport(payload);
    } catch (caught) {
      const value = caught as { message?: string; action?: string | null; details?: string | null };
      setReport(null);
      setError({
        message: value.message || "Unable to load Evidara readiness diagnostics.",
        action: value.action || "Confirm the signed-in account is a Super Admin, then check Supabase environment values and retry.",
        details: value.details || null,
      });
    } finally {
      setBusy(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const blockers = useMemo(() => report?.checks.filter((item) => item.status === "fail") ?? [], [report]);
  const reviews = useMemo(() => report?.checks.filter((item) => item.status === "warning") ?? [], [report]);

  return (
    <div>
      <div className="so-page-head">
        <div>
          <span className="so-kicker">EVIDARA V6.8 PRODUCTION QA</span>
          <h1>System readiness</h1>
          <p>Run server-backed diagnostics before launch. Secret values are never returned to the browser, and all payment checks remain in Razorpay Test Mode.</p>
        </div>
        <div className="so-action-row">
          <button className="rm-btn-secondary" onClick={() => void load()} disabled={busy}>
            <RefreshCw size={17} className={busy ? "spin" : ""} /> {busy ? "Running checks…" : "Run checks again"}
          </button>
        </div>
      </div>

      {error && (
        <section className="readiness-error" role="alert">
          <CircleAlert size={24} />
          <div>
            <strong>{error.message}</strong>
            {error.details && <p>{error.details}</p>}
            {error.action && <p><b>Next step:</b> {error.action}</p>}
          </div>
        </section>
      )}

      {!report && !error && (
        <section className="so-card so-pad readiness-loading">
          <CircleDashed size={24} /> Checking configuration, Supabase, migration 24, Razorpay and route guards…
        </section>
      )}

      {report && (
        <>
          <section className={`readiness-hero readiness-${report.overall}`}>
            <div className="readiness-hero-icon"><ShieldCheck size={32} /></div>
            <div>
              <span className="so-kicker">CURRENT QA VERDICT</span>
              <h2>{report.overall === "pass" ? "Ready for controlled launch testing" : report.overall === "warning" ? "Ready with manual reviews remaining" : "Launch blocked by failed checks"}</h2>
              <p>
                Evidara {report.release} · {report.mode.replaceAll("-", " ")} · generated {new Date(report.generatedAt).toLocaleString()}
              </p>
            </div>
            <div className="readiness-actor">
              <span>Diagnostic identity</span>
              <strong>{report.actor.email || (configured ? "Signed-in account" : "Demo mode")}</strong>
              <small>{report.actor.role?.replaceAll("_", " ") || "No cloud role"}</small>
            </div>
          </section>

          <div className="so-grid so-grid-4 readiness-summary">
            {(["pass", "warning", "fail", "info"] as ReadinessStatus[]).map((status) => (
              <div className="so-stat" key={status}>
                <StatusIcon status={status} />
                <strong>{report.summary[status]}</strong>
                <span>{statusText[status]} checks</span>
              </div>
            ))}
          </div>

          {(blockers.length > 0 || reviews.length > 0) && (
            <section className="so-card so-pad so-mt">
              <div className="so-section-head">
                <div>
                  <span className="so-kicker">LAUNCH ATTENTION</span>
                  <h2>{blockers.length} blocker{blockers.length === 1 ? "" : "s"} · {reviews.length} review item{reviews.length === 1 ? "" : "s"}</h2>
                </div>
                <CircleAlert />
              </div>
              <p style={{ color: "#5E6B72", marginBottom: 0 }}>
                Resolve every blocked item before using Live Mode keys. Review warnings manually in Codespaces or the final Cloudflare runtime.
              </p>
            </section>
          )}

          {areaMeta.map((meta) => {
            const items = report.checks.filter((item) => item.area === meta.area);
            if (!items.length) return null;
            return (
              <section className="so-card readiness-section" key={meta.area}>
                <header>
                  <div className="readiness-area-icon"><AreaIcon area={meta.area} /></div>
                  <div>
                    <h2>{meta.title}</h2>
                    <p>{meta.description}</p>
                  </div>
                </header>
                <div>{items.map((item) => <CheckRow key={item.id} item={item} />)}</div>
              </section>
            );
          })}

          <section className="so-card so-pad so-mt readiness-manual">
            <div>
              <span className="so-kicker">MANUAL QA REMAINS REQUIRED</span>
              <h2>Codespaces and Test Mode transaction checklist</h2>
              <p>Automated diagnostics cannot complete Google OAuth, a real Razorpay Checkout, webhook replay, or browser redirects. Follow <code>docs/V6_8_CODESPACES_QA.md</code> and record the evidence in the draft pull request.</p>
            </div>
            <FileCheck2 size={34} />
          </section>
        </>
      )}

      <style jsx>{`
        .readiness-error{display:flex;gap:14px;padding:18px;border:1px solid #f3b8b3;background:#fff3f2;border-radius:16px;color:#8f241d;margin:18px 0}.readiness-error p{margin:7px 0 0;color:#6f312c}
        .readiness-loading{display:flex;gap:12px;align-items:center;color:#5e6b72}
        .readiness-hero{display:grid;grid-template-columns:auto 1fr auto;gap:18px;align-items:center;padding:22px;border-radius:18px;border:1px solid #d7e2df;background:#f7f9f7}.readiness-hero.readiness-fail{border-color:#f1b9b4;background:#fff6f5}.readiness-hero.readiness-warning{border-color:#ead59b;background:#fffbef}.readiness-hero-icon{width:58px;height:58px;border-radius:16px;display:grid;place-items:center;background:#0e5a5a;color:white}.readiness-hero h2{margin:4px 0;color:#14232b}.readiness-hero p{margin:0;color:#5e6b72}.readiness-actor{text-align:right;display:flex;flex-direction:column;gap:3px}.readiness-actor span,.readiness-actor small{color:#69777e;font-size:12px}.readiness-summary{margin-top:18px}
        .readiness-section{margin-top:20px;overflow:hidden}.readiness-section>header{display:flex;gap:12px;align-items:center;padding:20px;border-bottom:1px solid #e9efed;background:#fbfcfb}.readiness-section h2{margin:0;color:#14232b}.readiness-section header p{margin:4px 0 0;color:#68777e}.readiness-area-icon{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:#dce9e7;color:#0e5a5a}
        .readiness-row{display:grid;grid-template-columns:124px 1fr;gap:18px;padding:18px 20px;border-bottom:1px solid #edf1f0}.readiness-row:last-child{border-bottom:0}.readiness-row strong{color:#26373f}.readiness-row p{margin:5px 0;color:#5f6f76;line-height:1.55}.readiness-status{display:flex;gap:8px;align-items:center;font-weight:800;align-self:start}.readiness-pass{color:#137a3a}.readiness-warning{color:#986100}.readiness-fail{color:#b42318}.readiness-info{color:#52616a}.readiness-action{margin-top:9px;padding:10px 12px;border-radius:10px;background:#f5f7f6;color:#43535b;font-size:13px}.readiness-details{display:flex;flex-wrap:wrap;gap:7px;margin-top:9px}.readiness-details span{font-size:11px;padding:5px 8px;border-radius:999px;background:#edf4f2;color:#43535b}.readiness-manual{display:flex;justify-content:space-between;gap:18px;align-items:center}.readiness-manual p{color:#5f6f76;max-width:900px;line-height:1.6}.readiness-manual code{background:#eef3f2;padding:2px 5px;border-radius:5px}
        @media(max-width:800px){.readiness-hero{grid-template-columns:auto 1fr}.readiness-actor{grid-column:1/-1;text-align:left}.readiness-row{grid-template-columns:1fr}.readiness-status{margin-bottom:-8px}.readiness-manual{align-items:flex-start}}
      `}</style>
    </div>
  );
}
