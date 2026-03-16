'use client'

import { useState, useEffect, useRef } from 'react'
import { apiGet, apiPost } from '@/lib/api'

/* ── types ── */
interface Covenant {
  id: string
  name: string
  description: string
  status: 'OK' | 'WARNING' | 'BREACH'
}

interface Drawdown {
  id: string
  amount: number
  currency: string
  purpose: string
  status: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'DISBURSED'
  requestedAt: string
  approvedAt: string | null
  reason: string | null
}

interface ScheduleRow {
  id: string
  instalmentNumber: number
  dueDate: string
  amount: number
  totalDue: number
  principalDue: number
  interestDue: number
  paidAmount: number | null
  currency: string
  status: 'PAID' | 'PARTIAL' | 'OVERDUE' | 'PENDING' | 'SUBMITTED'
  paymentNotes: string | null
  proofDocumentId: string | null
}

interface RepaymentSummary {
  totalPaid: number
  overdueCount: number
  nextRepayment: { amount: number; dueDate: string } | null
}

interface Investment {
  id: string
  projectId: string
  projectName: string
  donorOrgName: string
  investmentType: string
  totalFacility: number
  currency: string
  drawnDown: number
  status: string
  interestRate: number
  startDate: string
  maturityDate: string
  repaymentSummary: RepaymentSummary
  covenants: Covenant[]
  drawdowns: Drawdown[]
  schedule: ScheduleRow[]
}

/* ── pills / badges ── */
function TypePill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#f6c453]/20 text-[#183a1d] border border-[#f6c453]/40">
      {label}
    </span>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-700 border-green-300',
    CLOSED: 'bg-gray-100 text-gray-500 border-gray-300',
    PENDING: 'bg-amber-100 text-amber-700 border-amber-300',
    DEFAULTED: 'bg-red-100 text-red-700 border-red-300',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${map[status] ?? map.ACTIVE}`}>
      {status}
    </span>
  )
}

function DrawdownStatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    REQUESTED: 'bg-amber-100 text-amber-700 border-amber-300',
    APPROVED: 'bg-green-100 text-green-700 border-green-300',
    REJECTED: 'bg-red-100 text-red-700 border-red-300',
    DISBURSED: 'bg-blue-100 text-blue-700 border-blue-300',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${map[status] ?? map.REQUESTED}`}>
      {status}
    </span>
  )
}

