import { useId, useMemo } from 'react'
import { useList, useInsert } from '../../hooks/useTable'
import type { Location } from '../../types'
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
}

/**
 * ช่องกรอกสถานที่แบบ combobox — เลือกจากรายการที่มีอยู่ (master `locations`) หรือ
 * พิมพ์ชื่อใหม่ก็ได้. เก็บค่าเป็น "ชื่อ" (string) เหมือน input เดิมทุกประการ จึง
 * drop-in แทน <input> ได้ทันที ไม่กระทบ data เก่า.
 *
 * ถ้าพิมพ์ชื่อที่ยังไม่อยู่ใน master จะมีปุ่ม "+ เพิ่มสถานที่นี้" ให้บันทึกเข้า
 * master ทันที (กันการพิมพ์ซ้ำซ้อนคนละแบบในครั้งต่อๆ ไป).
 */
export function LocationCombobox({ value, onChange, placeholder, categoryFilter, defaultCategory }: Props) {
  const listId = useId()
  const { data: locations = [] } = useList<Location>('locations')
  const insertLocation = useInsert<Location>('locations')

  const allActive = useMemo(() => locations.filter(l => l.active), [locations])
  // ตัวเลือกใน datalist กรองตามหมวด (ถ้าระบุ) — แต่เช็ค "มีอยู่แล้วในทะเบียนไหม" ต้องดู
  // ทุกหมวด ไม่งั้นชื่อที่ลงทะเบียนไว้คนละหมวดจะโดนเสนอปุ่ม "เพิ่ม" ซ้ำจนกลายเป็นชื่อซ้ำ
  const active = useMemo(
    () => allActive
      .filter(l => !categoryFilter || l.category === categoryFilter)
      .sort((a, b) => a.name.localeCompare(b.name, 'th')),
    [allActive, categoryFilter],
  )

  const trimmed = value.trim()
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
    <div>
      <input
        list={listId}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <datalist id={listId}>
        {active.map(l => (
          <option key={l.id} value={l.name} />
        ))}
      </datalist>
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
