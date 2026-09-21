import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/server/supabaseServer';
import { isPlatformAdmin, normalizeEvidaraRole } from '@/lib/roles';

function failure(error: unknown) {
  const value = error as { message?: string; status?: number };
  return NextResponse.json(
    { error: value.message || 'Unexpected taxonomy error.' },
    { status: value.status || 500, headers: { 'Cache-Control': 'no-store' } },
  );
}

function cleanName(value: unknown, label: string) {
  const name = String(value || '').trim().replace(/\s+/g, ' ');
  if (name.length < 2) throw Object.assign(new Error(`${label} must contain at least 2 characters.`), { status: 400 });
  if (name.length > 120) throw Object.assign(new Error(`${label} cannot exceed 120 characters.`), { status: 400 });
  return name;
}

function subjectCode(value: unknown, name: string) {
  const supplied = String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_-]+/g, '');
  if (supplied) return supplied.slice(0, 20);
  const generated = name.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 8);
  return generated || `SUB${Date.now().toString().slice(-5)}`;
}

async function context(request: Request) {
  const auth = await authenticateRequest(request);
  const { data: profile, error: profileError } = await auth.admin
    .from('profiles')
    .select('id,role')
    .eq('id', auth.user.id)
    .single();
  if (profileError || !profile) throw Object.assign(new Error(profileError?.message || 'Evidara profile not found.'), { status: 403 });

  const role = normalizeEvidaraRole(profile.role);
  if (role === 'student') throw Object.assign(new Error('Students cannot manage question taxonomy.'), { status: 403 });

  const { data: membership } = await auth.admin
    .from('organization_members')
    .select('organization_id,is_active')
    .eq('user_id', auth.user.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  return {
    ...auth,
    role,
    platformAdmin: isPlatformAdmin(role),
    superAdmin: role === 'super_admin',
    organizationId: membership?.organization_id || null,
  };
}

type TaxonomyContext = Awaited<ReturnType<typeof context>>;

function resolvedScope(ctx: TaxonomyContext, requestedOrganizationId: unknown) {
  if (ctx.platformAdmin) return requestedOrganizationId ? String(requestedOrganizationId) : null;
  if (!ctx.organizationId) throw Object.assign(new Error('This account is not linked to a school organization.'), { status: 403 });
  return ctx.organizationId;
}

async function ensureParentVisible(
  ctx: TaxonomyContext,
  table: 'subjects' | 'chapters',
  id: string,
  organizationId: string | null,
) {
  const { data, error } = await ctx.admin.from(table).select('id,organization_id,is_active').eq('id', id).maybeSingle();
  if (error || !data || data.is_active === false) throw Object.assign(new Error(`The selected ${table === 'subjects' ? 'subject' : 'chapter'} does not exist or is inactive.`), { status: 400 });
  if (!ctx.superAdmin && data.organization_id !== null && data.organization_id !== organizationId) {
    throw Object.assign(new Error('Schools can only use universal taxonomy or taxonomy owned by their own institution.'), { status: 403 });
  }
  return data;
}

async function duplicateName(
  ctx: TaxonomyContext,
  table: 'subjects' | 'chapters' | 'topics',
  name: string,
  organizationId: string | null,
  parentColumn?: 'subject_id' | 'chapter_id',
  parentId?: string,
) {
  let query = ctx.admin.from(table).select('id,name,organization_id').ilike('name', name).limit(20);
  query = organizationId ? query.eq('organization_id', organizationId) : query.is('organization_id', null);
  if (parentColumn && parentId) query = query.eq(parentColumn, parentId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []).find((row) => String(row.name || '').trim().toLowerCase() === name.toLowerCase()) || null;
}

export async function POST(request: Request) {
  try {
    const ctx = await context(request);
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || '');

    if (action === 'createSubject') {
      const name = cleanName(body.name, 'Subject name');
      const code = subjectCode(body.code, name);
      const organizationId = ctx.superAdmin && body.universal === true ? null : resolvedScope(ctx, body.organizationId);
      const duplicate = await duplicateName(ctx, 'subjects', name, organizationId);
      if (duplicate) return NextResponse.json({ item: duplicate, duplicate: true }, { headers: { 'Cache-Control': 'no-store' } });

      const { data, error } = await ctx.admin
        .from('subjects')
        .insert({ name, code, organization_id: organizationId, is_active: true })
        .select('id,name,code,organization_id')
        .single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ item: data, duplicate: false }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (action === 'createMissingTaxonomy') {
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

      let createdChapterRows: typeof visibleChapters = [];
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

      let createdTopicRows: typeof visibleTopics = [];
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

    if (action === 'createChapter') {
      const name = cleanName(body.name, 'Chapter name');
      const subjectId = String(body.subjectId || '');
      if (!subjectId) throw Object.assign(new Error('Choose a subject before adding a chapter.'), { status: 400 });
      const organizationId = resolvedScope(ctx, body.organizationId);

      await ensureParentVisible(ctx, 'subjects', subjectId, organizationId);
      const duplicate = await duplicateName(ctx, 'chapters', name, organizationId, 'subject_id', subjectId);
      if (duplicate) return NextResponse.json({ item: duplicate, duplicate: true }, { headers: { 'Cache-Control': 'no-store' } });

      const { data, error } = await ctx.admin
        .from('chapters')
        .insert({ name, subject_id: subjectId, organization_id: organizationId, is_active: true })
        .select('id,name,subject_id,organization_id')
        .single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ item: data, duplicate: false }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (action === 'createTopic') {
      const name = cleanName(body.name, 'Topic name');
      const chapterId = String(body.chapterId || '');
      if (!chapterId) throw Object.assign(new Error('Choose a chapter before adding a topic.'), { status: 400 });
      const organizationId = resolvedScope(ctx, body.organizationId);

      await ensureParentVisible(ctx, 'chapters', chapterId, organizationId);
      const duplicate = await duplicateName(ctx, 'topics', name, organizationId, 'chapter_id', chapterId);
      if (duplicate) return NextResponse.json({ item: duplicate, duplicate: true }, { headers: { 'Cache-Control': 'no-store' } });

      const { data, error } = await ctx.admin
        .from('topics')
        .insert({ name, chapter_id: chapterId, organization_id: organizationId, is_active: true })
        .select('id,name,chapter_id,organization_id')
        .single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ item: data, duplicate: false }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (action === 'bulkCreate') {
      const entity = String(body.entity || '');
      const names = Array.isArray(body.names) ? body.names.map((value) => String(value || '').replace(/^\s*\d+[.)-]?\s*/, '').trim()).filter(Boolean) : [];
      if (!['subject','chapter','topic'].includes(entity) || !names.length) throw Object.assign(new Error('Choose what to add and provide at least one name.'), { status: 400 });
      const organizationId = resolvedScope(ctx, body.organizationId);
      const created: unknown[] = [];
      const skipped: string[] = [];
      for (const rawName of names.slice(0, 500)) {
        const name = cleanName(rawName, entity === 'subject' ? 'Subject name' : entity === 'chapter' ? 'Chapter name' : 'Topic name');
        const table = entity === 'subject' ? 'subjects' : entity === 'chapter' ? 'chapters' : 'topics';
        const parentColumn = entity === 'chapter' ? 'subject_id' : entity === 'topic' ? 'chapter_id' : undefined;
        const parentId = entity === 'chapter' ? String(body.subjectId || '') : entity === 'topic' ? String(body.chapterId || '') : undefined;
        if (parentColumn && !parentId) throw Object.assign(new Error(`Choose a ${entity === 'chapter' ? 'subject' : 'chapter'} first.`), { status: 400 });
        if (entity === 'chapter' && parentId) await ensureParentVisible(ctx, 'subjects', parentId, organizationId);
        if (entity === 'topic' && parentId) await ensureParentVisible(ctx, 'chapters', parentId, organizationId);
        const duplicate = await duplicateName(ctx, table, name, organizationId, parentColumn, parentId);
        if (duplicate) { skipped.push(name); continue; }

        if (entity === 'subject') {
          const { data, error } = await ctx.admin
            .from('subjects')
            .insert({ name, code: subjectCode('', name), organization_id: organizationId, is_active: true })
            .select('*')
            .single();
          if (error) throw new Error(error.message);
          created.push(data);
          continue;
        }

        if (entity === 'chapter') {
          const { data, error } = await ctx.admin
            .from('chapters')
            .insert({ name, subject_id: parentId as string, organization_id: organizationId, is_active: true })
            .select('*')
            .single();
          if (error) throw new Error(error.message);
          created.push(data);
          continue;
        }

        const { data, error } = await ctx.admin
          .from('topics')
          .insert({ name, chapter_id: parentId as string, organization_id: organizationId, is_active: true })
          .select('*')
          .single();
        if (error) throw new Error(error.message);
        created.push(data);
      }
      return NextResponse.json({ created, skipped }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (['renameItem', 'moveItems', 'deleteItems', 'restoreItems'].includes(action)) {
      const entity = String(body.entity || '');
      const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : [];
      if (!['subject','chapter','topic'].includes(entity) || !ids.length) throw Object.assign(new Error('Select at least one academic item.'), { status: 400 });
      const table = entity === 'subject' ? 'subjects' : entity === 'chapter' ? 'chapters' : 'topics';
      const organizationId = resolvedScope(ctx, body.organizationId);
      const { data: rows, error: rowsError } = await ctx.admin.from(table).select('id,organization_id').in('id', ids);
      if (rowsError) throw new Error(rowsError.message);
      if ((rows || []).some((row) => row.organization_id !== organizationId)) {
        if (!ctx.superAdmin) throw Object.assign(new Error('Schools can only change their own academic setup. Universal Evidara taxonomy remains read-only.'), { status: 403 });
      }
      if (ctx.superAdmin && (rows || []).some((row) => row.organization_id === null)) {
        const actionMap: Record<string, string> = { renameItem: 'rename', moveItems: 'move', deleteItems: 'delete', restoreItems: 'restore' };
        const { data, error } = await ctx.admin.rpc('bulk_manage_question_taxonomy_v8', {
          p_entity: entity, p_action: actionMap[action], p_ids: ids, p_parent_id: body.parentId ? String(body.parentId) : null,
          p_name: body.name ? String(body.name) : null, p_code: body.code ? String(body.code) : null,
        });
        if (error) throw new Error(error.message);
        return NextResponse.json(data || {}, { headers: { 'Cache-Control': 'no-store' } });
      }
      if (action === 'renameItem') {
        const name = cleanName(body.name, `${entity} name`);
        const patch: Record<string, unknown> = { name };
        if (entity === 'subject' && body.code) patch.code = subjectCode(body.code, name);
        const { error } = await ctx.admin.from(table).update(patch).in('id', ids).eq('organization_id', organizationId);
        if (error) throw new Error(error.message);
      } else if (action === 'deleteItems' || action === 'restoreItems') {
        const { error } = await ctx.admin.from(table).update({ is_active: action === 'restoreItems' }).in('id', ids).eq('organization_id', organizationId);
        if (error) throw new Error(error.message);
      } else if (action === 'moveItems') {
        const parentId = String(body.parentId || '');
        if (!parentId || entity === 'subject') throw Object.assign(new Error('Choose a valid parent for this move.'), { status: 400 });
        if (entity === 'chapter') await ensureParentVisible(ctx, 'subjects', parentId, organizationId);
        if (entity === 'topic') await ensureParentVisible(ctx, 'chapters', parentId, organizationId);
        const patch = entity === 'chapter' ? { subject_id: parentId } : { chapter_id: parentId };
        const { error } = await ctx.admin.from(table).update(patch).in('id', ids).eq('organization_id', organizationId);
        if (error) throw new Error(error.message);
      }
      return NextResponse.json({ ok: true, ids, ...(action === 'deleteItems' ? { archived: ids } : {}), ...(action === 'restoreItems' ? { restored: ids } : {}) }, { headers: { 'Cache-Control': 'no-store' } });
    }

    throw Object.assign(new Error('Unsupported taxonomy action.'), { status: 400 });
  } catch (error) {
    return failure(error);
  }
}
