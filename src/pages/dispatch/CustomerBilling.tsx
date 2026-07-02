import { useState, useMemo, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { db } from '../../lib/db'
import { useDispatches } from '../../hooks/useDispatches'
import { useList, useInsert, useUpdate } from '../../hooks/useTable'
import { Icon, Field } from '../../components/ui'
import type { CompanyBankAccount, BillingNote, Dispatch, DispatchLeg, Location, Vehicle } from '../../types'

const docTypeLabel = (t: BillingNote['docType']) => (t === 'receipt' ? 'ใบเสร็จรับเงิน' : 'ใบวางบิล')

const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']

interface BillableLeg {
  leg: DispatchLeg
  round: Dispatch
  gross: number
  wht: number
  net: number
}

const roundMonth = (d: Dispatch) => (d.returnAt || d.depart || d.date || '').slice(0, 7)

export function CustomerBilling() {
  const thisMonth = new Date().toISOString().slice(0, 7)
  const [customerId, setCustomerId] = useState('')   // = location id (is_customer)
  const [month, setMonth] = useState(thisMonth)
  const [allMonths, setAllMonths] = useState(false)  // รวมข้ามเดือนในใบเดียว
  const [whtMode, setWhtMode] = useState<'per_leg' | 'total' | 'none'>('per_leg')  // วิธีหัก ณ ที่จ่าย
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bankAccountId, setBankAccountId] = useState('')
  const [printNote, setPrintNote] = useState<BillingNote | null>(null)
  const [printOrient, setPrintOrient] = useState<'portrait' | 'landscape'>('landscape')
  const [printFont, setPrintFont] = useState(9)  // ขนาดตัวอักษรใบพิมพ์ (pt)
  const [payNote, setPayNote] = useState<BillingNote | null>(null)   // ใบที่กำลังบันทึกรับเงิน
  const [payDate, setPayDate] = useState('')                         // วันที่รับโอนจริง

  const { data: locations = [] } = useList<Location>('locations')
  const { data: vehicles = [] } = useList<Vehicle>('vehicles')
  const { data: dispatches = [] } = useDispatches()
  const { data: bankAccounts = [] } = useList<CompanyBankAccount>('company_bank_accounts')
  const { data: notes = [] } = useList<BillingNote>('billing_notes')
  const insertNote = useInsert<BillingNote>('billing_notes')
  const updateNote = useUpdate<BillingNote>('billing_notes')
  const updateLeg = useUpdate<DispatchLeg>('dispatch_legs')
  const insertLocation = useInsert<Location>('locations')
  const updateLocation = useUpdate<Location>('locations')

  const customerLocs = useMemo(
    () => locations.filter(l => l.isCustomer && l.active).sort((a, b) => a.name.localeCompare(b.name, 'th')),
    [locations],
  )
  const locById = useMemo(() => new Map(locations.map(l => [l.id, l])), [locations])
  const vehicleById = useMemo(() => new Map(vehicles.map(v => [v.id, v])), [vehicles])
  const plateOf = (d: Dispatch) => (d.vehicleId ? vehicleById.get(d.vehicleId)?.plate : '') || '—'
  // ป้ายเตือนว่าขานี้มาจากรอบที่ยังไม่ปิด (ยอดเป็นข้อมูลชั่วคราว อาจเปลี่ยนตอนปิดรอบจริง)
  const draftBadge = (d: Dispatch) =>
    d.roundStatus !== 'closed'
      ? <span className="badge amber" style={{ fontSize: 10, marginLeft: 6 }} title="ยังไม่ปิดรอบ — ยอดอาจเปลี่ยนตอนปิดรอบจริง">ยังไม่ปิดรอบ</span>
      : null
  const custByName = useMemo(() => {
    const m = new Map<string, Location>()
    for (const l of customerLocs) m.set(l.name, l)
    return m
  }, [customerLocs])

  // ผู้รับบิลของขา: override (billToLocationId) ก่อน, ไม่งั้น = ปลายทางถ้าเป็นลูกค้า
  const billTo = (leg: DispatchLeg): Location | null => {
    if (leg.billToLocationId) return locById.get(leg.billToLocationId) ?? null
    return custByName.get(leg.destination) ?? null
  }

  // default bank account
  useEffect(() => {
    if (bankAccountId) return
    const def = bankAccounts.find(b => b.isDefault && b.active) || bankAccounts.find(b => b.active)
    if (def) setBankAccountId(def.id)
  }, [bankAccounts, bankAccountId])

  const billedLegIds = useMemo(() => {
    const s = new Set<string>()
    for (const n of notes) {
      if (n.status === 'void') continue
      for (const id of n.legIds ?? []) s.add(id)
    }
    return s
  }, [notes])

  // สถานะการวางบิล/รับเงินราย "ขา" (ข้ามโน้ตที่ยกเลิก) — ใช้ในโต๊ะภาพรวม
  const legStatusById = useMemo(() => {
    const m = new Map<string, 'paid' | 'issued'>()
    const paidAt = new Map<string, string>()
    for (const n of notes) {
      if (n.status === 'void') continue
      for (const id of n.legIds ?? []) {
        // paid ชนะ issued เสมอ (ขาอยู่ในใบเสร็จ = รับเงินแล้ว)
        if (n.status === 'paid') { m.set(id, 'paid'); if (n.paidAt) paidAt.set(id, n.paidAt) }
        else if (!m.has(id)) m.set(id, 'issued')
      }
    }
    return { status: m, paidAt }
  }, [notes])

  const mk = (leg: DispatchLeg, round: Dispatch): BillableLeg => {
    const wht = db.legWht(leg)
    return { leg, round, gross: leg.amount || 0, wht, net: (leg.amount || 0) - wht }
  }

  // วันที่ขึ้น/ลงของขา — ถ้าไม่ได้กรอกต่อขา ให้ fallback ไปวันที่ของรอบ (ขาเก่ายังทำงาน)
  const legLoadDate = (b: BillableLeg) => b.leg.loadDate || b.round.date
  const legUnloadDate = (b: BillableLeg) => b.leg.unloadDate || (b.round.returnAt || '').slice(0, 10) || b.round.date

  // ขาที่ข้อมูลครบพอจะวางบิลได้แม้ยังไม่ปิดรอบ:
  // เหมา = ยอดไม่ขึ้นกับน้ำหนักปลายทาง | อื่นๆ = ต้องกรอกน้ำหนักปลายทางแล้ว
  const legDataReady = (l: DispatchLeg) =>
    (l.amount || 0) > 0 && (l.priceMode === 'lump' || l.deliveredWeight != null)

  // ขาที่ "ต้องเก็บเงิน" — ทุกขาที่ไม่ได้ตั้งไม่วางบิลและไม่ใช่เที่ยวเปล่า
  // ต้องโผล่ในหน้านี้เสมอแม้ข้อมูลยังไม่ครบ เพื่อไม่ให้ตกหล่นเงียบๆ
  const billIntent = (l: DispatchLeg) => !l.noBill && l.legType !== 'return'
  // พร้อมกดออกบิล: มียอด + (ปิดรอบแล้ว หรือข้อมูลครบพอ)
  const legReady = (l: DispatchLeg, closed: boolean) =>
    (l.amount || 0) > 0 && (closed || legDataReady(l))
  // เหตุผลที่ยังออกบิลไม่ได้ — โชว์เป็นป้าย "รอข้อมูล" แทนการซ่อนแถว
  const pendingReason = (l: DispatchLeg): string =>
    (l.amount || 0) <= 0 ? 'ยังไม่กรอกราคา/ยอด' : 'รอน้ำหนักปลายทาง หรือปิดรอบ'

  const eligible = useMemo<BillableLeg[]>(() => {
    const out: BillableLeg[] = []
    for (const d of dispatches) {
      if (!allMonths && roundMonth(d) !== month) continue
      const closed = d.roundStatus === 'closed'
      for (const leg of d.legs ?? []) {
        if (!leg.id || !billIntent(leg) || billedLegIds.has(leg.id)) continue
        if (!legReady(leg, closed)) continue
        if (billTo(leg)?.id !== customerId) continue
        out.push(mk(leg, d))
      }
    }
    return out.sort((a, b) => (a.round.date || '').localeCompare(b.round.date || ''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatches, customerId, month, allMonths, billedLegIds, custByName, locById])

  // ขาของลูกค้ารายนี้ที่ต้องเก็บเงินแต่ข้อมูลยังไม่ครบ — โชว์เป็น "รอข้อมูล" (เดิมถูกซ่อนจนตกหล่น)
  const pendingForCustomer = useMemo<BillableLeg[]>(() => {
    const out: BillableLeg[] = []
    for (const d of dispatches) {
      if (!allMonths && roundMonth(d) !== month) continue
      const closed = d.roundStatus === 'closed'
      for (const leg of d.legs ?? []) {
        if (!leg.id || !billIntent(leg) || billedLegIds.has(leg.id)) continue
        if (legReady(leg, closed)) continue
        if (billTo(leg)?.id !== customerId) continue
        out.push(mk(leg, d))
      }
    }
    return out.sort((a, b) => (a.round.date || '').localeCompare(b.round.date || ''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatches, customerId, month, allMonths, billedLegIds, custByName, locById])

  // ขาที่ต้องเก็บเงินแต่ยังหา "ผู้รับบิล" ไม่ได้ (ปลายทางไม่ใช่ลูกค้า & ไม่ override)
  // นับทุกเดือนเสมอ — เป็นคิวงานค้างที่ต้องเคลียร์ ไม่ใช่รายงานรายเดือน
  // (เดิมกรองตามเดือน ทำให้ขาค้างจากเดือนก่อนหายจากสายตา)
  const unassignedLegs = useMemo<BillableLeg[]>(() => {
    const out: BillableLeg[] = []
    for (const d of dispatches) {
      for (const leg of d.legs ?? []) {
        if (!leg.id || !billIntent(leg) || billedLegIds.has(leg.id)) continue
        if (billTo(leg)) continue
        out.push(mk(leg, d))
      }
    }
    return out.sort((a, b) => (a.round.date || '').localeCompare(b.round.date || ''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatches, billedLegIds, custByName, locById])

  // ขาที่ตั้ง "ไม่ต้องวางบิล" ในเดือนนี้ — ให้เอากลับมาได้ (ไม่รวมเที่ยวเปล่า)
  const noBillLegs = useMemo<BillableLeg[]>(() => {
    const out: BillableLeg[] = []
    for (const d of dispatches) {
      if (!allMonths && roundMonth(d) !== month) continue
      for (const leg of d.legs ?? []) {
        if (!leg.id || !leg.noBill || leg.legType === 'return') continue
        out.push(mk(leg, d))
      }
    }
    return out.sort((a, b) => (a.round.date || '').localeCompare(b.round.date || ''))
  }, [dispatches, month, allMonths])

  // โต๊ะภาพรวมรายลูกค้า — ทุกเดือน (ไม่ผูกตัวกรองเดือน เพื่อไม่ให้ยอดค้างข้ามเดือนหาย)
  interface CustOverview {
    id: string; name: string; total: number
    unbilled: number; unbilledAmt: number
    pending: number
    issued: number; issuedAmt: number
    paid: number; paidAmt: number
    outstanding: number; lastPaidAt: string; overdue: boolean
  }
  const overview = useMemo<CustOverview[]>(() => {
    const todayMs = Date.now()
    const map = new Map<string, CustOverview>()
    for (const d of dispatches) {
      const closed = d.roundStatus === 'closed'
      const baseDate = (d.returnAt || d.depart || d.date || '').slice(0, 10)
      for (const leg of d.legs ?? []) {
        if (!leg.id || !billIntent(leg)) continue
        const loc = billTo(leg)
        if (!loc) continue
        const net = (leg.amount || 0) - db.legWht(leg)
        const cur = map.get(loc.id) ?? { id: loc.id, name: loc.name, total: 0, unbilled: 0, unbilledAmt: 0, pending: 0, issued: 0, issuedAmt: 0, paid: 0, paidAmt: 0, outstanding: 0, lastPaidAt: '', overdue: false }
        cur.total += 1
        const st = legStatusById.status.get(leg.id)
        if (st === 'paid') {
          cur.paid += 1; cur.paidAmt += net
          const pa = legStatusById.paidAt.get(leg.id) || ''
          if (pa > cur.lastPaidAt) cur.lastPaidAt = pa
        } else {
          if (st === 'issued') { cur.issued += 1; cur.issuedAmt += net; cur.outstanding += net }
          else if (legReady(leg, closed)) { cur.unbilled += 1; cur.unbilledAmt += net; cur.outstanding += net }
          else { cur.pending += 1 }  // ต้องเก็บเงินแต่ข้อมูลยังไม่ครบ — ยอดยังไม่นิ่ง ไม่รวมในเงินคงค้าง
          if (baseDate && todayMs > new Date(baseDate).getTime() + (loc.credit ?? 30) * 86400000) cur.overdue = true
        }
        map.set(loc.id, cur)
      }
    }
    return [...map.values()].sort((a, b) => b.outstanding - a.outstanding)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatches, legStatusById, custByName, locById])

  // ─── ตัวเลขคุมยอดทั้งระบบ (นับทุกเดือน ไม่ขึ้นกับตัวกรองด้านล่าง) ───────────
  // แบ่ง 3 กลุ่มไม่ซ้ำกัน: พร้อมวางบิล / รอข้อมูล / ยังไม่มีผู้รับบิล
  const control = useMemo(() => {
    let readyCnt = 0, readyAmt = 0, pendingCnt = 0
    for (const o of overview) {
      readyCnt += o.unbilled; readyAmt += o.unbilledAmt
      pendingCnt += o.pending
    }
    return { readyCnt, readyAmt, pendingCnt, unassignedCnt: unassignedLegs.length }
  }, [overview, unassignedLegs])

  const restoreNoBill = (legId: string) => updateLeg.mutate({ id: legId, patch: { noBill: false } })

  const selectedLegs = useMemo(() => eligible.filter(b => selected.has(b.leg.id!)), [eligible, selected])
  const gross = selectedLegs.reduce((s, b) => s + b.gross, 0)
  const whtAmount = whtMode === 'none'
    ? 0
    : whtMode === 'total'
      ? Math.round(gross * 0.01 * 100) / 100      // หัก 1% จากยอดรวมทั้งใบ
      : selectedLegs.reduce((s, b) => s + b.wht, 0)  // หักรายเที่ยว (ตามที่ตั้งในแต่ละขา)
  const net = gross - whtAmount

  const toggleLegWht = (leg: DispatchLeg) => {
    if (!leg.id) return
    updateLeg.mutate({ id: leg.id, patch: { wht: !leg.wht } })
  }

  const customer = customerLocs.find(c => c.id === customerId)

  // เลือกผู้รับบิลจากแผง "ยังไม่มีผู้รับบิล":
  // value "id:<locId>" = ลูกค้าที่มีอยู่ | "name:<ชื่อ>" = ตั้งสถานที่นั้นเป็นลูกค้าให้เลย แล้วผูก
  const pickBillTo = async (leg: DispatchLeg, value: string) => {
    if (!value || !leg.id) return
    try {
      if (value === 'nobill') { await updateLeg.mutateAsync({ id: leg.id, patch: { noBill: true } }); return }
      let locId = ''
      if (value.startsWith('id:')) {
        locId = value.slice(3)
      } else if (value.startsWith('name:')) {
        const name = value.slice(5).trim()
        const existing = locations.find(l => l.name === name)
        if (!existing) {
          const created = await insertLocation.mutateAsync({ name, category: '', province: '', address: '', notes: '', active: true, isCustomer: true, credit: 30, taxId: '', phone: '', contact: '' })
          locId = created.id
        } else {
          locId = existing.id
          if (!existing.isCustomer) await updateLocation.mutateAsync({ id: existing.id, patch: { isCustomer: true, credit: existing.credit ?? 30 } })
        }
      }
      if (locId) await updateLeg.mutateAsync({ id: leg.id, patch: { billToLocationId: locId } })
    } catch (e) {
      alert('ตั้งลูกค้าไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  // แก้ผู้รับบิลของขาที่กดผิด: ย้ายลูกค้า / คืนค่าอัตโนมัติ / ตั้งไม่วางบิล
  const changeBillTo = async (leg: DispatchLeg, value: string) => {
    if (!leg.id || !value) return
    try {
      if (value === 'auto') await updateLeg.mutateAsync({ id: leg.id, patch: { billToLocationId: null, noBill: false } })
      else if (value === 'nobill') await updateLeg.mutateAsync({ id: leg.id, patch: { noBill: true } })
      else if (value.startsWith('id:')) await updateLeg.mutateAsync({ id: leg.id, patch: { billToLocationId: value.slice(3), noBill: false } })
    } catch (e) {
      alert('แก้ผู้รับบิลไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const toggleAll = () => setSelected(prev => prev.size === eligible.length ? new Set() : new Set(eligible.map(b => b.leg.id!)))

  const customerNotes = useMemo(
    () => notes
      .filter(n => (n.billToLocationId ?? '') === customerId && `${n.year}-${String(n.month).padStart(2, '0')}` === month)
      .sort((a, b) => (b.issuedAt || '').localeCompare(a.issuedAt || '')),
    [notes, customerId, month],
  )

  const issue = async (docType: BillingNote['docType']) => {
    if (!customerId || selectedLegs.length === 0) { alert('เลือกลูกค้าและขาอย่างน้อย 1 รายการ'); return }
    if (insertNote.isPending) return
    const [y, m] = month.split('-').map(Number)
    const seq = notes.filter(n => n.year === y && n.month === m).length + 1
    const prefix = docType === 'receipt' ? 'RC' : 'BN'
    const code = `${prefix}-${y}-${String(m).padStart(2, '0')}-${String(seq).padStart(4, '0')}`
    try {
      const created = await insertNote.mutateAsync({
        code, docType,
        billToLocationId: customerId,
        customerId: null,
        customerName: customer?.name ?? '',
        year: y, month: m,
        bankAccountId: bankAccountId || null,
        gross, whtAmount, net,
        legIds: selectedLegs.map(b => b.leg.id!),
        status: docType === 'receipt' ? 'paid' : 'issued',
        notes: '',
      })
      setSelected(new Set())
      setPrintNote(created)
    } catch (e) {
      alert('ออกเอกสารไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  // เปิดมินิ-โมดัลให้เลือก "วันที่รับโอนจริง" ก่อนบันทึกรับเงิน
  const openMarkPaid = (n: BillingNote) => {
    setPayDate(new Date().toISOString().slice(0, 10))
    setPayNote(n)
  }
  const confirmMarkPaid = async () => {
    if (!payNote || !payDate) return
    await updateNote.mutateAsync({ id: payNote.id, patch: { status: 'paid', paidAt: new Date(payDate).toISOString() } })
    setPayNote(null)
  }
  const voidNote = async (n: BillingNote) => {
    if (!confirm(`ยกเลิก ${docTypeLabel(n.docType)} ${n.code}? ขาในบิลจะกลับมาเลือกวางบิลใหม่ได้`)) return
    await updateNote.mutateAsync({ id: n.id, patch: { status: 'void' } })
  }

  useEffect(() => {
    if (!printNote) return
    const t = setTimeout(() => { window.print(); setPrintNote(null) }, 60)
    return () => clearTimeout(t)
  }, [printNote])

  const noteBank = (n: BillingNote) => bankAccounts.find(b => b.id === n.bankAccountId)
  const legsForNote = (n: BillingNote): BillableLeg[] => {
    const ids = new Set(n.legIds ?? [])
    const out: BillableLeg[] = []
    for (const d of dispatches) for (const leg of d.legs ?? []) if (leg.id && ids.has(leg.id)) out.push(mk(leg, d))
    return out
  }

  // ค่าบรรทุก (เรท) พร้อมหน่วยตามโหมดราคา
  const legPriceLabel = (l: DispatchLeg) =>
    l.priceMode === 'lump' ? 'เหมา' : l.priceMode === 'per_kg' ? `${db.fmt2(l.price)} ฿/กก.` : `${db.fmt2(l.price)} ฿/ตัน`
  // น้ำหนักหาย(+)/เกิน(−) เป็นกิโลกรัม — null ถ้ายังไม่กรอกน้ำหนักปลายทาง
  const lossKgOf = (l: DispatchLeg): number | null =>
    l.deliveredWeight == null ? null : Math.round(((l.weight || 0) - l.deliveredWeight) * 1000)
  // หาย/เกิน เป็นเครื่องหมาย: หาย(น้ำหนักลด) = −, เกิน = +
  const lossLabel = (kg: number | null) => kg == null ? '—' : kg === 0 ? '0' : kg > 0 ? `−${kg}` : `+${Math.abs(kg)}`

  // ดาวน์โหลดใบวางบิล/ใบเสร็จเป็น Excel (.xlsx) — ตัวเลขเป็นค่าจริง คิดต่อใน Excel ได้
  const exportNoteExcel = (n: BillingNote) => {
    const rows = legsForNote(n)
    const body = rows.map(b => [
      db.thaiDate(legLoadDate(b)),
      db.thaiDate(legUnloadDate(b)),
      `${b.leg.origin} → ${b.leg.destination}`,
      b.leg.weight || 0,
      b.leg.deliveredWeight ?? '',
      lossKgOf(b.leg) ?? '',
      legPriceLabel(b.leg),
      b.gross,
      b.wht,
      b.net,
    ])
    const aoa: (string | number)[][] = [
      ['KPS TRANSPORTATION'],
      [docTypeLabel(n.docType)],
      [`เลขที่ ${n.code}   ประจำเดือน ${n.month}/${n.year}`],
      [`ลูกค้า: ${n.customerName}`],
      [`วันที่ออก: ${db.thaiDate((n.issuedAt || new Date().toISOString()).slice(0, 10))}`],
      [],
      ['วันที่ขึ้น', 'วันที่ลง', 'เส้นทาง', 'น้ำหนักต้น (ตัน)', 'น้ำหนักปลาย (ตัน)', 'หาย/เกิน (กก.)', 'ค่าบรรทุก', 'ยอดเต็ม', 'หัก 1%', 'สุทธิ'],
      ...body,
      ['', '', '', '', '', '', 'รวม', n.gross, n.whtAmount, n.net],
    ]
    const bank = noteBank(n)
    if (bank) {
      aoa.push([])
      aoa.push([`ชำระโดยโอนเข้าบัญชี: ${bank.bankName} ${bank.accountNo} ${bank.accountName}${bank.branch ? ` สาขา ${bank.branch}` : ''}`])
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = [{ wch: 13 }, { wch: 13 }, { wch: 30 }, { wch: 15 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 13 }, { wch: 12 }, { wch: 13 }]
    for (let r = 7; r <= 7 + body.length; r++) {
      for (const c of [3, 4, 7, 8, 9]) {  // น้ำหนัก + เงิน → 2 ตำแหน่ง
        const addr = XLSX.utils.encode_cell({ r, c })
        if (ws[addr] && typeof ws[addr].v === 'number') ws[addr].z = '#,##0.00'
      }
      const lossAddr = XLSX.utils.encode_cell({ r, c: 5 })  // หาย/เกิน → จำนวนเต็ม กก.
      if (ws[lossAddr] && typeof ws[lossAddr].v === 'number') ws[lossAddr].z = '#,##0'
    }
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, docTypeLabel(n.docType))
    XLSX.writeFile(wb, `${n.code}.xlsx`)
  }

  return (
    <div>
      <div className="page-head no-print">
        <div>
          <h1 className="page-title">สรุป / วางบิลรายลูกค้า</h1>
          <div className="page-sub">เลือกขาที่พร้อมวางบิลของลูกค้ามาออกใบวางบิล — รวมขาที่ข้อมูลครบแล้วแม้ยังไม่ปิดรอบ (หัก ณ ที่จ่าย 1% + เลขบัญชีบริษัท)</div>
        </div>
      </div>

      {/* ตัวเลขคุมยอดกันตกหล่น — นับทุกเดือนเสมอ ไม่ขึ้นกับตัวกรองเดือนด้านล่าง */}
      <div className="card pad no-print" style={{ marginBottom: 16, borderColor: (control.pendingCnt > 0 || control.unassignedCnt > 0) ? '#FCD34D' : undefined }}>
        <div className="row" style={{ gap: 20, flexWrap: 'wrap', alignItems: 'center', fontSize: 13.5 }}>
          <strong style={{ fontSize: 13 }}>เที่ยวที่ต้องเก็บเงิน (นับทุกเดือน):</strong>
          <span>
            🧾 พร้อมวางบิล <strong style={{ color: 'var(--primary)' }}>{control.readyCnt}</strong> เที่ยว
            {control.readyCnt > 0 && <span className="mono"> · {db.thb(control.readyAmt)}</span>}
          </span>
          <span style={{ color: control.pendingCnt > 0 ? 'var(--amber)' : undefined }}>
            ⏳ รอข้อมูล (ราคา/น้ำหนัก) <strong>{control.pendingCnt}</strong> เที่ยว
          </span>
          <span style={{ color: control.unassignedCnt > 0 ? 'var(--red)' : undefined }}>
            ❓ ยังไม่มีผู้รับบิล <strong>{control.unassignedCnt}</strong> เที่ยว
          </span>
          {control.readyCnt === 0 && control.pendingCnt === 0 && control.unassignedCnt === 0 && (
            <span style={{ color: 'var(--green)' }}>✅ ไม่มีเที่ยวตกค้าง</span>
          )}
        </div>
        {(control.pendingCnt > 0 || control.unassignedCnt > 0) && (
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            เที่ยว "รอข้อมูล" จะแสดงในรายการของลูกค้าแต่ละราย (ยังกดออกบิลไม่ได้) — เติมราคา/น้ำหนักที่หน้ารอบงาน ·
            เที่ยว "ยังไม่มีผู้รับบิล" เลือกลูกค้าได้ที่การ์ดด้านล่าง
          </div>
        )}
      </div>

      <div className="card pad no-print" style={{ marginBottom: 16 }}>
        <div className="grid-2" style={{ gap: 14 }}>
          <Field label="ลูกค้า *">
            <select value={customerId} onChange={e => { setCustomerId(e.target.value); setSelected(new Set()) }}>
              <option value="">— เลือกลูกค้า —</option>
              {customerLocs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="เดือน / ปี">
            <div className="row" style={{ gap: 8 }}>
              <select value={Number(month.slice(5, 7))} disabled={allMonths} onChange={e => { setMonth(`${month.slice(0, 4)}-${String(Number(e.target.value)).padStart(2, '0')}`); setSelected(new Set()) }} style={{ flex: 1 }}>
                {THAI_MONTHS.map((nm, i) => <option key={i} value={i + 1}>{nm}</option>)}
              </select>
              <select value={Number(month.slice(0, 4))} disabled={allMonths} onChange={e => { setMonth(`${e.target.value}-${month.slice(5, 7)}`); setSelected(new Set()) }} style={{ flex: 1 }}>
                {Array.from({ length: 5 }, (_, i) => 2026 + i).map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </Field>
        </div>
        <label className="row" style={{ gap: 8, cursor: 'pointer', fontSize: 13, alignItems: 'center', marginTop: 10 }}>
          <input type="checkbox" checked={allMonths} onChange={e => { setAllMonths(e.target.checked); setSelected(new Set()) }} style={{ accentColor: 'var(--primary)' }} />
          <span>รวมข้ามเดือนในใบเดียว (แสดงทุกขาที่ยังไม่วางบิลของลูกค้านี้ ทุกเดือน)</span>
        </label>
        {customerLocs.length === 0 && (
          <div className="muted" style={{ fontSize: 12.5, marginTop: 10, color: 'var(--amber)' }}>
            ⚠️ ยังไม่มีสถานที่ที่ตั้งเป็น “ลูกค้า” — ไปที่ งานขนส่ง → จัดการสถานที่ แล้วติ๊ก “เป็นลูกค้า” ให้สถานที่ที่ต้องวางบิล
          </div>
        )}
      </div>

      {/* โต๊ะภาพรวมรายลูกค้า — แสดงเมื่อยังไม่เลือกลูกค้า (กดแถวเพื่อเข้าไปออกบิล) */}
      {!customerId && (
        <div className="card no-print" style={{ marginBottom: 16 }}>
          <div className="head"><h3>ภาพรวมการวางบิล/รับเงิน — ทุกลูกค้า (ทุกเดือน)</h3></div>
          {overview.length === 0 ? (
            <div className="empty" style={{ padding: 32 }}>ยังไม่มีขาที่ต้องวางบิล</div>
          ) : (
            <>
              <div style={{ padding: '8px 16px', fontSize: 12.5 }} className="muted">
                กดแถวลูกค้าเพื่อไปออกใบวางบิล/ดูเอกสารของรายนั้น
              </div>
              <div className="tbl-wrap" style={{ border: 'none' }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>ลูกค้า</th>
                      <th className="num right">เที่ยวต้องเก็บเงิน</th>
                      <th className="num right">ยังไม่วางบิล</th>
                      <th className="num right">รอข้อมูล</th>
                      <th className="num right">รอรับเงิน</th>
                      <th className="num right">รับแล้ว</th>
                      <th className="num right">คงค้าง</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.map(o => (
                      <tr key={o.id} onClick={() => { setCustomerId(o.id); setSelected(new Set()) }} style={{ cursor: 'pointer' }}>
                        <td>
                          {o.name}
                          {o.overdue && <span className="badge red" style={{ fontSize: 10, marginLeft: 6 }}>เกินกำหนด</span>}
                        </td>
                        <td className="num right">{o.total}</td>
                        <td className="num right">{o.unbilled > 0 ? `${o.unbilled} เที่ยว · ${db.thb(o.unbilledAmt)}` : '—'}</td>
                        <td className="num right">{o.pending > 0 ? <span style={{ color: 'var(--amber)', fontWeight: 600 }}>⏳ {o.pending} เที่ยว</span> : '—'}</td>
                        <td className="num right">{o.issued > 0 ? `${o.issued} เที่ยว · ${db.thb(o.issuedAmt)}` : '—'}</td>
                        <td className="num right">
                          {o.paid > 0
                            ? <>{o.paid} เที่ยว · {db.thb(o.paidAmt)}{o.lastPaidAt ? <span className="muted" style={{ fontSize: 11 }}> · รับล่าสุด {db.thaiDate(o.lastPaidAt.slice(0, 10))}</span> : null}</>
                            : '—'}
                        </td>
                        <td className="num right" style={{ fontWeight: 700, color: o.outstanding > 0 ? 'var(--primary)' : undefined }}>{o.outstanding > 0 ? db.thb(o.outstanding) : '—'}</td>
                        <td className="right"><span className="muted" style={{ fontSize: 12 }}>ดู →</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {unassignedLegs.length > 0 && (
        <div className="card no-print" style={{ marginBottom: 16, borderColor: '#FCD34D' }}>
          <div className="head" style={{ background: '#FFFBEB' }}>
            <h3>⚠️ ขาที่ต้องเก็บเงินแต่ยังไม่มีผู้รับบิล — ทุกเดือน ({unassignedLegs.length})</h3>
          </div>
          <div style={{ padding: '8px 16px', fontSize: 12.5 }} className="muted">
            เลือก “เก็บเงินจาก” ให้แต่ละขา — เลือกปลายทาง/ต้นทางของขานั้นได้เลย ระบบจะตั้งเป็นลูกค้าให้อัตโนมัติ (ครั้งหน้าขาที่ไปที่เดียวกันจะเข้าเอง)
          </div>
          <div className="tbl-wrap" style={{ border: 'none' }}>
            <table className="tbl">
              <thead>
                <tr><th>รหัสรอบ</th><th>ทะเบียนรถ</th><th>วันที่ขึ้น</th><th>วันที่ลง</th><th>เส้นทาง</th><th className="num right">ยอด</th><th>เก็บเงินจาก (ตั้งเป็นลูกค้า)</th></tr>
              </thead>
              <tbody>
                {unassignedLegs.map(b => (
                  <tr key={b.leg.id}>
                    <td className="mono">{b.round.code}{draftBadge(b.round)}</td>
                    <td className="mono">{plateOf(b.round)}</td>
                    <td>{db.thaiDate(legLoadDate(b))}</td>
                    <td>{db.thaiDate(legUnloadDate(b))}</td>
                    <td style={{ fontSize: 12.5 }}>
                      {b.leg.origin} → {b.leg.destination}
                      {!legReady(b.leg, b.round.roundStatus === 'closed') && (
                        <span className="badge amber" style={{ fontSize: 10, marginLeft: 6 }} title={pendingReason(b.leg)}>⏳ {pendingReason(b.leg)}</span>
                      )}
                    </td>
                    <td className="num right">{b.gross > 0 ? db.thb(b.gross) : '—'}</td>
                    <td>
                      <select value="" onChange={e => { pickBillTo(b.leg, e.target.value); e.target.value = '' }} disabled={updateLeg.isPending || insertLocation.isPending} style={{ minWidth: 200 }}>
                        <option value="">— เลือกผู้รับบิล —</option>
                        {b.leg.destination && <option value={`name:${b.leg.destination}`}>ปลายทาง: {b.leg.destination}</option>}
                        {b.leg.origin && b.leg.origin !== b.leg.destination && <option value={`name:${b.leg.origin}`}>ต้นทาง: {b.leg.origin}</option>}
                        {customerLocs.length > 0 && (
                          <optgroup label="ลูกค้าที่มีอยู่">
                            {customerLocs.map(c => <option key={c.id} value={`id:${c.id}`}>{c.name}</option>)}
                          </optgroup>
                        )}
                        <option value="nobill">— ไม่ต้องวางบิล (ตัดออก) —</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {noBillLegs.length > 0 && (
        <details className="card no-print" style={{ marginBottom: 16 }}>
          <summary style={{ cursor: 'pointer', padding: '12px 16px', fontSize: 13.5, fontWeight: 600 }}>
            ขาที่ตั้ง “ไม่ต้องวางบิล” เดือนนี้ ({noBillLegs.length}) — กดเพื่อเอากลับมา
          </summary>
          <div className="tbl-wrap" style={{ border: 'none' }}>
            <table className="tbl">
              <thead>
                <tr><th>รหัสรอบ</th><th>ทะเบียนรถ</th><th>วันที่ขึ้น</th><th>วันที่ลง</th><th>เส้นทาง</th><th>เหตุผล</th><th className="num right">ยอด</th><th></th></tr>
              </thead>
              <tbody>
                {noBillLegs.map(b => (
                  <tr key={b.leg.id}>
                    <td className="mono">{b.round.code}{draftBadge(b.round)}</td>
                    <td className="mono">{plateOf(b.round)}</td>
                    <td>{db.thaiDate(legLoadDate(b))}</td>
                    <td>{db.thaiDate(legUnloadDate(b))}</td>
                    <td style={{ fontSize: 12.5 }}>{b.leg.origin} → {b.leg.destination}</td>
                    <td style={{ fontSize: 12 }} className="muted">{b.leg.noBillReason || '—'}</td>
                    <td className="num right">{b.gross > 0 ? db.thb(b.gross) : '—'}</td>
                    <td className="right">
                      <button className="btn ghost sm" onClick={() => restoreNoBill(b.leg.id!)} disabled={updateLeg.isPending}>เอากลับมา</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {customerId && (
        <>
          <div className="card no-print" style={{ marginBottom: 16 }}>
            <div className="head">
              <h3>
                ขาที่พร้อมวางบิล (ปิดงานแล้ว/ข้อมูลครบ) ยังไม่วางบิล ({eligible.length})
                {pendingForCustomer.length > 0 && <span style={{ color: 'var(--amber)', fontWeight: 600, fontSize: 13, marginLeft: 8 }}>· ⏳ รอข้อมูล {pendingForCustomer.length}</span>}
              </h3>
            </div>
            {eligible.length > 0 && (
              <div style={{ padding: '8px 16px', fontSize: 12.5 }} className="muted">
                ✅ ติ๊กเลือกขาที่จะวางบิล แล้วปุ่ม “ออกใบวางบิล / ใบเสร็จ” จะขึ้นด้านล่าง
              </div>
            )}
            {eligible.length + pendingForCustomer.length === 0 ? (
              <div className="empty" style={{ padding: 32 }}>
                ไม่มีขาของลูกค้ารายนี้ที่ต้องเก็บเงินและยังไม่วางบิลในเดือนนี้
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  (ลองติ๊ก “รวมข้ามเดือนในใบเดียว” ด้านบนเพื่อดูทุกเดือน)
                </div>
              </div>
            ) : (
              <div className="tbl-wrap" style={{ border: 'none' }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}><input type="checkbox" checked={selected.size === eligible.length && eligible.length > 0} onChange={toggleAll} style={{ accentColor: 'var(--primary)' }} /></th>
                      <th>รหัสรอบ</th><th>ทะเบียนรถ</th><th>วันที่ขึ้น</th><th>วันที่ลง</th><th>เส้นทาง</th><th>สินค้า</th>
                      <th className="num right">ยอดเต็ม</th><th className="num right">หัก 1%</th><th className="num right">สุทธิ</th>
                      <th>แก้ผู้รับบิล</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eligible.map(b => (
                      <tr key={b.leg.id} onClick={() => toggle(b.leg.id!)} style={{ cursor: 'pointer', background: selected.has(b.leg.id!) ? 'var(--primary-50)' : undefined }}>
                        <td><input type="checkbox" checked={selected.has(b.leg.id!)} onChange={() => toggle(b.leg.id!)} onClick={e => e.stopPropagation()} style={{ accentColor: 'var(--primary)' }} /></td>
                        <td className="mono">{b.round.code}{draftBadge(b.round)}</td>
                        <td className="mono">{plateOf(b.round)}</td>
                        <td>{db.thaiDate(legLoadDate(b))}</td>
                        <td>{db.thaiDate(legUnloadDate(b))}</td>
                        <td style={{ fontSize: 12.5 }}>{b.leg.origin} → {b.leg.destination}</td>
                        <td style={{ fontSize: 12.5 }}>{b.leg.cargoType || '—'}</td>
                        <td className="num right">{db.thb2(b.gross)}</td>
                        <td className="num right" onClick={e => e.stopPropagation()}>
                          {whtMode === 'per_leg' ? (
                            <label className="row" style={{ gap: 5, justifyContent: 'flex-end', cursor: 'pointer', color: b.leg.wht ? 'var(--amber)' : undefined }} title="หัก ณ ที่จ่าย 1% ของขานี้">
                              <input type="checkbox" checked={!!b.leg.wht} onChange={() => toggleLegWht(b.leg)} disabled={updateLeg.isPending} style={{ accentColor: 'var(--amber)' }} />
                              <span>{b.leg.wht ? `− ${db.thb2(b.wht)}` : ''}</span>
                            </label>
                          ) : whtMode === 'total' ? <span className="muted" style={{ fontSize: 11 }}>คิดรวม</span> : '—'}
                        </td>
                        <td className="num right">{db.thb2(whtMode === 'per_leg' ? b.net : b.gross)}</td>
                        <td onClick={e => e.stopPropagation()}>
                          <select value="" onChange={e => { changeBillTo(b.leg, e.target.value); e.target.value = '' }} disabled={updateLeg.isPending} style={{ minWidth: 110, fontSize: 12 }}>
                            <option value="">เปลี่ยน…</option>
                            <optgroup label="ย้ายไปลูกค้า">
                              {customerLocs.filter(c => c.id !== customerId).map(c => <option key={c.id} value={`id:${c.id}`}>{c.name}</option>)}
                            </optgroup>
                            <option value="auto">คืนค่าอัตโนมัติ (ตามปลายทาง)</option>
                            <option value="nobill">ไม่ต้องวางบิล</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                    {/* ขาที่ต้องเก็บเงินแต่ข้อมูลยังไม่ครบ — โชว์ให้เห็นว่าค้างอยู่ ยังติ๊กออกบิลไม่ได้ */}
                    {pendingForCustomer.map(b => (
                      <tr key={b.leg.id} style={{ opacity: 0.75, background: '#FFFBEB' }}>
                        <td><input type="checkbox" disabled title={pendingReason(b.leg)} /></td>
                        <td className="mono">{b.round.code}{draftBadge(b.round)}</td>
                        <td className="mono">{plateOf(b.round)}</td>
                        <td>{db.thaiDate(legLoadDate(b))}</td>
                        <td>{db.thaiDate(legUnloadDate(b))}</td>
                        <td style={{ fontSize: 12.5 }}>
                          {b.leg.origin} → {b.leg.destination}
                          <span className="badge amber" style={{ fontSize: 10, marginLeft: 6 }}>⏳ {pendingReason(b.leg)}</span>
                        </td>
                        <td style={{ fontSize: 12.5 }}>{b.leg.cargoType || '—'}</td>
                        <td className="num right">{b.gross > 0 ? db.thb2(b.gross) : '—'}</td>
                        <td className="num right">—</td>
                        <td className="num right">—</td>
                        <td>
                          <select value="" onChange={e => { changeBillTo(b.leg, e.target.value); e.target.value = '' }} disabled={updateLeg.isPending} style={{ minWidth: 110, fontSize: 12 }}>
                            <option value="">เปลี่ยน…</option>
                            <optgroup label="ย้ายไปลูกค้า">
                              {customerLocs.filter(c => c.id !== customerId).map(c => <option key={c.id} value={`id:${c.id}`}>{c.name}</option>)}
                            </optgroup>
                            <option value="auto">คืนค่าอัตโนมัติ (ตามปลายทาง)</option>
                            <option value="nobill">ไม่ต้องวางบิล</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {selectedLegs.length > 0 && (
            <div className="card pad no-print" style={{ marginBottom: 16 }}>
              <div className="grid-2" style={{ gap: 18, alignItems: 'end' }}>
                <div>
                  <Field label="การหัก ณ ที่จ่าย 1%">
                    <select value={whtMode} onChange={e => setWhtMode(e.target.value as typeof whtMode)}>
                      <option value="per_leg">หักรายเที่ยว (ติ๊กทีละขาในตาราง)</option>
                      <option value="total">หักจากยอดรวมทั้งใบ 1%</option>
                      <option value="none">ไม่หัก</option>
                    </select>
                  </Field>
                  <div className="row" style={{ fontSize: 14, marginTop: 10 }}><span>ยอดรวม ({selectedLegs.length} ขา)</span><div className="spacer" /><span className="mono">{db.thb2(gross)}</span></div>
                  {whtAmount > 0 && <div className="row" style={{ fontSize: 14, color: 'var(--amber)' }}><span>หัก ณ ที่จ่าย 1% {whtMode === 'total' ? '(จากยอดรวม)' : '(รายเที่ยว)'}</span><div className="spacer" /><span className="mono">− {db.thb2(whtAmount)}</span></div>}
                  <div className="row" style={{ fontSize: 16, fontWeight: 700, borderTop: '1px solid var(--line)', paddingTop: 6, marginTop: 6 }}><span>ยอดสุทธิ</span><div className="spacer" /><span className="mono" style={{ color: 'var(--primary)' }}>{db.thb2(net)}</span></div>
                </div>
                <div>
                  <Field label="บัญชีรับเงิน (พิมพ์บนใบวางบิล)">
                    <select value={bankAccountId} onChange={e => setBankAccountId(e.target.value)}>
                      <option value="">— ไม่ระบุ —</option>
                      {bankAccounts.filter(b => b.active).map(b => <option key={b.id} value={b.id}>{b.bankName} {b.accountNo} ({b.accountName})</option>)}
                    </select>
                  </Field>
                  <div className="row btn-row" style={{ justifyContent: 'flex-end', marginTop: 12, gap: 8 }}>
                    <button className="btn" onClick={() => issue('receipt')} disabled={insertNote.isPending}><Icon name="check" size={14} /> ออกใบเสร็จ (รับเงินแล้ว)</button>
                    <button className="btn primary" onClick={() => issue('billing_note')} disabled={insertNote.isPending}><Icon name="download" size={14} /> ออกใบวางบิล</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {customerNotes.length > 0 && (
            <div className="card no-print">
              <div className="head">
                <h3>เอกสารที่ออกแล้วในเดือนนี้ ({customerNotes.length})</h3>
                <div className="right row" style={{ gap: 12, alignItems: 'center', fontSize: 12.5 }}>
                  <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                    <span className="muted">แนวกระดาษ:</span>
                    <select value={printOrient} onChange={e => setPrintOrient(e.target.value as typeof printOrient)} style={{ fontSize: 12.5 }}>
                      <option value="landscape">แนวนอน</option>
                      <option value="portrait">แนวตั้ง</option>
                    </select>
                  </div>
                  <div className="row" style={{ gap: 4, alignItems: 'center' }}>
                    <span className="muted">ตัวอักษร:</span>
                    <button className="btn ghost icon sm" title="เล็กลง" onClick={() => setPrintFont(f => Math.max(7, f - 1))}>−</button>
                    <span className="mono" style={{ minWidth: 34, textAlign: 'center' }}>{printFont}pt</span>
                    <button className="btn ghost icon sm" title="ใหญ่ขึ้น" onClick={() => setPrintFont(f => Math.min(16, f + 1))}>+</button>
                  </div>
                </div>
              </div>
              <div className="tbl-wrap" style={{ border: 'none' }}>
                <table className="tbl">
                  <thead><tr><th>เลขที่</th><th>ประเภท</th><th className="num right">ยอดสุทธิ</th><th>สถานะ</th><th>วันที่รับเงิน</th><th></th></tr></thead>
                  <tbody>
                    {customerNotes.map(n => (
                      <tr key={n.id} style={{ opacity: n.status === 'void' ? 0.5 : 1 }}>
                        <td className="mono">{n.code}</td>
                        <td>{docTypeLabel(n.docType)}</td>
                        <td className="num right">{db.thb2(n.net)}</td>
                        <td><span className={`badge ${n.status === 'paid' ? 'green' : n.status === 'void' ? 'red' : 'amber'}`} style={{ fontSize: 11 }}>{n.status === 'paid' ? 'รับเงินแล้ว' : n.status === 'void' ? 'ยกเลิก' : 'รอชำระ'}</span></td>
                        <td>{n.status === 'paid' && n.paidAt ? db.thaiDate(n.paidAt.slice(0, 10)) : '—'}</td>
                        <td>
                          <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                            <button className="btn ghost sm" onClick={() => setPrintNote(n)}><Icon name="download" size={13} /> พิมพ์</button>
                            <button className="btn ghost sm" onClick={() => exportNoteExcel(n)} style={{ color: 'var(--green)' }}><Icon name="download" size={13} /> Excel</button>
                            {n.status === 'issued' && <button className="btn ghost sm" onClick={() => openMarkPaid(n)} style={{ color: 'var(--green)' }}>รับเงินแล้ว</button>}
                            {n.status !== 'void' && <button className="btn ghost sm" onClick={() => voidNote(n)} style={{ color: 'var(--red)' }}>ยกเลิก</button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* มินิ-โมดัลเลือกวันที่รับโอนจริง ก่อนบันทึกรับเงิน */}
      {payNote && (
        <div onClick={() => setPayNote(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} className="card pad" style={{ background: 'var(--card)', width: '90%', maxWidth: 380 }}>
            <h3 style={{ marginTop: 0, marginBottom: 4 }}>บันทึกรับเงิน</h3>
            <div className="muted" style={{ fontSize: 12.5, marginBottom: 14 }}>
              {docTypeLabel(payNote.docType)} {payNote.code} · สุทธิ {db.thb2(payNote.net)}
            </div>
            <Field label="วันที่รับโอนจริง *">
              <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
            </Field>
            <div className="row btn-row" style={{ justifyContent: 'flex-end', marginTop: 16, gap: 8 }}>
              <button className="btn" onClick={() => setPayNote(null)}>ยกเลิก</button>
              <button className="btn primary" onClick={confirmMarkPaid} disabled={!payDate || updateNote.isPending}><Icon name="check" size={14} /> บันทึกรับเงิน</button>
            </div>
          </div>
        </div>
      )}

      {/* เอกสารสำหรับพิมพ์ */}
      {printNote && (
        <div className="print-only" style={{ fontSize: `${printFont}pt` }}>
          <style>{`
            @page { size: A4 ${printOrient}; margin: 8mm; }
            .print-only .tbl { font-size: ${printFont}pt; }
            .print-only .tbl th, .print-only .tbl td { padding: 2px 6px; line-height: 1.2; }
          `}</style>
          <div className="kps-print-header">
            <p className="co">KPS TRANSPORTATION</p>
            <p className="ttl">{docTypeLabel(printNote.docType)}</p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9pt', marginBottom: 8 }}>
            <div><strong>ลูกค้า:</strong> {printNote.customerName}</div>
            <div><strong>วันที่ออก:</strong> {db.thaiDate((printNote.issuedAt || new Date().toISOString()).slice(0, 10))}</div>
          </div>
          <table className="tbl" style={{ width: '100%' }}>
            <thead><tr>
              <th>วันที่ขึ้น</th><th>วันที่ลง</th><th>เส้นทาง</th>
              <th className="num right">น้ำหนักต้น (กก.)</th>
              <th className="num right">น้ำหนักปลาย (กก.)</th>
              <th className="num right" style={{ width: 38 }}>± กก.</th>
              <th className="num right" style={{ width: 64 }}>ค่าบรรทุก</th>
              <th className="num right">ยอดเต็ม</th>
              <th className="num right">หัก 1%</th>
              <th className="num right">สุทธิ</th>
            </tr></thead>
            <tbody>
              {legsForNote(printNote).map(b => (
                <tr key={b.leg.id}>
                  <td>{db.thaiDate(legLoadDate(b))}</td>
                  <td>{db.thaiDate(legUnloadDate(b))}</td>
                  <td>{b.leg.origin} → {b.leg.destination}</td>
                  <td className="num right">{db.fmt((b.leg.weight || 0) * 1000)}</td>
                  <td className="num right">{b.leg.deliveredWeight != null ? db.fmt(b.leg.deliveredWeight * 1000) : '—'}</td>
                  <td className="num right" style={{ width: 38 }}>{lossLabel(lossKgOf(b.leg))}</td>
                  <td className="num right" style={{ width: 64 }}>{b.leg.priceMode === 'lump' ? 'เหมา' : db.fmt2(b.leg.price)}</td>
                  <td className="num right">{db.fmt2(b.gross)}</td>
                  <td className="num right">{b.wht > 0 ? `− ${db.fmt2(b.wht)}` : '—'}</td>
                  <td className="num right">{db.fmt2(b.net)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={7} className="right"><strong>รวม</strong></td><td className="num right">{db.fmt2(printNote.gross)}</td><td className="num right">− {db.fmt2(printNote.whtAmount)}</td><td className="num right"><strong>{db.fmt2(printNote.net)}</strong></td></tr>
            </tfoot>
          </table>
          {noteBank(printNote) && (
            <div style={{ marginTop: 12, fontSize: '9pt', border: '1px solid #ccc', padding: 8, borderRadius: 4 }}>
              <strong>ชำระเงินโดยโอนเข้าบัญชี:</strong> {noteBank(printNote)!.bankName} เลขที่ {noteBank(printNote)!.accountNo}
              {' '}ชื่อบัญชี {noteBank(printNote)!.accountName}{noteBank(printNote)!.branch ? ` สาขา ${noteBank(printNote)!.branch}` : ''}
            </div>
          )}
          <div className="kps-print-sig">
            <div className="kps-print-sig-slot"><div className="line">ผู้วางบิล</div></div>
            <div className="kps-print-sig-slot"><div className="line">ผู้รับวางบิล</div></div>
          </div>
        </div>
      )}
    </div>
  )
}
