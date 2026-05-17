import type {
  AppState,
  User,
  Employee,
  Vehicle,
  Customer,
  Subcontractor,
  Dispatch,
  Maintenance,
  Tire,
  TireEvent,
  FuelRecord,
  FuelStock,
  Expense,
  ExpenseHeader,
  ExpenseLine,
  StockItem,
  FixedCost,
  Partner,
  SubDriver,
  SubJob,
  ActivityLog,
} from '../types'

const users: User[] = [
  { id: 'u1', email: 'admin@kps.com',    name: 'สมชาย ใจดี',     role: 'admin',   avatar: 'สม', phone: '081-234-5678', title: 'ผู้ดูแลระบบ' },
  { id: 'u2', email: 'manager@kps.com',  name: 'Pranee Saetang', role: 'manager', avatar: 'PR', phone: '082-345-6789', title: 'ผู้จัดการขนส่ง' },
  { id: 'u3', email: 'employee@kps.com', name: 'วิชัย ขับดี',     role: 'driver',  avatar: 'วช', phone: '086-789-0123', title: 'พนักงานขับรถ' },
]

const employees: Employee[] = [
  { id: 'e1',  code: 'E001', name: 'สมชาย เสมเมือง',      position: 'คนขับ',          license: 'ท.4 / B-67334', licenseStatus: 'ok',      licenseExpire: '2027-03-14', lineId: '@somchai',     phone: '086-789-0123', idCard: '1-1020-30405-12-3', accountBank: 'KBANK', accountNo: '123-4-56789-0', joined: '2017-01-10', salary: 18500, vehicleId: 'v3',  status: 'active' },
  { id: 'e2',  code: 'E002', name: 'วิชัย ใจดี',            position: 'ช่าง',           license: '—',             licenseStatus: 'warning', licenseExpire: '2026-06-15', lineId: '@wichai',      phone: '081-555-3344', idCard: '1-1020-30406-13-4', accountBank: 'SCB',   accountNo: '098-7-65432-1', joined: '2017-02-05', salary: 17800, vehicleId: null, status: 'active' },
  { id: 'e3',  code: 'E003', name: 'ประยุทธ์ ขยันงาน',      position: 'คนขับ',          license: 'ท.4 / B-58902', licenseStatus: 'ok',      licenseExpire: '2026-07-22', lineId: '@prayut',      phone: '089-234-1122', idCard: '3-1020-40506-23-4', accountBank: 'KTB',   accountNo: '012-3-45678-9', joined: '2021-07-22', salary: 19200, vehicleId: 'v1',  status: 'active' },
  { id: 'e4',  code: 'E004', name: 'Niran Phuwadon',        position: 'คนขับ',          license: 'ท.4 / B-66401', licenseStatus: 'ok',      licenseExpire: '2028-09-01', lineId: '@niran',       phone: '087-901-2345', idCard: '5-2030-12345-67-8', accountBank: 'BBL',   accountNo: '445-2-11223-0', joined: '2023-09-01', salary: 17500, vehicleId: null, status: 'leave' },
  { id: 'e5',  code: 'E005', name: 'เกรียงไกร สุขใจ',        position: 'คนขับ',          license: 'ท.4 / B-77123', licenseStatus: 'ok',      licenseExpire: '2027-11-15', lineId: '@kriangkr',    phone: '085-678-9012', idCard: '1-3030-22334-45-6', accountBank: 'KBANK', accountNo: '333-2-99887-7', joined: '2022-11-15', salary: 18800, vehicleId: null, status: 'active' },
  { id: 'e6',  code: 'E006', name: 'Anan Srisuk',            position: 'คนขับ',          license: 'ท.4 / B-69445', licenseStatus: 'ok',      licenseExpire: '2026-12-03', lineId: '@anan',        phone: '084-321-7788', idCard: '2-4040-33445-56-7', accountBank: 'SCB',   accountNo: '222-1-44556-3', joined: '2021-12-03', salary: 19500, vehicleId: 'v5',  status: 'active' },
  { id: 'e7',  code: 'E007', name: 'ธีรพงษ์ ผ่องใส',         position: 'คนขับ',          license: 'ท.4 / B-72015', licenseStatus: 'warning', licenseExpire: '2026-06-30', lineId: '@teerapong',   phone: '083-456-7890', idCard: '1-5050-44556-67-8', accountBank: 'KTB',   accountNo: '199-1-77665-4', joined: '2023-04-19', salary: 17800, vehicleId: null, status: 'active' },
  { id: 'e8',  code: 'E008', name: 'Wirat Chaiyot',          position: 'คนขับ',          license: 'ท.2 / B-65778', licenseStatus: 'expired', licenseExpire: '2025-08-10', lineId: '@wirat',       phone: '088-112-3456', idCard: '3-6060-55667-78-9', accountBank: 'BBL',   accountNo: '098-2-33445-6', joined: '2024-08-10', salary: 14500, vehicleId: null, status: 'training' },
  { id: 'e9',  code: 'E009', name: 'Pranee Saetang',         position: 'ผู้จัดการขนส่ง',  license: '—',             licenseStatus: 'ok',      licenseExpire: '—',          lineId: '@pranee',      phone: '082-345-6789', idCard: '1-7070-66778-89-0', accountBank: 'KBANK', accountNo: '445-8-99001-2', joined: '2020-05-01', salary: 42000, vehicleId: null, status: 'active' },
  { id: 'e10', code: 'E010', name: 'สมชาย ใจดี',             position: 'ผู้ดูแลระบบ',    license: '—',             licenseStatus: 'ok',      licenseExpire: '—',          lineId: '@somchai_adm', phone: '081-234-5678', idCard: '1-8080-77889-90-1', accountBank: 'KBANK', accountNo: '555-1-12345-9', joined: '2019-01-15', salary: 55000, vehicleId: null, status: 'active' },
]

