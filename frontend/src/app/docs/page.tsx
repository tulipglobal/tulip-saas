'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Shield, Copy, Check, ChevronDown, ChevronRight, Terminal, Key, Webhook, FileCheck, ArrowUpRight } from 'lucide-react'

// ── Code block ──────────────────────────────────────────────
function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-200" style={{ background: '#1e293b' }}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
        <span className="text-xs text-gray-400 font-mono">{language}</span>
        <button onClick={copy} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-900 transition-colors">
          {copied ? <><Check size={12} className="text-green-400" /><span className="text-green-400">Copied</span></> : <><Copy size={12} />Copy</>}
        </button>
      </div>
      <pre className="px-4 py-4 text-sm overflow-x-auto"><code className="text-gray-800 font-mono leading-relaxed">{code}</code></pre>
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
    POST: 'bg-blue-400/10 text-[#0c7aed] border-blue-400/20',
    DELETE: 'bg-red-400/10 text-red-400 border-red-400/20',
  }
  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden" style={{ background: '#FFFFFF' }}>
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left">
        <span className={`inline-flex px-2.5 py-0.5 rounded-md text-xs font-bold border font-mono shrink-0 ${colors[method] ?? colors.GET}`}>
          {method}
        </span>
        <span className="font-mono text-sm text-gray-700 flex-1">{path}</span>
        <span className="text-xs text-gray-400 hidden md:block flex-1">{description}</span>
        {open ? <ChevronDown size={15} className="text-gray-400 shrink-0" /> : <ChevronRight size={15} className="text-gray-400 shrink-0" />}
      </button>
      {open && children && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Param row ────────────────────────────────────────────────
function Param({ name, type, required, desc }: { name: string; type: string; required?: boolean; desc: string }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
      <code className="text-xs font-mono text-[#0c7aed] shrink-0 mt-0.5">{name}</code>
      <code className="text-xs font-mono text-gray-400 shrink-0 mt-0.5">{type}</code>
      {required && <span className="text-xs text-red-400 shrink-0 mt-0.5">required</span>}
      <span className="text-xs text-gray-500">{desc}</span>
    </div>
  )
}

// ── Nav sections ─────────────────────────────────────────────
const sections = [
  { id: 'quickstart',    label: 'Quick Start',      icon: Terminal },
  { id: 'auth',          label: 'Authentication',   icon: Key },
  { id: 'verify',        label: 'Verify API',       icon: Shield },
  { id: 'audit',         label: 'Audit Log API',    icon: FileCheck },
  { id: 'webhooks',      label: 'Webhooks',         icon: Webhook },
  { id: 'sdk',           label: 'JavaScript SDK',   icon: Terminal },
]

