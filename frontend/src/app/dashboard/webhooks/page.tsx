'use client'

import { useState, useEffect } from 'react'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api'
import {
  Webhook, Plus, Trash2, Send, Copy, Check, AlertTriangle,
  X, Eye, EyeOff, CheckCircle, XCircle, Clock, Code,
  Pencil, ToggleLeft, ToggleRight, ChevronDown, ChevronRight
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface WebhookEntry {
  id: string
  url: string
  events: string[]
  active: boolean
  description: string | null
  createdAt: string
}

interface Delivery {
  id: string
  event: string
  payload: Record<string, unknown>
  status: string
  statusCode: number | null
  responseBody: string | null
  attempts: number
  deliveredAt: string | null
  createdAt: string
}

/* ------------------------------------------------------------------ */
/*  Event definitions                                                  */
/* ------------------------------------------------------------------ */

const EVENT_GROUPS = [
  {
    label: 'Documents',
    events: [
      { id: 'document.created', label: 'Document Created' },
      { id: 'document.verified', label: 'Document Verified (Blockchain)' },
      { id: 'document.expiring', label: 'Document Expiring' },
    ],
  },
  {
    label: 'Audit & Blockchain',
    events: [
      { id: 'audit.created', label: 'Audit Log Created' },
      { id: 'anchor.confirmed', label: 'Blockchain Anchor Confirmed' },
      { id: 'anchor.failed', label: 'Blockchain Anchor Failed' },
    ],
  },
  {
    label: 'Funding & Expenses',
    events: [
      { id: 'funding.created', label: 'Funding Agreement Created' },
      { id: 'expense.created', label: 'Expense Created' },
    ],
  },
  {
    label: 'Team',
    events: [
      { id: 'member.invited', label: 'Member Invited' },
    ],
  },
  {
    label: 'System',
    events: [
      { id: 'gdpr.export', label: 'GDPR Data Export' },
      { id: 'gdpr.erasure', label: 'GDPR Erasure' },
      { id: 'webhook.test', label: 'Test Event' },
    ],
  },
]

const ALL_EVENTS = EVENT_GROUPS.flatMap(g => g.events.map(e => e.id))

/* ------------------------------------------------------------------ */
/*  Delivery Log Modal                                                 */
/* ------------------------------------------------------------------ */

function DeliveryLogModal({ webhookId, onClose }: { webhookId: string; onClose: () => void }) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    apiGet(`/api/webhooks/${webhookId}/deliveries?limit=50`)
      .then(r => r.ok ? r.json() : { data: [] })
      .then(d => { setDeliveries(d.data ?? d.items ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [webhookId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0a1929] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <h3 className="text-white font-semibold text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>Delivery Log</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto max-h-[calc(80vh-60px)]">
          {loading ? (
            <div className="p-8 text-center text-white/30 text-sm">Loading deliveries...</div>
          ) : deliveries.length === 0 ? (
            <div className="p-8 text-center text-white/30 text-sm">No delivery attempts yet</div>
          ) : (
            <div className="divide-y divide-white/5">
              {deliveries.map(d => (
                <div key={d.id}>
                  <button
                    onClick={() => setExpanded(expanded === d.id ? null : d.id)}
                    className="w-full grid grid-cols-[1.5fr_1fr_80px_80px_80px] gap-3 items-center px-6 py-3 hover:bg-white/[0.02] transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      {expanded === d.id ? <ChevronDown size={12} className="text-white/20" /> : <ChevronRight size={12} className="text-white/20" />}
                      <span className="text-white/60 text-xs font-medium">{d.event}</span>
                    </div>
                    <span className="text-white/25 text-xs">
                      {new Date(d.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-xs font-mono text-white/40">{d.statusCode || '—'}</span>
                    <div>
                      {d.status === 'success' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
                          <CheckCircle size={10} /> OK
                        </span>
                      ) : d.status === 'failed' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-400/10 text-red-400 border border-red-400/20">
                          <XCircle size={10} /> Failed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-yellow-400/10 text-yellow-400 border border-yellow-400/20">
                          <Clock size={10} /> Pending
                        </span>
                      )}
                    </div>
                    <span className="text-white/20 text-xs">#{d.attempts}</span>
                  </button>
                  {expanded === d.id && (
                    <div className="px-6 pb-4 space-y-2">
                      <div>
                        <p className="text-white/25 text-[10px] uppercase tracking-wider mb-1">Payload</p>
                        <pre className="text-xs text-white/40 bg-white/[0.03] border border-white/5 rounded-lg p-3 overflow-x-auto max-h-48">
                          {JSON.stringify(d.payload, null, 2)}
                        </pre>
                      </div>
                      {d.responseBody && (
                        <div>
                          <p className="text-white/25 text-[10px] uppercase tracking-wider mb-1">Response</p>
                          <pre className="text-xs text-white/30 bg-white/[0.03] border border-white/5 rounded-lg p-3 overflow-x-auto max-h-32">
                            {d.responseBody}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Create / Edit Modal                                                */
/* ------------------------------------------------------------------ */

function WebhookFormModal({ webhook, onClose, onSaved }: {
  webhook: WebhookEntry | null  // null = create mode
  onClose: () => void
  onSaved: (secret?: string) => void
}) {
  const isEdit = !!webhook
  const [url, setUrl] = useState(webhook?.url || '')
  const [description, setDescription] = useState(webhook?.description || '')
  const [selectedEvents, setSelectedEvents] = useState<string[]>(webhook?.events || ['document.created', 'document.verified', 'anchor.confirmed'])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleEvent = (id: string) => {
    setSelectedEvents(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id])
  }

  const selectAll = () => setSelectedEvents([...ALL_EVENTS])
  const deselectAll = () => setSelectedEvents([])

  const handleSave = async () => {
    if (!url.trim()) { setError('URL is required'); return }
    if (selectedEvents.length === 0) { setError('Select at least one event'); return }
    try {
      new URL(url.trim())
    } catch {
      setError('Invalid URL format'); return
    }

    setSaving(true)
    setError(null)
    try {
      const body = { url: url.trim(), events: selectedEvents, description: description.trim() || null }
      const res = isEdit
        ? await apiPut(`/api/webhooks/${webhook.id}`, body)
        : await apiPost('/api/webhooks', body)
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed')
      }
      const data = await res.json()
      onSaved(isEdit ? undefined : data.secret)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0a1929] border border-white/10 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <h3 className="text-white font-semibold text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>
            {isEdit ? 'Edit Webhook' : 'Add Webhook'}
          </h3>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {error && (
            <div className="px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{error}</div>
          )}

          {/* URL */}
          <div>
            <label className="text-white/40 text-xs font-medium uppercase tracking-wider mb-1.5 block">Endpoint URL</label>
            <input
              value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://your-server.com/webhook"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white/70 placeholder-white/20 outline-none focus:border-[#0c7aed]/40 transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-white/40 text-xs font-medium uppercase tracking-wider mb-1.5 block">Description (optional)</label>
            <input
              value={description} onChange={e => setDescription(e.target.value)}
              placeholder="e.g., Slack notifications, Zapier integration"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white/70 placeholder-white/20 outline-none focus:border-[#0c7aed]/40 transition-colors"
            />
          </div>

          {/* Events */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-white/40 text-xs font-medium uppercase tracking-wider">Events</label>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-[10px] text-[#369bff] hover:underline">Select All</button>
                <button onClick={deselectAll} className="text-[10px] text-white/30 hover:underline">Deselect All</button>
              </div>
            </div>
            <div className="space-y-3">
              {EVENT_GROUPS.map(group => (
                <div key={group.label}>
                  <p className="text-white/20 text-[10px] uppercase tracking-widest font-medium mb-1.5">{group.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.events.map(ev => (
                      <button key={ev.id} onClick={() => toggleEvent(ev.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                          selectedEvents.includes(ev.id)
                            ? 'bg-[#0c7aed]/20 text-[#369bff] border-[#0c7aed]/30'
                            : 'text-white/30 border-white/8 hover:text-white/50 hover:border-white/15'
                        }`}>
                        {ev.id}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-white/8 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-white/40 hover:text-white/60 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Create Webhook'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modals
  const [formModal, setFormModal] = useState<{ open: boolean; webhook: WebhookEntry | null }>({ open: false, webhook: null })
  const [deliveryModal, setDeliveryModal] = useState<string | null>(null) // webhookId

  // Secret reveal
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Test results
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null)
  const [testing, setTesting] = useState<string | null>(null)

  const load = () => {
    apiGet('/api/webhooks?limit=50')
      .then(r => {
        if (!r.ok) throw new Error(r.status === 403 ? 'Requires webhooks:read permission' : 'Failed to load')
        return r.json()
      })
      .then(d => { setWebhooks(d.data ?? d.items ?? []); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }

  useEffect(load, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this webhook? This cannot be undone.')) return
    await apiDelete(`/api/webhooks/${id}`)
    load()
  }

  const handleToggle = async (wh: WebhookEntry) => {
    await apiPut(`/api/webhooks/${wh.id}`, { active: !wh.active })
    load()
  }

  const handleTest = async (id: string) => {
    setTesting(id)
    setTestResult(null)
    try {
      const res = await apiPost(`/api/webhooks/${id}/test`, {})
      if (res.ok) {
        setTestResult({ id, success: true, message: 'Test event dispatched successfully' })
      } else {
        const d = await res.json()
        setTestResult({ id, success: false, message: d.error || 'Test failed' })
      }
    } catch {
      setTestResult({ id, success: false, message: 'Request failed' })
    } finally {
      setTesting(null)
    }
  }

  const handleFormSaved = (secret?: string) => {
    setFormModal({ open: false, webhook: null })
    if (secret) setRevealedSecret(secret)
    load()
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

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Webhooks</h1>
          <p className="text-white/40 text-sm mt-1">Receive real-time notifications via HMAC-signed HTTP callbacks</p>
        </div>
        <button onClick={() => setFormModal({ open: true, webhook: null })}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
          <Plus size={16} /> Add Webhook
        </button>
      </div>

      {/* Secret banner */}
      {revealedSecret && (
        <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 px-5 py-4 space-y-2">
          <div className="flex items-center gap-2 text-yellow-400 text-sm font-medium">
            <AlertTriangle size={14} />
            Signing secret — copy now, it will not be shown again
          </div>
          <div className="flex items-center gap-2">
            <code className="text-xs text-white/70 bg-white/5 px-3 py-2 rounded-lg flex-1 overflow-x-auto font-mono">{revealedSecret}</code>
            <button onClick={copySecret} className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-white/50" />}
            </button>
          </div>
          <button onClick={() => setRevealedSecret(null)} className="text-xs text-white/30 hover:text-white/50">Dismiss</button>
        </div>
      )}

      {/* Webhooks list */}
      {webhooks.length === 0 ? (
        <div className="rounded-xl border border-white/8 px-5 py-16 text-center" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <Webhook size={36} className="text-white/10 mx-auto mb-3" />
          <p className="text-white/30 text-sm font-medium">No webhooks configured</p>
          <p className="text-white/15 text-xs mt-1 mb-4">Add your first webhook to start receiving real-time event notifications</p>
          <button onClick={() => setFormModal({ open: true, webhook: null })}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
            <Plus size={14} /> Add Webhook
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map(wh => (
            <div key={wh.id} className="rounded-xl border border-white/8 p-5" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-white/80 truncate">{wh.url}</span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      wh.active ? 'bg-emerald-400/10 text-emerald-400' : 'bg-white/5 text-white/30'
                    }`}>
                      {wh.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {wh.description && <p className="text-white/25 text-xs">{wh.description}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => handleToggle(wh)} title={wh.active ? 'Deactivate' : 'Activate'}
                    className="p-1.5 rounded-md text-white/20 hover:text-white/50 hover:bg-white/5 transition-colors">
                    {wh.active ? <ToggleRight size={16} className="text-emerald-400" /> : <ToggleLeft size={16} />}
                  </button>
                  <button onClick={() => handleTest(wh.id)} disabled={testing === wh.id} title="Send test event"
                    className="p-1.5 rounded-md text-white/20 hover:text-[#369bff] hover:bg-[#0c7aed]/10 transition-colors disabled:opacity-30">
                    <Send size={14} />
                  </button>
                  <button onClick={() => setDeliveryModal(wh.id)} title="View delivery log"
                    className="p-1.5 rounded-md text-white/20 hover:text-white/50 hover:bg-white/5 transition-colors">
                    <Eye size={14} />
                  </button>
                  <button onClick={() => setFormModal({ open: true, webhook: wh })} title="Edit"
                    className="p-1.5 rounded-md text-white/20 hover:text-white/50 hover:bg-white/5 transition-colors">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(wh.id)} title="Delete"
                    className="p-1.5 rounded-md text-white/20 hover:text-red-400 hover:bg-red-400/5 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Events */}
              <div className="flex flex-wrap gap-1.5">
                {wh.events.map(ev => (
                  <span key={ev} className="px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-white/35 border border-white/8 font-medium">{ev}</span>
                ))}
              </div>

              {/* Test result */}
              {testResult?.id === wh.id && (
                <div className={`mt-3 px-3 py-2 rounded-lg text-xs flex items-center gap-2 ${
                  testResult.success ? 'bg-emerald-400/10 text-emerald-400' : 'bg-red-400/10 text-red-400'
                }`}>
                  {testResult.success ? <CheckCircle size={12} /> : <XCircle size={12} />}
                  {testResult.message}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Verification guide */}
      <div className="rounded-xl border border-white/8 p-5" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Code size={16} className="text-white/30" />
          <h3 className="text-white/60 text-sm font-semibold" style={{ fontFamily: 'Syne, sans-serif' }}>How to verify webhooks</h3>
        </div>
        <p className="text-white/30 text-xs mb-3 leading-relaxed">
          Each delivery includes a <code className="text-white/50 bg-white/5 px-1 rounded">Tulip-Signature</code> header
          in the format <code className="text-white/50 bg-white/5 px-1 rounded">t=TIMESTAMP,v1=SIGNATURE</code>.
          Verify it like this:
        </p>
        <pre className="text-xs text-[#369bff]/80 bg-[#0c1a2e] border border-white/5 rounded-lg p-4 overflow-x-auto leading-relaxed">
{`const crypto = require('crypto')

// Parse the Tulip-Signature header
const header = req.headers['tulip-signature']
const [tPart, vPart] = header.split(',')
const timestamp = tPart.replace('t=', '')
const signature = vPart.replace('v1=', '')

// Compute expected signature
const body = timestamp + '.' + JSON.stringify(req.body)
const expected = crypto
  .createHmac('sha256', YOUR_WEBHOOK_SECRET)
  .update(body)
  .digest('hex')

if (expected === signature) {
  // Payload is authentic
}`}
        </pre>
      </div>

      {/* Modals */}
      {formModal.open && (
        <WebhookFormModal
          webhook={formModal.webhook}
          onClose={() => setFormModal({ open: false, webhook: null })}
          onSaved={handleFormSaved}
        />
      )}
      {deliveryModal && (
        <DeliveryLogModal webhookId={deliveryModal} onClose={() => setDeliveryModal(null)} />
      )}
    </div>
  )
}
