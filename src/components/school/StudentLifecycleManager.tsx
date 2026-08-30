"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  GraduationCap,
  KeyRound,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserMinus,
  Users,
} from "lucide-react";
import { useAppStore } from "@/store/use-app-store";
import { BulkAccountImport } from "@/components/evidara/bulk-account-import";
import type { SchoolStudent, StudentTrack } from "@/lib/schoolPlatform";
import { useSchoolPlatform } from "./useSchoolPlatform";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const tracks: StudentTrack[] = ["Foundation", "Boards", "Olympiad", "NEET", "JEE", "KCET"];
type DisplayStatus = "active" | "invited" | "pending" | "revoked" | "completed";
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
  status: "active" | "revoked" | "completed";
  promotionLocked: boolean;
  parentName: string;
  parentPhone: string;
  notes: string;
};

function displayStatus(student: SchoolStudent): DisplayStatus {
  if (student.status === "active" && student.invitationStatus && student.invitationStatus !== "active") return student.invitationStatus;
  return student.status;
}

function statusClass(status: DisplayStatus) {
  if (status === "active") return "border-[#B8DDD4] bg-[#EAF6F4] text-[#0E5A5A]";
  if (status === "invited" || status === "pending") return "border-[#F3D18A] bg-[#FFF8E8] text-[#8A5F00]";
  if (status === "revoked") return "border-[#E7C4C4] bg-[#FFF0F0] text-[#B54747]";
  return "border-[#D9E1E4] bg-[#F4F7F7] text-[#6B7980]";
}

function nextAcademicYear(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return "";
  const nextStart = Number(match[1]) + 1;
  return `${nextStart}-${String((nextStart + 1) % 100).padStart(2, "0")}`;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "ST";
}

