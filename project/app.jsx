// app.jsx — Main router & shell
const { useState: useStateApp, useEffect: useEffectApp } = React;

function App() {
  const D = window.KPSData;
  const [user, setUser] = useStateApp(() => D.currentUser());
  const [active, setActive] = useStateApp("dashboard");
  const [subject, setSubject] = useStateApp(null);
  const [collapsed, setCollapsed] = useStateApp(false);

  useEffectApp(() => {
    // when user logs in, default to driver view if driver
    if (user && user.role === "driver") setActive("dispatch");
  }, [user?.id]);

  if (!user) {
    return <LoginScreen onLogin={(u) => setUser(u)}/>;
  }

  // Driver-specific simplified view
  const isDriver = user.role === "driver";

  // Crumb mapping
  const crumbMap = {
    "dashboard": "Dashboard",
    "vehicles": "จัดการรถ",
    "vehicles.add": "เพิ่มรถใหม่",
    "vehicles.detail": "รายละเอียดรถ",
    "employees": "ข้อมูลพนักงาน",
    "employees.add": "เพิ่มพนักงานใหม่",
    "tires": "ระบบยาง • รายการทั้งหมด",
    "tires.layout": "ระบบยาง • ผังยาง",
    "tires.manage": "ระบบยาง • จัดการ",
    "fuel": "ระบบน้ำมัน • ภาพรวม",
    "fuel.logs": "ระบบน้ำมัน • บันทึก",
    "fuel.report": "ระบบน้ำมัน • รายงาน",
    "dispatch": "งานขนส่ง",
    "dispatch.open": "งานขนส่ง • เปิดงาน",
    "dispatch.close": "งานขนส่ง • ปิดงาน",
    "dispatch.report": "งานขนส่ง • รายงานสรุป",
    "dispatch.history": "งานขนส่ง • ประวัติงาน",
    "subcontractors": "รถรับจ้างร่วม",
    "subcontractors.jobs": "งานที่จ้างร่วม",
    "expenses": "ค่าใช้จ่าย",
    "expenses.stock": "สต็อคคลัง KPS",
    "expenses.vendors": "ทะเบียนช่าง/ผู้ขาย",
    "customers": "ลูกค้า",
    "partners": "คู่ค้า / ช่าง",
    "maintenance": "การบำรุงรักษา",
    "finance": "การเงิน • P&L รายคัน",
    "finance.fixed": "การเงิน • ค่าใช้จ่ายคงที่",
    "finance.summary": "การเงิน • รายงานสรุป",
    "settings.users": "ตั้งค่า • ผู้ใช้งาน",
    "settings.company": "ตั้งค่า • บริษัท",
  };

  // Route table
  const renderPage = () => {
    if (isDriver) return <DriverView user={user}/>;
    switch (active) {
      case "dashboard": return <Dashboard user={user} setActive={setActive}/>;
      case "vehicles": return <VehiclesPage setActive={setActive} setSubject={setSubject}/>;
      case "vehicles.add": return <VehicleAdd setActive={setActive}/>;
      case "vehicles.detail": return <VehicleDetail setActive={setActive} subject={subject}/>;
      case "employees": return <EmployeesPage setActive={setActive} setSubject={setSubject}/>;
      case "employees.add": return <EmployeeAdd setActive={setActive}/>;
      case "tires": return <TiresPage setActive={setActive}/>;
      case "tires.layout": return <TireLayout setActive={setActive}/>;
      case "tires.manage": return <TireManage setActive={setActive}/>;
      case "fuel": return <FuelModule tab="overview" setActive={setActive}/>;
      case "fuel.logs": return <FuelModule tab="logs" setActive={setActive}/>;
      case "fuel.report": return <FuelModule tab="report" setActive={setActive}/>;
      case "dispatch": return <DispatchModule tab="open" setActive={setActive} user={user}/>;
      case "dispatch.open": return <DispatchModule tab="open" setActive={setActive} user={user}/>;
      case "dispatch.close": return <DispatchModule tab="close" setActive={setActive} user={user}/>;
      case "dispatch.report": return <DispatchModule tab="report" setActive={setActive} user={user}/>;
      case "dispatch.history": return <DispatchModule tab="history" setActive={setActive} user={user}/>;
      case "subcontractors": return <SubcontractorModule tab="open" setActive={setActive}/>;
      case "subcontractors.close": return <SubcontractorModule tab="close" setActive={setActive}/>;
      case "subcontractors.history": return <SubcontractorModule tab="history" setActive={setActive}/>;
      case "subcontractors.drivers": return <SubcontractorModule tab="drivers" setActive={setActive}/>;
      case "subcontractors.jobs": return <SubcontractorModule tab="history" setActive={setActive}/>;
      case "expenses": return <ExpensesModule tab="record" setActive={setActive}/>;
      case "expenses.finance": return <ExpensesModule tab="finance" setActive={setActive}/>;
      case "expenses.stock": return <ExpensesModule tab="stock" setActive={setActive}/>;
      case "expenses.report": return <ExpensesModule tab="report" setActive={setActive}/>;
      case "expenses.vendors": return <ExpensesModule tab="vendors" setActive={setActive}/>;
      case "customers": return <CustomersPage/>;
      case "partners": return <PartnersPage/>;
      case "maintenance": return <MaintenancePage/>;
      case "finance": return <FinancePL/>;
      case "finance.fixed": return <FinanceFixed/>;
      case "finance.summary": return <FinanceSummary/>;
      case "settings.users": return <SettingsUsers/>;
      case "settings.company": return <SettingsCompany/>;
      default: return <Dashboard user={user} setActive={setActive}/>;
    }
  };

  return (
    <div className={`app ${collapsed ? "collapsed" : ""}`}>
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} active={active} setActive={setActive} user={user}/>
      <div className="main">
        <Topbar user={user} crumb={isDriver ? "งานของฉัน" : (crumbMap[active] || "Dashboard")}/>
        <div className="content">
          {renderPage()}
        </div>
      </div>
    </div>
  );
}

// Mount
ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
