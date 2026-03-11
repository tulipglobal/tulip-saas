'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiGet } from '@/lib/api'
import DocumentUploadSection from '@/components/DocumentUploadSection'
import {
  ArrowLeft, FolderOpen, DollarSign, FileText, Activity,
  CheckCircle, Clock, AlertTriangle, XCircle, ExternalLink,
  Calendar, Tag, Hash, Plus
} from 'lucide-react'

interface BudgetSummary {
  budgetCapex: number
  budgetOpex: number
  budgetTotal: number
  actualCapex: number
  actualOpex: number
  actualTotal: number
}

interface Project {
  id: string
  name: string
  description: string | null
  budget: number | null
  currency?: string
  status: string
  startDate?: string | null
  endDate?: string | null
  createdAt: string
  fundingSources: any[]
  expenses: Expense[]
  documents: Document[]
  budgetSummary: BudgetSummary | null
}

interface Expense {
  id: string
  description: string
  amount: number
  currency: string
  anchorStatus?: string
  dataHash?: string
  createdAt: string
}

interface Document {
  id: string
  name: string
  fileHash?: string
  anchorStatus?: string
  createdAt: string
}

interface AuditEntry {
  id: string
  action: string
  entityType: string
  entityId: string
  dataHash: string
  anchorStatus: string
  blockchainTx: string | null
  ancheredAt: string | null
  createdAt: string
}

const statusColors: Record<string, string> = {
  active:    'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  completed: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  paused:    'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  draft:     'bg-white/10 text-white/50 border border-white/20',
}

const anchorBadge = (status: string) => {
  switch (status) {
    case 'confirmed': return <span className="flex items-center gap-1 text-emerald-400 text-xs"><CheckCircle size={12} /> Confirmed</span>
    case 'pending':   return <span className="flex items-center gap-1 text-yellow-400 text-xs"><Clock size={12} /> Pending</span>
    case 'failed':    return <span className="flex items-center gap-1 text-red-400 text-xs"><XCircle size={12} /> Failed</span>
    default:          return <span className="flex items-center gap-1 text-white/30 text-xs"><Clock size={12} /> —</span>
  }
}

