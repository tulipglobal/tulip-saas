'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, UserPlus } from 'lucide-react'
import { apiGet, apiPost } from '@/lib/api'
import { FUNDING_SOURCE_TYPES, FUNDING_SOURCE_TYPE_KEYS } from '@/lib/ngo-categories'

interface Donor { id: string; name: string; type: string }
interface BudgetOption { id: string; name: string; status: string; totalApproved: number }

export default function NewFundingPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [donors, setDonors] = useState<Donor[]>([])
  const [budgets, setBudgets] = useState<BudgetOption[]>([])
  const [showNewDonor, setShowNewDonor] = useState(false)
  const [newDonor, setNewDonor] = useState({ name: '', email: '', type: 'FOUNDATION', organisationName: '' })
  const [form, setForm] = useState({
    title: '', type: 'GRANT', totalAmount: '', currency: 'USD',
    donorId: '', budgetId: '', startDate: '', endDate: '', repayable: false,
    interestRate: '', notes: '',
    sourceType: '', sourceSubType: '',
    grantorName: '', grantRef: '', grantFrom: '', grantTo: '',
    restricted: false, capexBudget: '', opexBudget: '',
  })

  useEffect(() => {
    apiGet('/api/donors')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(d => setDonors(d.data ?? []))
      .catch(() => {})
    apiGet('/api/budgets?limit=100')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(d => setBudgets((d.data ?? []).filter((b: BudgetOption) => b.status !== 'CLOSED')))
      .catch(() => {})
  }, [])

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  const subTypes = useMemo(() => {
    if (!form.sourceType) return []
    return FUNDING_SOURCE_TYPES[form.sourceType] ?? []
  }, [form.sourceType])

  const totalBudget = useMemo(() => {
    const capex = parseFloat(form.capexBudget) || 0
    const opex = parseFloat(form.opexBudget) || 0
    return capex + opex
  }, [form.capexBudget, form.opexBudget])

  const createDonor = async () => {
    if (!newDonor.name.trim()) return
    try {
      const res = await apiPost('/api/donors', {
        name: newDonor.name.trim(),
        email: newDonor.email || null,
        type: newDonor.type,
        organisationName: newDonor.organisationName || newDonor.name.trim(),
      })
      if (res.ok) {
        const d = await res.json()
        setDonors(prev => [d, ...prev])
        setForm(f => ({ ...f, donorId: d.id }))
        setShowNewDonor(false)
        setNewDonor({ name: '', email: '', type: 'FOUNDATION', organisationName: '' })
      }
    } catch {}
  }

  const submit = async () => {
    if (!form.title.trim()) { setError('Title is required'); return }
    const total = parseFloat(form.totalAmount) || totalBudget
    if (!total) { setError('Valid amount is required (enter total or CapEx/OpEx split)'); return }
    setSaving(true); setError('')
    try {
      const res = await apiPost('/api/funding-agreements', {
        title: form.title.trim(),
        type: form.type,
        totalAmount: total,
        currency: form.currency,
        donorId: form.donorId || null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        repayable: form.repayable,
        interestRate: form.interestRate ? parseFloat(form.interestRate) : null,
        notes: form.notes || null,
        budgetId: form.budgetId || null,
        sourceType: form.sourceType || null,
        sourceSubType: form.sourceSubType || null,
        grantorName: form.grantorName || null,
        grantRef: form.grantRef || null,
        grantFrom: form.grantFrom || null,
        grantTo: form.grantTo || null,
        restricted: form.restricted,
        capexBudget: parseFloat(form.capexBudget) || 0,
        opexBudget: parseFloat(form.opexBudget) || 0,
      })
      if (res.ok) { router.push('/dashboard/funding') }
      else { const d = await res.json(); setError(d.error ?? 'Failed to create agreement') }
    } catch { setError('Network error') }
    setSaving(false)
  }

  const inputCls = "w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#0c7aed]/50 transition-all"
  const labelCls = "block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide"

  return (
    <div className="p-6 max-w-2xl animate-fade-up">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/funding" className="text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Syne, sans-serif' }}>New Funding Agreement</h1>
          <p className="text-gray-500 text-sm">Track grants, loans, and donations from your funding partners</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 p-6 space-y-5"
        style={{ background: '#FFFFFF' }}>

        <div>
          <label className={labelCls}>Title *</label>
          <input value={form.title} onChange={e => set('title', e.target.value)}
            placeholder="e.g. USAID Clean Water Grant 2026" className={inputCls} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Type</label>
            <select value={form.type} onChange={e => set('type', e.target.value)} className={inputCls}>
              <option value="GRANT">Grant</option>
              <option value="LOAN">Loan</option>
              <option value="DONATION">Donation</option>
              <option value="EQUITY">Equity</option>
              <option value="IN_KIND">In-Kind</option>
            </select>
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

        {/* Funding Source Type */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Source Type</label>
            <select value={form.sourceType}
              onChange={e => { set('sourceType', e.target.value); set('sourceSubType', '') }}
              className={inputCls}>
              <option value="">Select source type</option>
              {FUNDING_SOURCE_TYPE_KEYS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Source Sub-Type</label>
            <select value={form.sourceSubType} onChange={e => set('sourceSubType', e.target.value)}
              className={inputCls} disabled={!form.sourceType}>
              <option value="">Select sub-type</option>
              {subTypes.map(st => <option key={st} value={st}>{st}</option>)}
            </select>
          </div>
        </div>

        {/* Link to Budget */}
        <div>
          <label className={labelCls}>Link to Budget</label>
          <select value={form.budgetId} onChange={e => set('budgetId', e.target.value)} className={inputCls}>
            <option value="">No budget linked</option>
            {budgets.map(b => <option key={b.id} value={b.id}>{b.name} ({b.status}) — ${b.totalApproved?.toLocaleString()}</option>)}
          </select>
        </div>

        {/* Budget: CapEx / OpEx Split */}
        <div className="rounded-lg border border-gray-200 p-4 space-y-3 bg-gray-50">
          <label className={labelCls + ' mb-0'}>Budget Split</label>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-gray-400 mb-1 block">CapEx Budget</label>
              <input type="number" step="0.01" value={form.capexBudget}
                onChange={e => set('capexBudget', e.target.value)}
                placeholder="0.00" className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 mb-1 block">OpEx Budget</label>
              <input type="number" step="0.01" value={form.opexBudget}
                onChange={e => set('opexBudget', e.target.value)}
                placeholder="0.00" className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 mb-1 block">Total Budget</label>
              <div className={inputCls + ' bg-gray-50 cursor-default'}>
                {form.currency} {totalBudget.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>

        <div>
          <label className={labelCls}>Total Amount * {totalBudget > 0 && <span className="text-gray-300 normal-case">(auto-filled from budget)</span>}</label>
          <input type="number" step="0.01"
            value={form.totalAmount || (totalBudget > 0 ? totalBudget.toString() : '')}
            onChange={e => set('totalAmount', e.target.value)}
            placeholder="0.00" className={inputCls} />
        </div>

        {/* Donor selection */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className={labelCls + ' mb-0'}>Donor</label>
            <button onClick={() => setShowNewDonor(!showNewDonor)}
              className="text-xs text-[#369bff] hover:text-cyan-300 flex items-center gap-1">
              <UserPlus size={12} /> {showNewDonor ? 'Select existing' : 'Add new donor'}
            </button>
          </div>
          {showNewDonor ? (
            <div className="space-y-3 bg-gray-50 border border-gray-200 rounded-lg p-4">
              <input value={newDonor.name} onChange={e => setNewDonor(d => ({ ...d, name: e.target.value }))}
                placeholder="Donor name *" className={inputCls} />
              <div className="grid grid-cols-2 gap-3">
                <input value={newDonor.email} onChange={e => setNewDonor(d => ({ ...d, email: e.target.value }))}
                  placeholder="Email (optional)" className={inputCls} />
                <select value={newDonor.type} onChange={e => setNewDonor(d => ({ ...d, type: e.target.value }))} className={inputCls}>
                  <option value="FOUNDATION">Foundation</option>
                  <option value="GOVERNMENT">Government</option>
                  <option value="CORPORATE">Corporate</option>
                  <option value="INDIVIDUAL">Individual</option>
                  <option value="MULTILATERAL">Multilateral</option>
                </select>
              </div>
              <button onClick={createDonor}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-900"
                style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
                Create Donor
              </button>
            </div>
          ) : (
            <select value={form.donorId} onChange={e => set('donorId', e.target.value)} className={inputCls}>
              <option value="">No donor selected</option>
              {donors.map(d => <option key={d.id} value={d.id}>{d.name} ({d.type})</option>)}
            </select>
          )}
        </div>

        {/* Grant details */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Grantor/Donor Name</label>
            <input value={form.grantorName} onChange={e => set('grantorName', e.target.value)}
              placeholder="e.g. World Bank" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Grant Reference</label>
            <input value={form.grantRef} onChange={e => set('grantRef', e.target.value)}
              placeholder="e.g. GRT-2026-001" className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Grant Period From</label>
            <input type="date" value={form.grantFrom} onChange={e => set('grantFrom', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Grant Period To</label>
            <input type="date" value={form.grantTo} onChange={e => set('grantTo', e.target.value)} className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Start Date</label>
            <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>End Date</label>
            <input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} className={inputCls} />
          </div>
        </div>

        {/* Toggles */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <button onClick={() => set('restricted', !form.restricted)}
              className={`relative w-10 h-5 rounded-full transition-colors ${form.restricted ? 'bg-[#0c7aed]' : 'bg-gray-500'}`}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${form.restricted ? 'left-5' : 'left-0.5'}`} />
            </button>
            <span className="text-sm text-gray-600">Restricted</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => set('repayable', !form.repayable)}
              className={`relative w-10 h-5 rounded-full transition-colors ${form.repayable ? 'bg-[#0c7aed]' : 'bg-gray-500'}`}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${form.repayable ? 'left-5' : 'left-0.5'}`} />
            </button>
            <span className="text-sm text-gray-600">Repayable (loan)</span>
          </div>
        </div>

        {form.repayable && (
          <div>
            <label className={labelCls}>Interest Rate (%)</label>
            <input type="number" step="0.01" value={form.interestRate} onChange={e => set('interestRate', e.target.value)}
              placeholder="e.g. 2.5" className={inputCls} />
          </div>
        )}

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
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-gray-900 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
            <Save size={15} /> {saving ? 'Creating...' : 'Create Agreement'}
          </button>
          <Link href="/dashboard/funding" className="px-5 py-2.5 rounded-lg text-sm text-gray-500 hover:text-gray-900 transition-colors">
            Cancel
          </Link>
        </div>
      </div>
    </div>
  )
}
