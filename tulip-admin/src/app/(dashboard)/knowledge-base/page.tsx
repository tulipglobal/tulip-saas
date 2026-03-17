'use client'

import { useState, useEffect } from 'react'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'
import { Plus, X, Search, Edit2, Trash2, BookOpen, FileText, Eye, EyeOff } from 'lucide-react'

interface Article {
  id: string
  title: string
  slug: string
  content: string
  category: string
  targetRole: string
  isPublished: boolean
  isFeatured: boolean
  order: number
  createdAt: string
  updatedAt: string
}

interface Category {
  id: string
  name: string
  slug: string
  description: string
  icon: string
  targetRole: string
  order: number
}

export default function KBAdminPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'articles' | 'categories'>('articles')
  const [editArticle, setEditArticle] = useState<Article | null>(null)
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formSlug, setFormSlug] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [formTargetRole, setFormTargetRole] = useState('ngo')
  const [formPublished, setFormPublished] = useState(false)
  const [formOrder, setFormOrder] = useState(0)
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    try {
      const [aRes, cRes] = await Promise.all([
        apiGet('/api/admin/kb/articles'),
        apiGet('/api/admin/kb/categories'),
      ])
      if (aRes.ok) setArticles(await aRes.json())
      if (cRes.ok) setCategories(await cRes.json())
    } catch {}
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const openNew = () => {
    setEditArticle(null)
    setFormTitle('')
    setFormSlug('')
    setFormContent('')
    setFormCategory(categories[0]?.slug || '')
    setFormTargetRole('ngo')
    setFormPublished(false)
    setFormOrder(0)
    setShowForm(true)
  }

  const openEdit = (a: Article) => {
    setEditArticle(a)
    setFormTitle(a.title)
    setFormSlug(a.slug)
    setFormContent(a.content)
    setFormCategory(a.category)
    setFormTargetRole(a.targetRole)
    setFormPublished(a.isPublished)
    setFormOrder(a.order)
    setShowForm(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const body = { title: formTitle, slug: formSlug, content: formContent, category: formCategory, targetRole: formTargetRole, isPublished: formPublished, order: formOrder }
      if (editArticle) {
        await apiPatch(`/api/admin/kb/articles/${editArticle.id}`, body)
      } else {
        await apiPost('/api/admin/kb/articles', body)
      }
      setShowForm(false)
      loadData()
    } catch {}
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this article?')) return
    await apiDelete(`/api/admin/kb/articles/${id}`)
    loadData()
  }

  const togglePublish = async (a: Article) => {
    await apiPatch(`/api/admin/kb/articles/${a.id}`, { isPublished: !a.isPublished })
    loadData()
  }

  const filtered = articles.filter(a =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.category.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--admin-text)]">Knowledge Base</h1>
          <p className="text-sm text-[var(--admin-text-secondary)] mt-1">{articles.length} articles, {categories.length} categories</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--admin-accent)] hover:bg-[var(--admin-accent-hover)] transition-colors"
        >
          <Plus size={16} /> New Article
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--admin-border)]">
        {(['articles', 'categories'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
              activeTab === tab
                ? 'border-[var(--admin-accent)] text-[var(--admin-accent)]'
                : 'border-transparent text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'articles' && (
        <>
          <div className="relative max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search articles..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-card)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50"
            />
          </div>

          <div className="bg-[var(--admin-card)] rounded-xl border border-[var(--admin-border)] overflow-hidden">
            <div className="hidden lg:grid grid-cols-[2fr_1fr_80px_80px_100px] gap-4 px-5 py-3 border-b border-[var(--admin-border)] text-xs text-[var(--admin-text-muted)] uppercase tracking-wide font-medium bg-[var(--admin-bg)]">
              <span>Title</span><span>Category</span><span>Role</span><span>Status</span><span>Actions</span>
            </div>
            {loading ? (
              <div className="p-8 text-center text-[var(--admin-text-muted)] text-sm">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center py-16 gap-3">
                <BookOpen size={24} className="text-[var(--admin-text-muted)]" />
                <p className="text-[var(--admin-text-muted)] text-sm">No articles found</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--admin-border)]">
                {filtered.map(a => (
                  <div key={a.id} className="px-5 py-3 hover:bg-[var(--admin-bg)] transition-colors lg:grid lg:grid-cols-[2fr_1fr_80px_80px_100px] lg:gap-4 lg:items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-[var(--admin-text-muted)]" />
                        <span className="text-sm font-medium text-[var(--admin-text)]">{a.title}</span>
                      </div>
                      <div className="text-xs text-[var(--admin-text-muted)] mt-0.5">{a.slug}</div>
                    </div>
                    <div className="text-xs text-[var(--admin-text-secondary)]">{a.category}</div>
                    <div className="text-xs text-[var(--admin-text-secondary)]">{a.targetRole}</div>
                    <div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border font-medium ${a.isPublished ? 'bg-green-50 text-green-600 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                        {a.isPublished ? 'Published' : 'Draft'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => togglePublish(a)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-[var(--admin-bg)] transition-colors" title={a.isPublished ? 'Unpublish' : 'Publish'}>
                        {a.isPublished ? <EyeOff size={14} className="text-[var(--admin-text-muted)]" /> : <Eye size={14} className="text-[var(--admin-text-muted)]" />}
                      </button>
                      <button onClick={() => openEdit(a)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-[var(--admin-bg)] transition-colors">
                        <Edit2 size={14} className="text-[var(--admin-text-muted)]" />
                      </button>
                      <button onClick={() => handleDelete(a.id)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-red-50 transition-colors">
                        <Trash2 size={14} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'categories' && (
        <div className="bg-[var(--admin-card)] rounded-xl border border-[var(--admin-border)] divide-y divide-[var(--admin-border)]">
          {categories.map(c => (
            <div key={c.id} className="px-5 py-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-[var(--admin-text)]">{c.name}</div>
                <div className="text-xs text-[var(--admin-text-muted)]">{c.slug} — {c.targetRole} — order: {c.order}</div>
              </div>
            </div>
          ))}
          {categories.length === 0 && (
            <div className="p-8 text-center text-[var(--admin-text-muted)] text-sm">No categories</div>
          )}
        </div>
      )}

      {/* Article Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-[var(--admin-card)] rounded-xl border border-[var(--admin-border)] p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[var(--admin-text)]">{editArticle ? 'Edit Article' : 'New Article'}</h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--admin-bg)]"><X size={16} /></button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--admin-text-secondary)] mb-1">Title</label>
                <input value={formTitle} onChange={e => setFormTitle(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm border border-[var(--admin-border)] bg-[var(--admin-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--admin-text-secondary)] mb-1">Slug</label>
                <input value={formSlug} onChange={e => setFormSlug(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm border border-[var(--admin-border)] bg-[var(--admin-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--admin-text-secondary)] mb-1">Category</label>
                <select value={formCategory} onChange={e => setFormCategory(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm border border-[var(--admin-border)] bg-[var(--admin-bg)]">
                  {categories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--admin-text-secondary)] mb-1">Target Role</label>
                <select value={formTargetRole} onChange={e => setFormTargetRole(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm border border-[var(--admin-border)] bg-[var(--admin-bg)]">
                  <option value="ngo">NGO</option>
                  <option value="donor">Donor</option>
                  <option value="all">All</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--admin-text-secondary)] mb-1">Order</label>
                <input type="number" value={formOrder} onChange={e => setFormOrder(Number(e.target.value))} className="w-full rounded-lg px-3 py-2 text-sm border border-[var(--admin-border)] bg-[var(--admin-bg)]" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--admin-text-secondary)] mb-1">Content (HTML)</label>
              <textarea value={formContent} onChange={e => setFormContent(e.target.value)} rows={12} className="w-full rounded-lg px-3 py-2 text-sm border border-[var(--admin-border)] bg-[var(--admin-bg)] font-mono resize-none focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50" />
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={formPublished} onChange={e => setFormPublished(e.target.checked)} className="rounded" />
                Published
              </label>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button onClick={handleSave} disabled={saving || !formTitle || !formSlug || !formContent} className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-[var(--admin-accent)] hover:bg-[var(--admin-accent-hover)] disabled:opacity-50 transition-colors">
                {saving ? 'Saving...' : editArticle ? 'Update' : 'Create'}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
