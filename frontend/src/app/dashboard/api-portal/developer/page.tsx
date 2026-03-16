'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { apiGet } from '@/lib/api'
import {
  Code2, Plus, Trash2, Copy, Check, Key, BarChart3,
  Clock, AlertTriangle, CheckCircle2, XCircle, Loader2,
  RefreshCw, Eye, EyeOff, ChevronDown, ChevronRight
} from 'lucide-react'

/* -- Types --------------------------------------------------------- */

interface ApiKeyRecord {
  id: string
  name: string
  prefix: string
  permissions: string[]
  lastUsedAt: string | null
  expiresAt: string | null
  revokedAt: string | null
  createdAt: string
  key?: string
}

interface UsageStats {
  today: { total: number; success: number; errors: number }
  thisMonth: { total: number; success: number; errors: number }
  successRate: number
  avgResponseTime: number
  byEndpoint: { endpoint: string; total: number; success: number; errors: number }[]
  byKey: { keyId: string; name: string; prefix: string; total: number }[]
  recentCalls: {
    id: string; endpoint: string; method: string; statusCode: number
    responseTime: number; createdAt: string; keyName: string; keyPrefix: string
  }[]
}

/* -- Helpers ------------------------------------------------------- */

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string
  icon: typeof BarChart3; color: string
}) {
  return (
    <div className="p-4 rounded-xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)]">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={16} />
        </div>
        <span className="text-xs text-[var(--tulip-forest)]/60 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold text-[var(--tulip-forest)]">{value}</p>
      {sub ? <p className="text-xs text-[var(--tulip-forest)]/40 mt-0.5">{sub}</p> : null}
    </div>
  )
}

/* -- Code examples ------------------------------------------------- */

function getCodeExamples(apiUrl: string) {
  return {
    ocrCurl: `curl -X POST ${apiUrl}/api/external/ocr/process \\
  -H "Authorization: Bearer tl_live_YOUR_API_KEY" \\
  -F "file=@invoice.pdf"`,

    ocrPython: `import requests

resp = requests.post(
    "${apiUrl}/api/external/ocr/process",
    headers={"Authorization": "Bearer tl_live_YOUR_API_KEY"},
    files={"file": open("invoice.pdf", "rb")}
)
job = resp.json()["data"]
print(f"Job ID: {job['id']}, Status: {job['status']}")

# Poll for completion
import time
while True:
    time.sleep(3)
    r = requests.get(
        f"${apiUrl}/api/external/ocr/jobs/{job['id']}",
        headers={"Authorization": "Bearer tl_live_YOUR_API_KEY"}
    )
    result = r.json()["data"]
    if result["status"] in ("completed", "failed"):
        print(result)
        break`,

    ocrJs: `const form = new FormData();
form.append('file', fs.createReadStream('invoice.pdf'));

const resp = await fetch('${apiUrl}/api/external/ocr/process', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer tl_live_YOUR_API_KEY' },
  body: form
});
const { data } = await resp.json();
console.log('Job ID:', data.id);

// Poll for completion
const poll = setInterval(async () => {
  const r = await fetch(\`${apiUrl}/api/external/ocr/jobs/\${data.id}\`, {
    headers: { 'Authorization': 'Bearer tl_live_YOUR_API_KEY' }
  });
  const result = await r.json();
  if (['completed', 'failed'].includes(result.data.status)) {
    clearInterval(poll);
    console.log(result.data);
  }
}, 3000);`,

    bundleCurl: `curl -X POST ${apiUrl}/api/external/ocr/bundle \\
  -H "Authorization: Bearer tl_live_YOUR_API_KEY" \\
  -F "files=@invoice.pdf" \\
  -F "files=@receipt.jpg" \\
  -F "files=@contract.png" \\
  -F "name=Client Application Bundle"`,

    bundlePython: `import requests

files = [
    ("files", open("invoice.pdf", "rb")),
    ("files", open("receipt.jpg", "rb")),
    ("files", open("contract.png", "rb")),
]
resp = requests.post(
    "${apiUrl}/api/external/ocr/bundle",
    headers={"Authorization": "Bearer tl_live_YOUR_API_KEY"},
    files=files,
    data={"name": "Client Application Bundle"}
)
bundle = resp.json()["data"]
print(f"Bundle ID: {bundle['id']}")`,

    bundleJs: `const form = new FormData();
form.append('files', fs.createReadStream('invoice.pdf'));
form.append('files', fs.createReadStream('receipt.jpg'));
form.append('files', fs.createReadStream('contract.png'));
form.append('name', 'Client Application Bundle');

const resp = await fetch('${apiUrl}/api/external/ocr/bundle', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer tl_live_YOUR_API_KEY' },
  body: form
});
const { data } = await resp.json();
console.log('Bundle ID:', data.id);`,
  }
}

