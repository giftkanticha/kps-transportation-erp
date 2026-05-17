# KPS Transportation ERP
## Expense Management System (ระบบค่าใช้จ่าย) - PRD Analysis & Technical Specification

---

## 📋 EXECUTIVE SUMMARY

**Feature Name:** Expense Management System (ระบบค่าใช้จ่าย)  
**Main Goal:** Track, manage, and report all vehicle maintenance & company expenses with automated stock deduction  
**Tech Stack:** React + Tailwind CSS  
**Language Rule:** Thai UI labels only, English code logic  
**Key Feature:** Real-time P&L tracking with Pivot Table reporting + PDF export

---

## 🏗️ SYSTEM ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────┐
│                 MAIN MENU: ค่าใช้จ่าย                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 1. บันทึกค่าใช้จ่าย (Expense Recording)                 │
│    ├─ ข้อมูลหลักของบิล (Header)                        │
│    ├─ รายการค่าใช้จ่าย (Line Items Grid)              │
│    └─ สถานะการเงิน (Payment Status)                   │
│                                                         │
│ 2. สถานะการเงิน (Financial Status)                      │
│    └─ รายการค้างจ่าย (Accounts Payable List)          │
│                                                         │
│ 3. สต็อคคลังKPS (KPS Inventory Stock)                  │
│    ├─ เพิ่มอะไหล่ (Add Parts Form)                     │
│    └─ สต็อคสินค้าปัจจุบัน (Current Stock Table)       │
│                                                         │
│ 4. รายงานสรุป (Summary Reports)                         │
│    ├─ รายงานรายละเอียดการซ่อม (Repair Detail)        │
│    ├─ ประวัติการซ่อมบำรุง (Maintenance History)      │
│    ├─ ค่าใช้จ่ายตามช่วงวันที่ (Expense by Date)       │
│    ├─ เจ้าหนี้รายเดือน (Monthly Creditor)           │
│    └─ สรุปต่อคัน/คู่ค้า PIVOT (Vehicle x Vendor)     │
│                                                         │
│ 5. ทะเบียนช่าง (Vendor/Source Management)              │
│    └─ CRUD vendor information                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 DATABASE SCHEMA

### **TABLE 1: expenses (ค่าใช้จ่าย)**

```sql
CREATE TABLE expenses (
  expense_id VARCHAR(20) PRIMARY KEY,
  
  -- Header Info
  vehicle_id VARCHAR(20) NOT NULL,
  vehicle_plate VARCHAR(10),  -- ทะเบียนรถ (auto-filled)
  vehicle_type VARCHAR(50),   -- ประเภทรถ (auto-filled)
  driver_name VARCHAR(100),   -- ชื่อพนักงานขับรถ (auto-filled)
  
  expense_date DATE NOT NULL,  -- วันที่
  odometer_reading INT,        -- เลขไมล์ปัจจุบัน
  
  vendor_id VARCHAR(20) NOT NULL,  -- ร้านค้า/ช่าง
  vendor_type ENUM('EXTERNAL_MECHANIC', 'PARTS_SHOP', 'GENERAL_SHOP', 'KPS_WAREHOUSE'),
  
  -- Line Items
  total_amount DECIMAL(12,2) NOT NULL,  -- ผลรวมสุทธิ (Net Total)
  
  -- Payment Status
  payment_status ENUM('PAID', 'UNPAID') DEFAULT 'UNPAID',
  payment_due_date DATE,  -- วันที่ต้องชำระ
  
  -- Sync flags
  kps_stock_synced BOOLEAN DEFAULT FALSE,  -- ถ้า vendor_type = KPS_WAREHOUSE
  
  created_at DATETIME,
  created_by VARCHAR(50),
  updated_at DATETIME,
  
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id),
  FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id)
);
```

### **TABLE 2: expense_line_items (รายการค่าใช้จ่าย)**

```sql
CREATE TABLE expense_line_items (
  line_item_id VARCHAR(20) PRIMARY KEY,
  expense_id VARCHAR(20) NOT NULL,
  
  sequence_no INT NOT NULL,  -- ลำดับ
  invoice_no VARCHAR(50),     -- เลขเอกสาร/ใบเสร็จ
  
  item_name VARCHAR(200) NOT NULL,  -- รายการ
  item_type ENUM('PART', 'SERVICE', 'OTHER'),
  
  qty INT NOT NULL,            -- จำนวนหน่วย
  unit_price DECIMAL(10,2) NOT NULL,  -- ราคาต่อหน่วย
  amount DECIMAL(12,2) NOT NULL,      -- จำนวนเงิน (Qty * Unit Price)
  
  notes TEXT,  -- คำอธิบายเพิ่มเติม
  
  -- Stock tracking (if item_type = PART and vendor_type = KPS_WAREHOUSE)
  stock_deducted BOOLEAN DEFAULT FALSE,
  stock_deduction_id VARCHAR(20),
  
  created_at DATETIME,
  
  FOREIGN KEY (expense_id) REFERENCES expenses(expense_id),
  FOREIGN KEY (stock_deduction_id) REFERENCES kps_stock_deductions(deduction_id)
);
```

### **TABLE 3: kps_stock (สต็อคคลังKPS)**

