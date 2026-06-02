import { useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { useList } from '../../hooks/useTable'
import { insertOne } from '../../lib/crud'
import { Icon } from '../../components/ui'
import type { Subcontractor, SubDriver } from '../../types'
import {
  SUBCONTRACTOR_IMPORTS,
  SUB_DRIVER_IMPORTS,
  type SubDriverImportRow,
} from '../../data/subDriversImport'

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
            อัปโหลดไฟล์ Excel เพื่อ import ข้อมูลเข้าฐาน Supabase (สำหรับ admin)
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
            title={t.available ? '' : 'ยังไม่มี mapping สำหรับ Excel ประเภทนี้ — แจ้งทีมเพื่อเพิ่ม'}
          >
            {t.label}{!t.available && ' (เร็วๆ นี้)'}
          </button>
        ))}
      </div>

      {tab === 'sub-drivers' && <SubDriversImportTab />}
      {tab === 'tires' && (
        <div className="card pad" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <Icon name="package" size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>ยังไม่มี mapping สำหรับไฟล์ยาง</div>
          <div style={{ fontSize: 12.5 }}>
            ส่งตัวอย่าง Excel ของระบบยางมาในแชท ทีมจะ map คอลัมน์ + เปิดแท็บนี้ให้
          </div>
        </div>
      )}
    </div>
  )
}

// ─── รถร่วม import tab ────────────────────────────────────────────────────────

/** Header names accepted in the uploaded Excel (matches the sheet you sent). */
const EXCEL_HEADERS = {
  plate:          ['ทะเบียน'],
  province:       ['จังหวัด'],
  group:          ['กลุ่มขนส่ง', 'กลุ่ม', 'ขนส่ง'],
  cp:             ['CP'],
  dump:           ['ดั้ม/ไม่ดั้ม', 'ดั้ม'],
  firstName:      ['ชื่อ'],
  lastName:       ['นามสุกล', 'นามสกุล'],
  idCard:         ['เลขบัตรประชาชน', 'บัตรประชาชน'],
  phone:          ['เบอร์', 'เบอร์โทร', 'โทร'],
  followerName:   ['ผู้ติดตาม'],
  followerIdCard: ['เลขบัตรผู้ติดตาม', 'บัตรผู้ติดตาม'],
  bank:           ['ธนาคาร'],
  accountNo:      ['เลขบัญชี', 'เลขที่บัญชี'],
  accountName:    ['ชื่อบัญชี'],
  owner:          ['เจ้าของ'],
  license:        ['เลขใบขับขี่', 'ใบขับขี่'],
}

/** Lookup the column index for a logical field given the header row. */
function findCol(headers: string[], names: string[]): number {
  for (const n of names) {
    const idx = headers.findIndex(h => (h ?? '').trim() === n)
    if (idx >= 0) return idx
  }
  return -1
}

function cleanCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  let s = typeof v === 'number' ? String(v) : String(v)
  s = s.trim()
  if (s === '-' || s === '–' || s.toLowerCase() === 'null') return ''
  return s
}

