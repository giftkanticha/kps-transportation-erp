-- Route master — admin-set standard distance/fuel-efficiency per
-- origin→destination location pair (e.g. คลังปุ๋ยตราไก่แดง → ร้านย่อยเชียงราย).
--
-- This is a REFERENCE table only, not a foreign key on dispatch_legs — legs
-- keep storing origin/destination as free text (see 0033_locations_master.sql).
-- Route-analysis (useRouteAnomalies.ts) resolves each leg's text against
-- `locations` to find a matching route row and uses its standard values as a
-- fallback baseline when a route doesn't yet have ≥3 historical trips to
-- compute a statistical average from.
--
-- Production tables live in the `kps` schema, not `public` (confirmed via
-- information_schema.tables — see src/lib/supabase.ts, and 0043/0044's own
-- notes on this), so this table and every reference to `locations` below
-- must be schema-qualified or PostgREST/psql won't find them.

GRANT USAGE ON SCHEMA kps TO anon, authenticated;

CREATE TABLE IF NOT EXISTS kps.routes (
  id                       TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  origin_location_id       TEXT        NOT NULL REFERENCES kps.locations(id) ON DELETE CASCADE,
  destination_location_id  TEXT        NOT NULL REFERENCES kps.locations(id) ON DELETE CASCADE,
  standard_distance_km     NUMERIC,
  standard_kmpl            NUMERIC,
  notes                    TEXT        NOT NULL DEFAULT '',
  active                   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (origin_location_id, destination_location_id)
);

CREATE INDEX IF NOT EXISTS routes_active_idx ON kps.routes(active) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS routes_origin_idx ON kps.routes(origin_location_id);
CREATE INDEX IF NOT EXISTS routes_destination_idx ON kps.routes(destination_location_id);

-- ─── Grants ──────────────────────────────────────────────────────────────────
-- RLS below restricts rows; PostgREST also needs the base table grant or every
-- request fails with "permission denied for table routes" regardless of RLS.
GRANT SELECT, INSERT, UPDATE, DELETE ON kps.routes TO anon, authenticated;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE kps.routes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS routes_read  ON kps.routes;
DROP POLICY IF EXISTS routes_write ON kps.routes;

CREATE POLICY routes_read
  ON kps.routes FOR SELECT TO authenticated USING (TRUE);
-- writes open to authenticated (matches locations' pattern; role-gating in permissions.ts)
CREATE POLICY routes_write
  ON kps.routes FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
