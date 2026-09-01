from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'missing patch anchor: {label}')
    return text.replace(old, new, 1)

# ---------------- API ----------------
path = Path('src/app/api/institution-analytics/route.ts')
api = path.read_text()
api = replace_once(api,
"  InstitutionChapterRow,\n  InstitutionClassRow,\n  InstitutionSchoolRow,",
"  InstitutionChapterRow,\n  InstitutionClassRow,\n  InstitutionGradeRow,\n  InstitutionProgrammeRow,\n  InstitutionSchoolRow,\n  InstitutionSectionRow,",
'api imports')
api = replace_once(api,
"  section_id: string | null;\n  status: string;",
"  section_id: string | null;\n  tracks: string[] | null;\n  status: string;",
'membership tracks type')
api = api.replace("academic_year,grade,section,section_id,status", "academic_year,grade,section,section_id,tracks,status")

student_metrics_end = """function studentMetrics(studentId: string, attempts: AttemptRow[]) {
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
"""
helpers = student_metrics_end + """

const UNASSIGNED_PROGRAMME = '__unassigned__';

function programmeIds(membership: MembershipRow) {
  const tracks = (membership.tracks || []).map((track) => String(track || '').trim()).filter(Boolean);
  return tracks.length ? [...new Set(tracks)] : [UNASSIGNED_PROGRAMME];
}

function programmeLabel(programmeId: string) {
  return programmeId === UNASSIGNED_PROGRAMME ? 'Unassigned programme' : programmeId;
}

function membershipsForProgramme(memberships: MembershipRow[], programmeId: string) {
  return memberships.filter((membership) => programmeIds(membership).includes(programmeId));
}

function scopeMetrics(memberships: MembershipRow[], attempts: AttemptRow[]) {
  const studentIds = new Set(memberships.map((row) => row.student_id));
  const rows = attempts.filter((attempt) => studentIds.has(attempt.student_id));
  const percentages = rows.map((row) => number(row.percentage));
  const correct = rows.reduce((sum, row) => sum + number(row.correct_count), 0);
  const incorrect = rows.reduce((sum, row) => sum + number(row.incorrect_count), 0);
  const participants = new Set(rows.map((row) => row.student_id)).size;
  return {
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
}

function rankScopeRows<T extends { averagePercentage: number | null; rank: number }>(rows: T[]) {
  return [...rows]
    .sort((a, b) => (b.averagePercentage ?? -1) - (a.averagePercentage ?? -1))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}
"""
api = replace_once(api, student_metrics_end, helpers, 'scope helpers')

# school payload: include programmes alongside legacy classes.
anchor = """  const classes: InstitutionClassRow[] = sections.map((section) => {
"""
if anchor not in api:
    raise SystemExit('missing patch anchor: classes construction')
# Insert programme construction after classes map block, immediately before return.
return_anchor = """  return {
    mode: 'live',
    level: 'school',
    actor: ctx.actor,
    generatedAt: new Date().toISOString(),
    school,
    classes,
"""
programmes_code = """  const programmeKeys = [...new Set(permittedMemberships.flatMap(programmeIds))].sort((a, b) => programmeLabel(a).localeCompare(programmeLabel(b)));
  const programmes = rankScopeRows<InstitutionProgrammeRow>(programmeKeys.map((programmeId) => ({
    id: programmeId,
    organizationId,
    name: programmeLabel(programmeId),
    track: programmeId === UNASSIGNED_PROGRAMME ? null : programmeId,
    ...scopeMetrics(membershipsForProgramme(permittedMemberships, programmeId), attempts),
  })));

  return {
    mode: 'live',
    level: 'school',
    actor: ctx.actor,
    generatedAt: new Date().toISOString(),
    school,
    programmes,
    classes,
"""
api = replace_once(api, return_anchor, programmes_code, 'school programme payload')
api = api.replace("return { mode: 'live', level: 'school', actor: ctx.actor, generatedAt: new Date().toISOString(), school, classes: [], evidence:", "return { mode: 'live', level: 'school', actor: ctx.actor, generatedAt: new Date().toISOString(), school, programmes: [], classes: [], evidence:")