function parseExcelToRows(buf: ArrayBuffer): { rows: SubDriverImportRow[]; warnings: string[] } {
  const wb = XLSX.read(buf, { type: 'array' })
  // Prefer "รถร่วม" sheet, else fall back to the first.
  const sheetName = wb.SheetNames.find(n => n.includes('รถร่วม')) ?? wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, raw: true })
  if (matrix.length < 2) return { rows: [], warnings: ['ไฟล์ไม่มีข้อมูล'] }

  const headers = (matrix[0] as unknown[]).map(h => (h ?? '').toString())
  const cols = {
    plate:          findCol(headers, EXCEL_HEADERS.plate),
    province:       findCol(headers, EXCEL_HEADERS.province),
    group:          findCol(headers, EXCEL_HEADERS.group),
    cp:             findCol(headers, EXCEL_HEADERS.cp),
    dump:           findCol(headers, EXCEL_HEADERS.dump),
    firstName:      findCol(headers, EXCEL_HEADERS.firstName),
    lastName:       findCol(headers, EXCEL_HEADERS.lastName),
    idCard:         findCol(headers, EXCEL_HEADERS.idCard),
    phone:          findCol(headers, EXCEL_HEADERS.phone),
    followerName:   findCol(headers, EXCEL_HEADERS.followerName),
    followerIdCard: findCol(headers, EXCEL_HEADERS.followerIdCard),
    bank:           findCol(headers, EXCEL_HEADERS.bank),
    accountNo:      findCol(headers, EXCEL_HEADERS.accountNo),
    accountName:    findCol(headers, EXCEL_HEADERS.accountName),
    owner:          findCol(headers, EXCEL_HEADERS.owner),
    license:        findCol(headers, EXCEL_HEADERS.license),
  }
  const warnings: string[] = []
  if (cols.plate < 0) warnings.push('ไม่พบคอลัมน์ "ทะเบียน"')
  if (cols.group < 0) warnings.push('ไม่พบคอลัมน์ "กลุ่มขนส่ง"')

  const rows: SubDriverImportRow[] = []
  for (let i = 1; i < matrix.length; i++) {
    const r = matrix[i] as unknown[]
    const plate = cleanCell(r[cols.plate])
    if (!plate) continue
    const first = cleanCell(r[cols.firstName])
    const last  = cleanCell(r[cols.lastName])
    const name  = [first, last].filter(Boolean).join(' ').trim()
    const cpRaw = r[cols.cp]
    const dumpRaw = cleanCell(r[cols.dump])
    rows.push({
      plate,
      province:       cleanCell(r[cols.province]),
      group:          cleanCell(r[cols.group]),
      name,
      phone:          cleanCell(r[cols.phone]),
      idCard:         cleanCell(r[cols.idCard]),
      license:        cleanCell(r[cols.license]),
      bank:           cleanCell(r[cols.bank]),
      accountNo:      cleanCell(r[cols.accountNo]),
      accountName:    cleanCell(r[cols.accountName]),
      truckDump:      dumpRaw.includes('ดั้ม') && !dumpRaw.includes('ไม่') ? 'dump' : 'no-dump',
      cpAccess:       cpRaw === true || cleanCell(cpRaw).toLowerCase() === 'true' || cleanCell(cpRaw) === 'ได้' ? 'yes' : 'no',
      followerName:   cleanCell(r[cols.followerName]) || undefined,
      followerIdCard: cleanCell(r[cols.followerIdCard]) || undefined,
      vehicleOwner:   cleanCell(r[cols.owner]) || undefined,
    })
  }
  return { rows, warnings }
}

