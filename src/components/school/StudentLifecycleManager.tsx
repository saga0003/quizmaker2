"use client";

import { useMemo, useState } from "react";
import {
  Ban,
  CheckCircle2,
  Cloud,
  Filter,
  GraduationCap,
  LockKeyhole,
  Plus,
  Search,
  UserMinus,
  Users,
} from "lucide-react";
import {
  promoteAllStudents,
  promoteStudent,
  revokeAllStudents,
  revokeStudent,
  type SchoolBoard,
  type StudentTrack,
} from "@/lib/schoolPlatform";
import { useSchoolPlatform } from "./useSchoolPlatform";

const tracks: StudentTrack[] = ["Foundation", "Boards", "Olympiad", "NEET", "JEE", "KCET"];

export function StudentLifecycleManager() {
  const { state, update, ready, mode, manager, syncing, error, execute } = useSchoolPlatform();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [targetYear, setTargetYear] = useState("2027-28");
  const [showAdd, setShowAdd] = useState(false);

  const filtered = useMemo(
    () => state.students.filter((student) =>
      (status === "all" || student.status === status) &&
      `${student.name} ${student.grade} ${student.section}`.toLowerCase().includes(query.toLowerCase())),
    [state.students, status, query],
  );

  if (!ready) return <div className="so-card so-pad">Loading students…</div>;

  const currentYear = state.students.find((student) => student.status === "active")?.academicYear || "2026-27";
  const canManage = mode === "demo" || manager;

  async function addStudent(form: FormData) {
    const name = String(form.get("name") || "").trim();
    if (!name) return;
    const studentTracks = form.getAll("tracks") as StudentTrack[];

    if (mode === "cloud") {
      await execute("inviteStudent", {
        email: String(form.get("email") || "").trim(),
        fullName: name,
        grade: Number(form.get("grade") || 8),
        section: String(form.get("section") || "A"),
        board: state.school.board,
        academicYear: String(form.get("academicYear") || currentYear),
        tracks: studentTracks,
        parentName: String(form.get("parent") || ""),
        parentPhone: String(form.get("phone") || ""),
      });
    } else {
      const next = {
        id: `st-${Date.now()}`,
        name,
        grade: Number(form.get("grade") || 8),
        section: String(form.get("section") || "A"),
        board: state.school.board as SchoolBoard,
        academicYear: String(form.get("academicYear") || currentYear),
        tracks: studentTracks,
        status: "active" as const,
        promotionLocked: false,
        parentName: String(form.get("parent") || ""),
        parentPhone: String(form.get("phone") || ""),
      };
      update((current) => ({ ...current, students: [...current.students, next] }));
    }
    setShowAdd(false);
  }

  async function changeTracks(id: string, track: StudentTrack) {
    const student = state.students.find((item) => item.id === id);
    if (!student || student.status !== "active") return;
    const nextTracks = student.tracks.includes(track)
      ? student.tracks.filter((item) => item !== track)
      : [...student.tracks, track];
    if (mode === "cloud") {
      await execute("updateTracks", { membershipId: id, tracks: nextTracks });
    } else {
      update((current) => ({
        ...current,
        students: current.students.map((item) => item.id === id ? { ...item, tracks: nextTracks } : item),
      }));
    }
  }

  async function promoteOne(id: string) {
    if (mode === "cloud") {
      await execute("promote", { membershipId: id, targetAcademicYear: targetYear });
    } else {
      update((current) => promoteStudent(current, id, targetYear));
    }
  }

  async function revokeOne(id: string, name: string) {
    if (!confirm(`Revoke ${name}? This permanently excludes the student from later promotion.`)) return;
    if (mode === "cloud") {
      await execute("revoke", { membershipId: id, reason: "Student left the school" });
    } else {
      update((current) => revokeStudent(current, id));
    }
  }

  async function promoteAll() {
    if (!confirm(`Promote all eligible active students to ${targetYear}? Revoked students will remain excluded.`)) return;
    if (mode === "cloud") {
      await execute("promoteAll", { fromAcademicYear: currentYear, targetAcademicYear: targetYear });
    } else {
      update((current) => promoteAllStudents(current, targetYear));
    }
  }

  async function revokeAll() {
    if (!confirm("Revoke every currently active student? This permanently locks them out of future promotion.")) return;
    if (mode === "cloud") {
      await execute("revokeAll", { academicYear: currentYear, reason: "Bulk school-year revocation" });
    } else {
      update((current) => revokeAllStudents(current));
    }
  }

  const active = state.students.filter((student) => student.status === "active").length;
  const revoked = state.students.filter((student) => student.status === "revoked").length;
  const completed = state.students.filter((student) => student.status === "completed").length;

  return <div>
    <div className="so-page-head">
      <div>
        <span className="so-kicker">ACADEMIC-YEAR ROLLOVER</span>
        <h1>Student lifecycle and promotion</h1>
        <p>Promote individuals or the eligible roster. Revoked students stay locked and are never included in Promote All.</p>
      </div>
      <div className="so-action-row">
        <span className={`so-status ${mode === "cloud" ? "success" : "neutral"}`}><Cloud size={14}/> {mode === "cloud" ? "Cloud roster" : "Demo roster"}</span>
        <button className="so-btn so-btn-primary" disabled={syncing || !canManage} onClick={() => setShowAdd((value) => !value)}><Plus size={17}/> Add student</button>
      </div>
    </div>

    {error && <div className="so-notice warning"><Ban/><span><strong>Cloud notice:</strong> {error}</span></div>}
    {mode === "cloud" && !manager && !error && <div className="so-notice info"><LockKeyhole/><span>This account has read-only student access. School roster changes require an authorised school manager.</span></div>}

    <div className="so-grid so-grid-4">
      <div className="so-stat"><Users/><strong>{state.students.length}</strong><span>Total records</span></div>
      <div className="so-stat"><CheckCircle2/><strong>{active}</strong><span>Active</span></div>
      <div className="so-stat"><LockKeyhole/><strong>{revoked}</strong><span>Revoked and locked</span></div>
      <div className="so-stat"><GraduationCap/><strong>{completed}</strong><span>Completed Grade 12</span></div>
    </div>

    <section className="so-card so-pad so-mt rollover-panel">
      <div>
        <span className="so-kicker">TARGET ACADEMIC YEAR</span>
        <select className="so-input" value={targetYear} disabled={!canManage} onChange={(event) => setTargetYear(event.target.value)}>
          <option>2027-28</option><option>2028-29</option><option>2029-30</option>
        </select>
      </div>
      <div className="so-action-row">
        <button className="so-btn so-btn-primary" disabled={syncing || active === 0 || !canManage} onClick={() => void promoteAll()}><GraduationCap size={17}/> Promote all eligible</button>
        <button className="so-btn so-btn-danger" disabled={syncing || active === 0 || !canManage} onClick={() => void revokeAll()}><UserMinus size={17}/> Revoke all active</button>
      </div>
    </section>

    <div className="so-notice warning so-mt"><Ban/> <span><strong>Permanent bulk exclusion:</strong> once a student is revoked, Promote All and individual promotion cannot add that student again. The cloud database enforces the lock.</span></div>

    {showAdd && canManage && <form className="so-card so-pad so-mt" onSubmit={(event) => {
      event.preventDefault();
      void addStudent(new FormData(event.currentTarget)).catch((actionError) => alert(actionError instanceof Error ? actionError.message : "Unable to add student."));
    }}>
      <div className="so-form-grid">
        <label>Name<input className="so-input" name="name" required/></label>
        <label>Student email<input className="so-input" type="email" name="email" required={mode === "cloud"} placeholder={mode === "cloud" ? "student@example.com" : "Optional in demo"}/></label>
        <label>Academic year<input className="so-input" name="academicYear" defaultValue={currentYear} required/></label>
        <label>Grade<select className="so-input" name="grade">{[8, 9, 10, 11, 12].map((grade) => <option key={grade}>{grade}</option>)}</select></label>
        <label>Section<input className="so-input" name="section" defaultValue="A"/></label>
        <label>Parent name<input className="so-input" name="parent"/></label>
        <label>Parent phone<input className="so-input" name="phone"/></label>
        <div><span className="so-field-label">Preparation tracks</span><div className="track-checks">{tracks.map((track) => <label key={track}><input type="checkbox" name="tracks" value={track}/>{track}</label>)}</div></div>
      </div>
      <button className="so-btn so-btn-primary" disabled={syncing} style={{ marginTop: 14 }}>{mode === "cloud" ? "Invite and add student" : "Create student record"}</button>
    </form>}

    <div className="so-toolbar so-mt">
      <div className="so-search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search student, grade or section"/></div>
      <div className="so-filter"><Filter size={16}/><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="revoked">Revoked</option><option value="completed">Completed</option></select></div>
    </div>

    <div className="so-card so-table-wrap"><table className="so-table"><thead><tr><th>Student</th><th>Current year</th><th>Grade</th><th>Eligibility tracks</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filtered.map((student) => <tr key={student.id}>
      <td><strong>{student.name}</strong><small>{student.parentName}{student.parentPhone ? ` · ${student.parentPhone}` : ""}</small></td>
      <td>{student.academicYear}</td>
      <td>Grade {student.grade}-{student.section}</td>
      <td><div className="track-pills">{tracks.map((track) => <button type="button" key={track} disabled={student.status !== "active" || syncing || !canManage} onClick={() => void changeTracks(student.id, track).catch((actionError) => alert(actionError instanceof Error ? actionError.message : "Unable to update tracks."))} className={student.tracks.includes(track) ? "active" : ""}>{track}</button>)}</div></td>
      <td><span className={`so-status ${student.status === "active" ? "success" : student.status === "revoked" ? "danger" : "neutral"}`}>{student.status}</span>{student.promotionLocked && <small><LockKeyhole size={12}/> promotion locked</small>}</td>
      <td><div className="so-action-row">{student.status === "active" && canManage && <>
        <button className="so-btn so-btn-small so-btn-primary" disabled={syncing} onClick={() => void promoteOne(student.id).catch((actionError) => alert(actionError instanceof Error ? actionError.message : "Unable to promote student."))}><GraduationCap size={14}/> Promote</button>
        <button className="so-btn so-btn-small so-btn-danger" disabled={syncing} onClick={() => void revokeOne(student.id, student.name).catch((actionError) => alert(actionError instanceof Error ? actionError.message : "Unable to revoke student."))}><UserMinus size={14}/> Revoke</button>
      </>}{student.status === "active" && !canManage && <span className="locked-copy"><LockKeyhole size={14}/> Read only</span>}{student.status === "revoked" && <span className="locked-copy"><LockKeyhole size={14}/> Locked from promotion</span>}{student.status === "completed" && <span className="locked-copy"><GraduationCap size={14}/> Academic cycle complete</span>}</div></td>
    </tr>)}</tbody></table></div>
  </div>;
}
