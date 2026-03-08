'use client'

import { useState, useEffect } from 'react'
import { apiGet, apiPost, apiDelete } from '@/lib/api'
import { Key, Plus, Copy, Check, Trash2, RotateCw, AlertTriangle } from 'lucide-react'

interface ApiKeyEntry {
  id: string
  name: string
  prefix: string
  permissions: string[]
  lastUsedAt: string | null
  expiresAt: string | null
  revokedAt: string | null
  createdAt: string
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    apiGet('/api/api-keys')
      .then(r => {
        if (!r.ok) throw new Error(r.status === 403 ? 'Requires keys:manage permission' : 'Failed to load')
        return r.json()
      })
      .then(d => { setKeys(Array.isArray(d) ? d : d.data ?? []); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }

  useEffect(load, [])

  const handleCreate = async () => {
    if (!newKeyName.trim()) return
    setCreating(true)
    try {
      const res = await apiPost('/api/api-keys', { name: newKeyName.trim() })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      const data = await res.json()
      setRevealedKey(data.key)
      setNewKeyName('')
      load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create key')
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this API key? This cannot be undone.')) return
    await apiDelete(`/api/api-keys/${id}`)
    load()
  }

  const handleRotate = async (id: string) => {
    if (!confirm('Rotate this key? The old key will stop working immediately.')) return
    const res = await apiPost(`/api/api-keys/${id}/rotate`, {})
    if (res.ok) {
      const data = await res.json()
      setRevealedKey(data.key)
      load()
    }
  }

  const copyKey = () => {
    if (revealedKey) { navigator.clipboard.writeText(revealedKey); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  }

  const activeKeys = keys.filter(k => !k.revokedAt)
  const revokedKeys = keys.filter(k => k.revokedAt)

  if (loading) return (
    <div className="p-6 animate-fade-up">
      <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>API Keys</h1>
      <p className="text-white/30 text-sm mt-4">Loading...</p>
    </div>
  )

  if (error && keys.length === 0) return (
    <div className="p-6 animate-fade-up">
      <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>API Keys</h1>
      <div className="mt-6 rounded-xl border border-red-400/20 bg-red-400/5 px-5 py-4">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    </div>
  )

  return (
    <div className="p-6 space-y-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>API Keys</h1>
          <p className="text-white/40 text-sm mt-1">Manage programmatic access to the Tulip API</p>
        </div>
      </div>

      {/* Revealed key banner */}
      {revealedKey && (
        <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 px-5 py-4 space-y-2">
          <div className="flex items-center gap-2 text-yellow-400 text-sm font-medium">
            <AlertTriangle size={14} />
            Copy this key now — it will not be shown again
          </div>
          <div className="flex items-center gap-2">
            <code className="text-xs text-white/70 bg-white/5 px-3 py-2 rounded-lg flex-1 overflow-x-auto">{revealedKey}</code>
            <button onClick={copyKey} className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-white/50" />}
            </button>
          </div>
          <button onClick={() => setRevealedKey(null)} className="text-xs text-white/30 hover:text-white/50">Dismiss</button>
        </div>
      )}

      {/* Create new key */}
      <div className="flex items-center gap-3">
        <input
          value={newKeyName}
          onChange={e => setNewKeyName(e.target.value)}
          placeholder="Key name (e.g. CI Pipeline)"
          className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white/70 placeholder-white/30 outline-none w-72"
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
        />
        <button onClick={handleCreate} disabled={creating || !newKeyName.trim()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
          <Plus size={16} />
          {creating ? 'Creating...' : 'Create Key'}
        </button>
      </div>

      {/* Active keys */}
      <div className="rounded-xl border border-white/8 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_80px] gap-4 px-5 py-3 border-b border-white/8 text-xs text-white/30 uppercase tracking-wide font-medium">
          <span>Name</span><span>Prefix</span><span>Last Used</span><span>Created</span><span />
        </div>
        {activeKeys.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <Key size={32} className="text-white/10" />
            <p className="text-white/30 text-sm">No active API keys</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {activeKeys.map(k => (
              <div key={k.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_80px] gap-4 items-center px-5 py-3.5 hover:bg-white/2 transition-colors">
                <div>
                  <div className="text-sm font-medium text-white/80">{k.name}</div>
                  <div className="text-xs text-white/25 mt-0.5">{k.permissions.length} permissions</div>
                </div>
                <code className="text-xs text-white/40">{k.prefix}...</code>
                <div className="text-xs text-white/30">
                  {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'Never'}
                </div>
                <div className="text-xs text-white/30">
                  {new Date(k.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleRotate(k.id)} title="Rotate"
                    className="p-1.5 rounded-md text-white/20 hover:text-yellow-400 hover:bg-yellow-400/5 transition-colors">
                    <RotateCw size={13} />
                  </button>
                  <button onClick={() => handleRevoke(k.id)} title="Revoke"
                    className="p-1.5 rounded-md text-white/20 hover:text-red-400 hover:bg-red-400/5 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Revoked keys */}
      {revokedKeys.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-white/30 uppercase tracking-wide mb-3">Revoked Keys</h2>
          <div className="rounded-xl border border-white/8 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="divide-y divide-white/5">
              {revokedKeys.map(k => (
                <div key={k.id} className="flex items-center justify-between px-5 py-3 opacity-40">
                  <div>
                    <div className="text-sm text-white/50 line-through">{k.name}</div>
                    <code className="text-xs text-white/25">{k.prefix}...</code>
                  </div>
                  <span className="text-xs text-red-400/60">Revoked {new Date(k.revokedAt!).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
