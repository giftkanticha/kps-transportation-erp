import { useState, useEffect } from 'react'
import type { User } from '../../types'
import { canAccessRoute } from '../../lib/permissions'
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
  emoji?: string
}

const MENU: MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', roles: ['admin', 'manager', 'driver'] },
  {
    id: 'vehicles', label: 'จัดการรถ', icon: 'truck', roles: ['admin', 'manager', 'driver'],
    sub: [
      { id: 'vehicles', label: 'รายการรถทั้งหมด', emoji: '🚛' },
      { id: 'vehicles.add', label: 'เพิ่มรถใหม่', emoji: '➕' },
      { id: 'vehicles.detail', label: 'รายละเอียดรถ', emoji: '🔍' },
    ],
  },
  {
    id: 'employees', label: 'ข้อมูลพนักงาน', icon: 'users', roles: ['admin', 'manager'],
    sub: [
      { id: 'employees', label: 'รายชื่อพนักงาน', emoji: '👥' },
      { id: 'employees.add', label: 'เพิ่มพนักงานใหม่', emoji: '➕' },
    ],
  },
  {
    id: 'tires', label: 'ระบบยาง', icon: 'tire', roles: ['admin', 'manager'],
    sub: [
      { id: 'tires', label: 'รายการยางทั้งหมด', emoji: '📋' },
      { id: 'tires.layout', label: 'ผังยางปัจจุบัน', emoji: '🛞' },
      { id: 'tires.manage', label: 'จัดการและสลับยาง', emoji: '🔄' },
      { id: 'tires.history', label: 'ประวัติยางรายเส้น', emoji: '🕘' },
      { id: 'tires.scrapped', label: 'ยางหมดสภาพ', emoji: '🗑️' },
    ],
  },
  {
    id: 'fuel', label: 'ระบบน้ำมัน', icon: 'fuel', roles: ['admin', 'manager'],
    sub: [
      { id: 'fuel', label: 'ภาพรวมคลังน้ำมัน', emoji: '📊' },
      { id: 'fuel.express', label: 'คีย์ด่วนน้ำมัน', emoji: '⚡' },
      { id: 'fuel.floating', label: 'น้ำมันลอยรอผูก', emoji: '🟡' },
      { id: 'fuel.report', label: 'รายงานน้ำมันรายเดือน', emoji: '📈' },
      { id: 'fuel.summary', label: 'สรุปคลังน้ำมันรวม', emoji: '📦' },
    ],
  },
  {
    id: 'dispatch', label: 'งานขนส่ง', icon: 'package', roles: ['admin', 'manager', 'driver'],
    sub: [
      { id: 'dispatch.open', label: 'เปิดงานขนส่ง', emoji: '📝' },
      { id: 'dispatch.close', label: 'ปิดงานขนส่ง', emoji: '✅' },
      { id: 'dispatch.report', label: 'รายงานสรุป', emoji: '📊' },
      { id: 'dispatch.history', label: 'ประวัติการวิ่งงาน', emoji: '🕘' },
    ],
  },
  {
    id: 'subcontractors', label: 'รถรับจ้างร่วม', icon: 'truck2', roles: ['admin', 'manager'],
    sub: [
      { id: 'subcontractors', label: 'เปิดงาน', emoji: '📝' },
      { id: 'subcontractors.close', label: 'ปิดงาน', emoji: '✅' },
      { id: 'subcontractors.history', label: 'ประวัติการจ้าง', emoji: '🕘' },
      { id: 'subcontractors.drivers', label: 'คนขับรถร่วม', emoji: '🧑‍✈️' },
    ],
  },
  {
    id: 'expenses', label: 'ค่าใช้จ่าย', icon: 'wallet', roles: ['admin', 'manager'],
    sub: [
      { id: 'expenses', label: 'บันทึกค่าใช้จ่าย', emoji: '📝' },
      { id: 'expenses.finance', label: 'สถานะการเงิน', emoji: '💰' },
      { id: 'expenses.stock', label: 'สต๊อคคลัง KPS', emoji: '📦' },
      { id: 'expenses.report', label: 'รายงานสรุป', emoji: '📊' },
      { id: 'expenses.vendors', label: 'ทะเบียนร้านค้า/ช่าง', emoji: '🏪' },
    ],
  },
  {
    id: 'finance', label: 'การเงิน', icon: 'chart', roles: ['admin', 'manager'],
    sub: [
      { id: 'finance', label: 'P&L รายคัน', emoji: '💹' },
    ],
  },
  {
    id: 'settings', label: 'ตั้งค่า', icon: 'settings', roles: ['admin'],
    sub: [
      { id: 'settings.users', label: 'จัดการผู้ใช้งาน', emoji: '👥' },
      { id: 'settings.company', label: 'ข้อมูลบริษัท', emoji: '🏢' },
    ],
  },
  {
    id: 'admin', label: 'Admin Panel', icon: 'settings', roles: ['admin'],
    sub: [
      { id: 'admin.users', label: 'จัดการผู้ใช้ + ACL', emoji: '👥' },
      { id: 'admin.reset', label: 'รีเซตข้อมูล', emoji: '🔄' },
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
        {MENU.filter(m => canAccessRoute(m.id, user.role)).map(m => {
          const visibleSub = m.sub?.filter(s => canAccessRoute(s.id, user.role)) ?? []
          // A section with sub-items but none accessible to this role is hidden.
          if (m.sub && visibleSub.length === 0) return null
          const sec = sectionActive(m)
          const hasSub = visibleSub.length > 0

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
                  {visibleSub.map(s => (
                    <div
                      key={s.id}
                      className={`subnav-item ${active === s.id ? 'active' : ''}`}
                      onClick={() => setActive(s.id)}
                    >
                      {s.emoji && <span className="emoji">{s.emoji}</span>}
                      <span>{s.label}</span>
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
