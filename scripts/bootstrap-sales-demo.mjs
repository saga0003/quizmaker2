import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
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
    key: "super_admin",
    email: "hemasagar333@gmail.com",
    fullName: "Hema Sagar",
    role: "super_admin",
    scope: "platform",
  },
  {
    key: "evidara_admin",
    email: "evidaraadmin@demo.evidara.app",
    fullName: "Evidara Demo Company Admin",
    role: "evidara_admin",
    scope: "platform",
  },
  {
    key: "school_admin",
    email: `sales.schooladmin@${emailDomain}`,
    fullName: "Evidara Demo School Admin",
    role: "school_admin",
    scope: "school",
  },
  {
    key: "school_teacher",
    email: `sales.teacher@${emailDomain}`,
    fullName: "Evidara Demo School Teacher",
    role: "school_teacher",
    scope: "school",
  },
  {
    key: "student",
    email: `sales.student@${emailDomain}`,
    fullName: "Evidara Demo Student",
    role: "student",
    scope: "school",
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

async function assignPlatformRole(email, role) {
  const { error } = await supabase.rpc("assign_evidara_role_by_email", {
    p_email: email,
    p_role: role,
  });

  if (error) {
    throw new Error(
      `${error.message} Apply supabase/25_role_access_control.sql and supabase/26_v7_role_compatibility.sql before running the demo bootstrap.`,
    );
  }
}

function missingRequiredColumn(message) {
  return message.match(/null value in column ["']([^"']+)["']/i)?.[1] || null;
}

function missingSchemaColumn(message) {
  return message.match(/Could not find the '([^']+)' column of 'organizations'/i)?.[1] || null;
}

async function createDemoSchoolForLiveSchema(schoolAdminUserId) {
  const now = new Date().toISOString();
  const candidateValues = {
    id: randomUUID(),
    name: demoSchoolName,
    slug: demoSchoolSlug,
    code: "EVIDARA-DEMO",
    school_code: "EVIDARA-DEMO",
    school_type: "School",
    institute_type: process.env.DEMO_INSTITUTE_TYPE || "school",
    type: "School",
    organization_type: "school",
    city: process.env.DEMO_SCHOOL_CITY || "Bengaluru",
    state: process.env.DEMO_SCHOOL_STATE || "Karnataka",
    country: "India",
    phone: process.env.DEMO_SCHOOL_PHONE || "0000000000",
    email: `school@${emailDomain}`,
    address: "Evidara sales demonstration workspace",
    student_count_range: "1-100",
    status: "active",
    is_active: true,
    active: true,
    created_by: schoolAdminUserId,
    created_at: now,
    updated_at: now,
  };

  const payload = { name: demoSchoolName };
  const attemptedRequiredColumns = new Set();

  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const { data, error } = await supabase
      .from("organizations")
      .insert(payload)
      .select("id,name")
      .single();

    if (!error && data) return { ...data, created: true };

    const message = error?.message || "Unable to create the dedicated sales demo school.";
    const unknownColumn = missingSchemaColumn(message);
    if (unknownColumn && Object.hasOwn(payload, unknownColumn)) {
      delete payload[unknownColumn];
      continue;
    }

    const requiredColumn = missingRequiredColumn(message);
    if (requiredColumn && !attemptedRequiredColumns.has(requiredColumn)) {
      attemptedRequiredColumns.add(requiredColumn);
      if (Object.hasOwn(candidateValues, requiredColumn)) {
        payload[requiredColumn] = candidateValues[requiredColumn];
        continue;
      }
    }

    throw new Error(
      `${message} The live organizations schema requires a field the demo bootstrap cannot infer safely. ` +
      `Set DEMO_SCHOOL_ID to an existing organization UUID and run the command again.`,
    );
  }

  throw new Error("Unable to create the demo school after checking the live organizations schema.");
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
    .eq("name", demoSchoolName)
    .limit(1)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existing) return { ...existing, created: false };

  return createDemoSchoolForLiveSchema(schoolAdminUserId);
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
  await assignPlatformRole(email, "student");

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

