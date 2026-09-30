-- ค่าบรรทุกมาตรฐานต่อเส้นทาง (เช่น ต้นทาง KPS → ปลายทาง CP-SR เหมา 0.5 บาท/กก.) —
-- ผู้ใช้ระบุว่าเวลาเปิดงานใหม่มักรู้ราคาที่ต้องคิดอยู่แล้วตั้งแต่ต้น (อิงจากคู่เส้นทาง
-- ที่เคยวิ่งมาก่อน) จึงเก็บไว้ในตาราง routes คู่กับระยะทาง/อัตราน้ำมันมาตรฐานที่มีอยู่แล้ว
-- ใช้เป็นคำแนะนำราคาตอนกรอกขาใหม่ (ไม่ใช่ auto-fill บังคับ) — ดู DispatchRoundDetail.tsx
--
-- Production tables live in the `kps` schema, not `public` (see 0045's note on this).

ALTER TABLE kps.routes
  ADD COLUMN IF NOT EXISTS standard_price_mode TEXT
    CHECK (standard_price_mode IS NULL OR standard_price_mode IN ('per_ton', 'per_kg', 'lump')),
  ADD COLUMN IF NOT EXISTS standard_price NUMERIC;