# Insert programme and grade snapshots before classStudents.
class_students_anchor = "async function classStudents(ctx: CloudContext, section: SectionRow): Promise<{ memberships: MembershipRow[]; students: InstitutionStudentRow[]; attempts: AttemptRow[]; profiles: Map<string, string> }> {"
new_snapshots = """async function programmeSnapshot(ctx: CloudContext, organizationId: string, programmeId: string): Promise<InstitutionAnalyticsPayload> {
  const schoolPayload = await schoolClasses(ctx, organizationId);
  const programme = (schoolPayload.programmes || []).find((row) => row.id === programmeId) || null;
  if (!programme) throw Object.assign(new Error('Programme not found in the active school roster.'), { status: 404 });
  const memberships = await membershipsForOrganization(ctx, organizationId);
  const permitted = ctx.actor.allowedSectionIds
    ? memberships.filter((row) => row.section_id && ctx.actor.allowedSectionIds?.includes(row.section_id))
    : memberships;
  const scoped = membershipsForProgramme(permitted, programmeId);
  const attempts = await attemptsForStudents(ctx, [...new Set(scoped.map((row) => row.student_id))], organizationId);
  const grades = rankScopeRows<InstitutionGradeRow>([...new Set(scoped.map((row) => row.grade))].sort((a, b) => a - b).map((grade) => ({
    id: `${programmeId}:${grade}`,
    organizationId,
    programmeId,
    programmeName: programme.name,
    grade,
    name: `Grade ${grade}`,
    ...scopeMetrics(scoped.filter((row) => row.grade === grade), attempts),
  })));
  return {
    mode: 'live', level: 'programme', actor: ctx.actor, generatedAt: new Date().toISOString(),
    school: schoolPayload.school, programme, grades,
    evidence: { submittedAttempts: attempts.length, classifiedResponses: 0, hasLiveEvidence: attempts.length > 0,
      note: attempts.length ? undefined : 'Live programme roster loaded. Results will appear after students submit assessments.' },
  };
}

async function gradeSnapshot(ctx: CloudContext, organizationId: string, programmeId: string, grade: number): Promise<InstitutionAnalyticsPayload> {
  const programmePayload = await programmeSnapshot(ctx, organizationId, programmeId);
  const gradeRow = (programmePayload.grades || []).find((row) => row.grade === grade) || null;
  if (!gradeRow) throw Object.assign(new Error('Grade not found in the selected programme.'), { status: 404 });
  const memberships = membershipsForProgramme(await membershipsForOrganization(ctx, organizationId), programmeId).filter((row) => row.grade === grade);
  const permitted = ctx.actor.allowedSectionIds
    ? memberships.filter((row) => row.section_id && ctx.actor.allowedSectionIds?.includes(row.section_id))
    : memberships;
  const attempts = await attemptsForStudents(ctx, [...new Set(permitted.map((row) => row.student_id))], organizationId);
  let query = ctx.admin.from('academic_sections')
    .select('id,organization_id,academic_year,grade,name,code')
    .eq('organization_id', organizationId).eq('grade', grade).eq('is_active', true).order('name');
  if (ctx.actor.allowedSectionIds) query = query.in('id', ctx.actor.allowedSectionIds);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const sections = rankScopeRows<InstitutionSectionRow>(((data || []) as SectionRow[])
    .filter((section) => permitted.some((row) => row.section_id === section.id))
    .map((section) => ({
      id: section.id, organizationId, academicYear: section.academic_year, grade: section.grade,
      name: section.name, code: section.code, programmeId, programmeName: programmeLabel(programmeId),
      ...scopeMetrics(permitted.filter((row) => row.section_id === section.id), attempts),
    })));
  return {
    mode: 'live', level: 'grade', actor: ctx.actor, generatedAt: new Date().toISOString(),
    school: programmePayload.school, programme: programmePayload.programme, grade: gradeRow, sections,
    evidence: { submittedAttempts: attempts.length, classifiedResponses: 0, hasLiveEvidence: attempts.length > 0,
      note: attempts.length ? undefined : 'Live grade and section roster loaded. Results will appear after students submit assessments.' },
  };
}

async function classStudents(ctx: CloudContext, section: SectionRow, programmeId?: string | null): Promise<{ memberships: MembershipRow[]; students: InstitutionStudentRow[]; attempts: AttemptRow[]; profiles: Map<string, string> }> {"""
api = replace_once(api, class_students_anchor, new_snapshots, 'programme grade snapshots')

# Filter class memberships by programme after load.
api = replace_once(api,
"""  const memberships = await paged<MembershipRow>((from, to) => ctx.admin
    .from('student_school_memberships')
    .select('organization_id,student_id,academic_year,grade,section,section_id,tracks,status')
    .eq('section_id', section.id)
    .eq('status', 'active')
    .range(from, to) as unknown as PromiseLike<{ data: MembershipRow[] | null; error: { message: string } | null }>);
  const studentIds = [...new Set(memberships.map((row) => row.student_id))];
""",
"""  const allMemberships = await paged<MembershipRow>((from, to) => ctx.admin
    .from('student_school_memberships')
    .select('organization_id,student_id,academic_year,grade,section,section_id,tracks,status')
    .eq('section_id', section.id)
    .eq('status', 'active')
    .range(from, to) as unknown as PromiseLike<{ data: MembershipRow[] | null; error: { message: string } | null }>);
  const memberships = programmeId ? membershipsForProgramme(allMemberships, programmeId) : allMemberships;
  const studentIds = [...new Set(memberships.map((row) => row.student_id))];
""",
'class programme filter')

