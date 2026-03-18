'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Shield, Eye, EyeOff, ArrowRight } from 'lucide-react'
import LanguageSwitcher from '@/components/LanguageSwitcher'

export default function LoginPage() {
  const t = useTranslations()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ email: '', password: '' })

  // Handle SSO callback redirect
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('sso') === 'success') {
      const accessToken = params.get('accessToken')
      const refreshToken = params.get('refreshToken')
      const userData = params.get('user')
      if (accessToken && refreshToken && userData) {
        localStorage.setItem('tulip_token', accessToken)
        localStorage.setItem('tulip_refresh', refreshToken)
        try { localStorage.setItem('tulip_user', JSON.stringify(JSON.parse(decodeURIComponent(userData)))) } catch { localStorage.setItem('tulip_user', decodeURIComponent(userData)) }
        window.location.href = '/dashboard'
      }
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.accessToken) {
        localStorage.setItem('tulip_token', data.accessToken)
        localStorage.setItem('tulip_refresh', data.refreshToken)
        localStorage.setItem('tulip_user', JSON.stringify(data.user))
        window.location.href = '/dashboard'
      } else {
        alert(data.message || t('auth.loginFailed'))
      }
    } catch {
      alert(t('auth.cannotConnect'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 tulip-mesh flex-col justify-between p-12">
        <Link href="/" className="flex items-center">
          <img src="/logo.svg" alt="sealayer" style={{ height: '320px' }} />
        </Link>

        <div>
          <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '40px', color: 'var(--tulip-forest)', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
            {t('auth.tagline1')}<br />
            <span style={{ color: 'var(--tulip-gold)' }}>{t('auth.tagline2')}</span><br />
            {t('auth.tagline3')}
          </h2>
          <p style={{ color: 'var(--tulip-forest)', opacity: 0.6, fontSize: '16px', marginTop: '16px', lineHeight: 1.7 }}>
            {t('auth.taglineDesc')}
          </p>

          <div className="mt-10 space-y-3">
            {[t('auth.feat1'), t('auth.feat2'), t('auth.feat3'), t('auth.feat4')].map(feat => (
              <p key={feat} style={{ color: 'var(--tulip-forest)', fontSize: '14px', opacity: 0.7 }}>{feat}</p>
            ))}
          </div>
        </div>

        <p style={{ color: 'var(--tulip-forest)', fontSize: '12px', opacity: 0.7 }}>
          © 2026 sealayer · Bright Bytes Technology · Dubai, UAE
        </p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[var(--tulip-sage)] relative">
        <div className="absolute top-4 right-4">
          <LanguageSwitcher />
        </div>
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <Link href="/" className="flex items-center mb-8 lg:hidden">
            <img src="/logo.svg" alt="sealayer" style={{ height: '320px' }} />
          </Link>

          <div className="animate-fade-up">
            <h1 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '30px', letterSpacing: '-0.02em', color: 'var(--tulip-forest)' }}>
              {t('auth.signin')}
            </h1>
            <p style={{ color: 'var(--tulip-forest)', opacity: 0.6, fontSize: '15px', marginTop: '6px' }}>
              {t('auth.welcomeBack')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5 animate-fade-up-delay-1">
            <div>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--tulip-forest)' }} className="block mb-1.5">
                {t('auth.email')}
              </label>
              <input
                type="email"
                required
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="you@organisation.org"
                className="w-full px-4 py-3 rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 focus:outline-none focus:ring-2 focus:ring-[var(--tulip-gold)]/30 focus:border-[var(--tulip-gold)] transition-all text-sm"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--tulip-forest)' }}>
                  {t('auth.password')}
                </label>
                <a href="#" style={{ fontSize: '13px', color: 'var(--tulip-forest)' }} className="hover:underline">
                  {t('auth.forgotPassword')}
                </a>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 focus:outline-none focus:ring-2 focus:ring-[var(--tulip-gold)]/30 focus:border-[var(--tulip-gold)] transition-all text-sm pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--tulip-forest)]/40 hover:text-[var(--tulip-forest)]/70"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-lg text-[var(--tulip-forest)] font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: 'var(--tulip-gold)' }}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-[var(--tulip-forest)]/30 border-t-[var(--tulip-forest)] rounded-full animate-spin" />
              ) : (
                <>{t('auth.signin')} <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <div className="mt-6 text-center animate-fade-up-delay-2">
            <p style={{ color: 'var(--tulip-forest)', opacity: 0.6, fontSize: '14px' }}>
              {t('auth.noAccount')}{' '}
              <a href="/register" style={{ color: 'var(--tulip-forest)', fontWeight: 500 }} className="hover:underline">
                {t('auth.registerHere')}
              </a>
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-[var(--tulip-sage-dark)] animate-fade-up-delay-3">
            <p style={{ color: 'var(--tulip-forest)', opacity: 0.7, fontSize: '12px', textAlign: 'center', lineHeight: 1.6 }}>
              {t('auth.verifyPublicly')}{' '}
              <Link href="/verify" style={{ color: 'var(--tulip-forest)' }} className="hover:underline">
                {t('auth.verifyHash')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
