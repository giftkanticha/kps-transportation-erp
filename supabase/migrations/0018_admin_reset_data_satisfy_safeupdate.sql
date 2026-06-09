-- Supabase preloads the safeupdate hook in PostgREST sessions, which rejects
-- any DELETE / UPDATE without a WHERE clause — even inside SECURITY DEFINER
-- functions called via RPC. Add an explicit `WHERE TRUE` to every DELETE so
-- the wipes actually run instead of silently returning
-- "DELETE requires a WHERE clause".

CREATE OR REPLACE FUNCTION public.admin_reset_data(
  p_expenses BOOLEAN DEFAULT FALSE,
  p_trips    BOOLEAN DEFAULT FALSE,
  p_fuel     BOOLEAN DEFAULT FALSE,
  p_tires    BOOLEAN DEFAULT FALSE,
  p_stock    BOOLEAN DEFAULT FALSE
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
  detail     TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;

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

  INSERT INTO data_reset_log (reset_by, details, status, completed_at)
  VALUES (auth.uid(), array_to_string(detail, ', '), 'COMPLETED', NOW());

  RETURN jsonb_build_object(
    'expenses', c_expenses,
    'trips',    c_trips,
    'fuel',     c_fuel,
    'tires',    c_tires,
    'stock',    c_stock
  );
END;
$$;