export default function APIDocsPage() {
  const [activeSection, setActiveSection] = useState('quickstart')

  const scrollTo = (id: string) => {
    setActiveSection(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="min-h-screen" style={{ background: '#FFFFFF' }}>

      {/* Nav */}
      <nav className="border-b border-gray-200 px-6 h-16 flex items-center justify-between sticky top-0 z-20"
        style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)' }}>
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
            <span className="text-gray-900 font-bold text-xs" style={{ fontFamily: 'Inter, sans-serif' }}>T</span>
          </div>
          <span className="font-bold text-gray-900" style={{ fontFamily: 'Inter, sans-serif' }}>
            tulip<span style={{ color: '#0c7aed' }}>ds</span>
            <span className="text-gray-400 font-normal text-sm ml-2">API Docs</span>
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/dashboard/api-keys" className="flex items-center gap-1.5 text-sm text-[#0c7aed] hover:underline">
            <Key size={13} /> Get API Key
          </Link>
          <Link href="/login" className="px-4 py-1.5 rounded-lg text-sm font-medium text-gray-900 border border-gray-200 hover:border-white/30 transition-all">
            Sign in
          </Link>
        </div>
      </nav>

      <div className="flex max-w-6xl mx-auto">

        {/* Sidebar */}
        <aside className="w-56 shrink-0 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto border-r border-gray-200 py-8 px-4 hidden md:block">
          <div className="text-xs text-gray-400 uppercase tracking-widest font-medium mb-4 px-2">Reference</div>
          {sections.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => scrollTo(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm mb-0.5 transition-all text-left ${
                activeSection === id
                  ? 'bg-[#0c7aed]/15 text-[#0c7aed]'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}>
              <Icon size={14} className="shrink-0" />
              {label}
            </button>
          ))}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <div className="px-3">
              <div className="text-xs text-gray-300 mb-2">Base URL</div>
              <code className="text-xs text-[#0c7aed] font-mono">api.tulipds.com</code>
            </div>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 px-8 py-10 space-y-16 min-w-0">

          {/* Quick Start */}
          <section id="quickstart">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0c7aed]/10 border border-[#0c7aed]/20 text-xs text-[#0c7aed] mb-4">
              <Terminal size={12} /> Quick Start
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>
              Tulip DS API
            </h1>
            <p className="text-gray-500 text-base mb-8 max-w-2xl">
              Add blockchain-verified audit trails to any application in minutes. Every record is SHA-256 hashed, anchored to Polygon, and RFC 3161 timestamped.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {[
                { label: 'REST API', desc: 'Simple HTTP endpoints' },
                { label: 'JavaScript SDK', desc: 'npm install tulip-js' },
                { label: 'Webhooks', desc: 'Real-time event delivery' },
              ].map(({ label, desc }) => (
                <div key={label} className="rounded-xl border border-gray-200 p-4"
                  style={{ background: '#FFFFFF' }}>
                  <div className="text-sm font-semibold text-gray-900 mb-1">{label}</div>
                  <div className="text-xs text-gray-500">{desc}</div>
                </div>
              ))}
            </div>

            <h2 className="text-lg font-semibold text-gray-900 mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>
              1. Get your API key
            </h2>
            <p className="text-gray-500 text-sm mb-4">Sign in to your NGO dashboard and create an API key under Settings → API Keys.</p>

            <h2 className="text-lg font-semibold text-gray-900 mb-3 mt-6" style={{ fontFamily: 'Inter, sans-serif' }}>
              2. Make your first request
            </h2>
            <CodeBlock language="bash" code={`curl https://api.tulipds.com/api/verify/YOUR_HASH \\
  -H "X-API-Key: tulip_live_xxxxxxxxxxxx"`} />

            <h2 className="text-lg font-semibold text-gray-900 mb-3 mt-6" style={{ fontFamily: 'Inter, sans-serif' }}>
              3. Or use the SDK
            </h2>
            <CodeBlock language="javascript" code={`import Tulip from 'tulip-js'

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
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0c7aed]/10 border border-[#0c7aed]/20 text-xs text-[#0c7aed] mb-4">
              <Key size={12} /> Authentication
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>Authentication</h2>
            <p className="text-gray-500 text-sm mb-6">
              All API requests must include your API key in the <code className="text-[#0c7aed] bg-gray-50 px-1.5 py-0.5 rounded text-xs">X-API-Key</code> header.
              Public endpoints (verify, donor portal) require no authentication.
            </p>

            <CodeBlock language="bash" code={`# All authenticated requests
curl https://api.tulipds.com/api/audit \\
  -H "X-API-Key: tulip_live_xxxxxxxxxxxx" \\
  -H "Content-Type: application/json"`} />

            <div className="mt-6 rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-4">
              <div className="text-xs font-semibold text-yellow-400 mb-1">Keep your API key secret</div>
              <div className="text-xs text-gray-500">Never expose API keys in client-side code or public repositories. Use environment variables.</div>
            </div>

            <h3 className="text-base font-semibold text-gray-900 mt-6 mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>API Key format</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <code className="text-[#0c7aed] font-mono bg-gray-50 px-2 py-1 rounded text-xs">tulip_live_</code>
                <span className="text-gray-500">Production key — real blockchain anchors</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <code className="text-[#0c7aed] font-mono bg-gray-50 px-2 py-1 rounded text-xs">tulip_test_</code>
                <span className="text-gray-500">Test key — Amoy testnet, no real cost</span>
              </div>
            </div>
          </section>

          {/* Verify API */}
          <section id="verify">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0c7aed]/10 border border-[#0c7aed]/20 text-xs text-[#0c7aed] mb-4">
              <Shield size={12} /> Verify API
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>Verify API</h2>
            <p className="text-gray-500 text-sm mb-6">
              Public endpoints — no authentication required. Anyone can verify a hash.
            </p>

            <div className="space-y-3">
              <Endpoint method="GET" path="/api/verify/{dataHash}" description="Verify a SHA-256 hash">
                <p className="text-sm text-gray-500">Re-derives the SHA-256 hash from stored fields, checks the prevHash chain, and confirms the blockchain TX on Polygon.</p>
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Path Parameters</div>
                  <Param name="dataHash" type="string" required desc="64-character SHA-256 hex hash of the audit log entry" />
                </div>
                <CodeBlock language="bash" code={`curl https://api.tulipds.com/api/verify/ab32d3e3e5befae2a6ea9dcb53ad1305372c5df8204bf8d1ede0fe48be65a025`} />
                <CodeBlock language="json" code={`{
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

              <Endpoint method="GET" path="/api/verify/batch/{batchId}" description="Verify all entries in a batch">
                <p className="text-sm text-gray-500">Checks chain integrity across all records in the batch and confirms the shared blockchain TX.</p>
                <Param name="batchId" type="string" required desc="Merkle root hash used as the batch identifier" />
                <CodeBlock language="bash" code={`curl https://api.tulipds.com/api/verify/batch/88e631dfd0739...`} />
              </Endpoint>
            </div>
          </section>

          {/* Audit Log API */}
          <section id="audit">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0c7aed]/10 border border-[#0c7aed]/20 text-xs text-[#0c7aed] mb-4">
              <FileCheck size={12} /> Audit Log API
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>Audit Log API</h2>
            <p className="text-gray-500 text-sm mb-6">
              Create and retrieve immutable audit log entries. Every entry is automatically SHA-256 hashed and queued for blockchain anchoring.
            </p>

            <div className="space-y-3">
              <Endpoint method="POST" path="/api/audit" description="Create an audit log entry">
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Body Parameters</div>
                  <Param name="action" type="string" required desc='Action name e.g. "EXPENSE_CREATED", "DOCUMENT_SIGNED"' />
                  <Param name="entityType" type="string" required desc='Entity type e.g. "Expense", "Document", "Project"' />
                  <Param name="entityId" type="string" required desc="ID of the entity being audited" />
                  <Param name="metadata" type="object" desc="Additional data to include in the hash" />
                </div>
                <CodeBlock language="javascript" code={`const res = await fetch('https://api.tulipds.com/api/audit', {
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
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Query Parameters</div>
                  <Param name="limit" type="number" desc="Number of results (default 20, max 100)" />
                  <Param name="page" type="number" desc="Page number for pagination" />
                  <Param name="anchorStatus" type="string" desc='"confirmed" | "pending" | "failed"' />
                  <Param name="entityType" type="string" desc="Filter by entity type" />
                </div>
                <CodeBlock language="bash" code={`curl "https://api.tulipds.com/api/audit?limit=10&anchorStatus=confirmed" \\
  -H "X-API-Key: tulip_live_xxxxxxxxxxxx"`} />
              </Endpoint>
            </div>
          </section>

          {/* Webhooks */}
          <section id="webhooks">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0c7aed]/10 border border-[#0c7aed]/20 text-xs text-[#0c7aed] mb-4">
              <Webhook size={12} /> Webhooks
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>Webhooks</h2>
            <p className="text-gray-500 text-sm mb-6">
              Receive real-time notifications when blockchain anchoring completes. Register a URL and we POST to it on every anchor event.
            </p>

            <h3 className="text-sm font-semibold text-gray-900 mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>Event types</h3>
            <div className="grid grid-cols-2 gap-2 mb-6">
              {['audit.anchored', 'audit.failed', 'batch.confirmed', 'document.verified'].map(e => (
                <code key={e} className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-xs text-[#0c7aed] font-mono">{e}</code>
              ))}
            </div>

            <CodeBlock language="javascript" code={`// Your webhook endpoint receives:
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
                <Param name="url" type="string" required desc="HTTPS URL to receive webhook payloads" />
                <Param name="events" type="string[]" required desc='Array of event types e.g. ["audit.anchored"]' />
                <Param name="secret" type="string" desc="Optional secret for HMAC signature verification" />
              </Endpoint>
              <Endpoint method="GET" path="/api/webhooks" description="List registered webhooks" />
              <Endpoint method="DELETE" path="/api/webhooks/{id}" description="Delete a webhook" />
            </div>
          </section>

          {/* SDK */}
          <section id="sdk">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0c7aed]/10 border border-[#0c7aed]/20 text-xs text-[#0c7aed] mb-4">
              <Terminal size={12} /> JavaScript SDK
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>JavaScript SDK</h2>
            <p className="text-gray-500 text-sm mb-6">
              The official <code className="text-[#0c7aed] bg-gray-50 px-1 rounded text-xs">tulip-js</code> SDK wraps the REST API with a clean interface for Node.js and browser environments.
            </p>

            <CodeBlock language="bash" code={`npm install tulip-js`} />

            <h3 className="text-sm font-semibold text-gray-900 mt-6 mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>Full example</h3>
            <CodeBlock language="javascript" code={`import Tulip from 'tulip-js'

const tulip = new Tulip({
  apiKey: process.env.TULIP_API_KEY,
  // baseUrl: 'https://api.tulipds.com' // default
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
            <div className="mt-10 rounded-2xl border border-[#0c7aed]/20 p-8 text-center"
              style={{ background: 'linear-gradient(135deg, rgba(12,122,237,0.05), rgba(0,78,168,0.05))' }}>
              <Shield size={28} className="text-[#0c7aed] mx-auto mb-3" />
              <h3 className="font-bold text-gray-900 text-lg mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                Ready to integrate?
              </h3>
              <p className="text-gray-500 text-sm max-w-sm mx-auto mb-5">
                Sign in to your dashboard, create an API key, and make your first verified audit entry in under 5 minutes.
              </p>
              <div className="flex items-center justify-center gap-3">
                <Link href="/dashboard/api-keys"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white"
                  style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
                  <Key size={15} /> Get API Key
                </Link>
                <Link href="https://github.com/tulipds" target="_blank"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm text-gray-500 border border-gray-200 hover:border-gray-300 transition-all">
                  <ArrowUpRight size={15} /> GitHub
                </Link>
              </div>
            </div>
          </section>

        </main>
      </div>
    </div>
  )
}
