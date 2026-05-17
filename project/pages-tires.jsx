// pages-tires.jsx — v3 complete rewrite (4 tabs: all / layout / manage / history)
const { useState: useStateTR, useMemo: useMemoTR, useEffect: useEffectTR } = React;

// ── Thresholds ────────────────────────────────────────────────────
const KM_WARN_T = 40000;
const KM_CRIT_T = 50000;

const kmStatusT = (km) => {
  if (km >= KM_CRIT_T) return { color:"#dc2626", bg:"#fee2e2", label:"ใกล้หมด",  dot:"red"   };
  if (km >= KM_WARN_T) return { color:"#d97706", bg:"#fef3c7", label:"ปานกลาง", dot:"amber" };
  return                      { color:"#16a34a", bg:"#dcfce7", label:"ดี",       dot:"green" };
};

const LOC_LABEL = {
  "in-use":{ label:"ใช้งาน", cls:"blue"   },
  spare:   { label:"สำรอง",  cls:"gray"   },
  stock:   { label:"คลัง",   cls:"violet" },
  sold:    { label:"ขาย",    cls:"red"    },
};

const EV_META = {
  install:{ label:"ติดตั้ง",      icon:"📌", cls:"green" },
  swap:   { label:"สลับตำแหน่ง", icon:"↔️", cls:"blue"  },
  remove: { label:"ถอด",         icon:"📍", cls:"amber" },
  sell:   { label:"ขาย",         icon:"🏪", cls:"red"   },
};

const wcFrom = (type="") => {
  if (type.includes("22")) return 22;
  if (type.includes("18")) return 18;
  if (type.includes("10")) return 10;
  if (type.includes("6"))  return 6;
  if (type.includes("4"))  return 4;
  return 10;
};

// ── SVG Layouts (top-view: front = top, left side = left) ─────────
const TL = {
  4: {
    h:300,
    axles:[{x1:38,y1:95,x2:262,y2:95},{x1:38,y1:220,x2:262,y2:220}],
    pos:[
      {pos:"P1",cx:50, cy:95, r:22},{pos:"P2",cx:250,cy:95, r:22},
      {pos:"P3",cx:50, cy:220,r:22},{pos:"P4",cx:250,cy:220,r:22},
    ],
  },
  6: {
    h:370,
    axles:[{x1:38,y1:90,x2:262,y2:90},{x1:26,y1:268,x2:274,y2:268}],
    pos:[
      {pos:"P1",cx:50, cy:90, r:22},{pos:"P2",cx:250,cy:90, r:22},
      {pos:"P3",cx:42, cy:268,r:18},{pos:"P4",cx:68, cy:268,r:18},
      {pos:"P5",cx:232,cy:268,r:18},{pos:"P6",cx:258,cy:268,r:18},
    ],
  },
  10: {
    h:455,
    axles:[
      {x1:38,y1:90, x2:262,y2:90},
      {x1:26,y1:232,x2:274,y2:232},
      {x1:26,y1:360,x2:274,y2:360},
    ],
    pos:[
      {pos:"P1", cx:50, cy:90, r:22},{pos:"P2", cx:250,cy:90, r:22},
      {pos:"P3", cx:42, cy:232,r:18},{pos:"P4", cx:68, cy:232,r:18},
      {pos:"P5", cx:232,cy:232,r:18},{pos:"P6", cx:258,cy:232,r:18},
      {pos:"P7", cx:42, cy:360,r:18},{pos:"P8", cx:68, cy:360,r:18},
      {pos:"P9", cx:232,cy:360,r:18},{pos:"P10",cx:258,cy:360,r:18},
    ],
  },
  18: {
    h:610,
    axles:[
      {x1:38,y1:83, x2:262,y2:83},
      {x1:26,y1:190,x2:274,y2:190},
      {x1:26,y1:297,x2:274,y2:297},
      {x1:26,y1:404,x2:274,y2:404},
      {x1:26,y1:511,x2:274,y2:511},
    ],
    pos:[
      {pos:"P1", cx:50, cy:83, r:22},{pos:"P2", cx:250,cy:83, r:22},
      {pos:"P3", cx:40, cy:190,r:16},{pos:"P4", cx:63, cy:190,r:16},
      {pos:"P5", cx:237,cy:190,r:16},{pos:"P6", cx:260,cy:190,r:16},
      {pos:"P7", cx:40, cy:297,r:16},{pos:"P8", cx:63, cy:297,r:16},
      {pos:"P9", cx:237,cy:297,r:16},{pos:"P10",cx:260,cy:297,r:16},
      {pos:"P11",cx:40, cy:404,r:16},{pos:"P12",cx:63, cy:404,r:16},
      {pos:"P13",cx:237,cy:404,r:16},{pos:"P14",cx:260,cy:404,r:16},
      {pos:"P15",cx:40, cy:511,r:16},{pos:"P16",cx:63, cy:511,r:16},
      {pos:"P17",cx:237,cy:511,r:16},{pos:"P18",cx:260,cy:511,r:16},
    ],
  },
  22: {
    h:710,
    axles:[
      {x1:38,y1:83, x2:262,y2:83},
      {x1:26,y1:185,x2:274,y2:185},
      {x1:26,y1:283,x2:274,y2:283},
      {x1:26,y1:381,x2:274,y2:381},
      {x1:26,y1:483,x2:274,y2:483},
      {x1:26,y1:585,x2:274,y2:585},
    ],
    pos:[
      {pos:"P1", cx:50, cy:83, r:22},{pos:"P2", cx:250,cy:83, r:22},
      {pos:"P3", cx:38, cy:185,r:14},{pos:"P4", cx:59, cy:185,r:14},
      {pos:"P5", cx:241,cy:185,r:14},{pos:"P6", cx:262,cy:185,r:14},
      {pos:"P7", cx:38, cy:283,r:14},{pos:"P8", cx:59, cy:283,r:14},
      {pos:"P9", cx:241,cy:283,r:14},{pos:"P10",cx:262,cy:283,r:14},
      {pos:"P11",cx:38, cy:381,r:14},{pos:"P12",cx:59, cy:381,r:14},
      {pos:"P13",cx:241,cy:381,r:14},{pos:"P14",cx:262,cy:381,r:14},
      {pos:"P15",cx:38, cy:483,r:14},{pos:"P16",cx:59, cy:483,r:14},
      {pos:"P17",cx:241,cy:483,r:14},{pos:"P18",cx:262,cy:483,r:14},
      {pos:"P19",cx:38, cy:585,r:14},{pos:"P20",cx:59, cy:585,r:14},
      {pos:"P21",cx:241,cy:585,r:14},{pos:"P22",cx:262,cy:585,r:14},
    ],
  },
};

