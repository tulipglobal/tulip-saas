'use client'

import { useState, useEffect } from 'react'
import { apiGet, apiPost, apiPut } from '@/lib/api'
import { RefreshCw, Lock, ExternalLink } from 'lucide-react'

interface ExchangeRate {
  id: string
  baseCurrency: string
  targetCurrency: string
  rate: number
  month: string
  source: string
  fetchedAt: string
  lockedAt: string | null
}

interface ExchangeRateTableProps {
  projectId?: string
  baseCurrency: string
  targetCurrency: string
  showAdminControls?: boolean
}

export default function ExchangeRateTable({
  projectId,
  baseCurrency,
  targetCurrency,
  showAdminControls = false,
}: ExchangeRateTableProps) {
  const [rates, setRates] = useState<ExchangeRate[]>([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)

  useEffect(() => {
    loadRates()
  }, [projectId, baseCurrency, targetCurrency])

  async function loadRates() {
    setLoading(true)
    try {
      const url = projectId
        ? `/api/exchange-rates/project/${projectId}`
        : `/api/exchange-rates`
      const res = await apiGet(url)
      if (res.ok) {
        const data = await res.json()
        const filtered = (data.rates || []).filter(
          (r: ExchangeRate) =>
            (r.baseCurrency === baseCurrency && r.targetCurrency === targetCurrency) ||
            (r.baseCurrency === targetCurrency && r.targetCurrency === baseCurrency)
        )
        setRates(filtered)
      }
    } catch {}
    setLoading(false)
  }

  async function handleFetch() {
    setFetching(true)
    try {
      await apiPost('/api/exchange-rates/fetch', {})
      await loadRates()
    } catch {}
    setFetching(false)
  }

  async function handleLock(rateId: string) {
    try {
      await apiPut(`/api/exchange-rates/${rateId}/lock`, {})
      await loadRates()
    } catch {}
  }

  function formatMonth(month: string) {
    const [y, m] = month.split('-')
    const date = new Date(parseInt(y), parseInt(m) - 1, 1)
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  function getSourceLabel(source: string) {
    switch (source) {
      case 'frankfurter': return 'Frankfurter.app'
      case 'openexchangerates': return 'Open Exchange Rates'
      case 'manual': return 'Manual'
      case 'previous': return 'Previous month'
      default: return source
    }
  }

  if (baseCurrency === targetCurrency) return null

  return (
    <div className="rounded-xl border border-[var(--tulip-sage-dark)] p-4" style={{ background: 'var(--tulip-sage)' }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--tulip-forest)]">Exchange Rates Used</h3>
          <p className="text-xs text-[var(--tulip-forest)]/50">
            Base: {baseCurrency} | Reporting: {targetCurrency}
          </p>
        </div>
        {showAdminControls && (
          <button
            onClick={handleFetch}
            disabled={fetching}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[var(--tulip-gold)] hover:bg-[var(--tulip-orange)] text-[var(--tulip-forest)] font-medium transition-all disabled:opacity-50"
          >
            <RefreshCw size={12} className={fetching ? 'animate-spin' : ''} />
            {fetching ? 'Fetching...' : 'Fetch Latest'}
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-[var(--tulip-forest)]/40 py-4 text-center">Loading rates...</p>
      ) : rates.length === 0 ? (
        <p className="text-xs text-[var(--tulip-forest)]/40 py-4 text-center">No exchange rates available yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[var(--tulip-forest)]/50 border-b border-[var(--tulip-sage-dark)]">
                <th className="text-left py-2 font-medium">Month</th>
                <th className="text-right py-2 font-medium">Rate (1 {baseCurrency} = {targetCurrency})</th>
                <th className="text-left py-2 font-medium pl-4">Source</th>
                {showAdminControls && <th className="text-center py-2 font-medium">Lock</th>}
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => {
                // Show rate as base→target
                const displayRate =
                  r.baseCurrency === baseCurrency ? r.rate : 1 / r.rate
                return (
                  <tr key={r.id} className="border-b border-[var(--tulip-sage-dark)]/50">
                    <td className="py-2 text-[var(--tulip-forest)]">{formatMonth(r.month)}</td>
                    <td className="py-2 text-right text-[var(--tulip-forest)] font-mono">
                      {displayRate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                    </td>
                    <td className="py-2 pl-4 text-[var(--tulip-forest)]/60">{getSourceLabel(r.source)}</td>
                    {showAdminControls && (
                      <td className="py-2 text-center">
                        {r.lockedAt ? (
                          <Lock size={12} className="text-green-400 mx-auto" />
                        ) : (
                          <button
                            onClick={() => handleLock(r.id)}
                            className="text-[var(--tulip-forest)]/40 hover:text-yellow-500 transition-colors"
                            title="Lock rate"
                          >
                            <Lock size={12} />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[10px] text-[var(--tulip-forest)]/40 mt-3 leading-relaxed">
        All expenses are converted based on the exchange rate prevalent on the 1st of each month.
        Rates sourced from{' '}
        <a
          href="https://frankfurter.app"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-[var(--tulip-forest)]/60 inline-flex items-center gap-0.5"
        >
          Frankfurter.app <ExternalLink size={8} />
        </a>
      </p>
    </div>
  )
}