const vehicles: Vehicle[] = [
  { id: 'v1', plate: 'ABC-1234', type: '10ล้อ', brand: 'Isuzu FVR',       year: 2018, status: 'available',   driverId: 'e1', odometer: 245320, nextServiceKm: 250000, fuel: 62,  lastService: '2026-03-15', nextService: '2026-06-15', purchaseDate: '2018-01-20', tax: '2026-09-22', insurance: '2026-12-31', dispatchPermit: '2027-03-15' },
  { id: 'v2', plate: 'DEF-5678', type: '18ล้อ', brand: 'Hino 500',        year: 2019, status: 'warning',     driverId: null,  odometer: 512100, nextServiceKm: 520000, fuel: 88,  lastService: '2026-04-02', nextService: '2026-06-15', purchaseDate: '2019-03-10', tax: '2026-06-10', insurance: '2026-08-15', dispatchPermit: '2026-12-30' },
  { id: 'v3', plate: 'GHI-9012', type: '10ล้อ', brand: 'Hino 500',        year: 2020, status: 'on-trip',     driverId: 'e1', odometer: 215780, nextServiceKm: 220000, fuel: 41,  lastService: '2026-02-28', nextService: '2026-05-28', purchaseDate: '2020-05-15', tax: '2026-07-10', insurance: '2026-10-20', dispatchPermit: '2027-05-15' },
  { id: 'v4', plate: 'JKL-3456', type: '10ล้อ', brand: 'Volvo FH',        year: 2023, status: 'maintenance', driverId: null,  odometer: 68240,  nextServiceKm: 75000,  fuel: 0,   lastService: '2026-05-10', nextService: '2026-08-10', purchaseDate: '2023-02-22', tax: '2026-11-18', insurance: '2027-03-22', dispatchPermit: '2027-02-22' },
  { id: 'v5', plate: 'MNO-7890', type: '10ล้อ', brand: 'Scania R450',     year: 2022, status: 'on-trip',     driverId: 'e6', odometer: 121450, nextServiceKm: 125000, fuel: 55,  lastService: '2026-04-22', nextService: '2026-07-22', purchaseDate: '2022-09-08', tax: '2026-10-05', insurance: '2026-11-30', dispatchPermit: '2026-09-08' },
  { id: 'v6', plate: 'PQR-2345', type: '6ล้อ',  brand: 'Mitsubishi Fuso', year: 2019, status: 'available',   driverId: null,  odometer: 287120, nextServiceKm: 290000, fuel: 30,  lastService: '2026-03-30', nextService: '2026-05-30', purchaseDate: '2019-06-12', tax: '2026-06-18', insurance: '2026-09-12', dispatchPermit: '2026-12-12' },
  { id: 'v7', plate: 'STU-6789', type: '4ล้อ',  brand: 'Isuzu D-Max',     year: 2023, status: 'available',   driverId: null,  odometer: 45200,  nextServiceKm: 50000,  fuel: 100, lastService: '2026-05-01', nextService: '2026-08-01', purchaseDate: '2023-04-15', tax: '2026-12-30', insurance: '2027-04-15', dispatchPermit: '2027-04-15' },
]

const customers: Customer[] = [
  { id: 'c1', code: 'CUS-1001', name: 'บริษัท ไทยเซรามิค จำกัด',         contact: 'คุณสมหญิง',  phone: '02-345-6789', credit: 30, totalJobs: 48,  openInvoice: 285000,  status: 'active',   industry: 'Manufacturing', since: '2022-01-15', address: 'ระยอง' },
  { id: 'c2', code: 'CUS-1002', name: 'PTT Global Chemical Plc.',         contact: 'K. Worawit',  phone: '02-140-2000', credit: 60, totalJobs: 124, openInvoice: 1240000, status: 'active',   industry: 'Petrochemical', since: '2021-05-22', address: 'ระยอง / มาบตาพุด' },
  { id: 'c3', code: 'CUS-1003', name: 'บริษัท สยามฟู้ดส์ จำกัด (มหาชน)', contact: 'คุณวันเพ็ญ', phone: '02-555-7788', credit: 45, totalJobs: 87,  openInvoice: 552000,  status: 'active',   industry: 'F&B', since: '2022-11-08', address: 'นครปฐม' },
  { id: 'c4', code: 'CUS-1004', name: 'CP All Co., Ltd.',                  contact: 'K. Suchart',  phone: '02-826-7000', credit: 30, totalJobs: 198, openInvoice: 798000,  status: 'active',   industry: 'Retail', since: '2020-08-14', address: 'กรุงเทพ / บางนา' },
  { id: 'c5', code: 'CUS-1005', name: 'บริษัท ไทยน้ำทิพย์ จำกัด',          contact: 'คุณภาคิน',   phone: '02-661-2300', credit: 30, totalJobs: 56,  openInvoice: 0,        status: 'active',   industry: 'Beverage', since: '2023-02-19', address: 'ปทุมธานี' },
  { id: 'c6', code: 'CUS-1006', name: 'TOA Paint (Thailand) PCL.',         contact: 'K. Anchalee', phone: '02-335-5555', credit: 60, totalJobs: 34,  openInvoice: 412000,  status: 'active',   industry: 'Chemical', since: '2023-06-30', address: 'สมุทรปราการ' },
  { id: 'c7', code: 'CUS-1007', name: 'บริษัท เอ็มเค เรสโตรองต์ จำกัด',    contact: 'คุณพิชัย',   phone: '02-248-9100', credit: 30, totalJobs: 22,  openInvoice: 98000,   status: 'inactive', industry: 'F&B', since: '2024-01-04', address: 'กรุงเทพ' },
]

