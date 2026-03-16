'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { ArrowLeft, Search, Lock, Shield, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'

// Currency metadata: code → { name, flag }
const CURRENCY_META: Record<string, { name: string; flag: string }> = {
  AUD: { name: 'Australian Dollar', flag: '🇦🇺' },
  BGN: { name: 'Bulgarian Lev', flag: '🇧🇬' },
  BRL: { name: 'Brazilian Real', flag: '🇧🇷' },
  CAD: { name: 'Canadian Dollar', flag: '🇨🇦' },
  CHF: { name: 'Swiss Franc', flag: '🇨🇭' },
  CNY: { name: 'Chinese Yuan', flag: '🇨🇳' },
  CZK: { name: 'Czech Koruna', flag: '🇨🇿' },
  DKK: { name: 'Danish Krone', flag: '🇩🇰' },
  EUR: { name: 'Euro', flag: '🇪🇺' },
  GBP: { name: 'British Pound', flag: '🇬🇧' },
  HKD: { name: 'Hong Kong Dollar', flag: '🇭🇰' },
  HUF: { name: 'Hungarian Forint', flag: '🇭🇺' },
  IDR: { name: 'Indonesian Rupiah', flag: '🇮🇩' },
  ILS: { name: 'Israeli Shekel', flag: '🇮🇱' },
  INR: { name: 'Indian Rupee', flag: '🇮🇳' },
  ISK: { name: 'Icelandic Krona', flag: '🇮🇸' },
  JPY: { name: 'Japanese Yen', flag: '🇯🇵' },
  KRW: { name: 'South Korean Won', flag: '🇰🇷' },
  MXN: { name: 'Mexican Peso', flag: '🇲🇽' },
  MYR: { name: 'Malaysian Ringgit', flag: '🇲🇾' },
  NOK: { name: 'Norwegian Krone', flag: '🇳🇴' },
  NZD: { name: 'New Zealand Dollar', flag: '🇳🇿' },
  PHP: { name: 'Philippine Peso', flag: '🇵🇭' },
  PLN: { name: 'Polish Zloty', flag: '🇵🇱' },
  RON: { name: 'Romanian Leu', flag: '🇷🇴' },
  SEK: { name: 'Swedish Krona', flag: '🇸🇪' },
  SGD: { name: 'Singapore Dollar', flag: '🇸🇬' },
  THB: { name: 'Thai Baht', flag: '🇹🇭' },
  TRY: { name: 'Turkish Lira', flag: '🇹🇷' },
  USD: { name: 'US Dollar', flag: '🇺🇸' },
  ZAR: { name: 'South African Rand', flag: '🇿🇦' },
  XAF: { name: 'CFA Franc (Central)', flag: '🇨🇲' },
  XOF: { name: 'CFA Franc (West)', flag: '🇸🇳' },
  AED: { name: 'UAE Dirham', flag: '🇦🇪' },
  NGN: { name: 'Nigerian Naira', flag: '🇳🇬' },
  KES: { name: 'Kenyan Shilling', flag: '🇰🇪' },
  GHS: { name: 'Ghanaian Cedi', flag: '🇬🇭' },
  TZS: { name: 'Tanzanian Shilling', flag: '🇹🇿' },
  UGX: { name: 'Ugandan Shilling', flag: '🇺🇬' },
  RWF: { name: 'Rwandan Franc', flag: '🇷🇼' },
  ETB: { name: 'Ethiopian Birr', flag: '🇪🇹' },
  EGP: { name: 'Egyptian Pound', flag: '🇪🇬' },
  MAD: { name: 'Moroccan Dirham', flag: '🇲🇦' },
  PKR: { name: 'Pakistani Rupee', flag: '🇵🇰' },
  BDT: { name: 'Bangladeshi Taka', flag: '🇧🇩' },
  LKR: { name: 'Sri Lankan Rupee', flag: '🇱🇰' },
  OMR: { name: 'Omani Rial', flag: '🇴🇲' },
  KWD: { name: 'Kuwaiti Dinar', flag: '🇰🇼' },
  BHD: { name: 'Bahraini Dinar', flag: '🇧🇭' },
  SAR: { name: 'Saudi Riyal', flag: '🇸🇦' },
  QAR: { name: 'Qatari Riyal', flag: '🇶🇦' },
  JOD: { name: 'Jordanian Dinar', flag: '🇯🇴' },
}

