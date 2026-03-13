'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
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
  const t = useTranslations('apiKeysPage')
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
        if (!r.ok) throw new Error(r.status === 403 ? t('requiresPermission') : 'Failed to load')
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
    if (!confirm(t('revokeConfirm'))) return
    await apiDelete(`/api/api-keys/${id}`)
    load()
  }

  const handleRotate = async (id: string) => {
    if (!confirm(t('rotateConfirm'))) return
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
      <h1 className="text-2xl font-bold text-[#183a1d]" style={{ fontFamily: 'Inter, sans-serif' }}>{t('title')}</h1>
      <p className="text-[#183a1d]/40 text-sm mt-4">{t('loading')}</p>
    </div>
  )

  if (error && keys.length === 0) return (
    <div className="p-6 animate-fade-up">
      <h1 className="text-2xl font-bold text-[#183a1d]" style={{ fontFamily: 'Inter, sans-serif' }}>{t('title')}</h1>
      <div className="mt-6 rounded-xl border border-red-400/20 bg-red-400/5 px-5 py-4">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    </div>
  )

  return (
    <div className="p-6 space-y-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#183a1d]" style={{ fontFamily: 'Inter, sans-serif' }}>{t('title')}</h1>
          <p className="text-[#183a1d]/60 text-sm mt-1">{t('subtitle')}</p>
        </div>
      </div>

      {/* Revealed key banner */}
      {revealedKey && (
        <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 px-5 py-4 space-y-2">
          <div className="flex items-center gap-2 text-yellow-400 text-sm font-medium">
            <AlertTriangle size={14} />
            {t('copyKeyNow')}
          </div>
          <div className="flex items-center gap-2">
            <code className="text-xs text-[#183a1d] bg-[#e1eedd] px-3 py-2 rounded-lg flex-1 overflow-x-auto">{revealedKey}</code>
            <button onClick={copyKey} className="px-3 py-2 rounded-lg bg-[#e1eedd] hover:bg-[#e1eedd] transition-colors">
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-[#183a1d]/60" />}
            </button>
          </div>
          <button onClick={() => setRevealedKey(null)} className="text-xs text-[#183a1d]/40 hover:text-[#183a1d]/60">{t('dismiss')}</button>
        </div>
      )}

      {/* Create new key */}
      <div className="flex items-center gap-3">
        <input
          value={newKeyName}
          onChange={e => setNewKeyName(e.target.value)}
          placeholder={t('keyNamePlaceholder')}
          className="bg-[#e1eedd] border border-[#c8d6c0] rounded-lg px-4 py-2.5 text-sm text-[#183a1d] placeholder-[#183a1d]/40 outline-none w-72"
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
        />
        <button onClick={handleCreate} disabled={creating || !newKeyName.trim()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-[#183a1d] disabled:opacity-40 bg-[#f6c453] hover:bg-[#f0a04b]">
          <Plus size={16} />
          {creating ? t('creating') : t('createKey')}
        </button>
      </div>

      {/* Active keys */}
      <div className="rounded-xl border border-[#c8d6c0] overflow-hidden bg-[#e1eedd]">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_80px] gap-4 px-5 py-3 border-b border-[#c8d6c0] text-xs text-[#183a1d]/40 uppercase tracking-wide font-medium">
          <span>{t('name')}</span><span>{t('prefix')}</span><span>{t('lastUsed')}</span><span>{t('created')}</span><span />
        </div>
        {activeKeys.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <Key size={32} className="text-[#183a1d]/30" />
            <p className="text-[#183a1d]/40 text-sm">{t('noActiveKeys')}</p>
          </div>
        ) : (
          <div className="divide-y divide-[#c8d6c0]">
            {activeKeys.map(k => (
              <div key={k.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_80px] gap-4 items-center px-5 py-3.5 hover:bg-[#e1eedd]/50 transition-colors">
                <div>
                  <div className="text-sm font-medium text-[#183a1d]">{k.name}</div>
                  <div className="text-xs text-[#183a1d]/40 mt-0.5">{t('permissions', { count: k.permissions.length })}</div>
                </div>
                <code className="text-xs text-[#183a1d]/60">{k.prefix}...</code>
                <div className="text-xs text-[#183a1d]/40">
                  {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : t('never')}
                </div>
                <div className="text-xs text-[#183a1d]/40">
                  {new Date(k.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleRotate(k.id)} title="Rotate"
                    className="p-1.5 rounded-md text-[#183a1d]/30 hover:text-yellow-400 hover:bg-yellow-400/5 transition-colors">
                    <RotateCw size={13} />
                  </button>
                  <button onClick={() => handleRevoke(k.id)} title="Revoke"
                    className="p-1.5 rounded-md text-[#183a1d]/30 hover:text-red-400 hover:bg-red-400/5 transition-colors">
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
          <h2 className="text-sm font-medium text-[#183a1d]/40 uppercase tracking-wide mb-3">{t('revokedKeys')}</h2>
          <div className="rounded-xl border border-[#c8d6c0] overflow-hidden bg-[#e1eedd]">
            <div className="divide-y divide-[#c8d6c0]">
              {revokedKeys.map(k => (
                <div key={k.id} className="flex items-center justify-between px-5 py-3 opacity-40">
                  <div>
                    <div className="text-sm text-[#183a1d]/60 line-through">{k.name}</div>
                    <code className="text-xs text-[#183a1d]/40">{k.prefix}...</code>
                  </div>
                  <span className="text-xs text-red-400/60">{t('revoked')} {new Date(k.revokedAt!).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
