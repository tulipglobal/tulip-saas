'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { formatMoney } from '@/lib/currency'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

interface SharedProject {
  name: string
  description: string | null
  status: string
  budget: number
  spent: number
  funded: number
  remaining: number
  startDate: string | null
  endDate: string | null
  tenantName: string | null
}

interface SharedExpense {
  date: string
  vendor: string
  amount: number
  currency: string
  category: string
  status: string
}

interface SharedDocument {
  fileName: string
  fileSize: number
  uploadedAt: string
}

interface SharedFunding {
  name: string
  amount: number
  currency: string
}

interface ShareData {
  project: SharedProject
  expenses: SharedExpense[]
  documents: SharedDocument[]
  fundingSources: SharedFunding[]
  sharedBy: string | null
  viewCount: number
}

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '\u2014'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return '\u2014'
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, { bg: string; text: string }> = {
    ACTIVE: { bg: '#DCFCE7', text: '#166534' },
    COMPLETED: { bg: '#DBEAFE', text: '#1D4ED8' },
    CLOSED: { bg: '#F3F4F6', text: '#6B7280' },
    DRAFT: { bg: '#FEF3E8', text: '#B45309' },
    APPROVED: { bg: '#DCFCE7', text: '#166534' },
    PENDING: { bg: '#FEF3E8', text: '#B45309' },
    REJECTED: { bg: '#FEE2E2', text: '#DC2626' },
  }
  const s = styles[(status || '').toUpperCase()] || { bg: '#F3F4F6', text: '#6B7280' }
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: s.bg, color: s.text }}>
      {status || 'Unknown'}
    </span>
  )
}

