import { AlertTriangle } from "lucide-react";
import type { Vehicle, Tire, NumericLayout } from "@/lib/store";
import { tireStatusLabel } from "@/lib/store";
import { toThaiDate } from "@/lib/thaiDate";

const NEW_LIMIT = 40000;
const WARN_LIMIT = 50000;

function tireColor(km: number) {
  if (km > WARN_LIMIT) return { border: "#dc2626", text: "#dc2626", bg: "#fee2e2", label: "ใกล้หมดสภาพ" };
  if (km < NEW_LIMIT) return { border: "#16a34a", text: "#16a34a", bg: "#dcfce7", label: "ใหม่/ดี" };
  return { border: "#ca8a04", text: "#a16207", bg: "#fef9c3", label: "ปกติ" };
}

interface Props {
  vehicle: Vehicle;
  layout: NumericLayout;
  tires: Tire[]; // all tires (will filter)
}

export function TirePrintReport({ vehicle, layout, tires }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const tireAt = (pos: number) =>
    tires.find(t => t.vehicleId === vehicle.id && t.position === `P${pos}` && t.status === "in-use");
  const installed = tires.filter(t => t.vehicleId === vehicle.id && t.status === "in-use");

  return (
    <div className="tire-print-root" style={{ fontFamily: "'Noto Sans Thai', 'Manrope', sans-serif", color: "#000", padding: "6mm 4mm", fontSize: 10 }}>
      {/* Header */}
      <div style={{ borderBottom: "2px solid #000", paddingBottom: 6, marginBottom: 8 }}>
        <h1 style={{ textAlign: "center", fontSize: 16, fontWeight: 800, margin: 0, fontFamily: "'Sora','Noto Sans Thai',sans-serif" }}>
          รายงานสถานะและประวัติยาง (Vehicle Tire Status Report)
        </h1>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10 }}>
          <div>
            <div><strong>ทะเบียนรถ:</strong> {vehicle.plate}</div>
            <div><strong>ประเภทรถ:</strong> {layout.label}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div><strong>วันที่พิมพ์:</strong> {toThaiDate(today)}</div>
            <div><strong>เลขไมล์รวมปัจจุบัน:</strong> {vehicle.mileage.toLocaleString()} กม.</div>
          </div>
        </div>
      </div>

      {/* Two-column body: left = visual layout, right = summary table */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "start" }}>
        {/* LEFT — Visual layout */}
        <div>
          {layout.groups.map((g, gi) => (
            <div key={gi} style={{ marginBottom: 8 }}>
              <div style={{ textAlign: "center", fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "#374151", marginBottom: 4 }}>
                {g.label}
              </div>
              <div style={{ border: "1px solid #9ca3af", borderRadius: 6, padding: "8px 4px", background: "#f9fafb" }}>
                {g.rows.map((row, ri) => (
                  <div key={ri} style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 8 }}>
                    {row.positions.map(pos => {
                      const t = tireAt(pos);
                      const km = t ? (t.currentKm ?? 0) - (t.installedKm ?? 0) : 0;
                      const c = t ? tireColor(km) : { border: "#9ca3af", text: "#6b7280", bg: "#f3f4f6", label: "ว่าง" };
                      const critical = t && km > WARN_LIMIT;
                      return (
                        <div key={pos} style={{ width: 70, textAlign: "center" }}>
                          <div style={{
                            width: 36, height: 46, margin: "0 auto",
                            border: `2.5px solid ${c.border}`, borderRadius: 8,
                            background: c.bg, color: c.text,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontWeight: 800, fontSize: 12,
                          }}>
                            {pos}
                          </div>
                          <div style={{ fontSize: 9, marginTop: 3, lineHeight: 1.3 }}>
                            {t ? (
                              <>
                                <div style={{ fontWeight: 700, color: "#000" }}>{t.serial}</div>
                                <div style={{ color: "#374151" }}>เริ่ม: {(t.installedKm ?? 0).toLocaleString()}</div>
                                <div style={{ color: c.text, fontWeight: 700, display: "flex", justifyContent: "center", alignItems: "center", gap: 2 }}>
                                  {critical && <AlertTriangle size={10} color="#dc2626" />}
                                  สะสม: {km.toLocaleString()}
                                </div>
                              </>
                            ) : (
                              <div style={{ color: "#9ca3af" }}>— ว่าง —</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Legend */}
          <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 8, marginTop: 6 }}>
            <span><span style={{ display: "inline-block", width: 10, height: 10, border: "2px solid #16a34a", background: "#dcfce7", verticalAlign: "middle", marginRight: 4 }} />ใหม่/ดี (&lt; 40,000)</span>
            <span><span style={{ display: "inline-block", width: 10, height: 10, border: "2px solid #ca8a04", background: "#fef9c3", verticalAlign: "middle", marginRight: 4 }} />ปกติ (40k–50k)</span>
            <span><span style={{ display: "inline-block", width: 10, height: 10, border: "2px solid #dc2626", background: "#fee2e2", verticalAlign: "middle", marginRight: 4 }} />ใกล้หมดสภาพ (&gt; 50,000)</span>
          </div>
        </div>

        {/* RIGHT — Summary table */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, fontFamily: "'Sora','Noto Sans Thai',sans-serif" }}>
            ตารางสรุปยางทั้งหมดบนรถคันนี้
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 8.5 }}>
            <thead>
              <tr style={{ background: "#e5e7eb" }}>
                {["ตำแหน่ง", "หมายเลขยาง", "ยี่ห้อ", "ไมล์เริ่ม", "ไมล์สะสม", "สถานะ"].map(h => (
                  <th key={h} style={{ border: "1px solid #6b7280", padding: "3px 4px", textAlign: "left", fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {installed.length === 0 && (
                <tr><td colSpan={6} style={{ border: "1px solid #6b7280", padding: 10, textAlign: "center", color: "#6b7280" }}>ไม่มีข้อมูลยาง</td></tr>
              )}
              {installed.map(t => {
                const km = (t.currentKm ?? 0) - (t.installedKm ?? 0);
                const c = tireColor(km);
                const critical = km > WARN_LIMIT;
                return (
                  <tr key={t.id}>
                    <td style={{ border: "1px solid #9ca3af", padding: "2px 4px", fontWeight: 700 }}>{t.position}</td>
                    <td style={{ border: "1px solid #9ca3af", padding: "2px 4px" }}>{t.serial}</td>
                    <td style={{ border: "1px solid #9ca3af", padding: "2px 4px" }}>{t.brand}</td>
                    <td style={{ border: "1px solid #9ca3af", padding: "2px 4px", textAlign: "right" }}>{(t.installedKm ?? 0).toLocaleString()}</td>
                    <td style={{ border: "1px solid #9ca3af", padding: "2px 4px", textAlign: "right", fontWeight: 700, color: c.text }}>
                      {critical && <AlertTriangle size={9} style={{ display: "inline", verticalAlign: "middle", marginRight: 2 }} />}
                      {km.toLocaleString()}
                    </td>
                    <td style={{ border: "1px solid #9ca3af", padding: "2px 4px" }}>
                      <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: c.border, marginRight: 3, verticalAlign: "middle" }} />
                      {c.label}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 10, fontSize: 8, color: "#6b7280", textAlign: "right" }}>
        KPS Logistics · พิมพ์ {toThaiDate(today)} · {vehicle.plate}
      </div>
    </div>
  );
}
