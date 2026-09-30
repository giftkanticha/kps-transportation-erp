import { useEffect, useMemo, useRef, useState } from 'react'
import { useList, useInsert } from '../../hooks/useTable'
import type { Location, DispatchLeg } from '../../types'
import { Icon } from './Icon'

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  /** ถ้าระบุ — datalist จะแสดงเฉพาะสถานที่ในทะเบียนที่หมวดตรงกัน (เช่น กรองเฉพาะคลังปุ๋ย
   * ตอนเลือกต้นทางขากลับ) ชื่อที่พิมพ์เองยังพิมพ์ได้ตามปกติ ไม่ถูกบล็อก */
  categoryFilter?: string
  /** หมวดที่จะตั้งให้อัตโนมัติเมื่อกด "+ เพิ่มสถานที่นี้เข้าทะเบียน" สำหรับชื่อที่พิมพ์ใหม่ */
  defaultCategory?: string
  /** เรียงตัวเลือกตามสถิติการใช้ในขา (ใช้บ่อยขึ้นก่อน): นับจากช่องต้นทางหรือปลายทาง */
  usageField?: 'origin' | 'destination'
}

/**
 * ช่องกรอกสถานที่แบบ combobox — เลือกจากรายการที่มีอยู่ (master `locations`) หรือ
 * พิมพ์ชื่อใหม่ก็ได้. เก็บค่าเป็น "ชื่อ" (string) เหมือน input เดิมทุกประการ จึง
 * drop-in แทน <input> ได้ทันที ไม่กระทบ data เก่า.
 *
 * ถ้าพิมพ์ชื่อที่ยังไม่อยู่ใน master จะมีปุ่ม "+ เพิ่มสถานที่นี้" ให้บันทึกเข้า
 * master ทันที (กันการพิมพ์ซ้ำซ้อนคนละแบบในครั้งต่อๆ ไป).
 */
export function LocationCombobox({ value, onChange, placeholder, categoryFilter, defaultCategory, usageField }: Props) {
  const [open, setOpen] = useState(false)
  // true = ผู้ใช้กำลังพิมพ์ค้นหา (กรองรายการ); false = เปิดด้วยลูกศร/โฟกัส (แสดงทั้งหมด)
  const [filtering, setFiltering] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const { data: locations = [] } = useList<Location>('locations')
  const { data: legs = [] } = useList<DispatchLeg>('dispatch_legs', 'sort_order', true)
  const insertLocation = useInsert<Location>('locations')

  const allActive = useMemo(() => locations.filter(l => l.active), [locations])
  // ตัวเลือกใน datalist กรองตามหมวด (ถ้าระบุ) — แต่เช็ค "มีอยู่แล้วในทะเบียนไหม" ต้องดู
  // ทุกหมวด ไม่งั้นชื่อที่ลงทะเบียนไว้คนละหมวดจะโดนเสนอปุ่ม "เพิ่ม" ซ้ำจนกลายเป็นชื่อซ้ำ
  // สถิติจำนวนครั้งที่สถานที่ถูกใช้ในขา (ตามช่องที่ระบุ) — ใช้บ่อยขึ้นก่อน เท่ากันเรียง ก-ฮ
  const usage = useMemo(() => {
    const m = new Map<string, number>()
    if (!usageField) return m
    for (const leg of legs) {
      const k = (leg[usageField] ?? '').trim().toLowerCase()
      if (k) m.set(k, (m.get(k) ?? 0) + 1)
    }
    return m
  }, [legs, usageField])
  const active = useMemo(
    () => allActive
      .filter(l => !categoryFilter || l.category === categoryFilter)
      .sort((a, b) =>
        (usage.get(b.name.trim().toLowerCase()) ?? 0) - (usage.get(a.name.trim().toLowerCase()) ?? 0)
        || a.name.localeCompare(b.name, 'th')),
    [allActive, categoryFilter, usage],
  )

  const trimmed = value.trim()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const options = useMemo(
    () => (filtering && trimmed
      ? active.filter(l => l.name.toLowerCase().includes(trimmed.toLowerCase()))
      : active),
    [active, filtering, trimmed],
  )
  // มีอยู่แล้วใน master หรือยัง (เทียบแบบไม่สนตัวพิมพ์/ช่องว่างหัวท้าย)
  const existsInMaster = useMemo(
    () => trimmed !== '' && allActive.some(l => l.name.trim().toLowerCase() === trimmed.toLowerCase()),
    [allActive, trimmed],
  )

  const addToMaster = () => {
    if (!trimmed || existsInMaster || insertLocation.isPending) return
    insertLocation.mutate(
      { name: trimmed, category: defaultCategory ?? '', province: '', address: '', notes: '', active: true },
      { onError: err => alert(err instanceof Error ? err.message : 'เพิ่มสถานที่ไม่สำเร็จ') },
    )
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          value={value}
          onChange={e => { onChange(e.target.value); setFiltering(true); setOpen(true) }}
          onFocus={() => { setFiltering(false); setOpen(true) }}
          onKeyDown={e => { if (e.key === 'Escape') setOpen(false) }}
          placeholder={placeholder}
          autoComplete="off"
          style={{ paddingRight: 32 }}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label="แสดงรายการสถานที่"
          onMouseDown={e => e.preventDefault()}
          onClick={() => { setFiltering(false); setOpen(o => !o) }}
          style={{
            position: 'absolute', right: 0, top: 0, bottom: 0, width: 32,
            border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted, #666)',
          }}
        >▾</button>
      </div>
      {open && options.length > 0 && (
        <ul
          role="listbox"
          style={{
            position: 'absolute', zIndex: 50, left: 0, right: 0, top: '100%', margin: '4px 0 0', padding: 4,
            listStyle: 'none', maxHeight: 220, overflowY: 'auto', background: 'var(--card, #fff)',
            border: '1px solid var(--line, #ddd)', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,.15)',
          }}
        >
          {options.map(l => (
            <li
              key={l.id}
              role="option"
              aria-selected={l.name === value}
              onMouseDown={e => { e.preventDefault(); onChange(l.name); setOpen(false) }}
              style={{ padding: '7px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--line, #eee)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              {l.name}
            </li>
          ))}
        </ul>
      )}
      {trimmed !== '' && !existsInMaster && (
        <button
          type="button"
          className="btn ghost sm"
          onClick={addToMaster}
          disabled={insertLocation.isPending}
          style={{ marginTop: 6, fontSize: 12, color: 'var(--primary)' }}
          title="บันทึกสถานที่นี้เข้าทะเบียน เพื่อเลือกซ้ำได้ครั้งหน้า"
        >
          <Icon name="plus" size={13} /> เพิ่ม “{trimmed}” เข้าทะเบียนสถานที่
        </button>
      )}
    </div>
  )
}
