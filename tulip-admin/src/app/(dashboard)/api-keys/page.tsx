'use client'

import { useState, useEffect } from 'react'
import { apiGet, apiPost, apiDelete } from '@/lib/api'
import { Key, Plus, Copy, Check, Trash2, RotateCw } from 'lucide-react'

interface ApiKeyItem {
  id: string
  name: string
  prefix: string
  permissions: string[]
  lastUsedAt: string | null
  revokedAt: string | null
  createdAt: string
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newKeyName, setNewKeyName] = useState('')
  const [revealedKey, setRevealedKey] = useState('')
  const [copied, setCopied] = useState(false)

  const loadKeys = async () => {
    try {
      const res = await apiGet('/api/api-keys')
      if (res.ok) {
        const d = await res.json()
        setKeys(d.keys || d.data || d || [])
      }
    } catch {}
    setLoading(false)
  }

  useEffect(() => { loadKeys() }, [])

  const createKey = async () => {
    if (!newKeyName.trim()) return
    const res = await apiPost('/api/api-keys', { name: newKeyName })
    if (res.ok) {
      const d = await res.json()
      setRevealedKey(d.key || d.rawKey || '')
      setNewKeyName('')
      loadKeys()
    }
  }

  const revokeKey = async (id: string) => {
    if (!confirm('Revoke this API key?')) return
    await apiDelete(`/api/api-keys/${id}`)
    loadKeys()
  }

  const rotateKey = async (id: string) => {
    if (!confirm('Rotate this key? The old key will stop working.')) return
    const res = await apiPost(`/api/api-keys/${id}/rotate`, {})
    if (res.ok) {
      const d = await res.json()
      setRevealedKey(d.key || d.rawKey || '')
      loadKeys()
    }
  }

  const copyKey = () => {
    navigator.clipboard.writeText(revealedKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const active = keys.filter(k => !k.revokedAt)
  const revoked = keys.filter(k => k.revokedAt)

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-[var(--admin-text)]">API Keys</h1>
        <p className="text-sm text-[var(--admin-text-secondary)] mt-1">Manage API keys for external integrations</p>
      </div>

      {/* Create */}
      <div className="flex items-center gap-3">
        <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="Key name..." className="flex-1 max-w-xs rounded-lg px-4 py-2 text-sm border border-[var(--admin-border)] bg-[var(--admin-card)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50" />
        <button onClick={createKey} disabled={!newKeyName.trim()} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--admin-accent)] hover:bg-[var(--admin-accent-hover)] disabled:opacity-50 transition-colors">
          <Plus size={16} /> Create Key
        </button>
      </div>

      {/* Revealed key */}
      {revealedKey && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <Key size={16} className="text-green-600 shrink-0" />
          <code className="text-sm text-green-800 font-mono flex-1 break-all">{revealedKey}</code>
          <button onClick={copyKey} className="shrink-0">
            {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} className="text-green-600" />}
          </button>
          <button onClick={() => setRevealedKey('')} className="text-xs text-green-600 hover:text-green-800">Dismiss</button>
        </div>
      )}

      {/* Active keys */}
      <div className="bg-[var(--admin-card)] rounded-xl border border-[var(--admin-border)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--admin-border)] bg-[var(--admin-bg)]">
          <h3 className="text-sm font-medium text-[var(--admin-text)]">Active Keys ({active.length})</h3>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-[var(--admin-text-muted)]">Loading...</div>
        ) : active.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--admin-text-muted)]">No active keys</div>
        ) : (
          <div className="divide-y divide-[var(--admin-border)]">
            {active.map(k => (
              <div key={k.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-[var(--admin-text)]">{k.name}</div>
                  <div className="text-xs text-[var(--admin-text-muted)]">
                    <span className="font-mono">{k.prefix}...</span>
                    <span className="mx-2">·</span>
                    {k.permissions.length} permissions
                    <span className="mx-2">·</span>
                    Last used: {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'Never'}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => rotateKey(k.id)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-[var(--admin-bg)] transition-colors" title="Rotate">
                    <RotateCw size={14} className="text-[var(--admin-text-muted)]" />
                  </button>
                  <button onClick={() => revokeKey(k.id)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-red-50 transition-colors" title="Revoke">
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Revoked keys */}
      {revoked.length > 0 && (
        <div className="bg-[var(--admin-card)] rounded-xl border border-[var(--admin-border)] overflow-hidden opacity-60">
          <div className="px-5 py-3 border-b border-[var(--admin-border)] bg-[var(--admin-bg)]">
            <h3 className="text-sm font-medium text-[var(--admin-text-muted)]">Revoked Keys ({revoked.length})</h3>
          </div>
          <div className="divide-y divide-[var(--admin-border)]">
            {revoked.map(k => (
              <div key={k.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm text-[var(--admin-text-muted)] line-through">{k.name}</div>
                  <div className="text-xs text-[var(--admin-text-muted)]">{k.prefix}... · Revoked {new Date(k.revokedAt!).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
