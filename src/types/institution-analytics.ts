export type InstitutionAnalyticsLevel = 'schools' | 'school' | 'programme' | 'grade' | 'section' | 'class' | 'subject' | 'chapter' | 'student';

export type ScoreBand = {
  label: string;
  min: number;
  max: number;
  students: number;
  percentage: number;
};

export type InstitutionAnalyticsActor = {
  id: string;
  role: 'super_admin' | 'evidara_admin' | 'school_admin' | 'school_teacher';
  platformAdmin: boolean;
  organizationId: string | null;
  allowedSectionIds: string[] | null;
  allowedSubjectLabels: Record<string, string[]> | null;
};

export type InstitutionSchoolRow = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  board: string | null;
  status?: 'pending' | 'active' | 'suspended' | string;
  totalStudents: number;
  totalClasses: number;
  completedTests: number;
  averageTestsPerStudent: number;
  averagePercentage: number | null;
  accuracy: number | null;
  participation: number | null;
  highestPercentage: number | null;
  lowestPercentage: number | null;
  lastTestAt: string | null;
  rank: number;
};

export type InstitutionScopeMetrics = {
  studentCount: number;
  completedTests: number;
  averageTestsPerStudent: number;
  averagePercentage: number | null;
  accuracy: number | null;
  participation: number | null;
  highestPercentage: number | null;
  lowestPercentage: number | null;
  lastTestAt: string | null;
  rank: number;
};

export type InstitutionProgrammeRow = InstitutionScopeMetrics & {
  id: string;
  organizationId: string;
  name: string;
  track: string | null;
};

export type InstitutionGradeRow = InstitutionScopeMetrics & {
  id: string;
  organizationId: string;
  programmeId: string;
  programmeName: string;
  grade: number;
  name: string;
};

export type InstitutionClassRow = {
  id: string;
  organizationId: string;
  academicYear: string;
  grade: number;
  name: string;
  code: string | null;
  studentCount: number;
  completedTests: number;
  averageTestsPerStudent: number;
  averagePercentage: number | null;
  accuracy: number | null;
  participation: number | null;
  highestPercentage: number | null;
  lowestPercentage: number | null;
  lastTestAt: string | null;
  rank: number;
};

export type InstitutionSectionRow = InstitutionClassRow & {
  programmeId: string;
  programmeName: string;
};

export type InstitutionStudentRow = {
  id: string;
  name: string;
  grade: number | null;
  sectionId: string | null;
  sectionName: string | null;
  academicYear: string | null;
  completedTests: number;
  averagePercentage: number | null;
  accuracy: number | null;
  highestPercentage: number | null;
  lowestPercentage: number | null;
  lastTestAt: string | null;
  rank: number;
};

export type InstitutionSubjectRow = {
  id: string;
  name: string;
  studentCount: number;
  responseCount: number;
  completedTests: number;
  averagePercentage: number | null;
  accuracy: number | null;
  highestPercentage: number | null;
  lowestPercentage: number | null;
  averageSeconds: number | null;
  scoreBands: ScoreBand[];
};

export type InstitutionChapterRow = InstitutionSubjectRow & {
  subjectId: string;
  subjectName: string;
};

export type InstitutionTopicRow = InstitutionSubjectRow & {
  subjectId: string;
  subjectName: string;
  chapterId: string;
  chapterName: string;
};

export type InstitutionStudentDetail = {
  student: InstitutionStudentRow;
  subjects: Array<{
    id: string;
    name: string;
    questions: number;
    averagePercentage: number | null;
    accuracy: number | null;
    averageSeconds: number | null;
  }>;
  strengths: string[];
  priorities: string[];
};

export type InstitutionAnalyticsPayload = {
  mode: 'live' | 'demo';
  level: InstitutionAnalyticsLevel;
  actor: InstitutionAnalyticsActor;
  generatedAt: string;
  school?: { id: string; name: string; city: string | null; state: string | null; board: string | null; status?: string | null } | null;
  programme?: InstitutionProgrammeRow | null;
  grade?: InstitutionGradeRow | null;
  section?: InstitutionSectionRow | null;
  class?: InstitutionClassRow | null;
  subject?: InstitutionSubjectRow | null;
  chapter?: InstitutionChapterRow | null;
  schools?: InstitutionSchoolRow[];
  programmes?: InstitutionProgrammeRow[];
  grades?: InstitutionGradeRow[];
  sections?: InstitutionSectionRow[];
  classes?: InstitutionClassRow[];
  students?: InstitutionStudentRow[];
  subjects?: InstitutionSubjectRow[];
  chapters?: InstitutionChapterRow[];
  topics?: InstitutionTopicRow[];
  scoreBands?: ScoreBand[];
  studentDetail?: InstitutionStudentDetail | null;
  evidence: {
    submittedAttempts: number;
    classifiedResponses: number;
    hasLiveEvidence: boolean;
    note?: string;
  };
};
