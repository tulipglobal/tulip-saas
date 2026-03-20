'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { setToken, setUser } from '@/lib/auth'
import { apiPost } from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const t = useTranslations()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await apiPost('/api/donor/auth/login', { email, password })
      if (res.ok) {
        const data = await res.json()
        setToken(data.token)
        setUser(data.user)
        window.location.href = '/dashboard'
      } else {
        const err = await res.json().catch(() => ({ error: t('auth.loginFailed') }))
        setError(err.error || t('auth.invalidCredentials'))
      }
    } catch {
      setError(t('auth.networkError'))
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--background)' }}>
      <div className="w-full max-w-md">
        <div className="bg-[var(--bg-card)] rounded-2xl shadow-lg border px-8 py-10" style={{ borderColor: 'var(--donor-border)' }}>
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold" style={{ color: '#3C3489' }}>{t('auth.sealayer')}</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--donor-muted)' }}>{t('auth.donorPortal')}</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg text-sm font-medium bg-red-50 text-red-600 border border-red-200">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--donor-dark)' }}>{t('auth.email')}</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={t('auth.emailPlaceholder')}
                required
                className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all"
                style={{
                  background: 'var(--donor-light)',
                  border: '1px solid var(--donor-border)',
                  color: 'var(--donor-dark)',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--donor-accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--donor-border)'}
              />
            </div>

            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--donor-dark)' }}>{t('auth.password')}</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={t('auth.passwordPlaceholder')}
                required
                className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all"
                style={{
                  background: 'var(--donor-light)',
                  border: '1px solid var(--donor-border)',
                  color: 'var(--donor-dark)',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--donor-accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--donor-border)'}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: '#3C3489' }}
              onMouseEnter={e => (e.target as HTMLElement).style.background = '#4A41A0'}
              onMouseLeave={e => (e.target as HTMLElement).style.background = '#3C3489'}
            >
              {loading ? t('auth.signingIn') : t('auth.signIn')}
            </button>
          </form>

          {/* Invite link */}
          <div className="mt-6 text-center">
            <Link href="/signup" className="text-sm hover:underline" style={{ color: 'var(--donor-accent)' }}>
              {t('auth.haveInvite')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
