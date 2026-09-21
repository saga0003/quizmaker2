from pathlib import Path
import re

# 1) Server: add a single bulk taxonomy action that authenticates once and uses
# batched reads/inserts instead of one request per chapter/topic.
route = Path('src/app/api/question-taxonomy/route.ts')
source = route.read_text()
marker = "    if (action === 'createChapter') {"
if marker not in source:
    raise SystemExit('createChapter marker not found')

bulk_action = r'''    if (action === 'createMissingTaxonomy') {
      const organizationId = resolvedScope(ctx, body.organizationId);
      const chapterInput = Array.isArray(body.chapters) ? body.chapters : [];
      const topicInput = Array.isArray(body.topics) ? body.topics : [];

      if (chapterInput.length > 500 || topicInput.length > 1000) {
        throw Object.assign(new Error('This paper contains too many new academic items to add at once. Split the import into smaller batches.'), { status: 400 });
      }

      const chapterRequests = new Map<string, { subjectId: string; name: string }>();
      for (const raw of chapterInput) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
        const item = raw as Record<string, unknown>;
        const subjectId = String(item.subjectId || '').trim();
        if (!subjectId) continue;
        const name = cleanName(item.name, 'Chapter name');
        chapterRequests.set(`${subjectId}|${name.toLowerCase()}`, { subjectId, name });
      }

      const topicRequests = new Map<string, { subjectId: string; chapterName: string; name: string }>();
      for (const raw of topicInput) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
        const item = raw as Record<string, unknown>;
        const subjectId = String(item.subjectId || '').trim();
        if (!subjectId) continue;
        const chapterName = cleanName(item.chapterName, 'Chapter name');
        const name = cleanName(item.name, 'Topic name');
        topicRequests.set(`${subjectId}|${chapterName.toLowerCase()}|${name.toLowerCase()}`, { subjectId, chapterName, name });
      }

      const subjectIds = [...new Set([
        ...[...chapterRequests.values()].map((item) => item.subjectId),
        ...[...topicRequests.values()].map((item) => item.subjectId),
      ])];
      if (!subjectIds.length) {
        return NextResponse.json({ chapters: [], topics: [], createdChapters: 0, createdTopics: 0 }, { headers: { 'Cache-Control': 'no-store' } });
      }

      const { data: subjectRows, error: subjectError } = await ctx.admin
        .from('subjects')
        .select('id,organization_id,is_active')
        .in('id', subjectIds);
      if (subjectError) throw new Error(subjectError.message);
      const visibleSubjectIds = new Set((subjectRows || [])
        .filter((row) => row.is_active !== false && (ctx.superAdmin || row.organization_id === null || row.organization_id === organizationId))
        .map((row) => String(row.id)));
      const hiddenSubject = subjectIds.find((id) => !visibleSubjectIds.has(id));
      if (hiddenSubject) throw Object.assign(new Error('One of the subjects in this paper is no longer available. Refresh and try again.'), { status: 400 });

      const { data: existingChapterRows, error: chapterReadError } = await ctx.admin
        .from('chapters')
        .select('id,name,subject_id,organization_id,is_active')
        .in('subject_id', subjectIds)
        .eq('is_active', true);
      if (chapterReadError) throw new Error(chapterReadError.message);

      const visibleChapters = (existingChapterRows || []).filter((row) =>
        ctx.superAdmin || row.organization_id === null || row.organization_id === organizationId
      );
      const chapterByKey = new Map(visibleChapters.map((row) => [
        `${row.subject_id}|${String(row.name || '').trim().toLowerCase()}`,
        row,
      ]));

      const requiredChapters = new Map(chapterRequests);
      for (const item of topicRequests.values()) {
        requiredChapters.set(`${item.subjectId}|${item.chapterName.toLowerCase()}`, { subjectId: item.subjectId, name: item.chapterName });
      }

      const chaptersToCreate = [...requiredChapters.entries()]
        .filter(([key]) => !chapterByKey.has(key))
        .map(([, item]) => ({ name: item.name, subject_id: item.subjectId, organization_id: organizationId, is_active: true }));

      let createdChapterRows: Array<Record<string, unknown>> = [];
      if (chaptersToCreate.length) {
        const { data, error } = await ctx.admin
          .from('chapters')
          .insert(chaptersToCreate)
          .select('id,name,subject_id,organization_id,is_active');
        if (error) throw new Error(error.message);
        createdChapterRows = data || [];
        for (const row of createdChapterRows) {
          chapterByKey.set(`${row.subject_id}|${String(row.name || '').trim().toLowerCase()}`, row);
        }
      }

      const requestedChapterRows = [...requiredChapters.entries()]
        .map(([key]) => chapterByKey.get(key))
        .filter(Boolean);
      const requestedChapterIds = [...new Set(requestedChapterRows.map((row) => String(row!.id)))];

      let visibleTopics: Array<Record<string, unknown>> = [];
      if (requestedChapterIds.length) {
        const { data, error } = await ctx.admin
          .from('topics')
          .select('id,name,chapter_id,organization_id,is_active')
          .in('chapter_id', requestedChapterIds)
          .eq('is_active', true);
        if (error) throw new Error(error.message);
        visibleTopics = (data || []).filter((row) =>
          ctx.superAdmin || row.organization_id === null || row.organization_id === organizationId
        );
      }
      const topicByKey = new Map(visibleTopics.map((row) => [
        `${row.chapter_id}|${String(row.name || '').trim().toLowerCase()}`,
        row,
      ]));

      const topicsToCreate: Array<{ name: string; chapter_id: string; organization_id: string | null; is_active: boolean }> = [];
      const requestedTopicKeys: string[] = [];
      for (const item of topicRequests.values()) {
        const chapter = chapterByKey.get(`${item.subjectId}|${item.chapterName.toLowerCase()}`);
        if (!chapter) throw new Error(`Evidara could not resolve chapter '${item.chapterName}' while creating its topics.`);
        const key = `${chapter.id}|${item.name.toLowerCase()}`;
        requestedTopicKeys.push(key);
        if (!topicByKey.has(key)) topicsToCreate.push({ name: item.name, chapter_id: String(chapter.id), organization_id: organizationId, is_active: true });
      }

      let createdTopicRows: Array<Record<string, unknown>> = [];
      if (topicsToCreate.length) {
        const { data, error } = await ctx.admin
          .from('topics')
          .insert(topicsToCreate)
          .select('id,name,chapter_id,organization_id,is_active');
        if (error) throw new Error(error.message);
        createdTopicRows = data || [];
        for (const row of createdTopicRows) {
          topicByKey.set(`${row.chapter_id}|${String(row.name || '').trim().toLowerCase()}`, row);
        }
      }

      const requestedTopics = requestedTopicKeys.map((key) => topicByKey.get(key)).filter(Boolean);
      return NextResponse.json({
        chapters: requestedChapterRows,
        topics: requestedTopics,
        createdChapters: createdChapterRows.length,
        createdTopics: createdTopicRows.length,
      }, { headers: { 'Cache-Control': 'no-store' } });
    }

'''
source = source.replace(marker, bulk_action + marker, 1)
route.write_text(source)

