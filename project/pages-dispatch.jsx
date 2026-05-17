// pages-dispatch.jsx — Multi-leg Dispatch Module (4 tabs: เปิดงาน / ปิดงาน / รายงานสรุป / ประวัติงาน)
const { useState: useStateDsp, useMemo: useMemoDsp, useEffect: useEffectDsp } = React;

// ─── Tab-bar icons (inline SVG, simple) ───
const DspIcons = {
  send: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4z"/></svg>,
  check: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m8 12 3 3 5-6"/></svg>,
  doc: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M9 14h6M9 18h4"/></svg>,
  history: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></svg>,
  print: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V3h12v6"/><rect x="6" y="14" width="12" height="7"/><path d="M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/></svg>,
  info: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5"/></svg>,
  route: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8 19h7a4 4 0 0 0 0-8h-6a4 4 0 0 1 0-8h7"/></svg>,
  truck: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h11v10H3z"/><path d="M14 10h4l3 3v4h-7"/><circle cx="6.5" cy="17.5" r="1.7"/><circle cx="17.5" cy="17.5" r="1.7"/></svg>,
  fuel: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: -2 }}><rect x="4" y="3" width="10" height="18" rx="1"/><path d="M14 7h2l2 2v8a2 2 0 0 1-4 0v-3"/><path d="M7 7h4"/></svg>,
};

// ============== DISPATCH MODULE ==============
function DispatchModule({ tab, setActive, user }) {
  // route tab from `active`
  const currentTab = tab === "open" ? "open" : tab === "close" ? "close" : tab === "report" ? "report" : tab === "history" ? "history" : "open";

  return (
    <div>
      <DispatchTabs current={currentTab} onChange={(t) => setActive("dispatch." + t)}/>
      <div style={{ marginTop: 20 }}>
        {currentTab === "open" && <DispatchOpenForm setActive={setActive}/>}
        {currentTab === "close" && <DispatchCloseForm/>}
        {currentTab === "report" && <DispatchReportTab/>}
        {currentTab === "history" && <DispatchHistoryTab/>}
      </div>
    </div>
  );
}

function DispatchTabs({ current, onChange }) {
  const items = [
    { id: "open",    label: "เปิดงาน",         ic: DspIcons.send },
    { id: "close",   label: "ปิดงาน",          ic: DspIcons.check },
    { id: "report",  label: "รายงานสรุป",      ic: DspIcons.doc },
    { id: "history", label: "ประวัติการวิ่งงาน", ic: DspIcons.history },
  ];
  return (
    <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: 6, display: "inline-flex", gap: 2 }}>
      {items.map(it => (
        <button
          key={it.id}
          onClick={() => onChange(it.id)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "9px 18px",
            border: "none", borderRadius: 8,
            background: current === it.id ? "var(--primary-50)" : "transparent",
            color: current === it.id ? "var(--primary)" : "var(--text-muted)",
            fontWeight: current === it.id ? 600 : 500,
            fontSize: 13.5,
            cursor: "pointer",
            borderBottom: current === it.id ? "2px solid var(--primary)" : "2px solid transparent",
            marginBottom: -2,
            transition: "background .15s, color .15s",
          }}
        >
          {it.ic}
          {it.label}
        </button>
      ))}
    </div>
  );
}

