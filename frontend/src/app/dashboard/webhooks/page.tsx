'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api'
import {
  Webhook, Plus, Trash2, Send, Copy, Check, AlertTriangle,
  X, Eye, EyeOff, CheckCircle, XCircle, Clock, Code,
  Pencil, ToggleLeft, ToggleRight, ChevronDown, ChevronRight, RotateCcw
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
    label: 'Seals',
    events: [
      { id: 'seal.issued', label: 'Seal Issued' },
      { id: 'seal.anchored', label: 'Seal Anchored (Blockchain)' },
    ],
  },
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
    label: 'Expenses',
    events: [
      { id: 'expense.created', label: 'Expense Created' },
      { id: 'expense.blocked', label: 'Expense Blocked (Fraud)' },
      { id: 'expense.flagged', label: 'Expense Flagged (Review)' },
      { id: 'expense.approved', label: 'Expense Approved' },
      { id: 'expense.voided', label: 'Expense Voided' },
    ],
  },
  {
    label: 'Funding',
    events: [
      { id: 'funding.created', label: 'Funding Agreement Created' },
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
  const t = useTranslations('webhooksPage')
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [resending, setResending] = useState<string | null>(null)

  const loadDeliveries = () => {
    apiGet(`/api/webhooks/${webhookId}/deliveries?limit=50`)
      .then(r => r.ok ? r.json() : { data: [] })
      .then(d => { setDeliveries(d.data ?? d.items ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { loadDeliveries() }, [webhookId])

  const handleResend = async (deliveryId: string) => {
    setResending(deliveryId)
    try {
      await apiPost(`/api/webhooks/${webhookId}/deliveries/${deliveryId}/resend`, {})
      setTimeout(loadDeliveries, 1500)
    } catch { /* ignore */ }
    setResending(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#e1eedd] border border-[#c8d6c0] rounded-none md:rounded-2xl w-full h-full md:h-auto md:max-w-3xl md:max-h-[80vh] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-[#c8d6c0]">
          <h3 className="text-[#183a1d] font-semibold text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>{t('deliveryLog')}</h3>
          <button onClick={onClose} className="text-[#183a1d]/40 hover:text-[#183a1d]/70 transition-colors"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto max-h-[calc(80vh-60px)]">
          {loading ? (
            <div className="p-8 text-center text-[#183a1d]/40 text-sm">{t('loadingDeliveries')}</div>
          ) : deliveries.length === 0 ? (
            <div className="p-8 text-center text-[#183a1d]/40 text-sm">{t('noDeliveries')}</div>
          ) : (
            <div className="divide-y divide-[#c8d6c0]">
              {deliveries.map(d => (
                <div key={d.id}>
                  <button
                    onClick={() => setExpanded(expanded === d.id ? null : d.id)}
                    className="w-full grid grid-cols-[1fr_80px_80px] md:grid-cols-[1.5fr_1fr_80px_80px_80px] gap-3 items-center px-4 md:px-6 py-3 hover:bg-[#e1eedd] transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      {expanded === d.id ? <ChevronDown size={12} className="text-[#183a1d]/30" /> : <ChevronRight size={12} className="text-[#183a1d]/30" />}
                      <span className="text-[#183a1d]/70 text-xs font-medium">{d.event}</span>
                    </div>
                    <span className="text-[#183a1d]/40 text-xs">
                      {new Date(d.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-xs font-mono text-[#183a1d]/60">{d.statusCode || '—'}</span>
                    <div>
                      {d.status === 'success' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
                          <CheckCircle size={10} /> {t('ok')}
                        </span>
                      ) : d.status === 'failed' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-400/10 text-red-400 border border-red-400/20">
                          <XCircle size={10} /> {t('failed')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-yellow-400/10 text-yellow-400 border border-yellow-400/20">
                          <Clock size={10} /> {t('pending')}
                        </span>
                      )}
                    </div>
                    <span className="text-[#183a1d]/30 text-xs">#{d.attempts}</span>
                  </button>
                  {expanded === d.id && (
                    <div className="px-6 pb-4 space-y-2">
                      <div>
                        <p className="text-[#183a1d]/40 text-[10px] uppercase tracking-wider mb-1">{t('payload')}</p>
                        <pre className="text-xs text-[#183a1d]/60 bg-[#e1eedd] border border-[#c8d6c0] rounded-lg p-3 overflow-x-auto max-h-48">
                          {JSON.stringify(d.payload, null, 2)}
                        </pre>
                      </div>
                      {d.responseBody && (
                        <div>
                          <p className="text-[#183a1d]/40 text-[10px] uppercase tracking-wider mb-1">{t('response')}</p>
                          <pre className="text-xs text-[#183a1d]/40 bg-[#e1eedd] border border-[#c8d6c0] rounded-lg p-3 overflow-x-auto max-h-32">
                            {d.responseBody}
                          </pre>
                        </div>
                      )}
                      {d.status === 'failed' && (
                        <button
                          onClick={() => handleResend(d.id)}
                          disabled={resending === d.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#183a1d] bg-[#f6c453]/20 hover:bg-[#f6c453]/30 border border-[#f6c453]/30 transition-colors disabled:opacity-40"
                        >
                          <RotateCcw size={12} className={resending === d.id ? 'animate-spin' : ''} />
                          {resending === d.id ? t('resending') : t('resend')}
                        </button>
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
  const t = useTranslations('webhooksPage')
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
    if (!url.trim()) { setError(t('urlRequired')); return }
    if (selectedEvents.length === 0) { setError(t('selectOneEvent')); return }
    try {
      new URL(url.trim())
    } catch {
      setError(t('invalidUrl')); return
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#e1eedd] border border-[#c8d6c0] rounded-none md:rounded-2xl w-full h-full md:h-auto md:max-w-lg md:max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-[#c8d6c0]">
          <h3 className="text-[#183a1d] font-semibold text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
            {isEdit ? t('editWebhook') : t('addWebhookModal')}
          </h3>
          <button onClick={onClose} className="text-[#183a1d]/40 hover:text-[#183a1d]/70 transition-colors"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {error && (
            <div className="px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{error}</div>
          )}

          {/* URL */}
          <div>
            <label className="text-[#183a1d]/60 text-xs font-medium uppercase tracking-wider mb-1.5 block">{t('endpointUrl')}</label>
            <input
              value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://your-server.com/webhook"
              className="w-full bg-[#e1eedd] border border-[#c8d6c0] rounded-lg px-4 py-2.5 text-sm text-[#183a1d] placeholder-white/20 outline-none focus:border-[#f6c453] transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-[#183a1d]/60 text-xs font-medium uppercase tracking-wider mb-1.5 block">{t('descriptionOptional')}</label>
            <input
              value={description} onChange={e => setDescription(e.target.value)}
              placeholder="e.g., Slack notifications, Zapier integration"
              className="w-full bg-[#e1eedd] border border-[#c8d6c0] rounded-lg px-4 py-2.5 text-sm text-[#183a1d] placeholder-white/20 outline-none focus:border-[#f6c453] transition-colors"
            />
          </div>

          {/* Events */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[#183a1d]/60 text-xs font-medium uppercase tracking-wider">{t('events')}</label>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-[10px] text-[#183a1d] hover:underline">{t('selectAll')}</button>
                <button onClick={deselectAll} className="text-[10px] text-[#183a1d]/40 hover:underline">{t('deselectAll')}</button>
              </div>
            </div>
            <div className="space-y-3">
              {EVENT_GROUPS.map(group => (
                <div key={group.label}>
                  <p className="text-[#183a1d]/30 text-[10px] uppercase tracking-widest font-medium mb-1.5">{group.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.events.map(ev => (
                      <button key={ev.id} onClick={() => toggleEvent(ev.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                          selectedEvents.includes(ev.id)
                            ? 'bg-[#f6c453]/10 text-[#183a1d] border-[#f6c453]/30'
                            : 'text-[#183a1d]/40 border-[#c8d6c0] hover:text-[#183a1d]/60 hover:border-[#c8d6c0]'
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

        <div className="px-6 py-4 border-t border-[#c8d6c0] flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-[#183a1d]/60 hover:text-[#183a1d]/70 transition-colors">{t('cancel')}</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 rounded-lg text-sm font-medium text-[#183a1d] disabled:opacity-40 bg-[#f6c453] hover:bg-[#f0a04b]">
            {saving ? t('saving') : isEdit ? t('update') : t('createWebhook')}
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
  const t = useTranslations('webhooksPage')
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
        if (!r.ok) throw new Error(r.status === 403 ? t('requiresPermission') : 'Failed to load')
        return r.json()
      })
      .then(d => { setWebhooks(d.data ?? d.items ?? []); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }

  useEffect(load, [])

  const handleDelete = async (id: string) => {
    if (!confirm(t('deleteConfirm'))) return
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
        setTestResult({ id, success: true, message: t('testSuccess') })
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
      <h1 className="text-2xl font-bold text-[#183a1d]" style={{ fontFamily: 'Inter, sans-serif' }}>{t('title')}</h1>
      <p className="text-[#183a1d]/40 text-sm mt-4">{t('loading')}</p>
    </div>
  )

  if (error && webhooks.length === 0) return (
    <div className="p-6 animate-fade-up">
      <h1 className="text-2xl font-bold text-[#183a1d]" style={{ fontFamily: 'Inter, sans-serif' }}>{t('title')}</h1>
      <div className="mt-6 rounded-xl border border-red-400/20 bg-red-400/5 px-5 py-4">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    </div>
  )

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-up">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#183a1d]" style={{ fontFamily: 'Inter, sans-serif' }}>{t('title')}</h1>
          <p className="text-[#183a1d]/60 text-sm mt-1">{t('subtitle')}</p>
        </div>
        <button onClick={() => setFormModal({ open: true, webhook: null })}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[#183a1d] self-start bg-[#f6c453] hover:bg-[#f0a04b]">
          <Plus size={16} /> {t('addWebhook')}
        </button>
      </div>

      {/* Secret banner */}
      {revealedSecret && (
        <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 px-5 py-4 space-y-2">
          <div className="flex items-center gap-2 text-yellow-400 text-sm font-medium">
            <AlertTriangle size={14} />
            {t('signingSecret')}
          </div>
          <div className="flex items-center gap-2">
            <code className="text-xs text-[#183a1d] bg-[#e1eedd] px-3 py-2 rounded-lg flex-1 overflow-x-auto font-mono">{revealedSecret}</code>
            <button onClick={copySecret} className="px-3 py-2 rounded-lg bg-[#e1eedd] hover:bg-[#e1eedd] transition-colors">
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-[#183a1d]/60" />}
            </button>
          </div>
          <button onClick={() => setRevealedSecret(null)} className="text-xs text-[#183a1d]/40 hover:text-[#183a1d]/60">{t('dismiss')}</button>
        </div>
      )}

      {/* Webhooks list */}
      {webhooks.length === 0 ? (
        <div className="rounded-xl border border-[#c8d6c0] px-5 py-16 text-center bg-[#e1eedd]">
          <Webhook size={36} className="text-[#183a1d]/30 mx-auto mb-3" />
          <p className="text-[#183a1d]/40 text-sm font-medium">{t('noWebhooks')}</p>
          <p className="text-[#183a1d]/30 text-xs mt-1 mb-4">{t('noWebhooksDesc')}</p>
          <button onClick={() => setFormModal({ open: true, webhook: null })}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[#183a1d] bg-[#f6c453] hover:bg-[#f0a04b]">
            <Plus size={14} /> {t('addWebhook')}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map(wh => (
            <div key={wh.id} className="rounded-xl border border-[#c8d6c0] p-5 bg-[#e1eedd]">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-[#183a1d] truncate">{wh.url}</span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      wh.active ? 'bg-emerald-400/10 text-emerald-400' : 'bg-[#e1eedd] text-[#183a1d]/40'
                    }`}>
                      {wh.active ? t('active') : t('inactive')}
                    </span>
                  </div>
                  {wh.description && <p className="text-[#183a1d]/40 text-xs">{wh.description}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => handleToggle(wh)} title={wh.active ? 'Deactivate' : 'Activate'}
                    className="p-1.5 rounded-md text-[#183a1d]/30 hover:text-[#183a1d]/60 hover:bg-[#e1eedd]/50 transition-colors">
                    {wh.active ? <ToggleRight size={16} className="text-emerald-400" /> : <ToggleLeft size={16} />}
                  </button>
                  <button onClick={() => handleTest(wh.id)} disabled={testing === wh.id} title="Send test event"
                    className="p-1.5 rounded-md text-[#183a1d]/30 hover:text-[#183a1d] hover:bg-[#f6c453]/10 transition-colors disabled:opacity-30">
                    <Send size={14} />
                  </button>
                  <button onClick={() => setDeliveryModal(wh.id)} title="View delivery log"
                    className="p-1.5 rounded-md text-[#183a1d]/30 hover:text-[#183a1d]/60 hover:bg-[#e1eedd]/50 transition-colors">
                    <Eye size={14} />
                  </button>
                  <button onClick={() => setFormModal({ open: true, webhook: wh })} title="Edit"
                    className="p-1.5 rounded-md text-[#183a1d]/30 hover:text-[#183a1d]/60 hover:bg-[#e1eedd]/50 transition-colors">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(wh.id)} title="Delete"
                    className="p-1.5 rounded-md text-[#183a1d]/30 hover:text-red-400 hover:bg-red-400/5 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Events */}
              <div className="flex flex-wrap gap-1.5">
                {wh.events.map(ev => (
                  <span key={ev} className="px-2 py-0.5 rounded-full text-[10px] bg-[#e1eedd] text-[#183a1d]/40 border border-[#c8d6c0] font-medium">{ev}</span>
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
      <div className="rounded-xl border border-[#c8d6c0] p-5 bg-[#e1eedd]">
        <div className="flex items-center gap-2 mb-3">
          <Code size={16} className="text-[#183a1d]/40" />
          <h3 className="text-[#183a1d]/70 text-sm font-semibold" style={{ fontFamily: 'Inter, sans-serif' }}>{t('howToVerify')}</h3>
        </div>
        <p className="text-[#183a1d]/40 text-xs mb-3 leading-relaxed">
          {t('howToVerifyDesc')}
        </p>
        <pre className="text-xs text-[#183a1d]/80 bg-[#0c1a2e] border border-[#c8d6c0] rounded-lg p-4 overflow-x-auto leading-relaxed">
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
