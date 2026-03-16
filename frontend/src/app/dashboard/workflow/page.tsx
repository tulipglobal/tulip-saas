'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { apiGet, apiPost, apiPatch } from '@/lib/api'
import { CheckCircle2, XCircle, Clock, MessageSquare, Send, ChevronDown, ChevronUp, ListFilter, X, AlertTriangle, DollarSign, Shield } from 'lucide-react'

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

const STATUS_TAB_KEYS = ['', 'pending', 'in_review', 'approved', 'rejected'] as const

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations('workflow')
  const map: Record<string, string> = {
    pending: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
    in_review: 'bg-[var(--tulip-gold)]/10 text-[var(--tulip-forest)] border-[var(--tulip-gold)]/30',
    approved: 'bg-green-400/10 text-green-400 border-green-400/20',
    rejected: 'bg-red-400/10 text-red-400 border-red-400/20',
  }
  const labelKeys: Record<string, string> = {
    pending: 'statusPending', in_review: 'statusInReview', approved: 'statusApproved', rejected: 'statusRejected',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium ${map[status] ?? map.pending}`}>
      {labelKeys[status] ? t(labelKeys[status]) : status}
    </span>
  )
}

function TypeBadge({ type }: { type: string }) {
  const t = useTranslations('workflow')
  const map: Record<string, string> = {
    document_approval: 'bg-indigo-400/10 text-indigo-400',
    expense_approval: 'bg-cyan-400/10 text-cyan-400',
  }
  const labelKeys: Record<string, string> = {
    document_approval: 'typeDocument', expense_approval: 'typeExpense',
  }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${map[type] ?? 'bg-[var(--tulip-sage)] text-[var(--tulip-forest)]/60'}`}>
      {labelKeys[type] ? t(labelKeys[type]) : type}
    </span>
  )
}

interface ExpenseDetail {
  id: string
  description: string
  amount: number
  currency: string
  vendor: string | null
  category: string | null
  notes: string | null
  expenseDate: string | null
  createdAt: string
  fraudRiskScore: number | null
  fraudRiskLevel: string | null
  fraudSignals: string[] | null
  amountMismatch: boolean
  vendorMismatch: boolean
  dateMismatch: boolean
  mismatchNote: string | null
  ocrAmount: number | null
  ocrVendor: string | null
  ocrDate: string | null
  receiptUrl: string | null
  receiptFileKey: string | null
  approvalStatus: string | null
  project?: { id: string; name: string } | null
}

