'use client'

import { useState, useEffect } from 'react'
import { Settings, User, Building2, Shield, LogOut } from 'lucide-react'
import { apiGet, apiPost } from '@/lib/api'
import { useRouter } from 'next/navigation'

interface UserProfile {
  id: string
  name: string
  email: string
  tenantId: string
  createdAt: string
}

export default function SettingsPage() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Load from localStorage for initial render
    try {
      const stored = localStorage.getItem('tulip_user')
      if (stored) setUser(JSON.parse(stored))
    } catch {}

    // Always fetch from API to get full profile (including createdAt)
    apiGet('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          const profile = d.user ?? d
          setUser(profile)
          localStorage.setItem('tulip_user', JSON.stringify(profile))
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleSignOut = async () => {
    try {
      const refreshToken = localStorage.getItem('tulip_refresh')
      const accessToken = localStorage.getItem('tulip_token')
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({ refreshToken }),
      })
    } catch {}
    localStorage.removeItem('tulip_token')
    localStorage.removeItem('tulip_refresh')
    localStorage.removeItem('tulip_user')
    router.push('/login')
  }

  if (loading && !user) return (
    <div className="p-6 animate-fade-up">
      <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Settings</h1>
      <p className="text-white/30 text-sm mt-4">Loading...</p>
    </div>
  )

  return (
    <div className="p-6 space-y-6 animate-fade-up">
      <div>
        <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Settings</h1>
        <p className="text-white/40 text-sm mt-1">Account and organization settings</p>
      </div>

      {/* Profile */}
      <div className="rounded-xl border border-white/8 px-5 py-5 space-y-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
            {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
          </div>
          <div>
            <h2 className="text-sm font-medium text-white/50 uppercase tracking-wide">Profile</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-white/30 block mb-1">Name</label>
            <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white/70">
              {user?.name ?? '—'}
            </div>
          </div>
          <div>
            <label className="text-xs text-white/30 block mb-1">Email</label>
            <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white/70">
              {user?.email ?? '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Organization */}
      <div className="rounded-xl border border-white/8 px-5 py-5 space-y-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="flex items-center gap-3">
          <Building2 size={18} className="text-white/40" />
          <h2 className="text-sm font-medium text-white/50 uppercase tracking-wide">Organization</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-white/30 block mb-1">Tenant ID</label>
            <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white/40 font-mono">
              {user?.tenantId ?? '—'}
            </div>
          </div>
          <div>
            <label className="text-xs text-white/30 block mb-1">Member Since</label>
            <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white/70">
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="rounded-xl border border-white/8 px-5 py-5 space-y-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="flex items-center gap-3">
          <Shield size={18} className="text-white/40" />
          <h2 className="text-sm font-medium text-white/50 uppercase tracking-wide">Security</h2>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-sm text-white/70">Authentication</div>
              <div className="text-xs text-white/30 mt-0.5">JWT bearer token with refresh rotation</div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs bg-green-400/10 text-green-400 border border-green-400/20">Active</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-sm text-white/70">Blockchain Anchoring</div>
              <div className="text-xs text-white/30 mt-0.5">Polygon Amoy — Merkle root batching every 5 minutes</div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs bg-green-400/10 text-green-400 border border-green-400/20">Enabled</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-sm text-white/70">RFC 3161 Timestamping</div>
              <div className="text-xs text-white/30 mt-0.5">FreeTSA — batch stamping every 10 minutes</div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs bg-green-400/10 text-green-400 border border-green-400/20">Enabled</span>
          </div>
        </div>
      </div>

      {/* Sign Out */}
      <button onClick={handleSignOut}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-red-400 border border-red-400/20 hover:bg-red-400/5 transition-colors">
        <LogOut size={16} />
        Sign Out
      </button>
    </div>
  )
}
