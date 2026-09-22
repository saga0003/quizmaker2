from pathlib import Path


def must_replace(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Missing expected snippet: {label}")
    return text.replace(old, new, 1)


# 1) Live assessment: shuffle option CONTENT, but relabel the visible order A/B/C/D.
path = Path("src/components/papers/LiveExam.tsx")
text = path.read_text()
old = """              {orderedOptions.map((option) => {
                const checked = answerKeys.includes(option.option_key);
                return (
                  <button key={option.option_key} onClick={() => void selectOption(option.option_key)} style={{ display: 'grid', gridTemplateColumns: '38px 1fr', gap: 10, alignItems: 'center', textAlign: 'left', padding: 13, borderRadius: 12, border: checked ? '2px solid #f6b100' : '1px solid #dfe4ec', background: checked ? '#fff8e6' : 'white' }}>
                    <span style={{ width: 32, height: 32, borderRadius: question.question_type === 'multiple_correct' ? 8 : 999, display: 'grid', placeItems: 'center', background: checked ? '#f6b100' : '#f2f4f7', fontWeight: 800 }}>{sourceFidelity ? orderedOptions.findIndex((item) => item.option_key === option.option_key) + 1 : option.option_key}</span>
                    <span>
                      {sourceFidelity ? (
                        <strong>Option {orderedOptions.findIndex((item) => item.option_key === option.option_key) + 1}</strong>
                      ) : (
                        <RichOptionContent text={option.content_text} latex={option.content_latex || undefined} imageUrl={option.image_url || undefined} imageAlt={`Option ${option.option_key}`} />
                      )}
                    </span>
                  </button>
                );
              })}
"""
new = """              {orderedOptions.map((option, optionIndex) => {
                const checked = answerKeys.includes(option.option_key);
                const presentationLabel = sourceFidelity ? String(optionIndex + 1) : String.fromCharCode(65 + optionIndex);
                return (
                  <button key={option.option_key} onClick={() => void selectOption(option.option_key)} style={{ display: 'grid', gridTemplateColumns: '38px 1fr', gap: 10, alignItems: 'center', textAlign: 'left', padding: 13, borderRadius: 12, border: checked ? '2px solid #f6b100' : '1px solid #dfe4ec', background: checked ? '#fff8e6' : 'white' }}>
                    <span style={{ width: 32, height: 32, borderRadius: question.question_type === 'multiple_correct' ? 8 : 999, display: 'grid', placeItems: 'center', background: checked ? '#f6b100' : '#f2f4f7', fontWeight: 800 }}>{presentationLabel}</span>
                    <span>
                      {sourceFidelity ? (
                        <strong>Option {presentationLabel}</strong>
                      ) : (
                        <RichOptionContent text={option.content_text} latex={option.content_latex || undefined} imageUrl={option.image_url || undefined} imageAlt={`Option ${presentationLabel}`} />
                      )}
                    </span>
                  </button>
                );
              })}
"""
text = must_replace(text, old, new, "live shuffled option presentation labels")
path.write_text(text)


# 2) Reflection: show the actual question, student's answer and released correct answer.
path = Path("src/components/evidara/post-test-error-classification.tsx")
text = path.read_text()
text = must_replace(
    text,
    "import { supabase } from '@/lib/supabase';\n",
    "import { supabase } from '@/lib/supabase';\nimport { RichOptionContent, RichQuestionContent } from '@/components/evidara/rich-math-content';\n",
    "reflection rich-content import",
)
old_type = """type QueueItem = {
  response_id: string;
  paper_question_id: string;
  is_correct: boolean;
  is_skipped: boolean;
  time_spent_seconds: number;
  classification: SelfClassification | null;
  confidence_rating: number | null;
  note: string | null;
};
"""
new_type = """type ReflectionOption = {
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
"""
text = must_replace(text, old_type, new_type, "reflection queue item context")
helper_marker = """function isComplete(item: QueueItem) {
  return Boolean(
    item.confidence_rating
      && (item.is_correct || item.classification),
  );
}
"""
helper_replacement = helper_marker + """
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
"""
text = must_replace(text, helper_marker, helper_replacement, "reflection answer helpers")
old_summary = """      <div className=\"post-test-question-summary\">
        {item.is_correct ? <CheckCircle2 /> : <AlertTriangle />}
        <div>
          <strong>Reflection item {index + 1} of {items.length}</strong>
          <p>
            {item.is_correct ? 'Correct response' : item.is_skipped ? 'Skipped question' : 'Incorrect response'}
            <span aria-hidden=\"true\"> · </span><Clock3 /> {item.time_spent_seconds || 0} sec
          </p>
        </div>
      </div>
"""
new_summary = """      <div className=\"post-test-question-summary\">
        {item.is_correct ? <CheckCircle2 /> : <AlertTriangle />}
        <div className=\"min-w-0 flex-1\">
          <strong>Question {item.question_number || index + 1} <span className=\"font-normal text-slate-500\">· Reflection {index + 1} of {items.length}</span></strong>
          <p>
            {item.is_correct ? 'Correct response' : item.is_skipped ? 'Skipped question' : 'Incorrect response'}
            <span aria-hidden=\"true\"> · </span><Clock3 /> {item.time_spent_seconds || 0} sec
          </p>
        </div>
      </div>

      <div className=\"rounded-xl border border-slate-200 bg-slate-50/60 p-4\">
        <RichQuestionContent
          text={item.stem_text || undefined}
          latex={item.stem_latex || undefined}
          passageText={item.passage_text || undefined}
          imageUrl={item.question_image_url || undefined}
          imageAlt={`Question ${item.question_number || index + 1}`}
          textClassName=\"font-medium text-slate-950\"
        />
        <div className={`mt-4 grid gap-3 ${item.answers_released ? 'md:grid-cols-2' : ''}`}>
          <ReflectionAnswer title=\"Your answer\" value={item.response} item={item} attemptId={attemptId} tone=\"student\" />
          {item.answers_released && <ReflectionAnswer title=\"Correct answer\" value={item.correct_answer} item={item} attemptId={attemptId} tone=\"correct\" />}
        </div>
      </div>
"""
text = must_replace(text, old_summary, new_summary, "reflection question and answer context")
path.write_text(text)


# 3) Student-self analytics should use personal submitted evidence immediately.
# Cohort percentile fields inside that payload remain null until cohort evidence exists.
path = Path("src/components/analytics-v12/student-analytics-v12.tsx")
text = path.read_text()
old_loader = """    const { data, error: analyticsError } = await supabase.rpc('get_student_analytics_v12', {
      p_student_id: studentId,
      p_product_id: null,
      p_date_from: null,
      p_date_to: null,
    });
"""
new_loader = """    const analyticsResult = mode === 'student'
      ? await supabase.rpc('get_live_student_analytics_v12', {
          p_student_id: studentId,
          p_product_id: null,
          p_date_from: null,
          p_date_to: null,
        })
      : await supabase.rpc('get_student_analytics_v12', {
          p_student_id: studentId,
          p_product_id: null,
          p_date_from: null,
          p_date_to: null,
        });
    const { data, error: analyticsError } = analyticsResult;
"""
text = must_replace(text, old_loader, new_loader, "student self analytics evidence source")
path.write_text(text)

print('Applied live option labels, rich reflection context, and immediate student-self analytics.')
