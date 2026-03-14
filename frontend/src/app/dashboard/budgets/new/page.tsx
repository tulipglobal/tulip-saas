'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiGet, apiPost } from '@/lib/api'
import { ArrowLeft, Plus, Trash2, AlertTriangle, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { getCategoriesForType, FUNDING_SOURCE_TYPES, FUNDING_SOURCE_TYPE_KEYS } from '@/lib/ngo-categories'
import type { ExpenseType } from '@/lib/ngo-categories'
import CurrencySelect from '@/components/CurrencySelect'

interface BudgetLineForm {
  key: string
  expenseType: ExpenseType
  category: string
  subCategory: string
  description: string
  approvedAmount: string
  currency: string
}

interface FundingSourceForm {
  key: string
  sourceType: string
  sourceSubType: string
  donorName: string
  amount: string
  currency: string
  interestRate: string
  termMonths: string
  gracePeriodMonths: string
}

interface ProjectOption {
  id: string
  name: string
  startDate: string | null
  endDate: string | null
}

function emptyLine(): BudgetLineForm {
  return { key: crypto.randomUUID(), expenseType: 'OPEX', category: '', subCategory: '', description: '', approvedAmount: '', currency: 'USD' }
}

function emptyFunding(): FundingSourceForm {
  return { key: crypto.randomUUID(), sourceType: '', sourceSubType: '', donorName: '', amount: '', currency: 'USD', interestRate: '', termMonths: '', gracePeriodMonths: '' }
}

const inputCls = "w-full bg-[#e1eedd] border border-[#c8d6c0] rounded-lg px-4 py-2.5 text-sm text-[#183a1d] placeholder-[#183a1d]/40 outline-none focus:border-[#f6c453] transition-all [color-scheme:light]"

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
  const [fundingSources, setFundingSources] = useState<FundingSourceForm[]>([emptyFunding()])

  useEffect(() => {
    apiGet('/api/projects?limit=100')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(d => {
        const items: ProjectOption[] = (d.data ?? d.items ?? []).map((p: any) => ({
          id: p.id, name: p.name,
          startDate: p.startDate ? p.startDate.split('T')[0] : null,
          endDate: p.endDate ? p.endDate.split('T')[0] : null,
        }))
        setProjects(items)
        setLoadingProjects(false)
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

  const handleProjectChange = (pid: string) => {
    setProjectId(pid)
    const proj = projects.find(p => p.id === pid)
    if (proj) {
      setPeriodFrom(proj.startDate || '')
      setPeriodTo(proj.endDate || '')
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

  const updateFunding = (key: string, field: keyof FundingSourceForm, value: string) => {
    setFundingSources(prev => prev.map(f => {
      if (f.key !== key) return f
      const updated = { ...f, [field]: value }
      if (field === 'sourceType') updated.sourceSubType = ''
      return updated
    }))
  }

  const totalCapex = lines.filter(l => l.expenseType === 'CAPEX').reduce((s, l) => s + (Number(l.approvedAmount) || 0), 0)
  const totalOpex = lines.filter(l => l.expenseType === 'OPEX').reduce((s, l) => s + (Number(l.approvedAmount) || 0), 0)
  const totalBudget = totalCapex + totalOpex
  const totalFunded = fundingSources.reduce((s, f) => s + (Number(f.amount) || 0), 0)
  const fundingGap = totalBudget - totalFunded
  const isFullyFunded = totalBudget > 0 && fundingGap <= 0

  const handleSubmit = async () => {
    setError('')
    if (!projectId) return setError('Please select a project')
    if (!name.trim()) return setError('Budget name is required')
    if (!periodFrom || !periodTo) return setError('Budget period is required')
    if (new Date(periodFrom) >= new Date(periodTo)) return setError('Period end must be after start')

    const validLines = lines.filter(l => l.category && Number(l.approvedAmount) > 0)
    if (validLines.length === 0) return setError('At least one budget line with category and amount is required')

    const validFunding = fundingSources.filter(f => f.sourceType && f.donorName && Number(f.amount) > 0)

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
        })),
        fundingSources: validFunding.map(f => ({
          sourceType: f.sourceType,
          sourceSubType: f.sourceSubType || null,
          donorName: f.donorName.trim(),
          amount: Number(f.amount),
          currency: f.currency,
          ...(f.sourceType === 'Impact Investment' && {
            interestRate: f.interestRate ? Number(f.interestRate) : null,
            termMonths: f.termMonths ? Number(f.termMonths) : null,
            gracePeriodMonths: f.gracePeriodMonths ? Number(f.gracePeriodMonths) : null,
          }),
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
        <Link href="/dashboard/budgets" className="w-9 h-9 rounded-lg bg-[#e1eedd] border border-[#c8d6c0] flex items-center justify-center hover:bg-[#e1eedd] transition-all">
          <ArrowLeft size={16} className="text-[#183a1d]/70" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#183a1d]" style={{ fontFamily: 'Inter, sans-serif' }}>New Budget</h1>
          <p className="text-[#183a1d]/60 text-sm mt-0.5">Plan your CapEx &amp; OpEx line items</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {/* Budget Details */}
      <div className="rounded-xl border border-[#c8d6c0] p-5 space-y-4" style={{ background: '#e1eedd' }}>
        <h2 className="text-sm font-semibold text-[#183a1d]/70 uppercase tracking-wide">Budget Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="text-xs text-[#183a1d]/60 mb-1 block">Project *</label>
            {loadingProjects ? (
              <div className={inputCls + ' text-[#183a1d]/40'}>Loading projects...</div>
            ) : (
              <select value={projectId} onChange={e => handleProjectChange(e.target.value)}
                className={inputCls + ' [&>option]:bg-[#e1eedd]'}>
                <option value="">Select a project...</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-[#183a1d]/60 mb-1 block">Budget Name *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. FY 2026-27 Annual Budget" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-[#183a1d]/60 mb-1 block">Period From *</label>
            <input type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} className={inputCls} />
            {selectedProject?.startDate && <p className="text-[10px] text-[#183a1d]/30 mt-0.5">From project start date</p>}
          </div>
          <div>
            <label className="text-xs text-[#183a1d]/60 mb-1 block">Period To *</label>
            <input type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)} className={inputCls} />
            {selectedProject?.endDate && <p className="text-[10px] text-[#183a1d]/30 mt-0.5">From project end date</p>}
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-[#183a1d]/60 mb-1 block">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Optional notes about this budget..." className={inputCls + ' resize-none'} />
          </div>
        </div>
      </div>

      {/* Budget Lines */}
      <div className="rounded-xl border border-[#c8d6c0] p-5 space-y-4" style={{ background: '#e1eedd' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#183a1d]/70 uppercase tracking-wide">Budget Lines</h2>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-purple-400">CapEx: ${totalCapex.toLocaleString()}</span>
            <span className="text-cyan-400">OpEx: ${totalOpex.toLocaleString()}</span>
            <span className="text-[#183a1d] font-medium">Total: ${totalBudget.toLocaleString()}</span>
          </div>
        </div>

        <div className="space-y-3">
          {lines.map((line, i) => {
            const categories = getCategoriesForType(line.expenseType)
            const categoryKeys = Object.keys(categories)
            const subCategories = line.category ? categories[line.category] || [] : []
            return (
              <div key={line.key} className="rounded-lg border border-[#c8d6c0] p-4 space-y-3" style={{ background: '#e1eedd' }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#183a1d]/40 font-medium">Line {i + 1}</span>
                  <button onClick={() => { if (lines.length > 1) setLines(prev => prev.filter(l => l.key !== line.key)) }}
                    disabled={lines.length <= 1} className="text-[#183a1d]/30 hover:text-red-400 disabled:opacity-30 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-[#183a1d]/60 mb-1 block">Type *</label>
                    <div className="flex rounded-lg overflow-hidden border border-[#c8d6c0]">
                      {(['CAPEX', 'OPEX'] as ExpenseType[]).map(t => (
                        <button key={t} type="button" onClick={() => updateLine(line.key, 'expenseType', t)}
                          className={`flex-1 py-2 text-xs font-medium transition-all ${
                            line.expenseType === t
                              ? t === 'CAPEX' ? 'bg-purple-500/20 text-purple-400' : 'bg-cyan-500/20 text-cyan-400'
                              : 'bg-[#e1eedd] text-[#183a1d]/40 hover:text-[#183a1d]/60'
                          }`}>{t}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-[#183a1d]/60 mb-1 block">Category *</label>
                    <select value={line.category} onChange={e => updateLine(line.key, 'category', e.target.value)}
                      className="w-full bg-[#e1eedd] border border-[#c8d6c0] rounded-lg px-3 py-2 text-sm text-[#183a1d] outline-none focus:border-[#f6c453] transition-all [&>option]:bg-[#e1eedd]">
                      <option value="">Select...</option>
                      {categoryKeys.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[#183a1d]/60 mb-1 block">Sub-category</label>
                    <select value={line.subCategory} onChange={e => updateLine(line.key, 'subCategory', e.target.value)}
                      disabled={subCategories.length === 0}
                      className="w-full bg-[#e1eedd] border border-[#c8d6c0] rounded-lg px-3 py-2 text-sm text-[#183a1d] outline-none focus:border-[#f6c453] transition-all disabled:opacity-40 [&>option]:bg-[#e1eedd]">
                      <option value="">Select...</option>
                      {subCategories.map((s: string) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[#183a1d]/60 mb-1 block">Amount *</label>
                    <div className="flex gap-1.5">
                      <CurrencySelect compact value={line.currency} onChange={v => updateLine(line.key, 'currency', v)} />
                      <input type="number" min="0" step="0.01" value={line.approvedAmount}
                        onChange={e => updateLine(line.key, 'approvedAmount', e.target.value)} placeholder="0.00"
                        className="flex-1 bg-[#e1eedd] border border-[#c8d6c0] rounded-lg px-3 py-2 text-sm text-[#183a1d] placeholder-[#183a1d]/40 outline-none focus:border-[#f6c453] transition-all" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#183a1d]/60 mb-1 block">Description</label>
                  <input value={line.description} onChange={e => updateLine(line.key, 'description', e.target.value)}
                    placeholder="Optional line item description..." className="w-full bg-[#e1eedd] border border-[#c8d6c0] rounded-lg px-3 py-2 text-sm text-[#183a1d] placeholder-[#183a1d]/40 outline-none focus:border-[#f6c453] transition-all" />
                </div>
              </div>
            )
          })}
        </div>
        <button onClick={() => setLines(prev => [...prev, emptyLine()])}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-[#183a1d]/60 hover:text-[#183a1d] border border-dashed border-[#c8d6c0] hover:border-[#c8d6c0] transition-all w-full justify-center">
          <Plus size={14} /> Add Line Item
        </button>
      </div>

      {/* Funding Sources */}
      <div className="rounded-xl border border-[#c8d6c0] p-5 space-y-4" style={{ background: '#e1eedd' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#183a1d]/70 uppercase tracking-wide">Funding Sources</h2>
          <span className="text-xs text-[#183a1d]/60">{fundingSources.length} source{fundingSources.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="space-y-3">
          {fundingSources.map((fs, i) => {
            const subTypes = fs.sourceType ? (FUNDING_SOURCE_TYPES[fs.sourceType] || []) : []
            return (
              <div key={fs.key} className="rounded-lg border border-[#c8d6c0] p-4 space-y-3" style={{ background: '#e1eedd' }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#183a1d]/40 font-medium">Source {i + 1}</span>
                  <button onClick={() => { if (fundingSources.length > 1) setFundingSources(prev => prev.filter(f => f.key !== fs.key)) }}
                    disabled={fundingSources.length <= 1} className="text-[#183a1d]/30 hover:text-red-400 disabled:opacity-30 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-[#183a1d]/60 mb-1 block">Source Type *</label>
                    <select value={fs.sourceType} onChange={e => updateFunding(fs.key, 'sourceType', e.target.value)}
                      className="w-full bg-[#e1eedd] border border-[#c8d6c0] rounded-lg px-3 py-2 text-sm text-[#183a1d] outline-none focus:border-[#f6c453] transition-all [&>option]:bg-[#e1eedd]">
                      <option value="">Select...</option>
                      {FUNDING_SOURCE_TYPE_KEYS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[#183a1d]/60 mb-1 block">Sub-Type</label>
                    <select value={fs.sourceSubType} onChange={e => updateFunding(fs.key, 'sourceSubType', e.target.value)}
                      disabled={subTypes.length === 0}
                      className="w-full bg-[#e1eedd] border border-[#c8d6c0] rounded-lg px-3 py-2 text-sm text-[#183a1d] outline-none focus:border-[#f6c453] transition-all disabled:opacity-40 [&>option]:bg-[#e1eedd]">
                      <option value="">Select...</option>
                      {subTypes.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[#183a1d]/60 mb-1 block">Donor Name *</label>
                    <input value={fs.donorName} onChange={e => updateFunding(fs.key, 'donorName', e.target.value)}
                      placeholder="e.g. USAID, Gates Foundation"
                      className="w-full bg-[#e1eedd] border border-[#c8d6c0] rounded-lg px-3 py-2 text-sm text-[#183a1d] placeholder-[#183a1d]/40 outline-none focus:border-[#f6c453] transition-all" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-[#183a1d]/60 mb-1 block">Amount *</label>
                    <div className="flex gap-1.5">
                      <CurrencySelect compact value={fs.currency} onChange={v => updateFunding(fs.key, 'currency', v)} />
                      <input type="number" min="0" step="0.01" value={fs.amount}
                        onChange={e => updateFunding(fs.key, 'amount', e.target.value)} placeholder="0.00"
                        className="flex-1 bg-[#e1eedd] border border-[#c8d6c0] rounded-lg px-3 py-2 text-sm text-[#183a1d] placeholder-[#183a1d]/40 outline-none focus:border-[#f6c453] transition-all" />
                    </div>
                  </div>
                </div>
                {fs.sourceType === 'Impact Investment' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                    <div>
                      <label className="text-xs text-[#183a1d]/60 mb-1 block">Interest Rate (%)</label>
                      <input type="number" min="0" step="0.01" value={fs.interestRate}
                        onChange={e => updateFunding(fs.key, 'interestRate', e.target.value)} placeholder="e.g. 5.5"
                        className="w-full bg-[#e1eedd] border border-[#c8d6c0] rounded-lg px-3 py-2 text-sm text-[#183a1d] placeholder-[#183a1d]/40 outline-none focus:border-[#f6c453] transition-all" />
                    </div>
                    <div>
                      <label className="text-xs text-[#183a1d]/60 mb-1 block">Loan Term (months)</label>
                      <input type="number" min="1" value={fs.termMonths}
                        onChange={e => updateFunding(fs.key, 'termMonths', e.target.value)} placeholder="e.g. 24"
                        className="w-full bg-[#e1eedd] border border-[#c8d6c0] rounded-lg px-3 py-2 text-sm text-[#183a1d] placeholder-[#183a1d]/40 outline-none focus:border-[#f6c453] transition-all" />
                    </div>
                    <div>
                      <label className="text-xs text-[#183a1d]/60 mb-1 block">Grace Period (months)</label>
                      <input type="number" min="0" value={fs.gracePeriodMonths}
                        onChange={e => updateFunding(fs.key, 'gracePeriodMonths', e.target.value)} placeholder="e.g. 6"
                        className="w-full bg-[#e1eedd] border border-[#c8d6c0] rounded-lg px-3 py-2 text-sm text-[#183a1d] placeholder-[#183a1d]/40 outline-none focus:border-[#f6c453] transition-all" />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <button onClick={() => setFundingSources(prev => [...prev, emptyFunding()])}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-[#183a1d]/60 hover:text-[#183a1d] border border-dashed border-[#c8d6c0] hover:border-[#c8d6c0] transition-all w-full justify-center">
          <Plus size={14} /> Add Funding Source
        </button>

        {/* Funding summary */}
        {totalBudget > 0 && (
          <div className={`rounded-lg border px-4 py-3 flex items-center justify-between ${
            isFullyFunded
              ? 'border-green-400/20 bg-green-400/5'
              : 'border-yellow-400/20 bg-yellow-400/5'
          }`}>
            <div className="flex items-center gap-3 text-sm">
              {isFullyFunded
                ? <><CheckCircle size={16} className="text-green-400" /><span className="text-green-400 font-medium">Fully Funded</span></>
                : <><AlertTriangle size={16} className="text-yellow-400" /><span className="text-yellow-400 font-medium">Gap: ${fundingGap.toLocaleString()}</span></>
              }
            </div>
            <div className="flex items-center gap-4 text-xs text-[#183a1d]/60">
              <span>Required: <span className="text-[#183a1d] font-medium">${totalBudget.toLocaleString()}</span></span>
              <span>Funded: <span className="text-[#183a1d] font-medium">${totalFunded.toLocaleString()}</span></span>
            </div>
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="flex items-center justify-between">
        <Link href="/dashboard/budgets" className="text-sm text-[#183a1d]/60 hover:text-[#183a1d]/70 transition-colors">Cancel</Link>
        <div className="flex items-center gap-3">
          {!isFullyFunded && totalBudget > 0 && (
            <span className="text-xs text-yellow-400/70">Saves as DRAFT (not fully funded)</span>
          )}
          <button onClick={handleSubmit} disabled={saving}
            className="px-6 py-2.5 rounded-lg text-sm font-medium text-[#183a1d] disabled:opacity-50 transition-all bg-[#f6c453] hover:bg-[#f0a04b]">
            {saving ? 'Creating...' : 'Create Budget'}
          </button>
        </div>
      </div>
    </div>
  )
}
