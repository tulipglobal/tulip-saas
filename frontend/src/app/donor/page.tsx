'use client'

import Link from 'next/link'
import { Shield, FileCheck, Lock, ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function DonorLandingPage() {
  const t = useTranslations('donorLanding')

  return (
    <div className="min-h-screen bg-[var(--tulip-cream)] flex flex-col" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* Nav */}
      <nav className="border-b border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)]/95 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo.svg" alt="sealayer" className="h-14" />
            <span className="text-[var(--tulip-forest)]/30 text-sm">| {t('donorPortal')}</span>
          </Link>
          <Link href="/login" className="text-[var(--tulip-forest)]/60 text-sm hover:text-[var(--tulip-forest)]/70 transition-colors">
            {t('ngoLogin')}
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <div className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
          <Shield className="w-8 h-8 text-[var(--tulip-forest)]" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-[var(--tulip-forest)] mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
          {t('title')}
        </h1>
        <p className="text-[var(--tulip-forest)]/60 text-lg max-w-xl mx-auto mb-10 leading-relaxed">
          {t('subtitle')}
        </p>
        <Link
          href="/donor/login"
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition-opacity"
          style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
        >
          {t('signIn')}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      {/* Features */}
      <section className="px-6 pb-24">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="rounded-2xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] p-8 text-center">
            <div className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center bg-emerald-500/10">
              <Shield className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-[var(--tulip-forest)] font-semibold text-base mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
              {t('blockchainVerified')}
            </h3>
            <p className="text-[var(--tulip-forest)]/60 text-sm leading-relaxed">
              {t('blockchainVerifiedDesc')}
            </p>
          </div>

          {/* Card 2 */}
          <div className="rounded-2xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] p-8 text-center">
            <div className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center bg-emerald-500/10">
              <FileCheck className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-[var(--tulip-forest)] font-semibold text-base mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
              {t('realTimeAccess')}
            </h3>
            <p className="text-[var(--tulip-forest)]/60 text-sm leading-relaxed">
              {t('realTimeAccessDesc')}
            </p>
          </div>

          {/* Card 3 */}
          <div className="rounded-2xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] p-8 text-center">
            <div className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center bg-emerald-500/10">
              <Lock className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-[var(--tulip-forest)] font-semibold text-base mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
              {t('tamperProof')}
            </h3>
            <p className="text-[var(--tulip-forest)]/60 text-sm leading-relaxed">
              {t('tamperProofDesc')}
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--tulip-sage-dark)] py-4">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between">
          <p className="text-[var(--tulip-forest)]/30 text-xs">
            {t('footer')}
          </p>
          <Link href="/verify" className="text-emerald-400/60 text-xs hover:text-emerald-400 transition-colors">
            {t('verifyADocument')}
          </Link>
        </div>
      </footer>
    </div>
  )
}
