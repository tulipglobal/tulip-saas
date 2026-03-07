'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Receipt, Plus, Search, ExternalLink, Copy, Check } from 'lucide-react'

interface Expense {
  id: string
  title: string
  amount: number
  currency: string
  category: string | null
  vendor: string | null
  expenseDate: string
  anchorStatus: string
  dataHash: string | null
  blockchainTx: string | null
  project?: { id: string; name: string }
}

function HashCell({ hash }: { hash: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => { navigator.clipboard.writeText(hash); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  return (
    <div className="flex items-center gap-2 group">
      <span className="hash-mono text-white/30 truncate max-w-[140px]">{hash}</span>
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
      {status}
    </span>
  )
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/expenses?limit=50`, )
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => { setExpenses(d.items ?? d ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = expenses.filter(e =>
    e.title.toLowerCase().includes(search.toLowerCase()) ||
    (e.vendor ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (e.category ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const total = filtered.reduce((sum, e) => sum + e.amount, 0)

  return (
    <div className="p-6 space-y-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Expenses</h1>
          <p className="text-white/40 text-sm mt-1">{expenses.length} expense{expenses.length !== 1 ? 's' : ''} — every entry blockchain anchored</p>
        </div>
        <Link href="/dashboard/expenses/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
          <Plus size={16} /> Log Expense
        </Link>
      </div>

      {/* Summary */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Logged',   value: `$${total.toLocaleString()}` },
            { label: 'Anchored',       value: filtered.filter(e => e.anchorStatus === 'confirmed').length },
            { label: 'Pending Anchor', value: filtered.filter(e => e.anchorStatus === 'pending').length },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-white/8 px-5 py-4"
              style={{ background: 'rgba(255,255,255,0.02)' }}>
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

      <div className="rounded-xl border border-white/8 overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_40px] gap-4 px-5 py-3 border-b border-white/8 text-xs text-white/30 uppercase tracking-wide font-medium">
          <span>Expense</span><span>Amount</span><span>Project</span><span>Hash</span><span>Status</span><span/>
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
              <div key={expense.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_40px] gap-4 items-center px-5 py-3.5 hover:bg-white/2 transition-colors">
                <div>
                  <div className="text-sm font-medium text-white/80">{expense.title}</div>
                  <div className="text-xs text-white/30 mt-0.5">{expense.vendor ?? expense.category ?? '—'}</div>
                </div>
                <div className="text-sm font-medium text-white">
                  {expense.currency} {expense.amount.toLocaleString()}
                </div>
                <div className="text-xs text-white/40 truncate">
                  {expense.project?.name ?? '—'}
                </div>
                <div>{expense.dataHash ? <HashCell hash={expense.dataHash} /> : <span className="text-white/20 text-xs">—</span>}</div>
                <AnchorBadge status={expense.anchorStatus} />
                {expense.blockchainTx ? (
                  <Link href={`https://amoy.polygonscan.com/tx/${expense.blockchainTx}`} target="_blank"
                    className="text-white/20 hover:text-[#369bff] transition-colors">
                    <ExternalLink size={13} />
                  </Link>
                ) : <span />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
