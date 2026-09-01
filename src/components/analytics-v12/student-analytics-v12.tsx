'use client';

import { useEffect, useMemo, useState, type ReactNode, type CSSProperties } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CalendarDays,
  ChevronDown,
  CheckCircle2,
  Clock3,
  Eye,
  Gauge,
  History,
  Layers3,
  ListChecks,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
  BookOpen,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { useAppStore, type AppView } from '@/store/use-app-store';
import type {
  AnalyticsDirectoryStudent,
  AnalyticsPriority,
  AnalyticsTaxonomyRow,
  AnalyticsV12Payload,
  AnalyticsV12View,
} from '@/types/analytics-v12';

const BRAND = '#0C6969';
const AMBER = '#D97706';
const GREEN = '#16A34A';
const RED = '#DC2626';
const BLUE = '#2563EB';
const MUTED = '#94A3B8';

const difficultyLabels: Record<string, string> = {
  very_easy: 'Very easy',
  easy: 'Easy',
  moderate: 'Moderate',
  difficult: 'Difficult',
  very_difficult: 'Very difficult',
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number | null | undefined, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function emptyPayload(studentId = ''): AnalyticsV12Payload {
  return {
    student: {
      id: studentId,
      full_name: 'Student',
      organization_id: null,
      organization_name: null,
      academic_year: null,
      grade: null,
      section_name: null,
    },
    summary: {
      completed_tests: 0,
      total_questions: 0,
      average_percentage: 0,
      accuracy: 0,
      percentile: null,
      percentile_available: false,
      completion_rate: 0,
      time_management_score: null,
      time_management_label: 'Building evidence',
      average_response_seconds: null,
      cohort_median_seconds: null,
      pace_ratio: null,
      consistency_score: null,
      assessed_subjects: 0,
      assessed_chapters: 0,
      assessed_topics: 0,
      trend_delta: null,
    },
    trend: [],
    subjects: [],
    chapters: [],
    topics: [],
    priorities: [],
    history: [],
    review_queue: [],
    chapter_error_breakdown: [],
    evidence_policy: {
      semantic_error_types: false,
      confidence_self_rating: false,
      misconception_tags: false,
      automatic_sources: ['Submitted test outcomes', 'Response timing', 'Question taxonomy', 'Recent assessment trends'],
    },
    generated_at: new Date().toISOString(),
  };
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function metricValue(value: number | null, suffix = '') {
  return value === null ? '—' : `${round(value, value % 1 ? 1 : 0)}${suffix}`;
}

function EmptyState({ title, copy }: { title: string; copy: string }) {
  return <div className="analytics-v12-empty"><BarChart3 /><strong>{title}</strong><p>{copy}</p></div>;
}

function MetricCard({ icon, tone, label, value, copy, delta }: { icon: ReactNode; tone: string; label: string; value: ReactNode; copy: string; delta?: number | null }) {
  return <article className="analytics-v12-metric-card">
    <div className={`analytics-v12-metric-icon ${tone}`}>{icon}</div>
    <div className="analytics-v12-metric-body">
      <div className="analytics-v12-metric-label">{label}</div>
      <div className="analytics-v12-metric-value">{value}</div>
      <div className="analytics-v12-metric-copy">{copy}</div>
      {delta !== undefined && delta !== null && <div className={`analytics-v12-delta ${delta < 0 ? 'down' : ''}`}>{delta < 0 ? <TrendingDown /> : <TrendingUp />} {Math.abs(round(delta, 1) || 0)} points vs previous period</div>}
    </div>
  </article>;
}

function formatTaxonomyTime(value: number | null) {
  if (value === null || value === undefined) return '—';
  const rounded = Math.max(0, Math.round(value));
  if (rounded < 60) return `${rounded}s`;
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

function MasteryRows({ rows, onSelect }: { rows: AnalyticsTaxonomyRow[]; onSelect?: (row: AnalyticsTaxonomyRow) => void }) {
  if (!rows.length) return <EmptyState title="No evidence yet" copy="This view will populate after completed tests contain matching taxonomy." />;
  return <div className="analytics-v12-mastery-list">{rows.map((row) => {
    const attempted = row.correct + row.incorrect;
    const accuracy = attempted > 0 ? metricValue(row.accuracy, '%') : '—';
    const scorePercentage = row.questions > 0 && row.average_percentage !== null && row.average_percentage !== undefined
      ? metricValue(row.average_percentage, '%')
      : '—';
    const trend = row.trend_delta === null
      ? '—'
      : `${row.trend_delta >= 0 ? '▲' : '▼'} ${Math.abs(round(row.trend_delta, 1) || 0)} pts`;
    return <button type="button" key={row.id} className="analytics-v12-mastery-row" onClick={() => onSelect?.(row)} disabled={!onSelect}>
      <span className="analytics-v12-mastery-head">
        <span className="analytics-v12-mastery-name">{row.name}</span>
        <span className="analytics-v12-bar-track" aria-label={`Accuracy ${accuracy}`}><span className={`analytics-v12-bar-fill ${attempted > 0 && row.accuracy < 70 ? 'attention' : ''}`} style={{ width: `${attempted > 0 ? clamp(row.accuracy) : 0}%` }} /></span>
      </span>
      <span className="analytics-v12-mastery-metrics">
        <span><small>Exposure</small><strong>{row.questions}</strong></span>
        <span><small>Attempted</small><strong>{attempted}</strong></span>
        <span><small>Correct</small><strong>{row.correct}</strong></span>
        <span><small>Incorrect</small><strong>{row.incorrect}</strong></span>
        <span><small>Unanswered</small><strong>{row.unanswered}</strong></span>
        <span><small>Accuracy</small><strong>{accuracy}</strong></span>
        <span><small>Score %</small><strong>{scorePercentage}</strong></span>
        <span><small>Time</small><strong>{formatTaxonomyTime(row.average_seconds)}</strong></span>
        <span><small>Trend</small><strong className={`analytics-v12-mini-trend ${(row.trend_delta || 0) < 0 ? 'down' : ''}`}>{trend}</strong></span>
        <span><small>Evidence</small><strong>{row.attempts}</strong></span>
      </span>
    </button>;
  })}</div>;
}

function PriorityList({ rows }: { rows: AnalyticsPriority[] }) {
  if (!rows.length) return <EmptyState title="No urgent priorities" copy="No taxonomy area currently meets the evidence threshold for revision." />;
  return <div className="analytics-v12-priority-list">{rows.map((row) => <article key={`${row.rank}-${row.topic_id || row.chapter_id}`} className={`analytics-v12-priority-card ${row.level}`}>
    <div className="analytics-v12-priority-rank">{row.rank}</div>
    <div className="analytics-v12-priority-copy">
      <div className="analytics-v12-priority-heading"><div><small>{row.subject_name} · {row.chapter_name || 'General'}</small><h3>{row.topic_name || row.chapter_name || row.subject_name}</h3></div><span>{round(row.accuracy)}% accuracy</span></div>
      <div className="analytics-v12-priority-reasons">{row.reasons.map((reason) => <span key={reason}>{reason}</span>)}</div>
      <p>{row.action}</p>
      <div className="analytics-v12-priority-evidence"><span>{row.questions} questions</span><span>{round(row.unanswered_rate)}% unanswered</span><span>{row.pace_ratio ? `${round(row.pace_ratio, 2)}× cohort pace` : 'Pace unavailable'}</span></div>
    </div>
  </article>)}</div>;
}

type OverviewMetricMode = 'marks' | 'percentage' | 'percentile';

function analyticsDateRange(payload: AnalyticsV12Payload) {
  const dates = payload.trend.map((row) => new Date(row.submitted_at)).filter((date) => !Number.isNaN(date.getTime())).sort((a, b) => a.getTime() - b.getTime());
  if (!dates.length) return 'No completed tests yet';
  const first = dates[0];
  const last = dates[dates.length - 1];
  const short = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${short.format(first)} – ${short.format(last)}`;
}

function AnalyticsHeader({ payload, mode, directory, selectedStudent, onStudentChange, metricMode, onMetricModeChange, title, subtitle, showStudentSelector = true }: {
  payload: AnalyticsV12Payload;
  mode: 'student' | 'school';
  directory: AnalyticsDirectoryStudent[];
  selectedStudent: string;
  onStudentChange: (value: string) => void;
  metricMode: OverviewMetricMode;
  onMetricModeChange: (value: OverviewMetricMode) => void;
  title?: string;
  subtitle?: string;
  showStudentSelector?: boolean;
}) {
  return <>
    <section className="analytics-v12-topbar">
      <div className="analytics-v12-title-wrap">
        <h1>{title || `How ${mode === 'student' ? 'you performed' : `${payload.student.full_name} performed`}`}</h1>
        <p>{subtitle || (payload.summary.completed_tests
          ? `${mode === 'student' ? 'Your' : `${payload.student.full_name || 'Student'}’s`} performance summary across ${payload.summary.assessed_subjects || payload.subjects.length} subjects`
          : 'No submitted assessment evidence is available yet. Complete more tests to build this view.')}</p>
      </div>
      <div className="analytics-v12-filters">
        {mode === 'school' && showStudentSelector && <label className="analytics-v12-reference-select"><span className="sr-only">Student</span><select value={selectedStudent} onChange={(event) => onStudentChange(event.target.value)}>{directory.map((student) => <option key={student.student_id} value={student.student_id}>{student.full_name}{student.grade ? ` · Grade ${student.grade}` : ''}</option>)}</select><ChevronDown /></label>}
        <label className="analytics-v12-reference-select analytics-v12-series-select"><span className="sr-only">Test series</span><select aria-label="Test series"><option>All completed tests</option></select><ChevronDown /></label>
        <div className="analytics-v12-date-control"><CalendarDays /><span>{analyticsDateRange(payload)}</span><ChevronDown /></div>
      </div>
    </section>
    <div className="analytics-v12-mode-switch" role="group" aria-label="Analytics display mode">
      {(['marks', 'percentage', 'percentile'] as const).map((item) => <button key={item} type="button" className={metricMode === item ? 'active' : ''} onClick={() => onMetricModeChange(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}
    </div>
  </>;
}

function OverviewView({ payload, metricMode, openInsights, openSubject }: {
  payload: AnalyticsV12Payload;
  metricMode: OverviewMetricMode;
  openInsights: () => void;
  openSubject: (subjectId: string) => void;
}) {
  if (payload.summary.completed_tests === 0) {
    return (
      <section className="analytics-v12-section-card analytics-v12-no-evidence">
        <EmptyState
          title="Not enough data yet"
          copy="Complete a published test to start building your performance history. Evidara will not substitute benchmark students, synthetic percentiles, or fabricated recommendations."
        />
      </section>
    );
  }

  const totalMarks = payload.history.reduce((sum, row) => sum + Number(row.score || 0), 0);
  const totalMaximum = payload.history.reduce((sum, row) => sum + Number(row.maximum_marks || 0), 0);
  const overallValue: ReactNode = metricMode === 'marks' && totalMaximum > 0
    ? <>{round(totalMarks)} <small>/ {round(totalMaximum)}</small></>
    : metricMode === 'percentile'
      ? (payload.summary.percentile_available ? metricValue(payload.summary.percentile) : '—')
      : metricValue(payload.summary.average_percentage, '%');
  const overallLabel = metricMode === 'marks' ? 'Overall Score' : metricMode === 'percentile' ? 'Overall Percentile' : 'Overall Score';
  const subjectChart = payload.subjects.map((row) => ({
    id: row.id,
    subject: row.name,
    score: round(row.accuracy),
    average: row.average_percentage === null || row.average_percentage === undefined ? null : round(row.average_percentage),
  }));
  const trendChart = payload.trend.map((row) => ({
    ...row,
    cohortAverage: row.cohort_average_percentage ?? null,
  }));
  const hasSubjectAverage = subjectChart.some((row) => row.average !== null);
  const hasTrendAverage = trendChart.some((row) => row.cohortAverage !== null);

  return <>
    <section className="analytics-v12-metrics">
      <MetricCard icon={<Target />} tone="green" label={overallLabel} value={overallValue} copy={payload.summary.completed_tests ? 'Good effort!' : 'Complete a test to begin'} delta={payload.summary.trend_delta} />
      <MetricCard icon={<BarChart3 />} tone="amber" label="Percentile" value={payload.summary.percentile_available ? metricValue(payload.summary.percentile) : '—'} copy={payload.summary.percentile_available ? `You are ahead of ${round(payload.summary.percentile)}% students` : 'Available after enough comparable attempts'} />
      <MetricCard icon={<CheckCircle2 />} tone="green" label="Accuracy" value={metricValue(payload.summary.accuracy, '%')} copy={payload.summary.accuracy >= 75 ? 'Good accuracy' : 'Keep improving'} />
      <MetricCard icon={<Clock3 />} tone="amber" label={payload.summary.time_management_score === null ? 'Average Pace' : 'Time Management'} value={payload.summary.time_management_score === null ? <>{metricValue(payload.summary.average_response_seconds)} <small>sec / Q</small></> : <>{metricValue(payload.summary.time_management_score)} <small>/ 10</small></>} copy={payload.summary.time_management_score === null ? 'Based on recorded question time' : payload.summary.time_management_label} />
    </section>

    <section className="analytics-v12-charts-grid">
      <article className="analytics-v12-panel">
        <div className="analytics-v12-panel-head"><h3>Performance profile</h3><span className="analytics-v12-panel-mode">{metricMode[0].toUpperCase() + metricMode.slice(1)}</span></div>
        <div className="analytics-v12-chart-area radar"><ResponsiveContainer width="100%" height="100%"><RadarChart data={subjectChart} outerRadius="70%"><PolarGrid stroke="#dfe6ec" /><PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} /><Radar name="Your Score" dataKey="score" stroke={BRAND} fill={BRAND} fillOpacity={0.12} strokeWidth={2.2} />{hasSubjectAverage && <Radar name="Average Score" dataKey="average" stroke={MUTED} fill="transparent" strokeDasharray="5 5" strokeWidth={1.7} />}</RadarChart></ResponsiveContainer></div>
        <div className="analytics-v12-reference-legend"><span><i className="solid" />Your Score</span>{hasSubjectAverage && <span><i className="dash" />Average Score</span>}</div>
      </article>

      <article className="analytics-v12-panel analytics-v12-subject-comparison-panel">
        <div className="analytics-v12-panel-head"><h3>Subject comparison</h3><small>Click a subject to open analysis</small></div>
        <div className="analytics-v12-overview-subject-list">
          {payload.subjects.map((row) => <button type="button" key={row.id} className="analytics-v12-overview-subject-row" onClick={() => openSubject(row.id)}>
            <span className="analytics-v12-overview-subject-name">{row.name}</span>
            <span className="analytics-v12-bar-track"><span className={`analytics-v12-bar-fill ${row.accuracy < 70 ? 'attention' : ''}`} style={{ width: `${clamp(row.accuracy)}%` }} /></span>
            <strong>{round(row.accuracy)}%</strong>
            <span className={`analytics-v12-mini-trend ${(row.trend_delta || 0) < 0 ? 'down' : ''}`}>{(row.trend_delta || 0) < 0 ? '▼' : '▲'} {Math.abs(round(row.trend_delta || 0, 1) || 0)}%</span>
          </button>)}
        </div>
        <div className="analytics-v12-comparison-axis"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>
        <div className="analytics-v12-comparison-legend"><span><i className="strong" />Strong areas (≥ 70%)</span><span><i className="attention" />Needs attention (&lt; 70%)</span></div>
      </article>

      <article className="analytics-v12-panel trend">
        <div className="analytics-v12-panel-head"><h3>Performance trend</h3><span className="analytics-v12-panel-mode">Last {Math.min(7, payload.trend.length)} Tests</span></div>
        <div className="analytics-v12-chart-area"><ResponsiveContainer width="100%" height="100%"><LineChart data={trendChart}><CartesianGrid vertical={false} stroke="#eef2f4" /><XAxis dataKey="submitted_at" tickFormatter={formatDate} tick={{ fill: '#8998a8', fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} tick={{ fill: '#8998a8', fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip labelFormatter={(value) => formatDate(String(value))} /><Line type="monotone" dataKey="percentage" name="Your Score" stroke={BRAND} strokeWidth={2.5} dot={{ r: 3, fill: '#fff', strokeWidth: 2 }} activeDot={{ r: 5 }} />{hasTrendAverage && <Line type="monotone" dataKey="cohortAverage" name="Average Score" stroke={MUTED} strokeWidth={1.8} strokeDasharray="5 5" dot={false} />}</LineChart></ResponsiveContainer></div>
        <div className="analytics-v12-reference-legend"><span><i className="solid" />Your Score</span>{hasTrendAverage && <span><i className="dash" />Average Score</span>}</div>
      </article>
    </section>

    <section className="analytics-v12-cta">
      <div className="analytics-v12-cta-icon"><BarChart3 /></div>
      <div><h4>Want to know what’s working and what to improve?</h4><p>Get personalized insights with your strengths and areas to focus on.</p></div>
      <div className="analytics-v12-cta-actions"><button type="button" onClick={openInsights}>View insights <ArrowRight /></button></div>
    </section>
  </>;
}

function SubjectView({ payload, subjectId, setSubjectId, openChapter, metricMode }: { payload: AnalyticsV12Payload; subjectId: string; setSubjectId: (value: string) => void; openChapter: (row: AnalyticsTaxonomyRow) => void; metricMode: OverviewMetricMode }) {
  const subject = payload.subjects.find((row) => row.id === subjectId) || payload.subjects[0];
  if (!subject) return <EmptyState title="No subject evidence" copy="Complete a test with subject-tagged questions to open this view." />;
  const chapters = payload.chapters.filter((row) => row.subject_id === subject.id || row.parent_id === subject.id);
  const sortedChapters = [...chapters].sort((a, b) => b.accuracy - a.accuracy);
  const bestChapter = sortedChapters[0];
  const weakChapters = [...chapters].sort((a, b) => a.accuracy - b.accuracy).slice(0, 2);
  const weakestDifficulty = [...(subject.difficulty || [])].sort((a, b) => a.accuracy - b.accuracy)[0];
  const averageMinutes = subject.average_seconds === null || subject.average_seconds === undefined ? null : round(subject.average_seconds / 60, 2);
  const subjectValue: ReactNode = metricMode === 'marks' ? <>{subject.correct} <small>correct</small></> : metricMode === 'percentile' ? '—' : metricValue(subject.accuracy, '%');
  const subjectLabel = metricMode === 'percentile' ? 'Subject percentile' : 'Subject score';
  const conceptRows = ['Theory recall', 'Numericals', 'Application', 'Multi-step reasoning'];
  const difficultyKeys = ['easy', 'moderate', 'difficult'];

  return <>
    <div className="analytics-v12-selector-strip analytics-v12-subject-selector"><strong>Select a subject</strong>{payload.subjects.map((row) => <button type="button" key={row.id} className={row.id === subject.id ? 'active' : ''} onClick={() => setSubjectId(row.id)}><BookOpenCheck />{row.name}</button>)}</div>
    <section className="analytics-v12-metrics">
      <MetricCard icon={<Target />} tone="green" label={subjectLabel} value={subjectValue} copy={metricMode === 'percentile' ? 'Available after enough comparable subject attempts' : 'Good effort!'} delta={subject.trend_delta} />
      <MetricCard icon={<CheckCircle2 />} tone="green" label="Accuracy" value={metricValue(subject.accuracy, '%')} copy={subject.accuracy >= 75 ? 'Good accuracy' : 'Keep improving'} />
      <MetricCard icon={<Clock3 />} tone="amber" label="Speed" value={averageMinutes === null ? '—' : <>{averageMinutes} <small>min / Q</small></>} copy={averageMinutes === null ? 'Question-level timing not recorded' : 'Based on recorded active response time'} />
      <MetricCard icon={<BarChart3 />} tone="amber" label="Percentile" value="—" copy="Available after enough comparable subject attempts" />
    </section>
    <section className="analytics-v12-subject-main-grid">
      <article className="analytics-v12-section-card analytics-v12-chapter-mastery-card"><div className="analytics-v12-section-head"><div><h3>Chapter mastery <span className="analytics-v12-info-dot">i</span></h3><p>Your performance in major chapters of {subject.name}</p></div><span className="analytics-v12-panel-mode">{metricMode[0].toUpperCase() + metricMode.slice(1)}</span></div><MasteryRows rows={chapters} onSelect={openChapter} /><div className="analytics-v12-mastery-axis"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div><div className="analytics-v12-comparison-legend"><span><i className="strong" />Strong areas (≥ 70%)</span><span><i className="attention" />Needs attention (&lt; 70%)</span></div></article>
      <article className="analytics-v12-section-card analytics-v12-concept-card"><div className="analytics-v12-section-head"><div><h3>Concept performance <span className="analytics-v12-info-dot">i</span></h3><p>How you perform across key concept skills</p></div><span className="analytics-v12-panel-mode">Percentage</span></div><div className="analytics-v12-heatmap-wrap"><table className="analytics-v12-heat-table"><thead><tr><th>Concept skill</th><th>Easy</th><th>Medium</th><th>Hard</th><th>Overall</th></tr></thead><tbody>{conceptRows.map((concept) => <tr key={concept}><td>{concept}</td>{difficultyKeys.map((difficulty) => <td key={difficulty} className="unavailable" title="Skill-type tagging is not yet available">—</td>)}<td className="unavailable">—</td></tr>)}</tbody></table></div><p className="analytics-v12-evidence-note">Concept-skill cells will calculate automatically after questions are tagged as theory recall, numerical, application or multi-step reasoning.</p></article>
    </section>
    <section className="analytics-v12-subject-bottom-grid">
      <article className="analytics-v12-section-card"><div className="analytics-v12-section-head"><div><h3>Question difficulty <span className="analytics-v12-info-dot">i</span></h3><p>Your accuracy by question difficulty</p></div></div><div className="analytics-v12-chart-box subject-difficulty"><ResponsiveContainer width="100%" height="100%"><BarChart data={subject.difficulty || []} margin={{ left: -18, right: 8, top: 10 }}><CartesianGrid vertical={false} stroke="#eef2f4" /><XAxis dataKey="difficulty" tickFormatter={(value) => difficultyLabels[value] || value} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#8998a8' }} axisLine={false} tickLine={false} /><Tooltip formatter={(value, _name, entry) => [`${value}% · ${entry.payload.questions} questions`, 'Accuracy']} /><Bar dataKey="accuracy" name="Accuracy %" radius={[7, 7, 0, 0]}>{(subject.difficulty || []).map((row) => <Cell key={row.difficulty} fill={row.accuracy >= 75 ? GREEN : row.accuracy >= 55 ? AMBER : RED} />)}</Bar></BarChart></ResponsiveContainer></div></article>
      <article className="analytics-v12-section-card analytics-v12-insights-card"><div className="analytics-v12-section-head"><h3>Insights <span className="analytics-v12-info-dot">i</span></h3></div><div className="analytics-v12-insights-layout"><div className="analytics-v12-insight-stack"><div className="analytics-v12-insight-row"><div className="analytics-v12-insight-badge green"><Target /></div><div><strong>Best area</strong><p>{bestChapter ? `You perform best in ${bestChapter.name} with ${round(bestChapter.accuracy)}% mastery across ${bestChapter.questions} question outcomes.` : 'More chapter-tagged questions are needed.'}</p></div></div><div className="analytics-v12-insight-row"><div className="analytics-v12-insight-badge amber"><TrendingUp /></div><div><strong>Needs support</strong><p>{weakChapters.length ? `${weakChapters.map((row) => row.name).join(' and ')} need more practice.` : 'More chapter evidence is needed before identifying support areas.'}</p></div></div><div className="analytics-v12-insight-row"><div className="analytics-v12-insight-badge blue"><Gauge /></div><div><strong>Next step</strong><p>{weakestDifficulty ? `Focus on ${difficultyLabels[weakestDifficulty.difficulty] || weakestDifficulty.difficulty} questions, currently at ${round(weakestDifficulty.accuracy)}% accuracy.` : 'Complete more mixed-difficulty questions to generate a recommendation.'}</p></div></div></div><div className="analytics-v12-insight-cta"><div className="analytics-v12-cta-icon"><BarChart3 /></div><p>Go deeper into your performance with detailed chapter and concept insights.</p><button type="button" disabled={!weakChapters[0]} onClick={() => weakChapters[0] && openChapter(weakChapters[0])}>View detailed insights <ArrowRight /></button></div></div></article>
    </section>
  </>;
}

function ChapterView({ payload, chapterId, setChapterId, openTopic, metricMode }: { payload: AnalyticsV12Payload; chapterId: string; setChapterId: (value: string) => void; openTopic: (row: AnalyticsTaxonomyRow) => void; metricMode: OverviewMetricMode }) {
  const chapter = payload.chapters.find((row) => row.id === chapterId) || payload.chapters[0];
  if (!chapter) return <EmptyState title="No chapter evidence" copy="Chapter analytics will appear after questions have chapter taxonomy." />;
  const subjectId = chapter.subject_id || chapter.parent_id || '';
  const subject = payload.subjects.find((row) => row.id === subjectId);
  const subjectChapters = payload.chapters.filter((row) => row.subject_id === subjectId || row.parent_id === subjectId);
  const topics = payload.topics.filter((row) => row.parent_id === chapter.id);
  const scatter = topics.filter((row) => row.average_seconds !== null).map((row) => ({ name: row.name, accuracy: row.accuracy, seconds: row.average_seconds || 0, questions: row.questions }));
  const totalPresented = chapter.correct + chapter.incorrect + chapter.unanswered;
  const attempted = chapter.correct + chapter.incorrect;
  const attemptRate = totalPresented ? attempted / totalPresented * 100 : 0;
  const averageMinutes = chapter.average_seconds === null ? null : round(chapter.average_seconds / 60, 2);
  const chapterValue: ReactNode = metricMode === 'marks' ? <>{chapter.correct} <small>correct</small></> : metricMode === 'percentile' ? '—' : metricValue(chapter.accuracy, '%');
  const errorRows = (payload.chapter_error_breakdown || []).filter((row) => row.chapter_id === chapter.id);
  const errorKeys = [
    ['concept_gap', 'Concept gap', BRAND], ['calculation_error', 'Calculation', AMBER], ['careless_error', 'Careless', BLUE], ['guessed', 'Guessed', '#7a62b3'], ['ran_out_of_time', 'Time pressure', RED], ['other', 'Other', '#78909c'], ['unclassified', 'Not classified', '#c9d2d9'],
  ] as const;
  const weakestTopic = [...topics].sort((a, b) => a.accuracy - b.accuracy)[0];
  const slowestTopic = [...topics].filter((row) => row.average_seconds !== null).sort((a, b) => (b.average_seconds || 0) - (a.average_seconds || 0))[0];
  const selectSubject = (value: string) => {
    const first = payload.chapters.find((row) => row.subject_id === value || row.parent_id === value);
    if (first) setChapterId(first.id);
  };
  return <>
    <div className="analytics-v12-chapter-selectors">
      <label><BookOpen /><span><small>Subject</small><select value={subjectId} onChange={(event) => selectSubject(event.target.value)}>{payload.subjects.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></span><ChevronDown /></label>
      <label><Layers3 /><span><small>Chapter</small><select value={chapter.id} onChange={(event) => setChapterId(event.target.value)}>{subjectChapters.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></span><ChevronDown /></label>
    </div>
    <div className="analytics-v12-chapter-tabs"><button type="button" aria-label="Previous chapter"><ChevronLeft /></button><div>{subjectChapters.map((row) => <button type="button" key={row.id} className={row.id === chapter.id ? 'active' : ''} onClick={() => setChapterId(row.id)}>{row.name}</button>)}</div><button type="button" aria-label="Next chapter"><ChevronRight /></button></div>
    <section className="analytics-v12-metrics">
      <MetricCard icon={<Target />} tone="green" label={metricMode === 'percentile' ? 'Chapter percentile' : 'Chapter score'} value={chapterValue} copy={metricMode === 'percentile' ? 'Available after enough comparable chapter attempts' : `${chapter.questions} assessed questions`} delta={chapter.trend_delta} />
      <MetricCard icon={<CheckCircle2 />} tone="green" label="Accuracy" value={metricValue(chapter.accuracy, '%')} copy={`${chapter.correct} correct · ${chapter.incorrect} incorrect`} />
      <MetricCard icon={<Gauge />} tone="blue" label="Attempt rate" value={metricValue(attemptRate, '%')} copy={`${attempted} of ${totalPresented} questions attempted`} />
      <MetricCard icon={<Clock3 />} tone="amber" label="Avg time per question" value={averageMinutes === null ? '—' : <>{averageMinutes} <small>min</small></>} copy={averageMinutes === null ? 'Question-level timing not recorded' : 'Based on active recorded response time'} />
    </section>
    <section className="analytics-v12-chapter-three-grid">
      <article className="analytics-v12-section-card"><div className="analytics-v12-section-head"><div><h3>Topic mastery within {chapter.name}</h3><p>Topic performance with the chapter average shown as a marker.</p></div></div><div className="analytics-v12-topic-mastery-detailed">{topics.length ? topics.map((row) => <button type="button" key={row.id} onClick={() => openTopic(row)}><span>{row.name}</span><div className="analytics-v12-topic-track"><i style={{ width: `${clamp(row.accuracy)}%`, background: row.accuracy >= 70 ? BRAND : AMBER }} /><b style={{ left: `${clamp(chapter.accuracy)}%` }} /></div><strong>{round(row.accuracy)}%</strong></button>) : <p className="analytics-v12-evidence-note">No topic-tagged questions are available for this chapter.</p>}</div><div className="analytics-v12-topic-legend"><span><i />Your score</span><span><b />Chapter average</span></div></article>
      <article className="analytics-v12-section-card"><div className="analytics-v12-section-head"><div><h3>Accuracy vs time</h3><p>Each bubble represents a topic. Bubble size reflects evidence volume.</p></div><span className="analytics-v12-panel-mode">By topic</span></div>{scatter.length ? <div className="analytics-v12-chart-box tall"><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ left: -8, right: 12, top: 12, bottom: 12 }}><CartesianGrid stroke="#eef2f4" /><XAxis type="number" dataKey="seconds" name="Average time" unit="s" tick={{ fontSize: 10, fill: '#8998a8' }} /><YAxis type="number" dataKey="accuracy" name="Accuracy" unit="%" domain={[0, 100]} tick={{ fontSize: 10, fill: '#8998a8' }} /><ZAxis type="number" dataKey="questions" range={[55, 220]} /><Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(value, name) => [name === 'accuracy' ? `${value}%` : name === 'seconds' ? `${value} sec` : value, name]} /><Scatter data={scatter} fill={BRAND} /></ScatterChart></ResponsiveContainer></div> : <div className="analytics-v12-unavailable-panel"><Clock3 /><strong>Timing analysis unavailable</strong><p>Question-level timing is required for this chart.</p></div>}</article>
      <article className="analytics-v12-section-card"><div className="analytics-v12-section-head"><div><h3>Error breakdown</h3><p>Reasons selected by the student after each test.</p></div><span className="analytics-v12-panel-mode">By topic</span></div><div className="analytics-v12-error-legend">{errorKeys.map(([key,label,color]) => <span key={key}><i style={{background:color}} />{label}</span>)}</div>{errorRows.length ? <div className="analytics-v12-error-rows">{errorRows.map((row) => <div key={row.topic_id || row.topic_name}><span>{row.topic_name}</span><div>{errorKeys.map(([key,,color]) => { const count=Number(row[key] || 0); const width=row.total_reviewable ? count/row.total_reviewable*100 : 0; return <i key={key} title={`${count} responses`} style={{width:`${width}%`,background:color}} />})}</div><small>{row.total_reviewable} review items</small></div>)}</div> : <div className="analytics-v12-unavailable-panel"><AlertTriangle /><strong>No self-classifications yet</strong><p>After a submitted test, students can classify each wrong or skipped question. This panel will then populate automatically.</p></div>}</article>
    </section>
    <section className="analytics-v12-next-steps"><div className="analytics-v12-next-icon"><ArrowRight /></div><article><span>1</span><div><strong>Strengthen the weakest topic</strong><p>{weakestTopic ? `Begin with ${weakestTopic.name}, currently at ${round(weakestTopic.accuracy)}% accuracy.` : 'Complete more topic-tagged questions to identify the weakest area.'}</p></div></article><article><span>2</span><div><strong>Practice smarter</strong><p>Redo recently incorrect and skipped questions, then complete a short targeted practice set.</p></div></article><article><span>3</span><div><strong>{slowestTopic ? 'Manage your time' : 'Improve completion'}</strong><p>{slowestTopic ? `${slowestTopic.name} currently takes the longest at about ${round(slowestTopic.average_seconds)} seconds per question.` : `Your current chapter attempt rate is ${round(attemptRate)}%. Focus on completing a few more medium-difficulty questions.`}</p></div></article></section>
  </>;
}

type TopicReflectionAnalytics = {
  total_responses: number;
  confidence_responses: number;
  confidence_index: number | null;
  confidence_coverage: number | null;
  accuracy: number | null;
  calibration_score: number | null;
  reviewable_errors: number;
  classified_errors: number;
  error_breakdown: Record<string, number>;
};

function confidenceLabel(value: number | null) {
  if (value === null) return 'Not rated';
  if (value >= 4.5) return 'Very confident';
  if (value >= 3.8) return 'Confident';
  if (value >= 3) return 'Balanced';
  if (value >= 2) return 'Hesitant';
  return 'Needs confidence building';
}

function TopicView({ payload, topicId, setTopicId, studentId, openQuestionIntelligence }: { payload: AnalyticsV12Payload; topicId: string; setTopicId: (value: string) => void; studentId: string; openQuestionIntelligence: () => void }) {
  const topic = payload.topics.find((row) => row.id === topicId) || payload.topics[0];
  const [reflection, setReflection] = useState<TopicReflectionAnalytics | null>(null);
  const [reflectionLoading, setReflectionLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (!topic || !studentId || !supabase) { setReflection(null); return; }
    setReflectionLoading(true);
    void supabase.rpc('get_topic_reflection_analytics_v13', { p_student_id: studentId, p_topic_id: topic.id }).then(({ data, error }) => {
      if (!cancelled) { setReflection(error ? null : data as TopicReflectionAnalytics); setReflectionLoading(false); }
    });
    return () => { cancelled = true; };
  }, [studentId, topic?.id]);
  if (!topic) return <EmptyState title="No topic evidence" copy="Topic analytics will appear after topic-tagged questions are attempted." />;
  const chapter = payload.chapters.find((row) => row.id === topic.parent_id);
  const subject = payload.subjects.find((row) => row.id === topic.subject_id);
  const subjectChapters = payload.chapters.filter((row) => row.subject_id === subject?.id || row.parent_id === subject?.id);
  const chapterTopics = payload.topics.filter((row) => row.parent_id === chapter?.id);
  const priority = payload.priorities.find((row) => row.topic_id === topic.id);
  const averageMinutes = topic.average_seconds === null ? null : round(topic.average_seconds / 60, 2);
  const confidence = reflection?.confidence_index ?? null;
  const calibration = reflection?.calibration_score ?? null;
  const errorEntries = [
    ['concept_gap','Concept not understood'],['careless_error','Careless mistake'],['calculation_error','Calculation mistake'],
    ['ran_out_of_time','Time pressure'],['guessed','Guessed'],['other','Other'],['unclassified','Not classified'],
  ] as const;
  const errorTotal = Object.values(reflection?.error_breakdown || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  const selectSubject = (value: string) => {
    const firstChapter = payload.chapters.find((row) => row.subject_id === value || row.parent_id === value);
    const firstTopic = firstChapter && payload.topics.find((row) => row.parent_id === firstChapter.id);
    if (firstTopic) setTopicId(firstTopic.id);
  };
  const selectChapter = (value: string) => {
    const firstTopic = payload.topics.find((row) => row.parent_id === value);
    if (firstTopic) setTopicId(firstTopic.id);
  };
  return <>
    <div className="analytics-v12-topic-selectors">
      <label><BookOpen /><span><small>Subject</small><select value={subject?.id || ''} onChange={(event)=>selectSubject(event.target.value)}>{payload.subjects.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></span><ChevronDown /></label><b>›</b>
      <label><Layers3 /><span><small>Chapter</small><select value={chapter?.id || ''} onChange={(event)=>selectChapter(event.target.value)}>{subjectChapters.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></span><ChevronDown /></label><b>›</b>
      <label><Target /><span><small>Topic</small><select value={topic.id} onChange={(event)=>setTopicId(event.target.value)}>{chapterTopics.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></span><ChevronDown /></label>
    </div>
    <section className="analytics-v12-metrics">
      <MetricCard icon={<Target />} tone="green" label="Topic score" value={metricValue(topic.accuracy, '%')} copy={`${topic.questions} assessed outcomes`} delta={topic.trend_delta} />
      <MetricCard icon={<CheckCircle2 />} tone="green" label="Accuracy" value={metricValue(topic.accuracy, '%')} copy={`${topic.correct} correct · ${topic.incorrect} incorrect`} />
      <MetricCard icon={<Clock3 />} tone="amber" label="Avg time / question" value={averageMinutes === null ? '—' : <>{averageMinutes} <small>min</small></>} copy={averageMinutes === null ? 'Question-level timing not recorded' : 'Valid active response time'} />
      <MetricCard icon={<Gauge />} tone="blue" label="Confidence index" value={reflectionLoading ? '…' : confidence === null ? '—' : <>{round(confidence,1)} <small>/ 5</small></>} copy={confidence === null ? 'Student reflection not yet provided' : `${confidenceLabel(confidence)} · ${round(reflection?.confidence_coverage)}% coverage`} />
    </section>
    <section className="analytics-v12-topic-upper-grid">
      <article className="analytics-v12-section-card"><div className="analytics-v12-section-head"><div><h3>Sub-concept mastery <span className="analytics-v12-info-dot">i</span></h3><p>Performance across question-bank sub-concept tags inside {topic.name}</p></div></div><EmptyState title="Insufficient evidence" copy="Sub-concept mastery will appear after questions in this topic are tagged with verified sub-concepts and enough submitted responses exist." /></article>
      <article className="analytics-v12-section-card"><div className="analytics-v12-section-head"><div><h3>Difficulty analysis <span className="analytics-v12-info-dot">i</span></h3><p>Your performance by question difficulty</p></div></div><div className="analytics-v12-chart-box"><ResponsiveContainer width="100%" height="100%"><BarChart data={topic.difficulty || []} margin={{left:-18,right:8,top:10}}><CartesianGrid vertical={false} stroke="#eef2f4"/><XAxis dataKey="difficulty" tickFormatter={(value)=>difficultyLabels[value]||value} tick={{fontSize:10,fill:'var(--muted-foreground)'}} axisLine={false} tickLine={false}/><YAxis domain={[0,100]} tick={{fontSize:10,fill:'#8998a8'}} axisLine={false} tickLine={false}/><Tooltip formatter={(value)=>[`${value}%`,'Accuracy']}/><Bar dataKey="accuracy" fill={BRAND} radius={[7,7,0,0]}/></BarChart></ResponsiveContainer></div></article>
    </section>
    <section className="analytics-v12-topic-lower-grid">
      <article className="analytics-v12-section-card"><div className="analytics-v12-section-head"><div><h3>Confidence calibration</h3><p>How accurately the student judges what they know</p></div></div><div className="analytics-v12-calibration"><div className="analytics-v12-calibration-ring" style={{'--progress': `${calibration ?? 0}%`} as CSSProperties}><strong>{calibration === null ? '—' : `${round(calibration)}%`}</strong><span>Calibration</span></div><div><p><strong>Accuracy:</strong> {round(topic.accuracy)}%</p><p><strong>Confidence:</strong> {confidence === null ? 'Not rated' : `${round(confidence,1)} / 5`}</p><p>{confidence === null ? 'Ask the student to reflect during answer-key review.' : topic.accuracy < 60 && confidence >= 4 ? 'High-confidence errors suggest a misconception that needs correction.' : topic.accuracy >= 70 && confidence < 3 ? 'Performance is stronger than the student believes; confidence building may help.' : 'Confidence is reasonably aligned with performance.'}</p></div></div></article>
      <article className="analytics-v12-section-card"><div className="analytics-v12-section-head"><div><h3>Common mistakes</h3><p>Student-selected reasons after submission</p></div></div><div className="analytics-v12-mistake-list">{errorEntries.map(([key,label])=>{const count=Number(reflection?.error_breakdown?.[key]||0);const percentage=errorTotal?Math.round(count/errorTotal*100):0;return <div key={key}><AlertTriangle/><span><strong>{label}</strong><small>{count} response{count===1?'':'s'}</small></span><b>{errorTotal?`${percentage}%`:'—'}</b></div>})}</div><p className="analytics-v12-evidence-note">Classification coverage: {reflection ? `${reflection.classified_errors} of ${reflection.reviewable_errors}` : 'unavailable'} incorrect or skipped responses.</p></article>
      <article className="analytics-v12-section-card"><div className="analytics-v12-section-head"><div><h3>Recommended practice</h3><p>Shown only when current evidence meets the priority threshold</p></div></div>{priority ? <div className="analytics-v12-evidence-recommendation"><ListChecks/><div><strong>Evidence-based next step</strong><p>{priority.action}</p><small>{priority.questions} assessed outcomes · {round(priority.accuracy)}% accuracy</small></div></div> : <EmptyState title="Not enough data yet" copy="Complete more tests in this topic before Evidara recommends a targeted practice step." />}</article>
    </section>
    <section className="analytics-v12-focus-banner topic-focus"><div><ListChecks /></div><div><h4>{reflectionLoading ? 'Checking reflection evidence...' : reflection?.classified_errors ? `Review your recorded mistake patterns in ${topic.name}.` : 'Classification not yet available'}</h4><p>{reflection?.classified_errors ? `${reflection.classified_errors} of ${reflection.reviewable_errors} reviewable responses have student-selected classifications.` : 'Complete the optional post-test reflection to add mistake reasons. No reason is inferred automatically.'}</p></div><button type="button" onClick={openQuestionIntelligence}>Open question intelligence <ArrowRight/></button></section>
  </>;
}

function QuestionIntelligenceView({ payload, topicId }: { payload: AnalyticsV12Payload; topicId: string }) {
  const topic = payload.topics.find((row)=>row.id===topicId) || payload.topics[0];
  if (!topic) return <EmptyState title="Not enough data yet" copy="Complete more tests with verified topic taxonomy before Question Intelligence becomes available." />;
  const questionEvidence = (payload.question_evidence || [])
    .filter((row) => row.topic_id === topic.id)
    .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime() || a.question_no - b.question_no);
  return <>
    <section className="analytics-v12-question-intro"><div><Eye/><span><small>Question intelligence</small><h2>{topic.name}</h2><p>Question-level evidence must come from submitted responses, recorded timing and student reflection.</p></span></div></section>
    <section className="analytics-v12-metrics"><MetricCard icon={<CheckCircle2/>} tone="green" label="Correct" value={topic.correct} copy={`${topic.questions} total outcomes`}/><MetricCard icon={<XCircle/>} tone="amber" label="Incorrect" value={topic.incorrect} copy="Reviewable after submission"/><MetricCard icon={<Clock3/>} tone="blue" label="Average time" value={<>{metricValue(topic.average_seconds)} <small>sec</small></>} copy="Active question time"/><MetricCard icon={<Gauge/>} tone="green" label="Reflection" value="Evidence only" copy="Never inferred or fabricated"/></section>
    <article className="analytics-v12-section-card analytics-v12-question-table">
      <div className="analytics-v12-section-head"><div><h3>Response evidence</h3><p>Authorized submitted responses for this exact topic.</p></div><span className="analytics-v12-panel-mode">{questionEvidence.length} outcomes</span></div>
      {questionEvidence.length ? <div data-f4-question-evidence className="divide-y divide-[var(--line)]">
        {questionEvidence.slice(0, 150).map((row) => <div key={row.response_id} className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0"><small className="text-[var(--muted-foreground)]">{row.paper_title} · Q{row.question_no} · {formatDate(row.submitted_at)}</small><strong className="mt-1 block">{row.question_text}</strong><span className="mt-1 block text-xs text-[var(--muted-foreground)]">{row.subject_name} · {row.chapter_name} · {row.topic_name}</span></div>
          <div className="flex flex-wrap items-center gap-2 text-sm md:justify-end"><span className="rounded-full border border-[var(--line)] px-2.5 py-1 font-semibold">{row.outcome === 'correct' ? 'Correct' : row.outcome === 'incorrect' ? 'Incorrect' : 'Unanswered'}</span><span>{row.marks_awarded > 0 ? `+${row.marks_awarded}` : row.marks_awarded} marks</span><span>{row.time_spent_seconds == null ? 'Time —' : `${row.time_spent_seconds}s`}</span></div>
        </div>)}
        {questionEvidence.length > 150 && <p className="pt-3 text-xs text-[var(--muted-foreground)]">Showing the latest 150 question outcomes for this topic.</p>}
      </div> : <EmptyState title="No question evidence for this topic" copy="Question rows appear only when authorized submitted responses exist for this exact topic. No synthetic rows are substituted." />}
    </article>
  </>;
}

function PrioritiesView({ payload }: { payload: AnalyticsV12Payload }) {
  return <section className="analytics-v12-priorities-page"><div className="analytics-v12-section-head"><div><h3>Revision priorities</h3><p>Ranked automatically from accuracy, unanswered rate, pace and recent direction.</p></div></div><PriorityList rows={payload.priorities} /></section>;
}

function HistoryView({ payload }: { payload: AnalyticsV12Payload }) {
  if (!payload.history.length) return <EmptyState title="No completed tests" copy="Submitted tests will appear here automatically." />;
  return <section className="analytics-v12-history-card"><div className="analytics-v12-section-head"><div><h3>Test history</h3><p>Every row is sourced from a submitted Evidara attempt.</p></div></div><div className="analytics-v12-table-wrap"><table><thead><tr><th>Test</th><th>Date</th><th>Score</th><th>Accuracy</th><th>Time</th><th>Correct</th><th>Incorrect</th><th>Unanswered</th></tr></thead><tbody>{payload.history.map((row) => <tr key={row.attempt_id}><td><strong>{row.paper_title}</strong><small>{row.exam_type || 'Assessment'} · {row.grade_level || 'All grades'}</small></td><td>{formatDate(row.submitted_at)}</td><td><strong>{round(row.score, 1)} / {round(row.maximum_marks, 1)}</strong><small>{round(row.percentage, 1)}%</small></td><td>{round(row.accuracy, 1)}%</td><td>{round(row.duration_minutes)} min</td><td className="good">{row.correct}</td><td className="bad">{row.incorrect}</td><td>{row.unanswered}</td></tr>)}</tbody></table></div></section>;
}

function EvidenceDrawer({ payload, open, close }: { payload: AnalyticsV12Payload; open: boolean; close: () => void }) {
  const strengths = payload.subjects.slice().sort((a, b) => b.accuracy - a.accuracy).slice(0, 3);
  return <><button type="button" aria-label="Close insights" className={`analytics-v12-overlay ${open ? 'open' : ''}`} onClick={close} /><aside className={`analytics-v12-drawer ${open ? 'open' : ''}`} aria-hidden={!open}><header><div><h2>Evidence insights</h2><p>Generated only from recorded assessment evidence.</p></div><button type="button" onClick={close}>×</button></header><div className="analytics-v12-drawer-scroll"><section><h3 className="good">What is going well</h3><ul>{strengths.map((row) => <li key={row.id}>{row.name}: {round(row.accuracy)}% accuracy across {row.questions} question outcomes.</li>)}</ul></section><section><h3 className="focus">What needs attention</h3><ul>{payload.priorities.slice(0, 3).map((row) => <li key={row.rank}>{row.topic_name || row.chapter_name}: {row.reasons[0]}.</li>)}</ul></section><section><h3>Recommended next steps</h3><ol>{payload.priorities.slice(0, 3).map((row) => <li key={row.rank}><span>{row.rank}</span>{row.action}</li>)}</ol></section><section className="analytics-v12-policy"><h3>Evidence policy</h3><p>Evidara records outcomes, timing and taxonomy automatically. Error types are included only when the student explicitly self-classifies an incorrect or skipped response after submission; unclassified items remain visible.</p></section></div></aside></>;
}

export function AnalyticsV12Workspace({
  mode,
  view: controlledView,
  selectedStudentId,
  embedded = false,
  hideStudentSelector = false,
}: {
  mode: 'student' | 'school';
  view?: AnalyticsV12View;
  selectedStudentId?: string;
  embedded?: boolean;
  hideStudentSelector?: boolean;
}) {
  const user = useAppStore((state) => state.user);
  const setView = useAppStore((state) => state.setView);
  const [embeddedView, setEmbeddedView] = useState<AnalyticsV12View>(controlledView || 'overview');
  const view = controlledView || embeddedView;
  const [payload, setPayload] = useState<AnalyticsV12Payload>(() => emptyPayload(selectedStudentId || (mode === 'student' ? user?.id : '')));
  const [directory, setDirectory] = useState<AnalyticsDirectoryStudent[]>([]);
  const [selectedStudent, setSelectedStudent] = useState(mode === 'student' ? user?.id || '' : selectedStudentId || '');
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [chapterId, setChapterId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [metricMode, setMetricMode] = useState<OverviewMetricMode>('percentage');

  const targetStudentId = mode === 'student' ? user?.id || '' : selectedStudentId || selectedStudent;

  async function loadDirectory() {
    if (!supabase || mode !== 'school' || selectedStudentId) return [] as AnalyticsDirectoryStudent[];
    const { data, error: directoryError } = await supabase.rpc('list_analytics_students_v12');
    if (directoryError) throw directoryError;
    const rows = Array.isArray(data?.students) ? data.students as AnalyticsDirectoryStudent[] : [];
    setDirectory(rows);
    if (!selectedStudent && rows[0]?.student_id) setSelectedStudent(rows[0].student_id);
    return rows;
  }

  async function loadEvidence(explicitStudentId?: string) {
    if (!supabase) {
      setPayload(emptyPayload(explicitStudentId || targetStudentId));
      setError('Supabase is not configured on this device.');
      setLoading(false);
      return;
    }
    const studentId = explicitStudentId || targetStudentId;
    if (!studentId) return;
    if (mode === 'school') setPayload(emptyPayload(studentId));
    setLoading(true);
    setError('');
    const { data, error: analyticsError } = await supabase.rpc('get_student_analytics_v12', {
      p_student_id: studentId,
      p_product_id: null,
      p_date_from: null,
      p_date_to: null,
    });
    if (analyticsError) {
      setPayload(emptyPayload(studentId));
      setError(/get_student_analytics_v12|schema cache|could not find/i.test(analyticsError.message)
        ? 'Apply Supabase migration 45_v12_evidence_analytics.sql and reload the schema cache.'
        : analyticsError.message);
      setLoading(false);
      return;
    }
    const realPayload = data as AnalyticsV12Payload;
    setPayload(realPayload);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (mode === 'school' && selectedStudentId) {
          setSelectedStudent(selectedStudentId);
          if (!cancelled) await loadEvidence(selectedStudentId);
        } else if (mode === 'school') {
          const rows = await loadDirectory();
          if (!cancelled) await loadEvidence(selectedStudent || rows[0]?.student_id);
        } else {
          await loadEvidence(user?.id);
        }
      } catch (value) {
        if (!cancelled) {
          setError(value instanceof Error ? value.message : 'Unable to load analytics.');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [mode, selectedStudentId, user?.id]);

  useEffect(() => {
    if (mode === 'school' && !selectedStudentId && selectedStudent) void loadEvidence(selectedStudent);
  }, [selectedStudent, selectedStudentId]);

  useEffect(() => {
    if (!subjectId && payload.subjects[0]) setSubjectId(payload.subjects[0].id);
    if (!chapterId && payload.chapters[0]) setChapterId(payload.chapters[0].id);
    if (!topicId && payload.topics[0]) setTopicId(payload.topics[0].id);
  }, [chapterId, payload, subjectId, topicId]);

  const prefix = mode === 'student' ? 'student' : 'school';
  const go = (next: AnalyticsV12View) => {
    if (embedded) {
      setEmbeddedView(next);
      return;
    }
    setView(`${prefix}-analytics-${next}` as AppView);
  };

  const pageTitle = useMemo(() => ({
    overview: 'Overview', subject: 'Subject analysis', chapter: 'Chapter analysis', topic: 'Topic analysis', 'question-intelligence': 'Question intelligence', priorities: 'Revision priorities', history: 'Test history',
  }[view]), [view]);

  const embeddedViews: Array<{ value: AnalyticsV12View; label: string }> = [
    { value: 'overview', label: 'Overview' },
    { value: 'subject', label: 'Subjects' },
    { value: 'chapter', label: 'Chapters' },
    { value: 'topic', label: 'Topics' },
    { value: 'question-intelligence', label: 'Question intelligence' },
    { value: 'priorities', label: 'Revision priorities' },
    { value: 'history', label: 'Test history' },
  ];

  return <div className={`analytics-v12 ${embedded ? 'analytics-v12-embedded' : ''}`}>
    {embedded && <nav className="analytics-v12-embedded-nav" aria-label="Student analytics sections">{embeddedViews.map((item) => <button type="button" key={item.value} className={view === item.value ? 'active' : ''} onClick={() => go(item.value)}>{item.label}</button>)}</nav>}
    {view === 'overview' || view === 'subject' ? <AnalyticsHeader payload={payload} mode={mode} directory={directory} selectedStudent={selectedStudent} onStudentChange={setSelectedStudent} metricMode={metricMode} onMetricModeChange={setMetricMode} title={view === 'subject' ? 'Subject analysis' : undefined} subtitle={view === 'subject' ? (mode === 'student' ? 'Deep dive into your performance and areas to improve.' : `Deep dive into ${payload.student.full_name || 'the student'}’s performance and areas to improve.`) : undefined} showStudentSelector={!hideStudentSelector} /> : <div className="analytics-v12-subview-header"><div><h1>{pageTitle}</h1><p>Detailed evidence from completed assessments.</p></div><small>Updated {formatDate(payload.generated_at)}</small></div>}
    {error && <div className="analytics-v12-error"><AlertTriangle /><div><strong>Analytics needs attention</strong><p>{error}</p></div></div>}
    {loading ? <div className="analytics-v12-loading"><div /><strong>Calculating evidence…</strong><p>Reading submitted attempts and taxonomy outcomes.</p></div> : <>
      {view === 'overview' && <OverviewView payload={payload} metricMode={metricMode} openInsights={() => setDrawerOpen(true)} openSubject={(id) => { setSubjectId(id); go('subject'); }} />}
      {view === 'subject' && <SubjectView payload={payload} subjectId={subjectId} setSubjectId={setSubjectId} metricMode={metricMode} openChapter={(row) => { setChapterId(row.id); go('chapter'); }} />}
      {view === 'chapter' && <ChapterView payload={payload} chapterId={chapterId} setChapterId={setChapterId} openTopic={(row) => { setTopicId(row.id); go('topic'); }} metricMode={metricMode} />}
      {view === 'topic' && <TopicView payload={payload} topicId={topicId} setTopicId={setTopicId} studentId={targetStudentId || payload.student.id} openQuestionIntelligence={() => go('question-intelligence')} />}
      {view === 'question-intelligence' && <QuestionIntelligenceView payload={payload} topicId={topicId} />}
      {view === 'priorities' && <PrioritiesView payload={payload} />}
      {view === 'history' && <HistoryView payload={payload} />}
    </>}
    <EvidenceDrawer payload={payload} open={drawerOpen} close={() => setDrawerOpen(false)} />
  </div>;
}
