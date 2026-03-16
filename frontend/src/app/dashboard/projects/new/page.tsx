'use client'

import { useState } from 'react'
import { apiPost } from '@/lib/api'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, CheckCircle } from 'lucide-react'
import DocumentUploadSection from '@/components/DocumentUploadSection'
import { useTranslations } from 'next-intl'

export default function NewProjectPage() {
  const router = useRouter()
  const t = useTranslations()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '', description: '', status: 'active',
    startDate: '', endDate: ''
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.name.trim()) { setError(t('projects.nameRequired')); return }
    setSaving(true); setError('')
    try {
      const res = await apiPost('/api/projects', {
        name: form.name.trim(),
        description: form.description || null,
        status: form.status,
        ...(form.startDate && { startDate: form.startDate }),
        ...(form.endDate && { endDate: form.endDate }),
      })
      if (res.ok) {
        const data = await res.json()
        setSavedProjectId(data.id)
      } else {
        const d = await res.json()
        setError(d.message ?? 'Failed to create project')
      }
    } catch { setError('Network error — is the backend running?') }
    setSaving(false)
  }

  const inputCls = "w-full bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-4 py-2.5 text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none focus:border-[var(--tulip-gold)] focus:bg-[var(--tulip-sage)] transition-all"
  const labelCls = "block text-xs font-medium text-[var(--tulip-forest)]/60 mb-1.5 uppercase tracking-wide"

  return (
    <div className="p-6 max-w-2xl animate-fade-up">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/projects" className="text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)] transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[var(--tulip-forest)]" style={{ fontFamily: 'Inter, sans-serif' }}>{t('projects.newProject')}</h1>
          <p className="text-[var(--tulip-forest)]/60 text-sm">{t('projects.projectAnchored')}</p>
        </div>
      </div>

      <div className="space-y-4">
        {!savedProjectId ? (
          <div className="rounded-xl border border-[var(--tulip-sage-dark)] p-6 space-y-5"
            style={{ background: 'var(--tulip-sage)' }}>

            <div>
              <label className={labelCls}>{t('projects.projectName')}</label>
              <input value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="e.g. Clean Water Initiative 2026" className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>{t('projects.description')}</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)}
                placeholder="Brief description of the project..." rows={3}
                className={inputCls + ' resize-none'} />
            </div>

            <div>
              <label className={labelCls}>{t('projects.status')}</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls}>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{t('projects.startDate')}</label>
                <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t('projects.endDate')}</label>
                <input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} className={inputCls} />
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-400/10 border border-red-400/20 px-4 py-3 text-sm text-red-400">{error}</div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button onClick={submit} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-[var(--tulip-forest)] disabled:opacity-50 transition-all bg-[var(--tulip-gold)] hover:bg-[var(--tulip-orange)]">
                <Save size={15} />
                {saving ? t('common.creating') : t('projects.createProject')}
              </button>
              <Link href="/dashboard/projects" className="px-5 py-2.5 rounded-lg text-sm text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)] transition-colors">
                {t('common.cancel')}
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 px-5 py-4 flex items-center gap-3">
            <CheckCircle size={16} className="text-green-400" />
            <p className="text-sm text-green-400 font-medium">{t('projects.createdAnchored')}</p>
          </div>
        )}

        {savedProjectId && (
          <>
            <DocumentUploadSection entityType="project" entityId={savedProjectId} />
            <div className="flex items-center gap-3">
              <button onClick={() => router.push(`/dashboard/projects/${savedProjectId}`)}
                className="px-5 py-2.5 rounded-lg text-sm font-medium text-[var(--tulip-forest)] bg-[var(--tulip-gold)] hover:bg-[var(--tulip-orange)]">
                {t('projects.viewProject')}
              </button>
              <button onClick={() => router.push('/dashboard/projects/new')}
                className="px-5 py-2.5 rounded-lg text-sm text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)] transition-colors">
                {t('projects.createAnother')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
