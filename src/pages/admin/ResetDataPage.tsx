import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Icon } from '../../components/ui'

interface ResetEntry { id: string; details?: string; status: string; created_at: string }

// Every table that holds user-entered data. Auth/log tables (user_profiles,
// user_permissions, acl_audit_log, data_reset_log) are excluded — the reset
// already preserves them, and dumping them on every backup would leak audit
// trail copies into local files.
const BACKUP_TABLES = [
  'vehicles', 'employees', 'customers', 'partners', 'subcontractors', 'sub_drivers',
  'company_settings', 'fixed_costs',
  'dispatch', 'dispatch_legs',
  'expense_headers', 'expense_lines', 'expenses',
  'fuel_records', 'fuel_rounds', 'fuel_stock', 'fuel_transactions',
  'tires', 'tire_events', 'tire_scrap_sales',
  'maintenance',
  'stock_items', 'stock_receipts',
  'activity_logs',
  'vehicle_registrations',
  'sub_jobs',
  'request_approvals', 'edit_approvals',
  'task_completions',
]

const CONFIRM_WORD = 'RESET'

export function ResetDataPage({ setActive }: { setActive: (id: string) => void }) {
  const { profile } = useAuth()
  const [step, setStep]         = useState<1|2|3|4>(1)
  const [opts, setOpts]         = useState({ expenses: false, trips: false, fuel: false, tires: false, stock: false, masters: false, all: false })
  const [confirm, setConfirm]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [backupDone, setBackupDone] = useState<{ filename: string; rows: number } | null>(null)
  const [backupBusy, setBackupBusy] = useState(false)
  const [history, setHistory]   = useState<ResetEntry[]>([])
  const [done, setDone]         = useState<{ expenses: number; trips: number; fuel: number; tires: number; stock: number; masters: number } | null>(null)

  useEffect(() => {
    supabase.from('data_reset_log').select('*').order('created_at', { ascending: false }).limit(10)
      .then(({ data }) => setHistory((data || []) as ResetEntry[]))
  }, [done])

  const toggle = (k: keyof typeof opts) => {
    if (k === 'all') { const n = !opts.all; setOpts({ expenses: n, trips: n, fuel: n, tires: n, stock: n, masters: n, all: n }) }
    else setOpts(o => ({ ...o, [k]: !o[k], all: false }))
  }
  const anySelected = opts.expenses || opts.trips || opts.fuel || opts.tires || opts.stock || opts.masters

  const downloadBackup = async () => {
    setBackupBusy(true)
    try {
      const result: Record<string, unknown> = {
        _meta: {
          exported_at:  new Date().toISOString(),
          exported_by:  profile?.id ?? null,
          exported_by_name: (profile as { display_name?: string } | null)?.display_name ?? null,
          supabase_url: import.meta.env.VITE_SUPABASE_URL,
          note: 'KPS Transportation ERP — full backup before reset',
        },
      }
      let total = 0
      for (const table of BACKUP_TABLES) {
        const { data, error } = await supabase.from(table).select('*')
        if (error) {
          result[table] = { _error: error.message }
        } else {
          result[table] = data ?? []
          total += (data ?? []).length
        }
      }
      (result._meta as Record<string, unknown>).total_rows = total

      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
      const filename = `kps-backup-${stamp}.json`
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setBackupDone({ filename, rows: total })
    } catch (e) {
      alert('ดาวน์โหลดสำรองข้อมูลไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setBackupBusy(false)
    }
  }

  const doReset = async () => {
    if (confirm !== CONFIRM_WORD) return
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('admin_reset_data', {
        p_expenses: opts.expenses,
        p_trips:    opts.trips,
        p_fuel:     opts.fuel,
        p_tires:    opts.tires,
        p_stock:    opts.stock,
        p_masters:  opts.masters,
      })
      if (error) throw new Error(error.message)
      const result = (data ?? { expenses: 0, trips: 0, fuel: 0, tires: 0, stock: 0, masters: 0 }) as {
        expenses: number; trips: number; fuel: number; tires: number; stock: number; masters: number
      }

      // Keep legacy localStorage cache in sync.
      try {
        const raw = JSON.parse(localStorage.getItem('kps_erp_v5') || '{}')
        if (opts.expenses) { raw.expenses = []; raw.vendorExpenses = [] }
        if (opts.trips)    { raw.dispatch = []; raw.fuelRounds = [] }
        if (opts.fuel)     { raw.fuel = []; raw.fuelStock = []; raw.fuelRecords = [] }
        if (opts.tires)    { raw.tires = []; raw.tireEvents = []; raw.tire_events = []; raw.tire_scrap_sales = [] }
        localStorage.setItem('kps_erp_v5', JSON.stringify(raw))
      } catch { /* ignore */ }

      setDone({
        expenses: result.expenses, trips: result.trips, fuel: result.fuel,
        tires: result.tires, stock: result.stock, masters: result.masters,
      })
      setStep(1); setConfirm(''); setBackupDone(null)
      setOpts({ expenses: false, trips: false, fuel: false, tires: false, stock: false, masters: false, all: false })
    } catch (e) {
      const msg = (e as Error).message
      await supabase.from('data_reset_log').insert({
        reset_by: profile!.id, details: `error: ${msg}`, status: 'FAILED',
      })
      alert('เกิดข้อผิดพลาด: ' + msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">รีเซตข้อมูล</h1>
          <div className="page-sub">ลบข้อมูลในระบบ — ดาวน์โหลดสำรองข้อมูลก่อนทุกครั้ง</div>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => setActive('admin.reset.history')}>
            <Icon name="history" size={14} /> ดูประวัติทั้งหมด
          </button>
          <button className="btn" onClick={() => setActive('settings.company')}>
            <Icon name="arrow-left" size={14} /> กลับ
          </button>
        </div>
      </div>

      {done && (
        <div className="card pad" style={{ marginBottom: 18, background: '#f0fdf4', border: '1px solid #86efac' }}>
          <div style={{ fontWeight: 700, color: '#166534', marginBottom: 6 }}>✅ รีเซตข้อมูลสำเร็จ</div>
          <div style={{ fontSize: 13, color: '#166534' }}>
            ลบค่าใช้จ่าย {done.expenses} · ทริป {done.trips} · น้ำมัน {done.fuel} · ยาง {done.tires} · สต็อค {done.stock}
            {done.masters > 0 && ` · ข้อมูลหลัก ${done.masters}`} รายการ
          </div>
          <button className="btn sm" style={{ marginTop: 10 }} onClick={() => setDone(null)}>ปิด</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 18, alignItems: 'start' }}>
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', gap: 0, marginBottom: 24 }}>
            {[1, 2, 3, 4].map(s => (
              <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 14,
                  background: step >= s ? 'var(--primary)' : 'var(--bg-sunk)',
                  color: step >= s ? '#fff' : 'var(--text-muted)',
                }}>{s}</div>
                <div style={{
                  marginLeft: 8, fontSize: 13,
                  fontWeight: step === s ? 600 : 400,
                  color: step === s ? 'var(--text)' : 'var(--text-muted)',
                }}>
                  {s === 1 ? 'เลือกข้อมูล' : s === 2 ? 'ตรวจสอบ' : s === 3 ? 'สำรองข้อมูล' : 'พิมพ์ยืนยัน'}
                </div>
                {s < 4 && <div style={{ flex: 1, height: 2, background: step > s ? 'var(--primary)' : 'var(--line)', margin: '0 16px', minWidth: 32 }} />}
              </div>
            ))}
          </div>

          {step === 1 && (
            <div>
              <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>เลือกข้อมูลที่ต้องการลบ</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 18 }}>ข้อมูลที่เลือกจะถูกลบถาวร</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { k: 'all',      label: 'ทั้งหมด (เริ่มจากศูนย์)', desc: 'ลบทุกอย่าง รวมพนักงาน/รถ/ลูกค้า — เหลือแค่ผู้ใช้ระบบ + ตั้งค่า', danger: true },
                  { k: 'masters',  label: 'ข้อมูลหลัก',              desc: 'พนักงาน, รถ, ลูกค้า, คู่ค้า, รถร่วม + log ทุกอย่าง',     danger: true },
                  { k: 'expenses', label: 'ค่าใช้จ่าย',              desc: 'บันทึกค่าใช้จ่ายทั้งหมด' },
                  { k: 'trips',    label: 'ทริปงานขนส่ง',           desc: 'รายการงานขนส่งและรอบน้ำมัน' },
                  { k: 'fuel',     label: 'ข้อมูลน้ำมัน',            desc: 'บันทึกน้ำมันและสต็อก' },
                  { k: 'tires',    label: 'ประวัติยาง',              desc: 'ข้อมูลยางและประวัติการใช้งาน' },
                  { k: 'stock',    label: 'สต็อคคลัง KPS',           desc: 'รายการสินค้าและประวัติการรับเข้า' },
                ].map(({ k, label, desc, danger }) => (
                  <label key={k} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
                    background: opts[k as keyof typeof opts] ? (danger ? '#fee2e2' : 'var(--primary-50)') : 'var(--bg-sunk)',
                    border: `1px solid ${opts[k as keyof typeof opts] ? (danger ? '#fca5a5' : 'var(--primary-200)') : 'var(--line)'}`,
                  }}>
                    <input type="checkbox" checked={opts[k as keyof typeof opts]} onChange={() => toggle(k as keyof typeof opts)} style={{ width: 16, height: 16, accentColor: danger ? 'var(--red)' : 'var(--primary)' }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: danger && opts[k as keyof typeof opts] ? 'var(--red)' : 'var(--text)' }}>{label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{desc}</div>
                    </div>
                  </label>
                ))}
              </div>
              <div style={{ marginTop: 20 }}>
                <button className="btn primary" style={{ height: 38 }} disabled={!anySelected} onClick={() => setStep(2)}>
                  ถัดไป <Icon name="chevron-right" size={14} />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>ตรวจสอบรายการที่จะลบ</h3>
              <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: 14, marginBottom: 18 }}>
                <div style={{ fontWeight: 700, color: '#c2410c', marginBottom: 8 }}>⚠️ ข้อมูลต่อไปนี้จะถูกลบถาวร:</div>
                <ul style={{ margin: 0, padding: '0 0 0 18px', fontSize: 13, color: '#9a3412', lineHeight: 2 }}>
                  {opts.expenses && <li>ค่าใช้จ่ายทั้งหมด</li>}
                  {opts.trips    && <li>ทริปงานขนส่งทั้งหมด</li>}
                  {opts.fuel     && <li>บันทึกน้ำมันทั้งหมด</li>}
                  {opts.tires    && <li>ประวัติยางทั้งหมด</li>}
                  {opts.stock    && <li>สต็อคคลัง KPS ทั้งหมด</li>}
                  {opts.masters  && <li><strong>พนักงาน · รถ · ลูกค้า · คู่ค้า · รถร่วม + ข้อมูลปฏิบัติงานทั้งหมด</strong> (เริ่มจากศูนย์)</li>}
                </ul>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn" onClick={() => setStep(1)}><Icon name="arrow-left" size={14} /> ย้อนกลับ</button>
                <button className="btn primary" onClick={() => setStep(3)}>ถัดไป — สำรองข้อมูล <Icon name="chevron-right" size={14} /></button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>สำรองข้อมูลก่อนลบ</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 18 }}>
                ระบบจะดาวน์โหลดไฟล์ JSON ที่บรรจุข้อมูลทุกตารางในระบบ — เก็บไฟล์ไว้สำหรับกู้คืน <strong>จำเป็นต้องทำก่อนถึงขั้นต่อไป</strong>
              </p>
              <div style={{
                background: backupDone ? '#f0fdf4' : 'var(--bg-sunk)',
                border: `1px solid ${backupDone ? '#86efac' : 'var(--line)'}`,
                borderRadius: 8, padding: 16, marginBottom: 18,
              }}>
                {backupDone ? (
                  <>
                    <div style={{ fontWeight: 700, color: '#166534', fontSize: 13, marginBottom: 6 }}>
                      ✅ ดาวน์โหลดสำเร็จ
                    </div>
                    <div style={{ fontSize: 12.5, color: '#166534' }}>
                      ไฟล์: <span className="mono">{backupDone.filename}</span> · ทั้งหมด {backupDone.rows.toLocaleString('th-TH')} แถว
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 8 }}>
                      กดดาวน์โหลดอีกครั้งเพื่อรับไฟล์ใหม่ (timestamped)
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--text)' }}>
                    ยังไม่ได้ดาวน์โหลด — กดปุ่มด้านล่างเพื่อสร้างและบันทึกไฟล์สำรอง
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button className="btn" onClick={() => setStep(2)}><Icon name="arrow-left" size={14} /> ย้อนกลับ</button>
                <button
                  className="btn"
                  style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
                  onClick={downloadBackup}
                  disabled={backupBusy}
                >
                  <Icon name="download" size={14} /> {backupBusy ? 'กำลังสร้างไฟล์…' : (backupDone ? 'ดาวน์โหลดอีกครั้ง' : 'ดาวน์โหลดสำรองข้อมูล')}
                </button>
                <button
                  className="btn primary"
                  disabled={!backupDone}
                  onClick={() => setStep(4)}
                >
                  ดำเนินการต่อ <Icon name="chevron-right" size={14} />
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>ยืนยันขั้นสุดท้าย</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 18 }}>
                พิมพ์คำว่า <strong style={{ color: 'var(--red)' }}>{CONFIRM_WORD}</strong> ตัวพิมพ์ใหญ่ เพื่อยืนยัน
              </p>
              <input
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder={`พิมพ์ ${CONFIRM_WORD}`}
                autoFocus
                style={{
                  width: '100%', height: 42, padding: '0 14px',
                  border: `2px solid ${confirm === CONFIRM_WORD ? '#16a34a' : confirm ? 'var(--red)' : 'var(--line)'}`,
                  borderRadius: 8, fontSize: 16, letterSpacing: '.1em', fontWeight: 700, background: 'var(--bg)', marginBottom: 16,
                }}
              />
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn" onClick={() => setStep(3)}><Icon name="arrow-left" size={14} /> ย้อนกลับ</button>
                <button
                  disabled={confirm !== CONFIRM_WORD || loading}
                  onClick={doReset}
                  style={{
                    height: 38, padding: '0 20px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', border: 'none',
                    background: confirm === CONFIRM_WORD ? 'var(--red)' : 'var(--bg-sunk)',
                    color: confirm === CONFIRM_WORD ? '#fff' : 'var(--text-muted)',
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  {loading ? 'กำลังลบ…' : '🗑️ ลบข้อมูล'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>ประวัติล่าสุด</h3>
            <button className="btn sm ghost" onClick={() => setActive('admin.reset.history')}>ดูทั้งหมด →</button>
          </div>
          {history.length === 0
            ? <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>ยังไม่มีประวัติ</div>
            : <div style={{ padding: '8px 16px' }}>
                {history.map(h => (
                  <div key={h.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{new Date(h.created_at).toLocaleString('th-TH')}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{h.details || '—'}</div>
                    <div style={{ fontSize: 11, color: h.status === 'COMPLETED' ? 'var(--green)' : 'var(--red)', marginTop: 2 }}>{h.status}</div>
                  </div>
                ))}
              </div>
          }
        </div>
      </div>
    </div>
  )
}