export default function ProjectDetailPage() {
  const params  = useParams()
  const router  = useRouter()
  const id      = params?.id as string

  const [project,  setProject]  = useState<Project | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [audit,    setAudit]    = useState<AuditEntry[]>([])
  const [loading,  setLoading]  = useState(true)
  const [tab,      setTab]      = useState<'expenses' | 'documents' | 'audit'>('expenses')
  const [error,    setError]    = useState('')

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
      // filter audit to this project's entity
      const allAudit = aud.data ?? aud.items ?? []
      setAudit(allAudit.filter((a: AuditEntry) =>
        a.entityId === id || a.entityType === 'Project'
      ))
      setLoading(false)
    }).catch(() => { setError('Failed to load project'); setLoading(false) })
  }, [id])

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-[#0a0a0f]">
      <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (error || !project) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0f] text-white/60 gap-4">
      <FolderOpen size={48} className="text-white/20" />
      <p>{error || 'Project not found'}</p>
      <Link href="/dashboard/projects" className="text-cyan-400 hover:text-cyan-300 text-sm">← Back to Projects</Link>
    </div>
  )

  const totalSpent    = expenses.reduce((s, e) => s + e.amount, 0)
  const budgetPercent = project.budget ? Math.min((totalSpent / project.budget) * 100, 100) : 0
  const confirmedExp  = expenses.filter(e => e.anchorStatus === 'confirmed').length
  const pendingExp    = expenses.filter(e => e.anchorStatus === 'pending' || !e.anchorStatus).length

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6 max-w-6xl mx-auto">

      {/* Back */}
      <Link href="/dashboard/projects" className="inline-flex items-center gap-2 text-white/40 hover:text-white/70 text-sm mb-6 transition-colors">
        <ArrowLeft size={14} /> Back to Projects
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <FolderOpen size={22} className="text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white">{project.name}</h1>
            {project.description && <p className="text-white/50 text-sm mt-1">{project.description}</p>}
            <div className="flex items-center gap-3 mt-2">
              <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${statusColors[project.status] ?? statusColors.draft}`}>
                {project.status}
              </span>
              <span className="text-white/30 text-xs flex items-center gap-1">
                <Calendar size={11} /> Created {new Date(project.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        <Link href="/dashboard/expenses/new" className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-black text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus size={14} /> Log Expense
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-white/40 text-xs mb-1">Total Spent</p>
          <p className="text-white font-semibold text-lg">${totalSpent.toLocaleString()}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-white/40 text-xs mb-1">Expenses</p>
          <p className="text-white font-semibold text-lg">{expenses.length}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-white/40 text-xs mb-1">Documents</p>
          <p className="text-white font-semibold text-lg">{project.documents?.length ?? 0}</p>
        </div>
      </div>

      {/* Budget summary card */}
      {project.budgetSummary && project.budgetSummary.budgetTotal > 0 && (() => {
        const bs = project.budgetSummary
        const remaining = bs.budgetTotal - bs.actualTotal
        const pct = bs.budgetTotal > 0 ? Math.round((remaining / bs.budgetTotal) * 100) : 0
        return (
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-8">
            <div className="grid grid-cols-2 gap-x-8 gap-y-1">
              <div className="text-xs text-white/30 font-medium uppercase tracking-wide">Budget</div>
              <div className="text-xs text-white/30 font-medium uppercase tracking-wide">Actual Spend</div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-purple-400">CapEx</span>
                <span className="text-sm text-white/60 font-medium">${bs.budgetCapex.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-purple-400">CapEx</span>
                <span className="text-sm text-white/60 font-medium">${bs.actualCapex.toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-cyan-400">OpEx</span>
                <span className="text-sm text-white/60 font-medium">${bs.budgetOpex.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-cyan-400">OpEx</span>
                <span className="text-sm text-white/60 font-medium">${bs.actualOpex.toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between border-t border-white/10 pt-1 mt-1">
                <span className="text-sm text-white font-medium">Total</span>
                <span className="text-sm text-white font-bold">${bs.budgetTotal.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between border-t border-white/10 pt-1 mt-1">
                <span className="text-sm text-white font-medium">Total</span>
                <span className="text-sm text-white font-bold">${bs.actualTotal.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
              <span className="text-sm text-white/50">Remaining</span>
              <span className={`text-sm font-bold ${remaining >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                ${remaining.toLocaleString()} ({pct}%)
              </span>
            </div>
          </div>
        )
      })()}

      {/* Blockchain summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle size={20} className="text-emerald-400" />
          <div>
            <p className="text-white/40 text-xs">Confirmed</p>
            <p className="text-emerald-400 font-semibold">{confirmedExp}</p>
          </div>
        </div>
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 flex items-center gap-3">
          <Clock size={20} className="text-yellow-400" />
          <div>
            <p className="text-white/40 text-xs">Pending Anchor</p>
            <p className="text-yellow-400 font-semibold">{pendingExp}</p>
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3">
          <Activity size={20} className="text-cyan-400" />
          <div>
            <p className="text-white/40 text-xs">Audit Entries</p>
            <p className="text-white font-semibold">{audit.length}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white/5 p-1 rounded-lg w-fit">
        {(['expenses', 'documents', 'audit'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm capitalize transition-all ${tab === t ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'}`}
          >
            {t} {t === 'expenses' ? `(${expenses.length})` : t === 'documents' ? `(${project.documents?.length ?? 0})` : `(${audit.length})`}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'expenses' && (
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          {expenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-white/30 gap-3">
              <DollarSign size={36} className="text-white/10" />
              <p className="text-sm">No expenses logged for this project</p>
              <Link href="/dashboard/expenses/new" className="text-cyan-400 hover:text-cyan-300 text-xs">+ Log first expense</Link>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-xs text-white/30 font-normal px-4 py-3">DESCRIPTION</th>
                  <th className="text-left text-xs text-white/30 font-normal px-4 py-3">AMOUNT</th>
                  <th className="text-left text-xs text-white/30 font-normal px-4 py-3">HASH</th>
                  <th className="text-left text-xs text-white/30 font-normal px-4 py-3">STATUS</th>
                  <th className="text-left text-xs text-white/30 font-normal px-4 py-3">DATE</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp, i) => (
                  <tr key={exp.id} className={`border-b border-white/5 hover:bg-white/5 transition-colors ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}>
                    <td className="px-4 py-3 text-sm text-white/80">{exp.description}</td>
                    <td className="px-4 py-3 text-sm text-white font-medium">{exp.currency} {exp.amount.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      {exp.dataHash
                        ? <span className="text-xs font-mono text-white/30">{exp.dataHash.slice(0, 12)}…</span>
                        : <span className="text-xs text-white/20">—</span>
                      }
                    </td>
                    <td className="px-4 py-3">{anchorBadge(exp.anchorStatus ?? '')}</td>
                    <td className="px-4 py-3 text-xs text-white/30">{new Date(exp.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'documents' && (
        <div className="space-y-4">
          <DocumentUploadSection entityType="project" entityId={id} onUploaded={() => {
            apiGet(`/api/projects/${id}`).then(r => r.ok ? r.json() : null).then(p => { if (p) setProject(p) })
          }} />
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            {(!project.documents || project.documents.length === 0) ? (
              <div className="flex flex-col items-center justify-center py-12 text-white/30 gap-2">
                <FileText size={32} className="text-white/10" />
                <p className="text-sm">No documents yet — upload one above</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-xs text-white/30 font-normal px-4 py-3">NAME</th>
                    <th className="text-left text-xs text-white/30 font-normal px-4 py-3">TYPE</th>
                    <th className="text-left text-xs text-white/30 font-normal px-4 py-3">HASH</th>
                    <th className="text-left text-xs text-white/30 font-normal px-4 py-3">DATE</th>
                    <th className="text-left text-xs text-white/30 font-normal px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {project.documents.map((doc: any) => (
                    <tr key={doc.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-sm text-white/80">{doc.name}</td>
                      <td className="px-4 py-3 text-xs text-white/40 uppercase">{doc.fileType ?? '—'}</td>
                      <td className="px-4 py-3">
                        {doc.sha256Hash
                          ? <span className="text-xs font-mono text-white/30">{doc.sha256Hash.slice(0, 12)}…</span>
                          : <span className="text-xs text-white/20">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-xs text-white/30">{new Date(doc.uploadedAt ?? doc.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        {doc.sha256Hash && (
                          <a href={`/verify?hash=${doc.sha256Hash}`} target="_blank"
                            className="text-white/20 hover:text-[#369bff] transition-colors" title="Verify hash">
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          {audit.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-white/30 gap-3">
              <Activity size={36} className="text-white/10" />
              <p className="text-sm">No audit entries for this project</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-xs text-white/30 font-normal px-4 py-3">ACTION</th>
                  <th className="text-left text-xs text-white/30 font-normal px-4 py-3">HASH</th>
                  <th className="text-left text-xs text-white/30 font-normal px-4 py-3">TX</th>
                  <th className="text-left text-xs text-white/30 font-normal px-4 py-3">STATUS</th>
                  <th className="text-left text-xs text-white/30 font-normal px-4 py-3">DATE</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((entry) => (
                  <tr key={entry.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-sm text-white/80">{entry.action.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-white/30">{entry.dataHash?.slice(0, 12)}…</span>
                    </td>
                    <td className="px-4 py-3">
                      {entry.blockchainTx
                        ? <a href={`https://polygonscan.com/tx/${entry.blockchainTx}`} target="_blank" rel="noopener noreferrer"
                            className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                            {entry.blockchainTx.slice(0, 10)}… <ExternalLink size={10} />
                          </a>
                        : <span className="text-xs text-white/20">—</span>
                      }
                    </td>
                    <td className="px-4 py-3">{anchorBadge(entry.anchorStatus)}</td>
                    <td className="px-4 py-3 text-xs text-white/30">{new Date(entry.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
