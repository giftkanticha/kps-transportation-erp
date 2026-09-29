import type { Location } from '../types'

// ลิงก์ Google Maps ที่ผู้ใช้วางไว้ในทะเบียนสถานที่ (Location.mapsUrl) มักมีพิกัดฝังอยู่ในตัว
// URL เอง (ลิงก์เต็มจากเดสก์ท็อป/แอป) — ดึงออกมาใช้แทนการค้นด้วยชื่อ/ที่อยู่ จะแม่นกว่ามาก
// ลิงก์แบบย่อ (maps.app.goo.gl/...) ไม่มีพิกัดฝังอยู่ ดึงไม่ได้ก็ไม่เป็นไร แค่ fallback ไปค้นด้วยชื่อแทน
const LATLNG_PATTERNS = [
  /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,          // .../@19.123,99.456,15z
  /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/,       // .../data=...!3d19.123!4d99.456...
  /[?&]q=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,      // ?q=19.123,99.456
  /[?&]ll=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,     // ?ll=19.123,99.456
]

export function extractLatLng(mapsUrl: string | null | undefined): string | null {
  const url = (mapsUrl ?? '').trim()
  if (!url) return null
  for (const re of LATLNG_PATTERNS) {
    const m = url.match(re)
    if (m) return `${m[1]},${m[2]}`
  }
  return null
}

// คำค้นที่ดีที่สุดเท่าที่มีสำหรับสถานที่นี้ — พิกัดจากลิงก์ที่วางไว้ (แม่นสุด) ไม่งั้นใช้
// ชื่อ+ที่อยู่+จังหวัดที่มีอยู่แล้ว (พอใช้ได้ แต่ขึ้นกับ Google เดาจากข้อความ)
export function mapsQueryFor(l?: Location | null): string {
  if (!l) return ''
  const latLng = extractLatLng(l.mapsUrl)
  if (latLng) return latLng
  return [l.name, l.address, l.province].filter(Boolean).join(', ')
}

export function mapsDirectionsUrl(origin?: Location | null, destination?: Location | null): string | null {
  const o = mapsQueryFor(origin)
  const d = mapsQueryFor(destination)
  if (!o || !d) return null
  const params = new URLSearchParams({ api: '1', origin: o, destination: d, travelmode: 'driving' })
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

// ลิงก์ดูสถานที่เดียว (ไม่ใช่เส้นทาง) — ใช้ลิงก์ที่วางไว้ตรงๆ ถ้ามี ไม่งั้น fallback เป็นลิงก์ค้นหา
export function mapsPlaceUrl(l?: Location | null): string | null {
  if (!l) return null
  const trimmed = (l.mapsUrl ?? '').trim()
  if (trimmed) return trimmed
  const q = mapsQueryFor(l)
  if (!q) return null
  return `https://www.google.com/maps/search/?${new URLSearchParams({ api: '1', query: q }).toString()}`
}
