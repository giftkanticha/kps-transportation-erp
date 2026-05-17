import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, History as HistoryIcon } from "lucide-react";
import { useKPS } from "@/lib/store";
import { useSearchParams } from "react-router-dom";
import { toThaiDate, toThaiDateTime } from "@/lib/thaiDate";

const typeLabel: Record<string, { th: string; cls: string }> = {
  install: { th: "ติดตั้ง", cls: "bg-success/15 text-success border-success/40" },
  remove: { th: "ถอดออก", cls: "bg-destructive/15 text-destructive border-destructive/40" },
  rotate: { th: "สลับ", cls: "bg-primary/15 text-primary border-primary/40" },
  repair: { th: "ซ่อม", cls: "bg-warning/15 text-warning-foreground border-warning/40" },
  scrap: { th: "ขายซาก", cls: "bg-muted text-muted-foreground border-border" },
  register: { th: "ลงทะเบียน", cls: "bg-accent/30 text-accent-foreground border-accent/40" },
};

export default function TireHistory() {
  const tires = useKPS(s => s.tires);
  const events = useKPS(s => s.events);
  const vehicles = useKPS(s => s.vehicles);
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("serial") ?? "");

  useEffect(() => {
    const s = params.get("serial");
    if (s) setQuery(s);
  }, [params]);

  const tire = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return undefined;
    return tires.find(t => t.serial.toLowerCase() === q) ?? tires.find(t => t.serial.toLowerCase().includes(q));
  }, [query, tires]);

  // Build timeline rows with paired install→remove for distance
  const rows = useMemo(() => {
    if (!tire) return [];
    const list = events
      .filter(e => e.tireId === tire.id)
      .sort((a, b) => a.date.localeCompare(b.date));
    type Row = {
      id: string; date: string; vehiclePlate: string; position: string;
      installKm?: number; status: string; statusKey: string; removeKm?: number; distance?: number;
    };
    const out: Row[] = [];
    let lastInstall: { km: number; idx: number } | null = null;
    list.forEach((e) => {
      const v = e.vehicleId ? vehicles.find(x => x.id === e.vehicleId) : undefined;
      const row: Row = {
        id: e.id,
        date: e.date,
        vehiclePlate: v?.plate ?? "—",
        position: e.position ?? (e.fromPosition ? `${e.fromPosition} → ${e.toPosition}` : "—"),
        status: typeLabel[e.type]?.th ?? e.type,
        statusKey: e.type,
        installKm: e.type === "install" ? e.mileage : undefined,
        removeKm: e.type === "remove" ? e.mileage : undefined,
      };
      if (e.type === "install") {
        lastInstall = { km: e.mileage ?? 0, idx: out.length };
      } else if (e.type === "remove" && lastInstall) {
        row.distance = (e.mileage ?? 0) - lastInstall.km;
        // also fill the install row's distance for clarity
        out[lastInstall.idx].distance = row.distance;
        lastInstall = null;
      }
      out.push(row);
    });
    // If tire is currently in-use, show running distance from last install
    if (tire.status === "in-use" && lastInstall) {
      out[lastInstall.idx].distance = (tire.currentKm ?? lastInstall.km) - lastInstall.km;
    }
    return out;
  }, [tire, events, vehicles]);

  const totalKm = rows.reduce((a, r) => a + (r.statusKey === "remove" ? (r.distance ?? 0) : 0), 0)
    + (tire?.status === "in-use" ? ((tire.currentKm ?? 0) - (tire.installedKm ?? 0)) : 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold md:text-4xl">ประวัติยางรายเส้น</h1>
        <p className="mt-1 text-sm text-muted-foreground">ค้นหาด้วยหมายเลขยาง (Serial) เพื่อดูเส้นทางการใช้งานทั้งหมด</p>
      </div>

      <Card className="glass-card border-0">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="เช่น T-999, BS-2024-001"
              className="pl-9 h-11 font-display"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            ลองค้นหา: <button className="underline" onClick={() => setQuery("T-999")}>T-999</button>
          </p>
        </CardContent>
      </Card>

      {query && !tire && (
        <Card className="glass-card border-0"><CardContent className="p-8 text-center text-muted-foreground">ไม่พบยางหมายเลข "{query}"</CardContent></Card>
      )}

      {tire && (
        <>
          <Card className="glass-card border-0">
            <CardHeader><CardTitle className="font-display text-base">ข้อมูลยาง</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 text-sm">
              <Info label="Serial" value={tire.serial} />
              <Info label="ยี่ห้อ/รุ่น" value={`${tire.brand} ${tire.model}`} />
              <Info label="ขนาด" value={tire.size} />
              <Info label="ราคาซื้อ" value={`฿${tire.purchasePrice.toLocaleString()}`} />
              <Info label="สถานะปัจจุบัน" value={tire.status === "in-use" ? `ใช้งาน · ${tire.position}` : tire.status} />
              <Info label="ดอกยางคงเหลือ" value={`${tire.treadDepth} mm`} />
              <Info label="ระยะวิ่งสะสม" value={`${totalKm.toLocaleString()} กม.`} highlight />
              <Info label="วันที่ซื้อ" value={tire.purchaseDate} />
            </CardContent>
          </Card>

          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle className="font-display text-base flex items-center gap-2">
                <HistoryIcon className="h-4 w-4 text-primary" /> Timeline การใช้งาน
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-3">วันที่</th>
                    <th className="px-3 py-3">ทะเบียนรถ</th>
                    <th className="px-3 py-3">ตำแหน่ง</th>
                    <th className="px-3 py-3 text-right">เลขไมล์ติดตั้ง</th>
                    <th className="px-3 py-3 text-right">เลขไมล์ถอด</th>
                    <th className="px-3 py-3 text-right">ระยะวิ่ง (กม.)</th>
                    <th className="px-3 py-3">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.length === 0 && (
                    <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">ยังไม่มีประวัติ</td></tr>
                  )}
                  {rows.map(r => (
                    <tr key={r.id} className="hover:bg-secondary/40">
                      <td className="px-3 py-3 tabular">{toThaiDate(r.date)}</td>
                      <td className="px-3 py-3 font-semibold">{r.vehiclePlate}</td>
                      <td className="px-3 py-3 tabular">{r.position}</td>
                      <td className="px-3 py-3 text-right tabular">{r.installKm?.toLocaleString() ?? "—"}</td>
                      <td className="px-3 py-3 text-right tabular">{r.removeKm?.toLocaleString() ?? "—"}</td>
                      <td className="px-3 py-3 text-right tabular font-bold text-primary">
                        {r.distance != null ? r.distance.toLocaleString() : "—"}
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant="outline" className={typeLabel[r.statusKey]?.cls}>{r.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Info({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl bg-secondary/50 p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-display font-bold mt-0.5 ${highlight ? "text-primary text-lg" : ""}`}>{value}</div>
    </div>
  );
}
