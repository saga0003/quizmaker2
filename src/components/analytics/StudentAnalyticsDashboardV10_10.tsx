'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, FileText, LoaderCircle } from 'lucide-react';
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
 * Evidara v10.10 student analytics entry point.
 *
 * The full reference dashboard remains responsible for the interactive
 * Overview, Subject, Chapter, Topic, Practice, Test History and Goals views.
 * This wrapper deliberately preserves the earlier clean native PDF report
 * generator so future UI revisions cannot accidentally remove report export.
 */
export function StudentAnalyticsDashboardV10_10({ studentId, onBack }: Props) {
  const [reportData, setReportData] = useState<StudentAnalyticsPayload | null>(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState('');
  const [exporting, setExporting] = useState(false);

  const loadReportData = useCallback(async () => {
    if (!supabase) {
      setReportError('Connect Supabase to download the analytics report.');
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

    if (error) setReportError(error.message);
    else setReportData(data as StudentAnalyticsPayload);
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
      <section className="flex flex-col gap-3 rounded-[15px] border border-[#DFE6EC] bg-white px-4 py-3 shadow-[0_10px_30px_rgba(5,31,50,0.055)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-[#EAF6F4] text-[#006B70]">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-[#071D34]">Evidara v10.10 analytics report</div>
            <div className="text-xs leading-5 text-[#536579]">Download the clean multi-page PDF report retained from the previous analytics version.</div>
          </div>
        </div>
        <Button
          type="button"
          onClick={downloadReport}
          disabled={reportLoading || !reportData || exporting}
          className="bg-[#006B70] text-white hover:bg-[#00575C]"
        >
          {reportLoading || exporting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          {reportLoading ? 'Preparing report' : exporting ? 'Downloading' : 'Download PDF report'}
        </Button>
      </section>

      {reportError && (
        <div className="rounded-xl border border-[#DC4545]/20 bg-[#FFF0EF] px-4 py-3 text-sm text-[#B54747]">
          PDF report: {reportError}
        </div>
      )}

      <StudentAnalyticsReferenceDashboard studentId={studentId} onBack={onBack} />
    </div>
  );
}
