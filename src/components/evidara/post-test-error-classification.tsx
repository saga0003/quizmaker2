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

export type SelfClassification =
  | 'concept_gap'
  | 'calculation_error'
  | 'careless_error'
  | 'guessed'
  | 'ran_out_of_time'
  | 'other';

type QueueItem = {
  response_id: string;
  paper_question_id: string;
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
        <div>
          <strong>Reflection item {index + 1} of {items.length}</strong>
          <p>
            {item.is_correct ? 'Correct response' : item.is_skipped ? 'Skipped question' : 'Incorrect response'}
            <span aria-hidden="true"> · </span><Clock3 /> {item.time_spent_seconds || 0} sec
          </p>
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
