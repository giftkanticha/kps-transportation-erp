// pages-biz.jsx — Customers, Partners, Subcontractors, Maintenance, Expenses, Finance, Settings, Driver view
const { useState: useStateBiz } = React;

// ============== CUSTOMERS ==============
function CustomersPage() {
  const D = window.KPSData;
  const [q, setQ] = useStateBiz("");
  const [show, setShow] = useStateBiz(false);
  const [form, setForm] = useStateBiz({ name: "", contact: "", phone: "", credit: 30, industry: "", address: "" });
  const customers = D.getAll("customers");
  const list = customers.filter(c => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.code.includes(q));
  const save = () => {
    if (!form.name) { alert("กรุณากรอกชื่อลูกค้า"); return; }
    D.add("customers", { ...form, code: "CUS-" + (1000 + customers.length + 1), totalJobs: 0, openInvoice: 0, status: "active", since: new Date().toISOString().slice(0,10), credit: +form.credit });
    setShow(false); setForm({ name: "", contact: "", phone: "", credit: 30, industry: "", address: "" });
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">ลูกค้า</h1>
          <div className="page-sub">{customers.length} ราย • ลูกหนี้คงค้างรวม {D.thb(customers.reduce((s,c) => s + c.openInvoice, 0))}</div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={() => setShow(true)}><Icon name="plus" size={15}/> เพิ่มลูกค้าใหม่</button>
        </div>
      </div>

      <div className="toolbar">
        <div style={{ position: "relative" }}>
          <Icon name="search" size={15} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)" }}/>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาลูกค้า..." style={{ height: 36, padding: "0 12px 0 34px", width: 280, border: "1px solid var(--line)", borderRadius: 8, background: "#fff", fontSize: 13 }}/>
        </div>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>รหัส</th><th>ลูกค้า</th><th>ผู้ติดต่อ</th><th>อุตสาหกรรม</th><th>เครดิต</th><th className="right">งานทั้งหมด</th><th className="right">ลูกหนี้คงค้าง</th><th>สถานะ</th></tr></thead>
          <tbody>
            {list.map(c => (
              <tr key={c.id}>
                <td className="mono">{c.code}</td>
                <td>
                  <div style={{ fontWeight: 500 }}>{c.name}</div>
                  <div className="muted" style={{ fontSize: 11.5 }}>{c.address}</div>
                </td>
                <td>
                  <div>{c.contact}</div>
                  <div className="muted mono" style={{ fontSize: 11.5 }}>{c.phone}</div>
                </td>
                <td>{c.industry}</td>
                <td className="num">{c.credit} วัน</td>
                <td className="num right">{c.totalJobs}</td>
                <td className="num right" style={{ color: c.openInvoice > 500000 ? "var(--red)" : c.openInvoice > 0 ? "var(--amber)" : "var(--text-muted)", fontWeight: c.openInvoice > 0 ? 600 : 400 }}>{D.thb(c.openInvoice)}</td>
                <td><StatusBadge status={c.status}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={show} onClose={() => setShow(false)} title="เพิ่มลูกค้าใหม่" footer={<>
        <button className="btn" onClick={() => setShow(false)}>ยกเลิก</button>
        <button className="btn primary" onClick={save}>บันทึก</button>
      </>}>
        <div className="grid-2">
          <Field label="ชื่อลูกค้า / บริษัท *"><input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}/></Field>
          <Field label="ผู้ติดต่อ"><input value={form.contact} onChange={e => setForm(f => ({...f, contact: e.target.value}))}/></Field>
          <Field label="เบอร์โทร"><input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))}/></Field>
          <Field label="เครดิตเทอม (วัน)"><input type="number" value={form.credit} onChange={e => setForm(f => ({...f, credit: e.target.value}))}/></Field>
          <Field label="อุตสาหกรรม"><input value={form.industry} onChange={e => setForm(f => ({...f, industry: e.target.value}))} placeholder="เช่น Manufacturing"/></Field>
          <Field label="ที่อยู่ / เมือง"><input value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))}/></Field>
        </div>
      </Modal>
    </div>
  );
}

