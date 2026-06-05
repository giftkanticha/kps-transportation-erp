import { useState, useMemo, useEffect } from 'react'
import { useList, useInsert, useUpdate, useDelete } from '../../hooks/useTable'
import { db } from '../../lib/db'
import type { Route, Customer } from '../../types'
import { Icon, Field, SearchInput, SegmentedFilter } from '../../components/ui'

interface Props {
  setActive?: (id: string) => void
  prefill?: { origin?: string; destination?: string } | null
  clearPrefill?: () => void
}

type ActiveFilter = 'all' | 'active' | 'inactive'

interface RouteForm {
  code: string
  name: string
  origin: string
  destination: string
  distanceKm: string
  defaultPriceMode: 'per_ton' | 'per_kg' | 'lump'
  defaultPrice: string
  defaultPerDiem: string
  customerId: string
  cargoType: string
  active: boolean
  notes: string
}

const EMPTY_FORM: RouteForm = {
  code: '', name: '', origin: '', destination: '', distanceKm: '',
  defaultPriceMode: 'per_ton', defaultPrice: '', defaultPerDiem: '',
  customerId: '', cargoType: '', active: true, notes: '',
}

function nextRouteCode(routes: Route[]): string {
  const maxN = routes.reduce((max, r) => {
    const m = r.code.match(/^RTE-(\d+)$/)
    if (!m) return max
    return Math.max(max, parseInt(m[1], 10) || 0)
  }, 0)
  return `RTE-${String(maxN + 1).padStart(3, '0')}`
}

function priceModeLabel(mode: 'per_ton' | 'per_kg' | 'lump'): string {
  if (mode === 'per_ton') return 'บาท/ตัน'
  if (mode === 'per_kg') return 'บาท/กก.'
  return 'เหมา'
}

