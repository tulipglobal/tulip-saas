'use client'

import { useState, useEffect } from 'react'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api'
import { Webhook, Plus, Trash2, Send, Copy, Check, X, ToggleLeft, ToggleRight, FileText, RotateCw } from 'lucide-react'

interface WebhookItem {
  id: string
  url: string
  description?: string
  events: string[]
  active: boolean
  secret?: string
  createdAt: string
}

const EVENT_GROUPS: Record<string, string[]> = {
  'Seals': ['seal.issued', 'seal.confirmed', 'seal.revoked'],
  'Documents': ['document.created', 'document.verified'],
  'Audit': ['audit.created'],
  'Expenses': ['expense.created', 'expense.approved'],
  'System': ['system.health'],
}

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [formUrl, setFormUrl] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formEvents, setFormEvents] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState('')
  const [testResult, setTestResult] = useState<Record<string, string>>({})

  const loadWebhooks = async () => {
    try {
      const res = await apiGet('/api/webhooks?limit=50')
      if (res.ok) {
        const d = await res.json()
        setWebhooks(d.webhooks || d.data || d || [])
      }
    } catch {}
    setLoading(false)
  }

  useEffect(() => { loadWebhooks() }, [])

  const openNew = () => {
    setEditId(null); setFormUrl(''); setFormDesc(''); setFormEvents([]); setShowForm(true)
  }

  const openEdit = (w: WebhookItem) => {
    setEditId(w.id); setFormUrl(w.url); setFormDesc(w.description || ''); setFormEvents(w.events); setShowForm(true)
  }

  const handleSave = async () => {
    setSaving(true)
    const body = { url: formUrl, description: formDesc, events: formEvents }
    if (editId) {
      await apiPut(`/api/webhooks/${editId}`, body)
    } else {
      await apiPost('/api/webhooks', body)
    }
    setShowForm(false)
    loadWebhooks()
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this webhook?')) return
    await apiDelete(`/api/webhooks/${id}`)
    loadWebhooks()
  }

  const handleTest = async (id: string) => {
    setTestResult(prev => ({ ...prev, [id]: 'sending...' }))
    try {
      const res = await apiPost(`/api/webhooks/${id}/test`, {})
      setTestResult(prev => ({ ...prev, [id]: res.ok ? 'success' : 'failed' }))
    } catch {
      setTestResult(prev => ({ ...prev, [id]: 'error' }))
    }
    setTimeout(() => setTestResult(prev => { const n = { ...prev }; delete n[id]; return n }), 3000)
  }

  const toggleEvent = (event: string) => {
    setFormEvents(prev => prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event])
  }

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(''), 2000)
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--admin-text)]">Webhooks</h1>
          <p className="text-sm text-[var(--admin-text-secondary)] mt-1">{webhooks.length} webhook endpoints</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--admin-accent)] hover:bg-[var(--admin-accent-hover)] transition-colors">
          <Plus size={16} /> Add Webhook
        </button>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="p-8 text-center text-sm text-[var(--admin-text-muted)]">Loading...</div>
        ) : webhooks.length === 0 ? (
          <div className="bg-[var(--admin-card)] rounded-xl border border-[var(--admin-border)] flex flex-col items-center py-16 gap-3">
            <Webhook size={24} className="text-[var(--admin-text-muted)]" />
            <p className="text-sm text-[var(--admin-text-muted)]">No webhooks configured</p>
          </div>
        ) : (
          webhooks.map(w => (
            <div key={w.id} className="bg-[var(--admin-card)] rounded-xl border border-[var(--admin-border)] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <code className="text-sm font-mono text-[var(--admin-text)]">{w.url}</code>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border font-medium ${w.active ? 'bg-green-50 text-green-600 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                    {w.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleTest(w.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--admin-accent)] border border-[var(--admin-accent)]/30 hover:bg-[var(--admin-accent)]/5 transition-colors">
                    <Send size={12} className="inline mr-1" /> Test
                  </button>
                  <button onClick={() => openEdit(w)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] hover:bg-[var(--admin-bg)] transition-colors">Edit</button>
                  <button onClick={() => handleDelete(w.id)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-red-50 transition-colors">
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                </div>
              </div>
              {w.description && <p className="text-xs text-[var(--admin-text-muted)]">{w.description}</p>}
              <div className="flex flex-wrap gap-1.5">
                {w.events.map(e => (
                  <span key={e} className="px-2 py-0.5 rounded-full text-[10px] bg-[var(--admin-bg)] text-[var(--admin-text-secondary)] border border-[var(--admin-border)]">{e}</span>
                ))}
              </div>
              {testResult[w.id] && (
                <div className={`text-xs font-medium ${testResult[w.id] === 'success' ? 'text-green-600' : testResult[w.id] === 'sending...' ? 'text-blue-600' : 'text-red-600'}`}>
                  Test: {testResult[w.id]}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-[var(--admin-card)] rounded-xl border border-[var(--admin-border)] p-6 max-w-lg w-full shadow-xl space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[var(--admin-text)]">{editId ? 'Edit Webhook' : 'New Webhook'}</h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--admin-bg)]"><X size={16} /></button>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--admin-text-secondary)] mb-1">URL</label>
              <input value={formUrl} onChange={e => setFormUrl(e.target.value)} placeholder="https://..." className="w-full rounded-lg px-3 py-2 text-sm border border-[var(--admin-border)] bg-[var(--admin-bg)]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--admin-text-secondary)] mb-1">Description</label>
              <input value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Optional description" className="w-full rounded-lg px-3 py-2 text-sm border border-[var(--admin-border)] bg-[var(--admin-bg)]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--admin-text-secondary)] mb-2">Events</label>
              {Object.entries(EVENT_GROUPS).map(([group, events]) => (
                <div key={group} className="mb-3">
                  <div className="text-xs font-medium text-[var(--admin-text)] mb-1">{group}</div>
                  <div className="flex flex-wrap gap-2">
                    {events.map(ev => (
                      <button key={ev} onClick={() => toggleEvent(ev)} className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${formEvents.includes(ev) ? 'bg-[var(--admin-accent)]/10 text-[var(--admin-accent)] border-[var(--admin-accent)]/30' : 'text-[var(--admin-text-muted)] border-[var(--admin-border)] hover:border-[var(--admin-accent)]/30'}`}>
                        {ev}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={handleSave} disabled={saving || !formUrl.trim() || formEvents.length === 0} className="w-full py-2.5 rounded-lg text-sm font-medium text-white bg-[var(--admin-accent)] hover:bg-[var(--admin-accent-hover)] disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : editId ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
