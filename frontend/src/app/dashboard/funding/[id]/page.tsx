'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { apiGet, apiPost, apiDelete } from '@/lib/api'
import {
  ArrowLeft, Banknote, Calendar, Users, FolderOpen,
  Plus, Trash2, CheckCircle, Clock, AlertCircle, ExternalLink
} from 'lucide-react'

interface ProjectFunding {
  id: string
  allocatedAmount: number
  project: { id: string; name: string; status: string; budget: number | null }
}

interface Repayment {
  id: string
  dueDate: string
  amount: number
  status: string
  paidAt: string | null
  notes: string | null
}

interface Donor {
  id: string; name: string; organisationName: string; type: string; email: string | null; country: string | null
}

interface Agreement {
  id: string; title: string; type: string; totalAmount: number; currency: string; status: string
  startDate: string | null; endDate: string | null; repayable: boolean; interestRate: number | null
  notes: string | null; createdAt: string
  donor: Donor | null
  projectFunding: ProjectFunding[]
  repayments: Repayment[]
  spent: number
  _count: { expenses: number }
}

interface Project { id: string; name: string }

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    GRANT: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
    LOAN: 'bg-orange-400/10 text-orange-400 border-orange-400/20',
    EQUITY: 'bg-purple-400/10 text-purple-400 border-purple-400/20',
    DONATION: 'bg-cyan-400/10 text-cyan-400 border-cyan-400/20',
    IN_KIND: 'bg-pink-400/10 text-pink-400 border-pink-400/20',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs border font-medium ${map[type] ?? 'bg-gray-100 text-gray-500 border-gray-300'}`}>
      {type.replace('_', ' ')}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: 'bg-green-400/10 text-green-400 border-green-400/20',
    DRAFT: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
    COMPLETED: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
    CANCELLED: 'bg-red-400/10 text-red-400 border-red-400/20',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium ${map[status] ?? map.DRAFT}`}>
      {status}
    </span>
  )
}

