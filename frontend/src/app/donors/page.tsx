'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
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
  const t = useTranslations()
  const color = score >= 90 ? '#4ade80' : score >= 70 ? '#facc15' : '#f87171'
  const label = score >= 90 ? t('donors.excellent') : score >= 70 ? t('donors.good') : t('donors.fair')
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-8 h-8">
        <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="12" fill="none" stroke="var(--tulip-sage-dark)" strokeWidth="3" />
          <circle cx="16" cy="16" r="12" fill="none" stroke={color} strokeWidth="3"
            strokeDasharray={`${(score / 100) * 75.4} 75.4`} strokeLinecap="round" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold" style={{ color, fontSize: 9 }}>
          {score}
        </span>
      </div>
      <div>
        <div className="text-xs font-semibold" style={{ color }}>{label}</div>
        <div className="text-xs text-[var(--tulip-forest)]/40">{t('donors.integrity')}</div>
      </div>
    </div>
  )
}

function NGOCard({ ngo }: { ngo: NGOProfile }) {
  const t = useTranslations()
  return (
    <Link href={`/donors/${ngo.slug || ngo.id}`}
      className="group block rounded-2xl border border-[var(--tulip-sage-dark)] hover:border-[var(--tulip-gold)]/40 p-6 transition-all hover:bg-[var(--tulip-gold)]/5"
      style={{ background: 'var(--tulip-sage)' }}>
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-[var(--tulip-forest)] shrink-0"
          style={{ background: 'rgba(246,196,83,0.15)', border: '1px solid rgba(246,196,83,0.2)' }}>
          {ngo.name.charAt(0)}
        </div>
        <div className="flex items-center gap-2">
          <TrustScore score={ngo.integrityScore} />
          <ArrowUpRight size={16} className="text-[var(--tulip-forest)]/30 group-hover:text-[var(--tulip-gold)] transition-colors ml-1" />
        </div>
      </div>

      <h3 className="font-semibold text-[var(--tulip-forest)] text-base mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>
        {ngo.name}
      </h3>
      {ngo.description && (
        <p className="text-[var(--tulip-forest)]/60 text-sm line-clamp-2 mb-4">{ngo.description}</p>
      )}

      <div className="flex items-center gap-4 pt-4 border-t border-[var(--tulip-sage-dark)]/50">
        <div className="text-center">
          <div className="text-sm font-bold text-[var(--tulip-forest)]">{ngo.totalProjects}</div>
          <div className="text-xs text-[var(--tulip-forest)]/40">{t('donors.projects')}</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-bold text-[var(--tulip-forest)]">{ngo.totalExpenses}</div>
          <div className="text-xs text-[var(--tulip-forest)]/40">{t('donors.expenses')}</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-bold text-[var(--tulip-forest)]">{ngo.totalAnchored}</div>
          <div className="text-xs text-[var(--tulip-forest)]/40">{t('donors.anchored')}</div>
        </div>
        {ngo.country && (
          <div className="ml-auto flex items-center gap-1 text-xs text-[var(--tulip-forest)]/40">
            <Globe size={11} />
            {ngo.country}
          </div>
        )}
      </div>

      {ngo.verifiedAt && (
        <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-[var(--tulip-sage-dark)]/50">
          <CheckCircle size={12} className="text-green-400" />
          <span className="text-xs text-[var(--tulip-forest)]/40">
            {t('donors.verifiedSince', { date: new Date(ngo.verifiedAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) })}
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
  const t = useTranslations()
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
      background: 'var(--tulip-cream)',
      backgroundImage: 'radial-gradient(at 20% 10%, rgba(246,196,83,0.12) 0px, transparent 50%), radial-gradient(at 80% 80%, rgba(24,58,29,0.08) 0px, transparent 50%)'
    }}>
      {/* Nav */}
      <nav className="border-b border-[var(--tulip-sage-dark)] px-6 h-16 flex items-center justify-between"
        style={{ background: 'var(--tulip-cream)', backdropFilter: 'blur(12px)' }}>
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--tulip-gold)' }}>
            <span className="text-[var(--tulip-forest)] font-bold text-xs" style={{ fontFamily: 'Inter, sans-serif' }}>T</span>
          </div>
          <span className="font-bold text-[var(--tulip-forest)]" style={{ fontFamily: 'Inter, sans-serif' }}>
            sea<span style={{ color: 'var(--tulip-gold)' }}>layer</span>
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/verify" className="text-sm text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)] transition-colors">{t('donors.verifyHash')}</Link>
          <Link href="/login" className="px-4 py-1.5 rounded-lg text-sm font-medium text-[var(--tulip-forest)] border border-[var(--tulip-sage-dark)] hover:border-[var(--tulip-gold)]/30 transition-all">
            {t('donors.ngoSignIn')}
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-4xl mx-auto px-6 pt-16 pb-12 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--tulip-gold)]/30 bg-[var(--tulip-gold)]/10 text-xs text-[var(--tulip-forest)] mb-6">
          <Shield size={12} />
          {t('donors.heroBadge')}
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-[var(--tulip-forest)] mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
          {t('donors.heroTitle1')}<br />
          <span style={{ background: 'linear-gradient(135deg, #f6c453, #f6c453)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {t('donors.heroTitle2')}
          </span>
        </h1>
        <p className="text-[var(--tulip-forest)]/60 text-lg max-w-xl mx-auto mb-8">
          {t('donors.heroDesc')}
        </p>

        {/* Trust pills */}
        <div className="flex items-center justify-center gap-3 flex-wrap mb-10">
          {[
            { key: 'sha256', label: t('donors.sha256') },
            { key: 'polygon', label: t('donors.polygonAnchored') },
            { key: 'rfc', label: t('donors.rfcTimestamped') },
            { key: 'eidas', label: t('donors.eidasCompliant') },
          ].map(pill => (
            <div key={pill.key} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] text-xs text-[var(--tulip-forest)]/60">
              <CheckCircle size={11} className="text-green-400" />
              {pill.label}
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-3 bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] hover:border-[var(--tulip-sage-dark)] rounded-xl px-5 py-3.5 max-w-lg mx-auto transition-all">
          <Search size={18} className="text-[var(--tulip-forest)]/40 shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('donors.searchPlaceholder')}
            className="bg-transparent text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none w-full text-sm"
          />
        </div>
      </div>

      {/* Stats bar */}
      <div className="border-y border-[var(--tulip-sage-dark)] py-6 mb-12"
        style={{ background: 'var(--tulip-sage)' }}>
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-3 gap-6 text-center">
          {[
            { label: t('donors.verifiedNgos'), value: ngos.length },
            { label: t('donors.expensesAnchored'), value: ngos.reduce((s, n) => s + n.totalAnchored, 0) },
            { label: t('donors.avgIntegrity'), value: ngos.length ? `${Math.round(ngos.reduce((s, n) => s + n.integrityScore, 0) / ngos.length)}%` : '—' },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="text-2xl font-bold text-[var(--tulip-forest)]" style={{ fontFamily: 'Inter, sans-serif' }}>{value}</div>
              <div className="text-sm text-[var(--tulip-forest)]/60 mt-1">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* NGO Grid */}
      <div className="max-w-4xl mx-auto px-6 pb-20">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-semibold text-[var(--tulip-forest)]" style={{ fontFamily: 'Inter, sans-serif' }}>
            {t('donors.verifiedOrgs', { count: filtered.length })}
          </h2>
          <div className="flex items-center gap-1.5 text-xs text-[var(--tulip-forest)]/40">
            <Star size={12} className="text-yellow-400" />
            {t('donors.sortedByIntegrity')}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => (
              <div key={i} className="rounded-2xl border border-[var(--tulip-sage-dark)] p-6 space-y-3 animate-pulse"
                style={{ background: 'var(--tulip-sage)' }}>
                <div className="h-12 w-12 rounded-xl bg-[var(--tulip-sage-dark)]" />
                <div className="h-4 bg-[var(--tulip-sage-dark)] rounded w-3/4" />
                <div className="h-3 bg-[var(--tulip-sage-dark)] rounded w-full" />
                <div className="h-3 bg-[var(--tulip-sage-dark)] rounded w-2/3" />
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
      <footer className="border-t border-[var(--tulip-sage-dark)] py-8 text-center">
        <p className="text-[var(--tulip-forest)]/30 text-xs">{t('donors.footer')}</p>
      </footer>
    </div>
  )
}
