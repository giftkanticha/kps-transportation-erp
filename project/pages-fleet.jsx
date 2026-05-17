// pages-fleet.jsx — Vehicles + Employees modules
const { useState: useStateFleet, useMemo: useMemoFleet } = React;

// ============== VEHICLES ==============
function VehiclesPage({ setActive, setSubject }) {
  const D = window.KPSData;
  const [q, setQ] = useStateFleet("");
  const [filter, setFilter] = useStateFleet("all");
  const [showAdd, setShowAdd] = useStateFleet(false);

  const vehicles = D.getAll("vehicles");
  const filtered = vehicles.filter(v => {
    if (filter !== "all" && v.status !== filter) return false;
    if (q && !(v.plate.toLowerCase().includes(q.toLowerCase()) || v.brand.toLowerCase().includes(q.toLowerCase()) || v.type.includes(q))) return false;
    return true;
  });

  const counts = {
    all: vehicles.length,
    "on-trip": vehicles.filter(v => v.status === "on-trip").length,
    idle: vehicles.filter(v => v.status === "idle").length,
    maintenance: vehicles.filter(v => v.status === "maintenance").length,
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">จัดการรถ</h1>
          <div className="page-sub">รถบรรทุก {vehicles.length} คันในระบบ • {counts["on-trip"]} คันออกงาน</div>
        </div>
        <div className="actions">
          <button className="btn"><Icon name="download" size={15}/> ส่งออก</button>
          <button className="btn primary" onClick={() => setActive("vehicles.add")}><Icon name="plus" size={15}/> เพิ่มรถใหม่</button>
        </div>
      </div>

      <div className="toolbar">
        <div style={{ position: "relative" }}>
          <Icon name="search" size={15} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)" }}/>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาทะเบียน, ยี่ห้อ, ประเภท..."
            style={{ height: 36, padding: "0 12px 0 34px", width: 280, border: "1px solid var(--line)", borderRadius: 8, background: "#fff", fontSize: 13 }}/>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {[["all","ทั้งหมด"],["on-trip","ออกงาน"],["idle","ว่าง"],["maintenance","ซ่อมบำรุง"]].map(([k,l]) => (
            <button key={k} className={`chip ${filter === k ? "active" : ""}`} onClick={() => setFilter(k)}>
              {l} <span className="mono" style={{ opacity: .7 }}>{counts[k]}</span>
            </button>
          ))}
        </div>
        <div className="spacer"/>
        <span className="muted mono" style={{ fontSize: 12 }}>{filtered.length} รายการ</span>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>ทะเบียน</th>
              <th>ประเภท / ยี่ห้อ</th>
              <th>ปี</th>
              <th>คนขับ</th>
              <th>กม.รวม</th>
              <th>น้ำมัน</th>
              <th>นัดบำรุงรักษา</th>
              <th>สถานะ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(v => {
              const driver = D.get("employees", v.driverId);
              return (
                <tr key={v.id} onClick={() => { setSubject({ type: "vehicle", id: v.id }); setActive("vehicles.detail"); }}>
                  <td>
                    <div className="row" style={{ gap: 10 }}>
                      <div style={{ width: 44, height: 30, borderRadius: 4, background: "var(--text-2)", color: "#FFD700", display: "grid", placeItems: "center", fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: ".05em" }}>{v.plate}</div>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{v.brand}</div>
                    <div className="muted" style={{ fontSize: 11.5 }}>{v.type}</div>
                  </td>
                  <td className="num">{v.year}</td>
                  <td>{driver ? driver.name : <span className="faint">— ไม่ระบุ</span>}</td>
                  <td className="num">{D.fmt(v.odometer)} km</td>
                  <td style={{ minWidth: 110 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <div className="progress" style={{ flex: 1, maxWidth: 60 }}>
                        <div className={`fill ${v.fuel < 30 ? "red" : v.fuel < 60 ? "amber" : "green"}`} style={{ width: v.fuel + "%" }}/>
                      </div>
                      <span className="mono" style={{ fontSize: 12 }}>{v.fuel}%</span>
                    </div>
                  </td>
                  <td className="num muted">{v.nextService}</td>
                  <td><StatusBadge status={v.status}/></td>
                  <td>
                    <button className="btn ghost icon sm" onClick={e => e.stopPropagation()}><Icon name="more" size={16}/></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="empty">ไม่พบรถที่ตรงกับเงื่อนไข</div>}
      </div>
    </div>
  );
}

function VehicleAdd({ setActive }) {
  const D = window.KPSData;
  const [form, setForm] = useStateFleet({ plate: "", type: "หัวลาก 10 ล้อ", brand: "", year: 2025, status: "idle", odometer: 0, fuel: 100, lastService: "", nextService: "", insurance: "", tax: "", driverId: null });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const save = () => {
    if (!form.plate || !form.brand) { alert("กรุณากรอกทะเบียนและยี่ห้อ"); return; }
    D.add("vehicles", { ...form, odometer: +form.odometer, fuel: +form.fuel, year: +form.year });
    setActive("vehicles");
  };
  return (
    <div>
      <div className="page-head">
        <div>
          <div className="row" style={{ gap: 6, color: "var(--text-muted)", fontSize: 12, marginBottom: 4 }}>
            <span style={{ cursor: "pointer" }} onClick={() => setActive("vehicles")}>← จัดการรถ</span>
          </div>
          <h1 className="page-title">เพิ่มรถใหม่</h1>
          <div className="page-sub">กรอกข้อมูลรถบรรทุก รายละเอียดเครื่อง ประกัน และภาษี</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <div className="card pad">
          <h3 className="section-title">ข้อมูลพื้นฐาน</h3>
          <div className="grid-2" style={{ marginBottom: 14 }}>
            <Field label="เลขทะเบียน *"><input value={form.plate} onChange={e => set("plate", e.target.value)} placeholder="เช่น 70-2451"/></Field>
            <Field label="ปีรถ *"><input type="number" value={form.year} onChange={e => set("year", e.target.value)}/></Field>
            <Field label="ยี่ห้อ / รุ่น *"><input value={form.brand} onChange={e => set("brand", e.target.value)} placeholder="เช่น Hino 700"/></Field>
            <Field label="ประเภทรถ">
              <select value={form.type} onChange={e => set("type", e.target.value)}>
                <option>หัวลาก 10 ล้อ</option>
                <option>6 ล้อ บรรทุก</option>
                <option>ตู้คอนเทนเนอร์</option>
                <option>พ่วงข้าง</option>
              </select>
            </Field>
            <Field label="เลขไมล์ปัจจุบัน (km)"><input type="number" value={form.odometer} onChange={e => set("odometer", e.target.value)}/></Field>
            <Field label="น้ำมันปัจจุบัน (%)"><input type="number" value={form.fuel} onChange={e => set("fuel", e.target.value)}/></Field>
          </div>

          <h3 className="section-title" style={{ marginTop: 22 }}>เอกสาร & บำรุงรักษา</h3>
          <div className="grid-2">
            <Field label="บำรุงรักษาครั้งล่าสุด"><input type="date" value={form.lastService} onChange={e => set("lastService", e.target.value)}/></Field>
            <Field label="นัดบำรุงรักษาถัดไป"><input type="date" value={form.nextService} onChange={e => set("nextService", e.target.value)}/></Field>
            <Field label="วันหมดประกัน"><input type="date" value={form.insurance} onChange={e => set("insurance", e.target.value)}/></Field>
            <Field label="วันหมดภาษี"><input type="date" value={form.tax} onChange={e => set("tax", e.target.value)}/></Field>
          </div>
        </div>

        <div className="col" style={{ gap: 16 }}>
          <div className="card pad">
            <h3 className="section-title">การมอบหมาย</h3>
            <Field label="คนขับประจำ">
              <select value={form.driverId || ""} onChange={e => set("driverId", e.target.value || null)}>
                <option value="">— ไม่ระบุ —</option>
                {D.getAll("employees").filter(e => e.position.includes("ขับ") && !e.vehicleId).map(e => (
                  <option key={e.id} value={e.id}>{e.name} ({e.code})</option>
                ))}
              </select>
            </Field>
            <Field label="สถานะเริ่มต้น">
              <select value={form.status} onChange={e => set("status", e.target.value)}>
                <option value="idle">ว่าง</option>
                <option value="on-trip">ออกงาน</option>
                <option value="maintenance">ซ่อมบำรุง</option>
              </select>
            </Field>
          </div>
          <div className="card pad">
            <h3 className="section-title">ตัวอย่างทะเบียน</h3>
            <div style={{ display: "grid", placeItems: "center", padding: "24px 0" }}>
              <div style={{ width: 180, height: 80, borderRadius: 8, background: "var(--text-2)", color: "#FFD700", display: "grid", placeItems: "center", fontSize: 32, fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: ".05em" }}>
                {form.plate || "70-XXXX"}
              </div>
            </div>
            <div className="muted" style={{ fontSize: 12, textAlign: "center" }}>ทะเบียนสีเหลือง — รถบรรทุก</div>
          </div>
        </div>
      </div>

      <div className="row" style={{ marginTop: 20, justifyContent: "flex-end", gap: 8 }}>
        <button className="btn" onClick={() => setActive("vehicles")}>ยกเลิก</button>
        <button className="btn primary" onClick={save}><Icon name="check" size={15}/> บันทึกข้อมูลรถ</button>
      </div>
    </div>
  );
}

function VehicleDetail({ setActive, subject }) {
  const D = window.KPSData;
  const v = D.get("vehicles", subject?.id);
  if (!v) return <Empty>ไม่พบรถ — <a onClick={() => setActive("vehicles")} style={{cursor:"pointer", color: "var(--primary)"}}>กลับไปรายการ</a></Empty>;
  const driver = D.get("employees", v.driverId);
  const tires = D.getAll("tires").filter(t => t.vehicleId === v.id);
  const fuel = D.getAll("fuel").filter(f => f.vehicleId === v.id);
  const maintenance = D.getAll("maintenance").filter(m => m.vehicleId === v.id);
  const trips = D.getAll("dispatch").filter(t => t.vehicleId === v.id);
  const [tab, setTab] = useStateFleet("overview");

  const totalFuelCost = fuel.reduce((s,f) => s + f.total, 0);
  const totalRevenue = trips.reduce((s,t) => s + (t.revenue||0), 0);
  const totalCost = trips.reduce((s,t) => s + (t.cost||0), 0) + maintenance.reduce((s,m) => s + (m.cost||0), 0);

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="row" style={{ gap: 6, color: "var(--text-muted)", fontSize: 12, marginBottom: 4 }}>
            <span style={{ cursor: "pointer" }} onClick={() => setActive("vehicles")}>← จัดการรถ</span>
          </div>
          <div className="row" style={{ gap: 16 }}>
            <div style={{ width: 120, height: 56, borderRadius: 8, background: "var(--text-2)", color: "#FFD700", display: "grid", placeItems: "center", fontSize: 22, fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: ".05em" }}>{v.plate}</div>
            <div>
              <h1 className="page-title">{v.brand}</h1>
              <div className="page-sub">{v.type} • ปี {v.year} • <StatusBadge status={v.status}/></div>
            </div>
          </div>
        </div>
        <div className="actions">
          <button className="btn"><Icon name="edit" size={15}/> แก้ไข</button>
          <button className="btn primary"><Icon name="plus" size={15}/> สั่งบำรุงรักษา</button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="card kpi"><div className="label">เลขไมล์</div><div className="row"><div className="icn-box"><Icon name="gauge" size={18}/></div><div className="value">{D.fmt(v.odometer)}<span className="unit">km</span></div></div></div>
        <div className="card kpi"><div className="label">น้ำมันถัง</div><div className="row"><div className={`icn-box ${v.fuel < 30 ? "red" : v.fuel < 60 ? "amber" : "green"}`}><Icon name="fuel" size={18}/></div><div className="value">{v.fuel}<span className="unit">%</span></div></div></div>
        <div className="card kpi"><div className="label">รายได้ทั้งหมด</div><div className="row"><div className="icn-box green"><Icon name="money" size={18}/></div><div className="value">{D.thb(totalRevenue)}</div></div></div>
        <div className="card kpi"><div className="label">ต้นทุนรวม</div><div className="row"><div className="icn-box amber"><Icon name="money" size={18}/></div><div className="value">{D.thb(totalCost)}</div></div></div>
      </div>

      <div className="tabs">
        {[["overview","ภาพรวม"],["tires","ยาง"],["fuel","น้ำมัน"],["maintenance","บำรุงรักษา"],["trips","งานขนส่ง"]].map(([k,l]) => (
          <button key={k} className={`tab ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
          <div className="card pad">
            <h3 className="section-title">ข้อมูลรถ</h3>
            <div className="grid-2" style={{ gap: 14 }}>
              <Info label="ทะเบียน" value={v.plate}/>
              <Info label="ปี" value={v.year}/>
              <Info label="ยี่ห้อ/รุ่น" value={v.brand}/>
              <Info label="ประเภท" value={v.type}/>
              <Info label="คนขับประจำ" value={driver?.name || "—"}/>
              <Info label="โทรศัพท์คนขับ" value={driver?.phone || "—"}/>
            </div>
            <h3 className="section-title" style={{ marginTop: 22 }}>เอกสาร & กำหนดการ</h3>
            <div className="grid-2" style={{ gap: 14 }}>
              <Info label="บำรุงรักษาล่าสุด" value={v.lastService}/>
              <Info label="นัดบำรุงรักษาถัดไป" value={v.nextService}/>
              <Info label="วันหมดประกัน" value={v.insurance}/>
              <Info label="วันหมดภาษี" value={v.tax}/>
            </div>
          </div>
          <div className="card">
            <div className="head"><h3>สรุปการใช้น้ำมัน</h3></div>
            <div style={{ padding: "20px 22px" }}>
              <div className="mono" style={{ fontSize: 24, fontWeight: 700 }}>{D.thb(totalFuelCost)}</div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 16 }}>รวม {fuel.length} ครั้ง • {fuel.reduce((s,f)=>s+f.liters,0)} ลิตร</div>
              {fuel.slice(0,4).map(f => (
                <div key={f.id} className="row" style={{ padding: "8px 0", borderBottom: "1px solid var(--line)", fontSize: 12.5 }}>
                  <div>
                    <div className="mono">{f.date.slice(0,10)}</div>
                    <div className="muted" style={{ fontSize: 11 }}>{f.station}</div>
                  </div>
                  <div className="spacer"/>
                  <div className="mono right">
                    <div>{f.liters}L</div>
                    <div className="muted" style={{ fontSize: 11 }}>{D.thb(f.total)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "tires" && (
        <div className="card">
          <div className="head"><h3>ผังยางและสภาพ ({tires.length} เส้น)</h3>
            <div className="right">
              <button className="btn sm" onClick={() => setActive("tires.layout")}><Icon name="tire" size={14}/> ดูผังเต็ม</button>
            </div>
          </div>
          <div style={{ padding: 20 }}>
            <TireSummary tires={tires}/>
          </div>
        </div>
      )}

      {tab === "fuel" && (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>วันที่</th><th>ปั๊ม</th><th>ลิตร</th><th>ราคา/L</th><th className="right">รวม</th><th>เลขไมล์</th></tr></thead>
            <tbody>
              {fuel.map(f => (
                <tr key={f.id}><td className="mono">{f.date}</td><td>{f.station}</td><td className="num">{f.liters}</td><td className="num">฿{f.pricePerL}</td><td className="num right">{D.thb(f.total)}</td><td className="num muted">{D.fmt(f.odometer)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "maintenance" && (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>รหัส</th><th>ประเภท</th><th>อู่/ศูนย์</th><th>วันที่</th><th>ค่าใช้จ่าย</th><th>สถานะ</th></tr></thead>
            <tbody>
              {maintenance.map(m => (
                <tr key={m.id}>
                  <td className="mono">{m.code}</td>
                  <td>{m.type}</td>
                  <td>{m.workshop}</td>
                  <td className="num muted">{m.startDate}</td>
                  <td className="num">{D.thb(m.cost)}</td>
                  <td><StatusBadge status={m.status}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "trips" && (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>รหัสงาน</th><th>เส้นทาง</th><th>ลูกค้า</th><th>วันที่</th><th>ระยะทาง</th><th>รายได้</th><th>สถานะ</th></tr></thead>
            <tbody>
              {trips.map(t => (
                <tr key={t.id}>
                  <td className="mono">{t.code}</td>
                  <td><div style={{ fontSize: 12.5 }}>{D.originOf(t)}</div><div className="muted" style={{ fontSize: 11.5 }}>→ {D.destOf(t)}</div></td>
                  <td>{D.nameOf("customers", t.customerId)}</td>
                  <td className="num muted">{t.depart.slice(0,10)}</td>
                  <td className="num">{t.distance} km</td>
                  <td className="num">{D.thb(D.amountOf(t))}</td>
                  <td><StatusBadge status={t.status}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Helper: info pair
const Info = ({ label, value }) => (
  <div>
    <div className="muted" style={{ fontSize: 11.5, fontWeight: 500, textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</div>
    <div style={{ fontSize: 14, marginTop: 2, color: "var(--text-2)" }}>{value}</div>
  </div>
);

const TireSummary = ({ tires }) => {
  const D = window.KPSData;
  if (!tires.length) return <Empty>ยังไม่มีข้อมูลยาง</Empty>;
  // group by position
  return (
    <div>
      <div className="grid-3" style={{ marginBottom: 18 }}>
        <Info label="ดี" value={<><span className="badge green">{tires.filter(t => t.status === "good").length} เส้น</span></>}/>
        <Info label="เฝ้าระวัง" value={<><span className="badge amber">{tires.filter(t => t.status === "warning").length} เส้น</span></>}/>
        <Info label="วิกฤติ" value={<><span className="badge red">{tires.filter(t => t.status === "critical").length} เส้น</span></>}/>
      </div>
      <table className="tbl">
        <thead><tr><th>ตำแหน่ง</th><th>ยี่ห้อ/รุ่น</th><th>ขนาด</th><th>วันติดตั้ง</th><th>km</th><th>ดอกยาง (mm)</th><th>สถานะ</th></tr></thead>
        <tbody>
          {tires.map(t => (
            <tr key={t.id}>
              <td><span className="mono" style={{ fontWeight: 600 }}>{t.position}</span></td>
              <td>{t.brand}</td>
              <td className="mono">{t.size}</td>
              <td className="num muted">{t.install}</td>
              <td className="num">{D.fmt(t.km)}</td>
              <td className="num" style={{ fontWeight: 600, color: t.status === "critical" ? "var(--red)" : t.status === "warning" ? "var(--amber)" : "var(--green)" }}>{t.depth}</td>
              <td><StatusBadge status={t.status}/></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ============== EMPLOYEES ==============
function EmployeesPage({ setActive, setSubject }) {
  const D = window.KPSData;
  const [q, setQ] = useStateFleet("");
  const employees = D.getAll("employees");
  const filtered = employees.filter(e => !q || e.name.toLowerCase().includes(q.toLowerCase()) || e.code.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">ข้อมูลพนักงาน</h1>
          <div className="page-sub">{employees.length} คน • ปฏิบัติงาน {employees.filter(e => e.status === "active").length} คน</div>
        </div>
        <div className="actions">
          <button className="btn"><Icon name="download" size={15}/> ส่งออก</button>
          <button className="btn primary" onClick={() => setActive("employees.add")}><Icon name="plus" size={15}/> เพิ่มพนักงาน</button>
        </div>
      </div>

      <div className="toolbar">
        <div style={{ position: "relative" }}>
          <Icon name="search" size={15} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)" }}/>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาชื่อ, รหัสพนักงาน..."
            style={{ height: 36, padding: "0 12px 0 34px", width: 280, border: "1px solid var(--line)", borderRadius: 8, background: "#fff", fontSize: 13 }}/>
        </div>
        <div className="spacer"/>
        <span className="muted mono" style={{ fontSize: 12 }}>{filtered.length} รายการ</span>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>พนักงาน</th>
              <th>รหัส</th>
              <th>ตำแหน่ง</th>
              <th>ใบขับขี่</th>
              <th>วันหมด</th>
              <th>รถประจำ</th>
              <th>เริ่มงาน</th>
              <th>สถานะ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(e => {
              const v = D.get("vehicles", e.vehicleId);
              return (
                <tr key={e.id}>
                  <td>
                    <div className="row" style={{ gap: 10 }}>
                      <div className="avatar sm">{e.name.split(" ").map(s => s[0]).slice(0,2).join("")}</div>
                      <div>
                        <div style={{ fontWeight: 500 }}>{e.name}</div>
                        <div className="muted" style={{ fontSize: 11.5 }}>{e.phone}</div>
                      </div>
                    </div>
                  </td>
                  <td className="mono muted">{e.code}</td>
                  <td>{e.position}</td>
                  <td className="mono">{e.license}</td>
                  <td className="num muted">{e.licenseExpire}</td>
                  <td>{v ? <span className="mono badge gray">{v.plate}</span> : <span className="faint">—</span>}</td>
                  <td className="num muted">{e.joined}</td>
                  <td><StatusBadge status={e.status}/></td>
                  <td><button className="btn ghost icon sm" onClick={ev => ev.stopPropagation()}><Icon name="more" size={16}/></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmployeeAdd({ setActive }) {
  const D = window.KPSData;
  const [form, setForm] = useStateFleet({ name: "", code: "EMP-" + String(D.getAll("employees").length + 1).padStart(3, "0"), position: "พนักงานขับรถ", license: "", phone: "", salary: 17000, joined: "", licenseExpire: "", status: "active", vehicleId: null });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const save = () => {
    if (!form.name || !form.phone) { alert("กรุณากรอกชื่อและเบอร์โทร"); return; }
    D.add("employees", { ...form, salary: +form.salary });
    setActive("employees");
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="row" style={{ gap: 6, color: "var(--text-muted)", fontSize: 12, marginBottom: 4 }}>
            <span style={{ cursor: "pointer" }} onClick={() => setActive("employees")}>← ข้อมูลพนักงาน</span>
          </div>
          <h1 className="page-title">เพิ่มพนักงานใหม่</h1>
          <div className="page-sub">ข้อมูลส่วนตัว ตำแหน่ง ใบขับขี่ และเงินเดือน</div>
        </div>
      </div>

      <div className="card pad" style={{ maxWidth: 880 }}>
        <h3 className="section-title">ข้อมูลทั่วไป</h3>
        <div className="grid-2" style={{ marginBottom: 16 }}>
          <Field label="ชื่อ-นามสกุล *"><input value={form.name} onChange={e => set("name", e.target.value)} placeholder="เช่น สมชาย ขยันงาน"/></Field>
          <Field label="รหัสพนักงาน"><input value={form.code} onChange={e => set("code", e.target.value)}/></Field>
          <Field label="ตำแหน่ง">
            <select value={form.position} onChange={e => set("position", e.target.value)}>
              <option>พนักงานขับรถ</option>
              <option>ผู้ช่วยขับรถ</option>
              <option>ผู้จัดการขนส่ง</option>
              <option>ช่าง</option>
              <option>เจ้าหน้าที่บัญชี</option>
            </select>
          </Field>
          <Field label="เบอร์โทร *"><input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="08X-XXX-XXXX"/></Field>
          <Field label="วันที่เริ่มงาน"><input type="date" value={form.joined} onChange={e => set("joined", e.target.value)}/></Field>
          <Field label="เงินเดือน (บาท)"><input type="number" value={form.salary} onChange={e => set("salary", e.target.value)}/></Field>
        </div>

        <h3 className="section-title" style={{ marginTop: 22 }}>ใบขับขี่</h3>
        <div className="grid-2">
          <Field label="ประเภท / เลขที่"><input value={form.license} onChange={e => set("license", e.target.value)} placeholder="ท.4 / B-XXXXX"/></Field>
          <Field label="วันที่หมดอายุ"><input type="date" value={form.licenseExpire} onChange={e => set("licenseExpire", e.target.value)}/></Field>
        </div>

        <div className="row" style={{ marginTop: 22, justifyContent: "flex-end", gap: 8 }}>
          <button className="btn" onClick={() => setActive("employees")}>ยกเลิก</button>
          <button className="btn primary" onClick={save}><Icon name="check" size={15}/> บันทึก</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { VehiclesPage, VehicleAdd, VehicleDetail, EmployeesPage, EmployeeAdd, Info });
