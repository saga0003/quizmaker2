'use client';

import { useEffect, useState } from 'react';
import { Activity, Database, RefreshCw, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Audit &amp; Health</h1>
          <p className="text-sm text-[var(--muted-foreground)]">Platform readiness and auditable operational controls. Detailed incident monitoring is completed under Section I.</p>
        </div>
        <Button variant="outline" onClick={() => void refresh()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
      </div>

      {error && <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="rounded-xl shadow-sm"><CardContent className="p-4"><Activity className="mb-2 h-5 w-5 text-[var(--teal)]" /><p className="text-xs text-[var(--muted-foreground)]">Application readiness</p><p className="mt-1 font-bold">{loading ? 'Checking…' : health?.healthy ? 'Ready' : 'Needs attention'}</p></CardContent></Card>
        <Card className="rounded-xl shadow-sm"><CardContent className="p-4"><Database className="mb-2 h-5 w-5 text-[var(--teal)]" /><p className="text-xs text-[var(--muted-foreground)]">Server data access</p><p className="mt-1 font-bold">{loading ? 'Checking…' : health?.serverReady ? 'Configured' : health?.configured ? 'Partial' : 'Demo mode'}</p></CardContent></Card>
        <Card className="rounded-xl shadow-sm"><CardContent className="p-4"><ShieldCheck className="mb-2 h-5 w-5 text-[var(--teal)]" /><p className="text-xs text-[var(--muted-foreground)]">Release</p><p className="mt-1 font-bold">{health?.release || '—'}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">{health?.deploymentTarget || health?.mode || '—'}</p></CardContent></Card>
      </div>

      <Card className="rounded-xl shadow-sm"><CardContent className="p-4"><h2 className="font-semibold">Audit coverage</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Privileged institution, subscription, account, credential, question, paper, result, resource and read-only View As changes are written to the server audit trail. This screen intentionally does not fabricate uptime or incident claims.</p></CardContent></Card>
    </div>
  );
}
