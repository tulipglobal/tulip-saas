'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { apiGet } from '@/lib/api'

function IconSearch({ size = 20, color = 'var(--donor-accent)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function IconFolder({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function IconReceipt({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 2 4 22 8 19 12 22 16 19 20 22 20 2" />
      <line x1="8" y1="10" x2="16" y2="10" />
      <line x1="8" y1="14" x2="16" y2="14" />
      <line x1="8" y1="6" x2="16" y2="6" />
    </svg>
  )
}

function IconFile({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  )
}

function IconClock({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

const typeIcons: Record<string, () => React.ReactElement> = {
  project: () => <IconFolder />,
  expense: () => <IconReceipt />,
  document: () => <IconFile />,
}

export default function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>(null)

  const typeLabels: Record<string, string> = {
    project: t('search.projects'),
    expense: t('search.expenses'),
    document: t('search.documents'),
  }

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
      const saved = JSON.parse(localStorage.getItem('tulip_donor_recent_searches') || '[]')
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
      const res = await apiGet(`/api/donor/search?q=${encodeURIComponent(q)}`)
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
    const recent = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5)
    localStorage.setItem('tulip_donor_recent_searches', JSON.stringify(recent))
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
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
      <div className="relative w-full max-w-xl rounded-xl shadow-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid var(--donor-border)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--donor-border)' }}>
          <IconSearch size={18} color="var(--donor-muted)" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('search.placeholder')}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--donor-dark)' }}
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: 'var(--donor-light)', color: 'var(--donor-muted)', border: '1px solid var(--donor-border)' }}>ESC</kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {loading && <p className="text-center py-4 text-sm" style={{ color: 'var(--donor-muted)' }}>{t('search.searching')}</p>}

          {!loading && query.length < 2 && recentSearches.length > 0 && (
            <div>
              <p className="px-2 py-1 text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>{t('search.recentSearches')}</p>
              {recentSearches.map(s => (
                <button key={s} onClick={() => setQuery(s)} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm hover:opacity-80 transition-colors" style={{ color: 'var(--donor-accent)' }}>
                  <IconClock /> {s}
                </button>
              ))}
            </div>
          )}

          {!loading && query.length >= 2 && results.length === 0 && (
            <p className="text-center py-8 text-sm" style={{ color: 'var(--donor-muted)' }}>{t('search.noResults')}</p>
          )}

          {!loading && Object.entries(grouped).map(([type, items]) => (
            <div key={type} className="mb-2">
              <p className="px-2 py-1 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--donor-muted)' }}>{typeLabels[type] || type}</p>
              {items.map((item: any) => {
                const IconFn = typeIcons[type] || (() => <IconFile />)
                const idx = flatIndex++
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.url)}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors"
                    style={{
                      background: idx === selectedIndex ? 'var(--donor-accent)' : 'transparent',
                      color: idx === selectedIndex ? '#fff' : 'var(--donor-dark)',
                    }}
                  >
                    <span className="shrink-0"><IconFn /></span>
                    <span className="flex-1 text-left truncate">{item.name}</span>
                    {item.status && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{
                        background: idx === selectedIndex ? 'rgba(255,255,255,0.2)' : 'var(--donor-light)',
                        color: idx === selectedIndex ? '#fff' : 'var(--donor-muted)',
                      }}>
                        {item.status}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        <div className="px-4 py-2 flex items-center gap-4 text-[11px]" style={{ borderTop: '1px solid var(--donor-border)', color: 'var(--donor-muted)' }}>
          <span><kbd className="font-mono">↑↓</kbd> {t('search.navigate')}</span>
          <span><kbd className="font-mono">↵</kbd> {t('search.open')}</span>
          <span><kbd className="font-mono">esc</kbd> {t('search.close')}</span>
        </div>
      </div>
    </div>
  )
}
