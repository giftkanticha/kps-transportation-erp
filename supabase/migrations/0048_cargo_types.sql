-- ทะเบียนประเภทสินค้า — แหล่งตัวเลือก dropdown "ประเภทสินค้า" ตอนเพิ่ม/แก้ขา.
-- dispatch_legs.cargo_type ยังเก็บเป็นชื่อ (text) เหมือนเดิม ไม่แก้ตารางนั้น
-- ผู้ใช้เพิ่มประเภทใหม่ได้เองจากหน้าเพิ่มขา (ตัวเลือก "+ เพิ่มประเภทใหม่…")
--
-- Production tables live in the `kps` schema, not `public` (see 0045's note on this),
-- so the table is schema-qualified and needs explicit grants for PostgREST.

GRANT USAGE ON SCHEMA kps TO anon, authenticated;

CREATE TABLE IF NOT EXISTS kps.cargo_types (
  id         TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  name       TEXT        NOT NULL,
  active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (name)
);

INSERT INTO kps.cargo_types (name) VALUES
  ('ข้าวโพด'), ('มันเส้น'), ('ปุ๋ย'), ('ทั่วไป')
ON CONFLICT (name) DO NOTHING;

GRANT SELECT, INSERT, UPDATE, DELETE ON kps.cargo_types TO anon, authenticated;

ALTER TABLE kps.cargo_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cargo_types_read  ON kps.cargo_types;
DROP POLICY IF EXISTS cargo_types_write ON kps.cargo_types;
CREATE POLICY cargo_types_read  ON kps.cargo_types FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY cargo_types_write ON kps.cargo_types FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
