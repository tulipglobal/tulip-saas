'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiFetch, apiGet } from '@/lib/api'
import { Briefcase, Plus, Search, Copy, ExternalLink, CheckCircle, Archive, X } from 'lucide-react'

interface Case {
  id: string
  name: string
  clientName?: string
  type: string
  status: 'open' | 'in_progress' | 'completed' | 'archived'
  documentCount: number
  bundleCount: number
  riskScore?: number
  publicSlug?: string
  createdAt: string
}

export default function CasesPage() {
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [formName, setFormName] = useState('')
  const [formClient, setFormClient] = useState('')
  const [formType, setFormType] = useState('due-diligence')
  const [creating, setCreating] = useState(false)

  const loadCases = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await apiGet(`/api/cases?${params}`)
      if (res.ok) {
        const d = await res.json()
        setCases(d.cases || d.data || d || [])
      }
    } catch {}
    setLoading(false)
  }, [search, statusFilter])

  useEffect(() => { loadCases() }, [loadCases])

  const createCase = async () => {
    if (!formName.trim()) return
    setCreating(true)
    const res = await apiFetch('/api/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: formName, clientName: formClient, type: formType }),
    })
    if (res.ok) {
      setShowCreate(false)
      setFormName('')
      setFormClient('')
      loadCases()
    }
    setCreating(false)
  }

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      open: 'bg-blue-50 text-blue-600 border-blue-200',
      in_progress: 'bg-amber-50 text-amber-600 border-amber-200',
      completed: 'bg-green-50 text-green-600 border-green-200',
      archived: 'bg-gray-50 text-gray-500 border-gray-200',
    }
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border font-medium capitalize ${styles[status] || styles.open}`}>{status.replace('_', ' ')}</span>
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--admin-text)]">Cases</h1>
          <p className="text-sm text-[var(--admin-text-secondary)] mt-1">{cases.length} cases</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--admin-accent)] hover:bg-[var(--admin-accent-hover)] transition-colors">
          <Plus size={16} /> New Case
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative max-w-sm w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search cases..." className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-card)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50" />
        </div>
        <div className="flex items-center gap-1.5">
          {['all', 'open', 'in_progress', 'completed', 'archived'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s ? 'bg-[var(--admin-accent)]/10 text-[var(--admin-accent)] border border-[var(--admin-accent)]/30' : 'text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] hover:bg-[var(--admin-bg)]'}`}>
              {s === 'all' ? 'All' : s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[var(--admin-card)] rounded-xl border border-[var(--admin-border)] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-[var(--admin-text-muted)]">Loading...</div>
        ) : cases.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <Briefcase size={24} className="text-[var(--admin-text-muted)]" />
            <p className="text-sm text-[var(--admin-text-muted)]">No cases found</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--admin-border)]">
            {cases.map(c => (
              <div key={c.id} className="px-5 py-4 hover:bg-[var(--admin-bg)] transition-colors flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Briefcase size={14} className="text-[var(--admin-text-muted)]" />
                    <span className="text-sm font-medium text-[var(--admin-text)]">{c.name}</span>
                    {statusBadge(c.status)}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-[var(--admin-text-muted)]">
                    {c.clientName && <span>Client: {c.clientName}</span>}
                    <span>Type: {c.type}</span>
                    <span>{c.documentCount} docs</span>
                    <span>{c.bundleCount} bundles</span>
                    {c.riskScore !== undefined && <span>Risk: {c.riskScore}</span>}
                  </div>
                </div>
                <div className="text-xs text-[var(--admin-text-muted)]">{new Date(c.createdAt).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-[var(--admin-card)] rounded-xl border border-[var(--admin-border)] p-6 max-w-md w-full shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[var(--admin-text)]">New Case</h3>
              <button onClick={() => setShowCreate(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--admin-bg)]"><X size={16} /></button>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--admin-text-secondary)] mb-1">Case Name</label>
              <input value={formName} onChange={e => setFormName(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm border border-[var(--admin-border)] bg-[var(--admin-bg)]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--admin-text-secondary)] mb-1">Client Name</label>
              <input value={formClient} onChange={e => setFormClient(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm border border-[var(--admin-border)] bg-[var(--admin-bg)]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--admin-text-secondary)] mb-1">Type</label>
              <select value={formType} onChange={e => setFormType(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm border border-[var(--admin-border)] bg-[var(--admin-bg)]">
                <option value="due-diligence">Due Diligence</option>
                <option value="audit">Audit</option>
                <option value="investigation">Investigation</option>
                <option value="compliance">Compliance</option>
              </select>
            </div>
            <button onClick={createCase} disabled={creating || !formName.trim()} className="w-full py-2.5 rounded-lg text-sm font-medium text-white bg-[var(--admin-accent)] hover:bg-[var(--admin-accent-hover)] disabled:opacity-50 transition-colors">
              {creating ? 'Creating...' : 'Create Case'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
