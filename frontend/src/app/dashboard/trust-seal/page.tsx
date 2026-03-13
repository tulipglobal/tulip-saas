'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { apiFetch, apiGet } from '@/lib/api'
import {
  ShieldCheck, Plus, Search, Copy, ExternalLink, X, Download,
  FileCheck, Clock, CheckCircle, QrCode, Eye
} from 'lucide-react'
import BlockchainStatusPill from '@/components/BlockchainStatusPill'
import TrustSealCard from '@/components/TrustSealCard'

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

const SOURCE_MAP: Record<string, { label: string; cls: string }> = {
  'ngo-document':     { label: 'Document', cls: 'bg-[#f6c453]/10 text-[#183a1d] border-[#f6c453]/30' },
  'expense-receipt':  { label: 'Expense',  cls: 'bg-orange-400/10 text-orange-400 border-orange-400/20' },
  'budget-agreement': { label: 'Funding',  cls: 'bg-green-400/10 text-green-400 border-green-400/20' },
  'api-document':     { label: 'API',      cls: 'bg-purple-400/10 text-purple-400 border-purple-400/20' },
  'bundle':           { label: 'Bundle',   cls: 'bg-cyan-400/10 text-cyan-400 border-cyan-400/20' },
}

function SourceBadge({ type }: { type: string }) {
  const src = SOURCE_MAP[type]
  if (src) {
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border font-medium ${src.cls}`}>{src.label}</span>
  }
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border font-medium bg-[#e1eedd] text-[#183a1d]/60 border-[#c8d6c0]">{type}</span>
}

export default function TrustSealPage() {
  const t = useTranslations('trustSealPage')
  const [seals, setSeals] = useState<Seal[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // Create modal
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
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

  // Seal card modal
  const [activeSealId, setActiveSealId] = useState<string | null>(null)

  const fetchSeals = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      params.set('limit', '200')
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
    setCreateError('')
    try {
      const formData = new FormData()
      formData.append('documentTitle', formTitle)
      formData.append('documentType', formType)
      formData.append('issuedTo', formTo)
      if (formToEmail) formData.append('issuedToEmail', formToEmail)
      if (formBy) formData.append('issuedBy', formBy)
      if (formFile) formData.append('file', formFile)
      const meta: Record<string, string> = {}
      metadataKeys.forEach((k, i) => {
        if (k.trim() && metadataVals[i]?.trim()) meta[k.trim()] = metadataVals[i].trim()
      })
      if (Object.keys(meta).length > 0) formData.append('metadata', JSON.stringify(meta))
      const token = localStorage.getItem('tulip_token')
      if (!token) { setCreateError('Not authenticated.'); setCreating(false); return }
      const apiUrl = process.env.NEXT_PUBLIC_API_URL
      if (!apiUrl) { setCreateError('API URL not configured.'); setCreating(false); return }
      const r = await fetch(`${apiUrl}/api/trust-seal/issue`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData,
      })
      if (!r.ok) {
        const errData = await r.json().catch(() => null)
        setCreateError(errData?.error || `Failed to issue seal (${r.status})`)
        setCreating(false)
        return
      }
      const seal = await r.json()
      setCreatedSeal(seal)
      setShowCreate(false)
      setCreateError('')
      setFormTitle(''); setFormType('CERTIFICATE'); setFormTo(''); setFormToEmail(''); setFormBy(''); setFormFile(null)
      setMetadataKeys(['']); setMetadataVals([''])
      fetchSeals()
    } catch (err: any) {
      setCreateError(err?.message || 'Network error')
    } finally { setCreating(false) }
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

  // Summary stats
  const totalSeals = seals.length
  const confirmed = seals.filter(s => s.anchorTxHash).length
  const pending = seals.filter(s => !s.anchorTxHash).length
  const thisMonth = seals.filter(s => {
    const d = new Date(s.createdAt)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  // Apply filters
  const filtered = seals.filter(s => {
    if (filterSource && s.documentType !== filterSource) return false
    if (filterStatus === 'confirmed' && !s.anchorTxHash) return false
    if (filterStatus === 'pending' && s.anchorTxHash) return false
    return true
  })

  const inputCls = "bg-[#e1eedd] border border-[#c8d6c0] rounded-lg px-3 py-2.5 text-sm text-[#183a1d] placeholder-[#183a1d]/40 outline-none focus:border-[#f6c453]"

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#183a1d]" style={{ fontFamily: 'Inter, sans-serif' }}>{t('title')}</h1>
          <p className="text-sm text-[#183a1d]/60 mt-1">{t('subtitle')}</p>
        </div>
        <button onClick={() => { setShowCreate(true); setCreateError('') }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-[#183a1d] transition-all hover:opacity-90 bg-[#f6c453] hover:bg-[#f0a04b]">
          <Plus size={16} /> {t('issueNewSeal')}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t('totalSeals'), value: totalSeals, color: 'text-[#183a1d]' },
          { label: t('confirmed'), value: confirmed, color: 'text-green-400' },
          { label: t('pending'), value: pending, color: 'text-yellow-400' },
          { label: t('thisMonth'), value: thisMonth, color: 'text-cyan-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-[#c8d6c0] px-5 py-4" style={{ background: '#e1eedd' }}>
            <div className={`text-xl font-bold ${color}`} style={{ fontFamily: 'Inter, sans-serif' }}>{value}</div>
            <div className="text-xs text-[#183a1d]/60 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-[#e1eedd] border border-[#c8d6c0] rounded-lg px-3 py-2 max-w-xs flex-1 min-w-[200px]">
          <Search size={14} className="text-[#183a1d]/40" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('searchSeals')}
            className="bg-transparent text-sm text-[#183a1d] placeholder-[#183a1d]/40 outline-none w-full" />
        </div>
        <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
          className={`${inputCls} min-w-[140px] [&>option]:bg-[#e1eedd]`}>
          <option value="">{t('allSources')}</option>
          {Object.entries(SOURCE_MAP).map(([key, { label }]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className={`${inputCls} min-w-[130px] [&>option]:bg-[#e1eedd]`}>
          <option value="">{t('allStatus')}</option>
          <option value="confirmed">{t('confirmed')}</option>
          <option value="pending">{t('pending')}</option>
        </select>
      </div>

      {/* Seals table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#f6c453] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <ShieldCheck size={48} className="mx-auto text-[#183a1d]/30 mb-4" />
          <h3 className="text-lg font-semibold text-[#183a1d]/70">{t('noSealsFound')}</h3>
          <p className="text-sm text-[#183a1d]/40 mt-1">{t('noSealsDesc')}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#c8d6c0] overflow-hidden" style={{ background: '#e1eedd' }}>
          <div className="hidden lg:grid grid-cols-[2fr_80px_1fr_1fr_80px_80px_60px] gap-3 px-5 py-3 border-b border-[#c8d6c0] text-xs text-[#183a1d]/40 uppercase tracking-wide font-medium">
            <span>{t('document')}</span><span>{t('source')}</span><span>{t('issuedBy')}</span><span>{t('date')}</span><span>{t('seal')}</span><span>{t('tx')}</span><span></span>
          </div>
          <div className="divide-y divide-[#c8d6c0]">
            {filtered.map(seal => (
              <div key={seal.id} className="px-5 py-3.5 hover:bg-[#e1eedd]/50 transition-colors lg:grid lg:grid-cols-[2fr_80px_1fr_1fr_80px_80px_60px] lg:gap-3 lg:items-center">
                <div>
                  <div className="text-sm font-medium text-[#183a1d] truncate">{seal.documentTitle}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-[#183a1d]/40">{t('to')}{seal.issuedTo}</span>
                    {/* Mobile meta */}
                    <span className="lg:hidden"><SourceBadge type={seal.documentType} /></span>
                  </div>
                </div>
                <div className="hidden lg:block"><SourceBadge type={seal.documentType} /></div>
                <div className="hidden lg:block text-xs text-[#183a1d]/60 truncate">{seal.issuedBy}</div>
                <div className="hidden lg:block text-xs text-[#183a1d]/40">
                  {new Date(seal.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="hidden lg:block">
                  <BlockchainStatusPill
                    sealId={seal.id}
                    anchorStatus={seal.anchorTxHash ? 'confirmed' : 'pending'}
                    txHash={seal.anchorTxHash}
                    onClick={() => setActiveSealId(seal.id)}
                  />
                </div>
                <div className="hidden lg:block">
                  {seal.anchorTxHash ? (
                    <a href={`https://polygonscan.com/tx/${seal.anchorTxHash}`} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 font-mono flex items-center gap-0.5">
                      {seal.anchorTxHash.slice(0, 8)}… <ExternalLink size={9} />
                    </a>
                  ) : (
                    <span className="text-xs text-[#183a1d]/30">—</span>
                  )}
                </div>
                <div className="hidden lg:flex items-center gap-1">
                  <button onClick={() => setActiveSealId(seal.id)}
                    className="w-7 h-7 rounded-lg bg-[#e1eedd] flex items-center justify-center text-[#183a1d]/40 hover:text-[#183a1d] hover:bg-[#e1eedd] transition-all"
                    title="View seal">
                    <Eye size={13} />
                  </button>
                  <button onClick={() => copyUrl(seal.id)}
                    className="w-7 h-7 rounded-lg bg-[#e1eedd] flex items-center justify-center text-[#183a1d]/40 hover:text-[#183a1d] hover:bg-[#e1eedd] transition-all"
                    title="Copy verify URL">
                    <Copy size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TrustSealCard modal */}
      {activeSealId && (
        <TrustSealCard sealId={activeSealId} onClose={() => setActiveSealId(null)} />
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-[#e1eedd] border border-[#c8d6c0] rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-[#c8d6c0]">
              <h3 className="font-semibold text-[#183a1d] text-lg">{t('issueNewTrustSeal')}</h3>
              <button onClick={() => setShowCreate(false)} className="text-[#183a1d]/60 hover:text-[#183a1d]"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              {createError && (
                <div className="p-3 rounded-lg bg-red-400/10 border border-red-400/20 text-red-400 text-sm">{createError}</div>
              )}
              <div>
                <label className="text-xs font-medium text-[#183a1d]/70 mb-1.5 block">{t('documentTitle')}</label>
                <input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="e.g. Bachelor of Science Degree" className={`w-full ${inputCls}`} />
              </div>
              <div>
                <label className="text-xs font-medium text-[#183a1d]/70 mb-1.5 block">{t('documentType')}</label>
                <select value={formType} onChange={e => setFormType(e.target.value)} className={`w-full ${inputCls} [&>option]:bg-[#e1eedd]`}>
                  {TYPE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[#183a1d]/70 mb-1.5 block">{t('issuedTo')}</label>
                <input value={formTo} onChange={e => setFormTo(e.target.value)} placeholder="Recipient full name" className={`w-full ${inputCls}`} />
              </div>
              <div>
                <label className="text-xs font-medium text-[#183a1d]/70 mb-1.5 block">{t('recipientEmail')}</label>
                <input value={formToEmail} onChange={e => setFormToEmail(e.target.value)} placeholder="recipient@example.com" type="email" className={`w-full ${inputCls}`} />
              </div>
              <div>
                <label className="text-xs font-medium text-[#183a1d]/70 mb-1.5 block">{t('issuedByOrg')}</label>
                <input value={formBy} onChange={e => setFormBy(e.target.value)} placeholder="Leave blank to use your org name" className={`w-full ${inputCls}`} />
              </div>
              <div>
                <label className="text-xs font-medium text-[#183a1d]/70 mb-1.5 block">{t('uploadDocumentToHash')}</label>
                <div className="border border-dashed border-[#c8d6c0] rounded-lg p-4 text-center">
                  <input type="file" onChange={e => setFormFile(e.target.files?.[0] || null)} className="hidden" id="seal-file" />
                  <label htmlFor="seal-file" className="cursor-pointer">
                    {formFile ? <div className="text-sm text-[#183a1d]">{formFile.name}</div> : <div className="text-sm text-[#183a1d]/40">{t('clickToSelect')}</div>}
                  </label>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-[#183a1d]/70">{t('customMetadata')}</label>
                  <button onClick={addMetadataRow} className="text-[10px] text-[#183a1d] hover:underline">{t('addField')}</button>
                </div>
                <div className="space-y-2">
                  {metadataKeys.map((key, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input value={key} onChange={e => { const k = [...metadataKeys]; k[idx] = e.target.value; setMetadataKeys(k) }}
                        placeholder="Key" className={`flex-1 ${inputCls} !text-xs !py-2`} />
                      <input value={metadataVals[idx]} onChange={e => { const v = [...metadataVals]; v[idx] = e.target.value; setMetadataVals(v) }}
                        placeholder="Value" className={`flex-1 ${inputCls} !text-xs !py-2`} />
                      {metadataKeys.length > 1 && (
                        <button onClick={() => removeMetadataRow(idx)} className="text-[#183a1d]/30 hover:text-red-400"><X size={14} /></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-[#c8d6c0]">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm text-[#183a1d]/70 hover:text-[#183a1d] transition-colors">{t('cancel')}</button>
              <button onClick={handleCreate} disabled={creating || !formTitle.trim() || !formTo.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[#183a1d] disabled:opacity-40 transition-all hover:opacity-90 bg-[#f6c453] hover:bg-[#f0a04b]">
                {creating && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {creating ? t('issuing') : t('issueSeal')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {createdSeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setCreatedSeal(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-[#e1eedd] border border-[#c8d6c0] rounded-xl w-full max-w-md text-center" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="w-14 h-14 rounded-full bg-green-400/15 flex items-center justify-center mx-auto mb-4">
                <ShieldCheck size={28} className="text-green-400" />
              </div>
              <h3 className="text-lg font-bold text-[#183a1d] mb-1">{t('trustSealIssued')}</h3>
              <p className="text-sm text-[#183a1d]/60 mb-5">{createdSeal.documentTitle}</p>
              {(createdSeal.qrCode || createdSeal.qrCodeUrl) && (
                <div className="bg-white rounded-xl p-4 inline-block mb-4">
                  <img src={createdSeal.qrCode || createdSeal.qrCodeUrl!} alt="QR Code" className="w-48 h-48 mx-auto" />
                </div>
              )}
              <div className="space-y-3 mb-5">
                <div className="flex items-center gap-2 bg-[#e1eedd] rounded-lg px-3 py-2.5">
                  <code className="text-xs text-[#183a1d]/70 truncate flex-1">{createdSeal.verifyUrl || `https://verify.tulipds.com/seal/${createdSeal.id}`}</code>
                  <button onClick={() => copyUrl(createdSeal.id)} className="text-[#183a1d] hover:underline text-xs shrink-0">
                    {copied ? t('copied') : t('copy')}
                  </button>
                </div>
                <div className="text-xs text-[#183a1d]/40 font-mono break-all">SHA-256: {createdSeal.rawHash}</div>
              </div>
              <div className="flex gap-3 justify-center">
                {(createdSeal.qrCode || createdSeal.qrCodeUrl) && (
                  <button onClick={() => downloadQR(createdSeal.qrCode || createdSeal.qrCodeUrl!, createdSeal.documentTitle)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#e1eedd] text-[#183a1d] hover:bg-[#e1eedd] transition-all text-sm">
                    <Download size={14} /> {t('downloadQr')}
                  </button>
                )}
                <button onClick={() => setCreatedSeal(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-[#183a1d] transition-all hover:opacity-90 bg-[#f6c453] hover:bg-[#f0a04b]">
                  {t('done')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
