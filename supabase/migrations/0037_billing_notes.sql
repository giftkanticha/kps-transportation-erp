-- Billing notes (ใบวางบิล) / receipts (ใบเสร็จ) — month-end customer documents.
-- User selects which closed dispatch rounds to include (dispatch_ids). gross/wht/net
-- are snapshotted at issue time. status flips to 'paid' when collected, which also
-- marks the linked dispatch rows paid (handled in the app).
CREATE TABLE IF NOT EXISTS billing_notes (
  id              TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  code            TEXT        NOT NULL UNIQUE,            -- เช่น BN-2026-06-0001
  doc_type        TEXT        NOT NULL DEFAULT 'billing_note'
                              CHECK (doc_type IN ('billing_note', 'receipt')),
  customer_id     TEXT        REFERENCES customers(id) ON DELETE RESTRICT,
  customer_name   TEXT        NOT NULL DEFAULT '',        -- snapshot
  year            INTEGER     NOT NULL,
  month           INTEGER     NOT NULL CHECK (month BETWEEN 1 AND 12),
  bank_account_id TEXT        REFERENCES company_bank_accounts(id) ON DELETE SET NULL,
  gross           NUMERIC     NOT NULL DEFAULT 0,
  wht_amount      NUMERIC     NOT NULL DEFAULT 0,
  net             NUMERIC     NOT NULL DEFAULT 0,
  dispatch_ids    JSONB       NOT NULL DEFAULT '[]',      -- รอบงานที่ติ๊กเลือกเข้าบิลนี้
  status          TEXT        NOT NULL DEFAULT 'issued'
                              CHECK (status IN ('issued', 'paid', 'void')),
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at         TEXT,
  notes           TEXT        NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS billing_notes_customer_idx ON billing_notes(customer_id);
CREATE INDEX IF NOT EXISTS billing_notes_period_idx   ON billing_notes(year, month);

ALTER TABLE billing_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS billing_notes_read  ON billing_notes;
DROP POLICY IF EXISTS billing_notes_write ON billing_notes;
CREATE POLICY billing_notes_read
  ON billing_notes FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY billing_notes_write
  ON billing_notes FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
