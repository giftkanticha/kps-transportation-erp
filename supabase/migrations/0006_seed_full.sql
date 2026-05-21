-- Phase 1 migration: Full seed data from src/data/seed.ts
-- Extends 0004_seed_minimal.sql with the remaining employees, customers,
-- partners, subcontractors, dispatch trips, tires, fuel, expenses.
-- Idempotent: ON CONFLICT (id) DO NOTHING throughout.

-- ─── Employees (6 more, total 10) ──────────────────────────────────────────
INSERT INTO employees (id, code, name, position, license, license_status, license_expire, line_id, phone, id_card, account_bank, account_no, joined, salary, vehicle_id, status) VALUES
  ('e2',  'E002', 'วิชัย ใจดี',        'ช่าง',  '—',             'warning', '2026-06-15', '@wichai',     '081-555-3344', '1-1020-30406-13-4', 'SCB',   '098-7-65432-1', '2017-02-05', 17800, NULL, 'active'),
  ('e4',  'E004', 'Niran Phuwadon',    'คนขับ', 'ท.4 / B-66401', 'ok',      '2028-09-01', '@niran',      '087-901-2345', '5-2030-12345-67-8', 'BBL',   '445-2-11223-0', '2023-09-01', 17500, NULL, 'leave'),
  ('e5',  'E005', 'เกรียงไกร สุขใจ',    'คนขับ', 'ท.4 / B-77123', 'ok',      '2027-11-15', '@kriangkr',   '085-678-9012', '1-3030-22334-45-6', 'KBANK', '333-2-99887-7', '2022-11-15', 18800, NULL, 'active'),
  ('e7',  'E007', 'ธีรพงษ์ ผ่องใส',     'คนขับ', 'ท.4 / B-72015', 'warning', '2026-06-30', '@teerapong',  '083-456-7890', '1-5050-44556-67-8', 'KTB',   '199-1-77665-4', '2023-04-19', 17800, NULL, 'active'),
  ('e8',  'E008', 'Wirat Chaiyot',      'คนขับ', 'ท.2 / B-65778', 'expired', '2025-08-10', '@wirat',      '088-112-3456', '3-6060-55667-78-9', 'BBL',   '098-2-33445-6', '2024-08-10', 14500, NULL, 'training'),
  ('e10', 'E010', 'สมชาย ใจดี',         'ผู้ดูแลระบบ', '—', 'ok',          '—',          '@somchai_adm','081-234-5678', '1-8080-77889-90-1', 'KBANK', '555-1-12345-9', '2019-01-15', 55000, NULL, 'active')
ON CONFLICT (id) DO NOTHING;

-- ─── Customers ─────────────────────────────────────────────────────────────
INSERT INTO customers (id, code, name, contact, phone, credit, total_jobs, open_invoice, status, industry, since, address) VALUES
  ('c1', 'CUS-1001', 'บริษัท ไทยเซรามิค จำกัด',           'คุณสมหญิง', '02-345-6789', 30, 48,  285000,  'active',   'Manufacturing', '2022-01-15', 'ระยอง'),
  ('c2', 'CUS-1002', 'PTT Global Chemical Plc.',           'K. Worawit', '02-140-2000', 60, 124, 1240000, 'active',   'Petrochemical', '2021-05-22', 'ระยอง / มาบตาพุด'),
  ('c3', 'CUS-1003', 'บริษัท สยามฟู้ดส์ จำกัด (มหาชน)',    'คุณวันเพ็ญ', '02-555-7788', 45, 87,  552000,  'active',   'F&B',           '2022-11-08', 'นครปฐม'),
  ('c4', 'CUS-1004', 'CP All Co., Ltd.',                    'K. Suchart', '02-826-7000', 30, 198, 798000,  'active',   'Retail',        '2020-08-14', 'กรุงเทพ / บางนา'),
  ('c5', 'CUS-1005', 'บริษัท ไทยน้ำทิพย์ จำกัด',           'คุณภาคิน',   '02-661-2300', 30, 56,  0,       'active',   'Beverage',      '2023-02-19', 'ปทุมธานี'),
  ('c6', 'CUS-1006', 'TOA Paint (Thailand) PCL.',           'K. Anchalee','02-335-5555', 60, 34,  412000,  'active',   'Chemical',      '2023-06-30', 'สมุทรปราการ'),
  ('c7', 'CUS-1007', 'บริษัท เอ็มเค เรสโตรองต์ จำกัด',     'คุณพิชัย',   '02-248-9100', 30, 22,  98000,   'inactive', 'F&B',           '2024-01-04', 'กรุงเทพ')
