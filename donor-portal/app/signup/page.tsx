'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { setToken, setUser } from '@/lib/auth'
import { apiGet, apiPost } from '@/lib/api'

interface InviteData {
  email: string
  donorOrgName: string
  tenantName: string
  projectNames: string[]
  projectIds: string[]
  existingAccount?: boolean
}

function SignupForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const t = useTranslations()

  const [invite, setInvite] = useState<InviteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expired, setExpired] = useState(false)

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) {
      setError(t('auth.noInviteToken'))
      setLoading(false)
      return
    }
    apiGet(`/api/donor/invite/validate/${token}`)
      .then(async r => {
        if (r.ok) {
          const data = await r.json()
          setInvite(data)
        } else {
          const err = await r.json().catch(() => ({ error: t('auth.invalidInvite') }))
          if (err.error?.includes('expired')) setExpired(true)
          setError(err.error || t('auth.invalidInvite'))
        }
        setLoading(false)
      })
      .catch(() => {
        setError(t('auth.failedToValidateInvite'))
        setLoading(false)
      })
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Existing accounts just need to accept — no password validation needed
    if (!invite?.existingAccount) {
      if (password !== confirmPassword) {
        setError(t('auth.passwordsDoNotMatch'))
        return
      }
      if (password.length < 8) {
        setError(t('auth.passwordMinError'))
        return
      }
    }

    setSubmitting(true)
    try {
      const res = await apiPost('/api/donor/auth/invite/accept', {
        token,
        name: name || invite?.email || 'Donor',
        password: password || 'existing-account',
      })
      if (res.ok) {
        const data = await res.json()
        if (data.user?.existingAccount) {
          // Existing account — redirect to login instead of auto-login
          // (they should use their existing password)
          window.location.href = '/login'
        } else {
          setToken(data.token)
          setUser(data.user)
          window.location.href = '/dashboard'
        }
      } else {
        const err = await res.json().catch(() => ({ error: t('auth.failedToAcceptInvite') }))
        setError(err.error || t('auth.failedToAcceptInvite'))
      }
    } catch {
      setError(t('auth.networkError'))
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <p style={{ color: 'var(--donor-muted)' }} className="text-sm">{t('auth.validatingInvite')}</p>
      </div>
    )
  }

  if (expired || (!invite && error)) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--background)' }}>
        <div className="w-full max-w-md bg-[var(--bg-card)] rounded-2xl shadow-lg border px-8 py-10 text-center" style={{ borderColor: 'var(--donor-border)' }}>
          <h1 className="text-2xl font-bold mb-2" style={{ color: '#3C3489' }}>{t('auth.sealayer')}</h1>
          <p className="text-sm mb-6" style={{ color: 'var(--donor-muted)' }}>{t('auth.donorPortal')}</p>
          <div className="px-4 py-3 rounded-lg text-sm bg-red-50 text-red-600 border border-red-200 mb-4">
            {expired ? t('auth.inviteExpired') : error}
          </div>
          <Link href="/login" className="text-sm hover:underline" style={{ color: 'var(--donor-accent)' }}>
            {t('auth.goToLogin')}
          </Link>
        </div>
      </div>
    )
  }

  // Existing account flow — just accept and redirect to login
  const isExisting = invite?.existingAccount

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--background)' }}>
      <div className="w-full max-w-md">
        <div className="bg-[var(--bg-card)] rounded-2xl shadow-lg border px-8 py-10" style={{ borderColor: 'var(--donor-border)' }}>
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold" style={{ color: '#3C3489' }}>{t('auth.sealayer')}</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--donor-muted)' }}>{t('auth.donorPortal')}</p>
          </div>

          {/* Invite info */}
          <div className="rounded-xl px-4 py-4 mb-6" style={{ background: 'var(--donor-light)', border: '1px solid var(--donor-border)' }}>
            <p className="text-sm" style={{ color: 'var(--donor-dark)' }}>
              {isExisting
                ? <>{t('auth.newProjectsShared')} <strong>{invite?.tenantName}</strong></>
                : <>{t('auth.invitedToView')} <strong>{invite?.tenantName}</strong>{t('auth.projectsOnSealayer')}</>
              }
            </p>
            {invite?.projectNames && invite.projectNames.length > 0 && (
              <div className="mt-3 space-y-1">
                {invite.projectNames.map((pname, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--donor-accent)' }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--donor-accent)' }}>{pname}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {isExisting && (
            <div className="rounded-xl px-4 py-3 mb-6" style={{ background: '#DCFCE7', border: '1px solid #BBF7D0' }}>
              <p className="text-sm text-green-700">
                {t('auth.existingAccountNote')}
              </p>
            </div>
          )}

          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg text-sm bg-red-50 text-red-600 border border-red-200">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isExisting && (
              <>
                <div>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--donor-dark)' }}>{t('auth.fullName')}</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={t('auth.fullNamePlaceholder')}
                    required
                    className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all"
                    style={{ background: 'var(--donor-light)', border: '1px solid var(--donor-border)', color: 'var(--donor-dark)' }}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--donor-dark)' }}>{t('auth.password')}</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={t('auth.passwordMinLength')}
                    required
                    className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all"
                    style={{ background: 'var(--donor-light)', border: '1px solid var(--donor-border)', color: 'var(--donor-dark)' }}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--donor-dark)' }}>{t('auth.confirmPassword')}</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder={t('auth.confirmPasswordPlaceholder')}
                    required
                    className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all"
                    style={{ background: 'var(--donor-light)', border: '1px solid var(--donor-border)', color: 'var(--donor-dark)' }}
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: '#3C3489' }}
              onMouseEnter={e => (e.target as HTMLElement).style.background = '#4A41A0'}
              onMouseLeave={e => (e.target as HTMLElement).style.background = '#3C3489'}
            >
              {submitting
                ? (isExisting ? t('auth.addingProjects') : t('auth.creatingAccount'))
                : (isExisting ? t('auth.acceptAddProjects') : t('auth.acceptInvitation'))
              }
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/login" className="text-sm hover:underline" style={{ color: 'var(--donor-accent)' }}>
              {t('auth.alreadyHaveAccount')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SignupPage() {
  const t = useTranslations()
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}><p style={{ color: 'var(--donor-muted)' }} className="text-sm">{t('auth.loading')}</p></div>}>
      <SignupForm />
    </Suspense>
  )
}
