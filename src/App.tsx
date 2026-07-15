import { useState, useEffect } from 'react'
import { useAuth } from './context/AuthContext'
import { canAccessRoute } from './lib/permissions'
import { LoginScreen } from './pages/auth/LoginScreen'
import { ResetPasswordScreen } from './pages/auth/ResetPasswordScreen'
import { Sidebar } from './components/layout/Sidebar'
import { Topbar } from './components/layout/Topbar'
import { UserManagementPage } from './pages/admin/UserManagementPage'
import { ResetDataPage } from './pages/admin/ResetDataPage'
import { ResetHistoryPage } from './pages/admin/ResetHistoryPage'
import { ImportFilePage } from './pages/admin/ImportFilePage'
import { Dashboard } from './pages/dashboard/Dashboard'
import { AlertsTasksPage } from './pages/dashboard/AlertsTasksPage'
import { VehiclesPage } from './pages/vehicles/VehiclesPage'
import { VehicleAdd } from './pages/vehicles/VehicleAdd'
import { VehicleDetail } from './pages/vehicles/VehicleDetail'
import { EmployeesPage } from './pages/employees/EmployeesPage'
import { EmployeeAdd } from './pages/employees/EmployeeAdd'
import { TiresModule } from './pages/tires/TiresModule'
import { FuelModule } from './pages/fuel/FuelModule'
import { DispatchModule } from './pages/dispatch/DispatchModule'
import { DispatchRoundOpen } from './pages/dispatch/DispatchRoundOpen'
import { DispatchRoundDetail } from './pages/dispatch/DispatchRoundDetail'
import { DispatchRoundClose } from './pages/dispatch/DispatchRoundClose'
import { DispatchSummaryReport } from './pages/dispatch/DispatchSummaryReport'
import { DispatchVehicleMonthlyReport } from './pages/dispatch/DispatchVehicleMonthlyReport'
import { DispatchHistory } from './pages/dispatch/DispatchHistory'
import { SubcontractorModule } from './pages/subcontractors/SubcontractorModule'
import { ExpensesModule } from './pages/expenses/ExpensesModule'
import { FinancePL } from './pages/finance/FinancePL'
import { FinanceFixed } from './pages/finance/FinanceFixed'
import { FinanceSummary } from './pages/finance/FinanceSummary'
import { PeriodClosePage } from './pages/finance/PeriodClosePage'
import { MaintenancePage } from './pages/maintenance/MaintenancePage'
import { LocationsPage } from './pages/locations/LocationsPage'
import { CustomerBilling } from './pages/dispatch/CustomerBilling'
import { CompanyBankAccountsPage } from './pages/settings/CompanyBankAccountsPage'
import { SettingsUsers } from './pages/settings/SettingsUsers'
import { SettingsCompany } from './pages/settings/SettingsCompany'

const crumbMap: Record<string, string> = {
  dashboard: 'Dashboard',
  alerts: 'แจ้งเตือน • รออนุมัติ',
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
  'fuel.express': 'ระบบน้ำมัน • คีย์ด่วน',
  'fuel.floating': 'ระบบน้ำมัน • น้ำมันลอย',
  'fuel.report': 'ระบบน้ำมัน • รายงาน',
  'fuel.summary': 'ระบบน้ำมัน • สรุปคลังน้ำมันรวม',
  'fuel.reconcile': 'ระบบน้ำมัน • ตรวจสอบข้อมูล',
  'fuel.prices':    'ระบบน้ำมัน • ราคาน้ำมันรายวัน',
  dispatch: 'งานขนส่ง',
  'dispatch.open': 'งานขนส่ง • เปิดงาน',
  'dispatch.round': 'งานขนส่ง • รายละเอียดรอบ',
  'dispatch.close': 'งานขนส่ง • ปิดงาน',
  'dispatch.fuel': 'งานขนส่ง • รายงานประจำวัน',
  'dispatch.monthly': 'งานขนส่ง • รายงานประจำเดือน',
  'dispatch.vehicleMonthly': 'งานขนส่ง • สรุปรายเที่ยวรายเดือน (ต่อคัน)',
  'dispatch.report': 'งานขนส่ง • รายงานสรุป',
  'dispatch.history': 'งานขนส่ง • ประวัติงาน',
  'dispatch.locations': 'งานขนส่ง • จัดการสถานที่',
  'dispatch.billing': 'งานขนส่ง • สรุป/วางบิลรายลูกค้า',
  'settings.bankAccounts': 'ตั้งค่า • บัญชีธนาคารบริษัท',
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
  maintenance: 'การบำรุงรักษา',
  finance: 'การเงิน • P&L รายคัน',
  'finance.periodClose': 'การเงิน • ปิดงวดบัญชี',
  'settings.users': 'ตั้งค่า • ผู้ใช้งาน',
  'settings.company': 'ตั้งค่า • บริษัท',
  'admin.users': 'จัดการผู้ใช้งาน',
  'admin.reset': 'รีเซตข้อมูล',
  'admin.reset.history': 'ประวัติการรีเซต',
  'admin.import': 'Import File',
}

