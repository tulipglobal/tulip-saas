'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { apiGet } from '@/lib/api'
import { formatMoney } from '@/lib/currencies'
import {
  Shield, FileText, Banknote, Receipt, Download,
  BarChart3, Activity, Users as UsersIcon
} from 'lucide-react'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, Area, AreaChart
} from 'recharts'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface AnalyticsData {
  documentsOverTime: { date: string; count: number }[]
  blockchainVerifications: { date: string; count: number }[]
  fundingVsSpent: { month: string; received: number; spent: number }[]
  expensesByCategory: { category: string; amount: number }[]
  donorEngagement: { date: string; logins: number; views: number }[]
  totals: {
    totalDocuments: number
    totalVerified: number
    totalFundingReceived: number
    totalFundingSpent: number
    totalExpenses: number
    totalDonorLogins: number
  }
}

interface ReportProject {
  id: string; name: string; status: string; budget: number | null; currency?: string
  _count?: { expenses: number; documents: number }
}
interface ReportAgreement {
  id: string; title: string; type: string; totalAmount: number; currency: string; status: string
  donor: { name: string } | null; spent: number
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DONUT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16']
const RANGES = [
  { key: 'range30d', value: 30 },
  { key: 'range90d', value: 90 },
  { key: 'range12m', value: 365 },
]

/* ------------------------------------------------------------------ */
/*  Tooltip styling (light theme)                                      */
/* ------------------------------------------------------------------ */

const tooltipStyle = {
  contentStyle: {
    background: 'var(--tulip-sage)',
    border: '1px solid var(--tulip-sage-dark)',
    borderRadius: 8,
    fontSize: 12,
    color: 'var(--tulip-forest)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  labelStyle: { color: 'var(--tulip-forest)' },
}

function formatYAxis(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}K`
  return String(value)
}

function formatShortDate(value: string | number) {
  const d = new Date(String(value))
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tooltipLabelFormatter(label: any) {
  return formatShortDate(String(label))
}

/* ------------------------------------------------------------------ */
/*  Chart card wrapper                                                 */
/* ------------------------------------------------------------------ */

function ChartCard({ title, subtitle, children, fullWidth = false }: {
  title: string; subtitle: string; children: React.ReactNode; fullWidth?: boolean
}) {
  return (
    <div className={`rounded-xl border border-[var(--tulip-sage-dark)] p-5 ${fullWidth ? 'col-span-1 md:col-span-2' : ''}`}
      style={{ background: 'var(--tulip-sage)' }}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-[var(--tulip-forest)]" style={{ fontFamily: 'Inter, sans-serif' }}>{title}</h3>
        <p className="text-xs text-[var(--tulip-forest)]/40 mt-0.5">{subtitle}</p>
      </div>
      {children}
    </div>
  )
}

/* ─── Impact Report PDF Generator ────────────────────────── */
async function generateImpactReport() {
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
  const totalFunding = agreements.reduce((s: number, a: ReportAgreement) => s + a.totalAmount, 0)
  const totalSpent = agreements.reduce((s: number, a: ReportAgreement) => s + (a.spent || 0), 0)
  const totalBudget = projects.reduce((s: number, p: ReportProject) => s + (p.budget || 0), 0)

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

  const sectionHeader = (title: string, y: number): number => {
    doc.setFillColor(...BLUE)
    doc.rect(20, y, 3, 8, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...DARK)
    doc.text(title, 27, y + 6.5)
    return y + 14
  }

  const tableHeader = (cols: { label: string; x: number }[], y: number): number => {
    doc.setFillColor(241, 245, 249)
    doc.rect(20, y, W - 40, 7, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...GREY)
    for (const col of cols) doc.text(col.label.toUpperCase(), col.x, y + 5)
    return y + 10
  }

  // Cover page
  doc.setFillColor(...BLUE)
  doc.rect(0, 0, W, 6, 'F')
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
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(36)
  doc.setTextColor(...DARK)
  doc.text('Impact Report', 20, 95)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(16)
  doc.setTextColor(...GREY)
  doc.text(orgName, 20, 110)
  doc.setFontSize(12)
  doc.text(dateStr, 20, 122)
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.5)
  doc.line(20, 135, W - 20, 135)

  const stats = [
    { label: 'Projects', value: projects.length.toString() },
    { label: 'Documents Verified', value: docsTotal.toString() },
    { label: 'Expenses Tracked', value: expensesTotal.toString() },
    { label: 'Audit Records', value: auditTotal.toString() },
    { label: 'Total Funding', value: formatMoney(totalFunding, 'USD') },
    { label: 'Total Spent', value: formatMoney(totalSpent, 'USD') },
  ]
  let sy = 150
  for (let i = 0; i < stats.length; i += 2) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(...BLUE)
    doc.text(stats[i].value, 20, sy)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GREY)
    doc.text(stats[i].label, 20, sy + 7)
    if (stats[i + 1]) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(...BLUE)
      doc.text(stats[i + 1].value, W / 2 + 5, sy)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GREY)
      doc.text(stats[i + 1].label, W / 2 + 5, sy + 7)
    }
    sy += 22
  }
  doc.setFillColor(...BLUE); doc.rect(0, H - 6, W, 6, 'F')
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...LIGHT_GREY)
  doc.text('tulipds.com  \u00b7  Bright Bytes Technology  \u00b7  Dubai, UAE', W / 2, H - 12, { align: 'center' })

  const totalPages = 4

  // Projects page
  doc.addPage(); let y = 20; y = sectionHeader('Projects', y)
  if (projects.length === 0) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...GREY)
    doc.text('No projects found.', 20, y + 5)
  } else {
    y = tableHeader([{ label: 'Project', x: 22 }, { label: 'Status', x: 90 }, { label: 'Budget', x: 115 }, { label: 'Expenses', x: 145 }, { label: 'Docs', x: 170 }], y)
    for (const p of projects) {
      if (y > H - 35) { addFooter(2, totalPages); doc.addPage(); y = 20 }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...DARK)
      doc.text(p.name.length > 35 ? p.name.slice(0, 35) + '...' : p.name, 22, y)
      doc.setTextColor(...GREY)
      doc.text(p.status, 90, y); doc.text(p.budget ? formatMoney(p.budget, 'USD') : '—', 115, y)
      doc.text(String(p._count?.expenses ?? 0), 145, y); doc.text(String(p._count?.documents ?? 0), 170, y)
      y += 7
    }
    y += 5; doc.setDrawColor(226, 232, 240); doc.line(20, y, W - 20, y); y += 8
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...DARK)
    doc.text(`Total Project Budget: ${formatMoney(totalBudget, 'USD')}`, 22, y)
    doc.text(`${projects.length} projects`, W - 22, y, { align: 'right' })
  }
  addFooter(2, totalPages)

  // Funding page
  doc.addPage(); y = 20; y = sectionHeader('Funding Agreements', y)
  if (agreements.length === 0) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...GREY)
    doc.text('No funding agreements found.', 20, y + 5)
  } else {
    y = tableHeader([{ label: 'Agreement', x: 22 }, { label: 'Donor', x: 80 }, { label: 'Type', x: 115 }, { label: 'Amount', x: 135 }, { label: 'Spent', x: 163 }], y)
    for (const a of agreements) {
      if (y > H - 35) { addFooter(3, totalPages); doc.addPage(); y = 20 }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...DARK)
      doc.text(a.title.length > 28 ? a.title.slice(0, 28) + '...' : a.title, 22, y)
      doc.setTextColor(...GREY)
      doc.text(a.donor?.name ? (a.donor.name.length > 15 ? a.donor.name.slice(0, 15) + '...' : a.donor.name) : '—', 80, y)
      doc.text(a.type, 115, y); doc.text(`${a.currency} ${a.totalAmount.toLocaleString()}`, 135, y)
      doc.text(`${a.currency} ${(a.spent || 0).toLocaleString()}`, 163, y); y += 7
    }
    y += 5; doc.setDrawColor(226, 232, 240); doc.line(20, y, W - 20, y); y += 8
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...DARK)
    doc.text(`Total Funding: ${formatMoney(totalFunding, 'USD')}`, 22, y)
    const utilPct = totalFunding > 0 ? Math.round((totalSpent / totalFunding) * 100) : 0
    doc.text(`Utilisation: ${utilPct}%`, W - 22, y, { align: 'right' })
  }
  addFooter(3, totalPages)

  // Blockchain page
  doc.addPage(); y = 20; y = sectionHeader('Blockchain Integrity', y)
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
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...GREY)
    doc.text(label.toUpperCase(), 22, y)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(...DARK)
    doc.text(value, 22, y + 6); y += 15
  }
  y += 5; doc.setDrawColor(226, 232, 240); doc.line(20, y, W - 20, y); y += 10
  doc.setFillColor(236, 253, 245); doc.roundedRect(20, y, W - 40, 24, 3, 3, 'F')
  doc.setDrawColor(16, 185, 129); doc.setLineWidth(0.4); doc.roundedRect(20, y, W - 40, 24, 3, 3, 'S')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(5, 150, 105)
  doc.text('All records are independently verifiable', 28, y + 9)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(71, 85, 105)
  doc.text('Every audit log entry is SHA-256 hashed, Merkle-tree batched, and anchored to the Polygon blockchain.', 28, y + 17)
  addFooter(4, totalPages)

  doc.save(`tulipds-impact-report-${now.toISOString().slice(0, 10)}.pdf`)
}

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  I&E Statement Types                                                */
/* ------------------------------------------------------------------ */

interface IEData {
  period: { from: string | null; to: string | null }
  income: {
    bySource: { sourceType: string; items: { id: string; title: string; totalAmount: number; currency: string }[]; total: number }[]
    total: number
  }
  expenditure: {
    capex: { byCategory: { category: string; total: number }[]; total: number }
    opex: { byCategory: { category: string; total: number }[]; total: number }
    other: { total: number }
    total: number
  }
  netBalance: number
}

/* ------------------------------------------------------------------ */
/*  I&E Statement Component                                            */
/* ------------------------------------------------------------------ */

function IEStatement() {
  const t = useTranslations()
  const [data, setData] = useState<IEData | null>(null)
  const [loading, setLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [exporting, setExporting] = useState(false)

  const loadData = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (dateFrom) params.set('from', dateFrom)
    if (dateTo) params.set('to', dateTo)
    apiGet(`/api/analytics/income-expenditure?${params}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  const handleFilter = () => { loadData() }

  const exportPDF = async () => {
    if (!data) return
    setExporting(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W = 210
      const BLUE = [12, 122, 237] as const
      const DARK = [30, 41, 59] as const
      const GREY = [100, 116, 139] as const
      const now = new Date()
      const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })

      // Header
      doc.setFillColor(...BLUE)
      doc.rect(0, 0, W, 6, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(22)
      doc.setTextColor(...DARK)
      doc.text('Income & Expenditure Statement', 20, 30)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(...GREY)
      const periodStr = dateFrom || dateTo ? `${dateFrom || 'Start'} to ${dateTo || 'Present'}` : 'All Time'
      doc.text(`Period: ${periodStr}  |  Generated: ${dateStr}`, 20, 40)

      let y = 55

      // Income section
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.setTextColor(...DARK)
      doc.text('INCOME', 20, y); y += 8

      for (const source of data.income.bySource) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.setTextColor(...BLUE)
        doc.text(source.sourceType, 25, y)
        doc.setTextColor(...DARK)
        doc.text(formatMoney(source.total, 'USD'), W - 20, y, { align: 'right' })
        y += 6
        for (const item of source.items) {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(9)
          doc.setTextColor(...GREY)
          doc.text(item.title, 30, y)
          doc.text(formatMoney(item.totalAmount, 'USD'), W - 25, y, { align: 'right' })
          y += 5
        }
        y += 2
      }

      doc.setDrawColor(226, 232, 240); doc.line(20, y, W - 20, y); y += 6
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(...DARK)
      doc.text('Total Income', 25, y)
      doc.text(formatMoney(data.income.total, 'USD'), W - 20, y, { align: 'right' }); y += 12

      // Expenditure section
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text('EXPENDITURE', 20, y); y += 8

      // CapEx
      if (data.expenditure.capex.total > 0) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.setTextColor(139, 92, 246)
        doc.text('Capital Expenditure (CapEx)', 25, y)
        doc.setTextColor(...DARK)
        doc.text(formatMoney(data.expenditure.capex.total, 'USD'), W - 20, y, { align: 'right' }); y += 6
        for (const cat of data.expenditure.capex.byCategory) {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GREY)
          doc.text(cat.category, 30, y)
          doc.text(formatMoney(cat.total, 'USD'), W - 25, y, { align: 'right' }); y += 5
        }
        y += 3
      }

      // OpEx
      if (data.expenditure.opex.total > 0) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.setTextColor(6, 182, 212)
        doc.text('Operating Expenditure (OpEx)', 25, y)
        doc.setTextColor(...DARK)
        doc.text(formatMoney(data.expenditure.opex.total, 'USD'), W - 20, y, { align: 'right' }); y += 6
        for (const cat of data.expenditure.opex.byCategory) {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GREY)
          doc.text(cat.category, 30, y)
          doc.text(formatMoney(cat.total, 'USD'), W - 25, y, { align: 'right' }); y += 5
        }
        y += 3
      }

      doc.setDrawColor(226, 232, 240); doc.line(20, y, W - 20, y); y += 6
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(...DARK)
      doc.text('Total Expenditure', 25, y)
      doc.text(formatMoney(data.expenditure.total, 'USD'), W - 20, y, { align: 'right' }); y += 12

      // Net Balance
      doc.setFillColor(240, 249, 255)
      doc.roundedRect(20, y, W - 40, 16, 3, 3, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      const balColor = data.netBalance >= 0 ? [5, 150, 105] as const : [239, 68, 68] as const
      doc.setTextColor(balColor[0], balColor[1], balColor[2])
      doc.text('NET BALANCE', 28, y + 10)
      doc.text(formatMoney(data.netBalance, 'USD'), W - 28, y + 10, { align: 'right' })

      doc.save(`ie-statement-${now.toISOString().slice(0, 10)}.pdf`)
    } catch (e) { console.error('PDF export failed:', e) }
    finally { setExporting(false) }
  }

  const inputCls = "bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-3 py-2 text-sm text-[var(--tulip-forest)] outline-none focus:border-[var(--tulip-gold)] transition-all"

  return (
    <div className="space-y-6">
      {/* Date range picker */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-[var(--tulip-forest)]/40 mb-1">{t('analytics.from')}</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs text-[var(--tulip-forest)]/40 mb-1">{t('analytics.to')}</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputCls} />
        </div>
        <button onClick={handleFilter}
          className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--tulip-forest)] bg-[var(--tulip-gold)] hover:bg-[var(--tulip-orange)]">
          {t('analytics.apply')}
        </button>
        <button onClick={exportPDF} disabled={exporting || !data}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[var(--tulip-forest)]/70 border border-[var(--tulip-sage-dark)] hover:border-[var(--tulip-sage-dark)] disabled:opacity-40 transition-all">
          <Download size={14} /> {exporting ? t('analytics.exporting') : t('analytics.exportPdf')}
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-[var(--tulip-forest)]/40 text-sm">{t('analytics.loading')}</div>
      ) : !data ? (
        <div className="py-16 text-center text-[var(--tulip-forest)]/40 text-sm">{t('analytics.failedToLoad')}</div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-[var(--tulip-sage-dark)] px-5 py-4" style={{ background: 'var(--tulip-sage)' }}>
              <div className="text-xs text-[var(--tulip-forest)]/60 mb-1">{t('analytics.totalIncome')}</div>
              <div className="text-xl font-bold text-emerald-400" style={{ fontFamily: 'Inter, sans-serif' }}>
                {formatMoney(data.income.total, 'USD')}
              </div>
            </div>
            <div className="rounded-xl border border-[var(--tulip-sage-dark)] px-5 py-4" style={{ background: 'var(--tulip-sage)' }}>
              <div className="text-xs text-[var(--tulip-forest)]/60 mb-1">{t('analytics.totalExpenditure')}</div>
              <div className="text-xl font-bold text-orange-400" style={{ fontFamily: 'Inter, sans-serif' }}>
                {formatMoney(data.expenditure.total, 'USD')}
              </div>
            </div>
            <div className="rounded-xl border border-[var(--tulip-sage-dark)] px-5 py-4" style={{ background: 'var(--tulip-sage)' }}>
              <div className="text-xs text-[var(--tulip-forest)]/60 mb-1">{t('analytics.netBalance')}</div>
              <div className={`text-xl font-bold ${data.netBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                style={{ fontFamily: 'Inter, sans-serif' }}>
                {formatMoney(data.netBalance, 'USD')}
              </div>
            </div>
          </div>

          {/* Income Section */}
          <div className="rounded-xl border border-[var(--tulip-sage-dark)] overflow-hidden" style={{ background: 'var(--tulip-sage)' }}>
            <div className="px-5 py-3 border-b border-[var(--tulip-sage-dark)]">
              <h3 className="text-sm font-semibold text-emerald-400" style={{ fontFamily: 'Inter, sans-serif' }}>{t('analytics.income')}</h3>
            </div>
            {data.income.bySource.length === 0 ? (
              <div className="px-5 py-8 text-center text-[var(--tulip-forest)]/30 text-sm">{t('analytics.noIncome')}</div>
            ) : (
              <div className="divide-y divide-[var(--tulip-sage-dark)]">
                {data.income.bySource.map(source => (
                  <div key={source.sourceType} className="px-5 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-[var(--tulip-forest)]">{source.sourceType}</span>
                      <span className="text-sm font-bold text-[var(--tulip-forest)]">{formatMoney(source.total, 'USD')}</span>
                    </div>
                    {source.items.map((item: { id: string; title: string; totalAmount: number }) => (
                      <div key={item.id} className="flex items-center justify-between pl-4 py-0.5">
                        <span className="text-xs text-[var(--tulip-forest)]/60">{item.title}</span>
                        <span className="text-xs text-[var(--tulip-forest)]/40">{formatMoney(item.totalAmount, 'USD')}</span>
                      </div>
                    ))}
                  </div>
                ))}
                <div className="px-5 py-3 bg-emerald-400/5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-emerald-400">{t('analytics.totalIncome')}</span>
                    <span className="text-sm font-bold text-emerald-400">{formatMoney(data.income.total, 'USD')}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Expenditure Section */}
          <div className="rounded-xl border border-[var(--tulip-sage-dark)] overflow-hidden" style={{ background: 'var(--tulip-sage)' }}>
            <div className="px-5 py-3 border-b border-[var(--tulip-sage-dark)]">
              <h3 className="text-sm font-semibold text-orange-400" style={{ fontFamily: 'Inter, sans-serif' }}>{t('analytics.expenditure')}</h3>
            </div>
            <div className="divide-y divide-[var(--tulip-sage-dark)]">
              {/* CapEx */}
              {data.expenditure.capex.total > 0 && (
                <div className="px-5 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-purple-400">{t('analytics.capex')}</span>
                    <span className="text-sm font-bold text-[var(--tulip-forest)]">{formatMoney(data.expenditure.capex.total, 'USD')}</span>
                  </div>
                  {data.expenditure.capex.byCategory.map(cat => (
                    <div key={cat.category} className="flex items-center justify-between pl-4 py-0.5">
                      <span className="text-xs text-[var(--tulip-forest)]/60">{cat.category}</span>
                      <span className="text-xs text-[var(--tulip-forest)]/40">{formatMoney(cat.total, 'USD')}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* OpEx */}
              {data.expenditure.opex.total > 0 && (
                <div className="px-5 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-cyan-400">{t('analytics.opex')}</span>
                    <span className="text-sm font-bold text-[var(--tulip-forest)]">{formatMoney(data.expenditure.opex.total, 'USD')}</span>
                  </div>
                  {data.expenditure.opex.byCategory.map(cat => (
                    <div key={cat.category} className="flex items-center justify-between pl-4 py-0.5">
                      <span className="text-xs text-[var(--tulip-forest)]/60">{cat.category}</span>
                      <span className="text-xs text-[var(--tulip-forest)]/40">{formatMoney(cat.total, 'USD')}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Other */}
              {data.expenditure.other.total > 0 && (
                <div className="px-5 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--tulip-forest)]/60">{t('analytics.otherUncategorised')}</span>
                    <span className="text-sm font-bold text-[var(--tulip-forest)]">{formatMoney(data.expenditure.other.total, 'USD')}</span>
                  </div>
                </div>
              )}

              {data.expenditure.total === 0 && (
                <div className="px-5 py-8 text-center text-[var(--tulip-forest)]/30 text-sm">{t('analytics.noExpenditure')}</div>
              )}

              <div className="px-5 py-3 bg-orange-400/5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-orange-400">{t('analytics.totalExpenditure')}</span>
                  <span className="text-sm font-bold text-orange-400">{formatMoney(data.expenditure.total, 'USD')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Net Balance */}
          <div className={`rounded-xl border px-5 py-4 ${data.netBalance >= 0 ? 'border-emerald-400/20 bg-emerald-400/5' : 'border-red-400/20 bg-red-400/5'}`}>
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-[var(--tulip-forest)]" style={{ fontFamily: 'Inter, sans-serif' }}>{t('analytics.netBalance')}</span>
              <span className={`text-xl font-bold ${data.netBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                style={{ fontFamily: 'Inter, sans-serif' }}>
                {formatMoney(data.netBalance, 'USD')}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Fraud & Risk Section                                               */
/* ------------------------------------------------------------------ */

interface FraudData {
  fraudByDay: { date: string; high: number; medium: number; low: number; blocked: number }[]
  topRiskyVendors: { vendor: string; avgScore: number; count: number }[]
  mismatchRate: number
  duplicateRate: number
  blockedCount: number
  pendingReviewCount: number
}

function FraudSection() {
  const t = useTranslations()
  const [data, setData] = useState<FraudData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet('/api/analytics/fraud')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="rounded-xl border border-[var(--tulip-sage-dark)] p-5 h-48 animate-pulse" style={{ background: 'var(--tulip-sage)' }} />
      ))}
    </div>
  )

  if (!data) return <div className="py-16 text-center text-[var(--tulip-forest)]/40 text-sm">{t('analytics.failedLoadFraud')}</div>

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { labelKey: 'blockedThisMonth', value: data.blockedCount, color: 'text-red-500', bg: 'rgba(239,68,68,0.10)' },
          { labelKey: 'pendingReview', value: data.pendingReviewCount, color: 'text-amber-500', bg: 'rgba(245,158,11,0.10)' },
          { labelKey: 'mismatchRate', value: `${data.mismatchRate}%`, color: 'text-orange-400', bg: 'rgba(249,115,22,0.10)' },
          { labelKey: 'duplicateRate', value: `${data.duplicateRate}%`, color: 'text-purple-400', bg: 'rgba(139,92,246,0.10)' },
        ].map(({ labelKey, value, color, bg }) => (
          <div key={labelKey} className="rounded-xl border border-[var(--tulip-sage-dark)] px-4 py-4" style={{ background: 'var(--tulip-sage)' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: bg }}>
                <Shield size={14} className={color} />
              </div>
              <span className="text-[var(--tulip-forest)]/40 text-xs font-medium">{t('analytics.' + labelKey)}</span>
            </div>
            <div className="text-lg font-bold text-[var(--tulip-forest)]" style={{ fontFamily: 'Inter, sans-serif' }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Fraud detections over time */}
        <ChartCard title={t('analytics.fraudDetections')} subtitle={t('analytics.last30Days')} fullWidth>
          {data.fraudByDay.every(d => d.high === 0 && d.medium === 0 && d.low === 0) ? (
            <div className="h-48 flex items-center justify-center text-[var(--tulip-forest)]/30 text-sm">{t('analytics.noFraudDetections')}</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data.fraudByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--tulip-sage-dark)" />
                <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} domain={[0, 'auto']} tickFormatter={formatYAxis} />
                <Tooltip {...tooltipStyle} labelFormatter={tooltipLabelFormatter} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#6B7280' }} />
                <Area type="monotone" dataKey="high" stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} strokeWidth={2} name={t('analytics.highCritical')} />
                <Area type="monotone" dataKey="medium" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.10} strokeWidth={2} name={t('analytics.medium')} />
                <Area type="monotone" dataKey="low" stroke="#10b981" fill="#10b981" fillOpacity={0.08} strokeWidth={1.5} name={t('analytics.low')} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Top risky vendors */}
        <ChartCard title={t('analytics.topRiskyVendors')} subtitle={t('analytics.byAvgFraudScore')}>
          {data.topRiskyVendors.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-[var(--tulip-forest)]/30 text-sm">{t('analytics.noVendorFraud')}</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.topRiskyVendors} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--tulip-sage-dark)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <YAxis type="category" dataKey="vendor" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={100}
                  tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 14) + '…' : v} />
                { /* eslint-disable-next-line @typescript-eslint/no-explicit-any */ }
                <Tooltip {...tooltipStyle} formatter={(value: any, name: any) => [value, name === 'avgScore' ? t('analytics.avgScore') : name]} />
                <Bar dataKey="avgScore" name={t('analytics.avgScore')} radius={[0, 4, 4, 0]}>
                  {data.topRiskyVendors.map((entry, i) => (
                    <Cell key={i} fill={entry.avgScore >= 51 ? '#ef4444' : entry.avgScore >= 21 ? '#f59e0b' : '#10b981'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const t = useTranslations()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState(30)
  const [generating, setGenerating] = useState(false)
  const [activeTab, setActiveTab] = useState<'charts' | 'fraud' | 'ie'>('charts')

  useEffect(() => {
    setLoading(true)
    apiGet(`/api/analytics/summary?range=${range}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [range])

  const handleGenerateReport = async () => {
    setGenerating(true)
    try { await generateImpactReport() } catch (e) { console.error('Failed to generate report:', e) }
    finally { setGenerating(false) }
  }

  const rangeLabel = range === 365 ? t('analytics.last12Months') : t('analytics.lastNDays', { range })

  const TABS = [
    { id: 'charts' as const, labelKey: 'charts' },
    { id: 'fraud' as const, labelKey: 'fraudRisk' },
    { id: 'ie' as const, labelKey: 'ieStatement' },
  ]

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-up">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--tulip-forest)]" style={{ fontFamily: 'Inter, sans-serif' }}>{t('analytics.title')}</h1>
          <p className="text-[var(--tulip-forest)]/60 text-sm mt-1">{t('analytics.chartsSubtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === 'charts' && (
            <>
              <div className="flex rounded-lg border border-[var(--tulip-sage-dark)] overflow-hidden">
                {RANGES.map(r => (
                  <button key={r.value} onClick={() => setRange(r.value)}
                    className={`px-3 py-1.5 text-xs font-medium transition-all ${
                      range === r.value
                        ? 'bg-indigo-500/20 text-indigo-400 border-indigo-400/30'
                        : 'text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)]/70 hover:bg-[var(--tulip-sage)]/50'
                    }`}>
                    {t('analytics.' + r.key)}
                  </button>
                ))}
              </div>
              <button onClick={handleGenerateReport} disabled={generating}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[var(--tulip-forest)] hover:opacity-90 transition-opacity disabled:opacity-50 bg-[var(--tulip-gold)] hover:bg-[var(--tulip-orange)]">
                {generating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Download size={14} />}
                <span className="hidden sm:inline">{generating ? t('analytics.generating') : t('analytics.impactReport')}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-[var(--tulip-sage-dark)] p-1 w-fit">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-[var(--tulip-sage)] text-[var(--tulip-forest)]'
                : 'text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)]/70'
            }`}>
            {t('analytics.' + tab.labelKey)}
          </button>
        ))}
      </div>

      {activeTab === 'ie' ? (
        <IEStatement />
      ) : activeTab === 'fraud' ? (
        <FraudSection />
      ) : (
        <>


      {/* Summary stat cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-xl border border-[var(--tulip-sage-dark)] px-5 py-4 animate-pulse" style={{ background: 'var(--tulip-sage)' }}>
              <div className="h-4 bg-[var(--tulip-sage)] rounded w-16 mb-2" />
              <div className="h-7 bg-[var(--tulip-sage)] rounded w-12" />
            </div>
          ))}
        </div>
      ) : data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { labelKey: 'totalDocuments', value: data.totals.totalDocuments, icon: FileText, color: 'text-indigo-400', bg: 'rgba(99,102,241,0.10)' },
            { labelKey: 'verified', value: data.totals.totalVerified, icon: Shield, color: 'text-emerald-400', bg: 'rgba(16,185,129,0.10)' },
            { labelKey: 'fundingReceived', value: formatMoney(data.totals.totalFundingReceived, 'USD'), icon: Banknote, color: 'text-[var(--tulip-forest)]', bg: 'rgba(59,130,246,0.10)' },
            { labelKey: 'expensesLabel', value: formatMoney(data.totals.totalExpenses, 'USD'), icon: Receipt, color: 'text-orange-400', bg: 'rgba(249,115,22,0.10)' },
          ].map(({ labelKey, value, icon: Icon, color, bg }) => (
            <div key={labelKey} className="rounded-xl border border-[var(--tulip-sage-dark)] px-4 py-4" style={{ background: 'var(--tulip-sage)' }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: bg }}>
                  <Icon size={14} className={color} />
                </div>
                <span className="text-[var(--tulip-forest)]/40 text-xs font-medium">{t('analytics.' + labelKey)}</span>
              </div>
              <div className="text-lg font-bold text-[var(--tulip-forest)]" style={{ fontFamily: 'Inter, sans-serif' }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Charts grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className={`rounded-xl border border-[var(--tulip-sage-dark)] p-5 ${i === 1 || i === 5 ? 'md:col-span-2' : ''}`}
              style={{ background: 'var(--tulip-sage)' }}>
              <div className="h-4 bg-[var(--tulip-sage)] rounded w-32 mb-2" />
              <div className="h-3 bg-[var(--tulip-sage)] rounded w-48 mb-4" />
              <div className="h-48 bg-[var(--tulip-sage)] rounded-lg animate-pulse" />
            </div>
          ))}
        </div>
      ) : data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Chart 1 — Documents Uploaded (full width) */}
          <ChartCard title={t('analytics.documentsUploaded')} subtitle={rangeLabel} fullWidth>
            {data.documentsOverTime.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-[var(--tulip-forest)]/30 text-sm">{t('analytics.noDocsUploaded')}</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.documentsOverTime}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--tulip-sage-dark)" />
                  <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} domain={[0, 'auto']} tickFormatter={formatYAxis} />
                  <Tooltip {...tooltipStyle} labelFormatter={tooltipLabelFormatter} />
                  <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={false} name="Documents" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Chart 2 — Blockchain Verifications */}
          <ChartCard title={t('analytics.blockchainVerifications')} subtitle={t('analytics.anchoredToPolygon')}>
            {data.blockchainVerifications.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-[var(--tulip-forest)]/30 text-sm">{t('analytics.noVerifications')}</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.blockchainVerifications}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--tulip-sage-dark)" />
                  <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} domain={[0, 'auto']} tickFormatter={formatYAxis} />
                  <Tooltip {...tooltipStyle} labelFormatter={tooltipLabelFormatter} />
                  <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} dot={false} name="Verified" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Chart 3 — Funding Received vs Spent */}
          <ChartCard title={t('analytics.fundingOverview')} subtitle={t('analytics.last6Months')}>
            {data.fundingVsSpent.every(m => m.received === 0 && m.spent === 0) ? (
              <div className="h-48 flex items-center justify-center text-[var(--tulip-forest)]/30 text-sm">{t('analytics.noFundingData')}</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.fundingVsSpent}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--tulip-sage-dark)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} domain={[0, 'auto']} tickFormatter={formatYAxis} />
                  <Tooltip {...tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#6B7280' }} />
                  <Bar dataKey="received" fill="#3b82f6" name={t('analytics.received')} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="spent" fill="#f97316" name={t('analytics.spent')} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Chart 4 — Expenses by Category (donut) */}
          <ChartCard title={t('analytics.expensesByProject')} subtitle={t('analytics.allTime')}>
            {data.expensesByCategory.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-[var(--tulip-forest)]/30 text-sm">{t('analytics.noExpensesRecorded')}</div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={data.expensesByCategory}
                      dataKey="amount"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {data.expensesByCategory.map((_, i) => (
                        <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip {...tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 justify-center sm:flex-col sm:gap-1.5 shrink-0">
                  {data.expensesByCategory.slice(0, 6).map((cat, i) => (
                    <div key={cat.category} className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                      <span className="text-[var(--tulip-forest)]/60">{cat.category}</span>
                      <span className="text-[var(--tulip-forest)]/40">{formatMoney(cat.amount, 'USD')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ChartCard>

          {/* Chart 5 — Donor Engagement (full width) */}
          <ChartCard title={t('analytics.donorEngagement')} subtitle={t('analytics.donorPortalActivity')} fullWidth>
            {data.donorEngagement.length === 0 ? (
              <div className="h-48 flex items-center justify-center">
                <div className="text-center">
                  <UsersIcon size={24} className="text-[var(--tulip-forest)]/30 mx-auto mb-2" />
                  <p className="text-[var(--tulip-forest)]/30 text-sm">{t('analytics.noDonorActivity')}</p>
                  <p className="text-[var(--tulip-forest)]/30 text-xs mt-1">{t('analytics.donorPortalDesc')}</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.donorEngagement}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--tulip-sage-dark)" />
                  <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} domain={[0, 'auto']} tickFormatter={formatYAxis} />
                  <Tooltip {...tooltipStyle} labelFormatter={tooltipLabelFormatter} />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#6B7280' }} />
                  <Line type="monotone" dataKey="logins" stroke="#8b5cf6" strokeWidth={2} dot={false} name={t('analytics.logins')} />
                  <Line type="monotone" dataKey="views" stroke="#06b6d4" strokeWidth={2} dot={false} name={t('analytics.docViews')} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

        </div>
      )}
        </>
      )}
    </div>
  )
}
