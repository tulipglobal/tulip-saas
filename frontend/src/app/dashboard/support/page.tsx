'use client'

import { useState, useEffect, useRef } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import {
  Plus, X, Send, ChevronLeft, Search,
  LifeBuoy, AlertCircle, Clock, CheckCircle, XCircle
} from 'lucide-react'
import { useTranslations } from 'next-intl'

/* ── Types ─────────────────────────────────────────────────── */

interface Ticket {
  id: string
  subject: string
  category: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  createdAt: string
  updatedAt: string
  messages?: TicketMessage[]
}

interface TicketMessage {
  id: string
  ticketId: string
  senderType: 'user' | 'agent' | 'system'
  senderName: string
  content: string
  createdAt: string
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

const PRIORITIES: Ticket['priority'][] = ['low', 'medium', 'high', 'critical']

/* ── Badge helpers ─────────────────────────────────────────── */

function StatusBadge({ status }: { status: Ticket['status'] }) {
  const styles: Record<Ticket['status'], string> = {
    open: 'bg-blue-400/10 text-blue-500 border-blue-400/20',
    in_progress: 'bg-amber-400/10 text-amber-500 border-amber-400/20',
    resolved: 'bg-green-400/10 text-green-500 border-green-400/20',
    closed: 'bg-gray-400/10 text-gray-500 border-gray-400/20',
  }
  const labels: Record<Ticket['status'], string> = {
    open: 'Open',
    in_progress: 'In Progress',
    resolved: 'Resolved',
    closed: 'Closed',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: Ticket['priority'] }) {
  const styles: Record<Ticket['priority'], string> = {
    low: 'bg-gray-400/10 text-gray-500 border-gray-400/20',
    medium: 'bg-blue-400/10 text-blue-500 border-blue-400/20',
    high: 'bg-orange-400/10 text-orange-500 border-orange-400/20',
    critical: 'bg-red-400/10 text-red-500 border-red-400/20',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border font-medium capitalize ${styles[priority]}`}>
      {priority}
    </span>
  )
}

/* ── Status icon helper ────────────────────────────────────── */

function StatusIcon({ status }: { status: Ticket['status'] }) {
  switch (status) {
    case 'open': return <AlertCircle size={14} className="text-blue-500" />
    case 'in_progress': return <Clock size={14} className="text-amber-500" />
    case 'resolved': return <CheckCircle size={14} className="text-green-500" />
    case 'closed': return <XCircle size={14} className="text-gray-400" />
  }
}

/* ── New Ticket Modal ──────────────────────────────────────── */

function NewTicketModal({ onClose, onCreated, t }: {
  onClose: () => void
  onCreated: (ticket: Ticket) => void
  t: ReturnType<typeof useTranslations>
}) {
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [priority, setPriority] = useState<Ticket['priority']>('medium')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!subject.trim() || !description.trim()) {
      setError(t('fieldsRequired'))
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await apiPost('/api/support/tickets', {
        subject: subject.trim(),
        category,
        priority,
        description: description.trim(),
      })
      if (res.ok) {
        const ticket = await res.json()
        onCreated(ticket)
        onClose()
      } else {
        const d = await res.json().catch(() => ({}))
        setError(d.error || t('createFailed'))
      }
    } catch {
      setError(t('networkError'))
    }
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-[var(--tulip-cream)] rounded-xl border border-[var(--tulip-sage-dark)] p-6 max-w-lg w-full space-y-5 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[var(--tulip-forest)]" style={{ fontFamily: 'Inter, sans-serif' }}>
            {t('newTicket')}
          </h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--tulip-sage)] transition-colors">
            <X size={16} className="text-[var(--tulip-forest)]/60" />
          </button>
        </div>

        {/* Subject */}
        <div>
          <label className="block text-xs font-medium text-[var(--tulip-forest)]/60 mb-1.5 uppercase tracking-wide">
            {t('subject')}
          </label>
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder={t('subjectPlaceholder')}
            className="w-full bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-4 py-2.5 text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none focus:border-[var(--tulip-gold)] transition-colors"
          />
        </div>

        {/* Category + Priority row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[var(--tulip-forest)]/60 mb-1.5 uppercase tracking-wide">
              {t('category')}
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-4 py-2.5 text-sm text-[var(--tulip-forest)] outline-none focus:border-[var(--tulip-gold)] transition-colors"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--tulip-forest)]/60 mb-1.5 uppercase tracking-wide">
              {t('priority')}
            </label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as Ticket['priority'])}
              className="w-full bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-4 py-2.5 text-sm text-[var(--tulip-forest)] outline-none focus:border-[var(--tulip-gold)] transition-colors capitalize"
            >
              {PRIORITIES.map(p => <option key={p} value={p} className="capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-[var(--tulip-forest)]/60 mb-1.5 uppercase tracking-wide">
            {t('description')}
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={t('descriptionPlaceholder')}
            rows={5}
            className="w-full bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-4 py-2.5 text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none focus:border-[var(--tulip-gold)] resize-none transition-colors"
          />
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSubmit}
            disabled={submitting || !subject.trim() || !description.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-[var(--tulip-forest)] bg-[var(--tulip-gold)] hover:bg-[var(--tulip-orange)] disabled:opacity-50 transition-colors"
          >
            {submitting ? t('submitting') : t('submitTicket')}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg text-sm text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)] transition-colors">
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Thread View ───────────────────────────────────────────── */

function ThreadView({ ticket, onBack, onRefresh, t }: {
  ticket: Ticket
  onBack: () => void
  onRefresh: () => void
  t: ReturnType<typeof useTranslations>
}) {
  const [messages, setMessages] = useState<TicketMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const loadMessages = async () => {
    try {
      const res = await apiGet(`/api/support/tickets/${ticket.id}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
      }
    } catch { /* silent */ }
    setLoading(false)
  }

  useEffect(() => {
    loadMessages()
  }, [ticket.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!reply.trim()) return
    setSending(true)
    try {
      const res = await apiPost(`/api/support/tickets/${ticket.id}/messages`, {
        content: reply.trim(),
      })
      if (res.ok) {
        setReply('')
        await loadMessages()
        onRefresh()
      }
    } catch { /* silent */ }
    setSending(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Thread header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)]">
        <button
          onClick={onBack}
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--tulip-sage-dark)] transition-colors"
        >
          <ChevronLeft size={18} className="text-[var(--tulip-forest)]" />
        </button>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[var(--tulip-forest)] truncate" style={{ fontFamily: 'Inter, sans-serif' }}>
            {ticket.subject}
          </h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-[var(--tulip-forest)]/50">{ticket.category}</span>
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-[var(--tulip-forest)]/40">
            {t('loadingMessages')}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-[var(--tulip-forest)]/40">
            {t('noMessages')}
          </div>
        ) : (
          messages.map(msg => {
            const isUser = msg.senderType === 'user'
            return (
              <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-xl px-4 py-3 ${
                  isUser
                    ? 'bg-[var(--tulip-forest)] text-[var(--tulip-cream)]'
                    : msg.senderType === 'system'
                      ? 'bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] text-[var(--tulip-forest)]/70 italic'
                      : 'bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] text-[var(--tulip-forest)]'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[11px] font-medium ${isUser ? 'text-[var(--tulip-gold)]' : 'text-[var(--tulip-forest)]/50'}`}>
                      {msg.senderName}
                    </span>
                    <span className={`text-[10px] ${isUser ? 'text-[var(--tulip-cream)]/40' : 'text-[var(--tulip-forest)]/30'}`}>
                      {new Date(msg.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply input */}
      {ticket.status !== 'closed' && (
        <div className="border-t border-[var(--tulip-sage-dark)] p-4 bg-[var(--tulip-sage)]">
          <div className="flex items-end gap-3">
            <textarea
              value={reply}
              onChange={e => setReply(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('replyPlaceholder')}
              rows={2}
              className="flex-1 bg-[var(--tulip-cream)] border border-[var(--tulip-sage-dark)] rounded-lg px-4 py-2.5 text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none focus:border-[var(--tulip-gold)] resize-none transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={sending || !reply.trim()}
              className="w-10 h-10 rounded-lg bg-[var(--tulip-gold)] hover:bg-[var(--tulip-orange)] flex items-center justify-center disabled:opacity-50 transition-colors shrink-0"
            >
              <Send size={16} className="text-[var(--tulip-forest)]" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Main Page ─────────────────────────────────────────────── */

export default function SupportPage() {
  const t = useTranslations('support')
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showNewModal, setShowNewModal] = useState(false)
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const loadTickets = async () => {
    try {
      const res = await apiGet('/api/support/tickets')
      if (res.ok) {
        const data = await res.json()
        setTickets(data.tickets || data.data || data || [])
      }
    } catch { /* silent */ }
    setLoading(false)
  }

  useEffect(() => {
    loadTickets()
  }, [])

  const filtered = tickets
    .filter(t => statusFilter === 'all' || t.status === statusFilter)
    .filter(t =>
      t.subject.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase())
    )

  if (activeTicket) {
    return (
      <div className="h-full flex flex-col animate-fade-up">
        <ThreadView
          ticket={activeTicket}
          onBack={() => setActiveTicket(null)}
          onRefresh={loadTickets}
          t={t}
        />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--tulip-forest)]" style={{ fontFamily: 'Inter, sans-serif' }}>
            {t('title')}
          </h1>
          <p className="text-[var(--tulip-forest)]/60 text-sm mt-1">
            {t('subtitle', { count: tickets.length })}
          </p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[var(--tulip-forest)] self-start bg-[var(--tulip-gold)] hover:bg-[var(--tulip-orange)] transition-colors"
        >
          <Plus size={16} /> {t('newTicket')}
        </button>
      </div>

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-3 bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-4 py-2.5 max-w-sm w-full sm:w-auto">
          <Search size={15} className="text-[var(--tulip-forest)]/40" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('searchTickets')}
            className="bg-transparent text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none w-full"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {['all', 'open', 'in_progress', 'resolved', 'closed'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-[var(--tulip-gold)]/20 text-[var(--tulip-forest)] border border-[var(--tulip-gold)]/30'
                  : 'text-[var(--tulip-forest)]/50 hover:text-[var(--tulip-forest)] hover:bg-[var(--tulip-sage)]'
              }`}
            >
              {s === 'all' ? t('all') : s === 'in_progress' ? t('inProgress') : t(s)}
            </button>
          ))}
        </div>
      </div>

      {/* Ticket list */}
      <div className="rounded-xl border border-[var(--tulip-sage-dark)] overflow-hidden" style={{ background: 'var(--tulip-sage)' }}>
        {/* Table header */}
        <div className="hidden lg:grid grid-cols-[2fr_1fr_100px_100px_140px] gap-4 px-5 py-3 border-b border-[var(--tulip-sage-dark)] text-xs text-[var(--tulip-forest)]/40 uppercase tracking-wide font-medium">
          <span>{t('subject')}</span>
          <span>{t('category')}</span>
          <span>{t('priority')}</span>
          <span>{t('status')}</span>
          <span>{t('lastUpdated')}</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-[var(--tulip-forest)]/40 text-sm">{t('loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-[var(--tulip-gold)]/10 flex items-center justify-center">
              <LifeBuoy size={24} className="text-[var(--tulip-forest)]/40" />
            </div>
            <p className="text-[var(--tulip-forest)]/40 text-sm">{t('noTickets')}</p>
            <button
              onClick={() => setShowNewModal(true)}
              className="text-sm text-[var(--tulip-forest)] hover:text-[var(--tulip-gold)] transition-colors"
            >
              {t('createFirst')}
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[var(--tulip-sage-dark)]">
            {filtered.map(ticket => (
              <button
                key={ticket.id}
                onClick={() => setActiveTicket(ticket)}
                className="w-full text-left px-4 py-3.5 hover:bg-[var(--tulip-sage)]/50 transition-colors cursor-pointer lg:grid lg:grid-cols-[2fr_1fr_100px_100px_140px] lg:gap-4 lg:items-center lg:px-5"
              >
                {/* Subject + mobile meta */}
                <div>
                  <div className="flex items-center gap-2">
                    <StatusIcon status={ticket.status} />
                    <span className="text-sm font-medium text-[var(--tulip-forest)]">{ticket.subject}</span>
                  </div>
                  {/* Mobile-only row */}
                  <div className="flex items-center gap-2 mt-1.5 lg:hidden flex-wrap">
                    <span className="text-xs text-[var(--tulip-forest)]/50">{ticket.category}</span>
                    <PriorityBadge priority={ticket.priority} />
                    <StatusBadge status={ticket.status} />
                    <span className="text-[10px] text-[var(--tulip-forest)]/40">
                      {new Date(ticket.updatedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
                {/* Category */}
                <div className="hidden lg:block text-xs text-[var(--tulip-forest)]/60">{ticket.category}</div>
                {/* Priority */}
                <div className="hidden lg:block"><PriorityBadge priority={ticket.priority} /></div>
                {/* Status */}
                <div className="hidden lg:block"><StatusBadge status={ticket.status} /></div>
                {/* Updated */}
                <div className="hidden lg:block text-xs text-[var(--tulip-forest)]/50">
                  {new Date(ticket.updatedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* New Ticket Modal */}
      {showNewModal && (
        <NewTicketModal
          onClose={() => setShowNewModal(false)}
          onCreated={(ticket) => {
            setTickets(prev => [ticket, ...prev])
          }}
          t={t}
        />
      )}
    </div>
  )
}
