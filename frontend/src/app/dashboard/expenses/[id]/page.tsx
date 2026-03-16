'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { apiGet } from '@/lib/api'
import {
  ArrowLeft, DollarSign, FileText, FolderOpen, Upload,
  CheckCircle, Clock, XCircle, ExternalLink, Calendar, Hash, Copy, Check, AlertTriangle
} from 'lucide-react'

interface Expense {
  id: string
  description: string
  amount: number
  currency: string
  projectId: string
  fundingSourceId: string | null
  createdAt: string
  dataHash?: string
  anchorStatus?: string
  blockchainTx?: string
  project?: { id: string; name: string }
  fundingSource?: { id: string; name: string } | null
  voided?: boolean
  voidedAt?: string
  voidedReason?: string
  voidedBy?: string
  documents?: Doc[]
  fraudRiskScore?: number | null
  fraudRiskLevel?: string | null
  fraudSignals?: string[] | null
  amountMismatch?: boolean
  vendorMismatch?: boolean
  dateMismatch?: boolean
  mismatchNote?: string | null
  ocrAmount?: number | null
  ocrVendor?: string | null
  ocrDate?: string | null
  approvalStatus?: string | null
}

interface Doc {
  id: string
  name: string
  sha256Hash: string | null
  fileType: string | null
  fileSize: number | null
  uploadedAt: string
}

