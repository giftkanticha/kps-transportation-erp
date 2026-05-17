// layout.jsx — Sidebar + Topbar + role-based nav
const { useState: useStateLayout, useEffect: useEffectLayout } = React;

// Menu structure matching the user's repo, with role permissions
const MENU = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard", roles: ["admin","manager","driver"] },
  {
    id: "vehicles", label: "จัดการรถ", icon: "truck", roles: ["admin","manager"],
    sub: [
      { id: "vehicles", label: "รายการรถทั้งหมด" },
      { id: "vehicles.add", label: "เพิ่มรถใหม่" },
      { id: "vehicles.detail", label: "รายละเอียดรถ" },
    ],
  },
  {
    id: "employees", label: "ข้อมูลพนักงาน", icon: "users", roles: ["admin","manager"],
    sub: [
      { id: "employees", label: "รายชื่อพนักงาน" },
      { id: "employees.add", label: "เพิ่มพนักงานใหม่" },
    ],
  },
  {
    id: "tires", label: "ระบบยาง", icon: "tire", roles: ["admin","manager"],
    sub: [
      { id: "tires", label: "รายการยางทั้งหมด" },
      { id: "tires.layout", label: "ผังยางปัจจุบัน" },
      { id: "tires.manage", label: "จัดการและสลับยาง" },
      { id: "tires.history", label: "ประวัติยางรายเส้น" },
    ],
  },
  {
    id: "fuel", label: "ระบบน้ำมัน", icon: "fuel", roles: ["admin","manager"],
    sub: [
      { id: "fuel", label: "ภาพรวมคลังน้ำมัน" },
      { id: "fuel.logs", label: "บันทึกน้ำมัน" },
      { id: "fuel.report", label: "รายงานน้ำมันรายเดือน" },
    ],
  },
  {
    id: "dispatch", label: "งานขนส่ง", icon: "package", roles: ["admin","manager","driver"],
    sub: [
      { id: "dispatch.open", label: "เปิดงานขนส่ง" },
      { id: "dispatch.close", label: "ปิดงานขนส่ง" },
      { id: "dispatch.report", label: "รายงานสรุป" },
      { id: "dispatch.history", label: "ประวัติงาน" },
    ],
  },
  {
    id: "subcontractors", label: "รถรับจ้างร่วม", icon: "truck2", roles: ["admin","manager"],
    sub: [
      { id: "subcontractors", label: "เปิดงาน" },
      { id: "subcontractors.close", label: "ปิดงาน" },
      { id: "subcontractors.history", label: "ประวัติการจ้าง" },
      { id: "subcontractors.drivers", label: "คนขับรถร่วม" },
    ],
  },
  {
    id: "expenses", label: "ค่าใช้จ่าย", icon: "wallet", roles: ["admin","manager"],
    sub: [
      { id: "expenses", label: "บันทึกค่าใช้จ่าย" },
      { id: "expenses.finance", label: "สถานะการเงิน" },
      { id: "expenses.stock", label: "สต๊อคคลัง KPS" },
      { id: "expenses.report", label: "รายงานสรุป" },
      { id: "expenses.vendors", label: "ทะเบียนช่าง/ผู้ขาย" },
    ],
  },
  {
    id: "finance", label: "การเงิน", icon: "chart", roles: ["admin","manager"],
    sub: [
      { id: "finance", label: "P&L รายคัน" },
      { id: "finance.fixed", label: "ค่าใช้จ่ายคงที่" },
      { id: "finance.summary", label: "รายงานสรุป" },
    ],
  },
  {
    id: "master", label: "ลูกค้า & คู่ค้า", icon: "client", roles: ["admin","manager"],
    sub: [
      { id: "customers", label: "ลูกค้า" },
      { id: "partners", label: "คู่ค้า / ช่าง" },
    ],
  },
  {
    id: "maintenance", label: "การบำรุงรักษา", icon: "wrench", roles: ["admin","manager"],
  },
  {
    id: "settings", label: "ตั้งค่า", icon: "settings", roles: ["admin"],
    sub: [
      { id: "settings.users", label: "จัดการผู้ใช้งาน" },
      { id: "settings.company", label: "ข้อมูลบริษัท" },
    ],
  },
];

// Truck2 / wallet icons (extending)
const TruckIcon = ({ name, ...rest }) => {
  if (name === "truck2") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...rest}>
        <path d="M2 8h10v9H2z"/>
        <path d="M12 11h5l4 4v2h-9"/>
        <circle cx="5.5" cy="18" r="1.7"/>
        <circle cx="17.5" cy="18" r="1.7"/>
      </svg>
    );
  }
  if (name === "wallet") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...rest}>
        <path d="M3 7c0-1 .8-2 2-2h12v4H5"/>
        <path d="M3 7v11c0 1 .8 2 2 2h14a2 2 0 0 0 2-2v-9H5c-1 0-2-.8-2-2z"/>
        <circle cx="17" cy="14" r="1.3" fill="currentColor"/>
      </svg>
    );
  }
  return null;
};

