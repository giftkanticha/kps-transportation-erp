-- Customer-side withholding tax (ภาษีหัก ณ ที่จ่าย 1%), per leg.
-- Mirrors the subcontractor precedent (sub_jobs.wht). Applied typically to
-- backhaul/return legs where the customer withholds 1% of the haulage fee.
--
-- amount stays the GROSS haulage fee. wht_amount = wht ? amount*0.01 : 0 and
-- net = amount - wht_amount are computed in the app (db.ts), not stored — so
-- existing revenue/totalAmount aggregates are unaffected. Default false ⇒ every
-- existing leg behaves exactly as before.
ALTER TABLE dispatch_legs ADD COLUMN IF NOT EXISTS wht boolean NOT NULL DEFAULT false;
