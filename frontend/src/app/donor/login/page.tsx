'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Shield, Mail, Lock, Eye, EyeOff } from 'lucide-react'

export default function DonorLoginPage() {
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
        setError('No token in response')
        setLoading(false)
        return
      }

      localStorage.setItem('donor_token', data.token)
      localStorage.setItem('donor_user', JSON.stringify(data.user))
      router.push('/donor/dashboard')
    } catch (err) {
      console.error('[donor-login] error:', err)
      setError('Unable to connect to server. Check browser console for details.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* Nav */}
      <nav className="border-b border-gray-200 bg-white/95 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
              <Shield className="w-4 h-4 text-gray-900" />
            </div>
            <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '18px', color: 'white' }}>
              tulip<span style={{ color: '#0c7aed' }}>ds</span>
            </span>
            <span className="text-gray-300 text-sm ml-1">| Donor Portal</span>
          </Link>
          <Link href="/login" className="text-gray-500 text-sm hover:text-gray-600 transition-colors">
            NGO Login
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
              <Shield className="w-7 h-7 text-gray-900" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Inter, sans-serif' }}>
              Donor Portal
            </h1>
            <p className="text-gray-500 text-sm mt-2">
              Sign in to view your funded projects and verified documents
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
              <label className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-1.5 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="donor@example.com"
                  required
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder-white/20 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/30 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-1.5 block">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full pl-11 pr-11 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder-white/20 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/30 transition-all"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading || !email || !password}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
              {loading
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : 'Sign in as Donor'
              }
            </button>
          </form>

          <p className="text-center text-gray-300 text-xs mt-6">
            <Link href="/donor" className="text-emerald-400 hover:underline">Back to Donor Portal</Link>
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-4">
        <p className="text-center text-gray-300 text-xs">
          Tulip DS &middot; Bright Bytes Technology &middot; Dubai, UAE
        </p>
      </footer>
    </div>
  )
}
