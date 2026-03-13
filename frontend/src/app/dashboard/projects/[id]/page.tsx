'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { apiGet, apiPost } from '@/lib/api'
import DocumentUploadSection from '@/components/DocumentUploadSection'
import BlockchainStatusPill from '@/components/BlockchainStatusPill'
import TrustSealCard from '@/components/TrustSealCard'
import {
  ArrowLeft, FolderOpen, DollarSign, FileText, Activity,
  CheckCircle, Clock, XCircle, ExternalLink,
  Calendar, Plus, Wallet
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
  completed: 'bg-[#f6c453]/15 text-[#183a1d] border border-[#f6c453]/30',
  paused: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  draft: 'bg-[#e1eedd] text-[#183a1d]/60 border border-[#c8d6c0]',
}

const budgetStatusColors: Record<string, string> = {
  DRAFT: 'bg-[#e1eedd] text-[#183a1d]/60', APPROVED: 'bg-[#f6c453]/15 text-[#183a1d]',
  ACTIVE: 'bg-emerald-500/20 text-emerald-400', CLOSED: 'bg-[#e1eedd] text-[#183a1d]/40',
}

const anchorBadge = (status: string) => {
  switch (status) {
    case 'confirmed': return <span className="flex items-center gap-1 text-emerald-400 text-xs"><CheckCircle size={12} /> Confirmed</span>
    case 'pending': return <span className="flex items-center gap-1 text-yellow-400 text-xs"><Clock size={12} /> Pending</span>
    case 'failed': return <span className="flex items-center gap-1 text-red-400 text-xs"><XCircle size={12} /> Failed</span>
    default: return <span className="flex items-center gap-1 text-[#183a1d]/40 text-xs"><Clock size={12} /> —</span>
  }
}

