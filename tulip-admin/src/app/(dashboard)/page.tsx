'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiGet } from '@/lib/api'
import {
  Building2, FileCheck, ShieldCheck, FolderSearch, TrendingUp,
  Users, Flame, Search, Activity,
} from 'lucide-react'

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

interface HotLead {
  id: string
  name: string
  email: string | null
  ownerName: string | null
  docsProcessed: number
  signupDate: string
}

interface EngagementEvent {
  id: string
  tenantId: string
  tenantName: string
  tenantPlan: string
  eventType: string
  metadata: Record<string, unknown>
  createdAt: string
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.floor(hr / 24)
  return `${d}d ago`
}

const planColors: Record<string, string> = {
  FREE: 'bg-slate-100 text-slate-600',
  STARTER: 'bg-blue-100 text-blue-700',
  PRO: 'bg-purple-100 text-purple-700',
  ENTERPRISE: 'bg-amber-100 text-amber-700',
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [leads, setLeads] = useState<HotLead[]>([])
  const [events, setEvents] = useState<EngagementEvent[]>([])
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('')

  const fetchAll = useCallback(async () => {
    const [sRes, cRes, lRes, eRes] = await Promise.all([
      apiGet('/api/admin/stats'),
      apiGet(`/api/admin/customers?search=${encodeURIComponent(search)}&plan=${planFilter}`),
      apiGet('/api/admin/hot-leads'),
      apiGet('/api/admin/engagement'),
    ])
    if (sRes.ok) setStats(await sRes.json())
    if (cRes.ok) { const d = await cRes.json(); setCustomers(d.data || []) }
    if (lRes.ok) { const d = await lRes.json(); setLeads(d.data || []) }
    if (eRes.ok) { const d = await eRes.json(); setEvents(d.data || []) }
  }, [search, planFilter])

  useEffect(() => { fetchAll() }, [fetchAll])

  const statCards = stats ? [
    { label: 'Total Customers', value: stats.totalTenants, icon: Building2, color: 'text-blue-600 bg-blue-50' },
    { label: 'Docs Today', value: stats.docsToday, icon: FileCheck, color: 'text-green-600 bg-green-50' },
    { label: 'Docs This Month', value: stats.docsMonth, icon: FileCheck, color: 'text-indigo-600 bg-indigo-50' },
    { label: 'Active Seals', value: stats.activeSeals, icon: ShieldCheck, color: 'text-purple-600 bg-purple-50' },
    { label: 'Signups This Week', value: stats.signupsThisWeek, icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Total Documents', value: stats.totalDocs, icon: FileCheck, color: 'text-cyan-600 bg-cyan-50' },
    { label: 'Total Bundles', value: stats.totalBundles, icon: FolderSearch, color: 'text-orange-600 bg-orange-50' },
  ] : []

  return (
    <div className="space-y-8 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold text-[var(--admin-text)]">Dashboard</h1>
        <p className="text-sm text-[var(--admin-text-secondary)] mt-1">Platform overview and customer management</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="bg-[var(--admin-card)] rounded-xl border border-[var(--admin-border)] p-4">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>
              <s.icon size={18} />
            </div>
            <div className="text-2xl font-bold text-[var(--admin-text)]">{s.value.toLocaleString()}</div>
            <div className="text-xs text-[var(--admin-text-muted)] mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Customers */}
      <div className="bg-[var(--admin-card)] rounded-xl border border-[var(--admin-border)]">
        <div className="flex items-center justify-between p-5 border-b border-[var(--admin-border)]">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-[var(--admin-text-secondary)]" />
            <h2 className="text-lg font-semibold text-[var(--admin-text)]">Customers</h2>
            <span className="text-sm text-[var(--admin-text-muted)]">({customers.length})</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)]" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-3 py-1.5 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] text-sm w-48 focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50"
              />
            </div>
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50"
            >
              <option value="">All Plans</option>
              <option value="FREE">Free</option>
              <option value="STARTER">Starter</option>
              <option value="PRO">Pro</option>
              <option value="ENTERPRISE">Enterprise</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-bg)]">
                <th className="text-left px-5 py-3 font-medium text-[var(--admin-text-secondary)]">Organization</th>
                <th className="text-left px-5 py-3 font-medium text-[var(--admin-text-secondary)]">Owner</th>
                <th className="text-left px-5 py-3 font-medium text-[var(--admin-text-secondary)]">Plan</th>
                <th className="text-right px-5 py-3 font-medium text-[var(--admin-text-secondary)]">Docs</th>
                <th className="text-right px-5 py-3 font-medium text-[var(--admin-text-secondary)]">Seals</th>
                <th className="text-right px-5 py-3 font-medium text-[var(--admin-text-secondary)]">Last Active</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-[var(--admin-border)] hover:bg-[var(--admin-bg)] transition-colors">
                  <td className="px-5 py-3">
                    <div className="font-medium text-[var(--admin-text)]">{c.name}</div>
                    <div className="text-xs text-[var(--admin-text-muted)]">{c.email}</div>
                  </td>
                  <td className="px-5 py-3 text-[var(--admin-text-secondary)]">{c.ownerName || '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${planColors[c.plan] || 'bg-slate-100 text-slate-600'}`}>
                      {c.plan}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-[var(--admin-text)]">{c.docsProcessed}</td>
                  <td className="px-5 py-3 text-right text-[var(--admin-text)]">{c.sealsIssued}</td>
                  <td className="px-5 py-3 text-right text-[var(--admin-text-muted)]">{relativeTime(c.lastActive)}</td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-[var(--admin-text-muted)]">No customers found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hot Leads + Engagement side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hot Leads */}
        <div className="bg-[var(--admin-card)] rounded-xl border border-[var(--admin-border)]">
          <div className="flex items-center gap-2 p-5 border-b border-[var(--admin-border)]">
            <Flame size={18} className="text-orange-500" />
            <h2 className="text-lg font-semibold text-[var(--admin-text)]">Hot Leads</h2>
            <span className="text-sm text-[var(--admin-text-muted)]">({leads.length})</span>
          </div>
          <div className="divide-y divide-[var(--admin-border)] max-h-80 overflow-y-auto">
            {leads.map((l) => (
              <div key={l.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm text-[var(--admin-text)]">{l.name}</div>
                  <div className="text-xs text-[var(--admin-text-muted)]">{l.email}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-orange-600">{l.docsProcessed} docs</div>
                  <div className="text-xs text-[var(--admin-text-muted)]">Free plan</div>
                </div>
              </div>
            ))}
            {leads.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-[var(--admin-text-muted)]">No hot leads yet</div>
            )}
          </div>
        </div>

        {/* Recent Engagement */}
        <div className="bg-[var(--admin-card)] rounded-xl border border-[var(--admin-border)]">
          <div className="flex items-center gap-2 p-5 border-b border-[var(--admin-border)]">
            <Activity size={18} className="text-[var(--admin-accent)]" />
            <h2 className="text-lg font-semibold text-[var(--admin-text)]">Recent Engagement</h2>
          </div>
          <div className="divide-y divide-[var(--admin-border)] max-h-80 overflow-y-auto">
            {events.map((e) => (
              <div key={e.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm text-[var(--admin-text)]">
                    <span className="font-medium">{e.tenantName}</span>
                    <span className="text-[var(--admin-text-muted)]"> — </span>
                    <span className="text-[var(--admin-text-secondary)]">{e.eventType.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="text-xs text-[var(--admin-text-muted)]">{relativeTime(e.createdAt)}</div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${planColors[e.tenantPlan] || 'bg-slate-100 text-slate-600'}`}>
                  {e.tenantPlan}
                </span>
              </div>
            ))}
            {events.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-[var(--admin-text-muted)]">No recent events</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
