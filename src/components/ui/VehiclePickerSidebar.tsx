import { useState } from 'react'
import type { Vehicle } from '../../types'
import { Icon } from './Icon'

interface Props {
  vehicles: Vehicle[]
  picked: Set<string>
  onChange: (next: Set<string>) => void
  title?: string
  maxHeight?: number
}

export function VehiclePickerSidebar({ vehicles, picked, onChange, title = 'เลือกรถ', maxHeight = 420 }: Props) {
  const [search, setSearch] = useState('')
  const visible = vehicles.filter(v => !search || v.plate.toLowerCase().includes(search.toLowerCase()))
  const allChecked = vehicles.length > 0 && vehicles.every(v => picked.has(v.id))

  const toggle = (id: string) => {
    const next = new Set(picked)
    if (next.has(id)) next.delete(id); else next.add(id)
    onChange(next)
  }
  const selectAll = () => onChange(new Set(vehicles.map(v => v.id)))
  const clearAll = () => onChange(new Set())

  return (
    <div
      className="card no-print"
      style={{ width: 228, flexShrink: 0, display: 'flex', flexDirection: 'column', height: 'fit-content' }}
    >
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)' }}>
        <div className="row" style={{ marginBottom: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{title}</span>
          <span className="badge blue" style={{ marginLeft: 'auto', fontSize: 11 }}>
            {picked.size}/{vehicles.length} คัน
          </span>
        </div>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
            <Icon name="search" size={13} />
          </span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหาทะเบียน..."
            style={{
              width: '100%', padding: '5px 8px 5px 28px',
              border: '1px solid #CBD5E1', borderRadius: 6,
              fontSize: 12.5, background: 'var(--bg)',
            }}
          />
        </div>
      </div>

      <label
        className="row"
        style={{ gap: 8, padding: '9px 14px', borderBottom: '1px solid var(--line)', cursor: 'pointer', fontSize: 12.5 }}
      >
        <input
          type="checkbox"
          checked={allChecked}
          onChange={e => e.target.checked ? selectAll() : clearAll()}
          style={{ accentColor: 'var(--primary)' }}
        />
        <span style={{ fontWeight: 600 }}>เลือกทั้งหมด</span>
      </label>

      <div style={{ flex: 1, overflowY: 'auto', maxHeight }}>
        {visible.map(v => (
          <label
            key={v.id}
            className="row"
            style={{
              gap: 8, padding: '8px 14px', cursor: 'pointer',
              borderBottom: '1px solid var(--line)', fontSize: 12.5,
              background: picked.has(v.id) ? 'var(--primary-50, #EFF6FF)' : 'transparent',
            }}
          >
            <input
              type="checkbox"
              checked={picked.has(v.id)}
              onChange={() => toggle(v.id)}
              style={{ accentColor: 'var(--primary)' }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="mono" style={{ fontWeight: 600, fontSize: 12 }}>{v.plate}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{v.type}</div>
            </div>
          </label>
        ))}
        {visible.length === 0 && (
          <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
            ไม่พบทะเบียน
          </div>
        )}
      </div>

      <div className="row" style={{ padding: '10px 14px', gap: 8, borderTop: '1px solid var(--line)' }}>
        <button className="btn sm" style={{ flex: 1 }} onClick={selectAll}>ทั้งหมด</button>
        <button className="btn sm" style={{ flex: 1 }} onClick={clearAll}>ล้าง</button>
      </div>
    </div>
  )
}
