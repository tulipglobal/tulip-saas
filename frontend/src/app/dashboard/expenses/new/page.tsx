'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save } from 'lucide-react'
import { apiGet, apiPost } from '@/lib/api'
import { getCategoriesForType, type ExpenseType } from '@/lib/ngo-categories'

interface Project { id: string; name: string }
interface FundingAgreement { id: string; title: string; currency: string; totalAmount: number; donor: { name: string } | null }
interface BudgetLine { id: string; expenseType: string; category: string; subCategory: string | null; approvedAmount: number; currency: string; spent?: number; remaining?: number }
interface BudgetOption { id: string; name: string; status: string; lines: BudgetLine[] }

export default function NewExpensePage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [agreements, setAgreements] = useState<FundingAgreement[]>([])
  const [budgets, setBudgets] = useState<BudgetOption[]>([])
  const [selectedBudget, setSelectedBudget] = useState<BudgetOption | null>(null)
  const [form, setForm] = useState({
    title: '', amount: '', currency: 'USD', expenseType: '' as '' | ExpenseType,
    category: '', subCategory: '', vendor: '',
    expenseDate: new Date().toISOString().split('T')[0],
    projectId: '', fundingAgreementId: '', budgetId: '', budgetLineId: '', notes: ''
  })

  useEffect(() => {
    apiGet('/api/projects?limit=100')
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => setProjects(d.data ?? d.items ?? []))
      .catch(() => {})
    apiGet('/api/funding-agreements?limit=100')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(d => setAgreements(d.data ?? []))
      .catch(() => {})
    apiGet('/api/budgets?limit=100&status=ACTIVE')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(d => setBudgets(d.data ?? []))
      .catch(() => {})
  }, [])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const categories = useMemo(() => {
    if (!form.expenseType) return {}
    return getCategoriesForType(form.expenseType as ExpenseType)
  }, [form.expenseType])

  const subCategories = useMemo(() => {
    if (!form.category || !form.expenseType) return []
    return categories[form.category] ?? []
  }, [form.expenseType, form.category, categories])

  const handleTypeChange = (type: string) => {
    setForm(f => ({ ...f, expenseType: type as '' | ExpenseType, category: '', subCategory: '' }))
  }

  const handleCategoryChange = (cat: string) => {
    setForm(f => ({ ...f, category: cat, subCategory: '' }))
  }

  const handleBudgetChange = async (budgetId: string) => {
    setForm(f => ({ ...f, budgetId, budgetLineId: '' }))
    if (!budgetId) { setSelectedBudget(null); return }
    try {
      const res = await apiGet(`/api/budgets/${budgetId}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedBudget(data)
      }
    } catch {
      setSelectedBudget(budgets.find(b => b.id === budgetId) || null)
    }
  }

  const handleBudgetLineChange = (lineId: string) => {
    const line = selectedBudget?.lines.find(l => l.id === lineId)
    if (line) {
      setForm(f => ({
        ...f,
        budgetLineId: lineId,
        expenseType: line.expenseType as '' | ExpenseType,
        category: line.category,
        subCategory: line.subCategory || '',
        currency: line.currency,
      }))
    } else {
      setForm(f => ({ ...f, budgetLineId: lineId }))
    }
  }

  const submit = async () => {
    if (!form.title.trim()) { setError('Title is required'); return }
    if (!form.amount || isNaN(parseFloat(form.amount))) { setError('Valid amount is required'); return }
    setSaving(true); setError('')
    try {
      const res = await apiPost('/api/expenses', {
        title: form.title.trim(),
        amount: parseFloat(form.amount),
        currency: form.currency,
        expenseType: form.expenseType || null,
        category: form.category || null,
        subCategory: form.subCategory || null,
        vendor: form.vendor || null,
        expenseDate: form.expenseDate,
        projectId: form.projectId || null,
        fundingAgreementId: form.fundingAgreementId || null,
        budgetId: form.budgetId || null,
        budgetLineId: form.budgetLineId || null,
        notes: form.notes || null,
      })
      if (res.ok) { router.push('/dashboard/expenses') }
      else { const d = await res.json(); setError(d.message ?? 'Failed to log expense') }
    } catch { setError('Network error') }
    setSaving(false)
  }

  const inputCls = "w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#0c7aed]/50 transition-all"
  const labelCls = "block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wide"

  return (
    <div className="p-6 max-w-2xl animate-fade-up">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/expenses" className="text-white/40 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Log Expense</h1>
          <p className="text-white/40 text-sm">This expense will be SHA-256 hashed and anchored to Polygon</p>
        </div>
      </div>

      <div className="rounded-xl border border-white/8 p-6 space-y-5"
        style={{ background: 'rgba(255,255,255,0.02)' }}>

        <div>
          <label className={labelCls}>Title *</label>
          <input value={form.title} onChange={e => set('title', e.target.value)}
            placeholder="e.g. Field equipment purchase" className={inputCls} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Amount *</label>
            <input type="number" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)}
              placeholder="0.00" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Currency</label>
            <select value={form.currency} onChange={e => set('currency', e.target.value)} className={inputCls}>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="AED">AED</option>
              <option value="OMR">OMR</option>
            </select>
          </div>
        </div>

        {/* CapEx / OpEx type */}
        <div>
          <label className={labelCls}>Expense Type</label>
          <div className="flex gap-3">
            {(['CAPEX', 'OPEX'] as const).map(type => (
              <button key={type} type="button"
                onClick={() => handleTypeChange(type)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all ${
                  form.expenseType === type
                    ? type === 'CAPEX'
                      ? 'bg-purple-500/15 border-purple-500/30 text-purple-400'
                      : 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400'
                    : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20'
                }`}>
                {type === 'CAPEX' ? 'CapEx' : 'OpEx'}
              </button>
            ))}
          </div>
        </div>

        {/* Category + SubCategory */}
        {form.expenseType && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Category</label>
              <select value={form.category} onChange={e => handleCategoryChange(e.target.value)} className={inputCls}>
                <option value="">Select category</option>
                {Object.keys(categories).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Sub-Category</label>
              <select value={form.subCategory} onChange={e => set('subCategory', e.target.value)} className={inputCls}
                disabled={!form.category}>
                <option value="">Select sub-category</option>
                {subCategories.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Vendor</label>
            <input value={form.vendor} onChange={e => set('vendor', e.target.value)}
              placeholder="Vendor name" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Expense Date</label>
            <input type="date" value={form.expenseDate} onChange={e => set('expenseDate', e.target.value)} className={inputCls} />
          </div>
        </div>

        {/* Budget + Budget Line */}
        <div className="rounded-lg border border-white/8 p-4 space-y-3 bg-white/[0.01]">
          <label className={labelCls + ' mb-0'}>Budget Allocation</label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-white/30 mb-1 block">Budget</label>
              <select value={form.budgetId} onChange={e => handleBudgetChange(e.target.value)} className={inputCls}>
                <option value="">No budget</option>
                {budgets.map(b => <option key={b.id} value={b.id}>{b.name} ({b.status})</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-white/30 mb-1 block">Budget Line</label>
              <select value={form.budgetLineId} onChange={e => handleBudgetLineChange(e.target.value)}
                className={inputCls} disabled={!selectedBudget}>
                <option value="">Select budget line</option>
                {selectedBudget?.lines.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.expenseType} — {l.category}{l.subCategory ? ` / ${l.subCategory}` : ''} ({l.currency} {l.approvedAmount.toLocaleString()})
                  </option>
                ))}
              </select>
            </div>
          </div>
          {form.budgetLineId && selectedBudget && (() => {
            const line = selectedBudget.lines.find(l => l.id === form.budgetLineId)
            if (!line) return null
            return (
              <div className="text-xs text-white/40 flex gap-4">
                <span>Approved: <span className="text-white/60">{line.currency} {line.approvedAmount.toLocaleString()}</span></span>
                {line.remaining !== undefined && (
                  <span>Remaining: <span className={line.remaining > 0 ? 'text-green-400' : 'text-red-400'}>{line.currency} {line.remaining.toLocaleString()}</span></span>
                )}
              </div>
            )
          })()}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Project</label>
            <select value={form.projectId} onChange={e => set('projectId', e.target.value)} className={inputCls}>
              <option value="">No project</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Funding Source</label>
            <select value={form.fundingAgreementId} onChange={e => set('fundingAgreementId', e.target.value)} className={inputCls}>
              <option value="">No funding source</option>
              {agreements.map(a => <option key={a.id} value={a.id}>{a.title}{a.donor ? ` (${a.donor.name})` : ''}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
            placeholder="Additional notes..." rows={2} className={inputCls + ' resize-none'} />
        </div>

        {error && (
          <div className="rounded-lg bg-red-400/10 border border-red-400/20 px-4 py-3 text-sm text-red-400">{error}</div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button onClick={submit} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
            <Save size={15} /> {saving ? 'Saving...' : 'Log Expense'}
          </button>
          <Link href="/dashboard/expenses" className="px-5 py-2.5 rounded-lg text-sm text-white/50 hover:text-white transition-colors">
            Cancel
          </Link>
        </div>
      </div>
    </div>
  )
}
