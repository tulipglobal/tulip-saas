'use client'
import { apiGet } from '@/lib/api'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { FileCheck, Plus, Search, ExternalLink, Copy, Check, Shield } from 'lucide-react'

interface Document {
  id: string
  name: string
  description: string | null
  documentType: string | null
  documentLevel: string
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
    <div className="p-6 space-y-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Documents</h1>
          <p className="text-white/40 text-sm mt-1">{docs.length} document{docs.length !== 1 ? 's' : ''} — SHA-256 fingerprinted</p>
        </div>
        <Link href="/dashboard/documents/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
          <Plus size={16} /> Add Document
        </Link>
      </div>

      <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 max-w-sm">
        <Search size={15} className="text-white/30" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search documents..." className="bg-transparent text-sm text-white/70 placeholder-white/30 outline-none w-full" />
      </div>

      <div className="rounded-xl border border-white/8 overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="grid grid-cols-[2fr_80px_1fr_1fr_1fr_60px] gap-4 px-5 py-3 border-b border-white/8 text-xs text-white/30 uppercase tracking-wide font-medium">
          <span>Document</span><span>Type</span><span>Hash</span><span>Project</span><span>Date</span><span>Actions</span>
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
              <div key={doc.id} className="grid grid-cols-[2fr_80px_1fr_1fr_1fr_60px] gap-4 items-center px-5 py-3.5 hover:bg-white/2 transition-colors">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => openDoc(doc.id)}>
                  <div className="w-8 h-8 rounded-lg bg-[#0c7aed]/10 flex items-center justify-center shrink-0">
                    <FileCheck size={14} className="text-[#369bff]" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white/80 truncate hover:text-[#369bff] transition-colors">{doc.name}</div>
                    {doc.description && <div className="text-xs text-white/30 truncate">{doc.description}</div>}
                    {doc.fileSize && <div className="text-xs text-white/20">{(doc.fileSize / 1024).toFixed(1)} KB</div>}
                  </div>
                </div>
                <FileTypeBadge type={doc.fileType} />
                <div
                  className="cursor-pointer"
                  onClick={() => doc.sha256Hash && window.open(`/verify?hash=${doc.sha256Hash}`, '_blank')}
                  title="Click to verify this hash"
                >
                  {doc.sha256Hash ? <HashCell hash={doc.sha256Hash} /> : <span className="text-white/20 text-xs">Pending</span>}
                </div>
                <div className="text-xs text-white/40 truncate">{doc.project?.name ?? '—'}</div>
                <div className="text-xs text-white/30">
                  {new Date(doc.uploadedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                </div>
                <div className="flex items-center gap-2">
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
