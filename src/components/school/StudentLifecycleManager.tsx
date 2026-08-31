"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  GraduationCap,
  KeyRound,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserMinus,
  UserRoundX,
  Users,
} from "lucide-react";
import { BulkAccountImport } from "@/components/evidara/bulk-account-import";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SchoolStudent, StudentLifecycleStatus, StudentTrack } from "@/lib/schoolPlatform";
import { useSchoolPlatform } from "./useSchoolPlatform";

const tracks: StudentTrack[] = ["Foundation", "Boards", "Olympiad", "NEET", "JEE", "KCET"];
type DisplayStatus = StudentLifecycleStatus | "invited" | "pending";

type StudentDetail = {
  membershipId: string;
  studentId: string;
  fullName: string;
  email: string;
  phone: string;
  rollNumber: string;
  academicYear: string;
  grade: number;
  section: string;
  board: string;
  tracks: StudentTrack[];
  status: StudentLifecycleStatus;
  promotionLocked: boolean;
  parentName: string;
  parentPhone: string;
  notes: string;
};

function canonicalStatus(value: unknown): StudentLifecycleStatus {
  if (value === "active" || value === "withdrawn" || value === "completed" || value === "suspended") return value;
  if (value === "revoked") return "withdrawn";
  return "withdrawn";
}

function displayStatus(student: SchoolStudent): DisplayStatus {
  if (student.status === "active" && student.invitationStatus && student.invitationStatus !== "active") return student.invitationStatus;
  return canonicalStatus(student.status);
}

function statusClass(status: DisplayStatus) {
  if (status === "active") return "border-[#B8DDD4] bg-[#EAF6F4] text-[#0E5A5A]";
  if (status === "invited" || status === "pending") return "border-[#F3D18A] bg-[#FFF8E8] text-[#8A5F00]";
  if (status === "suspended") return "border-[#F0D29A] bg-[#FFF8E8] text-[#8A5F00]";
  if (status === "withdrawn") return "border-[#E7C4C4] bg-[#FFF0F0] text-[#B54747]";
  return "border-[#D9E1E4] bg-[#F4F7F7] text-[#52636A]";
}

function statusLabel(status: DisplayStatus) {
  if (status === "active") return "Active";
  if (status === "withdrawn") return "Withdrawn";
  if (status === "completed") return "Completed";
  if (status === "suspended") return "Suspended";
  if (status === "invited") return "Invited";
  return "Pending";
}

function nextAcademicYear(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return "";
  const nextStart = Number(match[1]) + 1;
  return `${nextStart}-${String((nextStart + 1) % 100).padStart(2, "0")}`;
}

