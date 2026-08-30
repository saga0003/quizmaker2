"use client";

import {
  Bot,
  CalendarDays,
  CheckCircle2,
  Crown,
  FileText,
  FolderOpen,
  HelpCircle,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import { daysUntilExpiry, subscriptionIsActive } from "@/lib/schoolPlatform";
import { useSchoolPlatform } from "./useSchoolPlatform";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/config/site";

function dateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function SubscriptionCenter() {
  const { state, ready, syncing, error, refresh } = useSchoolPlatform({
    allowDemo: false,
    unavailableMessage: "Live subscription data requires configured Evidara cloud access.",
  });
  if (!ready) return <Card className="border-[#DFE6EC]"><CardContent className="p-6 text-sm text-[var(--muted-foreground)]">Loading institution subscription…</CardContent></Card>;

  const subscription = state.school.subscription;
  const active = subscriptionIsActive(subscription);
  const days = daysUntilExpiry(subscription);
  const used = state.students.filter((student) => student.status === "active").length;
  const unlimited = active && subscription.seatLimit <= 0;
  const placeholderSubscription = !active && subscription.seatLimit <= 0 && subscription.startsAt === subscription.endsAt;
  const planName = /scholar|evidara\s+annual\s+school\s+access/i.test(subscription.planName) ? "Founding Institution Plan" : subscription.planName;
  const startLabel = placeholderSubscription ? "Not activated" : dateLabel(subscription.startsAt);
  const renewalLabel = placeholderSubscription ? "Activate to start annual access" : dateLabel(subscription.endsAt);

  const features = [
    [FileText, "Question bank", "Institution questions, bulk import and paper creation"],
    [FileText, "Unlimited tests", "Create chapter, subject, mixed and full-length assessments"],
    [Users, "Student analytics", "Speed, accuracy, chapter and topic performance"],
    [FolderOpen, "Study resources", "Institution and complimentary Evidara resources"],
    [Bot, "AI Helper", "Conversion prompts for LaTeX, Excel and image ZIP workflows"],
  ] as const;

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-[#14232B]">Institution Subscription</h1>
        <p className="mt-1 text-sm text-[#6B7980]">Access, resources and renewal for {state.school.name}.</p>
      </div>
      <Button variant="outline" disabled={syncing} onClick={() => void refresh()} className="w-fit border-[#DCE4E8] bg-white">
        <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />Check subscription status
      </Button>
    </div>

    {error && <div className="rounded-xl border border-[#F1D8A5] bg-[#FFF9EC] px-4 py-3 text-sm text-[#7A5A10]">{error}</div>}

    <Card className="overflow-hidden border-[#DCE6E9] shadow-sm">
      <CardContent className="p-0">
        <div className="grid gap-0 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div className="flex items-center gap-4 p-6">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[#EAF6F4] text-[#0E5A5A]"><Crown className="h-7 w-7" /></div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#0E5A5A]">Current plan</p>
              <h2 className="mt-1 text-xl font-bold text-[#14232B]">{planName}</h2>
              <Badge variant="outline" className={`mt-2 ${active ? "border-[#B8DDD4] bg-[#EAF6F4] text-[#0E5A5A]" : "border-[#E7C4C4] bg-[#FFF0F0] text-[#B54747]"}`}>
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />{active ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
          <div className="border-t border-[#EDF1F2] p-6 lg:border-l lg:border-t-0">
            <div className="space-y-4 text-sm"><div className="flex gap-3"><CalendarDays className="mt-0.5 h-4 w-4 text-[#31566B]" /><div><p className="text-xs text-[#7B8A90]">Valid from</p><strong className="text-[#14232B]">{startLabel}</strong></div></div><div className="flex gap-3"><CalendarDays className="mt-0.5 h-4 w-4 text-[#31566B]" /><div><p className="text-xs text-[#7B8A90]">Renewal date</p><strong className="text-[#14232B]">{renewalLabel}</strong></div></div></div>
          </div>
          <div className="border-t border-[#EDF1F2] p-6 lg:border-l lg:border-t-0">
            <div className="grid grid-cols-2 gap-5"><div><Users className="h-5 w-5 text-[#31566B]" /><p className="mt-2 text-xs text-[#7B8A90]">Students</p><strong className="text-[#14232B]">{placeholderSubscription ? "Unlimited on activation" : unlimited ? "Unlimited" : subscription.seatLimit || "Unlimited"}</strong></div><div><FileText className="h-5 w-5 text-[#31566B]" /><p className="mt-2 text-xs text-[#7B8A90]">Tests</p><strong className="text-[#14232B]">Unlimited</strong></div><div className="col-span-2"><ShieldCheck className="h-5 w-5 text-[#31566B]" /><p className="mt-2 text-xs text-[#7B8A90]">Resource access</p><strong className="text-[#14232B]">{subscription.resourceAccess === "full" ? "Included" : "Limited"}</strong></div></div>
          </div>
        </div>
      </CardContent>
    </Card>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {[
        [Users, "Active students", String(used), "Institution roster"],
        [ShieldCheck, "Seats policy", unlimited || subscription.seatLimit <= 0 ? "Unlimited" : String(subscription.seatLimit), unlimited ? "No seat limits" : `${Math.max(0, subscription.seatLimit - used)} available`],
        [FileText, "Tests", "Unlimited", "No per-test charge"],
        [FolderOpen, "Resources", subscription.resourceAccess === "full" ? "Included" : "Limited", `${state.resources.length} visible now`],
        [CalendarDays, "Days remaining", placeholderSubscription ? "—" : String(days), placeholderSubscription ? "Annual access not activated" : `Renews ${dateLabel(subscription.endsAt)}`],
      ].map(([Icon, label, value, note]) => <Card key={String(label)} className="border-[#DFE6EC] shadow-sm"><CardContent className="p-4"><div className="grid h-9 w-9 place-items-center rounded-xl bg-[#EAF6F4] text-[#0E5A5A]"><Icon className="h-4 w-4" /></div><p className="mt-3 text-xs text-[#7B8A90]">{label as string}</p><p className="mt-1 text-lg font-bold text-[#14232B]">{value as string}</p><p className="mt-1 text-xs text-[#7B8A90]">{note as string}</p></CardContent></Card>)}
    </div>

    <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr_0.9fr]">
      <Card className="border-[#DFE6EC] shadow-sm"><CardContent className="p-5"><h3 className="font-bold text-[#14232B]">Included features</h3><div className="mt-4 divide-y divide-[#EDF1F2]">{features.map(([Icon, title, description]) => <div key={title} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#EFF7F5] text-[#0E5A5A]"><Icon className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[#14232B]">{title}</p><p className="mt-0.5 text-xs leading-5 text-[#7B8A90]">{description}</p></div><span className="text-xs font-semibold text-[#0E5A5A]">Included</span></div>)}</div></CardContent></Card>

      <Card className="border-[#DFE6EC] shadow-sm"><CardContent className="p-5"><h3 className="font-bold text-[#14232B]">Subscription governance</h3><div className="mt-4 space-y-4 text-sm"><div><p className="text-xs text-[#7B8A90]">Renewal policy</p><p className="font-semibold text-[#14232B]">Annual institution renewal</p></div><div><p className="text-xs text-[#7B8A90]">Seats policy</p><p className="font-semibold text-[#14232B]">{unlimited || subscription.seatLimit <= 0 ? "Unlimited students" : `${subscription.seatLimit} students`}</p></div><div><p className="text-xs text-[#7B8A90]">Eligibility</p><p className="font-semibold text-[#14232B]">All active institution students</p></div><div><p className="text-xs text-[#7B8A90]">Cancellation / changes</p><p className="font-semibold text-[#14232B]">Contact Evidara support</p></div></div><div className="mt-5 rounded-xl border border-[#CFE0EB] bg-[#F7FAFF] p-4"><div className="flex gap-2"><HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#4267D5]" /><div><strong className="text-sm text-[#274B68]">What happens at renewal?</strong><p className="mt-1 text-xs leading-5 text-[#5E7380]">Your question bank, papers, student records and analysis remain attached to the institution. Renewal keeps access active without recreating data.</p></div></div></div></CardContent></Card>

      <Card className="border-[#DFE6EC] shadow-sm"><CardContent className="p-5"><h3 className="font-bold text-[#14232B]">Billing & activation</h3><div className="mt-4 divide-y divide-[#EDF1F2] text-sm"><div className="py-3 first:pt-0"><p className="text-xs text-[#7B8A90]">Billing cycle</p><p className="font-semibold text-[#14232B]">Annual</p></div><div className="py-3"><p className="text-xs text-[#7B8A90]">Plan price</p><p className="font-semibold text-[#14232B]">₹199 / active student / year</p></div><div className="py-3"><p className="text-xs text-[#7B8A90]">Activation</p><p className="font-semibold text-[#14232B]">Institution controlled by Evidara</p></div><div className="py-3 last:pb-0"><p className="text-xs text-[#7B8A90]">Current status</p><p className={`font-semibold ${active ? "text-[#0E5A5A]" : "text-[#B54747]"}`}>{active ? "Active" : "Needs renewal"}</p></div></div></CardContent></Card>
    </div>

    <Card className="border-[#DFE6EC] shadow-sm"><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#F1F6F5] text-[#0E5A5A]"><ShieldCheck className="h-4 w-4" /></div><div><p className="text-sm font-semibold text-[#14232B]">Need help with access or renewal?</p><p className="mt-0.5 text-xs text-[#7B8A90]">Contact {siteConfig.supportEmail}{siteConfig.supportPhone && !siteConfig.supportPhone.startsWith("Configure") ? ` · ${siteConfig.supportPhone}` : ""}</p></div></div></CardContent></Card>
  </div>;
}
