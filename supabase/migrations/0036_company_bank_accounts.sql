-- Company bank accounts — printed on the billing note (ใบวางบิล) so customers
-- know where to transfer. Pure lookup/master data.
CREATE TABLE IF NOT EXISTS company_bank_accounts (
  id           TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  bank_name    TEXT        NOT NULL,            -- เช่น กสิกรไทย
  account_no   TEXT        NOT NULL,
  account_name TEXT        NOT NULL,            -- ชื่อบัญชีบริษัท
  branch       TEXT        NOT NULL DEFAULT '',
  is_default   BOOLEAN     NOT NULL DEFAULT FALSE,
  active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE company_bank_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_bank_accounts_read  ON company_bank_accounts;
DROP POLICY IF EXISTS company_bank_accounts_write ON company_bank_accounts;
CREATE POLICY company_bank_accounts_read
  ON company_bank_accounts FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY company_bank_accounts_write
  ON company_bank_accounts FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
