"use client";

import { useMemo, useState } from "react";
import {
  BookOpenCheck,
  CheckCircle2,
  Cloud,
  FileText,
  GraduationCap,
  LockKeyhole,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { resourceEligibility, type LearningResource } from "@/lib/schoolPlatform";
import { useSchoolPlatform } from "./useSchoolPlatform";

type CloudResource = LearningResource & { contentUrl?: string };

export function ResourceLibrary({ studentMode = false }: { studentMode?: boolean }) {
  const { state, ready, mode, error } = useSchoolPlatform();
  const [studentId, setStudentId] = useState("");
  const [query, setQuery] = useState("");
  const selectedId = studentId || state.students.find((student) => student.status === "active")?.id || state.students[0]?.id || "";
  const student = state.students.find((item) => item.id === selectedId) || state.students[0];
  const resources = useMemo(
    () => state.resources.filter((resource) => `${resource.title} ${resource.subject} ${resource.kind}`.toLowerCase().includes(query.toLowerCase())),
    [state.resources, query],
  );

  if (!ready) return <div className="so-card so-pad">Loading resources…</div>;
  if (!student) return <div className="so-card so-pad empty-state">No active student membership is linked to this account.</div>;

  const eligibleCount = resources.filter((resource) => resourceEligibility(resource, student, state.school.subscription).allowed).length;

  return <div>
    <div className="so-page-head">
      <div>
        <span className="so-kicker">SUBSCRIPTION RESOURCE LIBRARY</span>
        <h1>{studentMode ? "Your eligible resources" : "Board, entrance and school resources"}</h1>
        <p>“Complimentary” resources require an active annual subscription. Eligibility is evaluated per student.</p>
      </div>
      <div className="so-action-row">
        <span className={`so-status ${mode === "cloud" ? "success" : "neutral"}`}><Cloud size={14}/> {mode === "cloud" ? "Cloud eligibility" : "Demo eligibility"}</span>
        <span className="so-status success">{eligibleCount} eligible</span>
      </div>
    </div>

    {error && <div className="so-notice warning"><ShieldCheck/><span><strong>Cloud notice:</strong> {error}</span></div>}

    {!studentMode && <section className="so-card so-pad eligibility-selector">
      <div><span className="so-kicker">PREVIEW ACCESS AS</span><select className="so-input" value={selectedId} onChange={(event) => setStudentId(event.target.value)}>{state.students.map((item) => <option key={item.id} value={item.id}>{item.name} · Grade {item.grade} · {item.status}</option>)}</select></div>
      <div className="eligibility-profile"><strong>{student.name}</strong><span>{student.board} · Grade {student.grade}</span><div className="track-pills static">{student.tracks.map((track) => <span key={track}>{track}</span>)}</div></div>
    </section>}

    <div className="so-search so-mt"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search previous papers, NEET, JEE, KCET, Olympiad…"/></div>

    <div className="resource-grid so-mt">{resources.map((resource) => {
      const access = resourceEligibility(resource, student, state.school.subscription);
      const contentUrl = (resource as CloudResource).contentUrl;
      return <article key={resource.id} className={`resource-card ${access.allowed ? "" : "locked"}`}>
        <div className="resource-top"><span className={`so-label ${resource.accessLabel.toLowerCase()}`}>{resource.accessLabel}</span>{access.allowed ? <CheckCircle2 className="access-ok"/> : <LockKeyhole className="access-lock"/>}</div>
        <div className="resource-icon">{resource.kind === "school_test" ? <FileText/> : resource.kind === "previous_year_board" ? <BookOpenCheck/> : resource.kind === "olympiad" ? <Sparkles/> : <GraduationCap/>}</div>
        <h3>{resource.title}</h3>
        <p>{resource.description}</p>
        <div className="resource-meta"><span>{resource.subject}</span><span>Grades {resource.gradeMin}{resource.gradeMax !== resource.gradeMin ? `–${resource.gradeMax}` : ""}</span>{resource.board && <span>{resource.board}</span>}{resource.track && <span>{resource.track}</span>}</div>
        {access.allowed
          ? contentUrl
            ? <a className="so-btn so-btn-primary" href={contentUrl} target="_blank" rel="noreferrer"><BookOpenCheck size={16}/> Open resource</a>
            : <button className="so-btn so-btn-primary" disabled><BookOpenCheck size={16}/> Resource publishing soon</button>
          : <div className="resource-lock-message"><ShieldCheck size={15}/>{access.reason}</div>}
      </article>;
    })}</div>

    <div className="so-notice info so-mt"><Sparkles/><span><strong>Terminology used in the product:</strong> School-authored tests are shown as <b>Free</b> because no per-test charge applies. Previous-year papers are shown as <b>Complimentary</b> because they unlock only after an annual subscription is active.</span></div>
  </div>;
}