const subcontractors: Subcontractor[] = [
  { id: 'sc1', code: 'SUB-001', name: 'หจก. รุ่งเรืองขนส่ง',  contact: 'เฮียโจ้',   phone: '081-222-3344', vehicles: 8,  rating: 4.7, openJobs: 2, totalPaid: 1240000, status: 'active' },
  { id: 'sc2', code: 'SUB-002', name: 'บริษัท ภาคพิเศษ ขนส่ง', contact: 'K. Wichai', phone: '086-111-2233', vehicles: 14, rating: 4.5, openJobs: 1, totalPaid: 2180000, status: 'active' },
  { id: 'sc3', code: 'SUB-003', name: 'ห้างหุ้นส่วน ส.โชคชัย',  contact: 'เจ๊แดง',    phone: '089-555-7788', vehicles: 5,  rating: 4.4, openJobs: 0, totalPaid: 680000,  status: 'active' },
  { id: 'sc4', code: 'SUB-004', name: 'เด่นชัย Transport',      contact: 'K. Den',    phone: '087-321-9900', vehicles: 11, rating: 4.8, openJobs: 3, totalPaid: 1820000, status: 'active' },
]

const dispatch: Dispatch[] = [
  // Historical completed trips
  {
    id: 't101', code: 'DSP-20250415-001', customerId: 'c4', driverId: 'e1', vehicleId: 'v3', subcontractorId: null,
    date: '2025-04-15', depart: '2025-04-15 05:00', eta: '2025-04-15 18:00', status: 'completed', progress: 100,
    startOdometer: 245000, endOdometer: 245250, distance: 250, liters: 16.4, kmPerL: 15.2, perDiem: 800, notes: 'ส่งสินค้า FMCG',
    legs: [{ origin: 'กรุงเทพมหานคร', destination: 'เชียงใหม่', cargo: 'สินค้า FMCG', cargoType: 'ทั่วไป', priceMode: 'per_ton', weight: 18, price: 3600, amount: 64800 }],
    totalAmount: 64800, revenue: 64800, cost: 23800,
  },
  {
    id: 't102', code: 'DSP-20250414-012', customerId: 'c1', driverId: 'e3', vehicleId: 'v1', subcontractorId: null,
    date: '2025-04-14', depart: '2025-04-14 04:30', eta: '2025-04-14 21:00', status: 'in-progress', progress: 55,
    startOdometer: 178200, endOdometer: null, distance: null, liters: null, kmPerL: null, perDiem: 1200, notes: 'รอบ 2 ขา — ไป-กลับ นครราชสีมา',
    legs: [
      { origin: 'นครราชสีมา', destination: 'บางนา DC', cargo: 'เซรามิค', cargoType: 'บรรจุไม่ได้', priceMode: 'per_ton', weight: 16, price: 2200, amount: 35200 },
      { origin: 'บางนา DC', destination: 'นครราชสีมา', cargo: 'วัสดุก่อสร้าง', cargoType: 'บรรจุไม่ได้', priceMode: 'lump', weight: 14, price: 18800, amount: 18800 },
    ],
    totalAmount: 54000, revenue: 54000, cost: 19500,
  },
  {
    id: 't103', code: 'DSP-20250413-008', customerId: 'c5', driverId: 'e6', vehicleId: 'v5', subcontractorId: null,
    date: '2025-04-13', depart: '2025-04-13 06:00', eta: '2025-04-13 11:30', status: 'completed', progress: 100,
    startOdometer: 118200, endOdometer: 118350, distance: 150, liters: 9.2, kmPerL: 16.3, perDiem: 400, notes: '—',
    legs: [{ origin: 'ระยอง', destination: 'พัทยา', cargo: 'เครื่องดื่ม', cargoType: 'ทั่วไป', priceMode: 'per_ton', weight: 8, price: 1500, amount: 12000 }],
    totalAmount: 12000, revenue: 12000, cost: 3800,
  },
  // Current trips
  {
    id: 't1', code: 'DSP-26051601', customerId: 'c2', driverId: 'e3', vehicleId: 'v1', subcontractorId: null,
    date: '2026-05-16', depart: '2026-05-16 06:30', eta: '2026-05-16 14:30', status: 'in-progress', progress: 64,
    startOdometer: 184320, endOdometer: null, distance: 198, liters: null, kmPerL: null, perDiem: 400, notes: 'ขนส่งเคมีภัณฑ์—เขตอุตสาหกรรม',
    legs: [{ origin: 'ระยอง (PTT Map Ta Phut)', destination: 'ลาดกระบัง ICD', cargo: 'เคมีภัณฑ์', cargoType: 'เคมี/IBC', priceMode: 'per_ton', weight: 22, price: 840, amount: 18480 }],
    totalAmount: 18500, revenue: 18500, cost: 6800,
  },
  {
    id: 't2', code: 'DSP-26051602', customerId: 'c4', driverId: 'e1', vehicleId: 'v3', subcontractorId: null,
    date: '2026-05-16', depart: '2026-05-16 04:00', eta: '2026-05-16 18:00', status: 'in-progress', progress: 38,
    startOdometer: 215510, endOdometer: null, distance: 449, liters: null, kmPerL: null, perDiem: 800, notes: '—',
    legs: [{ origin: 'บางนา DC', destination: 'ขอนแก่น Hub', cargo: 'FMCG', cargoType: 'ทั่วไป', priceMode: 'per_ton', weight: 14, price: 1770, amount: 24780 }],
    totalAmount: 24800, revenue: 24800, cost: 11200,
  },
  {
    id: 't3', code: 'DSP-26051603', customerId: 'c1', driverId: 'e6', vehicleId: 'v5', subcontractorId: null,
    date: '2026-05-16', depart: '2026-05-16 07:45', eta: '2026-05-16 13:15', status: 'in-progress', progress: 82,
    startOdometer: 121180, endOdometer: null, distance: 167, liters: null, kmPerL: null, perDiem: 400, notes: '—',
    legs: [{ origin: 'สระบุรี โรงงาน 2', destination: 'แหลมฉบัง Port', cargo: 'เซรามิค 40\'', cargoType: 'ตู้คอนเทนเนอร์', priceMode: 'lump', weight: 26, price: 16200, amount: 16200 }],
    totalAmount: 16200, revenue: 16200, cost: 5800,
  },
  {
    id: 't4', code: 'DSP-26051501', customerId: 'c3', driverId: 'e2', vehicleId: 'v2', subcontractorId: null,
    date: '2026-05-15', depart: '2026-05-15 05:30', eta: '2026-05-15 09:00', status: 'completed', progress: 100,
    startOdometer: 91802, endOdometer: 91880, distance: 78, liters: 6.5, kmPerL: 12.0, perDiem: 300, notes: '—',
    legs: [{ origin: 'นครปฐม โรงงาน 1', destination: 'บางพลี DC', cargo: 'อาหารแช่แข็ง', cargoType: 'แช่เย็น', priceMode: 'per_ton', weight: 12, price: 700, amount: 8400 }],
    totalAmount: 8400, revenue: 8400, cost: 3200,
  },
  {
    id: 't5', code: 'DSP-26051502', customerId: 'c6', driverId: 'e5', vehicleId: 'v6', subcontractorId: null,
    date: '2026-05-14', depart: '2026-05-14 22:00', eta: '2026-05-15 16:30', status: 'completed', progress: 100,
    startOdometer: 286004, endOdometer: 286700, distance: 696, liters: 49.7, kmPerL: 14.0, perDiem: 1200, notes: '—',
    legs: [{ origin: 'สมุทรปราการ คลังสินค้า', destination: 'เชียงใหม่ คลัง 3', cargo: 'สี & เคมี', cargoType: 'เคมี', priceMode: 'per_ton', weight: 18, price: 1811, amount: 32600 }],
    totalAmount: 32600, revenue: 32600, cost: 14400,
  },
  {
    id: 't6', code: 'DSP-26051701', customerId: 'c2', driverId: null, vehicleId: null, subcontractorId: 'sc2',
    date: '2026-05-17', depart: '2026-05-17 05:00', eta: '2026-05-17 10:30', status: 'scheduled', progress: 0,
    startOdometer: null, endOdometer: null, distance: 218, liters: null, kmPerL: null, perDiem: null, notes: 'มอบหมายรถร่วม',
    legs: [{ origin: 'มาบตาพุด', destination: 'อยุธยา IE', cargo: 'เคมี IBC', cargoType: 'เคมี/IBC', priceMode: 'per_ton', weight: 20, price: 970, amount: 19400 }],
    totalAmount: 19400, revenue: 19400, cost: 14600,
  },
  {
    id: 't10', code: 'DSP-26051301', customerId: 'c3', driverId: 'e5', vehicleId: 'v6', subcontractorId: null,
    date: '2026-05-13', depart: '2026-05-13 04:00', eta: '—', status: 'cancelled', progress: 0,
    startOdometer: null, endOdometer: null, distance: 0, liters: null, kmPerL: null, perDiem: null, notes: 'ลูกค้ายกเลิก (เข้ารบไม่ทัน)',
    legs: [{ origin: 'นครปฐม โรงงาน 2', destination: 'อุดรธานี Hub', cargo: 'อาหาร', cargoType: 'แช่เย็น', priceMode: 'per_ton', weight: 15, price: 0, amount: 0 }],
    totalAmount: 0, revenue: 0, cost: 0,
  },
]

