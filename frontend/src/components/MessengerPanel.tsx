'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import {
  X, Send, Paperclip, Phone, PhoneOff, ArrowLeft,
  MessageCircle, ChevronDown, Search
} from 'lucide-react'
import { io, Socket } from 'socket.io-client'

// ── Types ──────────────────────────────────────────────────────

interface Conversation {
  id: string
  donorOrgId: string
  donorOrgName: string
  lastMessage: string | null
  lastMessageAt: string | null
  unreadCount: number
}

interface Message {
  id: string
  conversationId: string
  senderId: string
  senderType: 'NGO' | 'DONOR'
  senderName: string
  content: string
  fileUrl: string | null
  fileName: string | null
  createdAt: string
  readAt: string | null
}

interface IncomingCall {
  callId: string
  callerName: string
  callerType: string
}

type SortOption = 'online' | 'recent' | 'unread' | 'alphabetical'

// ── Helpers ────────────────────────────────────────────────────

function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'now'
  if (diffMin < 60) return `${diffMin}m`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h`
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

// ── Component ──────────────────────────────────────────────────

interface MessengerPanelProps {
  open: boolean
  onClose: () => void
  openToConversation?: string | null // donorOrgId to open directly
}

export default function MessengerPanel({ open, onClose, openToConversation }: MessengerPanelProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [msgText, setMsgText] = useState('')
  const [loading, setLoading] = useState(false)
  const [msgLoading, setMsgLoading] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<SortOption>('online')
  const [showSort, setShowSort] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null)
  const [activeCall, setActiveCall] = useState<{ callId: string; callerName: string } | null>(null)

  const socketRef = useRef<Socket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserName, setCurrentUserName] = useState('NGO User')
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(null)

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem('tulip_user') || '{}')
      setCurrentUserId(user.id || null)
      setCurrentUserName(user.name || 'NGO User')
      setCurrentTenantId(user.tenantId || null)
    } catch { /* silent */ }
  }, [])

  // ── Socket.IO connection ────────────────────────────────────
  useEffect(() => {
    if (!open) return

    let socket: Socket
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050'
      socket = io(apiUrl, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
      })
      socketRef.current = socket
    } catch (err) {
      console.warn('Socket.IO initialization failed:', err)
      return
    }

    socket.on('connect', () => {
      socket.emit('authenticate', {
        userId: currentUserId,
        userType: 'NGO',
        name: currentUserName,
        tenantId: currentTenantId,
      })
    })

    socket.on('connect_error', (err) => {
      console.warn('Socket.IO connection error:', err.message)
    })

    socket.on('new_message', (msg: Message) => {
      // Update conversation list
      setConversations(prev => {
        const arr = Array.isArray(prev) ? prev : []
        return arr.map(c =>
          c.id === msg.conversationId
            ? { ...c, lastMessage: msg.content, lastMessageAt: msg.createdAt, unreadCount: c.unreadCount + (msg.senderType !== 'NGO' ? 1 : 0) }
            : c
        )
      })
      // If viewing this conversation, append message
      setActiveConvo(current => {
        if (current && current.id === msg.conversationId) {
          setMessages(prev => {
            const arr = Array.isArray(prev) ? prev : []
            return [...arr, msg]
          })
          // Mark as read
          if (msg.senderType !== 'NGO') {
            apiPost(`/api/messenger/ngo/conversations/${msg.conversationId}/read`, {}).catch(() => {})
            socket.emit('messages_read', { conversationId: msg.conversationId })
          }
        }
        return current
      })
    })

    socket.on('messages_read', ({ conversationId }: { conversationId: string }) => {
      setConversations(prev => {
        const arr = Array.isArray(prev) ? prev : []
        return arr.map(c =>
          c.id === conversationId ? { ...c, unreadCount: 0 } : c
        )
      })
    })

    socket.on('user_online', ({ userId }: { userId: string }) => {
      setOnlineUsers(prev => new Set(prev).add(userId))
    })

    socket.on('user_offline', ({ userId }: { userId: string }) => {
      setOnlineUsers(prev => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })
    })

    socket.on('call_incoming', (call: IncomingCall) => {
      setIncomingCall(call)
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [open, currentUserId, currentUserName, currentTenantId])

  // ── Fetch conversations ─────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiGet('/api/messenger/ngo/conversations')
      if (res.ok) {
        const data = await res.json()
        const list = Array.isArray(data.data) ? data.data : Array.isArray(data.conversations) ? data.conversations : Array.isArray(data) ? data : []
        setConversations(list)
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  // ── Fetch online users ──────────────────────────────────────
  const fetchOnlineUsers = useCallback(async () => {
    try {
      const res = await apiGet('/api/messenger/ngo/online-users')
      if (res.ok) {
        const data = await res.json()
        const raw = Array.isArray(data.data) ? data.data : Array.isArray(data.users) ? data.users : Array.isArray(data) ? data : []
        const ids = raw.map((u: any) => u.userId || u.id || u)
        setOnlineUsers(new Set(ids))
      }
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    if (!open) return
    fetchConversations()
    fetchOnlineUsers()
  }, [open, fetchConversations, fetchOnlineUsers])

  // ── Open to specific conversation ──────────────────────────
  useEffect(() => {
    if (open && openToConversation && conversations.length > 0) {
      const convo = conversations.find(c => c.donorOrgId === openToConversation)
      if (convo) {
        setActiveConvo(convo)
      }
    }
  }, [open, openToConversation, conversations])

  // ── Fetch messages for active conversation ──────────────────
  useEffect(() => {
    if (!activeConvo) return
    setMsgLoading(true)
    apiGet(`/api/messenger/ngo/conversations/${activeConvo.id}/messages`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          const msgs = Array.isArray(data.data) ? data.data : Array.isArray(data.messages) ? data.messages : Array.isArray(data) ? data : []
          setMessages(msgs)
        }
        setMsgLoading(false)
        // Mark as read
        apiPost(`/api/messenger/ngo/conversations/${activeConvo.id}/read`, {}).catch(() => {})
        if (socketRef.current) {
          socketRef.current.emit('messages_read', { conversationId: activeConvo.id })
        }
        // Update unread count locally
        setConversations(prev => {
          const arr = Array.isArray(prev) ? prev : []
          return arr.map(c =>
            c.id === activeConvo.id ? { ...c, unreadCount: 0 } : c
          )
        })
      })
      .catch(() => setMsgLoading(false))
  }, [activeConvo])

  // ── Scroll to bottom on new messages ────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Send message ────────────────────────────────────────────
  const handleSend = async () => {
    if (!msgText.trim() || !activeConvo) return
    const text = msgText.trim()
    setMsgText('')
    try {
      const res = await apiPost(`/api/messenger/ngo/conversations/${activeConvo.id}/messages`, { content: text })
      if (res.ok) {
        const msg = await res.json()
        setMessages(prev => {
          const arr = Array.isArray(prev) ? prev : []
          return [...arr, msg.data || msg]
        })
        setConversations(prev => {
          const arr = Array.isArray(prev) ? prev : []
          return arr.map(c =>
            c.id === activeConvo.id ? { ...c, lastMessage: text, lastMessageAt: new Date().toISOString() } : c
          )
        })
      }
    } catch { /* silent */ }
  }

  // ── File attach ─────────────────────────────────────────────
  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeConvo) return
    const formData = new FormData()
    formData.append('file', file)
    try {
      const token = localStorage.getItem('tulip_token')
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/messenger/ngo/conversations/${activeConvo.id}/messages/file`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      })
      if (res.ok) {
        const msg = await res.json()
        setMessages(prev => {
          const arr = Array.isArray(prev) ? prev : []
          return [...arr, msg.data || msg]
        })
      }
    } catch { /* silent */ }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Call actions ────────────────────────────────────────────
  const handleCall = () => {
    if (!activeConvo || !socketRef.current) return
    socketRef.current.emit('call_initiate', {
      conversationId: activeConvo.id,
      targetOrgId: activeConvo.donorOrgId,
    })
    setActiveCall({ callId: activeConvo.id, callerName: activeConvo.donorOrgName })
  }

  const handleAcceptCall = () => {
    if (!incomingCall || !socketRef.current) return
    socketRef.current.emit('call_accept', { callId: incomingCall.callId })
    setActiveCall({ callId: incomingCall.callId, callerName: incomingCall.callerName })
    setIncomingCall(null)
  }

  const handleDeclineCall = () => {
    if (!incomingCall || !socketRef.current) return
    socketRef.current.emit('call_decline', { callId: incomingCall.callId })
    setIncomingCall(null)
  }

  const handleEndCall = () => {
    if (!activeCall || !socketRef.current) return
    socketRef.current.emit('call_end', { callId: activeCall.callId })
    setActiveCall(null)
  }

  // ── Sort conversations ─────────────────────────────────────
  const safeConversations = Array.isArray(conversations) ? conversations : []
  const sortedConversations = [...safeConversations]
    .filter(c => !searchQuery || c.donorOrgName.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      switch (sortBy) {
        case 'online': {
          const aOnline = onlineUsers.has(a.donorOrgId) ? 1 : 0
          const bOnline = onlineUsers.has(b.donorOrgId) ? 1 : 0
          if (bOnline !== aOnline) return bOnline - aOnline
          return (b.lastMessageAt || '').localeCompare(a.lastMessageAt || '')
        }
        case 'recent':
          return (b.lastMessageAt || '').localeCompare(a.lastMessageAt || '')
        case 'unread':
          if (b.unreadCount !== a.unreadCount) return b.unreadCount - a.unreadCount
          return (b.lastMessageAt || '').localeCompare(a.lastMessageAt || '')
        case 'alphabetical':
          return a.donorOrgName.localeCompare(b.donorOrgName)
        default:
          return 0
      }
    })

  const sortLabels: Record<SortOption, string> = {
    online: 'Online first',
    recent: 'Most recent',
    unread: 'Unread first',
    alphabetical: 'Alphabetical',
  }

  if (!open) return null

  return (
    <>
      {/* Incoming call overlay */}
      {incomingCall && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#fefbe9] rounded-2xl border border-[#c8d6c0] shadow-2xl p-8 text-center max-w-sm mx-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <Phone size={28} className="text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-[#183a1d] mb-1">Incoming Call</h3>
            <p className="text-sm text-[#183a1d]/60 mb-6">{incomingCall.callerName}</p>
            <div className="flex items-center justify-center gap-4">
              <button onClick={handleDeclineCall}
                className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center text-white hover:bg-red-600 transition-all">
                <PhoneOff size={22} />
              </button>
              <button onClick={handleAcceptCall}
                className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center text-white hover:bg-green-600 transition-all">
                <Phone size={22} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active call bar */}
      {activeCall && (
        <div className="fixed top-0 left-0 right-0 z-[55] bg-green-600 text-white px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Phone size={16} className="animate-pulse" />
            <span className="text-sm font-medium">Call with {activeCall.callerName}</span>
          </div>
          <button onClick={handleEndCall}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-sm font-medium transition-all">
            <PhoneOff size={14} /> End Call
          </button>
        </div>
      )}

      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed top-0 right-0 bottom-0 z-50 w-[380px] max-w-full bg-[#fefbe9] border-l border-[#c8d6c0] shadow-2xl flex flex-col"
        style={{ animation: 'slideInFromRight 0.25s ease-out' }}
      >
        {/* Header */}
        <div className="h-14 border-b border-[#c8d6c0] flex items-center justify-between px-4 shrink-0 bg-[#183a1d]">
          {activeConvo ? (
            <>
              <button onClick={() => { setActiveConvo(null); setMessages([]) }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#fefbe9]/70 hover:text-[#fefbe9] hover:bg-[#fefbe9]/10 transition-all">
                <ArrowLeft size={16} />
              </button>
              <div className="flex-1 min-w-0 ml-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${onlineUsers.has(activeConvo.donorOrgId) ? 'bg-green-400' : 'bg-gray-400'}`} />
                  <span className="text-sm font-medium text-[#fefbe9] truncate">{activeConvo.donorOrgName}</span>
                </div>
                <p className="text-[10px] text-[#fefbe9]/50">
                  {onlineUsers.has(activeConvo.donorOrgId) ? 'Online' : 'Offline'}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <MessageCircle size={16} className="text-[#f6c453]" />
                <span className="text-sm font-semibold text-[#fefbe9]">Messages</span>
              </div>
            </>
          )}
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#fefbe9]/70 hover:text-[#fefbe9] hover:bg-[#fefbe9]/10 transition-all">
            <X size={16} />
          </button>
        </div>

        {activeConvo ? (
          /* ── Message Thread ──────────────────────────────── */
          <>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {msgLoading ? (
                <div className="flex items-center justify-center py-10 text-sm text-[#183a1d]/40">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-sm text-[#183a1d]/40">No messages yet. Say hello!</div>
              ) : (
                messages.map(msg => {
                  const isOwn = msg.senderType === 'NGO'
                  return (
                    <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${
                        isOwn
                          ? 'bg-[#f6c453] text-[#183a1d] rounded-br-md'
                          : 'bg-[#e1eedd] text-[#183a1d] rounded-bl-md'
                      }`}>
                        {!isOwn && (
                          <p className="text-[10px] font-medium text-[#183a1d]/50 mb-0.5">{msg.senderName}</p>
                        )}
                        {msg.fileUrl ? (
                          <div>
                            <p className="text-sm">{msg.content}</p>
                            <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer"
                              className="text-xs underline text-[#183a1d]/70 hover:text-[#183a1d] mt-1 inline-block">
                              {msg.fileName || 'Attachment'}
                            </a>
                          </div>
                        ) : (
                          <p className="text-sm">{msg.content}</p>
                        )}
                        <p className={`text-[10px] mt-1 ${isOwn ? 'text-[#183a1d]/40' : 'text-[#183a1d]/30'}`}>
                          {formatTime(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input bar */}
            <div className="border-t border-[#c8d6c0] px-3 py-2.5 flex items-center gap-2 shrink-0 bg-[#e1eedd]">
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileAttach} />
              <button onClick={() => fileInputRef.current?.click()}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#183a1d]/50 hover:text-[#183a1d] hover:bg-[#c8d6c0] transition-all">
                <Paperclip size={16} />
              </button>
              <input
                value={msgText}
                onChange={e => setMsgText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                placeholder="Type a message..."
                className="flex-1 bg-[#fefbe9] border border-[#c8d6c0] rounded-lg px-3 py-2 text-sm text-[#183a1d] placeholder-[#183a1d]/40 outline-none focus:border-[#f6c453] transition-all"
              />
              <button onClick={handleCall}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#183a1d]/50 hover:text-green-600 hover:bg-green-100 transition-all">
                <Phone size={16} />
              </button>
              <button onClick={handleSend} disabled={!msgText.trim()}
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#f6c453] text-[#183a1d] hover:bg-[#f0a04b] disabled:opacity-30 transition-all">
                <Send size={14} />
              </button>
            </div>
          </>
        ) : (
          /* ── Conversation List ───────────────────────────── */
          <>
            {/* Search + Sort */}
            <div className="px-3 py-2 border-b border-[#c8d6c0] space-y-2">
              <div className="flex items-center gap-2 bg-[#e1eedd] border border-[#c8d6c0] rounded-lg px-3 py-1.5">
                <Search size={14} className="text-[#183a1d]/40 shrink-0" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search conversations..."
                  className="bg-transparent text-sm text-[#183a1d] placeholder-[#183a1d]/40 outline-none w-full"
                />
              </div>
              <div className="relative">
                <button onClick={() => setShowSort(!showSort)}
                  className="flex items-center gap-1 text-xs text-[#183a1d]/50 hover:text-[#183a1d] transition-all">
                  Sort: {sortLabels[sortBy]}
                  <ChevronDown size={12} />
                </button>
                {showSort && (
                  <div className="absolute top-6 left-0 bg-[#fefbe9] border border-[#c8d6c0] rounded-lg shadow-lg py-1 z-10 min-w-[140px]">
                    {(Object.keys(sortLabels) as SortOption[]).map(opt => (
                      <button key={opt} onClick={() => { setSortBy(opt); setShowSort(false) }}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[#e1eedd] transition-all ${sortBy === opt ? 'text-[#183a1d] font-medium' : 'text-[#183a1d]/60'}`}>
                        {sortLabels[opt]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-10 text-sm text-[#183a1d]/40">Loading...</div>
              ) : sortedConversations.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-sm text-[#183a1d]/40">
                  {searchQuery ? 'No conversations match your search' : 'No conversations yet'}
                </div>
              ) : (
                sortedConversations.map(convo => (
                  <button
                    key={convo.id}
                    onClick={() => setActiveConvo(convo)}
                    className="w-full text-left px-4 py-3 border-b border-[#c8d6c0]/50 hover:bg-[#e1eedd] transition-colors flex items-center gap-3"
                  >
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full bg-[#183a1d] flex items-center justify-center text-xs font-bold text-[#f6c453]">
                        {convo.donorOrgName.charAt(0).toUpperCase()}
                      </div>
                      <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#fefbe9] ${
                        onlineUsers.has(convo.donorOrgId) ? 'bg-green-400' : 'bg-gray-300'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-[#183a1d] truncate">{convo.donorOrgName}</span>
                        {convo.lastMessageAt && (
                          <span className="text-[10px] text-[#183a1d]/40 shrink-0 ml-2">{formatTime(convo.lastMessageAt)}</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-xs text-[#183a1d]/50 truncate">{convo.lastMessage || 'No messages'}</p>
                        {convo.unreadCount > 0 && (
                          <span className="ml-2 shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#f6c453] text-[#183a1d] leading-none">
                            {convo.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes slideInFromRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  )
}

// ── Unread Count Hook ─────────────────────────────────────────
export function useMessengerUnreadCount() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const fetchUnread = () => {
      apiGet('/api/messenger/ngo/unread-count')
        .then(r => r.ok ? r.json() : { count: 0 })
        .then(d => setCount(d.count || d.unreadCount || 0))
        .catch(() => {})
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 30000)
    return () => clearInterval(interval)
  }, [])

  return count
}
