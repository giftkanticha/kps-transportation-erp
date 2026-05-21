-- Phase 1 migration: Trim Realtime publication to only frequently-changed tables.
-- 0002 enabled realtime on all 28 tables — overkill for 3-5 users.
-- Keep realtime on the 4 tables that change often AND require cross-device sync:
--   vehicles, dispatch, dispatch_legs, fuel_rounds
-- Remove the rest. They can still be polled/refetched on tab focus via React Query.

DO $$
DECLARE
  t TEXT;
  to_remove TEXT[] := ARRAY[
    'employees','customers','subcontractors','partners',
    'maintenance',
    'tires','tire_events','tire_scrap_sales',
    'fuel_records','fuel_stock','fuel_transactions',
    'expenses','expense_headers','expense_lines',
    'stock_items','stock_receipts','fixed_costs',
    'sub_drivers','sub_jobs',
    'activity_logs','task_completions','edit_approvals',
    'vehicle_registrations','request_approvals'
  ];
BEGIN
  FOREACH t IN ARRAY to_remove LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE %I', t);
    EXCEPTION
      WHEN OTHERS THEN
        -- Table may not be in publication (e.g. fresh setup) — safe to ignore
        NULL;
    END;
  END LOOP;
END $$;

-- Confirm kept tables (idempotent — ADD is safe to re-run)
DO $$
DECLARE
  t TEXT;
  to_keep TEXT[] := ARRAY['vehicles','dispatch','dispatch_legs','fuel_rounds'];
BEGIN
  FOREACH t IN ARRAY to_keep LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    EXCEPTION
      WHEN duplicate_object THEN
        NULL;
    END;
  END LOOP;
END $$;
