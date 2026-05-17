// pages-ops.jsx — Dispatch, Tires, Fuel modules
const { useState: useStateOps } = React;

// ============== DISPATCH (งานขนส่ง) ==============
function DispatchPage({ setActive, setSubject }) {
  const D = window.KPSData;
  const [q, setQ] = useStateOps("");
  const [filter, setFilter] = useStateOps("all");
  const all = D.getAll("dispatch");
  const list = all.filter(t => (filter === "all" || t.status === filter) && (!q || t.code.toLowerCase().includes(q.toLowerCase()) || t.origin.includes(q) || t.destination.includes(q)));
  const counts = {
    all: all.length,
    "scheduled": all.filter(t => t.status === "scheduled").length,
    "in-transit": all.filter(t => t.status === "in-transit").length,
    "delivered": all.filter(t => t.status === "delivered").length,
    "cancelled": all.filter(t => t.status === "cancelled").length,
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">งานขนส่ง</h1>
          <div className="page-sub">รายการงานขนส่งทั้งหมด {all.length} งาน • รายได้รวม {D.thb(all.reduce((s,t) => s + (t.revenue||0), 0))}</div>
        </div>
        <div className="actions">
          <button className="btn"><Icon name="download" size={15}/> ส่งออก</button>
          <button className="btn primary" onClick={() => setActive("dispatch.open")}><Icon name="plus" size={15}/> เปิดงานใหม่</button>
        </div>
      </div>

      <div className="toolbar">
        <div style={{ position: "relative" }}>
          <Icon name="search" size={15} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)" }}/>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหารหัสงาน, ต้นทาง, ปลายทาง..."
            style={{ height: 36, padding: "0 12px 0 34px", width: 320, border: "1px solid var(--line)", borderRadius: 8, background: "#fff", fontSize: 13 }}/>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {[["all","ทั้งหมด"],["scheduled","นัดหมาย"],["in-transit","กำลังขนส่ง"],["delivered","ส่งสำเร็จ"],["cancelled","ยกเลิก"]].map(([k,l]) => (
            <button key={k} className={`chip ${filter === k ? "active" : ""}`} onClick={() => setFilter(k)}>
              {l} <span className="mono" style={{ opacity: .7 }}>{counts[k]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>รหัสงาน</th>
              <th>ลูกค้า</th>
              <th>เส้นทาง</th>
              <th>สินค้า</th>
              <th>คนขับ / รถ</th>
              <th>ออกเดินทาง</th>
              <th>คาดถึง</th>
              <th className="right">ระยะ</th>
              <th className="right">รายได้</th>
              <th>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {list.map(t => {
              const cu = D.get("customers", t.customerId);
              const dr = D.get("employees", t.driverId);
              const v = D.get("vehicles", t.vehicleId);
              const sc = D.get("subcontractors", t.subcontractorId);
              return (
                <tr key={t.id}>
                  <td><span className="mono" style={{ fontWeight: 600 }}>{t.code}</span></td>
                  <td>
                    <div style={{ fontSize: 13 }}>{cu?.name?.replace("บริษัท ","").replace(" จำกัด","") || "—"}</div>
                    <div className="muted mono" style={{ fontSize: 11 }}>{cu?.code}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: 13 }}>{t.origin}</div>
                    <div className="muted" style={{ fontSize: 11.5 }}>→ {t.destination}</div>
                  </td>
                  <td><div className="muted" style={{ fontSize: 12.5 }}>{t.cargo}</div></td>
                  <td>
                    {sc ? (
                      <div>
                        <div className="row" style={{ gap: 6 }}><Icon name="truck" size={14} style={{ color: "var(--violet)" }}/><span className="badge violet" style={{ fontSize: 10.5 }}>รถร่วม</span></div>
                        <div className="muted" style={{ fontSize: 11.5 }}>{sc.name}</div>
                      </div>
                    ) : (
                      <>
                        <div style={{ fontSize: 12.5 }}>{dr?.name || <span className="faint">— ไม่ระบุ —</span>}</div>
                        <div className="muted mono" style={{ fontSize: 11 }}>{v?.plate || ""}</div>
                      </>
                    )}
                  </td>
                  <td className="num muted" style={{ fontSize: 12 }}>{t.depart}</td>
                  <td className="num muted" style={{ fontSize: 12 }}>{t.eta}</td>
                  <td className="num right">{t.distance} km</td>
                  <td className="num right" style={{ fontWeight: 600 }}>{D.thb(t.revenue)}</td>
                  <td>
                    <StatusBadge status={t.status}/>
                    {t.status === "in-transit" && (
                      <div className="row" style={{ marginTop: 4, gap: 4 }}>
                        <div className="progress" style={{ width: 60, height: 4 }}><div className="fill" style={{ width: t.progress + "%" }}/></div>
                        <span className="mono" style={{ fontSize: 10, color: "var(--text-faint)" }}>{t.progress}%</span>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DispatchOpen({ setActive }) {
  const D = window.KPSData;
  const [form, setForm] = useStateOps({
    code: "DSP-" + new Date().toISOString().slice(2,10).replace(/-/g,"") + "-NEW",
    customerId: "",
    driverId: "",
    vehicleId: "",
    subcontractorId: "",
    useSubcontractor: false,
    origin: "",
    destination: "",
    cargo: "",
    weight: "",
    revenue: "",
    distance: "",
    depart: "",
    eta: "",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const save = () => {
    if (!form.customerId || !form.origin || !form.destination) { alert("กรุณากรอกข้อมูลที่จำเป็น"); return; }
    D.add("dispatch", {
      ...form,
      cargo: form.cargo + (form.weight ? " • " + form.weight + " ตัน" : ""),
      revenue: +form.revenue || 0,
      cost: 0,
      distance: +form.distance || 0,
      status: "scheduled",
      progress: 0,
      driverId: form.useSubcontractor ? null : form.driverId || null,
      vehicleId: form.useSubcontractor ? null : form.vehicleId || null,
      subcontractorId: form.useSubcontractor ? form.subcontractorId || null : null,
    });
    setActive("dispatch");
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="row" style={{ gap: 6, color: "var(--text-muted)", fontSize: 12, marginBottom: 4 }}>
            <span style={{ cursor: "pointer" }} onClick={() => setActive("dispatch")}>← งานขนส่ง</span>
          </div>
          <h1 className="page-title">เปิดงานขนส่งใหม่</h1>
          <div className="page-sub">สร้างงานใหม่ มอบหมายให้รถบริษัทหรือรถรับจ้างร่วม</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <div className="col" style={{ gap: 16 }}>
          <div className="card pad">
            <h3 className="section-title">ข้อมูลลูกค้า</h3>
            <div className="grid-2">
              <Field label="รหัสงาน"><input value={form.code} onChange={e => set("code", e.target.value)}/></Field>
              <Field label="ลูกค้า *">
                <select value={form.customerId} onChange={e => set("customerId", e.target.value)}>
                  <option value="">— เลือกลูกค้า —</option>
                  {D.getAll("customers").map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            </div>
          </div>

          <div className="card pad">
            <h3 className="section-title">เส้นทางและสินค้า</h3>
            <div className="grid-2" style={{ marginBottom: 14 }}>
              <Field label="ต้นทาง *"><input value={form.origin} onChange={e => set("origin", e.target.value)} placeholder="เช่น ระยอง / Map Ta Phut"/></Field>
              <Field label="ปลายทาง *"><input value={form.destination} onChange={e => set("destination", e.target.value)} placeholder="เช่น ลาดกระบัง ICD"/></Field>
              <Field label="ประเภทสินค้า"><input value={form.cargo} onChange={e => set("cargo", e.target.value)} placeholder="เช่น เคมีภัณฑ์"/></Field>
              <Field label="น้ำหนัก (ตัน)"><input type="number" value={form.weight} onChange={e => set("weight", e.target.value)}/></Field>
              <Field label="ระยะทาง (km)"><input type="number" value={form.distance} onChange={e => set("distance", e.target.value)}/></Field>
              <Field label="รายได้ตกลง (บาท)"><input type="number" value={form.revenue} onChange={e => set("revenue", e.target.value)}/></Field>
            </div>
            <div className="grid-2">
              <Field label="เวลาออกเดินทาง"><input type="datetime-local" value={form.depart} onChange={e => set("depart", e.target.value)}/></Field>
              <Field label="คาดว่าจะถึง"><input type="datetime-local" value={form.eta} onChange={e => set("eta", e.target.value)}/></Field>
            </div>
          </div>

          <div className="card pad">
            <div className="row" style={{ marginBottom: 14 }}>
              <h3 className="section-title" style={{ margin: 0 }}>การมอบหมาย</h3>
              <div className="spacer"/>
              <div className="row" style={{ gap: 4, background: "var(--bg-sunk)", padding: 4, borderRadius: 8 }}>
                <button className={`chip ${!form.useSubcontractor ? "active" : ""}`} onClick={() => set("useSubcontractor", false)} style={{ border: "none" }}>รถบริษัท</button>
                <button className={`chip ${form.useSubcontractor ? "active" : ""}`} onClick={() => set("useSubcontractor", true)} style={{ border: "none" }}>รถรับจ้างร่วม</button>
              </div>
            </div>
            {!form.useSubcontractor ? (
              <div className="grid-2">
                <Field label="คนขับ">
                  <select value={form.driverId} onChange={e => set("driverId", e.target.value)}>
                    <option value="">— ไม่ระบุ —</option>
                    {D.getAll("employees").filter(e => e.position.includes("ขับ") && e.status === "active").map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </Field>
                <Field label="รถ">
                  <select value={form.vehicleId} onChange={e => set("vehicleId", e.target.value)}>
                    <option value="">— ไม่ระบุ —</option>
                    {D.getAll("vehicles").filter(v => v.status !== "maintenance").map(v => <option key={v.id} value={v.id}>{v.plate} • {v.brand}</option>)}
                  </select>
                </Field>
              </div>
            ) : (
              <Field label="ผู้รับจ้าง">
                <select value={form.subcontractorId} onChange={e => set("subcontractorId", e.target.value)}>
                  <option value="">— เลือกผู้รับจ้าง —</option>
                  {D.getAll("subcontractors").map(s => <option key={s.id} value={s.id}>{s.name} (rating {s.rating})</option>)}
                </select>
              </Field>
            )}
          </div>
        </div>

        <div className="col" style={{ gap: 16 }}>
          <div className="card pad">
            <h3 className="section-title">สรุป</h3>
            <div className="col" style={{ gap: 12 }}>
              <Info label="ลูกค้า" value={D.nameOf("customers", form.customerId) || "—"}/>
              <Info label="เส้นทาง" value={form.origin || form.destination ? `${form.origin || "?"} → ${form.destination || "?"}` : "—"}/>
              <Info label="ระยะทาง" value={form.distance ? form.distance + " km" : "—"}/>
              <Info label="รายได้" value={form.revenue ? D.thb(form.revenue) : "—"}/>
              <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                <Info label="ประมาณกำไรขั้นต้น" value={form.revenue ? <span style={{ color: "var(--green)", fontWeight: 600 }}>{D.thb((+form.revenue) * 0.55)}</span> : "—"}/>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row" style={{ marginTop: 20, justifyContent: "flex-end", gap: 8 }}>
        <button className="btn" onClick={() => setActive("dispatch")}>ยกเลิก</button>
        <button className="btn primary" onClick={save}><Icon name="check" size={15}/> เปิดงาน</button>
      </div>
    </div>
  );
}

function DispatchReport() {
  const D = window.KPSData;
  const all = D.getAll("dispatch");
  const byStatus = ["scheduled","in-transit","delivered","cancelled"].map(k => ({ k, n: all.filter(t => t.status === k).length, rev: all.filter(t => t.status === k).reduce((s,t) => s + (t.revenue||0), 0) }));
  const byCustomer = {};
  all.forEach(t => { byCustomer[t.customerId] = (byCustomer[t.customerId] || 0) + (t.revenue || 0); });
  const top = Object.entries(byCustomer).sort((a,b) => b[1] - a[1]).slice(0, 5);
  const totalRev = all.reduce((s,t) => s + (t.revenue||0), 0);
  const totalKm = all.reduce((s,t) => s + (t.distance||0), 0);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">รายงานสรุปงานขนส่ง</h1>
          <div className="page-sub">สถิติงานขนส่ง ลูกค้า และรายได้</div>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 16 }}>
        <div className="card kpi"><div className="label">งานทั้งหมด</div><div className="row"><div className="icn-box"><Icon name="package" size={18}/></div><div className="value">{all.length}<span className="unit">งาน</span></div></div></div>
        <div className="card kpi"><div className="label">รายได้รวม</div><div className="row"><div className="icn-box green"><Icon name="money" size={18}/></div><div className="value">{D.thb(totalRev)}</div></div></div>
        <div className="card kpi"><div className="label">ระยะทางรวม</div><div className="row"><div className="icn-box teal"><Icon name="gauge" size={18}/></div><div className="value">{D.fmt(totalKm)}<span className="unit">km</span></div></div></div>
        <div className="card kpi"><div className="label">รายได้/km เฉลี่ย</div><div className="row"><div className="icn-box amber"><Icon name="chart" size={18}/></div><div className="value">{D.thb(totalRev/totalKm)}</div></div></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="card pad">
          <h3 className="section-title">งานแยกตามสถานะ</h3>
          <div className="col" style={{ gap: 12 }}>
            {byStatus.map(b => (
              <div key={b.k} className="row">
                <StatusBadge status={b.k}/>
                <div className="spacer"/>
                <div className="mono" style={{ fontWeight: 600, fontSize: 14 }}>{b.n}</div>
                <div className="muted mono" style={{ fontSize: 12, minWidth: 100, textAlign: "right" }}>{D.thb(b.rev)}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card pad">
          <h3 className="section-title">Top 5 ลูกค้า (รายได้)</h3>
          <div className="col" style={{ gap: 10 }}>
            {top.map(([cid, rev]) => {
              const c = D.get("customers", cid);
              const pct = (rev/totalRev) * 100;
              return (
                <div key={cid}>
                  <div className="row" style={{ marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{c?.name?.replace("บริษัท ","").replace(" จำกัด","") || "—"}</span>
                    <div className="spacer"/>
                    <span className="mono" style={{ fontWeight: 600 }}>{D.thb(rev)}</span>
                  </div>
                  <div className="progress"><div className="fill" style={{ width: pct + "%" }}/></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============== TIRES ==============
function TiresPage({ setActive }) {
  const D = window.KPSData;
  const [q, setQ] = useStateOps("");
  const all = D.getAll("tires");
  const list = all.filter(t => !q || t.code.includes(q) || t.brand.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">ระบบยาง</h1>
          <div className="page-sub">รายการยางทั้งหมด {all.length} เส้น • วิกฤติ {all.filter(t => t.status === "critical").length} เส้น • เฝ้าระวัง {all.filter(t => t.status === "warning").length} เส้น</div>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => setActive("tires.layout")}><Icon name="tire" size={15}/> ดูผังยาง</button>
          <button className="btn primary"><Icon name="plus" size={15}/> เพิ่มยางใหม่</button>
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: 16 }}>
        <div className="card kpi"><div className="label">ดี</div><div className="row"><div className="icn-box green"><Icon name="check" size={18}/></div><div className="value">{all.filter(t => t.status === "good").length}<span className="unit">เส้น</span></div></div></div>
        <div className="card kpi"><div className="label">เฝ้าระวัง (ดอกยาง 4-6 mm)</div><div className="row"><div className="icn-box amber"><Icon name="alert" size={18}/></div><div className="value">{all.filter(t => t.status === "warning").length}<span className="unit">เส้น</span></div></div></div>
        <div className="card kpi"><div className="label">วิกฤติ (ดอกยาง &lt; 4 mm)</div><div className="row"><div className="icn-box red"><Icon name="alert" size={18}/></div><div className="value">{all.filter(t => t.status === "critical").length}<span className="unit">เส้น</span></div></div></div>
      </div>

      <div className="toolbar">
        <div style={{ position: "relative" }}>
          <Icon name="search" size={15} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)" }}/>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหา..." style={{ height: 36, padding: "0 12px 0 34px", width: 280, border: "1px solid var(--line)", borderRadius: 8, background: "#fff", fontSize: 13 }}/>
        </div>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>รหัส</th><th>รถ</th><th>ตำแหน่ง</th><th>ยี่ห้อ/รุ่น</th><th>ขนาด</th><th>วันติดตั้ง</th><th>km</th><th>ดอกยาง</th><th>สถานะ</th></tr></thead>
          <tbody>
            {list.map(t => {
              const v = D.get("vehicles", t.vehicleId);
              return (
                <tr key={t.id}>
                  <td className="mono">{t.code}</td>
                  <td><span className="mono badge gray">{v?.plate}</span></td>
                  <td><span className="mono" style={{ fontWeight: 600 }}>{t.position}</span></td>
                  <td>{t.brand}</td>
                  <td className="mono muted">{t.size}</td>
                  <td className="num muted">{t.install}</td>
                  <td className="num">{D.fmt(t.km)}</td>
                  <td className="num" style={{ fontWeight: 600, color: t.status === "critical" ? "var(--red)" : t.status === "warning" ? "var(--amber)" : "var(--green)" }}>{t.depth} mm</td>
                  <td><StatusBadge status={t.status}/></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TireLayout({ setActive }) {
  const D = window.KPSData;
  const vehicles = D.getAll("vehicles");
  const [vid, setVid] = useStateOps(vehicles[0]?.id);
  const v = D.get("vehicles", vid);
  const tires = D.getAll("tires").filter(t => t.vehicleId === vid);

  // Map by position
  const pos = (p) => tires.find(t => t.position === p);

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="row" style={{ gap: 6, color: "var(--text-muted)", fontSize: 12, marginBottom: 4 }}>
            <span style={{ cursor: "pointer" }} onClick={() => setActive("tires")}>← ระบบยาง</span>
          </div>
          <h1 className="page-title">ผังยางปัจจุบัน</h1>
          <div className="page-sub">ดูสภาพและตำแหน่งยางแต่ละเส้นบนรถ</div>
        </div>
      </div>

      <div className="card pad" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 10, marginBottom: 18 }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>เลือกรถ:</span>
          {vehicles.map(vh => (
            <button key={vh.id} className={`chip ${vid === vh.id ? "active" : ""}`} onClick={() => setVid(vh.id)}>
              <span className="mono">{vh.plate}</span>
            </button>
          ))}
        </div>

        {v && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 32, alignItems: "start" }}>
            <div>
              <div style={{ width: 100, height: 60, borderRadius: 8, background: "var(--text-2)", color: "#FFD700", display: "grid", placeItems: "center", fontSize: 22, fontFamily: "var(--font-mono)", fontWeight: 700, marginBottom: 14 }}>{v.plate}</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{v.brand}</div>
              <div className="muted" style={{ fontSize: 13 }}>{v.type} • {tires.length} เส้น</div>

              <div className="col" style={{ marginTop: 18, gap: 10 }}>
                <div className="row" style={{ gap: 10 }}><div className="tire-shape good" style={{ width: 16, height: 28 }}></div> ดี ({tires.filter(t => t.status === "good").length})</div>
                <div className="row" style={{ gap: 10 }}><div className="tire-shape warning" style={{ width: 16, height: 28 }}></div> เฝ้าระวัง ({tires.filter(t => t.status === "warning").length})</div>
                <div className="row" style={{ gap: 10 }}><div className="tire-shape critical" style={{ width: 16, height: 28 }}></div> วิกฤติ ({tires.filter(t => t.status === "critical").length})</div>
              </div>
            </div>

            <div className="tire-layout">
              {/* Cab axle */}
              <TireSlot tire={pos("FL")}/>
              <div style={{ alignSelf: "center", textAlign: "center", color: "var(--text-faint)", fontSize: 11, fontWeight: 600 }}>หัวเก๋ง<br/><span style={{ fontSize: 9, opacity: .7 }}>FRONT</span></div>
              <TireSlot tire={pos("FR")}/>

              {/* Drive axle 1 */}
              <TireSlot tire={pos("RL1")}/>
              <div style={{ alignSelf: "center", textAlign: "center", color: "var(--text-faint)", fontSize: 11, fontWeight: 600 }}>เพลาขับ 1</div>
              <TireSlot tire={pos("RR1")}/>

              {/* Drive axle 2 */}
              <TireSlot tire={pos("RL2")}/>
              <div style={{ alignSelf: "center", textAlign: "center", color: "var(--text-faint)", fontSize: 11, fontWeight: 600 }}>เพลาขับ 2</div>
              <TireSlot tire={pos("RR2")}/>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const TireSlot = ({ tire }) => {
  if (!tire) return (
    <div className="tire-cell">
      <div className="tire-shape" style={{ background: "transparent", border: "2px dashed var(--line-strong)" }}></div>
      <div className="pos faint">—</div>
    </div>
  );
  return (
    <div className="tire-cell" title={`${tire.brand} • ${tire.depth}mm`}>
      <div className={`tire-shape ${tire.status}`}></div>
      <div className="pos">{tire.position}</div>
      <div className="depth">{tire.depth}mm</div>
    </div>
  );
};

function TireManage({ setActive }) {
  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">จัดการและสลับยาง</h1>
          <div className="page-sub">บันทึกการสลับ-เปลี่ยน-ถอดยาง</div>
        </div>
      </div>
      <div className="card pad">
        <div className="empty">
          <Icon name="tire" size={40} style={{ marginBottom: 12, opacity: .5 }}/>
          <div>หน้าจัดการการสลับยาง — เลือกตำแหน่งที่ต้องการสลับ บันทึกประวัติการเปลี่ยน</div>
          <div style={{ marginTop: 14 }}>
            <button className="btn primary" onClick={() => setActive("tires.layout")}>เปิดผังยาง</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============== FUEL ==============
function FuelPage({ setActive }) {
  const D = window.KPSData;
  const fuel = D.getAll("fuel");
  const vehicles = D.getAll("vehicles");
  const totalL = fuel.reduce((s,f) => s + f.liters, 0);
  const totalCost = fuel.reduce((s,f) => s + f.total, 0);
  const avgPrice = totalCost / totalL;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">ภาพรวมระบบน้ำมัน</h1>
          <div className="page-sub">การใช้น้ำมันเดือนนี้ของทั้งกองรถ</div>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => setActive("fuel.logs")}>ดูบันทึกทั้งหมด</button>
          <button className="btn primary"><Icon name="plus" size={15}/> บันทึกน้ำมัน</button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="card kpi"><div className="label">ปริมาณรวม</div><div className="row"><div className="icn-box"><Icon name="fuel" size={18}/></div><div className="value">{D.fmt(totalL)}<span className="unit">ลิตร</span></div></div></div>
        <div className="card kpi"><div className="label">ต้นทุนรวม</div><div className="row"><div className="icn-box red"><Icon name="money" size={18}/></div><div className="value">{D.thb(totalCost)}</div></div></div>
        <div className="card kpi"><div className="label">ราคาเฉลี่ย/ลิตร</div><div className="row"><div className="icn-box amber"><Icon name="chart" size={18}/></div><div className="value">฿{avgPrice.toFixed(2)}</div></div></div>
        <div className="card kpi"><div className="label">เติมทั้งหมด</div><div className="row"><div className="icn-box teal"><Icon name="package" size={18}/></div><div className="value">{fuel.length}<span className="unit">ครั้ง</span></div></div></div>
      </div>

      <div className="card">
        <div className="head"><h3>การใช้น้ำมันรายคัน (เดือนนี้)</h3></div>
        <div style={{ padding: 22 }}>
          {vehicles.filter(v => fuel.some(f => f.vehicleId === v.id)).map(v => {
            const records = fuel.filter(f => f.vehicleId === v.id);
            const l = records.reduce((s,r) => s + r.liters, 0);
            const c = records.reduce((s,r) => s + r.total, 0);
            const maxL = Math.max(...vehicles.map(vv => fuel.filter(f => f.vehicleId === vv.id).reduce((s,r) => s + r.liters, 0))) || 1;
            return (
              <div key={v.id} style={{ marginBottom: 14 }}>
                <div className="row" style={{ marginBottom: 6 }}>
                  <span className="mono badge gray">{v.plate}</span>
                  <span className="muted" style={{ fontSize: 12.5 }}>{v.brand}</span>
                  <div className="spacer"/>
                  <span className="mono" style={{ fontWeight: 600 }}>{l} ลิตร</span>
                  <span className="muted mono" style={{ fontSize: 12 }}>{D.thb(c)}</span>
                </div>
                <div className="progress"><div className="fill" style={{ width: (l/maxL)*100 + "%" }}/></div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FuelLogs() {
  const D = window.KPSData;
  const fuel = D.getAll("fuel");
  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">บันทึกการเติมน้ำมัน</h1>
          <div className="page-sub">{fuel.length} รายการ • ทั้งหมด {D.fmt(fuel.reduce((s,f)=>s+f.liters,0))} ลิตร</div>
        </div>
        <div className="actions">
          <button className="btn primary"><Icon name="plus" size={15}/> บันทึกน้ำมัน</button>
        </div>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>วันที่</th><th>รหัส</th><th>รถ</th><th>คนขับ</th><th>ปั๊ม</th><th className="right">ลิตร</th><th className="right">ราคา/L</th><th className="right">รวม</th><th>เลขไมล์</th></tr></thead>
          <tbody>
            {fuel.map(f => (
              <tr key={f.id}>
                <td className="mono">{f.date}</td>
                <td className="mono">{f.code}</td>
                <td><span className="mono badge gray">{D.nameOf("vehicles", f.vehicleId)}</span></td>
                <td>{D.nameOf("employees", f.driverId)}</td>
                <td>{f.station}</td>
                <td className="num right">{f.liters}</td>
                <td className="num right">฿{f.pricePerL}</td>
                <td className="num right" style={{ fontWeight: 600 }}>{D.thb(f.total)}</td>
                <td className="num muted">{D.fmt(f.odometer)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FuelReport() {
  const D = window.KPSData;
  const months = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย."];
  const data = [86200, 92400, 88600, 105800, 118200, 42700];
  const maxD = Math.max(...data);
  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">รายงานน้ำมันรายเดือน</h1>
          <div className="page-sub">เปรียบเทียบรายเดือน 6 เดือนล่าสุด</div>
        </div>
        <div className="actions">
          <button className="btn primary"><Icon name="download" size={15}/> ส่งออกเป็น Excel</button>
        </div>
      </div>

      <div className="card pad">
        <h3 className="section-title">ค่าน้ำมันรายเดือน (บาท)</h3>
        <div className="bar-chart" style={{ height: 220 }}>
          {data.map((v, i) => (
            <div className="bar-col" key={i}>
              <div className="bar-val mono">{(v/1000).toFixed(0)}k</div>
              <div className="bar" style={{ height: (v/maxD)*180 + "px" }}>
                <div className="fill" style={{ height: "100%" }}/>
              </div>
              <div className="bar-lbl">{months[i]}</div>
            </div>
          ))}
        </div>
        <div className="grid-3" style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--line)" }}>
          <div><div className="muted" style={{ fontSize: 12 }}>รวม 6 เดือน</div><div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{D.thb(data.reduce((a,b)=>a+b,0))}</div></div>
          <div><div className="muted" style={{ fontSize: 12 }}>เฉลี่ย/เดือน</div><div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{D.thb(data.reduce((a,b)=>a+b,0)/data.length)}</div></div>
          <div><div className="muted" style={{ fontSize: 12 }}>สูงสุด (พ.ค.)</div><div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{D.thb(maxD)}</div></div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  DispatchPage, DispatchOpen, DispatchReport,
  TiresPage, TireLayout, TireManage,
  FuelPage, FuelLogs, FuelReport,
});
