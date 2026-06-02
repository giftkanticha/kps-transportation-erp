-- Accounting period close & lock — foundation
-- A period = 1 calendar month. Locking a closed period prevents edits to
-- any dispatch row inside it. Snapshots preserve P&L per vehicle at close
-- time so reports keep printing the same numbers forever.
--
-- Backfill scope: 2026 onwards (per ops decision — older data stays unmanaged).

CREATE TABLE IF NOT EXISTS accounting_periods (
  id              TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  year            INTEGER     NOT NULL,
  month           INTEGER     NOT NULL CHECK (month BETWEEN 1 AND 12),
  status          TEXT        NOT NULL DEFAULT 'OPEN'
                              CHECK (status IN ('OPEN', 'PENDING_CLOSE', 'CLOSED')),
  closed_at       TIMESTAMPTZ,
  closed_by       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_by_name  TEXT,
  reopened_at     TIMESTAMPTZ,
  reopened_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  reopen_reason   TEXT,
  notes           TEXT        NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (year, month)
);

CREATE INDEX IF NOT EXISTS accounting_periods_year_month_idx
  ON accounting_periods(year, month);
CREATE INDEX IF NOT EXISTS accounting_periods_status_idx
  ON accounting_periods(status);

-- Per-vehicle P&L snapshot generated at close time. Once written it's the
-- canonical source for any printout / display of that vehicle in that month.
CREATE TABLE IF NOT EXISTS accounting_period_snapshots (
  id           TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  period_id    TEXT        NOT NULL REFERENCES accounting_periods(id) ON DELETE CASCADE,
  vehicle_id   TEXT        REFERENCES vehicles(id) ON DELETE SET NULL,
  plate        TEXT        NOT NULL,
  data         JSONB       NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (period_id, vehicle_id)
);

CREATE INDEX IF NOT EXISTS period_snapshots_period_idx
  ON accounting_period_snapshots(period_id);

-- Approval flow for re-opening a closed period (admin only acts on it,
-- but managers can request).
CREATE TABLE IF NOT EXISTS period_unlock_requests (
  id              TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  period_id       TEXT        NOT NULL REFERENCES accounting_periods(id) ON DELETE CASCADE,
  requester_id    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  requester_name  TEXT        NOT NULL DEFAULT '',
  reason          TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_name   TEXT,
  reviewed_at     TIMESTAMPTZ,
  review_note     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS period_unlock_requests_period_idx
  ON period_unlock_requests(period_id);
CREATE INDEX IF NOT EXISTS period_unlock_requests_status_idx
  ON period_unlock_requests(status);

-- dispatch fields for period membership + decisions
ALTER TABLE dispatch
  ADD COLUMN IF NOT EXISTS accounting_period_id TEXT REFERENCES accounting_periods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS carry_forward_from   TEXT REFERENCES accounting_periods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS split_parent_id      TEXT REFERENCES dispatch(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS locked               BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS dispatch_accounting_period_idx
  ON dispatch(accounting_period_id);
CREATE INDEX IF NOT EXISTS dispatch_locked_idx
  ON dispatch(locked) WHERE locked = TRUE;

-- ─── Backfill ────────────────────────────────────────────────────────────────
-- Create periods for 2026 (Jan–Dec). Status OPEN by default.
INSERT INTO accounting_periods (year, month, status)
SELECT 2026, m, 'OPEN'
FROM generate_series(1, 12) AS m
ON CONFLICT (year, month) DO NOTHING;

-- Link existing dispatch rows in 2026 to their period (by depart, fall back to date).
UPDATE dispatch d
SET accounting_period_id = ap.id
FROM accounting_periods ap
WHERE d.accounting_period_id IS NULL
  AND ap.year  = EXTRACT(YEAR  FROM COALESCE(NULLIF(d.depart, ''), d.date)::TIMESTAMPTZ)::INT
  AND ap.month = EXTRACT(MONTH FROM COALESCE(NULLIF(d.depart, ''), d.date)::TIMESTAMPTZ)::INT
  AND ap.year >= 2026;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE accounting_periods           ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_period_snapshots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE period_unlock_requests       ENABLE ROW LEVEL SECURITY;

-- read: any authenticated user
DROP POLICY IF EXISTS accounting_periods_read           ON accounting_periods;
DROP POLICY IF EXISTS accounting_period_snapshots_read  ON accounting_period_snapshots;
DROP POLICY IF EXISTS period_unlock_requests_read       ON period_unlock_requests;

CREATE POLICY accounting_periods_read
  ON accounting_periods FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY accounting_period_snapshots_read
  ON accounting_period_snapshots FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY period_unlock_requests_read
  ON period_unlock_requests FOR SELECT TO authenticated USING (TRUE);

-- writes: leave open to authenticated for now (matches project's existing
-- pattern; role-gating lives client-side via permissions.ts). Tighten later
-- if needed.
DROP POLICY IF EXISTS accounting_periods_write          ON accounting_periods;
DROP POLICY IF EXISTS accounting_period_snapshots_write ON accounting_period_snapshots;
DROP POLICY IF EXISTS period_unlock_requests_write      ON period_unlock_requests;

CREATE POLICY accounting_periods_write
  ON accounting_periods FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY accounting_period_snapshots_write
  ON accounting_period_snapshots FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY period_unlock_requests_write
  ON period_unlock_requests FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
