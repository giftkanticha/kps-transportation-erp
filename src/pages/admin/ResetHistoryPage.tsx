import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { ACTIVE_BACKEND } from '../../lib/backends'
import { api } from '../../lib/backends/mysql/api'
import { loadAclUsers } from '../../lib/aclUsers'
import { Icon } from '../../components/ui'

interface ResetEntry {
  id: string
  reset_by: string | null
  details: string | null
  status: string
  created_at: string
}

interface ActorMap { [id: string]: string }

export function ResetHistoryPage({ setActive }: { setActive: (id: string) => void }) {
  const [rows,   setRows]   = useState<ResetEntry[]>([])
  const [actors, setActors] = useState<ActorMap>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      if (ACTIVE_BACKEND === 'mysql') {
        const data = await api<Array<{ id: string; resetBy: string | null; details: string | null; status: string; createdAt: string }>>('/api/reset/history')
        const list: ResetEntry[] = (data ?? []).map(r => ({
          id: r.id, reset_by: r.resetBy, details: r.details, status: r.status, created_at: r.createdAt,
        }))
        setRows(list)
        const ids = new Set(list.map(r => r.reset_by).filter((x): x is string => !!x))
        if (ids.size) {
          const users = await loadAclUsers()
          const map: ActorMap = {}
          for (const u of users) if (ids.has(u.id)) map[u.id] = u.display_name ?? '—'
          setActors(map)
        }
        setLoading(false)
        return
      }
      const { data } = await supabase
        .from('data_reset_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)
      const list = (data ?? []) as ResetEntry[]
      setRows(list)
      const ids = [...new Set(list.map(r => r.reset_by).filter((x): x is string => !!x))]
      if (ids.length) {
        const { data: profs } = await supabase.from('user_profiles').select('id,display_name').in('id', ids)
        const map: ActorMap = {}
        for (const p of profs ?? []) map[(p as { id: string }).id] = (p as { display_name?: string }).display_name ?? '—'
        setActors(map)
      }
      setLoading(false)
    })()
  }, [])

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">ประวัติการรีเซตข้อมูล</h1>
          <div className="page-sub">บันทึกทุกครั้งที่มีการรีเซตข้อมูล — ดูเท่านั้น ลบไม่ได้</div>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => setActive('settings.company')}>
            <Icon name="arrow-left" size={14} /> กลับไปตั้งค่า
          </button>
        </div>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 200 }}>วันที่/เวลา</th>
              <th>ผู้กด</th>
              <th>ขอบเขต / จำนวนที่ลบ</th>
              <th style={{ width: 120 }}>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center' }}>กำลังโหลด…</td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={4} style={{ padding: 36, textAlign: 'center', color: 'var(--text-2)' }}>
                ยังไม่มีประวัติการรีเซต
              </td></tr>
            )}
            {rows.map(r => (
              <tr key={r.id}>
                <td className="mono" style={{ fontSize: 12.5 }}>
                  {new Date(r.created_at).toLocaleString('th-TH', {
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', second: '2-digit',
                  })}
                </td>
                <td>{r.reset_by ? (actors[r.reset_by] ?? r.reset_by.slice(0, 8)) : '—'}</td>
                <td className="muted" style={{ fontSize: 12.5 }}>{r.details ?? '—'}</td>
                <td>
                  <span
                    className="badge"
                    style={{
                      background: r.status === 'COMPLETED' ? '#dcfce7' : '#fee2e2',
                      color:      r.status === 'COMPLETED' ? '#166534' : '#991b1b',
                    }}
                  >
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
