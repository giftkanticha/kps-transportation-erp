# Figma Design Prompt
## KPS Transportation ERP - Fuel Round Management System

---

## 📋 OVERVIEW

**Feature:** Fuel Round Management System  
**Purpose:** Track fuel consumption accurately with intermediate refills support  
**Pages:** 4 main flows  
**Key Concept:** 1 Fuel Round = 1 Complete Cycle (Start Full → Drive → Intermediate Refills → End Full)

---

## 🎨 COLOR & TYPOGRAPHY (Refer to Main Design System)

```
Primary: #0066CC (Blue)
Success: #10B981 (Green)
Warning: #F59E0B (Yellow)
Danger: #EF4444 (Red)
Neutral: #6B7280 (Gray)

Font: Sarabun, Noto Sans Thai
Sizes: H1 32px, H2 24px, H3 20px, Body 14px, Small 12px
```

---

## 📱 PAGE 1: OPEN FUEL ROUND (/fuel/open-round)

### **Layout Structure:**

**Header:**
```
┌──────────────────────────────────────────────────┐
│ ⬅️ Back  │  เปิดรอบน้ำมัน  │  [❌ Close Button] │
└──────────────────────────────────────────────────┘
```

**Main Content (2 columns on desktop, 1 on mobile):**

#### **Left Column (60%):**

```
┌──────────────────────────────────────────────────┐
│ 📋 ข้อมูลรอบน้ำมัน (FUEL ROUND DETAILS)          │
├──────────────────────────────────────────────────┤
│                                                  │
│ 1️⃣  เลือกรถ *                                   │
│     ┌────────────────────────────────────────┐  │
│     │ [🚗 ABC-1234] (Isuzu FVR 10ล้อ)    ▼ │  │
│     └────────────────────────────────────────┘  │
│     Format: [ทะเบียน] ([ยี่ห้อ] [ประเภท])      │
│     Type: Autocomplete Dropdown                  │
│     Help text: "เลือกรถสำหรับเปิดรอบ"           │
│                                                  │
│ 2️⃣  ที่อยู่เติมเริ่มต้น *                       │
│     ┌────────────────────────────────────────┐  │
│     │ [โรงงาน KPS] ────────────────────────▼ │  │
│     └────────────────────────────────────────┘  │
│     Type: Dropdown (pre-defined: โรงงาน เท่านั้น)
│     Read-only: Yes (auto-set)                   │
│                                                  │
│ 3️⃣  เลขไมล์ตอนเติมเริ่มต้น *                   │
│     ┌────────────────────────────────────────┐  │
│     │ 245000 km                             │  │
│     └────────────────────────────────────────┘  │
│     Type: Number Input                          │
│     Suffix: "km"                                │
│     Format: comma separator (245,000)           │
│     Validation: ≥ 0, numeric only               │
│     Help: "อ่านจากเลขไมล์รถ"                   │
│                                                  │
│ 4️⃣  ปริมาณเติมเต็มถัง *                        │
│     ┌────────────────────────────────────────┐  │
│     │ 500 L                                 │  │
│     └────────────────────────────────────────┘  │
│     Type: Number Input                          │
│     Suffix: "L"                                 │
│     Default: 500 (configurable per vehicle)     │
│     Validation: ≥ 0, ≤ tank capacity           │
│     Help: "ความจุถังรถคันนี้"                  │
│                                                  │
│ 5️⃣  ราคา/ลิตร *                                │
│     ┌────────────────────────────────────────┐  │
│     │ 35 บาท/L                             │  │
│     └────────────────────────────────────────┘  │
│     Type: Number Input (Decimal)                │
│     Prefix: "฿"  Suffix: "/L"                   │
│     Default: 35 (configurable)                  │
│     Validation: > 0                             │
│     Help: "ราคาเฉลี่ยน้ำมันเชื้อเพลิง"         │
│                                                  │
│ 6️⃣  เวลาเติมเริ่มต้น *                         │
│     ┌────────────────────────────────────────┐  │
│     │ 2025-05-15  │  08:00                  │  │
│     └────────────────────────────────────────┘  │
│     Type: Date + Time Picker                    │
│     Format: DD/MM/YYYY (BE) + HH:MM             │
│     Default: Today + current time               │
│     Display: "15 เม.ย. 2568 เวลา 08:00"         │
│                                                  │
│ 7️⃣  ต้นทุนเริ่มต้น                             │
│     ┌────────────────────────────────────────┐  │
│     │ ฿ 17,500                  (Read-only) │  │
│     └────────────────────────────────────────┘  │
│     Type: Display / Read-only                   │
│     Calculation: 500 × 35 = 17,500 บาท         │
│     Note: ⚠️ "ไม่คิดในรอบนี้ (คิดรอบก่อน)"    │
│     Color: Gray text                            │
│                                                  │
└──────────────────────────────────────────────────┘
```

