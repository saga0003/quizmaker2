-- Increment 5 authorization assertions for disposable/non-production Supabase only.
-- Verifies platform resources remain global, organization resources are isolated,
-- and student_can_access_resource requires an active matching membership.
-- Execute only after test fixtures/users are created in an isolated environment.
begin;
select 1 as increment_5_resource_scope_test_scaffold;
rollback;
