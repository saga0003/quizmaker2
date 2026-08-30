'use client';

import { useState } from 'react';
import { Eye, RotateCcw, UserRoundCog } from 'lucide-react';
import { evidaraRoleLabel, type EvidaraRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/use-app-store';

const VIEW_AS_ROLES: Exclude<EvidaraRole, 'super_admin'>[] = [
  'evidara_admin',
  'school_admin',
  'school_teacher',
  'student',
];

export function LoginAsSwitcher({ compact = false, onSelected }: { compact?: boolean; onSelected?: () => void }) {
  const baseUser = useAppStore((state) => state.baseUser);
  const impersonatingAs = useAppStore((state) => state.impersonatingAs);
  const loginAs = useAppStore((state) => state.loginAs);
  const exitLoginAs = useAppStore((state) => state.exitLoginAs);
  const [auditError, setAuditError] = useState('');
  const [switching, setSwitching] = useState(false);

  if (baseUser?.accessRole !== 'super_admin') return null;

  async function auditViewAs(event: 'started' | 'ended', targetRole: EvidaraRole | null) {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { error } = await supabase.rpc('audit_view_as_v20', {
      p_event: event,
      p_target_role: targetRole,
      p_organization_id: null,
    });
    if (error) throw error;
  }

  async function beginViewAs(role: Exclude<EvidaraRole, 'super_admin'>) {
    setSwitching(true);
    setAuditError('');
    try {
      await auditViewAs('started', role);
      loginAs(role);
      onSelected?.();
    } catch (error) {
      setAuditError(error instanceof Error ? error.message : 'Unable to record this View As session.');
    } finally {
      setSwitching(false);
    }
  }

  async function endViewAs() {
    const role = impersonatingAs;
    setSwitching(true);
    setAuditError('');
    try {
      await auditViewAs('ended', role);
    } catch (error) {
      // Never trap a Super Admin inside a read-only preview if audit transport is unavailable.
      console.error('Unable to record View As exit', error);
    } finally {
      exitLoginAs();
      onSelected?.();
      setSwitching(false);
    }
  }

  if (impersonatingAs) {
    return (
      <div className={compact ? 'rounded-lg border border-amber-300/20 bg-amber-300/10 p-2.5' : 'rounded-lg border border-[var(--amber)]/25 bg-[var(--amber)]/10 p-3'}>
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--amber)]">
          <Eye className="h-4 w-4" />
          Viewing as {evidaraRoleLabel(impersonatingAs)}
        </div>
        <p className="mt-1.5 text-[10px] leading-4 text-white/55">Read-only Super Admin preview. Page actions are disabled and the session is audit logged.</p>
        <button
          type="button"
          disabled={switching}
          onClick={() => void endViewAs()}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-white/10 px-2.5 py-2 text-xs font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Exit View As
        </button>
      </div>
    );
  }

  return (
    <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
      <div className="flex items-center gap-2 px-1 pb-1 text-[10px] font-semibold uppercase tracking-widest text-white/35">
        <UserRoundCog className="h-3.5 w-3.5" />
        View As · Read only
      </div>
      {auditError && <p className="px-1 pb-1 text-[10px] leading-4 text-red-300">{auditError}</p>}
      {VIEW_AS_ROLES.map((role) => (
        <button
          key={role}
          type="button"
          disabled={switching}
          onClick={() => void beginViewAs(role)}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] font-medium text-white/60 transition hover:bg-white/8 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--amber)]/80" />
          {evidaraRoleLabel(role)}
        </button>
      ))}
    </div>
  );
}
