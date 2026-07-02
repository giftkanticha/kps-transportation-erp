-- ธง "เป็นคลังอะไหล่ KPS" ระดับคู่ค้า — บิลค่าใช้จ่ายที่ลงคู่ค้าที่ติดธงนี้จะตัดสต็อคอัตโนมัติ
-- แทนการผูกด้วยชื่อตรงตัว 'คลังอะไหล่ KPS' (เดิมถ้าชื่อเพี้ยน/สร้างใหม่คนละชื่อ ระบบจะไม่ตัดสต็อค)
-- โค้ดยังรองรับชื่อเดิมไว้ด้วย (backward compatible) — คู่ค้าเก่าที่ชื่อ 'คลังอะไหล่ KPS' ยังตัดสต็อคได้
ALTER TABLE partners ADD COLUMN IF NOT EXISTS is_warehouse BOOLEAN NOT NULL DEFAULT FALSE;

-- ตั้งธงให้คู่ค้าเดิมที่ชื่อ 'คลังอะไหล่ KPS' อัตโนมัติ (ตัดช่องว่างก่อนเทียบ)
UPDATE partners
SET is_warehouse = TRUE
WHERE REPLACE(name, ' ', '') = REPLACE('คลังอะไหล่ KPS', ' ', '');