ON CONFLICT (id) DO NOTHING;

-- ─── Partners (vendors/workshops/gas stations) ─────────────────────────────
INSERT INTO partners (id, code, name, type, contact, phone, address, bank, account, account_name, tax_id, balance, status) VALUES
  ('pa1', 'VND-001', 'ศูนย์ซ่อม ABC',  'ช่างภายนอก',   'K. Sirichai', '02-123-4567', '88 ถ.รามคำแหง แขวงหัวหมาก เขตบางกะปิ กรุงเทพฯ 10240',     'ธนาคารกสิกรไทย',    '123-4-56789-0', 'บริษัท เอบีซีออโต้ จำกัด',         '1234567890123', 13500, 'active'),
  ('pa2', 'VND-002', 'ร้านอะไหล่ XYZ', 'ร้านอะไหล่',   'K. Manat',    '02-987-6543', '199 ถ.สุขุมวิท แขวงพระโขนง เขตคลองเตย กรุงเทพฯ 10110',     'ธนาคารไทยพาณิชย์', '987-6-54321-0', 'บริษัท เอ็กซ์วายแซด พาร์ทส์ จำกัด','9876543210123', 45000, 'active'),
  ('pa3', 'VND-003', 'ปั๊มน้ำมัน PTT', 'ร้านค้าทั่วไป', '—',           '02-456-7890', 'สาขาบางนา-ตราด กม.7',                                       '—',                 '—',             '—',                                 '—',             0,     'active'),
  ('pa4', 'VND-004', 'คลังอะไหล่ KPS', 'คลัง KPS',     '—',           '—',           'ภายในบริษัท',                                              '—',                 '—',             '—',                                 '—',             0,     'active')
ON CONFLICT (id) DO NOTHING;

-- ─── Subcontractors ────────────────────────────────────────────────────────
INSERT INTO subcontractors (id, code, name, contact, phone, vehicles, rating, open_jobs, total_paid, status) VALUES
  ('sc1', 'SUB-001', 'หจก. รุ่งเรืองขนส่ง',  'เฮียโจ้',   '081-222-3344', 8,  4.7, 2, 1240000, 'active'),
  ('sc2', 'SUB-002', 'บริษัท ภาคพิเศษ ขนส่ง','K. Wichai', '086-111-2233', 14, 4.5, 1, 2180000, 'active'),
  ('sc3', 'SUB-003', 'ห้างหุ้นส่วน ส.โชคชัย', 'เจ๊แดง',    '089-555-7788', 5,  4.4, 0, 680000,  'active'),
  ('sc4', 'SUB-004', 'เด่นชัย Transport',     'K. Den',    '087-321-9900', 11, 4.8, 3, 1820000, 'active')
ON CONFLICT (id) DO NOTHING;

-- ─── Sub-drivers ───────────────────────────────────────────────────────────
INSERT INTO sub_drivers (id, code, name, plate, phone, id_card, license, license_expire, license_status, account_bank, account_no, status, sub_id) VALUES
  ('sd1', 'D001', 'สมชาย ใจดี',      'ABC-1234', '081-234-5678', '1-1020-30405-12-3', 'เลขที่: 6543210', '2023-11-20', 'expired', 'KBANK', '123-4-56789-0', 'active', 'sc1'),
  ('sd2', 'D002', 'สมศักดิ์ รักงาน', 'DEF-5678', '089-876-5432', '3-1020-40506-23-4', 'เลขที่: 7654321', '2026-05-15', 'warning', 'SCB',   '098-7-65432-1', 'active', 'sc2')
ON CONFLICT (id) DO NOTHING;

