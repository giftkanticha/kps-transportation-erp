import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  CircleDot, RotateCcw, Trash2, Plus, ChevronRight, History, Wrench, PackageX,
  AlertCircle, CheckCircle2, Search, TrendingDown,
} from "lucide-react";
import { useKPS, numericLayouts, tireStatusLabel, cpk, conditionFromTread } from "@/lib/store";
import { useAuth } from "@/contexts/AuthContext";
import type { Tire } from "@/lib/store";
import { toast } from "sonner";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";
import { toThaiDate, toThaiDateTime } from "@/lib/thaiDate";

const conditionColors: Record<string, string> = {
  new: "bg-success text-success-foreground",
  good: "bg-primary text-primary-foreground",
  warning: "bg-warning text-warning-foreground",
  critical: "bg-destructive text-destructive-foreground",
  empty: "bg-secondary text-muted-foreground border-2 border-dashed border-border",
};

function TireDot({ tire, pos, onClick, dim }: { tire?: Tire; pos: string; onClick: () => void; dim?: boolean }) {
  const cond = tire?.condition ?? "empty";
  const isEmpty = !tire;
  return (
    <button
      onClick={onClick}
      className={`group relative h-14 w-10 rounded-lg flex items-center justify-center font-display font-bold text-[10px] shadow-md transition-all hover:scale-110 hover:shadow-glow ${conditionColors[cond]} ${dim ? "opacity-40" : ""}`}
      title={`${pos}${tire ? " · " + tire.serial : ""}`}
    >
      {isEmpty ? <Plus className="h-4 w-4 opacity-50" /> : <CircleDot className="h-4 w-4" />}
      <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-semibold text-muted-foreground whitespace-nowrap">{pos}</span>
    </button>
  );
}

