import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { CircleDot, Plus, Printer, Trash2, History, ArrowLeftRight } from "lucide-react";
import { useKPS, numericLayouts, tireStatusLabel, cpk } from "@/lib/store";
import { TirePrintReport } from "@/components/TirePrintReport";
import type { Tire } from "@/lib/store";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { toThaiDate, toThaiDateTime } from "@/lib/thaiDate";

const conditionColors: Record<string, string> = {
  new: "bg-success text-success-foreground",
  good: "bg-primary text-primary-foreground",
  warning: "bg-warning text-warning-foreground",
  critical: "bg-destructive text-destructive-foreground",
  empty: "bg-secondary text-muted-foreground border-2 border-dashed border-border",
};

export default function TireLayout() {
  const vehicles = useKPS(s => s.vehicles);
  const tires = useKPS(s => s.tires);
  const events = useKPS(s => s.events);
  const installTire = useKPS(s => s.installTire);
  const removeTire = useKPS(s => s.removeTire);

  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? "");
  const vehicle = vehicles.find(v => v.id === vehicleId);
  const layout = vehicle ? numericLayouts[vehicle.type] : undefined;

  const [openPos, setOpenPos] = useState<number | null>(null);
  const [installOpen, setInstallOpen] = useState(false);
  const [installTireId, setInstallTireId] = useState("");
  const [installMileage, setInstallMileage] = useState(0);

  const tireAt = (pos: string) =>
    tires.find(t => t.vehicleId === vehicleId && t.position === pos && t.status === "in-use");
  const selectedTire = openPos ? tireAt(`P${openPos}`) : null;
  const spareTire = (slot: "S1" | "S2") => tireAt(slot);
  const [openSpare, setOpenSpare] = useState<"S1" | "S2" | null>(null);
  const selectedSpareTire = openSpare ? spareTire(openSpare) : null;
  const stockTires = tires.filter(t => t.status === "stock");

  const vehicleTires = useMemo(
    () => tires.filter(t => t.vehicleId === vehicleId && t.status === "in-use"),
    [tires, vehicleId]
  );

  const tireHistorySnippet = (tireId: string) =>
    events.filter(e => e.tireId === tireId && (e.type === "install" || e.type === "remove" || e.type === "rotate"));

  function handleInstall() {
    if (!installTireId || !openPos || !vehicle) return;
    if (installMileage < vehicle.mileage) {
      toast.error(`เลขไมล์ต้องไม่น้อยกว่า ${vehicle.mileage.toLocaleString()}`);
      return;
    }
    installTire(installTireId, vehicleId, `P${openPos}`, installMileage);
    toast.success(`ติดตั้งยางที่ตำแหน่ง P${openPos} เรียบร้อย`);
    setInstallOpen(false); setOpenPos(null); setInstallTireId("");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between print:hidden">
        <div>
          <h1 className="font-display text-3xl font-bold md:text-4xl">ผังตำแหน่งยาง</h1>
          <p className="mt-1 text-sm text-muted-foreground">เลือกรถเพื่อดูผังยางแบบ Interactive · เปลี่ยนตามประเภทรถอัตโนมัติ</p>
        </div>
        <div className="flex gap-2">
          <Button asChild className="bg-gradient-primary text-primary-foreground">
            <Link to="/tires"><Plus className="h-4 w-4 mr-1.5" /> ลงทะเบียนยางใหม่</Link>
          </Button>
          <Button variant="outline" onClick={() => {
            document.documentElement.classList.add("print-portrait");
            const cleanup = () => {
              document.documentElement.classList.remove("print-portrait");
              window.removeEventListener("afterprint", cleanup);
            };
            window.addEventListener("afterprint", cleanup);
            setTimeout(() => window.print(), 50);
          }}>
            <Printer className="h-4 w-4 mr-1.5" /> พิมพ์รายงานสรุปรายคัน
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr] print:grid-cols-1">
        <Card className="glass-card border-0 h-fit print:hidden">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-display">เลือกรถ</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {vehicles.map(v => (
              <button key={v.id} onClick={() => setVehicleId(v.id)}
                className={`w-full flex items-center gap-3 rounded-xl p-3 text-left transition-all ${vehicleId === v.id ? "bg-gradient-primary text-primary-foreground shadow-glow" : "hover:bg-secondary"}`}>
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg font-display font-bold text-xs shrink-0 ${vehicleId === v.id ? "bg-primary-foreground/20" : "bg-gradient-fresh text-primary-foreground"}`}>{v.type}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{v.plate}</div>
                  <div className={`text-[11px] tabular ${vehicleId === v.id ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{v.mileage.toLocaleString()} กม.</div>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="glass-card border-0">
            <CardHeader>
              <div className="flex items-end justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle className="font-display text-2xl">รายงานสถานะและประวัติยาง ทะเบียน {vehicle?.plate}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">{layout?.label} · เลขไมล์ {vehicle?.mileage.toLocaleString()} กม.</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {layout && (
                <div className="space-y-8">
                  {layout.groups.map((g, gi) => (
                    <div key={gi}>
                      <div className="text-xs font-semibold text-primary uppercase tracking-widest mb-3 text-center">{g.label}</div>
                      <div className="rounded-2xl bg-gradient-card border border-border p-4 md:p-6 shadow-md">
                        <div className="space-y-7">
                          {g.rows.map((row, ri) => (
                            <div key={ri} className="flex items-center justify-center gap-3">
                              {row.positions.map(pos => {
                                const tire = tireAt(`P${pos}`);
                                const cond = tire?.condition ?? "empty";
                                return (
                                  <button key={pos} onClick={() => setOpenPos(pos)}
                                    className={`group relative h-14 w-10 rounded-lg flex items-center justify-center font-display font-bold text-[10px] shadow-md transition-all hover:scale-110 hover:shadow-glow ${conditionColors[cond]}`}
                                    title={`P${pos}${tire ? " · " + tire.serial : ""}`}>
                                    {tire ? <CircleDot className="h-4 w-4" /> : <Plus className="h-4 w-4 opacity-50" />}
                                    <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-semibold text-muted-foreground whitespace-nowrap">P{pos}</span>
                                  </button>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                  {/* Spare tires - mounted at rear */}
                  <div>
                    <div className="text-xs font-semibold text-warning uppercase tracking-widest mb-3 text-center">ยางสำรอง (ท้ายรถ)</div>
                    <div className="rounded-2xl bg-warning/5 border border-warning/30 p-4 md:p-6 shadow-md">
                      <div className="flex items-center justify-center gap-6">
                        {(["S1", "S2"] as const).map(slot => {
                          const tire = spareTire(slot);
                          const cond = tire?.condition ?? "empty";
                          return (
                            <button key={slot} onClick={() => setOpenSpare(slot)}
                              className={`group relative h-14 w-12 rounded-lg flex items-center justify-center font-display font-bold text-[10px] shadow-md transition-all hover:scale-110 hover:shadow-glow ${conditionColors[cond]}`}
                              title={`${slot}${tire ? " · " + tire.serial : ""}`}>
                              {tire ? <CircleDot className="h-4 w-4" /> : <Plus className="h-4 w-4 opacity-50" />}
                              <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-warning whitespace-nowrap">{slot === "S1" ? "สำรอง 1" : "สำรอง 2"}</span>
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-muted-foreground text-center mt-7">ยางสำรองจะไม่ถูกบวกเลขไมล์เพิ่มจนกว่าจะถูกสลับไปตำแหน่งล้อหลัก</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    {[
                      { label: "ใหม่", c: "new" }, { label: "ดี", c: "good" },
                      { label: "ดอกต่ำ", c: "warning" }, { label: "วิกฤต", c: "critical" }, { label: "ว่าง", c: "empty" },
                    ].map(l => (
                      <div key={l.c} className="flex items-center gap-1.5">
                        <span className={`h-3 w-3 rounded ${conditionColors[l.c]}`} />
                        <span className="text-xs text-muted-foreground">{l.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card border-0">
            <CardHeader><CardTitle className="font-display text-base">ตารางยางปัจจุบันและประวัติย่อ</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-3">ตำแหน่ง</th>
                    <th className="px-3 py-3">Serial</th>
                    <th className="px-3 py-3">ยี่ห้อ/รุ่น</th>
                    <th className="px-3 py-3 text-right">เลขไมล์เริ่ม</th>
                    <th className="px-3 py-3 text-right">ระยะวิ่ง (กม.)</th>
                    <th className="px-3 py-3">สถานะ</th>
                    <th className="px-3 py-3">ประวัติย่อ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {vehicleTires.length === 0 && (
                    <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">ยังไม่มีข้อมูลยางในรถคันนี้</td></tr>
                  )}
                  {vehicleTires.map(t => {
                    const km = (t.currentKm ?? 0) - (t.installedKm ?? 0);
                    const hist = tireHistorySnippet(t.id).slice(-2);
                    return (
                      <tr key={t.id}>
                        <td className="px-3 py-3 font-bold tabular">{t.position}</td>
                        <td className="px-3 py-3 font-display font-bold text-primary">{t.serial}</td>
                        <td className="px-3 py-3"><div className="font-semibold">{t.brand}</div><div className="text-xs text-muted-foreground">{t.model}</div></td>
                        <td className="px-3 py-3 text-right tabular">{(t.installedKm ?? 0).toLocaleString()}</td>
                        <td className="px-3 py-3 text-right tabular font-bold">{km.toLocaleString()}</td>
                        <td className="px-3 py-3"><Badge className={conditionColors[t.condition]}>{tireStatusLabel[t.status]}</Badge></td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">
                          {hist.length === 0 ? "—" : hist.map(h => `${toThaiDate(h.date)} ${h.type === "install" ? "ติดตั้ง" : h.type === "remove" ? "ถอด" : "สลับ"}`).join(" · ")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Position dialog */}
      <Dialog open={!!openPos} onOpenChange={(o) => !o && setOpenPos(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2"><CircleDot className="h-5 w-5 text-primary" /> ตำแหน่ง P{openPos}</DialogTitle>
            <DialogDescription>{vehicle?.plate}</DialogDescription>
          </DialogHeader>
          {selectedTire ? (
            <div className="space-y-3">
              <div className="rounded-xl bg-secondary/60 p-4 space-y-2 text-sm">
                <Row label="Serial" value={selectedTire.serial} mono />
                <Row label="ยี่ห้อ/รุ่น" value={`${selectedTire.brand} ${selectedTire.model}`} />
                <Row label="เลขไมล์เริ่ม" value={`${(selectedTire.installedKm ?? 0).toLocaleString()} กม.`} mono />
                <Row label="ระยะวิ่ง" value={`${((selectedTire.currentKm ?? 0) - (selectedTire.installedKm ?? 0)).toLocaleString()} กม.`} mono />
                <Row label="CPK" value={`฿${cpk(selectedTire).toFixed(2)}/กม.`} mono className="text-primary font-bold" />
              </div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">ประวัติบนรถคันก่อนหน้า</div>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {tireHistorySnippet(selectedTire.id)
                  .filter(h => h.vehicleId !== vehicleId)
                  .map(h => {
                    const v = vehicles.find(x => x.id === h.vehicleId);
                    return (
                      <div key={h.id} className="text-xs rounded-md border border-border p-2 flex justify-between">
                        <span>{toThaiDate(h.date)} · {v?.plate ?? "—"} · {h.position}</span>
                        <span className="text-muted-foreground">{h.type === "install" ? "ติดตั้ง" : h.type === "remove" ? "ถอด" : "สลับ"}</span>
                      </div>
                    );
                  })}
                {tireHistorySnippet(selectedTire.id).filter(h => h.vehicleId !== vehicleId).length === 0 && (
                  <p className="text-xs text-muted-foreground">ยังไม่เคยถูกติดตั้งบนรถคันอื่น</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button asChild variant="outline">
                  <Link to={`/tires/history?serial=${encodeURIComponent(selectedTire.serial)}`}>
                    <History className="h-4 w-4 mr-1" /> ประวัติเต็ม
                  </Link>
                </Button>
                <Button variant="outline" className="text-destructive hover:text-destructive"
                  onClick={() => { removeTire(selectedTire.id); toast.success("ถอดยางเรียบร้อย"); setOpenPos(null); }}>
                  <ArrowLeftRight className="h-4 w-4 mr-1" /> สลับยาง / ถอดออก
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center py-2">ตำแหน่งนี้ยังไม่มียาง</p>
              <Button className="w-full bg-gradient-primary text-primary-foreground"
                onClick={() => { setInstallMileage(vehicle?.mileage ?? 0); setInstallOpen(true); }}>
                <Plus className="h-4 w-4 mr-1.5" /> ติดตั้งยาง
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Install dialog */}
      <Dialog open={installOpen} onOpenChange={setInstallOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>ติดตั้งยางที่ P{openPos}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-2">
              <Label>เลือกยางในคลัง</Label>
              <Select value={installTireId} onValueChange={setInstallTireId}>
                <SelectTrigger><SelectValue placeholder="เลือกยาง..." /></SelectTrigger>
                <SelectContent>
                  {stockTires.map(t => <SelectItem key={t.id} value={t.id}>{t.serial} · {t.brand} {t.model} (฿{t.purchasePrice.toLocaleString()})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>เลขไมล์ขณะติดตั้ง (ปัจจุบัน {vehicle?.mileage.toLocaleString()})</Label>
              <Input type="number" value={installMileage} onChange={e => setInstallMileage(+e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInstallOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleInstall} className="bg-gradient-primary text-primary-foreground">ติดตั้ง</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Spare info dialog */}
      <Dialog open={!!openSpare} onOpenChange={(o) => !o && setOpenSpare(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <CircleDot className="h-5 w-5 text-warning" /> {openSpare === "S1" ? "ยางสำรอง 1" : "ยางสำรอง 2"}
            </DialogTitle>
            <DialogDescription>{vehicle?.plate}</DialogDescription>
          </DialogHeader>
          {selectedSpareTire ? (
            <div className="space-y-3">
              <div className="rounded-xl bg-secondary/60 p-4 space-y-2 text-sm">
                <Row label="Serial" value={selectedSpareTire.serial} mono />
                <Row label="ยี่ห้อ/รุ่น" value={`${selectedSpareTire.brand} ${selectedSpareTire.model}`} />
                <Row label="วันที่เริ่มใช้งาน" value={selectedSpareTire.purchaseDate} />
                <Row label="เลขไมล์สะสม" value={`${((selectedSpareTire.currentKm ?? 0) - (selectedSpareTire.installedKm ?? 0)).toLocaleString()} กม.`} mono />
              </div>
              <Button asChild className="w-full bg-gradient-primary text-primary-foreground">
                <Link to="/tires/manage">
                  <ArrowLeftRight className="h-4 w-4 mr-1.5" /> ไปหน้าบันทึกการจัดการและสลับยาง
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center py-2">ยังไม่มียางสำรองในตำแหน่งนี้</p>
              <Button asChild className="w-full bg-gradient-primary text-primary-foreground">
                <Link to="/tires/manage"><Plus className="h-4 w-4 mr-1.5" /> ติดตั้งยางสำรองในหน้าจัดการยาง</Link>
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {vehicle && layout && (
        <TirePrintReport vehicle={vehicle} layout={layout} tires={tires} />
      )}
    </div>
  );
}

function Row({ label, value, mono, className }: any) {
  return <div className={`flex justify-between ${className ?? ""}`}><span className="text-xs text-muted-foreground">{label}</span><span className={`text-sm font-semibold ${mono ? "tabular" : ""}`}>{value}</span></div>;
}
