import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/server/supabaseServer';
import { normalizeEvidaraRole } from '@/lib/roles';

function responseError(error: unknown) {
  const value = error as { message?: string; status?: number };
  return NextResponse.json({ error: value.message || 'Unable to update assessment settings.' }, { status: value.status || 500, headers: { 'Cache-Control': 'no-store' } });
}

function clean(value: unknown, label: string, max = 120) {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  if (text.length < 1) throw Object.assign(new Error(`${label} is required.`), { status: 400 });
  if (text.length > max) throw Object.assign(new Error(`${label} cannot exceed ${max} characters.`), { status: 400 });
  return text;
}

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    const { data: profile, error: profileError } = await auth.admin.from('profiles').select('role').eq('id', auth.user.id).single();
    if (profileError || normalizeEvidaraRole(profile?.role) !== 'super_admin') {
      throw Object.assign(new Error('Only Super Admin can change grades, examinations and paper test types.'), { status: 403 });
    }

    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || '');
    const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : [];

    if (action === 'create') {
      const optionGroup = String(body.optionGroup || '');
      if (!['grade', 'exam_type', 'test_type'].includes(optionGroup)) throw Object.assign(new Error('Choose a valid setting group.'), { status: 400 });
      const label = clean(body.label, 'Label');
      const value = clean(body.value || label, 'Stored value');
      const organizationId = body.organizationId ? String(body.organizationId) : null;
      const { data, error } = await auth.admin.from('assessment_options').insert({
        option_group: optionGroup,
        value,
        label,
        code: String(body.code || '').trim() || null,
        display_order: Number(body.displayOrder || 0),
        organization_id: organizationId,
        is_active: true,
        created_by: auth.user.id,
        updated_by: auth.user.id,
      }).select('*').single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ item: data }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (action === 'update') {
      if (ids.length !== 1) throw Object.assign(new Error('Choose one setting to edit.'), { status: 400 });
      const label = clean(body.label, 'Label');
      const patch: Record<string, unknown> = {
        label,
        code: String(body.code || '').trim() || null,
        display_order: Number(body.displayOrder || 0),
        updated_by: auth.user.id,
        updated_at: new Date().toISOString(),
      };
      if (body.value) patch.value = clean(body.value, 'Stored value');
      const { data, error } = await auth.admin.from('assessment_options').update(patch).eq('id', ids[0]).select('*').single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ item: data }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (action === 'deactivate' || action === 'restore') {
      if (!ids.length) throw Object.assign(new Error('Select at least one setting.'), { status: 400 });
      const { error } = await auth.admin.from('assessment_options').update({ is_active: action === 'restore', updated_by: auth.user.id, updated_at: new Date().toISOString() }).in('id', ids);
      if (error) throw new Error(error.message);
      return NextResponse.json({ updated: ids }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (action === 'delete') {
      if (!ids.length) throw Object.assign(new Error('Select at least one setting.'), { status: 400 });
      const { data: rows, error: rowError } = await auth.admin.from('assessment_options').select('id,option_group,value').in('id', ids);
      if (rowError) throw new Error(rowError.message);
      const referenced: string[] = [];
      const removable: string[] = [];
      for (const row of rows || []) {
        let inUse = false;
        if (row.option_group === 'grade') {
          const [{ count: questionCount }, { count: paperCount }] = await Promise.all([
            auth.admin.from('questions').select('id', { count: 'exact', head: true }).eq('class_level', row.value),
            auth.admin.from('question_papers').select('id', { count: 'exact', head: true }).eq('grade_level', row.value),
          ]);
          inUse = Boolean(questionCount || paperCount);
        } else if (row.option_group === 'exam_type') {
          const [{ count: paperCount }, questionResult] = await Promise.all([
            auth.admin.from('question_papers').select('id', { count: 'exact', head: true }).eq('exam_type', row.value),
            auth.admin.from('questions').select('id').contains('exam_types', [row.value]).limit(1),
          ]);
          inUse = Boolean(paperCount || questionResult.data?.length);
        } else {
          const { count } = await auth.admin.from('question_papers').select('id', { count: 'exact', head: true }).eq('test_type', row.value);
          inUse = Boolean(count);
        }
        (inUse ? referenced : removable).push(row.id);
      }
      if (removable.length) {
        const { error } = await auth.admin.from('assessment_options').delete().in('id', removable);
        if (error) throw new Error(error.message);
      }
      if (referenced.length) {
        const { error } = await auth.admin.from('assessment_options').update({ is_active: false, updated_by: auth.user.id, updated_at: new Date().toISOString() }).in('id', referenced);
        if (error) throw new Error(error.message);
      }
      return NextResponse.json({ deleted: removable, archived: referenced }, { headers: { 'Cache-Control': 'no-store' } });
    }

    throw Object.assign(new Error('Unsupported settings action.'), { status: 400 });
  } catch (error) {
    return responseError(error);
  }
}