/* -- Main Page ----------------------------------------------------- */

export default function DeveloperApiPage() {
  const t = useTranslations('apiPortal.developer')
  const [keys, setKeys] = useState<ApiKeyRecord[]>([])
  const [usage, setUsage] = useState<UsageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'keys' | 'usage' | 'docs'>('keys')
  const [docsSection, setDocsSection] = useState<'ocr' | 'bundle'>('ocr')
  const [docsLang, setDocsLang] = useState<'curl' | 'python' | 'javascript'>('curl')

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.tulipds.com'

  const fetchKeys = useCallback(async () => {
    try {
      const res = await apiGet('/api/developer/keys')
      if (res.ok) {
        const json = await res.json()
        setKeys(json.data ?? json ?? [])
      }
    } catch { /* silent */ } finally { setLoading(false) }
  }, [])

  const fetchUsage = useCallback(async () => {
    try {
      const res = await apiGet('/api/developer/usage')
      if (res.ok) {
        const json = await res.json()
        setUsage(json.data ?? null)
      }
    } catch { /* silent */ }
  }, [])

  useEffect(() => { fetchKeys(); fetchUsage() }, [fetchKeys, fetchUsage])

  const handleCreate = async () => {
    if (!newKeyName.trim()) return
    setCreating(true)
    setError(null)
    try {
      const token = localStorage.getItem('tulip_token')
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/developer/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newKeyName.trim(), permissions: ['documents:read', 'documents:write'] })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: t('failedToCreateKey') }))
        setError(err.error || t('failedToCreateKey'))
        return
      }
      const json = await res.json()
      const created = json.data ?? json
      setNewlyCreatedKey(created.key)
      setNewKeyName('')
      setShowCreate(false)
      fetchKeys()
    } catch {
      setError(t('networkError'))
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async (id: string) => {
    if (!confirm(t('revokeConfirm'))) return
    try {
      const token = localStorage.getItem('tulip_token')
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/developer/keys/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      fetchKeys()
    } catch { /* silent */ }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const activeKeys = keys.filter(k => !k.revokedAt)
  const revokedKeys = keys.filter(k => k.revokedAt)
  const codes = getCodeExamples(apiUrl)

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--tulip-gold)]">
              <Code2 size={20} />
            </div>
            {t('title')}
          </h1>
          <p className="text-[var(--tulip-forest)]/60 text-sm mt-1">
            {t('subtitle')}
          </p>
        </div>
        <button onClick={() => { fetchKeys(); fetchUsage() }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] text-sm text-[var(--tulip-forest)]/70 hover:text-[var(--tulip-forest)] hover:bg-[var(--tulip-sage)] transition-all">
          <RefreshCw size={14} /> {t('refresh')}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] w-fit">
        {(['keys', 'usage', 'docs'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab ? 'bg-[var(--tulip-gold)]/10 text-[var(--tulip-forest)]' : 'text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)]'
            }`}>
            {tab === 'keys' ? t('tabKeys') : tab === 'usage' ? t('tabUsage') : t('tabDocs')}
          </button>
        ))}
      </div>

      {error ? (
        <div className="p-3 rounded-xl bg-red-400/10 border border-red-400/20 text-red-400 text-sm flex items-center gap-2">
          <XCircle size={16} /> {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400/60 hover:text-red-400">
            <XCircle size={14} />
          </button>
        </div>
      ) : null}

      {/* Newly created key banner */}
      {newlyCreatedKey ? (
        <div className="p-4 rounded-xl bg-green-400/10 border border-green-400/20">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={16} className="text-green-400" />
            <span className="text-sm font-semibold text-green-400">{t('apiKeyCreated')}</span>
          </div>
          <p className="text-xs text-[var(--tulip-forest)]/60 mb-2">{t('copyKeyWarning')}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-3 rounded-lg bg-black/30 border border-[var(--tulip-sage-dark)] text-sm font-mono text-[var(--tulip-forest)] break-all select-all">
              {newlyCreatedKey}
            </code>
            <button onClick={() => handleCopy(newlyCreatedKey)}
              className="shrink-0 p-3 rounded-lg bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] hover:bg-[var(--tulip-sage)] transition-all">
              {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} className="text-[var(--tulip-forest)]/70" />}
            </button>
          </div>
          <button onClick={() => setNewlyCreatedKey(null)}
            className="mt-2 text-xs text-[var(--tulip-forest)]/40 hover:text-[var(--tulip-forest)]/70 transition-all">
            {t('dismiss')}
          </button>
        </div>
      ) : null}

      {/* API KEYS TAB */}
      {activeTab === 'keys' ? (
        <div className="space-y-4">
          {/* Create key */}
          {showCreate ? (
            <div className="p-4 rounded-xl border border-[var(--tulip-gold)]/30 bg-[var(--tulip-gold)]/5">
              <h3 className="text-sm font-semibold text-[var(--tulip-forest)] mb-3">{t('createNewApiKey')}</h3>
              <div className="flex gap-3">
                <input
                  type="text" value={newKeyName} onChange={e => setNewKeyName(e.target.value)}
                  placeholder={t('keyNamePlaceholder')}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none focus:border-[var(--tulip-gold)]"
                  onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
                />
                <button onClick={handleCreate} disabled={creating || !newKeyName.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--tulip-forest)] transition-all hover:opacity-90 disabled:opacity-40 bg-[var(--tulip-gold)] hover:bg-[var(--tulip-orange)]">
                  {creating ? <Loader2 size={14} className="animate-spin" /> : t('create')}
                </button>
                <button onClick={() => { setShowCreate(false); setNewKeyName('') }}
                  className="px-3 py-2 rounded-lg text-sm text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)] bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)]">
                  {t('cancel')}
                </button>
              </div>
              <p className="text-xs text-[var(--tulip-forest)]/40 mt-2">
                {t('keyPermissionsNote')}
              </p>
            </div>
          ) : (
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-[var(--tulip-forest)] transition-all hover:opacity-90 bg-[var(--tulip-gold)] hover:bg-[var(--tulip-orange)]">
              <Plus size={16} /> {t('createApiKey')}
            </button>
          )}

          {/* Loading */}
          {loading ? (
            <div className="text-center py-8 text-[var(--tulip-forest)]/40">
              <Loader2 size={20} className="animate-spin mx-auto mb-2" /> {t('loading')}
            </div>
          ) : null}

          {/* Active keys */}
          {!loading && activeKeys.length === 0 && !newlyCreatedKey ? (
            <div className="text-center py-12 text-[var(--tulip-forest)]/40 text-sm rounded-2xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)]">
              <Key size={32} className="mx-auto mb-3 opacity-30" />
              <p>{t('noKeysYet')}</p>
            </div>
          ) : null}

          {activeKeys.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-[var(--tulip-forest)]/60 uppercase tracking-wider">{t('activeKeysCount', { count: activeKeys.length })}</h3>
              {activeKeys.map(k => (
                <div key={k.id} className="flex items-center gap-4 p-4 rounded-xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)]">
                  <div className="w-9 h-9 rounded-lg bg-green-400/10 flex items-center justify-center shrink-0">
                    <Key size={16} className="text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--tulip-forest)]">{k.name}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-[var(--tulip-forest)]/40">
                      <code className="font-mono">{k.prefix}...{'•'.repeat(16)}</code>
                      <span>{t('created', { date: new Date(k.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) })}</span>
                      {k.lastUsedAt ? (
                        <span>{t('lastUsed', { date: new Date(k.lastUsedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) })}</span>
                      ) : (
                        <span className="text-yellow-400/50">{t('neverUsed')}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {k.permissions.map(p => (
                      <span key={p} className="px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--tulip-sage)] text-[var(--tulip-forest)]/40 border border-[var(--tulip-sage-dark)]">
                        {p}
                      </span>
                    ))}
                  </div>
                  <button onClick={() => handleRevoke(k.id)}
                    className="p-2 rounded-lg text-[var(--tulip-forest)]/30 hover:text-red-400 hover:bg-red-400/10 transition-all shrink-0"
                    title={t('revokeKey')}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {/* Revoked keys */}
          {revokedKeys.length > 0 ? (
            <details className="mt-4">
              <summary className="text-xs font-semibold text-[var(--tulip-forest)]/30 uppercase tracking-wider cursor-pointer hover:text-[var(--tulip-forest)]/60 transition-all">
                {t('revokedKeysCount', { count: revokedKeys.length })}
              </summary>
              <div className="mt-2 space-y-2">
                {revokedKeys.map(k => (
                  <div key={k.id} className="flex items-center gap-4 p-3 rounded-xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] opacity-50">
                    <Key size={14} className="text-red-400/50 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--tulip-forest)]/60 line-through">{k.name}</p>
                      <p className="text-xs text-[var(--tulip-forest)]/30 font-mono">{k.prefix}...</p>
                    </div>
                    <span className="text-[10px] text-red-400/50">{t('revokedDate', { date: new Date(k.revokedAt!).toLocaleDateString('en-GB') })}</span>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      ) : null}

      {/* USAGE TAB */}
      {activeTab === 'usage' ? (
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label={t('today')} value={usage?.today.total ?? 0}
              sub={`${usage?.today.success ?? 0} ${t('okSuffix')} · ${usage?.today.errors ?? 0} ${t('errorsSuffix')}`}
              icon={BarChart3} color="bg-blue-400/10 text-blue-400" />
            <StatCard label={t('thisMonth')} value={usage?.thisMonth.total ?? 0}
              sub={`${usage?.thisMonth.success ?? 0} ${t('okSuffix')} · ${usage?.thisMonth.errors ?? 0} ${t('errorsSuffix')}`}
              icon={BarChart3} color="bg-purple-400/10 text-purple-400" />
            <StatCard label={t('successRate')} value={`${usage?.successRate ?? 100}%`}
              sub={t('thisMonthSub')}
              icon={CheckCircle2} color="bg-green-400/10 text-green-400" />
            <StatCard label={t('avgResponse')} value={`${usage?.avgResponseTime ?? 0}ms`}
              sub={t('thisMonthSub')}
              icon={Clock} color="bg-yellow-400/10 text-yellow-400" />
          </div>

          {/* By endpoint */}
          {usage?.byEndpoint && usage.byEndpoint.length > 0 ? (
            <div className="p-5 rounded-2xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)]">
              <h3 className="text-sm font-semibold text-[var(--tulip-forest)]/70 uppercase tracking-wider mb-3">{t('byEndpoint')}</h3>
              <div className="space-y-2">
                {usage.byEndpoint.map((ep, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)]">
                    <code className="text-xs text-[var(--tulip-forest)]/60 font-mono flex-1 truncate">{ep.endpoint}</code>
                    <span className="text-xs text-[var(--tulip-forest)] font-semibold">{ep.total}</span>
                    <span className="text-[10px] text-green-400/60">{ep.success} {t('okSuffix')}</span>
                    {ep.errors > 0 ? <span className="text-[10px] text-red-400/60">{ep.errors} err</span> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* By key */}
          {usage?.byKey && usage.byKey.length > 0 ? (
            <div className="p-5 rounded-2xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)]">
              <h3 className="text-sm font-semibold text-[var(--tulip-forest)]/70 uppercase tracking-wider mb-3">{t('byApiKey')}</h3>
              <div className="space-y-2">
                {usage.byKey.map((k, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)]">
                    <Key size={12} className="text-[var(--tulip-forest)]/30 shrink-0" />
                    <span className="text-sm text-[var(--tulip-forest)] flex-1">{k.name}</span>
                    <code className="text-[10px] text-[var(--tulip-forest)]/40 font-mono">{k.prefix}...</code>
                    <span className="text-xs text-[var(--tulip-forest)] font-semibold">{t('callsCount', { count: k.total })}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Recent calls */}
          {usage?.recentCalls && usage.recentCalls.length > 0 ? (
            <div className="p-5 rounded-2xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)]">
              <h3 className="text-sm font-semibold text-[var(--tulip-forest)]/70 uppercase tracking-wider mb-3">{t('recentApiCalls')}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[var(--tulip-forest)]/40 border-b border-[var(--tulip-sage-dark)]">
                      <th className="text-left py-2 pr-3 font-medium">{t('tableTime')}</th>
                      <th className="text-left py-2 pr-3 font-medium">{t('tableEndpoint')}</th>
                      <th className="text-left py-2 pr-3 font-medium">{t('tableKey')}</th>
                      <th className="text-left py-2 pr-3 font-medium">{t('tableStatus')}</th>
                      <th className="text-right py-2 font-medium">{t('tableResponse')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.recentCalls.map(call => (
                      <tr key={call.id} className="border-b border-[var(--tulip-sage-dark)] hover:bg-[var(--tulip-sage)]">
                        <td className="py-2 pr-3 text-[var(--tulip-forest)]/60">
                          {new Date(call.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className="py-2 pr-3">
                          <code className="text-[var(--tulip-forest)]/60 font-mono">{call.method} {call.endpoint}</code>
                        </td>
                        <td className="py-2 pr-3 text-[var(--tulip-forest)]/40">{call.keyName}</td>
                        <td className="py-2 pr-3">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            call.statusCode < 400
                              ? 'bg-green-400/10 text-green-400'
                              : 'bg-red-400/10 text-red-400'
                          }`}>
                            {call.statusCode}
                          </span>
                        </td>
                        <td className="py-2 text-right text-[var(--tulip-forest)]/60">{call.responseTime}ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {!usage || (usage.thisMonth.total === 0 && usage.today.total === 0) ? (
            <div className="text-center py-12 text-[var(--tulip-forest)]/40 text-sm rounded-2xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)]">
              <BarChart3 size={32} className="mx-auto mb-3 opacity-30" />
              <p>{t('noUsageYet')}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* DOCS TAB */}
      {activeTab === 'docs' ? (
        <div className="space-y-6">
          {/* Intro */}
          <div className="p-5 rounded-2xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)]">
            <h3 className="font-semibold text-[var(--tulip-forest)] mb-2">{t('gettingStarted')}</h3>
            <ol className="text-sm text-[var(--tulip-forest)]/70 space-y-1.5 list-decimal list-inside">
              <li>{t('step1CreateKey')} <button onClick={() => setActiveTab('keys')} className="text-[var(--tulip-forest)] hover:underline">{t('step1Link')}</button> {t('step1Suffix')}</li>
              <li>{t('step2')}</li>
              <li>{t('step3')}</li>
              <li>{t('step4')}</li>
            </ol>
          </div>

          {/* Base URL */}
          <div className="p-4 rounded-xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)]">
            <span className="text-xs text-[var(--tulip-forest)]/60 uppercase tracking-wider">{t('baseUrl')}</span>
            <div className="flex items-center gap-2 mt-1">
              <code className="text-sm font-mono text-[var(--tulip-forest)]">{apiUrl}</code>
              <button onClick={() => handleCopy(apiUrl)} className="p-1 rounded hover:bg-[var(--tulip-sage)]/50 transition-all">
                <Copy size={12} className="text-[var(--tulip-forest)]/40" />
              </button>
            </div>
          </div>

          {/* Endpoint selector */}
          <div className="flex gap-1 p-1 rounded-xl bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] w-fit">
            <button onClick={() => setDocsSection('ocr')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                docsSection === 'ocr' ? 'bg-[var(--tulip-gold)]/10 text-[var(--tulip-forest)]' : 'text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)]'
              }`}>
              {t('ocrProcess')}
            </button>
            <button onClick={() => setDocsSection('bundle')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                docsSection === 'bundle' ? 'bg-[var(--tulip-gold)]/10 text-[var(--tulip-forest)]' : 'text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)]'
              }`}>
              {t('bundleVerify')}
            </button>
          </div>

          {/* Endpoint info */}
          <div className="p-5 rounded-2xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)]">
            {docsSection === 'ocr' ? (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-400/10 text-green-400 border border-green-400/20">POST</span>
                  <code className="text-sm font-mono text-[var(--tulip-forest)]">/api/external/ocr/process</code>
                </div>
                <p className="text-sm text-[var(--tulip-forest)]/60 mb-4">
                  {t('ocrEndpointDesc')}
                  {' '}{t('ocrPollNote', { endpoint: 'GET /api/external/ocr/jobs/:id' })}
                </p>
                <div className="text-xs space-y-1 mb-4 text-[var(--tulip-forest)]/60">
                  <p><strong className="text-[var(--tulip-forest)]/70">{t('contentType')}</strong> multipart/form-data</p>
                  <p><strong className="text-[var(--tulip-forest)]/70">{t('fieldLabel')}</strong> <code className="font-mono">{t('ocrFieldFileDesc')}</code></p>
                  <p><strong className="text-[var(--tulip-forest)]/70">{t('requiredPermission')}</strong> documents:write</p>
                </div>
                <div className="space-y-2 text-xs text-[var(--tulip-forest)]/60">
                  <p><strong className="text-[var(--tulip-forest)]/70">{t('response201')}</strong></p>
                  <pre className="p-3 rounded-lg bg-black/30 border border-[var(--tulip-sage-dark)] font-mono text-[var(--tulip-forest)]/60 overflow-x-auto">
{`{
  "data": { "id": "uuid", "status": "processing" },
  "message": "OCR job created. Poll GET /api/external/ocr/jobs/:id for status."
}`}
                  </pre>
                  <p className="mt-2"><strong className="text-[var(--tulip-forest)]/70">{t('completedJobFields')}</strong> {t('completedJobFieldsList')}</p>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-400/10 text-green-400 border border-green-400/20">POST</span>
                  <code className="text-sm font-mono text-[var(--tulip-forest)]">/api/external/ocr/bundle</code>
                </div>
                <p className="text-sm text-[var(--tulip-forest)]/60 mb-4">
                  {t('bundleEndpointDesc')}
                  {' '}{t('bundlePollNote', { endpoint: 'GET /api/external/ocr/bundles/:id' })}
                </p>
                <div className="text-xs space-y-1 mb-4 text-[var(--tulip-forest)]/60">
                  <p><strong className="text-[var(--tulip-forest)]/70">{t('contentType')}</strong> multipart/form-data</p>
                  <p><strong className="text-[var(--tulip-forest)]/70">{t('fieldLabel')}</strong> <code className="font-mono">{t('bundleFieldFilesDesc')}</code></p>
                  <p><strong className="text-[var(--tulip-forest)]/70">{t('fieldLabel')}</strong> <code className="font-mono">{t('bundleFieldNameDesc')}</code></p>
                  <p><strong className="text-[var(--tulip-forest)]/70">{t('requiredPermission')}</strong> documents:write</p>
                </div>
                <div className="space-y-2 text-xs text-[var(--tulip-forest)]/60">
                  <p><strong className="text-[var(--tulip-forest)]/70">{t('response201')}</strong></p>
                  <pre className="p-3 rounded-lg bg-black/30 border border-[var(--tulip-sage-dark)] font-mono text-[var(--tulip-forest)]/60 overflow-x-auto">
{`{
  "data": { "id": "uuid", "status": "processing", "fileCount": 3 },
  "message": "Bundle created. Poll GET /api/external/ocr/bundles/:id for status."
}`}
                  </pre>
                  <p className="mt-2"><strong className="text-[var(--tulip-forest)]/70">{t('completedBundleFields')}</strong> {t('completedBundleFieldsList')}</p>
                </div>
              </>
            )}
          </div>

          {/* Code examples */}
          <div className="p-5 rounded-2xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)]">
            <h3 className="text-sm font-semibold text-[var(--tulip-forest)]/70 uppercase tracking-wider mb-3">{t('codeExamples')}</h3>

            {/* Language tabs */}
            <div className="flex gap-1 mb-4 p-1 rounded-lg bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] w-fit">
              {(['curl', 'python', 'javascript'] as const).map(lang => (
                <button key={lang} onClick={() => setDocsLang(lang)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    docsLang === lang ? 'bg-[var(--tulip-sage)] text-[var(--tulip-forest)]' : 'text-[var(--tulip-forest)]/40 hover:text-[var(--tulip-forest)]/70'
                  }`}>
                  {lang === 'curl' ? 'cURL' : lang === 'python' ? 'Python' : 'JavaScript'}
                </button>
              ))}
            </div>

            {/* Code block */}
            <div className="relative">
              <pre className="p-4 rounded-xl bg-black/40 border border-[var(--tulip-sage-dark)] font-mono text-xs text-[var(--tulip-forest)]/70 overflow-x-auto whitespace-pre leading-relaxed">
                {docsSection === 'ocr'
                  ? (docsLang === 'curl' ? codes.ocrCurl : docsLang === 'python' ? codes.ocrPython : codes.ocrJs)
                  : (docsLang === 'curl' ? codes.bundleCurl : docsLang === 'python' ? codes.bundlePython : codes.bundleJs)
                }
              </pre>
              <button
                onClick={() => handleCopy(
                  docsSection === 'ocr'
                    ? (docsLang === 'curl' ? codes.ocrCurl : docsLang === 'python' ? codes.ocrPython : codes.ocrJs)
                    : (docsLang === 'curl' ? codes.bundleCurl : docsLang === 'python' ? codes.bundlePython : codes.bundleJs)
                )}
                className="absolute top-3 right-3 p-2 rounded-lg bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] hover:bg-[var(--tulip-sage)] transition-all"
                title="Copy to clipboard">
                {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} className="text-[var(--tulip-forest)]/60" />}
              </button>
            </div>
          </div>

          {/* Auth info */}
          <div className="p-5 rounded-2xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)]">
            <h3 className="text-sm font-semibold text-[var(--tulip-forest)]/70 uppercase tracking-wider mb-3">{t('authentication')}</h3>
            <div className="text-sm text-[var(--tulip-forest)]/60 space-y-2">
              <p>{t('authDescription')}</p>
              <pre className="p-3 rounded-lg bg-black/30 border border-[var(--tulip-sage-dark)] font-mono text-xs text-[var(--tulip-forest)]/60">
Authorization: Bearer tl_live_your_api_key_here
              </pre>
              <p className="text-xs text-[var(--tulip-forest)]/40 mt-3">{t('authNote')}</p>
            </div>
          </div>

          {/* Rate limits */}
          <div className="p-5 rounded-2xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)]">
            <h3 className="text-sm font-semibold text-[var(--tulip-forest)]/70 uppercase tracking-wider mb-3">{t('rateLimits')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="p-3 rounded-lg bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)]">
                <p className="text-[var(--tulip-forest)]/60 text-xs">{t('perIp')}</p>
                <p className="text-[var(--tulip-forest)] font-semibold">{t('perIpValue')}</p>
              </div>
              <div className="p-3 rounded-lg bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)]">
                <p className="text-[var(--tulip-forest)]/60 text-xs">{t('perTenant')}</p>
                <p className="text-[var(--tulip-forest)] font-semibold">{t('perTenantValue')}</p>
              </div>
              <div className="p-3 rounded-lg bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)]">
                <p className="text-[var(--tulip-forest)]/60 text-xs">{t('fileSize')}</p>
                <p className="text-[var(--tulip-forest)] font-semibold">{t('fileSizeValue')}</p>
              </div>
            </div>
          </div>

          {/* Error codes */}
          <div className="p-5 rounded-2xl border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)]">
            <h3 className="text-sm font-semibold text-[var(--tulip-forest)]/70 uppercase tracking-wider mb-3">{t('errorCodes')}</h3>
            <div className="space-y-1.5 text-xs">
              {[
                ['401', t('errUnauthorized'), t('err401Desc')],
                ['403', t('errForbidden'), t('err403Desc')],
                ['400', t('errBadRequest'), t('err400Desc')],
                ['404', t('errNotFound'), t('err404Desc')],
                ['429', t('errRateLimited'), t('err429Desc')],
                ['500', t('errServerError'), t('err500Desc')],
              ].map(([code, label, desc]) => (
                <div key={code} className="flex items-center gap-3 p-2 rounded-lg bg-[var(--tulip-sage)]">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    code === '401' || code === '403' ? 'bg-yellow-400/10 text-yellow-400' :
                    code === '429' || code === '500' ? 'bg-red-400/10 text-red-400' : 'bg-[var(--tulip-sage)] text-[var(--tulip-forest)]/60'
                  }`}>{code}</span>
                  <span className="text-[var(--tulip-forest)]/70 font-medium w-24">{label}</span>
                  <span className="text-[var(--tulip-forest)]/40">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