// ============== OPEN JOB FORM (multi-leg) ==============
function DispatchOpenForm({ setActive }) {
  const D = window.KPSData;
  const today = new Date().toISOString().slice(0, 10);
  const newJobCode = useMemoDsp(() => {
    const n = D.getAll("dispatch").length + 1;
    return "DSP-" + new Date().toISOString().slice(0,10).replace(/-/g,"") + "-" + String(n).padStart(3, "0");
  }, []);

  const [form, setForm] = useStateDsp({
    code: newJobCode,
    date: today,
    vehicleId: "",
    driverId: "",
    startOdometer: "",
    notes: "",
    legs: [emptyLeg()],
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function emptyLeg() {
    return { origin: "", destination: "", cargo: "", cargoType: "", priceMode: "per_ton", weight: "", price: "" };
  }
  const setLeg = (i, patch) => setForm(f => ({ ...f, legs: f.legs.map((l, idx) => idx === i ? { ...l, ...patch } : l) }));
  const addLeg = () => setForm(f => ({ ...f, legs: [...f.legs, emptyLeg()] }));
  const removeLeg = (i) => setForm(f => ({ ...f, legs: f.legs.filter((_, idx) => idx !== i) }));

  const legAmounts = form.legs.map(l => D.legAmount(l));
  const total = legAmounts.reduce((a, b) => a + b, 0);

  const dateLabel = D.thaiDate(form.date);

  const submit = (asDraft) => {
    if (!asDraft) {
      const hasEmpty = form.legs.some(l => !l.origin || !l.destination || !l.cargo);
      if (!form.vehicleId || !form.driverId) { alert("กรุณาเลือกรถและคนขับ"); return; }
      if (hasEmpty) { alert("กรุณากรอกข้อมูลทุกขาให้ครบ"); return; }
    }
    const legs = form.legs.map(l => ({
      ...l,
      weight: +l.weight || 0,
      price: +l.price || 0,
      amount: D.legAmount(l),
    }));
    D.add("dispatch", {
      ...form,
      legs,
      startOdometer: +form.startOdometer || null,
      endOdometer: null,
      distance: null,
      liters: null,
      kmPerL: null,
      perDiem: null,
      status: asDraft ? "draft" : "in-progress",
      progress: asDraft ? 0 : 10,
      totalAmount: total,
      revenue: total,
      cost: 0,
      depart: form.date + " " + new Date().toTimeString().slice(0,5),
      eta: form.date,
      customerId: null,
      subcontractorId: null,
    });
    alert(asDraft ? "บันทึกเป็นร่างเรียบร้อย" : `เปิดงาน ${form.code} เรียบร้อย`);
    setActive("dispatch.history");
  };

  return (
    <div>
      {/* Page head */}
      <div className="row" style={{ alignItems: "flex-end", marginBottom: 18 }}>
        <div>
          <h1 className="page-title">เปิดงานขนส่ง</h1>
          <div className="page-sub">รองรับหลายขา (Multi-leg) ในรอบเดียว</div>
        </div>
        <div className="spacer"/>
        <span className="badge blue" style={{ padding: "5px 14px", fontSize: 12.5 }}>{dateLabel}</span>
      </div>

      {/* ─── Card 1: ข้อมูลรถและคนขับ ─── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="head">
          <span style={{ color: "var(--primary)" }}>{DspIcons.truck}</span>
          <h3>ข้อมูลรถและคนขับ</h3>
        </div>
        <div style={{ padding: "20px 22px" }}>
          <div className="grid-3" style={{ gap: 14, marginBottom: 14 }}>
            <Field label="วันที่ *"><input type="date" value={form.date} onChange={e => set("date", e.target.value)}/></Field>
            <Field label="รถ *">
              <select value={form.vehicleId} onChange={e => set("vehicleId", e.target.value)}>
                <option value="">— เลือกรถ —</option>
                {D.getAll("vehicles").map(v => <option key={v.id} value={v.id}>{v.plate} • {v.brand} ({v.type})</option>)}
              </select>
            </Field>
            <Field label="คนขับ *">
              <select value={form.driverId} onChange={e => set("driverId", e.target.value)}>
                <option value="">— เลือกคนขับ —</option>
                {D.getAll("employees").filter(e => e.position.includes("ขับ") && e.status === "active").map(e => <option key={e.id} value={e.id}>{e.name} ({e.code})</option>)}
              </select>
            </Field>
          </div>
          <div className="grid-2" style={{ gap: 14 }}>
            <Field label={<span>เลขไมล์ต้นรอบ (km) <span style={{ verticalAlign: -2, color: "var(--text-faint)" }}>{DspIcons.info}</span></span>}>
              <input type="number" value={form.startOdometer} onChange={e => set("startOdometer", e.target.value)} placeholder="0"/>
            </Field>
            <Field label="หมายเหตุรอบงาน"><input value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="ระบุหมายเหตุ (ถ้ามี)"/></Field>
          </div>
        </div>
      </div>

      {/* ─── Card 2: เส้นทางและสินค้า (multi-leg) ─── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="head">
          <span style={{ color: "var(--primary)" }}>{DspIcons.route}</span>
          <h3>เส้นทางและสินค้า</h3>
          <span className="badge blue mono">{form.legs.length} ขา</span>
        </div>
        <div style={{ padding: 22 }}>
          {form.legs.map((leg, i) => (
            <LegCard key={i} idx={i} leg={leg} onChange={p => setLeg(i, p)} onRemove={form.legs.length > 1 ? () => removeLeg(i) : null} amount={legAmounts[i]}/>
          ))}
          <button
            className="btn outline"
            onClick={addLeg}
            style={{ width: "100%", padding: "12px", justifyContent: "center", marginTop: 4, borderStyle: "dashed", fontWeight: 500 }}
          >
            <Icon name="plus" size={15}/> เพิ่มขาถัดไป
          </button>
        </div>
      </div>

      {/* ─── Total ─── */}
      <div className="card pad" style={{ marginBottom: 16, display: "flex", alignItems: "center" }}>
        <div>
          <div className="muted" style={{ fontSize: 12.5 }}>รวมค่าขนส่งทั้งรอบ ({form.legs.length} ขา)</div>
          <div className="mono" style={{ fontSize: 30, fontWeight: 700, color: "var(--primary)", letterSpacing: "-.02em" }}>
            {total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: 18, color: "var(--text-muted)", fontWeight: 500 }}>บาท</span>
          </div>
        </div>
      </div>

      {/* ─── Actions ─── */}
      <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
        <button className="btn" onClick={() => setActive("dispatch.history")}><Icon name="close" size={15}/> ยกเลิก</button>
        <button className="btn" style={{ background: "var(--text-2)", color: "#fff", borderColor: "var(--text-2)" }} onClick={() => submit(true)}>
          💾 บันทึกร่าง
        </button>
        <button className="btn primary" onClick={() => submit(false)}>
          <Icon name="check" size={15}/> เปิดงาน ({form.legs.length} ขา)
        </button>
      </div>
    </div>
  );
}

function LegCard({ idx, leg, onChange, onRemove, amount }) {
  const [open, setOpen] = useStateDsp(true);
  const D = window.KPSData;
  const filled = leg.origin && leg.destination && leg.cargo;
  const set = (k, v) => onChange({ [k]: v });

  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 10, marginBottom: 14, overflow: "hidden", background: "var(--bg-elev)" }}>
      {/* Header */}
      <div className="row" style={{ padding: "12px 16px", background: "var(--bg-sunk)", cursor: "pointer" }} onClick={() => setOpen(o => !o)}>
        <div style={{ width: 28, height: 28, borderRadius: 999, background: "var(--primary)", color: "#fff", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700 }}>{idx + 1}</div>
        <div style={{ flex: 1, fontStyle: filled ? "normal" : "italic", color: filled ? "var(--text-2)" : "var(--text-muted)", fontWeight: filled ? 600 : 400, fontSize: 13.5 }}>
          {filled ? <>ขาที่ {idx + 1} — <span style={{ fontWeight: 500 }}>{leg.origin} → {leg.destination}</span></> : `ขาที่ ${idx + 1} — ยังไม่ได้กรอกข้อมูล`}
        </div>
        {filled && <span className="mono" style={{ fontWeight: 600, color: "var(--primary)" }}>{D.thb(amount)}</span>}
        {onRemove && (
          <button className="btn ghost icon sm danger" onClick={e => { e.stopPropagation(); if (confirm("ลบขานี้?")) onRemove(); }}><Icon name="trash" size={14}/></button>
        )}
        <span style={{ color: "var(--text-faint)", transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform .15s" }}>
          <Icon name="chevron-down" size={16}/>
        </span>
      </div>

      {/* Body */}
      {open && (
        <div style={{ padding: 18 }}>
          <div className="grid-2" style={{ gap: 14, marginBottom: 14 }}>
            <Field label="ต้นทาง *"><input value={leg.origin} onChange={e => set("origin", e.target.value)} placeholder="เช่น นครราชสีมา"/></Field>
            <Field label="ปลายทาง *"><input value={leg.destination} onChange={e => set("destination", e.target.value)} placeholder="เช่น ขอนแก่น"/></Field>
            <Field label="สินค้า *"><input value={leg.cargo} onChange={e => set("cargo", e.target.value)} placeholder="ระบุชื่อสินค้า"/></Field>
            <Field label="ประเภทสินค้า">
              <select value={leg.cargoType} onChange={e => set("cargoType", e.target.value)}>
                <option value="">— เลือกประเภท —</option>
                <option>ทั่วไป</option>
                <option>แช่เย็น</option>
                <option>เคมี/IBC</option>
                <option>ตู้คอนเทนเนอร์</option>
                <option>วัสดุก่อสร้าง</option>
                <option>อันตราย</option>
              </select>
            </Field>
          </div>

          {/* Price mode radio */}
          <Field label="รูปแบบราคา">
            <div className="row" style={{ gap: 18, paddingTop: 4 }}>
              {[["per_ton","ต่อตัน"],["per_kg","ต่อกิโลกรัม"],["lump","เหมา"]].map(([k,l]) => (
                <label key={k} className="row" style={{ gap: 6, cursor: "pointer", fontSize: 13.5 }}>
                  <input type="radio" name={`pm-${idx}`} checked={leg.priceMode === k} onChange={() => set("priceMode", k)} style={{ accentColor: "var(--primary)" }}/>
                  {l}
                </label>
              ))}
            </div>
          </Field>

          <div className="grid-2" style={{ gap: 14, marginTop: 14 }}>
            {leg.priceMode !== "lump" && (
              <Field label={leg.priceMode === "per_kg" ? "น้ำหนัก (กิโลกรัม)" : "น้ำหนัก (ตัน)"}>
                <input type="number" value={leg.weight} onChange={e => set("weight", e.target.value)} placeholder="0.00"/>
              </Field>
            )}
            <Field label={`ราคา (${leg.priceMode === "per_ton" ? "บาท/ตัน" : leg.priceMode === "per_kg" ? "บาท/กก." : "บาทเหมา"}) *`} full={leg.priceMode === "lump"}>
              <input type="number" value={leg.price} onChange={e => set("price", e.target.value)} placeholder="0.00"/>
            </Field>
          </div>

          {/* Auto-calc */}
          <div style={{ marginTop: 16, padding: "12px 16px", background: "var(--primary-50)", borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "var(--primary)" }}><Icon name="chart" size={16}/></span>
            <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-2)" }}>ค่าขนส่งขานี้:</span>
            <div className="spacer"/>
            <span className="mono" style={{ fontSize: 18, fontWeight: 700, color: "var(--primary)" }}>
              {amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============== CLOSE JOB FORM ==============
function DispatchCloseForm() {
  const D = window.KPSData;
  const inProgress = D.getAll("dispatch").filter(t => t.status === "in-progress");
  const [pickedId, setPickedId] = useStateDsp("");
  const picked = D.get("dispatch", pickedId);

  const [form, setForm] = useStateDsp({ endOdometer: "", endWeight: "", liters: "", perDiem: "" });
  useEffectDsp(() => {
    if (picked) setForm({ endOdometer: picked.endOdometer || "", endWeight: "", liters: picked.liters || "", perDiem: picked.perDiem || "" });
  }, [pickedId]);

  const start = +picked?.startOdometer || 0;
  const end = +form.endOdometer || 0;
  const distance = end > start ? end - start : 0;
  const liters = +form.liters || 0;
  const kmPerL = liters > 0 ? distance / liters : 0;
  const totalAmount = D.amountOf(picked);
  const costPerKm = distance > 0 ? totalAmount / distance : 0;

  const submit = () => {
    if (!picked) return;
    if (!form.endOdometer) { alert("กรุณากรอกเลขไมล์ปลายทาง"); return; }
    D.update("dispatch", picked.id, {
      endOdometer: +form.endOdometer,
      liters: +form.liters || 0,
      perDiem: +form.perDiem || 0,
      distance,
      kmPerL,
      status: "completed",
      progress: 100,
    });
    alert(`ปิดงาน ${picked.code} เรียบร้อย\nระยะทาง ${distance} km • ${kmPerL.toFixed(1)} km/l`);
    setPickedId("");
  };

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h1 className="page-title">ปิดงานขนส่ง</h1>
        <div className="page-sub">สรุปรอบงานทั้งหมดเมื่อกลับถึงที่หมาย</div>
      </div>

      <div className="card pad" style={{ marginBottom: 16 }}>
        <Field label="เลือกงานที่ต้องปิด">
          <select value={pickedId} onChange={e => setPickedId(e.target.value)}>
            <option value="">— เลือกงานที่กำลังดำเนินการ (In Progress) —</option>
            {inProgress.map(t => (
              <option key={t.id} value={t.id}>
                {t.code} • {D.thaiDate(t.date)} • {D.originOf(t)} → {D.destOf(t)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {picked && (
        <>
          {/* Job summary card */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="head">
              <span style={{ color: "var(--primary)" }}>{DspIcons.truck}</span>
              <h3>ที่มา (ตอนเปิดงาน)</h3>
              <span className="mono badge gray">{picked.code}</span>
            </div>
            <div style={{ padding: 20 }}>
              <div className="grid-3" style={{ gap: 16, marginBottom: 14 }}>
                <Info label="วันที่" value={D.thaiDate(picked.date)}/>
                <Info label="รถ" value={<span className="mono">{D.nameOf("vehicles", picked.vehicleId)}</span>}/>
                <Info label="คนขับ" value={D.nameOf("employees", picked.driverId)}/>
              </div>
              <h3 className="section-title" style={{ marginTop: 6 }}>เส้นทาง ({picked.legs?.length || 1} ขา)</h3>
              <div className="col" style={{ gap: 8 }}>
                {D.legsOf(picked).map((leg, i) => (
                  <div key={i} className="row" style={{ padding: "10px 14px", background: "var(--bg-sunk)", borderRadius: 8, fontSize: 13 }}>
                    <div style={{ width: 22, height: 22, borderRadius: 999, background: "var(--primary)", color: "#fff", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700 }}>{i+1}</div>
                    <div>{leg.origin} → {leg.destination}</div>
                    <div className="muted" style={{ fontSize: 12 }}>• {leg.cargo}</div>
                    <div className="spacer"/>
                    <div className="mono" style={{ fontWeight: 600 }}>{D.thb(leg.amount)}</div>
                  </div>
                ))}
              </div>
              <div className="row" style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
                <Info label="เลขไมล์ต้นทาง" value={<span className="mono">{D.fmt(picked.startOdometer)} km</span>}/>
                <div style={{ width: 32 }}/>
                <Info label="คาดการณ์ค่าขนส่ง" value={<span className="mono" style={{ color: "var(--primary)", fontWeight: 700 }}>{D.thb(totalAmount)}</span>}/>
              </div>
            </div>
          </div>

          {/* Close form */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="head"><h3>ข้อมูลปิดงาน</h3></div>
            <div style={{ padding: 22, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              <div>
                <div className="col" style={{ gap: 14 }}>
                  <Field label="เลขไมล์ปลายทาง (km) *"><input type="number" value={form.endOdometer} onChange={e => setForm(f => ({...f, endOdometer: e.target.value}))} placeholder={String(start)}/></Field>
                  <Field label="น้ำหนักสินค้าสุทธิ (ตัน)"><input type="number" value={form.endWeight} onChange={e => setForm(f => ({...f, endWeight: e.target.value}))}/></Field>
                  <Field label="ลิตรน้ำมันที่เติม"><input type="number" value={form.liters} onChange={e => setForm(f => ({...f, liters: e.target.value}))} placeholder="0.0"/></Field>
                  <Field label="ค่าเบี้ยเลี้ยง (บาท)"><input type="number" value={form.perDiem} onChange={e => setForm(f => ({...f, perDiem: e.target.value}))}/></Field>
                </div>
              </div>
              <div>
                <h3 className="section-title">คำนวณอัตโนมัติ</h3>
                <div className="col" style={{ gap: 12 }}>
                  <CalcRow label="ระยะทาง" value={distance > 0 ? `${D.fmt(distance)} km` : "—"} ok={distance > 0}/>
                  <CalcRow label="ค่าขนส่ง" value={D.thb(totalAmount)} ok/>
                  <CalcRow label="km/L" value={kmPerL > 0 ? `${kmPerL.toFixed(1)} km/l` : "—"} ok={kmPerL >= 2.5} warn={kmPerL > 0 && kmPerL < 2.5}/>
                  <CalcRow label="Cost/km" value={costPerKm > 0 ? `฿${costPerKm.toFixed(2)}/km` : "—"} ok={costPerKm > 0}/>
                </div>
              </div>
            </div>
          </div>

          <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
            <button className="btn" onClick={() => setPickedId("")}><Icon name="close" size={15}/> ยกเลิก</button>
            <button className="btn primary" onClick={submit}><Icon name="check" size={15}/> ปิดงาน</button>
          </div>
        </>
      )}
    </div>
  );
}

const CalcRow = ({ label, value, ok, warn }) => (
  <div className="row" style={{ padding: "10px 14px", background: warn ? "var(--red-50)" : ok ? "var(--green-50)" : "var(--bg-sunk)", borderRadius: 8 }}>
    <span style={{ fontSize: 13, color: "var(--text-2)" }}>{label}</span>
    <div className="spacer"/>
    <span className="mono" style={{ fontWeight: 600, color: warn ? "var(--red)" : ok ? "#166534" : "var(--text-muted)" }}>{value}</span>
  </div>
);

// ============== REPORT TAB ==============
function DispatchReportTab() {
  const D = window.KPSData;
  const all = D.getAll("dispatch");
  const [month, setMonth] = useStateDsp("2026-05");
  const [statusF, setStatusF] = useStateDsp("all");
  const [vehicleF, setVehicleF] = useStateDsp("all");
  const [q, setQ] = useStateDsp("");
  const [onlyAbnormal, setOnlyAbnormal] = useStateDsp(false);

  const filtered = all.filter(t => {
    if (statusF !== "all" && t.status !== statusF) return false;
    if (vehicleF !== "all" && t.vehicleId !== vehicleF) return false;
    if (q && !(t.code.toLowerCase().includes(q.toLowerCase()) || D.nameOf("customers", t.customerId).toLowerCase().includes(q.toLowerCase()))) return false;
    if (onlyAbnormal && !(t.kmPerL && t.kmPerL < 2.5)) return false;
    return true;
  });

  const totalRounds = filtered.length;
  const totalLegs = filtered.reduce((s,t) => s + (D.legsOf(t).length), 0);
  const totalKm = filtered.reduce((s,t) => s + (t.distance || 0), 0);
  const totalRev = filtered.reduce((s,t) => s + D.amountOf(t), 0);
  const withKmL = filtered.filter(t => t.kmPerL);
  const avgKmL = withKmL.length > 0 ? withKmL.reduce((s,t) => s + t.kmPerL, 0) / withKmL.length : null;

  return (
    <div>
      <div className="row" style={{ alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <h1 className="page-title">รายงานสรุปการขนส่ง</h1>
          <div className="page-sub">สรุปข้อมูลรอบงาน รายได้ และสถานะ</div>
        </div>
        <div className="spacer"/>
        <button className="btn">{DspIcons.print} <span style={{ marginLeft: 4 }}>พิมพ์รายงาน (A4)</span></button>
      </div>

      {/* KPI cards */}
      <div className="grid-5" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 18 }}>
        <KPI ic="package"  iconBg=""        label="รอบงานทั้งหมด" value={totalRounds} unit="รอบ" subtext={`ปิดแล้ว ${filtered.filter(t => t.status === "completed").length} รอบ`}/>
        <KPI ic="trip"     iconBg="violet"  label="ขารวม"         value={totalLegs}   unit="ขา"   subtext={totalRounds > 0 ? `เฉลี่ย ${(totalLegs/totalRounds).toFixed(1)} ขา/รอบ` : "—"}/>
        <KPI ic="gauge"    iconBg="teal"    label="ระยะทางรวม"    value={D.fmt(totalKm)} unit="km" subtext="—"/>
        <KPI ic="fuel"     iconBg="amber"   label="เฉลี่ย km/l"   value={avgKmL ? avgKmL.toFixed(1) : "ไม่มีข้อมูล"} unit={avgKmL ? "km/l" : ""} subtext={`${withKmL.length} รอบมีข้อมูล`}/>
        <KPI ic="money"    iconBg="green"   label="รายได้รวม"      value={D.thb(totalRev).replace("฿","")} unit="บาท" subtext="—"/>
      </div>

      {/* Filter row */}
      <div className="card pad" style={{ marginBottom: 14 }}>
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <div className="row" style={{ gap: 6, padding: "6px 10px", border: "1px solid var(--line)", borderRadius: 8, background: "#fff" }}>
            <Icon name="calendar" size={14} style={{ color: "var(--text-faint)" }}/>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ border: "none", outline: "none", fontSize: 13, height: 24, padding: 0, background: "transparent" }}/>
          </div>
          <div className="row" style={{ gap: 6, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 8, background: "#fff", height: 38 }}>
            <Icon name="filter" size={14} style={{ color: "var(--text-faint)" }}/>
            <select value={statusF} onChange={e => setStatusF(e.target.value)} style={{ border: "none", outline: "none", fontSize: 13, height: 36, background: "transparent" }}>
              <option value="all">สถานะทั้งหมด</option>
              <option value="draft">ร่าง</option>
              <option value="in-progress">กำลังดำเนินการ</option>
              <option value="completed">เสร็จสิ้น</option>
              <option value="cancelled">ยกเลิก</option>
            </select>
          </div>
          <div className="row" style={{ gap: 6, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 8, background: "#fff", height: 38 }}>
            <Icon name="truck" size={14} style={{ color: "var(--text-faint)" }}/>
            <select value={vehicleF} onChange={e => setVehicleF(e.target.value)} style={{ border: "none", outline: "none", fontSize: 13, height: 36, background: "transparent" }}>
              <option value="all">รถทั้งหมด</option>
              {D.getAll("vehicles").map(v => <option key={v.id} value={v.id}>{v.plate}</option>)}
            </select>
          </div>
          <div className="row" style={{ position: "relative", flex: 1, minWidth: 180 }}>
            <Icon name="search" size={14} style={{ position: "absolute", left: 11, color: "var(--text-faint)" }}/>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหา Job No, ลูกค้า, คนขับ..." style={{ width: "100%", height: 38, padding: "0 12px 0 32px", border: "1px solid var(--line)", borderRadius: 8, background: "#fff", fontSize: 13 }}/>
          </div>
          <button className={`chip ${onlyAbnormal ? "active" : ""}`} style={{ background: onlyAbnormal ? "var(--red)" : "#fff", borderColor: onlyAbnormal ? "var(--red)" : "var(--line)", color: onlyAbnormal ? "#fff" : "var(--text-2)", height: 38 }} onClick={() => setOnlyAbnormal(o => !o)}>
            <Icon name="alert" size={13}/> แสดงเฉพาะผิดปกติ &lt; 2.5 km/l
          </button>
        </div>

        {/* Legend */}
        <div className="row" style={{ gap: 16, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)", fontSize: 12 }}>
          <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>{DspIcons.fuel} เกณฑ์ km/l:</span>
          <span className="badge green"><Icon name="check" size={11}/> ผ่านเกณฑ์ ≥ 2.5 km/l</span>
          <span className="badge red"><Icon name="alert" size={11}/> ผิดปกติ &lt; 2.5 km/l</span>
        </div>
      </div>

      {/* Table */}
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Job No</th>
              <th>วันที่</th>
              <th>รถ / คนขับ</th>
              <th className="right">ขา</th>
              <th className="right">ไมล์เปิด</th>
              <th className="right">ไมล์ปิด</th>
              <th className="right">km</th>
              <th className="right">km/l</th>
              <th className="right">ค่าขนส่ง (บาท)</th>
              <th>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => {
              const legs = D.legsOf(t).length;
              const abnormal = t.kmPerL && t.kmPerL < 2.5;
              return (
                <tr key={t.id}>
                  <td><span className="mono" style={{ fontWeight: 600, color: "var(--primary)" }}>{t.code}</span></td>
                  <td className="num muted">{D.thaiDate(t.date)}</td>
                  <td>
                    <div className="mono" style={{ fontSize: 12.5 }}>{D.nameOf("vehicles", t.vehicleId)}</div>
                    <div className="muted" style={{ fontSize: 11.5 }}>{D.nameOf("employees", t.driverId)}</div>
                  </td>
                  <td className="right"><span className="badge blue mono">{legs}</span></td>
                  <td className="num right muted">{t.startOdometer ? D.fmt(t.startOdometer) : "—"}</td>
                  <td className="num right muted">{t.endOdometer ? D.fmt(t.endOdometer) : "—"}</td>
                  <td className="num right">{t.distance ? D.fmt(t.distance) : "—"}</td>
                  <td className="num right">
                    {t.kmPerL ? (
                      <span className="mono" style={{ fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: abnormal ? "var(--red-50)" : "var(--green-50)", color: abnormal ? "var(--red)" : "#166534" }}>
                        {t.kmPerL.toFixed(1)}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="num right" style={{ fontWeight: 600 }}>{D.fmt(D.amountOf(t))}</td>
                  <td><StatusBadge status={t.status}/></td>
                </tr>
              );
            })}
            <tr style={{ background: "var(--bg-sunk)", fontWeight: 700 }}>
              <td colSpan="8" className="right">รวมค่าขนส่งทั้งหมด:</td>
              <td className="num right mono" style={{ color: "var(--primary)", fontSize: 14 }}>{D.fmt(totalRev)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
        {filtered.length === 0 && <Empty>ไม่พบงานที่ตรงกับเงื่อนไข</Empty>}
      </div>
    </div>
  );
}

const KPI = ({ ic, iconBg, label, value, unit, subtext }) => (
  <div className="card kpi">
    <div className="row" style={{ gap: 8, alignItems: "flex-start" }}>
      <div className={`icn-box ${iconBg}`} style={{ width: 28, height: 28 }}><Icon name={ic} size={14}/></div>
      <div className="label" style={{ marginTop: 4 }}>{label}</div>
    </div>
    <div className="mono" style={{ fontSize: 24, fontWeight: 700, marginTop: 8, letterSpacing: "-.01em" }}>
      {value} <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{unit}</span>
    </div>
    <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{subtext}</div>
  </div>
);

// ============== HISTORY TAB ==============
function DispatchHistoryTab() {
  const D = window.KPSData;
  const all = D.getAll("dispatch").slice().sort((a,b) => (b.date || "").localeCompare(a.date || ""));
  const [q, setQ] = useStateDsp("");
  const [statusF, setStatusF] = useStateDsp("all");
  const [expanded, setExpanded] = useStateDsp({});

  const filtered = all.filter(t => {
    if (statusF !== "all" && t.status !== statusF) return false;
    if (q) {
      const qq = q.toLowerCase();
      if (!t.code.toLowerCase().includes(qq) &&
          !D.nameOf("vehicles", t.vehicleId).toLowerCase().includes(qq) &&
          !D.nameOf("employees", t.driverId).toLowerCase().includes(qq) &&
          !D.originOf(t).includes(q) &&
          !D.destOf(t).includes(q)) return false;
    }
    return true;
  });

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h1 className="page-title">ประวัติการวิ่งงาน</h1>
        <div className="page-sub">ดูประวัติงานทั้งหมด รองรับหลายขาต่อรอบ</div>
      </div>

      <div className="card pad" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 12 }}>
          <div className="row" style={{ position: "relative", flex: 1 }}>
            <Icon name="search" size={14} style={{ position: "absolute", left: 11, color: "var(--text-faint)" }}/>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหา Job No, ทะเบียนรถ, คนขับ, สินค้า, เส้นทาง..." style={{ width: "100%", height: 38, padding: "0 12px 0 32px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--bg)", fontSize: 13 }}/>
          </div>
          <select value={statusF} onChange={e => setStatusF(e.target.value)} style={{ height: 38, padding: "0 12px", border: "1px solid var(--line)", borderRadius: 8, background: "#fff", fontSize: 13 }}>
            <option value="all">ทุกสถานะ</option>
            <option value="draft">ร่าง</option>
            <option value="in-progress">กำลังดำเนินการ</option>
            <option value="completed">เสร็จสิ้น</option>
            <option value="cancelled">ยกเลิก</option>
          </select>
          <span className="muted mono" style={{ fontSize: 12, alignSelf: "center" }}>{filtered.length} รายการ</span>
        </div>
      </div>

      <div className="col" style={{ gap: 10 }}>
        {filtered.map(t => {
          const legs = D.legsOf(t);
          const v = D.get("vehicles", t.vehicleId);
          const dr = D.get("employees", t.driverId);
          const isOpen = expanded[t.id];
          const abnormal = t.kmPerL && t.kmPerL < 2.5;
          const statusColor = t.status === "completed" ? "green" : t.status === "in-progress" ? "amber" : t.status === "cancelled" ? "red" : "gray";

          return (
            <div key={t.id} className="card" style={{ overflow: "hidden" }}>
              <div className="row" style={{ padding: "16px 20px", cursor: "pointer", gap: 14 }} onClick={() => setExpanded(e => ({...e, [t.id]: !e[t.id]}))}>
                {/* Icon dot */}
                <div className="avatar" style={{
                  width: 40, height: 40, borderRadius: 999,
                  background: statusColor === "green" ? "var(--green-50)" : statusColor === "amber" ? "var(--amber-50)" : statusColor === "red" ? "var(--red-50)" : "var(--bg-sunk)",
                  color: statusColor === "green" ? "var(--green)" : statusColor === "amber" ? "var(--amber)" : statusColor === "red" ? "var(--red)" : "var(--text-muted)",
                }}>
                  {DspIcons.truck}
                </div>

                {/* Main */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                    <span className="mono" style={{ fontWeight: 700, color: "var(--text-2)", fontSize: 14 }}>{t.code}</span>
                    <StatusBadge status={t.status}/>
                    <span className="badge blue">{legs.length} ขา</span>
                    {t.kmPerL && (
                      <span className={`badge ${abnormal ? "red" : "green"}`}>
                        {DspIcons.fuel} {t.kmPerL.toFixed(1)} km/l
                      </span>
                    )}
                  </div>
                  <div className="row" style={{ gap: 16, fontSize: 12.5, color: "var(--text-muted)", flexWrap: "wrap" }}>
                    <span><Icon name="calendar" size={12}/> {D.thaiDate(t.date)}</span>
                    {v && <span className="row" style={{ gap: 4 }}><Icon name="truck" size={12}/> <span className="mono">{v.plate}</span> {dr && <span>({dr.name})</span>}</span>}
                    <span>{D.originOf(t)} {legs.length > 2 ? " → ... → " : " → "} {D.destOf(t)}</span>
                  </div>
                </div>

                {/* Right */}
                <div style={{ textAlign: "right" }}>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: "var(--primary)" }}>{D.fmt(D.amountOf(t))} <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>บาท</span></div>
                  {t.distance > 0 && <div className="muted mono" style={{ fontSize: 11.5 }}>{D.fmt(t.distance)} km</div>}
                </div>
                <Icon name="chevron-down" size={16} style={{ color: "var(--text-faint)", transform: isOpen ? "rotate(180deg)" : "", transition: "transform .15s" }}/>
              </div>

              {/* Expanded body */}
              {isOpen && (
                <div style={{ borderTop: "1px solid var(--line)", padding: 20, background: "var(--bg)" }}>
                  <div className="grid-3" style={{ marginBottom: 14 }}>
                    <Info label="วันที่" value={D.thaiDate(t.date)}/>
                    <Info label="รถ" value={v ? `${v.plate} • ${v.brand}` : "—"}/>
                    <Info label="คนขับ" value={dr?.name || "—"}/>
                    {t.startOdometer && <Info label="ไมล์เปิด" value={<span className="mono">{D.fmt(t.startOdometer)} km</span>}/>}
                    {t.endOdometer && <Info label="ไมล์ปิด" value={<span className="mono">{D.fmt(t.endOdometer)} km</span>}/>}
                    {t.liters && <Info label="น้ำมันที่ใช้" value={<span className="mono">{t.liters} ลิตร</span>}/>}
                  </div>

                  <h3 className="section-title">เส้นทาง</h3>
                  <div className="col" style={{ gap: 8, marginBottom: 14 }}>
                    {legs.map((leg, i) => (
                      <div key={i} className="row" style={{ padding: "10px 14px", background: "#fff", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13 }}>
                        <div style={{ width: 22, height: 22, borderRadius: 999, background: "var(--primary)", color: "#fff", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i+1}</div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 500 }}>{leg.origin} → {leg.destination}</div>
                          <div className="muted" style={{ fontSize: 11.5 }}>
                            {leg.cargo} {leg.weight > 0 && `• ${leg.weight} ${leg.priceMode === "per_kg" ? "กก." : "ตัน"}`} • {leg.priceMode === "lump" ? "เหมา" : leg.priceMode === "per_kg" ? "ต่อกก." : "ต่อตัน"} ฿{D.fmt(leg.price)}
                          </div>
                        </div>
                        <div className="mono" style={{ fontWeight: 600 }}>{D.thb(leg.amount)}</div>
                      </div>
                    ))}
                  </div>

                  {t.notes && t.notes !== "—" && (
                    <div style={{ padding: "10px 14px", background: "var(--amber-50)", borderRadius: 8, fontSize: 12.5 }}>
                      <strong>หมายเหตุ:</strong> {t.notes}
                    </div>
                  )}

                  <div className="row" style={{ gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
                    <button className="btn sm">{DspIcons.print} <span style={{ marginLeft: 4 }}>พิมพ์</span></button>
                    {t.status === "in-progress" && <button className="btn sm primary"><Icon name="check" size={13}/> ไปปิดงาน</button>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <div className="card"><Empty>ไม่พบประวัติที่ตรงกับเงื่อนไข</Empty></div>}
      </div>
    </div>
  );
}

Object.assign(window, { DispatchModule, DispatchTabs, DispatchOpenForm, DispatchCloseForm, DispatchReportTab, DispatchHistoryTab });
