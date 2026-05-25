-- Security hardening flagged by the Supabase linter.
-- 1. Pin search_path on the two SECURITY DEFINER functions still missing it,
--    matching the pattern already used on the other helpers.
ALTER FUNCTION public.get_my_role()     SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;

-- 2. handle_new_user is a signup trigger and rls_auto_enable is a DDL helper;
--    neither should be reachable through the REST API. Triggers fire regardless
--    of EXECUTE grants, so revoking does not affect signup or RLS evaluation.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

-- Note: is_admin/is_manager_or_above/get_my_role/my_employee_id remain callable
-- by authenticated on purpose — RLS policies evaluate them per query.
