'use client'

import { useEffect, useState } from 'react'
import { apiGet } from '@/lib/api'
import { ArrowLeft, Search, Lock, Shield, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'

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

export default function DonorCurrencyRatesPage() {
  const [baseCurrency, setBaseCurrency] = useState('USD')
  const [rates, setRates] = useState<Rate[]>([])
  const [months, setMonths] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [monthOffset, setMonthOffset] = useState(0)
  const VISIBLE_MONTHS = 6

  useEffect(() => {
    apiGet('/api/donor/exchange-rates/months')
      .then(r => r.ok ? r.json() : { months: [] })
      .then(d => setMonths(d.months || []))
      .catch(() => setMonths([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (months.length > 0) {
      apiGet(`/api/donor/exchange-rates/base/${baseCurrency}`)
        .then(r => r.ok ? r.json() : { rates: [] })
        .then(d => setRates(d.rates || []))
        .catch(() => setRates([]))
    }
  }, [baseCurrency, months])

  const visibleMonths = months.slice(monthOffset, monthOffset + VISIBLE_MONTHS)

  const rateMap: Record<string, Record<string, Rate>> = {}
  for (const r of rates) {
    if (!rateMap[r.targetCurrency]) rateMap[r.targetCurrency] = {}
    rateMap[r.targetCurrency][r.month] = r
  }

  const allCurrencies = Object.keys(rateMap).sort()
  const filtered = allCurrencies.filter(code => {
    if (!search) return true
    const q = search.toLowerCase()
    const meta = CURRENCY_META[code]
    return code.toLowerCase().includes(q) || (meta && meta.name.toLowerCase().includes(q))
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="p-2 rounded-lg hover:bg-white/5 transition-colors">
            <ArrowLeft size={18} className="text-white/60" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
              Currency Rates
            </h1>
            <p className="text-sm text-white/50 mt-0.5">
              All world currencies &middot; Updated monthly from Frankfurter.app
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white/60">Base:</span>
          {['USD', 'EUR', 'GBP'].map(c => (
            <button
              key={c}
              onClick={() => setBaseCurrency(c)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                baseCurrency === c
                  ? 'bg-[#3C3489]/30 text-white border border-[#3C3489]/50'
                  : 'text-white/50 hover:bg-white/5'
              }`}
            >
              {CURRENCY_META[c]?.flag} {c}
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="Search by code or name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-[#3C3489]/40"
          />
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => setMonthOffset(Math.max(0, monthOffset - VISIBLE_MONTHS))}
            disabled={monthOffset === 0}
            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-30"
          >
            <ChevronLeft size={16} className="text-white/60" />
          </button>
          <span className="text-xs text-white/40 px-2">
            {visibleMonths.length > 0 ? `${visibleMonths[visibleMonths.length - 1]} — ${visibleMonths[0]}` : 'No data'}
          </span>
          <button
            onClick={() => setMonthOffset(Math.min(months.length - VISIBLE_MONTHS, monthOffset + VISIBLE_MONTHS))}
            disabled={monthOffset + VISIBLE_MONTHS >= months.length}
            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-30"
          >
            <ChevronRight size={16} className="text-white/60" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-white/40 text-sm animate-pulse">Loading currency rates...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-white/40 text-sm">
          {search ? 'No currencies match your search' : 'No exchange rates available yet.'}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 overflow-hidden bg-white/[0.02]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-white/70 uppercase tracking-wider sticky left-0 z-10 bg-[#0c0a1d]" style={{ minWidth: 200 }}>
                    Currency
                  </th>
                  {visibleMonths.map(m => (
                    <th key={m} className="text-right px-4 py-3 text-xs font-semibold text-white/70 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: 120 }}>
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((code, i) => {
                  const meta = CURRENCY_META[code]
                  return (
                    <tr key={code} className={`border-b border-white/5 hover:bg-white/5 transition-colors ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}>
                      <td className="px-4 py-2.5 sticky left-0 z-10 bg-[#0c0a1d]">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{meta?.flag || '🏳️'}</span>
                          <span className="font-mono font-semibold text-white">{code}</span>
                          <span className="text-white/40 text-xs truncate max-w-[120px]">{meta?.name || ''}</span>
                        </div>
                      </td>
                      {visibleMonths.map(m => {
                        const r = rateMap[code]?.[m]
                        return (
                          <td key={m} className="text-right px-4 py-2.5 font-mono text-white/90">
                            {r ? (
                              <div className="flex items-center justify-end gap-1.5">
                                {r.lockedAt && <Lock size={10} className="text-yellow-400/70" />}
                                {r.sealTxHash && <Shield size={10} className="text-green-400/70" />}
                                <span>{Number(r.rate).toFixed(r.rate >= 100 ? 2 : 4)}</span>
                              </div>
                            ) : (
                              <span className="text-white/20">—</span>
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

      <div className="flex items-center justify-between text-xs text-white/40 px-1">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1"><Lock size={10} className="text-yellow-400/70" /> Locked</span>
          <span className="flex items-center gap-1"><Shield size={10} className="text-green-400/70" /> Blockchain sealed</span>
        </div>
        <div>
          Rates from{' '}
          <a href="https://www.frankfurter.app" target="_blank" rel="noopener noreferrer" className="underline hover:text-white/60">
            Frankfurter.app
          </a>
          {' '}(European Central Bank data)
        </div>
      </div>
    </div>
  )
}
