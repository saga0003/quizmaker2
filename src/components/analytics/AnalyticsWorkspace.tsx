'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BookOpenCheck,
  Building2,
  GraduationCap,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';
import { normalizeEvidaraRole } from '@/lib/roles';
import type { AnalyticsScope } from '@/types/analytics';
import { StudentAnalyticsDashboard } from './StudentAnalyticsDashboard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import styles from './analytics.module.css';

function titleForRole(role?: string) {
  if (role === 'school_teacher') return 'My students analytics';
  if (role === 'school_admin') return 'School student analytics';
  if (role === 'evidara_admin' || role === 'super_admin') return 'Schools and student analytics';
  return 'Student analytics';
}

function descriptionForRole(role?: string) {
  if (role === 'school_teacher') return 'Students from the sections assigned to you appear here.';
  if (role === 'school_admin') return 'Filter the school by grade and section, then open any student profile.';
  if (role === 'evidara_admin' || role === 'super_admin') return 'Navigate school → grade → section → student while preserving school data boundaries.';
  return 'Your submitted assessment evidence.';
}

export function AnalyticsWorkspace({ audience }: { audience: 'student' | 'school' | 'admin' }) {
  const { profile } = useAuth();
  const normalizedRole = normalizeEvidaraRole(profile?.role);
  const [scope, setScope] = useState<AnalyticsScope | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState('all');
  const [grade, setGrade] = useState('all');
  const [sectionId, setSectionId] = useState('all');
  const [search, setSearch] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const [loading, setLoading] = useState(audience !== 'student');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [sectionForm, setSectionForm] = useState({
    organizationId: '',
    academicYear: '2026-27',
    grade: '8',
    name: '',
    code: '',
  });
  const [studentAssignment, setStudentAssignment] = useState({ membershipId: '', sectionId: '' });
  const [teacherAssignment, setTeacherAssignment] = useState({ sectionId: '', teacherId: '', subject: 'All subjects' });

  const loadScope = useCallback(async () => {
    if (!supabase) {
      setError('Connect Supabase and apply migration 35 to load the analytics directory.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const { data, error: loadError } = await supabase.rpc('list_analytics_scope_v10');
    if (loadError) {
      setError(/list_analytics_scope_v10/i.test(loadError.message)
        ? 'Apply Supabase migration 35 to enable sections, teacher assignments and analytics access.'
        : loadError.message);
    } else {
      const next = data as AnalyticsScope;
      setScope(next);
      const firstOrg = next.organizations[0]?.id || '';
      setOrganizationId((current) => current === 'all' && next.viewer_role !== 'super_admin' && next.viewer_role !== 'evidara_admin'
        ? firstOrg || 'all'
        : current);
      setSectionForm((current) => ({ ...current, organizationId: current.organizationId || firstOrg }));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (audience !== 'student') void loadScope();
  }, [audience, loadScope]);

  if (audience === 'student') {
    if (!profile?.id) return <div className={styles.emptyState}>Loading your analytics identity…</div>;
    return <StudentAnalyticsDashboard studentId={profile.id} />;
  }

  if (selectedStudent) {
    return <StudentAnalyticsDashboard studentId={selectedStudent} onBack={() => setSelectedStudent(null)} />;
  }

  const viewerRole = scope?.viewer_role || normalizedRole;
  const canManageSections = ['school_admin', 'evidara_admin', 'super_admin'].includes(viewerRole);

  const organizations = scope?.organizations || [];
  const visibleSections = (scope?.sections || []).filter((section) =>
    (organizationId === 'all' || section.organization_id === organizationId)
    && (grade === 'all' || String(section.grade) === grade),
  );
  const visibleStudents = (scope?.students || []).filter((student) =>
    (organizationId === 'all' || student.organization_id === organizationId)
    && (grade === 'all' || String(student.grade) === grade)
    && (sectionId === 'all' || (sectionId === 'unassigned' ? !student.section_id : student.section_id === sectionId))
    && (!search || student.full_name.toLowerCase().includes(search.toLowerCase())),
  );
  const grades = Array.from(new Set((scope?.students || [])
    .filter((student) => organizationId === 'all' || student.organization_id === organizationId)
    .map((student) => student.grade))).sort((a, b) => a - b);

  async function createSection() {
    if (!supabase) return;
    if (!sectionForm.organizationId || !sectionForm.name.trim()) {
      setError('Choose a school and enter a section name.');
      return;
    }
    setBusy('section');
    setError('');
    setMessage('');
    const { error: saveError } = await supabase.rpc('upsert_academic_section_v10', {
      p_section_id: null,
      p_organization_id: sectionForm.organizationId,
      p_academic_year: sectionForm.academicYear,
      p_grade: Number(sectionForm.grade),
      p_name: sectionForm.name,
      p_code: sectionForm.code || null,
      p_is_active: true,
    });
    setBusy('');
    if (saveError) return setError(saveError.message);
    setMessage('Section created.');
    setSectionForm((current) => ({ ...current, name: '', code: '' }));
    await loadScope();
  }

  async function assignStudent() {
    if (!supabase || !studentAssignment.membershipId || !studentAssignment.sectionId) {
      setError('Choose a student and a matching section.');
      return;
    }
    setBusy('student');
    setError('');
    setMessage('');
    const { error: assignError } = await supabase.rpc('assign_student_section_v10', {
      p_membership_id: studentAssignment.membershipId,
      p_section_id: studentAssignment.sectionId,
    });
    setBusy('');
    if (assignError) return setError(assignError.message);
    setMessage('Student section updated.');
    setStudentAssignment({ membershipId: '', sectionId: '' });
    await loadScope();
  }

  async function assignTeacher() {
    if (!supabase || !teacherAssignment.sectionId || !teacherAssignment.teacherId) {
      setError('Choose a section and teacher.');
      return;
    }
    setBusy('teacher');
    setError('');
    setMessage('');
    const { error: assignError } = await supabase.rpc('assign_teacher_section_v10', {
      p_section_id: teacherAssignment.sectionId,
      p_teacher_id: teacherAssignment.teacherId,
      p_subject_label: teacherAssignment.subject || 'All subjects',
    });
    setBusy('');
    if (assignError) return setError(assignError.message);
    setMessage('Teacher assigned to the section.');
    setTeacherAssignment({ sectionId: '', teacherId: '', subject: 'All subjects' });
    await loadScope();
  }

  async function disableAssignment(id: string) {
    if (!supabase) return;
    setBusy(id);
    setError('');
    const { error: updateError } = await supabase.rpc('set_teacher_section_assignment_v10', {
      p_assignment_id: id,
      p_is_active: false,
    });
    setBusy('');
    if (updateError) return setError(updateError.message);
    setMessage('Teacher assignment removed.');
    await loadScope();
  }

  const selectedMembership = (scope?.students || []).find((student) => student.membership_id === studentAssignment.membershipId);
  const matchingSections = (scope?.sections || []).filter((section) =>
    selectedMembership
      ? section.organization_id === selectedMembership.organization_id
        && section.academic_year === selectedMembership.academic_year
        && section.grade === selectedMembership.grade
      : (organizationId === 'all' || section.organization_id === organizationId),
  );

  const directoryStats = [
    { label: 'Visible students', value: visibleStudents.length, icon: Users },
    { label: 'Visible sections', value: visibleSections.length, icon: BookOpenCheck },
    { label: 'Schools', value: organizationId === 'all' ? organizations.length : 1, icon: Building2 },
  ];

  if (loading) {
    return <div className={styles.emptyState}><div><LoaderCircle className="mx-auto mb-3 h-7 w-7 animate-spin" />Loading role-scoped analytics access…</div></div>;
  }

  return (
    <div className={`${styles.workspace} space-y-5`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0E5A5A]">Analytics Phase 1</div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#14232B]">{titleForRole(viewerRole)}</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[#44545C]">{descriptionForRole(viewerRole)}</p>
        </div>
        <div className="flex gap-2">
          {canManageSections && <Button variant="outline" onClick={() => setShowSetup((value) => !value)}><Settings2 className="mr-2 h-4 w-4" />Sections & teachers</Button>}
          <Button variant="outline" onClick={() => void loadScope()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
        </div>
      </div>

      {(error || message) && <div className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-[#B54747]/20 bg-[#FAEEEE] text-[#B54747]' : 'border-[#237A57]/20 bg-[#EAF4EF] text-[#237A57]'}`}>{error || message}</div>}

      {showSetup && canManageSections && (
        <Card className={`${styles.directoryPanel} gap-0`}>
          <CardContent className="p-5">
            <Tabs defaultValue="sections">
              <TabsList className="mb-5"><TabsTrigger value="sections">Create sections</TabsTrigger><TabsTrigger value="students">Assign students</TabsTrigger><TabsTrigger value="teachers">Assign teachers</TabsTrigger></TabsList>
              <TabsContent value="sections">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <div className="space-y-2 xl:col-span-2"><Label>School</Label><Select value={sectionForm.organizationId} onValueChange={(value) => setSectionForm((current) => ({ ...current, organizationId: value }))}><SelectTrigger><SelectValue placeholder="Choose school" /></SelectTrigger><SelectContent>{organizations.map((organization) => <SelectItem key={organization.id} value={organization.id}>{organization.name}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label>Academic year</Label><Input value={sectionForm.academicYear} onChange={(event) => setSectionForm((current) => ({ ...current, academicYear: event.target.value }))} /></div>
                  <div className="space-y-2"><Label>Grade</Label><Select value={sectionForm.grade} onValueChange={(value) => setSectionForm((current) => ({ ...current, grade: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 12 }, (_item, index) => String(index + 1)).map((value) => <SelectItem key={value} value={value}>Grade {value}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label>Section name</Label><Input value={sectionForm.name} onChange={(event) => setSectionForm((current) => ({ ...current, name: event.target.value }))} placeholder="A / Alpha" /></div>
                  <div className="space-y-2"><Label>Optional code</Label><Input value={sectionForm.code} onChange={(event) => setSectionForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="8-A" /></div>
                  <div className="flex items-end"><Button onClick={() => void createSection()} disabled={busy === 'section'} className="bg-[#0E5A5A] hover:bg-[#0A4747]">{busy === 'section' ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Create section</Button></div>
                </div>
              </TabsContent>
              <TabsContent value="students">
                <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
                  <div className="space-y-2"><Label>Student membership</Label><Select value={studentAssignment.membershipId} onValueChange={(value) => setStudentAssignment({ membershipId: value, sectionId: '' })}><SelectTrigger><SelectValue placeholder="Choose student" /></SelectTrigger><SelectContent>{(scope?.students || []).map((student) => <SelectItem key={student.membership_id} value={student.membership_id}>{student.full_name} · Grade {student.grade} · {student.academic_year}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label>Matching section</Label><Select value={studentAssignment.sectionId} onValueChange={(value) => setStudentAssignment((current) => ({ ...current, sectionId: value }))}><SelectTrigger><SelectValue placeholder="Choose section" /></SelectTrigger><SelectContent>{matchingSections.map((section) => <SelectItem key={section.id} value={section.id}>Grade {section.grade} · {section.name} · {section.academic_year}</SelectItem>)}</SelectContent></Select></div>
                  <Button onClick={() => void assignStudent()} disabled={busy === 'student'} className="bg-[#0E5A5A] hover:bg-[#0A4747]">{busy === 'student' ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <GraduationCap className="mr-2 h-4 w-4" />}Assign</Button>
                </div>
              </TabsContent>
              <TabsContent value="teachers">
                <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
                  <div className="space-y-2"><Label>Section</Label><Select value={teacherAssignment.sectionId} onValueChange={(value) => setTeacherAssignment((current) => ({ ...current, sectionId: value }))}><SelectTrigger><SelectValue placeholder="Choose section" /></SelectTrigger><SelectContent>{(scope?.sections || []).map((section) => <SelectItem key={section.id} value={section.id}>Grade {section.grade} · {section.name} · {section.academic_year}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label>Teacher</Label><Select value={teacherAssignment.teacherId} onValueChange={(value) => setTeacherAssignment((current) => ({ ...current, teacherId: value }))}><SelectTrigger><SelectValue placeholder="Choose teacher" /></SelectTrigger><SelectContent>{(scope?.teachers || []).filter((teacher) => !teacherAssignment.sectionId || teacher.organization_id === scope?.sections.find((section) => section.id === teacherAssignment.sectionId)?.organization_id).map((teacher) => <SelectItem key={teacher.teacher_id} value={teacher.teacher_id}>{teacher.full_name}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label>Subject / teaching context</Label><Input value={teacherAssignment.subject} onChange={(event) => setTeacherAssignment((current) => ({ ...current, subject: event.target.value }))} placeholder="Physics / All subjects" /></div>
                  <Button onClick={() => void assignTeacher()} disabled={busy === 'teacher'} className="bg-[#0E5A5A] hover:bg-[#0A4747]">{busy === 'teacher' ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <UserRoundCheck className="mr-2 h-4 w-4" />}Assign</Button>
                </div>
                {!!scope?.teacher_assignments?.filter((assignment) => assignment.is_active).length && <div className="mt-5 grid gap-2 md:grid-cols-2">{scope.teacher_assignments.filter((assignment) => assignment.is_active).map((assignment) => {
                  const section = scope.sections.find((item) => item.id === assignment.section_id);
                  const teacher = scope.teachers.find((item) => item.teacher_id === assignment.teacher_id);
                  return <div key={assignment.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#E7ECEB] p-3"><div><strong className="text-sm text-[#14232B]">{teacher?.full_name || 'Teacher'}</strong><p className="text-xs text-[#6B7980]">Grade {section?.grade} · {section?.name} · {assignment.subject_label}</p></div><Button size="sm" variant="ghost" onClick={() => void disableAssignment(assignment.id)} disabled={busy === assignment.id}>Remove</Button></div>;
                })}</div>}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {directoryStats.map(({ label, value, icon: Icon }) => <Card key={label} className="gap-0 border-[#E7ECEB] shadow-none"><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs font-medium text-[#6B7980]">{label}</p><p className="mt-1 text-2xl font-extrabold text-[#14232B]">{value}</p></div><div className="rounded-xl bg-[#DCE9E7] p-3 text-[#0E5A5A]"><Icon className="h-5 w-5" /></div></CardContent></Card>)}
      </div>

      <Card className={`${styles.directoryPanel} gap-0`}>
        <CardContent className="p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_160px_200px_minmax(240px,1.3fr)]">
            <Select value={organizationId} onValueChange={(value) => { setOrganizationId(value); setGrade('all'); setSectionId('all'); }}>
              <SelectTrigger><SelectValue placeholder="School" /></SelectTrigger>
              <SelectContent>{['evidara_admin', 'super_admin'].includes(viewerRole) && <SelectItem value="all">All schools</SelectItem>}{organizations.map((organization) => <SelectItem key={organization.id} value={organization.id}>{organization.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={grade} onValueChange={(value) => { setGrade(value); setSectionId('all'); }}>
              <SelectTrigger><SelectValue placeholder="Grade" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All grades</SelectItem>{grades.map((item) => <SelectItem key={item} value={String(item)}>Grade {item}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={sectionId} onValueChange={setSectionId}>
              <SelectTrigger><SelectValue placeholder="Section" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All sections</SelectItem><SelectItem value="unassigned">Unassigned</SelectItem>{visibleSections.map((section) => <SelectItem key={section.id} value={section.id}>{section.name} · {section.academic_year}</SelectItem>)}</SelectContent>
            </Select>
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#AEB8BC]" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student name" className="pl-9" /></div>
          </div>
        </CardContent>
      </Card>

      <div className={styles.directoryGrid}>
        <Card className={`${styles.directoryPanel} gap-0`}>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between"><div><h2 className="font-semibold text-[#14232B]">Students</h2><p className="text-xs text-[#6B7980]">{visibleStudents.length} matching profiles</p></div><Users className="h-5 w-5 text-[#0E5A5A]" /></div>
            <div className={`${styles.studentList} space-y-2`}>
              {visibleStudents.map((student) => <button key={student.membership_id} type="button" className={styles.studentButton} onClick={() => setSelectedStudent(student.student_id)}><div className="flex items-start justify-between gap-3"><div><strong className="text-sm text-[#14232B]">{student.full_name}</strong><p className="mt-1 text-xs text-[#6B7980]">Grade {student.grade} · {student.section_name} · {student.academic_year}</p></div><Badge variant="outline">{student.board}</Badge></div></button>)}
              {!visibleStudents.length && <div className="py-12 text-center text-sm text-[#6B7980]">No students are visible in this school, grade and section combination.</div>}
            </div>
          </CardContent>
        </Card>

        <Card className={`${styles.directoryPanel} gap-0`}>
          <CardContent className={styles.emptyState}>
            <div><GraduationCap className="mx-auto mb-3 h-12 w-12 text-[#9FBDBD]" /><h2 className="text-lg font-semibold text-[#14232B]">Choose a student profile</h2><p className="mt-2 max-w-lg text-sm leading-6">Open a student to view the product timeline, percentage, locked product percentile, accuracy, time-management score, subject comparison and evidence-based next step.</p></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
