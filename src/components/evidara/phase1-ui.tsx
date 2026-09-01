'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, LoaderCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function Phase1PageHeading({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col min-w-0 gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="break-words text-2xl font-bold tracking-tight text-[var(--foreground)] [overflow-wrap:anywhere]">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl break-words text-sm text-[var(--muted-foreground)] [overflow-wrap:anywhere]">{description}</p> : null}
      </div>
      {actions ? <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">{actions}</div> : null}
    </div>
  );
}

export function Phase1Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <Card className={`min-w-0 rounded-xl border-[var(--line)] shadow-sm ${className}`}><CardContent className="min-w-0 p-4 sm:p-5">{children}</CardContent></Card>;
}

export function Phase1FilterBar({ children, label = 'Filters' }: { children: ReactNode; label?: string }) {
  return <div aria-label={label} className="flex flex-col min-w-0 gap-2 rounded-xl border border-[var(--line)] bg-white p-3 [&>*]:min-w-0 sm:flex-row sm:flex-wrap sm:items-end">{children}</div>;
}

export function Phase1TableFrame({ children, label }: { children: ReactNode; label: string }) {
  return <div role="region" aria-label={label} tabIndex={0} className="max-w-full min-w-0 overflow-x-auto overscroll-x-contain rounded-xl border border-[var(--line)] bg-white [scrollbar-gutter:stable] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal)]">{children}</div>;
}

export function Phase1AsyncState({ state, title, description, action, compact = false }: { state: 'loading' | 'error' | 'empty'; title: string; description?: string; action?: ReactNode; compact?: boolean }) {
  const Icon = state === 'loading' ? LoaderCircle : state === 'error' ? AlertTriangle : Inbox;
  const statusRole = state === 'error' ? 'alert' : 'status';
  return (
    <div role={statusRole} aria-live={state === 'error' ? 'assertive' : 'polite'} className={`grid min-w-0 place-items-center rounded-xl border border-[var(--line)] bg-white text-center ${compact ? 'min-h-28 p-4' : 'min-h-[280px] p-6'}`}>
      <div className="min-w-0 max-w-xl">
        <Icon className={`mx-auto mb-3 h-6 w-6 ${state === 'loading' ? 'animate-spin text-[var(--teal)]' : state === 'error' ? 'text-amber-600' : 'text-[var(--muted-foreground)]'}`} aria-hidden="true" />
        <p className="break-words font-semibold text-[var(--foreground)] [overflow-wrap:anywhere]">{title}</p>
        {description ? <p className="mt-1 break-words text-sm text-[var(--muted-foreground)] [overflow-wrap:anywhere]">{description}</p> : null}
        {action ? <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div> : null}
      </div>
    </div>
  );
}
