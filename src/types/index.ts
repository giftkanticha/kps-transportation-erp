// ─── Shared literal types ───────────────────────────────────────────────────

export type KPSRole = 'admin' | 'manager' | 'driver'
export type TireStatus = 'in-use' | 'spare' | 'stock' | 'sold' | 'scrapped'
export type VehicleStatus = 'available' | 'on-trip' | 'maintenance' | 'warning'

// ─── Domain models ───────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  name: string
  role: KPSRole
  avatar: string
  phone: string
  title: string
}

export interface Employee {
  id: string
  code: string
  name: string
  position: string
  license: string
  licenseStatus: 'ok' | 'warning' | 'expired'
  licenseExpire: string
  lineId: string
  phone: string
  idCard: string
  accountBank: string
  accountNo: string
  joined: string
  salary: number
  vehicleId: string | null
  status: string
  address?: string
}

export interface Vehicle {
  id: string
  plate: string
  type: string
  brand: string
  year: number
  status: VehicleStatus
  driverId: string | null
  odometer: number
  nextServiceKm: number
  fuel: number
  lastService: string
  nextService: string
  purchaseDate: string
  tax: string
  insurance: string
  dispatchPermit: string
  group?: 'INTERNAL' | 'TRANSPORT'
}

export interface Customer {
  id: string
  code: string
  name: string
  contact: string
  phone: string
  credit: number
  totalJobs: number
  openInvoice: number
  status: string
  industry: string
  since: string
  address: string
}

export interface Subcontractor {
  id: string
  code: string
  name: string
  contact: string
  phone: string
  vehicles: number
  rating: number
  openJobs: number
  totalPaid: number
  status: string
}

export interface DispatchLeg {
  origin: string
  destination: string
  cargo: string
  cargoType: string
  priceMode: 'per_ton' | 'per_kg' | 'lump'
  weight: number
  price: number
  amount: number
  id?: string
  customerId?: string
  legType?: 'outbound' | 'backhaul' | 'return'
  deliveredWeight?: number | null
  perDiem?: number
  notes?: string
  closed?: boolean
}

export interface OtherExpense {
  id: string
  label: string
  amount: number
}

export interface Dispatch {
  id: string
  code: string
  customerId: string
  driverId: string | null
  vehicleId: string | null
  subcontractorId: string | null
  date: string
  depart: string
  eta: string
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled'
  progress: number
  startOdometer: number | null
  endOdometer: number | null
  distance: number | null
  liters: number | null
  kmPerL: number | null
  perDiem: number | null
  notes: string
  legs: DispatchLeg[]
  totalAmount: number
  revenue: number
  cost: number
  roundStatus?: 'draft' | 'closed'
  returnAt?: string
  otherExpenses?: OtherExpense[]
}

export interface Maintenance {
  id: string
  code: string
  vehicleId: string
  type: string
  workshop: string
  partnerId: string | null
  status: string
  cost: number
  startDate: string
  endDate: string | null
  odometer: number
  items: string[]
}

export interface Tire {
  id: string
  serial: string
  brand: string
  model: string
  size: string
  vehicleId: string | null
  position: string | null
  installedDate: string
  installedOdometer: number
  accumulatedKm: number
  status: TireStatus
}

export interface TireEvent {
  id: string
  tireId: string
  vehicleId: string
  eventType: 'install' | 'swap' | 'remove' | 'sell' | 'scrap'
  date: string
  odometer: number
  fromPos: string | null
  toPos: string | null
  note: string
  userId: string
}

export interface TireScrapSale {
  id: string
  tireId: string
  serial: string
  buyer: string
  price: number
  date: string
  userId: string
}

export interface FuelRecord {
  id: string
  code: string
  vehicleId: string
  driverId: string
  station: string
  liters: number
  pricePerL: number
  total: number
  odometer: number
  date: string
  type: string
}

export interface FuelRefill {
  id: string
  type: 'start' | 'intermediate' | 'end'
  mileage: number
  liters: number
  pricePerL: number
  cost: number
  location: string
  at: string
  notes?: string
}

export type FuelTransactionStatus = 'INTERNAL_DEDUCTED' | 'TRIP_LINKED' | 'FLOATING' | 'REVERSED'
export type TripFuelRole = 'NORMAL' | 'TRIP_OPENING' | 'INTERMEDIATE' | 'TRIP_CLOSING'
export type FuelEntryMethod = 'EXPRESS_GRID' | 'TRIP_OPEN' | 'TRIP_REFILL' | 'TRIP_CLOSE' | 'MANUAL_ADMIN'

