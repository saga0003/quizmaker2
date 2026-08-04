'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/use-app-store';
import { normalizeEvidaraRole } from '@/lib/roles';

export type EvidaraModuleKey =
  | 'questions'
  | 'papers'
  | 'students'
  | 'analytics'
  | 'resources'
  | 'achievements'
  | 'benchmarks'
  | 'subscriptions';

type ModuleSetting = {
  organization_id: string | null;
  role: string;
  module_key: EvidaraModuleKey;
  enabled: boolean;
};

const modules: EvidaraModuleKey[] = [
  'questions',
  'papers',
  'students',
  'analytics',
  'resources',
  'achievements',
  'benchmarks',
  'subscriptions',
];

function defaults(role: string) {
  const normalized = normalizeEvidaraRole(role);
  return Object.fromEntries(modules.map((moduleKey) => [
    moduleKey,
    !(normalized === 'student' && moduleKey === 'questions')
      && !(normalized === 'school_teacher' && (moduleKey === 'students' || moduleKey === 'subscriptions')),
  ])) as Record<EvidaraModuleKey, boolean>;
}

export function useModuleAccess() {
  const user = useAppStore((state) => state.user);
  const [access, setAccess] = useState<Record<EvidaraModuleKey, boolean>>(() => defaults(user?.accessRole || 'student'));

  useEffect(() => {
    const role = normalizeEvidaraRole(user?.accessRole);
    setAccess(defaults(role));
    if (!user || !supabase) return;
    if (role === 'super_admin' || role === 'evidara_admin') {
      setAccess(Object.fromEntries(modules.map((moduleKey) => [moduleKey, true])) as Record<EvidaraModuleKey, boolean>);
      return;
    }

    let cancelled = false;
    void (async () => {
      const [{ data: memberships }, { data: settings }] = await Promise.all([
        supabase
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .limit(1),
        supabase
          .from('module_access_settings')
          .select('organization_id,role,module_key,enabled')
          .eq('role', role),
      ]);
      if (cancelled) return;
      const organizationId = memberships?.[0]?.organization_id || null;
      const next = defaults(role);
      const rows = (settings || []) as ModuleSetting[];
      rows.filter((setting) => setting.organization_id === null).forEach((setting) => {
        next[setting.module_key] = setting.enabled;
      });
      if (organizationId) {
        rows.filter((setting) => setting.organization_id === organizationId).forEach((setting) => {
          next[setting.module_key] = setting.enabled;
        });
      }
      if (role === 'student') next.questions = false;
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
