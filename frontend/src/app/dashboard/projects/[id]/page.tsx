'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api'
import DocumentUploadSection from '@/components/DocumentUploadSection'
import BlockchainStatusPill from '@/components/BlockchainStatusPill'
import TrustSealCard from '@/components/TrustSealCard'
import RiskRegisterTab from '@/components/RiskRegisterTab'
import WorldBankTab from '@/components/WorldBankTab'
import { formatMoney } from '@/lib/currencies'
import {
  ArrowLeft, FolderOpen, DollarSign, FileText, Activity,
  CheckCircle, Clock, XCircle, ExternalLink,
  Calendar, Plus, Wallet, Target, Edit3, Trash2, X
} from 'lucide-react'

interface BudgetSummary {
  budgetCapex: number; budgetOpex: number; budgetTotal: number
  actualCapex: number; actualOpex: number; actualTotal: number
}

interface BudgetInfo {
  id: string; name: string; status: string; periodFrom: string; periodTo: string
  lines: { id: string; expenseType: string; category: string; approvedAmount: number }[]
  fundingSources?: { id: string; amount: number }[]
}

interface Project {
  id: string; name: string; description: string | null; budget: number | null
  status: string; startDate?: string | null; endDate?: string | null; createdAt: string
  fundingSources: any[]; expenses: Expense[]; documents: Document[]
  budgetSummary: BudgetSummary | null; budgets: BudgetInfo[]
  logframeGoal?: string | null; logframePurpose?: string | null; logframeAssumptions?: string | null
  baseCurrency?: string; donorReportingCurrency?: string | null
}

interface Expense {
  id: string; description: string; amount: number; currency: string
  anchorStatus?: string; dataHash?: string; createdAt: string
}

interface Document { id: string; name: string; fileHash?: string; anchorStatus?: string; createdAt: string }

interface AuditEntry {
  id: string; action: string; entityType: string; entityId: string; dataHash: string
  anchorStatus: string; blockchainTx: string | null; ancheredAt: string | null; createdAt: string
}

const statusColors: Record<string, string> = {
  active: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  completed: 'bg-[var(--tulip-gold)]/15 text-[var(--tulip-forest)] border border-[var(--tulip-gold)]/30',
  paused: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  draft: 'bg-[var(--tulip-sage)] text-[var(--tulip-forest)]/60 border border-[var(--tulip-sage-dark)]',
}

const budgetStatusColors: Record<string, string> = {
  DRAFT: 'bg-[var(--tulip-sage)] text-[var(--tulip-forest)]/60', APPROVED: 'bg-[var(--tulip-gold)]/15 text-[var(--tulip-forest)]',
  ACTIVE: 'bg-emerald-500/20 text-emerald-400', CLOSED: 'bg-[var(--tulip-sage)] text-[var(--tulip-forest)]/40',
}

const anchorBadge = (status: string) => {
  switch (status) {
    case 'confirmed': return <span className="flex items-center gap-1 text-emerald-400 text-xs"><CheckCircle size={12} /> Confirmed</span>
    case 'pending': return <span className="flex items-center gap-1 text-yellow-400 text-xs"><Clock size={12} /> Pending</span>
    case 'failed': return <span className="flex items-center gap-1 text-red-400 text-xs"><XCircle size={12} /> Failed</span>
    default: return <span className="flex items-center gap-1 text-[var(--tulip-forest)]/40 text-xs"><Clock size={12} /> —</span>
  }
}

type TabKey = 'expenses' | 'documents' | 'budgets' | 'logframe' | 'risks' | 'worldbank' | 'audit'

type RAGStatus = 'NOT_STARTED' | 'GREEN' | 'AMBER' | 'RED'

interface LogframeIndicator {
  id: string
  indicator: string
  baselineValue: string | null
  targetValue: string | null
  actualValue: string | null
  unit: string | null
  measurementMethod: string | null
  reportingPeriod: string | null
  ragStatus: RAGStatus | null
  notes: string | null
}

interface LogframeOutput {
  id: string
  outputNumber: number
  title: string
  description: string | null
  indicators: LogframeIndicator[]
}

const RAG_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  NOT_STARTED: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Not started' },
  GREY: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Not started' },
  GREEN: { bg: 'bg-[#F0FDF4]', text: 'text-[#166534]', label: 'On track' },
  AMBER: { bg: 'bg-[#FFFBEB]', text: 'text-[#92400E]', label: 'At risk' },
  RED: { bg: 'bg-[#FEF2F2]', text: 'text-[#991B1B]', label: 'Off track' },
}