export default function PublicSharePage() {
  const params = useParams()
  const token = params?.token as string

  const [data, setData] = useState<ShareData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    fetch(`${API_URL}/api/public/share/${token}`)
      .then(async r => {
        if (r.ok) {
          setData(await r.json())
        } else {
          const err = await r.json().catch(() => ({ error: 'Failed to load' }))
          setError(err.error || 'Failed to load shared project')
        }
        setLoading(false)
      })
      .catch(() => {
        setError('Network error')
        setLoading(false)
      })
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <div className="text-center space-y-3">
          <div className="inline-block w-8 h-8 border-3 border-[var(--donor-accent)] border-t-transparent rounded-full animate-spin" style={{ borderWidth: 3 }} />
          <p className="text-sm" style={{ color: 'var(--donor-muted)' }}>Loading shared project...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <div className="text-center space-y-4 max-w-md mx-auto px-6">
          <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center" style={{ background: '#FEE2E2' }}>
            <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--donor-dark)' }}>
            {error.includes('expired') ? 'Link Expired' : error.includes('revoked') ? 'Link Revoked' : 'Link Not Found'}
          </h1>
          <p className="text-sm" style={{ color: 'var(--donor-muted)' }}>{error}</p>
          <p className="text-xs" style={{ color: 'var(--donor-muted)' }}>
            Contact the person who shared this link for a new one.
          </p>
        </div>
      </div>
    )
  }

  if (!data) return null

  const { project, expenses, documents, fundingSources, sharedBy } = data
  const budgetUsedPct = project.budget > 0 ? Math.round((project.spent / project.budget) * 100) : 0

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      {/* Header */}
      <header className="border-b" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--donor-accent)' }}>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <span className="text-sm font-bold" style={{ color: 'var(--donor-dark)' }}>Sealayer</span>
              <span className="text-xs ml-2" style={{ color: 'var(--donor-muted)' }}>Shared Project View</span>
            </div>
          </div>
          {sharedBy && (
            <span className="text-xs" style={{ color: 'var(--donor-muted)' }}>Shared by {sharedBy}</span>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Project title + status */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--donor-dark)' }}>{project.name}</h1>
            <StatusPill status={project.status} />
          </div>
          {project.description && (
            <p className="text-sm" style={{ color: 'var(--donor-muted)' }}>{project.description}</p>
          )}
          {project.tenantName && (
            <p className="text-xs mt-1" style={{ color: 'var(--donor-muted)' }}>Organisation: {project.tenantName}</p>
          )}
          {(project.startDate || project.endDate) && (
            <p className="text-xs mt-1" style={{ color: 'var(--donor-muted)' }}>
              {project.startDate ? `Started ${fmtDate(project.startDate)}` : ''}
              {project.startDate && project.endDate ? ' \u2014 ' : ''}
              {project.endDate ? `Ends ${fmtDate(project.endDate)}` : ''}
            </p>
          )}
        </div>

        {/* Budget overview cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl border px-4 py-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
            <p className="text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>Total Budget</p>
            <p className="text-xl font-bold mt-1" style={{ color: 'var(--donor-dark)' }}>
              {formatMoney(project.budget, 'USD')}
            </p>
          </div>
          <div className="rounded-xl border px-4 py-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
            <p className="text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>Total Spent</p>
            <p className="text-xl font-bold mt-1" style={{ color: 'var(--donor-dark)' }}>
              {formatMoney(project.spent, 'USD')}
            </p>
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--donor-border)' }}>
              <div className="h-full rounded-full" style={{
                width: `${Math.min(budgetUsedPct, 100)}%`,
                background: budgetUsedPct > 90 ? '#DC2626' : budgetUsedPct > 70 ? '#F59E0B' : 'var(--donor-accent)',
              }} />
            </div>
            <p className="text-[10px] mt-1" style={{ color: 'var(--donor-muted)' }}>{budgetUsedPct}% of budget</p>
          </div>
          <div className="rounded-xl border px-4 py-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
            <p className="text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>Total Funded</p>
            <p className="text-xl font-bold mt-1" style={{ color: 'var(--donor-dark)' }}>
              {formatMoney(project.funded, 'USD')}
            </p>
          </div>
          <div className="rounded-xl border px-4 py-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
            <p className="text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>Remaining</p>
            <p className="text-xl font-bold mt-1" style={{ color: project.remaining < 0 ? '#DC2626' : 'var(--donor-dark)' }}>
              {formatMoney(project.remaining, 'USD')}
            </p>
          </div>
        </div>

        {/* Expenses table */}
        {expenses.length > 0 && (
          <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
            <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--donor-border)' }}>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--donor-dark)' }}>Expenses ({expenses.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--donor-border)' }}>
                    <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>Date</th>
                    <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>Vendor</th>
                    <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>Amount</th>
                    <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>Category</th>
                    <th className="text-center px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e, i) => (
                    <tr key={i} className="border-b last:border-0" style={{ borderColor: 'var(--donor-border)' }}>
                      <td className="px-4 py-3" style={{ color: 'var(--donor-dark)' }}>{fmtDate(e.date)}</td>
                      <td className="px-4 py-3 font-medium" style={{ color: 'var(--donor-dark)' }}>{e.vendor || '\u2014'}</td>
                      <td className="px-4 py-3 text-right font-mono" style={{ color: 'var(--donor-dark)' }}>
                        {e.currency} {e.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--donor-muted)' }}>{e.category || '\u2014'}</td>
                      <td className="px-4 py-3 text-center"><StatusPill status={e.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Documents list */}
        {documents.length > 0 && (
          <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
            <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--donor-border)' }}>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--donor-dark)' }}>Documents ({documents.length})</h2>
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--donor-border)' }}>
              {documents.map((d, i) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--donor-light)' }}>
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--donor-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--donor-dark)' }}>{d.fileName}</p>
                      <p className="text-xs" style={{ color: 'var(--donor-muted)' }}>{formatFileSize(d.fileSize)}</p>
                    </div>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--donor-muted)' }}>{fmtDate(d.uploadedAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Funding sources */}
        {fundingSources.length > 0 && (
          <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
            <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--donor-border)' }}>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--donor-dark)' }}>Funding Sources ({fundingSources.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--donor-border)' }}>
                    <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>Source</th>
                    <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>Amount</th>
                    <th className="text-center px-4 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>Currency</th>
                  </tr>
                </thead>
                <tbody>
                  {fundingSources.map((f, i) => (
                    <tr key={i} className="border-b last:border-0" style={{ borderColor: 'var(--donor-border)' }}>
                      <td className="px-4 py-3 font-medium" style={{ color: 'var(--donor-dark)' }}>{f.name}</td>
                      <td className="px-4 py-3 text-right font-mono" style={{ color: 'var(--donor-dark)' }}>
                        {f.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center" style={{ color: 'var(--donor-muted)' }}>{f.currency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* No data message */}
        {expenses.length === 0 && documents.length === 0 && fundingSources.length === 0 && (
          <div className="rounded-2xl border px-6 py-12 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
            <p className="text-sm" style={{ color: 'var(--donor-muted)' }}>No detailed records available for this project yet.</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-12" style={{ borderColor: 'var(--donor-border)' }}>
        <div className="max-w-4xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: 'var(--donor-accent)' }}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <span className="text-xs font-medium" style={{ color: 'var(--donor-dark)' }}>Powered by Sealayer</span>
            <span className="text-xs" style={{ color: 'var(--donor-muted)' }}>\u2014 Verified transparency</span>
          </div>
          <span className="text-xs" style={{ color: 'var(--donor-muted)' }}>
            Read-only view \u00b7 {data.viewCount} view{data.viewCount !== 1 ? 's' : ''}
          </span>
        </div>
      </footer>
    </div>
  )
}
