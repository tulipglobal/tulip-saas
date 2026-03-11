'use client'

import Link from 'next/link'
import { Shield, FileCheck, Lock, ArrowRight } from 'lucide-react'

export default function DonorLandingPage() {
  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col" style={{ fontFamily: 'DM Sans, sans-serif' }}>

      {/* Nav */}
      <nav className="border-b border-gray-200 bg-[#07224a]/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
              <Shield className="w-4 h-4 text-gray-900" />
            </div>
            <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '18px', color: 'white' }}>
              tulip<span style={{ color: '#10b981' }}>ds</span>
            </span>
            <span className="text-gray-300 text-sm ml-1">| Donor Portal</span>
          </Link>
          <Link href="/login" className="text-gray-500 text-sm hover:text-gray-600 transition-colors">
            NGO Login
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <div className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
          <Shield className="w-8 h-8 text-gray-900" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
          Donor Transparency Portal
        </h1>
        <p className="text-gray-500 text-lg max-w-xl mx-auto mb-10 leading-relaxed">
          Your NGO partner shares verified documents with you in real time. Every document is blockchain-sealed and cannot be altered.
        </p>
        <Link
          href="/donor/login"
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-gray-900 font-semibold text-sm hover:opacity-90 transition-opacity"
          style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
        >
          Sign in to Donor Portal
          <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      {/* Features */}
      <section className="px-6 pb-24">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="rounded-2xl border border-gray-200 bg-white/[0.03] p-8 text-center">
            <div className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center bg-emerald-500/10">
              <Shield className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-gray-900 font-semibold text-base mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
              Blockchain Verified
            </h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              Every document is SHA-256 hashed and anchored to Polygon blockchain
            </p>
          </div>

          {/* Card 2 */}
          <div className="rounded-2xl border border-gray-200 bg-white/[0.03] p-8 text-center">
            <div className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center bg-emerald-500/10">
              <FileCheck className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-gray-900 font-semibold text-base mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
              Real-Time Access
            </h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              View all shared documents as soon as they&apos;re uploaded by your NGO partner
            </p>
          </div>

          {/* Card 3 */}
          <div className="rounded-2xl border border-gray-200 bg-white/[0.03] p-8 text-center">
            <div className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center bg-emerald-500/10">
              <Lock className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-gray-900 font-semibold text-base mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
              Tamper-Proof
            </h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              Cryptographic sealing ensures no document can be altered after upload
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-4">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between">
          <p className="text-white/15 text-xs">
            &copy; 2026 Tulip DS &middot; Bright Bytes Technology &middot; Dubai, UAE
          </p>
          <Link href="/verify" className="text-emerald-400/60 text-xs hover:text-emerald-400 transition-colors">
            Verify a document
          </Link>
        </div>
      </footer>
    </div>
  )
}
