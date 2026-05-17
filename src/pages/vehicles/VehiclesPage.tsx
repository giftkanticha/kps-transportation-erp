import { useState, useMemo } from 'react'
import { db } from '../../lib/db'
import type { Vehicle, Employee } from '../../types'
import { Icon, StatusBadge } from '../../components/ui'

interface VehiclesPageProps {
  setActive: (id: string) => void
  setSubject: (s: unknown) => void
}

interface FilterStatus {
  available: boolean
  maintenance: boolean
  unavailable: boolean
}


interface DocWarning {
  text: string
  color: string
}

interface CheckOption {
  k: string
  l: string
  color?: string
}

interface FilterCheckGroupProps {
  label: string
  options: CheckOption[]
  state: Record<string, boolean>
  onChange: (s: Record<string, boolean>) => void
}

function FilterCheckGroup({ label, options, state, onChange }: FilterCheckGroupProps) {
  return (
    <div className="row" style={{ gap: 14, alignItems: 'center' }}>
      <span className="muted" style={{ fontWeight: 600, fontSize: 13 }}>{label}:</span>
      {options.map(o => (
        <label key={o.k} className="row" style={{ gap: 6, cursor: 'pointer', fontSize: 13, userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={!!state[o.k]}
            onChange={() => onChange({ ...state, [o.k]: !state[o.k] })}
            style={{ accentColor: o.color || 'var(--primary)' }}
          />
          <span style={{ color: o.color || 'var(--text-2)', fontWeight: 500 }}>{o.l}</span>
        </label>
      ))}
    </div>
  )
}

const TODAY = '2026-05-17'

function daysTo(s: string): number | null {
  if (!s) return null
  const d = new Date(s)
  const today = new Date(TODAY)
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function docWarn(v: Vehicle): DocWarning | null {
  const keys: (keyof Vehicle)[] = ['tax', 'insurance', 'dispatchPermit']
  const dts = keys
    .map(k => ({ k, d: daysTo(String(v[k] ?? '')) }))
    .filter((x): x is { k: keyof Vehicle; d: number } => x.d !== null && x.d <= 60)

  if (!dts.length) return null
  const sorted = dts.sort((a, b) => a.d - b.d)
  const min = sorted[0]
  const labels: Record<string, string> = { tax: 'ภาษี', insurance: 'ประกัน', dispatchPermit: 'ใบอนุญาต' }
  if (min.d < 0) return { text: `${labels[String(min.k)]}: หมดอายุแล้ว`, color: 'var(--red)' }
  return {
    text: `${labels[String(min.k)]}: ${min.d} วัน`,
    color: min.d <= 30 ? 'var(--red)' : 'var(--amber)',
  }
}

export function VehiclesPage({ setActive, setSubject }: VehiclesPageProps) {
  const vehicles = db.getAll<Vehicle>('vehicles')
  const employees = db.getAll<Employee>('employees')
  const vehicleTypes = useMemo(() => {
    const types = [...new Set(vehicles.map(v => v.type))].sort()
    return ['ทั้งหมด', ...types]
  }, [vehicles])
  const [q, setQ] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>({
    available: true,
    maintenance: true,
    unavailable: true,
  })
  const [filterType, setFilterType] = useState<string>('ทั้งหมด')

  const inStatusBucket = (v: Vehicle): boolean => {
    if (v.status === 'available') return filterStatus.available
    if (v.status === 'maintenance') return filterStatus.maintenance
    return filterStatus.unavailable
  }

  const inTypeBucket = (v: Vehicle): boolean => {
    if (filterType === 'ทั้งหมด') return true
    return v.type === filterType
  }

  const filtered = useMemo(() => {
    return vehicles.filter(v => {
      if (
        q &&
        !v.plate.toLowerCase().includes(q.toLowerCase()) &&
        !v.brand.toLowerCase().includes(q.toLowerCase()) &&
        !v.type.includes(q)
      )
        return false
      if (!inStatusBucket(v)) return false
      if (!inTypeBucket(v)) return false
      return true
    })
  }, [vehicles, q, filterStatus, filterType])

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">รายการรถ</h1>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={() => setActive('vehicles.add')}>
            <Icon name="plus" size={15} /> เพิ่มรถใหม่
          </button>
        </div>
      </div>

      <div className="card">
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            gap: 24,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
            <Icon
              name="search"
              size={15}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-faint)',
              }}
            />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="ค้นหาตามทะเบียน / ยี่ห้อ / สถานะ"
              style={{
                width: '100%',
                height: 38,
                padding: '0 12px 0 36px',
                border: '1px solid var(--line)',
                borderRadius: 8,
                background: 'var(--bg)',
                fontSize: 13,
              }}
            />
          </div>
          <FilterCheckGroup
            label="สถานะ"
            options={[
              { k: 'available', l: 'พร้อม', color: 'var(--green)' },
              { k: 'maintenance', l: 'ซ่อม', color: 'var(--amber)' },
              { k: 'unavailable', l: 'ไม่พร้อม', color: 'var(--red)' },
            ]}
            state={filterStatus as unknown as Record<string, boolean>}
            onChange={s => setFilterStatus(s as unknown as FilterStatus)}
          />
          <div className="row" style={{ gap: 10, alignItems: 'center' }}>
            <span className="muted" style={{ fontWeight: 600, fontSize: 13 }}>ประเภท:</span>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              style={{ height: 34, padding: '0 28px 0 10px', fontSize: 13, borderRadius: 7, border: '1px solid var(--line)', background: 'var(--bg)', minWidth: 120 }}
            >
              {vehicleTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>ทะเบียน</th>
                <th>ยี่ห้อ/รุ่น</th>
                <th>ประเภท</th>
                <th>สถานะ</th>
                <th>คนขับ</th>
                <th className="right">เลขไมล์</th>
                <th>ข้อมูลหมดอายุ</th>
                <th>ดำเนิน</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(v => {
                const dr = employees.find(e => e.id === v.driverId)
                const dw = docWarn(v)
                return (
                  <tr
                    key={v.id}
                    onClick={() => {
                      setSubject({ type: 'vehicle', id: v.id })
                      setActive('vehicles.detail')
                    }}
                  >
                    <td>
                      <a style={{ color: 'var(--primary)', fontWeight: 600 }} className="mono">
                        {v.plate}
                      </a>
                    </td>
                    <td>{v.brand}</td>
                    <td>{v.type}</td>
                    <td>
                      <StatusBadge status={v.status} />
                    </td>
                    <td>{dr ? dr.name : '-'}</td>
                    <td className="num right">{db.fmt(v.odometer)}</td>
                    <td>
                      {dw ? (
                        <span style={{ color: dw.color, fontSize: 12.5 }}>{dw.text}</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      <button
                        className="btn ghost icon sm"
                        onClick={e => e.stopPropagation()}
                      >
                        <Icon name="more" size={16} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            color: 'var(--text-muted)',
            fontSize: 12.5,
          }}
        >
          <span>
            แสดง 1 ถึง {filtered.length} จากทั้งหมด {filtered.length} รายการ
          </span>
          <div className="spacer" />
          <div className="row" style={{ gap: 4 }}>
            <button className="btn sm" disabled>
              ก่อนหน้า
            </button>
            <button className="btn sm primary">1</button>
            <button className="btn sm" disabled>
              ถัดไป
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
