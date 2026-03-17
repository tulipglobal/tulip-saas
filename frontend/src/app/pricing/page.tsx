'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { CheckCircle, Shield, Zap, TrendingUp, Building2, ArrowRight, HelpCircle, ChevronDown } from 'lucide-react'

function FAQ({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-[var(--tulip-sage-dark)] last:border-0">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left gap-4 hover:text-[var(--tulip-forest)] transition-colors">
        <span className="text-sm font-medium text-[var(--tulip-forest)]">{q}</span>
        <ChevronDown size={16} className={`text-[var(--tulip-forest)]/40 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="text-sm text-[var(--tulip-forest)]/60 pb-5 leading-relaxed">{a}</p>}
    </div>
  )
}

export default function PricingPage() {
  const [annual, setAnnual] = useState(true)
  const t = useTranslations('pricing')

  const plans = [
    {
      name: t('starterName'),
      icon: Shield,
      price: { monthly: 0, annual: 0 },
      description: t('starterDesc'),
      cta: t('starterCta'),
      ctaHref: '/register',
      highlight: false,
      features: [
        t('starterFeature1'),
        t('starterFeature2'),
        t('starterFeature3'),
        t('starterFeature4'),
        t('starterFeature5'),
        t('starterFeature6'),
        t('starterFeature7'),
      ],
      limits: [t('starterLimit1'), t('starterLimit2'), t('starterLimit3')],
    },
    {
      name: t('growthName'),
      icon: TrendingUp,
      price: { monthly: 19, annual: 15 },
      description: t('growthDesc'),
      cta: t('growthCta'),
      ctaHref: '/register',
      highlight: false,
      badge: null,
      features: [
        t('growthFeature1'),
        t('growthFeature2'),
        t('growthFeature3'),
        t('growthFeature4'),
        t('growthFeature5'),
        t('growthFeature6'),
        t('growthFeature7'),
        t('growthFeature8'),
        t('growthFeature9'),
      ],
      limits: [t('growthLimit1'), t('growthLimit2')],
    },
    {
      name: t('ngoName'),
      icon: Zap,
      price: { monthly: 49, annual: 39 },
      description: t('ngoDesc'),
      cta: t('ngoCta'),
      ctaHref: '/register',
      highlight: true,
      badge: t('mostPopular'),
      features: [
        t('ngoFeature1'),
        t('ngoFeature2'),
        t('ngoFeature3'),
        t('ngoFeature4'),
        t('ngoFeature5'),
        t('ngoFeature6'),
        t('ngoFeature7'),
        t('ngoFeature8'),
        t('ngoFeature9'),
        t('ngoFeature10'),
      ],
      limits: [],
    },
    {
      name: t('enterpriseName'),
      icon: Building2,
      price: { monthly: null, annual: null },
      description: t('enterpriseDesc'),
      cta: t('enterpriseCta'),
      ctaHref: 'mailto:hello@sealayer.io',
      highlight: false,
      features: [
        t('enterpriseFeature1'),
        t('enterpriseFeature2'),
        t('enterpriseFeature3'),
        t('enterpriseFeature4'),
        t('enterpriseFeature5'),
        t('enterpriseFeature6'),
        t('enterpriseFeature7'),
        t('enterpriseFeature8'),
        t('enterpriseFeature9'),
        t('enterpriseFeature10'),
        t('enterpriseFeature11'),
        t('enterpriseFeature12'),
      ],
      limits: [],
    },
  ]

  const faqs = [
    { q: t('faq1q'), a: t('faq1a') },
    { q: t('faq2q'), a: t('faq2a') },
    { q: t('faq3q'), a: t('faq3a') },
    { q: t('faq4q'), a: t('faq4a') },
    { q: t('faq5q'), a: t('faq5a') },
    { q: t('faq6q'), a: t('faq6a') },
  ]

  const trustItems = [
    { value: t('trustBlockchain'), label: t('trustBlockchainLabel') },
    { value: t('trustEidas'), label: t('trustEidasLabel') },
    { value: t('trustGdpr'), label: t('trustGdprLabel') },
    { value: t('trustUptime'), label: t('trustUptimeLabel') },
  ]

  const compareRows = [
    [t('compareProjects'), '1', '10', t('compareUnlimited'), t('compareUnlimited')],
    [t('compareAuditEntries'), '100', '2,000', '10,000', t('compareCustom')],
    [t('compareBlockchain'), '✓', '✓', '✓', '✓'],
    [t('compareRfc3161'), '✓', '✓', '✓', '✓'],
    [t('comparePublicVerifier'), '✓', '✓', '✓', '✓'],
    [t('compareDonorPortal'), '—', '✓', '✓', '✓'],
    [t('compareApiAccess'), '—', t('compareOneKey'), t('compareOneKey'), t('compareUnlimited')],
    [t('compareWebhooks'), '—', '1', '3', t('compareUnlimited')],
    [t('compareCustomDomain'), '—', '—', '—', '✓'],
    [t('compareSso'), '—', '—', '—', '✓'],
    [t('compareSla'), '—', '—', '—', '99.9%'],
    [t('compareSupport'), t('compareCommunity'), t('compareEmail'), t('compareEmail'), t('compareDedicated')],
  ]

  return (
    <div className="min-h-screen" style={{
      background: 'var(--tulip-cream)',
      backgroundImage: 'radial-gradient(at 50% 0%, rgba(246,196,83,0.12) 0px, transparent 60%)'
    }}>

      {/* Nav */}
      <nav className="border-b border-[var(--tulip-sage-dark)] px-6 h-16 flex items-center justify-between sticky top-0 z-10"
        style={{ background: 'rgba(254,251,233,0.95)', backdropFilter: 'blur(12px)' }}>
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--tulip-gold)' }}>
            <span className="text-[var(--tulip-forest)] font-bold text-xs" style={{ fontFamily: 'Inter, sans-serif' }}>T</span>
          </div>
          <span className="font-bold text-[var(--tulip-forest)]" style={{ fontFamily: 'Inter, sans-serif' }}>
            tulip<span style={{ color: 'var(--tulip-gold)' }}>ds</span>
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/docs" className="text-sm text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)] transition-colors">{t('apiDocs')}</Link>
          <Link href="/donors" className="text-sm text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)] transition-colors">{t('donorPortal')}</Link>
          <Link href="/register"
            className="px-4 py-1.5 rounded-lg text-sm font-medium text-[var(--tulip-forest)]"
            style={{ background: 'var(--tulip-gold)' }}>
            {t('getStarted')}
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-5xl mx-auto px-6 pt-16 pb-10 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--tulip-gold)]/30 bg-[var(--tulip-gold)]/10 text-xs text-[var(--tulip-forest)] mb-6">
          <CheckCircle size={12} />
          {t('noSetupFees')}
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-[var(--tulip-forest)] mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
          {t('heroTitle')}
        </h1>
        <p className="text-[var(--tulip-forest)]/60 text-lg max-w-xl mx-auto mb-8">
          {t('heroDesc')}
        </p>

        {/* Billing toggle */}
        <div className="inline-flex items-center gap-3 bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-xl p-1.5">
          <button onClick={() => setAnnual(false)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${!annual ? 'bg-[var(--tulip-cream)] text-[var(--tulip-forest)]' : 'text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)]'}`}>
            {t('monthly')}
          </button>
          <button onClick={() => setAnnual(true)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${annual ? 'bg-[var(--tulip-cream)] text-[var(--tulip-forest)]' : 'text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)]'}`}>
            {t('annual')}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${annual ? 'bg-green-500 text-[var(--tulip-forest)]' : 'bg-green-500/20 text-green-400'}`}>
              {t('save20')}
            </span>
          </button>
        </div>
      </div>

      {/* Pricing cards */}
      <div className="max-w-5xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
          {plans.map((plan) => {
            const Icon = plan.icon
            const price = annual ? plan.price.annual : plan.price.monthly
            return (
              <div key={plan.name}
                className={`relative rounded-2xl border p-7 flex flex-col transition-all ${
                  plan.highlight
                    ? 'border-[var(--tulip-gold)]/50 shadow-lg shadow-[var(--tulip-gold)]/10'
                    : 'border-[var(--tulip-sage-dark)]'
                }`}
                style={{
                  background: plan.highlight
                    ? 'linear-gradient(135deg, rgba(246,196,83,0.08), rgba(246,196,83,0.06))'
                    : 'var(--tulip-sage)'
                }}>

                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold text-[var(--tulip-forest)]"
                      style={{ background: 'var(--tulip-gold)' }}>
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="flex items-start justify-between mb-5">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon size={16} className="text-[var(--tulip-gold)]" />
                      <span className="font-bold text-[var(--tulip-forest)] text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
                        {plan.name}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--tulip-forest)]/60 leading-relaxed">{plan.description}</p>
                  </div>
                </div>

                {/* Price */}
                <div className="mb-6">
                  {price === null ? (
                    <div>
                      <div className="text-3xl font-bold text-[var(--tulip-forest)]" style={{ fontFamily: 'Inter, sans-serif' }}>
                        {t('custom')}
                      </div>
                      <div className="text-xs text-[var(--tulip-forest)]/40 mt-1">{t('contactForQuote')}</div>
                    </div>
                  ) : price === 0 ? (
                    <div>
                      <div className="text-3xl font-bold text-[var(--tulip-forest)]" style={{ fontFamily: 'Inter, sans-serif' }}>
                        {t('free')}
                      </div>
                      <div className="text-xs text-[var(--tulip-forest)]/40 mt-1">{t('forever')}</div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-end gap-1">
                        <span className="text-[var(--tulip-forest)]/60 text-lg mb-1">$</span>
                        <span className="text-3xl font-bold text-[var(--tulip-forest)]" style={{ fontFamily: 'Inter, sans-serif' }}>
                          {price}
                        </span>
                        <span className="text-[var(--tulip-forest)]/60 text-sm mb-1">{t('perMonth')}</span>
                      </div>
                      {annual && (
                        <div className="text-xs text-green-400 mt-1">
                          {t('billedAnnually', { amount: (49 - 39) * 12 })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* CTA */}
                <Link href={plan.ctaHref}
                  className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium mb-6 transition-all ${
                    plan.highlight
                      ? 'text-[var(--tulip-forest)] hover:opacity-90'
                      : 'text-[var(--tulip-forest)] border border-[var(--tulip-sage-dark)] hover:border-[var(--tulip-gold)]/30 hover:text-[var(--tulip-forest)]'
                  }`}
                  style={plan.highlight ? { background: 'var(--tulip-gold)' } : {}}>
                  {plan.cta}
                  <ArrowRight size={14} />
                </Link>

                {/* Features */}
                <div className="space-y-2.5 flex-1">
                  {plan.features.map(f => (
                    <div key={f} className="flex items-start gap-2.5">
                      <CheckCircle size={13} className="text-green-400 shrink-0 mt-0.5" />
                      <span className="text-xs text-[var(--tulip-forest)]/70">{f}</span>
                    </div>
                  ))}
                  {plan.limits.map(f => (
                    <div key={f} className="flex items-start gap-2.5">
                      <div className="w-3 h-3 rounded-full border border-[var(--tulip-sage-dark)] shrink-0 mt-0.5" />
                      <span className="text-xs text-[var(--tulip-forest)]/40">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Trust row */}
      <div className="border-y border-[var(--tulip-sage-dark)] py-8"
        style={{ background: 'var(--tulip-sage)' }}>
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {trustItems.map(({ value, label }) => (
              <div key={label}>
                <div className="text-xl font-bold text-[var(--tulip-forest)] mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>{value}</div>
                <div className="text-xs text-[var(--tulip-forest)]/40">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Compare table */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-[var(--tulip-forest)] text-center mb-10" style={{ fontFamily: 'Inter, sans-serif' }}>
          {t('comparePlans')}
        </h2>
        <div className="rounded-2xl border border-[var(--tulip-sage-dark)] overflow-hidden"
          style={{ background: 'var(--tulip-sage)' }}>
          <div className="grid grid-cols-5 border-b border-[var(--tulip-sage-dark)]">
            <div className="px-4 py-4 text-xs text-[var(--tulip-forest)]/40 uppercase tracking-wide font-medium">{t('featureColumn')}</div>
            {[t('starterName'), t('growthName'), t('ngoName'), t('enterpriseName')].map(p => (
              <div key={p} className={`px-4 py-4 text-sm font-semibold text-center ${p === t('ngoName') ? 'text-[var(--tulip-gold)]' : 'text-[var(--tulip-forest)]'}`}
                style={{ fontFamily: 'Inter, sans-serif' }}>{p}</div>
            ))}
          </div>
          {compareRows.map(([feature, starter, growth, ngo, enterprise]) => (
            <div key={feature} className="grid grid-cols-5 border-b border-[var(--tulip-sage-dark)]/50 last:border-0 hover:bg-[var(--tulip-sage)]/50 transition-colors">
              <div className="px-4 py-3.5 text-sm text-[var(--tulip-forest)]/60">{feature}</div>
              {[starter, growth, ngo, enterprise].map((val, i) => (
                <div key={i} className={`px-4 py-3.5 text-sm text-center ${
                  val === '✓' ? 'text-green-400' :
                  val === '—' ? 'text-[var(--tulip-forest)]/30' :
                  i === 2 ? 'text-[var(--tulip-gold)] font-medium' : 'text-[var(--tulip-forest)]/70'
                }`}>{val}</div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-2xl mx-auto px-6 pb-20">
        <div className="flex items-center gap-2 justify-center mb-10">
          <HelpCircle size={18} className="text-[var(--tulip-gold)]" />
          <h2 className="text-2xl font-bold text-[var(--tulip-forest)]" style={{ fontFamily: 'Inter, sans-serif' }}>
            {t('faqTitle')}
          </h2>
        </div>
        <div className="rounded-2xl border border-[var(--tulip-sage-dark)] px-6"
          style={{ background: 'var(--tulip-sage)' }}>
          {faqs.map(({ q, a }) => <FAQ key={q} q={q} a={a} />)}
        </div>
      </div>

      {/* Final CTA */}
      <div className="max-w-3xl mx-auto px-6 pb-20 text-center">
        <div className="rounded-2xl border border-[var(--tulip-gold)]/20 p-10"
          style={{ background: 'rgba(246,196,83,0.08)' }}>
          <h2 className="text-2xl font-bold text-[var(--tulip-forest)] mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>
            {t('ctaTitle')}
          </h2>
          <p className="text-[var(--tulip-forest)]/60 text-sm mb-6 max-w-md mx-auto">
            {t('ctaDesc')}
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link href="/register"
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-[var(--tulip-forest)]"
              style={{ background: 'var(--tulip-gold)' }}>
              {t('startFree')} <ArrowRight size={15} />
            </Link>
            <Link href="mailto:hello@sealayer.io"
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm text-[var(--tulip-forest)]/70 border border-[var(--tulip-sage-dark)] hover:border-[var(--tulip-sage-dark)] hover:text-[var(--tulip-forest)] transition-all">
              {t('talkToUs')}
            </Link>
          </div>
        </div>
      </div>

      <footer className="border-t border-[var(--tulip-sage-dark)] py-8 text-center">
        <p className="text-[var(--tulip-forest)]/30 text-xs">{t('footer')}</p>
      </footer>
    </div>
  )
}
