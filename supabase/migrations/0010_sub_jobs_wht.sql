-- Optional 1% withholding tax (ภาษีหัก ณ ที่จ่าย) flag per subcontractor job.
-- total stays the gross haulage fee; net = total - (wht ? total*0.01 : 0).
ALTER TABLE sub_jobs ADD COLUMN IF NOT EXISTS wht boolean NOT NULL DEFAULT false;