interface Rate {
  baseCurrency: string
  targetCurrency: string
  rate: number
  month: string
  source: string
  lockedAt: string | null
  sealTxHash: string | null
}

export default function CurrencyRatesPage() {
  const [baseCurrency, setBaseCurrency] = useState('USD')
  const [rates, setRates] = useState<Rate[]>([])
  const [months, setMonths] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [fetching, setFetching] = useState(false)
  const [monthOffset, setMonthOffset] = useState(0) // for horizontal scroll
  const VISIBLE_MONTHS = 6

  useEffect(() => {
    loadMonths()
  }, [])

  useEffect(() => {
    if (months.length > 0) loadRates()
  }, [baseCurrency, months])

  async function loadMonths() {
    try {
      const res = await apiFetch('/api/exchange-rates/months')
      const data = await res.json()
      setMonths(data.months || [])
    } catch { setMonths([]) }
    setLoading(false)
  }

  async function loadRates() {
    try {
      const res = await apiFetch(`/api/exchange-rates/base/${baseCurrency}`)
      const data = await res.json()
      setRates(data.rates || [])
    } catch { setRates([]) }
  }

  async function handleFetchAll() {
    setFetching(true)
    try {
      const month = new Date().toISOString().slice(0, 7)
      await apiFetch('/api/exchange-rates/fetch', { method: 'POST', body: JSON.stringify({ month }), headers: { 'Content-Type': 'application/json' } })
      await loadMonths()
      await loadRates()
    } catch (err) {
      console.error('Fetch failed:', err)
    }
    setFetching(false)
  }

  // Build grid: rows = currencies, columns = months
  const visibleMonths = months.slice(monthOffset, monthOffset + VISIBLE_MONTHS)

  // Group rates by targetCurrency → month → rate
  const rateMap: Record<string, Record<string, Rate>> = {}
  for (const r of rates) {
    if (!rateMap[r.targetCurrency]) rateMap[r.targetCurrency] = {}
    rateMap[r.targetCurrency][r.month] = r
  }

  // Get all currencies, filter by search
  const allCurrencies = Object.keys(rateMap).sort()
  const filtered = allCurrencies.filter(code => {
    if (!search) return true
    const q = search.toLowerCase()
    const meta = CURRENCY_META[code]
    return code.toLowerCase().includes(q) || (meta && meta.name.toLowerCase().includes(q))
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/settings" className="p-2 rounded-lg hover:bg-[var(--tulip-sage)] transition-colors">
            <ArrowLeft size={18} className="text-[var(--tulip-forest)]/60" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[var(--tulip-forest)]" style={{ fontFamily: 'Syne, sans-serif' }}>
              Currency Rates
            </h1>
            <p className="text-sm text-[var(--tulip-forest)]/50 mt-0.5">
              All world currencies &middot; Updated monthly from Frankfurter.app
            </p>
          </div>
        </div>

        <button
          onClick={handleFetchAll}
          disabled={fetching}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-[var(--tulip-forest)] text-[var(--tulip-cream)] hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <RefreshCw size={14} className={fetching ? 'animate-spin' : ''} />
          {fetching ? 'Fetching...' : 'Fetch Latest Rates'}
        </button>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Base currency selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--tulip-forest)]/60">Base:</span>
          {['USD', 'EUR', 'GBP'].map(c => (
            <button
              key={c}
              onClick={() => setBaseCurrency(c)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                baseCurrency === c
                  ? 'bg-[var(--tulip-gold)]/15 text-[var(--tulip-forest)] border border-[var(--tulip-gold)]/30'
                  : 'text-[var(--tulip-forest)]/50 hover:bg-[var(--tulip-sage)]'
              }`}
            >
              {CURRENCY_META[c]?.flag} {c}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tulip-forest)]/30" />
          <input
            type="text"
            placeholder="Search by code or name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-cream)] text-sm text-[var(--tulip-forest)] placeholder:text-[var(--tulip-forest)]/30 focus:outline-none focus:ring-1 focus:ring-[var(--tulip-gold)]/40"
          />
        </div>

        {/* Month navigation */}
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => setMonthOffset(Math.max(0, monthOffset - VISIBLE_MONTHS))}
            disabled={monthOffset === 0}
            className="p-1.5 rounded-lg hover:bg-[var(--tulip-sage)] transition-colors disabled:opacity-30"
          >
            <ChevronLeft size={16} className="text-[var(--tulip-forest)]/60" />
          </button>
          <span className="text-xs text-[var(--tulip-forest)]/40 px-2">
            {visibleMonths.length > 0 ? `${visibleMonths[visibleMonths.length - 1]} — ${visibleMonths[0]}` : 'No data'}
          </span>
          <button
            onClick={() => setMonthOffset(Math.min(months.length - VISIBLE_MONTHS, monthOffset + VISIBLE_MONTHS))}
            disabled={monthOffset + VISIBLE_MONTHS >= months.length}
            className="p-1.5 rounded-lg hover:bg-[var(--tulip-sage)] transition-colors disabled:opacity-30"
          >
            <ChevronRight size={16} className="text-[var(--tulip-forest)]/60" />
          </button>
        </div>
      </div>

      {/* Rates table */}
      {loading ? (
        <div className="text-center py-20 text-[var(--tulip-forest)]/40 text-sm animate-pulse">Loading currency rates...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-[var(--tulip-forest)]/40 text-sm">
          {search ? 'No currencies match your search' : 'No exchange rates found. Click "Fetch Latest Rates" to seed data.'}
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--tulip-sage-dark)] overflow-hidden" style={{ background: 'var(--tulip-cream)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--tulip-sage-dark)]" style={{ background: 'var(--tulip-sage)' }}>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--tulip-forest)]/70 uppercase tracking-wider sticky left-0 z-10" style={{ background: 'var(--tulip-sage)', minWidth: 200 }}>
                    Currency
                  </th>
                  {visibleMonths.map(m => (
                    <th key={m} className="text-right px-4 py-3 text-xs font-semibold text-[var(--tulip-forest)]/70 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: 120 }}>
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((code, i) => {
                  const meta = CURRENCY_META[code]
                  return (
                    <tr key={code} className={`border-b border-[var(--tulip-sage-dark)]/50 hover:bg-[var(--tulip-sage)]/50 transition-colors ${i % 2 === 0 ? '' : 'bg-[var(--tulip-sage)]/20'}`}>
                      <td className="px-4 py-2.5 sticky left-0 z-10" style={{ background: i % 2 === 0 ? 'var(--tulip-cream)' : 'rgba(var(--tulip-sage-rgb, 200,214,192), 0.2)' }}>
                        <div className="flex items-center gap-2">
                          <span className="text-base">{meta?.flag || '🏳️'}</span>
                          <span className="font-mono font-semibold text-[var(--tulip-forest)]">{code}</span>
                          <span className="text-[var(--tulip-forest)]/40 text-xs truncate max-w-[120px]">{meta?.name || ''}</span>
                        </div>
                      </td>
                      {visibleMonths.map(m => {
                        const r = rateMap[code]?.[m]
                        return (
                          <td key={m} className="text-right px-4 py-2.5 font-mono text-[var(--tulip-forest)]">
                            {r ? (
                              <div className="flex items-center justify-end gap-1.5">
                                {r.lockedAt && <Lock size={10} className="text-[var(--tulip-gold)]" />}
                                {r.sealTxHash && <Shield size={10} className="text-green-500" />}
                                <span>{Number(r.rate).toFixed(r.rate >= 100 ? 2 : 4)}</span>
                              </div>
                            ) : (
                              <span className="text-[var(--tulip-forest)]/20">—</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-[var(--tulip-forest)]/40 px-1">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1"><Lock size={10} className="text-[var(--tulip-gold)]" /> Locked</span>
          <span className="flex items-center gap-1"><Shield size={10} className="text-green-500" /> Blockchain sealed</span>
        </div>
        <div>
          Rates from{' '}
          <a href="https://www.frankfurter.app" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--tulip-forest)]/60">
            Frankfurter.app
          </a>
          {' '}(European Central Bank data)
        </div>
      </div>
    </div>
  )
}
