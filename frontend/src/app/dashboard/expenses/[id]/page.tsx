'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiGet } from '@/lib/api'
import {
  ArrowLeft, DollarSign, FileText, FolderOpen, Upload,
  CheckCircle, Clock, XCircle, ExternalLink, Calendar, Hash, Copy, Check
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
  documents?: Doc[]
}

interface Doc {
  id: string
  name: string
  sha256Hash: string | null
  fileType: string | null
  fileSize: number | null
  uploadedAt: string
}

const anchorBadge = (status: string) => {
  switch (status) {
    case 'confirmed': return <span className="flex items-center gap-1 text-emerald-400 text-xs"><CheckCircle size={12} /> Confirmed</span>
    case 'pending':   return <span className="flex items-center gap-1 text-yellow-400 text-xs"><Clock size={12} /> Pending</span>
    case 'failed':    return <span className="flex items-center gap-1 text-red-400 text-xs"><XCircle size={12} /> Failed</span>
    default:          return <span className="flex items-center gap-1 text-[#183a1d]/40 text-xs"><Clock size={12} /> —</span>
  }
}

function HashCell({ hash }: { hash: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => { navigator.clipboard.writeText(hash); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  return (
    <div className="flex items-center gap-1.5 group">
      <span className="text-xs font-mono text-[#183a1d]/40">{hash.slice(0, 12)}…{hash.slice(-6)}</span>
      <button onClick={copy} className="opacity-0 group-hover:opacity-100 transition-opacity">
        {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} className="text-[#183a1d]/40" />}
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
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [expense, setExpense] = useState<Expense | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState('')

  const loadExpense = () => {
    if (!id) return
    apiGet(`/api/expenses/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) { setError('Expense not found'); setLoading(false); return }
        setExpense(data)
        setLoading(false)
      })
      .catch(() => { setError('Failed to load expense'); setLoading(false) })
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
    <div className="flex items-center justify-center min-h-screen bg-[#fefbe9]">
      <div className="w-8 h-8 border-2 border-[#f6c453] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (error || !expense) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#fefbe9] text-[#183a1d]/70 gap-4">
      <DollarSign size={48} className="text-[#183a1d]/30" />
      <p>{error || 'Expense not found'}</p>
      <Link href="/dashboard/expenses" className="text-[#183a1d] hover:text-[#f6c453] text-sm">← Back to Expenses</Link>
    </div>
  )

  const docs = expense.documents ?? []

  return (
    <div className="min-h-screen bg-[#fefbe9] text-[#183a1d] p-6 max-w-5xl mx-auto">

      {/* Back */}
      <Link href="/dashboard/expenses" className="inline-flex items-center gap-2 text-[#183a1d]/60 hover:text-[#183a1d] text-sm mb-6 transition-colors">
        <ArrowLeft size={14} /> Back to Expenses
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#f6c453]/10 border border-[#f6c453]/20 flex items-center justify-center">
            <DollarSign size={22} className="text-[#183a1d]" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-[#183a1d]">{expense.description}</h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {anchorBadge(expense.anchorStatus ?? '')}
              <span className="text-[#183a1d]/40 text-xs flex items-center gap-1">
                <Calendar size={11} /> {new Date(expense.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
              {expense.blockchainTx && (
                <a href={`https://polygonscan.com/tx/${expense.blockchainTx}`} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-[#183a1d] hover:text-[#f6c453] flex items-center gap-1">
                  Polygonscan <ExternalLink size={10} />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-[#e1eedd] border border-[#c8d6c0] rounded-xl p-4">
          <p className="text-[#183a1d]/60 text-xs mb-1">Amount</p>
          <p className="text-[#183a1d] font-semibold text-lg">{expense.currency} {expense.amount.toLocaleString()}</p>
        </div>
        <div className="bg-[#e1eedd] border border-[#c8d6c0] rounded-xl p-4">
          <p className="text-[#183a1d]/60 text-xs mb-1">Project</p>
          {expense.project ? (
            <Link href={`/dashboard/projects/${expense.project.id}`} className="text-[#183a1d] hover:text-[#f6c453] font-medium text-sm flex items-center gap-1">
              <FolderOpen size={13} /> {expense.project.name}
            </Link>
          ) : (
            <p className="text-[#183a1d]/40 text-sm">—</p>
          )}
        </div>
        <div className="bg-[#e1eedd] border border-[#c8d6c0] rounded-xl p-4">
          <p className="text-[#183a1d]/60 text-xs mb-1">Funding Source</p>
          <p className="text-[#183a1d] text-sm">{expense.fundingSource?.name ?? '—'}</p>
        </div>
        <div className="bg-[#e1eedd] border border-[#c8d6c0] rounded-xl p-4">
          <p className="text-[#183a1d]/60 text-xs mb-1">Documents</p>
          <p className="text-[#183a1d] font-semibold text-lg">{docs.length}</p>
        </div>
      </div>

      {/* Data hash */}
      {expense.dataHash && (
        <div className="bg-[#e1eedd] border border-[#c8d6c0] rounded-xl p-4 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#183a1d]/60 text-xs mb-1 flex items-center gap-1"><Hash size={11} /> Data Hash (SHA-256)</p>
              <HashCell hash={expense.dataHash} />
            </div>
            <Link href={`/verify?hash=${expense.dataHash}`} target="_blank"
              className="text-xs text-[#183a1d] hover:text-[#f6c453] border border-[#f6c453]/20 px-3 py-1.5 rounded-lg transition-colors">
              Verify
            </Link>
          </div>
        </div>
      )}

      {/* Documents section */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#183a1d]">Documents</h2>
        <label className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
          uploading ? 'bg-[#e1eedd] text-[#183a1d]/60' : 'text-[#183a1d]'
        }`} style={uploading ? {} : { background: '#f6c453' }}>
          <Upload size={14} />
          {uploading ? 'Uploading…' : 'Upload Document'}
          <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      {uploadSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3 mb-4 flex items-center gap-2 text-emerald-400 text-sm">
          <CheckCircle size={14} /> Uploaded {uploadSuccess}
        </div>
      )}

      <div className="bg-[#e1eedd] border border-[#c8d6c0] rounded-xl overflow-hidden">
        {docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#183a1d]/40 gap-3">
            <FileText size={36} className="text-[#183a1d]/30" />
            <p className="text-sm">No documents attached to this expense</p>
            <p className="text-xs text-[#183a1d]/30">Upload receipts, invoices, or supporting documents</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#c8d6c0]">
                <th className="text-left text-xs text-[#183a1d]/40 font-normal px-4 py-3">NAME</th>
                <th className="text-left text-xs text-[#183a1d]/40 font-normal px-4 py-3">TYPE</th>
                <th className="text-left text-xs text-[#183a1d]/40 font-normal px-4 py-3">SIZE</th>
                <th className="text-left text-xs text-[#183a1d]/40 font-normal px-4 py-3">SHA-256 HASH</th>
                <th className="text-left text-xs text-[#183a1d]/40 font-normal px-4 py-3">DATE</th>
                <th className="text-left text-xs text-[#183a1d]/40 font-normal px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {docs.map((doc, i) => (
                <tr key={doc.id} className={`border-b border-[#c8d6c0] hover:bg-[#e1eedd]/50 transition-colors ${i % 2 === 0 ? '' : 'bg-[#e1eedd]'}`}>
                  <td className="px-4 py-3 text-sm text-[#183a1d]">{doc.name}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-[#183a1d]/60 uppercase">{doc.fileType ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#183a1d]/60">{formatBytes(doc.fileSize)}</td>
                  <td className="px-4 py-3">
                    {doc.sha256Hash ? <HashCell hash={doc.sha256Hash} /> : <span className="text-xs text-[#183a1d]/30">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#183a1d]/40">
                    {new Date(doc.uploadedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => openDoc(doc.id)} className="text-[#183a1d] hover:text-[#f6c453] text-xs flex items-center gap-1">
                      View <ExternalLink size={10} />
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
