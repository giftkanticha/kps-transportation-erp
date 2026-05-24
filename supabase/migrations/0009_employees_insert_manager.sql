-- Allow managers (not just admins) to add employees, consistent with the
-- customers/vehicles master-data inserts. The original per-role policy in
-- 0005 restricted employees INSERT to is_admin(), which silently blocked
-- managers from adding staff.

DROP POLICY IF EXISTS "employees_insert" ON employees;
CREATE POLICY "employees_insert" ON employees
  FOR INSERT TO authenticated
  WITH CHECK (public.is_manager_or_above());
