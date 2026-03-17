'use client'

import { useState, useEffect, useRef } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import {
  HelpCircle, X, Search, Send, LifeBuoy,
  FileText, ChevronRight, Clock, AlertCircle, CheckCircle, XCircle
} from 'lucide-react'
import { useTranslations } from 'next-intl'

/* ── Types ─────────────────────────────────────────────────── */

interface SearchResult {
  id: string
  slug: string
  title: string
  summary?: string
  categorySlug?: string
}

interface QuickTicket {
  subject: string
  description: string
  category: string
}

interface TicketSummary {
  id: string
  subject: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  updatedAt: string
}

/* ── Constants ─────────────────────────────────────────────── */

const CATEGORIES = [
  'Technical Issue',
  'Billing',
  'Account & Access',
  'Project & Expenses',
  'Donor Portal',
  'Blockchain & Verification',
  'Other',
]

const TAB_KEYS = ['search', 'support', 'tickets'] as const
type TabKey = typeof TAB_KEYS[number]

/* ── Status badge ──────────────────────────────────────────── */

function MiniStatusBadge({ status }: { status: TicketSummary['status'] }) {
  const map: Record<TicketSummary['status'], { bg: string; text: string; label: string; Icon: typeof AlertCircle }> = {
    open: { bg: 'bg-blue-400/10', text: 'text-blue-500', label: 'Open', Icon: AlertCircle },
    in_progress: { bg: 'bg-amber-400/10', text: 'text-amber-500', label: 'In Progress', Icon: Clock },
    resolved: { bg: 'bg-green-400/10', text: 'text-green-500', label: 'Resolved', Icon: CheckCircle },
    closed: { bg: 'bg-gray-400/10', text: 'text-gray-400', label: 'Closed', Icon: XCircle },
  }
  const { bg, text, label, Icon } = map[status]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${bg} ${text}`}>
      <Icon size={10} /> {label}
    </span>
  )
}

/* ── Main Component ────────────────────────────────────────── */

export default function FloatingHelpButton() {
  const t = useTranslations('help')
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('search')
  const panelRef = useRef<HTMLDivElement>(null)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // Support tab state
  const [ticketSubject, setTicketSubject] = useState('')
  const [ticketDescription, setTicketDescription] = useState('')
  const [ticketCategory, setTicketCategory] = useState(CATEGORIES[0])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Tickets tab state
  const [tickets, setTickets] = useState<TicketSummary[]>([])
  const [ticketsLoading, setTicketsLoading] = useState(false)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  // Search with debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      setIsSearching(false)
      return
    }
    setIsSearching(true)
    const timer = setTimeout(() => {
      apiGet(`/api/kb/search?q=${encodeURIComponent(searchQuery)}&role=ngo`)
        .then(r => r.ok ? r.json() : { articles: [] })
        .then(d => {
          setSearchResults(d.articles || d.data || d || [])
          setIsSearching(false)
        })
        .catch(() => setIsSearching(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Load tickets when tab switches to tickets
  useEffect(() => {
    if (activeTab !== 'tickets' || !open) return
    setTicketsLoading(true)
    apiGet('/api/support/tickets?status=open,in_progress')
      .then(r => r.ok ? r.json() : { tickets: [] })
      .then(d => {
        setTickets(d.tickets || d.data || d || [])
        setTicketsLoading(false)
      })
      .catch(() => setTicketsLoading(false))
  }, [activeTab, open])

  // Submit quick ticket
  const handleSubmitTicket = async () => {
    if (!ticketSubject.trim() || !ticketDescription.trim()) {
      setSubmitError(t('fieldsRequired'))
      return
    }
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await apiPost('/api/support/tickets', {
        subject: ticketSubject.trim(),
        category: ticketCategory,
        priority: 'medium',
        description: ticketDescription.trim(),
      })
      if (res.ok) {
        setSubmitted(true)
        setTicketSubject('')
        setTicketDescription('')
        setTicketCategory(CATEGORIES[0])
      } else {
        const d = await res.json().catch(() => ({}))
        setSubmitError(d.error || t('submitFailed'))
      }
    } catch {
      setSubmitError(t('networkError'))
    }
    setSubmitting(false)
  }

  // Reset submitted state when switching tabs
  useEffect(() => {
    if (activeTab !== 'support') {
      setSubmitted(false)
      setSubmitError('')
    }
  }, [activeTab])

  const tabLabels: Record<TabKey, string> = {
    search: t('searchTab'),
    support: t('supportTab'),
    tickets: t('ticketsTab'),
  }

  return (
    <div className="fixed bottom-6 right-6 z-50" ref={panelRef}>
      {/* Panel */}
      {open && (
        <div
          className="absolute bottom-14 right-0 w-80 sm:w-96 max-h-[32rem] rounded-xl border shadow-2xl overflow-hidden flex flex-col"
          style={{
            background: 'var(--tulip-cream)',
            borderColor: 'var(--tulip-sage-dark)',
            animation: 'slideInRight 0.2s ease-out',
          }}
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--tulip-sage-dark)', background: 'var(--tulip-sage)' }}>
            <div className="flex items-center gap-2">
              <HelpCircle size={16} className="text-[var(--tulip-forest)]" />
              <span className="text-sm font-semibold text-[var(--tulip-forest)]" style={{ fontFamily: 'Inter, sans-serif' }}>
                {t('helpCenter')}
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-[var(--tulip-sage-dark)] transition-colors"
            >
              <X size={14} className="text-[var(--tulip-forest)]" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b" style={{ borderColor: 'var(--tulip-sage-dark)' }}>
            {TAB_KEYS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 text-xs font-medium py-2.5 transition-colors ${
                  activeTab === tab
                    ? 'text-[var(--tulip-forest)] border-b-2'
                    : 'text-[var(--tulip-forest)]/40 hover:text-[var(--tulip-forest)]/70'
                }`}
                style={activeTab === tab ? { borderBottomColor: 'var(--tulip-gold)' } : {}}
              >
                {tabLabels[tab]}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">

            {/* Search tab */}
            {activeTab === 'search' && (
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2 bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-3 py-2">
                  <Search size={14} className="text-[var(--tulip-forest)]/40 shrink-0" />
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={t('searchArticles')}
                    autoFocus
                    className="bg-transparent text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none w-full"
                  />
                </div>
                {isSearching && (
                  <p className="text-xs text-[var(--tulip-forest)]/40 px-1">{t('searching')}</p>
                )}
                {!isSearching && searchQuery.trim() && searchResults.length === 0 && (
                  <p className="text-xs text-[var(--tulip-forest)]/40 px-1">{t('noResults')}</p>
                )}
                {searchResults.length > 0 && (
                  <div className="rounded-lg border border-[var(--tulip-sage-dark)] overflow-hidden divide-y divide-[var(--tulip-sage-dark)]">
                    {searchResults.slice(0, 6).map(result => (
                      <a
                        key={result.id}
                        href={`/dashboard/knowledge-base`}
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--tulip-sage)] transition-colors group"
                      >
                        <FileText size={12} className="text-[var(--tulip-forest)]/40 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-[var(--tulip-forest)] truncate">{result.title}</p>
                          {result.summary && (
                            <p className="text-[10px] text-[var(--tulip-forest)]/40 truncate">{result.summary}</p>
                          )}
                        </div>
                        <ChevronRight size={10} className="text-[var(--tulip-forest)]/20 shrink-0" />
                      </a>
                    ))}
                  </div>
                )}
                {!searchQuery.trim() && (
                  <div className="text-center py-6">
                    <Search size={20} className="mx-auto mb-2 text-[var(--tulip-forest)]/20" />
                    <p className="text-xs text-[var(--tulip-forest)]/40">{t('searchPrompt')}</p>
                  </div>
                )}
              </div>
            )}

            {/* Support tab */}
            {activeTab === 'support' && (
              <div className="p-4 space-y-3">
                {submitted ? (
                  <div className="text-center py-8 space-y-2">
                    <CheckCircle size={28} className="mx-auto text-green-500" />
                    <p className="text-sm font-medium text-[var(--tulip-forest)]">{t('ticketCreated')}</p>
                    <p className="text-xs text-[var(--tulip-forest)]/50">{t('ticketCreatedDesc')}</p>
                    <button
                      onClick={() => setSubmitted(false)}
                      className="text-xs text-[var(--tulip-gold)] hover:underline mt-2"
                    >
                      {t('createAnother')}
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-[10px] font-medium text-[var(--tulip-forest)]/50 mb-1 uppercase tracking-wide">
                        {t('subject')}
                      </label>
                      <input
                        value={ticketSubject}
                        onChange={e => setTicketSubject(e.target.value)}
                        placeholder={t('subjectPlaceholder')}
                        className="w-full bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-3 py-2 text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none focus:border-[var(--tulip-gold)] transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-[var(--tulip-forest)]/50 mb-1 uppercase tracking-wide">
                        {t('category')}
                      </label>
                      <select
                        value={ticketCategory}
                        onChange={e => setTicketCategory(e.target.value)}
                        className="w-full bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-3 py-2 text-sm text-[var(--tulip-forest)] outline-none focus:border-[var(--tulip-gold)] transition-colors"
                      >
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-[var(--tulip-forest)]/50 mb-1 uppercase tracking-wide">
                        {t('description')}
                      </label>
                      <textarea
                        value={ticketDescription}
                        onChange={e => setTicketDescription(e.target.value)}
                        placeholder={t('descriptionPlaceholder')}
                        rows={4}
                        className="w-full bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-3 py-2 text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none focus:border-[var(--tulip-gold)] resize-none transition-colors"
                      />
                    </div>
                    {submitError && <p className="text-xs text-red-500">{submitError}</p>}
                    <button
                      onClick={handleSubmitTicket}
                      disabled={submitting || !ticketSubject.trim() || !ticketDescription.trim()}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-[var(--tulip-forest)] bg-[var(--tulip-gold)] hover:bg-[var(--tulip-orange)] disabled:opacity-50 transition-colors"
                    >
                      <Send size={14} />
                      {submitting ? t('submitting') : t('submitTicket')}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Tickets tab */}
            {activeTab === 'tickets' && (
              <div className="p-4">
                {ticketsLoading ? (
                  <div className="text-center py-8 text-xs text-[var(--tulip-forest)]/40">{t('loading')}</div>
                ) : tickets.length === 0 ? (
                  <div className="text-center py-8 space-y-2">
                    <LifeBuoy size={24} className="mx-auto text-[var(--tulip-forest)]/20" />
                    <p className="text-xs text-[var(--tulip-forest)]/40">{t('noOpenTickets')}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tickets.map(ticket => (
                      <a
                        key={ticket.id}
                        href="/dashboard/support"
                        className="block rounded-lg border border-[var(--tulip-sage-dark)] p-3 hover:bg-[var(--tulip-sage)] transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-medium text-[var(--tulip-forest)] line-clamp-1 flex-1">
                            {ticket.subject}
                          </p>
                          <MiniStatusBadge status={ticket.status} />
                        </div>
                        <p className="text-[10px] text-[var(--tulip-forest)]/40 mt-1">
                          Updated {new Date(ticket.updatedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </a>
                    ))}
                    <a
                      href="/dashboard/support"
                      className="block text-center text-xs font-medium text-[var(--tulip-forest)]/50 hover:text-[var(--tulip-forest)] py-2 transition-colors"
                    >
                      {t('viewAllTickets')}
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className="w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105"
        style={{
          background: open ? 'var(--tulip-forest)' : 'var(--tulip-gold)',
          color: open ? 'var(--tulip-cream)' : 'var(--tulip-forest)',
        }}
        title={t('help')}
      >
        {open ? <X size={20} /> : <HelpCircle size={20} />}
      </button>
    </div>
  )
}
