import { useState, useEffect } from 'react'
import { db } from './lib/db'
import type { User } from './types'
import { LoginScreen } from './pages/auth/LoginScreen'
import { Sidebar } from './components/layout/Sidebar'
import { Topbar } from './components/layout/Topbar'
import { Dashboard } from './pages/dashboard/Dashboard'
import { VehiclesPage } from './pages/vehicles/VehiclesPage'
import { VehicleAdd } from './pages/vehicles/VehicleAdd'
import { VehicleDetail } from './pages/vehicles/VehicleDetail'
import { EmployeesPage } from './pages/employees/EmployeesPage'
import { EmployeeAdd } from './pages/employees/EmployeeAdd'
import { TiresModule } from './pages/tires/TiresModule'
import { FuelModule } from './pages/fuel/FuelModule'
import { DispatchModule } from './pages/dispatch/DispatchModule'
import { SubcontractorModule } from './pages/subcontractors/SubcontractorModule'
import { ExpensesModule } from './pages/expenses/ExpensesModule'
import { FinancePL } from './pages/finance/FinancePL'
import { FinanceFixed } from './pages/finance/FinanceFixed'
import { FinanceSummary } from './pages/finance/FinanceSummary'
import { MaintenancePage } from './pages/maintenance/MaintenancePage'
import { CustomersPage } from './pages/customers/CustomersPage'
import { PartnersPage } from './pages/customers/PartnersPage'
import { SettingsUsers } from './pages/settings/SettingsUsers'
import { SettingsCompany } from './pages/settings/SettingsCompany'

const crumbMap: Record<string, string> = {
  dashboard: 'Dashboard',
  vehicles: 'จัดการรถ',
  'vehicles.add': 'เพิ่มรถใหม่',
  'vehicles.detail': 'รายละเอียดรถ',
  employees: 'ข้อมูลพนักงาน',
  'employees.add': 'เพิ่มพนักงานใหม่',
  tires: 'ระบบยาง • รายการทั้งหมด',
  'tires.layout': 'ระบบยาง • ผังยาง',
  'tires.manage': 'ระบบยาง • จัดการ',
  'tires.history': 'ระบบยาง • ประวัติ',
  'tires.scrapped': 'ระบบยาง • ยางหมดสภาพ',
  fuel: 'ระบบน้ำมัน • ภาพรวม',
  'fuel.logs': 'ระบบน้ำมัน • บันทึก',
  'fuel.report': 'ระบบน้ำมัน • รายงาน',
  dispatch: 'งานขนส่ง',
  'dispatch.open': 'งานขนส่ง • เปิดงาน',
  'dispatch.close': 'งานขนส่ง • ปิดงาน',
  'dispatch.report': 'งานขนส่ง • รายงานสรุป',
  'dispatch.history': 'งานขนส่ง • ประวัติงาน',
  subcontractors: 'รถรับจ้างร่วม',
  'subcontractors.close': 'รถรับจ้างร่วม • ปิดงาน',
  'subcontractors.history': 'รถรับจ้างร่วม • ประวัติการจ้าง',
  'subcontractors.drivers': 'รถรับจ้างร่วม • คนขับรถร่วม',
  'subcontractors.jobs': 'งานที่จ้างร่วม',
  expenses: 'ค่าใช้จ่าย',
  'expenses.finance': 'ค่าใช้จ่าย • สถานะการเงิน',
  'expenses.stock': 'สต็อคคลัง KPS',
  'expenses.report': 'ค่าใช้จ่าย • รายงานสรุป',
  'expenses.vendors': 'ทะเบียนร้านค้า/ช่าง',
  customers: 'ลูกค้า',
  partners: 'คู่ค้า / ช่าง',
  maintenance: 'การบำรุงรักษา',
  finance: 'การเงิน • P&L รายคัน',
  'finance.fixed': 'การเงิน • ค่าใช้จ่ายคงที่',
  'finance.summary': 'การเงิน • รายงานสรุป',
  'settings.users': 'ตั้งค่า • ผู้ใช้งาน',
  'settings.company': 'ตั้งค่า • บริษัท',
}

