'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { apiGet } from '@/lib/api'
import {
  FolderSearch, Upload, FileText, Loader2, CheckCircle2, XCircle,
  RefreshCw, Download, Eye, Clock, AlertTriangle, Sparkles, Hash,
  ArrowRightLeft, FileWarning, ShieldCheck
} from 'lucide-react'

interface OcrJobSummary {
  id: string
  originalFilename: string
  status: string
  documentType: string | null
  assessmentResult: string | null
  assessmentScore: number | null
}

interface CrossCheck {
  checkType: string
  severity: string
  documents: number[]
  finding: string
  recommendation?: string
}

interface DocRelationship {
  doc1: number
  doc2: number
  relationship: string
  confidence: string
}

interface CrossAnalysis {
  bundleRiskScore: number
  bundleRiskLevel: string
  summary: string
  consistencyScore: number
  crossChecks: CrossCheck[]
  documentRelationships: DocRelationship[]
  missingDocuments: string[]
  overallRecommendation: string
  overallRecommendationReason: string
}

interface BundleJob {
  id: string
  name: string
  status: string
  fileCount: number
  completedCount: number
  overallRiskScore: number | null
  overallRiskLevel: string | null
  crossAnalysisJson: CrossAnalysis | null
  masterReportS3: string | null
  bundleHash: string | null
  anchorTxHash: string | null
  anchoredAt: string | null
  ocrJobs: OcrJobSummary[]
  createdAt: string
  updatedAt: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Loader2 }> = {
  pending:           { label: 'Pending',          color: 'text-[var(--tulip-forest)]/60 bg-[var(--tulip-sage)] border-[var(--tulip-sage-dark)]',              icon: Clock },
  processing:        { label: 'Processing',       color: 'text-blue-400 bg-blue-400/10 border-blue-400/20',      icon: Loader2 },
  processing_docs:   { label: 'Processing Docs',  color: 'text-blue-400 bg-blue-400/10 border-blue-400/20',      icon: Loader2 },
  cross_analysing:   { label: 'Cross-Analysing',  color: 'text-purple-400 bg-purple-400/10 border-purple-400/20', icon: Sparkles },
  generating_report: { label: 'Generating Report', color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',     icon: FileText },
  completed:         { label: 'Completed',        color: 'text-green-400 bg-green-400/10 border-green-400/20',   icon: CheckCircle2 },
  failed:            { label: 'Failed',           color: 'text-red-400 bg-red-400/10 border-red-400/20',         icon: XCircle },
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  const Icon = config.icon
  const spinning = ['processing', 'processing_docs', 'cross_analysing', 'generating_report'].includes(status)
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
      {level === 'high' ? <AlertTriangle size={10} /> : null}
      {score != null ? t('riskWithScore', { level, score }) : t('riskNoScore', { level })}
    </span>
  )
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    low: 'text-[var(--tulip-forest)]/60',
    medium: 'text-yellow-400',
    high: 'text-red-400',
  }
  return <span className={`text-[10px] font-bold uppercase ${map[severity] ?? 'text-[var(--tulip-forest)]/60'}`}>{severity}</span>
}