async function writeAccessFiles({ accounts, school = null, taxonomy = null, setupStatus }) {
  const generatedAt = new Date().toISOString();
  const credentials = accounts.map((account) => ({
    role: account.role,
    email: account.email,
    password: account.password,
    user_id: account.user.id,
    school_id: account.scope === "school" ? school?.id ?? null : null,
    school_name: account.scope === "school" ? school?.name ?? null : null,
  }));

  const text = [
    "EVIDARA V7 DEMO ACCESS",
    `Generated: ${generatedAt}`,
    `Setup status: ${setupStatus}`,
    school ? `School: ${school.name}` : "School: pending",
    school ? `School UUID: ${school.id}` : "School UUID: pending",
    taxonomy ? `Question taxonomy: ${taxonomy.ready ? "READY" : "CHECK REQUIRED"}` : "Question taxonomy: pending",
    taxonomy ? `Taxonomy note: ${taxonomy.note}` : "Taxonomy note: school setup not completed yet",
    "",
    ...credentials.flatMap((account) => [
      `${account.role.toUpperCase()}`,
      `Email: ${account.email}`,
      `Password: ${account.password}`,
      `User UUID: ${account.user_id}`,
      account.school_id ? `School UUID: ${account.school_id}` : "Platform account: not linked to a school",
      "",
    ]),
    "Security note: rerun npm run demo:bootstrap to rotate generated passwords.",
    "Do not share the Super Admin password with the general sales team.",
  ].join("\n");

  await writeFile(passwordOutput, text, { encoding: "utf8" });
  await writeFile(
    jsonOutput,
    JSON.stringify(
      {
        generated_at: generatedAt,
        setup_status: setupStatus,
        school,
        taxonomy,
        accounts: credentials,
      },
      null,
      2,
    ),
    { encoding: "utf8" },
  );
  await Promise.all([chmod(passwordOutput, 0o600), chmod(jsonOutput, 0o600)]);

  return credentials;
}

async function run() {
  const preparedAccounts = [];

  for (const account of accountDefinitions) {
    const password = createPassword();
    const user = await createOrResetUser({ ...account, password });
    preparedAccounts.push({ ...account, password, user });
  }

  const platformAccounts = preparedAccounts.filter((account) => account.scope === "platform");
  for (const account of platformAccounts) {
    await assignPlatformRole(account.email, account.role);
  }

  await writeAccessFiles({
    accounts: platformAccounts,
    setupStatus: "PLATFORM ACCOUNTS READY; SCHOOL ACCOUNTS PENDING",
  });

  const schoolAdmin = preparedAccounts.find((account) => account.role === "school_admin");
  if (!schoolAdmin) throw new Error("School Admin demo account definition is missing.");

  const school = await ensureDemoSchool(schoolAdmin.user.id);

  for (const account of preparedAccounts) {
    if (account.scope === "platform") continue;

    if (account.role === "school_admin" || account.role === "school_teacher") {
      await assignSchoolRole(account.email, school.id, account.role);
    } else {
      await assignStudent(account.email, account.user.id, school.id);
    }
  }

  const taxonomy = await ensureBasicTaxonomy();
  const credentials = await writeAccessFiles({
    accounts: preparedAccounts,
    school,
    taxonomy,
    setupStatus: "ALL FIVE DEMO ACCOUNTS READY",
  });

  console.log(`Created or reset ${credentials.length} Supabase demo accounts.`);
  console.log(`Platform accounts: hemasagar333@gmail.com and evidaraadmin@demo.evidara.app.`);
  console.log(`Demo school: ${school.name} (${school.id}).`);
  console.log(`Credentials were written to ${passwordOutput} and ${jsonOutput}.`);
  console.log("Passwords were not committed to GitHub and are not printed to the terminal.");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  console.error(`Platform credentials may already be available in ${passwordOutput}.`);
  process.exit(1);
});