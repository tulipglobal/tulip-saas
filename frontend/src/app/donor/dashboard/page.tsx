'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Shield, LogOut, FileText, CheckCircle, Clock,
  Calendar, ExternalLink, Search, Hash, Link2, Eye,
  Banknote, FolderOpen, ChevronDown, ChevronUp
} from 'lucide-react'

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

interface Agreement {
  id: string
  title: string
  type: string
  totalAmount: number
  currency: string
  status: string
  createdAt: string
  tenant: { id: string; name: string }
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

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.tulipds.com'

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
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium ${map[status] ?? 'bg-white/5 text-white/40 border-white/10'}`}>
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
  const [expanded, setExpanded] = useState(false)
  const pct = agreement.totalAmount > 0 ? Math.min(100, Math.round((agreement.spent / agreement.totalAmount) * 100)) : 0

  // Documents linked to this agreement's projects
  const projectIds = new Set(agreement.projectFunding.map(pf => pf.project.id))
  const linkedDocs = documents.filter(d => d.project && projectIds.has(d.project.id))

  return (
    <div
      className="rounded-xl border border-white/8 overflow-hidden transition-all"
      style={{ background: expanded ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.02)' }}
    >
      {/* Card header — clickable */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-5 flex items-start justify-between gap-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-white font-semibold text-sm truncate" style={{ fontFamily: 'Syne, sans-serif' }}>
              {agreement.title}
            </h3>
            <StatusBadge status={agreement.status} />
          </div>
          <p className="text-white/30 text-xs">
            {agreement.tenant.name} &middot; {agreement.type} &middot; {agreement._count.expenses} expense{agreement._count.expenses !== 1 ? 's' : ''}
          </p>

          {/* Amount + progress */}
          <div className="flex items-center gap-4 mt-3">
            <div>
              <span className="text-white/30 text-xs">Funded</span>
              <p className="text-white font-bold text-sm">{agreement.currency} {agreement.totalAmount.toLocaleString()}</p>
            </div>
            <div>
              <span className="text-white/30 text-xs">Spent</span>
              <p className="text-white/60 font-medium text-sm">{agreement.currency} {agreement.spent.toLocaleString()}</p>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${pct}%`,
                    background: pct > 90 ? '#f87171' : pct > 70 ? '#fbbf24' : '#34d399'
                  }} />
                </div>
                <span className="text-xs text-white/40 w-8 text-right">{pct}%</span>
              </div>
            </div>
          </div>
        </div>
        <div className="shrink-0 text-white/30 mt-1">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-white/5 px-5 py-4 space-y-4">
          {/* Linked projects */}
          {agreement.projectFunding.length > 0 && (
            <div>
              <h4 className="text-white/30 text-xs uppercase tracking-wide font-medium mb-2">Linked Projects</h4>
              <div className="flex flex-wrap gap-2">
                {agreement.projectFunding.map(pf => (
                  <div key={pf.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 text-xs">
                    <FolderOpen size={11} className="text-emerald-400" />
                    <span className="text-white/60">{pf.project.name}</span>
                    <StatusBadge status={pf.project.status} />
                    {pf.allocatedAmount > 0 && (
                      <span className="text-white/20 ml-1">{agreement.currency} {pf.allocatedAmount.toLocaleString()}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Documents for this agreement's projects */}
          {linkedDocs.length > 0 && (
            <div>
              <h4 className="text-white/30 text-xs uppercase tracking-wide font-medium mb-2">
                Project Documents ({linkedDocs.length})
              </h4>
              <div className="space-y-1">
                {linkedDocs.map(doc => (
                  <DocumentRow key={doc.id} doc={doc} token={token} compact />
                ))}
              </div>
            </div>
          )}

          {linkedDocs.length === 0 && agreement.projectFunding.length > 0 && (
            <p className="text-white/15 text-xs">No documents uploaded to linked projects yet</p>
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
      <div className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-white/[0.03] transition-colors group">
        <FileText size={12} className="text-white/15 shrink-0" />
        <span className="text-white/60 text-xs truncate flex-1">{doc.name}</span>
        {doc.fileType && <span className="text-white/15 text-[10px] uppercase">{doc.fileType}</span>}
        {doc.anchorStatus === 'confirmed' ? (
          <CheckCircle size={11} className="text-emerald-400 shrink-0" />
        ) : (
          <Clock size={11} className="text-white/15 shrink-0" />
        )}
        {doc.fileUrl && (
          <button onClick={openFile} disabled={viewLoading}
            className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-emerald-400 transition-all disabled:opacity-20">
            <Eye size={12} />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="md:grid md:grid-cols-[2.5fr_1fr_1fr_1fr_1.5fr_1fr] gap-4 items-center px-5 py-3 hover:bg-white/[0.02] transition-colors">
      {/* Document name — clickable to open */}
      <div
        className={`flex items-center gap-2.5 min-w-0 ${doc.fileUrl ? 'cursor-pointer group' : ''}`}
        onClick={doc.fileUrl ? openFile : undefined}
      >
        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
          <FileText size={14} className="text-white/20" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className={`text-sm font-medium truncate ${doc.fileUrl ? 'text-white/80 group-hover:text-emerald-400' : 'text-white/80'} transition-colors`}>
              {doc.name}
            </p>
            {doc.fileUrl && <ExternalLink size={10} className="text-white/15 group-hover:text-emerald-400/60 shrink-0 transition-colors" />}
          </div>
          <p className="text-white/20 text-xs truncate">
            {doc.description ? (doc.description.length > 50 ? doc.description.slice(0, 50) + '...' : doc.description) : ''}
            {doc.description && doc.fileSize ? ' \u00b7 ' : ''}
            {doc.fileSize ? formatFileSize(doc.fileSize) : ''}
          </p>
        </div>
      </div>

      {/* Project */}
      <span className="text-white/40 text-sm truncate">{doc.project?.name || '\u2014'}</span>

      {/* Category */}
      <div>
        {doc.category && CATEGORY_LABELS[doc.category] ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs border border-white/10 bg-white/5 text-white/50 font-medium">
            {CATEGORY_LABELS[doc.category]}
          </span>
        ) : (
          <span className="text-white/20 text-sm">{'\u2014'}</span>
        )}
      </div>

      {/* Date */}
      <span className="text-white/30 text-xs">{formatDate(doc.uploadedAt)}</span>

      {/* Blockchain Status */}
      <div>
        {doc.anchorStatus === 'confirmed' && doc.blockchainTx ? (
          <a
            href={`https://amoy.polygonscan.com/tx/${doc.blockchainTx}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 hover:bg-emerald-400/15 transition-colors"
          >
            <CheckCircle size={12} />
            Verified
            <span className="text-emerald-400/60 font-mono text-[10px]">{truncateTx(doc.blockchainTx)}</span>
            <ExternalLink size={10} />
          </a>
        ) : doc.anchorStatus === 'confirmed' ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
            <CheckCircle size={12} />
            Anchored
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white/5 text-white/30 border border-white/10">
            <Clock size={12} />
            Pending
          </span>
        )}
        {doc.anchoredAt && (
          <p className="text-white/15 text-[10px] mt-0.5 pl-1">Anchored {formatDate(doc.anchoredAt)}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {doc.fileUrl && (
          <button onClick={openFile} disabled={viewLoading}
            className="inline-flex items-center gap-1 text-xs text-white/40 hover:text-emerald-400 transition-colors disabled:opacity-30">
            {viewLoading ? (
              <div className="w-3 h-3 border border-white/20 border-t-emerald-400 rounded-full animate-spin" />
            ) : (
              <Eye size={12} />
            )}
            Open
          </button>
        )}
        {doc.sha256Hash && (
          <Link
            href={`/verify?hash=${doc.sha256Hash}`}
            target="_blank"
            className="inline-flex items-center gap-1 text-xs text-white/40 hover:text-emerald-400 transition-colors"
          >
            <Link2 size={12} />
            Verify
          </Link>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function DonorDashboardPage() {
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
    { label: 'Total Documents', value: stats?.total ?? 0, icon: FileText, bg: 'rgba(59,130,246,0.10)', iconColor: 'text-blue-400' },
    { label: 'Blockchain Verified', value: stats?.verified ?? 0, icon: CheckCircle, bg: 'rgba(16,185,129,0.10)', iconColor: 'text-emerald-400' },
    { label: 'This Month', value: stats?.thisMonth ?? 0, icon: Calendar, bg: 'rgba(139,92,246,0.10)', iconColor: 'text-purple-400' },
    {
      label: 'Last Updated',
      value: stats?.lastUpdated ? formatDate(stats.lastUpdated) : '\u2014',
      icon: Clock,
      bg: 'rgba(255,255,255,0.04)',
      iconColor: 'text-white/30',
    },
  ]

  const agreements = dashData?.agreements ?? []

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="min-h-screen bg-[#040f1f]" style={{ fontFamily: 'DM Sans, sans-serif' }}>

      {/* ── Nav ── */}
      <nav className="border-b border-white/8 bg-[#07224a]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/donor/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '18px', color: 'white' }}>
                tulip<span style={{ color: '#34d399' }}>ds</span>
              </span>
            </Link>
            <span className="text-white/15 text-sm">|</span>
            <span className="text-white/40 text-sm font-medium">{user?.donor?.name || 'Donor Portal'}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-white/30 text-sm hidden sm:block">
              {user?.firstName} {user?.lastName}
            </span>
            <button onClick={handleSignOut}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-400/5 transition-all text-sm">
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* ── Header ── */}
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
            Welcome, {user?.firstName || 'Donor'}
          </h1>
          <p className="text-white/40 text-sm mt-1">
            {user?.tenantName
              ? `Viewing verified documents from ${user.tenantName}`
              : 'View verified documents shared by your NGO partner'}
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
                <div key={label} className="rounded-xl border border-white/8 px-4 py-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: bg }}>
                      <Icon size={14} className={iconColor} />
                    </div>
                    <span className="text-white/30 text-xs font-medium">{label}</span>
                  </div>
                  <div className="text-lg font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>{value}</div>
                </div>
              ))}
            </div>

            {/* ── Funding Agreements ── */}
            {agreements.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-white/50 uppercase tracking-wide mb-3">Funding Agreements</h2>
                <div className="space-y-3">
                  {agreements.map(a => (
                    <AgreementCard key={a.id} agreement={a} documents={documents} token={token} />
                  ))}
                </div>
              </div>
            )}

            {/* ── Documents Section ── */}
            <div>
              <h2 className="text-sm font-medium text-white/50 uppercase tracking-wide mb-3">All Shared Documents</h2>

              {/* Search */}
              <div className="relative mb-4">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by document name or project..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/8 bg-white/[0.02] text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-emerald-400/30 transition-colors"
                />
              </div>

              {/* Documents Table */}
              {filtered.length === 0 ? (
                <div className="rounded-xl border border-white/8 px-5 py-16 text-center" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <FileText size={32} className="text-white/10 mx-auto mb-3" />
                  <p className="text-white/30 text-sm font-medium">
                    {search ? 'No documents match your search' : 'No documents shared yet'}
                  </p>
                  <p className="text-white/15 text-xs mt-1">
                    {search ? 'Try a different search term' : 'Documents uploaded by your NGO partner will appear here'}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-white/8 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  {/* Table header */}
                  <div className="hidden md:grid grid-cols-[2.5fr_1fr_1fr_1fr_1.5fr_1fr] gap-4 px-5 py-3 border-b border-white/8 text-xs text-white/30 uppercase tracking-wide font-medium">
                    <span>Document</span>
                    <span>Project</span>
                    <span>Category</span>
                    <span>Date Added</span>
                    <span>Blockchain Status</span>
                    <span>Actions</span>
                  </div>

                  {/* Table rows */}
                  <div className="divide-y divide-white/5">
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
      <footer className="border-t border-white/5 py-6 mt-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <p className="text-white/15 text-xs">
            &copy; 2026 Tulip DS &middot; Bright Bytes Technology &middot; Dubai, UAE
          </p>
          <Link href="/verify" className="flex items-center gap-1.5 text-white/20 text-xs hover:text-white/40 transition-colors">
            <Hash size={12} /> Verify a document
          </Link>
        </div>
      </footer>
    </div>
  )
}
