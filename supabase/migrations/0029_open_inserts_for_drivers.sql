-- Drivers need to add to the shared registries when they hit them mid-flow
-- (new vehicle, new customer, new subcontractor / sub_driver, new maintenance
-- entry, new stock item). Same shape we adopted for partners / dispatch /
-- fuel: INSERT open to all authenticated, UPDATE manager+, DELETE admin —
-- those policies were already in place and aren't touched here.

DROP POLICY IF EXISTS vehicles_insert       ON public.vehicles;
DROP POLICY IF EXISTS customers_write       ON public.customers;
DROP POLICY IF EXISTS subcontractors_write  ON public.subcontractors;
DROP POLICY IF EXISTS sub_drivers_write     ON public.sub_drivers;
DROP POLICY IF EXISTS maintenance_insert    ON public.maintenance;
DROP POLICY IF EXISTS stock_items_write     ON public.stock_items;

CREATE POLICY vehicles_insert       ON public.vehicles       FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY customers_write       ON public.customers      FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY subcontractors_write  ON public.subcontractors FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY sub_drivers_write     ON public.sub_drivers    FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY maintenance_insert    ON public.maintenance    FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY stock_items_write     ON public.stock_items    FOR INSERT TO authenticated WITH CHECK (TRUE);
