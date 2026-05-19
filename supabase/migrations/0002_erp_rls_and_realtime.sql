-- Phase 0 migration: permissive RLS + Realtime publication for all ERP tables.
-- Phase 5 will replace permissive policies with per-role rules.

DO $$
DECLARE
  t TEXT;
  tbls TEXT[] := ARRAY[
    'vehicles','employees','customers','subcontractors','partners',
    'dispatch','dispatch_legs','maintenance',
    'tires','tire_events','tire_scrap_sales',
    'fuel_records','fuel_stock','fuel_rounds','fuel_transactions',
    'expenses','expense_headers','expense_lines',
    'stock_items','stock_receipts','fixed_costs',
    'sub_drivers','sub_jobs',
    'activity_logs','task_completions','edit_approvals',
    'vehicle_registrations','request_approvals'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS authenticated_all ON %I', t);
    EXECUTE format(
      'CREATE POLICY authenticated_all ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t
    );
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END $$;
