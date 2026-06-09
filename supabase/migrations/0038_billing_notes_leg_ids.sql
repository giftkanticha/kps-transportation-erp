-- Customer linkage is per-LEG (dispatch_legs.customer_id), so billing notes track
-- which legs they cover, not whole rounds. dispatch_ids is left in place but no
-- longer used by the app (billing_notes is empty so nothing to migrate).
ALTER TABLE billing_notes ADD COLUMN IF NOT EXISTS leg_ids JSONB NOT NULL DEFAULT '[]';
