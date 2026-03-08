'use client'

import { useState, useEffect } from 'react'
import { apiGet } from '@/lib/api'
import { BarChart3, Shield, Clock, AlertTriangle, Users, Webhook } from 'lucide-react'

interface Metrics {
  timestamp: string
  uptime: { seconds: number; human: string }
  memory: { heapUsed: string; heapTotal: string; rss: string }
  auditLogs: { total: number; pending: number; confirmed: number; failed: number }
  anchoring: { failedLast24h: number; alert: string }
  users: { active: number }
  webhooks: { active: number; failedDeliveries: number; alert: string }
}

function StatCard({ label, value, icon: Icon, color = 'text-white' }: { label: string; value: string | number; icon: React.ElementType; color?: string }) {
  return (
    <div className="rounded-xl border border-white/8 px-5 py-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-white/5">
          <Icon size={18} className="text-white/40" />
        </div>
        <div>
          <div className={`text-xl font-bold ${color}`} style={{ fontFamily: 'Syne, sans-serif' }}>{value}</div>
          <div className="text-xs text-white/40 mt-0.5">{label}</div>
        </div>
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiGet('/api/metrics')
      .then(r => {
        if (!r.ok) throw new Error(r.status === 403 ? 'Requires system:admin permission' : 'Failed to load metrics')
        return r.json()
      })
      .then(d => { setMetrics(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  if (loading) return (
    <div className="p-6 animate-fade-up">
      <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Analytics</h1>
      <p className="text-white/30 text-sm mt-4">Loading metrics...</p>
    </div>
  )

  if (error) return (
    <div className="p-6 animate-fade-up">
      <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Analytics</h1>
      <div className="mt-6 rounded-xl border border-red-400/20 bg-red-400/5 px-5 py-4">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    </div>
  )

  if (!metrics) return null

  const integrityPct = metrics.auditLogs.total > 0
    ? Math.round(((metrics.auditLogs.confirmed + metrics.auditLogs.pending) / metrics.auditLogs.total) * 100)
    : 100

  return (
    <div className="p-6 space-y-6 animate-fade-up">
      <div>
        <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Analytics</h1>
        <p className="text-white/40 text-sm mt-1">System metrics and anchoring health</p>
      </div>

      {/* Audit Log Stats */}
      <div>
        <h2 className="text-sm font-medium text-white/50 uppercase tracking-wide mb-3">Audit Logs</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Records" value={metrics.auditLogs.total.toLocaleString()} icon={Shield} />
          <StatCard label="Confirmed" value={metrics.auditLogs.confirmed.toLocaleString()} icon={Shield} color="text-green-400" />
          <StatCard label="Pending" value={metrics.auditLogs.pending.toLocaleString()} icon={Clock} color="text-yellow-400" />
          <StatCard label="Failed" value={metrics.auditLogs.failed.toLocaleString()} icon={AlertTriangle} color={metrics.auditLogs.failed > 0 ? 'text-red-400' : 'text-white'} />
        </div>
      </div>

      {/* Integrity + System */}
      <div>
        <h2 className="text-sm font-medium text-white/50 uppercase tracking-wide mb-3">System Health</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Integrity Score" value={`${integrityPct}%`} icon={Shield} color={integrityPct === 100 ? 'text-green-400' : 'text-yellow-400'} />
          <StatCard label="Active Users" value={metrics.users.active} icon={Users} />
          <StatCard label="Active Webhooks" value={metrics.webhooks.active} icon={Webhook} />
          <StatCard label="Failed Deliveries" value={metrics.webhooks.failedDeliveries} icon={AlertTriangle} color={metrics.webhooks.failedDeliveries > 0 ? 'text-yellow-400' : 'text-white'} />
        </div>
      </div>

      {/* Anchoring Health */}
      <div>
        <h2 className="text-sm font-medium text-white/50 uppercase tracking-wide mb-3">Anchoring</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-white/8 px-5 py-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="text-xs text-white/40 mb-1">Failures (last 24h)</div>
            <div className={`text-2xl font-bold ${metrics.anchoring.failedLast24h > 0 ? 'text-red-400' : 'text-green-400'}`}
              style={{ fontFamily: 'Syne, sans-serif' }}>
              {metrics.anchoring.failedLast24h}
            </div>
            <div className={`text-xs mt-1 ${metrics.anchoring.alert === 'ok' ? 'text-green-400/60' : 'text-red-400/60'}`}>
              {metrics.anchoring.alert}
            </div>
          </div>
          <div className="rounded-xl border border-white/8 px-5 py-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="text-xs text-white/40 mb-1">Server Uptime</div>
            <div className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
              {metrics.uptime.human}
            </div>
            <div className="text-xs text-white/30 mt-1">
              Memory: {metrics.memory.heapUsed} / {metrics.memory.heapTotal}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
