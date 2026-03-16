'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import {
  X, Send, Paperclip, Phone, PhoneOff, ArrowLeft,
  MessageCircle, Search
} from 'lucide-react'
import { io, Socket } from 'socket.io-client'

// ── Types ──────────────────────────────────────────────────────

interface Contact {
  id: string
  name: string
  conversationId?: string
  lastMessage?: string | null
  lastMessageAt?: string | null
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
  openToConversation?: string | null
}

export default function MessengerPanel({ open, onClose, openToConversation }: MessengerPanelProps) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [activeContact, setActiveContact] = useState<Contact | null>(null)
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [msgText, setMsgText] = useState('')
  const [loading, setLoading] = useState(false)
  const [msgLoading, setMsgLoading] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<Map<string, string>>(new Map()) // id -> 'online'|'away'
  const [myStatus, setMyStatus] = useState<'online' | 'away' | 'offline'>('online')
  const [showStatusMenu, setShowStatusMenu] = useState(false)
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
      setContacts(prev => {
        const arr = Array.isArray(prev) ? prev : []
        return arr.map(c =>
          c.conversationId === msg.conversationId
            ? { ...c, lastMessage: msg.content, lastMessageAt: msg.createdAt, unreadCount: c.unreadCount + (msg.senderType !== 'NGO' ? 1 : 0) }
            : c
        )
      })
      setActiveConvoId(currentId => {
        if (currentId && currentId === msg.conversationId) {
          setMessages(prev => {
            const arr = Array.isArray(prev) ? prev : []
            if (arr.some(m => m.id === msg.id)) return arr
            return [...arr, msg]
          })
          if (msg.senderType !== 'NGO') {
            apiPost(`/api/messenger/ngo/conversations/${msg.conversationId}/read`, {}).catch(() => {})
            socket.emit('messages_read', { conversationId: msg.conversationId })
          }
        }
        return currentId
      })
    })

    socket.on('messages_read', ({ conversationId }: { conversationId: string }) => {
      setContacts(prev => {
        const arr = Array.isArray(prev) ? prev : []
        return arr.map(c =>
          c.conversationId === conversationId ? { ...c, unreadCount: 0 } : c
        )
      })
    })

    socket.on('user_online', (data: { userId: string; donorOrgId?: string; status?: string }) => {
      // NGO contacts are donor orgs — track by donorOrgId
      if (data.donorOrgId) setOnlineUsers(prev => { const m = new Map(prev); m.set(data.donorOrgId!, data.status || 'online'); return m })
    })

    socket.on('user_offline', (data: { userId: string; donorOrgId?: string }) => {
      if (data.donorOrgId) setOnlineUsers(prev => { const m = new Map(prev); m.delete(data.donorOrgId!); return m })
    })

    socket.on('call_incoming', (call: IncomingCall) => {
      setIncomingCall(call)
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [open, currentUserId, currentUserName, currentTenantId])

  // ── Fetch contacts + conversations and merge ──────────────
  const fetchContacts = useCallback(async () => {
    setLoading(true)
    try {
      const [contactsRes, convosRes] = await Promise.all([
        apiGet('/api/messenger/ngo/contacts'),
        apiGet('/api/messenger/ngo/conversations'),
      ])

      const contactList: { id: string; name: string }[] = []
      if (contactsRes.ok) {
        const d = await contactsRes.json()
        const arr = Array.isArray(d.contacts) ? d.contacts : Array.isArray(d) ? d : []
        contactList.push(...arr)
      }

      const convoMap = new Map<string, any>()
      if (convosRes.ok) {
        const d = await convosRes.json()
        const arr = Array.isArray(d.conversations) ? d.conversations : Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : []
        for (const c of arr) {
          convoMap.set(c.donorOrgId, c)
        }
      }

      // Merge: all contacts + any conversations for orgs not in contacts
      const merged: Contact[] = []
      const seen = new Set<string>()

      for (const ct of contactList) {
        seen.add(ct.id)
        const convo = convoMap.get(ct.id)
        merged.push({
          id: ct.id,
          name: ct.name,
          conversationId: convo?.id || undefined,
          lastMessage: convo?.lastMessage || null,
          lastMessageAt: convo?.lastMessageAt || null,
          unreadCount: convo?.unreadCount || 0,
        })
      }

      // Add conversations for orgs not in contacts list
      for (const [orgId, convo] of convoMap) {
        if (!seen.has(orgId)) {
          merged.push({
            id: orgId,
            name: convo.donorOrgName || 'Unknown',
            conversationId: convo.id,
            lastMessage: convo.lastMessage || null,
            lastMessageAt: convo.lastMessageAt || null,
            unreadCount: convo.unreadCount || 0,
          })
        }
      }

      setContacts(merged)
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  // ── Fetch online users ──────────────────────────────────────
  const fetchOnlineUsers = useCallback(async () => {
    try {
      const res = await apiGet('/api/messenger/ngo/online-users')
      if (res.ok) {
        const data = await res.json()
        const raw = Array.isArray(data.onlineUsers) ? data.onlineUsers : Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : []
        // NGO contacts are donor orgs — use donorOrgId for matching
        const m = new Map<string, string>()
        raw.filter((u: any) => u.donorOrgId).forEach((u: any) => m.set(u.donorOrgId, u.status || 'online'))
        setOnlineUsers(m)
      }
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    if (!open) return
    fetchContacts()
    fetchOnlineUsers()
  }, [open, fetchContacts, fetchOnlineUsers])

  // ── Open to specific conversation ──────────────────────────
  useEffect(() => {
    if (open && openToConversation && contacts.length > 0) {
      const contact = contacts.find(c => c.id === openToConversation)
      if (contact) openChat(contact)
    }
  }, [open, openToConversation, contacts])

  // ── Open chat with a contact ──────────────────────────────
  const openChat = async (contact: Contact) => {
    setActiveContact(contact)
    setMessages([])
    setMsgLoading(true)

    let convoId = contact.conversationId
    if (!convoId) {
      // Ensure conversation exists
      try {
        const res = await apiPost('/api/messenger/ngo/conversations/ensure', { donorOrgId: contact.id })
        if (res.ok) {
          const data = await res.json()
          convoId = data.conversation?.id
          // Update contact with conversation ID
          setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, conversationId: convoId } : c))
        }
      } catch { /* silent */ }
    }

    if (!convoId) {
      setMsgLoading(false)
      return
    }

    setActiveConvoId(convoId)

    // Join the conversation room for real-time messages
    if (socketRef.current) {
      socketRef.current.emit('join_conversation', { conversationId: convoId })
    }

    try {
      const res = await apiGet(`/api/messenger/ngo/conversations/${convoId}/messages`)
      if (res.ok) {
        const data = await res.json()
        const msgs = Array.isArray(data.messages) ? data.messages : Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : []
        setMessages(msgs)
      }
      // Mark as read
      if (socketRef.current) {
        socketRef.current.emit('mark_read', { conversationId: convoId, userId: currentUserId })
      }
      setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, unreadCount: 0 } : c))
    } catch { /* silent */ }
    setMsgLoading(false)
  }

  // ── Scroll to bottom on new messages ────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Send message ────────────────────────────────────────────
  const handleSend = async () => {
    if (!msgText.trim() || !activeConvoId || !socketRef.current) return
    const text = msgText.trim()
    setMsgText('')
    socketRef.current.emit('send_message', {
      conversationId: activeConvoId,
      senderId: currentUserId,
      senderName: currentUserName,
      senderType: 'NGO',
      content: text,
      type: 'TEXT',
    })
    setContacts(prev => prev.map(c =>
      c.conversationId === activeConvoId ? { ...c, lastMessage: text, lastMessageAt: new Date().toISOString() } : c
    ))
  }

  // ── File attach ─────────────────────────────────────────────
  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeConvoId) return
    const formData = new FormData()
    formData.append('file', file)
    try {
      const token = localStorage.getItem('tulip_token')
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/messenger/ngo/conversations/file`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
      })
      if (res.ok) {
        const d = await res.json()
        socketRef.current?.emit('send_message', {
          conversationId: activeConvoId,
          senderId: currentUserId,
          senderName: currentUserName,
          senderType: 'NGO',
          content: file.name,
          type: 'FILE',
          fileUrl: d.fileUrl,
          fileName: file.name,
          fileSize: file.size,
        })
      }
    } catch { /* silent */ }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Call actions ────────────────────────────────────────────
  const handleCall = async () => {
    if (!activeConvoId || !activeContact || !socketRef.current) return
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      alert('Microphone access is required for calls')
      return
    }
    socketRef.current.emit('call_initiate', { conversationId: activeConvoId, callerName: currentUserName })
    setActiveCall({ callId: activeConvoId, callerName: activeContact.name })
  }

  const handleAcceptCall = async () => {
    if (!incomingCall || !socketRef.current) return
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      alert('Microphone access is required for calls')
      return
    }
    socketRef.current.emit('call_accept', { sessionId: incomingCall.callId, conversationId: incomingCall.callId })
    setActiveCall({ callId: incomingCall.callId, callerName: incomingCall.callerName })
    setIncomingCall(null)
  }

  const handleDeclineCall = () => {
    if (!incomingCall || !socketRef.current) return
    socketRef.current.emit('call_decline', { sessionId: incomingCall.callId })
    setIncomingCall(null)
  }

  const handleEndCall = () => {
    if (!activeCall || !socketRef.current) return
    socketRef.current.emit('call_end', { callId: activeCall.callId })
    setActiveCall(null)
  }

  // ── Status helpers ─────────────────────────────────────────
  const getContactStatus = (id: string): 'online' | 'away' | 'offline' => {
    const s = onlineUsers.get(id)
    if (!s) return 'offline'
    return s as 'online' | 'away' | 'offline'
  }
  const statusColor = (s: string) => s === 'online' ? 'bg-green-400' : s === 'away' ? 'bg-yellow-400' : 'bg-gray-400'
  const statusLabel = (s: string) => s === 'online' ? 'Online' : s === 'away' ? 'Away' : 'Offline'

  const handleSetMyStatus = (status: 'online' | 'away' | 'offline') => {
    setMyStatus(status)
    setShowStatusMenu(false)
    if (socketRef.current) socketRef.current.emit('set_status', { status })
  }

  // ── Filter + sort contacts ─────────────────────────────────
  const safeContacts = Array.isArray(contacts) ? contacts : []
  const filteredContacts = [...safeContacts]
    .filter(c => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      // Online first, then by last message, then alphabetical
      const aOnline = onlineUsers.has(a.id) ? 1 : 0
      const bOnline = onlineUsers.has(b.id) ? 1 : 0
      if (bOnline !== aOnline) return bOnline - aOnline
      if (a.lastMessageAt && b.lastMessageAt) return (b.lastMessageAt || '').localeCompare(a.lastMessageAt || '')
      if (a.lastMessageAt) return -1
      if (b.lastMessageAt) return 1
      return a.name.localeCompare(b.name)
    })

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
          {activeContact ? (
            <>
              <button onClick={() => { if (activeConvoId && socketRef.current) socketRef.current.emit('leave_conversation', { conversationId: activeConvoId }); setActiveContact(null); setActiveConvoId(null); setMessages([]) }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#fefbe9]/70 hover:text-[#fefbe9] hover:bg-[#fefbe9]/10 transition-all">
                <ArrowLeft size={16} />
              </button>
              <div className="flex-1 min-w-0 ml-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${statusColor(getContactStatus(activeContact.id))}`} />
                  <span className="text-sm font-medium text-[#fefbe9] truncate">{activeContact.name}</span>
                </div>
                <p className="text-[10px] text-[#fefbe9]/50">
                  {statusLabel(getContactStatus(activeContact.id))}
                </p>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <MessageCircle size={16} className="text-[#f6c453]" />
              <span className="text-sm font-semibold text-[#fefbe9]">Messages</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            {/* Status selector */}
            <div className="relative">
              <button onClick={() => setShowStatusMenu(!showStatusMenu)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#fefbe9]/70 hover:text-[#fefbe9] hover:bg-[#fefbe9]/10 transition-all">
                <div className={`w-3 h-3 rounded-full border-2 border-[#fefbe9]/30 ${statusColor(myStatus)}`} />
              </button>
              {showStatusMenu && (
                <div className="absolute right-0 top-9 bg-[#183a1d] border border-[#c8d6c0]/30 rounded-lg shadow-xl z-50 py-1 min-w-[130px]">
                  {(['online', 'away', 'offline'] as const).map(s => (
                    <button key={s} onClick={() => handleSetMyStatus(s)}
                      className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 hover:bg-[#fefbe9]/10 transition-colors ${myStatus === s ? 'text-[#f6c453]' : 'text-[#fefbe9]/80'}`}>
                      <div className={`w-2.5 h-2.5 rounded-full ${statusColor(s)}`} />
                      {s === 'online' ? 'Online' : s === 'away' ? 'Away' : 'Appear Offline'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#fefbe9]/70 hover:text-[#fefbe9] hover:bg-[#fefbe9]/10 transition-all">
              <X size={16} />
            </button>
          </div>
        </div>

        {activeContact ? (
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
          /* ── Contact List ─────────────────────────────────── */
          <>
            <div className="px-3 py-2 border-b border-[#c8d6c0]">
              <div className="flex items-center gap-2 bg-[#e1eedd] border border-[#c8d6c0] rounded-lg px-3 py-1.5">
                <Search size={14} className="text-[#183a1d]/40 shrink-0" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search contacts..."
                  className="bg-transparent text-sm text-[#183a1d] placeholder-[#183a1d]/40 outline-none w-full"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-10 text-sm text-[#183a1d]/40">Loading...</div>
              ) : filteredContacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                  <MessageCircle size={32} className="text-[#183a1d]/20 mb-3" />
                  <p className="text-sm text-[#183a1d]/40">
                    {searchQuery ? 'No contacts match your search' : 'No connected donors yet'}
                  </p>
                  {!searchQuery && (
                    <p className="text-xs text-[#183a1d]/30 mt-1">Invite donors via Settings to start messaging</p>
                  )}
                </div>
              ) : (
                filteredContacts.map(contact => (
                  <button
                    key={contact.id}
                    onClick={() => openChat(contact)}
                    className="w-full text-left px-4 py-3 border-b border-[#c8d6c0]/50 hover:bg-[#e1eedd] transition-colors flex items-center gap-3"
                  >
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full bg-[#183a1d] flex items-center justify-center text-xs font-bold text-[#f6c453]">
                        {contact.name.charAt(0).toUpperCase()}
                      </div>
                      <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#fefbe9] ${statusColor(getContactStatus(contact.id))}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-[#183a1d] truncate">{contact.name}</span>
                        {contact.lastMessageAt && (
                          <span className="text-[10px] text-[#183a1d]/40 shrink-0 ml-2">{formatTime(contact.lastMessageAt)}</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-xs text-[#183a1d]/50 truncate">
                          {contact.lastMessage || statusLabel(getContactStatus(contact.id))}
                        </p>
                        {contact.unreadCount > 0 && (
                          <span className="ml-2 shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#f6c453] text-[#183a1d] leading-none">
                            {contact.unreadCount}
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
