'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import Link from 'next/link'
import { Receipt, Plus, Search, ExternalLink, Shield, Copy, Check, CheckCircle, ChevronDown, ChevronUp, FileCheck, Upload } from 'lucide-react'
import DocumentUploadSection from '@/components/DocumentUploadSection'
import BlockchainStatusPill from '@/components/BlockchainStatusPill'
import TrustSealCard from '@/components/TrustSealCard'

interface Document {
  id: string
  name: string
  sha256Hash: string | null
  fileType: string | null
  uploadedAt: string
}

interface Expense {
  id: string
  title: string
  description: string
  amount: number
  currency: string
  category: string | null
  subCategory: string | null
  expenseType: string | null
  vendor: string | null
  expenseDate: string
  anchorStatus: string
  approvalStatus?: string
  dataHash: string | null
  blockchainTx: string | null
  receiptHash: string | null
  receiptFileKey: string | null
  receiptSealId: string | null
  project?: { id: string; name: string }
  fundingAgreement?: { id: string; title: string; donor: { name: string } | null } | null
  documents?: Document[]
}

function ApprovalBadge({ status }: { status?: string }) {
  if (!status || status === 'approved') return null
  const map: Record<string, string> = {
    pending_review: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
    rejected: 'bg-red-400/10 text-red-400 border-red-400/20',
  }
  const labels: Record<string, string> = {
    pending_review: 'Pending Review', rejected: 'Rejected',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border font-medium ${map[status] ?? 'bg-gray-50 text-gray-500 border-gray-200'}`}>
      {labels[status] ?? status}
    </span>
  )
}

function HashCell({ hash }: { hash: string }) {
  const [copied, setCopied] = useState(false)
  const copy = (e: React.MouseEvent) => { e.stopPropagation(); navigator.clipboard.writeText(hash); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  return (
    <div className="flex items-center gap-1.5 group">
      <span className="hash-mono text-gray-400" style={{ fontSize: 11 }}>{hash.slice(0, 10)}…{hash.slice(-6)}</span>
      <button onClick={copy} className="opacity-0 group-hover:opacity-100 transition-opacity">
        {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} className="text-gray-400" />}
      </button>
    </div>
  )
}

function ExpenseTypeBadge({ type }: { type: string | null }) {
  if (!type) return null
  const cls = type === 'CAPEX'
    ? 'bg-purple-400/10 text-purple-400 border-purple-400/20'
    : 'bg-cyan-400/10 text-cyan-400 border-cyan-400/20'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border font-medium ${cls}`}>
      {type === 'CAPEX' ? 'CapEx' : 'OpEx'}
    </span>
  )
}

function AnchorBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    confirmed:  'bg-green-400/10 text-green-400 border-green-400/20',
    pending:    'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
    processing: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
    failed:     'bg-red-400/10 text-red-400 border-red-400/20',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium capitalize ${map[status] ?? map.pending}`}>
      {status || 'pending'}
    </span>
  )
}

function ReceiptUploader({ expenseId, expenseTitle, onUploaded }: { expenseId: string; expenseTitle: string; onUploaded: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const upload = async () => {
    if (!file) return
    setUploading(true); setError('')
    try {
      const token = localStorage.getItem('tulip_token')
      const fd = new FormData()
      fd.append('file', file)
      fd.append('title', expenseTitle || file.name)
      fd.append('expenseId', expenseId)
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050'}/api/expenses/upload-receipt`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: fd,
      })
      if (res.ok) {
        setFile(null)
        onUploaded()
      } else {
        const d = await res.json().catch(() => ({}))
        setError(d.error || 'Upload failed')
      }
    } catch { setError('Upload failed') }
    setUploading(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-200 hover:border-gray-300 cursor-pointer transition-all text-sm text-gray-500">
          <Upload size={13} />
          <span>{file ? file.name : 'Choose receipt...'}</span>
          <input type="file" className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xlsx,.xls,.csv"
            onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]) }} />
        </label>
        {file && (
          <button onClick={upload} disabled={uploading}
            className="px-3 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50 shrink-0"
            style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
            {uploading ? 'Uploading...' : 'Upload & Seal'}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <p className="text-[10px] text-gray-300">File will be SHA-256 hashed and a Trust Seal created automatically</p>
    </div>
  )
}

