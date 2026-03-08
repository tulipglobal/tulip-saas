'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Shield, ExternalLink, Copy, Check, Search, RefreshCw, ChevronDown, ChevronUp, FileCheck } from 'lucide-react'

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
  ancheredAt: string | null
  createdAt: string
  userId: string | null
  metadata?: any
}

function HashCell({ hash, short = false }: { hash: string; short?: boolean }) {
  const [copied, setCopied] = useState(false)
  const copy = (e: React.MouseEvent) => {
    e.stopPropagation()
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
      {status || 'pending'}
    </span>
  )
}

function ActionBadge({ action }: { action: string }) {
  const color = action.includes('CREATE') ? 'text-emerald-400' :
                action.includes('DELETE') ? 'text-red-400' :
                action.includes('UPDATE') ? 'text-blue-400' :
                action.includes('UPLOAD') ? 'text-purple-400' :
                action.includes('REVERSE') ? 'text-orange-400' : 'text-white/60'
  return <span className={`text-xs font-mono font-medium ${color}`}>{action}</span>
}

function AuditRow({ entry, onViewDoc }: { entry: AuditEntry; onViewDoc: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const meta = entry.metadata || {}

  return (
    <>
      <div
        className="grid grid-cols-[1.5fr_1fr_1fr_1.5fr_1fr_1fr_60px] gap-3 items-center px-5 py-3 hover:bg-white/2 transition-colors cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <ActionBadge action={entry.action} />
        <div>
          <div className="text-xs text-white/60 font-medium">{entry.entityType}</div>
        </div>
        {/* Project */}
        <div className="text-xs text-white/40 truncate">
          {meta.projectName || meta.projectId ? (
            <span className="text-[#369bff]/70">{meta.projectName || meta.projectId?.slice(0, 8)}</span>
          ) : '—'}
        </div>
        {/* Hash */}
        <div className="min-w-0" onClick={e => e.stopPropagation()}>
          <HashCell hash={entry.dataHash} short />
        </div>
        <StatusBadge status={entry.anchorStatus} />
        {/* Date + Time */}
        <div className="text-xs text-white/30">
          <div>{new Date(entry.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}</div>
          <div className="text-white/20">{new Date(entry.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          <Link href={`/verify?hash=${entry.dataHash}`} target="_blank"
            className="text-white/20 hover:text-[#369bff] transition-colors" title="Verify">
            <Shield size={12} />
          </Link>
          {entry.blockchainTx && (
            <Link href={`https://amoy.polygonscan.com/tx/${entry.blockchainTx}`} target="_blank"
              className="text-white/20 hover:text-[#34d399] transition-colors" title="Polygonscan">
              <ExternalLink size={12} />
            </Link>
          )}
          <span className="text-white/20">{expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</span>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-5 pb-4 bg-white/1 border-t border-white/5">
          <div className="pt-3 grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <p className="text-xs text-white/30 uppercase tracking-wide font-medium">Record Details</p>
              <div className="space-y-1.5">
                <div className="flex gap-3">
                  <span className="text-xs text-white/30 w-24 shrink-0">Entity ID</span>
                  <span className="text-xs font-mono text-white/50 truncate">{entry.entityId}</span>
                </div>
                {meta.name && <div className="flex gap-3"><span className="text-xs text-white/30 w-24 shrink-0">Name</span><span className="text-xs text-white/60">{meta.name}</span></div>}
                {meta.amount && <div className="flex gap-3"><span className="text-xs text-white/30 w-24 shrink-0">Amount</span><span className="text-xs text-white/60">{meta.currency} {meta.amount}</span></div>}
                {meta.expenseDescription && <div className="flex gap-3"><span className="text-xs text-white/30 w-24 shrink-0">Description</span><span className="text-xs text-white/60">{meta.expenseDescription}</span></div>}
                {meta.documentLevel && <div className="flex gap-3"><span className="text-xs text-white/30 w-24 shrink-0">Doc Level</span><span className="text-xs text-white/60 capitalize">{meta.documentLevel}</span></div>}
                {meta.fileType && <div className="flex gap-3"><span className="text-xs text-white/30 w-24 shrink-0">File Type</span><span className="text-xs text-white/60 uppercase">{meta.fileType}</span></div>}
                {meta.sha256Hash && (
                  <div className="flex gap-3">
                    <span className="text-xs text-white/30 w-24 shrink-0">File Hash</span>
                    <span className="text-xs font-mono text-white/40 truncate">{meta.sha256Hash.slice(0, 16)}…</span>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-white/30 uppercase tracking-wide font-medium">Blockchain</p>
              <div className="space-y-1.5">
                {entry.blockchainTx && (
                  <div className="flex gap-3">
                    <span className="text-xs text-white/30 w-24 shrink-0">TX Hash</span>
                    <span className="text-xs font-mono text-white/40 truncate">{entry.blockchainTx.slice(0, 16)}…</span>
                  </div>
                )}
                {entry.blockNumber && (
                  <div className="flex gap-3">
                    <span className="text-xs text-white/30 w-24 shrink-0">Block</span>
                    <span className="text-xs text-white/60">#{entry.blockNumber.toLocaleString()}</span>
                  </div>
                )}
                {entry.ancheredAt && (
                  <div className="flex gap-3">
                    <span className="text-xs text-white/30 w-24 shrink-0">Anchored</span>
                    <span className="text-xs text-white/60">{new Date(entry.ancheredAt).toLocaleString('en-GB')}</span>
                  </div>
                )}
                {entry.batchId && (
                  <div className="flex gap-3">
                    <span className="text-xs text-white/30 w-24 shrink-0">Batch ID</span>
                    <span className="text-xs font-mono text-white/40 truncate">{entry.batchId.slice(0, 16)}…</span>
                  </div>
                )}
              </div>
              {/* View document button if this is a document upload */}
              {entry.action === 'DOCUMENT_UPLOADED' && (
                <button onClick={() => onViewDoc(entry.entityId)}
                  className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-white tulip-gradient hover:opacity-90 transition-opacity">
                  <FileCheck size={12} /> View Document
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [entityFilter, setEntityFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 20

  const load = (p = 1) => {
    setLoading(true)
    const token = localStorage.getItem('tulip_token')
    const params = new URLSearchParams({ limit: String(limit), page: String(p) })
    if (filter !== 'all') params.set('anchorStatus', filter)
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/audit?${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : { items: [], total: 0 })
      .then(d => { setEntries(d.data ?? d.items ?? []); setTotal(d.total ?? 0); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load(1); setPage(1) }, [filter])

  const viewDoc = async (entityId: string) => {
    const token = localStorage.getItem('tulip_token')
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/documents/${entityId}/view`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const data = await res.json()
    if (data.url) window.open(data.url, '_blank')
  }

  const entityTypes = ['all', ...Array.from(new Set(entries.map(e => e.entityType)))]

  const filtered = entries
    .filter(e => entityFilter === 'all' || e.entityType === entityFilter)
    .filter(e =>
      e.action.toLowerCase().includes(search.toLowerCase()) ||
      e.entityType.toLowerCase().includes(search.toLowerCase()) ||
      e.dataHash.includes(search)
    )

  return (
    <div className="p-6 space-y-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Audit Log</h1>
          <p className="text-white/40 text-sm mt-1">{total} entries — immutable blockchain hash chain</p>
        </div>
        <button onClick={() => load(page)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white border border-white/10 hover:border-white/20 transition-all">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
          <Search size={14} className="text-white/30" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search action, entity, hash…"
            className="bg-transparent text-sm text-white/70 placeholder-white/30 outline-none w-48" />
        </div>
        {/* Status filter */}
        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
          {['all', 'confirmed', 'pending', 'failed'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all ${
                filter === f ? 'bg-[#0c7aed] text-white' : 'text-white/40 hover:text-white'
              }`}>{f}</button>
          ))}
        </div>
        {/* Entity type filter */}
        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
          {entityTypes.map(t => (
            <button key={t} onClick={() => setEntityFilter(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all ${
                entityFilter === t ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white'
              }`}>{t}</button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-white/8 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="grid grid-cols-[1.5fr_1fr_1fr_1.5fr_1fr_1fr_60px] gap-3 px-5 py-3 border-b border-white/8 text-xs text-white/30 uppercase tracking-wide font-medium">
          <span>Action</span><span>Entity</span><span>Project</span><span>Hash</span><span>Status</span><span>Date/Time</span><span/>
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
              <AuditRow key={entry.id} entry={entry} onViewDoc={viewDoc} />
            ))}
          </div>
        )}
      </div>

      {total > limit && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/30">Showing {((page-1)*limit)+1}–{Math.min(page*limit, total)} of {total}</span>
          <div className="flex gap-2">
            <button onClick={() => { const p = page-1; setPage(p); load(p) }} disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-white/10 text-white/50 hover:text-white disabled:opacity-30 transition-all">
              Previous
            </button>
            <button onClick={() => { const p = page+1; setPage(p); load(p) }} disabled={page * limit >= total}
              className="px-3 py-1.5 rounded-lg border border-white/10 text-white/50 hover:text-white disabled:opacity-30 transition-all">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
