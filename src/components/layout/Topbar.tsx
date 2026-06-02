import { useState } from 'react'
import type { User } from '../../types'
import { Icon } from '../ui'
import { ChangePasswordModal } from '../auth/ChangePasswordModal'

interface TopbarProps {
  user: User
  crumb: string
  onLogout: () => void
  onOpenAlerts: () => void
}

export function Topbar({ user, crumb, onLogout, onOpenAlerts }: TopbarProps) {
  const [open, setOpen] = useState(false)
  const [showChangePw, setShowChangePw] = useState(false)

  const roleLabel =
    user.role === 'admin'
      ? 'ผู้ดูแลระบบ'
      : user.role === 'manager'
      ? 'ผู้จัดการขนส่ง'
      : 'พนักงาน'

  const avatarClass =
    user.role === 'admin' ? 'violet' : user.role === 'manager' ? '' : 'amber'

  return (
    <div className="topbar">
      <div className="crumb">
        <span>KPS Transportation ERP</span>
        <Icon name="chevron-right" size={14} />
        <b>{crumb}</b>
      </div>

      <div className="search">
        <Icon
          name="search"
          size={15}
          className="icn"
          style={{
            position: 'absolute',
            left: 11,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-faint)',
          }}
        />
        <input placeholder="ค้นหารถ คนขับ ลูกค้า งาน..." />
      </div>

      <button className="icon-btn" title="ภาษา">
        <Icon name="globe" size={18} />
      </button>

      <button className="icon-btn" title="แจ้งเตือน / รออนุมัติ" onClick={onOpenAlerts}>
        <Icon name="bell" size={18} />
        <span className="dot" />
      </button>

      <div
        className="user-chip"
        onClick={() => setOpen(o => !o)}
        style={{ position: 'relative' }}
      >
        <div className="meta">
          <div className="nm">{user.name}</div>
          <div className="rl">{roleLabel}</div>
        </div>
        <div className={`avatar ${avatarClass}`}>{user.avatar}</div>

        {open && (
          <div
            className="menu"
            style={{ top: 'calc(100% + 6px)' }}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="item"
              onClick={() => { setOpen(false); setShowChangePw(true) }}
            >
              <Icon name="settings" size={15} /> เปลี่ยนรหัสผ่าน
            </div>
            <div className="sep" />
            <div
              className="item danger"
              onClick={() => {
                setOpen(false)
                onLogout()
              }}
            >
              <Icon name="logout" size={15} /> ออกจากระบบ
            </div>
          </div>
        )}
      </div>

      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
    </div>
  )
}