# Add section row helper before classSnapshot.
class_snapshot_anchor = "async function classSnapshot(ctx: CloudContext, sectionId: string): Promise<InstitutionAnalyticsPayload> {"
section_helper = """function sectionRowFromEvidence(section: SectionRow, students: InstitutionStudentRow[], attempts: AttemptRow[], programmeId: string): InstitutionSectionRow {
  return { ...classRowFromEvidence(section, students, attempts), programmeId, programmeName: programmeLabel(programmeId), name: section.name };
}

async function classSnapshot(ctx: CloudContext, sectionId: string, programmeId?: string | null, outputLevel: 'section' | 'class' = 'section'): Promise<InstitutionAnalyticsPayload> {"""
api = replace_once(api, class_snapshot_anchor, section_helper, 'section snapshot signature')
api = replace_once(api, "  const { students, attempts } = await classStudents(ctx, section);", "  const { students, attempts } = await classStudents(ctx, section, programmeId);", 'class filtered students')
api = replace_once(api,
"""    mode: 'live',
    level: 'class', actor: ctx.actor, generatedAt: new Date().toISOString(), school,
    class: classRowFromEvidence(section, students, attempts), students, subjects,
""",
"""    mode: 'live',
    level: outputLevel, actor: ctx.actor, generatedAt: new Date().toISOString(), school,
    section: programmeId ? sectionRowFromEvidence(section, students, attempts, programmeId) : undefined,
    class: classRowFromEvidence(section, students, attempts), students, subjects,
""",
'class section payload')

# Scope downstream snapshots by programme and surface section context.
api = replace_once(api, "async function subjectSnapshot(ctx: CloudContext, sectionId: string, subjectId: string): Promise<InstitutionAnalyticsPayload> {", "async function subjectSnapshot(ctx: CloudContext, sectionId: string, subjectId: string, programmeId?: string | null): Promise<InstitutionAnalyticsPayload> {", 'subject signature')
api = replace_once(api, "  const { students, attempts } = await classStudents(ctx, section);", "  const { students, attempts } = await classStudents(ctx, section, programmeId);", 'subject filtered students')
api = replace_once(api, "    class: classRowFromEvidence(section, students, attempts), subject, chapters,", "    section: programmeId ? sectionRowFromEvidence(section, students, attempts, programmeId) : undefined,\n    class: classRowFromEvidence(section, students, attempts), subject, chapters,", 'subject section context')

api = replace_once(api, "async function chapterSnapshot(ctx: CloudContext, sectionId: string, subjectId: string, chapterId: string): Promise<InstitutionAnalyticsPayload> {", "async function chapterSnapshot(ctx: CloudContext, sectionId: string, subjectId: string, chapterId: string, programmeId?: string | null): Promise<InstitutionAnalyticsPayload> {", 'chapter signature')
api = replace_once(api, "  const { students, attempts } = await classStudents(ctx, section);", "  const { students, attempts } = await classStudents(ctx, section, programmeId);", 'chapter filtered students')
api = replace_once(api, "    class: classRowFromEvidence(section, students, attempts), subject, chapter, topics,", "    section: programmeId ? sectionRowFromEvidence(section, students, attempts, programmeId) : undefined,\n    class: classRowFromEvidence(section, students, attempts), subject, chapter, topics,", 'chapter section context')

# Topic snapshot: explicit topic level, then scoped students can drill into individual evidence.
student_snapshot_anchor = "async function studentSnapshot(ctx: CloudContext, studentId: string, sectionId: string): Promise<InstitutionAnalyticsPayload> {"
topic_snapshot = """async function topicSnapshot(ctx: CloudContext, sectionId: string, subjectId: string, chapterId: string, topicId: string, programmeId?: string | null): Promise<InstitutionAnalyticsPayload> {
  const section = await ensureSectionAccess(ctx, sectionId);
  const { students, attempts } = await classStudents(ctx, section, programmeId);
  const responses = await responseEvidence(ctx, attempts.map((row) => row.id));
  const subjects = aggregateTaxonomy<InstitutionSubjectRow>({ responses, attempts, students, level: 'subject' });
  const subject = subjects.find((row) => row.id === subjectId) || null;
  if (subject && !teacherCanOpenSubject(ctx, section.id, subject.name)) throw Object.assign(new Error('This subject is not assigned to the signed-in teacher.'), { status: 403 });
  const chapters = aggregateTaxonomy<InstitutionChapterRow>({ responses, attempts, students, level: 'chapter', subjectId });
  const chapter = chapters.find((row) => row.id === chapterId) || null;
  const topics = aggregateTaxonomy<InstitutionTopicRow>({ responses, attempts, students, level: 'topic', subjectId, chapterId });
  const topic = topics.find((row) => row.id === topicId) || null;
  const { data: school } = await ctx.admin.from('organizations').select('id,name,city,state,board').eq('id', section.organization_id).single();
  return {
    mode: 'live', level: 'topic', actor: ctx.actor, generatedAt: new Date().toISOString(), school,
    section: programmeId ? sectionRowFromEvidence(section, students, attempts, programmeId) : undefined,
    class: classRowFromEvidence(section, students, attempts), subject, chapter, topic, students,
    scoreBands: topic?.scoreBands || [],
    evidence: { submittedAttempts: attempts.length, classifiedResponses: responses.length, hasLiveEvidence: Boolean(topic && responses.length),
      note: topic ? undefined : 'No submitted response evidence is available for this topic yet.' },
  };
}

async function studentSnapshot(ctx: CloudContext, studentId: string, sectionId: string, programmeId?: string | null): Promise<InstitutionAnalyticsPayload> {"""
api = replace_once(api, student_snapshot_anchor, topic_snapshot, 'topic snapshot')
api = replace_once(api, "  const { students, attempts } = await classStudents(ctx, section);", "  const { students, attempts } = await classStudents(ctx, section, programmeId);", 'student filtered students')
api = replace_once(api, "    class: classRowFromEvidence(section, students, attempts),", "    section: programmeId ? sectionRowFromEvidence(section, students, attempts, programmeId) : undefined,\n    class: classRowFromEvidence(section, students, attempts),", 'student section context')