function RiskBadge({ score, level }: { score?: number | null; level?: string | null }) {
  const t = useTranslations('workflow')
  if (!score || !level || level === 'LOW') return null
  const styles: Record<string, string> = {
    CRITICAL: 'bg-red-800 text-white', HIGH: 'bg-orange-500 text-white', MEDIUM: 'bg-yellow-500 text-white',
  }
  return (
    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${styles[level] || ''}`}>
      {level} {t('risk')} &bull; {score}
    </span>
  )
}

function TaskCard({ task, onAction }: { task: WorkflowTask; onAction: () => void }) {
  const t = useTranslations('workflow')
  const [expanded, setExpanded] = useState(false)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [expense, setExpense] = useState<ExpenseDetail | null>(null)
  const [loadingExpense, setLoadingExpense] = useState(false)

  const loadExpense = () => {
    if (task.entityType !== 'expense' || expense || loadingExpense) return
    setLoadingExpense(true)
    apiGet(`/api/expenses/${task.entityId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setExpense(d); setLoadingExpense(false) })
      .catch(() => setLoadingExpense(false))
  }

  const handleStatus = async (status: string) => {
    if (status === 'rejected' && !comment.trim()) {
      alert(t('rejectionReasonRequired'))
      return
    }
    setSubmitting(true)
    try {
      // Also call direct expense approve/reject for seal release
      if (task.entityType === 'expense') {
        if (status === 'approved') {
          await apiPatch(`/api/expenses/${task.entityId}/approve`, { note: comment.trim() || undefined })
        } else if (status === 'rejected') {
          await apiPatch(`/api/expenses/${task.entityId}/reject`, { reason: comment.trim() })
        }
      }
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
    <div className="rounded-xl border border-[var(--tulip-sage-dark)] overflow-hidden" style={{ background: 'var(--tulip-sage)' }}>
      <div className="px-4 py-3.5 flex items-start gap-3 cursor-pointer hover:bg-[var(--tulip-sage)]/50 transition-colors" onClick={() => { setExpanded(e => !e); loadExpense() }}>
        <div className="mt-0.5 shrink-0">
          {task.status === 'approved' ? <CheckCircle2 size={18} className="text-green-400" /> :
           task.status === 'rejected' ? <XCircle size={18} className="text-red-400" /> :
           <Clock size={18} className="text-yellow-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-[var(--tulip-forest)]">{task.title}</span>
            <TypeBadge type={task.type} />
            <StatusBadge status={task.status} />
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-[var(--tulip-forest)]/60">
            {task.submitter && <span>{t('by')} {task.submitter.name}</span>}
            <span>{new Date(task.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
            {task.comments.length > 0 && (
              <span className="flex items-center gap-1"><MessageSquare size={10} /> {task.comments.length}</span>
            )}
          </div>
        </div>
        <span className="text-[var(--tulip-forest)]/30 shrink-0 mt-1">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-[var(--tulip-sage-dark)] pt-3 space-y-3">
          {task.description && (
            <p className="text-sm text-[var(--tulip-forest)]/60">{task.description}</p>
          )}

          {/* Expense details panel */}
          {task.entityType === 'expense' && expense && (
            <div className="rounded-lg border border-[var(--tulip-sage-dark)] p-4 space-y-4 bg-[var(--tulip-cream)]/50">
              <div className="flex items-center gap-2 text-xs text-[var(--tulip-forest)]/40 uppercase tracking-wide font-medium">
                <DollarSign size={12} /> {t('expenseDetails')}
              </div>

              {/* Full expense details */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <div className="text-[10px] text-[var(--tulip-forest)]/40 uppercase">{t('amount')}</div>
                  <div className="text-sm font-bold text-[var(--tulip-forest)]">{expense.currency} {expense.amount.toLocaleString()}</div>
                </div>
                {expense.vendor && (
                  <div>
                    <div className="text-[10px] text-[var(--tulip-forest)]/40 uppercase">{t('vendor')}</div>
                    <div className="text-sm text-[var(--tulip-forest)]">{expense.vendor}</div>
                  </div>
                )}
                <div>
                  <div className="text-[10px] text-[var(--tulip-forest)]/40 uppercase">{t('date')}</div>
                  <div className="text-sm text-[var(--tulip-forest)]">{new Date(expense.expenseDate || expense.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                </div>
                {expense.project && (
                  <div>
                    <div className="text-[10px] text-[var(--tulip-forest)]/40 uppercase">{t('project')}</div>
                    <div className="text-sm text-[var(--tulip-forest)]">{expense.project.name}</div>
                  </div>
                )}
                {expense.category && (
                  <div>
                    <div className="text-[10px] text-[var(--tulip-forest)]/40 uppercase">{t('category')}</div>
                    <div className="text-sm text-[var(--tulip-forest)]">{expense.category}</div>
                  </div>
                )}
                {expense.notes && (
                  <div className="col-span-2 sm:col-span-3">
                    <div className="text-[10px] text-[var(--tulip-forest)]/40 uppercase">{t('notes')}</div>
                    <div className="text-sm text-[var(--tulip-forest)]">{expense.notes}</div>
                  </div>
                )}
              </div>

              {/* OCR vs Submitted comparison */}
              {(expense.ocrAmount != null || expense.ocrVendor || expense.ocrDate) && (
                <div className="rounded-lg border border-[var(--tulip-sage-dark)] overflow-hidden">
                  <div className="text-[10px] text-[var(--tulip-forest)]/40 uppercase tracking-wide font-medium px-3 py-2 bg-[var(--tulip-sage)]/50">{t('ocrVsSubmitted')}</div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[var(--tulip-sage-dark)]">
                        <th className="text-left px-3 py-1.5 text-[var(--tulip-forest)]/40 font-normal">{t('field')}</th>
                        <th className="text-left px-3 py-1.5 text-[var(--tulip-forest)]/40 font-normal">{t('ocrRead')}</th>
                        <th className="text-left px-3 py-1.5 text-[var(--tulip-forest)]/40 font-normal">{t('submitted')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expense.ocrAmount != null && (
                        <tr className={`border-b border-[var(--tulip-sage-dark)] ${expense.amountMismatch ? 'bg-amber-50' : ''}`}>
                          <td className="px-3 py-1.5 text-[var(--tulip-forest)]/60">{t('amount')}</td>
                          <td className="px-3 py-1.5 text-[var(--tulip-forest)]">{expense.ocrAmount.toLocaleString()}</td>
                          <td className={`px-3 py-1.5 ${expense.amountMismatch ? 'text-amber-700 font-bold' : 'text-[var(--tulip-forest)]'}`}>{expense.amount.toLocaleString()}</td>
                        </tr>
                      )}
                      {expense.ocrVendor && (
                        <tr className={`border-b border-[var(--tulip-sage-dark)] ${expense.vendorMismatch ? 'bg-amber-50' : ''}`}>
                          <td className="px-3 py-1.5 text-[var(--tulip-forest)]/60">{t('vendor')}</td>
                          <td className="px-3 py-1.5 text-[var(--tulip-forest)]">{expense.ocrVendor}</td>
                          <td className={`px-3 py-1.5 ${expense.vendorMismatch ? 'text-amber-700 font-bold' : 'text-[var(--tulip-forest)]'}`}>{expense.vendor || '—'}</td>
                        </tr>
                      )}
                      {expense.ocrDate && (
                        <tr className={`${expense.dateMismatch ? 'bg-amber-50' : ''}`}>
                          <td className="px-3 py-1.5 text-[var(--tulip-forest)]/60">{t('date')}</td>
                          <td className="px-3 py-1.5 text-[var(--tulip-forest)]">{expense.ocrDate}</td>
                          <td className={`px-3 py-1.5 ${expense.dateMismatch ? 'text-amber-700 font-bold' : 'text-[var(--tulip-forest)]'}`}>{expense.expenseDate || new Date(expense.createdAt).toISOString().split('T')[0]}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Fraud flags as individual banners */}
              {expense.fraudSignals && expense.fraudSignals.length > 0 && expense.fraudSignals.map((signal, i) => (
                <div key={i} className={`rounded-lg px-4 py-3 text-sm flex items-start gap-2 border-l-4 ${
                  expense.fraudRiskLevel === 'HIGH' || expense.fraudRiskLevel === 'CRITICAL'
                    ? 'bg-red-50 border-red-500 text-red-800'
                    : expense.fraudRiskLevel === 'MEDIUM'
                    ? 'bg-amber-50 border-amber-500 text-amber-800'
                    : 'bg-blue-50 border-blue-500 text-blue-800'
                }`}>
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium">{expense.fraudRiskLevel === 'HIGH' || expense.fraudRiskLevel === 'CRITICAL' ? t('highRisk') : expense.fraudRiskLevel === 'MEDIUM' ? t('mediumRisk') : t('info')}:</span>{' '}
                    {signal}
                  </div>
                </div>
              ))}

              {/* Mismatch flags as individual banners */}
              {expense.amountMismatch && (
                <div className="rounded-lg px-4 py-3 text-sm flex items-start gap-2 border-l-4 bg-amber-50 border-amber-500 text-amber-800">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <div><span className="font-medium">{t('mediumRisk')}:</span> {t('amountMismatch', { ocrAmount: expense.ocrAmount?.toLocaleString() ?? '', submittedAmount: expense.amount.toLocaleString() })}</div>
                </div>
              )}
              {expense.vendorMismatch && (
                <div className="rounded-lg px-4 py-3 text-sm flex items-start gap-2 border-l-4 bg-blue-50 border-blue-500 text-blue-800">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <div><span className="font-medium">{t('info')}:</span> {t('vendorMismatch', { ocrVendor: expense.ocrVendor ?? '', submittedVendor: expense.vendor ?? '' })}</div>
                </div>
              )}
              {expense.dateMismatch && (
                <div className="rounded-lg px-4 py-3 text-sm flex items-start gap-2 border-l-4 bg-amber-50 border-amber-500 text-amber-800">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <div><span className="font-medium">{t('mediumRisk')}:</span> {t('dateMismatch', { ocrDate: expense.ocrDate ?? '' })}</div>
                </div>
              )}

              {/* Invoice preview */}
              {expense.receiptUrl && (
                <div>
                  <div className="text-[10px] text-[var(--tulip-forest)]/40 uppercase mb-2">{t('invoiceReceipt')}</div>
                  {expense.receiptFileKey?.match(/\.(jpg|jpeg|png)$/i) ? (
                    <a href={expense.receiptUrl} target="_blank" rel="noopener noreferrer" className="block">
                      <img src={expense.receiptUrl} alt="Receipt" className="max-w-xs max-h-48 rounded-lg border border-[var(--tulip-sage-dark)] hover:shadow-lg transition-shadow cursor-pointer" />
                    </a>
                  ) : (
                    <a href={expense.receiptUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] text-[var(--tulip-forest)] hover:bg-[var(--tulip-sage)]/70 transition-colors">
                      <Shield size={14} /> {t('viewInvoicePdf')}
                    </a>
                  )}
                </div>
              )}

              {expense.fraudRiskScore != null && (
                <div className="text-[10px] text-[var(--tulip-forest)]/30">{t('fraudScore', { score: expense.fraudRiskScore, level: expense.fraudRiskLevel })}</div>
              )}
            </div>
          )}
          {task.entityType === 'expense' && loadingExpense && (
            <div className="text-xs text-[var(--tulip-forest)]/40 animate-pulse">{t('loadingExpenseDetails')}</div>
          )}

          {task.assignee && (
            <div className="text-xs text-[var(--tulip-forest)]/60">{t('assignedTo')}: <span className="text-[var(--tulip-forest)]/70">{task.assignee.name}</span></div>
          )}

          {task.resolvedAt && (
            <div className="text-xs text-[var(--tulip-forest)]/60">
              {t('resolved')}: {new Date(task.resolvedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </div>
          )}

          {/* Comments */}
          {task.comments.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-[var(--tulip-forest)]/40 uppercase tracking-wide font-medium">{t('comments')}</div>
              {task.comments.map(c => (
                <div key={c.id} className="rounded-lg bg-[var(--tulip-sage)] px-3 py-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-[var(--tulip-forest)]/70">{c.user?.name ?? 'Unknown'}</span>
                    <span className="text-xs text-[var(--tulip-forest)]/40">{new Date(c.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-sm text-[var(--tulip-forest)]/60">{c.comment}</p>
                </div>
              ))}
            </div>
          )}

          {/* Comment input + actions */}
          <div className="flex items-center gap-2">
            <input
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder={canAct ? t('commentPlaceholderRequired') : t('commentPlaceholder')}
              className="flex-1 bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-3 py-2 text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none focus:border-[var(--tulip-sage-dark)]"
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !canAct) handleComment() }}
            />
            <button onClick={handleComment} disabled={!comment.trim() || submitting}
              className="w-8 h-8 rounded-lg bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] flex items-center justify-center hover:bg-[var(--tulip-sage)] transition-all disabled:opacity-30">
              <Send size={14} className="text-[var(--tulip-forest)]/70" />
            </button>
          </div>

          {canAct && (
            <div className="flex items-center gap-2 pt-1">
              <button onClick={() => handleStatus('approved')} disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-all disabled:opacity-50">
                <CheckCircle2 size={14} /> {task.entityType === 'expense' ? t('approveAndSeal') : t('approve')}
              </button>
              <button onClick={() => handleStatus('rejected')} disabled={submitting || !comment.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-all disabled:opacity-50"
                title={!comment.trim() ? t('rejectionReasonRequired') : ''}>
                <XCircle size={14} /> {t('reject')}
              </button>
              {task.status === 'pending' && (
                <button onClick={() => handleStatus('in_review')} disabled={submitting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--tulip-gold)]/10 text-[var(--tulip-forest)] border border-[var(--tulip-gold)]/30 hover:bg-[var(--tulip-gold)]/20 transition-all disabled:opacity-50">
                  <Clock size={13} /> {t('markInReview')}
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
  const t = useTranslations('workflow')
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
        <h1 className="text-2xl font-bold text-[var(--tulip-forest)]" style={{ fontFamily: 'Inter, sans-serif' }}>{t('title')}</h1>
        <p className="text-[var(--tulip-forest)]/60 text-sm mt-1">{t('subtitle')}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Pending', value: summary.pending, color: 'text-yellow-400' },
          { label: 'In Review', value: summary.inReview, color: 'text-[var(--tulip-forest)]' },
          { label: 'Approved', value: summary.approved, color: 'text-green-400' },
          { label: 'Rejected', value: summary.rejected, color: 'text-red-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-[var(--tulip-sage-dark)] px-4 py-3" style={{ background: 'var(--tulip-sage)' }}>
            <div className={`text-xl font-bold ${color}`} style={{ fontFamily: 'Inter, sans-serif' }}>{value}</div>
            <div className="text-xs text-[var(--tulip-forest)]/60 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STATUS_TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              tab === key
                ? 'bg-[var(--tulip-gold)]/10 text-[var(--tulip-forest)]'
                : 'text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)]/70 hover:bg-[var(--tulip-sage)]/50'
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
            <div key={i} className="rounded-xl border border-[var(--tulip-sage-dark)] h-20 animate-pulse" style={{ background: 'var(--tulip-sage)' }} />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <ListFilter size={32} className="text-[var(--tulip-forest)]/30" />
          <p className="text-[var(--tulip-forest)]/40 text-sm">No workflow tasks{tab ? ` with status "${tab.replace('_', ' ')}"` : ''}</p>
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