const maintenance: Maintenance[] = [
  { id: 'm1', code: 'MNT-2605-01', vehicleId: 'v4', type: 'ซ่อมเครื่องยนต์',   workshop: 'ศูนย์ Volvo บางนา',  partnerId: 'pa1', status: 'in-progress', cost: 86500,  startDate: '2026-05-10', endDate: null,         odometer: 68240,  items: ['เปลี่ยน Turbo', 'เช็ค ECU', 'เปลี่ยนน้ำมันเครื่อง'] },
  { id: 'm2', code: 'MNT-2605-02', vehicleId: 'v6', type: 'บำรุงรักษาตามระยะ', workshop: 'อู่ ป.พานิช',        partnerId: 'pa4', status: 'scheduled',   cost: 0,      startDate: '2026-05-22', endDate: null,         odometer: 287120, items: ['เปลี่ยนน้ำมันเครื่อง 10,000 km', 'ตรวจเบรก', 'เปลี่ยนไส้กรอง'] },
  { id: 'm3', code: 'MNT-2604-04', vehicleId: 'v3', type: 'เปลี่ยนยาง',        workshop: 'Bridgestone ระยอง', partnerId: 'pa2', status: 'completed',   cost: 124000, startDate: '2026-04-28', endDate: '2026-04-28', odometer: 213500, items: ['เปลี่ยนยาง 6 เส้น'] },
  { id: 'm4', code: 'MNT-2604-03', vehicleId: 'v1', type: 'ระบบเบรก',          workshop: 'Hino Service',       partnerId: 'pa5', status: 'completed',   cost: 42800,  startDate: '2026-04-15', endDate: '2026-04-16', odometer: 181200, items: ['เปลี่ยนผ้าเบรก', 'ตรวจสอบ ABS'] },
  { id: 'm5', code: 'MNT-2605-03', vehicleId: 'v5', type: 'แอร์ + ระบบไฟ',    workshop: 'อู่ ป.พานิช',        partnerId: 'pa4', status: 'scheduled',   cost: 0,      startDate: '2026-05-25', endDate: null,         odometer: 121450, items: ['เติมน้ำยาแอร์', 'เปลี่ยนแบตเตอรี่'] },
]

