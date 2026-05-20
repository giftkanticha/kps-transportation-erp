-- Phase 1 seed: minimal data for thin-slice testing of Vehicles module.
-- Only vehicles + employees (no dispatch/fuel/tires) — enough to prove CRUD works.
-- Idempotent: re-running won't duplicate rows.

-- ─── Employees (need to insert first because vehicles reference driver_id) ────
INSERT INTO employees (id, code, name, position, license, license_status, license_expire, line_id, phone, id_card, account_bank, account_no, joined, salary, status) VALUES
  ('e1', 'E001', 'สมชาย เสมเมือง', 'คนขับ', 'ท.4 / B-67334', 'ok',      '2027-03-14', '@somchai',  '086-789-0123', '1-1020-30405-12-3', 'KBANK', '123-4-56789-0', '2017-01-10', 18500, 'active'),
  ('e3', 'E003', 'ประยุทธ์ ขยันงาน', 'คนขับ', 'ท.4 / B-58902', 'ok',      '2026-07-22', '@prayut',   '089-234-1122', '3-1020-40506-23-4', 'KTB',   '012-3-45678-9', '2021-07-22', 19200, 'active'),
  ('e6', 'E006', 'Anan Srisuk',     'คนขับ', 'ท.4 / B-69445', 'ok',      '2026-12-03', '@anan',     '084-321-7788', '2-4040-33445-56-7', 'SCB',   '222-1-44556-3', '2021-12-03', 19500, 'active'),
  ('e9', 'E009', 'Pranee Saetang',  'ผู้จัดการขนส่ง', '—', 'ok', '—',           '@pranee',   '082-345-6789', '1-7070-66778-89-0', 'KBANK', '445-8-99001-2', '2020-05-01', 42000, 'active')
ON CONFLICT (id) DO NOTHING;

-- ─── Vehicles ────────────────────────────────────────────────────────────────
INSERT INTO vehicles (id, plate, type, brand, year, status, driver_id, odometer, next_service_km, fuel, last_service, next_service, purchase_date, tax, insurance, dispatch_permit) VALUES
  ('v1', 'ABC-1234', '10ล้อ', 'Isuzu FVR',       2018, 'available',   'e3', 245320, 250000, 62,  '2026-03-15', '2026-06-15', '2018-01-20', '2026-09-22', '2026-12-31', '2027-03-15'),
  ('v2', 'DEF-5678', '18ล้อ', 'Hino 500',        2019, 'warning',     NULL, 512100, 520000, 88,  '2026-04-02', '2026-06-15', '2019-03-10', '2026-06-10', '2026-08-15', '2026-12-30'),
  ('v3', 'GHI-9012', '10ล้อ', 'Hino 500',        2020, 'on-trip',     'e1', 215780, 220000, 41,  '2026-02-28', '2026-05-28', '2020-05-15', '2026-07-10', '2026-10-20', '2027-05-15'),
  ('v4', 'JKL-3456', '10ล้อ', 'Volvo FH',        2023, 'maintenance', NULL, 68240,  75000,  0,   '2026-05-10', '2026-08-10', '2023-02-22', '2026-11-18', '2027-03-22', '2027-02-22'),
  ('v5', 'MNO-7890', '10ล้อ', 'Scania R450',     2022, 'on-trip',     'e6', 121450, 125000, 55,  '2026-04-22', '2026-07-22', '2022-09-08', '2026-10-05', '2026-11-30', '2026-09-08'),
  ('v6', 'PQR-2345', '6ล้อ',  'Mitsubishi Fuso', 2019, 'available',   NULL, 287120, 290000, 30,  '2026-03-30', '2026-05-30', '2019-06-12', '2026-06-18', '2026-09-12', '2026-12-12'),
  ('v7', 'STU-6789', '4ล้อ',  'Isuzu D-Max',     2023, 'available',   NULL, 45200,  50000,  100, '2026-05-01', '2026-08-01', '2023-04-15', '2026-12-30', '2027-04-15', '2027-04-15')
ON CONFLICT (id) DO NOTHING;
