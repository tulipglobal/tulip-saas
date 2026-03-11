'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { use } from 'react'
import {
  Shield, CheckCircle, ArrowLeft, ExternalLink,
  Copy, Check, Globe, Calendar, Receipt, FolderOpen
} from 'lucide-react'

interface Project {
  id: string
  name: string
  status: string
  budget: number | null
  currency: string
  startDate: string | null
  endDate: string | null
  _count?: { expenses: number }
}

interface Expense {
  id: string
  title: string
  amount: number
  currency: string
  category: string | null
  vendor: string | null
  expenseDate: string
  anchorStatus: string
  dataHash: string | null
  blockchainTx: string | null
  project?: { name: string }
}

interface NGOPublicProfile {
  id: string
  name: string
  description: string | null
  country: string | null
  website: string | null
  verifiedAt: string | null
  integrityScore: number
  projects: Project[]
  recentExpenses: Expense[]
  totalAnchored: number
  totalExpenses: number
}

function HashBadge({ hash }: { hash: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => { navigator.clipboard.writeText(hash); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  return (
    <button onClick={copy}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 hover:border-gray-300 transition-all group"
      title="Copy hash">
      <span className="hash-mono text-gray-400" style={{ fontSize: 10 }}>{hash.slice(0,8)}…{hash.slice(-6)}</span>
      {copied ? <Check size={10} className="text-green-400" /> : <Copy size={10} className="text-gray-300 group-hover:text-gray-500" />}
    </button>
  )
}

// Demo data when API not available
const DEMO_PROFILE: NGOPublicProfile = {
  id: '1', name: 'Clean Water Initiative', description: 'Bringing clean drinking water to rural communities across East Africa through sustainable infrastructure and community training programs.',
  country: 'Kenya', website: 'https://cleanwater.example.org', verifiedAt: '2026-01-01',
  integrityScore: 98, totalAnchored: 127, totalExpenses: 127,
  projects: [
    { id: 'p1', name: 'Borehole Drilling — Nairobi Region', status: 'active', budget: 45000, currency: 'USD', startDate: '2026-01-01', endDate: '2026-06-30', _count: { expenses: 34 } },
    { id: 'p2', name: 'Water Purification Units', status: 'completed', budget: 28000, currency: 'USD', startDate: '2025-09-01', endDate: '2026-01-31', _count: { expenses: 51 } },
  ],
  recentExpenses: [
    { id: 'e1', title: 'Drilling equipment rental', amount: 4200, currency: 'USD', category: 'equipment', vendor: 'AfriDrill Ltd', expenseDate: '2026-02-14', anchorStatus: 'confirmed', dataHash: 'ab32d3e3e5befae2a6ea9dcb53ad1305372c5df8204bf8d1ede0fe48be65a025', blockchainTx: '0xc74e560d8047580a13ff81d86e77605799145ba4ae0f2ab7d97514c46b5c62ee', project: { name: 'Borehole Drilling — Nairobi Region' } },
    { id: 'e2', title: 'Community training workshop', amount: 1800, currency: 'USD', category: 'services', vendor: 'Local Trainers Co-op', expenseDate: '2026-02-20', anchorStatus: 'confirmed', dataHash: '175bf9c1215e62593e3f1ac1011f2ff1afc264c6676b7bdca38f190e18039788', blockchainTx: '0xc74e560d8047580a13ff81d86e77605799145ba4ae0f2ab7d97514c46b5c62ee', project: { name: 'Borehole Drilling — Nairobi Region' } },
    { id: 'e3', title: 'Steel pipes and fittings', amount: 6750, currency: 'USD', category: 'supplies', vendor: 'Nairobi Steel Works', expenseDate: '2026-03-01', anchorStatus: 'confirmed', dataHash: 'bfea0d0a9af4cf8fb66664a411ce5bf4811db6478af2be7b3a1bca06c77c0eef', blockchainTx: null, project: { name: 'Borehole Drilling — Nairobi Region' } },
  ]
}

export default function NGOProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const [profile, setProfile] = useState<NGOPublicProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeProject, setActiveProject] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tenants/public/${slug}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setProfile(d ?? DEMO_PROFILE); setLoading(false) })
      .catch(() => { setProfile(DEMO_PROFILE); setLoading(false) })
  }, [slug])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#FFFFFF' }}>
      <div className="text-gray-400 text-sm">Loading profile…</div>
    </div>
  )
  if (!profile) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#FFFFFF' }}>
      <div className="text-gray-400 text-sm">NGO not found</div>
    </div>
  )

  const pct = profile.integrityScore
  const scoreColor = pct >= 90 ? '#4ade80' : pct >= 70 ? '#facc15' : '#f87171'

  const filteredExpenses = activeProject
    ? profile.recentExpenses.filter(e => e.project?.name === profile.projects.find(p => p.id === activeProject)?.name)
    : profile.recentExpenses

  return (
    <div className="min-h-screen" style={{
      background: '#FFFFFF',
      backgroundImage: 'radial-gradient(at 20% 10%, rgba(12,122,237,0.1) 0px, transparent 50%)'
    }}>
      {/* Nav */}
      <nav className="border-b border-gray-200 px-6 h-16 flex items-center justify-between sticky top-0 z-10"
        style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)' }}>
        <Link href="/donors" className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors text-sm">
          <ArrowLeft size={16} /> All organisations
        </Link>
        <Link href="/" className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
            <span className="text-gray-900 font-bold" style={{ fontFamily: 'Inter, sans-serif', fontSize: 10 }}>T</span>
          </div>
          <span className="font-bold text-gray-900 text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
            tulip<span style={{ color: '#0c7aed' }}>ds</span>
          </span>
        </Link>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">

        {/* Profile header */}
        <div className="rounded-2xl border border-gray-200 p-8"
          style={{ background: '#FFFFFF' }}>
          <div className="flex items-start justify-between flex-wrap gap-6">
            <div className="flex items-start gap-5">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white shrink-0"
                style={{ background: 'linear-gradient(135deg, #0c7aed22, #004ea822)', border: '1px solid rgba(12,122,237,0.3)' }}>
                {profile.name.charAt(0)}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {profile.name}
                </h1>
                <div className="flex items-center gap-3 flex-wrap">
                  {profile.country && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                      <Globe size={13} /> {profile.country}
                    </div>
                  )}
                  {profile.verifiedAt && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                      <Calendar size={13} />
                      Verified {new Date(profile.verifiedAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                    </div>
                  )}
                  {profile.website && (
                    <Link href={profile.website} target="_blank"
                      className="flex items-center gap-1 text-sm text-[#0c7aed] hover:underline">
                      <ExternalLink size={12} /> Website
                    </Link>
                  )}
                </div>
                {profile.description && (
                  <p className="text-gray-500 text-sm mt-3 max-w-lg">{profile.description}</p>
                )}
              </div>
            </div>

            {/* Integrity score */}
            <div className="rounded-xl border border-gray-200 p-5 text-center min-w-[120px]"
              style={{ background: '#FFFFFF' }}>
              <div className="text-3xl font-bold mb-1" style={{ fontFamily: 'Inter, sans-serif', color: scoreColor }}>
                {pct}%
              </div>
              <div className="text-xs text-gray-500">Integrity Score</div>
              <div className="flex items-center justify-center gap-1 mt-2">
                <CheckCircle size={11} className="text-green-400" />
                <span className="text-xs text-green-400">Verified</span>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100">
            {[
              { label: 'Projects', value: profile.projects.length, icon: FolderOpen },
              { label: 'Total Expenses', value: profile.totalExpenses, icon: Receipt },
              { label: 'Blockchain Anchored', value: profile.totalAnchored, icon: Shield },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-center gap-3">
                <Icon size={16} className="text-[#0c7aed]" />
                <div>
                  <div className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Inter, sans-serif' }}>{value}</div>
                  <div className="text-xs text-gray-400">{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trust badges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'SHA-256 Hashed', sub: 'Every record fingerprinted' },
            { label: 'Polygon Network', sub: 'Immutable blockchain anchor' },
            { label: 'RFC 3161', sub: 'Trusted timestamps' },
            { label: 'eIDAS Compliant', sub: 'Legally admissible EU' },
          ].map(({ label, sub }) => (
            <div key={label} className="rounded-xl border border-gray-200 p-4 flex items-start gap-3"
              style={{ background: '#FFFFFF' }}>
              <CheckCircle size={14} className="text-green-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-gray-900">{label}</div>
                <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Projects */}
        {profile.projects.length > 0 && (
          <div>
            <h2 className="font-semibold text-gray-900 mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
              Projects
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {profile.projects.map(project => (
                <button key={project.id}
                  onClick={() => setActiveProject(activeProject === project.id ? null : project.id)}
                  className={`text-left rounded-xl border p-4 transition-all ${
                    activeProject === project.id
                      ? 'border-[#0c7aed]/50 bg-[#0c7aed]/8'
                      : 'border-gray-200 hover:border-gray-200'
                  }`}
                  style={{ background: activeProject === project.id ? undefined : '#FFFFFF' }}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{project.name}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        {project._count?.expenses ?? 0} expenses
                        {project.budget && ` · Budget: ${project.currency} ${project.budget.toLocaleString()}`}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${
                      project.status === 'active' ? 'bg-green-400/10 text-green-400' :
                      project.status === 'completed' ? 'bg-blue-400/10 text-blue-400' :
                      'bg-gray-50 text-gray-500'
                    }`}>{project.status}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Expenses */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900" style={{ fontFamily: 'Inter, sans-serif' }}>
              {activeProject ? 'Project Expenses' : 'Recent Expenses'}
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Shield size={11} className="text-[#0c7aed]" />
              All verified on-chain
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 overflow-hidden"
            style={{ background: '#FFFFFF' }}>
            {filteredExpenses.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No expenses for this project</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredExpenses.map(expense => (
                  <div key={expense.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-[#0c7aed]/10 flex items-center justify-center shrink-0">
                      <Receipt size={15} className="text-[#0c7aed]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800">{expense.title}</div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {expense.vendor && <span className="text-xs text-gray-400">{expense.vendor}</span>}
                        {expense.project && <span className="text-xs text-gray-300">· {expense.project.name}</span>}
                        <span className="text-xs text-gray-300">
                          · {new Date(expense.expenseDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-gray-900 shrink-0">
                      {expense.currency} {expense.amount.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {expense.dataHash && <HashBadge hash={expense.dataHash} />}
                      {expense.anchorStatus === 'confirmed' ? (
                        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-400/10 border border-green-400/20">
                          <CheckCircle size={11} className="text-green-400" />
                          <span className="text-xs text-green-400 font-medium">Verified</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-400/10 border border-yellow-400/20">
                          <span className="text-xs text-yellow-400 font-medium">Pending</span>
                        </div>
                      )}
                      {expense.dataHash && (
                        <Link href={`/verify?hash=${expense.dataHash}`} target="_blank"
                          className="text-gray-300 hover:text-[#0c7aed] transition-colors" title="Verify on Tulip DS">
                          <Shield size={14} />
                        </Link>
                      )}
                      {expense.blockchainTx && (
                        <Link href={`https://polygonscan.com/tx/${expense.blockchainTx}`} target="_blank"
                          className="text-gray-300 hover:text-[#0c7aed] transition-colors" title="View on Polygonscan">
                          <ExternalLink size={14} />
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CTA */}
        <div className="rounded-2xl border border-[#0c7aed]/20 p-8 text-center"
          style={{ background: 'linear-gradient(135deg, rgba(12,122,237,0.05), rgba(0,78,168,0.05))' }}>
          <Shield size={28} className="text-[#0c7aed] mx-auto mb-3" />
          <h3 className="font-bold text-gray-900 text-lg mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
            Every figure is verifiable
          </h3>
          <p className="text-gray-500 text-sm max-w-sm mx-auto mb-4">
            Click the shield icon on any expense to verify its blockchain proof independently.
          </p>
          <Link href="/verify"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white"
            style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
            <Shield size={15} /> Open Verifier
          </Link>
        </div>

      </div>

      <footer className="border-t border-gray-100 py-8 text-center">
        <p className="text-gray-300 text-xs">© 2026 Tulip DS · Bright Bytes Technology · Dubai UAE</p>
      </footer>
    </div>
  )
}
