-- Phase 1 seed: master data for vehicles, employees, customers, partners
-- Inserts seed records used by SEED constant in src/data/seed.ts
-- Idempotent: ON CONFLICT (id) DO NOTHING

-- 1. Customers (independent)
INSERT INTO customers (id, code, name, contact, phone, credit, total_jobs, open_invoice, status, industry, since, address) VALUES
  ('c1', 'CUS-1001', 'บริษัท ไทยเซรามิค จำกัด',         'คุณสมหญิง',  '02-345-6789', 30, 48,  285000,  'active',   'Manufacturing', '2022-01-15', 'ระยอง'),
  ('c2', 'CUS-1002', 'PTT Global Chemical Plc.',         'K. Worawit',  '02-140-2000', 60, 124, 1240000, 'active',   'Petrochemical', '2021-05-22', 'ระยอง / มาบตาพุด'),
  ('c3', 'CUS-1003', 'บริษัท สยามฟู้ดส์ จำกัด (มหาชน)', 'คุณวันเพ็ญ', '02-555-7788', 45, 87,  552000,  'active',   'F&B',           '2022-11-08', 'นครปฐม'),
  ('c4', 'CUS-1004', 'CP All Co., Ltd.',                 'K. Suchart',  '02-826-7000', 30, 198, 798000,  'active',   'Retail',        '2020-08-14', 'กรุงเทพ / บางนา'),
  ('c5', 'CUS-1005', 'บริษัท ไทยน้ำทิพย์ จำกัด',          'คุณภาคิน',   '02-661-2300', 30, 56,  0,       'active',   'Beverage',      '2023-02-19', 'ปทุมธานี'),
  ('c6', 'CUS-1006', 'TOA Paint (Thailand) PCL.',        'K. Anchalee', '02-335-5555', 60, 34,  412000,  'active',   'Chemical',      '2023-06-30', 'สมุทรปราการ'),
  ('c7', 'CUS-1007', 'บริษัท เอ็มเค เรสโตรองต์ จำกัด',   'คุณพิชัย',   '02-248-9100', 30, 22,  98000,   'inactive', 'F&B',           '2024-01-04', 'กรุงเทพ')
ON CONFLICT (id) DO NOTHING;

-- 2. Partners (independent)
INSERT INTO partners (id, code, name, type, contact, phone, address, bank, account, account_name, tax_id, balance, status) VALUES
  ('pa1', 'VND-001', 'ศูนย์ซ่อม ABC',  'ช่างภายนอก',   'K. Sirichai', '02-123-4567', '88 ถ.รามคำแหง แขวงหัวหมาก เขตบางกะปิ กรุงเทพฯ 10240', 'ธนาคารกสิกรไทย',    '123-4-56789-0', 'บริษัท เอบีซีออโต้ จำกัด',   '1234567890123', 13500, 'active'),
  ('pa2', 'VND-002', 'ร้านอะไหล่ XYZ', 'ร้านอะไหล่',   'K. Manat',    '02-987-6543', '199 ถ.สุขุมวิท แขวงพระโขนง เขตคลองเตย กรุงเทพฯ 10110', 'ธนาคารไทยพาณิชย์', '987-6-54321-0', 'บริษัท เอ็กซ์วายแซด พาร์ทส์ จำกัด', '9876543210123', 45000, 'active'),
  ('pa3', 'VND-003', 'ปั๊มน้ำมัน PTT', 'ร้านค้าทั่วไป', '—',           '02-456-7890', 'สาขาบางนา-ตราด กม.7',                                '—',                 '—',             '—',                              '—',             0,     'active'),
  ('pa4', 'VND-004', 'คลังอะไหล่ KPS', 'คลัง KPS',      '—',           '—',           'ภายในบริษัท',                                       '—',                 '—',             '—',                              '—',             0,     'active')
ON CONFLICT (id) DO NOTHING;

