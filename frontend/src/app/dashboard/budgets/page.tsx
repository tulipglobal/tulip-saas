'use client'

import { useState, useEffect } from 'react'
import { apiGet } from '@/lib/api'
import Link from 'next/link'
import { BarChart3, Plus, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'

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
  totalFunded: number
  spent: number
  project: { id: string; name: string } | null
  fundingSources: { id: string; amount: number }[]
  _count: { fundingAgreements: number; expenses: number }
}

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

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function BudgetsPage() {
  const t = useTranslations()
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
          <h1 className="text-2xl font-bold text-[var(--tulip-forest)]" style={{ fontFamily: 'Inter, sans-serif' }}>{t('budgets.title')}</h1>
          <p className="text-[var(--tulip-forest)]/60 text-sm mt-1">{budgets.length} budget{budgets.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/dashboard/budgets/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[var(--tulip-forest)] self-start bg-[var(--tulip-gold)] hover:bg-[var(--tulip-orange)] transition-all">
          <Plus size={16} /> {t('budgets.new')}
        </Link>
      </div>

      {filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: t('budgets.totalBudgeted'), value: `$${totalBudgeted.toLocaleString()}` },
            { label: t('budgets.totalSpent'), value: `$${totalSpent.toLocaleString()}` },
            { label: t('budgets.utilisation'), value: totalBudgeted > 0 ? `${Math.round((totalSpent / totalBudgeted) * 100)}%` : '0%' },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-[var(--tulip-sage-dark)] px-5 py-4"
              style={{ background: 'var(--tulip-sage)' }}>
              <div className="text-xl font-bold text-[var(--tulip-forest)]" style={{ fontFamily: 'Inter, sans-serif' }}>{value}</div>
              <div className="text-xs text-[var(--tulip-forest)]/60 mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-4 py-2.5 max-w-sm">
        <Search size={15} className="text-[var(--tulip-forest)]/40" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t('budgets.searchBudgets')} className="bg-transparent text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none w-full" />
      </div>

      <div className="rounded-xl border border-[var(--tulip-sage-dark)] overflow-hidden"
        style={{ background: 'var(--tulip-sage)' }}>
        <div className="hidden lg:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1.5fr] gap-4 px-5 py-3 border-b border-[var(--tulip-sage-dark)] text-xs text-[var(--tulip-forest)]/40 uppercase tracking-wide font-medium">
          <span>{t('budgets.budget')}</span><span>{t('budgets.period')}</span><span>{t('budgets.lines')}</span><span>{t('budgets.amount')}</span><span>{t('budgets.status')}</span><span>{t('budgets.progress')}</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-[var(--tulip-forest)]/40 text-sm">{t('common.loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <BarChart3 size={32} className="text-[var(--tulip-forest)]/30" />
            <p className="text-[var(--tulip-forest)]/40 text-sm">{t('budgets.noBudgets')}</p>
            <Link href="/dashboard/budgets/new" className="text-[var(--tulip-forest)] text-sm hover:underline">{t('budgets.createFirst')}</Link>
          </div>
        ) : (
          <div className="divide-y divide-[var(--tulip-sage-dark)]">
            {filtered.map(b => {
              const pct = b.totalApproved > 0 ? Math.min(100, Math.round((b.spent / b.totalApproved) * 100)) : 0
              const capexLines = b.lines.filter(l => l.expenseType === 'CAPEX').length
              const opexLines = b.lines.filter(l => l.expenseType === 'OPEX').length
              return (
                <div key={b.id} className="px-4 py-3.5 hover:bg-[var(--tulip-sage)]/50 transition-colors lg:grid lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_1.5fr] lg:gap-4 lg:items-center lg:px-5">
                  <div>
                    <Link href={`/dashboard/budgets/${b.id}`} className="text-sm font-medium text-[var(--tulip-forest)] hover:text-cyan-400 transition-colors">
                      {b.name}
                    </Link>
                    <div className="text-xs text-[var(--tulip-forest)]/40 mt-0.5">
                      {b.project && <><Link href={`/dashboard/projects/${b.project.id}`} className="text-cyan-400/60 hover:text-cyan-400">{b.project.name}</Link> · </>}
                      {b._count.fundingAgreements} funding source{b._count.fundingAgreements !== 1 ? 's' : ''} · {b._count.expenses} expense{b._count.expenses !== 1 ? 's' : ''}
                    </div>
                    {/* Mobile meta */}
                    <div className="flex flex-wrap items-center gap-2 mt-2 lg:hidden">
                      <StatusBadge status={b.status} />
                      <span className="text-xs text-[var(--tulip-forest)]/60">{formatDate(b.periodFrom)} – {formatDate(b.periodTo)}</span>
                      <span className="text-sm font-medium text-[var(--tulip-forest)]">${b.totalApproved.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2 lg:hidden">
                      <div className="flex-1 h-1.5 rounded-full bg-[var(--tulip-sage)] overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{
                          width: `${pct}%`,
                          background: pct > 90 ? '#f87171' : pct > 70 ? '#fbbf24' : '#34d399'
                        }} />
                      </div>
                      <span className="text-xs text-[var(--tulip-forest)]/60 w-8 text-right">{pct}%</span>
                    </div>
                  </div>
                  <div className="hidden lg:block text-xs text-[var(--tulip-forest)]/60">
                    {formatDate(b.periodFrom)}<br />{formatDate(b.periodTo)}
                  </div>
                  <div className="hidden lg:block text-xs text-[var(--tulip-forest)]/60">
                    {capexLines} CapEx · {opexLines} OpEx
                  </div>
                  <div className="hidden lg:block text-sm font-medium text-[var(--tulip-forest)]">
                    ${b.totalApproved.toLocaleString()}
                  </div>
                  <div className="hidden lg:block"><StatusBadge status={b.status} /></div>
                  <div className="hidden lg:flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-[var(--tulip-sage)] overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{
                        width: `${pct}%`,
                        background: pct > 90 ? '#f87171' : pct > 70 ? '#fbbf24' : '#34d399'
                      }} />
                    </div>
                    <span className="text-xs text-[var(--tulip-forest)]/60 w-8 text-right">{pct}%</span>
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
