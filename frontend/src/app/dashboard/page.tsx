'use client'
import { apiGet } from '@/lib/api'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Shield, CheckCircle, Clock, AlertTriangle,
  TrendingUp, FileCheck, FolderOpen, Receipt,
  ArrowUpRight, ExternalLink, Copy, Check
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────
interface StatsData {
  totalDocuments: number
  verifiedDocuments: number
  pendingDocuments: number
  totalProjects: number
  totalExpenses: number
  recentAuditLogs: AuditEntry[]
}

interface AuditEntry {
  id: string
  action: string
  entityType: string
  dataHash: string
  anchorStatus: string
  blockchainTx: string | null
  createdAt: string
}

// ── Hash copy button ────────────────────────────────────────
function HashCell({ hash }: { hash: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(hash)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="flex items-center gap-2 group">
      <span className="hash-mono text-white/40 truncate max-w-[180px]">{hash}</span>
      <button onClick={copy} className="opacity-0 group-hover:opacity-100 transition-opacity">
        {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} className="text-white/30" />}
      </button>
    </div>
  )
}

// ── Status badge ────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    confirmed:  { label: 'Anchored',  cls: 'bg-green-400/10 text-green-400 border-green-400/20' },
    pending:    { label: 'Pending',   cls: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20' },
    processing: { label: 'Processing',cls: 'bg-blue-400/10 text-blue-400 border-blue-400/20' },
    failed:     { label: 'Failed',    cls: 'bg-red-400/10 text-red-400 border-red-400/20' },
  }
  const s = map[status] ?? map.pending
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium ${s.cls}`}>
      {s.label}
    </span>
  )
}

// ── Stat card ───────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string
}) {
  return (
    <div className="rounded-xl border border-white/8 p-5 flex items-start gap-4"
      style={{ background: 'rgba(255,255,255,0.03)' }}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={18} />
      </div>
      <div>
        <div className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>{value}</div>
        <div className="text-sm text-white/50 mt-0.5">{label}</div>
        {sub && <div className="text-xs text-white/30 mt-1">{sub}</div>}
      </div>
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────
export default function DashboardPage() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const API = process.env.NEXT_PUBLIC_API_URL
    Promise.all([
      apiGet('/api/audit?limit=100').then(r => r.ok ? r.json() : null),
    ]).then(([audit]) => {
      setStats({
        totalDocuments: audit?.pagination?.total ?? audit?.total ?? 0,
        verifiedDocuments: (audit?.data ?? audit?.items ?? []).filter((i: AuditEntry) => i.anchorStatus === 'confirmed').length,
        pendingDocuments: (audit?.data ?? audit?.items ?? []).filter((i: AuditEntry) => i.anchorStatus === 'pending').length,
        totalProjects: 0,
        totalExpenses: 0,
        recentAuditLogs: audit?.data ?? audit?.items ?? [],
      })
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const verified   = stats?.verifiedDocuments ?? 0
  const total      = stats?.totalDocuments ?? 0
  const pct        = total > 0 ? Math.round((verified / total) * 100) : 0

  return (
    <div className="p-6 space-y-6 animate-fade-up">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
            Overview
          </h1>
          <p className="text-white/40 text-sm mt-1">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link href="/verify" target="_blank"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[#369bff] border border-[#0c7aed]/30 hover:bg-[#0c7aed]/10 transition-all">
          <ExternalLink size={14} />
          Public Verifier
        </Link>
      </div>

      {/* Integrity banner */}
      <div className="rounded-xl border p-4 flex items-center gap-4"
        style={{
          background: pct === 100 ? 'rgba(34,197,94,0.05)' : 'rgba(234,179,8,0.05)',
          borderColor: pct === 100 ? 'rgba(34,197,94,0.2)' : 'rgba(234,179,8,0.2)'
        }}>
        {pct === 100
          ? <CheckCircle size={20} className="text-green-400 shrink-0" />
          : <AlertTriangle size={20} className="text-yellow-400 shrink-0" />
        }
        <div className="flex-1">
          <div className="text-sm font-medium text-white">
            {pct === 100 ? 'All records verified and blockchain anchored' : `${pct}% of records anchored to blockchain`}
          </div>
          <div className="text-xs text-white/40 mt-0.5">
            {verified} of {total} audit entries confirmed on Polygon
          </div>
        </div>
        <div className="text-2xl font-bold shrink-0"
          style={{ fontFamily: 'Syne, sans-serif', color: pct === 100 ? '#4ade80' : '#facc15' }}>
          {pct}%
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Shield}     label="Total Records"    value={loading ? '…' : total}     color="bg-blue-500/10 text-blue-400" />
        <StatCard icon={CheckCircle}label="Anchored"         value={loading ? '…' : verified}  color="bg-green-500/10 text-green-400" />
        <StatCard icon={Clock}      label="Pending"          value={loading ? '…' : stats?.pendingDocuments ?? 0} color="bg-yellow-500/10 text-yellow-400" />
        <StatCard icon={TrendingUp} label="Integrity Score"  value={loading ? '…' : `${pct}%`} color="bg-purple-500/10 text-purple-400" />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: FolderOpen, label: 'New Project',  href: '/dashboard/projects/new',  color: 'text-blue-400' },
          { icon: FileCheck,  label: 'Add Document', href: '/dashboard/documents/new', color: 'text-green-400' },
          { icon: Receipt,    label: 'Log Expense',  href: '/dashboard/expenses/new',  color: 'text-orange-400' },
        ].map(({ icon: Icon, label, href, color }) => (
          <Link key={href} href={href}
            className="flex items-center gap-3 p-4 rounded-xl border border-white/8 hover:border-white/15 hover:bg-white/3 transition-all group"
            style={{ background: 'rgba(255,255,255,0.02)' }}>
            <Icon size={18} className={`${color} group-hover:scale-110 transition-transform`} />
            <span className="text-sm font-medium text-white/70 group-hover:text-white transition-colors">{label}</span>
            <ArrowUpRight size={14} className="ml-auto text-white/20 group-hover:text-white/50 transition-colors" />
          </Link>
        ))}
      </div>

      {/* Recent audit log */}
      <div className="rounded-xl border border-white/8 overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <h2 className="font-semibold text-white text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>
            Recent Audit Log
          </h2>
          <Link href="/dashboard/audit" className="text-xs text-[#369bff] hover:underline">
            View all
          </Link>
        </div>

        {loading ? (
          <div className="p-8 text-center text-white/30 text-sm">Loading audit log…</div>
        ) : stats?.recentAuditLogs.length === 0 ? (
          <div className="p-8 text-center text-white/30 text-sm">No audit entries yet</div>
        ) : (
          <div className="divide-y divide-white/5">
            {stats?.recentAuditLogs.map((entry) => (
              <div key={entry.id} className="flex items-center gap-4 px-5 py-3 hover:bg-white/2 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-[#0c7aed]/10 flex items-center justify-center shrink-0">
                  <Shield size={14} className="text-[#369bff]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white/80">{entry.action}</span>
                    <span className="text-xs text-white/30">{entry.entityType}</span>
                  </div>
                  <HashCell hash={entry.dataHash} />
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge status={entry.anchorStatus} />
                  {entry.blockchainTx && (
                    <Link href={`https://amoy.polygonscan.com/tx/${entry.blockchainTx}`} target="_blank"
                      className="text-white/20 hover:text-[#369bff] transition-colors">
                      <ExternalLink size={13} />
                    </Link>
                  )}
                  <span className="text-xs text-white/25 hidden md:block">
                    {new Date(entry.createdAt).toLocaleDateString('en-GB')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