export function StudentLifecycleManager() {
  const { state, ready, manager, schoolStaff, rosterScope, syncing, error, errorStatus, execute, command, refresh } = useSchoolPlatform({
    allowDemo: false,
    unavailableMessage: "Supabase is not configured. The live institution student roster is unavailable.",
  });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | DisplayStatus>("all");
  const [targetYear, setTargetYear] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const currentYear = useMemo(() => {
    const years = state.students.filter((student) => canonicalStatus(student.status) === "active").map((student) => student.academicYear).sort().reverse();
    return years[0] ?? state.sections.map((section) => section.academicYear).sort().reverse()[0] ?? "";
  }, [state.sections, state.students]);

  const promotionYear = targetYear || nextAcademicYear(currentYear);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.students.filter((student) => {
      const status = displayStatus(student);
      const searchable = [student.name, student.grade, student.section, student.academicYear, ...student.tracks].join(" ").toLowerCase();
      return (!q || searchable.includes(q)) && (statusFilter === "all" || status === statusFilter);
    });
  }, [query, state.students, statusFilter]);

  async function runAction(key: string, success: string, work: () => Promise<unknown>) {
    setPendingAction(key);
    setActionError(null);
    setActionMessage(null);
    try {
      await work();
      setActionMessage(success);
      return true;
    } catch (failure) {
      setActionError(failure instanceof Error ? failure.message : "The student action could not be completed.");
      return false;
    } finally {
      setPendingAction(null);
    }
  }

  async function addStudent(form: FormData) {
    const fullName = String(form.get("name") ?? "").trim();
    const ok = await runAction("invite", `${fullName} was added to the roster.`, () => execute("inviteStudent", {
      email: String(form.get("email") ?? "").trim(),
      fullName,
      grade: Number(form.get("grade") ?? 8),
      section: String(form.get("section") ?? "").trim(),
      board: state.school.board,
      academicYear: String(form.get("academicYear") ?? currentYear).trim(),
      tracks: form.getAll("tracks").map(String),
      parentName: String(form.get("parentName") ?? "").trim(),
      parentPhone: String(form.get("parentPhone") ?? "").trim(),
    }));
    if (ok) setShowAdd(false);
  }

  async function openStudent(student: SchoolStudent) {
    if (!manager) return;
    setEditOpen(true);
    setEditLoading(true);
    setActionError(null);
    try {
      const response = await command("studentDetails", { membershipId: student.id });
      const raw = response.studentDetail as Omit<StudentDetail, "status"> & { status: unknown };
      setDetail({ ...raw, status: canonicalStatus(raw.status) });
    } catch (failure) {
      setActionError(failure instanceof Error ? failure.message : "Unable to load this student profile.");
      setEditOpen(false);
    } finally {
      setEditLoading(false);
    }
  }

  async function saveStudent() {
    if (!detail) return;
    const ok = await runAction(`save-${detail.membershipId}`, `${detail.fullName}'s profile was updated.`, () => execute("updateStudent", {
      membershipId: detail.membershipId,
      fullName: detail.fullName,
      email: detail.email,
      phone: detail.phone,
      rollNumber: detail.rollNumber,
      academicYear: detail.academicYear,
      grade: detail.grade,
      section: detail.section,
      tracks: detail.tracks,
      parentName: detail.parentName,
      parentPhone: detail.parentPhone,
      notes: detail.notes,
    }));
    if (ok) setEditOpen(false);
  }

  async function promote(student: SchoolStudent) {
    if (!promotionYear) return;
    await runAction(`promote-${student.id}`, `${student.name} was promoted to ${promotionYear}.`, () => execute("promote", {
      membershipId: student.id,
      targetAcademicYear: promotionYear,
    }));
  }

  async function changeLifecycle(target: StudentLifecycleStatus, reason: string) {
    if (!detail) return;
    const label = statusLabel(target);
    const marker = `__evidara_lifecycle__:${target}|${reason}`;
    const ok = await runAction(`lifecycle-${target}-${detail.membershipId}`, `${detail.fullName} is now ${label.toLowerCase()}.`, () => execute("revoke", {
      membershipId: detail.membershipId,
      reason: marker,
    }));
    if (ok) {
      setDetail({ ...detail, status: target, promotionLocked: target !== "active" });
      await refresh();
    }
  }

  async function setPassword() {
    if (!detail || newPassword.length < 12) {
      setActionError("Use a password with at least 12 characters.");
      return;
    }
    const ok = await runAction(`password-${detail.membershipId}`, "Student password updated.", () => execute("setStudentPassword", {
      membershipId: detail.membershipId,
      password: newPassword,
    }));
    if (ok) setNewPassword("");
  }

  if (!ready) {
    return <Card><CardContent className="flex min-h-64 items-center justify-center gap-2"><LoaderCircle className="h-5 w-5 animate-spin" />Loading authorized student roster…</CardContent></Card>;
  }

  if ((error || !schoolStaff) && state.students.length === 0) {
    const denied = errorStatus === 401 || errorStatus === 403 || (!error && !schoolStaff);
    return <Card><CardContent className="flex min-h-72 flex-col items-center justify-center gap-4 p-6 text-center">{denied ? <ShieldCheck /> : <AlertCircle />}<div><h2 className="font-bold">{denied ? "Student roster access is not permitted" : "Student roster unavailable"}</h2><p className="mt-2 text-sm text-muted-foreground">{error ?? "An active institution staff membership is required."}</p></div><Button variant="outline" onClick={() => void refresh()}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button></CardContent></Card>;
  }

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div><h1 className="text-2xl font-bold">Students</h1><p className="mt-1 text-sm text-muted-foreground">Manage academic profiles and the explicit Active / Withdrawn / Completed / Suspended lifecycle.</p><div className="mt-2 flex gap-2"><Badge variant="outline">Live roster</Badge><Badge variant="outline">{rosterScope === "assigned_sections" ? "Assigned sections" : "Institution scope"}</Badge></div></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={syncing} onClick={() => void refresh()}><RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />Refresh</Button>{manager && <BulkAccountImport organizationId={state.school.id || null} onCompleted={() => void refresh()} />}{manager && <Button onClick={() => setShowAdd(true)}><Plus className="mr-2 h-4 w-4" />Add student</Button>}</div>
    </div>

    {(actionError || actionMessage) && <div className={`rounded-lg border p-3 text-sm ${actionError ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{actionError || actionMessage}</div>}

    <Card><CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_190px_180px]">
      <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search student, grade, section, year or track" /></div>
      <select className="h-10 rounded-md border bg-background px-3 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | DisplayStatus)}><option value="all">All statuses</option><option value="active">Active</option><option value="withdrawn">Withdrawn</option><option value="completed">Completed</option><option value="suspended">Suspended</option><option value="invited">Invited</option><option value="pending">Pending</option></select>
      {manager ? <Input value={promotionYear} onChange={(event) => setTargetYear(event.target.value)} placeholder="Promotion year" /> : <div />}
    </CardContent></Card>

    <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-muted/40 text-left"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Grade / section</th><th className="px-4 py-3">Academic year</th><th className="px-4 py-3">Tracks</th><th className="px-4 py-3">Lifecycle</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody>{filtered.map((student) => { const status = displayStatus(student); return <tr key={student.id} className="border-t"><td className="px-4 py-4 font-semibold">{student.name}</td><td className="px-4 py-4">Grade {student.grade}{student.section ? ` · ${student.section}` : ""}</td><td className="px-4 py-4">{student.academicYear}</td><td className="px-4 py-4">{student.tracks.join(", ") || "—"}</td><td className="px-4 py-4"><Badge variant="outline" className={statusClass(status)}>{statusLabel(status)}</Badge></td><td className="px-4 py-4"><div className="flex justify-end gap-2">{manager && <Button variant="outline" size="sm" onClick={() => void openStudent(student)}><Pencil className="mr-1 h-4 w-4" />Manage</Button>}{manager && canonicalStatus(student.status) === "active" && <Button variant="outline" size="sm" disabled={!promotionYear || syncing} onClick={() => void promote(student)}><GraduationCap className="mr-1 h-4 w-4" />Promote</Button>}</div></td></tr>; })}{filtered.length === 0 && <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground"><Users className="mx-auto mb-2 h-6 w-6" />No student records match this view.</td></tr>}</tbody></table></div></Card>

    <Dialog open={showAdd} onOpenChange={setShowAdd}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>Add student</DialogTitle><DialogDescription>Create or link the student's Evidara account and institution membership.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void addStudent(new FormData(event.currentTarget)); }}><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Full name<Input name="name" required minLength={2} className="mt-1" /></label><label className="text-sm">Student email<Input name="email" type="email" required className="mt-1" /></label><label className="text-sm">Academic year<Input name="academicYear" required defaultValue={currentYear} className="mt-1" /></label><label className="text-sm">Grade<select name="grade" defaultValue="8" className="mt-1 h-10 w-full rounded-md border bg-background px-3">{Array.from({ length: 5 }, (_, index) => index + 8).map((grade) => <option key={grade} value={grade}>Grade {grade}</option>)}</select></label><label className="text-sm">Section<Input name="section" className="mt-1" /></label><label className="text-sm">Parent / guardian<Input name="parentName" className="mt-1" /></label><label className="text-sm">Parent phone<Input name="parentPhone" className="mt-1" /></label></div><fieldset><legend className="text-sm">Tracks / exams</legend><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">{tracks.map((track) => <label key={track} className="flex items-center gap-2 rounded-md border p-2 text-sm"><input type="checkbox" name="tracks" value={track} />{track}</label>)}</div></fieldset><DialogFooter><Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button><Button type="submit" disabled={syncing}>{pendingAction === "invite" && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}Add student</Button></DialogFooter></form></DialogContent></Dialog>

    <Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Manage student</DialogTitle><DialogDescription>Profile changes and lifecycle transitions are institution-scoped and audited.</DialogDescription></DialogHeader>{editLoading ? <div className="flex min-h-40 items-center justify-center"><LoaderCircle className="h-5 w-5 animate-spin" /></div> : detail ? <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Full name<Input className="mt-1" value={detail.fullName} onChange={(event) => setDetail({ ...detail, fullName: event.target.value })} /></label><label className="text-sm">Email<Input className="mt-1" value={detail.email} onChange={(event) => setDetail({ ...detail, email: event.target.value })} /></label><label className="text-sm">Phone<Input className="mt-1" value={detail.phone} onChange={(event) => setDetail({ ...detail, phone: event.target.value })} /></label><label className="text-sm">Roll number<Input className="mt-1" value={detail.rollNumber} onChange={(event) => setDetail({ ...detail, rollNumber: event.target.value })} /></label><label className="text-sm">Academic year<Input className="mt-1" value={detail.academicYear} onChange={(event) => setDetail({ ...detail, academicYear: event.target.value })} /></label><label className="text-sm">Grade<select className="mt-1 h-10 w-full rounded-md border bg-background px-3" value={detail.grade} onChange={(event) => setDetail({ ...detail, grade: Number(event.target.value) })}>{Array.from({ length: 5 }, (_, index) => index + 8).map((grade) => <option key={grade} value={grade}>{grade}</option>)}</select></label><label className="text-sm">Section<Input className="mt-1" value={detail.section} onChange={(event) => setDetail({ ...detail, section: event.target.value })} /></label><label className="text-sm">Parent / guardian<Input className="mt-1" value={detail.parentName} onChange={(event) => setDetail({ ...detail, parentName: event.target.value })} /></label><label className="text-sm sm:col-span-2">Notes<Textarea className="mt-1" value={detail.notes} onChange={(event) => setDetail({ ...detail, notes: event.target.value })} /></label></div>
      <div><p className="mb-2 text-sm font-medium">Tracks / exams</p><div className="flex flex-wrap gap-2">{tracks.map((track) => { const selected = detail.tracks.includes(track); return <Button key={track} type="button" size="sm" variant={selected ? "default" : "outline"} onClick={() => setDetail({ ...detail, tracks: selected ? detail.tracks.filter((item) => item !== track) : [...detail.tracks, track] })}>{selected && <Check className="mr-1 h-3 w-3" />}{track}</Button>; })}</div></div>
      <Card><CardContent className="space-y-3 p-4"><div className="flex items-center justify-between"><div><p className="font-semibold">Lifecycle status</p><p className="text-xs text-muted-foreground">Use Suspended for temporary access removal. Withdrawn and Completed are historical terminal states.</p></div><Badge variant="outline" className={statusClass(detail.status)}>{statusLabel(detail.status)}</Badge></div><div className="flex flex-wrap gap-2">{detail.status === "active" && <><Button variant="outline" onClick={() => void changeLifecycle("suspended", "Temporarily suspended by School Admin")}><UserRoundX className="mr-2 h-4 w-4" />Suspend</Button><Button variant="outline" onClick={() => void changeLifecycle("completed", "Course completed by School Admin")}><GraduationCap className="mr-2 h-4 w-4" />Complete</Button><Button variant="outline" className="text-red-700" onClick={() => void changeLifecycle("withdrawn", "Student withdrawn by School Admin")}><UserMinus className="mr-2 h-4 w-4" />Withdraw</Button></>}{detail.status === "suspended" && <><Button variant="outline" onClick={() => void changeLifecycle("active", "Suspension lifted by School Admin")}><UserCheck className="mr-2 h-4 w-4" />Reactivate</Button><Button variant="outline" onClick={() => void changeLifecycle("completed", "Course completed while suspended")}><GraduationCap className="mr-2 h-4 w-4" />Complete</Button><Button variant="outline" className="text-red-700" onClick={() => void changeLifecycle("withdrawn", "Student withdrawn while suspended")}><UserMinus className="mr-2 h-4 w-4" />Withdraw</Button></>}</div></CardContent></Card>
      <Card><CardContent className="space-y-3 p-4"><div><p className="font-semibold">Password control</p><p className="text-xs text-muted-foreground">Set a 12+ character password. Temporary-password enforcement remains server-side.</p></div><div className="flex gap-2"><Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="12+ character password" /><Button variant="outline" disabled={newPassword.length < 12 || syncing} onClick={() => void setPassword()}><KeyRound className="mr-2 h-4 w-4" />Set password</Button></div></CardContent></Card>
      <div className="flex flex-wrap justify-between gap-2"><div className="flex gap-2"><Button onClick={() => void saveStudent()} disabled={syncing}><Check className="mr-2 h-4 w-4" />Save profile</Button>{detail.status === "active" && <Button variant="outline" disabled={!promotionYear || syncing} onClick={() => { const row = state.students.find((student) => student.id === detail.membershipId); if (row) void promote(row); }}><GraduationCap className="mr-2 h-4 w-4" />Promote</Button>}</div><AlertDialog><AlertDialogTrigger asChild><Button variant="outline" className="text-red-700"><Trash2 className="mr-2 h-4 w-4" />Remove unused membership</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove this membership?</AlertDialogTitle><AlertDialogDescription>Removal is only available before the student has assessment attempts. Once assessment evidence exists, Evidara preserves this record permanently; use Withdrawn, Completed or Suspended instead.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => void runAction(`remove-${detail.membershipId}`, "Unused membership removed.", async () => { await execute("removeStudent", { membershipId: detail.membershipId }); setEditOpen(false); })}>Remove only if unused</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>
    </div> : null}</DialogContent></Dialog>
  </div>;
}
