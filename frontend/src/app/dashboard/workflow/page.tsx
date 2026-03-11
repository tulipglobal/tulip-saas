'use client'

import { useState, useEffect } from 'react'
import { apiGet, apiPost, apiPatch } from '@/lib/api'
import { CheckCircle2, XCircle, Clock, MessageSquare, Send, ChevronDown, ChevronUp, ListFilter, X } from 'lucide-react'

interface WorkflowComment {
  id: string
  comment: string
  createdAt: string
  user?: { id: string; name: string; email: string } | null
}

interface WorkflowTask {
  id: string
  type: string
  status: string
  title: string
  description: string | null
  entityId: string
  entityType: string
  createdAt: string
  resolvedAt: string | null
  submitter?: { id: string; name: string; email: string } | null
  assignee?: { id: string; name: string; email: string } | null
  comments: WorkflowComment[]
}

interface Summary {
  pending: number
  inReview: number
  approved: number
  rejected: number
}

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'in_review', label: 'In Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
]

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
    in_review: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
    approved: 'bg-green-400/10 text-green-400 border-green-400/20',
    rejected: 'bg-red-400/10 text-red-400 border-red-400/20',
  }
  const labels: Record<string, string> = {
    pending: 'Pending', in_review: 'In Review', approved: 'Approved', rejected: 'Rejected',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium ${map[status] ?? map.pending}`}>
      {labels[status] ?? status}
    </span>
  )
}

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    document_approval: 'bg-indigo-400/10 text-indigo-400',
    expense_approval: 'bg-cyan-400/10 text-cyan-400',
  }
  const labels: Record<string, string> = {
    document_approval: 'Document', expense_approval: 'Expense',
  }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${map[type] ?? 'bg-gray-50 text-gray-500'}`}>
      {labels[type] ?? type}
    </span>
  )
}

function TaskCard({ task, onAction }: { task: WorkflowTask; onAction: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleStatus = async (status: string) => {
    setSubmitting(true)
    try {
      await apiPatch(`/api/workflow/tasks/${task.id}/status`, { status, comment: comment.trim() || undefined })
      setComment('')
      onAction()
    } catch { /* ignore */ }
    setSubmitting(false)
  }

  const handleComment = async () => {
    if (!comment.trim()) return
    setSubmitting(true)
    try {
      await apiPost(`/api/workflow/tasks/${task.id}/comment`, { comment: comment.trim() })
      setComment('')
      onAction()
    } catch { /* ignore */ }
    setSubmitting(false)
  }

  const canAct = task.status === 'pending' || task.status === 'in_review'

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden" style={{ background: '#FFFFFF' }}>
      <div className="px-4 py-3.5 flex items-start gap-3 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setExpanded(e => !e)}>
        <div className="mt-0.5 shrink-0">
          {task.status === 'approved' ? <CheckCircle2 size={18} className="text-green-400" /> :
           task.status === 'rejected' ? <XCircle size={18} className="text-red-400" /> :
           <Clock size={18} className="text-yellow-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-800">{task.title}</span>
            <TypeBadge type={task.type} />
            <StatusBadge status={task.status} />
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            {task.submitter && <span>by {task.submitter.name}</span>}
            <span>{new Date(task.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
            {task.comments.length > 0 && (
              <span className="flex items-center gap-1"><MessageSquare size={10} /> {task.comments.length}</span>
            )}
          </div>
        </div>
        <span className="text-gray-300 shrink-0 mt-1">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
          {task.description && (
            <p className="text-sm text-gray-500">{task.description}</p>
          )}

          {task.assignee && (
            <div className="text-xs text-gray-500">Assigned to: <span className="text-gray-600">{task.assignee.name}</span></div>
          )}

          {task.resolvedAt && (
            <div className="text-xs text-gray-500">
              Resolved: {new Date(task.resolvedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </div>
          )}

          {/* Comments */}
          {task.comments.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-gray-400 uppercase tracking-wide font-medium">Comments</div>
              {task.comments.map(c => (
                <div key={c.id} className="rounded-lg bg-gray-50 px-3 py-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-gray-600">{c.user?.name ?? 'Unknown'}</span>
                    <span className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-sm text-gray-500">{c.comment}</p>
                </div>
              ))}
            </div>
          )}

          {/* Comment input + actions */}
          <div className="flex items-center gap-2">
            <input
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-gray-300"
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && canAct) handleComment() }}
            />
            <button onClick={handleComment} disabled={!comment.trim() || submitting}
              className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-all disabled:opacity-30">
              <Send size={14} className="text-gray-600" />
            </button>
          </div>

          {canAct && (
            <div className="flex items-center gap-2 pt-1">
              <button onClick={() => handleStatus('approved')} disabled={submitting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-400/10 text-green-400 border border-green-400/20 hover:bg-green-400/20 transition-all disabled:opacity-50">
                <CheckCircle2 size={13} /> Approve
              </button>
              <button onClick={() => handleStatus('rejected')} disabled={submitting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-400/10 text-red-400 border border-red-400/20 hover:bg-red-400/20 transition-all disabled:opacity-50">
                <XCircle size={13} /> Reject
              </button>
              {task.status === 'pending' && (
                <button onClick={() => handleStatus('in_review')} disabled={submitting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-400/10 text-blue-400 border border-blue-400/20 hover:bg-blue-400/20 transition-all disabled:opacity-50">
                  <Clock size={13} /> Mark In Review
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function WorkflowPage() {
  const [tasks, setTasks] = useState<WorkflowTask[]>([])
  const [summary, setSummary] = useState<Summary>({ pending: 0, inReview: 0, approved: 0, rejected: 0 })
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('')

  const load = () => {
    const statusParam = tab ? `?status=${tab}` : ''
    Promise.all([
      apiGet(`/api/workflow/tasks${statusParam}`).then(r => r.ok ? r.json() : { data: [] }),
      apiGet('/api/workflow/summary').then(r => r.ok ? r.json() : { pending: 0, inReview: 0, approved: 0, rejected: 0 }),
    ]).then(([tasksData, summaryData]) => {
      setTasks(tasksData.data ?? [])
      setSummary(summaryData)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [tab])

  const totalActive = summary.pending + summary.inReview

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-up">
      <div>
        <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Inter, sans-serif' }}>Workflow</h1>
        <p className="text-gray-500 text-sm mt-1">Approval tasks for documents & expenses</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Pending', value: summary.pending, color: 'text-yellow-400' },
          { label: 'In Review', value: summary.inReview, color: 'text-blue-400' },
          { label: 'Approved', value: summary.approved, color: 'text-green-400' },
          { label: 'Rejected', value: summary.rejected, color: 'text-red-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-gray-200 px-4 py-3" style={{ background: '#FFFFFF' }}>
            <div className={`text-xl font-bold ${color}`} style={{ fontFamily: 'Inter, sans-serif' }}>{value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STATUS_TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              tab === key
                ? 'bg-blue-50 text-[#0c7aed]'
                : 'text-gray-500 hover:text-gray-600 hover:bg-gray-50'
            }`}>
            {label}
            {key === '' && totalActive > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-yellow-400/10 text-yellow-400">{totalActive}</span>
            )}
          </button>
        ))}
      </div>

      {/* Task list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl border border-gray-200 h-20 animate-pulse" style={{ background: '#FFFFFF' }} />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <ListFilter size={32} className="text-gray-300" />
          <p className="text-gray-400 text-sm">No workflow tasks{tab ? ` with status "${tab.replace('_', ' ')}"` : ''}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} onAction={load} />
          ))}
        </div>
      )}
    </div>
  )
}
