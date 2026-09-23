"use client";
import { useMemo, useState } from "react";
import { BlockMath } from "react-katex";
import { CheckCircle2, Clock3, Flag, RotateCcw, XCircle } from "lucide-react";
import { trialQuestions } from "@/data/trialQuestions";

/**
 * Self-contained public trial test. Runs entirely client-side against the
 * bundled sample question set, so it works in demo builds without a backend.
 */
export function TrialTest() {
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [review, setReview] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const q = trialQuestions[index];

  const result = useMemo(() => {
    let correct = 0, wrong = 0, unanswered = 0;
    for (const item of trialQuestions) {
      const a = answers[item.id];
      if (a === undefined) unanswered++;
      else if (a === item.answer) correct++;
      else wrong++;
    }
    return {
      correct, wrong, unanswered,
      score: correct * 4 - wrong,
      total: trialQuestions.length * 4,
      percentage: Math.round(((correct * 4 - wrong) / (trialQuestions.length * 4)) * 100),
    };
  }, [answers]);

  function toggleReview() {
    setReview((current) => current.includes(q.id) ? current.filter((id) => id !== q.id) : [...current, q.id]);
  }

  function submitTest() {
    try {
      const old = JSON.parse(localStorage.getItem("rankmint_trial_history") || "[]") as unknown[];
      old.push({ date: new Date().toISOString(), score: result.score, total: result.total, percentage: result.percentage, correct: result.correct, wrong: result.wrong });
      localStorage.setItem("rankmint_trial_history", JSON.stringify(old.slice(-20)));
    } catch {
      // History is a convenience only.
    }
    setSubmitted(true);
  }

  function reset() { setStarted(false); setIndex(0); setAnswers({}); setReview([]); setSubmitted(false); }

  if (!started) {
    return (
      <section className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-[var(--ev-shadow-sm)] sm:p-10">
        <span className="inline-flex items-center rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[var(--teal)]">Free trial test</span>
        <h1 className="mt-4 text-3xl font-black text-[var(--foreground)] sm:text-4xl">Evidara mixed entrance trial test</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--muted-foreground)]">
          Eight sample questions demonstrate MCQs, LaTeX equations, scientific notation, image-based questions,
          navigation, review flags, evaluation and a basic result summary — exactly how Evidara delivers exams.
        </p>
        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] p-4"><strong className="text-[var(--foreground)]">8 questions</strong><p className="mt-1 text-sm text-[var(--muted-foreground)]">Physics, Chemistry, Mathematics, Biology</p></div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] p-4"><strong className="text-[var(--foreground)]">32 marks</strong><p className="mt-1 text-sm text-[var(--muted-foreground)]">+4 correct, −1 incorrect</p></div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] p-4"><strong className="text-[var(--foreground)]">Demo timer</strong><p className="mt-1 text-sm text-[var(--muted-foreground)]">30-minute display, untimed preview</p></div>
        </div>
        <button onClick={() => setStarted(true)} className="mt-8 h-12 w-full rounded-lg bg-[var(--teal)] text-sm font-semibold text-white transition-colors hover:bg-[var(--teal)]/90 sm:w-auto sm:px-10">Start trial test</button>
      </section>
    );
  }

  if (submitted) {
    return (
      <section>
        <div className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-[var(--ev-shadow-sm)] sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--teal)]">Trial result</p>
              <h1 className="mt-1 text-4xl font-black text-[var(--foreground)]">{result.score}/{result.total}</h1>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">{result.percentage}% score · saved to this browser&apos;s trial history</p>
            </div>
            <button onClick={reset} className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-5 py-2.5 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]">
              <RotateCcw className="h-4 w-4" /> Retake
            </button>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <ResultBox label="Correct" value={result.correct} tone="text-[var(--success)]" />
            <ResultBox label="Incorrect" value={result.wrong} tone="text-[var(--ev-error)]" />
            <ResultBox label="Unanswered" value={result.unanswered} tone="text-[var(--muted-foreground)]" />
            <ResultBox label="Accuracy" value={`${Math.round((result.correct / Math.max(1, result.correct + result.wrong)) * 100)}%`} tone="text-[var(--ev-info)]" />
          </div>
        </div>
        <div className="mt-5 grid gap-4">
          {trialQuestions.map((item, n) => {
            const a = answers[item.id];
            const correct = a === item.answer;
            return (
              <div key={item.id} className={`rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[var(--ev-shadow-xs)] sm:p-6 ${correct ? "border-l-4 border-l-[var(--success)]" : a === undefined ? "border-l-4 border-l-[var(--line)]" : "border-l-4 border-l-[var(--ev-error)]"}`}>
                <div className="flex items-center gap-2 font-semibold text-[var(--foreground)]">
                  {correct ? <CheckCircle2 className="h-5 w-5 text-[var(--success)]" /> : <XCircle className="h-5 w-5 text-[var(--ev-error)]" />}
                  Q{n + 1}. {item.subject}
                </div>
                <p className="mt-2 leading-7 text-[var(--foreground)]">{item.question}</p>
                {item.latex && <BlockMath math={item.latex} />}
                <p className="mt-2 text-[var(--foreground)]"><strong>Your answer:</strong> {a === undefined ? "Not answered" : item.options[a]}</p>
                <p className="mt-1 text-[var(--foreground)]"><strong>Correct answer:</strong> {item.options[item.answer]}</p>
                <div className="mt-3 rounded-xl bg-[var(--canvas)] p-4 text-sm leading-6 text-[var(--muted-foreground)]">
                  <strong className="text-[var(--foreground)]">Explanation:</strong> {item.explanation}
                  {item.explanationLatex && <BlockMath math={item.explanationLatex} />}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white shadow-[var(--ev-shadow-sm)]">
      <header className="flex items-center justify-between gap-3 rounded-t-2xl bg-[var(--midnight)] px-5 py-3.5 text-white sm:px-6">
        <strong className="text-sm font-semibold">Evidara trial test</strong>
        <span className="inline-flex items-center gap-2 text-sm font-bold"><Clock3 className="h-4 w-4" />29:59</span>
      </header>
      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[1fr_270px]">
        <section>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex rounded-full bg-[var(--ev-info-bg)] px-3 py-1 text-xs font-bold text-[var(--ev-info)]">{q.subject}</span>
            <span className="text-sm text-[var(--muted-foreground)]">Question {index + 1} of {trialQuestions.length} · +{q.marks}/−{q.negative}</span>
          </div>
          <h2 className="mt-5 text-lg font-semibold leading-8 text-[var(--foreground)] sm:text-xl">{q.question}</h2>
          {q.latex && <BlockMath math={q.latex} />}
          {q.image && <img src={q.image} alt="Question diagram" className="my-3 max-h-[290px] w-full rounded-xl border border-[var(--line)] object-contain" />}
          <div className="mt-4 grid gap-2.5">
            {q.options.map((option, i) => {
              const selected = answers[q.id] === i;
              return (
                <button
                  key={option}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
                  className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-left font-medium transition-colors ${selected ? "border-[var(--amber)] bg-[#FFFBEB] text-[var(--foreground)]" : "border-[var(--line)] bg-white text-[var(--foreground)] hover:bg-[var(--canvas)]"}`}
                >
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${selected ? "bg-[var(--amber)] text-white" : "bg-[var(--muted)] text-[var(--muted-foreground)]"}`}>{String.fromCharCode(65 + i)}</span>
                  {option}
                </button>
              );
            })}
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <button onClick={toggleReview} className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]">
              <Flag className="h-4 w-4" />{review.includes(q.id) ? "Remove review" : "Mark for review"}
            </button>
            <div className="flex gap-2.5">
              <button disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))} className="rounded-lg border border-[var(--line)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
              {index < trialQuestions.length - 1
                ? <button onClick={() => setIndex((i) => i + 1)} className="rounded-lg bg-[var(--teal)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--teal)]/90">Save &amp; next</button>
                : <button onClick={submitTest} className="rounded-lg bg-[var(--midnight)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--midnight)]/90">Submit test</button>}
            </div>
          </div>
        </section>
        <aside className="h-fit rounded-xl border border-[var(--line)] bg-[var(--canvas)] p-4 lg:sticky lg:top-24">
          <h3 className="font-bold text-[var(--foreground)]">Question palette</h3>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {trialQuestions.map((item, i) => {
              const answered = answers[item.id] !== undefined;
              const flagged = review.includes(item.id);
              return (
                <button key={item.id} onClick={() => setIndex(i)} aria-label={`Go to question ${i + 1}`} className={`grid h-10 place-items-center rounded-lg border font-bold text-sm transition-colors ${index === i ? "border-2 border-[var(--midnight)]" : "border-[var(--line)]"} ${flagged ? "bg-[#EDE9FE] text-[var(--foreground)]" : answered ? "bg-[var(--ev-success-bg)] text-[var(--foreground)]" : "bg-white text-[var(--muted-foreground)]"}`}>{i + 1}</button>
              );
            })}
          </div>
          <div className="mt-4 grid gap-1.5 text-xs text-[var(--muted-foreground)]">
            <span>Green: answered</span>
            <span>Purple: marked for review</span>
            <span>White: unanswered</span>
          </div>
          <button onClick={submitTest} className="mt-4 w-full rounded-lg bg-[var(--midnight)] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--midnight)]/90">Submit now</button>
        </aside>
      </div>
    </div>
  );
}

function ResultBox({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">{label}</p>
      <p className={`mt-1.5 text-2xl font-black ${tone}`}>{value}</p>
    </div>
  );
}
