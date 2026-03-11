'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Shield, Eye, EyeOff, ArrowRight } from 'lucide-react'

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ email: '', password: '' })

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
        alert(data.message || 'Login failed')
      }
    } catch {
      alert('Cannot connect to server. Is the backend running on port 5050?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ fontFamily: 'DM Sans, sans-serif' }}>
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 tulip-mesh flex-col justify-between p-12">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg tulip-gradient flex items-center justify-center">
            <Shield className="w-4 h-4 text-gray-900" />
          </div>
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '18px', color: 'white' }}>
            tulip<span style={{ color: '#369bff' }}>ds</span>
          </span>
        </Link>

        <div>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '40px', color: 'white', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
            Tamper-proof.<br />
            <span style={{ color: '#369bff' }}>Verifiable.</span><br />
            Trusted.
          </h2>
          <p style={{ color: '#64748b', fontSize: '16px', marginTop: '16px', lineHeight: 1.7 }}>
            Every record you create is automatically anchored to blockchain and timestamped with RFC 3161.
          </p>

          <div className="mt-10 space-y-3">
            {[
              '✓ Blockchain anchored via Polygon',
              '✓ RFC 3161 trusted timestamps',
              '✓ GDPR compliant multi-tenant',
              '✓ Shareable verification links',
            ].map(feat => (
              <p key={feat} style={{ color: '#94a3b8', fontSize: '14px' }}>{feat}</p>
            ))}
          </div>
        </div>

        <p style={{ color: '#334155', fontSize: '12px' }}>
          © 2026 Tulip DS · Bright Bytes Technology · Dubai, UAE
        </p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white dark:bg-slate-950">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <Link href="/" className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg tulip-gradient flex items-center justify-center">
              <Shield className="w-4 h-4 text-gray-900" />
            </div>
            <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '18px' }}>
              tulip<span style={{ color: '#0c7aed' }}>ds</span>
            </span>
          </Link>

          <div className="animate-fade-up">
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '30px', letterSpacing: '-0.02em' }}>
              Sign in
            </h1>
            <p style={{ color: '#64748b', fontSize: '15px', marginTop: '6px' }}>
              Welcome back. Enter your credentials to continue.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5 animate-fade-up-delay-1">
            <div>
              <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }} className="block mb-1.5">
                Email address
              </label>
              <input
                type="email"
                required
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="you@organisation.org"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all text-sm"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>
                  Password
                </label>
                <a href="#" style={{ fontSize: '13px', color: '#0c7aed' }} className="hover:underline">
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all text-sm pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-lg text-gray-900 font-semibold tulip-gradient hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Sign in <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <div className="mt-6 text-center animate-fade-up-delay-2">
            <p style={{ color: '#64748b', fontSize: '14px' }}>
              Don't have an account?{' '}
              <a href="/register" style={{ color: '#0c7aed', fontWeight: 500 }} className="hover:underline">
                Register here
              </a>
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 animate-fade-up-delay-3">
            <p style={{ color: '#94a3b8', fontSize: '12px', textAlign: 'center', lineHeight: 1.6 }}>
              Or try without logging in →{' '}
              <Link href="/verify" style={{ color: '#0c7aed' }} className="hover:underline">
                Verify a hash publicly
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
