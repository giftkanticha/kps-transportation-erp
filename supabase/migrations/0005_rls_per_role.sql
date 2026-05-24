-- Phase 1 migration: Role-based RLS policies
-- Replaces the permissive policies from 0002 with proper per-role access control.
-- Roles (from user_profiles.role):
--   SUPER_ADMIN / ADMIN  → see + write everything
--   MANAGER              → see + write operational data; cannot delete; cannot see salary/account
--   EMPLOYEE (= DRIVER)  → see only their own dispatch/fuel/expenses; read-only on master data

-- ─── Link user_profiles → employees ─────────────────────────────────────────
-- Adds employee_id so we can map auth users to their employee row for per-driver scoping.
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_employee_id ON user_profiles(employee_id);

-- ─── Helper functions ──────────────────────────────────────────────────────
-- All SECURITY DEFINER + STABLE so they're safe to call from RLS policies
-- and Postgres can cache results within a single query.

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role IN ('SUPER_ADMIN','ADMIN')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_manager_or_above() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role IN ('SUPER_ADMIN','ADMIN','MANAGER')
  );
$$;

CREATE OR REPLACE FUNCTION public.my_employee_id() RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT employee_id FROM user_profiles WHERE id = auth.uid();
$$;

-- ─── Drop old permissive policies ──────────────────────────────────────────
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
    EXECUTE format('DROP POLICY IF EXISTS authenticated_all ON %I', t);
  END LOOP;
END $$;

-- ─── Master data: read-all-authenticated, write manager+, delete admin ─────
-- (vehicles, customers, partners, subcontractors, sub_drivers, stock_items)

CREATE POLICY "vehicles_select"   ON vehicles   FOR SELECT TO authenticated USING (true);
CREATE POLICY "vehicles_insert"   ON vehicles   FOR INSERT TO authenticated WITH CHECK (public.is_manager_or_above());
CREATE POLICY "vehicles_update"   ON vehicles   FOR UPDATE TO authenticated USING (public.is_manager_or_above()) WITH CHECK (public.is_manager_or_above());
CREATE POLICY "vehicles_delete"   ON vehicles   FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "customers_select"  ON customers  FOR SELECT TO authenticated USING (true);
CREATE POLICY "customers_write"   ON customers  FOR INSERT TO authenticated WITH CHECK (public.is_manager_or_above());
CREATE POLICY "customers_update"  ON customers  FOR UPDATE TO authenticated USING (public.is_manager_or_above());
CREATE POLICY "customers_delete"  ON customers  FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "partners_select"   ON partners   FOR SELECT TO authenticated USING (true);
CREATE POLICY "partners_write"    ON partners   FOR INSERT TO authenticated WITH CHECK (public.is_manager_or_above());
CREATE POLICY "partners_update"   ON partners   FOR UPDATE TO authenticated USING (public.is_manager_or_above());
CREATE POLICY "partners_delete"   ON partners   FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "subcontractors_select" ON subcontractors FOR SELECT TO authenticated USING (true);
CREATE POLICY "subcontractors_write"  ON subcontractors FOR INSERT TO authenticated WITH CHECK (public.is_manager_or_above());
CREATE POLICY "subcontractors_update" ON subcontractors FOR UPDATE TO authenticated USING (public.is_manager_or_above());
CREATE POLICY "subcontractors_delete" ON subcontractors FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "sub_drivers_select" ON sub_drivers FOR SELECT TO authenticated USING (true);
CREATE POLICY "sub_drivers_write"  ON sub_drivers FOR INSERT TO authenticated WITH CHECK (public.is_manager_or_above());
CREATE POLICY "sub_drivers_update" ON sub_drivers FOR UPDATE TO authenticated USING (public.is_manager_or_above());
CREATE POLICY "sub_drivers_delete" ON sub_drivers FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "stock_items_select" ON stock_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "stock_items_write"  ON stock_items FOR INSERT TO authenticated WITH CHECK (public.is_manager_or_above());
CREATE POLICY "stock_items_update" ON stock_items FOR UPDATE TO authenticated USING (public.is_manager_or_above());
CREATE POLICY "stock_items_delete" ON stock_items FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "stock_receipts_select" ON stock_receipts FOR SELECT TO authenticated USING (true);
CREATE POLICY "stock_receipts_write"  ON stock_receipts FOR INSERT TO authenticated WITH CHECK (public.is_manager_or_above());
CREATE POLICY "stock_receipts_update" ON stock_receipts FOR UPDATE TO authenticated USING (public.is_manager_or_above());
CREATE POLICY "stock_receipts_delete" ON stock_receipts FOR DELETE TO authenticated USING (public.is_admin());

