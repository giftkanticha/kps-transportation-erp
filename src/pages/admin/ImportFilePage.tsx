import { useMemo, useState } from 'react'
import { useList } from '../../hooks/useTable'
import { insertOne } from '../../lib/crud'
import { Icon } from '../../components/ui'
import type { Subcontractor, SubDriver } from '../../types'
import { SUBCONTRACTOR_IMPORTS, SUB_DRIVER_IMPORTS } from '../../data/subDriversImport'

interface ImportResult {
  subcontractorsCreated: number
  driversCreated: number
  skippedSubs: string[]
  skippedDrivers: string[]
  errors: string[]
}

type ImportTab = 'sub-drivers' | 'tires'

const TABS: { id: ImportTab; label: string; available: boolean }[] = [
  { id: 'sub-drivers', label: 'รถร่วม / คนขับ',  available: true },
  { id: 'tires',       label: 'ยาง',             available: false },
]

export function ImportFilePage({ setActive }: { setActive: (id: string) => void }) {
  const [tab, setTab] = useState<ImportTab>('sub-drivers')

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">Import File</h1>
          <div className="page-sub">
            เครื่องมือ import ข้อมูลแบบครั้งเดียว สำหรับ admin
            — ตอนนี้รองรับ <strong>รถร่วม</strong> เพิ่มประเภทอื่นได้ตามต้องการ
          </div>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => setActive('dashboard')}>
            <Icon name="close" size={14} /> กลับ
          </button>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 18 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => t.available && setTab(t.id)}
            style={!t.available ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
            title={t.available ? '' : 'ยังไม่มีข้อมูลให้ import — ส่ง Excel มาเพื่อเพิ่ม'}
          >
            {t.label}{!t.available && ' (เร็วๆ นี้)'}
          </button>
        ))}
      </div>

      {tab === 'sub-drivers' && <SubDriversImportTab />}
      {tab === 'tires' && (
        <div className="card pad" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <Icon name="package" size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>ยังไม่มีข้อมูลยางสำหรับ import</div>
          <div style={{ fontSize: 12.5 }}>
            ส่งไฟล์ Excel ของระบบยางมาในแชท จะเพิ่มเป็นแท็บนี้ให้
          </div>
        </div>
      )}
    </div>
  )
}

