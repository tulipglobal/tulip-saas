'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { apiGet } from '@/lib/api'
import {
  LayoutDashboard, FolderOpen, FileCheck, Receipt, Banknote,
  Key, Webhook, BarChart3, Settings, LogOut, Code2, CreditCard, Users,
  ChevronLeft, ChevronRight, Shield, Bell, Search, Menu, X, ListChecks, ScanLine, FolderSearch, Briefcase, ShieldCheck, Crown
} from 'lucide-react'
import { clsx } from 'clsx'

const nav = [
  { label: 'Overview',  href: '/dashboard',           icon: LayoutDashboard },
  { label: 'Projects',  href: '/dashboard/projects',  icon: FolderOpen },
  { label: 'Budgets',   href: '/dashboard/budgets',   icon: BarChart3 },
  { label: 'Funding',   href: '/dashboard/funding',   icon: Banknote },
  { label: 'Documents', href: '/dashboard/documents', icon: FileCheck },
  { label: 'Expenses',  href: '/dashboard/expenses',  icon: Receipt },
  { label: 'Audit Log', href: '/dashboard/audit',     icon: Shield },
  { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { label: 'Workflow',  href: '/dashboard/workflow',  icon: ListChecks },
  { label: 'Billing',   href: '/dashboard/billing',   icon: CreditCard },
  { label: 'Team',      href: '/dashboard/team',      icon: Users },
  { label: 'API Keys',  href: '/dashboard/api-keys',  icon: Key },
  { label: 'Webhooks',  href: '/dashboard/webhooks',  icon: Webhook },
  { label: 'Trust Seal',  href: '/dashboard/trust-seal',     icon: ShieldCheck },
  { label: 'Cases',      href: '/dashboard/cases',          icon: Briefcase },
  { label: 'OCR Engine', href: '/dashboard/api-portal/ocr', icon: ScanLine },
  { label: 'Bundle Verify', href: '/dashboard/api-portal/bundle', icon: FolderSearch },
  { label: 'Developer API', href: '/dashboard/api-portal/developer', icon: Code2 },
  { label: 'Embed',     href: '/dashboard/embed',     icon: Code2 },
  { label: 'Settings',  href: '/dashboard/settings',  icon: Settings },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [isSuperadmin, setIsSuperadmin] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

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
        'flex items-center border-b border-gray-200 h-16 shrink-0',
        collapsed && !mobileOpen ? 'justify-center px-0' : 'px-5 gap-3'
      )}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)' }}>
          <span className="text-white font-bold text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>T</span>
        </div>
        {(!collapsed || mobileOpen) && (
          <span className="font-bold text-gray-900 text-lg" style={{ fontFamily: 'Syne, sans-serif' }}>
            tulip<span style={{ color: '#2563EB' }}>ds</span>
          </span>
        )}
        {/* Close button — mobile only */}
        {mobileOpen && (
          <button onClick={() => setMobileOpen(false)} className="ml-auto text-gray-500 hover:text-gray-900 md:hidden">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {nav.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link key={href} href={href} className={clsx(
              'relative flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg mb-0.5 transition-all group',
              active
                ? 'bg-blue-50 text-[#2563EB]'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            )}>
              <Icon size={18} className="shrink-0" />
              {(!collapsed || mobileOpen) && <span className="text-sm font-medium">{label}</span>}
              {label === 'Workflow' && pendingCount > 0 && (!collapsed || mobileOpen) && (
                <span className="ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-yellow-400/15 text-yellow-400 leading-none">{pendingCount}</span>
              )}
              {label === 'Workflow' && pendingCount > 0 && collapsed && !mobileOpen && (
                <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-yellow-400" />
              )}
              {active && (!collapsed || mobileOpen) && label !== 'Workflow' && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
              )}
              {active && (!collapsed || mobileOpen) && label === 'Workflow' && pendingCount === 0 && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-gray-200 p-3 space-y-1">
        {/* Admin — superadmin only */}
        {isSuperadmin && (
          <Link href="/dashboard/admin" className={clsx(
            'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-all',
            pathname === '/dashboard/admin'
              ? 'bg-orange-400/15 text-orange-400'
              : 'text-orange-400/60 hover:text-orange-400 hover:bg-orange-400/10'
          )}>
            <Crown size={18} className="shrink-0" />
            {(!collapsed || mobileOpen) && <span className="text-sm font-medium">Admin</span>}
          </Link>
        )}
        {/* Collapse toggle — desktop only */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-all"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          {!collapsed && <span className="text-sm">Collapse</span>}
        </button>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/5 transition-all"
        >
          <LogOut size={18} className="shrink-0" />
          {(!collapsed || mobileOpen) && <span className="text-sm">Sign out</span>}
        </button>
      </div>
    </>
  )

  return (
    <div className="flex h-screen bg-[#F9FAFB] text-gray-900 overflow-hidden">

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        </div>
      )}

      {/* Mobile sidebar drawer */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-50 w-60 flex flex-col border-r border-gray-200 transition-transform duration-300 md:hidden',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )} style={{ background: '#FFFFFF' }}>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className={clsx(
        'hidden md:flex flex-col border-r border-gray-200 transition-all duration-300 shrink-0',
        collapsed ? 'w-16' : 'w-60'
      )} style={{ background: '#FFFFFF' }}>
        {sidebarContent}
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Topbar */}
        <header className="h-16 border-b border-gray-200 flex items-center justify-between px-4 md:px-6 shrink-0"
          style={{ background: '#FFFFFF', backdropFilter: 'blur(12px)' }}>

          {/* Left: hamburger (mobile) + search (desktop) */}
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)}
              className="md:hidden w-9 h-9 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-all">
              <Menu size={18} className="text-gray-600" />
            </button>

            {/* Logo — mobile only (centered feel) */}
            <div className="md:hidden flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)' }}>
                <span className="text-white font-bold text-xs" style={{ fontFamily: 'Syne, sans-serif' }}>T</span>
              </div>
              <span className="font-bold text-gray-900 text-base" style={{ fontFamily: 'Syne, sans-serif' }}>
                tulip<span style={{ color: '#2563EB' }}>ds</span>
              </span>
            </div>

            {/* Search — desktop only */}
            <div className="hidden md:flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 w-72">
              <Search size={15} className="text-gray-400" />
              <input
                placeholder="Search projects, documents..."
                className="bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none w-full"
              />
            </div>
          </div>

          {/* Right: bell + avatar */}
          <div className="flex items-center gap-3">
            <button className="relative w-9 h-9 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-all">
              <Bell size={16} className="text-gray-600" />
              <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#2563EB]" />
            </button>
            <div className="flex items-center gap-2.5 pl-3 border-l border-gray-200">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)' }}>
                N
              </div>
              <div className="hidden sm:block">
                <div className="text-sm font-medium text-gray-900">NGO Admin</div>
                <div className="text-xs text-gray-500">Administrator</div>
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
