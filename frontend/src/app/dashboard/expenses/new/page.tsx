'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Upload, CheckCircle, FileText, AlertTriangle, WifiOff } from 'lucide-react'
import { apiGet, apiPost } from '@/lib/api'
import { getCategoriesForType, type ExpenseType } from '@/lib/ngo-categories'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import { queueExpense } from '@/lib/syncService'
import { offlineDb } from '@/lib/offlineDb'

interface Project { id: string; name: string }
interface BudgetLine { id: string; expenseType: string; category: string; subCategory: string | null; approvedAmount: number; currency: string; spent?: number; remaining?: number }
interface BudgetOption { id: string; name: string; status: string; totalApproved: number; totalSpent: number; remaining: number; lines: BudgetLine[]; project?: { id: string; name: string } | null }

const CURRENCIES = ['USD', 'EUR', 'GBP', 'KES', 'UGX', 'TZS', 'INR', 'NGN', 'ZAR', 'GHS', 'ETB', 'RWF', 'AED', 'OMR']

export default function NewExpensePage() {
  const router = useRouter()
  const { isOnline } = useOfflineSync()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [offlineSaved, setOfflineSaved] = useState(false)

  const [projects, setProjects] = useState<Project[]>([])
  const [budgets, setBudgets] = useState<BudgetOption[]>([])
  const [selectedBudget, setSelectedBudget] = useState<BudgetOption | null>(null)
  const [loadingBudgets, setLoadingBudgets] = useState(false)

  // Receipt upload state
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [receiptData, setReceiptData] = useState<{ fileKey: string; hash: string; sealId: string } | null>(null)
  const [ocrValues, setOcrValues] = useState<{ amount?: number; vendor?: string; date?: string } | null>(null)
  const [duplicateInfo, setDuplicateInfo] = useState<{ name: string; uploadedAt: string } | null>(null)
  const [crossTenantDuplicate, setCrossTenantDuplicate] = useState(false)
  const [duplicateConfidence, setDuplicateConfidence] = useState<string | null>(null)

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

  // Filter budgets by expense type (only show budgets that have lines matching the type)
  const filteredBudgets = useMemo(() => {
    if (!form.expenseType) return budgets
    return budgets.filter(b => b.lines.some(l => l.expenseType === form.expenseType))
  }, [budgets, form.expenseType])

  // Filter budget lines by expense type
  const filteredLines = useMemo(() => {
    if (!selectedBudget) return []
    if (!form.expenseType) return selectedBudget.lines
    return selectedBudget.lines.filter(l => l.expenseType === form.expenseType)
  }, [selectedBudget, form.expenseType])

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
        // Check for duplicate detection
        if (data.ocrFields?.duplicateOf) {
          setDuplicateInfo({ name: data.ocrFields.duplicateOf.name, uploadedAt: data.ocrFields.duplicateOf.uploadedAt })
        } else {
          setDuplicateInfo(null)
        }
        setCrossTenantDuplicate(!!data.ocrFields?.crossTenantDuplicate)
        setDuplicateConfidence(data.ocrFields?.duplicateConfidence || null)
        // Auto-fill form fields from OCR results (only fill empty fields)
        if (data.ocrFields) {
          setForm(f => ({
            ...f,
            ...(data.ocrFields.amount && !f.amount ? { amount: String(data.ocrFields.amount) } : {}),
            ...(data.ocrFields.currency ? { currency: data.ocrFields.currency } : {}),
            ...(data.ocrFields.vendor && !f.vendor ? { vendor: data.ocrFields.vendor } : {}),
            ...(data.ocrFields.date ? { expenseDate: data.ocrFields.date } : {}),
          }))
          // Store original OCR values for mismatch detection on save
          setOcrValues({
            ...(data.ocrFields.amount != null ? { amount: data.ocrFields.amount } : {}),
            ...(data.ocrFields.vendor ? { vendor: data.ocrFields.vendor } : {}),
            ...(data.ocrFields.date ? { date: data.ocrFields.date } : {}),
          })
        }
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
    if (parseFloat(form.amount) <= 0) { setError('Amount must be greater than zero'); return }
    if (lineRemaining !== null && parseFloat(form.amount) > lineRemaining) {
      setError(`Amount exceeds remaining balance of ${selectedLine?.currency} ${lineRemaining.toLocaleString()}`)
      return
    }
    setSaving(true); setError('')

    // OFFLINE: queue to IndexedDB instead of API
    if (!isOnline) {
      try {
        let receiptBlob: Blob | undefined
        let receiptName: string | undefined
        if (receiptFile) {
          receiptBlob = receiptFile
          receiptName = receiptFile.name
        }
        await queueExpense({
          budgetId: form.budgetId || '',
          projectId: form.projectId,
          description: form.title.trim(),
          amount: parseFloat(form.amount),
          currency: form.currency,
          date: form.expenseDate,
          category: form.category || '',
          vendorName: form.vendor || undefined,
          receiptBlob,
          receiptName,
          createdOffline: new Date(),
          status: 'pending',
          retries: 0,
        })
        setOfflineSaved(true)
        setTimeout(() => router.push('/dashboard/expenses'), 1500)
      } catch {
        setError('Failed to save offline')
      }
      setSaving(false)
      return
    }

    // ONLINE: normal API call
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
        ...(ocrValues && {
          ocrAmount: ocrValues.amount ?? null,
          ocrVendor: ocrValues.vendor ?? null,
          ocrDate: ocrValues.date ?? null,
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

  const inputCls = "w-full bg-[#e1eedd] border border-[#c8d6c0] rounded-lg px-4 py-2.5 text-sm text-[#183a1d] placeholder-[#183a1d]/40 outline-none focus:border-[#f6c453] transition-all [&>option]:bg-[#e1eedd] [color-scheme:light]"
  const labelCls = "block text-xs font-medium text-[#183a1d]/60 mb-1.5 uppercase tracking-wide"

  return (
    <div className="p-6 max-w-2xl animate-fade-up">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/expenses" className="text-[#183a1d]/60 hover:text-[#183a1d] transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#183a1d]" style={{ fontFamily: 'Inter, sans-serif' }}>Log Expense</h1>
          <p className="text-[#183a1d]/60 text-sm">This expense will be SHA-256 hashed and anchored to Polygon</p>
        </div>
      </div>

      <div className="rounded-xl border border-[#c8d6c0] p-6 space-y-5" style={{ background: '#e1eedd' }}>

        {/* 1. Project */}
        <div>
          <label className={labelCls}>Project *</label>
          <select value={form.projectId} onChange={e => handleProjectChange(e.target.value)} className={inputCls}>
            <option value="">Select project...</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {/* 2. Expense Type (CapEx/OpEx) — filters budgets & lines */}
        {form.projectId && (
          <div>
            <label className={labelCls}>Expense Type</label>
            <div className="flex gap-3">
              {(['CAPEX', 'OPEX'] as const).map(type => (
                <button key={type} type="button"
                  onClick={() => {
                    setForm(f => ({ ...f, expenseType: type, category: '', subCategory: '', budgetId: '', budgetLineId: '' }))
                    setSelectedBudget(null)
                  }}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all ${
                    form.expenseType === type
                      ? type === 'CAPEX' ? 'bg-purple-500/15 border-purple-500/30 text-purple-400' : 'bg-cyan-500/15 border-cyan-500/30 text-[#183a1d]'
                      : 'bg-[#e1eedd] border-[#c8d6c0] text-[#183a1d]/60 hover:border-[#c8d6c0]'
                  }`}>
                  {type === 'CAPEX' ? 'CapEx' : 'OpEx'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 3. Budget (filtered by expense type if selected) */}
        {form.projectId && (
          <div>
            <label className={labelCls}>Budget *</label>
            {loadingBudgets ? (
              <div className={inputCls + ' text-[#183a1d]/40'}>Loading budgets...</div>
            ) : filteredBudgets.length === 0 ? (
              <div className="text-xs text-[#183a1d]/40 py-2">
                {budgets.length === 0 ? <>No budgets found for this project.{' '}
                  <Link href={`/dashboard/budgets/new?projectId=${form.projectId}`} className="text-[#183a1d] hover:text-[#f6c453]">Create one</Link>
                </> : <>No budgets with {form.expenseType === 'CAPEX' ? 'CapEx' : 'OpEx'} lines found.</>}
              </div>
            ) : (
              <select value={form.budgetId} onChange={e => handleBudgetChange(e.target.value)} className={inputCls}>
                <option value="">Select budget...</option>
                {filteredBudgets.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.status}) — Remaining: ${(b.totalApproved - (b.totalSpent || 0)).toLocaleString()}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* 4. Budget Line (filtered by expense type if selected) */}
        {selectedBudget && (
          <div>
            <label className={labelCls}>Budget Line *</label>
            <select value={form.budgetLineId} onChange={e => handleBudgetLineChange(e.target.value)} className={inputCls}>
              <option value="">Select budget line...</option>
              {filteredLines.map(l => (
                <option key={l.id} value={l.id}>
                  {l.expenseType} — {l.category}{l.subCategory ? ` / ${l.subCategory}` : ''} (Remaining: {l.currency} {(l.remaining ?? l.approvedAmount).toLocaleString()})
                </option>
              ))}
            </select>
            {selectedLine && (
              <div className="text-xs text-[#183a1d]/60 mt-1 flex gap-4">
                <span>Approved: <span className="text-[#183a1d]/70">{selectedLine.currency} {selectedLine.approvedAmount.toLocaleString()}</span></span>
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
        <div className="rounded-lg border border-[#c8d6c0] p-4 space-y-3 bg-[#e1eedd]">
          <label className={labelCls + ' mb-0'}>Receipt / Invoice</label>
          {receiptData ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <CheckCircle size={16} /> Sealed
              </div>
              <div className="text-xs text-[#183a1d]/40 font-mono break-all">SHA-256: {receiptData.hash}</div>

              {crossTenantDuplicate && (
                <div className="rounded-xl bg-red-600 p-5 space-y-2">
                  <div className="flex items-center gap-3 text-white font-bold text-lg">
                    <AlertTriangle size={24} className="shrink-0" /> HIGH RISK — Cross-Organisation Duplicate
                  </div>
                  <p className="text-white font-bold text-base">This document was uploaded by another organisation. This is a serious fraud indicator.</p>
                  <button onClick={() => { setReceiptData(null); setReceiptFile(null); setDuplicateInfo(null); setCrossTenantDuplicate(false); setDuplicateConfidence(null) }}
                    className="text-white/80 hover:text-white text-sm font-medium underline">Replace file</button>
                </div>
              )}
              {duplicateInfo && !crossTenantDuplicate && duplicateConfidence === 'HIGH' && (
                <div className="rounded-xl bg-red-600 p-5 space-y-2">
                  <div className="flex items-center gap-3 text-white font-bold text-lg">
                    <AlertTriangle size={24} className="shrink-0" /> DUPLICATE CONFIRMED
                  </div>
                  <p className="text-white font-bold text-base">This file matches &quot;{duplicateInfo.name}&quot; by both text content and visual appearance. This is almost certainly a duplicate receipt.</p>
                  <button onClick={() => { setReceiptData(null); setReceiptFile(null); setDuplicateInfo(null); setCrossTenantDuplicate(false); setDuplicateConfidence(null) }}
                    className="text-white/80 hover:text-white text-sm font-medium underline">Replace file</button>
                </div>
              )}
              {duplicateInfo && !crossTenantDuplicate && duplicateConfidence === 'MEDIUM' && (
                <div className="rounded-xl bg-orange-500 p-5 space-y-2">
                  <div className="flex items-center gap-3 text-white font-bold text-lg">
                    <AlertTriangle size={24} className="shrink-0" /> LIKELY DUPLICATE
                  </div>
                  <p className="text-white font-bold text-base">This file has the same text content as &quot;{duplicateInfo.name}&quot; uploaded on {new Date(duplicateInfo.uploadedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}. This may be a duplicate expense claim.</p>
                  <button onClick={() => { setReceiptData(null); setReceiptFile(null); setDuplicateInfo(null); setCrossTenantDuplicate(false); setDuplicateConfidence(null) }}
                    className="text-white/80 hover:text-white text-sm font-medium underline">Replace file</button>
                </div>
              )}
              {!crossTenantDuplicate && !duplicateInfo && duplicateConfidence === 'LOW' && (
                <div className="rounded-xl bg-yellow-500 p-5 space-y-2">
                  <div className="flex items-center gap-3 text-[#183a1d] font-bold text-lg">
                    <AlertTriangle size={24} className="shrink-0" /> POSSIBLE DUPLICATE
                  </div>
                  <p className="text-[#183a1d] font-bold text-base">This file looks visually similar to another document on file. Please verify this is not a duplicate.</p>
                  <button onClick={() => { setReceiptData(null); setReceiptFile(null); setDuplicateInfo(null); setCrossTenantDuplicate(false); setDuplicateConfidence(null) }}
                    className="text-[#183a1d]/80 hover:text-[#183a1d] text-sm font-medium underline">Replace file</button>
                </div>
              )}
              {/* Legacy fallback for MEDIUM/null without new confidence field */}
              {duplicateInfo && !crossTenantDuplicate && !duplicateConfidence && (
                <div className="rounded-xl bg-red-600 p-5 space-y-2">
                  <div className="flex items-center gap-3 text-white font-bold text-lg">
                    <AlertTriangle size={24} className="shrink-0" /> DUPLICATE DOCUMENT
                  </div>
                  <p className="text-white font-bold text-base">This file was uploaded before as &quot;{duplicateInfo.name}&quot; on {new Date(duplicateInfo.uploadedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}. Uploading the same receipt twice may indicate duplicate expense claims.</p>
                  <button onClick={() => { setReceiptData(null); setReceiptFile(null); setDuplicateInfo(null); setCrossTenantDuplicate(false); setDuplicateConfidence(null) }}
                    className="text-white/80 hover:text-white text-sm font-medium underline">Replace file</button>
                </div>
              )}

              {!crossTenantDuplicate && !duplicateInfo && duplicateConfidence !== 'LOW' && (
                <button onClick={() => { setReceiptData(null); setReceiptFile(null); setDuplicateInfo(null); setCrossTenantDuplicate(false); setDuplicateConfidence(null) }}
                  className="text-xs text-[#183a1d]/40 hover:text-[#183a1d]/60">Replace file</button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-[#c8d6c0] hover:border-[#c8d6c0] cursor-pointer transition-all text-sm text-[#183a1d]/60">
                  <Upload size={14} />
                  <span>{receiptFile ? receiptFile.name : 'Choose file...'}</span>
                  <input type="file" className="hidden"
                    accept="image/*,application/pdf" capture="environment"
                    onChange={e => { if (e.target.files?.[0]) setReceiptFile(e.target.files[0]) }} />
                </label>
                {receiptFile && (
                  <button onClick={handleReceiptUpload} disabled={uploading}
                    className="px-4 py-2.5 rounded-lg text-xs font-medium text-[#183a1d] disabled:opacity-50 shrink-0 bg-[#f6c453] hover:bg-[#f0a04b]">
                    {uploading ? 'Uploading...' : 'Upload & Seal'}
                  </button>
                )}
              </div>
              <p className="text-[10px] text-[#183a1d]/30">File will be hashed (SHA-256) and a Trust Seal will be created automatically</p>
            </div>
          )}
        </div>

        <div>
          <label className={labelCls}>Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
            placeholder="Additional notes..." rows={2} className={inputCls + ' resize-none'} />
        </div>

        {!isOnline && (
          <div className="rounded-lg bg-amber-100 border border-amber-300 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
            <WifiOff size={14} /> You&apos;re offline — expense will be saved locally and synced when you reconnect
          </div>
        )}

        {offlineSaved && (
          <div className="rounded-lg bg-green-100 border border-green-300 px-4 py-3 text-sm text-green-800 flex items-center gap-2">
            <CheckCircle size={14} /> Saved offline — will sync when connected
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-400/10 border border-red-400/20 px-4 py-3 text-sm text-red-400">{error}</div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button onClick={submit} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-[#183a1d] disabled:opacity-50 bg-[#f6c453] hover:bg-[#f0a04b]">
            <Save size={15} /> {saving ? 'Saving...' : isOnline ? 'Log Expense' : 'Save Offline'}
          </button>
          <Link href="/dashboard/expenses" className="px-5 py-2.5 rounded-lg text-sm text-[#183a1d]/60 hover:text-[#183a1d] transition-colors">
            Cancel
          </Link>
        </div>
      </div>
    </div>
  )
}
