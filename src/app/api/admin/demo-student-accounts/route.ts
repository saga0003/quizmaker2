import { randomBytes } from 'node:crypto';
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

function securePassword() {
  return `${randomBytes(20).toString('base64url')}aA7!`;
}

async function demoSchool(admin: Awaited<ReturnType<typeof superAdmin>>['admin']) {
  const { data, error } = await admin.from('organizations').select('id,name').eq('is_demo', true).order('created_at').limit(1).maybeSingle();
  if (error || !data) throw new Error(error?.message || 'Evidara Sales Demo School is not configured.');
  return data;
}

async function payload(admin: Awaited<ReturnType<typeof superAdmin>>['admin']) {
  const school = await demoSchool(admin);
  const { data: students, error } = await admin
    .from('sales_demo_students')
    .select('id,student_no,full_name,email,grade,section_code,academic_year,exam_track,status,auth_user_id,last_password_reset_at')
    .eq('organization_id', school.id)
    .order('student_no');
  if (error) throw new Error(error.message);
  const rows = students || [];
  return {
    school,
    stats: {
      total: rows.length,
      provisioned: rows.filter((row) => Boolean(row.auth_user_id)).length,
      pending: rows.filter((row) => !row.auth_user_id).length,
      neet: rows.filter((row) => row.exam_track === 'NEET').length,
      jee: rows.filter((row) => row.exam_track === 'JEE').length,
    },
    students: rows.map((row) => ({ ...row, provisioned: Boolean(row.auth_user_id) })),
  };
}

export async function GET(request: Request) {
  try {
    const auth = await superAdmin(request);
    return NextResponse.json(await payload(auth.admin), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const value = error as { message?: string; status?: number };
    return fail(value.message || 'Unable to load demo student accounts.', value.status || 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await superAdmin(request);
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || '');
    const school = await demoSchool(auth.admin);

    if (action === 'provisionBatch') {
      const requested = Math.max(1, Math.min(50, Number(body.batchSize || 25)));
      const { data: pending, error: pendingError } = await auth.admin
        .from('sales_demo_students')
        .select('id,student_no,full_name,email,grade,section_code,academic_year,exam_track,board,organization_id,auth_user_id')
        .eq('organization_id', school.id)
        .is('auth_user_id', null)
        .order('student_no')
        .limit(requested);
      if (pendingError) return fail(pendingError.message, 500);
      if (!pending?.length) return NextResponse.json({ ok: true, created: 0, mapped: 0, remaining: 0, ...(await payload(auth.admin)) });

      const { data: listed, error: listError } = await auth.admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listError) return fail(listError.message, 500);
      const usersByEmail = new Map((listed.users || []).filter((user) => user.email).map((user) => [user.email!.toLowerCase(), user]));

      const { data: sectionRows } = await auth.admin
        .from('academic_sections')
        .select('id,academic_year,code')
        .eq('organization_id', school.id)
        .eq('is_active', true);
      const sectionMap = new Map((sectionRows || []).map((row) => [`${row.academic_year}:${row.code}`, row.id]));

      let created = 0;
      let mapped = 0;
      const errors: string[] = [];

      for (const student of pending) {
        try {
          const email = String(student.email || '').trim().toLowerCase();
          if (!email) throw new Error(`Student ${student.student_no} has no email.`);
          let user = usersByEmail.get(email) || null;
          if (!user) {
            const result = await auth.admin.auth.admin.createUser({
              email,
              password: securePassword(),
              email_confirm: true,
              user_metadata: {
                full_name: student.full_name,
                evidara_demo: true,
                sales_demo_student_id: student.id,
              },
            });
            if (result.error || !result.data.user) throw new Error(result.error?.message || 'Auth account could not be created.');
            user = result.data.user;
            usersByEmail.set(email, user);
            created += 1;
          } else {
            mapped += 1;
          }

          const profileResult = await auth.admin.from('profiles').upsert({
            id: user.id,
            full_name: student.full_name,
            role: 'student',
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' });
          if (profileResult.error) throw new Error(profileResult.error.message);

          const sectionId = sectionMap.get(`${student.academic_year}:${student.section_code}`) || null;
          const membershipResult = await auth.admin.from('student_school_memberships').upsert({
            organization_id: student.organization_id,
            student_id: user.id,
            academic_year: student.academic_year,
            grade: student.grade,
            section: student.section_code,
            section_id: sectionId,
            board: student.board,
            tracks: [student.exam_track],
            status: 'active',
            updated_at: new Date().toISOString(),
          }, { onConflict: 'organization_id,student_id,academic_year' });
          if (membershipResult.error) throw new Error(membershipResult.error.message);

          const updateResult = await auth.admin.from('sales_demo_students').update({ auth_user_id: user.id }).eq('id', student.id);
          if (updateResult.error) throw new Error(updateResult.error.message);
        } catch (error) {
          errors.push(`#${student.student_no}: ${error instanceof Error ? error.message : 'Provisioning failed'}`);
        }
      }

      const current = await payload(auth.admin);
      return NextResponse.json({ ok: errors.length === 0, created, mapped, errors: errors.slice(0, 10), ...current });
    }

    if (action === 'resetPassword') {
      const demoStudentId = String(body.demoStudentId || '');
      const newPassword = String(body.newPassword || '');
      if (!demoStudentId) return fail('Choose a demo student.');
      if (newPassword.length < 12) return fail('Use a password with at least 12 characters.');
      const { data: student, error } = await auth.admin
        .from('sales_demo_students')
        .select('id,auth_user_id')
        .eq('id', demoStudentId)
        .eq('organization_id', school.id)
        .maybeSingle();
      if (error || !student) return fail(error?.message || 'Demo student was not found.', 404);
      if (!student.auth_user_id) return fail('Provision this student login before resetting the password.', 409);
      const update = await auth.admin.auth.admin.updateUserById(student.auth_user_id, { password: newPassword });
      if (update.error) return fail(update.error.message, 500);
      await auth.admin.from('sales_demo_students').update({ last_password_reset_at: new Date().toISOString() }).eq('id', student.id);
      return NextResponse.json({ ok: true });
    }

    if (action === 'updateEmail') {
      const demoStudentId = String(body.demoStudentId || '');
      const email = String(body.email || '').trim().toLowerCase();
      if (!demoStudentId || !email.includes('@')) return fail('A valid student email is required.');
      const { data: student, error } = await auth.admin
        .from('sales_demo_students')
        .select('id,auth_user_id')
        .eq('id', demoStudentId)
        .eq('organization_id', school.id)
        .maybeSingle();
      if (error || !student) return fail(error?.message || 'Demo student was not found.', 404);
      if (!student.auth_user_id) return fail('Provision this student login before changing its sign-in email.', 409);
      const update = await auth.admin.auth.admin.updateUserById(student.auth_user_id, { email, email_confirm: true });
      if (update.error) return fail(update.error.message, 500);
      await auth.admin.from('sales_demo_students').update({ email }).eq('id', student.id);
      return NextResponse.json({ ok: true });
    }

    return fail('Unsupported demo-account action.');
  } catch (error) {
    const value = error as { message?: string; status?: number };
    return fail(value.message || 'Demo-account action failed.', value.status || 500);
  }
}
