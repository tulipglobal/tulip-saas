'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { COUNTRIES } from '@/lib/ngo-categories'

interface CountrySelectProps {
  value: string
  onChange: (value: string) => void
  className?: string
  placeholder?: string
}

export default function CountrySelect({ value, onChange, className = '', placeholder = 'Select country' }: CountrySelectProps) {
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

  const filtered = search.trim()
    ? COUNTRIES.filter(c => c.toLowerCase().includes(search.toLowerCase()))
    : COUNTRIES

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between bg-[#e1eedd] border border-[#c8d6c0] rounded-lg px-4 py-2.5 text-sm text-left outline-none focus:border-[#f6c453] transition-all"
      >
        <span className={value ? 'text-[#183a1d]' : 'text-[#183a1d]/40'}>{value || placeholder}</span>
        <ChevronDown size={14} className={`text-[#183a1d]/40 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-[#c8d6c0] bg-[#fefbe9] shadow-xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[#c8d6c0]">
            <Search size={13} className="text-[#183a1d]/40 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search countries..."
              className="flex-1 bg-transparent text-sm text-[#183a1d] placeholder-[#183a1d]/40 outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-[#183a1d]/40 hover:text-[#183a1d]">
                <X size={12} />
              </button>
            )}
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-[#183a1d]/40 text-xs">No countries found</div>
            ) : (
              filtered.map(country => (
                <button
                  key={country}
                  type="button"
                  onClick={() => { onChange(country); setOpen(false); setSearch('') }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-[#e1eedd] transition-colors ${
                    value === country ? 'text-[#183a1d] bg-[#f6c453]/10 font-medium' : 'text-[#183a1d]'
                  }`}
                >
                  {country}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
