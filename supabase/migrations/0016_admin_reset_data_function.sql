-- A SECURITY DEFINER admin reset function so destructive ops bypass per-row RLS
-- evaluation that was silently filtering the previous client-side .delete() calls
-- to zero affected rows. Authorization re-checked via is_admin() before any wipe.

CREATE OR REPLACE FUNCTION public.admin_reset_data(
  p_expenses BOOLEAN DEFAULT FALSE,
  p_trips    BOOLEAN DEFAULT FALSE,
  p_fuel     BOOLEAN DEFAULT FALSE,
  p_tires    BOOLEAN DEFAULT FALSE
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
  detail     TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;

  IF p_expenses THEN
    c_expenses := (SELECT COUNT(*) FROM expense_headers) + (SELECT COUNT(*) FROM expenses);
    DELETE FROM expense_headers;     -- expense_lines cascades
    DELETE FROM expenses;
    detail := detail || ('expenses:' || c_expenses);
  END IF;

  IF p_trips THEN
    c_trips := (SELECT COUNT(*) FROM dispatch) + (SELECT COUNT(*) FROM fuel_rounds);
    DELETE FROM dispatch;            -- dispatch_legs cascades; fuel_transactions.trip_id is SET NULL
    DELETE FROM fuel_rounds;
    detail := detail || ('trips:' || c_trips);
  END IF;

  IF p_fuel THEN
    c_fuel := (SELECT COUNT(*) FROM fuel_records)
            + (SELECT COUNT(*) FROM fuel_stock)
            + (SELECT COUNT(*) FROM fuel_transactions);
    DELETE FROM fuel_records;
    DELETE FROM fuel_stock;
    DELETE FROM fuel_transactions;
    detail := detail || ('fuel:' || c_fuel);
  END IF;

  IF p_tires THEN
    c_tires := (SELECT COUNT(*) FROM tires);
    DELETE FROM tires;               -- tire_events / tire_scrap_sales cascade
    detail := detail || ('tires:' || c_tires);
  END IF;

  INSERT INTO data_reset_log (reset_by, details, status, completed_at)
  VALUES (auth.uid(), array_to_string(detail, ', '), 'COMPLETED', NOW());

  RETURN jsonb_build_object(
    'expenses', c_expenses,
    'trips',    c_trips,
    'fuel',     c_fuel,
    'tires',    c_tires
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reset_data(BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN) TO authenticated;
