'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { apiGet, apiPost, apiFetch } from '../lib/api'

const DONOR_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://donor.sealayer.io'

interface ShareLink {
  id: string
  token: string
  url: string
  expiresAt: string | null
  viewCount: number
  createdAt: string
}

interface ShareModalProps {
  projectId: string
  open: boolean
  onClose: () => void
}

export default function ShareModal({ projectId, open, onClose }: ShareModalProps) {
  const t = useTranslations()
  const [links, setLinks] = useState<ShareLink[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [expiryOption, setExpiryOption] = useState<number | null>(30)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [newLink, setNewLink] = useState<ShareLink | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const expiryOptions = [
    { label: t('share.days7'), value: 7 },
    { label: t('share.days30'), value: 30 },
    { label: t('share.days90'), value: 90 },
    { label: t('share.never'), value: null },
  ]

  function fmtDate(d: string | Date | null | undefined): string {
    if (!d) return t('share.never')
    const dt = new Date(d)
    if (isNaN(dt.getTime())) return t('share.never')
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setNewLink(null)
    apiGet(`/api/donor/share/project/${projectId}`)
      .then(async r => {
        if (r.ok) {
          const d = await r.json()
          setLinks(d.links || [])
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open, projectId])

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, onClose])

  const handleGenerate = async () => {
    setCreating(true)
    try {
      const r = await apiPost('/api/donor/share', {
        projectId,
        expiresInDays: expiryOption,
      })
      if (r.ok) {
        const data = await r.json()
        const link: ShareLink = {
          id: data.id,
          token: data.token,
          url: data.url || `${DONOR_URL}/share/${data.token}`,
          expiresAt: data.expiresAt,
          viewCount: 0,
          createdAt: data.createdAt,
        }
        setNewLink(link)
        setLinks(prev => [link, ...prev])
      }
    } catch {}
    setCreating(false)
  }

  const handleRevoke = async (id: string) => {
    try {
      const r = await apiFetch(`/api/donor/share/${id}`, { method: 'DELETE' })
      if (r.ok) {
        setLinks(prev => prev.filter(l => l.id !== id))
        if (newLink?.id === id) setNewLink(null)
      }
    } catch {}
  }

  const handleCopy = (url: string, id: string) => {
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div ref={panelRef} className="w-full max-w-lg bg-[var(--bg-card)] rounded-2xl shadow-2xl overflow-hidden animate-fade-up mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--donor-border)', background: 'var(--donor-light)' }}>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--donor-dark)' }}>{t('share.shareProject')}</h2>
            <p className="text-xs" style={{ color: 'var(--donor-muted)' }}>{t('share.createReadOnlyLink')}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--donor-border)] text-lg" style={{ color: 'var(--donor-muted)' }}>&times;</button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Generate new link */}
          {!newLink && (
            <div className="space-y-3">
              <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('share.linkExpiry')}</label>
              <div className="flex flex-wrap gap-2">
                {expiryOptions.map(opt => (
                  <button
                    key={opt.label}
                    onClick={() => setExpiryOption(opt.value)}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-all"
                    style={{
                      borderColor: expiryOption === opt.value ? 'var(--donor-accent)' : 'var(--donor-border)',
                      background: expiryOption === opt.value ? 'var(--donor-accent)' : 'var(--bg-card)',
                      color: expiryOption === opt.value ? '#FFFFFF' : 'var(--donor-dark)',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <button
                onClick={handleGenerate}
                disabled={creating}
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50"
                style={{ background: 'var(--donor-accent)' }}
              >
                {creating ? t('share.generating') : t('share.generateLink')}
              </button>
            </div>
          )}

          {/* Newly generated link */}
          {newLink && (
            <div className="rounded-xl border px-4 py-4 space-y-3" style={{ borderColor: 'var(--donor-accent)', background: 'var(--donor-light)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--donor-accent)' }}>{t('share.linkCreated')}</p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={newLink.url}
                  className="flex-1 rounded-lg border px-3 py-2 text-sm font-mono bg-[var(--bg-card)] outline-none"
                  style={{ borderColor: 'var(--donor-border)', color: 'var(--donor-dark)' }}
                />
                <button
                  onClick={() => handleCopy(newLink.url, newLink.id)}
                  className="shrink-0 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all"
                  style={{ background: copiedId === newLink.id ? '#16A34A' : 'var(--donor-accent)' }}
                >
                  {copiedId === newLink.id ? t('share.copied') : t('share.copy')}
                </button>
              </div>
              <p className="text-xs" style={{ color: 'var(--donor-muted)' }}>
                {t('share.expires')}: {newLink.expiresAt ? fmtDate(newLink.expiresAt) : t('share.never')}
              </p>
              <button
                onClick={() => setNewLink(null)}
                className="text-xs font-medium hover:underline"
                style={{ color: 'var(--donor-accent)' }}
              >
                {t('share.createAnother')}
              </button>
            </div>
          )}

          {/* Existing links */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--donor-muted)' }}>
              {t('share.activeLinks')} ({links.length})
            </h3>
            {loading ? (
              <div className="py-4 text-center">
                <div className="inline-block w-5 h-5 border-2 border-[var(--donor-accent)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : links.length === 0 ? (
              <p className="text-sm py-4 text-center" style={{ color: 'var(--donor-muted)' }}>{t('share.noActiveLinks')}</p>
            ) : (
              <div className="space-y-2">
                {links.map(link => (
                  <div key={link.id} className="rounded-lg border px-4 py-3 flex items-center justify-between gap-3" style={{ borderColor: 'var(--donor-border)' }}>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-mono truncate" style={{ color: 'var(--donor-dark)' }}>{link.url}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[11px]" style={{ color: 'var(--donor-muted)' }}>
                          {t('share.created')} {fmtDate(link.createdAt)}
                        </span>
                        <span className="text-[11px]" style={{ color: 'var(--donor-muted)' }}>
                          {t('share.expires')}: {link.expiresAt ? fmtDate(link.expiresAt) : t('share.never')}
                        </span>
                        <span className="text-[11px] font-medium" style={{ color: 'var(--donor-accent)' }}>
                          {link.viewCount} view{link.viewCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleCopy(link.url, link.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                        style={{
                          borderColor: copiedId === link.id ? '#16A34A' : 'var(--donor-border)',
                          color: copiedId === link.id ? '#16A34A' : 'var(--donor-accent)',
                        }}
                      >
                        {copiedId === link.id ? t('share.copied') : t('share.copy')}
                      </button>
                      <button
                        onClick={() => handleRevoke(link.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all hover:bg-red-50"
                        style={{ borderColor: '#FEE2E2', color: '#DC2626' }}
                      >
                        {t('share.revoke')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
