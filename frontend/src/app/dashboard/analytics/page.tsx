'use client'

import { useState, useEffect } from 'react'
import { apiGet } from '@/lib/api'
import { Shield, Clock, AlertTriangle, Users, Webhook, Download, FileText } from 'lucide-react'

interface Metrics {
  timestamp: string
  uptime: { seconds: number; human: string }
  memory: { heapUsed: string; heapTotal: string; rss: string }
  auditLogs: { total: number; pending: number; confirmed: number; failed: number }
  anchoring: { failedLast24h: number; alert: string }
  users: { active: number }
  webhooks: { active: number; failedDeliveries: number; alert: string }
}

interface ReportProject {
  id: string; name: string; status: string; budget: number | null; currency?: string
  _count?: { expenses: number; documents: number }
}
interface ReportAgreement {
  id: string; title: string; type: string; totalAmount: number; currency: string; status: string
  donor: { name: string } | null; spent: number
}

function StatCard({ label, value, icon: Icon, color = 'text-white' }: { label: string; value: string | number; icon: React.ElementType; color?: string }) {
  return (
    <div className="rounded-xl border border-white/8 px-5 py-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-white/5">
          <Icon size={18} className="text-white/40" />
        </div>
        <div>
          <div className={`text-xl font-bold ${color}`} style={{ fontFamily: 'Syne, sans-serif' }}>{value}</div>
          <div className="text-xs text-white/40 mt-0.5">{label}</div>
        </div>
      </div>
    </div>
  )
}

