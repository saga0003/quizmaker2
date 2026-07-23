'use client';

import { useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, Layers3, LoaderCircle, Plus, Search, Tags } from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import { normalizeEvidaraRole } from '@/lib/roles';
import type { TaxonomyChapter, TaxonomySubject, TaxonomyTopic } from '@/types/questions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { GuidedLabel } from '@/components/evidara/question-help';
import { SearchableTaxonomySelect } from '@/components/evidara/searchable-taxonomy-select';

export function QuestionTaxonomySettings({
  kind,
  organizationId,
  subjects,
  chapters,
  topics,
  onChanged,
}: {
  kind: 'admin' | 'school';
  organizationId: string | null;
  subjects: TaxonomySubject[];
  chapters: TaxonomyChapter[];
  topics: TaxonomyTopic[];
  onChanged: () => Promise<void> | void;
}) {
  const { profile, session } = useAuth();
  const role = normalizeEvidaraRole(profile?.role);
  const canAddSubject = role === 'super_admin';
  const [search, setSearch] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [chapterSubjectId, setChapterSubjectId] = useState('');
  const [chapterName, setChapterName] = useState('');
  const [topicChapterId, setTopicChapterId] = useState('');
  const [topicName, setTopicName] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const orderedSubjects = useMemo(
    () => [...subjects].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    [subjects],
  );
  const orderedChapters = useMemo(
    () => [...chapters].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    [chapters],
  );
  const orderedTopics = useMemo(
    () => [...topics].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    [topics],
  );

  const visibleSubjects = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return orderedSubjects;
    return orderedSubjects.filter((subject) => {
      const subjectChapters = orderedChapters.filter((chapter) => chapter.subject_id === subject.id);
      const chapterIds = new Set(subjectChapters.map((chapter) => chapter.id));
      const subjectTopics = orderedTopics.filter((topic) => chapterIds.has(topic.chapter_id));
      return `${subject.name} ${subject.code} ${subjectChapters.map((chapter) => chapter.name).join(' ')} ${subjectTopics.map((topic) => topic.name).join(' ')}`
        .toLowerCase()
        .includes(term);
    });
  }, [orderedChapters, orderedSubjects, orderedTopics, search]);

  async function create(action: 'createSubject' | 'createChapter' | 'createTopic', payload: Record<string, unknown>) {
    if (!session?.access_token) {
      setError('Sign in again before changing question settings.');
      return;
    }
    setBusy(action);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/question-taxonomy/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, organizationId: kind === 'school' ? organizationId : null, ...payload }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Unable to update question settings.');
      setMessage(result.duplicate ? 'That item already existed and has been selected from the database.' : 'Question settings updated successfully.');
      setSubjectName('');
      setSubjectCode('');
      setChapterName('');
      setTopicName('');
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update question settings.');
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="space-y-5">
      <Card className="gap-0 border-[#DCE9E7] bg-[#F7F9F7] shadow-none">
        <CardContent className="p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#0E5A5A]">
                <Layers3 className="h-4 w-4" />Question Settings
              </div>
              <h2 className="mt-1 text-xl font-bold text-[#14232B]">Subjects, chapters and topics</h2>
              <p className="mt-1 max-w-3xl text-sm text-[#6B7980]">
                Subjects are universal and controlled only by Super Admin. Chapters and topics can be added by Evidara Admin, School Admin or School Teacher and are available immediately while creating questions.
              </p>
            </div>
            <Badge variant="outline" className="w-fit border-[#DCE9E7] bg-white text-[#0E5A5A]">
              A–Z sorting and live search enabled
            </Badge>
          </div>
        </CardContent>
      </Card>

      {(error || message) && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-[#B54747]/20 bg-[#B54747]/5 text-[#B54747]' : 'border-[#0E5A5A]/20 bg-[#DCE9E7]/50 text-[#0E5A5A]'}`}>
          {error || message}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="gap-0 border-[#E7ECEB] shadow-none">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-[#0E5A5A]" /><strong className="text-[#14232B]">Add subject</strong></div>
              <Badge className={canAddSubject ? 'bg-[#DCE9E7] text-[#0E5A5A]' : 'bg-[#E7ECEB] text-[#6B7980]'}>{canAddSubject ? 'Super Admin' : 'Locked'}</Badge>
            </div>
            <div className="space-y-3">
              <div><GuidedLabel help="The universal subject name shown across Evidara question banks.">Subject name</GuidedLabel><Input value={subjectName} onChange={(event) => setSubjectName(event.target.value)} disabled={!canAddSubject} placeholder="Example: Physics" className="mt-2 border-[#E7ECEB]" /></div>
              <div><GuidedLabel help="A short unique code such as PHY, CHEM or MATH.">Subject code</GuidedLabel><Input value={subjectCode} onChange={(event) => setSubjectCode(event.target.value.toUpperCase())} disabled={!canAddSubject} placeholder="PHY" className="mt-2 border-[#E7ECEB]" /></div>
              <Button type="button" disabled={!canAddSubject || !subjectName.trim() || busy === 'createSubject'} onClick={() => void create('createSubject', { name: subjectName, code: subjectCode })} className="w-full bg-[#0E5A5A] text-white hover:bg-[#0A4747]">
                {busy === 'createSubject' ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Add universal subject
              </Button>
              {!canAddSubject && <p className="text-xs leading-relaxed text-[#6B7980]">Only Super Admin can change the universal subject list. Chapters and topics remain available below.</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="gap-0 border-[#E7ECEB] shadow-none">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2"><Layers3 className="h-5 w-5 text-[#2E6D8B]" /><strong className="text-[#14232B]">Add chapter</strong></div>
            <div className="space-y-3">
              <div><GuidedLabel help="Search and choose the subject under which this chapter belongs.">Subject</GuidedLabel><div className="mt-2"><SearchableTaxonomySelect value={chapterSubjectId} onValueChange={setChapterSubjectId} options={orderedSubjects.map((subject) => ({ value: subject.id, label: subject.name, description: subject.code }))} placeholder="Select subject" /></div></div>
              <div><GuidedLabel help="Chapter names are automatically sorted A to Z everywhere in the question module.">Chapter name</GuidedLabel><Input value={chapterName} onChange={(event) => setChapterName(event.target.value)} placeholder="Example: Motion in a Straight Line" className="mt-2 border-[#E7ECEB]" /></div>
              <Button type="button" disabled={!chapterSubjectId || !chapterName.trim() || busy === 'createChapter'} onClick={() => void create('createChapter', { subjectId: chapterSubjectId, name: chapterName })} className="w-full bg-[#2E6D8B] text-white hover:bg-[#245A73]">
                {busy === 'createChapter' ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Add chapter
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="gap-0 border-[#E7ECEB] shadow-none">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2"><Tags className="h-5 w-5 text-[#8A5F00]" /><strong className="text-[#14232B]">Add topic</strong></div>
            <div className="space-y-3">
              <div><GuidedLabel help="Search and choose the chapter under which this topic belongs.">Chapter</GuidedLabel><div className="mt-2"><SearchableTaxonomySelect value={topicChapterId} onValueChange={setTopicChapterId} options={orderedChapters.map((chapter) => ({ value: chapter.id, label: chapter.name, description: orderedSubjects.find((subject) => subject.id === chapter.subject_id)?.name }))} placeholder="Select chapter" /></div></div>
              <div><GuidedLabel help="Topics are optional for questions but recommended for topic-wise testing and dynamic serial numbering.">Topic name</GuidedLabel><Input value={topicName} onChange={(event) => setTopicName(event.target.value)} placeholder="Example: Relative Velocity" className="mt-2 border-[#E7ECEB]" /></div>
              <Button type="button" disabled={!topicChapterId || !topicName.trim() || busy === 'createTopic'} onClick={() => void create('createTopic', { chapterId: topicChapterId, name: topicName })} className="w-full bg-[#8A5F00] text-white hover:bg-[#6F4D00]">
                {busy === 'createTopic' ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Add topic
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="gap-0 border-[#E7ECEB] shadow-none">
        <CardContent className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <strong className="text-[#14232B]">Current question taxonomy</strong>
              <p className="text-xs text-[#6B7980]">Search any subject, chapter or topic. Results remain grouped by subject and sorted A to Z.</p>
            </div>
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7980]" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search subject, chapter or topic" className="border-[#E7ECEB] pl-9" />
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {visibleSubjects.map((subject) => {
              const subjectChapters = orderedChapters.filter((chapter) => chapter.subject_id === subject.id);
              const topicCount = orderedTopics.filter((topic) => subjectChapters.some((chapter) => chapter.id === topic.chapter_id)).length;
              return (
                <div key={subject.id} className="rounded-2xl border border-[#E7ECEB] bg-[#FBFCFC] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#0E5A5A]" /><strong className="text-[#14232B]">{subject.name}</strong></div>
                      <p className="mt-1 text-xs text-[#6B7980]">{subject.code} · {subjectChapters.length} chapters · {topicCount} topics</p>
                    </div>
                    <Badge variant="outline" className="border-[#E7ECEB] text-[10px] text-[#6B7980]">{subject.organization_id ? 'School' : 'Universal'}</Badge>
                  </div>
                  <div className="mt-3 space-y-2">
                    {subjectChapters.map((chapter) => {
                      const chapterTopics = orderedTopics.filter((topic) => topic.chapter_id === chapter.id);
                      return (
                        <div key={chapter.id} className="rounded-xl border border-[#E7ECEB] bg-white p-3">
                          <strong className="text-sm text-[#14232B]">{chapter.name}</strong>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {chapterTopics.length ? chapterTopics.map((topic) => <Badge key={topic.id} variant="outline" className="border-[#DCE9E7] bg-[#F7F9F7] text-[10px] text-[#0E5A5A]">{topic.name}</Badge>) : <span className="text-xs text-[#6B7980]">No topics added yet</span>}
                          </div>
                        </div>
                      );
                    })}
                    {!subjectChapters.length && <div className="rounded-xl border border-dashed border-[#E7ECEB] p-3 text-xs text-[#6B7980]">No chapters have been added.</div>}
                  </div>
                </div>
              );
            })}
            {!visibleSubjects.length && <div className="col-span-full py-10 text-center text-sm text-[#6B7980]">No taxonomy items match your search.</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
