'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2, FolderOpen, Users, Rocket,
  Upload, Globe, FileText, ChevronRight,
  Check, SkipForward, Plus, X, Loader2
} from 'lucide-react'
import CountrySelect from '@/components/CountrySelect'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.tulipds.com'

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
        let msg = 'Failed to save'
        try { msg = JSON.parse(text).error || msg } catch {}
        throw new Error(msg)
      }

      setStep(2)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save organisation details')
    } finally {
      setLoading(false)
    }
  }

  const handleProjectSubmit = async () => {
    if (!projectForm.name.trim()) { setError('Project name is required'); return }
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
        let msg = 'Failed to create project'
        try { msg = JSON.parse(text).error || msg } catch {}
        throw new Error(msg)
      }
      setStep(3)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
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
      setError(err instanceof Error ? err.message : 'Failed to send invitations')
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
    <div className="min-h-screen bg-[#070B0F]" style={{ fontFamily: "'DM Sans', sans-serif" }}>

      {/* Top bar */}
      <div className="border-b border-white/6 bg-[#0C1117]/80 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
              <Building2 className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-white font-bold text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>
              tulip<span style={{ color: '#369bff' }}>ds</span>
            </span>
            {tenantName && (
              <>
                <span className="text-white/15 text-sm ml-1">|</span>
                <span className="text-white/40 text-sm">{tenantName}</span>
              </>
            )}
          </div>
          <button onClick={() => router.push('/dashboard')}
            className="text-white/30 text-xs hover:text-white/50 transition-colors">
            Skip setup →
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
                    isActive ? 'bg-blue-500/15 border border-blue-500/40' :
                    'bg-white/5 border border-white/10'
                  }`}>
                    {isDone ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-white/20'}`} />
                    )}
                  </div>
                  <span className={`text-xs font-medium hidden sm:block ${
                    isDone ? 'text-emerald-400' : isActive ? 'text-white' : 'text-white/25'
                  }`}>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-px mx-4 ${isDone ? 'bg-emerald-500/25' : 'bg-white/8'}`} />
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
            <h1 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
              Organisation Details
            </h1>
            <p className="text-white/40 text-sm mb-8">Tell us a bit about your organisation. You can update this later in settings.</p>

            <div className="space-y-5">
              {/* Logo upload */}
              <div>
                <label className="text-white/50 text-xs font-medium uppercase tracking-wider mb-2 block">Logo</label>
                <div className="flex items-center gap-4">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 rounded-2xl border-2 border-dashed border-white/10 hover:border-blue-500/30 flex items-center justify-center cursor-pointer transition-all overflow-hidden bg-white/3"
                  >
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <Upload className="w-5 h-5 text-white/20" />
                    )}
                  </div>
                  <div>
                    <button onClick={() => fileInputRef.current?.click()}
                      className="text-blue-400 text-sm hover:underline">
                      {logoPreview ? 'Change logo' : 'Upload logo'}
                    </button>
                    <p className="text-white/20 text-xs mt-1">PNG, JPG, max 5MB</p>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoSelect} className="hidden" />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-white/50 text-xs font-medium uppercase tracking-wider mb-2 block">Description</label>
                <textarea
                  value={orgForm.description}
                  onChange={e => setOrgForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="What does your organisation do?"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder-white/20 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30 transition-all resize-none"
                />
              </div>

              {/* Country */}
              <div>
                <label className="text-white/50 text-xs font-medium uppercase tracking-wider mb-2 block">Country</label>
                <CountrySelect
                  value={orgForm.country}
                  onChange={v => setOrgForm(f => ({ ...f, country: v }))}
                />
              </div>

              {/* Website + Reg number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-white/50 text-xs font-medium uppercase tracking-wider mb-2 block">Website</label>
                  <div className="relative">
                    <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                    <input
                      type="url"
                      value={orgForm.website}
                      onChange={e => setOrgForm(f => ({ ...f, website: e.target.value }))}
                      placeholder="https://your-org.com"
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder-white/20 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-white/50 text-xs font-medium uppercase tracking-wider mb-2 block">Registration Number</label>
                  <div className="relative">
                    <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                    <input
                      type="text"
                      value={orgForm.registrationNumber}
                      onChange={e => setOrgForm(f => ({ ...f, registrationNumber: e.target.value }))}
                      placeholder="NGO-12345"
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder-white/20 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30 transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/6">
              <button onClick={() => { setError(''); setStep(2) }}
                className="text-white/30 text-sm hover:text-white/50 flex items-center gap-1 transition-colors">
                <SkipForward className="w-3.5 h-3.5" /> Skip this step
              </button>
              <button onClick={handleOrgSubmit} disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Save & Continue</span><ChevronRight className="w-4 h-4" /></>}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: First Project */}
        {step === 2 && (
          <div className="animate-in">
            <h1 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
              Create Your First Project
            </h1>
            <p className="text-white/40 text-sm mb-8">Projects help you organise expenses, documents, and funding sources.</p>

            <div className="space-y-5">
              <div>
                <label className="text-white/50 text-xs font-medium uppercase tracking-wider mb-2 block">Project Name *</label>
                <input
                  type="text"
                  value={projectForm.name}
                  onChange={e => setProjectForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Clean Water Initiative 2026"
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder-white/20 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30 transition-all"
                />
              </div>

              <div>
                <label className="text-white/50 text-xs font-medium uppercase tracking-wider mb-2 block">Description</label>
                <textarea
                  value={projectForm.description}
                  onChange={e => setProjectForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description of the project"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder-white/20 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30 transition-all resize-none"
                />
              </div>

              <div className="sm:w-1/2">
                <label className="text-white/50 text-xs font-medium uppercase tracking-wider mb-2 block">Budget (USD)</label>
                <input
                  type="number"
                  value={projectForm.budget}
                  onChange={e => setProjectForm(f => ({ ...f, budget: e.target.value }))}
                  placeholder="50000"
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder-white/20 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30 transition-all"
                />
              </div>
            </div>

            <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/6">
              <button onClick={() => { setError(''); setStep(3) }}
                className="text-white/30 text-sm hover:text-white/50 flex items-center gap-1 transition-colors">
                <SkipForward className="w-3.5 h-3.5" /> Skip this step
              </button>
              <button onClick={handleProjectSubmit} disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Create Project</span><ChevronRight className="w-4 h-4" /></>}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Invite Team */}
        {step === 3 && (
          <div className="animate-in">
            <h1 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
              Invite Your Team
            </h1>
            <p className="text-white/40 text-sm mb-8">Add up to 3 colleagues. They&apos;ll receive an email invitation to join your workspace.</p>

            <div className="space-y-3">
              {emails.map((email, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex-1 relative">
                    <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => {
                        const newEmails = [...emails]
                        newEmails[i] = e.target.value
                        setEmails(newEmails)
                      }}
                      placeholder={`colleague${i + 1}@org.com`}
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder-white/20 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30 transition-all"
                    />
                  </div>
                  {email && (
                    <button onClick={() => {
                      const newEmails = [...emails]
                      newEmails[i] = ''
                      setEmails(newEmails)
                    }} className="text-white/20 hover:text-white/40 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/6">
              <button onClick={() => { setError(''); setStep(4) }}
                className="text-white/30 text-sm hover:text-white/50 flex items-center gap-1 transition-colors">
                <SkipForward className="w-3.5 h-3.5" /> Skip this step
              </button>
              <button onClick={handleInviteSubmit} disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Send Invitations</span><ChevronRight className="w-4 h-4" /></>}
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
            <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
              Your workspace is ready!
            </h1>
            <p className="text-white/40 text-sm mb-8 max-w-md mx-auto">
              {tenantName ? `${tenantName} is all set up.` : 'Your organisation is all set up.'} Every record you create will be cryptographically verified and anchored to the blockchain.
            </p>

            {/* Invite results */}
            {inviteResults.length > 0 && (
              <div className="mb-8 max-w-sm mx-auto">
                <h3 className="text-white/50 text-xs font-medium uppercase tracking-wider mb-3">Invitation Status</h3>
                <div className="space-y-2">
                  {inviteResults.map((r, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-white/3 border border-white/6">
                      <span className="text-white/60 text-sm truncate">{r.email}</span>
                      <span className={`text-xs font-medium ${
                        r.status === 'sent' ? 'text-emerald-400' :
                        r.status === 'already_registered' ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        {r.status === 'sent' ? 'Sent' : r.status === 'already_registered' ? 'Already registered' : 'Failed'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action links */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto mb-8">
              {[
                { label: 'Dashboard', href: '/dashboard', icon: Rocket },
                { label: 'Projects', href: '/dashboard/projects', icon: FolderOpen },
                { label: 'Documents', href: '/dashboard/documents', icon: FileText },
              ].map(link => {
                const Icon = link.icon
                return (
                  <button key={link.href}
                    onClick={() => { handleComplete(); router.push(link.href) }}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-white/10 bg-white/3 text-white/60 text-sm hover:bg-white/5 hover:text-white transition-all">
                    <Icon className="w-4 h-4" />
                    {link.label}
                  </button>
                )
              })}
            </div>

            <button onClick={handleComplete} disabled={loading}
              className="px-8 py-3 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Go to Dashboard →'}
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
