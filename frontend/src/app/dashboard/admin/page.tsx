'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiGet } from '@/lib/api'
import { useRouter } from 'next/navigation'
import {
  Shield, Users, FileCheck, ShieldCheck, TrendingUp, Search,
  Flame, Clock, ArrowUpRight, BarChart3
} from 'lucide-react'
import { useTranslations } from 'next-intl'

interface Stats {
  totalTenants: number
  docsToday: number
  docsMonth: number
  activeSeals: number
  signupsThisWeek: number
  totalDocs: number
  totalBundles: number
}

interface Customer {
  id: string
  name: string
  email: string | null
  ownerName: string | null
  plan: string
  planStatus: string
  signupDate: string
  docsProcessed: number
  sealsIssued: number
  bundlesProcessed: number
  lastActive: string
  lastEventType: string | null
}

interface EngagementEvent {
  id: string
  tenantId: string
  tenantName: string
  tenantPlan: string
  eventType: string
  metadata: any
  createdAt: string
}

interface HotLead {
  id: string
  name: string
  email: string | null
  ownerName: string | null
  docsProcessed: number
  signupDate: string
}

const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  signup: { label: 'Signup', color: 'bg-green-400/15 text-green-400' },
  first_document: { label: 'First Doc', color: 'bg-[var(--tulip-gold)]/15 text-[var(--tulip-forest)]' },
  bundle_processed: { label: 'Bundle', color: 'bg-purple-400/15 text-purple-400' },
  seal_issued: { label: 'Seal', color: 'bg-cyan-400/15 text-cyan-400' },
  daily_active: { label: 'Active', color: 'bg-[var(--tulip-sage)] text-[var(--tulip-forest)]/60' },
  email_nudge_sent: { label: 'Nudge Email', color: 'bg-yellow-400/15 text-yellow-400' },
  email_upgrade_sent: { label: 'Upgrade Email', color: 'bg-orange-400/15 text-orange-400' },
  email_reengagement_sent: { label: 'Re-engage Email', color: 'bg-pink-400/15 text-pink-400' },
}

const PLAN_COLORS: Record<string, string> = {
  FREE: 'bg-gray-400/15 text-gray-400',
  STARTER: 'bg-[var(--tulip-gold)]/15 text-[var(--tulip-forest)]',
  PRO: 'bg-purple-400/15 text-purple-400',
  ENTERPRISE: 'bg-amber-400/15 text-amber-400',
}

