import { useState, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { db, DSP_KMPL_THRESHOLD } from '../../lib/db'
import { useList, useInsert, useUpdate } from '../../hooks/useTable'
import { useDispatches } from '../../hooks/useDispatches'
import {
  useAccountingPeriods,
  formatPeriodLabel,
  pendingDecisionRounds,
  THAI_MONTH_NAMES,
} from '../../hooks/useAccountingPeriods'
import { useAuth } from '../../context/AuthContext'
import {
  closePeriod,
  carryForwardRound,
  reopenPeriod,
  computeVehicleSnapshots,
} from '../../lib/periodClose'
import type {
  AccountingPeriod,
  Vehicle,
  FuelRound,
  PeriodUnlockRequest,
} from '../../types'
import { Icon, Field } from '../../components/ui'

type Toast = { kind: 'ok' | 'err'; text: string } | null

export function PeriodClosePage() {
  const qc = useQueryClient()
  const { profile, isAdmin, isManager } = useAuth()
  const canClose = isManager  // admin or manager
  const { data: periods = [] } = useAccountingPeriods()
  const { data: dispatches = [] } = useDispatches()
  const { data: vehicles = [] } = useList<Vehicle>('vehicles')
  const { data: fuelRounds = [] } = useList<FuelRound>('fuel_rounds')
  const { data: unlockRequests = [] } = useList<PeriodUnlockRequest>('period_unlock_requests')
  const insertUnlockReq = useInsert<PeriodUnlockRequest>('period_unlock_requests')
  const updateUnlockReq = useUpdate<PeriodUnlockRequest>('period_unlock_requests')

  const [activePeriod, setActivePeriod] = useState<AccountingPeriod | null>(null)
  const [toast, setToast] = useState<Toast>(null)
  const [busy, setBusy] = useState(false)
  const [unlockTarget, setUnlockTarget] = useState<AccountingPeriod | null>(null)

  const sortedPeriods = useMemo(() => {
    return [...periods].sort((a, b) =>
      b.year !== a.year ? b.year - a.year : b.month - a.month,
    )
  }, [periods])

  const periodRoundsCount = (p: AccountingPeriod) => dispatches.filter(d => {
    if (d.accountingPeriodId === p.id) return true
    if (d.accountingPeriodId) return false
    const basis = (d.depart || d.date || '').slice(0, 10)
    if (!basis) return false
    const dt = new Date(basis)
    return dt.getFullYear() === p.year && dt.getMonth() + 1 === p.month
  }).length

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['accounting_periods'] })
    qc.invalidateQueries({ queryKey: ['dispatch'] })
    qc.invalidateQueries({ queryKey: ['accounting_period_snapshots'] })
    qc.invalidateQueries({ queryKey: ['period_unlock_requests'] })
  }

  // ── List view ────────────────────────────────────────────────────────────
  if (!activePeriod) {
    return (
      <div>
        <div className="page-head">
          <div>
            <h1 className="page-title">ปิดงวดบัญชี</h1>
            <div className="page-sub">
              ปิดงวดเพื่อ <strong>ล็อกข้อมูล</strong> + สร้าง snapshot P&amp;L รายคัน
              — รายงานจะพิมพ์ตัวเลขเดิมตลอด
            </div>
          </div>
        </div>

        {/* Admin only: pending unlock requests */}
        {isAdmin && unlockRequests.filter(r => r.status === 'pending').length > 0 && (
          <div className="card" style={{ marginBottom: 16, borderColor: '#F59E0B' }}>
            <div className="head" style={{ background: '#FEF3C7' }}>
              <h3>🔔 คำขอปลดล็อกงวด ({unlockRequests.filter(r => r.status === 'pending').length})</h3>
            </div>
            <div className="tbl-wrap" style={{ border: 'none' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>งวด</th>
                    <th>ผู้ขอ</th>
                    <th>เหตุผล</th>
                    <th>เมื่อ</th>
                    <th style={{ width: 220 }}>การกระทำ</th>
                  </tr>
                </thead>
                <tbody>
                  {unlockRequests.filter(r => r.status === 'pending').map(req => {
                    const p = periods.find(pp => pp.id === req.periodId)
                    return (
                      <tr key={req.id}>
                        <td><strong>{p ? formatPeriodLabel(p) : '—'}</strong></td>
                        <td>{req.requesterName || '—'}</td>
                        <td style={{ maxWidth: 300, whiteSpace: 'normal' }}>{req.reason}</td>
                        <td className="muted">{db.thaiDate(req.createdAt)}</td>
                        <td>
                          <button
                            className="btn sm primary"
                            disabled={busy || !p}
                            onClick={async () => {
                              if (!p) return
                              if (!confirm(`ปลดล็อก ${formatPeriodLabel(p)} ตามคำขอของ ${req.requesterName}?`)) return
                              setBusy(true)
                              try {
                                await reopenPeriod(p.id, profile?.id ?? null, req.reason)
                                await updateUnlockReq.mutateAsync({
                                  id: req.id,
                                  patch: {
                                    status: 'approved',
                                    reviewerId: profile?.id ?? null,
                                    reviewerName: profile?.display_name ?? profile?.username ?? profile?.email ?? '',
                                    reviewedAt: new Date().toISOString(),
                                  },
                                })
                                setToast({ kind: 'ok', text: 'อนุมัติและปลดล็อกแล้ว' })
                                refresh()
                              } catch (e) {
                                setToast({ kind: 'err', text: e instanceof Error ? e.message : 'ล้มเหลว' })
                              } finally { setBusy(false) }
                            }}
                          >
                            ✓ อนุมัติ + ปลดล็อก
                          </button>
                          <button
                            className="btn sm"
                            disabled={busy}
                            style={{ marginLeft: 6 }}
                            onClick={async () => {
                              const note = prompt('เหตุผลที่ปฏิเสธ:') ?? ''
                              if (!note.trim()) return
                              setBusy(true)
                              try {
                                await updateUnlockReq.mutateAsync({
                                  id: req.id,
                                  patch: {
                                    status: 'rejected',
                                    reviewerId: profile?.id ?? null,
                                    reviewerName: profile?.display_name ?? profile?.username ?? profile?.email ?? '',
                                    reviewedAt: new Date().toISOString(),
                                    reviewNote: note.trim(),
                                  },
                                })
                                setToast({ kind: 'ok', text: 'ปฏิเสธคำขอแล้ว' })
                                refresh()
                              } catch (e) {
                                setToast({ kind: 'err', text: e instanceof Error ? e.message : 'ล้มเหลว' })
                              } finally { setBusy(false) }
                            }}
                          >
                            ✗ ปฏิเสธ
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="card">
          <div className="head">
            <h3>งวดทั้งหมด</h3>
          </div>
          <div className="tbl-wrap" style={{ border: 'none' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>งวด</th>
                  <th className="num">รอบทั้งหมด</th>
                  <th>สถานะ</th>
                  <th>ปิดเมื่อ</th>
                  <th>ปิดโดย</th>
                  <th style={{ width: 220 }}>การกระทำ</th>
                </tr>
              </thead>
              <tbody>
                {sortedPeriods.map(p => {
                  const pending = pendingDecisionRounds(dispatches, p).length
                  return (
                    <tr key={p.id}>
                      <td><strong>{formatPeriodLabel(p)}</strong></td>
                      <td className="num">{periodRoundsCount(p)}</td>
                      <td>
                        {p.status === 'CLOSED'
                          ? <span className="badge green" style={{ fontSize: 11 }}>🔒 CLOSED</span>
                          : p.status === 'PENDING_CLOSE'
                            ? <span className="badge amber" style={{ fontSize: 11 }}>PENDING</span>
                            : <span className="badge" style={{ fontSize: 11 }}>OPEN</span>}
                      </td>
                      <td className="muted">{p.closedAt ? db.thaiDate(p.closedAt) : '–'}</td>
                      <td className="muted">{p.closedByName || '–'}</td>
                      <td>
                        {p.status === 'OPEN' && canClose && (
                          <button className="btn sm primary" onClick={() => setActivePeriod(p)}>
                            <Icon name="check" size={12} /> เริ่มปิดงวด
                            {pending > 0 && <span style={{ marginLeft: 6, fontSize: 10 }}>({pending} รอตัดสินใจ)</span>}
                          </button>
                        )}
                        {p.status === 'CLOSED' && (
                          isAdmin
                            ? <button className="btn sm" onClick={() => setUnlockTarget(p)}>
                                <Icon name="edit" size={12} /> ปลดล็อก
                              </button>
                            : <button className="btn sm" onClick={() => setUnlockTarget(p)}>
                                <Icon name="bell" size={12} /> ขอปลดล็อก
                              </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {sortedPeriods.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-2)' }}>
                    ยังไม่มีงวด — ตรวจ migration 0030
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {unlockTarget && (
          <UnlockModal
            period={unlockTarget}
            isAdmin={isAdmin}
            onClose={() => setUnlockTarget(null)}
            onSubmit={async (reason) => {
              try {
                if (isAdmin) {
                  await reopenPeriod(unlockTarget.id, profile?.id ?? null, reason)
                  setToast({ kind: 'ok', text: 'ปลดล็อกงวดเรียบร้อย' })
                } else {
                  await insertUnlockReq.mutateAsync({
                    periodId: unlockTarget.id,
                    requesterId: profile?.id ?? null,
                    requesterName: profile?.display_name ?? profile?.username ?? profile?.email ?? '',
                    reason,
                    status: 'pending',
                  })
                  setToast({ kind: 'ok', text: 'ส่งคำขอปลดล็อกให้ admin แล้ว' })
                }
                setUnlockTarget(null)
                refresh()
              } catch (e) {
                setToast({ kind: 'err', text: e instanceof Error ? e.message : 'ล้มเหลว' })
              }
            }}
          />
        )}

        {toast && <ToastBox toast={toast} onDismiss={() => setToast(null)} />}
      </div>
    )
  }

  // ── Workspace: close a specific period ───────────────────────────────────
  const pending = pendingDecisionRounds(dispatches, activePeriod)
  const allRoundsInPeriod = dispatches.filter(d => {
    if (d.accountingPeriodId === activePeriod.id) return true
    if (d.accountingPeriodId) return false
    const basis = (d.depart || d.date || '').slice(0, 10)
    if (!basis) return false
    const dt = new Date(basis)
    return dt.getFullYear() === activePeriod.year && dt.getMonth() + 1 === activePeriod.month
  })
  const nextPeriod = periods.find(p =>
    (activePeriod.month === 12)
      ? (p.year === activePeriod.year + 1 && p.month === 1)
      : (p.year === activePeriod.year && p.month === activePeriod.month + 1),
  )
  const preview = computeVehicleSnapshots(allRoundsInPeriod, vehicles, fuelRounds)

  const handleClose = async () => {
    if (pending.length > 0) {
      setToast({ kind: 'err', text: `ยังมี ${pending.length} รอบที่ยังเปิดอยู่ — ตัดสินใจให้ครบก่อน` })
      return
    }
    if (!confirm(`ยืนยันปิดงวด ${formatPeriodLabel(activePeriod)}? — ข้อมูลในเดือนนี้จะถูกล็อก`)) return
    setBusy(true)
    try {
      await closePeriod({
        period: activePeriod,
        rounds: allRoundsInPeriod,
        vehicles,
        fuelRounds,
        closedById: profile?.id ?? null,
        closedByName: profile?.display_name ?? profile?.username ?? profile?.email ?? '',
      })
      setToast({ kind: 'ok', text: `ปิดงวด ${formatPeriodLabel(activePeriod)} เรียบร้อย` })
      refresh()
      setActivePeriod(null)
    } catch (e) {
      setToast({ kind: 'err', text: e instanceof Error ? e.message : 'ปิดงวดล้มเหลว' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">ปิดงวด — {formatPeriodLabel(activePeriod)}</h1>
          <div className="page-sub">
            {allRoundsInPeriod.length} รอบในเดือนนี้ ·
            <strong style={{ color: pending.length > 0 ? 'var(--red)' : 'var(--green)', marginLeft: 6 }}>
              {pending.length === 0 ? 'พร้อมปิดงวด' : `เหลือ ${pending.length} รอบรอตัดสินใจ`}
            </strong>
          </div>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => setActivePeriod(null)} disabled={busy}>
            ← กลับ
          </button>
          <button
            className="btn primary"
            onClick={handleClose}
            disabled={busy || pending.length > 0}
            title={pending.length > 0 ? 'ตัดสินใจรอบที่เปิดอยู่ก่อน' : 'ปิดงวด'}
          >
            {busy ? 'กำลังปิด…' : <><Icon name="check" size={14}/> ยืนยันปิดงวด</>}
          </button>
        </div>
      </div>

      {/* Pending rounds — must decide */}
      {pending.length > 0 && (
        <div className="card" style={{ marginBottom: 16, borderColor: '#F59E0B' }}>
          <div className="head" style={{ background: '#FEF3C7' }}>
            <h3>⚠ รอบที่ต้องตัดสินใจ ({pending.length})</h3>
          </div>
          <div className="tbl-wrap" style={{ border: 'none' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>รหัส</th>
                  <th>ทะเบียน</th>
                  <th>วันเปิดงาน</th>
                  <th>สถานะ</th>
                  <th style={{ width: 240 }}>การกระทำ</th>
                </tr>
              </thead>
              <tbody>
                {pending.map(r => {
                  const v = vehicles.find(x => x.id === r.vehicleId)
                  return (
                    <tr key={r.id}>
                      <td className="mono" style={{ color: 'var(--primary)', fontWeight: 600 }}>{r.code}</td>
                      <td className="mono">{v?.plate ?? '—'}</td>
                      <td className="muted">{(r.depart || r.date || '').slice(0, 10)}</td>
                      <td><span className="badge amber" style={{ fontSize: 11 }}>DRAFT</span></td>
                      <td>
                        {nextPeriod && nextPeriod.status === 'OPEN' ? (
                          <button
                            className="btn sm"
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true)
                              try {
                                await carryForwardRound(r.id, activePeriod.id, nextPeriod.id)
                                setToast({ kind: 'ok', text: `ยกยอด ${r.code} ไป ${formatPeriodLabel(nextPeriod)}` })
                                refresh()
                              } catch (e) {
                                setToast({ kind: 'err', text: e instanceof Error ? e.message : 'ยกยอดล้มเหลว' })
                              } finally {
                                setBusy(false)
                              }
                            }}
                          >
                            ➡ ยกยอดไป {THAI_MONTH_NAMES[nextPeriod.month - 1]}
                          </button>
                        ) : (
                          <span className="muted" style={{ fontSize: 12 }}>
                            (เดือนถัดไปยังไม่พร้อม / ปิดไปแล้ว)
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Preview: per-vehicle P&L snapshot */}
      <div className="card">
        <div className="head">
          <h3>ตัวอย่าง snapshot P&amp;L รายคัน ({preview.length} คัน)</h3>
        </div>
        <div className="tbl-wrap" style={{ border: 'none' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>ทะเบียน</th>
                <th className="num">รอบ</th>
                <th className="num">เที่ยว</th>
                <th className="num">ระยะทาง</th>
                <th className="num">น้ำมัน(ล.)</th>
                <th className="num">KM/L</th>
                <th className="num">รายได้</th>
                <th className="num">ค่าน้ำมัน</th>
                <th className="num">เบี้ยเลี้ยง</th>
                <th className="num">อื่นๆ</th>
                <th className="num">กำไรสุทธิ</th>
              </tr>
            </thead>
            <tbody>
              {preview.map(s => {
                const low = s.data.avgKmPerL != null && s.data.avgKmPerL < DSP_KMPL_THRESHOLD
                return (
                  <tr key={s.vehicleId || s.plate}>
                    <td className="mono"><strong>{s.plate}</strong></td>
                    <td className="num">{s.data.rounds}</td>
                    <td className="num">{s.data.legs}</td>
                    <td className="num">{db.fmt(s.data.distance)}</td>
                    <td className="num">{db.fmt(s.data.liters)}</td>
                    <td className="num">
                      {s.data.avgKmPerL != null && (
                        <span style={{ color: low ? '#A32D2D' : '#166534', fontWeight: 600 }}>
                          {s.data.avgKmPerL.toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className="num">{db.thb(s.data.revenue)}</td>
                    <td className="num">{db.thb(s.data.fuelCost)}</td>
                    <td className="num">{db.thb(s.data.perDiem)}</td>
                    <td className="num">{db.thb(s.data.other)}</td>
                    <td className="num" style={{
                      color: s.data.profit >= 0 ? 'var(--green)' : 'var(--red)',
                      fontWeight: 600,
                    }}>{db.thb(s.data.profit)}</td>
                  </tr>
                )
              })}
              {preview.length === 0 && (
                <tr><td colSpan={11} style={{ textAlign: 'center', padding: 32, color: 'var(--text-2)' }}>
                  ไม่มีข้อมูลในเดือนนี้
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {toast && <ToastBox toast={toast} onDismiss={() => setToast(null)} />}
    </div>
  )
}

// ─── Unlock / Reopen modal ──────────────────────────────────────────────────
function UnlockModal({
  period, isAdmin, onClose, onSubmit,
}: {
  period: AccountingPeriod
  isAdmin: boolean
  onClose: () => void
  onSubmit: (reason: string) => Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const title = isAdmin ? 'ปลดล็อกงวด' : 'ขอปลดล็อกงวด'
  const submit = async () => {
    if (!reason.trim()) return
    setBusy(true)
    try { await onSubmit(reason.trim()) } finally { setBusy(false) }
  }
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="head"><h3>{title} — {formatPeriodLabel(period)}</h3></div>
        <div className="body">
          <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
            {isAdmin
              ? 'ปลดล็อกแล้วข้อมูลในเดือนนี้จะแก้ไขได้อีกครั้ง — snapshot เดิมจะถูกเขียนทับเมื่อปิดงวดใหม่'
              : 'แอดมินจะตรวจสอบคำขอและปลดล็อกให้'}
          </p>
          <Field label="เหตุผล *">
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              style={{ width: '100%', resize: 'vertical' }}
              autoFocus
              placeholder="เช่น เลขไมล์คลาดเคลื่อน / ลืมใส่ค่าน้ำมันรอบ DSP-X"
            />
          </Field>
        </div>
        <div className="foot">
          <button className="btn" onClick={onClose} disabled={busy}>ยกเลิก</button>
          <button className="btn primary" onClick={submit} disabled={busy || !reason.trim()}>
            {busy ? 'กำลังส่ง…' : (isAdmin ? 'ปลดล็อก' : 'ส่งคำขอ')}
          </button>
        </div>
      </div>
    </div>
  )
}

function ToastBox({ toast, onDismiss }: { toast: NonNullable<Toast>; onDismiss: () => void }) {
  return (
    <div
      onClick={onDismiss}
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 2000,
        padding: '12px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
        background: toast.kind === 'ok' ? '#dcfce7' : '#fee2e2',
        color:      toast.kind === 'ok' ? '#166534' : '#991b1b',
        border: `1px solid ${toast.kind === 'ok' ? '#86efac' : '#fca5a5'}`,
        cursor: 'pointer', maxWidth: 360, boxShadow: '0 6px 24px rgba(0,0,0,.15)',
      }}
    >
      {toast.text}
    </div>
  )
}
