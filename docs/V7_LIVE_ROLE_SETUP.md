# Evidara V7 live role setup

This setup connects the five Evidara roles to real Supabase Auth users and real school records.

## Canonical roles

| Role | Intended access |
|---|---|
| `super_admin` | Full platform control, role administration, commerce, readiness, every school workspace and student workspace |
| `evidara_admin` | Evidara operations, schools, academics, subscriptions and analytics; no Super Admin role assignment, production readiness or commerce governance |
| `school_admin` | One linked school's staff, students, academic operations, analytics, profile and subscription visibility |
| `school_teacher` | One linked school's students, questions, papers, resources and analytics; no staff, subscription or student-lifecycle administration |
| `student` | Only the signed-in learner's own tests, results, analytics, achievements, resources and purchases |

Legacy roles such as `institute_admin` and `teacher` remain readable during migration, but all new accounts should use the five canonical values.

## Important testing rule

Do not assign all five roles to one profile. `profiles.role` is the account's authoritative role.

Use:

- one real Super Admin account for full platform administration;
- one Evidara Admin test account;
- one School Admin test account;
- one School Teacher test account;
- one Student test account.

The Super Admin can access all three workspaces, but separate accounts are still required to verify that lower roles cannot access restricted data.

## 1. Apply the database migration

Open Supabase:

```text
SQL Editor → New query
```

Copy and run the complete repository file:

```text
supabase/25_role_access_control.sql
```

Do not run only selected lines.

Verify:

```sql
select to_regprocedure('public.assign_evidara_role(uuid,text)') is not null
  as assign_role_ready;

select to_regprocedure('public.assign_evidara_role_by_email(text,text)') is not null
  as assign_by_email_ready;

select to_regprocedure('public.assign_evidara_school_role_by_email(text,uuid,text)') is not null
  as assign_school_role_ready;

select to_regclass('public.profile_role_audit') is not null
  as role_audit_ready;
```

All four values must be `true`.

## 2. Create the five Supabase Auth users

Open:

```text
Authentication → Users
```

Create or invite five different email accounts. Recommended labels:

```text
Super Admin
Evidara Admin
School Admin
School Teacher
Student
```

Each account must exist in `auth.users`. Have each invited account complete sign-in once so the normal profile-creation trigger can create its `public.profiles` row.

Check the accounts and profile rows:

```sql
select
  u.id,
  u.email,
  p.full_name,
  p.role
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at desc;
```

Every test account must have a matching profile row before assigning its role.

## 3. Bootstrap the first Super Admin

The first Super Admin must be assigned once through the Supabase SQL Editor because no Super Admin exists yet.

Replace the placeholder email:

```sql
update public.profiles p
set
  role = 'super_admin',
  updated_at = now()
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('YOUR_SUPER_ADMIN_EMAIL');
```

Verify exactly one result:

```sql
select u.email, p.role
from auth.users u
join public.profiles p on p.id = u.id
where lower(u.email) = lower('YOUR_SUPER_ADMIN_EMAIL');
```

Expected role:

```text
super_admin
```

Sign out and sign in again after changing a role.

## 4. Assign Evidara Admin and Student

Replace the email placeholders:

```sql
update public.profiles p
set role = 'evidara_admin', updated_at = now()
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('YOUR_EVIDARA_ADMIN_EMAIL');

update public.profiles p
set role = 'student', updated_at = now()
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('YOUR_STUDENT_EMAIL');
```

## 5. Find the live school organization

```sql
select id, name, city, state
from public.organizations
order by created_at;
```

Copy the UUID of the school that the School Admin, School Teacher and Student should use.

In the examples below, replace:

```text
YOUR_SCHOOL_ORGANIZATION_UUID
```

with that UUID.

## 6. Assign and link the School Admin

Set the profile role:

```sql
update public.profiles p
set role = 'school_admin', updated_at = now()
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('YOUR_SCHOOL_ADMIN_EMAIL');
```

Update an existing school membership:

```sql
with target as (
  select id
  from auth.users
  where lower(email) = lower('YOUR_SCHOOL_ADMIN_EMAIL')
)
update public.organization_members m
set member_role = 'school_admin', is_active = true
from target
where m.organization_id = 'YOUR_SCHOOL_ORGANIZATION_UUID'::uuid
  and m.user_id = target.id;
```

Insert the membership only when one does not already exist:

```sql
with target as (
  select id
  from auth.users
  where lower(email) = lower('YOUR_SCHOOL_ADMIN_EMAIL')
)
insert into public.organization_members (
  organization_id,
  user_id,
  member_role,
  is_active
)
select
  'YOUR_SCHOOL_ORGANIZATION_UUID'::uuid,
  target.id,
  'school_admin',
  true
from target
where not exists (
  select 1
  from public.organization_members existing
  where existing.organization_id = 'YOUR_SCHOOL_ORGANIZATION_UUID'::uuid
    and existing.user_id = target.id
);
```

