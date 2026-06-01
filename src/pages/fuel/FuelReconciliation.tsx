import { useState, useMemo } from 'react'
import { uid } from '../../lib/db'
import { useList, useInsert } from '../../hooks/useTable'
import { useDispatches } from '../../hooks/useDispatches'
import type { Vehicle, FuelRecord, FuelTransaction, FuelStock } from '../../types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Same Thai-string check the rest of the fuel module now uses. The old
// exclusion list ('PTT' / 'Shell' / …) mis-classified the literal 'ปั๊มภายนอก'
// stored by ExpressFuelLog as factory.
const isFactory = (f: FuelRecord) => f.station === 'ถังโรงงาน'

// ─── Component ────────────────────────────────────────────────────────────────

export function FuelReconciliation() {
  const [syncing, setSyncing] = useState(false)
  const [syncLog, setSyncLog] = useState<string[]>([])

  const { data: vehicles = [] } = useList<Vehicle>('vehicles')
  const { data: allFuelTxs = [] } = useList<FuelTransaction>('fuel_transactions')
  const { data: dispatches = [] } = useDispatches()
  const insertFuelTx = useInsert<FuelTransaction>('fuel_transactions')
  const { data: legacyRecords = [] } = useList<FuelRecord>('fuel_records')
  const { data: fuelStock = [] } = useList<FuelStock>('fuel_stock')
  const fuelTxs = useMemo(
    () => allFuelTxs.filter(t => t.status !== 'REVERSED'),
    [allFuelTxs],
  )

  // ── Per-vehicle comparison ─────────────────────────────────────────────────

  const vehicleRows = useMemo(() => {
    return vehicles
      .map(v => {
        const legacyLiters = legacyRecords
          .filter(f => f.vehicleId === v.id)
          .reduce((s, f) => s + (f.liters || 0), 0)
        const newLiters = fuelTxs
          .filter(t => t.vehicleId === v.id)
          .reduce((s, t) => s + t.liters, 0)
        const diff = Math.abs(legacyLiters - newLiters)
        const match = diff < 0.01
        return { vehicle: v, legacyLiters, newLiters, diff, match }
      })
      .filter(r => r.legacyLiters > 0 || r.newLiters > 0)
      .sort((a, b) => b.diff - a.diff)
  }, [vehicles, legacyRecords, fuelTxs])

  // ── Stock balance comparison ───────────────────────────────────────────────

  const stockIn = useMemo(() => fuelStock.reduce((s, r) => s + r.liters, 0), [fuelStock])
  const legacyOut = useMemo(
    () => legacyRecords.filter(isFactory).reduce((s, f) => s + f.liters, 0),
    [legacyRecords],
  )
  const newOut = useMemo(
    () => fuelTxs.filter(t => t.source === 'FACTORY_TANK').reduce((s, t) => s + t.liters, 0),
    [fuelTxs],
  )
  const legacyBalance = Math.max(0, stockIn - legacyOut)
  const newBalance = Math.max(0, stockIn - newOut)
  const stockDiff = Math.abs(legacyBalance - newBalance)

  // ── Counts ─────────────────────────────────────────────────────────────────

  const mismatched = vehicleRows.filter(r => !r.match).length
  const legacyOnly = legacyRecords.filter(lr => {
    return !fuelTxs.some(t =>
      t.vehicleId === lr.vehicleId &&
      t.date === lr.date &&
      Math.abs(t.liters - lr.liters) < 0.01,
    )
  })

  // ── Sync: create FuelTransactions for legacy-only records ─────────────────

  const handleSync = async () => {
    if (!confirm(`ซิงค์ ${legacyOnly.length} รายการ?\nระบบจะสร้าง FuelTransaction สำหรับรายการที่ยังไม่ได้ migrate`)) return

    setSyncing(true)
    const log: string[] = []
    let failed = 0

    for (const lr of legacyOnly) {
      const vehicle = vehicles.find(v => v.id === lr.vehicleId)
      const isFactoryFuel = isFactory(lr)
      const source = isFactoryFuel ? 'FACTORY_TANK' : 'EXTERNAL_PUMP'
      const group = vehicle?.groupKind ?? 'TRANSPORT'
      let status: FuelTransaction['status'] = 'FLOATING'

      if (group === 'INTERNAL') {
        status = 'INTERNAL_DEDUCTED'
      } else {
        const match = dispatches.find(d =>
          d.vehicleId === lr.vehicleId &&
          d.date?.slice(0, 10) === lr.date?.slice(0, 10) &&
          (d.status === 'scheduled' || d.status === 'in-progress' || d.status === 'completed'),
        )
        if (match) status = 'TRIP_LINKED'
      }

      try {
        await insertFuelTx.mutateAsync({
          id: uid('ftx'),
          date: lr.date,
          vehicleId: lr.vehicleId,
          liters: lr.liters,
          pricePerL: lr.pricePerL || 35,
          total: lr.total || lr.liters * 35,
          source,
          tripId: null,
          status,
          tripFuelRole: 'NORMAL',
          entryMethod: 'MANUAL_ADMIN',
          createdAt: new Date().toISOString(),
          reversedAt: null,
          reversalOf: null,
          note: `Migrated from legacy FuelRecord ${lr.id}`,
        })
        log.push(`✅ ${vehicle?.plate ?? lr.vehicleId} · ${lr.date} · ${lr.liters} ล. → ${status}`)
      } catch (e) {
        failed += 1
        log.push(`❌ ${vehicle?.plate ?? lr.vehicleId} · ${lr.date}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    if (failed > 0) alert(`ซิงค์เสร็จ — สำเร็จ ${log.length - failed} · ล้มเหลว ${failed} (ดูรายละเอียดในรายการด้านล่าง)`)
    setSyncLog(log)
    setSyncing(false)
  }

  // ─────────────────────────────────────────────────────────────────────────────

  const stockOk = stockDiff < 0.01

  return (
    <div>
      {/* Header */}
      <div className="page-head no-print">
        <div>
          <h1 className="page-title">🔍 ตรวจสอบข้อมูลน้ำมัน (Reconciliation)</h1>
          <div className="page-sub">เปรียบเทียบข้อมูลระบบเก่า (FuelRecord) กับระบบใหม่ (FuelTransaction)</div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid-4 no-print" style={{ marginBottom: 18, gap: 14 }}>
        <div className="card kpi">
          <div className="label">รถที่มีข้อมูล</div>
          <div className="mono" style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>{vehicleRows.length}</div>
          <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>คัน</div>
        </div>
        <div className="card kpi" style={{ background: mismatched > 0 ? '#FFFBEB' : '#F0FDF4', border: `1px solid ${mismatched > 0 ? '#FDE68A' : '#BBF7D0'}` }}>
          <div className="label" style={{ color: mismatched > 0 ? '#92400E' : '#166534' }}>ข้อมูลไม่ตรง</div>
          <div className="mono" style={{ fontSize: 24, fontWeight: 700, marginTop: 6, color: mismatched > 0 ? '#92400E' : '#166534' }}>{mismatched}</div>
          <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>คัน</div>
        </div>
        <div className="card kpi" style={{ background: legacyOnly.length > 0 ? '#FEF2F2' : '#F0FDF4', border: `1px solid ${legacyOnly.length > 0 ? '#FECACA' : '#BBF7D0'}` }}>
          <div className="label" style={{ color: legacyOnly.length > 0 ? '#991B1B' : '#166534' }}>รายการยังไม่ซิงค์</div>
          <div className="mono" style={{ fontSize: 24, fontWeight: 700, marginTop: 6, color: legacyOnly.length > 0 ? '#991B1B' : '#166534' }}>{legacyOnly.length}</div>
          <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>รายการ</div>
        </div>
        <div className="card kpi" style={{ background: stockOk ? '#F0FDF4' : '#FFFBEB', border: `1px solid ${stockOk ? '#BBF7D0' : '#FDE68A'}` }}>
          <div className="label" style={{ color: stockOk ? '#166534' : '#92400E' }}>ส่วนต่างสต็อก</div>
          <div className="mono" style={{ fontSize: 24, fontWeight: 700, marginTop: 6, color: stockOk ? '#166534' : '#92400E' }}>
            {fmt(stockDiff)} <span style={{ fontSize: 11 }}>ล.</span>
          </div>
        </div>
      </div>

      {/* Stock balance comparison */}
      <div style={{ borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.06)', background: '#fff', marginBottom: 18 }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', fontWeight: 600, fontSize: 14 }}>
          📦 สรุปสต็อกคลัง
        </div>
        <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
          <div>
            <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600, marginBottom: 6 }}>รับเข้าทั้งหมด</div>
            <div style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 700, color: '#166534' }}>{fmt(stockIn)} ล.</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600, marginBottom: 4 }}>คลังเก่า (Legacy)</div>
            <div style={{ fontFamily: 'monospace', fontSize: 14, color: '#374151' }}>ออก: {fmt(legacyOut)} ล.</div>
            <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: '#1D4ED8', marginTop: 4 }}>คงเหลือ: {fmt(legacyBalance)} ล.</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600, marginBottom: 4 }}>ระบบใหม่ (Transaction)</div>
            <div style={{ fontFamily: 'monospace', fontSize: 14, color: '#374151' }}>ออก: {fmt(newOut)} ล.</div>
            <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: stockOk ? '#166534' : '#92400E', marginTop: 4 }}>คงเหลือ: {fmt(newBalance)} ล.</div>
          </div>
        </div>
        {!stockOk && (
          <div style={{ padding: '10px 20px', borderTop: '1px solid #FDE68A', background: '#FFFBEB', fontSize: 12, color: '#78350F' }}>
            ⚠️ ต่างกัน {fmt(stockDiff)} ลิตร — อาจเพราะรายการที่ยังไม่ได้ซิงค์ ({legacyOnly.length} รายการ)
          </div>
        )}
      </div>

      {/* Per-vehicle table */}
      <div style={{ borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.06)', background: '#fff', marginBottom: 18 }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>🚛 เปรียบเทียบรายคัน</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>เรียงตามส่วนต่าง (มากสุดขึ้นก่อน)</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                {['ทะเบียน', 'กลุ่ม', 'ระบบเก่า (legacy)', 'ระบบใหม่ (transaction)', 'ส่วนต่าง', 'สถานะ'].map((h, i) => (
                  <th key={i} style={{
                    padding: '9px 14px',
                    textAlign: i >= 2 && i <= 4 ? 'right' : 'left',
                    color: '#64748B', fontSize: 11, fontWeight: 700,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vehicleRows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '32px 0', textAlign: 'center', color: '#9CA3AF' }}>ไม่มีข้อมูลน้ำมัน</td>
                </tr>
              ) : vehicleRows.map((r, i) => (
                <tr key={r.vehicle.id} style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                  <td style={{ padding: '9px 14px' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>{r.vehicle.plate}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>{r.vehicle.brand}</span>
                  </td>
                  <td style={{ padding: '9px 14px' }}>
                    {r.vehicle.groupKind === 'INTERNAL' ? (
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#F0FDF4', color: '#166534' }}>🏭 โรงงาน</span>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#EFF6FF', color: '#1D4ED8' }}>🚛 ขนส่ง</span>
                    )}
                  </td>
                  <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'monospace' }}>
                    {fmt(r.legacyLiters)} ล.
                  </td>
                  <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'monospace' }}>
                    {fmt(r.newLiters)} ล.
                  </td>
                  <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'monospace', color: r.match ? '#166534' : '#DC2626', fontWeight: r.match ? 400 : 700 }}>
                    {r.match ? '—' : `${fmt(r.diff)} ล.`}
                  </td>
                  <td style={{ padding: '9px 14px' }}>
                    {r.match ? (
                      <span style={{ fontSize: 12, color: '#166534', fontWeight: 600 }}>✅ ตรง</span>
                    ) : (
                      <span style={{ fontSize: 12, color: '#DC2626', fontWeight: 600 }}>⚠️ ต่างกัน</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sync section */}
      <div style={{ borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.06)', background: '#fff', marginBottom: 18 }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', fontWeight: 600, fontSize: 14 }}>
          🔄 ซิงค์ข้อมูล
        </div>
        <div style={{ padding: '16px 20px' }}>
          {legacyOnly.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#166534', fontWeight: 600 }}>
              ✅ ข้อมูลทั้งหมดซิงค์แล้ว — ไม่มีรายการที่ค้างอยู่
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 14, fontSize: 13, color: '#374151' }}>
                พบ <strong style={{ color: '#DC2626' }}>{legacyOnly.length} รายการ</strong> ในระบบเก่าที่ยังไม่ได้สร้าง FuelTransaction
                — คลิก "ซิงค์ข้อมูล" เพื่อ migrate อัตโนมัติ
              </div>
              <div style={{ overflowX: 'auto', marginBottom: 16, maxHeight: 200, borderRadius: 8, border: '1px solid #F1F5F9' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', position: 'sticky', top: 0 }}>
                      {['ทะเบียน', 'วันที่', 'ลิตร', 'แหล่ง'].map((h, i) => (
                        <th key={i} style={{ padding: '6px 12px', textAlign: i >= 2 ? 'right' : 'left', color: '#64748B', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {legacyOnly.slice(0, 50).map((lr, i) => {
                      const v = vehicles.find(v => v.id === lr.vehicleId)
                      return (
                        <tr key={lr.id} style={{ borderTop: '1px solid #F1F5F9', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                          <td style={{ padding: '5px 12px', fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 600 }}>{v?.plate ?? lr.vehicleId}</td>
                          <td style={{ padding: '5px 12px', color: '#64748B' }}>{lr.date}</td>
                          <td style={{ padding: '5px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(lr.liters)}</td>
                          <td style={{ padding: '5px 12px', textAlign: 'right' }}>
                            <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 20, background: isFactory(lr) ? '#EFF6FF' : '#FFF7ED', color: isFactory(lr) ? '#1D4ED8' : '#C2410C' }}>
                              {isFactory(lr) ? 'ถังโรงงาน' : 'ปั๊มนอก'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                    {legacyOnly.length > 50 && (
                      <tr>
                        <td colSpan={4} style={{ padding: '8px 12px', textAlign: 'center', color: '#9CA3AF', fontSize: 11 }}>
                          ...และอีก {legacyOnly.length - 50} รายการ
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <button
                onClick={handleSync}
                disabled={syncing}
                style={{
                  background: syncing ? '#9CA3AF' : '#0066CC', color: '#fff', border: 'none',
                  borderRadius: 8, padding: '10px 24px', cursor: syncing ? 'default' : 'pointer',
                  fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
                }}
              >
                {syncing ? '⏳ กำลังซิงค์...' : `🔄 ซิงค์ข้อมูล ${legacyOnly.length} รายการ`}
              </button>
            </>
          )}

          {/* Sync log */}
          {syncLog.length > 0 && (
            <div style={{ marginTop: 16, borderRadius: 8, background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '12px 16px', maxHeight: 200, overflowY: 'auto' }}>
              <div style={{ fontWeight: 600, fontSize: 12, color: '#166534', marginBottom: 8 }}>✅ ผลการซิงค์</div>
              {syncLog.map((line, i) => (
                <div key={i} style={{ fontSize: 11, color: '#374151', fontFamily: 'monospace', lineHeight: 1.7 }}>{line}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
