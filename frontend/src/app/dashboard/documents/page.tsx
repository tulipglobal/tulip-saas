'use client'
import { apiGet } from '@/lib/api'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { FileCheck, Plus, Search, ExternalLink, Copy, Check, Shield, AlertTriangle, Users } from 'lucide-react'

const KEY_DOCUMENT_CATEGORIES = ['licence','certificate','contract','permit','insurance','visa','id_document','mou']
const CATEGORY_LABELS: Record<string, string> = {
  licence: 'Licence', certificate: 'Certificate', contract: 'Contract',
  permit: 'Permit', insurance: 'Insurance', visa: 'Visa',
  id_document: 'ID Document', mou: 'MOU',
}

interface Document {
  id: string
  name: string
  description: string | null
  documentType: string | null
  documentLevel: string
  category: string | null
  expiryDate: string | null
  fileType: string | null
  fileSize: number | null
  sha256Hash: string | null
  fileUrl: string
  uploadedAt: string
  project?: { id: string; name: string }
  expense?: { id: string; description: string; amount: number; currency: string } | null
}

function HashCell({ hash }: { hash: string }) {
  const [copied, setCopied] = useState(false)
  const copy = (e: React.MouseEvent) => { e.stopPropagation(); navigator.clipboard.writeText(hash); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  return (
    <div className="flex items-center gap-1.5 group">
      <span className="hash-mono text-white/30" style={{ fontSize: 11 }}>{hash.slice(0, 10)}…{hash.slice(-6)}</span>
      <button onClick={copy} className="opacity-0 group-hover:opacity-100 transition-opacity">
        {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} className="text-white/30" />}
      </button>
    </div>
  )
}

function CategoryBadge({ category }: { category: string | null }) {
  if (!category || !CATEGORY_LABELS[category]) return null
  return (
    <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-indigo-400/10 text-indigo-400">
      {CATEGORY_LABELS[category]}
    </span>
  )
}

function ExpiryCell({ doc }: { doc: Document }) {
  if (!doc.category || !KEY_DOCUMENT_CATEGORIES.includes(doc.category) || !doc.expiryDate) {
    return <span className="text-white/20 text-xs">—</span>
  }
  const now = new Date()
  const expiry = new Date(doc.expiryDate)
  const diffMs = expiry.getTime() - now.getTime()
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  const formatted = expiry.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })

  if (daysLeft <= 0) {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-400/10 text-red-400 border border-red-400/20">Expired</span>
  }
  if (daysLeft <= 7) {
    return <span className="text-red-400 text-xs font-medium flex items-center gap-1"><AlertTriangle size={11} />{formatted}</span>
  }
  if (daysLeft <= 30) {
    return <span className="text-orange-400 text-xs font-medium">{formatted}</span>
  }
  return <span className="text-white/40 text-xs">{formatted}</span>
}

