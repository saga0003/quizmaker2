'use client';

import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, Database, HardDrive, RefreshCw, Server, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Phase1AsyncState, Phase1Card, Phase1PageHeading } from '@/components/evidara/phase1-ui';
import { supabase } from '@/lib/supabase';

type PlatformHealthPayload = {
  generatedAt?: string;
  healthy?: boolean;
  deployment?: { status?: string; target?: string; release?: string };
  database?: { status?: string; latencyMs?: number };
  storage?: { status?: string };
  usage?: Record<string, number>;
  failures24h?: Record<string, number>;
  evidenceWindowHours?: number;
  countStrategy?: string;
  error?: string;
};

const usageLabels: Record<string, string> = {
  users: 'Users',
  schools: 'Schools',
  activeStudents: 'Active students',
  questions: 'Questions',
  papers: 'Papers',
  attempts: 'Attempts',
  responses: 'Responses',
  resources: 'Active resources',
};

const failureLabels: Record<string, string> = {
  imports: 'Failed import rows',
  testStarts: 'Failed test starts',
  answerSaves: 'Failed answer saves',
  submissions: 'Failed submissions',
};

async function authFetchPlatformHealth() {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in again to view platform health.');
  const response = await fetch('/api/admin/platform-health/', {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = (await response.json()) as PlatformHealthPayload;
  if (!response.ok) throw new Error(payload.error || 'Platform health check reported a degraded state.');
  return payload;
}

function statusText(value?: string) {
  if (!value) return '—';
  return value.replace(/_/g, ' ').replace(/^./, (char) => char.toUpperCase());
}

export function AdminAuditHealthView() {
  const [health, setHealth] = useState<PlatformHealthPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setHealth(await authFetchPlatformHealth());
    } catch (err) {
      setHealth(null);
      setError(err instanceof Error ? err.message : 'Unable to load health status.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  const failures = health?.failures24h ?? {};
  const failureTotal = Object.values(failures).reduce((sum, value) => sum + Number(value || 0), 0);

  return (
    <div className="space-y-5 p-4 md:p-6">
      <Phase1PageHeading
        title="Audit & Health"
        description="Super Admin operational view for deployment, database, storage, usage and recent failure evidence. Counts are aggregated inside PostgreSQL rather than downloading whole tables."
        actions={<Button variant="outline" onClick={() => void refresh()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>}
      />

      {loading ? <Phase1AsyncState state="loading" compact title="Checking platform health" description="Reading current operational evidence…" /> : null}
      {!loading && error ? <Phase1AsyncState state="error" compact title="Health check needs attention" description={error} action={<Button variant="outline" onClick={() => void refresh()}>Retry</Button>} /> : null}
      {!loading && !error && !health ? <Phase1AsyncState state="empty" compact title="No health evidence available" description="Refresh to request the current platform state." action={<Button variant="outline" onClick={() => void refresh()}>Refresh</Button>} /> : null}

      {!loading && health ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Phase1Card><Server className="mb-2 h-5 w-5 text-[var(--teal)]" /><p className="text-xs text-[var(--muted-foreground)]">Deployment</p><p className="mt-1 font-bold">{statusText(health.deployment?.status)}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">{health.deployment?.target || '—'} · {health.deployment?.release || '—'}</p></Phase1Card>
            <Phase1Card><Database className="mb-2 h-5 w-5 text-[var(--teal)]" /><p className="text-xs text-[var(--muted-foreground)]">Database</p><p className="mt-1 font-bold">{statusText(health.database?.status)}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">{Number.isFinite(health.database?.latencyMs) ? `${health.database?.latencyMs} ms snapshot` : '—'}</p></Phase1Card>
            <Phase1Card><HardDrive className="mb-2 h-5 w-5 text-[var(--teal)]" /><p className="text-xs text-[var(--muted-foreground)]">Storage</p><p className="mt-1 font-bold">{statusText(health.storage?.status)}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">R2 configuration readiness</p></Phase1Card>
            <Phase1Card><Activity className="mb-2 h-5 w-5 text-[var(--teal)]" /><p className="text-xs text-[var(--muted-foreground)]">24h failures</p><p className="mt-1 font-bold">{failureTotal}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">Imports + test critical path</p></Phase1Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Phase1Card>
              <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-[var(--teal)]" /><h2 className="font-semibold">PostgreSQL usage snapshot</h2></div>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">Server aggregate: {health.countStrategy || '—'}</p>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Object.entries(usageLabels).map(([key, label]) => <div key={key} className="rounded-lg border border-[var(--line)] p-3"><p className="text-xs text-[var(--muted-foreground)]">{label}</p><p className="mt-1 text-lg font-bold">{health.usage?.[key] ?? '—'}</p></div>)}
              </div>
            </Phase1Card>

            <Phase1Card>
              <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-[var(--teal)]" /><h2 className="font-semibold">Failure evidence · last {health.evidenceWindowHours ?? 24}h</h2></div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {Object.entries(failureLabels).map(([key, label]) => {
                  const value = health.failures24h?.[key] ?? 0;
                  return <div key={key} className="flex items-center justify-between rounded-lg border border-[var(--line)] px-3 py-2 text-sm"><span>{label}</span><strong>{value}</strong></div>;
                })}
              </div>
              <p className="mt-3 text-xs text-[var(--muted-foreground)]">A non-zero value is evidence to investigate, not a fabricated uptime or incident claim.</p>
            </Phase1Card>
          </div>

          <Phase1Card><h2 className="font-semibold">Audit coverage</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Privileged institution, subscription, account, credential, question, paper, result, resource and read-only View As changes are written to the server audit trail. Snapshot generated {health.generatedAt ? new Date(health.generatedAt).toLocaleString('en-IN') : '—'}.</p></Phase1Card>
        </>
      ) : null}
    </div>
  );
}
