'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { apiGet, apiPut, apiPost, apiDelete } from '@/lib/api'
import Link from 'next/link'
import { ArrowLeft, Banknote, Receipt, Edit3, Check, X, Plus, Trash2, AlertTriangle, CheckCircle } from 'lucide-react'
import { FUNDING_SOURCE_TYPES, FUNDING_SOURCE_TYPE_KEYS } from '@/lib/ngo-categories'

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

const STATUS_OPTIONS = ['DRAFT', 'APPROVED', 'ACTIVE', 'CLOSED']
const CURRENCIES = ['USD', 'EUR', 'GBP', 'KES', 'UGX', 'TZS', 'INR', 'NGN', 'ZAR', 'GHS', 'ETB', 'RWF']

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT:    'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
    APPROVED: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
    ACTIVE:   'bg-green-400/10 text-green-400 border-green-400/20',
    CLOSED:   'bg-gray-100 text-gray-500 border-gray-300',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium ${map[status] ?? map.DRAFT}`}>
      {status}
    </span>
  )
}

function FundingBadge({ totalApproved, totalFunded }: { totalApproved: number; totalFunded: number }) {
  if (totalApproved <= 0) return null
  if (totalFunded >= totalApproved) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium bg-green-400/10 text-green-400 border-green-400/20">
      <CheckCircle size={10} /> Fully Funded
    </span>
  )
  if (totalFunded > 0) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium bg-yellow-400/10 text-yellow-400 border-yellow-400/20">
      <AlertTriangle size={10} /> Partially Funded
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium bg-red-400/10 text-red-400 border-red-400/20">
      Unfunded
    </span>
  )
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const inputCls = "w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#0c7aed]/50 transition-all [&>option]:bg-white"

export default function BudgetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [budget, setBudget] = useState<BudgetDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingStatus, setEditingStatus] = useState(false)
  const [newStatus, setNewStatus] = useState('')
  const [statusError, setStatusError] = useState('')

  // Inline add funding source
  const [showAddFunding, setShowAddFunding] = useState(false)
  const [newFunding, setNewFunding] = useState({ sourceType: '', sourceSubType: '', donorName: '', amount: '', currency: 'USD' })
  const [addingFunding, setAddingFunding] = useState(false)

  const reload = () => {
    apiGet(`/api/budgets/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setBudget(d); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { reload() }, [id])

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
    if (!newFunding.sourceType || !newFunding.donorName || !newFunding.amount) return
    setAddingFunding(true)
    const res = await apiPost(`/api/budgets/${id}/funding-sources`, newFunding)
    if (res.ok) {
      setNewFunding({ sourceType: '', sourceSubType: '', donorName: '', amount: '', currency: 'USD' })
      setShowAddFunding(false)
      reload()
    }
    setAddingFunding(false)
  }

  const handleRemoveFunding = async (sourceId: string) => {
    await apiDelete(`/api/budgets/${id}/funding-sources/${sourceId}`)
    reload()
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>
  if (!budget) return <div className="p-8 text-center text-gray-400">Budget not found</div>

  const fundingPct = budget.totalApproved > 0 ? Math.round((budget.totalFunded / budget.totalApproved) * 100) : 0
  const spentPct = budget.totalApproved > 0 ? Math.round((budget.totalSpent / budget.totalApproved) * 100) : 0
  const fundingGap = budget.totalApproved - budget.totalFunded
  const isFullyFunded = budget.totalApproved > 0 && fundingGap <= 0
  const subTypes = newFunding.sourceType ? (FUNDING_SOURCE_TYPES[newFunding.sourceType] || []) : []

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/dashboard/budgets" className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-all mt-1">
          <ArrowLeft size={16} className="text-gray-600" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Inter, sans-serif' }}>{budget.name}</h1>
            {editingStatus ? (
              <div className="flex items-center gap-1">
                <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
                  className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-900 outline-none [&>option]:bg-white">
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button onClick={handleStatusChange} className="text-green-400 hover:text-green-300"><Check size={14} /></button>
                <button onClick={() => { setEditingStatus(false); setStatusError('') }} className="text-gray-400 hover:text-gray-500"><X size={14} /></button>
              </div>
            ) : (
              <button onClick={() => { setEditingStatus(true); setNewStatus(budget.status) }} className="flex items-center gap-1 group">
                <StatusBadge status={budget.status} />
                <Edit3 size={12} className="text-gray-300 group-hover:text-gray-500" />
              </button>
            )}
            <FundingBadge totalApproved={budget.totalApproved} totalFunded={budget.totalFunded} />
          </div>
          {statusError && <p className="text-xs text-red-400 mt-1">{statusError}</p>}
          <p className="text-gray-500 text-sm mt-1">
            {formatDate(budget.periodFrom)} – {formatDate(budget.periodTo)}
            {budget.project && <> · <Link href={`/dashboard/projects/${budget.project.id}`} className="text-cyan-400/60 hover:text-cyan-400">{budget.project.name}</Link></>}
            {budget.notes && <span className="ml-2 text-gray-400">· {budget.notes}</span>}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Budget Required', value: `$${budget.totalApproved.toLocaleString()}`, color: 'text-gray-900' },
          { label: 'Total Funded', value: `$${budget.totalFunded.toLocaleString()}`, sub: `${fundingPct}%`, color: isFullyFunded ? 'text-green-400' : 'text-yellow-400' },
          { label: 'Total Spent', value: `$${budget.totalSpent.toLocaleString()}`, sub: `${spentPct}%`, color: 'text-orange-400' },
          { label: 'Remaining', value: `$${budget.remaining.toLocaleString()}`, color: budget.remaining >= 0 ? 'text-green-400' : 'text-red-400' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="rounded-xl border border-gray-200 px-5 py-4" style={{ background: '#FFFFFF' }}>
            <div className={`text-lg font-bold ${color}`} style={{ fontFamily: 'Inter, sans-serif' }}>
              {value} {sub && <span className="text-xs font-normal text-gray-400">{sub}</span>}
            </div>
            <div className="text-xs text-gray-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* ─── 1. Budget Lines ─── */}
      <div className="rounded-xl border border-gray-200 overflow-hidden" style={{ background: '#FFFFFF' }}>
        <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Budget Lines</h2>
          <span className="text-xs text-gray-400">{budget.lines.length} line{budget.lines.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="hidden lg:grid grid-cols-[1fr_1.5fr_1fr_1fr_1fr_1fr] gap-4 px-5 py-2 border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
          <span>Type</span><span>Category</span><span>Approved</span><span>Spent</span><span>Remaining</span><span>Usage</span>
        </div>
        <div className="divide-y divide-gray-100">
          {budget.lines.map(line => {
            const pct = line.approvedAmount > 0 ? Math.min(100, Math.round((line.spent / line.approvedAmount) * 100)) : 0
            return (
              <div key={line.id} className="px-5 py-3 lg:grid lg:grid-cols-[1fr_1.5fr_1fr_1fr_1fr_1fr] lg:gap-4 lg:items-center">
                <div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium ${
                    line.expenseType === 'CAPEX' ? 'bg-purple-400/10 text-purple-400 border-purple-400/20' : 'bg-cyan-400/10 text-cyan-400 border-cyan-400/20'
                  }`}>{line.expenseType}</span>
                </div>
                <div>
                  <div className="text-sm text-gray-700">{line.category}</div>
                  {line.subCategory && <div className="text-xs text-gray-400">{line.subCategory}</div>}
                  {line.description && <div className="text-xs text-gray-300 italic">{line.description}</div>}
                </div>
                <div className="text-sm text-gray-900 font-medium">{line.currency} {line.approvedAmount.toLocaleString()}</div>
                <div className="text-sm text-orange-400">{line.currency} {line.spent.toLocaleString()}</div>
                <div className={`text-sm font-medium ${line.remaining >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {line.currency} {line.remaining.toLocaleString()}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{
                      width: `${pct}%`,
                      background: pct > 90 ? '#f87171' : pct > 70 ? '#fbbf24' : '#34d399'
                    }} />
                  </div>
                  <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ─── 2. Funding Sources ─── */}
      <div className="rounded-xl border border-gray-200 overflow-hidden" style={{ background: '#FFFFFF' }}>
        <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-2">
            <Banknote size={14} /> Funding Sources
          </h2>
          <div className="flex items-center gap-3">
            <FundingBadge totalApproved={budget.totalApproved} totalFunded={budget.totalFunded} />
            <button onClick={() => setShowAddFunding(true)}
              className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
              <Plus size={12} /> Add
            </button>
          </div>
        </div>

        {budget.fundingSources.length === 0 && !showAddFunding ? (
          <div className="px-5 py-6 text-center text-gray-400 text-sm">
            No funding sources yet.{' '}
            <button onClick={() => setShowAddFunding(true)} className="text-cyan-400 hover:text-cyan-300">Add one</button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {budget.fundingSources.map(f => (
              <div key={f.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <div className="text-sm text-gray-700">{f.donorName}</div>
                  <div className="text-xs text-gray-400">
                    {f.sourceType}{f.sourceSubType ? ` / ${f.sourceSubType}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-900">{f.currency} {f.amount.toLocaleString()}</span>
                  <button onClick={() => handleRemoveFunding(f.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors" title="Remove">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Inline add form */}
        {showAddFunding && (
          <div className="px-5 py-4 border-t border-gray-200 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Source Type *</label>
                <select value={newFunding.sourceType} onChange={e => setNewFunding(p => ({ ...p, sourceType: e.target.value, sourceSubType: '' }))}
                  className={inputCls}>
                  <option value="">Select...</option>
                  {FUNDING_SOURCE_TYPE_KEYS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Sub-Type</label>
                <select value={newFunding.sourceSubType} onChange={e => setNewFunding(p => ({ ...p, sourceSubType: e.target.value }))}
                  disabled={subTypes.length === 0} className={inputCls + ' disabled:opacity-40'}>
                  <option value="">Select...</option>
                  {subTypes.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Donor Name *</label>
                <input value={newFunding.donorName} onChange={e => setNewFunding(p => ({ ...p, donorName: e.target.value }))}
                  placeholder="e.g. USAID" className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Amount *</label>
                <div className="flex gap-1.5">
                  <select value={newFunding.currency} onChange={e => setNewFunding(p => ({ ...p, currency: e.target.value }))}
                    className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-2 text-xs text-gray-600 outline-none [&>option]:bg-white w-20 shrink-0">
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input type="number" min="0" step="0.01" value={newFunding.amount}
                    onChange={e => setNewFunding(p => ({ ...p, amount: e.target.value }))} placeholder="0.00"
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#0c7aed]/50 transition-all" />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleAddFunding} disabled={addingFunding || !newFunding.sourceType || !newFunding.donorName || !newFunding.amount}
                className="px-4 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-40 transition-all"
                style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
                {addingFunding ? 'Adding...' : 'Add Source'}
              </button>
              <button onClick={() => setShowAddFunding(false)} className="px-4 py-1.5 text-xs text-gray-500 hover:text-gray-600">Cancel</button>
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
                ? <><CheckCircle size={14} className="text-green-400" /><span className="text-green-400 font-medium">Fully Funded</span></>
                : <><AlertTriangle size={14} className="text-yellow-400" /><span className="text-yellow-400 font-medium">Gap: ${fundingGap.toLocaleString()}</span></>
              }
            </div>
            <span className="text-xs text-gray-500">
              Required ${budget.totalApproved.toLocaleString()} · Funded ${budget.totalFunded.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* ─── 3. Expenses ─── */}
      <div className="rounded-xl border border-gray-200 overflow-hidden" style={{ background: '#FFFFFF' }}>
        <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-2">
            <Receipt size={14} /> Expenses
          </h2>
          <span className="text-xs text-gray-400">{budget.expenses.length} expense{budget.expenses.length !== 1 ? 's' : ''}</span>
        </div>
        {budget.expenses.length === 0 ? (
          <div className="px-5 py-6 text-center text-gray-400 text-sm">
            No expenses recorded against this budget yet.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {budget.expenses.slice(0, 20).map(e => (
              <div key={e.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <div className="text-sm text-gray-700">{e.description}</div>
                  <div className="text-xs text-gray-400">
                    {e.project.name} · {e.category ?? 'Uncategorised'}
                    {e.subCategory && ` / ${e.subCategory}`}
                    <span className="ml-2">{formatDate(e.createdAt)}</span>
                  </div>
                </div>
                <div className="text-sm font-medium text-gray-900">{e.currency} {e.amount.toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
