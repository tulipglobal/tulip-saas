'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ArrowLeft, ChevronRight, Eye, FileText, LogIn
} from 'lucide-react'

/* ── Types ─────────────────────────────────────────────────── */

interface KBCategory {
  id: string
  slug: string
  name: string
  description?: string
  icon?: string
  articleCount?: number
}

interface KBArticle {
  id: string
  slug: string
  title: string
  content?: string
  viewCount?: number
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050'

/* ── Helpers ───────────────────────────────────────────────── */

function stripHtml(html: string, maxLen = 150): string {
  const text = html.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim()
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text
}

/* ── Main Page ─────────────────────────────────────────────── */

export default function PublicCategoryPage() {
  const params = useParams()
  const categorySlug = params.category as string

  const [category, setCategory] = useState<KBCategory | null>(null)
  const [articles, setArticles] = useState<KBArticle[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`${API_URL}/api/kb/categories`).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`${API_URL}/api/kb/articles?category=${encodeURIComponent(categorySlug)}`).then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([cats, arts]) => {
      const catList = Array.isArray(cats) ? cats : cats.data || cats.categories || []
      const artList = Array.isArray(arts) ? arts : arts.data || arts.articles || []
      setCategory(catList.find((c: KBCategory) => c.slug === categorySlug) || null)
      setArticles(artList)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [categorySlug])

  const categoryName = category?.name || categorySlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

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

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-8">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs mb-6" style={{ color: 'rgba(24,58,29,0.5)' }}>
          <Link href="/help" className="hover:opacity-80 transition-opacity">Help Center</Link>
          <ChevronRight size={12} />
          <span className="font-medium" style={{ color: 'var(--tulip-forest, #183a1d)' }}>{categoryName}</span>
        </div>

        {/* Back link */}
        <Link
          href="/help"
          className="inline-flex items-center gap-1.5 text-sm mb-6 transition-opacity hover:opacity-70"
          style={{ color: 'rgba(24,58,29,0.6)' }}
        >
          <ArrowLeft size={14} /> Back to Help Center
        </Link>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-xl border p-5 animate-pulse" style={{ borderColor: 'var(--tulip-sage-dark, #c8d6c0)', background: 'var(--tulip-sage, #e1eedd)' }}>
                <div className="h-4 rounded w-3/4 mb-2" style={{ background: 'var(--tulip-sage-dark, #c8d6c0)' }} />
                <div className="h-3 rounded w-full" style={{ background: 'var(--tulip-sage-dark, #c8d6c0)' }} />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Category header */}
            <div className="mb-8">
              <h1 className="text-xl md:text-2xl font-bold" style={{ fontFamily: 'Inter, sans-serif', color: 'var(--tulip-forest, #183a1d)' }}>
                {category?.icon && <span className="mr-2">{category.icon}</span>}
                {categoryName}
              </h1>
              {category?.description && (
                <p className="text-sm mt-2" style={{ color: 'rgba(24,58,29,0.6)' }}>{category.description}</p>
              )}
            </div>

            {/* Articles */}
            {articles.length === 0 ? (
              <div className="rounded-xl border p-12 text-center" style={{ borderColor: 'var(--tulip-sage-dark, #c8d6c0)', background: 'var(--tulip-sage, #e1eedd)' }}>
                <FileText size={32} className="mx-auto mb-3" style={{ color: 'rgba(24,58,29,0.3)' }} />
                <p className="text-sm" style={{ color: 'rgba(24,58,29,0.5)' }}>No articles in this category yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {articles.map(article => (
                  <Link
                    key={article.id}
                    href={`/help/${categorySlug}/${article.slug}`}
                    className="group block rounded-xl border p-5 transition-all hover:shadow-sm"
                    style={{ borderColor: 'var(--tulip-sage-dark, #c8d6c0)', background: 'var(--tulip-sage, #e1eedd)' }}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'rgba(246,196,83,0.1)' }}>
                        <FileText size={15} style={{ color: 'rgba(24,58,29,0.5)' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--tulip-forest, #183a1d)' }}>
                          {article.title}
                        </h3>
                        {article.content && (
                          <p className="text-xs line-clamp-2 mb-2" style={{ color: 'rgba(24,58,29,0.5)' }}>
                            {stripHtml(article.content)}
                          </p>
                        )}
                        {article.viewCount !== undefined && (
                          <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: 'rgba(24,58,29,0.4)' }}>
                            <Eye size={11} /> {article.viewCount} views
                          </span>
                        )}
                      </div>
                      <ChevronRight size={14} className="shrink-0 mt-1 opacity-30 group-hover:opacity-60 transition-opacity" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t py-6 px-4 text-center mt-12" style={{ borderColor: 'var(--tulip-sage-dark, #c8d6c0)' }}>
        <p className="text-xs" style={{ color: 'rgba(24,58,29,0.4)' }}>
          &copy; {new Date().getFullYear()} Sealayer. All rights reserved.
        </p>
      </footer>
    </div>
  )
}