-- ─── Employees: manager+ full access; driver sees rows (no salary filter at row level) ──
-- NOTE: Hiding salary/account columns for drivers is enforced at application layer
-- (a Postgres view or column-grants would be cleaner long-term). For now drivers CAN
-- read the row but the UI should not show salary fields to non-admins.
CREATE POLICY "employees_select" ON employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "employees_insert" ON employees FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "employees_update" ON employees FOR UPDATE TO authenticated USING (public.is_manager_or_above());
CREATE POLICY "employees_delete" ON employees FOR DELETE TO authenticated USING (public.is_admin());

-- ─── Dispatch + dispatch_legs: driver sees only their own rows ─────────────
CREATE POLICY "dispatch_select" ON dispatch FOR SELECT TO authenticated USING (
  public.is_manager_or_above() OR driver_id = public.my_employee_id()
);
CREATE POLICY "dispatch_insert" ON dispatch FOR INSERT TO authenticated WITH CHECK (public.is_manager_or_above());
CREATE POLICY "dispatch_update" ON dispatch FOR UPDATE TO authenticated USING (public.is_manager_or_above());
CREATE POLICY "dispatch_delete" ON dispatch FOR DELETE TO authenticated USING (public.is_admin());

-- dispatch_legs inherits visibility via FK lookup
CREATE POLICY "dispatch_legs_select" ON dispatch_legs FOR SELECT TO authenticated USING (
  public.is_manager_or_above() OR EXISTS (
    SELECT 1 FROM dispatch d
    WHERE d.id = dispatch_legs.dispatch_id AND d.driver_id = public.my_employee_id()
  )
);
CREATE POLICY "dispatch_legs_insert" ON dispatch_legs FOR INSERT TO authenticated WITH CHECK (public.is_manager_or_above());
CREATE POLICY "dispatch_legs_update" ON dispatch_legs FOR UPDATE TO authenticated USING (public.is_manager_or_above());
CREATE POLICY "dispatch_legs_delete" ON dispatch_legs FOR DELETE TO authenticated USING (public.is_admin());

-- ─── Maintenance: everyone reads (drivers need to know which trucks are down) ──
CREATE POLICY "maintenance_select" ON maintenance FOR SELECT TO authenticated USING (true);
CREATE POLICY "maintenance_insert" ON maintenance FOR INSERT TO authenticated WITH CHECK (public.is_manager_or_above());
CREATE POLICY "maintenance_update" ON maintenance FOR UPDATE TO authenticated USING (public.is_manager_or_above());
CREATE POLICY "maintenance_delete" ON maintenance FOR DELETE TO authenticated USING (public.is_admin());

-- ─── Tires: everyone reads (fleet-wide visibility); manager writes ──────────
CREATE POLICY "tires_select" ON tires FOR SELECT TO authenticated USING (true);
CREATE POLICY "tires_write"  ON tires FOR INSERT TO authenticated WITH CHECK (public.is_manager_or_above());
CREATE POLICY "tires_update" ON tires FOR UPDATE TO authenticated USING (public.is_manager_or_above());
CREATE POLICY "tires_delete" ON tires FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "tire_events_select" ON tire_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "tire_events_write"  ON tire_events FOR INSERT TO authenticated WITH CHECK (public.is_manager_or_above());
CREATE POLICY "tire_events_update" ON tire_events FOR UPDATE TO authenticated USING (public.is_manager_or_above());
CREATE POLICY "tire_events_delete" ON tire_events FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "tire_scrap_sales_select" ON tire_scrap_sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "tire_scrap_sales_write"  ON tire_scrap_sales FOR INSERT TO authenticated WITH CHECK (public.is_manager_or_above());
CREATE POLICY "tire_scrap_sales_update" ON tire_scrap_sales FOR UPDATE TO authenticated USING (public.is_manager_or_above());
CREATE POLICY "tire_scrap_sales_delete" ON tire_scrap_sales FOR DELETE TO authenticated USING (public.is_admin());

