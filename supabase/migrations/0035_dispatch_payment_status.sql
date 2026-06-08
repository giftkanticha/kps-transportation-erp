-- Customer payment follow-up — fully decoupled from round_status.
-- A round can be CLOSED (operationally done) while payment_status is still
-- 'unpaid'. The dashboard surfaces unpaid/overdue rounds so AR isn't forgotten.
-- Closing a round must NEVER read or require these fields.
ALTER TABLE dispatch
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
  ADD COLUMN IF NOT EXISTS amount_paid    NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_at        TEXT;

-- Speeds up the "outstanding receivables" dashboard feed.
CREATE INDEX IF NOT EXISTS dispatch_payment_status_idx
  ON dispatch(payment_status) WHERE payment_status <> 'paid';
