'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { apiGet } from '@/lib/api'
import {
  Shield, FolderOpen, DollarSign, Link2, FileText, Users,
  Receipt, ArrowUpRight, Sparkles, AlertTriangle, X,
  Upload, Clock, CheckCircle2, XCircle, ExternalLink
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

// ── Types ─────────────────────────────────────────────────────
interface OverviewData {
  user: { name: string; role: string }
  stats: {
    totalVerified: number
    totalFunding: number
    totalFundingCurrency: string
    activeProjects: number
    completedProjects: number
    totalBlockchainTx: number
    documentsThisMonth: number
    fundingAgreementsCount: number
  }
  projects: {
    id: string; name: string; status: string; budget: number
    totalFunding: number; totalExpenses: number
    startDate: string | null; endDate: string | null
  }[]
  activityFeed: {
    id: string; action: string; entityType: string
    createdAt: string; userName: string
    anchorStatus: string | null; blockchainTx: string | null
  }[]
  chartData: { month: string; documents: number; funding: number }[]
}

// ── Greeting helper ───────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// ── Animated counter hook ─────────────────────────────────────
function useCountUp(target: number, duration = 2000) {
  const [value, setValue] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    if (target === 0 || started.current) return
    started.current = true
    const startTime = Date.now()
    const tick = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, duration])

  return value
}

