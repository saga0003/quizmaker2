import Link from "next/link";
import { FilePlus2, FileText, Sparkles } from "lucide-react";
import { PaperManagementDashboard } from "@/components/papers/PaperManagementDashboard";

export function QuestionPaperList({ kind }: { kind: "admin" | "school" }) {
  const base = kind === "admin" ? "/admin/papers" : "/school/papers";

  return (
    <div className="paper-workspace space-y-5">
      <header className="flex flex-col gap-5 rounded-2xl border border-[#E7ECEB] bg-white p-5 shadow-[0_8px_24px_rgba(20,35,43,0.05)] sm:p-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#DCE9E7] text-[#0E5A5A]">
            <FileText size={22} />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#0E5A5A]">Assessment workspace</span>
            <h1 className="paper-page-title mt-1 text-2xl font-bold sm:text-3xl">Papers</h1>
            <p className="paper-page-copy mt-1 max-w-3xl text-sm">
              Create reusable test-paper definitions, import approved Question Bank content, build manual or generated papers, and keep every copy safely in Draft.
            </p>
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-1 gap-2 sm:grid-cols-2">
          <Link
            href={`${base}/generation/`}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#DCE9E7] bg-[#EDF6F4] px-4 text-sm font-semibold text-[#0E5A5A] transition hover:bg-[#DCE9E7]"
          >
            <Sparkles size={16} /> Generation Studio
          </Link>
          <Link
            href={`${base}/new/`}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#0E5A5A] px-4 text-sm font-semibold text-white transition hover:bg-[#0B4848]"
          >
            <FilePlus2 size={17} /> Create paper
          </Link>
        </div>
      </header>

      <PaperManagementDashboard kind={kind} />
    </div>
  );
}
