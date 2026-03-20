'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { apiGet, apiPost } from '../lib/api'

interface Article { id: string; title: string; slug: string; category: string }
interface Ticket { id: string; subject: string; status: string; updatedAt: string }

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  open: { bg: '#DBEAFE', text: '#1D4ED8' },
  in_progress: { bg: '#FEF3C7', text: '#92400E' },
  resolved: { bg: '#D1FAE5', text: '#065F46' },
  closed: { bg: '#F3F4F6', text: '#6B7280' },
}

export default function FloatingHelpButton() {
  const t = useTranslations('support')
  const kt = useTranslations('kb')
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'search' | 'support' | 'tickets'>('search')
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Article[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [form, setForm] = useState({ subject: '', description: '', category: 'Technical Issue' })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    if (tab === 'tickets') {
      apiGet('/api/support/tickets').then(r => r.ok ? r.json() : []).then(setTickets).catch(() => {})
    }
  }, [open, tab])

  useEffect(() => {
    if (!search || search.length < 2) { setResults([]); return }
    const timer = setTimeout(async () => {
      try {
        const r = await apiGet(`/api/kb/search?q=${encodeURIComponent(search)}&role=donor`)
        if (r.ok) setResults(await r.json())
      } catch {}
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const submitTicket = async () => {
    if (!form.subject || !form.description) return
    setSubmitting(true)
    try {
      const r = await apiPost('/api/support/tickets', form)
      if (r.ok) { setSubmitted(true); setForm({ subject: '', description: '', category: 'Technical Issue' }); setTimeout(() => setSubmitted(false), 3000) }
    } catch {} finally { setSubmitting(false) }
  }

  return (
    <>
      <button onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg text-sm font-medium text-white transition-all hover:scale-105"
        style={{ background: 'var(--donor-accent)' }}>
        ? {t('helpButton')}
      </button>

      {open && (
        <div ref={ref} className="fixed bottom-20 right-6 z-50 w-96 max-h-[70vh] rounded-2xl shadow-2xl border overflow-hidden flex flex-col"
          style={{ borderColor: 'var(--donor-border)', background: 'var(--bg-card)' }}>
          <div className="flex border-b" style={{ borderColor: 'var(--donor-border)' }}>
            {(['search', 'support', 'tickets'] as const).map(t2 => (
              <button key={t2} onClick={() => setTab(t2)}
                className={`flex-1 px-3 py-3 text-xs font-medium transition-all ${tab === t2 ? 'border-b-2' : ''}`}
                style={{ color: tab === t2 ? 'var(--donor-accent)' : 'var(--donor-muted)', borderColor: tab === t2 ? 'var(--donor-accent)' : 'transparent' }}>
                {t2 === 'search' ? kt('title') : t2 === 'support' ? t('quickTicket') : t('myTickets')}
              </button>
            ))}
            <button onClick={() => setOpen(false)} className="px-3 text-lg" style={{ color: 'var(--donor-muted)' }}>×</button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {tab === 'search' && (
              <>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder={kt('searchPlaceholder')}
                  className="w-full rounded-lg border px-3 py-2 text-sm mb-3" style={{ borderColor: 'var(--donor-border)', color: 'var(--donor-dark)' }} autoFocus />
                {results.map(a => (
                  <a key={a.id} href={`/knowledge-base?article=${a.slug}`}
                    className="block rounded-lg p-3 mb-1 hover:opacity-80 text-sm" style={{ color: 'var(--donor-dark)', background: 'var(--donor-light)' }}>
                    {a.title}
                  </a>
                ))}
              </>
            )}

            {tab === 'support' && (
              <div className="space-y-3">
                {submitted && <div className="rounded-lg p-3 text-sm text-green-700 bg-green-50">{t('ticketCreated')}</div>}
                <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder={t('subject')}
                  className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--donor-border)', color: 'var(--donor-dark)' }} />
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--donor-border)', color: 'var(--donor-dark)' }}>
                  {['Technical Issue', 'Account & Access', 'Funding & Tranches', 'Verification', 'Investment', 'Reports', 'Other'].map(c => <option key={c}>{c}</option>)}
                </select>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder={t('description')}
                  rows={3} className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--donor-border)', color: 'var(--donor-dark)' }} />
                <button onClick={submitTicket} disabled={submitting || !form.subject || !form.description}
                  className="w-full py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: 'var(--donor-accent)' }}>
                  {t('submit')}
                </button>
              </div>
            )}

            {tab === 'tickets' && (
              <div className="space-y-2">
                {tickets.length === 0 && <p className="text-sm text-center py-4" style={{ color: 'var(--donor-muted)' }}>{t('noTickets')}</p>}
                {tickets.map(tk => {
                  const sc = STATUS_COLORS[tk.status] || STATUS_COLORS.open
                  return (
                    <a key={tk.id} href="/support" className="block rounded-lg border p-3 hover:opacity-80" style={{ borderColor: 'var(--donor-border)' }}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate" style={{ color: 'var(--donor-dark)' }}>{tk.subject}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium ml-2 whitespace-nowrap" style={{ background: sc.bg, color: sc.text }}>{t(tk.status)}</span>
                      </div>
                    </a>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
