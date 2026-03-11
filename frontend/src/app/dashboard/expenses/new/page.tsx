'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Upload, CheckCircle, FileText } from 'lucide-react'
import { apiGet, apiPost } from '@/lib/api'
import { getCategoriesForType, type ExpenseType } from '@/lib/ngo-categories'

interface Project { id: string; name: string }
interface BudgetLine { id: string; expenseType: string; category: string; subCategory: string | null; approvedAmount: number; currency: string; spent?: number; remaining?: number }
interface BudgetOption { id: string; name: string; status: string; totalApproved: number; totalSpent: number; remaining: number; lines: BudgetLine[]; project?: { id: string; name: string } | null }

const CURRENCIES = ['USD', 'EUR', 'GBP', 'KES', 'UGX', 'TZS', 'INR', 'NGN', 'ZAR', 'GHS', 'ETB', 'RWF', 'AED', 'OMR']

export default function NewExpensePage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [projects, setProjects] = useState<Project[]>([])
  const [budgets, setBudgets] = useState<BudgetOption[]>([])
  const [selectedBudget, setSelectedBudget] = useState<BudgetOption | null>(null)
  const [loadingBudgets, setLoadingBudgets] = useState(false)

  // Receipt upload state
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [receiptData, setReceiptData] = useState<{ fileKey: string; hash: string; sealId: string } | null>(null)

  const [form, setForm] = useState({
    title: '', amount: '', currency: 'USD', expenseType: '' as '' | ExpenseType,
    category: '', subCategory: '', vendor: '',
    expenseDate: new Date().toISOString().split('T')[0],
    projectId: '', budgetId: '', budgetLineId: '', notes: ''
  })

  // Fetch projects
  useEffect(() => {
    apiGet('/api/projects?limit=100')
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => setProjects(d.data ?? d.items ?? []))
      .catch(() => {})
  }, [])

  // Fetch budgets when project changes
  const handleProjectChange = async (projectId: string) => {
    setForm(f => ({ ...f, projectId, budgetId: '', budgetLineId: '', expenseType: '', category: '', subCategory: '' }))
    setSelectedBudget(null)
    setBudgets([])
    if (!projectId) return

    setLoadingBudgets(true)
    try {
      const res = await apiGet(`/api/budgets?projectId=${projectId}&limit=50`)
      if (res.ok) {
        const d = await res.json()
        setBudgets((d.data ?? []).filter((b: BudgetOption) => ['ACTIVE', 'APPROVED', 'DRAFT'].includes(b.status)))
      }
    } catch {}
    setLoadingBudgets(false)
  }

  // Fetch full budget detail when budget changes
  const handleBudgetChange = async (budgetId: string) => {
    setForm(f => ({ ...f, budgetId, budgetLineId: '', expenseType: '', category: '', subCategory: '' }))
    setSelectedBudget(null)
    if (!budgetId) return
    try {
      const res = await apiGet(`/api/budgets/${budgetId}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedBudget(data)
      }
    } catch {}
  }

  // Auto-fill from budget line
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

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const categories = useMemo(() => {
    if (!form.expenseType) return {}
    return getCategoriesForType(form.expenseType as ExpenseType)
  }, [form.expenseType])
  const subCategories = useMemo(() => form.category ? (categories[form.category] ?? []) : [], [form.category, categories])

  // Selected line remaining
  const selectedLine = selectedBudget?.lines.find(l => l.id === form.budgetLineId)
  const lineRemaining = selectedLine?.remaining ?? null

  // Upload receipt
  const handleReceiptUpload = async () => {
    if (!receiptFile) return
    setUploading(true)
    try {
      const token = localStorage.getItem('tulip_token')
      const fd = new FormData()
      fd.append('file', receiptFile)
      fd.append('title', form.title || form.vendor || receiptFile.name)
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050'}/api/expenses/upload-receipt`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: fd,
      })
      if (res.ok) {
        const data = await res.json()
        setReceiptData({ fileKey: data.fileKey, hash: data.hash, sealId: data.sealId })
      } else {
        const d = await res.json().catch(() => ({}))
        setError(d.error || 'Failed to upload receipt')
      }
    } catch {
      setError('Failed to upload receipt')
    }
    setUploading(false)
  }

  const submit = async () => {
    if (!form.projectId) { setError('Project is required'); return }
    if (!form.title.trim()) { setError('Title is required'); return }
    if (!form.amount || isNaN(parseFloat(form.amount))) { setError('Valid amount is required'); return }
    if (lineRemaining !== null && parseFloat(form.amount) > lineRemaining) {
      setError(`Amount exceeds remaining balance of ${selectedLine?.currency} ${lineRemaining.toLocaleString()}`)
      return
    }
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
        projectId: form.projectId,
        budgetId: form.budgetId || null,
        budgetLineId: form.budgetLineId || null,
        notes: form.notes || null,
        ...(receiptData && {
          receiptFileKey: receiptData.fileKey,
          receiptHash: receiptData.hash,
          receiptSealId: receiptData.sealId,
        }),
      })
      if (res.ok) { router.push('/dashboard/expenses') }
      else {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? d.message ?? 'Failed to log expense')
      }
    } catch { setError('Network error') }
    setSaving(false)
  }

  const inputCls = "w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#0c7aed]/50 transition-all [&>option]:bg-[#0a1628] [color-scheme:dark]"
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

      <div className="rounded-xl border border-white/8 p-6 space-y-5" style={{ background: 'rgba(255,255,255,0.02)' }}>

        {/* 1. Project */}
        <div>
          <label className={labelCls}>Project *</label>
          <select value={form.projectId} onChange={e => handleProjectChange(e.target.value)} className={inputCls}>
            <option value="">Select project...</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {/* 2. Budget */}
        {form.projectId && (
          <div>
            <label className={labelCls}>Budget *</label>
            {loadingBudgets ? (
              <div className={inputCls + ' text-white/30'}>Loading budgets...</div>
            ) : budgets.length === 0 ? (
              <div className="text-xs text-white/30 py-2">No budgets found for this project.{' '}
                <Link href={`/dashboard/budgets/new?projectId=${form.projectId}`} className="text-cyan-400 hover:text-cyan-300">Create one</Link>
              </div>
            ) : (
              <select value={form.budgetId} onChange={e => handleBudgetChange(e.target.value)} className={inputCls}>
                <option value="">Select budget...</option>
                {budgets.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.status}) — Remaining: ${(b.totalApproved - (b.totalSpent || 0)).toLocaleString()}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* 3. Budget Line */}
        {selectedBudget && (
          <div>
            <label className={labelCls}>Budget Line *</label>
            <select value={form.budgetLineId} onChange={e => handleBudgetLineChange(e.target.value)} className={inputCls}>
              <option value="">Select budget line...</option>
              {selectedBudget.lines.map(l => (
                <option key={l.id} value={l.id}>
                  {l.expenseType} — {l.category}{l.subCategory ? ` / ${l.subCategory}` : ''} (Remaining: {l.currency} {(l.remaining ?? l.approvedAmount).toLocaleString()})
                </option>
              ))}
            </select>
            {selectedLine && (
              <div className="text-xs text-white/40 mt-1 flex gap-4">
                <span>Approved: <span className="text-white/60">{selectedLine.currency} {selectedLine.approvedAmount.toLocaleString()}</span></span>
                {selectedLine.remaining !== undefined && (
                  <span>Remaining: <span className={selectedLine.remaining > 0 ? 'text-green-400' : 'text-red-400'}>{selectedLine.currency} {selectedLine.remaining.toLocaleString()}</span></span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Title + Amount */}
        <div>
          <label className={labelCls}>Description / Title *</label>
          <input value={form.title} onChange={e => set('title', e.target.value)}
            placeholder="e.g. Field equipment purchase" className={inputCls} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Amount *</label>
            <input type="number" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)}
              placeholder="0.00" className={inputCls} />
            {lineRemaining !== null && form.amount && parseFloat(form.amount) > lineRemaining && (
              <p className="text-xs text-red-400 mt-1">Exceeds remaining balance of {selectedLine?.currency} {lineRemaining.toLocaleString()}</p>
            )}
          </div>
          <div>
            <label className={labelCls}>Currency</label>
            <select value={form.currency} onChange={e => set('currency', e.target.value)} className={inputCls}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* CapEx/OpEx (auto-filled from line, still editable) */}
        <div>
          <label className={labelCls}>Expense Type</label>
          <div className="flex gap-3">
            {(['CAPEX', 'OPEX'] as const).map(type => (
              <button key={type} type="button"
                onClick={() => setForm(f => ({ ...f, expenseType: type, category: '', subCategory: '' }))}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all ${
                  form.expenseType === type
                    ? type === 'CAPEX' ? 'bg-purple-500/15 border-purple-500/30 text-purple-400' : 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400'
                    : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20'
                }`}>
                {type === 'CAPEX' ? 'CapEx' : 'OpEx'}
              </button>
            ))}
          </div>
        </div>

        {form.expenseType && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value, subCategory: '' }))} className={inputCls}>
                <option value="">Select category</option>
                {Object.keys(categories).map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Sub-Category</label>
              <select value={form.subCategory} onChange={e => set('subCategory', e.target.value)} className={inputCls} disabled={!form.category}>
                <option value="">Select sub-category</option>
                {subCategories.map(sub => <option key={sub} value={sub}>{sub}</option>)}
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

        {/* Receipt Upload */}
        <div className="rounded-lg border border-white/8 p-4 space-y-3 bg-white/[0.01]">
          <label className={labelCls + ' mb-0'}>Receipt / Invoice</label>
          {receiptData ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <CheckCircle size={16} /> Sealed
              </div>
              <div className="text-xs text-white/30 font-mono break-all">SHA-256: {receiptData.hash}</div>
              <button onClick={() => { setReceiptData(null); setReceiptFile(null) }}
                className="text-xs text-white/30 hover:text-white/50">Replace file</button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-white/15 hover:border-white/25 cursor-pointer transition-all text-sm text-white/40">
                  <Upload size={14} />
                  <span>{receiptFile ? receiptFile.name : 'Choose file...'}</span>
                  <input type="file" className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xlsx,.xls,.csv"
                    onChange={e => { if (e.target.files?.[0]) setReceiptFile(e.target.files[0]) }} />
                </label>
                {receiptFile && (
                  <button onClick={handleReceiptUpload} disabled={uploading}
                    className="px-4 py-2.5 rounded-lg text-xs font-medium text-white disabled:opacity-50 shrink-0"
                    style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
                    {uploading ? 'Uploading...' : 'Upload & Seal'}
                  </button>
                )}
              </div>
              <p className="text-[10px] text-white/20">File will be hashed (SHA-256) and a Trust Seal will be created automatically</p>
            </div>
          )}
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
