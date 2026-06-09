// One-off import seed for รถร่วม (subcontractor drivers)
//
// Source: Excel file uploaded 2026-06-02 ("รถร่วม" sheet — 26 rows)
// Used by `src/pages/admin/ImportSubDriversPage.tsx`. Safe to delete the
// import page + this file once the data has been bulk-inserted into Supabase.

/** Subcontractor "กลุ่มขนส่ง" derived from Excel rows. One entry per unique group. */
export const SUBCONTRACTOR_IMPORTS: { code: string; name: string }[] = [
  { code: 'SUB-IMP-001', name: 'ลูกมด' },
  { code: 'SUB-IMP-002', name: 'ทิวา' },
  { code: 'SUB-IMP-003', name: 'เก่ง' },
  { code: 'SUB-IMP-004', name: 'สุขสันต์' },
  { code: 'SUB-IMP-005', name: 'ออย' },
  { code: 'SUB-IMP-006', name: 'นเรศ' },
  { code: 'SUB-IMP-007', name: 'เทียนชอ' },
  { code: 'SUB-IMP-008', name: 'ท่าเสาร์' },
  { code: 'SUB-IMP-009', name: 'โกตุย' },
  { code: 'SUB-IMP-010', name: 'SKR' },
  { code: 'SUB-IMP-011', name: 'ภูวนัย' },
]

export interface SubDriverImportRow {
  /** Excel: กลุ่มขนส่ง — used to look up the subcontractor (subId) */
  group: string
  plate: string
  province: string
  /** Excel: ชื่อ + นามสกุล combined ('-' / empty if not provided) */
  name: string
  phone: string
  idCard: string
  /** Excel: เลขใบขับขี่ */
  license: string
  bank: string
  accountNo: string
  accountName: string
  truckDump: 'dump' | 'no-dump'
  cpAccess: 'yes' | 'no'
  followerName?: string
  followerIdCard?: string
  vehicleOwner?: string
}