#### **Right Column (40%):**

**Info Card 1: Vehicle Status**
```
┌──────────────────────────────────────────────────┐
│ 🚗 สถานะรถ ABC-1234                             │
├──────────────────────────────────────────────────┤
│                                                  │
│ ปัจจุบัน:                                      │
│  • สถานะ: 🟢 พร้อมใช้งาน                        │
│  • เลขไมล์: 245,000 km                          │
│  • รอบล่าสุด: RUND-20250514-002                 │
│  • สถานะรอบล่าสุด: ✓ CLOSED                    │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Info Card 2: Round Summary (Preview)**
```
┌──────────────────────────────────────────────────┐
│ 📊 สรุปรอบนี้ (Preview)                         │
├──────────────────────────────────────────────────┤
│                                                  │
│ Round ID: (Will be auto-generated)              │
│ Vehicle: ABC-1234                               │
│ Start Fuel: 500 L                               │
│ Tank Capacity: 500 L                            │
│                                                  │
│ ✓ พร้อมเปิดรอบได้                              │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Bottom Buttons (Sticky):**
```
┌──────────────────────────────────────────────────┐
│  [✅ เปิดรอบน้ำมัน]  [❌ ยกเลิก]                  │
└──────────────────────────────────────────────────┘

Button 1: "✅ เปิดรอบน้ำมัน" (Primary Blue)
  - Width: 45%
  - Action: Submit → Create fuel_round record
  - After click: Toast success + Redirect to journey page

Button 2: "❌ ยกเลิก" (Secondary Gray)
  - Width: 45%
  - Action: Go back to /fuel or /dashboard
```

---

## 📱 PAGE 2: ADD JOURNEY LEGS (/dispatch/open-journey?round_id=RUND-xxx)

### **Same as Main System but with Fuel Round Badge**

**Header Enhancement:**
```
┌──────────────────────────────────────────────────┐
│ ⬅️  │  เปิดงานขนส่ง  │  🔖 Round: RUND-xxx  [❌] │
└──────────────────────────────────────────────────┘
          (Show active round badge)
```

**Info Bar (Below Header):**
```
┌──────────────────────────────────────────────────┐
│ ℹ️  เปิดรอบน้ำมัน: RUND-20250515-001             │
│     รถ: ABC-1234 | เวลาเปิด: 08:00               │
│     เลขไมล์: 245,000 km | น้ำมัน: 500 L         │
│     [✓ เปิด] [ปิดรอบ ↗️]                        │
└──────────────────────────────────────────────────┘
```

**Form Fields (Same as original dispatch, but linked to round):**
- All LEG fields remain the same
- Hidden field: `round_id: RUND-20250515-001`
- After adding leg: Show leg added + option to add more

