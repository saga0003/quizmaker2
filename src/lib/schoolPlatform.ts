export type SchoolBoard = "Karnataka State" | "CBSE" | "ICSE" | "ISC" | "Other";
export type StudentTrack = "Foundation" | "NEET" | "JEE" | "KCET" | "Olympiad" | "Boards";
export type StudentLifecycleStatus = "active" | "revoked" | "completed";
export type SubscriptionStatus = "active" | "trial" | "expired" | "suspended";

export type SchoolSubscription = {
  planName: string;
  status: SubscriptionStatus;
  startsAt: string;
  endsAt: string;
  seatLimit: number;
  resourceAccess: "full" | "limited";
};

export type SchoolStudent = {
  id: string;
  name: string;
  grade: number;
  section: string;
  board: SchoolBoard;
  academicYear: string;
  tracks: StudentTrack[];
  status: StudentLifecycleStatus;
  promotionLocked: boolean;
  revokedAt?: string;
  promotedAt?: string;
  parentName: string;
  parentPhone: string;
};

export type LearningResource = {
  id: string;
  title: string;
  kind: "school_test" | "previous_year_board" | "entrance" | "olympiad" | "foundation";
  accessLabel: "FREE" | "COMPLIMENTARY" | "INCLUDED";
  board?: SchoolBoard;
  gradeMin: number;
  gradeMax: number;
  track?: StudentTrack;
  year?: number;
  subject: string;
  subscriptionRequired: boolean;
  description: string;
};

export type SchoolPlatformState = {
  school: {
    id: string;
    name: string;
    board: SchoolBoard;
    city: string;
    subscription: SchoolSubscription;
  };
  students: SchoolStudent[];
  resources: LearningResource[];
};

const KEY = "scholaros-school-platform-v4";

export const defaultSchoolPlatformState: SchoolPlatformState = {
  school: {
    id: "school-demo-1",
    name: "Green Valley School",
    board: "Karnataka State",
    city: "Chikmagalur",
    subscription: {
      planName: "ScholarOS Annual School Access",
      status: "active",
      startsAt: "2026-06-01",
      endsAt: "2027-05-31",
      seatLimit: 500,
      resourceAccess: "full",
    },
  },
  students: [
    { id: "st-1", name: "Ananya Rao", grade: 10, section: "A", board: "Karnataka State", academicYear: "2026-27", tracks: ["Boards", "NEET"], status: "active", promotionLocked: false, parentName: "Rashmi Rao", parentPhone: "9000000001" },
    { id: "st-2", name: "Arjun M.", grade: 9, section: "A", board: "Karnataka State", academicYear: "2026-27", tracks: ["Foundation", "Olympiad"], status: "active", promotionLocked: false, parentName: "Mahesh M.", parentPhone: "9000000002" },
    { id: "st-3", name: "Sana F.", grade: 12, section: "B", board: "Karnataka State", academicYear: "2026-27", tracks: ["Boards", "JEE", "KCET"], status: "active", promotionLocked: false, parentName: "Fathima S.", parentPhone: "9000000003" },
    { id: "st-4", name: "Kiran P.", grade: 8, section: "A", board: "Karnataka State", academicYear: "2026-27", tracks: ["Foundation", "Olympiad"], status: "active", promotionLocked: false, parentName: "Prakash P.", parentPhone: "9000000004" },
    { id: "st-5", name: "Nidhi S.", grade: 10, section: "A", board: "Karnataka State", academicYear: "2026-27", tracks: ["Boards", "NEET"], status: "revoked", promotionLocked: true, revokedAt: "2026-07-01", parentName: "Shilpa S.", parentPhone: "9000000005" },
  ],
  resources: [
    { id: "r1", title: "School-created chapter and full-length tests", kind: "school_test", accessLabel: "FREE", gradeMin: 8, gradeMax: 12, subject: "All subjects", subscriptionRequired: true, description: "Unlimited school-authored tests with no per-test charge during the active annual plan." },
    { id: "r2", title: "Karnataka SSLC Grade 10 Previous Papers", kind: "previous_year_board", accessLabel: "COMPLIMENTARY", board: "Karnataka State", gradeMin: 10, gradeMax: 10, track: "Boards", year: 2026, subject: "Grade 10 Board", subscriptionRequired: true, description: "Previous-year State Board papers, answer keys and practice copies." },
    { id: "r3", title: "Karnataka 2nd PUC Grade 12 Previous Papers", kind: "previous_year_board", accessLabel: "COMPLIMENTARY", board: "Karnataka State", gradeMin: 12, gradeMax: 12, track: "Boards", year: 2026, subject: "Grade 12 Board", subscriptionRequired: true, description: "Subject-wise PUC board papers for eligible Grade 12 students." },
    { id: "r4", title: "NEET Previous Year Questions", kind: "entrance", accessLabel: "COMPLIMENTARY", gradeMin: 11, gradeMax: 12, track: "NEET", year: 2026, subject: "NEET", subscriptionRequired: true, description: "Chapter-tagged NEET PYQs and timed previous-paper practice." },
    { id: "r5", title: "JEE Main and Advanced Previous Questions", kind: "entrance", accessLabel: "COMPLIMENTARY", gradeMin: 11, gradeMax: 12, track: "JEE", year: 2026, subject: "JEE", subscriptionRequired: true, description: "JEE Main and Advanced resources released according to student eligibility." },
    { id: "r6", title: "KCET Previous Year Questions", kind: "entrance", accessLabel: "COMPLIMENTARY", gradeMin: 11, gradeMax: 12, track: "KCET", year: 2026, subject: "KCET", subscriptionRequired: true, description: "Karnataka CET subject papers for assigned Grade 11 and 12 students." },
    { id: "r7", title: "Grade 8–10 Olympiad Challenge Bank", kind: "olympiad", accessLabel: "INCLUDED", gradeMin: 8, gradeMax: 10, track: "Olympiad", subject: "Olympiad", subscriptionRequired: true, description: "Reasoning and subject Olympiad tests for assigned foundation students." },
    { id: "r8", title: "Grade 8–10 Foundation Practice", kind: "foundation", accessLabel: "INCLUDED", gradeMin: 8, gradeMax: 10, track: "Foundation", subject: "Foundation", subscriptionRequired: true, description: "Concept, application and higher-order practice across Mathematics and Science." },
  ],
};