# GET routing.
get_old = """    if (level === 'school') return NextResponse.json(await schoolClasses(ctx, organizationId), { headers: { 'Cache-Control': 'no-store' } });
    const sectionId = params.get('sectionId') || '';
    if (level === 'class') return NextResponse.json(await classSnapshot(ctx, sectionId), { headers: { 'Cache-Control': 'no-store' } });
    const subjectId = params.get('subjectId') || '';
    if (level === 'subject') return NextResponse.json(await subjectSnapshot(ctx, sectionId, subjectId), { headers: { 'Cache-Control': 'no-store' } });
    const chapterId = params.get('chapterId') || '';
    if (level === 'chapter') return NextResponse.json(await chapterSnapshot(ctx, sectionId, subjectId, chapterId), { headers: { 'Cache-Control': 'no-store' } });
    if (level === 'student') return NextResponse.json(await studentSnapshot(ctx, params.get('studentId') || '', sectionId), { headers: { 'Cache-Control': 'no-store' } });
"""
get_new = """    if (level === 'school') return NextResponse.json(await schoolClasses(ctx, organizationId), { headers: { 'Cache-Control': 'no-store' } });
    const programmeId = params.get('programme') || '';
    if (level === 'programme') return NextResponse.json(await programmeSnapshot(ctx, organizationId, programmeId), { headers: { 'Cache-Control': 'no-store' } });
    const requestedGrade = Number(params.get('grade'));
    if (level === 'grade') {
      if (!Number.isInteger(requestedGrade)) throw Object.assign(new Error('Choose a valid grade.'), { status: 400 });
      return NextResponse.json(await gradeSnapshot(ctx, organizationId, programmeId, requestedGrade), { headers: { 'Cache-Control': 'no-store' } });
    }
    const sectionId = params.get('sectionId') || '';
    if (level === 'section') return NextResponse.json(await classSnapshot(ctx, sectionId, programmeId), { headers: { 'Cache-Control': 'no-store' } });
    if (level === 'class') return NextResponse.json(await classSnapshot(ctx, sectionId, programmeId || null, 'class'), { headers: { 'Cache-Control': 'no-store' } });
    const subjectId = params.get('subjectId') || '';
    if (level === 'subject') return NextResponse.json(await subjectSnapshot(ctx, sectionId, subjectId, programmeId || null), { headers: { 'Cache-Control': 'no-store' } });
    const chapterId = params.get('chapterId') || '';
    if (level === 'chapter') return NextResponse.json(await chapterSnapshot(ctx, sectionId, subjectId, chapterId, programmeId || null), { headers: { 'Cache-Control': 'no-store' } });
    const topicId = params.get('topicId') || '';
    if (level === 'topic') return NextResponse.json(await topicSnapshot(ctx, sectionId, subjectId, chapterId, topicId, programmeId || null), { headers: { 'Cache-Control': 'no-store' } });
    if (level === 'student') return NextResponse.json(await studentSnapshot(ctx, params.get('studentId') || '', sectionId, programmeId || null), { headers: { 'Cache-Control': 'no-store' } });
"""
api = replace_once(api, get_old, get_new, 'GET hierarchy routing')
path.write_text(api)