export default function AdminPage() {
  const t = useTranslations('admin')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [events, setEvents] = useState<EngagementEvent[]>([])
  const [hotLeads, setHotLeads] = useState<HotLead[]>([])
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('')

  // Check superadmin access
  useEffect(() => {
    apiGet('/api/admin/check')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.isSuperadmin) {
          router.push('/dashboard')
          return
        }
        setAuthorized(true)
        setLoading(false)
      })
      .catch(() => router.push('/dashboard'))
  }, [router])

  const fetchData = useCallback(async () => {
    if (!authorized) return
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (planFilter) params.set('plan', planFilter)

    const [statsR, custR, eventsR, leadsR] = await Promise.all([
      apiGet('/api/admin/stats'),
      apiGet(`/api/admin/customers?${params.toString()}`),
      apiGet('/api/admin/engagement'),
      apiGet('/api/admin/hot-leads'),
    ])

    if (statsR.ok) setStats(await statsR.json())
    if (custR.ok) { const d = await custR.json(); setCustomers(d.data || []) }
    if (eventsR.ok) { const d = await eventsR.json(); setEvents(d.data || []) }
    if (leadsR.ok) { const d = await leadsR.json(); setHotLeads(d.data || []) }
  }, [authorized, search, planFilter])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading || !authorized) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[var(--tulip-gold)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--tulip-forest)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--tulip-gold)]">
            <Shield size={20} />
          </div>
          {t('title')}
        </h1>
        <p className="text-sm text-[var(--tulip-forest)]/60 mt-1">{t('subtitle')}</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {[
            { label: t('totalTenants'), value: stats.totalTenants, icon: Users },
            { label: t('docsToday'), value: stats.docsToday, icon: FileCheck },
            { label: t('docsThisMonth'), value: stats.docsMonth, icon: BarChart3 },
            { label: t('totalDocs'), value: stats.totalDocs, icon: FileCheck },
            { label: t('activeSeals'), value: stats.activeSeals, icon: ShieldCheck },
            { label: t('signupsThisWeek'), value: stats.signupsThisWeek, icon: TrendingUp },
            { label: t('totalBundles'), value: stats.totalBundles, icon: BarChart3 },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon size={14} className="text-[var(--tulip-forest)]" />
                <span className="text-[10px] text-[var(--tulip-forest)]/60 uppercase font-medium">{label}</span>
              </div>
              <div className="text-2xl font-bold text-[var(--tulip-forest)]">{value.toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Customers Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-xl">
            <div className="p-4 border-b border-[var(--tulip-sage-dark)]">
              <h2 className="font-semibold text-[var(--tulip-forest)] flex items-center gap-2 mb-3">
                <Users size={16} /> {t('customers')}
              </h2>
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-2 bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-3 py-1.5 flex-1 min-w-[180px]">
                  <Search size={12} className="text-[var(--tulip-forest)]/40" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('searchPlaceholder')}
                    className="bg-transparent text-xs text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none w-full" />
                </div>
                <select value={planFilter} onChange={e => setPlanFilter(e.target.value)}
                  className="bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-2 py-1.5 text-xs text-[var(--tulip-forest)] outline-none">
                  <option value="">{t('allPlans')}</option>
                  <option value="FREE">{t('free')}</option>
                  <option value="STARTER">{t('starter')}</option>
                  <option value="PRO">{t('pro')}</option>
                  <option value="ENTERPRISE">{t('enterprise')}</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--tulip-sage-dark)] text-[var(--tulip-forest)]/40 uppercase">
                    <th className="text-left px-4 py-3 font-medium">{t('organisation')}</th>
                    <th className="text-left px-4 py-3 font-medium">{tCommon('email')}</th>
                    <th className="text-left px-4 py-3 font-medium">{t('plan')}</th>
                    <th className="text-left px-4 py-3 font-medium">{t('docs')}</th>
                    <th className="text-left px-4 py-3 font-medium">{t('signup')}</th>
                    <th className="text-left px-4 py-3 font-medium">{t('lastActive')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {customers.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-[var(--tulip-forest)]/40">{t('noCustomers')}</td></tr>
                  ) : customers.map(c => (
                    <tr key={c.id} className="hover:bg-[var(--tulip-sage)] transition-colors">
                      <td className="px-4 py-3">
                        <div className="text-[var(--tulip-forest)] font-medium truncate max-w-[160px]">{c.name}</div>
                      </td>
                      <td className="px-4 py-3 text-[var(--tulip-forest)]/60 truncate max-w-[160px]">{c.email || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${PLAN_COLORS[c.plan] || PLAN_COLORS.FREE}`}>
                          {c.plan}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--tulip-forest)] font-mono">{c.docsProcessed}</td>
                      <td className="px-4 py-3 text-[var(--tulip-forest)]/60">{new Date(c.signupDate).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-[var(--tulip-forest)]/60">{timeAgo(c.lastActive)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Engagement Feed + Hot Leads */}
        <div className="space-y-6">
          {/* Hot Leads */}
          {hotLeads.length > 0 && (
            <div className="bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-xl">
              <div className="p-4 border-b border-[var(--tulip-sage-dark)]">
                <h2 className="font-semibold text-[var(--tulip-forest)] flex items-center gap-2">
                  <Flame size={16} className="text-orange-400" /> {t('hotLeads')}
                </h2>
                <p className="text-[10px] text-[var(--tulip-forest)]/40 mt-0.5">{t('hotLeadsDesc')}</p>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {hotLeads.slice(0, 10).map(lead => (
                  <div key={lead.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-400/10 flex items-center justify-center">
                      <ArrowUpRight size={14} className="text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-[var(--tulip-forest)] truncate">{lead.name}</div>
                      <div className="text-[10px] text-[var(--tulip-forest)]/60 truncate">{lead.email}</div>
                    </div>
                    <div className="text-xs font-bold text-orange-400">{t('docsCount', { count: lead.docsProcessed })}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Engagement Feed */}
          <div className="bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-xl">
            <div className="p-4 border-b border-[var(--tulip-sage-dark)]">
              <h2 className="font-semibold text-[var(--tulip-forest)] flex items-center gap-2">
                <Clock size={16} /> {t('recentEngagement')}
              </h2>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {events.length === 0 ? (
                <div className="px-4 py-8 text-center text-[var(--tulip-forest)]/40 text-xs">{t('noEngagement')}</div>
              ) : events.map(e => {
                const config = EVENT_LABELS[e.eventType] || { label: e.eventType, color: 'bg-[var(--tulip-sage)] text-[var(--tulip-forest)]/60' }
                return (
                  <div key={e.id} className="px-4 py-3 flex items-center gap-3">
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${config.color}`}>
                      {config.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-[var(--tulip-forest)]/70 truncate">{e.tenantName}</div>
                    </div>
                    <span className="text-[10px] text-[var(--tulip-forest)]/40 shrink-0">{timeAgo(e.createdAt)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
