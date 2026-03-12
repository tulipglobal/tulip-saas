'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Shield, Copy, Check, Search, RefreshCw, Download, X, FileArchive, Loader2 } from 'lucide-react'
import { apiGet } from '@/lib/api'

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
  projectName: string | null
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
      <span className="hash-mono text-[#183a1d]/40" style={{ fontSize: 11 }}>
        {short ? `${hash.slice(0, 8)}…${hash.slice(-6)}` : hash}
      </span>
      <button onClick={copy} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} className="text-[#183a1d]/40" />}
      </button>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    confirmed:  'bg-green-400/10 text-green-400 border-green-400/20',
    pending:    'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
    processing: 'bg-[#f6c453]/10 text-[#183a1d] border-[#f6c453]/30',
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
  const [showExport, setShowExport] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportOpts, setExportOpts] = useState({
    from: '',
    to: '',
    anchorStatus: 'all',
    entityType: 'all',
    includeFiles: true,
  })
  const limit = 20

  const load = (p = 1) => {
    setLoading(true)
    const params = new URLSearchParams({ limit: String(limit), page: String(p) })
    if (filter !== 'all') params.set('anchorStatus', filter)
    apiGet(`/api/audit?${params}`)
      .then(r => r.ok ? r.json() : { items: [], total: 0 })
      .then(d => { setEntries(d.data ?? d.items ?? []); setTotal(d.pagination?.total ?? d.total ?? 0); setLoading(false) })
      .catch(() => setLoading(false))
  }

  const doExport = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (exportOpts.anchorStatus !== 'all') params.set('anchorStatus', exportOpts.anchorStatus)
      if (exportOpts.entityType !== 'all')   params.set('entityType', exportOpts.entityType)
      if (exportOpts.from) params.set('from', exportOpts.from)
      if (exportOpts.to)   params.set('to', exportOpts.to)
      if (exportOpts.includeFiles) params.set('includeFiles', 'true')

      const token = localStorage.getItem('tulip_token')
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/audit/export?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const today = new Date().toISOString().slice(0, 10)
      a.download = `tulip-audit-export-${today}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setShowExport(false)
    } catch {
      // silently fail — user sees the button stop spinning
    } finally {
      setExporting(false)
    }
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
          <h1 className="text-2xl font-bold text-[#183a1d]" style={{ fontFamily: 'Inter, sans-serif' }}>Audit Log</h1>
          <p className="text-[#183a1d]/60 text-sm mt-1">{total} entries — immutable blockchain hash chain</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowExport(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-[#183a1d] hover:opacity-90 transition-opacity bg-[#f6c453] hover:bg-[#f0a04b]">
            <Download size={14} />
            Export
          </button>
          <button onClick={() => load(page)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#183a1d]/60 hover:text-[#183a1d] border border-[#c8d6c0] hover:border-[#c8d6c0] transition-all">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Export Panel */}
      {showExport && (
        <div className="rounded-xl border border-[#c8d6c0] p-5 space-y-5" style={{ background: '#e1eedd' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <FileArchive size={18} className="text-[#183a1d]" />
              <h3 className="text-[#183a1d] font-semibold text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>Export Audit Log</h3>
            </div>
            <button onClick={() => setShowExport(false)} className="text-[#183a1d]/40 hover:text-[#183a1d] transition-colors">
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Date range */}
            <div>
              <label className="block text-[#183a1d]/40 text-xs mb-1.5">From</label>
              <input type="date" value={exportOpts.from} onChange={e => setExportOpts(o => ({ ...o, from: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-[#e1eedd] border border-[#c8d6c0] text-[#183a1d] text-sm outline-none focus:border-[#f6c453] transition-colors" />
            </div>
            <div>
              <label className="block text-[#183a1d]/40 text-xs mb-1.5">To</label>
              <input type="date" value={exportOpts.to} onChange={e => setExportOpts(o => ({ ...o, to: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-[#e1eedd] border border-[#c8d6c0] text-[#183a1d] text-sm outline-none focus:border-[#f6c453] transition-colors" />
            </div>

            {/* Status filter */}
            <div>
              <label className="block text-[#183a1d]/40 text-xs mb-1.5">Status</label>
              <select value={exportOpts.anchorStatus} onChange={e => setExportOpts(o => ({ ...o, anchorStatus: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-[#e1eedd] border border-[#c8d6c0] text-[#183a1d] text-sm outline-none focus:border-[#f6c453] transition-colors appearance-none">
                <option value="all">All statuses</option>
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            {/* Entity type filter */}
            <div>
              <label className="block text-[#183a1d]/40 text-xs mb-1.5">Entity type</label>
              <select value={exportOpts.entityType} onChange={e => setExportOpts(o => ({ ...o, entityType: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-[#e1eedd] border border-[#c8d6c0] text-[#183a1d] text-sm outline-none focus:border-[#f6c453] transition-colors appearance-none">
                <option value="all">All types</option>
                <option value="Document">Documents</option>
                <option value="Expense">Expenses</option>
                <option value="Project">Projects</option>
                <option value="FundingSource">Funding</option>
                <option value="User">Users</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            {/* Include files toggle */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <button onClick={() => setExportOpts(o => ({ ...o, includeFiles: !o.includeFiles }))}
                className={`w-9 h-5 rounded-full transition-colors relative ${exportOpts.includeFiles ? 'bg-[#f6c453]' : 'bg-[#e1eedd]'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${exportOpts.includeFiles ? 'left-[18px]' : 'left-0.5'}`} />
              </button>
              <span className="text-[#183a1d]/60 text-sm">Include document files in ZIP</span>
            </label>

            <button onClick={doExport} disabled={exporting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-[#183a1d] hover:opacity-90 transition-opacity disabled:opacity-50 bg-[#f6c453] hover:bg-[#f0a04b]">
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {exporting ? 'Exporting…' : 'Download ZIP'}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-[#e1eedd] border border-[#c8d6c0] rounded-lg px-3 py-2">
          <Search size={14} className="text-[#183a1d]/40" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search action, entity, hash…"
            className="bg-transparent text-sm text-[#183a1d] placeholder-[#183a1d]/40 outline-none w-48" />
        </div>
        <div className="flex items-center gap-1 bg-[#e1eedd] border border-[#c8d6c0] rounded-lg p-1">
          {['all', 'confirmed', 'pending', 'failed'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all ${
                filter === f ? 'bg-[#f6c453] text-[#183a1d]' : 'text-[#183a1d]/60 hover:text-[#183a1d]'
              }`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[#c8d6c0] overflow-hidden"
        style={{ background: '#e1eedd' }}>
        <div className="grid grid-cols-[1fr_1fr_1fr_2fr_1fr_1fr_32px] gap-3 px-5 py-3 border-b border-[#c8d6c0] text-xs text-[#183a1d]/40 uppercase tracking-wide font-medium">
          <span>Action</span><span>Entity</span><span>Project</span><span>Hash</span><span>Status</span><span>Date</span><span/>
        </div>

        {loading ? (
          <div className="p-8 text-center text-[#183a1d]/40 text-sm">Loading audit entries…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <Shield size={32} className="text-[#183a1d]/30" />
            <p className="text-[#183a1d]/40 text-sm">No audit entries found</p>
          </div>
        ) : (
          <div className="divide-y divide-[#c8d6c0]">
            {filtered.map(entry => (
              <div key={entry.id}
                className="grid grid-cols-[1fr_1fr_1fr_2fr_1fr_1fr_32px] gap-3 items-center px-5 py-3 hover:bg-[#e1eedd]/50 transition-colors">
                <div className="text-sm font-medium text-[#183a1d] truncate">{entry.action}</div>
                <div>
                  <div className="text-xs text-[#183a1d]/60 truncate">{entry.entityType}</div>
                  <div className="text-xs text-[#183a1d]/40 truncate">{entry.entityId}</div>
                </div>
                <div className="text-sm text-[#183a1d]/60 truncate">{entry.projectName ?? '—'}</div>
                <div className="min-w-0">
                  <HashCell hash={entry.dataHash} short />
                  {entry.blockNumber && (
                    <div className="text-xs text-[#183a1d]/30 mt-0.5">Block #{entry.blockNumber.toLocaleString()}</div>
                  )}
                </div>
                <StatusBadge status={entry.anchorStatus || 'pending'} />
                <div className="text-xs text-[#183a1d]/40">
                  {new Date(entry.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                </div>
                <div className="flex items-center gap-1">
                  <Link href={`/verify?hash=${entry.dataHash}`} target="_blank"
                    className="text-[#183a1d]/30 hover:text-[#183a1d] transition-colors" title="Verify">
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
          <span className="text-[#183a1d]/40">Showing {((page-1)*limit)+1}–{Math.min(page*limit, total)} of {total}</span>
          <div className="flex gap-2">
            <button onClick={() => { setPage(p => p-1); load(page-1) }} disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-[#c8d6c0] text-[#183a1d]/60 hover:text-[#183a1d] disabled:opacity-30 transition-all">
              Previous
            </button>
            <button onClick={() => { setPage(p => p+1); load(page+1) }} disabled={page * limit >= total}
              className="px-3 py-1.5 rounded-lg border border-[#c8d6c0] text-[#183a1d]/60 hover:text-[#183a1d] disabled:opacity-30 transition-all">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
