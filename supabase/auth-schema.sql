-- ─── Helper: check admin role without triggering RLS recursion ────────────────
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ─── User Profiles ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  id                  UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name        TEXT        NOT NULL DEFAULT '',
  phone               TEXT        NOT NULL DEFAULT '',
  role                TEXT        NOT NULL DEFAULT 'EMPLOYEE'
                                  CHECK (role IN ('SUPER_ADMIN','ADMIN','MANAGER','EMPLOYEE')),
  status              TEXT        NOT NULL DEFAULT 'PENDING_APPROVAL'
                                  CHECK (status IN ('PENDING_APPROVAL','ACTIVE','INACTIVE','LOCKED')),
  approved_by         UUID        REFERENCES auth.users(id),
  approved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins read all profiles" ON user_profiles
  FOR SELECT USING (get_my_role() IN ('SUPER_ADMIN','ADMIN'));

CREATE POLICY "Admins update profiles" ON user_profiles
  FOR UPDATE USING (get_my_role() IN ('SUPER_ADMIN','ADMIN'));

-- Auto-create profile on signup; first user becomes SUPER_ADMIN
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role   TEXT := 'EMPLOYEE';
  v_status TEXT := 'PENDING_APPROVAL';
  v_count  INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM user_profiles
    WHERE role = 'SUPER_ADMIN' AND status = 'ACTIVE';
  IF v_count = 0 THEN
    v_role   := 'SUPER_ADMIN';
    v_status := 'ACTIVE';
  END IF;
  INSERT INTO user_profiles (id, display_name, phone, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    v_role, v_status
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── Per-user permission overrides ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_permissions (
  id            UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category      TEXT  NOT NULL,
  action_level  TEXT  NOT NULL,
  granted_by    UUID  REFERENCES auth.users(id),
  remark        TEXT,
  granted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, category, action_level)
);

ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage permissions" ON user_permissions
  FOR ALL USING (get_my_role() IN ('SUPER_ADMIN','ADMIN'));

CREATE POLICY "Users read own permissions" ON user_permissions
  FOR SELECT USING (auth.uid() = user_id);

-- ─── Audit log ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS acl_audit_log (
  id           UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     UUID  REFERENCES auth.users(id),
  target_id    UUID  REFERENCES auth.users(id),
  action       TEXT  NOT NULL,
  category     TEXT,
  action_level TEXT,
  old_value    TEXT,
  new_value    TEXT,
  details      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE acl_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read audit log" ON acl_audit_log
  FOR SELECT USING (get_my_role() IN ('SUPER_ADMIN','ADMIN'));

CREATE POLICY "Anyone can insert audit log" ON acl_audit_log
  FOR INSERT WITH CHECK (true);

-- ─── Data reset log ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS data_reset_log (
  id           UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  reset_by     UUID  NOT NULL REFERENCES auth.users(id),
  details      TEXT,
  status       TEXT  NOT NULL DEFAULT 'COMPLETED',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE data_reset_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage reset log" ON data_reset_log
  FOR ALL USING (get_my_role() IN ('SUPER_ADMIN','ADMIN'));