// ============== PARTNERS ==============
function PartnersPage() {
  const D = window.KPSData;
  const partners = D.getAll("partners");
  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">คู่ค้า / ช่าง</h1>
          <div className="page-sub">{partners.length} ราย • ยอดค้างจ่ายรวม {D.thb(partners.reduce((s,p) => s + p.balance, 0))}</div>
        </div>
        <div className="actions">
          <button className="btn primary"><Icon name="plus" size={15}/> เพิ่มคู่ค้า</button>
        </div>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>รหัส</th><th>ชื่อ</th><th>ประเภท</th><th>ผู้ติดต่อ</th><th>โทร</th><th className="right">ยอดค้างจ่าย</th><th>สถานะ</th></tr></thead>
          <tbody>
            {partners.map(p => (
              <tr key={p.id}>
                <td className="mono">{p.code}</td>
                <td style={{ fontWeight: 500 }}>{p.name}</td>
                <td><span className="badge gray">{p.type}</span></td>
                <td>{p.contact}</td>
                <td className="mono muted">{p.phone}</td>
                <td className="num right" style={{ fontWeight: 600, color: p.balance > 0 ? "var(--red)" : "var(--text-muted)" }}>{D.thb(p.balance)}</td>
                <td><StatusBadge status={p.status}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============== SUBCONTRACTORS ==============
function SubcontractorsPage() {
  const D = window.KPSData;
  const all = D.getAll("subcontractors");
  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">รถรับจ้างร่วม</h1>
          <div className="page-sub">{all.length} ราย • รถในเครือข่ายรวม {all.reduce((s,x) => s + x.vehicles, 0)} คัน</div>
        </div>
        <div className="actions">
          <button className="btn primary"><Icon name="plus" size={15}/> เพิ่มผู้รับจ้าง</button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        {all.map(s => (
          <div key={s.id} className="card pad" style={{ cursor: "pointer" }}>
            <div className="row" style={{ marginBottom: 12 }}>
              <div className="avatar lg violet">{s.name.replace(/[^ก-๙a-zA-Z]/g,"").slice(0,2)}</div>
              <div className="spacer"/>
              <span className="mono muted" style={{ fontSize: 11 }}>{s.code}</span>
            </div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{s.contact} • {s.phone}</div>
            <div className="row" style={{ marginTop: 14, gap: 16 }}>
              <div><div className="muted" style={{ fontSize: 11 }}>รถ</div><div className="mono" style={{ fontWeight: 700 }}>{s.vehicles}</div></div>
              <div><div className="muted" style={{ fontSize: 11 }}>เรตติ้ง</div><div className="mono" style={{ fontWeight: 700, color: "var(--amber)" }}>★ {s.rating}</div></div>
              <div><div className="muted" style={{ fontSize: 11 }}>งานเปิด</div><div className="mono" style={{ fontWeight: 700 }}>{s.openJobs}</div></div>
            </div>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
              <div className="muted" style={{ fontSize: 11 }}>จ่ายสะสม</div>
              <div className="mono" style={{ fontWeight: 700, fontSize: 16 }}>{D.thb(s.totalPaid)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SubcontractorJobs() {
  const D = window.KPSData;
  const jobs = D.getAll("dispatch").filter(t => t.subcontractorId);
  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">งานที่จ้างร่วม</h1>
          <div className="page-sub">{jobs.length} งาน • ค่าจ้างรวม {D.thb(jobs.reduce((s,j) => s + (j.cost||0), 0))}</div>
        </div>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>รหัสงาน</th><th>ผู้รับจ้าง</th><th>ลูกค้า</th><th>เส้นทาง</th><th className="right">รายได้</th><th className="right">ค่าจ้าง</th><th className="right">กำไร</th><th>สถานะ</th></tr></thead>
          <tbody>
            {jobs.map(j => {
              const margin = (j.revenue || 0) - (j.cost || 0);
              return (
                <tr key={j.id}>
                  <td className="mono">{j.code}</td>
                  <td>{D.nameOf("subcontractors", j.subcontractorId)}</td>
                  <td>{D.nameOf("customers", j.customerId)?.replace("บริษัท ","").replace(" จำกัด","")}</td>
                  <td><div style={{ fontSize: 12.5 }}>{j.origin}</div><div className="muted" style={{ fontSize: 11.5 }}>→ {j.destination}</div></td>
                  <td className="num right">{D.thb(j.revenue)}</td>
                  <td className="num right">{D.thb(j.cost)}</td>
                  <td className="num right" style={{ fontWeight: 600, color: "var(--green)" }}>{D.thb(margin)}</td>
                  <td><StatusBadge status={j.status}/></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============== MAINTENANCE ==============
function MaintenancePage() {
  const D = window.KPSData;
  const all = D.getAll("maintenance");
  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">การบำรุงรักษา</h1>
          <div className="page-sub">{all.length} รายการ • กำลังซ่อม {all.filter(m => m.status === "in-progress").length} • นัดหมาย {all.filter(m => m.status === "scheduled").length}</div>
        </div>
        <div className="actions">
          <button className="btn primary"><Icon name="plus" size={15}/> สั่งบำรุงรักษา</button>
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: 16 }}>
        <div className="card kpi"><div className="label">กำลังซ่อม</div><div className="row"><div className="icn-box"><Icon name="wrench" size={18}/></div><div className="value">{all.filter(m => m.status === "in-progress").length}<span className="unit">งาน</span></div></div></div>
        <div className="card kpi"><div className="label">นัดหมายล่วงหน้า</div><div className="row"><div className="icn-box amber"><Icon name="calendar" size={18}/></div><div className="value">{all.filter(m => m.status === "scheduled").length}<span className="unit">งาน</span></div></div></div>
        <div className="card kpi"><div className="label">ค่าใช้จ่ายเดือนนี้</div><div className="row"><div className="icn-box red"><Icon name="money" size={18}/></div><div className="value">{D.thb(all.filter(m => m.startDate.startsWith("2026-05")).reduce((s,m) => s + (m.cost||0), 0))}</div></div></div>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>รหัส</th><th>รถ</th><th>ประเภท</th><th>รายการ</th><th>อู่/ศูนย์</th><th>วันที่</th><th className="right">ค่าใช้จ่าย</th><th>สถานะ</th></tr></thead>
          <tbody>
            {all.map(m => (
              <tr key={m.id}>
                <td className="mono">{m.code}</td>
                <td><span className="mono badge gray">{D.nameOf("vehicles", m.vehicleId)}</span></td>
                <td>{m.type}</td>
                <td className="muted" style={{ fontSize: 12.5 }}>{m.items.join(" • ")}</td>
                <td>{m.workshop}</td>
                <td className="num muted">{m.startDate}</td>
                <td className="num right" style={{ fontWeight: 600 }}>{m.cost > 0 ? D.thb(m.cost) : "—"}</td>
                <td><StatusBadge status={m.status}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============== EXPENSES ==============
function ExpensesPage() {
  const D = window.KPSData;
  const all = D.getAll("expenses");
  const [show, setShow] = useStateBiz(false);
  const [form, setForm] = useStateBiz({ vehicleId: "", category: "ค่าน้ำมัน", note: "", amount: "", paidBy: "เงินสดล่วงหน้า", date: new Date().toISOString().slice(0,10) });
  const save = () => {
    if (!form.amount) { alert("กรุณากรอกจำนวนเงิน"); return; }
    D.add("expenses", { ...form, code: "EXP-" + new Date().toISOString().slice(2,10).replace(/-/g,"") + Math.floor(Math.random()*100), amount: +form.amount, status: "pending" });
    setShow(false); setForm({ vehicleId: "", category: "ค่าน้ำมัน", note: "", amount: "", paidBy: "เงินสดล่วงหน้า", date: new Date().toISOString().slice(0,10) });
  };

  const totalByCat = {};
  all.forEach(x => { totalByCat[x.category] = (totalByCat[x.category] || 0) + x.amount; });

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">บันทึกค่าใช้จ่าย</h1>
          <div className="page-sub">{all.length} รายการ • รวม {D.thb(all.reduce((s,x) => s + x.amount, 0))} • รออนุมัติ {all.filter(x => x.status === "pending").length}</div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={() => setShow(true)}><Icon name="plus" size={15}/> บันทึกค่าใช้จ่าย</button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 16 }}>
        {Object.entries(totalByCat).slice(0,4).map(([cat, amt]) => (
          <div key={cat} className="card kpi">
            <div className="label">{cat}</div>
            <div className="row"><div className="icn-box"><Icon name="money" size={18}/></div><div className="value">{D.thb(amt)}</div></div>
          </div>
        ))}
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>รหัส</th><th>วันที่</th><th>หมวด</th><th>รายละเอียด</th><th>รถ</th><th>วิธีจ่าย</th><th className="right">จำนวนเงิน</th><th>สถานะ</th></tr></thead>
          <tbody>
            {all.map(x => (
              <tr key={x.id}>
                <td className="mono">{x.code}</td>
                <td className="num muted">{x.date}</td>
                <td><span className="badge gray">{x.category}</span></td>
                <td>{x.note}</td>
                <td>{x.vehicleId ? <span className="mono badge gray">{D.nameOf("vehicles", x.vehicleId)}</span> : <span className="faint">—</span>}</td>
                <td>{x.paidBy}</td>
                <td className="num right" style={{ fontWeight: 600 }}>{D.thb(x.amount)}</td>
                <td>{x.status === "approved" ? <span className="badge green">อนุมัติแล้ว</span> : <span className="badge amber">รออนุมัติ</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={show} onClose={() => setShow(false)} title="บันทึกค่าใช้จ่ายใหม่" wide footer={<>
        <button className="btn" onClick={() => setShow(false)}>ยกเลิก</button>
        <button className="btn primary" onClick={save}>บันทึก</button>
      </>}>
        <div className="grid-2">
          <Field label="วันที่"><input type="date" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))}/></Field>
          <Field label="หมวด">
            <select value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))}>
              <option>ค่าน้ำมัน</option><option>ค่าทางด่วน</option><option>ค่าซ่อม</option><option>ค่าจ้างรถร่วม</option><option>ค่าเบี้ยเลี้ยง</option><option>ค่าจอดรถ</option><option>อื่นๆ</option>
            </select>
          </Field>
          <Field label="รถที่เกี่ยวข้อง">
            <select value={form.vehicleId} onChange={e => setForm(f => ({...f, vehicleId: e.target.value}))}>
              <option value="">— ไม่ระบุ —</option>
              {D.getAll("vehicles").map(v => <option key={v.id} value={v.id}>{v.plate} • {v.brand}</option>)}
            </select>
          </Field>
          <Field label="จำนวนเงิน (บาท) *"><input type="number" value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))}/></Field>
          <Field label="วิธีจ่าย">
            <select value={form.paidBy} onChange={e => setForm(f => ({...f, paidBy: e.target.value}))}>
              <option>เงินสดล่วงหน้า</option><option>บัตรเครดิตบริษัท</option><option>บริษัท</option><option>เงินสดส่วนตัว (เบิกคืน)</option>
            </select>
          </Field>
          <Field label="รายละเอียด" full><textarea value={form.note} onChange={e => setForm(f => ({...f, note: e.target.value}))} rows="3" placeholder="หมายเหตุ / ทริปที่เกี่ยวข้อง"/></Field>
        </div>
      </Modal>
    </div>
  );
}

function StockPage() {
  const D = window.KPSData;
  const stock = D.getAll("stock");
  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">สต็อคคลัง KPS</h1>
          <div className="page-sub">{stock.length} รายการ • มูลค่ารวม {D.thb(stock.reduce((s,r) => s + r.qty * r.unitCost, 0))} • ใกล้หมด {stock.filter(s => s.qty <= s.reorderAt).length} รายการ</div>
        </div>
        <div className="actions">
          <button className="btn primary"><Icon name="plus" size={15}/> เพิ่มสต็อค</button>
        </div>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>รหัส</th><th>รายการ</th><th>หมวด</th><th className="right">คงเหลือ</th><th>หน่วย</th><th className="right">ต้นทุน/หน่วย</th><th className="right">มูลค่ารวม</th><th>สถานะ</th></tr></thead>
          <tbody>
            {stock.map(s => {
              const low = s.qty <= s.reorderAt;
              return (
                <tr key={s.id}>
                  <td className="mono">{s.code}</td>
                  <td style={{ fontWeight: 500 }}>{s.name}</td>
                  <td><span className="badge gray">{s.category}</span></td>
                  <td className="num right" style={{ fontWeight: 600, color: low ? "var(--red)" : undefined }}>{s.qty}</td>
                  <td className="muted">{s.unit}</td>
                  <td className="num right">{D.thb(s.unitCost)}</td>
                  <td className="num right">{D.thb(s.qty * s.unitCost)}</td>
                  <td>{low ? <span className="badge red">ใกล้หมด • สั่งเพิ่ม</span> : <span className="badge green">ปกติ</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============== FINANCE ==============
function FinancePL() {
  const D = window.KPSData;
  const vehicles = D.getAll("vehicles");
  const dispatch = D.getAll("dispatch");
  const fuel = D.getAll("fuel");
  const maintenance = D.getAll("maintenance");
  const expenses = D.getAll("expenses");
  const fixedCosts = D.getAll("fixedCosts");

  const rows = vehicles.map(v => {
    const rev = dispatch.filter(t => t.vehicleId === v.id).reduce((s,t) => s + (t.revenue||0), 0);
    const fuelC = fuel.filter(f => f.vehicleId === v.id).reduce((s,f) => s + f.total, 0);
    const mntC = maintenance.filter(m => m.vehicleId === v.id).reduce((s,m) => s + (m.cost||0), 0);
    const expC = expenses.filter(x => x.vehicleId === v.id).reduce((s,x) => s + x.amount, 0);
    const fixC = fixedCosts.filter(f => f.vehicleId === v.id).reduce((s,f) => s + f.monthly, 0);
    const cost = fuelC + mntC + expC + fixC;
    const pnl = rev - cost;
    return { v, rev, fuelC, mntC, expC, fixC, cost, pnl, margin: rev > 0 ? (pnl/rev*100) : 0 };
  });

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">P&amp;L รายคัน</h1>
          <div className="page-sub">กำไร-ขาดทุนรายคัน เดือนพฤษภาคม 2026</div>
        </div>
        <div className="actions">
          <button className="btn primary"><Icon name="download" size={15}/> ส่งออก</button>
        </div>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>รถ</th>
              <th>ประเภท</th>
              <th className="right">รายได้</th>
              <th className="right">ค่าน้ำมัน</th>
              <th className="right">ค่าซ่อม</th>
              <th className="right">ค่าใช้จ่ายอื่น</th>
              <th className="right">ค่าใช้จ่ายคงที่</th>
              <th className="right">รวมต้นทุน</th>
              <th className="right">กำไร/ขาดทุน</th>
              <th className="right">Margin</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.v.id}>
                <td><span className="mono badge gray">{r.v.plate}</span></td>
                <td className="muted" style={{ fontSize: 12.5 }}>{r.v.brand}</td>
                <td className="num right" style={{ fontWeight: 600 }}>{D.thb(r.rev)}</td>
                <td className="num right">{D.thb(r.fuelC)}</td>
                <td className="num right">{D.thb(r.mntC)}</td>
                <td className="num right">{D.thb(r.expC)}</td>
                <td className="num right">{D.thb(r.fixC)}</td>
                <td className="num right">{D.thb(r.cost)}</td>
                <td className="num right" style={{ fontWeight: 700, color: r.pnl >= 0 ? "var(--green)" : "var(--red)" }}>{D.thb(r.pnl)}</td>
                <td className="num right" style={{ fontWeight: 600, color: r.margin >= 30 ? "var(--green)" : r.margin >= 0 ? "var(--amber)" : "var(--red)" }}>{r.margin.toFixed(1)}%</td>
              </tr>
            ))}
            <tr style={{ background: "var(--bg-sunk)", fontWeight: 700 }}>
              <td colSpan="2">รวม</td>
              <td className="num right">{D.thb(rows.reduce((s,r) => s + r.rev, 0))}</td>
              <td className="num right">{D.thb(rows.reduce((s,r) => s + r.fuelC, 0))}</td>
              <td className="num right">{D.thb(rows.reduce((s,r) => s + r.mntC, 0))}</td>
              <td className="num right">{D.thb(rows.reduce((s,r) => s + r.expC, 0))}</td>
              <td className="num right">{D.thb(rows.reduce((s,r) => s + r.fixC, 0))}</td>
              <td className="num right">{D.thb(rows.reduce((s,r) => s + r.cost, 0))}</td>
              <td className="num right" style={{ color: "var(--green)" }}>{D.thb(rows.reduce((s,r) => s + r.pnl, 0))}</td>
              <td className="num right">—</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FinanceFixed() {
  const D = window.KPSData;
  const all = D.getAll("fixedCosts");
  const total = all.reduce((s,f) => s + f.monthly, 0);
  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">ค่าใช้จ่ายคงที่</h1>
          <div className="page-sub">ค่าใช้จ่ายประจำเดือน รวม {D.thb(total)}/เดือน</div>
        </div>
        <div className="actions"><button className="btn primary"><Icon name="plus" size={15}/> เพิ่มรายการ</button></div>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>รายการ</th><th>หมวด</th><th>รถที่เกี่ยวข้อง</th><th className="right">บาท/เดือน</th><th>สถานะเดือนนี้</th></tr></thead>
          <tbody>
            {all.map(f => (
              <tr key={f.id}>
                <td style={{ fontWeight: 500 }}>{f.name}</td>
                <td><span className="badge gray">{f.category}</span></td>
                <td>{f.vehicleId ? <span className="mono badge gray">{D.nameOf("vehicles", f.vehicleId)}</span> : <span className="faint">— ทุกคัน —</span>}</td>
                <td className="num right" style={{ fontWeight: 600 }}>{D.thb(f.monthly)}</td>
                <td>{f.paid ? <span className="badge green">จ่ายแล้ว</span> : <span className="badge amber">รอจ่าย</span>}</td>
              </tr>
            ))}
            <tr style={{ background: "var(--bg-sunk)", fontWeight: 700 }}>
              <td colSpan="3">รวม</td>
              <td className="num right">{D.thb(total)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FinanceSummary() {
  const D = window.KPSData;
  const dispatch = D.getAll("dispatch");
  const expenses = D.getAll("expenses");
  const fuel = D.getAll("fuel");
  const maintenance = D.getAll("maintenance");
  const fixed = D.getAll("fixedCosts").reduce((s,f) => s + f.monthly, 0);

  const rev = dispatch.reduce((s,t) => s + (t.revenue||0), 0);
  const fuelC = fuel.reduce((s,f) => s + f.total, 0);
  const mntC = maintenance.reduce((s,m) => s + (m.cost||0), 0);
  const expC = expenses.reduce((s,x) => s + x.amount, 0);
  const cost = fuelC + mntC + expC + fixed;
  const pnl = rev - cost;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">รายงานสรุปการเงิน</h1>
          <div className="page-sub">งบกำไร-ขาดทุน เดือนพฤษภาคม 2026</div>
        </div>
        <div className="actions"><button className="btn primary"><Icon name="download" size={15}/> ส่งออก PDF</button></div>
      </div>

      <div className="grid-4" style={{ marginBottom: 16 }}>
        <div className="card kpi"><div className="label">รายได้</div><div className="row"><div className="icn-box green"><Icon name="money" size={18}/></div><div className="value">{D.thb(rev)}</div></div></div>
        <div className="card kpi"><div className="label">ต้นทุนรวม</div><div className="row"><div className="icn-box red"><Icon name="money" size={18}/></div><div className="value">{D.thb(cost)}</div></div></div>
        <div className="card kpi"><div className="label">กำไร</div><div className="row"><div className="icn-box teal"><Icon name="chart" size={18}/></div><div className="value">{D.thb(pnl)}</div></div></div>
        <div className="card kpi"><div className="label">Margin</div><div className="row"><div className="icn-box"><Icon name="chart" size={18}/></div><div className="value">{(pnl/rev*100).toFixed(1)}<span className="unit">%</span></div></div></div>
      </div>

      <div className="card pad" style={{ maxWidth: 720 }}>
        <h3 className="section-title">รายละเอียดต้นทุน</h3>
        {[["ค่าน้ำมัน", fuelC, "amber"], ["ค่าซ่อมบำรุงรักษา", mntC, "blue"], ["ค่าใช้จ่ายอื่นๆ", expC, "violet"], ["ค่าใช้จ่ายคงที่", fixed, "teal"]].map(([label, val, c]) => (
          <div key={label} style={{ marginBottom: 14 }}>
            <div className="row" style={{ marginBottom: 4 }}>
              <span>{label}</span>
              <div className="spacer"/>
              <span className="mono" style={{ fontWeight: 600 }}>{D.thb(val)}</span>
              <span className="muted mono" style={{ fontSize: 12, minWidth: 50, textAlign: "right" }}>{(val/cost*100).toFixed(1)}%</span>
            </div>
            <div className="progress"><div className={`fill ${c === "amber" ? "amber" : ""}`} style={{ width: (val/cost*100) + "%" }}/></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============== SETTINGS ==============
function SettingsUsers() {
  const D = window.KPSData;
  const users = D.getAll("users");
  const [show, setShow] = useStateBiz(false);
  const [form, setForm] = useStateBiz({ name: "", email: "", role: "manager", phone: "", avatar: "" });
  const save = () => {
    if (!form.name || !form.email) { alert("กรุณากรอกชื่อและอีเมล"); return; }
    D.add("users", { ...form, avatar: form.avatar || form.name.slice(0,2) });
    setShow(false); setForm({ name: "", email: "", role: "manager", phone: "", avatar: "" });
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">จัดการผู้ใช้งาน</h1>
          <div className="page-sub">{users.length} บัญชีในระบบ</div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={() => setShow(true)}><Icon name="plus" size={15}/> เพิ่มผู้ใช้</button>
        </div>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>ชื่อ-อีเมล</th><th>ตำแหน่ง</th><th>โทร</th><th>สิทธิ์</th><th></th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>
                  <div className="row" style={{ gap: 10 }}>
                    <div className={`avatar ${u.role === "admin" ? "violet" : u.role === "driver" ? "amber" : ""}`}>{u.avatar}</div>
                    <div>
                      <div style={{ fontWeight: 500 }}>{u.name}</div>
                      <div className="muted" style={{ fontSize: 11.5 }}>{u.email}</div>
                    </div>
                  </div>
                </td>
                <td>{u.title}</td>
                <td className="mono muted">{u.phone}</td>
                <td><span className={`role-pill ${u.role}`}>{u.role}</span></td>
                <td><button className="btn ghost icon sm"><Icon name="more" size={16}/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={show} onClose={() => setShow(false)} title="เพิ่มผู้ใช้ใหม่" footer={<>
        <button className="btn" onClick={() => setShow(false)}>ยกเลิก</button>
        <button className="btn primary" onClick={save}>บันทึก</button>
      </>}>
        <div className="grid-2">
          <Field label="ชื่อ-นามสกุล *"><input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}/></Field>
          <Field label="อีเมล *"><input value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))}/></Field>
          <Field label="เบอร์โทร"><input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))}/></Field>
          <Field label="สิทธิ์การเข้าถึง">
            <select value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))}>
              <option value="admin">Admin — เข้าถึงทุกอย่าง</option>
              <option value="manager">Manager — จัดการขนส่ง</option>
              <option value="driver">Driver — งานของตนเอง</option>
            </select>
          </Field>
        </div>
      </Modal>
    </div>
  );
}

function SettingsCompany() {
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
          <Field label="ชื่อบริษัท"><input defaultValue="บริษัท เคพีเอส ทรานสปอร์เตชั่น จำกัด"/></Field>
          <Field label="เลขประจำตัวผู้เสียภาษี"><input defaultValue="0105556012345"/></Field>
          <Field label="เบอร์โทร"><input defaultValue="02-XXX-XXXX"/></Field>
          <Field label="อีเมล"><input defaultValue="contact@kps.com"/></Field>
          <Field label="ที่อยู่" full><textarea defaultValue="123/45 ถนนบางนา-ตราด แขวงบางนาเหนือ เขตบางนา กรุงเทพมหานคร 10260" rows="3"/></Field>
        </div>
        <div className="row" style={{ marginTop: 18, justifyContent: "flex-end", gap: 8 }}>
          <button className="btn">ยกเลิก</button>
          <button className="btn primary"><Icon name="check" size={15}/> บันทึก</button>
        </div>
      </div>
    </div>
  );
}

// ============== DRIVER VIEW ==============
function DriverView({ user }) {
  const D = window.KPSData;
  // find driver by name match
  const driver = D.getAll("employees").find(e => e.name === user.name) || D.getAll("employees").find(e => e.position.includes("ขับ"));
  const myTrips = D.getAll("dispatch").filter(t => t.driverId === driver?.id);
  const active = myTrips.find(t => t.status === "in-progress" || t.status === "in-transit");
  const upcoming = myTrips.filter(t => t.status === "scheduled" || t.status === "draft");
  const past = myTrips.filter(t => t.status === "delivered" || t.status === "completed");
  const myVehicle = D.getAll("vehicles").find(v => v.driverId === driver?.id);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">สวัสดี, {user.name.split(" ")[0]} 👋</h1>
          <div className="page-sub">งานของคุณวันนี้</div>
        </div>
      </div>

      {active && (
        <div className="card" style={{ marginBottom: 16, borderLeft: "4px solid var(--primary)" }}>
          <div className="head">
            <h3>🚚 งานที่กำลังทำ</h3>
            <span className="mono muted">{active.code}</span>
            <div className="right"><StatusBadge status={active.status}/></div>
          </div>
          <div style={{ padding: 22 }}>
            <div className="grid-3" style={{ marginBottom: 18 }}>
              <Info label="ต้นทาง" value={D.originOf(active)}/>
              <Info label="ปลายทาง" value={D.destOf(active)}/>
              <Info label="สินค้า" value={active.cargo || D.legsOf(active)[0]?.cargo || "—"}/>
            </div>
            <div className="grid-3">
              <Info label="ออกเดินทาง" value={active.depart}/>
              <Info label="คาดว่าจะถึง" value={active.eta}/>
              <Info label="ระยะทาง" value={active.distance + " km"}/>
            </div>
            <div style={{ marginTop: 18 }}>
              <div className="row" style={{ marginBottom: 6 }}>
                <span>ความคืบหน้า</span>
                <div className="spacer"/>
                <span className="mono" style={{ fontWeight: 600 }}>{active.progress}%</span>
              </div>
              <div className="progress" style={{ height: 8 }}><div className="fill" style={{ width: active.progress + "%" }}/></div>
            </div>
            <div className="row" style={{ marginTop: 20, gap: 8 }}>
              <button className="btn primary"><Icon name="pin" size={15}/> แจ้งตำแหน่งปัจจุบัน</button>
              <button className="btn"><Icon name="fuel" size={15}/> บันทึกเติมน้ำมัน</button>
              <button className="btn"><Icon name="check" size={15}/> ปิดงาน</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <div className="head"><h3>รถประจำของคุณ</h3></div>
          <div style={{ padding: 22 }}>
            {myVehicle ? (
              <>
                <div className="row" style={{ gap: 14, marginBottom: 18 }}>
                  <div style={{ width: 110, height: 56, borderRadius: 8, background: "var(--text-2)", color: "#FFD700", display: "grid", placeItems: "center", fontSize: 22, fontFamily: "var(--font-mono)", fontWeight: 700 }}>{myVehicle.plate}</div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>{myVehicle.brand}</div>
                    <div className="muted" style={{ fontSize: 13 }}>{myVehicle.type}</div>
                  </div>
                </div>
                <div className="grid-2" style={{ gap: 14 }}>
                  <Info label="เลขไมล์" value={D.fmt(myVehicle.odometer) + " km"}/>
                  <Info label="น้ำมัน" value={myVehicle.fuel + "%"}/>
                  <Info label="บำรุงรักษาถัดไป" value={myVehicle.nextService}/>
                  <Info label="ประกันหมด" value={myVehicle.insurance}/>
                </div>
              </>
            ) : <Empty>ยังไม่ได้รับมอบหมายรถประจำ</Empty>}
          </div>
        </div>

        <div className="card">
          <div className="head"><h3>งานนัดหมาย ({upcoming.length})</h3></div>
          <div style={{ padding: "8px 22px 22px" }}>
            {upcoming.length === 0 && <Empty>ยังไม่มีงานนัดหมาย</Empty>}
            {upcoming.map(t => (
              <div key={t.id} style={{ padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
                <div className="row" style={{ marginBottom: 4 }}>
                  <span className="mono" style={{ fontWeight: 600 }}>{t.code}</span>
                  <div className="spacer"/>
                  <span className="mono muted" style={{ fontSize: 12 }}>{t.depart}</span>
                </div>
                <div style={{ fontSize: 13.5 }}>{D.originOf(t)} → {D.destOf(t)}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{t.cargo || D.legsOf(t)[0]?.cargo}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="head"><h3>งานที่ผ่านมา</h3></div>
        <div className="tbl-wrap" style={{ border: "none", borderRadius: 0 }}>
          <table className="tbl">
            <thead><tr><th>รหัส</th><th>เส้นทาง</th><th>วันที่</th><th>ระยะทาง</th><th>สถานะ</th></tr></thead>
            <tbody>
              {past.slice(0,5).map(t => (
                <tr key={t.id}>
                  <td className="mono">{t.code}</td>
                  <td><div style={{ fontSize: 13 }}>{D.originOf(t)}</div><div className="muted" style={{ fontSize: 11.5 }}>→ {D.destOf(t)}</div></td>
                  <td className="num muted">{t.depart.slice(0,10)}</td>
                  <td className="num">{t.distance} km</td>
                  <td><StatusBadge status={t.status}/></td>
                </tr>
              ))}
              {past.length === 0 && <tr><td colSpan="5"><Empty>ยังไม่มีประวัติงาน</Empty></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  CustomersPage, PartnersPage, SubcontractorsPage, SubcontractorJobs,
  MaintenancePage, ExpensesPage, StockPage,
  FinancePL, FinanceFixed, FinanceSummary,
  SettingsUsers, SettingsCompany, DriverView,
});
