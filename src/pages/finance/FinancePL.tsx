import { db } from '../../lib/db'
import { Icon } from '../../components/ui'
import type { Vehicle, Dispatch, FuelRecord, Maintenance, Expense, FixedCost } from '../../types'

interface VehicleRow {
  v: Vehicle
  rev: number
  fuelC: number
  mntC: number
  expC: number
  fixC: number
  cost: number
  pnl: number
  margin: number
}

export function FinancePL() {
  const vehicles = db.getAll<Vehicle>('vehicles')
  const dispatch = db.getAll<Dispatch>('dispatch')
  const fuel = db.getAll<FuelRecord>('fuel')
  const maintenance = db.getAll<Maintenance>('maintenance')
  const expenses = db.getAll<Expense>('expenses')
  const fixedCosts = db.getAll<FixedCost>('fixedCosts')

  const rows: VehicleRow[] = vehicles.map((v) => {
    const rev = dispatch.filter((t) => t.vehicleId === v.id).reduce((s, t) => s + (t.revenue || 0), 0)
    const fuelC = fuel.filter((f) => f.vehicleId === v.id).reduce((s, f) => s + f.total, 0)
    const mntC = maintenance.filter((m) => m.vehicleId === v.id).reduce((s, m) => s + (m.cost || 0), 0)
    const expC = expenses.filter((x) => x.vehicleId === v.id).reduce((s, x) => s + x.amount, 0)
    const fixC = fixedCosts.filter((f) => f.vehicleId === v.id).reduce((s, f) => s + f.monthly, 0)
    const cost = fuelC + mntC + expC + fixC
    const pnl = rev - cost
    return { v, rev, fuelC, mntC, expC, fixC, cost, pnl, margin: rev > 0 ? (pnl / rev) * 100 : 0 }
  })

  const totRev = rows.reduce((s, r) => s + r.rev, 0)
  const totFuel = rows.reduce((s, r) => s + r.fuelC, 0)
  const totMnt = rows.reduce((s, r) => s + r.mntC, 0)
  const totExp = rows.reduce((s, r) => s + r.expC, 0)
  const totFix = rows.reduce((s, r) => s + r.fixC, 0)
  const totCost = rows.reduce((s, r) => s + r.cost, 0)
  const totPnl = rows.reduce((s, r) => s + r.pnl, 0)

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">P&amp;L รายคัน</h1>
          <div className="page-sub">กำไร-ขาดทุนรายคัน เดือนพฤษภาคม 2026</div>
        </div>
        <div className="actions">
          <button className="btn primary">
            <Icon name="download" size={15} /> ส่งออก
          </button>
        </div>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>รถ</th>
              <th>ประเภท</th>
              <th className="right">รายได้</th>
              <th className="right">ค่าน้ำมัน</th>
              <th className="right">ค่าซ่อม</th>
              <th className="right">ค่าใช้จ่ายอื่น</th>
              <th className="right">ค่าใช้จ่ายคงที่</th>
              <th className="right">รวมต้นทุน</th>
              <th className="right">กำไร/ขาดทุน</th>
              <th className="right">Margin</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.v.id}>
                <td>
                  <span className="mono badge gray">{r.v.plate}</span>
                </td>
                <td className="muted" style={{ fontSize: 12.5 }}>
                  {r.v.brand}
                </td>
                <td className="num right" style={{ fontWeight: 600 }}>
                  {db.thb(r.rev)}
                </td>
                <td className="num right">{db.thb(r.fuelC)}</td>
                <td className="num right">{db.thb(r.mntC)}</td>
                <td className="num right">{db.thb(r.expC)}</td>
                <td className="num right">{db.thb(r.fixC)}</td>
                <td className="num right">{db.thb(r.cost)}</td>
                <td
                  className="num right"
                  style={{ fontWeight: 700, color: r.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}
                >
                  {db.thb(r.pnl)}
                </td>
                <td
                  className="num right"
                  style={{
                    fontWeight: 600,
                    color:
                      r.margin >= 30
                        ? 'var(--green)'
                        : r.margin >= 0
                          ? 'var(--amber)'
                          : 'var(--red)',
                  }}
                >
                  {r.margin.toFixed(1)}%
                </td>
              </tr>
            ))}
            <tr style={{ background: 'var(--bg-sunk)', fontWeight: 700 }}>
              <td colSpan={2}>รวม</td>
              <td className="num right">{db.thb(totRev)}</td>
              <td className="num right">{db.thb(totFuel)}</td>
              <td className="num right">{db.thb(totMnt)}</td>
              <td className="num right">{db.thb(totExp)}</td>
              <td className="num right">{db.thb(totFix)}</td>
              <td className="num right">{db.thb(totCost)}</td>
              <td className="num right" style={{ color: 'var(--green)' }}>
                {db.thb(totPnl)}
              </td>
              <td className="num right">—</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