/* ─── Impact Report PDF Generator ────────────────────────── */
async function generateImpactReport() {
  // Fetch all data in parallel
  const [projectsRes, fundingRes, auditRes, docsRes, expensesRes, meRes] = await Promise.all([
    apiGet('/api/projects?limit=100'),
    apiGet('/api/funding-agreements?limit=100'),
    apiGet('/api/audit?limit=1&page=1'),
    apiGet('/api/documents?limit=1&page=1'),
    apiGet('/api/expenses?limit=1&page=1'),
    apiGet('/api/auth/me'),
  ])

  const projectsData = projectsRes.ok ? await projectsRes.json() : { data: [] }
  const fundingData = fundingRes.ok ? await fundingRes.json() : { data: [] }
  const auditData = auditRes.ok ? await auditRes.json() : { data: [], pagination: { total: 0 } }
  const docsData = docsRes.ok ? await docsRes.json() : { data: [], pagination: { total: 0 } }
  const expensesData = expensesRes.ok ? await expensesRes.json() : { data: [], pagination: { total: 0 } }
  const meData = meRes.ok ? await meRes.json() : {}

  const projects: ReportProject[] = projectsData.data ?? projectsData.items ?? []
  const agreements: ReportAgreement[] = fundingData.data ?? []
  const auditTotal = auditData.pagination?.total ?? auditData.data?.length ?? 0
  const docsTotal = docsData.pagination?.total ?? docsData.data?.length ?? 0
  const expensesTotal = expensesData.pagination?.total ?? expensesData.data?.length ?? 0

  const orgName = meData.tenantName || 'Organisation'

  const totalFunding = agreements.reduce((s, a) => s + a.totalAmount, 0)
  const totalSpent = agreements.reduce((s, a) => s + (a.spent || 0), 0)
  const totalBudget = projects.reduce((s, p) => s + (p.budget || 0), 0)

  // Find last anchored audit log
  const confirmedLogs = auditData.data?.filter((l: { anchorStatus: string }) => l.anchorStatus === 'confirmed') ?? []
  const lastAnchorDate = confirmedLogs.length > 0 ? confirmedLogs[0].createdAt : null

  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, H = 297
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })

  const BLUE = [12, 122, 237] as const
  const DARK = [30, 41, 59] as const
  const GREY = [100, 116, 139] as const
  const LIGHT_GREY = [148, 163, 184] as const

  // Helper: add footer to every page
  const addFooter = (pageNum: number, totalPages: number) => {
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.3)
    doc.line(20, H - 20, W - 20, H - 20)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...LIGHT_GREY)
    doc.text(orgName, 20, H - 14)
    doc.text(`Generated ${dateStr}`, W / 2, H - 14, { align: 'center' })
    doc.text('Powered by Tulip DS', W - 20, H - 14, { align: 'right' })
    doc.text(`Page ${pageNum} of ${totalPages}`, W / 2, H - 9, { align: 'center' })
  }

  // Helper: section header
  const sectionHeader = (title: string, y: number): number => {
    doc.setFillColor(...BLUE)
    doc.rect(20, y, 3, 8, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...DARK)
    doc.text(title, 27, y + 6.5)
    return y + 14
  }

  // Helper: table header
  const tableHeader = (cols: { label: string; x: number }[], y: number): number => {
    doc.setFillColor(241, 245, 249)
    doc.rect(20, y, W - 40, 7, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...GREY)
    for (const col of cols) doc.text(col.label.toUpperCase(), col.x, y + 5)
    return y + 10
  }

  // ── PAGE 1: Cover ────────────────────────────────────────
  // Background gradient bar
  doc.setFillColor(...BLUE)
  doc.rect(0, 0, W, 6, 'F')

  // Logo
  doc.setFillColor(...BLUE)
  doc.roundedRect(20, 40, 18, 18, 4, 4, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(255, 255, 255)
  doc.text('T', 25.5, 52)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(26)
  doc.setTextColor(...DARK)
  doc.text('TULIP DS', 44, 54)

  // Title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(36)
  doc.setTextColor(...DARK)
  doc.text('Impact Report', 20, 95)

  // Org name
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(16)
  doc.setTextColor(...GREY)
  doc.text(orgName, 20, 110)

  // Date
  doc.setFontSize(12)
  doc.text(dateStr, 20, 122)

  // Divider
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.5)
  doc.line(20, 135, W - 20, 135)

  // Summary stats on cover
  const stats = [
    { label: 'Projects', value: projects.length.toString() },
    { label: 'Documents Verified', value: docsTotal.toString() },
    { label: 'Expenses Tracked', value: expensesTotal.toString() },
    { label: 'Audit Records', value: auditTotal.toString() },
    { label: 'Total Funding', value: `$${totalFunding.toLocaleString()}` },
    { label: 'Total Spent', value: `$${totalSpent.toLocaleString()}` },
  ]
  let sy = 150
  for (let i = 0; i < stats.length; i += 2) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.setTextColor(...BLUE)
    doc.text(stats[i].value, 20, sy)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...GREY)
    doc.text(stats[i].label, 20, sy + 7)

    if (stats[i + 1]) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(22)
      doc.setTextColor(...BLUE)
      doc.text(stats[i + 1].value, W / 2 + 5, sy)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...GREY)
      doc.text(stats[i + 1].label, W / 2 + 5, sy + 7)
    }
    sy += 22
  }

  // Cover footer
  doc.setFillColor(...BLUE)
  doc.rect(0, H - 6, W, 6, 'F')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...LIGHT_GREY)
  doc.text('tulipds.com  \u00b7  Bright Bytes Technology  \u00b7  Dubai, UAE', W / 2, H - 12, { align: 'center' })

  // Count total pages for footer (cover + projects + funding + blockchain)
  const totalPages = 4

  // ── PAGE 2: Projects ─────────────────────────────────────
  doc.addPage()
  let y = 20
  y = sectionHeader('Projects', y)

  if (projects.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...GREY)
    doc.text('No projects found.', 20, y + 5)
    y += 15
  } else {
    y = tableHeader([
      { label: 'Project', x: 22 },
      { label: 'Status', x: 90 },
      { label: 'Budget', x: 115 },
      { label: 'Expenses', x: 145 },
      { label: 'Docs', x: 170 },
    ], y)

    for (const p of projects) {
      if (y > H - 35) { addFooter(2, totalPages); doc.addPage(); y = 20 }
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...DARK)
      doc.text(p.name.length > 35 ? p.name.slice(0, 35) + '...' : p.name, 22, y)
      doc.setTextColor(...GREY)
      doc.text(p.status, 90, y)
      doc.text(p.budget ? `$${p.budget.toLocaleString()}` : '—', 115, y)
      doc.text(String(p._count?.expenses ?? 0), 145, y)
      doc.text(String(p._count?.documents ?? 0), 170, y)
      y += 7
    }

    // Budget summary
    y += 5
    doc.setDrawColor(226, 232, 240)
    doc.line(20, y, W - 20, y)
    y += 8
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...DARK)
    doc.text(`Total Project Budget: $${totalBudget.toLocaleString()}`, 22, y)
    doc.text(`${projects.length} projects`, W - 22, y, { align: 'right' })
  }

  addFooter(2, totalPages)

  // ── PAGE 3: Funding ──────────────────────────────────────
  doc.addPage()
  y = 20
  y = sectionHeader('Funding Agreements', y)

  if (agreements.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...GREY)
    doc.text('No funding agreements found.', 20, y + 5)
    y += 15
  } else {
    y = tableHeader([
      { label: 'Agreement', x: 22 },
      { label: 'Donor', x: 80 },
      { label: 'Type', x: 115 },
      { label: 'Amount', x: 135 },
      { label: 'Spent', x: 163 },
    ], y)

    for (const a of agreements) {
      if (y > H - 35) { addFooter(3, totalPages); doc.addPage(); y = 20 }
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...DARK)
      doc.text(a.title.length > 28 ? a.title.slice(0, 28) + '...' : a.title, 22, y)
      doc.setTextColor(...GREY)
      doc.text(a.donor?.name ? (a.donor.name.length > 15 ? a.donor.name.slice(0, 15) + '...' : a.donor.name) : '—', 80, y)
      doc.text(a.type, 115, y)
      doc.text(`${a.currency} ${a.totalAmount.toLocaleString()}`, 135, y)
      doc.text(`${a.currency} ${(a.spent || 0).toLocaleString()}`, 163, y)
      y += 7
    }

    y += 5
    doc.setDrawColor(226, 232, 240)
    doc.line(20, y, W - 20, y)
    y += 8
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...DARK)
    doc.text(`Total Funding: $${totalFunding.toLocaleString()}`, 22, y)
    const utilPct = totalFunding > 0 ? Math.round((totalSpent / totalFunding) * 100) : 0
    doc.text(`Utilisation: ${utilPct}%`, W - 22, y, { align: 'right' })
  }

  addFooter(3, totalPages)

  // ── PAGE 4: Blockchain Integrity ─────────────────────────
  doc.addPage()
  y = 20
  y = sectionHeader('Blockchain Integrity', y)

  const integrityRows = [
    ['Total Audit Records', auditTotal.toLocaleString()],
    ['Documents Verified', docsTotal.toLocaleString()],
    ['Expenses Tracked', expensesTotal.toLocaleString()],
    ['Blockchain Network', 'Polygon (Amoy Testnet)'],
    ['Hash Algorithm', 'SHA-256'],
    ['Anchoring Method', 'Merkle Root \u2192 Polygon TX'],
    ['Timestamp Standard', 'RFC 3161 (FreeTSA)'],
    ['Last Anchor Date', lastAnchorDate ? new Date(lastAnchorDate).toLocaleString('en-GB') : '—'],
  ]

  for (const [label, value] of integrityRows) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...GREY)
    doc.text(label.toUpperCase(), 22, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(...DARK)
    doc.text(value, 22, y + 6)
    y += 15
  }

  y += 5
  doc.setDrawColor(226, 232, 240)
  doc.line(20, y, W - 20, y)
  y += 10

  // Verification note
  doc.setFillColor(236, 253, 245)
  doc.roundedRect(20, y, W - 40, 24, 3, 3, 'F')
  doc.setDrawColor(16, 185, 129)
  doc.setLineWidth(0.4)
  doc.roundedRect(20, y, W - 40, 24, 3, 3, 'S')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(5, 150, 105)
  doc.text('All records are independently verifiable', 28, y + 9)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(71, 85, 105)
  doc.text('Every audit log entry is SHA-256 hashed, Merkle-tree batched, and anchored to the Polygon blockchain.', 28, y + 17)

  addFooter(4, totalPages)

  doc.save(`tulipds-impact-report-${now.toISOString().slice(0, 10)}.pdf`)
}

