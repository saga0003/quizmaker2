'use client';

import { useEffect, useState } from 'react';
import { Activity, Database, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Phase1AsyncState, Phase1Card, Phase1PageHeading } from '@/components/evidara/phase1-ui';

type HealthPayload = {
  healthy: boolean;
  release?: string;
  mode?: string;
  configured?: boolean;
  serverReady?: boolean;
  deploymentTarget?: string;
  issue?: string | null;
};

export function AdminAuditHealthView() {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/health/', { cache: 'no-store' });
      const payload = (await response.json()) as HealthPayload;
      setHealth(payload);
      if (!response.ok) setError(payload.issue || 'Health check reported a degraded state.');
    } catch (err) {
      setHealth(null);
      setError(err instanceof Error ? err.message : 'Unable to load health status.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  return (
    <div className="space-y-5 p-4 md:p-6">
      <Phase1PageHeading
        title="Audit & Health"
        description="Platform readiness and auditable operational controls. Detailed incident monitoring is completed under Section I."
        actions={<Button variant="outline" onClick={() => void refresh()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>}
      />

      {loading ? <Phase1AsyncState state="loading" compact title="Checking platform health" description="Reading the current server readiness state…" /> : null}
      {!loading && error ? <Phase1AsyncState state="error" compact title="Health check needs attention" description={error} action={<Button variant="outline" onClick={() => void refresh()}>Retry</Button>} /> : null}
      {!loading && !error && !health ? <Phase1AsyncState state="empty" compact title="No health evidence available" description="Refresh to request the current platform readiness state." action={<Button variant="outline" onClick={() => void refresh()}>Refresh</Button>} /> : null}

      {!loading && health ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Phase1Card><Activity className="mb-2 h-5 w-5 text-[var(--teal)]" /><p className="text-xs text-[var(--muted-foreground)]">Application readiness</p><p className="mt-1 font-bold">{health.healthy ? 'Ready' : 'Needs attention'}</p></Phase1Card>
            <Phase1Card><Database className="mb-2 h-5 w-5 text-[var(--teal)]" /><p className="text-xs text-[var(--muted-foreground)]">Server data access</p><p className="mt-1 font-bold">{health.serverReady ? 'Configured' : health.configured ? 'Partial' : 'Demo mode'}</p></Phase1Card>
            <Phase1Card><ShieldCheck className="mb-2 h-5 w-5 text-[var(--teal)]" /><p className="text-xs text-[var(--muted-foreground)]">Release</p><p className="mt-1 font-bold">{health.release || '—'}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">{health.deploymentTarget || health.mode || '—'}</p></Phase1Card>
          </div>
          <Phase1Card><h2 className="font-semibold">Audit coverage</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Privileged institution, subscription, account, credential, question, paper, result, resource and read-only View As changes are written to the server audit trail. This screen intentionally does not fabricate uptime or incident claims.</p></Phase1Card>
        </>
      ) : null}
    </div>
  );
}
