'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { apiGet } from '@/lib/api'
import {
  ScanLine, Upload, FileText, Loader2, CheckCircle2, XCircle,
  RefreshCw, Download, Eye, Clock, AlertTriangle, Sparkles, Hash
} from 'lucide-react'

interface OcrJob {
  id: string
  status: string
  originalFilename: string
  fileType: string | null
  fileSize: number | null
  rawText: string | null
  confidence: number | null
  documentType: string | null
  detectedLanguage: string | null
  normalisedJson: Record<string, unknown> | null
  normalisedPdfS3: string | null
  assessmentScore: number | null
  assessmentResult: string | null
  assessmentNotes: string | null
  flags: Array<{ severity: string; field: string; issue: string; recommendation?: string }> | null
  hashValue: string | null
  anchorTxHash: string | null
  anchoredAt: string | null
  createdAt: string
  updatedAt: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Loader2 }> = {
  pending:         { label: 'Pending',        color: 'text-[var(--tulip-forest)]/60 bg-[var(--tulip-sage)] border-[var(--tulip-sage-dark)]',              icon: Clock },
  processing:      { label: 'Processing',     color: 'text-blue-400 bg-blue-400/10 border-blue-400/20',      icon: Loader2 },
  extracting:      { label: 'Extracting',     color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20', icon: Loader2 },
  normalising:     { label: 'Normalising',    color: 'text-purple-400 bg-purple-400/10 border-purple-400/20', icon: Sparkles },
  assessing:       { label: 'Assessing',      color: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20', icon: Sparkles },
  generating_pdf:  { label: 'Generating PDF', color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',      icon: FileText },
  completed:       { label: 'Completed',      color: 'text-green-400 bg-green-400/10 border-green-400/20',   icon: CheckCircle2 },
  failed:          { label: 'Failed',         color: 'text-red-400 bg-red-400/10 border-red-400/20',         icon: XCircle },
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  const Icon = config.icon
  const spinning = ['processing', 'extracting', 'normalising', 'assessing', 'generating_pdf'].includes(status)
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.color}`}>
      <Icon size={12} className={spinning ? 'animate-spin' : ''} />
      {config.label}
    </span>
  )
}

function RiskBadge({ level, score, t }: { level: string; score: number | null; t: (key: string, values?: Record<string, string | number | Date>) => string }) {
  const map: Record<string, string> = {
    low: 'bg-green-400/10 text-green-400 border-green-400/20',
    medium: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
    high: 'bg-red-400/10 text-red-400 border-red-400/20',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase border ${map[level] ?? 'bg-[var(--tulip-sage)] text-[var(--tulip-forest)]/60 border-[var(--tulip-sage-dark)]'}`}>
      {level === 'high' && <AlertTriangle size={10} />}
      {score != null ? t('riskWithScore', { level, score }) : t('riskNoScore', { level })}
    </span>
  )
}

