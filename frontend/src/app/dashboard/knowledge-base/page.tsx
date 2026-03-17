'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import {
  Search, ChevronRight, ArrowLeft, ThumbsUp, ThumbsDown,
  BookOpen, FileText, FolderOpen, Layers, Shield, Receipt,
  Users, Code2, HelpCircle, Settings
} from 'lucide-react'
import { useTranslations } from 'next-intl'

/* ── Types ─────────────────────────────────────────────────── */

interface KBCategory {
  id: string
  slug: string
  name: string
  description: string
  icon?: string
  articleCount: number
}

interface KBArticle {
  id: string
  slug: string
  title: string
  summary?: string
  content?: string
  category?: KBCategory
  categorySlug?: string
  viewCount?: number
  createdAt: string
  updatedAt: string
}

/* ── Icon mapping ──────────────────────────────────────────── */

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'getting-started': <BookOpen size={22} className="text-[var(--tulip-forest)]" />,
  'projects': <FolderOpen size={22} className="text-[var(--tulip-forest)]" />,
  'expenses': <Receipt size={22} className="text-[var(--tulip-forest)]" />,
  'documents': <FileText size={22} className="text-[var(--tulip-forest)]" />,
  'blockchain': <Shield size={22} className="text-[var(--tulip-forest)]" />,
  'verification': <Shield size={22} className="text-[var(--tulip-forest)]" />,
  'team': <Users size={22} className="text-[var(--tulip-forest)]" />,
  'api': <Code2 size={22} className="text-[var(--tulip-forest)]" />,
  'integrations': <Layers size={22} className="text-[var(--tulip-forest)]" />,
  'billing': <Receipt size={22} className="text-[var(--tulip-forest)]" />,
  'settings': <Settings size={22} className="text-[var(--tulip-forest)]" />,
}

function getCategoryIcon(slug: string) {
  return CATEGORY_ICONS[slug] || <HelpCircle size={22} className="text-[var(--tulip-forest)]" />
}

/* ── Main Page ─────────────────────────────────────────────── */

