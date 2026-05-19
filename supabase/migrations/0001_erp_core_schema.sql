-- Phase 0 migration: ERP core schema (28 tables)
-- Applied via Supabase MCP on 2026-05-19. Mirrored here for repo reproducibility.
-- Differs from legacy supabase/schema.sql: circular FK fix (employees↔vehicles),
-- missing tables added (tire_scrap_sales, fuel_rounds, fuel_transactions,
-- task_completions, edit_approvals, stock_receipts, vehicle_registrations,
-- request_approvals), JSONB columns for nested data.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Vehicles (create first, no FK yet) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicles (
  id                TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  plate             TEXT        NOT NULL UNIQUE,
  type              TEXT        NOT NULL DEFAULT '',
  brand             TEXT        NOT NULL DEFAULT '',
  year              INTEGER     NOT NULL DEFAULT 2000,
  status            TEXT        NOT NULL DEFAULT 'available'
                                CHECK (status IN ('available','on-trip','maintenance','warning')),
  driver_id         TEXT,
  odometer          NUMERIC     NOT NULL DEFAULT 0,
  next_service_km   NUMERIC     NOT NULL DEFAULT 0,
  fuel              NUMERIC     NOT NULL DEFAULT 0,
  last_service      TEXT        NOT NULL DEFAULT '',
  next_service      TEXT        NOT NULL DEFAULT '',
  purchase_date     TEXT        NOT NULL DEFAULT '',
  tax               TEXT        NOT NULL DEFAULT '',
  insurance         TEXT        NOT NULL DEFAULT '',
  dispatch_permit   TEXT        NOT NULL DEFAULT '',
  group_kind        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employees (
  id               TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  code             TEXT        NOT NULL UNIQUE,
  name             TEXT        NOT NULL,
  position         TEXT        NOT NULL DEFAULT '',
  license          TEXT        NOT NULL DEFAULT '',
  license_status   TEXT        NOT NULL DEFAULT 'ok' CHECK (license_status IN ('ok','warning','expired')),
  license_expire   TEXT        NOT NULL DEFAULT '',
  line_id          TEXT        NOT NULL DEFAULT '',
  phone            TEXT        NOT NULL DEFAULT '',
  id_card          TEXT        NOT NULL DEFAULT '',
  account_bank     TEXT        NOT NULL DEFAULT '',
  account_no       TEXT        NOT NULL DEFAULT '',
  joined           TEXT        NOT NULL DEFAULT '',
  salary           NUMERIC     NOT NULL DEFAULT 0,
  vehicle_id       TEXT        REFERENCES vehicles(id) ON DELETE SET NULL,
  status           TEXT        NOT NULL DEFAULT 'active',
  address          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE vehicles
  ADD CONSTRAINT vehicles_driver_id_fkey
  FOREIGN KEY (driver_id) REFERENCES employees(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS customers (
  id            TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  code          TEXT        NOT NULL UNIQUE,
  name          TEXT        NOT NULL,
  contact       TEXT        NOT NULL DEFAULT '',
  phone         TEXT        NOT NULL DEFAULT '',
  credit        INTEGER     NOT NULL DEFAULT 30,
  total_jobs    INTEGER     NOT NULL DEFAULT 0,
  open_invoice  NUMERIC     NOT NULL DEFAULT 0,
  status        TEXT        NOT NULL DEFAULT 'active',
  industry      TEXT        NOT NULL DEFAULT '',
  since         TEXT        NOT NULL DEFAULT '',
  address       TEXT        NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subcontractors (
  id          TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  code        TEXT        NOT NULL UNIQUE,
  name        TEXT        NOT NULL,
  contact     TEXT        NOT NULL DEFAULT '',
  phone       TEXT        NOT NULL DEFAULT '',
  vehicles    INTEGER     NOT NULL DEFAULT 0,
  rating      NUMERIC     NOT NULL DEFAULT 0,
  open_jobs   INTEGER     NOT NULL DEFAULT 0,
  total_paid  NUMERIC     NOT NULL DEFAULT 0,
  status      TEXT        NOT NULL DEFAULT 'active',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS partners (
  id           TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  code         TEXT        NOT NULL UNIQUE,
  name         TEXT        NOT NULL,
  type         TEXT        NOT NULL DEFAULT '',
  contact      TEXT        NOT NULL DEFAULT '',
  phone        TEXT        NOT NULL DEFAULT '',
  address      TEXT        NOT NULL DEFAULT '',
  bank         TEXT        NOT NULL DEFAULT '',
  account      TEXT        NOT NULL DEFAULT '',
  account_name TEXT        NOT NULL DEFAULT '',
  tax_id       TEXT        NOT NULL DEFAULT '',
  balance      NUMERIC     NOT NULL DEFAULT 0,
  status       TEXT        NOT NULL DEFAULT 'active',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dispatch (
  id                TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  code              TEXT        NOT NULL UNIQUE,
  customer_id       TEXT        REFERENCES customers(id) ON DELETE RESTRICT,
  driver_id         TEXT        REFERENCES employees(id) ON DELETE SET NULL,
  vehicle_id        TEXT        REFERENCES vehicles(id) ON DELETE SET NULL,
  subcontractor_id  TEXT        REFERENCES subcontractors(id) ON DELETE SET NULL,
  date              TEXT        NOT NULL,
  depart            TEXT        NOT NULL DEFAULT '',
  eta               TEXT        NOT NULL DEFAULT '',
  status            TEXT        NOT NULL DEFAULT 'scheduled'
                                CHECK (status IN ('scheduled','in-progress','completed','cancelled')),
  progress          INTEGER     NOT NULL DEFAULT 0,
  start_odometer    NUMERIC,
  end_odometer      NUMERIC,
  distance          NUMERIC,
  liters            NUMERIC,
  km_per_l          NUMERIC,
  per_diem          NUMERIC,
  notes             TEXT        NOT NULL DEFAULT '',
  total_amount      NUMERIC     NOT NULL DEFAULT 0,
  revenue           NUMERIC     NOT NULL DEFAULT 0,
  cost              NUMERIC     NOT NULL DEFAULT 0,
  round_status      TEXT,
  return_at         TEXT,
  other_expenses    JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dispatch_legs (
  id                TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  dispatch_id       TEXT        NOT NULL REFERENCES dispatch(id) ON DELETE CASCADE,
  sort_order        INTEGER     NOT NULL DEFAULT 0,
  customer_id       TEXT        REFERENCES customers(id) ON DELETE SET NULL,
  leg_type          TEXT,
  origin            TEXT        NOT NULL DEFAULT '',
  destination       TEXT        NOT NULL DEFAULT '',
  cargo             TEXT        NOT NULL DEFAULT '',
  cargo_type        TEXT        NOT NULL DEFAULT '',
  price_mode        TEXT        NOT NULL DEFAULT 'lump'
                                CHECK (price_mode IN ('per_ton','per_kg','lump')),
  weight            NUMERIC     NOT NULL DEFAULT 0,
  delivered_weight  NUMERIC,
  price             NUMERIC     NOT NULL DEFAULT 0,
  amount            NUMERIC     NOT NULL DEFAULT 0,
  per_diem          NUMERIC,
  notes             TEXT,
  closed            BOOLEAN
);

CREATE TABLE IF NOT EXISTS maintenance (
  id          TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  code        TEXT        NOT NULL UNIQUE,
  vehicle_id  TEXT        NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  type        TEXT        NOT NULL DEFAULT '',
  workshop    TEXT        NOT NULL DEFAULT '',
  partner_id  TEXT        REFERENCES partners(id) ON DELETE SET NULL,
  status      TEXT        NOT NULL DEFAULT 'scheduled',
  cost        NUMERIC     NOT NULL DEFAULT 0,
  start_date  TEXT        NOT NULL DEFAULT '',
  end_date    TEXT,
  odometer    NUMERIC     NOT NULL DEFAULT 0,
  items       TEXT[]      NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tires (
  id                   TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  serial               TEXT        NOT NULL UNIQUE,
  brand                TEXT        NOT NULL DEFAULT '',
  model                TEXT        NOT NULL DEFAULT '',
  size                 TEXT        NOT NULL DEFAULT '',
  vehicle_id           TEXT        REFERENCES vehicles(id) ON DELETE SET NULL,
  position             TEXT,
  installed_date       TEXT        NOT NULL DEFAULT '',
  installed_odometer   NUMERIC     NOT NULL DEFAULT 0,
  accumulated_km       NUMERIC     NOT NULL DEFAULT 0,
  status               TEXT        NOT NULL DEFAULT 'stock'
                       CHECK (status IN ('in-use','spare','stock','sold','scrapped')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tire_events (
  id          TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  tire_id     TEXT        NOT NULL REFERENCES tires(id) ON DELETE CASCADE,
  vehicle_id  TEXT        REFERENCES vehicles(id) ON DELETE SET NULL,
  event_type  TEXT        NOT NULL CHECK (event_type IN ('install','swap','remove','sell','scrap')),
  date        TEXT        NOT NULL,
  odometer    NUMERIC     NOT NULL DEFAULT 0,
  from_pos    TEXT,
  to_pos      TEXT,
  note        TEXT        NOT NULL DEFAULT '',
  user_id     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tire_scrap_sales (
  id          TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  tire_id     TEXT        NOT NULL REFERENCES tires(id) ON DELETE CASCADE,
  serial      TEXT        NOT NULL DEFAULT '',
  buyer       TEXT        NOT NULL DEFAULT '',
  price       NUMERIC     NOT NULL DEFAULT 0,
  date        TEXT        NOT NULL,
  user_id     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fuel_records (
  id           TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  code         TEXT        NOT NULL UNIQUE,
  vehicle_id   TEXT        REFERENCES vehicles(id) ON DELETE SET NULL,
  driver_id    TEXT        REFERENCES employees(id) ON DELETE SET NULL,
  station      TEXT        NOT NULL DEFAULT '',
  liters       NUMERIC     NOT NULL DEFAULT 0,
  price_per_l  NUMERIC     NOT NULL DEFAULT 0,
  total        NUMERIC     NOT NULL DEFAULT 0,
  odometer     NUMERIC     NOT NULL DEFAULT 0,
  date         TEXT        NOT NULL,
  type         TEXT        NOT NULL DEFAULT 'diesel',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fuel_stock (
  id           TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date         TEXT        NOT NULL,
  recorded_at  TIMESTAMPTZ,
  supplier     TEXT        NOT NULL DEFAULT '',
  liters       NUMERIC     NOT NULL DEFAULT 0,
  price_per_l  NUMERIC     NOT NULL DEFAULT 0,
  invoice_no   TEXT        NOT NULL DEFAULT '',
  total        NUMERIC     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fuel_rounds (
  id                  TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  code                TEXT        NOT NULL UNIQUE,
  vehicle_id          TEXT        REFERENCES vehicles(id) ON DELETE SET NULL,
  dispatch_round_id   TEXT,
  tank_capacity       NUMERIC     NOT NULL DEFAULT 500,
  status              TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  refills             JSONB       NOT NULL DEFAULT '[]',
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fuel_transactions (
  id              TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date            TEXT        NOT NULL,
  vehicle_id      TEXT        REFERENCES vehicles(id) ON DELETE SET NULL,
  liters          NUMERIC     NOT NULL DEFAULT 0,
  price_per_l     NUMERIC     NOT NULL DEFAULT 0,
  total           NUMERIC     NOT NULL DEFAULT 0,
  source          TEXT        NOT NULL CHECK (source IN ('FACTORY_TANK','EXTERNAL_PUMP')),
  trip_id         TEXT        REFERENCES dispatch(id) ON DELETE SET NULL,
  status          TEXT        NOT NULL CHECK (status IN ('INTERNAL_DEDUCTED','TRIP_LINKED','FLOATING','REVERSED')),
  trip_fuel_role  TEXT        NOT NULL CHECK (trip_fuel_role IN ('NORMAL','TRIP_OPENING','INTERMEDIATE','TRIP_CLOSING')),
  entry_method    TEXT        NOT NULL CHECK (entry_method IN ('EXPRESS_GRID','TRIP_OPEN','TRIP_REFILL','TRIP_CLOSE','MANUAL_ADMIN')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reversed_at     TIMESTAMPTZ,
  reversal_of     TEXT,
  note            TEXT
);

CREATE TABLE IF NOT EXISTS expenses (
  id          TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  code        TEXT        NOT NULL UNIQUE,
  vehicle_id  TEXT        REFERENCES vehicles(id) ON DELETE SET NULL,
  category    TEXT        NOT NULL DEFAULT '',
  note        TEXT        NOT NULL DEFAULT '',
  amount      NUMERIC     NOT NULL DEFAULT 0,
  paid_by     TEXT        NOT NULL DEFAULT '',
  date        TEXT        NOT NULL,
  driver_id   TEXT        REFERENCES employees(id) ON DELETE SET NULL,
  status      TEXT        NOT NULL DEFAULT 'pending',
  partner_id  TEXT        REFERENCES partners(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expense_headers (
  id          TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  code        TEXT        NOT NULL UNIQUE,
  date        TEXT        NOT NULL,
  vehicle_id  TEXT        REFERENCES vehicles(id) ON DELETE SET NULL,
  partner_id  TEXT        REFERENCES partners(id) ON DELETE SET NULL,
  odometer    NUMERIC     NOT NULL DEFAULT 0,
  paid        BOOLEAN     NOT NULL DEFAULT FALSE,
  due_date    TEXT        NOT NULL DEFAULT '',
  total       NUMERIC     NOT NULL DEFAULT 0,
  line_count  INTEGER     NOT NULL DEFAULT 0,
  note        TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expense_lines (
  id             TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  header_id      TEXT        NOT NULL REFERENCES expense_headers(id) ON DELETE CASCADE,
  invoice_no     TEXT        NOT NULL DEFAULT '',
  item           TEXT        NOT NULL DEFAULT '',
  category       TEXT        NOT NULL DEFAULT '',
  qty            NUMERIC     NOT NULL DEFAULT 1,
  unit_price     NUMERIC     NOT NULL DEFAULT 0,
  amount         NUMERIC     NOT NULL DEFAULT 0,
  note           TEXT        NOT NULL DEFAULT '',
  stock_item_id  TEXT
);

CREATE TABLE IF NOT EXISTS stock_items (
  id          TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  code        TEXT        NOT NULL UNIQUE,
  name        TEXT        NOT NULL,
  category    TEXT        NOT NULL DEFAULT '',
  qty_in      NUMERIC     NOT NULL DEFAULT 0,
  qty_out     NUMERIC     NOT NULL DEFAULT 0,
  qty         NUMERIC     NOT NULL DEFAULT 0,
  unit        TEXT        NOT NULL DEFAULT '',
  unit_cost   NUMERIC     NOT NULL DEFAULT 0,
  sell_price  NUMERIC,
  reorder_at  NUMERIC     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_receipts (
  id            TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date          TEXT        NOT NULL,
  partner_id    TEXT        REFERENCES partners(id) ON DELETE SET NULL,
  stock_item_id TEXT        REFERENCES stock_items(id) ON DELETE SET NULL,
  qty           NUMERIC     NOT NULL DEFAULT 0,
  unit_price    NUMERIC     NOT NULL DEFAULT 0,
  total         NUMERIC     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fixed_costs (
  id          TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  name        TEXT        NOT NULL,
  category    TEXT        NOT NULL DEFAULT '',
  monthly     NUMERIC     NOT NULL DEFAULT 0,
  paid        BOOLEAN     NOT NULL DEFAULT FALSE,
  vehicle_id  TEXT        REFERENCES vehicles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sub_drivers (
  id              TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  code            TEXT        NOT NULL UNIQUE,
  name            TEXT        NOT NULL,
  plate           TEXT        NOT NULL DEFAULT '',
  phone           TEXT        NOT NULL DEFAULT '',
  id_card         TEXT        NOT NULL DEFAULT '',
  license         TEXT        NOT NULL DEFAULT '',
  license_expire  TEXT        NOT NULL DEFAULT '',
  license_status  TEXT        NOT NULL DEFAULT 'ok',
  account_bank    TEXT        NOT NULL DEFAULT '',
  account_no      TEXT        NOT NULL DEFAULT '',
  status          TEXT        NOT NULL DEFAULT 'active',
  sub_id          TEXT        REFERENCES subcontractors(id) ON DELETE SET NULL,
  address         TEXT,
  vehicle_types   TEXT[],
  truck_dump      TEXT,
  cp_access       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sub_jobs (
  id            TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  code          TEXT        NOT NULL UNIQUE,
  date          TEXT        NOT NULL,
  sub_id        TEXT        REFERENCES subcontractors(id) ON DELETE SET NULL,
  driver_id     TEXT        REFERENCES sub_drivers(id) ON DELETE SET NULL,
  plate         TEXT        NOT NULL DEFAULT '',
  driver_name   TEXT        NOT NULL DEFAULT '',
  category      TEXT        NOT NULL DEFAULT '',
  destination   TEXT        NOT NULL DEFAULT '',
  origin        TEXT        NOT NULL DEFAULT '',
  weight        NUMERIC     NOT NULL DEFAULT 0,
  final_weight  NUMERIC     NOT NULL DEFAULT 0,
  mode          TEXT        NOT NULL DEFAULT 'lump',
  price         NUMERIC     NOT NULL DEFAULT 0,
  total         NUMERIC     NOT NULL DEFAULT 0,
  status        TEXT        NOT NULL DEFAULT 'open',
  bank          TEXT        NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id          TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  at          TEXT        NOT NULL,
  who         TEXT        NOT NULL DEFAULT '',
  text        TEXT        NOT NULL DEFAULT '',
  type        TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_completions (
  id                     TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  alert_kind             TEXT        NOT NULL CHECK (alert_kind IN ('tax','permit','insurance','mileage','repair')),
  vehicle_id             TEXT        REFERENCES vehicles(id) ON DELETE CASCADE,
  vehicle_plate          TEXT        NOT NULL DEFAULT '',
  completed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id                TEXT        NOT NULL,
  next_date              TEXT        NOT NULL DEFAULT '',
  next_mileage           NUMERIC,
  next_maintenance_date  TEXT        NOT NULL DEFAULT '',
  note                   TEXT        NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS edit_approvals (
  id                TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  requester_id      TEXT        NOT NULL,
  requester_name    TEXT        NOT NULL DEFAULT '',
  requester_role    TEXT        NOT NULL,
  vehicle_id        TEXT        REFERENCES vehicles(id) ON DELETE CASCADE,
  vehicle_plate     TEXT        NOT NULL DEFAULT '',
  reason            TEXT        NOT NULL DEFAULT '',
  changes           JSONB       NOT NULL DEFAULT '{}',
  change_fields     JSONB       NOT NULL DEFAULT '[]',
  requested_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status            TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewer_id       TEXT,
  reviewer_name     TEXT,
  reviewed_at       TIMESTAMPTZ,
  review_note       TEXT        NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS vehicle_registrations (
  id          TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  data        JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS request_approvals (
  id          TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  data        JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
