'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 size={32} className="text-cyan-400 animate-spin" />
      </div>
    }>
      <AcceptInviteForm />
    </Suspense>
  )
}

function AcceptInviteForm() {
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
    if (!form.firstName || !form.lastName) { setError('First and last name are required'); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return }
    if (!token) { setError('Invalid invite link'); return }

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
        setError(data.error || 'Failed to accept invitation')
        setStep('form')
      }
    } catch {
      setError('Network error')
      setStep('form')
    }
  }

  if (!token) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="text-center">
        <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Invalid Invite Link</h1>
        <p className="text-gray-500 text-sm">This invitation link is missing the token parameter.</p>
      </div>
    </div>
  )

  if (step === 'success') return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="text-center max-w-md">
        <CheckCircle size={48} className="text-emerald-400 mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Invitation Accepted</h1>
        <p className="text-gray-500 text-sm mb-6">Your donor account has been created. You can now access the donor portal to view verified financial records.</p>
        <Link href="/login" className="inline-block px-6 py-3 rounded-lg text-sm font-medium text-gray-900"
          style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
          Go to Login
        </Link>
      </div>
    </div>
  )

  if (step === 'loading') return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <Loader2 size={32} className="text-cyan-400 animate-spin" />
    </div>
  )

  const inputCls = "w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#0c7aed]/50 transition-all"
  const labelCls = "block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide"

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
            <span className="text-gray-900 font-bold text-lg" style={{ fontFamily: 'Syne, sans-serif' }}>T</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Syne, sans-serif' }}>Accept Invitation</h1>
          <p className="text-gray-500 text-sm mt-2">Create your donor account to view verified financial records</p>
        </div>

        <div className="rounded-xl border border-gray-200 p-6 space-y-4"
          style={{ background: '#FFFFFF' }}>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>First Name *</label>
              <input value={form.firstName} onChange={e => set('firstName', e.target.value)}
                placeholder="John" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Last Name *</label>
              <input value={form.lastName} onChange={e => set('lastName', e.target.value)}
                placeholder="Smith" className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Organisation Name</label>
            <input value={form.donorName} onChange={e => set('donorName', e.target.value)}
              placeholder="e.g. Gulf Foundation" className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Organisation Type</label>
              <select value={form.donorType} onChange={e => set('donorType', e.target.value)} className={inputCls}>
                <option value="FOUNDATION">Foundation</option>
                <option value="GOVERNMENT">Government</option>
                <option value="CORPORATE">Corporate</option>
                <option value="INDIVIDUAL">Individual</option>
                <option value="MULTILATERAL">Multilateral</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Country</label>
              <input value={form.country} onChange={e => set('country', e.target.value)}
                placeholder="e.g. UAE" className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Password *</label>
            <input type="password" value={form.password} onChange={e => set('password', e.target.value)}
              placeholder="Min 6 characters" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Confirm Password *</label>
            <input type="password" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)}
              placeholder="Re-enter password" className={inputCls} />
          </div>

          {error && (
            <div className="rounded-lg bg-red-400/10 border border-red-400/20 px-4 py-3 text-sm text-red-400">{error}</div>
          )}

          <button onClick={submit}
            className="w-full py-3 rounded-lg text-sm font-medium text-gray-900 transition-all"
            style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
            Accept & Create Account
          </button>
        </div>

        <p className="text-center text-gray-300 text-xs mt-6">Tulip DS · Blockchain-Verified Financial Transparency</p>
      </div>
    </div>
  )
}
