-- =============================================================
-- Per-user menu access permissions (สิทธิ์การเข้าเมนูรายผู้ใช้)
-- ตาราง user_menu_permissions(user_id, menu_key) — กำหนดต่อผู้ใช้
--
-- **บังคับระดับ UI** — ซ่อนเมนู sidebar + route guard ฝั่ง client
--   (canAccessRoute intersect กับ allowedKeys) ไม่กระทบ RLS ของตารางข้อมูล
--
-- semantic: มีแถว = โหมด "จำกัดสิทธิ์" (เห็นเฉพาะ menu_key ที่มีแถว)
--           ไม่มีแถวเลย = เห็นทุกเมนู (ค่าเริ่มต้น เข้ากันได้ย้อนหลัง 100%)
--   admin (SUPER_ADMIN/ADMIN) เห็นทุกเมนูเสมอ (ฝั่ง client ข้ามการตรวจ)
-- menu_key = id เมนูระดับบนใน Sidebar (dashboard, vehicles, fuel, dispatch, ...)
-- =============================================================

-- idempotent: รันซ้ำได้ปลอดภัย
CREATE TABLE IF NOT EXISTS user_menu_permissions (
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  menu_key   TEXT        NOT NULL,
  created_by UUID        REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, menu_key)
);

-- ---------- RLS ----------
-- อ่าน: ทุกคนที่ล็อกอิน (หน้าตั้งค่าต้องอ่านของทุกคน / gating อ่านของตัวเอง)
-- เขียน: admin เท่านั้น (ผ่าน get_my_role() เดิมของระบบ)
ALTER TABLE user_menu_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_menu_permissions_read  ON user_menu_permissions;
DROP POLICY IF EXISTS user_menu_permissions_write ON user_menu_permissions;
CREATE POLICY user_menu_permissions_read
  ON user_menu_permissions FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY user_menu_permissions_write
  ON user_menu_permissions FOR ALL TO authenticated
  USING (get_my_role() IN ('SUPER_ADMIN','ADMIN'))
  WITH CHECK (get_my_role() IN ('SUPER_ADMIN','ADMIN'));

-- ---------- แทนที่สิทธิ์เมนูของ user ทั้งชุดแบบ atomic (delete + insert) ----------
-- array ว่าง = ลบหมด = กลับเป็น "ทุกเมนู"
-- SECURITY DEFINER + เช็ก admin ในฟังก์ชัน (กันเรียกข้ามสิทธิ์)
CREATE OR REPLACE FUNCTION replace_user_menu_permissions(
  p_user_id  UUID,
  p_menu_keys TEXT[]
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF get_my_role() NOT IN ('SUPER_ADMIN','ADMIN') THEN
    RAISE EXCEPTION 'เฉพาะผู้ดูแลระบบเท่านั้นที่กำหนดสิทธิ์เมนูได้';
  END IF;
  DELETE FROM user_menu_permissions WHERE user_id = p_user_id;
  IF array_length(p_menu_keys, 1) > 0 THEN
    INSERT INTO user_menu_permissions (user_id, menu_key, created_by)
    SELECT p_user_id, unnest(p_menu_keys), auth.uid();
  END IF;
END;
$$;