export default function ProjectDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const [project, setProject] = useState<Project | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>('expenses')
  const [error, setError] = useState('')
  const [sealMap, setSealMap] = useState<Record<string, { sealId: string; anchorStatus: string; txHash: string | null }>>({})
  const [activeSealId, setActiveSealId] = useState<string | null>(null)

  // Logframe state
  const [logframeOutputs, setLogframeOutputs] = useState<LogframeOutput[]>([])
  const [showAddOutput, setShowAddOutput] = useState(false)
  const [newOutput, setNewOutput] = useState({ title: '', description: '' })
  const [savingOutput, setSavingOutput] = useState(false)
  const [editingOutput, setEditingOutput] = useState<LogframeOutput | null>(null)
  const [showAddIndicator, setShowAddIndicator] = useState<string | null>(null)
  const [newIndicator, setNewIndicator] = useState({ indicator: '', baselineValue: '', targetValue: '', unit: '', measurementMethod: '', reportingPeriod: '' })
  const [savingIndicator, setSavingIndicator] = useState(false)
  const [updateIndicator, setUpdateIndicator] = useState<LogframeIndicator | null>(null)
  const [updateActual, setUpdateActual] = useState('')
  const [updateRAG, setUpdateRAG] = useState<RAGStatus>('NOT_STARTED')
  const [updateNotes, setUpdateNotes] = useState('')
  const [savingUpdate, setSavingUpdate] = useState(false)
  const [logframeGoal, setLogframeGoal] = useState('')
  const [logframePurpose, setLogframePurpose] = useState('')
  const [logframeAssumptions, setLogframeAssumptions] = useState('')
  const [savingGoalPurpose, setSavingGoalPurpose] = useState(false)
  const [goalPurposeSaved, setGoalPurposeSaved] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([
      apiGet(`/api/projects/${id}`).then(r => r.ok ? r.json() : null),
      apiGet(`/api/expenses?projectId=${id}&limit=50`).then(r => r.ok ? r.json() : { data: [] }),
      apiGet(`/api/audit?limit=50`).then(r => r.ok ? r.json() : { data: [] }),
    ]).then(([proj, exp, aud]) => {
      if (!proj) { setError('Project not found'); setLoading(false); return }
      setProject(proj)
      setLogframeGoal(proj.logframeGoal || '')
      setLogframePurpose(proj.logframePurpose || '')
      setLogframeAssumptions(proj.logframeAssumptions || '')
      setExpenses(exp.data ?? exp.items ?? [])
      const allAudit = aud.data ?? aud.items ?? []
      setAudit(allAudit.filter((a: AuditEntry) => a.entityId === id || a.entityType === 'Project'))
      setLoading(false)
      // Resolve document hashes to seals
      const docHashes = (proj.documents || []).map((d: any) => d.sha256Hash).filter(Boolean)
      if (docHashes.length > 0) {
        apiPost('/api/trust-seal/resolve', { hashes: docHashes })
          .then(r => r.ok ? r.json() : {})
          .then(map => setSealMap(map))
          .catch(() => {})
      }
    }).catch(() => { setError('Failed to load project'); setLoading(false) })
  }, [id])

  // Load logframe data when tab switches to logframe
  useEffect(() => {
    if (tab !== 'logframe' || !id) return
    apiGet(`/api/ngo/projects/${id}/logframe`)
      .then(r => r.ok ? r.json() : { outputs: [] })
      .then(d => setLogframeOutputs(d.outputs ?? d.data ?? []))
      .catch(() => setLogframeOutputs([]))
  }, [tab, id])

  const reloadLogframe = () => {
    apiGet(`/api/ngo/projects/${id}/logframe`)
      .then(r => r.ok ? r.json() : { outputs: [] })
      .then(d => setLogframeOutputs(d.outputs ?? d.data ?? []))
      .catch(() => {})
  }

  const handleSaveGoalPurpose = async () => {
    setSavingGoalPurpose(true)
    setGoalPurposeSaved(false)
    const res = await apiPut(`/api/projects/${id}`, { logframeGoal, logframePurpose, logframeAssumptions })
    if (res.ok) {
      const updated = await res.json()
      setProject(p => p ? { ...p, logframeGoal: updated.logframeGoal, logframePurpose: updated.logframePurpose, logframeAssumptions: updated.logframeAssumptions } : p)
      setGoalPurposeSaved(true)
      setTimeout(() => setGoalPurposeSaved(false), 2000)
    }
    setSavingGoalPurpose(false)
  }

  const handleAddOutput = async () => {
    if (!newOutput.title.trim()) return
    setSavingOutput(true)
    const res = await apiPost(`/api/ngo/projects/${id}/logframe/outputs`, {
      outputNumber: logframeOutputs.length + 1,
      title: newOutput.title.trim(),
      description: newOutput.description.trim() || null,
    })
    if (res.ok) {
      setNewOutput({ title: '', description: '' })
      setShowAddOutput(false)
      reloadLogframe()
    }
    setSavingOutput(false)
  }

  const handleEditOutput = async () => {
    if (!editingOutput) return
    setSavingOutput(true)
    const res = await apiPut(`/api/ngo/logframe/outputs/${editingOutput.id}`, {
      title: editingOutput.title,
      description: editingOutput.description,
    })
    if (res.ok) {
      setEditingOutput(null)
      reloadLogframe()
    }
    setSavingOutput(false)
  }

  const handleDeleteOutput = async (outputId: string) => {
    if (!confirm('Delete this output and all its indicators?')) return
    await apiDelete(`/api/ngo/logframe/outputs/${outputId}`)
    reloadLogframe()
  }

  const handleAddIndicator = async (outputId: string) => {
    if (!newIndicator.indicator.trim() || !newIndicator.targetValue.trim()) return
    setSavingIndicator(true)
    const res = await apiPost(`/api/ngo/logframe/outputs/${outputId}/indicators`, {
      indicator: newIndicator.indicator.trim(),
      baselineValue: newIndicator.baselineValue || null,
      targetValue: newIndicator.targetValue,
      unit: newIndicator.unit || null,
      measurementMethod: newIndicator.measurementMethod || null,
      reportingPeriod: newIndicator.reportingPeriod || null,
    })
    if (res.ok) {
      setNewIndicator({ indicator: '', baselineValue: '', targetValue: '', unit: '', measurementMethod: '', reportingPeriod: '' })
      setShowAddIndicator(null)
      reloadLogframe()
    } else {
      const d = await res.json().catch(() => ({ error: 'Failed to add indicator' }))
      alert(d.error || 'Failed to add indicator')
    }
    setSavingIndicator(false)
  }

  const handleUpdateIndicator = async () => {
    if (!updateIndicator) return
    setSavingUpdate(true)
    const res = await apiPut(`/api/ngo/logframe/indicators/${updateIndicator.id}`, {
      actualValue: updateActual || null,
      ragStatus: updateRAG,
      notes: updateNotes || null,
    })
    if (res.ok) {
      setUpdateIndicator(null)
      setUpdateActual('')
      setUpdateRAG('NOT_STARTED')
      setUpdateNotes('')
      reloadLogframe()
    }
    setSavingUpdate(false)
  }

  const handleDeleteIndicator = async (indicatorId: string) => {
    if (!confirm('Delete this indicator?')) return
    await apiDelete(`/api/ngo/logframe/indicators/${indicatorId}`)
    reloadLogframe()
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--tulip-cream)]">
      <div className="w-8 h-8 border-2 border-[var(--tulip-gold)] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (error || !project) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--tulip-cream)] text-[var(--tulip-forest)]/70 gap-4">
      <FolderOpen size={48} className="text-[var(--tulip-forest)]/30" />
      <p>{error || 'Project not found'}</p>
      <Link href="/dashboard/projects" className="text-[var(--tulip-forest)] hover:text-[var(--tulip-gold)] text-sm">Back to Projects</Link>
    </div>
  )

  // Aggregate from budgets
  const hasBudgets = project.budgets && project.budgets.length > 0
  const totalBudget = hasBudgets ? project.budgets.reduce((s, b) => s + b.lines.reduce((ls, l) => ls + l.approvedAmount, 0), 0) : 0
  const totalFunded = hasBudgets ? project.budgets.reduce((s, b) => s + (b.fundingSources || []).reduce((fs, f) => fs + f.amount, 0), 0) : 0
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0)
  const remaining = totalBudget - totalSpent
  const currency = project.baseCurrency || 'USD'

  return (
    <div className="min-h-screen bg-[var(--tulip-cream)] text-[var(--tulip-forest)] p-6 max-w-6xl mx-auto">
      <Link href="/dashboard/projects" className="inline-flex items-center gap-2 text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)] text-sm mb-6 transition-colors">
        <ArrowLeft size={14} /> Back to Projects
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-[var(--tulip-gold)]/10 border border-[var(--tulip-gold)]/30 flex items-center justify-center">
            <FolderOpen size={22} className="text-[var(--tulip-forest)]" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-[var(--tulip-forest)]">{project.name}</h1>
            {project.description && <p className="text-[var(--tulip-forest)]/60 text-sm mt-1">{project.description}</p>}
            <div className="flex items-center gap-3 mt-2">
              <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${statusColors[project.status] ?? statusColors.draft}`}>
                {project.status}
              </span>
              <span className="text-[var(--tulip-forest)]/40 text-xs flex items-center gap-1">
                <Calendar size={11} /> Created {new Date(project.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        <Link href={`/dashboard/budgets/new?projectId=${id}`}
          className="flex items-center gap-2 text-sm font-medium text-[var(--tulip-forest)] px-4 py-2 rounded-lg transition-all shrink-0 bg-[var(--tulip-gold)] hover:bg-[var(--tulip-orange)]">
          <Plus size={14} /> Create Budget
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-xl p-4">
          <p className="text-[var(--tulip-forest)]/60 text-xs mb-1">Total Budget</p>
          <p className="text-[var(--tulip-forest)] font-semibold text-lg">{formatMoney(totalBudget, currency)}</p>
        </div>
        <div className="bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-xl p-4">
          <p className="text-[var(--tulip-forest)]/60 text-xs mb-1">Total Funded</p>
          <p className={`font-semibold text-lg ${totalFunded >= totalBudget && totalBudget > 0 ? 'text-green-400' : 'text-yellow-400'}`}>
            {formatMoney(totalFunded, currency)}
          </p>
        </div>
        <div className="bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-xl p-4">
          <p className="text-[var(--tulip-forest)]/60 text-xs mb-1">Total Spent</p>
          <p className="text-orange-400 font-semibold text-lg">{formatMoney(totalSpent, currency)}</p>
        </div>
        <div className="bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-xl p-4">
          <p className="text-[var(--tulip-forest)]/60 text-xs mb-1">Remaining</p>
          <p className={`font-semibold text-lg ${remaining >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatMoney(remaining, currency)}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[var(--tulip-sage)] p-1 rounded-lg w-fit">
        {([
          { key: 'expenses' as TabKey, label: 'Expenses', count: expenses.length },
          { key: 'documents' as TabKey, label: 'Documents', count: project.documents?.length ?? 0 },
          { key: 'budgets' as TabKey, label: 'Budgets', count: project.budgets?.length ?? 0 },
          { key: 'logframe' as TabKey, label: 'Logframe', count: logframeOutputs.length },
          { key: 'risks' as TabKey, label: 'Risk Register' },
          { key: 'worldbank' as TabKey, label: 'World Bank' },
          { key: 'audit' as TabKey, label: 'Audit', count: audit.length },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-md text-sm transition-all ${tab === t.key ? 'bg-[var(--tulip-sage)] text-[var(--tulip-forest)]' : 'text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)]'}`}>
            {t.label}{t.count != null ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      {/* Tab: Expenses */}
      {tab === 'expenses' && (
        <div className="bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-xl overflow-hidden">
          {expenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[var(--tulip-forest)]/40 gap-3">
              <DollarSign size={36} className="text-[var(--tulip-forest)]/30" />
              <p className="text-sm">No expenses logged for this project</p>
              <Link href="/dashboard/expenses/new" className="text-[var(--tulip-forest)] hover:text-[var(--tulip-gold)] text-xs">+ Log first expense</Link>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--tulip-sage-dark)]">
                  <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">DESCRIPTION</th>
                  <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">AMOUNT</th>
                  <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">HASH</th>
                  <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">STATUS</th>
                  <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">DATE</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp, i) => (
                  <tr key={exp.id} className={`border-b border-[var(--tulip-sage-dark)] hover:bg-[var(--tulip-sage)]/50 transition-colors ${i % 2 === 0 ? '' : 'bg-[var(--tulip-sage)]'}`}>
                    <td className="px-4 py-3 text-sm text-[var(--tulip-forest)]">{exp.description}</td>
                    <td className="px-4 py-3 text-sm text-[var(--tulip-forest)] font-medium">{exp.currency} {exp.amount.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      {exp.dataHash ? <span className="text-xs font-mono text-[var(--tulip-forest)]/40">{exp.dataHash.slice(0, 12)}...</span> : <span className="text-xs text-[var(--tulip-forest)]/30">-</span>}
                    </td>
                    <td className="px-4 py-3">{anchorBadge(exp.anchorStatus ?? '')}</td>
                    <td className="px-4 py-3 text-xs text-[var(--tulip-forest)]/40">{new Date(exp.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab: Documents */}
      {tab === 'documents' && (
        <div className="space-y-4">
          <DocumentUploadSection entityType="project" entityId={id} onUploaded={() => {
            apiGet(`/api/projects/${id}`).then(r => r.ok ? r.json() : null).then(p => { if (p) setProject(p) })
          }} />
          <div className="bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-xl overflow-hidden">
            {(!project.documents || project.documents.length === 0) ? (
              <div className="flex flex-col items-center justify-center py-12 text-[var(--tulip-forest)]/40 gap-2">
                <FileText size={32} className="text-[var(--tulip-forest)]/30" />
                <p className="text-sm">No documents yet - upload one above</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--tulip-sage-dark)]">
                    <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">NAME</th>
                    <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">TYPE</th>
                    <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">HASH</th>
                    <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">SEAL</th>
                    <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">DATE</th>
                  </tr>
                </thead>
                <tbody>
                  {project.documents.map((doc: any) => {
                    const seal = doc.sha256Hash ? sealMap[doc.sha256Hash] : null
                    return (
                    <tr key={doc.id} className="border-b border-[var(--tulip-sage-dark)] hover:bg-[var(--tulip-sage)]/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-[var(--tulip-forest)]">{doc.name}</td>
                      <td className="px-4 py-3 text-xs text-[var(--tulip-forest)]/60 uppercase">{doc.fileType ?? '-'}</td>
                      <td className="px-4 py-3">
                        {doc.sha256Hash ? <span className="text-xs font-mono text-[var(--tulip-forest)]/40">{doc.sha256Hash.slice(0, 12)}...</span> : <span className="text-xs text-[var(--tulip-forest)]/30">-</span>}
                      </td>
                      <td className="px-4 py-3">
                        {seal ? (
                          <BlockchainStatusPill sealId={seal.sealId} anchorStatus={seal.anchorStatus} txHash={seal.txHash} onClick={() => setActiveSealId(seal.sealId)} />
                        ) : (
                          <BlockchainStatusPill onClick={() => {}} />
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--tulip-forest)]/40">{new Date(doc.uploadedAt ?? doc.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab: Budgets */}
      {tab === 'budgets' && (
        <div className="bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-xl overflow-hidden">
          {!hasBudgets ? (
            <div className="flex flex-col items-center justify-center py-16 text-[var(--tulip-forest)]/40 gap-3">
              <Wallet size={36} className="text-[var(--tulip-forest)]/30" />
              <p className="text-sm">No budgets linked to this project</p>
              <Link href={`/dashboard/budgets/new?projectId=${id}`} className="text-[var(--tulip-forest)] hover:text-[var(--tulip-gold)] text-xs">+ Create budget</Link>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--tulip-sage-dark)]">
                  <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">NAME</th>
                  <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">STATUS</th>
                  <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">PERIOD</th>
                  <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">LINES</th>
                  <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">TOTAL APPROVED</th>
                  <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {project.budgets.map(b => {
                  const total = b.lines.reduce((s, l) => s + l.approvedAmount, 0)
                  return (
                    <tr key={b.id} className="border-b border-[var(--tulip-sage-dark)] hover:bg-[var(--tulip-sage)]/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-[var(--tulip-forest)]">{b.name}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${budgetStatusColors[b.status] ?? 'bg-[var(--tulip-sage)] text-[var(--tulip-forest)]/60'}`}>{b.status}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--tulip-forest)]/60">{new Date(b.periodFrom).toLocaleDateString()} - {new Date(b.periodTo).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-sm text-[var(--tulip-forest)]/60">{b.lines.length}</td>
                      <td className="px-4 py-3 text-sm text-[var(--tulip-forest)] font-medium">{formatMoney(total, currency)}</td>
                      <td className="px-4 py-3"><Link href={`/dashboard/budgets/${b.id}`} className="text-[var(--tulip-forest)] hover:text-[var(--tulip-gold)] text-xs">View</Link></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab: Logframe */}
      {tab === 'logframe' && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--tulip-forest)] flex items-center gap-2">
                <Target size={18} /> Logical Framework
              </h2>
              <p className="text-[var(--tulip-forest)]/60 text-sm mt-0.5">Track outputs, indicators and progress</p>
            </div>
            <button onClick={() => setShowAddOutput(true)}
              className="flex items-center gap-2 text-sm font-medium text-[var(--tulip-forest)] px-4 py-2 rounded-lg bg-[var(--tulip-gold)] hover:bg-[var(--tulip-orange)] transition-all">
              <Plus size={14} /> Add Output
            </button>
          </div>

          {/* Goal & Purpose */}
          <div className="bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-xl p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-[var(--tulip-forest)]/60 uppercase tracking-wide block mb-1.5">Goal</label>
                <textarea
                  className="w-full bg-[var(--tulip-cream)] border border-[var(--tulip-sage-dark)] rounded-lg px-4 py-2.5 text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none focus:border-[var(--tulip-gold)] resize-none"
                  rows={3}
                  value={logframeGoal}
                  onChange={e => setLogframeGoal(e.target.value)}
                  placeholder="The high-level development impact the project contributes to..."
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--tulip-forest)]/60 uppercase tracking-wide block mb-1.5">Purpose</label>
                <textarea
                  className="w-full bg-[var(--tulip-cream)] border border-[var(--tulip-sage-dark)] rounded-lg px-4 py-2.5 text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none focus:border-[var(--tulip-gold)] resize-none"
                  rows={3}
                  value={logframePurpose}
                  onChange={e => setLogframePurpose(e.target.value)}
                  placeholder="The specific outcome the project aims to achieve..."
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--tulip-forest)]/60 uppercase tracking-wide block mb-1.5">Assumptions</label>
              <textarea
                className="w-full bg-[var(--tulip-cream)] border border-[var(--tulip-sage-dark)] rounded-lg px-4 py-2.5 text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none focus:border-[var(--tulip-gold)] resize-none"
                rows={3}
                value={logframeAssumptions}
                onChange={e => setLogframeAssumptions(e.target.value)}
                placeholder="Key assumptions and external factors that must hold true for the project to succeed..."
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveGoalPurpose}
                disabled={savingGoalPurpose}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--tulip-forest)] text-[var(--tulip-cream)] hover:bg-[var(--tulip-forest)]/90 transition-all disabled:opacity-50"
              >
                {savingGoalPurpose ? 'Saving...' : 'Save'}
              </button>
              {goalPurposeSaved && (
                <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle size={13} /> Saved</span>
              )}
            </div>
          </div>

          {/* Empty state */}
          {logframeOutputs.length === 0 && (
            <div className="bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-xl flex flex-col items-center justify-center py-16 gap-3">
              <Target size={36} className="text-[var(--tulip-forest)]/30" />
              <p className="text-[var(--tulip-forest)]/40 text-sm">No outputs defined yet</p>
              <button onClick={() => setShowAddOutput(true)} className="text-[var(--tulip-forest)] hover:text-[var(--tulip-gold)] text-xs">+ Add your first output</button>
            </div>
          )}

          {/* Outputs */}
          {logframeOutputs.map(output => (
            <div key={output.id} className="bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-xl overflow-hidden">
              {/* Output header */}
              <div className="px-5 py-3 border-b border-[var(--tulip-sage-dark)] bg-[var(--tulip-forest)]/5 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--tulip-forest)]">
                    Output {output.outputNumber}: {output.title}
                  </h3>
                  {output.description && <p className="text-xs text-[var(--tulip-forest)]/50 mt-0.5">{output.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditingOutput(output)} className="text-[var(--tulip-forest)]/40 hover:text-[var(--tulip-forest)] transition-colors" title="Edit">
                    <Edit3 size={13} />
                  </button>
                  <button onClick={() => handleDeleteOutput(output.id)} className="text-[var(--tulip-forest)]/40 hover:text-red-500 transition-colors" title="Delete">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Indicators table */}
              {output.indicators.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--tulip-sage-dark)]">
                        {['Indicator', 'Baseline', 'Target', 'Actual', 'Unit', 'Method', 'Period', 'RAG', 'Notes', 'Action'].map(h => (
                          <th key={h} className="text-left text-[10px] text-[var(--tulip-forest)]/40 font-normal px-3 py-2 uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {output.indicators.map(ind => {
                        const rag = RAG_STYLES[ind.ragStatus || 'NOT_STARTED'] || RAG_STYLES.NOT_STARTED
                        return (
                          <tr key={ind.id} className="border-b border-[var(--tulip-sage-dark)] last:border-0 hover:bg-[var(--tulip-cream)]/30">
                            <td className="px-3 py-2.5 text-[var(--tulip-forest)] max-w-[200px]">{ind.indicator}</td>
                            <td className="px-3 py-2.5 text-[var(--tulip-forest)]/60">{ind.baselineValue ?? '—'}</td>
                            <td className="px-3 py-2.5 text-[var(--tulip-forest)]/60">{ind.targetValue ?? '—'}</td>
                            <td className="px-3 py-2.5 text-[var(--tulip-forest)] font-medium">{ind.actualValue ?? '—'}</td>
                            <td className="px-3 py-2.5 text-[var(--tulip-forest)]/50 text-xs">{ind.unit ?? '—'}</td>
                            <td className="px-3 py-2.5 text-[var(--tulip-forest)]/50 text-xs">{ind.measurementMethod ?? '—'}</td>
                            <td className="px-3 py-2.5 text-[var(--tulip-forest)]/50 text-xs whitespace-nowrap">{ind.reportingPeriod ?? '—'}</td>
                            <td className="px-3 py-2.5">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${rag.bg} ${rag.text}`}>
                                {rag.label}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-[var(--tulip-forest)]/50 text-xs max-w-[120px] truncate">{ind.notes ?? '—'}</td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-1.5">
                                <button onClick={() => { setUpdateIndicator(ind); setUpdateActual(ind.actualValue || ''); setUpdateRAG((ind.ragStatus || 'NOT_STARTED') as RAGStatus); setUpdateNotes(ind.notes || '') }}
                                  className="text-[var(--tulip-forest)]/40 hover:text-[var(--tulip-forest)] text-xs font-medium">Update</button>
                                <button onClick={() => handleDeleteIndicator(ind.id)}
                                  className="text-[var(--tulip-forest)]/30 hover:text-red-500 transition-colors"><Trash2 size={11} /></button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {output.indicators.length === 0 && (
                <div className="px-5 py-4 text-center text-[var(--tulip-forest)]/40 text-xs">No indicators yet</div>
              )}

              {/* Add indicator button */}
              <div className="px-5 py-2.5 border-t border-[var(--tulip-sage-dark)]">
                <button onClick={() => setShowAddIndicator(output.id)}
                  className="text-xs text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)] flex items-center gap-1 transition-colors">
                  <Plus size={12} /> Add Indicator
                </button>
              </div>
            </div>
          ))}

          {/* Add Output Modal */}
          {showAddOutput && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowAddOutput(false)}>
              <div className="bg-[var(--tulip-cream)] rounded-xl border border-[var(--tulip-sage-dark)] p-6 max-w-md w-full space-y-4 shadow-xl" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-[var(--tulip-forest)]">Add Output</h3>
                <div>
                  <label className="text-xs text-[var(--tulip-forest)]/40 block mb-1">Output Number</label>
                  <input className="w-full bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-4 py-2.5 text-sm text-[var(--tulip-forest)] outline-none" value={logframeOutputs.length + 1} disabled />
                </div>
                <div>
                  <label className="text-xs text-[var(--tulip-forest)]/40 block mb-1">Title *</label>
                  <input className="w-full bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-4 py-2.5 text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none focus:border-[var(--tulip-gold)]"
                    value={newOutput.title} onChange={e => setNewOutput(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Improved water access in target communities" />
                </div>
                <div>
                  <label className="text-xs text-[var(--tulip-forest)]/40 block mb-1">Description</label>
                  <textarea className="w-full bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-4 py-2.5 text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none focus:border-[var(--tulip-gold)] resize-none"
                    rows={3} value={newOutput.description} onChange={e => setNewOutput(p => ({ ...p, description: e.target.value }))} placeholder="Optional description..." />
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button onClick={handleAddOutput} disabled={savingOutput || !newOutput.title.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--tulip-gold)] text-[var(--tulip-forest)] hover:bg-[var(--tulip-orange)] disabled:opacity-50">
                    {savingOutput ? 'Saving...' : 'Add Output'}
                  </button>
                  <button onClick={() => setShowAddOutput(false)} className="px-4 py-2 rounded-lg text-sm text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)]">Cancel</button>
                </div>
              </div>
            </div>
          )}

          {/* Edit Output Modal */}
          {editingOutput && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setEditingOutput(null)}>
              <div className="bg-[var(--tulip-cream)] rounded-xl border border-[var(--tulip-sage-dark)] p-6 max-w-md w-full space-y-4 shadow-xl" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-[var(--tulip-forest)]">Edit Output</h3>
                <div>
                  <label className="text-xs text-[var(--tulip-forest)]/40 block mb-1">Title *</label>
                  <input className="w-full bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-4 py-2.5 text-sm text-[var(--tulip-forest)] outline-none focus:border-[var(--tulip-gold)]"
                    value={editingOutput.title} onChange={e => setEditingOutput(p => p ? { ...p, title: e.target.value } : p)} />
                </div>
                <div>
                  <label className="text-xs text-[var(--tulip-forest)]/40 block mb-1">Description</label>
                  <textarea className="w-full bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-4 py-2.5 text-sm text-[var(--tulip-forest)] outline-none focus:border-[var(--tulip-gold)] resize-none"
                    rows={3} value={editingOutput.description || ''} onChange={e => setEditingOutput(p => p ? { ...p, description: e.target.value } : p)} />
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button onClick={handleEditOutput} disabled={savingOutput || !editingOutput.title.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--tulip-gold)] text-[var(--tulip-forest)] hover:bg-[var(--tulip-orange)] disabled:opacity-50">
                    {savingOutput ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button onClick={() => setEditingOutput(null)} className="px-4 py-2 rounded-lg text-sm text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)]">Cancel</button>
                </div>
              </div>
            </div>
          )}

          {/* Add Indicator Modal */}
          {showAddIndicator && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowAddIndicator(null)}>
              <div className="bg-[var(--tulip-cream)] rounded-xl border border-[var(--tulip-sage-dark)] p-6 max-w-lg w-full space-y-4 shadow-xl" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-[var(--tulip-forest)]">Add Indicator</h3>
                <div>
                  <label className="text-xs text-[var(--tulip-forest)]/40 block mb-1">Indicator *</label>
                  <textarea className="w-full bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-4 py-2.5 text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none focus:border-[var(--tulip-gold)] resize-none"
                    rows={2} value={newIndicator.indicator} onChange={e => setNewIndicator(p => ({ ...p, indicator: e.target.value }))}
                    placeholder="e.g. Number of households with access to clean water" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[var(--tulip-forest)]/40 block mb-1">Baseline Value</label>
                    <input className="w-full bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-4 py-2.5 text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none focus:border-[var(--tulip-gold)]"
                      value={newIndicator.baselineValue} onChange={e => setNewIndicator(p => ({ ...p, baselineValue: e.target.value }))} placeholder="e.g. 0" />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--tulip-forest)]/40 block mb-1">Target Value *</label>
                    <input className="w-full bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-4 py-2.5 text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none focus:border-[var(--tulip-gold)]"
                      value={newIndicator.targetValue} onChange={e => setNewIndicator(p => ({ ...p, targetValue: e.target.value }))} placeholder="e.g. 500" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-[var(--tulip-forest)]/40 block mb-1">Unit</label>
                    <input className="w-full bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-4 py-2.5 text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none focus:border-[var(--tulip-gold)]"
                      value={newIndicator.unit} onChange={e => setNewIndicator(p => ({ ...p, unit: e.target.value }))} placeholder="e.g. households" />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--tulip-forest)]/40 block mb-1">Measurement Method</label>
                    <input className="w-full bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-4 py-2.5 text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none focus:border-[var(--tulip-gold)]"
                      value={newIndicator.measurementMethod} onChange={e => setNewIndicator(p => ({ ...p, measurementMethod: e.target.value }))} placeholder="e.g. Survey" />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--tulip-forest)]/40 block mb-1">Reporting Period</label>
                    <input className="w-full bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-4 py-2.5 text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none focus:border-[var(--tulip-gold)]"
                      value={newIndicator.reportingPeriod} onChange={e => setNewIndicator(p => ({ ...p, reportingPeriod: e.target.value }))} placeholder="e.g. Quarterly" />
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button onClick={() => handleAddIndicator(showAddIndicator)} disabled={savingIndicator || !newIndicator.indicator.trim() || !newIndicator.targetValue.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--tulip-gold)] text-[var(--tulip-forest)] hover:bg-[var(--tulip-orange)] disabled:opacity-50">
                    {savingIndicator ? 'Saving...' : 'Add Indicator'}
                  </button>
                  <button onClick={() => setShowAddIndicator(null)} className="px-4 py-2 rounded-lg text-sm text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)]">Cancel</button>
                </div>
              </div>
            </div>
          )}

          {/* Update Indicator Modal */}
          {updateIndicator && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setUpdateIndicator(null)}>
              <div className="bg-[var(--tulip-cream)] rounded-xl border border-[var(--tulip-sage-dark)] p-6 max-w-md w-full space-y-4 shadow-xl" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-[var(--tulip-forest)]">Update Indicator</h3>
                <div>
                  <label className="text-xs text-[var(--tulip-forest)]/40 block mb-1">Indicator</label>
                  <p className="text-sm text-[var(--tulip-forest)] bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-4 py-2.5">{updateIndicator.indicator}</p>
                </div>
                <div>
                  <label className="text-xs text-[var(--tulip-forest)]/40 block mb-1">Actual Value</label>
                  <input className="w-full bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-4 py-2.5 text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none focus:border-[var(--tulip-gold)]"
                    value={updateActual} onChange={e => setUpdateActual(e.target.value)} placeholder="Enter current actual value" />
                </div>
                <div>
                  <label className="text-xs text-[var(--tulip-forest)]/40 block mb-2">RAG Status</label>
                  <div className="flex gap-2 flex-wrap">
                    {(Object.entries(RAG_STYLES) as [RAGStatus, typeof RAG_STYLES[string]][]).map(([key, style]) => (
                      <button key={key} onClick={() => setUpdateRAG(key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          updateRAG === key
                            ? `${style.bg} ${style.text} border-current ring-1 ring-current`
                            : 'bg-[var(--tulip-sage)] text-[var(--tulip-forest)]/60 border-[var(--tulip-sage-dark)] hover:border-[var(--tulip-sage-dark)]'
                        }`}>
                        {style.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[var(--tulip-forest)]/40 block mb-1">Notes</label>
                  <textarea className="w-full bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-4 py-2.5 text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none focus:border-[var(--tulip-gold)] resize-none"
                    rows={2} value={updateNotes} onChange={e => setUpdateNotes(e.target.value)} placeholder="Optional notes..." />
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button onClick={handleUpdateIndicator} disabled={savingUpdate}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--tulip-gold)] text-[var(--tulip-forest)] hover:bg-[var(--tulip-orange)] disabled:opacity-50">
                    {savingUpdate ? 'Saving...' : 'Update'}
                  </button>
                  <button onClick={() => setUpdateIndicator(null)} className="px-4 py-2 rounded-lg text-sm text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)]">Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Risk Register */}
      {tab === 'risks' && <RiskRegisterTab projectId={id} />}

      {/* Tab: World Bank */}
      {tab === 'worldbank' && <WorldBankTab projectId={id} />}

      {/* Tab: Audit */}
      {tab === 'audit' && (
        <div className="bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-xl overflow-hidden">
          {audit.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[var(--tulip-forest)]/40 gap-3">
              <Activity size={36} className="text-[var(--tulip-forest)]/30" />
              <p className="text-sm">No audit entries for this project</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--tulip-sage-dark)]">
                  <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">ACTION</th>
                  <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">HASH</th>
                  <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">TX</th>
                  <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">STATUS</th>
                  <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">DATE</th>
                </tr>
              </thead>
              <tbody>
                {audit.map(entry => (
                  <tr key={entry.id} className="border-b border-[var(--tulip-sage-dark)] hover:bg-[var(--tulip-sage)]/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-[var(--tulip-forest)]">{entry.action.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3"><span className="text-xs font-mono text-[var(--tulip-forest)]/40">{entry.dataHash?.slice(0, 12)}...</span></td>
                    <td className="px-4 py-3">
                      {entry.blockchainTx
                        ? <a href={`https://polygonscan.com/tx/${entry.blockchainTx}`} target="_blank" rel="noopener noreferrer"
                            className="text-xs font-mono text-[var(--tulip-forest)] hover:text-[var(--tulip-gold)] flex items-center gap-1">
                            {entry.blockchainTx.slice(0, 10)}... <ExternalLink size={10} />
                          </a>
                        : <span className="text-xs text-[var(--tulip-forest)]/30">-</span>}
                    </td>
                    <td className="px-4 py-3">{anchorBadge(entry.anchorStatus)}</td>
                    <td className="px-4 py-3 text-xs text-[var(--tulip-forest)]/40">{new Date(entry.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {activeSealId && (
        <TrustSealCard sealId={activeSealId} onClose={() => setActiveSealId(null)} />
      )}
    </div>
  )
}
