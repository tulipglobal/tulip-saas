'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { apiGet, apiPost } from '../../lib/api'

interface Ticket {
  id: string
  subject: string
  category: string
  priority: string
  status: string
  createdAt: string
  updatedAt: string
  messages?: TicketMessage[]
}

interface TicketMessage {
  id: string
  senderType: string
  message: string
  createdAt: string
}

const CATEGORIES = ['Technical Issue', 'Account & Access', 'Funding & Tranches', 'Verification', 'Investment', 'Reports', 'Other']
const PRIORITIES = ['low', 'medium', 'high', 'critical']

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  open: { bg: '#DBEAFE', text: '#1D4ED8' },
  in_progress: { bg: '#FEF3C7', text: '#92400E' },
  resolved: { bg: '#D1FAE5', text: '#065F46' },
  closed: { bg: '#F3F4F6', text: '#6B7280' },
}

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  low: { bg: '#F3F4F6', text: '#6B7280' },
  medium: { bg: '#DBEAFE', text: '#1D4ED8' },
  high: { bg: '#FED7AA', text: '#9A3412' },
  critical: { bg: '#FEE2E2', text: '#991B1B' },
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function DonorSupportPage() {
  const t = useTranslations('support')
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [selected, setSelected] = useState<Ticket | null>(null)
  const [form, setForm] = useState({ subject: '', category: 'Technical Issue', priority: 'medium', description: '' })
  const [reply, setReply] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchTickets = async () => {
    try {
      const r = await apiGet('/api/support/tickets')
      if (r.ok) setTickets(await r.json())
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { fetchTickets() }, [])

  const createTicket = async () => {
    if (!form.subject || !form.description) return
    setSubmitting(true)
    try {
      const r = await apiPost('/api/support/tickets', form)
      if (r.ok) { setShowNew(false); setForm({ subject: '', category: 'Technical Issue', priority: 'medium', description: '' }); fetchTickets() }
    } catch {} finally { setSubmitting(false) }
  }

  const openTicket = async (id: string) => {
    try {
      const r = await apiGet(`/api/support/tickets/${id}`)
      if (r.ok) setSelected(await r.json())
    } catch {}
  }

  const sendReply = async () => {
    if (!reply || !selected) return
    setSubmitting(true)
    try {
      const r = await apiPost(`/api/support/tickets/${selected.id}/messages`, { message: reply })
      if (r.ok) { setReply(''); openTicket(selected.id) }
    } catch {} finally { setSubmitting(false) }
  }

  if (selected) {
    const sc = STATUS_COLORS[selected.status] || STATUS_COLORS.open
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <button onClick={() => setSelected(null)} className="text-sm mb-4 hover:underline" style={{ color: 'var(--donor-accent)' }}>
          ← {t('backToTickets')}
        </button>
        <div className="rounded-xl border p-6" style={{ borderColor: 'var(--donor-border)', background: 'var(--bg-card)' }}>
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-bold" style={{ color: 'var(--donor-dark)' }}>{selected.subject}</h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: sc.bg, color: sc.text }}>{t(selected.status)}</span>
          </div>
          <div className="space-y-4 mb-6">
            {(selected.messages || []).map(m => (
              <div key={m.id} className={`rounded-lg px-4 py-3 ${m.senderType === 'admin' ? 'ml-8' : 'mr-8'}`}
                style={{ background: m.senderType === 'admin' ? 'var(--donor-light)' : 'rgba(0,0,0,0.03)' }}>
                <div className="text-xs mb-1 font-medium" style={{ color: 'var(--donor-muted)' }}>
                  {m.senderType === 'admin' ? 'Support Team' : 'You'} · {fmtDate(m.createdAt)}
                </div>
                <p className="text-sm" style={{ color: 'var(--donor-dark)' }}>{m.message}</p>
              </div>
            ))}
          </div>
          {selected.status !== 'closed' && (
            <div className="flex gap-2">
              <input value={reply} onChange={e => setReply(e.target.value)} placeholder={t('typeMessage')}
                className="flex-1 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--donor-border)', color: 'var(--donor-dark)' }}
                onKeyDown={e => e.key === 'Enter' && sendReply()} />
              <button onClick={sendReply} disabled={submitting || !reply}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: 'var(--donor-accent)' }}>
                {t('sendReply')}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold" style={{ color: 'var(--donor-dark)' }}>{t('title')}</h1>
        <button onClick={() => setShowNew(true)} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--donor-accent)' }}>
          + {t('newTicket')}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-sm" style={{ color: 'var(--donor-muted)' }}>Loading...</div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-12 rounded-xl border" style={{ borderColor: 'var(--donor-border)', background: 'var(--bg-card)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--donor-dark)' }}>{t('noTickets')}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--donor-muted)' }}>{t('noTicketsDesc')}</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--donor-border)', background: 'var(--bg-card)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--donor-light)' }}>
                <th className="text-left px-4 py-2 text-xs font-medium uppercase" style={{ color: 'var(--donor-muted)' }}>{t('subject')}</th>
                <th className="text-left px-4 py-2 text-xs font-medium uppercase" style={{ color: 'var(--donor-muted)' }}>{t('category')}</th>
                <th className="text-center px-4 py-2 text-xs font-medium uppercase" style={{ color: 'var(--donor-muted)' }}>{t('priority')}</th>
                <th className="text-center px-4 py-2 text-xs font-medium uppercase" style={{ color: 'var(--donor-muted)' }}>{t('status')}</th>
                <th className="text-right px-4 py-2 text-xs font-medium uppercase" style={{ color: 'var(--donor-muted)' }}>{t('lastUpdated')}</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map(ticket => {
                const sc = STATUS_COLORS[ticket.status] || STATUS_COLORS.open
                const pc = PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS.medium
                return (
                  <tr key={ticket.id} onClick={() => openTicket(ticket.id)} className="border-t cursor-pointer hover:opacity-80" style={{ borderColor: 'var(--donor-border)' }}>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--donor-dark)' }}>{ticket.subject}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--donor-muted)' }}>{ticket.category}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: pc.bg, color: pc.text }}>{t(ticket.priority)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: sc.bg, color: sc.text }}>{t(ticket.status)}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs" style={{ color: 'var(--donor-muted)' }}>{fmtDate(ticket.updatedAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* New Ticket Modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" style={{ background: 'var(--bg-card)' }} onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--donor-dark)' }}>{t('newTicket')}</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--donor-muted)' }}>{t('subject')}</label>
                <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--donor-border)', color: 'var(--donor-dark)' }} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--donor-muted)' }}>{t('category')}</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--donor-border)', color: 'var(--donor-dark)' }}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--donor-muted)' }}>{t('priority')}</label>
                <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--donor-border)', color: 'var(--donor-dark)' }}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{t(p)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--donor-muted)' }}>{t('description')}</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={4} className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--donor-border)', color: 'var(--donor-dark)' }} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowNew(false)} className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--donor-muted)' }}>Cancel</button>
              <button onClick={createTicket} disabled={submitting || !form.subject || !form.description}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: 'var(--donor-accent)' }}>
                {t('submit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
