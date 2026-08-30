import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/server/supabaseServer';
import { isPlatformAdmin } from '@/lib/roles';

type DemoStudent = {
  id: string;
  full_name: string;
  email: string | null;
  grade: number;
  section_code: string;
  academic_year: string;
  exam_track: string;
  board: string;
  status: string;
};

type DemoTest = {
  id: string;
  title: string;
  test_type: string;
  exam_type: string;
  subject_name: string | null;
  chapter_name: string | null;
  topic_name: string | null;
  question_count: number;
  maximum_marks: number | string;
  duration_minutes: number;
  conducted_at: string;
};

type DemoAttempt = {
  id: string;
  student_id: string;
  test_id: string;
  percentage: number | string;
  correct_count: number;
  incorrect_count: number;
  unanswered_count: number;
  submitted_at: string;
};

function rounded(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values: number[]) {
  return values.length ? rounded(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

function accuracy(rows: DemoAttempt[]) {
  const correct = rows.reduce((sum, row) => sum + Number(row.correct_count || 0), 0);
  const incorrect = rows.reduce((sum, row) => sum + Number(row.incorrect_count || 0), 0);
  return correct + incorrect ? rounded((correct / (correct + incorrect)) * 100) : 0;
}

function attemptAccuracy(row: DemoAttempt) {
  const correct = Number(row.correct_count || 0);
  const incorrect = Number(row.incorrect_count || 0);
  return correct + incorrect ? rounded((correct / (correct + incorrect)) * 100) : 0;
}

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    const { data: profile, error: profileError } = await auth.admin
      .from('profiles')
      .select('id,role')
      .eq('id', auth.user.id)
      .single();
    if (profileError || !profile) return NextResponse.json({ error: 'Evidara profile not found.' }, { status: 403 });

    const { data: school, error: schoolError } = await auth.admin
      .from('organizations')
      .select('id,name,city,state,board,status,address_line1,address_line2,postal_code,contact_name,contact_email,phone,secondary_phone,website,is_demo')
      .eq('is_demo', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (schoolError || !school) return NextResponse.json({ error: 'Evidara Sales Demo School is not configured.' }, { status: 404 });

    let authorised = isPlatformAdmin(profile.role);
    if (!authorised) {
      const [{ data: member }, { data: studentMember }] = await Promise.all([
        auth.admin.from('organization_members').select('organization_id').eq('user_id', auth.user.id).eq('organization_id', school.id).eq('is_active', true).limit(1).maybeSingle(),
        auth.admin.from('student_school_memberships').select('organization_id').eq('student_id', auth.user.id).eq('organization_id', school.id).eq('status', 'active').limit(1).maybeSingle(),
      ]);
      authorised = Boolean(member || studentMember);
    }
    if (!authorised) return NextResponse.json({ error: 'Sales demo access is restricted to the Evidara Demo School.' }, { status: 403 });

    const [{ data: students, error: studentsError }, { data: tests, error: testsError }, { data: attempts, error: attemptsError }, { data: subscription }] = await Promise.all([
      auth.admin.from('sales_demo_students').select('id,full_name,email,grade,section_code,academic_year,exam_track,board,status').eq('organization_id', school.id).eq('status', 'active').order('student_no'),
      auth.admin.from('sales_demo_tests').select('id,title,test_type,exam_type,subject_name,chapter_name,topic_name,question_count,maximum_marks,duration_minutes,conducted_at').eq('organization_id', school.id).order('conducted_at', { ascending: false }),
      auth.admin.from('sales_demo_attempts').select('id,student_id,test_id,percentage,correct_count,incorrect_count,unanswered_count,submitted_at').eq('organization_id', school.id).order('submitted_at', { ascending: false }),
      auth.admin.from('school_subscriptions').select('id,plan_name,status,starts_at,ends_at,seat_limit,resource_access,annual_price_per_student_paise,manual_amount_paise,payment_date,payment_method,payment_reference,invoice_reference,payment_notes,payment_status').eq('organization_id', school.id).order('ends_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (studentsError || testsError || attemptsError) {
      return NextResponse.json({ error: studentsError?.message || testsError?.message || attemptsError?.message || 'Demo dataset could not be loaded.' }, { status: 500 });
    }

    const studentRows = (students || []) as DemoStudent[];
    const testRows = (tests || []) as DemoTest[];
    const attemptRows = (attempts || []) as DemoAttempt[];
    const attemptsByStudent = new Map<string, DemoAttempt[]>();
    const attemptsByTest = new Map<string, DemoAttempt[]>();
    for (const attempt of attemptRows) {
      attemptsByStudent.set(attempt.student_id, [...(attemptsByStudent.get(attempt.student_id) || []), attempt]);
      attemptsByTest.set(attempt.test_id, [...(attemptsByTest.get(attempt.test_id) || []), attempt]);
    }

    const enrichedStudents = studentRows.map((student) => {
      const rows = attemptsByStudent.get(student.id) || [];
      const percentages = rows.map((row) => Number(row.percentage || 0));
      return {
        id: student.id,
        name: student.full_name,
        email: student.email,
        grade: student.grade,
        section: student.section_code,
        academicYear: student.academic_year,
        track: student.exam_track,
        board: student.board,
        status: student.status,
        completedTests: rows.length,
        averagePercentage: average(percentages),
        accuracy: accuracy(rows),
        highestPercentage: percentages.length ? Math.max(...percentages) : 0,
        lowestPercentage: percentages.length ? Math.min(...percentages) : 0,
        lastTestAt: rows.map((row) => row.submitted_at).sort().at(-1) || null,
      };
    });

    const enrichedTests = testRows.map((test) => {
      const rows = attemptsByTest.get(test.id) || [];
      return {
        id: test.id,
        title: test.title,
        testType: test.test_type,
        examType: test.exam_type,
        subject: test.subject_name,
        chapter: test.chapter_name,
        topic: test.topic_name,
        questionCount: test.question_count,
        maximumMarks: Number(test.maximum_marks || 0),
        durationMinutes: test.duration_minutes,
        conductedAt: test.conducted_at,
        attempts: rows.length,
        participants: new Set(rows.map((row) => row.student_id)).size,
        averagePercentage: average(rows.map((row) => Number(row.percentage || 0))),
        accuracy: accuracy(rows),
      };
    });

    const tracks = ['NEET', 'JEE'].map((track) => {
      const trackStudents = studentRows.filter((student) => student.exam_track === track);
      const ids = new Set(trackStudents.map((student) => student.id));
      const rows = attemptRows.filter((attempt) => ids.has(attempt.student_id));
      return {
        name: track,
        students: trackStudents.length,
        tests: testRows.filter((test) => test.exam_type === track).length,
        attempts: rows.length,
        averagePercentage: average(rows.map((row) => Number(row.percentage || 0))),
        accuracy: accuracy(rows),
      };
    });

    const subjectNames = [...new Set(testRows.map((row) => row.subject_name).filter((value): value is string => Boolean(value)))];
    const subjects = subjectNames.map((name) => {
      const subjectTests = testRows.filter((row) => row.subject_name === name);
      const testIds = new Set(subjectTests.map((row) => row.id));
      const rows = attemptRows.filter((row) => testIds.has(row.test_id));
      const chapters = [...new Set(subjectTests.map((row) => row.chapter_name).filter((value): value is string => Boolean(value)))].map((chapterName) => {
        const chapterTests = subjectTests.filter((row) => row.chapter_name === chapterName);
        const chapterIds = new Set(chapterTests.map((row) => row.id));
        const chapterAttempts = attemptRows.filter((row) => chapterIds.has(row.test_id));
        const topics = [...new Set(chapterTests.map((row) => row.topic_name).filter((value): value is string => Boolean(value)))].map((topicName) => {
          const topicTests = chapterTests.filter((row) => row.topic_name === topicName);
          const topicIds = new Set(topicTests.map((row) => row.id));
          const topicAttempts = attemptRows.filter((row) => topicIds.has(row.test_id));
          return { name: topicName, tests: topicTests.length, attempts: topicAttempts.length, averagePercentage: average(topicAttempts.map((row) => Number(row.percentage || 0))), accuracy: accuracy(topicAttempts) };
        });
        return { name: chapterName, tests: chapterTests.length, attempts: chapterAttempts.length, averagePercentage: average(chapterAttempts.map((row) => Number(row.percentage || 0))), accuracy: accuracy(chapterAttempts), topics };
      });
      return { name, tests: subjectTests.length, attempts: rows.length, averagePercentage: average(rows.map((row) => Number(row.percentage || 0))), accuracy: accuracy(rows), chapters };
    });

    const questionInstances = testRows.reduce((sum, row) => sum + Number(row.question_count || 0), 0);
    const includeResults = new URL(request.url).searchParams.get('includeResults') === '1';
    const results = includeResults ? attemptRows.map((row) => ({
      studentId: row.student_id,
      testId: row.test_id,
      percentage: Number(row.percentage || 0),
      accuracy: attemptAccuracy(row),
      submittedAt: row.submitted_at,
    })) : undefined;

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      school,
      subscription,
      stats: {
        students: studentRows.length,
        neetStudents: studentRows.filter((row) => row.exam_track === 'NEET').length,
        jeeStudents: studentRows.filter((row) => row.exam_track === 'JEE').length,
        tests: testRows.length,
        attempts: attemptRows.length,
        questionInstances,
        averagePercentage: average(attemptRows.map((row) => Number(row.percentage || 0))),
        accuracy: accuracy(attemptRows),
      },
      tracks,
      subjects,
      students: enrichedStudents,
      tests: enrichedTests,
      ...(includeResults ? { results } : {}),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load sales demo data.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
