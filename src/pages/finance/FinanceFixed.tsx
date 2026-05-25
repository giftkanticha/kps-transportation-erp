import { db } from '../../lib/db'
import { useList } from '../../hooks/useTable'
import { Icon } from '../../components/ui'
import type { FixedCost, Vehicle } from '../../types'

export function FinanceFixed() {
  const { data: all = [] } = useList<FixedCost>('fixed_costs')
  const { data: vehicles = [] } = useList<Vehicle>('vehicles')
  const total = all.reduce((s, f) => s + f.monthly, 0)

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">ค่าใช้จ่ายคงที่</h1>
          <div className="page-sub">ค่าใช้จ่ายประจำเดือน รวม {db.thb(total)}/เดือน</div>
        </div>
        <div className="actions">
          <button className="btn primary">
            <Icon name="plus" size={15} /> เพิ่มรายการ
          </button>
        </div>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>รายการ</th>
              <th>หมวด</th>
              <th>รถที่เกี่ยวข้อง</th>
              <th className="right">บาท/เดือน</th>
              <th>สถานะเดือนนี้</th>
            </tr>
          </thead>
          <tbody>
            {all.map((f) => (
              <tr key={f.id}>
                <td style={{ fontWeight: 500 }}>{f.name}</td>
                <td>
                  <span className="badge gray">{f.category}</span>
                </td>
                <td>
                  {f.vehicleId ? (
                    <span className="mono badge gray">{vehicles.find(v => v.id === f.vehicleId)?.plate ?? '—'}</span>
                  ) : (
                    <span className="faint">— ทุกคัน —</span>
                  )}
                </td>
                <td className="num right" style={{ fontWeight: 600 }}>
                  {db.thb(f.monthly)}
                </td>
                <td>
                  {f.paid ? (
                    <span className="badge green">จ่ายแล้ว</span>
                  ) : (
                    <span className="badge amber">รอจ่าย</span>
                  )}
                </td>
              </tr>
            ))}
            <tr style={{ background: 'var(--bg-sunk)', fontWeight: 700 }}>
              <td colSpan={3}>รวม</td>
              <td className="num right">{db.thb(total)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