// ── Pure SVG Tire Map ─────────────────────────────────────────────
function TireMapSVG_T({ wc, tireMap, selectedPos, onSelect, selectable }) {
  const layout = TL[wc] || TL[10];
  return (
    <div style={{ overflowY:"auto", maxHeight:520 }}>
      <svg width={300} height={layout.h} viewBox={`0 0 300 ${layout.h}`}
        style={{ display:"block", margin:"0 auto" }}>
        {/* Truck outline */}
        <rect x={93} y={18} width={114} height={layout.h-36} rx={8}
          fill="#f8fafc" stroke="#e2e8f0" strokeWidth={1.5}/>
        <text x={150} y={12} textAnchor="middle" fontSize={9} fill="#94a3b8"
          fontFamily="system-ui">▲ หน้ารถ</text>
        {/* Axle lines */}
        {layout.axles.map((a,i)=>(
          <line key={i} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2}
            stroke="#94a3b8" strokeWidth={2.5}/>
        ))}
        {/* Tires */}
        {layout.pos.map(p=>{
          const t = tireMap[p.pos];
          const isSel = selectedPos === p.pos;
          const km = t?.accumulatedKm||0;
          let fillC, strokeC;
          if (isSel)                      { fillC="#dbeafe"; strokeC="#2563eb"; }
          else if (!t)                    { fillC="#e2e8f0"; strokeC="#94a3b8"; }
          else if (t.status==="spare")    { fillC="#f8fafc"; strokeC="#94a3b8"; }
          else if (km>=KM_CRIT_T)         { fillC="#fee2e2"; strokeC="#dc2626"; }
          else if (km>=KM_WARN_T)         { fillC="#fef3c7"; strokeC="#d97706"; }
          else                            { fillC="#dcfce7"; strokeC="#16a34a"; }
          return (
            <g key={p.pos} onClick={()=>selectable&&onSelect&&onSelect(p.pos,t)}
              style={{cursor:selectable?"pointer":"default"}}>
              <circle cx={p.cx} cy={p.cy} r={p.r}
                fill={fillC} stroke={strokeC} strokeWidth={isSel?3:2}/>
              <circle cx={p.cx} cy={p.cy} r={p.r*.38}
                fill="none" stroke={strokeC} strokeWidth={1.2} opacity={.55}/>
              <text x={p.cx} y={p.cy+4} textAnchor="middle"
                fontSize={p.r>=20?10:p.r>=16?9:8}
                fill={isSel?"#1d4ed8":strokeC}
                fontWeight="700" fontFamily="system-ui">{p.pos}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Module Router ─────────────────────────────────────────────────
function TiresModule({ tab, setActive, subject, setSubject }) {
  const cur = tab==="layout"?"layout":tab==="manage"?"manage":tab==="history"?"history":"all";
  const [showAdd, setShowAdd] = useStateTR(false);
  return (
    <div>
      <div className="page-head">
        <div><h1 className="page-title">ระบบยาง</h1></div>
        {cur==="all" && (
          <div className="actions">
            <button className="btn primary" onClick={()=>setShowAdd(true)}>
              <Icon name="plus" size={14}/> เพิ่มยางใหม่
            </button>
          </div>
        )}
      </div>
      <div className="tabs" style={{marginBottom:22}}>
        {[["all","","รายการยางทั้งหมด"],["layout","layout","ผังยางปัจจุบัน"],
          ["manage","manage","จัดการและสลับยาง"],["history","history","ประวัติยางรายเส้น"]].map(([id,route,label])=>(
          <button key={id} className={`tab ${cur===id?"active":""}`}
            onClick={()=>setActive("tires"+(route?"."+route:""))}>
            {label}
          </button>
        ))}
      </div>
      {cur==="all"     && <TiresAll/>}
      {cur==="layout"  && <TiresLayout subject={subject} setSubject={setSubject}/>}
      {cur==="manage"  && <TiresManageFull/>}
      {cur==="history" && <TiresHistoryFull/>}
      {showAdd && <AddTireModal onClose={()=>setShowAdd(false)}/>}
    </div>
  );
}

// ── Tab 1: All Tires ─────────────────────────────────────────────
function TiresAll() {
  const D = window.KPSData;
  const allTires = D.getAll("tires");
  const events   = D.getAll("tire_events");
  const vehicles = D.getAll("vehicles");
  const brands   = [...new Set(allTires.map(t=>t.brand))];

  const [q,setQ]           = useStateTR("");
  const [sfilt,setSfilt]   = useStateTR({"in-use":true,spare:true,stock:true,sold:true});
  const [vfilt,setVfilt]   = useStateTR("all");
  const [bfilt,setBfilt]   = useStateTR("all");

  const filtered = useMemoTR(()=>allTires.filter(t=>{
    if(q&&!t.serial.toLowerCase().includes(q.toLowerCase())&&!t.brand.toLowerCase().includes(q.toLowerCase()))return false;
    if(!sfilt[t.status])return false;
    if(vfilt!=="all"&&t.vehicleId!==vfilt)return false;
    if(bfilt!=="all"&&t.brand!==bfilt)return false;
    return true;
  }),[allTires,q,sfilt,vfilt,bfilt]);

  const hasEvent = (tid)=>events.some(e=>e.tireId===tid);

  const kpiCounts = useMemoTR(()=>({
    total:allTires.length,
    good: allTires.filter(t=>t.status==="in-use"&&(t.accumulatedKm||0)<KM_WARN_T).length,
    warn: allTires.filter(t=>t.status==="in-use"&&(t.accumulatedKm||0)>=KM_WARN_T&&(t.accumulatedKm||0)<KM_CRIT_T).length,
    crit: allTires.filter(t=>t.status==="in-use"&&(t.accumulatedKm||0)>=KM_CRIT_T).length,
  }),[allTires]);

  return (
    <div>
      {/* KPI */}
      <div className="grid-4" style={{marginBottom:18}}>
        <div className="card kpi"><div className="label">ยางทั้งหมด</div><div className="mono" style={{fontSize:26,fontWeight:700,marginTop:8}}>{kpiCounts.total} <span style={{fontSize:13,fontWeight:400}}>เส้น</span></div></div>
        <div className="card kpi"><div className="row" style={{gap:8}}><div className="icn-box green"><Icon name="check" size={16}/></div><div className="label">สภาพดี (ใช้งาน)</div></div><div className="mono" style={{fontSize:26,fontWeight:700,marginTop:8,color:"var(--green)"}}>{kpiCounts.good}</div></div>
        <div className="card kpi"><div className="row" style={{gap:8}}><div className="icn-box amber"><Icon name="alert" size={16}/></div><div className="label">ปานกลาง</div></div><div className="mono" style={{fontSize:26,fontWeight:700,marginTop:8,color:"var(--amber)"}}>{kpiCounts.warn}</div></div>
        <div className="card kpi"><div className="row" style={{gap:8}}><div className="icn-box red"><Icon name="alert" size={16}/></div><div className="label">ใกล้หมด / วิกฤติ</div></div><div className="mono" style={{fontSize:26,fontWeight:700,marginTop:8,color:"var(--red)"}}>{kpiCounts.crit}</div></div>
      </div>

      <div className="card">
        {/* Filters */}
        <div style={{padding:"16px 20px",borderBottom:"1px solid var(--line)"}}>
          <div className="row" style={{gap:16,alignItems:"flex-end",flexWrap:"wrap"}}>
            <div style={{position:"relative",flex:1,minWidth:220}}>
              <Icon name="search" size={14} style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"var(--text-faint)"}}/>
              <input value={q} onChange={e=>setQ(e.target.value)} placeholder="ค้นหา เลขซีเรียล / ยี่ห้อ"
                style={{width:"100%",height:38,padding:"0 12px 0 36px",border:"1px solid var(--line)",borderRadius:8,background:"var(--bg)",fontSize:13}}/>
            </div>
            {/* Status checkboxes */}
            <div className="row" style={{gap:4,flexWrap:"wrap"}}>
              <span className="muted" style={{fontWeight:600,fontSize:13,marginRight:6}}>สถานะ:</span>
              {Object.entries(LOC_LABEL).map(([k,{label,cls}])=>(
                <label key={k} className="row" style={{gap:6,cursor:"pointer",fontSize:13,padding:"4px 10px",border:"1px solid var(--line)",borderRadius:20,background:sfilt[k]?"var(--primary-50)":"var(--bg)"}}>
                  <input type="checkbox" checked={!!sfilt[k]} onChange={()=>setSfilt(s=>({...s,[k]:!s[k]}))} style={{accentColor:"var(--primary)"}}/>
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <Field label="รถ">
              <select value={vfilt} onChange={e=>setVfilt(e.target.value)} style={{width:160,height:38}}>
                <option value="all">ทั้งหมด</option>
                {vehicles.map(v=><option key={v.id} value={v.id}>{v.plate}</option>)}
              </select>
            </Field>
            <Field label="ยี่ห้อ">
              <select value={bfilt} onChange={e=>setBfilt(e.target.value)} style={{width:140,height:38}}>
                <option value="all">ทั้งหมด</option>
                {brands.map(b=><option key={b} value={b}>{b}</option>)}
              </select>
            </Field>
          </div>
        </div>

        {/* Table */}
        <div className="tbl-wrap" style={{border:"none",borderRadius:0}}>
          <table className="tbl">
            <thead><tr>
              <th>เลขซีเรียล</th>
              <th>ยี่ห้อ</th>
              <th>รุ่น</th>
              <th>ขนาด</th>
              <th>สถานะ</th>
              <th>รถ</th>
              <th>ล้อ</th>
              <th className="right">Km สะสม</th>
              <th className="center">บันทึก</th>
              <th>ดำเนิน</th>
            </tr></thead>
            <tbody>
              {filtered.map(t=>{
                const v = D.get("vehicles",t.vehicleId);
                const km = t.accumulatedKm||0;
                const ks = kmStatusT(km);
                const isActive = t.status==="in-use";
                const posLabel = t.position ? (t.position.startsWith("spare")?"S"+t.position.slice(-1):t.position) : "—";
                return (
                  <tr key={t.id}>
                    <td><span className="mono" style={{fontWeight:700,color:"var(--primary)"}}>{t.serial}</span></td>
                    <td style={{fontWeight:500}}>{t.brand}</td>
                    <td className="muted">{t.model}</td>
                    <td className="mono muted">{t.size}</td>
                    <td>
                      {isActive ? (
                        <span style={{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 10px",borderRadius:20,background:ks.bg,color:ks.color,fontWeight:600,fontSize:12.5}}>
                          <span style={{width:7,height:7,borderRadius:"50%",background:ks.color,flexShrink:0}}></span>
                          {ks.label}
                        </span>
                      ) : (
                        <span className={`badge ${LOC_LABEL[t.status]?.cls||"gray"}`}>{LOC_LABEL[t.status]?.label||t.status}</span>
                      )}
                    </td>
                    <td>{v?<a style={{color:"var(--primary)",fontWeight:600}} className="mono">{v.plate}</a>:"—"}</td>
                    <td><span className="badge gray">{posLabel}</span></td>
                    <td className="num right mono">
                      {isActive ? (
                        <span style={{color:ks.color,fontWeight:600}}>{D.fmt(km)}</span>
                      ) : (
                        <span className="muted">0</span>
                      )}
                    </td>
                    <td className="center">{hasEvent(t.id)?<span style={{color:"var(--green)",fontWeight:700}}>✓</span>:"—"}</td>
                    <td>
                      <TireActionMenu tire={t} vehicleId={t.vehicleId}/>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{padding:"12px 20px",borderTop:"1px solid var(--line)",color:"var(--text-muted)",fontSize:12.5}}>
          แสดง {filtered.length} จากทั้งหมด {allTires.length} รายการ
        </div>
      </div>
    </div>
  );
}

function TireActionMenu({ tire }) {
  const [open,setOpen] = useStateTR(false);
  const actions=[
    {icon:"dashboard",label:"ดูประวัติ"},
    {icon:"arrow-right",label:"สลับยาง"},
    {icon:"edit",label:"แก้ไข"},
    {icon:"trash",label:"ลบ",danger:true},
  ];
  return (
    <div style={{position:"relative"}}>
      <button className="btn ghost icon sm" onClick={()=>setOpen(o=>!o)}><Icon name="more" size={16}/></button>
      {open && (
        <>
          <div style={{position:"fixed",inset:0,zIndex:90}} onClick={()=>setOpen(false)}/>
          <div style={{position:"absolute",right:0,top:28,zIndex:100,background:"#fff",border:"1px solid var(--line)",borderRadius:10,boxShadow:"0 4px 16px rgba(0,0,0,.1)",minWidth:140,padding:6}}>
            {actions.map(a=>(
              <button key={a.label} className="btn ghost" onClick={()=>{setOpen(false);}}
                style={{width:"100%",justifyContent:"flex-start",gap:8,padding:"7px 12px",color:a.danger?"var(--red)":undefined}}>
                <Icon name={a.icon} size={14}/> {a.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Add Tire Modal ────────────────────────────────────────────────
function AddTireModal({ onClose }) {
  const D = window.KPSData;
  const tires = D.getAll("tires");
  const nextSerial = "TIR" + String(tires.length+1).padStart(4,"0");
  const [form,setForm] = useStateTR({
    serial:nextSerial, brand:"Bridgestone", model:"T001", size:"11.00R20",
    status:"in-use", vehicleId:"", position:"P1",
    installedDate:new Date().toISOString().slice(0,10), installedOdometer:"", accumulatedKm:0,
  });
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const vehicles = D.getAll("vehicles");
  const wc = wcFrom(D.get("vehicles",form.vehicleId)?.type||"");
  const layout = TL[wc]||TL[10];
  const allPos = layout.pos.map(p=>p.pos).concat(["spare_1","spare_2"]);

  const save=()=>{
    if(!form.serial||!form.brand) { alert("กรุณากรอกเลขซีเรียลและยี่ห้อ"); return; }
    D.add("tires",{...form, installedOdometer:+form.installedOdometer||0, accumulatedKm:0});
    if(form.status==="in-use"&&form.vehicleId) {
      D.add("tire_events",{
        tireId:"auto", vehicleId:form.vehicleId, eventType:"install",
        date:form.installedDate, odometer:+form.installedOdometer||0,
        fromPos:null, toPos:form.position, note:"ยางใหม่", userId:"e10",
      });
    }
    alert("เพิ่มยางเรียบร้อย"); onClose();
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000}}>
      <div className="card" style={{width:600,maxWidth:"95vw",maxHeight:"90vh",overflowY:"auto"}}>
        <div className="row" style={{padding:"16px 20px",borderBottom:"1px solid var(--line)"}}>
          <h3 style={{margin:0,fontSize:17,fontWeight:700}}>เพิ่มยางใหม่</h3>
          <button className="btn ghost icon sm" onClick={onClose}><Icon name="close" size={16}/></button>
        </div>
        <div style={{padding:22}} className="col">
          <div className="grid-2" style={{gap:14}}>
            <Field label="เลขซีเรียล *"><input value={form.serial} onChange={e=>set("serial",e.target.value)}/></Field>
            <Field label="ยี่ห้อ *">
              <select value={form.brand} onChange={e=>set("brand",e.target.value)}>
                <option>Bridgestone</option><option>Michelin</option><option>Goodyear</option>
                <option>Dunlop</option><option>Yokohama</option><option>Continental</option>
              </select>
            </Field>
            <Field label="รุ่น *"><input value={form.model} onChange={e=>set("model",e.target.value)}/></Field>
            <Field label="ขนาด *">
              <select value={form.size} onChange={e=>set("size",e.target.value)}>
                {["11.00R20","11R22.5","12.00R24","10.00R20","295/80R22.5","315/80R22.5","265/65R17"].map(s=><option key={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          <div style={{marginTop:16}}>
            <div style={{fontWeight:600,marginBottom:10}}>สถานะเริ่มต้น</div>
            <div className="row" style={{gap:14}}>
              {Object.entries(LOC_LABEL).filter(([k])=>k!=="sold").map(([k,{label}])=>(
                <label key={k} className="row" style={{gap:6,cursor:"pointer",padding:"8px 14px",border:`2px solid ${form.status===k?"var(--primary)":"var(--line)"}`,borderRadius:10,fontSize:13.5,fontWeight:form.status===k?600:400}}>
                  <input type="radio" checked={form.status===k} onChange={()=>set("status",k)} style={{accentColor:"var(--primary)"}}/>
                  {label}
                </label>
              ))}
            </div>
          </div>

          {(form.status==="in-use"||form.status==="spare") && (
            <div className="grid-2" style={{gap:14,marginTop:16}}>
              <Field label="เลือกรถ *">
                <select value={form.vehicleId} onChange={e=>set("vehicleId",e.target.value)}>
                  <option value="">-- เลือกรถ --</option>
                  {vehicles.map(v=><option key={v.id} value={v.id}>{v.plate} ({v.type})</option>)}
                </select>
              </Field>
              {form.status==="in-use" && (
                <Field label="ตำแหน่งล้อ *">
                  <select value={form.position} onChange={e=>set("position",e.target.value)}>
                    {allPos.map(p=><option key={p} value={p}>{p.startsWith("spare")?"ยางสำรอง":"ล้อ"} {p}</option>)}
                  </select>
                </Field>
              )}
            </div>
          )}

          <div className="grid-2" style={{gap:14,marginTop:14}}>
            <Field label="วันที่ซื้อ / ติดตั้ง"><input type="date" value={form.installedDate} onChange={e=>set("installedDate",e.target.value)}/></Field>
            {form.status==="in-use" && <Field label="เลขไมล์รถตอนติดตั้ง"><input type="number" value={form.installedOdometer} onChange={e=>set("installedOdometer",e.target.value)} placeholder="0"/></Field>}
          </div>
        </div>
        <div className="row" style={{padding:"14px 22px",borderTop:"1px solid var(--line)",justifyContent:"flex-end",gap:8}}>
          <button className="btn" onClick={onClose}>ยกเลิก</button>
          <button className="btn primary" onClick={save}>💾 บันทึกยางใหม่</button>
        </div>
      </div>
    </div>
  );
}

// ── Tab 2: Layout ─────────────────────────────────────────────────
function TiresLayout({ subject, setSubject }) {
  const D = window.KPSData;
  const vehicles = D.getAll("vehicles");
  const [picked, setPicked] = useStateTR(subject?.vehicleId||vehicles[0]?.id||"");
  const [popup, setPopup]   = useStateTR(null);

  const v = D.get("vehicles",picked);
  const wc = wcFrom(v?.type||"");
  const allTires = D.getAll("tires").filter(t=>t.vehicleId===picked);
  const tireMap = {};
  allTires.forEach(t=>{ if(t.position) tireMap[t.position]=t; });
  const spares = allTires.filter(t=>t.position?.startsWith("spare"));

  return (
    <div>
      {/* Vehicle picker */}
      <div className="card pad" style={{marginBottom:18}}>
        <div className="row" style={{gap:20,alignItems:"flex-end",flexWrap:"wrap"}}>
          <Field label="เลือกรถ">
            <select value={picked} onChange={e=>{ setPicked(e.target.value); setPopup(null); }}
              style={{width:320,height:42,fontSize:14}}>
              {vehicles.map(vv=><option key={vv.id} value={vv.id}>{vv.plate} ({vv.type})</option>)}
            </select>
          </Field>
          {v && (
            <div style={{fontSize:13.5,color:"var(--text-2)"}}>
              <span className="mono" style={{fontWeight:600}}>{v.plate}</span>
              <span className="muted" style={{marginLeft:10}}>{v.type} · {wc} ล้อ</span>
              <span className="muted" style={{marginLeft:10}}>เลขไมล์: <span className="mono">{D.fmt(v.odometer)} km</span></span>
            </div>
          )}
        </div>
      </div>

      {v && (
        <div style={{display:"grid",gridTemplateColumns:"320px 1fr",gap:18,alignItems:"start"}}>
          {/* SVG Map */}
          <div className="card" style={{padding:20}}>
            <div style={{fontWeight:600,fontSize:15,marginBottom:12}}>ผังยาง {wc} ล้อ</div>
            <TireMapSVG_T wc={wc} tireMap={tireMap} selectedPos={popup?.pos}
              onSelect={(pos,t)=>setPopup({pos,tire:t})} selectable={true}/>

            {/* Spare tires */}
            {spares.length>0 && (
              <div style={{marginTop:18,padding:14,background:"var(--bg-sunk)",borderRadius:10}}>
                <div style={{fontSize:12.5,fontWeight:600,marginBottom:10,color:"var(--text-muted)"}}>⚪ ยางสำรอง (ไม่สะสม km)</div>
                {spares.map((t,i)=>(
                  <div key={t.id} className="row" style={{gap:8,padding:"8px 0",borderTop:i>0?"1px solid var(--line)":undefined,cursor:"pointer"}}
                    onClick={()=>setPopup({pos:t.position,tire:t})}>
                    <svg width="28" height="28" viewBox="0 0 28 28">
                      <circle cx="14" cy="14" r="13" fill="#f8fafc" stroke="#94a3b8" strokeWidth="2"/>
                      <circle cx="14" cy="14" r="5" fill="#94a3b8" opacity=".5"/>
                    </svg>
                    <div>
                      <div style={{fontWeight:600,fontSize:13}}>{t.serial}</div>
                      <div className="muted" style={{fontSize:11.5}}>{t.brand} {t.model}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Legend */}
            <div className="col" style={{marginTop:16,gap:6,fontSize:12.5}}>
              {[["#16a34a","#dcfce7","ดี (< 40,000 km)"],["#d97706","#fef3c7","ปานกลาง (40k-50k km)"],["#dc2626","#fee2e2","ใกล้หมด (> 50,000 km)"],["#94a3b8","#f8fafc","สำรอง / ว่าง"]].map(([c,bg,label])=>(
                <div key={label} className="row" style={{gap:8}}>
                  <span style={{width:16,height:16,borderRadius:"50%",background:bg,border:`2px solid ${c}`,flexShrink:0}}></span>
                  <span style={{color:"var(--text-2)"}}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Detail panel */}
          <div>
            {popup ? (
              <div className="card" style={{padding:22}}>
                <div className="row" style={{marginBottom:16}}>
                  <h3 style={{margin:0,fontSize:16,fontWeight:700}}>
                    {popup.pos.startsWith("spare")?"ยางสำรอง":"ตำแหน่ง "+popup.pos}
                  </h3>
                  <button className="btn ghost icon sm" onClick={()=>setPopup(null)}><Icon name="close" size={15}/></button>
                </div>
                {popup.tire ? (
                  <div className="col" style={{gap:12}}>
                    {[
                      ["Serial",   <span className="mono" style={{fontWeight:700,color:"var(--primary)"}}>{popup.tire.serial}</span>],
                      ["Brand/Model",`${popup.tire.brand} ${popup.tire.model}`],
                      ["ขนาด",       popup.tire.size],
                      ["Km สะสม",    <span style={{color:kmStatusT(popup.tire.accumulatedKm||0).color,fontWeight:700}}>{D.fmt(popup.tire.accumulatedKm||0)} km</span>],
                      ["ติดตั้งเมื่อ", D.thaiDate(popup.tire.installedDate)],
                      ["เลขไมล์ตอนติดตั้ง",<span className="mono">{D.fmt(popup.tire.installedOdometer||0)} km</span>],
                    ].map(([l,val])=>(
                      <div key={l} className="row" style={{gap:8,alignItems:"flex-start"}}>
                        <div style={{width:150,color:"var(--text-muted)",fontSize:13,flexShrink:0}}>{l}</div>
                        <div style={{fontSize:13.5}}>{val}</div>
                      </div>
                    ))}
                    {popup.tire.status==="in-use" && (() => {
                      const s = kmStatusT(popup.tire.accumulatedKm||0);
                      return (
                        <div style={{padding:"12px 16px",background:s.bg,borderRadius:10,marginTop:4}}>
                          <span style={{color:s.color,fontWeight:700}}>สภาพยาง: {s.label}</span>
                        </div>
                      );
                    })()}
                    <div className="row" style={{marginTop:8,gap:8}}>
                      <button className="btn outline sm">ดูประวัติ</button>
                      <button className="btn primary sm">↔️ สลับยาง</button>
                    </div>
                  </div>
                ) : (
                  <div className="muted" style={{padding:20,textAlign:"center",fontSize:13}}>
                    ไม่มียางในตำแหน่งนี้
                  </div>
                )}
              </div>
            ) : (
              <div className="card pad" style={{textAlign:"center",color:"var(--text-muted)",fontSize:13.5}}>
                <Icon name="tire" size={40} style={{opacity:.2,marginBottom:12}}/>
                <div>คลิกที่ล้อในผังเพื่อดูรายละเอียด</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab 3: Manage & Swap ──────────────────────────────────────────
function TiresManageFull() {
  const D = window.KPSData;
  const vehicles = D.getAll("vehicles");
  const [step,setStep] = useStateTR(1);
  const [sw,setSw]     = useStateTR({ vehicleId:"", fromPos:"", toPos:"", note:"" });
  const set=(k,v)=>setSw(s=>({...s,[k]:v}));

  const veh = D.get("vehicles",sw.vehicleId);
  const wc  = wcFrom(veh?.type||"");
  const vTires = sw.vehicleId ? D.getAll("tires").filter(t=>t.vehicleId===sw.vehicleId) : [];
  const tireMap = {};
  vTires.forEach(t=>{ if(t.position) tireMap[t.position]=t; });
  const layout = TL[wc]||TL[10];
  const allPos = layout.pos.map(p=>p.pos).concat(["spare_1","spare_2"]);

  const fromTire = vTires.find(t=>t.position===sw.fromPos);
  const toTire   = vTires.find(t=>t.position===sw.toPos);

  const doSwap = () => {
    if(!sw.vehicleId||!sw.fromPos||!sw.toPos) return;
    const odometer = veh?.odometer||0;
    const userId = "e10";
    if(fromTire) D.update("tires",fromTire.id,{position:sw.toPos});
    if(toTire)   D.update("tires",toTire.id,  {position:sw.fromPos});
    D.add("tire_events",{
      tireId:fromTire?.id||"", vehicleId:sw.vehicleId, eventType:"swap",
      date:new Date().toISOString().slice(0,10), odometer,
      fromPos:sw.fromPos, toPos:sw.toPos, note:sw.note||"สลับยาง", userId,
    });
    alert("✅ สลับยางสำเร็จ");
    setSw({vehicleId:sw.vehicleId,fromPos:"",toPos:"",note:""});
    setStep(1);
  };

  const steps=["เลือกรถ","เลือกล้อเดิม","เลือกล้อใหม่","ยืนยัน"];

  return (
    <div>
      {/* Step indicator */}
      <div className="card" style={{padding:"20px 24px",marginBottom:18}}>
        <div className="row" style={{gap:0}}>
          {steps.map((s,i)=>{
            const n=i+1;
            const done=step>n; const cur=step===n;
            return (
              <div key={s} style={{display:"flex",alignItems:"center",flex:i<steps.length-1?1:undefined}}>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
                  <div style={{width:36,height:36,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:15,
                    background:done?"var(--green)":cur?"var(--primary)":"var(--bg-sunk)",
                    color:done||cur?"white":"var(--text-muted)",
                    border:`2px solid ${done?"var(--green)":cur?"var(--primary)":"var(--line)"}`}}>
                    {done?"✓":n}
                  </div>
                  <span style={{fontSize:12,color:cur?"var(--primary)":done?"var(--green)":"var(--text-muted)",fontWeight:cur?700:400,whiteSpace:"nowrap"}}>{s}</span>
                </div>
                {i<steps.length-1&&<div style={{flex:1,height:2,background:done?"var(--green)":"var(--line)",margin:"0 8px",marginBottom:22}}/>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card pad">
        {/* Step 1: Select Vehicle */}
        {step===1 && (
          <div>
            <h3 style={{margin:"0 0 18px",fontSize:16,fontWeight:600}}>① เลือกรถที่ต้องการสลับยาง</h3>
            <div className="tbl-wrap" style={{border:"1px solid var(--line)",borderRadius:10}}>
              <table className="tbl">
                <thead><tr><th>ทะเบียน</th><th>ประเภท</th><th>จำนวนล้อ</th><th>ยางที่บันทึก</th><th>เลือก</th></tr></thead>
                <tbody>
                  {vehicles.map(vv=>{
                    const wcc=wcFrom(vv.type||"");
                    const cnt=D.getAll("tires").filter(t=>t.vehicleId===vv.id).length;
                    const sel=sw.vehicleId===vv.id;
                    return (
                      <tr key={vv.id} style={{cursor:"pointer",background:sel?"var(--primary-50)":undefined}} onClick={()=>set("vehicleId",vv.id)}>
                        <td><span className="mono" style={{fontWeight:700}}>{vv.plate}</span></td>
                        <td>{vv.type}</td>
                        <td>{wcc} ล้อ</td>
                        <td><span className="badge blue">{cnt} เส้น</span></td>
                        <td><input type="radio" checked={sel} onChange={()=>set("vehicleId",vv.id)} style={{accentColor:"var(--primary)"}}/></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {sw.vehicleId&&<div className="row" style={{marginTop:18,justifyContent:"flex-end"}}><button className="btn primary" onClick={()=>setStep(2)}>ถัดไป →</button></div>}
          </div>
        )}

        {/* Step 2: Select from position */}
        {step===2 && (
          <div>
            <h3 style={{margin:"0 0 6px",fontSize:16,fontWeight:600}}>② เลือกล้อเดิม (ต้นทาง) — คลิกที่วงล้อ</h3>
            <div className="muted" style={{fontSize:12.5,marginBottom:16}}>รถ: <strong>{veh?.plate}</strong> · {wc} ล้อ</div>
            <div style={{display:"grid",gridTemplateColumns:"260px 1fr",gap:20,alignItems:"start"}}>
              <TireMapSVG_T wc={wc} tireMap={tireMap} selectedPos={sw.fromPos}
                onSelect={(pos)=>set("fromPos",pos)} selectable={true}/>
              <div>
                <Field label="หรือเลือกจาก Dropdown">
                  <select value={sw.fromPos} onChange={e=>set("fromPos",e.target.value)} style={{height:42,fontSize:14}}>
                    <option value="">-- เลือกตำแหน่งต้นทาง --</option>
                    {allPos.map(p=>{ const t=tireMap[p]; return <option key={p} value={p}>{p.startsWith("spare")?"ยางสำรอง":p} {t?`— ${t.serial}`:"(ว่าง)"}</option>; })}
                  </select>
                </Field>
                {sw.fromPos&&fromTire&&(
                  <div style={{marginTop:16,padding:14,background:"var(--primary-50)",borderRadius:10}}>
                    <div style={{fontWeight:600,marginBottom:6}}>ยางที่เลือก:</div>
                    <Info label="Serial"    value={<span className="mono" style={{fontWeight:600}}>{fromTire.serial}</span>}/>
                    <Info label="Brand"     value={`${fromTire.brand} ${fromTire.model}`}/>
                    <Info label="Km สะสม"  value={<span style={{color:kmStatusT(fromTire.accumulatedKm||0).color,fontWeight:600}}>{D.fmt(fromTire.accumulatedKm||0)} km</span>}/>
                  </div>
                )}
              </div>
            </div>
            <div className="row" style={{marginTop:18,gap:8,justifyContent:"flex-end"}}>
              <button className="btn" onClick={()=>setStep(1)}>← ย้อนกลับ</button>
              <button className="btn primary" onClick={()=>setStep(3)} disabled={!sw.fromPos}>ถัดไป →</button>
            </div>
          </div>
        )}

        {/* Step 3: Select to position */}
        {step===3 && (
          <div>
            <h3 style={{margin:"0 0 6px",fontSize:16,fontWeight:600}}>③ เลือกล้อใหม่ (ปลายทาง)</h3>
            <div className="muted" style={{fontSize:12.5,marginBottom:16}}>จาก: <strong>{sw.fromPos.startsWith("spare")?"ยางสำรอง":sw.fromPos}</strong> → คลิกเลือกปลายทาง</div>
            <div style={{display:"grid",gridTemplateColumns:"260px 1fr",gap:20,alignItems:"start"}}>
              <TireMapSVG_T wc={wc} tireMap={tireMap} selectedPos={sw.toPos}
                onSelect={(pos)=>{ if(pos!==sw.fromPos) set("toPos",pos); }} selectable={true}/>
              <div>
                <Field label="หรือเลือกจาก Dropdown">
                  <select value={sw.toPos} onChange={e=>set("toPos",e.target.value)} style={{height:42,fontSize:14}}>
                    <option value="">-- เลือกตำแหน่งปลายทาง --</option>
                    {allPos.filter(p=>p!==sw.fromPos).map(p=>{ const t=tireMap[p]; return <option key={p} value={p}>{p.startsWith("spare")?"ยางสำรอง":p} {t?`— ${t.serial}`:"(ว่าง)"}</option>; })}
                  </select>
                </Field>
                {sw.toPos&&(
                  <div style={{marginTop:16,padding:14,background:"var(--bg-sunk)",borderRadius:10}}>
                    <div style={{fontWeight:600,marginBottom:6}}>ปลายทางที่เลือก: <span style={{color:"var(--primary)"}}>{sw.toPos.startsWith("spare")?"ยางสำรอง":sw.toPos}</span></div>
                    {toTire ? (
                      <>
                        <Info label="Serial ปัจจุบัน" value={<span className="mono">{toTire.serial}</span>}/>
                        <div className="muted" style={{fontSize:12,marginTop:4}}>* ยางที่อยู่ตำแหน่งนี้จะสลับมาอยู่ที่ {sw.fromPos.startsWith("spare")?"ยางสำรอง":sw.fromPos} แทน</div>
                      </>
                    ) : <div className="muted" style={{fontSize:12}}>ตำแหน่งว่าง</div>}
                  </div>
                )}
                <Field label="หมายเหตุ (ไม่บังคับ)"><textarea value={sw.note} onChange={e=>set("note",e.target.value)} rows="2" placeholder="เช่น หมุนยาง หน้า-หลัง" style={{marginTop:12}}/></Field>
              </div>
            </div>
            <div className="row" style={{marginTop:18,gap:8,justifyContent:"flex-end"}}>
              <button className="btn" onClick={()=>setStep(2)}>← ย้อนกลับ</button>
              <button className="btn primary" onClick={()=>setStep(4)} disabled={!sw.toPos}>ถัดไป →</button>
            </div>
          </div>
        )}

        {/* Step 4: Confirm */}
        {step===4 && (
          <div>
            <h3 style={{margin:"0 0 18px",fontSize:16,fontWeight:600}}>④ ยืนยันการสลับยาง</h3>
            <div style={{padding:22,background:"var(--bg-sunk)",borderRadius:12,marginBottom:18}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:16,alignItems:"center"}}>
                <div style={{padding:16,background:"#fff",borderRadius:10,border:"2px solid var(--primary)"}}>
                  <div className="muted" style={{fontSize:11.5,marginBottom:4}}>ยางต้นทาง</div>
                  <div style={{fontWeight:700,fontSize:15}}>{sw.fromPos.startsWith("spare")?"ยางสำรอง":sw.fromPos}</div>
                  {fromTire&&<div className="mono" style={{fontSize:13,color:"var(--primary)",marginTop:4}}>{fromTire.serial}</div>}
                  {fromTire&&<div className="muted" style={{fontSize:12}}>{D.fmt(fromTire.accumulatedKm||0)} km</div>}
                </div>
                <div style={{fontSize:28,color:"var(--primary)",fontWeight:700}}>↔️</div>
                <div style={{padding:16,background:"#fff",borderRadius:10,border:"2px solid var(--amber)"}}>
                  <div className="muted" style={{fontSize:11.5,marginBottom:4}}>ยางปลายทาง</div>
                  <div style={{fontWeight:700,fontSize:15}}>{sw.toPos.startsWith("spare")?"ยางสำรอง":sw.toPos}</div>
                  {toTire?<><div className="mono" style={{fontSize:13,color:"var(--amber)",marginTop:4}}>{toTire.serial}</div><div className="muted" style={{fontSize:12}}>{D.fmt(toTire.accumulatedKm||0)} km</div></>:<div className="muted" style={{fontSize:12}}>ตำแหน่งว่าง</div>}
                </div>
              </div>
              <div style={{marginTop:18,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <Info label="รถ"        value={<span className="mono">{veh?.plate}</span>}/>
                <Info label="เลขไมล์"   value={<span className="mono">{D.fmt(veh?.odometer||0)} km</span>}/>
                <Info label="วันที่"     value={D.thaiDate(new Date().toISOString().slice(0,10))}/>
                <Info label="หมายเหตุ"  value={sw.note||"—"}/>
              </div>
            </div>
            <div className="row" style={{gap:8,justifyContent:"flex-end"}}>
              <button className="btn" onClick={()=>setStep(1)}>❌ ยกเลิก</button>
              <button className="btn primary" onClick={doSwap}>✅ ยืนยันการสลับ</button>
            </div>
          </div>
        )}
      </div>

      {/* Swap history */}
      <div className="card" style={{marginTop:18}}>
        <div className="head">
          <h3>ประวัติการสลับยางล่าสุด</h3>
          <div className="right"><button className="btn sm" onClick={()=>window.print()}>🖨 พิมพ์ประวัติ</button></div>
        </div>
        <div className="tbl-wrap" style={{border:"none",borderRadius:0}}>
          <table className="tbl">
            <thead><tr><th>วันที่</th><th>ทะเบียน</th><th>Serial</th><th>จากตำแหน่ง</th><th>ไปตำแหน่ง</th><th className="right">เลขไมล์</th><th>หมายเหตุ</th></tr></thead>
            <tbody>
              {D.getAll("tire_events").filter(e=>e.eventType==="swap").slice(0,10).map(e=>{
                const vv=D.get("vehicles",e.vehicleId);
                const t =D.get("tires",e.tireId);
                return (
                  <tr key={e.id}>
                    <td className="num muted">{D.thaiDate(e.date)}</td>
                    <td><a style={{color:"var(--primary)",fontWeight:600}} className="mono">{vv?.plate}</a></td>
                    <td className="mono" style={{fontWeight:600}}>{t?.serial||"—"}</td>
                    <td><span className="badge gray">{e.fromPos||"—"}</span></td>
                    <td><span className="badge blue">{e.toPos||"—"}</span></td>
                    <td className="num right mono">{D.fmt(e.odometer)}</td>
                    <td className="muted" style={{fontSize:12}}>{e.note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Tab 4: History Timeline ───────────────────────────────────────
function TiresHistoryFull() {
  const D = window.KPSData;
  const vehicles = D.getAll("vehicles");
  const tires = D.getAll("tires");
  const [q,setQ] = useStateTR("");
  const [vf,setVf] = useStateTR("all");
  const [from,setFrom] = useStateTR("");
  const [to,setTo] = useStateTR("");

  const filtered = useMemoTR(()=>{
    let evts = D.getAll("tire_events").sort((a,b)=>new Date(b.date)-new Date(a.date));
    if(q) {
      const t = tires.find(tt=>tt.serial.toLowerCase().includes(q.toLowerCase()));
      evts = t ? evts.filter(e=>e.tireId===t.id) : [];
    }
    if(vf!=="all") evts = evts.filter(e=>e.vehicleId===vf);
    if(from) evts = evts.filter(e=>e.date>=from);
    if(to) evts = evts.filter(e=>e.date<=to);
    return evts;
  },[q,vf,from,to,tires]);

  return (
    <div>
      {/* Filter bar */}
      <div className="card pad" style={{marginBottom:18}}>
        <div className="row" style={{gap:14,flexWrap:"wrap",alignItems:"flex-end"}}>
          <div style={{position:"relative",flex:1,minWidth:260}}>
            <Icon name="search" size={14} style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"var(--text-faint)"}}/>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="ค้นหา เลขซีเรียล"
              style={{width:"100%",height:38,padding:"0 12px 0 36px",border:"1px solid var(--line)",borderRadius:8,background:"var(--bg)",fontSize:13}}/>
          </div>
          <Field label="ทะเบียน">
            <select value={vf} onChange={e=>setVf(e.target.value)} style={{width:160,height:38,fontSize:13}}>
              <option value="all">ทั้งหมด</option>
              {vehicles.map(v=><option key={v.id} value={v.id}>{v.plate}</option>)}
            </select>
          </Field>
          <Field label="จากวันที่"><input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={{height:38,fontSize:13}}/></Field>
          <Field label="ถึงวันที่"><input type="date" value={to} onChange={e=>setTo(e.target.value)} style={{height:38,fontSize:13}}/></Field>
        </div>
      </div>

      {/* Timeline feed */}
      <div className="col" style={{gap:12}}>
        {filtered.length===0 && (
          <div className="card pad" style={{textAlign:"center",color:"var(--text-muted)"}}>
            ไม่พบประวัติตามเงื่อนไขที่เลือก
          </div>
        )}
        {filtered.map((e,i)=>{
          const t = D.get("tires",e.tireId);
          const v = D.get("vehicles",e.vehicleId);
          const iconMap={install:"📌",swap:"↔️",remove:"📍",sell:"🏪"};
          const colorMap={install:"green",swap:"blue",remove:"amber",sell:"red"};
          const labelMap={install:"ติดตั้ง",swap:"สลับตำแหน่ง",remove:"ถอด",sell:"ขาย"};
          const icon=iconMap[e.eventType]||"📋";
          const color=colorMap[e.eventType]||"gray";
          const label=labelMap[e.eventType]||e.eventType;
          
          return (
            <div key={e.id} style={{display:"grid",gridTemplateColumns:"60px 1fr",gap:16}}>
              {/* Icon circle */}
              <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
                <div style={{width:48,height:48,borderRadius:"50%",background:"var(--"+color+"-50)",border:"2px solid var(--"+color+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>
                  {icon}
                </div>
                {i<filtered.length-1 && <div style={{width:2,height:32,background:"var(--line)",marginTop:8}}/>}
              </div>
              {/* Card */}
              <div className="card" style={{padding:16}}>
                <div className="row" style={{marginBottom:10,alignItems:"flex-start"}}>
                  <div>
                    <h4 style={{margin:"0 0 4px",fontSize:14,fontWeight:700,color:"var(--"+color+")"}}>{icon} {label}</h4>
                    <div style={{fontSize:12.5,color:"var(--text-muted)"}}>{D.thaiDate(e.date)}</div>
                  </div>
                  <div className="spacer"/>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontWeight:600,fontSize:13}}>{t?.serial||"—"}</div>
                    <div style={{fontSize:11.5,color:"var(--text-muted)"}}>{t?.brand} {t?.model}</div>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,fontSize:13,paddingTop:10,borderTop:"1px solid var(--line)"}}>
                  <Info label="ทะเบียน" value={<span className="mono" style={{fontWeight:600}}>{v?.plate}</span>}/>
                  <Info label="เลขไมล์" value={<span className="mono">{D.fmt(e.odometer)} km</span>}/>
                  {e.fromPos && (
                    <Info label="สลับจาก" value={<span className="badge gray" style={{fontSize:11}}>{e.fromPos.startsWith("spare")?"สำรอง":e.fromPos}</span>}/>
                  )}
                  {e.toPos && (
                    <Info label="สลับไป" value={<span className="badge blue" style={{fontSize:11}}>{e.toPos.startsWith("spare")?"สำรอง":e.toPos}</span>}/>
                  )}
                  {e.note && <div style={{gridColumn:"1/-1",fontSize:12,color:"var(--text-2)",padding:"8px 10px",background:"var(--bg-sunk)",borderRadius:6}}>💬 {e.note}</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, {
  TiresModule, TiresAll, AddTireModal, TiresLayout, TireMapSVG_T,
  TiresManageFull, TiresHistoryFull,
});