# ---------------- UI ----------------
path = Path('src/components/institution-analytics/institution-analytics-workspace.tsx')
ui = path.read_text()
ui = replace_once(ui,
"  InstitutionChapterRow,\n  InstitutionClassRow,\n  InstitutionSchoolRow,",
"  InstitutionChapterRow,\n  InstitutionClassRow,\n  InstitutionGradeRow,\n  InstitutionProgrammeRow,\n  InstitutionSchoolRow,\n  InstitutionSectionRow,",
'ui imports')
ui = replace_once(ui,
"  organizationId?: string | null;\n  sectionId?: string | null;",
"  organizationId?: string | null;\n  programme?: string | null;\n  grade?: number | null;\n  sectionId?: string | null;",
'trail programme grade')
ui = replace_once(ui,
"    schools: [],\n    classes: [],",
"    schools: [],\n    programmes: [],\n    grades: [],\n    sections: [],\n    classes: [],",
'blank hierarchy arrays')
ui = replace_once(ui,
"  const [organizationId, setOrganizationId] = useState<string | null>(null);\n  const [sectionId, setSectionId] = useState<string | null>(null);",
"  const [organizationId, setOrganizationId] = useState<string | null>(null);\n  const [programme, setProgramme] = useState<string | null>(null);\n  const [grade, setGrade] = useState<number | null>(null);\n  const [sectionId, setSectionId] = useState<string | null>(null);",
'ui hierarchy state')
ui = replace_once(ui,
"    const nextOrganizationId = params?.organizationId ?? organizationId;\n    const nextSectionId = params?.sectionId ?? sectionId;",
"    const nextOrganizationId = params?.organizationId ?? organizationId;\n    const nextProgramme = params?.programme ?? programme;\n    const nextGrade = params?.grade ?? grade;\n    const nextSectionId = params?.sectionId ?? sectionId;",
'load hierarchy params')
ui = replace_once(ui,
"      if (nextOrganizationId) query.set('organizationId', nextOrganizationId);\n      if (nextSectionId) query.set('sectionId', nextSectionId);",
"      if (nextOrganizationId) query.set('organizationId', nextOrganizationId);\n      if (nextProgramme) query.set('programme', nextProgramme);\n      if (nextGrade != null) query.set('grade', String(nextGrade));\n      if (nextSectionId) query.set('sectionId', nextSectionId);",
'query hierarchy params')
ui = replace_once(ui,
"      setOrganizationId(result.school?.id || nextOrganizationId || null);\n      setSectionId(result.class?.id || nextSectionId || null);",
"      setOrganizationId(result.school?.id || nextOrganizationId || null);\n      setProgramme(result.programme?.id || nextProgramme || null);\n      setGrade(result.grade?.grade ?? nextGrade ?? null);\n      setSectionId(result.section?.id || result.class?.id || nextSectionId || null);",
'load response hierarchy')
ui = replace_once(ui,
"  }, [chapterId, mode, organizationId, sectionId, studentId, subjectId]);",
"  }, [chapterId, grade, mode, organizationId, programme, sectionId, studentId, subjectId]);",
'load dependencies')

# Add hierarchy memo rows before classes memo.
classes_memo = """  const classes = useMemo(() => {
"""
hierarchy_memo = """  const programmes = useMemo(() => [...(payload.programmes || [])].sort((a, b) => compare(a[sort.key as keyof InstitutionProgrammeRow], b[sort.key as keyof InstitutionProgrammeRow], sort.direction)), [payload.programmes, sort]);
  const grades = useMemo(() => [...(payload.grades || [])].sort((a, b) => compare(a[sort.key as keyof InstitutionGradeRow], b[sort.key as keyof InstitutionGradeRow], sort.direction)), [payload.grades, sort]);
  const sections = useMemo(() => [...(payload.sections || [])].sort((a, b) => compare(a[sort.key as keyof InstitutionSectionRow], b[sort.key as keyof InstitutionSectionRow], sort.direction)), [payload.sections, sort]);

  const classes = useMemo(() => {
"""
ui = replace_once(ui, classes_memo, hierarchy_memo, 'hierarchy memos')

# Titles and explanatory copy.
title_old = """  const title = level === 'schools' ? 'School performance analytics'
    : level === 'school' ? `${payload.school?.name || 'School'} analytics`
      : level === 'class' ? `${payload.class?.name || 'Class'} performance`
        : level === 'subject' ? `${payload.subject?.name || 'Subject'} chapter analysis`
          : level === 'chapter' ? `${payload.chapter?.name || 'Chapter'} topic analysis`
            : `${payload.studentDetail?.student.name || 'Student'} performance`;
"""
title_new = """  const title = level === 'schools' ? 'School performance analytics'
    : level === 'school' ? `${payload.school?.name || 'School'} programmes`
      : level === 'programme' ? `${payload.programme?.name || 'Programme'} grades`
        : level === 'grade' ? `${payload.grade?.name || 'Grade'} sections`
          : level === 'section' || level === 'class' ? `${payload.section?.name || payload.class?.name || 'Section'} performance`
            : level === 'subject' ? `${payload.subject?.name || 'Subject'} chapter analysis`
              : level === 'chapter' ? `${payload.chapter?.name || 'Chapter'} topic analysis`
                : level === 'topic' ? `${payload.topic?.name || 'Topic'} student evidence`
                  : `${payload.studentDetail?.student.name || 'Student'} performance`;
"""
ui = replace_once(ui, title_old, title_new, 'hierarchy titles')
ui = ui.replace('Drill down from institution to class, subject, chapter, topic and individual student evidence.', 'Drill down from school to programme, grade, section, subject, chapter, topic and individual student evidence.')

