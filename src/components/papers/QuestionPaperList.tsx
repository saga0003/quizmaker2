import Link from "next/link";
import { Sparkles } from "lucide-react";
import { PaperManagementDashboard } from "@/components/papers/PaperManagementDashboard";

export function QuestionPaperList({ kind }: { kind: "admin" | "school" }) {
  const generationRoute = kind === "admin" ? "/admin/papers/generation/" : "/school/papers/generation/";
  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-4 rounded-xl border border-[#B7DCD5] bg-[#EDF7F5] p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#0E5A5A] text-white">
            <Sparkles size={19} />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0E5A5A]">V8 Phase 3</span>
            <h2 className="mt-1 font-bold text-[#14232B]">Question Bank & Generation Studio</h2>
            <p className="mt-1 text-xs leading-relaxed text-[#587077]">
              Select approved questions across pages, lock hybrid questions, build exact blueprints, resolve shortages and reproduce generation runs by seed.
            </p>
          </div>
        </div>
        <Link href={generationRoute} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#0E5A5A] px-4 text-sm font-semibold text-white hover:bg-[#0A4747]">
          <Sparkles size={16} /> Open Phase 3 Studio
        </Link>
      </section>
      <PaperManagementDashboard kind={kind} />
    </div>
  );
}
