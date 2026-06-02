-- 0031: sub_drivers — extra optional fields imported from external register
--   province        — จังหวัด ที่จดทะเบียนรถ
--   follower_name   — ชื่อผู้ติดตาม (เด็กรถ)
--   follower_id_card — เลขบัตรประชาชนผู้ติดตาม
--   account_name    — ชื่อบัญชีสำหรับโอนเงิน (อาจเป็นบุคคลที่ 3)
--   vehicle_owner   — เจ้าของรถ (กรณีคนขับไม่ใช่เจ้าของ)

ALTER TABLE sub_drivers ADD COLUMN IF NOT EXISTS province         TEXT;
ALTER TABLE sub_drivers ADD COLUMN IF NOT EXISTS follower_name    TEXT;
ALTER TABLE sub_drivers ADD COLUMN IF NOT EXISTS follower_id_card TEXT;
ALTER TABLE sub_drivers ADD COLUMN IF NOT EXISTS account_name     TEXT;
ALTER TABLE sub_drivers ADD COLUMN IF NOT EXISTS vehicle_owner    TEXT;
