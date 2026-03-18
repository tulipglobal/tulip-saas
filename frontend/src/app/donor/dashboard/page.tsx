'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  Shield, LogOut, FileText, CheckCircle, Clock,
  Calendar, ExternalLink, Search, Hash, Link2, Eye,
  Banknote, FolderOpen, ChevronDown, ChevronUp
} from 'lucide-react'
import { formatMoney } from '@/lib/currencies'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DonorUser {
  id: string
  email: string
  firstName: string
  lastName: string
  donorId: string
  donor: { id: string; name: string; organisationName?: string; type: string; logoUrl?: string }
  tenantName?: string | null
}

interface DocProject {
  id: string
  name: string
}

interface Document {
  id: string
  name: string
  description: string | null
  category: string | null
  fileType: string | null
  fileSize: number | null
  sha256Hash: string | null
  fileUrl: string | null
  uploadedAt: string
  documentLevel: string
  project: DocProject | null
  blockchainTx: string | null
  anchorStatus: 'confirmed' | 'pending'
  anchoredAt: string | null
  auditHash: string | null
}

interface DocStats {
  total: number
  verified: number
  thisMonth: number
  lastUpdated: string | null
}

interface ProjectFunding {
  id: string
  allocatedAmount: number
  project: { id: string; name: string; status: string }
}

interface BudgetLineDonor {
  id: string
  expenseType: string
  category: string
  subCategory: string | null
  approvedAmount: number
  currency: string
  spent: number
  remaining: number
}

interface BudgetDonor {
  id: string
  name: string
  status: string
  periodFrom: string
  periodTo: string
  lines: BudgetLineDonor[]
  totalApproved: number
  totalSpent: number
}

interface Agreement {
  id: string
  title: string
  type: string
  totalAmount: number
  currency: string
  status: string
  createdAt: string
  tenant: { id: string; name: string }
  budget: BudgetDonor | null
  projectFunding: ProjectFunding[]
  spent: number
  _count: { expenses: number }
}