render_old = """    {!loading && level === 'schools' && <SchoolsView rows={schools} allRows={payload.schools || []} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} sort={sort} onSort={updateSort} onOpen={(school) => navigate('school', school.name, { organizationId: school.id })} />}
    {!loading && level === 'school' && <ClassesView rows={classes} allRows={payload.classes || []} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} sort={sort} onSort={updateSort} onOpen={(row) => navigate('class', row.name, { organizationId: payload.school?.id, sectionId: row.id })} bulkDownloading={bulkDownloading} onDownloadPdf={() => void downloadSchoolResults('pdf')} onDownloadCsv={() => void downloadSchoolResults('csv')} />}
    {!loading && level === 'class' && payload.class && <ClassView classRow={payload.class} students={students} allStudents={payload.students || []} subjects={payload.subjects || []} bands={payload.scoreBands || []} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} sort={sort} onSort={updateSort} selected={selectedStudents} setSelected={setSelectedStudents} allVisibleSelected={allVisibleSelected} toggleAll={toggleAllStudents} onSubject={(row) => navigate('subject', row.name, { organizationId: payload.school?.id, sectionId: payload.class?.id, subjectId: row.id })} onStudent={(row) => navigate('student', row.name, { organizationId: payload.school?.id, sectionId: payload.class?.id, studentId: row.id })} onDownloadReports={downloadReportCards} onDownloadCsv={downloadCsv} />}
    {!loading && level === 'subject' && payload.subject && <SubjectView subject={payload.subject} chapters={payload.chapters || []} bands={payload.scoreBands || []} onChapter={(row) => navigate('chapter', row.name, { organizationId: payload.school?.id, sectionId: payload.class?.id, subjectId: payload.subject?.id, chapterId: row.id })} />}
    {!loading && level === 'chapter' && payload.chapter && <ChapterView chapter={payload.chapter} topics={payload.topics || []} bands={payload.scoreBands || []} />}
    {!loading && level === 'student' && payload.studentDetail && <StudentView detail={payload.studentDetail} />}
"""
render_new = """    {!loading && level === 'schools' && <SchoolsView rows={schools} allRows={payload.schools || []} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} sort={sort} onSort={updateSort} onOpen={(school) => navigate('school', school.name, { organizationId: school.id })} />}
    {!loading && level === 'school' && <HierarchyScopeView title="Programmes" rows={programmes} empty="No active programmes are assigned to students in this school." onOpen={(row) => navigate('programme', row.name, { organizationId: payload.school?.id, programme: row.id })} />}
    {!loading && level === 'programme' && <HierarchyScopeView title="Grades" rows={grades} empty="No active grades are assigned to this programme." onOpen={(row) => navigate('grade', row.name, { organizationId: payload.school?.id, programme: payload.programme?.id, grade: row.grade })} />}
    {!loading && level === 'grade' && <HierarchyScopeView title="Sections" rows={sections} empty="No active sections are assigned to this grade and programme." onOpen={(row) => navigate('section', row.name, { organizationId: payload.school?.id, programme: payload.programme?.id, grade: payload.grade?.grade, sectionId: row.id })} />}
    {!loading && (level === 'section' || level === 'class') && (payload.section || payload.class) && <ClassView classRow={payload.section || payload.class!} students={students} allStudents={payload.students || []} subjects={payload.subjects || []} bands={payload.scoreBands || []} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} sort={sort} onSort={updateSort} selected={selectedStudents} setSelected={setSelectedStudents} allVisibleSelected={allVisibleSelected} toggleAll={toggleAllStudents} onSubject={(row) => navigate('subject', row.name, { organizationId: payload.school?.id, programme: payload.programme?.id || programme, grade: payload.section?.grade || grade, sectionId: payload.section?.id || payload.class?.id, subjectId: row.id })} onStudent={(row) => navigate('student', row.name, { organizationId: payload.school?.id, programme: payload.programme?.id || programme, grade: payload.section?.grade || grade, sectionId: payload.section?.id || payload.class?.id, studentId: row.id })} onDownloadReports={downloadReportCards} onDownloadCsv={downloadCsv} />}
    {!loading && level === 'subject' && payload.subject && <SubjectView subject={payload.subject} chapters={payload.chapters || []} bands={payload.scoreBands || []} onChapter={(row) => navigate('chapter', row.name, { organizationId: payload.school?.id, programme, grade, sectionId: payload.section?.id || payload.class?.id, subjectId: payload.subject?.id, chapterId: row.id })} />}
    {!loading && level === 'chapter' && payload.chapter && <ChapterView chapter={payload.chapter} topics={payload.topics || []} bands={payload.scoreBands || []} onTopic={(row) => navigate('topic', row.name, { organizationId: payload.school?.id, programme, grade, sectionId: payload.section?.id || payload.class?.id, subjectId: payload.subject?.id, chapterId: payload.chapter?.id, topicId: row.id } as Partial<TrailItem>)} />}
    {!loading && level === 'topic' && payload.topic && <TopicView topic={payload.topic} students={students} onStudent={(row) => navigate('student', row.name, { organizationId: payload.school?.id, programme, grade, sectionId: payload.section?.id || payload.class?.id, subjectId, chapterId, studentId: row.id })} />}
    {!loading && level === 'student' && payload.studentDetail && <StudentView detail={payload.studentDetail} />}
"""
# Trail needs topicId.
ui = replace_once(ui, "  chapterId?: string | null;\n  studentId?: string | null;", "  chapterId?: string | null;\n  topicId?: string | null;\n  studentId?: string | null;", 'trail topic id')
# Add topicId state to load (subjectId/chapter state block).
ui = replace_once(ui, "  const [chapterId, setChapterId] = useState<string | null>(null);\n  const [studentId, setStudentId] = useState<string | null>(null);", "  const [chapterId, setChapterId] = useState<string | null>(null);\n  const [topicId, setTopicId] = useState<string | null>(null);\n  const [studentId, setStudentId] = useState<string | null>(null);", 'topic state')
ui = replace_once(ui, "    const nextChapterId = params?.chapterId ?? chapterId;\n    const nextStudentId = params?.studentId ?? studentId;", "    const nextChapterId = params?.chapterId ?? chapterId;\n    const nextTopicId = params?.topicId ?? topicId;\n    const nextStudentId = params?.studentId ?? studentId;", 'topic load param')
ui = replace_once(ui, "      if (nextChapterId) query.set('chapterId', nextChapterId);\n      if (nextStudentId) query.set('studentId', nextStudentId);", "      if (nextChapterId) query.set('chapterId', nextChapterId);\n      if (nextTopicId) query.set('topicId', nextTopicId);\n      if (nextStudentId) query.set('studentId', nextStudentId);", 'topic query')
ui = replace_once(ui, "      setChapterId(result.chapter?.id || nextChapterId || null);\n      setStudentId(result.studentDetail?.student.id || nextStudentId || null);", "      setChapterId(result.chapter?.id || nextChapterId || null);\n      setTopicId(result.topic?.id || nextTopicId || null);\n      setStudentId(result.studentDetail?.student.id || nextStudentId || null);", 'topic response state')
ui = ui.replace("[chapterId, grade, mode, organizationId, programme, sectionId, studentId, subjectId]", "[chapterId, grade, mode, organizationId, programme, sectionId, studentId, subjectId, topicId]")
ui = replace_once(ui, render_old, render_new, 'hierarchy render')

