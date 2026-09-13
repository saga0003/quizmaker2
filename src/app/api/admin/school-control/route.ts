import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/server/supabaseServer';
import { isSuperAdmin } from '@/lib/roles';

const ORGANIZATION_STATUSES = new Set(['pending', 'active', 'suspended']);
const SUBSCRIPTION_STATUSES = new Set(['trial', 'active', 'expired', 'suspended', 'cancelled']);
const PAYMENT_STATUSES = new Set(['unpaid', 'paid', 'partial', 'waived']);
const RESOURCE_ACCESS = new Set(['full', 'limited']);

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function superAdmin(request: Request) {
  const auth = await authenticateRequest(request);
  const { data: profile } = await auth.admin.from('profiles').select('role').eq('id', auth.user.id).single();
  if (!profile || !isSuperAdmin(profile.role)) throw Object.assign(new Error('Super Admin permission is required.'), { status: 403 });
  return auth;
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
      const subscription = latest.get(org.id) || null;
      const isDemo = Boolean(org.is_demo);
      return {
        ...org,
        subscription,
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
        manualRevenuePaise: schools.reduce((sum, row) => ['paid', 'partial'].includes(String(row.subscription?.payment_status || '')) ? sum + Number(row.subscription?.manual_amount_paise || 0) : sum, 0),
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
      return fail('Legacy institution creation is disabled. Use the guided institution-onboarding workflow.', 410);
    }

    const organizationId = String(body.organizationId || '').trim();
    if (!organizationId) return fail('Institution is required.');

    if (action === 'save') {
      const school = (body.school || {}) as Record<string, unknown>;
      const subscription = (body.subscription || {}) as Record<string, unknown>;
      const name = String(school.name || '').trim();
      const city = String(school.city || '').trim();
      const state = String(school.state || '').trim();
      const organizationStatus = String(school.status || 'active');
      const subscriptionStatus = String(subscription.status || 'active');
      const paymentStatus = String(subscription.payment_status || 'unpaid');
      const resourceAccess = String(subscription.resource_access || 'full');
      const seatLimit = Number(subscription.seat_limit || 0);
      const startsAt = String(subscription.starts_at || '').trim();
      const endsAt = String(subscription.ends_at || '').trim();
      const amountPaise = subscription.manual_amount_paise == null || subscription.manual_amount_paise === '' ? null : Number(subscription.manual_amount_paise);

      if (name.length < 3 || city.length < 2 || state.length < 2) return fail('Institution name, city and state are required.');
      if (!ORGANIZATION_STATUSES.has(organizationStatus)) return fail('Unsupported institution status.');
      if (!SUBSCRIPTION_STATUSES.has(subscriptionStatus)) return fail('Unsupported licence status.');
      if (!PAYMENT_STATUSES.has(paymentStatus)) return fail('Unsupported payment status.');
      if (!RESOURCE_ACCESS.has(resourceAccess)) return fail('Unsupported resource access setting.');
      if (!Number.isInteger(seatLimit) || seatLimit < 1 || seatLimit > 100000) return fail('Licensed students must be between 1 and 100000.');
      if (!startsAt || !endsAt || endsAt <= startsAt) return fail('Licence end date must be after its start date.');
      if (amountPaise != null && (!Number.isFinite(amountPaise) || amountPaise < 0)) return fail('Payment amount must be zero or greater.');
      if (['paid', 'partial'].includes(paymentStatus) && !(Number(amountPaise || 0) > 0)) return fail('A positive payment amount is required for paid or partial status.');

      const { data: existingOrg, error: existingOrgError } = await auth.admin.from('organizations').select('id').eq('id', organizationId).maybeSingle();
      if (existingOrgError) return fail(existingOrgError.message, 500);
      if (!existingOrg) return fail('Institution was not found.', 404);

      const { error: orgError } = await auth.admin.from('organizations').update({
        name,
        institute_type: String(school.institute_type || 'School'),
        board: String(school.board || 'Other'),
        address_line1: String(school.address_line1 || '').trim() || null,
        address_line2: String(school.address_line2 || '').trim() || null,
        city,
        state,
        postal_code: String(school.postal_code || '').trim() || null,
        contact_name: String(school.contact_name || '').trim() || null,
        contact_email: String(school.contact_email || '').trim() || null,
        phone: String(school.phone || '').trim(),
        secondary_phone: String(school.secondary_phone || '').trim() || null,
        website: String(school.website || '').trim() || null,
        status: organizationStatus,
      }).eq('id', organizationId);
      if (orgError) return fail(orgError.message, 500);

      const subscriptionId = String(subscription.id || '').trim() || await latestSubscription(auth.admin, organizationId);
      const subPayload = {
        plan_name: 'Evidara Institution Licence',
        status: subscriptionStatus,
        starts_at: startsAt,
        ends_at: endsAt,
        seat_limit: seatLimit,
        resource_access: resourceAccess,
        annual_price_per_student_paise: 19900,
        manual_amount_paise: amountPaise,
        payment_date: String(subscription.payment_date || '').trim() || null,
        payment_method: String(subscription.payment_method || '').trim() || null,
        payment_reference: String(subscription.payment_reference || '').trim() || null,
        invoice_reference: String(subscription.invoice_reference || '').trim() || null,
        payment_notes: String(subscription.payment_notes || '').trim() || null,
        payment_status: paymentStatus,
      };

      if (subscriptionId) {
        const { data: updated, error: subError } = await auth.admin
          .from('school_subscriptions')
          .update(subPayload)
          .eq('id', subscriptionId)
          .eq('organization_id', organizationId)
          .select('id')
          .maybeSingle();
        if (subError) return fail(subError.message, 500);
        if (!updated) return fail('The selected licence does not belong to this institution.', 409);
      } else {
        const { error: subError } = await auth.admin.from('school_subscriptions').insert({ ...subPayload, organization_id: organizationId, created_by: auth.user.id });
        if (subError) return fail(subError.message, 500);
      }
      return NextResponse.json({ ok: true });
    }

    if (['suspend', 'activate', 'revoke'].includes(action)) {
      const subId = await latestSubscription(auth.admin, organizationId);
      const organizationStatus = action === 'activate' ? 'active' : 'suspended';
      const subscriptionStatus = action === 'activate' ? 'active' : action === 'revoke' ? 'cancelled' : 'suspended';
      const { error: orgError } = await auth.admin.from('organizations').update({ status: organizationStatus }).eq('id', organizationId);
      if (orgError) return fail(orgError.message, 500);
      if (subId) {
        const { error: subError } = await auth.admin.from('school_subscriptions').update({ status: subscriptionStatus, access_suspended_at: action === 'activate' ? null : new Date().toISOString() }).eq('id', subId).eq('organization_id', organizationId);
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