function Sidebar({ collapsed, setCollapsed, active, setActive, user }) {
  const [open, setOpen] = useStateLayout(() => {
    // open parent of active route by default
    const o = {};
    MENU.forEach(m => {
      if (m.sub && m.sub.some(s => s.id === active || active.startsWith(m.id + "."))) o[m.id] = true;
    });
    return o;
  });

  // Auto-open parent when active changes
  useEffectLayout(() => {
    if (collapsed) return;
    MENU.forEach(m => {
      if (m.sub && m.sub.some(s => s.id === active)) {
        setOpen(prev => prev[m.id] ? prev : ({ ...prev, [m.id]: true }));
      }
    });
  }, [active, collapsed]);

  const can = (roles) => roles.includes(user.role);
  const sectionActive = (m) => active === m.id || (m.sub && m.sub.some(s => s.id === active)) || (active.startsWith(m.id + "."));

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="mark">K</div>
        <span className="name">KPS ERP</span>
        <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)} title="ย่อ/ขยายแถบ">
          <Icon name="chevron-right" size={15} style={{ transform: collapsed ? "rotate(180deg)" : "rotate(180deg)" }}/>
        </button>
      </div>

      <nav className="nav">
        {MENU.filter(m => can(m.roles)).map(m => {
          const sec = sectionActive(m);
          const hasSub = !!m.sub;
          return (
            <div className="nav-group" key={m.id}>
              <div
                className={`nav-item ${hasSub ? "parent" : ""} ${sec && !hasSub ? "active" : ""} ${sec ? "active-section" : ""} ${open[m.id] ? "open" : ""}`}
                onClick={() => {
                  if (hasSub) {
                    if (collapsed) { setCollapsed(false); setOpen({ [m.id]: true }); }
                    else setOpen(p => ({ ...p, [m.id]: !p[m.id] }));
                  } else {
                    setActive(m.id);
                  }
                }}
                title={collapsed ? m.label : undefined}
              >
                <span className="icn">
                  {["truck2","wallet"].includes(m.icon)
                    ? <TruckIcon name={m.icon}/>
                    : <Icon name={m.icon} size={18}/>}
                </span>
                <span className="lbl">{m.label}</span>
                {hasSub && <Icon name="chevron-right" size={14} style={{ color: "var(--text-faint)" }}/>}
              </div>

              {hasSub && open[m.id] && !collapsed && (
                <div className="subnav">
                  {m.sub.map(s => (
                    <div
                      key={s.id}
                      className={`subnav-item ${active === s.id ? "active" : ""}`}
                      onClick={() => setActive(s.id)}
                    >
                      {s.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="foot">
        <button className="logout-btn" onClick={() => { window.KPSData.logout(); window.location.reload(); }}>
          <Icon name="logout" size={18}/>
          <span>ออกจากระบบ</span>
        </button>
      </div>
    </aside>
  );
}

function Topbar({ user, crumb }) {
  const [open, setOpen] = useStateLayout(false);
  const roleLabel = user.role === "admin" ? "ผู้ดูแลระบบ" : user.role === "manager" ? "ผู้จัดการขนส่ง" : "พนักงานขับรถ";
  return (
    <div className="topbar">
      <div className="crumb">
        <span>KPS Transportation ERP</span>
        <Icon name="chevron-right" size={14}/>
        <b>{crumb}</b>
      </div>
      <div className="search">
        <Icon name="search" size={15} className="icn" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)" }}/>
        <input placeholder="ค้นหารถ คนขับ ลูกค้า งาน..."/>
      </div>
      <button className="icon-btn" title="ภาษา"><Icon name="globe" size={18}/></button>
      <button className="icon-btn" title="แจ้งเตือน">
        <Icon name="bell" size={18}/>
        <span className="dot"/>
      </button>
      <div className="user-chip" onClick={() => setOpen(o => !o)} style={{ position: "relative" }}>
        <div className="meta">
          <div className="nm">{user.name}</div>
          <div className="rl">{roleLabel}</div>
        </div>
        <div className={`avatar ${user.role === "admin" ? "violet" : user.role === "manager" ? "" : "amber"}`}>{user.avatar}</div>
        {open && (
          <div className="menu" style={{ top: "calc(100% + 6px)" }} onClick={e => e.stopPropagation()}>
            <div className="item" onClick={() => setOpen(false)}><Icon name="user" size={15}/> โปรไฟล์</div>
            <div className="item" onClick={() => setOpen(false)}><Icon name="settings" size={15}/> ตั้งค่า</div>
            <div className="sep"/>
            <div className="item" onClick={() => { if (confirm("ล้างข้อมูลทั้งหมดและรีเซ็ตเป็นค่าเริ่มต้น?")) { window.KPSData.reset(); window.location.reload(); } }}>
              <Icon name="trash" size={15}/> รีเซ็ตข้อมูลตัวอย่าง
            </div>
            <div className="sep"/>
            <div className="item danger" onClick={() => { window.KPSData.logout(); window.location.reload(); }}>
              <Icon name="logout" size={15}/> ออกจากระบบ
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Extra icon: globe for language
const _origIcon = window.Icon;
window.Icon = function(props) {
  if (props.name === "globe") {
    const s = props.size || 18;
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={props.style}>
        <circle cx="12" cy="12" r="9"/>
        <path d="M3 12h18"/>
        <path d="M12 3a14 14 0 0 1 0 18"/>
        <path d="M12 3a14 14 0 0 0 0 18"/>
      </svg>
    );
  }
  return _origIcon(props);
};

Object.assign(window, { Sidebar, Topbar, MENU });
