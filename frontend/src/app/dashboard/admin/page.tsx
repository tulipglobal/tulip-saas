'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPatch, apiPost, apiDelete } from '@/lib/api'
import { useRouter } from 'next/navigation'
import {
  Shield, Users, FileCheck, ShieldCheck, TrendingUp, Search,
  Flame, Clock, ArrowUpRight, BarChart3, Headphones, BookOpen,
  ChevronDown, ChevronRight, Send, MessageSquare, Plus, Pencil,
  Trash2, Eye, EyeOff, Star, StarOff, X
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

interface TicketMessage {
  id: string
  userId: string
  userName: string
  message: string
  isInternal: boolean
  createdAt: string
}

interface SupportTicket {
  id: string
  tenantId: string
  tenantName: string
  userName: string
  userEmail: string
  subject: string
  category: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  createdAt: string
  updatedAt: string
  messages: TicketMessage[]
}

interface KBArticle {
  id: string
  title: string
  slug: string
  category: string
  categoryId?: string
  targetRole: 'ngo' | 'donor' | 'both'
  content: string
  published: boolean
  featured: boolean
  views: number
  createdAt: string
  updatedAt: string
}

interface KBCategory {
  id: string
  name: string
  slug: string
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

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-400/15 text-gray-400',
  medium: 'bg-blue-400/15 text-blue-400',
  high: 'bg-orange-400/15 text-orange-400',
  urgent: 'bg-red-400/15 text-red-400',
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-green-400/15 text-green-400',
  in_progress: 'bg-yellow-400/15 text-yellow-400',
  resolved: 'bg-blue-400/15 text-blue-400',
  closed: 'bg-gray-400/15 text-gray-400',
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
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

  // Support Management state
  const [showSupport, setShowSupport] = useState(false)
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [ticketStatusFilter, setTicketStatusFilter] = useState('')
  const [ticketPriorityFilter, setTicketPriorityFilter] = useState('')
  const [ticketCategoryFilter, setTicketCategoryFilter] = useState('')
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)

  // Knowledge Base state
  const [showKB, setShowKB] = useState(false)
  const [kbArticles, setKBArticles] = useState<KBArticle[]>([])
  const [kbCategories, setKBCategories] = useState<KBCategory[]>([])
  const [kbModal, setKBModal] = useState<{ mode: 'create' | 'edit'; article?: KBArticle } | null>(null)
  const [kbForm, setKBForm] = useState({
    title: '', slug: '', categoryId: '', targetRole: 'both' as 'ngo' | 'donor' | 'both',
    content: '', published: false, featured: false,
  })

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

  // Fetch support tickets
  const fetchTickets = useCallback(async () => {
    if (!authorized || !showSupport) return
    const params = new URLSearchParams()
    if (ticketStatusFilter) params.set('status', ticketStatusFilter)
    if (ticketPriorityFilter) params.set('priority', ticketPriorityFilter)
    if (ticketCategoryFilter) params.set('category', ticketCategoryFilter)
    const r = await apiGet(`/api/admin/support/tickets?${params.toString()}`)
    if (r.ok) { const d = await r.json(); setTickets(d.data || d || []) }
  }, [authorized, showSupport, ticketStatusFilter, ticketPriorityFilter, ticketCategoryFilter])

  useEffect(() => { fetchTickets() }, [fetchTickets])

  // Fetch KB articles and categories
  const fetchKB = useCallback(async () => {
    if (!authorized || !showKB) return
    const [artR, catR] = await Promise.all([
      apiGet('/api/admin/kb/articles'),
      apiGet('/api/admin/kb/categories'),
    ])
    if (artR.ok) { const d = await artR.json(); setKBArticles(d.data || d || []) }
    if (catR.ok) { const d = await catR.json(); setKBCategories(d.data || d || []) }
  }, [authorized, showKB])

  useEffect(() => { fetchKB() }, [fetchKB])

  // Support actions
  async function handleTicketUpdate(ticketId: string, body: Record<string, unknown>) {
    const r = await apiPatch(`/api/admin/support/tickets/${ticketId}`, body)
    if (r.ok) fetchTickets()
  }

  async function handleSendReply(ticketId: string, isInternal: boolean) {
    if (!replyText.trim()) return
    await handleTicketUpdate(ticketId, { message: replyText.trim(), isInternal })
    setReplyText('')
    setReplyingTo(null)
  }

  // KB actions
  function openKBCreate() {
    setKBForm({ title: '', slug: '', categoryId: '', targetRole: 'both', content: '', published: false, featured: false })
    setKBModal({ mode: 'create' })
  }

  function openKBEdit(article: KBArticle) {
    setKBForm({
      title: article.title,
      slug: article.slug,
      categoryId: article.categoryId || '',
      targetRole: article.targetRole,
      content: article.content,
      published: article.published,
      featured: article.featured,
    })
    setKBModal({ mode: 'edit', article })
  }

  async function handleKBSave() {
    if (!kbModal) return
    const body = { ...kbForm }
    if (kbModal.mode === 'create') {
      await apiPost('/api/admin/kb/articles', body)
    } else if (kbModal.article) {
      await apiPatch(`/api/admin/kb/articles/${kbModal.article.id}`, body)
    }
    setKBModal(null)
    fetchKB()
  }

  async function handleKBDelete(id: string) {
    if (!confirm('Delete this article?')) return
    await apiDelete(`/api/admin/kb/articles/${id}`)
    fetchKB()
  }

  async function handleKBTogglePublish(article: KBArticle) {
    await apiPatch(`/api/admin/kb/articles/${article.id}`, { published: !article.published })
    fetchKB()
  }

  async function handleKBToggleFeatured(article: KBArticle) {
    await apiPatch(`/api/admin/kb/articles/${article.id}`, { featured: !article.featured })
    fetchKB()
  }

  function slugify(text: string) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  }

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

      {/* ───── Support Management Section ───── */}
      <div className="bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-xl">
        <button
          onClick={() => setShowSupport(v => !v)}
          className="w-full p-4 flex items-center gap-3 text-left hover:bg-white/[0.02] transition-colors"
        >
          {showSupport ? <ChevronDown size={16} className="text-[var(--tulip-forest)]/60" /> : <ChevronRight size={16} className="text-[var(--tulip-forest)]/60" />}
          <Headphones size={16} className="text-[var(--tulip-forest)]" />
          <h2 className="font-semibold text-[var(--tulip-forest)] flex-1">Support Tickets</h2>
          {tickets.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-400/15 text-orange-400">
              {tickets.filter(t => t.status === 'open').length} open
            </span>
          )}
        </button>

        {showSupport && (
          <div className="border-t border-[var(--tulip-sage-dark)]">
            {/* Filters */}
            <div className="p-4 flex flex-wrap gap-2 border-b border-[var(--tulip-sage-dark)]">
              <select
                value={ticketStatusFilter}
                onChange={e => setTicketStatusFilter(e.target.value)}
                className="bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-2 py-1.5 text-xs text-[var(--tulip-forest)] outline-none"
              >
                <option value="">All Statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
              <select
                value={ticketPriorityFilter}
                onChange={e => setTicketPriorityFilter(e.target.value)}
                className="bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-2 py-1.5 text-xs text-[var(--tulip-forest)] outline-none"
              >
                <option value="">All Priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
              <select
                value={ticketCategoryFilter}
                onChange={e => setTicketCategoryFilter(e.target.value)}
                className="bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-2 py-1.5 text-xs text-[var(--tulip-forest)] outline-none"
              >
                <option value="">All Categories</option>
                <option value="billing">Billing</option>
                <option value="technical">Technical</option>
                <option value="general">General</option>
                <option value="feature_request">Feature Request</option>
              </select>
            </div>

            {/* Tickets Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--tulip-sage-dark)] text-[var(--tulip-forest)]/40 uppercase">
                    <th className="text-left px-4 py-3 font-medium">Tenant</th>
                    <th className="text-left px-4 py-3 font-medium">User</th>
                    <th className="text-left px-4 py-3 font-medium">Subject</th>
                    <th className="text-left px-4 py-3 font-medium">Category</th>
                    <th className="text-left px-4 py-3 font-medium">Priority</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Created</th>
                    <th className="text-left px-4 py-3 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {tickets.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-[var(--tulip-forest)]/40">No support tickets found</td></tr>
                  ) : tickets.map(ticket => (
                    <>
                      <tr
                        key={ticket.id}
                        onClick={() => setExpandedTicket(expandedTicket === ticket.id ? null : ticket.id)}
                        className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3 text-[var(--tulip-forest)] font-medium truncate max-w-[120px]">{ticket.tenantName}</td>
                        <td className="px-4 py-3 text-[var(--tulip-forest)]/60 truncate max-w-[120px]">{ticket.userName}</td>
                        <td className="px-4 py-3 text-[var(--tulip-forest)] truncate max-w-[200px]">{ticket.subject}</td>
                        <td className="px-4 py-3 text-[var(--tulip-forest)]/60 capitalize">{ticket.category?.replace('_', ' ')}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS.medium}`}>
                            {ticket.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLORS[ticket.status] || STATUS_COLORS.open}`}>
                            {STATUS_LABELS[ticket.status] || ticket.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[var(--tulip-forest)]/60">{timeAgo(ticket.createdAt)}</td>
                        <td className="px-4 py-3 text-[var(--tulip-forest)]/60">{timeAgo(ticket.updatedAt)}</td>
                      </tr>

                      {/* Expanded Ticket Detail */}
                      {expandedTicket === ticket.id && (
                        <tr key={`${ticket.id}-detail`}>
                          <td colSpan={8} className="px-4 py-4 bg-white/[0.02]">
                            <div className="space-y-4 max-w-3xl">
                              {/* Status & Priority Controls */}
                              <div className="flex flex-wrap gap-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-[var(--tulip-forest)]/40 uppercase font-medium">Status:</span>
                                  <select
                                    value={ticket.status}
                                    onChange={e => handleTicketUpdate(ticket.id, { status: e.target.value })}
                                    className="bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-2 py-1 text-xs text-[var(--tulip-forest)] outline-none"
                                  >
                                    <option value="open">Open</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="resolved">Resolved</option>
                                    <option value="closed">Closed</option>
                                  </select>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-[var(--tulip-forest)]/40 uppercase font-medium">Priority:</span>
                                  <select
                                    value={ticket.priority}
                                    onChange={e => handleTicketUpdate(ticket.id, { priority: e.target.value })}
                                    className="bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-2 py-1 text-xs text-[var(--tulip-forest)] outline-none"
                                  >
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                    <option value="urgent">Urgent</option>
                                  </select>
                                </div>
                              </div>

                              {/* Message Thread */}
                              <div className="space-y-2">
                                <span className="text-[10px] text-[var(--tulip-forest)]/40 uppercase font-medium">Thread</span>
                                {(ticket.messages || []).length === 0 ? (
                                  <p className="text-xs text-[var(--tulip-forest)]/40 italic">No messages yet</p>
                                ) : ticket.messages.map(msg => (
                                  <div
                                    key={msg.id}
                                    className={`rounded-lg p-3 text-xs ${
                                      msg.isInternal
                                        ? 'bg-yellow-400/10 border border-yellow-400/20'
                                        : 'bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)]'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-medium text-[var(--tulip-forest)]">{msg.userName}</span>
                                      {msg.isInternal && (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-yellow-400/15 text-yellow-400">Internal</span>
                                      )}
                                      <span className="text-[var(--tulip-forest)]/40 ml-auto">{timeAgo(msg.createdAt)}</span>
                                    </div>
                                    <p className="text-[var(--tulip-forest)]/70 whitespace-pre-wrap">{msg.message}</p>
                                  </div>
                                ))}
                              </div>

                              {/* Reply Area */}
                              <div className="space-y-2">
                                <textarea
                                  value={replyingTo === ticket.id ? replyText : ''}
                                  onFocus={() => setReplyingTo(ticket.id)}
                                  onChange={e => { setReplyingTo(ticket.id); setReplyText(e.target.value) }}
                                  placeholder="Type your reply..."
                                  rows={3}
                                  className="w-full bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-3 py-2 text-xs text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none resize-none"
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleSendReply(ticket.id, false)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--tulip-gold)] text-[var(--tulip-forest)] hover:opacity-90 transition-opacity"
                                  >
                                    <Send size={12} /> Send Reply
                                  </button>
                                  <button
                                    onClick={() => handleSendReply(ticket.id, true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-yellow-400/15 text-yellow-400 hover:bg-yellow-400/25 transition-colors"
                                  >
                                    <MessageSquare size={12} /> Add Internal Note
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ───── Knowledge Base Management Section ───── */}
      <div className="bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-xl">
        <button
          onClick={() => setShowKB(v => !v)}
          className="w-full p-4 flex items-center gap-3 text-left hover:bg-white/[0.02] transition-colors"
        >
          {showKB ? <ChevronDown size={16} className="text-[var(--tulip-forest)]/60" /> : <ChevronRight size={16} className="text-[var(--tulip-forest)]/60" />}
          <BookOpen size={16} className="text-[var(--tulip-forest)]" />
          <h2 className="font-semibold text-[var(--tulip-forest)] flex-1">KB Articles</h2>
          {kbArticles.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-400/15 text-blue-400">
              {kbArticles.filter(a => a.published).length} published
            </span>
          )}
        </button>

        {showKB && (
          <div className="border-t border-[var(--tulip-sage-dark)]">
            {/* Actions Bar */}
            <div className="p-4 flex items-center justify-between border-b border-[var(--tulip-sage-dark)]">
              <span className="text-xs text-[var(--tulip-forest)]/60">{kbArticles.length} article{kbArticles.length !== 1 ? 's' : ''}</span>
              <button
                onClick={openKBCreate}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--tulip-gold)] text-[var(--tulip-forest)] hover:opacity-90 transition-opacity"
              >
                <Plus size={12} /> New Article
              </button>
            </div>

            {/* Articles Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--tulip-sage-dark)] text-[var(--tulip-forest)]/40 uppercase">
                    <th className="text-left px-4 py-3 font-medium">Title</th>
                    <th className="text-left px-4 py-3 font-medium">Category</th>
                    <th className="text-left px-4 py-3 font-medium">Target</th>
                    <th className="text-left px-4 py-3 font-medium">Published</th>
                    <th className="text-left px-4 py-3 font-medium">Featured</th>
                    <th className="text-left px-4 py-3 font-medium">Views</th>
                    <th className="text-left px-4 py-3 font-medium">Updated</th>
                    <th className="text-left px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {kbArticles.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-[var(--tulip-forest)]/40">No articles found</td></tr>
                  ) : kbArticles.map(article => (
                    <tr key={article.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-[var(--tulip-forest)] font-medium truncate max-w-[200px]">{article.title}</td>
                      <td className="px-4 py-3 text-[var(--tulip-forest)]/60 capitalize">{article.category}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-400/15 text-purple-400 uppercase">
                          {article.targetRole}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleKBTogglePublish(article)}
                          className="flex items-center gap-1"
                          title={article.published ? 'Unpublish' : 'Publish'}
                        >
                          {article.published
                            ? <Eye size={14} className="text-green-400" />
                            : <EyeOff size={14} className="text-[var(--tulip-forest)]/30" />
                          }
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleKBToggleFeatured(article)}
                          className="flex items-center gap-1"
                          title={article.featured ? 'Unfeature' : 'Feature'}
                        >
                          {article.featured
                            ? <Star size={14} className="text-[var(--tulip-gold)]" />
                            : <StarOff size={14} className="text-[var(--tulip-forest)]/30" />
                          }
                        </button>
                      </td>
                      <td className="px-4 py-3 text-[var(--tulip-forest)] font-mono">{article.views}</td>
                      <td className="px-4 py-3 text-[var(--tulip-forest)]/60">{timeAgo(article.updatedAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openKBEdit(article)}
                            className="p-1 rounded hover:bg-white/[0.05] transition-colors"
                            title="Edit"
                          >
                            <Pencil size={13} className="text-[var(--tulip-forest)]/60" />
                          </button>
                          <button
                            onClick={() => handleKBDelete(article.id)}
                            className="p-1 rounded hover:bg-red-400/10 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={13} className="text-red-400/60" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ───── KB Article Modal ───── */}
      {kbModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[var(--tulip-cream)] border border-[var(--tulip-sage-dark)] rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-[var(--tulip-sage-dark)]">
              <h3 className="font-semibold text-[var(--tulip-forest)]">
                {kbModal.mode === 'create' ? 'New Article' : 'Edit Article'}
              </h3>
              <button onClick={() => setKBModal(null)} className="p-1 rounded hover:bg-[var(--tulip-sage)] transition-colors">
                <X size={16} className="text-[var(--tulip-forest)]/60" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-[10px] text-[var(--tulip-forest)]/60 uppercase font-medium mb-1">Title</label>
                <input
                  value={kbForm.title}
                  onChange={e => setKBForm(f => ({ ...f, title: e.target.value, slug: slugify(e.target.value) }))}
                  className="w-full bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-3 py-2 text-sm text-[var(--tulip-forest)] outline-none"
                  placeholder="Article title"
                />
              </div>

              {/* Slug */}
              <div>
                <label className="block text-[10px] text-[var(--tulip-forest)]/60 uppercase font-medium mb-1">Slug</label>
                <input
                  value={kbForm.slug}
                  onChange={e => setKBForm(f => ({ ...f, slug: e.target.value }))}
                  className="w-full bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-3 py-2 text-sm text-[var(--tulip-forest)]/70 outline-none font-mono"
                  placeholder="auto-generated-slug"
                />
              </div>

              {/* Category & Target Role Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-[var(--tulip-forest)]/60 uppercase font-medium mb-1">Category</label>
                  <select
                    value={kbForm.categoryId}
                    onChange={e => setKBForm(f => ({ ...f, categoryId: e.target.value }))}
                    className="w-full bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-3 py-2 text-sm text-[var(--tulip-forest)] outline-none"
                  >
                    <option value="">Select category</option>
                    {kbCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-[var(--tulip-forest)]/60 uppercase font-medium mb-1">Target Role</label>
                  <select
                    value={kbForm.targetRole}
                    onChange={e => setKBForm(f => ({ ...f, targetRole: e.target.value as 'ngo' | 'donor' | 'both' }))}
                    className="w-full bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-3 py-2 text-sm text-[var(--tulip-forest)] outline-none"
                  >
                    <option value="ngo">NGO</option>
                    <option value="donor">Donor</option>
                    <option value="both">Both</option>
                  </select>
                </div>
              </div>

              {/* Content */}
              <div>
                <label className="block text-[10px] text-[var(--tulip-forest)]/60 uppercase font-medium mb-1">Content (HTML)</label>
                <textarea
                  value={kbForm.content}
                  onChange={e => setKBForm(f => ({ ...f, content: e.target.value }))}
                  rows={10}
                  className="w-full bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-3 py-2 text-sm text-[var(--tulip-forest)] outline-none resize-none font-mono"
                  placeholder="<p>Article content...</p>"
                />
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={kbForm.published}
                    onChange={e => setKBForm(f => ({ ...f, published: e.target.checked }))}
                    className="rounded border-[var(--tulip-sage-dark)] accent-[var(--tulip-gold)]"
                  />
                  <span className="text-xs text-[var(--tulip-forest)]">Published</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={kbForm.featured}
                    onChange={e => setKBForm(f => ({ ...f, featured: e.target.checked }))}
                    className="rounded border-[var(--tulip-sage-dark)] accent-[var(--tulip-gold)]"
                  />
                  <span className="text-xs text-[var(--tulip-forest)]">Featured</span>
                </label>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 p-5 border-t border-[var(--tulip-sage-dark)]">
              <button
                onClick={() => setKBModal(null)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-[var(--tulip-forest)]/60 hover:bg-[var(--tulip-sage)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleKBSave}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-[var(--tulip-gold)] text-[var(--tulip-forest)] hover:opacity-90 transition-opacity"
              >
                {kbModal.mode === 'create' ? 'Create Article' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
