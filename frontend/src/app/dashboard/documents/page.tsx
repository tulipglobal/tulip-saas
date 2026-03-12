'use client'
import { apiGet, apiPost } from '@/lib/api'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { FileCheck, Plus, Search, ExternalLink, Copy, Check, Shield, AlertTriangle, Users } from 'lucide-react'
import BlockchainStatusPill from '@/components/BlockchainStatusPill'
import TrustSealCard from '@/components/TrustSealCard'

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
  approvalStatus?: string
  project?: { id: string; name: string }
  expense?: { id: string; description: string; amount: number; currency: string } | null
}

function ApprovalBadge({ status }: { status?: string }) {
  if (!status || status === 'approved') return null
  const map: Record<string, string> = {
    pending_review: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
    rejected: 'bg-red-400/10 text-red-400 border-red-400/20',
  }
  const labels: Record<string, string> = {
    pending_review: 'Pending Review', rejected: 'Rejected',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border font-medium ${map[status] ?? 'bg-[#e1eedd] text-[#183a1d]/60 border-[#c8d6c0]'}`}>
      {labels[status] ?? status}
    </span>
  )
}

function HashCell({ hash }: { hash: string }) {
  const [copied, setCopied] = useState(false)
  const copy = (e: React.MouseEvent) => { e.stopPropagation(); navigator.clipboard.writeText(hash); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  return (
    <div className="flex items-center gap-1.5 group">
      <span className="hash-mono text-[#183a1d]/40" style={{ fontSize: 11 }}>{hash.slice(0, 10)}…{hash.slice(-6)}</span>
      <button onClick={copy} className="opacity-0 group-hover:opacity-100 transition-opacity">
        {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} className="text-[#183a1d]/40" />}
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
    return <span className="text-[#183a1d]/30 text-xs">—</span>
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
  return <span className="text-[#183a1d]/60 text-xs">{formatted}</span>
}

function FileTypeBadge({ type }: { type: string | null }) {
  const t = (type ?? 'file').toLowerCase()
  const map: Record<string, string> = {
    pdf: 'bg-red-400/10 text-red-400', docx: 'bg-[#f6c453]/10 text-[#183a1d]',
    xlsx: 'bg-green-400/10 text-green-400', jpg: 'bg-orange-400/10 text-orange-400',
    png: 'bg-orange-400/10 text-orange-400', csv: 'bg-teal-400/10 text-teal-400',
  }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-mono font-medium uppercase ${map[t] ?? 'bg-[#e1eedd] text-[#183a1d]/60'}`}>
      {t}
    </span>
  )
}