export default function KnowledgeBasePage() {
  const t = useTranslations('knowledgeBase')

  const [categories, setCategories] = useState<KBCategory[]>([])
  const [articles, setArticles] = useState<KBArticle[]>([])
  const [activeCategory, setActiveCategory] = useState<KBCategory | null>(null)
  const [activeArticle, setActiveArticle] = useState<KBArticle | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<KBArticle[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [loading, setLoading] = useState(true)
  const [articlesLoading, setArticlesLoading] = useState(false)
  const [articleLoading, setArticleLoading] = useState(false)
  const [feedbackSent, setFeedbackSent] = useState(false)

  // Load categories
  useEffect(() => {
    apiGet('/api/kb/categories?role=ngo')
      .then(r => r.ok ? r.json() : { categories: [] })
      .then(d => {
        setCategories(d.categories || d.data || d || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
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
      apiGet(`/api/kb/search?q=${encodeURIComponent(searchQuery)}&role=ngo`)
        .then(r => r.ok ? r.json() : { articles: [] })
        .then(d => {
          setSearchResults(d.articles || d.data || d || [])
          setIsSearching(false)
        })
        .catch(() => setIsSearching(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Load articles for a category
  const loadCategoryArticles = useCallback(async (category: KBCategory) => {
    setActiveCategory(category)
    setActiveArticle(null)
    setArticlesLoading(true)
    setFeedbackSent(false)
    try {
      const res = await apiGet(`/api/kb/articles?role=ngo&category=${category.slug}`)
      if (res.ok) {
        const d = await res.json()
        setArticles(d.articles || d.data || d || [])
      }
    } catch { /* silent */ }
    setArticlesLoading(false)
  }, [])

  // Load a single article
  const loadArticle = useCallback(async (slug: string) => {
    setArticleLoading(true)
    setFeedbackSent(false)
    try {
      const res = await apiGet(`/api/kb/articles/${slug}`)
      if (res.ok) {
        const article = await res.json()
        setActiveArticle(article)
      }
    } catch { /* silent */ }
    setArticleLoading(false)
  }, [])

  // Send feedback
  const sendFeedback = async (helpful: boolean) => {
    if (!activeArticle || feedbackSent) return
    setFeedbackSent(true)
    try {
      await apiPost(`/api/kb/articles/${activeArticle.slug}/feedback`, { helpful })
    } catch { /* silent */ }
  }

  // Navigate back
  const goBack = () => {
    if (activeArticle) {
      setActiveArticle(null)
    } else if (activeCategory) {
      setActiveCategory(null)
      setArticles([])
    }
  }

  /* ── Breadcrumb ──────────────────────────────────────────── */

  const breadcrumb = (
    <div className="flex items-center gap-1.5 text-xs text-[var(--tulip-forest)]/50 mb-4">
      <button
        onClick={() => { setActiveCategory(null); setActiveArticle(null); setArticles([]) }}
        className="hover:text-[var(--tulip-forest)] transition-colors"
      >
        {t('title')}
      </button>
      {activeCategory && (
        <>
          <ChevronRight size={12} />
          <button
            onClick={() => setActiveArticle(null)}
            className={`hover:text-[var(--tulip-forest)] transition-colors ${!activeArticle ? 'text-[var(--tulip-forest)] font-medium' : ''}`}
          >
            {activeCategory.name}
          </button>
        </>
      )}
      {activeArticle && (
        <>
          <ChevronRight size={12} />
          <span className="text-[var(--tulip-forest)] font-medium truncate max-w-[200px]">
            {activeArticle.title}
          </span>
        </>
      )}
    </div>
  )

  /* ── Article view ────────────────────────────────────────── */

  if (activeArticle) {
    return (
      <div className="p-4 md:p-6 space-y-4 animate-fade-up max-w-4xl">
        {breadcrumb}

        <button
          onClick={goBack}
          className="flex items-center gap-1.5 text-sm text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)] transition-colors mb-2"
        >
          <ArrowLeft size={14} /> {t('backToArticles')}
        </button>

        {articleLoading ? (
          <div className="p-12 text-center text-[var(--tulip-forest)]/40 text-sm">{t('loading')}</div>
        ) : (
          <div className="rounded-xl border border-[var(--tulip-sage-dark)] p-6 md:p-8 space-y-6" style={{ background: 'var(--tulip-sage)' }}>
            {/* Title + meta */}
            <div>
              <h1 className="text-xl font-bold text-[var(--tulip-forest)]" style={{ fontFamily: 'Inter, sans-serif' }}>
                {activeArticle.title}
              </h1>
              <div className="flex items-center gap-3 mt-2 text-xs text-[var(--tulip-forest)]/40">
                {activeArticle.category && (
                  <span className="px-2 py-0.5 rounded-full bg-[var(--tulip-gold)]/10 text-[var(--tulip-forest)]/60 border border-[var(--tulip-gold)]/20">
                    {activeArticle.category.name}
                  </span>
                )}
                <span>
                  {t('updated')} {new Date(activeArticle.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
                {activeArticle.viewCount !== undefined && (
                  <span>{activeArticle.viewCount} {t('views')}</span>
                )}
              </div>
            </div>

            {/* Content */}
            <div
              className="prose prose-sm max-w-none text-[var(--tulip-forest)]
                prose-headings:text-[var(--tulip-forest)] prose-headings:font-semibold
                prose-a:text-[var(--tulip-gold)] prose-a:no-underline hover:prose-a:underline
                prose-strong:text-[var(--tulip-forest)]
                prose-code:bg-[var(--tulip-cream)] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
                prose-pre:bg-[var(--tulip-cream)] prose-pre:border prose-pre:border-[var(--tulip-sage-dark)] prose-pre:rounded-lg
                prose-li:text-[var(--tulip-forest)]/80
                prose-p:text-[var(--tulip-forest)]/80"
              dangerouslySetInnerHTML={{ __html: activeArticle.content || '' }}
            />

            {/* Feedback */}
            <div className="border-t border-[var(--tulip-sage-dark)] pt-5">
              {feedbackSent ? (
                <p className="text-sm text-green-600 font-medium">{t('thanksFeedback')}</p>
              ) : (
                <div className="flex items-center gap-4">
                  <span className="text-sm text-[var(--tulip-forest)]/60">{t('wasHelpful')}</span>
                  <button
                    onClick={() => sendFeedback(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-green-600 bg-green-400/10 border border-green-400/20 hover:bg-green-400/20 transition-colors"
                  >
                    <ThumbsUp size={13} /> {t('yes')}
                  </button>
                  <button
                    onClick={() => sendFeedback(false)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 bg-red-400/10 border border-red-400/20 hover:bg-red-400/20 transition-colors"
                  >
                    <ThumbsDown size={13} /> {t('no')}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  /* ── Article list (category selected) ────────────────────── */

  if (activeCategory) {
    return (
      <div className="p-4 md:p-6 space-y-4 animate-fade-up">
        {breadcrumb}

        <button
          onClick={goBack}
          className="flex items-center gap-1.5 text-sm text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)] transition-colors mb-2"
        >
          <ArrowLeft size={14} /> {t('backToCategories')}
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-[var(--tulip-gold)]/10 flex items-center justify-center">
            {getCategoryIcon(activeCategory.slug)}
          </div>
          <div>
            <h2 className="text-lg font-bold text-[var(--tulip-forest)]" style={{ fontFamily: 'Inter, sans-serif' }}>
              {activeCategory.name}
            </h2>
            <p className="text-xs text-[var(--tulip-forest)]/50">{activeCategory.description}</p>
          </div>
        </div>

        {articlesLoading ? (
          <div className="p-12 text-center text-[var(--tulip-forest)]/40 text-sm">{t('loading')}</div>
        ) : articles.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <FileText size={28} className="text-[var(--tulip-forest)]/30" />
            <p className="text-[var(--tulip-forest)]/40 text-sm">{t('noArticles')}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--tulip-sage-dark)] overflow-hidden divide-y divide-[var(--tulip-sage-dark)]" style={{ background: 'var(--tulip-sage)' }}>
            {articles.map(article => (
              <button
                key={article.id}
                onClick={() => loadArticle(article.slug)}
                className="w-full text-left px-5 py-4 hover:bg-[var(--tulip-sage)]/50 transition-colors flex items-center gap-4 group"
              >
                <div className="w-8 h-8 rounded-lg bg-[var(--tulip-gold)]/10 flex items-center justify-center shrink-0">
                  <FileText size={14} className="text-[var(--tulip-forest)]/60" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-[var(--tulip-forest)] group-hover:text-[var(--tulip-forest)]">
                    {article.title}
                  </h4>
                  {article.summary && (
                    <p className="text-xs text-[var(--tulip-forest)]/50 mt-0.5 line-clamp-1">{article.summary}</p>
                  )}
                </div>
                <ChevronRight size={14} className="text-[var(--tulip-forest)]/30 group-hover:text-[var(--tulip-forest)]/60 shrink-0 transition-colors" />
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  /* ── Category grid (default view) ────────────────────────── */

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-up">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--tulip-forest)]" style={{ fontFamily: 'Inter, sans-serif' }}>
          {t('title')}
        </h1>
        <p className="text-[var(--tulip-forest)]/60 text-sm mt-1">{t('subtitle')}</p>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-4 py-2.5 max-w-lg">
        <Search size={15} className="text-[var(--tulip-forest)]/40" />
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="bg-transparent text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none w-full"
        />
      </div>

      {/* Search results */}
      {searchQuery.trim() && (
        <div>
          <h3 className="text-sm font-medium text-[var(--tulip-forest)]/60 mb-3">
            {isSearching ? t('searching') : `${searchResults.length} ${t('resultsFor')} "${searchQuery}"`}
          </h3>
          {!isSearching && searchResults.length > 0 && (
            <div className="rounded-xl border border-[var(--tulip-sage-dark)] overflow-hidden divide-y divide-[var(--tulip-sage-dark)]" style={{ background: 'var(--tulip-sage)' }}>
              {searchResults.map(article => (
                <button
                  key={article.id}
                  onClick={() => loadArticle(article.slug)}
                  className="w-full text-left px-5 py-4 hover:bg-[var(--tulip-sage)]/50 transition-colors flex items-center gap-4 group"
                >
                  <FileText size={16} className="text-[var(--tulip-forest)]/40 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-[var(--tulip-forest)]">{article.title}</h4>
                    {article.summary && (
                      <p className="text-xs text-[var(--tulip-forest)]/50 mt-0.5 line-clamp-1">{article.summary}</p>
                    )}
                    {article.categorySlug && (
                      <span className="text-[10px] text-[var(--tulip-forest)]/40 mt-1 inline-block">{article.categorySlug}</span>
                    )}
                  </div>
                  <ChevronRight size={14} className="text-[var(--tulip-forest)]/30 shrink-0" />
                </button>
              ))}
            </div>
          )}
          {!isSearching && searchResults.length === 0 && (
            <p className="text-sm text-[var(--tulip-forest)]/40">{t('noResults')}</p>
          )}
        </div>
      )}

      {/* Categories grid */}
      {!searchQuery.trim() && (
        <>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="rounded-xl border border-[var(--tulip-sage-dark)] p-5 space-y-3 animate-pulse" style={{ background: 'var(--tulip-sage)' }}>
                  <div className="h-10 w-10 bg-[var(--tulip-sage-dark)] rounded-lg" />
                  <div className="h-4 bg-[var(--tulip-sage-dark)] rounded w-3/4" />
                  <div className="h-3 bg-[var(--tulip-sage-dark)] rounded w-full" />
                </div>
              ))}
            </div>
          ) : categories.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3">
              <BookOpen size={32} className="text-[var(--tulip-forest)]/30" />
              <p className="text-[var(--tulip-forest)]/40 text-sm">{t('noCategories')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map(category => (
                <button
                  key={category.id}
                  onClick={() => loadCategoryArticles(category)}
                  className="group text-left rounded-xl border border-[var(--tulip-sage-dark)] hover:border-[var(--tulip-gold)]/30 p-5 space-y-3 transition-all hover:bg-[var(--tulip-sage)]/50"
                  style={{ background: 'var(--tulip-sage)' }}
                >
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-lg bg-[var(--tulip-gold)]/10 flex items-center justify-center">
                      {getCategoryIcon(category.slug)}
                    </div>
                    <ChevronRight size={14} className="text-[var(--tulip-forest)]/20 group-hover:text-[var(--tulip-forest)]/50 transition-colors mt-1" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--tulip-forest)] text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
                      {category.name}
                    </h3>
                    <p className="text-[var(--tulip-forest)]/50 text-xs mt-1 line-clamp-2">{category.description}</p>
                  </div>
                  <div className="text-[11px] text-[var(--tulip-forest)]/40">
                    {category.articleCount} {category.articleCount === 1 ? t('article') : t('articles')}
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
