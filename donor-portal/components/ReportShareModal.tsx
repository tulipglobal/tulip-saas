'use client'

import React, { useState, useEffect, useRef } from 'react'
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

interface ReportShareModalProps {
  reportId: string
  open: boolean
  onClose: () => void
}

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return 'Never'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return 'Never'
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ReportShareModal({ reportId, open, onClose }: ReportShareModalProps) {
  const [links, setLinks] = useState<ShareLink[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [expiryDays, setExpiryDays] = useState<number>(30)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [newLink, setNewLink] = useState<ShareLink | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setNewLink(null)
    apiGet(`/api/donor/reports/${reportId}/shares`)
      .then(async r => {
        if (r.ok) {
          const d = await r.json()
          setLinks(d.links || [])
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open, reportId])

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
      const r = await apiPost(`/api/donor/reports/${reportId}/share`, {
        expiryDays,
      })
      if (r.ok) {
        const data = await r.json()
        const link: ShareLink = {
          id: data.id,
          token: data.token,
          url: data.url || `${DONOR_URL}/share/report/${data.token}`,
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
      const r = await apiFetch(`/api/donor/reports/shares/${id}`, { method: 'DELETE' })
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
            <h2 className="text-lg font-bold" style={{ color: 'var(--donor-dark)' }}>Share Report</h2>
            <p className="text-xs" style={{ color: 'var(--donor-muted)' }}>Create a read-only link to share this report</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--donor-border)] text-lg" style={{ color: 'var(--donor-muted)' }}>&times;</button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Generate new link */}
          {!newLink && (
            <div className="space-y-3">
              <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>Link Expiry</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: '7 days', value: 7 },
                  { label: '14 days', value: 14 },
                  { label: '30 days', value: 30 },
                  { label: '90 days', value: 90 },
                ].map(opt => (
                  <button
                    key={opt.label}
                    onClick={() => setExpiryDays(opt.value)}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-all"
                    style={{
                      borderColor: expiryDays === opt.value ? 'var(--donor-accent)' : 'var(--donor-border)',
                      background: expiryDays === opt.value ? 'var(--donor-accent)' : 'var(--bg-card)',
                      color: expiryDays === opt.value ? '#FFFFFF' : 'var(--donor-dark)',
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
                {creating ? 'Generating...' : 'Generate Link'}
              </button>
            </div>
          )}

          {/* Newly generated link */}
          {newLink && (
            <div className="rounded-xl border px-4 py-4 space-y-3" style={{ borderColor: 'var(--donor-accent)', background: 'var(--donor-light)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--donor-accent)' }}>Link created successfully</p>
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
                  {copiedId === newLink.id ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-xs" style={{ color: 'var(--donor-muted)' }}>
                Expires: {newLink.expiresAt ? fmtDate(newLink.expiresAt) : 'Never'}
              </p>
              <button
                onClick={() => setNewLink(null)}
                className="text-xs font-medium hover:underline"
                style={{ color: 'var(--donor-accent)' }}
              >
                Create another link
              </button>
            </div>
          )}

          {/* Active shares list */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--donor-muted)' }}>
              Active Shares ({links.length})
            </h3>
            {loading ? (
              <div className="py-4 text-center">
                <div className="inline-block w-5 h-5 border-2 border-[var(--donor-accent)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : links.length === 0 ? (
              <p className="text-sm py-4 text-center" style={{ color: 'var(--donor-muted)' }}>No active share links for this report.</p>
            ) : (
              <div className="space-y-2">
                {links.map(link => (
                  <div key={link.id} className="rounded-lg border px-4 py-3 flex items-center justify-between gap-3" style={{ borderColor: 'var(--donor-border)' }}>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-mono truncate" style={{ color: 'var(--donor-dark)' }}>{link.url}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[11px]" style={{ color: 'var(--donor-muted)' }}>
                          Created {fmtDate(link.createdAt)}
                        </span>
                        <span className="text-[11px]" style={{ color: 'var(--donor-muted)' }}>
                          Expires: {link.expiresAt ? fmtDate(link.expiresAt) : 'Never'}
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
                        {copiedId === link.id ? 'Copied!' : 'Copy'}
                      </button>
                      <button
                        onClick={() => handleRevoke(link.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all hover:bg-red-50"
                        style={{ borderColor: '#FEE2E2', color: '#DC2626' }}
                      >
                        Revoke
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
