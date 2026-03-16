'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import { Flag, Check, AlertCircle, Clock, ChevronDown, X, Send } from 'lucide-react'

// ── Date helpers ──
function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return '—'
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function timeAgo(d: string | Date): string {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return fmtDate(d)
}

// ── Interfaces ──
interface Challenge {
  id: string; note: string; status: string; createdAt: string; updatedAt: string
  expenseId: string; projectId: string; donorOrgId: string
  expense: { id: string; vendor: string; amount: number; currency: string; expenseDate: string } | null
  project: { id: string; name: string } | null
  donorOrg: { id: string; name: string } | null
  responses: { id: string; respondedByType: string; note: string; action: string; createdAt: string; resubmittedDocumentId: string | null }[]
}

interface Counts { open: number; responded: number; escalated: number; confirmed: number }

// ── Toast ──
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t) }, [onClose])
  return (
    <div className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium shadow-lg ${
      type === 'success' ? 'bg-green-500/20 text-green-700 border border-green-500/30' : 'bg-red-500/20 text-red-700 border border-red-500/30'
    }`}>
      {type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
      {message}
    </div>
  )
}

// ── Status pill ──
function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    OPEN: 'bg-amber-100 text-amber-700 border-amber-200',
    RESPONDED: 'bg-blue-100 text-blue-700 border-blue-200',
    ESCALATED: 'bg-red-100 text-red-700 border-red-200',
    CONFIRMED: 'bg-green-100 text-green-700 border-green-200',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${map[status] || map.OPEN}`}>
      {status === 'CONFIRMED' ? 'Resolved' : status}
    </span>
  )
}

