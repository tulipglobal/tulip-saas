'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle, Shield, Zap, TrendingUp, Building2, ArrowRight, HelpCircle, ChevronDown } from 'lucide-react'

const plans = [
  {
    name: 'Starter',
    icon: Shield,
    price: { monthly: 0, annual: 0 },
    description: 'For small NGOs getting started with verified transparency.',
    cta: 'Start free',
    ctaHref: '/register',
    highlight: false,
    features: [
      '1 project',
      'Up to 100 audit entries/month',
      'SHA-256 hashing',
      'Blockchain anchoring (Polygon)',
      'Public verify page',
      'Tulip DS branding',
      'Community support',
    ],
    limits: ['No custom domain', 'No API access', 'No webhooks'],
  },
  {
    name: 'Growth',
    icon: TrendingUp,
    price: { monthly: 19, annual: 15 },
    description: 'For growing NGOs managing up to 10 projects with donor reporting.',
    cta: 'Start 14-day trial',
    ctaHref: '/register',
    highlight: false,
    badge: null,
    features: [
      'Up to 10 projects',
      'Up to 2,000 audit entries/month',
      'SHA-256 + RFC 3161 timestamps',
      'Blockchain anchoring (Polygon)',
      'Public donor portal page',
      'API access (1 key)',
      'Webhooks (1 endpoint)',
      'CSV export',
      'Email support',
    ],
    limits: ['No custom domain', 'Tulip DS branding'],
  },
  {
    name: 'NGO',
    icon: Zap,
    price: { monthly: 49, annual: 39 },
    description: 'For active NGOs managing multiple projects and donor reporting.',
    cta: 'Start 14-day trial',
    ctaHref: '/register',
    highlight: true,
    badge: 'Most popular',
    features: [
      'Unlimited projects',
      'Up to 10,000 audit entries/month',
      'SHA-256 + RFC 3161 timestamps',
      'Blockchain anchoring (Polygon)',
      'Public donor portal page',
      'API access (1 key)',
      'Webhooks (3 endpoints)',
      'Remove Tulip DS branding',
      'CSV export',
      'Email support',
    ],
    limits: [],
  },
  {
    name: 'Enterprise',
    icon: Building2,
    price: { monthly: null, annual: null },
    description: 'For large NGOs, foundations, and government-funded organisations.',
    cta: 'Contact us',
    ctaHref: 'mailto:hello@tulipds.com',
    highlight: false,
    features: [
      'Unlimited everything',
      'Custom audit entry volume',
      'Dedicated blockchain wallet',
      'Custom domain (verify.yourngо.org)',
      'Multi-tenant (sub-organisations)',
      'SSO / SAML',
      'API keys (unlimited)',
      'Webhooks (unlimited)',
      'SLA 99.9% uptime',
      'GDPR DPA included',
      'Dedicated account manager',
      'Priority support',
    ],
    limits: [],
  },
]

const faqs = [
  {
    q: 'What is a blockchain anchor?',
    a: 'Each batch of audit entries is hashed into a Merkle tree and the root hash is written to the Polygon blockchain as an on-chain transaction. This creates an immutable, publicly verifiable timestamp that proves your records existed at that moment and have not been altered since.'
  },
  {
    q: 'What is RFC 3161?',
    a: 'RFC 3161 is an international standard for trusted timestamping. A certified timestamp authority signs a hash of your data with a cryptographic timestamp, making it legally admissible as evidence under EU eIDAS regulation and the US ESIGN Act.'
  },
  {
    q: 'Can donors verify records without an account?',
    a: 'Yes. The public verifier at tulipds.com/verify requires no login. Any donor can paste a hash and see full blockchain proof instantly. Your donor portal page is also fully public.'
  },
  {
    q: 'What happens if I exceed my audit entry limit?',
    a: 'We\'ll notify you at 80% usage. Entries over the limit are still saved and hashed — blockchain anchoring is queued and processed when you upgrade. No data is ever lost.'
  },
  {
    q: 'Is my data stored securely?',
    a: 'All data is encrypted at rest and in transit. Each NGO\'s data is isolated using row-level security. We are GDPR compliant and can sign a Data Processing Agreement for Enterprise customers.'
  },
  {
    q: 'Can I use my own Polygon wallet?',
    a: 'On Enterprise plans you can provide a dedicated wallet for anchoring — all blockchain transactions will originate from your address, giving you full chain-of-custody ownership of the proof.'
  },
]

