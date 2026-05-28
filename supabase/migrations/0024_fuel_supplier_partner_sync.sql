-- Sync fuel suppliers with the partners registry, and add an FK from
-- fuel_stock to its matching expense_header so buying fuel is a single
-- entry that updates both inventory and AP at once (no more 2-place data
-- entry / double-count risk).

-- 1) Link fuel_stock → expense_header (nullable; legacy/standalone rows
--    such as 'ยอดยกมา' opening balances stay untouched).
ALTER TABLE public.fuel_stock
  ADD COLUMN IF NOT EXISTS expense_header_id TEXT
    REFERENCES public.expense_headers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fuel_stock_expense_header
  ON public.fuel_stock(expense_header_id);

-- 2) Seed the four common Thai fuel suppliers as partners. Idempotent —
--    later migrations / user edits won't be overwritten. New suppliers
--    are added through the FuelStockDashboard "+ เพิ่มผู้จำหน่ายใหม่"
--    flow, which inserts into this same table.
INSERT INTO public.partners (code, name, type, status)
VALUES
  ('FUEL-001', 'บริษัท ปตท.',    'ซัพพลายเออร์น้ำมัน', 'active'),
  ('FUEL-002', 'บริษัท บางจาก',  'ซัพพลายเออร์น้ำมัน', 'active'),
  ('FUEL-003', 'บริษัท เชลล์',   'ซัพพลายเออร์น้ำมัน', 'active'),
  ('FUEL-004', 'บริษัท เอสโซ่',  'ซัพพลายเออร์น้ำมัน', 'active')
ON CONFLICT DO NOTHING;
