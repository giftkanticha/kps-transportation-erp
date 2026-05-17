// pages-revamp-fleet.jsx — Revamped Vehicles + Employees (replaces older versions)
const { useState: useStateRF } = React;

// ============== VEHICLES — LIST ==============
function VehiclesPageV2({ setActive, setSubject }) {
  const D = window.KPSData;
  const vehicles = D.getAll("vehicles");
  const [q, setQ] = useStateRF("");
  const [filterStatus, setFilterStatus] = useStateRF({ available: true, maintenance: true, unavailable: true });
  const [filterType, setFilterType] = useStateRF({ all: true, "4ล้อ": false, "10ล้อ": false });

  // Determine if vehicle is in the user-facing filter buckets
  const inStatusBucket = (v) => {
    if (v.status === "available") return filterStatus.available;
    if (v.status === "maintenance") return filterStatus.maintenance;
    // warning / on-trip etc → ไม่พร้อม bucket
    return filterStatus.unavailable;
  };
  const inTypeBucket = (v) => {
    if (filterType.all) return true;
    if (filterType["4ล้อ"] && v.type.includes("4")) return true;
    if (filterType["10ล้อ"] && (v.type.includes("10") || v.type.includes("18"))) return true;
    return false;
  };

  const filtered = vehicles.filter(v => {
    if (q && !v.plate.toLowerCase().includes(q.toLowerCase()) && !v.brand.toLowerCase().includes(q.toLowerCase()) && !v.type.includes(q)) return false;
    if (!inStatusBucket(v)) return false;
    if (!inTypeBucket(v)) return false;
    return true;
  });

  // Days until expiry helper
  const daysTo = (s) => { if (!s) return null; const d = new Date(s); const today = new Date("2026-05-17"); return Math.round((d - today) / (1000*60*60*24)); };
  const docWarn = (v) => {
    const dts = ["tax","insurance","dispatchPermit"].map(k => ({ k, d: daysTo(v[k]) })).filter(x => x.d !== null && x.d <= 60);
    if (!dts.length) return null;
    const min = dts.sort((a,b) => a.d - b.d)[0];
    const labels = { tax: "ภาษี", insurance: "ประกัน", dispatchPermit: "ใบอนุญาต" };
    if (min.d < 0) return { text: `${labels[min.k]}: หมดอายุแล้ว`, color: "var(--red)" };
    return { text: `${labels[min.k]}: ${min.d} วัน`, color: min.d <= 30 ? "var(--red)" : "var(--amber)" };
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">รายการรถ</h1>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={() => setActive("vehicles.add")}>
            <Icon name="plus" size={15}/> เพิ่มรถใหม่
          </button>
        </div>
      </div>

      <div className="card">
        {/* Filter + search row */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 240 }}>
            <Icon name="search" size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)" }}/>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาตามทะเบียน / ยี่ห้อ / สถานะ"
              style={{ width: "100%", height: 38, padding: "0 12px 0 36px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--bg)", fontSize: 13 }}/>
          </div>
          <FilterCheckGroup label="สถานะ" options={[
            { k: "available", l: "พร้อม", color: "var(--green)" },
            { k: "maintenance", l: "ซ่อม", color: "var(--amber)" },
            { k: "unavailable", l: "ไม่พร้อม", color: "var(--red)" },
          ]} state={filterStatus} onChange={setFilterStatus}/>
          <FilterCheckGroup label="ประเภท" options={[
            { k: "all", l: "ทั้งหมด" },
            { k: "4ล้อ", l: "4ล้อ" },
            { k: "10ล้อ", l: "10ล้อ" },
          ]} state={filterType} onChange={setFilterType}/>
        </div>

        <div className="tbl-wrap" style={{ border: "none", borderRadius: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>ทะเบียน</th>
                <th>ยี่ห้อ/รุ่น</th>
                <th>ประเภท</th>
                <th>สถานะ</th>
                <th>คนขับ</th>
                <th className="right">เลขไมล์</th>
                <th>ข้อมูลหมดอายุ</th>
                <th>ดำเนิน</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(v => {
                const dr = D.get("employees", v.driverId);
                const dw = docWarn(v);
                return (
                  <tr key={v.id} onClick={() => { setSubject({ type: "vehicle", id: v.id }); setActive("vehicles.detail"); }}>
                    <td><a style={{ color: "var(--primary)", fontWeight: 600 }} className="mono">{v.plate}</a></td>
                    <td>{v.brand}</td>
                    <td>{v.type}</td>
                    <td><StatusBadge status={v.status}/></td>
                    <td>{dr ? dr.name : "-"}</td>
                    <td className="num right">{D.fmt(v.odometer)}</td>
                    <td>{dw ? <span style={{ color: dw.color, fontSize: 12.5 }}>{dw.text}</span> : "-"}</td>
                    <td><button className="btn ghost icon sm" onClick={e => e.stopPropagation()}><Icon name="more" size={16}/></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", color: "var(--text-muted)", fontSize: 12.5 }}>
          <span>แสดง 1 ถึง {filtered.length} จากทั้งหมด {filtered.length} รายการ</span>
          <div className="spacer"/>
          <div className="row" style={{ gap: 4 }}>
            <button className="btn sm" disabled>ก่อนหน้า</button>
            <button className="btn sm primary">1</button>
            <button className="btn sm" disabled>ถัดไป</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const FilterCheckGroup = ({ label, options, state, onChange }) => (
  <div className="row" style={{ gap: 14, alignItems: "center" }}>
    <span className="muted" style={{ fontWeight: 600, fontSize: 13 }}>{label}:</span>
    {options.map(o => (
      <label key={o.k} className="row" style={{ gap: 6, cursor: "pointer", fontSize: 13, userSelect: "none" }}>
        <input type="checkbox" checked={!!state[o.k]} onChange={() => onChange({...state, [o.k]: !state[o.k]})} style={{ accentColor: o.color || "var(--primary)" }}/>
        <span style={{ color: o.color || "var(--text-2)", fontWeight: 500 }}>{o.l}</span>
      </label>
    ))}
  </div>
);

// ============== VEHICLES — ADD ==============
function VehicleAddV2({ setActive }) {
  const D = window.KPSData;
  const [form, setForm] = useStateRF({
    plate: "", brand: "", year: "", type: "10ล้อ", status: "available", driverId: "",
    odometer: 0, nextServiceKm: "",
    purchaseDate: "", tax: "", insurance: "", dispatchPermit: "",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const save = () => {
    if (!form.plate || !form.brand) { alert("กรุณากรอกทะเบียนและยี่ห้อ"); return; }
    D.add("vehicles", {
      ...form,
      odometer: +form.odometer || 0,
      nextServiceKm: +form.nextServiceKm || 0,
      year: +form.year || null,
      driverId: form.driverId || null,
      fuel: 100,
      lastService: "",
      nextService: "",
    });
    setActive("vehicles");
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="row" style={{ gap: 4, color: "var(--text-muted)", fontSize: 14, marginBottom: 4, cursor: "pointer" }} onClick={() => setActive("vehicles")}>
            <Icon name="arrow-right" size={15} style={{ transform: "rotate(180deg)" }}/>
          </div>
          <h1 className="page-title">เพิ่มรถใหม่</h1>
          <div className="page-sub">บันทึกข้อมูลรถคันใหม่เข้าระบบ</div>
        </div>
      </div>

      <div className="col" style={{ gap: 16 }}>
        {/* ─── ข้อมูลทั่วไป ─── */}
        <div className="card pad">
          <div className="row" style={{ marginBottom: 16 }}>
            <span style={{ color: "var(--primary)" }}><Icon name="truck" size={20}/></span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>ข้อมูลทั่วไป</h3>
          </div>
          <div className="grid-3" style={{ gap: 14, marginBottom: 14 }}>
            <Field label="ทะเบียนรถ *"><input value={form.plate} onChange={e => set("plate", e.target.value)} placeholder="เช่น ABC-1234"/></Field>
            <Field label="ยี่ห้อ *"><input value={form.brand} onChange={e => set("brand", e.target.value)} placeholder="เช่น Isuzu, Hino"/></Field>
            <Field label="รุ่น / ปี"><input value={form.year} onChange={e => set("year", e.target.value)} placeholder="เช่น FVR 2018"/></Field>
          </div>
          <div className="grid-3" style={{ gap: 14 }}>
            <Field label="ประเภทรถ *">
              <select value={form.type} onChange={e => set("type", e.target.value)}>
                <option>4ล้อ</option>
                <option>6ล้อ</option>
                <option>10ล้อ</option>
                <option>18ล้อ</option>
                <option>ตู้คอนเทนเนอร์</option>
                <option>พ่วงข้าง</option>
              </select>
            </Field>
            <Field label="สถานะเริ่มต้น">
              <select value={form.status} onChange={e => set("status", e.target.value)}>
                <option value="available">พร้อมใช้งาน</option>
                <option value="maintenance">ซ่อมบำรุง</option>
                <option value="unavailable">ไม่พร้อม</option>
              </select>
            </Field>
            <Field label="คนขับประจำรถ">
              <select value={form.driverId} onChange={e => set("driverId", e.target.value)}>
                <option value="">-- ยังไม่ระบุ --</option>
                {D.getAll("employees").filter(e => e.position === "คนขับ" && !e.vehicleId).map(e => <option key={e.id} value={e.id}>{e.name} ({e.code})</option>)}
              </select>
            </Field>
          </div>
        </div>

        {/* ─── ข้อมูลระยะทาง ─── */}
        <div className="card pad">
          <div className="row" style={{ marginBottom: 16 }}>
            <span style={{ color: "var(--primary)" }}><Icon name="gauge" size={20}/></span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>ข้อมูลระยะทาง</h3>
          </div>
          <div className="grid-2" style={{ gap: 14 }}>
            <Field label="เลขไมล์ปัจจุบัน (km) *"><input type="number" value={form.odometer} onChange={e => set("odometer", e.target.value)} placeholder="0"/></Field>
            <Field label="ระยะทางเข้าศูนย์บริการถัดไป (km)"><input type="number" value={form.nextServiceKm} onChange={e => set("nextServiceKm", e.target.value)} placeholder="เช่น 10000"/></Field>
          </div>
        </div>

        {/* ─── วันหมดอายุ และ เอกสาร ─── */}
        <div className="card pad">
          <div className="row" style={{ marginBottom: 16 }}>
            <span style={{ color: "var(--primary)" }}><Icon name="calendar" size={20}/></span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>วันหมดอายุ และ เอกสาร</h3>
          </div>
          <div className="grid-4" style={{ gap: 14 }}>
            <Field label="วันที่ซื้อรถ"><input type="date" value={form.purchaseDate} onChange={e => set("purchaseDate", e.target.value)}/></Field>
            <Field label="วันหมดอายุภาษี"><input type="date" value={form.tax} onChange={e => set("tax", e.target.value)}/></Field>
            <Field label="วันหมดอายุประกันภัย"><input type="date" value={form.insurance} onChange={e => set("insurance", e.target.value)}/></Field>
            <Field label="วันหมดอายุใบอนุญาตขนส่ง"><input type="date" value={form.dispatchPermit} onChange={e => set("dispatchPermit", e.target.value)}/></Field>
          </div>
        </div>
      </div>

      <div className="row" style={{ marginTop: 20, justifyContent: "flex-end", gap: 8 }}>
        <button className="btn" onClick={() => setActive("vehicles")}><Icon name="close" size={15}/> ยกเลิก</button>
        <button className="btn primary" onClick={save}>💾 บันทึกข้อมูลรถ</button>
      </div>
    </div>
  );
}

// ============== EMPLOYEES — LIST ==============
function EmployeesPageV2({ setActive }) {
  const D = window.KPSData;
  const all = D.getAll("employees");
  const [q, setQ] = useStateRF("");
  const [filterStatus, setFilterStatus] = useStateRF({ active: true, leave: false });

  const inBucket = (e) => (filterStatus.active && (e.status === "active" || e.status === "training")) || (filterStatus.leave && e.status === "leave");
  const filtered = all.filter(e => {
    if (q && !e.name.toLowerCase().includes(q.toLowerCase()) && !e.code.toLowerCase().includes(q.toLowerCase()) && !e.phone.includes(q)) return false;
    if (!inBucket(e)) return false;
    return true;
  });

  const licenseLabel = (s, exp) => {
    if (s === "ok") return <span className="badge green"><span className="sdot green"></span>ถูกต้อง</span>;
    if (s === "expired") return <span className="badge red"><span className="sdot red"></span>หมดอายุ</span>;
    // warning — show countdown
    const today = new Date("2026-05-17");
    const d = new Date(exp);
    const days = Math.round((d - today) / (1000*60*60*24));
    return <span className="badge amber"><span className="sdot amber"></span>{days} วัน</span>;
  };

  return (
    <div>
      <div className="page-head">
        <div><h1 className="page-title">รายชื่อพนักงาน</h1></div>
        <div className="actions">
          <button className="btn primary" onClick={() => setActive("employees.add")}><Icon name="plus" size={15}/> เพิ่มพนักงานใหม่</button>
        </div>
      </div>

      <div className="card">
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 240 }}>
            <Icon name="search" size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)" }}/>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหา: ชื่อ / เบอร์โทร / ID"
              style={{ width: "100%", height: 38, padding: "0 12px 0 36px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--bg)", fontSize: 13 }}/>
          </div>
          <FilterCheckGroup label="สถานะ" options={[
            { k: "active", l: "ทำงาน", color: "var(--green)" },
            { k: "leave", l: "ลาออก", color: "var(--red)" },
          ]} state={filterStatus} onChange={setFilterStatus}/>
        </div>

        <div className="tbl-wrap" style={{ border: "none", borderRadius: 0 }}>
          <table className="tbl">
            <thead><tr>
              <th>เลขที่ ID</th>
              <th>ชื่อ-สกุล</th>
              <th>ตำแหน่ง</th>
              <th>เบอร์โทร</th>
              <th>Line</th>
              <th>วันเริ่มงาน</th>
              <th>ใบขับขี่</th>
              <th>สถานะ</th>
              <th>ดำเนิน</th>
            </tr></thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id}>
                  <td><span className="mono" style={{ fontWeight: 600 }}>{e.code}</span></td>
                  <td style={{ fontWeight: 500 }}>{e.name}</td>
                  <td>{e.position}</td>
                  <td className="mono">{e.phone.replace(/\d(?=\d{4})/g, c => Math.random() > 0.5 ? c : c).replace(/(\d{3})(\d{3})(\d{4})/, "0$1-$2-$3").replace(/\d{4}/g, "XXXX").replace(/(\d{3})-(\d{3})/, "08X-$2")}</td>
                  <td><a style={{ color: "var(--primary)" }}>{e.lineId}</a></td>
                  <td className="num muted">{e.joined ? D.thaiDate(e.joined) : "—"}</td>
                  <td>{licenseLabel(e.licenseStatus, e.licenseExpire)}</td>
                  <td>{e.status === "leave" ? <span className="badge red">ลาออก</span> : <span className="badge green"><span className="sdot green"></span>ทำงาน</span>}</td>
                  <td><button className="btn ghost icon sm"><Icon name="more" size={16}/></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============== EMPLOYEES — ADD ==============
function EmployeeAddV2({ setActive }) {
  const D = window.KPSData;
  const next = String(D.getAll("employees").length + 1).padStart(3, "0");
  const [form, setForm] = useStateRF({
    code: "E" + next, name: "", position: "คนขับ", status: "active",
    phone: "", lineId: "", joined: "", licenseStatus: "ok",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const save = () => {
    if (!form.name || !form.phone) { alert("กรุณากรอกชื่อและเบอร์โทร"); return; }
    D.add("employees", { ...form, license: "", licenseExpire: "", salary: 17000, vehicleId: null, idCard: "", accountBank: "", accountNo: "" });
    setActive("employees");
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="row" style={{ gap: 4, color: "var(--text-muted)", fontSize: 14, marginBottom: 4, cursor: "pointer" }} onClick={() => setActive("employees")}>
            <Icon name="arrow-right" size={15} style={{ transform: "rotate(180deg)" }}/>
          </div>
          <h1 className="page-title">เพิ่มพนักงานใหม่</h1>
          <div className="page-sub">บันทึกข้อมูลพนักงานเข้าระบบ</div>
        </div>
      </div>

      <div className="col" style={{ gap: 16 }}>
        <div className="card pad">
          <div className="row" style={{ marginBottom: 16 }}>
            <span style={{ color: "var(--primary)" }}><Icon name="user" size={20}/></span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>ข้อมูลส่วนตัว</h3>
          </div>
          <div className="grid-3" style={{ gap: 14, marginBottom: 14 }}>
            <Field label="เลขที่ ID *"><input value={form.code} onChange={e => set("code", e.target.value)} placeholder="เช่น E003"/></Field>
            <Field label="ชื่อ-สกุล *"><input value={form.name} onChange={e => set("name", e.target.value)} placeholder="เช่น สมชาย ใจดี"/></Field>
            <Field label="ตำแหน่ง *">
              <select value={form.position} onChange={e => set("position", e.target.value)}>
                <option>คนขับ</option>
                <option>ช่าง</option>
                <option>ผู้จัดการขนส่ง</option>
                <option>ผู้ดูแลระบบ</option>
                <option>เจ้าหน้าที่บัญชี</option>
              </select>
            </Field>
          </div>
          <Field label="สถานะ *">
            <select value={form.status} onChange={e => set("status", e.target.value)} style={{ maxWidth: 320 }}>
              <option value="active">ทำงาน</option>
              <option value="leave">ลาออก</option>
              <option value="training">อบรม</option>
            </select>
          </Field>
        </div>

        <div className="card pad">
          <div className="row" style={{ marginBottom: 16 }}>
            <span style={{ color: "var(--primary)" }}><Icon name="phone" size={20}/></span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>ข้อมูลการติดต่อ</h3>
          </div>
          <div className="grid-2" style={{ gap: 14 }}>
            <Field label="เบอร์โทรศัพท์ *"><input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="เช่น 0812345678"/></Field>
            <Field label="Line ID (ไม่บังคับ)"><input value={form.lineId} onChange={e => set("lineId", e.target.value)} placeholder="เช่น @somchai"/></Field>
          </div>
        </div>

        <div className="card pad">
          <div className="row" style={{ marginBottom: 16 }}>
            <span style={{ color: "var(--primary)" }}><Icon name="check" size={20}/></span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>เอกสารและวันเริ่มงาน</h3>
          </div>
          <div className="grid-2" style={{ gap: 14 }}>
            <Field label="วันเริ่มงาน *"><input type="date" value={form.joined} onChange={e => set("joined", e.target.value)}/></Field>
            <Field label="สถานะใบขับขี่">
              <select value={form.licenseStatus} onChange={e => set("licenseStatus", e.target.value)}>
                <option value="ok">ถูกต้อง (ยังไม่หมดอายุ)</option>
                <option value="warning">ใกล้หมดอายุ</option>
                <option value="expired">หมดอายุแล้ว</option>
              </select>
            </Field>
          </div>
        </div>
      </div>

      <div className="row" style={{ marginTop: 20, justifyContent: "flex-end", gap: 8 }}>
        <button className="btn" onClick={() => setActive("employees")}><Icon name="close" size={15}/> ยกเลิก</button>
        <button className="btn primary" onClick={save}>💾 บันทึกข้อมูล</button>
      </div>
    </div>
  );
}

// Override existing exports
Object.assign(window, {
  VehiclesPage: VehiclesPageV2,
  VehicleAdd: VehicleAddV2,
  EmployeesPage: EmployeesPageV2,
  EmployeeAdd: EmployeeAddV2,
  FilterCheckGroup,
});