function FileTypeBadge({ type }: { type: string | null }) {
  const t = (type ?? 'file').toLowerCase()
  const map: Record<string, string> = {
    pdf: 'bg-red-400/10 text-red-400', docx: 'bg-blue-400/10 text-blue-400',
    xlsx: 'bg-green-400/10 text-green-400', jpg: 'bg-orange-400/10 text-orange-400',
    png: 'bg-orange-400/10 text-orange-400', csv: 'bg-teal-400/10 text-teal-400',
  }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-mono font-medium uppercase ${map[t] ?? 'bg-white/5 text-white/40'}`}>
      {t}
    </span>
  )
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    apiGet('/api/documents?limit=100')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(d => { setDocs(d.data ?? d.items ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const openDoc = async (docId: string) => {
    const token = localStorage.getItem('tulip_token')
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/documents/${docId}/view`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const data = await res.json()
    if (data.url) window.open(data.url, '_blank')
  }

  const filtered = docs.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    (d.project?.name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Documents</h1>
          <p className="text-white/40 text-sm mt-1">{docs.length} document{docs.length !== 1 ? 's' : ''} — SHA-256 fingerprinted</p>
        </div>
        <Link href="/dashboard/documents/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white self-start"
          style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
          <Plus size={16} /> Add Document
        </Link>
      </div>

      {/* Donor sharing info banner */}
      <div className="rounded-xl border p-3.5 flex items-center gap-3"
        style={{ background: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.15)' }}>
        <Users size={16} className="text-emerald-400 shrink-0" />
        <p className="text-white/50 text-xs">All documents are automatically visible to your linked donors via the Donor Portal</p>
      </div>

      <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 max-w-sm">
        <Search size={15} className="text-white/30" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search documents..." className="bg-transparent text-sm text-white/70 placeholder-white/30 outline-none w-full" />
      </div>

      <div className="rounded-xl border border-white/8 overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.02)' }}>
        {/* Desktop table header */}
        <div className="hidden lg:grid grid-cols-[2fr_80px_90px_80px_1fr_1fr_1fr_60px] gap-3 px-5 py-3 border-b border-white/8 text-xs text-white/30 uppercase tracking-wide font-medium">
          <span>Document</span><span>Type</span><span>Category</span><span>Expiry</span><span>Hash</span><span>Project</span><span>Date</span><span>Actions</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-white/30 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <FileCheck size={32} className="text-white/10" />
            <p className="text-white/30 text-sm">No documents yet</p>
            <Link href="/dashboard/documents/new" className="text-[#369bff] text-sm hover:underline">Add your first document</Link>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.map(doc => (
              <div key={doc.id} className="px-4 py-3.5 hover:bg-white/2 transition-colors lg:grid lg:grid-cols-[2fr_80px_90px_80px_1fr_1fr_1fr_60px] lg:gap-3 lg:items-center lg:px-5">
                {/* Document name + info — always visible */}
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => openDoc(doc.id)}>
                  <div className="w-8 h-8 rounded-lg bg-[#0c7aed]/10 flex items-center justify-center shrink-0">
                    <FileCheck size={14} className="text-[#369bff]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-white/80 truncate hover:text-[#369bff] transition-colors">{doc.name}</div>
                    {doc.description && <div className="text-xs text-white/30 truncate">{doc.description}</div>}
                    {/* Mobile-only meta row */}
                    <div className="flex flex-wrap items-center gap-2 mt-1 lg:hidden">
                      <FileTypeBadge type={doc.fileType} />
                      <CategoryBadge category={doc.category} />
                      <ExpiryCell doc={doc} />
                      {doc.project?.name && <span className="text-xs text-white/40">{doc.project.name}</span>}
                      <span className="text-xs text-white/25">
                        {new Date(doc.uploadedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  {/* Mobile actions */}
                  <div className="flex items-center gap-2 lg:hidden shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); openDoc(doc.id) }}
                      className="text-white/20 hover:text-[#34d399] transition-colors" title="View document">
                      <ExternalLink size={15} />
                    </button>
                    {doc.sha256Hash && (
                      <Link href={`/verify?hash=${doc.sha256Hash}`} target="_blank"
                        className="text-white/20 hover:text-[#369bff] transition-colors" title="Verify">
                        <Shield size={15} />
                      </Link>
                    )}
                  </div>
                </div>
                {/* Desktop-only columns */}
                <div className="hidden lg:block"><FileTypeBadge type={doc.fileType} /></div>
                <div className="hidden lg:block"><CategoryBadge category={doc.category} /></div>
                <div className="hidden lg:block"><ExpiryCell doc={doc} /></div>
                <div
                  className="hidden lg:block cursor-pointer"
                  onClick={() => doc.sha256Hash && window.open(`/verify?hash=${doc.sha256Hash}`, '_blank')}
                  title="Click to verify this hash"
                >
                  {doc.sha256Hash ? <HashCell hash={doc.sha256Hash} /> : <span className="text-white/20 text-xs">Pending</span>}
                </div>
                <div className="hidden lg:block text-xs text-white/40 truncate">{doc.project?.name ?? '—'}</div>
                <div className="hidden lg:block text-xs text-white/30">
                  {new Date(doc.uploadedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                </div>
                <div className="hidden lg:flex items-center gap-2">
                  <button onClick={() => openDoc(doc.id)}
                    className="text-white/20 hover:text-[#34d399] transition-colors cursor-pointer bg-transparent border-none p-0" title="View document">
                    <ExternalLink size={13} />
                  </button>
                  {doc.sha256Hash && (
                    <Link href={`/verify?hash=${doc.sha256Hash}`} target="_blank"
                      className="text-white/20 hover:text-[#369bff] transition-colors" title="Verify on blockchain">
                      <Shield size={13} />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