function SubDriversImportTab() {
  const { data: existingSubs = [] } = useList<Subcontractor>('subcontractors')
  const { data: existingDrivers = [] } = useList<SubDriver>('sub_drivers')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const subByName  = useMemo(() => new Map(existingSubs.map(s => [s.name.trim(), s])), [existingSubs])
  const driverByPlate = useMemo(() => new Map(existingDrivers.map(d => [d.plate.trim(), d])), [existingDrivers])

  const previewSubs = SUBCONTRACTOR_IMPORTS.map(s => ({
    ...s,
    exists: subByName.has(s.name.trim()),
  }))
  const previewDrivers = SUB_DRIVER_IMPORTS.map(d => ({
    ...d,
    exists: driverByPlate.has(d.plate.trim()),
  }))

  const newSubsCount    = previewSubs.filter(s => !s.exists).length
  const newDriversCount = previewDrivers.filter(d => !d.exists).length

  const runImport = async () => {
    if (running) return
    if (!confirm(`จะเพิ่ม ${newSubsCount} กลุ่มขนส่ง และ ${newDriversCount} คนขับเข้าสู่ฐานข้อมูล (Supabase)\n\nรายการที่มีอยู่แล้วจะถูกข้าม\n\nดำเนินการต่อ?`)) return
    setRunning(true)
    const out: ImportResult = {
      subcontractorsCreated: 0,
      driversCreated: 0,
      skippedSubs: [],
      skippedDrivers: [],
      errors: [],
    }

    // Resolve sub id by name — start from existing then add the freshly inserted.
    const resolveSubId: Record<string, string> = {}
    for (const s of existingSubs) resolveSubId[s.name.trim()] = s.id

    // 1) Subcontractors
    let nextCounter = SUBCONTRACTOR_IMPORTS.length
    for (const s of SUBCONTRACTOR_IMPORTS) {
      const key = s.name.trim()
      if (resolveSubId[key]) { out.skippedSubs.push(s.name); continue }
      try {
        // Make sure code is unique even if the seed code already taken.
        let code = s.code
        if (existingSubs.some(x => x.code === code)) {
          code = `SUB-IMP-${String(++nextCounter).padStart(3, '0')}`
        }
        const created = await insertOne<Subcontractor>('subcontractors', {
          code,
          name: s.name,
          contact: '',
          phone: '',
          vehicles: 0,
          rating: 0,
          openJobs: 0,
          totalPaid: 0,
          status: 'active',
        })
        resolveSubId[key] = created.id
        out.subcontractorsCreated += 1
      } catch (err) {
        out.errors.push(`subcontractor "${s.name}": ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    // 2) Drivers — code is per-row, plate is dedup key.
    const usedCodes = new Set(existingDrivers.map(d => d.code))
    let driverCounter = existingDrivers.reduce((max, d) => {
      const n = parseInt(d.code.replace(/\D/g, ''), 10)
      return isNaN(n) ? max : Math.max(max, n)
    }, 0)

    for (const d of SUB_DRIVER_IMPORTS) {
      if (driverByPlate.has(d.plate.trim())) { out.skippedDrivers.push(d.plate); continue }
      const subId = resolveSubId[d.group.trim()] ?? ''
      let code = 'D' + String(++driverCounter).padStart(3, '0')
      while (usedCodes.has(code)) code = 'D' + String(++driverCounter).padStart(3, '0')
      usedCodes.add(code)
      try {
        await insertOne<SubDriver>('sub_drivers', {
          code,
          name: d.name || '-',
          plate: d.plate,
          phone: d.phone || '',
          idCard: d.idCard || '',
          license: d.license || '',
          licenseExpire: '',
          licenseStatus: 'ok',
          accountBank: d.bank || '',
          accountNo: d.accountNo || '',
          status: 'active',
          subId,
          truckDump: d.truckDump,
          cpAccess: d.cpAccess,
          province: d.province,
          followerName: d.followerName,
          followerIdCard: d.followerIdCard,
          accountName: d.accountName,
          vehicleOwner: d.vehicleOwner,
        })
        out.driversCreated += 1
      } catch (err) {
        out.errors.push(`driver ${d.plate}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    setResult(out)
    setRunning(false)
  }

  const cellStyle: React.CSSProperties = { padding: '4px 8px', fontSize: 12, borderBottom: '1px solid var(--line)' }

  return (
    <div>
      <div
        className="card pad"
        style={{ marginBottom: 16, background: '#FFFBEB', borderColor: '#FDE68A' }}
      >
        <div style={{ fontSize: 13, color: '#92400E' }}>
          <strong>รถร่วม / คนขับ</strong> — นำเข้าจาก Excel 26 รายการ + 11 กลุ่มขนส่ง
          <br/>
          ⚠ ก่อนใช้งาน ต้อง apply migration <code>0031_sub_drivers_extra_fields.sql</code> บน Supabase ก่อน
          (เพิ่มคอลัมน์ province, follower_name, follower_id_card, account_name, vehicle_owner)
        </div>
      </div>

      <div className="card pad" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>กลุ่มขนส่ง (ใหม่)</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)' }}>{newSubsCount}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              (มีอยู่แล้ว {previewSubs.length - newSubsCount} กลุ่ม)
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>คนขับ (ใหม่)</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)' }}>{newDriversCount}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              (มีอยู่แล้ว {previewDrivers.length - newDriversCount} คัน)
            </div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <button
              className="btn primary"
              onClick={runImport}
              disabled={running || (newSubsCount === 0 && newDriversCount === 0)}
            >
              <Icon name="download" size={14} /> {running ? 'กำลัง Import…' : 'Import ทั้งหมด'}
            </button>
          </div>
        </div>
      </div>

      {result && (
        <div className="card pad" style={{ marginBottom: 16, background: '#F0FDF4', borderColor: '#86EFAC' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 15, color: '#166534' }}>
            ✓ Import เสร็จ — สร้างกลุ่ม {result.subcontractorsCreated} · คนขับ {result.driversCreated} รายการ
          </h3>
          {result.skippedSubs.length > 0 && (
            <div style={{ fontSize: 12, color: '#475569' }}>
              ข้ามกลุ่มที่มีอยู่: {result.skippedSubs.join(', ')}
            </div>
          )}
          {result.skippedDrivers.length > 0 && (
            <div style={{ fontSize: 12, color: '#475569' }}>
              ข้ามคนขับที่มีอยู่ (ทะเบียนซ้ำ): {result.skippedDrivers.join(', ')}
            </div>
          )}
          {result.errors.length > 0 && (
            <div style={{ fontSize: 12, color: '#B91C1C', marginTop: 6 }}>
              <strong>Errors:</strong>
              <ul style={{ margin: '4px 0 0 16px' }}>
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="head"><h3 style={{ margin: 0 }}>กลุ่มขนส่งที่จะสร้าง</h3></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>Code</th><th>ชื่อกลุ่ม</th><th>สถานะ</th></tr></thead>
            <tbody>
              {previewSubs.map(s => (
                <tr key={s.code} style={{ opacity: s.exists ? 0.5 : 1 }}>
                  <td style={cellStyle} className="mono">{s.code}</td>
                  <td style={cellStyle}>{s.name}</td>
                  <td style={cellStyle}>
                    {s.exists
                      ? <span className="badge gray">มีอยู่แล้ว — ข้าม</span>
                      : <span className="badge blue">จะสร้างใหม่</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="head"><h3 style={{ margin: 0 }}>คนขับ / รถ ที่จะนำเข้า</h3></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>ทะเบียน</th><th>กลุ่ม</th><th>จังหวัด</th><th>ชื่อ-นามสกุล</th>
                <th>เบอร์</th><th>ดั้ม</th><th>CP</th><th>ธนาคาร</th><th>เลขบัญชี</th>
                <th>ชื่อบัญชี</th><th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {previewDrivers.map(d => (
                <tr key={d.plate} style={{ opacity: d.exists ? 0.5 : 1 }}>
                  <td style={cellStyle} className="mono">{d.plate}</td>
                  <td style={cellStyle}>{d.group}</td>
                  <td style={cellStyle}>{d.province}</td>
                  <td style={cellStyle}>{d.name || '—'}</td>
                  <td style={cellStyle}>{d.phone || '—'}</td>
                  <td style={cellStyle}>{d.truckDump === 'dump' ? 'ดั้ม' : '-'}</td>
                  <td style={cellStyle}>{d.cpAccess === 'yes' ? 'ได้' : '-'}</td>
                  <td style={cellStyle}>{d.bank || '—'}</td>
                  <td style={cellStyle} className="mono">{d.accountNo || '—'}</td>
                  <td style={cellStyle}>{d.accountName || '—'}</td>
                  <td style={cellStyle}>
                    {d.exists
                      ? <span className="badge gray">มีอยู่แล้ว — ข้าม</span>
                      : <span className="badge blue">จะสร้างใหม่</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
