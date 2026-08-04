'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpenCheck, CheckCircle2, Clock3, Download, Gauge, Layers3, LoaderCircle, RefreshCw } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '@/lib/supabase';
import type { StudentTaxonomyAnalyticsPayload, TaxonomyComparisonRow } from '@/types/analytics-phase4';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function value(input?: number | null, suffix = '') { return input == null ? '—' : `${Number(input).toFixed(1)}${suffix}`; }
function downloadCsv(rows: TaxonomyComparisonRow[], level: 'chapter' | 'topic') {
  const header = ['Subject', 'Chapter', ...(level === 'topic' ? ['Topic'] : []), 'Questions', 'Correct', 'Wrong', 'Unanswered', 'Percentage', 'Accuracy', 'Average', 'Top 10%', 'Top 5%', 'Highest'];
  const body = rows.map((row) => [row.subject_name, row.chapter_name, ...(level === 'topic' ? [row.topic_name || ''] : []), row.questions, row.correct, row.incorrect, row.unanswered, row.percentage, row.accuracy, row.average ?? '', row.top10 ?? '', row.top5 ?? '', row.highest ?? '']);
  const csv = [header, ...body].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `evidara-${level}-analytics.csv`; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function StudentTaxonomyAnalyticsPanel({ studentId }: { studentId: string }) {
  const [data, setData] = useState<StudentTaxonomyAnalyticsPayload | null>(null);
  const [productId, setProductId] = useState('all');
  const [subject, setSubject] = useState('all');
  const [level, setLevel] = useState<'chapter' | 'topic'>('chapter');
  const [metric, setMetric] = useState<'percentage' | 'accuracy'>('percentage');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!supabase) { setError('Connect Supabase and apply migrations 38 and 38a.'); setLoading(false); return; }
    setLoading(true); setError('');
    const { data: result, error: loadError } = await supabase.rpc('get_student_taxonomy_analytics_v12', {
      p_student_id: studentId,
      p_product_id: productId === 'all' ? null : productId,
    });
    if (loadError) setError(loadError.message); else setData(result as StudentTaxonomyAnalyticsPayload);
    setLoading(false);
  }, [productId, studentId]);

  useEffect(() => { void load(); }, [load]);

  const subjects = useMemo(() => Array.from(new Set([...(data?.chapters || []), ...(data?.topics || [])].map((row) => row.subject_name))).sort(), [data]);
  const sourceRows = level === 'chapter' ? data?.chapters || [] : data?.topics || [];
  const rows = sourceRows.filter((row) => subject === 'all' || row.subject_name === subject);
  const chartRows = rows.slice().sort((a, b) => (metric === 'percentage' ? a.percentage - b.percentage : a.accuracy - b.accuracy)).slice(0, 14).map((row) => ({
    name: level === 'chapter' ? row.chapter_name : row.topic_name,
    student: metric === 'percentage' ? row.percentage : row.accuracy,
    average: row.average,
    top10: row.top10,
    top5: row.top5,
    highest: row.highest,
  }));
  const completion = data?.completion;

  return <div className="space-y-5">
    <Card className="border-[#CFE0DE] bg-gradient-to-br from-white to-[#F2F8F7] shadow-none">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2"><Gauge className="h-5 w-5 text-[#0E5A5A]" /><h2 className="font-semibold text-[#14232B]">Simple time-management indicator</h2></div>
            <p className="mt-2 text-sm leading-6 text-[#44545C]">This is a supporting indicator, not an exact scientific measurement of speed or ability. No target time is assigned to individual questions.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[#E7ECEB] bg-white p-3"><strong className="text-[#0E5A5A]">50%</strong><p className="mt-1 text-xs text-[#6B7980]">Questions attempted ÷ total questions</p></div>
              <div className="rounded-xl border border-[#E7ECEB] bg-white p-3"><strong className="text-[#2E6D8B]">30%</strong><p className="mt-1 text-xs text-[#6B7980]">Correct answers ÷ attempted questions</p></div>
              <div className="rounded-xl border border-[#E7ECEB] bg-white p-3"><strong className="text-[#9A6508]">20%</strong><p className="mt-1 text-xs text-[#6B7980]">Simple completion and timeout control</p></div>
            </div>
            <p className="mt-3 text-xs leading-5 text-[#6B7980]">Only two penalties apply: possible rushing when less than half the duration is used with accuracy below 60%, and automatic timeout with unanswered questions.</p>
          </div>
          <div className="min-w-[230px] rounded-2xl border border-[#B7CECB] bg-white p-5 text-center">
            <Clock3 className="mx-auto h-6 w-6 text-[#0E5A5A]" />
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#6B7980]">Overall selected-series score</p>
            <strong className="mt-2 block text-4xl text-[#0E5A5A]">{completion?.time_score_available ? value(completion.overall_time_score, '/10') : 'Locked'}</strong>
            <p className="mt-2 text-sm font-semibold text-[#14232B]">{completion?.time_score_available ? completion.rating : `${completion?.completed_tests || 0}/${completion?.total_tests || 0} tests completed`}</p>
            {!completion?.time_score_available && <p className="mt-2 text-xs leading-5 text-[#6B7980]">The overall score appears only after every compulsory test in the selected series is completed.</p>}
          </div>
        </div>
      </CardContent>
    </Card>

    <Card className="border-[#E7ECEB] shadow-none">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div><div className="flex items-center gap-2"><Layers3 className="h-5 w-5 text-[#0E5A5A]" /><h2 className="font-semibold text-[#14232B]">Chapter and topic analytics</h2></div><p className="mt-1 text-sm text-[#6B7980]">Generated demo evidence is mapped to chapters and topics for PCM and PCB test series.</p></div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <Select value={productId} onValueChange={setProductId}><SelectTrigger><SelectValue placeholder="Series" /></SelectTrigger><SelectContent><SelectItem value="all">All completed demo series</SelectItem>{(data?.products || []).map((product) => <SelectItem key={product.id} value={product.id}>{product.name} · {product.completed_tests}/{product.total_tests}</SelectItem>)}</SelectContent></Select>
            <Select value={subject} onValueChange={setSubject}><SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger><SelectContent><SelectItem value="all">All subjects</SelectItem>{subjects.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
            <Select value={level} onValueChange={(item) => setLevel(item as 'chapter' | 'topic')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="chapter">Chapter view</SelectItem><SelectItem value="topic">Topic view</SelectItem></SelectContent></Select>
            <Select value={metric} onValueChange={(item) => setMetric(item as 'percentage' | 'accuracy')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="percentage">Percentage</SelectItem><SelectItem value="accuracy">Overall accuracy</SelectItem></SelectContent></Select>
          </div>
        </div>

        {error && <div className="mt-4 rounded-xl border border-[#B54747]/20 bg-[#FAEEEE] p-3 text-sm text-[#B54747]">{error}</div>}
        {loading ? <div className="grid min-h-[260px] place-items-center text-sm text-[#6B7980]"><div><LoaderCircle className="mx-auto mb-3 h-6 w-6 animate-spin" />Loading chapter and topic evidence…</div></div> : !data?.demo_taxonomy_available ? <div className="mt-5 rounded-xl border border-[#E8D39B] bg-[#FFF9E9] p-4 text-sm text-[#6A4B0B]">{data?.note || 'No mapped chapter and topic evidence is available.'}</div> : <>
          <div className="mt-5 h-[380px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartRows} layout="vertical" margin={{ left: 16, right: 28, top: 8, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" stroke="#E7ECEB" /><XAxis type="number" domain={[0,100]} tick={{ fontSize: 10 }} /><YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 10 }} /><Tooltip /><Legend /><Bar dataKey="student" name="Your result" fill="#0E5A5A" radius={[0,4,4,0]} /><Bar dataKey="average" name="Average" fill="#9FBDBD" radius={[0,4,4,0]} /></BarChart></ResponsiveContainer></div>
          <div className="mt-5 flex justify-end"><Button variant="outline" onClick={() => downloadCsv(rows, level)}><Download className="mr-2 h-4 w-4" />Export {level} CSV</Button></div>
          <div className="mt-4 overflow-x-auto rounded-xl border border-[#E7ECEB]"><table className="w-full min-w-[1000px] text-sm"><thead className="bg-[#F7F9F7] text-left text-xs text-[#6B7980]"><tr><th className="p-3">Subject</th><th className="p-3">Chapter</th>{level === 'topic' && <th className="p-3">Topic</th>}<th className="p-3 text-right">Questions</th><th className="p-3 text-right">Correct</th><th className="p-3 text-right">Wrong</th><th className="p-3 text-right">Unanswered</th><th className="p-3 text-right">Your result</th><th className="p-3 text-right">Average</th><th className="p-3 text-right">Top 10%</th><th className="p-3 text-right">Top 5%</th><th className="p-3 text-right">Highest</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-[#EEF2F1]"><td className="p-3 font-semibold text-[#14232B]">{row.subject_name}</td><td className="p-3 text-[#44545C]">{row.chapter_name}</td>{level === 'topic' && <td className="p-3 text-[#44545C]">{row.topic_name}</td>}<td className="p-3 text-right">{row.questions}</td><td className="p-3 text-right text-[#237A57]">{row.correct}</td><td className="p-3 text-right text-[#B54747]">{row.incorrect}</td><td className="p-3 text-right text-[#9A6508]">{row.unanswered}</td><td className="p-3 text-right font-bold text-[#0E5A5A]">{value(metric === 'percentage' ? row.percentage : row.accuracy, '%')}</td><td className="p-3 text-right">{value(row.average, '%')}</td><td className="p-3 text-right">{value(row.top10, '%')}</td><td className="p-3 text-right">{value(row.top5, '%')}</td><td className="p-3 text-right">{value(row.highest, '%')}</td></tr>)}</tbody></table></div>
        </>}
      </CardContent>
    </Card>
  </div>;
}
