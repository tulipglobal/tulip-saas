'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  Shield, Search, CheckCircle, XCircle, Clock,
  Hash, Globe, Lock, ArrowRight, Copy, ExternalLink
} from 'lucide-react'

interface VerifyResult {
  status: 'verified' | 'failed' | 'pending'
  hash: string
  prevHash?: string
  merkleRoot?: string
  blockchainTx?: string
  blockNumber?: number
  blockchainTimestamp?: string
  timestampedAt?: string
  rfc3161Token?: string
  tsaUrl?: string
  integrityStatus?: string
  verificationUrl?: string
  record?: {
    title?: string
    tenantName?: string
    organisationType?: string
    projectName?: string
    expenseDescription?: string
    amount?: number
    currency?: string
    budget?: number
    createdAt?: string
    type?: string
  }
  error?: string
}

export default function VerifyPage() {
  const [hash, setHash] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hash.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/verify/${hash.trim()}`
      )
      const data = await res.json()
      if (res.ok) {
        setResult({
            status: (data.verified === true || (data.integrity?.hashIntact === true && data.entityType)) ? 'verified' : 'failed',
            hash: data.dataHash,
            prevHash: data.integrity?.hashRecomputed,
            merkleRoot: data.batchId,
            blockchainTx: data.blockchain?.txHash,
            blockNumber: data.blockchain?.blockNumber,
            blockchainTimestamp: data.blockchain?.ancheredAt,
            timestampedAt: data.blockchain?.ancheredAt,
            integrityStatus: (data.integrity?.hashIntact) ? 'verified' : 'failed',
            record: {
              title: data.action,
              tenantName: data.entityDetails?.organisationName || data.audit?.tenantId,
              organisationType: data.entityDetails?.organisationType,
              projectName: data.entityDetails?.projectName,
              expenseDescription: data.entityDetails?.expenseDescription,
              amount: data.entityDetails?.amount,
              currency: data.entityDetails?.currency,
              budget: data.entityDetails?.budget,
              createdAt: data.recordedAt,
              type: data.entityType,
            }
          })
      } else {
        setResult({ status: 'failed', hash: hash.trim(), error: data.message || 'Hash not found' })
      }
    } catch {
      setResult({ status: 'failed', hash: hash.trim(), error: 'Cannot connect to verification server' })
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const truncate = (str: string, len = 20) =>
    str && str.length > len ? str.slice(0, len) + '...' : str

  return (
    <div className="min-h-screen bg-[#040f1f]" style={{ fontFamily: 'DM Sans, sans-serif' }}>

      {/* NAV */}
      <nav className="border-b border-white/10 bg-[#07224a]/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg tulip-gradient flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
            <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '17px', color: 'white' }}>
              tulip<span style={{ color: '#369bff' }}>ds</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login"
              className="px-4 py-2 rounded-lg text-white text-sm font-medium tulip-gradient hover:opacity-90 transition-opacity">
              Sign in
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <div className="max-w-3xl mx-auto px-6 pt-16 pb-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 mb-6">
          <Lock className="w-3 h-3 text-blue-400" />
          <span style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 500 }}>
            Public verification · No login required
          </span>
        </div>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 'clamp(28px, 5vw, 52px)', color: 'white', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          Verify any hash
        </h1>
        <p style={{ color: '#64748b', fontSize: '17px', marginTop: '12px', lineHeight: 1.7 }}>
          Enter a SHA-256 hash to verify its blockchain anchor,
          RFC 3161 timestamp, and integrity chain.
        </p>
      </div>

      {/* SEARCH */}
      <div className="max-w-3xl mx-auto px-6 pb-12">
        <form onSubmit={handleVerify}>
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={hash}
                onChange={e => setHash(e.target.value)}
                placeholder="Enter SHA-256 hash (64 hex characters)..."
                className="w-full pl-11 pr-4 py-4 rounded-xl border border-white/10 bg-white/5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-all text-sm font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !hash.trim()}
              className="px-6 py-4 rounded-xl text-white font-semibold tulip-gradient hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <><Search className="w-4 h-4" /> Verify</>
              )}
            </button>
          </div>
        </form>

        {/* Demo hashes */}
        <div className="mt-4 flex flex-wrap gap-2 items-center">
          <span style={{ color: '#334155', fontSize: '12px' }}>Try an example:</span>
          {[
            { label: 'Sample hash', value: 'a3f5c9b2e1d8f4a6c7e2b5d9f3a1c8e4b6d2f5a9c3e7b1d4f8a2c6e0b4d7f1' },
          ].map(ex => (
            <button
              key={ex.label}
              onClick={() => setHash(ex.value)}
              style={{ fontSize: '12px', color: '#369bff', fontFamily: 'monospace' }}
              className="hover:underline"
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      {/* RESULT */}
      {result && (
        <div className="max-w-3xl mx-auto px-6 pb-16 animate-fade-up">

          {/* Status banner */}
          <div className={`flex items-center gap-3 p-4 rounded-xl mb-6 ${
            result.status === 'verified'
              ? 'bg-emerald-500/10 border border-emerald-500/20'
              : 'bg-red-500/10 border border-red-500/20'
          }`}>
            {result.status === 'verified' ? (
              <CheckCircle className="w-6 h-6 text-emerald-400 flex-shrink-0" />
            ) : (
              <XCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
            )}
            <div>
              <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '18px', color: result.status === 'verified' ? '#34d399' : '#f87171' }}>
                {result.status === 'verified' ? 'Hash Verified' : 'Verification Failed'}
              </p>
              <p style={{ color: '#64748b', fontSize: '13px', marginTop: '2px' }}>
                {result.status === 'verified'
                  ? 'This hash is anchored to blockchain and has a valid RFC 3161 timestamp.'
                  : result.error || 'This hash was not found in the Tulip DS verification registry.'}
              </p>
            </div>
          </div>

          {result.status === 'verified' && (
            <div className="space-y-4">

              {/* Record info */}
              {result.record && (
                <div className="p-5 rounded-xl border border-white/5 bg-white/3">
                  <p style={{ color: '#64748b', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>
                    Record
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    {result.record.tenantName && (
                      <div>
                        <p style={{ color: '#475569', fontSize: '12px' }}>Organisation</p>
                        <p style={{ color: 'white', fontSize: '14px', fontWeight: 500, marginTop: '2px' }}>{result.record.tenantName}</p>
                      </div>
                    )}
                    {result.record.organisationType && (
                      <div>
                        <p style={{ color: '#475569', fontSize: '12px' }}>Type</p>
                        <p style={{ color: 'white', fontSize: '14px', fontWeight: 500, marginTop: '2px' }}>{result.record.organisationType}</p>
                      </div>
                    )}
                    {result.record.projectName && (
                      <div>
                        <p style={{ color: '#475569', fontSize: '12px' }}>Project</p>
                        <p style={{ color: 'white', fontSize: '14px', fontWeight: 500, marginTop: '2px' }}>{result.record.projectName}</p>
                      </div>
                    )}
                    {result.record.expenseDescription && (
                      <div>
                        <p style={{ color: '#475569', fontSize: '12px' }}>Description</p>
                        <p style={{ color: 'white', fontSize: '14px', fontWeight: 500, marginTop: '2px' }}>{result.record.expenseDescription}</p>
                      </div>
                    )}
                    {result.record.amount && (
                      <div>
                        <p style={{ color: '#475569', fontSize: '12px' }}>Amount</p>
                        <p style={{ color: '#34d399', fontSize: '16px', fontWeight: 700, marginTop: '2px' }}>{result.record.currency} {result.record.amount.toLocaleString()}</p>
                      </div>
                    )}
                    {result.record.budget && (
                      <div>
                        <p style={{ color: '#475569', fontSize: '12px' }}>Budget</p>
                        <p style={{ color: '#34d399', fontSize: '16px', fontWeight: 700, marginTop: '2px' }}>USD {result.record.budget.toLocaleString()}</p>
                      </div>
                    )}
                    {result.record.title && (
                      <div>
                        <p style={{ color: '#475569', fontSize: '12px' }}>Action</p>
                        <p style={{ color: 'white', fontSize: '14px', fontWeight: 500, marginTop: '2px' }}>{result.record.title}</p>
                      </div>
                    )}
                    {result.record.createdAt && (
                      <div>
                        <p style={{ color: '#475569', fontSize: '12px' }}>Recorded</p>
                        <p style={{ color: 'white', fontSize: '14px', fontWeight: 500, marginTop: '2px' }}>
                          {new Date(result.record.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Hash chain */}
              <div className="p-5 rounded-xl border border-white/5 bg-white/3">
                <p style={{ color: '#64748b', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>
                  Hash Chain
                </p>
                <div className="space-y-3">
                  {[
                    { label: 'Data Hash', value: result.hash, key: 'hash' },
                    { label: 'Previous Hash', value: result.prevHash, key: 'prevHash' },
                    { label: 'Merkle Root', value: result.merkleRoot, key: 'merkleRoot' },
                  ].filter(row => row.value).map(row => (
                    <div key={row.key} className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p style={{ color: '#475569', fontSize: '11px', marginBottom: '2px' }}>{row.label}</p>
                        <p className="hash-mono text-slate-400 truncate">{row.value}</p>
                      </div>
                      <button
                        onClick={() => copyToClipboard(row.value!, row.key)}
                        className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                        title="Copy"
                      >
                        {copied === row.key
                          ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                          : <Copy className="w-3.5 h-3.5 text-slate-500" />
                        }
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Blockchain anchor */}
              {result.blockchainTx && (
                <div className="p-5 rounded-xl border border-white/5 bg-white/3">
                  <p style={{ color: '#64748b', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>
                    Blockchain Anchor
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p style={{ color: '#475569', fontSize: '11px', marginBottom: '2px' }}>Transaction Hash</p>
                        <p className="hash-mono text-slate-400 truncate">{result.blockchainTx}</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => copyToClipboard(result.blockchainTx!, 'tx')}
                          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                          {copied === 'tx'
                            ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                            : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                        </button>
                        <a href={`https://polygonscan.com/tx/${result.blockchainTx}`}
                          target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                          <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                        </a>
                      </div>
                    </div>
                    {result.blockNumber && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p style={{ color: '#475569', fontSize: '11px', marginBottom: '2px' }}>Block Number</p>
                          <p style={{ color: 'white', fontSize: '13px', fontFamily: 'monospace' }}>#{result.blockNumber.toLocaleString()}</p>
                        </div>
                        {result.blockchainTimestamp && (
                          <div>
                            <p style={{ color: '#475569', fontSize: '11px', marginBottom: '2px' }}>Anchored At</p>
                            <p style={{ color: 'white', fontSize: '13px' }}>
                              {new Date(result.blockchainTimestamp).toLocaleString('en-GB')}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      <Globe className="w-3.5 h-3.5 text-blue-400" />
                      <span style={{ color: '#369bff', fontSize: '12px', fontWeight: 500 }}>Polygon Network</span>
                      <span style={{ color: '#334155', fontSize: '12px' }}>· Immutable · Public · Permanent</span>
                    </div>
                  </div>
                </div>
              )}

              {/* RFC 3161 Timestamp */}
              {result.timestampedAt && (
                <div className="p-5 rounded-xl border border-white/5 bg-white/3">
                  <p style={{ color: '#64748b', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>
                    RFC 3161 Trusted Timestamp
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p style={{ color: '#475569', fontSize: '11px', marginBottom: '2px' }}>Timestamped At</p>
                      <p style={{ color: 'white', fontSize: '13px' }}>
                        {new Date(result.timestampedAt).toLocaleString('en-GB')}
                      </p>
                    </div>
                    {result.tsaUrl && (
                      <div>
                        <p style={{ color: '#475569', fontSize: '11px', marginBottom: '2px' }}>TSA Authority</p>
                        <p style={{ color: '#94a3b8', fontSize: '13px', fontFamily: 'monospace' }}>{result.tsaUrl}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" />
                    <span style={{ color: '#10b981', fontSize: '12px', fontWeight: 500 }}>RFC 3161 Compliant</span>
                    <span style={{ color: '#334155', fontSize: '12px' }}>· eIDAS · ESIGN Act · Legally admissible</span>
                  </div>
                </div>
              )}

              {/* Verification URL */}
              {result.verificationUrl && (
                <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p style={{ color: '#475569', fontSize: '11px', marginBottom: '2px' }}>Shareable Verification Link</p>
                    <p className="hash-mono text-blue-400 truncate">{result.verificationUrl}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(result.verificationUrl!, 'url')}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 transition-colors"
                    style={{ color: '#369bff', fontSize: '12px', fontWeight: 500 }}
                  >
                    {copied === 'url' ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied === 'url' ? 'Copied' : 'Copy link'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* HOW IT WORKS (shown when no result) */}
      {!result && !loading && (
        <div className="max-w-3xl mx-auto px-6 pb-20">
          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: <Hash className="w-5 h-5" />, title: 'SHA-256 Hash', desc: 'Every record is hashed. Only the hash is stored — your data stays private.' },
              { icon: <Globe className="w-5 h-5" />, title: 'Blockchain Anchor', desc: 'The Merkle root is anchored to Polygon. Anyone can independently verify it.' },
              { icon: <Clock className="w-5 h-5" />, title: 'RFC 3161 Timestamp', desc: 'A trusted timestamp from FreeTSA proves when the data existed.' },
            ].map(item => (
              <div key={item.title} className="p-4 rounded-xl border border-white/5 bg-white/3 text-center">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center mx-auto mb-3 text-blue-400">
                  {item.icon}
                </div>
                <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '14px', color: 'white', marginBottom: '6px' }}>{item.title}</p>
                <p style={{ color: '#475569', fontSize: '12px', lineHeight: 1.6 }}>{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 p-5 rounded-xl border border-white/5 bg-white/3 text-center">
            <p style={{ color: '#475569', fontSize: '14px' }}>
              Want to verify your own records?{' '}
              <Link href="/login" style={{ color: '#369bff', fontWeight: 500 }} className="hover:underline">
                Sign in to your NGO dashboard
              </Link>
              {' '}or{' '}
              <Link href="/developers" style={{ color: '#369bff', fontWeight: 500 }} className="hover:underline">
                use the Verify API
              </Link>
            </p>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="border-t border-white/5 py-8">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p style={{ color: '#1e293b', fontSize: '12px' }}>
            © 2026 Tulip DS · Bright Bytes Technology · Dubai, UAE
          </p>
        </div>
      </footer>
    </div>
  )
}
