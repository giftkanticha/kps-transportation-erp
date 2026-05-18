import { useState } from 'react'
import { db } from '../../lib/db'
import type { Vehicle, Employee, Tire, FuelRecord, Maintenance, Dispatch, User } from '../../types'
import { Icon, StatusBadge, Info } from '../../components/ui'

interface VehicleDetailProps {
  setActive: (id: string) => void
  subject: unknown
  user: User
}

type TabKey = 'overview' | 'tires' | 'fuel' | 'maintenance' | 'trips'

function TireSummary({ tires }: { tires: Tire[] }) {
  if (!tires.length) {
    return <div className="empty">ยังไม่มีข้อมูลยาง</div>
  }

  const good = tires.filter(t => (t.status as string) === 'good').length
  const warning = tires.filter(t => (t.status as string) === 'warning').length
  const critical = tires.filter(t => (t.status as string) === 'critical').length

  return (
    <div>
      <div className="grid-3" style={{ marginBottom: 18 }}>
        <Info label="ดี" value={<span className="badge green">{good} เส้น</span>} />
        <Info label="เฝ้าระวัง" value={<span className="badge amber">{warning} เส้น</span>} />
        <Info label="วิกฤติ" value={<span className="badge red">{critical} เส้น</span>} />
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <th>ตำแหน่ง</th>
            <th>ยี่ห้อ/รุ่น</th>
            <th>ขนาด</th>
            <th>วันติดตั้ง</th>
            <th>km สะสม</th>
            <th>สถานะ</th>
          </tr>
        </thead>
        <tbody>
          {tires.map(t => (
            <tr key={t.id}>
              <td>
                <span className="mono" style={{ fontWeight: 600 }}>
                  {t.position ?? '—'}
                </span>
              </td>
              <td>{t.brand}</td>
              <td className="mono">{t.size}</td>
              <td className="num muted">{t.installedDate}</td>
              <td className="num">{db.fmt(t.accumulatedKm)}</td>
              <td>
                <StatusBadge status={t.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function VehicleDetail({ setActive, subject }: VehicleDetailProps) {
  const subjectObj = subject as { type?: string; id?: string } | null
  const v = db.get<Vehicle>('vehicles', subjectObj?.id ?? '')
  const [tab, setTab] = useState<TabKey>('overview')

  if (!v) {
    return (
      <div className="empty">
        ไม่พบรถ —{' '}
        <a
          onClick={() => setActive('vehicles')}
          style={{ cursor: 'pointer', color: 'var(--primary)' }}
        >
          กลับไปรายการ
        </a>
      </div>
    )
  }

  const driver = db.get<Employee>('employees', v.driverId ?? '')
  const tires = db.getAll<Tire>('tires').filter(t => t.vehicleId === v.id)
  const fuel = db.getAll<FuelRecord>('fuel').filter(f => f.vehicleId === v.id)
  const maintenance = db.getAll<Maintenance>('maintenance').filter(m => m.vehicleId === v.id)
  const trips = db.getAll<Dispatch>('dispatch').filter(t => t.vehicleId === v.id)

  const totalFuelCost = fuel.reduce((s, f) => s + f.total, 0)
  const totalRevenue = trips.reduce((s, t) => s + (t.revenue || 0), 0)
  const totalCost =
    trips.reduce((s, t) => s + (t.cost || 0), 0) +
    maintenance.reduce((s, m) => s + (m.cost || 0), 0)

  const tabs: [TabKey, string][] = [
    ['overview', 'ภาพรวม'],
    ['tires', 'ยาง'],
    ['fuel', 'น้ำมัน'],
    ['maintenance', 'บำรุงรักษา'],
    ['trips', 'งานขนส่ง'],
  ]

  return (
    <div>
      <div className="page-head">
        <div>
          <div
            className="row"
            style={{
              gap: 6,
              color: 'var(--text-muted)',
              fontSize: 12,
              marginBottom: 4,
              cursor: 'pointer',
            }}
            onClick={() => setActive('vehicles')}
          >
            <span>← รายการรถ</span>
          </div>
          <div className="row" style={{ gap: 16 }}>
            <div
              style={{
                width: 120,
                height: 56,
                borderRadius: 8,
                background: 'var(--text-2)',
                color: '#FFD700',
                display: 'grid',
                placeItems: 'center',
                fontSize: 22,
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                letterSpacing: '.05em',
              }}
            >
              {v.plate}
            </div>
            <div>
              <h1 className="page-title">{v.brand}</h1>
              <div className="page-sub">
                {v.type} • ปี {v.year} • <StatusBadge status={v.status} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="card kpi">
          <div className="label">เลขไมล์</div>
          <div className="row">
            <div className="icn-box">
              <Icon name="gauge" size={18} />
            </div>
            <div className="value">
              {db.fmt(v.odometer)}
              <span className="unit">km</span>
            </div>
          </div>
        </div>
        <div className="card kpi">
          <div className="label">น้ำมันถัง</div>
          <div className="row">
            <div className={`icn-box ${v.fuel < 30 ? 'red' : v.fuel < 60 ? 'amber' : 'green'}`}>
              <Icon name="fuel" size={18} />
            </div>
            <div className="value">
              {v.fuel}
              <span className="unit">%</span>
            </div>
          </div>
        </div>
        <div className="card kpi">
          <div className="label">รายได้ทั้งหมด</div>
          <div className="row">
            <div className="icn-box green">
              <Icon name="money" size={18} />
            </div>
            <div className="value">{db.thb(totalRevenue)}</div>
          </div>
        </div>
        <div className="card kpi">
          <div className="label">ต้นทุนรวม</div>
          <div className="row">
            <div className="icn-box amber">
              <Icon name="money" size={18} />
            </div>
            <div className="value">{db.thb(totalCost)}</div>
          </div>
        </div>
      </div>

      <div className="tabs">
        {tabs.map(([k, l]) => (
          <button
            key={k}
            className={`tab ${tab === k ? 'active' : ''}`}
            onClick={() => setTab(k)}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
          <div className="card pad">
            <h3 className="section-title">ข้อมูลรถ</h3>
            <div className="grid-2" style={{ gap: 14 }}>
              <Info label="ทะเบียน" value={v.plate} />
              <Info label="ปี" value={v.year} />
              <Info label="ยี่ห้อ/รุ่น" value={v.brand} />
              <Info label="ประเภท" value={v.type} />
              <Info label="คนขับประจำ" value={driver?.name ?? '—'} />
              <Info label="โทรศัพท์คนขับ" value={driver?.phone ?? '—'} />
            </div>
            <h3 className="section-title" style={{ marginTop: 22 }}>
              เอกสาร & กำหนดการ
            </h3>
            <div className="grid-2" style={{ gap: 14 }}>
              <Info label="บำรุงรักษาล่าสุด" value={v.lastService || '—'} />
              <Info label="นัดบำรุงรักษาถัดไป" value={v.nextService || '—'} />
              <Info label="วันหมดประกัน" value={v.insurance || '—'} />
              <Info label="วันหมดภาษี" value={v.tax || '—'} />
              <Info label="ใบอนุญาตขนส่ง" value={v.dispatchPermit || '—'} />
              <Info label="วันซื้อ" value={v.purchaseDate || '—'} />
            </div>
          </div>
          <div className="card">
            <div className="head">
              <h3>สรุปการใช้น้ำมัน</h3>
            </div>
            <div style={{ padding: '20px 22px' }}>
              <div className="mono" style={{ fontSize: 24, fontWeight: 700 }}>
                {db.thb(totalFuelCost)}
              </div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 16 }}>
                รวม {fuel.length} ครั้ง •{' '}
                {fuel.reduce((s, f) => s + f.liters, 0).toFixed(0)} ลิตร
              </div>
              {fuel.slice(0, 4).map(f => (
                <div
                  key={f.id}
                  className="row"
                  style={{
                    padding: '8px 0',
                    borderBottom: '1px solid var(--line)',
                    fontSize: 12.5,
                  }}
                >
                  <div>
                    <div className="mono">{f.date.slice(0, 10)}</div>
                    <div className="muted" style={{ fontSize: 11 }}>
                      {f.station}
                    </div>
                  </div>
                  <div className="spacer" />
                  <div className="mono right">
                    <div>{f.liters}L</div>
                    <div className="muted" style={{ fontSize: 11 }}>
                      {db.thb(f.total)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'tires' && (
        <div className="card">
          <div className="head">
            <h3>ผังยางและสภาพ ({tires.length} เส้น)</h3>
            <div className="right">
              <button className="btn sm" onClick={() => setActive('tires.layout')}>
                <Icon name="tire" size={14} /> ดูผังเต็ม
              </button>
            </div>
          </div>
          <div style={{ padding: 20 }}>
            <TireSummary tires={tires} />
          </div>
        </div>
      )}

      {tab === 'fuel' && (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>วันที่</th>
                <th>ปั๊ม</th>
                <th>ลิตร</th>
                <th>ราคา/L</th>
                <th className="right">รวม</th>
                <th>เลขไมล์</th>
              </tr>
            </thead>
            <tbody>
              {fuel.map(f => (
                <tr key={f.id}>
                  <td className="mono">{f.date}</td>
                  <td>{f.station}</td>
                  <td className="num">{f.liters}</td>
                  <td className="num">฿{f.pricePerL}</td>
                  <td className="num right">{db.thb(f.total)}</td>
                  <td className="num muted">{db.fmt(f.odometer)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'maintenance' && (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>รหัส</th>
                <th>ประเภท</th>
                <th>อู่/ศูนย์</th>
                <th>วันที่</th>
                <th>ค่าใช้จ่าย</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {maintenance.map(m => (
                <tr key={m.id}>
                  <td className="mono">{m.code}</td>
                  <td>{m.type}</td>
                  <td>{m.workshop}</td>
                  <td className="num muted">{m.startDate}</td>
                  <td className="num">{db.thb(m.cost)}</td>
                  <td>
                    <StatusBadge status={m.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'trips' && (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>รหัสงาน</th>
                <th>เส้นทาง</th>
                <th>ลูกค้า</th>
                <th>วันที่</th>
                <th>ระยะทาง</th>
                <th>รายได้</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {trips.map(t => (
                <tr key={t.id}>
                  <td className="mono">{t.code}</td>
                  <td>
                    <div style={{ fontSize: 12.5 }}>{db.originOf(t)}</div>
                    <div className="muted" style={{ fontSize: 11.5 }}>
                      → {db.destOf(t)}
                    </div>
                  </td>
                  <td>{db.nameOf('customers', t.customerId)}</td>
                  <td className="num muted">{t.depart.slice(0, 10)}</td>
                  <td className="num">{t.distance} km</td>
                  <td className="num">{db.thb(db.amountOf(t))}</td>
                  <td>
                    <StatusBadge status={t.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
