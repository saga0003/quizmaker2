import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/server/supabaseServer';
import { isSuperAdmin } from '@/lib/roles';

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function superAdmin(request: Request) {
  const auth = await authenticateRequest(request);
  const { data: profile } = await auth.admin.from('profiles').select('role').eq('id', auth.user.id).single();
  if (!profile || !isSuperAdmin(profile.role)) throw Object.assign(new Error('Super Admin permission is required.'), { status: 403 });
  return auth;
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'school';
}

async function latestSubscription(admin: Awaited<ReturnType<typeof superAdmin>>['admin'], organizationId: string) {
  const { data } = await admin.from('school_subscriptions').select('id').eq('organization_id', organizationId).order('ends_at', { ascending: false }).limit(1).maybeSingle();
  return data?.id || null;
}

export async function GET(request: Request) {
  try {
    const auth = await superAdmin(request);
    const { data: organizations, error: orgError } = await auth.admin
      .from('organizations')
      .select('id,name,slug,institute_type,board,address_line1,address_line2,city,state,postal_code,contact_name,contact_email,phone,secondary_phone,website,status,is_demo,created_at')
      .order('name');
    if (orgError) return fail(orgError.message, 500);

    const orgIds = (organizations || []).map((row) => row.id);
    const [subscriptionsResult, membershipsResult, questionsResult, papersResult, demoStudentsResult, demoTestsResult, demoAttemptsResult] = await Promise.all([
      orgIds.length ? auth.admin.from('school_subscriptions').select('id,organization_id,plan_name,status,starts_at,ends_at,seat_limit,resource_access,annual_price_per_student_paise,manual_amount_paise,payment_date,payment_method,payment_reference,invoice_reference,payment_notes,payment_status,created_at').in('organization_id', orgIds).order('ends_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
      orgIds.length ? auth.admin.from('student_school_memberships').select('organization_id').in('organization_id', orgIds).eq('status', 'active') : Promise.resolve({ data: [], error: null }),
      orgIds.length ? auth.admin.from('questions').select('organization_id').in('organization_id', orgIds) : Promise.resolve({ data: [], error: null }),
      orgIds.length ? auth.admin.from('question_papers').select('organization_id').in('organization_id', orgIds) : Promise.resolve({ data: [], error: null }),
      orgIds.length ? auth.admin.from('sales_demo_students').select('organization_id').in('organization_id', orgIds).eq('status', 'active') : Promise.resolve({ data: [], error: null }),
      orgIds.length ? auth.admin.from('sales_demo_tests').select('organization_id').in('organization_id', orgIds) : Promise.resolve({ data: [], error: null }),
      orgIds.length ? auth.admin.from('sales_demo_attempts').select('organization_id').in('organization_id', orgIds) : Promise.resolve({ data: [], error: null }),
    ]);

    const subscriptions = subscriptionsResult.data || [];
    const latest = new Map<string, (typeof subscriptions)[number]>();
    for (const row of subscriptions) if (!latest.has(row.organization_id)) latest.set(row.organization_id, row);

    const countBy = (rows: Array<{ organization_id: string | null }>) => {
      const map = new Map<string, number>();
      for (const row of rows) if (row.organization_id) map.set(row.organization_id, (map.get(row.organization_id) || 0) + 1);
      return map;
    };
    const liveStudents = countBy((membershipsResult.data || []) as Array<{ organization_id: string }>);
    const questions = countBy((questionsResult.data || []) as Array<{ organization_id: string | null }>);
    const papers = countBy((papersResult.data || []) as Array<{ organization_id: string | null }>);
    const demoStudents = countBy((demoStudentsResult.data || []) as Array<{ organization_id: string }>);
    const demoTests = countBy((demoTestsResult.data || []) as Array<{ organization_id: string }>);
    const demoAttempts = countBy((demoAttemptsResult.data || []) as Array<{ organization_id: string }>);

    const schools = (organizations || []).map((org) => {
      const sub = latest.get(org.id) || null;
      const isDemo = Boolean(org.is_demo);
      return {
        ...org,
        subscription: sub,
        usage: {
          activeStudents: isDemo ? (demoStudents.get(org.id) || 0) : (liveStudents.get(org.id) || 0),
          questions: questions.get(org.id) || 0,
          papers: isDemo ? (demoTests.get(org.id) || 0) : (papers.get(org.id) || 0),
          attempts: isDemo ? (demoAttempts.get(org.id) || 0) : 0,
        },
      };
    });

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      stats: {
        schools: schools.length,
        activeSchools: schools.filter((row) => row.status === 'active' && row.subscription?.status === 'active').length,
        licensedSeats: schools.reduce((sum, row) => sum + Number(row.subscription?.seat_limit || 0), 0),
        activeStudents: schools.reduce((sum, row) => sum + Number(row.usage.activeStudents || 0), 0),
        manualRevenuePaise: schools.reduce((sum, row) => row.subscription?.payment_status === 'paid' ? sum + Number(row.subscription.manual_amount_paise || 0) : sum, 0),
      },
      schools,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const value = error as { message?: string; status?: number };
    return fail(value.message || 'Unable to load school control.', value.status || 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await superAdmin(request);
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || '');

    if (action === 'create') {
      const school = (body.school || {}) as Record<string, unknown>;
      const subscription = (body.subscription || {}) as Record<string, unknown>;
      const name = String(school.name || '').trim();
      if (!name) return fail('School name is required.');
      let slug = slugify(name);
      const { data: existing } = await auth.admin.from('organizations').select('id').eq('slug', slug).maybeSingle();
      if (existing) slug = `${slug}-${Date.now().toString().slice(-6)}`;
      const { data: created, error: createError } = await auth.admin.from('organizations').insert({
        name,
        slug,
        institute_type: String(school.institute_type || 'School'),
        board: String(school.board || 'Other'),
        address_line1: String(school.address_line1 || '') || null,
        address_line2: String(school.address_line2 || '') || null,
        city: String(school.city || ''),
        state: String(school.state || ''),
        postal_code: String(school.postal_code || '') || null,
        contact_name: String(school.contact_name || '') || null,
        contact_email: String(school.contact_email || '') || null,
        phone: String(school.phone || ''),
        secondary_phone: String(school.secondary_phone || '') || null,
        website: String(school.website || '') || null,
        status: String(school.status || 'active'),
        created_by: auth.user.id,
      }).select('id').single();
      if (createError || !created) return fail(createError?.message || 'School could not be created.', 500);
      const today = new Date().toISOString().slice(0, 10);
      const nextYear = new Date(); nextYear.setFullYear(nextYear.getFullYear() + 1);
      const { error: subError } = await auth.admin.from('school_subscriptions').insert({
        organization_id: created.id,
        plan_name: String(subscription.plan_name || 'Evidara ₹199 Student Licence'),
        status: String(subscription.status || 'active'),
        starts_at: String(subscription.starts_at || today),
        ends_at: String(subscription.ends_at || nextYear.toISOString().slice(0, 10)),
        seat_limit: Math.max(0, Number(subscription.seat_limit || 0)),
        resource_access: String(subscription.resource_access || 'full'),
        annual_price_per_student_paise: Math.max(0, Number(subscription.annual_price_per_student_paise || 19900)),
        manual_amount_paise: subscription.manual_amount_paise == null ? null : Math.max(0, Number(subscription.manual_amount_paise)),
        payment_date: String(subscription.payment_date || '') || null,
        payment_method: String(subscription.payment_method || '') || null,
        payment_reference: String(subscription.payment_reference || '') || null,
        invoice_reference: String(subscription.invoice_reference || '') || null,
        payment_notes: String(subscription.payment_notes || '') || null,
        payment_status: String(subscription.payment_status || 'unpaid'),
        created_by: auth.user.id,
      });
      if (subError) return fail(subError.message, 500);
      return NextResponse.json({ ok: true, organizationId: created.id });
    }

    const organizationId = String(body.organizationId || '');
    if (!organizationId) return fail('School is required.');

    if (action === 'save') {
      const school = (body.school || {}) as Record<string, unknown>;
      const subscription = (body.subscription || {}) as Record<string, unknown>;
      const { error: orgError } = await auth.admin.from('organizations').update({
        name: String(school.name || '').trim(),
        institute_type: String(school.institute_type || 'School'),
        board: String(school.board || 'Other'),
        address_line1: String(school.address_line1 || '') || null,
        address_line2: String(school.address_line2 || '') || null,
        city: String(school.city || ''),
        state: String(school.state || ''),
        postal_code: String(school.postal_code || '') || null,
        contact_name: String(school.contact_name || '') || null,
        contact_email: String(school.contact_email || '') || null,
        phone: String(school.phone || ''),
        secondary_phone: String(school.secondary_phone || '') || null,
        website: String(school.website || '') || null,
        status: String(school.status || 'active'),
      }).eq('id', organizationId);
      if (orgError) return fail(orgError.message, 500);

      const subscriptionId = String(subscription.id || '') || await latestSubscription(auth.admin, organizationId);
      const subPayload = {
        plan_name: String(subscription.plan_name || 'Evidara ₹199 Student Licence'),
        status: String(subscription.status || 'active'),
        starts_at: String(subscription.starts_at || new Date().toISOString().slice(0, 10)),
        ends_at: String(subscription.ends_at || new Date().toISOString().slice(0, 10)),
        seat_limit: Math.max(0, Number(subscription.seat_limit || 0)),
        resource_access: String(subscription.resource_access || 'full'),
        annual_price_per_student_paise: Math.max(0, Number(subscription.annual_price_per_student_paise || 19900)),
        manual_amount_paise: subscription.manual_amount_paise == null || subscription.manual_amount_paise === '' ? null : Math.max(0, Number(subscription.manual_amount_paise)),
        payment_date: String(subscription.payment_date || '') || null,
        payment_method: String(subscription.payment_method || '') || null,
        payment_reference: String(subscription.payment_reference || '') || null,
        invoice_reference: String(subscription.invoice_reference || '') || null,
        payment_notes: String(subscription.payment_notes || '') || null,
        payment_status: String(subscription.payment_status || 'unpaid'),
      };
      const subResult = subscriptionId
        ? await auth.admin.from('school_subscriptions').update(subPayload).eq('id', subscriptionId)
        : await auth.admin.from('school_subscriptions').insert({ ...subPayload, organization_id: organizationId, created_by: auth.user.id });
      if (subResult.error) return fail(subResult.error.message, 500);
      return NextResponse.json({ ok: true });
    }

    if (['suspend', 'activate', 'revoke'].includes(action)) {
      const subId = await latestSubscription(auth.admin, organizationId);
      const organizationStatus = action === 'activate' ? 'active' : 'suspended';
      const subscriptionStatus = action === 'activate' ? 'active' : action === 'revoke' ? 'cancelled' : 'suspended';
      const { error: orgError } = await auth.admin.from('organizations').update({ status: organizationStatus }).eq('id', organizationId);
      if (orgError) return fail(orgError.message, 500);
      if (subId) {
        const { error: subError } = await auth.admin.from('school_subscriptions').update({ status: subscriptionStatus, access_suspended_at: action === 'activate' ? null : new Date().toISOString() }).eq('id', subId);
        if (subError) return fail(subError.message, 500);
      }
      return NextResponse.json({ ok: true });
    }

    return fail('Unsupported school-control action.');
  } catch (error) {
    const value = error as { message?: string; status?: number };
    return fail(value.message || 'School-control action failed.', value.status || 500);
  }
}
