-- ทะเบียนประเภทสินค้า — แหล่งตัวเลือก dropdown "ประเภทสินค้า" ตอนเพิ่ม/แก้ขา.
-- dispatch_legs.cargo_type ยังเก็บเป็นชื่อ (text) เหมือนเดิม ไม่แก้ตารางนั้น
-- ผู้ใช้เพิ่มประเภทใหม่ได้เองจากหน้าเพิ่มขา (ตัวเลือก "+ เพิ่มประเภทใหม่…")

CREATE TABLE IF NOT EXISTS cargo_types (
  id         TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  name       TEXT        NOT NULL,
  active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (name)
);

INSERT INTO cargo_types (name) VALUES
  ('ข้าวโพด'), ('มันเส้น'), ('ปุ๋ย'), ('ทั่วไป')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE cargo_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cargo_types_read  ON cargo_types;
DROP POLICY IF EXISTS cargo_types_write ON cargo_types;
CREATE POLICY cargo_types_read  ON cargo_types FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY cargo_types_write ON cargo_types FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