function ExpenseRow({ expense, onRefresh, onOpenSeal, sealMap }: { expense: Expense; onRefresh: () => void; onOpenSeal: (sealId: string) => void; sealMap: Record<string, { sealId: string; anchorStatus: string; txHash: string | null }> }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <div
        className="px-4 py-3.5 hover:bg-gray-50 transition-colors cursor-pointer lg:grid lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_60px] lg:gap-4 lg:items-center lg:px-5"
        onClick={() => setExpanded(e => !e)}
      >
        <div>
          <div className="flex items-center justify-between">
            <Link href={`/dashboard/expenses/${expense.id}`} className="text-sm font-medium text-gray-800 hover:text-cyan-400 transition-colors" onClick={e => e.stopPropagation()}>{expense.title ?? expense.description}</Link>
            {/* Mobile-only amount + chevron */}
            <div className="flex items-center gap-2 lg:hidden">
              <span className="text-sm font-medium text-gray-900">{expense.currency} {expense.amount.toLocaleString()}</span>
              <span className="text-gray-300">
                {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <ExpenseTypeBadge type={expense.expenseType} />
            {expense.category && (
              <span className="text-xs text-gray-500">{expense.category}{expense.subCategory ? ` / ${expense.subCategory}` : ''}</span>
            )}
            {expense.project && (
              <span className="text-xs text-[#0c7aed]/70">{expense.project.name}</span>
            )}
            {expense.fundingAgreement && (
              <span className="text-xs text-emerald-400/60">{expense.fundingAgreement.title}</span>
            )}
            {expense.vendor && <span className="text-xs text-gray-400">{expense.vendor}</span>}
            {(expense.documents?.length ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <FileCheck size={10} /> {expense.documents!.length} doc{expense.documents!.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {/* Mobile-only status row */}
          <div className="flex items-center gap-2 mt-1.5 lg:hidden">
            <ApprovalBadge status={expense.approvalStatus} />
            <AnchorBadge status={expense.anchorStatus} />
            {expense.receiptHash && (
              <span className="text-[10px] text-green-400 flex items-center gap-0.5"><CheckCircle size={10} /> Sealed</span>
            )}
            {expense.dataHash && (
              <Link href={`/verify?hash=${expense.dataHash}`} target="_blank"
                className="text-gray-300 hover:text-[#0c7aed] transition-colors" title="Verify" onClick={e => e.stopPropagation()}>
                <Shield size={13} />
              </Link>
            )}
            {expense.blockchainTx && (
              <Link href={`https://polygonscan.com/tx/${expense.blockchainTx}`} target="_blank"
                className="text-gray-300 hover:text-[#34d399] transition-colors" title="Polygonscan" onClick={e => e.stopPropagation()}>
                <ExternalLink size={13} />
              </Link>
            )}
          </div>
        </div>
        <div className="hidden lg:block text-sm font-medium text-gray-900">
          {expense.currency} {expense.amount.toLocaleString()}
        </div>
        <div className="hidden lg:block text-xs text-gray-500 truncate">
          {expense.project?.name ?? '—'}
        </div>
        <div className="hidden lg:flex lg:items-center lg:gap-1.5" onClick={e => e.stopPropagation()}>
          {expense.receiptSealId ? (
            <BlockchainStatusPill
              sealId={expense.receiptSealId}
              anchorStatus={expense.receiptHash && sealMap[expense.receiptHash] ? sealMap[expense.receiptHash].anchorStatus : undefined}
              txHash={expense.receiptHash && sealMap[expense.receiptHash] ? sealMap[expense.receiptHash].txHash : undefined}
              onClick={() => onOpenSeal(expense.receiptSealId!)}
            />
          ) : (
            <span className="text-gray-300 text-xs">No receipt</span>
          )}
        </div>
        <div className="hidden lg:flex lg:items-center lg:gap-1.5">
          <ApprovalBadge status={expense.approvalStatus} />
          <AnchorBadge status={expense.anchorStatus} />
        </div>
        <div className="hidden lg:flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {expense.dataHash && (
            <Link href={`/verify?hash=${expense.dataHash}`} target="_blank"
              className="text-gray-300 hover:text-[#0c7aed] transition-colors" title="Verify on blockchain">
              <Shield size={13} />
            </Link>
          )}
          {expense.blockchainTx && (
            <Link href={`https://polygonscan.com/tx/${expense.blockchainTx}`} target="_blank"
              className="text-gray-300 hover:text-[#34d399] transition-colors" title="View on Polygonscan">
              <ExternalLink size={13} />
            </Link>
          )}
          <span className="text-gray-300">
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </span>
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="px-5 pb-5 bg-gray-50 border-t border-gray-100">
          <div className="pt-4 space-y-4">

            {/* Receipt section */}
            <div className="rounded-lg border border-gray-200 p-4 space-y-3 bg-gray-50">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Receipt / Invoice</div>
              {expense.receiptHash ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-green-400 text-sm">
                    <CheckCircle size={14} /> Receipt Sealed
                  </div>
                  <div className="text-xs text-gray-400 font-mono break-all">SHA-256: {expense.receiptHash}</div>
                  <div className="flex items-center gap-3">
                    {expense.receiptSealId && (
                      <button onClick={(e) => { e.stopPropagation(); onOpenSeal(expense.receiptSealId!) }}
                        className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                        <Shield size={11} /> View Seal
                      </button>
                    )}
                    {expense.blockchainTx && (
                      <a href={`https://polygonscan.com/tx/${expense.blockchainTx}`} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <ExternalLink size={11} /> View on Polygon
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <ReceiptUploader expenseId={expense.id} expenseTitle={expense.title ?? expense.description} onUploaded={onRefresh} />
              )}
            </div>

            {/* Documents list */}
            {(expense.documents?.length ?? 0) > 0 && (
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <div className="grid grid-cols-[2fr_80px_1fr_1fr_40px] gap-3 px-4 py-2 border-b border-gray-200 text-xs text-gray-400 uppercase tracking-wide">
                  <span>Document</span><span>Type</span><span>Hash</span><span>Date</span><span></span>
                </div>
                {expense.documents!.map(doc => (
                  <div key={doc.id} className="grid grid-cols-[2fr_80px_1fr_1fr_40px] gap-3 items-center px-4 py-2.5 border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <div className="flex items-center gap-2">
                      <FileCheck size={12} className="text-[#0c7aed]" />
                      <span className="text-sm text-gray-700">{doc.name}</span>
                    </div>
                    <span className="text-xs text-gray-500 uppercase">{doc.fileType ?? '—'}</span>
                    <div>
                      {doc.sha256Hash
                        ? <span className="hash-mono text-gray-400" style={{ fontSize: 11 }}>{doc.sha256Hash.slice(0, 10)}…{doc.sha256Hash.slice(-6)}</span>
                        : <span className="text-gray-300 text-xs">—</span>
                      }
                    </div>
                    <span className="text-xs text-gray-400">{new Date(doc.uploadedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={async (e) => {
                        e.stopPropagation()
                        const token = localStorage.getItem('tulip_token')
                        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/documents/${doc.id}/view`, {
                          headers: { Authorization: `Bearer ${token}` }
                        })
                        const data = await res.json()
                        if (data.url) window.open(data.url, '_blank')
                      }} className="text-gray-300 hover:text-[#34d399] transition-colors" title="View document">
                        <ExternalLink size={12} />
                      </button>
                      {doc.sha256Hash && (
                        <Link href={`/verify?hash=${doc.sha256Hash}`} target="_blank"
                          className="text-gray-300 hover:text-[#0c7aed] transition-colors" title="Verify hash">
                          <Shield size={12} />
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Upload additional documents */}
            <DocumentUploadSection entityType="expense" entityId={expense.id} onUploaded={onRefresh} />
          </div>
        </div>
      )}
    </>
  )
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeSealId, setActiveSealId] = useState<string | null>(null)
  const [sealMap, setSealMap] = useState<Record<string, { sealId: string; anchorStatus: string; txHash: string | null }>>({})

  const resolveSeals = useCallback((items: Expense[]) => {
    const hashes = items.map(e => e.receiptHash).filter(Boolean) as string[]
    if (hashes.length === 0) return
    apiPost('/api/trust-seal/resolve', { hashes })
      .then(r => r.ok ? r.json() : {})
      .then(map => setSealMap(map))
      .catch(() => {})
  }, [])

  const load = () => {
    apiGet('/api/expenses?limit=50')
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => {
        const items = d.data ?? d.items ?? []
        setExpenses(items)
        setLoading(false)
        resolveSeals(items)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered = expenses.filter(e =>
    (e.title ?? e.description ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (e.vendor ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (e.category ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (e.project?.name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const total = filtered.reduce((sum, e) => sum + e.amount, 0)

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Inter, sans-serif' }}>Expenses</h1>
          <p className="text-gray-500 text-sm mt-1">{expenses.length} expense{expenses.length !== 1 ? 's' : ''} — every entry blockchain anchored</p>
        </div>
        <Link href="/dashboard/expenses/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white self-start"
          style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
          <Plus size={16} /> Log Expense
        </Link>
      </div>

      {filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Total Logged', value: `$${total.toLocaleString()}` },
            { label: 'Anchored', value: filtered.filter(e => e.receiptHash && sealMap[e.receiptHash]?.anchorStatus === 'confirmed').length },
            { label: 'Pending Anchor', value: filtered.filter(e => !e.receiptHash || !sealMap[e.receiptHash] || sealMap[e.receiptHash]?.anchorStatus === 'pending').length },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-gray-200 px-5 py-4" style={{ background: '#FFFFFF' }}>
              <div className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Inter, sans-serif' }}>{value}</div>
              <div className="text-xs text-gray-500 mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 max-w-sm">
        <Search size={15} className="text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search expenses..." className="bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none w-full" />
      </div>

      <div className="rounded-xl border border-gray-200 overflow-hidden" style={{ background: '#FFFFFF' }}>
        <div className="hidden lg:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_60px] gap-4 px-5 py-3 border-b border-gray-200 text-xs text-gray-400 uppercase tracking-wide font-medium">
          <span>Expense</span><span>Amount</span><span>Project</span><span>Seal</span><span>Status</span><span>Actions</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <Receipt size={32} className="text-gray-300" />
            <p className="text-gray-400 text-sm">No expenses logged yet</p>
            <Link href="/dashboard/expenses/new" className="text-[#0c7aed] text-sm hover:underline">Log your first expense</Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(expense => (
              <ExpenseRow key={expense.id} expense={expense} onRefresh={load} onOpenSeal={setActiveSealId} sealMap={sealMap} />
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-gray-300 text-center">Click any expense row to view documents and upload receipts</p>

      {activeSealId && (
        <TrustSealCard sealId={activeSealId} onClose={() => { setActiveSealId(null); resolveSeals(expenses) }} />
      )}
    </div>
  )
}
