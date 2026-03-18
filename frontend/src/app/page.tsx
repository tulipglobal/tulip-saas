'use client'

import Link from 'next/link'
import { Shield, CheckCircle, Globe, Zap, ArrowRight, Lock, Hash, Clock } from 'lucide-react'
import { useTranslations } from 'next-intl'
import LanguageSwitcher from '@/components/LanguageSwitcher'

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'sealayer',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: 'Blockchain-verified audit trails, RFC 3161 timestamps, and document verification for NGOs, donors, and enterprises.',
  url: 'https://sealayer.io',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    description: 'Free tier available',
  },
  creator: {
    '@type': 'Organization',
    name: 'Bright Bytes Technology',
    url: 'https://sealayer.io',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Dubai',
      addressCountry: 'AE',
    },
  },
}

export default function HomePage() {
  const t = useTranslations()
  return (
    <div className="min-h-screen" style={{ fontFamily: 'Inter, sans-serif' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--tulip-sage-dark)] backdrop-blur-md bg-[var(--tulip-sage)]/95">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--tulip-gold)' }}>
              <Shield className="w-4 h-4 text-[var(--tulip-forest)]" />
            </div>
            <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '18px', color: 'var(--tulip-forest)' }}>
              sealayer
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {[
              { key: 'products', label: t('landing.products') },
              { key: 'verifyApi', label: t('landing.verifyApi') },
              { key: 'pricing', label: t('landing.pricing') },
              { key: 'docs', label: t('landing.docs') },
            ].map(item => (
              <a key={item.key} href="#" style={{ color: 'var(--tulip-forest)', fontSize: '14px', fontWeight: 500, opacity: 0.7 }}
                className="hover:opacity-100 transition-colors">{item.label}</a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link href="/login"
              style={{ color: 'var(--tulip-forest)', fontSize: '14px', fontWeight: 500, opacity: 0.7 }}
              className="hover:opacity-100 transition-colors hidden md:block">
              {t('landing.signIn')}
            </Link>
            <Link href="/login"
              className="px-4 py-2 rounded-lg text-[var(--tulip-forest)] text-sm font-medium hover:opacity-90 transition-opacity"
              style={{ background: 'var(--tulip-gold)' }}>
              {t('landing.getStarted')}
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="tulip-mesh min-h-screen flex items-center pt-16">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--tulip-gold)]/30 bg-[var(--tulip-gold)]/10 mb-8 animate-fade-up">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span style={{ color: 'var(--tulip-forest)', fontSize: '13px', fontWeight: 500, opacity: 0.7 }}>
                {t('landing.tagline')}
              </span>
            </div>

            <h1 className="animate-fade-up-delay-1"
              style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 'clamp(40px, 6vw, 72px)', color: 'var(--tulip-forest)', lineHeight: 1.1, letterSpacing: '-0.03em' }}>
              {t('landing.heroTitle')}

            </h1>

            <p className="mt-6 animate-fade-up-delay-2"
              style={{ color: 'var(--tulip-forest)', fontSize: '18px', lineHeight: 1.7, maxWidth: '560px', opacity: 0.7 }}>
              {t('landing.heroDesc')}
            </p>

            <div className="flex flex-wrap items-center gap-4 mt-10 animate-fade-up-delay-3">
              <Link href="/dashboard"
                className="flex items-center gap-2 px-6 py-3 rounded-lg text-[var(--tulip-forest)] font-medium hover:opacity-90 transition-opacity"
                style={{ background: 'var(--tulip-gold)' }}>
                {t('landing.startFree')}
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/verify"
                className="flex items-center gap-2 px-6 py-3 rounded-lg font-medium border border-[var(--tulip-sage-dark)] text-[var(--tulip-forest)] hover:bg-[var(--tulip-sage)]/50 transition-colors">
                <Hash className="w-4 h-4" />
                {t('landing.verifyHash')}
              </Link>
            </div>

            {/* Live hash demo */}
            <div className="mt-12 animate-fade-up-delay-4 p-4 rounded-xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] max-w-xl">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span style={{ color: '#10b981', fontSize: '13px', fontWeight: 600 }}>{t('landing.verified')}</span>
                <span style={{ color: 'var(--tulip-forest)', fontSize: '13px', opacity: 0.7 }}>{t('landing.verifiedMeta')}</span>
              </div>
              <p className="hash-mono" style={{ color: 'var(--tulip-forest)', opacity: 0.7, fontSize: '11px', wordBreak: 'break-all' }}>
                72ae9c6c4f8b3d2e1a5c9f0b6e2d8a4c7f3e9b1d5a2c8e4f0b6d2a8c4e0f6b2
              </p>
              <p style={{ color: 'var(--tulip-forest)', fontSize: '12px', marginTop: '8px', opacity: 0.7 }}>
                {t('landing.demoOrg')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="border-y border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)]">
        <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { value: '9', label: t('landing.blockchainAnchors'), suffix: '+' },
            { value: '25', label: t('landing.apiTestsPassing'), suffix: '/25' },
            { value: '4,644', label: t('landing.rfcTokenBytes'), suffix: '' },
            { value: '100%', label: t('landing.gdprCompliant'), suffix: '' },
          ].map(stat => (
            <div key={stat.label} className="text-center">
              <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '36px', color: 'var(--tulip-forest)' }}>
                {stat.value}<span style={{ color: 'var(--tulip-gold)' }}>{stat.suffix}</span>
              </p>
              <p style={{ color: 'var(--tulip-forest)', fontSize: '13px', marginTop: '4px', opacity: 0.6 }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRODUCTS */}
      <section className="bg-[var(--tulip-cream)] py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p style={{ color: 'var(--tulip-gold)', fontSize: '13px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t('landing.threeProducts')}</p>
            <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 'clamp(28px, 4vw, 48px)', color: 'var(--tulip-forest)', marginTop: '12px', letterSpacing: '-0.02em' }}>
              {t('landing.builtForTransparency')}
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <Globe className="w-6 h-6" />,
                tag: t('landing.product1Tag'),
                title: t('landing.product1Title'),
                desc: t('landing.product1Desc'),
                href: '/dashboard',
                cta: t('landing.product1Cta'),
                color: 'var(--tulip-gold)',
              },
              {
                icon: <Shield className="w-6 h-6" />,
                tag: t('landing.product2Tag'),
                title: t('landing.product2Title'),
                desc: t('landing.product2Desc'),
                href: '/donors',
                cta: t('landing.product2Cta'),
                color: '#10b981',
              },
              {
                icon: <Zap className="w-6 h-6" />,
                tag: t('landing.product3Tag'),
                title: t('landing.product3Title'),
                desc: t('landing.product3Desc'),
                href: '/developers',
                cta: t('landing.product3Cta'),
                color: '#f59e0b',
              },
            ].map(product => (
              <div key={product.title}
                className="group p-6 rounded-2xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] hover:border-[var(--tulip-sage-dark)] transition-all cursor-pointer">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: product.color + '22', color: product.color }}>
                  {product.icon}
                </div>
                <p style={{ color: product.color, fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {product.tag}
                </p>
                <h3 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '22px', color: 'var(--tulip-forest)', marginTop: '6px' }}>
                  {product.title}
                </h3>
                <p style={{ color: 'var(--tulip-forest)', opacity: 0.6, fontSize: '14px', lineHeight: 1.6, marginTop: '8px' }}>
                  {product.desc}
                </p>
                <Link href={product.href}
                  className="inline-flex items-center gap-1 mt-4 text-sm font-medium group-hover:gap-2 transition-all"
                  style={{ color: product.color }}>
                  {product.cta}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-[var(--tulip-cream)] py-24 border-t border-[var(--tulip-sage-dark)]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 'clamp(28px, 4vw, 48px)', color: 'var(--tulip-forest)', letterSpacing: '-0.02em' }}>
              {t('landing.howItWorks')}
            </h2>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: '01', icon: <Lock className="w-5 h-5" />, title: t('landing.step01Title'), desc: t('landing.step01Desc') },
              { step: '02', icon: <Hash className="w-5 h-5" />, title: t('landing.step02Title'), desc: t('landing.step02Desc') },
              { step: '03', icon: <Globe className="w-5 h-5" />, title: t('landing.step03Title'), desc: t('landing.step03Desc') },
              { step: '04', icon: <Clock className="w-5 h-5" />, title: t('landing.step04Title'), desc: t('landing.step04Desc') },
            ].map(step => (
              <div key={step.step} className="text-center">
                <div className="w-12 h-12 rounded-full border border-[var(--tulip-gold)]/30 bg-[var(--tulip-gold)]/10 flex items-center justify-center mx-auto mb-4 text-[var(--tulip-forest)]">
                  {step.icon}
                </div>
                <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '11px', color: 'var(--tulip-gold)', letterSpacing: '0.1em' }}>
                  {t('landing.step')} {step.step}
                </p>
                <h3 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '18px', color: 'var(--tulip-forest)', marginTop: '6px' }}>
                  {step.title}
                </h3>
                <p style={{ color: 'var(--tulip-forest)', opacity: 0.6, fontSize: '14px', lineHeight: 1.6, marginTop: '6px' }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="tulip-mesh py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 'clamp(28px, 4vw, 48px)', color: 'var(--tulip-forest)', letterSpacing: '-0.02em' }}>
            {t('landing.ctaTitle')}
          </h2>
          <p style={{ color: 'var(--tulip-forest)', opacity: 0.7, fontSize: '18px', marginTop: '16px', lineHeight: 1.7 }}>
            {t('landing.ctaDesc')}
          </p>
          <div className="flex flex-wrap justify-center gap-4 mt-10">
            <Link href="/dashboard"
              className="flex items-center gap-2 px-8 py-4 rounded-xl text-[var(--tulip-forest)] font-semibold hover:opacity-90 transition-opacity text-lg"
              style={{ background: 'var(--tulip-gold)' }}>
              {t('landing.getStartedFree')}
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/verify"
              className="flex items-center gap-2 px-8 py-4 rounded-xl font-semibold border border-[var(--tulip-sage-dark)] text-[var(--tulip-forest)] hover:bg-[var(--tulip-sage)]/50 transition-colors text-lg">
              {t('landing.tryVerifier')}
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[var(--tulip-cream)] border-t border-[var(--tulip-sage-dark)] py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--tulip-gold)' }}>
                <Shield className="w-3.5 h-3.5 text-[var(--tulip-forest)]" />
              </div>
              <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, color: 'var(--tulip-forest)', fontSize: '16px' }}>
                sealayer
              </span>
            </div>
            <p style={{ color: 'var(--tulip-forest)', fontSize: '13px', textAlign: 'center', opacity: 0.7 }}>
              {t('landing.footer')}
            </p>
            <div className="flex gap-6">
              {[
                { key: 'privacy', label: t('landing.privacy') },
                { key: 'terms', label: t('landing.terms') },
                { key: 'docs', label: t('landing.docs') },
                { key: 'status', label: t('landing.status') },
              ].map(link => (
                <a key={link.key} href="#" style={{ color: 'var(--tulip-forest)', fontSize: '13px', opacity: 0.7 }} className="hover:opacity-100 transition-colors">{link.label}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