-- 3. Employees first WITHOUT vehicle_id (FK to vehicles doesn't yet exist)
INSERT INTO employees (id, code, name, position, license, license_status, license_expire, line_id, phone, id_card, account_bank, account_no, joined, salary, vehicle_id, status) VALUES
  ('e1',  'E001', 'สมชาย เสมเมือง',      'คนขับ',          'ท.4 / B-67334', 'ok',      '2027-03-14', '@somchai',     '086-789-0123', '1-1020-30405-12-3', 'KBANK', '123-4-56789-0', '2017-01-10', 18500, NULL, 'active'),
  ('e2',  'E002', 'วิชัย ใจดี',            'ช่าง',           '—',             'warning', '2026-06-15', '@wichai',      '081-555-3344', '1-1020-30406-13-4', 'SCB',   '098-7-65432-1', '2017-02-05', 17800, NULL, 'active'),
  ('e3',  'E003', 'ประยุทธ์ ขยันงาน',      'คนขับ',          'ท.4 / B-58902', 'ok',      '2026-07-22', '@prayut',      '089-234-1122', '3-1020-40506-23-4', 'KTB',   '012-3-45678-9', '2021-07-22', 19200, NULL, 'active'),
  ('e4',  'E004', 'Niran Phuwadon',        'คนขับ',          'ท.4 / B-66401', 'ok',      '2028-09-01', '@niran',       '087-901-2345', '5-2030-12345-67-8', 'BBL',   '445-2-11223-0', '2023-09-01', 17500, NULL, 'leave'),
  ('e5',  'E005', 'เกรียงไกร สุขใจ',        'คนขับ',          'ท.4 / B-77123', 'ok',      '2027-11-15', '@kriangkr',    '085-678-9012', '1-3030-22334-45-6', 'KBANK', '333-2-99887-7', '2022-11-15', 18800, NULL, 'active'),
  ('e6',  'E006', 'Anan Srisuk',            'คนขับ',          'ท.4 / B-69445', 'ok',      '2026-12-03', '@anan',        '084-321-7788', '2-4040-33445-56-7', 'SCB',   '222-1-44556-3', '2021-12-03', 19500, NULL, 'active'),
  ('e7',  'E007', 'ธีรพงษ์ ผ่องใส',         'คนขับ',          'ท.4 / B-72015', 'warning', '2026-06-30', '@teerapong',   '083-456-7890', '1-5050-44556-67-8', 'KTB',   '199-1-77665-4', '2023-04-19', 17800, NULL, 'active'),
  ('e8',  'E008', 'Wirat Chaiyot',          'คนขับ',          'ท.2 / B-65778', 'expired', '2025-08-10', '@wirat',       '088-112-3456', '3-6060-55667-78-9', 'BBL',   '098-2-33445-6', '2024-08-10', 14500, NULL, 'training'),
  ('e9',  'E009', 'Pranee Saetang',         'ผู้จัดการขนส่ง',  '—',             'ok',      '—',          '@pranee',      '082-345-6789', '1-7070-66778-89-0', 'KBANK', '445-8-99001-2', '2020-05-01', 42000, NULL, 'active'),
  ('e10', 'E010', 'สมชาย ใจดี',             'ผู้ดูแลระบบ',    '—',             'ok',      '—',          '@somchai_adm', '081-234-5678', '1-8080-77889-90-1', 'KBANK', '555-1-12345-9', '2019-01-15', 55000, NULL, 'active')
ON CONFLICT (id) DO NOTHING;

-- 4. Vehicles (employees exist now → driver_id FK valid)
INSERT INTO vehicles (id, plate, type, brand, year, status, driver_id, odometer, next_service_km, fuel, last_service, next_service, purchase_date, tax, insurance, dispatch_permit) VALUES
  ('v1', 'ABC-1234', '10ล้อ', 'Isuzu FVR',       2018, 'available',   'e1', 245320, 250000, 62,  '2026-03-15', '2026-06-15', '2018-01-20', '2026-09-22', '2026-12-31', '2027-03-15'),
  ('v2', 'DEF-5678', '18ล้อ', 'Hino 500',        2019, 'warning',     NULL, 512100, 520000, 88,  '2026-04-02', '2026-06-15', '2019-03-10', '2026-06-10', '2026-08-15', '2026-12-30'),
  ('v3', 'GHI-9012', '10ล้อ', 'Hino 500',        2020, 'on-trip',     'e1', 215780, 220000, 41,  '2026-02-28', '2026-05-28', '2020-05-15', '2026-07-10', '2026-10-20', '2027-05-15'),
  ('v4', 'JKL-3456', '10ล้อ', 'Volvo FH',        2023, 'maintenance', NULL, 68240,  75000,  0,   '2026-05-10', '2026-08-10', '2023-02-22', '2026-11-18', '2027-03-22', '2027-02-22'),
  ('v5', 'MNO-7890', '10ล้อ', 'Scania R450',     2022, 'on-trip',     'e6', 121450, 125000, 55,  '2026-04-22', '2026-07-22', '2022-09-08', '2026-10-05', '2026-11-30', '2026-09-08'),
  ('v6', 'PQR-2345', '6ล้อ',  'Mitsubishi Fuso', 2019, 'available',   NULL, 287120, 290000, 30,  '2026-03-30', '2026-05-30', '2019-06-12', '2026-06-18', '2026-09-12', '2026-12-12'),
  ('v7', 'STU-6789', '4ล้อ',  'Isuzu D-Max',     2023, 'available',   NULL, 45200,  50000,  100, '2026-05-01', '2026-08-01', '2023-04-15', '2026-12-30', '2027-04-15', '2027-04-15')
ON CONFLICT (id) DO NOTHING;

-- 5. Back-fill employee.vehicle_id now that both tables exist
UPDATE employees SET vehicle_id = 'v3' WHERE id = 'e1' AND vehicle_id IS NULL;
UPDATE employees SET vehicle_id = 'v1' WHERE id = 'e3' AND vehicle_id IS NULL;
UPDATE employees SET vehicle_id = 'v5' WHERE id = 'e6' AND vehicle_id IS NULL;
