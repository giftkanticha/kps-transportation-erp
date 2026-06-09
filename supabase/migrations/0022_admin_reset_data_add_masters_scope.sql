-- Adds a sixth scope p_masters to admin_reset_data. When true, the function
-- runs in "full wipe" mode: deletes every operational + master table (employees,
-- vehicles, customers, partners, subcontractors, sub_drivers) in dependency
-- order, leaving only user_profiles / user_permissions / acl_audit_log /
-- data_reset_log so the team starts from a clean slate but keeps accounts and
-- audit history.

CREATE OR REPLACE FUNCTION public.admin_reset_data(
  p_expenses BOOLEAN DEFAULT FALSE,
  p_trips    BOOLEAN DEFAULT FALSE,
  p_fuel     BOOLEAN DEFAULT FALSE,
  p_tires    BOOLEAN DEFAULT FALSE,
  p_stock    BOOLEAN DEFAULT FALSE,
  p_masters  BOOLEAN DEFAULT FALSE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  c_expenses INT := 0;
  c_trips    INT := 0;
  c_fuel     INT := 0;
  c_tires    INT := 0;
  c_stock    INT := 0;
  c_masters  INT := 0;
  detail     TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;

  IF p_masters THEN
    c_masters := (SELECT COUNT(*) FROM employees)
               + (SELECT COUNT(*) FROM vehicles)
               + (SELECT COUNT(*) FROM customers)
               + (SELECT COUNT(*) FROM partners)
               + (SELECT COUNT(*) FROM subcontractors)
               + (SELECT COUNT(*) FROM sub_drivers);
    c_expenses := (SELECT COUNT(*) FROM expense_headers) + (SELECT COUNT(*) FROM expenses);
    c_trips    := (SELECT COUNT(*) FROM dispatch) + (SELECT COUNT(*) FROM fuel_rounds);
    c_fuel     := (SELECT COUNT(*) FROM fuel_records) + (SELECT COUNT(*) FROM fuel_stock) + (SELECT COUNT(*) FROM fuel_transactions);
    c_tires    := (SELECT COUNT(*) FROM tires);
    c_stock    := (SELECT COUNT(*) FROM stock_items) + (SELECT COUNT(*) FROM stock_receipts);

    DELETE FROM dispatch              WHERE TRUE;
    DELETE FROM maintenance           WHERE TRUE;
    DELETE FROM expense_headers       WHERE TRUE;
    DELETE FROM expenses              WHERE TRUE;
    DELETE FROM tires                 WHERE TRUE;
    DELETE FROM fuel_records          WHERE TRUE;
    DELETE FROM fuel_stock            WHERE TRUE;
    DELETE FROM fuel_rounds           WHERE TRUE;
    DELETE FROM fuel_transactions     WHERE TRUE;
    DELETE FROM stock_receipts        WHERE TRUE;
    DELETE FROM stock_items           WHERE TRUE;
    DELETE FROM fixed_costs           WHERE TRUE;
    DELETE FROM sub_jobs              WHERE TRUE;
    DELETE FROM sub_drivers           WHERE TRUE;
    DELETE FROM vehicle_registrations WHERE TRUE;
    DELETE FROM edit_approvals        WHERE TRUE;
    DELETE FROM request_approvals     WHERE TRUE;
    DELETE FROM activity_logs         WHERE TRUE;
    DELETE FROM task_completions      WHERE TRUE;
    DELETE FROM customers      WHERE TRUE;
    DELETE FROM partners       WHERE TRUE;
    DELETE FROM subcontractors WHERE TRUE;
    DELETE FROM employees      WHERE TRUE;
    DELETE FROM vehicles       WHERE TRUE;

    detail := detail || ('masters:' || c_masters);
    detail := detail || ('expenses:' || c_expenses);
    detail := detail || ('trips:' || c_trips);
    detail := detail || ('fuel:' || c_fuel);
    detail := detail || ('tires:' || c_tires);
    detail := detail || ('stock:' || c_stock);
  ELSE
    IF p_expenses THEN
      c_expenses := (SELECT COUNT(*) FROM expense_headers) + (SELECT COUNT(*) FROM expenses);
      DELETE FROM expense_headers WHERE TRUE;
      DELETE FROM expenses        WHERE TRUE;
      detail := detail || ('expenses:' || c_expenses);
    END IF;
    IF p_trips THEN
      c_trips := (SELECT COUNT(*) FROM dispatch) + (SELECT COUNT(*) FROM fuel_rounds);
      DELETE FROM dispatch    WHERE TRUE;
      DELETE FROM fuel_rounds WHERE TRUE;
      detail := detail || ('trips:' || c_trips);
    END IF;
    IF p_fuel THEN
      c_fuel := (SELECT COUNT(*) FROM fuel_records)
              + (SELECT COUNT(*) FROM fuel_stock)
              + (SELECT COUNT(*) FROM fuel_transactions);
      DELETE FROM fuel_records      WHERE TRUE;
      DELETE FROM fuel_stock        WHERE TRUE;
      DELETE FROM fuel_transactions WHERE TRUE;
      detail := detail || ('fuel:' || c_fuel);
    END IF;
    IF p_tires THEN
      c_tires := (SELECT COUNT(*) FROM tires);
      DELETE FROM tires WHERE TRUE;
      detail := detail || ('tires:' || c_tires);
    END IF;
    IF p_stock THEN
      c_stock := (SELECT COUNT(*) FROM stock_items) + (SELECT COUNT(*) FROM stock_receipts);
      DELETE FROM stock_receipts WHERE TRUE;
      DELETE FROM stock_items    WHERE TRUE;
      detail := detail || ('stock:' || c_stock);
    END IF;
  END IF;

  INSERT INTO data_reset_log (reset_by, details, status, completed_at)
  VALUES (auth.uid(), array_to_string(detail, ', '), 'COMPLETED', NOW());

  RETURN jsonb_build_object(
    'expenses', c_expenses,
    'trips',    c_trips,
    'fuel',     c_fuel,
    'tires',    c_tires,
    'stock',    c_stock,
    'masters',  c_masters
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reset_data(BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN) TO authenticated;