function HashCell({ hash }: { hash: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => { navigator.clipboard.writeText(hash); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  return (
    <div className="flex items-center gap-1.5 group">
      <span className="text-xs font-mono text-[var(--tulip-forest)]/40">{hash.slice(0, 12)}…{hash.slice(-6)}</span>
      <button onClick={copy} className="opacity-0 group-hover:opacity-100 transition-opacity">
        {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} className="text-[var(--tulip-forest)]/40" />}
      </button>
    </div>
  )
}

function formatBytes(bytes: number | null) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function ExpenseDetailPage() {
  const t = useTranslations()
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [expense, setExpense] = useState<Expense | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState('')

  const anchorBadge = (status: string) => {
    switch (status) {
      case 'confirmed': return <span className="flex items-center gap-1 text-emerald-400 text-xs"><CheckCircle size={12} /> {t('expenseDetail.confirmed')}</span>
      case 'pending':   return <span className="flex items-center gap-1 text-yellow-400 text-xs"><Clock size={12} /> {t('expenseDetail.pending')}</span>
      case 'failed':    return <span className="flex items-center gap-1 text-red-400 text-xs"><XCircle size={12} /> {t('expenseDetail.failed')}</span>
      default:          return <span className="flex items-center gap-1 text-[var(--tulip-forest)]/40 text-xs"><Clock size={12} /> —</span>
    }
  }

  const loadExpense = () => {
    if (!id) return
    apiGet(`/api/expenses/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) { setError(t('expenseDetail.expenseNotFound')); setLoading(false); return }
        setExpense(data)
        setLoading(false)
      })
      .catch(() => { setError(t('expenseDetail.failedToLoad')); setLoading(false) })
  }

  useEffect(() => { loadExpense() }, [id])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !expense) return

    setUploading(true)
    setUploadSuccess('')
    try {
      const token = localStorage.getItem('tulip_token')
      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', file.name)
      formData.append('description', `Document for expense: ${expense.description}`)
      formData.append('documentType', 'receipt')
      formData.append('documentLevel', 'expense')
      formData.append('projectId', expense.projectId)
      formData.append('expenseId', expense.id)

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/documents/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (res.ok) {
        setUploadSuccess(file.name)
        // Reload expense to get updated documents
        setLoading(true)
        loadExpense()
      }
    } catch {}
    setUploading(false)
    e.target.value = ''
  }

  const openDoc = async (docId: string) => {
    const token = localStorage.getItem('tulip_token')
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/documents/${docId}/view`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const data = await res.json()
    if (data.url) window.open(data.url, '_blank')
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--tulip-cream)]">
      <div className="w-8 h-8 border-2 border-[var(--tulip-gold)] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (error || !expense) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--tulip-cream)] text-[var(--tulip-forest)]/70 gap-4">
      <DollarSign size={48} className="text-[var(--tulip-forest)]/30" />
      <p>{error || t('expenseDetail.expenseNotFound')}</p>
      <Link href="/dashboard/expenses" className="text-[var(--tulip-forest)] hover:text-[var(--tulip-gold)] text-sm">{'\u2190'} {t('expenseDetail.backToExpenses')}</Link>
    </div>
  )

  const docs = expense.documents ?? []

  return (
    <div className="min-h-screen bg-[var(--tulip-cream)] text-[var(--tulip-forest)] p-6 max-w-5xl mx-auto">

      {/* Back */}
      <Link href="/dashboard/expenses" className="inline-flex items-center gap-2 text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)] text-sm mb-6 transition-colors">
        <ArrowLeft size={14} /> {t('expenseDetail.backToExpenses')}
      </Link>

      {/* Voided banner */}
      {expense.voided && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-5 py-4 mb-6">
          <div className="flex items-center gap-2 text-red-500 font-bold text-sm mb-1">
            <XCircle size={16} /> {t('expenseDetail.expenseVoided')}
          </div>
          <p className="text-sm text-[var(--tulip-forest)]/60">
            {t('expenseDetail.reason')}: {expense.voidedReason || t('expenseDetail.noReasonProvided')}
          </p>
          <p className="text-xs text-[var(--tulip-forest)]/40 mt-1">
            {t('expenseDetail.voidedOn', { date: expense.voidedAt ? new Date(expense.voidedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—' })}
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-[var(--tulip-gold)]/10 border border-[var(--tulip-gold)]/20 flex items-center justify-center">
            <DollarSign size={22} className="text-[var(--tulip-forest)]" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-[var(--tulip-forest)]">{expense.description}</h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {anchorBadge(expense.anchorStatus ?? '')}
              <span className="text-[var(--tulip-forest)]/40 text-xs flex items-center gap-1">
                <Calendar size={11} /> {new Date(expense.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
              {expense.blockchainTx && (
                <a href={`https://polygonscan.com/tx/${expense.blockchainTx}`} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-[var(--tulip-forest)] hover:text-[var(--tulip-gold)] flex items-center gap-1">
                  {t('expenseDetail.polygonscan')} <ExternalLink size={10} />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-xl p-4">
          <p className="text-[var(--tulip-forest)]/60 text-xs mb-1">{t('expenseDetail.amount')}</p>
          <p className="text-[var(--tulip-forest)] font-semibold text-lg">{expense.currency} {expense.amount.toLocaleString()}</p>
        </div>
        <div className="bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-xl p-4">
          <p className="text-[var(--tulip-forest)]/60 text-xs mb-1">{t('expenseDetail.project')}</p>
          {expense.project ? (
            <Link href={`/dashboard/projects/${expense.project.id}`} className="text-[var(--tulip-forest)] hover:text-[var(--tulip-gold)] font-medium text-sm flex items-center gap-1">
              <FolderOpen size={13} /> {expense.project.name}
            </Link>
          ) : (
            <p className="text-[var(--tulip-forest)]/40 text-sm">—</p>
          )}
        </div>
        <div className="bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-xl p-4">
          <p className="text-[var(--tulip-forest)]/60 text-xs mb-1">{t('expenseDetail.fundingSource')}</p>
          <p className="text-[var(--tulip-forest)] text-sm">{expense.fundingSource?.name ?? '—'}</p>
        </div>
        <div className="bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-xl p-4">
          <p className="text-[var(--tulip-forest)]/60 text-xs mb-1">{t('expenseDetail.documents')}</p>
          <p className="text-[var(--tulip-forest)] font-semibold text-lg">{docs.length}</p>
        </div>
      </div>

      {/* Data hash */}
      {expense.dataHash && (
        <div className="bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-xl p-4 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[var(--tulip-forest)]/60 text-xs mb-1 flex items-center gap-1"><Hash size={11} /> {t('expenseDetail.dataHash')}</p>
              <HashCell hash={expense.dataHash} />
            </div>
            <Link href={`/verify?hash=${expense.dataHash}`} target="_blank"
              className="text-xs text-[var(--tulip-forest)] hover:text-[var(--tulip-gold)] border border-[var(--tulip-gold)]/20 px-3 py-1.5 rounded-lg transition-colors">
              {t('expenseDetail.verify')}
            </Link>
          </div>
        </div>
      )}

      {/* Fraud flags */}
      {(() => {
        const flags: { type: 'HIGH' | 'MEDIUM' | 'LOW'; reason: string }[] = []
        if (expense.fraudSignals && expense.fraudSignals.length > 0) {
          expense.fraudSignals.forEach(s => {
            flags.push({ type: (expense.fraudRiskLevel === 'HIGH' || expense.fraudRiskLevel === 'CRITICAL') ? 'HIGH' : expense.fraudRiskLevel === 'MEDIUM' ? 'MEDIUM' : 'LOW', reason: s })
          })
        }
        if (expense.amountMismatch) flags.push({ type: 'MEDIUM', reason: t('expenseDetail.amountMismatch', { ocr: expense.ocrAmount?.toLocaleString() ?? '', logged: expense.amount.toLocaleString() }) })
        if (expense.vendorMismatch) flags.push({ type: 'LOW', reason: t('expenseDetail.vendorMismatch', { ocr: expense.ocrVendor ?? '', logged: expense.description }) })
        if (expense.dateMismatch) flags.push({ type: 'MEDIUM', reason: t('expenseDetail.dateMismatch', { ocr: expense.ocrDate ?? '' }) })
        if (flags.length === 0) return null
        return (
          <div className="space-y-2 mb-8">
            <p className="text-xs text-[var(--tulip-forest)]/50">
              {t('expenseDetail.automatedChecks')}
            </p>
            {flags.map((flag, i) => (
              <div key={i} className={`rounded-lg px-4 py-3 text-sm flex items-start gap-2 border-l-4 ${
                flag.type === 'HIGH'
                  ? 'bg-red-50 border-red-500 text-red-800'
                  : flag.type === 'MEDIUM'
                  ? 'bg-amber-50 border-amber-500 text-amber-800'
                  : 'bg-blue-50 border-blue-500 text-blue-800'
              }`}>
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium">{flag.type === 'HIGH' ? t('expenseDetail.highRisk') : flag.type === 'MEDIUM' ? t('expenseDetail.mediumRisk') : t('expenseDetail.info')}:</span>{' '}
                  {flag.reason}
                </div>
              </div>
            ))}
          </div>
        )
      })()}

      {/* Documents section */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--tulip-forest)]">{t('expenseDetail.documents')}</h2>
        <label className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
          uploading ? 'bg-[var(--tulip-sage)] text-[var(--tulip-forest)]/60' : 'text-[var(--tulip-forest)]'
        }`} style={uploading ? {} : { background: 'var(--tulip-gold)' }}>
          <Upload size={14} />
          {uploading ? t('expenseDetail.uploading') : t('expenseDetail.uploadDocument')}
          <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      {uploadSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3 mb-4 flex items-center gap-2 text-emerald-400 text-sm">
          <CheckCircle size={14} /> {t('expenseDetail.uploaded', { name: uploadSuccess })}
        </div>
      )}

      <div className="bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-xl overflow-hidden">
        {docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[var(--tulip-forest)]/40 gap-3">
            <FileText size={36} className="text-[var(--tulip-forest)]/30" />
            <p className="text-sm">{t('expenseDetail.noDocuments')}</p>
            <p className="text-xs text-[var(--tulip-forest)]/30">{t('expenseDetail.noDocumentsHint')}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--tulip-sage-dark)]">
                <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">{t('expenseDetail.docName')}</th>
                <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">{t('expenseDetail.docType')}</th>
                <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">{t('expenseDetail.docSize')}</th>
                <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">{t('expenseDetail.docHash')}</th>
                <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">{t('expenseDetail.docDate')}</th>
                <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {docs.map((doc, i) => (
                <tr key={doc.id} className={`border-b border-[var(--tulip-sage-dark)] hover:bg-[var(--tulip-sage)]/50 transition-colors ${i % 2 === 0 ? '' : 'bg-[var(--tulip-sage)]'}`}>
                  <td className="px-4 py-3 text-sm text-[var(--tulip-forest)]">{doc.name}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-[var(--tulip-forest)]/60 uppercase">{doc.fileType ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--tulip-forest)]/60">{formatBytes(doc.fileSize)}</td>
                  <td className="px-4 py-3">
                    {doc.sha256Hash ? <HashCell hash={doc.sha256Hash} /> : <span className="text-xs text-[var(--tulip-forest)]/30">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--tulip-forest)]/40">
                    {new Date(doc.uploadedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => openDoc(doc.id)} className="text-[var(--tulip-forest)] hover:text-[var(--tulip-gold)] text-xs flex items-center gap-1">
                      {t('common.view')} <ExternalLink size={10} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
