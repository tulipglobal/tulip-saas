'use client'

import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect, useRef, useCallback } from "react"
import { getUser, clearToken, isAuthenticated } from "@/lib/auth"
import { apiGet, apiPost } from "@/lib/api"
import MessengerPanel from "@/components/MessengerPanel"
import ThemeToggle from "@/components/ThemeToggle"
import SearchModal from "@/components/SearchModal"
import LanguageSwitcher from "@/components/LanguageSwitcher"
import FloatingHelpButton from "@/components/FloatingHelpButton"
import { useTranslations } from 'next-intl'

// ── Helpers ──────────────────────────────────────────────────
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

function fmtDateFull(d: string | Date): string {
  const dt = new Date(d)
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function alertIcon(alertType: string): string {
  if (alertType.startsWith('expense.')) return '\uD83D\uDCB0'
  if (alertType.startsWith('budget.')) return '\uD83D\uDCCA'
  if (alertType.startsWith('seal.')) return '\uD83D\uDD17'
  if (alertType.startsWith('document.')) return '\uD83D\uDCC4'
  if (alertType.startsWith('report.')) return '\uD83D\uDCC8'
  if (alertType.startsWith('challenge.')) return '\uD83D\uDD14'
  return '\uD83D\uDD14'
}

function notificationRoute(n: Notification): string | null {
  if (n.alertType.startsWith('expense.') && n.entityId && n.projectId) return `/projects/${n.projectId}?expense=${n.entityId}`
  if (n.alertType.startsWith('budget.') && n.projectId) return `/projects/${n.projectId}`
  if (n.alertType.startsWith('seal.') && n.projectId) return `/projects/${n.projectId}`
  if (n.alertType.startsWith('document.') && n.projectId) return `/projects/${n.projectId}`
  if (n.alertType.startsWith('challenge.') && n.entityId && n.projectId) return `/projects/${n.projectId}?expense=${n.entityId}`
  if (n.alertType.startsWith('report.')) return null
  return null
}

interface Notification {
  id: string
  alertType: string
  title: string
  body: string
  read: boolean
  entityId: string | null
  projectId: string | null
  createdAt: string
}

// ── SVG Icons ────────────────────────────────────────────────
function IconHome({ size = 20, color = 'white' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function IconBell({ size = 20, color = 'white' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function IconFlag({ size = 20, color = 'white' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  )
}

function IconSettings({ size = 20, color = 'white' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function IconLogout({ size = 20, color = 'white' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

function IconChevronLeft({ size = 20, color = 'white' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function IconChevronRight({ size = 20, color = 'white' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function IconHamburger({ size = 24, color = '#3C3489' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

function IconMessageCircle({ size = 20, color = 'white' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}

// ── Messenger Bell (Top Bar) ─────────────────────────────────
function MessengerBell({ unreadCount, onToggle }: { unreadCount: number; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-all cursor-pointer"
      title="Messages"
    >
      <IconMessageCircle size={20} color="var(--donor-accent)" />
      {unreadCount > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold text-white px-1"
          style={{ background: '#DC2626' }}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  )
}

// ── Notification Panel ───────────────────────────────────────
function NotificationPanel({ onClose, onCountChange }: { onClose: () => void; onCountChange: () => void }) {
  const t = useTranslations()
  const router = useRouter()
  const panelRef = useRef<HTMLDivElement>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet('/api/donor/notifications?limit=20')
      .then(async r => {
        if (r.ok) {
          const d = await r.json()
          setNotifications(d.notifications || [])
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const markAllRead = async () => {
    await apiPost('/api/donor/notifications/mark-all-read', {})
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    onCountChange()
  }

  const handleClick = async (n: Notification) => {
    if (!n.read) {
      await apiPost(`/api/donor/notifications/${n.id}/mark-read`, {})
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
      onCountChange()
    }
    const route = notificationRoute(n)
    if (route) {
      onClose()
      router.push(route)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.3)' }}>
      <div ref={panelRef} className="w-full max-w-md bg-[var(--bg-card)] h-full overflow-y-auto shadow-2xl animate-slide-in-right flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-[var(--bg-card)] border-b px-6 py-4 flex items-center justify-between z-10" style={{ borderColor: 'var(--donor-border)' }}>
          <h2 className="text-lg font-bold" style={{ color: 'var(--donor-dark)' }}>{t('notifications.title')}</h2>
          <div className="flex items-center gap-3">
            <button onClick={markAllRead} className="text-xs font-medium hover:underline" style={{ color: 'var(--donor-accent)' }}>{t('notifications.markAllRead')}</button>
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 text-gray-500 text-lg">&times;</button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 rounded-lg animate-skeleton-pulse" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <IconBell size={48} color="var(--donor-muted)" />
              <p className="text-sm mt-3" style={{ color: 'var(--donor-muted)' }}>{t('notifications.noNotifications')}</p>
            </div>
          ) : (
            <div>
              {notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className="w-full text-left px-5 py-3 flex items-start gap-3 hover:opacity-90 transition-all cursor-pointer"
                  style={{
                    background: n.read ? 'var(--donor-light)' : 'var(--bg-card)',
                    borderLeft: n.read ? 'none' : '3px solid var(--donor-accent)',
                  }}
                >
                  <span className="text-lg shrink-0 mt-0.5">{alertIcon(n.alertType)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm" style={{ color: 'var(--donor-dark)', fontWeight: n.read ? 400 : 700 }}>{n.title}</p>
                    <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--donor-muted)' }}>{n.body}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--donor-muted)' }} title={fmtDateFull(n.createdAt)}>{timeAgo(n.createdAt)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-[var(--bg-card)] border-t px-6 py-3 flex items-center justify-between" style={{ borderColor: 'var(--donor-border)' }}>
          <button onClick={() => { onClose(); router.push('/notifications') }} className="text-xs font-medium hover:underline" style={{ color: 'var(--donor-accent)' }}>
            {t('notifications.viewAll')} &rarr;
          </button>
          <button onClick={() => { onClose(); router.push('/settings/notifications') }} className="text-xs font-medium hover:underline" style={{ color: 'var(--donor-accent)' }}>
            {t('notifications.notificationSettings')} &rarr;
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Notification Bell (Top Bar) ──────────────────────────────
function NotificationBell({ unreadCount, onTogglePanel }: { unreadCount: number; onTogglePanel: () => void }) {
  return (
    <button
      onClick={onTogglePanel}
      className="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-all cursor-pointer"
      title="Notifications"
    >
      <IconBell size={20} color="var(--donor-accent)" />
      {unreadCount > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold text-white px-1"
          style={{ background: '#DC2626' }}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  )
}

// ── Sidebar ──────────────────────────────────────────────────
interface SidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
  unreadCount: number
  flagCount: number
  pathname: string
}

function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile, unreadCount, flagCount, pathname }: SidebarProps) {
  const t = useTranslations()
  const router = useRouter()

  const handleLogout = () => {
    clearToken()
    router.push('/login')
  }

  const navigate = (path: string) => {
    router.push(path)
    onCloseMobile()
  }

  const isActive = (path: string) => pathname === path

  const navItem = (icon: React.ReactNode, label: string, path: string, badge?: { count: number; bg: string }) => {
    const active = isActive(path)
    return (
      <button
        onClick={() => navigate(path)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer relative group"
        style={{
          background: active ? 'var(--donor-accent)' : 'transparent',
        }}
        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)' }}
        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
        title={collapsed ? label : undefined}
      >
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-[var(--bg-card)]" />
        )}
        <span className="shrink-0 flex items-center justify-center w-5 h-5">{icon}</span>
        {!collapsed && (
          <span className="text-sm font-medium text-white flex-1 text-left">{label}</span>
        )}
        {badge && badge.count > 0 && (
          <span
            className="min-w-[20px] h-[20px] rounded-full flex items-center justify-center text-[10px] font-bold text-white px-1.5"
            style={{ background: badge.bg }}
          >
            {badge.count > 99 ? '99+' : badge.count}
          </span>
        )}
      </button>
    )
  }

  const sectionLabel = (text: string) => {
    if (collapsed) return <div className="h-px mx-3 my-2" style={{ background: 'rgba(255,255,255,0.15)' }} />
    return (
      <div className="px-3 pt-4 pb-1">
        <span className="text-[11px] font-semibold tracking-wider uppercase" style={{ color: 'rgba(255,255,255,0.5)' }}>
          {text}
        </span>
      </div>
    )
  }

  const separator = () => (
    <div className="h-px mx-3 my-2" style={{ background: 'rgba(255,255,255,0.15)' }} />
  )

  const sidebarContent = (
    <div className="flex flex-col h-full" style={{ background: '#3C3489' }}>
      {/* Logo area */}
      <div className={`flex items-center shrink-0 h-14 ${collapsed ? 'justify-center px-2' : 'px-5'}`}>
        {collapsed ? (
          <span className="text-white font-bold text-lg">S</span>
        ) : (
          <div>
            <div className="text-white font-bold text-lg tracking-tight">Sealayer</div>
            <div className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>{t('nav.donorPortal')}</div>
          </div>
        )}
      </div>

      {separator()}

      {/* Navigation */}
      <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
        {navItem(<IconHome size={18} />, t('nav.home'), '/dashboard')}
        {navItem(<IconBell size={18} />, t('nav.notifications'), '/notifications', { count: unreadCount, bg: '#DC2626' })}

        {sectionLabel(t('nav.portfolio'))}
        {navItem(
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
          t('nav.myInvestments'), '/investments'
        )}

        {sectionLabel(t('nav.myFlags'))}
        {navItem(<IconFlag size={18} />, t('nav.myFlags'), '/challenges', { count: flagCount, bg: '#F59E0B' })}

        {sectionLabel(t('nav.settings'))}
        {navItem(
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
          t('nav.reports'), '/reports'
        )}
        {navItem(<IconSettings size={18} />, t('nav.notificationPreferences'), '/settings/notifications')}

        {sectionLabel('Help')}
        {navItem(
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
          'Support', '/support'
        )}
        {navItem(
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
          'Knowledge Base', '/knowledge-base'
        )}
        {navItem(
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8"/><line x1="3" y1="12" x2="21" y2="12"/><path d="M12 3a15.3 15.3 0 0 1 4 9 15.3 15.3 0 0 1-4 9 15.3 15.3 0 0 1-4-9 15.3 15.3 0 0 1 4-9z"/></svg>,
          'Currency Rates', '/currency-rates'
        )}
      </nav>

      {/* Bottom area */}
      <div className="shrink-0 px-2 pb-3 space-y-1">
        {separator()}

        {/* Collapse toggle - desktop only */}
        <button
          onClick={onToggleCollapse}
          className="w-full hidden md:flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer"
          style={{ background: 'transparent' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span className="shrink-0 flex items-center justify-center w-5 h-5">
            {collapsed ? <IconChevronRight size={18} /> : <IconChevronLeft size={18} />}
          </span>
          {!collapsed && <span className="text-sm font-medium text-white">{t('nav.collapse')}</span>}
        </button>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer"
          style={{ background: 'transparent' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          title={collapsed ? t('nav.logout') : undefined}
        >
          <span className="shrink-0 flex items-center justify-center w-5 h-5">
            <IconLogout size={18} />
          </span>
          {!collapsed && <span className="text-sm font-medium text-white">{t('nav.logout')}</span>}
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col shrink-0 transition-all duration-200 h-screen"
        style={{ width: collapsed ? 64 : 240 }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={onCloseMobile}
          />
          {/* Sidebar panel */}
          <aside
            className="relative w-[240px] h-full shadow-2xl"
            style={{ animation: 'slideInLeft 200ms ease-out' }}
          >
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Slide-in animation for mobile */}
      <style jsx>{`
        @keyframes slideInLeft {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  )
}

// ── Top Bar ──────────────────────────────────────────────────
interface TopBarProps {
  user: Record<string, string> | null
  unreadCount: number
  messengerUnread: number
  onHamburgerClick: () => void
  onToggleNotificationPanel: () => void
  onToggleMessenger: () => void
  onSearchClick: () => void
  onSignOut: () => void
}

function TopBar({ user, unreadCount, messengerUnread, onHamburgerClick, onToggleNotificationPanel, onToggleMessenger, onSearchClick, onSignOut }: TopBarProps) {
  const t = useTranslations()
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

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

  const displayName = user?.name || user?.email || 'User'
  const orgName = user?.orgName || ''

  return (
    <header
      className="h-14 flex items-center justify-between px-4 sm:px-6 shrink-0 bg-[var(--bg-card)]"
      style={{ borderBottom: '1px solid var(--donor-border)' }}
    >
      {/* Left: hamburger (mobile only) + search */}
      <div className="flex items-center gap-3">
        <button
          onClick={onHamburgerClick}
          className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-all cursor-pointer"
        >
          <IconHamburger size={22} />
        </button>

        {/* Search button — desktop */}
        <button
          onClick={onSearchClick}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
          style={{ background: 'var(--donor-light)', border: '1px solid var(--donor-border)' }}
        >
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="var(--donor-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span className="text-sm" style={{ color: 'var(--donor-muted)' }}>{t('nav.search')}</span>
          <kbd className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-card)', color: 'var(--donor-muted)', border: '1px solid var(--donor-border)' }}>
            {typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent) ? '\u2318' : 'Ctrl+'}K
          </kbd>
        </button>
      </div>

      {/* Right: language + theme + bells + user dropdown */}
      <div className="flex items-center gap-3 ml-auto">
        <LanguageSwitcher />
        <ThemeToggle compact />
        <NotificationBell unreadCount={unreadCount} onTogglePanel={onToggleNotificationPanel} />
        <MessengerBell unreadCount={messengerUnread} onToggle={onToggleMessenger} />

        {/* Profile dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen(prev => !prev)}
            className="flex items-center gap-2.5 pl-3 border-l cursor-pointer hover:opacity-80 transition-all"
            style={{ borderColor: 'var(--donor-border)' }}
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: 'var(--donor-accent)' }}>
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-sm font-medium" style={{ color: 'var(--donor-dark)' }}>{displayName}</div>
              {orgName && <div className="text-xs" style={{ color: 'var(--donor-muted)' }}>{orgName}</div>}
            </div>
            <svg className="hidden sm:block" style={{ color: 'var(--donor-muted)' }} width={12} height={12} viewBox="0 0 12 12" fill="none">
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {profileOpen && (
            <div
              className="absolute right-0 top-12 w-64 rounded-xl shadow-xl z-50 overflow-hidden"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--donor-border)', animation: 'fadeUp 0.15s ease-out' }}
            >
              {/* User info header */}
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--donor-border)', background: 'var(--donor-light)' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--donor-dark)' }}>{displayName}</p>
                {user?.email && <p className="text-xs truncate" style={{ color: 'var(--donor-muted)' }}>{user.email}</p>}
                {orgName && <p className="text-[10px] mt-0.5" style={{ color: 'var(--donor-muted)' }}>{orgName}</p>}
              </div>

              {/* Menu items */}
              <div className="py-1">
                <button onClick={() => { setProfileOpen(false); router.push('/settings/notifications') }}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left transition-all hover:opacity-80"
                  style={{ color: 'var(--donor-dark)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--donor-light)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="var(--donor-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  {t('nav.notificationSettings')}
                </button>
                <button onClick={() => { setProfileOpen(false); router.push('/reports') }}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left transition-all hover:opacity-80"
                  style={{ color: 'var(--donor-dark)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--donor-light)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="var(--donor-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  {t('nav.reports')}
                </button>
              </div>

              {/* Sign out */}
              <div style={{ borderTop: '1px solid var(--donor-border)' }} className="py-1">
                <button onClick={() => { setProfileOpen(false); onSignOut() }}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left transition-all"
                  style={{ color: '#DC2626' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(220,38,38,0.05)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  {t('nav.signOut')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

// ── Client Layout ────────────────────────────────────────────
export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const isPublic = pathname === '/login' || pathname === '/signup' || pathname.startsWith('/share/')

  // Sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Notification panel state
  const [showNotificationPanel, setShowNotificationPanel] = useState(false)

  // Messenger panel state
  const [showMessenger, setShowMessenger] = useState(false)
  const [messengerUnread, setMessengerUnread] = useState(0)

  // Search modal state
  const [searchOpen, setSearchOpen] = useState(false)

  // User state
  const [user, setUser] = useState<Record<string, string> | null>(null)

  // Shared unread notification count
  const [unreadCount, setUnreadCount] = useState(0)

  // Flag count
  const [flagCount, setFlagCount] = useState(0)

  // Load user
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('donor_user')
      if (stored) try { setUser(JSON.parse(stored)) } catch { /* ignore */ }
    }
  }, [pathname])

  // Poll unread notification count
  const fetchUnreadCount = useCallback(() => {
    if (!isAuthenticated()) return
    apiGet('/api/donor/notifications/unread-count')
      .then(async r => {
        if (r.ok) {
          const d = await r.json()
          setUnreadCount(d.count || 0)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (isPublic) return
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 60000)
    return () => clearInterval(interval)
  }, [isPublic, fetchUnreadCount])

  // Poll messenger unread count
  const fetchMessengerUnread = useCallback(() => {
    if (!isAuthenticated()) return
    apiGet('/api/messenger/donor/unread-count')
      .then(async r => {
        if (r.ok) {
          const d = await r.json()
          setMessengerUnread(d.count || 0)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (isPublic) return
    fetchMessengerUnread()
    const interval = setInterval(fetchMessengerUnread, 30000)
    return () => clearInterval(interval)
  }, [isPublic, fetchMessengerUnread])

  // Poll flag count
  const fetchFlagCount = useCallback(() => {
    if (!isAuthenticated()) return
    apiGet('/api/donor/challenges')
      .then(async r => {
        if (r.ok) {
          const d = await r.json()
          const items = d.challenges || d.data || d || []
          if (Array.isArray(items)) {
            const openCount = items.filter((c: { status: string }) =>
              c.status === 'OPEN' || c.status === 'ESCALATED'
            ).length
            setFlagCount(openCount)
          }
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (isPublic) return
    fetchFlagCount()
    const interval = setInterval(fetchFlagCount, 60000)
    return () => clearInterval(interval)
  }, [isPublic, fetchFlagCount])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  // Close mobile menu on ESC + Cmd+K search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(prev => !prev)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (isPublic) {
    return (
      <div className="flex flex-col min-h-screen">
        <main className="flex-1">{children}</main>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        unreadCount={unreadCount}
        flagCount={flagCount}
        pathname={pathname}
      />

      {/* Main column */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top Bar */}
        <TopBar
          user={user}
          unreadCount={unreadCount}
          messengerUnread={messengerUnread}
          onHamburgerClick={() => setMobileMenuOpen(prev => !prev)}
          onToggleNotificationPanel={() => { setShowNotificationPanel(prev => !prev); setShowMessenger(false) }}
          onToggleMessenger={() => { setShowMessenger(prev => !prev); setShowNotificationPanel(false) }}
          onSearchClick={() => setSearchOpen(true)}
          onSignOut={() => { clearToken(); router.push('/login') }}
        />

        {/* Content */}
        <main className="flex-1 overflow-y-auto" style={{ background: 'var(--background)' }}>
          {children}
        </main>
      </div>

      {/* Notification Panel */}
      {showNotificationPanel && (
        <NotificationPanel
          onClose={() => setShowNotificationPanel(false)}
          onCountChange={fetchUnreadCount}
        />
      )}

      {/* Messenger Panel */}
      {showMessenger && (
        <MessengerPanel
          onClose={() => setShowMessenger(false)}
          onUnreadChange={(count: number) => setMessengerUnread(count)}
        />
      )}

      {/* Search Modal */}
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <FloatingHelpButton />
    </div>
  )
}
