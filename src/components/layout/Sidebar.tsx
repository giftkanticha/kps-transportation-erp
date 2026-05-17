import { useState, useEffect } from 'react'
import type { User } from '../../types'
import { Icon } from '../ui'

interface MenuItem {
  id: string
  label: string
  icon: string
  roles: string[]
  sub?: SubMenuItem[]
}

interface SubMenuItem {
  id: string
  label: string
}

const MENU: MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', roles: ['admin', 'manager', 'driver'] },
  {
    id: 'vehicles', label: 'จัดการรถ', icon: 'truck', roles: ['admin', 'manager'],
    sub: [
      { id: 'vehicles', label: 'รายการรถทั้งหมด' },
      { id: 'vehicles.add', label: 'เพิ่มรถใหม่' },
      { id: 'vehicles.detail', label: 'รายละเอียดรถ' },
    ],
  },
  {
    id: 'employees', label: 'ข้อมูลพนักงาน', icon: 'users', roles: ['admin', 'manager'],
    sub: [
      { id: 'employees', label: 'รายชื่อพนักงาน' },
      { id: 'employees.add', label: 'เพิ่มพนักงานใหม่' },
    ],
  },
  {
    id: 'tires', label: 'ระบบยาง', icon: 'tire', roles: ['admin', 'manager'],
    sub: [
      { id: 'tires', label: 'รายการยางทั้งหมด' },
      { id: 'tires.layout', label: 'ผังยางปัจจุบัน' },
      { id: 'tires.manage', label: 'จัดการและสลับยาง' },
      { id: 'tires.history', label: 'ประวัติยางรายเส้น' },
    ],
  },
  {
    id: 'fuel', label: 'ระบบน้ำมัน', icon: 'fuel', roles: ['admin', 'manager'],
    sub: [
      { id: 'fuel', label: 'ภาพรวมคลังน้ำมัน' },
      { id: 'fuel.logs', label: 'บันทึกน้ำมัน' },
      { id: 'fuel.report', label: 'รายงานน้ำมันรายเดือน' },
    ],
  },
  {
    id: 'dispatch', label: 'งานขนส่ง', icon: 'package', roles: ['admin', 'manager', 'driver'],
    sub: [
      { id: 'dispatch.open', label: 'เปิดงานขนส่ง' },
      { id: 'dispatch.close', label: 'ปิดงานขนส่ง' },
      { id: 'dispatch.report', label: 'รายงานสรุป' },
      { id: 'dispatch.history', label: 'ประวัติงาน' },
    ],
  },
  {
    id: 'subcontractors', label: 'รถรับจ้างร่วม', icon: 'truck2', roles: ['admin', 'manager'],
    sub: [
      { id: 'subcontractors', label: 'เปิดงาน' },
      { id: 'subcontractors.close', label: 'ปิดงาน' },
      { id: 'subcontractors.history', label: 'ประวัติการจ้าง' },
      { id: 'subcontractors.drivers', label: 'คนขับรถร่วม' },
    ],
  },
  {
    id: 'expenses', label: 'ค่าใช้จ่าย', icon: 'wallet', roles: ['admin', 'manager'],
    sub: [
      { id: 'expenses', label: 'บันทึกค่าใช้จ่าย' },
      { id: 'expenses.finance', label: 'สถานะการเงิน' },
      { id: 'expenses.stock', label: 'สต๊อคคลัง KPS' },
      { id: 'expenses.report', label: 'รายงานสรุป' },
      { id: 'expenses.vendors', label: 'ทะเบียนช่าง/ผู้ขาย' },
    ],
  },
  {
    id: 'finance', label: 'การเงิน', icon: 'chart', roles: ['admin', 'manager'],
    sub: [
      { id: 'finance', label: 'P&L รายคัน' },
      { id: 'finance.fixed', label: 'ค่าใช้จ่ายคงที่' },
      { id: 'finance.summary', label: 'รายงานสรุป' },
    ],
  },
  {
    id: 'settings', label: 'ตั้งค่า', icon: 'settings', roles: ['admin'],
    sub: [
      { id: 'settings.users', label: 'จัดการผู้ใช้งาน' },
      { id: 'settings.company', label: 'ข้อมูลบริษัท' },
    ],
  },
]

interface SidebarProps {
  collapsed: boolean
  setCollapsed: (v: boolean) => void
  active: string
  setActive: (id: string) => void
  user: User
  onLogout?: () => void
}

export function Sidebar({ collapsed, setCollapsed, active, setActive, user, onLogout }: SidebarProps) {
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {}
    MENU.forEach(m => {
      if (m.sub && m.sub.some(s => s.id === active || active.startsWith(m.id + '.'))) {
        o[m.id] = true
      }
    })
    return o
  })

  useEffect(() => {
    if (collapsed) return
    MENU.forEach(m => {
      if (m.sub && m.sub.some(s => s.id === active)) {
        setOpen(prev => prev[m.id] ? prev : { ...prev, [m.id]: true })
      }
    })
  }, [active, collapsed])

  const can = (roles: string[]) => roles.includes(user.role)
  const sectionActive = (m: MenuItem) =>
    active === m.id ||
    (m.sub != null && m.sub.some(s => s.id === active)) ||
    active.startsWith(m.id + '.')

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="mark">K</div>
        <span className="name">KPS ERP</span>
        <button
          className="collapse-btn"
          onClick={() => setCollapsed(!collapsed)}
          title="ย่อ/ขยายแถบ"
        >
          <Icon name="chevron-right" size={15} style={{ transform: 'rotate(180deg)' }} />
        </button>
      </div>

      <nav className="nav">
        {MENU.filter(m => can(m.roles)).map(m => {
          const sec = sectionActive(m)
          const hasSub = !!m.sub

          return (
            <div className="nav-group" key={m.id}>
              <div
                className={[
                  'nav-item',
                  hasSub ? 'parent' : '',
                  sec && !hasSub ? 'active' : '',
                  sec ? 'active-section' : '',
                  open[m.id] ? 'open' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => {
                  if (hasSub) {
                    if (collapsed) {
                      setCollapsed(false)
                      setOpen({ [m.id]: true })
                    } else {
                      setOpen(p => ({ ...p, [m.id]: !p[m.id] }))
                    }
                  } else {
                    setActive(m.id)
                  }
                }}
                title={collapsed ? m.label : undefined}
              >
                <span className="icn">
                  <Icon name={m.icon} size={18} />
                </span>
                <span className="lbl">{m.label}</span>
                {hasSub && (
                  <span className="chev">
                    <Icon name="chevron-right" size={14} />
                  </span>
                )}
              </div>

              {hasSub && open[m.id] && !collapsed && (
                <div className="subnav">
                  {m.sub!.map(s => (
                    <div
                      key={s.id}
                      className={`subnav-item ${active === s.id ? 'active' : ''}`}
                      onClick={() => setActive(s.id)}
                    >
                      {s.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      <div className="foot">
        <button
          className="logout-btn"
          onClick={onLogout}
        >
          <Icon name="logout" size={18} />
          <span>ออกจากระบบ</span>
        </button>
      </div>
    </aside>
  )
}
