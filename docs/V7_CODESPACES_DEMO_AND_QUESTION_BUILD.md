# Evidara V7 Codespaces demo and live question-paper runbook

This build preserves the approved V7 UI while connecting the first core workflow to Supabase:

- School Admin and School Teacher question bank
- Add and edit questions
- Live question table with search, filters, ownership, status, difficulty and pagination
- Question-paper table
- Multi-section paper builder
- Approved-question selection
- Draft, publish and archive controls
- Student live test catalogue
- Private test-code lookup
- Secure sales-demo account creation

## Security boundary

Do not share Super Admin or Evidara Admin credentials with the sales team.

The sales bootstrap creates only:

- School Admin
- School Teacher
- Student

Passwords are generated at runtime and written to ignored local files. They are never committed to GitHub and are not printed by the script.

## 1. Update the Codespace

```bash
git restore package-lock.json 2>/dev/null || true
git fetch origin
git switch evidara-v7-super-ui
git pull --ff-only origin evidara-v7-super-ui
rm -rf node_modules .next .open-next
npm ci
```

Verify:

```bash
node -p "require('./package.json').version"
git branch --show-current
```

Expected:

```text
7.0.0
evidara-v7-super-ui
```

## 2. Apply the live role migrations

In Supabase open:

```text
SQL Editor → New query
```

Run the complete files in order:

```text
supabase/25_role_access_control.sql
supabase/26_v7_role_compatibility.sql
```

Do not run isolated snippets.

Verify:

```sql
select to_regprocedure('public.assign_evidara_role_by_email(text,text)') is not null
  as role_assignment_ready;

select to_regprocedure('public.assign_evidara_school_role_by_email(text,uuid,text)') is not null
  as school_role_assignment_ready;

select to_regprocedure('public.is_evidara_school_staff(uuid)') is not null
  as school_staff_check_ready;

select to_regprocedure('public.is_evidara_school_manager(uuid)') is not null
  as school_manager_check_ready;
```

All four values must be `true`.

## 3. Select the school used for the sales demo

List schools:

```sql
select id, name, city, state
from public.organizations
order by created_at;
```

Copy the UUID of the school that the demo accounts should use.

The bootstrap automatically uses the first school when `DEMO_SCHOOL_ID` is omitted. Supplying the UUID is safer when multiple schools exist.

## 4. Generate the three demo accounts

The required Codespaces secrets must already be available:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
```

Safe presence check:

```bash
node -e '
for (const name of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_APP_URL"
]) console.log(`${name}: ${process.env[name] ? "SET" : "MISSING"}`)
'
```

Run with the selected school UUID:

```bash
DEMO_SCHOOL_ID="YOUR_SCHOOL_UUID" npm run demo:bootstrap
```

The command creates or resets these Supabase Auth accounts:

```text
sales.schooladmin@demo.evidara.app
sales.teacher@demo.evidara.app
sales.student@demo.evidara.app
```

It writes the generated passwords and user UUIDs to:

```text
.evidara-demo-access.txt
.evidara-demo-access.json
```

Read the human-friendly file:

```bash
cat .evidara-demo-access.txt
```

Copy the credentials into the approved password manager or controlled sales-team channel. Do not commit, screenshot publicly, or paste them into GitHub issues.

Running the command again rotates all three passwords.

## 5. Start Evidara V7

```bash
npm run dev
```

Open the forwarded port 3000 URL from the Codespaces Ports panel.

Health check:

```text
/api/health
```

Expected values:

```json
{
  "release": "7.0.0",
  "configured": true,
  "serverReady": true,
  "mode": "supabase",
  "interface": "v7-super-ui"
}
```

## 6. Test each sales role separately

Use separate Incognito windows or browser profiles.

### School Admin

Expected:

- School dashboard
- Question Bank
- Tests and Question Papers
- Student management
- School subscription visibility
- Resources, achievements, benchmarks and segments

### School Teacher

Expected:

- School dashboard
- Question Bank
- Tests and Question Papers
- Student and academic visibility
- No subscription navigation
- No student invitation, promotion or revocation authority

### Student

Expected:

- Student dashboard
- Live Available Tests loaded from `list_available_papers`
- Private test-code lookup
- Start/resume assessment
- Own analytics, results, achievements, resources and access

## 7. Test the core question-to-student flow

1. Sign in as School Teacher or School Admin.
2. Open **Question Bank**.
3. Click **Add Question**.
4. Select subject and chapter.
5. Enter question, options and correct answer.
6. Save with `In Review`, or approve it through an authorised platform account.
7. Open **Tests and Question Papers**.
8. Click **Create Paper**.
9. Create sections.
10. Add approved questions.
11. Configure duration, attempts, access, schedule and result display.
12. Save and publish.
13. Sign in as Student.
14. Open **Available Tests**.
15. Confirm that the published eligible paper appears.
16. Start the assessment.

School-created papers should use `organization` access for the linked demo student.

## 8. Validate the build

Stop the development server and run:

```bash
npm run lint
npm run typecheck
npm run qa:smoke
npm run build
npm run cf:build
```

No deployment or merge is performed by these commands.

## Current V7 scope boundary

This build makes the question-bank, question-paper catalogue and student test catalogue live. Other V7 dashboard cards may still contain presentation data until they are connected page by page.

Keep pull request #18 in draft until every page is connected and role-tested.
