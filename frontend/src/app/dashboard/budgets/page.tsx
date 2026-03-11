'use client'

import { useState, useEffect } from 'react'
import { apiGet } from '@/lib/api'
import Link from 'next/link'
import { BarChart3, Plus, Search } from 'lucide-react'

interface BudgetLine {
  id: string
  expenseType: string
  category: string
  subCategory: string | null
  approvedAmount: number
  currency: string
}

interface Budget {
  id: string
  name: string
  periodFrom: string
  periodTo: string
  status: string
  notes: string | null
  createdAt: string
  lines: BudgetLine[]
  totalApproved: number
  spent: number
  _count: { fundingAgreements: number; expenses: number }
}

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

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    apiGet('/api/budgets?limit=50')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(d => { setBudgets(d.data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = budgets.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase())
  )

  const totalBudgeted = filtered.reduce((s, b) => s + b.totalApproved, 0)
  const totalSpent = filtered.reduce((s, b) => s + b.spent, 0)

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Budgets</h1>
          <p className="text-white/40 text-sm mt-1">{budgets.length} budget{budgets.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/dashboard/budgets/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white self-start"
          style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
          <Plus size={16} /> New Budget
        </Link>
      </div>

      {filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Total Budgeted', value: `$${totalBudgeted.toLocaleString()}` },
            { label: 'Total Spent', value: `$${totalSpent.toLocaleString()}` },
            { label: 'Utilisation', value: totalBudgeted > 0 ? `${Math.round((totalSpent / totalBudgeted) * 100)}%` : '0%' },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-white/8 px-5 py-4"
              style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="text-xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>{value}</div>
              <div className="text-xs text-white/40 mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 max-w-sm">
        <Search size={15} className="text-white/30" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search budgets..." className="bg-transparent text-sm text-white/70 placeholder-white/30 outline-none w-full" />
      </div>

      <div className="rounded-xl border border-white/8 overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="hidden lg:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1.5fr] gap-4 px-5 py-3 border-b border-white/8 text-xs text-white/30 uppercase tracking-wide font-medium">
          <span>Budget</span><span>Period</span><span>Lines</span><span>Amount</span><span>Status</span><span>Progress</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-white/30 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <BarChart3 size={32} className="text-white/10" />
            <p className="text-white/30 text-sm">No budgets yet</p>
            <Link href="/dashboard/budgets/new" className="text-[#369bff] text-sm hover:underline">Create your first budget</Link>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.map(b => {
              const pct = b.totalApproved > 0 ? Math.min(100, Math.round((b.spent / b.totalApproved) * 100)) : 0
              const capexLines = b.lines.filter(l => l.expenseType === 'CAPEX').length
              const opexLines = b.lines.filter(l => l.expenseType === 'OPEX').length
              return (
                <div key={b.id} className="px-4 py-3.5 hover:bg-white/2 transition-colors lg:grid lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_1.5fr] lg:gap-4 lg:items-center lg:px-5">
                  <div>
                    <Link href={`/dashboard/budgets/${b.id}`} className="text-sm font-medium text-white/80 hover:text-cyan-400 transition-colors">
                      {b.name}
                    </Link>
                    <div className="text-xs text-white/30 mt-0.5">
                      {b._count.fundingAgreements} funding source{b._count.fundingAgreements !== 1 ? 's' : ''} · {b._count.expenses} expense{b._count.expenses !== 1 ? 's' : ''}
                    </div>
                    {/* Mobile meta */}
                    <div className="flex flex-wrap items-center gap-2 mt-2 lg:hidden">
                      <StatusBadge status={b.status} />
                      <span className="text-xs text-white/40">{formatDate(b.periodFrom)} – {formatDate(b.periodTo)}</span>
                      <span className="text-sm font-medium text-white">${b.totalApproved.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2 lg:hidden">
                      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{
                          width: `${pct}%`,
                          background: pct > 90 ? '#f87171' : pct > 70 ? '#fbbf24' : '#34d399'
                        }} />
                      </div>
                      <span className="text-xs text-white/40 w-8 text-right">{pct}%</span>
                    </div>
                  </div>
                  <div className="hidden lg:block text-xs text-white/50">
                    {formatDate(b.periodFrom)}<br />{formatDate(b.periodTo)}
                  </div>
                  <div className="hidden lg:block text-xs text-white/50">
                    {capexLines} CapEx · {opexLines} OpEx
                  </div>
                  <div className="hidden lg:block text-sm font-medium text-white">
                    ${b.totalApproved.toLocaleString()}
                  </div>
                  <div className="hidden lg:block"><StatusBadge status={b.status} /></div>
                  <div className="hidden lg:flex items-center gap-2">
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
        )}
      </div>
    </div>
  )
}
