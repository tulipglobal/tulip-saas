'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { CURRENCIES, formatCurrencyShort, formatCurrencyOption, searchCurrencies } from '@/lib/currencies'

interface CurrencySelectProps {
  value: string
  onChange: (code: string) => void
  compact?: boolean // for inline usage in budget lines
  className?: string
}

export default function CurrencySelect({ value, onChange, compact = false, className = '' }: CurrencySelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  const filtered = searchCurrencies(search)
  const display = formatCurrencyShort(value)

  if (compact) {
    return (
      <div ref={ref} className={`relative ${className}`}>
        <button type="button" onClick={() => setOpen(!open)}
          className="bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-2 py-2 text-xs text-[var(--tulip-forest)]/70 outline-none w-20 shrink-0 text-left flex items-center justify-between gap-1">
          <span className="truncate">{display}</span>
          <ChevronDown size={10} className={`text-[var(--tulip-forest)]/40 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="absolute z-50 mt-1 w-64 rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-cream)] shadow-xl overflow-hidden left-0">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--tulip-sage-dark)]">
              <Search size={13} className="text-[var(--tulip-forest)]/40 shrink-0" />
              <input ref={inputRef} type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search currencies..."
                className="flex-1 bg-transparent text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none" />
              {search && <button onClick={() => setSearch('')} className="text-[var(--tulip-forest)]/40 hover:text-[var(--tulip-forest)]"><X size={12} /></button>}
            </div>
            <div className="max-h-52 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-center text-[var(--tulip-forest)]/40 text-xs">No currencies found</div>
              ) : filtered.map(c => (
                <button key={c.code} type="button"
                  onClick={() => { onChange(c.code); setOpen(false); setSearch('') }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--tulip-sage)] transition-colors ${
                    value === c.code ? 'text-[var(--tulip-forest)] bg-[var(--tulip-gold)]/10 font-medium' : 'text-[var(--tulip-forest)]'
                  }`}>
                  {formatCurrencyOption(c)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-4 py-2.5 text-sm text-left outline-none focus:border-[var(--tulip-gold)] transition-all">
        <span className={value ? 'text-[var(--tulip-forest)]' : 'text-[var(--tulip-forest)]/40'}>
          {value ? `${display} — ${CURRENCIES.find(c => c.code === value)?.name || ''}` : 'Select currency'}
        </span>
        <ChevronDown size={14} className={`text-[var(--tulip-forest)]/40 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-cream)] shadow-xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--tulip-sage-dark)]">
            <Search size={13} className="text-[var(--tulip-forest)]/40 shrink-0" />
            <input ref={inputRef} type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, code, or country..."
              className="flex-1 bg-transparent text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none" />
            {search && <button onClick={() => setSearch('')} className="text-[var(--tulip-forest)]/40 hover:text-[var(--tulip-forest)]"><X size={12} /></button>}
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-[var(--tulip-forest)]/40 text-xs">No currencies found</div>
            ) : filtered.map(c => (
              <button key={c.code} type="button"
                onClick={() => { onChange(c.code); setOpen(false); setSearch('') }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--tulip-sage)] transition-colors ${
                  value === c.code ? 'text-[var(--tulip-forest)] bg-[var(--tulip-gold)]/10 font-medium' : 'text-[var(--tulip-forest)]'
                }`}>
                {formatCurrencyOption(c)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
