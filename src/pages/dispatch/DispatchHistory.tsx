import { useState, useMemo } from 'react'
import { db, DSP_KMPL_THRESHOLD } from '../../lib/db'
import { useList } from '../../hooks/useTable'
import { useDispatches } from '../../hooks/useDispatches'
import { useAuth } from '../../context/AuthContext'
import type { Vehicle, Employee, Dispatch } from '../../types'
import { Icon, SearchInput, SegmentedFilter } from '../../components/ui'

interface Props {
  setActive: (id: string) => void
  setSubject: (s: unknown) => void
}

type StatusFilter = 'all' | 'draft' | 'closed'

function legSummary(round: Dispatch): { origin: string; destination: string } {
  const legs = round.legs ?? []
  if (!legs.length) return { origin: '—', destination: '—' }
  return {
    origin: legs[0].origin || '—',
    destination: legs[legs.length - 1].destination || '—',
  }
}

export function DispatchHistory({ setActive, setSubject }: Props) {
  const { isManager } = useAuth()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const { data: vehicles = [] } = useList<Vehicle>('vehicles')
  const { data: employees = [] } = useList<Employee>('employees')
  const { data: dispatch = [] } = useDispatches()
  const rounds = useMemo(() => {
    const all = dispatch
      .filter(d => d.roundStatus === 'draft' || d.roundStatus === 'closed' || d.status === 'completed')
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    return all
  }, [dispatch])

  const draftCount = useMemo(() => rounds.filter(d => d.roundStatus === 'draft').length, [rounds])
  const closedCount = useMemo(() => rounds.filter(d => d.roundStatus === 'closed' || d.status === 'completed').length, [rounds])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rounds.filter(d => {
      if (status === 'draft' && d.roundStatus !== 'draft') return false
      if (status === 'closed' && d.roundStatus !== 'closed' && d.status !== 'completed') return false
      if (!q) return true
      const vehicle = vehicles.find(v => v.id === d.vehicleId)
      const driver = employees.find(e => e.id === d.driverId)
      const legs = d.legs ?? []
      const txt = [
        d.code, vehicle?.plate, vehicle?.brand, driver?.name,
        ...legs.flatMap(l => [l.origin, l.destination, l.cargo, l.cargoType]),
      ].filter(Boolean).join(' ').toLowerCase()
      return txt.includes(q)
    })
  }, [rounds, query, status, vehicles, employees])

  const toggle = (id: string) => setExpanded(s => {
    const n = new Set(s)
    if (n.has(id)) n.delete(id); else n.add(id)
    return n
  })

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">ประวัติการวิ่งงาน</h1>
          <div className="page-sub">ดูประวัติงานทั้งหมด รองรับหลายขาต่อรอบ</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card pad" style={{ marginBottom: 14 }}>
        <div className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="ค้นหา Job No, ทะเบียนรถ, คนขับ, สินค้า, เส้นทาง..."
            style={{ flex: '1 1 200px', minWidth: 160 }}
          />
          <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
            <SegmentedFilter
              value={status}
              onChange={setStatus}
              options={[
                { value: 'all', label: `ทั้งหมด (${rounds.length})` },
                { value: 'draft', label: `กำลังดำเนินการ (${draftCount})` },
                { value: 'closed', label: `เสร็จสิ้น (${closedCount})` },
              ]}
            />
          </div>
          <span className="muted" style={{ fontSize: 13 }}>{filtered.length} รายการ</span>
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="card pad empty" style={{ padding: 48 }}>
          ไม่พบประวัติงาน
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(round => {
            const vehicle = vehicles.find(v => v.id === round.vehicleId)
            const driver = employees.find(e => e.id === round.driverId)
            const legs = round.legs ?? []
            const route = legSummary(round)
            const totalRevenue = legs.reduce((s, l) => s + (l.amount || 0), 0)
            const distance = round.distance
            const isExpanded = expanded.has(round.id)
            const isClosed = round.roundStatus === 'closed' || round.status === 'completed'
            const isDraft = round.roundStatus === 'draft'
            const kmPerL = round.kmPerL ?? (
              distance && round.liters ? distance / round.liters : null
            )
            const isLow = kmPerL != null && kmPerL < DSP_KMPL_THRESHOLD

            return (
              <div key={round.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Header row */}
                <div
                  onClick={() => toggle(round.id)}
                  style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16 }}
                >
                  <div
                    style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: isClosed ? '#ECFDF5' : '#FEF3C7',
                      color: isClosed ? '#10B981' : '#F59E0B',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Icon name={isClosed ? 'check' : 'edit'} size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="mono" style={{ fontWeight: 600, color: 'var(--primary)' }}>{round.code}</span>
                      {isClosed
                        ? <span className="badge green" style={{ fontSize: 10.5 }}>เสร็จสิ้น</span>
                        : isDraft
                          ? <span className="badge amber" style={{ fontSize: 10.5 }}>กำลังดำเนินการ</span>
                          : <span className="badge" style={{ fontSize: 10.5 }}>{round.status}</span>}
                      <span className="badge" style={{ fontSize: 10.5 }}>{legs.length} ขา</span>
                      {kmPerL != null && (
                        <span
                          className="badge"
                          style={{
                            fontSize: 10.5,
                            background: isLow ? '#FEE2E2' : '#DCFCE7',
                            color: isLow ? '#991B1B' : '#166534',
                          }}
                        >🛢️ {kmPerL.toFixed(1)} km/L{isLow && ' ⚠️'}</span>
                      )}
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      📅 {db.thaiDate(round.date)}
                      {' · '}🚛 {vehicle?.plate ?? '—'} ({driver?.name ?? '—'})
                      {' · '}📍 {route.origin} → {route.destination}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {isManager && (
                      <div className="mono" style={{ fontWeight: 700, color: 'var(--primary)' }}>
                        {db.fmt(totalRevenue)} <span style={{ fontSize: 11 }}>บาท</span>
                      </div>
                    )}
                    {distance && (
                      <div className="muted" style={{ fontSize: 11 }}>{db.fmt(distance)} km</div>
                    )}
                  </div>
                  <Icon name={isExpanded ? 'chevron-down' : 'chevron-right'} size={16} />
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div style={{ padding: 18, borderTop: '1px solid var(--line)', background: 'var(--bg)' }}>
                    {legs.length > 0 && (
                      <div className="tbl-wrap stack-wrap" style={{ marginBottom: 12 }}>
                        <table className="tbl stack">
                          <thead>
                            <tr>
                              <th>ขา</th>
                              <th>เส้นทาง</th>
                              <th>สินค้า</th>
                              <th className="num">น้ำหนัก</th>
                              {isManager && <th className="num">ราคา</th>}
                              {isManager && <th className="num right">ค่าขนส่ง</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {legs.map((l, i) => (
                              <tr key={l.id || i}>
                                <td data-label="ขา">{i + 1}</td>
                                <td data-label="เส้นทาง">{l.origin} → {l.destination}</td>
                                <td data-label="สินค้า">{l.cargo}</td>
                                <td className="num" data-label="น้ำหนัก">{(l.weight || 0).toFixed(2)} ตัน</td>
                                {isManager && (
                                  <td className="num" data-label="ราคา">
                                    {l.priceMode === 'lump'
                                      ? `${db.fmt(l.price)}`
                                      : `${db.fmt(l.price)} / ${l.priceMode === 'per_kg' ? 'กก.' : 'ตัน'}`}
                                  </td>
                                )}
                                {isManager && <td className="num right" data-label="ค่าขนส่ง">{db.thb(l.amount)}</td>}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div className={isManager ? 'grid-4' : 'grid-2'} style={{ gap: 12, fontSize: 12.5 }}>
                      <div>
                        <span className="muted">ไมล์ต้น/ปลาย:</span>{' '}
                        <span className="mono">{db.fmt(round.startOdometer)} → {db.fmt(round.endOdometer)}</span>
                      </div>
                      <div>
                        <span className="muted">น้ำมัน:</span>{' '}
                        <span className="mono">{round.liters ? `${db.fmt(round.liters)} L` : '—'}</span>
                      </div>
                      {isManager && (
                        <div>
                          <span className="muted">ค่าน้ำมัน:</span>{' '}
                          <span className="mono">{round.cost ? db.thb(round.cost) : '—'}</span>
                        </div>
                      )}
                      {isManager && (
                        <div>
                          <span className="muted">เบี้ยเลี้ยง:</span>{' '}
                          <span className="mono">{round.perDiem ? db.thb(round.perDiem) : '—'}</span>
                        </div>
                      )}
                    </div>
                    <div className="row btn-row" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
                      {isDraft && (
                        <button
                          className="btn sm"
                          onClick={e => {
                            e.stopPropagation()
                            setSubject({ type: 'round', id: round.id })
                            setActive('dispatch.open')
                          }}
                        >
                          <Icon name="edit" size={13} /> แก้ไข
                        </button>
                      )}
                      {isDraft && (
                        <button
                          className="btn primary sm"
                          onClick={e => {
                            e.stopPropagation()
                            setSubject({ type: 'round', id: round.id, origin: 'dispatch.history' })
                            setActive('dispatch.close')
                          }}
                        >
                          <Icon name="check" size={13} /> ไปปิดงาน
                        </button>
                      )}
                      <button
                        className="btn sm"
                        onClick={e => {
                          e.stopPropagation()
                          setSubject({ type: 'round', id: round.id, origin: 'dispatch.history' })
                          setActive('dispatch.round')
                        }}
                      >
                        <Icon name="arrow-right" size={13} /> ดูรายละเอียด
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
