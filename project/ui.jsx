// ui.jsx — Shared UI primitives & icons for KPS ERP
const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ───────── Icons (inline SVG, 18×18) ─────────
const Icon = ({ name, size = 18, color = "currentColor", style }) => {
  const s = size;
  const props = { width: s, height: s, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", style };
  switch (name) {
    case "dashboard": return <svg {...props}><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>;
    case "truck": return <svg {...props}><path d="M3 7h11v10H3z"/><path d="M14 10h4l3 3v4h-7"/><circle cx="6.5" cy="17.5" r="1.7"/><circle cx="17.5" cy="17.5" r="1.7"/></svg>;
    case "user": return <svg {...props}><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>;
    case "users": return <svg {...props}><circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5"/><circle cx="17" cy="9" r="2.8"/><path d="M22 19c0-2.5-2.1-4-5-4"/></svg>;
    case "trip": return <svg {...props}><path d="M5 19V5h6l8 14H5z" fill="none"/><circle cx="8" cy="8" r="1.3" fill={color} stroke="none"/><circle cx="16" cy="16" r="1.3" fill={color} stroke="none"/><path d="M8 8C8 13 13 16 16 16"/></svg>;
    case "client": return <svg {...props}><rect x="3" y="6" width="18" height="14" rx="1.5"/><path d="M8 6V4h8v2"/><path d="M3 12h18"/></svg>;
    case "wrench": return <svg {...props}><path d="M14.7 6.3a4 4 0 1 0 4.6 6.4l-5 5L7 11l4-4 1 1 2.7-1.7z"/></svg>;
    case "tire": return <svg {...props}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.5 5.5l2 2M16.5 16.5l2 2M5.5 18.5l2-2M16.5 7.5l2-2"/></svg>;
    case "chart": return <svg {...props}><path d="M3 21V5"/><path d="M21 21H3"/><rect x="7" y="13" width="3" height="6"/><rect x="12" y="9" width="3" height="10"/><rect x="17" y="5" width="3" height="14"/></svg>;
    case "settings": return <svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.4.8a7 7 0 0 0-2-1.2l-.4-2.5h-4l-.4 2.5a7 7 0 0 0-2 1.2l-2.4-.8-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.4-.8a7 7 0 0 0 2 1.2l.4 2.5h4l.4-2.5a7 7 0 0 0 2-1.2l2.4.8 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"/></svg>;
    case "search": return <svg {...props}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>;
    case "bell": return <svg {...props}><path d="M18 16H6l1.5-2V11a4.5 4.5 0 0 1 9 0v3l1.5 2z"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>;
    case "plus": return <svg {...props}><path d="M12 5v14M5 12h14"/></svg>;
    case "filter": return <svg {...props}><path d="M3 5h18l-7 9v6l-4-2v-4z"/></svg>;
    case "download": return <svg {...props}><path d="M12 3v12m0 0-4-4m4 4 4-4"/><path d="M5 21h14"/></svg>;
    case "chevron-right": return <svg {...props}><path d="m9 6 6 6-6 6"/></svg>;
    case "chevron-down": return <svg {...props}><path d="m6 9 6 6 6-6"/></svg>;
    case "arrow-up": return <svg {...props}><path d="M12 19V5m0 0-5 5m5-5 5 5"/></svg>;
    case "arrow-down": return <svg {...props}><path d="M12 5v14m0 0-5-5m5 5 5-5"/></svg>;
    case "arrow-right": return <svg {...props}><path d="M5 12h14m0 0-5-5m5 5-5 5"/></svg>;
    case "close": return <svg {...props}><path d="M6 6l12 12M18 6 6 18"/></svg>;
    case "edit": return <svg {...props}><path d="M4 20h4l11-11-4-4L4 16z"/><path d="M14 5l4 4"/></svg>;
    case "trash": return <svg {...props}><path d="M4 7h16M9 7V4h6v3M6 7v13h12V7"/></svg>;
    case "more": return <svg {...props}><circle cx="5" cy="12" r="1.3" fill={color}/><circle cx="12" cy="12" r="1.3" fill={color}/><circle cx="19" cy="12" r="1.3" fill={color}/></svg>;
    case "check": return <svg {...props}><path d="m5 12 5 5 9-11"/></svg>;
    case "alert": return <svg {...props}><path d="M12 3 2 21h20z"/><path d="M12 10v5"/><circle cx="12" cy="18" r=".5" fill={color}/></svg>;
    case "calendar": return <svg {...props}><rect x="3" y="5" width="18" height="16" rx="1.5"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>;
    case "pin": return <svg {...props}><path d="M12 22s7-7 7-12a7 7 0 0 0-14 0c0 5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>;
    case "phone": return <svg {...props}><path d="M5 4h4l2 5-3 2a11 11 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>;
    case "mail": return <svg {...props}><rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="m3 7 9 7 9-7"/></svg>;
    case "logout": return <svg {...props}><path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h12"/></svg>;
    case "fuel": return <svg {...props}><rect x="4" y="3" width="10" height="18" rx="1"/><path d="M14 7h2l2 2v8a2 2 0 0 1-4 0v-3"/><path d="M7 7h4"/></svg>;
    case "gauge": return <svg {...props}><path d="M3 16a9 9 0 1 1 18 0"/><path d="m12 16 4-6"/><circle cx="12" cy="16" r="1.2" fill={color}/></svg>;
    case "package": return <svg {...props}><path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 21V11"/></svg>;
    case "money": return <svg {...props}><rect x="3" y="6" width="18" height="12" rx="1.5"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9v6M18 9v6"/></svg>;
    case "circle": return <svg {...props}><circle cx="12" cy="12" r="4" fill={color}/></svg>;
    default: return <svg {...props}><rect x="3" y="3" width="18" height="18"/></svg>;
  }
};

// ───────── Badges & status pills ─────────
const StatusBadge = ({ status }) => {
  const map = {
    // trips
    "in-transit":  { cls: "blue",   label: "กำลังขนส่ง" },
    "delivered":   { cls: "green",  label: "ส่งสำเร็จ" },
    "scheduled":   { cls: "gray",   label: "นัดหมาย" },
    "cancelled":   { cls: "red",    label: "ยกเลิก" },
    "draft":       { cls: "gray",   label: "ร่าง" },
    // drivers
    "on-duty":     { cls: "blue",   label: "ปฏิบัติงาน" },
    "available":   { cls: "green",  label: "ว่าง" },
    "leave":       { cls: "amber",  label: "ลา" },
    "training":    { cls: "violet", label: "อบรม" },
    // vehicles
    "on-trip":     { cls: "blue",   label: "ออกงาน" },
    "idle":        { cls: "gray",   label: "ว่าง" },
    "available":   { cls: "green",  label: "พร้อม" },
    "warning":     { cls: "amber",  label: "เตือน" },
    "unavailable": { cls: "red",    label: "ไม่พร้อม" },
    "maintenance": { cls: "amber",  label: "ซ่อมบำรุง" },
    // maintenance
    "in-progress": { cls: "amber",  label: "กำลังดำเนินการ" },
    "completed":   { cls: "green",  label: "เสร็จสิ้น" },
    // customers
    "active":      { cls: "green",  label: "Active" },
    "inactive":    { cls: "gray",   label: "Inactive" },
    // tires (override status keys with own names if needed)
    "good":        { cls: "green",  label: "ดี" },
    "critical":    { cls: "red",    label: "วิกฤติ" },
    // expenses / payable
    "paid":        { cls: "green",  label: "ชำระแล้ว" },
    "unpaid":      { cls: "amber",  label: "ค้างชำระ" },
    "overdue":     { cls: "red",    label: "เกินกำหนด" },
    // employee license
    "ok":          { cls: "green",  label: "ถูกต้อง" },
    "expired":     { cls: "red",    label: "หมดอายุแล้ว" },
  };
  const c = map[status] || { cls: "gray", label: status };
  return <span className={`badge ${c.cls}`}><span className="dot"></span>{c.label}</span>;
};

// ───────── Sparkline ─────────
const Sparkline = ({ data, color = "var(--navy)", height = 44 }) => {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 200, h = height;
  const pts = data.map((v, i) => `${(i/(data.length-1))*w},${h - ((v-min)/range)*h*0.85 - h*0.075}`).join(" ");
  return (
    <svg className="sparkline" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6"/>
      <polyline points={`0,${h} ${pts} ${w},${h}`} fill={color} opacity=".08"/>
    </svg>
  );
};

// ───────── Modal ─────────
const Modal = ({ open, onClose, title, children, footer, wide }) => {
  useEffect(() => {
    if (!open) return;
    const k = (e) => e.key === "Escape" && onClose && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className={`modal ${wide ? "wide" : ""}`} onClick={e => e.stopPropagation()}>
        <div className="head">
          <h3>{title}</h3>
          <button className="btn ghost icon" style={{ marginLeft: "auto" }} onClick={onClose}><Icon name="close"/></button>
        </div>
        <div className="body">{children}</div>
        {footer && <div className="foot">{footer}</div>}
      </div>
    </div>
  );
};

// ───────── Field input ─────────
const Field = ({ label, children, hint, full }) => (
  <div className="field" style={{ gridColumn: full ? "1 / -1" : undefined }}>
    {label && <label>{label}</label>}
    {children}
    {hint && <div className="faint" style={{ fontSize: 11 }}>{hint}</div>}
  </div>
);

// ───────── Toolbar (search + filters + actions) ─────────
const Toolbar = ({ search, onSearch, filters, actions, count }) => (
  <div className="toolbar">
    <div className="row" style={{ position: "relative" }}>
      <Icon name="search" size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)" }}/>
      <input
        placeholder="ค้นหา..."
        value={search}
        onChange={e => onSearch(e.target.value)}
        style={{
          height: 34, padding: "0 12px 0 32px",
          width: 260, border: "1px solid var(--line)",
          borderRadius: 6, background: "var(--bg-elev)",
          fontSize: 13, outline: "none",
        }}
      />
    </div>
    {filters}
    {typeof count === "number" && <div className="muted mono" style={{ fontSize: 12 }}>{count} รายการ</div>}
    <div className="spacer"/>
    {actions}
  </div>
);

// ───────── Empty state ─────────
const Empty = ({ children }) => <div className="empty">{children}</div>;

// Expose
Object.assign(window, {
  Icon, StatusBadge, Sparkline, Modal, Field, Toolbar, Empty,
});
