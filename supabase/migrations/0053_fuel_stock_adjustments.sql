-- ปรับยอดน้ำมันคลังโรงงานตามนับจริง (stock count adjustment)
--
-- เก็บเป็นแถวใน fuel_stock (liters ติดลบ = น้ำมันจริงน้อยกว่าระบบ, บวก = มากกว่า)
-- เพื่อให้ทุกหน้าที่คิดยอดคงเหลือจาก fuel_stock (สรุปรายวัน, หน้าคลัง, คีย์ด่วน,
-- ตรวจสอบข้อมูล) นับรายการปรับยอดอัตโนมัติ — ราคา/มูลค่า = 0 ไม่กระทบต้นทุน
-- entry_kind แยกรายการปรับยอดออกจากการรับน้ำมันเข้า (ไม่นับเป็นยอดซื้อ/รับเข้า)
--
-- Production tables live in the `kps` schema.

ALTER TABLE kps.fuel_stock ADD COLUMN IF NOT EXISTS entry_kind     TEXT NOT NULL DEFAULT 'PURCHASE';
ALTER TABLE kps.fuel_stock ADD COLUMN IF NOT EXISTS counted_liters NUMERIC;  -- ยอดที่นับได้จริง
ALTER TABLE kps.fuel_stock ADD COLUMN IF NOT EXISTS system_liters  NUMERIC;  -- ยอดในระบบ ณ ตอนปรับ
ALTER TABLE kps.fuel_stock ADD COLUMN IF NOT EXISTS note           TEXT;
ALTER TABLE kps.fuel_stock ADD COLUMN IF NOT EXISTS adjusted_by    TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fuel_stock_entry_kind_check'
      AND conrelid = 'kps.fuel_stock'::regclass
  ) THEN
    ALTER TABLE kps.fuel_stock
      ADD CONSTRAINT fuel_stock_entry_kind_check CHECK (entry_kind IN ('PURCHASE', 'ADJUSTMENT'));
  END IF;
END $$;

-- ให้ PostgREST เห็นคอลัมน์ใหม่ทันที
NOTIFY pgrst, 'reload schema';