**Batch Actions (New):**
```
┌──────────────────────────────────────────────────┐
│ 📋 Legs in this Round                           │
├──────────────────────────────────────────────────┤
│                                                  │
│ ✓ LEG-001: BKK → Rayong (150 km) [✏️] [🗑️]      │
│ ✓ LEG-002: Rayong → CCH (80 km) [✏️] [🗑️]       │
│                                                  │
│ [➕ เพิ่ม Leg ใหม่]                             │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## ⛽ PAGE 3: ADD INTERMEDIATE FUEL REFILL (/fuel/refill-intermediate?round_id=RUND-xxx)

### **Layout Structure:**

**Header:**
```
┌──────────────────────────────────────────────────┐
│ ⬅️  │  เติมน้ำมันปั้มนอก  │  🔖 RUND-xxx  [❌]  │
└──────────────────────────────────────────────────┘
```

**Active Round Status Bar:**
```
┌──────────────────────────────────────────────────┐
│ 🚗 ABC-1234 | ⏰ 08:00 - ▶️ | 245,000 km → ...   │
│ น้ำมัน: 500 L ➖ ?? L = ▶️ คงเหลือ               │
└──────────────────────────────────────────────────┘
```

**Main Form (2 columns):**

#### **Left Column (60%):**

```
┌──────────────────────────────────────────────────┐
│ ⛽ บันทึกการเติมน้ำมันปั้มนอก                   │
├──────────────────────────────────────────────────┤
│                                                  │
│ 1️⃣  รอบน้ำมัน *                                 │
│     ┌────────────────────────────────────────┐  │
│     │ RUND-20250515-001 (Read-only) ✓       │  │
│     └────────────────────────────────────────┘  │
│     Disabled input (auto-filled from URL)      │
│                                                  │
│ 2️⃣  ตำแหน่งเติม *                              │
│     ┌────────────────────────────────────────┐  │
│     │ ปั้มน้ำมัน Chachoengsao               │  │
│     └────────────────────────────────────────┘  │
│     Type: Text Input (Autocomplete optional)   │
│     Placeholder: "ชื่อปั้ม / สถานที่เติม"     │
│     Help: "ตำแหน่งเติมปั้มนอก"                │
│                                                  │
│ 3️⃣  เลขไมล์ตอนเติม *                           │
│     ┌────────────────────────────────────────┐  │
│     │ 245230 km                             │  │
│     └────────────────────────────────────────┘  │
│     Type: Number Input                          │
│     Suffix: "km"                                │
│     Validation: ≥ start_mileage                │
│     Help: "อ่านจากเลขไมล์รถ"                  │
│                                                  │
│ 4️⃣  ปริมาณที่ต้องการเติม *                     │
│     ┌────────────────────────────────────────┐  │
│     │ 200 L                                 │  │
│     └────────────────────────────────────────┘  │
│     Type: Number Input                          │
│     Suffix: "L"                                 │
│     Placeholder: "จำนวนลิตรที่ต้องการ"          │
│     Help: "กรอกจำนวนลิตรที่ต้องการเติม"       │
│     Validation: > 0                             │
│                                                  │
│ ⚠️  SYSTEM ALERT (Dynamic Display):             │
│     ┌────────────────────────────────────────┐  │
│     │ ⚠️  Alert Box (Red border)             │  │
│     │                                        │  │
│     │ "❌ ไม่สามารถเติม 200 L"               │  │
│     │                                        │  │
│     │ ปัจจุบัน: 454 L / 500 L (Tank)        │  │
│     │ สามารถเติมได้: 46 L เพื่อให้เต็มถัง  │  │
│     │                                        │  │
│     │ ✓ ปริมาณที่จะเติม: 46 L               │  │
│     │                                        │  │
│     └────────────────────────────────────────┘  │
│     Show when: requested > available_capacity  │
│     Color: #FEE2E2 (light red background)     │
│     Border: 2px #EF4444 (red)                  │
│     Auto-update: 5️⃣ field updates to 46      │
│                                                  │
│ 5️⃣  ปริมาณเติมจริง (Auto-corrected) *          │
│     ┌────────────────────────────────────────┐  │
│     │ 46 L                                  │  │
│     └────────────────────────────────────────┘  │
│     Type: Number Input (auto-calculated)      │
│     Read-only or editable depends on situation│
│     Label color: Orange (⚠️ corrected value)   │
│                                                  │
│ 6️⃣  ราคา/ลิตร *                                │
│     ┌────────────────────────────────────────┐  │
│     │ 35 บาท/L                             │  │
│     └────────────────────────────────────────┘  │
│     Type: Number Input (Decimal)                │
│     Prefix: "฿" Suffix: "/L"                    │
│     Default: 35 (from open-round or config)    │
│     Validation: > 0                             │
│     Help: "ราคาเฉพาะปั้มนี้"                   │
│                                                  │
│ 7️⃣  ต้นทุนการเติม (Auto-calc)                  │
│     ┌────────────────────────────────────────┐  │
│     │ ฿ 1,610                  (Read-only)  │  │
│     └────────────────────────────────────────┘  │
│     Type: Display                               │
│     Calculation: 46 × 35 = 1,610 บาท          │
│     Color: Green (#10B981)                      │
│     Icon: 💰                                    │
│                                                  │
│ 8️⃣  เวลาเติม *                                 │
│     ┌────────────────────────────────────────┐  │
│     │ 2025-05-15  │  14:00                  │  │
│     └────────────────────────────────────────┘  │
│     Type: Date + Time Picker                    │
│     Format: DD/MM/YYYY (BE) + HH:MM             │
│     Default: Today + current time               │
│     Validation: ≥ open-round time              │
│                                                  │
│ 9️⃣  หมายเหตุ                                   │
│     ┌────────────────────────────────────────┐  │
│     │ ต้องการเติม 200 L แต่ถังจุได้แค่ 46 L │  │
│     │ ส่วนเหลือ 154 L ต้องจัดการอื่น        │  │
│     └────────────────────────────────────────┘  │
│     Type: Textarea                              │
│     Rows: 2                                     │
│     Placeholder: "หมายเหตุเพิ่มเติม"           │
│     Optional                                    │
│                                                  │
└──────────────────────────────────────────────────┘
```

#### **Right Column (40%):**

**Info Card 1: Current Tank Status**
```
┌──────────────────────────────────────────────────┐
│ 🛢️  สถานะถัง                                    │
├──────────────────────────────────────────────────┤
│                                                  │
│ ความจุถัง: 500 L                                │
│ ─────────────────────────────────────            │
│ เมื่อเปิดรอบ: 500 L (FULL)                      │
│ - เลก 1: -30 L                                  │
│ - เลก 2: -16 L                                  │
│ ─────────────────────────────────────            │
│ ปัจจุบัน: 454 L                                 │
│ ─────────────────────────────────────            │
│ 📊 Visual Progress Bar:                          │
│    [████░░░░░░░░░░░░░░░░░░] 90.8% (454/500)   │
│                                                  │
│ ✓ สามารถเติมได้: 46 L                           │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Info Card 2: Refill History**
```
┌──────────────────────────────────────────────────┐
│ 📝 บันทึกการเติม (This Round)                    │
├──────────────────────────────────────────────────┤
│                                                  │
│ ✓ START FULL (08:00):                          │
│   500 L @ โรงงาน                                │
│   Cost: ฿17,500 (not counted)                   │
│                                                  │
│ ➕ INTERMEDIATE (14:00):                        │
│   46 L @ ปั้มน้ำมัน Chachoengsao               │
│   Cost: ฿1,610 (Will be added)                  │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Bottom Buttons:**
```
┌──────────────────────────────────────────────────┐
│  [✅ บันทึก]  [❌ ยกเลิก]                        │
└──────────────────────────────────────────────────┘

Button 1: "✅ บันทึก" (Primary Blue)
  - Action: Submit → Create fuel_refill record
  - Add to journey_expenses
  - Update round: total_intermediate_refills
  - Toast: "✅ บันทึกการเติมน้ำมันสำเร็จ"

Button 2: "❌ ยกเลิก" (Gray)
  - Confirm: "ต้องการยกเลิก?"
  - Go back
```

---

## 🛑 PAGE 4: CLOSE FUEL ROUND (/fuel/close-round?round_id=RUND-xxx)

### **Layout Structure:**

**Header:**
```
┌──────────────────────────────────────────────────┐
│ ⬅️  │  ปิดรอบน้ำมัน  │  🔖 RUND-xxx  [❌]      │
└──────────────────────────────────────────────────┘
```

**Main Form (2 columns):**

#### **Left Column (60%):**

```
┌──────────────────────────────────────────────────┐
│ 🛑 ปิดรอบน้ำมัน                                 │
├──────────────────────────────────────────────────┤
│                                                  │
│ 1️⃣  รอบน้ำมัน *                                 │
│     ┌────────────────────────────────────────┐  │
│     │ RUND-20250515-001 (Read-only) ✓       │  │
│     └────────────────────────────────────────┘  │
│                                                  │
│ 2️⃣  รถ *                                        │
│     ┌────────────────────────────────────────┐  │
│     │ ABC-1234 (Isuzu FVR 10ล้อ) ✓         │  │
│     └────────────────────────────────────────┘  │
│     Read-only                                   │
│                                                  │
│ 3️⃣  เลขไมล์สิ้นสุด *                           │
│     ┌────────────────────────────────────────┐  │
│     │ 248410 km                             │  │
│     └────────────────────────────────────────┘  │
│     Type: Number Input                          │
│     Suffix: "km"                                │
│     Format: comma separator (248,410)          │
│     Validation: > start_mileage                │
│     Help: "อ่านจากเลขไมล์รถ"                  │
│     Auto-calc: distance = 248410 - 245000     │
│                         = 3410 km              │
│                                                  │
│ 📊 DISTANCE INFO (Auto-display):                │
│     ┌────────────────────────────────────────┐  │
│     │ 📏 ระยะทาง:                            │  │
│     │    245,000 → 248,410 = 410 km ✓       │  │
│     └────────────────────────────────────────┘  │
│                                                  │
│ 4️⃣  ปริมาณเติมตอนปิด (เต็มถัง) *              │
│     ┌────────────────────────────────────────┐  │
│     │ 36 L                                  │  │
│     └────────────────────────────────────────┘  │
│     Type: Number Input                          │
│     Suffix: "L"                                 │
│     Help: "เติมจนเต็มถัง (500 L)"               │
│     Placeholder: "เช่น 36"                      │
│     Validation: > 0, < 500                     │
│                                                  │
│ 📊 FUEL INFO (Auto-display):                    │
│     ┌────────────────────────────────────────┐  │
│     │ ⛽ ข้อมูลน้ำมัน:                       │  │
│     │                                        │  │
│     │ เปิดรอบ: 500 L (FULL)                 │  │
│     │ + เติมปั้มนอก: 46 L                   │  │
│     │ - เติมตอนปิด: 36 L (ยังไม่นับ)       │  │
│     │ ─────────────────────────────────     │  │
│     │ 🎯 ใช้จริง: 500 + 46 - 500 = 46 L  │  │
│     │                                        │  │
│     │ 📊 Efficiency:                        │  │
│     │    410 km ÷ 46 L = 8.91 km/L ✓      │  │
│     │                                        │  │
│     └────────────────────────────────────────┘  │
│                                                  │
│ 5️⃣  ราคา/ลิตร *                                │
│     ┌────────────────────────────────────────┐  │
│     │ 35 บาท/L                             │  │
│     └────────────────────────────────────────┘  │
│     Type: Number Input (Decimal)                │
│     Default: 35 (from round settings)           │
│                                                  │
│ 6️⃣  เวลาเติมตอนปิด *                           │
│     ┌────────────────────────────────────────┐  │
│     │ 2025-05-15  │  16:30                  │  │
│     └────────────────────────────────────────┘  │
│     Type: Date + Time Picker                    │
│     Default: Today + current time               │
│                                                  │
│ 7️⃣  ต้นทุนเติมตอนปิด (Auto-calc)              │
│     ┌────────────────────────────────────────┐  │
│     │ ฿ 1,260                  (Read-only)  │  │
│     └────────────────────────────────────────┘  │
│     Calculation: 36 × 35 = 1,260 บาท          │
│     Color: Green (#10B981)                      │
│                                                  │
│ 8️⃣  หมายเหตุ                                   │
│     ┌────────────────────────────────────────┐  │
│     │ [Text area for notes]                 │  │
│     └────────────────────────────────────────┘  │
│     Type: Textarea                              │
│     Optional                                    │
│                                                  │
└──────────────────────────────────────────────────┘
```

#### **Right Column (40%):**

**Info Card 1: Final Summary Preview**
```
┌──────────────────────────────────────────────────┐
│ 📊 สรุปรอบน้ำมัน (Preview)                      │
├──────────────────────────────────────────────────┤
│                                                  │
│ FUEL CONSUMED: 46 L                             │
│ EFFICIENCY: 8.91 km/L                           │
│ TOTAL DISTANCE: 410 km                          │
│ FUEL COST: ฿2,870                              │
│                                                  │
│ Status: ✅ Ready to close                       │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Info Card 2: Cost Breakdown**
```
┌──────────────────────────────────────────────────┐
│ 💰 ค่าใช้จ่ายน้ำมัน                             │
├──────────────────────────────────────────────────┤
│                                                  │
│ Intermediate Refill:                            │
│   46 L × 35 ฿/L = ฿1,610                       │
│                                                  │
│ End Fill:                                       │
│   36 L × 35 ฿/L = ฿1,260                       │
│                                                  │
│ ─────────────────────────────                   │
│ รวมต้นทุนน้ำมัน: ฿2,870                        │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Bottom Buttons:**
```
┌──────────────────────────────────────────────────┐
│  [✅ ปิดรอบน้ำมัน]  [❌ ยกเลิก]                   │
└──────────────────────────────────────────────────┘

Button 1: "✅ ปิดรอบน้ำมัน" (Primary Blue)
  - Action: Submit → Update fuel_round status = CLOSED
  - Create fuel_refill (END_FULL)
  - Calculate summary
  - Redirect to summary page

Button 2: "❌ ยกเลิก" (Gray)
```

---

## 📄 PAGE 5: FUEL ROUND SUMMARY (/fuel/rounds/:id)

**Full-width layout, scrollable**

```
┌──────────────────────────────────────────────────┐
│ ⬅️  │  สรุปรอบน้ำมัน RUND-20250515-001 │  [🖨️] [📥] │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ 📊 FUEL ROUND SUMMARY REPORT                    │
├──────────────────────────────────────────────────┤
│                                                  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│ 🚗 ข้อมูลรอบ:                                   │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                                  │
│ Round ID: RUND-20250515-001                    │
│ Vehicle: ABC-1234 (Isuzu FVR 10ล้อ)           │
│ Status: ✅ CLOSED                              │
│ Date: 2025-05-15 (15 เม.ย. 2568)              │
│                                                  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│ ⏰ เวลา:                                        │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                                  │
│ เปิดรอบ: 08:00 (Depot)                        │
│ ปิดรอบ: 16:30 (Depot)                         │
│ ระยะเวลา: 8.5 ชั่วโมง                          │
│                                                  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│ 📏 ระยะทาง:                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                                  │
│ เปิดรอบ: 245,000 km                           │
│ ปิดรอบ: 248,410 km                            │
│ รวมระยะทาง: 410 km ✓                          │
│                                                  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│ ⛽ ข้อมูลน้ำมัน:                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                                  │
│ Refill 1 (Start):                              │
│    📍 โรงงาน KPS                                │
│    ⏰ 08:00                                     │
│    🛢️ 500 L (FULL)                             │
│    💰 500 × 35 = ฿17,500 (prev. round)         │
│                                                  │
│ Refill 2 (Intermediate):                       │
│    📍 ปั้มน้ำมัน Chachoengsao                  │
│    ⏰ 14:00 (245,230 km)                       │
│    🛢️ 46 L                                     │
│    💰 46 × 35 = ฿1,610 ✓                      │
│                                                  │
│ Refill 3 (End):                                │
│    📍 โรงงาน KPS                                │
│    ⏰ 16:30                                     │
│    🛢️ 36 L (จนเต็ม)                            │
│    💰 36 × 35 = ฿1,260 ✓                      │
│                                                  │
│ ┌────────────────────────────────────────────┐ │
│ │ 📊 FUEL CALCULATION:                       │ │
│ │                                            │ │
│ │ Start: 500 L                               │ │
│ │ + Intermediate: 46 L                       │ │
│ │ - End: 500 L (full again)                  │ │
│ │ ────────────────────────────────           │ │
│ │ 🎯 Consumed: 46 L ✓                       │ │
│ │                                            │ │
│ │ Efficiency: 410 km / 46 L = 8.91 km/L ✓  │ │
│ │                                            │ │
│ │ Fuel Cost: ฿1,610 + ฿1,260 = ฿2,870 ✓   │ │
│ │                                            │ │
│ └────────────────────────────────────────────┘ │
│                                                  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│ 📦 Journeys & Legs ใน Round นี้:              │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                                  │
│ Journey: JRN-20250515-001                      │
│                                                  │
│ • LEG-001: BKK → Rayong (150 km)              │
│            ✓ Outbound | 20 ตัน | ฿60,000     │
│                                                  │
│ • LEG-002: Rayong → Chachoengsao (80 km)      │
│            ✓ Backhaul | 15 ตัน | ฿30,000     │
│                                                  │
│ • LEG-003: Chachoengsao → BKK (180 km)       │
│            ✓ Return | 0 ตัน | ฿0             │
│                                                  │
│ รวมรายได้: ฿90,000                             │
│                                                  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│ 💰 สรุป P&L (Profit & Loss):                   │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                                  │
│ 📈 รายได้:                                     │
│    ✓ ค่าขนส่ง: ฿90,000                        │
│                                                  │
│ 💸 ค่าใช้จ่าย:                                 │
│    • ค่าน้ำมัน: ฿2,870                        │
│    • ค่าอื่น: ฿0                              │
│    • รวม: ฿2,870                              │
│                                                  │
│ ┌────────────────────────────────────────────┐ │
│ │ 💚 กำไรสุทธิ: ฿87,130                       │ │
│ │ 📊 อัตรากำไร: 96.8% 🔥                     │ │
│ └────────────────────────────────────────────┘ │
│                                                  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                                  │
│ [🖨️ พิมพ์ PDF]  [📥 ดาวน์โหลด Excel]  [↩️ ย้อนกลับ] │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## 🎨 COMPONENT SPECIFICATIONS

### **Alert Box for Tank Capacity**
```
┌────────────────────────────────────────────────┐
│ ⚠️  Alert: Cannot add requested amount         │
├────────────────────────────────────────────────┤
│                                                │
│ Background: #FEE2E2 (light red)                │
│ Border: 2px solid #EF4444 (red)               │
│ Border-radius: 6px                             │
│ Padding: 12px 16px                             │
│                                                │
│ Icon: ⚠️ (16x16px)                            │
│ Title: "ไม่สามารถเติมได้" (Bold)                │
│ Message: "ปั้มนอก...จำนวน..." (Regular)       │
│                                                │
│ Suggestion: "✓ แนะนำปริมาณ: 46 L" (Green)    │
│                                                │
└────────────────────────────────────────────────┘
```

### **Fuel Level Progress Bar**
```
Tank: [████████████░░░░░░░░░░░░] 90.8% (454/500 L)

Style:
  - Full width: 100%
  - Height: 20px
  - Background: #E5E7EB
  - Fill: 
    - < 25%: #EF4444 (Red - critical)
    - 25-50%: #F59E0B (Yellow - warning)
    - > 50%: #10B981 (Green - ok)
  - Border-radius: 4px
  - Label: "454/500 L (90.8%)"
```

### **Cost Display (Auto-calculated)**
```
Fuel Cost: ฿1,610

Style:
  - Font: 16px, Bold
  - Color: #10B981 (Green)
  - Icon: 💰 (preceding)
  - Padding: 8px 12px
  - Background: #ECFDF5 (light green)
  - Border: 1px solid #10B981
  - Border-radius: 6px
```

### **Info Cards** (Right sidebar)
```
┌──────────────────────────────────────┐
│ 📍 Card Title                        │
├──────────────────────────────────────┤
│ • Line 1: Value                      │
│ • Line 2: Value                      │
│ • Line 3: Value                      │
└──────────────────────────────────────┘

Style:
  - Background: #FFFFFF
  - Border: 1px solid #E5E7EB
  - Border-radius: 8px
  - Padding: 16px
  - Box-shadow: 0 1px 3px rgba(0,0,0,0.1)
  - Hover: shadow 0 4px 6px rgba(0,0,0,0.1)
```

---

## 📱 RESPONSIVE DESIGN

### **Desktop (1920px)**
- Left column: 60% | Right column: 40%
- Form fields: Full width in columns
- Info cards: Stacked vertically

### **Tablet (1024px)**
- Left column: 50% | Right column: 50%
- Adjustable layout

### **Mobile (< 768px)**
- Single column layout
- 100% width for all elements
- Cards stack vertically
- Adjust form spacing

---

## 🔗 NAVIGATION LINKS

```
/fuel/open-round
    ↓
    ✓ (Create round)
    ↓
/dispatch/open-journey?round_id=RUND-xxx
    ↓
    ✓ (Add legs)
    ↓
/fuel/refill-intermediate?round_id=RUND-xxx (if needed)
    ↓
    ✓ (Add refill)
    ↓
/fuel/close-round?round_id=RUND-xxx
    ↓
    ✓ (Close round)
    ↓
/fuel/rounds/RUND-xxx (Summary)
```

---

## 🎭 STATE MANAGEMENT

### **Page States:**

**Open Round Page:**
- Default: Empty form
- After submit: Redirect to journey page with round_id

**Journey Page:**
- During round: Show round badge + info bar
- Add leg: Link to fuel round
- Multiple legs: Show leg list with delete option

**Intermediate Refill Page:**
- Show current tank level (calculated from legs)
- Alert if requested > available
- Auto-correct to max available

**Close Round Page:**
- Show all previous refills
- Pre-fill data if available
- Calculate and display summary preview
- After submit: Redirect to summary page

**Summary Page:**
- Display all calculated data
- Show print & download options
- Allow export

---

## 📊 DATA FLOW DIAGRAM

```
┌─────────────────────────────────────────────────┐
│ OPEN ROUND (Create fuel_round record)           │
└────────────────────┬────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│ CREATE FUEL REFILL #1 (START_FULL, 500 L)      │
└────────────────────┬────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│ ADD JOURNEY LEGS (Link to round_id)            │
│ • LEG-001, LEG-002, LEG-003...                 │
└────────────────────┬────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│ ADD INTERMEDIATE REFILL (Optional, Multiple)    │
│ • CREATE FUEL REFILL #2+ (INTERMEDIATE)        │
│ • ADD JOURNEY EXPENSE (Fuel cost)              │
└────────────────────┬────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│ CLOSE ROUND                                     │
│ • CREATE FUEL REFILL #N (END_FULL)             │
│ • CALCULATE: fuel_consumed, efficiency, cost   │
│ • UPDATE: round_status = CLOSED                │
└────────────────────┬────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│ DISPLAY SUMMARY                                 │
│ • Show all refills + journeys + P&L            │
│ • Print/Export options                         │
└─────────────────────────────────────────────────┘
```

---

## ✨ ANIMATIONS & TRANSITIONS

```
Alert appearance: 300ms fade-in + slide up
Progress bar update: 500ms smooth fill change
Cost calculation: 200ms number animation (tween)
Page transitions: 150ms fade out → in
Button hover: 150ms background change
```

---

## 🖨️ PRINT STYLESHEET

```css
@media print {
  .no-print { display: none; }
  body { background: white; }
  
  .fuel-round-summary {
    width: 100%;
    page-break-inside: avoid;
  }
  
  .cost-breakdown {
    border: 1px solid #000;
    padding: 8px;
  }
}

@page {
  size: A4 portrait;
  margin: 15mm;
}
```

---

**END OF FIGMA DESIGN PROMPT FOR FUEL ROUND SYSTEM**

**Version:** 1.0  
**Date:** May 2025 (BE 2568)  
**Ready for Design System Creation in Figma**
