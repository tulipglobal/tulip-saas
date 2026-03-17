'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Search, ChevronRight, BookOpen, FileText, FolderOpen,
  Shield, Receipt, Users, Code2, HelpCircle, Settings,
  Layers, ArrowRight, LogIn
} from 'lucide-react'

/* ── Types ─────────────────────────────────────────────────── */

interface KBCategory {
  id: string
  slug: string
  name: string
  description: string
  icon?: string
  articleCount: number
  role: string
}

interface KBArticle {
  id: string
  slug: string
  title: string
  summary?: string
  categorySlug?: string
  viewCount?: number
}

/* ── Icon mapping ──────────────────────────────────────────── */

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'getting-started': <BookOpen size={22} />,
  'projects': <FolderOpen size={22} />,
  'expenses': <Receipt size={22} />,
  'documents': <FileText size={22} />,
  'blockchain': <Shield size={22} />,
  'verification': <Shield size={22} />,
  'team': <Users size={22} />,
  'api': <Code2 size={22} />,
  'integrations': <Layers size={22} />,
  'billing': <Receipt size={22} />,
  'settings': <Settings size={22} />,
}

function getCategoryIcon(slug: string) {
  return CATEGORY_ICONS[slug] || <HelpCircle size={22} />
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

/* ── Main Page ─────────────────────────────────────────────── */

export default function PublicHelpPage() {
  const [ngoCategories, setNgoCategories] = useState<KBCategory[]>([])
  const [donorCategories, setDonorCategories] = useState<KBCategory[]>([])
  const [featuredArticles, setFeaturedArticles] = useState<KBArticle[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<KBArticle[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load categories for both roles
  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/kb/categories?role=ngo`).then(r => r.ok ? r.json() : { categories: [] }),
      fetch(`${API_URL}/api/kb/categories?role=donor`).then(r => r.ok ? r.json() : { categories: [] }),
      fetch(`${API_URL}/api/kb/articles/featured`).then(r => r.ok ? r.json() : { articles: [] }).catch(() => ({ articles: [] })),
    ]).then(([ngo, donor, featured]) => {
      setNgoCategories(ngo.categories || ngo.data || ngo || [])
      setDonorCategories(donor.categories || donor.data || donor || [])
      setFeaturedArticles(featured.articles || featured.data || featured || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  // Search with debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      setIsSearching(false)
      return
    }
    setIsSearching(true)
    const timer = setTimeout(() => {
      fetch(`${API_URL}/api/kb/search?q=${encodeURIComponent(searchQuery)}`)
        .then(r => r.ok ? r.json() : { articles: [] })
        .then(d => {
          setSearchResults(d.articles || d.data || d || [])
          setIsSearching(false)
        })
        .catch(() => setIsSearching(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  return (
    <div className="min-h-screen" style={{ background: 'var(--tulip-cream, #fefbe9)', color: 'var(--tulip-forest, #183a1d)' }}>

      {/* Header */}
      <header className="border-b" style={{ borderColor: 'var(--tulip-sage-dark, #c8d6c0)' }}>
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--tulip-gold, #f6c453)' }}>
              <span className="font-bold text-sm" style={{ color: 'var(--tulip-forest, #183a1d)', fontFamily: 'Inter, sans-serif' }}>S</span>
            </div>
            <span className="font-bold text-lg" style={{ color: 'var(--tulip-forest, #183a1d)', fontFamily: 'Inter, sans-serif' }}>
              Sealayer
            </span>
          </Link>
          <Link
            href="/login"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ color: 'var(--tulip-forest, #183a1d)', background: 'var(--tulip-sage, #e1eedd)' }}
          >
            <LogIn size={14} /> Sign In
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 md:py-24 text-center px-4" style={{ background: 'var(--tulip-sage, #e1eedd)' }}>
        <h1 className="text-3xl md:text-4xl font-bold mb-3" style={{ fontFamily: 'Inter, sans-serif', color: 'var(--tulip-forest, #183a1d)' }}>
          How can we help?
        </h1>
        <p className="text-sm md:text-base mb-8" style={{ color: 'rgba(24,58,29,0.6)' }}>
          Browse our knowledge base or search for answers to your questions
        </p>
        <div
          className="max-w-xl mx-auto flex items-center gap-3 rounded-xl px-5 py-3.5 border shadow-sm"
          style={{ background: 'var(--tulip-cream, #fefbe9)', borderColor: 'var(--tulip-sage-dark, #c8d6c0)' }}
        >
          <Search size={18} style={{ color: 'rgba(24,58,29,0.4)' }} />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search articles, guides, FAQs..."
            className="bg-transparent text-sm outline-none w-full"
            style={{ color: 'var(--tulip-forest, #183a1d)' }}
          />
        </div>

        {/* Search results overlay */}
        {searchQuery.trim() && (
          <div className="max-w-xl mx-auto mt-3 text-left rounded-xl border shadow-lg overflow-hidden"
            style={{ background: 'var(--tulip-cream, #fefbe9)', borderColor: 'var(--tulip-sage-dark, #c8d6c0)' }}>
            {isSearching ? (
              <div className="px-5 py-4 text-sm" style={{ color: 'rgba(24,58,29,0.4)' }}>Searching...</div>
            ) : searchResults.length === 0 ? (
              <div className="px-5 py-4 text-sm" style={{ color: 'rgba(24,58,29,0.4)' }}>No results found for &quot;{searchQuery}&quot;</div>
            ) : (
              searchResults.slice(0, 8).map(article => (
                <Link
                  key={article.id}
                  href={`/help/${article.categorySlug || 'general'}/${article.slug}`}
                  className="flex items-center gap-3 px-5 py-3 hover:opacity-80 transition-opacity border-b last:border-0"
                  style={{ borderColor: 'var(--tulip-sage-dark, #c8d6c0)' }}
                >
                  <FileText size={14} style={{ color: 'rgba(24,58,29,0.4)' }} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium" style={{ color: 'var(--tulip-forest, #183a1d)' }}>{article.title}</span>
                    {article.summary && (
                      <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'rgba(24,58,29,0.5)' }}>{article.summary}</p>
                    )}
                  </div>
                  <ChevronRight size={14} style={{ color: 'rgba(24,58,29,0.3)' }} />
                </Link>
              ))
            )}
          </div>
        )}
      </section>

      {/* Two-column: NGOs + Donors */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 py-12 md:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">

          {/* For NGOs */}
          <div>
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(246,196,83,0.15)' }}>
                <FolderOpen size={16} style={{ color: 'var(--tulip-forest, #183a1d)' }} />
              </div>
              <h2 className="text-lg font-bold" style={{ fontFamily: 'Inter, sans-serif', color: 'var(--tulip-forest, #183a1d)' }}>
                For NGOs
              </h2>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="rounded-xl border p-4 animate-pulse" style={{ borderColor: 'var(--tulip-sage-dark, #c8d6c0)', background: 'var(--tulip-sage, #e1eedd)' }}>
                    <div className="h-4 rounded w-3/4" style={{ background: 'var(--tulip-sage-dark, #c8d6c0)' }} />
                  </div>
                ))}
              </div>
            ) : ngoCategories.length === 0 ? (
              <p className="text-sm" style={{ color: 'rgba(24,58,29,0.4)' }}>No categories available yet.</p>
            ) : (
              <div className="space-y-3">
                {ngoCategories.map(cat => (
                  <Link
                    key={cat.id}
                    href={`/help/${cat.slug}`}
                    className="group flex items-center gap-4 rounded-xl border p-4 transition-all hover:shadow-sm"
                    style={{ borderColor: 'var(--tulip-sage-dark, #c8d6c0)', background: 'var(--tulip-sage, #e1eedd)' }}
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(246,196,83,0.1)', color: 'var(--tulip-forest, #183a1d)' }}>
                      {getCategoryIcon(cat.slug)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold" style={{ color: 'var(--tulip-forest, #183a1d)' }}>{cat.name}</h4>
                      <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'rgba(24,58,29,0.5)' }}>{cat.description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px]" style={{ color: 'rgba(24,58,29,0.4)' }}>{cat.articleCount} articles</span>
                      <ChevronRight size={14} className="opacity-30 group-hover:opacity-60 transition-opacity" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* For Donors */}
          <div>
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(246,196,83,0.15)' }}>
                <Users size={16} style={{ color: 'var(--tulip-forest, #183a1d)' }} />
              </div>
              <h2 className="text-lg font-bold" style={{ fontFamily: 'Inter, sans-serif', color: 'var(--tulip-forest, #183a1d)' }}>
                For Donors
              </h2>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="rounded-xl border p-4 animate-pulse" style={{ borderColor: 'var(--tulip-sage-dark, #c8d6c0)', background: 'var(--tulip-sage, #e1eedd)' }}>
                    <div className="h-4 rounded w-3/4" style={{ background: 'var(--tulip-sage-dark, #c8d6c0)' }} />
                  </div>
                ))}
              </div>
            ) : donorCategories.length === 0 ? (
              <p className="text-sm" style={{ color: 'rgba(24,58,29,0.4)' }}>No categories available yet.</p>
            ) : (
              <div className="space-y-3">
                {donorCategories.map(cat => (
                  <Link
                    key={cat.id}
                    href={`/help/${cat.slug}`}
                    className="group flex items-center gap-4 rounded-xl border p-4 transition-all hover:shadow-sm"
                    style={{ borderColor: 'var(--tulip-sage-dark, #c8d6c0)', background: 'var(--tulip-sage, #e1eedd)' }}
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(246,196,83,0.1)', color: 'var(--tulip-forest, #183a1d)' }}>
                      {getCategoryIcon(cat.slug)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold" style={{ color: 'var(--tulip-forest, #183a1d)' }}>{cat.name}</h4>
                      <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'rgba(24,58,29,0.5)' }}>{cat.description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px]" style={{ color: 'rgba(24,58,29,0.4)' }}>{cat.articleCount} articles</span>
                      <ChevronRight size={14} className="opacity-30 group-hover:opacity-60 transition-opacity" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Featured Articles */}
      {featuredArticles.length > 0 && (
        <section className="border-t py-12 md:py-16 px-4 md:px-6" style={{ borderColor: 'var(--tulip-sage-dark, #c8d6c0)' }}>
          <div className="max-w-6xl mx-auto">
            <h2 className="text-lg font-bold mb-6" style={{ fontFamily: 'Inter, sans-serif', color: 'var(--tulip-forest, #183a1d)' }}>
              Featured Articles
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {featuredArticles.slice(0, 6).map(article => (
                <Link
                  key={article.id}
                  href={`/help/${article.categorySlug || 'general'}/${article.slug}`}
                  className="group rounded-xl border p-5 transition-all hover:shadow-sm"
                  style={{ borderColor: 'var(--tulip-sage-dark, #c8d6c0)', background: 'var(--tulip-sage, #e1eedd)' }}
                >
                  <h4 className="text-sm font-semibold mb-1.5" style={{ color: 'var(--tulip-forest, #183a1d)' }}>{article.title}</h4>
                  {article.summary && (
                    <p className="text-xs line-clamp-2 mb-3" style={{ color: 'rgba(24,58,29,0.5)' }}>{article.summary}</p>
                  )}
                  <span className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--tulip-gold, #f6c453)' }}>
                    Read more <ArrowRight size={12} />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer CTA */}
      <section className="py-12 text-center px-4" style={{ background: 'var(--tulip-forest, #183a1d)' }}>
        <h3 className="text-lg font-bold mb-2" style={{ fontFamily: 'Inter, sans-serif', color: 'var(--tulip-cream, #fefbe9)' }}>
          Need more help?
        </h3>
        <p className="text-sm mb-6" style={{ color: 'rgba(254,251,233,0.6)' }}>
          Log in to your account to raise a support ticket and get personalised assistance.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition-colors"
          style={{ background: 'var(--tulip-gold, #f6c453)', color: 'var(--tulip-forest, #183a1d)' }}
        >
          <LogIn size={16} /> Sign in to get support
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t py-6 px-4 text-center" style={{ borderColor: 'var(--tulip-sage-dark, #c8d6c0)' }}>
        <p className="text-xs" style={{ color: 'rgba(24,58,29,0.4)' }}>
          &copy; {new Date().getFullYear()} Sealayer. All rights reserved.
        </p>
      </footer>
    </div>
  )
}
