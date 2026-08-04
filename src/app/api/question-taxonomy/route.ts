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
      if (!ctx.superAdmin) throw Object.assign(new Error('Only Super Admin can add universal subjects.'), { status: 403 });
      const name = cleanName(body.name, 'Subject name');
      const code = subjectCode(body.code, name);
      const duplicate = await duplicateName(ctx, 'subjects', name, null);
      if (duplicate) return NextResponse.json({ item: duplicate, duplicate: true }, { headers: { 'Cache-Control': 'no-store' } });

      const { data, error } = await ctx.admin
        .from('subjects')
        .insert({ name, code, organization_id: null, is_active: true })
        .select('id,name,code,organization_id')
        .single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ item: data, duplicate: false }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (action === 'createChapter') {
      const name = cleanName(body.name, 'Chapter name');
      const subjectId = String(body.subjectId || '');
      if (!subjectId) throw Object.assign(new Error('Choose a subject before adding a chapter.'), { status: 400 });
      const organizationId = resolvedScope(ctx, body.organizationId);

      const { data: subject, error: subjectError } = await ctx.admin.from('subjects').select('id').eq('id', subjectId).maybeSingle();
      if (subjectError || !subject) throw Object.assign(new Error('The selected subject does not exist.'), { status: 400 });
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

      const { data: chapter, error: chapterError } = await ctx.admin.from('chapters').select('id').eq('id', chapterId).maybeSingle();
      if (chapterError || !chapter) throw Object.assign(new Error('The selected chapter does not exist.'), { status: 400 });
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


    if (['renameItem', 'moveItems', 'deleteItems', 'restoreItems'].includes(action)) {
      if (!ctx.superAdmin) throw Object.assign(new Error('Only Super Admin can alter or delete academic settings.'), { status: 403 });
      const entity = String(body.entity || '');
      const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : [];
      const actionMap: Record<string, string> = {
        renameItem: 'rename',
        moveItems: 'move',
        deleteItems: 'delete',
        restoreItems: 'restore',
      };
      const { data, error } = await ctx.admin.rpc('bulk_manage_question_taxonomy_v8', {
        p_entity: entity,
        p_action: actionMap[action],
        p_ids: ids,
        p_parent_id: body.parentId ? String(body.parentId) : null,
        p_name: body.name ? String(body.name) : null,
        p_code: body.code ? String(body.code) : null,
      });
      if (error) throw new Error(error.message);
      return NextResponse.json(data || {}, { headers: { 'Cache-Control': 'no-store' } });
    }

    throw Object.assign(new Error('Unsupported taxonomy action.'), { status: 400 });
  } catch (error) {
    return failure(error);
  }
}
