'use client'

import { useState, useEffect } from 'react'
import { apiGet } from '@/lib/api'
import Link from 'next/link'
import { Banknote, Plus, Search, ExternalLink, TrendingUp } from 'lucide-react'

interface ProjectFunding {
  id: string
  allocatedAmount: number
  project: { id: string; name: string }
}

interface Agreement {
  id: string
  title: string
  type: string
  totalAmount: number
  currency: string
  status: string
  startDate: string | null
  endDate: string | null
  repayable: boolean
  interestRate: number | null
  createdAt: string
  sourceType: string | null
  sourceSubType: string | null
  capexBudget: number
  opexBudget: number
  restricted: boolean
  donor: { id: string; name: string; type: string } | null
  projectFunding: ProjectFunding[]
  spent: number
  _count: { expenses: number; repayments: number }
}

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    GRANT:     'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
    LOAN:      'bg-orange-400/10 text-orange-400 border-orange-400/20',
    EQUITY:    'bg-purple-400/10 text-purple-400 border-purple-400/20',
    DONATION:  'bg-cyan-400/10 text-cyan-400 border-cyan-400/20',
    IN_KIND:   'bg-pink-400/10 text-pink-400 border-pink-400/20',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium ${map[type] ?? 'bg-white/10 text-white/50 border-white/20'}`}>
      {type.replace('_', ' ')}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE:    'bg-green-400/10 text-green-400 border-green-400/20',
    DRAFT:     'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
    COMPLETED: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
    CANCELLED: 'bg-red-400/10 text-red-400 border-red-400/20',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium ${map[status] ?? map.DRAFT}`}>
      {status}
    </span>
  )
}

export default function FundingPage() {
  const [agreements, setAgreements] = useState<Agreement[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    apiGet('/api/funding-agreements?limit=50')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(d => { setAgreements(d.data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = agreements.filter(a =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    (a.donor?.name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const totalFunding = filtered.reduce((s, a) => s + a.totalAmount, 0)
  const totalSpent = filtered.reduce((s, a) => s + a.spent, 0)

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Funding</h1>
          <p className="text-white/40 text-sm mt-1">{agreements.length} funding agreement{agreements.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/dashboard/funding/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white self-start"
          style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
          <Plus size={16} /> New Agreement
        </Link>
      </div>

      {filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Total Funding', value: `$${totalFunding.toLocaleString()}` },
            { label: 'Total Spent', value: `$${totalSpent.toLocaleString()}` },
            { label: 'Utilisation', value: totalFunding > 0 ? `${Math.round((totalSpent / totalFunding) * 100)}%` : '0%' },
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
          placeholder="Search agreements or donors..." className="bg-transparent text-sm text-white/70 placeholder-white/30 outline-none w-full" />
      </div>

      <div className="rounded-xl border border-white/8 overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.02)' }}>
        {/* Desktop table header */}
        <div className="hidden lg:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1.5fr] gap-4 px-5 py-3 border-b border-white/8 text-xs text-white/30 uppercase tracking-wide font-medium">
          <span>Agreement</span><span>Donor</span><span>Type</span><span>Amount</span><span>Status</span><span>Progress</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-white/30 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <Banknote size={32} className="text-white/10" />
            <p className="text-white/30 text-sm">No funding agreements yet</p>
            <Link href="/dashboard/funding/new" className="text-[#369bff] text-sm hover:underline">Create your first agreement</Link>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.map(a => {
              const pct = a.totalAmount > 0 ? Math.min(100, Math.round((a.spent / a.totalAmount) * 100)) : 0
              return (
                <div key={a.id} className="px-4 py-3.5 hover:bg-white/2 transition-colors lg:grid lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_1.5fr] lg:gap-4 lg:items-center lg:px-5">
                  <div>
                    <Link href={`/dashboard/funding/${a.id}`} className="text-sm font-medium text-white/80 hover:text-cyan-400 transition-colors">
                      {a.title}
                    </Link>
                    <div className="text-xs text-white/30 mt-0.5">
                      {a.sourceType && <span className="text-white/40">{a.sourceType}{a.sourceSubType ? ` / ${a.sourceSubType}` : ''} · </span>}
                      {a.projectFunding.length} project{a.projectFunding.length !== 1 ? 's' : ''} · {a._count.expenses} expense{a._count.expenses !== 1 ? 's' : ''}
                      {a.restricted && <span className="ml-1 text-orange-400/60">· Restricted</span>}
                    </div>
                    {/* Mobile-only meta */}
                    <div className="flex flex-wrap items-center gap-2 mt-2 lg:hidden">
                      {a.donor?.name && <span className="text-xs text-white/50">{a.donor.name}</span>}
                      <TypeBadge type={a.type} />
                      <StatusBadge status={a.status} />
                      <span className="text-sm font-medium text-white">{a.currency} {a.totalAmount.toLocaleString()}</span>
                    </div>
                    {/* Mobile progress bar */}
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
                  <div className="hidden lg:block text-sm text-white/50 truncate">{a.donor?.name ?? '—'}</div>
                  <div className="hidden lg:block"><TypeBadge type={a.type} /></div>
                  <div className="hidden lg:block text-sm font-medium text-white">
                    {a.currency} {a.totalAmount.toLocaleString()}
                  </div>
                  <div className="hidden lg:block"><StatusBadge status={a.status} /></div>
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
