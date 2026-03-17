'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Shield, Copy, Check, ChevronDown, ChevronRight, Terminal, Key, Webhook, FileCheck, ArrowUpRight } from 'lucide-react'

// ── Code block ──────────────────────────────────────────────
function CodeBlock({ code, language = 'bash', t }: { code: string; language?: string; t: (key: string) => string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  return (
    <div className="relative rounded-xl overflow-hidden border border-[var(--tulip-sage-dark)]" style={{ background: '#1e293b' }}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--tulip-sage-dark)]/50">
        <span className="text-xs text-[var(--tulip-forest)]/40 font-mono">{language}</span>
        <button onClick={copy} className="flex items-center gap-1.5 text-xs text-[var(--tulip-forest)]/40 hover:text-[var(--tulip-forest)] transition-colors">
          {copied ? <><Check size={12} className="text-green-400" /><span className="text-green-400">{t('copied')}</span></> : <><Copy size={12} />{t('copy')}</>}
        </button>
      </div>
      <pre className="px-4 py-4 text-sm overflow-x-auto"><code className="text-[var(--tulip-forest)] font-mono leading-relaxed">{code}</code></pre>
    </div>
  )
}

// ── Endpoint card ────────────────────────────────────────────
function Endpoint({ method, path, description, children }: {
  method: string; path: string; description: string; children?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const colors: Record<string, string> = {
    GET: 'bg-green-400/10 text-green-400 border-green-400/20',
    POST: 'bg-[var(--tulip-gold)]/10 text-[var(--tulip-forest)] border-[var(--tulip-gold)]/20',
    DELETE: 'bg-red-400/10 text-red-400 border-red-400/20',
  }
  return (
    <div className="rounded-xl border border-[var(--tulip-sage-dark)] overflow-hidden" style={{ background: 'var(--tulip-sage)' }}>
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[var(--tulip-sage)]/50 transition-colors text-left">
        <span className={`inline-flex px-2.5 py-0.5 rounded-md text-xs font-bold border font-mono shrink-0 ${colors[method] ?? colors.GET}`}>
          {method}
        </span>
        <span className="font-mono text-sm text-[var(--tulip-forest)] flex-1">{path}</span>
        <span className="text-xs text-[var(--tulip-forest)]/40 hidden md:block flex-1">{description}</span>
        {open ? <ChevronDown size={15} className="text-[var(--tulip-forest)]/40 shrink-0" /> : <ChevronRight size={15} className="text-[var(--tulip-forest)]/40 shrink-0" />}
      </button>
      {open && children && (
        <div className="px-5 pb-5 border-t border-[var(--tulip-sage-dark)]/50 pt-4 space-y-4">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Param row ────────────────────────────────────────────────
function Param({ name, type, required, desc, requiredLabel }: { name: string; type: string; required?: boolean; desc: string; requiredLabel?: string }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-[var(--tulip-sage-dark)]/50 last:border-0">
      <code className="text-xs font-mono text-[var(--tulip-forest)] shrink-0 mt-0.5">{name}</code>
      <code className="text-xs font-mono text-[var(--tulip-forest)]/40 shrink-0 mt-0.5">{type}</code>
      {required && <span className="text-xs text-red-400 shrink-0 mt-0.5">{requiredLabel || 'required'}</span>}
      <span className="text-xs text-[var(--tulip-forest)]/60">{desc}</span>
    </div>
  )
}

export default function APIDocsPage() {
  const t = useTranslations('docs')
  const [activeSection, setActiveSection] = useState('quickstart')

  // ── Nav sections ─────────────────────────────────────────────
  const sections = [
    { id: 'quickstart',    label: t('quickStart'),      icon: Terminal },
    { id: 'auth',          label: t('authentication'),   icon: Key },
    { id: 'verify',        label: t('verifyApi'),       icon: Shield },
    { id: 'audit',         label: t('auditLogApi'),    icon: FileCheck },
    { id: 'webhooks',      label: t('webhooks'),         icon: Webhook },
    { id: 'sdk',           label: t('jsSdk'),   icon: Terminal },
  ]

  const scrollTo = (id: string) => {
    setActiveSection(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--tulip-cream)' }}>

      {/* Nav */}
      <nav className="border-b border-[var(--tulip-sage-dark)] px-6 h-16 flex items-center justify-between sticky top-0 z-20"
        style={{ background: 'rgba(254,251,233,0.95)', backdropFilter: 'blur(12px)' }}>
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--tulip-gold)' }}>
            <span className="text-[var(--tulip-forest)] font-bold text-xs" style={{ fontFamily: 'Inter, sans-serif' }}>T</span>
          </div>
          <span className="font-bold text-[var(--tulip-forest)]" style={{ fontFamily: 'Inter, sans-serif' }}>
            tulip<span style={{ color: 'var(--tulip-gold)' }}>ds</span>
            <span className="text-[var(--tulip-forest)]/40 font-normal text-sm ml-2">{t('apiDocs')}</span>
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/dashboard/api-keys" className="flex items-center gap-1.5 text-sm text-[var(--tulip-forest)] hover:underline">
            <Key size={13} /> {t('getApiKey')}
          </Link>
          <Link href="/login" className="px-4 py-1.5 rounded-lg text-sm font-medium text-[var(--tulip-forest)] border border-[var(--tulip-sage-dark)] hover:border-[var(--tulip-gold)]/30 transition-all">
            {t('signIn')}
          </Link>
        </div>
      </nav>

      <div className="flex max-w-6xl mx-auto">

        {/* Sidebar */}
        <aside className="w-56 shrink-0 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto border-r border-[var(--tulip-sage-dark)] py-8 px-4 hidden md:block">
          <div className="text-xs text-[var(--tulip-forest)]/40 uppercase tracking-widest font-medium mb-4 px-2">{t('reference')}</div>
          {sections.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => scrollTo(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm mb-0.5 transition-all text-left ${
                activeSection === id
                  ? 'bg-[var(--tulip-gold)]/15 text-[var(--tulip-forest)]'
                  : 'text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)] hover:bg-[var(--tulip-sage)]/50'
              }`}>
              <Icon size={14} className="shrink-0" />
              {label}
            </button>
          ))}
          <div className="mt-6 pt-6 border-t border-[var(--tulip-sage-dark)]/50">
            <div className="px-3">
              <div className="text-xs text-[var(--tulip-forest)]/30 mb-2">{t('baseUrl')}</div>
              <code className="text-xs text-[var(--tulip-forest)] font-mono">api.sealayer.io</code>
            </div>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 px-8 py-10 space-y-16 min-w-0">

          {/* Quick Start */}
          <section id="quickstart">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--tulip-gold)]/10 border border-[var(--tulip-gold)]/20 text-xs text-[var(--tulip-forest)] mb-4">
              <Terminal size={12} /> {t('quickStart')}
            </div>
            <h1 className="text-3xl font-bold text-[var(--tulip-forest)] mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>
              {t('title')}
            </h1>
            <p className="text-[var(--tulip-forest)]/60 text-base mb-8 max-w-2xl">
              {t('subtitle')}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {[
                { label: t('restApi'), desc: t('restApiDesc') },
                { label: t('jsSdkLabel'), desc: t('jsSdkDesc') },
                { label: t('webhooksLabel'), desc: t('webhooksDesc') },
              ].map(({ label, desc }) => (
                <div key={label} className="rounded-xl border border-[var(--tulip-sage-dark)] p-4"
                  style={{ background: 'var(--tulip-sage)' }}>
                  <div className="text-sm font-semibold text-[var(--tulip-forest)] mb-1">{label}</div>
                  <div className="text-xs text-[var(--tulip-forest)]/60">{desc}</div>
                </div>
              ))}
            </div>

            <h2 className="text-lg font-semibold text-[var(--tulip-forest)] mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>
              {t('step1Title')}
            </h2>
            <p className="text-[var(--tulip-forest)]/60 text-sm mb-4">{t('step1Desc')}</p>

            <h2 className="text-lg font-semibold text-[var(--tulip-forest)] mb-3 mt-6" style={{ fontFamily: 'Inter, sans-serif' }}>
              {t('step2Title')}
            </h2>
            <CodeBlock t={t} language="bash" code={`curl https://api.sealayer.io/api/verify/YOUR_HASH \\
  -H "X-API-Key: tulip_live_xxxxxxxxxxxx"`} />

            <h2 className="text-lg font-semibold text-[var(--tulip-forest)] mb-3 mt-6" style={{ fontFamily: 'Inter, sans-serif' }}>
              {t('step3Title')}
            </h2>
            <CodeBlock t={t} language="javascript" code={`import Tulip from 'tulip-js'

const tulip = new Tulip({ apiKey: 'tulip_live_xxxxxxxxxxxx' })

// Log an audit event (auto-hashed + anchored)
const entry = await tulip.audit.log({
  action: 'EXPENSE_CREATED',
  entityType: 'Expense',
  entityId: 'exp_123',
  metadata: { amount: 4200, currency: 'USD' }
})

console.log(entry.dataHash)
// → ab32d3e3e5befae2a6ea9dcb53ad1305372c...`} />
          </section>

          {/* Authentication */}
          <section id="auth">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--tulip-gold)]/10 border border-[var(--tulip-gold)]/20 text-xs text-[var(--tulip-forest)] mb-4">
              <Key size={12} /> {t('authentication')}
            </div>
            <h2 className="text-2xl font-bold text-[var(--tulip-forest)] mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>{t('authTitle')}</h2>
            <p className="text-[var(--tulip-forest)]/60 text-sm mb-6">
              {t('authDesc', { header: 'X-API-Key' })}
            </p>

            <CodeBlock t={t} language="bash" code={`# All authenticated requests
curl https://api.sealayer.io/api/audit \\
  -H "X-API-Key: tulip_live_xxxxxxxxxxxx" \\
  -H "Content-Type: application/json"`} />

            <div className="mt-6 rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-4">
              <div className="text-xs font-semibold text-yellow-400 mb-1">{t('keepSecret')}</div>
              <div className="text-xs text-[var(--tulip-forest)]/60">{t('keepSecretDesc')}</div>
            </div>

            <h3 className="text-base font-semibold text-[var(--tulip-forest)] mt-6 mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>{t('apiKeyFormat')}</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <code className="text-[var(--tulip-forest)] font-mono bg-[var(--tulip-sage)] px-2 py-1 rounded text-xs">tulip_live_</code>
                <span className="text-[var(--tulip-forest)]/60">{t('liveKeyDesc')}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <code className="text-[var(--tulip-forest)] font-mono bg-[var(--tulip-sage)] px-2 py-1 rounded text-xs">tulip_test_</code>
                <span className="text-[var(--tulip-forest)]/60">{t('testKeyDesc')}</span>
              </div>
            </div>
          </section>

          {/* Verify API */}
          <section id="verify">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--tulip-gold)]/10 border border-[var(--tulip-gold)]/20 text-xs text-[var(--tulip-forest)] mb-4">
              <Shield size={12} /> {t('verifyApi')}
            </div>
            <h2 className="text-2xl font-bold text-[var(--tulip-forest)] mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>{t('verifyTitle')}</h2>
            <p className="text-[var(--tulip-forest)]/60 text-sm mb-6">
              {t('verifyDesc')}
            </p>

            <div className="space-y-3">
              <Endpoint method="GET" path="/api/verify/{dataHash}" description={t('verifyHashDesc')}>
                <p className="text-sm text-[var(--tulip-forest)]/60">{t('verifyHashDesc')}</p>
                <div>
                  <div className="text-xs text-[var(--tulip-forest)]/40 uppercase tracking-wide mb-2">{t('pathParams')}</div>
                  <Param name="dataHash" type="string" required requiredLabel={t('required')} desc={t('dataHashDesc')} />
                </div>
                <CodeBlock t={t} language="bash" code={`curl https://api.sealayer.io/api/verify/ab32d3e3e5befae2a6ea9dcb53ad1305372c5df8204bf8d1ede0fe48be65a025`} />
                <CodeBlock t={t} language="json" code={`{
  "verified": true,
  "dataHash": "ab32d3e3e5befae2a6ea9dcb53ad1305...",
  "entityType": "Expense",
  "action": "EXPENSE_CREATED",
  "recordedAt": "2026-03-06T15:05:00.000Z",
  "integrity": {
    "hashIntact": true,
    "chainIntact": true
  },
  "blockchain": {
    "network": "Polygon",
    "txHash": "0xc74e560d8047580a13ff81...",
    "blockNumber": 34841006,
    "anchorStatus": "confirmed",
    "onChainConfirmed": true
  }
}`} />
              </Endpoint>

              <Endpoint method="GET" path="/api/verify/batch/{batchId}" description={t('verifyBatchDesc')}>
                <p className="text-sm text-[var(--tulip-forest)]/60">{t('verifyBatchDesc')}</p>
                <Param name="batchId" type="string" required requiredLabel={t('required')} desc={t('batchIdDesc')} />
                <CodeBlock t={t} language="bash" code={`curl https://api.sealayer.io/api/verify/batch/88e631dfd0739...`} />
              </Endpoint>
            </div>
          </section>

          {/* Audit Log API */}
          <section id="audit">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--tulip-gold)]/10 border border-[var(--tulip-gold)]/20 text-xs text-[var(--tulip-forest)] mb-4">
              <FileCheck size={12} /> {t('auditLogApi')}
            </div>
            <h2 className="text-2xl font-bold text-[var(--tulip-forest)] mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>{t('auditTitle')}</h2>
            <p className="text-[var(--tulip-forest)]/60 text-sm mb-6">
              {t('auditDesc')}
            </p>

            <div className="space-y-3">
              <Endpoint method="POST" path="/api/audit" description="Create an audit log entry">
                <div>
                  <div className="text-xs text-[var(--tulip-forest)]/40 uppercase tracking-wide mb-2">{t('bodyParams')}</div>
                  <Param name="action" type="string" required requiredLabel={t('required')} desc='Action name e.g. "EXPENSE_CREATED", "DOCUMENT_SIGNED"' />
                  <Param name="entityType" type="string" required requiredLabel={t('required')} desc='Entity type e.g. "Expense", "Document", "Project"' />
                  <Param name="entityId" type="string" required requiredLabel={t('required')} desc="ID of the entity being audited" />
                  <Param name="metadata" type="object" desc="Additional data to include in the hash" />
                </div>
                <CodeBlock t={t} language="javascript" code={`const res = await fetch('https://api.sealayer.io/api/audit', {
  method: 'POST',
  headers: {
    'X-API-Key': 'tulip_live_xxxxxxxxxxxx',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    action: 'EXPENSE_CREATED',
    entityType: 'Expense',
    entityId: 'exp_456',
    metadata: {
      amount: 4200,
      currency: 'USD',
      vendor: 'AfriDrill Ltd'
    }
  })
})

const entry = await res.json()
// entry.dataHash → your verifiable proof`} />
              </Endpoint>

              <Endpoint method="GET" path="/api/audit" description="List audit log entries">
                <div>
                  <div className="text-xs text-[var(--tulip-forest)]/40 uppercase tracking-wide mb-2">{t('queryParams')}</div>
                  <Param name="limit" type="number" desc="Number of results (default 20, max 100)" />
                  <Param name="page" type="number" desc="Page number for pagination" />
                  <Param name="anchorStatus" type="string" desc='"confirmed" | "pending" | "failed"' />
                  <Param name="entityType" type="string" desc="Filter by entity type" />
                </div>
                <CodeBlock t={t} language="bash" code={`curl "https://api.sealayer.io/api/audit?limit=10&anchorStatus=confirmed" \\
  -H "X-API-Key: tulip_live_xxxxxxxxxxxx"`} />
              </Endpoint>
            </div>
          </section>

          {/* Webhooks */}
          <section id="webhooks">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--tulip-gold)]/10 border border-[var(--tulip-gold)]/20 text-xs text-[var(--tulip-forest)] mb-4">
              <Webhook size={12} /> {t('webhooks')}
            </div>
            <h2 className="text-2xl font-bold text-[var(--tulip-forest)] mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>{t('webhooksTitle')}</h2>
            <p className="text-[var(--tulip-forest)]/60 text-sm mb-6">
              {t('webhooksPageDesc')}
            </p>

            <h3 className="text-sm font-semibold text-[var(--tulip-forest)] mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>{t('eventTypes')}</h3>
            <div className="grid grid-cols-2 gap-2 mb-6">
              {['audit.anchored', 'audit.failed', 'batch.confirmed', 'document.verified'].map(e => (
                <code key={e} className="px-3 py-2 rounded-lg bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] text-xs text-[var(--tulip-forest)] font-mono">{e}</code>
              ))}
            </div>

            <CodeBlock t={t} language="javascript" code={`// Your webhook endpoint receives:
{
  "event": "audit.anchored",
  "timestamp": "2026-03-06T19:05:00.000Z",
  "data": {
    "dataHash": "ab32d3e3e5befae2a6ea9dcb53ad...",
    "blockchainTx": "0xc74e560d8047580a13ff81...",
    "blockNumber": 34841006,
    "network": "Polygon",
    "batchId": "88e631dfd0739e661dec25e33f0f3aa907..."
  }
}`} />

            <div className="space-y-3 mt-4">
              <Endpoint method="POST" path="/api/webhooks" description="Register a webhook endpoint">
                <Param name="url" type="string" required requiredLabel={t('required')} desc="HTTPS URL to receive webhook payloads" />
                <Param name="events" type="string[]" required requiredLabel={t('required')} desc='Array of event types e.g. ["audit.anchored"]' />
                <Param name="secret" type="string" desc="Optional secret for HMAC signature verification" />
              </Endpoint>
              <Endpoint method="GET" path="/api/webhooks" description="List registered webhooks" />
              <Endpoint method="DELETE" path="/api/webhooks/{id}" description="Delete a webhook" />
            </div>
          </section>

          {/* SDK */}
          <section id="sdk">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--tulip-gold)]/10 border border-[var(--tulip-gold)]/20 text-xs text-[var(--tulip-forest)] mb-4">
              <Terminal size={12} /> {t('jsSdk')}
            </div>
            <h2 className="text-2xl font-bold text-[var(--tulip-forest)] mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>{t('sdkTitle')}</h2>
            <p className="text-[var(--tulip-forest)]/60 text-sm mb-6">
              {t('sdkDesc', { code: 'tulip-js' })}
            </p>

            <CodeBlock t={t} language="bash" code={`npm install tulip-js`} />

            <h3 className="text-sm font-semibold text-[var(--tulip-forest)] mt-6 mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>{t('fullExample')}</h3>
            <CodeBlock t={t} language="javascript" code={`import Tulip from 'tulip-js'

const tulip = new Tulip({
  apiKey: process.env.TULIP_API_KEY,
  // baseUrl: 'https://api.sealayer.io' // default
})

// ── Audit log ──────────────────────────────
const entry = await tulip.audit.log({
  action: 'DOCUMENT_SIGNED',
  entityType: 'Document',
  entityId: 'doc_789',
})

// ── Verify any hash ────────────────────────
const result = await tulip.verify(entry.dataHash)
console.log(result.verified)          // true
console.log(result.blockchain.txHash) // 0xc74e...

// ── List entries ───────────────────────────
const log = await tulip.audit.list({ limit: 10 })
log.items.forEach(e => console.log(e.dataHash))`} />

            {/* CTA */}
            <div className="mt-10 rounded-2xl border border-[var(--tulip-gold)]/20 p-8 text-center"
              style={{ background: 'rgba(246,196,83,0.08)' }}>
              <Shield size={28} className="text-[var(--tulip-gold)] mx-auto mb-3" />
              <h3 className="font-bold text-[var(--tulip-forest)] text-lg mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                {t('readyToIntegrate')}
              </h3>
              <p className="text-[var(--tulip-forest)]/60 text-sm max-w-sm mx-auto mb-5">
                {t('readyDesc')}
              </p>
              <div className="flex items-center justify-center gap-3">
                <Link href="/dashboard/api-keys"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-[var(--tulip-forest)]"
                  style={{ background: 'var(--tulip-gold)' }}>
                  <Key size={15} /> {t('getApiKey')}
                </Link>
                <Link href="https://github.com/sealayer" target="_blank"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm text-[var(--tulip-forest)]/60 border border-[var(--tulip-sage-dark)] hover:border-[var(--tulip-sage-dark)] transition-all">
                  <ArrowUpRight size={15} /> {t('github')}
                </Link>
              </div>
            </div>
          </section>

        </main>
      </div>
    </div>
  )
}
