-- Routes Config: master list of common origin × destination pairs with
-- default freight rate and per-diem. Used to auto-fill the leg form and to
-- group reports by route (so "KPS→Prachuap" is a single filter option rather
-- than picking origin and destination separately).
--
-- Dispatch legs reference a route via route_id, but ราคา/เบี้ยเลี้ยง are
-- still copied onto the leg as a snapshot — changing the master afterward
-- must NOT alter historical revenue.

CREATE TABLE IF NOT EXISTS public.routes (
  id                  TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  code                TEXT        NOT NULL UNIQUE,
  name                TEXT        NOT NULL DEFAULT '',
  origin              TEXT        NOT NULL DEFAULT '',
  destination         TEXT        NOT NULL DEFAULT '',
  distance_km         NUMERIC,
  default_price_mode  TEXT        NOT NULL DEFAULT 'per_ton'
                                  CHECK (default_price_mode IN ('per_ton','per_kg','lump')),
  default_price       NUMERIC     NOT NULL DEFAULT 0,
  default_per_diem    NUMERIC     NOT NULL DEFAULT 0,
  customer_id         TEXT        REFERENCES public.customers(id) ON DELETE SET NULL,
  cargo_type          TEXT        NOT NULL DEFAULT '',
  active              BOOLEAN     NOT NULL DEFAULT TRUE,
  notes               TEXT        NOT NULL DEFAULT '',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS routes_origin_destination_idx
  ON public.routes (lower(origin), lower(destination));

ALTER TABLE public.dispatch_legs
  ADD COLUMN IF NOT EXISTS route_id TEXT REFERENCES public.routes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS dispatch_legs_route_id_idx
  ON public.dispatch_legs (route_id);

-- RLS: same permissive pattern as the rest of the ERP master tables in 0002.
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS routes_all ON public.routes;
CREATE POLICY routes_all ON public.routes
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.routes;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Seed a handful of common routes that match existing dispatch_legs so the
-- "auto-match by origin+destination" report grouping has rows to demo.
INSERT INTO public.routes (id, code, name, origin, destination, distance_km, default_price_mode, default_price, default_per_diem, cargo_type, active, notes) VALUES
  ('r-bkk-cnx',  'RTE-001', 'KPS → เชียงใหม่',           'กรุงเทพมหานคร',          'เชียงใหม่',         700, 'per_ton', 3600,  800,  'ทั่วไป',     TRUE, ''),
  ('r-kor-bna',  'RTE-002', 'โคราช → บางนา',              'นครราชสีมา',             'บางนา DC',         260, 'per_ton', 2200,  600,  'บรรจุไม่ได้', TRUE, ''),
  ('r-bna-kor',  'RTE-003', 'บางนา → โคราช',              'บางนา DC',                'นครราชสีมา',       260, 'lump',    18800, 600,  'บรรจุไม่ได้', TRUE, ''),
  ('r-ryg-pty',  'RTE-004', 'ระยอง → พัทยา',              'ระยอง',                  'พัทยา',            80,  'per_ton', 1500,  400,  'ทั่วไป',     TRUE, ''),
  ('r-mtt-ldk',  'RTE-005', 'มาบตาพุด → ลาดกระบัง',       'ระยอง (PTT Map Ta Phut)', 'ลาดกระบัง ICD',    200, 'per_ton', 840,   400,  'เคมี/IBC',  TRUE, ''),
  ('r-bna-kkn',  'RTE-006', 'บางนา → ขอนแก่น',            'บางนา DC',                'ขอนแก่น Hub',      449, 'per_ton', 1770,  800,  'ทั่วไป',     TRUE, ''),
  ('r-srb-lcb',  'RTE-007', 'สระบุรี → แหลมฉบัง',         'สระบุรี โรงงาน 2',       'แหลมฉบัง Port',    180, 'lump',    16200, 400,  'ตู้คอนเทนเนอร์', TRUE, ''),
  ('r-spk-cnx',  'RTE-008', 'สมุทรปราการ → เชียงใหม่',    'สมุทรปราการ คลังสินค้า', 'เชียงใหม่ คลัง 3', 696, 'per_ton', 1811,  1200, 'เคมี',       TRUE, '')
ON CONFLICT (id) DO NOTHING;
