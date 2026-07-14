import { describe, it, expect } from 'vitest'
import { db } from './db'
import type { Dispatch, DispatchLeg, FuelRound, FuelRefill } from '../types'

function leg(overrides: Partial<DispatchLeg> = {}): DispatchLeg {
  return {
    origin: 'โรงงาน KPS',
    destination: 'ลูกค้า A',
    cargo: 'ปูนซีเมนต์',
    cargoType: 'bulk',
    priceMode: 'lump',
    weight: 0,
    price: 0,
    amount: 0,
    ...overrides,
  }
}

function dispatch(overrides: Partial<Dispatch> = {}): Dispatch {
  return {
    id: 'd1',
    code: 'DSP-20260714-001',
    customerId: null,
    driverId: null,
    vehicleId: null,
    subcontractorId: null,
    date: '2026-07-14',
    depart: '2026-07-14T08:00',
    eta: '2026-07-14T12:00',
    status: 'completed',
    progress: 100,
    startOdometer: null,
    endOdometer: null,
    distance: null,
    liters: null,
    kmPerL: null,
    perDiem: null,
    notes: '',
    legs: [],
    totalAmount: 0,
    revenue: 0,
    cost: 0,
    ...overrides,
  }
}

function refill(overrides: Partial<FuelRefill> = {}): FuelRefill {
  return {
    id: 'f1',
    type: 'start',
    mileage: 0,
    liters: 0,
    pricePerL: 0,
    cost: 0,
    location: '',
    at: '2026-07-14T08:00',
    ...overrides,
  }
}

function fuelRound(overrides: Partial<FuelRound> = {}): FuelRound {
  return {
    id: 'r1',
    code: 'RUND-20260714-001',
    vehicleId: 'v1',
    tankCapacity: 500,
    status: 'closed',
    refills: [],
    ...overrides,
  }
}

describe('leg amount / revenue', () => {
  it('legAmount computes lump sum as-is', () => {
    expect(db.legAmount(leg({ priceMode: 'lump', price: 5000 }))).toBe(5000)
  })

  it('legAmount computes per_ton as weight(ton) * price', () => {
    expect(db.legAmount(leg({ priceMode: 'per_ton', weight: 12, price: 450 }))).toBe(5400)
  })

  it('legAmount computes per_kg as weight(ton) * 1000 * price', () => {
    expect(db.legAmount(leg({ priceMode: 'per_kg', weight: 3, price: 2 }))).toBe(6000)
  })

  it('roundRevenue sums leg amounts', () => {
    const d = dispatch({ legs: [leg({ amount: 3000 }), leg({ amount: 1500 })] })
    expect(db.roundRevenue(d)).toBe(4500)
  })

  it('amountOf falls back to summed leg amounts when totalAmount is not a number', () => {
    const d = { ...dispatch({ legs: [leg({ amount: 2000 }), leg({ amount: 500 })] }), totalAmount: undefined as unknown as number }
    expect(db.amountOf(d)).toBe(2500)
  })

  it('amountOf prefers totalAmount when explicitly set', () => {
    const d = dispatch({ totalAmount: 9999, legs: [leg({ amount: 100 })] })
    expect(db.amountOf(d)).toBe(9999)
  })
})

describe('withholding tax (1%)', () => {
  it('legWht is 0 when the leg is not subject to WHT', () => {
    expect(db.legWht(leg({ amount: 10000, wht: false }))).toBe(0)
  })

  it('legWht is 1% of the leg amount, rounded to satang', () => {
    expect(db.legWht(leg({ amount: 10000, wht: true }))).toBe(100)
    expect(db.legWht(leg({ amount: 333.33, wht: true }))).toBe(3.33)
  })

  it('roundWht sums WHT across legs', () => {
    const d = dispatch({
      legs: [leg({ amount: 10000, wht: true }), leg({ amount: 5000, wht: false })],
    })
    expect(db.roundWht(d)).toBe(100)
  })

  it('roundNetRevenue subtracts WHT from gross revenue', () => {
    const d = dispatch({
      legs: [leg({ amount: 10000, wht: true }), leg({ amount: 5000, wht: false })],
    })
    expect(db.roundNetRevenue(d)).toBe(15000 - 100)
  })
})

