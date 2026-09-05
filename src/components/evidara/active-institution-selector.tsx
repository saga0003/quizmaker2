'use client';

import { Building2 } from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';

export function ActiveInstitutionSelector({ compact = false }: { compact?: boolean }) {
  const {
    institutionMemberships,
    activeOrganizationId,
    activeInstitution,
    requiresInstitutionSelection,
    membershipsLoading,
    setActiveOrganizationId,
  } = useAuth();

  if (membershipsLoading || institutionMemberships.length === 0) return null;

  if (compact) {
    return (
      <div className="flex items-center justify-center py-2" title={activeInstitution?.organizationName || 'Choose institution'}>
        <Building2 className={`h-4 w-4 ${requiresInstitutionSelection ? 'text-[var(--amber)]' : 'text-white/45'}`} />
      </div>
    );
  }

  return (
    <div className={`mx-3 mb-3 rounded-lg border px-3 py-2 ${requiresInstitutionSelection ? 'border-[var(--amber)]/50 bg-[var(--amber)]/10' : 'border-white/10 bg-white/5'}`}>
      <label htmlFor="active-institution" className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/45">
        <Building2 className="h-3.5 w-3.5" /> Active institution
      </label>
      {institutionMemberships.length === 1 ? (
        <p className="truncate text-xs font-medium text-white/85">{institutionMemberships[0].organizationName}</p>
      ) : (
        <select
          id="active-institution"
          value={activeOrganizationId || ''}
          onChange={(event) => setActiveOrganizationId(event.target.value || null)}
          className="w-full rounded-md border border-white/15 bg-[var(--midnight)] px-2 py-1.5 text-xs text-white outline-none focus:border-[var(--teal)]"
          aria-required="true"
        >
          <option value="">Choose institution…</option>
          {institutionMemberships.map((membership) => (
            <option key={membership.organizationId} value={membership.organizationId}>{membership.organizationName}</option>
          ))}
        </select>
      )}
      {requiresInstitutionSelection && <p className="mt-1.5 text-[10px] leading-4 text-[var(--amber)]">Choose a school before opening or changing institution data.</p>}
    </div>
  );
}
