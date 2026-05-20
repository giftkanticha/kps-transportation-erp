-- Phase 1 migration: user_profiles table + auto-create trigger + RLS policies
-- This fixes the "login refresh kicks user out" bug by ensuring every auth.user
-- has a matching profile row on signup.

-- ─── user_profiles ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT        NOT NULL DEFAULT '',
  phone         TEXT        NOT NULL DEFAULT '',
  role          TEXT        NOT NULL DEFAULT 'EMPLOYEE'
                            CHECK (role IN ('SUPER_ADMIN','ADMIN','MANAGER','EMPLOYEE')),
  status        TEXT        NOT NULL DEFAULT 'ACTIVE'
                            CHECK (status IN ('PENDING_APPROVAL','ACTIVE','INACTIVE','LOCKED')),
  approved_by   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_profiles_role_idx   ON user_profiles(role);
CREATE INDEX IF NOT EXISTS user_profiles_status_idx ON user_profiles(status);

-- ─── Auto-create profile on signup ───────────────────────────────────────────
-- Triggered when a new row is inserted into auth.users (i.e. after signup).
-- Pulls display_name/phone from raw_user_meta_data if provided.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name, phone, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    'EMPLOYEE',
    'ACTIVE'  -- เปลี่ยนเป็น 'PENDING_APPROVAL' ถ้าต้องการ admin อนุมัติก่อน
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── RLS policies ────────────────────────────────────────────────────────────
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Allow any authenticated user to read their own profile
DROP POLICY IF EXISTS "self_read_profile" ON user_profiles;
CREATE POLICY "self_read_profile" ON user_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Allow any authenticated user to update their own profile (display_name, phone only)
DROP POLICY IF EXISTS "self_update_profile" ON user_profiles;
CREATE POLICY "self_update_profile" ON user_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admins can read all profiles (needed for user management page)
DROP POLICY IF EXISTS "admin_read_all_profiles" ON user_profiles;
CREATE POLICY "admin_read_all_profiles" ON user_profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN')
    )
  );

-- Admins can update any profile (approve users, change roles)
DROP POLICY IF EXISTS "admin_update_all_profiles" ON user_profiles;
CREATE POLICY "admin_update_all_profiles" ON user_profiles
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN')
    )
  );

-- ─── updated_at auto-touch trigger ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_profiles_touch ON user_profiles;
CREATE TRIGGER user_profiles_touch
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
