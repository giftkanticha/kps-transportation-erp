-- The login screen lets a user sign in with either their email or their
-- username. For a username, AuthContext.tsx resolves it to an email via
-- this RPC *before* any session exists, so the caller is the `anon` role —
-- RLS on user_profiles ("Users read own profile" / "Admins read all
-- profiles") would otherwise block the lookup entirely. This function was
-- referenced by the app but never actually created in the database, which
-- is why calls to it failed with "Could not find the function ... in the
-- schema cache".
--
-- Production tables live in the `kps` schema (confirmed via
-- information_schema.tables), which is also what the Supabase client is
-- configured to use (see src/lib/supabase.ts) — so this function must be
-- created in `kps`, not `public`, or PostgREST won't find it either.
-- `kps` must also be listed under Project Settings > API > Data API >
-- Exposed schemas, and anon/authenticated need USAGE on it, or every
-- request against it fails with "Invalid schema: kps".
GRANT USAGE ON SCHEMA kps TO anon, authenticated;

CREATE OR REPLACE FUNCTION kps.email_for_username(p_username TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = 'kps'
AS $$
  SELECT email FROM kps.user_profiles WHERE username = p_username LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION kps.email_for_username(TEXT) TO anon, authenticated;