```sql
CREATE TABLE kps_stock (
  stock_id VARCHAR(20) PRIMARY KEY,
  
  item_name VARCHAR(200) NOT NULL,  -- ชื่อรายการ
  item_code VARCHAR(50) UNIQUE,     -- รหัสรายการ
  
  quantity_in_stock INT NOT NULL DEFAULT 0,  -- จำนวนคงเหลือ
  unit_cost DECIMAL(10,2),  -- ต้นทุนต่อหน่วย (avg cost)
  total_value DECIMAL(12,2),  -- มูลค่ารวม (Qty × Avg Cost)
  
  -- Tracking
  last_received_date DATE,
  last_deducted_date DATE,
  
  created_at DATETIME,
  updated_at DATETIME
);
```

### **TABLE 4: kps_stock_movements (เข้า-ออก สต็อค)**

```sql
CREATE TABLE kps_stock_movements (
  movement_id VARCHAR(20) PRIMARY KEY,
  stock_id VARCHAR(20) NOT NULL,
  
  movement_type ENUM('IN', 'OUT') NOT NULL,
  -- IN: รับเข้าจากฟอร์ม "เพิ่มอะไหล่"
  -- OUT: ตัดออกจากใบบันทึกค่าใช้จ่าย
  
  quantity INT NOT NULL,
  movement_date DATE NOT NULL,
  reference_type ENUM('EXPENSE', 'MANUAL_ADJUSTMENT'),
  reference_id VARCHAR(20),  -- expense_id or line_item_id
  
  notes TEXT,
  created_at DATETIME,
  created_by VARCHAR(50)
);
```

### **TABLE 5: vendors (ทะเบียนช่าง/ร้านค้า)**

```sql
CREATE TABLE vendors (
  vendor_id VARCHAR(20) PRIMARY KEY,
  
  vendor_name VARCHAR(200) NOT NULL,  -- ชื่อร้านค้า/ช่าง
  vendor_type ENUM('EXTERNAL_MECHANIC', 'PARTS_SHOP', 'GENERAL_SHOP'),
  
  address TEXT,  -- ที่อยู่
  tax_id VARCHAR(20),  -- เลขประจำตัวผู้เสียภาษี
  phone VARCHAR(20),  -- เบอร์โทร
  
  -- Bank Info
  bank_name VARCHAR(100),  -- ชื่อธนาคาร
  account_number VARCHAR(50),  -- เลขที่บัญชี
  account_name VARCHAR(100),  -- ชื่อบัญชี
  
  created_at DATETIME,
  updated_at DATETIME
);
```

### **TABLE 6: accounts_payable (เจ้าหนี้ค้างจ่าย)**

```sql
CREATE TABLE accounts_payable (
  ap_id VARCHAR(20) PRIMARY KEY,
  
  expense_id VARCHAR(20) NOT NULL,
  vendor_id VARCHAR(20) NOT NULL,
  
  amount DECIMAL(12,2) NOT NULL,  -- ยอดค้างจ่าย
  
  created_date DATE NOT NULL,  -- วันที่บันทึก
  due_date DATE NOT NULL,      -- วันที่ต้องชำระ
  
  status ENUM('UNPAID', 'PAID', 'PARTIAL') DEFAULT 'UNPAID',
  
  created_at DATETIME,
  
  FOREIGN KEY (expense_id) REFERENCES expenses(expense_id),
  FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id)
);
```

---

## 🎯 MODULE 1: บันทึกค่าใช้จ่าย (Expense Recording)

### **PAGE: /expenses/new (หรือ /expenses/create)**

### **SECTION 1: ข้อมูลหลักของบิล (Header/Form)**

**Left Column (50%):**

```
┌────────────────────────────────────────┐
│ ข้อมูลหลักของบิล                         │
├────────────────────────────────────────┤
│                                        │
│ 1. ทะเบียนรถ * (Dropdown)              │
│    [ABC-1234] ▼                        │
│    Auto-fill on select:                │
│      → ประเภทรถ (Vehicle Type)         │
│      → พนักงานขับรถ (Driver Name)      │
│    Validation: Required                │
│                                        │
│ 2. วันที่ * (Date Picker)               │
│    [15/05/2568] 📅                     │
│    Default: Today                      │
│    Format: DD/MM/YYYY (BE)             │
│                                        │
│ 3. เลขไมล์ปัจจุบัน (Number)            │
│    [245230] km                         │
│    Validation: ≥ 0, numeric            │
│    Required: for repair history        │
│                                        │
└────────────────────────────────────────┘
```

**Right Column (50%):**

```
┌────────────────────────────────────────┐
│ ข้อมูลเพิ่มเติม                         │
├────────────────────────────────────────┤
│                                        │
│ 4. ประเภทรถ (Auto-fill, Read-only)     │
│    10ล้อ 📖                            │
│                                        │
│ 5. พนักงานขับรถ (Auto-fill, Read-only) │
│    สมชาย เสมเมือง 👨                   │
│                                        │
│ 6. ร้านค้า/ช่าง * (Dropdown)           │
│    [ศูนย์ซ่อม ABC] ▼                    │
│    Options:                            │
│      • ช่างภายนอก (External Mechanic) │
│      • ร้านอะไหล่ (Parts Shop)        │
│      • ร้านค้าทั่วไป (General Shop)   │
│      • คลังKPS (KPS Warehouse)        │
│    Sync with: ทะเบียนช่าง              │
│    Required: Yes                       │
│    Change: Trigger vendor_type change  │
│                                        │
└────────────────────────────────────────┘
```

