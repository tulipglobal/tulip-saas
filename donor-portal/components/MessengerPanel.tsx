'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { apiGet, apiPost } from '@/lib/api'
import { getToken, getUser } from '@/lib/auth'
import CallOverlay from './CallOverlay'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

// ── Types ────────────────────────────────────────────────────
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
  type?: 'TEXT' | 'FILE' | 'CALL'
  fileUrl?: string | null
  fileName?: string | null
  fileSize?: number
  callDuration?: number
  callStatus?: string
  read?: boolean
  readAt?: string | null
  createdAt: string
}

// ── Helpers ──────────────────────────────────────────────────
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

function fmtFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

// ── Component ────────────────────────────────────────────────
export default function MessengerPanel({ onClose, onUnreadChange }: { onClose: () => void; onUnreadChange?: (count: number) => void }) {
  const panelRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const socketRef = useRef<Socket | null>(null)

  const [contacts, setContacts] = useState<Contact[]>([])
  const [activeContact, setActiveContact] = useState<Contact | null>(null)
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [messageText, setMessageText] = useState('')
  const [loading, setLoading] = useState(true)
  const [msgLoading, setMsgLoading] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<Map<string, string>>(new Map()) // id -> 'online'|'away'
  const [myStatus, setMyStatus] = useState<'online' | 'away' | 'offline'>('online')
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Call state
  const [incomingCall, setIncomingCall] = useState<{ callerId: string; callerName: string } | null>(null)
  const [activeCall, setActiveCall] = useState<{ peerName: string } | null>(null)
  const [callStream, setCallStream] = useState<MediaStream | null>(null)

  // Read user from localStorage in useEffect to avoid hydration mismatch
  const [userId, setUserId] = useState('')
  const [userName, setUserName] = useState('')
  const [donorOrgId, setDonorOrgId] = useState('')

  useEffect(() => {
    const user = getUser()
    setUserId(user?.id || user?.userId || '')
    setUserName(user?.name || user?.email || '')
    setDonorOrgId(user?.donorOrgId || user?.orgId || '')
  }, [])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  // Connect Socket.IO
  useEffect(() => {
    if (!userId) return

    let socket: Socket
    try {
      socket = io(API_URL, { withCredentials: true, transports: ['websocket', 'polling'] })
      socketRef.current = socket
    } catch (err) {
      console.warn('Socket.IO initialization failed:', err)
      return
    }

    socket.on('connect', () => {
      socket.emit('authenticate', { userId, userType: 'DONOR', name: userName, donorOrgId })
    })

    socket.on('connect_error', (err) => {
      console.warn('Socket.IO connection error:', err.message)
    })

    socket.on('new_message', (msg: Message) => {
      // Update contact list
      setContacts(prev => {
        const arr = Array.isArray(prev) ? prev : []
        return arr.map(c =>
          c.conversationId === msg.conversationId
            ? { ...c, lastMessage: msg.content, lastMessageAt: msg.createdAt, unreadCount: msg.senderType !== 'DONOR' ? c.unreadCount + 1 : c.unreadCount }
            : c
        )
      })
      // Add to active thread if viewing that conversation
      setActiveConvoId(currentId => {
        if (currentId && currentId === msg.conversationId) {
          setMessages(prev => {
            const arr = Array.isArray(prev) ? prev : []
            if (arr.some(m => m.id === msg.id)) return arr
            return [...arr, msg]
          })
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

    socket.on('user_online', (data: { userId: string; tenantId?: string; status?: string }) => {
      // Donor contacts are NGO tenants — track by tenantId
      if (data.tenantId) setOnlineUsers(prev => { const m = new Map(prev); m.set(data.tenantId!, data.status || 'online'); return m })
    })

    socket.on('user_offline', (data: { userId: string; tenantId?: string }) => {
      if (data.tenantId) setOnlineUsers(prev => { const m = new Map(prev); m.delete(data.tenantId!); return m })
    })

    // Call events
    socket.on('call_incoming', (data: { callerId: string; callerName: string; conversationId?: string; sessionId?: string }) => {
      setIncomingCall({ callerId: data.callerId, callerName: data.callerName })
    })

    socket.on('call_accepted', () => {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(s => setCallStream(s)).catch(() => {})
    })
    socket.on('call_ended', () => {
      setCallStream(prev => { if (prev) prev.getTracks().forEach(t => t.stop()); return null })
      setActiveCall(null)
      setIncomingCall(null)
    })

    return () => { socket.disconnect(); socketRef.current = null }
  }, [userId, userName, donorOrgId])

  // ── Fetch contacts + conversations and merge ──────────────
  const fetchContacts = useCallback(async () => {
    setLoading(true)
    try {
      const [contactsRes, convosRes] = await Promise.all([
        apiGet('/api/messenger/donor/contacts'),
        apiGet('/api/messenger/donor/conversations'),
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
          convoMap.set(c.tenantId, c)
        }
      }

      // Merge: all contacts + any conversations for tenants not in contacts
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

      // Add conversations for tenants not in contacts list
      for (const [tenantId, convo] of convoMap) {
        if (!seen.has(tenantId)) {
          merged.push({
            id: tenantId,
            name: convo.tenantName || 'Unknown',
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
      const res = await apiGet('/api/messenger/online-users')
      if (res.ok) {
        const data = await res.json()
        const raw = Array.isArray(data.onlineUsers) ? data.onlineUsers : Array.isArray(data) ? data : []
        // Donor contacts are NGO tenants — use tenantId for matching
        const m = new Map<string, string>()
        raw.filter((u: any) => u.tenantId).forEach((u: any) => m.set(u.tenantId, u.status || 'online'))
        setOnlineUsers(m)
      }
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    fetchContacts()
    fetchOnlineUsers()
  }, [fetchContacts, fetchOnlineUsers])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Open chat with a contact ──────────────────────────────
  const openChat = async (contact: Contact) => {
    setActiveContact(contact)
    setMessages([])
    setMsgLoading(true)

    let convoId = contact.conversationId
    if (!convoId) {
      // Ensure conversation exists
      try {
        const res = await apiPost('/api/messenger/donor/conversations/ensure', { tenantId: contact.id })
        if (res.ok) {
          const data = await res.json()
          convoId = data.conversation?.id
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
      const res = await apiGet(`/api/messenger/donor/conversations/${convoId}/messages`)
      if (res.ok) {
        const data = await res.json()
        const msgs = Array.isArray(data.messages) ? data.messages : Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : []
        setMessages(msgs)
      }
      // Mark as read
      socketRef.current?.emit('mark_read', { conversationId: convoId, userId })
      setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, unreadCount: 0 } : c))
    } catch { /* silent */ }
    setMsgLoading(false)
  }

  // ── Send text message ──────────────────────────────────────
  const sendMessage = useCallback(() => {
    if (!messageText.trim() || !activeConvoId) return
    socketRef.current?.emit('send_message', {
      conversationId: activeConvoId,
      senderId: userId,
      senderName: userName,
      senderType: 'DONOR',
      content: messageText.trim(),
      type: 'TEXT',
    })
    setMessageText('')
    setContacts(prev => prev.map(c =>
      c.conversationId === activeConvoId ? { ...c, lastMessage: messageText.trim(), lastMessageAt: new Date().toISOString() } : c
    ))
  }, [messageText, activeConvoId, userId, userName])

  // ── File upload ────────────────────────────────────────────
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeConvoId) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const token = getToken()
      const r = await fetch(`${API_URL}/api/messenger/donor/conversations/file`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      if (r.ok) {
        const d = await r.json()
        socketRef.current?.emit('send_message', {
          conversationId: activeConvoId,
          senderId: userId,
          senderName: userName,
          content: file.name,
          type: 'FILE',
          fileUrl: d.fileUrl,
          fileName: file.name,
          fileSize: file.size,
        })
      }
    } catch { /* silent */ }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [activeConvoId, userId, userName])

  // ── Audio call ─────────────────────────────────────────────
  const startCall = useCallback(async () => {
    if (!activeConvoId || !activeContact) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setCallStream(stream)
    } catch {
      alert('Microphone access is required for calls')
      return
    }
    socketRef.current?.emit('call_initiate', {
      conversationId: activeConvoId,
      callerName: userName,
    })
    setActiveCall({ peerName: activeContact.name })
  }, [activeConvoId, activeContact, userId, userName])

  const acceptCall = useCallback(async () => {
    if (!incomingCall) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setCallStream(stream)
    } catch {
      alert('Microphone access is required for calls')
      return
    }
    socketRef.current?.emit('call_accept', { sessionId: incomingCall.callerId, conversationId: incomingCall.callerId })
    setActiveCall({ peerName: incomingCall.callerName })
    setIncomingCall(null)
  }, [incomingCall])

  const declineCall = useCallback(() => {
    if (!incomingCall) return
    socketRef.current?.emit('call_decline', { sessionId: incomingCall.callerId })
    setIncomingCall(null)
  }, [incomingCall])

  const endCallCleanup = useCallback(() => {
    if (callStream) {
      callStream.getTracks().forEach(t => t.stop())
      setCallStream(null)
    }
    setActiveCall(null)
    setIncomingCall(null)
  }, [callStream])

  const endCall = useCallback(() => {
    socketRef.current?.emit('end_call', {})
    endCallCleanup()
  }, [endCallCleanup])

  // ── Status helpers ─────────────────────────────────────────
  const getContactStatus = (id: string): 'online' | 'away' | 'offline' => {
    const s = onlineUsers.get(id)
    if (!s) return 'offline'
    return s as 'online' | 'away' | 'offline'
  }
  const statusColorHex = (s: string) => s === 'online' ? '#16A34A' : s === 'away' ? '#EAB308' : '#9CA3AF'
  const statusLabel = (s: string) => s === 'online' ? 'Online' : s === 'away' ? 'Away' : 'Offline'

  const handleSetMyStatus = (status: 'online' | 'away' | 'offline') => {
    setMyStatus(status)
    setShowStatusMenu(false)
    if (socketRef.current) socketRef.current.emit('set_status', { status })
  }

  // ── Filter + sort contacts ────────────────────────────────
  const safeContacts = Array.isArray(contacts) ? contacts : []
  const filteredContacts = [...safeContacts]
    .filter(c => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const aOnline = onlineUsers.has(a.id) ? 1 : 0
      const bOnline = onlineUsers.has(b.id) ? 1 : 0
      if (bOnline !== aOnline) return bOnline - aOnline
      if (a.lastMessageAt && b.lastMessageAt) return (b.lastMessageAt || '').localeCompare(a.lastMessageAt || '')
      if (a.lastMessageAt) return -1
      if (b.lastMessageAt) return 1
      return a.name.localeCompare(b.name)
    })

  // ── Group messages by date ────────────────────────────────
  const groupedMessages: { date: string; msgs: Message[] }[] = []
  let currentDateGroup = ''
  const safeMessages = Array.isArray(messages) ? messages : []
  safeMessages.forEach(m => {
    const dt = new Date(m.createdAt)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const msgDay = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate())
    const diffDays = Math.floor((today.getTime() - msgDay.getTime()) / 86400000)
    let ds: string
    if (diffDays === 0) ds = 'Today'
    else if (diffDays === 1) ds = 'Yesterday'
    else ds = dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

    if (ds !== currentDateGroup) {
      currentDateGroup = ds
      groupedMessages.push({ date: ds, msgs: [] })
    }
    groupedMessages[groupedMessages.length - 1].msgs.push(m)
  })

  return (
    <>
      {/* Call overlays */}
      {incomingCall && (
        <CallOverlay
          callerName={incomingCall.callerName}
          isIncoming={true}
          isActive={false}
          onAccept={acceptCall}
          onDecline={declineCall}
          onEnd={endCall}
          stream={null}
        />
      )}
      {activeCall && (
        <CallOverlay
          callerName={activeCall.peerName}
          isIncoming={false}
          isActive={true}
          onAccept={() => {}}
          onDecline={() => {}}
          onEnd={endCall}
          stream={callStream}
        />
      )}

      {/* Panel overlay */}
      <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.3)' }}>
        <div ref={panelRef} className="w-[380px] max-w-full bg-[var(--bg-card)] h-full shadow-2xl animate-slide-in-right flex flex-col">

          {/* Header */}
          {activeContact ? (
            <div className="sticky top-0 border-b px-4 py-3 flex items-center gap-3 z-10 shrink-0" style={{ background: '#3C3489', borderColor: 'var(--donor-border)' }}>
              <button onClick={() => { if (activeConvoId && socketRef.current) socketRef.current.emit('leave_conversation', { conversationId: activeConvoId }); setActiveContact(null); setActiveConvoId(null); setMessages([]) }} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10" style={{ color: 'var(--donor-light)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <div className="relative shrink-0">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'var(--donor-accent)', color: 'var(--donor-light)' }}>
                  {activeContact.name.charAt(0).toUpperCase()}
                </div>
                <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2`} style={{ borderColor: '#3C3489', background: statusColorHex(getContactStatus(activeContact.id)) }} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-bold truncate block" style={{ color: 'var(--donor-light)' }}>{activeContact.name}</span>
                <p className="text-[10px]" style={{ color: getContactStatus(activeContact.id) === 'online' ? '#86EFAC' : getContactStatus(activeContact.id) === 'away' ? '#FDE047' : 'var(--donor-light)', opacity: getContactStatus(activeContact.id) !== 'offline' ? 1 : 0.5 }}>
                  {statusLabel(getContactStatus(activeContact.id))}
                </p>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 text-lg" style={{ color: 'var(--donor-light)' }}>&times;</button>
            </div>
          ) : (
            <div className="sticky top-0 border-b px-5 py-4 flex items-center justify-between z-10 shrink-0" style={{ background: '#3C3489', borderColor: 'var(--donor-border)' }}>
              <div className="flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--donor-light)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <h2 className="text-base font-bold" style={{ color: 'var(--donor-light)' }}>Messages</h2>
              </div>
              <div className="flex items-center gap-1">
                {/* Status selector */}
                <div className="relative">
                  <button onClick={() => setShowStatusMenu(!showStatusMenu)}
                    className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-all">
                    <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: 'rgba(244,243,254,0.3)', background: statusColorHex(myStatus) }} />
                  </button>
                  {showStatusMenu && (
                    <div className="absolute right-0 top-9 border rounded-lg shadow-xl z-50 py-1 min-w-[130px]" style={{ background: '#3C3489', borderColor: 'rgba(244,243,254,0.2)' }}>
                      {(['online', 'away', 'offline'] as const).map(s => (
                        <button key={s} onClick={() => handleSetMyStatus(s)}
                          className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 hover:bg-white/10 transition-colors"
                          style={{ color: myStatus === s ? '#EAB308' : 'rgba(244,243,254,0.8)' }}>
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: statusColorHex(s) }} />
                          {s === 'online' ? 'Online' : s === 'away' ? 'Away' : 'Appear Offline'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 text-lg" style={{ color: 'var(--donor-light)' }}>&times;</button>
              </div>
            </div>
          )}

          {/* Content */}
          {!activeContact ? (
            /* ── Contact List ─────────────────────────────── */
            <>
              {/* Search */}
              <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--donor-border)' }}>
                <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5" style={{ borderColor: 'var(--donor-border)', background: 'var(--donor-light)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--donor-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search NGOs..."
                    className="bg-transparent text-sm outline-none w-full placeholder-[var(--donor-muted)]/60"
                    style={{ color: 'var(--donor-dark)' }}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="p-5 space-y-3">
                    {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-lg animate-skeleton-pulse" style={{ background: 'var(--donor-border)' }} />)}
                  </div>
                ) : filteredContacts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--donor-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <p className="text-sm mt-3" style={{ color: 'var(--donor-muted)' }}>
                      {searchQuery ? 'No NGOs match your search' : 'No connected NGOs yet'}
                    </p>
                    {!searchQuery && (
                      <p className="text-xs mt-1" style={{ color: 'var(--donor-muted)', opacity: 0.6 }}>You'll see NGOs here once they share projects with you</p>
                    )}
                  </div>
                ) : (
                  filteredContacts.map(contact => {
                    const cStatus = getContactStatus(contact.id)
                    return (
                      <button
                        key={contact.id}
                        onClick={() => openChat(contact)}
                        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-[var(--donor-light)] transition-all cursor-pointer border-b"
                        style={{ borderColor: 'var(--donor-border)' }}
                      >
                        <div className="relative shrink-0">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: 'var(--donor-accent)' }}>
                            {contact.name.charAt(0).toUpperCase()}
                          </div>
                          <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white`} style={{ background: statusColorHex(cStatus) }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold truncate" style={{ color: 'var(--donor-dark)' }}>{contact.name}</span>
                            {contact.lastMessageAt && <span className="text-[10px] shrink-0 ml-2" style={{ color: 'var(--donor-muted)' }}>{formatTime(contact.lastMessageAt)}</span>}
                          </div>
                          <div className="flex items-center justify-between mt-0.5">
                            <p className="text-xs truncate" style={{ color: 'var(--donor-muted)' }}>
                              {contact.lastMessage || statusLabel(cStatus)}
                            </p>
                            {contact.unreadCount > 0 && (
                              <span className="ml-2 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold text-white px-1 shrink-0" style={{ background: '#DC2626' }}>
                                {contact.unreadCount > 99 ? '99+' : contact.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </>
          ) : (
            /* ── Message Thread ──────────────────────────── */
            <>
              <div className="flex-1 overflow-y-auto px-4 py-3">
                {msgLoading ? (
                  <div className="flex justify-center py-10">
                    <div className="animate-spin w-6 h-6 border-2 border-[var(--donor-accent)] border-t-transparent rounded-full" />
                  </div>
                ) : safeMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <p className="text-sm" style={{ color: 'var(--donor-muted)' }}>No messages yet. Say hello!</p>
                  </div>
                ) : (
                  groupedMessages.map((group, gi) => (
                    <div key={gi}>
                      {/* Date separator */}
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px" style={{ background: 'var(--donor-border)' }} />
                        <span className="text-[11px] font-medium px-2" style={{ color: 'var(--donor-muted)' }}>{group.date}</span>
                        <div className="flex-1 h-px" style={{ background: 'var(--donor-border)' }} />
                      </div>
                      {group.msgs.map((msg, mi) => {
                        const isOwn = msg.senderType === 'DONOR' || msg.senderId === userId
                        const showName = mi === 0 || group.msgs[mi - 1].senderId !== msg.senderId

                        return (
                          <div key={msg.id} className={`flex mb-1.5 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                              {showName && !isOwn && (
                                <span className="text-[11px] font-medium mb-0.5 px-1" style={{ color: 'var(--donor-muted)' }}>{msg.senderName}</span>
                              )}
                              <div
                                className="rounded-2xl px-3 py-2 text-sm"
                                style={{
                                  background: isOwn ? 'var(--donor-accent)' : 'var(--donor-light)',
                                  color: isOwn ? '#FFFFFF' : 'var(--donor-dark)',
                                  borderBottomRightRadius: isOwn ? 4 : 16,
                                  borderBottomLeftRadius: isOwn ? 16 : 4,
                                }}
                              >
                                {msg.type === 'FILE' || msg.fileUrl ? (
                                  <a href={msg.fileUrl || '#'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:opacity-80">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isOwn ? 'white' : 'var(--donor-accent)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                                    </svg>
                                    <div>
                                      <p className="text-sm font-medium">{msg.fileName || 'File'}</p>
                                      {msg.fileSize && <p className="text-[11px] opacity-70">{fmtFileSize(msg.fileSize)}</p>}
                                    </div>
                                  </a>
                                ) : (
                                  <p>{msg.content}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-1 mt-0.5 px-1">
                                <span className="text-[10px]" style={{ color: 'var(--donor-muted)' }}>{formatTime(msg.createdAt)}</span>
                                {isOwn && (
                                  <span className="text-[10px]" style={{ color: (msg.read || msg.readAt) ? 'var(--donor-accent)' : '#D1D5DB' }}>
                                    {(msg.read || msg.readAt) ? '\u2713\u2713' : '\u2713'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Bottom bar */}
              <div className="shrink-0 border-t px-3 py-2 flex items-center gap-2" style={{ borderColor: 'var(--donor-border)' }}>
                {/* File attach */}
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[var(--donor-light)] transition-all shrink-0"
                  title="Attach file"
                >
                  {uploading ? (
                    <div className="animate-spin w-4 h-4 border-2 border-[var(--donor-accent)] border-t-transparent rounded-full" />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--donor-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                  )}
                </button>

                {/* Text input */}
                <input
                  type="text"
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                  placeholder="Type a message..."
                  className="flex-1 border rounded-full px-4 py-2 text-sm outline-none focus:border-[var(--donor-accent)]"
                  style={{ borderColor: 'var(--donor-border)', color: 'var(--donor-dark)' }}
                />

                {/* Call button */}
                <button
                  onClick={startCall}
                  className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[var(--donor-light)] transition-all shrink-0"
                  title="Audio call"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--donor-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </button>

                {/* Send button */}
                <button
                  onClick={sendMessage}
                  disabled={!messageText.trim()}
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0"
                  style={{ background: messageText.trim() ? 'var(--donor-accent)' : 'var(--donor-border)' }}
                  title="Send"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={messageText.trim() ? 'white' : 'var(--donor-muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

// ── Unread Count Hook ─────────────────────────────────────────
export function useMessengerUnreadCount() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const fetchUnread = () => {
      apiGet('/api/messenger/donor/unread-count')
        .then(r => r.ok ? r.json() : { count: 0 })
        .then(d => setCount(d.count || d.total || 0))
        .catch(() => {})
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 30000)
    return () => clearInterval(interval)
  }, [])

  return count
}