interface DashboardData {
  summary: {
    totalAgreements: number
    totalFunding: number
    totalSpent: number
    totalProjects: number
    totalDocuments: number
  }
  agreements: Agreement[]
  documents: Document[]
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CATEGORY_LABELS: Record<string, string> = {
  licence: 'Licence',
  certificate: 'Certificate',
  contract: 'Contract',
  permit: 'Permit',
  insurance: 'Insurance',
  visa: 'Visa',
  id_document: 'ID Document',
  mou: 'MOU',
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.sealayer.io'

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function truncateTx(tx: string) {
  return `${tx.slice(0, 8)}...${tx.slice(-6)}`
}

/* ------------------------------------------------------------------ */
/*  Status Badge                                                       */
/* ------------------------------------------------------------------ */

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE:    'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
    DRAFT:     'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
    COMPLETED: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
    active:    'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
    completed: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium ${map[status] ?? 'bg-[var(--tulip-sage)] text-[var(--tulip-forest)]/60 border-[var(--tulip-sage-dark)]'}`}>
      {status}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Expandable Agreement Card                                          */
/* ------------------------------------------------------------------ */

function AgreementCard({ agreement, documents, token }: {
  agreement: Agreement
  documents: Document[]
  token: string
}) {
  const t = useTranslations('donorDashboard')
  const [expanded, setExpanded] = useState(false)
  const pct = agreement.totalAmount > 0 ? Math.min(100, Math.round((agreement.spent / agreement.totalAmount) * 100)) : 0

  // Documents linked to this agreement's projects
  const projectIds = new Set(agreement.projectFunding.map(pf => pf.project.id))
  const linkedDocs = documents.filter(d => d.project && projectIds.has(d.project.id))

  return (
    <div
      className="rounded-xl border border-[var(--tulip-sage-dark)] overflow-hidden transition-all"
      style={{ background: 'var(--tulip-sage)' }}
    >
      {/* Card header — clickable */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-5 flex items-start justify-between gap-4 cursor-pointer hover:bg-[var(--tulip-sage)] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-[var(--tulip-forest)] font-semibold text-sm truncate" style={{ fontFamily: 'Inter, sans-serif' }}>
              {agreement.title}
            </h3>
            <StatusBadge status={agreement.status} />
          </div>
          <p className="text-[var(--tulip-forest)]/40 text-xs">
            {agreement.tenant.name} &middot; {agreement.type} &middot; {agreement._count.expenses} expense{agreement._count.expenses !== 1 ? 's' : ''}
          </p>

          {/* Amount + progress */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3">
            <div>
              <span className="text-[var(--tulip-forest)]/40 text-xs">{t('funded')}</span>
              <p className="text-[var(--tulip-forest)] font-bold text-sm">{agreement.currency} {agreement.totalAmount.toLocaleString()}</p>
            </div>
            <div>
              <span className="text-[var(--tulip-forest)]/40 text-xs">{t('spent')}</span>
              <p className="text-[var(--tulip-forest)]/70 font-medium text-sm">{agreement.currency} {agreement.spent.toLocaleString()}</p>
            </div>
            <div className="flex-1 min-w-[120px]">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-[var(--tulip-sage-dark)] overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${pct}%`,
                    background: pct > 90 ? '#f87171' : pct > 70 ? '#fbbf24' : '#34d399'
                  }} />
                </div>
                <span className="text-xs text-[var(--tulip-forest)]/60 w-8 text-right">{pct}%</span>
              </div>
            </div>
          </div>
        </div>
        <div className="shrink-0 text-[var(--tulip-forest)]/40 mt-1">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-[var(--tulip-sage-dark)]/50 px-5 py-4 space-y-4">
          {/* Budget breakdown — donor visibility */}
          {agreement.budget && (
            <div>
              <h4 className="text-[var(--tulip-forest)]/40 text-xs uppercase tracking-wide font-medium mb-2">
                Budget: {agreement.budget.name}
                <span className="text-[var(--tulip-forest)]/30 normal-case ml-2">
                  {formatDate(agreement.budget.periodFrom)} – {formatDate(agreement.budget.periodTo)}
                </span>
              </h4>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="rounded-lg border border-[var(--tulip-sage-dark)]/50 px-3 py-2 bg-[var(--tulip-sage)]">
                  <div className="text-[10px] text-[var(--tulip-forest)]/40">{t('budgeted')}</div>
                  <div className="text-sm font-bold text-[var(--tulip-forest)]">{formatMoney(agreement.budget.totalApproved, agreement.currency)}</div>
                </div>
                <div className="rounded-lg border border-[var(--tulip-sage-dark)]/50 px-3 py-2 bg-[var(--tulip-sage)]">
                  <div className="text-[10px] text-[var(--tulip-forest)]/40">{t('spent')}</div>
                  <div className="text-sm font-bold text-orange-400">{formatMoney(agreement.budget.totalSpent, agreement.currency)}</div>
                </div>
                <div className="rounded-lg border border-[var(--tulip-sage-dark)]/50 px-3 py-2 bg-[var(--tulip-sage)]">
                  <div className="text-[10px] text-[var(--tulip-forest)]/40">{t('remaining')}</div>
                  <div className={`text-sm font-bold ${(agreement.budget.totalApproved - agreement.budget.totalSpent) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatMoney(agreement.budget.totalApproved - agreement.budget.totalSpent, agreement.currency)}
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                {agreement.budget.lines.map(line => {
                  const linePct = line.approvedAmount > 0 ? Math.min(100, Math.round((line.spent / line.approvedAmount) * 100)) : 0
                  return (
                    <div key={line.id} className="flex items-center gap-3 py-1.5 px-2 rounded-lg bg-[var(--tulip-sage)]">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                        line.expenseType === 'CAPEX' ? 'bg-purple-400/10 text-purple-400' : 'bg-cyan-400/10 text-cyan-400'
                      }`}>{line.expenseType}</span>
                      <span className="text-xs text-[var(--tulip-forest)]/60 flex-1 truncate">
                        {line.category}{line.subCategory ? ` / ${line.subCategory}` : ''}
                      </span>
                      <div className="w-20 h-1 rounded-full bg-[var(--tulip-sage-dark)] overflow-hidden">
                        <div className="h-full rounded-full" style={{
                          width: `${linePct}%`,
                          background: linePct > 90 ? '#f87171' : linePct > 70 ? '#fbbf24' : '#34d399'
                        }} />
                      </div>
                      <span className="text-[10px] text-[var(--tulip-forest)]/40 w-20 text-right">
                        {line.currency} {line.spent.toLocaleString()} / {line.approvedAmount.toLocaleString()}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Linked projects */}
          {agreement.projectFunding.length > 0 && (
            <div>
              <h4 className="text-[var(--tulip-forest)]/40 text-xs uppercase tracking-wide font-medium mb-2">{t('linkedProjects')}</h4>
              <div className="flex flex-wrap gap-2">
                {agreement.projectFunding.map(pf => (
                  <div key={pf.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--tulip-sage)] text-xs">
                    <FolderOpen size={11} className="text-emerald-400" />
                    <span className="text-[var(--tulip-forest)]/70">{pf.project.name}</span>
                    <StatusBadge status={pf.project.status} />
                    {pf.allocatedAmount > 0 && (
                      <span className="text-[var(--tulip-forest)]/30 ml-1">{agreement.currency} {pf.allocatedAmount.toLocaleString()}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Documents for this agreement's projects */}
          {linkedDocs.length > 0 && (
            <div>
              <h4 className="text-[var(--tulip-forest)]/40 text-xs uppercase tracking-wide font-medium mb-2">
                {t('projectDocuments', { count: linkedDocs.length })}
              </h4>
              <div className="space-y-1">
                {linkedDocs.map(doc => (
                  <DocumentRow key={doc.id} doc={doc} token={token} compact />
                ))}
              </div>
            </div>
          )}

          {linkedDocs.length === 0 && agreement.projectFunding.length > 0 && (
            <p className="text-[var(--tulip-forest)]/30 text-xs">{t('noDocsLinked')}</p>
          )}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Document Row (shared between table and agreement expansion)        */
/* ------------------------------------------------------------------ */

function DocumentRow({ doc, token, compact = false }: { doc: Document; token: string; compact?: boolean }) {
  const t = useTranslations('donorDashboard')
  const [viewLoading, setViewLoading] = useState(false)

  const openFile = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!doc.fileUrl) return
    setViewLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/donor/documents/${doc.id}/view`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        if (data.url) window.open(data.url, '_blank')
      }
    } catch { /* silent */ } finally {
      setViewLoading(false)
    }
  }

  if (compact) {
    return (
      <div className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-[var(--tulip-sage)]/50 transition-colors group">
        <FileText size={12} className="text-[var(--tulip-forest)]/30 shrink-0" />
        <span className="text-[var(--tulip-forest)]/70 text-xs truncate flex-1">{doc.name}</span>
        {doc.fileType && <span className="text-[var(--tulip-forest)]/30 text-[10px] uppercase">{doc.fileType}</span>}
        {doc.anchorStatus === 'confirmed' ? (
          <CheckCircle size={11} className="text-emerald-400 shrink-0" />
        ) : (
          <Clock size={11} className="text-[var(--tulip-forest)]/30 shrink-0" />
        )}
        {doc.fileUrl && (
          <button onClick={openFile} disabled={viewLoading}
            className="opacity-0 group-hover:opacity-100 text-[var(--tulip-forest)]/40 hover:text-emerald-400 transition-all disabled:opacity-20">
            <Eye size={12} />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="md:grid md:grid-cols-[2.5fr_1fr_1fr_1fr_1.5fr_1fr] gap-4 items-center px-5 py-3 hover:bg-[var(--tulip-sage)] transition-colors">
      {/* Document name — clickable to open */}
      <div
        className={`flex items-center gap-2.5 min-w-0 ${doc.fileUrl ? 'cursor-pointer group' : ''}`}
        onClick={doc.fileUrl ? openFile : undefined}
      >
        <div className="w-8 h-8 rounded-lg bg-[var(--tulip-sage)] flex items-center justify-center flex-shrink-0">
          <FileText size={14} className="text-[var(--tulip-forest)]/30" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className={`text-sm font-medium truncate ${doc.fileUrl ? 'text-[var(--tulip-forest)] group-hover:text-emerald-400' : 'text-[var(--tulip-forest)]'} transition-colors`}>
              {doc.name}
            </p>
            {doc.fileUrl && <ExternalLink size={10} className="text-[var(--tulip-forest)]/30 group-hover:text-emerald-400/60 shrink-0 transition-colors" />}
          </div>
          <p className="text-[var(--tulip-forest)]/30 text-xs truncate">
            {doc.description ? (doc.description.length > 50 ? doc.description.slice(0, 50) + '...' : doc.description) : ''}
            {doc.description && doc.fileSize ? ' \u00b7 ' : ''}
            {doc.fileSize ? formatFileSize(doc.fileSize) : ''}
          </p>
        </div>
      </div>

      {/* Project */}
      <span className="text-[var(--tulip-forest)]/60 text-sm truncate">{doc.project?.name || '\u2014'}</span>

      {/* Category */}
      <div>
        {doc.category && CATEGORY_LABELS[doc.category] ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] text-[var(--tulip-forest)]/60 font-medium">
            {CATEGORY_LABELS[doc.category]}
          </span>
        ) : (
          <span className="text-[var(--tulip-forest)]/30 text-sm">{'\u2014'}</span>
        )}
      </div>

      {/* Date */}
      <span className="text-[var(--tulip-forest)]/40 text-xs">{formatDate(doc.uploadedAt)}</span>

      {/* Blockchain Status */}
      <div>
        {doc.anchorStatus === 'confirmed' && doc.blockchainTx ? (
          <a
            href={`https://polygonscan.com/tx/${doc.blockchainTx}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 hover:bg-emerald-400/15 transition-colors"
          >
            <CheckCircle size={12} />
            {t('verified')}
            <span className="text-emerald-400/60 font-mono text-[10px]">{truncateTx(doc.blockchainTx)}</span>
            <ExternalLink size={10} />
          </a>
        ) : doc.anchorStatus === 'confirmed' ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
            <CheckCircle size={12} />
            {t('anchored')}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--tulip-sage)] text-[var(--tulip-forest)]/40 border border-[var(--tulip-sage-dark)]">
            <Clock size={12} />
            {t('pending')}
          </span>
        )}
        {doc.anchoredAt && (
          <p className="text-[var(--tulip-forest)]/30 text-[10px] mt-0.5 pl-1">{t('anchoredDate', { date: formatDate(doc.anchoredAt) })}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {doc.fileUrl && (
          <button onClick={openFile} disabled={viewLoading}
            className="inline-flex items-center gap-1 text-xs text-[var(--tulip-forest)]/60 hover:text-emerald-400 transition-colors disabled:opacity-30">
            {viewLoading ? (
              <div className="w-3 h-3 border border-[var(--tulip-forest)]/30 border-t-emerald-400 rounded-full animate-spin" />
            ) : (
              <Eye size={12} />
            )}
            {t('open')}
          </button>
        )}
        {doc.sha256Hash && (
          <Link
            href={`/verify?hash=${doc.sha256Hash}`}
            target="_blank"
            className="inline-flex items-center gap-1 text-xs text-[var(--tulip-forest)]/60 hover:text-emerald-400 transition-colors"
          >
            <Link2 size={12} />
            {t('verify')}
          </Link>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Donor I&E Statement                                                */
/* ------------------------------------------------------------------ */

interface DonorIEData {
  income: { bySource: { sourceType: string; total: number }[]; total: number }
  expenditure: {
    capex: { byCategory: { category: string; total: number }[]; total: number }
    opex: { byCategory: { category: string; total: number }[]; total: number }
    other: { total: number }
    total: number
  }
  netBalance: number
}

function DonorIEStatement({ token }: { token: string }) {
  const t = useTranslations('donorDashboard')
  const [data, setData] = useState<DonorIEData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!token) return
    fetch(`${API_URL}/api/donor-auth/income-expenditure`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [token])

  if (loading || !data) return null

  return (
    <div>
      <button onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left mb-3">
        <h2 className="text-sm font-medium text-[var(--tulip-forest)]/60 uppercase tracking-wide">
          {t('incomeExpenditure')}
        </h2>
        <span className="text-[var(--tulip-forest)]/40">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {/* Summary always visible */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="rounded-lg border border-[var(--tulip-sage-dark)] px-3 py-3" style={{ background: 'var(--tulip-sage)' }}>
          <div className="text-[10px] text-[var(--tulip-forest)]/40 mb-0.5">{t('income')}</div>
          <div className="text-sm font-bold text-emerald-400">{formatMoney(data.income.total, 'USD')}</div>
        </div>
        <div className="rounded-lg border border-[var(--tulip-sage-dark)] px-3 py-3" style={{ background: 'var(--tulip-sage)' }}>
          <div className="text-[10px] text-[var(--tulip-forest)]/40 mb-0.5">{t('expenditure')}</div>
          <div className="text-sm font-bold text-orange-400">{formatMoney(data.expenditure.total, 'USD')}</div>
        </div>
        <div className="rounded-lg border border-[var(--tulip-sage-dark)] px-3 py-3" style={{ background: 'var(--tulip-sage)' }}>
          <div className="text-[10px] text-[var(--tulip-forest)]/40 mb-0.5">{t('balance')}</div>
          <div className={`text-sm font-bold ${data.netBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatMoney(data.netBalance, 'USD')}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="rounded-xl border border-[var(--tulip-sage-dark)] overflow-hidden" style={{ background: 'var(--tulip-sage)' }}>
          {/* Income */}
          <div className="px-4 py-3 border-b border-[var(--tulip-sage-dark)]/50">
            <div className="text-xs font-medium text-emerald-400 mb-2">{t('incomeBySource')}</div>
            {data.income.bySource.map(s => (
              <div key={s.sourceType} className="flex items-center justify-between py-0.5">
                <span className="text-xs text-[var(--tulip-forest)]/60">{s.sourceType}</span>
                <span className="text-xs text-[var(--tulip-forest)]/40">{formatMoney(s.total, 'USD')}</span>
              </div>
            ))}
          </div>

          {/* CapEx */}
          {data.expenditure.capex.total > 0 && (
            <div className="px-4 py-3 border-b border-[var(--tulip-sage-dark)]/50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-purple-400">CapEx</span>
                <span className="text-xs text-[var(--tulip-forest)]/60">{formatMoney(data.expenditure.capex.total, 'USD')}</span>
              </div>
              {data.expenditure.capex.byCategory.map(c => (
                <div key={c.category} className="flex items-center justify-between pl-3 py-0.5">
                  <span className="text-[11px] text-[var(--tulip-forest)]/40">{c.category}</span>
                  <span className="text-[11px] text-[var(--tulip-forest)]/30">{formatMoney(c.total, 'USD')}</span>
                </div>
              ))}
            </div>
          )}

          {/* OpEx */}
          {data.expenditure.opex.total > 0 && (
            <div className="px-4 py-3 border-b border-[var(--tulip-sage-dark)]/50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-cyan-400">OpEx</span>
                <span className="text-xs text-[var(--tulip-forest)]/60">{formatMoney(data.expenditure.opex.total, 'USD')}</span>
              </div>
              {data.expenditure.opex.byCategory.map(c => (
                <div key={c.category} className="flex items-center justify-between pl-3 py-0.5">
                  <span className="text-[11px] text-[var(--tulip-forest)]/40">{c.category}</span>
                  <span className="text-[11px] text-[var(--tulip-forest)]/30">{formatMoney(c.total, 'USD')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function DonorDashboardPage() {
  const t = useTranslations('donorDashboard')
  const router = useRouter()
  const [user, setUser] = useState<DonorUser | null>(null)
  const [stats, setStats] = useState<DocStats | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [dashData, setDashData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [token, setToken] = useState('')

  useEffect(() => {
    const t = localStorage.getItem('donor_token')
    const userStr = localStorage.getItem('donor_user')
    if (!t || !userStr) { router.push('/donor/login'); return }

    setToken(t)
    try { setUser(JSON.parse(userStr)) } catch { router.push('/donor/login'); return }

    const headers = { Authorization: `Bearer ${t}` }

    const handle401 = () => {
      localStorage.removeItem('donor_token')
      localStorage.removeItem('donor_user')
      router.push('/donor/login')
    }

    async function load() {
      try {
        const [meRes, statsRes, docsRes, dashRes] = await Promise.all([
          fetch(`${API_URL}/api/donor-auth/me`, { headers }),
          fetch(`${API_URL}/api/donor/documents/stats`, { headers }),
          fetch(`${API_URL}/api/donor/documents`, { headers }),
          fetch(`${API_URL}/api/donor-auth/dashboard`, { headers }),
        ])

        if (meRes.status === 401 || statsRes.status === 401 || docsRes.status === 401) {
          handle401()
          return
        }

        if (meRes.ok) {
          const meData = await meRes.json()
          setUser(meData)
        }

        if (!statsRes.ok || !docsRes.ok) throw new Error('Failed to load documents')

        const statsData: DocStats = await statsRes.json()
        const docsData: { data: Document[]; total: number } = await docsRes.json()

        setStats(statsData)
        setDocuments(docsData.data)

        if (dashRes.ok) {
          const dd: DashboardData = await dashRes.json()
          setDashData(dd)
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [router])

  const handleSignOut = () => {
    localStorage.removeItem('donor_token')
    localStorage.removeItem('donor_user')
    router.push('/donor/login')
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return documents
    const q = search.toLowerCase()
    return documents.filter(
      d => d.name.toLowerCase().includes(q) || d.project?.name.toLowerCase().includes(q)
    )
  }, [documents, search])

  /* ---------------------------------------------------------------- */
  /*  Stat cards config                                                */
  /* ---------------------------------------------------------------- */

  const statCards = [
    { label: t('totalDocuments'), value: stats?.total ?? 0, icon: FileText, bg: 'rgba(246,196,83,0.10)', iconColor: 'text-[var(--tulip-gold)]' },
    { label: t('blockchainVerified'), value: stats?.verified ?? 0, icon: CheckCircle, bg: 'rgba(16,185,129,0.10)', iconColor: 'text-emerald-400' },
    { label: t('thisMonth'), value: stats?.thisMonth ?? 0, icon: Calendar, bg: 'rgba(139,92,246,0.10)', iconColor: 'text-purple-400' },
    {
      label: t('lastUpdated'),
      value: stats?.lastUpdated ? formatDate(stats.lastUpdated) : '\u2014',
      icon: Clock,
      bg: 'rgba(225,238,221,0.5)',
      iconColor: 'text-[var(--tulip-forest)]/40',
    },
  ]

  const agreements = dashData?.agreements ?? []

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="min-h-screen bg-[var(--tulip-cream)]" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* ── Nav ── */}
      <nav className="border-b border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)]/95 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/donor/dashboard" className="flex items-center">
              <img src="/logo.svg" alt="sealayer" className="h-14" />
            </Link>
            <span className="text-[var(--tulip-forest)]/30 text-sm">|</span>
            <span className="text-[var(--tulip-forest)]/60 text-sm font-medium">{user?.donor?.name || t('donorPortal')}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[var(--tulip-forest)]/40 text-sm hidden sm:block">
              {user?.firstName} {user?.lastName}
            </span>
            <button onClick={handleSignOut}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-[var(--tulip-forest)]/60 hover:text-red-400 hover:bg-red-400/5 transition-all text-sm">
              <LogOut size={16} /> {t('signOut')}
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6 md:space-y-8">

        {/* ── Header ── */}
        <div>
          <h1 className="text-2xl font-bold text-[var(--tulip-forest)]" style={{ fontFamily: 'Inter, sans-serif' }}>
            {t('welcome', { name: user?.firstName || 'Donor' })}
          </h1>
          <p className="text-[var(--tulip-forest)]/60 text-sm mt-1">
            {user?.tenantName
              ? t('viewingDocsFrom', { tenant: user.tenantName })
              : t('viewingDocsGeneric')}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-400/20 bg-red-400/5 px-5 py-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        ) : (
          <>
            {/* ── Stats Row ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {statCards.map(({ label, value, icon: Icon, bg, iconColor }) => (
                <div key={label} className="rounded-xl border border-[var(--tulip-sage-dark)] px-4 py-4" style={{ background: 'var(--tulip-sage)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: bg }}>
                      <Icon size={14} className={iconColor} />
                    </div>
                    <span className="text-[var(--tulip-forest)]/40 text-xs font-medium">{label}</span>
                  </div>
                  <div className="text-lg font-bold text-[var(--tulip-forest)]" style={{ fontFamily: 'Inter, sans-serif' }}>{value}</div>
                </div>
              ))}
            </div>

            {/* ── I&E Statement (Donor view) ── */}
            <DonorIEStatement token={token} />

            {/* ── Funding Agreements ── */}
            {agreements.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-[var(--tulip-forest)]/60 uppercase tracking-wide mb-3">{t('fundingAgreements')}</h2>
                <div className="space-y-3">
                  {agreements.map(a => (
                    <AgreementCard key={a.id} agreement={a} documents={documents} token={token} />
                  ))}
                </div>
              </div>
            )}

            {/* ── Documents Section ── */}
            <div>
              <h2 className="text-sm font-medium text-[var(--tulip-forest)]/60 uppercase tracking-wide mb-3">{t('allSharedDocuments')}</h2>

              {/* Search */}
              <div className="relative mb-4">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tulip-forest)]/30 pointer-events-none" />
                <input
                  type="text"
                  placeholder={t('searchPlaceholder')}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] text-[var(--tulip-forest)] text-sm placeholder:text-[var(--tulip-forest)]/30 focus:outline-none focus:border-emerald-400/30 transition-colors"
                />
              </div>

              {/* Documents Table */}
              {filtered.length === 0 ? (
                <div className="rounded-xl border border-[var(--tulip-sage-dark)] px-5 py-16 text-center" style={{ background: 'var(--tulip-sage)' }}>
                  <FileText size={32} className="text-[var(--tulip-forest)]/30 mx-auto mb-3" />
                  <p className="text-[var(--tulip-forest)]/40 text-sm font-medium">
                    {search ? t('noDocsMatch') : t('noDocsShared')}
                  </p>
                  <p className="text-[var(--tulip-forest)]/30 text-xs mt-1">
                    {search ? t('tryDifferent') : t('docsWillAppear')}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-[var(--tulip-sage-dark)] overflow-hidden" style={{ background: 'var(--tulip-sage)' }}>
                  {/* Table header */}
                  <div className="hidden md:grid grid-cols-[2.5fr_1fr_1fr_1fr_1.5fr_1fr] gap-4 px-5 py-3 border-b border-[var(--tulip-sage-dark)] text-xs text-[var(--tulip-forest)]/40 uppercase tracking-wide font-medium">
                    <span>{t('document')}</span>
                    <span>{t('project')}</span>
                    <span>{t('category')}</span>
                    <span>{t('dateAdded')}</span>
                    <span>{t('blockchainStatus')}</span>
                    <span>{t('actions')}</span>
                  </div>

                  {/* Table rows */}
                  <div className="divide-y divide-[var(--tulip-sage-dark)]/50">
                    {filtered.map(doc => (
                      <DocumentRow key={doc.id} doc={doc} token={token} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Footer ── */}
      <footer className="border-t border-[var(--tulip-sage-dark)] py-6 mt-8">
        <div className="max-w-6xl mx-auto px-4 md:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-[var(--tulip-forest)]/30 text-xs">
            &copy; 2026 sealayer &middot; Bright Bytes Technology &middot; Dubai, UAE
          </p>
          <Link href="/verify" className="flex items-center gap-1.5 text-[var(--tulip-forest)]/30 text-xs hover:text-[var(--tulip-forest)]/60 transition-colors">
            <Hash size={12} /> {t('verifyADocument')}
          </Link>
        </div>
      </footer>
    </div>
  )
}