function SubDriversImportTab() {
  const { data: existingSubs = [] } = useList<Subcontractor>('subcontractors')
  const { data: existingDrivers = [] } = useList<SubDriver>('sub_drivers')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [uploaded, setUploaded] = useState<{ name: string; rows: SubDriverImportRow[]; warnings: string[] } | null>(null)
  const [parseError, setParseError] = useState<string>('')

  // If a file is uploaded, use its rows; otherwise fall back to the seed file.
  const rows = uploaded?.rows ?? SUB_DRIVER_IMPORTS
  const subs = useMemo(() => {
    if (uploaded) {
      // Derive subcontractor list from unique group names in the uploaded file.
      const seen = new Set<string>()
      const list: { code: string; name: string }[] = []
      let counter = 0
      for (const r of rows) {
        const name = (r.group || '').trim()
        if (!name || seen.has(name)) continue
        seen.add(name)
        counter += 1
        list.push({ code: `SUB-IMP-${String(counter).padStart(3, '0')}`, name })
      }
      return list
    }
    return SUBCONTRACTOR_IMPORTS
  }, [uploaded, rows])

  const subByName    = useMemo(() => new Map(existingSubs.map(s => [s.name.trim(), s])), [existingSubs])
  const driverByPlate = useMemo(() => new Map(existingDrivers.map(d => [d.plate.trim(), d])), [existingDrivers])

  const previewSubs    = subs.map(s => ({ ...s, exists: subByName.has(s.name.trim()) }))
  const previewDrivers = rows.map(d => ({ ...d, exists: driverByPlate.has(d.plate.trim()) }))
  const newSubsCount    = previewSubs.filter(s => !s.exists).length
  const newDriversCount = previewDrivers.filter(d => !d.exists).length

  const onPickFile = async (file: File) => {
    setParseError('')
    setResult(null)
    try {
      const buf = await file.arrayBuffer()
      const { rows: parsed, warnings } = parseExcelToRows(buf)
      if (parsed.length === 0) {
        setParseError('ไฟล์นี้ไม่มีข้อมูลที่อ่านได้ ' + (warnings[0] ?? ''))
        return
      }
      setUploaded({ name: file.name, rows: parsed, warnings })
    } catch (err) {
      setParseError('อ่านไฟล์ไม่สำเร็จ: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  const clearUploaded = () => {
    setUploaded(null)
    setParseError('')
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

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
    const resolveSubId: Record<string, string> = {}
    for (const s of existingSubs) resolveSubId[s.name.trim()] = s.id

    let nextSubCounter = subs.length
    for (const s of subs) {
      const key = s.name.trim()
      if (resolveSubId[key]) { out.skippedSubs.push(s.name); continue }
      try {
        let code = s.code
        if (existingSubs.some(x => x.code === code)) {
          code = `SUB-IMP-${String(++nextSubCounter).padStart(3, '0')}`
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

    const usedCodes = new Set(existingDrivers.map(d => d.code))
    let driverCounter = existingDrivers.reduce((max, d) => {
      const n = parseInt(d.code.replace(/\D/g, ''), 10)
      return isNaN(n) ? max : Math.max(max, n)
    }, 0)

    for (const d of rows) {
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
      {/* ── File uploader ───────────────────────────────────────── */}
      <div className="card pad" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              เลือกไฟล์ Excel
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              ต้องมีคอลัมน์: ทะเบียน, กลุ่มขนส่ง, จังหวัด, ชื่อ, นามสกุล, เบอร์, เลขบัตรประชาชน, ดั้ม/ไม่ดั้ม, CP, ธนาคาร, เลขบัญชี, ชื่อบัญชี, ผู้ติดตาม, เลขบัตรผู้ติดตาม, เจ้าของ, เลขใบขับขี่
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) onPickFile(f)
            }}
            style={{ fontSize: 13 }}
          />
          {uploaded && (
            <button className="btn sm" onClick={clearUploaded}>
              <Icon name="close" size={13} /> ล้าง (ใช้ข้อมูล default)
            </button>
          )}
        </div>

        {uploaded && (
          <div style={{ marginTop: 12, padding: '8px 12px', background: '#EFF6FF', borderRadius: 6, fontSize: 12.5 }}>
            <Icon name="check" size={13} /> โหลด <strong>{uploaded.name}</strong> ({uploaded.rows.length} แถว · {subs.length} กลุ่ม)
            {uploaded.warnings.length > 0 && (
              <div style={{ color: '#92400E', marginTop: 4 }}>
                ⚠ {uploaded.warnings.join(' · ')}
              </div>
            )}
          </div>
        )}
        {!uploaded && (
          <div style={{ marginTop: 12, padding: '8px 12px', background: '#F1F5F9', borderRadius: 6, fontSize: 12 }}>
            ยังไม่ได้เลือกไฟล์ — จะใช้ข้อมูล default ที่ฝังไว้ในโค้ด (26 รายการจาก Excel ครั้งก่อน)
          </div>
        )}
        {parseError && (
          <div style={{ marginTop: 12, padding: '8px 12px', background: '#FEF2F2', color: '#B91C1C', borderRadius: 6, fontSize: 12.5 }}>
            ✗ {parseError}
          </div>
        )}
      </div>

      <div className="card pad" style={{ marginBottom: 16, background: '#FFFBEB', borderColor: '#FDE68A' }}>
        <div style={{ fontSize: 12.5, color: '#92400E' }}>
          ⚠ ก่อน import ครั้งแรก ต้อง apply migration <code>0031_sub_drivers_extra_fields.sql</code> บน Supabase
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
