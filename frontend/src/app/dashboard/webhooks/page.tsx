'use client'

import { useState, useEffect } from 'react'
import { apiGet, apiPost, apiDelete } from '@/lib/api'
import { Webhook, Plus, Trash2, Send, Copy, Check, AlertTriangle } from 'lucide-react'

interface WebhookEntry {
  id: string
  url: string
  events: string[]
  active: boolean
  createdAt: string
}

const AVAILABLE_EVENTS = [
  'audit.created', 'anchor.confirmed', 'anchor.failed',
  'gdpr.export', 'gdpr.erasure', 'webhook.test',
]

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['audit.created', 'anchor.confirmed'])
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)

  const load = () => {
    apiGet('/api/webhooks')
      .then(r => {
        if (!r.ok) throw new Error(r.status === 403 ? 'Requires webhooks:read permission' : 'Failed to load')
        return r.json()
      })
      .then(d => { setWebhooks(d.data ?? d.items ?? []); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }

  useEffect(load, [])

  const handleCreate = async () => {
    if (!newUrl.trim() || selectedEvents.length === 0) return
    setCreating(true)
    try {
      const res = await apiPost('/api/webhooks', { url: newUrl.trim(), events: selectedEvents })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      const data = await res.json()
      setRevealedSecret(data.secret)
      setNewUrl('')
      load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this webhook?')) return
    await apiDelete(`/api/webhooks/${id}`)
    load()
  }

  const handleTest = async (id: string) => {
    setTesting(id)
    await apiPost(`/api/webhooks/${id}/test`, {})
    setTimeout(() => setTesting(null), 2000)
  }

  const toggleEvent = (event: string) => {
    setSelectedEvents(prev =>
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    )
  }

  const copySecret = () => {
    if (revealedSecret) { navigator.clipboard.writeText(revealedSecret); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  }

  if (loading) return (
    <div className="p-6 animate-fade-up">
      <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Webhooks</h1>
      <p className="text-white/30 text-sm mt-4">Loading...</p>
    </div>
  )

  if (error && webhooks.length === 0) return (
    <div className="p-6 animate-fade-up">
      <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Webhooks</h1>
      <div className="mt-6 rounded-xl border border-red-400/20 bg-red-400/5 px-5 py-4">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    </div>
  )

  return (
    <div className="p-6 space-y-6 animate-fade-up">
      <div>
        <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Webhooks</h1>
        <p className="text-white/40 text-sm mt-1">Receive real-time notifications via HMAC-signed HTTP callbacks</p>
      </div>

      {/* Revealed secret banner */}
      {revealedSecret && (
        <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 px-5 py-4 space-y-2">
          <div className="flex items-center gap-2 text-yellow-400 text-sm font-medium">
            <AlertTriangle size={14} />
            Signing secret — copy now, it will not be shown again
          </div>
          <div className="flex items-center gap-2">
            <code className="text-xs text-white/70 bg-white/5 px-3 py-2 rounded-lg flex-1 overflow-x-auto">{revealedSecret}</code>
            <button onClick={copySecret} className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-white/50" />}
            </button>
          </div>
          <button onClick={() => setRevealedSecret(null)} className="text-xs text-white/30 hover:text-white/50">Dismiss</button>
        </div>
      )}

      {/* Create form */}
      <div className="rounded-xl border border-white/8 px-5 py-4 space-y-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="flex items-center gap-3">
          <input
            value={newUrl}
            onChange={e => setNewUrl(e.target.value)}
            placeholder="https://your-server.com/webhook"
            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white/70 placeholder-white/30 outline-none flex-1"
          />
          <button onClick={handleCreate} disabled={creating || !newUrl.trim() || selectedEvents.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-40 shrink-0"
            style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
            <Plus size={16} />
            {creating ? 'Creating...' : 'Add Webhook'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_EVENTS.map(event => (
            <button key={event} onClick={() => toggleEvent(event)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                selectedEvents.includes(event)
                  ? 'bg-[#0c7aed]/20 text-[#369bff] border-[#0c7aed]/30'
                  : 'text-white/30 border-white/10 hover:text-white/50'
              }`}>
              {event}
            </button>
          ))}
        </div>
      </div>

      {/* Webhooks list */}
      <div className="rounded-xl border border-white/8 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="grid grid-cols-[2fr_2fr_1fr_80px] gap-4 px-5 py-3 border-b border-white/8 text-xs text-white/30 uppercase tracking-wide font-medium">
          <span>URL</span><span>Events</span><span>Created</span><span />
        </div>
        {webhooks.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <Webhook size={32} className="text-white/10" />
            <p className="text-white/30 text-sm">No webhooks configured</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {webhooks.map(wh => (
              <div key={wh.id} className="grid grid-cols-[2fr_2fr_1fr_80px] gap-4 items-center px-5 py-3.5 hover:bg-white/2 transition-colors">
                <div>
                  <div className="text-sm font-medium text-white/80 truncate">{wh.url}</div>
                  <div className={`text-xs mt-0.5 ${wh.active ? 'text-green-400/60' : 'text-red-400/60'}`}>
                    {wh.active ? 'Active' : 'Inactive'}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {wh.events.map(ev => (
                    <span key={ev} className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-white/40 border border-white/8">{ev}</span>
                  ))}
                </div>
                <div className="text-xs text-white/30">
                  {new Date(wh.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleTest(wh.id)} title="Send test event"
                    className="p-1.5 rounded-md text-white/20 hover:text-[#369bff] hover:bg-[#0c7aed]/10 transition-colors">
                    <Send size={13} className={testing === wh.id ? 'text-green-400' : ''} />
                  </button>
                  <button onClick={() => handleDelete(wh.id)} title="Delete"
                    className="p-1.5 rounded-md text-white/20 hover:text-red-400 hover:bg-red-400/5 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