export default function BundlePage() {
  const t = useTranslations('apiPortal.bundle')
  const [bundles, setBundles] = useState<BundleJob[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedBundle, setSelectedBundle] = useState<BundleJob | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [bundleName, setBundleName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchBundles = useCallback(async () => {
    try {
      const res = await apiGet('/api/ocr/bundles')
      if (res.ok) {
        const json = await res.json()
        const data = json.data ?? json
        setBundles(Array.isArray(data) ? data : [])
        setSelectedBundle(prev => {
          if (!prev) return null
          const updated = (Array.isArray(data) ? data : []).find((b: BundleJob) => b.id === prev.id)
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
    fetchBundles()
  }, [fetchBundles])

  // Poll for in-progress bundles
  useEffect(() => {
    const hasActive = bundles.some((b) =>
      ['pending', 'processing', 'processing_docs', 'cross_analysing', 'generating_report'].includes(b.status)
    )
    if (hasActive) {
      pollRef.current = setInterval(fetchBundles, 3000)
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [bundles, fetchBundles])

  const handleUpload = async (files: FileList) => {
    if (files.length === 0) return
    if (files.length > 20) {
      setError(t('maxFilesError'))
      return
    }

    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i])
      }
      formData.append('name', bundleName || `Bundle ${new Date().toISOString().slice(0, 10)}`)

      const token = localStorage.getItem('tulip_token')
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/ocr/bundle/process`, {
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
      const bundle = json.data ?? json
      setBundles((prev) => [bundle, ...prev])
      setSelectedBundle(bundle)
      setBundleName('')
    } catch {
      setError(t('networkError'))
    } finally {
      setUploading(false)
    }
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) handleUpload(e.target.files)
    e.target.value = ''
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) handleUpload(e.dataTransfer.files)
  }

  const handleDownloadPdf = async (bundleId: string) => {
    try {
      const res = await apiGet(`/api/ocr/bundles/${bundleId}/pdf`)
      if (res.ok) {
        const { url } = await res.json()
        window.open(url, '_blank')
      }
    } catch {
      // silent
    }
  }

  const cross = selectedBundle?.crossAnalysisJson as CrossAnalysis | null

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--tulip-gold)]">
              <FolderSearch size={20} />
            </div>
            {t('title')}
          </h1>
          <p className="text-[var(--tulip-forest)]/60 text-sm mt-1">
            {t('subtitle')}
          </p>
        </div>
        <button onClick={fetchBundles}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] text-sm text-[var(--tulip-forest)]/70 hover:text-[var(--tulip-forest)] hover:bg-[var(--tulip-sage)] transition-all">
          <RefreshCw size={14} />
          {t('refresh')}
        </button>
      </div>

      {/* Upload zone */}
      <div className="space-y-3">
        <input
          type="text"
          value={bundleName}
          onChange={(e) => setBundleName(e.target.value)}
          placeholder={t('bundleNamePlaceholder')}
          className="w-full px-4 py-2.5 rounded-xl bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none focus:border-[var(--tulip-gold)] transition-all"
        />
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
          <input ref={fileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif,.webp" multiple onChange={onFileChange} />

          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={32} className="text-[var(--tulip-gold)] animate-spin" />
              <p className="text-[var(--tulip-forest)]/70 text-sm">{t('uploadingBundle')}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-[var(--tulip-gold)]/10 flex items-center justify-center">
                <Upload size={24} className="text-[var(--tulip-forest)]" />
              </div>
              <div>
                <p className="text-[var(--tulip-forest)] font-medium">{t('dropMultiple')}</p>
                <p className="text-[var(--tulip-forest)]/40 text-xs mt-1">{t('fileTypes')}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {error ? (
        <div className="p-3 rounded-xl bg-red-400/10 border border-red-400/20 text-red-400 text-sm flex items-center gap-2">
          <XCircle size={16} />
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bundle list */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-sm font-semibold text-[var(--tulip-forest)]/60 uppercase tracking-wider">{t('bundlesCount', { count: bundles.length })}</h2>

          {loading ? (
            <div className="text-center py-8 text-[var(--tulip-forest)]/40">
              <Loader2 size={20} className="animate-spin mx-auto mb-2" />
              {t('loading')}
            </div>
          ) : null}

          {!loading && bundles.length === 0 ? (
            <div className="text-center py-8 text-[var(--tulip-forest)]/40 text-sm">
              {t('noBundlesYet')}
            </div>
          ) : null}

          {bundles.map((bundle) => (
            <button
              key={bundle.id}
              onClick={() => setSelectedBundle(bundle)}
              className={`w-full text-left p-4 rounded-xl border transition-all ${
                selectedBundle?.id === bundle.id
                  ? 'bg-[var(--tulip-gold)]/10 border-[var(--tulip-gold)]/30'
                  : 'bg-[var(--tulip-sage)] border-[var(--tulip-sage-dark)] hover:bg-[var(--tulip-sage)]/50'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--tulip-forest)] truncate">{bundle.name}</p>
                  <p className="text-xs text-[var(--tulip-forest)]/40 mt-0.5">
                    {new Date(bundle.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {' · '}{t('filesCount', { count: bundle.fileCount })}
                  </p>
                  {bundle.status === 'processing_docs' ? (
                    <div className="mt-1.5">
                      <div className="w-full h-1.5 rounded-full bg-[var(--tulip-sage)] overflow-hidden">
                        <div className="h-full rounded-full bg-blue-400 transition-all duration-500"
                          style={{ width: `${bundle.fileCount > 0 ? (bundle.completedCount / bundle.fileCount) * 100 : 0}%` }} />
                      </div>
                      <p className="text-[10px] text-[var(--tulip-forest)]/40 mt-0.5">{t('docsProcessed', { completed: bundle.completedCount, total: bundle.fileCount })}</p>
                    </div>
                  ) : null}
                </div>
                <StatusBadge status={bundle.status} />
              </div>
              {bundle.overallRiskLevel ? (
                <div className="mt-2">
                  <RiskBadge level={bundle.overallRiskLevel} score={bundle.overallRiskScore} t={t} />
                </div>
              ) : null}
            </button>
          ))}
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-2">
          {!selectedBundle ? (
            <div className="flex items-center justify-center h-64 rounded-2xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)]">
              <div className="text-center text-[var(--tulip-forest)]/40">
                <Eye size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">{t('selectBundlePrompt')}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Bundle header */}
              <div className="p-5 rounded-2xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-lg truncate pr-3">{selectedBundle.name}</h3>
                  <StatusBadge status={selectedBundle.status} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-[var(--tulip-forest)]/40">{t('files')}</span>
                    <p className="text-[var(--tulip-forest)] mt-0.5">{selectedBundle.fileCount}</p>
                  </div>
                  <div>
                    <span className="text-[var(--tulip-forest)]/40">{t('processed')}</span>
                    <p className="text-[var(--tulip-forest)] mt-0.5">{selectedBundle.completedCount}/{selectedBundle.fileCount}</p>
                  </div>
                  <div>
                    <span className="text-[var(--tulip-forest)]/40">{t('riskLevel')}</span>
                    <p className="text-[var(--tulip-forest)] mt-0.5 uppercase">{selectedBundle.overallRiskLevel || '—'}</p>
                  </div>
                  <div>
                    <span className="text-[var(--tulip-forest)]/40">{t('riskScore')}</span>
                    <p className="text-[var(--tulip-forest)] mt-0.5">{selectedBundle.overallRiskScore != null ? `${selectedBundle.overallRiskScore}/100` : '—'}</p>
                  </div>
                </div>

                {/* Progress bar for active processing */}
                {['processing', 'processing_docs'].includes(selectedBundle.status) ? (
                  <div className="mt-3">
                    <div className="w-full h-2 rounded-full bg-[var(--tulip-sage)] overflow-hidden">
                      <div className="h-full rounded-full bg-blue-400 transition-all duration-500"
                        style={{ width: `${selectedBundle.fileCount > 0 ? (selectedBundle.completedCount / selectedBundle.fileCount) * 100 : 0}%` }} />
                    </div>
                    <p className="text-xs text-[var(--tulip-forest)]/40 mt-1">{t('processingDocs', { completed: selectedBundle.completedCount, total: selectedBundle.fileCount })}</p>
                  </div>
                ) : null}

                {/* Hash */}
                {selectedBundle.bundleHash ? (
                  <div className="mt-3 p-3 rounded-lg bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)]">
                    <div className="flex items-center gap-2 text-xs">
                      <Hash size={12} className="text-[var(--tulip-forest)]" />
                      <span className="text-[var(--tulip-forest)]/40">SHA-256</span>
                      <code className="text-[var(--tulip-forest)]/60 font-mono text-[11px] break-all">{selectedBundle.bundleHash}</code>
                    </div>
                  </div>
                ) : null}

                {/* PDF download */}
                {selectedBundle.masterReportS3 ? (
                  <button
                    onClick={() => handleDownloadPdf(selectedBundle.id)}
                    className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-lg text-sm font-medium text-[var(--tulip-forest)] transition-all hover:opacity-90 bg-[var(--tulip-gold)] hover:bg-[var(--tulip-orange)]"
                  >
                    <Download size={14} />
                    {t('downloadMasterReport')}
                  </button>
                ) : null}
              </div>

              {/* Documents in bundle */}
              {selectedBundle.ocrJobs && selectedBundle.ocrJobs.length > 0 ? (
                <div className="p-5 rounded-2xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)]">
                  <h4 className="font-semibold text-sm text-[var(--tulip-forest)]/70 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <FileText size={14} className="text-[var(--tulip-forest)]" />
                    {t('documentsCount', { count: selectedBundle.ocrJobs.length })}
                  </h4>
                  <div className="space-y-2">
                    {selectedBundle.ocrJobs.map((job, i) => (
                      <div key={job.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)]">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="text-[var(--tulip-forest)]/30 text-xs font-mono w-5 text-right">{i + 1}</span>
                          <span className="text-sm text-[var(--tulip-forest)] truncate">{job.originalFilename}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {job.documentType ? (
                            <span className="text-[10px] text-[var(--tulip-forest)]/40 uppercase">{job.documentType}</span>
                          ) : null}
                          {job.assessmentResult ? (
                            <RiskBadge level={job.assessmentResult} score={job.assessmentScore} t={t} />
                          ) : (
                            <StatusBadge status={job.status} />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Cross-analysis results */}
              {cross ? (
                <>
                  {/* Summary & scores */}
                  <div className="p-5 rounded-2xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)]">
                    <h4 className="font-semibold text-sm text-[var(--tulip-forest)]/70 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <ShieldCheck size={14} className="text-green-400" />
                      {t('crossAnalysisResults')}
                    </h4>
                    <div className="flex items-center gap-4 mb-3">
                      <RiskBadge level={cross.bundleRiskLevel} score={cross.bundleRiskScore} t={t} />
                      <span className="text-xs text-[var(--tulip-forest)]/40">
                        {t('consistency', { score: cross.consistencyScore })}
                      </span>
                      <span className={`text-xs font-semibold uppercase ${
                        cross.overallRecommendation === 'approve' ? 'text-green-400' :
                        cross.overallRecommendation === 'review' ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {cross.overallRecommendation}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--tulip-forest)]/70">{cross.summary}</p>
                    {cross.overallRecommendationReason ? (
                      <p className="text-xs text-[var(--tulip-forest)]/60 mt-2">{t('reason', { reason: cross.overallRecommendationReason })}</p>
                    ) : null}
                  </div>

                  {/* Cross-check findings */}
                  {cross.crossChecks && cross.crossChecks.length > 0 ? (
                    <div className="p-5 rounded-2xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)]">
                      <h4 className="font-semibold text-sm text-[var(--tulip-forest)]/70 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <AlertTriangle size={14} className="text-yellow-400" />
                        {t('crossCheckFindings', { count: cross.crossChecks.length })}
                      </h4>
                      <div className="space-y-3">
                        {cross.crossChecks.map((check, i) => (
                          <div key={i} className="p-3 rounded-lg bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)]">
                            <div className="flex items-center gap-2 mb-1">
                              <SeverityBadge severity={check.severity} />
                              <span className="text-xs text-[var(--tulip-forest)]/60 uppercase">{check.checkType}</span>
                              <span className="text-xs text-[var(--tulip-forest)]/30">{t('docsLabel', { docs: check.documents?.join(', ') })}</span>
                            </div>
                            <p className="text-sm text-[var(--tulip-forest)]">{check.finding}</p>
                            {check.recommendation ? (
                              <p className="text-xs text-[var(--tulip-forest)]/60 mt-1">{'→ '}{check.recommendation}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Document relationships */}
                  {cross.documentRelationships && cross.documentRelationships.length > 0 ? (
                    <div className="p-5 rounded-2xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)]">
                      <h4 className="font-semibold text-sm text-[var(--tulip-forest)]/70 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <ArrowRightLeft size={14} className="text-indigo-400" />
                        {t('documentRelationships')}
                      </h4>
                      <div className="space-y-2">
                        {cross.documentRelationships.map((rel, i) => {
                          const d1 = selectedBundle.ocrJobs[rel.doc1 - 1]?.originalFilename || `Doc ${rel.doc1}`
                          const d2 = selectedBundle.ocrJobs[rel.doc2 - 1]?.originalFilename || `Doc ${rel.doc2}`
                          return (
                            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] text-sm">
                              <span className="text-[var(--tulip-forest)] truncate flex-1">{d1}</span>
                              <span className="text-[var(--tulip-forest)]/30">↔</span>
                              <span className="text-[var(--tulip-forest)] truncate flex-1">{d2}</span>
                              <span className="text-xs text-[var(--tulip-forest)]/40 shrink-0">{rel.relationship}</span>
                              <span className="text-[10px] text-[var(--tulip-forest)]/30 shrink-0">{rel.confidence}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}

                  {/* Missing documents */}
                  {cross.missingDocuments && cross.missingDocuments.length > 0 ? (
                    <div className="p-5 rounded-2xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)]">
                      <h4 className="font-semibold text-sm text-[var(--tulip-forest)]/70 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <FileWarning size={14} className="text-orange-400" />
                        {t('missingDocuments')}
                      </h4>
                      <div className="space-y-1.5">
                        {cross.missingDocuments.map((doc, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm text-yellow-400/80">
                            <AlertTriangle size={12} />
                            {doc}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
