'use client'

import { useState, useEffect, useRef } from 'react'
import { apiGet, apiPatch } from '@/lib/api'
import {
  ChevronLeft, Search, Send,
  LifeBuoy, AlertCircle, Clock, CheckCircle, XCircle
} from 'lucide-react'

interface Ticket {
  id: string
  subject: string
  category: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  tenantId?: string
  createdAt: string
  updatedAt: string
  messages?: TicketMessage[]
}

interface TicketMessage {
  id: string
  ticketId: string
  senderType: 'user' | 'admin' | 'system'
  senderId?: string
  message: string
  content?: string
  isInternal: boolean
  createdAt: string
}

function StatusBadge({ status }: { status: Ticket['status'] }) {
  const styles: Record<Ticket['status'], string> = {
    open: 'bg-blue-50 text-blue-600 border-blue-200',
    in_progress: 'bg-amber-50 text-amber-600 border-amber-200',
    resolved: 'bg-green-50 text-green-600 border-green-200',
    closed: 'bg-gray-50 text-gray-500 border-gray-200',
  }
  const labels: Record<Ticket['status'], string> = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed' }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border font-medium ${styles[status]}`}>{labels[status]}</span>
}

function PriorityBadge({ priority }: { priority: Ticket['priority'] }) {
  const styles: Record<Ticket['priority'], string> = {
    low: 'bg-gray-50 text-gray-500 border-gray-200',
    medium: 'bg-blue-50 text-blue-600 border-blue-200',
    high: 'bg-orange-50 text-orange-600 border-orange-200',
    critical: 'bg-red-50 text-red-600 border-red-200',
  }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border font-medium capitalize ${styles[priority]}`}>{priority}</span>
}

function StatusIcon({ status }: { status: Ticket['status'] }) {
  switch (status) {
    case 'open': return <AlertCircle size={14} className="text-blue-500" />
    case 'in_progress': return <Clock size={14} className="text-amber-500" />
    case 'resolved': return <CheckCircle size={14} className="text-green-500" />
    case 'closed': return <XCircle size={14} className="text-gray-400" />
  }
}

function ThreadView({ ticket, onBack, onRefresh }: { ticket: Ticket; onBack: () => void; onRefresh: () => void }) {
  const [messages, setMessages] = useState<TicketMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState(ticket.status)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const loadMessages = async () => {
    try {
      const res = await apiGet(`/api/admin/support/tickets/${ticket.id}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
        setStatus(data.status)
      }
    } catch {}
    setLoading(false)
  }

  useEffect(() => { loadMessages() }, [ticket.id])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const handleSend = async () => {
    if (!reply.trim()) return
    setSending(true)
    try {
      const res = await apiPatch(`/api/admin/support/tickets/${ticket.id}`, { message: reply.trim() })
      if (res.ok) {
        setReply('')
        await loadMessages()
        onRefresh()
      }
    } catch {}
    setSending(false)
  }

  const handleStatusChange = async (newStatus: string) => {
    try {
      const res = await apiPatch(`/api/admin/support/tickets/${ticket.id}`, { status: newStatus })
      if (res.ok) {
        setStatus(newStatus as Ticket['status'])
        onRefresh()
      }
    } catch {}
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-[var(--admin-card)] rounded-xl border border-[var(--admin-border)]">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--admin-border)]">
        <button onClick={onBack} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--admin-bg)] transition-colors">
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[var(--admin-text)] truncate">{ticket.subject}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-[var(--admin-text-muted)]">{ticket.category}</span>
            <StatusBadge status={status} />
            <PriorityBadge priority={ticket.priority} />
          </div>
        </div>
        <select
          value={status}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] text-sm"
        >
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-[var(--admin-text-muted)]">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-[var(--admin-text-muted)]">No messages yet</div>
        ) : (
          messages.map(msg => {
            const isAdmin = msg.senderType === 'admin'
            return (
              <div key={msg.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-xl px-4 py-3 ${
                  isAdmin
                    ? 'bg-[var(--admin-accent)] text-white'
                    : msg.senderType === 'system'
                      ? 'bg-gray-50 border border-gray-200 text-gray-500 italic'
                      : 'bg-[var(--admin-bg)] border border-[var(--admin-border)] text-[var(--admin-text)]'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[11px] font-medium ${isAdmin ? 'text-white/70' : 'text-[var(--admin-text-muted)]'}`}>
                      {msg.senderType === 'user' ? 'Customer' : msg.senderType === 'admin' ? 'Admin' : 'System'}
                    </span>
                    <span className={`text-[10px] ${isAdmin ? 'text-white/50' : 'text-[var(--admin-text-muted)]'}`}>
                      {new Date(msg.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{msg.message || msg.content}</p>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-[var(--admin-border)] p-4">
        <div className="flex items-end gap-3">
          <textarea
            value={reply}
            onChange={e => setReply(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder="Type a reply..."
            rows={2}
            className="flex-1 rounded-lg px-4 py-2.5 text-sm border border-[var(--admin-border)] bg-[var(--admin-bg)] outline-none resize-none focus:ring-2 focus:ring-[var(--admin-accent)]/50"
          />
          <button
            onClick={handleSend}
            disabled={sending || !reply.trim()}
            className="w-10 h-10 rounded-lg bg-[var(--admin-accent)] hover:bg-[var(--admin-accent-hover)] flex items-center justify-center disabled:opacity-50 transition-colors shrink-0"
          >
            <Send size={16} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')

  const loadTickets = async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await apiGet(`/api/admin/support/tickets?${params}`)
      if (res.ok) setTickets(await res.json())
    } catch {}
    setLoading(false)
  }

  useEffect(() => { loadTickets() }, [statusFilter])

  const filtered = tickets.filter(t =>
    t.subject.toLowerCase().includes(search.toLowerCase()) ||
    t.category.toLowerCase().includes(search.toLowerCase())
  )

  if (activeTicket) {
    return <ThreadView ticket={activeTicket} onBack={() => setActiveTicket(null)} onRefresh={loadTickets} />
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--admin-text)]">Support Tickets</h1>
          <p className="text-sm text-[var(--admin-text-secondary)] mt-1">{tickets.length} tickets total</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative max-w-sm w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tickets..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-card)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {['all', 'open', 'in_progress', 'resolved', 'closed'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-[var(--admin-accent)]/10 text-[var(--admin-accent)] border border-[var(--admin-accent)]/30'
                  : 'text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] hover:bg-[var(--admin-bg)]'
              }`}
            >
              {s === 'all' ? 'All' : s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[var(--admin-card)] rounded-xl border border-[var(--admin-border)] overflow-hidden">
        <div className="hidden lg:grid grid-cols-[2fr_1fr_100px_100px_140px] gap-4 px-5 py-3 border-b border-[var(--admin-border)] text-xs text-[var(--admin-text-muted)] uppercase tracking-wide font-medium bg-[var(--admin-bg)]">
          <span>Subject</span><span>Category</span><span>Priority</span><span>Status</span><span>Last Updated</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-[var(--admin-text-muted)] text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <LifeBuoy size={24} className="text-[var(--admin-text-muted)]" />
            <p className="text-[var(--admin-text-muted)] text-sm">No tickets found</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--admin-border)]">
            {filtered.map(ticket => (
              <button
                key={ticket.id}
                onClick={() => setActiveTicket(ticket)}
                className="w-full text-left px-4 py-3.5 hover:bg-[var(--admin-bg)] transition-colors cursor-pointer lg:grid lg:grid-cols-[2fr_1fr_100px_100px_140px] lg:gap-4 lg:items-center lg:px-5"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <StatusIcon status={ticket.status} />
                    <span className="text-sm font-medium text-[var(--admin-text)]">{ticket.subject}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 lg:hidden flex-wrap">
                    <span className="text-xs text-[var(--admin-text-muted)]">{ticket.category}</span>
                    <PriorityBadge priority={ticket.priority} />
                    <StatusBadge status={ticket.status} />
                  </div>
                </div>
                <div className="hidden lg:block text-xs text-[var(--admin-text-secondary)]">{ticket.category}</div>
                <div className="hidden lg:block"><PriorityBadge priority={ticket.priority} /></div>
                <div className="hidden lg:block"><StatusBadge status={ticket.status} /></div>
                <div className="hidden lg:block text-xs text-[var(--admin-text-muted)]">
                  {new Date(ticket.updatedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
