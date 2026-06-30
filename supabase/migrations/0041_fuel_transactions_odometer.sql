-- เก็บเลขไมล์ ณ ตอนเติมน้ำมันไว้บน fuel_transactions เพื่อให้หน้าปิดงานนำมา
-- "แนะนำไมล์ปิดรอบ" ได้ตรง ๆ จากรายการน้ำมัน (โดยเฉพาะน้ำมันลอยของรถคันนั้น)
-- nullable: รายการเดิมที่ไม่มีเลขไมล์ไม่กระทบ
ALTER TABLE fuel_transactions ADD COLUMN IF NOT EXISTS odometer NUMERIC;
