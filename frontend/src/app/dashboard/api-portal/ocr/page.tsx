'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { apiFetch, apiGet } from '@/lib/api'
import {
  ScanLine, Upload, FileText, Loader2, CheckCircle2, XCircle,
  RefreshCw, Download, Eye, Clock, AlertTriangle, Sparkles
} from 'lucide-react'

interface OcrJob {
  id: string
  status: string
  fileName: string
  fileType: string | null
  fileSize: number | null
  rawText: string | null
  normalised: Record<string, unknown> | null
  assessment: Record<string, unknown> | null
  pdfUrl: string | null
  errorMessage: string | null
  createdAt: string
  completedAt: string | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Loader2 }> = {
  pending:           { label: 'Pending',       color: 'text-white/40 bg-white/5 border-white/10',       icon: Clock },
  uploaded:          { label: 'Uploaded',       color: 'text-blue-400 bg-blue-400/10 border-blue-400/20', icon: Upload },
  extracting:        { label: 'Extracting',     color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20', icon: Loader2 },
  normalising:       { label: 'Normalising',    color: 'text-purple-400 bg-purple-400/10 border-purple-400/20', icon: Sparkles },
  assessing:         { label: 'Assessing',      color: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20', icon: Sparkles },
  generating_report: { label: 'Generating PDF', color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20', icon: FileText },
  completed:         { label: 'Completed',      color: 'text-green-400 bg-green-400/10 border-green-400/20', icon: CheckCircle2 },
  failed:            { label: 'Failed',         color: 'text-red-400 bg-red-400/10 border-red-400/20',   icon: XCircle },
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  const Icon = config.icon
  const spinning = ['extracting', 'normalising', 'assessing', 'generating_report'].includes(status)
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.color}`}>
      <Icon size={12} className={spinning ? 'animate-spin' : ''} />
      {config.label}
    </span>
  )
}

function RiskBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    low: 'bg-green-400/10 text-green-400 border-green-400/20',
    medium: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
    high: 'bg-red-400/10 text-red-400 border-red-400/20',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${map[level] ?? 'bg-white/5 text-white/40 border-white/10'}`}>
      {level === 'high' && <AlertTriangle size={10} />}
      {level}
    </span>
  )
}

