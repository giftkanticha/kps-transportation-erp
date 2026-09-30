import type { KeyboardEvent } from 'react'

const FIELD_SELECTOR = 'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([disabled]):not([readonly]), select:not([disabled])'

/**
 * กด Enter ในช่องกรอก → ย้ายโฟกัสไปช่องถัดไปในฟอร์ม (ไม่ต้องสลับไปใช้เมาส์).
 * ผูกที่ container ของฟอร์ม (onKeyDown) — textarea/ปุ่ม/Shift+Enter ปล่อยตามปกติ.
 * ถ้าไม่มีช่องถัดไปแล้ว จะโฟกัสปุ่มที่มี data-enter-final (เช่น ปุ่มบันทึก) ให้กด Enter ซ้ำเพื่อยืนยัน.
 */
export function enterToNext(e: KeyboardEvent<HTMLElement>) {
  if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
  const target = e.target as HTMLElement
  if (!target.matches?.(FIELD_SELECTOR)) return
  e.preventDefault()
  const fields = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(FIELD_SELECTOR))
    .filter(el => el.tabIndex !== -1 && el.offsetParent !== null)
  const idx = fields.indexOf(target)
  const next = idx >= 0 ? fields[idx + 1] : undefined
  if (next) {
    next.focus()
    if (next instanceof HTMLInputElement && next.type !== 'date' && next.type !== 'number') next.select?.()
  } else {
    document.querySelector<HTMLElement>('[data-enter-final]')?.focus()
  }
}
