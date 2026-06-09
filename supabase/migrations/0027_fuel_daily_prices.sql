-- Per-day fuel price reference. Drivers don't (and shouldn't) know the
-- price; the admin sets a row per date when the price changes and the
-- Express Fuel Log looks up the latest price <= the transaction date.

CREATE TABLE IF NOT EXISTS public.fuel_daily_prices (
  id           TEXT PRIMARY KEY DEFAULT (uuid_generate_v4())::TEXT,
  date         DATE NOT NULL,
  source       TEXT NOT NULL CHECK (source IN ('EXTERNAL_PUMP', 'FACTORY_TANK')),
  price_per_l  NUMERIC NOT NULL CHECK (price_per_l >= 0),
  notes        TEXT NOT NULL DEFAULT '',
  set_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (date, source)
);

CREATE INDEX IF NOT EXISTS idx_fuel_daily_prices_lookup
  ON public.fuel_daily_prices (source, date DESC);

ALTER TABLE public.fuel_daily_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fuel_daily_prices_select ON public.fuel_daily_prices;
DROP POLICY IF EXISTS fuel_daily_prices_write  ON public.fuel_daily_prices;
DROP POLICY IF EXISTS fuel_daily_prices_update ON public.fuel_daily_prices;
DROP POLICY IF EXISTS fuel_daily_prices_delete ON public.fuel_daily_prices;

CREATE POLICY fuel_daily_prices_select ON public.fuel_daily_prices
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY fuel_daily_prices_write  ON public.fuel_daily_prices
  FOR INSERT TO authenticated WITH CHECK (public.is_manager_or_above());

CREATE POLICY fuel_daily_prices_update ON public.fuel_daily_prices
  FOR UPDATE TO authenticated USING (public.is_manager_or_above()) WITH CHECK (public.is_manager_or_above());

CREATE POLICY fuel_daily_prices_delete ON public.fuel_daily_prices
  FOR DELETE TO authenticated USING (public.is_admin());
