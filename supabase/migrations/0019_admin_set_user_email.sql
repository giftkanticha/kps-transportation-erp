-- Lets an admin correct a user's email address (e.g. user typed it wrong at
-- signup, can't receive password-reset emails). Updates both auth.users.email
-- and user_profiles.email atomically, and re-confirms the new address so the
-- user can keep using the account.

CREATE OR REPLACE FUNCTION public.admin_set_user_email(
  p_user_id UUID,
  p_email   TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public', 'auth'
AS $$
DECLARE
  v_email TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;
  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RAISE EXCEPTION 'Email is required';
  END IF;
  v_email := lower(trim(p_email));
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Invalid email format';
  END IF;

  UPDATE auth.users
  SET email              = v_email,
      email_confirmed_at = COALESCE(email_confirmed_at, NOW())
  WHERE id = p_user_id;

  UPDATE public.user_profiles
  SET email = v_email
  WHERE id  = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_user_email(UUID, TEXT) TO authenticated;
