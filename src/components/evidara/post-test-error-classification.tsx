'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  LoaderCircle,
  RotateCcw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { RichOptionContent, RichQuestionContent } from '@/components/evidara/rich-math-content';

export type SelfClassification =
  | 'concept_gap'
  | 'calculation_error'
  | 'careless_error'
  | 'guessed'
  | 'ran_out_of_time'
  | 'other';

type ReflectionOption = {
  option_key: string;
  content_text?: string | null;
  content_latex?: string | null;
  image_url?: string | null;
  display_order?: number | null;
  is_correct?: boolean;
};

type QueueItem = {
  response_id: string;
  paper_question_id: string;
  question_number: number | null;
  question_type: string | null;
  stem_text: string | null;
  stem_latex: string | null;
  passage_text: string | null;
  question_image_url: string | null;
  options: ReflectionOption[];
  response: unknown;
  correct_answer: unknown;
  answers_released: boolean;
  shuffle_options: boolean;
  is_correct: boolean;
  is_skipped: boolean;
  time_spent_seconds: number;
  classification: SelfClassification | null;
  confidence_rating: number | null;
  note: string | null;
};

export type ReflectionProgress = {
  completed: number;
  total: number;
};

const options: Array<[SelfClassification, string, string]> = [
  ['concept_gap', 'I did not know the concept', 'Concept gap'],
  ['calculation_error', 'I made a calculation mistake', 'Calculation'],
  ['careless_error', 'I made a careless mistake', 'Careless'],
  ['guessed', 'I guessed the answer', 'Guessed'],
  ['ran_out_of_time', 'I ran out of time', 'Time pressure'],
  ['other', 'Another reason', 'Other'],
];

function isComplete(item: QueueItem) {
  return Boolean(
    item.confidence_rating
      && (item.is_correct || item.classification),
  );
}

function stableHash(value: string) {
  let output = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    output ^= value.charCodeAt(index);
    output = Math.imul(output, 16777619);
  }
  return output >>> 0;
}

function answerValues(value: unknown) {
  if (value === null || value === undefined || value === '') return [] as string[];
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const nested = record.option_keys ?? record.options ?? record.answer ?? record.value;
    if (nested !== undefined) return answerValues(nested);
  }
  return [String(value)];
}

function orderedReflectionOptions(item: QueueItem, attemptId: string) {
  const values = [...(item.options || [])];
  if (item.shuffle_options) {
    values.sort((a, b) =>
      stableHash(`${attemptId}-${item.paper_question_id}-${a.option_key}`)
      - stableHash(`${attemptId}-${item.paper_question_id}-${b.option_key}`),
    );
  } else {
    values.sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0));
  }
  return values;
}

