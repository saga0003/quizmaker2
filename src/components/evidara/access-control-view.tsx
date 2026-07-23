'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyRound,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/use-app-store';
import { evidaraRoleLabel, type EvidaraRole } from '@/lib/roles';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { HelpIcon } from '@/components/evidara/question-help';

const moduleDefinitions = [
  ['questions', 'Questions', 'Create, import, review and manage question banks.'],
  ['papers', 'Papers', 'Build, publish and manage assessment papers.'],
  ['students', 'Students', 'View and manage school students.'],
  ['analytics', 'Analytics', 'Open learning analytics and reports.'],
  ['resources', 'Resources', 'View and manage academic resources.'],
  ['achievements', 'Achievements', 'Use achievements and certificates.'],
  ['benchmarks', 'Benchmarks', 'Use shared and school benchmark reports.'],
  ['subscriptions', 'Subscriptions', 'View subscription and billing controls.'],
] as const;

type ModuleKey = typeof moduleDefinitions[number][0];

type Setting = {
  id: string;
  organization_id: string | null;
  role: EvidaraRole;
  module_key: ModuleKey;
  enabled: boolean;
  updated_at: string;
};

type Organization = {
  id: string;
  name: string;
  city?: string;
  state?: string;
};

type Account = {
  id: string;
  full_name: string | null;
  phone?: string | null;
  email: string;
  role: EvidaraRole;
  updated_at: string;
  memberships: Array<{ organizationId: string; organizationName: string; role: EvidaraRole }>;
};

type Snapshot = {
  actor: {
    id: string;
    role: EvidaraRole;
    superAdmin: boolean;
    platformAdmin: boolean;
    schoolManager: boolean;
    organizationId: string | null;
  };
  activeOrganizationId: string | null;
  organizations: Organization[];
  settings: Setting[];
  accounts: Account[];
};

const roleOptions: EvidaraRole[] = ['super_admin', 'evidara_admin', 'school_admin', 'school_teacher', 'student'];
const schoolRoleOptions: EvidaraRole[] = ['school_admin', 'school_teacher', 'student'];

async function token() {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error(error?.message || 'Sign in again to manage access.');
  return data.session.access_token;
}

async function requestAccess(url: string, init?: RequestInit) {
  const accessToken = await token();
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Access-control request failed.');
  return payload as Snapshot;
}

