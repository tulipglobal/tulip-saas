'use client'

import { useState, useEffect } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import Link from 'next/link'
import { Banknote, Search } from 'lucide-react'
import BlockchainStatusPill from '@/components/BlockchainStatusPill'
import TrustSealCard from '@/components/TrustSealCard'
import { useTranslations } from 'next-intl'

interface FundingSource {
  id: string
  sourceType: string
  sourceSubType: string | null
  donorName: string
  funderName: string | null
  funderType: string | null
  donorOrgId: string | null
  fundingAgreementId: string | null
  amount: number
  currency: string
  agreementHash: string | null
  createdAt: string
  budget: { id: string; name: string; status: string } | null
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT:    'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
    APPROVED: 'bg-[var(--tulip-gold)]/10 text-[var(--tulip-forest)] border-[var(--tulip-gold)]/30',
    ACTIVE:   'bg-green-400/10 text-green-400 border-green-400/20',
    CLOSED:   'bg-[var(--tulip-sage)] text-[var(--tulip-forest)]/60 border-[var(--tulip-sage-dark)]',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium ${map[status] ?? map.DRAFT}`}>
      {status}
    </span>
  )
}

export default function FundingPage() {
  const t = useTranslations()
  const [sources, setSources] = useState<FundingSource[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sealMap, setSealMap] = useState<Record<string, { sealId: string; anchorStatus: string; txHash: string | null }>>({})
  const [activeSealId, setActiveSealId] = useState<string | null>(null)

  useEffect(() => {
    apiGet('/api/budgets/funding-sources?limit=100')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(d => {
        const items = d.data ?? []
        setSources(items)
        setLoading(false)
        const hashes = items.map((s: FundingSource) => s.agreementHash).filter(Boolean)
        if (hashes.length > 0) {
          apiPost('/api/trust-seal/resolve', { hashes })
            .then(r => r.ok ? r.json() : {})
            .then(map => setSealMap(map))
            .catch(() => {})
        }
      })
      .catch(() => setLoading(false))
  }, [])

  const filtered = sources.filter(s => {
    const q = search.toLowerCase()
    return (s.funderName || s.donorName || '').toLowerCase().includes(q) ||
      (s.sourceType || '').toLowerCase().includes(q) ||
      (s.budget?.name ?? '').toLowerCase().includes(q)
  })

  const totalFunding = filtered.reduce((s, f) => s + f.amount, 0)

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-up">
      <div>
        <h1 className="text-2xl font-bold text-[var(--tulip-forest)]" style={{ fontFamily: 'Inter, sans-serif' }}>{t('funding.title')}</h1>
        <p className="text-[var(--tulip-forest)]/60 text-sm mt-1">{t('funding.subtitle')}</p>
      </div>

      {filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-[var(--tulip-sage-dark)] px-5 py-4" style={{ background: 'var(--tulip-sage)' }}>
            <div className="text-xl font-bold text-[var(--tulip-forest)]" style={{ fontFamily: 'Inter, sans-serif' }}>${totalFunding.toLocaleString()}</div>
            <div className="text-xs text-[var(--tulip-forest)]/60 mt-1">{t('funding.totalFunding')}</div>
          </div>
          <div className="rounded-xl border border-[var(--tulip-sage-dark)] px-5 py-4" style={{ background: 'var(--tulip-sage)' }}>
            <div className="text-xl font-bold text-[var(--tulip-forest)]" style={{ fontFamily: 'Inter, sans-serif' }}>{filtered.length}</div>
            <div className="text-xs text-[var(--tulip-forest)]/60 mt-1">{t('funding.fundingSources')}</div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-4 py-2.5 max-w-sm">
        <Search size={15} className="text-[var(--tulip-forest)]/40" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t('funding.searchPlaceholder')} className="bg-transparent text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none w-full" />
      </div>

      <div className="rounded-xl border border-[var(--tulip-sage-dark)] overflow-hidden" style={{ background: 'var(--tulip-sage)' }}>
        <div className="hidden lg:grid grid-cols-[1.5fr_1.5fr_1fr_1fr_80px_1fr] gap-4 px-5 py-3 border-b border-[var(--tulip-sage-dark)] text-xs text-[var(--tulip-forest)]/40 uppercase tracking-wide font-medium">
          <span>{t('funding.donor')}</span><span>{t('funding.budget')}</span><span>{t('funding.type')}</span><span>{t('funding.amount')}</span><span>{t('funding.seal')}</span><span>{t('funding.status')}</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-[var(--tulip-forest)]/40 text-sm">{t('common.loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <Banknote size={32} className="text-[var(--tulip-forest)]/30" />
            <p className="text-[var(--tulip-forest)]/40 text-sm">{t('funding.noFunding')}</p>
            <p className="text-[var(--tulip-forest)]/30 text-xs">{t('funding.createFromBudget')}</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--tulip-sage-dark)]">
            {filtered.map(s => (
              <div key={s.id}>
              <div className="px-5 py-3.5 lg:grid lg:grid-cols-[1.5fr_1.5fr_1fr_1fr_80px_1fr] lg:gap-4 lg:items-center">
                <div>
                  <div className="text-sm text-[var(--tulip-forest)]">{s.funderName || s.donorName}</div>
                  {/* Mobile meta */}
                  <div className="flex flex-wrap items-center gap-2 mt-1 lg:hidden text-xs text-[var(--tulip-forest)]/60">
                    {s.budget && <Link href={`/dashboard/budgets/${s.budget.id}`} className="text-cyan-400/60 hover:text-cyan-400">{s.budget.name}</Link>}
                    <span>{s.sourceType}{s.sourceSubType ? ` / ${s.sourceSubType}` : ''}</span>
                    <span className="text-[var(--tulip-forest)] font-medium">{s.currency} {s.amount.toLocaleString()}</span>
                    {s.budget && <StatusBadge status={s.budget.status} />}
                    {s.agreementHash && sealMap[s.agreementHash] && (
                      <BlockchainStatusPill
                        sealId={sealMap[s.agreementHash].sealId}
                        anchorStatus={sealMap[s.agreementHash].anchorStatus}
                        onClick={() => setActiveSealId(sealMap[s.agreementHash!].sealId)}
                      />
                    )}
                  </div>
                </div>
                <div className="hidden lg:block">
                  {s.budget ? (
                    <Link href={`/dashboard/budgets/${s.budget.id}`} className="text-sm text-cyan-400/60 hover:text-cyan-400 transition-colors">{s.budget.name}</Link>
                  ) : (
                    <span className="text-sm text-[var(--tulip-forest)]/40">—</span>
                  )}
                </div>
                <div className="hidden lg:block text-xs text-[var(--tulip-forest)]/60">
                  {s.sourceType}{s.sourceSubType ? <><br />{s.sourceSubType}</> : ''}
                </div>
                <div className="hidden lg:block text-sm font-medium text-[var(--tulip-forest)]">{s.currency} {s.amount.toLocaleString()}</div>
                <div className="hidden lg:block">
                  {s.agreementHash && sealMap[s.agreementHash] ? (
                    <BlockchainStatusPill
                      sealId={sealMap[s.agreementHash].sealId}
                      anchorStatus={sealMap[s.agreementHash].anchorStatus}
                      onClick={() => setActiveSealId(sealMap[s.agreementHash!].sealId)}
                    />
                  ) : (
                    <BlockchainStatusPill onClick={() => {}} />
                  )}
                </div>
                <div className="hidden lg:block space-y-1">
                  {s.budget && <StatusBadge status={s.budget.status} />}
                  {s.funderType === 'PORTAL' && s.donorOrgId ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700 border border-green-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />Portal linked
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-600 border border-amber-200">
                      External
                    </span>
                  )}
                </div>
              </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {activeSealId && (
        <TrustSealCard sealId={activeSealId} onClose={() => setActiveSealId(null)} />
      )}
    </div>
  )
}