export default function OcrPage() {
  const t = useTranslations('apiPortal.ocr')
  const [jobs, setJobs] = useState<OcrJob[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedJob, setSelectedJob] = useState<OcrJob | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [docPreviewUrl, setDocPreviewUrl] = useState<string | null>(null)
  const [docPreviewLoading, setDocPreviewLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchJobs = useCallback(async () => {
    try {
      const res = await apiGet('/api/ocr/jobs')
      if (res.ok) {
        const json = await res.json()
        const data = json.data ?? json
        setJobs(Array.isArray(data) ? data : [])
        // Update selectedJob if it's in the new data
        setSelectedJob(prev => {
          if (!prev) return null
          const updated = (Array.isArray(data) ? data : []).find((j: OcrJob) => j.id === prev.id)
          return updated ?? prev
        })
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  // Poll for in-progress jobs
  useEffect(() => {
    const hasActive = jobs.some((j) =>
      ['pending', 'processing', 'extracting', 'normalising', 'assessing', 'generating_pdf'].includes(j.status)
    )
    if (hasActive) {
      pollRef.current = setInterval(fetchJobs, 3000)
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [jobs, fetchJobs])

  // Load document preview when job is selected
  useEffect(() => {
    if (!selectedJob || selectedJob.status !== 'completed') {
      setDocPreviewUrl(null)
      return
    }
    let cancelled = false
    setDocPreviewLoading(true)
    setDocPreviewUrl(null)
    ;(async () => {
      try {
        const res = await apiGet(`/api/public/ocr/${selectedJob.id}/document`)
        if (res.ok && !cancelled) {
          const d = await res.json()
          if (d.url) setDocPreviewUrl(d.url)
        }
      } catch {}
      if (!cancelled) setDocPreviewLoading(false)
    })()
    return () => { cancelled = true }
  }, [selectedJob?.id, selectedJob?.status])

  const handleUpload = async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const token = localStorage.getItem('tulip_token')
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/ocr/process`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload failed' }))
        setError(err.error || err.details || `Upload failed (${res.status})`)
        return
      }

      const json = await res.json()
      const job = json.data ?? json
      setJobs((prev) => [job, ...prev])
      setSelectedJob(job)
    } catch (err) {
      setError(t('networkError'))
    } finally {
      setUploading(false)
    }
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleUpload(e.target.files[0])
    e.target.value = ''
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    if (e.dataTransfer.files?.[0]) handleUpload(e.dataTransfer.files[0])
  }

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleDownloadPdf = async (jobId: string) => {
    try {
      const res = await apiGet(`/api/ocr/jobs/${jobId}/pdf`)
      if (res.ok) {
        const { url } = await res.json()
        window.open(url, '_blank')
      }
    } catch {
      // silent
    }
  }

  const norm = selectedJob?.normalisedJson as Record<string, unknown> | null
  const flags = selectedJob?.flags

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--tulip-gold)]">
              <ScanLine size={20} />
            </div>
            {t('title')}
          </h1>
          <p className="text-[var(--tulip-forest)]/60 text-sm mt-1">
            {t('subtitle')}
          </p>
        </div>
        <button onClick={fetchJobs}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] text-sm text-[var(--tulip-forest)]/70 hover:text-[var(--tulip-forest)] hover:bg-[var(--tulip-sage)] transition-all">
          <RefreshCw size={14} />
          {t('refresh')}
        </button>
      </div>

      {/* Upload zone */}
      <div
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
          dragActive
            ? 'border-[var(--tulip-gold)] bg-[var(--tulip-gold)]/5'
            : 'border-[var(--tulip-sage-dark)] hover:border-[var(--tulip-forest)]/30 bg-[var(--tulip-sage)]'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif,.webp" onChange={onFileChange} />

        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={32} className="text-[var(--tulip-gold)] animate-spin" />
            <p className="text-[var(--tulip-forest)]/70 text-sm">{t('uploadingOcr')}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-[var(--tulip-gold)]/10 flex items-center justify-center">
              <Upload size={24} className="text-[var(--tulip-forest)]" />
            </div>
            <div>
              <p className="text-[var(--tulip-forest)] font-medium">{t('dropOrClick')}</p>
              <p className="text-[var(--tulip-forest)]/40 text-xs mt-1">{t('fileTypes')}</p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-400/10 border border-red-400/20 text-red-400 text-sm flex items-center gap-2">
          <XCircle size={16} />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Jobs list */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-sm font-semibold text-[var(--tulip-forest)]/60 uppercase tracking-wider">{t('jobsCount', { count: jobs.length })}</h2>

          {loading && (
            <div className="text-center py-8 text-[var(--tulip-forest)]/40">
              <Loader2 size={20} className="animate-spin mx-auto mb-2" />
              {t('loading')}
            </div>
          )}

          {!loading && jobs.length === 0 && (
            <div className="text-center py-8 text-[var(--tulip-forest)]/40 text-sm">
              {t('noJobsYet')}
            </div>
          )}

          {jobs.map((job) => (
            <button
              key={job.id}
              onClick={() => setSelectedJob(job)}
              className={`w-full text-left p-4 rounded-xl border transition-all ${
                selectedJob?.id === job.id
                  ? 'bg-[var(--tulip-gold)]/10 border-[var(--tulip-gold)]/30'
                  : 'bg-[var(--tulip-sage)] border-[var(--tulip-sage-dark)] hover:bg-[var(--tulip-sage)]/50'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--tulip-forest)] truncate">{job.originalFilename}</p>
                  <p className="text-xs text-[var(--tulip-forest)]/40 mt-0.5">
                    {new Date(job.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {' · '}{formatSize(job.fileSize)}
                  </p>
                </div>
                <StatusBadge status={job.status} />
              </div>
              {job.assessmentResult && (
                <div className="mt-2">
                  <RiskBadge level={job.assessmentResult} score={job.assessmentScore} t={t} />
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-2">
          {!selectedJob ? (
            <div className="flex items-center justify-center h-64 rounded-2xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)]">
              <div className="text-center text-[var(--tulip-forest)]/40">
                <Eye size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">{t('selectJobPrompt')}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Job header */}
              <div className="p-5 rounded-2xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-lg truncate pr-3">{selectedJob.originalFilename}</h3>
                  <StatusBadge status={selectedJob.status} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-[var(--tulip-forest)]/40">{t('type')}</span>
                    <p className="text-[var(--tulip-forest)] mt-0.5">{selectedJob.documentType || selectedJob.fileType || '—'}</p>
                  </div>
                  <div>
                    <span className="text-[var(--tulip-forest)]/40">{t('size')}</span>
                    <p className="text-[var(--tulip-forest)] mt-0.5">{formatSize(selectedJob.fileSize)}</p>
                  </div>
                  <div>
                    <span className="text-[var(--tulip-forest)]/40">{t('language')}</span>
                    <p className="text-[var(--tulip-forest)] mt-0.5 uppercase">{selectedJob.detectedLanguage || '—'}</p>
                  </div>
                  <div>
                    <span className="text-[var(--tulip-forest)]/40">{t('confidence')}</span>
                    <p className="text-[var(--tulip-forest)] mt-0.5">{selectedJob.confidence != null ? `${selectedJob.confidence}%` : '—'}</p>
                  </div>
                </div>

                {/* Hash */}
                {selectedJob.hashValue && (
                  <div className="mt-3 p-3 rounded-lg bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)]">
                    <div className="flex items-center gap-2 text-xs">
                      <Hash size={12} className="text-[var(--tulip-forest)]" />
                      <span className="text-[var(--tulip-forest)]/40">SHA-256</span>
                      <code className="text-[var(--tulip-forest)]/60 font-mono text-[11px] break-all">{selectedJob.hashValue}</code>
                    </div>
                    {selectedJob.anchorTxHash && (
                      <div className="flex items-center gap-2 text-xs mt-1">
                        <span className="text-[var(--tulip-forest)]/40 ml-5">{t('polygonTx')}</span>
                        <code className="text-green-400/70 font-mono text-[11px]">{selectedJob.anchorTxHash}</code>
                      </div>
                    )}
                  </div>
                )}

                {/* PDF download */}
                {selectedJob.normalisedPdfS3 && (
                  <button
                    onClick={() => handleDownloadPdf(selectedJob.id)}
                    className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-lg text-sm font-medium text-[var(--tulip-forest)] transition-all hover:opacity-90 bg-[var(--tulip-gold)] hover:bg-[var(--tulip-orange)]"
                  >
                    <Download size={14} />
                    {t('downloadNormalisedPdf')}
                  </button>
                )}
              </div>

              {/* Original document preview */}
              {selectedJob.status === 'completed' && (
                <div className="p-5 rounded-2xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)]">
                  <h4 className="font-semibold text-sm text-[var(--tulip-forest)]/70 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Eye size={14} className="text-[var(--tulip-forest)]" />
                    {t('originalDocument')}
                  </h4>
                  {docPreviewLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 size={20} className="animate-spin text-[var(--tulip-gold)]" />
                      <span className="ml-3 text-sm text-[var(--tulip-forest)]/60">{t('loadingPreview')}</span>
                    </div>
                  ) : docPreviewUrl ? (
                    <div className="rounded-xl overflow-hidden border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)]">
                      {selectedJob.originalFilename.match(/\.(jpg|jpeg|png|gif|webp|tif|tiff)$/i) ? (
                        <img src={docPreviewUrl} alt={selectedJob.originalFilename} className="max-h-[400px] w-full object-contain" />
                      ) : (
                        <iframe src={docPreviewUrl} className="w-full h-[400px]" title="Original document" />
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-8 text-sm text-[var(--tulip-forest)]/40">
                      {t('previewNotAvailable')}
                    </div>
                  )}
                </div>
              )}

              {/* Risk assessment */}
              {selectedJob.assessmentResult && (
                <div className="p-5 rounded-2xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)]">
                  <h4 className="font-semibold text-sm text-[var(--tulip-forest)]/70 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <AlertTriangle size={14} className="text-yellow-400" />
                    {t('riskAssessment')}
                  </h4>
                  <div className="flex items-center gap-4 mb-3">
                    <RiskBadge level={selectedJob.assessmentResult} score={selectedJob.assessmentScore} t={t} />
                  </div>
                  {selectedJob.assessmentNotes ? (
                    <p className="text-sm text-[var(--tulip-forest)]/70">{selectedJob.assessmentNotes}</p>
                  ) : null}

                  {/* Flags */}
                  {Array.isArray(flags) && flags.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      <span className="text-[var(--tulip-forest)]/40 text-xs uppercase tracking-wider">{t('flags')}</span>
                      {flags.map((flag, i) => {
                        const sevColor = flag.severity === 'high' ? 'text-red-400' : flag.severity === 'medium' ? 'text-yellow-400' : 'text-[var(--tulip-forest)]/60'
                        return (
                          <div key={i} className="p-3 rounded-lg bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)]">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold uppercase ${sevColor}`}>{flag.severity}</span>
                              <span className="text-xs text-[var(--tulip-forest)]/60">{flag.field}</span>
                            </div>
                            <p className="text-sm text-[var(--tulip-forest)] mt-1">{flag.issue}</p>
                            {flag.recommendation ? (
                              <p className="text-xs text-[var(--tulip-forest)]/60 mt-1">{'→ '}{flag.recommendation}</p>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              )}

              {/* Normalised data */}
              {norm && (
                <div className="p-5 rounded-2xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)]">
                  <h4 className="font-semibold text-sm text-[var(--tulip-forest)]/70 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Sparkles size={14} className="text-purple-400" />
                    {t('extractedDocumentData')}
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {norm.documentNumber ? (
                      <div>
                        <span className="text-[var(--tulip-forest)]/40 text-xs">{t('docNumber')}</span>
                        <p className="text-[var(--tulip-forest)]">{String(norm.documentNumber)}</p>
                      </div>
                    ) : null}
                    {norm.documentDate ? (
                      <div>
                        <span className="text-[var(--tulip-forest)]/40 text-xs">{t('date')}</span>
                        <p className="text-[var(--tulip-forest)]">{String(norm.documentDate)}</p>
                      </div>
                    ) : null}
                    {norm.currency ? (
                      <div>
                        <span className="text-[var(--tulip-forest)]/40 text-xs">{t('currency')}</span>
                        <p className="text-[var(--tulip-forest)]">{String(norm.currency)}</p>
                      </div>
                    ) : null}
                    {norm.total != null ? (
                      <div>
                        <span className="text-[var(--tulip-forest)]/40 text-xs">{t('total')}</span>
                        <p className="text-[var(--tulip-forest)] font-mono">{String(norm.currency || '')} {Number(norm.total).toLocaleString()}</p>
                      </div>
                    ) : null}
                    {norm.vendor ? (
                      <div>
                        <span className="text-[var(--tulip-forest)]/40 text-xs">{t('vendor')}</span>
                        <p className="text-[var(--tulip-forest)]">{String((norm.vendor as Record<string, unknown>)?.name || '—')}</p>
                      </div>
                    ) : null}
                    {norm.buyer ? (
                      <div>
                        <span className="text-[var(--tulip-forest)]/40 text-xs">{t('buyer')}</span>
                        <p className="text-[var(--tulip-forest)]">{String((norm.buyer as Record<string, unknown>)?.name || '—')}</p>
                      </div>
                    ) : null}
                    {norm.paymentTerms ? (
                      <div className="col-span-2">
                        <span className="text-[var(--tulip-forest)]/40 text-xs">{t('paymentTerms')}</span>
                        <p className="text-[var(--tulip-forest)]/70">{String(norm.paymentTerms)}</p>
                      </div>
                    ) : null}
                    {Array.isArray(norm.lineItems) && norm.lineItems.length > 0 ? (
                      <div className="col-span-2">
                        <span className="text-[var(--tulip-forest)]/40 text-xs">{t('lineItemsCount', { count: norm.lineItems.length })}</span>
                        <div className="mt-2 space-y-1">
                          {(norm.lineItems as Array<Record<string, unknown>>).slice(0, 10).map((item, i) => (
                            <div key={i} className="flex justify-between text-xs p-2 rounded bg-[var(--tulip-sage)]">
                              <span className="text-[var(--tulip-forest)]/70 truncate flex-1">{String(item.description || '—')}</span>
                              <span className="text-[var(--tulip-forest)] font-mono ml-4">
                                {item.total != null ? `${norm.currency || ''} ${Number(item.total).toLocaleString()}` : '—'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {/* Raw text */}
              {selectedJob.rawText && (
                <details className="rounded-2xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] overflow-hidden">
                  <summary className="px-5 py-3 cursor-pointer text-sm font-medium text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)] transition-colors">
                    {t('rawExtractedText')}
                  </summary>
                  <pre className="px-5 pb-4 text-xs text-[var(--tulip-forest)]/60 whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
                    {selectedJob.rawText.slice(0, 5000)}
                    {selectedJob.rawText.length > 5000 && '\n\n... (truncated)'}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
