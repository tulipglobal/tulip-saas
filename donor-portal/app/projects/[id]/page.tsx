'use client'

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { apiGet, apiPost, apiPut } from '@/lib/api'
import { formatMoney, formatMoneyCompact } from '@/lib/currency'
import Link from 'next/link'
import ShareModal from '../../../components/ShareModal'
import { useTranslations } from 'next-intl'

const VERIFY_URL = process.env.NEXT_PUBLIC_VERIFY_URL || 'https://verify.sealayer.io'

// ── Date helper ──────────────────────────────────────────────
function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return '—'
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
}

// ── Interfaces ───────────────────────────────────────────────
interface Expense {
  id: string; date: string; vendor: string; amount: number; currency: string
  category: string; expenditureType?: string; fraudRiskLevel: string; fraudRiskScore?: number
  sealId: string | null; sealStatus: string | null; anchorTxHash: string | null
}

interface ProjectData {
  project: {
    id: string; name: string; description: string; status: string; budget: number; funded: number; spent: number; remaining: number
    timePercent: number | null; financialPercent: number | null; completionPercent: number
    isOverdue: boolean; isClosed: boolean; hasEndDate: boolean; startDate: string | null; endDate: string | null
    tenantName?: string; hasFunding?: boolean
  }
  expenses: Expense[]
  duplicateGroups?: { hash: string; expenses: { id: string; vendor: string; amount: number; currency: string; date: string; sealStatus: string }[] }[]
}

interface ExpenseDetail {
  expense: { id: string; date: string; createdAt: string; vendor: string; description: string; amount: number; currency: string; category: string; subCategory: string | null; projectName: string; fraudRiskScore: number; fraudRiskLevel: string; approvalStatus: string }
  ocrComparison: { field: string; ocr: string | number | null; submitted: string | number; match: boolean }[]
  fraudFlags: { type: string; level: string; message: string }[]
  seal: { id: string; hash: string; status: string; anchorTxHash: string | null; anchoredAt: string | null; blockNumber: number | null } | null
  receiptUrl: string | null
}

interface BudgetCategory {
  id: string | null; category: string; subCategory: string | null; expenseType: string | null
  budget: number; spent: number; remaining: number; pctUsed: number; currency: string
}

interface BudgetData {
  categories: BudgetCategory[]; monthlySpend: { month: string; spent: number }[]
  totalBudget: number; totalSpent: number; remaining: number; projectedOverrunDate: string | null
}

interface AuditEntry {
  id: string; action: string; entity: string; entityId: string; hash: string; prevHash: string | null
  anchorTxHash: string | null; createdAt: string; expenseId?: string | null
}

interface DonorRequest {
  id: string; type: string; title: string; description: string | null; status: string
  deadline: string; createdAt: string; confirmedAt: string | null
  submissionNote: string | null; reworkNote: string | null
  documents: { id: string; name: string; url: string; sealId: string | null }[]
}

interface MilestoneUpdate {
  id: string; date: string; previousValue: number; newValue: number; note: string | null
}

interface MilestoneEvidence {
  id: string; name: string; url: string; sealId: string | null
}

interface Milestone {
  id: string; title: string; description: string | null; category: string; targetValue: number
  currentValue: number; unit: string; targetDate: string; status: string
  updates: MilestoneUpdate[]; evidence: MilestoneEvidence[]
}

// ── Small components ─────────────────────────────────────────
function RiskPill({ level }: { level: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    LOW: { bg: '#DCFCE7', text: '#16A34A' }, MEDIUM: { bg: '#FEF3E8', text: '#B45309' },
    HIGH: { bg: '#FEE2E2', text: '#DC2626' }, CRITICAL: { bg: '#FEE2E2', text: '#DC2626' },
  }
  const c = colors[level] || colors.LOW
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: c.bg, color: c.text }}>{level}</span>
}

function SealPill({ sealId }: { sealId: string | null }) {
  const t = useTranslations('projectDetail')
  if (!sealId) return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">{t('pending')}</span>
  return (
    <a href={`${VERIFY_URL}/seal/${sealId}`} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity"
      style={{ background: 'var(--donor-light)', color: 'var(--donor-accent)' }}>{t('anchored')}</a>
  )
}

function CapExOpExPill({ type }: { type: string | undefined }) {
  const t = useTranslations('projectDetail')
  if (!type) return null
  const isCapex = type === 'CAPEX'
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{
      background: isCapex ? '#EFF6FF' : '#F3F4F6',
      color: isCapex ? '#1D4ED8' : '#4B5563',
    }}>
      {isCapex ? t('capEx') : t('opEx')}
    </span>
  )
}

function BudgetCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="rounded-xl border px-4 py-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
      <p className="text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>{label}</p>
      <p className="text-xl font-bold mt-1" style={{ color: highlight ? '#DC2626' : 'var(--donor-dark)' }}>
        {formatMoney(value || 0, 'USD')}
      </p>
    </div>
  )
}