export function StudentLifecycleManager() {
  const {
    state,
    ready,
    manager,
    schoolStaff,
    rosterScope,
    syncing,
    error,
    errorStatus,
    execute,
    command,
    refresh,
  } = useSchoolPlatform({
    allowDemo: false,
    unavailableMessage: "Supabase is not configured. The live institution student roster is unavailable.",
  });
  const setSidebarOpen = useAppStore((store) => store.setSidebarOpen);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | DisplayStatus>("all");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [targetYear, setTargetYear] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [copiedPassword, setCopiedPassword] = useState(false);

  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 640px)");
    const collapse = () => { if (narrow.matches) setSidebarOpen(false); };
    collapse();
    narrow.addEventListener("change", collapse);
    return () => narrow.removeEventListener("change", collapse);
  }, [setSidebarOpen]);

  const currentYear = useMemo(() => {
    const activeYears = state.students.filter((student) => student.status === "active").map((student) => student.academicYear).sort((a, b) => b.localeCompare(a));
    return activeYears[0] ?? state.sections.map((section) => section.academicYear).sort().reverse()[0] ?? "";
  }, [state.sections, state.students]);

  useEffect(() => { if (currentYear) setTargetYear(nextAcademicYear(currentYear)); }, [currentYear]);

  const grades = useMemo(() => [...new Set(state.students.map((student) => student.grade))].sort((a, b) => a - b), [state.students]);
  const sections = useMemo(() => [...new Set(state.students.map((student) => student.section).filter(Boolean))].sort(), [state.students]);
  const academicYears = useMemo(() => [...new Set(state.students.map((student) => student.academicYear))].sort().reverse(), [state.students]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.students.filter((student) => {
      const searchable = [student.name, student.grade, student.section, student.academicYear, ...student.tracks, manager ? student.parentName : ""].join(" ").toLowerCase();
      const status = displayStatus(student);
      return (!q || searchable.includes(q))
        && (statusFilter === "all" || status === statusFilter)
        && (gradeFilter === "all" || String(student.grade) === gradeFilter)
        && (sectionFilter === "all" || student.section === sectionFilter)
        && (yearFilter === "all" || student.academicYear === yearFilter);
    });
  }, [gradeFilter, manager, query, sectionFilter, state.students, statusFilter, yearFilter]);

  const canManage = manager;
  const allVisibleSelected = filtered.length > 0 && filtered.every((student) => selected.has(student.id));

  async function runAction(key: string, successMessage: string, operation: () => Promise<unknown>) {
    setPendingAction(key); setActionError(null); setActionMessage(null);
    try { await operation(); setActionMessage(successMessage); return true; }
    catch (failure) { setActionError(failure instanceof Error ? failure.message : "The student action could not be completed."); return false; }
    finally { setPendingAction(null); }
  }

  async function addStudent(form: FormData) {
    const name = String(form.get("name") ?? "").trim();
    const studentTracks = form.getAll("tracks").map(String) as StudentTrack[];
    const added = await runAction("invite", `${name} was added to the live roster.`, () => execute("inviteStudent", {
      email: String(form.get("email") ?? "").trim(), fullName: name, grade: Number(form.get("grade") ?? 8),
      section: String(form.get("section") ?? "").trim(), board: state.school.board,
      academicYear: String(form.get("academicYear") ?? currentYear).trim(), tracks: studentTracks,
      parentName: String(form.get("parentName") ?? "").trim(), parentPhone: String(form.get("parentPhone") ?? "").trim(),
    }));
    if (added) setShowAdd(false);
  }

  async function openStudent(student: SchoolStudent) {
    if (!canManage) return;
    setEditOpen(true); setEditLoading(true); setDetail(null); setTemporaryPassword(""); setNewPassword(""); setActionError(null);
    try {
      const response = await command("studentDetails", { membershipId: student.id });
      setDetail(response.studentDetail as StudentDetail);
    } catch (failure) {
      setActionError(failure instanceof Error ? failure.message : "Unable to load this student profile.");
      setEditOpen(false);
    } finally { setEditLoading(false); }
  }

  async function saveStudent() {
    if (!detail) return;
    const ok = await runAction(`save-${detail.membershipId}`, `${detail.fullName}'s profile was updated.`, () => execute("updateStudent", {
      membershipId: detail.membershipId, fullName: detail.fullName, email: detail.email, phone: detail.phone,
      rollNumber: detail.rollNumber, academicYear: detail.academicYear, grade: detail.grade, section: detail.section,
      tracks: detail.tracks, parentName: detail.parentName, parentPhone: detail.parentPhone, notes: detail.notes,
    }));
    if (ok) { await refresh(); setEditOpen(false); }
  }

  async function generatePassword() {
    if (!detail) return;
    const ok = await runAction(`reset-password-${detail.membershipId}`, "A temporary password was generated. Share it securely with the student.", async () => {
      const response = await command("resetStudentPassword", { membershipId: detail.membershipId });
      setTemporaryPassword(String(response.temporaryPassword || ""));
    });
    if (!ok) setTemporaryPassword("");
  }

  async function setPassword() {
    if (!detail || newPassword.length < 8) { setActionError("Enter a password with at least 8 characters."); return; }
    const ok = await runAction(`set-password-${detail.membershipId}`, "Student password updated.", () => execute("setStudentPassword", { membershipId: detail.membershipId, password: newPassword }));
    if (ok) setNewPassword("");
  }

  async function promoteSelected() {
    const rows = state.students.filter((student) => selected.has(student.id) && student.status === "active" && !student.promotionLocked);
    if (!rows.length || !targetYear) return;
    await runAction("promote-selected", `${rows.length} selected student${rows.length === 1 ? "" : "s"} promoted to ${targetYear}.`, async () => {
      for (const student of rows) await execute("promote", { membershipId: student.id, targetAcademicYear: targetYear });
      setSelected(new Set());
    });
  }

  async function promoteOne(student: SchoolStudent) {
    await runAction(`promote-${student.id}`, `${student.name} was promoted to ${targetYear}.`, () => execute("promote", { membershipId: student.id, targetAcademicYear: targetYear }));
  }

  async function revokeOne(student: SchoolStudent) {
    await runAction(`revoke-${student.id}`, `${student.name}'s membership was revoked and locked.`, () => execute("revoke", { membershipId: student.id, reason: "Student left the institution" }));
  }

  if (!ready) return <Card className="border-[#DFE6EC]"><CardContent className="flex min-h-64 items-center justify-center gap-3 text-sm text-[#6B7980]"><LoaderCircle className="h-5 w-5 animate-spin text-[#0E5A5A]" />Loading authorized student roster…</CardContent></Card>;

  if ((error || !schoolStaff) && state.students.length === 0) {
    const permissionDenied = errorStatus === 401 || errorStatus === 403 || (!error && !schoolStaff);
    return <Card className="border-[#DFE6EC]"><CardContent className="flex min-h-72 flex-col items-center justify-center gap-4 p-6 text-center"><div className="grid h-12 w-12 place-items-center rounded-full bg-[#FFF3E8] text-[#B65C20]">{permissionDenied ? <ShieldCheck className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}</div><div><h1 className="text-xl font-bold text-[#14232B]">{permissionDenied ? "Student roster access is not permitted" : "Student roster unavailable"}</h1><p className="mt-2 max-w-xl text-sm leading-6 text-[#6B7980]">{error ?? "An active institution staff membership is required."}</p></div><Button variant="outline" onClick={() => void refresh()}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button></CardContent></Card>;
  }

  return <div className="space-y-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div><h1 className="text-2xl font-bold text-[#14232B]">Students</h1><p className="mt-1 text-sm text-[#6B7980]">Manage student profiles, academic details, access and promotions.</p><div className="mt-2 flex gap-2"><Badge variant="outline" className="border-[#B8DDD4] bg-[#EAF6F4] text-[#0E5A5A]">Live roster</Badge><Badge variant="outline" className="border-[#D9E1E4] bg-white text-[#6B7980]">{rosterScope === "assigned_sections" ? "Assigned sections" : "Institution scope"}</Badge></div></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={syncing} onClick={() => void refresh()}><RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />Refresh</Button>{canManage && <BulkAccountImport organizationId={state.school.id || null} onCompleted={() => void refresh()} />}{canManage && <Button className="bg-[#0E5A5A] text-white hover:bg-[#0A4747]" onClick={() => setShowAdd(true)}><Plus className="mr-2 h-4 w-4" />Add student</Button>}</div>
    </div>

    {(actionError || actionMessage) && <div className={`rounded-xl border px-4 py-3 text-sm ${actionError ? "border-[#E8CACA] bg-[#FFF5F5] text-[#9E3C3C]" : "border-[#B8DDD4] bg-[#F0FAF7] text-[#0E5A5A]"}`}>{actionError || actionMessage}</div>}
    {!canManage && rosterScope === "assigned_sections" && <div className="rounded-xl border border-[#D8E7EF] bg-[#F5FAFD] px-4 py-3 text-sm text-[#31566B]"><strong>Assigned-section read-only access.</strong> You can review students in your assigned sections. Profile, password and lifecycle changes remain with School Admin.</div>}

    <Card className="border-[#DFE6EC] shadow-sm"><CardContent className="space-y-3 p-4"><div className="flex flex-col gap-3 lg:flex-row"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7B8A90]" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, grade, section, year or track" className="pl-9" /></div>{canManage && <AlertDialog><AlertDialogTrigger asChild><Button variant="outline" disabled={!selected.size || syncing || !targetYear}><GraduationCap className="mr-2 h-4 w-4" />Promote selected</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Promote {selected.size} selected student{selected.size === 1 ? "" : "s"}?</AlertDialogTitle><AlertDialogDescription>The selected active students will move to {targetYear || "the target academic year"}. Review the target year before continuing.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-[#0E5A5A]" onClick={() => void promoteSelected()}>Promote selected</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}</div><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4"><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | DisplayStatus)} className="h-10 rounded-md border border-[#DFE6EC] bg-white px-3 text-sm"><option value="all">All statuses</option><option value="active">Active</option><option value="invited">Invited</option><option value="pending">Pending</option><option value="revoked">Revoked</option><option value="completed">Completed</option></select><select value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)} className="h-10 rounded-md border border-[#DFE6EC] bg-white px-3 text-sm"><option value="all">All grades</option>{grades.map((grade) => <option key={grade} value={grade}>Grade {grade}</option>)}</select><select value={sectionFilter} onChange={(event) => setSectionFilter(event.target.value)} className="h-10 rounded-md border border-[#DFE6EC] bg-white px-3 text-sm"><option value="all">All sections</option>{sections.map((section) => <option key={section} value={section}>{section}</option>)}</select><select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)} className="h-10 rounded-md border border-[#DFE6EC] bg-white px-3 text-sm"><option value="all">All academic years</option>{academicYears.map((year) => <option key={year} value={year}>{year}</option>)}</select></div></CardContent></Card>

    {canManage && <Card className="border-[#DFE6EC] shadow-sm"><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-[#7B8A90]">Promotion target</p><Input value={targetYear} onChange={(event) => setTargetYear(event.target.value)} className="mt-1 w-44" placeholder="2027-28" /></div><p className="text-xs leading-5 text-[#7B8A90]">Select students in the table and promote only those records, or edit an individual student to change grade, section, tracks and account access.</p></CardContent></Card>}

    <Card className="overflow-hidden border-[#DFE6EC] shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead className="bg-[#F7F9FA] text-left text-[11px] font-semibold uppercase tracking-wide text-[#52636A]"><tr><th className="w-12 px-4 py-3">{canManage && <Checkbox checked={allVisibleSelected} onCheckedChange={(checked) => { const next = new Set(selected); filtered.forEach((student) => checked ? next.add(student.id) : next.delete(student.id)); setSelected(next); }} />}</th><th className="px-4 py-3">Student</th><th className="px-4 py-3">Grade / section</th><th className="px-4 py-3">Academic year</th><th className="px-4 py-3">Tracks / exams</th><th className="px-4 py-3">Invitation</th><th className="px-4 py-3">Membership</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
          <tbody>{filtered.map((student) => { const invite = student.invitationStatus ?? "active"; return <tr key={student.id} className="border-t border-[#EDF1F2] align-middle hover:bg-[#FCFDFD]"><td className="px-4 py-4">{canManage && <Checkbox checked={selected.has(student.id)} onCheckedChange={(checked) => { const next = new Set(selected); checked ? next.add(student.id) : next.delete(student.id); setSelected(next); }} />}</td><td className="px-4 py-4"><div className="flex items-center gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#EAF6F4] text-xs font-bold text-[#0E5A5A]">{initials(student.name)}</div><div><p className="font-semibold text-[#14232B]">{student.name}</p>{canManage && student.parentName && <p className="mt-0.5 text-xs text-[#7B8A90]">Parent: {student.parentName}</p>}</div></div></td><td className="px-4 py-4 text-[#31505A]">Grade {student.grade}{student.section ? ` · ${student.section}` : ""}</td><td className="px-4 py-4 text-[#31505A]">{student.academicYear}</td><td className="px-4 py-4"><div className="flex max-w-xs flex-wrap gap-1.5">{student.tracks.length ? student.tracks.map((track) => <span key={track} className="rounded-full border border-[#D9E3E5] bg-white px-2 py-1 text-[11px] text-[#4D6067]">{track}</span>) : <span className="text-xs text-[#8A989D]">No tracks</span>}</div></td><td className="px-4 py-4"><Badge variant="outline" className={statusClass(invite)}>{invite}</Badge></td><td className="px-4 py-4"><Badge variant="outline" className={statusClass(student.status)}>{student.status}</Badge></td><td className="px-4 py-4"><div className="flex justify-end gap-2">{canManage ? <><Button variant="outline" size="icon" className="h-9 w-9" onClick={() => void openStudent(student)}><Pencil className="h-4 w-4" /><span className="sr-only">Edit {student.name}</span></Button>{student.status === "active" && <Button variant="outline" size="icon" className="h-9 w-9" disabled={!targetYear || syncing} onClick={() => void promoteOne(student)}><GraduationCap className="h-4 w-4" /><span className="sr-only">Promote {student.name}</span></Button>}</> : <span className="text-xs text-[#7B8A90]">Read only</span>}</div></td></tr>; })}{filtered.length === 0 && <tr className="border-t border-[#EDF1F2]"><td colSpan={8} className="px-6 py-12 text-center"><Users className="mx-auto h-7 w-7 text-[#A8B5BA]" /><p className="mt-3 font-semibold text-[#31505A]">No student records match this view</p><p className="mt-1 text-xs text-[#7B8A90]">Change the filters, refresh the roster, or add a student if you are a School Admin.</p></td></tr>}</tbody>
        </table>
      </div>
      <div className="flex flex-col gap-2 border-t border-[#EDF1F2] px-4 py-3 text-xs text-[#7B8A90] sm:flex-row sm:items-center sm:justify-between"><span>{filtered.length} student{filtered.length === 1 ? "" : "s"} shown · {selected.size} selected</span><span>{state.students.length} total roster records</span></div>
    </Card>

    <Dialog open={showAdd} onOpenChange={(open) => !syncing && setShowAdd(open)}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>Add student</DialogTitle><DialogDescription>Create or link the student's Evidara account and institution membership.</DialogDescription></DialogHeader><form onSubmit={(event) => { event.preventDefault(); void addStudent(new FormData(event.currentTarget)); }} className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium text-[#31505A]">Full name<Input name="name" required minLength={2} className="mt-1" /></label><label className="text-sm font-medium text-[#31505A]">Student email<Input name="email" type="email" required className="mt-1" /></label><label className="text-sm font-medium text-[#31505A]">Academic year<Input name="academicYear" required defaultValue={currentYear} placeholder="2027-28" className="mt-1" /></label><label className="text-sm font-medium text-[#31505A]">Grade<select name="grade" defaultValue="8" className="mt-1 h-10 w-full rounded-md border border-[#DFE6EC] bg-white px-3">{Array.from({ length: 5 }, (_, index) => index + 8).map((grade) => <option key={grade} value={grade}>Grade {grade}</option>)}</select></label><label className="text-sm font-medium text-[#31505A]">Section<Input name="section" className="mt-1" /></label><label className="text-sm font-medium text-[#31505A]">Board<Input value={state.school.board} readOnly className="mt-1 bg-[#F7F9FA]" /></label><label className="text-sm font-medium text-[#31505A]">Parent / guardian<Input name="parentName" className="mt-1" /></label><label className="text-sm font-medium text-[#31505A]">Parent phone<Input name="parentPhone" className="mt-1" /></label></div><fieldset><legend className="text-sm font-medium text-[#31505A]">Tracks / exams</legend><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">{tracks.map((track) => <label key={track} className="flex items-center gap-2 rounded-lg border border-[#DFE6EC] px-3 py-2 text-sm"><input type="checkbox" name="tracks" value={track} className="accent-[#0E5A5A]" />{track}</label>)}</div></fieldset><DialogFooter><Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button><Button type="submit" disabled={syncing} className="bg-[#0E5A5A] text-white hover:bg-[#0A4747]">{pendingAction === "invite" ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Add student</Button></DialogFooter></form></DialogContent></Dialog>

    <Sheet open={editOpen} onOpenChange={setEditOpen}><SheetContent className="w-full overflow-y-auto border-[#DFE6EC] sm:max-w-[560px]"><SheetHeader className="border-b border-[#EDF1F2] px-5 py-5"><SheetTitle className="text-lg">Edit Student Profile</SheetTitle><SheetDescription>School Admin can manage the student's institution profile, academics and account access.</SheetDescription></SheetHeader>{editLoading ? <div className="flex flex-1 items-center justify-center gap-2 text-sm text-[#6B7980]"><LoaderCircle className="h-5 w-5 animate-spin" />Loading student details…</div> : detail ? <div className="space-y-6 px-5 pb-8">
      <section><h3 className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-[#52636A]">Personal details</h3><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-[#596A70]">Full name<Input value={detail.fullName} onChange={(event) => setDetail({ ...detail, fullName: event.target.value })} className="mt-1" /></label><label className="text-xs font-semibold text-[#596A70]">Email<Input type="email" value={detail.email} onChange={(event) => setDetail({ ...detail, email: event.target.value })} className="mt-1" /></label><label className="text-xs font-semibold text-[#596A70]">Phone<Input value={detail.phone} onChange={(event) => setDetail({ ...detail, phone: event.target.value })} className="mt-1" /></label><label className="text-xs font-semibold text-[#596A70]">Roll number<Input value={detail.rollNumber} onChange={(event) => setDetail({ ...detail, rollNumber: event.target.value })} className="mt-1" /></label><label className="text-xs font-semibold text-[#596A70]">Parent / guardian<Input value={detail.parentName} onChange={(event) => setDetail({ ...detail, parentName: event.target.value })} className="mt-1" /></label><label className="text-xs font-semibold text-[#596A70]">Parent phone<Input value={detail.parentPhone} onChange={(event) => setDetail({ ...detail, parentPhone: event.target.value })} className="mt-1" /></label></div></section>
      <section><h3 className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-[#52636A]">Academic details</h3><div className="grid gap-3 sm:grid-cols-3"><label className="text-xs font-semibold text-[#596A70]">Grade<select value={detail.grade} onChange={(event) => setDetail({ ...detail, grade: Number(event.target.value) })} className="mt-1 h-10 w-full rounded-md border border-[#DFE6EC] bg-white px-3 text-sm">{Array.from({ length: 5 }, (_, index) => index + 8).map((grade) => <option key={grade} value={grade}>Grade {grade}</option>)}</select></label><label className="text-xs font-semibold text-[#596A70]">Section<Input value={detail.section} onChange={(event) => setDetail({ ...detail, section: event.target.value })} className="mt-1" /></label><label className="text-xs font-semibold text-[#596A70]">Academic year<Input value={detail.academicYear} onChange={(event) => setDetail({ ...detail, academicYear: event.target.value })} className="mt-1" /></label></div><div className="mt-4"><p className="mb-2 text-xs font-semibold text-[#596A70]">Tracks / exams</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{tracks.map((track) => { const checked = detail.tracks.includes(track); return <button type="button" key={track} onClick={() => setDetail({ ...detail, tracks: checked ? detail.tracks.filter((item) => item !== track) : [...detail.tracks, track] })} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${checked ? "border-[#8BC9BC] bg-[#EAF6F4] text-[#0E5A5A]" : "border-[#DFE6EC] bg-white text-[#52636A]"}`}>{checked ? <Check className="h-4 w-4" /> : <span className="h-4 w-4 rounded border border-[#BCC9CD]" />}{track}</button>; })}</div></div></section>
      <section><h3 className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-[#52636A]">Account & access</h3><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-[#DFE6EC] p-3"><p className="text-xs text-[#7B8A90]">Membership status</p><p className="mt-1 font-semibold capitalize text-[#14232B]">{detail.status}</p>{detail.promotionLocked && <p className="mt-1 text-xs text-[#B54747]">Promotion permanently locked</p>}</div><div className="rounded-xl border border-[#DFE6EC] p-3"><p className="text-xs text-[#7B8A90]">Board</p><p className="mt-1 font-semibold text-[#14232B]">{detail.board}</p></div></div><label className="mt-3 block text-xs font-semibold text-[#596A70]">Notes<Textarea rows={3} value={detail.notes} onChange={(event) => setDetail({ ...detail, notes: event.target.value })} className="mt-1" placeholder="Optional internal note" /></label></section>
      <section className="rounded-2xl border border-[#DCE6E9] bg-[#F8FAFA] p-4"><h3 className="text-sm font-bold text-[#14232B]">Password control</h3><p className="mt-1 text-xs leading-5 text-[#6B7980]">Set a known password or generate a temporary password to share securely with the student.</p>{temporaryPassword && <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-[#F1D8A5] bg-[#FFF9EC] p-3"><div><p className="text-xs text-[#7A5A10]">Temporary password</p><code className="font-semibold text-[#14232B]">{temporaryPassword}</code></div><Button variant="outline" size="sm" onClick={async () => { await navigator.clipboard.writeText(temporaryPassword); setCopiedPassword(true); window.setTimeout(() => setCopiedPassword(false), 1500); }}>{copiedPassword ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}{copiedPassword ? "Copied" : "Copy"}</Button></div>}<div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New password (8+ characters)" /><Button variant="outline" onClick={() => void setPassword()} disabled={syncing || newPassword.length < 8}><KeyRound className="mr-2 h-4 w-4" />Set password</Button><Button variant="outline" onClick={() => void generatePassword()} disabled={syncing}><RefreshCw className="mr-2 h-4 w-4" />Generate temporary</Button></div></section>
      <div className="grid gap-2 sm:grid-cols-2"><Button className="bg-[#0E5A5A] text-white hover:bg-[#0A4747]" onClick={() => void saveStudent()} disabled={syncing}><Check className="mr-2 h-4 w-4" />Save changes</Button>{detail.status === "active" && <Button variant="outline" disabled={!targetYear || syncing} onClick={() => { const student = state.students.find((row) => row.id === detail.membershipId); if (student) void promoteOne(student); }}><GraduationCap className="mr-2 h-4 w-4" />Promote student</Button>}{detail.status === "active" && <AlertDialog><AlertDialogTrigger asChild><Button variant="outline" className="border-[#E7C4C4] text-[#B54747]"><UserMinus className="mr-2 h-4 w-4" />Revoke membership</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Revoke this student's membership?</AlertDialogTitle><AlertDialogDescription>Revocation is a permanent institution lifecycle lock and excludes the student from promotion.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-[#B54747]" onClick={() => { const student = state.students.find((row) => row.id === detail.membershipId); if (student) void revokeOne(student); setEditOpen(false); }}>Revoke</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}<AlertDialog><AlertDialogTrigger asChild><Button variant="outline" className="border-[#E7C4C4] text-[#B54747]"><Trash2 className="mr-2 h-4 w-4" />Remove from school</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove {detail.fullName} from this institution?</AlertDialogTitle><AlertDialogDescription>This removes the institution membership only. The student's Evidara account is not deleted globally.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-[#B54747]" onClick={() => void runAction(`remove-${detail.membershipId}`, "Student removed from this institution.", async () => { await execute("removeStudent", { membershipId: detail.membershipId }); setEditOpen(false); })}>Remove</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>
    </div> : null}</SheetContent></Sheet>
  </div>;
}
