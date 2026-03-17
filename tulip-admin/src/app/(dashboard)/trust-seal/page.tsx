'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiGet, apiFetch } from '@/lib/api'
import { ShieldCheck, Plus, Search, Copy, Check, ExternalLink, X } from 'lucide-react'

interface Seal {
  id: string
  title: string
  recipient: string
  recipientEmail?: string
  documentType: string
  issuedBy?: string
  dataHash: string
  status: string
  polygonTx?: string
  verifyUrl?: string
  createdAt: string
}

const API_URL = process.env.NEXT_PUBLIC_API_URL

export default function TrustSealPage() {
  const [seals, setSeals] = useState<Seal[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formRecipient, setFormRecipient] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formType, setFormType] = useState('Financial Report')
  const [formIssuer, setFormIssuer] = useState('')
  const [formFile, setFormFile] = useState<File | null>(null)
  const [creating, setCreating] = useState(false)

  const loadSeals = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      params.set('limit', '200')
      const res = await apiGet(`/api/trust-seal?${params}`)
      if (res.ok) {
        const d = await res.json()
        setSeals(d.seals || d.data || d || [])
      }
    } catch {}
    setLoading(false)
  }, [search])

  useEffect(() => { loadSeals() }, [loadSeals])

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(''), 2000)
  }

  const issueSeal = async () => {
    if (!formTitle || !formRecipient || !formFile) return
    setCreating(true)
    try {
      const token = localStorage.getItem('admin_token')
      const formData = new FormData()
      formData.append('title', formTitle)
      formData.append('recipient', formRecipient)
      formData.append('recipientEmail', formEmail)
      formData.append('documentType', formType)
      formData.append('issuedBy', formIssuer)
      formData.append('file', formFile)
      await fetch(`${API_URL}/api/trust-seal/issue`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      setShowCreate(false)
      setFormTitle('')
      setFormRecipient('')
      setFormEmail('')
      setFormFile(null)
      loadSeals()
    } catch {}
    setCreating(false)
  }

  const statusBadge = (status: string) => {
    const s = status?.toLowerCase()
    if (s === 'confirmed') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border font-medium bg-green-50 text-green-600 border-green-200">Confirmed</span>
    if (s === 'pending') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border font-medium bg-amber-50 text-amber-600 border-amber-200">Pending</span>
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border font-medium bg-gray-50 text-gray-500 border-gray-200">{status}</span>
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--admin-text)]">Trust Seal</h1>
          <p className="text-sm text-[var(--admin-text-secondary)] mt-1">{seals.length} seals issued</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--admin-accent)] hover:bg-[var(--admin-accent-hover)] transition-colors">
          <Plus size={16} /> Issue Seal
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)]" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search seals..." className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-card)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50" />
      </div>

      <div className="bg-[var(--admin-card)] rounded-xl border border-[var(--admin-border)] overflow-hidden">
        <div className="hidden lg:grid grid-cols-[2fr_1fr_1fr_100px_100px_80px] gap-4 px-5 py-3 border-b border-[var(--admin-border)] text-xs text-[var(--admin-text-muted)] uppercase tracking-wide font-medium bg-[var(--admin-bg)]">
          <span>Title</span><span>Recipient</span><span>Type</span><span>Status</span><span>Date</span><span>Actions</span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-[var(--admin-text-muted)]">Loading...</div>
        ) : seals.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <ShieldCheck size={24} className="text-[var(--admin-text-muted)]" />
            <p className="text-sm text-[var(--admin-text-muted)]">No seals yet</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--admin-border)]">
            {seals.map(s => (
              <div key={s.id} className="px-5 py-3 hover:bg-[var(--admin-bg)] transition-colors lg:grid lg:grid-cols-[2fr_1fr_1fr_100px_100px_80px] lg:gap-4 lg:items-center">
                <div>
                  <div className="text-sm font-medium text-[var(--admin-text)]">{s.title}</div>
                  <div className="text-xs text-[var(--admin-text-muted)] font-mono truncate">{s.dataHash.slice(0, 20)}...</div>
                </div>
                <div className="text-sm text-[var(--admin-text-secondary)]">{s.recipient}</div>
                <div className="text-xs text-[var(--admin-text-secondary)]">{s.documentType}</div>
                <div>{statusBadge(s.status)}</div>
                <div className="text-xs text-[var(--admin-text-muted)]">{new Date(s.createdAt).toLocaleDateString()}</div>
                <div className="flex items-center gap-1">
                  <button onClick={() => copyText(s.dataHash, s.id)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-[var(--admin-bg)] transition-colors">
                    {copied === s.id ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-[var(--admin-text-muted)]" />}
                  </button>
                  {s.polygonTx && (
                    <a href={`https://polygonscan.com/tx/${s.polygonTx}`} target="_blank" rel="noreferrer" className="w-7 h-7 rounded flex items-center justify-center hover:bg-[var(--admin-bg)] transition-colors">
                      <ExternalLink size={14} className="text-[var(--admin-text-muted)]" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-[var(--admin-card)] rounded-xl border border-[var(--admin-border)] p-6 max-w-md w-full shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[var(--admin-text)]">Issue Trust Seal</h3>
              <button onClick={() => setShowCreate(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--admin-bg)]"><X size={16} /></button>
            </div>
            <input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Document title" className="w-full rounded-lg px-3 py-2 text-sm border border-[var(--admin-border)] bg-[var(--admin-bg)]" />
            <input value={formRecipient} onChange={e => setFormRecipient(e.target.value)} placeholder="Recipient name" className="w-full rounded-lg px-3 py-2 text-sm border border-[var(--admin-border)] bg-[var(--admin-bg)]" />
            <input value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="Recipient email" className="w-full rounded-lg px-3 py-2 text-sm border border-[var(--admin-border)] bg-[var(--admin-bg)]" />
            <input value={formIssuer} onChange={e => setFormIssuer(e.target.value)} placeholder="Issuer organization" className="w-full rounded-lg px-3 py-2 text-sm border border-[var(--admin-border)] bg-[var(--admin-bg)]" />
            <select value={formType} onChange={e => setFormType(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm border border-[var(--admin-border)] bg-[var(--admin-bg)]">
              <option>Financial Report</option><option>Audit Report</option><option>Impact Report</option><option>Contract</option><option>Certificate</option><option>Other</option>
            </select>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={e => setFormFile(e.target.files?.[0] || null)} className="text-sm" />
            <button onClick={issueSeal} disabled={creating || !formTitle || !formRecipient || !formFile} className="w-full py-2.5 rounded-lg text-sm font-medium text-white bg-[var(--admin-accent)] hover:bg-[var(--admin-accent-hover)] disabled:opacity-50 transition-colors">
              {creating ? 'Issuing...' : 'Issue Seal'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
