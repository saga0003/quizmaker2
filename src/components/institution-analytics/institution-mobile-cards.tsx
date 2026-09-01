'use client';

import { ChevronRight } from 'lucide-react';

export type InstitutionMobileMetric = {
  label: string;
  value: string | number;
};

export type InstitutionMobileCard = {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  metrics: InstitutionMobileMetric[];
  onOpen?: () => void;
};

export function InstitutionMobileCards({ rows, emptyMessage }: { rows: InstitutionMobileCard[]; emptyMessage: string }) {
  if (!rows.length) {
    return <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground md:hidden">{emptyMessage}</div>;
  }

  return <div className="grid gap-3 md:hidden" aria-label="Mobile analytics records">
    {rows.map((row) => {
      const body = <>
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <strong className="block break-words text-sm font-semibold [overflow-wrap:anywhere]">{row.title}</strong>
            {row.subtitle ? <span className="mt-1 block break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">{row.subtitle}</span> : null}
          </div>
          {row.badge ? <span className="shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium">{row.badge}</span> : null}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
          {row.metrics.map((metric) => <div key={metric.label} className="min-w-0">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{metric.label}</dt>
            <dd className="mt-0.5 break-words text-sm font-semibold [overflow-wrap:anywhere]">{metric.value}</dd>
          </div>)}
        </dl>
        {row.onOpen ? <div className="mt-3 flex items-center justify-end gap-1 border-t pt-3 text-xs font-semibold text-primary">Open analytics <ChevronRight className="h-4 w-4" /></div> : null}
      </>;
      return row.onOpen ? <button key={row.id} type="button" onClick={row.onOpen} className="min-h-11 w-full min-w-0 rounded-xl border bg-card p-4 text-left shadow-sm outline-none transition hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">{body}</button> : <article key={row.id} className="min-w-0 rounded-xl border bg-card p-4 shadow-sm">{body}</article>;
    })}
  </div>;
}