---

### **SECTION 2: รายการค่าใช้จ่าย (Line Items Grid)**

**Dynamic Editable Grid/Table:**

```
┌─────────────────────────────────────────────────────────────────────┐
│ รายการค่าใช้จ่าย                                                     │
├────┬──────┬──────────┬────┬─────┬────────┬─────────┬──────────────┤
│ ลำดับ│เลขเอกสาร│ รายการ    │จำนวน│ราคา/หน่วย│จำนวนเงิน│หมายเหตุ│ ลบ  │
├────┼──────┼──────────┼────┼─────┼────────┼─────────┼──────────────┤
│ 1  │ INV-001│แบตเตอรี่│ 2  │ 2,500│ 5,000  │ -      │ [✕] │
│ 2  │ INV-002│ซ่อมห้ามเบรก│ 1 │ 8,500│ 8,500  │ -      │ [✕] │
│ 3  │ INV-003│ถ่ายน้ำมันเครื่อง│ - │ -   │ -      │ -      │ [✕] │
│ +  │       │          │    │      │        │        │ [➕ เพิ่มแถว] │
└────┴──────┴──────────┴────┴─────┴────────┴─────────┴──────────────┘

Grid Features:
• Editable cells (in-place editing)
• Validation on each cell
• Auto-calculate "จำนวนเงิน" = Qty × Unit Price
• Delete row button [✕]
• Add new row button [➕ เพิ่มแถว]
• Dropdown for "รายการ" (from Master Parts or free-text)

Column Details:

1. ลำดับ (No.)
   - Type: Auto-generated
   - Behavior: Auto-number on add/delete

2. เลขเอกสาร (Invoice/Receipt No.)
   - Type: Text Input
   - Placeholder: "INV-001"
   - Optional

3. รายการ (Item/Service)
   - Type: Autocomplete Dropdown + Free-text
   - If vendor_type = "KPS_WAREHOUSE":
     → Dropdown shows items from kps_stock table only
     → User can select existing parts
   - Else:
     → Free-text input (for external vendors)
   - Required: Yes

4. จำนวนหน่วย (Qty)
   - Type: Number Input
   - Validation: > 0
   - Required: Yes

5. ราคาต่อหน่วย (Unit Price)
   - Type: Number Input (Decimal)
   - Prefix: "฿"
   - Validation: ≥ 0
   - Required: Yes

6. จำนวนเงิน (Total Price)
   - Type: Display (Read-only, calculated)
   - Formula: Qty × Unit Price
   - Auto-update on Qty or Unit Price change

7. คำอธิบายเพิ่มเติม (Notes)
   - Type: Text Input (small)
   - Optional

Grid Actions:
• Add Row: [➕ เพิ่มแถว] button below table
• Delete Row: [✕] button at end of each row
• Auto-sum: "รวมเงิน" cell (sticky bottom row)
```

**Net Total Row (Sticky Bottom):**

```
┌──────────────────────────────────────────┐
│ ผลรวมสุทธิ (Net Total):                  │
│ ฿ 13,500 (Auto-sum of all "จำนวนเงิน")  │
│ Color: Green (#10B981)                   │
│ Font: Bold, 16px                         │
└──────────────────────────────────────────┘
```

---

### **SECTION 3: สถานะการเงิน (Payment Status)**

```
┌────────────────────────────────────────┐
│ สถานะการเงิน                             │
├────────────────────────────────────────┤
│                                        │
│ ◉ ชำระเงินแล้ว (Paid)                  │
│ ○ ยังไม่ได้ชำระ (Unpaid)               │
│                                        │
│ If "ยังไม่ได้ชำระ" selected:            │
│   ├─ Logic: Auto-create record in      │
│   │   "Accounts Payable" table          │
│   └─ Due Date: [เลือกวันที่] (Date Pick)│
│                                        │
│ If "ชำระเงินแล้ว":                     │
│   └─ Hide Due Date field                │
│                                        │
└────────────────────────────────────────┘
```

**Important Logic:**

```
IF vendor_type == "KPS_WAREHOUSE" AND save expense:
  → Line items must be pulled into "สต็อคคลังKPS"
  → For each line item:
     • Deduct Qty from kps_stock.quantity_in_stock
     • Create record in kps_stock_movements (type=OUT)
     • Set expense_line_items.stock_deducted = TRUE
     • Set stock_deduction_id = reference to movement_id

IF payment_status == "UNPAID":
  → Create/Update record in accounts_payable table
  → Set due_date from input
  → Status in accounts_payable = UNPAID
```

**Bottom Buttons:**

```
[💾 บันทึก]  [🔄 บันทึกและเพิ่มใหม่]  [❌ ยกเลิก]

Button 1: "💾 บันทึก" (Primary Blue)
  - Action: POST /api/expenses (create expense record)
  - Validation: Check all required fields
  - Check: If vendor_type = KPS_WAREHOUSE, validate stock available
  - Success: Toast + Redirect to /expenses or list page

Button 2: "🔄 บันทึกและเพิ่มใหม่" (Gray)
  - Action: POST + Reset form
  - Keep vehicle + vendor selected
  - Clear line items & payment status

Button 3: "❌ ยกเลิก" (Gray)
  - Confirm: "ต้องการยกเลิกหรือไม่?"
  - Action: Clear form or go back
```

