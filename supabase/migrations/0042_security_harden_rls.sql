-- ─────────────────────────────────────────────────────────────────────────────
-- 0042 — Security hardening of RLS policies
--
-- Closes privilege-escalation and financial-tampering holes opened by the
-- earlier "open writes for drivers" migrations (0026/0028/0029/0030/0033/
-- 0036/0037). The project historically deferred role-gating to the client
-- (permissions.ts), which the anon-key Supabase client cannot enforce against
-- a hostile caller. This migration moves the gate into the database.
--
-- Design notes:
--   * user_profiles.employee_id is still not populated, so true per-driver row
--     scoping on dispatch/fuel is not yet possible. We instead (a) block
--     non-managers from touching LOCKED (closed-period) rounds at the DB level,
--     and (b) lock pure back-office financial tables to manager+/admin.
--   * Driver-operated flows (open a round, enter fuel, add a location on the
--     fly) stay writable by any authenticated user.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── C1/C2 · user_profiles: block self role/status/approval escalation ────────
-- RLS cannot restrict individual columns, so a BEFORE UPDATE trigger enforces
-- that a non-admin editing their own row may not change role, status, or the
-- approval bookkeeping. Admins (is_admin()) are exempt. Runs before the
-- existing user_profiles_on_approve trigger (name sorts earlier).
CREATE OR REPLACE FUNCTION public.guard_profile_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() = NEW.id AND NOT public.is_admin() THEN
    IF NEW.role        IS DISTINCT FROM OLD.role
    OR NEW.status      IS DISTINCT FROM OLD.status
    OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
    OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
      RAISE EXCEPTION 'ไม่มีสิทธิ์แก้ไข role/status/การอนุมัติของบัญชีตนเอง';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_profiles_guard_self ON public.user_profiles;
CREATE TRIGGER user_profiles_guard_self
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_self_update();

-- ── C3 · company_bank_accounts: only admin may write (printed on invoices) ────
DROP POLICY IF EXISTS company_bank_accounts_write ON company_bank_accounts;
CREATE POLICY company_bank_accounts_write
  ON company_bank_accounts FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── H1 · billing_notes: manager+ only (financial documents) ───────────────────
DROP POLICY IF EXISTS billing_notes_write ON billing_notes;
CREATE POLICY billing_notes_write
  ON billing_notes FOR ALL TO authenticated
  USING (public.is_manager_or_above()) WITH CHECK (public.is_manager_or_above());

-- ── H1 · accounting periods + snapshots: manager+ only ────────────────────────
DROP POLICY IF EXISTS accounting_periods_write          ON accounting_periods;
CREATE POLICY accounting_periods_write
  ON accounting_periods FOR ALL TO authenticated
  USING (public.is_manager_or_above()) WITH CHECK (public.is_manager_or_above());

DROP POLICY IF EXISTS accounting_period_snapshots_write ON accounting_period_snapshots;
CREATE POLICY accounting_period_snapshots_write
  ON accounting_period_snapshots FOR ALL TO authenticated
  USING (public.is_manager_or_above()) WITH CHECK (public.is_manager_or_above());

-- Unlock requests: anyone may CREATE a request; only manager+ may review
-- (approve/reject = UPDATE) or delete one.
DROP POLICY IF EXISTS period_unlock_requests_write ON period_unlock_requests;
CREATE POLICY period_unlock_requests_insert
  ON period_unlock_requests FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY period_unlock_requests_modify
  ON period_unlock_requests FOR UPDATE TO authenticated
  USING (public.is_manager_or_above()) WITH CHECK (public.is_manager_or_above());
CREATE POLICY period_unlock_requests_delete
  ON period_unlock_requests FOR DELETE TO authenticated
  USING (public.is_manager_or_above());

-- ── H6 · dispatch / dispatch_legs: block non-managers editing LOCKED rounds ───
-- Drivers keep INSERT (open a round) and UPDATE of their own not-yet-locked
-- rounds. Once a period is closed and the round is locked, only manager+ may
-- change it. WITH CHECK also prevents a non-manager from flipping locked=TRUE.
DROP POLICY IF EXISTS dispatch_update ON public.dispatch;
CREATE POLICY dispatch_update ON public.dispatch
  FOR UPDATE TO authenticated
  USING  (public.is_manager_or_above() OR locked IS NOT TRUE)
  WITH CHECK (public.is_manager_or_above() OR locked IS NOT TRUE);

DROP POLICY IF EXISTS dispatch_legs_update ON public.dispatch_legs;
CREATE POLICY dispatch_legs_update ON public.dispatch_legs
  FOR UPDATE TO authenticated
  USING (
    public.is_manager_or_above()
    OR NOT EXISTS (SELECT 1 FROM public.dispatch d
                   WHERE d.id = dispatch_legs.dispatch_id AND d.locked IS TRUE)
  )
  WITH CHECK (
    public.is_manager_or_above()
    OR NOT EXISTS (SELECT 1 FROM public.dispatch d
                   WHERE d.id = dispatch_legs.dispatch_id AND d.locked IS TRUE)
  );

-- ── M2 · back-office master data: restore manager+ INSERT ─────────────────────
-- These registries are only reachable from manager+ pages; drivers have no
-- legitimate reason to inject rows (partners carries vendor bank details).
-- vehicles + locations INSERT stay open (used in driver-facing flows).
DROP POLICY IF EXISTS partners_write ON public.partners;
CREATE POLICY partners_write ON public.partners
  FOR INSERT TO authenticated WITH CHECK (public.is_manager_or_above());

DROP POLICY IF EXISTS subcontractors_write ON public.subcontractors;
CREATE POLICY subcontractors_write ON public.subcontractors
  FOR INSERT TO authenticated WITH CHECK (public.is_manager_or_above());

DROP POLICY IF EXISTS sub_drivers_write ON public.sub_drivers;
CREATE POLICY sub_drivers_write ON public.sub_drivers
  FOR INSERT TO authenticated WITH CHECK (public.is_manager_or_above());

DROP POLICY IF EXISTS maintenance_insert ON public.maintenance;
CREATE POLICY maintenance_insert ON public.maintenance
  FOR INSERT TO authenticated WITH CHECK (public.is_manager_or_above());

DROP POLICY IF EXISTS stock_items_write ON public.stock_items;
CREATE POLICY stock_items_write ON public.stock_items
  FOR INSERT TO authenticated WITH CHECK (public.is_manager_or_above());

-- ── M1 · acl_audit_log: never allow anon inserts ──────────────────────────────
-- (Table lives in auth-schema.sql; guard defensively if present.)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'acl_audit_log') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can insert audit log" ON public.acl_audit_log';
    EXECUTE 'DROP POLICY IF EXISTS acl_audit_log_insert ON public.acl_audit_log';
    EXECUTE 'CREATE POLICY acl_audit_log_insert ON public.acl_audit_log
             FOR INSERT TO authenticated WITH CHECK (TRUE)';
  END IF;
END $$;
