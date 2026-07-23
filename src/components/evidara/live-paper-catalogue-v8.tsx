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
const EXAMS = ['NEET', 'JEE Main', 'JEE Advanced', 'KCET', 'School MCQ', 'Olympiad', 'Foundation', 'Scholarship Exam', 'Custom'];
const GRADES = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12', 'NEET Long Term', 'JEE Long Term', 'Custom'];
const SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'Logical Reasoning'];
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
const TEST_TYPES: Array<[PaperTestType, string]> = [
['full_length_mock', 'Full-length mock test'],
['subject_test', 'Subject test'],
['chapter_test', 'Chapter test'],
['topic_test', 'Topic test'],
['unit_test', 'Unit test'],
['diagnostic_test', 'Diagnostic test'],
['scholarship_test', 'Scholarship test'],
['previous_year_paper', 'Previous-year paper'],
['practice_test', 'Practice test'],
['foundation_test', 'Foundation test'],
['school_test', 'School test'],
['custom_test', 'Custom test'],
];
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
function emptySection(order = 0, mode: PaperSelectionMode = 'manual'): PaperSectionInput {
return {
client_id: id(),
title: `Section ${String.fromCharCode(65 + order)}`,
subject_key: SUBJECTS[Math.min(order, SUBJECTS.length - 1)],
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
if (subject === 'Biology') {
if (!['biology', 'botany', 'zoology'].some((value) => name.includes(value) || code.includes(value))) return false;
if (section.biology_division === 'botany') return name.includes('botany') || code.includes('botany') || tags.includes('botany');
if (section.biology_division === 'zoology') return name.includes('zoology') || code.includes('zoology') || tags.includes('zoology');
return true;
}
return subjectAliases(subject).some((value) => name.includes(value) || code.includes(value) || tags.includes(value));
}
type Selected = PaperQuestionInput & { question: QuestionRow };
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
instructions: string;
from: string;
until: string;
openForever: boolean;
shuffleQuestions: boolean;
shuffleOptions: boolean;
defaultMode: PaperSelectionMode;
};
const emptyBuilder = (): Builder => ({
id: null,
title: '',
code: '',
description: '',
exam: 'NEET',
grade: 'Grade 11',
customGrade: '',
testType: 'full_length_mock',
customTestType: '',
duration: 180,
attempts: 1,
resultMode: 'score_only',
instructions: '<p>Read every question carefully. Answers are autosaved. Submit before the timer reaches zero.</p>',
from: '',
until: '',
openForever: true,
shuffleQuestions: false,
shuffleOptions: false,
defaultMode: 'manual',
});
function statusClass(status: PaperStatus) {
if (status === 'published') return 'border-[#0E5A5A]/15 bg-[#DCE9E7] text-[#0E5A5A]';
if (status === 'approved') return 'border-[#237A57]/15 bg-[#237A57]/10 text-[#237A57]';
if (status === 'under_review') return 'border-[#F2B84B]/30 bg-[#F2B84B]/20 text-[#8A5F00]';
if (status === 'rejected') return 'border-[#B54747]/20 bg-[#B54747]/10 text-[#B54747]';
if (status === 'paused') return 'border-[#2E6D8B]/20 bg-[#2E6D8B]/10 text-[#2E6D8B]';
if (status === 'closed' || status === 'archived') return 'border-[#14232B]/10 bg-[#14232B]/10 text-[#44545C]';
return 'border-[#E7ECEB] bg-[#F7F9F7] text-[#6B7980]';
}
function SectionHeading({ number, title, description, action }: {
number: string;
title: string;
description: string;
action?: ReactNode;
}) {
return (
<div className="flex flex-col gap-3 border-b border-[#E7ECEB] pb-4 sm:flex-row sm:items-start sm:justify-between">
<div className="flex items-start gap-3">
<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0E5A5A] text-xs font-bold text-white">{number}</span>
<div>
<h3 className="font-semibold text-[#14232B]">{title}</h3>
<p className="mt-0.5 max-w-3xl text-xs leading-relaxed text-[#6B7980]">{description}</p>
</div>
</div>
{action && <div className="shrink-0">{action}</div>}
</div>
);
}
function RichInstructions({ value, onChange }: { value: string; onChange: (value: string) => void }) {
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
<div className="overflow-hidden rounded-xl border border-[#E7ECEB] bg-white">
<div className="flex flex-wrap items-center gap-1 border-b border-[#E7ECEB] bg-[#F7F9F7] p-2">
{tools.map(({ title, icon: Icon, run }) => (
<Button key={title} type="button" variant="ghost" size="icon" title={title} onClick={run} className="h-9 w-9 text-[#44545C] hover:bg-[#DCE9E7] hover:text-[#0E5A5A]">
<Icon className="h-4 w-4" />
</Button>
))}
<label className="ml-1 flex h-9 cursor-pointer items-center gap-2 rounded-lg px-2 text-xs font-medium text-[#44545C] hover:bg-[#DCE9E7]">
Text colour
<input aria-label="Text colour" type="color" className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0" onChange={(event) => command('foreColor', event.target.value)} />
</label>
</div>
<div
ref={ref}
contentEditable
suppressContentEditableWarning
onInput={(event) => onChange(sanitize(event.currentTarget.innerHTML))}
className="min-h-32 px-4 py-3 text-sm leading-6 text-[#14232B] outline-none empty:before:text-[#AEB8BC] empty:before:content-['Add_instructions_for_students'] [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5"
/>
</div>
);
}
export function LivePaperCatalogueV8({ kind, startInCreate = false }: { kind: 'admin' | 'school'; startInCreate?: boolean }) {
const { configured, profile, user } = useAuth();
const role = normalizeEvidaraRole(profile?.role);
const { organizationId, organizationName, loading: scopeLoading, error: scopeError } = useQuestionScope(kind);
const [papers, setPapers] = useState<PaperListRow[]>([]);
const [questions, setQuestions] = useState<QuestionRow[]>([]);
const [subjects, setSubjects] = useState<TaxonomySubject[]>([]);
const [chapters, setChapters] = useState<TaxonomyChapter[]>([]);
const [topics, setTopics] = useState<TaxonomyTopic[]>([]);
const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);
const [error, setError] = useState('');
const [message, setMessage] = useState('');
const [search, setSearch] = useState('');
const [statusFilter, setStatusFilter] = useState('all');
const [builderOpen, setBuilderOpen] = useState(false);
const [previewOpen, setPreviewOpen] = useState(false);
const [importOpen, setImportOpen] = useState(false);
const [builder, setBuilder] = useState<Builder>(emptyBuilder);
const [sections, setSections] = useState<PaperSectionInput[]>([emptySection()]);
const [activeSection, setActiveSection] = useState('');
const [selected, setSelected] = useState<Selected[]>([]);
const [questionSearch, setQuestionSearch] = useState('');
const [difficultyFilter, setDifficultyFilter] = useState('all');
const [autosave, setAutosave] = useState('Autosave ready');
const [importBefore, setImportBefore] = useState<Set<string> | null>(null);
const [importSection, setImportSection] = useState('');
const [deleteTarget, setDeleteTarget] = useState<PaperListRow | null>(null);
const [rejectTarget, setRejectTarget] = useState<PaperListRow | null>(null);
const [rejectionReason, setRejectionReason] = useState('');
const routeHandled = useRef(false);
const draftBase = useMemo(() => `evidara-v8-paper:${user?.id || 'anonymous'}:${kind}`, [kind, user?.id]);
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
const filteredQuestions = useMemo(() => !active ? [] : questions.filter((question) => (
matches(question, active)
&& (difficultyFilter === 'all' || question.difficulty === difficultyFilter)
&& (!questionSearch || `${question.stem_text} ${question.chapters?.name || ''} ${question.topics?.name || ''}`.toLowerCase().includes(questionSearch.toLowerCase()))
)), [active, difficultyFilter, matches, questionSearch, questions]);
const filteredPapers = useMemo(() => papers.filter((paper) => (
(statusFilter === 'all' || paper.status === statusFilter)
&& (!search || `${paper.title} ${paper.code || ''} ${paper.exam_type} ${paper.grade_level || ''}`.toLowerCase().includes(search.toLowerCase()))
)), [papers, search, statusFilter]);
const canApprove = role === 'super_admin' || (kind === 'school' && role === 'school_admin');
const submitStatus: PaperStatus = canApprove ? 'published' : 'under_review';
const totalMarks = selected.reduce((sum, item) => sum + Number(item.marks || 0), 0);
const selectedInActive = selected.filter((item) => item.section_client_id === active?.client_id).length;
const distributionTotal = active
? DIFFICULTIES.reduce((sum, difficulty) => sum + Number(active.difficulty_distribution?.[difficulty] || 0), 0)
: 0;
function resetBuilder() {
const section = emptySection();
setBuilder(emptyBuilder());
setSections([section]);
setActiveSection(section.client_id);
setSelected([]);
setQuestionSearch('');
setDifficultyFilter('all');
setAutosave('Autosave ready');
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
setBuilder(draft.builder);
setSections(draft.sections?.length ? draft.sections : [emptySection()]);
setActiveSection(draft.sections?.[0]?.client_id || '');
setSelected(hydrated);
setMessage('Recovered your autosaved V8 paper draft.');
}
} catch {
localStorage.removeItem(`${draftBase}:new`);
}
}
setBuilderOpen(true);
}
async function openEdit(paper: PaperListRow) {
if (!supabase) return;
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
description: String(row.description || ''),
exam: String(row.exam_type || 'NEET'),
grade: GRADES.includes(grade) ? grade : 'Custom',
customGrade: GRADES.includes(grade) ? '' : grade,
testType: row.test_type || 'full_length_mock',
customTestType: String(row.custom_test_type || ''),
duration: Number(row.duration_minutes || 60),
attempts: Number(row.attempt_limit || 1),
resultMode: row.result_mode || 'score_only',
instructions: String(row.instructions || ''),
from: toLocal(row.available_from),
until: toLocal(row.available_until),
openForever: Boolean(row.open_forever),
shuffleQuestions: Boolean(row.shuffle_questions),
shuffleOptions: Boolean(row.shuffle_options),
defaultMode: row.settings?.default_selection_mode || 'manual',
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
const section = emptySection(sections.length, builder.defaultMode);
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
async function savePaper(status: PaperStatus) {
if (!supabase) return;
const validation = validate(status);
if (validation) {
setError(validation);
return;
}
const payload: PaperPayload = {
title: builder.title.trim() || 'Untitled Paper',
code: builder.code.trim() || undefined,
description: builder.description.trim() || undefined,
exam_type: builder.exam,
grade_level: resolvedGrade,
test_type: builder.testType,
custom_test_type: builder.testType === 'custom_test' ? builder.customTestType.trim() : undefined,
status,
duration_minutes: builder.duration,
instructions: sanitize(builder.instructions),
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
const wasNew = !builder.id;
const key = draftKey;
const { data, error: saveError } = await supabase.rpc('save_question_paper', {
p_paper_id: builder.id,
p_organization_id: kind === 'admin' ? null : organizationId,
p_payload: payload,
});
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
{ label: 'Total papers', value: papers.length, icon: FileQuestion, tone: '#14232B' },
{ label: 'Published', value: papers.filter((paper) => paper.status === 'published').length, icon: CheckCircle2, tone: '#0E5A5A' },
{ label: 'Under review', value: papers.filter((paper) => paper.status === 'under_review').length, icon: ShieldCheck, tone: '#8A5F00' },
{ label: 'Drafts', value: papers.filter((paper) => paper.status === 'draft').length, icon: Edit3, tone: '#2E6D8B' },
];
return (
<div className="space-y-6">
<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
<div>
<div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#0E5A5A]">
<ShieldCheck className="h-4 w-4" />
{kind === 'admin' ? 'Assessment governance' : organizationName}
</div>
<h1 className="mt-2 text-2xl font-bold text-[#14232B]">Tests and Question Papers</h1>
<p className="mt-1 max-w-3xl text-sm leading-relaxed text-[#6B7980]">
Build grade-aware papers, configure each section and prepare approved assessments for product bundles.
</p>
</div>
<div className="flex flex-wrap gap-2">
<Button variant="outline" onClick={() => void load()} disabled={loading} className="h-11 border-[#E7ECEB] bg-white">
<RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh
</Button>
<Button onClick={openCreate} className="h-11 bg-[#0E5A5A] text-white hover:bg-[#0A4747]">
<FilePlus2 className="mr-2 h-4 w-4" />Create Paper
</Button>
</div>
</div>
{(scopeError || error) && (
<div className="rounded-xl border border-[#B54747]/20 bg-[#B54747]/5 px-4 py-3 text-sm text-[#B54747]">{scopeError || error}</div>
)}
{message && (
<div className="rounded-xl border border-[#0E5A5A]/20 bg-[#DCE9E7]/60 px-4 py-3 text-sm text-[#0E5A5A]">{message}</div>
)}
<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
{stats.map(({ label, value, icon: Icon, tone }) => (
<Card key={label} className="gap-0 border-[#E7ECEB] shadow-none">
<CardContent className="flex items-center justify-between p-4">
<div>
<p className="text-xs font-medium text-[#6B7980]">{label}</p>
<p className="mt-1 text-2xl font-bold tabular-nums" style={{ color: tone }}>{value}</p>
</div>
<div className="rounded-lg p-2.5" style={{ backgroundColor: `${tone}12`, color: tone }}>
<Icon className="h-5 w-5" />
</div>
</CardContent>
</Card>
))}
</div>
<Card className="gap-0 border-[#E7ECEB] shadow-none">
<CardContent className="p-4">
<div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
<div className="relative">
<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7980]" />
<Input
value={search}
onChange={(event) => setSearch(event.target.value)}
placeholder="Search paper title, code, exam or grade"
className="h-11 border-[#E7ECEB] pl-9"
/>
</div>
<Select value={statusFilter} onValueChange={setStatusFilter}>
<SelectTrigger className="h-11 border-[#E7ECEB]"><SelectValue /></SelectTrigger>
<SelectContent>
<SelectItem value="all">All statuses</SelectItem>
{STATUSES.map((status) => <SelectItem key={status} value={status}>{statusLabel(status)}</SelectItem>)}
</SelectContent>
</Select>
</div>
<div className="mt-3 flex items-center justify-between border-t border-[#E7ECEB] pt-3 text-xs text-[#6B7980]">
<span>{filteredPapers.length} matching paper{filteredPapers.length === 1 ? '' : 's'}</span>
<span>V8 paper workflow</span>
</div>
</CardContent>
</Card>
<Card className="gap-0 overflow-hidden border-[#E7ECEB] shadow-none">
<div className="overflow-x-auto">
<Table className="min-w-[1240px]">
<TableHeader>
<TableRow className="border-[#E7ECEB] bg-[#F7F9F7] hover:bg-[#F7F9F7]">
<TableHead className="text-xs font-semibold text-[#6B7980]">Paper</TableHead>
<TableHead className="text-xs font-semibold text-[#6B7980]">Exam and grade</TableHead>
<TableHead className="text-xs font-semibold text-[#6B7980]">Test type</TableHead>
<TableHead className="text-xs font-semibold text-[#6B7980]">Questions</TableHead>
<TableHead className="text-xs font-semibold text-[#6B7980]">Marks</TableHead>
<TableHead className="text-xs font-semibold text-[#6B7980]">Duration</TableHead>
<TableHead className="text-xs font-semibold text-[#6B7980]">Results</TableHead>
<TableHead className="text-xs font-semibold text-[#6B7980]">Status</TableHead>
<TableHead className="text-right text-xs font-semibold text-[#6B7980]">Actions</TableHead>
</TableRow>
</TableHeader>
<TableBody>
{loading ? (
<TableRow><TableCell colSpan={9} className="py-14 text-center text-sm text-[#6B7980]"><LoaderCircle className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading papers…</TableCell></TableRow>
) : filteredPapers.length === 0 ? (
<TableRow><TableCell colSpan={9} className="py-14 text-center text-sm text-[#6B7980]">No papers match the current filters.</TableCell></TableRow>
) : filteredPapers.map((paper) => (
<TableRow key={paper.id} className="border-[#E7ECEB] hover:bg-[#F7F9F7]/70">
<TableCell className="max-w-[300px]">
<p className="font-semibold text-[#14232B]">{paper.title}</p>
<p className="mt-1 text-xs text-[#6B7980]">{paper.code || 'No paper code'}</p>
{paper.rejection_reason && <p className="mt-1 line-clamp-2 text-xs text-[#B54747]">Reason: {paper.rejection_reason}</p>}
</TableCell>
<TableCell><p className="text-sm font-medium text-[#14232B]">{paper.exam_type}</p><p className="mt-1 text-xs text-[#6B7980]">{paper.grade_level || 'No grade'}</p></TableCell>
<TableCell className="max-w-[190px] text-sm text-[#44545C]">{paper.test_type === 'custom_test' ? paper.custom_test_type : TEST_TYPES.find(([value]) => value === paper.test_type)?.[1]}</TableCell>
<TableCell className="text-sm tabular-nums text-[#14232B]">{paper.total_questions}</TableCell>
<TableCell className="text-sm tabular-nums text-[#14232B]">{paper.total_marks}</TableCell>
<TableCell className="text-sm text-[#44545C]">{paper.duration_minutes} min</TableCell>
<TableCell className="text-sm text-[#44545C]">{paper.result_mode === 'in_depth_analytics' ? 'In-depth analytics' : statusLabel(paper.result_mode)}</TableCell>
<TableCell><Badge variant="outline" className={statusClass(paper.status)}>{statusLabel(paper.status)}</Badge></TableCell>
<TableCell className="text-right">
<div className="flex justify-end gap-1">
<Button variant="ghost" size="icon" title="Edit paper" onClick={() => void openEdit(paper)} className="h-9 w-9 text-[#0E5A5A] hover:bg-[#DCE9E7]"><Edit3 className="h-4 w-4" /></Button>
{paper.status === 'under_review' && canApprove && (
<>
<Button variant="ghost" size="icon" title="Approve paper" onClick={() => void setStatus(paper, 'approved')} className="h-9 w-9 text-[#237A57] hover:bg-[#237A57]/10"><Check className="h-4 w-4" /></Button>
<Button variant="ghost" size="icon" title="Reject paper" onClick={() => { setRejectTarget(paper); setRejectionReason(''); }} className="h-9 w-9 text-[#B54747] hover:bg-[#B54747]/10"><XCircle className="h-4 w-4" /></Button>
</>
)}
{paper.status === 'approved' && canApprove && <Button variant="ghost" size="icon" title="Publish paper" onClick={() => void setStatus(paper, 'published')} className="h-9 w-9 text-[#0E5A5A] hover:bg-[#DCE9E7]"><PlayCircle className="h-4 w-4" /></Button>}
{paper.status === 'published' && <Button variant="ghost" size="icon" title="Pause paper" onClick={() => void setStatus(paper, 'paused')} className="h-9 w-9 text-[#2E6D8B] hover:bg-[#2E6D8B]/10"><PauseCircle className="h-4 w-4" /></Button>}
{paper.status === 'paused' && canApprove && <Button variant="ghost" size="icon" title="Resume paper" onClick={() => void setStatus(paper, 'published')} className="h-9 w-9 text-[#0E5A5A] hover:bg-[#DCE9E7]"><PlayCircle className="h-4 w-4" /></Button>}
{['published', 'paused'].includes(paper.status) && <Button variant="ghost" size="icon" title="Close paper" onClick={() => void setStatus(paper, 'closed')} className="h-9 w-9 text-[#44545C] hover:bg-[#E7ECEB]"><CircleStop className="h-4 w-4" /></Button>}
{paper.status !== 'archived' && <Button variant="ghost" size="icon" title="Archive paper" onClick={() => void setStatus(paper, 'archived')} className="h-9 w-9 text-[#8A5F00] hover:bg-[#F2B84B]/15"><Archive className="h-4 w-4" /></Button>}
<Button variant="ghost" size="icon" title="Delete paper" onClick={() => setDeleteTarget(paper)} className="h-9 w-9 text-[#B54747] hover:bg-[#B54747]/10"><Trash2 className="h-4 w-4" /></Button>
</div>
</TableCell>
</TableRow>
))}
</TableBody>
</Table>
</div>
</Card>
<Dialog open={builderOpen} onOpenChange={(next) => { if (!saving) setBuilderOpen(next); }}>
<DialogContent className="flex max-h-[96vh] w-[96vw] max-w-[1540px] flex-col overflow-hidden border-[#E7ECEB] p-0">
<DialogHeader className="border-b border-[#E7ECEB] px-4 py-4 sm:px-6">
<div className="flex flex-col gap-3 pr-8 lg:flex-row lg:items-start lg:justify-between">
<div>
<DialogTitle className="text-xl text-[#14232B]">{builder.id ? 'Edit Question Paper' : 'Create Question Paper'}</DialogTitle>
<DialogDescription className="mt-1 max-w-3xl">Complete the setup, configure each section, select approved questions and review the learner-facing paper in one workspace.</DialogDescription>
</div>
<div className="flex flex-wrap items-center gap-2">
<Badge className="bg-[#DCE9E7] text-[#0E5A5A]">{builder.exam}</Badge>
<Badge variant="outline" className="border-[#E7ECEB] text-[#6B7980]">{resolvedGrade || 'Grade pending'}</Badge>
<Badge variant="outline" className="border-[#E7ECEB] text-[#6B7980]">{autosave}</Badge>
</div>
</div>
</DialogHeader>
<div className="min-h-0 flex-1 overflow-y-auto bg-[#FBFCFC] px-3 py-4 sm:px-6 sm:py-5">
{error && <div className="mb-4 rounded-xl border border-[#B54747]/20 bg-[#B54747]/5 px-4 py-3 text-sm text-[#B54747]">{error}</div>}
<div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
{[
{ label: 'Sections', value: sections.length, icon: Layers3 },
{ label: 'Questions', value: selected.length, icon: FileQuestion },
{ label: 'Total marks', value: totalMarks, icon: BookOpenCheck },
{ label: 'Duration', value: `${builder.duration} min`, icon: Clock3 },
].map(({ label, value, icon: Icon }) => (
<div key={label} className="flex items-center justify-between rounded-xl border border-[#E7ECEB] bg-white px-4 py-3">
<div><p className="text-xs text-[#6B7980]">{label}</p><p className="mt-1 text-lg font-bold tabular-nums text-[#14232B]">{value}</p></div>
<Icon className="h-5 w-5 text-[#0E5A5A]" />
</div>
))}
</div>
<div className="space-y-5">
<Card className="gap-0 border-[#E7ECEB] bg-white shadow-none">
<CardContent className="space-y-5 p-4 sm:p-5">
<SectionHeading number="1" title="Paper identity" description="Define the paper once so question filtering, approval and future product bundling remain accurate." />
<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
<div className="space-y-2 md:col-span-2"><Label>Paper title</Label><Input value={builder.title} onChange={(event) => setBuilder((current) => ({ ...current, title: event.target.value }))} placeholder="NEET Full Syllabus Mock 01" className="h-11 border-[#E7ECEB]" /></div>
<div className="space-y-2"><Label>Paper code</Label><Input value={builder.code} onChange={(event) => setBuilder((current) => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="NEET-M01" className="h-11 border-[#E7ECEB]" /></div>
<div className="space-y-2"><Label>Exam type</Label><Select value={builder.exam} onValueChange={(exam) => setBuilder((current) => ({ ...current, exam }))}><SelectTrigger className="h-11 border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent>{EXAMS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
<div className="space-y-2"><span className="text-sm font-medium text-[#14232B]">Grade</span><Select value={builder.grade} onValueChange={(grade) => setBuilder((current) => ({ ...current, grade }))}><SelectTrigger className="h-11 border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent>{GRADES.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
{builder.grade === 'Custom' && <div className="space-y-2"><Label>Custom grade</Label><Input value={builder.customGrade} onChange={(event) => setBuilder((current) => ({ ...current, customGrade: event.target.value }))} placeholder="Enter grade or cohort" className="h-11 border-[#E7ECEB]" /></div>}
<div className="space-y-2"><Label>Test type</Label><Select value={builder.testType} onValueChange={(testType) => setBuilder((current) => ({ ...current, testType: testType as PaperTestType }))}><SelectTrigger className="h-11 border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent>{TEST_TYPES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
{builder.testType === 'custom_test' && <div className="space-y-2"><Label>Custom test name</Label><Input value={builder.customTestType} onChange={(event) => setBuilder((current) => ({ ...current, customTestType: event.target.value }))} placeholder="School Pre-Board Test" className="h-11 border-[#E7ECEB]" /></div>}
<div className="space-y-2 md:col-span-2 xl:col-span-4"><Label>Description</Label><Textarea rows={3} value={builder.description} onChange={(event) => setBuilder((current) => ({ ...current, description: event.target.value }))} placeholder="Explain what the paper covers and who it is designed for." className="border-[#E7ECEB]" /></div>
</div>
</CardContent>
</Card>
<Card className="gap-0 border-[#E7ECEB] bg-white shadow-none">
<CardContent className="space-y-5 p-4 sm:p-5">
<SectionHeading number="2" title="Delivery and student experience" description="Set time, attempts, result visibility and instructions. Product purchase or school entitlement controls access outside this builder." />
<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
<div className="space-y-2"><Label>Duration (minutes)</Label><Input type="number" min={1} value={builder.duration} onChange={(event) => setBuilder((current) => ({ ...current, duration: Number(event.target.value) }))} className="h-11 border-[#E7ECEB]" /></div>
<div className="space-y-2"><Label>Attempts allowed</Label><Input type="number" min={1} value={builder.attempts} onChange={(event) => setBuilder((current) => ({ ...current, attempts: Number(event.target.value) }))} className="h-11 border-[#E7ECEB]" /></div>
<div className="space-y-2"><Label>Result display</Label><Select value={builder.resultMode} onValueChange={(resultMode) => setBuilder((current) => ({ ...current, resultMode: resultMode as ResultMode }))}><SelectTrigger className="h-11 border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="score_only">Score only</SelectItem><SelectItem value="score_and_answers">Score and answers</SelectItem><SelectItem value="in_depth_analytics">In-depth analytics</SelectItem></SelectContent></Select></div>
<div className="flex min-h-20 items-center justify-between rounded-xl border border-[#E7ECEB] px-4 py-3"><div><Label>Open forever</Label><p className="mt-1 text-xs text-[#6B7980]">No opening or closing date</p></div><Switch checked={builder.openForever} onCheckedChange={(openForever) => setBuilder((current) => ({ ...current, openForever }))} /></div>
{!builder.openForever && <><div className="space-y-2"><Label>Opens at</Label><Input type="datetime-local" value={builder.from} onChange={(event) => setBuilder((current) => ({ ...current, from: event.target.value }))} className="h-11 border-[#E7ECEB]" /></div><div className="space-y-2"><Label>Closes at</Label><Input type="datetime-local" value={builder.until} onChange={(event) => setBuilder((current) => ({ ...current, until: event.target.value }))} className="h-11 border-[#E7ECEB]" /></div></>}
<div className="flex min-h-20 items-center justify-between rounded-xl border border-[#E7ECEB] px-4 py-3"><div><Label>Shuffle questions</Label><p className="mt-1 text-xs text-[#6B7980]">Change order per attempt</p></div><Switch checked={builder.shuffleQuestions} onCheckedChange={(shuffleQuestions) => setBuilder((current) => ({ ...current, shuffleQuestions }))} /></div>
<div className="flex min-h-20 items-center justify-between rounded-xl border border-[#E7ECEB] px-4 py-3"><div><Label>Shuffle options</Label><p className="mt-1 text-xs text-[#6B7980]">Randomise MCQ choices</p></div><Switch checked={builder.shuffleOptions} onCheckedChange={(shuffleOptions) => setBuilder((current) => ({ ...current, shuffleOptions }))} /></div>
<div className="space-y-2 md:col-span-2 xl:col-span-4"><Label>Extra instructions</Label><RichInstructions value={builder.instructions} onChange={(instructions) => setBuilder((current) => ({ ...current, instructions }))} /></div>
</div>
</CardContent>
</Card>
<Card className="gap-0 border-[#E7ECEB] bg-white shadow-none">
<CardContent className="space-y-5 p-4 sm:p-5">
<SectionHeading
number="3"
title="Sections and selection strategy"
description="Use one paper-wide default or choose Manual, Automatic or Hybrid independently for every section."
action={<Button type="button" variant="outline" onClick={addSection} className="h-10 border-[#E7ECEB]"><Plus className="mr-2 h-4 w-4" />Add Section</Button>}
/>
<div className="grid gap-3 rounded-xl border border-[#E7ECEB] bg-[#F7F9F7] p-3 md:grid-cols-[minmax(0,220px)_auto_auto] md:items-end">
<div className="space-y-2"><Label>Default selection mode</Label><Select value={builder.defaultMode} onValueChange={(defaultMode) => setBuilder((current) => ({ ...current, defaultMode: defaultMode as PaperSelectionMode }))}><SelectTrigger className="h-10 border-[#E7ECEB] bg-white"><SelectValue /></SelectTrigger><SelectContent>{MODES.map((mode) => <SelectItem key={mode} value={mode}>{statusLabel(mode)}</SelectItem>)}</SelectContent></Select></div>
<Button type="button" variant="outline" onClick={() => setSections((current) => current.map((section) => ({ ...section, selection_mode: builder.defaultMode })))} className="h-10 border-[#E7ECEB] bg-white">Apply to all sections</Button>
<Button type="button" variant="outline" onClick={generateAll} className="h-10 border-[#0E5A5A]/30 bg-white text-[#0E5A5A] hover:bg-[#DCE9E7]"><Sparkles className="mr-2 h-4 w-4" />Generate Auto/Hybrid</Button>
</div>
<div className="flex gap-2 overflow-x-auto pb-1">
{sections.map((section, index) => {
const count = selected.filter((item) => item.section_client_id === section.client_id).length;
const selectedSection = section.client_id === activeSection;
return (
<button key={section.client_id} type="button" onClick={() => setActiveSection(section.client_id)} className={`min-w-[190px] rounded-xl border p-3 text-left transition ${selectedSection ? 'border-[#0E5A5A] bg-[#DCE9E7]/50' : 'border-[#E7ECEB] bg-white hover:border-[#0E5A5A]/40'}`}>
<div className="flex items-start justify-between gap-2"><span className="text-xs font-semibold uppercase tracking-wide text-[#6B7980]">Section {index + 1}</span><Badge variant="outline" className={selectedSection ? 'border-[#0E5A5A]/20 bg-white text-[#0E5A5A]' : 'border-[#E7ECEB] text-[#6B7980]'}>{count} Q</Badge></div>
<strong className="mt-2 block truncate text-sm text-[#14232B]">{section.title}</strong>
<span className="mt-1 block text-xs text-[#6B7980]">{section.subject_key} · {statusLabel(section.selection_mode || 'manual')}</span>
</button>
);
})}
</div>
{active && (
<div className="space-y-5 rounded-xl border border-[#DCE9E7] bg-[#FBFCFC] p-4">
<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr_auto]">
<div className="space-y-2"><Label>Section title</Label><Input value={active.title} onChange={(event) => updateSection(active.client_id, { title: event.target.value })} className="h-11 border-[#E7ECEB] bg-white" /></div>
<div className="space-y-2"><Label>Subject</Label><Select value={active.subject_key} onValueChange={(subject_key) => updateSection(active.client_id, { subject_key, chapter_ids: [], topic_ids: [] })}><SelectTrigger className="h-11 border-[#E7ECEB] bg-white"><SelectValue /></SelectTrigger><SelectContent>{SUBJECTS.map((subject) => <SelectItem key={subject} value={subject}>{subject}</SelectItem>)}</SelectContent></Select></div>
<div className="space-y-2"><Label>Selection mode</Label><Select value={active.selection_mode} onValueChange={(selection_mode) => updateSection(active.client_id, { selection_mode: selection_mode as PaperSelectionMode })}><SelectTrigger className="h-11 border-[#E7ECEB] bg-white"><SelectValue /></SelectTrigger><SelectContent>{MODES.map((mode) => <SelectItem key={mode} value={mode}>{statusLabel(mode)}</SelectItem>)}</SelectContent></Select></div>
<Button type="button" variant="ghost" onClick={() => removeSection(active.client_id)} disabled={sections.length === 1} className="self-end text-[#B54747] hover:bg-[#B54747]/10 hover:text-[#B54747]"><Trash2 className="mr-2 h-4 w-4" />Remove</Button>
</div>
{active.subject_key === 'Biology' && (
<div>
<Label>Biology division</Label>
<div className="mt-2 flex flex-wrap gap-2">
{([['combined', 'Biology combined'], ['botany', 'Botany'], ['zoology', 'Zoology']] as const).map(([value, label]) => (
<Button key={value} type="button" variant="outline" size="sm" onClick={() => updateSection(active.client_id, { biology_division: value })} className={active.biology_division === value ? 'border-[#0E5A5A] bg-[#DCE9E7] text-[#0E5A5A]' : 'border-[#E7ECEB] bg-white text-[#44545C]'}>{label}</Button>
))}
</div>
</div>
)}
{['chapter_test', 'topic_test', 'unit_test', 'custom_test'].includes(builder.testType) && (
<div>
<div className="flex items-center justify-between"><Label>Chapters</Label><span className="text-xs text-[#6B7980]">{active.chapter_ids?.length || 0} selected</span></div>
<div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-xl border border-[#E7ECEB] bg-white p-3">
{chapterOptions.map((chapter) => <Button key={chapter.id} type="button" variant="outline" size="sm" onClick={() => updateSection(active.client_id, { chapter_ids: toggle(active.chapter_ids, chapter.id), topic_ids: [] })} className={active.chapter_ids?.includes(chapter.id) ? 'border-[#0E5A5A] bg-[#DCE9E7] text-[#0E5A5A]' : 'border-[#E7ECEB] text-[#44545C]'}>{chapter.name}</Button>)}
{!chapterOptions.length && <span className="text-xs text-[#6B7980]">No matching chapters are available for this subject.</span>}
</div>
</div>
)}
{builder.testType === 'topic_test' && (
<div>
<div className="flex items-center justify-between"><Label>Topics</Label><span className="text-xs text-[#6B7980]">{active.topic_ids?.length || 0} selected</span></div>
<div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-xl border border-[#E7ECEB] bg-white p-3">
{topicOptions.map((topic) => <Button key={topic.id} type="button" variant="outline" size="sm" onClick={() => updateSection(active.client_id, { topic_ids: toggle(active.topic_ids, topic.id) })} className={active.topic_ids?.includes(topic.id) ? 'border-[#0E5A5A] bg-[#DCE9E7] text-[#0E5A5A]' : 'border-[#E7ECEB] text-[#44545C]'}>{topic.name}</Button>)}
{!topicOptions.length && <span className="text-xs text-[#6B7980]">Select at least one chapter to see topics.</span>}
</div>
</div>
)}
{active.selection_mode !== 'manual' && (
<div className="rounded-xl border border-[#E7ECEB] bg-white p-4">
<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
<div><h4 className="text-sm font-semibold text-[#14232B]">Difficulty distribution</h4><p className="mt-1 text-xs text-[#6B7980]">The five values must equal the section question target.</p></div>
<div className="flex items-end gap-2"><div className="space-y-2"><Label>Total questions</Label><Input type="number" min={1} value={active.question_target || 0} onChange={(event) => updateSection(active.client_id, { question_target: Number(event.target.value) })} className="h-10 w-32 border-[#E7ECEB]" /></div><Button type="button" onClick={() => generateSection(active)} className="h-10 bg-[#0E5A5A] text-white hover:bg-[#0A4747]"><Sparkles className="mr-2 h-4 w-4" />Generate</Button></div>
</div>
<div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
{DIFFICULTIES.map((difficulty) => <div key={difficulty} className="space-y-2"><Label>{DIFFICULTY_LABEL[difficulty]}</Label><Input type="number" min={0} value={active.difficulty_distribution?.[difficulty] || 0} onChange={(event) => updateSection(active.client_id, { difficulty_distribution: { ...emptyDistribution(), ...(active.difficulty_distribution || {}), [difficulty]: Number(event.target.value) } })} className="h-10 border-[#E7ECEB]" /></div>)}
</div>
<div className={`mt-3 rounded-lg px-3 py-2 text-xs ${distributionTotal === Number(active.question_target || 0) ? 'bg-[#DCE9E7]/60 text-[#0E5A5A]' : 'bg-[#F2B84B]/15 text-[#8A5F00]'}`}>Distribution total: {distributionTotal} of {active.question_target || 0}</div>
</div>
)}
</div>
)}
</CardContent>
</Card>
<div className="grid min-w-0 gap-5 xl:grid-cols-2">
<Card className="min-w-0 gap-0 border-[#E7ECEB] bg-white shadow-none">
<CardContent className="p-4 sm:p-5">
<SectionHeading
number="4"
title="Matching question bank"
description="Only approved questions matching the paper exam, grade and active-section classification are shown."
action={<div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={() => { setImportBefore(new Set(questions.map((question) => question.id))); setImportSection(activeSection); setImportOpen(true); }} className="border-[#E7ECEB]"><Upload className="mr-2 h-4 w-4" />Upload questions here</Button><Button type="button" variant="outline" size="sm" onClick={() => filteredQuestions.forEach((question) => addQuestion(question))} disabled={!filteredQuestions.length} className="border-[#E7ECEB]">Select all</Button></div>}
/>
<div className="mt-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_180px]">
<div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7980]" /><Input value={questionSearch} onChange={(event) => setQuestionSearch(event.target.value)} placeholder="Search matching questions" className="h-10 border-[#E7ECEB] pl-9" /></div>
<Select value={difficultyFilter} onValueChange={setDifficultyFilter}><SelectTrigger className="h-10 border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All difficulties</SelectItem>{DIFFICULTIES.map((difficulty) => <SelectItem key={difficulty} value={difficulty}>{DIFFICULTY_LABEL[difficulty]}</SelectItem>)}</SelectContent></Select>
</div>
<div className="mt-3 flex items-center justify-between text-xs text-[#6B7980]"><span>{active?.title || 'Active section'}</span><span>{filteredQuestions.length} matching · {selectedInActive} selected</span></div>
<div className="mt-3 max-h-[520px] space-y-2 overflow-y-auto pr-1">
{filteredQuestions.map((question) => (
<div key={question.id} className="rounded-xl border border-[#E7ECEB] p-3 transition hover:border-[#0E5A5A]/30">
<div className="flex items-start justify-between gap-3">
<div className="min-w-0"><p className="line-clamp-3 text-sm font-medium leading-relaxed text-[#14232B]">{question.stem_text}</p><div className="mt-2 flex flex-wrap gap-1"><Badge variant="outline" className="border-[#E7ECEB] text-[10px] text-[#6B7980]">{question.chapters?.name || 'No chapter'}</Badge>{question.topics?.name && <Badge variant="outline" className="border-[#E7ECEB] text-[10px] text-[#6B7980]">{question.topics.name}</Badge>}<Badge variant="outline" className="border-[#E7ECEB] text-[10px] text-[#6B7980]">{DIFFICULTY_LABEL[question.difficulty]}</Badge></div></div>
<Button type="button" variant={selectedIds.has(question.id) ? 'secondary' : 'outline'} size="sm" disabled={selectedIds.has(question.id)} onClick={() => addQuestion(question)} className={selectedIds.has(question.id) ? 'shrink-0 bg-[#DCE9E7] text-[#0E5A5A]' : 'shrink-0 border-[#0E5A5A]/30 text-[#0E5A5A]'}>{selectedIds.has(question.id) ? 'Added' : 'Add'}</Button>
</div>
</div>
))}
{!filteredQuestions.length && <div className="py-12 text-center text-sm text-[#6B7980]">No approved questions match the current paper and section filters.</div>}
</div>
</CardContent>
</Card>
<Card className="min-w-0 gap-0 border-[#E7ECEB] bg-white shadow-none">
<CardContent className="p-4 sm:p-5">
<SectionHeading
number="5"
title="Paper questions"
description="Review order, section assignment and marks before saving or submitting the paper."
action={<Button type="button" variant="outline" size="sm" disabled={!selected.length} onClick={() => setPreviewOpen(true)} className="border-[#E7ECEB]"><Eye className="mr-2 h-4 w-4" />Test Preview</Button>}
/>
<div className="mt-4 max-h-[590px] space-y-2 overflow-y-auto pr-1">
{selected.map((item, index) => (
<div key={item.question_id} className="rounded-xl border border-[#E7ECEB] p-3">
<div className="flex items-start gap-2">
<div className="flex shrink-0 flex-col gap-1">
<Button type="button" variant="ghost" size="icon" disabled={index === 0} onClick={() => moveQuestion(index, -1)} className="h-7 w-7"><ChevronUp className="h-3.5 w-3.5" /></Button>
<Button type="button" variant="ghost" size="icon" disabled={index === selected.length - 1} onClick={() => moveQuestion(index, 1)} className="h-7 w-7"><ChevronDown className="h-3.5 w-3.5" /></Button>
</div>
<div className="min-w-0 flex-1">
<p className="line-clamp-3 text-sm font-medium leading-relaxed text-[#14232B]">{index + 1}. {item.question.stem_text}</p>
<div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_100px_110px]">
<Select value={item.section_client_id} onValueChange={(section_client_id) => setSelected((current) => current.map((candidate) => candidate.question_id === item.question_id ? { ...candidate, section_client_id } : candidate))}><SelectTrigger className="h-9 border-[#E7ECEB] text-xs"><SelectValue /></SelectTrigger><SelectContent>{sections.map((section) => <SelectItem key={section.client_id} value={section.client_id}>{section.title}</SelectItem>)}</SelectContent></Select>
<Input aria-label="Marks" title="Marks" type="number" step="0.25" value={item.marks} onChange={(event) => setSelected((current) => current.map((candidate) => candidate.question_id === item.question_id ? { ...candidate, marks: Number(event.target.value) } : candidate))} className="h-9 border-[#E7ECEB] text-xs" />
<Input aria-label="Negative marks" title="Negative marks" type="number" step="0.25" min={0} value={item.negative_marks} onChange={(event) => setSelected((current) => current.map((candidate) => candidate.question_id === item.question_id ? { ...candidate, negative_marks: Number(event.target.value) } : candidate))} className="h-9 border-[#E7ECEB] text-xs" />
</div>
</div>
<Button type="button" variant="ghost" size="icon" onClick={() => removeQuestion(item.question_id)} className="h-8 w-8 shrink-0 text-[#B54747] hover:bg-[#B54747]/10 hover:text-[#B54747]"><Trash2 className="h-4 w-4" /></Button>
</div>
</div>
))}
{!selected.length && <div className="py-12 text-center text-sm text-[#6B7980]">Add approved questions from the matching question bank.</div>}
</div>
</CardContent>
</Card>
</div>
</div>
</div>
<DialogFooter className="border-t border-[#E7ECEB] bg-white px-4 py-4 sm:px-6">
<div className="mr-auto text-sm text-[#6B7980]">{selected.length} questions · {totalMarks} marks · {builder.duration} minutes</div>
<Button type="button" variant="outline" onClick={() => setBuilderOpen(false)} disabled={saving} className="h-11 border-[#E7ECEB]">Close</Button>
<Button type="button" variant="outline" disabled={saving} onClick={() => void savePaper('draft')} className="h-11 border-[#0E5A5A]/30 text-[#0E5A5A]">{saving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save Draft</Button>
<Button type="button" disabled={saving} onClick={() => void savePaper(submitStatus)} className="h-11 bg-[#0E5A5A] text-white hover:bg-[#0A4747]">{submitStatus === 'published' ? <Check className="mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}{submitStatus === 'published' ? 'Save and Publish' : 'Submit for Approval'}</Button>
</DialogFooter>
</DialogContent>
</Dialog>
<Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
<DialogContent className="max-h-[94vh] w-[96vw] max-w-5xl overflow-y-auto border-[#E7ECEB] p-0">
<DialogHeader className="border-b border-[#E7ECEB] px-5 py-4 sm:px-7">
<div className="pr-8"><DialogTitle className="text-xl text-[#14232B]">{builder.title || 'Question Paper Preview'}</DialogTitle><DialogDescription className="mt-1">Learner-facing preview · {builder.exam} · {resolvedGrade} · {builder.duration} minutes</DialogDescription></div>
</DialogHeader>
<div className="bg-[#FBFCFC] px-4 py-5 sm:px-7">
{builder.instructions && <div className="rounded-xl border border-[#DCE9E7] bg-white p-4 text-sm leading-relaxed text-[#44545C]" dangerouslySetInnerHTML={{ __html: sanitize(builder.instructions) }} />}
{sections.map((section) => (
<section key={section.client_id} className="mt-6 rounded-xl border border-[#E7ECEB] bg-white p-4 sm:p-5">
<div className="border-b border-[#E7ECEB] pb-3"><span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0E5A5A]">Section</span><h3 className="mt-1 text-xl font-bold text-[#14232B]">{section.title}</h3></div>
{selected.filter((item) => item.section_client_id === section.client_id).map((item, index) => (
<article key={item.question_id} className="border-b border-[#E7ECEB] py-5 last:border-b-0">
<p className="font-semibold leading-relaxed text-[#14232B]">{index + 1}. {item.question.stem_text}</p>
{item.question.question_image_url && <img src={item.question.question_image_url} alt="Question" className="mt-3 max-h-64 max-w-full rounded-lg object-contain" />}
<div className="mt-4 grid gap-2 sm:grid-cols-2">
{[...(item.question.question_options || [])].sort((a, b) => a.display_order - b.display_order).map((option) => <div key={option.option_key} className="rounded-lg border border-[#E7ECEB] px-3 py-2 text-sm text-[#44545C]"><strong className="mr-1 text-[#14232B]">{option.option_key}.</strong>{option.content_text}</div>)}
</div>
</article>
))}
</section>
))}
</div>
</DialogContent>
</Dialog>
<Dialog open={Boolean(rejectTarget)} onOpenChange={(open) => { if (!open) { setRejectTarget(null); setRejectionReason(''); } }}>
<DialogContent className="border-[#E7ECEB] sm:max-w-lg">
<DialogHeader><DialogTitle className="text-[#14232B]">Reject question paper</DialogTitle><DialogDescription>Provide a clear correction note so the creator can fix the paper and submit it again.</DialogDescription></DialogHeader>
<div className="space-y-2"><Label>Reason for rejection</Label><Textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} rows={4} placeholder="Explain the required correction." className="border-[#E7ECEB]" /></div>
<DialogFooter><Button type="button" variant="outline" onClick={() => { setRejectTarget(null); setRejectionReason(''); }} className="border-[#E7ECEB]">Cancel</Button><Button type="button" variant="destructive" disabled={!rejectionReason.trim()} onClick={() => void confirmReject()}><XCircle className="mr-2 h-4 w-4" />Reject Paper</Button></DialogFooter>
</DialogContent>
</Dialog>
<AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !saving) setDeleteTarget(null); }}>
<AlertDialogContent className="overflow-hidden border-[#E7ECEB] p-0 sm:max-w-xl">
<div className="bg-[#14232B] px-6 py-5 text-white"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#B54747]"><Trash2 className="h-5 w-5" /></div><AlertDialogHeader className="mt-4 text-left"><AlertDialogTitle className="text-xl text-white">Delete this paper?</AlertDialogTitle><AlertDialogDescription className="text-[#DCE9E7]">{deleteTarget?.title} will be permanently removed only when it has no protected student attempts.</AlertDialogDescription></AlertDialogHeader></div>
<div className="px-6 py-5 text-sm text-[#44545C]">Archiving is safer when a paper has already been used or may be needed for audit history.</div>
<AlertDialogFooter className="border-t border-[#E7ECEB] px-6 py-4"><AlertDialogCancel disabled={saving}>Keep Paper</AlertDialogCancel><Button type="button" variant="destructive" onClick={() => void confirmDelete()} disabled={saving}>{saving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}Delete Permanently</Button></AlertDialogFooter>
</AlertDialogContent>
</AlertDialog>
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
