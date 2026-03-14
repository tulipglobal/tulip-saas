'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { apiGet, apiPut, apiPost, apiDelete } from '@/lib/api'
import Link from 'next/link'
import { ArrowLeft, Banknote, Receipt, Edit3, Check, X, Plus, Trash2, AlertTriangle, CheckCircle } from 'lucide-react'
import { FUNDING_SOURCE_TYPES, FUNDING_SOURCE_TYPE_KEYS } from '@/lib/ngo-categories'
import CurrencySelect from '@/components/CurrencySelect'

interface BudgetLine {
  id: string
  expenseType: string
  category: string
  subCategory: string | null
  description: string | null
  approvedAmount: number
  currency: string
  spent: number
  remaining: number
}

interface BudgetFundingSource {
  id: string
  sourceType: string
  sourceSubType: string | null
  donorName: string
  amount: number
  currency: string
  agreementHash: string | null
  createdAt: string
}

interface ExpenseItem {
  id: string
  description: string
  amount: number
  currency: string
  expenseType: string | null
  category: string | null
  subCategory: string | null
  budgetLineId: string | null
  createdAt: string
  approvalStatus: string
  project: { id: string; name: string }
}

interface BudgetDetail {
  id: string
  name: string
  periodFrom: string
  periodTo: string
  status: string
  notes: string | null
  createdAt: string
  project: { id: string; name: string } | null
  lines: BudgetLine[]
  fundingSources: BudgetFundingSource[]
  fundingAgreements: any[]
  expenses: ExpenseItem[]
  totalApproved: number
  totalSpent: number
  totalFunded: number
  remaining: number
}

