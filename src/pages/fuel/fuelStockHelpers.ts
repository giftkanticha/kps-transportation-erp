import type { FuelRecord, FuelStock } from '../../types'

/** รายการปรับยอดตามนับจริง (ไม่ใช่การรับน้ำมันเข้า) */
export const isStockAdjustment = (s: FuelStock) => s.entryKind === 'ADJUSTMENT'

/** น้ำมันออกจากถังโรงงาน ตามที่หน้า "สรุปน้ำมันคลังโรงงานรายวัน" ใช้ */
export const isFactoryRecord = (f: FuelRecord) => f.station === 'ถังโรงงาน'

const d10 = (d: string | null | undefined) => (d ?? '').slice(0, 10)

/**
 * ยอดคงเหลือถังโรงงาน ณ สิ้นวัน dateISO — คิดแบบเดียวกับหน้าสรุปรายวัน
 * (fuel_stock ทุกแถวรวมรายการปรับยอด − fuel_records ที่ station = ถังโรงงาน)
 */
export function factoryBalanceAsOf(stocks: FuelStock[], records: FuelRecord[], dateISO: string): number {
  const inL = stocks.filter(s => d10(s.date) <= dateISO).reduce((sum, s) => sum + (s.liters || 0), 0)
  const outL = records
    .filter(f => isFactoryRecord(f) && d10(f.date) <= dateISO)
    .reduce((sum, f) => sum + (f.liters || 0), 0)
  return inL - outL
}