// ── Format currency ───────────────────────────────────────────
function formatAmount(amount: number, currency: string) {
  if (amount >= 1_000_000) return `${currency} ${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `${currency} ${(amount / 1_000).toFixed(0)}K`
  return `${currency} ${amount.toLocaleString()}`
}

// ── Time ago ──────────────────────────────────────────────────
function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

// ── Action description ────────────────────────────────────────
function actionLabel(action: string, entityType: string) {
  const map: Record<string, string> = {
    DOCUMENT_UPLOADED: 'uploaded a document',
    EXPENSE_CREATED: 'logged an expense',
    BATCH_ANCHORED: 'anchored records',
    WORKFLOW_TASK_CREATED: 'submitted for review',
    WORKFLOW_TASK_APPROVED: 'approved a task',
    WORKFLOW_TASK_REJECTED: 'rejected a task',
  }
  return map[action] || `${action.toLowerCase().replace(/_/g, ' ')} (${entityType})`
}

// ── Action icon ───────────────────────────────────────────────
function ActionIcon({ action }: { action: string }) {
  if (action.includes('DOCUMENT')) return <Upload size={14} className="text-emerald-400" />
  if (action.includes('EXPENSE')) return <Receipt size={14} className="text-amber-400" />
  if (action.includes('ANCHOR') || action.includes('BATCH')) return <Link2 size={14} className="text-[#369bff]" />
  if (action.includes('APPROVED')) return <CheckCircle2 size={14} className="text-emerald-400" />
  if (action.includes('REJECTED')) return <XCircle size={14} className="text-rose-400" />
  return <Clock size={14} className="text-gray-500" />
}

// ── Progress bar color ────────────────────────────────────────
function progressColor(pct: number) {
  if (pct > 90) return '#F43F5E' // rose
  if (pct > 70) return '#F59E0B' // amber
  return '#10B981' // emerald
}

// ── Tooltip wrapper for recharts v3 ───────────────────────────
function tooltipLabelFormatter(label: any) {
  return String(label)
}

// ── Expiry alerts banner ──────────────────────────────────────
function ExpiryAlertsBanner() {
  const [count, setCount] = useState(0)
  const [urgent, setUrgent] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    apiGet('/api/documents/expiring').then(r => r.ok ? r.json() : null).then(data => {
      if (!data?.data?.length) return
      setCount(data.data.length)
      const now = new Date()
      setUrgent(data.data.some((d: { expiryDate: string }) => {
        return Math.ceil((new Date(d.expiryDate).getTime() - now.getTime()) / 86400000) <= 7
      }))
    }).catch(() => {})
  }, [])

  if (count === 0 || dismissed) return null

  return (
    <div className={`rounded-xl border p-4 flex items-center gap-4 ${urgent ? 'border-rose-500/20' : 'border-amber-500/20'}`}
      style={{ background: urgent ? 'rgba(244,63,94,0.06)' : 'rgba(245,158,11,0.06)' }}>
      <AlertTriangle size={20} className={urgent ? 'text-rose-400 shrink-0' : 'text-amber-400 shrink-0'} />
      <div className="flex-1">
        <div className="text-sm font-medium text-gray-900">
          {count} document{count !== 1 ? 's' : ''} expiring soon
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          {urgent ? 'Some expire within 7 days' : 'Expiring within 30 days'}
        </div>
      </div>
      <Link href="/dashboard/documents?filter=expiring"
        className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-900 shrink-0"
        style={{ background: urgent ? '#F43F5E' : '#F59E0B' }}>
        View
      </Link>
      <button onClick={() => setDismissed(true)} className="text-gray-400 hover:text-gray-600 shrink-0"><X size={16} /></button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function DashboardPage() {
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [trial, setTrial] = useState<{ active: boolean; daysLeft: number; plan: string } | null>(null)

  useEffect(() => {
    apiGet('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => {
      if (d) setTrial({ active: d.trialActive, daysLeft: d.trialDaysLeft, plan: d.plan })
    }).catch(() => {})

    apiGet('/api/overview')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const s = data?.stats
  const verifiedCount = useCountUp(s?.totalVerified ?? 0)
  const blockchainCount = useCountUp(s?.totalBlockchainTx ?? 0, 2500)
  const fundingCount = useCountUp(s?.totalFunding ?? 0, 1800)
  const projectCount = useCountUp(s?.activeProjects ?? 0, 800)

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-up">

      {/* ── HERO GREETING ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Syne, sans-serif' }}>
            {getGreeting()}, {data?.user?.name?.split(' ')[0] ?? 'there'} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Here&apos;s your organisation&apos;s impact today — {today}
          </p>
        </div>
        <Link href="/verify" target="_blank"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-emerald-400 border border-emerald-400/30 hover:bg-emerald-400/10 transition-all self-start">
          <ExternalLink size={14} />
          Public Verifier
        </Link>
      </div>

      {/* ── TRIAL BANNERS ──────────────────────────────────── */}
      {trial?.active && trial.plan === 'FREE' && (
        <div className="rounded-xl border p-4 flex items-center gap-4"
          style={{ background: 'rgba(12,122,237,0.06)', borderColor: 'rgba(12,122,237,0.2)' }}>
          <Sparkles size={20} className="text-[#369bff] shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900">{trial.daysLeft} day{trial.daysLeft !== 1 ? 's' : ''} left in your free trial</div>
            <div className="text-xs text-gray-500 mt-0.5">Upgrade to unlock more features</div>
          </div>
          <Link href="/dashboard/billing" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-900 shrink-0"
            style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>Upgrade</Link>
        </div>
      )}
      {trial && !trial.active && trial.plan === 'FREE' && (
        <div className="rounded-xl border p-4 flex items-center gap-4"
          style={{ background: 'rgba(244,63,94,0.06)', borderColor: 'rgba(244,63,94,0.2)' }}>
          <AlertTriangle size={20} className="text-rose-400 shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900">Your free trial has expired</div>
            <div className="text-xs text-gray-500 mt-0.5">Upgrade to continue using all features</div>
          </div>
          <Link href="/dashboard/billing" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-900 shrink-0"
            style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>Upgrade Now</Link>
        </div>
      )}

      <ExpiryAlertsBanner />

      {/* ── HERO STAT CARDS ────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Documents Verified */}
        <div className="rounded-xl border border-gray-200 p-5 flex items-start gap-4" style={{ background: '#FFFFFF' }}>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-emerald-500/10 text-emerald-400">
            <Shield size={18} />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Syne, sans-serif' }}>{loading ? '…' : verifiedCount.toLocaleString()}</div>
            <div className="text-sm text-gray-500 mt-0.5">Blockchain Verified</div>
            <div className="text-xs text-emerald-400/60 mt-1">+{s?.documentsThisMonth ?? 0} this month</div>
          </div>
        </div>

        {/* Total Funding */}
        <div className="rounded-xl border border-gray-200 p-5 flex items-start gap-4" style={{ background: '#FFFFFF' }}>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-amber-500/10 text-amber-400">
            <DollarSign size={18} />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Syne, sans-serif' }}>
              {loading ? '…' : formatAmount(fundingCount, s?.totalFundingCurrency ?? 'USD')}
            </div>
            <div className="text-sm text-gray-500 mt-0.5">Funding Secured</div>
            <div className="text-xs text-amber-400/60 mt-1">across {s?.fundingAgreementsCount ?? 0} agreements</div>
          </div>
        </div>

        {/* Active Projects */}
        <div className="rounded-xl border border-gray-200 p-5 flex items-start gap-4" style={{ background: '#FFFFFF' }}>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-blue-500/10 text-blue-400">
            <FolderOpen size={18} />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Syne, sans-serif' }}>{loading ? '…' : projectCount}</div>
            <div className="text-sm text-gray-500 mt-0.5">Active Projects</div>
            <div className="text-xs text-blue-400/60 mt-1">{s?.completedProjects ?? 0} completed</div>
          </div>
        </div>

        {/* Blockchain Transactions */}
        <div className="rounded-xl border border-gray-200 p-5 flex items-start gap-4" style={{ background: '#FFFFFF' }}>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-emerald-500/10 text-emerald-400 relative">
            <Link2 size={18} />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping opacity-75" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Syne, sans-serif' }}>{loading ? '…' : blockchainCount.toLocaleString()}</div>
            <div className="text-sm text-gray-500 mt-0.5">Transactions on Polygon</div>
            <div className="text-xs text-emerald-400/60 mt-1">Immutable records</div>
          </div>
        </div>
      </div>

      {/* ── IMPACT SUMMARY CHART ───────────────────────────── */}
      <div className="rounded-xl border border-gray-200 p-5" style={{ background: '#FFFFFF' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-gray-900 text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>Organisation Activity</h2>
            <p className="text-xs text-gray-400 mt-0.5">Last 6 months</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Documents</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Funding</span>
          </div>
        </div>
        {loading || !data?.chartData?.length ? (
          <div className="h-52 flex items-center justify-center text-gray-300 text-sm">
            {loading ? 'Loading chart…' : 'No activity data yet'}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data.chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="emeraldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="amberGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                labelFormatter={tooltipLabelFormatter}
                contentStyle={{ background: '#0a1628', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 13, color: '#fff' }}
                itemStyle={{ color: '#fff' }}
                labelStyle={{ color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}
              />
              <Area type="monotone" dataKey="documents" name="Documents" stroke="#10B981" fill="url(#emeraldGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="funding" name="Funding" stroke="#F59E0B" fill="url(#amberGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── QUICK ACTIONS ──────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: FileText, label: 'Upload Document', href: '/dashboard/documents/new', color: 'text-emerald-400', bg: 'bg-emerald-500/10', hoverBorder: 'hover:border-emerald-400/30' },
          { icon: FolderOpen, label: 'New Project', href: '/dashboard/projects/new', color: 'text-blue-400', bg: 'bg-blue-500/10', hoverBorder: 'hover:border-blue-400/30' },
          { icon: Receipt, label: 'Add Expense', href: '/dashboard/expenses/new', color: 'text-amber-400', bg: 'bg-amber-500/10', hoverBorder: 'hover:border-amber-400/30' },
          { icon: Users, label: 'Invite Member', href: '/dashboard/team', color: 'text-rose-400', bg: 'bg-rose-500/10', hoverBorder: 'hover:border-rose-400/30' },
        ].map(({ icon: Icon, label, href, color, bg, hoverBorder }) => (
          <Link key={href} href={href}
            className={`flex flex-col items-center gap-2.5 p-5 rounded-xl border border-gray-200 ${hoverBorder} hover:bg-gray-50 transition-all group cursor-pointer`}
            style={{ background: '#FFFFFF' }}>
            <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
              <Icon size={20} className={color} />
            </div>
            <span className="text-sm font-medium text-gray-600 group-hover:text-gray-900 transition-colors text-center">{label}</span>
          </Link>
        ))}
      </div>

      {/* ── PROJECT HEALTH + ACTIVITY (side by side on desktop) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Projects (2/3 width) */}
        <div className="lg:col-span-2 space-y-4">
          <div>
            <h2 className="font-semibold text-gray-900 text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>Project Health</h2>
            <p className="text-xs text-gray-400 mt-0.5">Budget tracking</p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="rounded-xl border border-gray-200 h-40 animate-pulse" style={{ background: '#FFFFFF' }} />
              ))}
            </div>
          ) : !data?.projects?.length ? (
            <div className="rounded-xl border border-gray-200 flex flex-col items-center py-12 gap-3" style={{ background: '#FFFFFF' }}>
              <FolderOpen size={32} className="text-gray-300" />
              <p className="text-gray-400 text-sm">No active projects yet</p>
              <Link href="/dashboard/projects/new" className="text-emerald-400 text-sm hover:underline">Create your first project</Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.projects.map(project => {
                const budget = project.totalFunding || project.budget || 0
                const spent = project.totalExpenses
                const budgetPct = budget > 0 ? Math.min(Math.round((spent / budget) * 100), 100) : 0
                const completionPct = budgetPct

                return (
                  <Link key={project.id} href={`/dashboard/projects/${project.id}`}
                    className="rounded-xl border border-gray-200 p-4 hover:border-gray-200 hover:bg-gray-50 transition-all group cursor-pointer"
                    style={{ background: '#FFFFFF' }}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-800 group-hover:text-gray-900 transition-colors truncate pr-2">{project.name}</span>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border shrink-0 ${
                        project.status === 'active'
                          ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20'
                          : 'bg-amber-400/10 text-amber-400 border-amber-400/20'
                      }`}>
                        {project.status === 'active' ? 'Active' : project.status === 'on_hold' ? 'On Hold' : project.status}
                      </span>
                    </div>

                    {/* Budget used */}
                    <div className="mb-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-gray-400 uppercase tracking-wide">Budget Used</span>
                        <span className="text-xs text-gray-500">{budgetPct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-50 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${budgetPct}%`, background: progressColor(budgetPct) }} />
                      </div>
                      <div className="text-[11px] text-gray-400 mt-1">
                        {data.stats.totalFundingCurrency} {spent.toLocaleString()} of {data.stats.totalFundingCurrency} {budget.toLocaleString()}
                      </div>
                    </div>

                    {/* Completion badge */}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                      <span className="text-[11px] text-gray-400">Completion</span>
                      <span className="text-sm font-bold" style={{ color: progressColor(completionPct), fontFamily: 'Syne, sans-serif' }}>
                        {completionPct}%
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Activity feed (1/3 width) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900 text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>Recent Activity</h2>
              <p className="text-xs text-gray-400 mt-0.5">Latest events</p>
            </div>
            <Link href="/dashboard/audit" className="text-xs text-[#369bff] hover:underline">View all</Link>
          </div>

          <div className="rounded-xl border border-gray-200 overflow-hidden" style={{ background: '#FFFFFF' }}>
            {loading ? (
              <div className="p-6 text-center text-gray-300 text-sm">Loading…</div>
            ) : !data?.activityFeed?.length ? (
              <div className="p-6 text-center text-gray-300 text-sm">No activity yet</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {data.activityFeed.map(entry => (
                  <div key={entry.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 mt-0.5">
                      <ActionIcon action={entry.action} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-600">
                        <span className="font-medium text-gray-700">{entry.userName}</span>{' '}
                        {actionLabel(entry.action, entry.entityType)}
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5">{timeAgo(entry.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
