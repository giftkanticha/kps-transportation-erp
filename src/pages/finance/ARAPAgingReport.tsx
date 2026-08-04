import { useMemo } from 'react'
import { db } from '../../lib/db'
import { useList } from '../../hooks/useTable'
import { useDispatches } from '../../hooks/useDispatches'
import { Icon } from '../../components/ui'
import type {
  BillingNote, DispatchLeg, Location,
  ExpenseHeader, Partner, SubJob, Subcontractor,
} from '../../types'

// รายงานอายุลูกหนี้/เจ้าหนี้ (AR/AP aging) — อ่านอย่างเดียว ไม่มี migration
// ใช้ข้อมูลที่ระบบมีอยู่แล้ว: ขา (legs) + ใบวางบิล/ใบเสร็จ (AR), ค่าใช้จ่ายค้างจ่าย +
// ค่าจ้างรถร่วมค้างจ่าย (AP) จัดกลุ่มตามอายุค้างเป็นช่วง 0-30 / 31-60 / 61-90 / 90+ วัน

const DAY = 86_400_000

// วันนี้ (เที่ยงคืน) — ให้จำนวนวันค้างนับเต็มวันไม่คลาดตามเวลาในวัน
function todayMidnight(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// จำนวนวันค้าง = วันนี้ − วันฐาน (ไม่ติดลบ)
function daysOutstanding(baseISO: string, todayMs: number): number {
  if (!baseISO) return 0
  const t = new Date(baseISO).getTime()
  if (Number.isNaN(t)) return 0
  return Math.max(0, Math.floor((todayMs - t) / DAY))
}

type Buckets = [number, number, number, number] // 0-30, 31-60, 61-90, 90+
const emptyBuckets = (): Buckets => [0, 0, 0, 0]
function bucketIndex(days: number): 0 | 1 | 2 | 3 {
  if (days <= 30) return 0
  if (days <= 60) return 1
  if (days <= 90) return 2
  return 3
}

interface AgingRow {
  key: string
  name: string
  total: number
  buckets: Buckets
  overdue: number // ยอดที่เกินกำหนดชำระ (ถ้ามีเงื่อนไขเครดิต/วันครบกำหนด)
  hasTerms: boolean
}

function sortRows(rows: AgingRow[]): AgingRow[] {
  return rows.sort((a, b) => b.total - a.total)
}

export function ARAPAgingReport() {
  const { data: dispatches = [] } = useDispatches()
  const { data: locations = [] } = useList<Location>('locations')
  const { data: notes = [] } = useList<BillingNote>('billing_notes')
  const { data: expHeaders = [] } = useList<ExpenseHeader>('expense_headers')
  const { data: partners = [] } = useList<Partner>('partners')
  const { data: subJobs = [] } = useList<SubJob>('sub_jobs')
  const { data: subs = [] } = useList<Subcontractor>('subcontractors')

  // ── AR: ลูกหนี้การค้า (ยังไม่รับเงิน) ─────────────────────────────────────
  const arRows = useMemo<AgingRow[]>(() => {
    const todayMs = todayMidnight()
    // ขาที่ "รับเงินแล้ว" = อยู่ในใบเสร็จ/ใบวางบิลที่ status = paid
    const paidLegIds = new Set<string>()
    for (const n of notes) if (n.status === 'paid') for (const id of n.legIds ?? []) paidLegIds.add(id)

    const locById = new Map(locations.map(l => [l.id, l]))
    const custByName = new Map<string, Location>()
    for (const l of locations) if (l.isCustomer && l.active) custByName.set(l.name, l)
    const billToOf = (leg: DispatchLeg): Location | null =>
      leg.billToLocationId ? (locById.get(leg.billToLocationId) ?? null) : (custByName.get(leg.destination) ?? null)

    const map = new Map<string, AgingRow>()
    for (const d of dispatches) {
      if (d.roundStatus !== 'closed') continue
      const baseISO = (d.returnAt || d.depart || d.date || '').slice(0, 10)
      for (const leg of d.legs ?? []) {
        if (!leg.id || leg.noBill) continue
        const net = (leg.amount || 0) - db.legWht(leg)
        if (net <= 0 || paidLegIds.has(leg.id)) continue
        const loc = billToOf(leg)
        if (!loc) continue
        const days = daysOutstanding(baseISO, todayMs)
        const row = map.get(loc.id) ?? { key: loc.id, name: loc.name, total: 0, buckets: emptyBuckets(), overdue: 0, hasTerms: true }
        row.total += net
        row.buckets[bucketIndex(days)] += net
        // เกินกำหนด = เลยเทอมเครดิตของลูกค้า (default 30 วัน)
        const dueMs = baseISO ? new Date(baseISO).getTime() + (loc.credit ?? 30) * DAY : 0
        if (dueMs && todayMs > dueMs) row.overdue += net
        map.set(loc.id, row)
      }
    }
    return sortRows([...map.values()])
  }, [dispatches, locations, notes])

  // ── AP: เจ้าหนี้ค่าใช้จ่าย (ร้านค้า/ช่าง) ที่ยังไม่จ่าย ───────────────────
  const apExpenseRows = useMemo<AgingRow[]>(() => {
    const todayMs = todayMidnight()
    const partnerById = new Map(partners.map(p => [p.id, p]))
    const map = new Map<string, AgingRow>()
    for (const h of expHeaders) {
      if (h.paid || (h.total || 0) <= 0) continue
      const key = h.partnerId || '__none__'
      const name = partnerById.get(h.partnerId)?.name ?? 'ไม่ระบุเจ้าหนี้'
      const baseISO = (h.date || '').slice(0, 10)
      const days = daysOutstanding(baseISO, todayMs)
      const row = map.get(key) ?? { key, name, total: 0, buckets: emptyBuckets(), overdue: 0, hasTerms: true }
      row.total += h.total
      row.buckets[bucketIndex(days)] += h.total
      // เกินกำหนด = เลย dueDate ของบิล
      if (h.dueDate && new Date(h.dueDate).getTime() < todayMs) row.overdue += h.total
      map.set(key, row)
    }
    return sortRows([...map.values()])
  }, [expHeaders, partners])

  // ── AP: ค่าจ้างรถร่วมค้างจ่าย (sub_jobs status = unpaid) ──────────────────
  // ไม่มีวันครบกำหนดเก็บไว้ → แสดงเฉพาะช่วงอายุ ไม่มีคอลัมน์ "เกินกำหนด"
  const apSubRows = useMemo<AgingRow[]>(() => {
    const todayMs = todayMidnight()
    const subById = new Map(subs.map(s => [s.id, s]))
    const netOf = (j: SubJob) => (j.total || 0) - (j.wht ? (j.total || 0) * 0.01 : 0)
    const map = new Map<string, AgingRow>()
    for (const j of subJobs) {
      if (j.status !== 'unpaid') continue
      const net = netOf(j)
      if (net <= 0) continue
      const key = j.subId || '__none__'
      const name = subById.get(j.subId)?.name ?? j.driverName ?? 'ไม่ระบุผู้รับจ้าง'
      const baseISO = (j.date || '').slice(0, 10)
      const days = daysOutstanding(baseISO, todayMs)
      const row = map.get(key) ?? { key, name, total: 0, buckets: emptyBuckets(), overdue: 0, hasTerms: false }
      row.total += net
      row.buckets[bucketIndex(days)] += net
      map.set(key, row)
    }
    return sortRows([...map.values()])
  }, [subJobs, subs])

  const arTotal = arRows.reduce((s, r) => s + r.total, 0)
  const arOverdue = arRows.reduce((s, r) => s + r.overdue, 0)
  const apExpTotal = apExpenseRows.reduce((s, r) => s + r.total, 0)
  const apSubTotal = apSubRows.reduce((s, r) => s + r.total, 0)
  const apTotal = apExpTotal + apSubTotal
  const apOverdue = apExpenseRows.reduce((s, r) => s + r.overdue, 0)

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">ลูกหนี้ / เจ้าหนี้ (AR/AP Aging)</h1>
          <div className="page-sub">
            อายุหนี้ค้างแยกช่วง 0-30 / 31-60 / 61-90 / 90+ วัน — คำนวณสดจากบิล/ค่าใช้จ่ายที่ยังไม่ปิดยอด
          </div>
        </div>
        <div className="actions no-print">
          <button className="btn" onClick={() => window.print()}>
            <Icon name="download" size={15} /> พิมพ์ / PDF
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <KpiCard label="ลูกหนี้รวม (AR)" value={db.thb(arTotal)} tone="green" sub={`${arRows.length} ราย`} />
        <KpiCard label="ลูกหนี้เกินกำหนด" value={db.thb(arOverdue)} tone="red" sub="เลยเทอมเครดิต" />
        <KpiCard label="เจ้าหนี้รวม (AP)" value={db.thb(apTotal)} tone="amber" sub={`ค่าใช้จ่าย + รถร่วม`} />
        <KpiCard label="เจ้าหนี้เกินกำหนด" value={db.thb(apOverdue)} tone="red" sub="เลยวันครบกำหนด" />
      </div>

      <AgingTable
        title="ลูกหนี้การค้า — ยังไม่เก็บเงิน"
        entityLabel="ลูกค้า"
        rows={arRows}
        showOverdue
      />

      <AgingTable
        title="เจ้าหนี้ค่าใช้จ่าย — ร้านค้า/ช่าง ที่ยังไม่จ่าย"
        entityLabel="เจ้าหนี้"
        rows={apExpenseRows}
        showOverdue
      />

      <AgingTable
        title="ค่าจ้างรถร่วมค้างจ่าย"
        entityLabel="ผู้รับจ้าง"
        rows={apSubRows}
        showOverdue={false}
      />
    </div>
  )
}

