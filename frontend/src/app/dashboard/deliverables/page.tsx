'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import { FileCheck, X, AlertTriangle, Clock, CheckCircle2, Send, Loader2, Upload, Paperclip, Trash2 } from 'lucide-react'

interface DeliverableRequest {
  id: string
  title: string
  description: string
  type: string
  deadline: string
  status: string
  donorOrgName: string
  projectName: string
  projectId: string
  reworkNote?: string
  attachments?: { name: string; url: string }[]
}

interface DeliverableCounts {
  all: number
  open: number
  rework: number
  overdue: number
  confirmed: number
}

interface UploadedFile {
  id: string
  name: string
  uploading: boolean
  error?: string
}

const TABS = ['All', 'Open', 'Rework', 'Overdue', 'Confirmed'] as const
type Tab = typeof TABS[number]

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  Report:    { bg: 'var(--tulip-sage)', text: 'var(--tulip-forest)' },
  Photos:    { bg: '#fef3c7', text: '#92400e' },
  Financial: { bg: '#dbeafe', text: '#1e40af' },
  Status:    { bg: '#f3e8ff', text: '#6b21a8' },
  Custom:    { bg: '#fce7f3', text: '#9d174d' },
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  OPEN:      { bg: 'var(--tulip-sage)', text: 'var(--tulip-forest)' },
  REWORK:    { bg: '#fef3c7', text: '#92400e' },
  OVERDUE:   { bg: '#fee2e2', text: '#991b1b' },
  CONFIRMED: { bg: '#d1fae5', text: '#065f46' },
  SUBMITTED: { bg: '#dbeafe', text: '#1e40af' },
  RESUBMITTED: { bg: '#f3e8ff', text: '#6b21a8' },
}

function deadlineColor(deadline: string, status: string): string {
  if (status === 'CONFIRMED' || status === 'SUBMITTED') return 'var(--tulip-forest)'
  const now = Date.now()
  const dl = new Date(deadline).getTime()
  const diff = dl - now
  if (diff < 0) return '#dc2626'
  if (diff < 7 * 24 * 60 * 60 * 1000) return '#d97706'
  return 'var(--tulip-forest)'
}

const API_URL = process.env.NEXT_PUBLIC_API_URL

