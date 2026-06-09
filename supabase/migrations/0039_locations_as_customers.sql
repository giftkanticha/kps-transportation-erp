-- Unify "customer" into the location master: a location can be flagged as a
-- billable customer (e.g. a sand pit / factory we invoice). The bill-to of a leg
-- defaults to its destination location (when that location is_customer) and can
-- be overridden per leg via bill_to_location_id.
ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS is_customer BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS credit      INTEGER NOT NULL DEFAULT 30,   -- เครดิตเทอม (วัน)
  ADD COLUMN IF NOT EXISTS tax_id      TEXT    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone       TEXT    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS contact     TEXT    NOT NULL DEFAULT '';

-- Per-leg / per-note bill-to override (a location flagged is_customer).
ALTER TABLE dispatch_legs ADD COLUMN IF NOT EXISTS bill_to_location_id TEXT REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE billing_notes ADD COLUMN IF NOT EXISTS bill_to_location_id TEXT REFERENCES locations(id) ON DELETE SET NULL;
