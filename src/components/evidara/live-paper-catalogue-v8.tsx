'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
Archive,
Bold,
BookOpenCheck,
Check,
CheckCircle2,
ChevronDown,
ChevronUp,
CircleStop,
Clock3,
CopyPlus,
Edit3,
Eraser,
Eye,
FilePlus2,
FileQuestion,
Heading3,
Highlighter,
Italic,
Layers3,
LoaderCircle,
PauseCircle,
PlayCircle,
Plus,
RefreshCw,
Save,
Search,
Send,
Settings2,
ShieldCheck,
Sparkles,
Trash2,
Underline,
Upload,
X,
XCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';
import { normalizeEvidaraRole } from '@/lib/roles';
import { useQuestionScope } from '@/components/questions/useQuestionScope';
import { QuestionBulkImportDialog } from '@/components/evidara/question-bulk-import-dialog';
import { PaperFileImportDialog } from '@/components/evidara/paper-file-import-dialog';
import { PaperAssignmentCenter } from '@/components/evidara/paper-assignment-center';
import { PyqPaperManager } from '@/components/evidara/pyq-paper-manager';
import { useAssessmentOptions } from '@/components/evidara/use-assessment-options';
import type {
QuestionDifficulty,
QuestionRow,
TaxonomyChapter,
TaxonomySubject,
TaxonomyTopic,
} from '@/types/questions';
import type {
DifficultyDistribution,
PaperListRow,
PaperPayload,
PaperQuestionInput,
PaperSectionInput,
PaperSelectionMode,
PaperStatus,
PaperTestType,
ResultMode,
} from '@/types/papers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
Dialog,
DialogContent,
DialogDescription,
DialogFooter,
DialogHeader,
DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
Table,
TableBody,
TableCell,
TableHead,
TableHeader,
TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
AlertDialog,
AlertDialogCancel,
AlertDialogContent,
AlertDialogDescription,
AlertDialogFooter,
AlertDialogHeader,
AlertDialogTitle,
} from '@/components/ui/alert-dialog';
const DEFAULT_SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'Logical Reasoning'];
const MODES: PaperSelectionMode[] = ['manual', 'automatic', 'hybrid'];
const DIFFICULTIES: QuestionDifficulty[] = ['very_easy', 'easy', 'moderate', 'difficult', 'very_difficult'];
const DIFFICULTY_LABEL: Record<QuestionDifficulty, string> = {
very_easy: 'Very easy',
easy: 'Easy',
moderate: 'Intermediate',
difficult: 'Hard',
very_difficult: 'Very hard',
};
const STATUSES: PaperStatus[] = ['draft', 'under_review', 'approved', 'published', 'paused', 'closed', 'archived', 'rejected'];
const emptyDistribution = (): DifficultyDistribution => ({
very_easy: 0,
easy: 0,
moderate: 0,
difficult: 0,
very_difficult: 0,
});
const id = () => typeof crypto !== 'undefined' && crypto.randomUUID
? crypto.randomUUID()
: `section-${Date.now()}-${Math.random()}`;
const normal = (value: unknown) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
const statusLabel = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const toLocal = (value?: string | null) => value ? new Date(value).toISOString().slice(0, 16) : '';
const toIso = (value: string) => value ? new Date(value).toISOString() : undefined;
const sanitize = (value: string) => value
.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
.replace(/\son\w+="[^"]*"/gi, '')
.replace(/\son\w+='[^']*'/gi, '')
.replace(/javascript:/gi, '');
function emptySection(order = 0, mode: PaperSelectionMode = 'manual', subjectNames: string[] = DEFAULT_SUBJECTS): PaperSectionInput {
return {
client_id: id(),
title: `Section ${String.fromCharCode(65 + order)}`,
subject_key: subjectNames[Math.min(order, subjectNames.length - 1)] || 'Physics',
biology_division: 'combined',
selection_mode: mode,
question_target: 0,
difficulty_distribution: emptyDistribution(),
chapter_ids: [],
topic_ids: [],
display_order: order,
};
}
function gradeMatches(questionGrade: string | null, paperGrade: string) {
if (!paperGrade || paperGrade === 'Custom') return true;
if (!questionGrade) return false;
const paper = normal(paperGrade);
const question = normal(questionGrade);
const grade = paper.match(/grade(\d+)/)?.[1];
if (grade) return question.includes(`grade${grade}`) || question.includes(`class${grade}`) || question === grade;
if (paper === 'neetlongterm') return ['neetlongterm', 'neetrepeaters', 'longtermneet'].some((value) => question.includes(value));
if (paper === 'jeelongterm') return ['jeelongterm', 'jeerepeaters', 'longtermjee'].some((value) => question.includes(value));
return question.includes(paper);
}
function examMatches(question: QuestionRow, exam: string) {
if (!exam || exam === 'Custom') return true;
const target = normal(exam);
return (question.exam_types || []).some((value) => normal(value) === target || normal(value).includes(target) || target.includes(normal(value)));
}
function subjectAliases(subject: string) {
const map: Record<string, string[]> = {
Physics: ['physics', 'phy'],
Chemistry: ['chemistry', 'chem'],
Mathematics: ['mathematics', 'maths', 'math'],
Biology: ['biology', 'botany', 'zoology'],
'Logical Reasoning': ['logicalreasoning', 'reasoning', 'aptitude', 'mentalability'],
};
return map[subject] || [normal(subject)];
}
function subjectMatches(question: QuestionRow, section: PaperSectionInput) {
const subject = section.subject_key || '';
if (!subject) return true;
const name = normal(question.subjects?.name);
const code = normal(question.subjects?.code);
const tags = (question.tags || []).map(normal);
const biologyDivision = String(question.metadata?.biology_division || '').toLowerCase();
if (subject === 'Biology') {
if (!['biology', 'botany', 'zoology'].some((value) => name.includes(value) || code.includes(value))) return false;
if (section.biology_division === 'botany') return biologyDivision === 'botany' || name.includes('botany') || code.includes('botany') || tags.includes('botany');
if (section.biology_division === 'zoology') return biologyDivision === 'zoology' || name.includes('zoology') || code.includes('zoology') || tags.includes('zoology');
return true;
}
return subjectAliases(subject).some((value) => name.includes(value) || code.includes(value) || tags.includes(value));
}
type Selected = PaperQuestionInput & { question: QuestionRow };
type PublishReadinessCheck = { code: string; label: string; ok: boolean; message: string };
type PublishReadiness = { paper_id: string; ready: boolean; checks: PublishReadinessCheck[] };
type Builder = {
id: string | null;
title: string;
code: string;
description: string;
exam: string;
grade: string;
customGrade: string;
testType: PaperTestType;
customTestType: string;
duration: number;
attempts: number;
resultMode: ResultMode;
from: string;
until: string;
openForever: boolean;
shuffleQuestions: boolean;
shuffleOptions: boolean;
defaultMode: PaperSelectionMode;
isPyq: boolean;
sourceYear: string;
sourceVariant: string;
sourcePaperCode: string;
};
const emptyBuilder = (): Builder => ({
id: null,
title: '',
code: '',
description: '<p>Read every question carefully. Answers are autosaved. Submit before the timer reaches zero.</p>',
exam: 'NEET',
grade: 'Grade 11',
customGrade: '',
testType: 'full_length_mock',
customTestType: '',
duration: 180,
attempts: 1,
resultMode: 'score_only',
from: '',
until: '',
openForever: true,
shuffleQuestions: false,
shuffleOptions: false,
defaultMode: 'manual',
isPyq: false,
sourceYear: '',
sourceVariant: 'Main',
sourcePaperCode: '',
});
function statusClass(status: PaperStatus) {
if (status === 'published') return 'border-[var(--teal)]/15 bg-[var(--secondary)] text-[var(--teal)]';
if (status === 'approved') return 'border-[#237A57]/15 bg-[#237A57]/10 text-[#237A57]';
if (status === 'under_review') return 'border-[var(--amber)]/30 bg-[var(--amber)]/20 text-[#8A5F00]';
if (status === 'rejected') return 'border-[var(--destructive)]/20 bg-[var(--destructive)]/10 text-[var(--destructive)]';
if (status === 'paused') return 'border-[var(--info)]/20 bg-[var(--info)]/10 text-[var(--info)]';
if (status === 'closed' || status === 'archived') return 'border-[var(--foreground)]/10 bg-[var(--foreground)]/10 text-[#44545C]';
return 'border-[var(--line)] bg-[var(--canvas)] text-[var(--muted-foreground)]';
}
function SectionHeading({ number, title, description, action }: {
number: string;
title: string;
description: string;
action?: ReactNode;
}) {
return (
<div className="flex flex-col gap-3 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-start sm:justify-between">
<div className="flex items-start gap-3">
<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--teal)] text-xs font-bold text-white">{number}</span>
<div>
<h3 className="font-semibold text-[var(--foreground)]">{title}</h3>
<p className="mt-0.5 max-w-3xl text-xs leading-relaxed text-[var(--muted-foreground)]">{description}</p>
</div>
</div>
{action && <div className="shrink-0">{action}</div>}
</div>
);
}
function RichDescription({ value, onChange }: { value: string; onChange: (value: string) => void }) {
const ref = useRef<HTMLDivElement>(null);
useEffect(() => {
if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value;
}, [value]);
const command = (name: string, commandValue?: string) => {
ref.current?.focus();
document.execCommand(name, false, commandValue);
onChange(sanitize(ref.current?.innerHTML || ''));
};
const tools = [
{ title: 'Bold', icon: Bold, run: () => command('bold') },
{ title: 'Italic', icon: Italic, run: () => command('italic') },
{ title: 'Underline', icon: Underline, run: () => command('underline') },
{ title: 'Highlight', icon: Highlighter, run: () => command('hiliteColor', '#FCF1DB') },
{ title: 'Heading', icon: Heading3, run: () => command('formatBlock', 'h3') },
{ title: 'Clear formatting', icon: Eraser, run: () => command('removeFormat') },
];
return (
<div className="overflow-hidden rounded-xl border border-[var(--line)] bg-white">
<div className="flex flex-wrap items-center gap-1 border-b border-[var(--line)] bg-[var(--canvas)] p-2">
{tools.map(({ title, icon: Icon, run }) => (
<Button key={title} type="button" variant="ghost" size="icon" title={title} onClick={run} className="h-9 w-9 text-[#44545C] hover:bg-[var(--secondary)] hover:text-[var(--teal)]">
<Icon className="h-4 w-4" />
</Button>
))}
<label className="ml-1 flex h-9 cursor-pointer items-center gap-2 rounded-lg px-2 text-xs font-medium text-[#44545C] hover:bg-[var(--secondary)]">
Text colour
<input aria-label="Text colour" type="color" className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0" onChange={(event) => command('foreColor', event.target.value)} />
</label>
</div>
<div
ref={ref}
contentEditable
suppressContentEditableWarning
onInput={(event) => onChange(sanitize(event.currentTarget.innerHTML))}
className="min-h-32 px-4 py-3 text-sm leading-6 text-[var(--foreground)] outline-none empty:before:text-[#AEB8BC] empty:before:content-['Add_a_formatted_description_for_students'] [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5"
/>
</div>
);
}
export function LivePaperCatalogueV8({ kind, startInCreate = false }: { kind: 'admin' | 'school'; startInCreate?: boolean }) {
const { configured, profile, user } = useAuth();
const role = normalizeEvidaraRole(profile?.role);
const { organizationId, organizationName, loading: scopeLoading, error: scopeError } = useQuestionScope(kind);
const { grades, exams, testTypes, error: settingsError } = useAssessmentOptions(organizationId);
const [papers, setPapers] = useState<PaperListRow[]>([]);
const [questions, setQuestions] = useState<QuestionRow[]>([]);
const [subjects, setSubjects] = useState<TaxonomySubject[]>([]);
const [chapters, setChapters] = useState<TaxonomyChapter[]>([]);
const [topics, setTopics] = useState<TaxonomyTopic[]>([]);
const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);
const [readinessLoading, setReadinessLoading] = useState(false);
const [publishReadiness, setPublishReadiness] = useState<PublishReadiness | null>(null);
const [readinessFingerprint, setReadinessFingerprint] = useState('');
const [readinessPaperId, setReadinessPaperId] = useState('');
const [cloningPaperId, setCloningPaperId] = useState('');
const [error, setError] = useState('');
const [message, setMessage] = useState('');
const [search, setSearch] = useState('');
const [statusFilter, setStatusFilter] = useState('all');
const [builderOpen, setBuilderOpen] = useState(false);
const [builderStep, setBuilderStep] = useState<1 | 2 | 3 | 4 | 5>(1);
const [previewOpen, setPreviewOpen] = useState(false);
const [importOpen, setImportOpen] = useState(false);
const [paperFileImportOpen, setPaperFileImportOpen] = useState(false);
const [pyqManagerOpen, setPyqManagerOpen] = useState(false);
const [builder, setBuilder] = useState<Builder>(emptyBuilder);
const [sections, setSections] = useState<PaperSectionInput[]>([emptySection()]);
const [activeSection, setActiveSection] = useState('');
const [selected, setSelected] = useState<Selected[]>([]);
const [questionSearch, setQuestionSearch] = useState('');
const [difficultyFilter, setDifficultyFilter] = useState('all');
const [autosave, setAutosave] = useState('Autosave ready');
const [importBefore, setImportBefore] = useState<Set<string> | null>(null);
const [importSection, setImportSection] = useState('');
const subjectNames = useMemo(() => { const names = subjects.map((item) => item.name); return names.length ? names : DEFAULT_SUBJECTS; }, [subjects]);
const [deleteTarget, setDeleteTarget] = useState<PaperListRow | null>(null);
const [rejectTarget, setRejectTarget] = useState<PaperListRow | null>(null);
const [rejectionReason, setRejectionReason] = useState('');
const routeHandled = useRef(false);
const draftScope = kind === 'admin' ? 'platform' : organizationId || 'no-institution';
const draftBase = useMemo(() => `evidara-v8-paper:${user?.id || 'anonymous'}:${kind}:${draftScope}`, [draftScope, kind, user?.id]);
const draftKey = `${draftBase}:${builder.id || 'new'}`;
const load = useCallback(async () => {
if (!supabase || !configured) {
setError('Supabase is not configured.');
setLoading(false);
return [] as QuestionRow[];
}
if (kind === 'school' && scopeLoading) return [] as QuestionRow[];
if (kind === 'school' && !organizationId) {
setError(scopeError || 'This account is not linked to a school.');
setLoading(false);
return [] as QuestionRow[];
}
setLoading(true);
setError('');
let paperQuery = supabase.from('question_papers').select('*').order('updated_at', { ascending: false });
paperQuery = kind === 'admin' ? paperQuery.is('organization_id', null) : paperQuery.eq('organization_id', organizationId as string);
const [p, q, s, c, t] = await Promise.all([
paperQuery,
supabase.from('questions').select('*,subjects(name,code),chapters(name),topics(name),question_options(option_key,content_text,content_latex,image_url,is_correct,display_order)').eq('status', 'approved').order('updated_at', { ascending: false }).limit(5000),
supabase.from('subjects').select('id,name,code,organization_id').eq('is_active', true).order('name'),
supabase.from('chapters').select('id,name,subject_id,organization_id').eq('is_active', true).order('name'),
supabase.from('topics').select('id,name,chapter_id,organization_id').eq('is_active', true).order('name'),
]);
const loadError = p.error || q.error || s.error || c.error || t.error;
if (loadError) {
setError(loadError.message.includes('grade_level') ? 'Apply Supabase migration 32, then refresh.' : loadError.message);
} else {
setPapers((p.data || []) as PaperListRow[]);
const visible = ((q.data || []) as unknown as QuestionRow[]).filter((item) => kind === 'admin'
? item.organization_id === null
: item.organization_id === null || item.organization_id === organizationId);
setQuestions(visible);
setSubjects((s.data || []) as TaxonomySubject[]);
setChapters((c.data || []) as TaxonomyChapter[]);
setTopics((t.data || []) as TaxonomyTopic[]);
setLoading(false);
return visible;
}
setLoading(false);
return [] as QuestionRow[];
}, [configured, kind, organizationId, scopeError, scopeLoading]);
useEffect(() => { void load(); }, [load]);
useEffect(() => {
if (!activeSection && sections[0]) setActiveSection(sections[0].client_id);
}, [activeSection, sections]);
useEffect(() => {
if (!builderOpen) return;
const timer = window.setTimeout(() => {
localStorage.setItem(draftKey, JSON.stringify({
savedAt: new Date().toISOString(),
builder,
sections,
selected: selected.map(({ question: _question, ...item }) => item),
}));
setAutosave(`Autosaved ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`);
}, 900);
return () => clearTimeout(timer);
}, [builder, builderOpen, draftKey, sections, selected]);
useEffect(() => {
if (!importBefore) return;
const added = questions.filter((item) => !importBefore.has(item.id));
if (!added.length) return;
const sectionId = importSection || activeSection || sections[0]?.client_id;
if (!sectionId) return;
setSelected((current) => {
const existing = new Set(current.map((item) => item.question_id));
return [
...current,
...added.filter((item) => !existing.has(item.id)).map((question, index) => ({
question_id: question.id,
section_client_id: sectionId,
display_order: current.length + index,
marks: Number(question.marks),
negative_marks: Number(question.negative_marks),
is_mandatory: true,
question,
})),
];
});
setMessage(`${added.length} newly imported approved question${added.length === 1 ? '' : 's'} added.`);
setImportBefore(null);
setImportSection('');
}, [activeSection, importBefore, importSection, questions, sections]);
const active = sections.find((section) => section.client_id === activeSection) || sections[0];
const selectedIds = useMemo(() => new Set(selected.map((item) => item.question_id)), [selected]);
const resolvedGrade = builder.grade === 'Custom' ? builder.customGrade : builder.grade;
const matches = useCallback((question: QuestionRow, section: PaperSectionInput) => (
examMatches(question, builder.exam)
&& gradeMatches(question.class_level, resolvedGrade)
&& subjectMatches(question, section)
&& (!section.chapter_ids?.length || (!!question.chapter_id && section.chapter_ids.includes(question.chapter_id)))
&& (!section.topic_ids?.length || (!!question.topic_id && section.topic_ids.includes(question.topic_id)))
), [builder.exam, resolvedGrade]);
const matchingQuestions = useMemo(() => !active ? [] : questions.filter((question) => (
matches(question, active)
&& (!questionSearch || `${question.stem_text} ${question.chapters?.name || ''} ${question.topics?.name || ''}`.toLowerCase().includes(questionSearch.toLowerCase()))
)), [active, matches, questionSearch, questions]);
const difficultyCounts = useMemo(() => Object.fromEntries(DIFFICULTIES.map((difficulty) => [difficulty, matchingQuestions.filter((question) => question.difficulty === difficulty).length])) as Record<QuestionDifficulty, number>, [matchingQuestions]);
const filteredQuestions = useMemo(() => difficultyFilter === 'all' ? matchingQuestions : matchingQuestions.filter((question) => question.difficulty === difficultyFilter), [difficultyFilter, matchingQuestions]);
const filteredPapers = useMemo(() => papers.filter((paper) => (
(statusFilter === 'all' || paper.status === statusFilter)
&& (!search || `${paper.title} ${paper.code || ''} ${paper.exam_type} ${paper.grade_level || ''}`.toLowerCase().includes(search.toLowerCase()))
)), [papers, search, statusFilter]);
const canApprove = role === 'super_admin' || (kind === 'school' && role === 'school_admin');
const canDeletePaper = role === 'super_admin' || (kind === 'school' && role === 'school_admin');
const submitStatus: PaperStatus = canApprove ? 'published' : 'under_review';
const totalMarks = selected.reduce((sum, item) => sum + Number(item.marks || 0), 0);
const selectedInActive = selected.filter((item) => item.section_client_id === active?.client_id).length;
const publishFingerprint = useMemo(() => JSON.stringify({
  builder: { ...builder, id: undefined },
  sections: sections.map(({ id: _id, ...section }) => section),
  questions: selected.map(({ question: _question, ...item }) => item),
}), [builder, sections, selected]);
const releaseCheckCurrent = Boolean(publishReadiness?.ready && readinessFingerprint === publishFingerprint && readinessPaperId);
const distributionTotal = active
? DIFFICULTIES.reduce((sum, difficulty) => sum + Number(active.difficulty_distribution?.[difficulty] || 0), 0)
: 0;
function resetBuilder() {
setBuilderStep(1);
const section = emptySection(0, 'manual', subjectNames);
setBuilder(emptyBuilder());
setSections([section]);
setActiveSection(section.client_id);
setSelected([]);
setQuestionSearch('');
setDifficultyFilter('all');
setAutosave('Autosave ready');
setPublishReadiness(null);
setReadinessFingerprint('');
setReadinessPaperId('');
}
function openCreate() {
resetBuilder();
setError('');
setMessage('');
const raw = localStorage.getItem(`${draftBase}:new`);
if (raw) {
try {
const draft = JSON.parse(raw);
if (Date.now() - new Date(draft.savedAt).getTime() < 604800000) {
const hydrated = (draft.selected || []).map((item: PaperQuestionInput) => {
const question = questions.find((candidate) => candidate.id === item.question_id);
return question ? { ...item, question } : null;
}).filter(Boolean) as Selected[];
setBuilder({ ...emptyBuilder(), ...draft.builder });
setSections(draft.sections?.length ? draft.sections : [emptySection()]);
setActiveSection(draft.sections?.[0]?.client_id || '');
setSelected(hydrated);
setMessage('Recovered your autosaved paper draft.');
}
} catch {
localStorage.removeItem(`${draftBase}:new`);
}
}
setBuilderOpen(true);
}
async function openEdit(paper: PaperListRow) {
if (!supabase) return;
setBuilderStep(1);
setBuilderOpen(true);
setSaving(true);
setError('');
const [p, s, i] = await Promise.all([
supabase.from('question_papers').select('*').eq('id', paper.id).single(),
supabase.from('paper_sections').select('*').eq('paper_id', paper.id).order('display_order'),
supabase.from('paper_questions').select('question_id,section_id,display_order,marks,negative_marks,is_mandatory').eq('paper_id', paper.id).order('display_order'),
]);
if (p.error || s.error || i.error || !p.data) {
setError(p.error?.message || s.error?.message || i.error?.message || 'Unable to open paper.');
setSaving(false);
return;
}
const row = p.data as Record<string, any>;
const loadedSections = (s.data || []).map((section: Record<string, any>, index) => ({
client_id: String(section.id),
id: String(section.id),
title: String(section.title),
subject_id: section.subject_id || undefined,
subject_key: section.subject_key || 'Physics',
biology_division: section.biology_division || 'combined',
instructions: section.instructions || undefined,
questions_to_attempt: section.questions_to_attempt || undefined,
selection_mode: section.selection_mode || 'manual',
question_target: Number(section.question_target || 0),
difficulty_distribution: { ...emptyDistribution(), ...(section.difficulty_distribution || {}) },
chapter_ids: section.chapter_ids || [],
topic_ids: section.topic_ids || [],
display_order: index,
})) as PaperSectionInput[];
const sectionsReady = loadedSections.length ? loadedSections : [emptySection()];
const loadedItems = (i.data || []).map((item) => {
const question = questions.find((candidate) => candidate.id === item.question_id);
return question ? {
question_id: item.question_id,
section_client_id: item.section_id,
display_order: item.display_order,
marks: Number(item.marks),
negative_marks: Number(item.negative_marks),
is_mandatory: Boolean(item.is_mandatory),
question,
} : null;
}).filter(Boolean) as Selected[];
const grade = String(row.grade_level || 'Grade 11');
setBuilder({
id: String(row.id),
title: String(row.title || ''),
code: String(row.code || ''),
description: String(row.description || row.instructions || ''),
exam: String(row.exam_type || 'NEET'),
grade,
customGrade: '',
testType: row.test_type || 'full_length_mock',
customTestType: String(row.custom_test_type || ''),
duration: Number(row.duration_minutes || 60),
attempts: Number(row.attempt_limit || 1),
resultMode: row.result_mode || 'score_only',
from: toLocal(row.available_from),
until: toLocal(row.available_until),
openForever: Boolean(row.open_forever),
shuffleQuestions: Boolean(row.shuffle_questions),
shuffleOptions: Boolean(row.shuffle_options),
defaultMode: row.settings?.default_selection_mode || 'manual',
isPyq: Boolean(row.is_previous_year_paper),
sourceYear: row.source_year ? String(row.source_year) : '',
sourceVariant: String(row.source_variant || 'Main'),
sourcePaperCode: String(row.source_paper_code || ''),
});
setSections(sectionsReady);
setActiveSection(sectionsReady[0].client_id);
setSelected(loadedItems);
setSaving(false);
}
useEffect(() => {
if (!startInCreate || loading || routeHandled.current) return;
routeHandled.current = true;
const paperId = new URLSearchParams(window.location.search).get('id');
if (paperId) {
const paper = papers.find((item) => item.id === paperId);
if (paper) void openEdit(paper);
else setError('The requested paper was not found.');
} else {
openCreate();
}
}, [loading, papers, startInCreate]);
function updateSection(clientId: string, patch: Partial<PaperSectionInput>) {
setSections((current) => current.map((section) => section.client_id === clientId ? { ...section, ...patch } : section));
}
function addSection() {
const section = emptySection(sections.length, builder.defaultMode, subjectNames);
setSections((current) => [...current, section]);
setActiveSection(section.client_id);
}
function removeSection(clientId: string) {
if (sections.length === 1) {
setError('A paper needs at least one section.');
return;
}
const next = sections.filter((section) => section.client_id !== clientId).map((section, index) => ({ ...section, display_order: index }));
setSections(next);
setSelected((current) => current.filter((item) => item.section_client_id !== clientId));
if (activeSection === clientId) setActiveSection(next[0].client_id);
}
function addQuestion(question: QuestionRow, sectionId = activeSection) {
if (selectedIds.has(question.id) || !sectionId) return;
setSelected((current) => [...current, {
question_id: question.id,
section_client_id: sectionId,
display_order: current.length,
marks: Number(question.marks),
negative_marks: Number(question.negative_marks),
is_mandatory: true,
question,
}]);
}
function removeQuestion(questionId: string) {
setSelected((current) => current.filter((item) => item.question_id !== questionId).map((item, index) => ({ ...item, display_order: index })));
}
function moveQuestion(index: number, direction: -1 | 1) {
const target = index + direction;
if (target < 0 || target >= selected.length) return;
const next = [...selected];
[next[index], next[target]] = [next[target], next[index]];
setSelected(next.map((item, itemIndex) => ({ ...item, display_order: itemIndex })));
}
function buildAutomatic(section: PaperSectionInput, reserved: Set<string>) {
const target = Number(section.question_target || 0);
const plan = { ...emptyDistribution(), ...(section.difficulty_distribution || {}) };
const total = DIFFICULTIES.reduce((sum, difficulty) => sum + Number(plan[difficulty] || 0), 0);
if (target < 1 || total !== target) {
return { error: `${section.title}: difficulty counts must equal the total question target.`, items: [] as Selected[] };
}
const pool = questions.filter((question) => matches(question, section) && !reserved.has(question.id));
const items: Selected[] = [];
for (const difficulty of DIFFICULTIES) {
const required = Number(plan[difficulty] || 0);
const available = pool.filter((question) => question.difficulty === difficulty && !items.some((item) => item.question_id === question.id));
if (available.length < required) {
return { error: `${section.title}: only ${available.length} ${DIFFICULTY_LABEL[difficulty].toLowerCase()} questions match; ${required} required.`, items: [] as Selected[] };
}
const picked = [...available].sort(() => Math.random() - 0.5).slice(0, required);
items.push(...picked.map((question, index) => ({
question_id: question.id,
section_client_id: section.client_id,
display_order: index,
marks: Number(question.marks),
negative_marks: Number(question.negative_marks),
is_mandatory: true,
question,
})));
}
return { error: '', items };
}
function generateSection(section: PaperSectionInput) {
const reserved = new Set<string>(selected.filter((item) => item.section_client_id !== section.client_id).map((item) => item.question_id));
const result = buildAutomatic(section, reserved);
if (result.error) {
setError(result.error);
return;
}
setSelected((current) => [
...current.filter((item) => item.section_client_id !== section.client_id),
...result.items,
].map((item, index) => ({ ...item, display_order: index })));
setError('');
setMessage(`${result.items.length} questions generated for ${section.title}.`);
}
function generateAll() {
const ids = new Set(sections.filter((section) => section.selection_mode !== 'manual').map((section) => section.client_id));
const retained = selected.filter((item) => !ids.has(item.section_client_id));
const reserved = new Set<string>(retained.map((item) => item.question_id));
const generated: Selected[] = [];
for (const section of sections) {
if (!ids.has(section.client_id)) continue;
const result = buildAutomatic(section, reserved);
if (result.error) {
setError(result.error);
return;
}
result.items.forEach((item) => reserved.add(item.question_id));
generated.push(...result.items);
}
setSelected([...retained, ...generated].map((item, index) => ({ ...item, display_order: index })));
setError('');
setMessage(`${generated.length} questions generated across Automatic/Hybrid sections.`);
}
function validate(status: PaperStatus) {
if (builder.duration < 1) return 'Duration must be at least one minute.';
if (status === 'draft') return '';
if (builder.title.trim().length < 3) return 'Enter a complete paper title.';
if (!resolvedGrade.trim()) return 'Select or enter a grade.';
if (builder.testType === 'custom_test' && builder.customTestType.trim().length < 2) return 'Name the custom test type.';
if (kind === 'admin' && builder.isPyq && (!builder.sourceYear || Number(builder.sourceYear) < 1990 || Number(builder.sourceYear) > 2100)) return 'Choose the official PYQ year.';
if (!selected.length) return 'Add at least one approved question.';
if (!builder.openForever && builder.from && builder.until && new Date(builder.until) <= new Date(builder.from)) return 'Closing time must be later than opening time.';
for (const section of sections) {
if (!section.title.trim()) return 'Every section needs a title.';
if (builder.testType === 'chapter_test' && !section.chapter_ids?.length) return `${section.title}: select a chapter.`;
if (builder.testType === 'topic_test' && !section.topic_ids?.length) return `${section.title}: select a topic.`;
if (section.selection_mode !== 'manual' && DIFFICULTIES.reduce((sum, difficulty) => sum + Number(section.difficulty_distribution?.[difficulty] || 0), 0) !== Number(section.question_target || 0)) {
return `${section.title}: difficulty counts must equal its question target.`;
}
}
return '';
}
async function savePaper(status: PaperStatus, paperIdOverride?: string) {
if (!supabase) return;
const validation = validate(status);
if (validation) {
setError(validation);
return;
}
const payload: PaperPayload = {
title: builder.title.trim() || 'Untitled Paper',
code: builder.code.trim() || undefined,
description: sanitize(builder.description) || undefined,
exam_type: builder.exam,
grade_level: resolvedGrade,
test_type: builder.testType,
custom_test_type: builder.testType === 'custom_test' ? builder.customTestType.trim() : undefined,
status,
duration_minutes: builder.duration,
instructions: sanitize(builder.description),
access_mode: kind === 'admin' ? 'public' : 'organization',
available_from: builder.openForever ? undefined : toIso(builder.from),
available_until: builder.openForever ? undefined : toIso(builder.until),
open_forever: builder.openForever,
attempt_limit: builder.attempts,
shuffle_questions: builder.shuffleQuestions,
shuffle_options: builder.shuffleOptions,
result_mode: builder.resultMode,
settings: { default_selection_mode: builder.defaultMode, builder_version: 'v8' },
sections: sections.map((section, index) => ({ ...section, display_order: index })),
questions: selected.map((item, index) => ({
question_id: item.question_id,
section_client_id: item.section_client_id,
display_order: index,
marks: item.marks,
negative_marks: item.negative_marks,
is_mandatory: item.is_mandatory,
})),
};
setSaving(true);
setError('');
const wasNew = !(paperIdOverride || builder.id);
const key = draftKey;
const { data, error: saveError } = await supabase.rpc('save_question_paper', {
p_paper_id: paperIdOverride || builder.id,
p_organization_id: kind === 'admin' ? null : organizationId,
p_payload: payload,
});
if (!saveError && kind === 'admin' && role === 'super_admin') {
  const savedPaperId = String(data || paperIdOverride || builder.id || '');
  if (savedPaperId) {
    const { error: pyqIdentityError } = await supabase.rpc('set_question_paper_pyq_identity_v18', {
      p_paper_id: savedPaperId,
      p_is_pyq: builder.isPyq,
      p_year: builder.isPyq && builder.sourceYear ? Number(builder.sourceYear) : null,
      p_variant: builder.isPyq ? (builder.sourceVariant.trim() || 'Main') : null,
      p_paper_code: builder.isPyq ? (builder.sourcePaperCode.trim() || null) : null,
    });
    if (pyqIdentityError) {
      setSaving(false);
      setError(`Paper saved, but PYQ identity could not be updated: ${pyqIdentityError.message}`);
      await load();
      return;
    }
  }
}
setSaving(false);
if (saveError) {
setError(saveError.message);
return;
}
if (data && wasNew) {
setBuilder((current) => ({ ...current, id: String(data) }));
localStorage.removeItem(`${draftBase}:new`);
}
if (status !== 'draft') {
localStorage.removeItem(key);
setBuilderOpen(false);
}
setMessage(status === 'draft' ? 'Draft saved.' : status === 'under_review' ? 'Paper submitted for approval.' : 'Paper published.');
await load();
return String(data || paperIdOverride || builder.id || '');
}
async function runPublishPreflight() {
if (!supabase) return;
setReadinessLoading(true);
setError('');
setPublishReadiness(null);
const paperId = await savePaper('draft');
if (!paperId) {
setReadinessLoading(false);
return;
}
const { data, error: readinessError } = await supabase.rpc('get_paper_publish_readiness_v1', { p_paper_id: paperId });
setReadinessLoading(false);
if (readinessError) {
setError(`Release check failed: ${readinessError.message}`);
return;
}
const readiness = data as PublishReadiness;
setPublishReadiness(readiness);
setReadinessFingerprint(publishFingerprint);
setReadinessPaperId(paperId);
if (!readiness.ready) {
const failed = (readiness.checks || []).filter((item) => !item.ok).map((item) => item.label).join(', ');
setError(`Not ready to publish. Fix: ${failed || 'release checklist'}.`);
} else {
setMessage('Release check passed. Publish is unlocked for this exact paper state.');
}
}
async function publishCheckedPaper() {
if (!releaseCheckCurrent || !readinessPaperId) {
setError('Run the release check again before publishing this paper state.');
return;
}
await savePaper('published', readinessPaperId);
}
async function setStatus(paper: PaperListRow, status: PaperStatus, reason: string | null = null) {
if (!supabase) return;
const { error: statusError } = await supabase.rpc('set_question_paper_status_v8', {
p_paper_id: paper.id,
p_status: status,
p_reason: reason,
});
if (statusError) {
setError(statusError.message);
return;
}
setMessage(`Paper moved to ${statusLabel(status)}.`);
await load();
}
async function cloneAsNewVersion(paper: PaperListRow) {
if (!supabase) return;
setCloningPaperId(paper.id);
setError('');
setMessage('');
const { data, error: cloneError } = await supabase.rpc('clone_paper_as_new_version_v1', {
p_source_paper_id: paper.id,
p_title: null,
});
setCloningPaperId('');
if (cloneError) {
setError(cloneError.message);
return;
}
const clone = data as { title?: string; version_number?: number } | null;
setMessage(`Created ${clone?.title || 'a new draft version'}. Audience and publication state were reset.`);
await load();
}
async function confirmDelete() {
if (!supabase || !deleteTarget) return;
setSaving(true);
const { error: deleteError } = await supabase.rpc('delete_question_paper_v8', { p_paper_id: deleteTarget.id });
setSaving(false);
if (deleteError) {
setError(deleteError.message);
return;
}
setDeleteTarget(null);
setMessage('Paper deleted.');
await load();
}
async function confirmReject() {
if (!rejectTarget || !rejectionReason.trim()) return;
await setStatus(rejectTarget, 'rejected', rejectionReason.trim());
setRejectTarget(null);
setRejectionReason('');
}
const chapterOptions = !active ? [] : chapters.filter((chapter) => subjects.some((subject) => (
subject.id === chapter.subject_id
&& subjectAliases(active.subject_key || '').some((alias) => normal(subject.name).includes(alias) || normal(subject.code).includes(alias))
)));
const topicOptions = topics.filter((topic) => active?.chapter_ids?.includes(topic.chapter_id));
const toggle = (values: string[] | undefined, value: string) => (values || []).includes(value)
? (values || []).filter((item) => item !== value)
: [...(values || []), value];
const stats = [
{ label: 'Total papers', value: papers.length, icon: FileQuestion, tone: 'var(--foreground)' },
{ label: 'Published', value: papers.filter((paper) => paper.status === 'published').length, icon: CheckCircle2, tone: 'var(--teal)' },
{ label: 'Under review', value: papers.filter((paper) => paper.status === 'under_review').length, icon: ShieldCheck, tone: '#8A5F00' },
{ label: 'Drafts', value: papers.filter((paper) => paper.status === 'draft').length, icon: Edit3, tone: 'var(--info)' },
];
return (
<div className="space-y-6">
<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
<div>
<div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--teal)]">
<ShieldCheck className="h-4 w-4" />
{kind === 'admin' ? 'Assessment governance' : organizationName}
</div>
<h1 className="mt-2 text-2xl font-bold text-[var(--foreground)]">Tests and Question Papers</h1>
<p className="mt-1 max-w-3xl text-sm leading-relaxed text-[var(--muted-foreground)]">
Build grade-aware papers, configure each section and prepare approved assessments for your institution.
</p>
</div>
<div className="flex flex-wrap gap-2">
<Button variant="outline" onClick={() => void load()} disabled={loading} className="h-11 border-[var(--line)] bg-white">
<RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh
</Button>
{kind === 'admin' && role === 'super_admin' && <Button variant="outline" onClick={()=>setPyqManagerOpen(true)} className="h-11 border-[var(--teal)]/30 bg-white text-[var(--teal)]"><Archive className="mr-2 h-4 w-4" />Build PYQ Paper</Button>}
{kind === 'admin' && <Button variant="outline" onClick={()=>setPaperFileImportOpen(true)} className="h-11 border-[var(--line)] bg-white"><Upload className="mr-2 h-4 w-4" />Import Year / Paper</Button>}
<Button onClick={openCreate} className="h-11 bg-[var(--teal)] text-white hover:bg-[#0A4747]">
<FilePlus2 className="mr-2 h-4 w-4" />Create Paper
</Button>
</div>
</div>
{(scopeError || error || settingsError) && (
<div className="rounded-xl border border-[var(--destructive)]/20 bg-[var(--destructive)]/5 px-4 py-3 text-sm text-[var(--destructive)]">{scopeError || error || settingsError}</div>
)}
{message && (
<div className="rounded-xl border border-[var(--teal)]/20 bg-[var(--secondary)]/60 px-4 py-3 text-sm text-[var(--teal)]">{message}</div>
)}
<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
{stats.map(({ label, value, icon: Icon, tone }) => (
<Card key={label} className="min-w-0 gap-0 border-[var(--line)] shadow-sm rounded-xl">
<CardContent className="flex items-center justify-between p-4">
<div>
<p className="text-xs font-medium text-[var(--muted-foreground)]">{label}</p>
<p className="mt-1 text-2xl font-bold tabular-nums" style={{ color: tone }}>{value}</p>
</div>
<div className="rounded-lg p-2.5" style={{ backgroundColor: `${tone}12`, color: tone }}>
<Icon className="h-5 w-5" />
</div>
</CardContent>
</Card>
))}
</div>
<Card className="gap-0 border-[var(--line)] shadow-sm rounded-xl">
<CardContent className="p-4">
<div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
<div className="relative">
<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
<Input
value={search}
onChange={(event) => setSearch(event.target.value)}
placeholder="Search paper title, code, exam or grade"
className="h-11 border-[var(--line)] pl-9"
/>
</div>
<Select value={statusFilter} onValueChange={setStatusFilter}>
<SelectTrigger className="h-11 border-[var(--line)]"><SelectValue /></SelectTrigger>
<SelectContent>
<SelectItem value="all">All statuses</SelectItem>
{STATUSES.map((status) => <SelectItem key={status} value={status}>{statusLabel(status)}</SelectItem>)}
</SelectContent>
</Select>
</div>
<div className="mt-3 flex items-center justify-between border-t border-[var(--line)] pt-3 text-xs text-[var(--muted-foreground)]">
<span>{filteredPapers.length} matching paper{filteredPapers.length === 1 ? '' : 's'}</span>
<span>Paper workflow</span>
</div>
</CardContent>
</Card>
<Card className="gap-0 overflow-hidden border-[var(--line)] shadow-sm rounded-xl">
<div className="overflow-x-auto">
<Table className="min-w-[1240px]">
<TableHeader>
<TableRow className="border-[var(--line)] bg-[var(--canvas)] hover:bg-[var(--canvas)]">
<TableHead className="text-xs font-semibold text-[var(--muted-foreground)]">Paper</TableHead>
<TableHead className="text-xs font-semibold text-[var(--muted-foreground)]">Exam and grade</TableHead>
<TableHead className="text-xs font-semibold text-[var(--muted-foreground)]">Test type</TableHead>
<TableHead className="text-xs font-semibold text-[var(--muted-foreground)]">Questions</TableHead>
<TableHead className="text-xs font-semibold text-[var(--muted-foreground)]">Marks</TableHead>
<TableHead className="text-xs font-semibold text-[var(--muted-foreground)]">Duration</TableHead>
<TableHead className="text-xs font-semibold text-[var(--muted-foreground)]">Results</TableHead>
<TableHead className="text-xs font-semibold text-[var(--muted-foreground)]">Status</TableHead>
<TableHead className="text-right text-xs font-semibold text-[var(--muted-foreground)]">Actions</TableHead>
</TableRow>
</TableHeader>
<TableBody>
{loading ? (
<TableRow><TableCell colSpan={9} className="py-14 text-center text-sm text-[var(--muted-foreground)]"><LoaderCircle className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading papers…</TableCell></TableRow>
) : filteredPapers.length === 0 ? (
<TableRow><TableCell colSpan={9} className="py-14 text-center text-sm text-[var(--muted-foreground)]">No papers match the current filters.</TableCell></TableRow>
) : filteredPapers.map((paper) => (
<TableRow key={paper.id} className="border-[var(--line)] hover:bg-[var(--canvas)]/70">
<TableCell className="max-w-[300px]">
<div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-[var(--foreground)]">{paper.title}</p>{paper.is_previous_year_paper && <Badge className="bg-[var(--secondary)] text-[var(--teal)]">PYQ {paper.source_year || ""}</Badge>}{paper.source_variant && paper.source_variant !== "Main" && <Badge variant="outline">{paper.source_variant}</Badge>}</div>
<p className="mt-1 text-xs text-[var(--muted-foreground)]">{paper.source_paper_code ? `Code ${paper.source_paper_code} · ` : ""}{paper.code || 'No paper code'}{paper.paper_origin === "file_import" ? " · File import" : paper.paper_origin === "pyq_generated" ? " · Exact PYQ build" : ""}</p>
{paper.rejection_reason && <p className="mt-1 line-clamp-2 text-xs text-[var(--destructive)]">Reason: {paper.rejection_reason}</p>}
</TableCell>
<TableCell><p className="text-sm font-medium text-[var(--foreground)]">{paper.exam_type}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">{paper.grade_level || 'No grade'}</p></TableCell>
<TableCell className="max-w-[190px] text-sm text-[#44545C]">{paper.test_type === 'custom_test' ? paper.custom_test_type : testTypes.find((item) => item.value === paper.test_type)?.label || statusLabel(String(paper.test_type || ''))}</TableCell>
<TableCell className="text-sm tabular-nums text-[var(--foreground)]">{paper.total_questions}</TableCell>
<TableCell className="text-sm tabular-nums text-[var(--foreground)]">{paper.total_marks}</TableCell>
<TableCell className="text-sm text-[#44545C]">{paper.duration_minutes} min</TableCell>
<TableCell className="text-sm text-[#44545C]">{paper.result_mode === 'in_depth_analytics' ? 'Score and answers' : statusLabel(paper.result_mode)}</TableCell>
<TableCell><Badge variant="outline" className={statusClass(paper.status)}>{statusLabel(paper.status)}</Badge></TableCell>
<TableCell className="text-right">
<div className="flex justify-end gap-1">
<Button variant="ghost" size="icon" title="Clone as new version" disabled={cloningPaperId === paper.id} onClick={() => void cloneAsNewVersion(paper)} className="h-9 w-9 text-[#44545C] hover:bg-[var(--line)]">{cloningPaperId === paper.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CopyPlus className="h-4 w-4" />}</Button>
<Button variant="ghost" size="icon" title="Edit paper" onClick={() => void openEdit(paper)} className="h-9 w-9 text-[var(--teal)] hover:bg-[var(--secondary)]"><Edit3 className="h-4 w-4" /></Button>
{paper.status === 'under_review' && canApprove && (
<>
<Button variant="ghost" size="icon" title="Approve paper" onClick={() => void setStatus(paper, 'approved')} className="h-9 w-9 text-[#237A57] hover:bg-[#237A57]/10"><Check className="h-4 w-4" /></Button>
<Button variant="ghost" size="icon" title="Reject paper" onClick={() => { setRejectTarget(paper); setRejectionReason(''); }} className="h-9 w-9 text-[var(--destructive)] hover:bg-[var(--destructive)]/10"><XCircle className="h-4 w-4" /></Button>
</>
)}
{paper.status === 'approved' && canApprove && <Button variant="ghost" size="icon" title="Publish paper" onClick={() => void setStatus(paper, 'published')} className="h-9 w-9 text-[var(--teal)] hover:bg-[var(--secondary)]"><PlayCircle className="h-4 w-4" /></Button>}
{paper.status === 'published' && canApprove && <Button variant="ghost" size="icon" title="Pause paper" onClick={() => void setStatus(paper, 'paused')} className="h-9 w-9 text-[var(--info)] hover:bg-[var(--info)]/10"><PauseCircle className="h-4 w-4" /></Button>}
{paper.status === 'paused' && canApprove && <Button variant="ghost" size="icon" title="Resume paper" onClick={() => void setStatus(paper, 'published')} className="h-9 w-9 text-[var(--teal)] hover:bg-[var(--secondary)]"><PlayCircle className="h-4 w-4" /></Button>}
{['published', 'paused'].includes(paper.status) && canApprove && <Button variant="ghost" size="icon" title="Close paper" onClick={() => void setStatus(paper, 'closed')} className="h-9 w-9 text-[#44545C] hover:bg-[var(--line)]"><CircleStop className="h-4 w-4" /></Button>}
{paper.status !== 'archived' && canApprove && <Button variant="ghost" size="icon" title="Archive paper" onClick={() => void setStatus(paper, 'archived')} className="h-9 w-9 text-[#8A5F00] hover:bg-[var(--amber)]/15"><Archive className="h-4 w-4" /></Button>}
{canDeletePaper && <Button variant="ghost" size="icon" title="Delete paper" onClick={() => setDeleteTarget(paper)} className="h-9 w-9 text-[var(--destructive)] hover:bg-[var(--destructive)]/10"><Trash2 className="h-4 w-4" /></Button>}
</div>
</TableCell>
</TableRow>
))}
</TableBody>
</Table>
</div>
</Card>
<Dialog open={builderOpen} onOpenChange={(next) => { if (!saving) setBuilderOpen(next); }}>
<DialogContent className="flex max-h-[96vh] w-[96vw] max-w-[1540px] flex-col overflow-hidden border-[var(--line)] p-0">
<DialogHeader className="border-b border-[var(--line)] px-4 py-4 sm:px-6">
<div className="flex flex-col gap-3 pr-8 lg:flex-row lg:items-start lg:justify-between">
<div>
<DialogTitle className="text-xl text-[var(--foreground)]">{builder.id ? 'Edit Question Paper' : 'Create Question Paper'}</DialogTitle>
<DialogDescription className="mt-1 max-w-3xl">Complete the setup, configure each section, select approved questions and review the learner-facing paper in one workspace.</DialogDescription>
</div>
<div className="flex flex-wrap items-center gap-2">
<Badge className="bg-[var(--secondary)] text-[var(--teal)]">{builder.exam}</Badge>
<Badge variant="outline" className="border-[var(--line)] text-[var(--muted-foreground)]">{resolvedGrade || 'Grade pending'}</Badge>
<Badge variant="outline" className="border-[var(--line)] text-[var(--muted-foreground)]">{autosave}</Badge>
</div>
</div>
</DialogHeader>
<div className="min-h-0 flex-1 overflow-y-auto bg-[#FBFCFC] px-3 py-4 sm:px-6 sm:py-5">
{error && <div className="mb-4 rounded-xl border border-[var(--destructive)]/20 bg-[var(--destructive)]/5 px-4 py-3 text-sm text-[var(--destructive)]">{error}</div>}
<div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
{[
{ label: 'Sections', value: sections.length, icon: Layers3 },
{ label: 'Questions', value: selected.length, icon: FileQuestion },
{ label: 'Total marks', value: totalMarks, icon: BookOpenCheck },
{ label: 'Duration', value: `${builder.duration} min`, icon: Clock3 },
].map(({ label, value, icon: Icon }) => (
<div key={label} className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-white px-4 py-3">
<div><p className="text-xs text-[var(--muted-foreground)]">{label}</p><p className="mt-1 text-lg font-bold tabular-nums text-[var(--foreground)]">{value}</p></div>
<Icon className="h-5 w-5 text-[var(--teal)]" />
</div>
))}
</div>
<div className="mb-5 overflow-x-auto rounded-xl border border-[var(--line)] bg-white p-2">
<div className="grid min-w-[620px] grid-cols-5 gap-2">
{([
{ step: 1 as const, label: 'Details' },
{ step: 2 as const, label: 'Questions' },
{ step: 3 as const, label: 'Audience' },
{ step: 4 as const, label: 'Settings' },
{ step: 5 as const, label: 'Preview & Publish' },
]).map((item) => (
<button key={item.step} type="button" onClick={() => setBuilderStep(item.step)} className={`rounded-lg px-3 py-2 text-left transition ${builderStep === item.step ? 'bg-[var(--teal)] text-white' : 'text-[var(--muted-foreground)] hover:bg-[var(--canvas)]'}`}>
<span className="block text-[10px] font-semibold uppercase tracking-[0.12em] opacity-75">Step {item.step}</span>
<span className="mt-0.5 block text-sm font-semibold">{item.label}</span>
</button>
))}
</div>
</div>
<div className="space-y-5">
{builderStep === 1 && (
<Card className="gap-0 border-[var(--line)] bg-white shadow-sm rounded-xl">
<CardContent className="space-y-5 p-4 sm:p-5">
<SectionHeading number="1" title="Paper identity" description="Define the paper once so question filtering, approval and future product bundling remain accurate." />
<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
<div className="space-y-2 md:col-span-2"><Label>Paper title</Label><Input value={builder.title} onChange={(event) => setBuilder((current) => ({ ...current, title: event.target.value }))} placeholder="NEET Full Syllabus Mock 01" className="h-11 border-[var(--line)]" /></div>
<div className="space-y-2"><Label>Paper code</Label><Input value={builder.code} onChange={(event) => setBuilder((current) => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="NEET-M01" className="h-11 border-[var(--line)]" /></div>
<div className="space-y-2"><Label>Exam type</Label><Select value={builder.exam} onValueChange={(exam) => setBuilder((current) => ({ ...current, exam }))}><SelectTrigger className="h-11 border-[var(--line)]"><SelectValue /></SelectTrigger><SelectContent>{exams.map((item) => <SelectItem key={item.id} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
<div className="space-y-2"><span className="text-sm font-medium text-[var(--foreground)]">Grade</span><Select value={builder.grade} onValueChange={(grade) => setBuilder((current) => ({ ...current, grade }))}><SelectTrigger className="h-11 border-[var(--line)]"><SelectValue /></SelectTrigger><SelectContent>{grades.map((item) => <SelectItem key={item.id} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>

{kind === 'admin' && role === 'super_admin' && <div className="md:col-span-2 xl:col-span-4 rounded-xl border border-[var(--line)] bg-[var(--canvas)] p-4">
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div><Label>Official previous-year paper</Label><p className="mt-1 text-xs text-[var(--muted-foreground)]">Attach an exact exam year/variant to this paper and map its selected questions to that official paper.</p></div>
    <Switch checked={builder.isPyq} onCheckedChange={(isPyq) => setBuilder((current) => ({ ...current, isPyq, testType: isPyq ? 'previous_year_paper' : current.testType }))} />
  </div>
  {builder.isPyq && <div className="mt-4 grid gap-3 sm:grid-cols-3">
    <div className="space-y-2"><Label>Year</Label><Input type="number" min={1990} max={2100} value={builder.sourceYear} onChange={(event) => setBuilder((current) => ({ ...current, sourceYear: event.target.value }))} placeholder="2026" className="h-10 border-[var(--line)] bg-white" /></div>
    <div className="space-y-2"><Label>Variant</Label><Input value={builder.sourceVariant} onChange={(event) => setBuilder((current) => ({ ...current, sourceVariant: event.target.value }))} placeholder="Main / Re-NEET / Phase II" className="h-10 border-[var(--line)] bg-white" /></div>
    <div className="space-y-2"><Label>Paper / set code</Label><Input value={builder.sourcePaperCode} onChange={(event) => setBuilder((current) => ({ ...current, sourcePaperCode: event.target.value }))} placeholder="11 / C1 / AA" className="h-10 border-[var(--line)] bg-white" /></div>
  </div>}
</div>}

<div className="space-y-2"><Label>Test type</Label><Select value={builder.testType} onValueChange={(testType) => setBuilder((current) => ({ ...current, testType: testType as PaperTestType }))}><SelectTrigger className="h-11 border-[var(--line)]"><SelectValue /></SelectTrigger><SelectContent>{testTypes.map((item) => <SelectItem key={item.id} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
{builder.testType === 'custom_test' && <div className="space-y-2"><Label>Custom test name</Label><Input value={builder.customTestType} onChange={(event) => setBuilder((current) => ({ ...current, customTestType: event.target.value }))} placeholder="School Pre-Board Test" className="h-11 border-[var(--line)]" /></div>}
<div className="space-y-2 md:col-span-2 xl:col-span-4"><Label>Formatted description</Label><p className="text-xs text-[var(--muted-foreground)]">This is the only student-facing description. Use headings, emphasis, colours or highlights when needed.</p><RichDescription value={builder.description} onChange={(description) => setBuilder((current) => ({ ...current, description }))} /></div>
</div>
</CardContent>
</Card>
)}
{builderStep === 3 && (
<div className="space-y-4">
<SectionHeading number="3" title="Audience" description="Choose the students who can take this institutional test and preview the exact eligible cohort before publishing." />
{kind === 'school' ? (builder.id ? <PaperAssignmentCenter paperId={builder.id} embedded /> : <Card className="gap-0 border-[var(--line)] bg-white shadow-sm rounded-xl"><CardContent className="space-y-3 p-5"><p className="text-sm font-semibold text-[var(--foreground)]">Save this paper draft before choosing its audience.</p><p className="text-sm text-[var(--muted-foreground)]">Audience eligibility is server-validated against the saved paper, active student memberships and the institution licence.</p><Button type="button" variant="outline" disabled={saving} onClick={() => void savePaper('draft')} className="border-[var(--teal)]/30 text-[var(--teal)]">{saving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save draft to configure audience</Button></CardContent></Card>) : <Card className="gap-0 border border-[var(--line)] bg-white shadow-sm rounded-xl"><CardContent className="p-5 text-sm text-[var(--muted-foreground)]">Platform papers do not use an institution student audience. Continue to Settings.</CardContent></Card>}
</div>
)}
{builderStep === 4 && (
<Card className="gap-0 border-[var(--line)] bg-white shadow-sm rounded-xl">
<CardContent className="space-y-5 p-4 sm:p-5">
<SectionHeading number="4" title="Delivery and student experience" description="Set time, attempts, schedule, shuffle and result visibility for the assigned test." />
<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
<div className="space-y-2"><Label>Duration (minutes)</Label><Input type="number" min={1} value={builder.duration} onChange={(event) => setBuilder((current) => ({ ...current, duration: Number(event.target.value) }))} className="h-11 border-[var(--line)]" /></div>
<div className="space-y-2"><Label>Attempts allowed</Label><Input type="number" min={1} value={builder.attempts} onChange={(event) => setBuilder((current) => ({ ...current, attempts: Number(event.target.value) }))} className="h-11 border-[var(--line)]" /></div>
<div className="space-y-2"><Label>Result display</Label><Select value={builder.resultMode} onValueChange={(resultMode) => setBuilder((current) => ({ ...current, resultMode: resultMode as ResultMode }))}><SelectTrigger className="h-11 border-[var(--line)]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="score_only">Score only</SelectItem><SelectItem value="score_and_answers">Score and answers</SelectItem></SelectContent></Select></div>
<div className="flex min-h-20 items-center justify-between rounded-xl border border-[var(--line)] px-4 py-3"><div><Label>Open forever</Label><p className="mt-1 text-xs text-[var(--muted-foreground)]">No opening or closing date</p></div><Switch checked={builder.openForever} onCheckedChange={(openForever) => setBuilder((current) => ({ ...current, openForever }))} /></div>
{!builder.openForever && <><div className="space-y-2"><Label>Opens at</Label><Input type="datetime-local" value={builder.from} onChange={(event) => setBuilder((current) => ({ ...current, from: event.target.value }))} className="h-11 border-[var(--line)]" /></div><div className="space-y-2"><Label>Closes at</Label><Input type="datetime-local" value={builder.until} onChange={(event) => setBuilder((current) => ({ ...current, until: event.target.value }))} className="h-11 border-[var(--line)]" /></div></>}
<div className="flex min-h-20 items-center justify-between rounded-xl border border-[var(--line)] px-4 py-3"><div><Label>Shuffle questions</Label><p className="mt-1 text-xs text-[var(--muted-foreground)]">Change order per attempt</p></div><Switch checked={builder.shuffleQuestions} onCheckedChange={(shuffleQuestions) => setBuilder((current) => ({ ...current, shuffleQuestions }))} /></div>
<div className="flex min-h-20 items-center justify-between rounded-xl border border-[var(--line)] px-4 py-3"><div><Label>Shuffle options</Label><p className="mt-1 text-xs text-[var(--muted-foreground)]">Randomise MCQ choices</p></div><Switch checked={builder.shuffleOptions} onCheckedChange={(shuffleOptions) => setBuilder((current) => ({ ...current, shuffleOptions }))} /></div>

</div>
</CardContent>
</Card>
)}
{builderStep === 2 && (
<Card className="gap-0 border-[var(--line)] bg-white shadow-sm rounded-xl">
<CardContent className="space-y-5 p-4 sm:p-5">
<SectionHeading
number="2A"
title="Sections and selection strategy"
description="Use one paper-wide default or choose Manual, Automatic or Hybrid independently for every section."
action={<Button type="button" variant="outline" onClick={addSection} className="h-10 border-[var(--line)]"><Plus className="mr-2 h-4 w-4" />Add Section</Button>}
/>
<div className="grid gap-3 rounded-xl border border-[var(--line)] bg-[var(--canvas)] p-3 md:grid-cols-[minmax(0,220px)_auto_auto] md:items-end">
<div className="space-y-2"><Label>Default selection mode</Label><Select value={builder.defaultMode} onValueChange={(defaultMode) => setBuilder((current) => ({ ...current, defaultMode: defaultMode as PaperSelectionMode }))}><SelectTrigger className="h-10 border-[var(--line)] bg-white"><SelectValue /></SelectTrigger><SelectContent>{MODES.map((mode) => <SelectItem key={mode} value={mode}>{statusLabel(mode)}</SelectItem>)}</SelectContent></Select></div>
<Button type="button" variant="outline" onClick={() => setSections((current) => current.map((section) => ({ ...section, selection_mode: builder.defaultMode })))} className="h-10 border-[var(--line)] bg-white">Apply to all sections</Button>
<Button type="button" variant="outline" onClick={generateAll} className="h-10 border-[var(--teal)]/30 bg-white text-[var(--teal)] hover:bg-[var(--secondary)]"><Sparkles className="mr-2 h-4 w-4" />Generate Auto/Hybrid</Button>
</div>
<div className="flex gap-2 overflow-x-auto pb-1">
{sections.map((section, index) => {
const count = selected.filter((item) => item.section_client_id === section.client_id).length;
const selectedSection = section.client_id === activeSection;
return (
<button key={section.client_id} type="button" onClick={() => setActiveSection(section.client_id)} className={`min-w-[190px] rounded-xl border p-3 text-left transition ${selectedSection ? 'border-[var(--teal)] bg-[var(--secondary)]/50' : 'border-[var(--line)] bg-white hover:border-[var(--teal)]/40'}`}>
<div className="flex items-start justify-between gap-2"><span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Section {index + 1}</span><Badge variant="outline" className={selectedSection ? 'border-[var(--teal)]/20 bg-white text-[var(--teal)]' : 'border-[var(--line)] text-[var(--muted-foreground)]'}>{count} Q</Badge></div>
<strong className="mt-2 block truncate text-sm text-[var(--foreground)]">{section.title}</strong>
<span className="mt-1 block text-xs text-[var(--muted-foreground)]">{section.subject_key} · {statusLabel(section.selection_mode || 'manual')}</span>
</button>
);
})}
</div>
{active && (
<div className="space-y-5 rounded-xl border border-[var(--secondary)] bg-[#FBFCFC] p-4">
<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr_auto]">
<div className="space-y-2"><Label>Section title</Label><Input value={active.title} onChange={(event) => updateSection(active.client_id, { title: event.target.value })} className="h-11 border-[var(--line)] bg-white" /></div>
<div className="space-y-2"><Label>Subject</Label><Select value={active.subject_key} onValueChange={(subject_key) => updateSection(active.client_id, { subject_key, chapter_ids: [], topic_ids: [] })}><SelectTrigger className="h-11 border-[var(--line)] bg-white"><SelectValue /></SelectTrigger><SelectContent>{subjectNames.map((subject) => <SelectItem key={subject} value={subject}>{subject}</SelectItem>)}</SelectContent></Select></div>
<div className="space-y-2"><Label>Selection mode</Label><Select value={active.selection_mode} onValueChange={(selection_mode) => updateSection(active.client_id, { selection_mode: selection_mode as PaperSelectionMode })}><SelectTrigger className="h-11 border-[var(--line)] bg-white"><SelectValue /></SelectTrigger><SelectContent>{MODES.map((mode) => <SelectItem key={mode} value={mode}>{statusLabel(mode)}</SelectItem>)}</SelectContent></Select></div>
<Button type="button" variant="ghost" onClick={() => removeSection(active.client_id)} disabled={sections.length === 1} className="self-end text-[var(--destructive)] hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]"><Trash2 className="mr-2 h-4 w-4" />Remove</Button>
</div>
{active.subject_key === 'Biology' && (
<div>
<Label>Biology division</Label>
<div className="mt-2 flex flex-wrap gap-2">
{([['combined', 'Biology combined'], ['botany', 'Botany'], ['zoology', 'Zoology']] as const).map(([value, label]) => (
<Button key={value} type="button" variant="outline" size="sm" onClick={() => updateSection(active.client_id, { biology_division: value })} className={active.biology_division === value ? 'border-[var(--teal)] bg-[var(--secondary)] text-[var(--teal)]' : 'border-[var(--line)] bg-white text-[#44545C]'}>{label}</Button>
))}
</div>
</div>
)}
{['chapter_test', 'topic_test', 'unit_test', 'custom_test'].includes(builder.testType) && (
<div>
<div className="flex items-center justify-between"><Label>Chapters</Label><span className="text-xs text-[var(--muted-foreground)]">{active.chapter_ids?.length || 0} selected</span></div>
<div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-xl border border-[var(--line)] bg-white p-3">
{chapterOptions.map((chapter) => <Button key={chapter.id} type="button" variant="outline" size="sm" onClick={() => updateSection(active.client_id, { chapter_ids: toggle(active.chapter_ids, chapter.id), topic_ids: [] })} className={active.chapter_ids?.includes(chapter.id) ? 'border-[var(--teal)] bg-[var(--secondary)] text-[var(--teal)]' : 'border-[var(--line)] text-[#44545C]'}>{chapter.name}</Button>)}
{!chapterOptions.length && <span className="text-xs text-[var(--muted-foreground)]">No matching chapters are available for this subject.</span>}
</div>
</div>
)}
{builder.testType === 'topic_test' && (
<div>
<div className="flex items-center justify-between"><Label>Topics</Label><span className="text-xs text-[var(--muted-foreground)]">{active.topic_ids?.length || 0} selected</span></div>
<div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-xl border border-[var(--line)] bg-white p-3">
{topicOptions.map((topic) => <Button key={topic.id} type="button" variant="outline" size="sm" onClick={() => updateSection(active.client_id, { topic_ids: toggle(active.topic_ids, topic.id) })} className={active.topic_ids?.includes(topic.id) ? 'border-[var(--teal)] bg-[var(--secondary)] text-[var(--teal)]' : 'border-[var(--line)] text-[#44545C]'}>{topic.name}</Button>)}
{!topicOptions.length && <span className="text-xs text-[var(--muted-foreground)]">Select at least one chapter to see topics.</span>}
</div>
</div>
)}
{active.selection_mode !== 'manual' && (
<div className="rounded-xl border border-[var(--line)] bg-white p-4">
<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
<div><h4 className="text-sm font-semibold text-[var(--foreground)]">Difficulty distribution</h4><p className="mt-1 text-xs text-[var(--muted-foreground)]">The five values must equal the section question target.</p></div>
<div className="flex items-end gap-2"><div className="space-y-2"><Label>Total questions</Label><Input type="number" min={1} value={active.question_target || 0} onChange={(event) => updateSection(active.client_id, { question_target: Number(event.target.value) })} className="h-10 w-32 border-[var(--line)]" /></div><Button type="button" onClick={() => generateSection(active)} className="h-10 bg-[var(--teal)] text-white hover:bg-[#0A4747]"><Sparkles className="mr-2 h-4 w-4" />Generate</Button></div>
</div>
<div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
{DIFFICULTIES.map((difficulty) => <div key={difficulty} className="space-y-2"><Label>{DIFFICULTY_LABEL[difficulty]}</Label><Input type="number" min={0} value={active.difficulty_distribution?.[difficulty] || 0} onChange={(event) => updateSection(active.client_id, { difficulty_distribution: { ...emptyDistribution(), ...(active.difficulty_distribution || {}), [difficulty]: Number(event.target.value) } })} className="h-10 border-[var(--line)]" /></div>)}
</div>
<div className={`mt-3 rounded-lg px-3 py-2 text-xs ${distributionTotal === Number(active.question_target || 0) ? 'bg-[var(--secondary)]/60 text-[var(--teal)]' : 'bg-[var(--amber)]/15 text-[#8A5F00]'}`}>Distribution total: {distributionTotal} of {active.question_target || 0}</div>
</div>
)}
</div>
)}
</CardContent>
</Card>
)}
{builderStep === 2 && (
<div className="grid min-w-0 gap-5 xl:grid-cols-2">
<Card className="min-w-0 gap-0 border-[var(--line)] bg-white shadow-sm rounded-xl">
<CardContent className="p-4 sm:p-5">
<SectionHeading
number="2B"
title="Matching question bank"
description="Only approved questions matching the paper exam, grade and active-section classification are shown."
action={<div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={() => { setImportBefore(new Set(questions.map((question) => question.id))); setImportSection(activeSection); setImportOpen(true); }} className="border-[var(--line)]"><Upload className="mr-2 h-4 w-4" />Upload questions here</Button><Button type="button" variant="outline" size="sm" onClick={() => filteredQuestions.forEach((question) => addQuestion(question))} disabled={!filteredQuestions.length} className="border-[var(--line)]">Select all</Button></div>}
/>
<div className="mt-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_180px]">
<div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" /><Input value={questionSearch} onChange={(event) => setQuestionSearch(event.target.value)} placeholder="Search matching questions" className="h-10 border-[var(--line)] pl-9" /></div>
<Select value={difficultyFilter} onValueChange={setDifficultyFilter}><SelectTrigger className="h-10 border-[var(--line)]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All difficulties</SelectItem>{DIFFICULTIES.map((difficulty) => <SelectItem key={difficulty} value={difficulty}>{DIFFICULTY_LABEL[difficulty]}</SelectItem>)}</SelectContent></Select>
</div>
<div className="mt-3 grid gap-2 sm:grid-cols-5">{DIFFICULTIES.map((difficulty) => <button key={difficulty} type="button" onClick={() => setDifficultyFilter(difficultyFilter === difficulty ? 'all' : difficulty)} className={`rounded-xl border px-3 py-2 text-left transition ${difficultyFilter === difficulty ? 'border-[var(--teal)] bg-[var(--secondary)]' : 'border-[var(--line)] bg-white hover:border-[var(--teal)]/40'}`}><span className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">{DIFFICULTY_LABEL[difficulty]}</span><strong className="mt-1 block text-lg tabular-nums text-[var(--foreground)]">{difficultyCounts[difficulty]}</strong></button>)}</div>
<div className="mt-3 flex items-center justify-between text-xs text-[var(--muted-foreground)]"><span>{active?.title || 'Active section'}</span><span>{filteredQuestions.length} shown · {matchingQuestions.length} total matching · {selectedInActive} selected</span></div>
<div className="mt-3 max-h-[520px] space-y-2 overflow-y-auto pr-1">
{filteredQuestions.map((question) => (
<div key={question.id} className="rounded-xl border border-[var(--line)] p-3 transition hover:border-[var(--teal)]/30">
<div className="flex items-start justify-between gap-3">
<div className="min-w-0"><p className="line-clamp-3 text-sm font-medium leading-relaxed text-[var(--foreground)]">{question.stem_text}</p><div className="mt-2 flex flex-wrap gap-1"><Badge variant="outline" className="border-[var(--line)] text-[10px] text-[var(--muted-foreground)]">{question.chapters?.name || 'No chapter'}</Badge>{question.topics?.name && <Badge variant="outline" className="border-[var(--line)] text-[10px] text-[var(--muted-foreground)]">{question.topics.name}</Badge>}<Badge variant="outline" className="border-[var(--line)] text-[10px] text-[var(--muted-foreground)]">{DIFFICULTY_LABEL[question.difficulty]}</Badge></div></div>
<Button type="button" variant={selectedIds.has(question.id) ? 'secondary' : 'outline'} size="sm" disabled={selectedIds.has(question.id)} onClick={() => addQuestion(question)} className={selectedIds.has(question.id) ? 'shrink-0 bg-[var(--secondary)] text-[var(--teal)]' : 'shrink-0 border-[var(--teal)]/30 text-[var(--teal)]'}>{selectedIds.has(question.id) ? 'Added' : 'Add'}</Button>
</div>
</div>
))}
{!filteredQuestions.length && <div className="py-12 text-center text-sm text-[var(--muted-foreground)]">No approved questions match the current paper and section filters.</div>}
</div>
</CardContent>
</Card>
<Card className="min-w-0 gap-0 border-[var(--line)] bg-white shadow-sm rounded-xl">
<CardContent className="p-4 sm:p-5">
<SectionHeading
number="2C"
title="Paper questions"
description="Review order, section assignment and marks before saving or submitting the paper."
action={<Button type="button" variant="outline" size="sm" disabled={!selected.length} onClick={() => setPreviewOpen(true)} className="border-[var(--line)]"><Eye className="mr-2 h-4 w-4" />Test Preview</Button>}
/>
<div className="mt-4 max-h-[590px] space-y-2 overflow-y-auto pr-1">
{selected.map((item, index) => (
<div key={item.question_id} className="rounded-xl border border-[var(--line)] p-3">
<div className="flex items-start gap-2">
<div className="flex shrink-0 flex-col gap-1">
<Button type="button" variant="ghost" size="icon" disabled={index === 0} onClick={() => moveQuestion(index, -1)} className="h-7 w-7"><ChevronUp className="h-3.5 w-3.5" /></Button>
<Button type="button" variant="ghost" size="icon" disabled={index === selected.length - 1} onClick={() => moveQuestion(index, 1)} className="h-7 w-7"><ChevronDown className="h-3.5 w-3.5" /></Button>
</div>
<div className="min-w-0 flex-1">
<p className="line-clamp-3 text-sm font-medium leading-relaxed text-[var(--foreground)]">{index + 1}. {item.question.stem_text}</p>
<div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_100px_110px]">
<Select value={item.section_client_id} onValueChange={(section_client_id) => setSelected((current) => current.map((candidate) => candidate.question_id === item.question_id ? { ...candidate, section_client_id } : candidate))}><SelectTrigger className="h-9 border-[var(--line)] text-xs"><SelectValue /></SelectTrigger><SelectContent>{sections.map((section) => <SelectItem key={section.client_id} value={section.client_id}>{section.title}</SelectItem>)}</SelectContent></Select>
<Input aria-label="Marks" title="Marks" type="number" step="0.25" value={item.marks} onChange={(event) => setSelected((current) => current.map((candidate) => candidate.question_id === item.question_id ? { ...candidate, marks: Number(event.target.value) } : candidate))} className="h-9 border-[var(--line)] text-xs" />
<Input aria-label="Negative marks" title="Negative marks" type="number" step="0.25" min={0} value={item.negative_marks} onChange={(event) => setSelected((current) => current.map((candidate) => candidate.question_id === item.question_id ? { ...candidate, negative_marks: Number(event.target.value) } : candidate))} className="h-9 border-[var(--line)] text-xs" />
</div>
</div>
<Button type="button" variant="ghost" size="icon" onClick={() => removeQuestion(item.question_id)} className="h-8 w-8 shrink-0 text-[var(--destructive)] hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]"><Trash2 className="h-4 w-4" /></Button>
</div>
</div>
))}
{!selected.length && <div className="py-12 text-center text-sm text-[var(--muted-foreground)]">Add approved questions from the matching question bank.</div>}
</div>
</CardContent>
</Card>
</div>
)}
{builderStep === 5 && (
<Card className="gap-0 border-[var(--line)] bg-white shadow-sm rounded-xl">
<CardContent className="space-y-5 p-4 sm:p-5">
<SectionHeading number="5" title="Preview & Publish" description="Review the learner-facing paper and final summary before publishing or submitting for approval." />
<div className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] p-5">
<div className="grid gap-3 sm:grid-cols-3"><div><p className="text-xs text-[var(--muted-foreground)]">Questions</p><p className="mt-1 text-xl font-bold">{selected.length}</p></div><div><p className="text-xs text-[var(--muted-foreground)]">Marks</p><p className="mt-1 text-xl font-bold">{totalMarks}</p></div><div><p className="text-xs text-[var(--muted-foreground)]">Duration</p><p className="mt-1 text-xl font-bold">{builder.duration} min</p></div></div>
<Button type="button" disabled={!selected.length} onClick={() => setPreviewOpen(true)} className="mt-5 bg-[var(--teal)] text-white hover:bg-[#0A4747]"><Eye className="mr-2 h-4 w-4" />Open learner preview</Button>
</div>
</CardContent>
</Card>
)}
{builderStep === 5 && (
<Card className="gap-0 border-[var(--line)] bg-white shadow-sm rounded-xl">
<CardContent className="space-y-5 p-4 sm:p-5">
<SectionHeading number="5" title="Release check" description="Verify every server-authoritative publishing requirement before the final action is unlocked." />
<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
{(['Approved questions','Duration','Marks','Audience','Schedule','Result policy'] as const).map((label) => {
const check = publishReadiness?.checks?.find((item) => item.label === label);
const current = readinessFingerprint === publishFingerprint;
return <div key={label} className={`rounded-xl border p-4 ${check && current ? (check.ok ? 'border-[#237A57]/20 bg-[#237A57]/5' : 'border-[var(--destructive)]/20 bg-[var(--destructive)]/5') : 'border-[var(--line)] bg-[var(--canvas)]'}`}><div className="flex items-center gap-2">{check && current ? (check.ok ? <CheckCircle2 className="h-4 w-4 text-[#237A57]" /> : <XCircle className="h-4 w-4 text-[var(--destructive)]" />) : <ShieldCheck className="h-4 w-4 text-[var(--muted-foreground)]" />}<p className="text-sm font-semibold text-[var(--foreground)]">{label}</p></div><p className="mt-2 text-xs leading-relaxed text-[var(--muted-foreground)]">{check && current ? check.message : 'Run release check to verify this requirement against the saved paper.'}</p></div>;
})}
</div>
<div className="flex flex-wrap items-center gap-3"><Button type="button" variant="outline" disabled={saving || readinessLoading} onClick={() => void runPublishPreflight()} className="h-10 border-[var(--teal)]/30 text-[var(--teal)]">{readinessLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}Run release check</Button><span className={`text-xs font-medium ${releaseCheckCurrent ? 'text-[#237A57]' : 'text-[var(--muted-foreground)]'}`}>{releaseCheckCurrent ? 'All six checks passed for the current paper state.' : publishReadiness && readinessFingerprint !== publishFingerprint ? 'Paper changed after the last check. Run it again.' : 'Publish stays locked until all six checks pass.'}</span></div>
<SectionHeading number="5" title="Publish" description="Ready to publish or submit? Review the paper summary, then use the final action below." />
<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
<div className="rounded-xl border border-[var(--line)] p-4"><p className="text-xs text-[var(--muted-foreground)]">Title</p><p className="mt-1 font-semibold">{builder.title || 'Not set'}</p></div>
<div className="rounded-xl border border-[var(--line)] p-4"><p className="text-xs text-[var(--muted-foreground)]">Paper code</p><p className="mt-1 font-semibold">{builder.code || 'Not set'}</p></div>
<div className="rounded-xl border border-[var(--line)] p-4"><p className="text-xs text-[var(--muted-foreground)]">Questions</p><p className="mt-1 font-semibold">{selected.length} · {totalMarks} marks</p></div>
<div className="rounded-xl border border-[var(--line)] p-4"><p className="text-xs text-[var(--muted-foreground)]">Delivery</p><p className="mt-1 font-semibold">{builder.duration} min · {builder.openForever ? 'Always open' : 'Scheduled'}</p></div>
</div>
</CardContent>
</Card>
)}
</div>
</div>
<DialogFooter className="border-t border-[var(--line)] bg-white px-4 py-4 sm:px-6">
<div className="mr-auto text-sm text-[var(--muted-foreground)]">Step {builderStep} of 5 · {selected.length} questions · {totalMarks} marks</div>
<Button type="button" variant="outline" onClick={() => setBuilderOpen(false)} disabled={saving} className="h-11 border-[var(--line)]">Close</Button>
{builderStep > 1 && <Button type="button" variant="outline" disabled={saving} onClick={() => setBuilderStep((current) => Math.max(1, current - 1) as 1 | 2 | 3 | 4 | 5)} className="h-11 border-[var(--line)]">Back</Button>}
<Button type="button" variant="outline" disabled={saving} onClick={() => void savePaper('draft')} className="h-11 border-[var(--teal)]/30 text-[var(--teal)]">{saving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save Draft</Button>
{builderStep < 5 && <Button type="button" disabled={saving} onClick={() => setBuilderStep((current) => Math.min(5, current + 1) as 1 | 2 | 3 | 4 | 5)} className="h-11 bg-[var(--teal)] text-white hover:bg-[#0A4747]">Next</Button>}
{builderStep === 5 && submitStatus === 'published' && (<Button type="button" disabled={saving || readinessLoading || !releaseCheckCurrent} onClick={() => void publishCheckedPaper()} className="h-11 bg-[var(--teal)] text-white hover:bg-[#0A4747]"><Check className="mr-2 h-4 w-4" />Save and Publish</Button>)}
{builderStep === 5 && submitStatus !== 'published' && (<Button type="button" disabled={saving} onClick={() => void savePaper(submitStatus)} className="h-11 bg-[var(--teal)] text-white hover:bg-[#0A4747]"><Send className="mr-2 h-4 w-4" />Submit for Approval</Button>)}
</DialogFooter>
</DialogContent>
</Dialog>
<Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
<DialogContent className="max-h-[94vh] w-[96vw] max-w-5xl overflow-y-auto border-[var(--line)] p-0">
<DialogHeader className="border-b border-[var(--line)] px-5 py-4 sm:px-7">
<div className="pr-8"><DialogTitle className="text-xl text-[var(--foreground)]">{builder.title || 'Question Paper Preview'}</DialogTitle><DialogDescription className="mt-1">Learner-facing preview · {builder.exam} · {resolvedGrade} · {builder.duration} minutes</DialogDescription></div>
</DialogHeader>
<div className="bg-[#FBFCFC] px-4 py-5 sm:px-7">
{builder.description && <div className="rounded-xl border border-[var(--secondary)] bg-white p-4 text-sm leading-relaxed text-[#44545C]" dangerouslySetInnerHTML={{ __html: sanitize(builder.description) }} />}
{sections.map((section) => (
<section key={section.client_id} className="mt-6 rounded-xl border border-[var(--line)] bg-white p-4 sm:p-5">
<div className="border-b border-[var(--line)] pb-3"><span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal)]">Section</span><h3 className="mt-1 text-xl font-bold text-[var(--foreground)]">{section.title}</h3></div>
{selected.filter((item) => item.section_client_id === section.client_id).map((item, index) => (
<article key={item.question_id} className="border-b border-[var(--line)] py-5 last:border-b-0">
<p className="font-semibold leading-relaxed text-[var(--foreground)]">{index + 1}. {item.question.stem_text}</p>
{item.question.question_image_url && <img src={item.question.question_image_url} alt="Question" className="mt-3 max-h-64 max-w-full rounded-lg object-contain" />}
<div className="mt-4 grid gap-2 sm:grid-cols-2">
{[...(item.question.question_options || [])].sort((a, b) => a.display_order - b.display_order).map((option) => <div key={option.option_key} className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm text-[#44545C]"><strong className="mr-1 text-[var(--foreground)]">{option.option_key}.</strong>{option.content_text}</div>)}
</div>
</article>
))}
</section>
))}
</div>
</DialogContent>
</Dialog>
<Dialog open={Boolean(rejectTarget)} onOpenChange={(open) => { if (!open) { setRejectTarget(null); setRejectionReason(''); } }}>
<DialogContent className="border-[var(--line)] sm:max-w-lg">
<DialogHeader><DialogTitle className="text-[var(--foreground)]">Reject question paper</DialogTitle><DialogDescription>Provide a clear correction note so the creator can fix the paper and submit it again.</DialogDescription></DialogHeader>
<div className="space-y-2"><Label>Reason for rejection</Label><Textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} rows={4} placeholder="Explain the required correction." className="border-[var(--line)]" /></div>
<DialogFooter><Button type="button" variant="outline" onClick={() => { setRejectTarget(null); setRejectionReason(''); }} className="border-[var(--line)]">Cancel</Button><Button type="button" variant="destructive" disabled={!rejectionReason.trim()} onClick={() => void confirmReject()}><XCircle className="mr-2 h-4 w-4" />Reject Paper</Button></DialogFooter>
</DialogContent>
</Dialog>
<AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !saving) setDeleteTarget(null); }}>
<AlertDialogContent className="overflow-hidden border-[var(--line)] p-0 sm:max-w-xl">
<div className="bg-[var(--foreground)] px-6 py-5 text-white"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--destructive)]"><Trash2 className="h-5 w-5" /></div><AlertDialogHeader className="mt-4 text-left"><AlertDialogTitle className="text-xl text-white">Delete this paper?</AlertDialogTitle><AlertDialogDescription className="text-[var(--secondary)]">{deleteTarget?.title} will be permanently removed only when it has no protected student attempts.</AlertDialogDescription></AlertDialogHeader></div>
<div className="px-6 py-5 text-sm text-[#44545C]">Archiving is safer when a paper has already been used or may be needed for audit history.</div>
<AlertDialogFooter className="border-t border-[var(--line)] px-6 py-4"><AlertDialogCancel disabled={saving}>Keep Paper</AlertDialogCancel><Button type="button" variant="destructive" onClick={() => void confirmDelete()} disabled={saving}>{saving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}Delete Permanently</Button></AlertDialogFooter>
</AlertDialogContent>
</AlertDialog>
{kind === 'admin' && role === 'super_admin' && <PyqPaperManager open={pyqManagerOpen} onOpenChange={setPyqManagerOpen} onBuilt={()=>void load()} />}
{kind === 'admin' && <PaperFileImportDialog open={paperFileImportOpen} onOpenChange={setPaperFileImportOpen} onImported={()=>void load()} />}
<QuestionBulkImportDialog
open={importOpen}
onOpenChange={(open) => {
setImportOpen(open);
if (!open && importBefore) {
setImportBefore(null);
setImportSection('');
}
}}
kind={kind}
organizationId={organizationId}
subjects={subjects}
chapters={chapters}
topics={topics}
onImported={load}
/>
</div>
);
}
