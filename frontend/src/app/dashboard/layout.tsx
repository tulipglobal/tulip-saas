'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, FolderOpen, FileCheck, Receipt, Banknote,
  Key, Webhook, BarChart3, Settings, LogOut, Code2,
  ChevronLeft, ChevronRight, Shield, Bell, Search
} from 'lucide-react'
import { clsx } from 'clsx'

const nav = [
  { label: 'Overview',  href: '/dashboard',           icon: LayoutDashboard },
  { label: 'Projects',  href: '/dashboard/projects',  icon: FolderOpen },
  { label: 'Funding',   href: '/dashboard/funding',   icon: Banknote },
  { label: 'Documents', href: '/dashboard/documents', icon: FileCheck },
  { label: 'Expenses',  href: '/dashboard/expenses',  icon: Receipt },
  { label: 'Audit Log', href: '/dashboard/audit',     icon: Shield },
  { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { label: 'API Keys',  href: '/dashboard/api-keys',  icon: Key },
  { label: 'Webhooks',  href: '/dashboard/webhooks',  icon: Webhook },
  { label: 'Embed',     href: '/dashboard/embed',     icon: Code2 },
  { label: 'Settings',  href: '/dashboard/settings',  icon: Settings },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

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

  return (
    <div className="flex h-screen bg-[#040f1f] text-white overflow-hidden">

      {/* Sidebar */}
      <aside className={clsx(
        'flex flex-col border-r border-white/8 transition-all duration-300 shrink-0',
        collapsed ? 'w-16' : 'w-60'
      )} style={{ background: 'linear-gradient(180deg, #07224a 0%, #040f1f 100%)' }}>

        {/* Logo */}
        <div className={clsx(
          'flex items-center border-b border-white/8 h-16 shrink-0',
          collapsed ? 'justify-center px-0' : 'px-5 gap-3'
        )}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
            <span className="text-white font-bold text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>T</span>
          </div>
          {!collapsed && (
            <span className="font-bold text-white text-lg" style={{ fontFamily: 'Syne, sans-serif' }}>
              tulip<span style={{ color: '#369bff' }}>ds</span>
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {nav.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link key={href} href={href} className={clsx(
                'flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg mb-0.5 transition-all group',
                active
                  ? 'bg-[#0c7aed]/20 text-[#369bff]'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              )}>
                <Icon size={18} className="shrink-0" />
                {!collapsed && <span className="text-sm font-medium">{label}</span>}
                {active && !collapsed && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#369bff]" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="border-t border-white/8 p-3 space-y-1">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-all"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            {!collapsed && <span className="text-sm">Collapse</span>}
          </button>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-400/5 transition-all"
          >
            <LogOut size={18} className="shrink-0" />
            {!collapsed && <span className="text-sm">Sign out</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Topbar */}
        <header className="h-16 border-b border-white/8 flex items-center justify-between px-6 shrink-0"
          style={{ background: 'rgba(4,15,31,0.8)', backdropFilter: 'blur(12px)' }}>
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-lg px-3 py-2 w-72">
            <Search size={15} className="text-white/30" />
            <input
              placeholder="Search projects, documents..."
              className="bg-transparent text-sm text-white/70 placeholder-white/30 outline-none w-full"
            />
          </div>
          <div className="flex items-center gap-3">
            <button className="relative w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all">
              <Bell size={16} className="text-white/60" />
              <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#0c7aed]" />
            </button>
            <div className="flex items-center gap-2.5 pl-3 border-l border-white/10">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
                N
              </div>
              <div className="hidden sm:block">
                <div className="text-sm font-medium text-white/90">NGO Admin</div>
                <div className="text-xs text-white/40">Administrator</div>
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