function FAQ({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-[#c8d6c0] last:border-0">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left gap-4 hover:text-[#183a1d] transition-colors">
        <span className="text-sm font-medium text-[#183a1d]">{q}</span>
        <ChevronDown size={16} className={`text-[#183a1d]/40 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="text-sm text-[#183a1d]/60 pb-5 leading-relaxed">{a}</p>}
    </div>
  )
}

export default function PricingPage() {
  const [annual, setAnnual] = useState(true)

  return (
    <div className="min-h-screen" style={{
      background: '#fefbe9',
      backgroundImage: 'radial-gradient(at 50% 0%, rgba(246,196,83,0.12) 0px, transparent 60%)'
    }}>

      {/* Nav */}
      <nav className="border-b border-[#c8d6c0] px-6 h-16 flex items-center justify-between sticky top-0 z-10"
        style={{ background: 'rgba(254,251,233,0.95)', backdropFilter: 'blur(12px)' }}>
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: '#f6c453' }}>
            <span className="text-[#183a1d] font-bold text-xs" style={{ fontFamily: 'Inter, sans-serif' }}>T</span>
          </div>
          <span className="font-bold text-[#183a1d]" style={{ fontFamily: 'Inter, sans-serif' }}>
            tulip<span style={{ color: '#f6c453' }}>ds</span>
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/docs" className="text-sm text-[#183a1d]/60 hover:text-[#183a1d] transition-colors">API Docs</Link>
          <Link href="/donors" className="text-sm text-[#183a1d]/60 hover:text-[#183a1d] transition-colors">Donor Portal</Link>
          <Link href="/register"
            className="px-4 py-1.5 rounded-lg text-sm font-medium text-[#183a1d]"
            style={{ background: '#f6c453' }}>
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-5xl mx-auto px-6 pt-16 pb-10 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#f6c453]/30 bg-[#f6c453]/10 text-xs text-[#183a1d] mb-6">
          <CheckCircle size={12} />
          No setup fees · Cancel anytime
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-[#183a1d] mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
          Simple, transparent pricing
        </h1>
        <p className="text-[#183a1d]/60 text-lg max-w-xl mx-auto mb-8">
          Start free. Upgrade when you need more. Every plan includes blockchain anchoring and public verification.
        </p>

        {/* Billing toggle */}
        <div className="inline-flex items-center gap-3 bg-[#e1eedd] border border-[#c8d6c0] rounded-xl p-1.5">
          <button onClick={() => setAnnual(false)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${!annual ? 'bg-[#fefbe9] text-[#183a1d]' : 'text-[#183a1d]/60 hover:text-[#183a1d]'}`}>
            Monthly
          </button>
          <button onClick={() => setAnnual(true)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${annual ? 'bg-[#fefbe9] text-[#183a1d]' : 'text-[#183a1d]/60 hover:text-[#183a1d]'}`}>
            Annual
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${annual ? 'bg-green-500 text-[#183a1d]' : 'bg-green-500/20 text-green-400'}`}>
              −20%
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
                    ? 'border-[#f6c453]/50 shadow-lg shadow-[#f6c453]/10'
                    : 'border-[#c8d6c0]'
                }`}
                style={{
                  background: plan.highlight
                    ? 'linear-gradient(135deg, rgba(246,196,83,0.08), rgba(246,196,83,0.06))'
                    : '#e1eedd'
                }}>

                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold text-[#183a1d]"
                      style={{ background: '#f6c453' }}>
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="flex items-start justify-between mb-5">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon size={16} className="text-[#f6c453]" />
                      <span className="font-bold text-[#183a1d] text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
                        {plan.name}
                      </span>
                    </div>
                    <p className="text-xs text-[#183a1d]/60 leading-relaxed">{plan.description}</p>
                  </div>
                </div>

                {/* Price */}
                <div className="mb-6">
                  {price === null ? (
                    <div>
                      <div className="text-3xl font-bold text-[#183a1d]" style={{ fontFamily: 'Inter, sans-serif' }}>
                        Custom
                      </div>
                      <div className="text-xs text-[#183a1d]/40 mt-1">Contact us for a quote</div>
                    </div>
                  ) : price === 0 ? (
                    <div>
                      <div className="text-3xl font-bold text-[#183a1d]" style={{ fontFamily: 'Inter, sans-serif' }}>
                        Free
                      </div>
                      <div className="text-xs text-[#183a1d]/40 mt-1">Forever</div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-end gap-1">
                        <span className="text-[#183a1d]/60 text-lg mb-1">$</span>
                        <span className="text-3xl font-bold text-[#183a1d]" style={{ fontFamily: 'Inter, sans-serif' }}>
                          {price}
                        </span>
                        <span className="text-[#183a1d]/60 text-sm mb-1">/mo</span>
                      </div>
                      {annual && (
                        <div className="text-xs text-green-400 mt-1">
                          Billed annually · Save ${(49 - 39) * 12}/yr
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* CTA */}
                <Link href={plan.ctaHref}
                  className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium mb-6 transition-all ${
                    plan.highlight
                      ? 'text-[#183a1d] hover:opacity-90'
                      : 'text-[#183a1d] border border-[#c8d6c0] hover:border-[#f6c453]/30 hover:text-[#183a1d]'
                  }`}
                  style={plan.highlight ? { background: '#f6c453' } : {}}>
                  {plan.cta}
                  <ArrowRight size={14} />
                </Link>

                {/* Features */}
                <div className="space-y-2.5 flex-1">
                  {plan.features.map(f => (
                    <div key={f} className="flex items-start gap-2.5">
                      <CheckCircle size={13} className="text-green-400 shrink-0 mt-0.5" />
                      <span className="text-xs text-[#183a1d]/70">{f}</span>
                    </div>
                  ))}
                  {plan.limits.map(f => (
                    <div key={f} className="flex items-start gap-2.5">
                      <div className="w-3 h-3 rounded-full border border-[#c8d6c0] shrink-0 mt-0.5" />
                      <span className="text-xs text-[#183a1d]/40">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Trust row */}
      <div className="border-y border-[#c8d6c0] py-8"
        style={{ background: '#e1eedd' }}>
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: '100%', label: 'Blockchain anchored' },
              { value: 'eIDAS', label: 'Legally admissible' },
              { value: 'GDPR', label: 'Compliant' },
              { value: '99.9%', label: 'Uptime SLA (Enterprise)' },
            ].map(({ value, label }) => (
              <div key={label}>
                <div className="text-xl font-bold text-[#183a1d] mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>{value}</div>
                <div className="text-xs text-[#183a1d]/40">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Compare table */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-[#183a1d] text-center mb-10" style={{ fontFamily: 'Inter, sans-serif' }}>
          Compare plans
        </h2>
        <div className="rounded-2xl border border-[#c8d6c0] overflow-hidden"
          style={{ background: '#e1eedd' }}>
          <div className="grid grid-cols-5 border-b border-[#c8d6c0]">
            <div className="px-4 py-4 text-xs text-[#183a1d]/40 uppercase tracking-wide font-medium">Feature</div>
            {['Starter', 'Growth', 'NGO', 'Enterprise'].map(p => (
              <div key={p} className={`px-4 py-4 text-sm font-semibold text-center ${p === 'NGO' ? 'text-[#f6c453]' : 'text-[#183a1d]'}`}
                style={{ fontFamily: 'Inter, sans-serif' }}>{p}</div>
            ))}
          </div>
          {[
            ['Projects', '1', '10', 'Unlimited', 'Unlimited'],
            ['Audit entries/month', '100', '2,000', '10,000', 'Custom'],
            ['Blockchain anchoring', '✓', '✓', '✓', '✓'],
            ['RFC 3161 timestamps', '✓', '✓', '✓', '✓'],
            ['Public verifier', '✓', '✓', '✓', '✓'],
            ['Donor portal page', '—', '✓', '✓', '✓'],
            ['API access', '—', '1 key', '1 key', 'Unlimited'],
            ['Webhooks', '—', '1', '3', 'Unlimited'],
            ['Custom domain', '—', '—', '—', '✓'],
            ['SSO / SAML', '—', '—', '—', '✓'],
            ['SLA', '—', '—', '—', '99.9%'],
            ['Support', 'Community', 'Email', 'Email', 'Dedicated'],
          ].map(([feature, starter, growth, ngo, enterprise]) => (
            <div key={feature} className="grid grid-cols-5 border-b border-[#c8d6c0]/50 last:border-0 hover:bg-[#e1eedd]/50 transition-colors">
              <div className="px-4 py-3.5 text-sm text-[#183a1d]/60">{feature}</div>
              {[starter, growth, ngo, enterprise].map((val, i) => (
                <div key={i} className={`px-4 py-3.5 text-sm text-center ${
                  val === '✓' ? 'text-green-400' :
                  val === '—' ? 'text-[#183a1d]/30' :
                  i === 2 ? 'text-[#f6c453] font-medium' : 'text-[#183a1d]/70'
                }`}>{val}</div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-2xl mx-auto px-6 pb-20">
        <div className="flex items-center gap-2 justify-center mb-10">
          <HelpCircle size={18} className="text-[#f6c453]" />
          <h2 className="text-2xl font-bold text-[#183a1d]" style={{ fontFamily: 'Inter, sans-serif' }}>
            Frequently asked questions
          </h2>
        </div>
        <div className="rounded-2xl border border-[#c8d6c0] px-6"
          style={{ background: '#e1eedd' }}>
          {faqs.map(({ q, a }) => <FAQ key={q} q={q} a={a} />)}
        </div>
      </div>

      {/* Final CTA */}
      <div className="max-w-3xl mx-auto px-6 pb-20 text-center">
        <div className="rounded-2xl border border-[#f6c453]/20 p-10"
          style={{ background: 'rgba(246,196,83,0.08)' }}>
          <h2 className="text-2xl font-bold text-[#183a1d] mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>
            Start proving your integrity today
          </h2>
          <p className="text-[#183a1d]/60 text-sm mb-6 max-w-md mx-auto">
            Free to start. No credit card required. Your first blockchain anchor in under 5 minutes.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link href="/register"
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-[#183a1d]"
              style={{ background: '#f6c453' }}>
              Start free <ArrowRight size={15} />
            </Link>
            <Link href="mailto:hello@tulipds.com"
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm text-[#183a1d]/70 border border-[#c8d6c0] hover:border-[#c8d6c0] hover:text-[#183a1d] transition-all">
              Talk to us
            </Link>
          </div>
        </div>
      </div>

      <footer className="border-t border-[#c8d6c0] py-8 text-center">
        <p className="text-[#183a1d]/30 text-xs">© 2026 Tulip DS · Bright Bytes Technology · Dubai UAE</p>
      </footer>
    </div>
  )
}
