import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/server/supabaseServer';
import { isPlatformAdmin, normalizeEvidaraRole } from '@/lib/roles';
import type {
  InstitutionAnalyticsActor,
  InstitutionAnalyticsPayload,
  InstitutionChapterRow,
  InstitutionClassRow,
  InstitutionSchoolRow,
  InstitutionStudentRow,
  InstitutionSubjectRow,
  InstitutionTopicRow,
  ScoreBand,
} from '@/types/institution-analytics';

const PAGE_SIZE = 1000;

type CloudContext = Awaited<ReturnType<typeof requestContext>>;
type AttemptRow = {
  id: string;
  paper_id: string;
  student_id: string;
  organization_id: string | null;
  percentage: number | string | null;
  correct_count: number | null;
  incorrect_count: number | null;
  unanswered_count: number | null;
  submitted_at: string | null;
  status: string;
};

type MembershipRow = {
  organization_id: string;
  student_id: string;
  academic_year: string;
  grade: number;
  section: string | null;
  section_id: string | null;
  status: string;
};

type AssignmentRow = {
  section_id: string;
  subject_label: string | null;
};

type SectionRow = {
  id: string;
  organization_id: string;
  academic_year: string;
  grade: number;
  name: string;
  code: string | null;
};

function failure(error: unknown) {
  const value = error as { message?: string; status?: number; details?: unknown };
  return NextResponse.json(
    { error: value.message || 'Unable to load institutional analytics.', details: value.details || null },
    { status: value.status || 500, headers: { 'Cache-Control': 'no-store' } },
  );
}

function number(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function rounded(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));
  return valid.length ? rounded(valid.reduce((sum, value) => sum + value, 0) / valid.length) : null;
}

function scoreBands(values: number[]): ScoreBand[] {
  const labels = Array.from({ length: 10 }, (_, index) => ({
    label: index === 0 ? '0–10%' : index === 9 ? '91–100%' : `${index * 10 + 1}–${index * 10 + 10}%`,
    min: index === 0 ? 0 : index * 10 + 1,
    max: index === 9 ? 100 : index * 10 + 10,
  }));
  const counts = labels.map(() => 0);
  for (const raw of values) {
    const value = Math.max(0, Math.min(100, number(raw)));
    const index = value > 90 ? 9 : Math.min(9, Math.floor(value / 10));
    counts[index] += 1;
  }
  return labels.map((band, index) => ({
    ...band,
    students: counts[index],
    percentage: values.length ? rounded(counts[index] / values.length * 100) : 0,
  }));
}

