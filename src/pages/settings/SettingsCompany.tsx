import { useEffect, useState } from 'react'
import { Icon, Field } from '../../components/ui'
import { useList, useUpdate } from '../../hooks/useTable'
import { useAuth } from '../../context/AuthContext'

interface CompanySettings {
  id: number
  name: string
  taxId: string
  phone: string
  email: string
  address: string
}

const EMPTY: CompanySettings = { id: 1, name: '', taxId: '', phone: '', email: '', address: '' }

export function SettingsCompany() {
  const { isAdmin } = useAuth()
  const { data: rows = [], isLoading } = useList<CompanySettings>('company_settings')
  const updateSettings = useUpdate<CompanySettings>('company_settings')

  const row = rows[0] ?? EMPTY
  const [form, setForm] = useState<CompanySettings>(row)
  const [busy, setBusy] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  // Sync the form back to the row whenever the row data refreshes.
  useEffect(() => { setForm(row) }, [row.id, row.name, row.taxId, row.phone, row.email, row.address])

  const set = (k: keyof CompanySettings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    setBusy(true); setSavedAt(null)
    try {
      await updateSettings.mutateAsync({
        id: '1',
        patch: {
          name: form.name.trim(),
          taxId: form.taxId.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          address: form.address.trim(),
        },
      })
      setSavedAt(new Date().toLocaleTimeString('th-TH'))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  const cancel = () => setForm(row)

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">ข้อมูลบริษัท</h1>
          <div className="page-sub">ข้อมูลทั่วไป ที่อยู่ และเอกสารทางบัญชี</div>
        </div>
      </div>
      <div className="card pad" style={{ maxWidth: 720 }}>
        {isLoading ? (
          <div className="muted">กำลังโหลด…</div>
        ) : (
          <>
            <h3 className="section-title">ข้อมูลทั่วไป</h3>
            <div className="grid-2">
              <Field label="ชื่อบริษัท">
                <input value={form.name} onChange={set('name')} disabled={!isAdmin} />
              </Field>
              <Field label="เลขประจำตัวผู้เสียภาษี">
                <input value={form.taxId} onChange={set('taxId')} disabled={!isAdmin} />
              </Field>
              <Field label="เบอร์โทร">
                <input value={form.phone} onChange={set('phone')} disabled={!isAdmin} />
              </Field>
              <Field label="อีเมล">
                <input type="email" value={form.email} onChange={set('email')} disabled={!isAdmin} />
              </Field>
              <Field label="ที่อยู่" full>
                <textarea value={form.address} onChange={set('address')} rows={3} disabled={!isAdmin} />
              </Field>
            </div>
            {!isAdmin && (
              <div className="muted" style={{ fontSize: 12, marginTop: 14 }}>
                เฉพาะผู้ดูแลระบบเท่านั้นที่แก้ไขข้อมูลบริษัทได้
              </div>
            )}
            {isAdmin && (
              <div className="row" style={{ marginTop: 18, justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
                {savedAt && <span className="muted" style={{ fontSize: 12 }}>บันทึกแล้ว · {savedAt}</span>}
                <button className="btn" onClick={cancel} disabled={busy}>ยกเลิก</button>
                <button className="btn primary" onClick={save} disabled={busy}>
                  <Icon name="check" size={15} /> {busy ? 'กำลังบันทึก…' : 'บันทึก'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