const tires: Tire[] = [
  // v1 ABC-1234 (10ล้อ) P1-P10 + spare
  { id: 't1',  serial: 'TIR0001', brand: 'Bridgestone', model: 'T001', size: '11.00R20', vehicleId: 'v1', position: 'P1',      installedDate: '2024-03-10', installedOdometer: 212000, accumulatedKm: 33320,  status: 'in-use' },
  { id: 't2',  serial: 'TIR0002', brand: 'Bridgestone', model: 'T001', size: '11.00R20', vehicleId: 'v1', position: 'P2',      installedDate: '2024-03-10', installedOdometer: 212000, accumulatedKm: 33320,  status: 'in-use' },
  { id: 't3',  serial: 'TIR0003', brand: 'Michelin',    model: 'XZE2', size: '11.00R20', vehicleId: 'v1', position: 'P3',      installedDate: '2023-08-20', installedOdometer: 198000, accumulatedKm: 47320,  status: 'in-use' },
  { id: 't4',  serial: 'TIR0004', brand: 'Michelin',    model: 'XZE2', size: '11.00R20', vehicleId: 'v1', position: 'P4',      installedDate: '2023-08-20', installedOdometer: 198000, accumulatedKm: 47320,  status: 'in-use' },
  { id: 't5',  serial: 'TIR0005', brand: 'Goodyear',    model: 'G159', size: '11.00R20', vehicleId: 'v1', position: 'P5',      installedDate: '2023-06-01', installedOdometer: 194000, accumulatedKm: 51320,  status: 'in-use' },
  { id: 't6',  serial: 'TIR0006', brand: 'Goodyear',    model: 'G159', size: '11.00R20', vehicleId: 'v1', position: 'P6',      installedDate: '2023-06-01', installedOdometer: 194000, accumulatedKm: 51320,  status: 'in-use' },
  { id: 't7',  serial: 'TIR0007', brand: 'Bridgestone', model: 'T001', size: '11.00R20', vehicleId: 'v1', position: 'P7',      installedDate: '2022-05-15', installedOdometer: 125000, accumulatedKm: 120320, status: 'in-use' },
  { id: 't8',  serial: 'TIR0008', brand: 'Bridgestone', model: 'T001', size: '11.00R20', vehicleId: 'v1', position: 'P8',      installedDate: '2022-05-15', installedOdometer: 125000, accumulatedKm: 120320, status: 'in-use' },
  { id: 't9',  serial: 'TIR0009', brand: 'Michelin',    model: 'XZE2', size: '11.00R20', vehicleId: 'v1', position: 'P9',      installedDate: '2021-03-01', installedOdometer: 60000,  accumulatedKm: 185320, status: 'in-use' },
  { id: 't10', serial: 'TIR0010', brand: 'Michelin',    model: 'XZE2', size: '11.00R20', vehicleId: 'v1', position: 'P10',     installedDate: '2021-03-01', installedOdometer: 60000,  accumulatedKm: 185320, status: 'in-use' },
  { id: 't11', serial: 'TIR0011', brand: 'Bridgestone', model: 'T001', size: '11.00R20', vehicleId: 'v1', position: 'spare_1', installedDate: '2025-01-01', installedOdometer: 0,      accumulatedKm: 0,      status: 'spare' },
  // v2 DEF-5678 (18ล้อ)
  { id: 't12', serial: 'TIR0012', brand: 'Goodyear',    model: 'G159', size: '11.00R20', vehicleId: 'v2', position: 'P1',      installedDate: '2021-06-15', installedOdometer: 80000,  accumulatedKm: 432100, status: 'in-use' },
  { id: 't13', serial: 'TIR0013', brand: 'Goodyear',    model: 'G159', size: '11.00R20', vehicleId: 'v2', position: 'P2',      installedDate: '2021-06-15', installedOdometer: 80000,  accumulatedKm: 432100, status: 'in-use' },
  { id: 't14', serial: 'TIR0014', brand: 'Bridgestone', model: 'R187', size: '11.00R20', vehicleId: 'v2', position: 'P3',      installedDate: '2022-11-10', installedOdometer: 280000, accumulatedKm: 232100, status: 'in-use' },
  { id: 't15', serial: 'TIR0015', brand: 'Bridgestone', model: 'R187', size: '11.00R20', vehicleId: 'v2', position: 'P4',      installedDate: '2022-11-10', installedOdometer: 280000, accumulatedKm: 232100, status: 'in-use' },
  { id: 't16', serial: 'TIR0016', brand: 'Michelin',    model: 'XDA2', size: '11.00R20', vehicleId: 'v2', position: 'P5',      installedDate: '2023-03-05', installedOdometer: 350000, accumulatedKm: 162100, status: 'in-use' },
  { id: 't17', serial: 'TIR0017', brand: 'Michelin',    model: 'XDA2', size: '11.00R20', vehicleId: 'v2', position: 'P6',      installedDate: '2023-03-05', installedOdometer: 350000, accumulatedKm: 162100, status: 'in-use' },
  { id: 't18', serial: 'TIR0018', brand: 'Bridgestone', model: 'R187', size: '11.00R20', vehicleId: 'v2', position: 'spare_1', installedDate: '2024-01-10', installedOdometer: 0,      accumulatedKm: 0,      status: 'spare' },
  // v3 GHI-9012 (10ล้อ)
  { id: 't19', serial: 'TIR0019', brand: 'Michelin',    model: 'XZE2', size: '11.00R20', vehicleId: 'v3', position: 'P1',      installedDate: '2022-03-01', installedOdometer: 40000,  accumulatedKm: 175780, status: 'in-use' },
  { id: 't20', serial: 'TIR0020', brand: 'Michelin',    model: 'XZE2', size: '11.00R20', vehicleId: 'v3', position: 'P2',      installedDate: '2022-03-01', installedOdometer: 40000,  accumulatedKm: 175780, status: 'in-use' },
  { id: 't21', serial: 'TIR0021', brand: 'Bridgestone', model: 'T001', size: '11.00R20', vehicleId: 'v3', position: 'P3',      installedDate: '2023-07-15', installedOdometer: 120000, accumulatedKm: 95780,  status: 'in-use' },
  { id: 't22', serial: 'TIR0022', brand: 'Bridgestone', model: 'T001', size: '11.00R20', vehicleId: 'v3', position: 'P4',      installedDate: '2023-07-15', installedOdometer: 120000, accumulatedKm: 95780,  status: 'in-use' },
  { id: 't23', serial: 'TIR0023', brand: 'Goodyear',    model: 'G159', size: '11.00R20', vehicleId: 'v3', position: 'spare_1', installedDate: '2024-02-20', installedOdometer: 0,      accumulatedKm: 0,      status: 'spare' },
  // Uninstalled / sold
  { id: 't24', serial: 'TIR0024', brand: 'Bridgestone', model: 'T001', size: '11.00R20', vehicleId: null, position: null, installedDate: '2025-05-01', installedOdometer: 0, accumulatedKm: 0,     status: 'stock' },
  { id: 't25', serial: 'TIR0025', brand: 'Michelin',    model: 'XZE2', size: '11.00R20', vehicleId: null, position: null, installedDate: '2020-01-01', installedOdometer: 0, accumulatedKm: 55000, status: 'sold' },
]

