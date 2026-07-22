import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { chmod, writeFile } from "node:fs/promises";
import process from "node:process";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const requestedSchoolId = process.env.DEMO_SCHOOL_ID?.trim() || "";
const demoSchoolName = process.env.DEMO_SCHOOL_NAME?.trim() || "Evidara Sales Demo School";
const demoSchoolSlug = process.env.DEMO_SCHOOL_SLUG?.trim() || "evidara-sales-demo";
const emailDomain = (process.env.DEMO_EMAIL_DOMAIN || "demo.evidara.app").trim().toLowerCase();
const passwordOutput = process.env.DEMO_ACCESS_FILE || ".evidara-demo-access.txt";
const jsonOutput = process.env.DEMO_ACCESS_JSON || ".evidara-demo-access.json";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const accountDefinitions = [
  {
    key: "school_admin",
    email: `sales.schooladmin@${emailDomain}`,
    fullName: "Evidara Demo School Admin",
    role: "school_admin",
  },
  {
    key: "school_teacher",
    email: `sales.teacher@${emailDomain}`,
    fullName: "Evidara Demo School Teacher",
    role: "school_teacher",
  },
  {
    key: "student",
    email: `sales.student@${emailDomain}`,
    fullName: "Evidara Demo Student",
    role: "student",
  },
];

function createPassword() {
  const token = randomBytes(12).toString("base64url");
  return `Ev7!${token}9a`;
}

async function findExistingUser(email) {
  let page = 1;
  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    const match = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (data.users.length < 1000) return null;
    page += 1;
  }
  throw new Error(`Unable to finish searching Supabase Auth for ${email}.`);
}

async function createOrResetUser({ email, password, fullName, role }) {
  let user = await findExistingUser(email);

  if (user) {
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
      user_metadata: { ...(user.user_metadata || {}), full_name: fullName, role },
    });
    if (error || !data.user) throw new Error(error?.message || `Unable to reset ${email}.`);
    user = data.user;
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role },
    });
    if (error || !data.user) throw new Error(error?.message || `Unable to create ${email}.`);
    user = data.user;
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: user.id,
    full_name: fullName,
    role,
    updated_at: new Date().toISOString(),
  });
  if (profileError) {
    throw new Error(
      `${profileError.message} Apply supabase/25_role_access_control.sql and supabase/26_v7_role_compatibility.sql first.`,
    );
  }

  return user;
}

async function ensureDemoSchool(schoolAdminUserId) {
  if (requestedSchoolId) {
    const { data, error } = await supabase
      .from("organizations")
      .select("id,name")
      .eq("id", requestedSchoolId)
      .single();
    if (error || !data) throw new Error(error?.message || "DEMO_SCHOOL_ID was not found.");
    return { ...data, created: false };
  }

  const { data: existing, error: existingError } = await supabase
    .from("organizations")
    .select("id,name")
    .eq("slug", demoSchoolSlug)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) return { ...existing, created: false };

  const { data: created, error: createError } = await supabase
    .from("organizations")
    .insert({
      name: demoSchoolName,
      slug: demoSchoolSlug,
      school_type: "School",
      city: process.env.DEMO_SCHOOL_CITY || "Bengaluru",
      state: process.env.DEMO_SCHOOL_STATE || "Karnataka",
      phone: process.env.DEMO_SCHOOL_PHONE || "0000000000",
      student_count_range: "1-100",
      status: "active",
      created_by: schoolAdminUserId,
    })
    .select("id,name")
    .single();

  if (createError || !created) {
    throw new Error(createError?.message || "Unable to create the dedicated sales demo school.");
  }
  return { ...created, created: true };
}

async function ensureBasicTaxonomy() {
  const { data, error } = await supabase
    .from("subjects")
    .select("id")
    .eq("is_active", true)
    .limit(1);
  if (error) return { ready: false, note: error.message };
  if ((data || []).length) return { ready: true, note: "Existing taxonomy retained." };

  const rows = [
    { name: "Physics", code: "PHY", is_active: true, display_order: 1 },
    { name: "Chemistry", code: "CHEM", is_active: true, display_order: 2 },
    { name: "Mathematics", code: "MATH", is_active: true, display_order: 3 },
    { name: "Biology", code: "BIO", is_active: true, display_order: 4 },
    { name: "Logical Reasoning", code: "LOGIC", is_active: true, display_order: 5 },
  ];
  const { error: insertError } = await supabase.from("subjects").insert(rows);
  if (insertError) return { ready: false, note: insertError.message };
  return { ready: true, note: "Seeded the basic V7 subject taxonomy." };
}

