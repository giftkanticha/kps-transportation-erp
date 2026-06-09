-- ขาที่ไม่ต้องวางบิล / ไม่มีลูกค้า (งานภายใน, ย้ายของตัวเอง ฯลฯ)
-- ตั้ง true แล้วขานี้จะไม่ขึ้นในหน้าวางบิล/แผง "ยังไม่มีผู้รับบิล" และไม่นับเป็นยอดค้าง
ALTER TABLE dispatch_legs ADD COLUMN IF NOT EXISTS no_bill BOOLEAN NOT NULL DEFAULT false;
