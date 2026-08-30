'use client';

import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Edit3, GraduationCap, School, Tag } from 'lucide-react';
import type { QuestionRow } from '@/types/questions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { QuestionDevicePreview } from '@/components/evidara/question-device-preview';
import { SourceFidelityContent, sourceFidelityFromMetadata } from '@/components/evidara/source-fidelity-content';

function dateText(value?: string | null) {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export function QuestionReviewDialog({
  open,
  onOpenChange,
  question,
  canEdit = false,
  onEdit,
  position = 0,
  total = 0,
  onPrevious,
  onNext,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: QuestionRow | null;
  canEdit?: boolean;
  onEdit?: () => void;
  position?: number;
  total?: number;
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  if (!question) return null;
  const options = [...(question.question_options || [])].sort((a, b) => a.display_order - b.display_order);
  const correct = Array.isArray(question.correct_answer) ? question.correct_answer.join('|') : String(question.correct_answer ?? '');
  const publishedAt = String(question.metadata?.published_at || '');
  const hasPrevious = position > 1;
  const hasNext = total > 0 && position < total;
  const sourceFidelity = sourceFidelityFromMetadata(question.metadata);
  const correctDisplay = sourceFidelity ? correct.split('|').filter(Boolean).map((key) => ({ A: '1', B: '2', C: '3', D: '4' } as Record<string,string>)[key] || key).join(', ') : correct;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[96vh] w-[96vw] max-w-[1380px] overflow-hidden border-[#E7ECEB] p-0">
        <DialogHeader className="border-b border-[#E7ECEB] px-5 py-4 sm:px-6">
          <div className="flex gap-4 pr-8 max-lg:flex-col lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-[#DCE9E7] text-[#0E5A5A]">Review Question</Badge>
                <Badge variant="outline" className="border-[#E7ECEB] text-[#6B7980]">{question.status.replaceAll('_', ' ')}</Badge>
                <Badge variant="outline" className="border-[#E7ECEB] text-[#6B7980]">{question.question_type.replaceAll('_', ' ')}</Badge>
                {total > 0 && <Badge variant="outline" className="border-[#DCE9E7] bg-[#F7F9F7] text-[#0E5A5A]">{position} of {total} filtered</Badge>}
              </div>
              <DialogTitle className="mt-3 text-xl text-[#14232B]">Learner-facing question preview</DialogTitle>
              <DialogDescription className="mt-1">Review the exact content, options, classifications and screen layout. Edit and continue through the current filtered set without returning to the table.</DialogDescription>
            </div>
            {canEdit && onEdit && (
              <Button type="button" onClick={onEdit} className="shrink-0 bg-[#0E5A5A] text-white hover:bg-[#0A4747]">
                <Edit3 className="mr-2 h-4 w-4" />Edit this question
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <QuestionDevicePreview
              value={{
                stemText: question.stem_text,
                stemLatex: question.stem_latex || '',
                imageUrl: question.question_image_url || '',
                passageText: question.passage_text || '',
                questionType: question.question_type,
                options,
                numericAnswer: correct,
                subject: question.subjects?.name || '',
                chapter: question.chapters?.name || '',
                topic: question.topics?.name || '',
                difficulty: question.difficulty,
                showCorrectAnswer: true,
                sourceFidelity,
              }}
            />

            <aside className="space-y-3 xl:sticky xl:top-0 xl:self-start">
              <div className="rounded-2xl border border-[#E7ECEB] bg-[#F7F9F7] p-4">
                <strong className="text-sm text-[#14232B]">Question details</strong>
                <div className="mt-3 space-y-3 text-xs text-[#6B7980]">
                  <div className="flex items-start gap-2"><GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-[#0E5A5A]" /><span><strong className="block text-[#14232B]">Grade and examination</strong>{question.class_level || 'Grade not set'} · {(question.exam_types || []).join(', ') || 'Exam not set'}{question.metadata?.biology_division ? ` · ${String(question.metadata.biology_division).replace(/^./, (value) => value.toUpperCase())}` : ''}</span></div>
                  <div className="flex items-start gap-2"><School className="mt-0.5 h-4 w-4 shrink-0 text-[#2E6D8B]" /><span><strong className="block text-[#14232B]">Ownership</strong>{question.organization_id ? question.organizations?.name || 'School question bank' : 'Evidara Master Bank'}</span></div>
                  <div className="flex items-start gap-2"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[#8A5F00]" /><span><strong className="block text-[#14232B]">Expected time</strong>{question.estimated_seconds ? `${question.estimated_seconds} seconds` : 'Not set'}</span></div>
                  <div className="flex items-start gap-2"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-[#0E5A5A]" /><span><strong className="block text-[#14232B]">Published</strong>{publishedAt ? dateText(publishedAt) : question.status === 'approved' ? dateText(question.updated_at) : 'Not published'}</span></div>
                  <div className="flex items-start gap-2"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-[#6B7980]" /><span><strong className="block text-[#14232B]">Last updated</strong>{dateText(question.updated_at)}</span></div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#E7ECEB] bg-white p-4">
                <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#0E5A5A]" /><strong className="text-sm text-[#14232B]">Answer and marking</strong></div>
                <p className="mt-2 text-xs text-[#6B7980]">Correct answer: <strong className="text-[#14232B]">{correctDisplay || 'Not set'}</strong></p>
                <p className="mt-1 text-xs text-[#6B7980]">Marks: <strong className="text-[#14232B]">+{question.marks}</strong> · Negative: <strong className="text-[#B54747]">-{question.negative_marks}</strong></p>
                {sourceFidelity?.solution_segments?.length ? (
                  <div className="mt-3 rounded-xl border border-[#E7ECEB] bg-white p-2"><SourceFidelityContent segments={sourceFidelity.solution_segments} pageSize={sourceFidelity.source_pdf_page_size || [612, 792]} label="Source-faithful solution" /></div>
                ) : question.solution_text ? <div className="mt-3 rounded-xl bg-[#F7F9F7] p-3 text-xs leading-relaxed text-[#14232B] whitespace-pre-wrap">{question.solution_text}</div> : null}
              </div>

              {!!question.tags?.length && (
                <div className="rounded-2xl border border-[#E7ECEB] bg-white p-4">
                  <div className="flex items-center gap-2"><Tag className="h-4 w-4 text-[#2E6D8B]" /><strong className="text-sm text-[#14232B]">Search tags</strong></div>
                  <div className="mt-3 flex flex-wrap gap-1.5">{question.tags.map((tag) => <Badge key={tag} variant="outline" className="border-[#E7ECEB] text-[10px] text-[#6B7980]">{tag}</Badge>)}</div>
                </div>
              )}
            </aside>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E7ECEB] bg-white px-5 py-3 sm:px-6">
          <p className="text-xs text-[#6B7980]">
            {total > 0 ? `Question ${position} of ${total} in the current filtered result` : 'Current question'}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={!hasPrevious} onClick={onPrevious} className="border-[#E7ECEB]">
              <ChevronLeft className="mr-1 h-4 w-4" />Previous
            </Button>
            <Button type="button" variant="outline" disabled={!hasNext} onClick={onNext} className="border-[#E7ECEB]">
              Next<ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
