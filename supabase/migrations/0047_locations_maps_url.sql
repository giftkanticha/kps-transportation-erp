-- ลิงก์ Google Maps ต่อสถานที่ — ผู้ใช้วางลิงก์ที่แชร์มาจาก Google Maps เอง (ไม่ผูก API)
-- ลิงก์เต็ม (ไม่ใช่ลิงก์ย่อ maps.app.goo.gl) มักมีพิกัดฝังอยู่ในตัว URL เอง ซึ่ง
-- src/lib/mapsLink.ts จะดึงออกมาใช้แทนการค้นด้วยชื่อ/ที่อยู่ ทำให้ลิงก์เส้นทางในหน้า
-- จัดการเส้นทางมาตรฐานแม่นยำขึ้น — ดูรายละเอียดในไฟล์นั้น
--
-- Production tables live in the `kps` schema, not `public` (see 0045's note on this).

ALTER TABLE kps.locations
  ADD COLUMN IF NOT EXISTS maps_url TEXT NOT NULL DEFAULT '';
