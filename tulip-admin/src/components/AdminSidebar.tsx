'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { clearAuth, getAdmin } from '@/lib/auth'
import {
  LayoutDashboard, LifeBuoy, BookOpen, Code2, FolderSearch, ScanLine,
  ShieldCheck, Briefcase, Webhook, Key, Settings, LogOut, Shield,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useState, useEffect } from 'react'

const sections = [
  {
    label: 'Platform',
    items: [
      { key: 'dashboard', href: '/', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    label: 'Customer Management',
    items: [
      { key: 'support', href: '/support', icon: LifeBuoy, label: 'Support Tickets' },
      { key: 'knowledge-base', href: '/knowledge-base', icon: BookOpen, label: 'KB Articles' },
    ],
  },
  {
    label: 'Developer Tools',
    items: [
      { key: 'developer-api', href: '/developer-api', icon: Code2, label: 'Developer API' },
      { key: 'embed', href: '/embed', icon: Code2, label: 'Embed Widget' },
      { key: 'bundle-verify', href: '/bundle-verify', icon: FolderSearch, label: 'Bundle Verify' },
      { key: 'ocr-engine', href: '/ocr-engine', icon: ScanLine, label: 'OCR Engine' },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { key: 'trust-seal', href: '/trust-seal', icon: ShieldCheck, label: 'Trust Seal' },
      { key: 'cases', href: '/cases', icon: Briefcase, label: 'Cases' },
      { key: 'webhooks', href: '/webhooks', icon: Webhook, label: 'Webhooks' },
      { key: 'api-keys', href: '/api-keys', icon: Key, label: 'API Keys' },
    ],
  },
  {
    label: 'Account',
    items: [
      { key: 'settings', href: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [adminName, setAdminName] = useState('Admin')

  useEffect(() => {
    const admin = getAdmin()
    if (admin?.name) setAdminName(admin.name)
  }, [])

  const handleSignOut = () => {
    clearAuth()
    router.push('/login')
  }

  return (
    <aside className={clsx(
      'hidden md:flex flex-col bg-[var(--admin-sidebar)] transition-all duration-300 shrink-0',
      collapsed ? 'w-16' : 'w-60'
    )}>
      {/* Logo */}
      <div className={clsx(
        'flex items-center h-16 border-b border-white/10 shrink-0',
        collapsed ? 'justify-center px-0' : 'px-5 gap-3'
      )}>
        <img src="/logo.svg" alt="sealayer" className={collapsed ? 'h-10 w-10 object-contain' : 'h-14'} style={{ filter: 'brightness(0) invert(1)' }} />
        {!collapsed && (
          <span className="font-bold text-white text-lg">Admin</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.label} className="mb-2">
            {!collapsed && (
              <div className="px-5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {section.label}
              </div>
            )}
            {section.items.map((item) => {
              const Icon = item.icon
              const active = item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={clsx(
                    'flex items-center gap-3 mx-2 px-3 py-2 rounded-lg mb-0.5 transition-all',
                    active
                      ? 'bg-[var(--admin-sidebar-active)] text-white'
                      : 'text-slate-400 hover:text-white hover:bg-[var(--admin-sidebar-hover)]'
                  )}
                >
                  <Icon size={18} className="shrink-0" />
                  {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                  {active && !collapsed && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--admin-accent)]" />
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-white/10 p-3 space-y-1">
        {/* User */}
        {!collapsed && (
          <div className="px-3 py-2 text-sm text-slate-400">
            <div className="font-medium text-white">{adminName}</div>
            <div className="text-xs text-slate-500">System Admin</div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-[var(--admin-sidebar-hover)] transition-all"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          {!collapsed && <span className="text-sm">Collapse</span>}
        </button>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-all"
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span className="text-sm">Sign Out</span>}
        </button>
      </div>
    </aside>
  )
}