# Generic programme/grade/section view inserted before legacy ClassesView.
classes_view_anchor = "function ClassesView({ rows, allRows, search, setSearch, filter, setFilter, sort, onSort, onOpen, bulkDownloading, onDownloadPdf, onDownloadCsv }:"
hierarchy_view = """function HierarchyScopeView<T extends InstitutionProgrammeRow | InstitutionGradeRow | InstitutionSectionRow>({ title, rows, empty, onOpen }: { title: string; rows: T[]; empty: string; onOpen: (row: T) => void }) {
  return <section className="institution-section">
    <div className="institution-section-heading"><div><h2>{title}</h2><p>Open a row to continue through the institution hierarchy using live roster and submitted assessment evidence.</p></div><Badge variant="outline">{rows.length} records</Badge></div>
    <Card className="institution-table-card"><Table className="min-w-[960px]"><TableHeader><TableRow><TableHead>Rank</TableHead><TableHead>{title.slice(0, -1)}</TableHead><TableHead>Students</TableHead><TableHead>Tests</TableHead><TableHead>Average</TableHead><TableHead>Accuracy</TableHead><TableHead>Participation</TableHead><TableHead>Last test</TableHead><TableHead className="w-12" /></TableRow></TableHeader><TableBody>{rows.length ? rows.map((row) => <TableRow key={row.id} className="institution-clickable-row" onClick={() => onOpen(row)}><TableCell>{row.rank}</TableCell><TableCell><strong>{row.name}</strong></TableCell><TableCell>{row.studentCount}</TableCell><TableCell>{row.completedTests}</TableCell><TableCell><strong style={{ color: metricTone(row.averagePercentage) }}>{percentage(row.averagePercentage)}</strong></TableCell><TableCell>{percentage(row.accuracy)}</TableCell><TableCell>{percentage(row.participation)}</TableCell><TableCell>{shortDate(row.lastTestAt)}</TableCell><TableCell><ChevronRight /></TableCell></TableRow>) : <TableRow><TableCell colSpan={9}><InstitutionEmptyState title={`No ${title.toLowerCase()} found`} copy={empty} /></TableCell></TableRow>}</TableBody></Table></Card>
  </section>;
}

function ClassesView({ rows, allRows, search, setSearch, filter, setFilter, sort, onSort, onOpen, bulkDownloading, onDownloadPdf, onDownloadCsv }:"""
ui = replace_once(ui, classes_view_anchor, hierarchy_view, 'hierarchy scope view')

