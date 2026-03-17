'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { apiGet } from '@/lib/api'
import { FolderSearch, Upload, FileText, Loader2, Download, Shield, AlertTriangle, CheckCircle } from 'lucide-react'

interface BundleJob {
  id: string
  name: string
  status: 'pending' | 'processing' | 'cross-analysing' | 'completed' | 'failed'
  fileCount: number
  processedCount: number
  riskLevel?: string
  riskScore?: number
  dataHash?: string
  createdAt: string
}

const API_URL = process.env.NEXT_PUBLIC_API_URL

export default function BundleVerifyPage() {
  const [bundles, setBundles] = useState<BundleJob[]>([])
  const [selected, setSelected] = useState<BundleJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [bundleName, setBundleName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const loadBundles = useCallback(async () => {
    try {
      const res = await apiGet('/api/ocr/bundles')
      if (res.ok) {
        const d = await res.json()
        setBundles(d.bundles || d.data || d || [])
      }
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { loadBundles() }, [loadBundles])

  // Poll for active bundles
  useEffect(() => {
    const active = bundles.some(b => ['pending', 'processing', 'cross-analysing'].includes(b.status))
    if (!active) return
    const timer = setInterval(loadBundles, 3000)
    return () => clearInterval(timer)
  }, [bundles, loadBundles])

  const handleUpload = async (files: FileList) => {
    if (files.length === 0) return
    setUploading(true)
    try {
      const token = localStorage.getItem('admin_token')
      const formData = new FormData()
      formData.append('name', bundleName || `Bundle ${new Date().toLocaleDateString()}`)
      Array.from(files).forEach(f => formData.append('files', f))
      const res = await fetch(`${API_URL}/api/ocr/bundle/process`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      if (res.ok) {
        setBundleName('')
        loadBundles()
      }
    } catch {}
    setUploading(false)
  }

  const riskColor = (level?: string) => {
    if (!level) return 'text-[var(--admin-text-muted)]'
    if (level === 'low') return 'text-green-600'
    if (level === 'medium') return 'text-amber-600'
    return 'text-red-600'
  }

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-gray-50 text-gray-500 border-gray-200',
      processing: 'bg-blue-50 text-blue-600 border-blue-200',
      'cross-analysing': 'bg-purple-50 text-purple-600 border-purple-200',
      completed: 'bg-green-50 text-green-600 border-green-200',
      failed: 'bg-red-50 text-red-600 border-red-200',
    }
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border font-medium ${styles[status] || styles.pending}`}>{status}</span>
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-[var(--admin-text)]">Bundle Verify</h1>
        <p className="text-sm text-[var(--admin-text-secondary)] mt-1">Upload and cross-analyse document bundles</p>
      </div>

      {/* Upload */}
      <div className="bg-[var(--admin-card)] rounded-xl border border-[var(--admin-border)] p-5 space-y-4">
        <div className="flex items-center gap-3">
          <input value={bundleName} onChange={e => setBundleName(e.target.value)} placeholder="Bundle name (optional)" className="flex-1 max-w-xs rounded-lg px-4 py-2 text-sm border border-[var(--admin-border)] bg-[var(--admin-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50" />
          <input ref={fileRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={e => e.target.files && handleUpload(e.target.files)} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--admin-accent)] hover:bg-[var(--admin-accent-hover)] disabled:opacity-50 transition-colors">
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {uploading ? 'Uploading...' : 'Upload Bundle'}
          </button>
        </div>
      </div>

      {/* Bundles list */}
      <div className="bg-[var(--admin-card)] rounded-xl border border-[var(--admin-border)] overflow-hidden">
        <div className="hidden lg:grid grid-cols-[2fr_80px_80px_100px_100px_120px] gap-4 px-5 py-3 border-b border-[var(--admin-border)] text-xs text-[var(--admin-text-muted)] uppercase tracking-wide font-medium bg-[var(--admin-bg)]">
          <span>Name</span><span>Files</span><span>Risk</span><span>Status</span><span>Hash</span><span>Created</span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-[var(--admin-text-muted)]">Loading...</div>
        ) : bundles.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <FolderSearch size={24} className="text-[var(--admin-text-muted)]" />
            <p className="text-sm text-[var(--admin-text-muted)]">No bundles yet</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--admin-border)]">
            {bundles.map(b => (
              <button key={b.id} onClick={() => setSelected(b)} className="w-full text-left px-5 py-3 hover:bg-[var(--admin-bg)] transition-colors lg:grid lg:grid-cols-[2fr_80px_80px_100px_100px_120px] lg:gap-4 lg:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <FolderSearch size={14} className="text-[var(--admin-text-muted)]" />
                    <span className="text-sm font-medium text-[var(--admin-text)]">{b.name}</span>
                  </div>
                  {['processing', 'cross-analysing'].includes(b.status) && (
                    <div className="mt-1 h-1.5 bg-[var(--admin-bg)] rounded-full overflow-hidden w-40">
                      <div className="h-full bg-[var(--admin-accent)] rounded-full animate-pulse" style={{ width: `${(b.processedCount / Math.max(b.fileCount, 1)) * 100}%` }} />
                    </div>
                  )}
                </div>
                <div className="text-sm text-[var(--admin-text-secondary)]">{b.fileCount}</div>
                <div className={`text-sm font-medium ${riskColor(b.riskLevel)}`}>{b.riskLevel || '—'}</div>
                <div>{statusBadge(b.status)}</div>
                <div className="text-xs font-mono text-[var(--admin-text-muted)] truncate">{b.dataHash?.slice(0, 10) || '—'}</div>
                <div className="text-xs text-[var(--admin-text-muted)]">{new Date(b.createdAt).toLocaleDateString()}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selected && selected.status === 'completed' && (
        <div className="bg-[var(--admin-card)] rounded-xl border border-[var(--admin-border)] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-[var(--admin-text)]">{selected.name}</h3>
            <a href={`${API_URL}/api/ocr/bundles/${selected.id}/pdf`} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--admin-accent)] border border-[var(--admin-accent)]/30 hover:bg-[var(--admin-accent)]/5 transition-colors">
              <Download size={14} /> Download Report
            </a>
          </div>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div><span className="text-[var(--admin-text-muted)]">Files:</span> <strong>{selected.fileCount}</strong></div>
            <div><span className="text-[var(--admin-text-muted)]">Risk:</span> <strong className={riskColor(selected.riskLevel)}>{selected.riskLevel}</strong></div>
            <div><span className="text-[var(--admin-text-muted)]">Score:</span> <strong>{selected.riskScore ?? '—'}</strong></div>
            <div><span className="text-[var(--admin-text-muted)]">Hash:</span> <code className="text-xs bg-[var(--admin-bg)] px-1 rounded">{selected.dataHash?.slice(0, 16)}...</code></div>
          </div>
        </div>
      )}
    </div>
  )
}
