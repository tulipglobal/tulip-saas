'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost, apiDelete } from '@/lib/api'
import { Code2, Plus, Trash2, Copy, Check, Key, BarChart3, FileText } from 'lucide-react'

interface ApiKeyItem { id: string; name: string; prefix: string; permissions: string[]; createdAt: string; lastUsedAt: string | null }
interface UsageStats { totalCalls: number; successRate: number; avgResponseTime: number; dailyCalls: { date: string; count: number }[] }

export default function DeveloperApiPage() {
  const [tab, setTab] = useState<'keys' | 'usage' | 'docs'>('keys')
  const [keys, setKeys] = useState<ApiKeyItem[]>([])
  const [usage, setUsage] = useState<UsageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [newKeyName, setNewKeyName] = useState('')
  const [createdKey, setCreatedKey] = useState('')
  const [copied, setCopied] = useState('')

  const loadKeys = useCallback(async () => {
    try {
      const res = await apiGet('/api/developer/keys')
      if (res.ok) { const d = await res.json(); setKeys(d.keys || d.data || d || []) }
    } catch {}
    setLoading(false)
  }, [])

  const loadUsage = useCallback(async () => {
    try {
      const res = await apiGet('/api/developer/usage')
      if (res.ok) setUsage(await res.json())
    } catch {}
  }, [])

  useEffect(() => { loadKeys(); loadUsage() }, [loadKeys, loadUsage])

  const createKey = async () => {
    if (!newKeyName.trim()) return
    const res = await apiPost('/api/developer/keys', { name: newKeyName, permissions: ['ocr:process', 'bundle:process', 'verify:read'] })
    if (res.ok) {
      const d = await res.json()
      setCreatedKey(d.key || d.rawKey || '')
      setNewKeyName('')
      loadKeys()
    }
  }

  const revokeKey = async (id: string) => {
    if (!confirm('Revoke this key?')) return
    await apiDelete(`/api/developer/keys/${id}`)
    loadKeys()
  }

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(''), 2000)
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-[var(--admin-text)]">Developer API</h1>
        <p className="text-sm text-[var(--admin-text-secondary)] mt-1">Manage API keys and view usage statistics</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--admin-border)]">
        {[{ k: 'keys', l: 'API Keys', i: Key }, { k: 'usage', l: 'Usage', i: BarChart3 }, { k: 'docs', l: 'Documentation', i: FileText }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as typeof tab)} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.k ? 'border-[var(--admin-accent)] text-[var(--admin-accent)]' : 'border-transparent text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]'}`}>
            <t.i size={15} /> {t.l}
          </button>
        ))}
      </div>

      {tab === 'keys' && (
        <div className="space-y-4">
          {/* Create key */}
          <div className="flex items-center gap-3">
            <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="Key name..." className="flex-1 max-w-xs rounded-lg px-4 py-2 text-sm border border-[var(--admin-border)] bg-[var(--admin-card)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50" />
            <button onClick={createKey} disabled={!newKeyName.trim()} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--admin-accent)] hover:bg-[var(--admin-accent-hover)] disabled:opacity-50 transition-colors">
              <Plus size={16} /> Create Key
            </button>
          </div>

          {/* Created key reveal */}
          {createdKey && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <Key size={16} className="text-green-600 shrink-0" />
              <code className="text-sm text-green-800 font-mono flex-1 break-all">{createdKey}</code>
              <button onClick={() => copyText(createdKey, 'new')} className="shrink-0">
                {copied === 'new' ? <Check size={16} className="text-green-500" /> : <Copy size={16} className="text-green-600" />}
              </button>
            </div>
          )}

          {/* Keys table */}
          <div className="bg-[var(--admin-card)] rounded-xl border border-[var(--admin-border)] overflow-hidden">
            <div className="hidden lg:grid grid-cols-[2fr_1fr_1fr_1fr_80px] gap-4 px-5 py-3 border-b border-[var(--admin-border)] text-xs text-[var(--admin-text-muted)] uppercase tracking-wide font-medium bg-[var(--admin-bg)]">
              <span>Name</span><span>Prefix</span><span>Last Used</span><span>Created</span><span>Actions</span>
            </div>
            {loading ? (
              <div className="p-8 text-center text-sm text-[var(--admin-text-muted)]">Loading...</div>
            ) : keys.length === 0 ? (
              <div className="p-8 text-center text-sm text-[var(--admin-text-muted)]">No API keys yet</div>
            ) : (
              <div className="divide-y divide-[var(--admin-border)]">
                {keys.map(k => (
                  <div key={k.id} className="px-5 py-3 lg:grid lg:grid-cols-[2fr_1fr_1fr_1fr_80px] lg:gap-4 lg:items-center">
                    <div>
                      <div className="text-sm font-medium text-[var(--admin-text)]">{k.name}</div>
                      <div className="text-xs text-[var(--admin-text-muted)]">{k.permissions.length} permissions</div>
                    </div>
                    <div className="text-sm font-mono text-[var(--admin-text-secondary)]">{k.prefix}...</div>
                    <div className="text-xs text-[var(--admin-text-muted)]">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'Never'}</div>
                    <div className="text-xs text-[var(--admin-text-muted)]">{new Date(k.createdAt).toLocaleDateString()}</div>
                    <div>
                      <button onClick={() => revokeKey(k.id)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-red-50 transition-colors">
                        <Trash2 size={14} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'usage' && (
        <div className="space-y-4">
          {usage ? (
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[var(--admin-card)] rounded-xl border border-[var(--admin-border)] p-4">
                <div className="text-2xl font-bold text-[var(--admin-text)]">{usage.totalCalls.toLocaleString()}</div>
                <div className="text-xs text-[var(--admin-text-muted)]">Total Calls</div>
              </div>
              <div className="bg-[var(--admin-card)] rounded-xl border border-[var(--admin-border)] p-4">
                <div className="text-2xl font-bold text-[var(--admin-text)]">{usage.successRate}%</div>
                <div className="text-xs text-[var(--admin-text-muted)]">Success Rate</div>
              </div>
              <div className="bg-[var(--admin-card)] rounded-xl border border-[var(--admin-border)] p-4">
                <div className="text-2xl font-bold text-[var(--admin-text)]">{usage.avgResponseTime}ms</div>
                <div className="text-xs text-[var(--admin-text-muted)]">Avg Response</div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-[var(--admin-text-muted)]">Loading usage data...</div>
          )}
        </div>
      )}

      {tab === 'docs' && (
        <div className="bg-[var(--admin-card)] rounded-xl border border-[var(--admin-border)] p-6 space-y-4">
          <h3 className="text-lg font-semibold text-[var(--admin-text)]">API Documentation</h3>
          <div className="space-y-3 text-sm text-[var(--admin-text-secondary)]">
            <p>Base URL: <code className="bg-[var(--admin-bg)] px-2 py-0.5 rounded text-xs">{process.env.NEXT_PUBLIC_API_URL}/api/external</code></p>
            <p>Authentication: <code className="bg-[var(--admin-bg)] px-2 py-0.5 rounded text-xs">ApiKey tl_live_...</code></p>
            <div className="border-t border-[var(--admin-border)] pt-3 space-y-2">
              <h4 className="font-medium text-[var(--admin-text)]">Endpoints</h4>
              <div className="space-y-1">
                <p><code className="bg-[var(--admin-bg)] px-2 py-0.5 rounded text-xs">POST /api/external/ocr</code> — Process a document with OCR</p>
                <p><code className="bg-[var(--admin-bg)] px-2 py-0.5 rounded text-xs">POST /api/external/bundle</code> — Process a document bundle</p>
                <p><code className="bg-[var(--admin-bg)] px-2 py-0.5 rounded text-xs">GET /api/verify/:hash</code> — Verify a document hash</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
