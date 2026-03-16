'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
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
      <span className="hash-mono text-[var(--tulip-forest)]/40" style={{ fontSize: 11 }}>
        {short ? `${hash.slice(0, 8)}…${hash.slice(-6)}` : hash}
      </span>
      <button onClick={copy} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} className="text-[var(--tulip-forest)]/40" />}
      </button>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    confirmed:  'bg-green-400/10 text-green-400 border-green-400/20',
    pending:    'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
    processing: 'bg-[var(--tulip-gold)]/10 text-[var(--tulip-forest)] border-[var(--tulip-gold)]/30',
    failed:     'bg-red-400/10 text-red-400 border-red-400/20',
  }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border font-medium capitalize ${map[status] ?? map.pending}`}>
      {status}
    </span>
  )
}

export default function AuditPage() {
  const t = useTranslations()
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
  const filterLabel = (f: string) => {
    const labels: Record<string, string> = { all: t('audit.all'), confirmed: t('audit.confirmed'), pending: t('audit.pending'), failed: t('audit.failed') }
    return labels[f] ?? f
  }
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
          <h1 className="text-2xl font-bold text-[var(--tulip-forest)]" style={{ fontFamily: 'Inter, sans-serif' }}>{t('audit.title')}</h1>
          <p className="text-[var(--tulip-forest)]/60 text-sm mt-1">{t('audit.subtitle', { total })}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowExport(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-[var(--tulip-forest)] hover:opacity-90 transition-opacity bg-[var(--tulip-gold)] hover:bg-[var(--tulip-orange)]">
            <Download size={14} />
            {t('audit.export')}
          </button>
          <button onClick={() => load(page)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)] border border-[var(--tulip-sage-dark)] hover:border-[var(--tulip-sage-dark)] transition-all">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {t('audit.refresh')}
          </button>
        </div>
      </div>

      {/* Export Panel */}
      {showExport && (
        <div className="rounded-xl border border-[var(--tulip-sage-dark)] p-5 space-y-5" style={{ background: 'var(--tulip-sage)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <FileArchive size={18} className="text-[var(--tulip-forest)]" />
              <h3 className="text-[var(--tulip-forest)] font-semibold text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>{t('audit.exportAuditLog')}</h3>
            </div>
            <button onClick={() => setShowExport(false)} className="text-[var(--tulip-forest)]/40 hover:text-[var(--tulip-forest)] transition-colors">
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Date range */}
            <div>
              <label className="block text-[var(--tulip-forest)]/40 text-xs mb-1.5">{t('audit.from')}</label>
              <input type="date" value={exportOpts.from} onChange={e => setExportOpts(o => ({ ...o, from: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] text-[var(--tulip-forest)] text-sm outline-none focus:border-[var(--tulip-gold)] transition-colors" />
            </div>
            <div>
              <label className="block text-[var(--tulip-forest)]/40 text-xs mb-1.5">{t('audit.to')}</label>
              <input type="date" value={exportOpts.to} onChange={e => setExportOpts(o => ({ ...o, to: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] text-[var(--tulip-forest)] text-sm outline-none focus:border-[var(--tulip-gold)] transition-colors" />
            </div>

            {/* Status filter */}
            <div>
              <label className="block text-[var(--tulip-forest)]/40 text-xs mb-1.5">{t('audit.status')}</label>
              <select value={exportOpts.anchorStatus} onChange={e => setExportOpts(o => ({ ...o, anchorStatus: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] text-[var(--tulip-forest)] text-sm outline-none focus:border-[var(--tulip-gold)] transition-colors appearance-none">
                <option value="all">{t('audit.allStatuses')}</option>
                <option value="confirmed">{t('audit.confirmed')}</option>
                <option value="pending">{t('audit.pending')}</option>
                <option value="failed">{t('audit.failed')}</option>
              </select>
            </div>

            {/* Entity type filter */}
            <div>
              <label className="block text-[var(--tulip-forest)]/40 text-xs mb-1.5">{t('audit.entityType')}</label>
              <select value={exportOpts.entityType} onChange={e => setExportOpts(o => ({ ...o, entityType: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] text-[var(--tulip-forest)] text-sm outline-none focus:border-[var(--tulip-gold)] transition-colors appearance-none">
                <option value="all">{t('audit.allTypes')}</option>
                <option value="Document">{t('audit.documents')}</option>
                <option value="Expense">{t('audit.expenses')}</option>
                <option value="Project">{t('audit.projects')}</option>
                <option value="FundingSource">{t('audit.funding')}</option>
                <option value="User">{t('audit.users')}</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            {/* Include files toggle */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <button onClick={() => setExportOpts(o => ({ ...o, includeFiles: !o.includeFiles }))}
                className={`w-9 h-5 rounded-full transition-colors relative ${exportOpts.includeFiles ? 'bg-[var(--tulip-gold)]' : 'bg-[var(--tulip-sage)]'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${exportOpts.includeFiles ? 'left-[18px]' : 'left-0.5'}`} />
              </button>
              <span className="text-[var(--tulip-forest)]/60 text-sm">{t('audit.includeFiles')}</span>
            </label>

            <button onClick={doExport} disabled={exporting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-[var(--tulip-forest)] hover:opacity-90 transition-opacity disabled:opacity-50 bg-[var(--tulip-gold)] hover:bg-[var(--tulip-orange)]">
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {exporting ? t('audit.exporting') : t('audit.downloadZip')}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-3 py-2">
          <Search size={14} className="text-[var(--tulip-forest)]/40" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('audit.searchPlaceholder')}
            className="bg-transparent text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none w-48" />
        </div>
        <div className="flex items-center gap-1 bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg p-1">
          {['all', 'confirmed', 'pending', 'failed'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all ${
                filter === f ? 'bg-[var(--tulip-gold)] text-[var(--tulip-forest)]' : 'text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)]'
              }`}>
              {filterLabel(f)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[var(--tulip-sage-dark)] overflow-hidden"
        style={{ background: 'var(--tulip-sage)' }}>
        <div className="grid grid-cols-[1fr_1fr_1fr_2fr_1fr_1fr_32px] gap-3 px-5 py-3 border-b border-[var(--tulip-sage-dark)] text-xs text-[var(--tulip-forest)]/40 uppercase tracking-wide font-medium">
          <span>{t('audit.action')}</span><span>{t('audit.entity')}</span><span>{t('audit.project')}</span><span>{t('audit.hash')}</span><span>{t('audit.status')}</span><span>{t('audit.date')}</span><span/>
        </div>

        {loading ? (
          <div className="p-8 text-center text-[var(--tulip-forest)]/40 text-sm">{t('audit.loadingEntries')}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <Shield size={32} className="text-[var(--tulip-forest)]/30" />
            <p className="text-[var(--tulip-forest)]/40 text-sm">{t('audit.noEntries')}</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--tulip-sage-dark)]">
            {filtered.map(entry => (
              <div key={entry.id}
                className="grid grid-cols-[1fr_1fr_1fr_2fr_1fr_1fr_32px] gap-3 items-center px-5 py-3 hover:bg-[var(--tulip-sage)]/50 transition-colors">
                <div className="text-sm font-medium text-[var(--tulip-forest)] truncate">{entry.action}</div>
                <div>
                  <div className="text-xs text-[var(--tulip-forest)]/60 truncate">{entry.entityType}</div>
                  <div className="text-xs text-[var(--tulip-forest)]/40 truncate">{entry.entityId}</div>
                </div>
                <div className="text-sm text-[var(--tulip-forest)]/60 truncate">{entry.projectName ?? '—'}</div>
                <div className="min-w-0">
                  <HashCell hash={entry.dataHash} short />
                  {entry.blockNumber && (
                    <div className="text-xs text-[var(--tulip-forest)]/30 mt-0.5">Block #{entry.blockNumber.toLocaleString()}</div>
                  )}
                </div>
                <StatusBadge status={entry.anchorStatus || 'pending'} />
                <div className="text-xs text-[var(--tulip-forest)]/40">
                  {new Date(entry.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="flex items-center gap-1">
                  <Link href={`/verify?hash=${entry.dataHash}`} target="_blank"
                    className="text-[var(--tulip-forest)]/30 hover:text-[var(--tulip-forest)] transition-colors" title="Verify">
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
          <span className="text-[var(--tulip-forest)]/40">{t('audit.showing', { from: ((page-1)*limit)+1, to: Math.min(page*limit, total), total })}</span>
          <div className="flex gap-2">
            <button onClick={() => { setPage(p => p-1); load(page-1) }} disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-[var(--tulip-sage-dark)] text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)] disabled:opacity-30 transition-all">
              {t('audit.previous')}
            </button>
            <button onClick={() => { setPage(p => p+1); load(page+1) }} disabled={page * limit >= total}
              className="px-3 py-1.5 rounded-lg border border-[var(--tulip-sage-dark)] text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)] disabled:opacity-30 transition-all">
              {t('audit.next')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
