# KPS Transportation ERP
## Enhanced Multi-Leg Journey System with Intermediate Fuel Refill

---

## 🔄 ความเข้าใจที่ถูกต้อง (CORRECTED)

### **ปัญหาเดิม:**
```
เติมเต็มถังที่โรงงาน (500 L) → วิ่ง → เติมเต็มถังที่โรงงาน (280 L)
❌ ผิด: 500 - 280 = 220 L ใช้ไป (ไม่คำนึงถึงเติมปั้มนอก)
```

### **ความเข้าใจที่ถูกต้อง:**
```
"เติมเต็มถังที่โรงงานครั้งที่ 1" = เปิดรอบน้ำมัน (Round 1)
  ↓
วิ่งและเติมเต็มถังที่โรงงานครั้งที่ 2" = ปิดรอบน้ำมัน (Round 1)
  ✓ น้ำมันที่ใช้ = ปริมาณที่ต้องเติมที่เติมครั้งที่ 2 เพื่อให้เต็ม
  ✓ จำนวนนี้ = การบอกวิ่งไปเท่าไร
  
แต่ในระหว่าง:
  + เติมปั้มนอก (200 L @ 35 บาท/L = 7,000 บาท) ← ใส่ expense
  = น้ำมันทั้งหมด = ปิดรอบ + เติมปั้มนอก
```

---

## 📊 REVISED DATA MODEL

### **ตัวอย่างจริง:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
JOURNEY JRN-20250515-001
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏰ 08:00 AM: เติมเต็มถังที่โรงงาน
    Fuel Level: 500 L (Full tank, start round)
    
    🚗 LEG-001: โรงงาน → ลูกค้า A (150 km)
       Fuel consumed from tank: 30 L
       
    🚗 LEG-002: ลูกค้า A → ลูกค้า B (80 km)
       Fuel consumed from tank: 16 L
       
⏰ 14:00: เติมปั้มนอก (INTERMEDIATE REFILL)
    Refill at: ปั้มน้ำมัน "ชลบุรี"
    Amount: 200 L
    Cost: 7,000 บาท (200 × 35 บาท/L)
    Tank level after: 500 - 46 + 200 = 654 L
       ⚠️ แต่ถังรถไม่เกิน 500 L ← PROBLEM!
    
    ✓ ทำการแก้ไข:
      - Before refill: 500 - 46 = 454 L
      - Add refill: 200 L
      - After refill: 454 + 200 = 654 L (OVER capacity!)
      
    🔧 Logic ที่ถูก:
      - Before refill: 454 L
      - Tank capacity: 500 L
      - Can add: 500 - 454 = 46 L (ถึงเต็ม)
      - Refill requested: 200 L
      - Actual refill: 46 L (เพื่อให้เต็มถัง)
      - Over amount: 200 - 46 = 154 L (นับเป็น "extra" fuel)
    
    ✓ OR ทำการจดหมายเหตุว่า:
      - "เติมปั้มนอก 200 L" 
      - "ถังรถเต็มแล้ว ไม่สามารถรับเพิ่ม"
      - "จะต้องลดปริมาณหรือเติมอีกคัน"
    
    💡 BEST PRACTICE:
      - เติมจำนวนให้พอเต็มถัง (เช่น 46 L)
      - ไม่เติมมากกว่าความจุถัง
    
    🚗 LEG-003: ลูกค้า B → โรงงาน (180 km)
       Fuel consumed from tank: 36 L
       
⏰ 16:30 PM: เติมเต็มถังที่โรงงาน (ปิดรอบ)
    Current level before refill: 454 + 200 - 36 = 618 L ← STILL OVER!
    
    ✓ Logic ที่ถูก:
      Tank capacity: 500 L
      Current level: 618 L (ERROR - physically impossible)
      
      → Need to recalculate from start

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 🔧 CORRECTED CALCULATION METHOD

### **วิธี "Fuel Round" (ถูกต้องที่สุด)**