describe('per diem / other expenses / distance', () => {
  it('roundPerDiem sums perDiem across legs', () => {
    const d = dispatch({ legs: [leg({ perDiem: 300 }), leg({ perDiem: 200 })] })
    expect(db.roundPerDiem(d)).toBe(500)
  })

  it('roundOtherExpenses sums other-expense amounts', () => {
    const d = dispatch({
      otherExpenses: [
        { id: 'e1', label: 'ทางด่วน', amount: 120 },
        { id: 'e2', label: 'จอดรถ', amount: 50 },
      ],
    })
    expect(db.roundOtherExpenses(d)).toBe(170)
  })

  it('roundDistance is endOdometer - startOdometer, floored at 0', () => {
    expect(db.roundDistance(dispatch({ startOdometer: 1000, endOdometer: 1250 }))).toBe(250)
    expect(db.roundDistance(dispatch({ startOdometer: 1250, endOdometer: 1000 }))).toBe(0)
  })

  it('roundDistance is 0 when either odometer reading is missing', () => {
    expect(db.roundDistance(dispatch({ startOdometer: null, endOdometer: 1000 }))).toBe(0)
  })
})

describe('fuel round calculations', () => {
  it('fuelRoundStartLiters/EndLiters read the start/end refill entries', () => {
    const r = fuelRound({
      refills: [
        refill({ type: 'start', liters: 400 }),
        refill({ type: 'end', liters: 350 }),
      ],
    })
    expect(db.fuelRoundStartLiters(r)).toBe(400)
    expect(db.fuelRoundEndLiters(r)).toBe(350)
  })

  it('fuelRoundIntermediateTotal sums only intermediate refills', () => {
    const r = fuelRound({
      refills: [
        refill({ type: 'start', liters: 400 }),
        refill({ type: 'intermediate', liters: 100 }),
        refill({ type: 'intermediate', liters: 80 }),
        refill({ type: 'end', liters: 300 }),
      ],
    })
    expect(db.fuelRoundIntermediateTotal(r)).toBe(180)
  })

  it('fuelRoundConsumed is 0 for open rounds (unknown until closed)', () => {
    const r = fuelRound({ status: 'open', refills: [refill({ type: 'intermediate', liters: 100 })] })
    expect(db.fuelRoundConsumed(r)).toBe(0)
  })

  it('fuelRoundConsumed is intermediates + end liters once closed', () => {
    const r = fuelRound({
      status: 'closed',
      refills: [
        refill({ type: 'intermediate', liters: 100 }),
        refill({ type: 'end', liters: 50 }),
      ],
    })
    expect(db.fuelRoundConsumed(r)).toBe(150)
  })

  it('fuelRoundCost excludes the opening "start" refill', () => {
    const r = fuelRound({
      refills: [
        refill({ type: 'start', cost: 10000 }),
        refill({ type: 'intermediate', cost: 1500 }),
        refill({ type: 'end', cost: 900 }),
      ],
    })
    expect(db.fuelRoundCost(r)).toBe(2400)
  })

  it('fuelRoundDistance is end mileage - start mileage, floored at 0', () => {
    const r = fuelRound({
      refills: [refill({ type: 'start', mileage: 1000 }), refill({ type: 'end', mileage: 1400 })],
    })
    expect(db.fuelRoundDistance(r)).toBe(400)
  })

  it('fuelRoundEfficiency is distance / consumed liters (km/L)', () => {
    const r = fuelRound({
      status: 'closed',
      refills: [
        refill({ type: 'start', mileage: 1000 }),
        refill({ type: 'end', mileage: 1400, liters: 100 }),
      ],
    })
    expect(db.fuelRoundEfficiency(r)).toBe(4)
  })

  it('fuelRoundEfficiency is null when consumed or distance is 0/unknown', () => {
    const r = fuelRound({ status: 'open' })
    expect(db.fuelRoundEfficiency(r)).toBeNull()
  })
})
