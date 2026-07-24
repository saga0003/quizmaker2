'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  Image as ImageIcon,
  LoaderCircle,
  Package,
  RefreshCw,
  Search,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQuestionScope } from '@/components/questions/useQuestionScope';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import styles from '@/components/commerce/commerce-prototype.module.css';

type ProductRelation = { name: string; cover_image_url: string | null } | { name: string; cover_image_url: string | null }[] | null;
type Entitlement = {
  id: string;
  product_id: string;
  status: string;
  source: string;
  starts_at: string;
  expires_at: string | null;
  attempts_limit: number | null;
  attempts_used: number;
  seat_limit: number | null;
  products: ProductRelation;
};
type SeatAssignment = {
  id: string;
  entitlement_id: string;
  student_id: string;
  status: 'active' | 'released';
  assigned_at: string;
  released_at: string | null;
};
type Student = { id: string; name: string; email: string; status: string };

type SchoolProductAccessProps = { mode: 'entitlements' | 'seats' };

function productRelation(value: ProductRelation) {
  if (Array.isArray(value)) return value[0] || null;
  return value;
}

function daysRemaining(value: string | null) {
  if (!value) return null;
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000));
}

export function SchoolProductAccess({ mode }: SchoolProductAccessProps) {
  const { organizationId, organizationName, loading: scopeLoading, error: scopeError } = useQuestionScope('school');
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [assignments, setAssignments] = useState<SeatAssignment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedEntitlementId, setSelectedEntitlementId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!supabase || !organizationId) {
      if (!scopeLoading) setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const [entitlementResult, assignmentResult, membershipResult] = await Promise.all([
      supabase.from('entitlements').select('id,product_id,status,source,starts_at,expires_at,attempts_limit,attempts_used,seat_limit,products(name,cover_image_url)').eq('organization_id', organizationId).order('created_at', { ascending: false }),
      supabase.from('product_seat_assignments').select('id,entitlement_id,student_id,status,assigned_at,released_at').eq('organization_id', organizationId).order('assigned_at', { ascending: false }),
      supabase.from('student_school_memberships').select('student_id,status').eq('organization_id', organizationId).eq('status', 'active'),
    ]);

    if (entitlementResult.error || assignmentResult.error || membershipResult.error) {
      const detail = entitlementResult.error?.message || assignmentResult.error?.message || membershipResult.error?.message || 'Unable to load school product access.';
      setError(/product_seat_assignments|seat_limit|assign_product_seat_v9/i.test(detail)
        ? 'Apply Supabase migration 34 to enable school product seats.'
        : detail);
      setLoading(false);
      return;
    }

    const nextEntitlements = (entitlementResult.data || []) as unknown as Entitlement[];
    const nextAssignments = (assignmentResult.data || []) as SeatAssignment[];
    const memberships = (membershipResult.data || []) as Array<{ student_id: string; status: string }>;
    const studentIds = [...new Set(memberships.map((membership) => membership.student_id).filter(Boolean))];
    let nextStudents: Student[] = [];
    if (studentIds.length) {
      const { data: profiles, error: profileError } = await supabase.from('profiles').select('id,full_name,email').in('id', studentIds);
      if (profileError) setError(profileError.message);
      nextStudents = (profiles || []).map((profile) => ({
        id: profile.id,
        name: profile.full_name || profile.email || 'Student',
        email: profile.email || '',
        status: 'active',
      }));
    }

    setEntitlements(nextEntitlements);
    setAssignments(nextAssignments);
    setStudents(nextStudents);
    const seatEntitlements = nextEntitlements.filter((item) => item.seat_limit && item.seat_limit > 0);
    setSelectedEntitlementId((current) => current && seatEntitlements.some((item) => item.id === current) ? current : seatEntitlements[0]?.id || '');
    setLoading(false);
  }, [organizationId, scopeLoading]);

  useEffect(() => { void load(); }, [load]);

  const seatEntitlements = useMemo(() => entitlements.filter((item) => item.seat_limit && item.seat_limit > 0), [entitlements]);
  const selectedEntitlement = useMemo(() => seatEntitlements.find((item) => item.id === selectedEntitlementId) || null, [seatEntitlements, selectedEntitlementId]);
  const selectedAssignments = useMemo(() => assignments.filter((item) => item.entitlement_id === selectedEntitlementId), [assignments, selectedEntitlementId]);
  const activeAssignments = useMemo(() => selectedAssignments.filter((item) => item.status === 'active'), [selectedAssignments]);
  const assignedStudentIds = useMemo(() => new Set(activeAssignments.map((item) => item.student_id)), [activeAssignments]);
  const availableStudents = useMemo(() => students.filter((student) => !assignedStudentIds.has(student.id) && (!search || `${student.name} ${student.email}`.toLowerCase().includes(search.toLowerCase()))), [assignedStudentIds, search, students]);
  const studentById = useMemo(() => Object.fromEntries(students.map((student) => [student.id, student])), [students]);
  const seatLimit = selectedEntitlement?.seat_limit || 0;
  const seatsRemaining = Math.max(0, seatLimit - activeAssignments.length);

  async function assignSeat(studentId: string) {
    if (!supabase || !selectedEntitlementId) return;
    setWorkingId(studentId);
    setError('');
    setMessage('');
    const { error: assignError } = await supabase.rpc('assign_product_seat_v9', {
      p_entitlement_id: selectedEntitlementId,
      p_student_id: studentId,
    });
    setWorkingId('');
    if (assignError) return setError(assignError.message);
    setMessage('Student seat assigned. Product-paper access is now active for this student.');
    await load();
  }

  async function releaseSeat(assignmentId: string) {
    if (!supabase) return;
    setWorkingId(assignmentId);
    setError('');
    setMessage('');
    const { error: releaseError } = await supabase.rpc('release_product_seat_v9', { p_assignment_id: assignmentId });
    setWorkingId('');
    if (releaseError) return setError(releaseError.message);
    setMessage('Student seat released and returned to the available school capacity.');
    await load();
  }

  if (scopeLoading || loading) return <div className="py-16 text-center text-sm text-[#6B7980]"><LoaderCircle className="mx-auto mb-3 h-5 w-5 animate-spin" />Loading school products and seats…</div>;

  const visibleError = scopeError || error;

  if (mode === 'entitlements') {
    return (
      <div className={`${styles.workspace} space-y-6`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-extrabold tracking-tight text-[#14232B]">School Entitlements</h1><p className="mt-1 text-sm text-[#6B7980]">Active products and purchased access for {organizationName}.</p></div><Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></div>
        {visibleError && <div className="rounded-xl border border-[#B54747]/20 bg-[#B54747]/5 px-4 py-3 text-sm text-[#B54747]">{visibleError}</div>}
        {message && <div className="rounded-xl border border-[#237A57]/20 bg-[#237A57]/5 px-4 py-3 text-sm text-[#237A57]">{message}</div>}
        {!organizationId ? <div className={styles.emptyState}><Package className="mx-auto mb-3 h-10 w-10 text-[#AEB8BC]" />This account is not connected to an active school organisation.</div> : entitlements.length ? <div className="space-y-4">{entitlements.map((entitlement) => { const product = productRelation(entitlement.products); const days = daysRemaining(entitlement.expires_at); const active = entitlement.status === 'active' && (days === null || days > 0); const assigned = assignments.filter((item) => item.entitlement_id === entitlement.id && item.status === 'active').length; return <Card key={entitlement.id} className="gap-0 border-[#E7ECEB] shadow-none"><CardContent className="p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex gap-4"><div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-[#E7ECEB] bg-[#F7F9F7]">{product?.cover_image_url ? <img src={product.cover_image_url} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><ImageIcon className="h-6 w-6 text-[#AEB8BC]" /></div>}</div><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-[#14232B]">{product?.name || 'Evidara product'}</h3><Badge variant="outline" className={active ? 'border-[#237A57]/20 bg-[#237A57]/10 text-[#237A57]' : 'border-[#E7ECEB] text-[#6B7980]'}>{active ? 'Active' : entitlement.status}</Badge></div><p className="mt-1 text-xs capitalize text-[#6B7980]">Source: {entitlement.source.replaceAll('_', ' ')}</p><p className="mt-1 text-xs text-[#6B7980]">Access: {new Date(entitlement.starts_at).toLocaleDateString('en-IN')} — {entitlement.expires_at ? new Date(entitlement.expires_at).toLocaleDateString('en-IN') : 'No expiry'}</p></div></div><div className="text-right"><div className={`flex items-center justify-end gap-1.5 text-xs font-medium ${days !== null && days <= 30 && days > 0 ? 'text-[#9A6508]' : days === 0 ? 'text-[#B54747]' : 'text-[#6B7980]'}`}><Clock3 className="h-4 w-4" />{days === null ? 'No expiry' : days > 0 ? `${days} days remaining` : 'Expired'}</div>{entitlement.seat_limit ? <p className="mt-2 text-sm font-semibold text-[#14232B]">{assigned} of {entitlement.seat_limit} seats assigned</p> : <p className="mt-2 text-sm font-semibold text-[#14232B]">Organisation-wide access</p>}</div></div>{entitlement.seat_limit ? <div className="mt-5"><div className="mb-2 flex justify-between text-xs"><span className="text-[#6B7980]">Seat utilisation</span><strong className="text-[#14232B]">{Math.max(0, entitlement.seat_limit - assigned)} remaining</strong></div><Progress value={Math.min(100, (assigned / entitlement.seat_limit) * 100)} className="h-2" /></div> : null}</CardContent></Card>; })}</div> : <div className={styles.emptyState}><Package className="mx-auto mb-3 h-10 w-10 text-[#AEB8BC]" /><h3 className="font-semibold text-[#44545C]">No school entitlements</h3><p className="mt-1 text-sm">Purchase a school product from the store to activate access.</p></div>}
      </div>
    );
  }

  return (
    <div className={`${styles.workspace} space-y-6`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-extrabold tracking-tight text-[#14232B]">Seat Management</h1><p className="mt-1 text-sm text-[#6B7980]">Assign and release student seats for purchased school products.</p></div><Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></div>
      {visibleError && <div className="rounded-xl border border-[#B54747]/20 bg-[#B54747]/5 px-4 py-3 text-sm text-[#B54747]">{visibleError}</div>}
      {message && <div className="rounded-xl border border-[#237A57]/20 bg-[#237A57]/5 px-4 py-3 text-sm text-[#237A57]">{message}</div>}

      {!seatEntitlements.length ? <div className={styles.emptyState}><Users className="mx-auto mb-3 h-10 w-10 text-[#AEB8BC]" /><h3 className="font-semibold text-[#44545C]">No seat-based entitlements</h3><p className="mt-1 text-sm">No active school product with purchased student seats is available.</p></div> : <>
        <Card className="gap-0 border-[#E7ECEB] shadow-none"><CardContent className="p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div className="w-full max-w-md space-y-2"><label className="text-sm font-medium text-[#14232B]">School product</label><Select value={selectedEntitlementId} onValueChange={setSelectedEntitlementId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{seatEntitlements.map((entitlement) => <SelectItem key={entitlement.id} value={entitlement.id}>{productRelation(entitlement.products)?.name || 'Evidara product'} · {entitlement.seat_limit} seats</SelectItem>)}</SelectContent></Select></div><div className="grid grid-cols-3 gap-5 text-center"><div><p className="text-2xl font-extrabold text-[#14232B]">{seatLimit}</p><p className="text-xs text-[#6B7980]">Purchased</p></div><div><p className="text-2xl font-extrabold text-[#0E5A5A]">{activeAssignments.length}</p><p className="text-xs text-[#6B7980]">Assigned</p></div><div><p className="text-2xl font-extrabold text-[#237A57]">{seatsRemaining}</p><p className="text-xs text-[#6B7980]">Remaining</p></div></div></div><Progress value={seatLimit ? Math.min(100, (activeAssignments.length / seatLimit) * 100) : 0} className="mt-5 h-2" /></CardContent></Card>

        <div className="grid gap-5 xl:grid-cols-2">
          <Card className="gap-0 border-[#E7ECEB] shadow-none"><CardContent className="p-0"><div className="border-b border-[#E7ECEB] p-5"><h2 className="font-semibold text-[#14232B]">Assigned students</h2><p className="mt-1 text-xs text-[#6B7980]">Students currently consuming a purchased seat.</p></div><div className="divide-y divide-[#E7ECEB]">{activeAssignments.map((assignment) => { const student = studentById[assignment.student_id]; return <div key={assignment.id} className="flex items-center justify-between gap-3 p-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#DCE9E7] text-xs font-bold text-[#0E5A5A]">{(student?.name || 'S').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</div><div><p className="text-sm font-medium text-[#14232B]">{student?.name || 'Student'}</p><p className="mt-1 text-xs text-[#6B7980]">Assigned {new Date(assignment.assigned_at).toLocaleDateString('en-IN')}</p></div></div><Button variant="outline" size="sm" disabled={workingId === assignment.id} onClick={() => void releaseSeat(assignment.id)} className="border-[#B54747]/25 text-[#B54747]">{workingId === assignment.id ? <LoaderCircle className="mr-1 h-4 w-4 animate-spin" /> : <UserMinus className="mr-1 h-4 w-4" />}Release</Button></div>; })}{!activeAssignments.length && <div className={styles.emptyState}><CheckCircle2 className="mx-auto mb-3 h-9 w-9 text-[#AEB8BC]" />No seats are currently assigned.</div>}</div></CardContent></Card>

          <Card className="gap-0 border-[#E7ECEB] shadow-none"><CardContent className="p-0"><div className="border-b border-[#E7ECEB] p-5"><h2 className="font-semibold text-[#14232B]">Eligible students</h2><p className="mt-1 text-xs text-[#6B7980]">Only active students in {organizationName} may receive a seat.</p><div className="relative mt-4"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#AEB8BC]" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search students" className="pl-9" /></div></div><div className={`${styles.scrollArea} max-h-[470px] divide-y divide-[#E7ECEB] overflow-y-auto`}>{availableStudents.map((student) => <div key={student.id} className="flex items-center justify-between gap-3 p-4"><div><p className="text-sm font-medium text-[#14232B]">{student.name}</p><p className="mt-1 text-xs text-[#6B7980]">{student.email || 'Active school student'}</p></div><Button size="sm" disabled={!seatsRemaining || workingId === student.id} onClick={() => void assignSeat(student.id)} className="bg-[#0E5A5A] hover:bg-[#0A4A4A]">{workingId === student.id ? <LoaderCircle className="mr-1 h-4 w-4 animate-spin" /> : <UserPlus className="mr-1 h-4 w-4" />}Assign</Button></div>)}{!availableStudents.length && <div className={styles.emptyState}><Users className="mx-auto mb-3 h-9 w-9 text-[#AEB8BC]" />{search ? 'No eligible students match the search.' : 'Every eligible student is already assigned.'}</div>}</div></CardContent></Card>
        </div>
      </>}
    </div>
  );
}
