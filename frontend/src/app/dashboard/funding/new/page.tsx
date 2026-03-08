'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, UserPlus } from 'lucide-react'
import { apiGet, apiPost } from '@/lib/api'

interface Donor { id: string; name: string; type: string }

export default function NewFundingPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [donors, setDonors] = useState<Donor[]>([])
  const [showNewDonor, setShowNewDonor] = useState(false)
  const [newDonor, setNewDonor] = useState({ name: '', email: '', type: 'FOUNDATION', organisationName: '' })
  const [form, setForm] = useState({
    title: '', type: 'GRANT', totalAmount: '', currency: 'USD',
    donorId: '', startDate: '', endDate: '', repayable: false,
    interestRate: '', notes: ''
  })

  useEffect(() => {
    apiGet('/api/donors')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(d => setDonors(d.data ?? []))
      .catch(() => {})
  }, [])

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

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
    if (!form.totalAmount || isNaN(parseFloat(form.totalAmount))) { setError('Valid amount is required'); return }
    setSaving(true); setError('')
    try {
      const res = await apiPost('/api/funding-agreements', {
        title: form.title.trim(),
        type: form.type,
        totalAmount: parseFloat(form.totalAmount),
        currency: form.currency,
        donorId: form.donorId || null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        repayable: form.repayable,
        interestRate: form.interestRate ? parseFloat(form.interestRate) : null,
        notes: form.notes || null,
      })
      if (res.ok) { router.push('/dashboard/funding') }
      else { const d = await res.json(); setError(d.error ?? 'Failed to create agreement') }
    } catch { setError('Network error') }
    setSaving(false)
  }

  const inputCls = "w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#0c7aed]/50 transition-all"
  const labelCls = "block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wide"

  return (
    <div className="p-6 max-w-2xl animate-fade-up">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/funding" className="text-white/40 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>New Funding Agreement</h1>
          <p className="text-white/40 text-sm">Track grants, loans, and donations from your funding partners</p>
        </div>
      </div>

      <div className="rounded-xl border border-white/8 p-6 space-y-5"
        style={{ background: 'rgba(255,255,255,0.02)' }}>

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

        <div>
          <label className={labelCls}>Total Amount *</label>
          <input type="number" step="0.01" value={form.totalAmount} onChange={e => set('totalAmount', e.target.value)}
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
            <div className="space-y-3 bg-white/5 border border-white/10 rounded-lg p-4">
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
                className="px-4 py-2 rounded-lg text-sm font-medium text-white"
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

        {/* Repayable toggle */}
        <div className="flex items-center gap-3">
          <button onClick={() => set('repayable', !form.repayable)}
            className={`relative w-10 h-5 rounded-full transition-colors ${form.repayable ? 'bg-[#0c7aed]' : 'bg-white/20'}`}>
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${form.repayable ? 'left-5' : 'left-0.5'}`} />
          </button>
          <span className="text-sm text-white/60">Repayable (loan)</span>
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
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
            <Save size={15} /> {saving ? 'Creating…' : 'Create Agreement'}
          </button>
          <Link href="/dashboard/funding" className="px-5 py-2.5 rounded-lg text-sm text-white/50 hover:text-white transition-colors">
            Cancel
          </Link>
        </div>
      </div>
    </div>
  )
}
