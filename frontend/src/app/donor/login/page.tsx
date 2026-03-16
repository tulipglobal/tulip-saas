'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Shield, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function DonorLoginPage() {
  const t = useTranslations('donorLogin')
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.tulipds.com'
      const res = await fetch(`${apiUrl}/api/donor-auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      })

      let data
      const text = await res.text()
      try { data = JSON.parse(text) } catch { data = { error: text || `Server returned ${res.status}` } }

      console.log('[donor-login] status:', res.status, 'response:', data)

      if (!res.ok) {
        setError(data.error || `Login failed (${res.status})`)
        setLoading(false)
        return
      }

      if (!data.token) {
        setError(t('noToken'))
        setLoading(false)
        return
      }

      localStorage.setItem('donor_token', data.token)
      localStorage.setItem('donor_user', JSON.stringify(data.user))
      router.push('/donor/dashboard')
    } catch (err) {
      console.error('[donor-login] error:', err)
      setError(t('connectError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--tulip-cream)] flex flex-col" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* Nav */}
      <nav className="border-b border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)]/95 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
              <Shield className="w-4 h-4 text-[var(--tulip-forest)]" />
            </div>
            <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '18px', color: 'var(--tulip-forest)' }}>
              tulip<span style={{ color: 'var(--tulip-gold)' }}>ds</span>
            </span>
            <span className="text-[var(--tulip-forest)]/30 text-sm ml-1">| {t('donorPortal')}</span>
          </Link>
          <Link href="/login" className="text-[var(--tulip-forest)]/60 text-sm hover:text-[var(--tulip-forest)]/70 transition-colors">
            {t('ngoLogin')}
          </Link>
        </div>
      </nav>

      {/* Login form */}
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">

          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
              <Shield className="w-7 h-7 text-[var(--tulip-forest)]" />
            </div>
            <h1 className="text-2xl font-bold text-[var(--tulip-forest)]" style={{ fontFamily: 'Inter, sans-serif' }}>
              {t('title')}
            </h1>
            <p className="text-[var(--tulip-forest)]/60 text-sm mt-2">
              {t('subtitle')}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[var(--tulip-forest)]/60 text-xs font-medium uppercase tracking-wider mb-1.5 block">{t('emailLabel')}</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--tulip-forest)]/30" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={t('emailPlaceholder')}
                  required
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/30 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-[var(--tulip-forest)]/60 text-xs font-medium uppercase tracking-wider mb-1.5 block">{t('passwordLabel')}</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--tulip-forest)]/30" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={t('passwordPlaceholder')}
                  required
                  className="w-full pl-11 pr-11 py-3 rounded-xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/30 transition-all"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--tulip-forest)]/30 hover:text-[var(--tulip-forest)]/60 transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading || !email || !password}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
              {loading
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : t('signInButton')
              }
            </button>
          </form>

          <p className="text-center text-[var(--tulip-forest)]/30 text-xs mt-6">
            <Link href="/donor" className="text-emerald-400 hover:underline">{t('backToPortal')}</Link>
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[var(--tulip-sage-dark)] py-4">
        <p className="text-center text-[var(--tulip-forest)]/30 text-xs">
          {t('footer')}
        </p>
      </footer>
    </div>
  )
}