export default function OcrPage() {
  const [jobs, setJobs] = useState<OcrJob[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedJob, setSelectedJob] = useState<OcrJob | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchJobs = useCallback(async () => {
    try {
      const res = await apiGet('/api/ocr/jobs')
      if (res.ok) {
        const { data } = await res.json()
        setJobs(data)
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
      ['uploaded', 'extracting', 'normalising', 'assessing', 'generating_report', 'pending'].includes(j.status)
    )
    if (hasActive) {
      pollRef.current = setInterval(fetchJobs, 5000)
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [jobs, fetchJobs])

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const token = localStorage.getItem('tulip_token')
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/ocr/process`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (res.ok) {
        const { data } = await res.json()
        setJobs((prev) => [data, ...prev])
      }
    } catch {
      // silent
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

  const norm = selectedJob?.normalised as Record<string, unknown> | null
  const assess = selectedJob?.assessment as Record<string, unknown> | null

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
              <ScanLine size={20} />
            </div>
            OCR Engine
          </h1>
          <p className="text-white/40 text-sm mt-1">
            Extract text from documents, normalise with AI, and generate compliance reports.
          </p>
        </div>
        <button onClick={fetchJobs}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/60 hover:text-white hover:bg-white/10 transition-all">
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Upload zone */}
      <div
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
          dragActive
            ? 'border-[#0c7aed] bg-[#0c7aed]/5'
            : 'border-white/10 hover:border-white/20 bg-white/[0.02]'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif" onChange={onFileChange} />

        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={32} className="text-[#0c7aed] animate-spin" />
            <p className="text-white/60 text-sm">Uploading and starting OCR...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-[#0c7aed]/10 flex items-center justify-center">
              <Upload size={24} className="text-[#0c7aed]" />
            </div>
            <div>
              <p className="text-white/70 font-medium">Drop a document here or click to upload</p>
              <p className="text-white/30 text-xs mt-1">PDF, JPG, PNG, TIFF — up to 20MB</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Jobs list */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider">Jobs ({jobs.length})</h2>

          {loading && (
            <div className="text-center py-8 text-white/30">
              <Loader2 size={20} className="animate-spin mx-auto mb-2" />
              Loading...
            </div>
          )}

          {!loading && jobs.length === 0 && (
            <div className="text-center py-8 text-white/30 text-sm">
              No OCR jobs yet. Upload a document to get started.
            </div>
          )}

          {jobs.map((job) => (
            <button
              key={job.id}
              onClick={() => setSelectedJob(job)}
              className={`w-full text-left p-4 rounded-xl border transition-all ${
                selectedJob?.id === job.id
                  ? 'bg-[#0c7aed]/10 border-[#0c7aed]/30'
                  : 'bg-white/[0.02] border-white/8 hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white/90 truncate">{job.fileName}</p>
                  <p className="text-xs text-white/30 mt-0.5">
                    {new Date(job.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {' · '}{formatSize(job.fileSize)}
                  </p>
                </div>
                <StatusBadge status={job.status} />
              </div>
              {job.errorMessage && (
                <p className="text-xs text-red-400/70 mt-2 truncate">{job.errorMessage}</p>
              )}
            </button>
          ))}
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-2">
          {!selectedJob ? (
            <div className="flex items-center justify-center h-64 rounded-2xl border border-white/8 bg-white/[0.02]">
              <div className="text-center text-white/30">
                <Eye size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">Select a job to view results</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Job header */}
              <div className="p-5 rounded-2xl border border-white/8 bg-white/[0.02]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-lg">{selectedJob.fileName}</h3>
                  <StatusBadge status={selectedJob.status} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-white/30">Type</span>
                    <p className="text-white/70 mt-0.5">{selectedJob.fileType || '—'}</p>
                  </div>
                  <div>
                    <span className="text-white/30">Size</span>
                    <p className="text-white/70 mt-0.5">{formatSize(selectedJob.fileSize)}</p>
                  </div>
                  <div>
                    <span className="text-white/30">Created</span>
                    <p className="text-white/70 mt-0.5">{new Date(selectedJob.createdAt).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-white/30">Completed</span>
                    <p className="text-white/70 mt-0.5">{selectedJob.completedAt ? new Date(selectedJob.completedAt).toLocaleString() : '—'}</p>
                  </div>
                </div>
                {selectedJob.pdfUrl && (
                  <a
                    href={selectedJob.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all"
                    style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}
                  >
                    <Download size={14} />
                    Download PDF Report
                  </a>
                )}
              </div>

              {/* Normalised data */}
              {norm && (
                <div className="p-5 rounded-2xl border border-white/8 bg-white/[0.02]">
                  <h4 className="font-semibold text-sm text-white/60 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Sparkles size={14} className="text-purple-400" />
                    AI-Extracted Data
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {norm.title ? (
                      <div className="col-span-2">
                        <span className="text-white/30 text-xs">Title</span>
                        <p className="text-white/80">{String(norm.title)}</p>
                      </div>
                    ) : null}
                    {norm.documentType ? (
                      <div>
                        <span className="text-white/30 text-xs">Document Type</span>
                        <p className="text-white/80 capitalize">{String(norm.documentType).replace('_', ' ')}</p>
                      </div>
                    ) : null}
                    {norm.date ? (
                      <div>
                        <span className="text-white/30 text-xs">Date</span>
                        <p className="text-white/80">{String(norm.date)}</p>
                      </div>
                    ) : null}
                    {norm.language ? (
                      <div>
                        <span className="text-white/30 text-xs">Language</span>
                        <p className="text-white/80 uppercase">{String(norm.language)}</p>
                      </div>
                    ) : null}
                    {norm.confidence != null ? (
                      <div>
                        <span className="text-white/30 text-xs">Confidence</span>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#0c7aed]"
                              style={{ width: `${Number(norm.confidence) * 100}%` }}
                            />
                          </div>
                          <span className="text-white/60 text-xs">{(Number(norm.confidence) * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    ) : null}
                    {norm.summary ? (
                      <div className="col-span-2">
                        <span className="text-white/30 text-xs">Summary</span>
                        <p className="text-white/60 text-sm mt-0.5">{String(norm.summary)}</p>
                      </div>
                    ) : null}
                    {Array.isArray(norm.parties) && norm.parties.length > 0 ? (
                      <div className="col-span-2">
                        <span className="text-white/30 text-xs">Parties</span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {(norm.parties as string[]).map((p: string, i: number) => (
                            <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-white/5 border border-white/10 text-white/60">{p}</span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {Array.isArray(norm.amounts) && norm.amounts.length > 0 ? (
                      <div className="col-span-2">
                        <span className="text-white/30 text-xs">Amounts</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {(norm.amounts as Array<{ value: number; currency: string }>).map((a, i: number) => (
                            <span key={i} className="px-2 py-1 rounded-lg text-sm font-mono bg-green-400/10 text-green-400 border border-green-400/20">
                              {a.currency} {a.value.toLocaleString()}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {/* Assessment */}
              {assess && (
                <div className="p-5 rounded-2xl border border-white/8 bg-white/[0.02]">
                  <h4 className="font-semibold text-sm text-white/60 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <AlertTriangle size={14} className="text-yellow-400" />
                    Compliance Assessment
                  </h4>
                  <div className="flex items-center gap-4 mb-4">
                    {assess.riskLevel ? <RiskBadge level={String(assess.riskLevel)} /> : null}
                    {assess.transparencyScore != null ? (
                      <div className="flex items-center gap-2">
                        <span className="text-white/30 text-xs">Transparency</span>
                        <span className="text-lg font-bold">{String(assess.transparencyScore)}</span>
                        <span className="text-white/30 text-xs">/100</span>
                      </div>
                    ) : null}
                  </div>
                  {Array.isArray(assess.complianceFlags) && assess.complianceFlags.length > 0 ? (
                    <div className="mb-3">
                      <span className="text-white/30 text-xs">Compliance Flags</span>
                      <ul className="mt-1 space-y-1">
                        {(assess.complianceFlags as string[]).map((f: string, i: number) => (
                          <li key={i} className="text-sm text-yellow-400/80 flex items-start gap-2">
                            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {Array.isArray(assess.recommendations) && assess.recommendations.length > 0 ? (
                    <div className="mb-3">
                      <span className="text-white/30 text-xs">Recommendations</span>
                      <ul className="mt-1 space-y-1">
                        {(assess.recommendations as string[]).map((r: string, i: number) => (
                          <li key={i} className="text-sm text-white/60">{'→ '}{r}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {Array.isArray(assess.missingElements) && assess.missingElements.length > 0 ? (
                    <div>
                      <span className="text-white/30 text-xs">Missing Elements</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {(assess.missingElements as string[]).map((m: string, i: number) => (
                          <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-red-400/10 text-red-400/70 border border-red-400/20">{m}</span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Raw text */}
              {selectedJob.rawText && (
                <details className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
                  <summary className="px-5 py-3 cursor-pointer text-sm font-medium text-white/50 hover:text-white/70 transition-colors">
                    Raw Extracted Text
                  </summary>
                  <pre className="px-5 pb-4 text-xs text-white/40 whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
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
