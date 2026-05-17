interface StatusBadgeProps {
  status: string
}

interface BadgeConfig {
  cls: string
  label: string
}

const STATUS_MAP: Record<string, BadgeConfig> = {
  // trips
  'in-transit':  { cls: 'blue',   label: 'กำลังขนส่ง' },
  'delivered':   { cls: 'green',  label: 'ส่งสำเร็จ' },
  'scheduled':   { cls: 'gray',   label: 'นัดหมาย' },
  'cancelled':   { cls: 'red',    label: 'ยกเลิก' },
  'draft':       { cls: 'gray',   label: 'ร่าง' },
  // drivers
  'on-duty':     { cls: 'blue',   label: 'ปฏิบัติงาน' },
  'leave':       { cls: 'amber',  label: 'ลา' },
  'training':    { cls: 'violet', label: 'อบรม' },
  // vehicles
  'on-trip':     { cls: 'blue',   label: 'ออกงาน' },
  'idle':        { cls: 'gray',   label: 'ว่าง' },
  'available':   { cls: 'green',  label: 'พร้อม' },
  'warning':     { cls: 'amber',  label: 'เตือน' },
  'unavailable': { cls: 'red',    label: 'ไม่พร้อม' },
  'maintenance': { cls: 'amber',  label: 'ซ่อมบำรุง' },
  // maintenance
  'in-progress': { cls: 'amber',  label: 'กำลังดำเนินการ' },
  'completed':   { cls: 'green',  label: 'เสร็จสิ้น' },
  // customers
  'active':      { cls: 'green',  label: 'Active' },
  'inactive':    { cls: 'gray',   label: 'Inactive' },
  // tires
  'good':        { cls: 'green',  label: 'ดี' },
  'critical':    { cls: 'red',    label: 'วิกฤติ' },
  // expenses / payable
  'paid':        { cls: 'green',  label: 'ชำระแล้ว' },
  'unpaid':      { cls: 'amber',  label: 'ค้างชำระ' },
  'overdue':     { cls: 'red',    label: 'เกินกำหนด' },
  // employee license
  'ok':          { cls: 'green',  label: 'ถูกต้อง' },
  'expired':     { cls: 'red',    label: 'หมดอายุแล้ว' },
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const c = STATUS_MAP[status] ?? { cls: 'gray', label: status }
  return (
    <span className={`badge ${c.cls}`}>
      <span className="dot" />
      {c.label}
    </span>
  )
}
