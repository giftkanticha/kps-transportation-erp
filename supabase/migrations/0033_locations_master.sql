-- Location master — suggestion source for dispatch leg origin/destination.
-- Legs keep storing the location NAME as free text (dispatch_legs.origin/destination
-- are unchanged); this table only powers a combobox/datalist so users pick an
-- existing place instead of re-typing it differently every time.
--
-- NON-destructive: dispatch_legs is never altered. The seed only READS distinct
-- origin/destination values already in use so the dropdown is useful on day one.

CREATE TABLE IF NOT EXISTS locations (
  id         TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  name       TEXT        NOT NULL,
  category   TEXT        NOT NULL DEFAULT '',   -- โรงงาน / ลูกค้า / ท่าเรือ ฯลฯ
  province   TEXT        NOT NULL DEFAULT '',
  address    TEXT        NOT NULL DEFAULT '',
  notes      TEXT        NOT NULL DEFAULT '',
  active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS locations_active_idx ON locations(active) WHERE active = TRUE;

-- Seed the master from values already used in legs (read-only on dispatch_legs).
INSERT INTO locations (name)
SELECT DISTINCT TRIM(origin) FROM dispatch_legs
  WHERE COALESCE(TRIM(origin), '') <> ''
ON CONFLICT (name) DO NOTHING;

INSERT INTO locations (name)
SELECT DISTINCT TRIM(destination) FROM dispatch_legs
  WHERE COALESCE(TRIM(destination), '') <> ''
ON CONFLICT (name) DO NOTHING;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS locations_read  ON locations;
DROP POLICY IF EXISTS locations_write ON locations;

CREATE POLICY locations_read
  ON locations FOR SELECT TO authenticated USING (TRUE);
-- writes open to authenticated (matches project pattern; role-gating in permissions.ts)
CREATE POLICY locations_write
  ON locations FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
