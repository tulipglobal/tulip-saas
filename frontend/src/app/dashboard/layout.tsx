'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { apiGet } from '@/lib/api'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import {
  LayoutDashboard, FolderOpen, FileCheck, Receipt, Banknote,
  BarChart3, Settings, LogOut, CreditCard, Users,
  ChevronLeft, ChevronRight, Shield, Bell, Search, Menu, X, ListChecks, Flag, DollarSign, ArrowDownUp, MessageCircle, FileText, Coins, LifeBuoy, BookOpen
} from 'lucide-react'
import { clsx } from 'clsx'
import { useTranslations } from 'next-intl'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import ThemeToggle from '@/components/ThemeToggle'
import MessengerPanel, { useMessengerUnreadCount } from '@/components/MessengerPanel'
import SearchModal from '@/components/SearchModal'
import FloatingHelpButton from '@/components/FloatingHelpButton'

interface AuditEntry {
  id: string
  action: string
  entityType: string
  entityId: string
  projectName?: string | null
  createdAt: string
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDays = Math.floor(diffHr / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function actionLabel(action: string): string {
  return action
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, c => c.toUpperCase())
}

function entityRoute(entityType: string): string | null {
  switch (entityType) {
    case 'Expense': return '/dashboard/expenses'
    case 'Document': return '/dashboard/documents'
    case 'Project': return '/dashboard/projects'
    case 'FundingSource': return '/dashboard/funding'
    default: return null
  }
}

const navItems = [
  { key: 'dashboard',  href: '/dashboard',           icon: LayoutDashboard, fallback: 'Overview' },
  { key: 'projects',   href: '/dashboard/projects',  icon: FolderOpen },
  { key: 'budgets',    href: '/dashboard/budgets',   icon: BarChart3 },
  { key: 'funding',    href: '/dashboard/funding',   icon: Banknote },
  { key: 'documents',  href: '/dashboard/documents', icon: FileCheck },
  { key: 'expenses',   href: '/dashboard/expenses',  icon: Receipt },
  { key: 'auditLog',    href: '/dashboard/audit',     icon: Shield },
  { key: 'analytics',  href: '/dashboard/analytics', icon: BarChart3 },
  { key: 'reports',    href: '/dashboard/reports',   icon: FileText, fallback: 'Reports' },
  { key: 'approvals',  href: '/dashboard/workflow',  icon: ListChecks, fallback: 'Workflow' },
  { key: 'billing',     href: '/dashboard/billing',   icon: CreditCard },
  { key: 'team',        href: '/dashboard/team',      icon: Users },
  { key: 'donorFlags', href: '/dashboard/donor-flags', icon: Flag, fallback: 'Donor Flags' },
  { key: 'deliverables', href: '/dashboard/deliverables', icon: FileCheck, fallback: 'Deliverables' },
  { key: 'impact', href: '/dashboard/impact', icon: BarChart3, fallback: 'Impact' },
  { key: 'investments', href: '/dashboard/investments', icon: DollarSign, fallback: 'Investments' },
  { key: 'drawdowns', href: '/dashboard/drawdowns', icon: ArrowDownUp, fallback: 'Drawdowns' },
  { key: 'donors',     href: '/dashboard/settings/donors', icon: Users, fallback: 'Donors' },
  { key: 'currencyRates', href: '/dashboard/currency-rates', icon: Coins, fallback: 'Currency Rates' },
  { key: 'knowledgeBase', href: '/dashboard/knowledge-base', icon: BookOpen, fallback: 'Knowledge Base' },
  { key: 'support',    href: '/dashboard/support',   icon: LifeBuoy, fallback: 'Support' },
  { key: 'settings',   href: '/dashboard/settings',  icon: Settings },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [donorFlagCount, setDonorFlagCount] = useState(0)
  const [deliverableCount, setDeliverableCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState<AuditEntry[]>([])
  const [notifLoading, setNotifLoading] = useState(false)
  const [hasRecent, setHasRecent] = useState(false)
  const [messengerOpen, setMessengerOpen] = useState(false)
  const [messengerTarget, setMessengerTarget] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [userName, setUserName] = useState('NGO Admin')
  const [userEmail, setUserEmail] = useState('')
  const [userRole, setUserRole] = useState('Administrator')
  const profileRef = useRef<HTMLDivElement>(null)
  const messengerUnread = useMessengerUnreadCount()
  const notifPanelRef = useRef<HTMLDivElement>(null)
  const notifBtnRef = useRef<HTMLButtonElement>(null)
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations('nav')
  useOfflineSync() // mount globally — drains offline queue + pre-caches projects

  // Load user data from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('tulip_user')
      if (stored) {
        const u = JSON.parse(stored)
        if (u.name) setUserName(u.name)
        if (u.email) setUserEmail(u.email)
        if (u.role) setUserRole(u.role)
      }
    } catch {}
  }, [])

  // Close profile dropdown on outside click
  useEffect(() => {
    if (!profileOpen) return
    const handleClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [profileOpen])

  // Listen for open-messenger events from child pages (e.g. donors page)
  useEffect(() => {
    const handler = (e: CustomEvent<{ donorOrgId: string }>) => {
      setMessengerTarget(e.detail.donorOrgId)
      setMessengerOpen(true)
    }
    window.addEventListener('open-messenger' as any, handler as any)
    return () => window.removeEventListener('open-messenger' as any, handler as any)
  }, [])

  // Fetch workflow pending count + superadmin check
  useEffect(() => {
    apiGet('/api/workflow/summary')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setPendingCount((d.pending || 0) + (d.inReview || 0)) })
      .catch(() => {})
  }, [pathname])

  // Fetch donor flag count on mount and every 60 seconds
  useEffect(() => {
    const fetchFlagCount = () => {
      apiGet('/api/ngo/donor-challenges/count')
        .then(r => r.ok ? r.json() : { total: 0 })
        .then(d => setDonorFlagCount(d.total || 0))
        .catch(() => {})
    }
    fetchFlagCount()
    const interval = setInterval(fetchFlagCount, 60000)
    return () => clearInterval(interval)
  }, [])

  // Fetch deliverable count on mount and every 60 seconds
  useEffect(() => {
    const fetchDeliverableCount = () => {
      apiGet('/api/ngo/deliverables/count')
        .then(r => r.ok ? r.json() : { total: 0 })
        .then(d => setDeliverableCount((d.open || 0) + (d.rework || 0) + (d.overdue || 0)))
        .catch(() => {})
    }
    fetchDeliverableCount()
    const interval = setInterval(fetchDeliverableCount, 60000)
    return () => clearInterval(interval)
  }, [])

  // Close mobile sidebar on route change
  useEffect(() => { setMobileOpen(false) }, [pathname])

  // Close mobile sidebar on escape key + Cmd+K search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileOpen(false)
        setShowNotifications(false)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(prev => !prev)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Click outside to close notification panel
  useEffect(() => {
    if (!showNotifications) return
    const handleClick = (e: MouseEvent) => {
      if (
        notifPanelRef.current && !notifPanelRef.current.contains(e.target as Node) &&
        notifBtnRef.current && !notifBtnRef.current.contains(e.target as Node)
      ) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showNotifications])

  // Fetch notifications (audit logs)
  const fetchNotifications = useCallback(async () => {
    setNotifLoading(true)
    try {
      let res = await apiGet('/api/audit?limit=10')
      if (!res.ok) {
        res = await apiGet('/api/audit-logs?limit=10')
      }
      if (res.ok) {
        const json = await res.json()
        const entries: AuditEntry[] = json.data || json.logs || json || []
        setNotifications(Array.isArray(entries) ? entries.slice(0, 10) : [])
        // Check if any entry is within last 24h
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
        setHasRecent(entries.some((e: AuditEntry) => new Date(e.createdAt).getTime() > oneDayAgo))
      }
    } catch {
      // silently fail
    } finally {
      setNotifLoading(false)
    }
  }, [])

  // Fetch on mount to determine badge, and periodically
  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 120000) // every 2 min
    return () => clearInterval(interval)
  }, [fetchNotifications])

  const toggleNotifications = () => {
    setShowNotifications(prev => {
      if (!prev) fetchNotifications() // refresh when opening
      return !prev
    })
  }

  const handleNotifClick = (entry: AuditEntry) => {
    const route = entityRoute(entry.entityType)
    setShowNotifications(false)
    if (route) router.push(route)
  }

  const handleSignOut = async () => {
    try {
      const refreshToken = localStorage.getItem('tulip_refresh')
      const accessToken = localStorage.getItem('tulip_token')

      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ refreshToken }),
      })
    } catch {
      // continue even if logout call fails
    } finally {
      localStorage.removeItem('tulip_token')
      localStorage.removeItem('tulip_refresh')
      router.push('/login')
    }
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className={clsx(
        'flex items-center border-b border-[var(--tulip-cream)]/10 h-16 shrink-0',
        collapsed && !mobileOpen ? 'justify-center px-0' : 'px-5 gap-3'
      )}>
        <img src="/logo.svg" alt="sealayer" className={clsx('shrink-0 transition-all', collapsed && !mobileOpen ? 'h-10 w-10 object-contain' : 'h-14')} style={{ filter: 'brightness(0) invert(1)' }} />
        {/* Close button — mobile only */}
        {mobileOpen && (
          <button onClick={() => setMobileOpen(false)} className="ml-auto text-[var(--tulip-cream)]/60 hover:text-[var(--tulip-cream)] md:hidden">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {navItems.map((item) => {
          const { href, icon: Icon } = item
          const label = item.fallback ? t(item.key, { defaultValue: item.fallback }) : t(item.key)
          const isWorkflow = href === '/dashboard/workflow'
          const isDonorFlags = item.key === 'donorFlags'
          const isDeliverables = item.key === 'deliverables'
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link key={href} href={href} className={clsx(
              'relative flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg mb-0.5 transition-all group',
              active
                ? 'bg-[var(--tulip-gold)]/20 text-[var(--tulip-gold)]'
                : 'text-[var(--tulip-cream)]/70 hover:text-[var(--tulip-cream)] hover:bg-[var(--tulip-cream)]/10'
            )}>
              <Icon size={18} className="shrink-0" />
              {(!collapsed || mobileOpen) && <span className="text-sm font-medium">{label}</span>}
              {isWorkflow && pendingCount > 0 && (!collapsed || mobileOpen) && (
                <span className="ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--tulip-gold)]/20 text-[var(--tulip-gold)] leading-none">{pendingCount}</span>
              )}
              {isWorkflow && pendingCount > 0 && collapsed && !mobileOpen && (
                <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--tulip-gold)]" />
              )}
              {isDonorFlags && donorFlagCount > 0 && (!collapsed || mobileOpen) && (
                <span className="ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-500 leading-none">{donorFlagCount}</span>
              )}
              {isDonorFlags && donorFlagCount > 0 && collapsed && !mobileOpen && (
                <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
              )}
              {isDeliverables && deliverableCount > 0 && (!collapsed || mobileOpen) && (
                <span className="ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none" style={{ background: 'rgba(245,158,11,0.2)', color: '#F59E0B' }}>{deliverableCount}</span>
              )}
              {isDeliverables && deliverableCount > 0 && collapsed && !mobileOpen && (
                <div className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ background: '#F59E0B' }} />
              )}
              {active && (!collapsed || mobileOpen) && !isWorkflow && !(isDonorFlags && donorFlagCount > 0) && !(isDeliverables && deliverableCount > 0) && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--tulip-gold)]" />
              )}
              {active && (!collapsed || mobileOpen) && isWorkflow && pendingCount === 0 && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--tulip-gold)]" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-[var(--tulip-cream)]/10 p-3 space-y-1">
        {/* Collapse toggle — desktop only */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[var(--tulip-cream)]/60 hover:text-[var(--tulip-cream)] hover:bg-[var(--tulip-cream)]/10 transition-all"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          {!collapsed && <span className="text-sm">{t('collapse')}</span>}
        </button>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[var(--tulip-cream)]/60 hover:text-red-400 hover:bg-red-400/10 transition-all"
        >
          <LogOut size={18} className="shrink-0" />
          {(!collapsed || mobileOpen) && <span className="text-sm">{t('signOut')}</span>}
        </button>
      </div>
    </>
  )

  return (
    <div className="flex h-screen bg-[var(--tulip-cream)] text-[var(--tulip-forest)] overflow-hidden">

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        </div>
      )}

      {/* Mobile sidebar drawer */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-50 w-60 flex flex-col border-r border-[var(--tulip-cream)]/10 transition-transform duration-300 md:hidden',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )} style={{ background: 'var(--tulip-forest)' }}>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className={clsx(
        'hidden md:flex flex-col border-r border-[var(--tulip-cream)]/10 transition-all duration-300 shrink-0',
        collapsed ? 'w-16' : 'w-60'
      )} style={{ background: 'var(--tulip-forest)' }}>
        {sidebarContent}
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Topbar */}
        <header className="h-16 border-b border-[var(--tulip-sage-dark)] flex items-center justify-between px-4 md:px-6 shrink-0"
          style={{ background: 'var(--tulip-cream)' }}>

          {/* Left: hamburger (mobile) + search (desktop) */}
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)}
              className="md:hidden w-9 h-9 rounded-lg bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] flex items-center justify-center hover:bg-[var(--tulip-sage-dark)] transition-all">
              <Menu size={18} className="text-[var(--tulip-forest)]" />
            </button>

            {/* Logo — mobile only (centered feel) */}
            <div className="md:hidden flex items-center">
              <img src="/logo.svg" alt="sealayer" className="h-14" />
            </div>

            {/* Search — desktop only */}
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden md:flex items-center gap-3 bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-3 py-2 w-72 hover:bg-[var(--tulip-sage-dark)] transition-colors cursor-pointer"
            >
              <Search size={15} className="text-[var(--tulip-forest)]/40" />
              <span className="text-sm text-[var(--tulip-forest)]/40 flex-1 text-left">{t('searchPlaceholder')}</span>
              <kbd className="text-[10px] font-medium text-[var(--tulip-forest)]/30 bg-[var(--tulip-cream)] border border-[var(--tulip-sage-dark)] rounded px-1.5 py-0.5">{typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent) ? '\u2318' : 'Ctrl+'}K</kbd>
            </button>
          </div>

          {/* Right: language + bell + avatar */}
          <div className="flex items-center gap-3">
            <ThemeToggle compact />
            <LanguageSwitcher />
            <div className="relative">
              <button
                ref={notifBtnRef}
                onClick={toggleNotifications}
                className="relative w-9 h-9 rounded-lg bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] flex items-center justify-center hover:bg-[var(--tulip-sage-dark)] transition-all"
              >
                <Bell size={16} className="text-[var(--tulip-forest)]" />
                {hasRecent && (
                  <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--tulip-gold)]" />
                )}
              </button>

              {/* Notification panel */}
              {showNotifications && (
                <div
                  ref={notifPanelRef}
                  className="absolute right-0 top-11 w-80 sm:w-96 max-h-[28rem] bg-[var(--tulip-cream)] border border-[var(--tulip-sage-dark)] rounded-xl shadow-xl z-50 flex flex-col overflow-hidden"
                  style={{ animation: 'slideInRight 0.2s ease-out' }}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)]">
                    <h3 className="text-sm font-semibold text-[var(--tulip-forest)]">Notifications</h3>
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-[var(--tulip-sage-dark)] transition-colors"
                    >
                      <X size={14} className="text-[var(--tulip-forest)]" />
                    </button>
                  </div>

                  {/* Body */}
                  <div className="flex-1 overflow-y-auto">
                    {notifLoading && notifications.length === 0 ? (
                      <div className="flex items-center justify-center py-10 text-sm text-[var(--tulip-forest)]/50">
                        Loading...
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="flex items-center justify-center py-10 text-sm text-[var(--tulip-forest)]/50">
                        No recent activity
                      </div>
                    ) : (
                      notifications.map((entry) => {
                        const route = entityRoute(entry.entityType)
                        return (
                          <button
                            key={entry.id}
                            onClick={() => handleNotifClick(entry)}
                            className="w-full text-left px-4 py-3 border-b border-[var(--tulip-sage-dark)]/50 hover:bg-[var(--tulip-sage)] transition-colors group"
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 w-7 h-7 rounded-lg bg-[var(--tulip-gold)]/20 flex items-center justify-center shrink-0">
                                <Shield size={13} className="text-[var(--tulip-forest)]" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-[var(--tulip-forest)] truncate">
                                  {actionLabel(entry.action)}
                                </p>
                                <p className="text-xs text-[var(--tulip-forest)]/60 mt-0.5 truncate">
                                  {entry.entityType}
                                  {entry.projectName ? ` — ${entry.projectName}` : ''}
                                </p>
                              </div>
                              <span className="text-[10px] text-[var(--tulip-forest)]/40 whitespace-nowrap mt-0.5">
                                {formatRelativeTime(entry.createdAt)}
                              </span>
                            </div>
                            {route && (
                              <p className="text-[10px] text-[var(--tulip-forest)]/30 mt-1 ml-10 group-hover:text-[var(--tulip-forest)]/50">
                                View {entry.entityType.toLowerCase()}s
                              </p>
                            )}
                          </button>
                        )
                      })
                    )}
                  </div>

                  {/* Footer */}
                  <Link
                    href="/dashboard/audit"
                    onClick={() => setShowNotifications(false)}
                    className="block text-center text-xs font-medium text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)] py-2.5 border-t border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)]/50 transition-colors"
                  >
                    View all audit logs
                  </Link>
                </div>
              )}
            </div>
            <button
              onClick={() => { setMessengerOpen(true); setMessengerTarget(null) }}
              className="relative w-9 h-9 rounded-lg bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] flex items-center justify-center hover:bg-[var(--tulip-sage-dark)] transition-all"
            >
              <MessageCircle size={16} className="text-[var(--tulip-forest)]" />
              {messengerUnread > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-[var(--tulip-gold)] text-[var(--tulip-forest)] text-[10px] font-bold flex items-center justify-center px-1 leading-none">
                  {messengerUnread > 99 ? '99+' : messengerUnread}
                </span>
              )}
            </button>
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(prev => !prev)}
                className="flex items-center gap-2.5 pl-3 border-l border-[var(--tulip-sage-dark)] cursor-pointer hover:opacity-80 transition-all"
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-[var(--tulip-forest)] bg-[var(--tulip-gold)]">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-medium text-[var(--tulip-forest)]">{userName}</div>
                  <div className="text-xs text-[var(--tulip-forest)]/50">{userRole}</div>
                </div>
                <svg className="hidden sm:block text-[var(--tulip-forest)]/40" width={12} height={12} viewBox="0 0 12 12" fill="none">
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {profileOpen && (
                <div
                  className="absolute right-0 top-12 w-64 bg-[var(--tulip-cream)] border border-[var(--tulip-sage-dark)] rounded-xl shadow-xl z-50 overflow-hidden"
                  style={{ animation: 'slideInRight 0.2s ease-out' }}
                >
                  {/* User info header */}
                  <div className="px-4 py-3 border-b border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)]">
                    <p className="text-sm font-semibold text-[var(--tulip-forest)]">{userName}</p>
                    {userEmail && <p className="text-xs text-[var(--tulip-forest)]/50 truncate">{userEmail}</p>}
                    <p className="text-[10px] text-[var(--tulip-forest)]/40 mt-0.5">{userRole}</p>
                  </div>

                  {/* Menu items */}
                  <div className="py-1">
                    <Link href="/dashboard/settings" onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--tulip-forest)] hover:bg-[var(--tulip-sage)] transition-all">
                      <Settings size={15} className="text-[var(--tulip-forest)]/40" /> Profile & Settings
                    </Link>
                    <Link href="/dashboard/team" onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--tulip-forest)] hover:bg-[var(--tulip-sage)] transition-all">
                      <Users size={15} className="text-[var(--tulip-forest)]/40" /> Team Members
                    </Link>
                    <Link href="/dashboard/billing" onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--tulip-forest)] hover:bg-[var(--tulip-sage)] transition-all">
                      <CreditCard size={15} className="text-[var(--tulip-forest)]/40" /> Billing
                    </Link>
                  </div>

                  {/* Sign out */}
                  <div className="border-t border-[var(--tulip-sage-dark)] py-1">
                    <button onClick={() => { setProfileOpen(false); handleSignOut() }}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-all">
                      <LogOut size={15} /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Messenger Panel */}
      <MessengerPanel
        open={messengerOpen}
        onClose={() => { setMessengerOpen(false); setMessengerTarget(null) }}
        openToConversation={messengerTarget}
      />

      {/* Search Modal */}
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Floating Help Button */}
      <FloatingHelpButton />
    </div>
  )
}
