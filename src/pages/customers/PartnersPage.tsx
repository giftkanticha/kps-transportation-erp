import { db } from '../../lib/db'
import { useList } from '../../hooks/useTable'
import { StatusBadge } from '../../components/ui'
import type { Partner } from '../../types'

export function PartnersPage() {
  const { data: partners = [] } = useList<Partner>('partners')
  const totalBalance = partners.reduce((s, p) => s + p.balance, 0)

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">คู่ค้า / ช่าง</h1>
          <div className="page-sub">
            {partners.length} ราย • ยอดค้างจ่ายรวม {db.thb(totalBalance)}
          </div>
        </div>
        {/* Add/edit partners in ค่าใช้จ่าย → ทะเบียนร้านค้า/ช่าง (full CRUD).
            This page is a read-only receivables summary. */}
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>รหัส</th>
              <th>ชื่อ</th>
              <th>ประเภท</th>
              <th>ผู้ติดต่อ</th>
              <th>โทร</th>
              <th className="right">ยอดค้างจ่าย</th>
              <th>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {partners.map((p) => (
              <tr key={p.id}>
                <td className="mono">{p.code}</td>
                <td style={{ fontWeight: 500 }}>{p.name}</td>
                <td>
                  <span className="badge gray">{p.type}</span>
                </td>
                <td>{p.contact}</td>
                <td className="mono muted">{p.phone}</td>
                <td
                  className="num right"
                  style={{ fontWeight: 600, color: p.balance > 0 ? 'var(--red)' : 'var(--text-muted)' }}
                >
                  {db.thb(p.balance)}
                </td>
                <td>
                  <StatusBadge status={p.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
