'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { LoaderCircle, RefreshCw, Search, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { AnalyticsDemoStudentTablePayload } from '@/types/analytics';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function score(value?: number | null) {
  return typeof value === 'number' ? value.toFixed(1) : '—';
}

export function DemoStudentResultsTable({ email }: { email: string }) {
  const [payload, setPayload] = useState<AnalyticsDemoStudentTablePayload | null>(null);
  const [productId, setProductId] = useState('all');
  const [track, setTrack] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError('');
    const { data, error: loadError } = await supabase.rpc('list_analytics_demo_students_v11', {
      p_email: email.trim().toLowerCase(),
      p_product_id: productId === 'all' ? null : productId,
    });
    if (loadError) setError(loadError.message);
    else setPayload(data as AnalyticsDemoStudentTablePayload);
    setLoading(false);
  }, [email, productId]);

  useEffect(() => { void load(); }, [load]);

  const students = useMemo(() => (payload?.students || []).filter((student) =>
    (track === 'all' || student.track === track)
    && (!search || `${student.roll_number} ${student.full_name}`.toLowerCase().includes(search.toLowerCase())),
  ), [payload?.students, search, track]);

  return (
    <Card className="mt-5 gap-0 border-[#D5E2E0] bg-white shadow-none">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0E5A5A]"><Users className="h-4 w-4" />100-student comparison table</div>
            <h3 className="mt-2 text-lg font-bold text-[#14232B]">Surface-level marks and subject scores</h3>
            <p className="mt-1 text-sm text-[#6B7980]">Fifty PCM students and fifty PCB students. Select one series to verify its 10-test completion and percentile lock.</p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh table</Button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger><SelectValue placeholder="Series" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All six generated series</SelectItem>
              {(payload?.products || []).map((product) => <SelectItem key={product.id} value={product.id}>{product.name} · {product.track}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={track} onValueChange={setTrack}>
            <SelectTrigger><SelectValue placeholder="Track" /></SelectTrigger>
            <SelectContent><SelectItem value="all">PCM and PCB</SelectItem><SelectItem value="PCM">PCM only</SelectItem><SelectItem value="PCB">PCB only</SelectItem></SelectContent>
          </Select>
          <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9AA7AD]" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search roll number or student" className="pl-9" /></div>
        </div>

        {error && <div className="mt-4 rounded-xl border border-[#B54747]/20 bg-[#FAEEEE] p-3 text-sm text-[#B54747]">{error}</div>}
        {loading && !payload ? <div className="grid min-h-[260px] place-items-center text-sm text-[#6B7980]"><div><LoaderCircle className="mx-auto mb-3 h-6 w-6 animate-spin" />Calculating the cohort table…</div></div> : (
          <div className="mt-5 overflow-hidden rounded-xl border border-[#E7ECEB]">
            <div className="max-h-[620px] overflow-auto">
              <table className="min-w-[1120px] w-full border-collapse text-left text-sm">
                <thead className="sticky top-0 z-10 bg-[#F7F9F7] text-xs uppercase tracking-wide text-[#6B7980]">
                  <tr>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-3 py-3">Track</th>
                    <th className="px-3 py-3">Tests</th>
                    <th className="px-3 py-3">Total marks</th>
                    <th className="px-3 py-3">Percentage</th>
                    <th className="px-3 py-3">Physics</th>
                    <th className="px-3 py-3">Chemistry</th>
                    <th className="px-3 py-3">Math / Biology</th>
                    <th className="px-3 py-3">Series status</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => {
                    const thirdSubject = student.track === 'PCM' ? student.subjects.Mathematics : student.subjects.Biology;
                    return (
                      <tr key={student.id} className="border-t border-[#EEF2F1] hover:bg-[#FAFCFB]">
                        <td className="px-4 py-3"><strong className="block text-[#14232B]">{student.full_name}</strong><span className="mt-0.5 block text-xs text-[#6B7980]">{student.roll_number} · {student.section_label}</span></td>
                        <td className="px-3 py-3"><Badge variant="outline">{student.track}</Badge></td>
                        <td className="px-3 py-3 font-semibold text-[#14232B]">{student.completed_tests}</td>
                        <td className="px-3 py-3"><strong className="text-[#14232B]">{score(student.total_marks)}</strong><span className="text-[#6B7980]"> / {score(student.maximum_marks)}</span></td>
                        <td className="px-3 py-3 font-bold text-[#0E5A5A]">{score(student.percentage)}%</td>
                        <td className="px-3 py-3">{score(student.subjects.Physics)}%</td>
                        <td className="px-3 py-3">{score(student.subjects.Chemistry)}%</td>
                        <td className="px-3 py-3">{score(thirdSubject)}% <span className="block text-[11px] text-[#6B7980]">{student.track === 'PCM' ? 'Mathematics' : 'Biology'}</span></td>
                        <td className="px-3 py-3">{productId === 'all' ? <Badge variant="outline">{student.completed_series}/{student.available_series} series complete</Badge> : student.percentile_unlocked ? <Badge className="bg-[#EAF4EF] text-[#237A57]">Percentile unlocked</Badge> : <Badge className="bg-[#FFF4DE] text-[#9A6508]">Complete all 10 tests</Badge>}</td>
                      </tr>
                    );
                  })}
                  {!students.length && <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-[#6B7980]">No students match the selected filters.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <p className="mt-3 text-xs text-[#6B7980]">Showing {students.length} of {payload?.students.length || 0} generated students.</p>
      </CardContent>
    </Card>
  );
}
