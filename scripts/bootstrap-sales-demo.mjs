import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { chmod, writeFile } from "node:fs/promises";
import process from "node:process";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const requestedSchoolId = process.env.DEMO_SCHOOL_ID?.trim() || "";
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

function createPassword() {
  const token = randomBytes(12).toString("base64url");
  return `Ev7!${token}9a`;
}

async function findSchool() {
  if (requestedSchoolId) {
    const { data, error } = await supabase
      .from("organizations")
      .select("id,name")
      .eq("id", requestedSchoolId)
      .single();
    if (error || !data) throw new Error(error?.message || "DEMO_SCHOOL_ID was not found.");
    return data;
  }

  const { data, error } = await supabase
    .from("organizations")
    .select("id,name")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error(
      "No school exists in Supabase. Create a school first or set DEMO_SCHOOL_ID to an existing organization UUID.",
    );
  }
  return data;
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
  if (profileError) throw new Error(profileError.message);

  return user;
}

async function run() {
  const school = await findSchool();
  const accounts = [
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

  const credentials = [];

  for (const account of accounts) {
    const password = createPassword();
    const user = await createOrResetUser({ ...account, password });

    if (account.role === "school_admin" || account.role === "school_teacher") {
      const { error } = await supabase.rpc("assign_evidara_school_role_by_email", {
        p_email: account.email,
        p_organization_id: school.id,
        p_role: account.role,
      });
      if (error) {
        throw new Error(
          `${error.message} Apply supabase/25_role_access_control.sql before running the demo bootstrap.`,
        );
      }
    } else {
      const { error } = await supabase.rpc("assign_evidara_role_by_email", {
        p_email: account.email,
        p_role: account.role,
      });
      if (error) {
        throw new Error(
          `${error.message} Apply supabase/25_role_access_control.sql before running the demo bootstrap.`,
        );
      }

      const { error: membershipError } = await supabase
        .from("student_school_memberships")
        .upsert(
          {
            organization_id: school.id,
            student_id: user.id,
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

    credentials.push({
      role: account.role,
      email: account.email,
      password,
      user_id: user.id,
      school_id: school.id,
      school_name: school.name,
    });
  }

  const generatedAt = new Date().toISOString();
  const text = [
    "EVIDARA V7 SALES DEMO ACCESS",
    `Generated: ${generatedAt}`,
    `School: ${school.name}`,
    `School UUID: ${school.id}`,
    "",
    ...credentials.flatMap((account) => [
      `${account.role.toUpperCase()}`,
      `Email: ${account.email}`,
      `Password: ${account.password}`,
      `User UUID: ${account.user_id}`,
      "",
    ]),
    "Security note: rotate these passwords whenever access should be revoked.",
  ].join("\n");

  await writeFile(passwordOutput, text, { encoding: "utf8" });
  await writeFile(jsonOutput, JSON.stringify({ generated_at: generatedAt, school, accounts: credentials }, null, 2), {
    encoding: "utf8",
  });
  await Promise.all([chmod(passwordOutput, 0o600), chmod(jsonOutput, 0o600)]);

  console.log(`Created or reset ${credentials.length} Supabase demo accounts.`);
  console.log(`Credentials were written to ${passwordOutput} and ${jsonOutput}.`);
  console.log("Passwords were not committed to GitHub and are not printed to the terminal.");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
