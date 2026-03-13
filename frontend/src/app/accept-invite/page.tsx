'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#fefbe9] flex items-center justify-center">
        <Loader2 size={32} className="text-[#f6c453] animate-spin" />
      </div>
    }>
      <AcceptInviteForm />
    </Suspense>
  )
}

function AcceptInviteForm() {
  const t = useTranslations('acceptInvite')
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [step, setStep] = useState<'form' | 'loading' | 'success' | 'error'>('form')
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    firstName: '', lastName: '', password: '', confirmPassword: '',
    donorName: '', donorType: 'FOUNDATION', country: ''
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.firstName || !form.lastName) { setError(t('nameRequired')); return }
    if (form.password.length < 6) { setError(t('passwordMinLength')); return }
    if (form.password !== form.confirmPassword) { setError(t('passwordsNoMatch')); return }
    if (!token) { setError(t('invalidInvite')); return }

    setStep('loading')
    setError('')
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/donor-invites/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          password: form.password,
          donorName: form.donorName.trim() || undefined,
          donorType: form.donorType,
          country: form.country.trim() || undefined,
        })
      })
      const data = await res.json()
      if (res.ok) {
        setStep('success')
      } else {
        setError(data.error || t('failedToAccept'))
        setStep('form')
      }
    } catch {
      setError(t('networkError'))
      setStep('form')
    }
  }

  if (!token) return (
    <div className="min-h-screen bg-[#fefbe9] flex items-center justify-center">
      <div className="text-center">
        <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-[#183a1d] mb-2">{t('invalidInviteLink')}</h1>
        <p className="text-[#183a1d]/60 text-sm">{t('missingToken')}</p>
      </div>
    </div>
  )

  if (step === 'success') return (
    <div className="min-h-screen bg-[#fefbe9] flex items-center justify-center">
      <div className="text-center max-w-md">
        <CheckCircle size={48} className="text-emerald-400 mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-[#183a1d] mb-2">{t('invitationAccepted')}</h1>
        <p className="text-[#183a1d]/60 text-sm mb-6">{t('successDesc')}</p>
        <Link href="/login" className="inline-block px-6 py-3 rounded-lg text-sm font-medium text-[#183a1d]"
          style={{ background: '#f6c453' }}>
          {t('goToLogin')}
        </Link>
      </div>
    </div>
  )

  if (step === 'loading') return (
    <div className="min-h-screen bg-[#fefbe9] flex items-center justify-center">
      <Loader2 size={32} className="text-[#f6c453] animate-spin" />
    </div>
  )

  const inputCls = "w-full bg-[#e1eedd] border border-[#c8d6c0] rounded-lg px-4 py-2.5 text-sm text-[#183a1d] placeholder-[#183a1d]/40 outline-none focus:border-[#f6c453] transition-all"
  const labelCls = "block text-xs font-medium text-[#183a1d]/60 mb-1.5 uppercase tracking-wide"

  return (
    <div className="min-h-screen bg-[#fefbe9] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: '#f6c453' }}>
            <span className="text-[#183a1d] font-bold text-lg" style={{ fontFamily: 'Inter, sans-serif' }}>T</span>
          </div>
          <h1 className="text-2xl font-bold text-[#183a1d]" style={{ fontFamily: 'Inter, sans-serif' }}>{t('title')}</h1>
          <p className="text-[#183a1d]/60 text-sm mt-2">{t('subtitle')}</p>
        </div>

        <div className="rounded-xl border border-[#c8d6c0] p-6 space-y-4"
          style={{ background: '#e1eedd' }}>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t('firstName')}</label>
              <input value={form.firstName} onChange={e => set('firstName', e.target.value)}
                placeholder="John" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t('lastName')}</label>
              <input value={form.lastName} onChange={e => set('lastName', e.target.value)}
                placeholder="Smith" className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>{t('organisationName')}</label>
            <input value={form.donorName} onChange={e => set('donorName', e.target.value)}
              placeholder="e.g. Gulf Foundation" className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t('organisationType')}</label>
              <select value={form.donorType} onChange={e => set('donorType', e.target.value)} className={inputCls}>
                <option value="FOUNDATION">{t('typeFoundation')}</option>
                <option value="GOVERNMENT">{t('typeGovernment')}</option>
                <option value="CORPORATE">{t('typeCorporate')}</option>
                <option value="INDIVIDUAL">{t('typeIndividual')}</option>
                <option value="MULTILATERAL">{t('typeMultilateral')}</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>{t('country')}</label>
              <input value={form.country} onChange={e => set('country', e.target.value)}
                placeholder="e.g. UAE" className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>{t('password')}</label>
            <input type="password" value={form.password} onChange={e => set('password', e.target.value)}
              placeholder="Min 6 characters" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t('confirmPassword')}</label>
            <input type="password" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)}
              placeholder="Re-enter password" className={inputCls} />
          </div>

          {error && (
            <div className="rounded-lg bg-red-400/10 border border-red-400/20 px-4 py-3 text-sm text-red-400">{error}</div>
          )}

          <button onClick={submit}
            className="w-full py-3 rounded-lg text-sm font-medium text-[#183a1d] transition-all"
            style={{ background: '#f6c453' }}>
            {t('acceptCreateAccount')}
          </button>
        </div>

        <p className="text-center text-[#183a1d]/30 text-xs mt-6">{t('footerText')}</p>
      </div>
    </div>
  )
}
