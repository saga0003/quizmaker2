'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Check, Edit3, GraduationCap, Layers3, LoaderCircle, Plus, Search, Settings2, Tags, Trash2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';
import { normalizeEvidaraRole } from '@/lib/roles';
import type { AssessmentOption, AssessmentOptionGroup } from '@/types/assessment-options';
import type { TaxonomyChapter, TaxonomySubject, TaxonomyTopic } from '@/types/questions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GuidedLabel } from '@/components/evidara/question-help';
import { SearchableTaxonomySelect } from '@/components/evidara/searchable-taxonomy-select';

const groupLabels: Record<AssessmentOptionGroup, string> = {
  grade: 'Grades',
  exam_type: 'Examinations',
  test_type: 'Paper test types',
};

type Entity = 'subject' | 'chapter' | 'topic';
type EditItem = { entity: Entity; id: string; name: string; code?: string } | null;

export function QuestionTaxonomySettings({ kind, organizationId, subjects, chapters, topics, onChanged }: {
  kind: 'admin' | 'school';
  organizationId: string | null;
  subjects: TaxonomySubject[];
  chapters: TaxonomyChapter[];
  topics: TaxonomyTopic[];
  onChanged: () => Promise<void> | void;
}) {
  const { profile, session } = useAuth();
  const role = normalizeEvidaraRole(profile?.role);
  const superAdmin = role === 'super_admin';
  const [search, setSearch] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [chapterSubjectId, setChapterSubjectId] = useState('');
  const [chapterName, setChapterName] = useState('');
  const [topicChapterId, setTopicChapterId] = useState('');
  const [topicName, setTopicName] = useState('');
  const [selected, setSelected] = useState<Record<Entity, Set<string>>>({ subject: new Set(), chapter: new Set(), topic: new Set() });
  const [editItem, setEditItem] = useState<EditItem>(null);
  const [moveParent, setMoveParent] = useState('');
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string }>>([]);
  const [optionRows, setOptionRows] = useState<AssessmentOption[]>([]);
  const [optionScope, setOptionScope] = useState(organizationId || 'global');
  const [optionGroup, setOptionGroup] = useState<AssessmentOptionGroup>('grade');
  const [optionLabel, setOptionLabel] = useState('');
  const [optionValue, setOptionValue] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());
  const [editOption, setEditOption] = useState<AssessmentOption | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkEntity, setBulkEntity] = useState<Entity>('subject');
  const [bulkText, setBulkText] = useState('');
  const [bulkParentId, setBulkParentId] = useState('');

  const orderedSubjects = useMemo(() => [...subjects].sort((a, b) => a.name.localeCompare(b.name)), [subjects]);
  const orderedChapters = useMemo(() => [...chapters].sort((a, b) => a.name.localeCompare(b.name)), [chapters]);
  const orderedTopics = useMemo(() => [...topics].sort((a, b) => a.name.localeCompare(b.name)), [topics]);

  const loadOptions = useCallback(async () => {
    if (!supabase || !superAdmin) return;
    const [optionResult, organizationResult] = await Promise.all([
      supabase.from('assessment_options').select('id,organization_id,option_group,value,label,code,display_order,is_active,metadata').order('option_group').order('display_order').order('label'),
      supabase.from('organizations').select('id,name').order('name'),
    ]);
    if (optionResult.error) setError(/assessment_options/i.test(optionResult.error.message) ? 'Apply Supabase migration 33 to enable configurable grades and examinations.' : optionResult.error.message);
    else setOptionRows((optionResult.data || []) as AssessmentOption[]);
    if (!organizationResult.error) setOrganizations((organizationResult.data || []) as Array<{ id: string; name: string }>);
  }, [superAdmin]);

  useEffect(() => { void loadOptions(); }, [loadOptions]);

  async function api(path: string, body: Record<string, unknown>) {
    if (!session?.access_token) throw new Error('Sign in again before changing settings.');
    const response = await fetch(path, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Unable to update settings.');
    return result;
  }

  async function createTaxonomy(action: 'createSubject' | 'createChapter' | 'createTopic', payload: Record<string, unknown>) {
    setBusy(action); setError(''); setMessage('');
    try {
      await api('/api/question-taxonomy/', { action, organizationId: kind === 'school' ? organizationId : null, ...payload });
      setSubjectName(''); setSubjectCode(''); setChapterName(''); setTopicName('');
      setMessage('Academic settings updated.');
      await onChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to update taxonomy.'); }
    finally { setBusy(''); }
  }

  async function manageTaxonomy(action: 'renameItem' | 'moveItems' | 'deleteItems', entity: Entity, ids: string[], extra: Record<string, unknown> = {}) {
    if (!ids.length) return;
    setBusy(`${action}-${entity}`); setError(''); setMessage('');
    try {
      const result = await api('/api/question-taxonomy/', { action, entity, ids, organizationId: kind === 'school' ? organizationId : null, ...extra });
      const archived = Array.isArray(result.archived) ? result.archived.length : 0;
      const deleted = Array.isArray(result.deleted) ? result.deleted.length : 0;
      setMessage(action === 'deleteItems'
        ? kind === 'school'
          ? `${archived || ids.length} item${(archived || ids.length) === 1 ? '' : 's'} removed from the active academic setup. Existing question and analysis history is preserved.`
          : `${deleted} deleted. ${archived} linked item${archived === 1 ? '' : 's'} safely archived.`
        : 'Academic settings updated.');
      setSelected((current) => ({ ...current, [entity]: new Set() })); setEditItem(null); setMoveParent('');
      await onChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to update taxonomy.'); }
    finally { setBusy(''); }
  }

  async function bulkCreate() {
    const names = bulkText.split(/\r?\n|,/).map((value) => value.trim()).filter(Boolean);
    if (!names.length) return;
    setBusy('bulk-create'); setError(''); setMessage('');
    try {
      const result = await api('/api/question-taxonomy/', {
        action: 'bulkCreate', entity: bulkEntity, names, organizationId: kind === 'school' ? organizationId : null,
        subjectId: bulkEntity === 'chapter' ? bulkParentId : undefined,
        chapterId: bulkEntity === 'topic' ? bulkParentId : undefined,
      });
      const created = Array.isArray(result.created) ? result.created.length : 0;
      const skipped = Array.isArray(result.skipped) ? result.skipped.length : 0;
      setMessage(`${created} ${bulkEntity}${created === 1 ? '' : 's'} added${skipped ? ` · ${skipped} duplicate${skipped === 1 ? '' : 's'} skipped` : ''}.`);
      setBulkOpen(false); setBulkText(''); setBulkParentId('');
      await onChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to bulk add academic settings.'); }
    finally { setBusy(''); }
  }

  async function manageOption(action: 'create' | 'update' | 'delete' | 'deactivate' | 'restore', ids: string[] = [], row?: AssessmentOption) {
    setBusy(`option-${action}`); setError(''); setMessage('');
    try {
      const result = await api('/api/assessment-settings/', {
        action, ids,
        optionGroup: optionGroup,
        organizationId: optionScope === 'global' ? null : optionScope,
        label: row?.label || optionLabel,
        value: row?.value || optionValue || optionLabel,
        displayOrder: row?.display_order || 0,
      });
      const archived = Array.isArray(result.archived) ? result.archived.length : 0;
      setMessage(action === 'delete' && archived ? `${archived} setting${archived === 1 ? '' : 's'} are in use and were archived instead of removed.` : 'Assessment settings updated.');
      setOptionLabel(''); setOptionValue(''); setSelectedOptions(new Set()); setEditOption(null);
      await loadOptions();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to update assessment settings.'); }
    finally { setBusy(''); }
  }

  function toggle(entity: Entity, id: string, checked: boolean) {
    setSelected((current) => { const next = new Set(current[entity]); checked ? next.add(id) : next.delete(id); return { ...current, [entity]: next }; });
  }

  const scopedOptions = optionRows.filter((row) => row.option_group === optionGroup && (optionScope === 'global' ? !row.organization_id : row.organization_id === optionScope));
  const filter = search.trim().toLowerCase();
  const visibleSubjects = orderedSubjects.filter((row) => !filter || `${row.name} ${row.code}`.toLowerCase().includes(filter));
  const visibleChapters = orderedChapters.filter((row) => !filter || `${row.name} ${orderedSubjects.find((item) => item.id === row.subject_id)?.name || ''}`.toLowerCase().includes(filter));
  const visibleTopics = orderedTopics.filter((row) => !filter || `${row.name} ${orderedChapters.find((item) => item.id === row.chapter_id)?.name || ''}`.toLowerCase().includes(filter));

  function managementTable(entity: Entity, rows: Array<TaxonomySubject | TaxonomyChapter | TaxonomyTopic>) {
    const ids = rows.map((row) => row.id);
    const selection = selected[entity];
    return <Card className="gap-0 border-[#E7ECEB] shadow-none"><CardContent className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><strong className="text-[#14232B]">{entity === 'subject' ? 'Subjects' : entity === 'chapter' ? 'Chapters' : 'Topics'}</strong><p className="text-xs text-[#6B7980]">{rows.length} active item{rows.length === 1 ? '' : 's'}</p></div>{(superAdmin || kind === 'school') && <div className="flex flex-wrap gap-2"><Button variant="ghost" size="sm" onClick={() => setSelected((current) => ({ ...current, [entity]: new Set(ids.filter((id) => rows.find((row) => row.id === id)?.organization_id === organizationId || superAdmin)) }))}>Select own</Button><Button variant="ghost" size="sm" onClick={() => setSelected((current) => ({ ...current, [entity]: new Set() }))}>Clear</Button><Button variant="outline" size="sm" disabled={!selection.size || busy.startsWith('delete')} onClick={() => void manageTaxonomy('deleteItems', entity, [...selection])} className="border-[#B54747]/30 text-[#B54747]"><Trash2 className="mr-1 h-4 w-4" />Archive</Button></div>}</div>
      {(superAdmin || kind === 'school') && selection.size > 0 && entity !== 'subject' && <div className="mb-3 flex gap-2 rounded-xl bg-[#F7F9F7] p-3"><Select value={moveParent} onValueChange={setMoveParent}><SelectTrigger className="bg-white"><SelectValue placeholder={entity === 'chapter' ? 'Move to subject' : 'Move to chapter'} /></SelectTrigger><SelectContent>{(entity === 'chapter' ? orderedSubjects : orderedChapters).map((parent) => <SelectItem key={parent.id} value={parent.id}>{parent.name}</SelectItem>)}</SelectContent></Select><Button disabled={!moveParent} onClick={() => void manageTaxonomy('moveItems', entity, [...selection], { parentId: moveParent })}>Move selected</Button></div>}
      <div className="max-h-[420px] space-y-2 overflow-y-auto">{rows.map((row) => {
        const parent = entity === 'chapter' ? orderedSubjects.find((item) => item.id === (row as TaxonomyChapter).subject_id)?.name : entity === 'topic' ? orderedChapters.find((item) => item.id === (row as TaxonomyTopic).chapter_id)?.name : (row as TaxonomySubject).code;
        const editing = editItem?.entity === entity && editItem.id === row.id;
        return <div key={row.id} className="flex items-center gap-3 rounded-xl border border-[#E7ECEB] bg-white p-3">{(superAdmin || (kind === 'school' && row.organization_id === organizationId)) && <Checkbox checked={selection.has(row.id)} onCheckedChange={(checked) => toggle(entity, row.id, checked === true)} />}{editing ? <><Input value={editItem.name} onChange={(event) => setEditItem({ ...editItem, name: event.target.value })} className="h-9" />{entity === 'subject' && <Input value={editItem.code || ''} onChange={(event) => setEditItem({ ...editItem, code: event.target.value.toUpperCase() })} className="h-9 w-24" />}<Button size="icon" onClick={() => void manageTaxonomy('renameItem', entity, [row.id], { name: editItem.name, code: editItem.code })}><Check className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => setEditItem(null)}><X className="h-4 w-4" /></Button></> : <><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-[#14232B]">{row.name}</p><p className="truncate text-xs text-[#6B7980]">{parent || 'No parent'} · {row.organization_id ? 'School' : 'Universal'}</p></div>{(superAdmin || (kind === 'school' && row.organization_id === organizationId)) && <Button variant="ghost" size="icon" onClick={() => setEditItem({ entity, id: row.id, name: row.name, code: entity === 'subject' ? (row as TaxonomySubject).code : undefined })}><Edit3 className="h-4 w-4" /></Button>}</>}
        </div>;
      })}</div>
    </CardContent></Card>;
  }

  return <div className="space-y-5">
    <Card className="gap-0 border-[#CFE0EB] bg-gradient-to-r from-[#F8FBFF] to-[#F7FBFA] shadow-none"><CardContent className="p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#0E5A5A]"><Settings2 className="h-4 w-4" />Academic setup</div><h2 className="mt-1 text-xl font-bold text-[#14232B]">Subjects, chapters & topics that match your institution</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-[#6B7980]">Analysis is most useful when every question is classified consistently. Your institution can add its own academic structure without changing Evidara's universal taxonomy.</p></div><div className="flex flex-wrap gap-2"><Badge variant="outline" className="w-fit border-[#DCE9E7] bg-white text-[#0E5A5A]">{superAdmin ? 'Platform controls' : 'Institution controls'}</Badge><Button onClick={() => setBulkOpen(true)} className="bg-[#0E5A5A] text-white hover:bg-[#0A4747]"><Plus className="mr-2 h-4 w-4" />Bulk add</Button></div></div></CardContent></Card>
    <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-[#DCE9E7] bg-white p-4"><strong className="text-sm text-[#14232B]">Improves imports</strong><p className="mt-1 text-xs leading-5 text-[#6B7980]">Uploaded questions match your own academic structure.</p></div><div className="rounded-xl border border-[#DCE9E7] bg-white p-4"><strong className="text-sm text-[#14232B]">Improves analysis</strong><p className="mt-1 text-xs leading-5 text-[#6B7980]">Chapter and topic reports stay meaningful for teachers.</p></div><div className="rounded-xl border border-[#DCE9E7] bg-white p-4"><strong className="text-sm text-[#14232B]">Safe institution ownership</strong><p className="mt-1 text-xs leading-5 text-[#6B7980]">Schools may edit or archive only their own taxonomy.</p></div></div>
    {(error || message) && <div className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-[#B54747]/20 bg-[#B54747]/5 text-[#B54747]' : 'border-[#0E5A5A]/20 bg-[#DCE9E7]/50 text-[#0E5A5A]'}`}>{error || message}</div>}
    <Tabs defaultValue="structure"><TabsList className="h-auto flex-wrap bg-[#E7ECEB]/60 p-1"><TabsTrigger value="structure">Subjects, chapters and topics</TabsTrigger><TabsTrigger value="grades">Grades</TabsTrigger><TabsTrigger value="exams">Examinations</TabsTrigger><TabsTrigger value="tests">Paper test types</TabsTrigger></TabsList>
      <TabsContent value="structure" className="mt-4 space-y-4">
        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="gap-0 border-[#E7ECEB] shadow-none"><CardContent className="space-y-3 p-4"><div className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-[#0E5A5A]" /><strong>Add subject</strong></div><Input value={subjectName} onChange={(event) => setSubjectName(event.target.value)} placeholder="Logical Reasoning" /><Input value={subjectCode} onChange={(event) => setSubjectCode(event.target.value.toUpperCase())} placeholder="LR" /><Button disabled={!subjectName.trim()} onClick={() => void createTaxonomy('createSubject', { name: subjectName, code: subjectCode, universal: superAdmin && kind === 'admin' })} className="w-full"><Plus className="mr-2 h-4 w-4" />{kind === 'school' ? 'Add institution subject' : 'Add universal subject'}</Button></CardContent></Card>
          <Card className="gap-0 border-[#E7ECEB] shadow-none"><CardContent className="space-y-3 p-4"><div className="flex items-center gap-2"><Layers3 className="h-5 w-5 text-[#2E6D8B]" /><strong>Add chapter</strong></div><SearchableTaxonomySelect value={chapterSubjectId} onValueChange={setChapterSubjectId} options={orderedSubjects.map((row) => ({ value: row.id, label: row.name, description: row.code }))} placeholder="Select subject" /><Input value={chapterName} onChange={(event) => setChapterName(event.target.value)} placeholder="Chapter name" /><Button disabled={!chapterSubjectId || !chapterName.trim()} onClick={() => void createTaxonomy('createChapter', { subjectId: chapterSubjectId, name: chapterName })} className="w-full bg-[#2E6D8B]"><Plus className="mr-2 h-4 w-4" />Add chapter</Button></CardContent></Card>
          <Card className="gap-0 border-[#E7ECEB] shadow-none"><CardContent className="space-y-3 p-4"><div className="flex items-center gap-2"><Tags className="h-5 w-5 text-[#8A5F00]" /><strong>Add topic</strong></div><SearchableTaxonomySelect value={topicChapterId} onValueChange={setTopicChapterId} options={orderedChapters.map((row) => ({ value: row.id, label: row.name, description: orderedSubjects.find((subject) => subject.id === row.subject_id)?.name }))} placeholder="Select chapter" /><Input value={topicName} onChange={(event) => setTopicName(event.target.value)} placeholder="Topic name" /><Button disabled={!topicChapterId || !topicName.trim()} onClick={() => void createTaxonomy('createTopic', { chapterId: topicChapterId, name: topicName })} className="w-full bg-[#8A5F00]"><Plus className="mr-2 h-4 w-4" />Add topic</Button></CardContent></Card>
        </div>
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7980]" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search academic settings" className="pl-9" /></div>
        <div className="grid gap-4 xl:grid-cols-3">{managementTable('subject', visibleSubjects)}{managementTable('chapter', visibleChapters)}{managementTable('topic', visibleTopics)}</div>
      </TabsContent>
      {(['grade','exam_type','test_type'] as AssessmentOptionGroup[]).map((group) => <TabsContent key={group} value={group === 'grade' ? 'grades' : group === 'exam_type' ? 'exams' : 'tests'} className="mt-4">
        {!superAdmin ? <Card className="border-[#E7ECEB] shadow-none"><CardContent className="p-6 text-sm text-[#6B7980]">Only Super Admin can change {groupLabels[group].toLowerCase()}.</CardContent></Card> : <div className="space-y-4">
          <Card className="gap-0 border-[#E7ECEB] shadow-none"><CardContent className="p-4"><div className="grid gap-3 md:grid-cols-[220px_1fr_1fr_auto] md:items-end"><div><GuidedLabel>Scope</GuidedLabel><Select value={optionScope} onValueChange={setOptionScope}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="global">Global Evidara</SelectItem>{organizations.map((organization) => <SelectItem key={organization.id} value={organization.id}>{organization.name}</SelectItem>)}</SelectContent></Select></div>{group !== 'test_type' && <><div><GuidedLabel>Display label</GuidedLabel><Input className="mt-2" value={optionLabel} onChange={(event) => { setOptionLabel(event.target.value); if (!optionValue) setOptionValue(event.target.value); }} placeholder={group === 'grade' ? 'Grade 8' : 'NEET'} /></div><div><GuidedLabel>Stored value</GuidedLabel><Input className="mt-2" value={optionValue} onChange={(event) => setOptionValue(event.target.value)} /></div><Button disabled={!optionLabel.trim()} onClick={() => { setOptionGroup(group); void manageOption('create'); }}><Plus className="mr-2 h-4 w-4" />Add</Button></>}</div>{group === 'test_type' && <p className="mt-3 text-xs text-[#6B7980]">Paper test types use stable internal values for analytics. Edit labels, reorder, deactivate or restore them here; Custom test names are entered while creating a paper.</p>}</CardContent></Card>
          <Card className="gap-0 border-[#E7ECEB] shadow-none"><CardContent className="p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><strong>{groupLabels[group]}</strong><p className="text-xs text-[#6B7980]">{scopedOptions.length} configured</p></div><div className="flex gap-2"><Button variant="ghost" size="sm" onClick={() => setSelectedOptions(new Set(scopedOptions.map((row) => row.id)))}>Select all</Button><Button variant="outline" size="sm" disabled={!selectedOptions.size} onClick={() => void manageOption('delete', [...selectedOptions])} className="border-[#B54747]/30 text-[#B54747]"><Trash2 className="mr-1 h-4 w-4" />Delete / archive</Button></div></div><div className="space-y-2">{scopedOptions.map((row) => <div key={row.id} className={`flex items-center gap-3 rounded-xl border p-3 ${row.is_active ? 'border-[#E7ECEB] bg-white' : 'border-[#AEB8BC] bg-[#F7F9F7] opacity-70'}`}><Checkbox checked={selectedOptions.has(row.id)} onCheckedChange={(checked) => { const next = new Set(selectedOptions); checked ? next.add(row.id) : next.delete(row.id); setSelectedOptions(next); }} />{editOption?.id === row.id ? <><Input value={editOption.label} onChange={(event) => setEditOption({ ...editOption, label: event.target.value })} /><Input value={editOption.value} onChange={(event) => setEditOption({ ...editOption, value: event.target.value })} disabled={group === 'test_type'} /><Button size="icon" onClick={() => void manageOption('update', [row.id], editOption)}><Check className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => setEditOption(null)}><X className="h-4 w-4" /></Button></> : <><div className="min-w-0 flex-1"><p className="font-medium text-[#14232B]">{row.label}</p><p className="text-xs text-[#6B7980]">{row.value} · {row.is_active ? 'Active' : 'Inactive'}</p></div><Button variant="ghost" size="icon" onClick={() => setEditOption({ ...row })}><Edit3 className="h-4 w-4" /></Button>{!row.is_active && <Button variant="outline" size="sm" onClick={() => void manageOption('restore', [row.id])}>Restore</Button>}</>}</div>)}</div></CardContent></Card>
        </div>}
      </TabsContent>)}
    </Tabs>
    <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle>Bulk add academic setup</DialogTitle><DialogDescription>Paste one item per line. Numbering is removed automatically and duplicates are skipped.</DialogDescription></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-3">{(['subject','chapter','topic'] as Entity[]).map((entity) => <button type="button" key={entity} onClick={() => { setBulkEntity(entity); setBulkParentId(''); }} className={`rounded-xl border p-3 text-left text-sm ${bulkEntity === entity ? 'border-[#0E5A5A] bg-[#EAF6F4] text-[#0E5A5A]' : 'border-[#DFE6EC] bg-white text-[#31505A]'}`}><strong className="capitalize">{entity}s</strong></button>)}</div>
        {bulkEntity === 'chapter' && <SearchableTaxonomySelect value={bulkParentId} onValueChange={setBulkParentId} options={orderedSubjects.map((row) => ({ value: row.id, label: row.name, description: row.organization_id ? 'Institution' : 'Universal' }))} placeholder="Choose subject" />}
        {bulkEntity === 'topic' && <SearchableTaxonomySelect value={bulkParentId} onValueChange={setBulkParentId} options={orderedChapters.map((row) => ({ value: row.id, label: row.name, description: orderedSubjects.find((subject) => subject.id === row.subject_id)?.name }))} placeholder="Choose chapter" />}
        <Textarea rows={12} value={bulkText} onChange={(event) => setBulkText(event.target.value)} placeholder={bulkEntity === 'subject' ? 'Physics\nChemistry\nBiology' : bulkEntity === 'chapter' ? '1. Units and Measurements\n2. Kinematics\n3. Laws of Motion' : 'Motion in one dimension\nProjectile motion\nRelative motion'} />
        <div className="rounded-xl border border-[#CFE0EB] bg-[#F7FAFF] p-3 text-xs leading-5 text-[#31566B]">These items become part of your institution taxonomy and will be available in question import, question bank filters, paper creation and analytics.</div>
        <DialogFooter><Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button><Button disabled={!bulkText.trim() || ((bulkEntity === 'chapter' || bulkEntity === 'topic') && !bulkParentId) || busy === 'bulk-create'} onClick={() => void bulkCreate()} className="bg-[#0E5A5A] text-white hover:bg-[#0A4747]">{busy === 'bulk-create' ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Add {bulkEntity}s</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    {busy && <div className="flex items-center gap-2 text-xs text-[#6B7980]"><LoaderCircle className="h-4 w-4 animate-spin" />Updating settings…</div>}
  </div>;
}
