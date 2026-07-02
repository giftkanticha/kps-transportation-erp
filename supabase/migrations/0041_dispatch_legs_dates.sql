-- วันที่ขึ้นสินค้า (ต้นทาง/ขาไป) และวันที่ลงสินค้า (ปลายทาง) ต่อขา
-- ลดความสับสนตอนวางบิลเมื่อวันรับของกับวันส่งของไม่ตรงกัน (ข้ามวัน/ข้ามเดือน)
-- ทั้งคู่เป็น nullable — ขาเก่าที่ไม่มีค่า แอปจะ fallback ไปใช้วันที่ของรอบตอนแสดงผล
ALTER TABLE dispatch_legs ADD COLUMN IF NOT EXISTS load_date   DATE;
ALTER TABLE dispatch_legs ADD COLUMN IF NOT EXISTS unload_date DATE;
