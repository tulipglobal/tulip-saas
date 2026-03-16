'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, FileText, FolderOpen, Receipt, Users, Clock, X } from 'lucide-react'
import { apiFetch } from '@/lib/api'

const typeIcons: Record<string, any> = {
  project: FolderOpen,
  expense: Receipt,
  document: FileText,
  donor: Users,
}

const typeLabels: Record<string, string> = {
  project: 'Projects',
  expense: 'Expenses',
  document: 'Documents',
  donor: 'Donors',
}

export default function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>(null)

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
      const saved = JSON.parse(localStorage.getItem('tulip_recent_searches') || '[]')
      setRecentSearches(saved)
      setQuery('')
      setResults([])
      setSelectedIndex(0)
    }
  }, [open])

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const res = await apiFetch(`/api/search?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        setResults(data.results || [])
      } else {
        setResults([])
      }
      setSelectedIndex(0)
    } catch { setResults([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, search])

  function navigate(url: string) {
    // Save to recent
    const recent = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5)
    localStorage.setItem('tulip_recent_searches', JSON.stringify(recent))
    onClose()
    router.push(url)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      navigate(results[selectedIndex].url)
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!open) return null

  const grouped = results.reduce((acc: Record<string, any[]>, r) => {
    if (!acc[r.type]) acc[r.type] = []
    acc[r.type].push(r)
    return acc
  }, {})

  let flatIndex = 0

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-xl rounded-xl shadow-2xl overflow-hidden" style={{ background: 'var(--tulip-cream)', border: '1px solid #c8d6c0' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid #c8d6c0' }}>
          <Search className="w-5 h-5 shrink-0 text-[var(--tulip-forest)]/40" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search projects, expenses, documents..."
            className="flex-1 bg-transparent outline-none text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40"
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--tulip-sage)] text-[var(--tulip-forest)]/60 border border-[var(--tulip-sage-dark)]">ESC</kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {loading && <p className="text-center py-4 text-sm text-[var(--tulip-forest)]/50">Searching...</p>}

          {!loading && query.length < 2 && recentSearches.length > 0 && (
            <div>
              <p className="px-2 py-1 text-xs font-medium text-[var(--tulip-forest)]/50">Recent Searches</p>
              {recentSearches.map(s => (
                <button key={s} onClick={() => setQuery(s)} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-[var(--tulip-forest)]/70 hover:bg-[var(--tulip-sage)] transition-colors">
                  <Clock className="w-3.5 h-3.5" /> {s}
                </button>
              ))}
            </div>
          )}

          {!loading && query.length >= 2 && results.length === 0 && (
            <p className="text-center py-8 text-sm text-[var(--tulip-forest)]/50">No results found</p>
          )}

          {!loading && Object.entries(grouped).map(([type, items]) => (
            <div key={type} className="mb-2">
              <p className="px-2 py-1 text-xs font-medium uppercase tracking-wider text-[var(--tulip-forest)]/50">{typeLabels[type] || type}</p>
              {items.map((item: any) => {
                const Icon = typeIcons[type] || FileText
                const idx = flatIndex++
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.url)}
                    className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors ${idx === selectedIndex ? '' : 'hover:bg-[var(--tulip-sage)]'}`}
                    style={{
                      background: idx === selectedIndex ? '#f6c453' : 'transparent',
                      color: idx === selectedIndex ? '#183a1d' : 'var(--tulip-forest)',
                    }}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1 text-left truncate">{item.name}</span>
                    {item.status && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: idx === selectedIndex ? 'rgba(0,0,0,0.1)' : 'var(--tulip-sage)', color: idx === selectedIndex ? '#183a1d' : '#183a1d/60' }}>
                        {item.status}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        <div className="px-4 py-2 flex items-center gap-4 text-[11px] text-[var(--tulip-forest)]/50" style={{ borderTop: '1px solid #c8d6c0' }}>
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> open</span>
          <span><kbd className="font-mono">esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}
