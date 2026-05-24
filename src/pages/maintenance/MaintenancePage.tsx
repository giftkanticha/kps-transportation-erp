import { db } from '../../lib/db'
import { useList } from '../../hooks/useTable'
import { Icon, StatusBadge } from '../../components/ui'
import type { Maintenance, Vehicle } from '../../types'

export function MaintenancePage() {
  const { data: all = [] } = useList<Maintenance>('maintenance')
  const { data: vehicles = [] } = useList<Vehicle>('vehicles')
  const plateOf = (id: string) => vehicles.find((v) => v.id === id)?.plate ?? '—'
  const inProgress = all.filter((m) => m.status === 'in-progress')
  const scheduled = all.filter((m) => m.status === 'scheduled')
  const thisMontCost = all
    .filter((m) => m.startDate.startsWith('2026-05'))
    .reduce((s, m) => s + (m.cost || 0), 0)

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">การบำรุงรักษา</h1>
          <div className="page-sub">
            {all.length} รายการ • กำลังซ่อม {inProgress.length} • นัดหมาย {scheduled.length}
          </div>
        </div>
        <div className="actions">
          <button className="btn primary">
            <Icon name="plus" size={15} /> สั่งบำรุงรักษา
          </button>
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: 16 }}>
        <div className="card kpi">
          <div className="label">กำลังซ่อม</div>
          <div className="row">
            <div className="icn-box">
              <Icon name="wrench" size={18} />
            </div>
            <div className="value">
              {inProgress.length}
              <span className="unit">งาน</span>
            </div>
          </div>
        </div>
        <div className="card kpi">
          <div className="label">นัดหมายล่วงหน้า</div>
          <div className="row">
            <div className="icn-box amber">
              <Icon name="calendar" size={18} />
            </div>
            <div className="value">
              {scheduled.length}
              <span className="unit">งาน</span>
            </div>
          </div>
        </div>
        <div className="card kpi">
          <div className="label">ค่าใช้จ่ายเดือนนี้</div>
          <div className="row">
            <div className="icn-box red">
              <Icon name="money" size={18} />
            </div>
            <div className="value">{db.thb(thisMontCost)}</div>
          </div>
        </div>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>รหัส</th>
              <th>รถ</th>
              <th>ประเภท</th>
              <th>รายการ</th>
              <th>อู่/ศูนย์</th>
              <th>วันที่</th>
              <th className="right">ค่าใช้จ่าย</th>
              <th>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {all.map((m) => (
              <tr key={m.id}>
                <td className="mono">{m.code}</td>
                <td>
                  <span className="mono badge gray">{plateOf(m.vehicleId)}</span>
                </td>
                <td>{m.type}</td>
                <td className="muted" style={{ fontSize: 12.5 }}>
                  {m.items.join(' • ')}
                </td>
                <td>{m.workshop}</td>
                <td className="num muted">{m.startDate}</td>
                <td className="num right" style={{ fontWeight: 600 }}>
                  {m.cost > 0 ? db.thb(m.cost) : '—'}
                </td>
                <td>
                  <StatusBadge status={m.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
