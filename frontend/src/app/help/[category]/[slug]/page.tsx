'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ArrowLeft, ChevronRight, ThumbsUp, ThumbsDown, Eye,
  FileText, LogIn
} from 'lucide-react'

/* ── Types ─────────────────────────────────────────────────── */

interface KBArticle {
  id: string
  slug: string
  title: string
  summary?: string
  content?: string
  category?: { name: string; slug: string }
  categorySlug?: string
  viewCount?: number
  createdAt: string
  updatedAt: string
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

/* ── Main Page ─────────────────────────────────────────────── */

export default function PublicArticlePage() {
  const params = useParams()
  const categorySlug = params.category as string
  const articleSlug = params.slug as string

  const [article, setArticle] = useState<KBArticle | null>(null)
  const [relatedArticles, setRelatedArticles] = useState<KBArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [feedbackSent, setFeedbackSent] = useState(false)

  // Load article
  useEffect(() => {
    setLoading(true)
    setFeedbackSent(false)
    fetch(`${API_URL}/api/kb/articles/${articleSlug}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        setArticle(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [articleSlug])

  // Load related articles from same category
  useEffect(() => {
    if (!categorySlug) return
    fetch(`${API_URL}/api/kb/articles?category=${categorySlug}&limit=5`)
      .then(r => r.ok ? r.json() : { articles: [] })
      .then(d => {
        const items: KBArticle[] = d.articles || d.data || d || []
        setRelatedArticles(items.filter(a => a.slug !== articleSlug).slice(0, 4))
      })
      .catch(() => {})
  }, [categorySlug, articleSlug])

  // Send feedback (public, no auth)
  const sendFeedback = async (helpful: boolean) => {
    if (!article || feedbackSent) return
    setFeedbackSent(true)
    try {
      await fetch(`${API_URL}/api/kb/articles/${article.slug}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ helpful }),
      })
    } catch { /* silent */ }
  }

  const categoryName = article?.category?.name || categorySlug.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase())

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
          <Link href="/help" className="hover:opacity-80 transition-opacity capitalize">{categoryName}</Link>
          {article && (
            <>
              <ChevronRight size={12} />
              <span className="truncate max-w-[200px] font-medium" style={{ color: 'var(--tulip-forest, #183a1d)' }}>
                {article.title}
              </span>
            </>
          )}
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
          <div className="rounded-xl border p-8 md:p-12 animate-pulse" style={{ borderColor: 'var(--tulip-sage-dark, #c8d6c0)', background: 'var(--tulip-sage, #e1eedd)' }}>
            <div className="h-6 rounded w-3/4 mb-4" style={{ background: 'var(--tulip-sage-dark, #c8d6c0)' }} />
            <div className="h-4 rounded w-1/2 mb-8" style={{ background: 'var(--tulip-sage-dark, #c8d6c0)' }} />
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-3 rounded w-full" style={{ background: 'var(--tulip-sage-dark, #c8d6c0)' }} />
              ))}
            </div>
          </div>
        ) : !article ? (
          <div className="rounded-xl border p-12 text-center" style={{ borderColor: 'var(--tulip-sage-dark, #c8d6c0)', background: 'var(--tulip-sage, #e1eedd)' }}>
            <FileText size={32} className="mx-auto mb-3" style={{ color: 'rgba(24,58,29,0.3)' }} />
            <p className="text-sm" style={{ color: 'rgba(24,58,29,0.5)' }}>Article not found.</p>
            <Link href="/help" className="text-sm font-medium mt-3 inline-block" style={{ color: 'var(--tulip-gold, #f6c453)' }}>
              Return to Help Center
            </Link>
          </div>
        ) : (
          <>
            {/* Article card */}
            <article className="rounded-xl border p-6 md:p-8 space-y-6" style={{ borderColor: 'var(--tulip-sage-dark, #c8d6c0)', background: 'var(--tulip-sage, #e1eedd)' }}>
              {/* Title + meta */}
              <div>
                <h1 className="text-xl md:text-2xl font-bold mb-2" style={{ fontFamily: 'Inter, sans-serif', color: 'var(--tulip-forest, #183a1d)' }}>
                  {article.title}
                </h1>
                <div className="flex items-center gap-3 text-xs" style={{ color: 'rgba(24,58,29,0.4)' }}>
                  <span className="px-2 py-0.5 rounded-full border" style={{ background: 'rgba(246,196,83,0.1)', borderColor: 'rgba(246,196,83,0.2)', color: 'rgba(24,58,29,0.6)' }}>
                    {categoryName}
                  </span>
                  <span>
                    Updated {new Date(article.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                  {article.viewCount !== undefined && (
                    <span className="flex items-center gap-1">
                      <Eye size={12} /> {article.viewCount} views
                    </span>
                  )}
                </div>
              </div>

              {/* Content */}
              <div
                className="prose prose-sm max-w-none"
                style={{ color: 'rgba(24,58,29,0.8)' }}
                dangerouslySetInnerHTML={{ __html: article.content || '' }}
              />

              {/* Feedback */}
              <div className="border-t pt-6" style={{ borderColor: 'var(--tulip-sage-dark, #c8d6c0)' }}>
                {feedbackSent ? (
                  <p className="text-sm font-medium" style={{ color: '#16a34a' }}>Thanks for your feedback!</p>
                ) : (
                  <div className="flex items-center gap-4">
                    <span className="text-sm" style={{ color: 'rgba(24,58,29,0.6)' }}>Was this article helpful?</span>
                    <button
                      onClick={() => sendFeedback(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:opacity-80"
                      style={{ color: '#16a34a', background: 'rgba(22,163,74,0.08)', borderColor: 'rgba(22,163,74,0.2)' }}
                    >
                      <ThumbsUp size={13} /> Yes
                    </button>
                    <button
                      onClick={() => sendFeedback(false)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:opacity-80"
                      style={{ color: '#ef4444', background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)' }}
                    >
                      <ThumbsDown size={13} /> No
                    </button>
                  </div>
                )}
              </div>
            </article>

            {/* Related articles */}
            {relatedArticles.length > 0 && (
              <div className="mt-8">
                <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: 'Inter, sans-serif', color: 'var(--tulip-forest, #183a1d)' }}>
                  Related articles
                </h3>
                <div className="rounded-xl border overflow-hidden divide-y" style={{ borderColor: 'var(--tulip-sage-dark, #c8d6c0)', background: 'var(--tulip-sage, #e1eedd)' }}>
                  {relatedArticles.map(related => (
                    <Link
                      key={related.id}
                      href={`/help/${categorySlug}/${related.slug}`}
                      className="flex items-center gap-3 px-5 py-3.5 transition-opacity hover:opacity-80 group"
                      style={{ borderColor: 'var(--tulip-sage-dark, #c8d6c0)' }}
                    >
                      <FileText size={14} style={{ color: 'rgba(24,58,29,0.4)' }} />
                      <span className="text-sm font-medium flex-1" style={{ color: 'var(--tulip-forest, #183a1d)' }}>
                        {related.title}
                      </span>
                      <ChevronRight size={14} style={{ color: 'rgba(24,58,29,0.3)' }} />
                    </Link>
                  ))}
                </div>
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
