-- The Express Fuel Log + FuelStockDashboard "+ เพิ่มผู้จำหน่ายใหม่" flow
-- and the ExpensesModule "+ เพิ่มคู่ค้าใหม่" inline form need to work for any
-- authenticated user (drivers add the supplier they just bought from). UPDATE
-- and DELETE stay manager+ / admin since editing a shared registry is more
-- sensitive than adding a new row.

DROP POLICY IF EXISTS partners_write ON public.partners;
CREATE POLICY partners_write ON public.partners
  FOR INSERT TO authenticated WITH CHECK (TRUE);