type TabKey = 'expenses' | 'documents' | 'budgets' | 'audit'

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

  useEffect(() => {
    if (!id) return
    Promise.all([
      apiGet(`/api/projects/${id}`).then(r => r.ok ? r.json() : null),
      apiGet(`/api/expenses?projectId=${id}&limit=50`).then(r => r.ok ? r.json() : { data: [] }),
      apiGet(`/api/audit?limit=50`).then(r => r.ok ? r.json() : { data: [] }),
    ]).then(([proj, exp, aud]) => {
      if (!proj) { setError('Project not found'); setLoading(false); return }
      setProject(proj)
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

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-[#fefbe9]">
      <div className="w-8 h-8 border-2 border-[#f6c453] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (error || !project) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#fefbe9] text-[#183a1d]/70 gap-4">
      <FolderOpen size={48} className="text-[#183a1d]/30" />
      <p>{error || 'Project not found'}</p>
      <Link href="/dashboard/projects" className="text-[#183a1d] hover:text-[#f6c453] text-sm">Back to Projects</Link>
    </div>
  )

  // Aggregate from budgets
  const hasBudgets = project.budgets && project.budgets.length > 0
  const totalBudget = hasBudgets ? project.budgets.reduce((s, b) => s + b.lines.reduce((ls, l) => ls + l.approvedAmount, 0), 0) : 0
  const totalFunded = hasBudgets ? project.budgets.reduce((s, b) => s + (b.fundingSources || []).reduce((fs, f) => fs + f.amount, 0), 0) : 0
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0)
  const remaining = totalBudget - totalSpent

  return (
    <div className="min-h-screen bg-[#fefbe9] text-[#183a1d] p-6 max-w-6xl mx-auto">
      <Link href="/dashboard/projects" className="inline-flex items-center gap-2 text-[#183a1d]/60 hover:text-[#183a1d] text-sm mb-6 transition-colors">
        <ArrowLeft size={14} /> Back to Projects
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#f6c453]/10 border border-[#f6c453]/30 flex items-center justify-center">
            <FolderOpen size={22} className="text-[#183a1d]" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-[#183a1d]">{project.name}</h1>
            {project.description && <p className="text-[#183a1d]/60 text-sm mt-1">{project.description}</p>}
            <div className="flex items-center gap-3 mt-2">
              <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${statusColors[project.status] ?? statusColors.draft}`}>
                {project.status}
              </span>
              <span className="text-[#183a1d]/40 text-xs flex items-center gap-1">
                <Calendar size={11} /> Created {new Date(project.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        <Link href={`/dashboard/budgets/new?projectId=${id}`}
          className="flex items-center gap-2 text-sm font-medium text-[#183a1d] px-4 py-2 rounded-lg transition-all shrink-0 bg-[#f6c453] hover:bg-[#f0a04b]">
          <Plus size={14} /> Create Budget
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-[#e1eedd] border border-[#c8d6c0] rounded-xl p-4">
          <p className="text-[#183a1d]/60 text-xs mb-1">Total Budget</p>
          <p className="text-[#183a1d] font-semibold text-lg">${totalBudget.toLocaleString()}</p>
        </div>
        <div className="bg-[#e1eedd] border border-[#c8d6c0] rounded-xl p-4">
          <p className="text-[#183a1d]/60 text-xs mb-1">Total Funded</p>
          <p className={`font-semibold text-lg ${totalFunded >= totalBudget && totalBudget > 0 ? 'text-green-400' : 'text-yellow-400'}`}>
            ${totalFunded.toLocaleString()}
          </p>
        </div>
        <div className="bg-[#e1eedd] border border-[#c8d6c0] rounded-xl p-4">
          <p className="text-[#183a1d]/60 text-xs mb-1">Total Spent</p>
          <p className="text-orange-400 font-semibold text-lg">${totalSpent.toLocaleString()}</p>
        </div>
        <div className="bg-[#e1eedd] border border-[#c8d6c0] rounded-xl p-4">
          <p className="text-[#183a1d]/60 text-xs mb-1">Remaining</p>
          <p className={`font-semibold text-lg ${remaining >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ${remaining.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[#e1eedd] p-1 rounded-lg w-fit">
        {([
          { key: 'expenses' as TabKey, label: 'Expenses', count: expenses.length },
          { key: 'documents' as TabKey, label: 'Documents', count: project.documents?.length ?? 0 },
          { key: 'budgets' as TabKey, label: 'Budgets', count: project.budgets?.length ?? 0 },
          { key: 'audit' as TabKey, label: 'Audit', count: audit.length },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-md text-sm transition-all ${tab === t.key ? 'bg-[#e1eedd] text-[#183a1d]' : 'text-[#183a1d]/60 hover:text-[#183a1d]'}`}>
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {/* Tab: Expenses */}
      {tab === 'expenses' && (
        <div className="bg-[#e1eedd] border border-[#c8d6c0] rounded-xl overflow-hidden">
          {expenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#183a1d]/40 gap-3">
              <DollarSign size={36} className="text-[#183a1d]/30" />
              <p className="text-sm">No expenses logged for this project</p>
              <Link href="/dashboard/expenses/new" className="text-[#183a1d] hover:text-[#f6c453] text-xs">+ Log first expense</Link>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#c8d6c0]">
                  <th className="text-left text-xs text-[#183a1d]/40 font-normal px-4 py-3">DESCRIPTION</th>
                  <th className="text-left text-xs text-[#183a1d]/40 font-normal px-4 py-3">AMOUNT</th>
                  <th className="text-left text-xs text-[#183a1d]/40 font-normal px-4 py-3">HASH</th>
                  <th className="text-left text-xs text-[#183a1d]/40 font-normal px-4 py-3">STATUS</th>
                  <th className="text-left text-xs text-[#183a1d]/40 font-normal px-4 py-3">DATE</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp, i) => (
                  <tr key={exp.id} className={`border-b border-[#c8d6c0] hover:bg-[#e1eedd]/50 transition-colors ${i % 2 === 0 ? '' : 'bg-[#e1eedd]'}`}>
                    <td className="px-4 py-3 text-sm text-[#183a1d]">{exp.description}</td>
                    <td className="px-4 py-3 text-sm text-[#183a1d] font-medium">{exp.currency} {exp.amount.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      {exp.dataHash ? <span className="text-xs font-mono text-[#183a1d]/40">{exp.dataHash.slice(0, 12)}...</span> : <span className="text-xs text-[#183a1d]/30">-</span>}
                    </td>
                    <td className="px-4 py-3">{anchorBadge(exp.anchorStatus ?? '')}</td>
                    <td className="px-4 py-3 text-xs text-[#183a1d]/40">{new Date(exp.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
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
          <div className="bg-[#e1eedd] border border-[#c8d6c0] rounded-xl overflow-hidden">
            {(!project.documents || project.documents.length === 0) ? (
              <div className="flex flex-col items-center justify-center py-12 text-[#183a1d]/40 gap-2">
                <FileText size={32} className="text-[#183a1d]/30" />
                <p className="text-sm">No documents yet - upload one above</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#c8d6c0]">
                    <th className="text-left text-xs text-[#183a1d]/40 font-normal px-4 py-3">NAME</th>
                    <th className="text-left text-xs text-[#183a1d]/40 font-normal px-4 py-3">TYPE</th>
                    <th className="text-left text-xs text-[#183a1d]/40 font-normal px-4 py-3">HASH</th>
                    <th className="text-left text-xs text-[#183a1d]/40 font-normal px-4 py-3">SEAL</th>
                    <th className="text-left text-xs text-[#183a1d]/40 font-normal px-4 py-3">DATE</th>
                  </tr>
                </thead>
                <tbody>
                  {project.documents.map((doc: any) => {
                    const seal = doc.sha256Hash ? sealMap[doc.sha256Hash] : null
                    return (
                    <tr key={doc.id} className="border-b border-[#c8d6c0] hover:bg-[#e1eedd]/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-[#183a1d]">{doc.name}</td>
                      <td className="px-4 py-3 text-xs text-[#183a1d]/60 uppercase">{doc.fileType ?? '-'}</td>
                      <td className="px-4 py-3">
                        {doc.sha256Hash ? <span className="text-xs font-mono text-[#183a1d]/40">{doc.sha256Hash.slice(0, 12)}...</span> : <span className="text-xs text-[#183a1d]/30">-</span>}
                      </td>
                      <td className="px-4 py-3">
                        {seal ? (
                          <BlockchainStatusPill sealId={seal.sealId} anchorStatus={seal.anchorStatus} txHash={seal.txHash} onClick={() => setActiveSealId(seal.sealId)} />
                        ) : (
                          <BlockchainStatusPill onClick={() => {}} />
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#183a1d]/40">{new Date(doc.uploadedAt ?? doc.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
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
        <div className="bg-[#e1eedd] border border-[#c8d6c0] rounded-xl overflow-hidden">
          {!hasBudgets ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#183a1d]/40 gap-3">
              <Wallet size={36} className="text-[#183a1d]/30" />
              <p className="text-sm">No budgets linked to this project</p>
              <Link href={`/dashboard/budgets/new?projectId=${id}`} className="text-[#183a1d] hover:text-[#f6c453] text-xs">+ Create budget</Link>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#c8d6c0]">
                  <th className="text-left text-xs text-[#183a1d]/40 font-normal px-4 py-3">NAME</th>
                  <th className="text-left text-xs text-[#183a1d]/40 font-normal px-4 py-3">STATUS</th>
                  <th className="text-left text-xs text-[#183a1d]/40 font-normal px-4 py-3">PERIOD</th>
                  <th className="text-left text-xs text-[#183a1d]/40 font-normal px-4 py-3">LINES</th>
                  <th className="text-left text-xs text-[#183a1d]/40 font-normal px-4 py-3">TOTAL APPROVED</th>
                  <th className="text-left text-xs text-[#183a1d]/40 font-normal px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {project.budgets.map(b => {
                  const total = b.lines.reduce((s, l) => s + l.approvedAmount, 0)
                  return (
                    <tr key={b.id} className="border-b border-[#c8d6c0] hover:bg-[#e1eedd]/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-[#183a1d]">{b.name}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${budgetStatusColors[b.status] ?? 'bg-[#e1eedd] text-[#183a1d]/60'}`}>{b.status}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#183a1d]/60">{new Date(b.periodFrom).toLocaleDateString()} - {new Date(b.periodTo).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-sm text-[#183a1d]/60">{b.lines.length}</td>
                      <td className="px-4 py-3 text-sm text-[#183a1d] font-medium">${total.toLocaleString()}</td>
                      <td className="px-4 py-3"><Link href={`/dashboard/budgets/${b.id}`} className="text-[#183a1d] hover:text-[#f6c453] text-xs">View</Link></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab: Audit */}
      {tab === 'audit' && (
        <div className="bg-[#e1eedd] border border-[#c8d6c0] rounded-xl overflow-hidden">
          {audit.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#183a1d]/40 gap-3">
              <Activity size={36} className="text-[#183a1d]/30" />
              <p className="text-sm">No audit entries for this project</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#c8d6c0]">
                  <th className="text-left text-xs text-[#183a1d]/40 font-normal px-4 py-3">ACTION</th>
                  <th className="text-left text-xs text-[#183a1d]/40 font-normal px-4 py-3">HASH</th>
                  <th className="text-left text-xs text-[#183a1d]/40 font-normal px-4 py-3">TX</th>
                  <th className="text-left text-xs text-[#183a1d]/40 font-normal px-4 py-3">STATUS</th>
                  <th className="text-left text-xs text-[#183a1d]/40 font-normal px-4 py-3">DATE</th>
                </tr>
              </thead>
              <tbody>
                {audit.map(entry => (
                  <tr key={entry.id} className="border-b border-[#c8d6c0] hover:bg-[#e1eedd]/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-[#183a1d]">{entry.action.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3"><span className="text-xs font-mono text-[#183a1d]/40">{entry.dataHash?.slice(0, 12)}...</span></td>
                    <td className="px-4 py-3">
                      {entry.blockchainTx
                        ? <a href={`https://polygonscan.com/tx/${entry.blockchainTx}`} target="_blank" rel="noopener noreferrer"
                            className="text-xs font-mono text-[#183a1d] hover:text-[#f6c453] flex items-center gap-1">
                            {entry.blockchainTx.slice(0, 10)}... <ExternalLink size={10} />
                          </a>
                        : <span className="text-xs text-[#183a1d]/30">-</span>}
                    </td>
                    <td className="px-4 py-3">{anchorBadge(entry.anchorStatus)}</td>
                    <td className="px-4 py-3 text-xs text-[#183a1d]/40">{new Date(entry.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
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
