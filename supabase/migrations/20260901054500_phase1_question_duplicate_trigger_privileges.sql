-- Phase 1 C11 follow-up: trigger helpers must never be callable as RPCs.
-- PostgreSQL triggers execute these functions through the trigger binding; browser roles
-- do not need direct EXECUTE privileges on the SECURITY DEFINER helpers.

revoke all on function public.prepare_question_duplicate_hash_v2() from public, anon, authenticated;
revoke all on function public.finalize_question_duplicate_hash_v2() from public, anon, authenticated;