-- ─── Fuel: driver sees their own records; manager+ sees all ────────────────
CREATE POLICY "fuel_records_select" ON fuel_records FOR SELECT TO authenticated USING (
  public.is_manager_or_above() OR driver_id = public.my_employee_id()
);
CREATE POLICY "fuel_records_insert" ON fuel_records FOR INSERT TO authenticated WITH CHECK (
  public.is_manager_or_above() OR driver_id = public.my_employee_id()
);
CREATE POLICY "fuel_records_update" ON fuel_records FOR UPDATE TO authenticated USING (public.is_manager_or_above());
CREATE POLICY "fuel_records_delete" ON fuel_records FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "fuel_stock_select" ON fuel_stock FOR SELECT TO authenticated USING (public.is_manager_or_above());
CREATE POLICY "fuel_stock_write"  ON fuel_stock FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "fuel_stock_update" ON fuel_stock FOR UPDATE TO authenticated USING (public.is_manager_or_above());
CREATE POLICY "fuel_stock_delete" ON fuel_stock FOR DELETE TO authenticated USING (public.is_admin());

-- Driver sees fuel_rounds for vehicles they're currently assigned to via dispatch
CREATE POLICY "fuel_rounds_select" ON fuel_rounds FOR SELECT TO authenticated USING (
  public.is_manager_or_above() OR EXISTS (
    SELECT 1 FROM dispatch d
    WHERE d.id = fuel_rounds.dispatch_round_id AND d.driver_id = public.my_employee_id()
  )
);
CREATE POLICY "fuel_rounds_write"  ON fuel_rounds FOR INSERT TO authenticated WITH CHECK (public.is_manager_or_above());
CREATE POLICY "fuel_rounds_update" ON fuel_rounds FOR UPDATE TO authenticated USING (public.is_manager_or_above());
CREATE POLICY "fuel_rounds_delete" ON fuel_rounds FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "fuel_transactions_select" ON fuel_transactions FOR SELECT TO authenticated USING (
  public.is_manager_or_above() OR EXISTS (
    SELECT 1 FROM dispatch d
    WHERE d.id = fuel_transactions.trip_id AND d.driver_id = public.my_employee_id()
  )
);
CREATE POLICY "fuel_transactions_write"  ON fuel_transactions FOR INSERT TO authenticated WITH CHECK (public.is_manager_or_above());
CREATE POLICY "fuel_transactions_update" ON fuel_transactions FOR UPDATE TO authenticated USING (public.is_manager_or_above());
CREATE POLICY "fuel_transactions_delete" ON fuel_transactions FOR DELETE TO authenticated USING (public.is_admin());

