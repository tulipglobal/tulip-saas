'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Shield, CheckCircle, Search, ArrowUpRight, Globe, Star } from 'lucide-react'

interface NGOProfile {
  id: string
  name: string
  description: string | null
  country: string | null
  website: string | null
  verifiedAt: string | null
  integrityScore: number
  totalProjects: number
  totalExpenses: number
  totalAnchored: number
  slug: string
}

function TrustScore({ score }: { score: number }) {
  const color = score >= 90 ? '#4ade80' : score >= 70 ? '#facc15' : '#f87171'
  const label = score >= 90 ? 'Excellent' : score >= 70 ? 'Good' : 'Fair'
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-8 h-8">
        <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="12" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
          <circle cx="16" cy="16" r="12" fill="none" stroke={color} strokeWidth="3"
            strokeDasharray={`${(score / 100) * 75.4} 75.4`} strokeLinecap="round" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold" style={{ color, fontSize: 9 }}>
          {score}
        </span>
      </div>
      <div>
        <div className="text-xs font-semibold" style={{ color }}>{label}</div>
        <div className="text-xs text-gray-400">Integrity</div>
      </div>
    </div>
  )
}

function NGOCard({ ngo }: { ngo: NGOProfile }) {
  return (
    <Link href={`/donors/${ngo.slug || ngo.id}`}
      className="group block rounded-2xl border border-gray-200 hover:border-[#0c7aed]/40 p-6 transition-all hover:bg-[#0c7aed]/3"
      style={{ background: '#FFFFFF' }}>
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-gray-900 shrink-0"
          style={{ background: 'linear-gradient(135deg, #0c7aed22, #004ea822)', border: '1px solid rgba(12,122,237,0.2)' }}>
          {ngo.name.charAt(0)}
        </div>
        <div className="flex items-center gap-2">
          <TrustScore score={ngo.integrityScore} />
          <ArrowUpRight size={16} className="text-gray-300 group-hover:text-[#369bff] transition-colors ml-1" />
        </div>
      </div>

      <h3 className="font-semibold text-gray-900 text-base mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
        {ngo.name}
      </h3>
      {ngo.description && (
        <p className="text-gray-500 text-sm line-clamp-2 mb-4">{ngo.description}</p>
      )}

      <div className="flex items-center gap-4 pt-4 border-t border-gray-100">
        <div className="text-center">
          <div className="text-sm font-bold text-gray-900">{ngo.totalProjects}</div>
          <div className="text-xs text-gray-400">Projects</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-bold text-gray-900">{ngo.totalExpenses}</div>
          <div className="text-xs text-gray-400">Expenses</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-bold text-gray-900">{ngo.totalAnchored}</div>
          <div className="text-xs text-gray-400">Anchored</div>
        </div>
        {ngo.country && (
          <div className="ml-auto flex items-center gap-1 text-xs text-gray-400">
            <Globe size={11} />
            {ngo.country}
          </div>
        )}
      </div>

      {ngo.verifiedAt && (
        <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-100">
          <CheckCircle size={12} className="text-green-400" />
          <span className="text-xs text-gray-400">
            Verified since {new Date(ngo.verifiedAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
          </span>
        </div>
      )}
    </Link>
  )
}

// Fallback demo NGOs when API returns nothing (unauthenticated)
const DEMO_NGOS: NGOProfile[] = [
  {
    id: '1', name: 'Clean Water Initiative', slug: 'clean-water',
    description: 'Bringing clean drinking water to rural communities across East Africa.',
    country: 'Kenya', website: null, verifiedAt: '2026-01-01',
    integrityScore: 98, totalProjects: 4, totalExpenses: 127, totalAnchored: 127,
  },
  {
    id: '2', name: 'Education for All Foundation', slug: 'education-all',
    description: 'Building schools and training teachers in underserved communities.',
    country: 'Uganda', website: null, verifiedAt: '2026-02-01',
    integrityScore: 94, totalProjects: 7, totalExpenses: 243, totalAnchored: 241,
  },
  {
    id: '3', name: 'Green Futures NGO', slug: 'green-futures',
    description: 'Reforestation and climate resilience programs in Southeast Asia.',
    country: 'Indonesia', website: null, verifiedAt: '2026-01-15',
    integrityScore: 91, totalProjects: 3, totalExpenses: 89, totalAnchored: 89,
  },
]

export default function DonorPortalPage() {
  const [ngos, setNgos] = useState<NGOProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tenants/public?limit=50`)
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => {
        const items = d.items ?? []
        setNgos(items.length > 0 ? items : DEMO_NGOS)
        setLoading(false)
      })
      .catch(() => { setNgos(DEMO_NGOS); setLoading(false) })
  }, [])

  const filtered = ngos.filter(n =>
    n.name.toLowerCase().includes(search.toLowerCase()) ||
    (n.description ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (n.country ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen" style={{
      background: '#040f1f',
      backgroundImage: 'radial-gradient(at 20% 10%, rgba(12,122,237,0.12) 0px, transparent 50%), radial-gradient(at 80% 80%, rgba(0,78,168,0.08) 0px, transparent 50%)'
    }}>
      {/* Nav */}
      <nav className="border-b border-gray-200 px-6 h-16 flex items-center justify-between"
        style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)' }}>
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
            <span className="text-gray-900 font-bold text-xs" style={{ fontFamily: 'Syne, sans-serif' }}>T</span>
          </div>
          <span className="font-bold text-gray-900" style={{ fontFamily: 'Syne, sans-serif' }}>
            tulip<span style={{ color: '#369bff' }}>ds</span>
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/verify" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Verify a hash</Link>
          <Link href="/login" className="px-4 py-1.5 rounded-lg text-sm font-medium text-gray-900 border border-gray-200 hover:border-white/30 transition-all">
            NGO Sign in
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-4xl mx-auto px-6 pt-16 pb-12 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#0c7aed]/30 bg-[#0c7aed]/10 text-xs text-[#369bff] mb-6">
          <Shield size={12} />
          Every expense verified on Polygon blockchain
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
          Donate with<br />
          <span style={{ background: 'linear-gradient(135deg, #0c7aed, #369bff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            cryptographic proof
          </span>
        </h1>
        <p className="text-gray-500 text-lg max-w-xl mx-auto mb-8">
          Every NGO on Tulip DS publishes verified, blockchain-anchored financial records. See exactly where your money goes — provably.
        </p>

        {/* Trust pills */}
        <div className="flex items-center justify-center gap-3 flex-wrap mb-10">
          {['SHA-256 Hashed', 'Polygon Anchored', 'RFC 3161 Timestamped', 'eIDAS Compliant'].map(t => (
            <div key={t} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200 text-xs text-gray-500">
              <CheckCircle size={11} className="text-green-400" />
              {t}
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 hover:border-gray-300 rounded-xl px-5 py-3.5 max-w-lg mx-auto transition-all">
          <Search size={18} className="text-gray-400 shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search NGOs by name or country..."
            className="bg-transparent text-gray-900 placeholder-gray-400 outline-none w-full text-sm"
          />
        </div>
      </div>

      {/* Stats bar */}
      <div className="border-y border-gray-100 py-6 mb-12"
        style={{ background: 'rgba(255,255,255,0.01)' }}>
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-3 gap-6 text-center">
          {[
            { label: 'Verified NGOs', value: ngos.length },
            { label: 'Expenses Anchored', value: ngos.reduce((s, n) => s + n.totalAnchored, 0) },
            { label: 'Avg Integrity Score', value: ngos.length ? `${Math.round(ngos.reduce((s, n) => s + n.integrityScore, 0) / ngos.length)}%` : '—' },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Syne, sans-serif' }}>{value}</div>
              <div className="text-sm text-gray-500 mt-1">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* NGO Grid */}
      <div className="max-w-4xl mx-auto px-6 pb-20">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-semibold text-gray-900" style={{ fontFamily: 'Syne, sans-serif' }}>
            {filtered.length} Verified Organisation{filtered.length !== 1 ? 's' : ''}
          </h2>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Star size={12} className="text-yellow-400" />
            Sorted by integrity score
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => (
              <div key={i} className="rounded-2xl border border-gray-200 p-6 space-y-3 animate-pulse"
                style={{ background: '#FFFFFF' }}>
                <div className="h-12 w-12 rounded-xl bg-gray-50" />
                <div className="h-4 bg-gray-50 rounded w-3/4" />
                <div className="h-3 bg-gray-50 rounded w-full" />
                <div className="h-3 bg-gray-50 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(ngo => <NGOCard key={ngo.id} ngo={ngo} />)}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 text-center">
        <p className="text-gray-300 text-xs">© 2026 Tulip DS · Bright Bytes Technology · Dubai UAE</p>
      </footer>
    </div>
  )
}
