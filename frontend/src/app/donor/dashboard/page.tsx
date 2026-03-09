'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Shield, LogOut, FileText, CheckCircle, Clock,
  Calendar, ExternalLink, Search, Hash, Link2
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
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function DonorDashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<DonorUser | null>(null)
  const [stats, setStats] = useState<DocStats | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('donor_token')
    const userStr = localStorage.getItem('donor_user')
    if (!token || !userStr) { router.push('/donor/login'); return }

    try { setUser(JSON.parse(userStr)) } catch { router.push('/donor/login'); return }

    const headers = { Authorization: `Bearer ${token}` }

    const handle401 = () => {
      localStorage.removeItem('donor_token')
      localStorage.removeItem('donor_user')
      router.push('/donor/login')
    }

    async function load() {
      try {
        const [meRes, statsRes, docsRes] = await Promise.all([
          fetch(`${API_URL}/api/donor-auth/me`, { headers }),
          fetch(`${API_URL}/api/donor/documents/stats`, { headers }),
          fetch(`${API_URL}/api/donor/documents`, { headers }),
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
            View verified documents shared by your NGO partner
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

            {/* ── Search ── */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by document name or project..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/8 bg-white/[0.02] text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-emerald-400/30 transition-colors"
              />
            </div>

            {/* ── Documents Table ── */}
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
                <div className="hidden md:grid grid-cols-[2.5fr_1fr_1fr_1fr_1.5fr_0.8fr] gap-4 px-5 py-3 border-b border-white/8 text-xs text-white/30 uppercase tracking-wide font-medium">
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
                    <div
                      key={doc.id}
                      className="md:grid md:grid-cols-[2.5fr_1fr_1fr_1fr_1.5fr_0.8fr] gap-4 items-center px-5 py-3 hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Document */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                          <FileText size={14} className="text-white/20" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-white/80 text-sm font-medium truncate">{doc.name}</p>
                          <p className="text-white/20 text-xs truncate">
                            {doc.description ? (doc.description.length > 50 ? doc.description.slice(0, 50) + '...' : doc.description) : ''}
                            {doc.description && doc.fileSize ? ' · ' : ''}
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
                      <div>
                        {doc.sha256Hash ? (
                          <Link
                            href={`/verify?hash=${doc.sha256Hash}`}
                            target="_blank"
                            className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                          >
                            <Link2 size={12} />
                            Verify
                          </Link>
                        ) : (
                          <span className="text-white/15 text-xs">{'\u2014'}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
