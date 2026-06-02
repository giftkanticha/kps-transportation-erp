-- Singleton table for company-wide info shown on the "ข้อมูลบริษัท" settings
-- page. PK locked to id=1 so there's only ever one row; touch trigger stamps
-- updated_at + updated_by. RLS: all authenticated users read, admins update.

CREATE TABLE IF NOT EXISTS public.company_settings (
  id          INTEGER PRIMARY KEY CHECK (id = 1) DEFAULT 1,
  name        TEXT NOT NULL DEFAULT '',
  tax_id      TEXT NOT NULL DEFAULT '',
  phone       TEXT NOT NULL DEFAULT '',
  email       TEXT NOT NULL DEFAULT '',
  address     TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.company_settings (id, name, tax_id, phone, email, address)
VALUES (1, 'บริษัท เคพีเอส ทรานสปอร์เตชั่น จำกัด', '0105556012345', '02-XXX-XXXX', 'contact@kps.com',
        '123/45 ถนนบางนา-ตราด แขวงบางนาเหนือ เขตบางนา กรุงเทพมหานคร 10260')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_settings_read"  ON public.company_settings;
DROP POLICY IF EXISTS "company_settings_write" ON public.company_settings;

CREATE POLICY "company_settings_read" ON public.company_settings
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "company_settings_write" ON public.company_settings
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.touch_company_settings()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS company_settings_touch ON public.company_settings;
CREATE TRIGGER company_settings_touch
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_company_settings();