# 2) Client: replace the serial N-request loop with one bulk request, one state
# update, a meaningful progress label and a timeout that can be retried safely.
core = Path('src/components/evidara/question-bulk-import-dialog-core.tsx')
source = core.read_text()
pattern = re.compile(r"  async function createAllMissingTaxonomy\(\) \{.*?\n  \}\n\n  async function", re.S)
match = pattern.search(source)
if not match:
    raise SystemExit('createAllMissingTaxonomy block not found')

replacement = r'''  async function createAllMissingTaxonomy() {
    if (!session?.access_token) {
      setError('Your session has expired. Sign in again, then retry.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const subjectByName = new Map(localSubjects.flatMap((subject) => [[nameKey(subject.name), subject], [nameKey(subject.code), subject]] as const));
      const chapterRequests = new Map<string, { name: string; subjectId: string }>();
      const topicRequests = new Map<string, { name: string; subjectId: string; chapterName: string }>();

      for (const raw of rawRows) {
        const subject = subjectByName.get(nameKey(raw.subject));
        const chapterName = normalizeName(raw.chapter);
        const topicName = normalizeName(raw.topic);
        if (!subject || !chapterName) continue;

        const chapterKey = `${subject.id}|${nameKey(chapterName)}`;
        const chapterExists = localChapters.some((chapter) => chapter.subject_id === subject.id && nameKey(chapter.name) === nameKey(chapterName));
        if (!chapterExists) chapterRequests.set(chapterKey, { name: chapterName, subjectId: subject.id });

        if (topicName) {
          const existingChapter = localChapters.find((chapter) => chapter.subject_id === subject.id && nameKey(chapter.name) === nameKey(chapterName));
          const topicExists = existingChapter
            ? localTopics.some((topic) => topic.chapter_id === existingChapter.id && nameKey(topic.name) === nameKey(topicName))
            : false;
          if (!topicExists) topicRequests.set(`${subject.id}|${nameKey(chapterName)}|${nameKey(topicName)}`, { name: topicName, subjectId: subject.id, chapterName });
        }
      }

      const total = chapterRequests.size + topicRequests.size;
      if (!total) {
        setNotice('All chapters and topics are already available.');
        return;
      }

      setStage(`Adding ${chapterRequests.size} chapter${chapterRequests.size === 1 ? '' : 's'} and ${topicRequests.size} topic${topicRequests.size === 1 ? '' : 's'}…`);
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 45000);
      let response: Response;
      try {
        response = await fetch('/api/question-taxonomy/', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'createMissingTaxonomy',
            organizationId: kind === 'school' ? organizationId : null,
            chapters: [...chapterRequests.values()],
            topics: [...topicRequests.values()],
          }),
          signal: controller.signal,
        });
      } finally {
        window.clearTimeout(timeout);
      }

      const payload = await response.json().catch(() => ({})) as {
        error?: string;
        chapters?: TaxonomyChapter[];
        topics?: TaxonomyTopic[];
        createdChapters?: number;
        createdTopics?: number;
      };
      if (!response.ok) throw new Error(payload.error || 'Evidara could not add the missing chapters and topics.');

      const returnedChapters = payload.chapters || [];
      const returnedTopics = payload.topics || [];
      setLocalChapters((existing) => {
        const byId = new Map(existing.map((item) => [item.id, item]));
        returnedChapters.forEach((item) => byId.set(item.id, item));
        return [...byId.values()];
      });
      setLocalTopics((existing) => {
        const byId = new Map(existing.map((item) => [item.id, item]));
        returnedTopics.forEach((item) => byId.set(item.id, item));
        return [...byId.values()];
      });

      const createdChapters = Number(payload.createdChapters || 0);
      const createdTopics = Number(payload.createdTopics || 0);
      setNotice(createdChapters || createdTopics
        ? `Done. Added ${createdChapters} chapter${createdChapters === 1 ? '' : 's'} and ${createdTopics} topic${createdTopics === 1 ? '' : 's'}. Evidara is rechecking the questions now.`
        : 'Done. The required chapters and topics were already available. Evidara is rechecking the questions now.');
    } catch (caught) {
      const timedOut = caught instanceof DOMException && caught.name === 'AbortError';
      setError(timedOut
        ? 'Adding the academic structure took longer than expected. Nothing needs to be edited manually — click Create all missing taxonomy again to safely retry.'
        : caught instanceof Error ? caught.message : 'Evidara could not add the missing chapters and topics. Please retry.');
    } finally {
      setBusy(false);
      setStage('');
    }
  }

  async function'''
