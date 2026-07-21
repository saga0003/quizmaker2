'use client';

import { useEffect } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { normalizeEvidaraRole } from '@/lib/roles';
import { cloudRoleToV7Role, useAppStore } from '@/store/use-app-store';

export function V7AuthBridge() {
  const { user, profile, loading, configured } = useAuth();
  const setCloudUser = useAppStore((state) => state.setCloudUser);
  const setAuthReady = useAppStore((state) => state.setAuthReady);

  useEffect(() => {
    if (!configured) {
      setAuthReady(true);
      return;
    }

    if (loading) {
      setAuthReady(false);
      return;
    }

    if (!user) {
      setCloudUser(null);
      setAuthReady(true);
      return;
    }

    const accessRole = normalizeEvidaraRole(profile?.role);
    const role = cloudRoleToV7Role(accessRole);
    setCloudUser({
      id: user.id,
      name:
        profile?.full_name ||
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split('@')[0] ||
        'Evidara user',
      email: user.email || '',
      role,
      accessRole,
      avatar: user.user_metadata?.avatar_url || user.user_metadata?.picture || undefined,
    });
    setAuthReady(true);
  }, [configured, loading, profile, setAuthReady, setCloudUser, user]);

  return null;
}