export function SettingsRoutes({ setActive, prefill, clearPrefill }: Props) {
  const { data: routes = [], isLoading } = useList<Route>('routes')
  const { data: customers = [] } = useList<Customer>('customers')
  const insertRoute = useInsert<Route>('routes')
  const updateRoute = useUpdate<Route>('routes')
  const deleteRoute = useDelete('routes')

  const [q, setQ] = useState('')
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all')
  const [customerFilter, setCustomerFilter] = useState('')
  const [editing, setEditing] = useState<{ id: string | null; form: RouteForm } | null>(null)
  const [deleting, setDeleting] = useState<Route | null>(null)
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  // If the page is opened with a prefill (e.g. "create from unmapped destination"
  // link on the route report), open the modal immediately with origin/destination
  // pre-populated.
  useEffect(() => {
    if (prefill?.origin || prefill?.destination) {
      setEditing({
        id: null,
        form: {
          ...EMPTY_FORM,
          code: nextRouteCode(routes),
          origin: prefill.origin ?? '',
          destination: prefill.destination ?? '',
          name: `${prefill.origin ?? ''} → ${prefill.destination ?? ''}`.trim(),
        },
      })
      clearPrefill?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill?.origin, prefill?.destination])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return routes
      .filter(r => {
        if (activeFilter === 'active' && !r.active) return false
        if (activeFilter === 'inactive' && r.active) return false
        if (customerFilter && (r.customerId ?? '') !== customerFilter) return false
        if (!needle) return true
        return [r.code, r.name, r.origin, r.destination, r.cargoType]
          .filter(Boolean).join(' ').toLowerCase().includes(needle)
      })
      .sort((a, b) => a.code.localeCompare(b.code))
  }, [routes, q, activeFilter, customerFilter])

  const openNew = () => setEditing({
    id: null,
    form: { ...EMPTY_FORM, code: nextRouteCode(routes) },
  })

  const openEdit = (r: Route) => setEditing({
    id: r.id,
    form: {
      code: r.code,
      name: r.name ?? '',
      origin: r.origin,
      destination: r.destination,
      distanceKm: r.distanceKm != null ? String(r.distanceKm) : '',
      defaultPriceMode: r.defaultPriceMode,
      defaultPrice: String(r.defaultPrice ?? 0),
      defaultPerDiem: String(r.defaultPerDiem ?? 0),
      customerId: r.customerId ?? '',
      cargoType: r.cargoType ?? '',
      active: r.active,
      notes: r.notes ?? '',
    },
  })

  const save = async () => {
    if (!editing) return
    const f = editing.form
    if (!f.code.trim()) return setToast({ kind: 'err', text: 'กรุณากรอกรหัสเส้นทาง' })
    if (!f.origin.trim()) return setToast({ kind: 'err', text: 'กรุณากรอกต้นทาง' })
    if (!f.destination.trim()) return setToast({ kind: 'err', text: 'กรุณากรอกปลายทาง' })

    const payload: Partial<Route> = {
      code: f.code.trim(),
      name: f.name.trim() || `${f.origin.trim()} → ${f.destination.trim()}`,
      origin: f.origin.trim(),
      destination: f.destination.trim(),
      distanceKm: f.distanceKm === '' ? null : Number(f.distanceKm),
      defaultPriceMode: f.defaultPriceMode,
      defaultPrice: Number(f.defaultPrice) || 0,
      defaultPerDiem: Number(f.defaultPerDiem) || 0,
      customerId: f.customerId || null,
      cargoType: f.cargoType.trim(),
      active: f.active,
      notes: f.notes.trim(),
    }

    try {
      if (editing.id) {
        await updateRoute.mutateAsync({ id: editing.id, patch: payload })
        setToast({ kind: 'ok', text: 'บันทึกการแก้ไขแล้ว' })
      } else {
        await insertRoute.mutateAsync(payload)
        setToast({ kind: 'ok', text: 'เพิ่มเส้นทางใหม่แล้ว' })
      }
      setEditing(null)
    } catch (e) {
      setToast({ kind: 'err', text: e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ' })
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    try {
      await deleteRoute.mutateAsync(deleting.id)
      setDeleting(null)
      setToast({ kind: 'ok', text: 'ลบเส้นทางแล้ว (งานเก่ายังคงข้อมูลของตัวเอง)' })
    } catch (e) {
      setToast({ kind: 'err', text: e instanceof Error ? e.message : 'ลบไม่สำเร็จ' })
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">ตั้งค่าเส้นทาง</h1>
          <div className="page-sub">
            {routes.length} เส้นทาง • ใช้เป็น default ราคา/เบี้ยเลี้ยงตอนเปิดงานขนส่ง และจัดกลุ่มในรายงาน
          </div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={openNew}>
            <Icon name="plus" size={15} /> เพิ่มเส้นทางใหม่
          </button>
        </div>
      </div>

      <div className="card pad" style={{ marginBottom: 14 }}>
        <div className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="ค้นหา รหัส / ต้นทาง / ปลายทาง / สินค้า..."
          />
          <SegmentedFilter
            value={activeFilter}
            onChange={setActiveFilter}
            options={[
              { value: 'all',      label: `ทั้งหมด (${routes.length})` },
              { value: 'active',   label: `ใช้งาน (${routes.filter(r => r.active).length})` },
              { value: 'inactive', label: `ปิด (${routes.filter(r => !r.active).length})` },
            ]}
          />
          <label className="row" style={{ gap: 8, fontSize: 13 }}>
            <span className="muted">ลูกค้า:</span>
            <select value={customerFilter} onChange={e => setCustomerFilter(e.target.value)} style={{ minWidth: 200 }}>
              <option value="">ทุกราย</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <span className="muted" style={{ fontSize: 13 }}>{filtered.length} รายการ</span>
        </div>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>รหัส</th>
              <th>ชื่อ</th>
              <th>ต้นทาง → ปลายทาง</th>
              <th className="num">ระยะ (km)</th>
              <th>ลูกค้า</th>
              <th>ค่าบรรทุก (default)</th>
              <th className="num right">เบี้ยเลี้ยง</th>
              <th>สถานะ</th>
              <th style={{ width: 100 }}>การกระทำ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const cust = customers.find(c => c.id === r.customerId)
              return (
                <tr key={r.id} style={{ opacity: r.active ? 1 : 0.55 }}>
                  <td className="mono" style={{ fontWeight: 600, color: 'var(--primary)' }}>{r.code}</td>
                  <td>{r.name || '—'}</td>
                  <td>
                    <div style={{ fontSize: 13 }}>{r.origin}</div>
                    <div className="muted" style={{ fontSize: 11.5 }}>→ {r.destination}</div>
                  </td>
                  <td className="num mono">{r.distanceKm != null ? db.fmt(r.distanceKm) : '—'}</td>
                  <td>{cust?.name ?? <span className="muted">ทุกราย</span>}</td>
                  <td className="mono">
                    {db.fmt(r.defaultPrice)} <span className="muted" style={{ fontSize: 11 }}>{priceModeLabel(r.defaultPriceMode)}</span>
                  </td>
                  <td className="num right mono">{db.thb(r.defaultPerDiem)}</td>
                  <td>
                    <span className={`badge ${r.active ? 'green' : 'gray'}`} style={{ fontSize: 11 }}>
                      {r.active ? 'ใช้งาน' : 'ปิด'}
                    </span>
                  </td>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      <button className="btn ghost icon sm" title="แก้ไข" onClick={() => openEdit(r)}>
                        <Icon name="edit" size={14} />
                      </button>
                      <button
                        className="btn ghost icon sm"
                        title="ลบ"
                        onClick={() => setDeleting(r)}
                        style={{ color: 'var(--red)' }}
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && !isLoading && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: 36, color: 'var(--text-2)' }}>
                  ไม่พบเส้นทาง
                  {q && <> — ลองล้างคำค้นหา หรือ <a onClick={openNew} style={{ cursor: 'pointer', color: 'var(--primary)' }}>เพิ่มเส้นทางใหม่</a></>}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {setActive && (
        <div className="muted" style={{ marginTop: 14, fontSize: 12 }}>
          💡 หมายเหตุ: ราคา/เบี้ยเลี้ยงในเส้นทางเป็น <strong>default</strong> เท่านั้น — งานที่บันทึกแล้วจะเก็บค่า ณ ตอนนั้นไว้ (snapshot) แก้ในตารางนี้ทีหลังไม่กระทบงานเก่า
        </div>
      )}

      {editing && (
        <RouteFormModal
          form={editing.form}
          isEdit={!!editing.id}
          customers={customers}
          onChange={(patch) => setEditing(s => s ? { ...s, form: { ...s.form, ...patch } } : s)}
          onCancel={() => setEditing(null)}
          onSave={save}
          saving={insertRoute.isPending || updateRoute.isPending}
        />
      )}

      {deleting && (
        <div className="modal-bg" onClick={() => setDeleting(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="head"><h3>ลบเส้นทาง</h3></div>
            <div className="body">
              <p style={{ marginBottom: 8 }}>
                ลบเส้นทาง <strong className="mono" style={{ color: 'var(--primary)' }}>{deleting.code}</strong> — {deleting.name || `${deleting.origin} → ${deleting.destination}`}?
              </p>
              <p className="muted" style={{ fontSize: 12.5 }}>
                งานเก่าที่เคยใช้เส้นทางนี้จะยังคงมีข้อมูล origin/destination/ราคา/เบี้ยเลี้ยงเดิม — แค่ตัด link routeId ทิ้ง
              </p>
            </div>
            <div className="foot">
              <button className="btn" onClick={() => setDeleting(null)}>ยกเลิก</button>
              <button className="btn danger solid" onClick={confirmDelete} disabled={deleteRoute.isPending}>
                <Icon name="trash" size={14} /> {deleteRoute.isPending ? 'กำลังลบ…' : 'ลบ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          onClick={() => setToast(null)}
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 2000,
            padding: '12px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
            background: toast.kind === 'ok' ? '#dcfce7' : '#fee2e2',
            color:      toast.kind === 'ok' ? '#166534' : '#991b1b',
            border: `1px solid ${toast.kind === 'ok' ? '#86efac' : '#fca5a5'}`,
            cursor: 'pointer', maxWidth: 360, boxShadow: '0 6px 24px rgba(0,0,0,.15)',
          }}
        >
          {toast.text}
        </div>
      )}
    </div>
  )
}

function RouteFormModal({
  form, isEdit, customers, onChange, onCancel, onSave, saving,
}: {
  form: RouteForm
  isEdit: boolean
  customers: Customer[]
  onChange: (patch: Partial<RouteForm>) => void
  onCancel: () => void
  onSave: () => void
  saving: boolean
}) {
  const previewName = form.name || `${form.origin || '—'} → ${form.destination || '—'}`
  return (
    <div className="modal-bg" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <div className="head"><h3>{isEdit ? '✏️ แก้ไขเส้นทาง' : '➕ เพิ่มเส้นทางใหม่'}</h3></div>
        <div className="body">
          <div className="grid-2" style={{ gap: 14 }}>
            <Field label="รหัส *">
              <input value={form.code} onChange={e => onChange({ code: e.target.value })} placeholder="RTE-001" />
            </Field>
            <Field label="ชื่อย่อ (แสดงในรายงาน)">
              <input value={form.name} onChange={e => onChange({ name: e.target.value })} placeholder={previewName} />
            </Field>
          </div>
          <div className="grid-2" style={{ gap: 14, marginTop: 14 }}>
            <Field label="ต้นทาง *">
              <input value={form.origin} onChange={e => onChange({ origin: e.target.value })} placeholder="เช่น โรงงาน KPS" />
            </Field>
            <Field label="ปลายทาง *">
              <input value={form.destination} onChange={e => onChange({ destination: e.target.value })} placeholder="เช่น ประจวบฯ" />
            </Field>
          </div>
          <div className="grid-2" style={{ gap: 14, marginTop: 14 }}>
            <Field label="ระยะทาง (km, ไม่บังคับ)">
              <input
                type="number" step="0.1" value={form.distanceKm}
                onChange={e => onChange({ distanceKm: e.target.value })} placeholder="0"
              />
            </Field>
            <Field label="ลูกค้า (ผูกเฉพาะ — ไม่บังคับ)">
              <select value={form.customerId} onChange={e => onChange({ customerId: e.target.value })}>
                <option value="">— ทุกราย —</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          </div>

          <div style={{ marginTop: 16, padding: 12, background: 'var(--bg)', borderRadius: 6 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 10 }}>ค่า default ตอนเปิดงาน</div>
            <Field label="รูปแบบราคา">
              <div className="row" style={{ gap: 16, paddingTop: 4 }}>
                {([
                  { v: 'per_ton', l: 'ต่อตัน' },
                  { v: 'per_kg',  l: 'ต่อกิโลกรัม' },
                  { v: 'lump',    l: 'เหมา' },
                ] as const).map(opt => (
                  <label key={opt.v} className="row" style={{ gap: 6, cursor: 'pointer', fontSize: 13 }}>
                    <input
                      type="radio"
                      checked={form.defaultPriceMode === opt.v}
                      onChange={() => onChange({ defaultPriceMode: opt.v })}
                      style={{ accentColor: 'var(--primary)' }}
                    />
                    <span>{opt.l}</span>
                  </label>
                ))}
              </div>
            </Field>
            <div className="grid-2" style={{ gap: 14, marginTop: 12 }}>
              <Field label={`ค่าบรรทุก (${priceModeLabel(form.defaultPriceMode)})`}>
                <input
                  type="number" step="0.01" value={form.defaultPrice}
                  onChange={e => onChange({ defaultPrice: e.target.value })} placeholder="0"
                />
              </Field>
              <Field label="เบี้ยเลี้ยง (บาท / ขา)">
                <input
                  type="number" step="0.01" value={form.defaultPerDiem}
                  onChange={e => onChange({ defaultPerDiem: e.target.value })} placeholder="0"
                />
              </Field>
            </div>
            <Field label="ประเภทสินค้า (default)">
              <input value={form.cargoType} onChange={e => onChange({ cargoType: e.target.value })} placeholder="เช่น ทั่วไป / เคมี" />
            </Field>
          </div>

          <div className="row" style={{ marginTop: 16, gap: 8 }}>
            <label className="row" style={{ gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={form.active}
                onChange={e => onChange({ active: e.target.checked })}
                style={{ accentColor: 'var(--primary)' }}
              />
              <span>เปิดใช้งาน (active)</span>
            </label>
          </div>

          <div style={{ marginTop: 14 }}>
            <Field label="หมายเหตุ">
              <textarea
                value={form.notes}
                onChange={e => onChange({ notes: e.target.value })}
                rows={2}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </Field>
          </div>
        </div>
        <div className="foot">
          <button className="btn" onClick={onCancel} disabled={saving}>ยกเลิก</button>
          <button className="btn primary" onClick={onSave} disabled={saving}>
            <Icon name="check" size={14} /> {saving ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
        </div>
      </div>
    </div>
  )
}
