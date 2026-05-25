-- Persist the end-of-round fuel entered on the dispatch close screen so a DRAFT
-- remembers it (the TRIP_CLOSING ledger entry is only created on actual close).
ALTER TABLE public.dispatch
  ADD COLUMN IF NOT EXISTS closing_fuel_liters NUMERIC,
  ADD COLUMN IF NOT EXISTS closing_fuel_price  NUMERIC;
