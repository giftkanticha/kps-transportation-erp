-- The login screen lets a user sign in with either their email or their
-- username. For a username, AuthContext.tsx resolves it to an email via
-- this RPC *before* any session exists, so the caller is the `anon` role —
-- RLS on user_profiles ("Users read own profile" / "Admins read all
-- profiles") would otherwise block the lookup entirely. This function was
-- referenced by the app but never actually created in the database, which
-- is why calls to it failed with "Could not find the function
-- public.email_for_username(p_username) in the schema cache".
CREATE OR REPLACE FUNCTION public.email_for_username(p_username TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT email FROM public.user_profiles WHERE username = p_username LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.email_for_username(TEXT) TO anon, authenticated;