-- ─── Dispatch trips (a representative subset for testing) ──────────────────
INSERT INTO dispatch (id, code, customer_id, driver_id, vehicle_id, subcontractor_id, date, depart, eta, status, progress, start_odometer, end_odometer, distance, liters, km_per_l, per_diem, notes, total_amount, revenue, cost) VALUES
  ('t1',  'DSP-26051601', 'c2', 'e3', 'v1', NULL, '2026-05-16', '2026-05-16 06:30', '2026-05-16 14:30', 'in-progress', 64, 184320, NULL, 198, NULL, NULL, 400,  'ขนส่งเคมีภัณฑ์—เขตอุตสาหกรรม', 18500, 18500, 6800),
  ('t2',  'DSP-26051602', 'c4', 'e1', 'v3', NULL, '2026-05-16', '2026-05-16 04:00', '2026-05-16 18:00', 'in-progress', 38, 215510, NULL, 449, NULL, NULL, 800,  '',                                24800, 24800, 11200),
  ('t3',  'DSP-26051603', 'c1', 'e6', 'v5', NULL, '2026-05-16', '2026-05-16 07:45', '2026-05-16 13:15', 'in-progress', 82, 121180, NULL, 167, NULL, NULL, 400,  '',                                16200, 16200, 5800),
  ('t4',  'DSP-26051501', 'c3', 'e2', 'v2', NULL, '2026-05-15', '2026-05-15 05:30', '2026-05-15 09:00', 'completed',   100,91802,  91880,78,  6.5,  12.0, 300,  '',                                8400,  8400,  3200),
  ('t5',  'DSP-26051502', 'c6', 'e5', 'v6', NULL, '2026-05-14', '2026-05-14 22:00', '2026-05-15 16:30', 'completed',   100,286004, 286700,696,49.7, 14.0, 1200, '',                                32600, 32600, 14400),
  ('t6',  'DSP-26051701', 'c2', NULL, NULL, 'sc2', '2026-05-17', '2026-05-17 05:00', '2026-05-17 10:30', 'scheduled',   0,  NULL,   NULL,  218, NULL, NULL, NULL, 'มอบหมายรถร่วม',                  19400, 19400, 14600),
  ('t10', 'DSP-26051301', 'c3', 'e5', 'v6', NULL, '2026-05-13', '2026-05-13 04:00', '—',                'cancelled',   0,  NULL,   NULL,  0,   NULL, NULL, NULL, 'ลูกค้ายกเลิก',                   0,     0,     0)
ON CONFLICT (id) DO NOTHING;

-- ─── Dispatch legs ─────────────────────────────────────────────────────────
INSERT INTO dispatch_legs (dispatch_id, sort_order, origin, destination, cargo, cargo_type, price_mode, weight, price, amount) VALUES
  ('t1',  0, 'ระยอง (PTT Map Ta Phut)', 'ลาดกระบัง ICD',          'เคมีภัณฑ์',        'เคมี/IBC',         'per_ton', 22, 840,   18480),
  ('t2',  0, 'บางนา DC',                'ขอนแก่น Hub',            'FMCG',             'ทั่วไป',           'per_ton', 14, 1770,  24780),
  ('t3',  0, 'สระบุรี โรงงาน 2',         'แหลมฉบัง Port',          'เซรามิค 40''',     'ตู้คอนเทนเนอร์', 'lump',    26, 16200, 16200),
  ('t4',  0, 'นครปฐม โรงงาน 1',          'บางพลี DC',              'อาหารแช่แข็ง',     'แช่เย็น',          'per_ton', 12, 700,   8400),
  ('t5',  0, 'สมุทรปราการ คลังสินค้า',   'เชียงใหม่ คลัง 3',        'สี & เคมี',        'เคมี',             'per_ton', 18, 1811,  32600),
  ('t6',  0, 'มาบตาพุด',                'อยุธยา IE',              'เคมี IBC',         'เคมี/IBC',         'per_ton', 20, 970,   19400),
  ('t10', 0, 'นครปฐม โรงงาน 2',          'อุดรธานี Hub',           'อาหาร',            'แช่เย็น',          'per_ton', 15, 0,     0)
ON CONFLICT DO NOTHING;

-- ─── Maintenance ───────────────────────────────────────────────────────────
INSERT INTO maintenance (id, code, vehicle_id, type, workshop, partner_id, status, cost, start_date, end_date, odometer, items) VALUES
  ('m1', 'MNT-2605-01', 'v4', 'ซ่อมเครื่องยนต์',   'ศูนย์ Volvo บางนา',  'pa1', 'in-progress', 86500,  '2026-05-10', NULL,         68240,  '["เปลี่ยน Turbo","เช็ค ECU","เปลี่ยนน้ำมันเครื่อง"]'),
  ('m2', 'MNT-2605-02', 'v6', 'บำรุงรักษาตามระยะ', 'อู่ ป.พานิช',        'pa4', 'scheduled',   0,      '2026-05-22', NULL,         287120, '["เปลี่ยนน้ำมันเครื่อง 10,000 km","ตรวจเบรก","เปลี่ยนไส้กรอง"]'),
  ('m3', 'MNT-2604-04', 'v3', 'เปลี่ยนยาง',        'Bridgestone ระยอง', 'pa2', 'completed',   124000, '2026-04-28', '2026-04-28', 213500, '["เปลี่ยนยาง 6 เส้น"]'),
  ('m4', 'MNT-2604-03', 'v1', 'ระบบเบรก',          'Hino Service',       'pa3', 'completed',   42800,  '2026-04-15', '2026-04-16', 181200, '["เปลี่ยนผ้าเบรก","ตรวจสอบ ABS"]'),
  ('m5', 'MNT-2605-03', 'v5', 'แอร์ + ระบบไฟ',     'อู่ ป.พานิช',        'pa4', 'scheduled',   0,      '2026-05-25', NULL,         121450, '["เติมน้ำยาแอร์","เปลี่ยนแบตเตอรี่"]')
