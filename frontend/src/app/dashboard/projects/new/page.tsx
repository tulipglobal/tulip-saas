'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save } from 'lucide-react'

export default function NewProjectPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '', description: '', status: 'active',
    budget: '', currency: 'USD', startDate: '', endDate: ''
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.name.trim()) { setError('Project name is required'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description || null,
          status: form.status,
          budget: form.budget ? parseFloat(form.budget) : null,
          currency: form.currency,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
        })
      })
      if (res.ok) {
        const data = await res.json()
        router.push(`/dashboard/projects/${data.id ?? ''}`)
      } else {
        const d = await res.json()
        setError(d.message ?? 'Failed to create project')
      }
    } catch { setError('Network error — is the backend running?') }
    setSaving(false)
  }

  const inputCls = "w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#0c7aed]/50 focus:bg-white/8 transition-all"
  const labelCls = "block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wide"

  return (
    <div className="p-6 max-w-2xl animate-fade-up">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/projects" className="text-white/40 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>New Project</h1>
          <p className="text-white/40 text-sm">All project data will be blockchain anchored automatically</p>
        </div>
      </div>

      <div className="rounded-xl border border-white/8 p-6 space-y-5"
        style={{ background: 'rgba(255,255,255,0.02)' }}>

        <div>
          <label className={labelCls}>Project Name *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)}
            placeholder="e.g. Clean Water Initiative 2026" className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Description</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)}
            placeholder="Brief description of the project..." rows={3}
            className={inputCls + ' resize-none'} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls}>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
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
          <label className={labelCls}>Budget</label>
          <input type="number" value={form.budget} onChange={e => set('budget', e.target.value)}
            placeholder="0.00" className={inputCls} />
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

        {error && (
          <div className="rounded-lg bg-red-400/10 border border-red-400/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button onClick={submit} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-all"
            style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
            <Save size={15} />
            {saving ? 'Creating…' : 'Create Project'}
          </button>
          <Link href="/dashboard/projects" className="px-5 py-2.5 rounded-lg text-sm text-white/50 hover:text-white transition-colors">
            Cancel
          </Link>
        </div>
      </div>
    </div>
  )
}
