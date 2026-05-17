import { db } from '../../lib/db'
import { Icon } from '../../components/ui'
import type { Dispatch, Expense, FuelRecord, Maintenance, FixedCost } from '../../types'

export function FinanceSummary() {
  const dispatch = db.getAll<Dispatch>('dispatch')
  const expenses = db.getAll<Expense>('expenses')
  const fuel = db.getAll<FuelRecord>('fuel')
  const maintenance = db.getAll<Maintenance>('maintenance')
  const fixed = db.getAll<FixedCost>('fixedCosts').reduce((s, f) => s + f.monthly, 0)

  const rev = dispatch.reduce((s, t) => s + (t.revenue || 0), 0)
  const fuelC = fuel.reduce((s, f) => s + f.total, 0)
  const mntC = maintenance.reduce((s, m) => s + (m.cost || 0), 0)
  const expC = expenses.reduce((s, x) => s + x.amount, 0)
  const cost = fuelC + mntC + expC + fixed
  const pnl = rev - cost
  const margin = rev > 0 ? (pnl / rev) * 100 : 0

  const costBreakdown: [string, number, string][] = [
    ['ค่าน้ำมัน', fuelC, 'amber'],
    ['ค่าซ่อมบำรุงรักษา', mntC, 'blue'],
    ['ค่าใช้จ่ายอื่นๆ', expC, 'violet'],
    ['ค่าใช้จ่ายคงที่', fixed, 'teal'],
  ]

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">รายงานสรุปการเงิน</h1>
          <div className="page-sub">งบกำไร-ขาดทุน เดือนพฤษภาคม 2026</div>
        </div>
        <div className="actions">
          <button className="btn primary">
            <Icon name="download" size={15} /> ส่งออก PDF
          </button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 16 }}>
        <div className="card kpi">
          <div className="label">รายได้</div>
          <div className="row">
            <div className="icn-box green">
              <Icon name="money" size={18} />
            </div>
            <div className="value">{db.thb(rev)}</div>
          </div>
        </div>
        <div className="card kpi">
          <div className="label">ต้นทุนรวม</div>
          <div className="row">
            <div className="icn-box red">
              <Icon name="money" size={18} />
            </div>
            <div className="value">{db.thb(cost)}</div>
          </div>
        </div>
        <div className="card kpi">
          <div className="label">กำไร</div>
          <div className="row">
            <div className="icn-box teal">
              <Icon name="chart" size={18} />
            </div>
            <div className="value">{db.thb(pnl)}</div>
          </div>
        </div>
        <div className="card kpi">
          <div className="label">Margin</div>
          <div className="row">
            <div className="icn-box">
              <Icon name="chart" size={18} />
            </div>
            <div className="value">
              {margin.toFixed(1)}
              <span className="unit">%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card pad" style={{ maxWidth: 720 }}>
        <h3 className="section-title">รายละเอียดต้นทุน</h3>
        {costBreakdown.map(([label, val]) => (
          <div key={label} style={{ marginBottom: 14 }}>
            <div className="row" style={{ marginBottom: 4 }}>
              <span>{label}</span>
              <div className="spacer" />
              <span className="mono" style={{ fontWeight: 600 }}>
                {db.thb(val)}
              </span>
              <span className="muted mono" style={{ fontSize: 12, minWidth: 50, textAlign: 'right' }}>
                {cost > 0 ? ((val / cost) * 100).toFixed(1) : '0.0'}%
              </span>
            </div>
            <div className="progress">
              <div className="fill" style={{ width: cost > 0 ? (val / cost) * 100 + '%' : '0%' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
