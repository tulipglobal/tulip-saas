'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiFetch, apiGet } from '@/lib/api'
import {
  Briefcase, Plus, Search, Copy, ExternalLink, ChevronRight, X,
  FileCheck, FolderSearch, AlertTriangle, CheckCircle, Clock, Archive, Eye, Download
} from 'lucide-react'

interface Case {
  id: string
  name: string
  clientName: string
  clientEmail: string | null
  caseType: string
  status: string
  shareToken: string
  overallRiskScore: number | null
  createdAt: string
  updatedAt: string
  _count?: { ocrJobs: number; bundleJobs: number }
  ocrJobs?: OcrJob[]
  bundleJobs?: BundleJob[]
}

interface OcrJob {
  id: string
  originalFilename: string
  status: string
  documentType: string | null
  assessmentScore: number | null
  assessmentResult: string | null
  hashValue: string | null
  anchorTxHash: string | null
  anchoredAt: string | null
  createdAt: string
}

interface BundleJob {
  id: string
  name: string
  status: string
  fileCount: number
  completedCount: number
  overallRiskScore: number | null
  overallRiskLevel: string | null
  bundleHash: string | null
  anchorTxHash: string | null
  anchoredAt: string | null
  crossAnalysisJson: any
  createdAt: string
}

const TYPE_COLORS: Record<string, string> = {
  MORTGAGE: 'bg-blue-400/15 text-blue-400',
  INSURANCE: 'bg-purple-400/15 text-purple-400',
  REAL_ESTATE: 'bg-emerald-400/15 text-emerald-400',
  KYC: 'bg-amber-400/15 text-amber-400',
  OTHER: 'bg-gray-400/15 text-gray-400',
}

const STATUS_CONFIG: Record<string, { color: string; icon: any }> = {
  OPEN: { color: 'bg-green-400/15 text-green-400', icon: Clock },
  COMPLETE: { color: 'bg-blue-400/15 text-blue-400', icon: CheckCircle },
  ARCHIVED: { color: 'bg-gray-400/15 text-gray-400', icon: Archive },
}

function riskColor(score: number | null) {
  if (score === null) return 'text-gray-500'
  if (score >= 80) return 'text-green-400'
  if (score >= 60) return 'text-yellow-400'
  return 'text-red-400'
}

function riskLabel(score: number | null) {
  if (score === null) return 'N/A'
  if (score >= 80) return 'Low Risk'
  if (score >= 60) return 'Medium'
  return 'High Risk'
}

