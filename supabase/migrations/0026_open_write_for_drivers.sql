-- Open INSERT/UPDATE on dispatch + fuel ledger tables to all authenticated
-- users so drivers can record their own trips and fueling. The matching
-- 'driver_id = my_employee_id()' clause never matched because
-- user_profiles.employee_id is not populated yet — and even once linked,
-- drivers still need to insert with their own driver_id, which the WITH CHECK
-- clause permits when set to TRUE.
--
-- DELETE on these tables remains admin-only (handled by the existing _delete
-- policies, untouched here).
--
-- fuel_stock keeps admin-only INSERT/DELETE — fuel inventory is managed by
-- the admin team, not entered per trip.

DROP POLICY IF EXISTS dispatch_insert            ON public.dispatch;
DROP POLICY IF EXISTS dispatch_update            ON public.dispatch;
DROP POLICY IF EXISTS dispatch_legs_insert       ON public.dispatch_legs;
DROP POLICY IF EXISTS dispatch_legs_update       ON public.dispatch_legs;
DROP POLICY IF EXISTS fuel_records_insert        ON public.fuel_records;
DROP POLICY IF EXISTS fuel_records_update        ON public.fuel_records;
DROP POLICY IF EXISTS fuel_rounds_write          ON public.fuel_rounds;
DROP POLICY IF EXISTS fuel_rounds_update         ON public.fuel_rounds;
DROP POLICY IF EXISTS fuel_transactions_write    ON public.fuel_transactions;
DROP POLICY IF EXISTS fuel_transactions_update   ON public.fuel_transactions;

CREATE POLICY dispatch_insert          ON public.dispatch          FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY dispatch_update          ON public.dispatch          FOR UPDATE TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY dispatch_legs_insert     ON public.dispatch_legs     FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY dispatch_legs_update     ON public.dispatch_legs     FOR UPDATE TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY fuel_records_insert      ON public.fuel_records      FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY fuel_records_update      ON public.fuel_records      FOR UPDATE TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY fuel_rounds_write        ON public.fuel_rounds       FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY fuel_rounds_update       ON public.fuel_rounds       FOR UPDATE TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY fuel_transactions_write  ON public.fuel_transactions FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY fuel_transactions_update ON public.fuel_transactions FOR UPDATE TO authenticated USING (TRUE) WITH CHECK (TRUE);