function ReflectionAnswer({
  title,
  value,
  item,
  attemptId,
  tone,
}: {
  title: string;
  value: unknown;
  item: QueueItem;
  attemptId: string;
  tone: 'student' | 'correct';
}) {
  const values = answerValues(value);
  const ordered = orderedReflectionOptions(item, attemptId);
  const matches = ordered
    .map((option, index) => ({ option, index }))
    .filter(({ option }) => values.includes(option.option_key));
  const border = tone === 'correct' ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-white';

  return (
    <div className={`rounded-xl border p-3 ${border}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      {!values.length ? (
        <p className="mt-2 text-sm font-medium text-slate-700">Not answered</p>
      ) : matches.length ? (
        <div className="mt-2 space-y-2">
          {matches.map(({ option, index }) => (
            <div key={option.option_key} className="flex min-w-0 items-start gap-2 text-sm text-slate-900">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 font-bold text-slate-700">{String.fromCharCode(65 + index)}</span>
              <RichOptionContent
                text={option.content_text || undefined}
                latex={option.content_latex || undefined}
                imageUrl={option.image_url || undefined}
                imageAlt={`${title} option ${String.fromCharCode(65 + index)}`}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 break-words text-sm font-medium text-slate-900">{values.join(', ')}</p>
      )}
    </div>
  );
}

export function PostTestErrorClassification({
  attemptId,
  onComplete,
}: {
  attemptId: string;
  onComplete?: (progress: ReflectionProgress) => void;
}) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [index, setIndex] = useState(0);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [reason, setReason] = useState<SelfClassification | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [allComplete, setAllComplete] = useState(false);

  const completed = useMemo(() => items.filter(isComplete).length, [items]);

  const finish = useCallback(() => {
    onComplete?.({ completed, total: items.length });
  }, [completed, items.length, onComplete]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    setSaveError('');

    try {
      if (!supabase) throw new Error('Evidara cloud is not configured on this device.');
      const { data, error } = await supabase.rpc('list_post_test_reflection_queue_v13', {
        p_attempt_id: attemptId,
      });
      if (error) throw error;

      const nextItems = Array.isArray(data?.items) ? data.items as QueueItem[] : [];
      const firstIncomplete = nextItems.findIndex((item) => !isComplete(item));
      setItems(nextItems);
      setIndex(firstIncomplete >= 0 ? firstIncomplete : 0);
      setAllComplete(nextItems.length > 0 && firstIncomplete < 0);
    } catch (error) {
      setItems([]);
      setLoadError(error instanceof Error ? error.message : 'Unable to load reflection questions.');
    } finally {
      setLoading(false);
    }
  }, [attemptId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const item = items[index];
    setConfidence(item?.confidence_rating ?? null);
    setReason(item?.classification ?? null);
    setSaveError('');
  }, [index, items]);

  function moveToNext(nextItems: QueueItem[], currentIndex: number) {
    const laterIndex = nextItems.findIndex((item, itemIndex) => itemIndex > currentIndex && !isComplete(item));
    const earlierIndex = nextItems.findIndex((item, itemIndex) => itemIndex < currentIndex && !isComplete(item));
    const nextIndex = laterIndex >= 0 ? laterIndex : earlierIndex;

    if (nextIndex >= 0) {
      setIndex(nextIndex);
    } else {
      setAllComplete(true);
    }
  }

  async function save() {
    const item = items[index];
    if (!item || !supabase || confidence === null) return;

    setSaving(true);
    setSaveError('');
    try {
      const { error } = await supabase.rpc('save_exam_response_reflection_v13', {
        p_response_id: item.response_id,
        p_confidence_rating: confidence,
        p_classification: item.is_correct ? null : reason,
        p_note: null,
      });
      if (error) throw error;

      const nextItems = items.map((row, itemIndex) => itemIndex === index
        ? {
            ...row,
            confidence_rating: confidence,
            classification: item.is_correct ? null : reason,
          }
        : row);
      setItems(nextItems);
      moveToNext(nextItems, index);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save this reflection.');
    } finally {
      setSaving(false);
    }
  }

  function skipItem() {
    if (index < items.length - 1) {
      setIndex(index + 1);
      return;
    }

    const earlierIncomplete = items.findIndex((item, itemIndex) => itemIndex < index && !isComplete(item));
    if (earlierIncomplete >= 0) {
      setIndex(earlierIncomplete);
    } else {
      finish();
    }
  }

  if (loading) {
    return (
      <div className="post-test-classification-state" aria-live="polite">
        <LoaderCircle className="spin" />
        <div><strong>Loading optional reflection...</strong><p>Your submitted result is already safe.</p></div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="post-test-classification-state error" role="alert">
        <AlertTriangle />
        <div><strong>Reflection could not be loaded</strong><p>{loadError}</p></div>
        <div className="post-test-state-actions">
          <button type="button" onClick={() => void load()}><RotateCcw />Retry</button>
          <button type="button" onClick={finish}>Finish for now</button>
        </div>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="post-test-classification-complete">
        <CheckCircle2 />
        <div><strong>No saved responses are available for reflection</strong><p>Your submitted score and result are unaffected.</p></div>
        <button type="button" onClick={finish}>Finish</button>
      </div>
    );
  }

  if (allComplete) {
    return (
      <div className="post-test-classification-complete">
        <CheckCircle2 />
        <div><strong>Reflection saved</strong><p>All {items.length} available response{items.length === 1 ? '' : 's'} now have learning context.</p></div>
        <button type="button" onClick={finish}>Finish</button>
      </div>
    );
  }

  const item = items[index];

  return (
    <section className="post-test-classification">
      <header>
        <div>
          <span>Optional post-test reflection</span>
          <h3>How confident were you while answering?</h3>
          <p>This supports your learning analytics only. It cannot change your answers, marks, or result.</p>
        </div>
        <div className="post-test-classification-progress" aria-label={`${completed} of ${items.length} reflections saved`}>
          {completed}/{items.length}
        </div>
      </header>

      <div className="post-test-question-summary">
        {item.is_correct ? <CheckCircle2 /> : <AlertTriangle />}
        <div className="min-w-0 flex-1">
          <strong>Question {item.question_number || index + 1} <span className="font-normal text-slate-500">· Reflection {index + 1} of {items.length}</span></strong>
          <p>
            {item.is_correct ? 'Correct response' : item.is_skipped ? 'Skipped question' : 'Incorrect response'}
            <span aria-hidden="true"> · </span><Clock3 /> {item.time_spent_seconds || 0} sec
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <RichQuestionContent
          text={item.stem_text || undefined}
          latex={item.stem_latex || undefined}
          passageText={item.passage_text || undefined}
          imageUrl={item.question_image_url || undefined}
          imageAlt={`Question ${item.question_number || index + 1}`}
          textClassName="font-medium text-slate-950"
        />
        <div className={`mt-4 grid gap-3 ${item.answers_released ? 'md:grid-cols-2' : ''}`}>
          <ReflectionAnswer title="Your answer" value={item.response} item={item} attemptId={attemptId} tone="student" />
          {item.answers_released && <ReflectionAnswer title="Correct answer" value={item.correct_answer} item={item} attemptId={attemptId} tone="correct" />}
        </div>
      </div>

      <div className="post-test-confidence">
        <p>Confidence while answering</p>
        <div>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              type="button"
              key={value}
              className={confidence === value ? 'selected' : ''}
              aria-pressed={confidence === value}
              disabled={saving}
              onClick={() => setConfidence(value)}
            >
              <strong>{value}</strong>
              <small>{['Completely unsure', 'Slightly unsure', 'Somewhat confident', 'Confident', 'Absolutely certain'][value - 1]}</small>
            </button>
          ))}
        </div>
      </div>

      {!item.is_correct && (
        <>
          <p className="post-test-reason-label">Why was this incorrect or skipped?</p>
          <div className="post-test-classification-options">
            {options.map(([value, label, short]) => (
              <button
                type="button"
                key={value}
                disabled={saving}
                className={reason === value ? 'selected' : ''}
                aria-pressed={reason === value}
                onClick={() => setReason(value)}
              >
                <span>{label}</span><small>{short}</small><ChevronRight />
              </button>
            ))}
          </div>
        </>
      )}

      <div className="post-test-reflection-actions">
        <button type="button" className="post-test-reflection-secondary" disabled={saving} onClick={skipItem}>
          Skip this item
        </button>
        <button type="button" className="post-test-reflection-secondary" disabled={saving} onClick={finish}>
          Finish for now
        </button>
        <button
          type="button"
          className="post-test-reflection-save"
          disabled={saving || confidence === null || (!item.is_correct && reason === null)}
          onClick={() => void save()}
        >
          {saving ? 'Saving...' : 'Save & continue'} <ChevronRight />
        </button>
      </div>
      {saveError && <p className="post-test-classification-error" role="alert">{saveError} Your submitted result has not changed.</p>}
    </section>
  );
}
