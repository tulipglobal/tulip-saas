'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Shield, ExternalLink, Copy, Check, Search, RefreshCw } from 'lucide-react'

interface AuditEntry {
  id: string
  action: string
  entityType: string
  entityId: string
  dataHash: string
  prevHash: string | null
  batchId: string | null
  anchorStatus: string
  blockchainTx: string | null
  blockNumber: number | null
  createdAt: string
  userId: string | null
}

function HashCell({ hash, short = false }: { hash: string; short?: boolean }) {
  const [copied, setCopied] = useState(false)
  const copy = (e: React.MouseEvent) => {
    e.preventDefault()
    navigator.clipboard.writeText(hash)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="flex items-center gap-1.5 group">
      <span className="hash-mono text-white/35" style={{ fontSize: 11 }}>
        {short ? `${hash.slice(0, 8)}…${hash.slice(-6)}` : hash}
      </span>
      <button onClick={copy} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} className="text-white/30" />}
      </button>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    confirmed:  'bg-green-400/10 text-green-400 border-green-400/20',
    pending:    'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
    processing: 'bg-blue-400/10 text-[#369bff] border-blue-400/20',
    failed:     'bg-red-400/10 text-red-400 border-red-400/20',
  }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border font-medium capitalize ${map[status] ?? map.pending}`}>
      {status}
    </span>
  )
}

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 20

  const load = (p = 1) => {
    setLoading(true)
    const params = new URLSearchParams({ limit: String(limit), page: String(p) })
    if (filter !== 'all') params.set('anchorStatus', filter)
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/audit?${params}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { items: [], total: 0 })
      .then(d => { setEntries(d.items ?? []); setTotal(d.total ?? 0); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load(1); setPage(1) }, [filter])

  const filtered = entries.filter(e =>
    e.action.toLowerCase().includes(search.toLowerCase()) ||
    e.entityType.toLowerCase().includes(search.toLowerCase()) ||
    e.dataHash.includes(search)
  )

  return (
    <div className="p-6 space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Audit Log</h1>
          <p className="text-white/40 text-sm mt-1">{total} entries — immutable blockchain hash chain</p>
        </div>
        <button onClick={() => load(page)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white border border-white/10 hover:border-white/20 transition-all">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
          <Search size={14} className="text-white/30" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search action, entity, hash…"
            className="bg-transparent text-sm text-white/70 placeholder-white/30 outline-none w-48" />
        </div>
        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
          {['all', 'confirmed', 'pending', 'failed'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all ${
                filter === f ? 'bg-[#0c7aed] text-white' : 'text-white/40 hover:text-white'
              }`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/8 overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="grid grid-cols-[1fr_1fr_2fr_1fr_1fr_32px] gap-3 px-5 py-3 border-b border-white/8 text-xs text-white/30 uppercase tracking-wide font-medium">
          <span>Action</span><span>Entity</span><span>Hash</span><span>Status</span><span>Date</span><span/>
        </div>

        {loading ? (
          <div className="p-8 text-center text-white/30 text-sm">Loading audit entries…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <Shield size={32} className="text-white/10" />
            <p className="text-white/30 text-sm">No audit entries found</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.map(entry => (
              <div key={entry.id}
                className="grid grid-cols-[1fr_1fr_2fr_1fr_1fr_32px] gap-3 items-center px-5 py-3 hover:bg-white/2 transition-colors">
                <div className="text-sm font-medium text-white/80 truncate">{entry.action}</div>
                <div>
                  <div className="text-xs text-white/50 truncate">{entry.entityType}</div>
                  <div className="text-xs text-white/25 truncate">{entry.entityId}</div>
                </div>
                <div className="min-w-0">
                  <HashCell hash={entry.dataHash} short />
                  {entry.blockNumber && (
                    <div className="text-xs text-white/20 mt-0.5">Block #{entry.blockNumber.toLocaleString()}</div>
                  )}
                </div>
                <StatusBadge status={entry.anchorStatus} />
                <div className="text-xs text-white/30">
                  {new Date(entry.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                </div>
                <div className="flex items-center gap-1">
                  <Link href={`/verify?hash=${entry.dataHash}`} target="_blank"
                    className="text-white/20 hover:text-[#369bff] transition-colors" title="Verify">
                    <Shield size={13} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/30">Showing {((page-1)*limit)+1}–{Math.min(page*limit, total)} of {total}</span>
          <div className="flex gap-2">
            <button onClick={() => { setPage(p => p-1); load(page-1) }} disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-white/10 text-white/50 hover:text-white disabled:opacity-30 transition-all">
              Previous
            </button>
            <button onClick={() => { setPage(p => p+1); load(page+1) }} disabled={page * limit >= total}
              className="px-3 py-1.5 rounded-lg border border-white/10 text-white/50 hover:text-white disabled:opacity-30 transition-all">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
