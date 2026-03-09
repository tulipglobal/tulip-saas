'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Shield, LogOut, Banknote, FileText, FolderOpen,
  CheckCircle, Clock, ExternalLink, Hash
} from 'lucide-react'

interface DonorUser {
  id: string
  email: string
  firstName: string
  lastName: string
  donorId: string
  donor: { id: string; name: string; organisationName?: string; type: string; logoUrl?: string }
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

interface Document {
  id: string
  name: string
  fileType: string | null
  documentLevel: string
  uploadedAt: string
  sha256Hash: string | null
  project: { id: string; name: string } | null
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

export default function DonorDashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<DonorUser | null>(null)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('donor_token')
    const userStr = localStorage.getItem('donor_user')
    if (!token || !userStr) {
      router.push('/donor/login')
      return
    }

    try { setUser(JSON.parse(userStr)) } catch { router.push('/donor/login'); return }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.tulipds.com'
    fetch(`${apiUrl}/api/donor-auth/dashboard`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => {
        if (r.status === 401) { localStorage.removeItem('donor_token'); localStorage.removeItem('donor_user'); router.push('/donor/login'); return null }
        if (!r.ok) throw new Error('Failed to load')
        return r.json()
      })
      .then(d => { if (d) { setData(d); setLoading(false) } })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [router])

  const handleSignOut = () => {
    localStorage.removeItem('donor_token')
    localStorage.removeItem('donor_user')
    router.push('/donor/login')
  }

  const summary = data?.summary

  return (
    <div className="min-h-screen bg-[#040f1f]" style={{ fontFamily: 'DM Sans, sans-serif' }}>

      {/* Nav */}
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

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
            Welcome, {user?.firstName || 'Donor'}
          </h1>
          <p className="text-white/40 text-sm mt-1">
            View your funded projects, agreements, and verified documents
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
        ) : data && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: 'Agreements', value: summary?.totalAgreements ?? 0, icon: Banknote },
                { label: 'Total Funding', value: `$${(summary?.totalFunding ?? 0).toLocaleString()}`, icon: Banknote },
                { label: 'Total Spent', value: `$${(summary?.totalSpent ?? 0).toLocaleString()}`, icon: Banknote },
                { label: 'Projects', value: summary?.totalProjects ?? 0, icon: FolderOpen },
                { label: 'Documents', value: summary?.totalDocuments ?? 0, icon: FileText },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="rounded-xl border border-white/8 px-4 py-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon size={14} className="text-white/20" />
                    <span className="text-white/30 text-xs font-medium">{label}</span>
                  </div>
                  <div className="text-lg font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Funding Agreements */}
            <div>
              <h2 className="text-sm font-medium text-white/50 uppercase tracking-wide mb-3">Funding Agreements</h2>
              {data.agreements.length === 0 ? (
                <div className="rounded-xl border border-white/8 px-5 py-12 text-center" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <Banknote size={28} className="text-white/10 mx-auto mb-3" />
                  <p className="text-white/30 text-sm">No funding agreements linked to your account</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.agreements.map(a => {
                    const pct = a.totalAmount > 0 ? Math.min(100, Math.round((a.spent / a.totalAmount) * 100)) : 0
                    return (
                      <div key={a.id} className="rounded-xl border border-white/8 p-5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="text-white font-semibold text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>{a.title}</h3>
                            <p className="text-white/30 text-xs mt-0.5">
                              {a.tenant.name} &middot; {a.type} &middot; {a._count.expenses} expense{a._count.expenses !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <StatusBadge status={a.status} />
                        </div>

                        {/* Amount + progress */}
                        <div className="flex items-center gap-4 mb-3">
                          <div>
                            <span className="text-white/30 text-xs">Funded</span>
                            <p className="text-white font-bold text-sm">{a.currency} {a.totalAmount.toLocaleString()}</p>
                          </div>
                          <div>
                            <span className="text-white/30 text-xs">Spent</span>
                            <p className="text-white/60 font-medium text-sm">{a.currency} {a.spent.toLocaleString()}</p>
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

                        {/* Linked projects */}
                        {a.projectFunding.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-3 border-t border-white/5">
                            {a.projectFunding.map(pf => (
                              <div key={pf.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 text-xs">
                                <FolderOpen size={11} className="text-emerald-400" />
                                <span className="text-white/50">{pf.project.name}</span>
                                <StatusBadge status={pf.project.status} />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Documents */}
            <div>
              <h2 className="text-sm font-medium text-white/50 uppercase tracking-wide mb-3">Shared Documents</h2>
              {data.documents.length === 0 ? (
                <div className="rounded-xl border border-white/8 px-5 py-12 text-center" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <FileText size={28} className="text-white/10 mx-auto mb-3" />
                  <p className="text-white/30 text-sm">No documents shared yet</p>
                </div>
              ) : (
                <div className="rounded-xl border border-white/8 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 px-5 py-3 border-b border-white/8 text-xs text-white/30 uppercase tracking-wide font-medium">
                    <span>Document</span><span>Project</span><span>Date</span><span>Verified</span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {data.documents.map(doc => (
                      <div key={doc.id} className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 items-center px-5 py-3 hover:bg-white/2 transition-colors">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText size={14} className="text-white/20 flex-shrink-0" />
                          <span className="text-white/70 text-sm truncate">{doc.name}</span>
                          {doc.fileType && <span className="text-white/20 text-xs uppercase flex-shrink-0">{doc.fileType}</span>}
                        </div>
                        <span className="text-white/40 text-sm truncate">{doc.project?.name || '—'}</span>
                        <span className="text-white/30 text-xs">
                          {new Date(doc.uploadedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                        <div>
                          {doc.sha256Hash ? (
                            <Link href={`/verify?hash=${doc.sha256Hash}`} target="_blank"
                              className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline">
                              <CheckCircle size={12} /> Verified
                              <ExternalLink size={10} className="ml-0.5" />
                            </Link>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-white/20">
                              <Clock size={12} /> Pending
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
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
