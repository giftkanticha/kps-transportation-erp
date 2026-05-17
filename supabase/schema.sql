-- KPS Transportation ERP — Supabase Schema
-- Run this in the Supabase SQL editor to initialise your project.

-- ─── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  email       TEXT        NOT NULL UNIQUE,
  name        TEXT        NOT NULL,
  role        TEXT        NOT NULL CHECK (role IN ('admin', 'manager', 'driver')),
  avatar      TEXT        NOT NULL DEFAULT '',
  phone       TEXT        NOT NULL DEFAULT '',
  title       TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users visible to authenticated" ON users
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─── Employees ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
  id               TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  code             TEXT        NOT NULL UNIQUE,
  name             TEXT        NOT NULL,
  position         TEXT        NOT NULL DEFAULT '',
  license          TEXT        NOT NULL DEFAULT '',
  license_status   TEXT        NOT NULL DEFAULT 'ok' CHECK (license_status IN ('ok', 'warning', 'expired')),
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
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees visible to authenticated" ON employees
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─── Vehicles ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicles (
  id                TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  plate             TEXT        NOT NULL UNIQUE,
  type              TEXT        NOT NULL DEFAULT '',
  brand             TEXT        NOT NULL DEFAULT '',
  year              INTEGER     NOT NULL DEFAULT 2000,
  status            TEXT        NOT NULL DEFAULT 'available'
                                CHECK (status IN ('available', 'on-trip', 'maintenance', 'warning')),
  driver_id         TEXT        REFERENCES employees(id) ON DELETE SET NULL,
  odometer          NUMERIC     NOT NULL DEFAULT 0,
  next_service_km   NUMERIC     NOT NULL DEFAULT 0,
  fuel              NUMERIC     NOT NULL DEFAULT 0,
  last_service      TEXT        NOT NULL DEFAULT '',
  next_service      TEXT        NOT NULL DEFAULT '',
  purchase_date     TEXT        NOT NULL DEFAULT '',
  tax               TEXT        NOT NULL DEFAULT '',
  insurance         TEXT        NOT NULL DEFAULT '',
  dispatch_permit   TEXT        NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vehicles visible to authenticated" ON vehicles
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─── Customers ────────────────────────────────────────────────────────────────
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

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers visible to authenticated" ON customers
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─── Subcontractors ───────────────────────────────────────────────────────────
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

ALTER TABLE subcontractors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Subcontractors visible to authenticated" ON subcontractors
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─── Dispatch ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dispatch (
  id                TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  code              TEXT        NOT NULL UNIQUE,
  customer_id       TEXT        NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  driver_id         TEXT        REFERENCES employees(id) ON DELETE SET NULL,
  vehicle_id        TEXT        REFERENCES vehicles(id) ON DELETE SET NULL,
  subcontractor_id  TEXT        REFERENCES subcontractors(id) ON DELETE SET NULL,
  date              TEXT        NOT NULL,
  depart            TEXT        NOT NULL DEFAULT '',
  eta               TEXT        NOT NULL DEFAULT '',
  status            TEXT        NOT NULL DEFAULT 'scheduled'
                                CHECK (status IN ('scheduled', 'in-progress', 'completed', 'cancelled')),
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
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE dispatch ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dispatch visible to authenticated" ON dispatch
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─── Dispatch Legs ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dispatch_legs (
  id           TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  dispatch_id  TEXT        NOT NULL REFERENCES dispatch(id) ON DELETE CASCADE,
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  origin       TEXT        NOT NULL DEFAULT '',
  destination  TEXT        NOT NULL DEFAULT '',
  cargo        TEXT        NOT NULL DEFAULT '',
  cargo_type   TEXT        NOT NULL DEFAULT '',
  price_mode   TEXT        NOT NULL DEFAULT 'lump'
               CHECK (price_mode IN ('per_ton', 'per_kg', 'lump')),
  weight       NUMERIC     NOT NULL DEFAULT 0,
  price        NUMERIC     NOT NULL DEFAULT 0,
  amount       NUMERIC     NOT NULL DEFAULT 0
);

ALTER TABLE dispatch_legs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dispatch legs visible to authenticated" ON dispatch_legs
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─── Maintenance ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS maintenance (
  id          TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  code        TEXT        NOT NULL UNIQUE,
  vehicle_id  TEXT        NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  type        TEXT        NOT NULL DEFAULT '',
  workshop    TEXT        NOT NULL DEFAULT '',
  partner_id  TEXT,
  status      TEXT        NOT NULL DEFAULT 'scheduled',
  cost        NUMERIC     NOT NULL DEFAULT 0,
  start_date  TEXT        NOT NULL DEFAULT '',
  end_date    TEXT,
  odometer    NUMERIC     NOT NULL DEFAULT 0,
  items       TEXT[]      NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE maintenance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Maintenance visible to authenticated" ON maintenance
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─── Tires ────────────────────────────────────────────────────────────────────
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
                       CHECK (status IN ('in-use', 'spare', 'stock', 'sold')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tires visible to authenticated" ON tires
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─── Tire Events ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tire_events (
  id          TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  tire_id     TEXT        NOT NULL REFERENCES tires(id) ON DELETE CASCADE,
  vehicle_id  TEXT        NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  event_type  TEXT        NOT NULL CHECK (event_type IN ('install', 'swap', 'remove', 'sell')),
  date        TEXT        NOT NULL,
  odometer    NUMERIC     NOT NULL DEFAULT 0,
  from_pos    TEXT,
  to_pos      TEXT,
  note        TEXT        NOT NULL DEFAULT '',
  user_id     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tire_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tire events visible to authenticated" ON tire_events
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─── Fuel Records ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fuel_records (
  id           TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  code         TEXT        NOT NULL UNIQUE,
  vehicle_id   TEXT        NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  driver_id    TEXT        NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  station      TEXT        NOT NULL DEFAULT '',
  liters       NUMERIC     NOT NULL DEFAULT 0,
  price_per_l  NUMERIC     NOT NULL DEFAULT 0,
  total        NUMERIC     NOT NULL DEFAULT 0,
  odometer     NUMERIC     NOT NULL DEFAULT 0,
  date         TEXT        NOT NULL,
  type         TEXT        NOT NULL DEFAULT 'diesel',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE fuel_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fuel records visible to authenticated" ON fuel_records
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─── Fuel Stock ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fuel_stock (
  id           TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  date         TEXT        NOT NULL,
  supplier     TEXT        NOT NULL DEFAULT '',
  liters       NUMERIC     NOT NULL DEFAULT 0,
  price_per_l  NUMERIC     NOT NULL DEFAULT 0,
  invoice_no   TEXT        NOT NULL DEFAULT '',
  total        NUMERIC     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE fuel_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fuel stock visible to authenticated" ON fuel_stock
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─── Expenses ─────────────────────────────────────────────────────────────────
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
  partner_id  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Expenses visible to authenticated" ON expenses
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─── Expense Headers ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expense_headers (
  id          TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  code        TEXT        NOT NULL UNIQUE,
  date        TEXT        NOT NULL,
  vehicle_id  TEXT        NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  partner_id  TEXT        NOT NULL,
  odometer    NUMERIC     NOT NULL DEFAULT 0,
  paid        BOOLEAN     NOT NULL DEFAULT FALSE,
  due_date    TEXT        NOT NULL DEFAULT '',
  total       NUMERIC     NOT NULL DEFAULT 0,
  line_count  INTEGER     NOT NULL DEFAULT 0,
  note        TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE expense_headers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Expense headers visible to authenticated" ON expense_headers
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─── Expense Lines ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expense_lines (
  id          TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  header_id   TEXT        NOT NULL REFERENCES expense_headers(id) ON DELETE CASCADE,
  invoice_no  TEXT        NOT NULL DEFAULT '',
  item        TEXT        NOT NULL DEFAULT '',
  category    TEXT        NOT NULL DEFAULT '',
  qty         NUMERIC     NOT NULL DEFAULT 1,
  unit_price  NUMERIC     NOT NULL DEFAULT 0,
  amount      NUMERIC     NOT NULL DEFAULT 0,
  note        TEXT        NOT NULL DEFAULT ''
);

ALTER TABLE expense_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Expense lines visible to authenticated" ON expense_lines
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─── Stock Items ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_items (
  id          TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  code        TEXT        NOT NULL UNIQUE,
  name        TEXT        NOT NULL,
  category    TEXT        NOT NULL DEFAULT '',
  "in"        NUMERIC     NOT NULL DEFAULT 0,
  "out"       NUMERIC     NOT NULL DEFAULT 0,
  qty         NUMERIC     NOT NULL DEFAULT 0,
  unit        TEXT        NOT NULL DEFAULT '',
  unit_cost   NUMERIC     NOT NULL DEFAULT 0,
  reorder_at  NUMERIC     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stock items visible to authenticated" ON stock_items
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─── Fixed Costs ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fixed_costs (
  id          TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  name        TEXT        NOT NULL,
  category    TEXT        NOT NULL DEFAULT '',
  monthly     NUMERIC     NOT NULL DEFAULT 0,
  paid        BOOLEAN     NOT NULL DEFAULT FALSE,
  vehicle_id  TEXT        REFERENCES vehicles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE fixed_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fixed costs visible to authenticated" ON fixed_costs
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─── Partners ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS partners (
  id          TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  code        TEXT        NOT NULL UNIQUE,
  name        TEXT        NOT NULL,
  type        TEXT        NOT NULL DEFAULT '',
  contact     TEXT        NOT NULL DEFAULT '',
  phone       TEXT        NOT NULL DEFAULT '',
  bank        TEXT        NOT NULL DEFAULT '',
  account     TEXT        NOT NULL DEFAULT '',
  tax_id      TEXT        NOT NULL DEFAULT '',
  balance     NUMERIC     NOT NULL DEFAULT 0,
  status      TEXT        NOT NULL DEFAULT 'active',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners visible to authenticated" ON partners
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─── Sub Drivers ──────────────────────────────────────────────────────────────
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
  sub_id          TEXT        NOT NULL REFERENCES subcontractors(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sub_drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sub drivers visible to authenticated" ON sub_drivers
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─── Sub Jobs ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sub_jobs (
  id           TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  code         TEXT        NOT NULL UNIQUE,
  date         TEXT        NOT NULL,
  sub_id       TEXT        NOT NULL REFERENCES subcontractors(id) ON DELETE RESTRICT,
  plate        TEXT        NOT NULL DEFAULT '',
  driver_name  TEXT        NOT NULL DEFAULT '',
  destination  TEXT        NOT NULL DEFAULT '',
  origin       TEXT        NOT NULL DEFAULT '',
  weight       NUMERIC     NOT NULL DEFAULT 0,
  mode         TEXT        NOT NULL DEFAULT 'lump',
  price        NUMERIC     NOT NULL DEFAULT 0,
  total        NUMERIC     NOT NULL DEFAULT 0,
  status       TEXT        NOT NULL DEFAULT 'open',
  bank         TEXT        NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sub_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sub jobs visible to authenticated" ON sub_jobs
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─── Activity Logs ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
  id          TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  at          TEXT        NOT NULL,
  who         TEXT        NOT NULL DEFAULT '',
  text        TEXT        NOT NULL DEFAULT '',
  type        TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Activity logs visible to authenticated" ON activity_logs
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─── Demo seed users ──────────────────────────────────────────────────────────
-- These match the 3 built-in demo accounts used in localStorage mode.
-- Passwords are handled by Supabase Auth; these rows store app-level profile data.

INSERT INTO users (id, email, name, role, avatar, phone, title) VALUES
  ('u1', 'admin@kps.com',    'สมชาย ใจดี',     'admin',   'สม', '081-234-5678', 'ผู้ดูแลระบบ'),
  ('u2', 'manager@kps.com',  'Pranee Saetang', 'manager', 'PR', '082-345-6789', 'ผู้จัดการขนส่ง'),
  ('u3', 'employee@kps.com', 'วิชัย ขับดี',     'driver',  'วช', '086-789-0123', 'พนักงานขับรถ')
ON CONFLICT (id) DO NOTHING;