---

## 💳 MODULE 2: สถานะการเงิน (Financial Status)

### **PAGE: /expenses/financial-status**

```
┌─────────────────────────────────────────────────┐
│ สถานะการเงิน - เจ้าหนี้ค้างจ่าย                  │
├─────────────────────────────────────────────────┤
│                                                 │
│ 🔍 Filter:                                      │
│ [เลือกวันที่] [เลือกร้านค้า] [🔍 ค้นหา]           │
│                                                 │
├─────────────────────────────────────────────────┤
│ 📊 สรุป:                                        │
│ • รายการค้างจ่ายรวม: ฿ 150,000                │
│ • จำนวนรายการ: 12 รายการ                      │
│ • วันที่สูงสุด: 45 วัน                         │
│                                                 │
├─────────────────────────────────────────────────┤
│ 📋 รายการค้างจ่าย (Accounts Payable List)      │
│                                                 │
│ Table Columns:                                  │
│ • ลำดับ (No.)                                  │
│ • ร้านค้า (Vendor Name)                       │
│ • เลขอ้างอิง (Ref No./Expense ID)              │
│ • จำนวนเงิน (Amount)                          │
│ • วันที่บันทึก (Created Date)                  │
│ • วันที่ต้องชำระ (Due Date)                   │
│ • สถานะ (Status: Unpaid/Paid/Partial)        │
│ • การดำเนินการ (Actions)                      │
│                                                 │
│ Table Data (Example):                          │
│ ┌───┬──────────┬──────┬─────────┬─────┬─────┬──────┐
│ │No.│ร้านค้า  │ Ref  │จำนวนเงิน│สร้าง│ต้องชำระ│สถานะ│
│ ├───┼──────────┼──────┼─────────┼─────┼─────┼──────┤
│ │1  │ศูนย์ ABC │EXP-1 │ ฿13,500 │15/5 │20/5 │🔴 ค้าง
│ │2  │ร้านอะไหล่│EXP-2 │ ฿45,000 │10/5 │15/5 │🔴 ค้าง
│ │3  │ร้านค้า XY│EXP-3 │ ฿92,000 │08/5 │25/5 │🟡 ใกล้
│ └───┴──────────┴──────┴─────────┴─────┴─────┴──────┘
│                                                 │
│ Actions per Row:                                │
│ • 👁️ ดูรายละเอียด (View)                      │
│ • ✏️ แก้ไข (Edit)                             │
│ • ✅ ทำเครื่องหมายชำระแล้ว (Mark as Paid)    │
│ • 📥 ดาวน์โหลด (Export)                       │
│                                                 │
│ [🖨️ พิมพ์ PDF]                                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 📦 MODULE 3: สต็อคคลังKPS (KPS Inventory Stock)

### **PAGE: /expenses/kps-stock**

### **SECTION 3.1: เพิ่มอะไหล่ (Add Parts Form)**

**Top Form:**

```
┌─────────────────────────────────────────────────┐
│ เพิ่มอะไหล่ใหม่                                │
├─────────────────────────────────────────────────┤
│                                                 │
│ Left Column (60%):                              │
│                                                 │
│ 1. วันที่ * (Date Picker)                       │
│    [15/05/2568] 📅                             │
│    Default: Today                              │
│                                                 │
│ 2. รายการ (Item Name) * (Text + Autocomplete) │
│    [ค้นหาหรือสร้างใหม่...]                    │
│    Type: Autocomplete dropdown                  │
│    If NOT found in master → Allow free-text    │
│    Validation: Required                         │
│                                                 │
│ 3. จำนวน (Qty) * (Number)                       │
│    [50]                                         │
│    Validation: > 0                              │
│                                                 │
│ 4. ราคาต่อหน่วย (Unit Cost) * (Decimal)        │
│    [฿ 2,500]                                    │
│    Validation: ≥ 0                              │
│                                                 │
│ Right Column (40%):                             │
│                                                 │
│ 5. รวมเงิน (Total Amount) (Auto-calculated)    │
│    [฿ 125,000] (Read-only)                      │
│    Formula: Qty × Unit Cost                     │
│    Color: Green (#10B981)                       │
│    Auto-update on Qty or Unit Cost change      │
│                                                 │
│                                                 │
│ [✅ เพิ่มสินค้า]  [❌ ยกเลิก]                    │
│                                                 │
│ Behavior:                                       │
│ • Click "เพิ่มสินค้า":                         │
│   → POST to /api/kps-stock/add                  │
│   → Insert into kps_stock table                 │
│   → Create movement record (IN)                 │
│   → Update quantity_in_stock immediately        │
│   → Clear form or show success                  │
│                                                 │
└─────────────────────────────────────────────────┘
```

### **SECTION 3.2: จำนวนสต็อคสินค้าปัจจุบัน (Current Stock Table)**

```
┌────────────────────────────────────────────────────┐
│ สต็อคสินค้าปัจจุบัน (KPS Inventory)              │
├────────────────────────────────────────────────────┤
│                                                    │
│ Table Columns:                                     │
│ • ลำดับ (No.)                                     │
│ • รายการสินค้า (Item Name)                       │
│ • จำนวนคงเหลือ (Quantity)                        │
│ • มูลค่ารวม (Total Value)                        │
│ • การดำเนินการ (Actions)                        │
│                                                    │
│ ┌────┬─────────────┬────────┬──────────┬─────────┐
│ │No. │รายการสินค้า │จำนวน  │มูลค่า฿   │ ลบ      │
│ ├────┼─────────────┼────────┼──────────┼─────────┤
│ │ 1  │แบตเตอรี่   │ 45     │ 112,500  │ [✕]    │
│ │ 2  │ยางรถ      │ 120    │ 420,000  │ [✕]    │
│ │ 3  │น้ำมันเครื่อง│ 250 L  │ 87,500   │ [✕]    │
│ │ 4  │ล้อ         │ 8      │ 95,000   │ [✕]    │
│ │ รวม│            │        │ 715,000  │        │
│ └────┴─────────────┴────────┴──────────┴─────────┘
│                                                    │
│ Column Logic:                                      │
│                                                    │
│ ยอดคงเหลือ = รับเข้า - จ่ายออก                   │
│                                                    │
│ where:                                             │
│   รับเข้า = sum(quantity) from kps_stock_movements│
│            where movement_type='IN'               │
│   จ่ายออก = sum(quantity) from kps_stock_movements│
│            where movement_type='OUT'              │
│                                                    │
│ มูลค่ารวม = จำนวนคงเหลือ × ต้นทุนเฉลี่ย          │
│                                                    │
│ Actions:                                           │
│ • [✕] Delete: Remove from inventory (soft delete) │
│                                                    │
│ [🖨️ พิมพ์ PDF]  [📥 ดาวน์โหลด Excel]              │
│                                                    │
└────────────────────────────────────────────────────┘
```

---

## 📈 MODULE 4: รายงานสรุป (Reporting System)

### **PAGE: /expenses/reports**

**Navigation Tabs:**

```
| 🔧 รายละเอียดการซ่อม | 📋 ประวัติการซ่อม | 📅 ค่าใช้จ่ายตามวันที่ | 💳 เจ้าหนี้รายเดือน | 📊 สรุปต่อคัน/ร้านค้า |
```

---

### **REPORT 4.1: รายละเอียดการซ่อม (Repair Detail)**

```
┌────────────────────────────────────────────┐
│ รายงานรายละเอียดการซ่อม                   │
├────────────────────────────────────────────┤
│                                            │
│ Filter:                                    │
│ [เลือกวันที่จาก] - [ถึง] [เลือกรถ] [🔍]     │
│                                            │
│ Summary:                                   │
│ • จำนวนครั้งซ่อม: 25 ครั้ง                │
│ • ค่าใช้จ่ายรวม: ฿ 875,000                │
│ • ร้านค้าที่มีการทำรายการ: 8 ร้าน        │
│                                            │
│ Table:                                     │
│ ┌────┬──────┬──────┬────────┬────────┬─────┐
│ │No. │วันที่ │รถ    │รายการ │ค่าใช้จ่าย│ร้าน│
│ ├────┼──────┼──────┼────────┼────────┼─────┤
│ │ 1  │15/5  │ABC-1234│แบต + ซ่อม│13,500│ศูนย์ABC
│ │ 2  │10/5  │DEF-5678│ยาง 4 เส้น│45,000│ร้านยาง
│ │ 3  │08/5  │GHI-9012│น้ำมันเครื่อง│8,500│ปั้มน้ำมัน
│ └────┴──────┴──────┴────────┴────────┴─────┘
│                                            │
│ [🖨️ พิมพ์ PDF]  [📥 ดาวน์โหลด]              │
└────────────────────────────────────────────┘
```

---

### **REPORT 4.2: ประวัติการซ่อมบำรุง (Maintenance History)**

```
┌────────────────────────────────────────────┐
│ รายงานประวัติการซ่อมบำรุง                  │
├────────────────────────────────────────────┤
│                                            │
│ Filter: [เลือกรถ] [เลือกช่วงวันที่]         │
│                                            │
│ Timeline View:                             │
│                                            │
│ 🚗 ABC-1234 (Isuzu FVR)                   │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                            │
│ 📌 2025-05-15 | ไมล์: 245,230 km          │
│    ซ่อมแบตเตอรี่ + ซ่อมห้ามเบรก            │
│    ร้าน: ศูนย์ ABC | ฿13,500              │
│    สัปดาห์ที่ผ่านมา: 1 วัน               │
│                                            │
│ 📌 2025-04-20 | ไมล์: 245,100 km          │
│    เปลี่ยนยาง 4 เส้น                       │
│    ร้าน: ร้านยาง XYZ | ฿45,000            │
│    สัปดาห์ที่ผ่านมา: 25 วัน              │
│                                            │
│ 📌 2025-03-10 | ไมล์: 244,500 km          │
│    ซ่อมคลัตช์ + ตรวจสภาพทั่วไป            │
│    ร้าน: ศูนย์ ABC | ฿28,000              │
│    สัปดาห์ที่ผ่านมา: 66 วัน              │
│                                            │
│ [🖨️ พิมพ์ PDF]  [📥 ดาวน์โหลด]              │
└────────────────────────────────────────────┘
```

---

### **REPORT 4.3: ค่าใช้จ่ายตามช่วงวันที่ (Expense by Date)**

```
┌────────────────────────────────────────────┐
│ รายงานค่าใช้จ่ายตามช่วงวันที่               │
├────────────────────────────────────────────┤
│                                            │
│ Filter: [จากวันที่] - [ถึงวันที่] [รถ]      │
│                                            │
│ Summary:                                   │
│ • รวมค่าใช้จ่ายรถทั้งหมด: ฿ 2,450,000      │
│ • ค่าใช้จ่ายโรงงาน: ฿ 125,000             │
│ • รวมค่าใช้จ่ายทั้งสิ้น: ฿ 2,575,000       │
│                                            │
│ รายละเอียด (By Vehicle):                 │
│ ┌────┬───────┬────────────────────┐
│ │No. │รถ     │ค่าใช้จ่ายรวม        │
│ ├────┼───────┼────────────────────┤
│ │ 1  │ABC-1234│ ฿ 456,000        │
│ │ 2  │DEF-5678│ ฿ 678,000        │
│ │ 3  │GHI-9012│ ฿ 892,000        │
│ │ 4  │โรงงาน │ ฿ 125,000        │
│ │รวม │        │ ฿ 2,575,000      │
│ └────┴───────┴────────────────────┘
│                                            │
│ [🖨️ พิมพ์ PDF]  [📥 ดาวน์โหลด]              │
└────────────────────────────────────────────┘
```

---

### **REPORT 4.4: เจ้าหนี้รายเดือน (Monthly Creditor Statement)**

```
┌────────────────────────────────────────────┐
│ รายงานเจ้าหนี้รายเดือน                     │
├────────────────────────────────────────────┤
│                                            │
│ Filter: [เลือกเดือน/ปี]                    │
│                                            │
│ Summary (May 2568):                        │
│ • ค้างจ่ายรวม: ฿ 250,000                  │
│ • จำนวนร้านค้า: 5 ร้าน                    │
│ • วันครบกำหนดรอ: 3 ราคา (เกิน 30 วัน)  │
│                                            │
│ Table:                                     │
│ ┌───┬──────────┬────────┬─────────┬──────┐
│ │No.│ร้านค้า  │จำนวนเงิน│วันที่หมด│สถานะ │
│ ├───┼──────────┼────────┼─────────┼──────┤
│ │1  │ศูนย์ ABC │ ฿50,000 │20/5    │🔴 เกิน│
│ │2  │ร้านอะไหล่│฿80,000 │25/5    │🔴 เกิน│
│ │3  │ปั้มน้ำมัน│฿45,000 │30/5    │🟡 ใกล้│
│ │4  │ร้านค้า XY│฿75,000 │10/6    │🟢 OK  │
│ │รวม│          │฿250,000│        │      │
│ └───┴──────────┴────────┴─────────┴──────┘
│                                            │
│ [🖨️ พิมพ์ PDF]  [📥 ดาวน์โหลด]              │
└────────────────────────────────────────────┘
```

---

### **REPORT 4.5: PIVOT TABLE - สรุปต่อคัน/ร้านค้า (Vehicle x Vendor)**

```
┌──────────────────────────────────────────────────────────────────┐
│ รายงานสรุปค่าใช้จ่ายต่อคัน/คู่ค้า                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Filter: [วันที่จาก] - [ถึง]  [🔍 ค้นหา]                          │
│                                                                  │
│ Print Mode: A4 Landscape (แนวนอน)                              │
│                                                                  │
│ PIVOT TABLE:                                                    │
│ ┌────────┬──────────┬──────────┬─────────┬──────────┬──────────┬─────────┐
│ │ รถ     │ศูนย์ ABC │ร้านอะไหล่│ร้านค้า │ปั้มน้ำมัน│โรงงาน    │รวมต่อคัน│
│ ├────────┼──────────┼──────────┼─────────┼──────────┼──────────┼─────────┤
│ │ABC-1234│ ฿50,000  │ ฿120,000 │ ฿80,000 │ ฿45,000  │ -        │ ฿295,000│
│ │DEF-5678│ ฿75,000  │ ฿150,000 │ ฿110,000│ ฿60,000  │ -        │ ฿395,000│
│ │GHI-9012│ ฿55,000  │ ฿110,000 │ ฿85,000 │ ฿50,000  │ -        │ ฿300,000│
│ │JKL-3456│ ฿45,000  │ ฿100,000 │ ฿75,000 │ ฿40,000  │ -        │ ฿260,000│
│ │โรงงาน  │ -        │ -        │ -      │ -       │ ฿125,000 │ ฿125,000│
│ ├────────┼──────────┼──────────┼─────────┼──────────┼──────────┼─────────┤
│ │รวมต่อร้าน│ ฿225,000│ ฿480,000 │ ฿350,000│ ฿195,000 │ ฿125,000 │ ฿1,375,0│
│ └────────┴──────────┴──────────┴─────────┴──────────┴──────────┴─────────┘
│                                                                  │
│ Features:                                                       │
│ • Rows: ทะเบียนรถทั้งหมด + โรงงาน                              │
│ • Columns: ร้านค้า/ช่างทั้งหมด + รวมต่อคัน                     │
│ • Values: ยอดรวมค่าใช้จ่ายสะสม (Decimal)                       │
│ • Footer: รวมต่อร้าน (Total per Vendor)                         │
│ • Responsive: Horizontal scroll on small screens               │
│ • Print: Scales to fit A4 Landscape                            │
│                                                                  │
│ Sorting/Filtering (Optional):                                  │
│ • Sort by: Vendor, Vehicle, Amount                             │
│ • Filter by: Date range, Vehicle, Vendor                       │
│                                                                  │
│ [🖨️ พิมพ์ PDF (Landscape)]  [📥 ดาวน์โหลด Excel]                 │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Pivot Table Implementation Notes:**

```
Logic Flow:

1. Get all expenses for selected date range:
   SELECT * FROM expenses
   WHERE expense_date BETWEEN start_date AND end_date

2. Get all vehicles + vendors:
   SELECT DISTINCT vehicle_id FROM expenses
   SELECT DISTINCT vendor_id FROM expenses

3. Create matrix:
   For each vehicle:
     For each vendor:
       Sum(amount) where vehicle_id AND vendor_id

4. Calculate totals:
   Row total (per vehicle) = SUM across all vendors
   Column total (per vendor) = SUM across all vehicles

5. Display:
   • Responsive grid on screen (with horizontal scroll)
   • Scale to A4 Landscape on print
   • Freeze first column (Vehicle names) on scroll
```

---

## 👥 MODULE 5: ทะเบียนช่าง (Vendor/Source Management)

### **PAGE: /expenses/vendors**

```
┌─────────────────────────────────────────────────┐
│ ทะเบียนร้านค้า/ช่าง                             │
├─────────────────────────────────────────────────┤
│                                                 │
│ [➕ เพิ่มร้านค้า/ช่างใหม่]                      │
│                                                 │
│ Table:                                          │
│ ┌───┬──────────┬──────┬──────┬────────┬────────┐
│ │No.│ชื่อร้าน │ประเภท│เลขผู้ท│เบอร์โทร│ดำเนินการ
│ ├───┼──────────┼──────┼──────┼────────┼────────┤
│ │1  │ศูนย์ ABC│ช่าง  │1234567│08-1234-│[✏️][🗑️]
│ │2  │ร้านอะไหล่│อะไหล่│3456789│08-2345-│[✏️][🗑️]
│ │3  │ปั้มน้ำมัน│ร้าน  │-     │08-3456-│[✏️][🗑️]
│ │4  │โรงงาน   │ระบบ  │-     │-      │[-]   │
│ └───┴──────────┴──────┴──────┴────────┴────────┘
│                                                 │
│ Form (Add/Edit Modal):                          │
│ ┌────────────────────────────────────────────┐ │
│ │ ข้อมูลร้านค้า/ช่าง                          │ │
│ │                                            │ │
│ │ 1. ชื่อร้านค้า/ช่าง * (Text)               │ │
│ │    [ศูนย์ซ่อม ABC]                          │ │
│ │                                            │ │
│ │ 2. ประเภท * (Radio/Dropdown)               │ │
│ │    ○ ช่างภายนอก                           │ │
│ │    ○ ร้านอะไหล่                           │ │
│ │    ○ ร้านค้าทั่วไป                        │ │
│ │                                            │ │
│ │ 3. ที่อยู่ (Textarea)                       │ │
│ │    [เลขที่, ถ., อ., จ., รหัสไปรษณีย์]     │ │
│ │                                            │ │
│ │ 4. เลขประจำตัวผู้เสียภาษี (Text)           │ │
│ │    [1234567890123]                         │ │
│ │                                            │ │
│ │ 5. เบอร์โทร (Phone)                         │ │
│ │    [08-XXXX-XXXX]                          │ │
│ │                                            │ │
│ │ 6. ชื่อธนาคาร (Dropdown)                   │ │
│ │    [ธนาคารไทยพาณิชย์]                     │ │
│ │                                            │ │
│ │ 7. เลขที่บัญชี (Text)                       │ │
│ │    [X-XXX-XXX-XXX-X]                       │ │
│ │                                            │ │
│ │ 8. ชื่อบัญชี (Text)                         │ │
│ │    [ชื่อเจ้าของร้าน]                       │ │
│ │                                            │ │
│ │ [✅ บันทึก]  [❌ ยกเลิก]                     │ │
│ └────────────────────────────────────────────┘ │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 🖨️ PRINT SYSTEM (Global Rule)

### **Print Requirement:**

**ทุกหน้า "สรุป/รายงาน" ต้องมีปุ่ม: [🖨️ พิมพ์รายงาน (PDF)]**

```
Print Specifications:

1. รายงานสรุปค่าใช้จ่ายต่อคัน/คู่ค้า (Pivot Table):
   └─ Format: A4 Landscape ONLY
   └─ Reason: Show all vendors horizontally
   └─ Scale: Fit to page

2. สต็อคคลังKPS:
   └─ Format: A4 Portrait
   └─ Scale: Fit to page

3. ALL Other Reports:
   └─ Format: A4 Portrait (default)
   └─ Scale: Fit to page

CSS Print Rules:
```javascript
@media print {
  /* Hide non-printable elements */
  .sidebar { display: none !important; }
  .navbar { display: none !important; }
  .filter-panel { display: none !important; }
  .buttons { display: none !important; }
  .form-inputs { display: none !important; }
  
  /* Show only header + table/data */
  body { background: white; }
  .report-container { width: 100%; }
  
  /* Landscape for pivot table */
  .pivot-table { margin: landscape; }
  
  /* Table styling */
  table { 
    width: 100%; 
    border-collapse: collapse;
    page-break-inside: avoid;
  }
  
  th, td { 
    border: 1px solid #ccc; 
    padding: 8px;
  }
}

@page {
  size: A4;
  margin: 15mm;
}

@page.landscape {
  size: A4 landscape;
}
```

---

## 🔄 DATA SYNCHRONIZATION RULES

### **Sync Rule 1: Stock Deduction**

```
TRIGGER: When expense saved with vendor_type = "KPS_WAREHOUSE"

FOR EACH line_item in expense_line_items:
  IF item found in kps_stock:
    1. Deduct qty from kps_stock.quantity_in_stock
    2. Create kps_stock_movements record (type=OUT)
    3. Set line_item.stock_deducted = TRUE
    4. Set line_item.stock_deduction_id = movement_id
  ELSE:
    → Show error: "Item not found in KPS stock"

Update kps_stock.total_value = quantity_in_stock × unit_cost
```

### **Sync Rule 2: Accounts Payable**

```
TRIGGER: When expense saved with payment_status = "UNPAID"

1. Check if accounts_payable record exists for this vendor
   → If YES: Update existing record
   → If NO: Create new record

2. Insert/Update into accounts_payable:
   - expense_id = current expense
   - vendor_id = selected vendor
   - amount = total_amount from expense
   - due_date = user input
   - status = UNPAID

3. If vendor has multiple unpaid expenses:
   → Pivot table shows sum of all UNPAID amounts
```

### **Sync Rule 3: P&L Impact**

```
Expense affects:
• Vehicle Cost Tracking: expenses.vehicle_id
• Vendor Analysis: expenses.vendor_id
• Monthly Reports: expenses.expense_date
• Profit Calculation: Finance module uses expenses data
```

---

## 💻 REACT COMPONENT STRUCTURE

```
App/
├── pages/
│   └── Expenses/
│       ├── ExpenseRecording.jsx (Module 1)
│       ├── FinancialStatus.jsx (Module 2)
│       ├── KpsStock.jsx (Module 3)
│       ├── Reports/
│       │   ├── RepairDetail.jsx
│       │   ├── MaintenanceHistory.jsx
│       │   ├── ExpenseByDate.jsx
│       │   ├── MonthlyCreditora.jsx
│       │   └── PivotTable.jsx (Module 4)
│       └── VendorManagement.jsx (Module 5)
│
├── components/
│   ├── ExpenseForm.jsx
│   ├── LineItemsGrid.jsx (Dynamic Table)
│   ├── StockAddForm.jsx
│   ├── StockTable.jsx
│   ├── PivotTable.jsx
│   └── PrintButton.jsx
│
├── hooks/
│   ├── useExpense.js
│   ├── useStock.js
│   ├── useVendor.js
│   └── usePrint.js
│
├── services/
│   ├── expenseService.js
│   ├── stockService.js
│   ├── vendorService.js
│   └── reportService.js
│
└── utils/
    ├── calculations.js
    ├── formatting.js
    ├── validation.js
    └── printUtils.js
```

---

## 🔍 VALIDATION RULES

### **Expense Validation:**

```
1. Header validation:
   - vehicle_id: Required
   - expense_date: Required, ≤ today
   - vendor_id: Required
   - odometer: Optional but if filled, must be > 0

2. Line items validation:
   - At least 1 line item required
   - item_name: Required
   - qty: Required, > 0
   - unit_price: Required, ≥ 0

3. Stock deduction validation (if vendor = KPS_WAREHOUSE):
   - Check kps_stock.quantity_in_stock ≥ qty
   - If insufficient: Show error "Stock not enough"

4. Payment status validation:
   - If UNPAID: due_date is required
   - due_date must be ≥ expense_date
```

---

## 📌 KEY IMPLEMENTATION NOTES

```
1. LineItemsGrid (Dynamic Table):
   - Use react-table or custom implementation
   - In-place editing with validation
   - Real-time sum calculation
   - Add/Delete row functionality

2. Pivot Table:
   - Create matrix structure from expenses data
   - Support multiple filters (date range, vehicle, vendor)
   - Responsive on screen, Landscape on print
   - Freeze first column for better UX

3. Stock Management:
   - Track IN/OUT movements separately
   - Calculate balance = sum(IN) - sum(OUT)
   - Prevent negative stock (validation)

4. Print System:
   - Use CSS @media print
   - Hide UI elements
   - Scale tables to fit paper
   - Include header with date/user info

5. Sync Logic:
   - Use Transactions for data consistency
   - Check all validations before saving
   - Rollback on error
   - Log all changes for audit trail
```

---

**END OF EXPENSE MANAGEMENT SYSTEM PRD ANALYSIS**

**Version:** 1.0  
**Date:** May 2025 (BE 2568)  
**Ready for Implementation**
