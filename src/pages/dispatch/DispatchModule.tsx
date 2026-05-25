import type { User } from '../../types'
import { DispatchFuelReport } from './DispatchFuelReport'
import { DispatchMonthlyReport } from './DispatchMonthlyReport'

// ─── Props ────────────────────────────────────────────────────────────────────

interface DispatchModuleProps {
  tab: string
  setActive: (id: string) => void
  user: User
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4z"/>
  </svg>
)
const CheckBoxIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2"/><path d="m8 12 3 3 5-6"/>
  </svg>
)
const DocIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
    <path d="M14 3v6h6"/><path d="M9 14h6M9 18h4"/>
  </svg>
)
const HistoryIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>
  </svg>
)
const FuelBadgeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: -2 }}>
    <rect x="4" y="3" width="10" height="18" rx="1"/>
    <path d="M14 7h2l2 2v8a2 2 0 0 1-4 0v-3"/><path d="M7 7h4"/>
  </svg>
)

// ─── Tabs component ───────────────────────────────────────────────────────────

interface TabsProps {
  current: string
  onChange: (t: string) => void
}

function DispatchTabs({ current, onChange }: TabsProps) {
  const items = [
    { id: 'open',    label: 'เปิดงาน',              icon: <SendIcon /> },
    { id: 'close',   label: 'ปิดงาน',               icon: <CheckBoxIcon /> },
    { id: 'fuel',    label: 'รายงานประจำวัน',        icon: <FuelBadgeIcon /> },
    { id: 'monthly', label: 'รายงานประจำเดือน',      icon: <DocIcon /> },
    { id: 'report',  label: 'รายงานสรุป',            icon: <DocIcon /> },
    { id: 'history', label: 'ประวัติการวิ่งงาน',     icon: <HistoryIcon /> },
  ]
  return (
    <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: 6, display: 'inline-flex', gap: 2 }}>
      {items.map(it => (
        <button
          key={it.id}
          onClick={() => onChange(it.id)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '9px 18px',
            border: 'none', borderRadius: 8,
            background: current === it.id ? 'var(--primary-50)' : 'transparent',
            color: current === it.id ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: current === it.id ? 600 : 500,
            fontSize: 13.5,
            cursor: 'pointer',
            borderBottom: current === it.id ? '2px solid var(--primary)' : '2px solid transparent',
            marginBottom: -2,
            transition: 'background .15s, color .15s',
          }}
        >
          {it.icon}
          {it.label}
        </button>
      ))}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

// Only the daily/monthly report tabs render here; every other dispatch screen is
// routed to a dedicated Supabase-backed page in App.tsx. The tab bar stays so
// users can navigate between them.
export function DispatchModule({ tab, setActive }: DispatchModuleProps) {
  const valid = ['open', 'close', 'fuel', 'monthly', 'report', 'history']
  const currentTab = valid.includes(tab) ? tab : 'fuel'

  return (
    <div>
      <div className="no-print">
        <DispatchTabs current={currentTab} onChange={t => setActive('dispatch.' + t)}/>
      </div>
      <div style={{ marginTop: 20 }}>
        {currentTab === 'fuel'    && <DispatchFuelReport/>}
        {currentTab === 'monthly' && <DispatchMonthlyReport/>}
      </div>
    </div>
  )
}
