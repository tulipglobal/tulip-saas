import type { Metadata } from 'next'
import Link from 'next/link'
import { Shield, CheckCircle, Globe, Zap, ArrowRight, Lock, Hash, Clock } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Tulip DS — Every Document. Blockchain Verified. Forever.',
  description: 'Blockchain-verified audit trails, RFC 3161 timestamps, and document verification for NGOs, donors, and enterprises. Drag any document and know in seconds if it is authentic.',
  alternates: { canonical: 'https://tulipds.com' },
  openGraph: {
    title: 'Tulip DS — Every Document. Blockchain Verified. Forever.',
    description: 'Blockchain-verified audit trails for NGOs, donors, and enterprises. Prove your integrity with immutable, on-chain verification.',
    url: 'https://tulipds.com',
    type: 'website',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Tulip DS',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: 'Blockchain-verified audit trails, RFC 3161 timestamps, and document verification for NGOs, donors, and enterprises.',
  url: 'https://tulipds.com',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    description: 'Free tier available',
  },
  creator: {
    '@type': 'Organization',
    name: 'Bright Bytes Technology',
    url: 'https://tulipds.com',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Dubai',
      addressCountry: 'AE',
    },
  },
}

export default function HomePage() {
  return (
    <div className="min-h-screen" style={{ fontFamily: 'DM Sans, sans-serif' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 backdrop-blur-md bg-[#07224a]/90">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg tulip-gradient flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '18px', color: 'white' }}>
              tulip<span style={{ color: '#369bff' }}>ds</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {['Products', 'Verify API', 'Pricing', 'Docs'].map(item => (
              <a key={item} href="#" style={{ color: '#94a3b8', fontSize: '14px', fontWeight: 500 }}
                className="hover:text-white transition-colors">{item}</a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login"
              style={{ color: '#94a3b8', fontSize: '14px', fontWeight: 500 }}
              className="hover:text-white transition-colors hidden md:block">
              Sign in
            </Link>
            <Link href="/login"
              className="px-4 py-2 rounded-lg text-white text-sm font-medium tulip-gradient hover:opacity-90 transition-opacity">
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="tulip-mesh min-h-screen flex items-center pt-16">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 mb-8 animate-fade-up">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 500 }}>
                Blockchain-verified · RFC 3161 Timestamped · GDPR Compliant
              </span>
            </div>

            <h1 className="animate-fade-up-delay-1"
              style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 'clamp(40px, 6vw, 72px)', color: 'white', lineHeight: 1.1, letterSpacing: '-0.03em' }}>
              Every Document. Blockchain Verified. Forever.
              
            </h1>

            <p className="mt-6 animate-fade-up-delay-2"
              style={{ color: '#94a3b8', fontSize: '18px', lineHeight: 1.7, maxWidth: '560px' }}>
              Drag any document. Know in seconds if it's authentic.
            </p>

            <div className="flex flex-wrap items-center gap-4 mt-10 animate-fade-up-delay-3">
              <Link href="/dashboard"
                className="flex items-center gap-2 px-6 py-3 rounded-lg text-white font-medium tulip-gradient hover:opacity-90 transition-opacity">
                Start for free
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/verify"
                className="flex items-center gap-2 px-6 py-3 rounded-lg font-medium border border-white/20 text-white hover:bg-white/5 transition-colors">
                <Hash className="w-4 h-4" />
                Verify a hash
              </Link>
            </div>

            {/* Live hash demo */}
            <div className="mt-12 animate-fade-up-delay-4 p-4 rounded-xl border border-white/10 bg-white/5 max-w-xl">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span style={{ color: '#10b981', fontSize: '13px', fontWeight: 600 }}>VERIFIED</span>
                <span style={{ color: '#475569', fontSize: '13px' }}>· Polygon · FreeTSA · 2 seconds ago</span>
              </div>
              <p className="hash-mono text-white/60" style={{ color: '#64748b', fontSize: '11px', wordBreak: 'break-all' }}>
                72ae9c6c4f8b3d2e1a5c9f0b6e2d8a4c7f3e9b1d5a2c8e4f0b6d2a8c4e0f6b2
              </p>
              <p style={{ color: '#475569', fontSize: '12px', marginTop: '8px' }}>
                Caritas Kenya · Q3 2026 Impact Report · AED 142,000 verified
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="border-y border-slate-800 bg-[#07224a]/60">
        <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { value: '9', label: 'Blockchain anchors', suffix: '+' },
            { value: '25', label: 'API tests passing', suffix: '/25' },
            { value: '4,644', label: 'RFC 3161 token bytes', suffix: '' },
            { value: '100%', label: 'GDPR compliant', suffix: '' },
          ].map(stat => (
            <div key={stat.label} className="text-center">
              <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '36px', color: 'white' }}>
                {stat.value}<span style={{ color: '#369bff' }}>{stat.suffix}</span>
              </p>
              <p style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRODUCTS */}
      <section className="bg-[#040f1f] py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p style={{ color: '#369bff', fontSize: '13px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Three products. One platform.</p>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 'clamp(28px, 4vw, 48px)', color: 'white', marginTop: '12px', letterSpacing: '-0.02em' }}>
              Built for transparency at scale
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <Globe className="w-6 h-6" />,
                tag: 'Product 1',
                title: 'NGO SaaS',
                desc: 'Project management, expense tracking, and verified impact reporting for NGOs. Every record anchored to blockchain automatically.',
                href: '/dashboard',
                cta: 'Manage your NGO',
                color: '#0c7aed',
              },
              {
                icon: <Shield className="w-6 h-6" />,
                tag: 'Product 2',
                title: 'Donor Platform',
                desc: 'Portfolio-level verification for foundations and development banks. Verify all your grantees in one dashboard.',
                href: '/donors',
                cta: 'Verify your portfolio',
                color: '#10b981',
              },
              {
                icon: <Zap className="w-6 h-6" />,
                tag: 'Product 3',
                title: 'Verify API',
                desc: 'Blockchain anchoring + RFC 3161 timestamps as a service. Any data, any industry. Pay per call like Stripe.',
                href: '/developers',
                cta: 'View API docs',
                color: '#f59e0b',
              },
            ].map(product => (
              <div key={product.title}
                className="group p-6 rounded-2xl border border-white/5 bg-white/3 hover:border-white/10 hover:bg-white/5 transition-all cursor-pointer">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: product.color + '22', color: product.color }}>
                  {product.icon}
                </div>
                <p style={{ color: product.color, fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {product.tag}
                </p>
                <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '22px', color: 'white', marginTop: '6px' }}>
                  {product.title}
                </h3>
                <p style={{ color: '#64748b', fontSize: '14px', lineHeight: 1.6, marginTop: '8px' }}>
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
      <section className="bg-[#040f1f] py-24 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 'clamp(28px, 4vw, 48px)', color: 'white', letterSpacing: '-0.02em' }}>
              How verification works
            </h2>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: '01', icon: <Lock className="w-5 h-5" />, title: 'Hash your data', desc: 'SHA-256 hash generated from your record. Original data never leaves your system.' },
              { step: '02', icon: <Hash className="w-5 h-5" />, title: 'Build hash chain', desc: 'Each hash links to the previous. Any tampering breaks the chain instantly.' },
              { step: '03', icon: <Globe className="w-5 h-5" />, title: 'Anchor to blockchain', desc: 'Merkle root anchored to Polygon. Immutable, public, permanent.' },
              { step: '04', icon: <Clock className="w-5 h-5" />, title: 'RFC 3161 timestamp', desc: 'Trusted timestamp from FreeTSA. Legally admissible under eIDAS and ESIGN Act.' },
            ].map(step => (
              <div key={step.step} className="text-center">
                <div className="w-12 h-12 rounded-full border border-blue-500/30 bg-blue-500/10 flex items-center justify-center mx-auto mb-4 text-blue-400">
                  {step.icon}
                </div>
                <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '11px', color: '#369bff', letterSpacing: '0.1em' }}>
                  STEP {step.step}
                </p>
                <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '18px', color: 'white', marginTop: '6px' }}>
                  {step.title}
                </h3>
                <p style={{ color: '#64748b', fontSize: '14px', lineHeight: 1.6, marginTop: '6px' }}>
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
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 'clamp(28px, 4vw, 48px)', color: 'white', letterSpacing: '-0.02em' }}>
            Ready to prove your integrity?
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '18px', marginTop: '16px', lineHeight: 1.7 }}>
            Join NGOs and enterprises using Tulip DS to make their data tamper-proof.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mt-10">
            <Link href="/dashboard"
              className="flex items-center gap-2 px-8 py-4 rounded-xl text-white font-semibold tulip-gradient hover:opacity-90 transition-opacity text-lg">
              Get started free
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/verify"
              className="flex items-center gap-2 px-8 py-4 rounded-xl font-semibold border border-white/20 text-white hover:bg-white/5 transition-colors text-lg">
              Try the verifier
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#040f1f] border-t border-slate-800 py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg tulip-gradient flex items-center justify-center">
                <Shield className="w-3.5 h-3.5 text-white" />
              </div>
              <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'white', fontSize: '16px' }}>
                tulip<span style={{ color: '#369bff' }}>ds</span>
              </span>
            </div>
            <p style={{ color: '#334155', fontSize: '13px', textAlign: 'center' }}>
              © 2026 Tulip DS · A Bright Bytes Technology Product · Dubai, UAE · Tulip Management Consultancy Ltd, London UK
            </p>
            <div className="flex gap-6">
              {['Privacy', 'Terms', 'Docs', 'Status'].map(link => (
                <a key={link} href="#" style={{ color: '#475569', fontSize: '13px' }} className="hover:text-white transition-colors">{link}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