export const SUB_DRIVER_IMPORTS: SubDriverImportRow[] = [
  { group: 'ลูกมด',    plate: '70-1715/1744', province: 'กำแพงเพชร', name: 'ชรินทร์ บุญดี',      phone: '0819226479', idCard: '3620400741384', license: '', bank: 'KBANK', accountNo: '4432296798', accountName: 'อัญญารัตน์ บุญดี', truckDump: 'no-dump', cpAccess: 'yes', followerName: 'อัญญารัตน์ บุญดี', followerIdCard: '3620400867159' },
  { group: 'ทิวา',     plate: '70-1427/1428', province: 'กำแพงเพชร', name: 'สุวรรณ พูลแย้ม',    phone: '0818545352', idCard: '3620501269494', license: '', bank: 'KTB',   accountNo: '6210234313', accountName: 'ทิวา บุญดี',       truckDump: 'no-dump', cpAccess: 'yes', followerName: 'ทิวา บุญดี' },
  { group: 'เก่ง',     plate: '70-0940/0941', province: 'นครสวรรค์',  name: 'บุญส่ง เรืองอยู่',    phone: '0628412041', idCard: '5601100057141', license: '', bank: 'BBL',   accountNo: '3810714707', accountName: 'อระชา เรืองอยู่',   truckDump: 'no-dump', cpAccess: 'yes' },
  { group: 'สุขสันต์', plate: '70-4824/4825', province: 'กำแพงเพชร', name: 'สุขสันต์ มุกดาม่วง', phone: '0856058781', idCard: '5410100010251', license: '', bank: 'KTB',   accountNo: '5730235259', accountName: 'เยาวเรศ หอมจันทร์', truckDump: 'dump',    cpAccess: 'yes' },
  { group: 'สุขสันต์', plate: '70-3222/3223', province: 'กำแพงเพชร', name: 'วัชรา ขันทองดี',    phone: '063763580',  idCard: '3630100660303', license: '', bank: 'KTB',   accountNo: '5730235259', accountName: 'เยาวเรศ หอมจันทร์', truckDump: 'dump',    cpAccess: 'yes' },
  { group: 'สุขสันต์', plate: '70-2929/2928', province: 'กำแพงเพชร', name: 'วิสิทธิ์ แสนแดง',     phone: '0648424997', idCard: '1609900041791', license: '', bank: 'KTB',   accountNo: '5730235259', accountName: 'เยาวเรศ หอมจันทร์', truckDump: 'dump',    cpAccess: 'yes' },
  { group: 'ลูกมด',    plate: '70-4558/4559', province: 'กำแพงเพชร', name: 'กฤษฎา พันธุ์เขตร์กิจ', phone: '0947305735', idCard: '1620500031331', license: '', bank: 'SCB',   accountNo: '4050760662', accountName: 'กฤษฎา พันธุ์เขตร์กิจ', truckDump: 'dump',    cpAccess: 'yes' },
  { group: 'ออย',      plate: '70-2496/2497', province: 'กำแพงเพชร', name: 'สุริยันต์ ราหุระ',    phone: '0872087201', idCard: '',             license: '', bank: 'KBANK', accountNo: '0168851820', accountName: 'นริสา ราหุระ',      truckDump: 'no-dump', cpAccess: 'no' },
  { group: 'นเรศ',     plate: '70-2101/2102', province: 'กำแพงเพชร', name: 'นเรศ เทียนยวง',     phone: '0894960328', idCard: '3610200045082', license: '', bank: 'SCB',   accountNo: '6982255159', accountName: 'นเรศ เทียนยวง',    truckDump: 'no-dump', cpAccess: 'no' },
  { group: 'เทียนชอ',  plate: '70-5719/5720', province: 'กำแพงเพชร', name: 'จักรชัย ใจซื่อ',     phone: '0632525003', idCard: '',             license: '', bank: 'KBANK', accountNo: '0113417293', accountName: 'หจก.เทียนชอ ทรานสปอร์ต', truckDump: 'dump',    cpAccess: 'yes' },
  { group: 'เทียนชอ',  plate: '70-4588/4589', province: 'กำแพงเพชร', name: 'ไกรวิชญ์ วิจิตรปัญญา', phone: '0635469384', idCard: '',             license: '', bank: 'KBANK', accountNo: '0113417293', accountName: 'หจก.เทียนชอ ทรานสปอร์ต', truckDump: 'dump',    cpAccess: 'no' },
  { group: 'ท่าเสาร์', plate: '70-2734/2735', province: 'กำแพงเพชร', name: '',                    phone: '0926329138', idCard: '',             license: '', bank: 'SCB',   accountNo: '4030428751', accountName: 'รัตติยา ราหุระ',    truckDump: 'no-dump', cpAccess: 'no' },
  { group: 'ท่าเสาร์', plate: '70-2486/2487', province: 'กำแพงเพชร', name: '',                    phone: '',           idCard: '',             license: '', bank: 'SCB',   accountNo: '4030428751', accountName: 'รัตติยา ราหุระ',    truckDump: 'no-dump', cpAccess: 'no' },
  { group: 'ท่าเสาร์', plate: '70-2493/2494', province: 'กำแพงเพชร', name: 'เอ็ม',                 phone: '0992746288', idCard: '',             license: '', bank: 'SCB',   accountNo: '4030428751', accountName: 'รัตติยา ราหุระ',    truckDump: 'no-dump', cpAccess: 'no' },
  { group: 'ท่าเสาร์', plate: '70-3296/6688', province: 'กำแพงเพชร', name: 'เล็กนุ้ย',              phone: '0807750389', idCard: '',             license: '', bank: 'SCB',   accountNo: '4030428751', accountName: 'รัตติยา ราหุระ',    truckDump: 'no-dump', cpAccess: 'no' },
  { group: 'โกตุย',    plate: '70-3229/3230', province: 'พิษณุโลก',  name: 'ยอดชาย แสงรักษา',   phone: '097-231-0981', idCard: '',           license: '', bank: 'SCB',   accountNo: '4087009621', accountName: 'หจก.โชคนันทภรณ์ โลจิสติกส์', truckDump: 'dump',    cpAccess: 'no' },
  { group: 'โกตุย',    plate: '70-3225/3226', province: 'พิษณุโลก',  name: 'ไพรฑูรย์ แหล่งสนาม',  phone: '099-379-0369', idCard: '',           license: '', bank: 'SCB',   accountNo: '4087009621', accountName: 'หจก.โชคนันทภรณ์ โลจิสติกส์', truckDump: 'dump',    cpAccess: 'no' },
  { group: 'โกตุย',    plate: '70-3227/3228', province: 'พิษณุโลก',  name: 'กุลบุตร เผ่าคนชม',    phone: '093-045-2090', idCard: '',           license: '', bank: 'SCB',   accountNo: '4087009621', accountName: 'หจก.โชคนันทภรณ์ โลจิสติกส์', truckDump: 'dump',    cpAccess: 'no' },
  { group: 'โกตุย',    plate: '70-3217/3218', province: 'พิษณุโลก',  name: 'ประโยชน์ ไทยแท้',    phone: '098-296-1434', idCard: '',           license: '', bank: 'SCB',   accountNo: '4087009621', accountName: 'หจก.โชคนันทภรณ์ โลจิสติกส์', truckDump: 'dump',    cpAccess: 'no' },
  { group: 'โกตุย',    plate: '70-5044/5045', province: 'พิษณุโลก',  name: 'ชูเกียรติ บุญเกตุ',    phone: '095-571-8167', idCard: '',           license: '', bank: 'SCB',   accountNo: '4087009621', accountName: 'หจก.โชคนันทภรณ์ โลจิสติกส์', truckDump: 'dump',    cpAccess: 'no' },
  { group: 'โกตุย',    plate: '70-5046/5047', province: 'พิษณุโลก',  name: 'ธนากร อินทรจันทร์',  phone: '093-112-5608', idCard: '',           license: '', bank: 'SCB',   accountNo: '4087009621', accountName: 'หจก.โชคนันทภรณ์ โลจิสติกส์', truckDump: 'dump',    cpAccess: 'no' },
  { group: 'SKR',      plate: '70-1843/1844', province: 'กำแพงเพชร', name: '',                    phone: '',           idCard: '',             license: '', bank: '',      accountNo: '',           accountName: '',                   truckDump: 'dump',    cpAccess: 'yes' },
  { group: 'SKR',      plate: '70-1221/1222', province: 'กำแพงเพชร', name: '',                    phone: '',           idCard: '',             license: '', bank: '',      accountNo: '',           accountName: '',                   truckDump: 'dump',    cpAccess: 'yes' },
  { group: 'SKR',      plate: '70-6323/6324', province: 'กำแพงเพชร', name: '',                    phone: '',           idCard: '',             license: '', bank: '',      accountNo: '',           accountName: '',                   truckDump: 'dump',    cpAccess: 'yes' },
  { group: 'เก่ง',     plate: '70-4785/4786', province: 'กำแพงเพชร', name: 'จิระพงษ์ แจ่มกลิ้ง',   phone: '0622705100', idCard: '1620400152161', license: '', bank: 'KBANK', accountNo: '1843865271', accountName: 'จิระพงษ์ แจ่มกลิ้ง',  truckDump: 'no-dump', cpAccess: 'yes' },
  { group: 'ภูวนัย',   plate: '70-3883',      province: 'กำแพงเพชร', name: 'ติดต่อไลน์77',         phone: '',           idCard: '',             license: '', bank: '',      accountNo: '',           accountName: '',                   truckDump: 'no-dump', cpAccess: 'yes' },
]
