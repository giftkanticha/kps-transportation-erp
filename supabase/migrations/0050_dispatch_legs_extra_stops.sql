-- จุดขึ้น/ลงสินค้าเพิ่มเติมต่อขา (เช่น ทวีชัย ขึ้น-ลงหลายที่)
-- ค่าบรรทุกยังคิดจาก weight/price ของขาเดียวตามปกติ — คอลัมน์นี้ใช้บันทึก/แสดงเส้นทางจริงเท่านั้น
ALTER TABLE dispatch_legs ADD COLUMN IF NOT EXISTS extra_origins      TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE dispatch_legs ADD COLUMN IF NOT EXISTS extra_destinations TEXT[] NOT NULL DEFAULT '{}';
