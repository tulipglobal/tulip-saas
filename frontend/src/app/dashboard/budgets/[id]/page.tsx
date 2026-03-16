'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import { apiGet, apiPut, apiPost, apiDelete } from '@/lib/api'
import Link from 'next/link'
import { ArrowLeft, Banknote, Receipt, Edit3, Check, X, Plus, Trash2, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Upload } from 'lucide-react'
import { FUNDING_SOURCE_TYPES, FUNDING_SOURCE_TYPE_KEYS } from '@/lib/ngo-categories'
import CurrencySelect from '@/components/CurrencySelect'
import { formatMoney } from '@/lib/currencies'

interface BudgetLine {
  id: string
  expenseType: string
  category: string
  subCategory: string | null
  description: string | null
  approvedAmount: number
  currency: string
  spent: number
  remaining: number
}

interface BudgetFundingSource {
  id: string
  sourceType: string
  sourceSubType: string | null
  donorName: string
  amount: number
  currency: string
  agreementHash: string | null
  createdAt: string
}

interface ExpenseItem {
  id: string
  description: string
  amount: number
  currency: string
  expenseType: string | null
  category: string | null
  subCategory: string | null
  budgetLineId: string | null
  createdAt: string
  approvalStatus: string
  project: { id: string; name: string }
}

interface BudgetDetail {
  id: string
  name: string
  periodFrom: string
  periodTo: string
  status: string
  notes: string | null
  createdAt: string
  project: { id: string; name: string } | null
  lines: BudgetLine[]
  fundingSources: BudgetFundingSource[]
  fundingAgreements: any[]
  expenses: ExpenseItem[]
  totalApproved: number
  totalSpent: number
  totalFunded: number
  remaining: number
}

interface Tranche {
  id: string
  trancheNumber: number
  conditions: string | null
  plannedDate: string | null
  plannedReleaseDate: string | null
  status: 'PENDING' | 'CONDITIONS_MET' | 'RELEASED' | 'UTILISED'
  releaseConditions: string | null
  releaseDate: string | null
  actualReleaseDate: string | null
  amount: number
  utilisedAmount: number | null
  currency: string
  conditionsConfirmedAt: string | null
  evidenceDocumentId: string | null
  evidenceName: string | null
  evidenceFileUrl: string | null
  agreementTitle: string | null
  _agreementId: string
}

interface GrantCondition {
  id: string
  title: string
  description: string | null
  status: 'ACTIVE' | 'MET' | 'BREACHED' | 'WAIVED'
  fundingAgreementId: string
  note: string | null
  updatedAt: string
}