```
ROUND 1 (รอบน้ำมัน):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

08:00 AM - START ROUND:
  Tank filled at: โรงงาน KPS
  Tank level: 500 L (FULL)
  
  ➕ Intermediate refills during this round: 0 (ยังไม่เติมปั้มนอก)
  
  ➖ Fuel consumed:
     LEG-001: 30 L (BKK → Rayong 150 km)
     LEG-002: 16 L (Rayong → Chachoengsao 80 km)
     Total so far: 46 L
     
  Current tank: 500 - 46 = 454 L
  
14:00 PM - INTERMEDIATE REFILL (ระหว่างรอบ):
  Location: ปั้มน้ำมัน Chachoengsao
  Refill amount: 46 L (จนเต็มถัง 500 L)
  Cost: 46 × 35 = 1,610 บาท ← Add to fuel expense
  
  Current tank: 454 + 46 = 500 L (FULL again)
  
  ➖ Fuel consumed:
     LEG-003: 36 L (Chachoengsao → BKK 180 km)
     Total fuel consumed in this round: 46 + 46 + 36 = 128 L
     
  Current tank: 500 - 36 = 464 L
  
16:30 PM - END ROUND:
  Tank filled at: โรงงาน KPS
  To fill amount: 500 - 464 = 36 L
  Cost: 36 × 35 = 1,260 บาท
  
  Total fuel used in ROUND 1:
    = Start full (500 L) 
    - End full (500 L) 
    + Intermediate refill (46 L)
    = 500 - 500 + 46
    = 46 L
    
  ⚠️ สูตรที่ถูก:
    Fuel consumed = Σ(all refills during round)
    
    ROUND 1:
      ✓ Refill at Chachoengsao: 46 L
      ✓ Total consumed: 46 L
      
    Distance: 150 + 80 + 180 = 410 km
    Efficiency: 410 / 46 = 8.91 km/L ← Great!
    
    Fuel cost: 
      Intermediate refill: 46 × 35 = 1,610 ฿
      End refill: 36 × 35 = 1,260 ฿
      Total: 2,870 ฿

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 📋 DATABASE SCHEMA (REVISED)

### **TABLE: fuel_rounds**
```sql
CREATE TABLE fuel_rounds (
  round_id VARCHAR(20) PRIMARY KEY,
  vehicle_id VARCHAR(20) NOT NULL,
  journey_id VARCHAR(20),
  
  -- Round start
  start_datetime DATETIME NOT NULL,
  start_location VARCHAR(200),  -- โรงงาน KPS
  start_fuel_liters INT NOT NULL,  -- filled full (500 L)
  
  -- Round end
  end_datetime DATETIME,
  end_location VARCHAR(200),  -- โรงงาน KPS
  end_fuel_liters INT,  -- filled full again (500 L)
  
  -- Intermediate refills during round
  total_intermediate_refills INT DEFAULT 0,  -- liters
  
  -- Calculated
  fuel_consumed INT,  -- = start + all_refills - end
  total_distance_km INT,
  fuel_efficiency_km_per_l DECIMAL(5,2),
  
  round_status ENUM('OPEN', 'CLOSED') DEFAULT 'OPEN',
  
  created_at DATETIME,
  updated_at DATETIME,
  
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id),
  FOREIGN KEY (journey_id) REFERENCES journeys(journey_id)
);
```

### **TABLE: fuel_refills**
```sql
CREATE TABLE fuel_refills (
  refill_id VARCHAR(20) PRIMARY KEY,
  round_id VARCHAR(20) NOT NULL,
  
  refill_type ENUM('START_FULL', 'INTERMEDIATE', 'END_FULL') NOT NULL,
  -- START_FULL: เติมเต็มตอนเปิดรอบ (500 L)
  -- INTERMEDIATE: เติมปั้มนอก (200 L, 100 L, etc.)
  -- END_FULL: เติมเต็มตอนปิดรอบ (350 L, etc.)
  
  refill_datetime DATETIME NOT NULL,
  refill_location VARCHAR(200),  -- โรงงาน / ปั้มชลบุรี
  refill_amount_liters INT NOT NULL,  -- จำนวนลิตรที่เติม
  
  -- Cost (สำหรับ intermediate refills)
  fuel_price_per_liter DECIMAL(6,2),  -- 35 บาท/ล (เขตชลบุรี อาจต่างกัน)
  refill_cost DECIMAL(10,2),  -- refill_amount × fuel_price
  
  -- Details
  odometer_mileage INT,  -- เลขไมล์ตอนเติม (optional)
  notes TEXT,
  
  created_at DATETIME,
  
  FOREIGN KEY (round_id) REFERENCES fuel_rounds(round_id)
);
```

### **TABLE: journey_legs** (SAME AS BEFORE)
```sql
-- ไม่เปลี่ยน
CREATE TABLE journey_legs (
  leg_id VARCHAR(20) PRIMARY KEY,
  journey_id VARCHAR(20) NOT NULL,
  round_id VARCHAR(20),  -- เชื่อมโยง fuel round
  
  leg_sequence INT NOT NULL,
  trip_type ENUM('OUTBOUND', 'BACKHAUL', 'RETURN') NOT NULL,
  customer_id VARCHAR(20),
  
  origin_location VARCHAR(200) NOT NULL,
  destination_location VARCHAR(200) NOT NULL,
  distance_km INT NOT NULL,
  
  weight_in_kg INT,
  weight_out_kg INT,
  
  freight_rate_per_unit DECIMAL(10,2),
  freight_calculation_type ENUM('PER_TON', 'PER_KG', 'FLAT_RATE'),
  freight_revenue DECIMAL(12,2),
  
  leg_status ENUM('PLANNED', 'IN_PROGRESS', 'COMPLETED') DEFAULT 'PLANNED',
  
  created_at DATETIME,
  
  FOREIGN KEY (journey_id) REFERENCES journeys(journey_id),
  FOREIGN KEY (round_id) REFERENCES fuel_rounds(round_id),
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);
```

---

## 🎯 REVISED UI FLOW

### **STEP 1: Open Fuel Round (เปิดรอบน้ำมัน)**

**Page: /fuel/open-round**

```
Title: "เปิดรอบน้ำมัน"