// ── Funding Breakdown Panel ──────────────────────────────────
function FundingBreakdownPanel({ projectName, data, onClose }: {
  projectName: string; data: { breakdown: any[]; totalsByCurrency: any[] } | null; onClose: () => void
}) {
  const t = useTranslations('projectDetail')
  const statusColors: Record<string, { bg: string; text: string }> = {
    ACTIVE: { bg: '#DCFCE7', text: '#166534' },
    COMPLETED: { bg: '#DBEAFE', text: '#1D4ED8' },
    DRAFT: { bg: '#F3F4F6', text: '#6B7280' },
  }
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="relative w-full max-w-xl bg-[var(--bg-card)] h-full overflow-y-auto shadow-2xl animate-fade-up"
        style={{ borderLeft: '1px solid var(--donor-border)' }}
        onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b" style={{ background: 'var(--donor-light)', borderColor: 'var(--donor-border)' }}>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--donor-dark)' }}>{t('fundingBreakdown')}</h2>
            <p className="text-xs" style={{ color: 'var(--donor-muted)' }}>{projectName}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--donor-border)] text-lg" style={{ color: 'var(--donor-muted)' }}>&times;</button>
        </div>
        <div className="px-6 py-5">
          {!data ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin w-6 h-6 border-2 border-[var(--donor-accent)] border-t-transparent rounded-full" />
            </div>
          ) : (data.breakdown || []).length === 0 ? (
            <p className="text-sm text-center py-10" style={{ color: 'var(--donor-muted)' }}>{t('noFundingAgreements')}</p>
          ) : (
            <>
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--donor-border)' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'var(--donor-light)' }}>
                      <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('agreement')}</th>
                      <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('donorOrganisation')}</th>
                      <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('amount')}</th>
                      <th className="text-center px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('currency')}</th>
                      <th className="text-center px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.breakdown || []).map((row, i) => {
                      const sc = statusColors[(row.status || '').toUpperCase()] || statusColors.DRAFT
                      return (
                        <tr key={i} className="border-t" style={{ borderColor: 'var(--donor-border)' }}>
                          <td className="px-4 py-3 font-medium" style={{ color: 'var(--donor-dark)' }}>{row.agreementName}</td>
                          <td className="px-4 py-3" style={{ color: row.isOwnOrg ? 'var(--donor-accent)' : 'var(--donor-dark)', fontWeight: row.isOwnOrg ? 600 : 400 }}>
                            {row.donorOrgName}{row.isOwnOrg ? ` (${t('you')})` : ''}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-medium" style={{ color: 'var(--donor-dark)' }}>
                            {Number(row.allocatedAmount || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-center" style={{ color: 'var(--donor-muted)' }}>{row.currency || 'USD'}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: sc.bg, color: sc.text }}>
                              {(row.status || 'DRAFT').toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {Array.isArray(data.totalsByCurrency) && data.totalsByCurrency.length > 0 && (
                <div className="mt-4 px-4 py-3 rounded-xl" style={{ background: 'var(--donor-light)' }}>
                  <p className="text-sm font-bold" style={{ color: 'var(--donor-dark)' }}>
                    {t('total')}: {data.totalsByCurrency.map(tc => formatMoney(Number(tc.total), tc.currency)).join(' \u00b7 ')}
                  </p>
                </div>
              )}
              <p className="text-xs italic mt-4" style={{ color: 'var(--donor-muted)' }}>
                {t('fundingVerifiedBySealayer')}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Expense Detail Panel ─────────────────────────────────────
function ExpenseDetailPanel({ projectId, expenseId, onClose }: { projectId: string; expenseId: string; onClose: () => void }) {
  const t = useTranslations('projectDetail')
  const [detail, setDetail] = useState<ExpenseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    apiGet(`/api/donor/projects/${projectId}/expenses/${expenseId}`)
      .then(async r => { if (r.ok) setDetail(await r.json()); setLoading(false) })
      .catch(() => setLoading(false))
  }, [projectId, expenseId])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.3)' }}>
      <div ref={panelRef} className="w-full max-w-lg bg-[var(--bg-card)] h-full overflow-y-auto shadow-2xl animate-slide-in-right">
        {/* Header */}
        <div className="sticky top-0 bg-[var(--bg-card)] border-b px-6 py-4 flex items-center justify-between z-10" style={{ borderColor: 'var(--donor-border)' }}>
          <h2 className="text-lg font-bold" style={{ color: 'var(--donor-dark)' }}>{t('expenseDetail')}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 text-gray-500 text-lg">&times;</button>
        </div>

        {loading ? (
          <div className="p-6"><p className="text-sm" style={{ color: 'var(--donor-muted)' }}>{t('loading')}</p></div>
        ) : !detail ? (
          <div className="p-6"><p className="text-sm text-red-500">{t('failedToLoadExpense')}</p></div>
        ) : (
          <div className="p-6 space-y-5">
            {/* Basic info */}
            <div className="space-y-2">
              <Row label={t('date')} value={fmtDate(detail.expense.date)} />
              <Row label={t('vendor')} value={detail.expense.vendor} />
              <Row label={t('amount')} value={formatMoney(detail.expense.amount || 0, detail.expense.currency || 'USD')} />
              <Row label={t('category')} value={`${detail.expense.category}${detail.expense.subCategory ? ' / ' + detail.expense.subCategory : ''}`} />
              <Row label={t('project')} value={detail.expense.projectName} />
            </div>

            {/* OCR Comparison Table */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--donor-muted)' }}>{t('ocrExtractedVsSubmitted')}</h3>
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--donor-border)' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'var(--donor-border)', background: 'var(--donor-light)' }}>
                      <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>{t('field')}</th>
                      <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>{t('ocrRead')}</th>
                      <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>{t('submitted')}</th>
                      <th className="text-center px-3 py-2 text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>{t('matchQuestion')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.ocrComparison || []).map(row => (
                      <tr key={row.field} className="border-b last:border-0" style={{
                        borderColor: 'var(--donor-border)',
                        background: row.match ? 'transparent' : '#FFFBEB'
                      }}>
                        <td className="px-3 py-2 font-medium" style={{ color: 'var(--donor-dark)' }}>{row.field}</td>
                        <td className="px-3 py-2" style={{ color: 'var(--donor-dark)' }}>
                          {row.field === 'Date' ? fmtDate(row.ocr as string) : (row.ocr != null ? String(row.ocr) : '—')}
                        </td>
                        <td className="px-3 py-2" style={{ color: 'var(--donor-dark)' }}>
                          {row.field === 'Date' ? fmtDate(row.submitted as string) : String(row.submitted)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {row.match
                            ? <span className="text-green-600 font-medium">&#10003;</span>
                            : <span className="text-amber-600 font-medium">&#10007;</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Fraud flags */}
            {(detail.fraudFlags || []).length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('fraudFlags')}</h3>
                {(detail.fraudFlags || []).map((flag, i) => (
                  <div key={i} className="rounded-lg px-4 py-3 text-sm" style={{
                    background: flag.level === 'HIGH' || flag.level === 'CRITICAL' ? '#FEE2E2' : '#FEF3E8',
                    color: flag.level === 'HIGH' || flag.level === 'CRITICAL' ? '#DC2626' : '#B45309',
                    border: `1px solid ${flag.level === 'HIGH' || flag.level === 'CRITICAL' ? '#FECACA' : '#FDE68A'}`
                  }}>
                    {flag.message}
                  </div>
                ))}
              </div>
            )}

            {/* Fraud score */}
            <div className="rounded-lg border px-4 py-3" style={{ borderColor: 'var(--donor-border)' }}>
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--donor-muted)' }}>{t('fraudScore')}</p>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold" style={{ color: 'var(--donor-dark)' }}>{detail.expense.fraudRiskScore ?? 0}/100</span>
                <RiskPill level={detail.expense.fraudRiskLevel} />
              </div>
            </div>

            {/* Seal section */}
            {detail.seal && (
              <div className="rounded-lg border px-4 py-3 space-y-2" style={{ borderColor: 'var(--donor-border)' }}>
                <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('blockchainSeal')}</h3>
                <Row label={t('hash')} value={detail.seal.hash ? detail.seal.hash.slice(0, 16) + '...' + detail.seal.hash.slice(-8) : '—'} />
                <Row label={t('anchoredLabel')} value={fmtDate(detail.seal.anchoredAt)} />
                {detail.seal.anchorTxHash && (
                  <div className="flex items-center gap-2 text-sm">
                    <span style={{ color: 'var(--donor-muted)' }}>{t('polygonTx')}</span>
                    <a href={`https://polygonscan.com/tx/${detail.seal.anchorTxHash}`} target="_blank" rel="noopener noreferrer"
                      className="hover:underline font-mono text-xs" style={{ color: 'var(--donor-accent)' }}>
                      {detail.seal.anchorTxHash.slice(0, 10)}...{detail.seal.anchorTxHash.slice(-6)}
                    </a>
                  </div>
                )}
                <a href={`${VERIFY_URL}/seal/${detail.seal.id}`} target="_blank" rel="noopener noreferrer"
                  className="inline-block mt-1 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#3C3489' }}>
                  {t('verifyIndependently')}
                </a>
              </div>
            )}

            {/* Receipt */}
            {detail.receiptUrl && (
              <a href={detail.receiptUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border hover:bg-gray-50 transition-all"
                style={{ borderColor: 'var(--donor-border)', color: 'var(--donor-accent)' }}>
                {t('viewReceipt')}
              </a>
            )}

            {/* Donor Challenge */}
            <ChallengeSection projectId={projectId} expenseId={expenseId} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Challenge Section ──────────────────────────────────────────
function ChallengeSection({ projectId, expenseId }: { projectId: string; expenseId: string }) {
  const t = useTranslations('projectDetail')
  const [challenges, setChallenges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [respondNote, setRespondNote] = useState('')

  const fetchChallenges = useCallback(async () => {
    try {
      const r = await apiGet(`/api/donor/expenses/${expenseId}/challenges`)
      if (r.ok) {
        const data = await r.json()
        setChallenges(data.challenges || [])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [expenseId])

  useEffect(() => { fetchChallenges() }, [fetchChallenges])

  const handleSubmitFlag = async () => {
    if (!note.trim()) return
    setSubmitting(true)
    setError('')
    try {
      const r = await apiPost(`/api/donor/expenses/${expenseId}/challenge`, { note: note.trim() })
      if (r.ok) {
        setShowForm(false)
        setNote('')
        fetchChallenges()
      } else {
        const data = await r.json()
        setError(data.error || t('failedToSubmitFlag'))
      }
    } catch { setError(t('networkError')) }
    setSubmitting(false)
  }

  const handleRespond = async (challengeId: string, action: 'CONFIRM' | 'ESCALATE') => {
    if (!respondNote.trim()) return
    setSubmitting(true)
    try {
      const r = await apiPost(`/api/donor/challenges/${challengeId}/respond`, { action, note: respondNote.trim() })
      if (r.ok) {
        setRespondNote('')
        fetchChallenges()
      }
    } catch { /* ignore */ }
    setSubmitting(false)
  }

  if (loading) return null

  const activeChallenge = challenges.find((c: any) => ['OPEN', 'RESPONDED', 'ESCALATED', 'CONFIRMED'].includes(c.status))

  const statusPill = (status: string) => {
    const styles: Record<string, { bg: string; text: string }> = {
      OPEN: { bg: '#FEF3E8', text: '#B45309' },
      RESPONDED: { bg: '#EBF5FB', text: '#1565C0' },
      ESCALATED: { bg: '#FFEBEE', text: '#C62828' },
      CONFIRMED: { bg: '#E8F5E9', text: '#2E7D32' },
    }
    const s = styles[status] || styles.OPEN
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: s.bg, color: s.text }}>
      {status === 'CONFIRMED' ? `${t('resolvedCheck')} \u2713` : status}
    </span>
  }

  return (
    <div className="border-t pt-4 mt-4" style={{ borderColor: 'var(--donor-border)' }}>
      <h3 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--donor-muted)' }}>{t('donorChallenge')}</h3>

      {!activeChallenge && !showForm && (
        <button onClick={() => setShowForm(true)}
          className="px-4 py-2 rounded-lg text-sm font-medium border transition-all hover:bg-[#FEF3E8]"
          style={{ borderColor: '#B45309', color: '#B45309' }}>
          {t('flagThisExpense')}
        </button>
      )}

      {showForm && (
        <div className="space-y-3 animate-fade-up">
          <label className="text-xs font-medium block" style={{ color: 'var(--donor-dark)' }}>{t('yourNoteToNgo')}</label>
          <textarea value={note} onChange={e => setNote(e.target.value.slice(0, 500))} rows={3}
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-all"
            style={{ borderColor: 'var(--donor-border)', color: 'var(--donor-dark)' }}
            placeholder={t('flagPlaceholder')} />
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--donor-muted)' }}>{note.length}/500</span>
            <div className="flex gap-2">
              <button onClick={() => { setShowForm(false); setNote(''); setError('') }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>{t('cancel')}</button>
              <button onClick={handleSubmitFlag} disabled={submitting || !note.trim()}
                className="px-4 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                style={{ background: '#B45309' }}>
                {submitting ? t('submittingFlag') : t('submitFlag')}
              </button>
            </div>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      )}

      {activeChallenge && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            {statusPill(activeChallenge.status)}
          </div>

          {/* Timeline */}
          <div className="space-y-3">
            {/* Original donor flag */}
            <div className="rounded-lg px-4 py-3 text-sm" style={{ background: '#FEF3E8', borderLeft: '3px solid #B45309' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold" style={{ color: '#B45309' }}>{t('youFlaggedThisExpense')}</span>
                <span className="text-xs" style={{ color: 'var(--donor-muted)' }}>{fmtDate(activeChallenge.createdAt)}</span>
              </div>
              <p style={{ color: 'var(--donor-dark)' }}>{activeChallenge.note}</p>
            </div>

            {/* Responses */}
            {activeChallenge.responses?.map((resp: any, i: number) => {
              const isNGO = resp.respondedByType === 'NGO'
              const actionLabel = resp.action === 'EXPLAIN' ? t('providedExplanation')
                : resp.action === 'VOID_REQUESTED' ? t('offeredToVoidExpense')
                : resp.action === 'CONFIRM' ? t('youConfirmed')
                : resp.action === 'ESCALATE' ? t('youReflagged')
                : resp.action

              const bg = isNGO ? 'var(--donor-light)' : resp.action === 'CONFIRM' ? '#E8F5E9' : '#FFEBEE'
              const border = isNGO ? 'var(--donor-accent)' : resp.action === 'CONFIRM' ? '#2E7D32' : '#C62828'

              return (
                <div key={resp.id || i} className="rounded-lg px-4 py-3 text-sm" style={{ background: bg, borderLeft: `3px solid ${border}` }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold" style={{ color: border }}>
                      {isNGO ? t('ngoRespondedAction', { action: actionLabel }) : actionLabel}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--donor-muted)' }}>{fmtDate(resp.createdAt)}</span>
                  </div>
                  <p style={{ color: 'var(--donor-dark)' }}>{resp.note}</p>
                </div>
              )
            })}
          </div>

          {/* Action buttons when status is RESPONDED */}
          {activeChallenge.status === 'RESPONDED' && (
            <div className="space-y-3 pt-2">
              <textarea value={respondNote} onChange={e => setRespondNote(e.target.value.slice(0, 500))} rows={2}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                style={{ borderColor: 'var(--donor-border)', color: 'var(--donor-dark)' }}
                placeholder={t('addResponseNote')} />
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--donor-muted)' }}>{respondNote.length}/500</span>
                <div className="flex gap-2">
                  <button onClick={() => handleRespond(activeChallenge.id, 'CONFIRM')}
                    disabled={submitting || !respondNote.trim()}
                    className="px-4 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                    style={{ background: '#2E7D32' }}>
                    {'\u2713'} {t('confirmSatisfied')}
                  </button>
                  <button onClick={() => handleRespond(activeChallenge.id, 'ESCALATE')}
                    disabled={submitting || !respondNote.trim()}
                    className="px-4 py-1.5 rounded-lg text-xs font-medium border disabled:opacity-50"
                    style={{ borderColor: '#B45309', color: '#B45309' }}>
                    {'\u2691'} {t('reflagNotSatisfied')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="shrink-0 w-20" style={{ color: 'var(--donor-muted)' }}>{label}</span>
      <span className="font-medium" style={{ color: 'var(--donor-dark)' }}>{value}</span>
    </div>
  )
}

// ── Fraud Tab ────────────────────────────────────────────────
function FraudTab({ expenses, projectId, onExpenseClick, duplicateGroups }: { expenses: Expense[]; projectId: string; onExpenseClick: (id: string) => void; duplicateGroups: NonNullable<ProjectData['duplicateGroups']> }) {
  const t = useTranslations('projectDetail')
  const flagged = expenses.filter(e => e.fraudRiskLevel !== 'LOW')
  const highBlocked = expenses.filter(e => e.fraudRiskLevel === 'HIGH' || e.fraudRiskLevel === 'CRITICAL')
  const mediumCount = expenses.filter(e => e.fraudRiskLevel === 'MEDIUM').length
  const mismatchCount = flagged.length // approximate
  const amountProtected = highBlocked.reduce((s, e) => s + (e.amount || 0), 0)

  const [challenges, setChallenges] = useState<any[]>([])
  useEffect(() => {
    apiGet('/api/donor/challenges')
      .then(async r => { if (r.ok) { const d = await r.json(); setChallenges((d.challenges || []).filter((c: any) => c.projectId === projectId)) } })
      .catch(() => {})
  }, [projectId])

  const lowCount = expenses.filter(e => e.fraudRiskLevel === 'LOW').length
  const highCount = highBlocked.length
  const maxBar = Math.max(lowCount, mediumCount, highCount, 1)

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MiniCard label={t('totalFlagged')} value={String(flagged.length)} />
        <MiniCard label={t('highCritical')} value={String(highBlocked.length)} color="#DC2626" />
        <MiniCard label={t('amountProtected')} value={formatMoney(amountProtected, 'USD')} color="#16A34A" />
        <MiniCard label={t('ocrMismatches')} value={String(mismatchCount)} />
        <MiniCard label={t('mediumRisk')} value={String(mediumCount)} color="#B45309" />
      </div>

      {/* Fraud events table */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
        <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--donor-border)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--donor-dark)' }}>{t('fraudEventsCount', { count: flagged.length })}</h2>
        </div>
        {flagged.length === 0 ? (
          <div className="px-5 py-8 text-center"><p className="text-sm" style={{ color: 'var(--donor-muted)' }}>{t('noFraudEvents')}</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--donor-border)' }}>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('date')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('expense')}</th>
                  <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('amount')}</th>
                  <th className="text-center px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('riskLevel')}</th>
                  <th className="text-center px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('outcome')}</th>
                </tr>
              </thead>
              <tbody>
                {flagged.map(e => (
                  <tr key={e.id} onClick={() => onExpenseClick(e.id)}
                    className="border-b last:border-0 hover:bg-[var(--donor-light)] transition-all cursor-pointer" style={{ borderColor: 'var(--donor-border)' }}>
                    <td className="px-4 py-3" style={{ color: 'var(--donor-dark)' }}>{fmtDate(e.date)}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--donor-dark)' }}>{e.vendor || '—'}</td>
                    <td className="px-4 py-3 text-right font-mono" style={{ color: 'var(--donor-dark)' }}>{formatMoney(e.amount || 0, e.currency || 'USD')}</td>
                    <td className="px-4 py-3 text-center"><RiskPill level={e.fraudRiskLevel} /></td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{
                        background: e.fraudRiskLevel === 'HIGH' || e.fraudRiskLevel === 'CRITICAL' ? '#FEE2E2' : '#DCFCE7',
                        color: e.fraudRiskLevel === 'HIGH' || e.fraudRiskLevel === 'CRITICAL' ? '#DC2626' : '#16A34A',
                      }}>
                        {e.fraudRiskLevel === 'HIGH' || e.fraudRiskLevel === 'CRITICAL' ? t('flagged') : t('approved')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Fraud score distribution */}
      <div className="rounded-2xl border px-5 py-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--donor-dark)' }}>{t('riskDistribution')}</h3>
        <div className="space-y-3">
          <BarRow label="LOW" count={lowCount} max={maxBar} color="#16A34A" />
          <BarRow label="MEDIUM" count={mediumCount} max={maxBar} color="#F59E0B" />
          <BarRow label="HIGH" count={highCount} max={maxBar} color="#DC2626" />
        </div>
      </div>

      {/* Duplicate Documents Detected */}
      {duplicateGroups.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: '#FFF8E1', borderLeft: '4px solid #F57F17' }}>
          <div className="px-5 py-3">
            <h3 className="text-sm font-semibold" style={{ color: '#F57F17' }}>{t('duplicateDocumentsDetected')}</h3>
          </div>
          <div className="px-5 pb-4 space-y-4">
            {duplicateGroups.map((group, gi) => (
              <div key={gi} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono" style={{ color: 'var(--donor-dark)' }}>
                    {t('sharedHash', { hash: group.hash.slice(0, 8) + '...' + group.hash.slice(-8) })}
                  </span>
                  <button onClick={() => { navigator.clipboard.writeText(group.hash) }}
                    className="text-xs px-2 py-0.5 rounded border hover:bg-white transition-all"
                    style={{ borderColor: 'var(--donor-border)', color: 'var(--donor-accent)' }}>{t('copy')}</button>
                </div>
                <p className="text-xs" style={{ color: '#B45309' }}>
                  {t('duplicateDocumentWarning')}
                </p>
                <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--donor-border)', background: 'var(--bg-card)' }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b" style={{ borderColor: 'var(--donor-border)' }}>
                        <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>{t('date')}</th>
                        <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>{t('vendor')}</th>
                        <th className="text-right px-3 py-2 text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>{t('amount')}</th>
                        <th className="text-center px-3 py-2 text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>{t('seal')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(group.expenses || []).map(exp => (
                        <tr key={exp.id} className="border-b last:border-0" style={{ borderColor: 'var(--donor-border)' }}>
                          <td className="px-3 py-2" style={{ color: 'var(--donor-dark)' }}>{fmtDate(exp.date)}</td>
                          <td className="px-3 py-2">
                            <button onClick={() => onExpenseClick(exp.id)}
                              className="font-medium hover:underline cursor-pointer" style={{ color: 'var(--donor-accent)' }}>
                              {exp.vendor || '\u2014'}
                            </button>
                          </td>
                          <td className="px-3 py-2 text-right font-mono" style={{ color: 'var(--donor-dark)' }}>
                            {exp.currency} {exp.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                              style={{ background: exp.sealStatus === 'ANCHORED' ? 'var(--donor-light)' : 'var(--donor-light)', color: exp.sealStatus === 'ANCHORED' ? 'var(--donor-accent)' : 'var(--donor-muted)' }}>
                              {exp.sealStatus || 'Pending'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Your Flags & Challenges */}
      {challenges.length > 0 && (
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
          <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--donor-border)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--donor-dark)' }}>{t('yourFlagsChallengesCount', { count: challenges.length })}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--donor-border)' }}>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase" style={{ color: 'var(--donor-muted)' }}>{t('expense')}</th>
                  <th className="text-right px-4 py-3 text-xs font-medium uppercase" style={{ color: 'var(--donor-muted)' }}>{t('amount')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase" style={{ color: 'var(--donor-muted)' }}>{t('dateFlagged')}</th>
                  <th className="text-center px-4 py-3 text-xs font-medium uppercase" style={{ color: 'var(--donor-muted)' }}>{t('status')}</th>
                  <th className="text-center px-4 py-3 text-xs font-medium uppercase" style={{ color: 'var(--donor-muted)' }}>{t('action')}</th>
                </tr>
              </thead>
              <tbody>
                {challenges.map((c: any) => {
                  const statusStyles: Record<string, { bg: string; text: string }> = {
                    OPEN: { bg: '#FEF3E8', text: '#B45309' },
                    RESPONDED: { bg: '#EBF5FB', text: '#1565C0' },
                    ESCALATED: { bg: '#FFEBEE', text: '#C62828' },
                    CONFIRMED: { bg: '#E8F5E9', text: '#2E7D32' },
                  }
                  const ss = statusStyles[c.status] || statusStyles.OPEN
                  return (
                    <tr key={c.id} className="border-b last:border-0" style={{ borderColor: 'var(--donor-border)' }}>
                      <td className="px-4 py-3">
                        <button onClick={() => onExpenseClick(c.expenseId)} className="font-medium hover:underline" style={{ color: 'var(--donor-accent)' }}>
                          {c.expense?.vendor || '\u2014'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right font-mono" style={{ color: 'var(--donor-dark)' }}>
                        {formatMoney(c.expense?.amount || 0, c.expense?.currency || 'USD')}
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--donor-dark)' }}>{fmtDate(c.createdAt)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: ss.bg, color: ss.text }}>
                          {c.status === 'CONFIRMED' ? t('resolved') : c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => onExpenseClick(c.expenseId)} className="text-xs hover:underline" style={{ color: 'var(--donor-accent)' }}>{t('view')}</button>
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

function BarRow({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const pct = max > 0 ? (count / max) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>{label}</span>
      <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background: 'var(--donor-light)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color, minWidth: count > 0 ? '8px' : '0' }} />
      </div>
      <span className="w-8 text-right text-xs font-bold" style={{ color: 'var(--donor-dark)' }}>{count}</span>
    </div>
  )
}

function MiniCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border px-3 py-3" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
      <p className="text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>{label}</p>
      <p className="text-lg font-bold mt-0.5" style={{ color: color || 'var(--donor-dark)' }}>{value}</p>
    </div>
  )
}

// ── Budget Tab ───────────────────────────────────────────────
function BudgetTab({ projectId, onMonthClick }: { projectId: string; onMonthClick?: (month: string) => void }) {
  const t = useTranslations('projectDetail')
  const [data, setData] = useState<BudgetData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet(`/api/donor/projects/${projectId}/budget`)
      .then(async r => { if (r.ok) setData(await r.json()); setLoading(false) })
      .catch(() => setLoading(false))
  }, [projectId])

  if (loading) return <p className="text-sm py-4" style={{ color: 'var(--donor-muted)' }}>{t('loadingBudget')}</p>
  if (!data) return <p className="text-sm py-4 text-red-500">{t('failedToLoadBudget')}</p>

  const monthLabels = (data.monthlySpend || []).map(m => {
    const [y, mo] = m.month.split('-')
    return new Date(Number(y), Number(mo) - 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
  })
  const maxSpend = Math.max(...(data.monthlySpend || []).map(m => m.spent), 1)

  return (
    <div className="space-y-6">
      {/* Overrun warning */}
      {data.projectedOverrunDate && data.remaining <= 0 && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ background: '#FEF3E8', color: '#B45309', border: '1px solid #FDE68A' }}>
          {t('budgetExceeded', { amount: formatMoney(Math.abs(data.remaining), 'USD') })}
        </div>
      )}
      {data.projectedOverrunDate && data.remaining > 0 && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ background: '#FEF3E8', color: '#B45309', border: '1px solid #FDE68A' }}>
          {t('budgetProjectedOverrun', { date: fmtDate(data.projectedOverrunDate) })}
        </div>
      )}

      {/* Budget vs Actual table — grouped by CapEx / OpEx */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
        <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--donor-border)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--donor-dark)' }}>{t('budgetVsActual')}</h2>
        </div>
        <div className="overflow-x-auto">
          {(() => {
            const cats = data.categories || []
            const capexCats = cats.filter(c => c.expenseType === 'CAPEX')
            const opexCats = cats.filter(c => c.expenseType !== 'CAPEX')

            const subtotal = (list: BudgetCategory[]) => ({
              budget: list.reduce((s, c) => s + c.budget, 0),
              spent: list.reduce((s, c) => s + c.spent, 0),
              remaining: list.reduce((s, c) => s + c.remaining, 0),
              pctUsed: list.reduce((s, c) => s + c.budget, 0) > 0 ? Math.round(list.reduce((s, c) => s + c.spent, 0) / list.reduce((s, c) => s + c.budget, 0) * 100) : 0,
            })
            const capexSub = subtotal(capexCats)
            const opexSub = subtotal(opexCats)

            const pctPill = (pct: number) => (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{
                background: pct > 90 ? '#FEE2E2' : pct > 70 ? '#FEF3E8' : '#DCFCE7',
                color: pct > 90 ? '#DC2626' : pct > 70 ? '#B45309' : '#16A34A',
              }}>{pct}%</span>
            )

            const renderRows = (list: BudgetCategory[]) => list.map((c, i) => (
              <tr key={c.id || i} className="border-b last:border-0" style={{ borderColor: 'var(--donor-border)' }}>
                <td className="px-4 py-3 pl-8 font-medium" style={{ color: 'var(--donor-dark)' }}>{c.category}</td>
                <td className="px-4 py-3 text-right font-mono" style={{ color: 'var(--donor-dark)' }}>{formatMoney(c.budget, c.currency || 'USD')}</td>
                <td className="px-4 py-3 text-right font-mono" style={{ color: 'var(--donor-dark)' }}>{formatMoney(c.spent, c.currency || 'USD')}</td>
                <td className="px-4 py-3 text-right font-mono" style={{ color: c.remaining < 0 ? '#DC2626' : 'var(--donor-dark)' }}>{formatMoney(c.remaining, c.currency || 'USD')}</td>
                <td className="px-4 py-3 text-right">{pctPill(c.pctUsed)}</td>
              </tr>
            ))

            const renderSubtotalRow = (label: string, sub: ReturnType<typeof subtotal>) => (
              <tr className="border-b" style={{ borderColor: 'var(--donor-border)', background: 'var(--bg-card)' }}>
                <td className="px-4 py-2.5 pl-8 text-xs font-bold" style={{ color: 'var(--donor-dark)' }}>{label}</td>
                <td className="px-4 py-2.5 text-right font-mono text-xs font-bold" style={{ color: 'var(--donor-dark)' }}>{formatMoney(sub.budget, 'USD')}</td>
                <td className="px-4 py-2.5 text-right font-mono text-xs font-bold" style={{ color: 'var(--donor-dark)' }}>{formatMoney(sub.spent, 'USD')}</td>
                <td className="px-4 py-2.5 text-right font-mono text-xs font-bold" style={{ color: sub.remaining < 0 ? '#DC2626' : 'var(--donor-dark)' }}>{formatMoney(sub.remaining, 'USD')}</td>
                <td className="px-4 py-2.5 text-right">{pctPill(sub.pctUsed)}</td>
              </tr>
            )

            return (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--donor-border)' }}>
                    <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('category')}</th>
                    <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('budget')}</th>
                    <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('actual')}</th>
                    <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('variance')}</th>
                    <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {/* CAPEX section */}
                  {capexCats.length > 0 && (
                    <>
                      <tr style={{ background: '#EFF6FF' }}>
                        <td colSpan={5} className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#1D4ED8' }}>{t('capitalExpenditureCapEx')}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: '#DBEAFE', color: '#1D4ED8' }}>{capexCats.length}</span>
                          </div>
                        </td>
                      </tr>
                      {renderRows(capexCats)}
                      {renderSubtotalRow(t('capExSubtotal'), capexSub)}
                    </>
                  )}
                  {/* OPEX section */}
                  {opexCats.length > 0 && (
                    <>
                      <tr style={{ background: '#F3F4F6' }}>
                        <td colSpan={5} className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#4B5563' }}>{t('operatingExpenditureOpEx')}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: '#E5E7EB', color: '#4B5563' }}>{opexCats.length}</span>
                          </div>
                        </td>
                      </tr>
                      {renderRows(opexCats)}
                      {renderSubtotalRow(t('opExSubtotal'), opexSub)}
                    </>
                  )}
                  {/* Total row */}
                  <tr className="border-t-2 font-bold" style={{ borderColor: 'var(--donor-border)' }}>
                    <td className="px-4 py-3" style={{ color: 'var(--donor-dark)' }}>{t('total')}</td>
                    <td className="px-4 py-3 text-right font-mono" style={{ color: 'var(--donor-dark)' }}>{formatMoney(data.totalBudget, 'USD')}</td>
                    <td className="px-4 py-3 text-right font-mono" style={{ color: 'var(--donor-dark)' }}>{formatMoney(data.totalSpent, 'USD')}</td>
                    <td className="px-4 py-3 text-right font-mono" style={{ color: data.remaining < 0 ? '#DC2626' : 'var(--donor-dark)' }}>{formatMoney(data.remaining, 'USD')}</td>
                    <td className="px-4 py-3 text-right">
                      {pctPill(data.totalBudget > 0 ? Math.round(data.totalSpent / data.totalBudget * 100) : 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            )
          })()}
        </div>
      </div>

      {/* Monthly spend chart */}
      {(data.monthlySpend || []).length > 0 && (
        <div className="rounded-2xl border px-5 py-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--donor-dark)' }}>{t('monthlySpendLast6')}</h3>
          <div className="flex items-end gap-2 h-40">
            {(data.monthlySpend || []).map((m, i) => {
              const h = maxSpend > 0 ? (m.spent / maxSpend) * 100 : 0
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 cursor-pointer group"
                  onClick={() => onMonthClick?.(m.month)} title={`${monthLabels[i]}: ${formatMoney(m.spent, 'USD')}`}>
                  <span className="text-xs font-mono" style={{ color: 'var(--donor-dark)' }}>{formatMoneyCompact(m.spent, 'USD')}</span>
                  <div className="w-full rounded-t-md group-hover:opacity-80 transition-opacity" style={{ height: `${Math.max(h, 4)}%`, background: 'var(--donor-accent)', minHeight: '4px' }} />
                  <span className="text-xs" style={{ color: 'var(--donor-muted)' }}>{monthLabels[i]}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Vendor Panel (slide-in) ───────────────────────────────────
function VendorPanel({ vendor, expenses, currency, onClose, onExpenseClick }: {
  vendor: string; expenses: Expense[]; currency: string; onClose: () => void; onExpenseClick: (id: string) => void
}) {
  const t = useTranslations('projectDetail')
  const vendorExps = expenses.filter(e => e.vendor === vendor)
  const total = vendorExps.reduce((s, e) => s + (e.amount || 0), 0)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) { if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.3)' }}>
      <div ref={panelRef} className="w-full max-w-lg bg-[var(--bg-card)] h-full overflow-y-auto shadow-2xl animate-slide-in-right">
        <div className="sticky top-0 bg-[var(--bg-card)] border-b px-6 py-4 flex items-center justify-between z-10" style={{ borderColor: 'var(--donor-border)' }}>
          <h2 className="text-lg font-bold" style={{ color: 'var(--donor-dark)' }}>{vendor}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 text-gray-500 text-lg">&times;</button>
        </div>
        <div className="p-6">
          <p className="text-xs mb-4" style={{ color: 'var(--donor-muted)' }}>{t('allExpensesFromProject')}</p>
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--donor-border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--donor-border)', background: 'var(--donor-light)' }}>
                  <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>{t('date')}</th>
                  <th className="text-right px-3 py-2 text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>{t('amount')}</th>
                  <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>{t('category')}</th>
                  <th className="text-center px-3 py-2 text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>{t('risk')}</th>
                  <th className="text-center px-3 py-2 text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>{t('seal')}</th>
                </tr>
              </thead>
              <tbody>
                {vendorExps.map(e => (
                  <tr key={e.id} onClick={() => { onExpenseClick(e.id); onClose() }}
                    className="border-b last:border-0 hover:bg-[var(--donor-light)] cursor-pointer" style={{ borderColor: 'var(--donor-border)' }}>
                    <td className="px-3 py-2" style={{ color: 'var(--donor-dark)' }}>{fmtDate(e.date)}</td>
                    <td className="px-3 py-2 text-right font-mono" style={{ color: 'var(--donor-dark)' }}>{e.currency} {e.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--donor-muted)' }}>{e.category}</td>
                    <td className="px-3 py-2 text-center"><RiskPill level={e.fraudRiskLevel} /></td>
                    <td className="px-3 py-2 text-center" onClick={ev => ev.stopPropagation()}><SealPill sealId={e.sealId} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 pt-3 border-t flex justify-between text-sm font-bold" style={{ borderColor: 'var(--donor-border)', color: 'var(--donor-dark)' }}>
            <span>{t('expenseCount', { count: vendorExps.length })}</span>
            <span>{t('totalColon', { amount: `${vendorExps[0]?.currency || currency} ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}` })}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Expense Filter & CSV ─────────────────────────────────────
type FilterPeriod = 'all' | 'this_month' | 'last_month' | 'this_quarter' | 'custom'

function filterExpenses(expenses: Expense[], period: FilterPeriod, customFrom: string, customTo: string): Expense[] {
  if (period === 'all') return expenses
  const now = new Date()
  let from: Date, to: Date

  if (period === 'this_month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1)
    to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  } else if (period === 'last_month') {
    from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
  } else if (period === 'this_quarter') {
    const q = Math.floor(now.getMonth() / 3)
    from = new Date(now.getFullYear(), q * 3, 1)
    to = new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59)
  } else {
    from = customFrom ? new Date(customFrom) : new Date(0)
    to = customTo ? new Date(customTo + 'T23:59:59') : new Date()
  }

  return expenses.filter(e => {
    const d = new Date(e.date)
    return d >= from && d <= to
  })
}

function exportCSV(expenses: Expense[], projectName: string) {
  const headers = ['Date', 'Vendor', 'Amount', 'Currency', 'Category', 'Risk', 'Seal Hash', 'Anchor TX']
  const rows = expenses.map(e => [
    fmtDate(e.date),
    (e.vendor || '').replace(/,/g, ' '),
    String(e.amount || 0),
    e.currency || 'USD',
    e.category || '',
    e.fraudRiskLevel || 'LOW',
    e.sealId || '',
    e.anchorTxHash || '',
  ])
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `expenses-${projectName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Audit Trail Tab ──────────────────────────────────────────
function AuditTrailTab({ projectId, entries, setEntries, hasMore, setHasMore, offset, setOffset, loading, setLoading, onExpenseClick }: {
  projectId: string; entries: AuditEntry[]; setEntries: React.Dispatch<React.SetStateAction<AuditEntry[]>>
  hasMore: boolean; setHasMore: (v: boolean) => void; offset: number; setOffset: (v: number) => void
  loading: boolean; setLoading: (v: boolean) => void; onExpenseClick: (id: string) => void
}) {
  const t = useTranslations('projectDetail')
  const ACTION_LABELS: Record<string, string> = {
    EXPENSE_CREATED: t('actionExpenseCreated'),
    EXPENSE_APPROVED: t('actionExpenseApproved'),
    EXPENSE_REJECTED: t('actionExpenseRejected'),
    EXPENSE_VOIDED: t('actionExpenseVoided'),
    DOCUMENT_UPLOADED: t('actionDocumentUploaded'),
    DOCUMENT_SEALED: t('actionDocumentSealed'),
    SEAL_ANCHORED: t('actionSealAnchored'),
    FUNDING_CREATED: t('actionFundingCreated'),
    PROJECT_CREATED: t('actionProjectCreated'),
    MEMBER_INVITED: t('actionMemberInvited'),
    APPROVAL_REQUESTED: t('actionApprovalRequested'),
  }
  const [copiedHash, setCopiedHash] = useState<string | null>(null)

  // Verify hash chain integrity (skip legacy entries with null prevHash)
  const { chainIntact, verifiedCount, legacyCount } = (() => {
    if (entries.length === 0) return { chainIntact: true, verifiedCount: 0, legacyCount: 0 }
    let verified = 0, legacy = 0, broken = false
    for (let i = 1; i < entries.length; i++) {
      if (!entries[i].prevHash) { legacy++; continue }
      if (entries[i].prevHash !== entries[i - 1].hash) { broken = true; break }
      verified++
    }
    // First entry is always legacy (no previous to compare)
    if (!entries[0].prevHash) legacy++
    return { chainIntact: !broken, verifiedCount: verified, legacyCount: legacy }
  })()

  const loadMore = async () => {
    setLoading(true)
    try {
      const newOffset = offset + 50
      const r = await apiGet(`/api/donor/projects/${projectId}/audit?limit=50&offset=${newOffset}`)
      if (r.ok) {
        const d = await r.json()
        setEntries(prev => [...prev, ...(d.entries || [])])
        setHasMore(d.hasMore || false)
        setOffset(newOffset)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash)
    setCopiedHash(hash)
    setTimeout(() => setCopiedHash(null), 2000)
  }

  const truncHash = (hash: string) => hash.length > 18 ? hash.slice(0, 12) + '...' + hash.slice(-6) : hash

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: 'var(--donor-muted)' }}>{t('auditTrailDescription')}</p>

      {/* Hash chain integrity indicator */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
        style={{ background: chainIntact ? '#DCFCE7' : '#FEE2E2', color: chainIntact ? '#16A34A' : '#DC2626' }}>
        {chainIntact
          ? `\u2713 ${t('hashChainIntact', { verified: verifiedCount })}${legacyCount > 0 ? t('hashChainIntactLegacy', { count: legacyCount }) : ''}`
          : `\u2717 ${t('hashChainBroken')}`}
      </div>

      {/* Audit table */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
        {entries.length === 0 ? (
          <div className="px-5 py-8 text-center"><p className="text-sm" style={{ color: 'var(--donor-muted)' }}>{t('noAuditEntries')}</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--donor-border)' }}>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('dateTime')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('action')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('entity')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('hash')}</th>
                  <th className="text-center px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('blockchain')}</th>
                  <th className="text-center px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}></th>
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => (
                  <tr key={entry.id} className="border-b last:border-0 hover:bg-[var(--donor-light)] transition-all" style={{ borderColor: 'var(--donor-border)' }}>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--donor-dark)' }}>{fmtDate(entry.createdAt)}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--donor-dark)' }}>{ACTION_LABELS[entry.action] || t('actionRecorded')}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--donor-muted)' }}>{entry.entity}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs" style={{ color: 'var(--donor-dark)' }}>{truncHash(entry.hash)}</span>
                        <button onClick={() => copyHash(entry.hash)}
                          className="px-1.5 py-0.5 rounded text-[10px] border hover:bg-gray-50 transition-all"
                          style={{ borderColor: 'var(--donor-border)', color: copiedHash === entry.hash ? '#16A34A' : 'var(--donor-accent)' }}>
                          {copiedHash === entry.hash ? t('copied') : t('copy')}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {entry.anchorTxHash ? (
                        <a href={`https://polygonscan.com/tx/${entry.anchorTxHash}`} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-xs hover:underline" style={{ color: 'var(--donor-accent)' }}>
                          {entry.anchorTxHash.slice(0, 8)}...{entry.anchorTxHash.slice(-4)}
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        </a>
                      ) : entry.anchorTxHash === null && entry.action === 'SEAL_ANCHORED' ? (
                        <span className="text-xs" style={{ color: '#B45309' }}>{t('pending')}</span>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--donor-muted)' }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {entry.expenseId && (entry.action === 'EXPENSE_CREATED' || entry.action === 'EXPENSE_APPROVED' || entry.action === 'EXPENSE_REJECTED' || entry.action === 'EXPENSE_VOIDED') && (
                        <button onClick={() => onExpenseClick(entry.expenseId!)}
                          className="p-1 rounded hover:bg-[var(--donor-light)] transition-all" title={t('viewExpense')}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--donor-accent)" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {hasMore && (
        <div className="text-center">
          <button onClick={loadMore} disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium border hover:bg-gray-50 transition-all disabled:opacity-50"
            style={{ borderColor: 'var(--donor-border)', color: 'var(--donor-accent)' }}>
            {loading ? t('loading') : t('loadMore')}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Requests Tab ─────────────────────────────────────────────
function RequestsTab({ projectId, requests, setRequests }: {
  projectId: string; requests: DonorRequest[]; setRequests: React.Dispatch<React.SetStateAction<DonorRequest[]>>
}) {
  const t = useTranslations('projectDetail')
  const [showNewModal, setShowNewModal] = useState(false)
  const [newType, setNewType] = useState('Report')
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newDeadline, setNewDeadline] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [reworkModal, setReworkModal] = useState<string | null>(null)
  const [reworkNote, setReworkNote] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; url: string; uploading: boolean }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return
    const token = typeof window !== 'undefined' ? localStorage.getItem('donor_token') : null
    if (!token) return
    const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const idx = uploadedFiles.length + i
      setUploadedFiles(prev => [...prev, { name: file.name, url: '', uploading: true }])

      try {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch(`${API_URL}/api/donor/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        })
        if (res.ok) {
          const data = await res.json()
          setUploadedFiles(prev => prev.map((f, j) => j === idx ? { name: data.name, url: data.viewUrl || data.url, uploading: false } : f))
        } else {
          setUploadedFiles(prev => prev.map((f, j) => j === idx ? { ...f, uploading: false } : f))
        }
      } catch {
        setUploadedFiles(prev => prev.map((f, j) => j === idx ? { ...f, uploading: false } : f))
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const pendingCount = requests.filter(r => r.status === 'OPEN' || r.status === 'REWORK' || r.status === 'OVERDUE').length
  const confirmedCount = requests.filter(r => r.status === 'CONFIRMED').length

  const refreshRequests = async () => {
    try {
      const r = await apiGet(`/api/donor/projects/${projectId}/requests`)
      if (r.ok) { const d = await r.json(); setRequests(d.requests || []) }
    } catch { /* ignore */ }
  }

  const handleCreate = async () => {
    if (!newTitle.trim() || !newDeadline) { setFormError(t('titleAndDeadlineRequired')); return }
    setSubmitting(true); setFormError('')
    try {
      const attachments = uploadedFiles.filter(f => !f.uploading && f.url).map(f => ({ name: f.name, url: f.url }))
      const r = await apiPost(`/api/donor/projects/${projectId}/requests`, {
        type: newType, title: newTitle.trim(), description: newDesc.trim() || null, deadline: newDeadline,
        attachments: attachments.length > 0 ? attachments : null,
      })
      if (r.ok) {
        setShowNewModal(false); setNewTitle(''); setNewDesc(''); setNewDeadline(''); setNewType('Report'); setUploadedFiles([])
        refreshRequests()
      } else {
        const d = await r.json(); setFormError(d.error || 'Failed to create request')
      }
    } catch { setFormError('Network error') }
    setSubmitting(false)
  }

  const handleConfirm = async (requestId: string) => {
    try {
      const r = await apiPost(`/api/donor/requests/${requestId}/confirm`, {})
      if (r.ok) refreshRequests()
    } catch { /* ignore */ }
  }

  const handleRework = async (requestId: string) => {
    if (!reworkNote.trim()) return
    try {
      const r = await apiPost(`/api/donor/requests/${requestId}/rework`, { note: reworkNote.trim() })
      if (r.ok) { setReworkModal(null); setReworkNote(''); refreshRequests() }
    } catch { /* ignore */ }
  }

  const statusColors: Record<string, { bg: string; text: string }> = {
    OPEN: { bg: '#FEF3E8', text: '#B45309' },
    SUBMITTED: { bg: '#DBEAFE', text: '#1D4ED8' },
    REWORK: { bg: '#FFEDD5', text: '#C2410C' },
    RESUBMITTED: { bg: '#EDE9FE', text: '#7C3AED' },
    CONFIRMED: { bg: '#DCFCE7', text: '#16A34A' },
    OVERDUE: { bg: '#FEE2E2', text: '#DC2626' },
  }

  const typePillColors: Record<string, string> = {
    Report: 'var(--donor-accent)', 'Status Update': '#1D4ED8', 'Financial Report': '#B45309',
    'Photos & Evidence': '#16A34A', Custom: 'var(--donor-muted)',
  }

  const daysBetween = (from: string, to: Date) => {
    const diff = new Date(from).getTime() - to.getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--donor-muted)' }}>
          {t('requestsSummary', { total: requests.length, pending: pendingCount, confirmed: confirmedCount })}
        </p>
        <button onClick={() => setShowNewModal(true)}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--donor-accent)' }}>
          {t('newRequest')}
        </button>
      </div>

      {/* Request cards */}
      {requests.length === 0 ? (
        <div className="rounded-2xl border px-5 py-8 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
          <p className="text-sm" style={{ color: 'var(--donor-muted)' }}>{t('noRequestsYet')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => {
            const sc = statusColors[req.status] || statusColors.OPEN
            const tc = typePillColors[req.type] || 'var(--donor-muted)'
            const daysLeft = daysBetween(req.deadline, new Date())
            const isOverdue = req.status !== 'CONFIRMED' && daysLeft < 0

            return (
              <div key={req.id} className="rounded-2xl border overflow-hidden" style={{
                background: req.status === 'CONFIRMED' ? '#F0FDF4' : 'var(--bg-card)', borderColor: 'var(--donor-border)',
              }}>
                {/* Card header */}
                <div className="px-5 py-3 flex items-center gap-2 flex-wrap border-b" style={{ borderColor: 'var(--donor-border)' }}>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white" style={{ background: tc }}>{req.type}</span>
                  <span className="text-sm font-semibold flex-1" style={{ color: 'var(--donor-dark)' }}>{req.title}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: isOverdue ? '#FEE2E2' : sc.bg, color: isOverdue ? '#DC2626' : sc.text }}>
                    {isOverdue ? 'OVERDUE' : req.status}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--donor-muted)' }}>{t('due', { date: fmtDate(req.deadline) })}</span>
                </div>

                {/* Card body */}
                <div className="px-5 py-3 space-y-2">
                  {/* OPEN / OVERDUE */}
                  {(req.status === 'OPEN' || isOverdue) && (
                    <>
                      {req.description && <p className="text-sm" style={{ color: 'var(--donor-dark)' }}>{req.description}</p>}
                      <p className="text-xs" style={{ color: 'var(--donor-muted)' }}>{t('awaitingSubmission')}</p>
                      <p className="text-xs font-medium" style={{ color: isOverdue ? '#DC2626' : '#B45309' }}>
                        {isOverdue ? t('overdueDays', { count: Math.abs(daysLeft) }) : t('daysRemaining', { count: daysLeft })}
                      </p>
                    </>
                  )}

                  {/* SUBMITTED / RESUBMITTED */}
                  {(req.status === 'SUBMITTED' || req.status === 'RESUBMITTED') && (
                    <>
                      {req.submissionNote && (
                        <div className="rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--donor-light)', color: 'var(--donor-dark)' }}>
                          {req.submissionNote}
                        </div>
                      )}
                      {(req.documents || []).length > 0 && (
                        <div className="space-y-1">
                          {(req.documents || []).map(doc => (
                            <a key={doc.id} href={doc.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-2 text-xs hover:underline" style={{ color: 'var(--donor-accent)' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                              {doc.name}
                              {doc.sealId && <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: 'var(--donor-light)', color: 'var(--donor-accent)' }}>{t('sealed')}</span>}
                            </a>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-2 pt-1">
                        <button onClick={() => handleConfirm(req.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: '#16A34A' }}>
                          &#10003; {t('confirm')}
                        </button>
                        <button onClick={() => setReworkModal(req.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: '#B45309', color: '#B45309' }}>
                          {t('rework')}
                        </button>
                      </div>
                    </>
                  )}

                  {/* REWORK */}
                  {req.status === 'REWORK' && (
                    <>
                      {req.reworkNote && (
                        <div className="rounded-lg px-3 py-2 text-sm" style={{ background: '#FFEDD5', color: '#C2410C' }}>
                          {req.reworkNote}
                        </div>
                      )}
                      <p className="text-xs" style={{ color: 'var(--donor-muted)' }}>{t('ngoNotifiedToResubmit')}</p>
                    </>
                  )}

                  {/* CONFIRMED */}
                  {req.status === 'CONFIRMED' && (
                    <>
                      <p className="text-sm font-medium" style={{ color: '#16A34A' }}>&#10003; {t('confirmedDate', { date: req.confirmedAt ? fmtDate(req.confirmedAt) : '' })}</p>
                      {(req.documents || []).length > 0 && (
                        <div className="space-y-1">
                          {(req.documents || []).map(doc => (
                            <a key={doc.id} href={doc.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-2 text-xs hover:underline" style={{ color: 'var(--donor-accent)' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                              {doc.name}
                              {doc.sealId && <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: 'var(--donor-light)', color: 'var(--donor-accent)' }}>{t('sealed')}</span>}
                            </a>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* New Request Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.3)' }}>
          <div className="bg-[var(--bg-card)] rounded-2xl w-full max-w-md mx-4 shadow-2xl" style={{ border: '1px solid var(--donor-border)' }}>
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--donor-border)' }}>
              <h2 className="text-lg font-bold" style={{ color: 'var(--donor-dark)' }}>{t('newRequestTitle')}</h2>
              <button onClick={() => { setShowNewModal(false); setFormError('') }}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 text-gray-500 text-lg">&times;</button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--donor-dark)' }}>{t('requestType')}</label>
                <select value={newType} onChange={e => setNewType(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none" style={{ borderColor: 'var(--donor-border)', color: 'var(--donor-dark)' }}>
                  <option>Report</option>
                  <option>Status Update</option>
                  <option>Financial Report</option>
                  <option>Photos &amp; Evidence</option>
                  <option>Custom</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--donor-dark)' }}>{t('titleRequired')}</label>
                <input value={newTitle} onChange={e => setNewTitle(e.target.value)} maxLength={200}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none" style={{ borderColor: 'var(--donor-border)', color: 'var(--donor-dark)' }}
                  placeholder={t('titlePlaceholder')} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--donor-dark)' }}>{t('descriptionOptional')}</label>
                <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={3} maxLength={1000}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none" style={{ borderColor: 'var(--donor-border)', color: 'var(--donor-dark)' }}
                  placeholder={t('descriptionPlaceholder')} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--donor-dark)' }}>{t('deadlineRequired')}</label>
                <input type="date" value={newDeadline} onChange={e => setNewDeadline(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none" style={{ borderColor: 'var(--donor-border)', color: 'var(--donor-dark)' }} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--donor-dark)' }}>{t('attachReferenceFiles')}</label>
                <input ref={fileInputRef} type="file" multiple className="hidden"
                  accept=".pdf,.doc,.docx,.xlsx,.xls,.jpg,.jpeg,.png,.csv"
                  onChange={e => handleFileUpload(e.target.files)} />
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="w-full rounded-lg border-2 border-dashed px-3 py-4 flex flex-col items-center gap-1 transition-all hover:border-[var(--donor-accent)]"
                  style={{ borderColor: 'var(--donor-border)', background: 'var(--donor-light)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--donor-muted)" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <span className="text-xs" style={{ color: 'var(--donor-muted)' }}>{t('clickToAttachFiles')}</span>
                </button>
                {uploadedFiles.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {uploadedFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs" style={{ background: 'var(--donor-light)', border: '1px solid var(--donor-border)' }}>
                        {f.uploading ? (
                          <span className="animate-spin w-3 h-3 border-2 border-[var(--donor-accent)] border-t-transparent rounded-full" />
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                        )}
                        <span className="flex-1 truncate" style={{ color: 'var(--donor-dark)' }}>{f.name}</span>
                        {!f.uploading && (
                          <button onClick={() => setUploadedFiles(prev => prev.filter((_, j) => j !== i))}
                            className="text-red-400 hover:text-red-600">&times;</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {formError && <p className="text-xs text-red-500">{formError}</p>}
            </div>
            <div className="px-6 py-4 border-t flex items-center justify-end gap-2" style={{ borderColor: 'var(--donor-border)' }}>
              <button onClick={() => { setShowNewModal(false); setFormError('') }}
                className="px-4 py-2 rounded-lg text-sm font-medium" style={{ color: 'var(--donor-muted)' }}>{t('cancel')}</button>
              <button onClick={handleCreate} disabled={submitting}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: 'var(--donor-accent)' }}>
                {submitting ? t('sending') : t('sendRequest')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rework Modal */}
      {reworkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.3)' }}>
          <div className="bg-[var(--bg-card)] rounded-2xl w-full max-w-md mx-4 shadow-2xl" style={{ border: '1px solid var(--donor-border)' }}>
            <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--donor-border)' }}>
              <h2 className="text-lg font-bold" style={{ color: 'var(--donor-dark)' }}>{t('requestRework')}</h2>
            </div>
            <div className="px-6 py-4 space-y-3">
              <label className="text-xs font-medium block" style={{ color: 'var(--donor-dark)' }}>{t('whatNeedsChanged')}</label>
              <textarea value={reworkNote} onChange={e => setReworkNote(e.target.value)} rows={3} maxLength={500}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none" style={{ borderColor: 'var(--donor-border)', color: 'var(--donor-dark)' }}
                placeholder={t('reworkPlaceholder')} />
            </div>
            <div className="px-6 py-4 border-t flex items-center justify-end gap-2" style={{ borderColor: 'var(--donor-border)' }}>
              <button onClick={() => { setReworkModal(null); setReworkNote('') }}
                className="px-4 py-2 rounded-lg text-sm font-medium" style={{ color: 'var(--donor-muted)' }}>{t('cancel')}</button>
              <button onClick={() => handleRework(reworkModal)} disabled={!reworkNote.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: '#B45309' }}>
                {t('send')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Impact Tab ───────────────────────────────────────────────
function Sparkline({ values, width = 80, height = 24 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline fill="none" stroke="var(--donor-accent)" strokeWidth="1.5" points={points} />
    </svg>
  )
}

function ImpactTab({ milestones, totalSpent }: { milestones: Milestone[]; totalSpent: number }) {
  const t = useTranslations('projectDetail')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (milestones.length === 0) {
    return (
      <div className="rounded-2xl border px-5 py-8 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
        <p className="text-sm" style={{ color: 'var(--donor-muted)' }}>{t('noImpactMilestones')}</p>
      </div>
    )
  }

  const onTrack = milestones.filter(m => m.status === 'ON_TRACK').length
  const atRisk = milestones.filter(m => m.status === 'AT_RISK').length
  const achieved = milestones.filter(m => m.status === 'ACHIEVED').length

  // Cost per beneficiary: for people-based milestones
  const peopleCats = ['PEOPLE_REACHED', 'TRAINED', 'EMPLOYED', 'BENEFICIARIES']
  const peopleMilestones = milestones.filter(m => peopleCats.includes(m.category))
  const totalPeople = peopleMilestones.reduce((s, m) => s + m.currentValue, 0)
  const costPerBeneficiary = totalPeople > 0 ? totalSpent / totalPeople : null

  const statusColors: Record<string, { bg: string; text: string; bar: string }> = {
    ON_TRACK: { bg: '#DCFCE7', text: '#16A34A', bar: '#16A34A' },
    AT_RISK: { bg: '#FEF3E8', text: '#B45309', bar: '#F59E0B' },
    ACHIEVED: { bg: '#DBEAFE', text: '#1D4ED8', bar: '#1D4ED8' },
    BEHIND: { bg: '#FEE2E2', text: '#DC2626', bar: '#DC2626' },
    NOT_STARTED: { bg: 'var(--donor-light)', text: 'var(--donor-muted)', bar: 'var(--donor-muted)' },
  }

  const catLabels: Record<string, string> = {
    PEOPLE_REACHED: t('catPeopleReached'), TRAINED: t('catTrained'), EMPLOYED: t('catEmployed'),
    BENEFICIARIES: t('catBeneficiaries'), INFRASTRUCTURE: t('catInfrastructure'), ENVIRONMENTAL: t('catEnvironmental'),
    FINANCIAL: t('catFinancial'), HEALTH: t('catHealth'), EDUCATION: t('catEducation'),
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MiniCard label={t('totalMilestones')} value={String(milestones.length)} />
        <MiniCard label={t('onTrack')} value={String(onTrack)} color="#16A34A" />
        <MiniCard label={t('atRisk')} value={String(atRisk)} color="#B45309" />
        <MiniCard label={t('achieved')} value={String(achieved)} color="#1D4ED8" />
        {costPerBeneficiary !== null ? (
          <MiniCard label={t('costPerBeneficiary')} value={formatMoney(costPerBeneficiary, 'USD')} />
        ) : (
          <MiniCard label={t('costPerBeneficiary')} value="—" />
        )}
      </div>

      {/* Milestone list */}
      <div className="space-y-3">
        {milestones.map(m => {
          const sc = statusColors[m.status] || statusColors.NOT_STARTED
          const pct = m.targetValue > 0 ? Math.min(Math.round((m.currentValue / m.targetValue) * 100), 100) : 0
          const isExpanded = expandedId === m.id
          const trendValues = (m.updates?.length || 0) >= 2 ? (m.updates || []).map(u => u.newValue) : []

          return (
            <div key={m.id} className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
              <div className="px-5 py-3 cursor-pointer hover:bg-[var(--donor-light)] transition-all" onClick={() => setExpandedId(isExpanded ? null : m.id)}>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-xs" style={{ color: 'var(--donor-muted)' }}>{isExpanded ? '\u25BC' : '\u25B6'}</span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--donor-dark)' }}>{m.title}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: 'var(--donor-light)', color: 'var(--donor-accent)' }}>
                    {catLabels[m.category] || m.category}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: sc.bg, color: sc.text }}>
                    {m.status.replace(/_/g, ' ')}
                  </span>
                  {trendValues.length >= 2 && (
                    <span className="ml-auto"><Sparkline values={trendValues} /></span>
                  )}
                </div>
                {/* Progress bar */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--donor-light)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: sc.bar, minWidth: pct > 0 ? '4px' : '0' }} />
                  </div>
                  <span className="text-xs font-bold whitespace-nowrap" style={{ color: 'var(--donor-dark)' }}>{pct}%</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs" style={{ color: 'var(--donor-muted)' }}>
                    {t('ofTotal', { current: m.currentValue.toLocaleString(), target: m.targetValue.toLocaleString(), unit: m.unit })}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--donor-muted)' }}>{t('targetDate', { date: fmtDate(m.targetDate) })}</span>
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-5 pb-4 pt-1 border-t space-y-3" style={{ borderColor: 'var(--donor-border)' }}>
                  {m.description && <p className="text-sm" style={{ color: 'var(--donor-dark)' }}>{m.description}</p>}

                  {/* Update history */}
                  {(m.updates?.length || 0) > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--donor-muted)' }}>{t('updateHistory')}</h4>
                      <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--donor-border)' }}>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b" style={{ borderColor: 'var(--donor-border)', background: 'var(--donor-light)' }}>
                              <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>{t('date')}</th>
                              <th className="text-right px-3 py-2 text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>{t('previous')}</th>
                              <th className="text-right px-3 py-2 text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>{t('newValue')}</th>
                              <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>{t('note')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(m.updates || []).map(u => (
                              <tr key={u.id} className="border-b last:border-0" style={{ borderColor: 'var(--donor-border)' }}>
                                <td className="px-3 py-2" style={{ color: 'var(--donor-dark)' }}>{fmtDate(u.date)}</td>
                                <td className="px-3 py-2 text-right font-mono" style={{ color: 'var(--donor-muted)' }}>{u.previousValue.toLocaleString()}</td>
                                <td className="px-3 py-2 text-right font-mono font-medium" style={{ color: 'var(--donor-dark)' }}>{u.newValue.toLocaleString()}</td>
                                <td className="px-3 py-2" style={{ color: 'var(--donor-muted)' }}>{u.note || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Evidence documents */}
                  {(m.evidence?.length || 0) > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--donor-muted)' }}>{t('evidence')}</h4>
                      <div className="space-y-1">
                        {(m.evidence || []).map(doc => (
                          <a key={doc.id} href={doc.url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 text-xs hover:underline" style={{ color: 'var(--donor-accent)' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            {doc.name}
                            {doc.sealId && <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: 'var(--donor-light)', color: 'var(--donor-accent)' }}>{t('sealed')}</span>}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Investment Tab ────────────────────────────────────────────
function InvestmentTab({ investments, projectId }: { investments: any[]; projectId: string }) {
  const t = useTranslations('projectDetail')
  const [expandedInv, setExpandedInv] = useState<string | null>(investments[0]?.id || null)
  const [drawdownAction, setDrawdownAction] = useState<{ type: 'approve' | 'reject'; investmentId: string; drawdownId: string } | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [paymentModal, setPaymentModal] = useState<{ investmentId: string; instalment: any } | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [localInvestments, setLocalInvestments] = useState(investments)

  useEffect(() => { setLocalInvestments(investments) }, [investments])

  const statusPill = (status: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      PAID: { bg: '#DCFCE7', text: '#16A34A' }, PENDING: { bg: '#FEF3E8', text: '#B45309' },
      OVERDUE: { bg: '#FEE2E2', text: '#DC2626' }, PARTIAL: { bg: '#DBEAFE', text: '#1D4ED8' },
      ACTIVE: { bg: '#DCFCE7', text: '#16A34A' }, CLOSED: { bg: '#F3F4F6', text: '#6B7280' },
      REQUESTED: { bg: '#FEF3E8', text: '#B45309' }, APPROVED: { bg: '#DCFCE7', text: '#16A34A' },
      REJECTED: { bg: '#FEE2E2', text: '#DC2626' }, DISBURSED: { bg: '#DBEAFE', text: '#1D4ED8' },
      COMPLIANT: { bg: '#DCFCE7', text: '#16A34A' }, BREACH: { bg: '#FEE2E2', text: '#DC2626' },
      WAIVED: { bg: '#F3F4F6', text: '#6B7280' }, SUBMITTED: { bg: '#FEF3C7', text: '#D97706' },
    }
    const c = colors[(status || '').toUpperCase()] || { bg: '#F3F4F6', text: '#6B7280' }
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: c.bg, color: c.text }}>{(status || 'N/A').toUpperCase()}</span>
  }

  const fmtCurrency = (amt: number | string | null, currency?: string) => {
    const n = parseFloat(String(amt)) || 0
    return formatMoney(n, currency || 'USD')
  }

  const fmtShortDate = (d: string | Date | null) => {
    if (!d) return '—'
    const dt = new Date(d)
    if (isNaN(dt.getTime())) return '—'
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const handleDrawdownAction = async () => {
    if (!drawdownAction) return
    setActionLoading(true)
    try {
      const endpoint = drawdownAction.type === 'approve'
        ? `/api/donor/investments/${drawdownAction.investmentId}/drawdowns/${drawdownAction.drawdownId}/approve`
        : `/api/donor/investments/${drawdownAction.investmentId}/drawdowns/${drawdownAction.drawdownId}/reject`

      const body = drawdownAction.type === 'reject' ? { reason: rejectReason } : {}
      const r = await apiPost(endpoint, body)
      if (r.ok) {
        const updated = await r.json()
        setLocalInvestments(prev => prev.map(inv => {
          if (inv.id !== drawdownAction.investmentId) return inv
          return { ...inv, drawdowns: (inv.drawdowns || []).map((dd: any) => dd.id === drawdownAction.drawdownId ? updated.drawdown : dd) }
        }))
      }
    } catch {}
    setActionLoading(false)
    setDrawdownAction(null)
    setRejectReason('')
  }

  const handleConfirmPayment = async () => {
    if (!paymentModal) return
    setActionLoading(true)
    try {
      const r = await apiPost(`/api/donor/investments/${paymentModal.investmentId}/confirm-payment`, {
        instalmentId: paymentModal.instalment.id,
      })
      if (r.ok) {
        const updated = await r.json()
        setLocalInvestments(prev => prev.map(inv => {
          if (inv.id !== paymentModal.investmentId) return inv
          return { ...inv, schedule: (inv.schedule || []).map((s: any) => s.id === paymentModal.instalment.id ? updated.instalment : s) }
        }))
      }
    } catch {}
    setActionLoading(false)
    setPaymentModal(null)
  }

  const handleRejectPayment = async () => {
    if (!paymentModal) return
    setActionLoading(true)
    try {
      const r = await apiPost(`/api/donor/investments/${paymentModal.investmentId}/reject-payment`, {
        instalmentId: paymentModal.instalment.id,
        reason: rejectReason || undefined,
      })
      if (r.ok) {
        const updated = await r.json()
        setLocalInvestments(prev => prev.map(inv => {
          if (inv.id !== paymentModal.investmentId) return inv
          return { ...inv, schedule: (inv.schedule || []).map((s: any) => s.id === paymentModal.instalment.id ? updated.instalment : s) }
        }))
      }
    } catch {}
    setActionLoading(false)
    setPaymentModal(null)
    setRejectReason('')
  }

  // Aggregate summary across all investments
  const totalFacility = localInvestments.reduce((s, inv) => s + (parseFloat(inv.totalFacility) || 0), 0)
  const totalDrawnDown = localInvestments.reduce((s, inv) => {
    const approvedDrawdowns = (inv.drawdowns || []).filter((d: any) => d.status === 'APPROVED' || d.status === 'DISBURSED')
    return s + approvedDrawdowns.reduce((ds: number, d: any) => ds + (parseFloat(d.amount) || 0), 0)
  }, 0)
  const totalOutstanding = localInvestments.reduce((s, inv) => s + (parseFloat(inv.outstandingPrincipal) || 0), 0)
  const totalAccruedInterest = localInvestments.reduce((s, inv) => s + (parseFloat(inv.accruedInterest) || 0), 0)
  const totalPaid = localInvestments.reduce((s, inv) => {
    const schedule = inv.schedule || []
    return s + schedule.filter((i: any) => i.status === 'PAID' || i.status === 'PARTIAL').reduce((ps: number, i: any) => ps + (parseFloat(i.paidAmount) || 0), 0)
  }, 0)
  const nextRepayment = localInvestments.map(inv => inv.nextRepayment).filter(Boolean).sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]

  return (
    <div className="space-y-5">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: t('totalFacility'), value: fmtCurrency(totalFacility), color: 'var(--donor-dark)' },
          { label: t('drawnDown'), value: fmtCurrency(totalDrawnDown), color: '#1D4ED8' },
          { label: t('outstanding'), value: fmtCurrency(totalOutstanding), color: '#B45309' },
          { label: t('accruedInterest'), value: fmtCurrency(totalAccruedInterest), color: 'var(--donor-muted)' },
          { label: t('nextRepayment'), value: nextRepayment ? fmtShortDate(nextRepayment.dueDate) : t('none'), color: nextRepayment?.status === 'OVERDUE' ? '#DC2626' : 'var(--donor-dark)' },
          { label: t('totalRepaid'), value: fmtCurrency(totalPaid), color: '#16A34A' },
        ].map((card, i) => (
          <div key={i} className="rounded-xl border px-4 py-3" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
            <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{card.label}</p>
            <p className="text-sm font-bold mt-1" style={{ color: card.color }}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Investment Cards */}
      {localInvestments.map((inv: any) => {
        const isExpanded = expandedInv === inv.id
        const schedule = inv.schedule || []
        const drawdowns = inv.drawdowns || []
        const covenants = inv.covenants || []
        const paidCount = schedule.filter((s: any) => s.status === 'PAID').length
        const totalInstalments = schedule.length
        const repaymentProgress = totalInstalments > 0 ? Math.round((paidCount / totalInstalments) * 100) : 0

        return (
          <div key={inv.id} className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
            {/* Investment header */}
            <button onClick={() => setExpandedInv(isExpanded ? null : inv.id)}
              className="w-full px-5 py-4 flex items-center justify-between hover:bg-[#FAFAFF] transition-all text-left">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg" style={{ background: 'var(--donor-light)', color: 'var(--donor-accent)' }}>
                  {inv.instrumentType === 'LOAN' ? '\uD83D\uDCB0' : inv.instrumentType === 'EQUITY' ? '\uD83D\uDCC8' : '\uD83C\uDFE6'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: 'var(--donor-dark)' }}>{inv.instrumentType || t('investment')}</span>
                    {statusPill(inv.status)}
                    {(inv.overdueCount || 0) > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600">{inv.overdueCount} {t('overdue')}</span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--donor-muted)' }}>
                    {fmtCurrency(inv.totalFacility, inv.currency)} &middot; {parseFloat(inv.interestRate) || 0}% &middot; {t('nMonths', { count: inv.termMonths || 0 })}
                  </p>
                </div>
              </div>
              <span className="text-sm" style={{ color: 'var(--donor-muted)' }}>{isExpanded ? '\u25B2' : '\u25BC'}</span>
            </button>

            {isExpanded && (
              <div className="border-t px-5 py-4 space-y-5" style={{ borderColor: 'var(--donor-border)' }}>
                {/* Investment Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: t('startDate'), value: fmtShortDate(inv.startDate) },
                    { label: t('maturityDate'), value: fmtShortDate(inv.maturityDate) },
                    { label: t('gracePeriod'), value: t('nMonths', { count: inv.gracePeriodMonths || 0 }) },
                    { label: t('interestType'), value: inv.interestType || 'FIXED' },
                  ].map((d, i) => (
                    <div key={i} className="rounded-lg px-3 py-2" style={{ background: 'var(--donor-light)' }}>
                      <p className="text-[10px] font-medium" style={{ color: 'var(--donor-muted)' }}>{d.label}</p>
                      <p className="text-sm font-medium" style={{ color: 'var(--donor-dark)' }}>{d.value}</p>
                    </div>
                  ))}
                </div>

                {/* Repayment Schedule */}
                {schedule.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold" style={{ color: 'var(--donor-dark)' }}>{t('repaymentSchedule')}</h3>
                      <div className="flex items-center gap-2">
                        <div className="w-32 h-2 rounded-full overflow-hidden" style={{ background: 'var(--donor-light)' }}>
                          <div className="h-full rounded-full" style={{ width: `${repaymentProgress}%`, background: 'var(--donor-accent)' }} />
                        </div>
                        <span className="text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>{t('paidOfTotal', { paid: paidCount, total: totalInstalments })}</span>
                      </div>
                    </div>
                    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--donor-border)' }}>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr style={{ background: 'var(--donor-light)' }}>
                              {['#', t('dueDate'), t('principal'), t('interest'), t('totalDue'), t('paid'), t('status'), ''].map((h, i) => (
                                <th key={i} className={`px-3 py-2.5 text-xs font-medium uppercase tracking-wide ${i === 2 || i === 3 || i === 4 || i === 5 ? 'text-right' : i === 6 ? 'text-center' : 'text-left'}`} style={{ color: 'var(--donor-muted)' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {schedule.map((s: any) => (
                              <tr key={s.id} className="border-t" style={{ borderColor: 'var(--donor-border)', background: s.status === 'OVERDUE' ? '#FFF7F7' : 'transparent' }}>
                                <td className="px-3 py-2.5 font-medium" style={{ color: 'var(--donor-dark)' }}>{s.instalmentNumber}</td>
                                <td className="px-3 py-2.5" style={{ color: 'var(--donor-dark)' }}>{fmtShortDate(s.dueDate)}</td>
                                <td className="px-3 py-2.5 text-right font-mono" style={{ color: 'var(--donor-dark)' }}>{fmtCurrency(s.principalDue, inv.currency)}</td>
                                <td className="px-3 py-2.5 text-right font-mono" style={{ color: 'var(--donor-muted)' }}>{fmtCurrency(s.interestDue, inv.currency)}</td>
                                <td className="px-3 py-2.5 text-right font-mono font-medium" style={{ color: 'var(--donor-dark)' }}>{fmtCurrency(s.totalDue, inv.currency)}</td>
                                <td className="px-3 py-2.5 text-right font-mono" style={{ color: '#16A34A' }}>{s.paidAmount ? fmtCurrency(s.paidAmount, inv.currency) : '—'}</td>
                                <td className="px-3 py-2.5 text-center">{statusPill(s.status)}</td>
                                <td className="px-3 py-2.5">
                                  {s.status === 'SUBMITTED' && (
                                    <button onClick={() => setPaymentModal({ investmentId: inv.id, instalment: s })}
                                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-white transition-all hover:opacity-90"
                                      style={{ background: '#16A34A' }}>{t('review')}</button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Drawdown Tracker */}
                {drawdowns.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--donor-dark)' }}>{t('drawdownTracker')}</h3>
                    <div className="space-y-2">
                      {drawdowns.map((dd: any) => (
                        <div key={dd.id} className="rounded-xl border px-4 py-3 flex items-center justify-between" style={{ borderColor: 'var(--donor-border)' }}>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: 'var(--donor-light)', color: 'var(--donor-accent)' }}>#</div>
                            <div>
                              <p className="text-sm font-medium" style={{ color: 'var(--donor-dark)' }}>{fmtCurrency(dd.amount, dd.currency || inv.currency)}</p>
                              <p className="text-xs" style={{ color: 'var(--donor-muted)' }}>{dd.purpose || t('noPurposeSpecified')} &middot; {fmtShortDate(dd.requestDate || dd.createdAt)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {statusPill(dd.status)}
                            {dd.status === 'REQUESTED' && (
                              <>
                                <button onClick={() => setDrawdownAction({ type: 'approve', investmentId: inv.id, drawdownId: dd.id })}
                                  className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-white transition-all hover:opacity-90"
                                  style={{ background: '#16A34A' }}>{t('approve')}</button>
                                <button onClick={() => setDrawdownAction({ type: 'reject', investmentId: inv.id, drawdownId: dd.id })}
                                  className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-white transition-all hover:opacity-90"
                                  style={{ background: '#DC2626' }}>{t('reject')}</button>
                              </>
                            )}
                            {dd.utilisationAmount != null && (
                              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#DBEAFE', color: '#1D4ED8' }}>
                                {t('utilised')}: {fmtCurrency(dd.utilisationAmount, dd.currency || inv.currency)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Covenants */}
                {covenants.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--donor-dark)' }}>{t('covenants')}</h3>
                    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--donor-border)' }}>
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ background: 'var(--donor-light)' }}>
                            {[t('description'), t('metric'), t('threshold'), t('checkFreq'), t('lastChecked'), t('status')].map((h, i) => (
                              <th key={i} className={`px-3 py-2.5 text-xs font-medium uppercase tracking-wide ${i === 5 ? 'text-center' : 'text-left'}`} style={{ color: 'var(--donor-muted)' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {covenants.map((c: any) => (
                            <tr key={c.id} className="border-t" style={{ borderColor: 'var(--donor-border)', background: c.status === 'BREACH' ? '#FFF7F7' : 'transparent' }}>
                              <td className="px-3 py-2.5 font-medium" style={{ color: 'var(--donor-dark)' }}>{c.description}</td>
                              <td className="px-3 py-2.5" style={{ color: 'var(--donor-muted)' }}>{c.metric || '—'}</td>
                              <td className="px-3 py-2.5 font-mono" style={{ color: 'var(--donor-dark)' }}>{c.threshold || '—'}</td>
                              <td className="px-3 py-2.5" style={{ color: 'var(--donor-muted)' }}>{c.checkFrequency || '—'}</td>
                              <td className="px-3 py-2.5" style={{ color: 'var(--donor-dark)' }}>{fmtShortDate(c.lastCheckedAt)}</td>
                              <td className="px-3 py-2.5 text-center">{statusPill(c.status)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ROI Summary */}
                <div>
                  <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--donor-dark)' }}>{t('roiSummary')}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {(() => {
                      const facility = parseFloat(inv.totalFacility) || 0
                      const interestPaid = parseFloat(inv.totalInterestPaid) || 0
                      const accruedInterest = parseFloat(inv.accruedInterest) || 0
                      const outstanding = parseFloat(inv.outstandingPrincipal) || 0
                      const roi = facility > 0 ? ((interestPaid / facility) * 100).toFixed(2) : '0.00'
                      const projectedRoi = facility > 0 ? (((interestPaid + accruedInterest) / facility) * 100).toFixed(2) : '0.00'
                      return [
                        { label: t('interestEarned'), value: fmtCurrency(interestPaid, inv.currency), color: '#16A34A' },
                        { label: t('accruedInterestLabel'), value: fmtCurrency(accruedInterest, inv.currency), color: 'var(--donor-muted)' },
                        { label: t('currentRoi'), value: `${roi}%`, color: 'var(--donor-accent)' },
                        { label: t('projectedRoi'), value: `${projectedRoi}%`, color: '#1D4ED8' },
                      ]
                    })().map((card, i) => (
                      <div key={i} className="rounded-xl border px-4 py-3" style={{ background: 'var(--donor-light)', borderColor: 'var(--donor-border)' }}>
                        <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{card.label}</p>
                        <p className="text-lg font-bold mt-1" style={{ color: card.color }}>{card.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {inv.notes && (
                  <div className="rounded-lg px-4 py-3" style={{ background: 'var(--donor-light)' }}>
                    <p className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--donor-muted)' }}>{t('notes')}</p>
                    <p className="text-sm" style={{ color: 'var(--donor-dark)' }}>{inv.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Drawdown action modal */}
      {drawdownAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--donor-dark)' }}>
              {drawdownAction.type === 'approve' ? t('approveDrawdown') : t('rejectDrawdown')}
            </h3>
            {drawdownAction.type === 'reject' && (
              <div className="mb-4">
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--donor-muted)' }}>{t('rejectionReason')}</label>
                <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--donor-border)', color: 'var(--donor-dark)' }}
                  rows={3} placeholder={t('enterReasonForRejection')} />
              </div>
            )}
            <p className="text-sm mb-4" style={{ color: 'var(--donor-muted)' }}>
              {drawdownAction.type === 'approve'
                ? t('drawdownApproveNotice')
                : t('drawdownRejectNotice')}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setDrawdownAction(null); setRejectReason('') }}
                className="px-4 py-2 rounded-lg text-sm font-medium border" style={{ borderColor: 'var(--donor-border)', color: 'var(--donor-muted)' }}>{t('cancel')}</button>
              <button onClick={handleDrawdownAction} disabled={actionLoading}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ background: drawdownAction.type === 'approve' ? '#16A34A' : '#DC2626' }}>
                {actionLoading ? t('processing') : drawdownAction.type === 'approve' ? t('confirmApprove') : t('confirmReject')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm/Reject payment modal */}
      {paymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--donor-dark)' }}>Review Payment</h3>
            <div className="rounded-lg px-4 py-3 mb-4 space-y-1" style={{ background: 'var(--donor-light)' }}>
              <p className="text-xs" style={{ color: 'var(--donor-muted)' }}>{t('instalmentNumber', { num: paymentModal.instalment.instalmentNumber })}</p>
              <p className="text-sm font-bold" style={{ color: 'var(--donor-dark)' }}>{t('totalDueColon')} {fmtCurrency(paymentModal.instalment.totalDue)}</p>
              <p className="text-sm font-bold" style={{ color: '#16A34A' }}>{t('submittedColon')} {fmtCurrency(paymentModal.instalment.paidAmount)}</p>
              {paymentModal.instalment.paymentNotes && (
                <p className="text-xs" style={{ color: 'var(--donor-dark)' }}>{t('notesColon')} {paymentModal.instalment.paymentNotes}</p>
              )}
              {paymentModal.instalment.proofDocumentId && (
                <p className="text-xs font-medium" style={{ color: 'var(--donor-accent)' }}>{t('proofDocumentAttached')}</p>
              )}
            </div>
            <p className="text-sm mb-4" style={{ color: 'var(--donor-muted)' }}>
              {t('confirmPaymentNotice')}
            </p>
            <div className="mb-4">
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--donor-muted)' }}>{t('rejectionReasonOptional')}</label>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--donor-border)', color: 'var(--donor-dark)' }}
                rows={2} placeholder={t('onlyNeededIfRejecting')} />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setPaymentModal(null); setRejectReason('') }}
                className="px-4 py-2 rounded-lg text-sm font-medium border" style={{ borderColor: 'var(--donor-border)', color: 'var(--donor-muted)' }}>{t('cancel')}</button>
              <button onClick={handleRejectPayment} disabled={actionLoading}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ background: '#DC2626' }}>
                {actionLoading ? t('rejecting') : t('reject')}
              </button>
              <button onClick={handleConfirmPayment} disabled={actionLoading}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ background: '#16A34A' }}>
                {actionLoading ? t('confirming') : t('confirmPayment')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────
// ── Loading skeleton ──────────────────────────────────────────
// ── Logframe Tab ────────────────────────────────────────────
interface LogframeIndicatorDonor {
  id: string; indicator: string
  baselineValue: string | null; targetValue: string | null; actualValue: string | null
  unit: string | null; ragStatus: string; reportingPeriod: string | null
  notes: string | null; lastUpdatedAt: string | null; measurementMethod: string | null
}

interface LogframeOutputDonor {
  id: string; outputNumber: number; title: string; description: string | null
  indicators: LogframeIndicatorDonor[]
}

function LogframeTab({ projectId }: { projectId: string }) {
  const t = useTranslations('projectDetail')
  const [outputs, setOutputs] = useState<LogframeOutputDonor[]>([])
  const [logframeGoal, setLogframeGoal] = useState<string | null>(null)
  const [logframePurpose, setLogframePurpose] = useState<string | null>(null)
  const [logframeAssumptions, setLogframeAssumptions] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    apiGet(`/api/donor/projects/${projectId}/logframe`)
      .then(async r => {
        if (r.ok) {
          const d = await r.json()
          setOutputs(d.outputs ?? [])
          setLogframeGoal(d.logframeGoal || null)
          setLogframePurpose(d.logframePurpose || null)
          setLogframeAssumptions(d.logframeAssumptions || null)
        } else { setError(true) }
        setLoading(false)
      })
      .catch(() => { setError(true); setLoading(false) })
  }, [projectId])

  if (loading) return <p className="text-sm py-4" style={{ color: 'var(--donor-muted)' }}>{t('loadingLogframe')}</p>
  if (error) return <p className="text-sm py-4 text-red-500">{t('failedToLoadLogframe')}</p>

  const ragColors: Record<string, { bg: string; text: string; label: string }> = {
    GREEN: { bg: '#F0FDF4', text: '#166534', label: t('ragOnTrack') },
    AMBER: { bg: '#FFFBEB', text: '#92400E', label: t('ragAtRisk') },
    RED: { bg: '#FEF2F2', text: '#991B1B', label: t('ragOffTrack') },
    GREY: { bg: '#F3F4F6', text: '#6B7280', label: t('ragNotStarted') },
  }

  const allIndicators = outputs.flatMap(o => o.indicators || [])
  const onTrack = allIndicators.filter(i => i.ragStatus === 'GREEN').length
  const atRisk = allIndicators.filter(i => i.ragStatus === 'AMBER').length
  const offTrack = allIndicators.filter(i => i.ragStatus === 'RED').length

  return (
    <div className="space-y-5">
      {/* Goal, Purpose & Assumptions */}
      {(logframeGoal || logframePurpose || logframeAssumptions) && (
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x" style={{ borderColor: 'var(--donor-border)' }}>
            {logframeGoal && (
              <div className="px-5 py-4">
                <h4 className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: 'var(--donor-muted)' }}>{t('goal')}</h4>
                <p className="text-sm" style={{ color: 'var(--donor-dark)' }}>{logframeGoal}</p>
              </div>
            )}
            {logframePurpose && (
              <div className="px-5 py-4">
                <h4 className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: 'var(--donor-muted)' }}>{t('purpose')}</h4>
                <p className="text-sm" style={{ color: 'var(--donor-dark)' }}>{logframePurpose}</p>
              </div>
            )}
            {logframeAssumptions && (
              <div className="px-5 py-4">
                <h4 className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: 'var(--donor-muted)' }}>{t('assumptions')}</h4>
                <p className="text-sm" style={{ color: 'var(--donor-dark)' }}>{logframeAssumptions}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary banner */}
      <div className="rounded-xl px-5 py-3 flex items-center gap-4 flex-wrap" style={{ background: 'var(--donor-light)', border: '1px solid var(--donor-border)' }}>
        <span className="text-sm font-medium" style={{ color: 'var(--donor-dark)' }}>
          {t('outputCount', { count: outputs.length })} · <span className="font-bold">{t('indicatorCount', { count: allIndicators.length })}</span>
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#F0FDF4', color: '#166534' }}>{t('ragOnTrack')}: {onTrack}</span>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#FFFBEB', color: '#92400E' }}>{t('ragAtRisk')}: {atRisk}</span>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#FEF2F2', color: '#991B1B' }}>{t('ragOffTrack')}: {offTrack}</span>
      </div>

      {outputs.length === 0 ? (
        <div className="rounded-2xl border px-5 py-8 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
          <p className="text-sm" style={{ color: 'var(--donor-muted)' }}>{t('noLogframeOutputs')}</p>
        </div>
      ) : (
        outputs.map(output => (
          <div key={output.id} className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
            <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--donor-border)', background: 'var(--donor-light)' }}>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--donor-dark)' }}>
                {t('outputLabel', { num: output.outputNumber })}: {output.title}
              </h3>
              {output.description && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--donor-muted)' }}>{output.description}</p>
              )}
            </div>
            {(output.indicators || []).length === 0 ? (
              <div className="px-5 py-4 text-center">
                <p className="text-xs" style={{ color: 'var(--donor-muted)' }}>{t('noIndicatorsYet')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'var(--donor-border)' }}>
                      <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('indicator')}</th>
                      <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('baseline')}</th>
                      <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('target')}</th>
                      <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('actual')}</th>
                      <th className="text-center px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('status')}</th>
                      <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('method')}</th>
                      <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('period')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {output.indicators.map(ind => {
                      const rag = ragColors[ind.ragStatus] || ragColors.GREY
                      return (
                        <tr key={ind.id} className="border-b last:border-0" style={{ borderColor: 'var(--donor-border)' }}>
                          <td className="px-4 py-3" style={{ color: 'var(--donor-dark)' }}>
                            <div>{ind.indicator}</div>
                            {ind.notes && (
                              <p className="text-xs mt-0.5" style={{ color: 'var(--donor-muted)' }}>{ind.notes}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono" style={{ color: 'var(--donor-dark)' }}>{ind.baselineValue ?? '—'}{ind.unit ? ` ${ind.unit}` : ''}</td>
                          <td className="px-4 py-3 text-right font-mono" style={{ color: 'var(--donor-dark)' }}>{ind.targetValue ?? '—'}{ind.unit ? ` ${ind.unit}` : ''}</td>
                          <td className="px-4 py-3 text-right font-mono font-medium" style={{ color: 'var(--donor-dark)' }}>{ind.actualValue ?? '—'}{ind.unit ? ` ${ind.unit}` : ''}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: rag.bg, color: rag.text }}>{rag.label}</span>
                          </td>
                          <td className="px-4 py-3 text-xs" style={{ color: 'var(--donor-muted)' }}>{ind.measurementMethod ?? '—'}</td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--donor-muted)' }}>{ind.reportingPeriod ?? '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}

// ── Risk Register Tab ────────────────────────────────────────
interface RiskItem {
  id: string; title: string; description: string | null; category: string | null
  likelihood: number; impact: number; score: number
  status: string; mitigationPlan: string | null; owner: string | null
  createdAt: string; updatedAt: string
}

interface RiskData {
  risks: RiskItem[]
  lastUpdated: string | null
}

function RiskRegisterTab({ projectId }: { projectId: string }) {
  const t = useTranslations('projectDetail')
  const [data, setData] = useState<RiskData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterTab, setFilterTab] = useState<'all' | 'open' | 'high' | 'escalated'>('all')
  const [hoveredCell, setHoveredCell] = useState<string | null>(null)

  useEffect(() => {
    apiGet(`/api/donor/projects/${projectId}/risks`)
      .then(async r => { if (r.ok) setData(await r.json()); setLoading(false) })
      .catch(() => setLoading(false))
  }, [projectId])

  if (loading) return <p className="text-sm py-4" style={{ color: 'var(--donor-muted)' }}>{t('loadingRiskRegister')}</p>
  if (!data) return <p className="text-sm py-4 text-red-500">{t('failedToLoadRiskData')}</p>

  const risks = data.risks || []
  const totalRisks = risks.length
  const highRisks = risks.filter(r => r.score >= 13).length
  const mediumRisks = risks.filter(r => r.score >= 7 && r.score < 13).length
  const lowRisks = risks.filter(r => r.score < 7).length
  const openRisks = risks.filter(r => r.status === 'OPEN' || r.status === 'ACTIVE').length
  const escalatedRisks = risks.filter(r => r.status === 'ESCALATED').length

  const filtered = (() => {
    switch (filterTab) {
      case 'open': return risks.filter(r => r.status === 'OPEN' || r.status === 'ACTIVE')
      case 'high': return risks.filter(r => r.score >= 13)
      case 'escalated': return risks.filter(r => r.status === 'ESCALATED')
      default: return risks
    }
  })()

  // Risk matrix labels
  const likelihoodLabels = [t('riskRare'), t('riskUnlikely'), t('riskPossible'), t('riskLikely'), t('riskAlmostCertain')]
  const impactLabels = [t('riskNegligible'), t('riskMinor'), t('riskModerate'), t('riskMajor'), t('riskCatastrophic')]

  // Build risk matrix grid
  const matrixCells: Record<string, RiskItem[]> = {}
  risks.forEach(r => {
    const key = `${r.likelihood}-${r.impact}`
    if (!matrixCells[key]) matrixCells[key] = []
    matrixCells[key].push(r)
  })

  const getCellColor = (score: number) => {
    if (score >= 13) return '#FEE2E2'
    if (score >= 7) return '#FFFBEB'
    return '#F0FDF4'
  }

  const getCellBorder = (score: number) => {
    if (score >= 13) return '#FECACA'
    if (score >= 7) return '#FDE68A'
    return '#BBF7D0'
  }

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <MiniCard label={t('totalRisks')} value={String(totalRisks)} />
        <MiniCard label={t('high')} value={String(highRisks)} color="#991B1B" />
        <MiniCard label={t('medium')} value={String(mediumRisks)} color="#92400E" />
        <MiniCard label={t('low')} value={String(lowRisks)} color="#166534" />
        <MiniCard label={t('open')} value={String(openRisks)} color="#1D4ED8" />
        <MiniCard label={t('escalated')} value={String(escalatedRisks)} color="#DC2626" />
      </div>

      {/* Risk matrix */}
      <div className="rounded-2xl border px-5 py-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--donor-dark)' }}>{t('riskMatrix')}</h3>
        <div className="overflow-x-auto">
          <div className="inline-block">
            <div className="flex">
              {/* Y-axis label */}
              <div className="flex flex-col justify-center items-center mr-2" style={{ width: '20px' }}>
                <span className="text-[10px] font-medium whitespace-nowrap transform -rotate-90" style={{ color: 'var(--donor-muted)' }}>{t('impact')}</span>
              </div>
              <div>
                {/* Grid rows — impact from 5 (top) to 1 (bottom) */}
                {[5, 4, 3, 2, 1].map(impact => (
                  <div key={impact} className="flex items-center gap-0">
                    <div className="w-20 text-right pr-2 shrink-0">
                      <span className="text-[10px] font-medium" style={{ color: 'var(--donor-muted)' }}>{impactLabels[impact - 1]}</span>
                    </div>
                    {[1, 2, 3, 4, 5].map(likelihood => {
                      const score = likelihood * impact
                      const cellKey = `${likelihood}-${impact}`
                      const cellRisks = matrixCells[cellKey] || []
                      return (
                        <div
                          key={cellKey}
                          className="relative w-16 h-14 border flex items-center justify-center"
                          style={{
                            background: getCellColor(score),
                            borderColor: getCellBorder(score),
                          }}
                          onMouseEnter={() => cellRisks.length > 0 ? setHoveredCell(cellKey) : undefined}
                          onMouseLeave={() => setHoveredCell(null)}
                        >
                          {cellRisks.length > 0 && (
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                              style={{ background: score >= 13 ? '#991B1B' : score >= 7 ? '#92400E' : '#166534' }}>
                              {cellRisks.length}
                            </div>
                          )}
                          {/* Tooltip on hover */}
                          {hoveredCell === cellKey && cellRisks.length > 0 && (
                            <div className="absolute z-20 bottom-full left-1/2 transform -translate-x-1/2 mb-1 w-48 rounded-lg shadow-lg border p-2"
                              style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
                              {cellRisks.map(r => (
                                <p key={r.id} className="text-[10px] truncate" style={{ color: 'var(--donor-dark)' }}>{r.title}</p>
                              ))}
                              <p className="text-[9px] mt-1" style={{ color: 'var(--donor-muted)' }}>{t('score')}: {score}</p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
                {/* X-axis labels */}
                <div className="flex items-center gap-0">
                  <div className="w-20 shrink-0" />
                  {likelihoodLabels.map(label => (
                    <div key={label} className="w-16 text-center">
                      <span className="text-[10px] font-medium" style={{ color: 'var(--donor-muted)' }}>{label}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-0 mt-1">
                  <div className="w-20 shrink-0" />
                  <div className="flex-1 text-center">
                    <span className="text-[10px] font-medium" style={{ color: 'var(--donor-muted)' }}>{t('likelihood')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-lg p-1 flex-wrap" style={{ background: 'var(--donor-light)' }}>
        {([
          { key: 'all' as const, label: `${t('all')} (${risks.length})` },
          { key: 'open' as const, label: `${t('open')} (${openRisks})` },
          { key: 'high' as const, label: `${t('high')} (${highRisks})` },
          { key: 'escalated' as const, label: `${t('escalated')} (${escalatedRisks})` },
        ]).map(tab => (
          <button key={tab.key} onClick={() => setFilterTab(tab.key)}
            className="px-4 py-2 rounded-md text-xs font-medium transition-all"
            style={{
              background: filterTab === tab.key ? '#FFFFFF' : 'transparent',
              color: filterTab === tab.key ? 'var(--donor-dark)' : 'var(--donor-muted)',
              boxShadow: filterTab === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Risk table */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
        {filtered.length === 0 ? (
          <div className="px-5 py-8 text-center"><p className="text-sm" style={{ color: 'var(--donor-muted)' }}>{t('noRisksInCategory')}</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--donor-border)' }}>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('risk')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('category')}</th>
                  <th className="text-center px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('likelihood')}</th>
                  <th className="text-center px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('impact')}</th>
                  <th className="text-center px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('score')}</th>
                  <th className="text-center px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('status')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('mitigation')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('owner')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(risk => {
                  const scoreBg = risk.score >= 13 ? '#FEF2F2' : risk.score >= 7 ? '#FFFBEB' : '#F0FDF4'
                  const scoreText = risk.score >= 13 ? '#991B1B' : risk.score >= 7 ? '#92400E' : '#166534'
                  const statusColors: Record<string, { bg: string; text: string }> = {
                    OPEN: { bg: '#DBEAFE', text: '#1D4ED8' },
                    ACTIVE: { bg: '#DBEAFE', text: '#1D4ED8' },
                    MITIGATED: { bg: '#F0FDF4', text: '#166534' },
                    CLOSED: { bg: '#F3F4F6', text: '#6B7280' },
                    ESCALATED: { bg: '#FEF2F2', text: '#991B1B' },
                  }
                  const sc = statusColors[risk.status] || statusColors.OPEN
                  return (
                    <tr key={risk.id} className="border-b last:border-0" style={{ borderColor: 'var(--donor-border)' }}>
                      <td className="px-4 py-3" style={{ color: 'var(--donor-dark)' }}>
                        <div className="font-medium">{risk.title}</div>
                        {risk.description && <p className="text-xs mt-0.5" style={{ color: 'var(--donor-muted)' }}>{risk.description}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--donor-muted)' }}>{risk.category || '—'}</td>
                      <td className="px-4 py-3 text-center font-mono text-xs" style={{ color: 'var(--donor-dark)' }}>{risk.likelihood}</td>
                      <td className="px-4 py-3 text-center font-mono text-xs" style={{ color: 'var(--donor-dark)' }}>{risk.impact}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: scoreBg, color: scoreText }}>{risk.score}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: sc.bg, color: sc.text }}>{risk.status}</span>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--donor-dark)' }}>{risk.mitigationPlan || '—'}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--donor-muted)' }}>{risk.owner || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer note */}
      <p className="text-xs italic text-center py-2" style={{ color: 'var(--donor-muted)' }}>
        {t('riskRegisterMaintained')}{data.lastUpdated ? ` ${t('lastUpdated')}: ${fmtDate(data.lastUpdated)}` : ''}
      </p>
    </div>
  )
}

function ProjectSkeleton() {
  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="skeleton-pulse rounded h-4 w-64" style={{ background: 'var(--donor-border)' }} />
      <div className="skeleton-pulse rounded h-8 w-80" style={{ background: 'var(--donor-border)' }} />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[1,2,3,4,5].map(i => <div key={i} className="skeleton-pulse rounded-xl h-20" style={{ background: 'var(--donor-border)' }} />)}
      </div>
      <div className="skeleton-pulse rounded-lg h-10 w-80" style={{ background: 'var(--donor-border)' }} />
      {[1,2,3,4,5].map(i => <div key={i} className="skeleton-pulse rounded-xl h-14" style={{ background: 'var(--donor-border)' }} />)}
    </div>
  )
}

function ProjectDetailInner() {
  const t = useTranslations('projectDetail')
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = params?.id as string

  const [data, setData] = useState<ProjectData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'expenses' | 'fraud' | 'budget' | 'audit' | 'requests' | 'impact' | 'logframe' | 'risks' | 'investment' | 'disbursements'>('expenses')
  const [selectedExpense, setSelectedExpense] = useState<string | null>(null)

  // New tab data
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([])
  const [auditHasMore, setAuditHasMore] = useState(false)
  const [auditOffset, setAuditOffset] = useState(0)
  const [auditLoading, setAuditLoading] = useState(false)
  const [requests, setRequests] = useState<DonorRequest[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [showFundingBreakdown, setShowFundingBreakdown] = useState(false)
  const [fundingBreakdown, setFundingBreakdown] = useState<{ breakdown: any[]; totalsByCurrency: any[] } | null>(null)
  const [showShareModal, setShowShareModal] = useState(false)
  const [investments, setInvestments] = useState<any[]>([])
  const [investmentsLoaded, setInvestmentsLoaded] = useState(false)

  // Tranches + Conditions state
  const [tranches, setTranches] = useState<any[]>([])
  const [conditions, setConditions] = useState<any[]>([])
  const [agreementId, setAgreementId] = useState<string | null>(null)
  const [agreements, setAgreements] = useState<any[]>([])
  const [showAddTranche, setShowAddTranche] = useState(false)
  const [showAddCondition, setShowAddCondition] = useState(false)
  const [showReleaseTranche, setShowReleaseTranche] = useState<string | null>(null)
  const [trancheForm, setTrancheForm] = useState({ agreementId: '', amount: '', currency: 'USD', conditions: '', plannedDate: '', notes: '' })
  const [conditionForm, setConditionForm] = useState({ title: '', description: '' })
  const [releaseForm, setReleaseForm] = useState({ releaseDate: '', notes: '' })

  // Filter state
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  // Category expand/collapse state
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({})
  const [catFilter, setCatFilter] = useState<string | null>(null)
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    apiGet(`/api/donor/projects/${id}`)
      .then(async r => {
        if (r.ok) setData(await r.json())
        else {
          const err = await r.json().catch(() => ({ error: 'Failed to load' }))
          setError(err.error || 'Failed to load project')
        }
        setLoading(false)
      })
      .catch(() => { setError('Network error'); setLoading(false) })

    // Fetch audit entries
    apiGet(`/api/donor/projects/${id}/audit?limit=50`)
      .then(async r => { if (r.ok) { const d = await r.json(); setAuditEntries(d.entries || []); setAuditHasMore(d.hasMore || false) } })
      .catch(() => {})

    // Fetch requests
    apiGet(`/api/donor/projects/${id}/requests`)
      .then(async r => { if (r.ok) { const d = await r.json(); setRequests(d.requests || []) } })
      .catch(() => {})

    // Fetch milestones
    apiGet(`/api/donor/projects/${id}/milestones`)
      .then(async r => { if (r.ok) { const d = await r.json(); setMilestones(d.milestones || []) } })
      .catch(() => {})

    // Fetch investments
    apiGet(`/api/donor/projects/${id}/investments`)
      .then(async r => { if (r.ok) { const d = await r.json(); setInvestments(d.investments || []) }; setInvestmentsLoaded(true) })
      .catch(() => { setInvestmentsLoaded(true) })

    // Fetch funding breakdown to get agreements, then tranches & conditions for all
    apiGet(`/api/donor/projects/${id}/funding-breakdown`)
      .then(async r => {
        if (r.ok) {
          const d = await r.json()
          const agList = (d.breakdown || []).map((a: any) => ({ ...a, id: a.fundingAgreementId || a.agreementId || a.id, title: a.agreementName || a.title, amount: a.allocatedAmount || a.totalAmount || a.amount || 0 }))
          setAgreements(agList)
          if (agList.length > 0) {
            const agId = agList[0].id
            setAgreementId(agId)
            // Fetch tranches for ALL agreements
            const allTranches: any[] = []
            await Promise.all(agList.map(async (ag: any) => {
              try {
                const tr = await apiGet(`/api/tranches/donor/funding/${ag.id}`)
                if (tr.ok) {
                  const td = await tr.json()
                  const list = (td.tranches || []).map((t: any) => ({ ...t, _agreementId: ag.id, _agreementTitle: ag.title || ag.funderName || 'Agreement' }))
                  allTranches.push(...list)
                }
              } catch {}
            }))
            setTranches(allTranches)
            // Fetch conditions for first agreement
            apiGet(`/api/conditions/donor/funding/${agId}`)
              .then(async cr => { if (cr.ok) { const cd = await cr.json(); setConditions(cd.conditions || []) } })
              .catch(() => {})
          }
        }
      })
      .catch(() => {})
  }, [id])

  // Deep-link: auto-open expense detail from ?expense= param
  useEffect(() => {
    const expenseParam = searchParams.get('expense')
    if (expenseParam && data) {
      setSelectedExpense(expenseParam)
    }
  }, [searchParams, data])

  // Initialize all categories as expanded
  useEffect(() => {
    if (data) {
      const cats: Record<string, boolean> = {}
      ;(data.expenses || []).forEach(e => { cats[e.category || 'Other'] = true })
      setExpandedCats(cats)
    }
  }, [data])

  const handleExpenseClick = useCallback((expenseId: string) => setSelectedExpense(expenseId), [])
  const closePanel = useCallback(() => setSelectedExpense(null), [])

  const handleMonthClick = useCallback((month: string) => {
    const [y, m] = month.split('-').map(Number)
    setCustomFrom(`${y}-${String(m).padStart(2, '0')}-01`)
    const lastDay = new Date(y, m, 0).getDate()
    setCustomTo(`${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`)
    setFilterPeriod('custom')
    setActiveTab('expenses')
  }, [])

  if (loading) return <ProjectSkeleton />

  if (error || !data) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="text-[13px] mb-4" style={{ color: 'var(--donor-muted)' }}>
          <Link href="/dashboard" className="hover:underline">{t('home')}</Link>
        </div>
        <div className="rounded-xl border px-6 py-8 text-center" style={{ background: 'var(--donor-light)', borderColor: 'var(--donor-border)' }}>
          <p className="text-sm text-red-500">{error || t('projectNotFound')}</p>
        </div>
      </div>
    )
  }

  const { project, expenses: rawExpenses } = data
  const expenses = rawExpenses || []
  const filteredExpenses = filterExpenses(expenses, filterPeriod, customFrom, customTo)
  const openRequests = requests.filter(r => r.status === 'OPEN' || r.status === 'REWORK').length
  const overdueInvestments = investments.reduce((sum: number, inv: any) => sum + (inv.overdueCount || 0), 0)
  const tabs: { key: typeof activeTab; label: string; badge?: number }[] = [
    { key: 'expenses', label: `${t('tabExpenses')} (${expenses.length})` },
    { key: 'fraud', label: t('tabFraudRisk') },
    { key: 'budget', label: t('tabBudget') },
    { key: 'audit', label: t('tabAuditTrail') },
    { key: 'requests', label: t('tabRequests'), badge: openRequests > 0 ? openRequests : undefined },
    { key: 'impact', label: t('tabImpact') },
    { key: 'logframe', label: t('tabLogframe') },
    { key: 'risks', label: t('tabRiskRegister') },
    ...(investmentsLoaded && investments.length > 0 ? [{ key: 'investment' as const, label: `${t('tabInvestments')} (${investments.length})`, badge: overdueInvestments > 0 ? overdueInvestments : undefined }] : []),
    ...(agreementId && agreements.length > 0 ? [{ key: 'disbursements' as const, label: `${t('tabDisbursements')} (${tranches.length})` }] : []),
  ]

  return (
    <div className="p-6 space-y-6 animate-fade-up max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="text-[13px] flex items-center gap-1 flex-wrap" style={{ color: 'var(--donor-muted)' }}>
        <Link href="/dashboard" className="hover:underline">{t('home')}</Link>
        <span>&gt;</span>
        <Link href="/dashboard" className="hover:underline truncate max-w-[20ch] sm:max-w-none">{project.tenantName || t('ngo')}</Link>
        <span>&gt;</span>
        <span style={{ color: 'var(--donor-dark)' }}>{project.name}</span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--donor-dark)' }}>{project.name}</h1>
        <button
          onClick={() => setShowShareModal(true)}
          className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all hover:bg-[var(--donor-light)]"
          style={{ borderColor: 'var(--donor-border)', color: 'var(--donor-accent)' }}
          title={t('share')}
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          {t('share')}
        </button>
      </div>
      {project.description && <p className="text-sm" style={{ color: 'var(--donor-muted)' }}>{project.description}</p>}

      {/* Completion + budget summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="rounded-xl border px-4 py-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>{t('completion')}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xl font-bold" style={{ color: (project.completionPercent ?? 0) >= 70 ? '#16A34A' : (project.completionPercent ?? 0) >= 40 ? '#F59E0B' : '#DC2626' }}>
              {(project.completionPercent ?? 0).toFixed(1)}%
            </span>
            {project.isOverdue && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600">{t('overdue')}</span>}
            {project.isClosed && <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">{t('closed')}</span>}
          </div>
          {!project.hasEndDate && !project.isClosed && (
            <p className="text-[10px] mt-1" style={{ color: '#B45309' }}>{t('endDateMissing')}</p>
          )}
        </div>
        <BudgetCard label={t('totalBudget')} value={project.budget || 0} />
        {project.hasFunding === false ? (
          <div className="rounded-xl border px-4 py-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
            <p className="text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>{t('totalFunded')}</p>
            <p className="text-xl font-bold mt-1" style={{ color: 'var(--donor-muted)' }} title={t('noFundingSourceRecorded')}>&mdash;</p>
          </div>
        ) : (
          <button
            onClick={async () => {
              setShowFundingBreakdown(true)
              if (!fundingBreakdown) {
                try {
                  const r = await apiGet(`/api/donor/projects/${id}/funding-breakdown`)
                  if (r.ok) { const d = await r.json(); setFundingBreakdown(d) }
                } catch {}
              }
            }}
            className="rounded-xl border px-4 py-4 text-left cursor-pointer hover:border-[var(--donor-accent)] transition-all group"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}
            title={t('clickToSeeFundingBreakdown')}
          >
            <p className="text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>{t('totalFunded')}</p>
            <p className="text-xl font-bold mt-1" style={{ color: 'var(--donor-dark)' }}>
              {formatMoney(project.funded || 0, 'USD')}
            </p>
            <p className="text-[10px] mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--donor-accent)' }}>{t('viewBreakdown')} &rarr;</p>
          </button>
        )}
        <BudgetCard label={t('totalSpent')} value={project.spent || 0} />
        <BudgetCard label={t('remaining')} value={project.remaining ?? 0} highlight={(project.remaining ?? 0) < 0} />
      </div>

      {/* Tab bar */}
      {/* Project Closure Status */}
      {(() => {
        const completionPct = project.completionPercent || 0
        const confirmedRequests = requests.filter(r => r.status === 'CONFIRMED').length
        const achievedMilestones = milestones.filter(m => m.status === 'ACHIEVED').length
        const showClosure = completionPct > 70 || confirmedRequests > 0 || achievedMilestones > 0
        if (!showClosure) return null

        const financialPct = (project.budget || 0) > 0 ? Math.min(Math.round(((project.spent || 0) / project.budget) * 100), 100) : 0
        const deliverablePct = requests.length > 0 ? Math.round((confirmedRequests / requests.length) * 100) : 0
        const impactPct = milestones.length > 0 ? Math.round((achievedMilestones / milestones.length) * 100) : 0
        const allComplete = financialPct === 100 && deliverablePct === 100 && impactPct === 100
        const outstanding = [
          financialPct < 100 ? t('financial') : null,
          deliverablePct < 100 ? t('deliverables') : null,
          impactPct < 100 ? t('impact') : null,
        ].filter(Boolean)

        const statusPill = (pct: number) => {
          if (pct === 100) return <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: '#DCFCE7', color: '#16A34A' }}>&#10003; {t('complete')}</span>
          if (pct > 70) return <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: '#FEF3E8', color: '#B45309' }}>&#9889; {t('inProgress')}</span>
          return <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'var(--donor-light)', color: 'var(--donor-muted)' }}>&#9675; {t('pending')}</span>
        }

        const progressBar = (pct: number, color: string) => (
          <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--donor-light)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color, minWidth: pct > 0 ? '4px' : '0' }} />
          </div>
        )

        return (
          <div className="rounded-2xl border px-5 py-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--donor-dark)' }}>{t('projectClosureStatus')}</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-24 text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>{t('financial')}</span>
                {progressBar(financialPct, 'var(--donor-accent)')}
                <span className="w-10 text-right text-xs font-bold" style={{ color: 'var(--donor-dark)' }}>{financialPct}%</span>
                {statusPill(financialPct)}
              </div>
              <div className="flex items-center gap-3">
                <span className="w-24 text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>{t('deliverables')}</span>
                {progressBar(deliverablePct, 'var(--donor-accent)')}
                <span className="w-10 text-right text-xs font-bold" style={{ color: 'var(--donor-dark)' }}>{deliverablePct}%</span>
                {statusPill(deliverablePct)}
              </div>
              <div className="flex items-center gap-3">
                <span className="w-24 text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>{t('impact')}</span>
                {progressBar(impactPct, 'var(--donor-accent)')}
                <span className="w-10 text-right text-xs font-bold" style={{ color: 'var(--donor-dark)' }}>{impactPct}%</span>
                {statusPill(impactPct)}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--donor-border)' }}>
              {allComplete ? (
                <p className="text-sm font-medium" style={{ color: '#16A34A' }}>&#10003; {t('projectReadyForClosure')}</p>
              ) : (
                <p className="text-sm" style={{ color: '#B45309' }}>{t('projectClosurePending', { items: outstanding.join(', ') })}</p>
              )}
            </div>
          </div>
        )
      })()}

      <div className="flex gap-1 rounded-lg p-1 flex-wrap" style={{ background: 'var(--donor-light)' }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-1.5"
            style={{
              background: activeTab === tab.key ? 'var(--bg-card)' : 'transparent',
              color: activeTab === tab.key ? 'var(--donor-dark)' : 'var(--donor-muted)',
              boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}>
            {tab.label}
            {'badge' in tab && tab.badge ? (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ background: '#DC2626' }}>{tab.badge}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'this_month', 'last_month', 'this_quarter', 'custom'] as FilterPeriod[]).map(p => (
              <button key={p} onClick={() => setFilterPeriod(p)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: filterPeriod === p ? '#3C3489' : 'var(--donor-light)',
                  color: filterPeriod === p ? '#FFFFFF' : 'var(--donor-accent)',
                }}>
                {p === 'all' ? t('all') : p === 'this_month' ? t('thisMonth') : p === 'last_month' ? t('lastMonth') : p === 'this_quarter' ? t('thisQuarter') : t('custom')}
              </button>
            ))}
            {filterPeriod === 'custom' && (
              <div className="flex items-center gap-2">
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                  className="px-2 py-1 rounded-lg text-xs border" style={{ borderColor: 'var(--donor-border)', color: 'var(--donor-dark)' }} />
                <span className="text-xs" style={{ color: 'var(--donor-muted)' }}>{t('to')}</span>
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                  className="px-2 py-1 rounded-lg text-xs border" style={{ borderColor: 'var(--donor-border)', color: 'var(--donor-dark)' }} />
              </div>
            )}
          </div>

          {/* Running total + export */}
          <div className="flex items-center justify-between">
            <p className="text-sm" style={{ color: 'var(--donor-muted)' }}>
              {catFilter
                ? `${t('showingExpensesInCategory', { count: filteredExpenses.filter(e => (e.category || 'Other') === catFilter).length, category: catFilter })} \u2014 ${Object.entries(filteredExpenses.filter(e => (e.category || 'Other') === catFilter).reduce((acc, e) => { const cur = e.currency || 'USD'; acc[cur] = (acc[cur] || 0) + (e.amount || 0); return acc }, {} as Record<string, number>)).map(([cur, amt]) => formatMoney(amt, cur)).join(' \u00B7 ')}`
                : `${t('showingExpenses', { count: filteredExpenses.length })} \u2014 ${t('total')}: ${Object.entries(filteredExpenses.reduce((acc, e) => { const cur = e.currency || 'USD'; acc[cur] = (acc[cur] || 0) + (e.amount || 0); return acc }, {} as Record<string, number>)).map(([cur, amt]) => formatMoney(amt, cur)).join(' \u00B7 ')}`
              }
            </p>
            <div className="flex items-center gap-2">
              {catFilter && (
                <button onClick={() => setCatFilter(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-gray-50 transition-all"
                  style={{ borderColor: 'var(--donor-border)', color: '#B45309' }}>
                  {t('clearFilter')}: {catFilter}
                </button>
              )}
              <button onClick={() => exportCSV(filteredExpenses, project.name)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border hover:bg-gray-50 transition-all"
                style={{ borderColor: 'var(--donor-border)', color: 'var(--donor-accent)' }}>
                {t('exportCsv')}
              </button>
            </div>
          </div>

          {/* Expand all / Collapse all */}
          <div className="flex items-center gap-3">
            <button onClick={() => { const cats: Record<string, boolean> = {}; filteredExpenses.forEach(e => { cats[e.category || 'Other'] = true }); setExpandedCats(cats) }}
              className="text-xs hover:underline" style={{ color: 'var(--donor-accent)' }}>{t('expandAll')}</button>
            <button onClick={() => setExpandedCats({})}
              className="text-xs hover:underline" style={{ color: 'var(--donor-accent)' }}>{t('collapseAll')}</button>
          </div>

          {/* Category-grouped expense table */}
          <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
            {filteredExpenses.length === 0 ? (
              <div className="px-5 py-8 text-center"><p className="text-sm" style={{ color: 'var(--donor-muted)' }}>{t('noExpensesInPeriod')}</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'var(--donor-border)' }}>
                      <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('date')}</th>
                      <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('vendor')}</th>
                      <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('amount')}</th>
                      <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('category')}</th>
                      <th className="text-center px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('risk')}</th>
                      <th className="text-center px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('seal')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const grouped: Record<string, Expense[]> = {}
                      const displayList = catFilter ? filteredExpenses.filter(e => (e.category || 'Other') === catFilter) : filteredExpenses
                      displayList.forEach(e => {
                        const cat = e.category || 'Other'
                        if (!grouped[cat]) grouped[cat] = []
                        grouped[cat].push(e)
                      })
                      const catNames = Object.keys(grouped).sort()
                      return catNames.map(cat => {
                        const catExps = grouped[cat]
                        const catTotal = catExps.reduce((s, e) => s + (e.amount || 0), 0)
                        const isExpanded = expandedCats[cat] !== false
                        return (
                          <React.Fragment key={cat}>
                            <tr className="border-b cursor-pointer hover:bg-[var(--donor-light)]" style={{ borderColor: 'var(--donor-border)', background: 'var(--bg-card)' }}
                              onClick={() => setExpandedCats(prev => ({ ...prev, [cat]: !isExpanded }))}>
                              <td colSpan={4} className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs" style={{ color: 'var(--donor-muted)' }}>{isExpanded ? '\u25BC' : '\u25B6'}</span>
                                  <span className="text-sm font-semibold" style={{ color: 'var(--donor-dark)' }}>{cat}</span>
                                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--donor-light)', color: 'var(--donor-accent)' }}>{catExps.length}</span>
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono text-sm font-semibold" style={{ color: 'var(--donor-dark)' }} colSpan={2}>
                                {formatMoney(catTotal, catExps[0]?.currency || 'USD')}
                              </td>
                            </tr>
                            {isExpanded && catExps.map(e => (
                              <tr key={e.id} onClick={() => handleExpenseClick(e.id)}
                                className="border-b last:border-0 hover:bg-[var(--donor-light)] transition-all cursor-pointer" style={{ borderColor: 'var(--donor-border)' }}>
                                <td className="px-4 py-3" style={{ color: 'var(--donor-dark)' }}>{fmtDate(e.date)}</td>
                                <td className="px-4 py-3" onClick={ev => ev.stopPropagation()}>
                                  <button onClick={() => setSelectedVendor(e.vendor)}
                                    className="font-medium hover:underline cursor-pointer" style={{ color: 'var(--donor-accent)' }}>
                                    {e.vendor || '\u2014'}
                                  </button>
                                </td>
                                <td className="px-4 py-3 text-right font-mono font-medium" style={{ color: 'var(--donor-dark)' }}>{formatMoney(e.amount || 0, e.currency || 'USD')}</td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-1.5">
                                    <span style={{ color: 'var(--donor-muted)' }}>{e.category}</span>
                                    <CapExOpExPill type={e.expenditureType} />
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center"><RiskPill level={e.fraudRiskLevel} /></td>
                                <td className="px-4 py-3 text-center" onClick={ev => ev.stopPropagation()}><SealPill sealId={e.sealId} /></td>
                              </tr>
                            ))}
                          </React.Fragment>
                        )
                      })
                    })()}
                    {/* Total row */}
                    <tr className="border-t-2 font-bold" style={{ borderColor: 'var(--donor-border)' }}>
                      <td className="px-4 py-3" style={{ color: 'var(--donor-dark)' }} colSpan={2}>{t('total')}</td>
                      <td className="px-4 py-3 text-right font-mono" style={{ color: 'var(--donor-dark)' }} colSpan={4}>
                        {Object.entries(filteredExpenses.reduce((acc, e) => { const cur = e.currency || 'USD'; acc[cur] = (acc[cur] || 0) + (e.amount || 0); return acc }, {} as Record<string, number>))
                          .map(([cur, amt]) => formatMoney(amt, cur)).join(' \u00B7 ')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'fraud' && <FraudTab expenses={expenses} projectId={id} onExpenseClick={handleExpenseClick} duplicateGroups={data?.duplicateGroups || []} />}
      {activeTab === 'budget' && <BudgetTab projectId={id} onMonthClick={handleMonthClick} />}

      {/* ── Audit Trail Tab ── */}
      {activeTab === 'audit' && (
        <AuditTrailTab
          projectId={id}
          entries={auditEntries}
          setEntries={setAuditEntries}
          hasMore={auditHasMore}
          setHasMore={setAuditHasMore}
          offset={auditOffset}
          setOffset={setAuditOffset}
          loading={auditLoading}
          setLoading={setAuditLoading}
          onExpenseClick={handleExpenseClick}
        />
      )}

      {/* ── Requests Tab ── */}
      {activeTab === 'requests' && (
        <RequestsTab projectId={id} requests={requests} setRequests={setRequests} />
      )}

      {/* ── Impact Tab ── */}
      {activeTab === 'impact' && (
        <ImpactTab milestones={milestones} totalSpent={project.spent} />
      )}

      {/* ── Logframe Tab ── */}
      {activeTab === 'logframe' && (
        <LogframeTab projectId={id} />
      )}

      {/* ── Risk Register Tab ── */}
      {activeTab === 'risks' && (
        <RiskRegisterTab projectId={id} />
      )}

      {/* ── Investment Tab ── */}
      {activeTab === 'investment' && investments.length > 0 && (
        <InvestmentTab investments={investments} projectId={id} />
      )}

      {activeTab === 'disbursements' && agreementId && agreements.length > 0 && (
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
          <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--donor-border)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--donor-dark)' }}>{t('disbursements')}</h2>
            <button onClick={() => setShowAddTranche(true)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: 'var(--donor-accent)' }}>+ {t('addDisbursement')}</button>
          </div>
          {tranches.length === 0 && (
            <div className="px-5 py-6 text-center">
              <p className="text-sm" style={{ color: 'var(--donor-muted)' }}>{t('noDisbursementsYet')}</p>
            </div>
          )}
          {/* Tranche progress summary */}
          {tranches.length > 0 && (() => {
            const released = tranches.filter((t: any) => t.status === 'RELEASED' || t.status === 'UTILISED').length
            const totalAmt = tranches.reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0)
            const releasedAmt = tranches.filter((t: any) => t.status === 'RELEASED' || t.status === 'UTILISED').reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0)
            const pendingAmt = totalAmt - releasedAmt
            return (
              <div className="px-5 py-3 border-b grid grid-cols-3 gap-3" style={{ borderColor: 'var(--donor-border)' }}>
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-wide font-medium" style={{ color: 'var(--donor-muted)' }}>{t('totalTranched')}</p>
                  <p className="text-sm font-bold" style={{ color: 'var(--donor-dark)' }}>{formatMoney(totalAmt, 'USD')}</p>
                  <p className="text-[10px]" style={{ color: 'var(--donor-muted)' }}>{t('trancheCount', { count: tranches.length })}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-wide font-medium" style={{ color: '#16A34A' }}>{t('released')}</p>
                  <p className="text-sm font-bold" style={{ color: '#16A34A' }}>{formatMoney(releasedAmt, 'USD')}</p>
                  <p className="text-[10px]" style={{ color: '#16A34A' }}>{t('nReleased', { count: released })}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-wide font-medium" style={{ color: '#B45309' }}>{t('pending')}</p>
                  <p className="text-sm font-bold" style={{ color: '#B45309' }}>{formatMoney(pendingAmt, 'USD')}</p>
                  <p className="text-[10px]" style={{ color: '#B45309' }}>{t('nPending', { count: tranches.length - released })}</p>
                </div>
              </div>
            )
          })()}
          {tranches.length > 0 && <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--donor-light)' }}>
                  <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>Disbursement</th>
                  <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('fundingAgreement')}</th>
                  <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('conditions')}</th>
                  <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('plannedDate')}</th>
                  <th className="text-center px-4 py-2 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('status')}</th>
                  <th className="text-right px-4 py-2 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('actualRelease')}</th>
                  <th className="text-center px-4 py-2 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('evidence')}</th>
                  <th className="text-center px-4 py-2 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('action')}</th>
                </tr>
              </thead>
              <tbody>
                {tranches.map((t: any, i: number) => {
                  const statusColors: Record<string, { bg: string; text: string }> = {
                    PENDING: { bg: '#F3F4F6', text: '#6B7280' },
                    CONDITIONS_MET: { bg: '#FEF3E8', text: '#B45309' },
                    RELEASED: { bg: '#DCFCE7', text: '#16A34A' },
                    UTILISED: { bg: '#DBEAFE', text: '#1D4ED8' },
                  }
                  const sc = statusColors[t.status] || statusColors.PENDING
                  return (
                    <tr key={t.id || i} className="border-t" style={{ borderColor: 'var(--donor-border)' }}>
                      <td className="px-4 py-3 font-medium text-xs" style={{ color: 'var(--donor-dark)' }}>{
                        ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'][
                          (t.trancheNumber || t.number || i + 1) - 1
                        ] || `#${t.trancheNumber || t.number || i + 1}`
                      }</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--donor-muted)' }}>{t._agreementTitle || '—'}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--donor-dark)' }}>{t.releaseConditions || t.conditions || t.release_conditions || '—'}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--donor-dark)' }}>{fmtDate(t.plannedReleaseDate)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: sc.bg, color: sc.text }}>{t.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs" style={{ color: 'var(--donor-dark)' }}>{t.actualReleaseDate ? fmtDate(t.actualReleaseDate) : '—'}</td>
                      <td className="px-4 py-3 text-center">
                        {t.evidenceFileUrl ? (
                          <a href={t.evidenceFileUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium hover:opacity-80 transition-all"
                            style={{ background: 'var(--donor-light)', color: 'var(--donor-accent)' }}>
                            📎 View
                          </a>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {(t.status === 'PENDING' || t.status === 'CONDITIONS_MET') && (
                          <button onClick={() => setShowReleaseTranche(t.id)} className="px-3 py-1 rounded-lg text-xs font-medium text-white" style={{ background: t.status === 'CONDITIONS_MET' ? '#16A34A' : 'var(--donor-accent)' }}>
                            Release Funds
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>}
        </div>
      )}

      {/* Add Tranche Modal */}
      {showAddTranche && agreementId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4 animate-fade-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold" style={{ color: 'var(--donor-dark)' }}>{t('addDisbursement')}</h3>
              <button onClick={() => setShowAddTranche(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="space-y-3">
              {agreements.length > 1 && (
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--donor-muted)' }}>{t('fundingAgreement')}</label>
                  <select value={trancheForm.agreementId} onChange={e => setTrancheForm(f => ({ ...f, agreementId: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm" style={{ borderColor: 'var(--donor-border)' }}>
                    <option value="">{t('selectAgreement')}</option>
                    {agreements.map((a: any) => {
                      const tranchedAmt = tranches.filter((t: any) => (t._agreementId || t.fundingAgreementId) === a.id).reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0)
                      const remaining = (Number(a.amount) || 0) - tranchedAmt
                      return <option key={a.id} value={a.id}>{a.title || a.funderName} — {a.currency || 'USD'} {Number(a.amount).toLocaleString()} ({t('remaining')}: {remaining.toLocaleString()})</option>
                    })}
                  </select>
                </div>
              )}
              {(() => {
                const selAgId = trancheForm.agreementId || (agreements.length === 1 ? agreements[0]?.id : null)
                const selAg = agreements.find((a: any) => a.id === selAgId)
                const tranchedForAg = selAgId ? tranches.filter((t: any) => (t._agreementId || t.fundingAgreementId) === selAgId) : tranches
                const tranchedAmt = tranchedForAg.reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0)
                const totalAmt = selAg ? Number(selAg.amount) || 0 : 0
                const remaining = totalAmt - tranchedAmt
                return (
                  <>
                    <div className="px-3 py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--donor-light)', color: 'var(--donor-accent)' }}>
                      {['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'][tranchedForAg.length] || `#${tranchedForAg.length + 1}`} {t('disbursement')}
                    </div>
                    {selAg && (
                      <div className="flex items-center justify-between px-3 py-2 rounded-lg text-xs" style={{ background: '#F0FDF4', color: '#16A34A' }}>
                        <span>{t('total')}: {(selAg.currency || 'USD')} {totalAmt.toLocaleString()}</span>
                        <span>{t('tranched')}: {tranchedAmt.toLocaleString()}</span>
                        <span className="font-bold">{t('remaining')}: {remaining.toLocaleString()}</span>
                      </div>
                    )}
                  </>
                )
              })()}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--donor-muted)' }}>{t('amount')}</label>
                  <input type="number" value={trancheForm.amount} onChange={e => setTrancheForm(f => ({ ...f, amount: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm" style={{ borderColor: 'var(--donor-border)' }} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--donor-muted)' }}>{t('currency')}</label>
                  <select value={trancheForm.currency} onChange={e => setTrancheForm(f => ({ ...f, currency: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm" style={{ borderColor: 'var(--donor-border)' }}>
                    <option>USD</option><option>EUR</option><option>GBP</option><option>CHF</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--donor-muted)' }}>{t('releaseConditions')}</label>
                <textarea value={trancheForm.conditions} onChange={e => setTrancheForm(f => ({ ...f, conditions: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm" style={{ borderColor: 'var(--donor-border)' }} rows={2} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--donor-muted)' }}>{t('plannedDate')}</label>
                <input type="date" value={trancheForm.plannedDate} onChange={e => setTrancheForm(f => ({ ...f, plannedDate: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm" style={{ borderColor: 'var(--donor-border)' }} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--donor-muted)' }}>{t('notes')}</label>
                <textarea value={trancheForm.notes} onChange={e => setTrancheForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm" style={{ borderColor: 'var(--donor-border)' }} rows={2} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowAddTranche(false)} className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--donor-muted)' }}>{t('cancel')}</button>
              <button
                onClick={async () => {
                  try {
                    const targetAgId = trancheForm.agreementId || (agreements.length === 1 ? agreements[0]?.id : agreementId)
                    if (!targetAgId) return
                    const tranchesForAg = tranches.filter((t: any) => (t._agreementId || t.fundingAgreementId) === targetAgId)
                    const nextNumber = tranchesForAg.length + 1
                    const targetAg = agreements.find((a: any) => a.id === targetAgId)
                    const r = await apiPost(`/api/tranches/donor/funding/${targetAgId}`, {
                      trancheNumber: nextNumber, amount: Number(trancheForm.amount), currency: trancheForm.currency,
                      releaseConditions: trancheForm.conditions, plannedReleaseDate: trancheForm.plannedDate, notes: trancheForm.notes,
                    })
                    if (r.ok) {
                      const d = await r.json()
                      const newTranche = { ...(d.tranche || d), _agreementId: targetAgId, _agreementTitle: targetAg?.title || targetAg?.funderName || 'Agreement' }
                      setTranches(prev => [...prev, newTranche])
                      setShowAddTranche(false)
                      setTrancheForm({ agreementId: '', amount: '', currency: 'USD', conditions: '', plannedDate: '', notes: '' })
                    }
                  } catch {}
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--donor-accent)' }}>
                {t('addDisbursement')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Release Tranche Modal */}
      {showReleaseTranche && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4 animate-fade-up" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold" style={{ color: 'var(--donor-dark)' }}>{t('releaseFunds')}</h3>
            <p className="text-sm" style={{ color: 'var(--donor-muted)' }}>{t('confirmReleaseDateNotice')}</p>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--donor-muted)' }}>{t('releaseDate')}</label>
              <input type="date" value={releaseForm.releaseDate} onChange={e => setReleaseForm(f => ({ ...f, releaseDate: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" style={{ borderColor: 'var(--donor-border)' }} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--donor-muted)' }}>Notes</label>
              <textarea value={releaseForm.notes} onChange={e => setReleaseForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" style={{ borderColor: 'var(--donor-border)' }} rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => { setShowReleaseTranche(null); setReleaseForm({ releaseDate: '', notes: '' }) }} className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--donor-muted)' }}>{t('cancel')}</button>
              <button
                onClick={async () => {
                  try {
                    const r = await apiPut(`/api/tranches/donor/${showReleaseTranche}/release`, { actualReleaseDate: releaseForm.releaseDate, notes: releaseForm.notes })
                    if (r.ok) {
                      setTranches(prev => prev.map(t => t.id === showReleaseTranche ? { ...t, status: 'RELEASED', actualReleaseDate: releaseForm.releaseDate } : t))
                      setShowReleaseTranche(null)
                      setReleaseForm({ releaseDate: '', notes: '' })
                    }
                  } catch {}
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#16A34A' }}>
                {t('confirmRelease')}
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-center py-4" style={{ color: 'var(--donor-muted)' }}>{t('footerNote')}</p>

      {/* Expense detail slide-in panel */}
      {selectedExpense && <ExpenseDetailPanel projectId={id} expenseId={selectedExpense} onClose={closePanel} />}

      {/* Vendor detail slide-in panel */}
      {selectedVendor && <VendorPanel vendor={selectedVendor} expenses={expenses} currency={expenses[0]?.currency || 'USD'} onClose={() => setSelectedVendor(null)} onExpenseClick={handleExpenseClick} />}

      {/* Funding breakdown slide-in panel */}
      {showFundingBreakdown && <FundingBreakdownPanel projectName={project.name} data={fundingBreakdown} onClose={() => setShowFundingBreakdown(false)} />}

      {/* Share modal */}
      <ShareModal projectId={id} open={showShareModal} onClose={() => setShowShareModal(false)} />
    </div>
  )
}

export default function ProjectDetailPage() {
  return (
    <Suspense fallback={<ProjectSkeleton />}>
      <ProjectDetailInner />
    </Suspense>
  )
}
