-- Employees (driver role) need to see operational tables (rounds, legs, fuel
-- entries) for their day-to-day work. Money columns are hidden in the UI
-- instead — so the driver app shows trips and legs but no revenue / AP / cost
-- numbers.
--
-- expense_headers / expense_lines stay manager+ only because the whole
-- 'ค่าใช้จ่าย' menu is already blocked for non-managers via canAccessRoute,
-- so loosening their RLS would have no useful effect and would leak data.

DROP POLICY IF EXISTS dispatch_select          ON public.dispatch;
DROP POLICY IF EXISTS dispatch_legs_select     ON public.dispatch_legs;
DROP POLICY IF EXISTS fuel_records_select      ON public.fuel_records;
DROP POLICY IF EXISTS fuel_transactions_select ON public.fuel_transactions;
DROP POLICY IF EXISTS fuel_rounds_select       ON public.fuel_rounds;
DROP POLICY IF EXISTS fuel_stock_select        ON public.fuel_stock;

CREATE POLICY dispatch_select          ON public.dispatch          FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY dispatch_legs_select     ON public.dispatch_legs     FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY fuel_records_select      ON public.fuel_records      FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY fuel_transactions_select ON public.fuel_transactions FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY fuel_rounds_select       ON public.fuel_rounds       FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY fuel_stock_select        ON public.fuel_stock        FOR SELECT TO authenticated USING (TRUE);
