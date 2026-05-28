-- Admin-only RPC to fully delete a user account: removes auth.users (which
-- CASCADE-deletes user_profiles via the existing FK). The prior client-side
-- DELETE on user_profiles was silently filtered because user_profiles has
-- no DELETE RLS policy, so nothing was deleted and the auth row stayed.

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public', 'auth'
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own account';
  END IF;

  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;
