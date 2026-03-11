'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { apiGet, apiPut } from '@/lib/api'
import Link from 'next/link'
import { ArrowLeft, Banknote, Receipt, Edit3, Check, X } from 'lucide-react'

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

interface FundingSource {
  id: string
  title: string
  totalAmount: number
  currency: string
  status: string
  sourceType: string | null
  sourceSubType: string | null
  donor: { id: string; name: string } | null
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
  lines: BudgetLine[]
  fundingAgreements: FundingSource[]
  expenses: ExpenseItem[]
  totalApproved: number
  totalSpent: number
  totalFunded: number
  remaining: number
}

const STATUS_OPTIONS = ['DRAFT', 'APPROVED', 'ACTIVE', 'CLOSED']

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT:    'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
    APPROVED: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
    ACTIVE:   'bg-green-400/10 text-green-400 border-green-400/20',
    CLOSED:   'bg-white/10 text-white/50 border-white/20',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium ${map[status] ?? map.DRAFT}`}>
      {status}
    </span>
  )
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function BudgetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [budget, setBudget] = useState<BudgetDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingStatus, setEditingStatus] = useState(false)
  const [newStatus, setNewStatus] = useState('')

  useEffect(() => {
    apiGet(`/api/budgets/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setBudget(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  const handleStatusChange = async () => {
    if (!budget || !newStatus) return
    const res = await apiPut(`/api/budgets/${id}`, { status: newStatus })
    if (res.ok) {
      setBudget(prev => prev ? { ...prev, status: newStatus } : prev)
    }
    setEditingStatus(false)
  }

  if (loading) return <div className="p-8 text-center text-white/30">Loading…</div>
  if (!budget) return <div className="p-8 text-center text-white/30">Budget not found</div>

  const fundingPct = budget.totalApproved > 0 ? Math.round((budget.totalFunded / budget.totalApproved) * 100) : 0
  const spentPct = budget.totalApproved > 0 ? Math.round((budget.totalSpent / budget.totalApproved) * 100) : 0

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/dashboard/budgets" className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all mt-1">
          <ArrowLeft size={16} className="text-white/60" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>{budget.name}</h1>
            {editingStatus ? (
              <div className="flex items-center gap-1">
                <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none [&>option]:bg-[#0a1628]">
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button onClick={handleStatusChange} className="text-green-400 hover:text-green-300"><Check size={14} /></button>
                <button onClick={() => setEditingStatus(false)} className="text-white/30 hover:text-white/50"><X size={14} /></button>
              </div>
            ) : (
              <button onClick={() => { setEditingStatus(true); setNewStatus(budget.status) }} className="flex items-center gap-1 group">
                <StatusBadge status={budget.status} />
                <Edit3 size={12} className="text-white/20 group-hover:text-white/40" />
              </button>
            )}
          </div>
          <p className="text-white/40 text-sm mt-1">
            {formatDate(budget.periodFrom)} – {formatDate(budget.periodTo)}
            {budget.notes && <span className="ml-2 text-white/25">· {budget.notes}</span>}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Budgeted', value: `$${budget.totalApproved.toLocaleString()}`, color: 'text-white' },
          { label: 'Total Funded', value: `$${budget.totalFunded.toLocaleString()}`, sub: `${fundingPct}%`, color: 'text-blue-400' },
          { label: 'Total Spent', value: `$${budget.totalSpent.toLocaleString()}`, sub: `${spentPct}%`, color: 'text-orange-400' },
          { label: 'Remaining', value: `$${budget.remaining.toLocaleString()}`, color: budget.remaining >= 0 ? 'text-green-400' : 'text-red-400' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="rounded-xl border border-white/8 px-5 py-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className={`text-lg font-bold ${color}`} style={{ fontFamily: 'Syne, sans-serif' }}>
              {value} {sub && <span className="text-xs font-normal text-white/30">{sub}</span>}
            </div>
            <div className="text-xs text-white/40 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Budget Lines */}
      <div className="rounded-xl border border-white/8 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="px-5 py-3 border-b border-white/8 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wide">Budget Lines</h2>
          <span className="text-xs text-white/30">{budget.lines.length} line{budget.lines.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="hidden lg:grid grid-cols-[1fr_1.5fr_1fr_1fr_1fr_1fr] gap-4 px-5 py-2 border-b border-white/5 text-xs text-white/25 uppercase tracking-wide">
          <span>Type</span><span>Category</span><span>Approved</span><span>Spent</span><span>Remaining</span><span>Usage</span>
        </div>
        <div className="divide-y divide-white/5">
          {budget.lines.map(line => {
            const pct = line.approvedAmount > 0 ? Math.min(100, Math.round((line.spent / line.approvedAmount) * 100)) : 0
            return (
              <div key={line.id} className="px-5 py-3 lg:grid lg:grid-cols-[1fr_1.5fr_1fr_1fr_1fr_1fr] lg:gap-4 lg:items-center">
                <div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium ${
                    line.expenseType === 'CAPEX'
                      ? 'bg-purple-400/10 text-purple-400 border-purple-400/20'
                      : 'bg-cyan-400/10 text-cyan-400 border-cyan-400/20'
                  }`}>{line.expenseType}</span>
                </div>
                <div>
                  <div className="text-sm text-white/70">{line.category}</div>
                  {line.subCategory && <div className="text-xs text-white/30">{line.subCategory}</div>}
                  {line.description && <div className="text-xs text-white/20 italic">{line.description}</div>}
                </div>
                <div className="text-sm text-white font-medium">{line.currency} {line.approvedAmount.toLocaleString()}</div>
                <div className="text-sm text-orange-400">{line.currency} {line.spent.toLocaleString()}</div>
                <div className={`text-sm font-medium ${line.remaining >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {line.currency} {line.remaining.toLocaleString()}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{
                      width: `${pct}%`,
                      background: pct > 90 ? '#f87171' : pct > 70 ? '#fbbf24' : '#34d399'
                    }} />
                  </div>
                  <span className="text-xs text-white/40 w-8 text-right">{pct}%</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Funding Sources */}
      <div className="rounded-xl border border-white/8 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="px-5 py-3 border-b border-white/8 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wide flex items-center gap-2">
            <Banknote size={14} /> Funding Sources
          </h2>
          <span className="text-xs text-white/30">{budget.fundingAgreements.length} source{budget.fundingAgreements.length !== 1 ? 's' : ''}</span>
        </div>
        {budget.fundingAgreements.length === 0 ? (
          <div className="px-5 py-6 text-center text-white/30 text-sm">
            No funding sources linked yet. Link a funding agreement to this budget.
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {budget.fundingAgreements.map(f => (
              <Link key={f.id} href={`/dashboard/funding/${f.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-white/2 transition-colors">
                <div>
                  <div className="text-sm text-white/70">{f.title}</div>
                  <div className="text-xs text-white/30">
                    {f.donor?.name ?? 'No donor'} · {f.sourceType ?? f.status}
                    {f.sourceSubType && ` / ${f.sourceSubType}`}
                  </div>
                </div>
                <div className="text-sm font-medium text-white">{f.currency} {f.totalAmount.toLocaleString()}</div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recent Expenses */}
      <div className="rounded-xl border border-white/8 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="px-5 py-3 border-b border-white/8 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wide flex items-center gap-2">
            <Receipt size={14} /> Expenses
          </h2>
          <span className="text-xs text-white/30">{budget.expenses.length} expense{budget.expenses.length !== 1 ? 's' : ''}</span>
        </div>
        {budget.expenses.length === 0 ? (
          <div className="px-5 py-6 text-center text-white/30 text-sm">
            No expenses recorded against this budget yet.
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {budget.expenses.slice(0, 20).map(e => (
              <div key={e.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <div className="text-sm text-white/70">{e.description}</div>
                  <div className="text-xs text-white/30">
                    {e.project.name} · {e.category ?? 'Uncategorised'}
                    {e.subCategory && ` / ${e.subCategory}`}
                    <span className="ml-2">{formatDate(e.createdAt)}</span>
                  </div>
                </div>
                <div className="text-sm font-medium text-white">{e.currency} {e.amount.toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