┌──────────────────────────────────────────────┐
│ 📋 เปิดรอบน้ำมันใหม่                         │
├──────────────────────────────────────────────┤
│ 1. เลือกรถ: [ABC-1234] ✓                     │
│ 2. เติมเต็มถังที่โรงงาน                      │
│    เลขไมล์: [245000] km                      │
│    ปริมาณเติม: [500] L                       │
│    ราคา/ลิตร: [35] บาท/L (configurable)     │
│    ต้นทุน: 17,500 บาท (auto-calc)            │
│    เวลาเติม: 2025-05-15 08:00                │
│                                              │
│ [✅ เปิดรอบน้ำมัน]  [❌ ยกเลิก]               │
└──────────────────────────────────────────────┘

System creates:
  ✓ round_id: RUND-20250515-001
  ✓ status: OPEN
  ✓ fuel_refills[0]: START_FULL (500 L, 17,500 ฿)
  ✓ Display: "✅ เปิดรอบน้ำมัน RUND-20250515-001"
```

---

### **STEP 2: Add Journey & Legs (วิ่ง)**

**Page: /dispatch/open-journey**

```
Title: "เพิ่มงานขนส่ง (สำหรับรอบ RUND-20250515-001)"

ดำเนินการเหมือนเดิม แต่เพิ่มฟิลด์:
  ✓ round_id: RUND-20250515-001 (auto-filled)
  ✓ ปัจจุบันอยู่ใน round นี้
  
ความประโยชน์:
  - ประเมิน intermediate refills ระหว่างเลก
  - รู้ว่า leg ไหนใช้น้ำมันเท่าไร
```

---

### **STEP 3: Intermediate Fuel Refill (เติมปั้มนอก)**

**Page: /fuel/refill-intermediate**

```
Title: "เติมน้ำมันปั้มนอก (รอบ RUND-20250515-001)"

┌──────────────────────────────────────────────┐
│ ⛽ บันทึกการเติมน้ำมัน                       │
├──────────────────────────────────────────────┤
│ 1. รอบน้ำมัน: RUND-20250515-001 ✓            │
│ 2. ตำแหน่งเติม: [Pump Chachoengsao]          │
│ 3. เลขไมล์ตอนเติม: [245230] km               │
│ 4. ปริมาณเติม: [200] L                       │
│    ❌ Error: Tank capacity 500 L (now 454 L) │
│    ⚠️ Can only add: 46 L to fill up           │
│ 5. ปริมาณเติมจริง: [46] L (auto-correct)     │
│ 6. ราคา/ลิตร: [35] บาท/L (Chachoengsao)     │
│ 7. ต้นทุน: 1,610 บาท (46 × 35, auto-calc)   │
│ 8. เวลาเติม: 2025-05-15 14:00                │
│                                              │
│ 💡 หมายเหตุ:                                 │
│    "ต้องการเติม 200 L แต่ถังจุได้แค่ 46 L"  │
│    "ส่วนเหลือ 154 L ต้องอื่นๆ"               │
│                                              │
│ [✅ บันทึก]  [❌ ยกเลิก]                      │
└──────────────────────────────────────────────┘

