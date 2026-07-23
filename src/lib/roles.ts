export const EVIDARA_ROLES = [
  "super_admin",
  "evidara_admin",
  "school_admin",
  "school_teacher",
  "student",
] as const;

export type EvidaraRole = (typeof EVIDARA_ROLES)[number];
export type EvidaraWorkspace = "admin" | "school" | "student";

export type EvidaraPermission =
  | "platform.full_control"
  | "platform.operations"
  | "platform.manage_roles"
  | "platform.manage_commerce"
  | "platform.read_readiness"
  | "schools.read_all"
  | "schools.manage_all"
  | "school.manage_profile"
  | "school.manage_staff"
  | "school.manage_students"
  | "school.read_students"
  | "school.manage_academics"
  | "school.read_analytics"
  | "school.read_subscription"
  | "student.read_own"
  | "student.take_tests";

const LEGACY_ROLE_MAP: Record<string, EvidaraRole> = {
  super_admin: "super_admin",
  evidara_admin: "evidara_admin",
  admin: "evidara_admin",
  platform_admin: "evidara_admin",
  institute_owner: "school_admin",
  institute_admin: "school_admin",
  school_owner: "school_admin",
  school_admin: "school_admin",
  teacher: "school_teacher",
  school_teacher: "school_teacher",
  reviewer: "school_teacher",
  invigilator: "school_teacher",
  student: "student",
};

const ROLE_LABELS: Record<EvidaraRole, string> = {
  super_admin: "Super Admin",
  evidara_admin: "Evidara Admin",
  school_admin: "School Admin",
  school_teacher: "School Teacher",
  student: "Student",
};

const ROLE_PERMISSIONS: Record<EvidaraRole, ReadonlySet<EvidaraPermission>> = {
  super_admin: new Set<EvidaraPermission>([
    "platform.full_control",
    "platform.operations",
    "platform.manage_roles",
    "platform.manage_commerce",
    "platform.read_readiness",
    "schools.read_all",
    "schools.manage_all",
    "school.manage_profile",
    "school.manage_staff",
    "school.manage_students",
    "school.read_students",
    "school.manage_academics",
    "school.read_analytics",
    "school.read_subscription",
    "student.read_own",
    "student.take_tests",
  ]),
  evidara_admin: new Set<EvidaraPermission>([
    "platform.operations",
    "schools.read_all",
    "schools.manage_all",
    "school.manage_profile",
    "school.manage_staff",
    "school.manage_students",
    "school.read_students",
    "school.manage_academics",
    "school.read_analytics",
    "school.read_subscription",
    "student.read_own",
    "student.take_tests",
  ]),
  school_admin: new Set<EvidaraPermission>([
    "school.manage_profile",
    "school.manage_staff",
    "school.manage_students",
    "school.read_students",
    "school.manage_academics",
    "school.read_analytics",
    "school.read_subscription",
    "student.read_own",
    "student.take_tests",
  ]),
  school_teacher: new Set<EvidaraPermission>([
    "school.read_students",
    "school.manage_academics",
    "school.read_analytics",
    "student.read_own",
    "student.take_tests",
  ]),
  student: new Set<EvidaraPermission>([
    "student.read_own",
    "student.take_tests",
  ]),
};

export function normalizeEvidaraRole(role?: string | null): EvidaraRole {
  if (!role) return "student";
  return LEGACY_ROLE_MAP[role.trim().toLowerCase()] ?? "student";
}

export function evidaraRoleLabel(role?: string | null) {
  return ROLE_LABELS[normalizeEvidaraRole(role)];
}

export function isPlatformAdmin(role?: string | null) {
  const normalized = normalizeEvidaraRole(role);
  return normalized === "super_admin" || normalized === "evidara_admin";
}

export function isSuperAdmin(role?: string | null) {
  return normalizeEvidaraRole(role) === "super_admin";
}

export function isSchoolStaff(role?: string | null) {
  const normalized = normalizeEvidaraRole(role);
  return normalized === "school_admin" || normalized === "school_teacher";
}

export function isSchoolManager(role?: string | null) {
  const normalized = normalizeEvidaraRole(role);
  return normalized === "super_admin" || normalized === "evidara_admin" || normalized === "school_admin";
}

export function hasEvidaraPermission(role: string | null | undefined, permission: EvidaraPermission) {
  return ROLE_PERMISSIONS[normalizeEvidaraRole(role)].has(permission);
}

export function canAccessEvidaraWorkspace(role: string | null | undefined, workspace: EvidaraWorkspace) {
  const normalized = normalizeEvidaraRole(role);

  if (normalized === "super_admin" || normalized === "evidara_admin") return true;
  if (normalized === "school_admin" || normalized === "school_teacher") {
    return workspace === "school" || workspace === "student";
  }
  return workspace === "student";
}

export function evidaraWorkspaceHome(role?: string | null) {
  const normalized = normalizeEvidaraRole(role);
  if (normalized === "super_admin" || normalized === "evidara_admin") return "/admin/";
  if (normalized === "school_admin" || normalized === "school_teacher") return "/school/";
  return "/student/";
}
