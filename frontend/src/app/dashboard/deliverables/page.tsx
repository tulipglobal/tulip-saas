'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import { FileCheck, X, AlertTriangle, Clock, CheckCircle2, Send, Loader2 } from 'lucide-react'

interface DeliverableRequest {
  id: string
  title: string
  description: string
  type: string
  deadline: string
  status: string
  donorOrgName: string
  projectName: string
  reworkNote?: string
}

interface DeliverableCounts {
  all: number
  open: number
  rework: number
  overdue: number
  confirmed: number
}

const TABS = ['All', 'Open', 'Rework', 'Overdue', 'Confirmed'] as const
type Tab = typeof TABS[number]

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  Report:    { bg: '#e1eedd', text: '#183a1d' },
  Photos:    { bg: '#fef3c7', text: '#92400e' },
  Financial: { bg: '#dbeafe', text: '#1e40af' },
  Status:    { bg: '#f3e8ff', text: '#6b21a8' },
  Custom:    { bg: '#fce7f3', text: '#9d174d' },
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  OPEN:      { bg: '#e1eedd', text: '#183a1d' },
  REWORK:    { bg: '#fef3c7', text: '#92400e' },
  OVERDUE:   { bg: '#fee2e2', text: '#991b1b' },
  CONFIRMED: { bg: '#d1fae5', text: '#065f46' },
  SUBMITTED: { bg: '#dbeafe', text: '#1e40af' },
}

function deadlineColor(deadline: string, status: string): string {
  if (status === 'CONFIRMED' || status === 'SUBMITTED') return '#183a1d'
  const now = Date.now()
  const dl = new Date(deadline).getTime()
  const diff = dl - now
  if (diff < 0) return '#dc2626'
  if (diff < 7 * 24 * 60 * 60 * 1000) return '#d97706'
  return '#183a1d'
}

export default function DeliverablesPage() {
  const [requests, setRequests] = useState<DeliverableRequest[]>([])
  const [counts, setCounts] = useState<DeliverableCounts>({ all: 0, open: 0, rework: 0, overdue: 0, confirmed: 0 })
  const [activeTab, setActiveTab] = useState<Tab>('All')
  const [loading, setLoading] = useState(true)
  const [submitModal, setSubmitModal] = useState<DeliverableRequest | null>(null)
  const [submitNote, setSubmitNote] = useState('')
  const [submitDocIds, setSubmitDocIds] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState('')

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
    setSubmitDocIds('')
  }

  const handleSubmit = async () => {
    if (!submitModal) return
    setSubmitting(true)
    try {
      const documentIds = submitDocIds
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
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
    <div className="p-6 md:p-8 max-w-7xl mx-auto" style={{ background: '#fefbe9', minHeight: '100%' }}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#f6c453' }}>
            <FileCheck size={20} style={{ color: '#183a1d' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#183a1d' }}>Deliverable Requests</h1>
            <p className="text-sm" style={{ color: '#183a1d', opacity: 0.6 }}>Documents and reports requested by your donors</p>
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
              background: activeTab === tab ? '#183a1d' : '#e1eedd',
              color: activeTab === tab ? '#fefbe9' : '#183a1d',
              border: '1px solid #c8d6c0',
            }}
          >
            {tab}
            <span
              className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
              style={{
                background: activeTab === tab ? '#f6c453' : '#c8d6c0',
                color: '#183a1d',
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
          <Loader2 size={24} className="animate-spin" style={{ color: '#183a1d' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 rounded-xl border" style={{ background: '#e1eedd', borderColor: '#c8d6c0' }}>
          <FileCheck size={40} className="mx-auto mb-3" style={{ color: '#183a1d', opacity: 0.3 }} />
          <p className="text-sm" style={{ color: '#183a1d', opacity: 0.5 }}>No deliverable requests found</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#c8d6c0' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#e1eedd' }}>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: '#183a1d' }}>PROJECT</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: '#183a1d' }}>REQUEST</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: '#183a1d' }}>TYPE</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: '#183a1d' }}>DEADLINE</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: '#183a1d' }}>STATUS</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: '#183a1d' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(req => {
                  const typeStyle = TYPE_COLORS[req.type] || TYPE_COLORS.Custom
                  const statusStyle = STATUS_COLORS[req.status] || STATUS_COLORS.OPEN
                  const canSubmit = ['OPEN', 'OVERDUE', 'REWORK'].includes(req.status)
                  return (
                    <tr key={req.id} className="border-t" style={{ borderColor: '#c8d6c0' }}>
                      <td className="px-4 py-3 font-medium" style={{ color: '#183a1d' }}>{req.projectName}</td>
                      <td className="px-4 py-3" style={{ color: '#183a1d' }}>{req.title}</td>
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
                            style={{ background: '#f6c453', color: '#183a1d' }}
                          >
                            <Send size={12} />
                            Submit
                          </button>
                        ) : (
                          <span className="flex items-center gap-1 text-xs" style={{ color: '#183a1d', opacity: 0.4 }}>
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
            className="relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
            style={{ background: '#fefbe9', border: '1px solid #c8d6c0' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#c8d6c0', background: '#e1eedd' }}>
              <h2 className="text-lg font-bold" style={{ color: '#183a1d' }}>Submit Deliverable</h2>
              <button onClick={() => setSubmitModal(null)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#c8d6c0] transition-colors">
                <X size={16} style={{ color: '#183a1d' }} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Donor Request Info (read-only) */}
              <div className="rounded-xl p-4 space-y-2" style={{ background: '#e1eedd', border: '1px solid #c8d6c0' }}>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#183a1d', opacity: 0.5 }}>Donor Request</p>
                <p className="text-sm font-semibold" style={{ color: '#183a1d' }}>{submitModal.title}</p>
                <p className="text-sm" style={{ color: '#183a1d', opacity: 0.7 }}>{submitModal.description}</p>
                <div className="flex items-center gap-4 pt-1">
                  <span className="text-xs" style={{ color: '#183a1d', opacity: 0.5 }}>
                    Deadline: {new Date(submitModal.deadline).toLocaleDateString()}
                  </span>
                  <span className="text-xs" style={{ color: '#183a1d', opacity: 0.5 }}>
                    From: {submitModal.donorOrgName}
                  </span>
                </div>
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
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#183a1d' }}>Submission Note</label>
                <textarea
                  value={submitNote}
                  onChange={e => setSubmitNote(e.target.value)}
                  placeholder="Describe what you're submitting..."
                  rows={3}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
                  style={{ background: '#e1eedd', border: '1px solid #c8d6c0', color: '#183a1d' }}
                />
              </div>

              {/* Document IDs */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#183a1d' }}>Document IDs</label>
                <input
                  type="text"
                  value={submitDocIds}
                  onChange={e => setSubmitDocIds(e.target.value)}
                  placeholder="Comma-separated UUIDs, e.g. abc-123, def-456"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: '#e1eedd', border: '1px solid #c8d6c0', color: '#183a1d' }}
                />
                <p className="text-xs mt-1" style={{ color: '#183a1d', opacity: 0.4 }}>Enter document IDs to attach to this submission</p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: '#c8d6c0' }}>
              <button
                onClick={() => setSubmitModal(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-80"
                style={{ background: '#e1eedd', color: '#183a1d', border: '1px solid #c8d6c0' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-80 disabled:opacity-50"
                style={{ background: '#f6c453', color: '#183a1d' }}
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
          style={{ background: '#183a1d', color: '#fefbe9' }}
        >
          <CheckCircle2 size={16} style={{ color: '#f6c453' }} />
          {toast}
        </div>
      )}
    </div>
  )
}