const STATUS_OPTIONS = ['DRAFT', 'APPROVED', 'ACTIVE', 'CLOSED']

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT:    'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
    APPROVED: 'bg-[#f6c453]/10 text-[#183a1d] border-[#f6c453]/30',
    ACTIVE:   'bg-green-400/10 text-green-400 border-green-400/20',
    CLOSED:   'bg-[#e1eedd] text-[#183a1d]/60 border-[#c8d6c0]',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium ${map[status] ?? map.DRAFT}`}>
      {status}
    </span>
  )
}

function FundingBadge({ totalApproved, totalFunded }: { totalApproved: number; totalFunded: number }) {
  if (totalApproved <= 0) return null
  if (totalFunded >= totalApproved) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium bg-green-400/10 text-green-400 border-green-400/20">
      <CheckCircle size={10} /> Fully Funded
    </span>
  )
  if (totalFunded > 0) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium bg-yellow-400/10 text-yellow-400 border-yellow-400/20">
      <AlertTriangle size={10} /> Partially Funded
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium bg-red-400/10 text-red-400 border-red-400/20">
      Unfunded
    </span>
  )
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const inputCls = "w-full bg-[#e1eedd] border border-[#c8d6c0] rounded-lg px-3 py-2 text-sm text-[#183a1d] placeholder-[#183a1d]/40 outline-none focus:border-[#f6c453] transition-all [&>option]:bg-[#e1eedd]"

export default function BudgetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [budget, setBudget] = useState<BudgetDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingStatus, setEditingStatus] = useState(false)
  const [newStatus, setNewStatus] = useState('')
  const [statusError, setStatusError] = useState('')

  // Inline add funding source
  const [showAddFunding, setShowAddFunding] = useState(false)
  const [newFunding, setNewFunding] = useState({ sourceType: '', sourceSubType: '', donorName: '', amount: '', currency: 'USD', interestRate: '', interestType: 'FIXED', gracePeriodMonths: '', termMonths: '', autoGenerateSchedule: true, donorOrgId: '' })
  const [addingFunding, setAddingFunding] = useState(false)
  const [donorOrgs, setDonorOrgs] = useState<{ id: string; name: string }[]>([])
  const [donorMode, setDonorMode] = useState<'existing' | 'external'>('existing')

  const reload = () => {
    apiGet(`/api/budgets/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setBudget(d); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { reload() }, [id])
  useEffect(() => {
    apiGet('/api/donor/organisations').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.data) setDonorOrgs(d.data)
    }).catch(() => {})
  }, [])

  const handleStatusChange = async () => {
    if (!budget || !newStatus) return
    setStatusError('')
    const res = await apiPut(`/api/budgets/${id}`, { status: newStatus })
    if (res.ok) {
      setBudget(prev => prev ? { ...prev, status: newStatus } : prev)
      setEditingStatus(false)
    } else {
      const d = await res.json().catch(() => ({}))
      setStatusError(d.error || 'Failed to update status')
    }
  }

  const handleAddFunding = async () => {
    const isImpact = newFunding.sourceType === 'Impact Investment'
    const donorNameValid = isImpact
      ? (donorMode === 'existing' ? !!newFunding.donorOrgId : !!newFunding.donorName)
      : !!newFunding.donorName
    if (!newFunding.sourceType || !donorNameValid || !newFunding.amount) return
    setAddingFunding(true)
    const payload: Record<string, any> = { ...newFunding }
    if (isImpact) {
      payload.interestRate = newFunding.interestRate ? Number(newFunding.interestRate) : null
      payload.interestType = newFunding.interestType
      payload.gracePeriodMonths = newFunding.gracePeriodMonths ? Number(newFunding.gracePeriodMonths) : null
      payload.termMonths = newFunding.termMonths ? Number(newFunding.termMonths) : null
      payload.autoGenerateSchedule = newFunding.autoGenerateSchedule
      if (donorMode === 'existing') {
        payload.donorOrgId = newFunding.donorOrgId
        const org = donorOrgs.find(o => o.id === newFunding.donorOrgId)
        payload.donorName = org?.name || ''
      } else {
        payload.donorOrgId = null
      }
    }
    const res = await apiPost(`/api/budgets/${id}/funding-sources`, payload)
    if (res.ok) {
      setNewFunding({ sourceType: '', sourceSubType: '', donorName: '', amount: '', currency: 'USD', interestRate: '', interestType: 'FIXED', gracePeriodMonths: '', termMonths: '', autoGenerateSchedule: true, donorOrgId: '' })
      setShowAddFunding(false)
      reload()
    }
    setAddingFunding(false)
  }

  const handleRemoveFunding = async (sourceId: string) => {
    await apiDelete(`/api/budgets/${id}/funding-sources/${sourceId}`)
    reload()
  }

  if (loading) return <div className="p-8 text-center text-[#183a1d]/40">Loading...</div>
  if (!budget) return <div className="p-8 text-center text-[#183a1d]/40">Budget not found</div>

  const fundingPct = budget.totalApproved > 0 ? Math.round((budget.totalFunded / budget.totalApproved) * 100) : 0
  const spentPct = budget.totalApproved > 0 ? Math.round((budget.totalSpent / budget.totalApproved) * 100) : 0
  const fundingGap = budget.totalApproved - budget.totalFunded
  const isFullyFunded = budget.totalApproved > 0 && fundingGap <= 0
  const subTypes = newFunding.sourceType ? (FUNDING_SOURCE_TYPES[newFunding.sourceType] || []) : []

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/dashboard/budgets" className="w-9 h-9 rounded-lg bg-[#e1eedd] border border-[#c8d6c0] flex items-center justify-center hover:bg-[#e1eedd] transition-all mt-1">
          <ArrowLeft size={16} className="text-[#183a1d]/70" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-[#183a1d]" style={{ fontFamily: 'Inter, sans-serif' }}>{budget.name}</h1>
            {editingStatus ? (
              <div className="flex items-center gap-1">
                <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
                  className="bg-[#e1eedd] border border-[#c8d6c0] rounded-lg px-2 py-1 text-xs text-[#183a1d] outline-none [&>option]:bg-[#e1eedd]">
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button onClick={handleStatusChange} className="text-green-400 hover:text-green-300"><Check size={14} /></button>
                <button onClick={() => { setEditingStatus(false); setStatusError('') }} className="text-[#183a1d]/40 hover:text-[#183a1d]/60"><X size={14} /></button>
              </div>
            ) : (
              <button onClick={() => { setEditingStatus(true); setNewStatus(budget.status) }} className="flex items-center gap-1 group">
                <StatusBadge status={budget.status} />
                <Edit3 size={12} className="text-[#183a1d]/30 group-hover:text-[#183a1d]/60" />
              </button>
            )}
            <FundingBadge totalApproved={budget.totalApproved} totalFunded={budget.totalFunded} />
          </div>
          {statusError && <p className="text-xs text-red-400 mt-1">{statusError}</p>}
          <p className="text-[#183a1d]/60 text-sm mt-1">
            {formatDate(budget.periodFrom)} – {formatDate(budget.periodTo)}
            {budget.project && <> · <Link href={`/dashboard/projects/${budget.project.id}`} className="text-cyan-400/60 hover:text-cyan-400">{budget.project.name}</Link></>}
            {budget.notes && <span className="ml-2 text-[#183a1d]/40">· {budget.notes}</span>}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Budget Required', value: `$${budget.totalApproved.toLocaleString()}`, color: 'text-[#183a1d]' },
          { label: 'Total Funded', value: `$${budget.totalFunded.toLocaleString()}`, sub: `${fundingPct}%`, color: isFullyFunded ? 'text-green-400' : 'text-yellow-400' },
          { label: 'Total Spent', value: `$${budget.totalSpent.toLocaleString()}`, sub: `${spentPct}%`, color: 'text-orange-400' },
          { label: 'Remaining', value: `$${budget.remaining.toLocaleString()}`, color: budget.remaining >= 0 ? 'text-green-400' : 'text-red-400' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="rounded-xl border border-[#c8d6c0] px-5 py-4" style={{ background: '#e1eedd' }}>
            <div className={`text-lg font-bold ${color}`} style={{ fontFamily: 'Inter, sans-serif' }}>
              {value} {sub && <span className="text-xs font-normal text-[#183a1d]/40">{sub}</span>}
            </div>
            <div className="text-xs text-[#183a1d]/60 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* 1. Budget Lines */}
      <div className="rounded-xl border border-[#c8d6c0] overflow-hidden" style={{ background: '#e1eedd' }}>
        <div className="px-5 py-3 border-b border-[#c8d6c0] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#183a1d]/70 uppercase tracking-wide">Budget Lines</h2>
          <span className="text-xs text-[#183a1d]/40">{budget.lines.length} line{budget.lines.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="hidden lg:grid grid-cols-[1fr_1.5fr_1fr_1fr_1fr_1fr] gap-4 px-5 py-2 border-b border-[#c8d6c0] text-xs text-[#183a1d]/40 uppercase tracking-wide">
          <span>Type</span><span>Category</span><span>Approved</span><span>Spent</span><span>Remaining</span><span>Usage</span>
        </div>
        <div className="divide-y divide-[#c8d6c0]">
          {budget.lines.map(line => {
            const pct = line.approvedAmount > 0 ? Math.min(100, Math.round((line.spent / line.approvedAmount) * 100)) : 0
            return (
              <div key={line.id} className="px-5 py-3 lg:grid lg:grid-cols-[1fr_1.5fr_1fr_1fr_1fr_1fr] lg:gap-4 lg:items-center">
                <div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium ${
                    line.expenseType === 'CAPEX' ? 'bg-purple-400/10 text-purple-400 border-purple-400/20' : 'bg-cyan-400/10 text-cyan-400 border-cyan-400/20'
                  }`}>{line.expenseType}</span>
                </div>
                <div>
                  <div className="text-sm text-[#183a1d]">{line.category}</div>
                  {line.subCategory && <div className="text-xs text-[#183a1d]/40">{line.subCategory}</div>}
                  {line.description && <div className="text-xs text-[#183a1d]/30 italic">{line.description}</div>}
                </div>
                <div className="text-sm text-[#183a1d] font-medium">{line.currency} {line.approvedAmount.toLocaleString()}</div>
                <div className="text-sm text-orange-400">{line.currency} {line.spent.toLocaleString()}</div>
                <div className={`text-sm font-medium ${line.remaining >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {line.currency} {line.remaining.toLocaleString()}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-[#e1eedd] overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{
                      width: `${pct}%`,
                      background: pct > 90 ? '#f87171' : pct > 70 ? '#fbbf24' : '#34d399'
                    }} />
                  </div>
                  <span className="text-xs text-[#183a1d]/60 w-8 text-right">{pct}%</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 2. Funding Sources */}
      <div className="rounded-xl border border-[#c8d6c0] overflow-hidden" style={{ background: '#e1eedd' }}>
        <div className="px-5 py-3 border-b border-[#c8d6c0] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#183a1d]/70 uppercase tracking-wide flex items-center gap-2">
            <Banknote size={14} /> Funding Sources
          </h2>
          <div className="flex items-center gap-3">
            <FundingBadge totalApproved={budget.totalApproved} totalFunded={budget.totalFunded} />
            <button onClick={() => setShowAddFunding(true)}
              className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
              <Plus size={12} /> Add
            </button>
          </div>
        </div>

        {budget.fundingSources.length === 0 && !showAddFunding ? (
          <div className="px-5 py-6 text-center text-[#183a1d]/40 text-sm">
            No funding sources yet.{' '}
            <button onClick={() => setShowAddFunding(true)} className="text-cyan-400 hover:text-cyan-300">Add one</button>
          </div>
        ) : (
          <div className="divide-y divide-[#c8d6c0]">
            {budget.fundingSources.map(f => (
              <div key={f.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <div className="text-sm text-[#183a1d]">{f.donorName}</div>
                  <div className="text-xs text-[#183a1d]/40">
                    {f.sourceType}{f.sourceSubType ? ` / ${f.sourceSubType}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-[#183a1d]">{f.currency} {f.amount.toLocaleString()}</span>
                  <button onClick={() => handleRemoveFunding(f.id)}
                    className="text-[#183a1d]/30 hover:text-red-400 transition-colors" title="Remove">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Inline add form */}
        {showAddFunding && (
          <div className="px-5 py-4 border-t border-[#c8d6c0] space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-[#183a1d]/60 mb-1 block">Source Type *</label>
                <select value={newFunding.sourceType} onChange={e => setNewFunding(p => ({ ...p, sourceType: e.target.value, sourceSubType: '' }))}
                  className={inputCls}>
                  <option value="">Select...</option>
                  {FUNDING_SOURCE_TYPE_KEYS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#183a1d]/60 mb-1 block">Sub-Type</label>
                <select value={newFunding.sourceSubType} onChange={e => setNewFunding(p => ({ ...p, sourceSubType: e.target.value }))}
                  disabled={subTypes.length === 0} className={inputCls + ' disabled:opacity-40'}>
                  <option value="">Select...</option>
                  {subTypes.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                {newFunding.sourceType === 'Impact Investment' ? (
                  <>
                    <label className="text-xs text-[#183a1d]/60 mb-1 block">Investor *</label>
                    <div className="flex rounded-lg overflow-hidden border border-[#c8d6c0] mb-2">
                      {(['existing', 'external'] as const).map(m => (
                        <button key={m} onClick={() => { setDonorMode(m); setNewFunding(p => ({ ...p, donorOrgId: '', donorName: '' })) }}
                          className="flex-1 px-3 py-1.5 text-[11px] font-medium transition-all"
                          style={{ background: donorMode === m ? '#183a1d' : '#e1eedd', color: donorMode === m ? '#fefbe9' : '#183a1d' }}>
                          {m === 'existing' ? 'Existing Donor' : 'External Investor'}
                        </button>
                      ))}
                    </div>
                    {donorMode === 'existing' ? (
                      <select value={newFunding.donorOrgId} onChange={e => setNewFunding(p => ({ ...p, donorOrgId: e.target.value }))}
                        className={inputCls}>
                        <option value="">Select donor org...</option>
                        {donorOrgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                    ) : (
                      <input value={newFunding.donorName} onChange={e => setNewFunding(p => ({ ...p, donorName: e.target.value }))}
                        placeholder="Investor name (no portal access)" className={inputCls} />
                    )}
                  </>
                ) : (
                  <>
                    <label className="text-xs text-[#183a1d]/60 mb-1 block">Donor Name *</label>
                    <input value={newFunding.donorName} onChange={e => setNewFunding(p => ({ ...p, donorName: e.target.value }))}
                      placeholder="e.g. USAID" className={inputCls} />
                  </>
                )}
              </div>
              <div>
                <label className="text-xs text-[#183a1d]/60 mb-1 block">Amount *</label>
                <div className="flex gap-1.5">
                  <CurrencySelect compact value={newFunding.currency} onChange={v => setNewFunding(p => ({ ...p, currency: v }))} />
                  <input type="number" min="0" step="0.01" value={newFunding.amount}
                    onChange={e => setNewFunding(p => ({ ...p, amount: e.target.value }))} placeholder="0.00"
                    className="flex-1 bg-[#e1eedd] border border-[#c8d6c0] rounded-lg px-3 py-2 text-sm text-[#183a1d] placeholder-[#183a1d]/40 outline-none focus:border-[#f6c453] transition-all" />
                </div>
              </div>
            </div>
            {newFunding.sourceType === 'Impact Investment' && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-[#183a1d]/60 mb-1 block">Interest Rate (% p.a.)</label>
                  <input type="number" min="0" step="0.01" value={newFunding.interestRate}
                    onChange={e => setNewFunding(p => ({ ...p, interestRate: e.target.value }))} placeholder="e.g. 5.5"
                    className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-[#183a1d]/60 mb-1 block">Interest Type</label>
                  <div className="flex rounded-lg overflow-hidden border border-[#c8d6c0]">
                    {(['FIXED', 'VARIABLE'] as const).map(t => (
                      <button key={t} onClick={() => setNewFunding(p => ({ ...p, interestType: t }))}
                        className="flex-1 px-3 py-2 text-xs font-medium transition-all"
                        style={{ background: newFunding.interestType === t ? '#183a1d' : '#e1eedd', color: newFunding.interestType === t ? '#fefbe9' : '#183a1d' }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#183a1d]/60 mb-1 block">Grace Period (months)</label>
                  <input type="number" min="0" value={newFunding.gracePeriodMonths}
                    onChange={e => setNewFunding(p => ({ ...p, gracePeriodMonths: e.target.value }))} placeholder="e.g. 6"
                    className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-[#183a1d]/60 mb-1 block">Term (months)</label>
                  <input type="number" min="1" value={newFunding.termMonths}
                    onChange={e => setNewFunding(p => ({ ...p, termMonths: e.target.value }))} placeholder="e.g. 24"
                    className={inputCls} />
                </div>
              </div>
            )}
            {newFunding.sourceType === 'Impact Investment' && Number(newFunding.termMonths) > 0 && (
              <div>
                <label className="text-xs text-[#183a1d]/60 mb-1 block">Auto-generate repayment schedule</label>
                <div className="flex rounded-lg overflow-hidden border border-[#c8d6c0] w-fit">
                  {([true, false] as const).map(v => (
                    <button key={String(v)} onClick={() => setNewFunding(p => ({ ...p, autoGenerateSchedule: v }))}
                      className="px-4 py-1.5 text-xs font-medium transition-all"
                      style={{ background: newFunding.autoGenerateSchedule === v ? '#183a1d' : '#e1eedd', color: newFunding.autoGenerateSchedule === v ? '#fefbe9' : '#183a1d' }}>
                      {v ? 'Yes' : 'No'}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <button onClick={handleAddFunding} disabled={addingFunding || !newFunding.sourceType || !newFunding.amount || (newFunding.sourceType === 'Impact Investment' ? (donorMode === 'existing' ? !newFunding.donorOrgId : !newFunding.donorName) : !newFunding.donorName)}
                className="px-4 py-1.5 rounded-lg text-xs font-medium text-[#183a1d] disabled:opacity-40 transition-all bg-[#f6c453] hover:bg-[#f0a04b]">
                {addingFunding ? 'Adding...' : 'Add Source'}
              </button>
              <button onClick={() => setShowAddFunding(false)} className="px-4 py-1.5 text-xs text-[#183a1d]/60 hover:text-[#183a1d]/70">Cancel</button>
            </div>
          </div>
        )}

        {/* Funding gap summary */}
        {budget.totalApproved > 0 && (
          <div className={`mx-5 mb-4 mt-2 rounded-lg border px-4 py-2.5 flex items-center justify-between text-sm ${
            isFullyFunded ? 'border-green-400/20 bg-green-400/5' : 'border-yellow-400/20 bg-yellow-400/5'
          }`}>
            <div className="flex items-center gap-2">
              {isFullyFunded
                ? <><CheckCircle size={14} className="text-green-400" /><span className="text-green-400 font-medium">Fully Funded</span></>
                : <><AlertTriangle size={14} className="text-yellow-400" /><span className="text-yellow-400 font-medium">Gap: ${fundingGap.toLocaleString()}</span></>
              }
            </div>
            <span className="text-xs text-[#183a1d]/60">
              Required ${budget.totalApproved.toLocaleString()} · Funded ${budget.totalFunded.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* 3. Expenses */}
      <div className="rounded-xl border border-[#c8d6c0] overflow-hidden" style={{ background: '#e1eedd' }}>
        <div className="px-5 py-3 border-b border-[#c8d6c0] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#183a1d]/70 uppercase tracking-wide flex items-center gap-2">
            <Receipt size={14} /> Expenses
          </h2>
          <span className="text-xs text-[#183a1d]/40">{budget.expenses.length} expense{budget.expenses.length !== 1 ? 's' : ''}</span>
        </div>
        {budget.expenses.length === 0 ? (
          <div className="px-5 py-6 text-center text-[#183a1d]/40 text-sm">
            No expenses recorded against this budget yet.
          </div>
        ) : (
          <div className="divide-y divide-[#c8d6c0]">
            {budget.expenses.slice(0, 20).map(e => (
              <div key={e.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <div className="text-sm text-[#183a1d]">{e.description}</div>
                  <div className="text-xs text-[#183a1d]/40">
                    {e.project.name} · {e.category ?? 'Uncategorised'}
                    {e.subCategory && ` / ${e.subCategory}`}
                    <span className="ml-2">{formatDate(e.createdAt)}</span>
                  </div>
                </div>
                <div className="text-sm font-medium text-[#183a1d]">{e.currency} {e.amount.toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
