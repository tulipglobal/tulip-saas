'use client'

import { useState, useEffect, useRef } from 'react'
import { apiGet } from '@/lib/api'
import { Code2, Copy, Check, ExternalLink, Eye } from 'lucide-react'

const BADGE_SCRIPT_URL = 'https://tulipds.com/embed/badge.js'

function CodeBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
        <span className="text-xs text-gray-500 font-medium">{label}</span>
        <button
          onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          {copied ? <><Check size={12} className="text-green-400" /> Copied</> : <><Copy size={12} /> Copy</>}
        </button>
      </div>
      <pre className="p-4 text-sm text-gray-700 overflow-x-auto bg-black/30">
        <code>{code}</code>
      </pre>
    </div>
  )
}

export default function EmbedPage() {
  const [documents, setDocuments] = useState<{ id: string; name: string; sha256Hash: string | null }[]>([])
  const [selectedHash, setSelectedHash] = useState('')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [size, setSize] = useState<'default' | 'compact'>('default')
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    apiGet('/api/documents?limit=20')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(d => {
        const docs = (d.data ?? d.items ?? []).filter((doc: { sha256Hash: string | null }) => doc.sha256Hash)
        setDocuments(docs)
        if (docs.length > 0 && !selectedHash) setSelectedHash(docs[0].sha256Hash)
      })
      .catch(() => {})
  }, [])

  // Re-render preview when params change
  useEffect(() => {
    if (!previewRef.current || !selectedHash) return
    const container = previewRef.current
    container.innerHTML = ''

    const el = document.createElement('div')
    el.setAttribute('data-tulip-badge', selectedHash)
    el.setAttribute('data-tulip-theme', theme)
    el.setAttribute('data-tulip-size', size)
    container.appendChild(el)

    // Inline badge renderer for preview (mirrors badge.js logic)
    const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.tulipds.com'
    const APP = 'https://tulipds.com'

    const STYLES = `
      :host { display: inline-block; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
      .tulip-badge { display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 8px; cursor: pointer; text-decoration: none; transition: box-shadow 0.2s, transform 0.15s; border: 1px solid; line-height: 1; }
      .tulip-badge:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
      .tulip-badge.light.verified { background: #f0fdf4; border-color: #bbf7d0; color: #166534; }
      .tulip-badge.light.unverified { background: #f9fafb; border-color: #e5e7eb; color: #6b7280; }
      .tulip-badge.light.loading { background: #f9fafb; border-color: #e5e7eb; color: #9ca3af; }
      .tulip-badge.dark.verified { background: rgba(34,197,94,0.1); border-color: rgba(34,197,94,0.25); color: #4ade80; }
      .tulip-badge.dark.unverified { background: #F9FAFB; border-color: #E5E7EB; color: #9CA3AF; }
      .tulip-badge.dark.loading { background: #FFFFFF; border-color: #E5E7EB; color: #9CA3AF; }
      .tulip-badge.compact { padding: 5px 10px; gap: 6px; border-radius: 6px; }
      .tulip-badge.compact .tulip-icon { width: 14px; height: 14px; }
      .tulip-badge.compact .tulip-text { font-size: 11px; }
      .tulip-badge.compact .tulip-label { display: none; }
      .tulip-icon { width: 18px; height: 18px; flex-shrink: 0; }
      .tulip-content { display: flex; flex-direction: column; gap: 1px; }
      .tulip-text { font-size: 13px; font-weight: 600; white-space: nowrap; }
      .tulip-label { font-size: 10px; opacity: 0.7; white-space: nowrap; }
      @keyframes tulip-spin { to { transform: rotate(360deg); } }
      .tulip-spinner { animation: tulip-spin 1s linear infinite; }
    `

    const ICON_VERIFIED = '<svg class="tulip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
    const ICON_UNVERIFIED = '<svg class="tulip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
    const ICON_LOADING = '<svg class="tulip-icon tulip-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>'

    const shadow = el.attachShadow({ mode: 'open' })
    const styleEl = document.createElement('style')
    styleEl.textContent = STYLES
    shadow.appendChild(styleEl)

    const link = document.createElement('a')
    link.className = `tulip-badge ${theme} loading${size === 'compact' ? ' compact' : ''}`
    link.href = `${APP}/verify?hash=${encodeURIComponent(selectedHash)}`
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.innerHTML = ICON_LOADING + '<div class="tulip-content"><span class="tulip-text">Checking\u2026</span><span class="tulip-label">Tulip DS</span></div>'
    shadow.appendChild(link)

    fetch(`${API}/api/verify/${encodeURIComponent(selectedHash)}`)
      .then(r => r.json())
      .then(data => {
        if (data.verified) {
          link.className = `tulip-badge ${theme} verified${size === 'compact' ? ' compact' : ''}`
          link.innerHTML = ICON_VERIFIED + '<div class="tulip-content"><span class="tulip-text">Verified</span><span class="tulip-label">Tulip DS \u00b7 Polygon</span></div>'
        } else {
          link.className = `tulip-badge ${theme} unverified${size === 'compact' ? ' compact' : ''}`
          link.innerHTML = ICON_UNVERIFIED + '<div class="tulip-content"><span class="tulip-text">Unverified</span><span class="tulip-label">Tulip DS</span></div>'
        }
      })
      .catch(() => {
        link.className = `tulip-badge ${theme} unverified${size === 'compact' ? ' compact' : ''}`
        link.innerHTML = ICON_UNVERIFIED + '<div class="tulip-content"><span class="tulip-text">Unverified</span><span class="tulip-label">Tulip DS</span></div>'
      })
  }, [selectedHash, theme, size])

  const embedSnippet = selectedHash
    ? `<!-- Tulip DS Verification Badge -->\n<script src="${BADGE_SCRIPT_URL}"></script>\n<div data-tulip-badge="${selectedHash}"${theme !== 'light' ? ` data-tulip-theme="${theme}"` : ''}${size !== 'default' ? ` data-tulip-size="${size}"` : ''}></div>`
    : '<!-- Select a document hash first -->'

  const genericSnippet = `<!-- Tulip DS Verification Badge -->\n<script src="${BADGE_SCRIPT_URL}"></script>\n<div data-tulip-badge="YOUR_DOCUMENT_HASH"></div>`

  return (
    <div className="p-6 space-y-6 animate-fade-up max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Syne, sans-serif' }}>Embed Badge</h1>
        <p className="text-gray-500 text-sm mt-1">Add a verification badge to any website to prove your documents are blockchain-verified.</p>
      </div>

      {/* Quick start */}
      <div className="rounded-xl border border-gray-200 p-5 space-y-4" style={{ background: '#FFFFFF' }}>
        <div className="flex items-center gap-2">
          <Code2 size={18} className="text-[#2563EB]" />
          <h2 className="text-gray-900 font-semibold text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>Quick Start</h2>
        </div>
        <p className="text-gray-500 text-sm">Paste this snippet into any HTML page. Replace <code className="text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded text-xs">YOUR_DOCUMENT_HASH</code> with a SHA-256 hash from your verified documents.</p>
        <CodeBlock code={genericSnippet} label="HTML" />
      </div>

      {/* Options */}
      <div className="rounded-xl border border-gray-200 p-5 space-y-4" style={{ background: '#FFFFFF' }}>
        <h2 className="text-gray-900 font-semibold text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>Options</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="py-2 pr-4 text-gray-500 font-medium text-xs uppercase">Attribute</th>
                <th className="py-2 pr-4 text-gray-500 font-medium text-xs uppercase">Values</th>
                <th className="py-2 text-gray-500 font-medium text-xs uppercase">Description</th>
              </tr>
            </thead>
            <tbody className="text-gray-600">
              <tr className="border-b border-gray-100">
                <td className="py-2.5 pr-4"><code className="text-xs bg-gray-50 px-1.5 py-0.5 rounded">data-tulip-badge</code></td>
                <td className="py-2.5 pr-4 text-xs">SHA-256 hash</td>
                <td className="py-2.5 text-xs">The document or audit log hash to verify</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2.5 pr-4"><code className="text-xs bg-gray-50 px-1.5 py-0.5 rounded">data-tulip-theme</code></td>
                <td className="py-2.5 text-xs"><code className="bg-gray-50 px-1 rounded">light</code> | <code className="bg-gray-50 px-1 rounded">dark</code></td>
                <td className="py-2.5 text-xs">Badge colour scheme (default: light)</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4"><code className="text-xs bg-gray-50 px-1.5 py-0.5 rounded">data-tulip-size</code></td>
                <td className="py-2.5 text-xs"><code className="bg-gray-50 px-1 rounded">default</code> | <code className="bg-gray-50 px-1 rounded">compact</code></td>
                <td className="py-2.5 text-xs">Badge size variant</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Live preview */}
      <div className="rounded-xl border border-gray-200 p-5 space-y-4" style={{ background: '#FFFFFF' }}>
        <div className="flex items-center gap-2">
          <Eye size={18} className="text-[#2563EB]" />
          <h2 className="text-gray-900 font-semibold text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>Live Preview</h2>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-gray-500 font-medium">Document</label>
            <select
              value={selectedHash}
              onChange={e => setSelectedHash(e.target.value)}
              className="block bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none min-w-[200px]"
            >
              {documents.length === 0 && <option value="">No verified documents</option>}
              {documents.map(doc => (
                <option key={doc.id} value={doc.sha256Hash!}>
                  {doc.name} ({doc.sha256Hash!.slice(0, 12)}...)
                </option>
              ))}
              <option value="0000000000000000000000000000000000000000000000000000000000000000">
                Fake hash (unverified)
              </option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-gray-500 font-medium">Theme</label>
            <div className="flex gap-1">
              {(['light', 'dark'] as const).map(t => (
                <button key={t} onClick={() => setTheme(t)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${theme === t ? 'bg-[#2563EB]/20 border-[#2563EB]/40 text-[#2563EB]' : 'bg-gray-50 border-gray-200 text-gray-500 hover:text-gray-600'}`}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-gray-500 font-medium">Size</label>
            <div className="flex gap-1">
              {(['default', 'compact'] as const).map(s => (
                <button key={s} onClick={() => setSize(s)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${size === s ? 'bg-[#2563EB]/20 border-[#2563EB]/40 text-[#2563EB]' : 'bg-gray-50 border-gray-200 text-gray-500 hover:text-gray-600'}`}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Preview area */}
        <div className={`rounded-lg border p-8 flex items-center justify-center ${theme === 'dark' ? 'bg-[#0a0a0a] border-gray-200' : 'bg-white border-gray-200'}`}>
          <div ref={previewRef} />
        </div>

        {/* Embed code for selected config */}
        {selectedHash && <CodeBlock code={embedSnippet} label="Embed Code" />}
      </div>
    </div>
  )
}
