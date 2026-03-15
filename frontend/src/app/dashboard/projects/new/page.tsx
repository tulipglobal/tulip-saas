'use client'

import { useState, useEffect } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, CheckCircle, Building2, Globe, Mail } from 'lucide-react'
import DocumentUploadSection from '@/components/DocumentUploadSection'
import { useTranslations } from 'next-intl'
import { FUNDING_SOURCE_TYPE_KEYS } from '@/lib/ngo-categories'

interface DonorOrg { id: string; name: string; type: string; country: string | null }

export default function NewProjectPage() {
  const router = useRouter()
  const t = useTranslations()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null)
  const [donorOrgs, setDonorOrgs] = useState<DonorOrg[]>([])
  const [funderOption, setFunderOption] = useState<'portal' | 'invite' | 'other'>('portal')
  const [inviteForm, setInviteForm] = useState({ orgName: '', email: '' })
  const [form, setForm] = useState({
    name: '', description: '', status: 'active',
    startDate: '', endDate: '',
    fundingSourceType: '', donorOrgId: '', funderName: '',
  })

  useEffect(() => {
    apiGet('/api/donor/organisations')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(d => setDonorOrgs(d.data ?? []))
      .catch(() => {})
  }, [])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.name.trim()) { setError(t('projects.nameRequired')); return }
    if (!form.fundingSourceType) { setError('Please select a funding source type'); return }

    // Validate funder
    if (funderOption === 'portal' && !form.donorOrgId) { setError('Please select a donor organisation'); return }
    if (funderOption === 'invite' && (!inviteForm.orgName.trim() || !inviteForm.email.trim())) { setError('Organisation name and email are required'); return }
    if (funderOption === 'other' && !form.funderName.trim()) { setError('Please enter the funder name'); return }

    setSaving(true); setError('')
    try {
      const funderType = funderOption === 'other' ? 'EXTERNAL' : 'PORTAL'
      const funderName = funderOption === 'other'
        ? form.funderName.trim()
        : funderOption === 'portal'
          ? donorOrgs.find(o => o.id === form.donorOrgId)?.name || ''
          : inviteForm.orgName.trim()

      const res = await apiPost('/api/projects', {
        name: form.name.trim(),
        description: form.description || null,
        status: form.status,
        ...(form.startDate && { startDate: form.startDate }),
        ...(form.endDate && { endDate: form.endDate }),
        fundingSourceType: form.fundingSourceType,
        funderType,
        funderName,
        donorOrgId: funderOption === 'portal' ? form.donorOrgId : null,
        inviteEmail: funderOption === 'invite' ? inviteForm.email.trim() : null,
        inviteOrgName: funderOption === 'invite' ? inviteForm.orgName.trim() : null,
      })
      if (res.ok) {
        const data = await res.json()
        setSavedProjectId(data.id)
      } else {
        const d = await res.json()
        setError(d.message ?? d.error ?? 'Failed to create project')
      }
    } catch { setError('Network error — is the backend running?') }
    setSaving(false)
  }

  const inputCls = "w-full bg-[#e1eedd] border border-[#c8d6c0] rounded-lg px-4 py-2.5 text-sm text-[#183a1d] placeholder-[#183a1d]/40 outline-none focus:border-[#f6c453] focus:bg-[#e1eedd] transition-all"
  const labelCls = "block text-xs font-medium text-[#183a1d]/60 mb-1.5 uppercase tracking-wide"
  const optionBtnCls = (active: boolean) =>
    `flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-all border ${
      active
        ? 'bg-[#f6c453] border-[#f0a04b] text-[#183a1d]'
        : 'bg-[#e1eedd] border-[#c8d6c0] text-[#183a1d]/50 hover:border-[#f6c453]/50'
    }`

  return (
    <div className="p-6 max-w-2xl animate-fade-up">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/projects" className="text-[#183a1d]/60 hover:text-[#183a1d] transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#183a1d]" style={{ fontFamily: 'Inter, sans-serif' }}>{t('projects.newProject')}</h1>
          <p className="text-[#183a1d]/60 text-sm">{t('projects.projectAnchored')}</p>
        </div>
      </div>

      <div className="space-y-4">
        {!savedProjectId ? (
          <div className="rounded-xl border border-[#c8d6c0] p-6 space-y-5"
            style={{ background: '#e1eedd' }}>

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

            {/* ── Funding Source Type ── */}
            <div>
              <label className={labelCls}>Funding Source Type *</label>
              <select value={form.fundingSourceType} onChange={e => set('fundingSourceType', e.target.value)} className={inputCls}>
                <option value="">Select funding source type</option>
                {FUNDING_SOURCE_TYPE_KEYS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* ── Funder / Donor Selection ── */}
            <div>
              <label className={labelCls}>Funded By *</label>
              <div className="flex gap-2 mb-3">
                <button type="button" onClick={() => setFunderOption('portal')} className={optionBtnCls(funderOption === 'portal')}>
                  <Building2 size={13} className="inline mr-1.5 -mt-0.5" />Existing Donor
                </button>
                <button type="button" onClick={() => setFunderOption('invite')} className={optionBtnCls(funderOption === 'invite')}>
                  <Mail size={13} className="inline mr-1.5 -mt-0.5" />Invite New
                </button>
                <button type="button" onClick={() => setFunderOption('other')} className={optionBtnCls(funderOption === 'other')}>
                  <Globe size={13} className="inline mr-1.5 -mt-0.5" />Other
                </button>
              </div>

              {funderOption === 'portal' && (
                <select value={form.donorOrgId} onChange={e => set('donorOrgId', e.target.value)} className={inputCls}>
                  <option value="">Select donor organisation</option>
                  {donorOrgs.map(o => <option key={o.id} value={o.id}>{o.name}{o.type ? ` (${o.type})` : ''}</option>)}
                </select>
              )}

              {funderOption === 'invite' && (
                <div className="space-y-3 border border-[#c8d6c0] rounded-lg p-4 bg-[#e1eedd]">
                  <p className="text-xs text-[#183a1d]/50">The donor will receive an email invite to join the portal and view this project.</p>
                  <input value={inviteForm.orgName} onChange={e => setInviteForm(f => ({ ...f, orgName: e.target.value }))}
                    placeholder="Organisation name *" className={inputCls} />
                  <input value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="Contact email *" type="email" className={inputCls} />
                </div>
              )}

              {funderOption === 'other' && (
                <input value={form.funderName} onChange={e => set('funderName', e.target.value)}
                  placeholder="e.g. World Bank, USAID, EU Commission" className={inputCls} />
              )}
            </div>

            {error && (
              <div className="rounded-lg bg-red-400/10 border border-red-400/20 px-4 py-3 text-sm text-red-400">{error}</div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button onClick={submit} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-[#183a1d] disabled:opacity-50 transition-all bg-[#f6c453] hover:bg-[#f0a04b]">
                <Save size={15} />
                {saving ? t('common.creating') : t('projects.createProject')}
              </button>
              <Link href="/dashboard/projects" className="px-5 py-2.5 rounded-lg text-sm text-[#183a1d]/60 hover:text-[#183a1d] transition-colors">
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
                className="px-5 py-2.5 rounded-lg text-sm font-medium text-[#183a1d] bg-[#f6c453] hover:bg-[#f0a04b]">
                {t('projects.viewProject')}
              </button>
              <button onClick={() => router.push('/dashboard/projects/new')}
                className="px-5 py-2.5 rounded-lg text-sm text-[#183a1d]/60 hover:text-[#183a1d] transition-colors">
                {t('projects.createAnother')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
