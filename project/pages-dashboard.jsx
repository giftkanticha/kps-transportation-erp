// pages-dashboard.jsx — Dashboard for admin/manager
const { useMemo: useMemoDash } = React;

function Dashboard({ user, setActive }) {
  const D = window.KPSData;
  const vehicles = D.getAll("vehicles");
  const employees = D.getAll("employees");
  const dispatch = D.getAll("dispatch");
  const customers = D.getAll("customers");
  const fuel = D.getAll("fuel");
  const tires = D.getAll("tires");
  const expenses = D.getAll("expenses");
  const activity = D.getAll("activity");

  const onTrip = dispatch.filter(t => t.status === "in-progress" || t.status === "in-transit");
  const scheduled = dispatch.filter(t => t.status === "scheduled" || t.status === "draft");
  const delivered = dispatch.filter(t => t.status === "delivered" || t.status === "completed");

  const revenueThisMonth = dispatch.reduce((s, t) => s + D.amountOf(t), 0);
  const costThisMonth = dispatch.reduce((s, t) => s + (t.cost || 0), 0) + expenses.reduce((s, x) => s + (x.amount || 0), 0);

  const activeVehicles = vehicles.filter(v => v.status === "on-trip").length;
  const idleVehicles = vehicles.filter(v => v.status === "idle").length;
  const maintenanceVehicles = vehicles.filter(v => v.status === "maintenance").length;
  const activeDrivers = employees.filter(e => e.status === "active" && e.position.includes("ขับ")).length;

  const tireAlerts = tires.filter(t => t.status === "critical" || t.status === "warning").length;
  const lowStock = D.getAll("stock").filter(s => s.qty <= s.reorderAt).length;

  const weeklyRevenue = [124000, 158000, 142000, 186000, 162000, 198000, 174000];
  const weeklyDays = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];
  const weeklyMax = Math.max(...weeklyRevenue);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">สวัสดี{user.role === "admin" ? "" : ", "}{user.name.split(" ")[0]} 👋</h1>
          <div className="page-sub">ภาพรวมการขนส่ง ณ วันที่ 16 พฤษภาคม 2026</div>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => setActive("dispatch.open")}><Icon name="plus" size={15}/> เปิดงานใหม่</button>
          <button className="btn primary"><Icon name="download" size={15}/> ส่งออกรายงาน</button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="card kpi">
          <div className="label">รายได้เดือนนี้</div>
          <div className="row">
            <div className="icn-box green"><Icon name="money" size={18}/></div>
            <div className="value">{D.thb(revenueThisMonth)}</div>
          </div>
          <div className="delta up"><Icon name="arrow-up" size={12}/> +12.4% จากเดือนก่อน</div>
        </div>
        <div className="card kpi">
          <div className="label">กำไรประมาณการ</div>
          <div className="row">
            <div className="icn-box teal"><Icon name="chart" size={18}/></div>
            <div className="value">{D.thb(revenueThisMonth - costThisMonth)}</div>
          </div>
          <div className="delta up"><Icon name="arrow-up" size={12}/> margin ~{Math.round((revenueThisMonth - costThisMonth) / revenueThisMonth * 100)}%</div>
        </div>
        <div className="card kpi">
          <div className="label">งานขนส่งวันนี้</div>
          <div className="row">
            <div className="icn-box"><Icon name="package" size={18}/></div>
            <div className="value">{onTrip.length}<span className="unit">/ {dispatch.length} รวม</span></div>
          </div>
          <div className="delta"><span className="sdot blue"></span>{scheduled.length} นัดหมาย • <span className="sdot green"></span>{delivered.length} เสร็จ</div>
        </div>
        <div className="card kpi">
          <div className="label">รถพร้อมใช้งาน</div>
          <div className="row">
            <div className="icn-box amber"><Icon name="truck" size={18}/></div>
            <div className="value">{idleVehicles}<span className="unit">/ {vehicles.length} คัน</span></div>
          </div>
          <div className="delta"><span className="sdot blue"></span>{activeVehicles} ออกงาน • <span className="sdot amber"></span>{maintenanceVehicles} ซ่อม</div>
        </div>
      </div>

      {/* Main grid: chart + alerts */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 20 }}>
        <div className="card">
          <div className="head">
            <h3>รายได้รายสัปดาห์</h3>
            <span className="badge gray mono">7 วันที่ผ่านมา</span>
            <div className="right">
              <button className="chip">รายได้</button>
              <button className="chip">ทริป</button>
              <button className="chip">ระยะทาง</button>
            </div>
          </div>
          <div style={{ padding: "22px 22px 24px" }}>
            <div className="bar-chart">
              {weeklyRevenue.map((v, i) => (
                <div className="bar-col" key={i}>
                  <div className="bar-val mono">{(v/1000).toFixed(0)}k</div>
                  <div className="bar" style={{ height: (v/weeklyMax)*150 + "px" }}>
                    <div className="fill" style={{ height: "100%" }}/>
                  </div>
                  <div className="bar-lbl">{weeklyDays[i]}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 32, marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
              <div><div className="muted" style={{ fontSize: 12 }}>รวม 7 วัน</div><div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{D.thb(weeklyRevenue.reduce((a,b)=>a+b,0))}</div></div>
              <div><div className="muted" style={{ fontSize: 12 }}>เฉลี่ย/วัน</div><div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{D.thb(weeklyRevenue.reduce((a,b)=>a+b,0)/7)}</div></div>
              <div><div className="muted" style={{ fontSize: 12 }}>สูงสุด</div><div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{D.thb(weeklyMax)}</div></div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="head">
            <h3>การแจ้งเตือน</h3>
            <span className="badge red mono">{tireAlerts + lowStock + 1}</span>
          </div>
          <div style={{ padding: "8px 18px" }}>
            <div className="feed">
              <div className="feed-item">
                <div className="ic red"><Icon name="alert" size={16}/></div>
                <div className="body">
                  <div className="who">ยางวิกฤติ {tires.filter(t=>t.status==="critical").length} เส้น</div>
                  <div className="txt">รถ 70-2451 (RR2) และ 70-4029 (FR) ต่ำกว่าเกณฑ์</div>
                  <div className="when">8 ชม.ที่แล้ว</div>
                </div>
              </div>
              <div className="feed-item">
                <div className="ic amber"><Icon name="wrench" size={16}/></div>
                <div className="body">
                  <div className="who">ครบกำหนดบำรุงรักษา</div>
                  <div className="txt">รถ 70-7890 ครบ 10,000 km</div>
                  <div className="when">วันนี้</div>
                </div>
              </div>
              <div className="feed-item">
                <div className="ic amber"><Icon name="package" size={16}/></div>
                <div className="body">
                  <div className="who">สต็อคใกล้หมด {lowStock} รายการ</div>
                  <div className="txt">หลอดไฟหน้า H4, ผ้าเบรกหน้า</div>
                  <div className="when">เมื่อวาน</div>
                </div>
              </div>
              <div className="feed-item">
                <div className="ic"><Icon name="money" size={16}/></div>
                <div className="body">
                  <div className="who">ลูกหนี้เกินกำหนด</div>
                  <div className="txt">PTT Global Chemical ฿1.24M (30+ วัน)</div>
                  <div className="when">3 วันที่แล้ว</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Active trips + activity */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <div className="card">
          <div className="head">
            <h3>งานขนส่งที่กำลังดำเนินการ</h3>
            <div className="right">
              <button className="btn sm" onClick={() => setActive("dispatch")}>ดูทั้งหมด <Icon name="arrow-right" size={13}/></button>
            </div>
          </div>
          <div className="tbl-wrap" style={{ border: "none", borderRadius: 0 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>รหัสงาน</th>
                  <th>เส้นทาง</th>
                  <th>ลูกค้า</th>
                  <th>คนขับ / รถ</th>
                  <th>สถานะ</th>
                  <th className="right">ความคืบหน้า</th>
                </tr>
              </thead>
              <tbody>
                {onTrip.map(t => {
                  const cu = D.get("customers", t.customerId);
                  const dr = D.get("employees", t.driverId);
                  const v = D.get("vehicles", t.vehicleId);
                  return (
                    <tr key={t.id}>
                      <td><span className="mono" style={{ fontWeight: 600 }}>{t.code}</span></td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{D.originOf(t)}</div>
                        <div className="muted" style={{ fontSize: 11.5, marginTop: 1 }}>→ {D.destOf(t)}</div>
                      </td>
                      <td>{cu?.name?.replace("บริษัท ", "").replace(" จำกัด", "") || "—"}</td>
                      <td>
                        <div style={{ fontSize: 12.5 }}>{dr?.name || "—"}</div>
                        <div className="muted mono" style={{ fontSize: 11 }}>{v?.plate || "—"}</div>
                      </td>
                      <td><StatusBadge status={t.status}/></td>
                      <td className="right" style={{ minWidth: 140 }}>
                        <div className="row" style={{ justifyContent: "flex-end" }}>
                          <div className="progress" style={{ width: 80 }}><div className="fill" style={{ width: t.progress + "%" }}/></div>
                          <span className="mono" style={{ fontSize: 12, minWidth: 32 }}>{t.progress}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="head"><h3>กิจกรรมล่าสุด</h3></div>
          <div style={{ padding: "8px 18px" }}>
            <div className="feed">
              {activity.slice(0, 6).map(a => {
                const iconMap = { trip: "package", alert: "alert", create: "plus", approve: "check", invoice: "money", fuel: "fuel" };
                const colorMap = { alert: "red", approve: "green", fuel: "amber" };
                return (
                  <div className="feed-item" key={a.id}>
                    <div className={`ic ${colorMap[a.type] || ""}`}>
                      <Icon name={iconMap[a.type] || "circle"} size={15}/>
                    </div>
                    <div className="body">
                      <div className="who">{a.who}</div>
                      <div className="txt">{a.text}</div>
                      <div className="when">{a.at.slice(11)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.Dashboard = Dashboard;
