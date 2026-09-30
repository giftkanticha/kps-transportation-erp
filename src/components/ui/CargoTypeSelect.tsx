import { useMemo } from 'react'
import { useList, useInsert } from '../../hooks/useTable'
import type { CargoType } from '../../types'

interface Props {
  value: string
  onChange: (v: string) => void
}

const ADD_NEW = '__add_new__'

/**
 * dropdown ประเภทสินค้า — เลือกจากทะเบียน `cargo_types` และเพิ่มประเภทใหม่ได้
 * ทันทีจากตัวเลือกสุดท้าย. เก็บค่าเป็น "ชื่อ" (string) เหมือน input เดิม.
 * ถ้าขาเก่ามีค่าที่ไม่อยู่ในทะเบียน จะแสดงเป็นตัวเลือกเพิ่มให้ ไม่ทำให้ค่าหาย.
 */
export function CargoTypeSelect({ value, onChange }: Props) {
  const { data: types = [] } = useList<CargoType>('cargo_types', 'created_at', true)
  const insert = useInsert<CargoType>('cargo_types')

  const names = useMemo(() => types.filter(t => t.active).map(t => t.name), [types])
  const legacy = value && !names.includes(value) ? value : null

  const handle = (v: string) => {
    if (v !== ADD_NEW) return onChange(v)
    const name = (window.prompt('ชื่อประเภทสินค้าใหม่') ?? '').trim()
    if (!name) return
    if (names.some(n => n.toLowerCase() === name.toLowerCase())) {
      return onChange(names.find(n => n.toLowerCase() === name.toLowerCase())!)
    }
    insert.mutate(
      { name, active: true },
      {
        onSuccess: () => onChange(name),
        onError: err => alert(err instanceof Error ? err.message : 'เพิ่มประเภทสินค้าไม่สำเร็จ'),
      },
    )
  }

  return (
    <select value={value} onChange={e => handle(e.target.value)} disabled={insert.isPending}>
      <option value="">— เลือกประเภทสินค้า —</option>
      {legacy && <option value={legacy}>{legacy}</option>}
      {names.map(n => <option key={n} value={n}>{n}</option>)}
      <option value={ADD_NEW}>+ เพิ่มประเภทใหม่…</option>
    </select>
  )
}
