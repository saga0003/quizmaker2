"use client";
import { CalendarClock, CheckCircle2, Crown, FileCheck2, Gauge, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { daysUntilExpiry, subscriptionIsActive } from "@/lib/schoolPlatform";
import { useSchoolPlatform } from "./useSchoolPlatform";

export function SubscriptionCenter() {
  const { state, update, ready } = useSchoolPlatform();
  if (!ready) return <div className="so-card so-pad">Loading subscription…</div>;
  const sub = state.school.subscription;
  const active = subscriptionIsActive(sub);
  const days = daysUntilExpiry(sub);
  const used = state.students.filter(s => s.status === "active").length;
  const extend = () => update(current => ({ ...current, school: { ...current.school, subscription: { ...current.school.subscription, status: "active", startsAt: "2027-06-01", endsAt: "2028-05-31" } } }));
  return <div>
    <div className="so-page-head"><div><span className="so-kicker">ANNUAL SCHOOL SUBSCRIPTION</span><h1>Access, resources and renewal</h1><p>One yearly plan unlocks the school test platform and eligible academic resources. There is no per-test charge.</p></div><span className={`so-status ${active?"success":"danger"}`}>{active?"Active":"Inactive"}</span></div>
    <section className="so-hero-card subscription-hero"><div><div className="so-plan-icon"><Crown size={25}/></div><span className="so-kicker light">CURRENT PLAN</span><h2>{sub.planName}</h2><p>Valid from {new Date(sub.startsAt).toLocaleDateString("en-IN")} to {new Date(sub.endsAt).toLocaleDateString("en-IN")}.</p><div className="so-inline-stats"><div><strong>{days}</strong><span>days remaining</span></div><div><strong>{used}/{sub.seatLimit}</strong><span>active students</span></div><div><strong>₹0</strong><span>per school-created test</span></div></div></div><button className="so-btn so-btn-accent" onClick={extend}><RefreshCw size={17}/> Demo renewal</button></section>
    <div className="so-grid so-grid-3 so-mt">
      <article className="so-card so-pad benefit-card"><span className="so-label free">FREE</span><FileCheck2/><h3>School-created tests</h3><p>Create chapter, subject, mixed and full-length tests without a per-test fee while the annual school plan is active.</p></article>
      <article className="so-card so-pad benefit-card"><span className="so-label complimentary">COMPLIMENTARY</span><Sparkles/><h3>Previous-year papers</h3><p>Board and entrance-exam papers are complimentary plan resources. They remain subscription-gated and eligibility-controlled.</p></article>
      <article className="so-card so-pad benefit-card"><span className="so-label included">INCLUDED</span><Gauge/><h3>Student intelligence</h3><p>Every submitted test can produce speed, accuracy, mastery, error and intervention analytics for students and teachers.</p></article>
    </div>
    <div className="so-grid so-grid-2 so-mt">
      <section className="so-card so-pad"><div className="so-section-head"><div><span className="so-kicker">PLAN GOVERNANCE</span><h2>What happens at year end</h2></div><CalendarClock/></div><div className="so-steps"><div><b>1</b><span><strong>Review the roster</strong><small>Revoke students who left before running a bulk promotion.</small></span></div><div><b>2</b><span><strong>Promote eligible students</strong><small>Use individual or Promote All. Revoked records are permanently excluded.</small></span></div><div><b>3</b><span><strong>Renew annual access</strong><small>Resources and publishing continue after the next subscription period starts.</small></span></div></div></section>
      <section className="so-card so-pad"><div className="so-section-head"><div><span className="so-kicker">ACCESS CONTROLS</span><h2>Subscription safeguards</h2></div><ShieldCheck/></div><ul className="so-check-list"><li><CheckCircle2/> School tests are marked Free, not sold per test.</li><li><CheckCircle2/> PYQs are marked Complimentary, not publicly free.</li><li><CheckCircle2/> Eligibility is based on board, grade and assigned preparation track.</li><li><CheckCircle2/> Revoked students cannot return through bulk promotion.</li><li><CheckCircle2/> Seat limits and expiry remain auditable.</li></ul></section>
    </div>
  </div>;
}