System creates:
  ✓ refill_id: REF-20250515-001
  ✓ refill_type: INTERMEDIATE
  ✓ refill_amount_liters: 46
  ✓ refill_cost: 1,610 ฿
  ✓ Add to journey_expenses
  ✓ Update round: total_intermediate_refills += 46
```

---

### **STEP 4: Close Fuel Round (ปิดรอบ)**

**Page: /fuel/close-round**

```
Title: "ปิดรอบน้ำมัน (RUND-20250515-001)"

┌──────────────────────────────────────────────┐
│ 🛑 ปิดรอบน้ำมัน                             │
├──────────────────────────────────────────────┤
│ 1. รอบน้ำมัน: RUND-20250515-001 ✓            │
│ 2. เติมเต็มถังที่โรงงาน                      │
│    เลขไมล์: [248410] km                      │
│    ปริมาณเติม: [36] L (จนเต็ม 500 L)        │
│    ต้นทุน: 1,260 บาท (36 × 35)              │
│    เวลาเติม: 2025-05-15 16:30                │
│                                              │
│ [✅ ปิดรอบน้ำมัน]  [❌ ยกเลิก]                │
└──────────────────────────────────────────────┘

System calculates:
  ✓ refill_id: REF-20250515-002
  ✓ refill_type: END_FULL
  ✓ refill_amount_liters: 36
  ✓ refill_cost: 1,260 ฿
  
  ✓ SUMMARY CALCULATION:
    start_fuel: 500 L (full)
    intermediate_refills: 46 L
    end_fuel: 500 L (full again)
    
    fuel_consumed = 500 + 46 - 500 = 46 L ✓
    
    total_distance: 410 km
    fuel_efficiency: 410 / 46 = 8.91 km/L ✓
    
    fuel_costs:
      - START: 500 × 35 = 17,500 ฿
      - INTERMEDIATE: 46 × 35 = 1,610 ฿
      - END: 36 × 35 = 1,260 ฿
      - TOTAL: 20,370 ฿
      
    ⚠️ Note: START ต้องคิดเป็น "previous round closing"
            ไม่คิดซ้ำในรอบนี้
    
    fuel_cost_for_this_round = INTERMEDIATE + END
                             = 1,610 + 1,260
                             = 2,870 ฿ ✓

System updates:
  ✓ round_status: CLOSED
  ✓ Display summary
