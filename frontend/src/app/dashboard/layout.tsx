'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { apiGet } from '@/lib/api'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import {
  LayoutDashboard, FolderOpen, FileCheck, Receipt, Banknote,
  Key, Webhook, BarChart3, Settings, LogOut, Code2, CreditCard, Users,
  ChevronLeft, ChevronRight, Shield, Bell, Search, Menu, X, ListChecks, ScanLine, FolderSearch, Briefcase, ShieldCheck, Crown
} from 'lucide-react'
import { clsx } from 'clsx'
import { useTranslations } from 'next-intl'
import LanguageSwitcher from '@/components/LanguageSwitcher'

const navItems = [
  { key: 'dashboard',  href: '/dashboard',           icon: LayoutDashboard, fallback: 'Overview' },
  { key: 'projects',   href: '/dashboard/projects',  icon: FolderOpen },
  { key: 'budgets',    href: '/dashboard/budgets',   icon: BarChart3 },
  { key: 'funding',    href: '/dashboard/funding',   icon: Banknote },
  { key: 'documents',  href: '/dashboard/documents', icon: FileCheck },
  { key: 'expenses',   href: '/dashboard/expenses',  icon: Receipt },
  { key: 'auditLog',    href: '/dashboard/audit',     icon: Shield },
  { key: 'analytics',  href: '/dashboard/analytics', icon: BarChart3 },
  { key: 'approvals',  href: '/dashboard/workflow',  icon: ListChecks, fallback: 'Workflow' },
  { key: 'billing',     href: '/dashboard/billing',   icon: CreditCard },
  { key: 'team',        href: '/dashboard/team',      icon: Users },
  { key: 'apiKeys',     href: '/dashboard/api-keys',  icon: Key },
  { key: 'webhooks',    href: '/dashboard/webhooks',  icon: Webhook },
  { key: 'trustSeal',   href: '/dashboard/trust-seal',     icon: ShieldCheck },
  { key: 'cases',       href: '/dashboard/cases',          icon: Briefcase },
  { key: 'ocrEngine',   href: '/dashboard/api-portal/ocr', icon: ScanLine },
  { key: 'bundleVerify', href: '/dashboard/api-portal/bundle', icon: FolderSearch },
  { key: 'developerApi', href: '/dashboard/api-portal/developer', icon: Code2 },
  { key: 'embed',       href: '/dashboard/embed',     icon: Code2 },
  { key: 'donors',     href: '/dashboard/settings/donors', icon: Users, fallback: 'Donors' },
  { key: 'settings',   href: '/dashboard/settings',  icon: Settings },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [isSuperadmin, setIsSuperadmin] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations('nav')
  useOfflineSync() // mount globally — drains offline queue + pre-caches projects

  // Fetch workflow pending count + superadmin check
  useEffect(() => {
    apiGet('/api/workflow/summary')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setPendingCount((d.pending || 0) + (d.inReview || 0)) })
      .catch(() => {})
    apiGet('/api/admin/check')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.isSuperadmin) setIsSuperadmin(true) })
      .catch(() => {})
  }, [pathname])

  // Close mobile sidebar on route change
  useEffect(() => { setMobileOpen(false) }, [pathname])

  // Close mobile sidebar on escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

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
        'flex items-center border-b border-[#fefbe9]/10 h-16 shrink-0',
        collapsed && !mobileOpen ? 'justify-center px-0' : 'px-5 gap-3'
      )}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-[#f6c453]">
          <span className="text-[#183a1d] font-bold text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>T</span>
        </div>
        {(!collapsed || mobileOpen) && (
          <span className="font-bold text-[#fefbe9] text-lg" style={{ fontFamily: 'Inter, sans-serif' }}>
            tulip<span style={{ color: '#f6c453' }}>ds</span>
          </span>
        )}
        {/* Close button — mobile only */}
        {mobileOpen && (
          <button onClick={() => setMobileOpen(false)} className="ml-auto text-[#fefbe9]/60 hover:text-[#fefbe9] md:hidden">
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
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link key={href} href={href} className={clsx(
              'relative flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg mb-0.5 transition-all group',
              active
                ? 'bg-[#f6c453]/20 text-[#f6c453]'
                : 'text-[#fefbe9]/70 hover:text-[#fefbe9] hover:bg-[#fefbe9]/10'
            )}>
              <Icon size={18} className="shrink-0" />
              {(!collapsed || mobileOpen) && <span className="text-sm font-medium">{label}</span>}
              {isWorkflow && pendingCount > 0 && (!collapsed || mobileOpen) && (
                <span className="ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#f6c453]/20 text-[#f6c453] leading-none">{pendingCount}</span>
              )}
              {isWorkflow && pendingCount > 0 && collapsed && !mobileOpen && (
                <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#f6c453]" />
              )}
              {active && (!collapsed || mobileOpen) && !isWorkflow && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#f6c453]" />
              )}
              {active && (!collapsed || mobileOpen) && isWorkflow && pendingCount === 0 && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#f6c453]" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-[#fefbe9]/10 p-3 space-y-1">
        {/* Admin — superadmin only */}
        {isSuperadmin && (
          <Link href="/dashboard/admin" className={clsx(
            'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-all',
            pathname === '/dashboard/admin'
              ? 'bg-[#f0a04b]/20 text-[#f0a04b]'
              : 'text-[#f0a04b]/60 hover:text-[#f0a04b] hover:bg-[#f0a04b]/10'
          )}>
            <Crown size={18} className="shrink-0" />
            {(!collapsed || mobileOpen) && <span className="text-sm font-medium">{t('admin')}</span>}
          </Link>
        )}
        {/* Collapse toggle — desktop only */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[#fefbe9]/60 hover:text-[#fefbe9] hover:bg-[#fefbe9]/10 transition-all"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          {!collapsed && <span className="text-sm">{t('collapse')}</span>}
        </button>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[#fefbe9]/60 hover:text-red-400 hover:bg-red-400/10 transition-all"
        >
          <LogOut size={18} className="shrink-0" />
          {(!collapsed || mobileOpen) && <span className="text-sm">{t('signOut')}</span>}
        </button>
      </div>
    </>
  )

  return (
    <div className="flex h-screen bg-[#fefbe9] text-[#183a1d] overflow-hidden">

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        </div>
      )}

      {/* Mobile sidebar drawer */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-50 w-60 flex flex-col border-r border-[#fefbe9]/10 transition-transform duration-300 md:hidden',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )} style={{ background: '#183a1d' }}>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className={clsx(
        'hidden md:flex flex-col border-r border-[#fefbe9]/10 transition-all duration-300 shrink-0',
        collapsed ? 'w-16' : 'w-60'
      )} style={{ background: '#183a1d' }}>
        {sidebarContent}
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Topbar */}
        <header className="h-16 border-b border-[#c8d6c0] flex items-center justify-between px-4 md:px-6 shrink-0"
          style={{ background: '#fefbe9' }}>

          {/* Left: hamburger (mobile) + search (desktop) */}
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)}
              className="md:hidden w-9 h-9 rounded-lg bg-[#e1eedd] border border-[#c8d6c0] flex items-center justify-center hover:bg-[#c8d6c0] transition-all">
              <Menu size={18} className="text-[#183a1d]" />
            </button>

            {/* Logo — mobile only (centered feel) */}
            <div className="md:hidden flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#f6c453]">
                <span className="text-[#183a1d] font-bold text-xs" style={{ fontFamily: 'Inter, sans-serif' }}>T</span>
              </div>
              <span className="font-bold text-[#183a1d] text-base" style={{ fontFamily: 'Inter, sans-serif' }}>
                tulip<span style={{ color: '#f6c453' }}>ds</span>
              </span>
            </div>

            {/* Search — desktop only */}
            <div className="hidden md:flex items-center gap-3 bg-[#e1eedd] border border-[#c8d6c0] rounded-lg px-3 py-2 w-72">
              <Search size={15} className="text-[#183a1d]/40" />
              <input
                placeholder={t('searchPlaceholder')}
                className="bg-transparent text-sm text-[#183a1d] placeholder-[#183a1d]/40 outline-none w-full"
              />
            </div>
          </div>

          {/* Right: language + bell + avatar */}
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <button className="relative w-9 h-9 rounded-lg bg-[#e1eedd] border border-[#c8d6c0] flex items-center justify-center hover:bg-[#c8d6c0] transition-all">
              <Bell size={16} className="text-[#183a1d]" />
              <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#f6c453]" />
            </button>
            <div className="flex items-center gap-2.5 pl-3 border-l border-[#c8d6c0]">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-[#183a1d] bg-[#f6c453]">
                N
              </div>
              <div className="hidden sm:block">
                <div className="text-sm font-medium text-[#183a1d]">NGO Admin</div>
                <div className="text-xs text-[#183a1d]/50">Administrator</div>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