export default function DeliverablesPage() {
  const [requests, setRequests] = useState<DeliverableRequest[]>([])
  const [counts, setCounts] = useState<DeliverableCounts>({ all: 0, open: 0, rework: 0, overdue: 0, confirmed: 0 })
  const [activeTab, setActiveTab] = useState<Tab>('All')
  const [loading, setLoading] = useState(true)
  const [submitModal, setSubmitModal] = useState<DeliverableRequest | null>(null)
  const [submitNote, setSubmitNote] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await apiGet('/api/ngo/deliverables')
      if (res.ok) {
        const data = await res.json()
        setRequests(data.requests || [])
        setCounts(data.counts || { all: 0, open: 0, rework: 0, overdue: 0, confirmed: 0 })
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const filtered = activeTab === 'All'
    ? requests
    : requests.filter(r => r.status === activeTab.toUpperCase())

  const openSubmitModal = (req: DeliverableRequest) => {
    setSubmitModal(req)
    setSubmitNote('')
    setUploadedFiles([])
  }

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || !submitModal) return
    const token = typeof window !== 'undefined' ? localStorage.getItem('tulip_token') : null
    if (!token) return

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const tempId = `temp-${Date.now()}-${i}`
      setUploadedFiles(prev => [...prev, { id: tempId, name: file.name, uploading: true }])

      try {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('name', file.name)
        fd.append('documentType', 'Other')
        fd.append('documentLevel', 'project')
        fd.append('projectId', submitModal.projectId)

        const res = await fetch(`${API_URL}/api/documents`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        })
        if (res.ok) {
          const data = await res.json()
          const docId = data.document?.id || data.id
          setUploadedFiles(prev => prev.map(f => f.id === tempId ? { id: docId, name: file.name, uploading: false } : f))
        } else {
          setUploadedFiles(prev => prev.map(f => f.id === tempId ? { ...f, uploading: false, error: 'Upload failed' } : f))
        }
      } catch {
        setUploadedFiles(prev => prev.map(f => f.id === tempId ? { ...f, uploading: false, error: 'Upload failed' } : f))
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id))
  }

  const handleSubmit = async () => {
    if (!submitModal) return
    setSubmitting(true)
    try {
      const documentIds = uploadedFiles
        .filter(f => !f.uploading && !f.error)
        .map(f => f.id)
      const res = await apiPost(`/api/ngo/deliverables/${submitModal.id}/submit`, {
        note: submitNote,
        documentIds,
      })
      if (res.ok) {
        setToast(`Submitted to ${submitModal.donorOrgName}`)
        setSubmitModal(null)
        fetchData()
        setTimeout(() => setToast(''), 4000)
      }
    } catch {
      // silently fail
    } finally {
      setSubmitting(false)
    }
  }

  const tabCount = (tab: Tab): number => {
    if (tab === 'All') return counts.all
    return counts[tab.toLowerCase() as keyof Omit<DeliverableCounts, 'all'>] || 0
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto" style={{ background: 'var(--tulip-cream)', minHeight: '100%' }}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--tulip-gold)' }}>
            <FileCheck size={20} style={{ color: 'var(--tulip-forest)' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--tulip-forest)' }}>Deliverable Requests</h1>
            <p className="text-sm" style={{ color: 'var(--tulip-forest)', opacity: 0.6 }}>Documents and reports requested by your donors</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: activeTab === tab ? 'var(--tulip-forest)' : 'var(--tulip-sage)',
              color: activeTab === tab ? 'var(--tulip-cream)' : 'var(--tulip-forest)',
              border: '1px solid var(--tulip-sage-dark)',
            }}
          >
            {tab}
            <span
              className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
              style={{
                background: activeTab === tab ? 'var(--tulip-gold)' : 'var(--tulip-sage-dark)',
                color: 'var(--tulip-forest)',
              }}
            >
              {tabCount(tab)}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--tulip-forest)' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 rounded-xl border" style={{ background: 'var(--tulip-sage)', borderColor: 'var(--tulip-sage-dark)' }}>
          <FileCheck size={40} className="mx-auto mb-3" style={{ color: 'var(--tulip-forest)', opacity: 0.3 }} />
          <p className="text-sm" style={{ color: 'var(--tulip-forest)', opacity: 0.5 }}>No deliverable requests found</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--tulip-sage-dark)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--tulip-sage)' }}>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--tulip-forest)' }}>PROJECT</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--tulip-forest)' }}>REQUEST</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--tulip-forest)' }}>TYPE</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--tulip-forest)' }}>DEADLINE</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--tulip-forest)' }}>STATUS</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--tulip-forest)' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(req => {
                  const typeStyle = TYPE_COLORS[req.type] || TYPE_COLORS.Custom
                  const statusStyle = STATUS_COLORS[req.status] || STATUS_COLORS.OPEN
                  const canSubmit = ['OPEN', 'OVERDUE', 'REWORK'].includes(req.status)
                  return (
                    <tr key={req.id} className="border-t" style={{ borderColor: 'var(--tulip-sage-dark)' }}>
                      <td className="px-4 py-3 font-medium" style={{ color: 'var(--tulip-forest)' }}>{req.projectName}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--tulip-forest)' }}>
                        {req.title}
                        {req.attachments && req.attachments.length > 0 && (
                          <span className="ml-2 text-xs" style={{ color: 'var(--tulip-forest)', opacity: 0.5 }}>
                            <Paperclip size={10} className="inline" /> {req.attachments.length}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-1 rounded-full text-xs font-medium"
                          style={{ background: typeStyle.bg, color: typeStyle.text }}
                        >
                          {req.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: deadlineColor(req.deadline, req.status) }}>
                          {deadlineColor(req.deadline, req.status) === '#dc2626' && <AlertTriangle size={14} />}
                          {deadlineColor(req.deadline, req.status) === '#d97706' && <Clock size={14} />}
                          {new Date(req.deadline).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-1 rounded-full text-xs font-medium"
                          style={{ background: statusStyle.bg, color: statusStyle.text }}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {canSubmit ? (
                          <button
                            onClick={() => openSubmitModal(req)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                            style={{ background: 'var(--tulip-gold)', color: 'var(--tulip-forest)' }}
                          >
                            <Send size={12} />
                            Submit
                          </button>
                        ) : (
                          <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--tulip-forest)', opacity: 0.4 }}>
                            <CheckCircle2 size={14} />
                            Done
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Submit Modal */}
      {submitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSubmitModal(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            style={{ background: 'var(--tulip-cream)', border: '1px solid var(--tulip-sage-dark)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--tulip-sage-dark)', background: 'var(--tulip-sage)' }}>
              <h2 className="text-lg font-bold" style={{ color: 'var(--tulip-forest)' }}>Submit Deliverable</h2>
              <button onClick={() => setSubmitModal(null)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--tulip-sage-dark)] transition-colors">
                <X size={16} style={{ color: 'var(--tulip-forest)' }} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Donor Request Info (read-only) */}
              <div className="rounded-xl p-4 space-y-2" style={{ background: 'var(--tulip-sage)', border: '1px solid var(--tulip-sage-dark)' }}>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--tulip-forest)', opacity: 0.5 }}>Donor Request</p>
                <p className="text-sm font-semibold" style={{ color: 'var(--tulip-forest)' }}>{submitModal.title}</p>
                <p className="text-sm" style={{ color: 'var(--tulip-forest)', opacity: 0.7 }}>{submitModal.description}</p>
                <div className="flex items-center gap-4 pt-1">
                  <span className="text-xs" style={{ color: 'var(--tulip-forest)', opacity: 0.5 }}>
                    Deadline: {new Date(submitModal.deadline).toLocaleDateString()}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--tulip-forest)', opacity: 0.5 }}>
                    From: {submitModal.donorOrgName}
                  </span>
                </div>
                {/* Show donor attachments if any */}
                {submitModal.attachments && submitModal.attachments.length > 0 && (
                  <div className="pt-2 space-y-1">
                    <p className="text-xs font-medium" style={{ color: 'var(--tulip-forest)', opacity: 0.5 }}>Reference files from donor:</p>
                    {submitModal.attachments.map((att, i) => (
                      <a key={i} href={att.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs hover:underline" style={{ color: '#1e40af' }}>
                        <Paperclip size={12} /> {att.name}
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Rework Note */}
              {submitModal.status === 'REWORK' && submitModal.reworkNote && (
                <div className="rounded-xl p-4" style={{ background: '#fef3c7', border: '1px solid #fbbf24' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle size={14} style={{ color: '#92400e' }} />
                    <p className="text-xs font-semibold" style={{ color: '#92400e' }}>Rework Requested</p>
                  </div>
                  <p className="text-sm" style={{ color: '#92400e' }}>{submitModal.reworkNote}</p>
                </div>
              )}

              {/* Submission Note */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--tulip-forest)' }}>Submission Note</label>
                <textarea
                  value={submitNote}
                  onChange={e => setSubmitNote(e.target.value)}
                  placeholder="Describe what you're submitting..."
                  rows={3}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
                  style={{ background: 'var(--tulip-sage)', border: '1px solid var(--tulip-sage-dark)', color: 'var(--tulip-forest)' }}
                />
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--tulip-forest)' }}>Attach Files</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xlsx,.xls,.jpg,.jpeg,.png,.csv"
                  onChange={e => handleFileSelect(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full rounded-xl border-2 border-dashed px-4 py-6 flex flex-col items-center gap-2 transition-all hover:border-[var(--tulip-forest)]"
                  style={{ borderColor: 'var(--tulip-sage-dark)', background: 'var(--tulip-sage)' }}
                >
                  <Upload size={20} style={{ color: 'var(--tulip-forest)', opacity: 0.4 }} />
                  <span className="text-sm" style={{ color: 'var(--tulip-forest)', opacity: 0.6 }}>Click to browse files</span>
                  <span className="text-xs" style={{ color: 'var(--tulip-forest)', opacity: 0.3 }}>PDF, Word, Excel, Images (max 20MB each)</span>
                </button>

                {/* Uploaded files list */}
                {uploadedFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {uploadedFiles.map(f => (
                      <div key={f.id} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--tulip-sage)', border: '1px solid var(--tulip-sage-dark)' }}>
                        {f.uploading ? (
                          <Loader2 size={14} className="animate-spin" style={{ color: 'var(--tulip-forest)' }} />
                        ) : f.error ? (
                          <X size={14} style={{ color: '#dc2626' }} />
                        ) : (
                          <CheckCircle2 size={14} style={{ color: '#16a34a' }} />
                        )}
                        <span className="flex-1 text-sm truncate" style={{ color: f.error ? '#dc2626' : 'var(--tulip-forest)' }}>{f.name}</span>
                        {!f.uploading && (
                          <button onClick={() => removeFile(f.id)} className="p-0.5 rounded hover:bg-[var(--tulip-sage-dark)] transition-colors">
                            <Trash2 size={12} style={{ color: 'var(--tulip-forest)', opacity: 0.5 }} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--tulip-sage-dark)' }}>
              <button
                onClick={() => setSubmitModal(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-80"
                style={{ background: 'var(--tulip-sage)', color: 'var(--tulip-forest)', border: '1px solid var(--tulip-sage-dark)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || uploadedFiles.some(f => f.uploading)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-80 disabled:opacity-50"
                style={{ background: 'var(--tulip-gold)', color: 'var(--tulip-forest)' }}
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2"
          style={{ background: 'var(--tulip-forest)', color: 'var(--tulip-cream)' }}
        >
          <CheckCircle2 size={16} style={{ color: 'var(--tulip-gold)' }} />
          {toast}
        </div>
      )}
    </div>
  )
}
