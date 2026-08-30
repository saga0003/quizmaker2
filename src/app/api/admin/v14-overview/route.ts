import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/server/supabaseServer';
import { isPlatformAdmin, isSuperAdmin, normalizeEvidaraRole } from '@/lib/roles';

function fail(error: unknown, status = 500) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load V14 platform data.' }, { status, headers: { 'Cache-Control': 'no-store' } }); }

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    const { data: profile } = await auth.admin.from('profiles').select('role').eq('id', auth.user.id).single();
    const role = normalizeEvidaraRole(profile?.role); if (!isPlatformAdmin(role)) return fail(new Error('Platform administrator permission is required.'), 403);
    const url = new URL(request.url); const mode = url.searchParams.get('mode') || 'institutions'; const id = url.searchParams.get('id');

    if (mode === 'resources') {
      const [{ data: resources, error: resourceError }, { data: folders, error: folderError }, { data: organizations, error: orgError }] = await Promise.all([
        auth.admin.from('academic_resources').select('id,title,resource_scope,organization_id,folder_id,size_bytes,mime_type,file_name,subject,grade_min,grade_max,is_active').eq('is_active', true),
        auth.admin.from('resource_folders').select('id,resource_scope,organization_id,parent_id,name,class_level,subject,chapter,created_at'),
        auth.admin.from('organizations').select('id,name,city,state,status').order('name'),
      ]);
      if (resourceError || folderError || orgError) throw new Error(resourceError?.message || folderError?.message || orgError?.message || 'Resource inventory unavailable.');
      const orgMap = new Map((organizations || []).map((o) => [o.id, o]));
      const byOrg = new Map<string, { id: string; name: string; city: string; files: number; bytes: number; folders: number }>();
      for (const org of organizations || []) byOrg.set(org.id, { id: org.id, name: org.name, city: [org.city, org.state].filter(Boolean).join(', '), files: 0, bytes: 0, folders: 0 });
      let platformFiles = 0; let platformBytes = 0; let platformFolders = 0;
      for (const r of resources || []) { if (r.resource_scope === 'platform' || !r.organization_id) { platformFiles += 1; platformBytes += Number(r.size_bytes || 0); } else { const row = byOrg.get(r.organization_id); if (row) { row.files += 1; row.bytes += Number(r.size_bytes || 0); } } }
      for (const f of folders || []) { if (f.resource_scope === 'platform' || !f.organization_id) platformFolders += 1; else { const row = byOrg.get(f.organization_id); if (row) row.folders += 1; } }
      const scopeId = id || null;
      const scopedResources = (resources || []).filter((r) => scopeId ? r.organization_id === scopeId : r.resource_scope === 'platform' || !r.organization_id);
      const scopedFolders = (folders || []).filter((f) => scopeId ? f.organization_id === scopeId : f.resource_scope === 'platform' || !f.organization_id);
      return NextResponse.json({ role, platform: { files: platformFiles, bytes: platformBytes, folders: platformFolders }, schools: [...byOrg.values()], selected: scopeId ? orgMap.get(scopeId) || null : null, resources: scopedResources, folders: scopedFolders }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (id) {
      const [{ data: organization, error: orgError }, { data: subscription }, { data: students }, { data: staff }, { data: resources }, { data: orders }] = await Promise.all([
        auth.admin.from('organizations').select('*').eq('id', id).single(),
        auth.admin.from('school_subscriptions').select('*').eq('organization_id', id).order('ends_at', { ascending: false }).limit(1).maybeSingle(),
        auth.admin.from('student_school_memberships').select('id,student_id,grade,section,academic_year,status').eq('organization_id', id),
        auth.admin.from('organization_members').select('id,user_id,member_role,is_active').eq('organization_id', id),
        auth.admin.from('academic_resources').select('id,size_bytes').eq('organization_id', id).eq('is_active', true),
        auth.admin.from('orders').select('id,amount_paise,status,payment_source,offline_reference,paid_at,created_at,product_id').eq('organization_id', id).order('created_at', { ascending: false }).limit(100),
      ]);
      if (orgError || !organization) return fail(new Error(orgError?.message || 'Institution not found.'), 404);
      return NextResponse.json({ role, organization, subscription, students: students || [], staff: staff || [], resourceStats: { files: resources?.length || 0, bytes: (resources || []).reduce((a, r) => a + Number(r.size_bytes || 0), 0) }, payments: (orders || []).filter((o) => o.status === 'paid') }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const [{ data: organizations, error: orgError }, { data: subscriptions }, { data: students }, { data: staff }, { data: resources }] = await Promise.all([
      auth.admin.from('organizations').select('id,name,city,state,status,board,created_at').order('name'),
      auth.admin.from('school_subscriptions').select('organization_id,plan_name,status,starts_at,ends_at,seat_limit,updated_at').order('ends_at', { ascending: false }),
      auth.admin.from('student_school_memberships').select('organization_id,status'),
      auth.admin.from('organization_members').select('organization_id,is_active,member_role'),
      auth.admin.from('academic_resources').select('organization_id,size_bytes').not('organization_id', 'is', null).eq('is_active', true),
    ]);
    if (orgError) throw new Error(orgError.message);
    const latestSub = new Map<string, Record<string, unknown>>(); for (const s of subscriptions || []) if (!latestSub.has(s.organization_id)) latestSub.set(s.organization_id, s);
    const rows = (organizations || []).map((o) => ({
      ...o, subscription: latestSub.get(o.id) || null,
      students: (students || []).filter((s) => s.organization_id === o.id && s.status === 'active').length,
      staff: (staff || []).filter((s) => s.organization_id === o.id && s.is_active).length,
      files: (resources || []).filter((r) => r.organization_id === o.id).length,
      bytes: (resources || []).filter((r) => r.organization_id === o.id).reduce((a, r) => a + Number(r.size_bytes || 0), 0),
    }));
    return NextResponse.json({ role, superAdmin: isSuperAdmin(role), institutions: rows }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return fail(error); }
}
