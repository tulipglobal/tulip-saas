'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Shield, Eye, EyeOff, ArrowRight, Link2, ScanSearch, Users, Globe } from 'lucide-react'
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
      {/* Left panel — dark branded */}
      <div className="hidden lg:flex lg:w-1/2 flex-col relative overflow-y-auto"
        style={{ background: 'var(--tulip-forest)' }}>
        {/* Subtle glow */}
        <div className="absolute top-[-200px] left-[-200px] w-[600px] h-[600px] rounded-full opacity-[0.07] pointer-events-none"
          style={{ background: 'radial-gradient(circle, var(--tulip-gold) 0%, transparent 70%)' }} />
        <div className="absolute bottom-[-150px] right-[-150px] w-[500px] h-[500px] rounded-full opacity-[0.05] pointer-events-none"
          style={{ background: 'radial-gradient(circle, #ff751f 0%, transparent 70%)' }} />

        <div className="relative z-10 flex flex-col items-center w-full flex-1 px-14 py-12 justify-center">
          {/* Logo */}
          <Link href="/" className="block">
            <img src="/logo-dark.svg" alt="sealayer" className="mx-auto" style={{ height: '280px' }} />
          </Link>

          {/* Tagline */}
          <h2 className="mt-8" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '44px', lineHeight: 1.12, letterSpacing: '-0.02em', color: '#ffffff', textAlign: 'center' }}>
            {t('auth.tagline1')}<br />
            <span style={{ color: 'var(--tulip-gold)' }}>{t('auth.tagline2')}</span><br />
            {t('auth.tagline3')}
          </h2>

          <p className="mt-8 max-w-lg" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '15px', lineHeight: 1.7, textAlign: 'center' }}>
            {t('auth.taglineDesc')}
          </p>

          {/* Four Pillars */}
          <div className="mt-10 grid grid-cols-2 gap-4 text-left w-full max-w-xl">
            {[
              { icon: Link2, titleKey: 'auth.feat1Title', descKey: 'auth.feat1Desc' },
              { icon: ScanSearch, titleKey: 'auth.feat2Title', descKey: 'auth.feat2Desc' },
              { icon: Users, titleKey: 'auth.feat3Title', descKey: 'auth.feat3Desc' },
              { icon: Globe, titleKey: 'auth.feat4Title', descKey: 'auth.feat4Desc' },
            ].map(({ icon: Icon, titleKey, descKey }) => (
              <div key={titleKey} className="px-5 py-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center gap-2.5 mb-2">
                  <Icon className="w-4 h-4 shrink-0" style={{ color: 'var(--tulip-gold)' }} />
                  <span style={{ color: '#ffffff', fontSize: '14px', fontWeight: 700 }}>{t(titleKey)}</span>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', lineHeight: 1.5 }}>{t(descKey)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer — always at bottom */}
        <p className="relative z-10 text-center py-5 shrink-0" style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px' }}>
          © 2026 sealayer.io · Dubai, UAE
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
            <img src="/logo.svg" alt="sealayer" style={{ height: '150px' }} />
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
