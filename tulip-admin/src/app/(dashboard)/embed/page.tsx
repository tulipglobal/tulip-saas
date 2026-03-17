'use client'

import { useState, useEffect, useRef } from 'react'
import { apiGet } from '@/lib/api'
import { Code2, Copy, Check, ExternalLink, Eye } from 'lucide-react'

function CodeBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="rounded-lg border border-[var(--admin-border)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--admin-bg)] border-b border-[var(--admin-border)]">
        <span className="text-xs font-medium text-[var(--admin-text-secondary)]">{label}</span>
        <button onClick={copy} className="flex items-center gap-1.5 text-xs text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] transition-colors">
          {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 text-sm text-[var(--admin-text)] overflow-x-auto bg-[var(--admin-card)]"><code>{code}</code></pre>
    </div>
  )
}

export default function EmbedPage() {
  const [documents, setDocuments] = useState<{ id: string; title: string; dataHash: string }[]>([])
  const [selectedDoc, setSelectedDoc] = useState('')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [size, setSize] = useState<'default' | 'compact'>('default')
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    apiGet('/api/documents?limit=20')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(d => {
        const docs = d.data || d.documents || d || []
        setDocuments(docs)
        if (docs.length > 0) setSelectedDoc(docs[0].dataHash)
      })
      .catch(() => {})
  }, [])

  const verifyUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.sealayer.io'
  const genericSnippet = `<script src="${verifyUrl}/badge.js" data-sealayer-theme="${theme}" data-sealayer-size="${size}"></script>`
  const specificSnippet = selectedDoc
    ? `<div data-sealayer-hash="${selectedDoc}" data-sealayer-theme="${theme}" data-sealayer-size="${size}"></div>\n<script src="${verifyUrl}/badge.js"></script>`
    : ''

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-[var(--admin-text)]">Embed Widget</h1>
        <p className="text-sm text-[var(--admin-text-secondary)] mt-1">Add verification badges to any website</p>
      </div>

      {/* Controls */}
      <div className="bg-[var(--admin-card)] rounded-xl border border-[var(--admin-border)] p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-[var(--admin-text-secondary)] mb-1.5">Document</label>
            <select value={selectedDoc} onChange={e => setSelectedDoc(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm border border-[var(--admin-border)] bg-[var(--admin-bg)]">
              {documents.map(d => <option key={d.id} value={d.dataHash}>{d.title || d.id}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--admin-text-secondary)] mb-1.5">Theme</label>
            <div className="flex gap-2">
              {(['light', 'dark'] as const).map(t => (
                <button key={t} onClick={() => setTheme(t)} className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors capitalize ${theme === t ? 'border-[var(--admin-accent)] bg-[var(--admin-accent)]/10 text-[var(--admin-accent)]' : 'border-[var(--admin-border)] text-[var(--admin-text-muted)]'}`}>{t}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--admin-text-secondary)] mb-1.5">Size</label>
            <div className="flex gap-2">
              {(['default', 'compact'] as const).map(s => (
                <button key={s} onClick={() => setSize(s)} className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors capitalize ${size === s ? 'border-[var(--admin-accent)] bg-[var(--admin-accent)]/10 text-[var(--admin-accent)]' : 'border-[var(--admin-border)] text-[var(--admin-text-muted)]'}`}>{s}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-[var(--admin-card)] rounded-xl border border-[var(--admin-border)] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Eye size={16} className="text-[var(--admin-text-secondary)]" />
          <span className="text-sm font-medium text-[var(--admin-text)]">Live Preview</span>
        </div>
        <div ref={previewRef} className={`rounded-lg p-6 flex items-center justify-center min-h-[100px] ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-800'}`}>
            <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
              <Check size={12} className="text-white" />
            </div>
            <span className={`text-sm font-medium ${size === 'compact' ? 'text-xs' : ''}`}>Verified by Sealayer</span>
          </div>
        </div>
      </div>

      {/* Code snippets */}
      <div className="space-y-4">
        <CodeBlock code={genericSnippet} label="Generic embed (auto-detects hashes on page)" />
        {specificSnippet && <CodeBlock code={specificSnippet} label="Specific document embed" />}
      </div>
    </div>
  )
}
