'use client'

import { useState, useEffect } from 'react'
import { apiGet } from '@/lib/api'
import { ExternalLink } from 'lucide-react'

interface ExchangeRate {
  id: string
  baseCurrency: string
  targetCurrency: string
  rate: number
  month: string
  source: string
}

interface ExchangeRateTableProps {
  projectId?: string
  baseCurrency: string
  targetCurrency: string
}

export default function ExchangeRateTable({
  projectId,
  baseCurrency,
  targetCurrency,
}: ExchangeRateTableProps) {
  const [rates, setRates] = useState<ExchangeRate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRates()
  }, [projectId, baseCurrency, targetCurrency])

  async function loadRates() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (projectId) params.set('projectId', projectId)
      const res = await apiGet(`/api/donor/exchange-rates?${params}`)
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
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 bg-white dark:bg-zinc-800">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Exchange Rates Used</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Base: {baseCurrency} | Donor: {targetCurrency}
        </p>
      </div>

      {loading ? (
        <p className="text-xs text-zinc-400 py-4 text-center">Loading rates...</p>
      ) : rates.length === 0 ? (
        <p className="text-xs text-zinc-400 py-4 text-center">No exchange rates available yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700">
                <th className="text-left py-2 font-medium">Month</th>
                <th className="text-right py-2 font-medium">Rate (1 {targetCurrency} = {baseCurrency})</th>
                <th className="text-left py-2 font-medium pl-4">Source</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => {
                // Show rate as donor→base for donor perspective
                const displayRate =
                  r.baseCurrency === targetCurrency ? r.rate : 1 / r.rate
                return (
                  <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-700/50">
                    <td className="py-2 text-zinc-900 dark:text-zinc-100">{formatMonth(r.month)}</td>
                    <td className="py-2 text-right text-zinc-900 dark:text-zinc-100 font-mono">
                      {displayRate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                    </td>
                    <td className="py-2 pl-4 text-zinc-500 dark:text-zinc-400">{getSourceLabel(r.source)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[10px] text-zinc-400 mt-3 leading-relaxed">
        All expenses are converted based on the exchange rate prevalent on the 1st of each month.
        Rates sourced from{' '}
        <a
          href="https://frankfurter.app"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-zinc-600 dark:hover:text-zinc-300 inline-flex items-center gap-0.5"
        >
          Frankfurter.app <ExternalLink size={8} />
        </a>
      </p>
    </div>
  )
}