export function loadSchoolPlatformState(): SchoolPlatformState {
  if (typeof window === "undefined") return defaultSchoolPlatformState;
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "null");
    if (parsed?.school && Array.isArray(parsed.students) && Array.isArray(parsed.resources)) return parsed;
  } catch {}
  localStorage.setItem(KEY, JSON.stringify(defaultSchoolPlatformState));
  return structuredClone(defaultSchoolPlatformState);
}

export function saveSchoolPlatformState(state: SchoolPlatformState) {
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(state));
}

export function subscriptionIsActive(subscription: SchoolSubscription, today = new Date()) {
  const end = new Date(`${subscription.endsAt}T23:59:59`);
  const start = new Date(`${subscription.startsAt}T00:00:00`);
  return subscription.status === "active" && today >= start && today <= end;
}

export function daysUntilExpiry(subscription: SchoolSubscription) {
  const diff = new Date(`${subscription.endsAt}T23:59:59`).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

export function resourceEligibility(resource: LearningResource, student: SchoolStudent, subscription: SchoolSubscription) {
  if (student.status !== "active") return { allowed: false, reason: "Student access has been revoked." };
  if (resource.subscriptionRequired && !subscriptionIsActive(subscription)) return { allowed: false, reason: "Annual school subscription is inactive." };
  if (student.grade < resource.gradeMin || student.grade > resource.gradeMax) return { allowed: false, reason: `Available for Grades ${resource.gradeMin}${resource.gradeMax !== resource.gradeMin ? `–${resource.gradeMax}` : ""}.` };
  if (resource.board && resource.board !== student.board) return { allowed: false, reason: `Available only for ${resource.board} students.` };
  if (resource.track && !student.tracks.includes(resource.track)) return { allowed: false, reason: `${resource.track} must be assigned to this student.` };
  return { allowed: true, reason: "Eligible" };
}

export function nextGrade(grade: number) {
  return grade >= 12 ? 12 : grade + 1;
}

export function promoteStudent(state: SchoolPlatformState, studentId: string, targetYear: string) {
  const students = state.students.map(student => {
    if (student.id !== studentId || student.status !== "active" || student.promotionLocked || student.academicYear === targetYear) return student;
    if (student.grade >= 12) return { ...student, status: "completed" as const, academicYear: targetYear, promotedAt: new Date().toISOString() };
    return { ...student, grade: nextGrade(student.grade), academicYear: targetYear, promotedAt: new Date().toISOString() };
  });
  return { ...state, students };
}

export function promoteAllStudents(state: SchoolPlatformState, targetYear: string) {
  return state.students.reduce((next, student) => promoteStudent(next, student.id, targetYear), state);
}

export function revokeStudent(state: SchoolPlatformState, studentId: string) {
  return {
    ...state,
    students: state.students.map(student => student.id === studentId && student.status === "active"
      ? { ...student, status: "revoked" as const, promotionLocked: true, revokedAt: new Date().toISOString() }
      : student),
  };
}

export function revokeAllStudents(state: SchoolPlatformState) {
  return {
    ...state,
    students: state.students.map(student => student.status === "active"
      ? { ...student, status: "revoked" as const, promotionLocked: true, revokedAt: new Date().toISOString() }
      : student),
  };
}
