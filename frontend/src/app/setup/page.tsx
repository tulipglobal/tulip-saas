'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import {
  Building2, FolderOpen, Users, Rocket,
  Upload, Globe, FileText, ChevronRight,
  Check, SkipForward, Plus, X, Loader2
} from 'lucide-react'
import CountrySelect from '@/components/CountrySelect'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.sealayer.io'

function authHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tulip_token') : null
  return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
}

const STEPS = [
  { id: 1, label: 'Organisation', icon: Building2 },
  { id: 2, label: 'First Project', icon: FolderOpen },
  { id: 3, label: 'Invite Team', icon: Users },
  { id: 4, label: 'Ready!', icon: Rocket },
]

export default function SetupWizardPage() {
  const t = useTranslations('setup')
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tenantName, setTenantName] = useState('')

  // Step 1: Org details
  const [orgForm, setOrgForm] = useState({ description: '', website: '', registrationNumber: '', country: '' })
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Step 2: First project
  const [projectForm, setProjectForm] = useState({ name: '', description: '', budget: '' })

  // Step 3: Invite team
  const [emails, setEmails] = useState(['', '', ''])
  const [inviteResults, setInviteResults] = useState<{ email: string; status: string }[]>([])

  const stepLabels: Record<number, string> = { 1: t('stepOrganisation'), 2: t('stepFirstProject'), 3: t('stepInviteTeam'), 4: t('stepReady') }

  useEffect(() => {
    const token = localStorage.getItem('tulip_token')
    if (!token) { router.push('/login'); return }

    // Fetch current status — non-critical, wizard works without it
    fetch(`${API}/api/setup/status`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    })
      .then(r => {
        if (!r.ok) return null // 401, 500, etc — wizard still works without status
        return r.json()
      })
      .then(data => {
        if (!data) return
        if (data.completedSetup) { router.push('/dashboard'); return }
        setTenantName(data.name || '')
        if (data.country) setOrgForm(f => ({ ...f, country: data.country }))
        if (data.description) setOrgForm(f => ({ ...f, description: data.description }))
        if (data.website) setOrgForm(f => ({ ...f, website: data.website }))
        if (data.registrationNumber) setOrgForm(f => ({ ...f, registrationNumber: data.registrationNumber }))
        if (data.logoUrl) setLogoPreview(data.logoUrl)
      })
      .catch(() => {}) // network/CORS errors are non-critical
  }, [router])

  const handleOrgSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      // Upload logo if selected
      if (logoFile) {
        const fd = new FormData()
        fd.append('logo', logoFile)
        const token = localStorage.getItem('tulip_token')
        await fetch(`${API}/api/setup/logo`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: fd
        })
      }

      // Update org details
      const res = await fetch(`${API}/api/setup/organisation`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(orgForm)
      })
      if (!res.ok) {
        const text = await res.text()
        let msg = t('failedToSave')
        try { msg = JSON.parse(text).error || msg } catch {}
        throw new Error(msg)
      }

      setStep(2)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('failedToSaveOrg'))
    } finally {
      setLoading(false)
    }
  }

  const handleProjectSubmit = async () => {
    if (!projectForm.name.trim()) { setError(t('projectNameRequired')); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/setup/project`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(projectForm)
      })
      if (!res.ok) {
        const text = await res.text()
        let msg = t('failedToCreateProject')
        try { msg = JSON.parse(text).error || msg } catch {}
        throw new Error(msg)
      }
      setStep(3)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('failedToCreateProject'))
    } finally {
      setLoading(false)
    }
  }

  const handleInviteSubmit = async () => {
    const validEmails = emails.filter(e => e.trim() && e.includes('@'))
    if (validEmails.length === 0) { setStep(4); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/setup/invite-team`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ emails: validEmails })
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed') }
      const data = await res.json()
      setInviteResults(data.results || [])
      setStep(4)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('failedToSendInvites'))
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = async () => {
    setLoading(true)
    try {
      await fetch(`${API}/api/setup/complete`, { method: 'POST', headers: authHeaders() })
      router.push('/dashboard')
    } catch {
      router.push('/dashboard')
    }
  }

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    const reader = new FileReader()
    reader.onload = () => setLogoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  return (
    <div className="min-h-screen bg-[var(--tulip-cream)]" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* Top bar */}
      <div className="border-b border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)]/80 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center">
            <img src="/logo.svg" alt="sealayer" style={{ height: '48px' }} />
            {tenantName && (
              <>
                <span className="text-[var(--tulip-forest)]/30 text-sm ml-1">|</span>
                <span className="text-[var(--tulip-forest)]/60 text-sm">{tenantName}</span>
              </>
            )}
          </div>
          <button onClick={() => router.push('/dashboard')}
            className="text-[var(--tulip-forest)]/40 text-xs hover:text-[var(--tulip-forest)]/60 transition-colors">
            {t('skipSetup')}
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">

        {/* Progress bar */}
        <div className="flex items-center justify-between mb-10">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            const isActive = step === s.id
            const isDone = step > s.id
            return (
              <div key={s.id} className="flex items-center flex-1 last:flex-none">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                    isDone ? 'bg-emerald-500/15 border border-emerald-500/30' :
                    isActive ? 'bg-[var(--tulip-gold)]/15 border border-[var(--tulip-gold)]/40' :
                    'bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)]'
                  }`}>
                    {isDone ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Icon className={`w-4 h-4 ${isActive ? 'text-[var(--tulip-gold)]' : 'text-[var(--tulip-forest)]/30'}`} />
                    )}
                  </div>
                  <span className={`text-xs font-medium hidden sm:block ${
                    isDone ? 'text-emerald-400' : isActive ? 'text-[var(--tulip-forest)]' : 'text-[var(--tulip-forest)]/40'
                  }`}>{stepLabels[s.id]}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-px mx-4 ${isDone ? 'bg-emerald-500/25' : 'bg-[var(--tulip-sage-dark)]'}`} />
                )}
              </div>
            )
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/8 border border-red-500/20">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Step 1: Organisation Details */}
        {step === 1 && (
          <div className="animate-in">
            <h1 className="text-2xl font-bold text-[var(--tulip-forest)] mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>
              {t('orgDetailsTitle')}
            </h1>
            <p className="text-[var(--tulip-forest)]/60 text-sm mb-8">{t('orgDetailsDesc')}</p>

            <div className="space-y-5">
              {/* Logo upload */}
              <div>
                <label className="text-[var(--tulip-forest)]/60 text-xs font-medium uppercase tracking-wider mb-2 block">{t('logo')}</label>
                <div className="flex items-center gap-4">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 rounded-2xl border-2 border-dashed border-[var(--tulip-sage-dark)] hover:border-[var(--tulip-gold)]/30 flex items-center justify-center cursor-pointer transition-all overflow-hidden bg-[var(--tulip-sage)]"
                  >
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <Upload className="w-5 h-5 text-[var(--tulip-forest)]/30" />
                    )}
                  </div>
                  <div>
                    <button onClick={() => fileInputRef.current?.click()}
                      className="text-[var(--tulip-forest)] text-sm hover:underline">
                      {logoPreview ? t('changeLogo') : t('uploadLogo')}
                    </button>
                    <p className="text-[var(--tulip-forest)]/30 text-xs mt-1">{t('logoHint')}</p>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoSelect} className="hidden" />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-[var(--tulip-forest)]/60 text-xs font-medium uppercase tracking-wider mb-2 block">{t('description')}</label>
                <textarea
                  value={orgForm.description}
                  onChange={e => setOrgForm(f => ({ ...f, description: e.target.value }))}
                  placeholder={t('descriptionPlaceholder')}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--tulip-gold)]/30 focus:border-[var(--tulip-gold)] transition-all resize-none"
                />
              </div>

              {/* Country */}
              <div>
                <label className="text-[var(--tulip-forest)]/60 text-xs font-medium uppercase tracking-wider mb-2 block">{t('country')}</label>
                <CountrySelect
                  value={orgForm.country}
                  onChange={v => setOrgForm(f => ({ ...f, country: v }))}
                />
              </div>

              {/* Website + Reg number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[var(--tulip-forest)]/60 text-xs font-medium uppercase tracking-wider mb-2 block">{t('website')}</label>
                  <div className="relative">
                    <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--tulip-forest)]/30" />
                    <input
                      type="url"
                      value={orgForm.website}
                      onChange={e => setOrgForm(f => ({ ...f, website: e.target.value }))}
                      placeholder="https://your-org.com"
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--tulip-gold)]/30 focus:border-[var(--tulip-gold)] transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[var(--tulip-forest)]/60 text-xs font-medium uppercase tracking-wider mb-2 block">{t('registrationNumber')}</label>
                  <div className="relative">
                    <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--tulip-forest)]/30" />
                    <input
                      type="text"
                      value={orgForm.registrationNumber}
                      onChange={e => setOrgForm(f => ({ ...f, registrationNumber: e.target.value }))}
                      placeholder="NGO-12345"
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--tulip-gold)]/30 focus:border-[var(--tulip-gold)] transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-8 pt-6 border-t border-[var(--tulip-sage-dark)]">
              <button onClick={() => { setError(''); setStep(2) }}
                className="text-[var(--tulip-forest)]/40 text-sm hover:text-[var(--tulip-forest)]/60 flex items-center gap-1 transition-colors">
                <SkipForward className="w-3.5 h-3.5" /> {t('skipStep')}
              </button>
              <button onClick={handleOrgSubmit} disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-[var(--tulip-forest)] text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-40"
                style={{ background: 'var(--tulip-gold)' }}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>{t('saveContinue')}</span><ChevronRight className="w-4 h-4" /></>}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: First Project */}
        {step === 2 && (
          <div className="animate-in">
            <h1 className="text-2xl font-bold text-[var(--tulip-forest)] mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>
              {t('createProjectTitle')}
            </h1>
            <p className="text-[var(--tulip-forest)]/60 text-sm mb-8">{t('createProjectDesc')}</p>

            <div className="space-y-5">
              <div>
                <label className="text-[var(--tulip-forest)]/60 text-xs font-medium uppercase tracking-wider mb-2 block">{t('projectName')}</label>
                <input
                  type="text"
                  value={projectForm.name}
                  onChange={e => setProjectForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Clean Water Initiative 2026"
                  className="w-full px-4 py-3 rounded-xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--tulip-gold)]/30 focus:border-[var(--tulip-gold)] transition-all"
                />
              </div>

              <div>
                <label className="text-[var(--tulip-forest)]/60 text-xs font-medium uppercase tracking-wider mb-2 block">{t('projectDescription')}</label>
                <textarea
                  value={projectForm.description}
                  onChange={e => setProjectForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description of the project"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--tulip-gold)]/30 focus:border-[var(--tulip-gold)] transition-all resize-none"
                />
              </div>

              <div className="sm:w-1/2">
                <label className="text-[var(--tulip-forest)]/60 text-xs font-medium uppercase tracking-wider mb-2 block">{t('budgetUsd')}</label>
                <input
                  type="number"
                  value={projectForm.budget}
                  onChange={e => setProjectForm(f => ({ ...f, budget: e.target.value }))}
                  placeholder="50000"
                  className="w-full px-4 py-3 rounded-xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--tulip-gold)]/30 focus:border-[var(--tulip-gold)] transition-all"
                />
              </div>
            </div>

            <div className="flex items-center justify-between mt-8 pt-6 border-t border-[var(--tulip-sage-dark)]">
              <button onClick={() => { setError(''); setStep(3) }}
                className="text-[var(--tulip-forest)]/40 text-sm hover:text-[var(--tulip-forest)]/60 flex items-center gap-1 transition-colors">
                <SkipForward className="w-3.5 h-3.5" /> {t('skipStep')}
              </button>
              <button onClick={handleProjectSubmit} disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-[var(--tulip-forest)] text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-40"
                style={{ background: 'var(--tulip-gold)' }}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>{t('createProject')}</span><ChevronRight className="w-4 h-4" /></>}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Invite Team */}
        {step === 3 && (
          <div className="animate-in">
            <h1 className="text-2xl font-bold text-[var(--tulip-forest)] mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>
              {t('inviteTeamTitle')}
            </h1>
            <p className="text-[var(--tulip-forest)]/60 text-sm mb-8">{t('inviteTeamDesc')}</p>

            <div className="space-y-3">
              {emails.map((email, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex-1 relative">
                    <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--tulip-forest)]/30" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => {
                        const newEmails = [...emails]
                        newEmails[i] = e.target.value
                        setEmails(newEmails)
                      }}
                      placeholder={`colleague${i + 1}@org.com`}
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--tulip-gold)]/30 focus:border-[var(--tulip-gold)] transition-all"
                    />
                  </div>
                  {email && (
                    <button onClick={() => {
                      const newEmails = [...emails]
                      newEmails[i] = ''
                      setEmails(newEmails)
                    }} className="text-[var(--tulip-forest)]/30 hover:text-[var(--tulip-forest)]/60 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-8 pt-6 border-t border-[var(--tulip-sage-dark)]">
              <button onClick={() => { setError(''); setStep(4) }}
                className="text-[var(--tulip-forest)]/40 text-sm hover:text-[var(--tulip-forest)]/60 flex items-center gap-1 transition-colors">
                <SkipForward className="w-3.5 h-3.5" /> {t('skipStep')}
              </button>
              <button onClick={handleInviteSubmit} disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-[var(--tulip-forest)] text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-40"
                style={{ background: 'var(--tulip-gold)' }}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>{t('sendInvitations')}</span><ChevronRight className="w-4 h-4" /></>}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Done */}
        {step === 4 && (
          <div className="animate-in text-center py-8">
            <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.15))', border: '1px solid rgba(16,185,129,0.25)' }}>
              <Rocket className="w-9 h-9 text-emerald-400" />
            </div>
            <h1 className="text-3xl font-bold text-[var(--tulip-forest)] mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
              {t('workspaceReady')}
            </h1>
            <p className="text-[var(--tulip-forest)]/60 text-sm mb-8 max-w-md mx-auto">
              {tenantName ? t('workspaceReadyDesc', { name: tenantName }) : t('workspaceReadyDescDefault')}
            </p>

            {/* Invite results */}
            {inviteResults.length > 0 && (
              <div className="mb-8 max-w-sm mx-auto">
                <h3 className="text-[var(--tulip-forest)]/60 text-xs font-medium uppercase tracking-wider mb-3">{t('invitationStatus')}</h3>
                <div className="space-y-2">
                  {inviteResults.map((r, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)]">
                      <span className="text-[var(--tulip-forest)]/70 text-sm truncate">{r.email}</span>
                      <span className={`text-xs font-medium ${
                        r.status === 'sent' ? 'text-emerald-400' :
                        r.status === 'already_registered' ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        {r.status === 'sent' ? t('statusSent') : r.status === 'already_registered' ? t('statusAlreadyRegistered') : t('statusFailed')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action links */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto mb-8">
              {[
                { label: t('dashboard'), href: '/dashboard', icon: Rocket },
                { label: t('projects'), href: '/dashboard/projects', icon: FolderOpen },
                { label: t('documents'), href: '/dashboard/documents', icon: FileText },
              ].map(link => {
                const Icon = link.icon
                return (
                  <button key={link.href}
                    onClick={() => { handleComplete(); router.push(link.href) }}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] text-[var(--tulip-forest)]/70 text-sm hover:bg-[var(--tulip-sage)] hover:text-[var(--tulip-forest)] transition-all">
                    <Icon className="w-4 h-4" />
                    {link.label}
                  </button>
                )
              })}
            </div>

            <button onClick={handleComplete} disabled={loading}
              className="px-8 py-3 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('goToDashboard')}
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }
        .animate-in { animation: fadeUp 0.35s ease forwards; }
      `}</style>
    </div>
  )
}
