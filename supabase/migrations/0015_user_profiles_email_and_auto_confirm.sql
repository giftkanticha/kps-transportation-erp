-- 1. Denormalize email onto user_profiles so admins can see it in the user mgmt page.
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS email TEXT;

UPDATE public.user_profiles p
SET email = au.email
FROM auth.users au
WHERE au.id = p.id AND (p.email IS NULL OR p.email = '');

-- 2. handle_new_user now also writes email at signup so it stays in sync.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_role   TEXT := 'EMPLOYEE';
  v_status TEXT := 'PENDING_APPROVAL';
  v_count  INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM user_profiles WHERE role = 'SUPER_ADMIN' AND status = 'ACTIVE';
  IF v_count = 0 THEN
    v_role   := 'SUPER_ADMIN';
    v_status := 'ACTIVE';
  END IF;
  INSERT INTO user_profiles (id, display_name, phone, role, status, username, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    v_role, v_status,
    NULLIF(NEW.raw_user_meta_data->>'username', ''),
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- 3. When admin sets status=ACTIVE, auto-confirm the user's email in auth.users
--    so they can actually log in (Supabase rejects unconfirmed accounts).
--    Also stamps approved_at / approved_by.
CREATE OR REPLACE FUNCTION public.handle_profile_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public', 'auth'
AS $$
BEGIN
  IF NEW.status = 'ACTIVE' AND (OLD.status IS DISTINCT FROM 'ACTIVE') THEN
    UPDATE auth.users
    SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
    WHERE id = NEW.id;
    IF NEW.approved_at IS NULL THEN NEW.approved_at := NOW(); END IF;
    IF NEW.approved_by IS NULL THEN NEW.approved_by := auth.uid(); END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_profiles_on_approve ON public.user_profiles;
CREATE TRIGGER user_profiles_on_approve
  BEFORE UPDATE OF status ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_profile_approval();

-- 4. Backfill: any existing ACTIVE user whose email isn't confirmed yet (e.g. accounts
--    approved before this fix) should get confirmed now so they can log in.
UPDATE auth.users au
SET email_confirmed_at = COALESCE(au.email_confirmed_at, NOW())
FROM public.user_profiles p
WHERE p.id = au.id
  AND p.status = 'ACTIVE'
  AND au.email_confirmed_at IS NULL;
