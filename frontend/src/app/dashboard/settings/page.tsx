'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Building2, Shield, Save, Check, AlertCircle, Bell, Coins, Lock, Key } from 'lucide-react'
import { apiGet, apiPatch, apiPost, apiPut } from '@/lib/api'
import CountrySelect from '@/components/CountrySelect'
import CurrencySelect from '@/components/CurrencySelect'

interface Profile {
  id: string
  name: string
  email: string
  tenantId: string
  tenantName: string
  completedSetup: boolean
  createdAt: string
}

interface OrgDetails {
  id: string
  name: string
  description: string | null
  website: string | null
  registrationNumber: string | null
  country: string | null
  logoUrl: string | null
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t) }, [onClose])
  return (
    <div className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium shadow-lg ${type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
      {type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
      {message}
    </div>
  )
}

export default function SettingsPage() {
  const t = useTranslations()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [org, setOrg] = useState<OrgDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Profile form
  const [profileName, setProfileName] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  // Password form
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  // Notification prefs
  const [notifPrefs, setNotifPrefs] = useState({ fraud: true, duplicate: true, mismatch: true, void: true, seal: false })
  const [savingNotif, setSavingNotif] = useState(false)

  // SSO config
  const [ssoConfig, setSsoConfig] = useState<{ provider: string; isEnabled: boolean; entryPoint?: string; issuer?: string; clientId?: string; callbackUrl?: string; cert?: string } | null>(null)
  const [ssoProvider, setSsoProvider] = useState('GOOGLE')
  const [ssoEntryPoint, setSsoEntryPoint] = useState('')
  const [ssoIssuer, setSsoIssuer] = useState('')
  const [ssoCert, setSsoCert] = useState('')
  const [ssoClientId, setSsoClientId] = useState('')
  const [ssoClientSecret, setSsoClientSecret] = useState('')
  const [ssoCallbackUrl, setSsoCallbackUrl] = useState('')
  const [savingSSO, setSavingSSO] = useState(false)

  // Org form
  const [orgName, setOrgName] = useState('')
  const [orgDescription, setOrgDescription] = useState('')
  const [orgWebsite, setOrgWebsite] = useState('')
  const [orgRegNumber, setOrgRegNumber] = useState('')
  const [orgCountry, setOrgCountry] = useState('')
  const [orgCurrency, setOrgCurrency] = useState('USD')
  const [savingOrg, setSavingOrg] = useState(false)

  useEffect(() => {
    Promise.all([
      apiGet('/api/auth/me').then(r => r.ok ? r.json() : null),
      apiGet('/api/setup/status').then(r => r.ok ? r.json() : null),
      apiGet('/api/setup/notifications').then(r => r.ok ? r.json() : null),
    ]).then(([me, setup, notif]) => {
      const p = me?.user ?? me
      if (p) {
        setProfile(p)
        setProfileName(p.name || '')
        setProfileEmail(p.email || '')
      }
      if (setup) {
        console.log('[settings] raw org API response:', JSON.stringify(setup))
        setOrg(setup)
        setOrgName(setup.name || '')
        setOrgDescription(setup.description || '')
        setOrgWebsite(setup.website || '')
        setOrgRegNumber(setup.registrationNumber || setup.registration_number || '')
        setOrgCountry(setup.country || '')
        setOrgCurrency(setup.baseCurrency || 'USD')
      }
      if (notif) setNotifPrefs(notif)
      // Fetch SSO config
      apiGet('/api/admin/sso/config').then(r => r.ok ? r.json() : null).then(data => {
        if (data?.config) {
          setSsoConfig(data.config)
          setSsoProvider(data.config.provider || 'GOOGLE')
          setSsoEntryPoint(data.config.entryPoint || '')
          setSsoIssuer(data.config.issuer || '')
          setSsoClientId(data.config.clientId || '')
          setSsoCallbackUrl(data.config.callbackUrl || '')
        }
      }).catch(() => {})
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const saveProfile = async () => {
    setSavingProfile(true)
    try {
      const res = await apiPatch('/api/auth/profile', { name: profileName, email: profileEmail })
      if (res.ok) {
        const updated = await res.json()
        setProfile(prev => prev ? { ...prev, name: updated.name, email: updated.email } : prev)
        // Update localStorage
        const stored = localStorage.getItem('tulip_user')
        if (stored) {
          const u = JSON.parse(stored)
          localStorage.setItem('tulip_user', JSON.stringify({ ...u, name: updated.name, email: updated.email }))
        }
        setToast({ message: t('settings.profileUpdated'), type: 'success' })
      } else {
        const err = await res.json()
        setToast({ message: err.error || t('settings.failedUpdateProfile'), type: 'error' })
      }
    } catch {
      setToast({ message: t('settings.failedUpdateProfile'), type: 'error' })
    }
    setSavingProfile(false)
  }

  const savePassword = async () => {
    if (newPassword !== confirmPassword) {
      setToast({ message: t('settings.passwordsNotMatch'), type: 'error' })
      return
    }
    if (newPassword.length < 8) {
      setToast({ message: t('settings.passwordMinLength'), type: 'error' })
      return
    }
    setSavingPassword(true)
    try {
      const res = await apiPatch('/api/auth/password', { currentPassword, newPassword })
      if (res.ok) {
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setToast({ message: t('settings.passwordChanged'), type: 'success' })
      } else {
        const err = await res.json()
        setToast({ message: err.error || t('settings.failedChangePassword'), type: 'error' })
      }
    } catch {
      setToast({ message: t('settings.failedChangePassword'), type: 'error' })
    }
    setSavingPassword(false)
  }

  const toggleNotif = (key: string) => {
    setNotifPrefs(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }))
  }

  const saveNotif = async () => {
    setSavingNotif(true)
    try {
      const res = await apiPatch('/api/setup/notifications', notifPrefs)
      if (res.ok) {
        const updated = await res.json()
        setNotifPrefs(updated)
        setToast({ message: t('settings.notifSaved'), type: 'success' })
      } else {
        setToast({ message: t('settings.failedUpdateNotif'), type: 'error' })
      }
    } catch {
      setToast({ message: t('settings.failedUpdateNotif'), type: 'error' })
    }
    setSavingNotif(false)
  }

  const saveOrg = async () => {
    setSavingOrg(true)
    try {
      const res = await apiPatch('/api/setup/organisation', {
        name: orgName, description: orgDescription, website: orgWebsite,
        registrationNumber: orgRegNumber, country: orgCountry, baseCurrency: orgCurrency,
      })
      if (res.ok) {
        const updated = await res.json()
        setOrg(updated)
        setToast({ message: t('settings.orgUpdated'), type: 'success' })
      } else {
        const err = await res.json()
        setToast({ message: err.error || t('settings.failedUpdateOrg'), type: 'error' })
      }
    } catch {
      setToast({ message: t('settings.failedUpdateOrg'), type: 'error' })
    }
    setSavingOrg(false)
  }

  if (loading) return (
    <div className="p-6 animate-fade-up">
      <h1 className="text-2xl font-bold text-[#183a1d]" style={{ fontFamily: 'Inter, sans-serif' }}>{t('settings.title')}</h1>
      <p className="text-[#183a1d]/40 text-sm mt-4">{t('common.loading')}</p>
    </div>
  )

  const inputClass = 'w-full bg-[#e1eedd] border border-[#c8d6c0] rounded-lg px-4 py-2.5 text-sm text-[#183a1d] placeholder-[#183a1d]/40 outline-none focus:border-[#f6c453] focus:ring-1 focus:ring-[#f6c453] transition-all'

  return (
    <div className="p-6 space-y-6 animate-fade-up max-w-3xl">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div>
        <h1 className="text-2xl font-bold text-[#183a1d]" style={{ fontFamily: 'Inter, sans-serif' }}>{t('settings.title')}</h1>
        <p className="text-[#183a1d]/60 text-sm mt-1">{t('settings.subtitle')}</p>
      </div>

      {/* Profile Section */}
      <div className="rounded-xl border border-[#c8d6c0] px-5 py-5 space-y-4 bg-[#e1eedd]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-[#183a1d] bg-[#f6c453]">
            {profile?.name?.charAt(0)?.toUpperCase() ?? 'U'}
          </div>
          <div>
            <h2 className="text-sm font-medium text-[#183a1d]/60 uppercase tracking-wide">{t('settings.profile')}</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-[#183a1d]/40 block mb-1">{t('settings.fullName')}</label>
            <input className={inputClass} value={profileName} onChange={e => setProfileName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-[#183a1d]/40 block mb-1">{t('settings.email')}</label>
            <input className={inputClass} type="email" value={profileEmail} onChange={e => setProfileEmail(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button onClick={saveProfile} disabled={savingProfile}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#f6c453] text-[#183a1d] hover:bg-[#f0a04b] disabled:opacity-50 transition-all">
            <Save size={14} />
            {savingProfile ? t('common.saving') : t('settings.saveProfile')}
          </button>
          <span className="text-xs text-[#183a1d]/30">{t('settings.memberSince')} {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}</span>
        </div>
      </div>

      {/* Security / Password Section */}
      <div className="rounded-xl border border-[#c8d6c0] px-5 py-5 space-y-4 bg-[#e1eedd]">
        <div className="flex items-center gap-3">
          <Shield size={18} className="text-[#183a1d]/60" />
          <h2 className="text-sm font-medium text-[#183a1d]/60 uppercase tracking-wide">{t('settings.changePassword')}</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 max-w-md">
          <div>
            <label className="text-xs text-[#183a1d]/40 block mb-1">{t('settings.currentPassword')}</label>
            <input className={inputClass} type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Enter current password" />
          </div>
          <div>
            <label className="text-xs text-[#183a1d]/40 block mb-1">{t('settings.newPassword')}</label>
            <input className={inputClass} type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 8 characters" />
          </div>
          <div>
            <label className="text-xs text-[#183a1d]/40 block mb-1">{t('settings.confirmPassword')}</label>
            <input className={inputClass} type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm new password" />
          </div>
        </div>
        <button onClick={savePassword} disabled={savingPassword || !currentPassword || !newPassword}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#f6c453] text-[#183a1d] hover:bg-[#f0a04b] disabled:opacity-50 transition-all">
          <Save size={14} />
          {savingPassword ? t('common.saving') : t('settings.changePassword')}
        </button>
      </div>

      {/* Email Notifications Section */}
      <div className="rounded-xl border border-[#c8d6c0] px-5 py-5 space-y-4 bg-[#e1eedd]">
        <div className="flex items-center gap-3">
          <Bell size={18} className="text-[#183a1d]/60" />
          <h2 className="text-sm font-medium text-[#183a1d]/60 uppercase tracking-wide">{t('settings.emailNotifications')}</h2>
        </div>
        <p className="text-xs text-[#183a1d]/50">{t('settings.notifDesc')}</p>
        <div className="space-y-3">
          {[
            { key: 'fraud', labelKey: 'settings.fraudAlerts', descKey: 'settings.fraudAlertsDesc' },
            { key: 'duplicate', labelKey: 'settings.duplicateAlerts', descKey: 'settings.duplicateAlertsDesc' },
            { key: 'mismatch', labelKey: 'settings.mismatchAlerts', descKey: 'settings.mismatchAlertsDesc' },
            { key: 'void', labelKey: 'settings.voidNotif', descKey: 'settings.voidNotifDesc' },
            { key: 'seal', labelKey: 'settings.sealConfirmations', descKey: 'settings.sealConfirmationsDesc' },
          ].map(({ key, labelKey, descKey }) => (
            <div key={key} className="flex items-center justify-between py-2 border-b border-[#c8d6c0]/50 last:border-0">
              <div>
                <p className="text-sm font-medium text-[#183a1d]">{t(labelKey)}</p>
                <p className="text-xs text-[#183a1d]/40">{t(descKey)}</p>
              </div>
              <button
                onClick={() => toggleNotif(key)}
                className={`relative w-10 h-5 rounded-full transition-colors ${notifPrefs[key as keyof typeof notifPrefs] ? 'bg-[#0d9488]' : 'bg-[#c8d6c0]'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${notifPrefs[key as keyof typeof notifPrefs] ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          ))}
        </div>
        <button onClick={saveNotif} disabled={savingNotif}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#f6c453] text-[#183a1d] hover:bg-[#f0a04b] disabled:opacity-50 transition-all">
          <Save size={14} />
          {savingNotif ? t('common.saving') : t('settings.saveNotifications')}
        </button>
      </div>

      {/* Organisation Section */}
      <div className="rounded-xl border border-[#c8d6c0] px-5 py-5 space-y-4 bg-[#e1eedd]">
        <div className="flex items-center gap-3">
          <Building2 size={18} className="text-[#183a1d]/60" />
          <h2 className="text-sm font-medium text-[#183a1d]/60 uppercase tracking-wide">{t('settings.organization')}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-[#183a1d]/40 block mb-1">{t('settings.orgName')}</label>
            <input className={inputClass} value={orgName} onChange={e => setOrgName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-[#183a1d]/40 block mb-1">{t('settings.country')}</label>
            <CountrySelect value={orgCountry} onChange={setOrgCountry} />
          </div>
          <div>
            <label className="text-xs text-[#183a1d]/40 block mb-1">{t('settings.baseCurrency')}</label>
            <CurrencySelect value={orgCurrency} onChange={setOrgCurrency} />
          </div>
          <div>
            <label className="text-xs text-[#183a1d]/40 block mb-1">{t('settings.website')}</label>
            <input className={inputClass} value={orgWebsite} onChange={e => setOrgWebsite(e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <label className="text-xs text-[#183a1d]/40 block mb-1">{t('settings.registrationNumber')}</label>
            <input className={inputClass} value={orgRegNumber} onChange={e => setOrgRegNumber(e.target.value)} placeholder="e.g. REG-12345" />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-[#183a1d]/40 block mb-1">{t('settings.description')}</label>
            <textarea className={inputClass + ' min-h-[80px] resize-y'} value={orgDescription} onChange={e => setOrgDescription(e.target.value)} placeholder="Brief description of your organisation" />
          </div>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button onClick={saveOrg} disabled={savingOrg}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#f6c453] text-[#183a1d] hover:bg-[#f0a04b] disabled:opacity-50 transition-all">
            <Save size={14} />
            {savingOrg ? t('common.saving') : t('settings.saveOrganisation')}
          </button>
          {org?.id && <span className="text-xs text-[#183a1d]/30 font-mono">Tenant: {org.id.slice(0, 8)}...</span>}
        </div>
      </div>

      {/* ── Enterprise SSO ──────────────────────── */}
      <div className="rounded-xl border border-[#c8d6c0] p-5" style={{ background: '#e1eedd' }}>
        <div className="flex items-center gap-2 mb-4">
          <Key size={18} className="text-[#183a1d]" />
          <h3 className="text-base font-semibold text-[#183a1d]">Enterprise SSO</h3>
        </div>

        {!ssoConfig?.isEnabled ? (
          /* Locked state — SSO not enabled for this tenant */
          <div className="flex items-center gap-4 p-4 rounded-lg" style={{ background: '#fefbe9', border: '1px solid #c8d6c0' }}>
            <Lock size={24} className="text-[#183a1d]/30 shrink-0" />
            <div>
              <p className="text-sm font-medium text-[#183a1d]">Single Sign-On is not enabled</p>
              <p className="text-xs text-[#183a1d]/50 mt-1">Connect your identity provider (Google, Microsoft, Okta, SAML) for seamless single sign-on. Contact us to enable this feature for your organisation.</p>
              <a href="mailto:support@sealayer.io?subject=Enable%20SSO" className="text-xs font-medium text-[#0c7aed] hover:underline mt-2 inline-block">Contact us to enable →</a>
            </div>
          </div>
        ) : (
          /* SSO enabled — show configuration form */
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs font-medium text-green-700">SSO Enabled</span>
            </div>

            <div>
              <label className="text-xs text-[#183a1d]/40 block mb-2">Provider</label>
              <div className="flex gap-2">
                {['SAML', 'GOOGLE', 'MICROSOFT', 'OKTA'].map(p => (
                  <button key={p} onClick={() => setSsoProvider(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${ssoProvider === p ? 'bg-[#f6c453] text-[#183a1d]' : 'bg-white text-[#183a1d]/60 border border-[#c8d6c0] hover:border-[#f6c453]'}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {(ssoProvider === 'GOOGLE' || ssoProvider === 'MICROSOFT') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#183a1d]/40 block mb-1">Client ID</label>
                  <input className={inputClass} value={ssoClientId} onChange={e => setSsoClientId(e.target.value)} placeholder="your-client-id.apps.googleusercontent.com" />
                </div>
                <div>
                  <label className="text-xs text-[#183a1d]/40 block mb-1">Client Secret</label>
                  <input className={inputClass} type="password" value={ssoClientSecret} onChange={e => setSsoClientSecret(e.target.value)} placeholder="••••••••" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-[#183a1d]/40 block mb-1">Callback URL</label>
                  <input className={inputClass} value={ssoCallbackUrl} onChange={e => setSsoCallbackUrl(e.target.value)} placeholder={`https://api.tulipds.com/api/auth/sso/callback/${ssoProvider.toLowerCase()}`} />
                </div>
              </div>
            )}

            {(ssoProvider === 'SAML' || ssoProvider === 'OKTA') && (
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-xs text-[#183a1d]/40 block mb-1">Entry Point URL</label>
                  <input className={inputClass} value={ssoEntryPoint} onChange={e => setSsoEntryPoint(e.target.value)} placeholder="https://idp.example.com/sso/saml" />
                </div>
                <div>
                  <label className="text-xs text-[#183a1d]/40 block mb-1">Issuer</label>
                  <input className={inputClass} value={ssoIssuer} onChange={e => setSsoIssuer(e.target.value)} placeholder="https://idp.example.com" />
                </div>
                <div>
                  <label className="text-xs text-[#183a1d]/40 block mb-1">Certificate (PEM)</label>
                  <textarea className={inputClass + ' min-h-[80px] resize-y font-mono text-xs'} value={ssoCert} onChange={e => setSsoCert(e.target.value)} placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----" />
                </div>
                <div>
                  <label className="text-xs text-[#183a1d]/40 block mb-1">Callback URL (ACS)</label>
                  <input className={inputClass} value={ssoCallbackUrl} onChange={e => setSsoCallbackUrl(e.target.value)} placeholder="https://api.tulipds.com/api/auth/sso/callback/saml" />
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button onClick={async () => {
                setSavingSSO(true)
                try {
                  const resp = await apiPost('/api/admin/sso/config', { provider: ssoProvider, entryPoint: ssoEntryPoint, issuer: ssoIssuer, cert: ssoCert || undefined, clientId: ssoClientId, clientSecret: ssoClientSecret || undefined, callbackUrl: ssoCallbackUrl })
                  if (resp.ok) {
                    setToast({ message: 'SSO configuration saved', type: 'success' })
                    const data = await resp.json()
                    if (data.config) setSsoConfig(data.config)
                  } else {
                    setToast({ message: 'Failed to save SSO config', type: 'error' })
                  }
                } catch { setToast({ message: 'Failed to save SSO config', type: 'error' }) }
                setSavingSSO(false)
              }} disabled={savingSSO}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#f6c453] text-[#183a1d] hover:bg-[#f0a04b] disabled:opacity-50 transition-all">
                <Save size={14} />
                {savingSSO ? 'Saving...' : 'Save Configuration'}
              </button>
              <button onClick={async () => {
                const resp = await apiPut('/api/admin/sso/config/toggle', { enabled: false })
                if (resp.ok) {
                  setSsoConfig(prev => prev ? { ...prev, isEnabled: false } : null)
                  setToast({ message: 'SSO disabled', type: 'success' })
                }
              }} className="text-xs text-red-600 hover:underline">
                Disable SSO
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