ON CONFLICT (id) DO NOTHING;

-- ─── Tires (sample: v1 ABC-1234 — 10 wheels + 1 spare) ─────────────────────
INSERT INTO tires (id, serial, brand, model, size, vehicle_id, position, installed_date, installed_odometer, accumulated_km, status) VALUES
  ('t1_tire', 'TIR0001', 'Bridgestone', 'T001', '11.00R20', 'v1', 'P1',      '2024-03-10', 212000, 33320,  'in-use'),
  ('t2_tire', 'TIR0002', 'Bridgestone', 'T001', '11.00R20', 'v1', 'P2',      '2024-03-10', 212000, 33320,  'in-use'),
  ('t3_tire', 'TIR0003', 'Michelin',    'XZE2', '11.00R20', 'v1', 'P3',      '2023-08-20', 198000, 47320,  'in-use'),
  ('t4_tire', 'TIR0004', 'Michelin',    'XZE2', '11.00R20', 'v1', 'P4',      '2023-08-20', 198000, 47320,  'in-use'),
  ('t5_tire', 'TIR0005', 'Goodyear',    'G159', '11.00R20', 'v1', 'P5',      '2023-06-01', 194000, 51320,  'in-use'),
  ('t6_tire', 'TIR0006', 'Goodyear',    'G159', '11.00R20', 'v1', 'P6',      '2023-06-01', 194000, 51320,  'in-use'),
  ('t7_tire', 'TIR0007', 'Bridgestone', 'T001', '11.00R20', 'v1', 'P7',      '2022-05-15', 125000, 120320, 'in-use'),
  ('t8_tire', 'TIR0008', 'Bridgestone', 'T001', '11.00R20', 'v1', 'P8',      '2022-05-15', 125000, 120320, 'in-use'),
  ('t9_tire', 'TIR0009', 'Michelin',    'XZE2', '11.00R20', 'v1', 'P9',      '2021-03-01', 60000,  185320, 'in-use'),
  ('t10_tire','TIR0010', 'Michelin',    'XZE2', '11.00R20', 'v1', 'P10',     '2021-03-01', 60000,  185320, 'in-use'),
  ('t11_tire','TIR0011', 'Bridgestone', 'T001', '11.00R20', 'v1', 'spare_1', '2025-01-01', 0,      0,      'spare')
ON CONFLICT (id) DO NOTHING;

-- ─── Fuel records (sample) ─────────────────────────────────────────────────
INSERT INTO fuel_records (id, code, vehicle_id, driver_id, station, liters, price_per_l, total, odometer, date, type) VALUES
  ('f1', 'FUL-26051601', 'v1', 'e3', 'PTT Station ลำลูกกา', 220, 32.40, 7128, 184320, '2026-05-16 06:00', 'diesel'),
  ('f2', 'FUL-26051501', 'v3', 'e1', 'บางจาก บางนา-ตราด',   180, 32.40, 5832, 215510, '2026-05-15 18:30', 'diesel'),
  ('f3', 'FUL-26051502', 'v2', 'e2', 'Shell ปทุมธานี',       240, 32.40, 7776, 91880,  '2026-05-15 14:20', 'diesel'),
  ('f4', 'FUL-26051401', 'v5', 'e6', 'PTT Station ลำลูกกา', 200, 32.40, 6480, 121180, '2026-05-14 20:00', 'diesel'),
  ('f5', 'FUL-26051402', 'v6', 'e5', 'Esso เชียงใหม่',       280, 33.10, 9268, 286700, '2026-05-14 23:15', 'diesel')
ON CONFLICT (id) DO NOTHING;