# Chapter topics become clickable and TopicView provides final student step.
ui = replace_once(ui,
"function ChapterView({ chapter, topics, bands }: { chapter: InstitutionChapterRow; topics: InstitutionTopicRow[]; bands: ScoreBand[] }) {",
"function ChapterView({ chapter, topics, bands, onTopic }: { chapter: InstitutionChapterRow; topics: InstitutionTopicRow[]; bands: ScoreBand[]; onTopic: (row: InstitutionTopicRow) => void }) {",
'chapter onTopic signature')
ui = replace_once(ui,
"{topics.map((row) => <div key={row.id}><div><strong>{row.name}</strong><small>",
"{topics.map((row) => <div key={row.id} role=\"button\" tabIndex={0} onClick={() => onTopic(row)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onTopic(row); }}><div><strong>{row.name}</strong><small>",
'topic clickability')
student_view_anchor = "function StudentView({ detail }: { detail: NonNullable<InstitutionAnalyticsPayload['studentDetail']> }) {"
topic_view = """function TopicView({ topic, students, onStudent }: { topic: InstitutionTopicRow; students: InstitutionStudentRow[]; onStudent: (row: InstitutionStudentRow) => void }) {
  return <section className="institution-section"><div className="institution-stat-grid"><StatCard icon={Users} label="Students assessed" value={topic.studentCount} /><StatCard icon={BarChart3} label="Topic average" value={percentage(topic.averagePercentage)} tone={metricTone(topic.averagePercentage)} /><StatCard icon={BookOpenCheck} label="Responses" value={topic.responseCount} tone={BLUE} /></div>
    <div className="institution-section-heading"><div><h2>Students</h2><p>Continue to an individual student to inspect their authorised evidence in the selected section context.</p></div></div>
    <Card className="institution-table-card"><Table><TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Tests</TableHead><TableHead>Average</TableHead><TableHead>Accuracy</TableHead><TableHead /></TableRow></TableHeader><TableBody>{students.length ? students.map((row) => <TableRow key={row.id} className="institution-clickable-row" onClick={() => onStudent(row)}><TableCell><strong>{row.name}</strong><small>{row.sectionName}</small></TableCell><TableCell>{row.completedTests}</TableCell><TableCell>{percentage(row.averagePercentage)}</TableCell><TableCell>{percentage(row.accuracy)}</TableCell><TableCell><ChevronRight /></TableCell></TableRow>) : <TableRow><TableCell colSpan={5}><InstitutionEmptyState title="No students in scope" copy="The selected topic has no student roster available in this section." /></TableCell></TableRow>}</TableBody></Table></Card>
  </section>;
}

function StudentView({ detail }: { detail: NonNullable<InstitutionAnalyticsPayload['studentDetail']> }) {"""
ui = replace_once(ui, student_view_anchor, topic_view, 'topic student view')
path.write_text(ui)

# Strengthen F8 acceptance to require the topic route as a first-class step.
path = Path('scripts/f8-institution-drilldown-smoke.mjs')
smoke = path.read_text()
smoke = smoke.replace("['analytics levels expose grade', types.includes(\"'grade'\")],", "['analytics levels expose grade', types.includes(\"'grade'\")],\n  ['analytics levels expose topic', types.includes(\"'topic'\")],")
smoke = smoke.replace("['API accepts section level', api.includes(\"level === 'section'\")],", "['API accepts section level', api.includes(\"level === 'section'\")],\n  ['API accepts topic level', api.includes(\"level === 'topic'\")],")
smoke = smoke.replace("['chapter drilldown remains after subject', ui.includes(\"navigate('chapter'\")],", "['chapter drilldown remains after subject', ui.includes(\"navigate('chapter'\")],\n  ['topic is a first-class drilldown after chapter', ui.includes(\"navigate('topic'\")],")
path.write_text(smoke)

print('F8 drilldown source patch applied')