const tire_events: TireEvent[] = [
  { id: 'te1', tireId: 't1',  vehicleId: 'v1', eventType: 'install', date: '2021-05-10', odometer: 50000,  fromPos: null,      toPos: 'P1', note: 'ยางใหม่',              userId: 'e10' },
  { id: 'te2', tireId: 't3',  vehicleId: 'v1', eventType: 'swap',    date: '2022-08-20', odometer: 150000, fromPos: 'spare_1', toPos: 'P3', note: 'สลับจากยางสำรอง',     userId: 'e10' },
  { id: 'te3', tireId: 't8',  vehicleId: 'v2', eventType: 'install', date: '2020-06-15', odometer: 80000,  fromPos: null,      toPos: 'P1', note: 'ยางใหม่',              userId: 'e10' },
  { id: 'te4', tireId: 't10', vehicleId: 'v2', eventType: 'swap',    date: '2021-11-10', odometer: 280000, fromPos: 'P5',      toPos: 'P3', note: 'หมุนยาง หน้า-หลัง', userId: 'e10' },
]

const fuel: FuelRecord[] = [
  { id: 'f1', code: 'FUL-26051601', vehicleId: 'v1', driverId: 'e3', station: 'PTT Station ลำลูกกา', liters: 220, pricePerL: 32.40, total: 7128, odometer: 184320, date: '2026-05-16 06:00', type: 'diesel' },
  { id: 'f2', code: 'FUL-26051501', vehicleId: 'v3', driverId: 'e1', station: 'บางจาก บางนา-ตราด',    liters: 180, pricePerL: 32.40, total: 5832, odometer: 215510, date: '2026-05-15 18:30', type: 'diesel' },
  { id: 'f3', code: 'FUL-26051502', vehicleId: 'v2', driverId: 'e2', station: 'Shell ปทุมธานี',        liters: 240, pricePerL: 32.40, total: 7776, odometer: 91880,  date: '2026-05-15 14:20', type: 'diesel' },
  { id: 'f4', code: 'FUL-26051401', vehicleId: 'v5', driverId: 'e6', station: 'PTT Station ลำลูกกา', liters: 200, pricePerL: 32.40, total: 6480, odometer: 121180, date: '2026-05-14 20:00', type: 'diesel' },
  { id: 'f5', code: 'FUL-26051402', vehicleId: 'v6', driverId: 'e5', station: 'Esso เชียงใหม่',        liters: 280, pricePerL: 33.10, total: 9268, odometer: 286700, date: '2026-05-14 23:15', type: 'diesel' },
  { id: 'f6', code: 'FUL-26051301', vehicleId: 'v7', driverId: 'e7', station: 'PTT Station ลำลูกกา', liters: 195, pricePerL: 32.40, total: 6318, odometer: 44950,  date: '2026-05-13 19:45', type: 'diesel' },
]

const fuelStock: FuelStock[] = [
  { id: 'fs1', date: '2025-05-15', supplier: 'PTT Station', liters: 1000, pricePerL: 35.0, invoiceNo: 'INV-20240515', total: 35000 },
  { id: 'fs2', date: '2025-05-01', supplier: 'Bangchak',    liters: 1100, pricePerL: 34.5, invoiceNo: 'INV-20240501', total: 37950 },
  { id: 'fs3', date: '2025-04-15', supplier: 'PTT Station', liters: 1200, pricePerL: 34.0, invoiceNo: 'INV-20240415', total: 40800 },
]

const expenses: Expense[] = [
  { id: 'x1', code: 'EXP-26051601', vehicleId: 'v1', category: 'ค่าทางด่วน',    note: 'ทริป DSP-26051601 ระยอง→ลาดกระบัง', amount: 540,   paidBy: 'เงินสดล่วงหน้า',    date: '2026-05-16', driverId: 'e3', status: 'approved' },
  { id: 'x2', code: 'EXP-26051602', vehicleId: 'v4', category: 'ค่าซ่อม',        note: 'เปลี่ยน Turbo + ECU',             amount: 86500, paidBy: 'บริษัท',             date: '2026-05-15', driverId: null, status: 'approved', partnerId: 'pa1' },
  { id: 'x3', code: 'EXP-26051501', vehicleId: 'v3', category: 'ค่าน้ำมัน',      note: 'FUL-26051501',                    amount: 5832,  paidBy: 'บัตรเครดิตบริษัท',  date: '2026-05-15', driverId: 'e1', status: 'approved' },
  { id: 'x4', code: 'EXP-26051502', vehicleId: 'v2', category: 'ค่าน้ำมัน',      note: 'FUL-26051502',                    amount: 7776,  paidBy: 'บัตรเครดิตบริษัท',  date: '2026-05-15', driverId: 'e2', status: 'approved' },
  { id: 'x5', code: 'EXP-26051503', vehicleId: 'v1', category: 'ค่าทางด่วน',    note: 'ทริป ลาดกระบัง',                  amount: 420,   paidBy: 'เงินสดล่วงหน้า',    date: '2026-05-15', driverId: 'e3', status: 'pending' },
  { id: 'x6', code: 'EXP-26051401', vehicleId: 'v5', category: 'ค่าเบี้ยเลี้ยง', note: 'ทริปเชียงใหม่ 2 วัน',             amount: 1200,  paidBy: 'เงินสดล่วงหน้า',    date: '2026-05-14', driverId: 'e6', status: 'approved' },
  { id: 'x7', code: 'EXP-26051402', vehicleId: 'v6', category: 'ค่าจอดรถ',      note: 'DC อุดร 2 คืน',                   amount: 600,   paidBy: 'เงินสดล่วงหน้า',    date: '2026-05-14', driverId: 'e5', status: 'approved' },
  { id: 'x8', code: 'EXP-26051301', vehicleId: null, category: 'ค่าจ้างรถร่วม',  note: 'SUB-002 รถ 2 คัน',               amount: 14600, paidBy: 'บริษัท',             date: '2026-05-13', driverId: null, status: 'pending' },
]

