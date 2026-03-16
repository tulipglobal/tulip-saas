'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Upload, CheckCircle, FileText, AlertTriangle, WifiOff, Info, Loader2, Image as ImageIcon } from 'lucide-react'
import { apiGet, apiPost } from '@/lib/api'
import { getCategoriesForType, type ExpenseType } from '@/lib/ngo-categories'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import { queueExpense, cacheProjects, cacheBudgets } from '@/lib/syncService'
import { offlineDb } from '@/lib/offlineDb'
import CurrencySelect from '@/components/CurrencySelect'
import { formatCurrencyShort } from '@/lib/currencies'
import { useTranslations } from 'next-intl'

interface Project { id: string; name: string }
interface BudgetLine { id: string; expenseType: string; category: string; subCategory: string | null; approvedAmount: number; currency: string; spent?: number; remaining?: number }
interface BudgetOption { id: string; name: string; status: string; totalApproved: number; totalSpent: number; remaining: number; lines: BudgetLine[]; project?: { id: string; name: string } | null }

interface FraudFlag {
  type: 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'
  reason: string
}

export default function NewExpensePage() {
  const router = useRouter()
  const t = useTranslations()
  const { isOnline } = useOfflineSync()

  // DEBUG panel state — toggle with ?debug in URL
  const [debugSimOffline, setDebugSimOffline] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('debug')) setShowDebug(true)
  }, [])
  const effectiveOnline = debugSimOffline ? false : isOnline

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [offlineSaved, setOfflineSaved] = useState(false)

  const [projects, setProjects] = useState<Project[]>([])
  const [budgets, setBudgets] = useState<BudgetOption[]>([])
  const [selectedBudget, setSelectedBudget] = useState<BudgetOption | null>(null)
  const [loadingBudgets, setLoadingBudgets] = useState(false)
  const [disbursementInfo, setDisbursementInfo] = useState<{ hasDisbursements: boolean; totalFunded: number; totalReleased: number; totalSpent: number; available: number } | null>(null)

  // Receipt upload state
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [receiptData, setReceiptData] = useState<{ fileKey: string; hash: string; sealId: string } | null>(null)
  const [ocrValues, setOcrValues] = useState<{ amount?: number; vendor?: string; date?: string; invoiceNumber?: string } | null>(null)
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set())
  const [fraudFlags, setFraudFlags] = useState<FraudFlag[]>([])
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)

  const [form, setForm] = useState({
    title: '', amount: '', currency: 'USD', expenseType: '' as '' | ExpenseType,
    category: '', subCategory: '', vendor: '', invoiceNumber: '',
    expenseDate: new Date().toISOString().split('T')[0],
    projectId: '', budgetId: '', budgetLineId: '', notes: ''
  })

  // Fetch projects — online: API + cache; offline: IndexedDB
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('tulip_token') : null
    if (effectiveOnline) {
      apiGet('/api/projects?limit=100')
        .then(r => r.ok ? r.json() : { items: [] })
        .then(d => {
          const items = d.data ?? d.items ?? []
          setProjects(items)
          if (token) cacheProjects(token).catch(() => {})
        })
        .catch(() => {})
    } else {
      offlineDb.cached_projects.toArray()
        .then(cached => setProjects(cached.map(c => ({ id: c.id, name: c.name }))))
        .catch(() => {})
    }
  }, [effectiveOnline])

  // Fetch budgets when project changes
  const handleProjectChange = async (projectId: string) => {
    setForm(f => ({ ...f, projectId, budgetId: '', budgetLineId: '', expenseType: '', category: '', subCategory: '' }))
    setSelectedBudget(null)
    setBudgets([])
    setDisbursementInfo(null)
    if (!projectId) return

    // Fetch disbursement info
    apiGet(`/api/tranches/ngo/project/${projectId}/disbursement-info`)
      .then(async r => { if (r.ok) { const d = await r.json(); setDisbursementInfo(d) } })
      .catch(() => {})

    setLoadingBudgets(true)
    const token = typeof window !== 'undefined' ? localStorage.getItem('tulip_token') : null
    if (effectiveOnline) {
      try {
        const res = await apiGet(`/api/budgets?projectId=${projectId}&limit=50`)
        if (res.ok) {
          const d = await res.json()
          const filtered = (d.data ?? []).filter((b: BudgetOption) => ['ACTIVE', 'APPROVED', 'DRAFT'].includes(b.status))
          setBudgets(filtered)
          if (token) cacheBudgets(projectId, token).catch(() => {})
        }
      } catch {}
    } else {
      try {
        const cached = await offlineDb.cached_budgets.where('projectId').equals(projectId).toArray()
        const restored = cached.map(c => c.data as BudgetOption).filter(b => ['ACTIVE', 'APPROVED', 'DRAFT'].includes(b.status))
        setBudgets(restored)
      } catch {}
    }
    setLoadingBudgets(false)
  }

  const handleBudgetChange = async (budgetId: string) => {
    setForm(f => ({ ...f, budgetId, budgetLineId: '', expenseType: '', category: '', subCategory: '' }))
    setSelectedBudget(null)
    if (!budgetId) return
    if (effectiveOnline) {
      try {
        const res = await apiGet(`/api/budgets/${budgetId}`)
        if (res.ok) {
          const data = await res.json()
          setSelectedBudget(data)
        }
      } catch {}
    } else {
      const cached = budgets.find(b => b.id === budgetId)
      if (cached) setSelectedBudget(cached)
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

  const set = (k: string, v: string) => {
    setForm(f => ({ ...f, [k]: v }))
    // If user manually edits an auto-filled field, remove badge
    setAutoFilledFields(prev => {
      const next = new Set(prev)
      next.delete(k)
      return next
    })
  }

  const categories = useMemo(() => {
    if (!form.expenseType) return {}
    return getCategoriesForType(form.expenseType as ExpenseType)
  }, [form.expenseType])
  const subCategories = useMemo(() => form.category ? (categories[form.category] ?? []) : [], [form.category, categories])

  const filteredBudgets = useMemo(() => {
    if (!form.expenseType) return budgets
    return budgets.filter(b => b.lines.some(l => l.expenseType === form.expenseType))
  }, [budgets, form.expenseType])

  const filteredLines = useMemo(() => {
    if (!selectedBudget) return []
    if (!form.expenseType) return selectedBudget.lines
    return selectedBudget.lines.filter(l => l.expenseType === form.expenseType)
  }, [selectedBudget, form.expenseType])

  const selectedLine = selectedBudget?.lines.find(l => l.id === form.budgetLineId)
  const lineRemaining = selectedLine?.remaining ?? null

  // Build fraud flags from OCR/duplicate data
  const buildFraudFlags = (data: Record<string, unknown>): FraudFlag[] => {
    const flags: FraudFlag[] = []
    const ocrFields = data.ocrFields as Record<string, unknown> | undefined

    if (ocrFields?.crossTenantDuplicate) {
      flags.push({ type: 'HIGH', reason: 'Cross-organization duplicate: This document was submitted by another organization.' })
    }
    if (ocrFields?.duplicateConfidence === 'HIGH') {
      flags.push({ type: 'HIGH', reason: `Duplicate document detected: This file matches "${(ocrFields?.duplicateOf as Record<string, string>)?.name || 'another document'}" by both text content and visual appearance.` })
    }
    if (ocrFields?.duplicateConfidence === 'MEDIUM') {
      flags.push({ type: 'MEDIUM', reason: `Visually similar document: This file has the same text content as "${(ocrFields?.duplicateOf as Record<string, string>)?.name || 'another document'}".` })
    }
    if (ocrFields?.duplicateConfidence === 'LOW') {
      flags.push({ type: 'LOW', reason: 'This file looks visually similar to another document on file.' })
    }

    return flags
  }

  // Generate preview URL for the uploaded file
  const generatePreview = (file: File) => {
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file)
      setReceiptPreview(url)
    } else {
      setReceiptPreview(null)
    }
  }

  // Upload receipt — runs OCR immediately
  const handleReceiptUpload = async (file: File) => {
    setReceiptFile(file)
    generatePreview(file)
    setUploading(true)
    setError('')
    setFraudFlags([])
    try {
      const token = localStorage.getItem('tulip_token')
      const fd = new FormData()
      fd.append('file', file)
      fd.append('title', form.title || form.vendor || file.name)
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050'}/api/expenses/upload-receipt`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: fd,
      })

      if (res.ok) {
        const data = await res.json()
        setReceiptData({ fileKey: data.fileKey, hash: data.hash, sealId: data.sealId })

        // Build fraud flags from response
        const flags = buildFraudFlags(data)
        setFraudFlags(flags)

        // Auto-fill form fields from OCR results
        const filled = new Set<string>()
        if (data.ocrFields) {
          // Track which fields OCR provided (outside React callback for reliable state)
          if (data.ocrFields.amount) filled.add('amount')
          if (data.ocrFields.currency) filled.add('currency')
          if (data.ocrFields.vendor) filled.add('vendor')
          if (data.ocrFields.date) filled.add('expenseDate')
          if (data.ocrFields.extras?.['Invoice Number']) filled.add('invoiceNumber')

          setForm(f => {
            const updates: Record<string, string> = {}
            if (data.ocrFields.amount && !f.amount) {
              updates.amount = String(data.ocrFields.amount)
            }
            if (data.ocrFields.currency) {
              updates.currency = data.ocrFields.currency
            }
            if (data.ocrFields.vendor && !f.vendor) {
              updates.vendor = data.ocrFields.vendor
            }
            if (data.ocrFields.date) {
              updates.expenseDate = data.ocrFields.date
            }
            if (data.ocrFields.extras?.['Invoice Number'] && !f.invoiceNumber) {
              updates.invoiceNumber = data.ocrFields.extras['Invoice Number']
            }
            return { ...f, ...updates }
          })
          setOcrValues({
            ...(data.ocrFields.amount != null ? { amount: data.ocrFields.amount } : {}),
            ...(data.ocrFields.vendor ? { vendor: data.ocrFields.vendor } : {}),
            ...(data.ocrFields.date ? { date: data.ocrFields.date } : {}),
            ...(data.ocrFields.extras?.['Invoice Number'] ? { invoiceNumber: data.ocrFields.extras['Invoice Number'] } : {}),
          })
          setAutoFilledFields(filled)
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

  // Compute mismatch flags when form values differ from OCR
  const mismatchFlags = useMemo(() => {
    if (!ocrValues) return []
    const flags: FraudFlag[] = []
    if (ocrValues.amount != null && form.amount && Math.abs(parseFloat(form.amount) - ocrValues.amount) > 0.01) {
      flags.push({ type: 'MEDIUM', reason: `Amount mismatch: OCR read ${ocrValues.amount.toLocaleString()}, you entered ${parseFloat(form.amount).toLocaleString()}.` })
    }
    if (ocrValues.vendor && form.vendor && ocrValues.vendor.toLowerCase() !== form.vendor.toLowerCase()) {
      flags.push({ type: 'LOW', reason: `Vendor name differs: OCR read "${ocrValues.vendor}", you entered "${form.vendor}".` })
    }
    if (ocrValues.date && form.expenseDate && ocrValues.date !== form.expenseDate) {
      const ocrD = new Date(ocrValues.date)
      const formD = new Date(form.expenseDate)
      const diffDays = Math.abs((ocrD.getTime() - formD.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays > 30) {
        flags.push({ type: 'MEDIUM', reason: `Date mismatch: OCR read ${ocrValues.date}, you entered ${form.expenseDate} (${Math.round(diffDays)} days apart).` })
      } else if (diffDays > 1) {
        flags.push({ type: 'LOW', reason: `Date differs: OCR read ${ocrValues.date}, you entered ${form.expenseDate}.` })
      }
    }
    return flags
  }, [ocrValues, form.amount, form.vendor, form.expenseDate])

  const allFlags = [...fraudFlags, ...mismatchFlags]

  const submit = async () => {
    if (!form.projectId) { setError(t('expenses.projectRequired')); return }
    if (!form.title.trim()) { setError(t('expenses.titleRequired')); return }
    if (!form.amount || isNaN(parseFloat(form.amount))) { setError(t('expenses.validAmount')); return }
    if (parseFloat(form.amount) <= 0) { setError(t('expenses.amountPositive')); return }
    if (lineRemaining !== null && parseFloat(form.amount) > lineRemaining) {
      setError(`Amount exceeds remaining balance of ${formatCurrencyShort(selectedLine?.currency || '')} ${lineRemaining.toLocaleString()}`)
      return
    }
    setSaving(true); setError('')

    // OFFLINE: queue to IndexedDB instead of API
    if (!effectiveOnline || !window.navigator.onLine) {
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.error('[expense] Submit failed:', msg)
      setError(`Network error: ${msg}`)
    }
    setSaving(false)
  }

  const inputCls = "w-full bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-4 py-2.5 text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none focus:border-[var(--tulip-gold)] transition-all [&>option]:bg-[var(--tulip-sage)] [color-scheme:light]"
  const labelCls = "block text-xs font-medium text-[var(--tulip-forest)]/60 mb-1.5 uppercase tracking-wide"

  const AutoBadge = ({ field }: { field: string }) => {
    if (!autoFilledFields.has(field)) return null
    return <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700 border border-green-200">Auto-filled</span>
  }

  return (
    <div className="p-6 max-w-2xl animate-fade-up">
      {/* DEBUG PANEL — access via ?debug in URL */}
      {showDebug && (
        <div className="mb-4 rounded-xl border-2 border-red-400 bg-red-50 p-4 text-xs font-mono space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-red-600 text-sm">OFFLINE DEBUG PANEL</span>
            <button onClick={() => setShowDebug(false)} className="text-red-400 hover:text-red-600">close</button>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <span className="text-[var(--tulip-forest)]/60">navigator.onLine:</span>
            <span className={typeof navigator !== 'undefined' && navigator.onLine ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
              {typeof navigator !== 'undefined' ? String(navigator.onLine) : 'N/A'}
            </span>
            <span className="text-[var(--tulip-forest)]/60">isOnline (hook):</span>
            <span className={isOnline ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{String(isOnline)}</span>
            <span className="text-[var(--tulip-forest)]/60">debugSimOffline:</span>
            <span className={debugSimOffline ? 'text-red-600 font-bold' : 'text-[var(--tulip-forest)]/40'}>{String(debugSimOffline)}</span>
            <span className="text-[var(--tulip-forest)]/60 font-bold border-t border-red-200 pt-1">effectiveOnline (final):</span>
            <span className={`font-bold border-t border-red-200 pt-1 ${effectiveOnline ? 'text-green-600' : 'text-red-600'}`}>{String(effectiveOnline)}</span>
          </div>
          <div className="flex gap-2 pt-2 border-t border-red-200">
            <button
              onClick={() => setDebugSimOffline(!debugSimOffline)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${debugSimOffline ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}
            >
              {debugSimOffline ? 'Stop Simulating (go online)' : 'Simulate Offline'}
            </button>
          </div>
        </div>
      )}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/expenses" className="text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)] transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[var(--tulip-forest)]" style={{ fontFamily: 'Inter, sans-serif' }}>{t('expenses.logExpense')}</h1>
          <p className="text-[var(--tulip-forest)]/60 text-sm">{t('expenses.expenseAnchored')}</p>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--tulip-sage-dark)] p-6 space-y-5" style={{ background: 'var(--tulip-sage)' }}>

        {/* ─── 1. UPLOAD SECTION (FIRST) ─── */}
        <div className="rounded-lg border-2 border-dashed border-[var(--tulip-sage-dark)] p-6 space-y-3 bg-[var(--tulip-cream)]/50">
          <div className="flex items-center gap-2 mb-1">
            <Upload size={18} className="text-[var(--tulip-forest)]/70" />
            <span className="text-sm font-semibold text-[var(--tulip-forest)]">{t('expenses.receiptInvoice')}</span>
          </div>
          <p className="text-sm text-[var(--tulip-forest)]/60">
            Upload your receipt or invoice first. We&apos;ll read it automatically and fill in the details below.
          </p>

          {uploading ? (
            <div className="flex items-center gap-3 py-6 justify-center text-[var(--tulip-forest)]/60">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm font-medium">Reading your document...</span>
            </div>
          ) : receiptData ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {receiptPreview ? (
                  <img src={receiptPreview} alt="Receipt" className="w-16 h-16 object-cover rounded-lg border border-[var(--tulip-sage-dark)]" />
                ) : (
                  <div className="w-16 h-16 rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] flex items-center justify-center">
                    <FileText size={24} className="text-[var(--tulip-forest)]/40" />
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                    <CheckCircle size={14} /> Uploaded &amp; Sealed
                  </div>
                  <p className="text-xs text-[var(--tulip-forest)]/60 mt-0.5">{receiptFile?.name}</p>
                  <p className="text-[10px] text-[var(--tulip-forest)]/30 font-mono mt-0.5">SHA-256: {receiptData.hash.slice(0, 16)}…</p>
                </div>
                <button onClick={() => { setReceiptData(null); setReceiptFile(null); setReceiptPreview(null); setFraudFlags([]); setAutoFilledFields(new Set()); setOcrValues(null) }}
                  className="text-xs text-[var(--tulip-forest)]/40 hover:text-[var(--tulip-forest)]/60 shrink-0">Replace</button>
              </div>
            </div>
          ) : (
            <label className="flex flex-col items-center gap-2 py-6 cursor-pointer rounded-lg hover:bg-[var(--tulip-sage)]/50 transition-colors">
              <div className="w-14 h-14 rounded-full bg-[var(--tulip-sage)] flex items-center justify-center">
                <Upload size={22} className="text-[var(--tulip-forest)]/50" />
              </div>
              <span className="text-sm text-[var(--tulip-forest)]/70 font-medium">Click to upload</span>
              <span className="text-xs text-[var(--tulip-forest)]/30">PDF, JPG, or PNG</span>
              <input type="file" className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,image/jpeg,image/png,application/pdf"
                onChange={e => { if (e.target.files?.[0]) handleReceiptUpload(e.target.files[0]) }} />
            </label>
          )}
        </div>

        {/* ─── 2. FORM FIELDS ─── */}

        {/* Project */}
        <div>
          <label className={labelCls}>{t('expenses.project')}</label>
          {!effectiveOnline && projects.length === 0 ? (
            <div className="rounded-lg bg-amber-100 border border-amber-300 px-4 py-3 text-sm text-amber-800">
              {t('expenses.cacheProjects')}
            </div>
          ) : (
            <select value={form.projectId} onChange={e => handleProjectChange(e.target.value)} className={inputCls}>
              <option value="">{t('common.selectProject')}</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
        </div>

        {/* Expense Type */}
        {form.projectId && (
          <div>
            <label className={labelCls}>{t('expenses.expenseType')}</label>
            <div className="flex gap-3">
              {(['CAPEX', 'OPEX'] as const).map(type => (
                <button key={type} type="button"
                  onClick={() => {
                    setForm(f => ({ ...f, expenseType: type, category: '', subCategory: '', budgetId: '', budgetLineId: '' }))
                    setSelectedBudget(null)
                  }}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all ${
                    form.expenseType === type
                      ? type === 'CAPEX' ? 'bg-purple-500/15 border-purple-500/30 text-purple-400' : 'bg-cyan-500/15 border-cyan-500/30 text-[var(--tulip-forest)]'
                      : 'bg-[var(--tulip-sage)] border-[var(--tulip-sage-dark)] text-[var(--tulip-forest)]/60 hover:border-[var(--tulip-sage-dark)]'
                  }`}>
                  {type === 'CAPEX' ? 'CapEx' : 'OpEx'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Budget */}
        {form.projectId && (
          <div>
            <label className={labelCls}>{t('expenses.budget')}</label>
            {loadingBudgets ? (
              <div className={inputCls + ' text-[var(--tulip-forest)]/40'}>{t('expenses.loadingBudgets')}</div>
            ) : filteredBudgets.length === 0 ? (
              <div className="text-xs text-[var(--tulip-forest)]/40 py-2">
                {budgets.length === 0 ? <>{t('expenses.noBudgets')}{' '}
                  <Link href={`/dashboard/budgets/new?projectId=${form.projectId}`} className="text-[var(--tulip-forest)] hover:text-[var(--tulip-gold)]">{t('expenses.createOne')}</Link>
                </> : <>No budgets with {form.expenseType === 'CAPEX' ? 'CapEx' : 'OpEx'} lines found.</>}
              </div>
            ) : (
              <select value={form.budgetId} onChange={e => handleBudgetChange(e.target.value)} className={inputCls}>
                <option value="">{t('common.selectBudget')}</option>
                {filteredBudgets.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.status}) — {disbursementInfo?.hasDisbursements ? `Available from Released: $${disbursementInfo.available.toLocaleString()} (of $${disbursementInfo.totalReleased.toLocaleString()} released)` : `Remaining: $${(b.totalApproved - (b.totalSpent || 0)).toLocaleString()}`}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Budget Line */}
        {selectedBudget && (
          <div>
            <label className={labelCls}>{t('expenses.budgetLine')}</label>
            <select value={form.budgetLineId} onChange={e => handleBudgetLineChange(e.target.value)} className={inputCls}>
              <option value="">{t('common.selectBudgetLine')}</option>
              {filteredLines.map(l => (
                <option key={l.id} value={l.id}>
                  {l.expenseType} — {l.category}{l.subCategory ? ` / ${l.subCategory}` : ''} (Remaining: {l.currency} {(l.remaining ?? l.approvedAmount).toLocaleString()})
                </option>
              ))}
            </select>
            {selectedLine && (
              <div className="text-xs text-[var(--tulip-forest)]/60 mt-1 flex gap-4">
                <span>{t('expenses.approved')}: <span className="text-[var(--tulip-forest)]/70">{selectedLine.currency} {selectedLine.approvedAmount.toLocaleString()}</span></span>
                {disbursementInfo?.hasDisbursements ? (
                  <span>Available from Released: <span className={disbursementInfo.available > 0 ? 'text-green-400' : 'text-red-400'}>{selectedLine.currency} {disbursementInfo.available.toLocaleString()}</span></span>
                ) : selectedLine.remaining !== undefined && (
                  <span>{t('expenses.remaining')}: <span className={selectedLine.remaining > 0 ? 'text-green-400' : 'text-red-400'}>{selectedLine.currency} {selectedLine.remaining.toLocaleString()}</span></span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Disbursement Limit Info */}
        {disbursementInfo?.hasDisbursements && (
          <div className="rounded-lg border px-4 py-3 space-y-1" style={{ background: disbursementInfo.totalReleased > 0 ? '#ecfdf5' : '#fef3c7', borderColor: disbursementInfo.totalReleased > 0 ? '#86efac' : '#fcd34d' }}>
            <p className="text-xs font-medium" style={{ color: disbursementInfo.totalReleased > 0 ? '#166534' : '#92400e' }}>
              Donor Disbursement Limit
            </p>
            <div className="flex gap-4 text-xs">
              <span style={{ color: 'var(--tulip-forest)' }}>Funded: <strong>{formatCurrencyShort(form.currency || 'USD')} {disbursementInfo.totalFunded.toLocaleString()}</strong></span>
              <span style={{ color: '#166534' }}>Released: <strong>{formatCurrencyShort(form.currency || 'USD')} {disbursementInfo.totalReleased.toLocaleString()}</strong></span>
              <span style={{ color: 'var(--tulip-forest)' }}>Spent: <strong>{formatCurrencyShort(form.currency || 'USD')} {disbursementInfo.totalSpent.toLocaleString()}</strong></span>
              <span style={{ color: disbursementInfo.available > 0 ? '#166534' : '#dc2626' }}>Available: <strong>{formatCurrencyShort(form.currency || 'USD')} {disbursementInfo.available.toLocaleString()}</strong></span>
            </div>
            {disbursementInfo.totalReleased === 0 && (
              <p className="text-xs" style={{ color: '#92400e' }}>No funds released yet — donor must release tranches before expenses can be submitted.</p>
            )}
          </div>
        )}

        {/* Title */}
        <div>
          <label className={labelCls}>{t('expenses.descriptionTitle')}</label>
          <input value={form.title} onChange={e => set('title', e.target.value)}
            placeholder="e.g. Field equipment purchase" className={inputCls} />
        </div>

        {/* Amount + Currency */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>{t('expenses.amount')} <AutoBadge field="amount" /></label>
            <input type="number" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)}
              placeholder="0.00" className={inputCls} />
            {lineRemaining !== null && form.amount && parseFloat(form.amount) > lineRemaining && (
              <p className="text-xs text-red-400 mt-1">Exceeds remaining balance of {selectedLine?.currency} {lineRemaining.toLocaleString()}</p>
            )}
            {disbursementInfo?.hasDisbursements && disbursementInfo.totalReleased > 0 && form.amount && parseFloat(form.amount) > disbursementInfo.available && (
              <p className="text-xs text-red-400 mt-1">Exceeds disbursed funds: {formatCurrencyShort(form.currency || 'USD')} {disbursementInfo.available.toLocaleString()} available from released tranches</p>
            )}
          </div>
          <div>
            <label className={labelCls}>{t('common.currency')} <AutoBadge field="currency" /></label>
            <CurrencySelect value={form.currency} onChange={v => set('currency', v)} />
          </div>
        </div>

        {/* Vendor + Date */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>{t('expenses.vendor')} <AutoBadge field="vendor" /></label>
            <input value={form.vendor} onChange={e => set('vendor', e.target.value)}
              placeholder="Vendor name" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t('expenses.expenseDate')} <AutoBadge field="expenseDate" /></label>
            <input type="date" value={form.expenseDate} onChange={e => set('expenseDate', e.target.value)} className={inputCls} />
          </div>
        </div>

        {/* Invoice Number */}
        {(form.invoiceNumber || autoFilledFields.has('invoiceNumber')) && (
          <div>
            <label className={labelCls}>Invoice Number <AutoBadge field="invoiceNumber" /></label>
            <input value={form.invoiceNumber} onChange={e => set('invoiceNumber', e.target.value)}
              placeholder="Invoice number" className={inputCls} />
          </div>
        )}

        {/* Category */}
        {form.expenseType && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t('expenses.category')}</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value, subCategory: '' }))} className={inputCls}>
                <option value="">{t('common.selectCategory')}</option>
                {Object.keys(categories).map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>{t('expenses.subCategory')}</label>
              <select value={form.subCategory} onChange={e => set('subCategory', e.target.value)} className={inputCls} disabled={!form.category}>
                <option value="">{t('common.selectSubCategory')}</option>
                {subCategories.map(sub => <option key={sub} value={sub}>{sub}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className={labelCls}>{t('expenses.notes')}</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
            placeholder="Additional notes..." rows={2} className={inputCls + ' resize-none'} />
        </div>

        {/* ─── 3. FRAUD FLAGS (informational banners) ─── */}
        {allFlags.length > 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-xs text-[var(--tulip-forest)]/50">
              These are automated checks. Review them before submitting — your approver will also see these.
            </p>
            {allFlags.map((flag, i) => (
              <div key={i} className={`rounded-lg px-4 py-3 text-sm flex items-start gap-2 border-l-4 ${
                flag.type === 'HIGH'
                  ? 'bg-red-50 border-red-500 text-red-800'
                  : flag.type === 'MEDIUM'
                  ? 'bg-amber-50 border-amber-500 text-amber-800'
                  : 'bg-blue-50 border-blue-500 text-blue-800'
              }`}>
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium">{flag.type === 'HIGH' ? 'High Risk' : flag.type === 'MEDIUM' ? 'Medium Risk' : 'Info'}:</span>{' '}
                  {flag.reason}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Offline warning */}
        {!effectiveOnline && (
          <div className="rounded-lg bg-amber-100 border border-amber-300 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
            <WifiOff size={14} /> {t('expenses.offlineMsg')}
          </div>
        )}

        {offlineSaved && (
          <div className="rounded-lg bg-green-100 border border-green-300 px-4 py-3 text-sm text-green-800 flex items-center gap-2">
            <CheckCircle size={14} /> {t('expenses.savedOffline')}
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-400/10 border border-red-400/20 px-4 py-3 text-sm text-red-400">{error}</div>
        )}

        {/* ─── 4. SUBMIT BUTTON (always enabled) ─── */}
        <div className="flex items-center gap-3 pt-2">
          <button onClick={submit} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-[var(--tulip-forest)] disabled:opacity-50 bg-[var(--tulip-gold)] hover:bg-[var(--tulip-orange)]">
            <Save size={15} /> {saving ? t('common.saving') : effectiveOnline ? 'Submit for Approval' : t('expenses.saveOffline')}
          </button>
          <Link href="/dashboard/expenses" className="px-5 py-2.5 rounded-lg text-sm text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)] transition-colors">
            {t('common.cancel')}
          </Link>
        </div>
      </div>
    </div>
  )
}