/* ─── Page Component ─────────────────────────────────────── */
export default function AnalyticsPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    apiGet('/api/metrics')
      .then(r => {
        if (!r.ok) throw new Error(r.status === 403 ? 'Requires system:admin permission' : 'Failed to load metrics')
        return r.json()
      })
      .then(d => { setMetrics(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const handleGenerateReport = async () => {
    setGenerating(true)
    try {
      await generateImpactReport()
    } catch (e) {
      console.error('Failed to generate report:', e)
    } finally {
      setGenerating(false)
    }
  }

  if (loading) return (
    <div className="p-6 animate-fade-up">
      <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Analytics</h1>
      <p className="text-white/30 text-sm mt-4">Loading metrics...</p>
    </div>
  )

  if (error) return (
    <div className="p-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Analytics</h1>
          <p className="text-white/40 text-sm mt-1">System metrics and anchoring health</p>
        </div>
        <button onClick={handleGenerateReport} disabled={generating}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
          {generating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FileText size={16} />}
          {generating ? 'Generating...' : 'Impact Report'}
        </button>
      </div>
      <div className="mt-6 rounded-xl border border-red-400/20 bg-red-400/5 px-5 py-4">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    </div>
  )

  if (!metrics) return null

  const integrityPct = metrics.auditLogs.total > 0
    ? Math.round(((metrics.auditLogs.confirmed + metrics.auditLogs.pending) / metrics.auditLogs.total) * 100)
    : 100

  return (
    <div className="p-6 space-y-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Analytics</h1>
          <p className="text-white/40 text-sm mt-1">System metrics and anchoring health</p>
        </div>
        <button onClick={handleGenerateReport} disabled={generating}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
          {generating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FileText size={16} />}
          {generating ? 'Generating...' : 'Impact Report'}
        </button>
      </div>

      {/* Audit Log Stats */}
      <div>
        <h2 className="text-sm font-medium text-white/50 uppercase tracking-wide mb-3">Audit Logs</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Records" value={metrics.auditLogs.total.toLocaleString()} icon={Shield} />
          <StatCard label="Confirmed" value={metrics.auditLogs.confirmed.toLocaleString()} icon={Shield} color="text-green-400" />
          <StatCard label="Pending" value={metrics.auditLogs.pending.toLocaleString()} icon={Clock} color="text-yellow-400" />
          <StatCard label="Failed" value={metrics.auditLogs.failed.toLocaleString()} icon={AlertTriangle} color={metrics.auditLogs.failed > 0 ? 'text-red-400' : 'text-white'} />
        </div>
      </div>

      {/* Integrity + System */}
      <div>
        <h2 className="text-sm font-medium text-white/50 uppercase tracking-wide mb-3">System Health</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Integrity Score" value={`${integrityPct}%`} icon={Shield} color={integrityPct === 100 ? 'text-green-400' : 'text-yellow-400'} />
          <StatCard label="Active Users" value={metrics.users.active} icon={Users} />
          <StatCard label="Active Webhooks" value={metrics.webhooks.active} icon={Webhook} />
          <StatCard label="Failed Deliveries" value={metrics.webhooks.failedDeliveries} icon={AlertTriangle} color={metrics.webhooks.failedDeliveries > 0 ? 'text-yellow-400' : 'text-white'} />
        </div>
      </div>

      {/* Anchoring Health */}
      <div>
        <h2 className="text-sm font-medium text-white/50 uppercase tracking-wide mb-3">Anchoring</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-white/8 px-5 py-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="text-xs text-white/40 mb-1">Failures (last 24h)</div>
            <div className={`text-2xl font-bold ${metrics.anchoring.failedLast24h > 0 ? 'text-red-400' : 'text-green-400'}`}
              style={{ fontFamily: 'Syne, sans-serif' }}>
              {metrics.anchoring.failedLast24h}
            </div>
            <div className={`text-xs mt-1 ${metrics.anchoring.alert === 'ok' ? 'text-green-400/60' : 'text-red-400/60'}`}>
              {metrics.anchoring.alert}
            </div>
          </div>
          <div className="rounded-xl border border-white/8 px-5 py-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="text-xs text-white/40 mb-1">Server Uptime</div>
            <div className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
              {metrics.uptime.human}
            </div>
            <div className="text-xs text-white/30 mt-1">
              Memory: {metrics.memory.heapUsed} / {metrics.memory.heapTotal}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
