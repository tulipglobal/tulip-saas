'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { apiGet } from '@/lib/api'
import { formatMoney } from '@/lib/currency'

// ── Interfaces ───────────────────────────────────────────────
interface NextRepayment {
  dueDate: string
  totalDue: number
}

interface Investment {
  id: string
  projectId: string
  projectName: string
  investmentType: 'LOAN' | 'REVENUE_SHARE' | 'SIB' | 'EQUITY'
  totalFacility: number
  currency: string
  drawnDown: number
  outstandingPrincipal: number
  totalPaid: number
  nextRepayment: NextRepayment | null
  overdueCount: number
  status: 'ACTIVE' | 'COMPLETED' | 'DEFAULTED'
}

// ── Helpers ──────────────────────────────────────────────────
function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return '—'
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function isOverdue(d: string | null | undefined): boolean {
  if (!d) return false
  return new Date(d) < new Date()
}

function drawnPct(drawn: number, facility: number): number {
  if (!facility) return 0
  return Math.round((drawn / facility) * 100)
}

// ── Type pill colours ────────────────────────────────────────
const typePillStyles: Record<string, { bg: string; color: string }> = {
  LOAN:          { bg: '#DBEAFE', color: '#1E40AF' },
  REVENUE_SHARE: { bg: '#EDE9FE', color: '#6D28D9' },
  SIB:           { bg: '#FFFBEB', color: '#92400E' },
  EQUITY:        { bg: '#DCFCE7', color: '#166534' },
}

const typeLabels: Record<string, string> = {
  LOAN: 'Loan',
  REVENUE_SHARE: 'Rev Share',
  SIB: 'SIB',
  EQUITY: 'Equity',
}

// ── Status pill colours ──────────────────────────────────────
const statusPillStyles: Record<string, { bg: string; color: string }> = {
  ACTIVE:    { bg: '#DCFCE7', color: '#166534' },
  COMPLETED: { bg: '#DBEAFE', color: '#1E40AF' },
  DEFAULTED: { bg: '#FEF2F2', color: '#991B1B' },
}