async function assignSchoolRole(email, schoolId, role) {
  const { error } = await supabase.rpc("assign_evidara_school_role_by_email", {
    p_email: email,
    p_organization_id: schoolId,
    p_role: role,
  });
  if (error) {
    throw new Error(
      `${error.message} Apply supabase/25_role_access_control.sql and supabase/26_v7_role_compatibility.sql before running the demo bootstrap.`,
    );
  }
}

async function assignStudent(email, userId, schoolId) {
  const { error } = await supabase.rpc("assign_evidara_role_by_email", {
    p_email: email,
    p_role: "student",
  });
  if (error) {
    throw new Error(
      `${error.message} Apply supabase/25_role_access_control.sql and supabase/26_v7_role_compatibility.sql before running the demo bootstrap.`,
    );
  }

  const { error: membershipError } = await supabase
    .from("student_school_memberships")
    .upsert(
      {
        organization_id: schoolId,
        student_id: userId,
        academic_year: process.env.DEMO_ACADEMIC_YEAR || "2026-27",
        grade: Number(process.env.DEMO_STUDENT_GRADE || 10),
        section: process.env.DEMO_STUDENT_SECTION || "A",
        board: process.env.DEMO_STUDENT_BOARD || "CBSE",
        tracks: (process.env.DEMO_STUDENT_TRACKS || "Foundation,Boards")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        status: "active",
        promotion_locked: false,
        parent_name: "Demo Parent",
        parent_phone: "",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,student_id,academic_year" },
    );
  if (membershipError) throw new Error(membershipError.message);
}

async function run() {
  const preparedAccounts = [];

  for (const account of accountDefinitions) {
    const password = createPassword();
    const user = await createOrResetUser({ ...account, password });
    preparedAccounts.push({ ...account, password, user });
  }

  const schoolAdmin = preparedAccounts.find((account) => account.role === "school_admin");
  if (!schoolAdmin) throw new Error("School Admin demo account definition is missing.");
  const school = await ensureDemoSchool(schoolAdmin.user.id);

  for (const account of preparedAccounts) {
    if (account.role === "school_admin" || account.role === "school_teacher") {
      await assignSchoolRole(account.email, school.id, account.role);
    } else {
      await assignStudent(account.email, account.user.id, school.id);
    }
  }

  const taxonomy = await ensureBasicTaxonomy();
  const generatedAt = new Date().toISOString();
  const credentials = preparedAccounts.map((account) => ({
    role: account.role,
    email: account.email,
    password: account.password,
    user_id: account.user.id,
    school_id: school.id,
    school_name: school.name,
  }));

  const text = [
    "EVIDARA V7 SALES DEMO ACCESS",
    `Generated: ${generatedAt}`,
    `School: ${school.name}`,
    `School UUID: ${school.id}`,
    `School created by bootstrap: ${school.created ? "YES" : "NO"}`,
    `Question taxonomy: ${taxonomy.ready ? "READY" : "CHECK REQUIRED"}`,
    `Taxonomy note: ${taxonomy.note}`,
    "",
    ...credentials.flatMap((account) => [
      `${account.role.toUpperCase()}`,
      `Email: ${account.email}`,
      `Password: ${account.password}`,
      `User UUID: ${account.user_id}`,
      "",
    ]),
    "Security note: rerun npm run demo:bootstrap to rotate all three passwords.",
  ].join("\n");

  await writeFile(passwordOutput, text, { encoding: "utf8" });
  await writeFile(
    jsonOutput,
    JSON.stringify({ generated_at: generatedAt, school, taxonomy, accounts: credentials }, null, 2),
    { encoding: "utf8" },
  );
  await Promise.all([chmod(passwordOutput, 0o600), chmod(jsonOutput, 0o600)]);

  console.log(`Created or reset ${credentials.length} Supabase demo accounts.`);
  console.log(`Demo school: ${school.name} (${school.id}).`);
  console.log(`Credentials were written to ${passwordOutput} and ${jsonOutput}.`);
  console.log("Passwords were not committed to GitHub and are not printed to the terminal.");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
