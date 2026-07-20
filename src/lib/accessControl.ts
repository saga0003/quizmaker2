export type EvidaraWorkspace = "student" | "school" | "admin";

export const SCHOOL_ROLES = [
  "institute_owner",
  "institute_admin",
  "school_owner",
  "school_admin",
  "teacher",
  "reviewer",
  "invigilator",
] as const;

export function isSchoolRole(role?: string | null) {
  if (!role) return false;
  return role.startsWith("institute_") || role.startsWith("school_") || SCHOOL_ROLES.includes(role as (typeof SCHOOL_ROLES)[number]);
}

export function canAccessWorkspace(role: string | null | undefined, workspace: EvidaraWorkspace) {
  if (!role) return false;
  if (workspace === "admin") return role === "super_admin";
  if (workspace === "school") return isSchoolRole(role);
  return true;
}

export function workspaceHome(role?: string | null) {
  if (role === "super_admin") return "/admin/";
  if (isSchoolRole(role)) return "/school/";
  return "/student/";
}

export const protectedRouteSmokeCases: Array<{
  id: string;
  role: string;
  workspace: EvidaraWorkspace;
  expected: boolean;
  route: string;
}> = [
  { id: "admin-super-admin", role: "super_admin", workspace: "admin", expected: true, route: "/admin/" },
  { id: "admin-school-role", role: "institute_admin", workspace: "admin", expected: false, route: "/admin/" },
  { id: "admin-student", role: "student", workspace: "admin", expected: false, route: "/admin/" },
  { id: "school-school-role", role: "institute_admin", workspace: "school", expected: true, route: "/school/" },
  { id: "school-student", role: "student", workspace: "school", expected: false, route: "/school/" },
  { id: "student-student", role: "student", workspace: "student", expected: true, route: "/student/" },
  { id: "student-school-role", role: "teacher", workspace: "student", expected: true, route: "/student/" },
  { id: "student-super-admin", role: "super_admin", workspace: "student", expected: true, route: "/student/" },
];