export default function App() {
  const { legacyUser, logout, isAdmin, loading, recoveryMode } = useAuth()
  const [active, setActive] = useState('dashboard')
  const [subject, setSubject] = useState<unknown>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (legacyUser?.role === 'driver') setActive('dispatch')
  }, [legacyUser?.id])

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', color: 'var(--text-2)', fontSize: 14 }}>
        กำลังโหลด…
      </div>
    )
  }

  if (recoveryMode) return <ResetPasswordScreen />
  if (!legacyUser) return <LoginScreen />

  const handleLogout = () => logout()

  const renderPage = () => {
    if (!canAccessRoute(active, legacyUser.role)) {
      return (
        <div className="page-head">
          <div>
            <h1 className="page-title">ไม่มีสิทธิ์เข้าถึง</h1>
            <div className="page-sub">บัญชีของคุณไม่มีสิทธิ์ดูหน้านี้ — กรุณาติดต่อผู้ดูแลระบบ</div>
          </div>
        </div>
      )
    }
    switch (active) {
      case 'dashboard':
        return <Dashboard user={legacyUser} setActive={setActive} />

      case 'alerts':
        return <AlertsTasksPage user={legacyUser} />

      case 'vehicles':
        return <VehiclesPage setActive={setActive} setSubject={setSubject} user={legacyUser} />
      case 'vehicles.add':
        return <VehicleAdd setActive={setActive} />
      case 'vehicles.detail':
        return <VehicleDetail setActive={setActive} subject={subject} user={legacyUser} />
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
      case 'fuel.express':
        return <FuelModule tab="express" setActive={setActive} />
      case 'fuel.floating':
        return <FuelModule tab="floating" setActive={setActive} />
      case 'fuel.report':
        return <FuelModule tab="report" setActive={setActive} />
      case 'fuel.summary':
        return <FuelModule tab="summary" setActive={setActive} />
      case 'fuel.reconcile':
        return <FuelModule tab="reconcile" setActive={setActive} />
      case 'fuel.prices':
        return <FuelModule tab="prices" setActive={setActive} />

      case 'dispatch':
      case 'dispatch.open':
        return <DispatchRoundOpen setActive={setActive} setSubject={setSubject} user={legacyUser} />
      case 'dispatch.round':
        return <DispatchRoundDetail setActive={setActive} setSubject={setSubject} subject={subject} />
      case 'dispatch.close':
        return <DispatchRoundClose setActive={setActive} setSubject={setSubject} subject={subject} />
      case 'dispatch.fuel':
        return <DispatchModule tab="fuel" setActive={setActive} user={legacyUser} />
      case 'dispatch.monthly':
        return <DispatchModule tab="monthly" setActive={setActive} user={legacyUser} />
      case 'dispatch.report':
        return <DispatchSummaryReport setActive={setActive} setSubject={setSubject} />
      case 'dispatch.vehicleMonthly':
        return <DispatchVehicleMonthlyReport />
      case 'dispatch.history':
        return <DispatchHistory setActive={setActive} setSubject={setSubject} />

      case 'subcontractors':
        return <SubcontractorModule tab="open" setActive={setActive} user={legacyUser} />
      case 'subcontractors.close':
        return <SubcontractorModule tab="close" setActive={setActive} user={legacyUser} />
      case 'subcontractors.history':
      case 'subcontractors.jobs':
        return <SubcontractorModule tab="history" setActive={setActive} user={legacyUser} />
      case 'subcontractors.drivers':
        return <SubcontractorModule tab="drivers" setActive={setActive} user={legacyUser} />

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
      case 'finance.periodClose':
        return <PeriodClosePage />

      case 'maintenance':
        return <MaintenancePage />

      case 'dispatch.locations':
        return <LocationsPage />
      case 'dispatch.billing':
        return <CustomerBilling />

      case 'settings.users':
        return <SettingsUsers />
      case 'settings.company':
        return <SettingsCompany setActive={setActive} />
      case 'settings.bankAccounts':
        return <CompanyBankAccountsPage />

      case 'admin.users':
        return isAdmin ? <UserManagementPage /> : <Dashboard user={legacyUser} setActive={setActive} />
      case 'admin.reset':
        return isAdmin ? <ResetDataPage setActive={setActive} /> : <Dashboard user={legacyUser} setActive={setActive} />
      case 'admin.reset.history':
        return isAdmin ? <ResetHistoryPage setActive={setActive} /> : <Dashboard user={legacyUser} setActive={setActive} />
      case 'admin.import':
        return isAdmin ? <ImportFilePage setActive={setActive} /> : <Dashboard user={legacyUser} setActive={setActive} />

      default:
        return <Dashboard user={legacyUser} setActive={setActive} />
    }
  }

  return (
    <div className={`app ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        active={active}
        setActive={setActive}
        user={legacyUser}
        onLogout={handleLogout}
        closeMobile={() => setMobileOpen(false)}
      />
      {mobileOpen && (
        <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />
      )}
      <div className="main">
        <Topbar
          user={legacyUser}
          crumb={crumbMap[active] ?? 'Dashboard'}
          onLogout={handleLogout}
          onOpenAlerts={() => setActive('alerts')}
          onToggleMobileMenu={() => setMobileOpen(o => !o)}
        />
        <div className="content">{renderPage()}</div>
      </div>
    </div>
  )
}