function KpiCard({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: 'green' | 'red' | 'amber' }) {
  const color = tone === 'green' ? 'var(--green, #059669)' : tone === 'red' ? 'var(--red, #dc2626)' : '#d97706'
  return (
    <div className="card" style={{ padding: '14px 18px' }}>
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 700, color, margin: '6px 0 2px' }}>{value}</div>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{sub}</div>
    </div>
  )
}

function AgingTable({
  title, entityLabel, rows, showOverdue,
}: {
  title: string
  entityLabel: string
  rows: AgingRow[]
  showOverdue: boolean
}) {
  const totals = rows.reduce<{ total: number; buckets: Buckets; overdue: number }>(
    (acc, r) => {
      acc.total += r.total
      acc.overdue += r.overdue
      for (let i = 0; i < 4; i++) acc.buckets[i] += r.buckets[i]
      return acc
    },
    { total: 0, buckets: emptyBuckets(), overdue: 0 },
  )
  const bucketHeads = ['0-30 วัน', '31-60 วัน', '61-90 วัน', '90+ วัน']

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="head">
        <h3>{title} ({rows.length})</h3>
      </div>
      <div className="tbl-wrap" style={{ border: 'none', overflowX: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>{entityLabel}</th>
              <th style={{ textAlign: 'right' }}>ยอดค้างรวม</th>
              {bucketHeads.map((h, i) => (
                <th key={h} style={{ textAlign: 'right', color: i >= 2 ? 'var(--red, #dc2626)' : undefined }}>{h}</th>
              ))}
              {showOverdue && <th style={{ textAlign: 'right' }}>เกินกำหนด</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={showOverdue ? 7 : 6} style={{ textAlign: 'center', padding: 28, color: 'var(--text-2)' }}>
                  ไม่มียอดค้าง
                </td>
              </tr>
            ) : (
              rows.map(r => (
                <tr key={r.key}>
                  <td style={{ color: r.overdue > 0 ? 'var(--red, #dc2626)' : undefined, fontWeight: r.overdue > 0 ? 600 : undefined }}>
                    {r.name}
                  </td>
                  <td className="mono" style={{ textAlign: 'right', fontWeight: 600 }}>{db.thb(r.total)}</td>
                  {r.buckets.map((b, i) => (
                    <td key={i} className="mono" style={{ textAlign: 'right', color: b > 0 && i >= 2 ? 'var(--red, #dc2626)' : b === 0 ? 'var(--text-muted)' : undefined }}>
                      {b > 0 ? db.thb(b) : '—'}
                    </td>
                  ))}
                  {showOverdue && (
                    <td className="mono" style={{ textAlign: 'right', color: r.overdue > 0 ? 'var(--red, #dc2626)' : 'var(--text-muted)', fontWeight: r.overdue > 0 ? 600 : undefined }}>
                      {r.overdue > 0 ? db.thb(r.overdue) : '—'}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr style={{ fontWeight: 700, borderTop: '2px solid var(--line)' }}>
                <td>รวม</td>
                <td className="mono" style={{ textAlign: 'right' }}>{db.thb(totals.total)}</td>
                {totals.buckets.map((b, i) => (
                  <td key={i} className="mono" style={{ textAlign: 'right', color: i >= 2 && b > 0 ? 'var(--red, #dc2626)' : undefined }}>
                    {db.thb(b)}
                  </td>
                ))}
                {showOverdue && (
                  <td className="mono" style={{ textAlign: 'right', color: totals.overdue > 0 ? 'var(--red, #dc2626)' : undefined }}>
                    {db.thb(totals.overdue)}
                  </td>
                )}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