const STATUS_OPTIONS = ['DRAFT', 'APPROVED', 'ACTIVE', 'CLOSED']

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT:    'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
    APPROVED: 'bg-[var(--tulip-gold)]/10 text-[var(--tulip-forest)] border-[var(--tulip-gold)]/30',
    ACTIVE:   'bg-green-400/10 text-green-400 border-green-400/20',
    CLOSED:   'bg-[var(--tulip-sage)] text-[var(--tulip-forest)]/60 border-[var(--tulip-sage-dark)]',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium ${map[status] ?? map.DRAFT}`}>
      {status}
    </span>
  )
}

function FundingBadge({ totalApproved, totalFunded }: { totalApproved: number; totalFunded: number }) {
  const t = useTranslations('budgetDetail')
  if (totalApproved <= 0) return null
  if (totalFunded >= totalApproved) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium bg-green-400/10 text-green-400 border-green-400/20">
      <CheckCircle size={10} /> {t('fullyFunded')}
    </span>
  )
  if (totalFunded > 0) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium bg-yellow-400/10 text-yellow-400 border-yellow-400/20">
      <AlertTriangle size={10} /> {t('partiallyFunded')}
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium bg-red-400/10 text-red-400 border-red-400/20">
      {t('unfunded')}
    </span>
  )
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const inputCls = "w-full bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-3 py-2 text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none focus:border-[var(--tulip-gold)] transition-all [&>option]:bg-[var(--tulip-sage)]"

export default function BudgetDetailPage() {
  const t = useTranslations('budgetDetail')
  const { id } = useParams<{ id: string }>()
  const [budget, setBudget] = useState<BudgetDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingStatus, setEditingStatus] = useState(false)
  const [newStatus, setNewStatus] = useState('')
  const [statusError, setStatusError] = useState('')

  // Inline add funding source
  const [showAddFunding, setShowAddFunding] = useState(false)
  const [newFunding, setNewFunding] = useState({ sourceType: '', sourceSubType: '', donorName: '', amount: '', currency: 'USD', interestRate: '', interestType: 'FIXED', gracePeriodMonths: '', termMonths: '', autoGenerateSchedule: true, donorOrgId: '' })
  const [addingFunding, setAddingFunding] = useState(false)
  const [donorOrgs, setDonorOrgs] = useState<{ id: string; name: string }[]>([])
  const [donorMode, setDonorMode] = useState<'existing' | 'external'>('existing')

  // Tranches & Conditions state
  const [tranches, setTranches] = useState<Record<string, Tranche[]>>({})
  const [conditions, setConditions] = useState<Record<string, GrantCondition[]>>({})
  const [tranchesExpanded, setTranchesExpanded] = useState(true)
  const [conditionsExpanded, setConditionsExpanded] = useState(true)
  const [utilisationInput, setUtilisationInput] = useState<Record<string, string>>({})
  const [confirmingTranche, setConfirmingTranche] = useState<string | null>(null)
  const [utilisingTranche, setUtilisingTranche] = useState<string | null>(null)
  const [showConditionsModal, setShowConditionsModal] = useState<{ trancheId: string; agreementId: string } | null>(null)
  const [conditionsFile, setConditionsFile] = useState<File | null>(null)
  const [conditionsNotes, setConditionsNotes] = useState('')
  const [breachModal, setBreachModal] = useState<{ conditionId: string; title: string } | null>(null)
  const [breachNote, setBreachNote] = useState('')
  const [breachSubmitting, setBreachSubmitting] = useState(false)
  const [conditionActionLoading, setConditionActionLoading] = useState<string | null>(null)
  const [breachSuccess, setBreachSuccess] = useState(false)
  const [showEvidenceModal, setShowEvidenceModal] = useState<{ trancheId: string; agreementId: string } | null>(null)
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null)
  const [evidenceNotes, setEvidenceNotes] = useState('')
  const [uploadingEvidence, setUploadingEvidence] = useState(false)

  const reload = () => {
    apiGet(`/api/budgets/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setBudget(d); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { reload() }, [id])
  useEffect(() => {
    apiGet('/api/donor/organisations').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.data) setDonorOrgs(d.data)
    }).catch(() => {})
  }, [])

  // Fetch tranches and conditions for funding agreements
  useEffect(() => {
    if (!budget) return
    const agreements = budget.fundingAgreements || []
    const fundingWithAgreement = budget.fundingSources.filter((f: any) => f.fundingAgreementId)

    const allAgreementIds = [
      ...agreements.map((a: any) => a.id),
      ...fundingWithAgreement.map((f: any) => f.fundingAgreementId),
    ].filter((v, i, arr) => arr.indexOf(v) === i) // unique

    if (allAgreementIds.length === 0) return

    // Fetch tranches for each agreement
    allAgreementIds.forEach(agreementId => {
      apiGet(`/api/tranches/ngo/funding/${agreementId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d) {
            const list = d.data || d.tranches || d || []
            if (Array.isArray(list) && list.length > 0) {
              setTranches(prev => ({ ...prev, [agreementId]: list }))
            }
          }
        })
        .catch(() => {})

      apiGet(`/api/conditions/ngo/funding/${agreementId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d) {
            const list = d.data || d.conditions || d || []
            if (Array.isArray(list) && list.length > 0) {
              setConditions(prev => ({ ...prev, [agreementId]: list }))
            }
          }
        })
        .catch(() => {})
    })
  }, [budget])

  const handleStatusChange = async () => {
    if (!budget || !newStatus) return
    setStatusError('')
    const res = await apiPut(`/api/budgets/${id}`, { status: newStatus })
    if (res.ok) {
      setBudget(prev => prev ? { ...prev, status: newStatus } : prev)
      setEditingStatus(false)
    } else {
      const d = await res.json().catch(() => ({}))
      setStatusError(d.error || 'Failed to update status')
    }
  }

  const handleAddFunding = async () => {
    const isImpact = newFunding.sourceType === 'Impact Investment'
    const donorNameValid = donorMode === 'existing' ? !!newFunding.donorOrgId : !!newFunding.donorName
    if (!newFunding.sourceType || !donorNameValid || !newFunding.amount) return
    setAddingFunding(true)
    const payload: Record<string, any> = { ...newFunding }
    // Set donor info based on mode (for all source types)
    if (donorMode === 'existing') {
      payload.donorOrgId = newFunding.donorOrgId
      const org = donorOrgs.find(o => o.id === newFunding.donorOrgId)
      payload.donorName = org?.name || ''
      payload.funderType = 'PORTAL'
    } else {
      payload.donorOrgId = null
      payload.funderType = 'EXTERNAL'
    }
    if (isImpact) {
      payload.interestRate = newFunding.interestRate ? Number(newFunding.interestRate) : null
      payload.interestType = newFunding.interestType
      payload.gracePeriodMonths = newFunding.gracePeriodMonths ? Number(newFunding.gracePeriodMonths) : null
      payload.termMonths = newFunding.termMonths ? Number(newFunding.termMonths) : null
      payload.autoGenerateSchedule = newFunding.autoGenerateSchedule
    }
    const res = await apiPost(`/api/budgets/${id}/funding-sources`, payload)
    if (res.ok) {
      setNewFunding({ sourceType: '', sourceSubType: '', donorName: '', amount: '', currency: 'USD', interestRate: '', interestType: 'FIXED', gracePeriodMonths: '', termMonths: '', autoGenerateSchedule: true, donorOrgId: '' })
      setShowAddFunding(false)
      reload()
    }
    setAddingFunding(false)
  }

  const handleRemoveFunding = async (sourceId: string) => {
    await apiDelete(`/api/budgets/${id}/funding-sources/${sourceId}`)
    reload()
  }

  // Tranche: confirm conditions met (with optional file upload)
  const handleConfirmConditions = async (trancheId: string, agreementId: string) => {
    setConfirmingTranche(trancheId)
    try {
      const token = localStorage.getItem('tulip_token')
      const fd = new FormData()
      if (conditionsNotes) fd.append('notes', conditionsNotes)
      if (conditionsFile) fd.append('file', conditionsFile)

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tranches/ngo/${trancheId}/conditions-met`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      if (res.ok) {
        setTranches(prev => ({
          ...prev,
          [agreementId]: (prev[agreementId] || []).map(t =>
            t.id === trancheId ? { ...t, status: 'CONDITIONS_MET' as const, conditionsConfirmedAt: new Date().toISOString() } : t
          )
        }))
        setShowConditionsModal(null)
        setConditionsFile(null)
        setConditionsNotes('')
      }
    } catch (err) {
      console.error('Confirm conditions error:', err)
    }
    setConfirmingTranche(null)
  }

  const handleAttachEvidence = async (trancheId: string, agreementId: string) => {
    if (!evidenceFile) return
    setUploadingEvidence(true)
    try {
      const token = localStorage.getItem('tulip_token')
      const fd = new FormData()
      fd.append('file', evidenceFile)
      if (evidenceNotes) fd.append('notes', evidenceNotes)

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tranches/ngo/${trancheId}/attach-evidence`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      if (res.ok) {
        const data = await res.json()
        setTranches(prev => ({
          ...prev,
          [agreementId]: (prev[agreementId] || []).map(t =>
            t.id === trancheId ? { ...t, evidenceDocumentId: data.document?.id || 'attached' } : t
          )
        }))
        setShowEvidenceModal(null)
        setEvidenceFile(null)
        setEvidenceNotes('')
      }
    } catch (err) {
      console.error('Attach evidence error:', err)
    }
    setUploadingEvidence(false)
  }

  // Tranche: record utilisation
  const handleRecordUtilisation = async (trancheId: string, agreementId: string) => {
    const amount = Number(utilisationInput[trancheId])
    if (!amount || amount <= 0) return
    setUtilisingTranche(trancheId)
    const res = await apiPut(`/api/tranches/ngo/${trancheId}/utilisation`, { utilisedAmount: amount })
    if (res.ok) {
      setTranches(prev => ({
        ...prev,
        [agreementId]: (prev[agreementId] || []).map(t =>
          t.id === trancheId ? { ...t, status: 'UTILISED' as const, utilisedAmount: amount } : t
        )
      }))
      setUtilisationInput(prev => { const next = { ...prev }; delete next[trancheId]; return next })
    }
    setUtilisingTranche(null)
  }

  // Condition: mark as met
  const handleConditionMet = async (conditionId: string, agreementId: string) => {
    setConditionActionLoading(conditionId)
    const res = await apiPut(`/api/conditions/ngo/${conditionId}/status`, { status: 'MET' })
    if (res.ok) {
      setConditions(prev => ({
        ...prev,
        [agreementId]: (prev[agreementId] || []).map(c =>
          c.id === conditionId ? { ...c, status: 'MET' as const } : c
        )
      }))
    }
    setConditionActionLoading(null)
  }

  // Condition: report breach
  const handleBreachSubmit = async () => {
    if (!breachModal || !breachNote.trim()) return
    setBreachSubmitting(true)
    // Find which agreement this condition belongs to
    let agreementId = ''
    for (const [agId, conds] of Object.entries(conditions)) {
      if (conds.some(c => c.id === breachModal.conditionId)) {
        agreementId = agId
        break
      }
    }
    const res = await apiPut(`/api/conditions/ngo/${breachModal.conditionId}/status`, {
      status: 'BREACHED',
      note: breachNote.trim()
    })
    if (res.ok && agreementId) {
      setConditions(prev => ({
        ...prev,
        [agreementId]: (prev[agreementId] || []).map(c =>
          c.id === breachModal.conditionId ? { ...c, status: 'BREACHED' as const, note: breachNote.trim() } : c
        )
      }))
      setBreachSuccess(true)
      setTimeout(() => {
        setBreachModal(null)
        setBreachNote('')
        setBreachSuccess(false)
      }, 2000)
    }
    setBreachSubmitting(false)
  }

  // Collect all tranches and conditions
  const allTranches = Object.entries(tranches).flatMap(([agId, list]) => list.map(t => ({ ...t, _agreementId: agId })))
  const allConditions = Object.entries(conditions).flatMap(([agId, list]) => list.map(c => ({ ...c, _agreementId: agId })))

  if (loading) return <div className="p-8 text-center text-[var(--tulip-forest)]/40">{t('loading')}</div>
  if (!budget) return <div className="p-8 text-center text-[var(--tulip-forest)]/40">{t('notFound')}</div>

  const fundingPct = budget.totalApproved > 0 ? Math.round((budget.totalFunded / budget.totalApproved) * 100) : 0
  const spentPct = budget.totalApproved > 0 ? Math.round((budget.totalSpent / budget.totalApproved) * 100) : 0
  const fundingGap = budget.totalApproved - budget.totalFunded
  const isFullyFunded = budget.totalApproved > 0 && fundingGap <= 0
  const subTypes = newFunding.sourceType ? (FUNDING_SOURCE_TYPES[newFunding.sourceType] || []) : []

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/dashboard/budgets" className="w-9 h-9 rounded-lg bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] flex items-center justify-center hover:bg-[var(--tulip-sage)] transition-all mt-1">
          <ArrowLeft size={16} className="text-[var(--tulip-forest)]/70" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-[var(--tulip-forest)]" style={{ fontFamily: 'Inter, sans-serif' }}>{budget.name}</h1>
            {editingStatus ? (
              <div className="flex items-center gap-1">
                <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
                  className="bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-2 py-1 text-xs text-[var(--tulip-forest)] outline-none [&>option]:bg-[var(--tulip-sage)]">
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button onClick={handleStatusChange} className="text-green-400 hover:text-green-300"><Check size={14} /></button>
                <button onClick={() => { setEditingStatus(false); setStatusError('') }} className="text-[var(--tulip-forest)]/40 hover:text-[var(--tulip-forest)]/60"><X size={14} /></button>
              </div>
            ) : (
              <button onClick={() => { setEditingStatus(true); setNewStatus(budget.status) }} className="flex items-center gap-1 group">
                <StatusBadge status={budget.status} />
                <Edit3 size={12} className="text-[var(--tulip-forest)]/30 group-hover:text-[var(--tulip-forest)]/60" />
              </button>
            )}
            <FundingBadge totalApproved={budget.totalApproved} totalFunded={budget.totalFunded} />
          </div>
          {statusError && <p className="text-xs text-red-400 mt-1">{statusError}</p>}
          <p className="text-[var(--tulip-forest)]/60 text-sm mt-1">
            {formatDate(budget.periodFrom)} – {formatDate(budget.periodTo)}
            {budget.project && <> · <Link href={`/dashboard/projects/${budget.project.id}`} className="text-cyan-400/60 hover:text-cyan-400">{budget.project.name}</Link></>}
            {budget.notes && <span className="ml-2 text-[var(--tulip-forest)]/40">· {budget.notes}</span>}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t('totalBudgetRequired'), value: formatMoney(budget.totalApproved, budget.lines?.[0]?.currency || 'USD'), color: 'text-[var(--tulip-forest)]' },
          { label: t('totalFunded'), value: formatMoney(budget.totalFunded, budget.lines?.[0]?.currency || 'USD'), sub: `${fundingPct}%`, color: isFullyFunded ? 'text-green-400' : 'text-yellow-400' },
          { label: t('totalSpent'), value: formatMoney(budget.totalSpent, budget.lines?.[0]?.currency || 'USD'), sub: `${spentPct}%`, color: 'text-orange-400' },
          { label: t('remaining'), value: formatMoney(budget.remaining, budget.lines?.[0]?.currency || 'USD'), color: budget.remaining >= 0 ? 'text-green-400' : 'text-red-400' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="rounded-xl border border-[var(--tulip-sage-dark)] px-5 py-4" style={{ background: 'var(--tulip-sage)' }}>
            <div className={`text-lg font-bold ${color}`} style={{ fontFamily: 'Inter, sans-serif' }}>
              {value} {sub && <span className="text-xs font-normal text-[var(--tulip-forest)]/40">{sub}</span>}
            </div>
            <div className="text-xs text-[var(--tulip-forest)]/60 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* 1. Budget vs Actual — grouped by CapEx / OpEx */}
      {(() => {
        const capexLines = budget.lines.filter(l => l.expenseType === 'CAPEX')
        const opexLines = budget.lines.filter(l => l.expenseType === 'OPEX')
        const capexApproved = capexLines.reduce((s, l) => s + l.approvedAmount, 0)
        const capexSpent = capexLines.reduce((s, l) => s + l.spent, 0)
        const capexRemaining = capexLines.reduce((s, l) => s + l.remaining, 0)
        const opexApproved = opexLines.reduce((s, l) => s + l.approvedAmount, 0)
        const opexSpent = opexLines.reduce((s, l) => s + l.spent, 0)
        const opexRemaining = opexLines.reduce((s, l) => s + l.remaining, 0)
        const grandApproved = capexApproved + opexApproved
        const grandSpent = capexSpent + opexSpent
        const grandRemaining = capexRemaining + opexRemaining

        const renderLineRow = (line: BudgetLine) => {
          const pct = line.approvedAmount > 0 ? Math.min(100, Math.round((line.spent / line.approvedAmount) * 100)) : 0
          return (
            <div key={line.id} className="px-5 py-3 lg:grid lg:grid-cols-[2fr_1fr_1fr_1fr_1fr] lg:gap-4 lg:items-center">
              <div>
                <div className="text-sm text-[var(--tulip-forest)]">{line.category}</div>
                {line.subCategory && <div className="text-xs text-[var(--tulip-forest)]/40">{line.subCategory}</div>}
                {line.description && <div className="text-xs text-[var(--tulip-forest)]/30 italic">{line.description}</div>}
              </div>
              <div className="text-sm text-[var(--tulip-forest)] font-medium">{line.currency} {line.approvedAmount.toLocaleString()}</div>
              <div className="text-sm text-orange-400">{line.currency} {line.spent.toLocaleString()}</div>
              <div className={`text-sm font-medium ${line.remaining >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {line.currency} {line.remaining.toLocaleString()}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-[var(--tulip-sage-dark)]/50 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${pct}%`,
                    background: pct > 90 ? '#f87171' : pct > 70 ? '#fbbf24' : '#34d399'
                  }} />
                </div>
                <span className="text-xs text-[var(--tulip-forest)]/60 w-8 text-right">{pct}%</span>
              </div>
            </div>
          )
        }

        const budgetCurrency = budget.lines?.[0]?.currency || 'USD'

        const renderSubtotal = (label: string, approved: number, spent: number, remaining: number) => (
          <div className="px-5 py-2.5 lg:grid lg:grid-cols-[2fr_1fr_1fr_1fr_1fr] lg:gap-4 lg:items-center bg-[var(--tulip-cream)]/60 border-t border-[var(--tulip-sage-dark)]">
            <div className="text-xs font-semibold text-[var(--tulip-forest)]/70 uppercase tracking-wide">{label}</div>
            <div className="text-sm text-[var(--tulip-forest)] font-bold">{formatMoney(approved, budgetCurrency)}</div>
            <div className="text-sm text-orange-500 font-bold">{formatMoney(spent, budgetCurrency)}</div>
            <div className={`text-sm font-bold ${remaining >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatMoney(remaining, budgetCurrency)}</div>
            <div />
          </div>
        )

        return (
          <div className="rounded-xl border border-[var(--tulip-sage-dark)] overflow-hidden" style={{ background: 'var(--tulip-sage)' }}>
            <div className="px-5 py-3 border-b border-[var(--tulip-sage-dark)] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--tulip-forest)]/70 uppercase tracking-wide">{t('budgetVsActual')}</h2>
              <span className="text-xs text-[var(--tulip-forest)]/40">{budget.lines.length !== 1 ? t('lineCountPlural', { count: budget.lines.length }) : t('lineCount', { count: budget.lines.length })}</span>
            </div>
            <div className="hidden lg:grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 px-5 py-2 border-b border-[var(--tulip-sage-dark)] text-xs text-[var(--tulip-forest)]/40 uppercase tracking-wide">
              <span>{t('category')}</span><span>{t('approved')}</span><span>{t('spent')}</span><span>{t('remaining')}</span><span>{t('usage')}</span>
            </div>

            {/* CapEx section */}
            {capexLines.length > 0 && (
              <>
                <div className="px-5 py-2 border-b border-[var(--tulip-sage-dark)] bg-[#EFF6FF]/40">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#EFF6FF] text-[#1D4ED8] border border-[#1D4ED8]/20">
                    {t('capexLabel')}
                  </span>
                </div>
                <div className="divide-y divide-[var(--tulip-sage-dark)]">
                  {capexLines.map(renderLineRow)}
                </div>
                {renderSubtotal(t('capexSubtotal'), capexApproved, capexSpent, capexRemaining)}
              </>
            )}

            {/* OpEx section */}
            {opexLines.length > 0 && (
              <>
                <div className="px-5 py-2 border-b border-[var(--tulip-sage-dark)] bg-[#F3F4F6]/40">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#F3F4F6] text-[#4B5563] border border-[#4B5563]/20">
                    {t('opexLabel')}
                  </span>
                </div>
                <div className="divide-y divide-[var(--tulip-sage-dark)]">
                  {opexLines.map(renderLineRow)}
                </div>
                {renderSubtotal(t('opexSubtotal'), opexApproved, opexSpent, opexRemaining)}
              </>
            )}

            {/* Grand Total */}
            {(capexLines.length > 0 && opexLines.length > 0) && (
              <div className="px-5 py-3 lg:grid lg:grid-cols-[2fr_1fr_1fr_1fr_1fr] lg:gap-4 lg:items-center bg-[var(--tulip-forest)]/5 border-t-2 border-[var(--tulip-forest)]/20">
                <div className="text-sm font-bold text-[var(--tulip-forest)] uppercase tracking-wide">{t('grandTotal')}</div>
                <div className="text-sm text-[var(--tulip-forest)] font-bold">{formatMoney(grandApproved, budgetCurrency)}</div>
                <div className="text-sm text-orange-500 font-bold">{formatMoney(grandSpent, budgetCurrency)}</div>
                <div className={`text-sm font-bold ${grandRemaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatMoney(grandRemaining, budgetCurrency)}</div>
                <div />
              </div>
            )}
          </div>
        )
      })()}

      {/* 2. Funding Sources */}
      <div className="rounded-xl border border-[var(--tulip-sage-dark)] overflow-hidden" style={{ background: 'var(--tulip-sage)' }}>
        <div className="px-5 py-3 border-b border-[var(--tulip-sage-dark)] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--tulip-forest)]/70 uppercase tracking-wide flex items-center gap-2">
            <Banknote size={14} /> {t('fundingSources')}
          </h2>
          <div className="flex items-center gap-3">
            <FundingBadge totalApproved={budget.totalApproved} totalFunded={budget.totalFunded} />
            <button onClick={() => setShowAddFunding(true)}
              className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
              <Plus size={12} /> {t('add')}
            </button>
          </div>
        </div>

        {budget.fundingSources.length === 0 && !showAddFunding ? (
          <div className="px-5 py-6 text-center text-[var(--tulip-forest)]/40 text-sm">
            {t('noFundingSources')}{' '}
            <button onClick={() => setShowAddFunding(true)} className="text-cyan-400 hover:text-cyan-300">{t('addOne')}</button>
          </div>
        ) : (
          <div className="divide-y divide-[var(--tulip-sage-dark)]">
            {budget.fundingSources.map(f => (
              <div key={f.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <div className="text-sm text-[var(--tulip-forest)]">{f.donorName}</div>
                  <div className="text-xs text-[var(--tulip-forest)]/40">
                    {f.sourceType}{f.sourceSubType ? ` / ${f.sourceSubType}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-[var(--tulip-forest)]">{f.currency} {f.amount.toLocaleString()}</span>
                  <button onClick={() => handleRemoveFunding(f.id)}
                    className="text-[var(--tulip-forest)]/30 hover:text-red-400 transition-colors" title="Remove">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Inline add form */}
        {showAddFunding && (
          <div className="px-5 py-4 border-t border-[var(--tulip-sage-dark)] space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-[var(--tulip-forest)]/60 mb-1 block">{t('sourceType')} *</label>
                <select value={newFunding.sourceType} onChange={e => setNewFunding(p => ({ ...p, sourceType: e.target.value, sourceSubType: '' }))}
                  className={inputCls}>
                  <option value="">{t('select')}</option>
                  {FUNDING_SOURCE_TYPE_KEYS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--tulip-forest)]/60 mb-1 block">{t('subType')}</label>
                <select value={newFunding.sourceSubType} onChange={e => setNewFunding(p => ({ ...p, sourceSubType: e.target.value }))}
                  disabled={subTypes.length === 0} className={inputCls + ' disabled:opacity-40'}>
                  <option value="">{t('select')}</option>
                  {subTypes.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--tulip-forest)]/60 mb-1 block">{t('fundedBy')} *</label>
                <div className="flex rounded-lg overflow-hidden border border-[var(--tulip-sage-dark)] mb-2">
                  {(['existing', 'external'] as const).map(m => (
                    <button key={m} onClick={() => { setDonorMode(m); setNewFunding(p => ({ ...p, donorOrgId: '', donorName: '' })) }}
                      className="flex-1 px-3 py-1.5 text-[11px] font-medium transition-all"
                      style={{ background: donorMode === m ? 'var(--tulip-forest)' : 'var(--tulip-sage)', color: donorMode === m ? 'var(--tulip-cream)' : 'var(--tulip-forest)' }}>
                      {m === 'existing' ? t('existingDonor') : t('other')}
                    </button>
                  ))}
                </div>
                {donorMode === 'existing' ? (
                  <select value={newFunding.donorOrgId} onChange={e => setNewFunding(p => ({ ...p, donorOrgId: e.target.value }))}
                    className={inputCls}>
                    <option value="">{t('selectDonorOrg')}</option>
                    {donorOrgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                ) : (
                  <input value={newFunding.donorName} onChange={e => setNewFunding(p => ({ ...p, donorName: e.target.value }))}
                    placeholder={t('donorPlaceholder')} className={inputCls} />
                )}
              </div>
              <div>
                <label className="text-xs text-[var(--tulip-forest)]/60 mb-1 block">{t('amount')} *</label>
                <div className="flex gap-1.5">
                  <CurrencySelect compact value={newFunding.currency} onChange={v => setNewFunding(p => ({ ...p, currency: v }))} />
                  <input type="number" min="0" step="0.01" value={newFunding.amount}
                    onChange={e => setNewFunding(p => ({ ...p, amount: e.target.value }))} placeholder="0.00"
                    className="flex-1 bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-3 py-2 text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none focus:border-[var(--tulip-gold)] transition-all" />
                </div>
              </div>
            </div>
            {newFunding.sourceType === 'Impact Investment' && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-[var(--tulip-forest)]/60 mb-1 block">{t('interestRate')}</label>
                  <input type="number" min="0" step="0.01" value={newFunding.interestRate}
                    onChange={e => setNewFunding(p => ({ ...p, interestRate: e.target.value }))} placeholder={t('interestRatePlaceholder')}
                    className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-[var(--tulip-forest)]/60 mb-1 block">{t('interestType')}</label>
                  <div className="flex rounded-lg overflow-hidden border border-[var(--tulip-sage-dark)]">
                    {(['FIXED', 'VARIABLE'] as const).map(t => (
                      <button key={t} onClick={() => setNewFunding(p => ({ ...p, interestType: t }))}
                        className="flex-1 px-3 py-2 text-xs font-medium transition-all"
                        style={{ background: newFunding.interestType === t ? 'var(--tulip-forest)' : 'var(--tulip-sage)', color: newFunding.interestType === t ? 'var(--tulip-cream)' : 'var(--tulip-forest)' }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[var(--tulip-forest)]/60 mb-1 block">{t('gracePeriod')}</label>
                  <input type="number" min="0" value={newFunding.gracePeriodMonths}
                    onChange={e => setNewFunding(p => ({ ...p, gracePeriodMonths: e.target.value }))} placeholder={t('gracePeriodPlaceholder')}
                    className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-[var(--tulip-forest)]/60 mb-1 block">{t('term')}</label>
                  <input type="number" min="1" value={newFunding.termMonths}
                    onChange={e => setNewFunding(p => ({ ...p, termMonths: e.target.value }))} placeholder={t('termPlaceholder')}
                    className={inputCls} />
                </div>
              </div>
            )}
            {newFunding.sourceType === 'Impact Investment' && Number(newFunding.termMonths) > 0 && (
              <div>
                <label className="text-xs text-[var(--tulip-forest)]/60 mb-1 block">{t('autoGenerateSchedule')}</label>
                <div className="flex rounded-lg overflow-hidden border border-[var(--tulip-sage-dark)] w-fit">
                  {([true, false] as const).map(v => (
                    <button key={String(v)} onClick={() => setNewFunding(p => ({ ...p, autoGenerateSchedule: v }))}
                      className="px-4 py-1.5 text-xs font-medium transition-all"
                      style={{ background: newFunding.autoGenerateSchedule === v ? 'var(--tulip-forest)' : 'var(--tulip-sage)', color: newFunding.autoGenerateSchedule === v ? 'var(--tulip-cream)' : 'var(--tulip-forest)' }}>
                      {v ? t('yes') : t('no')}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <button onClick={handleAddFunding} disabled={addingFunding || !newFunding.sourceType || !newFunding.amount || (donorMode === 'existing' ? !newFunding.donorOrgId : !newFunding.donorName)}
                className="px-4 py-1.5 rounded-lg text-xs font-medium text-[var(--tulip-forest)] disabled:opacity-40 transition-all bg-[var(--tulip-gold)] hover:bg-[var(--tulip-orange)]">
                {addingFunding ? t('adding') : t('addSource')}
              </button>
              <button onClick={() => setShowAddFunding(false)} className="px-4 py-1.5 text-xs text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)]/70">{t('cancel')}</button>
            </div>
          </div>
        )}

        {/* Funding gap summary */}
        {budget.totalApproved > 0 && (
          <div className={`mx-5 mb-4 mt-2 rounded-lg border px-4 py-2.5 flex items-center justify-between text-sm ${
            isFullyFunded ? 'border-green-400/20 bg-green-400/5' : 'border-yellow-400/20 bg-yellow-400/5'
          }`}>
            <div className="flex items-center gap-2">
              {isFullyFunded
                ? <><CheckCircle size={14} className="text-green-400" /><span className="text-green-400 font-medium">{t('fullyFunded')}</span></>
                : <><AlertTriangle size={14} className="text-yellow-400" /><span className="text-yellow-400 font-medium">{t('fundingGap', { gap: fundingGap.toLocaleString() })}</span></>
              }
            </div>
            <span className="text-xs text-[var(--tulip-forest)]/60">
              {t('fundingRequired', { required: budget.totalApproved.toLocaleString(), funded: budget.totalFunded.toLocaleString() })}
            </span>
          </div>
        )}
      </div>

      {/* 3. Expenses */}
      <div className="rounded-xl border border-[var(--tulip-sage-dark)] overflow-hidden" style={{ background: 'var(--tulip-sage)' }}>
        <div className="px-5 py-3 border-b border-[var(--tulip-sage-dark)] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--tulip-forest)]/70 uppercase tracking-wide flex items-center gap-2">
            <Receipt size={14} /> {t('expenses')}
          </h2>
          <span className="text-xs text-[var(--tulip-forest)]/40">{budget.expenses.length !== 1 ? t('expenseCountPlural', { count: budget.expenses.length }) : t('expenseCount', { count: budget.expenses.length })}</span>
        </div>
        {budget.expenses.length === 0 ? (
          <div className="px-5 py-6 text-center text-[var(--tulip-forest)]/40 text-sm">
            {t('noExpenses')}
          </div>
        ) : (
          <div className="divide-y divide-[var(--tulip-sage-dark)]">
            {budget.expenses.slice(0, 20).map(e => (
              <div key={e.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <div className="text-sm text-[var(--tulip-forest)]">{e.description}</div>
                  <div className="text-xs text-[var(--tulip-forest)]/40">
                    {e.project.name} · {e.category ?? t('uncategorised')}
                    {e.subCategory && ` / ${e.subCategory}`}
                    <span className="ml-2">{formatDate(e.createdAt)}</span>
                  </div>
                </div>
                <div className="text-sm font-medium text-[var(--tulip-forest)]">{e.currency} {e.amount.toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Grant Conditions — unified table */}
      {allTranches.length > 0 && (
        <div className="rounded-xl border border-[var(--tulip-sage-dark)] overflow-hidden" style={{ background: 'var(--tulip-sage)' }}>
          <button
            onClick={() => setTranchesExpanded(!tranchesExpanded)}
            className="w-full px-5 py-3 border-b border-[var(--tulip-sage-dark)] flex items-center justify-between hover:bg-[var(--tulip-sage-dark)]/20 transition-all"
          >
            <h2 className="text-sm font-semibold text-[var(--tulip-forest)]/70 uppercase tracking-wide flex items-center gap-2">
              <CheckCircle size={14} /> {t('grantConditions')}
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--tulip-forest)]/40">{allTranches.length !== 1 ? t('disbursementCountPlural', { count: allTranches.length }) : t('disbursementCount', { count: allTranches.length })}</span>
              {tranchesExpanded ? <ChevronUp size={14} className="text-[var(--tulip-forest)]/40" /> : <ChevronDown size={14} className="text-[var(--tulip-forest)]/40" />}
            </div>
          </button>

          {tranchesExpanded && (
            <>
              {/* Progress summary */}
              {allTranches.length > 0 && (() => {
                const totalAmount = allTranches.reduce((s, t) => s + (Number(t.amount) || 0), 0)
                const releasedAmount = allTranches.filter(t => t.status === 'RELEASED' || t.status === 'UTILISED').reduce((s, t) => s + (Number(t.amount) || 0), 0)
                const pendingAmount = totalAmount - releasedAmount
                const releasedPct = totalAmount > 0 ? Math.round((releasedAmount / totalAmount) * 100) : 0
                return (
                  <div className="px-5 py-3 border-b border-[var(--tulip-sage-dark)] bg-[var(--tulip-cream)]/50">
                    <div className="grid grid-cols-3 gap-4 text-xs text-center">
                      <div>
                        <span className="text-[var(--tulip-forest)]/40 block">{t('totalTranched')}</span>
                        <span className="font-semibold text-[var(--tulip-forest)]">{allTranches[0]?.currency || 'USD'} {totalAmount.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-green-600 block">{t('released')}</span>
                        <span className="font-semibold text-green-700">{allTranches[0]?.currency || 'USD'} {releasedAmount.toLocaleString()} ({releasedPct}%)</span>
                      </div>
                      <div>
                        <span className="text-amber-600 block">{t('pending')}</span>
                        <span className="font-semibold text-amber-700">{allTranches[0]?.currency || 'USD'} {pendingAmount.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Disbursements table */}
              {allTranches.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage-dark)]/30">
                        <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wide text-[var(--tulip-forest)]/40">{t('fundingAgreement')}</th>
                        <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wide text-[var(--tulip-forest)]/40">{t('conditions')}</th>
                        <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wide text-[var(--tulip-forest)]/40">{t('plannedDate')}</th>
                        <th className="text-center px-4 py-2 text-xs font-medium uppercase tracking-wide text-[var(--tulip-forest)]/40">{t('status')}</th>
                        <th className="text-right px-4 py-2 text-xs font-medium uppercase tracking-wide text-[var(--tulip-forest)]/40">{t('actualRelease')}</th>
                        <th className="text-center px-4 py-2 text-xs font-medium uppercase tracking-wide text-[var(--tulip-forest)]/40">{t('evidence')}</th>
                        <th className="text-center px-4 py-2 text-xs font-medium uppercase tracking-wide text-[var(--tulip-forest)]/40">{t('action')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--tulip-sage-dark)]">
                      {allTranches.map((tranche, i) => {
                        const statusColors: Record<string, string> = {
                          PENDING: 'bg-gray-100 text-gray-600 border-gray-200',
                          CONDITIONS_MET: 'bg-amber-100 text-amber-700 border-amber-200',
                          RELEASED: 'bg-green-100 text-green-700 border-green-200',
                          UTILISED: 'bg-blue-100 text-blue-700 border-blue-200',
                        }
                        const actualDate = tranche.actualReleaseDate || tranche.releaseDate
                        return (
                          <tr key={tranche.id}>
                            <td className="px-4 py-3 text-xs text-[var(--tulip-forest)]/70">{tranche.agreementTitle || '—'}</td>
                            <td className="px-4 py-3 text-xs text-[var(--tulip-forest)]">{tranche.releaseConditions || tranche.conditions || '—'}</td>
                            <td className="px-4 py-3 text-xs text-[var(--tulip-forest)]">{tranche.plannedReleaseDate ? formatDate(tranche.plannedReleaseDate) : tranche.plannedDate ? formatDate(tranche.plannedDate) : '—'}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium ${statusColors[tranche.status] || statusColors.PENDING}`}>
                                {tranche.status.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-xs text-[var(--tulip-forest)]">{actualDate ? formatDate(actualDate) : '—'}</td>
                            <td className="px-4 py-3 text-center">
                              {tranche.evidenceFileUrl ? (
                                <a href={tranche.evidenceFileUrl} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-purple-500/10 text-purple-700 hover:bg-purple-500/20 transition-all">
                                  <Upload size={10} /> {tranche.evidenceName || t('view')}
                                </a>
                              ) : '—'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex flex-col items-center gap-1">
                                {(tranche.status === 'PENDING' || (tranche.status === 'CONDITIONS_MET' && !tranche.conditionsConfirmedAt)) && (
                                  <button
                                    onClick={() => setShowConditionsModal({ trancheId: tranche.id, agreementId: tranche._agreementId })}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-[var(--tulip-gold)] text-[var(--tulip-forest)] hover:bg-[var(--tulip-orange)] transition-all"
                                  >
                                    <Check size={10} /> {t('confirmMet')}
                                  </button>
                                )}
                                {tranche.status !== 'PENDING' && !tranche.evidenceDocumentId && (
                                  <button
                                    onClick={() => setShowEvidenceModal({ trancheId: tranche.id, agreementId: tranche._agreementId })}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-purple-500/10 text-purple-700 hover:bg-purple-500/20 transition-all"
                                  >
                                    <Upload size={10} /> {t('attachEvidence')}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

            </>
          )}
        </div>
      )}

      {/* Confirm Conditions Met Modal */}
      {showConditionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setShowConditionsModal(null); setConditionsFile(null); setConditionsNotes('') }} />
          <div className="relative bg-[var(--tulip-cream)] rounded-2xl border border-[var(--tulip-sage-dark)] shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--tulip-sage-dark)]">
              <div>
                <h3 className="text-base font-bold text-[var(--tulip-forest)]">{t('confirmConditionsTitle')}</h3>
                <p className="text-xs text-[var(--tulip-forest)]/50 mt-0.5">{t('confirmConditionsSubtitle')}</p>
              </div>
              <button onClick={() => { setShowConditionsModal(null); setConditionsFile(null); setConditionsNotes('') }}
                className="text-[var(--tulip-forest)]/40 hover:text-[var(--tulip-forest)] transition-all">
                <X size={18} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="text-xs text-[var(--tulip-forest)]/60 mb-1 block">{t('notes')}</label>
                <textarea
                  value={conditionsNotes}
                  onChange={e => setConditionsNotes(e.target.value)}
                  rows={3}
                  placeholder={t('conditionsNotesPlaceholder')}
                  className="w-full bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-3 py-2 text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none focus:border-[var(--tulip-gold)] transition-all resize-none"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--tulip-forest)]/60 mb-1 block">{t('supportingDocument')}</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.xlsx,.xls,.jpg,.jpeg,.png,.csv"
                  onChange={e => setConditionsFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-[var(--tulip-forest)]/70 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-[var(--tulip-sage-dark)] file:bg-[var(--tulip-sage)] file:text-[var(--tulip-forest)] file:text-xs file:font-medium hover:file:bg-[var(--tulip-sage-dark)] file:cursor-pointer file:transition-all"
                />
                {conditionsFile && (
                  <p className="text-xs text-[var(--tulip-forest)]/50 mt-1">
                    {conditionsFile.name} ({(conditionsFile.size / 1024).toFixed(0)} KB) — {t('fileHashedNote')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => handleConfirmConditions(showConditionsModal.trancheId, showConditionsModal.agreementId)}
                  disabled={confirmingTranche === showConditionsModal.trancheId}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--tulip-gold)] text-[var(--tulip-forest)] hover:bg-[var(--tulip-orange)] disabled:opacity-50 transition-all"
                >
                  <Check size={14} />
                  {confirmingTranche === showConditionsModal.trancheId ? t('loading') : t('confirmAndNotify')}
                </button>
                <button onClick={() => { setShowConditionsModal(null); setConditionsFile(null); setConditionsNotes('') }}
                  className="px-4 py-2 rounded-lg text-sm text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)] hover:bg-[var(--tulip-sage-dark)]/40 transition-all">
                  {t('cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attach Evidence Modal */}
      {showEvidenceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setShowEvidenceModal(null); setEvidenceFile(null); setEvidenceNotes('') }} />
          <div className="relative bg-[var(--tulip-cream)] rounded-2xl border border-[var(--tulip-sage-dark)] shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--tulip-sage-dark)]">
              <div>
                <h3 className="text-base font-bold text-[var(--tulip-forest)]">{t('attachEvidenceTitle')}</h3>
                <p className="text-xs text-[var(--tulip-forest)]/50 mt-0.5">{t('attachEvidenceSubtitle')}</p>
              </div>
              <button onClick={() => { setShowEvidenceModal(null); setEvidenceFile(null); setEvidenceNotes('') }}
                className="text-[var(--tulip-forest)]/40 hover:text-[var(--tulip-forest)] transition-all">
                <X size={18} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="text-xs text-[var(--tulip-forest)]/60 mb-1 block">{t('evidenceNotesLabel')}</label>
                <textarea
                  value={evidenceNotes}
                  onChange={e => setEvidenceNotes(e.target.value)}
                  rows={2}
                  placeholder={t('evidenceNotesPlaceholder')}
                  className="w-full bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-3 py-2 text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none focus:border-[var(--tulip-gold)] transition-all resize-none"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--tulip-forest)]/60 mb-1 block">{t('evidenceFileLabel')}</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.xlsx,.xls,.jpg,.jpeg,.png,.csv"
                  onChange={e => setEvidenceFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-[var(--tulip-forest)]/70 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-[var(--tulip-sage-dark)] file:bg-[var(--tulip-sage)] file:text-[var(--tulip-forest)] file:text-xs file:font-medium hover:file:bg-[var(--tulip-sage-dark)] file:cursor-pointer file:transition-all"
                />
                {evidenceFile && (
                  <p className="text-xs text-[var(--tulip-forest)]/50 mt-1">
                    {evidenceFile.name} ({(evidenceFile.size / 1024).toFixed(0)} KB) — {t('fileHashedNote')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => handleAttachEvidence(showEvidenceModal.trancheId, showEvidenceModal.agreementId)}
                  disabled={uploadingEvidence || !evidenceFile}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 transition-all"
                >
                  <Upload size={14} />
                  {uploadingEvidence ? t('uploading') : t('uploadAndNotify')}
                </button>
                <button onClick={() => { setShowEvidenceModal(null); setEvidenceFile(null); setEvidenceNotes('') }}
                  className="px-4 py-2 rounded-lg text-sm text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)] hover:bg-[var(--tulip-sage-dark)]/40 transition-all">
                  {t('cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Breach Report Modal */}
      {breachModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setBreachModal(null); setBreachNote(''); setBreachSuccess(false) }} />
          <div className="relative bg-[var(--tulip-cream)] rounded-2xl border border-[var(--tulip-sage-dark)] shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--tulip-sage-dark)]">
              <div>
                <h3 className="text-base font-bold text-[var(--tulip-forest)]">{t('reportBreach')}</h3>
                <p className="text-xs text-[var(--tulip-forest)]/50 mt-0.5">{breachModal.title}</p>
              </div>
              <button onClick={() => { setBreachModal(null); setBreachNote(''); setBreachSuccess(false) }}
                className="text-[var(--tulip-forest)]/40 hover:text-[var(--tulip-forest)] transition-all">
                <X size={18} />
              </button>
            </div>
            <div className="px-5 py-4">
              {breachSuccess ? (
                <div className="text-center py-4">
                  <CheckCircle size={32} className="mx-auto text-green-500 mb-2" />
                  <p className="text-sm text-[var(--tulip-forest)] font-medium">{t('breachNotified')}</p>
                </div>
              ) : (
                <>
                  <label className="text-xs text-[var(--tulip-forest)]/60 mb-1 block">{t('breachDescriptionLabel')}</label>
                  <textarea
                    value={breachNote}
                    onChange={e => setBreachNote(e.target.value)}
                    rows={4}
                    placeholder={t('breachPlaceholder')}
                    className="w-full bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-3 py-2 text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none focus:border-[var(--tulip-gold)] transition-all resize-none"
                  />
                  <div className="flex items-center gap-3 mt-4">
                    <button
                      onClick={handleBreachSubmit}
                      disabled={breachSubmitting || !breachNote.trim()}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-all"
                    >
                      <AlertTriangle size={14} />
                      {breachSubmitting ? t('loading') : t('reportBreach')}
                    </button>
                    <button onClick={() => { setBreachModal(null); setBreachNote(''); setBreachSuccess(false) }}
                      className="px-4 py-2 rounded-lg text-sm text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)] hover:bg-[var(--tulip-sage-dark)]/40 transition-all">
                      {t('cancel')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
