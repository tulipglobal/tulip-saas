'use client'

import { useState, useEffect } from 'react'
import { Building2, Shield, Save, Check, AlertCircle, Bell } from 'lucide-react'
import { apiGet, apiPatch } from '@/lib/api'
import CountrySelect from '@/components/CountrySelect'

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

  // Org form
  const [orgName, setOrgName] = useState('')
  const [orgDescription, setOrgDescription] = useState('')
  const [orgWebsite, setOrgWebsite] = useState('')
  const [orgRegNumber, setOrgRegNumber] = useState('')
  const [orgCountry, setOrgCountry] = useState('')
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
      }
      if (notif) setNotifPrefs(notif)
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
        setToast({ message: 'Profile updated', type: 'success' })
      } else {
        const err = await res.json()
        setToast({ message: err.error || 'Failed to update profile', type: 'error' })
      }
    } catch {
      setToast({ message: 'Failed to update profile', type: 'error' })
    }
    setSavingProfile(false)
  }

  const savePassword = async () => {
    if (newPassword !== confirmPassword) {
      setToast({ message: 'Passwords do not match', type: 'error' })
      return
    }
    if (newPassword.length < 8) {
      setToast({ message: 'Password must be at least 8 characters', type: 'error' })
      return
    }
    setSavingPassword(true)
    try {
      const res = await apiPatch('/api/auth/password', { currentPassword, newPassword })
      if (res.ok) {
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setToast({ message: 'Password changed successfully', type: 'success' })
      } else {
        const err = await res.json()
        setToast({ message: err.error || 'Failed to change password', type: 'error' })
      }
    } catch {
      setToast({ message: 'Failed to change password', type: 'error' })
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
        setToast({ message: 'Notification preferences saved', type: 'success' })
      } else {
        setToast({ message: 'Failed to update notifications', type: 'error' })
      }
    } catch {
      setToast({ message: 'Failed to update notifications', type: 'error' })
    }
    setSavingNotif(false)
  }

  const saveOrg = async () => {
    setSavingOrg(true)
    try {
      const res = await apiPatch('/api/setup/organisation', {
        name: orgName, description: orgDescription, website: orgWebsite,
        registrationNumber: orgRegNumber, country: orgCountry,
      })
      if (res.ok) {
        const updated = await res.json()
        setOrg(updated)
        setToast({ message: 'Organisation updated', type: 'success' })
      } else {
        const err = await res.json()
        setToast({ message: err.error || 'Failed to update organisation', type: 'error' })
      }
    } catch {
      setToast({ message: 'Failed to update organisation', type: 'error' })
    }
    setSavingOrg(false)
  }

  if (loading) return (
    <div className="p-6 animate-fade-up">
      <h1 className="text-2xl font-bold text-[#183a1d]" style={{ fontFamily: 'Inter, sans-serif' }}>Settings</h1>
      <p className="text-[#183a1d]/40 text-sm mt-4">Loading...</p>
    </div>
  )

  const inputClass = 'w-full bg-[#e1eedd] border border-[#c8d6c0] rounded-lg px-4 py-2.5 text-sm text-[#183a1d] placeholder-[#183a1d]/40 outline-none focus:border-[#f6c453] focus:ring-1 focus:ring-[#f6c453] transition-all'

  return (
    <div className="p-6 space-y-6 animate-fade-up max-w-3xl">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div>
        <h1 className="text-2xl font-bold text-[#183a1d]" style={{ fontFamily: 'Inter, sans-serif' }}>Settings</h1>
        <p className="text-[#183a1d]/60 text-sm mt-1">Account and organisation settings</p>
      </div>

      {/* Profile Section */}
      <div className="rounded-xl border border-[#c8d6c0] px-5 py-5 space-y-4 bg-[#e1eedd]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-[#183a1d] bg-[#f6c453]">
            {profile?.name?.charAt(0)?.toUpperCase() ?? 'U'}
          </div>
          <div>
            <h2 className="text-sm font-medium text-[#183a1d]/60 uppercase tracking-wide">Profile</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-[#183a1d]/40 block mb-1">Full Name</label>
            <input className={inputClass} value={profileName} onChange={e => setProfileName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-[#183a1d]/40 block mb-1">Email</label>
            <input className={inputClass} type="email" value={profileEmail} onChange={e => setProfileEmail(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button onClick={saveProfile} disabled={savingProfile}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#f6c453] text-[#183a1d] hover:bg-[#f0a04b] disabled:opacity-50 transition-all">
            <Save size={14} />
            {savingProfile ? 'Saving...' : 'Save Profile'}
          </button>
          <span className="text-xs text-[#183a1d]/30">Member since {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}</span>
        </div>
      </div>

      {/* Security / Password Section */}
      <div className="rounded-xl border border-[#c8d6c0] px-5 py-5 space-y-4 bg-[#e1eedd]">
        <div className="flex items-center gap-3">
          <Shield size={18} className="text-[#183a1d]/60" />
          <h2 className="text-sm font-medium text-[#183a1d]/60 uppercase tracking-wide">Change Password</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 max-w-md">
          <div>
            <label className="text-xs text-[#183a1d]/40 block mb-1">Current Password</label>
            <input className={inputClass} type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Enter current password" />
          </div>
          <div>
            <label className="text-xs text-[#183a1d]/40 block mb-1">New Password</label>
            <input className={inputClass} type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 8 characters" />
          </div>
          <div>
            <label className="text-xs text-[#183a1d]/40 block mb-1">Confirm New Password</label>
            <input className={inputClass} type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm new password" />
          </div>
        </div>
        <button onClick={savePassword} disabled={savingPassword || !currentPassword || !newPassword}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#f6c453] text-[#183a1d] hover:bg-[#f0a04b] disabled:opacity-50 transition-all">
          <Save size={14} />
          {savingPassword ? 'Saving...' : 'Change Password'}
        </button>
      </div>

      {/* Email Notifications Section */}
      <div className="rounded-xl border border-[#c8d6c0] px-5 py-5 space-y-4 bg-[#e1eedd]">
        <div className="flex items-center gap-3">
          <Bell size={18} className="text-[#183a1d]/60" />
          <h2 className="text-sm font-medium text-[#183a1d]/60 uppercase tracking-wide">Email Notifications</h2>
        </div>
        <p className="text-xs text-[#183a1d]/50">Choose which email alerts your organisation receives.</p>
        <div className="space-y-3">
          {[
            { key: 'fraud', label: 'Fraud alerts', desc: 'When a receipt is blocked for high fraud risk' },
            { key: 'duplicate', label: 'Duplicate alerts', desc: 'When a duplicate receipt is detected and blocked' },
            { key: 'mismatch', label: 'Mismatch alerts', desc: 'When OCR values differ from logged expense data' },
            { key: 'void', label: 'Void notifications', desc: 'When an expense is voided by a team member' },
            { key: 'seal', label: 'Seal confirmations', desc: 'When a Trust Seal is issued for a document' },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between py-2 border-b border-[#c8d6c0]/50 last:border-0">
              <div>
                <p className="text-sm font-medium text-[#183a1d]">{label}</p>
                <p className="text-xs text-[#183a1d]/40">{desc}</p>
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
          {savingNotif ? 'Saving...' : 'Save Notifications'}
        </button>
      </div>

      {/* Organisation Section */}
      <div className="rounded-xl border border-[#c8d6c0] px-5 py-5 space-y-4 bg-[#e1eedd]">
        <div className="flex items-center gap-3">
          <Building2 size={18} className="text-[#183a1d]/60" />
          <h2 className="text-sm font-medium text-[#183a1d]/60 uppercase tracking-wide">Organisation</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-[#183a1d]/40 block mb-1">Organisation Name</label>
            <input className={inputClass} value={orgName} onChange={e => setOrgName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-[#183a1d]/40 block mb-1">Country</label>
            <CountrySelect value={orgCountry} onChange={setOrgCountry} />
          </div>
          <div>
            <label className="text-xs text-[#183a1d]/40 block mb-1">Website</label>
            <input className={inputClass} value={orgWebsite} onChange={e => setOrgWebsite(e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <label className="text-xs text-[#183a1d]/40 block mb-1">Registration Number</label>
            <input className={inputClass} value={orgRegNumber} onChange={e => setOrgRegNumber(e.target.value)} placeholder="e.g. REG-12345" />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-[#183a1d]/40 block mb-1">Description</label>
            <textarea className={inputClass + ' min-h-[80px] resize-y'} value={orgDescription} onChange={e => setOrgDescription(e.target.value)} placeholder="Brief description of your organisation" />
          </div>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button onClick={saveOrg} disabled={savingOrg}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#f6c453] text-[#183a1d] hover:bg-[#f0a04b] disabled:opacity-50 transition-all">
            <Save size={14} />
            {savingOrg ? 'Saving...' : 'Save Organisation'}
          </button>
          {org?.id && <span className="text-xs text-[#183a1d]/30 font-mono">Tenant: {org.id.slice(0, 8)}...</span>}
        </div>
      </div>
    </div>
  )
}