```

---

## 🧮 CALCULATION LOGIC (CORRECTED)

### **Function: Calculate Fuel Consumed in Round**

```javascript
async function calculateFuelConsumedInRound(roundId) {
  const round = await db.fuel_rounds.findById(roundId);
  const refills = await db.fuel_refills.find({ round_id: roundId });
  
  // Sort refills by timestamp
  const sortedRefills = refills.sort((a, b) => 
    new Date(a.refill_datetime) - new Date(b.refill_datetime)
  );
  
  // Validate round structure
  if (sortedRefills[0]?.refill_type !== 'START_FULL') {
    throw new Error('Round must start with START_FULL refill');
  }
  if (sortedRefills[sortedRefills.length - 1]?.refill_type !== 'END_FULL') {
    throw new Error('Round must end with END_FULL refill');
  }
  
  // Calculate
  const startFuel = sortedRefills[0].refill_amount_liters;  // 500 L
  const endFuel = sortedRefills[sortedRefills.length - 1].refill_amount_liters;  // 36 L
  
  // Sum all intermediate refills (excluding start and end)
  const intermediateRefills = sortedRefills
    .filter(r => r.refill_type === 'INTERMEDIATE')
    .reduce((sum, r) => sum + r.refill_amount_liters, 0);
  
  // CORRECT FORMULA
  const fuelConsumed = startFuel + intermediateRefills - endFuel;
  // = 500 + 46 - 500 = 46 L ✓
  
  return {
    start_fuel: startFuel,
    intermediate_refills: intermediateRefills,
    end_fuel: endFuel,
    fuel_consumed: fuelConsumed,
    refill_count: sortedRefills.length
  };
}
```

### **Function: Calculate Fuel Cost in Round**

```javascript
async function calculateFuelCostInRound(roundId) {
  const refills = await db.fuel_refills.find({ 
    round_id: roundId,
    refill_type: ['INTERMEDIATE', 'END_FULL']  // Exclude START_FULL
  });
  
  // Sum all refill costs
  const totalFuelCost = refills.reduce((sum, r) => 
    sum + r.refill_cost, 0
  );
  
  // Breakdown
  const intermediateCost = refills
    .filter(r => r.refill_type === 'INTERMEDIATE')
    .reduce((sum, r) => sum + r.refill_cost, 0);
  
  const endFillCost = refills
    .filter(r => r.refill_type === 'END_FULL')
    .reduce((sum, r) => sum + r.refill_cost, 0);
  
  return {
    intermediate_cost: intermediateCost,  // 1,610 ฿
    end_fill_cost: endFillCost,           // 1,260 ฿
    total_fuel_cost: totalFuelCost         // 2,870 ฿
  };
}
```

### **Function: Calculate Round Efficiency**

```javascript
async function calculateRoundEfficiency(roundId) {
  const round = await db.fuel_rounds.findById(roundId);
  const legs = await db.journey_legs.find({ round_id: roundId });
  const fuelData = await calculateFuelConsumedInRound(roundId);
  
  // Total distance from all legs
  const totalDistance = legs.reduce((sum, leg) => 
    sum + leg.distance_km, 0
  );
  
  // Fuel efficiency
  const fuelEfficiency = totalDistance / fuelData.fuel_consumed;
  
  // Calculate revenue & profit
  const totalRevenue = legs.reduce((sum, leg) => 
    sum + leg.freight_revenue, 0
  );
  
  const expenses = await calculateFuelCostInRound(roundId);
  const otherExpenses = await db.journey_expenses.find({ 
    round_id: roundId 
  }).reduce((sum, exp) => sum + exp.amount, 0);
  
  const totalExpenses = expenses.total_fuel_cost + otherExpenses;
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = (netProfit / totalRevenue) * 100;
  
  return {
    round_id: roundId,
    distance: {
      total_km: totalDistance,
      legs_count: legs.length
    },
    fuel: {
      consumed_liters: fuelData.fuel_consumed,
      efficiency_km_per_l: fuelEfficiency.toFixed(2),
      intermediate_refills: fuelData.intermediate_refills
    },
    financial: {
      revenue: totalRevenue,
      expenses: {
        fuel: expenses.total_fuel_cost,
        other: otherExpenses,
        total: totalExpenses
      },
      net_profit: netProfit,
      profit_margin_percent: profitMargin.toFixed(1)
    }
  };
}
```

---

## 📊 REPORTING

### **Fuel Round Summary Page (/fuel/rounds/:id)**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        รอบน้ำมัน RUND-20250515-001
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚗 ข้อมูลรอบ:
   วันที่: 2025-05-15
   รถ: ABC-1234 (Isuzu FVR)
   สถานะ: ✅ CLOSED

⏰ เวลา:
   เปิดรอบ: 08:00 (245,000 km)
   ปิดรอบ: 16:30 (248,410 km)
   ระยะเวลา: 8.5 ชั่วโมง

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⛽ รายละเอียดน้ำมัน:

   Refill 1 (Start Round):
      📍 โรงงาน KPS
      ⏰ 08:00
      🛢️ 500 L (FULL)
      💰 500 × 35 = 17,500 ฿ (ไม่นับในรอบนี้)

   Refill 2 (Intermediate):
      📍 ปั้มน้ำมัน Chachoengsao
      ⏰ 14:00
      🛢️ 46 L
      💰 46 × 35 = 1,610 ฿ ✓

   Refill 3 (End Round):
      📍 โรงงาน KPS
      ⏰ 16:30
      🛢️ 36 L (จนเต็มถัง)
      💰 36 × 35 = 1,260 ฿ ✓

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 สรุปน้ำมัน:

   ✓ เติมเริ่มต้น: 500 L
   ➕ เติมเพิ่มเติม: 46 L
   ➖ เติมตอนปิด: 36 L (ไม่ได้ใช้จริง)
   ━━━━━━━━━━━━━━━━━━━━━━━
   🎯 ใช้จริงแล้ว: 500 + 46 - 500 = 46 L

   ระยะทางทั้งหมด: 410 km
   ⚡ อัตราประสิทธิ: 410 / 46 = 8.91 km/L

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 ค่าใช้จ่าย:

   ค่าน้ำมัน:
      Intermediate: 1,610 ฿
      End fill: 1,260 ฿
      ┣━━━━━━━━━━━━━━━━━━
      ┗ รวม: 2,870 ฿

   ค่าอื่นๆ:
      ค่าทางด่วน: 0 ฿
      ค่าเบี้ยเลี้ยง: 0 ฿
      ┣━━━━━━━━━━━━━━━━━━
      ┗ รวม: 0 ฿

   💸 ค่าใช้จ่ายทั้งหมด: 2,870 ฿

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 งานขนส่ง (Journey) ในรอบนี้:

   ✓ JRN-20250515-001 (3 Legs):
      • LEG-1: BKK → Rayong (150 km) - 60,000 ฿
      • LEG-2: Rayong → Chachoengsao (80 km) - 30,000 ฿
      • LEG-3: Chachoengsao → BKK (180 km) - 0 ฿
      ┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      ┗ รวมรายได้: 90,000 ฿

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 สรุปกำไร (P&L):

   📈 รายได้: 90,000 ฿
   ➖ ค่าใช้จ่าย: 2,870 ฿
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   💚 กำไรสุทธิ: 87,130 ฿

   📊 อัตรากำไร: 96.8% 🔥

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[🖨️ พิมพ์ PDF]  [📥 ดาวน์โหลด Excel]
```