-- ─── Expenses: manager+ only (financial data) ──────────────────────────────
CREATE POLICY "expenses_select" ON expenses FOR SELECT TO authenticated USING (
  public.is_manager_or_above() OR driver_id = public.my_employee_id()
);
CREATE POLICY "expenses_insert" ON expenses FOR INSERT TO authenticated WITH CHECK (
  public.is_manager_or_above() OR driver_id = public.my_employee_id()
);
CREATE POLICY "expenses_update" ON expenses FOR UPDATE TO authenticated USING (public.is_manager_or_above());
CREATE POLICY "expenses_delete" ON expenses FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "expense_headers_select" ON expense_headers FOR SELECT TO authenticated USING (public.is_manager_or_above());
CREATE POLICY "expense_headers_write"  ON expense_headers FOR INSERT TO authenticated WITH CHECK (public.is_manager_or_above());
CREATE POLICY "expense_headers_update" ON expense_headers FOR UPDATE TO authenticated USING (public.is_manager_or_above());
CREATE POLICY "expense_headers_delete" ON expense_headers FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "expense_lines_select" ON expense_lines FOR SELECT TO authenticated USING (public.is_manager_or_above());
CREATE POLICY "expense_lines_write"  ON expense_lines FOR INSERT TO authenticated WITH CHECK (public.is_manager_or_above());
CREATE POLICY "expense_lines_update" ON expense_lines FOR UPDATE TO authenticated USING (public.is_manager_or_above());
CREATE POLICY "expense_lines_delete" ON expense_lines FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "fixed_costs_select" ON fixed_costs FOR SELECT TO authenticated USING (public.is_manager_or_above());
CREATE POLICY "fixed_costs_write"  ON fixed_costs FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "fixed_costs_update" ON fixed_costs FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "fixed_costs_delete" ON fixed_costs FOR DELETE TO authenticated USING (public.is_admin());

-- ─── Subcontractor jobs: manager+ ──────────────────────────────────────────
CREATE POLICY "sub_jobs_select" ON sub_jobs FOR SELECT TO authenticated USING (public.is_manager_or_above());
CREATE POLICY "sub_jobs_write"  ON sub_jobs FOR INSERT TO authenticated WITH CHECK (public.is_manager_or_above());
CREATE POLICY "sub_jobs_update" ON sub_jobs FOR UPDATE TO authenticated USING (public.is_manager_or_above());
CREATE POLICY "sub_jobs_delete" ON sub_jobs FOR DELETE TO authenticated USING (public.is_admin());

-- ─── Activity logs: manager+ sees all; driver sees their own (matched by who-name) ──
-- 'who' is a free-text name in current schema, so we just allow all reads for now.
-- Tighten in Phase 2 by switching to user_id FK.
CREATE POLICY "activity_logs_select" ON activity_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "activity_logs_insert" ON activity_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "activity_logs_update" ON activity_logs FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "activity_logs_delete" ON activity_logs FOR DELETE TO authenticated USING (public.is_admin());

-- ─── Task completions: anyone signs off; manager+ reviews ──────────────────
CREATE POLICY "task_completions_select" ON task_completions FOR SELECT TO authenticated USING (true);
CREATE POLICY "task_completions_insert" ON task_completions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "task_completions_update" ON task_completions FOR UPDATE TO authenticated USING (public.is_manager_or_above());
CREATE POLICY "task_completions_delete" ON task_completions FOR DELETE TO authenticated USING (public.is_admin());

-- ─── Edit approvals: anyone requests; manager+ approves ────────────────────
CREATE POLICY "edit_approvals_select" ON edit_approvals FOR SELECT TO authenticated USING (true);
CREATE POLICY "edit_approvals_insert" ON edit_approvals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "edit_approvals_update" ON edit_approvals FOR UPDATE TO authenticated USING (public.is_manager_or_above());
CREATE POLICY "edit_approvals_delete" ON edit_approvals FOR DELETE TO authenticated USING (public.is_admin());

-- ─── Vehicle/request registrations: manager+ ──────────────────────────────
CREATE POLICY "vehicle_registrations_select" ON vehicle_registrations FOR SELECT TO authenticated USING (public.is_manager_or_above());
CREATE POLICY "vehicle_registrations_write"  ON vehicle_registrations FOR INSERT TO authenticated WITH CHECK (public.is_manager_or_above());
CREATE POLICY "vehicle_registrations_update" ON vehicle_registrations FOR UPDATE TO authenticated USING (public.is_manager_or_above());
CREATE POLICY "vehicle_registrations_delete" ON vehicle_registrations FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "request_approvals_select" ON request_approvals FOR SELECT TO authenticated USING (public.is_manager_or_above());
CREATE POLICY "request_approvals_write"  ON request_approvals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "request_approvals_update" ON request_approvals FOR UPDATE TO authenticated USING (public.is_manager_or_above());
CREATE POLICY "request_approvals_delete" ON request_approvals FOR DELETE TO authenticated USING (public.is_admin());
