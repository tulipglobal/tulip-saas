'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiGet, apiPost } from '@/lib/api'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { getCategoriesForType } from '@/lib/ngo-categories'
import type { ExpenseType } from '@/lib/ngo-categories'

interface BudgetLineForm {
  key: string
  expenseType: ExpenseType
  category: string
  subCategory: string
  description: string
  approvedAmount: string
  currency: string
}

interface ProjectOption {
  id: string
  name: string
  startDate: string | null
  endDate: string | null
}

function emptyLine(): BudgetLineForm {
  return {
    key: crypto.randomUUID(),
    expenseType: 'OPEX',
    category: '',
    subCategory: '',
    description: '',
    approvedAmount: '',
    currency: 'USD',
  }
}

const CURRENCIES = ['USD', 'EUR', 'GBP', 'KES', 'UGX', 'TZS', 'INR', 'NGN', 'ZAR', 'GHS', 'ETB', 'RWF']
const inputCls = "w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#0c7aed]/50 transition-all [color-scheme:dark]"

export default function NewBudgetPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-12"><div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <NewBudgetInner />
    </Suspense>
  )
}

function NewBudgetInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedProjectId = searchParams.get('projectId') || ''

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [loadingProjects, setLoadingProjects] = useState(true)

  const [projectId, setProjectId] = useState(preselectedProjectId)
  const [name, setName] = useState('')
  const [periodFrom, setPeriodFrom] = useState('')
  const [periodTo, setPeriodTo] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<BudgetLineForm[]>([emptyLine()])

  // Fetch projects for dropdown
  useEffect(() => {
    apiGet('/api/projects?limit=100')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(d => {
        const items: ProjectOption[] = (d.data ?? d.items ?? []).map((p: any) => ({
          id: p.id,
          name: p.name,
          startDate: p.startDate ? p.startDate.split('T')[0] : null,
          endDate: p.endDate ? p.endDate.split('T')[0] : null,
        }))
        setProjects(items)
        setLoadingProjects(false)

        // Auto-fill period if preselected project
        if (preselectedProjectId) {
          const proj = items.find(p => p.id === preselectedProjectId)
          if (proj) {
            if (proj.startDate) setPeriodFrom(proj.startDate)
            if (proj.endDate) setPeriodTo(proj.endDate)
          }
        }
      })
      .catch(() => setLoadingProjects(false))
  }, [preselectedProjectId])

  // Auto-fill period when project changes
  const handleProjectChange = (pid: string) => {
    setProjectId(pid)
    const proj = projects.find(p => p.id === pid)
    if (proj) {
      if (proj.startDate) setPeriodFrom(proj.startDate)
      else setPeriodFrom('')
      if (proj.endDate) setPeriodTo(proj.endDate)
      else setPeriodTo('')
    } else {
      setPeriodFrom('')
      setPeriodTo('')
    }
  }

  const updateLine = (key: string, field: keyof BudgetLineForm, value: string) => {
    setLines(prev => prev.map(l => {
      if (l.key !== key) return l
      const updated = { ...l, [field]: value }
      if (field === 'expenseType') { updated.category = ''; updated.subCategory = '' }
      if (field === 'category') { updated.subCategory = '' }
      return updated
    }))
  }

  const removeLine = (key: string) => {
    if (lines.length <= 1) return
    setLines(prev => prev.filter(l => l.key !== key))
  }

  const totalCapex = lines.filter(l => l.expenseType === 'CAPEX').reduce((s, l) => s + (Number(l.approvedAmount) || 0), 0)
  const totalOpex = lines.filter(l => l.expenseType === 'OPEX').reduce((s, l) => s + (Number(l.approvedAmount) || 0), 0)
  const grandTotal = totalCapex + totalOpex

  const handleSubmit = async () => {
    setError('')
    if (!projectId) return setError('Please select a project')
    if (!name.trim()) return setError('Budget name is required')
    if (!periodFrom || !periodTo) return setError('Budget period is required')
    if (new Date(periodFrom) >= new Date(periodTo)) return setError('Period end must be after start')

    const validLines = lines.filter(l => l.category && Number(l.approvedAmount) > 0)
    if (validLines.length === 0) return setError('At least one budget line with category and amount is required')

    setSaving(true)
    try {
      const res = await apiPost('/api/budgets', {
        projectId,
        name: name.trim(),
        periodFrom,
        periodTo,
        notes: notes.trim() || null,
        lines: validLines.map(l => ({
          expenseType: l.expenseType,
          category: l.category,
          subCategory: l.subCategory || null,
          description: l.description.trim() || null,
          approvedAmount: Number(l.approvedAmount),
          currency: l.currency,
        }))
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Failed to create budget')
      }
      const budget = await res.json()
      router.push(`/dashboard/budgets/${budget.id}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const selectedProject = projects.find(p => p.id === projectId)

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6 animate-fade-up">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/budgets" className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all">
          <ArrowLeft size={16} className="text-white/60" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>New Budget</h1>
          <p className="text-white/40 text-sm mt-0.5">Plan your CapEx &amp; OpEx line items</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {/* Budget details */}
      <div className="rounded-xl border border-white/8 p-5 space-y-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wide">Budget Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Project selector — first field */}
          <div className="md:col-span-2">
            <label className="text-xs text-white/40 mb-1 block">Project *</label>
            {loadingProjects ? (
              <div className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white/30">Loading projects...</div>
            ) : (
              <select value={projectId} onChange={e => handleProjectChange(e.target.value)}
                className={inputCls + ' [&>option]:bg-[#0a1628]'}>
                <option value="">Select a project...</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>

          {/* Budget Name */}
          <div className="md:col-span-2">
            <label className="text-xs text-white/40 mb-1 block">Budget Name *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. FY 2026-27 Annual Budget"
              className={inputCls} />
          </div>

          {/* Period From/To — auto-filled from project, editable */}
          <div>
            <label className="text-xs text-white/40 mb-1 block">Period From *</label>
            <input type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)}
              className={inputCls} />
            {selectedProject?.startDate && (
              <p className="text-[10px] text-white/20 mt-0.5">From project start date</p>
            )}
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1 block">Period To *</label>
            <input type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)}
              className={inputCls} />
            {selectedProject?.endDate && (
              <p className="text-[10px] text-white/20 mt-0.5">From project end date</p>
            )}
          </div>

          {/* Notes */}
          <div className="md:col-span-2">
            <label className="text-xs text-white/40 mb-1 block">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Optional notes about this budget..."
              className={inputCls + ' resize-none'} />
          </div>
        </div>
      </div>

      {/* Budget lines */}
      <div className="rounded-xl border border-white/8 p-5 space-y-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wide">Budget Lines</h2>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-purple-400">CapEx: ${totalCapex.toLocaleString()}</span>
            <span className="text-cyan-400">OpEx: ${totalOpex.toLocaleString()}</span>
            <span className="text-white font-medium">Total: ${grandTotal.toLocaleString()}</span>
          </div>
        </div>

        <div className="space-y-3">
          {lines.map((line, i) => {
            const categories = getCategoriesForType(line.expenseType)
            const categoryKeys = Object.keys(categories)
            const subCategories = line.category ? categories[line.category] || [] : []

            return (
              <div key={line.key} className="rounded-lg border border-white/8 p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.01)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/30 font-medium">Line {i + 1}</span>
                  <button onClick={() => removeLine(line.key)} disabled={lines.length <= 1}
                    className="text-white/20 hover:text-red-400 disabled:opacity-30 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-white/40 mb-1 block">Type *</label>
                    <div className="flex rounded-lg overflow-hidden border border-white/10">
                      {(['CAPEX', 'OPEX'] as ExpenseType[]).map(t => (
                        <button key={t} type="button"
                          onClick={() => updateLine(line.key, 'expenseType', t)}
                          className={`flex-1 py-2 text-xs font-medium transition-all ${
                            line.expenseType === t
                              ? t === 'CAPEX' ? 'bg-purple-500/20 text-purple-400' : 'bg-cyan-500/20 text-cyan-400'
                              : 'bg-white/5 text-white/30 hover:text-white/50'
                          }`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-white/40 mb-1 block">Category *</label>
                    <select value={line.category} onChange={e => updateLine(line.key, 'category', e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#0c7aed]/50 transition-all [&>option]:bg-[#0a1628]">
                      <option value="">Select...</option>
                      {categoryKeys.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-white/40 mb-1 block">Sub-category</label>
                    <select value={line.subCategory} onChange={e => updateLine(line.key, 'subCategory', e.target.value)}
                      disabled={subCategories.length === 0}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#0c7aed]/50 transition-all disabled:opacity-40 [&>option]:bg-[#0a1628]">
                      <option value="">Select...</option>
                      {subCategories.map((s: string) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-white/40 mb-1 block">Amount *</label>
                    <div className="flex gap-1.5">
                      <select value={line.currency} onChange={e => updateLine(line.key, 'currency', e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-xs text-white/60 outline-none [&>option]:bg-[#0a1628] w-20 shrink-0">
                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input type="number" min="0" step="0.01" value={line.approvedAmount}
                        onChange={e => updateLine(line.key, 'approvedAmount', e.target.value)}
                        placeholder="0.00"
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-[#0c7aed]/50 transition-all" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-white/40 mb-1 block">Description</label>
                  <input value={line.description} onChange={e => updateLine(line.key, 'description', e.target.value)}
                    placeholder="Optional line item description..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-[#0c7aed]/50 transition-all" />
                </div>
              </div>
            )
          })}
        </div>

        <button onClick={() => setLines(prev => [...prev, emptyLine()])}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white/50 hover:text-white border border-dashed border-white/10 hover:border-white/20 transition-all w-full justify-center">
          <Plus size={14} /> Add Line Item
        </button>
      </div>

      {/* Submit */}
      <div className="flex items-center justify-between">
        <Link href="/dashboard/budgets" className="text-sm text-white/40 hover:text-white/60 transition-colors">Cancel</Link>
        <button onClick={handleSubmit} disabled={saving}
          className="px-6 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-all"
          style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
          {saving ? 'Creating...' : 'Create Budget'}
        </button>
      </div>
    </div>
  )
}
