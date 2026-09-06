'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/use-app-store';
import { normalizeEvidaraRole, type EvidaraRole } from '@/lib/roles';
import { EVIDARA_MODULE_KEYS, type EvidaraModuleAccess, type EvidaraModuleKey } from '@/lib/modules';

type ModuleSetting = {
  organization_id: string | null;
  role: string;
  module_key: EvidaraModuleKey;
  enabled: boolean;
};

const modules = EVIDARA_MODULE_KEYS;

export function isHardLockedModule(role: EvidaraRole, moduleKey: EvidaraModuleKey) {
  if (role === 'student') return ['questions', 'students', 'subscriptions'].includes(moduleKey);
  if (role === 'school_teacher') return ['students', 'subscriptions'].includes(moduleKey);
  return false;
}

function defaults(role: string) {
  const normalized = normalizeEvidaraRole(role);
  return Object.fromEntries(modules.map((moduleKey) => [
    moduleKey,
    !isHardLockedModule(normalized, moduleKey),
  ])) as EvidaraModuleAccess;
}

export function useModuleAccess() {
  const user = useAppStore((state) => state.user);
  const [access, setAccess] = useState<EvidaraModuleAccess>(() => defaults(user?.accessRole || 'student'));

  useEffect(() => {
    const role = normalizeEvidaraRole(user?.accessRole);
    setAccess(defaults(role));
    if (!user || !supabase) return;
    if (role === 'super_admin' || role === 'evidara_admin') {
      setAccess(Object.fromEntries(modules.map((moduleKey) => [moduleKey, true])) as EvidaraModuleAccess);
      return;
    }

    let cancelled = false;
    void (async () => {
      const [staffMembershipResult, studentMembershipResult, settingsResult] = await Promise.all([
        supabase
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .limit(1),
        role === 'student'
          ? supabase
              .from('student_school_memberships')
              .select('organization_id')
              .eq('student_id', user.id)
              .eq('status', 'active')
              .limit(1)
          : Promise.resolve({ data: [] as Array<{ organization_id: string }> }),
        supabase
          .from('module_access_settings')
          .select('organization_id,role,module_key,enabled')
          .eq('role', role),
      ]);
      if (cancelled) return;

      const organizationId = role === 'student'
        ? studentMembershipResult.data?.[0]?.organization_id || null
        : staffMembershipResult.data?.[0]?.organization_id || null;
      const next = defaults(role);
      const rows = (settingsResult.data || []) as ModuleSetting[];

      rows.filter((setting) => setting.organization_id === null).forEach((setting) => {
        next[setting.module_key] = setting.enabled;
      });
      if (organizationId) {
        rows.filter((setting) => setting.organization_id === organizationId).forEach((setting) => {
          next[setting.module_key] = setting.enabled;
        });
      }

      modules.forEach((moduleKey) => {
        if (isHardLockedModule(role, moduleKey)) next[moduleKey] = false;
      });
      setAccess(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  return useMemo(() => ({
    access,
    canAccess: (moduleKey?: EvidaraModuleKey) => !moduleKey || access[moduleKey],
  }), [access]);
}
