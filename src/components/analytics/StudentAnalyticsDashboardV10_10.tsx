'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, FileText, LoaderCircle, RefreshCw } from 'lucide-react';
import { StudentAnalyticsReferenceDashboard } from './StudentAnalyticsReferenceDashboard';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { exportStudentAnalyticsPdf } from '@/lib/analytics-pdf';
import type { StudentAnalyticsPayload } from '@/types/analytics';

type Props = {
  studentId: string;
  onBack?: () => void;
};

/**
 * Evidara v10.11 student analytics entry point.
 *
 * The reference dashboard owns Overview, Subjects, Chapters, Topics,
 * Practice, Test History and Goals. The report action intentionally stays
 * outside those views so the clean native PDF is always available.
 */
export function StudentAnalyticsDashboardV10_10({ studentId, onBack }: Props) {
  const [reportData, setReportData] = useState<StudentAnalyticsPayload | null>(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState('');
  const [exporting, setExporting] = useState(false);

  const loadReportData = useCallback(async () => {
    if (!supabase) {
      setReportError('Connect Supabase to load mapped analytics and download the report.');
      setReportLoading(false);
      return;
    }

    setReportLoading(true);
    setReportError('');
    const { data, error } = await supabase.rpc('get_student_analytics_overview_v11', {
      p_student_id: studentId,
      p_product_id: null,
      p_from: null,
      p_to: null,
    });

    if (error) {
      const migrationHint = /v_attempt|not assigned|analytics_attempt_time_snapshot/i.test(error.message)
        ? ' Apply Supabase migration 41_v10_11_analytics_mapping_and_pdf_hotfix.sql, then refresh.'
        : '';
      setReportError(`${error.message}${migrationHint}`);
      setReportData(null);
    } else {
      setReportData(data as StudentAnalyticsPayload);
    }
    setReportLoading(false);
  }, [studentId]);

  useEffect(() => {
    void loadReportData();
  }, [loadReportData]);

  function downloadReport() {
    if (!reportData) return;
    setExporting(true);
    try {
      exportStudentAnalyticsPdf(reportData, 'All assessments');
    } finally {
      window.setTimeout(() => setExporting(false), 300);
    }
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-4 rounded-[15px] border border-[#DFE6EC] bg-gradient-to-r from-white via-white to-[#F2FAF8] px-5 py-4 shadow-[0_10px_30px_rgba(5,31,50,0.055)] lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#EAF6F4] text-[#006B70]">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-[#071D34]">Evidara v10.11 complete analytics report</div>
            <div className="mt-1 max-w-2xl text-xs leading-5 text-[#536579]">Your mapped Overview, subject performance, answer distribution and benchmark evidence are prepared as the retained clean multi-page PDF.</div>
            {reportData && <div className="mt-2 text-[11px] font-semibold text-[#178353]">Report data mapped successfully · {reportData.summary?.completed_tests || 0} completed tests</div>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void loadReportData()} disabled={reportLoading} className="border-[#C9D9D7] bg-white text-[#315365] hover:bg-[#F5FBFA]">
            <RefreshCw className={`mr-2 h-4 w-4 ${reportLoading ? 'animate-spin' : ''}`} />Refresh data
          </Button>
          <Button type="button" onClick={downloadReport} disabled={reportLoading || !reportData || exporting} className="bg-[#006B70] text-white hover:bg-[#00575C]">
            {reportLoading || exporting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {reportLoading ? 'Preparing report' : exporting ? 'Downloading' : 'Download PDF report'}
          </Button>
        </div>
      </section>

      {reportError && (
        <div className="rounded-xl border border-[#DC4545]/20 bg-[#FFF0EF] px-4 py-3 text-sm leading-6 text-[#B54747]">
          <strong>PDF report and analytics mapping:</strong> {reportError}
        </div>
      )}

      <StudentAnalyticsReferenceDashboard studentId={studentId} onBack={onBack} />
    </div>
  );
}
