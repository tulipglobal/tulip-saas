'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { apiGet, apiPost } from '@/lib/api'
import { formatMoney } from '@/lib/currency'

// ── Date helpers ─────────────────────────────────────────────
function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return '—'
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function fmtDateShort(d: string | Date | null | undefined): string {
  if (!d) return '—'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return '—'
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function timeAgo(d: string | Date): string {
  const now = Date.now()
  const dt = new Date(d).getTime()
  const diff = Math.floor((now - dt) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return fmtDateShort(d)
}

// ── Interfaces ───────────────────────────────────────────────
interface Project {
  id: string; name: string; description?: string; budget: number; funded: number
  spent: number; expenseCount: number; sealCount: number; flagCount: number
  timePercent: number | null; financialPercent: number | null; completionPercent: number
  deliverablesPct: number | null; impactPct: number | null
  isOverdue: boolean; isClosed: boolean; hasEndDate: boolean
  startDate: string | null; endDate: string | null; status?: string; hasFunding?: boolean
}

interface TrustComponent { name: string; score: number; denominator: number }

interface NGO {
  tenantId: string; tenantName: string; projects: Project[]
  ngoCompletionPercent: number
  trustScore: number | null; trustGrade: string | null; trustComponents: TrustComponent[]
}

interface ActivityEvent {
  id: string; action: string; icon: string; description: string
  projectId: string | null; projectName: string; entityType: string
  entityId: string; expenseId: string | null; createdAt: string
}

// ── Colour helpers ───────────────────────────────────────────
function pctColor(pct: number): string {
  if (pct >= 70) return '#16A34A'
  if (pct >= 40) return '#F59E0B'
  return '#DC2626'
}

const iconMap: Record<string, { emoji: string; bg: string }> = {
  expense: { emoji: '\uD83D\uDCB0', bg: 'var(--donor-light)' },
  approved: { emoji: '\u2705', bg: '#DCFCE7' },
  document: { emoji: '\uD83D\uDCC4', bg: 'var(--donor-light)' },
  fraud: { emoji: '\u26A0\uFE0F', bg: '#FEF3E8' },
  blocked: { emoji: '\uD83D\uDEAB', bg: '#FEE2E2' },
  seal: { emoji: '\uD83D\uDD12', bg: 'var(--donor-light)' },
  activity: { emoji: '\uD83D\uDD18', bg: 'var(--donor-light)' },
}

// ── Half-circle gauge ────────────────────────────────────────
function HalfCircleGauge({ percent, size = 52 }: { percent: number; size?: number }) {
  const r = (size - 6) / 2
  const cx = size / 2
  const cy = size / 2 + 2
  const circumference = Math.PI * r
  // Minimum 2% visual arc so even 0% shows a tiny sliver
  const visualPct = Math.min(Math.max(percent, 0), 100)
  const filled = (Math.max(visualPct, 2) / 100) * circumference
  const color = pctColor(percent)
  return (
    <svg width={size} height={size / 2 + 6} viewBox={`0 0 ${size} ${size / 2 + 6}`} className="shrink-0">
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="var(--donor-border)" strokeWidth="4" strokeLinecap="round" />
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${filled} ${circumference}`} />
    </svg>
  )
}

// ── Skeleton components ──────────────────────────────────────
function SkeletonPulse({ className = '', style = {} }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton-pulse rounded ${className}`} style={{ background: 'var(--donor-border)', ...style }} />
}

function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <SkeletonPulse className="h-8 w-48" />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[1,2,3,4,5].map(i => <SkeletonPulse key={i} className="h-20 rounded-xl" />)}
      </div>
      <SkeletonPulse className="h-12 rounded-2xl" />
      {[1,2,3].map(i => <SkeletonPulse key={i} className="h-16 rounded-xl" />)}
      <SkeletonPulse className="h-10 rounded-2xl" />
      {[1,2,3,4,5].map(i => <SkeletonPulse key={i} className="h-12 rounded-xl" />)}
    </div>
  )
}

