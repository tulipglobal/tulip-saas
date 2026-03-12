'use client'

import { useState, useEffect } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import Link from 'next/link'
import { Banknote, Search } from 'lucide-react'
import BlockchainStatusPill from '@/components/BlockchainStatusPill'
import TrustSealCard from '@/components/TrustSealCard'

interface FundingSource {
  id: string
  sourceType: string
  sourceSubType: string | null
  donorName: string
  amount: number
  currency: string
  agreementHash: string | null
  createdAt: string
  budget: { id: string; name: string; status: string } | null
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT:    'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
    APPROVED: 'bg-[#f6c453]/10 text-[#183a1d] border-[#f6c453]/30',
    ACTIVE:   'bg-green-400/10 text-green-400 border-green-400/20',
    CLOSED:   'bg-[#e1eedd] text-[#183a1d]/60 border-[#c8d6c0]',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium ${map[status] ?? map.DRAFT}`}>
      {status}
    </span>
  )
}

export default function FundingPage() {
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

  const filtered = sources.filter(s =>
    s.donorName.toLowerCase().includes(search.toLowerCase()) ||
    s.sourceType.toLowerCase().includes(search.toLowerCase()) ||
    (s.budget?.name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const totalFunding = filtered.reduce((s, f) => s + f.amount, 0)

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-up">
      <div>
        <h1 className="text-2xl font-bold text-[#183a1d]" style={{ fontFamily: 'Inter, sans-serif' }}>Funding Sources</h1>
        <p className="text-[#183a1d]/60 text-sm mt-1">Read-only summary of all funding across budgets. To add or edit, go to the budget page.</p>
      </div>

      {filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-[#c8d6c0] px-5 py-4" style={{ background: '#e1eedd' }}>
            <div className="text-xl font-bold text-[#183a1d]" style={{ fontFamily: 'Inter, sans-serif' }}>${totalFunding.toLocaleString()}</div>
            <div className="text-xs text-[#183a1d]/60 mt-1">Total Funding</div>
          </div>
          <div className="rounded-xl border border-[#c8d6c0] px-5 py-4" style={{ background: '#e1eedd' }}>
            <div className="text-xl font-bold text-[#183a1d]" style={{ fontFamily: 'Inter, sans-serif' }}>{filtered.length}</div>
            <div className="text-xs text-[#183a1d]/60 mt-1">Funding Sources</div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 bg-[#e1eedd] border border-[#c8d6c0] rounded-lg px-4 py-2.5 max-w-sm">
        <Search size={15} className="text-[#183a1d]/40" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by donor, type, or budget..." className="bg-transparent text-sm text-[#183a1d] placeholder-[#183a1d]/40 outline-none w-full" />
      </div>

      <div className="rounded-xl border border-[#c8d6c0] overflow-hidden" style={{ background: '#e1eedd' }}>
        <div className="hidden lg:grid grid-cols-[1.5fr_1.5fr_1fr_1fr_80px_1fr] gap-4 px-5 py-3 border-b border-[#c8d6c0] text-xs text-[#183a1d]/40 uppercase tracking-wide font-medium">
          <span>Donor</span><span>Budget</span><span>Type</span><span>Amount</span><span>Seal</span><span>Status</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-[#183a1d]/40 text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <Banknote size={32} className="text-[#183a1d]/30" />
            <p className="text-[#183a1d]/40 text-sm">No funding sources found</p>
            <p className="text-[#183a1d]/30 text-xs">Create funding sources from within a budget</p>
          </div>
        ) : (
          <div className="divide-y divide-[#c8d6c0]">
            {filtered.map(s => (
              <div key={s.id} className="px-5 py-3.5 lg:grid lg:grid-cols-[1.5fr_1.5fr_1fr_1fr_80px_1fr] lg:gap-4 lg:items-center">
                <div>
                  <div className="text-sm text-[#183a1d]">{s.donorName}</div>
                  {/* Mobile meta */}
                  <div className="flex flex-wrap items-center gap-2 mt-1 lg:hidden text-xs text-[#183a1d]/60">
                    {s.budget && <Link href={`/dashboard/budgets/${s.budget.id}`} className="text-cyan-400/60 hover:text-cyan-400">{s.budget.name}</Link>}
                    <span>{s.sourceType}{s.sourceSubType ? ` / ${s.sourceSubType}` : ''}</span>
                    <span className="text-[#183a1d] font-medium">{s.currency} {s.amount.toLocaleString()}</span>
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
                    <span className="text-sm text-[#183a1d]/40">—</span>
                  )}
                </div>
                <div className="hidden lg:block text-xs text-[#183a1d]/60">
                  {s.sourceType}{s.sourceSubType ? <><br />{s.sourceSubType}</> : ''}
                </div>
                <div className="hidden lg:block text-sm font-medium text-[#183a1d]">{s.currency} {s.amount.toLocaleString()}</div>
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
                <div className="hidden lg:block">
                  {s.budget ? <StatusBadge status={s.budget.status} /> : <span className="text-xs text-[#183a1d]/40">—</span>}
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
