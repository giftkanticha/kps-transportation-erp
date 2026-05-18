import { useState, useMemo, useEffect } from 'react'
import { db } from '../../lib/db'
import type { Vehicle, Employee, Dispatch } from '../../types'
import { Icon, Field } from '../../components/ui'

interface Props {
  setActive: (id: string) => void
  setSubject: (s: unknown) => void
  subject: unknown
}

interface ToastState { kind: 'success' | 'error'; msg: string }

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 2800)
    return () => clearTimeout(t)
  }, [toast, onClose])
  const ok = toast.kind === 'success'
  return (
    <div
      role="status"
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 1200,
        background: ok ? '#10B981' : '#EF4444', color: '#fff',
        padding: '12px 18px', borderRadius: 10,
        boxShadow: '0 8px 24px rgba(0,0,0,.25)', fontSize: 14, fontWeight: 500,
        minWidth: 260,
      }}
    >{toast.msg}</div>
  )
}

function thaiDate(iso: string): string {
  return db.thaiDate(iso)
}

export function DispatchRoundClose({ setActive, setSubject, subject }: Props) {
  const subj = subject as { type?: string; id?: string } | null
  const [tick, setTick] = useState(0)
  const drafts = useMemo(
    () => db.getAll<Dispatch>('dispatch').filter(d => d.roundStatus === 'draft'),
    [tick],
  )
  const vehicles = db.getAll<Vehicle>('vehicles')
  const employees = db.getAll<Employee>('employees')

  // Selected round id (from subject or local state)
  const [selectedId, setSelectedId] = useState<string>(subj?.id || (drafts[0]?.id ?? ''))

  // Form state
  const [endMileage, setEndMileage] = useState('')
  const [liters, setLiters] = useState('')
  const [fuelCost, setFuelCost] = useState('')
  const [perDiem, setPerDiem] = useState('')
  const [closeNotes, setCloseNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)

  const round = useMemo(
    () => (selectedId ? db.get<Dispatch>('dispatch', selectedId) : undefined),
    [selectedId, tick],
  )
  const vehicle = round?.vehicleId ? vehicles.find(v => v.id === round.vehicleId) : undefined
  const driver = round?.driverId ? employees.find(e => e.id === round.driverId) : undefined
  const legs = round?.legs ?? []
  const totalRevenue = legs.reduce((s, l) => s + (l.amount || 0), 0)
  const totalWeight = legs.reduce((s, l) => s + (l.weight || 0), 0)

  // Reset form when selectedId changes
  useEffect(() => {
    if (!round) return
    setEndMileage(round.endOdometer != null ? String(round.endOdometer) : '')
    setLiters(round.liters != null ? String(round.liters) : '')
    setFuelCost(round.cost ? String(round.cost) : '')
    setPerDiem(round.perDiem != null ? String(round.perDiem) : '')
    setCloseNotes('')
  }, [selectedId])

  if (drafts.length === 0) {
    return (
      <div>
        <div className="page-head">
          <div>
            <h1 className="page-title">ปิดงานขนส่ง</h1>
            <div className="page-sub">สรุปรอบงานทั้งหมดเมื่อกลับถึงที่หมาย</div>
          </div>
        </div>
        <div className="card pad empty" style={{ padding: 48 }}>
          ไม่มีงานที่รอปิด —{' '}
          <a onClick={() => setActive('dispatch.open')} style={{ cursor: 'pointer', color: 'var(--primary)' }}>
            เปิดงานใหม่
          </a>
        </div>
      </div>
    )
  }

  // Live calculations
  const distance = endMileage && round?.startOdometer != null
    ? Math.max(0, Number(endMileage) - round.startOdometer)
    : 0
  const kmPerL = Number(liters) > 0 && distance > 0 ? distance / Number(liters) : null
  const netRevenue = totalRevenue - (Number(fuelCost) || 0) - (Number(perDiem) || 0)

  const submit = () => {
    if (saving || !round) return
    if (!endMileage || isNaN(Number(endMileage)))
      return setToast({ kind: 'error', msg: 'กรุณากรอกเลขไมล์สิ้นสุด' })
    const em = Number(endMileage)
    if (round.startOdometer != null && em <= round.startOdometer)
      return setToast({ kind: 'error', msg: 'เลขไมล์สิ้นสุดต้องมากกว่าไมล์ต้นรอบ' })

    setSaving(true)
    try {
      db.update<Dispatch>('dispatch', round.id, {
        endOdometer: em,
        distance,
        liters: liters ? Number(liters) : null,
        cost: fuelCost ? Number(fuelCost) : 0,
        perDiem: perDiem ? Number(perDiem) : 0,
        kmPerL,
        revenue: totalRevenue,
        totalAmount: totalRevenue,
        notes: closeNotes ? (round.notes ? `${round.notes} | ${closeNotes}` : closeNotes) : round.notes,
        roundStatus: 'closed',
        status: 'completed',
        progress: 100,
        returnAt: `${(round.date || new Date().toISOString().slice(0, 10))}T18:00`,
      })
      setTick(t => t + 1)
      setToast({ kind: 'success', msg: `✅ ปิดงาน ${round.code} เรียบร้อย` })
      setTimeout(() => {
        setSubject(null)
        setActive('dispatch.history')
      }, 1000)
    } catch (err) {
      setToast({ kind: 'error', msg: err instanceof Error ? err.message : 'ปิดงานไม่สำเร็จ' })
      setSaving(false)
    }
  }

  return (
    <div style={{ paddingBottom: 100 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">ปิดงานขนส่ง</h1>
          <div className="page-sub">สรุปรอบงานทั้งหมดเมื่อกลับถึงที่หมาย</div>
        </div>
      </div>

      {/* Job dropdown */}
      <div className="card pad" style={{ marginBottom: 16 }}>
        <Field label="เลือกงานที่ต้องปิด">
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)}>
            <option value="">-- เลือกงาน --</option>
            {drafts.map(d => {
              const v = vehicles.find(x => x.id === d.vehicleId)
              const dr = employees.find(x => x.id === d.driverId)
              const total = (d.legs ?? []).reduce((s, l) => s + (l.amount || 0), 0)
              return (
                <option key={d.id} value={d.id}>
                  {d.code} · {v?.plate ?? '—'} ({dr?.name ?? '—'}) · {(d.legs ?? []).length} ขา · {db.fmt(total)} บาท
                </option>
              )
            })}
          </select>
        </Field>
      </div>

      {round && (
        <>
          {/* Readonly job card */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="head" style={{ alignItems: 'center' }}>
              <h3 className="mono" style={{ color: 'var(--primary)' }}>{round.code}</h3>
              <div className="right">
                <span className="badge amber" style={{ fontSize: 11 }}>กำลังดำเนินการ</span>
              </div>
            </div>
            <div style={{ padding: 18 }}>
              <div className="grid-4" style={{ gap: 14, marginBottom: 12, fontSize: 13 }}>
                <div>
                  <div className="muted" style={{ fontSize: 11 }}>วันที่</div>
                  <div>{thaiDate(round.date)}</div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 11 }}>รถ</div>
                  <div className="mono">{vehicle?.plate ?? '—'} {vehicle && <span className="muted" style={{ fontSize: 11 }}>({vehicle.type})</span>}</div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 11 }}>คนขับ</div>
                  <div>{driver?.name ?? '—'}</div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 11 }}>ไมล์ต้นรอบ</div>
                  <div className="mono">{db.fmt(round.startOdometer)} km</div>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>รายการขา ({legs.length} ขา)</div>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>ขา</th>
                      <th>เส้นทาง</th>
                      <th>สินค้า</th>
                      <th className="num">น้ำหนัก</th>
                      <th className="num">ราคา</th>
                      <th className="num right">ค่าขนส่ง</th>
                    </tr>
                  </thead>
                  <tbody>
                    {legs.map((l, i) => (
                      <tr key={l.id || i}>
                        <td>
                          <span
                            style={{
                              width: 22, height: 22, borderRadius: '50%', background: 'var(--primary)',
                              color: '#fff', display: 'inline-flex', alignItems: 'center',
                              justifyContent: 'center', fontWeight: 700, fontSize: 11,
                            }}
                          >{i + 1}</span>
                        </td>
                        <td>{l.origin} → {l.destination}</td>
                        <td>{l.cargo}</td>
                        <td className="num">{(l.weight || 0).toFixed(2)} ตัน</td>
                        <td className="num">
                          {l.priceMode === 'lump'
                            ? `${db.fmt(l.price)} บาท`
                            : `${db.fmt(l.price)} บาท/${l.priceMode === 'per_kg' ? 'กก.' : 'ตัน'}`
                          }
                        </td>
                        <td className="num right">{db.thb(l.amount)}</td>
                      </tr>
                    ))}
                    <tr style={{ fontWeight: 600, background: 'var(--bg)' }}>
                      <td colSpan={3} className="right">รวมทุกขา:</td>
                      <td className="num">{totalWeight.toFixed(2)} ตัน</td>
                      <td></td>
                      <td className="num right" style={{ color: 'var(--green)' }}>{db.thb(totalRevenue)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Close form + summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* LEFT: Form */}
            <div className="card">
              <div className="head"><h3><Icon name="edit" size={16} /> ข้อมูลปิดรอบ</h3></div>
              <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="เลขไมล์สิ้นสุดรอบ (km) *">
                  <input
                    type="number"
                    value={endMileage}
                    onChange={e => setEndMileage(e.target.value)}
                    placeholder={`มากกว่า ${db.fmt(round.startOdometer)}`}
                  />
                  {distance > 0 && (
                    <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                      ระยะทาง: {db.fmt(distance)} km
                    </div>
                  )}
                </Field>
                <div className="grid-2" style={{ gap: 12 }}>
                  <Field label="น้ำมันเติมระหว่างรอบ (ลิตร)">
                    <input
                      type="number"
                      step="0.01"
                      value={liters}
                      onChange={e => setLiters(e.target.value)}
                      placeholder="0"
                    />
                  </Field>
                  <Field label="ค่าน้ำมันรวม (บาท)">
                    <input
                      type="number"
                      step="0.01"
                      value={fuelCost}
                      onChange={e => setFuelCost(e.target.value)}
                      placeholder="0"
                    />
                  </Field>
                </div>
                <Field label="ค่าเบี้ยเลี้ยงคนขับ (บาท)">
                  <input
                    type="number"
                    step="0.01"
                    value={perDiem}
                    onChange={e => setPerDiem(e.target.value)}
                    placeholder="0"
                  />
                </Field>
                <Field label="หมายเหตุ">
                  <textarea
                    value={closeNotes}
                    onChange={e => setCloseNotes(e.target.value)}
                    rows={2}
                    placeholder="ระบุหมายเหตุ (ถ้ามี)"
                    style={{ resize: 'vertical', minHeight: 60 }}
                  />
                </Field>
                <div
                  style={{
                    padding: 10, background: 'var(--bg)', borderRadius: 6, fontSize: 12,
                    color: 'var(--text-2)',
                  }}
                >
                  💡 ต้องการบันทึกการเติมน้ำมันหลายครั้ง (ปั้มนอกระหว่างทาง)? ใช้เมนู{' '}
                  <a onClick={() => setActive('fuel.round.open')} style={{ cursor: 'pointer', color: 'var(--primary)', fontWeight: 600 }}>
                    ระบบน้ำมัน → เปิดรอบน้ำมัน (ละเอียด)
                  </a>
                </div>
              </div>
            </div>

            {/* RIGHT: Summary */}
            <div className="card">
              <div className="head"><h3><Icon name="chart" size={16} /> สรุปผลรอบงาน</h3></div>
              <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="muted" style={{ fontSize: 13 }}>ระยะทางรวมทั้งรอบ</span>
                  <span className="mono" style={{ fontWeight: 600 }}>
                    {distance > 0 ? `${db.fmt(distance)} km` : '—'}
                  </span>
                </div>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="muted" style={{ fontSize: 13 }}>จำนวนขา</span>
                  <span style={{ fontWeight: 600 }}>{legs.length} ขา</span>
                </div>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="muted" style={{ fontSize: 13 }}>รายรับรวมทุกขา</span>
                  <span className="mono" style={{ fontWeight: 600, color: 'var(--green)' }}>
                    {db.thb(totalRevenue)}
                  </span>
                </div>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="muted" style={{ fontSize: 13 }}>หัก ค่าน้ำมัน</span>
                  <span className="mono" style={{ color: 'var(--red)' }}>
                    {Number(fuelCost) > 0 ? `−${db.thb(Number(fuelCost))}` : '—'}
                  </span>
                </div>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="muted" style={{ fontSize: 13 }}>หัก เบี้ยเลี้ยง</span>
                  <span className="mono" style={{ color: 'var(--red)' }}>
                    {Number(perDiem) > 0 ? `−${db.thb(Number(perDiem))}` : '—'}
                  </span>
                </div>
                <div
                  style={{
                    padding: 12, borderRadius: 8,
                    background: kmPerL != null ? '#EFF6FF' : 'var(--bg)',
                    border: kmPerL != null ? '1px solid #BFDBFE' : '1px dashed var(--line)',
                  }}
                >
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="muted" style={{ fontSize: 13 }}>อัตราสิ้นเปลือง (km/L)</span>
                    <span className="mono" style={{ fontWeight: 600 }}>
                      {kmPerL != null ? `${kmPerL.toFixed(2)} km/L` : 'กรอกน้ำมันเพื่อคำนวณ'}
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    marginTop: 4, padding: 14, borderRadius: 8,
                    background: '#ECFDF5', border: '1px solid #10B981',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600 }}>รายรับสุทธิ</span>
                  <span className="mono" style={{ fontSize: 20, fontWeight: 700, color: '#10B981' }}>
                    {db.thb(netRevenue)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Sticky footer */}
      {round && (
        <div
          style={{
            position: 'sticky', bottom: 0, zIndex: 50,
            background: 'var(--card)', border: '1px solid var(--line)',
            borderRadius: 10, padding: '14px 18px',
            boxShadow: '0 -4px 16px rgba(0,0,0,.08)',
            display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16,
          }}
        >
          <button className="btn" onClick={() => setActive('dispatch.history')} disabled={saving}>
            <Icon name="close" size={15} /> ยกเลิก
          </button>
          <button className="btn primary" onClick={submit} disabled={saving}>
            <Icon name="check" size={15} /> {saving ? 'กำลังบันทึก…' : 'ปิดรอบงาน'}
          </button>
        </div>
      )}

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