// ── Sparkline ────────────────────────────────────────────────
function Sparkline({ data, width = 80, height = 24 }: { data: number[]; width?: number; height?: number }) {
  if (!data || data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const trending = data[data.length - 1] < data[0] - 2 ? 'down' : 'up'
  const color = trending === 'down' ? '#B45309' : 'var(--donor-accent)'
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')
  const lastX = width
  const lastY = height - ((data[data.length - 1] - min) / range) * (height - 4) - 2
  return (
    <svg width={width} height={height} className="shrink-0" aria-label="8-week trend">
      <title>8-week trend</title>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="2.5" fill={color} />
    </svg>
  )
}

// ── Trust Score Breakdown ────────────────────────────────────
function TrustBreakdown({ ngo, onClose }: { ngo: NGO; onClose: () => void }) {
  const t = useTranslations()
  const [history, setHistory] = useState<Record<string, number[]> | null>(null)

  useEffect(() => {
    if (ngo.projects.length > 0) {
      apiGet(`/api/donor/projects/${ngo.projects[0].id}/trust-history`)
        .then(async r => { if (r.ok) { const d = await r.json(); setHistory(d.trustHistory) } })
        .catch(() => {})
    }
  }, [ngo])

  const keyMap: Record<string, string> = {
    'Seal Coverage': 'sealCoverage', 'Fraud Block Rate': 'fraudBlockRate',
    'Low Risk Rate': 'lowRiskRate', 'Approval Compliance': 'approvalCompliance',
    'OCR Match Rate': 'ocrMatchRate', 'Document Coverage': 'documentCoverage'
  }

  return (
    <div className="px-5 py-4 space-y-3 animate-fade-up border-t" style={{ background: 'var(--donor-light)', borderColor: 'var(--donor-border)' }}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold" style={{ color: 'var(--donor-dark)' }}>{t('trustBreakdown.title')} — {ngo.tenantName}</h4>
        <button onClick={onClose} className="text-xs hover:underline" style={{ color: 'var(--donor-muted)' }}>{t('trustBreakdown.close')}</button>
      </div>
      <div className="space-y-2">
        {ngo.trustComponents.map(c => (
          <div key={c.name} className="flex items-center gap-3 text-sm">
            <span className="w-40 shrink-0 font-medium" style={{ color: 'var(--donor-dark)' }}>{c.name}</span>
            <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--donor-border)' }}>
              <div className="h-full rounded-full" style={{ width: `${c.score}%`, background: pctColor(c.score) }} />
            </div>
            <span className="w-8 text-right text-xs font-bold" style={{ color: pctColor(c.score) }}>{c.score}</span>
            {history && keyMap[c.name] && history[keyMap[c.name]] && (
              <Sparkline data={history[keyMap[c.name]]} />
            )}
          </div>
        ))}
      </div>
      <div className="pt-2 border-t text-sm" style={{ borderColor: 'var(--donor-border)' }}>
        <span className="font-medium" style={{ color: 'var(--donor-muted)' }}>{t('trustBreakdown.overall')}: </span>
        <span className="font-bold" style={{ color: 'var(--donor-dark)' }}>{ngo.trustScore} · {ngo.trustGrade}</span>
      </div>
      <p className="text-xs italic" style={{ color: 'var(--donor-muted)' }}>{t('trustBreakdown.scoreDisclaimer')}</p>
    </div>
  )
}