function CovenantBadge({ status, count }: { status: string; count: number }) {
  const map: Record<string, string> = {
    OK: 'bg-green-100 text-green-700 border-green-300',
    WARNING: 'bg-amber-100 text-amber-700 border-amber-300',
    BREACH: 'bg-red-100 text-red-700 border-red-300',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${map[status] ?? map.OK}`}>
      {count} {status}
    </span>
  )
}

/* ── main page ── */
export default function InvestmentsPage() {
  const [investments, setInvestments] = useState<Investment[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedSchedule, setExpandedSchedule] = useState<Set<string>>(new Set())
  const [expandedCovenants, setExpandedCovenants] = useState<Set<string>>(new Set())

  /* drawdown modal */
  const [drawdownModal, setDrawdownModal] = useState<Investment | null>(null)
  const [ddAmount, setDdAmount] = useState('')
  const [ddPurpose, setDdPurpose] = useState('')
  const [ddSubmitting, setDdSubmitting] = useState(false)

  /* payment modal */
  const [paymentModal, setPaymentModal] = useState<{ investmentId: string; instalment: ScheduleRow; currency: string } | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [paymentFile, setPaymentFile] = useState<File | null>(null)
  const [paymentSubmitting, setPaymentSubmitting] = useState(false)
  const paymentFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const res = await apiGet('/api/ngo/investments')
      if (res.ok) {
        const data = await res.json()
        setInvestments(data.investments ?? [])
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  /* toggle helpers */
  function toggleSchedule(id: string) {
    setExpandedSchedule(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleCovenant(id: string) {
    setExpandedCovenants(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  /* covenant status update */
  async function updateCovenantStatus(covenantId: string, status: 'OK' | 'WARNING' | 'BREACH') {
    try {
      const res = await apiPost(`/api/ngo/covenants/${covenantId}/status`, { status })
      if (res.ok) loadData()
    } catch {
      /* ignore */
    }
  }

  /* drawdown request */
  async function submitDrawdown() {
    if (!drawdownModal || !ddAmount || !ddPurpose.trim()) return
    setDdSubmitting(true)
    try {
      const res = await apiPost(`/api/ngo/investments/${drawdownModal.id}/drawdowns`, {
        amount: parseFloat(ddAmount),
        currency: drawdownModal.currency,
        purpose: ddPurpose.trim(),
      })
      if (res.ok) {
        setDrawdownModal(null)
        setDdAmount('')
        setDdPurpose('')
        loadData()
      }
    } catch {
      /* ignore */
    } finally {
      setDdSubmitting(false)
    }
  }

  /* submit payment */
  async function submitPayment() {
    if (!paymentModal || !paymentAmount) return
    setPaymentSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('instalmentId', paymentModal.instalment.id)
      formData.append('paidAmount', paymentAmount)
      if (paymentNotes.trim()) formData.append('notes', paymentNotes.trim())
      if (paymentFile) formData.append('proof', paymentFile)

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050'}/api/ngo/investments/${paymentModal.investmentId}/record-payment`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('tulip_token')}` },
        body: formData,
      })
      if (res.ok) {
        setPaymentModal(null)
        setPaymentAmount('')
        setPaymentNotes('')
        setPaymentFile(null)
        loadData()
      }
    } catch {
      /* ignore */
    } finally {
      setPaymentSubmitting(false)
    }
  }

  /* ── helpers ── */
  function fmtCurrency(amount: number, currency: string) {
    return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  function covenantCounts(covenants: Covenant[]) {
    const counts: Record<string, number> = { OK: 0, WARNING: 0, BREACH: 0 }
    covenants.forEach(c => { counts[c.status] = (counts[c.status] || 0) + 1 })
    return counts
  }

  /* ── render ── */
  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-up">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#183a1d]" style={{ fontFamily: 'Inter, sans-serif' }}>
          Investment Monitoring
        </h1>
        <p className="text-[#183a1d]/60 text-sm mt-1">
          Track repayment schedules, drawdowns and covenants
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="p-12 text-center text-[#183a1d]/40 text-sm">Loading investments...</div>
      )}

      {/* Empty */}
      {!loading && investments.length === 0 && (
        <div className="rounded-xl border border-[#c8d6c0] p-12 text-center" style={{ background: '#e1eedd' }}>
          <p className="text-[#183a1d]/40 text-sm">No investments found</p>
        </div>
      )}

      {/* Investment cards */}
      {investments.map(inv => {
        const remaining = inv.totalFacility - inv.drawnDown
        const paidPct = inv.totalFacility > 0
          ? Math.min(100, Math.round((inv.repaymentSummary.totalPaid / inv.totalFacility) * 100))
          : 0
        const counts = covenantCounts(inv.covenants)

        return (
          <div key={inv.id} className="rounded-xl border border-[#c8d6c0] overflow-hidden" style={{ background: '#fefbe9' }}>
            {/* Card header */}
            <div className="px-5 py-4 border-b border-[#c8d6c0] flex flex-wrap items-center gap-3" style={{ background: '#e1eedd' }}>
              <h2 className="text-base font-bold text-[#183a1d]" style={{ fontFamily: 'Inter, sans-serif' }}>
                {inv.projectName}
              </h2>
              <TypePill label={inv.investmentType} />
              <StatusPill status={inv.status} />
              <span className="text-xs text-[#183a1d]/50 ml-auto">{inv.donorOrgName}</span>
            </div>

            <div className="p-5 space-y-5">
              {/* Facility summary */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[#183a1d]/40 font-medium mb-2">Facility Summary</div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg border border-[#c8d6c0] p-3" style={{ background: '#e1eedd' }}>
                    <div className="text-xs text-[#183a1d]/50 mb-0.5">Total Facility</div>
                    <div className="text-sm font-bold text-[#183a1d]">{fmtCurrency(inv.totalFacility, inv.currency)}</div>
                  </div>
                  <div className="rounded-lg border border-[#c8d6c0] p-3" style={{ background: '#e1eedd' }}>
                    <div className="text-xs text-[#183a1d]/50 mb-0.5">Drawn Down</div>
                    <div className="text-sm font-bold text-[#183a1d]">{fmtCurrency(inv.drawnDown, inv.currency)}</div>
                  </div>
                  <div className="rounded-lg border border-[#c8d6c0] p-3" style={{ background: '#e1eedd' }}>
                    <div className="text-xs text-[#183a1d]/50 mb-0.5">Remaining</div>
                    <div className="text-sm font-bold text-[#183a1d]">{fmtCurrency(remaining, inv.currency)}</div>
                  </div>
                </div>
              </div>

              {/* Repayment status */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[#183a1d]/40 font-medium mb-2">Repayment Status</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Next due */}
                  <div className="rounded-lg border border-[#c8d6c0] p-3" style={{ background: '#e1eedd' }}>
                    <div className="text-xs text-[#183a1d]/50 mb-0.5">Next Due</div>
                    {inv.repaymentSummary.nextRepayment ? (
                      <>
                        <div className="text-sm font-bold text-[#183a1d]">
                          {fmtCurrency(inv.repaymentSummary.nextRepayment.amount, inv.currency)}
                        </div>
                        <div className="text-[11px] text-[#183a1d]/50 mt-0.5">
                          {fmtDate(inv.repaymentSummary.nextRepayment.dueDate)}
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-[#183a1d]/40">None</div>
                    )}
                  </div>
                  {/* Overdue */}
                  <div className="rounded-lg border border-[#c8d6c0] p-3" style={{ background: '#e1eedd' }}>
                    <div className="text-xs text-[#183a1d]/50 mb-0.5">Overdue</div>
                    <div className={`text-sm font-bold ${inv.repaymentSummary.overdueCount > 0 ? 'text-red-600' : 'text-[#183a1d]'}`}>
                      {inv.repaymentSummary.overdueCount} payment{inv.repaymentSummary.overdueCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                  {/* Paid to date */}
                  <div className="rounded-lg border border-[#c8d6c0] p-3" style={{ background: '#e1eedd' }}>
                    <div className="text-xs text-[#183a1d]/50 mb-0.5">Paid to Date</div>
                    <div className="text-sm font-bold text-[#183a1d]">
                      {fmtCurrency(inv.repaymentSummary.totalPaid, inv.currency)}
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-[#c8d6c0] overflow-hidden">
                      <div className="h-full rounded-full bg-[#183a1d] transition-all" style={{ width: `${paidPct}%` }} />
                    </div>
                    <div className="text-[10px] text-[#183a1d]/40 mt-0.5">{paidPct}% of facility</div>
                  </div>
                </div>
              </div>

              {/* Covenant health */}
              {inv.covenants.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[#183a1d]/40 font-medium mb-2">Covenant Health</div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {counts.OK > 0 && <CovenantBadge status="OK" count={counts.OK} />}
                    {counts.WARNING > 0 && <CovenantBadge status="WARNING" count={counts.WARNING} />}
                    {counts.BREACH > 0 && <CovenantBadge status="BREACH" count={counts.BREACH} />}
                  </div>
                  <div className="space-y-2">
                    {inv.covenants.map(cov => (
                      <div key={cov.id} className="rounded-lg border border-[#c8d6c0] overflow-hidden" style={{ background: '#e1eedd' }}>
                        <button
                          onClick={() => toggleCovenant(cov.id)}
                          className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-[#d5e5cc] transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-[#183a1d] font-medium">{cov.name}</span>
                            <CovenantBadge status={cov.status} count={0} />
                          </div>
                          <svg
                            className={`w-4 h-4 text-[#183a1d]/40 transition-transform ${expandedCovenants.has(cov.id) ? 'rotate-180' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {expandedCovenants.has(cov.id) && (
                          <div className="px-4 py-3 border-t border-[#c8d6c0] space-y-3">
                            <p className="text-xs text-[#183a1d]/60">{cov.description}</p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => updateCovenantStatus(cov.id, 'OK')}
                                className="px-3 py-1 rounded-md text-xs font-medium bg-green-100 text-green-700 border border-green-300 hover:bg-green-200 transition-colors"
                              >
                                Mark OK
                              </button>
                              <button
                                onClick={() => updateCovenantStatus(cov.id, 'WARNING')}
                                className="px-3 py-1 rounded-md text-xs font-medium bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-200 transition-colors"
                              >
                                Mark Warning
                              </button>
                              <button
                                onClick={() => updateCovenantStatus(cov.id, 'BREACH')}
                                className="px-3 py-1 rounded-md text-xs font-medium bg-red-100 text-red-700 border border-red-300 hover:bg-red-200 transition-colors"
                              >
                                Mark Breach
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Drawdown pipeline */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] uppercase tracking-wider text-[#183a1d]/40 font-medium">Drawdown Pipeline</div>
                  <button
                    onClick={() => { setDrawdownModal(inv); setDdAmount(''); setDdPurpose('') }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#183a1d] border border-[#c8d6c0] hover:bg-[#e1eedd] transition-colors"
                  >
                    + Request Drawdown
                  </button>
                </div>
                {inv.drawdowns.length === 0 ? (
                  <p className="text-xs text-[#183a1d]/40">No drawdowns yet</p>
                ) : (
                  <div className="space-y-1.5">
                    {inv.drawdowns.map(dd => (
                      <div key={dd.id} className="flex items-center justify-between rounded-lg border border-[#c8d6c0] px-4 py-2" style={{ background: '#e1eedd' }}>
                        <div>
                          <span className="text-sm font-medium text-[#183a1d]">{fmtCurrency(dd.amount, dd.currency)}</span>
                          <span className="text-xs text-[#183a1d]/50 ml-2">{dd.purpose}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-[#183a1d]/40">{fmtDate(dd.requestedAt)}</span>
                          <DrawdownStatusPill status={dd.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* View full schedule */}
              <div>
                <button
                  onClick={() => toggleSchedule(inv.id)}
                  className="text-xs font-medium text-[#183a1d]/60 hover:text-[#183a1d] transition-colors underline underline-offset-2"
                >
                  {expandedSchedule.has(inv.id) ? 'Hide Schedule' : 'View Full Schedule'}
                </button>
                {expandedSchedule.has(inv.id) && (inv.schedule || []).length > 0 && (
                  <div className="mt-3 rounded-lg border border-[#c8d6c0] overflow-hidden" style={{ background: '#e1eedd' }}>
                    <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#c8d6c0] text-[10px] text-[#183a1d]/40 uppercase tracking-wider">
                          <th className="text-left px-3 py-2 font-medium">#</th>
                          <th className="text-left px-3 py-2 font-medium">Due Date</th>
                          <th className="text-right px-3 py-2 font-medium">Principal</th>
                          <th className="text-right px-3 py-2 font-medium">Interest</th>
                          <th className="text-right px-3 py-2 font-medium">Total Due</th>
                          <th className="text-right px-3 py-2 font-medium">Paid</th>
                          <th className="text-center px-3 py-2 font-medium">Status</th>
                          <th className="text-right px-3 py-2 font-medium"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#c8d6c0]">
                        {(inv.schedule || []).map((row: ScheduleRow) => (
                          <tr key={row.id} className={row.status === 'OVERDUE' ? 'bg-red-50/50' : ''}>
                            <td className="px-3 py-2 text-[#183a1d] font-medium">{row.instalmentNumber}</td>
                            <td className="px-3 py-2 text-[#183a1d]">{fmtDate(row.dueDate)}</td>
                            <td className="px-3 py-2 text-right text-[#183a1d] font-mono text-xs">{fmtCurrency(parseFloat(String(row.principalDue)) || 0, row.currency)}</td>
                            <td className="px-3 py-2 text-right text-[#183a1d]/60 font-mono text-xs">{fmtCurrency(parseFloat(String(row.interestDue)) || 0, row.currency)}</td>
                            <td className="px-3 py-2 text-right text-[#183a1d] font-medium font-mono text-xs">{fmtCurrency(parseFloat(String(row.totalDue)) || row.amount, row.currency)}</td>
                            <td className="px-3 py-2 text-right font-mono text-xs text-green-700">{row.paidAmount ? fmtCurrency(parseFloat(String(row.paidAmount)), row.currency) : '—'}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                                row.status === 'PAID' ? 'bg-green-100 text-green-700 border-green-300' :
                                row.status === 'PARTIAL' ? 'bg-blue-100 text-blue-700 border-blue-300' :
                                row.status === 'SUBMITTED' ? 'bg-amber-100 text-amber-700 border-amber-300' :
                                row.status === 'OVERDUE' ? 'bg-red-100 text-red-700 border-red-300' :
                                'bg-gray-100 text-gray-500 border-gray-300'
                              }`}>
                                {row.status === 'SUBMITTED' ? 'Awaiting Confirmation' : row.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right">
                              {(row.status === 'PENDING' || row.status === 'OVERDUE') && (
                                <button
                                  onClick={() => { setPaymentModal({ investmentId: inv.id, instalment: row, currency: inv.currency }); setPaymentAmount(String(parseFloat(String(row.totalDue)) || row.amount)) }}
                                  className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-[#183a1d] text-[#fefbe9] hover:bg-[#183a1d]/90 transition-colors"
                                >
                                  Record Payment
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                )}
                {expandedSchedule.has(inv.id) && (inv.schedule || []).length === 0 && (
                  <p className="mt-2 text-xs text-[#183a1d]/40">No schedule entries</p>
                )}
              </div>
            </div>
          </div>
        )
      })}

      {/* ── Drawdown Request Modal ── */}
      {drawdownModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDrawdownModal(null)}>
          <div
            className="w-full max-w-md rounded-xl border border-[#c8d6c0] p-6 space-y-4 shadow-xl"
            style={{ background: '#fefbe9' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-[#183a1d]" style={{ fontFamily: 'Inter, sans-serif' }}>
              Request Drawdown
            </h3>
            <p className="text-xs text-[#183a1d]/50">
              {drawdownModal.projectName} &mdash; remaining: {fmtCurrency(drawdownModal.totalFacility - drawdownModal.drawnDown, drawdownModal.currency)}
            </p>

            {/* Amount */}
            <div>
              <label className="block text-xs font-medium text-[#183a1d]/70 mb-1">Amount</label>
              <input
                type="number"
                min={0}
                max={drawdownModal.totalFacility - drawdownModal.drawnDown}
                value={ddAmount}
                onChange={e => setDdAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-[#c8d6c0] bg-[#e1eedd] px-3 py-2 text-sm text-[#183a1d] placeholder-[#183a1d]/30 outline-none focus:border-[#183a1d]/40"
              />
            </div>

            {/* Currency */}
            <div>
              <label className="block text-xs font-medium text-[#183a1d]/70 mb-1">Currency</label>
              <input
                type="text"
                value={drawdownModal.currency}
                readOnly
                className="w-full rounded-lg border border-[#c8d6c0] bg-[#e1eedd]/60 px-3 py-2 text-sm text-[#183a1d]/60 outline-none cursor-not-allowed"
              />
            </div>

            {/* Purpose */}
            <div>
              <label className="block text-xs font-medium text-[#183a1d]/70 mb-1">Purpose <span className="text-red-500">*</span></label>
              <textarea
                value={ddPurpose}
                onChange={e => setDdPurpose(e.target.value)}
                rows={3}
                placeholder="Describe the purpose of this drawdown..."
                className="w-full rounded-lg border border-[#c8d6c0] bg-[#e1eedd] px-3 py-2 text-sm text-[#183a1d] placeholder-[#183a1d]/30 outline-none focus:border-[#183a1d]/40 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDrawdownModal(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[#183a1d]/60 border border-[#c8d6c0] hover:bg-[#e1eedd] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitDrawdown}
                disabled={ddSubmitting || !ddAmount || !ddPurpose.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[#fefbe9] bg-[#183a1d] hover:bg-[#183a1d]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {ddSubmitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Record Payment Modal ── */}
      {paymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setPaymentModal(null); setPaymentFile(null); setPaymentNotes('') }}>
          <div
            className="w-full max-w-md rounded-xl border border-[#c8d6c0] p-6 space-y-4 shadow-xl"
            style={{ background: '#fefbe9' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-[#183a1d]" style={{ fontFamily: 'Inter, sans-serif' }}>
              Record Payment
            </h3>
            <div className="rounded-lg border border-[#c8d6c0] p-3" style={{ background: '#e1eedd' }}>
              <p className="text-xs text-[#183a1d]/50">Instalment #{paymentModal.instalment.instalmentNumber}</p>
              <p className="text-sm font-bold text-[#183a1d]">
                Total Due: {fmtCurrency(parseFloat(String(paymentModal.instalment.totalDue)) || paymentModal.instalment.amount, paymentModal.currency)}
              </p>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-medium text-[#183a1d]/70 mb-1">Payment Amount</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={paymentAmount}
                onChange={e => setPaymentAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-[#c8d6c0] bg-[#e1eedd] px-3 py-2 text-sm text-[#183a1d] placeholder-[#183a1d]/30 outline-none focus:border-[#183a1d]/40"
              />
            </div>

            {/* Proof file */}
            <div>
              <label className="block text-xs font-medium text-[#183a1d]/70 mb-1">Payment Proof (receipt, transfer confirmation, etc.)</label>
              <input
                ref={paymentFileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={e => setPaymentFile(e.target.files?.[0] || null)}
                className="w-full rounded-lg border border-[#c8d6c0] bg-[#e1eedd] px-3 py-2 text-sm text-[#183a1d] file:mr-3 file:rounded-md file:border-0 file:bg-[#183a1d] file:px-3 file:py-1 file:text-xs file:font-medium file:text-[#fefbe9]"
              />
              {paymentFile && (
                <p className="text-xs text-[#183a1d]/50 mt-1">{paymentFile.name} ({(paymentFile.size / 1024).toFixed(1)} KB)</p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-[#183a1d]/70 mb-1">Notes</label>
              <textarea
                value={paymentNotes}
                onChange={e => setPaymentNotes(e.target.value)}
                rows={2}
                placeholder="Payment reference, bank details, etc."
                className="w-full rounded-lg border border-[#c8d6c0] bg-[#e1eedd] px-3 py-2 text-sm text-[#183a1d] placeholder-[#183a1d]/30 outline-none focus:border-[#183a1d]/40 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setPaymentModal(null); setPaymentFile(null); setPaymentNotes('') }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[#183a1d]/60 border border-[#c8d6c0] hover:bg-[#e1eedd] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitPayment}
                disabled={paymentSubmitting || !paymentAmount}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[#fefbe9] bg-[#183a1d] hover:bg-[#183a1d]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {paymentSubmitting ? 'Submitting...' : 'Submit Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