function TireMap({ vehicleId, type, rotateMode, onPickRotate, rotatePicks, onSelect }: {
  vehicleId: string; type: number;
  rotateMode: boolean; rotatePicks: string[];
  onPickRotate: (tireId: string) => void;
  onSelect: (pos: string) => void;
}) {
  const layout = numericLayouts[type];
  const tires = useKPS(s => s.tires);
  const get = (pos: number) => tires.find(t => t.vehicleId === vehicleId && t.position === `P${pos}` && t.status === "in-use");

  if (!layout) {
    return <p className="text-sm text-muted-foreground text-center py-6">ไม่มีผังสำหรับรถประเภทนี้</p>;
  }

  return (
    <div className="space-y-6">
      <div className="text-center text-xs text-muted-foreground">{layout.label}</div>
      {layout.groups.map((g, gi) => (
        <div key={gi}>
          <div className="text-xs font-semibold text-primary uppercase tracking-widest mb-3 text-center">{g.label}</div>
          <div className="rounded-2xl bg-gradient-card border border-border p-4 md:p-6 shadow-md">
            <div className="space-y-7">
              {g.rows.map((row, ri) => (
                <div key={ri} className="flex items-center justify-center gap-3">
                  {row.positions.map(pos => {
                    const tire = get(pos);
                    const dim = rotateMode && tire ? rotatePicks.length === 2 && !rotatePicks.includes(tire.id) : false;
                    return (
                      <TireDot
                        key={pos}
                        tire={tire}
                        pos={`P${pos}`}
                        dim={dim}
                        onClick={() => {
                          if (rotateMode && tire) onPickRotate(tire.id);
                          else onSelect(`P${pos}`);
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
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
  );
}

// ============= Page =============
export default function Tires() {
  const vehicles = useKPS(s => s.vehicles);
  const tires = useKPS(s => s.tires);
  const events = useKPS(s => s.events);
  const scraps = useKPS(s => s.scraps);
  const settings = useKPS(s => s.settings);
  const installTire = useKPS(s => s.installTire);
  const removeTire = useKPS(s => s.removeTire);
  const rotateTires = useKPS(s => s.rotateTires);
  const repairTire = useKPS(s => s.repairTire);
  const scrapSale = useKPS(s => s.scrapSale);
  const sellTire = useKPS(s => s.sellTire);
  const registerTire = useKPS(s => s.registerTire);

  const { can } = useAuth();
  const canSell = can("tire.sell", "approve");

  const mappable = vehicles;
  const [selectedId, setSelectedId] = useState(mappable[0]?.id ?? "");
  const selected = mappable.find(v => v.id === selectedId)!;

  // Dialog state
  const [posDialog, setPosDialog] = useState<string | null>(null);
  const [installOpen, setInstallOpen] = useState(false);
  const [installTireId, setInstallTireId] = useState("");
  const [installMileage, setInstallMileage] = useState(selected?.mileage ?? 0);
  const [repairOpen, setRepairOpen] = useState<string | null>(null);
  const [scrapOpen, setScrapOpen] = useState<string | null>(null);
  const [sellOpen, setSellOpen] = useState<string | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState<string | null>(null);

  // rotate
  const [rotateMode, setRotateMode] = useState(false);
  const [rotatePicks, setRotatePicks] = useState<string[]>([]);

  const selectedTire = posDialog ? tires.find(t => t.vehicleId === selectedId && t.position === posDialog && t.status === "in-use") : null;
  // Install dialog: only "stock" tires (not sold/scrapped) are selectable
  const stockTires = tires.filter(t => t.status === "stock");
  const wornTires = tires.filter(t => t.status === "in-use" && t.condition === "critical");
  const sortedTires = useMemo(() => {
    const plate = (id?: string) => vehicles.find(v => v.id === id)?.plate ?? "zzz";
    return [...tires].sort((a, b) => {
      const pa = plate(a.vehicleId), pb = plate(b.vehicleId);
      if (pa !== pb) return pa.localeCompare(pb);
      return a.serial.localeCompare(b.serial);
    });
  }, [tires, vehicles]);

  // CPK by brand
  const brandCpk = useMemo(() => {
    const map = new Map<string, { totalCost: number; totalKm: number }>();
    tires.filter(t => (t.installedKm ?? 0) > 0).forEach(t => {
      const km = (t.currentKm ?? 0) - (t.installedKm ?? 0);
      if (km <= 0) return;
      const m = map.get(t.brand) ?? { totalCost: 0, totalKm: 0 };
      m.totalCost += t.purchasePrice; m.totalKm += km;
      map.set(t.brand, m);
    });
    return Array.from(map.entries()).map(([brand, v]) => ({ brand, cpk: +(v.totalCost / v.totalKm).toFixed(2) }));
  }, [tires]);

  // Metrics
  const total = tires.length;
  const inUse = tires.filter(t => t.status === "in-use").length;
  const needReplace = tires.filter(t => t.status === "in-use" && t.treadDepth <= settings.warnTread).length;
  const totalCost = tires.reduce((a, t) => a + t.purchasePrice, 0);

  function onPickRotate(tireId: string) {
    setRotatePicks(prev => {
      if (prev.includes(tireId)) return prev.filter(x => x !== tireId);
      if (prev.length >= 2) return prev;
      const next = [...prev, tireId];
      if (next.length === 2) {
        rotateTires(next[0], next[1]);
        toast.success("สลับยางสำเร็จ");
        setRotateMode(false);
        return [];
      }
      return next;
    });
  }

  function handleInstall() {
    if (!installTireId || !posDialog) return;
    if (installMileage < selected.mileage) {
      toast.error(`เลขไมล์ต้องไม่น้อยกว่า ${selected.mileage.toLocaleString()}`);
      return;
    }
    installTire(installTireId, selectedId, posDialog, installMileage);
    toast.success("ติดตั้งยางเรียบร้อย");
    setInstallOpen(false); setPosDialog(null); setInstallTireId("");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold md:text-4xl">ระบบจัดการยาง</h1>
          <p className="mt-1 text-sm text-muted-foreground">แผนผังยาง · ทะเบียนยาง · ซ่อม · CPK · ขายซาก</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setRotateMode(m => !m); setRotatePicks([]); }} className={rotateMode ? "border-primary text-primary" : ""}>
            <RotateCcw className="h-4 w-4 mr-1.5" /> {rotateMode ? "ยกเลิกสลับยาง" : "โหมดสลับยาง"}
          </Button>
          <Button className="bg-gradient-primary text-primary-foreground shadow-glow" onClick={() => setRegisterOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> ลงทะเบียนยางใหม่
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "ยางทั้งหมด", value: total, icon: CircleDot, accent: "bg-primary/15 text-primary" },
          { label: "กำลังใช้งาน", value: inUse, icon: CheckCircle2, accent: "bg-accent/30 text-accent-foreground" },
          { label: "ต้องเปลี่ยน", value: needReplace, icon: AlertCircle, accent: "bg-destructive/15 text-destructive" },
          { label: "ต้นทุนยางรวม", value: `฿${(totalCost / 1000).toFixed(0)}K`, icon: TrendingDown, accent: "bg-highlight/30 text-highlight-foreground" },
        ].map(s => (
          <Card key={s.label} className="glass-card border-0">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${s.accent}`}><s.icon className="h-5 w-5" /></div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
                <div className="font-display font-bold text-2xl tabular">{s.value}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="map">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="map">แผนผังยาง</TabsTrigger>
          <TabsTrigger value="registry">ทะเบียนยาง ({tires.length})</TabsTrigger>
          <TabsTrigger value="cpk">CPK ตามยี่ห้อ</TabsTrigger>
          <TabsTrigger value="scrap">ขายซาก</TabsTrigger>
          <TabsTrigger value="settings">เกณฑ์</TabsTrigger>
        </TabsList>

        {/* Map */}
        <TabsContent value="map" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <Card className="glass-card border-0 h-fit">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-display">เลือกรถ</CardTitle></CardHeader>
              <CardContent className="space-y-1.5">
                {mappable.map(v => (
                  <button key={v.id} onClick={() => setSelectedId(v.id)}
                    className={`w-full flex items-center gap-3 rounded-xl p-3 text-left transition-all ${selectedId === v.id ? "bg-gradient-primary text-primary-foreground shadow-glow" : "hover:bg-secondary"}`}>
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg font-display font-bold text-xs shrink-0 ${selectedId === v.id ? "bg-primary-foreground/20" : "bg-gradient-fresh text-primary-foreground"}`}>{v.type}</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate">{v.plate}</div>
                      <div className={`text-[11px] tabular ${selectedId === v.id ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{v.mileage.toLocaleString()} กม.</div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 opacity-60" />
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card className="glass-card border-0">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="font-display">{selected?.plate}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">รถ {selected?.type} ล้อ · {selected?.mileage.toLocaleString()} กม.</p>
                  </div>
                  {rotateMode && (
                    <Badge className="bg-primary/15 text-primary border-primary/30">เลือกยาง 2 ตำแหน่งเพื่อสลับ ({rotatePicks.length}/2)</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {selected && (
                  <TireMap
                    vehicleId={selected.id}
                    type={selected.type}
                    rotateMode={rotateMode}
                    rotatePicks={rotatePicks}
                    onPickRotate={onPickRotate}
                    onSelect={(pos) => setPosDialog(pos)}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Registry */}
        <TabsContent value="registry" className="mt-4">
          <Card className="glass-card border-0">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-3">Serial</th><th className="px-3 py-3">ยี่ห้อ/รุ่น</th>
                    <th className="px-3 py-3">ขนาด</th><th className="px-3 py-3 text-right">ราคา</th>
                    <th className="px-3 py-3">ผู้ขาย</th><th className="px-3 py-3">สถานะ</th>
                    <th className="px-3 py-3">ตำแหน่ง</th><th className="px-3 py-3 text-right">CPK</th>
                    <th className="px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedTires.map(t => {
                    const plate = vehicles.find(v => v.id === t.vehicleId)?.plate;
                    const locked = t.status === "sold" || t.status === "scrapped";
                    return (
                    <tr key={t.id} className="hover:bg-secondary/40">
                      <td className="px-3 py-3 font-display font-bold tabular text-primary">{t.serial}</td>
                      <td className="px-3 py-3"><div className="font-semibold">{t.brand}</div><div className="text-xs text-muted-foreground">{t.model}</div></td>
                      <td className="px-3 py-3 tabular">{t.size}</td>
                      <td className="px-3 py-3 text-right tabular">฿{t.purchasePrice.toLocaleString()}</td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">{t.vendor}</td>
                      <td className="px-3 py-3"><Badge variant="outline" className={
                        t.status === "in-use" ? "border-success/40 bg-success/10 text-success" :
                        t.status === "stock" ? "border-primary/40 bg-primary/10 text-primary" :
                        t.status === "repair" ? "border-warning/40 bg-warning/15 text-warning-foreground" :
                        t.status === "sold" ? "border-muted-foreground/40 bg-muted text-muted-foreground" :
                        "border-destructive/40 bg-destructive/10 text-destructive"
                      }>{tireStatusLabel[t.status]}</Badge></td>
                      <td className="px-3 py-3 tabular text-xs">{plate ? `${plate} · ${t.position}` : (t.position ?? "—")}</td>
                      <td className="px-3 py-3 text-right font-bold tabular text-primary">{cpk(t) > 0 ? `฿${cpk(t).toFixed(2)}` : "—"}</td>
                      <td className="px-3 py-3 text-right space-x-1">
                        {!locked && t.status === "stock" && canSell && (
                          <>
                            <Button variant="ghost" size="sm" title="ขายแล้ว" onClick={() => setSellOpen(t.id)}>ขาย</Button>
                            <Button variant="ghost" size="sm" title="ขายซาก" onClick={() => setScrapOpen(t.id)}>ซาก</Button>
                          </>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(t.id)}><History className="h-4 w-4" /></Button>
                      </td>
                    </tr>
                  );})}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CPK chart */}
        <TabsContent value="cpk" className="mt-4">
          <Card className="glass-card border-0">
            <CardHeader><CardTitle className="font-display">เปรียบเทียบ CPK ตามยี่ห้อ (฿/กม.)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={brandCpk}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="brand" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} formatter={(v: number) => `฿${v}`} />
                  <Bar dataKey="cpk" radius={[8, 8, 0, 0]}>
                    {brandCpk.map((_, i) => <Cell key={i} fill={["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--highlight))", "hsl(var(--warning))"][i % 4]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scrap */}
        <TabsContent value="scrap" className="mt-4 space-y-4">
          <Card className="glass-card border-0">
            <CardHeader><CardTitle className="font-display">ยางที่หมดสภาพ / รอจำหน่าย</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {wornTires.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">ไม่มียางที่ต้องจำหน่ายขณะนี้</p>}
              {wornTires.map(t => (
                <div key={t.id} className="flex items-center justify-between rounded-xl border border-border p-3">
                  <div>
                    <div className="font-display font-bold text-primary">{t.serial}</div>
                    <div className="text-xs text-muted-foreground">{t.brand} {t.model} · ดอกเหลือ {t.treadDepth}mm</div>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">{tireStatusLabel[t.status]}</Badge>
                    <Button size="sm" variant="outline" onClick={() => setSellOpen(t.id)}>ขายแล้ว</Button>
                    <Button size="sm" variant="outline" onClick={() => setScrapOpen(t.id)}><PackageX className="h-4 w-4 mr-1.5" /> ขายซาก</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="glass-card border-0">
            <CardHeader><CardTitle className="font-display">บันทึกการขายซาก</CardTitle></CardHeader>
            <CardContent>
              {scraps.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">ยังไม่มีบันทึก</p>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground"><th className="px-3 py-2">วันที่</th><th className="px-3 py-2">Serial</th><th className="px-3 py-2">ผู้ซื้อ</th><th className="px-3 py-2 text-right">ราคา</th></tr></thead>
                  <tbody className="divide-y divide-border">
                    {scraps.map(s => (
                      <tr key={s.id}><td className="px-3 py-2">{toThaiDate(s.date)}</td><td className="px-3 py-2 font-display font-bold text-primary">{s.serial}</td><td className="px-3 py-2">{s.buyer}</td><td className="px-3 py-2 text-right font-bold tabular">฿{s.price.toLocaleString()}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings */}
        <TabsContent value="settings" className="mt-4">
          <Card className="glass-card border-0 max-w-xl">
            <CardHeader><CardTitle className="font-display">ตั้งค่าเกณฑ์ยาง</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>เป้าหมายระยะทางต่อเส้น (กม.)</Label>
                <Input type="number" value={settings.targetKm} onChange={e => useKPS.setState(st => ({ settings: { ...st.settings, targetKm: +e.target.value } }))} />
              </div>
              <div className="grid gap-2">
                <Label>ความลึกดอกยางขั้นต่ำ (mm)</Label>
                <Input type="number" step="0.1" value={settings.minTread} onChange={e => useKPS.setState(st => ({ settings: { ...st.settings, minTread: +e.target.value } }))} />
              </div>
              <div className="grid gap-2">
                <Label>เกณฑ์เตือน (mm)</Label>
                <Input type="number" step="0.1" value={settings.warnTread} onChange={e => useKPS.setState(st => ({ settings: { ...st.settings, warnTread: +e.target.value } }))} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Position dialog */}
      <Dialog open={!!posDialog} onOpenChange={(o) => !o && setPosDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2"><CircleDot className="h-5 w-5 text-primary" /> ตำแหน่ง {posDialog}</DialogTitle>
            <DialogDescription>{selected?.plate}</DialogDescription>
          </DialogHeader>
          {selectedTire ? (
            <div className="space-y-3">
              <div className="rounded-xl bg-secondary/60 p-4 space-y-2 text-sm">
                <Row label="Serial" value={selectedTire.serial} mono />
                <Row label="ยี่ห้อ/รุ่น" value={`${selectedTire.brand} ${selectedTire.model}`} />
                <Row label="ราคาซื้อ" value={`฿${selectedTire.purchasePrice.toLocaleString()}`} mono />
                <Row label="ระยะวิ่ง" value={`${((selectedTire.currentKm ?? 0) - (selectedTire.installedKm ?? 0)).toLocaleString()} กม.`} mono />
                <Row label="ดอกยาง" value={<Badge className={conditionColors[selectedTire.condition]}>{selectedTire.treadDepth} mm</Badge>} />
                <Row label="CPK" value={`฿${cpk(selectedTire).toFixed(2)}/กม.`} mono className="text-primary font-bold" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" onClick={() => { setHistoryOpen(selectedTire.id); }}><History className="h-4 w-4 mr-1" /> ประวัติ</Button>
                <Button variant="outline" onClick={() => setRepairOpen(selectedTire.id)}><Wrench className="h-4 w-4 mr-1" /> ซ่อม</Button>
                <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => { removeTire(selectedTire.id); toast.success("ถอดยางเรียบร้อย"); setPosDialog(null); }}>
                  <Trash2 className="h-4 w-4 mr-1" /> ถอด
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center py-2">ตำแหน่งนี้ยังไม่มียาง</p>
              <Button className="w-full bg-gradient-primary text-primary-foreground" onClick={() => { setInstallMileage(selected.mileage); setInstallOpen(true); }}>
                <Plus className="h-4 w-4 mr-1.5" /> ติดตั้งยาง
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Install dialog */}
      <Dialog open={installOpen} onOpenChange={setInstallOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>ติดตั้งยางใหม่ที่ {posDialog}</DialogTitle></DialogHeader>
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
              <Label>เลขไมล์ขณะติดตั้ง (ปัจจุบัน {selected?.mileage.toLocaleString()})</Label>
              <Input type="number" value={installMileage} onChange={e => setInstallMileage(+e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInstallOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleInstall} className="bg-gradient-primary text-primary-foreground">ติดตั้ง</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Repair dialog */}
      <RepairDialog open={!!repairOpen} tireId={repairOpen} onClose={() => setRepairOpen(null)} onSubmit={(c, n, i) => { repairTire(repairOpen!, c, n, i); toast.success("บันทึกซ่อมเรียบร้อย"); setRepairOpen(null); }} />

      {/* Scrap dialog */}
      <ScrapDialog open={!!scrapOpen} tireId={scrapOpen} onClose={() => setScrapOpen(null)} onSubmit={(b, p) => { scrapSale(scrapOpen!, b, p); toast.success("บันทึกขายซากเรียบร้อย"); setScrapOpen(null); }} title="ขายซากยาง" />
      <ScrapDialog open={!!sellOpen} tireId={sellOpen} onClose={() => setSellOpen(null)} onSubmit={(b, p) => { sellTire(sellOpen!, b, p); toast.success("บันทึกการขายเรียบร้อย"); setSellOpen(null); }} title="ขายยาง (Sold)" />

      {/* Register dialog */}
      <RegisterTireDialog open={registerOpen} onClose={() => setRegisterOpen(false)} onSubmit={(t) => { registerTire(t); toast.success("ลงทะเบียนยางเรียบร้อย"); setRegisterOpen(false); }} />

      {/* History dialog */}
      <Dialog open={!!historyOpen} onOpenChange={(o) => !o && setHistoryOpen(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>ประวัติยาง {tires.find(t => t.id === historyOpen)?.serial}</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {events.filter(e => e.tireId === historyOpen).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มีบันทึก</p>}
            {events.filter(e => e.tireId === historyOpen).map(e => (
              <div key={e.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex justify-between"><Badge variant="outline">{({install:"ติดตั้ง",remove:"ถอด",rotate:"สลับ",repair:"ซ่อม",scrap:"ขายซาก",register:"ลงทะเบียน"} as any)[e.type]}</Badge><span className="text-xs text-muted-foreground">{toThaiDate(e.date)}</span></div>
                <div className="text-xs mt-1 text-muted-foreground">{e.position && `ตำแหน่ง ${e.position}`} {e.fromPosition && `${e.fromPosition} → ${e.toPosition}`} {e.mileage && `· ${e.mileage.toLocaleString()} กม.`} {e.cost && `· ฿${e.cost.toLocaleString()}`}</div>
                {e.note && <div className="text-xs mt-1">{e.note}</div>}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value, mono, className }: any) {
  return <div className={`flex justify-between ${className ?? ""}`}><span className="text-xs text-muted-foreground">{label}</span><span className={`text-sm font-semibold ${mono ? "tabular" : ""}`}>{value}</span></div>;
}

function RepairDialog({ open, tireId, onClose, onSubmit }: any) {
  const [cost, setCost] = useState(0);
  const [note, setNote] = useState("");
  const [internal, setInternal] = useState(true);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>บันทึกการซ่อมยาง</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-2"><Label>ค่าใช้จ่าย (บาท)</Label><Input type="number" value={cost} onChange={e => setCost(+e.target.value)} /></div>
          <div className="grid gap-2"><Label>บริการ</Label>
            <Select value={internal ? "in" : "ex"} onValueChange={(v) => setInternal(v === "in")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="in">ภายใน</SelectItem><SelectItem value="ex">ภายนอก</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="grid gap-2"><Label>รายละเอียด</Label><Textarea value={note} onChange={e => setNote(e.target.value)} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>ยกเลิก</Button><Button onClick={() => onSubmit(cost, note, internal)} className="bg-gradient-primary text-primary-foreground">บันทึก</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScrapDialog({ open, onClose, onSubmit, title }: any) {
  const [buyer, setBuyer] = useState(""); const [price, setPrice] = useState(0);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title ?? "ขายซากยาง"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-2"><Label>ชื่อผู้ซื้อ</Label><Input value={buyer} onChange={e => setBuyer(e.target.value)} /></div>
          <div className="grid gap-2"><Label>ราคาขาย (บาท)</Label><Input type="number" value={price} onChange={e => setPrice(+e.target.value)} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>ยกเลิก</Button><Button disabled={!buyer || price <= 0} onClick={() => onSubmit(buyer, price)} className="bg-gradient-primary text-primary-foreground">บันทึกการขาย</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RegisterTireDialog({ open, onClose, onSubmit }: any) {
  const [f, setF] = useState({ serial: "", brand: "", model: "", size: "11R22.5", purchasePrice: 0, vendor: "", purchaseDate: new Date().toISOString().slice(0, 10), treadDepth: 14 });
  const update = (k: string, v: any) => setF(p => ({ ...p, [k]: v }));
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>ลงทะเบียนยางใหม่</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Serial No" v={f.serial} k="serial" u={update} />
          <Field label="ยี่ห้อ" v={f.brand} k="brand" u={update} />
          <Field label="รุ่น" v={f.model} k="model" u={update} />
          <Field label="ขนาด" v={f.size} k="size" u={update} />
          <Field label="ราคา (บาท)" v={f.purchasePrice} k="purchasePrice" u={update} type="number" />
          <Field label="ผู้ขาย" v={f.vendor} k="vendor" u={update} />
          <Field label="วันที่ซื้อ" v={f.purchaseDate} k="purchaseDate" u={update} type="date" />
          <Field label="ดอกยาง (mm)" v={f.treadDepth} k="treadDepth" u={update} type="number" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button disabled={!f.serial || !f.brand} onClick={() => onSubmit({ ...f, condition: conditionFromTread(f.treadDepth) })} className="bg-gradient-primary text-primary-foreground">ลงทะเบียน</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function Field({ label, v, k, u, type = "text" }: any) {
  return <div className="grid gap-1.5"><Label className="text-xs">{label}</Label><Input type={type} value={v} onChange={e => u(k, type === "number" ? +e.target.value : e.target.value)} /></div>;
}
