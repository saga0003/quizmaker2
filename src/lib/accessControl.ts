import {
  canAccessEvidaraWorkspace,
  evidaraWorkspaceHome,
  isSchoolStaff,
  type EvidaraWorkspace,
} from "@/lib/roles";

export type { EvidaraWorkspace } from "@/lib/roles";

export const SCHOOL_ROLES = [
  "school_admin",
  "school_teacher",
  "institute_owner",
  "institute_admin",
  "school_owner",
  "teacher",
  "reviewer",
  "invigilator",
] as const;

export function isSchoolRole(role?: string | null) {
  return isSchoolStaff(role);
}

export function canAccessWorkspace(role: string | null | undefined, workspace: EvidaraWorkspace) {
  return canAccessEvidaraWorkspace(role, workspace);
}

export function workspaceHome(role?: string | null) {
  return evidaraWorkspaceHome(role);
}

export const protectedRouteSmokeCases: Array<{
  id: string;
  role: string;
  workspace: EvidaraWorkspace;
  expected: boolean;
  route: string;
}> = [
  { id: "admin-super-admin", role: "super_admin", workspace: "admin", expected: true, route: "/admin/" },
  { id: "admin-evidara-admin", role: "evidara_admin", workspace: "admin", expected: true, route: "/admin/" },
  { id: "admin-school-admin", role: "school_admin", workspace: "admin", expected: false, route: "/admin/" },
  { id: "admin-student", role: "student", workspace: "admin", expected: false, route: "/admin/" },
  { id: "school-super-admin", role: "super_admin", workspace: "school", expected: true, route: "/school/" },
  { id: "school-evidara-admin", role: "evidara_admin", workspace: "school", expected: true, route: "/school/" },
  { id: "school-school-admin", role: "school_admin", workspace: "school", expected: true, route: "/school/" },
  { id: "school-school-teacher", role: "school_teacher", workspace: "school", expected: true, route: "/school/" },
  { id: "school-student", role: "student", workspace: "school", expected: false, route: "/school/" },
  { id: "student-student", role: "student", workspace: "student", expected: true, route: "/student/" },
  { id: "student-school-teacher", role: "school_teacher", workspace: "student", expected: true, route: "/student/" },
  { id: "student-school-admin", role: "school_admin", workspace: "student", expected: true, route: "/student/" },
  { id: "student-evidara-admin", role: "evidara_admin", workspace: "student", expected: true, route: "/student/" },
  { id: "student-super-admin", role: "super_admin", workspace: "student", expected: true, route: "/student/" },
];
