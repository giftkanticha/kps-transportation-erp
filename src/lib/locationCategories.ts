// ชุดหมวดสถานที่มาตรฐาน — ใช้ทั้งหน้าทะเบียนสถานที่ (select) และตอนกรอกขา (กรอง
// dropdown เช่น ขากลับที่มีสินค้ามักมาจากคลังปุ๋ยเสมอ) ให้ชื่อหมวดตรงกันทุกจุด
export const LOCATION_CATEGORIES = ['คลังปุ๋ย', 'โกดังลูกค้า', 'ร้านย่อย', 'ลูกค้า'] as const

export type LocationCategory = (typeof LOCATION_CATEGORIES)[number]

// ขากลับที่มีสินค้า (legType: 'backhaul') ที่ KPS ส่วนใหญ่คือรับปุ๋ยจากคลังยี่ห้อต่างๆ
// มาส่ง — ใช้ค่านี้กรอง/ตั้งค่าเริ่มต้นให้ตอนกรอกขาประเภทนี้
export const FERTILIZER_DEPOT_CATEGORY: LocationCategory = 'คลังปุ๋ย'
export const RETAIL_SHOP_CATEGORY: LocationCategory = 'ร้านย่อย'