const expenseHeaders: ExpenseHeader[] = [
  { id: 'eh1', code: 'EXH-001', date: '2025-05-15', vehicleId: 'v1', partnerId: 'pa1', odometer: 245000, paid: false, dueDate: '2025-05-30', total: 13500, lineCount: 2, note: 'แบตเตอรี่ ซ่อมห้ามเบรก' },
  { id: 'eh2', code: 'EXH-002', date: '2025-05-10', vehicleId: 'v2', partnerId: 'pa2', odometer: 510000, paid: false, dueDate: '2025-05-25', total: 45000, lineCount: 3, note: 'ยาง 11R22.5, ค่าติดตั้งยาง, ค่าตรวจสภาพทั่วไป' },
  { id: 'eh3', code: 'EXH-003', date: '2025-04-20', vehicleId: 'v1', partnerId: 'pa3', odometer: 243800, paid: true,  dueDate: '2025-05-05', total: 8500,  lineCount: 1, note: 'ถ่ายน้ำมันเครื่อง' },
]

const expenseLines: ExpenseLine[] = [
  { id: 'el1', headerId: 'eh1', invoiceNo: 'INV-2401', item: 'แบตเตอรี่ 12V',    category: 'อะไหล่',   qty: 2, unitPrice: 2500,  amount: 5000,  note: '' },
  { id: 'el2', headerId: 'eh1', invoiceNo: 'INV-2402', item: 'ซ่อมห้ามเบรก',     category: 'ค่าบริการ', qty: 1, unitPrice: 8500,  amount: 8500,  note: '' },
  { id: 'el3', headerId: 'eh2', invoiceNo: 'INV-2410', item: 'ยาง 11R22.5',      category: 'ยาง',      qty: 6, unitPrice: 3500,  amount: 21000, note: '' },
  { id: 'el4', headerId: 'eh2', invoiceNo: 'INV-2411', item: 'ค่าติดตั้งยาง',    category: 'ค่าบริการ', qty: 6, unitPrice: 500,   amount: 3000,  note: '' },
  { id: 'el5', headerId: 'eh2', invoiceNo: 'INV-2412', item: 'ตรวจสภาพทั่วไป',   category: 'ค่าบริการ', qty: 1, unitPrice: 21000, amount: 21000, note: '' },
  { id: 'el6', headerId: 'eh3', invoiceNo: 'INV-2350', item: 'ถ่ายน้ำมันเครื่อง', category: 'น้ำมัน',   qty: 1, unitPrice: 8500,  amount: 8500,  note: '' },
]

const stock: StockItem[] = [
  { id: 'st1', code: 'BAT-12V',    name: 'แบตเตอรี่ 12V',                    category: 'อะไหล่',        in: 10,  out: 2,  qty: 8,  unit: 'ลูก',  unitCost: 2500, reorderAt: 3 },
  { id: 'st2', code: 'TIRE-11R',   name: 'ยางรถ 11R22.5',                    category: 'ยาง',           in: 20,  out: 0,  qty: 20, unit: 'เส้น', unitCost: 3500, reorderAt: 8 },
  { id: 'st3', code: 'OIL-15W',    name: 'น้ำมันเครื่อง 15W-40 (ลิตร)',      category: 'น้ำมันเครื่อง', in: 100, out: 20, qty: 80, unit: 'ลิตร', unitCost: 350,  reorderAt: 30 },
  { id: 'st4', code: 'FILTER-OIL', name: 'ไส้กรองน้ำมัน',                    category: 'อะไหล่',        in: 30,  out: 0,  qty: 30, unit: 'ชิ้น', unitCost: 450,  reorderAt: 10 },
  { id: 'st5', code: 'BRAKE-PAD',  name: 'ผ้าเบรก',                          category: 'อะไหล่',        in: 15,  out: 0,  qty: 15, unit: 'ชุด',  unitCost: 1200, reorderAt: 6 },
]

const fixedCosts: FixedCost[] = [
  { id: 'fc1', name: 'ค่าเช่าโกดังบางนา',        category: 'เช่า/สถานที่', monthly: 85000,  paid: true,  vehicleId: null },
  { id: 'fc2', name: 'เงินเดือนพนักงาน',         category: 'พนักงาน',     monthly: 218600, paid: true,  vehicleId: null },
  { id: 'fc3', name: 'ประกันภัย Hino 700 (v1)',   category: 'ประกัน',      monthly: 8400,   paid: true,  vehicleId: 'v1' },
  { id: 'fc4', name: 'ประกันภัย Isuzu Giga (v2)', category: 'ประกัน',      monthly: 8200,   paid: true,  vehicleId: 'v2' },
  { id: 'fc5', name: 'ภาษีรถบรรทุก (รายปี/12)',   category: 'ภาษี',        monthly: 12500,  paid: true,  vehicleId: null },
  { id: 'fc6', name: 'ค่าอินเทอร์เน็ต GPS',       category: 'ระบบ',        monthly: 4800,   paid: true,  vehicleId: null },
  { id: 'fc7', name: 'ค่าน้ำ-ไฟ สำนักงาน',        category: 'Utilities',   monthly: 6500,   paid: false, vehicleId: null },
]

