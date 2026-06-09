-- 0032_fuel_records_accounting_date.sql
-- เพิ่มฟิลด์ "เดือนค่าใช้จ่าย" ให้รายการน้ำมัน เพื่อแยกวันที่เติมจริง (date)
-- ออกจากเดือนที่ใช้คิดค่าใช้จ่ายในรายงาน (accounting_date)
--
-- ที่มา: น้ำมันปิดรอบที่เติมข้ามเดือน (เช่น รอบเปิด 27 พ.ค. ปิด 1 มิ.ย.)
-- ค่าน้ำมันควรตกเดือนของรอบ (พ.ค.) ไม่ใช่เดือนที่เติมจริง (มิ.ย.)
-- รายการน้ำมัน/จำนวนลิตร ยังคงแสดงตาม date เดิม ไม่เปลี่ยน
--
-- accounting_date เป็น nullable: ถ้า NULL ให้รายงานใช้ date ตามเดิม

ALTER TABLE fuel_records ADD COLUMN IF NOT EXISTS accounting_date TEXT;

-- Backfill รายการน้ำมันปิดรอบที่มีอยู่แล้ว
-- โค้ดรูปแบบ 'TRIP-{dispatch.code}-CLOSE' → ผูกกลับไปหา dispatch แล้วใช้ dispatch.date
UPDATE fuel_records fr
SET accounting_date = d.date
FROM dispatch d
WHERE fr.code = 'TRIP-' || d.code || '-CLOSE'
  AND fr.accounting_date IS NULL;
