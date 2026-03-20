'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { apiGet } from '../../lib/api'

interface Category {
  id: string; name: string; slug: string; description: string | null; icon: string | null; articleCount: number
}
interface Article {
  id: string; title: string; slug: string; category: string; content?: string; viewCount: number; createdAt: string
}

export default function DonorKBPage() {
  const t = useTranslations('kb')
  const [categories, setCategories] = useState<Category[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [article, setArticle] = useState<Article | null>(null)
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState<boolean | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const r = await apiGet('/api/kb/categories?role=donor')
        if (r.ok) setCategories(await r.json())
      } catch {} finally { setLoading(false) }
    })()
  }, [])

  useEffect(() => {
    if (!search || search.length < 2) { setSearchResults([]); return }
    const t = setTimeout(async () => {
      try {
        const r = await apiGet(`/api/kb/search?q=${encodeURIComponent(search)}&role=donor`)
        if (r.ok) setSearchResults(await r.json())
      } catch {}
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const loadCategory = async (slug: string) => {
    setSelectedCat(slug)
    setArticle(null)
    try {
      const r = await apiGet(`/api/kb/articles?role=donor&category=${slug}`)
      if (r.ok) setArticles(await r.json())
    } catch {}
  }

  const loadArticle = async (slug: string) => {
    try {
      const r = await apiGet(`/api/kb/articles/${slug}`)
      if (r.ok) { setArticle(await r.json()); setFeedback(null) }
    } catch {}
  }

  // Article view
  if (article) {
    const catName = categories.find(c => c.slug === article.category)?.name || article.category
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="text-xs mb-4" style={{ color: 'var(--donor-muted)' }}>
          <button onClick={() => { setArticle(null); setSelectedCat(null) }} className="hover:underline">{t('title')}</button>
          {' > '}
          <button onClick={() => { setArticle(null); loadCategory(article.category) }} className="hover:underline">{catName}</button>
          {' > '}<span style={{ color: 'var(--donor-dark)' }}>{article.title}</span>
        </div>
        <div className="rounded-xl border p-6" style={{ borderColor: 'var(--donor-border)', background: 'var(--bg-card)' }}>
          <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--donor-dark)' }}>{article.title}</h1>
          <p className="text-xs mb-6" style={{ color: 'var(--donor-muted)' }}>{article.viewCount} {t('views')}</p>
          <div className="prose prose-sm max-w-none" style={{ color: 'var(--donor-dark)' }}
            dangerouslySetInnerHTML={{ __html: article.content || '' }} />
          <div className="mt-8 pt-6 border-t text-center" style={{ borderColor: 'var(--donor-border)' }}>
            <p className="text-sm font-medium mb-2" style={{ color: 'var(--donor-dark)' }}>{t('wasHelpful')}</p>
            {feedback === null ? (
              <div className="flex justify-center gap-3">
                <button onClick={() => setFeedback(true)} className="px-4 py-1.5 rounded-lg text-sm border hover:opacity-80" style={{ borderColor: 'var(--donor-border)', color: 'var(--donor-dark)' }}>👍 {t('yes')}</button>
                <button onClick={() => setFeedback(false)} className="px-4 py-1.5 rounded-lg text-sm border hover:opacity-80" style={{ borderColor: 'var(--donor-border)', color: 'var(--donor-dark)' }}>👎 {t('no')}</button>
              </div>
            ) : (
              <p className="text-sm" style={{ color: 'var(--donor-muted)' }}>{t('thanksFeedback')}</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Article list for selected category
  if (selectedCat) {
    const catName = categories.find(c => c.slug === selectedCat)?.name || selectedCat
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <button onClick={() => setSelectedCat(null)} className="text-sm mb-4 hover:underline" style={{ color: 'var(--donor-accent)' }}>
          ← {t('backToCategories')}
        </button>
        <h1 className="text-xl font-bold mb-4" style={{ color: 'var(--donor-dark)' }}>{catName}</h1>
        <div className="space-y-2">
          {articles.map(a => (
            <button key={a.id} onClick={() => loadArticle(a.slug)}
              className="w-full text-left rounded-xl border p-4 hover:opacity-80 transition-all"
              style={{ borderColor: 'var(--donor-border)', background: 'var(--bg-card)' }}>
              <h3 className="text-sm font-medium" style={{ color: 'var(--donor-dark)' }}>{a.title}</h3>
              <span className="text-xs" style={{ color: 'var(--donor-muted)' }}>{a.viewCount} {t('views')}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Categories grid + search
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold mb-4" style={{ color: 'var(--donor-dark)' }}>{t('title')}</h1>

      <div className="mb-6">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('searchPlaceholder')}
          className="w-full rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'var(--donor-border)', color: 'var(--donor-dark)', background: 'var(--bg-card)' }} />
      </div>

      {search.length >= 2 && searchResults.length > 0 ? (
        <div className="space-y-2">
          {searchResults.map(a => (
            <button key={a.id} onClick={() => loadArticle(a.slug)}
              className="w-full text-left rounded-xl border p-4 hover:opacity-80"
              style={{ borderColor: 'var(--donor-border)', background: 'var(--bg-card)' }}>
              <h3 className="text-sm font-medium" style={{ color: 'var(--donor-dark)' }}>{a.title}</h3>
            </button>
          ))}
        </div>
      ) : loading ? (
        <div className="text-center py-12 text-sm" style={{ color: 'var(--donor-muted)' }}>Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {categories.map(cat => (
            <button key={cat.id} onClick={() => loadCategory(cat.slug)}
              className="text-left rounded-xl border p-5 hover:opacity-80 transition-all"
              style={{ borderColor: 'var(--donor-border)', background: 'var(--bg-card)' }}>
              <div className="text-2xl mb-2">{cat.icon || '📖'}</div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--donor-dark)' }}>{cat.name}</h3>
              {cat.description && <p className="text-xs mt-1" style={{ color: 'var(--donor-muted)' }}>{cat.description}</p>}
              <p className="text-[10px] mt-2" style={{ color: 'var(--donor-accent)' }}>{cat.articleCount} articles</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
