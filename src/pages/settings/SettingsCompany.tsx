import { Icon, Field } from '../../components/ui'

export function SettingsCompany() {
  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">ข้อมูลบริษัท</h1>
          <div className="page-sub">ข้อมูลทั่วไป ที่อยู่ และเอกสารทางบัญชี</div>
        </div>
      </div>
      <div className="card pad" style={{ maxWidth: 720 }}>
        <h3 className="section-title">ข้อมูลทั่วไป</h3>
        <div className="grid-2">
          <Field label="ชื่อบริษัท">
            <input defaultValue="บริษัท เคพีเอส ทรานสปอร์เตชั่น จำกัด" />
          </Field>
          <Field label="เลขประจำตัวผู้เสียภาษี">
            <input defaultValue="0105556012345" />
          </Field>
          <Field label="เบอร์โทร">
            <input defaultValue="02-XXX-XXXX" />
          </Field>
          <Field label="อีเมล">
            <input defaultValue="contact@kps.com" />
          </Field>
          <Field label="ที่อยู่" full>
            <textarea
              defaultValue="123/45 ถนนบางนา-ตราด แขวงบางนาเหนือ เขตบางนา กรุงเทพมหานคร 10260"
              rows={3}
            />
          </Field>
        </div>
        <div className="row" style={{ marginTop: 18, justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn">ยกเลิก</button>
          <button className="btn primary">
            <Icon name="check" size={15} /> บันทึก
          </button>
        </div>
      </div>
    </div>
  )
}