// ── Skeleton components ──────────────────────────────────────
function SkeletonPulse({ className = '', style = {} }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton-pulse rounded ${className}`} style={{ background: 'var(--donor-border)', ...style }} />
}

function InvestmentsSkeleton() {
  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <SkeletonPulse className="h-8 w-48" />
      <SkeletonPulse className="h-4 w-72" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <SkeletonPulse key={i} className="h-24 rounded-xl" />)}
      </div>
      <SkeletonPulse className="h-10 rounded-xl" />
      {[1, 2, 3, 4, 5].map(i => <SkeletonPulse key={i} className="h-14 rounded-xl" />)}
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────
export default function InvestmentsPage() {
  const t = useTranslations()
  const [investments, setInvestments] = useState<Investment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet('/api/donor/investments')
      .then(async r => {
        if (r.ok) {
          const data = await r.json()
          setInvestments(data.investments || [])
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <InvestmentsSkeleton />

  // ── Summary calculations ─────────────────────────────────
  const totalInvested = investments.reduce((s, inv) => s + inv.totalFacility, 0)
  const totalOutstanding = investments.reduce((s, inv) => s + inv.outstandingPrincipal, 0)
  const totalReturned = investments.reduce((s, inv) => s + inv.totalPaid, 0)
  const overdueCount = investments.filter(inv => inv.overdueCount > 0).length

  // Use the first investment's currency for summary, fallback to USD
  const summaryCurrency = investments.length > 0 ? investments[0].currency : 'USD'

  return (
    <div className="p-6 space-y-6 animate-fade-up max-w-6xl mx-auto">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--donor-dark)' }}>{t('investments.title')}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--donor-muted)' }}>{t('investments.subtitle')}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border px-4 py-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>{t('investments.totalInvested')}</p>
          <p className="text-2xl font-bold mt-1" style={{ color: 'var(--donor-dark)' }}>{formatMoney(totalInvested, summaryCurrency)}</p>
        </div>
        <div className="rounded-xl border px-4 py-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>{t('investments.totalOutstanding')}</p>
          <p className="text-2xl font-bold mt-1" style={{ color: 'var(--donor-dark)' }}>{formatMoney(totalOutstanding, summaryCurrency)}</p>
        </div>
        <div className="rounded-xl border px-4 py-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>{t('investments.totalReturned')}</p>
          <p className="text-2xl font-bold mt-1" style={{ color: '#166534' }}>{formatMoney(totalReturned, summaryCurrency)}</p>
        </div>
        <div className="rounded-xl border px-4 py-4" style={{ background: 'var(--bg-card)', borderColor: overdueCount > 0 ? '#FCA5A5' : 'var(--donor-border)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>{t('investments.overdue')}</p>
          <p className="text-2xl font-bold mt-1" style={{ color: overdueCount > 0 ? '#991B1B' : 'var(--donor-dark)' }}>{overdueCount}</p>
        </div>
      </div>

      {/* Table */}
      {investments.length === 0 ? (
        <div className="rounded-2xl border px-8 py-16 text-center" style={{ background: 'var(--donor-light)', borderColor: 'var(--donor-border)' }}>
          <p className="text-sm" style={{ color: 'var(--donor-muted)' }}>{t('investments.noInvestments')}</p>
        </div>
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--donor-border)', background: 'var(--donor-light)' }}>
                  <th className="text-left px-4 py-3 text-xs font-semibold" style={{ color: 'var(--donor-muted)' }}>{t('investments.project')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold" style={{ color: 'var(--donor-muted)' }}>{t('investments.type')}</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold" style={{ color: 'var(--donor-muted)' }}>{t('investments.facility')}</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold" style={{ color: 'var(--donor-muted)' }}>{t('investments.drawn')}</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold" style={{ color: 'var(--donor-muted)' }}>{t('investments.outstanding')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold" style={{ color: 'var(--donor-muted)' }}>{t('investments.nextRepayment')}</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold" style={{ color: 'var(--donor-muted)' }}>{t('investments.status')}</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold" style={{ color: 'var(--donor-muted)' }}>{t('investments.action')}</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--donor-border)' }}>
                {investments.map(inv => {
                  const tStyle = typePillStyles[inv.investmentType] || typePillStyles.LOAN
                  const sStyle = statusPillStyles[inv.status] || statusPillStyles.ACTIVE
                  const pct = drawnPct(inv.drawnDown, inv.totalFacility)
                  const repaymentOverdue = inv.nextRepayment && isOverdue(inv.nextRepayment.dueDate)

                  return (
                    <tr key={inv.id} className="hover:bg-[var(--donor-light)] transition-colors">
                      {/* PROJECT */}
                      <td className="px-4 py-3">
                        <Link href={`/projects/${inv.projectId}?tab=investment`} className="font-medium hover:underline" style={{ color: 'var(--donor-dark)' }}>
                          {inv.projectName}
                        </Link>
                      </td>

                      {/* TYPE */}
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: tStyle.bg, color: tStyle.color }}>
                          {typeLabels[inv.investmentType] || inv.investmentType}
                        </span>
                      </td>

                      {/* FACILITY */}
                      <td className="px-4 py-3 text-right font-medium" style={{ color: 'var(--donor-dark)' }}>
                        {formatMoney(inv.totalFacility, inv.currency)}
                      </td>

                      {/* DRAWN */}
                      <td className="px-4 py-3 text-right">
                        <span style={{ color: 'var(--donor-dark)' }}>{formatMoney(inv.drawnDown, inv.currency)}</span>
                        <span className="text-xs ml-1" style={{ color: 'var(--donor-muted)' }}>({pct}%)</span>
                      </td>

                      {/* OUTSTANDING */}
                      <td className="px-4 py-3 text-right font-medium" style={{ color: 'var(--donor-dark)' }}>
                        {formatMoney(inv.outstandingPrincipal, inv.currency)}
                      </td>

                      {/* NEXT REPAYMENT */}
                      <td className="px-4 py-3">
                        {inv.nextRepayment ? (
                          <div>
                            <span style={{ color: repaymentOverdue ? '#991B1B' : 'var(--donor-dark)' }}>
                              {fmtDate(inv.nextRepayment.dueDate)}
                            </span>
                            <br />
                            <span className="text-xs" style={{ color: repaymentOverdue ? '#991B1B' : 'var(--donor-muted)' }}>
                              {formatMoney(inv.nextRepayment.totalDue, inv.currency)}
                              {repaymentOverdue && <span className="ml-1 font-semibold">{t('investments.overdueLabel')}</span>}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--donor-muted)' }}>—</span>
                        )}
                      </td>

                      {/* STATUS */}
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: sStyle.bg, color: sStyle.color }}>
                          {inv.status}
                        </span>
                      </td>

                      {/* ACTION */}
                      <td className="px-4 py-3 text-center">
                        <Link href={`/projects/${inv.projectId}?tab=investment`} className="text-xs font-medium hover:underline" style={{ color: 'var(--donor-accent)' }}>
                          {t('investments.view')}
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