export default function CasesPage() {
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // Create modal
  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createClient, setCreateClient] = useState('')
  const [createEmail, setCreateEmail] = useState('')
  const [createType, setCreateType] = useState('OTHER')
  const [creating, setCreating] = useState(false)

  // Detail view
  const [selectedCase, setSelectedCase] = useState<Case | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  // Add document/bundle modals
  const [showAddDoc, setShowAddDoc] = useState(false)
  const [showAddBundle, setShowAddBundle] = useState(false)
  const [availableJobs, setAvailableJobs] = useState<OcrJob[]>([])
  const [availableBundles, setAvailableBundles] = useState<BundleJob[]>([])

  // Document preview modal
  const [previewDoc, setPreviewDoc] = useState<OcrJob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const openDocPreview = async (job: OcrJob) => {
    setPreviewDoc(job)
    setPreviewUrl(null)
    setPreviewLoading(true)
    try {
      const r = await apiGet(`/api/public/ocr/${job.id}/document`)
      if (r.ok) {
        const d = await r.json()
        if (d.url) setPreviewUrl(d.url)
      }
    } catch {}
    setPreviewLoading(false)
  }

  const fetchCases = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (filterType) params.set('caseType', filterType)
      if (filterStatus) params.set('status', filterStatus)
      const r = await apiGet(`/api/cases?${params.toString()}`)
      if (r.ok) {
        const d = await r.json()
        setCases(d.data || [])
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }, [search, filterType, filterStatus])

  useEffect(() => { fetchCases() }, [fetchCases])

  const handleCreate = async () => {
    if (!createName.trim() || !createClient.trim()) return
    setCreating(true)
    try {
      const r = await apiFetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createName,
          clientName: createClient,
          clientEmail: createEmail || undefined,
          caseType: createType,
        }),
      })
      if (r.ok) {
        setShowCreate(false)
        setCreateName('')
        setCreateClient('')
        setCreateEmail('')
        setCreateType('OTHER')
        fetchCases()
      }
    } catch {
    } finally {
      setCreating(false)
    }
  }

  const openDetail = async (c: Case) => {
    setDetailLoading(true)
    setSelectedCase(c)
    try {
      const r = await apiGet(`/api/cases/${c.id}`)
      if (r.ok) {
        const d = await r.json()
        setSelectedCase(d)
      }
    } catch {
    } finally {
      setDetailLoading(false)
    }
  }

  const updateStatus = async (id: string, status: string) => {
    await apiFetch(`/api/cases/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    fetchCases()
    if (selectedCase?.id === id) openDetail({ ...selectedCase, status } as Case)
  }

  const archiveCase = async (id: string) => {
    await apiFetch(`/api/cases/${id}`, { method: 'DELETE' })
    fetchCases()
    if (selectedCase?.id === id) setSelectedCase(null)
  }

  const copyShareLink = (token: string) => {
    navigator.clipboard.writeText(`https://verify.tulipds.com/case/${token}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const loadAvailableJobs = async () => {
    const r = await apiGet('/api/ocr/jobs?limit=50')
    if (r.ok) {
      const d = await r.json()
      setAvailableJobs((d.data || d).filter((j: OcrJob) => j.status === 'completed'))
    }
    setShowAddDoc(true)
  }

  const loadAvailableBundles = async () => {
    const r = await apiGet('/api/ocr/bundles?limit=50')
    if (r.ok) {
      const d = await r.json()
      setAvailableBundles((d.data || d).filter((b: BundleJob) => b.status === 'completed'))
    }
    setShowAddBundle(true)
  }

  const addDocToCase = async (ocrJobId: string) => {
    if (!selectedCase) return
    await apiFetch(`/api/cases/${selectedCase.id}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ocrJobId }),
    })
    setShowAddDoc(false)
    openDetail(selectedCase)
  }

  const addBundleToCase = async (bundleJobId: string) => {
    if (!selectedCase) return
    await apiFetch(`/api/cases/${selectedCase.id}/bundles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bundleJobId }),
    })
    setShowAddBundle(false)
    openDetail(selectedCase)
  }

  // ─── Detail Panel ───
  if (selectedCase) {
    const c = selectedCase
    const StatusIcon = STATUS_CONFIG[c.status]?.icon || Clock
    return (
      <div className="p-4 md:p-8 space-y-6 max-w-6xl">
        {/* Back + Header */}
        <button onClick={() => setSelectedCase(null)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors">
          <ChevronRight size={14} className="rotate-180" /> Back to Cases
        </button>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{c.name}</h1>
            <p className="text-gray-500 mt-1">Client: {c.clientName} {c.clientEmail && `(${c.clientEmail})`}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${TYPE_COLORS[c.caseType] || TYPE_COLORS.OTHER}`}>
              {c.caseType.replace('_', ' ')}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 ${STATUS_CONFIG[c.status]?.color || ''}`}>
              <StatusIcon size={12} /> {c.status}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <button onClick={() => copyShareLink(c.shareToken)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 text-[#2563EB] hover:bg-[#2563EB]/30 transition-all text-sm font-medium">
            <Copy size={14} /> {copied ? 'Copied!' : 'Copy Share Link'}
          </button>
          <a href={`https://verify.tulipds.com/case/${c.shareToken}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 transition-all text-sm font-medium">
            <ExternalLink size={14} /> Preview Public Page
          </a>
          {c.status === 'OPEN' && (
            <button onClick={() => updateStatus(c.id, 'COMPLETE')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-400/15 text-green-400 hover:bg-green-400/25 transition-all text-sm font-medium">
              <CheckCircle size={14} /> Mark Complete
            </button>
          )}
          {c.status === 'COMPLETE' && (
            <button onClick={() => updateStatus(c.id, 'OPEN')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-400/15 text-yellow-400 hover:bg-yellow-400/25 transition-all text-sm font-medium">
              <Clock size={14} /> Reopen
            </button>
          )}
          {c.status !== 'ARCHIVED' && (
            <button onClick={() => archiveCase(c.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-400/10 text-red-400 hover:bg-red-400/20 transition-all text-sm font-medium">
              <Archive size={14} /> Archive
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">Documents</div>
            <div className="text-2xl font-bold text-gray-900">{c.ocrJobs?.length || 0}</div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">Bundles</div>
            <div className="text-2xl font-bold text-gray-900">{c.bundleJobs?.length || 0}</div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">Overall Risk</div>
            <div className={`text-2xl font-bold ${riskColor(c.overallRiskScore)}`}>
              {c.overallRiskScore !== null ? `${c.overallRiskScore}/100` : 'N/A'}
            </div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">Created</div>
            <div className="text-sm font-medium text-gray-900">{new Date(c.createdAt).toLocaleDateString()}</div>
          </div>
        </div>

        {/* Documents */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2"><FileCheck size={16} /> Documents</h2>
            <button onClick={loadAvailableJobs}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-[#2563EB] hover:bg-[#2563EB]/30 transition-all text-xs font-medium">
              <Plus size={12} /> Add Document
            </button>
          </div>
          {(!c.ocrJobs || c.ocrJobs.length === 0) ? (
            <div className="p-8 text-center text-gray-400 text-sm">No documents added yet</div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {c.ocrJobs.map(job => (
                <div key={job.id} className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-400/10 flex items-center justify-center">
                    <FileCheck size={18} className="text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{job.originalFilename}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{job.documentType || 'Unknown type'}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-semibold ${riskColor(job.assessmentScore)}`}>
                      {job.assessmentScore !== null ? `${job.assessmentScore}/100` : '—'}
                    </div>
                    <div className="text-xs text-gray-500">{job.assessmentResult || ''}</div>
                  </div>
                  {job.hashValue && (
                    <code className="hidden md:block text-[10px] text-gray-400 font-mono max-w-[120px] truncate">{job.hashValue}</code>
                  )}
                  {job.anchorTxHash ? (
                    <a href={`https://polygonscan.com/tx/${job.anchorTxHash}`} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-green-400 hover:underline whitespace-nowrap">On-chain</a>
                  ) : (
                    <span className="text-xs text-yellow-400/60 whitespace-nowrap">Pending</span>
                  )}
                  <button onClick={() => openDocPreview(job)}
                    className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all shrink-0"
                    title="Preview document">
                    <Eye size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bundles */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2"><FolderSearch size={16} /> Bundles</h2>
            <button onClick={loadAvailableBundles}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-[#2563EB] hover:bg-[#2563EB]/30 transition-all text-xs font-medium">
              <Plus size={12} /> Add Bundle
            </button>
          </div>
          {(!c.bundleJobs || c.bundleJobs.length === 0) ? (
            <div className="p-8 text-center text-gray-400 text-sm">No bundles added yet</div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {c.bundleJobs.map(bundle => (
                <div key={bundle.id} className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-purple-400/10 flex items-center justify-center">
                      <FolderSearch size={18} className="text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">{bundle.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{bundle.fileCount} files</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-semibold ${riskColor(bundle.overallRiskScore)}`}>
                        {bundle.overallRiskScore !== null ? `${bundle.overallRiskScore}/100` : '—'}
                      </div>
                      <div className="text-xs text-gray-500">{bundle.overallRiskLevel || ''}</div>
                    </div>
                    {bundle.anchorTxHash ? (
                      <a href={`https://polygonscan.com/tx/${bundle.anchorTxHash}`} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-green-400 hover:underline whitespace-nowrap">On-chain</a>
                    ) : (
                      <span className="text-xs text-yellow-400/60 whitespace-nowrap">Pending</span>
                    )}
                  </div>
                  {bundle.crossAnalysisJson && (() => {
                    const analysis = typeof bundle.crossAnalysisJson === 'string'
                      ? (() => { try { return JSON.parse(bundle.crossAnalysisJson) } catch { return null } })()
                      : bundle.crossAnalysisJson
                    if (!analysis) return null
                    const severityColor = (s: string) => {
                      const sl = (s || '').toLowerCase()
                      if (sl === 'critical' || sl === 'high') return 'bg-red-400/15 text-red-400 border-red-400/20'
                      if (sl === 'medium' || sl === 'warning') return 'bg-yellow-400/15 text-yellow-400 border-yellow-400/20'
                      return 'bg-green-400/15 text-green-400 border-green-400/20'
                    }
                    return (
                      <div className="mt-3 ml-14 space-y-3">
                        {analysis.summary && (
                          <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                            <div className="text-xs font-medium text-gray-600 mb-1.5">Summary</div>
                            <div className="text-sm text-gray-700 leading-relaxed">{analysis.summary}</div>
                          </div>
                        )}
                        {analysis.findings && Array.isArray(analysis.findings) && analysis.findings.length > 0 && (
                          <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                            <div className="text-xs font-medium text-gray-600 mb-2">Findings</div>
                            <div className="space-y-2">
                              {analysis.findings.map((f: any, idx: number) => (
                                <div key={idx} className="flex items-start gap-2">
                                  <span className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${severityColor(f.severity || f.level || 'low')}`}>
                                    {f.severity || f.level || 'info'}
                                  </span>
                                  <span className="text-xs text-gray-500 leading-relaxed">{f.description || f.message || f.text || JSON.stringify(f)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {analysis.inconsistencies && Array.isArray(analysis.inconsistencies) && analysis.inconsistencies.length > 0 && (
                          <div className="p-3 rounded-lg bg-red-400/5 border border-red-400/10">
                            <div className="text-xs font-medium text-red-400/80 mb-2">Inconsistencies Detected</div>
                            <div className="space-y-1.5">
                              {analysis.inconsistencies.map((inc: any, idx: number) => (
                                <div key={idx} className="flex items-start gap-2 text-xs text-red-400/60">
                                  <span className="shrink-0 mt-0.5">&#x26A0;</span>
                                  <span>{typeof inc === 'string' ? inc : inc.description || inc.message || JSON.stringify(inc)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {analysis.missingDocuments && Array.isArray(analysis.missingDocuments) && analysis.missingDocuments.length > 0 && (
                          <div className="p-3 rounded-lg bg-yellow-400/5 border border-yellow-400/10">
                            <div className="text-xs font-medium text-yellow-400/80 mb-2">Missing Documents</div>
                            <div className="space-y-1 text-xs text-yellow-400/60">
                              {analysis.missingDocuments.map((doc: any, idx: number) => (
                                <div key={idx}>&#x2022; {typeof doc === 'string' ? doc : doc.name || doc.type || JSON.stringify(doc)}</div>
                              ))}
                            </div>
                          </div>
                        )}
                        {!analysis.summary && !analysis.findings && !analysis.inconsistencies && (
                          <div className="p-3 rounded-lg bg-white border border-gray-100">
                            <div className="text-xs font-medium text-gray-600 mb-1">Cross-Analysis</div>
                            <div className="text-xs text-gray-500 whitespace-pre-wrap">{JSON.stringify(analysis, null, 2)}</div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Document Preview Modal */}
        {previewDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setPreviewDoc(null)}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="relative bg-[#0a1929] border border-gray-200 rounded-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900 text-lg truncate pr-4">{previewDoc.originalFilename}</h3>
                <button onClick={() => setPreviewDoc(null)} className="text-gray-500 hover:text-gray-900 shrink-0"><X size={18} /></button>
              </div>
              <div className="p-5 space-y-4">
                {/* Document preview */}
                {previewLoading ? (
                  <div className="flex items-center justify-center py-16 bg-white rounded-xl border border-gray-200">
                    <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
                    <span className="ml-3 text-sm text-gray-500">Loading document...</span>
                  </div>
                ) : previewUrl ? (
                  <div className="rounded-xl overflow-hidden border border-gray-200 bg-white">
                    {previewUrl.match(/\.(jpg|jpeg|png|gif|webp)/i) || previewDoc.originalFilename.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                      <img src={previewUrl} alt={previewDoc.originalFilename} className="max-h-[400px] w-full object-contain" />
                    ) : (
                      <iframe src={previewUrl} className="w-full h-[400px]" title="Document preview" />
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-12 bg-white rounded-xl border border-gray-200">
                    <span className="text-sm text-gray-400">Document preview not available</span>
                  </div>
                )}

                {/* Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="text-[10px] text-gray-500 uppercase font-medium mb-1">Document Type</div>
                    <div className="text-sm text-gray-900">{previewDoc.documentType || 'Unknown'}</div>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="text-[10px] text-gray-500 uppercase font-medium mb-1">Risk Score</div>
                    <div className={`text-sm font-semibold ${riskColor(previewDoc.assessmentScore)}`}>
                      {previewDoc.assessmentScore !== null ? `${previewDoc.assessmentScore}/100` : 'N/A'}
                    </div>
                    {previewDoc.assessmentResult && (
                      <div className="text-xs text-gray-500 mt-0.5">{previewDoc.assessmentResult}</div>
                    )}
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="text-[10px] text-gray-500 uppercase font-medium mb-1">Blockchain</div>
                    {previewDoc.anchorTxHash ? (
                      <a href={`https://polygonscan.com/tx/${previewDoc.anchorTxHash}`} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-green-400 hover:underline flex items-center gap-1">
                        <CheckCircle size={12} /> Anchored
                      </a>
                    ) : (
                      <span className="text-xs text-yellow-400 flex items-center gap-1"><Clock size={12} /> Pending</span>
                    )}
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="text-[10px] text-gray-500 uppercase font-medium mb-1">Processed</div>
                    <div className="text-sm text-gray-900">{new Date(previewDoc.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>

                {/* Hash */}
                {previewDoc.hashValue && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="text-[10px] text-gray-500 uppercase font-medium mb-1">SHA-256 Hash</div>
                    <code className="text-xs text-gray-600 font-mono break-all">{previewDoc.hashValue}</code>
                  </div>
                )}

                {/* Polygon TX */}
                {previewDoc.anchorTxHash && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="text-[10px] text-gray-500 uppercase font-medium mb-1">Polygon Transaction</div>
                    <a href={`https://polygonscan.com/tx/${previewDoc.anchorTxHash}`} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-[#2563EB] hover:underline font-mono break-all">
                      {previewDoc.anchorTxHash}
                    </a>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 p-5 border-t border-gray-200">
                {previewUrl && (
                  <a href={previewUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 transition-all text-sm">
                    <Download size={14} /> Download
                  </a>
                )}
                <button onClick={() => setPreviewDoc(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)' }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Document Modal */}
        {showAddDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowAddDoc(false)}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="relative bg-[#0a1929] border border-gray-200 rounded-xl w-full max-w-lg max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Add Document to Case</h3>
                <button onClick={() => setShowAddDoc(false)} className="text-gray-500 hover:text-gray-900"><X size={16} /></button>
              </div>
              {availableJobs.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">No completed OCR jobs available. Process documents in the OCR Engine first.</div>
              ) : (
                <div className="divide-y divide-white/[0.06]">
                  {availableJobs.map(job => (
                    <button key={job.id} onClick={() => addDocToCase(job.id)}
                      className="w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left">
                      <FileCheck size={16} className="text-blue-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-900 truncate">{job.originalFilename}</div>
                        <div className="text-xs text-gray-500">{job.documentType || 'Unknown'} {job.assessmentScore !== null ? `— ${job.assessmentScore}/100` : ''}</div>
                      </div>
                      <Plus size={14} className="text-gray-400" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Add Bundle Modal */}
        {showAddBundle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowAddBundle(false)}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="relative bg-[#0a1929] border border-gray-200 rounded-xl w-full max-w-lg max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Add Bundle to Case</h3>
                <button onClick={() => setShowAddBundle(false)} className="text-gray-500 hover:text-gray-900"><X size={16} /></button>
              </div>
              {availableBundles.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">No completed bundles available. Create a bundle in Bundle Verify first.</div>
              ) : (
                <div className="divide-y divide-white/[0.06]">
                  {availableBundles.map(b => (
                    <button key={b.id} onClick={() => addBundleToCase(b.id)}
                      className="w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left">
                      <FolderSearch size={16} className="text-purple-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-900 truncate">{b.name}</div>
                        <div className="text-xs text-gray-500">{b.fileCount} files {b.overallRiskScore !== null ? `— ${b.overallRiskScore}/100` : ''}</div>
                      </div>
                      <Plus size={14} className="text-gray-400" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── List View ───
  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cases</h1>
          <p className="text-sm text-gray-500 mt-1">Organise documents into client cases and share verification links</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)' }}>
          <Plus size={16} /> New Case
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 flex-1 min-w-[200px] max-w-md">
          <Search size={14} className="text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search cases..."
            className="bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none w-full" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none">
          <option value="">All Types</option>
          <option value="MORTGAGE">Mortgage</option>
          <option value="INSURANCE">Insurance</option>
          <option value="REAL_ESTATE">Real Estate</option>
          <option value="KYC">KYC</option>
          <option value="OTHER">Other</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none">
          <option value="">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="COMPLETE">Complete</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      {/* Cases Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : cases.length === 0 ? (
        <div className="text-center py-20">
          <Briefcase size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-600">No cases yet</h3>
          <p className="text-sm text-gray-400 mt-1">Create your first case to start organising documents</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cases.map(c => {
            const StatusIcon = STATUS_CONFIG[c.status]?.icon || Clock
            const docCount = c._count?.ocrJobs || 0
            const bundleCount = c._count?.bundleJobs || 0
            return (
              <button key={c.id} onClick={() => openDetail(c)}
                className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-left hover:bg-gray-50 hover:border-gray-200 transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${TYPE_COLORS[c.caseType] || TYPE_COLORS.OTHER}`}>
                      {c.caseType.replace('_', ' ')}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1 ${STATUS_CONFIG[c.status]?.color || ''}`}>
                      <StatusIcon size={10} /> {c.status}
                    </span>
                  </div>
                  <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1 truncate">{c.name}</h3>
                <p className="text-xs text-gray-500 truncate">{c.clientName}</p>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><FileCheck size={12} /> {docCount}</span>
                    <span className="flex items-center gap-1"><FolderSearch size={12} /> {bundleCount}</span>
                  </div>
                  <div className={`text-xs font-semibold ${riskColor(c.overallRiskScore)}`}>
                    {c.overallRiskScore !== null ? `${c.overallRiskScore}/100` : '—'}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-[#0a1929] border border-gray-200 rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 text-lg">Create New Case</h3>
              <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-gray-900"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Case Name *</label>
                <input value={createName} onChange={e => setCreateName(e.target.value)} placeholder="e.g. Smith Mortgage Application"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#2563EB]/50" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Client Name *</label>
                <input value={createClient} onChange={e => setCreateClient(e.target.value)} placeholder="e.g. John Smith"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#2563EB]/50" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Client Email</label>
                <input value={createEmail} onChange={e => setCreateEmail(e.target.value)} placeholder="john@example.com" type="email"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#2563EB]/50" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Case Type</label>
                <select value={createType} onChange={e => setCreateType(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#2563EB]/50">
                  <option value="MORTGAGE">Mortgage</option>
                  <option value="INSURANCE">Insurance</option>
                  <option value="REAL_ESTATE">Real Estate</option>
                  <option value="KYC">KYC</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-200">
              <button onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:text-gray-900 transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={creating || !createName.trim() || !createClient.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40 transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)' }}>
                {creating ? 'Creating...' : 'Create Case'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
