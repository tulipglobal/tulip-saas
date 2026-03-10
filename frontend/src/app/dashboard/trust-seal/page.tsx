'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiFetch, apiGet } from '@/lib/api'
import {
  ShieldCheck, Plus, Search, Copy, ExternalLink, X, Download,
  FileCheck, Clock, CheckCircle, QrCode
} from 'lucide-react'

interface Seal {
  id: string
  documentTitle: string
  documentType: string
  issuedTo: string
  issuedToEmail: string | null
  issuedBy: string
  metadata: any
  rawHash: string
  anchorTxHash: string | null
  anchoredAt: string | null
  blockNumber: number | null
  qrCodeUrl: string | null
  status: string
  createdAt: string
}

const TYPE_OPTIONS = [
  'CERTIFICATE', 'DIPLOMA', 'LICENSE', 'PERMIT', 'CONTRACT',
  'INVOICE', 'RECEIPT', 'REPORT', 'LETTER', 'OTHER'
]

export default function TrustSealPage() {
  const [seals, setSeals] = useState<Seal[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Create modal
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formType, setFormType] = useState('CERTIFICATE')
  const [formTo, setFormTo] = useState('')
  const [formToEmail, setFormToEmail] = useState('')
  const [formBy, setFormBy] = useState('')
  const [formFile, setFormFile] = useState<File | null>(null)
  const [metadataKeys, setMetadataKeys] = useState<string[]>([''])
  const [metadataVals, setMetadataVals] = useState<string[]>([''])

  // Success modal
  const [createdSeal, setCreatedSeal] = useState<(Seal & { verifyUrl?: string; qrCode?: string }) | null>(null)
  const [copied, setCopied] = useState(false)

  const fetchSeals = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const r = await apiGet(`/api/trust-seal?${params.toString()}`)
      if (r.ok) {
        const d = await r.json()
        setSeals(d.data || [])
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { fetchSeals() }, [fetchSeals])

  const addMetadataRow = () => {
    setMetadataKeys([...metadataKeys, ''])
    setMetadataVals([...metadataVals, ''])
  }

  const removeMetadataRow = (idx: number) => {
    setMetadataKeys(metadataKeys.filter((_, i) => i !== idx))
    setMetadataVals(metadataVals.filter((_, i) => i !== idx))
  }

  const handleCreate = async () => {
    if (!formTitle.trim() || !formTo.trim()) return
    setCreating(true)
    try {
      const formData = new FormData()
      formData.append('documentTitle', formTitle)
      formData.append('documentType', formType)
      formData.append('issuedTo', formTo)
      if (formToEmail) formData.append('issuedToEmail', formToEmail)
      if (formBy) formData.append('issuedBy', formBy)
      if (formFile) formData.append('file', formFile)

      // Build metadata object
      const meta: Record<string, string> = {}
      metadataKeys.forEach((k, i) => {
        if (k.trim() && metadataVals[i]?.trim()) meta[k.trim()] = metadataVals[i].trim()
      })
      if (Object.keys(meta).length > 0) formData.append('metadata', JSON.stringify(meta))

      const token = localStorage.getItem('tulip_token')
      const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/trust-seal/issue`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      })
      if (r.ok) {
        const seal = await r.json()
        setCreatedSeal(seal)
        setShowCreate(false)
        setFormTitle('')
        setFormType('CERTIFICATE')
        setFormTo('')
        setFormToEmail('')
        setFormBy('')
        setFormFile(null)
        setMetadataKeys([''])
        setMetadataVals([''])
        fetchSeals()
      }
    } catch {
    } finally {
      setCreating(false)
    }
  }

  const copyUrl = (id: string) => {
    navigator.clipboard.writeText(`https://verify.tulipds.com/seal/${id}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadQR = (qrDataUrl: string, title: string) => {
    const a = document.createElement('a')
    a.href = qrDataUrl
    a.download = `seal-${title.replace(/\s+/g, '-').toLowerCase()}-qr.png`
    a.click()
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Trust Seal</h1>
          <p className="text-sm text-white/50 mt-1">Issue tamper-proof digital seals with QR codes for instant verification</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
          <Plus size={16} /> Issue New Seal
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 max-w-md">
        <Search size={14} className="text-white/30" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search seals..."
          className="bg-transparent text-sm text-white/80 placeholder-white/30 outline-none w-full" />
      </div>

      {/* Seals List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#0c7aed] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : seals.length === 0 ? (
        <div className="text-center py-20">
          <ShieldCheck size={48} className="mx-auto text-white/10 mb-4" />
          <h3 className="text-lg font-semibold text-white/60">No seals issued yet</h3>
          <p className="text-sm text-white/30 mt-1">Issue your first trust seal to make a document tamper-proof</p>
        </div>
      ) : (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl divide-y divide-white/[0.06]">
          {seals.map(seal => (
            <div key={seal.id} className="p-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">
              {/* QR thumbnail */}
              <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center shrink-0 overflow-hidden">
                {seal.qrCodeUrl ? (
                  <img src={seal.qrCodeUrl} alt="QR" className="w-full h-full object-contain" />
                ) : (
                  <QrCode size={20} className="text-white/20" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">{seal.documentTitle}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-white/40">To: {seal.issuedTo}</span>
                  <span className="text-xs text-white/20">|</span>
                  <span className="text-xs text-white/40">{seal.documentType}</span>
                </div>
              </div>

              {/* Anchor status */}
              <div className="hidden sm:flex items-center gap-1.5">
                {seal.anchorTxHash ? (
                  <a href={`https://polygonscan.com/tx/${seal.anchorTxHash}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-green-400 hover:underline">
                    <CheckCircle size={12} /> Anchored
                  </a>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-yellow-400/60">
                    <Clock size={12} /> Pending
                  </span>
                )}
              </div>

              {/* Date */}
              <div className="hidden md:block text-xs text-white/30">
                {new Date(seal.createdAt).toLocaleDateString()}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <button onClick={() => copyUrl(seal.id)}
                  className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-all"
                  title="Copy verify URL">
                  <Copy size={14} />
                </button>
                {seal.qrCodeUrl && (
                  <button onClick={() => downloadQR(seal.qrCodeUrl!, seal.documentTitle)}
                    className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-all"
                    title="Download QR code">
                    <Download size={14} />
                  </button>
                )}
                <a href={`https://verify.tulipds.com/seal/${seal.id}`} target="_blank" rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-all"
                  title="Preview seal page">
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-[#0a1929] border border-white/10 rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
              <h3 className="font-semibold text-white text-lg">Issue New Trust Seal</h3>
              <button onClick={() => setShowCreate(false)} className="text-white/40 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-white/60 mb-1.5 block">Document Title *</label>
                <input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="e.g. Bachelor of Science Degree"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#0c7aed]/50" />
              </div>
              <div>
                <label className="text-xs font-medium text-white/60 mb-1.5 block">Document Type</label>
                <select value={formType} onChange={e => setFormType(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-[#0c7aed]/50">
                  {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-white/60 mb-1.5 block">Issued To *</label>
                <input value={formTo} onChange={e => setFormTo(e.target.value)} placeholder="Recipient full name"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#0c7aed]/50" />
              </div>
              <div>
                <label className="text-xs font-medium text-white/60 mb-1.5 block">Recipient Email</label>
                <input value={formToEmail} onChange={e => setFormToEmail(e.target.value)} placeholder="recipient@example.com" type="email"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#0c7aed]/50" />
              </div>
              <div>
                <label className="text-xs font-medium text-white/60 mb-1.5 block">Issued By (org name)</label>
                <input value={formBy} onChange={e => setFormBy(e.target.value)} placeholder="Leave blank to use your org name"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#0c7aed]/50" />
              </div>
              <div>
                <label className="text-xs font-medium text-white/60 mb-1.5 block">Upload Document (to hash)</label>
                <div className="border border-dashed border-white/10 rounded-lg p-4 text-center">
                  <input type="file" onChange={e => setFormFile(e.target.files?.[0] || null)} className="hidden" id="seal-file" />
                  <label htmlFor="seal-file" className="cursor-pointer">
                    {formFile ? (
                      <div className="text-sm text-white/70">{formFile.name}</div>
                    ) : (
                      <div className="text-sm text-white/30">Click to select a file</div>
                    )}
                  </label>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-white/60">Custom Metadata</label>
                  <button onClick={addMetadataRow} className="text-[10px] text-[#369bff] hover:underline">+ Add field</button>
                </div>
                <div className="space-y-2">
                  {metadataKeys.map((key, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input value={key} onChange={e => { const k = [...metadataKeys]; k[idx] = e.target.value; setMetadataKeys(k) }}
                        placeholder="Key" className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 outline-none" />
                      <input value={metadataVals[idx]} onChange={e => { const v = [...metadataVals]; v[idx] = e.target.value; setMetadataVals(v) }}
                        placeholder="Value" className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 outline-none" />
                      {metadataKeys.length > 1 && (
                        <button onClick={() => removeMetadataRow(idx)} className="text-white/20 hover:text-red-400"><X size={14} /></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-white/[0.06]">
              <button onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-lg text-sm text-white/60 hover:text-white transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={creating || !formTitle.trim() || !formTo.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40 transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
                {creating ? 'Issuing...' : 'Issue Seal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal — show QR code */}
      {createdSeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setCreatedSeal(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-[#0a1929] border border-white/10 rounded-xl w-full max-w-md text-center" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="w-14 h-14 rounded-full bg-green-400/15 flex items-center justify-center mx-auto mb-4">
                <ShieldCheck size={28} className="text-green-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Trust Seal Issued</h3>
              <p className="text-sm text-white/50 mb-5">{createdSeal.documentTitle}</p>

              {/* QR Code */}
              {(createdSeal.qrCode || createdSeal.qrCodeUrl) && (
                <div className="bg-white rounded-xl p-4 inline-block mb-4">
                  <img src={createdSeal.qrCode || createdSeal.qrCodeUrl!} alt="QR Code" className="w-48 h-48 mx-auto" />
                </div>
              )}

              <div className="space-y-3 mb-5">
                <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2.5">
                  <code className="text-xs text-white/60 truncate flex-1">{createdSeal.verifyUrl || `https://verify.tulipds.com/seal/${createdSeal.id}`}</code>
                  <button onClick={() => copyUrl(createdSeal.id)} className="text-[#369bff] hover:underline text-xs shrink-0">
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="text-xs text-white/30 font-mono break-all">
                  SHA-256: {createdSeal.rawHash}
                </div>
              </div>

              <div className="flex gap-3 justify-center">
                {(createdSeal.qrCode || createdSeal.qrCodeUrl) && (
                  <button onClick={() => downloadQR(createdSeal.qrCode || createdSeal.qrCodeUrl!, createdSeal.documentTitle)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 transition-all text-sm">
                    <Download size={14} /> Download QR
                  </button>
                )}
                <button onClick={() => setCreatedSeal(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