async function paged<T>(loader: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  for (let page = 0; page < 50; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await loader(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const chunk = data || [];
    rows.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;
  }
  return rows;
}

async function requestContext(request: Request) {
  const auth = await authenticateRequest(request);
  const { data: profile, error: profileError } = await auth.admin
    .from('profiles')
    .select('id,full_name,role')
    .eq('id', auth.user.id)
    .single();
  if (profileError || !profile) throw Object.assign(new Error(profileError?.message || 'Evidara profile not found.'), { status: 403 });

  const role = normalizeEvidaraRole(profile.role);
  if (role === 'student') throw Object.assign(new Error('Institution analytics is available only to authorised staff.'), { status: 403 });
  const platformAdmin = isPlatformAdmin(role);
  const selectedOrganizationId = request.headers.get('x-evidara-organization-id')?.trim() || null;

  let organizationId: string | null = null;
  if (!platformAdmin) {
    const { data: memberships, error: membershipError } = await auth.admin
      .from('organization_members')
      .select('organization_id,member_role,is_active')
      .eq('user_id', auth.user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (membershipError) throw new Error(membershipError.message);
    const activeMemberships = memberships || [];
    if (selectedOrganizationId) {
      const selected = activeMemberships.find((membership) => membership.organization_id === selectedOrganizationId);
      if (!selected) throw Object.assign(new Error('The selected institution is not an active membership for this account.'), { status: 403 });
      organizationId = selected.organization_id;
    } else if (activeMemberships.length > 1) {
      throw Object.assign(new Error('Choose an active institution before opening institution analytics.'), { status: 409 });
    } else {
      organizationId = activeMemberships[0]?.organization_id || null;
    }
  }
  if (!platformAdmin && !organizationId) throw Object.assign(new Error('No active school is linked to this account.'), { status: 403 });

  let allowedSectionIds: string[] | null = null;
  let allowedSubjectLabels: Record<string, string[]> | null = null;
  if (role === 'school_teacher') {
    const { data: assignmentData, error: assignmentError } = await auth.admin
      .from('teacher_section_assignments')
      .select('section_id,subject_label')
      .eq('teacher_id', auth.user.id)
      .eq('is_active', true);
    if (assignmentError) throw new Error(assignmentError.message);
    const assignments = (assignmentData || []) as AssignmentRow[];
    allowedSectionIds = [...new Set(assignments.map((row) => row.section_id))];
    allowedSubjectLabels = {};
    for (const assignment of assignments) {
      const labels = allowedSubjectLabels[assignment.section_id] || [];
      const label = String(assignment.subject_label || 'All subjects').trim();
      if (!labels.includes(label)) labels.push(label);
      allowedSubjectLabels[assignment.section_id] = labels;
    }
  }

  const actor: InstitutionAnalyticsActor = {
    id: auth.user.id,
    role,
    platformAdmin,
    organizationId,
    allowedSectionIds,
    allowedSubjectLabels,
  };
  return { ...auth, actor };
}

function requestedOrganization(ctx: CloudContext, request: Request) {
  const requested = new URL(request.url).searchParams.get('organizationId');
  if (ctx.actor.platformAdmin) return requested;
  if (requested && requested !== ctx.actor.organizationId) {
    throw Object.assign(new Error('You cannot view analytics for another school.'), { status: 403 });
  }
  return ctx.actor.organizationId;
}

function teacherSubjectLabels(ctx: CloudContext, sectionId: string) {
  return ctx.actor.allowedSubjectLabels?.[sectionId] || null;
}

function teacherCanOpenSubject(ctx: CloudContext, sectionId: string, subjectName: string) {
  const labels = teacherSubjectLabels(ctx, sectionId);
  if (!labels) return true;
  const normalized = labels.map((label) => label.trim().toLowerCase());
  return normalized.includes('all subjects') || normalized.includes(subjectName.trim().toLowerCase());
}

function visibleTeacherSubjects<T extends { name: string }>(ctx: CloudContext, sectionId: string, rows: T[]) {
  return rows.filter((row) => teacherCanOpenSubject(ctx, sectionId, row.name));
}

async function ensureSectionAccess(ctx: CloudContext, sectionId: string) {
  if (!sectionId) throw Object.assign(new Error('Choose a class or section.'), { status: 400 });
  if (!isUuid(sectionId)) throw Object.assign(new Error('The selected class link is invalid. Return to the school list and open the class again.'), { status: 400 });
  if (ctx.actor.allowedSectionIds && !ctx.actor.allowedSectionIds.includes(sectionId)) {
    throw Object.assign(new Error('This class is not assigned to the signed-in teacher.'), { status: 403 });
  }
  const { data: section, error } = await ctx.admin
    .from('academic_sections')
    .select('id,organization_id,academic_year,grade,name,code')
    .eq('id', sectionId)
    .single();
  if (error || !section) throw Object.assign(new Error(error?.message || 'Class not found.'), { status: 404 });
  if (!ctx.actor.platformAdmin && section.organization_id !== ctx.actor.organizationId) {
    throw Object.assign(new Error('This class belongs to another school.'), { status: 403 });
  }
  return section as SectionRow;
}

async function membershipsForOrganization(ctx: CloudContext, organizationId: string) {
  return paged<MembershipRow>((from, to) => ctx.admin
    .from('student_school_memberships')
    .select('organization_id,student_id,academic_year,grade,section,section_id,status')
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .range(from, to) as unknown as PromiseLike<{ data: MembershipRow[] | null; error: { message: string } | null }>);
}

async function attemptsForStudents(ctx: CloudContext, studentIds: string[], organizationId?: string | null) {
  if (!studentIds.length) return [] as AttemptRow[];
  const output: AttemptRow[] = [];
  for (let start = 0; start < studentIds.length; start += 200) {
    const ids = studentIds.slice(start, start + 200);
    const rows = await paged<AttemptRow>((from, to) => {
      let query = ctx.admin
        .from('exam_attempts')
        .select('id,paper_id,student_id,organization_id,percentage,correct_count,incorrect_count,unanswered_count,submitted_at,status')
        .in('student_id', ids)
        .eq('status', 'submitted');
      if (organizationId) query = query.eq('organization_id', organizationId);
      return query.range(from, to) as unknown as PromiseLike<{ data: AttemptRow[] | null; error: { message: string } | null }>;
    });
    output.push(...rows);
  }
  return output;
}

function studentMetrics(studentId: string, attempts: AttemptRow[]) {
  const rows = attempts.filter((attempt) => attempt.student_id === studentId);
  const percentages = rows.map((row) => number(row.percentage));
  const correct = rows.reduce((sum, row) => sum + number(row.correct_count), 0);
  const incorrect = rows.reduce((sum, row) => sum + number(row.incorrect_count), 0);
  const unanswered = rows.reduce((sum, row) => sum + number(row.unanswered_count), 0);
  const answered = correct + incorrect;
  return {
    completedTests: rows.length,
    averagePercentage: average(percentages),
    accuracy: answered ? rounded(correct / answered * 100) : null,
    highestPercentage: percentages.length ? Math.max(...percentages) : null,
    lowestPercentage: percentages.length ? Math.min(...percentages) : null,
    lastTestAt: rows.map((row) => row.submitted_at).filter(Boolean).sort().at(-1) || null,
  };
}

async function schoolList(ctx: CloudContext): Promise<InstitutionAnalyticsPayload> {
  let organizationQuery = ctx.admin.from('organizations').select('id,name,city,state,board,status').neq('status', 'suspended').order('name');
  if (!ctx.actor.platformAdmin && ctx.actor.organizationId) organizationQuery = organizationQuery.eq('id', ctx.actor.organizationId);
  const { data: organizations, error: organizationError } = await organizationQuery;
  if (organizationError) throw new Error(organizationError.message);
  const organizationIds = (organizations || []).map((row) => row.id);
  if (!organizationIds.length) return {
    mode: 'live', level: 'schools', actor: ctx.actor, generatedAt: new Date().toISOString(), schools: [],
    evidence: { submittedAttempts: 0, classifiedResponses: 0, hasLiveEvidence: false },
  };

  const memberships = await paged<MembershipRow>((from, to) => ctx.admin
    .from('student_school_memberships')
    .select('organization_id,student_id,academic_year,grade,section,section_id,status')
    .in('organization_id', organizationIds)
    .eq('status', 'active')
    .range(from, to) as unknown as PromiseLike<{ data: MembershipRow[] | null; error: { message: string } | null }>);
  const studentIds = [...new Set(memberships.map((row) => row.student_id))];
  const attempts = await attemptsForStudents(ctx, studentIds);
  const sections = await paged<SectionRow>((from, to) => ctx.admin
    .from('academic_sections')
    .select('id,organization_id,academic_year,grade,name,code')
    .in('organization_id', organizationIds)
    .eq('is_active', true)
    .range(from, to) as unknown as PromiseLike<{ data: SectionRow[] | null; error: { message: string } | null }>);

  const schools: InstitutionSchoolRow[] = (organizations || []).map((organization) => {
    const orgMemberships = memberships.filter((row) => row.organization_id === organization.id);
    const orgStudentIds = new Set(orgMemberships.map((row) => row.student_id));
    const orgAttempts = attempts.filter((row) => row.organization_id ? row.organization_id === organization.id : orgStudentIds.has(row.student_id));
    const percentages = orgAttempts.map((row) => number(row.percentage));
    const correct = orgAttempts.reduce((sum, row) => sum + number(row.correct_count), 0);
    const incorrect = orgAttempts.reduce((sum, row) => sum + number(row.incorrect_count), 0);
    const participants = new Set(orgAttempts.map((row) => row.student_id)).size;
    return {
      id: organization.id,
      name: organization.name,
      city: organization.city,
      state: organization.state,
      board: organization.board,
      status: organization.status,
      totalStudents: orgStudentIds.size,
      totalClasses: sections.filter((row) => row.organization_id === organization.id).length,
      completedTests: orgAttempts.length,
      averageTestsPerStudent: orgStudentIds.size ? rounded(orgAttempts.length / orgStudentIds.size) : 0,
      averagePercentage: average(percentages),
      accuracy: correct + incorrect ? rounded(correct / (correct + incorrect) * 100) : null,
      participation: orgStudentIds.size ? rounded(participants / orgStudentIds.size * 100) : null,
      highestPercentage: percentages.length ? Math.max(...percentages) : null,
      lowestPercentage: percentages.length ? Math.min(...percentages) : null,
      lastTestAt: orgAttempts.map((row) => row.submitted_at).filter(Boolean).sort().at(-1) || null,
      rank: 0,
    };
  }).sort((a, b) => (b.averagePercentage ?? -1) - (a.averagePercentage ?? -1)).map((row, index) => ({ ...row, rank: index + 1 }));

  return {
    mode: 'live',
    level: 'schools',
    actor: ctx.actor,
    generatedAt: new Date().toISOString(),
    schools,
    evidence: {
      submittedAttempts: attempts.length,
      classifiedResponses: 0,
      hasLiveEvidence: attempts.length > 0,
      note: attempts.length ? undefined : 'Live school records loaded. No submitted assessment attempts are available yet.',
    },
  };
}

async function schoolClasses(ctx: CloudContext, organizationId: string): Promise<InstitutionAnalyticsPayload> {
  const { data: school, error: schoolError } = await ctx.admin
    .from('organizations')
    .select('id,name,city,state,board,status')
    .eq('id', organizationId)
    .single();
  if (schoolError || !school) throw Object.assign(new Error(schoolError?.message || 'School not found.'), { status: 404 });
  const memberships = await membershipsForOrganization(ctx, organizationId);
  let sectionQuery = ctx.admin
    .from('academic_sections')
    .select('id,organization_id,academic_year,grade,name,code')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('grade')
    .order('name');
  if (ctx.actor.allowedSectionIds) {
    if (!ctx.actor.allowedSectionIds.length) {
      return { mode: 'live', level: 'school', actor: ctx.actor, generatedAt: new Date().toISOString(), school, classes: [], evidence: { submittedAttempts: 0, classifiedResponses: 0, hasLiveEvidence: false } };
    }
    sectionQuery = sectionQuery.in('id', ctx.actor.allowedSectionIds);
  }
  const { data: sectionData, error: sectionError } = await sectionQuery;
  if (sectionError) throw new Error(sectionError.message);
  const sections = (sectionData || []) as SectionRow[];
  const permittedMemberships = ctx.actor.allowedSectionIds
    ? memberships.filter((row) => row.section_id && ctx.actor.allowedSectionIds?.includes(row.section_id))
    : memberships;
  const attempts = await attemptsForStudents(ctx, [...new Set(permittedMemberships.map((row) => row.student_id))], organizationId);

  const classes: InstitutionClassRow[] = sections.map((section) => {
    const members = permittedMemberships.filter((row) => row.section_id === section.id);
    const studentIds = new Set(members.map((row) => row.student_id));
    const rows = attempts.filter((attempt) => studentIds.has(attempt.student_id));
    const percentages = rows.map((row) => number(row.percentage));
    const correct = rows.reduce((sum, row) => sum + number(row.correct_count), 0);
    const incorrect = rows.reduce((sum, row) => sum + number(row.incorrect_count), 0);
    const participants = new Set(rows.map((row) => row.student_id)).size;
    return {
      id: section.id,
      organizationId,
      academicYear: section.academic_year,
      grade: section.grade,
      name: `Grade ${section.grade} · ${section.name}`,
      code: section.code,
      studentCount: studentIds.size,
      completedTests: rows.length,
      averageTestsPerStudent: studentIds.size ? rounded(rows.length / studentIds.size) : 0,
      averagePercentage: average(percentages),
      accuracy: correct + incorrect ? rounded(correct / (correct + incorrect) * 100) : null,
      participation: studentIds.size ? rounded(participants / studentIds.size * 100) : null,
      highestPercentage: percentages.length ? Math.max(...percentages) : null,
      lowestPercentage: percentages.length ? Math.min(...percentages) : null,
      lastTestAt: rows.map((row) => row.submitted_at).filter(Boolean).sort().at(-1) || null,
      rank: 0,
    };
  }).sort((a, b) => (b.averagePercentage ?? -1) - (a.averagePercentage ?? -1)).map((row, index) => ({ ...row, rank: index + 1 }));

  return {
    mode: 'live',
    level: 'school',
    actor: ctx.actor,
    generatedAt: new Date().toISOString(),
    school,
    classes,
    evidence: {
      submittedAttempts: attempts.length,
      classifiedResponses: 0,
      hasLiveEvidence: attempts.length > 0,
      note: attempts.length ? undefined : 'Live classes and enrolments loaded. Results will appear after students submit assessments.',
    },
  };
}

async function classStudents(ctx: CloudContext, section: SectionRow): Promise<{ memberships: MembershipRow[]; students: InstitutionStudentRow[]; attempts: AttemptRow[]; profiles: Map<string, string> }> {
  const memberships = await paged<MembershipRow>((from, to) => ctx.admin
    .from('student_school_memberships')
    .select('organization_id,student_id,academic_year,grade,section,section_id,status')
    .eq('section_id', section.id)
    .eq('status', 'active')
    .range(from, to) as unknown as PromiseLike<{ data: MembershipRow[] | null; error: { message: string } | null }>);
  const studentIds = [...new Set(memberships.map((row) => row.student_id))];
  const attempts = await attemptsForStudents(ctx, studentIds, section.organization_id);
  const profiles = new Map<string, string>();
  if (studentIds.length) {
    for (let start = 0; start < studentIds.length; start += 200) {
      const { data, error } = await ctx.admin.from('profiles').select('id,full_name').in('id', studentIds.slice(start, start + 200));
      if (error) throw new Error(error.message);
      for (const row of data || []) profiles.set(row.id, row.full_name || 'Student');
    }
  }
  const students = memberships.map((membership) => ({
    id: membership.student_id,
    name: profiles.get(membership.student_id) || 'Student',
    grade: membership.grade,
    sectionId: section.id,
    sectionName: `Grade ${section.grade} · ${section.name}`,
    academicYear: membership.academic_year,
    ...studentMetrics(membership.student_id, attempts),
    rank: 0,
  })).sort((a, b) => (b.averagePercentage ?? -1) - (a.averagePercentage ?? -1)).map((row, index) => ({ ...row, rank: index + 1 }));
  return { memberships, students, attempts, profiles };
}

async function responseEvidence(ctx: CloudContext, attemptIds: string[]) {
  if (!attemptIds.length) return [] as Array<Record<string, unknown>>;
  const output: Array<Record<string, unknown>> = [];
  for (let start = 0; start < attemptIds.length; start += 150) {
    const ids = attemptIds.slice(start, start + 150);
    const rows = await paged<Record<string, unknown>>((from, to) => ctx.admin
      .from('exam_responses')
      .select('attempt_id,is_correct,marks_awarded,time_spent_seconds,paper_questions(marks,question_snapshot,questions(id,subject_id,chapter_id,topic_id,subjects(id,name),chapters(id,name),topics(id,name)))')
      .in('attempt_id', ids)
      .range(from, to) as unknown as PromiseLike<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>);
    output.push(...rows);
  }
  return output;
}

function taxonomyObject(response: Record<string, unknown>) {
  const paperQuestionRaw = response.paper_questions;
  const paperQuestion = Array.isArray(paperQuestionRaw) ? paperQuestionRaw[0] : paperQuestionRaw as Record<string, unknown> | null;
  const questionRaw = paperQuestion?.questions;
  const question = Array.isArray(questionRaw) ? questionRaw[0] : questionRaw as Record<string, unknown> | null;
  const snapshotRaw = paperQuestion?.question_snapshot;
  const snapshot = snapshotRaw && typeof snapshotRaw === 'object' && !Array.isArray(snapshotRaw)
    ? snapshotRaw as Record<string, unknown>
    : null;
  const object = (value: unknown) => Array.isArray(value) ? value[0] as Record<string, unknown> : value as Record<string, unknown> | null;
  const frozenTaxonomy = (idKey: string, nameKey: string, fallback: Record<string, unknown> | null) => {
    const id = snapshot?.[idKey];
    const name = snapshot?.[nameKey];
    if (typeof id === 'string' && id && typeof name === 'string' && name) return { id, name };
    if (typeof id === 'string' && id) return { id, name: typeof name === 'string' && name ? name : String(fallback?.name || id) };
    return fallback;
  };
  return {
    paperQuestion,
    question,
    subject: frozenTaxonomy('subject_id', 'subject_name', object(question?.subjects)),
    chapter: frozenTaxonomy('chapter_id', 'chapter_name', object(question?.chapters)),
    topic: frozenTaxonomy('topic_id', 'topic_name', object(question?.topics)),
  };
}

function aggregateTaxonomy<T extends InstitutionSubjectRow | InstitutionChapterRow | InstitutionTopicRow>(input: {
  responses: Array<Record<string, unknown>>;
  attempts: AttemptRow[];
  students: InstitutionStudentRow[];
  level: 'subject' | 'chapter' | 'topic';
  subjectId?: string | null;
  chapterId?: string | null;
}): T[] {
  const attemptById = new Map(input.attempts.map((row) => [row.id, row]));
  const groups = new Map<string, { id: string; name: string; subjectId?: string; subjectName?: string; chapterId?: string; chapterName?: string; responses: Array<Record<string, unknown>>; students: Set<string> }>();
  for (const response of input.responses) {
    const taxonomy = taxonomyObject(response);
    const node = input.level === 'subject' ? taxonomy.subject : input.level === 'chapter' ? taxonomy.chapter : taxonomy.topic;
    if (!node?.id || !node?.name) continue;
    if (input.subjectId && String(taxonomy.subject?.id || '') !== input.subjectId) continue;
    if (input.chapterId && String(taxonomy.chapter?.id || '') !== input.chapterId) continue;
    const key = String(node.id);
    const group = groups.get(key) || {
      id: key,
      name: String(node.name),
      subjectId: taxonomy.subject?.id ? String(taxonomy.subject.id) : undefined,
      subjectName: taxonomy.subject?.name ? String(taxonomy.subject.name) : undefined,
      chapterId: taxonomy.chapter?.id ? String(taxonomy.chapter.id) : undefined,
      chapterName: taxonomy.chapter?.name ? String(taxonomy.chapter.name) : undefined,
      responses: [],
      students: new Set<string>(),
    };
    group.responses.push(response);
    const attempt = attemptById.get(String(response.attempt_id || ''));
    if (attempt) group.students.add(attempt.student_id);
    groups.set(key, group);
  }

  return [...groups.values()].map((group) => {
    const correct = group.responses.filter((row) => row.is_correct === true).length;
    const answered = group.responses.filter((row) => row.is_correct === true || row.is_correct === false).length;
    const percentagesByStudent = new Map<string, { correct: number; answered: number }>();
    for (const row of group.responses) {
      const attempt = attemptById.get(String(row.attempt_id || ''));
      if (!attempt) continue;
      const current = percentagesByStudent.get(attempt.student_id) || { correct: 0, answered: 0 };
      if (row.is_correct === true || row.is_correct === false) current.answered += 1;
      if (row.is_correct === true) current.correct += 1;
      percentagesByStudent.set(attempt.student_id, current);
    }
    const studentPercentages = [...percentagesByStudent.values()].filter((row) => row.answered).map((row) => rounded(row.correct / row.answered * 100));
    const result: InstitutionSubjectRow = {
      id: group.id,
      name: group.name,
      studentCount: group.students.size,
      responseCount: group.responses.length,
      completedTests: new Set(group.responses.map((row) => String(row.attempt_id || ''))).size,
      averagePercentage: average(studentPercentages),
      accuracy: answered ? rounded(correct / answered * 100) : null,
      highestPercentage: studentPercentages.length ? Math.max(...studentPercentages) : null,
      lowestPercentage: studentPercentages.length ? Math.min(...studentPercentages) : null,
      averageSeconds: average(group.responses.map((row) => number(row.time_spent_seconds))),
      scoreBands: scoreBands(studentPercentages),
    };
    if (input.level === 'chapter') return { ...result, subjectId: group.subjectId || '', subjectName: group.subjectName || 'Subject' } as T;
    if (input.level === 'topic') return { ...result, subjectId: group.subjectId || '', subjectName: group.subjectName || 'Subject', chapterId: group.chapterId || '', chapterName: group.chapterName || 'Chapter' } as T;
    return result as T;
  }).sort((a, b) => (b.averagePercentage ?? -1) - (a.averagePercentage ?? -1));
}

function classRowFromEvidence(section: SectionRow, students: InstitutionStudentRow[], attempts: AttemptRow[]): InstitutionClassRow {
  const percentages = attempts.map((row) => number(row.percentage));
  const correct = attempts.reduce((sum, row) => sum + number(row.correct_count), 0);
  const incorrect = attempts.reduce((sum, row) => sum + number(row.incorrect_count), 0);
  const participants = new Set(attempts.map((row) => row.student_id)).size;
  return {
    id: section.id,
    organizationId: section.organization_id,
    academicYear: section.academic_year,
    grade: section.grade,
    name: `Grade ${section.grade} · ${section.name}`,
    code: section.code,
    studentCount: students.length,
    completedTests: attempts.length,
    averageTestsPerStudent: students.length ? rounded(attempts.length / students.length) : 0,
    averagePercentage: average(percentages),
    accuracy: correct + incorrect ? rounded(correct / (correct + incorrect) * 100) : null,
    participation: students.length ? rounded(participants / students.length * 100) : null,
    highestPercentage: percentages.length ? Math.max(...percentages) : null,
    lowestPercentage: percentages.length ? Math.min(...percentages) : null,
    lastTestAt: attempts.map((row) => row.submitted_at).filter(Boolean).sort().at(-1) || null,
    rank: 1,
  };
}

async function classSnapshot(ctx: CloudContext, sectionId: string): Promise<InstitutionAnalyticsPayload> {
  const section = await ensureSectionAccess(ctx, sectionId);
  const { students, attempts } = await classStudents(ctx, section);
  const responses = await responseEvidence(ctx, attempts.map((row) => row.id));
  const subjects = visibleTeacherSubjects(ctx, section.id, aggregateTaxonomy<InstitutionSubjectRow>({ responses, attempts, students, level: 'subject' }));
  const { data: school } = await ctx.admin.from('organizations').select('id,name,city,state,board').eq('id', section.organization_id).single();
  return {
    mode: 'live',
    level: 'class', actor: ctx.actor, generatedAt: new Date().toISOString(), school,
    class: classRowFromEvidence(section, students, attempts), students, subjects,
    scoreBands: scoreBands(students.map((row) => row.averagePercentage).filter((value): value is number => value !== null)),
    evidence: {
      submittedAttempts: attempts.length,
      classifiedResponses: responses.length,
      hasLiveEvidence: attempts.length > 0 && responses.length > 0,
      note: responses.length ? undefined : 'Live class roster loaded. Subject analytics will appear after submitted responses are available.',
    },
  };
}

async function subjectSnapshot(ctx: CloudContext, sectionId: string, subjectId: string): Promise<InstitutionAnalyticsPayload> {
  const section = await ensureSectionAccess(ctx, sectionId);
  const { students, attempts } = await classStudents(ctx, section);
  const responses = await responseEvidence(ctx, attempts.map((row) => row.id));
  const subjects = aggregateTaxonomy<InstitutionSubjectRow>({ responses, attempts, students, level: 'subject' });
  const subject = subjects.find((row) => row.id === subjectId) || null;
  if (subject && !teacherCanOpenSubject(ctx, section.id, subject.name)) {
    throw Object.assign(new Error('This subject is not assigned to the signed-in teacher.'), { status: 403 });
  }
  const chapters = aggregateTaxonomy<InstitutionChapterRow>({ responses, attempts, students, level: 'chapter', subjectId });
  const { data: school } = await ctx.admin.from('organizations').select('id,name,city,state,board').eq('id', section.organization_id).single();
  return {
    mode: 'live',
    level: 'subject', actor: ctx.actor, generatedAt: new Date().toISOString(), school,
    class: classRowFromEvidence(section, students, attempts), subject, chapters,
    scoreBands: subject?.scoreBands || [],
    evidence: {
      submittedAttempts: attempts.length,
      classifiedResponses: responses.length,
      hasLiveEvidence: Boolean(subject && responses.length),
      note: subject ? undefined : 'No submitted response evidence is available for this subject yet.',
    },
  };
}

async function chapterSnapshot(ctx: CloudContext, sectionId: string, subjectId: string, chapterId: string): Promise<InstitutionAnalyticsPayload> {
  const section = await ensureSectionAccess(ctx, sectionId);
  const { students, attempts } = await classStudents(ctx, section);
  const responses = await responseEvidence(ctx, attempts.map((row) => row.id));
  const subjects = aggregateTaxonomy<InstitutionSubjectRow>({ responses, attempts, students, level: 'subject' });
  const subject = subjects.find((row) => row.id === subjectId) || null;
  if (subject && !teacherCanOpenSubject(ctx, section.id, subject.name)) {
    throw Object.assign(new Error('This subject is not assigned to the signed-in teacher.'), { status: 403 });
  }
  const chapters = aggregateTaxonomy<InstitutionChapterRow>({ responses, attempts, students, level: 'chapter', subjectId });
  const topics = aggregateTaxonomy<InstitutionTopicRow>({ responses, attempts, students, level: 'topic', subjectId, chapterId });
  const chapter = chapters.find((row) => row.id === chapterId) || null;
  const { data: school } = await ctx.admin.from('organizations').select('id,name,city,state,board').eq('id', section.organization_id).single();
  return {
    mode: 'live',
    level: 'chapter', actor: ctx.actor, generatedAt: new Date().toISOString(), school,
    class: classRowFromEvidence(section, students, attempts), subject, chapter, topics,
    scoreBands: chapter?.scoreBands || [],
    evidence: {
      submittedAttempts: attempts.length,
      classifiedResponses: responses.length,
      hasLiveEvidence: Boolean(chapter && responses.length),
      note: chapter ? undefined : 'No submitted response evidence is available for this chapter yet.',
    },
  };
}

async function studentSnapshot(ctx: CloudContext, studentId: string, sectionId: string): Promise<InstitutionAnalyticsPayload> {
  const section = await ensureSectionAccess(ctx, sectionId);
  const { students, attempts } = await classStudents(ctx, section);
  const student = students.find((row) => row.id === studentId);
  if (!student) throw Object.assign(new Error('The selected student is not part of this class.'), { status: 404 });
  const { data: school } = await ctx.admin
    .from('organizations')
    .select('id,name,city,state,board,status')
    .eq('id', section.organization_id)
    .single();
  return {
    mode: 'live',
    level: 'student',
    actor: ctx.actor,
    generatedAt: new Date().toISOString(),
    school,
    class: classRowFromEvidence(section, students, attempts),
    studentDetail: { student, subjects: [], strengths: [], priorities: [] },
    evidence: {
      submittedAttempts: student.completedTests,
      classifiedResponses: 0,
      hasLiveEvidence: student.completedTests > 0,
      note: student.completedTests ? undefined : 'This is the live student profile. Analytics will populate after the student submits an assessment.',
    },
  };
}

export async function GET(request: Request) {
  try {
    const ctx = await requestContext(request);
    const params = new URL(request.url).searchParams;
    const level = params.get('level') || (ctx.actor.platformAdmin ? 'schools' : 'school');
    const organizationId = requestedOrganization(ctx, request);
    if (level === 'schools') return NextResponse.json(await schoolList(ctx), { headers: { 'Cache-Control': 'no-store' } });
    if (!organizationId) throw Object.assign(new Error('Choose a school.'), { status: 400 });
    if (level === 'school') return NextResponse.json(await schoolClasses(ctx, organizationId), { headers: { 'Cache-Control': 'no-store' } });
    const sectionId = params.get('sectionId') || '';
    if (level === 'class') return NextResponse.json(await classSnapshot(ctx, sectionId), { headers: { 'Cache-Control': 'no-store' } });
    const subjectId = params.get('subjectId') || '';
    if (level === 'subject') return NextResponse.json(await subjectSnapshot(ctx, sectionId, subjectId), { headers: { 'Cache-Control': 'no-store' } });
    const chapterId = params.get('chapterId') || '';
    if (level === 'chapter') return NextResponse.json(await chapterSnapshot(ctx, sectionId, subjectId, chapterId), { headers: { 'Cache-Control': 'no-store' } });
    if (level === 'student') return NextResponse.json(await studentSnapshot(ctx, params.get('studentId') || '', sectionId), { headers: { 'Cache-Control': 'no-store' } });
    throw Object.assign(new Error('Unsupported analytics level.'), { status: 400 });
  } catch (error) {
    return failure(error);
  }
}
