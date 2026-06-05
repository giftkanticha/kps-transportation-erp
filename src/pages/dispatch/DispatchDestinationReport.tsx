import { useState, useMemo } from 'react'
import { db } from '../../lib/db'
import { useList } from '../../hooks/useTable'
import { useDispatches } from '../../hooks/useDispatches'
import type { Customer } from '../../types'
import { Icon, Field } from '../../components/ui'

interface Props {
  setActive: (id: string) => void
  setSubject?: (s: unknown) => void
}

type SortKey = 'count' | 'revenue' | 'recent'

interface DestRow {
  key: string             // normalized lowercase
  display: string         // most common original-case spelling
  legCount: number
  totalWeight: number
  totalRevenue: number
  totalPerDiem: number
  avgRevenue: number
  lastDate: string
  topOrigins: { name: string; count: number }[]
}

// Pick the casing variant seen most often, so "เชียงใหม่" and "เชียงใหม่ "
// (with stray space) become a single row labeled with whichever spelling
// dispatchers used most. Falls back to the first seen if all tied.
function pickDisplay(variants: Map<string, number>): string {
  let best = ''
  let bestCount = -1
  for (const [name, count] of variants) {
    if (count > bestCount) { best = name; bestCount = count }
  }
  return best
}

export function DispatchDestinationReport({}: Props) {
  const today = new Date()
  const [from, setFrom] = useState(`${today.getFullYear()}-01-01`)
  const [to, setTo] = useState(today.toISOString().slice(0, 10))
  const [customerId, setCustomerId] = useState('')
  const [originFilter, setOriginFilter] = useState('')
  const [q, setQ] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('count')

  const { data: customers = [] } = useList<Customer>('customers')
  const { data: dispatches = [] } = useDispatches()

  // All distinct origins seen in data — used for the origin filter dropdown.
  // Same dedup logic as destinations: lowercase key, most-common spelling shown.
  const originOptions = useMemo(() => {
    const variants = new Map<string, Map<string, number>>()
    for (const d of dispatches) {
      for (const l of (d.legs ?? [])) {
        const raw = (l.origin || '').trim()
        if (!raw) continue
        const key = raw.toLowerCase()
        const inner = variants.get(key) ?? new Map<string, number>()
        inner.set(raw, (inner.get(raw) ?? 0) + 1)
        variants.set(key, inner)
      }
    }
    return [...variants.entries()]
      .map(([key, inner]) => ({ key, display: pickDisplay(inner) }))
      .sort((a, b) => a.display.localeCompare(b.display, 'th'))
  }, [dispatches])

  // Group legs by destination (normalized) within filter window.
  const rows = useMemo<DestRow[]>(() => {
    const acc = new Map<string, {
      legCount: number
      totalWeight: number
      totalRevenue: number
      totalPerDiem: number
      lastDate: string
      variants: Map<string, number>
      origins: Map<string, number>
    }>()

    for (const d of dispatches) {
      const status = d.roundStatus
      if (status !== 'draft' && status !== 'closed' && d.status !== 'completed') continue
      const dt = (d.depart || d.date || '').slice(0, 10)
      if (from && dt < from) continue
      if (to && dt > to) continue

      for (const l of (d.legs ?? [])) {
        const destRaw = (l.destination || '').trim()
        if (!destRaw) continue
        const key = destRaw.toLowerCase()

        const cid = l.customerId ?? d.customerId
        if (customerId && cid !== customerId) continue

        const originRaw = (l.origin || '').trim()
        if (originFilter && originRaw.toLowerCase() !== originFilter) continue

        let row = acc.get(key)
        if (!row) {
          row = {
            legCount: 0, totalWeight: 0, totalRevenue: 0, totalPerDiem: 0,
            lastDate: '', variants: new Map(), origins: new Map(),
          }
          acc.set(key, row)
        }
        row.legCount += 1
        row.totalWeight += l.weight || 0
        row.totalRevenue += l.amount || 0
        row.totalPerDiem += l.perDiem || 0
        if (dt > row.lastDate) row.lastDate = dt
        row.variants.set(destRaw, (row.variants.get(destRaw) ?? 0) + 1)
        if (originRaw) row.origins.set(originRaw, (row.origins.get(originRaw) ?? 0) + 1)
      }
    }

    return [...acc.entries()].map(([key, v]) => {
      const topOrigins = [...v.origins.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 2)
      return {
        key,
        display: pickDisplay(v.variants),
        legCount: v.legCount,
        totalWeight: v.totalWeight,
        totalRevenue: v.totalRevenue,
        totalPerDiem: v.totalPerDiem,
        avgRevenue: v.legCount > 0 ? v.totalRevenue / v.legCount : 0,
        lastDate: v.lastDate,
        topOrigins,
      }
    })
  }, [dispatches, from, to, customerId, originFilter])

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const arr = needle
      ? rows.filter(r => r.display.toLowerCase().includes(needle))
      : rows.slice()
    if (sortKey === 'count')   arr.sort((a, b) => b.legCount - a.legCount)
    if (sortKey === 'revenue') arr.sort((a, b) => b.totalRevenue - a.totalRevenue)
    if (sortKey === 'recent')  arr.sort((a, b) => b.lastDate.localeCompare(a.lastDate))
    return arr
  }, [rows, q, sortKey])

  const totals = useMemo(() => visible.reduce(
    (a, r) => ({
      legCount: a.legCount + r.legCount,
      revenue:  a.revenue + r.totalRevenue,
      perDiem:  a.perDiem + r.totalPerDiem,
      weight:   a.weight + r.totalWeight,
    }),
    { legCount: 0, revenue: 0, perDiem: 0, weight: 0 },
  ), [visible])

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">รายงานปลายทาง</h1>
          <div className="page-sub">
            สรุปจำนวนเที่ยว · รายได้ · เบี้ยเลี้ยง รายปลายทาง — ใช้ดูว่าวิ่งปลายทางไหนบ่อยที่สุด
          </div>
        </div>
        <div className="actions no-print">
          <button className="btn" onClick={() => window.print()}>
            <Icon name="download" size={15} /> พิมพ์ / PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card pad no-print" style={{ marginBottom: 16 }}>
        <div className="grid-4" style={{ gap: 12 }}>
          <Field label="จาก">
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </Field>
          <Field label="ถึง">
            <input type="date" value={to} onChange={e => setTo(e.target.value)} />
          </Field>
          <Field label="ลูกค้า">
            <select value={customerId} onChange={e => setCustomerId(e.target.value)}>
              <option value="">ทั้งหมด</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="ต้นทาง">
            <select value={originFilter} onChange={e => setOriginFilter(e.target.value)}>
              <option value="">ทุกต้นทาง</option>
              {originOptions.map(o => <option key={o.key} value={o.key}>{o.display}</option>)}
            </select>
          </Field>
        </div>
        <div className="row" style={{ gap: 12, alignItems: 'center', marginTop: 12 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-2)' }}>
              <Icon name="search" size={14} />
            </span>
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="ค้นชื่อปลายทาง..."
              style={{ paddingLeft: 32, width: '100%' }}
            />
          </div>
          <label className="row" style={{ gap: 8, fontSize: 13 }}>
            <span className="muted">เรียงตาม:</span>
            <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)} style={{ minWidth: 180 }}>
              <option value="count">จำนวนเที่ยว (มาก → น้อย)</option>
              <option value="revenue">รายได้ (มาก → น้อย)</option>
              <option value="recent">ครั้งล่าสุด</option>
            </select>
          </label>
          <span className="muted" style={{ fontSize: 13 }}>{visible.length} ปลายทาง</span>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid-4" style={{ marginBottom: 16, gap: 12 }}>
        <div className="card kpi">
          <div className="label">จำนวนเที่ยวรวม</div>
          <div className="row">
            <div className="icn-box"><Icon name="trip" size={18} /></div>
            <div className="value">{db.fmt(totals.legCount)}</div>
          </div>
        </div>
        <div className="card kpi">
          <div className="label">ปลายทางทั้งหมด</div>
          <div className="row">
            <div className="icn-box"><Icon name="pin" size={18} /></div>
            <div className="value">{db.fmt(visible.length)}</div>
          </div>
        </div>
        <div className="card kpi">
          <div className="label">รายได้รวม</div>
          <div className="row">
            <div className="icn-box green"><Icon name="money" size={18} /></div>
            <div className="value">{db.thb(totals.revenue)}</div>
          </div>
        </div>
        <div className="card kpi">
          <div className="label">เบี้ยเลี้ยงรวม</div>
          <div className="row">
            <div className="icn-box amber"><Icon name="wallet" size={18} /></div>
            <div className="value">{db.thb(totals.perDiem)}</div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="head">
          <h3>ปลายทางในช่วงเวลา ({visible.length})</h3>
        </div>
        <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>ปลายทาง</th>
                <th>ต้นทางที่ใช้</th>
                <th className="num">เที่ยว</th>
                <th className="num">น้ำหนัก (ตัน)</th>
                <th className="num">รายได้รวม</th>
                <th className="num">รายได้/เที่ยว</th>
                <th className="num">เบี้ยเลี้ยงรวม</th>
                <th>ล่าสุด</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(r => (
                <tr key={r.key}>
                  <td style={{ fontWeight: 500 }}>{r.display}</td>
                  <td style={{ fontSize: 12.5 }}>
                    {r.topOrigins.length === 0
                      ? <span className="muted">—</span>
                      : r.topOrigins.map((o, i) => (
                        <span key={o.name}>
                          {i > 0 && <span className="muted">, </span>}
                          {o.name} <span className="muted">({o.count})</span>
                        </span>
                      ))}
                  </td>
                  <td className="num" style={{ fontWeight: 600 }}>{r.legCount}</td>
                  <td className="num mono">{r.totalWeight.toFixed(1)}</td>
                  <td className="num mono" style={{ fontWeight: 600 }}>{db.thb(r.totalRevenue)}</td>
                  <td className="num mono">{db.thb(r.avgRevenue)}</td>
                  <td className="num mono">{db.thb(r.totalPerDiem)}</td>
                  <td className="muted" style={{ fontSize: 12 }}>{r.lastDate || '—'}</td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 36, color: 'var(--text-2)' }}>
                    ไม่พบข้อมูลในช่วงเวลาที่เลือก
                  </td>
                </tr>
              )}
              {visible.length > 0 && (
                <tr style={{ fontWeight: 600, background: 'var(--bg)' }}>
                  <td colSpan={2} className="right">รวม {visible.length} ปลายทาง</td>
                  <td className="num">{totals.legCount}</td>
                  <td className="num mono">{totals.weight.toFixed(1)}</td>
                  <td className="num mono" style={{ color: 'var(--green)' }}>{db.thb(totals.revenue)}</td>
                  <td></td>
                  <td className="num mono">{db.thb(totals.perDiem)}</td>
                  <td></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
