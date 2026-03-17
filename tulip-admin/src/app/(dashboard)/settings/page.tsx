'use client'

import { useState, useEffect } from 'react'
import { apiGet, apiPut } from '@/lib/api'
import { getAdmin, setAdmin } from '@/lib/auth'
import { User, Lock, Check, AlertCircle } from 'lucide-react'

export default function SettingsPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    apiGet('/api/admin-auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setName(d.name)
          setEmail(d.email)
        }
      })
      .catch(() => {})
  }, [])

  const handleSave = async () => {
    setMessage('')
    setError('')

    if (password && password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password && password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setSaving(true)
    try {
      const body: Record<string, string> = { name }
      if (password) body.password = password

      const res = await apiPut('/api/admin-auth/profile', body)
      if (res.ok) {
        const updated = await res.json()
        setAdmin(updated)
        setPassword('')
        setConfirmPassword('')
        setMessage('Profile updated successfully')
      } else {
        const d = await res.json().catch(() => ({}))
        setError(d.error || 'Failed to update')
      }
    } catch {
      setError('Network error')
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-[var(--admin-text)]">Settings</h1>
        <p className="text-sm text-[var(--admin-text-secondary)] mt-1">Manage your admin profile</p>
      </div>

      <div className="bg-[var(--admin-card)] rounded-xl border border-[var(--admin-border)] p-6 space-y-5">
        {message && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-2 text-sm">
            <Check size={16} /> {message}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-[var(--admin-text-secondary)] mb-1.5 uppercase tracking-wide">Email</label>
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] text-sm text-[var(--admin-text-muted)]">
            <User size={16} />
            {email}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--admin-text-secondary)] mb-1.5 uppercase tracking-wide">Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full rounded-lg px-4 py-2.5 text-sm border border-[var(--admin-border)] bg-[var(--admin-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--admin-text-secondary)] mb-1.5 uppercase tracking-wide">New Password</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)]" />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Leave blank to keep current"
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50"
            />
          </div>
        </div>

        {password && (
          <div>
            <label className="block text-xs font-medium text-[var(--admin-text-secondary)] mb-1.5 uppercase tracking-wide">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full rounded-lg px-4 py-2.5 text-sm border border-[var(--admin-border)] bg-[var(--admin-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50"
            />
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-[var(--admin-accent)] hover:bg-[var(--admin-accent-hover)] disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
