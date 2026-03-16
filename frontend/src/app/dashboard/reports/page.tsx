'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  FileText, Download, Share2, RefreshCw, Mail, Search,
  ChevronDown, ChevronUp, X, Check, Clock, Copy,
  Calendar, ArrowRight, ArrowLeft, Loader2, AlertCircle, Plus,
  Shield, Link2
} from 'lucide-react'
import { apiGet, apiPost } from '@/lib/api'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Project {
  id: string
  name: string
}

interface Report {
  id: string
  type: string
  projectName: string
  projectId: string
  periodStart: string
  periodEnd: string
  generatedAt: string
  size: number
  sealStatus: 'anchored' | 'sealing' | 'pending'
  downloadUrl?: string
  shareToken?: string
  sha256?: string
  polygonTx?: string
  anchorDate?: string
}

interface ShareLink {
  id: string
  token: string
  createdAt: string
  expiresAt: string
  views: number
}

interface SF425Data {
  projectName: string
  dateRange: string
  fundingAgreement: string
  totalAuthorized: number
  expendituresThisPeriod: number
  approvedExpenses: number
  lineItems: Record<string, number>
}

interface WBData {
  projectName: string
  components: { name: string; budget: number; spent: number }[]
  contracts: { ref: string; vendor: string; amount: number }[]
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const REPORT_TYPES = {
  standard: ['Monthly', 'Quarterly', 'Interim', 'Closing', 'Annual'],
  institutional: ['USAID SF-425', 'EU Financial', 'DFID Review', 'World Bank'],
}

const TYPE_COLORS: Record<string, string> = {
  Monthly: 'bg-blue-100 text-blue-700',
  Quarterly: 'bg-purple-100 text-purple-700',
  Annual: 'bg-green-100 text-green-700',
  Interim: 'bg-amber-100 text-amber-700',
  Closing: 'bg-red-100 text-red-700',
  'USAID SF-425': 'bg-indigo-100 text-indigo-700',
  'EU Financial': 'bg-blue-100 text-blue-700',
  'DFID Review': 'bg-teal-100 text-teal-700',
  'World Bank': 'bg-slate-100 text-slate-700',
}

const ALL_TYPES = [...REPORT_TYPES.standard, ...REPORT_TYPES.institutional]

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const QUARTERS = ['Q1 (Jan–Mar)', 'Q2 (Apr–Jun)', 'Q3 (Jul–Sep)', 'Q4 (Oct–Dec)']

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatRelative(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount)
}

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'generated' | 'scheduled' | 'templates'>('generated')
  const [projects, setProjects] = useState<Project[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  // Generate section
  const [generateOpen, setGenerateOpen] = useState(false)
  const [selectedReportType, setSelectedReportType] = useState('')
  const [genProjectId, setGenProjectId] = useState('')
  const [genMonth, setGenMonth] = useState(new Date().getMonth().toString())
  const [genYear, setGenYear] = useState(new Date().getFullYear().toString())
  const [genQuarter, setGenQuarter] = useState('0')
  const [genDateFrom, setGenDateFrom] = useState('')
  const [genDateTo, setGenDateTo] = useState('')
  const [genNotes, setGenNotes] = useState('')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')
  const [genSuccess, setGenSuccess] = useState<Report | null>(null)

  // Wizards
  const [sf425Open, setSf425Open] = useState(false)
  const [sf425Step, setSf425Step] = useState(1)
  const [sf425Data, setSf425Data] = useState<SF425Data | null>(null)
  const [sf425Org, setSf425Org] = useState({
    federalAgency: '', orgElement: '', ein: '', recipientAccount: '',
    accountingBasis: 'accrual' as 'cash' | 'accrual',
    indirectType: '', indirectRate: '', saveForFuture: true,
  })
  const [sf425Grant, setSf425Grant] = useState({
    grantNumber: '', reportType: 'Quarterly', unliquidated: '',
    programIncomeReceived: '', programIncomeExpended: '', remarks: '',
  })
  const [sf425Cert, setSf425Cert] = useState({
    fullName: '', title: '', phone: '', email: '', date: new Date().toISOString().split('T')[0],
  })
  const [sf425Result, setSf425Result] = useState<Report | null>(null)

  const [wbOpen, setWbOpen] = useState(false)
  const [wbStep, setWbStep] = useState(1)
  const [wbData, setWbData] = useState<WBData | null>(null)
  const [wbOrg, setWbOrg] = useState({
    orgName: '', bankName: '', bankAccount: '', swiftCode: '', saveForFuture: true,
  })
  const [wbFinancials, setWbFinancials] = useState({
    openingBalance: '', wbFunds: '', govFunds: '', otherFunds: '', closingBalance: '',
  })
  const [wbCert, setWbCert] = useState({
    fullName: '', title: '', phone: '', email: '', date: new Date().toISOString().split('T')[0],
  })
  const [wbResult, setWbResult] = useState<Report | null>(null)

  // Share modal
  const [shareReport, setShareReport] = useState<Report | null>(null)
  const [shareExpiry, setShareExpiry] = useState('30')
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([])
  const [shareCopied, setShareCopied] = useState(false)
  const [shareGenerating, setShareGenerating] = useState(false)

  // Scheduled tab
  const [schedules, setSchedules] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {}
    try { return JSON.parse(localStorage.getItem('tulip_report_schedules') || '{}') } catch { return {} }
  })

  /* ---------------------------------------------------------------- */
  /*  Data fetching                                                    */
  /* ---------------------------------------------------------------- */

  const fetchProjects = useCallback(async () => {
    try {
      const res = await apiGet('/api/projects')
      if (res.ok) {
        const data = await res.json()
        setProjects(Array.isArray(data) ? data : data.data || data.projects || [])
      }
    } catch { /* silent */ }
  }, [])

  const fetchReports = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterType) params.set('type', filterType)
      if (filterProject) params.set('projectId', filterProject)
      params.set('limit', '50')
      const res = await apiGet(`/api/ngo/reports?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setReports(Array.isArray(data) ? data : data.data || data.reports || [])
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [filterType, filterProject])

  useEffect(() => { fetchProjects() }, [fetchProjects])
  useEffect(() => { fetchReports() }, [fetchReports])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('tulip_report_schedules', JSON.stringify(schedules))
    }
  }, [schedules])

  /* ---------------------------------------------------------------- */
  /*  Filtered reports                                                 */
  /* ---------------------------------------------------------------- */

  const filteredReports = reports.filter(r => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!r.projectName?.toLowerCase().includes(q) && !r.type?.toLowerCase().includes(q)) return false
    }
    if (filterType && r.type !== filterType) return false
    if (filterProject && r.projectId !== filterProject) return false
    if (filterFrom && new Date(r.periodStart) < new Date(filterFrom)) return false
    if (filterTo && new Date(r.periodEnd) > new Date(filterTo)) return false
    return true
  })

  /* ---------------------------------------------------------------- */
  /*  Generate report                                                  */
  /* ---------------------------------------------------------------- */

  const handleGenerate = async () => {
    if (!selectedReportType) return
    setGenerating(true)
    setGenError('')
    setGenSuccess(null)
    try {
      const typeSlug = selectedReportType.toLowerCase().replace(/\s+/g, '-')
      const body: Record<string, unknown> = { projectId: genProjectId }

      if (selectedReportType === 'Monthly') {
        body.month = parseInt(genMonth)
        body.year = parseInt(genYear)
      } else if (selectedReportType === 'Quarterly') {
        body.quarter = parseInt(genQuarter) + 1
        body.year = parseInt(genYear)
      } else if (selectedReportType === 'Annual') {
        body.year = parseInt(genYear)
      } else if (selectedReportType === 'Interim') {
        body.dateFrom = genDateFrom
        body.dateTo = genDateTo
        body.notes = genNotes
      } else if (selectedReportType === 'Closing') {
        body.notes = genNotes
      }

      const res = await apiPost(`/api/ngo/reports/generate/${typeSlug}`, body)
      if (res.ok) {
        const data = await res.json()
        setGenSuccess(data)
        fetchReports()
      } else {
        const err = await res.json().catch(() => ({}))
        setGenError(err.message || err.error || 'Failed to generate report')
      }
    } catch (e: unknown) {
      setGenError(e instanceof Error ? e.message : 'Network error')
    }
    setGenerating(false)
  }

  /* ---------------------------------------------------------------- */
  /*  SF-425 wizard handlers                                           */
  /* ---------------------------------------------------------------- */

  const openSF425 = async () => {
    setSf425Open(true)
    setSf425Step(1)
    setSf425Result(null)
    try {
      const res = await apiGet(`/api/ngo/reports/sf425/prefill${genProjectId ? `?projectId=${genProjectId}` : ''}`)
      if (res.ok) setSf425Data(await res.json())
      // Try loading saved config
      const cfgRes = await apiGet('/api/ngo/grant-reporting-config')
      if (cfgRes.ok) {
        const cfg = await cfgRes.json()
        if (cfg) {
          setSf425Org(prev => ({
            ...prev,
            federalAgency: cfg.federalAgency || '',
            orgElement: cfg.orgElement || '',
            ein: cfg.ein || '',
            recipientAccount: cfg.recipientAccount || '',
            accountingBasis: cfg.accountingBasis || 'accrual',
            indirectType: cfg.indirectType || '',
            indirectRate: cfg.indirectRate || '',
          }))
        }
      }
    } catch { /* silent */ }
  }

  const generateSF425 = async () => {
    setGenerating(true)
    setGenError('')
    try {
      const res = await apiPost('/api/ngo/reports/generate/usaid-sf-425', {
        projectId: genProjectId,
        org: sf425Org,
        grant: sf425Grant,
        certification: sf425Cert,
      })
      if (res.ok) {
        const data = await res.json()
        setSf425Result(data)
        setSf425Step(5)
        fetchReports()
      } else {
        const err = await res.json().catch(() => ({}))
        setGenError(err.message || 'Failed to generate SF-425')
      }
    } catch { /* silent */ }
    setGenerating(false)
  }

  /* ---------------------------------------------------------------- */
  /*  World Bank wizard handlers                                       */
  /* ---------------------------------------------------------------- */

  const openWorldBank = async () => {
    setWbOpen(true)
    setWbStep(1)
    setWbResult(null)
    try {
      const res = await apiGet(`/api/ngo/reports/world-bank/prefill${genProjectId ? `?projectId=${genProjectId}` : ''}`)
      if (res.ok) setWbData(await res.json())
      const cfgRes = await apiGet('/api/ngo/grant-reporting-config')
      if (cfgRes.ok) {
        const cfg = await cfgRes.json()
        if (cfg) {
          setWbOrg(prev => ({
            ...prev,
            orgName: cfg.orgName || '',
            bankName: cfg.bankName || '',
            bankAccount: cfg.bankAccount || '',
            swiftCode: cfg.swiftCode || '',
          }))
        }
      }
    } catch { /* silent */ }
  }

  const generateWorldBank = async () => {
    setGenerating(true)
    setGenError('')
    try {
      const res = await apiPost('/api/ngo/reports/generate/world-bank', {
        projectId: genProjectId,
        org: wbOrg,
        financials: wbFinancials,
        certification: wbCert,
      })
      if (res.ok) {
        const data = await res.json()
        setWbResult(data)
        setWbStep(5)
        fetchReports()
      } else {
        const err = await res.json().catch(() => ({}))
        setGenError(err.message || 'Failed to generate World Bank IFR')
      }
    } catch { /* silent */ }
    setGenerating(false)
  }

  /* ---------------------------------------------------------------- */
  /*  Share handlers                                                   */
  /* ---------------------------------------------------------------- */

  const openShare = async (report: Report) => {
    setShareReport(report)
    setShareCopied(false)
    try {
      const res = await apiGet(`/api/ngo/reports/${report.id}/shares`)
      if (res.ok) {
        const data = await res.json()
        setShareLinks(Array.isArray(data) ? data : data.shares || [])
      }
    } catch { /* silent */ }
  }

  const createShareLink = async () => {
    if (!shareReport) return
    setShareGenerating(true)
    try {
      const res = await apiPost(`/api/ngo/reports/${shareReport.id}/shares`, { expiryDays: parseInt(shareExpiry) })
      if (res.ok) {
        const data = await res.json()
        setShareLinks(prev => [data, ...prev])
      }
    } catch { /* silent */ }
    setShareGenerating(false)
  }

  const revokeShareLink = async (shareId: string) => {
    try {
      const res = await apiPost(`/api/ngo/reports/shares/${shareId}/revoke`, {})
      if (res.ok) setShareLinks(prev => prev.filter(s => s.id !== shareId))
    } catch { /* silent */ }
  }

  const copyShareUrl = (token: string) => {
    navigator.clipboard.writeText(`https://donor.sealayer.io/share/report/${token}`)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2000)
  }

  /* ---------------------------------------------------------------- */
  /*  Scheduled reports data                                           */
  /* ---------------------------------------------------------------- */

  const scheduledReports = [
    ...projects.map(p => ({
      key: `monthly-${p.id}`, type: 'Monthly', project: p.name,
      nextGen: nextFirstOfMonth(), projectId: p.id,
    })),
    ...projects.map(p => ({
      key: `quarterly-${p.id}`, type: 'Quarterly', project: p.name,
      nextGen: nextQuarterStart(), projectId: p.id,
    })),
    { key: 'annual-all', type: 'Annual', project: 'All Projects', nextGen: nextJan1(), projectId: '' },
  ]

  /* ---------------------------------------------------------------- */
  /*  Template cards                                                   */
  /* ---------------------------------------------------------------- */

  const templates = [
    { name: 'USAID SF-425', desc: 'Federal Financial Report for USAID-funded projects. Includes expenditure tracking, unliquidated obligations, and program income.', action: openSF425 },
    { name: 'EU Financial Statement', desc: 'Financial statement for EU-funded grants. Covers eligible costs, co-financing, and VAT declarations.', action: () => { setSelectedReportType('EU Financial'); setGenerateOpen(true) } },
    { name: 'DFID Annual Review', desc: 'Annual review template for DFID/FCDO programs. Includes output indicators, value for money, and risk assessment.', action: () => { setSelectedReportType('DFID Review'); setGenerateOpen(true) } },
    { name: 'World Bank IFR', desc: 'Interim Financial Report for World Bank projects. Covers sources and uses of funds by component and category.', action: openWorldBank },
  ]

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--tulip-forest)]">Reports</h1>
        <p className="text-sm text-[var(--tulip-forest)]/60 mt-1">Generate, manage and share project reports</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[var(--tulip-sage)] rounded-lg p-1 w-fit">
        {(['generated', 'scheduled', 'templates'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all capitalize ${
              activeTab === tab
                ? 'bg-[var(--tulip-forest)] text-[var(--tulip-cream)] shadow-sm'
                : 'text-[var(--tulip-forest)]/70 hover:text-[var(--tulip-forest)] hover:bg-[var(--tulip-cream)]/50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ============================================================ */}
      {/*  GENERATED TAB                                                */}
      {/* ============================================================ */}
      {activeTab === 'generated' && (
        <>
          {/* Generate Report Section (collapsible) */}
          <div className="mb-6 border border-[var(--tulip-sage-dark)] rounded-xl bg-[var(--tulip-cream)] overflow-hidden">
            <button
              onClick={() => setGenerateOpen(!generateOpen)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--tulip-sage)]/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[var(--tulip-forest)] flex items-center justify-center">
                  <Plus size={16} className="text-[var(--tulip-gold)]" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-[var(--tulip-forest)]">Generate Report</div>
                  <div className="text-xs text-[var(--tulip-forest)]/50">Create a new report from templates</div>
                </div>
              </div>
              {generateOpen ? <ChevronUp size={18} className="text-[var(--tulip-forest)]/40" /> : <ChevronDown size={18} className="text-[var(--tulip-forest)]/40" />}
            </button>

            {generateOpen && (
              <div className="px-5 pb-5 border-t border-[var(--tulip-sage-dark)]">
                {/* Type selector */}
                <div className="mt-4">
                  <label className="text-xs font-medium text-[var(--tulip-forest)]/60 uppercase tracking-wider">Standard</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {REPORT_TYPES.standard.map(type => (
                      <button
                        key={type}
                        onClick={() => { setSelectedReportType(type); setGenError(''); setGenSuccess(null) }}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                          selectedReportType === type
                            ? 'bg-[var(--tulip-forest)] text-[var(--tulip-cream)]'
                            : `${TYPE_COLORS[type] || 'bg-gray-100 text-gray-700'} hover:opacity-80`
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3">
                  <label className="text-xs font-medium text-[var(--tulip-forest)]/60 uppercase tracking-wider">Institutional</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {REPORT_TYPES.institutional.map(type => (
                      <button
                        key={type}
                        onClick={() => {
                          if (type === 'USAID SF-425') { openSF425(); return }
                          if (type === 'World Bank') { openWorldBank(); return }
                          setSelectedReportType(type)
                          setGenError('')
                          setGenSuccess(null)
                        }}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                          selectedReportType === type
                            ? 'bg-[var(--tulip-forest)] text-[var(--tulip-cream)]'
                            : `${TYPE_COLORS[type] || 'bg-gray-100 text-gray-700'} hover:opacity-80`
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Form fields based on selected type */}
                {selectedReportType && !['USAID SF-425', 'World Bank'].includes(selectedReportType) && (
                  <div className="mt-5 p-4 bg-[var(--tulip-sage)]/50 rounded-lg border border-[var(--tulip-sage-dark)]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Project */}
                      {selectedReportType !== 'Annual' && (
                        <div>
                          <label className="block text-sm font-medium text-[var(--tulip-forest)] mb-1">Project</label>
                          <select
                            value={genProjectId}
                            onChange={e => setGenProjectId(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-cream)] text-sm text-[var(--tulip-forest)] focus:outline-none focus:ring-2 focus:ring-[var(--tulip-forest)]/20"
                          >
                            <option value="">Select project...</option>
                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>
                      )}

                      {selectedReportType === 'Annual' && (
                        <div>
                          <label className="block text-sm font-medium text-[var(--tulip-forest)] mb-1">Project</label>
                          <select
                            value={genProjectId}
                            onChange={e => setGenProjectId(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-cream)] text-sm text-[var(--tulip-forest)] focus:outline-none focus:ring-2 focus:ring-[var(--tulip-forest)]/20"
                          >
                            <option value="">All Projects</option>
                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>
                      )}

                      {/* Month picker */}
                      {selectedReportType === 'Monthly' && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-[var(--tulip-forest)] mb-1">Month</label>
                            <select value={genMonth} onChange={e => setGenMonth(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-cream)] text-sm text-[var(--tulip-forest)] focus:outline-none focus:ring-2 focus:ring-[var(--tulip-forest)]/20">
                              {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-[var(--tulip-forest)] mb-1">Year</label>
                            <input type="number" value={genYear} onChange={e => setGenYear(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-cream)] text-sm text-[var(--tulip-forest)] focus:outline-none focus:ring-2 focus:ring-[var(--tulip-forest)]/20" />
                          </div>
                        </>
                      )}

                      {/* Quarter picker */}
                      {selectedReportType === 'Quarterly' && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-[var(--tulip-forest)] mb-1">Quarter</label>
                            <select value={genQuarter} onChange={e => setGenQuarter(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-cream)] text-sm text-[var(--tulip-forest)] focus:outline-none focus:ring-2 focus:ring-[var(--tulip-forest)]/20">
                              {QUARTERS.map((q, i) => <option key={i} value={i}>{q}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-[var(--tulip-forest)] mb-1">Year</label>
                            <input type="number" value={genYear} onChange={e => setGenYear(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-cream)] text-sm text-[var(--tulip-forest)] focus:outline-none focus:ring-2 focus:ring-[var(--tulip-forest)]/20" />
                          </div>
                        </>
                      )}

                      {/* Year picker */}
                      {selectedReportType === 'Annual' && (
                        <div>
                          <label className="block text-sm font-medium text-[var(--tulip-forest)] mb-1">Year</label>
                          <input type="number" value={genYear} onChange={e => setGenYear(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-cream)] text-sm text-[var(--tulip-forest)] focus:outline-none focus:ring-2 focus:ring-[var(--tulip-forest)]/20" />
                        </div>
                      )}

                      {/* Date range for Interim */}
                      {selectedReportType === 'Interim' && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-[var(--tulip-forest)] mb-1">From</label>
                            <input type="date" value={genDateFrom} onChange={e => setGenDateFrom(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-cream)] text-sm text-[var(--tulip-forest)] focus:outline-none focus:ring-2 focus:ring-[var(--tulip-forest)]/20" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-[var(--tulip-forest)] mb-1">To</label>
                            <input type="date" value={genDateTo} onChange={e => setGenDateTo(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-cream)] text-sm text-[var(--tulip-forest)] focus:outline-none focus:ring-2 focus:ring-[var(--tulip-forest)]/20" />
                          </div>
                        </>
                      )}
                    </div>

                    {/* Notes/Lessons for Interim/Closing */}
                    {(selectedReportType === 'Interim' || selectedReportType === 'Closing') && (
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-[var(--tulip-forest)] mb-1">Notes / Lessons Learned</label>
                        <textarea value={genNotes} onChange={e => setGenNotes(e.target.value)} rows={3}
                          className="w-full px-3 py-2 rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-cream)] text-sm text-[var(--tulip-forest)] focus:outline-none focus:ring-2 focus:ring-[var(--tulip-forest)]/20 resize-none"
                          placeholder="Optional notes or lessons learned..." />
                      </div>
                    )}

                    {/* Generate button */}
                    <div className="mt-4 flex items-center gap-3">
                      <button onClick={handleGenerate} disabled={generating}
                        className="px-5 py-2.5 rounded-lg bg-[var(--tulip-forest)] text-[var(--tulip-cream)] text-sm font-medium hover:bg-[var(--tulip-forest)]/90 transition-all disabled:opacity-50 flex items-center gap-2">
                        {generating ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                        Generate Now
                      </button>
                      {genError && (
                        <div className="flex items-center gap-2 text-sm text-red-600">
                          <AlertCircle size={14} /> {genError}
                        </div>
                      )}
                      {genSuccess && (
                        <div className="flex items-center gap-2 text-sm text-green-700">
                          <Check size={14} /> Report generated!
                          {genSuccess.downloadUrl && (
                            <a href={genSuccess.downloadUrl} className="underline ml-1">Download</a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tulip-forest)]/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by project or type..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-cream)] text-sm text-[var(--tulip-forest)] focus:outline-none focus:ring-2 focus:ring-[var(--tulip-forest)]/20"
              />
            </div>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="px-3 py-2 rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-cream)] text-sm text-[var(--tulip-forest)] focus:outline-none focus:ring-2 focus:ring-[var(--tulip-forest)]/20">
              <option value="">All Types</option>
              {ALL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
              className="px-3 py-2 rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-cream)] text-sm text-[var(--tulip-forest)] focus:outline-none focus:ring-2 focus:ring-[var(--tulip-forest)]/20">
              <option value="">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
              className="px-3 py-2 rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-cream)] text-sm text-[var(--tulip-forest)] focus:outline-none focus:ring-2 focus:ring-[var(--tulip-forest)]/20" />
            <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
              className="px-3 py-2 rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-cream)] text-sm text-[var(--tulip-forest)] focus:outline-none focus:ring-2 focus:ring-[var(--tulip-forest)]/20" />
          </div>

          {/* Reports Table */}
          <div className="border border-[var(--tulip-sage-dark)] rounded-xl overflow-hidden bg-[var(--tulip-cream)]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--tulip-sage)] border-b border-[var(--tulip-sage-dark)]">
                    <th className="text-left px-4 py-3 font-semibold text-[var(--tulip-forest)]/70 text-xs uppercase tracking-wider">Type</th>
                    <th className="text-left px-4 py-3 font-semibold text-[var(--tulip-forest)]/70 text-xs uppercase tracking-wider">Project</th>
                    <th className="text-left px-4 py-3 font-semibold text-[var(--tulip-forest)]/70 text-xs uppercase tracking-wider">Period</th>
                    <th className="text-left px-4 py-3 font-semibold text-[var(--tulip-forest)]/70 text-xs uppercase tracking-wider">Generated</th>
                    <th className="text-left px-4 py-3 font-semibold text-[var(--tulip-forest)]/70 text-xs uppercase tracking-wider">Size</th>
                    <th className="text-left px-4 py-3 font-semibold text-[var(--tulip-forest)]/70 text-xs uppercase tracking-wider">Seal Status</th>
                    <th className="text-right px-4 py-3 font-semibold text-[var(--tulip-forest)]/70 text-xs uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="text-center py-12 text-[var(--tulip-forest)]/50">
                      <Loader2 size={20} className="animate-spin mx-auto mb-2" />Loading reports...
                    </td></tr>
                  ) : filteredReports.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12">
                      <FileText size={32} className="mx-auto mb-3 text-[var(--tulip-forest)]/20" />
                      <p className="text-[var(--tulip-forest)]/50 text-sm">No reports generated yet.</p>
                      <p className="text-[var(--tulip-forest)]/40 text-xs mt-1">Use the templates below to generate your first report.</p>
                    </td></tr>
                  ) : filteredReports.map(report => (
                    <tr key={report.id} className="border-b border-[var(--tulip-sage-dark)]/50 hover:bg-[var(--tulip-sage)]/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${TYPE_COLORS[report.type] || 'bg-gray-100 text-gray-700'}`}>
                          {report.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--tulip-forest)] font-medium">{report.projectName}</td>
                      <td className="px-4 py-3 text-[var(--tulip-forest)]/70 text-xs">
                        {formatDate(report.periodStart)} - {formatDate(report.periodEnd)}
                      </td>
                      <td className="px-4 py-3 text-[var(--tulip-forest)]/60 text-xs">{formatRelative(report.generatedAt)}</td>
                      <td className="px-4 py-3 text-[var(--tulip-forest)]/60 text-xs">{formatBytes(report.size)}</td>
                      <td className="px-4 py-3">
                        {report.sealStatus === 'anchored' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            <Check size={12} /> Anchored
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                            <Clock size={12} /> Sealing
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {report.downloadUrl && (
                            <a href={report.downloadUrl} title="Download"
                              className="p-1.5 rounded-md hover:bg-[var(--tulip-sage)] transition-colors text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)]">
                              <Download size={14} />
                            </a>
                          )}
                          <button onClick={() => openShare(report)} title="Share"
                            className="p-1.5 rounded-md hover:bg-[var(--tulip-sage)] transition-colors text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)]">
                            <Share2 size={14} />
                          </button>
                          <button onClick={() => {
                            setSelectedReportType(report.type)
                            setGenProjectId(report.projectId)
                            setGenerateOpen(true)
                          }} title="Regenerate"
                            className="p-1.5 rounded-md hover:bg-[var(--tulip-sage)] transition-colors text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)]">
                            <RefreshCw size={14} />
                          </button>
                          <button title="Email"
                            className="p-1.5 rounded-md hover:bg-[var(--tulip-sage)] transition-colors text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)]">
                            <Mail size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ============================================================ */}
      {/*  SCHEDULED TAB                                                */}
      {/* ============================================================ */}
      {activeTab === 'scheduled' && (
        <div className="border border-[var(--tulip-sage-dark)] rounded-xl overflow-hidden bg-[var(--tulip-cream)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--tulip-sage)] border-b border-[var(--tulip-sage-dark)]">
                  <th className="text-left px-4 py-3 font-semibold text-[var(--tulip-forest)]/70 text-xs uppercase tracking-wider">Type</th>
                  <th className="text-left px-4 py-3 font-semibold text-[var(--tulip-forest)]/70 text-xs uppercase tracking-wider">Project</th>
                  <th className="text-left px-4 py-3 font-semibold text-[var(--tulip-forest)]/70 text-xs uppercase tracking-wider">Next Generation</th>
                  <th className="text-right px-4 py-3 font-semibold text-[var(--tulip-forest)]/70 text-xs uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {scheduledReports.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-12 text-[var(--tulip-forest)]/50 text-sm">No scheduled reports</td></tr>
                ) : scheduledReports.map(sched => {
                  const enabled = schedules[sched.key] !== false
                  return (
                    <tr key={sched.key} className="border-b border-[var(--tulip-sage-dark)]/50 hover:bg-[var(--tulip-sage)]/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${TYPE_COLORS[sched.type] || 'bg-gray-100 text-gray-700'}`}>
                          {sched.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--tulip-forest)] font-medium">{sched.project}</td>
                      <td className="px-4 py-3 text-[var(--tulip-forest)]/70 text-xs flex items-center gap-2">
                        <Calendar size={13} /> {sched.nextGen}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSchedules(prev => ({ ...prev, [sched.key]: !enabled }))}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            enabled ? 'bg-[var(--tulip-forest)]' : 'bg-[var(--tulip-sage-dark)]'
                          }`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-[var(--tulip-cream)] transition-transform ${
                            enabled ? 'translate-x-6' : 'translate-x-1'
                          }`} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  TEMPLATES TAB                                                */}
      {/* ============================================================ */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map(tmpl => (
            <div key={tmpl.name} className="border border-[var(--tulip-sage-dark)] rounded-xl p-5 bg-[var(--tulip-cream)] hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--tulip-sage)] flex items-center justify-center shrink-0">
                  <FileText size={18} className="text-[var(--tulip-forest)]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-[var(--tulip-forest)]">{tmpl.name}</h3>
                  <p className="text-xs text-[var(--tulip-forest)]/60 mt-1 leading-relaxed">{tmpl.desc}</p>
                  <button onClick={tmpl.action}
                    className="mt-3 px-4 py-2 rounded-lg bg-[var(--tulip-forest)] text-[var(--tulip-cream)] text-xs font-medium hover:bg-[var(--tulip-forest)]/90 transition-all flex items-center gap-1.5">
                    Generate <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ============================================================ */}
      {/*  SF-425 WIZARD MODAL                                          */}
      {/* ============================================================ */}
      {sf425Open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSf425Open(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-[var(--tulip-cream)] rounded-2xl shadow-2xl border border-[var(--tulip-sage-dark)]"
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b border-[var(--tulip-sage-dark)] bg-[var(--tulip-cream)] z-10">
              <div>
                <h2 className="text-lg font-bold text-[var(--tulip-forest)]">USAID SF-425 Report</h2>
                <p className="text-xs text-[var(--tulip-forest)]/50">Step {sf425Step} of 5</p>
              </div>
              <button onClick={() => setSf425Open(false)} className="p-1.5 rounded-md hover:bg-[var(--tulip-sage)] transition-colors">
                <X size={18} className="text-[var(--tulip-forest)]/60" />
              </button>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-[var(--tulip-sage)]">
              <div className="h-full bg-[var(--tulip-forest)] transition-all" style={{ width: `${(sf425Step / 5) * 100}%` }} />
            </div>

            <div className="p-6">
              {/* Step 1 — Review Sealayer Data */}
              {sf425Step === 1 && (
                <div>
                  <h3 className="text-sm font-semibold text-[var(--tulip-forest)] mb-4">Review Sealayer Data</h3>
                  {sf425Data ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <InfoField label="Project" value={sf425Data.projectName} />
                        <InfoField label="Period" value={sf425Data.dateRange} />
                        <InfoField label="Funding Agreement" value={sf425Data.fundingAgreement} />
                        <InfoField label="Total Authorized" value={formatCurrency(sf425Data.totalAuthorized)} />
                        <InfoField label="Expenditures This Period" value={formatCurrency(sf425Data.expendituresThisPeriod)} />
                        <InfoField label="Approved Expenses" value={sf425Data.approvedExpenses.toString()} />
                      </div>
                      <div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-xs flex items-center gap-2">
                        <Shield size={14} /> These figures are blockchain-verified by Sealayer
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-[var(--tulip-forest)]/50">
                      <Loader2 size={14} className="animate-spin" /> Loading data...
                    </div>
                  )}
                  <div className="mt-6 flex justify-end">
                    <button onClick={() => setSf425Step(2)} className="px-5 py-2.5 rounded-lg bg-[var(--tulip-forest)] text-[var(--tulip-cream)] text-sm font-medium hover:bg-[var(--tulip-forest)]/90 flex items-center gap-2">
                      Continue <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2 — Organisation Details */}
              {sf425Step === 2 && (
                <div>
                  <h3 className="text-sm font-semibold text-[var(--tulip-forest)] mb-4">Organisation Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormInput label="Federal Agency" value={sf425Org.federalAgency} onChange={v => setSf425Org(p => ({ ...p, federalAgency: v }))} />
                    <FormInput label="Organizational Element" value={sf425Org.orgElement} onChange={v => setSf425Org(p => ({ ...p, orgElement: v }))} />
                    <FormInput label="EIN" value={sf425Org.ein} onChange={v => setSf425Org(p => ({ ...p, ein: v }))} />
                    <FormInput label="Recipient Account Number" value={sf425Org.recipientAccount} onChange={v => setSf425Org(p => ({ ...p, recipientAccount: v }))} />
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-[var(--tulip-forest)] mb-2">Basis of Accounting</label>
                    <div className="flex gap-2">
                      {(['cash', 'accrual'] as const).map(basis => (
                        <button key={basis} onClick={() => setSf425Org(p => ({ ...p, accountingBasis: basis }))}
                          className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                            sf425Org.accountingBasis === basis ? 'bg-[var(--tulip-forest)] text-[var(--tulip-cream)]' : 'bg-[var(--tulip-sage)] text-[var(--tulip-forest)] hover:bg-[var(--tulip-sage-dark)]'
                          }`}>
                          {basis}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <FormInput label="Indirect Expense Type" value={sf425Org.indirectType} onChange={v => setSf425Org(p => ({ ...p, indirectType: v }))} />
                    <FormInput label="Indirect Expense Rate (%)" value={sf425Org.indirectRate} onChange={v => setSf425Org(p => ({ ...p, indirectRate: v }))} />
                  </div>
                  <label className="flex items-center gap-2 mt-4 text-sm text-[var(--tulip-forest)]/70 cursor-pointer">
                    <input type="checkbox" checked={sf425Org.saveForFuture} onChange={e => setSf425Org(p => ({ ...p, saveForFuture: e.target.checked }))}
                      className="rounded border-[var(--tulip-sage-dark)]" />
                    Save for future reports
                  </label>
                  <WizardNav onBack={() => setSf425Step(1)} onNext={() => setSf425Step(3)} />
                </div>
              )}

              {/* Step 3 — Grant Details */}
              {sf425Step === 3 && (
                <div>
                  <h3 className="text-sm font-semibold text-[var(--tulip-forest)] mb-4">Grant Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormInput label="Federal Grant Number *" value={sf425Grant.grantNumber} onChange={v => setSf425Grant(p => ({ ...p, grantNumber: v }))} required />
                    <div>
                      <label className="block text-sm font-medium text-[var(--tulip-forest)] mb-1">Report Type</label>
                      <select value={sf425Grant.reportType} onChange={e => setSf425Grant(p => ({ ...p, reportType: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-cream)] text-sm text-[var(--tulip-forest)] focus:outline-none focus:ring-2 focus:ring-[var(--tulip-forest)]/20">
                        <option>Annual</option><option>Quarterly</option><option>Final</option>
                      </select>
                    </div>
                    <FormInput label="Unliquidated Obligations ($)" value={sf425Grant.unliquidated} onChange={v => setSf425Grant(p => ({ ...p, unliquidated: v }))} type="number" />
                    <FormInput label="Program Income Received ($)" value={sf425Grant.programIncomeReceived} onChange={v => setSf425Grant(p => ({ ...p, programIncomeReceived: v }))} type="number" />
                    <FormInput label="Program Income Expended ($)" value={sf425Grant.programIncomeExpended} onChange={v => setSf425Grant(p => ({ ...p, programIncomeExpended: v }))} type="number" />
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-[var(--tulip-forest)] mb-1">Remarks</label>
                    <textarea value={sf425Grant.remarks} onChange={e => setSf425Grant(p => ({ ...p, remarks: e.target.value }))} rows={3}
                      className="w-full px-3 py-2 rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-cream)] text-sm text-[var(--tulip-forest)] focus:outline-none focus:ring-2 focus:ring-[var(--tulip-forest)]/20 resize-none" />
                  </div>
                  <WizardNav onBack={() => setSf425Step(2)} onNext={() => setSf425Step(4)} />
                </div>
              )}

              {/* Step 4 — Review & Certify */}
              {sf425Step === 4 && (
                <div>
                  <h3 className="text-sm font-semibold text-[var(--tulip-forest)] mb-4">Review & Certify</h3>
                  {sf425Data && (
                    <div className="mb-4 p-4 bg-[var(--tulip-sage)]/50 rounded-lg border border-[var(--tulip-sage-dark)] space-y-2 text-xs text-[var(--tulip-forest)]">
                      <h4 className="font-semibold text-sm mb-2">SF-425 Line Items</h4>
                      {Object.entries(sf425Data.lineItems || {}).map(([key, val]) => (
                        <div key={key} className="flex justify-between py-1 border-b border-[var(--tulip-sage-dark)]/30">
                          <span className="text-[var(--tulip-forest)]/70">{key}</span>
                          <span className="font-medium">{formatCurrency(val)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="p-4 bg-[var(--tulip-sage)]/50 rounded-lg border border-[var(--tulip-sage-dark)]">
                    <h4 className="text-sm font-semibold text-[var(--tulip-forest)] mb-3">Certification</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormInput label="Full Name *" value={sf425Cert.fullName} onChange={v => setSf425Cert(p => ({ ...p, fullName: v }))} required />
                      <FormInput label="Title *" value={sf425Cert.title} onChange={v => setSf425Cert(p => ({ ...p, title: v }))} required />
                      <FormInput label="Phone *" value={sf425Cert.phone} onChange={v => setSf425Cert(p => ({ ...p, phone: v }))} required />
                      <FormInput label="Email *" value={sf425Cert.email} onChange={v => setSf425Cert(p => ({ ...p, email: v }))} type="email" required />
                    </div>
                    <div className="mt-3">
                      <InfoField label="Date" value={sf425Cert.date} />
                    </div>
                    <p className="mt-3 text-xs text-[var(--tulip-forest)]/60 leading-relaxed">
                      By signing this report, I certify to the best of my knowledge and belief that the report is true, complete, and accurate,
                      and the expenditures, disbursements and cash receipts are for the purposes and objectives set forth in the terms and conditions
                      of the Federal award.
                    </p>
                  </div>
                  <div className="mt-6 flex items-center justify-between">
                    <button onClick={() => setSf425Step(3)} className="px-4 py-2.5 rounded-lg border border-[var(--tulip-sage-dark)] text-sm font-medium text-[var(--tulip-forest)] hover:bg-[var(--tulip-sage)] transition-all flex items-center gap-2">
                      <ArrowLeft size={14} /> Back
                    </button>
                    <button onClick={generateSF425} disabled={generating || !sf425Cert.fullName || !sf425Grant.grantNumber}
                      className="px-5 py-2.5 rounded-lg bg-[var(--tulip-forest)] text-[var(--tulip-cream)] text-sm font-medium hover:bg-[var(--tulip-forest)]/90 transition-all disabled:opacity-50 flex items-center gap-2">
                      {generating ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                      Generate SF-425 Report
                    </button>
                  </div>
                  {genError && <p className="mt-3 text-sm text-red-600 flex items-center gap-2"><AlertCircle size={14} /> {genError}</p>}
                </div>
              )}

              {/* Step 5 — Done */}
              {sf425Step === 5 && sf425Result && (
                <div className="text-center py-4">
                  <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                    <Check size={28} className="text-green-600" />
                  </div>
                  <h3 className="text-lg font-bold text-[var(--tulip-forest)]">SF-425 Report Generated</h3>
                  <p className="text-sm text-[var(--tulip-forest)]/60 mt-1">Your report has been created and sealed.</p>

                  <div className="flex items-center justify-center gap-3 mt-6">
                    {sf425Result.downloadUrl && (
                      <a href={sf425Result.downloadUrl}
                        className="px-4 py-2.5 rounded-lg bg-[var(--tulip-forest)] text-[var(--tulip-cream)] text-sm font-medium hover:bg-[var(--tulip-forest)]/90 flex items-center gap-2">
                        <Download size={14} /> Download PDF
                      </a>
                    )}
                    <button onClick={() => openShare(sf425Result!)}
                      className="px-4 py-2.5 rounded-lg border border-[var(--tulip-sage-dark)] text-sm font-medium text-[var(--tulip-forest)] hover:bg-[var(--tulip-sage)] flex items-center gap-2">
                      <Link2 size={14} /> Share Link
                    </button>
                    <button onClick={() => { setSf425Step(1); setSf425Result(null) }}
                      className="px-4 py-2.5 rounded-lg border border-[var(--tulip-sage-dark)] text-sm font-medium text-[var(--tulip-forest)] hover:bg-[var(--tulip-sage)] flex items-center gap-2">
                      <RefreshCw size={14} /> Generate Another
                    </button>
                  </div>

                  {(sf425Result.sha256 || sf425Result.polygonTx) && (
                    <div className="mt-6 p-4 bg-[var(--tulip-sage)]/50 rounded-lg border border-[var(--tulip-sage-dark)] text-left text-xs space-y-2">
                      <h4 className="font-semibold text-sm text-[var(--tulip-forest)]">Seal Details</h4>
                      {sf425Result.sha256 && <InfoField label="SHA-256" value={sf425Result.sha256} />}
                      {sf425Result.anchorDate && <InfoField label="Anchor Date" value={formatDate(sf425Result.anchorDate)} />}
                      {sf425Result.polygonTx && <InfoField label="Polygon TX" value={sf425Result.polygonTx} />}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  WORLD BANK WIZARD MODAL                                      */}
      {/* ============================================================ */}
      {wbOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setWbOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-[var(--tulip-cream)] rounded-2xl shadow-2xl border border-[var(--tulip-sage-dark)]"
            onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b border-[var(--tulip-sage-dark)] bg-[var(--tulip-cream)] z-10">
              <div>
                <h2 className="text-lg font-bold text-[var(--tulip-forest)]">World Bank IFR</h2>
                <p className="text-xs text-[var(--tulip-forest)]/50">Step {wbStep} of 5</p>
              </div>
              <button onClick={() => setWbOpen(false)} className="p-1.5 rounded-md hover:bg-[var(--tulip-sage)] transition-colors">
                <X size={18} className="text-[var(--tulip-forest)]/60" />
              </button>
            </div>
            <div className="h-1 bg-[var(--tulip-sage)]">
              <div className="h-full bg-[var(--tulip-forest)] transition-all" style={{ width: `${(wbStep / 5) * 100}%` }} />
            </div>

            <div className="p-6">
              {/* Step 1 — Review component + contract data */}
              {wbStep === 1 && (
                <div>
                  <h3 className="text-sm font-semibold text-[var(--tulip-forest)] mb-4">Review Component & Contract Data</h3>
                  {wbData ? (
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-xs font-medium text-[var(--tulip-forest)]/60 uppercase tracking-wider mb-2">Components</h4>
                        <div className="border border-[var(--tulip-sage-dark)] rounded-lg overflow-hidden">
                          <table className="w-full text-xs">
                            <thead><tr className="bg-[var(--tulip-sage)]">
                              <th className="text-left px-3 py-2 font-medium text-[var(--tulip-forest)]/70">Component</th>
                              <th className="text-right px-3 py-2 font-medium text-[var(--tulip-forest)]/70">Budget</th>
                              <th className="text-right px-3 py-2 font-medium text-[var(--tulip-forest)]/70">Spent</th>
                            </tr></thead>
                            <tbody>
                              {wbData.components.map((c, i) => (
                                <tr key={i} className="border-t border-[var(--tulip-sage-dark)]/50">
                                  <td className="px-3 py-2 text-[var(--tulip-forest)]">{c.name}</td>
                                  <td className="px-3 py-2 text-right text-[var(--tulip-forest)]/70">{formatCurrency(c.budget)}</td>
                                  <td className="px-3 py-2 text-right text-[var(--tulip-forest)]/70">{formatCurrency(c.spent)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs font-medium text-[var(--tulip-forest)]/60 uppercase tracking-wider mb-2">Contracts</h4>
                        <div className="border border-[var(--tulip-sage-dark)] rounded-lg overflow-hidden">
                          <table className="w-full text-xs">
                            <thead><tr className="bg-[var(--tulip-sage)]">
                              <th className="text-left px-3 py-2 font-medium text-[var(--tulip-forest)]/70">Ref</th>
                              <th className="text-left px-3 py-2 font-medium text-[var(--tulip-forest)]/70">Vendor</th>
                              <th className="text-right px-3 py-2 font-medium text-[var(--tulip-forest)]/70">Amount</th>
                            </tr></thead>
                            <tbody>
                              {wbData.contracts.map((c, i) => (
                                <tr key={i} className="border-t border-[var(--tulip-sage-dark)]/50">
                                  <td className="px-3 py-2 text-[var(--tulip-forest)]">{c.ref}</td>
                                  <td className="px-3 py-2 text-[var(--tulip-forest)]/70">{c.vendor}</td>
                                  <td className="px-3 py-2 text-right text-[var(--tulip-forest)]/70">{formatCurrency(c.amount)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-xs flex items-center gap-2">
                        <Shield size={14} /> These figures are blockchain-verified by Sealayer
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-[var(--tulip-forest)]/50">
                      <Loader2 size={14} className="animate-spin" /> Loading data...
                    </div>
                  )}
                  <div className="mt-6 flex justify-end">
                    <button onClick={() => setWbStep(2)} className="px-5 py-2.5 rounded-lg bg-[var(--tulip-forest)] text-[var(--tulip-cream)] text-sm font-medium hover:bg-[var(--tulip-forest)]/90 flex items-center gap-2">
                      Continue <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2 — Organisation details */}
              {wbStep === 2 && (
                <div>
                  <h3 className="text-sm font-semibold text-[var(--tulip-forest)] mb-4">Organisation Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormInput label="Organisation Name" value={wbOrg.orgName} onChange={v => setWbOrg(p => ({ ...p, orgName: v }))} />
                    <FormInput label="Bank Name" value={wbOrg.bankName} onChange={v => setWbOrg(p => ({ ...p, bankName: v }))} />
                    <FormInput label="Bank Account Number" value={wbOrg.bankAccount} onChange={v => setWbOrg(p => ({ ...p, bankAccount: v }))} />
                    <FormInput label="SWIFT Code" value={wbOrg.swiftCode} onChange={v => setWbOrg(p => ({ ...p, swiftCode: v }))} />
                  </div>
                  <label className="flex items-center gap-2 mt-4 text-sm text-[var(--tulip-forest)]/70 cursor-pointer">
                    <input type="checkbox" checked={wbOrg.saveForFuture} onChange={e => setWbOrg(p => ({ ...p, saveForFuture: e.target.checked }))}
                      className="rounded border-[var(--tulip-sage-dark)]" />
                    Save for future reports
                  </label>
                  <WizardNav onBack={() => setWbStep(1)} onNext={() => setWbStep(3)} />
                </div>
              )}

              {/* Step 3 — Period financials */}
              {wbStep === 3 && (
                <div>
                  <h3 className="text-sm font-semibold text-[var(--tulip-forest)] mb-4">Period Financials</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormInput label="Opening Balance ($)" value={wbFinancials.openingBalance} onChange={v => setWbFinancials(p => ({ ...p, openingBalance: v }))} type="number" />
                    <FormInput label="World Bank Funds Received ($)" value={wbFinancials.wbFunds} onChange={v => setWbFinancials(p => ({ ...p, wbFunds: v }))} type="number" />
                    <FormInput label="Government Funds ($)" value={wbFinancials.govFunds} onChange={v => setWbFinancials(p => ({ ...p, govFunds: v }))} type="number" />
                    <FormInput label="Other Funds ($)" value={wbFinancials.otherFunds} onChange={v => setWbFinancials(p => ({ ...p, otherFunds: v }))} type="number" />
                    <FormInput label="Closing Balance ($)" value={wbFinancials.closingBalance} onChange={v => setWbFinancials(p => ({ ...p, closingBalance: v }))} type="number" />
                  </div>
                  <WizardNav onBack={() => setWbStep(2)} onNext={() => setWbStep(4)} />
                </div>
              )}

              {/* Step 4 — Review & Certify */}
              {wbStep === 4 && (
                <div>
                  <h3 className="text-sm font-semibold text-[var(--tulip-forest)] mb-4">Review & Certify</h3>
                  <div className="space-y-3 mb-4">
                    <div className="p-4 bg-[var(--tulip-sage)]/50 rounded-lg border border-[var(--tulip-sage-dark)]">
                      <h4 className="text-xs font-semibold text-[var(--tulip-forest)] mb-2 uppercase tracking-wider">Organisation</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <InfoField label="Name" value={wbOrg.orgName} />
                        <InfoField label="Bank" value={wbOrg.bankName} />
                      </div>
                    </div>
                    <div className="p-4 bg-[var(--tulip-sage)]/50 rounded-lg border border-[var(--tulip-sage-dark)]">
                      <h4 className="text-xs font-semibold text-[var(--tulip-forest)] mb-2 uppercase tracking-wider">Financials</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <InfoField label="Opening Balance" value={formatCurrency(parseFloat(wbFinancials.openingBalance) || 0)} />
                        <InfoField label="WB Funds" value={formatCurrency(parseFloat(wbFinancials.wbFunds) || 0)} />
                        <InfoField label="Gov Funds" value={formatCurrency(parseFloat(wbFinancials.govFunds) || 0)} />
                        <InfoField label="Closing Balance" value={formatCurrency(parseFloat(wbFinancials.closingBalance) || 0)} />
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-[var(--tulip-sage)]/50 rounded-lg border border-[var(--tulip-sage-dark)]">
                    <h4 className="text-sm font-semibold text-[var(--tulip-forest)] mb-3">Certification</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormInput label="Full Name *" value={wbCert.fullName} onChange={v => setWbCert(p => ({ ...p, fullName: v }))} required />
                      <FormInput label="Title *" value={wbCert.title} onChange={v => setWbCert(p => ({ ...p, title: v }))} required />
                      <FormInput label="Phone *" value={wbCert.phone} onChange={v => setWbCert(p => ({ ...p, phone: v }))} required />
                      <FormInput label="Email *" value={wbCert.email} onChange={v => setWbCert(p => ({ ...p, email: v }))} type="email" required />
                    </div>
                    <div className="mt-3"><InfoField label="Date" value={wbCert.date} /></div>
                    <p className="mt-3 text-xs text-[var(--tulip-forest)]/60 leading-relaxed">
                      I certify that this Interim Financial Report is true, complete, and accurate to the best of my knowledge,
                      and that the expenditures reported have been incurred in accordance with the terms of the Financing Agreement.
                    </p>
                  </div>
                  <div className="mt-6 flex items-center justify-between">
                    <button onClick={() => setWbStep(3)} className="px-4 py-2.5 rounded-lg border border-[var(--tulip-sage-dark)] text-sm font-medium text-[var(--tulip-forest)] hover:bg-[var(--tulip-sage)] transition-all flex items-center gap-2">
                      <ArrowLeft size={14} /> Back
                    </button>
                    <button onClick={generateWorldBank} disabled={generating || !wbCert.fullName}
                      className="px-5 py-2.5 rounded-lg bg-[var(--tulip-forest)] text-[var(--tulip-cream)] text-sm font-medium hover:bg-[var(--tulip-forest)]/90 transition-all disabled:opacity-50 flex items-center gap-2">
                      {generating ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                      Generate World Bank IFR
                    </button>
                  </div>
                  {genError && <p className="mt-3 text-sm text-red-600 flex items-center gap-2"><AlertCircle size={14} /> {genError}</p>}
                </div>
              )}

              {/* Step 5 — Done */}
              {wbStep === 5 && wbResult && (
                <div className="text-center py-4">
                  <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                    <Check size={28} className="text-green-600" />
                  </div>
                  <h3 className="text-lg font-bold text-[var(--tulip-forest)]">World Bank IFR Generated</h3>
                  <p className="text-sm text-[var(--tulip-forest)]/60 mt-1">Your report has been created and sealed.</p>
                  <div className="flex items-center justify-center gap-3 mt-6">
                    {wbResult.downloadUrl && (
                      <a href={wbResult.downloadUrl}
                        className="px-4 py-2.5 rounded-lg bg-[var(--tulip-forest)] text-[var(--tulip-cream)] text-sm font-medium hover:bg-[var(--tulip-forest)]/90 flex items-center gap-2">
                        <Download size={14} /> Download PDF
                      </a>
                    )}
                    <button onClick={() => openShare(wbResult!)}
                      className="px-4 py-2.5 rounded-lg border border-[var(--tulip-sage-dark)] text-sm font-medium text-[var(--tulip-forest)] hover:bg-[var(--tulip-sage)] flex items-center gap-2">
                      <Link2 size={14} /> Share Link
                    </button>
                    <button onClick={() => { setWbStep(1); setWbResult(null) }}
                      className="px-4 py-2.5 rounded-lg border border-[var(--tulip-sage-dark)] text-sm font-medium text-[var(--tulip-forest)] hover:bg-[var(--tulip-sage)] flex items-center gap-2">
                      <RefreshCw size={14} /> Generate Another
                    </button>
                  </div>
                  {(wbResult.sha256 || wbResult.polygonTx) && (
                    <div className="mt-6 p-4 bg-[var(--tulip-sage)]/50 rounded-lg border border-[var(--tulip-sage-dark)] text-left text-xs space-y-2">
                      <h4 className="font-semibold text-sm text-[var(--tulip-forest)]">Seal Details</h4>
                      {wbResult.sha256 && <InfoField label="SHA-256" value={wbResult.sha256} />}
                      {wbResult.anchorDate && <InfoField label="Anchor Date" value={formatDate(wbResult.anchorDate)} />}
                      {wbResult.polygonTx && <InfoField label="Polygon TX" value={wbResult.polygonTx} />}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  SHARE MODAL                                                  */}
      {/* ============================================================ */}
      {shareReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShareReport(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-[var(--tulip-cream)] rounded-2xl shadow-2xl border border-[var(--tulip-sage-dark)] overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--tulip-sage-dark)]">
              <h2 className="text-base font-bold text-[var(--tulip-forest)]">Share Report</h2>
              <button onClick={() => setShareReport(null)} className="p-1.5 rounded-md hover:bg-[var(--tulip-sage)] transition-colors">
                <X size={18} className="text-[var(--tulip-forest)]/60" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Generate new share */}
              <div>
                <label className="block text-sm font-medium text-[var(--tulip-forest)] mb-2">Create Share Link</label>
                <div className="flex gap-2">
                  <select value={shareExpiry} onChange={e => setShareExpiry(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-cream)] text-sm text-[var(--tulip-forest)] focus:outline-none focus:ring-2 focus:ring-[var(--tulip-forest)]/20">
                    <option value="7">7 days</option>
                    <option value="14">14 days</option>
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                  </select>
                  <button onClick={createShareLink} disabled={shareGenerating}
                    className="px-4 py-2 rounded-lg bg-[var(--tulip-forest)] text-[var(--tulip-cream)] text-sm font-medium hover:bg-[var(--tulip-forest)]/90 flex items-center gap-2 disabled:opacity-50">
                    {shareGenerating ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                    Create Link
                  </button>
                </div>
              </div>

              {/* Existing share links */}
              {shareLinks.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-[var(--tulip-forest)] mb-2">Active Shares</label>
                  <div className="space-y-2">
                    {shareLinks.map(link => (
                      <div key={link.id} className="p-3 bg-[var(--tulip-sage)]/50 rounded-lg border border-[var(--tulip-sage-dark)] text-xs">
                        <div className="flex items-center justify-between mb-2">
                          <button onClick={() => copyShareUrl(link.token)}
                            className="flex items-center gap-1.5 text-[var(--tulip-forest)] hover:text-[var(--tulip-forest)]/80 font-mono text-[10px] truncate max-w-[200px]">
                            {shareCopied ? <Check size={12} className="text-green-600 shrink-0" /> : <Copy size={12} className="shrink-0" />}
                            https://donor.sealayer.io/share/report/{link.token}
                          </button>
                          <button onClick={() => revokeShareLink(link.id)}
                            className="text-red-500 hover:text-red-700 text-xs font-medium">
                            Revoke
                          </button>
                        </div>
                        <div className="flex items-center gap-4 text-[var(--tulip-forest)]/50">
                          <span>Created: {formatDate(link.createdAt)}</span>
                          <span>Expires: {formatDate(link.expiresAt)}</span>
                          <span>Views: {link.views}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[var(--tulip-forest)]/50 text-xs">{label}</span>
      <p className="text-[var(--tulip-forest)] text-sm font-medium break-all">{value || '-'}</p>
    </div>
  )
}

function FormInput({ label, value, onChange, type = 'text', required }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--tulip-forest)] mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} required={required}
        className="w-full px-3 py-2 rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-cream)] text-sm text-[var(--tulip-forest)] focus:outline-none focus:ring-2 focus:ring-[var(--tulip-forest)]/20" />
    </div>
  )
}

function WizardNav({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <div className="mt-6 flex items-center justify-between">
      <button onClick={onBack}
        className="px-4 py-2.5 rounded-lg border border-[var(--tulip-sage-dark)] text-sm font-medium text-[var(--tulip-forest)] hover:bg-[var(--tulip-sage)] transition-all flex items-center gap-2">
        <ArrowLeft size={14} /> Back
      </button>
      <button onClick={onNext}
        className="px-5 py-2.5 rounded-lg bg-[var(--tulip-forest)] text-[var(--tulip-cream)] text-sm font-medium hover:bg-[var(--tulip-forest)]/90 transition-all flex items-center gap-2">
        Continue <ArrowRight size={14} />
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Date helpers for scheduled tab                                     */
/* ------------------------------------------------------------------ */

function nextFirstOfMonth(): string {
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return next.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function nextQuarterStart(): string {
  const now = new Date()
  const currentQ = Math.floor(now.getMonth() / 3)
  const nextQMonth = (currentQ + 1) * 3
  const next = nextQMonth >= 12
    ? new Date(now.getFullYear() + 1, nextQMonth - 12, 1)
    : new Date(now.getFullYear(), nextQMonth, 1)
  return next.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function nextJan1(): string {
  const next = new Date(new Date().getFullYear() + 1, 0, 1)
  return next.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