// ── Respond Modal ──
function RespondModal({ challenge, onClose, onSuccess }: { challenge: Challenge; onClose: () => void; onSuccess: (msg: string) => void }) {
  const [action, setAction] = useState<'EXPLAIN' | 'VOID_REQUESTED'>('EXPLAIN')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) { if (modalRef.current && !modalRef.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const handleSubmit = async () => {
    if (!note.trim()) return
    setSubmitting(true)
    try {
      const r = await apiPost(`/api/ngo/donor-challenges/${challenge.id}/respond`, { note: note.trim(), action })
      if (r.ok) {
        onSuccess(`Response sent to ${challenge.donorOrg?.name || 'donor'}`)
        onClose()
      }
    } catch { /* ignore */ }
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div ref={modalRef} className="bg-[var(--tulip-cream)] rounded-2xl border border-[var(--tulip-sage-dark)] shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--tulip-sage-dark)] flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--tulip-forest)]">Respond to Donor Flag</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--tulip-sage)] text-[var(--tulip-forest)]"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto p-6 space-y-5">
          {/* Donor's flag */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide mb-2 text-[var(--tulip-forest)]/60">The donor&apos;s flag</p>
            <div className="rounded-xl px-4 py-3 bg-amber-50 border border-amber-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-amber-700">{challenge.donorOrg?.name || 'Donor'}</span>
                <span className="text-xs text-[var(--tulip-forest)]/50">{fmtDate(challenge.createdAt)}</span>
              </div>
              <p className="text-sm text-[var(--tulip-forest)]">{challenge.note}</p>
            </div>
          </div>

          {/* Previous responses */}
          {challenge.responses.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide mb-2 text-[var(--tulip-forest)]/60">Previous responses</p>
              <div className="space-y-2">
                {challenge.responses.map(r => (
                  <div key={r.id} className="rounded-xl px-4 py-3 border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-[var(--tulip-forest)]">
                        {r.respondedByType === 'NGO' ? 'Your response' : 'Donor'} — {r.action === 'EXPLAIN' ? 'Explanation' : r.action === 'VOID_REQUESTED' ? 'Void offered' : r.action === 'CONFIRM' ? 'Confirmed' : r.action === 'ESCALATE' ? 'Re-flagged' : r.action}
                      </span>
                      <span className="text-xs text-[var(--tulip-forest)]/50">{fmtDate(r.createdAt)}</span>
                    </div>
                    <p className="text-sm text-[var(--tulip-forest)]">{r.note}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Your response */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide mb-3 text-[var(--tulip-forest)]/60">Your response</p>

            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all"
                style={{ borderColor: action === 'EXPLAIN' ? 'var(--tulip-gold)' : 'var(--tulip-sage-dark)', background: action === 'EXPLAIN' ? 'var(--tulip-cream)' : 'transparent' }}>
                <input type="radio" name="action" checked={action === 'EXPLAIN'} onChange={() => setAction('EXPLAIN')}
                  className="mt-0.5 accent-[var(--tulip-gold)]" />
                <div>
                  <p className="text-sm font-medium text-[var(--tulip-forest)]">Provide explanation</p>
                  <p className="text-xs text-[var(--tulip-forest)]/60">I will keep this expense and explain why it is valid</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all"
                style={{ borderColor: action === 'VOID_REQUESTED' ? 'var(--tulip-gold)' : 'var(--tulip-sage-dark)', background: action === 'VOID_REQUESTED' ? 'var(--tulip-cream)' : 'transparent' }}>
                <input type="radio" name="action" checked={action === 'VOID_REQUESTED'} onChange={() => setAction('VOID_REQUESTED')}
                  className="mt-0.5 accent-[var(--tulip-gold)]" />
                <div>
                  <p className="text-sm font-medium text-[var(--tulip-forest)]">Offer to void</p>
                  <p className="text-xs text-[var(--tulip-forest)]/60">I will remove this expense from the project</p>
                </div>
              </label>
            </div>

            <textarea value={note} onChange={e => setNote(e.target.value.slice(0, 500))} rows={3}
              className="w-full mt-3 bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-4 py-2.5 text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none focus:border-[var(--tulip-gold)] transition-all"
              placeholder="Your response to the donor..." />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-[var(--tulip-forest)]/40">{note.length}/500</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--tulip-sage-dark)] flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--tulip-forest)] hover:bg-[var(--tulip-sage)] transition-all">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting || !note.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--tulip-gold)] text-[var(--tulip-forest)] hover:bg-[var(--tulip-orange)] disabled:opacity-50 transition-all">
            <Send size={14} />
            {submitting ? 'Sending...' : 'Send Response'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──
export default function DonorFlagsPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [counts, setCounts] = useState<Counts>({ open: 0, responded: 0, escalated: 0, confirmed: 0 })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('active') // 'all', 'active', 'OPEN', 'RESPONDED', 'ESCALATED', 'CONFIRMED'
  const [respondChallenge, setRespondChallenge] = useState<Challenge | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const r = await apiGet('/api/ngo/donor-challenges')
      if (r.ok) {
        const data = await r.json()
        setChallenges(data.challenges || [])
        setCounts(data.counts || { open: 0, responded: 0, escalated: 0, confirmed: 0 })
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = challenges.filter(c => {
    if (filter === 'all') return true
    if (filter === 'active') return ['OPEN', 'ESCALATED'].includes(c.status)
    return c.status === filter
  })

  const tabs = [
    { key: 'active', label: 'Active', count: counts.open + counts.escalated },
    { key: 'all', label: 'All', count: null },
    { key: 'OPEN', label: 'Open', count: counts.open },
    { key: 'RESPONDED', label: 'Responded', count: counts.responded },
    { key: 'ESCALATED', label: 'Escalated', count: counts.escalated },
    { key: 'CONFIRMED', label: 'Resolved', count: counts.confirmed },
  ]

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-fade-up">
        <div className="h-8 w-48 rounded bg-[var(--tulip-sage)] animate-pulse" />
        <div className="h-10 w-full rounded-xl bg-[var(--tulip-sage)] animate-pulse" />
        {[1,2,3].map(i => <div key={i} className="h-16 w-full rounded-xl bg-[var(--tulip-sage)] animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-up">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--tulip-forest)]">Donor Flags</h1>
        <p className="text-sm text-[var(--tulip-forest)]/60 mt-1">Expenses flagged by your donors for review</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-[var(--tulip-sage-dark)] px-4 py-3 bg-[var(--tulip-sage)]">
          <p className="text-xs text-[var(--tulip-forest)]/60">Open</p>
          <p className="text-xl font-bold text-amber-600">{counts.open}</p>
        </div>
        <div className="rounded-xl border border-[var(--tulip-sage-dark)] px-4 py-3 bg-[var(--tulip-sage)]">
          <p className="text-xs text-[var(--tulip-forest)]/60">Responded</p>
          <p className="text-xl font-bold text-blue-600">{counts.responded}</p>
        </div>
        <div className="rounded-xl border border-[var(--tulip-sage-dark)] px-4 py-3 bg-[var(--tulip-sage)]">
          <p className="text-xs text-[var(--tulip-forest)]/60">Escalated</p>
          <p className="text-xl font-bold text-red-600">{counts.escalated}</p>
        </div>
        <div className="rounded-xl border border-[var(--tulip-sage-dark)] px-4 py-3 bg-[var(--tulip-sage)]">
          <p className="text-xs text-[var(--tulip-forest)]/60">Resolved</p>
          <p className="text-xl font-bold text-green-600">{counts.confirmed}</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-lg p-1 bg-[var(--tulip-sage)]">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setFilter(tab.key)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{
              background: filter === tab.key ? 'var(--tulip-cream)' : 'transparent',
              color: filter === tab.key ? 'var(--tulip-forest)' : 'var(--text-secondary)',
              boxShadow: filter === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}>
            {tab.label}{tab.count !== null ? ` (${tab.count})` : ''}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-[var(--tulip-sage-dark)] overflow-hidden bg-[var(--tulip-cream)]">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Flag size={32} className="mx-auto mb-3 text-[var(--tulip-forest)]/20" />
            <p className="text-sm text-[var(--tulip-forest)]/50">No flags in this category.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--tulip-sage-dark)]">
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide text-[var(--tulip-forest)]/50">Project</th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide text-[var(--tulip-forest)]/50">Expense</th>
                  <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wide text-[var(--tulip-forest)]/50">Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide text-[var(--tulip-forest)]/50">Donor Org</th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide text-[var(--tulip-forest)]/50">Flagged</th>
                  <th className="text-center px-4 py-3 text-xs font-medium uppercase tracking-wide text-[var(--tulip-forest)]/50">Status</th>
                  <th className="text-center px-4 py-3 text-xs font-medium uppercase tracking-wide text-[var(--tulip-forest)]/50">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className="border-b border-[var(--tulip-sage-dark)] last:border-0 hover:bg-[var(--tulip-sage)]/50 transition-all">
                    <td className="px-4 py-3 font-medium text-[var(--tulip-forest)]">{c.project?.name || '—'}</td>
                    <td className="px-4 py-3 text-[var(--tulip-forest)]">
                      {c.expense?.vendor || '—'}
                      <span className="block text-xs text-[var(--tulip-forest)]/50">{fmtDate(c.expense?.expenseDate)}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[var(--tulip-forest)]">
                      {c.expense?.currency || 'USD'} {(c.expense?.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-[var(--tulip-forest)]">{c.donorOrg?.name || '—'}</td>
                    <td className="px-4 py-3 text-[var(--tulip-forest)]/70" title={fmtDate(c.createdAt)}>{timeAgo(c.createdAt)}</td>
                    <td className="px-4 py-3 text-center"><StatusPill status={c.status} /></td>
                    <td className="px-4 py-3 text-center">
                      {['OPEN', 'ESCALATED'].includes(c.status) ? (
                        <button onClick={() => setRespondChallenge(c)}
                          className="px-3 py-1 rounded-lg text-xs font-medium bg-[var(--tulip-gold)] text-[var(--tulip-forest)] hover:bg-[var(--tulip-orange)] transition-all">
                          Respond
                        </button>
                      ) : (
                        <button onClick={() => setRespondChallenge(c)}
                          className="text-xs text-[var(--tulip-forest)]/50 hover:underline">View</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Respond modal */}
      {respondChallenge && (
        <RespondModal
          challenge={respondChallenge}
          onClose={() => setRespondChallenge(null)}
          onSuccess={(msg) => { setToast({ message: msg, type: 'success' }); fetchData() }}
        />
      )}

      {/* Toast */}
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  )
}