export interface FuelTransaction {
  id: string
  date: string
  vehicleId: string
  liters: number
  pricePerL: number
  total: number
  source: 'FACTORY_TANK' | 'EXTERNAL_PUMP'
  tripId: string | null
  status: FuelTransactionStatus
  tripFuelRole: TripFuelRole
  entryMethod: FuelEntryMethod
  createdAt: string
  reversedAt?: string | null
  reversalOf?: string | null
  note?: string
}

export interface FuelRound {
  id: string
  code: string
  vehicleId: string
  dispatchRoundId?: string | null
  tankCapacity: number
  status: 'open' | 'closed'
  refills: FuelRefill[]
  notes?: string
}

export interface FuelStock {
  id: string
  date: string
  supplier: string
  liters: number
  pricePerL: number
  invoiceNo: string
  total: number
}

export interface Expense {
  id: string
  code: string
  vehicleId: string | null
  category: string
  note: string
  amount: number
  paidBy: string
  date: string
  driverId: string | null
  status: string
  partnerId?: string
}

export interface ExpenseHeader {
  id: string
  code: string
  date: string
  vehicleId: string
  partnerId: string
  odometer: number
  paid: boolean
  dueDate: string
  total: number
  lineCount: number
  note: string
}

export interface ExpenseLine {
  id: string
  headerId: string
  invoiceNo: string
  item: string
  category: string
  qty: number
  unitPrice: number
  amount: number
  note: string
  stockItemId?: string
}

export interface StockReceipt {
  id: string
  date: string
  partnerId: string
  stockItemId: string
  qty: number
  unitPrice: number
  total: number
}

export interface StockItem {
  id: string
  code: string
  name: string
  category: string
  in: number
  out: number
  qty: number
  unit: string
  unitCost: number
  sellPrice?: number
  reorderAt: number
}

export interface FixedCost {
  id: string
  name: string
  category: string
  monthly: number
  paid: boolean
  vehicleId: string | null
}

export interface Partner {
  id: string
  code: string
  name: string
  type: string
  contact: string
  phone: string
  address: string
  bank: string
  account: string
  accountName: string
  taxId: string
  balance: number
  status: string
}

export interface SubDriver {
  id: string
  code: string
  name: string
  plate: string
  phone: string
  idCard: string
  license: string
  licenseExpire: string
  licenseStatus: string
  accountBank: string
  accountNo: string
  status: string
  subId: string
  address?: string
  vehicleTypes?: string[]
  truckDump?: 'dump' | 'no-dump'
  cpAccess?: 'yes' | 'no'
}

export interface SubJob {
  id: string
  code: string
  date: string
  subId: string
  driverId: string
  plate: string
  driverName: string
  category: string
  destination: string
  origin: string
  weight: number
  finalWeight: number
  mode: string
  price: number
  total: number
  status: string
  bank: string
}

export interface ActivityLog {
  id: string
  at: string
  who: string
  text: string
  type: string
}

export interface VehicleChangeField {
  key: string
  label: string
  before: string
  after: string
}

export interface EditApprovalRequest {
  id: string
  requesterId: string
  requesterName: string
  requesterRole: KPSRole
  vehicleId: string
  vehiclePlate: string
  reason: string
  changes: Partial<Vehicle>
  changeFields: VehicleChangeField[]
  requestedAt: string
  status: 'pending' | 'approved' | 'rejected'
  reviewerId: string | null
  reviewerName: string | null
  reviewedAt: string | null
  reviewNote: string
}

export interface TaskCompletion {
  id: string
  alertKind: 'tax' | 'permit' | 'insurance' | 'mileage' | 'repair'
  vehicleId: string
  vehiclePlate: string
  completedAt: string
  userId: string
  nextDate: string
  nextMileage: number | null
  nextMaintenanceDate: string
  note: string
}

// ─── Root app state ──────────────────────────────────────────────────────────

export interface AppState {
  users: User[]
  employees: Employee[]
  vehicles: Vehicle[]
  customers: Customer[]
  subcontractors: Subcontractor[]
  dispatch: Dispatch[]
  maintenance: Maintenance[]
  tires: Tire[]
  tire_events: TireEvent[]
  tire_scrap_sales: TireScrapSale[]
  fuel: FuelRecord[]
  fuelStock: FuelStock[]
  fuelRounds: FuelRound[]
  expenses: Expense[]
  expenseHeaders: ExpenseHeader[]
  expenseLines: ExpenseLine[]
  stockReceipts: StockReceipt[]
  stock: StockItem[]
  fixedCosts: FixedCost[]
  partners: Partner[]
  subDrivers: SubDriver[]
  subJobs: SubJob[]
  fuelTransactions: FuelTransaction[]
  activity: ActivityLog[]
  taskCompletions: TaskCompletion[]
  editApprovals: EditApprovalRequest[]
}
