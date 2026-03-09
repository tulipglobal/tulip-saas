'use client'

import { useState, useEffect } from 'react'
import { apiGet } from '@/lib/api'
import Link from 'next/link'
import { Receipt, Plus, Search, ExternalLink, Shield, Copy, Check, ChevronDown, ChevronUp, FileCheck, Upload } from 'lucide-react'
import DocumentUploadSection from '@/components/DocumentUploadSection'

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
  vendor: string | null
  expenseDate: string
  anchorStatus: string
  approvalStatus?: string
  dataHash: string | null
  blockchainTx: string | null
  project?: { id: string; name: string }
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
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border font-medium ${map[status] ?? 'bg-white/5 text-white/40 border-white/10'}`}>
      {labels[status] ?? status}
    </span>
  )
}

function HashCell({ hash }: { hash: string }) {
  const [copied, setCopied] = useState(false)
  const copy = (e: React.MouseEvent) => { e.stopPropagation(); navigator.clipboard.writeText(hash); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  return (
    <div className="flex items-center gap-1.5 group">
      <span className="hash-mono text-white/30" style={{ fontSize: 11 }}>{hash.slice(0, 10)}…{hash.slice(-6)}</span>
      <button onClick={copy} className="opacity-0 group-hover:opacity-100 transition-opacity">
        {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} className="text-white/30" />}
      </button>
    </div>
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

function ExpenseRow({ expense, onRefresh }: { expense: Expense; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <div
        className="px-4 py-3.5 hover:bg-white/2 transition-colors cursor-pointer lg:grid lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_60px] lg:gap-4 lg:items-center lg:px-5"
        onClick={() => setExpanded(e => !e)}
      >
        <div>
          <div className="flex items-center justify-between">
            <Link href={`/dashboard/expenses/${expense.id}`} className="text-sm font-medium text-white/80 hover:text-cyan-400 transition-colors" onClick={e => e.stopPropagation()}>{expense.title ?? expense.description}</Link>
            {/* Mobile-only amount + chevron */}
            <div className="flex items-center gap-2 lg:hidden">
              <span className="text-sm font-medium text-white">{expense.currency} {expense.amount.toLocaleString()}</span>
              <span className="text-white/20">
                {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {expense.project && (
              <span className="text-xs text-[#369bff]/70">{expense.project.name}</span>
            )}
            {expense.vendor && <span className="text-xs text-white/30">{expense.vendor}</span>}
            {!expense.project && !expense.vendor && expense.category && (
              <span className="text-xs text-white/30">{expense.category}</span>
            )}
            {(expense.documents?.length ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-xs text-white/30">
                <FileCheck size={10} /> {expense.documents!.length} doc{expense.documents!.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {/* Mobile-only status row */}
          <div className="flex items-center gap-2 mt-1.5 lg:hidden">
            <ApprovalBadge status={expense.approvalStatus} />
            <AnchorBadge status={expense.anchorStatus} />
            {expense.dataHash && (
              <Link href={`/verify?hash=${expense.dataHash}`} target="_blank"
                className="text-white/20 hover:text-[#369bff] transition-colors" title="Verify" onClick={e => e.stopPropagation()}>
                <Shield size={13} />
              </Link>
            )}
            {expense.blockchainTx && (
              <Link href={`https://amoy.polygonscan.com/tx/${expense.blockchainTx}`} target="_blank"
                className="text-white/20 hover:text-[#34d399] transition-colors" title="Polygonscan" onClick={e => e.stopPropagation()}>
                <ExternalLink size={13} />
              </Link>
            )}
          </div>
        </div>
        <div className="hidden lg:block text-sm font-medium text-white">
          {expense.currency} {expense.amount.toLocaleString()}
        </div>
        <div className="hidden lg:block text-xs text-white/40 truncate">
          {expense.project?.name ?? '—'}
        </div>
        <div className="hidden lg:block" onClick={e => e.stopPropagation()}>
          {expense.dataHash ? <HashCell hash={expense.dataHash} /> : <span className="text-white/20 text-xs">—</span>}
        </div>
        <div className="hidden lg:flex lg:items-center lg:gap-1.5">
          <ApprovalBadge status={expense.approvalStatus} />
          <AnchorBadge status={expense.anchorStatus} />
        </div>
        <div className="hidden lg:flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {expense.dataHash && (
            <Link href={`/verify?hash=${expense.dataHash}`} target="_blank"
              className="text-white/20 hover:text-[#369bff] transition-colors" title="Verify on blockchain">
              <Shield size={13} />
            </Link>
          )}
          {expense.blockchainTx && (
            <Link href={`https://amoy.polygonscan.com/tx/${expense.blockchainTx}`} target="_blank"
              className="text-white/20 hover:text-[#34d399] transition-colors" title="View on Polygonscan">
              <ExternalLink size={13} />
            </Link>
          )}
          <span className="text-white/20">
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </span>
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="px-5 pb-5 bg-white/1 border-t border-white/5">
          <div className="pt-4 space-y-4">

            {/* Documents list */}
            {(expense.documents?.length ?? 0) > 0 && (
              <div className="rounded-lg border border-white/8 overflow-hidden">
                <div className="grid grid-cols-[2fr_80px_1fr_1fr_40px] gap-3 px-4 py-2 border-b border-white/8 text-xs text-white/30 uppercase tracking-wide">
                  <span>Document</span><span>Type</span><span>Hash</span><span>Date</span><span></span>
                </div>
                {expense.documents!.map(doc => (
                  <div key={doc.id} className="grid grid-cols-[2fr_80px_1fr_1fr_40px] gap-3 items-center px-4 py-2.5 border-b border-white/5 last:border-0 hover:bg-white/2">
                    <div className="flex items-center gap-2">
                      <FileCheck size={12} className="text-[#369bff]" />
                      <span className="text-sm text-white/70">{doc.name}</span>
                    </div>
                    <span className="text-xs text-white/40 uppercase">{doc.fileType ?? '—'}</span>
                    <div>
                      {doc.sha256Hash
                        ? <span className="hash-mono text-white/30" style={{ fontSize: 11 }}>{doc.sha256Hash.slice(0, 10)}…{doc.sha256Hash.slice(-6)}</span>
                        : <span className="text-white/20 text-xs">—</span>
                      }
                    </div>
                    <span className="text-xs text-white/30">{new Date(doc.uploadedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={async (e) => {
                        e.stopPropagation()
                        const token = localStorage.getItem('tulip_token')
                        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/documents/${doc.id}/view`, {
                          headers: { Authorization: `Bearer ${token}` }
                        })
                        const data = await res.json()
                        if (data.url) window.open(data.url, '_blank')
                      }} className="text-white/20 hover:text-[#34d399] transition-colors" title="View document">
                        <ExternalLink size={12} />
                      </button>
                      {doc.sha256Hash && (
                        <Link href={`/verify?hash=${doc.sha256Hash}`} target="_blank"
                          className="text-white/20 hover:text-[#369bff] transition-colors" title="Verify hash">
                          <Shield size={12} />
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Upload new document */}
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

  const load = () => {
    apiGet('/api/expenses?limit=50')
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => { setExpenses(d.data ?? d.items ?? []); setLoading(false) })
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
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Expenses</h1>
          <p className="text-white/40 text-sm mt-1">{expenses.length} expense{expenses.length !== 1 ? 's' : ''} — every entry blockchain anchored</p>
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
            { label: 'Anchored', value: filtered.filter(e => e.anchorStatus === 'confirmed').length },
            { label: 'Pending Anchor', value: filtered.filter(e => e.anchorStatus === 'pending').length },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-white/8 px-5 py-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="text-xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>{value}</div>
              <div className="text-xs text-white/40 mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 max-w-sm">
        <Search size={15} className="text-white/30" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search expenses..." className="bg-transparent text-sm text-white/70 placeholder-white/30 outline-none w-full" />
      </div>

      <div className="rounded-xl border border-white/8 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="hidden lg:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_60px] gap-4 px-5 py-3 border-b border-white/8 text-xs text-white/30 uppercase tracking-wide font-medium">
          <span>Expense</span><span>Amount</span><span>Project</span><span>Hash</span><span>Status</span><span>Actions</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-white/30 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <Receipt size={32} className="text-white/10" />
            <p className="text-white/30 text-sm">No expenses logged yet</p>
            <Link href="/dashboard/expenses/new" className="text-[#369bff] text-sm hover:underline">Log your first expense</Link>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.map(expense => (
              <ExpenseRow key={expense.id} expense={expense} onRefresh={load} />
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-white/20 text-center">Click any expense row to view documents and upload receipts</p>
    </div>
  )
}