## 7. Assign and link the School Teacher

Set the profile role:

```sql
update public.profiles p
set role = 'school_teacher', updated_at = now()
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('YOUR_SCHOOL_TEACHER_EMAIL');
```

Update an existing membership:

```sql
with target as (
  select id
  from auth.users
  where lower(email) = lower('YOUR_SCHOOL_TEACHER_EMAIL')
)
update public.organization_members m
set member_role = 'school_teacher', is_active = true
from target
where m.organization_id = 'YOUR_SCHOOL_ORGANIZATION_UUID'::uuid
  and m.user_id = target.id;
```

Insert it when missing:

```sql
with target as (
  select id
  from auth.users
  where lower(email) = lower('YOUR_SCHOOL_TEACHER_EMAIL')
)
insert into public.organization_members (
  organization_id,
  user_id,
  member_role,
  is_active
)
select
  'YOUR_SCHOOL_ORGANIZATION_UUID'::uuid,
  target.id,
  'school_teacher',
  true
from target
where not exists (
  select 1
  from public.organization_members existing
  where existing.organization_id = 'YOUR_SCHOOL_ORGANIZATION_UUID'::uuid
    and existing.user_id = target.id
);
```

A School Teacher can read the linked school's roster and academic resources. Student promotion, revocation and invitation remain School Admin operations.

## 8. Link the Student to the school

The profile role alone is not enough. A learner must also have a live row in `student_school_memberships`.

Replace the grade, section, board and academic year as needed:

```sql
with target as (
  select id
  from auth.users
  where lower(email) = lower('YOUR_STUDENT_EMAIL')
)
insert into public.student_school_memberships (
  organization_id,
  student_id,
  academic_year,
  grade,
  section,
  board,
  tracks,
  status,
  promotion_locked,
  parent_name,
  parent_phone
)
select
  'YOUR_SCHOOL_ORGANIZATION_UUID'::uuid,
  target.id,
  '2026-27',
  10,
  'A',
  'CBSE',
  array['Foundation']::text[],
  'active',
  false,
  '',
  ''
from target
on conflict (organization_id, student_id, academic_year)
do update set
  grade = excluded.grade,
  section = excluded.section,
  board = excluded.board,
  tracks = excluded.tracks,
  status = 'active',
  promotion_locked = false;
```

Do not use this statement for a learner who has been permanently revoked from the school. The existing promotion-block controls must remain authoritative.

## 9. Verify the complete live directory

```sql
select
  u.email,
  p.role,
  om.organization_id as staff_school_id,
  om.member_role,
  om.is_active as staff_active,
  sm.organization_id as student_school_id,
  sm.academic_year,
  sm.grade,
  sm.status as student_status
from auth.users u
join public.profiles p on p.id = u.id
left join public.organization_members om on om.user_id = u.id and om.is_active = true
left join public.student_school_memberships sm on sm.student_id = u.id and sm.status = 'active'
where lower(u.email) in (
  lower('YOUR_SUPER_ADMIN_EMAIL'),
  lower('YOUR_EVIDARA_ADMIN_EMAIL'),
  lower('YOUR_SCHOOL_ADMIN_EMAIL'),
  lower('YOUR_SCHOOL_TEACHER_EMAIL'),
  lower('YOUR_STUDENT_EMAIL')
)
order by u.email;
```

Expected:

- Super Admin: `profiles.role = super_admin`
- Evidara Admin: `profiles.role = evidara_admin`
- School Admin: `profiles.role = school_admin` and an active `organization_members` row
- School Teacher: `profiles.role = school_teacher` and an active `organization_members` row
- Student: `profiles.role = student` and an active `student_school_memberships` row

## 10. Test every role separately

Use a private/incognito browser session for each account.

### Super Admin

Must access Admin, School and Student workspaces. Must be the only account able to assign roles and access Super Admin-only commerce/readiness controls.

### Evidara Admin

Must access operational Admin, School and Student workspaces. Must not receive Super Admin role-management, product-governance or production-readiness controls.

### School Admin

Must see only the linked school and may manage student lifecycle and school operations.

### School Teacher

Must see the linked school's academic data and student roster. Must not promote, revoke or invite students and must not access subscription administration.

### Student

Must see only the learner's own school membership, eligible resources, tests, results, analytics, achievements and purchases.

## 11. Audit role changes

```sql
select
  a.changed_at,
  u.email,
  a.old_role,
  a.new_role,
  a.changed_by,
  a.source
from public.profile_role_audit a
join auth.users u on u.id = a.profile_id
order by a.changed_at desc;
```

Do not publish or merge V7 until every role has passed its own signed-in test with real Supabase data.
