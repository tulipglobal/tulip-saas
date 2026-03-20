'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { apiGet, apiPost } from '@/lib/api'

function timeAgo(d: string | Date): string {
  const now = Date.now()
  const dt = new Date(d).getTime()
  const diff = Math.floor((now - dt) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return '—'
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
}

interface Challenge {
  id: string
  expenseId: string
  projectId: string
  donorOrgId: string
  status: string
  note: string
  createdAt: string
  updatedAt?: string
  expense?: { id: string; vendor: string; amount: number; currency: string; expenseDate?: string }
  project?: { id: string; name: string }
  responses?: { id: string; respondedByType: string; note: string; action: string; createdAt: string }[]
}

type FilterTab = 'active' | 'all' | 'OPEN' | 'RESPONDED' | 'ESCALATED' | 'CONFIRMED'

const filterKeys: FilterTab[] = ['active', 'all', 'OPEN', 'RESPONDED', 'ESCALATED', 'CONFIRMED']

const statusColors: Record<string, { bg: string; text: string }> = {
  OPEN: { bg: '#FEF3E8', text: '#B45309' },
  RESPONDED: { bg: 'var(--donor-light)', text: 'var(--donor-accent)' },
  ESCALATED: { bg: '#FEE2E2', text: '#DC2626' },
  CONFIRMED: { bg: '#DCFCE7', text: '#16A34A' },
}

export default function ChallengesPage() {
  const router = useRouter()
  const t = useTranslations()
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterTab>('active')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filterLabels: Record<FilterTab, string> = {
    active: t('challenges.active'),
    all: t('challenges.all'),
    OPEN: t('challenges.open'),
    RESPONDED: t('challenges.responded'),
    ESCALATED: t('challenges.escalated'),
    CONFIRMED: t('challenges.resolved'),
  }

  useEffect(() => {
    apiGet('/api/donor/challenges')
      .then(async r => {
        if (r.ok) {
          const d = await r.json()
          setChallenges(d.challenges || [])
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = challenges.filter(c => {
    if (filter === 'all') return true
    if (filter === 'active') return ['OPEN', 'ESCALATED'].includes(c.status)
    return c.status === filter
  })

  const counts = {
    active: challenges.filter(c => ['OPEN', 'ESCALATED'].includes(c.status)).length,
    all: challenges.length,
    OPEN: challenges.filter(c => c.status === 'OPEN').length,
    RESPONDED: challenges.filter(c => c.status === 'RESPONDED').length,
    ESCALATED: challenges.filter(c => c.status === 'ESCALATED').length,
    CONFIRMED: challenges.filter(c => c.status === 'CONFIRMED').length,
  }

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <div className="h-8 w-40 rounded-lg" style={{ background: 'var(--donor-border)' }} />
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 rounded-xl" style={{ background: 'var(--donor-border)' }} />
        ))}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 animate-fade-up">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--donor-dark)' }}>{t('challenges.title')}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--donor-muted)' }}>
          {t('challenges.subtitle')}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border px-4 py-3" style={{ background: '#FEF3E8', borderColor: '#F59E0B' }}>
          <p className="text-xs font-medium" style={{ color: '#B45309' }}>{t('challenges.open')}</p>
          <p className="text-xl font-bold" style={{ color: '#B45309' }}>{counts.OPEN}</p>
        </div>
        <div className="rounded-xl border px-4 py-3" style={{ background: 'var(--donor-light)', borderColor: 'var(--donor-border)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--donor-accent)' }}>{t('challenges.ngoResponded')}</p>
          <p className="text-xl font-bold" style={{ color: 'var(--donor-accent)' }}>{counts.RESPONDED}</p>
        </div>
        <div className="rounded-xl border px-4 py-3" style={{ background: '#FEE2E2', borderColor: '#FECACA' }}>
          <p className="text-xs font-medium" style={{ color: '#DC2626' }}>{t('challenges.escalated')}</p>
          <p className="text-xl font-bold" style={{ color: '#DC2626' }}>{counts.ESCALATED}</p>
        </div>
        <div className="rounded-xl border px-4 py-3" style={{ background: '#DCFCE7', borderColor: '#BBF7D0' }}>
          <p className="text-xs font-medium" style={{ color: '#16A34A' }}>{t('challenges.resolved')}</p>
          <p className="text-xl font-bold" style={{ color: '#16A34A' }}>{counts.CONFIRMED}</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {filterKeys.map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
            style={{
              background: filter === tab ? '#3C3489' : 'var(--donor-light)',
              color: filter === tab ? '#FFFFFF' : 'var(--donor-accent)',
            }}
          >
            {filterLabels[tab]} {counts[tab] > 0 ? `(${counts[tab]})` : ''}
          </button>
        ))}
      </div>

      {/* Challenges list */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border px-8 py-16 text-center" style={{ background: 'var(--donor-light)', borderColor: 'var(--donor-border)' }}>
          <p className="text-sm" style={{ color: 'var(--donor-muted)' }}>
            {filter === 'active' ? t('challenges.noActiveFlags') : t('challenges.noFlagsInCategory')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => {
            const sc = statusColors[c.status] || statusColors.OPEN
            const isExpanded = expandedId === c.id
            return (
              <div key={c.id} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--donor-border)', background: 'var(--bg-card)' }}>
                {/* Main row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}
                  className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-[var(--donor-light)] transition-all cursor-pointer"
                >
                  <span className="text-lg shrink-0">🚩</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold truncate" style={{ color: 'var(--donor-dark)' }}>
                        {c.expense?.vendor || t('challenges.unknownExpense')}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: sc.bg, color: sc.text }}>
                        {c.status}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--donor-muted)' }}>
                      {c.project?.name || t('challenges.unknownProject')}
                      {c.expense?.amount ? ` · ${c.expense.currency || 'USD'} ${c.expense.amount.toLocaleString()}` : ''}
                      {' · '}
                      <span title={fmtDate(c.createdAt)}>{timeAgo(c.createdAt)}</span>
                    </p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--donor-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-5 pb-4 space-y-3 animate-fade-up border-t" style={{ borderColor: 'var(--donor-border)' }}>
                    {/* Your note */}
                    <div className="mt-3">
                      <p className="text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>{t('challenges.yourNote')}</p>
                      <p className="text-sm mt-1 px-3 py-2 rounded-lg" style={{ background: 'var(--donor-light)', color: 'var(--donor-dark)' }}>{c.note}</p>
                    </div>

                    {/* Timeline */}
                    {c.responses && c.responses.length > 0 && (
                      <div>
                        <p className="text-xs font-medium mb-2" style={{ color: 'var(--donor-muted)' }}>{t('challenges.responseTimeline')}</p>
                        <div className="space-y-2">
                          {c.responses.map(r => (
                            <div key={r.id} className="flex gap-3 items-start">
                              <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs mt-0.5"
                                style={{ background: r.respondedByType === 'NGO' ? '#DCFCE7' : 'var(--donor-light)' }}>
                                {r.respondedByType === 'NGO' ? '🏢' : '👤'}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold" style={{ color: 'var(--donor-dark)' }}>
                                    {r.respondedByType === 'NGO' ? 'NGO' : 'You'}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: 'var(--donor-light)', color: 'var(--donor-accent)' }}>
                                    {r.action}
                                  </span>
                                  <span className="text-[10px]" style={{ color: 'var(--donor-muted)' }} title={fmtDate(r.createdAt)}>
                                    {timeAgo(r.createdAt)}
                                  </span>
                                </div>
                                <p className="text-sm mt-0.5" style={{ color: 'var(--donor-dark)' }}>{r.note}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Link
                        href={`/projects/${c.projectId}?expense=${c.expenseId}`}
                        className="px-4 py-2 rounded-lg text-xs font-medium text-white"
                        style={{ background: '#3C3489' }}
                      >
                        {t('challenges.viewExpense')} &rarr;
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