---

## 🔍 VALIDATION RULES

```javascript
// Validation when adding intermediate refill
const validateIntermediateRefill = (round, requestedAmount) => {
  const errors = [];
  const warnings = [];
  
  // Get current fuel level
  const refills = await db.fuel_refills.find({ 
    round_id: round.round_id,
    refill_datetime: { $lt: new Date() }  // Only past refills
  });
  
  let currentFuelLevel = refills[0]?.refill_amount_liters || 0;
  
  // Subtract fuel consumed in legs so far
  const legsCompleted = await db.journey_legs.find({ 
    round_id: round.round_id,
    leg_status: 'COMPLETED'
  });
  
  const fuelEstimate = legsCompleted.reduce((sum, leg) => {
    const fuelUsed = leg.distance_km / 1.86;  // estimated based on avg
    return sum + fuelUsed;
  }, 0);
  
  currentFuelLevel -= Math.round(fuelEstimate);
  
  // Tank capacity
  const tankCapacity = 500;  // liters
  const canAdd = tankCapacity - currentFuelLevel;
  
  // Validation
  if (requestedAmount > canAdd) {
    warnings.push(
      `⚠️ ต้องการเติม ${requestedAmount}L แต่ถังจุได้แค่ ${canAdd}L` + 
      `\n✓ จะเติมให้เต็ม ${canAdd}L`
    );
    return { isValid: true, warnings, actualAmount: canAdd };
  }
  
  return { isValid: true, warnings: [], actualAmount: requestedAmount };
};
```

---

## 📌 KEY TAKEAWAYS

### **Fuel Round = 1 Complete Cycle**

```
┌─────────────────────────────────────┐
│ ROUND                                │
├─────────────────────────────────────┤
│ ① เติมเต็มที่โรงงาน (500 L)         │
│    ↓                                 │
│ ② วิ่ง LEG-1, LEG-2, LEG-3          │
│    ↓                                 │
│ ③ เติมปั้มนอก (ถ้าจำเป็น) → Expense │
│    ↓                                 │
│ ④ เติมเต็มที่โรงงาน (36 L)          │
│    ↓                                 │
│ 📊 CALCULATE:                        │
│    • Fuel used = 500 + 46 - 500 = 46L
│    • Cost = 1,610 + 1,260 = 2,870฿
│    • Efficiency = 410km / 46L = 8.91 km/L
│    • Profit = 90,000 - 2,870 = 87,130฿
└─────────────────────────────────────┘
```

### **ประโยชน์:**
✅ ชัดเจนว่าใช้น้ำมันเท่าไร  
✅ เติมปั้มนอก = บันทึก expense ได้เลย  
✅ ต้นทุนน้ำมัน = ถูกต้อง 100%  
✅ ประสิทธิภาพ = เทียบได้กับเข่ารถอื่น  
✅ กำไร = แม่นยำและปรับปรุงได้

---

**END OF ENHANCED MULTI-LEG JOURNEY SYSTEM**