const partners: Partner[] = [
  { id: 'pa1', code: 'VND-001', name: 'ศูนย์ซ่อม ABC',  type: 'ช่างภายนอก',   contact: 'K. Sirichai', phone: '02-123-4567', bank: 'ธนาคารกสิกรไทย',    account: '123-4-56789-0', taxId: '1234567890123', balance: 13500, status: 'active' },
  { id: 'pa2', code: 'VND-002', name: 'ร้านอะไหล่ XYZ', type: 'ร้านอะไหล่',   contact: 'K. Manat',    phone: '02-987-6543', bank: 'ธนาคารไทยพาณิชย์', account: '987-6-54321-0', taxId: '9876543210123', balance: 45000, status: 'active' },
  { id: 'pa3', code: 'VND-003', name: 'ปั๊มน้ำมัน PTT', type: 'ร้านค้าทั่วไป', contact: '—',           phone: '02-456-7890', bank: '—',                 account: '—',             taxId: '—',             balance: 0,     status: 'active' },
  { id: 'pa4', code: 'VND-004', name: 'คลังอะไหล่ KPS', type: 'คลัง KPS',      contact: '—',           phone: '—',           bank: '—',                 account: '—',             taxId: '—',             balance: 0,     status: 'active' },
]

const subDrivers: SubDriver[] = [
  { id: 'sd1', code: 'D001', name: 'สมชาย ใจดี',     plate: 'ABC-1234', phone: '081-234-5678', idCard: '1-1020-30405-12-3', license: 'เลขที่: 6543210', licenseExpire: '2023-11-20', licenseStatus: 'expired', accountBank: 'KBANK', accountNo: '123-4-56789-0', status: 'active', subId: 'sc1' },
  { id: 'sd2', code: 'D002', name: 'สมศักดิ์ รักงาน', plate: 'DEF-5678', phone: '089-876-5432', idCard: '3-1020-40506-23-4', license: 'เลขที่: 7654321', licenseExpire: '2026-05-15', licenseStatus: 'warning', accountBank: 'SCB',   accountNo: '098-7-65432-1', status: 'active', subId: 'sc2' },
]

const subJobs: SubJob[] = [
  { id: 'sj1', code: 'SUB-001', date: '2024-04-15', subId: 'sc1', driverId: 'sd1', plate: 'ABC-1234', driverName: 'สมชาย ใจดี',     category: '10ล้อ', destination: 'Chiang Mai', origin: 'กรุงเทพ', weight: 18000, finalWeight: 18000, mode: 'per_ton', price: 2500, total: 45000, status: 'unpaid', bank: 'กรุงไทย' },
  { id: 'sj2', code: 'SUB-002', date: '2024-04-14', subId: 'sc2', driverId: 'sd2', plate: 'DEF-5678', driverName: 'สมศักดิ์ รักงาน', category: '10ล้อ', destination: 'Rayong',     origin: 'กรุงเทพ', weight: 10000, finalWeight: 10000, mode: 'per_ton', price: 2500, total: 25000, status: 'paid',   bank: 'ธนาคารไทยพาณิชย์' },
  { id: 'sj3', code: 'SUB-003', date: '2024-04-16', subId: 'sc2', driverId: 'sd2', plate: 'DEF-5678', driverName: 'สมศักดิ์ รักงาน', category: '10ล้อ', destination: 'Phuket',     origin: 'กรุงเทพ', weight: 0,     finalWeight: 0,     mode: 'lump',    price: 0,    total: 0,     status: 'open',   bank: 'กสิกรไทย' },
]

const activity: ActivityLog[] = [
  { id: 'a1', at: '2026-05-16 11:42', who: 'Pranee Saetang', text: 'อนุมัติงาน DSP-26051701',                      type: 'approve' },
  { id: 'a2', at: '2026-05-16 10:15', who: 'สมชาย ใจดี',     text: 'เพิ่มลูกค้าใหม่ TOA Paint',                    type: 'create' },
  { id: 'a3', at: '2026-05-16 09:32', who: 'วิชัย ขับดี',     text: 'เริ่มงานขนส่ง DSP-26051602',                   type: 'trip' },
  { id: 'a4', at: '2026-05-16 08:10', who: 'ระบบ',           text: 'แจ้งเตือน: ยาง 70-2451 (RR2) ต่ำกว่าเกณฑ์',   type: 'alert' },
  { id: 'a5', at: '2026-05-16 07:00', who: 'Pranee Saetang', text: 'ส่งใบแจ้งหนี้ INV-2605-014 ให้ CP All',         type: 'invoice' },
  { id: 'a6', at: '2026-05-15 17:45', who: 'ระบบ',           text: 'งานขนส่ง DSP-26051502 จัดส่งสำเร็จ',           type: 'trip' },
  { id: 'a7', at: '2026-05-15 14:20', who: 'Somsak Wongchai', text: 'เติมน้ำมันรถ 70-3318 จำนวน 240 ลิตร',          type: 'fuel' },
  { id: 'a8', at: '2026-05-15 11:00', who: 'ระบบ',           text: 'แจ้งเตือน: รถ 70-7890 ครบกำหนดบำรุงรักษา',    type: 'alert' },
]

export const SEED: AppState = {
  users,
  employees,
  vehicles,
  customers,
  subcontractors,
  dispatch,
  maintenance,
  tires,
  tire_events,
  tire_scrap_sales: [],
  fuel,
  fuelStock,
  expenses,
  expenseHeaders,
  expenseLines,
  stock,
  fixedCosts,
  partners,
  subDrivers,
  subJobs,
  activity,
}
