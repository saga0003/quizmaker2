'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BlockMath, InlineMath } from 'react-katex';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Expand,
  LoaderCircle,
  LockKeyhole,
  Save,
  Send,
  ShieldCheck,
  Wifi,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';
import { normalizeEvidaraRole } from '@/lib/roles';
import type { AttemptPayload, AttemptResult } from '@/types/papers';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function hash(value: string) {
  let output = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    output ^= value.charCodeAt(index);
    output = Math.imul(output, 16777619);
  }
  return output >>> 0;
}

function secondsText(seconds: number) {
  const hours = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const remainingSeconds = String(seconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${remainingSeconds}`;
}

export function LiveExam() {
  const { profile } = useAuth();
  const superAdminInspection = normalizeEvidaraRole(profile?.role) === 'super_admin';
  const [payload, setPayload] = useState<AttemptPayload | null>(null);
  const [current, setCurrent] = useState(0);
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [review, setReview] = useState<Record<string, boolean>>({});
  const [visited, setVisited] = useState<Record<string, boolean>>({});
  const [remaining, setRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveText, setSaveText] = useState('Ready');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [securityNotice, setSecurityNotice] = useState('');
  const enteredFullscreen = useRef(false);
  const submittingRef = useRef(false);
  const questionOpenedAt = useRef(Date.now());
  const lastSecurityEvent = useRef(0);

  useEffect(() => {
    const attempt = new URLSearchParams(window.location.search).get('attempt');
    if (!attempt) {
      setError('Attempt ID is missing.');
      setLoading(false);
      return;
    }
    void load(attempt);
  }, []);

  async function load(attempt: string) {
    if (!supabase) {
      setError('Connect Supabase to take this test.');
      setLoading(false);
      return;
    }

    const { data, error: loadError } = await supabase.rpc('get_exam_attempt_payload', {
      p_attempt_id: attempt,
    });
    if (loadError) {
      setError(loadError.message);
      setLoading(false);
      return;
    }

    const value = data as AttemptPayload;
    const initialResponses: Record<string, unknown> = {};
    const initialReview: Record<string, boolean> = {};
    const initialVisited: Record<string, boolean> = {};
    value.responses.forEach((item) => {
      initialResponses[item.paper_question_id] = item.response;
      initialReview[item.paper_question_id] = item.marked_for_review;
      initialVisited[item.paper_question_id] = item.visited;
    });

    setPayload(value);
    setResponses(initialResponses);
    setReview(initialReview);
    setVisited({ ...initialVisited, [value.questions[0]?.paper_question_id]: true });
    setRemaining(Math.max(0, Math.floor((new Date(value.expires_at).getTime() - Date.now()) / 1000)));
    setLoading(false);
  }

  useEffect(() => {
    if (!payload || result) return;
    const timer = window.setInterval(() => {
      const seconds = Math.max(0, Math.floor((new Date(payload.expires_at).getTime() - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds === 0 && !submittingRef.current) {
        submittingRef.current = true;
        void submit(true);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [payload, result]);

  useEffect(() => {
    if (!payload || payload.status !== 'in_progress') return;
    const record = (eventType: string) => supabase?.rpc('record_exam_event', {
      p_attempt_id: payload.attempt_id,
      p_event_type: eventType,
      p_metadata: { at: new Date().toISOString() },
    });
    const hidden = () => { if (document.hidden) void record('tab_hidden'); };
    const blur = () => { void record('window_blur'); };
    const fullscreen = () => {
      if (!document.fullscreenElement && enteredFullscreen.current) void record('fullscreen_exit');
    };

    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('blur', blur);
    document.addEventListener('fullscreenchange', fullscreen);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('blur', blur);
      document.removeEventListener('fullscreenchange', fullscreen);
    };
  }, [payload]);

  useEffect(() => {
    if (!payload || result || superAdminInspection) return;

    const recordProtectionAttempt = (eventType: string) => {
      const now = Date.now();
      if (now - lastSecurityEvent.current < 800) return;
      lastSecurityEvent.current = now;
      setSecurityNotice('Assessment content is protected. Copying, saving, dragging and printing are disabled during the test.');
      window.setTimeout(() => setSecurityNotice(''), 2600);
      void supabase?.rpc('record_exam_event', {
        p_attempt_id: payload.attempt_id,
        p_event_type: eventType,
        p_metadata: { at: new Date().toISOString(), protected_content: true },
      });
    };

    const prevent = (event: Event, eventType: string) => {
      event.preventDefault();
      recordProtectionAttempt(eventType);
    };
    const contextMenu = (event: MouseEvent) => prevent(event, 'content_context_menu_blocked');
    const copy = (event: ClipboardEvent) => prevent(event, 'content_copy_blocked');
    const cut = (event: ClipboardEvent) => prevent(event, 'content_cut_blocked');
    const drag = (event: DragEvent) => prevent(event, 'content_drag_blocked');
    const select = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, [contenteditable="true"]')) return;
      prevent(event, 'content_selection_blocked');
    };
    const keydown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const modifier = event.ctrlKey || event.metaKey;
      const target = event.target as HTMLElement | null;
      const editingAnswer = Boolean(target?.matches('input, textarea, [contenteditable="true"]'));
      const blockedModifierKey = modifier && (
        ['c', 'x', 's', 'p', 'u'].includes(key)
        || (!editingAnswer && key === 'a')
        || (event.shiftKey && ['i', 'j', 'c'].includes(key))
      );
      if (!blockedModifierKey && key !== 'f12' && key !== 'printscreen') return;
      event.preventDefault();
      event.stopPropagation();
      recordProtectionAttempt(key === 'printscreen' ? 'screenshot_key_detected' : 'protected_shortcut_blocked');
    };

    document.addEventListener('contextmenu', contextMenu, true);
    document.addEventListener('copy', copy, true);
    document.addEventListener('cut', cut, true);
    document.addEventListener('dragstart', drag, true);
    document.addEventListener('selectstart', select, true);
    window.addEventListener('keydown', keydown, true);
    return () => {
      document.removeEventListener('contextmenu', contextMenu, true);
      document.removeEventListener('copy', copy, true);
      document.removeEventListener('cut', cut, true);
      document.removeEventListener('dragstart', drag, true);
      document.removeEventListener('selectstart', select, true);
      window.removeEventListener('keydown', keydown, true);
    };
  }, [payload, result, superAdminInspection]);

  const question = payload?.questions[current];

  useEffect(() => {
    questionOpenedAt.current = Date.now();
    if (question) {
      setVisited((previous) => ({ ...previous, [question.paper_question_id]: true }));
    }
  }, [current, question?.paper_question_id]);

  const orderedOptions = useMemo(() => {
    if (!question) return [];
    const values = [...(question.options || [])];
    if (payload?.paper.shuffle_options) {
      values.sort((a, b) =>
        hash(`${payload.attempt_id}-${question.paper_question_id}-${a.option_key}`)
        - hash(`${payload.attempt_id}-${question.paper_question_id}-${b.option_key}`),
      );
    } else {
      values.sort((a, b) => a.display_order - b.display_order);
    }
    return values;
  }, [payload, question]);

  function answerArray(value: unknown) {
    if (Array.isArray(value)) return value.map(String);
    if (value === null || value === undefined || value === '') return [];
    return [String(value)];
  }

  async function saveAnswer(nextValue: unknown, nextReview = review[question?.paper_question_id || ''] || false) {
    if (!payload || !question || !supabase) return;
    setSaving(true);
    setSaveText('Saving…');
    const elapsed = Math.floor((Date.now() - questionOpenedAt.current) / 1000);
    const { error: saveError } = await supabase.rpc('save_exam_response', {
      p_attempt_id: payload.attempt_id,
      p_paper_question_id: question.paper_question_id,
      p_response: nextValue === undefined ? null : nextValue,
      p_marked_for_review: nextReview,
      p_time_spent_seconds: elapsed,
    });
    if (saveError) {
      setError(saveError.message);
      setSaveText('Save failed');
    } else {
      setSaveText('Saved');
    }
    setSaving(false);
  }

  async function selectOption(key: string) {
    if (!question) return;
    const currentValue = answerArray(responses[question.paper_question_id]);
    const next = question.question_type === 'multiple_correct'
      ? currentValue.includes(key)
        ? currentValue.filter((value) => value !== key)
        : [...currentValue, key]
      : [key];
    setResponses((previous) => ({ ...previous, [question.paper_question_id]: next }));
    await saveAnswer(next);
  }

  function setNumeric(value: string) {
    if (!question) return;
    setResponses((previous) => ({ ...previous, [question.paper_question_id]: value }));
    setSaveText('Unsaved');
  }

  async function commitNumeric() {
    if (!question) return;
    await saveAnswer(responses[question.paper_question_id] ?? null);
  }

  async function toggleReview() {
    if (!question) return;
    const next = !review[question.paper_question_id];
    setReview((previous) => ({ ...previous, [question.paper_question_id]: next }));
    await saveAnswer(responses[question.paper_question_id] ?? null, next);
  }

  function go(index: number) {
    if (index < 0 || !payload || index >= payload.questions.length) return;
    if (question && (question.question_type === 'numerical' || question.question_type === 'integer')) {
      void commitNumeric();
    }
    setCurrent(index);
  }

  async function submit(automatic = false) {
    if (!payload || !supabase || submitting) return;
    setSubmitDialogOpen(false);
    setSubmitting(true);
    submittingRef.current = true;
    setError('');
    if (question && (question.question_type === 'numerical' || question.question_type === 'integer')) {
      await commitNumeric();
    }
    const { data, error: submitError } = await supabase.rpc('submit_exam_attempt', {
      p_attempt_id: payload.attempt_id,
    });
    if (submitError) {
      setError(submitError.message);
      setSubmitting(false);
      submittingRef.current = false;
      return;
    }
    setResult(data as AttemptResult);
    setSubmitting(false);
    if (automatic) setSaveText('Time completed');
  }

  async function enterFullscreen() {
    try {
      await document.documentElement.requestFullscreen();
      enteredFullscreen.current = true;
      await supabase?.rpc('record_exam_event', {
        p_attempt_id: payload?.attempt_id,
        p_event_type: 'fullscreen_enter',
        p_metadata: {},
      });
    } catch {
      setError('Fullscreen could not be started. Continue in the current window.');
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', color: '#667085' }}>
        <div style={{ textAlign: 'center' }}><LoaderCircle className="spin" size={30} /><h3>Preparing secure test session…</h3></div>
      </div>
    );
  }
  if (error && !payload) {
    return <div className="rm-card" style={{ padding: 30, maxWidth: 700, margin: '40px auto', color: '#b42318' }}>{error}</div>;
  }
  if (result) {
    return (
      <div className="rm-card" style={{ padding: 32, maxWidth: 720, margin: '35px auto', textAlign: 'center' }}>
        <CheckCircle2 size={52} color="#137a3a" />
        <h1>Test submitted</h1>
        <p style={{ color: '#667085' }}>Your answers and result have been stored.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 20 }}>
          {[
            ['Score', `${result.score}/${result.maximum_marks}`],
            ['Percentage', `${result.percentage}%`],
            ['Correct', result.correct_count],
            ['Incorrect', result.incorrect_count],
          ].map(([label, value]) => (
            <div key={String(label)} style={{ padding: 14, background: '#f8fafc', borderRadius: 12 }}>
              <strong style={{ fontSize: 22 }}>{String(value)}</strong>
              <div style={{ fontSize: 12, color: '#667085' }}>{String(label)}</div>
            </div>
          ))}
        </div>
        <a className="rm-btn-primary" href="/student/results/" style={{ marginTop: 22 }}>View my results</a>
      </div>
    );
  }
  if (!payload || !question) return <div>No questions were found in this test.</div>;

  const currentAnswer = responses[question.paper_question_id];
  const answerKeys = answerArray(currentAnswer);
  const answeredCount = payload.questions.filter((item) => answerArray(responses[item.paper_question_id]).length > 0).length;

  return (
    <div
      className={superAdminInspection ? '' : 'secure-exam-content'}
      style={{ minHeight: '100vh', background: '#eef1f6', userSelect: superAdminInspection ? 'auto' : 'none' }}
      onContextMenu={superAdminInspection ? undefined : (event) => event.preventDefault()}
    >
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: '#131e35', color: 'white', padding: '12px 18px', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <strong>{payload.paper.title}</strong>
          <div style={{ fontSize: 11, color: '#c6d0e0' }}>{payload.paper.exam_type} · Attempt autosaves</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid rgba(255,255,255,.18)', borderRadius: 999, padding: '6px 9px', fontSize: 11, color: superAdminInspection ? '#ffd970' : '#c6f6d5' }}>
            {superAdminInspection ? <ShieldCheck size={14} /> : <LockKeyhole size={14} />}
            {superAdminInspection ? 'Super Admin inspection mode' : 'Protected assessment content'}
          </span>
          <button className="rm-btn-secondary" style={{ padding: '8px 10px' }} onClick={() => void enterFullscreen()}><Expand size={15} />Fullscreen</button>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: saving ? '#ffd970' : '#c6f6d5', fontSize: 12 }}>
            {saving ? <LoaderCircle className="spin" size={14} /> : <Wifi size={14} />} {saveText}
          </span>
          <strong style={{ fontSize: 20, color: remaining < 300 ? '#ffb4ab' : '#ffd970' }}><Clock3 size={18} /> {secondsText(remaining)}</strong>
        </div>
      </header>

      {securityNotice && <div style={{ padding: 10, background: '#fff8e6', color: '#775600', textAlign: 'center', fontSize: 13 }}><LockKeyhole size={15} /> {securityNotice}</div>}
      {error && <div style={{ padding: 10, background: '#fef3f2', color: '#b42318', textAlign: 'center' }}><AlertTriangle size={15} /> {error}</div>}

      <div className="exam-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 15, padding: 15, maxWidth: 1500, margin: 'auto' }}>
        <main className="rm-card" style={{ padding: 22, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid #e4e7ec', paddingBottom: 13 }}>
            <div>
              <span className="rm-label">Question {current + 1} of {payload.questions.length}</span>
              <div style={{ fontSize: 12, color: '#667085', marginTop: 5 }}>{payload.sections.find((section) => section.id === question.section_id)?.title || 'Section'} · {question.question_type.replaceAll('_', ' ')} · {question.difficulty.replaceAll('_', ' ')}</div>
            </div>
            <strong style={{ color: '#775600' }}>+{question.marks} / −{question.negative_marks}</strong>
          </div>

          {question.passage_text && <div style={{ marginTop: 16, padding: 15, borderLeft: '4px solid #f6b100', background: '#fffaf0', whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>{question.passage_text}</div>}
          <h2 style={{ fontSize: 20, lineHeight: 1.6, marginTop: 18 }}>{question.stem_text}</h2>
          {question.stem_latex && <div style={{ overflowX: 'auto' }}><BlockMath math={question.stem_latex} /></div>}
          {question.question_image_url && (
            <div style={{ position: 'relative', margin: '14px auto', maxWidth: '100%', width: 'fit-content' }}>
              <img src={question.question_image_url} alt="Question diagram" draggable={false} style={{ display: 'block', maxWidth: '100%', maxHeight: 380, objectFit: 'contain', borderRadius: 12, pointerEvents: 'none', userSelect: 'none' }} />
              <span aria-hidden="true" style={{ position: 'absolute', inset: 0 }} />
            </div>
          )}

          {question.question_type === 'numerical' || question.question_type === 'integer' ? (
            <div style={{ marginTop: 20, maxWidth: 380 }}>
              <span className="rm-label">Enter numerical answer</span>
              <input type="number" step="any" className="rm-input" value={String(currentAnswer ?? '')} onChange={(event) => setNumeric(event.target.value)} onBlur={() => void commitNumeric()} placeholder="Your answer" style={{ marginTop: 7, fontSize: 18, userSelect: 'text' }} />
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
              {orderedOptions.map((option) => {
                const checked = answerKeys.includes(option.option_key);
                return (
                  <button key={option.option_key} onClick={() => void selectOption(option.option_key)} style={{ display: 'grid', gridTemplateColumns: '38px 1fr', gap: 10, alignItems: 'center', textAlign: 'left', padding: 13, borderRadius: 12, border: checked ? '2px solid #f6b100' : '1px solid #dfe4ec', background: checked ? '#fff8e6' : 'white' }}>
                    <span style={{ width: 32, height: 32, borderRadius: question.question_type === 'multiple_correct' ? 8 : 999, display: 'grid', placeItems: 'center', background: checked ? '#f6b100' : '#f2f4f7', fontWeight: 800 }}>{option.option_key}</span>
                    <span>
                      {option.content_text}
                      {option.content_latex && <span style={{ marginLeft: 6 }}><InlineMath math={option.content_latex} /></span>}
                      {option.image_url && (
                        <span style={{ position: 'relative', display: 'block', width: 'fit-content', marginTop: 8 }}>
                          <img src={option.image_url} alt={`Option ${option.option_key}`} draggable={false} style={{ display: 'block', maxWidth: 260, maxHeight: 150, objectFit: 'contain', pointerEvents: 'none', userSelect: 'none' }} />
                          <span aria-hidden="true" style={{ position: 'absolute', inset: 0 }} />
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 9, marginTop: 24, flexWrap: 'wrap' }}>
            <button className="rm-btn-secondary" onClick={() => go(current - 1)} disabled={current === 0}><ChevronLeft size={17} />Previous</button>
            <button className="rm-btn-secondary" onClick={() => void toggleReview()} style={{ background: review[question.paper_question_id] ? '#f4ebff' : 'white', color: review[question.paper_question_id] ? '#6941c6' : '#131e35' }}>Mark for review</button>
            <button className="rm-btn-primary" onClick={() => go(current + 1)} disabled={current === payload.questions.length - 1}>Save & next<ChevronRight size={17} /></button>
          </div>
        </main>

        <aside className="rm-card" style={{ padding: 16, height: 'fit-content', position: 'sticky', top: 86 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>Question palette</strong><span style={{ fontSize: 12, color: '#667085' }}>{answeredCount}/{payload.questions.length} answered</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 7, marginTop: 12 }}>
            {payload.questions.map((item, index) => {
              const answered = answerArray(responses[item.paper_question_id]).length > 0;
              const marked = review[item.paper_question_id];
              const seen = visited[item.paper_question_id];
              return <button key={item.paper_question_id} onClick={() => go(index)} style={{ aspectRatio: '1', borderRadius: 9, border: index === current ? '3px solid #131e35' : '1px solid #d0d5dd', background: marked ? '#f4ebff' : answered ? '#ecfdf3' : seen ? '#fff8e6' : 'white', color: marked ? '#6941c6' : answered ? '#137a3a' : '#475467', fontWeight: 800 }}>{index + 1}</button>;
            })}
          </div>
          <div style={{ display: 'grid', gap: 6, fontSize: 11, color: '#667085', marginTop: 14 }}>
            <span><i style={{ display: 'inline-block', width: 10, height: 10, background: '#ecfdf3', marginRight: 5 }} />Answered</span>
            <span><i style={{ display: 'inline-block', width: 10, height: 10, background: '#f4ebff', marginRight: 5 }} />Review</span>
            <span><i style={{ display: 'inline-block', width: 10, height: 10, background: '#fff8e6', marginRight: 5 }} />Visited</span>
          </div>
          <button className="rm-btn-dark" style={{ width: '100%', marginTop: 18 }} disabled={submitting} onClick={() => setSubmitDialogOpen(true)}>{submitting ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />}Submit test</button>
          <div style={{ fontSize: 11, color: '#667085', marginTop: 10, textAlign: 'center' }}><Save size={12} /> Answers are stored in Supabase.</div>
        </aside>
      </div>

      <AlertDialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <AlertDialogContent className="overflow-hidden border-[#E7ECEB] p-0 sm:max-w-lg">
          <div className="bg-[#131E35] px-6 py-5 text-white">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F6B100] text-[#131E35]"><Send className="h-5 w-5" /></div>
            <AlertDialogHeader className="mt-4 text-left">
              <AlertDialogTitle className="text-xl text-white">Submit this test now?</AlertDialogTitle>
              <AlertDialogDescription className="text-[#DCE9E7]">You have answered {answeredCount} of {payload.questions.length} questions. Answers cannot be changed after final submission.</AlertDialogDescription>
            </AlertDialogHeader>
          </div>
          <div className="px-6 py-5">
            <div className="rounded-xl border border-[#E7ECEB] bg-[#F7F9F7] p-4 text-sm text-[#475467]">
              Marked for review: <strong className="text-[#6941C6]">{Object.values(review).filter(Boolean).length}</strong><br />
              Unanswered: <strong className="text-[#B54747]">{payload.questions.length - answeredCount}</strong>
            </div>
          </div>
          <AlertDialogFooter className="border-t border-[#E7ECEB] px-6 py-4">
            <AlertDialogCancel>Continue test</AlertDialogCancel>
            <Button type="button" onClick={() => void submit(false)} disabled={submitting} className="bg-[#0E5A5A] text-white hover:bg-[#0A4747]">
              {submitting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Submit final answers
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <style>{`@media(max-width:850px){.exam-layout{grid-template-columns:1fr!important}.exam-layout aside{position:relative!important;top:0!important}.exam-layout aside div:nth-child(2){grid-template-columns:repeat(8,1fr)!important}}@media(max-width:500px){.exam-layout{padding:8px!important}.exam-layout main{padding:15px!important}.exam-layout aside div:nth-child(2){grid-template-columns:repeat(5,1fr)!important}}.secure-exam-content img{-webkit-user-drag:none}.secure-exam-content *:not(input):not(textarea){-webkit-touch-callout:none}`}</style>
    </div>
  );
}