export default function App() {
  const [user, setUser] = useState<User | null>(() => db.currentUser())
  const [active, setActive] = useState('dashboard')
  const [subject, setSubject] = useState<unknown>(null)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (user?.role === 'driver') setActive('dispatch')
  }, [user?.id])

  if (!user) return <LoginScreen onLogin={setUser} />

  const handleLogout = () => {
    db.logout()
    setUser(null)
  }

  const handleReset = () => {
    if (confirm('รีเซ็ตข้อมูลทั้งหมดและกลับไปค่าเริ่มต้น?')) {
      db.reset()
      window.location.reload()
    }
  }

  const renderPage = () => {
    switch (active) {
      case 'dashboard':
        return <Dashboard user={user} setActive={setActive} />

      case 'vehicles':
        return <VehiclesPage setActive={setActive} setSubject={setSubject} />
      case 'vehicles.add':
        return <VehicleAdd setActive={setActive} />
      case 'vehicles.detail':
        return <VehicleDetail setActive={setActive} subject={subject} />

      case 'employees':
        return <EmployeesPage setActive={setActive} setSubject={setSubject} />
      case 'employees.add':
        return <EmployeeAdd setActive={setActive} />

      case 'tires':
        return <TiresModule tab="all" setActive={setActive} />
      case 'tires.layout':
        return <TiresModule tab="layout" setActive={setActive} />
      case 'tires.manage':
        return <TiresModule tab="manage" setActive={setActive} />
      case 'tires.history':
        return <TiresModule tab="history" setActive={setActive} />
      case 'tires.scrapped':
        return <TiresModule tab="scrapped" setActive={setActive} />

      case 'fuel':
        return <FuelModule tab="overview" setActive={setActive} />
      case 'fuel.logs':
        return <FuelModule tab="logs" setActive={setActive} />
      case 'fuel.report':
        return <FuelModule tab="report" setActive={setActive} />

      case 'dispatch':
      case 'dispatch.open':
        return <DispatchModule tab="open" setActive={setActive} user={user} />
      case 'dispatch.close':
        return <DispatchModule tab="close" setActive={setActive} user={user} />
      case 'dispatch.report':
        return <DispatchModule tab="report" setActive={setActive} user={user} />
      case 'dispatch.history':
        return <DispatchModule tab="history" setActive={setActive} user={user} />

      case 'subcontractors':
        return <SubcontractorModule tab="open" setActive={setActive} user={user} />
      case 'subcontractors.close':
        return <SubcontractorModule tab="close" setActive={setActive} user={user} />
      case 'subcontractors.history':
      case 'subcontractors.jobs':
        return <SubcontractorModule tab="history" setActive={setActive} user={user} />
      case 'subcontractors.drivers':
        return <SubcontractorModule tab="drivers" setActive={setActive} user={user} />

      case 'expenses':
        return <ExpensesModule tab="record" setActive={setActive} />
      case 'expenses.finance':
        return <ExpensesModule tab="finance" setActive={setActive} />
      case 'expenses.stock':
        return <ExpensesModule tab="stock" setActive={setActive} />
      case 'expenses.report':
        return <ExpensesModule tab="report" setActive={setActive} />
      case 'expenses.vendors':
        return <ExpensesModule tab="vendors" setActive={setActive} />

      case 'finance':
        return <FinancePL />
      case 'finance.fixed':
        return <FinanceFixed />
      case 'finance.summary':
        return <FinanceSummary />

      case 'maintenance':
        return <MaintenancePage />

      case 'customers':
        return <CustomersPage />
      case 'partners':
        return <PartnersPage />

      case 'settings.users':
        return <SettingsUsers />
      case 'settings.company':
        return <SettingsCompany />

      default:
        return <Dashboard user={user} setActive={setActive} />
    }
  }

  return (
    <div className={`app ${collapsed ? 'collapsed' : ''}`}>
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        active={active}
        setActive={setActive}
        user={user}
        onLogout={handleLogout}
      />
      <div className="main">
        <Topbar
          user={user}
          crumb={crumbMap[active] ?? 'Dashboard'}
          onLogout={handleLogout}
          onReset={handleReset}
        />
        <div className="content">{renderPage()}</div>
      </div>
    </div>
  )
}