// ── Completion Breakdown ─────────────────────────────────────
function CompletionBreakdown({ project, totalActiveProjects, onClose }: {
  project: Project; totalActiveProjects: number; onClose: () => void
}) {
  const t = useTranslations()
  return (
    <div className="rounded-xl border px-4 py-4 mt-2 space-y-3 animate-fade-up" style={{ background: 'var(--donor-light)', borderColor: 'var(--donor-border)' }}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold" style={{ color: 'var(--donor-dark)' }}>{project.name}</h4>
        <button onClick={onClose} className="text-xs hover:underline" style={{ color: 'var(--donor-muted)' }}>{t('completionBreakdown.close')}</button>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex items-start gap-2">
          <span className="shrink-0 w-20 font-medium" style={{ color: 'var(--donor-muted)' }}>{t('completionBreakdown.timePercent')}</span>
          <span style={{ color: 'var(--donor-dark)' }}>
            {project.timePercent !== null ? (
              <>{project.timePercent.toFixed(1)}%<span className="text-xs ml-1" style={{ color: 'var(--donor-muted)' }}>({t('completionBreakdown.start')}: {fmtDateShort(project.startDate)} &rarr; {t('completionBreakdown.end')}: {fmtDateShort(project.endDate)}, {t('completionBreakdown.today')}: {fmtDateShort(new Date().toISOString())})</span></>
            ) : (
              <span className="text-xs italic" style={{ color: '#B45309' }}>{!project.hasEndDate ? t('completionBreakdown.noEndDate') : t('completionBreakdown.na')}</span>
            )}
          </span>
        </div>
        <div className="flex items-start gap-2">
          <span className="shrink-0 w-20 font-medium" style={{ color: 'var(--donor-muted)' }}>{t('completionBreakdown.financialPercent')}</span>
          <span style={{ color: 'var(--donor-dark)' }}>
            {project.financialPercent !== null ? (
              <>{project.financialPercent.toFixed(1)}%<span className="text-xs ml-1" style={{ color: 'var(--donor-muted)' }}>({t('completionBreakdown.spent')}: {formatMoney(project.spent || 0, 'USD')} {t('completionBreakdown.of')} {formatMoney(project.funded || 0, 'USD')} {t('completionBreakdown.fundedLabel')})</span></>
            ) : (
              <span className="text-xs italic" style={{ color: 'var(--donor-muted)' }}>{t('completionBreakdown.noFundedAmount')}</span>
            )}
          </span>
        </div>
        <div className="flex items-start gap-2">
          <span className="shrink-0 w-20 font-medium" style={{ color: 'var(--donor-muted)' }}>{t('completionBreakdown.deliverables')}</span>
          <span style={{ color: 'var(--donor-dark)' }}>
            {project.deliverablesPct !== null && project.deliverablesPct !== undefined ? (
              <>{project.deliverablesPct.toFixed(1)}%<span className="text-xs ml-1" style={{ color: 'var(--donor-muted)' }}>({t('completionBreakdown.confirmedOfTotal')})</span></>
            ) : (
              <span className="text-xs italic" style={{ color: 'var(--donor-muted)' }}>{t('completionBreakdown.noDeliverableRequests')}</span>
            )}
          </span>
        </div>
        <div className="flex items-start gap-2">
          <span className="shrink-0 w-20 font-medium" style={{ color: 'var(--donor-muted)' }}>{t('completionBreakdown.impact')}</span>
          <span style={{ color: 'var(--donor-dark)' }}>
            {project.impactPct !== null && project.impactPct !== undefined ? (
              <>{project.impactPct.toFixed(1)}%<span className="text-xs ml-1" style={{ color: 'var(--donor-muted)' }}>({t('completionBreakdown.achievedOfTotal')})</span></>
            ) : (
              <span className="text-xs italic" style={{ color: 'var(--donor-muted)' }}>{t('completionBreakdown.noMilestones')}</span>
            )}
          </span>
        </div>
        <div className="flex items-start gap-2">
          <span className="shrink-0 w-20 font-medium" style={{ color: 'var(--donor-muted)' }}>{t('completionBreakdown.combinedPercent')}</span>
          <span className="font-bold" style={{ color: pctColor(project.completionPercent) }}>{project.completionPercent.toFixed(1)}%</span>
        </div>
        {!project.isClosed && (
          <div className="flex items-start gap-2">
            <span className="shrink-0 w-20 font-medium" style={{ color: 'var(--donor-muted)' }}>{t('completionBreakdown.contributes')}</span>
            <span className="text-xs" style={{ color: 'var(--donor-dark)' }}>{`1 ${t('completionBreakdown.of')} ${totalActiveProjects} active project${totalActiveProjects !== 1 ? 's' : ''} in NGO average`}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── NGO Detail Panel ─────────────────────────────────────────
function NgoDetailPanel({ ngo, onClose }: { ngo: NGO; onClose: () => void }) {
  const t = useTranslations()
  const activeProjects = ngo.projects.filter(p => !p.isClosed)
  const totalFunded = ngo.projects.reduce((s, p) => s + (p.funded || 0), 0)
  const totalSpent = ngo.projects.reduce((s, p) => s + (p.spent || 0), 0)
  return (
    <div className="px-5 py-4 space-y-3 animate-fade-up border-t" style={{ background: 'var(--donor-light)', borderColor: 'var(--donor-border)' }}>
      <div className="flex items-center justify-between">
        <h4 className="text-base font-bold" style={{ color: 'var(--donor-dark)' }}>{ngo.tenantName}</h4>
        <button onClick={onClose} className="text-xs hover:underline" style={{ color: 'var(--donor-muted)' }}>{t('ngoDetail.close')}</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div><span style={{ color: 'var(--donor-muted)' }}>{t('ngoDetail.totalFunded')}</span><p className="font-bold" style={{ color: 'var(--donor-dark)' }}>{formatMoney(totalFunded, 'USD')}</p></div>
        <div><span style={{ color: 'var(--donor-muted)' }}>{t('ngoDetail.totalSpent')}</span><p className="font-bold" style={{ color: 'var(--donor-dark)' }}>{formatMoney(totalSpent, 'USD')}</p></div>
        <div><span style={{ color: 'var(--donor-muted)' }}>{t('ngoDetail.activeProjects')}</span><p className="font-bold" style={{ color: 'var(--donor-dark)' }}>{activeProjects.length}</p></div>
        <div>
          <span style={{ color: 'var(--donor-muted)' }}>{t('ngoDetail.completion')}</span>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--donor-border)' }}>
              <div className="h-full rounded-full" style={{ width: `${Math.max(Math.min(ngo.ngoCompletionPercent, 100), 2)}%`, background: pctColor(ngo.ngoCompletionPercent) }} />
            </div>
            <span className="text-xs font-bold" style={{ color: pctColor(ngo.ngoCompletionPercent) }}>{ngo.ngoCompletionPercent.toFixed(1)}%</span>
          </div>
        </div>
      </div>
      {ngo.trustScore !== null && (
        <div className="flex items-center gap-2 text-sm">
          <span style={{ color: 'var(--donor-muted)' }}>{t('ngoDetail.trustScore')}:</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: 'var(--donor-accent)' }}>{ngo.trustScore} · {ngo.trustGrade}</span>
        </div>
      )}
      <div className="space-y-1 pt-2 border-t" style={{ borderColor: 'var(--donor-border)' }}>
        {ngo.projects.map(p => (
          <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center gap-3 text-sm py-1 hover:underline">
            <span className="flex-1 truncate font-medium" style={{ color: 'var(--donor-dark)' }}>{p.name}</span>
            {p.isClosed ? (
              <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">{t('dashboard.closed')}</span>
            ) : (
              <>
                <span className="text-xs font-bold" style={{ color: pctColor(p.completionPercent) }}>{p.completionPercent.toFixed(1)}%</span>
                {p.isOverdue && <span className="px-1 py-0 rounded text-[10px] font-bold bg-red-100 text-red-600">{t('dashboard.overdue')}</span>}
              </>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}

// ── Protected Panel (slide-in) ───────────────────────────────
function ProtectedPanel({ totalSeals, fraudPrevented, onClose }: { totalSeals: number; fraudPrevented: number; onClose: () => void }) {
  const t = useTranslations()
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handleClick(e: MouseEvent) { if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.3)' }}>
      <div ref={panelRef} className="w-full max-w-md bg-[var(--bg-card)] h-full overflow-y-auto shadow-2xl animate-slide-in-right">
        <div className="sticky top-0 bg-[var(--bg-card)] border-b px-6 py-4 flex items-center justify-between z-10" style={{ borderColor: 'var(--donor-border)' }}>
          <h2 className="text-lg font-bold" style={{ color: 'var(--donor-dark)' }}>{t('protectedPanel.title')}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 text-gray-500 text-lg">&times;</button>
        </div>
        <div className="p-6 space-y-5">
          <p className="text-sm" style={{ color: 'var(--donor-dark)' }}>{t('protectedPanel.description')}</p>
          <div className="rounded-xl border px-4 py-4 space-y-3" style={{ borderColor: 'var(--donor-border)' }}>
            <div className="flex justify-between text-sm"><span style={{ color: 'var(--donor-muted)' }}>{t('protectedPanel.fraudPrevented')}</span><span className="font-bold" style={{ color: '#16A34A' }}>{formatMoney(fraudPrevented, 'USD')}</span></div>
            <div className="flex justify-between text-sm"><span style={{ color: 'var(--donor-muted)' }}>{t('protectedPanel.totalSealsIssued')}</span><span className="font-bold" style={{ color: 'var(--donor-dark)' }}>{totalSeals.toLocaleString()}</span></div>
            <div className="flex justify-between text-sm"><span style={{ color: 'var(--donor-muted)' }}>{t('protectedPanel.blockchainNetwork')}</span><span className="font-bold" style={{ color: 'var(--donor-dark)' }}>Polygon</span></div>
          </div>
          <p className="text-sm" style={{ color: 'var(--donor-muted)' }}>{t('protectedPanel.verifyInfo')}</p>
          <a href="https://verify.sealayer.io" target="_blank" rel="noopener noreferrer"
            className="inline-block px-5 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ background: '#3C3489' }}>
            {t('protectedPanel.verifyDocument')} &rarr;
          </a>
        </div>
      </div>
    </div>
  )
}

// ── Feed filter types ────────────────────────────────────────
type FeedFilter = 'all' | 'seals' | 'flags' | 'review'
function matchesFilter(event: ActivityEvent, filter: FeedFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'seals') return event.action === 'SEAL_ANCHORED' || event.action === 'TRUST_SEAL_ISSUED'
  if (filter === 'flags') return event.action === 'FRAUD_RISK_SCORED' || event.action === 'EXPENSE_MISMATCH_FLAGGED' || event.action === 'EXPENSE_BLOCKED_FRAUD'
  if (filter === 'review') return event.action === 'EXPENSE_CREATED'
  return true
}

function eventLink(event: ActivityEvent): string {
  if (event.expenseId && event.projectId) return `/projects/${event.projectId}?expense=${event.expenseId}`
  if (event.projectId) return `/projects/${event.projectId}`
  return '/dashboard'
}

// ── Main Dashboard ───────────────────────────────────────────
export default function DashboardPage() {
  const t = useTranslations()
  const filterLabels: Record<FeedFilter, string> = { all: t('feedFilter.all'), seals: t('feedFilter.sealsOnly'), flags: t('feedFilter.flagsOnly'), review: t('feedFilter.underReviewOnly') }
  const [ngos, setNgos] = useState<NGO[]>([])
  const [fraudPrevented, setFraudPrevented] = useState(0)
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedProject, setExpandedProject] = useState<string | null>(null)
  const [expandedNgo, setExpandedNgo] = useState<string | null>(null)
  const [expandedTrust, setExpandedTrust] = useState<string | null>(null)
  const [showProtected, setShowProtected] = useState(false)
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('all')
  const [challengeCount, setChallengeCount] = useState({ open: 0, responded: 0, escalated: 0, total: 0 })
  const [onlineUsers, setOnlineUsers] = useState<Record<string, string[]>>({}) // tenantId -> userId[]
  const [expandedComparison, setExpandedComparison] = useState<string | null>(null)
  const projectListRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([
      apiGet('/api/donor/projects').then(r => r.ok ? r.json() : { ngos: [], fraudPrevented: 0 }),
      apiGet('/api/donor/activity').then(r => r.ok ? r.json() : { events: [] }).catch(() => ({ events: [] })),
    ]).then(([projectData, activityData]) => {
      setNgos(projectData.ngos || [])
      setFraudPrevented(projectData.fraudPrevented || 0)
      setEvents(activityData.events || [])
      setLoading(false)
    }).catch(() => setLoading(false))

    // Fetch online users
    const fetchOnline = () => {
      apiGet('/api/messenger/online-users')
        .then(async r => {
          if (r.ok) {
            const d = await r.json()
            setOnlineUsers(d.onlineByTenant || {})
          }
        })
        .catch(() => {})
    }
    fetchOnline()
    const onlineInterval = setInterval(fetchOnline, 30000)

    apiGet('/api/donor/challenges').then(async r => {
      if (r.ok) {
        const d = await r.json()
        const chs = d.challenges || []
        setChallengeCount({
          open: chs.filter((c: any) => c.status === 'OPEN').length,
          responded: chs.filter((c: any) => c.status === 'RESPONDED').length,
          escalated: chs.filter((c: any) => c.status === 'ESCALATED').length,
          total: chs.filter((c: any) => ['OPEN', 'ESCALATED'].includes(c.status)).length,
        })
      }
    }).catch(() => {})

    return () => clearInterval(onlineInterval)
  }, [])

  const toggleProject = useCallback((id: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    setExpandedProject(prev => prev === id ? null : id)
  }, [])

  const allProjects = ngos.flatMap(n => n.projects)
  const totalProjects = allProjects.length
  const totalSeals = allProjects.reduce((s, p) => s + (p.sealCount || 0), 0)
  const totalFlags = allProjects.reduce((s, p) => s + (p.flagCount || 0), 0)
  const underReview = allProjects.filter(p => p.flagCount > 0).length

  const handleCardClick = useCallback((card: string) => {
    if (card === 'projects') {
      projectListRef.current?.scrollIntoView({ behavior: 'smooth' })
      projectListRef.current?.classList.add('flash-highlight')
      setTimeout(() => projectListRef.current?.classList.remove('flash-highlight'), 1500)
    } else if (card === 'seals') { setFeedFilter('seals') }
    else if (card === 'flags') { setFeedFilter('flags') }
    else if (card === 'review') { setFeedFilter('review') }
    else if (card === 'protected') { setShowProtected(true) }
  }, [])

  const filteredEvents = events.filter(e => matchesFilter(e, feedFilter))

  if (loading) return <DashboardSkeleton />

  return (
    <div className="p-6 space-y-6 animate-fade-up max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="text-[13px]" style={{ color: 'var(--donor-muted)' }}>{t('dashboard.breadcrumbHome')}</div>

      <h1 className="text-2xl font-bold" style={{ color: 'var(--donor-dark)' }}>{t('dashboard.title')}</h1>

      {/* Stat cards — 6 clickable cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <ClickableCard label={t('dashboard.totalProjects')} value={String(totalProjects)} onClick={() => handleCardClick('projects')} />
        <ClickableCard label={t('dashboard.totalSeals')} value={String(totalSeals)} onClick={() => handleCardClick('seals')} />
        <ClickableCard label={t('dashboard.totalFlags')} value={String(totalFlags)} highlight={totalFlags > 0} onClick={() => handleCardClick('flags')} />
        <ClickableCard label={t('dashboard.underReview')} value={String(underReview)} onClick={() => handleCardClick('review')} />
        <ClickableCard label={t('dashboard.protectedBySealayer')} value={formatMoney(fraudPrevented, 'USD')} sub={t('dashboard.fraudPrevented')} color="#16A34A" onClick={() => handleCardClick('protected')} />
        <ClickableCard label={t('dashboard.myFlags')} value={String(challengeCount.total)} highlight={challengeCount.total > 0}
          sub={challengeCount.responded > 0 ? t('dashboard.ngoResponded') : challengeCount.total > 0 ? t('dashboard.awaitingResponse') : t('dashboard.allResolved')}
          onClick={() => handleCardClick('flags')} />
      </div>

      {/* Projects grouped by NGO */}
      <div ref={projectListRef}>
        {ngos.length === 0 ? (
          <div className="rounded-2xl border px-8 py-16 text-center" style={{ background: 'var(--donor-light)', borderColor: 'var(--donor-border)' }}>
            <p className="text-sm" style={{ color: 'var(--donor-muted)' }}>{t('dashboard.noProjects')}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {ngos.map(ngo => {
              const activeProjects = ngo.projects.filter(p => !p.isClosed)
              const isNgoExpanded = expandedNgo === ngo.tenantId
              const isTrustExpanded = expandedTrust === ngo.tenantId
              return (
                <div key={ngo.tenantId} className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
                  {/* NGO header */}
                  <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--donor-border)' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-8 rounded-full" style={{ background: 'var(--donor-accent)' }} />
                      {/* Online indicator */}
                      {(() => {
                        const isOnline = (onlineUsers[ngo.tenantId] || []).length > 0
                        return <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: isOnline ? '#16A34A' : '#D1D5DB' }} title={isOnline ? t('dashboard.online') : t('dashboard.offline')} />
                      })()}
                      <button onClick={() => setExpandedNgo(isNgoExpanded ? null : ngo.tenantId)}
                        className="flex items-center gap-2 hover:opacity-80 cursor-pointer" title="Click to see breakdown">
                        <span className="text-sm font-semibold" style={{ color: 'var(--donor-dark)' }}>{ngo.tenantName}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--donor-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                          style={{ transform: isNgoExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--donor-light)', color: 'var(--donor-accent)' }}>
                        {ngo.projects.length} project{ngo.projects.length !== 1 ? 's' : ''}
                      </span>
                      {/* Trust score badge */}
                      <button onClick={(e) => { e.stopPropagation(); setExpandedTrust(isTrustExpanded ? null : ngo.tenantId) }}
                        className="cursor-pointer" title="Click to see breakdown">
                        {ngo.trustScore !== null ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold text-white" style={{ background: 'var(--donor-accent)' }}>
                            &#10003; {ngo.trustScore} · {ngo.trustGrade}
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">{t('dashboard.noData')}</span>
                        )}
                      </button>
                    </div>
                    {/* NGO completion progress bar */}
                    {activeProjects.length > 0 && (
                      <button onClick={() => setExpandedNgo(isNgoExpanded ? null : ngo.tenantId)}
                        className="w-full mt-2 flex items-center gap-2 group cursor-pointer" title="Click to see breakdown">
                        <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--donor-border)' }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(Math.min(ngo.ngoCompletionPercent, 100), 2)}%`, background: pctColor(ngo.ngoCompletionPercent) }} />
                        </div>
                        <span className="text-xs font-bold shrink-0 group-hover:underline" style={{ color: pctColor(ngo.ngoCompletionPercent) }}>
                          {ngo.ngoCompletionPercent.toFixed(1)}%
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Trust score breakdown */}
                  {isTrustExpanded && ngo.trustScore !== null && (
                    <TrustBreakdown ngo={ngo} onClose={() => setExpandedTrust(null)} />
                  )}

                  {/* NGO detail panel */}
                  {isNgoExpanded && (
                    <NgoDetailPanel ngo={ngo} onClose={() => setExpandedNgo(null)} />
                  )}

                  {/* Project rows */}
                  <div className="divide-y" style={{ borderColor: 'var(--donor-border)' }}>
                    {ngo.projects.map(project => (
                      <div key={project.id}>
                        <div className="flex items-center justify-between px-5 py-4 hover:bg-[var(--donor-light)] transition-all group">
                          <Link href={`/projects/${project.id}`} className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate group-hover:underline" style={{ color: 'var(--donor-dark)' }}>{project.name}</p>
                            {project.description && <p className="text-xs truncate mt-0.5" style={{ color: 'var(--donor-muted)' }}>{project.description}</p>}
                            {!project.hasEndDate && !project.isClosed && (
                              <p className="text-xs mt-1 px-2 py-0.5 rounded inline-block" style={{ background: '#FEF3E8', color: '#B45309' }}>
                                {t('dashboard.endDateMissing')}
                              </p>
                            )}
                          </Link>
                          <div className="flex items-center gap-4 ml-4 shrink-0">
                            <button onClick={(e) => toggleProject(project.id, e)} className="flex flex-col items-center gap-0 hover:opacity-80 transition-opacity cursor-pointer" title="Click to see breakdown">
                              <HalfCircleGauge percent={project.completionPercent} />
                              <div className="flex items-center gap-1 -mt-0.5">
                                <span className="text-xs font-bold" style={{ color: pctColor(project.completionPercent) }}>{project.completionPercent.toFixed(1)}%</span>
                                {project.isOverdue && <span className="px-1 py-0 rounded text-[10px] font-bold bg-red-100 text-red-600">{t('dashboard.overdue')}</span>}
                                {project.isClosed && <span className="px-1 py-0 rounded text-[10px] font-medium bg-gray-100 text-gray-500">{t('dashboard.closed')}</span>}
                              </div>
                            </button>
                            <div className="text-right"><p className="text-xs" style={{ color: 'var(--donor-muted)' }}>{t('dashboard.budget')}</p><p className="text-sm font-medium" style={{ color: 'var(--donor-dark)' }}>{formatMoney(project.budget || 0, 'USD')}</p></div>
                            <div className="text-right"><p className="text-xs" style={{ color: 'var(--donor-muted)' }}>{t('dashboard.funded')}</p><p className="text-sm font-medium" style={{ color: project.hasFunding === false ? 'var(--donor-muted)' : 'var(--donor-dark)' }}>{project.hasFunding === false ? '\u2014' : formatMoney(project.funded || 0, 'USD')}</p></div>
                            <div className="text-center"><p className="text-xs" style={{ color: 'var(--donor-muted)' }}>{t('dashboard.expenses')}</p><p className="text-sm font-medium" style={{ color: 'var(--donor-dark)' }}>{project.expenseCount}</p></div>
                            <div className="text-center"><p className="text-xs" style={{ color: 'var(--donor-muted)' }}>{t('dashboard.seals')}</p><p className="text-sm font-medium" style={{ color: 'var(--donor-accent)' }}>{project.sealCount}</p></div>
                            {project.flagCount > 0 && <span className="px-2 py-1 rounded-full text-xs font-medium" style={{ background: '#FEF3E8', color: '#B45309' }}>{project.flagCount} flag{project.flagCount !== 1 ? 's' : ''}</span>}
                            <Link href={`/projects/${project.id}`}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--donor-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                            </Link>
                          </div>
                        </div>
                        {expandedProject === project.id && (
                          <div className="px-5 pb-4">
                            <CompletionBreakdown project={project} totalActiveProjects={activeProjects.length} onClose={() => setExpandedProject(null)} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* NGO Comparison */}
      {ngos.length >= 2 && (
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
          <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--donor-border)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--donor-dark)' }}>{t('dashboard.ngoComparison')}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--donor-light)' }}>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('dashboard.ngo')}</th>
                  <th className="text-center px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('dashboard.projects')}</th>
                  <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('dashboard.budget')}</th>
                  <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('dashboard.funded')}</th>
                  <th className="text-center px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('dashboard.completion')}</th>
                  <th className="text-center px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('dashboard.trust')}</th>
                </tr>
              </thead>
              <tbody>
                {ngos.map(ngo => {
                  const totalBudget = ngo.projects.reduce((s, p) => s + (p.budget || 0), 0)
                  const totalFunded = ngo.projects.reduce((s, p) => s + (p.funded || 0), 0)
                  const isExpanded = expandedComparison === ngo.tenantId
                  return (
                    <React.Fragment key={ngo.tenantId}>
                      <tr
                        className="border-t hover:bg-[var(--donor-light)] transition-all cursor-pointer"
                        style={{ borderColor: 'var(--donor-border)' }}
                        onClick={() => setExpandedComparison(isExpanded ? null : ngo.tenantId)}
                      >
                        <td className="px-4 py-3 font-medium" style={{ color: 'var(--donor-dark)' }}>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: (onlineUsers[ngo.tenantId] || []).length > 0 ? '#16A34A' : '#D1D5DB' }} />
                            {ngo.tenantName}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center" style={{ color: 'var(--donor-dark)' }}>{ngo.projects.length}</td>
                        <td className="px-4 py-3 text-right font-mono" style={{ color: 'var(--donor-dark)' }}>{formatMoney(totalBudget, 'USD')}</td>
                        <td className="px-4 py-3 text-right font-mono" style={{ color: 'var(--donor-dark)' }}>{formatMoney(totalFunded, 'USD')}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs font-bold" style={{ color: pctColor(ngo.ngoCompletionPercent) }}>{ngo.ngoCompletionPercent.toFixed(1)}%</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {ngo.trustScore !== null ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: 'var(--donor-accent)' }}>{ngo.trustScore}</span>
                          ) : (
                            <span className="text-xs" style={{ color: 'var(--donor-muted)' }}>--</span>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="px-4 py-2" style={{ background: 'var(--donor-light)' }}>
                            <div className="space-y-1">
                              {ngo.projects.map(p => (
                                <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center justify-between py-1.5 text-sm hover:underline">
                                  <span className="truncate font-medium" style={{ color: 'var(--donor-dark)' }}>{p.name}</span>
                                  <div className="flex items-center gap-3 shrink-0 ml-3">
                                    <span className="text-xs" style={{ color: 'var(--donor-muted)' }}>{formatMoney(p.budget || 0, 'USD')}</span>
                                    <span className="text-xs font-bold" style={{ color: pctColor(p.completionPercent) }}>{p.completionPercent.toFixed(1)}%</span>
                                    {p.isClosed && <span className="px-1 py-0 rounded text-[10px] bg-gray-100 text-gray-500">{t('dashboard.closed')}</span>}
                                  </div>
                                </Link>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Activity Feed */}
      {events.length > 0 && (
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
          <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--donor-border)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--donor-dark)' }}>{t('dashboard.recentActivity')}</h2>
          </div>
          {/* Active filter pill */}
          {feedFilter !== 'all' && (
            <div className="px-5 py-2 border-b" style={{ borderColor: 'var(--donor-border)' }}>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium" style={{ background: 'var(--donor-light)', color: 'var(--donor-accent)' }}>
                {t('dashboard.showing')}: {filterLabels[feedFilter]}
                <button onClick={() => setFeedFilter('all')} className="hover:opacity-70">&times;</button>
              </span>
            </div>
          )}
          <div className="divide-y" style={{ borderColor: 'var(--donor-border)' }}>
            {filteredEvents.length === 0 ? (
              <div className="px-5 py-6 text-center"><p className="text-sm" style={{ color: 'var(--donor-muted)' }}>{t('dashboard.noMatchingEvents')}</p></div>
            ) : filteredEvents.map(event => {
              const ic = iconMap[event.icon] || iconMap.activity
              const link = eventLink(event)
              return (
                <Link key={event.id} href={link} className="flex items-start gap-3 px-5 py-3 hover:bg-[#EEEDFE] transition-all cursor-pointer">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm" style={{ background: ic.bg }}>{ic.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm" style={{ color: 'var(--donor-dark)' }}>{event.description}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--donor-muted)' }} title={fmtDate(event.createdAt)}>
                      {event.projectName} &middot; {timeAgo(event.createdAt)}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Protected by Sealayer panel */}
      {showProtected && <ProtectedPanel totalSeals={totalSeals} fraudPrevented={fraudPrevented} onClose={() => setShowProtected(false)} />}
    </div>
  )
}

// ── Clickable stat card ──────────────────────────────────────
function ClickableCard({ label, value, highlight, sub, color, onClick }: {
  label: string; value: string; highlight?: boolean; sub?: string; color?: string; onClick: () => void
}) {
  return (
    <button onClick={onClick} title="Click to see breakdown"
      className="rounded-xl border px-4 py-4 text-left transition-all hover:shadow-[0_4px_12px_rgba(83,74,183,0.15)] cursor-pointer"
      style={{ background: 'var(--bg-card)', borderColor: highlight ? '#F59E0B' : color ? '#BBF7D0' : 'var(--donor-border)' }}>
      <p className="text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color: color || (highlight ? '#B45309' : 'var(--donor-dark)') }}>{value}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--donor-muted)' }}>{sub}</p>}
    </button>
  )
}