export default function FundingDetailPage() {
  const params = useParams()
  const id = params?.id as string

  const [agreement, setAgreement] = useState<Agreement | null>(null)
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<Project[]>([])
  const [showLinkProject, setShowLinkProject] = useState(false)
  const [linkProjectId, setLinkProjectId] = useState('')
  const [linkAmount, setLinkAmount] = useState('')
  const [showAddRepayment, setShowAddRepayment] = useState(false)
  const [repaymentDate, setRepaymentDate] = useState('')
  const [repaymentAmount, setRepaymentAmount] = useState('')

  const load = () => {
    if (!id) return
    apiGet(`/api/funding-agreements/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setAgreement(data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

  useEffect(() => {
    apiGet('/api/projects?limit=100')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(d => setProjects(d.data ?? d.items ?? []))
      .catch(() => {})
  }, [])

  const linkProject = async () => {
    if (!linkProjectId || !linkAmount) return
    const res = await apiPost(`/api/funding-agreements/${id}/projects`, {
      projectId: linkProjectId, allocatedAmount: parseFloat(linkAmount)
    })
    if (res.ok) { setShowLinkProject(false); setLinkProjectId(''); setLinkAmount(''); load() }
  }

  const unlinkProject = async (projectId: string) => {
    await apiDelete(`/api/funding-agreements/${id}/projects/${projectId}`)
    load()
  }

  const addRepayment = async () => {
    if (!repaymentDate || !repaymentAmount) return
    const res = await apiPost(`/api/funding-agreements/${id}/repayments`, {
      dueDate: repaymentDate, amount: parseFloat(repaymentAmount)
    })
    if (res.ok) { setShowAddRepayment(false); setRepaymentDate(''); setRepaymentAmount(''); load() }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!agreement) return (
    <div className="flex flex-col items-center justify-center min-h-screen text-gray-600 gap-4">
      <Banknote size={48} className="text-gray-300" />
      <p>Funding agreement not found</p>
      <Link href="/dashboard/funding" className="text-cyan-400 hover:text-cyan-300 text-sm">← Back to Funding</Link>
    </div>
  )

  const pct = agreement.totalAmount > 0 ? Math.min(100, Math.round((agreement.spent / agreement.totalAmount) * 100)) : 0
  const allocated = agreement.projectFunding.reduce((s, pf) => s + pf.allocatedAmount, 0)
  const linkedProjectIds = new Set(agreement.projectFunding.map(pf => pf.project.id))
  const availableProjects = projects.filter(p => !linkedProjectIds.has(p.id))

  const inputCls = "w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#0c7aed]/50 transition-all"

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-up">
      <Link href="/dashboard/funding" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm mb-6 transition-colors">
        <ArrowLeft size={14} /> Back to Funding
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Banknote size={22} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{agreement.title}</h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <TypeBadge type={agreement.type} />
              <StatusBadge status={agreement.status} />
              <span className="text-gray-400 text-xs flex items-center gap-1">
                <Calendar size={11} /> Created {new Date(agreement.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-gray-500 text-xs mb-1">Total Amount</p>
          <p className="text-gray-900 font-semibold text-lg">{agreement.currency} {agreement.totalAmount.toLocaleString()}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-gray-500 text-xs mb-1">Spent</p>
          <p className="text-gray-900 font-semibold text-lg">{agreement.currency} {agreement.spent.toLocaleString()}</p>
          <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full" style={{
              width: `${pct}%`,
              background: pct > 90 ? '#f87171' : pct > 70 ? '#fbbf24' : '#34d399'
            }} />
          </div>
          <p className="text-xs text-gray-400 mt-1">{pct}% utilised</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-gray-500 text-xs mb-1">Allocated to Projects</p>
          <p className="text-gray-900 font-semibold text-lg">{agreement.currency} {allocated.toLocaleString()}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-gray-500 text-xs mb-1">Expenses</p>
          <p className="text-gray-900 font-semibold text-lg">{agreement._count.expenses}</p>
        </div>
      </div>

      {/* Donor info */}
      {agreement.donor && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Users size={16} className="text-gray-500" />
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Donor</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Name</p>
              <p className="text-sm text-gray-800">{agreement.donor.name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Organisation</p>
              <p className="text-sm text-gray-800">{agreement.donor.organisationName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Type</p>
              <p className="text-sm text-gray-800 capitalize">{agreement.donor.type.toLowerCase()}</p>
            </div>
            {agreement.donor.email && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Email</p>
                <p className="text-sm text-gray-800">{agreement.donor.email}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Agreement details */}
      {(agreement.startDate || agreement.endDate || agreement.repayable || agreement.notes) && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-8">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Details</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {agreement.startDate && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Start Date</p>
                <p className="text-sm text-gray-800">{new Date(agreement.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
              </div>
            )}
            {agreement.endDate && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">End Date</p>
                <p className="text-sm text-gray-800">{new Date(agreement.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
              </div>
            )}
            {agreement.repayable && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Interest Rate</p>
                <p className="text-sm text-gray-800">{agreement.interestRate ?? 0}%</p>
              </div>
            )}
          </div>
          {agreement.notes && (
            <div className="mt-3">
              <p className="text-xs text-gray-400 mb-0.5">Notes</p>
              <p className="text-sm text-gray-600">{agreement.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Linked Projects */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FolderOpen size={18} className="text-gray-500" /> Linked Projects
          </h2>
          <button onClick={() => setShowLinkProject(!showLinkProject)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:text-gray-900 border border-gray-200 hover:border-gray-300 transition-all">
            <Plus size={14} /> Link Project
          </button>
        </div>

        {showLinkProject && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4 flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">Project</label>
              <select value={linkProjectId} onChange={e => setLinkProjectId(e.target.value)} className={inputCls}>
                <option value="">Select project</option>
                {availableProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="w-40">
              <label className="block text-xs text-gray-400 mb-1">Allocated Amount</label>
              <input type="number" step="0.01" value={linkAmount} onChange={e => setLinkAmount(e.target.value)}
                placeholder="0.00" className={inputCls} />
            </div>
            <button onClick={linkProject}
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-900 shrink-0"
              style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
              Link
            </button>
          </div>
        )}

        <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
          {agreement.projectFunding.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-gray-400 gap-2">
              <FolderOpen size={28} className="text-gray-300" />
              <p className="text-sm">No projects linked to this agreement</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left text-xs text-gray-400 font-normal px-4 py-3">PROJECT</th>
                  <th className="text-left text-xs text-gray-400 font-normal px-4 py-3">STATUS</th>
                  <th className="text-left text-xs text-gray-400 font-normal px-4 py-3">ALLOCATED</th>
                  <th className="text-left text-xs text-gray-400 font-normal px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {agreement.projectFunding.map(pf => (
                  <tr key={pf.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/projects/${pf.project.id}`} className="text-sm text-cyan-400 hover:text-cyan-300">
                        {pf.project.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500 capitalize">{pf.project.status}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {agreement.currency} {pf.allocatedAmount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => unlinkProject(pf.project.id)}
                        className="text-red-400/50 hover:text-red-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Repayment Schedule (only for repayable agreements) */}
      {agreement.repayable && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Calendar size={18} className="text-gray-500" /> Repayment Schedule
            </h2>
            <button onClick={() => setShowAddRepayment(!showAddRepayment)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:text-gray-900 border border-gray-200 hover:border-gray-300 transition-all">
              <Plus size={14} /> Add Repayment
            </button>
          </div>

          {showAddRepayment && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4 flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">Due Date</label>
                <input type="date" value={repaymentDate} onChange={e => setRepaymentDate(e.target.value)} className={inputCls} />
              </div>
              <div className="w-40">
                <label className="block text-xs text-gray-400 mb-1">Amount</label>
                <input type="number" step="0.01" value={repaymentAmount} onChange={e => setRepaymentAmount(e.target.value)}
                  placeholder="0.00" className={inputCls} />
              </div>
              <button onClick={addRepayment}
                className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-900 shrink-0"
                style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
                Add
              </button>
            </div>
          )}

          <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
            {agreement.repayments.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-gray-400 gap-2">
                <Calendar size={28} className="text-gray-300" />
                <p className="text-sm">No repayments scheduled</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left text-xs text-gray-400 font-normal px-4 py-3">DUE DATE</th>
                    <th className="text-left text-xs text-gray-400 font-normal px-4 py-3">AMOUNT</th>
                    <th className="text-left text-xs text-gray-400 font-normal px-4 py-3">STATUS</th>
                    <th className="text-left text-xs text-gray-400 font-normal px-4 py-3">PAID AT</th>
                  </tr>
                </thead>
                <tbody>
                  {agreement.repayments.map(r => (
                    <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {new Date(r.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800 font-medium">
                        {agreement.currency} {r.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {r.status === 'PAID' ? (
                          <span className="flex items-center gap-1 text-emerald-400 text-xs"><CheckCircle size={12} /> Paid</span>
                        ) : r.status === 'OVERDUE' ? (
                          <span className="flex items-center gap-1 text-red-400 text-xs"><AlertCircle size={12} /> Overdue</span>
                        ) : (
                          <span className="flex items-center gap-1 text-yellow-400 text-xs"><Clock size={12} /> Pending</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {r.paidAt ? new Date(r.paidAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