-- ─── Fuel stock receipts (tank refills) ────────────────────────────────────
INSERT INTO fuel_stock (id, date, supplier, liters, price_per_l, invoice_no, total) VALUES
  ('fs1', '2026-05-19', 'บริษัท ปตท. น้ำมัน จำกัด',             1000, 35.00, 'INV-2605191', 35000),
  ('fs2', '2026-05-10', 'บริษัท บางจาก คอร์ปอเรชั่น จำกัด',     1100, 34.50, 'INV-2605101', 37950),
  ('fs3', '2026-04-25', 'บริษัท ปตท. น้ำมัน จำกัด',             1200, 34.00, 'INV-2604251', 40800)
ON CONFLICT (id) DO NOTHING;

-- ─── Expenses (sample) ─────────────────────────────────────────────────────
INSERT INTO expenses (id, code, vehicle_id, category, note, amount, paid_by, date, driver_id, status, partner_id) VALUES
  ('x1', 'EXP-26051601', 'v1',  'ค่าทางด่วน',      'ทริป DSP-26051601 ระยอง→ลาดกระบัง', 540,   'เงินสดล่วงหน้า',   '2026-05-16', 'e3',   'approved', NULL),
  ('x2', 'EXP-26051602', 'v4',  'ค่าซ่อม',          'เปลี่ยน Turbo + ECU',               86500, 'บริษัท',           '2026-05-15', NULL,   'approved', 'pa1'),
  ('x3', 'EXP-26051501', 'v3',  'ค่าน้ำมัน',        'FUL-26051501',                      5832,  'บัตรเครดิตบริษัท', '2026-05-15', 'e1',   'approved', NULL),
  ('x4', 'EXP-26051502', 'v2',  'ค่าน้ำมัน',        'FUL-26051502',                      7776,  'บัตรเครดิตบริษัท', '2026-05-15', 'e2',   'approved', NULL),
  ('x6', 'EXP-26051401', 'v5',  'ค่าเบี้ยเลี้ยง',    'ทริปเชียงใหม่ 2 วัน',                1200,  'เงินสดล่วงหน้า',   '2026-05-14', 'e6',   'approved', NULL)
ON CONFLICT (id) DO NOTHING;

-- ─── Stock items ───────────────────────────────────────────────────────────
INSERT INTO stock_items (id, code, name, category, qty_in, qty_out, qty, unit, unit_cost, reorder_at) VALUES
  ('st1', 'BAT-12V',    'แบตเตอรี่ 12V',                  'อะไหล่',        10,  2,  8,  'ลูก',  2500, 3),
  ('st2', 'TIRE-11R',   'ยางรถ 11R22.5',                  'ยาง',           20,  0,  20, 'เส้น', 3500, 8),
  ('st3', 'OIL-15W',    'น้ำมันเครื่อง 15W-40 (ลิตร)',     'น้ำมันเครื่อง', 100, 20, 80, 'ลิตร', 350,  30),
  ('st4', 'FILTER-OIL', 'ไส้กรองน้ำมัน',                  'อะไหล่',        30,  0,  30, 'ชิ้น', 450,  10),
  ('st5', 'BRAKE-PAD',  'ผ้าเบรก',                        'อะไหล่',        15,  0,  15, 'ชุด',  1200, 6)
ON CONFLICT (id) DO NOTHING;

-- ─── Fixed costs ───────────────────────────────────────────────────────────
INSERT INTO fixed_costs (id, name, category, monthly, paid, vehicle_id) VALUES
  ('fc1', 'ค่าเช่าโกดังบางนา',        'เช่า/สถานที่', 85000,  TRUE,  NULL),
  ('fc2', 'เงินเดือนพนักงาน',         'พนักงาน',     218600, TRUE,  NULL),
  ('fc3', 'ประกันภัย Hino 700 (v1)',   'ประกัน',      8400,   TRUE,  'v1'),
  ('fc4', 'ประกันภัย Isuzu Giga (v2)', 'ประกัน',      8200,   TRUE,  'v2'),
  ('fc5', 'ภาษีรถบรรทุก (รายปี/12)',   'ภาษี',        12500,  TRUE,  NULL),
  ('fc6', 'ค่าอินเทอร์เน็ต GPS',       'ระบบ',        4800,   TRUE,  NULL),
  ('fc7', 'ค่าน้ำ-ไฟ สำนักงาน',        'Utilities',   6500,   FALSE, NULL)
ON CONFLICT (id) DO NOTHING;