function SealPill({ hash, sealMap, onOpen }: { hash: string | null; sealMap: Record<string, { sealId: string; anchorStatus: string; txHash: string | null }>; onOpen: (id: string) => void }) {
  if (hash && sealMap[hash]) {
    const s = sealMap[hash]
    return <BlockchainStatusPill sealId={s.sealId} anchorStatus={s.anchorStatus} txHash={s.txHash} onClick={() => onOpen(s.sealId)} />
  }
  return <BlockchainStatusPill onClick={() => {}} />
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sealMap, setSealMap] = useState<Record<string, { sealId: string; anchorStatus: string; txHash: string | null }>>({})
  const [activeSealId, setActiveSealId] = useState<string | null>(null)

  useEffect(() => {
    apiGet('/api/documents?limit=100')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(d => {
        const items = d.data ?? d.items ?? []
        setDocs(items)
        setLoading(false)
        // Resolve hashes to seals
        const hashes = items.map((doc: Document) => doc.sha256Hash).filter(Boolean)
        if (hashes.length > 0) {
          apiPost('/api/trust-seal/resolve', { hashes })
            .then(r => r.ok ? r.json() : {})
            .then(map => setSealMap(map))
            .catch(() => {})
        }
      })
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
          <h1 className="text-2xl font-bold text-[#183a1d]" style={{ fontFamily: 'Inter, sans-serif' }}>Documents</h1>
          <p className="text-[#183a1d]/60 text-sm mt-1">{docs.length} document{docs.length !== 1 ? 's' : ''} — SHA-256 fingerprinted</p>
        </div>
        <Link href="/dashboard/documents/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[#183a1d] self-start bg-[#f6c453] hover:bg-[#f0a04b]">
          <Plus size={16} /> Add Document
        </Link>
      </div>

      {/* Donor sharing info banner */}
      <div className="rounded-xl border p-3.5 flex items-center gap-3"
        style={{ background: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.15)' }}>
        <Users size={16} className="text-emerald-400 shrink-0" />
        <p className="text-[#183a1d]/60 text-xs">All documents are automatically visible to your linked donors via the Donor Portal</p>
      </div>

      <div className="flex items-center gap-3 bg-[#e1eedd] border border-[#c8d6c0] rounded-lg px-4 py-2.5 max-w-sm">
        <Search size={15} className="text-[#183a1d]/40" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search documents..." className="bg-transparent text-sm text-[#183a1d] placeholder-[#183a1d]/40 outline-none w-full" />
      </div>

      <div className="rounded-xl border border-[#c8d6c0] overflow-hidden"
        style={{ background: '#e1eedd' }}>
        {/* Desktop table header */}
        <div className="hidden lg:grid grid-cols-[2fr_70px_80px_70px_1fr_80px_1fr_80px_40px] gap-3 px-5 py-3 border-b border-[#c8d6c0] text-xs text-[#183a1d]/40 uppercase tracking-wide font-medium">
          <span>Document</span><span>Type</span><span>Category</span><span>Expiry</span><span>Hash</span><span>Seal</span><span>Project</span><span>Date</span><span></span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-[#183a1d]/40 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <FileCheck size={32} className="text-[#183a1d]/30" />
            <p className="text-[#183a1d]/40 text-sm">No documents yet</p>
            <Link href="/dashboard/documents/new" className="text-[#183a1d] text-sm hover:underline">Add your first document</Link>
          </div>
        ) : (
          <div className="divide-y divide-[#c8d6c0]">
            {filtered.map(doc => (
              <div key={doc.id} className="px-4 py-3.5 hover:bg-[#e1eedd]/50 transition-colors lg:grid lg:grid-cols-[2fr_70px_80px_70px_1fr_80px_1fr_80px_40px] lg:gap-3 lg:items-center lg:px-5">
                {/* Document name + info — always visible */}
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => openDoc(doc.id)}>
                  <div className="w-8 h-8 rounded-lg bg-[#f6c453]/10 flex items-center justify-center shrink-0">
                    <FileCheck size={14} className="text-[#183a1d]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#183a1d] truncate hover:text-[#183a1d] transition-colors">{doc.name}</span>
                      <span className="hidden lg:inline-flex"><ApprovalBadge status={doc.approvalStatus} /></span>
                    </div>
                    {doc.description && <div className="text-xs text-[#183a1d]/40 truncate">{doc.description}</div>}
                    {/* Mobile-only meta row */}
                    <div className="flex flex-wrap items-center gap-2 mt-1 lg:hidden">
                      <FileTypeBadge type={doc.fileType} />
                      <ApprovalBadge status={doc.approvalStatus} />
                      <CategoryBadge category={doc.category} />
                      <ExpiryCell doc={doc} />
                      {doc.project?.name && <span className="text-xs text-[#183a1d]/60">{doc.project.name}</span>}
                      <span className="text-xs text-[#183a1d]/40">
                        {new Date(doc.uploadedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  {/* Mobile actions */}
                  <div className="flex items-center gap-2 lg:hidden shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); openDoc(doc.id) }}
                      className="text-[#183a1d]/30 hover:text-[#34d399] transition-colors" title="View document">
                      <ExternalLink size={15} />
                    </button>
                    {doc.sha256Hash && (
                      <Link href={`/verify?hash=${doc.sha256Hash}`} target="_blank"
                        className="text-[#183a1d]/30 hover:text-[#183a1d] transition-colors" title="Verify">
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
                  {doc.sha256Hash ? <HashCell hash={doc.sha256Hash} /> : <span className="text-[#183a1d]/30 text-xs">Pending</span>}
                </div>
                <div className="hidden lg:block" onClick={e => e.stopPropagation()}>
                  <SealPill hash={doc.sha256Hash} sealMap={sealMap} onOpen={setActiveSealId} />
                </div>
                <div className="hidden lg:block text-xs text-[#183a1d]/60 truncate">{doc.project?.name ?? '—'}</div>
                <div className="hidden lg:block text-xs text-[#183a1d]/40">
                  {new Date(doc.uploadedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                </div>
                <div className="hidden lg:flex items-center gap-2">
                  <button onClick={() => openDoc(doc.id)}
                    className="text-[#183a1d]/30 hover:text-[#34d399] transition-colors cursor-pointer bg-transparent border-none p-0" title="View document">
                    <ExternalLink size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {activeSealId && (
        <TrustSealCard sealId={activeSealId} onClose={() => setActiveSealId(null)} />
      )}
    </div>
  )
}
