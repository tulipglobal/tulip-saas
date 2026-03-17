'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { apiGet } from '@/lib/api'
import { ScanLine, Upload, FileText, Loader2, Download, Shield, CheckCircle } from 'lucide-react'

interface OcrJob {
  id: string
  fileName: string
  fileType: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  confidence?: number
  language?: string
  dataHash?: string
  riskLevel?: string
  createdAt: string
}

const API_URL = process.env.NEXT_PUBLIC_API_URL

export default function OcrEnginePage() {
  const [jobs, setJobs] = useState<OcrJob[]>([])
  const [selected, setSelected] = useState<OcrJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadJobs = useCallback(async () => {
    try {
      const res = await apiGet('/api/ocr/jobs')
      if (res.ok) {
        const d = await res.json()
        setJobs(d.jobs || d.data || d || [])
      }
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { loadJobs() }, [loadJobs])

  useEffect(() => {
    const active = jobs.some(j => ['pending', 'processing'].includes(j.status))
    if (!active) return
    const timer = setInterval(loadJobs, 3000)
    return () => clearInterval(timer)
  }, [jobs, loadJobs])

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const token = localStorage.getItem('admin_token')
      const formData = new FormData()
      formData.append('file', file)
      await fetch(`${API_URL}/api/ocr/process`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      loadJobs()
    } catch {}
    setUploading(false)
  }

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-gray-50 text-gray-500 border-gray-200',
      processing: 'bg-blue-50 text-blue-600 border-blue-200',
      completed: 'bg-green-50 text-green-600 border-green-200',
      failed: 'bg-red-50 text-red-600 border-red-200',
    }
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border font-medium ${styles[status] || styles.pending}`}>{status}</span>
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-[var(--admin-text)]">OCR Engine</h1>
        <p className="text-sm text-[var(--admin-text-secondary)] mt-1">Process and extract data from documents</p>
      </div>

      {/* Upload */}
      <div className="bg-[var(--admin-card)] rounded-xl border border-[var(--admin-border)] p-5">
        <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} />
        <button onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--admin-accent)] hover:bg-[var(--admin-accent-hover)] disabled:opacity-50 transition-colors">
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {uploading ? 'Processing...' : 'Upload Document'}
        </button>
      </div>

      {/* Jobs list */}
      <div className="bg-[var(--admin-card)] rounded-xl border border-[var(--admin-border)] overflow-hidden">
        <div className="hidden lg:grid grid-cols-[2fr_80px_80px_100px_100px_120px] gap-4 px-5 py-3 border-b border-[var(--admin-border)] text-xs text-[var(--admin-text-muted)] uppercase tracking-wide font-medium bg-[var(--admin-bg)]">
          <span>File</span><span>Type</span><span>Confidence</span><span>Risk</span><span>Status</span><span>Created</span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-[var(--admin-text-muted)]">Loading...</div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <ScanLine size={24} className="text-[var(--admin-text-muted)]" />
            <p className="text-sm text-[var(--admin-text-muted)]">No OCR jobs yet</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--admin-border)]">
            {jobs.map(j => (
              <button key={j.id} onClick={() => setSelected(j)} className="w-full text-left px-5 py-3 hover:bg-[var(--admin-bg)] transition-colors lg:grid lg:grid-cols-[2fr_80px_80px_100px_100px_120px] lg:gap-4 lg:items-center">
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-[var(--admin-text-muted)]" />
                  <span className="text-sm font-medium text-[var(--admin-text)] truncate">{j.fileName}</span>
                </div>
                <div className="text-xs text-[var(--admin-text-secondary)]">{j.fileType}</div>
                <div className="text-sm text-[var(--admin-text)]">{j.confidence ? `${j.confidence}%` : '—'}</div>
                <div className="text-sm">{j.riskLevel || '—'}</div>
                <div>{statusBadge(j.status)}</div>
                <div className="text-xs text-[var(--admin-text-muted)]">{new Date(j.createdAt).toLocaleDateString()}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && selected.status === 'completed' && (
        <div className="bg-[var(--admin-card)] rounded-xl border border-[var(--admin-border)] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-[var(--admin-text)]">{selected.fileName}</h3>
            <a href={`${API_URL}/api/ocr/jobs/${selected.id}/pdf`} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--admin-accent)] border border-[var(--admin-accent)]/30 hover:bg-[var(--admin-accent)]/5 transition-colors">
              <Download size={14} /> Download PDF
            </a>
          </div>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div><span className="text-[var(--admin-text-muted)]">Language:</span> <strong>{selected.language || '—'}</strong></div>
            <div><span className="text-[var(--admin-text-muted)]">Confidence:</span> <strong>{selected.confidence ?? '—'}%</strong></div>
            <div><span className="text-[var(--admin-text-muted)]">Risk:</span> <strong>{selected.riskLevel || '—'}</strong></div>
            <div><span className="text-[var(--admin-text-muted)]">Hash:</span> <code className="text-xs bg-[var(--admin-bg)] px-1 rounded">{selected.dataHash?.slice(0, 16) || '—'}...</code></div>
          </div>
        </div>
      )}
    </div>
  )
}