export function AccessControlView({ kind }: { kind: 'admin' | 'school' }) {
  const currentUser = useAppStore((state) => state.user);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [scopeOrganizationId, setScopeOrganizationId] = useState<string>('platform');
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [roleDrafts, setRoleDrafts] = useState<Record<string, EvidaraRole>>({});
  const [schoolDrafts, setSchoolDrafts] = useState<Record<string, string>>({});
  const [passwordAccount, setPasswordAccount] = useState<Account | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState('');

  const load = useCallback(async (organizationId?: string) => {
    setLoading(true);
    setError('');
    try {
      const query = organizationId && organizationId !== 'platform'
        ? `?organizationId=${encodeURIComponent(organizationId)}`
        : '';
      const data = await requestAccess(`/api/access-control/${query}`);
      setSnapshot(data);
      const resolved = kind === 'school'
        ? data.actor.organizationId || 'platform'
        : organizationId || (data.activeOrganizationId || 'platform');
      setScopeOrganizationId(resolved);
      setRoleDrafts(Object.fromEntries(data.accounts.map((account) => [account.id, account.role])));
      setSchoolDrafts(Object.fromEntries(data.accounts.map((account) => [account.id, account.memberships[0]?.organizationId || ''])));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load access settings.');
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    void load();
  }, [load]);

  const effectiveRoles = useMemo(() => {
    if (!snapshot) return [] as EvidaraRole[];
    if (scopeOrganizationId === 'platform') return roleOptions;
    return schoolRoleOptions;
  }, [scopeOrganizationId, snapshot]);

  const filteredAccounts = useMemo(() => {
    const accounts = snapshot?.accounts || [];
    const query = search.trim().toLowerCase();
    return accounts.filter((account) => {
      const text = `${account.full_name || ''} ${account.email} ${account.phone || ''} ${account.memberships.map((item) => item.organizationName).join(' ')}`.toLowerCase();
      return (!query || text.includes(query)) && (roleFilter === 'all' || account.role === roleFilter);
    });
  }, [roleFilter, search, snapshot]);

  function enabled(role: EvidaraRole, moduleKey: ModuleKey) {
    if (role === 'student' && moduleKey === 'questions') return false;
    if (!snapshot) return true;
    const organizationId = scopeOrganizationId === 'platform' ? null : scopeOrganizationId;
    const scoped = snapshot.settings.find((setting) =>
      setting.organization_id === organizationId && setting.role === role && setting.module_key === moduleKey,
    );
    if (scoped) return scoped.enabled;
    const platform = snapshot.settings.find((setting) =>
      setting.organization_id === null && setting.role === role && setting.module_key === moduleKey,
    );
    if (platform) return platform.enabled;
    if (role === 'school_teacher' && (moduleKey === 'students' || moduleKey === 'subscriptions')) return false;
    return true;
  }

  async function mutate(body: Record<string, unknown>, key: string, success: string) {
    setSavingKey(key);
    setError('');
    setMessage('');
    try {
      const data = await requestAccess('/api/access-control/', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setSnapshot(data);
      setMessage(success);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save this change.');
    } finally {
      setSavingKey('');
    }
  }

  async function setModule(role: EvidaraRole, moduleKey: ModuleKey, value: boolean) {
    await mutate({
      action: 'setModuleAccess',
      organizationId: scopeOrganizationId === 'platform' ? null : scopeOrganizationId,
      role,
      moduleKey,
      enabled: value,
    }, `${role}:${moduleKey}`, `${evidaraRoleLabel(role)} access updated.`);
  }

  async function saveRole(account: Account) {
    const role = roleDrafts[account.id] || account.role;
    const organizationId = schoolDrafts[account.id] || null;
    await mutate({
      action: 'setRole',
      userId: account.id,
      role,
      organizationId,
    }, `role:${account.id}`, `${account.full_name || account.email || 'Account'} is now ${evidaraRoleLabel(role)}.`);
  }

  async function resetPassword() {
    if (!passwordAccount) return;
    await mutate({
      action: 'resetPassword',
      userId: passwordAccount.id,
      temporaryPassword,
      organizationId: scopeOrganizationId === 'platform' ? null : scopeOrganizationId,
    }, `password:${passwordAccount.id}`, `Temporary password set for ${passwordAccount.full_name || passwordAccount.email}.`);
    setPasswordAccount(null);
    setTemporaryPassword('');
  }

  if (loading && !snapshot) {
    return <div className="rounded-2xl border border-[#E7ECEB] bg-white p-10 text-center text-sm text-[#6B7980]"><LoaderCircle className="mx-auto mb-3 h-6 w-6 animate-spin text-[#0E5A5A]" />Loading roles and module access…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#0E5A5A]">
            <ShieldCheck className="h-4 w-4" />Access governance
          </div>
          <div className="mt-2 flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[#14232B]">{kind === 'admin' ? 'Access & Accounts' : 'School Access Control'}</h1>
            <HelpIcon text="A checked module appears for that role. Removing access hides it from navigation and blocks the workspace. Student access to Questions is permanently disabled." />
          </div>
          <p className="mt-1 text-sm text-[#6B7980]">Control modules with one check mark. Super Admin can additionally change roles and reset passwords.</p>
        </div>
        <Button variant="outline" onClick={() => void load(scopeOrganizationId)} disabled={loading} className="border-[#E7ECEB]">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh
        </Button>
      </div>

      {error && <div className="rounded-xl border border-[#B54747]/20 bg-[#B54747]/5 px-4 py-3 text-sm text-[#B54747]">{error}</div>}
      {message && <div className="rounded-xl border border-[#0E5A5A]/20 bg-[#DCE9E7]/60 px-4 py-3 text-sm text-[#0E5A5A]">{message}</div>}

      {snapshot?.actor.platformAdmin && (
        <Card className="gap-0 border-[#E7ECEB] shadow-none">
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <strong className="text-sm text-[#14232B]">Permission scope</strong>
              <p className="text-xs text-[#6B7980]">Platform defaults apply everywhere unless a school-specific setting overrides them.</p>
            </div>
            <Select
              value={scopeOrganizationId}
              onValueChange={(value) => {
                setScopeOrganizationId(value);
                void load(value);
              }}
            >
              <SelectTrigger className="w-full border-[#E7ECEB] md:w-[320px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="platform">Platform default</SelectItem>
                {(snapshot.organizations || []).map((organization) => <SelectItem key={organization.id} value={organization.id}>{organization.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      <Card className="gap-0 overflow-hidden border-[#E7ECEB] shadow-none">
        <div className="border-b border-[#E7ECEB] bg-[#F7F9F7] px-5 py-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-[#0E5A5A]" />
            <div>
              <strong className="text-sm text-[#14232B]">Module permissions</strong>
              <p className="text-xs text-[#6B7980]">Changes apply immediately after the affected user refreshes or signs in again.</p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1080px] w-full text-left">
            <thead className="bg-white">
              <tr className="border-b border-[#E7ECEB]">
                <th className="px-5 py-3 text-xs font-semibold text-[#6B7980]">Module</th>
                {effectiveRoles.map((role) => <th key={role} className="px-4 py-3 text-center text-xs font-semibold text-[#6B7980]">{evidaraRoleLabel(role)}</th>)}
              </tr>
            </thead>
            <tbody>
              {moduleDefinitions.map(([moduleKey, label, description]) => (
                <tr key={moduleKey} className="border-b border-[#E7ECEB] last:border-0">
                  <td className="px-5 py-4">
                    <strong className="text-sm text-[#14232B]">{label}</strong>
                    <p className="mt-0.5 text-xs text-[#6B7980]">{description}</p>
                  </td>
                  {effectiveRoles.map((role) => {
                    const locked = role === 'student' && moduleKey === 'questions';
                    const key = `${role}:${moduleKey}`;
                    return (
                      <td key={role} className="px-4 py-4 text-center">
                        <div className="inline-flex items-center gap-2">
                          {savingKey === key && <LoaderCircle className="h-4 w-4 animate-spin text-[#0E5A5A]" />}
                          <Switch
                            checked={enabled(role, moduleKey)}
                            disabled={locked || savingKey === key}
                            onCheckedChange={(value) => void setModule(role, moduleKey, value)}
                            aria-label={`${label} for ${evidaraRoleLabel(role)}`}
                          />
                        </div>
                        {locked && <p className="mt-1 text-[10px] text-[#B54747]">Never available</p>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="gap-0 overflow-hidden border-[#E7ECEB] shadow-none">
        <div className="flex flex-col gap-3 border-b border-[#E7ECEB] bg-[#F7F9F7] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-[#0E5A5A]" />
            <div>
              <strong className="text-sm text-[#14232B]">{snapshot?.actor.superAdmin ? 'Account roles and passwords' : 'Accounts in this scope'}</strong>
              <p className="text-xs text-[#6B7980]">{snapshot?.actor.superAdmin ? 'Promote or demote accounts, assign a school and set a temporary password.' : 'Role and password changes are restricted to Super Admin.'}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7980]" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, phone or school" className="w-full border-[#E7ECEB] pl-9 sm:w-[300px]" />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}><SelectTrigger className="w-full border-[#E7ECEB] sm:w-[170px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All roles</SelectItem>{roleOptions.map((role) => <SelectItem key={role} value={role}>{evidaraRoleLabel(role)}</SelectItem>)}</SelectContent></Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table className="min-w-[1120px]">
            <TableHeader>
              <TableRow className="border-[#E7ECEB] bg-white hover:bg-white">
                <TableHead className="text-xs font-semibold text-[#6B7980]">Account</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980]">Current access</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980]">School</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980]">Role</TableHead>
                <TableHead className="text-right text-xs font-semibold text-[#6B7980]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAccounts.map((account) => {
                const draftRole = roleDrafts[account.id] || account.role;
                const schoolRequired = draftRole === 'school_admin' || draftRole === 'school_teacher';
                return (
                  <TableRow key={account.id} className="border-[#E7ECEB]">
                    <TableCell>
                      <strong className="text-sm text-[#14232B]">{account.full_name || 'Unnamed account'}</strong>
                      <p className="text-xs text-[#6B7980]">{account.email || account.phone || account.id}</p>
                    </TableCell>
                    <TableCell><Badge className="bg-[#DCE9E7] text-[#0E5A5A]">{evidaraRoleLabel(account.role)}</Badge></TableCell>
                    <TableCell>
                      {snapshot?.actor.superAdmin ? (
                        <Select value={schoolDrafts[account.id] || 'none'} onValueChange={(value) => setSchoolDrafts((current) => ({ ...current, [account.id]: value === 'none' ? '' : value }))}>
                          <SelectTrigger disabled={!schoolRequired} className="w-[220px] border-[#E7ECEB]"><SelectValue placeholder={schoolRequired ? 'Choose school' : 'Not required'} /></SelectTrigger>
                          <SelectContent><SelectItem value="none">No school</SelectItem>{snapshot.organizations.map((organization) => <SelectItem key={organization.id} value={organization.id}>{organization.name}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : <span className="text-sm text-[#6B7980]">{account.memberships.map((membership) => membership.organizationName).join(', ') || 'No staff school'}</span>}
                    </TableCell>
                    <TableCell>
                      {snapshot?.actor.superAdmin ? (
                        <Select value={draftRole} onValueChange={(value) => setRoleDrafts((current) => ({ ...current, [account.id]: value as EvidaraRole }))}>
                          <SelectTrigger className="w-[180px] border-[#E7ECEB]"><SelectValue /></SelectTrigger>
                          <SelectContent>{roleOptions.map((role) => <SelectItem key={role} value={role}>{evidaraRoleLabel(role)}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : <span className="text-sm text-[#6B7980]">{evidaraRoleLabel(account.role)}</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      {snapshot?.actor.superAdmin ? (
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" disabled={savingKey === `role:${account.id}` || (schoolRequired && !schoolDrafts[account.id])} onClick={() => void saveRole(account)} className="border-[#E7ECEB]">
                            {savingKey === `role:${account.id}` && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}Save role
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setPasswordAccount(account); setTemporaryPassword(''); }} className="text-[#8A5F00] hover:bg-[#F2B84B]/10">
                            <KeyRound className="mr-2 h-4 w-4" />Reset password
                          </Button>
                        </div>
                      ) : <span className="text-xs text-[#6B7980]">Read only</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!filteredAccounts.length && <TableRow><TableCell colSpan={5} className="py-12 text-center text-sm text-[#6B7980]">No accounts match the current filters.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={Boolean(passwordAccount)} onOpenChange={(open) => !open && setPasswordAccount(null)}>
        <DialogContent className="border-[#E7ECEB] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Set Temporary Password</DialogTitle>
            <DialogDescription>
              Set a new temporary password for {passwordAccount?.full_name || passwordAccount?.email}. Evidara cannot display the old password.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-3">
            <Input type="password" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} placeholder="At least 8 characters" className="border-[#E7ECEB]" />
            <p className="text-xs text-[#6B7980]">Share it securely and ask the account owner to change it after signing in.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordAccount(null)} className="border-[#E7ECEB]">Cancel</Button>
            <Button onClick={() => void resetPassword()} disabled={temporaryPassword.length < 8 || Boolean(passwordAccount && savingKey === `password:${passwordAccount.id}`)} className="bg-[#0E5A5A] text-white">
              {passwordAccount && savingKey === `password:${passwordAccount.id}` ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              Set Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="text-xs text-[#6B7980]">Signed in as {currentUser?.name || 'account'} · {evidaraRoleLabel(currentUser?.accessRole)}</p>
    </div>
  );
}
