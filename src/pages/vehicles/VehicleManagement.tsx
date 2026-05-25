import { useState, useMemo } from 'react'
import { useList, useInsert, useUpdate } from '../../hooks/useTable'
import { useRealtimeTable } from '../../hooks/useRealtime'
import type { Vehicle } from '../../types'
import { SearchInput } from '../../components/ui/SearchInput'
import { SegmentedFilter } from '../../components/ui/SegmentedFilter'

// ─── Types ────────────────────────────────────────────────────────────────────

type VehicleGroup = 'INTERNAL' | 'TRANSPORT'

interface FormState {
  plate: string
  brand: string
  type: string
  groupKind: VehicleGroup
  fuel: number
  status: Vehicle['status']
  isActive: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GROUP_LABEL: Record<VehicleGroup, string> = {
  INTERNAL: 'รถโรงงาน',
  TRANSPORT: 'รถขนส่ง',
}

const GROUP_STYLE: Record<VehicleGroup, { background: string; color: string }> = {
  INTERNAL: { background: '#F0FDF4', color: '#166534' },
  TRANSPORT: { background: '#EFF6FF', color: '#1D4ED8' },
}

const STATUS_LABEL: Record<Vehicle['status'], string> = {
  available: 'พร้อมใช้งาน',
  'on-trip': 'กำลังวิ่งงาน',
  maintenance: 'ซ่อมบำรุง',
  warning: 'มีการแจ้งเตือน',
}

function emptyForm(): FormState {
  return {
    plate: '',
    brand: '',
    type: 'รถบรรทุก 10 ล้อ',
    groupKind: 'TRANSPORT',
    fuel: 0,
    status: 'available',
    isActive: true,
  }
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function VehicleFormModal({
  initial,
  editId,
  existingPlates,
  onSave,
  onClose,
}: {
  initial: FormState
  editId: string | null
  existingPlates: string[]
  onSave: (form: FormState, id: string | null) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<FormState>(initial)
  const [error, setError] = useState('')

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(prev => ({ ...prev, [k]: v }))

  const plateUp = form.plate.toUpperCase()
  const duplicatePlate =
    !editId && existingPlates.map(p => p.toUpperCase()).includes(plateUp)

  const handleSubmit = () => {
    if (!form.plate.trim()) { setError('กรุณาระบุทะเบียนรถ'); return }
    if (duplicatePlate) { setError('ทะเบียนนี้มีในระบบแล้ว'); return }
    onSave(form, editId)
  }

  const labelStyle = { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 } as const
  const inputStyle = {
    width: '100%', boxSizing: 'border-box' as const, height: 36, padding: '0 10px',
    border: '1px solid var(--line)', borderRadius: 7, fontSize: 13,
    fontFamily: 'inherit', outline: 'none',
  }
  const selectStyle = { ...inputStyle, cursor: 'pointer' }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, width: 480,
        boxShadow: '0 20px 60px rgba(0,0,0,.2)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 22px', borderBottom: '1px solid #E2E8F0',
          display: 'flex', alignItems: 'center', gap: 10, background: '#F8FAFC',
        }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>
            {editId ? '✏️ แก้ไขข้อมูลรถ' : '🚚 เพิ่มรถใหม่'}
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#9CA3AF', lineHeight: 1 }}
          >×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 7,
              padding: '8px 12px', fontSize: 13, color: '#991B1B',
            }}>
              {error}
            </div>
          )}

          {/* Plate */}
          <div>
            <label style={labelStyle}>ทะเบียนรถ <span style={{ color: '#EF4444' }}>*</span></label>
            <input
              type="text"
              value={form.plate}
              onChange={e => { set('plate', e.target.value); setError('') }}
              placeholder="เช่น กก-1234"
              style={{
                ...inputStyle,
                textTransform: 'uppercase',
                borderColor: duplicatePlate ? '#EF4444' : undefined,
                background: duplicatePlate ? '#FEF2F2' : undefined,
              }}
            />
            {duplicatePlate && (
              <div style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>ทะเบียนนี้มีในระบบแล้ว</div>
            )}
          </div>

          {/* Brand / model */}
          <div>
            <label style={labelStyle}>ยี่ห้อ / รุ่น</label>
            <input
              type="text"
              value={form.brand}
              onChange={e => set('brand', e.target.value)}
              placeholder="เช่น Hino 500"
              style={inputStyle}
            />
          </div>

          {/* Type */}
          <div>
            <label style={labelStyle}>ประเภทรถ</label>
            <select value={form.type} onChange={e => set('type', e.target.value)} style={selectStyle}>
              {[
                'รถบรรทุก 10 ล้อ',
                'รถบรรทุก 6 ล้อ',
                'รถพ่วง 18 ล้อ',
                'รถกระบะ',
                'รถตู้',
                'รถแทรกเตอร์',
                'รถโฟล์คลิฟท์',
                'รถอื่นๆ',
              ].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          {/* Group */}
          <div>
            <label style={labelStyle}>กลุ่มรถ</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {(['INTERNAL', 'TRANSPORT'] as VehicleGroup[]).map(g => {
                const active = form.groupKind === g
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => set('groupKind', g)}
                    style={{
                      flex: 1, padding: '8px 0', border: `2px solid ${active ? '#0066CC' : '#E2E8F0'}`,
                      borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                      fontFamily: 'inherit', transition: 'all .12s',
                      background: active ? '#EFF6FF' : '#fff',
                      color: active ? '#1D4ED8' : '#64748B',
                    }}
                  >
                    {g === 'INTERNAL' ? '🏭 รถโรงงาน' : '🚛 รถขนส่ง'}
                  </button>
                )
              })}
            </div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 5 }}>
              {form.groupKind === 'INTERNAL'
                ? 'น้ำมันจะถูกตัดสต็อคทันที ไม่ต้องผูกรอบงาน'
                : 'น้ำมันต้องผูกกับรอบงาน ถ้าไม่พบรอบจะเป็น "น้ำมันลอย"'}
            </div>
          </div>

          {/* Tank capacity */}
          <div>
            <label style={labelStyle}>ความจุถัง (ลิตร)</label>
            <input
              type="number"
              min="0"
              value={form.fuel || ''}
              onChange={e => set('fuel', parseInt(e.target.value, 10) || 0)}
              placeholder="500"
              style={inputStyle}
            />
          </div>

          {/* Status */}
          <div>
            <label style={labelStyle}>สถานะ</label>
            <select value={form.status} onChange={e => set('status', e.target.value as Vehicle['status'])} style={selectStyle}>
              {(Object.keys(STATUS_LABEL) as Vehicle['status'][]).map(s => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>

          {/* Active */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={e => set('isActive', e.target.checked)}
              style={{ accentColor: '#0066CC', width: 16, height: 16 }}
            />
            <span style={{ fontWeight: 500 }}>รถพร้อมใช้งาน (Active)</span>
          </label>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 22px', borderTop: '1px solid #E2E8F0',
          display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#F8FAFC',
        }}>
          <button className="btn" onClick={onClose}>ยกเลิก</button>
          <button className="btn primary" onClick={handleSubmit}>
            {editId ? 'บันทึกการแก้ไข' : '+ เพิ่มรถ'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function VehicleManagement() {
  useRealtimeTable('vehicles')
  const { data: vehicles = [] } = useList<Vehicle>('vehicles', 'plate', true)
  const insertVehicle = useInsert<Vehicle>('vehicles')
  const updateVehicle = useUpdate<Vehicle>('vehicles')
  const [search, setSearch] = useState('')
  const [filterGroup, setFilterGroup] = useState<VehicleGroup | 'ALL'>('ALL')
  const [modal, setModal] = useState<{ form: FormState; editId: string | null } | null>(null)

  const filtered = useMemo(() => {
    let list = vehicles
    if (filterGroup !== 'ALL') list = list.filter(v => (v.groupKind ?? 'TRANSPORT') === filterGroup)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(v =>
        v.plate.toLowerCase().includes(q) ||
        v.brand?.toLowerCase().includes(q) ||
        v.type?.toLowerCase().includes(q),
      )
    }
    return list.sort((a, b) => a.plate.localeCompare(b.plate))
  }, [vehicles, search, filterGroup])

  const stats = useMemo(() => ({
    total: vehicles.length,
    internal: vehicles.filter(v => (v.groupKind ?? 'TRANSPORT') === 'INTERNAL').length,
    transport: vehicles.filter(v => (v.groupKind ?? 'TRANSPORT') === 'TRANSPORT').length,
  }), [vehicles])

  const openAdd = () => setModal({ form: emptyForm(), editId: null })

  const openEdit = (v: Vehicle) =>
    setModal({
      editId: v.id,
      form: {
        plate: v.plate,
        brand: v.brand ?? '',
        type: v.type ?? 'รถบรรทุก 10 ล้อ',
        groupKind: (v.groupKind ?? 'TRANSPORT') as VehicleGroup,
        fuel: v.fuel ?? 0,
        status: v.status,
        isActive: v.status !== 'maintenance',
      },
    })

  const handleSave = (form: FormState, editId: string | null) => {
    const patch: Partial<Vehicle> = {
      plate: form.plate.toUpperCase().trim(),
      brand: form.brand,
      type: form.type,
      groupKind: form.groupKind,
      fuel: form.fuel,
      status: form.isActive ? form.status : 'maintenance',
    }

    if (editId) {
      updateVehicle.mutate(
        { id: editId, patch },
        { onSuccess: () => setModal(null), onError: (err) => alert(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ') },
      )
    } else {
      insertVehicle.mutate(
        {
          plate: patch.plate!,
          brand: patch.brand!,
          type: patch.type!,
          groupKind: patch.groupKind!,
          fuel: patch.fuel!,
          status: patch.status!,
          year: new Date().getFullYear(),
          driverId: null,
          odometer: 0,
          nextServiceKm: 0,
          lastService: '',
          nextService: '',
          purchaseDate: '',
          tax: '',
          insurance: '',
          dispatchPermit: '',
        },
        { onSuccess: () => setModal(null), onError: (err) => alert(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ') },
      )
    }
  }

  const existingPlates = vehicles.map(v => v.plate)

  return (
    <div>
      {/* Header */}
      <div className="page-head no-print">
        <div>
          <h1 className="page-title">🚛 จัดการทะเบียนรถ (Vehicle Master)</h1>
          <div className="page-sub">กำหนดกลุ่มรถ INTERNAL / TRANSPORT ที่ใช้ควบคุมการจ่ายน้ำมัน</div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={openAdd}>+ เพิ่มรถใหม่</button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid-3 no-print" style={{ marginBottom: 18, gap: 14 }}>
        <div className="card kpi">
          <div className="label">รถทั้งหมด</div>
          <div className="mono" style={{ fontSize: 28, fontWeight: 700, marginTop: 6 }}>{stats.total}</div>
          <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>คัน</div>
        </div>
        <div className="card kpi" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
          <div className="label" style={{ color: '#166534' }}>🏭 รถโรงงาน (INTERNAL)</div>
          <div className="mono" style={{ fontSize: 28, fontWeight: 700, marginTop: 6, color: '#166534' }}>{stats.internal}</div>
          <div className="muted" style={{ fontSize: 11, marginTop: 2, color: '#166534' }}>ตัดสต็อคอัตโนมัติ</div>
        </div>
        <div className="card kpi" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
          <div className="label" style={{ color: '#1D4ED8' }}>🚛 รถขนส่ง (TRANSPORT)</div>
          <div className="mono" style={{ fontSize: 28, fontWeight: 700, marginTop: 6, color: '#1D4ED8' }}>{stats.transport}</div>
          <div className="muted" style={{ fontSize: 11, marginTop: 2, color: '#1D4ED8' }}>ผูกกับรอบงาน</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card no-print" style={{ padding: '12px 16px', marginBottom: 14, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <SearchInput value={search} onChange={setSearch} placeholder="ค้นหาทะเบียน, ยี่ห้อ..." width={220} />
        <SegmentedFilter
          value={filterGroup}
          onChange={setFilterGroup}
          options={[
            { value: 'ALL', label: `ทั้งหมด (${stats.total})` },
            { value: 'INTERNAL', label: `🏭 โรงงาน (${stats.internal})` },
            { value: 'TRANSPORT', label: `🚛 ขนส่ง (${stats.transport})` },
          ]}
        />
      </div>

      {/* Table */}
      <div style={{ borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.06)', background: '#fff' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                {['ทะเบียน', 'ยี่ห้อ / รุ่น', 'ประเภทรถ', 'กลุ่ม', 'ความจุถัง', 'สถานะ', ''].map((h, i) => (
                  <th key={i} style={{
                    padding: '10px 14px', textAlign: i === 4 ? 'right' : i === 6 ? 'center' : 'left',
                    color: '#64748B', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px 0', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                    {search ? 'ไม่พบรถที่ตรงกับการค้นหา' : 'ยังไม่มีข้อมูลรถในระบบ'}
                  </td>
                </tr>
              ) : filtered.map((v, i) => {
                const group = (v.groupKind ?? 'TRANSPORT') as VehicleGroup
                return (
                  <tr key={v.id} style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: 'var(--primary)' }}>
                        {v.plate}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#374151' }}>{v.brand || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#64748B' }}>{v.type || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                        ...GROUP_STYLE[group],
                      }}>
                        {GROUP_LABEL[group]}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', color: '#374151' }}>
                      {v.fuel ? `${v.fuel} ล.` : '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                        background:
                          v.status === 'available' ? '#F0FDF4' :
                          v.status === 'on-trip' ? '#EFF6FF' :
                          v.status === 'maintenance' ? '#FFF7ED' : '#FFFBEB',
                        color:
                          v.status === 'available' ? '#166534' :
                          v.status === 'on-trip' ? '#1D4ED8' :
                          v.status === 'maintenance' ? '#C2410C' : '#92400E',
                      }}>
                        {STATUS_LABEL[v.status]}
                      </span>
                    </td>
                    <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                      <button
                        onClick={() => openEdit(v)}
                        style={{
                          background: 'none', border: '1px solid #CBD5E1', borderRadius: 6,
                          padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                          color: '#374151', transition: 'all .12s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                      >
                        แก้ไข
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div style={{
            padding: '9px 14px', borderTop: '1px solid #F1F5F9', background: '#F8FAFC',
            fontSize: 12, color: '#9CA3AF',
          }}>
            แสดง {filtered.length} จาก {vehicles.length} คัน
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <VehicleFormModal
          initial={modal.form}
          editId={modal.editId}
          existingPlates={existingPlates}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