source = source[:match.start()] + replacement + source[match.end():]
core.write_text(source)

# 3) Regression assertions for the new fast path.
smoke = Path('scripts/v19-1-latex-paper-import-smoke.mjs')
source = smoke.read_text()
marker = "console.log(`\\nEvidara V19.1 LaTeX Paper Import: ${passed} passed, ${failed} failed`);"
if marker not in source:
    raise SystemExit('V19.1 smoke marker not found')
checks = r'''const taxonomyRoute=read('src/app/api/question-taxonomy/route.ts');
check('missing taxonomy has a single bulk server action',taxonomyRoute.includes("action === 'createMissingTaxonomy'")&&taxonomyRoute.includes('.insert(chaptersToCreate)')&&taxonomyRoute.includes('.insert(topicsToCreate)'));
const bulkImportFast=read('src/components/evidara/question-bulk-import-dialog-core.tsx');
check('bulk import creates missing taxonomy in one request',bulkImportFast.includes("action: 'createMissingTaxonomy'")&&bulkImportFast.includes('Adding ${chapterRequests.size} chapter')&&bulkImportFast.includes('controller.abort()'));
check('bulk taxonomy no longer loops browser requests serially',!bulkImportFast.includes("for (const request of chapterRequests.values()) {\n        const item = await postTaxonomy('createChapter'"));
'''
smoke.write_text(source.replace(marker, checks + '\n' + marker, 1))

print('Applied fast bulk taxonomy creation fix.')
