'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { apiGet, apiPost } from '../../lib/api'
import Link from 'next/link'
import ReportShareModal from '../../components/ReportShareModal'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

// ── Types ────────────────────────────────────────────────────
interface Project {
  id: string
  name: string
  tenantName?: string
}

interface SavedReport {
  id: string
  name: string
  createdAt: string
  projects: string[]
  projectNames?: string[]
  sections: string[]
  downloadUrl?: string
}

interface ArchiveReport {
  id: string
  name: string
  type: string
  projectName: string
  periodStart: string | null
  periodEnd: string | null
  generatedAt: string
  generatedBy: string | null
  downloadUrl: string | null
}

// ── Type pill styles ─────────────────────────────────────────
const TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  Monthly: { bg: '#EFF6FF', text: '#1D4ED8' },
  Quarterly: { bg: '#F3E8FF', text: '#7C3AED' },
  Annual: { bg: '#F0FDF4', text: '#166534' },
  Interim: { bg: '#FFFBEB', text: '#92400E' },
  Closing: { bg: '#FEF2F2', text: '#991B1B' },
  USAID: { bg: '#EEF2FF', text: '#4338CA' },
  EU: { bg: '#EFF6FF', text: '#1D4ED8' },
  DFID: { bg: '#F0FDFA', text: '#0F766E' },
  WB: { bg: '#F1F5F9', text: '#475569' },
}

function TypePill({ type }: { type: string }) {
  const s = TYPE_STYLES[type] || { bg: '#F1F5F9', text: '#475569' }
  return (
    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap" style={{ background: s.bg, color: s.text }}>
      {type}
    </span>
  )
}

// ── Date helpers ─────────────────────────────────────────────
function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '--'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return '--'
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function dateOffset(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}

function startOfYear(): string {
  const d = new Date()
  return `${d.getFullYear()}-01-01`
}

function today(): string {
  return new Date().toISOString().split('T')[0]
}

// ── Main Page ────────────────────────────────────────────────
export default function ReportsPage() {
  const t = useTranslations()

  // ── Section definitions (inside component for i18n) ──────
  const allSections = [
    { key: 'expense_summary', label: t('reports.expenseSummary'), defaultChecked: true },
    { key: 'budget_vs_actual', label: t('reports.budgetVsActual'), defaultChecked: true },
    { key: 'impact_milestones', label: t('reports.impactMilestones'), defaultChecked: true },
    { key: 'deliverable_requests', label: t('reports.deliverableRequests'), defaultChecked: true },
    { key: 'blockchain_seals', label: t('reports.blockchainSeals'), defaultChecked: true },
    { key: 'fraud_risk_summary', label: t('reports.fraudRiskSummary'), defaultChecked: false },
    { key: 'funding_breakdown', label: t('reports.fundingBreakdown'), defaultChecked: false },
  ]

  // ── Filter tabs (inside component for i18n) ───────────────
  const FILTER_TABS = [
    { key: 'All', label: t('reports.filterAll') },
    { key: 'Monthly', label: t('reports.filterMonthly') },
    { key: 'Quarterly', label: t('reports.filterQuarterly') },
    { key: 'Annual', label: t('reports.filterAnnual') },
    { key: 'Institutional', label: t('reports.filterInstitutional') },
  ]

  // Archive state
  const [archiveReports, setArchiveReports] = useState<ArchiveReport[]>([])
  const [archiveLoading, setArchiveLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState('All')

  // Share modal state
  const [shareReportId, setShareReportId] = useState<string | null>(null)

  // Builder state
  const [showBuilder, setShowBuilder] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [savedReports, setSavedReports] = useState<SavedReport[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState<{ downloadUrl: string; sections: Record<string, any> } | null>(null)

  // Form state
  const [reportName, setReportName] = useState('')
  const [dateFrom, setDateFrom] = useState(dateOffset(30))
  const [dateTo, setDateTo] = useState(today())
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set())
  const [selectedSections, setSelectedSections] = useState<Set<string>>(
    new Set(allSections.filter(s => s.defaultChecked).map(s => s.key))
  )

  // Load archive reports
  useEffect(() => {
    setArchiveLoading(true)
    apiGet('/api/donor/reports')
      .then(async r => {
        if (r.ok) {
          const d = await r.json()
          setArchiveReports(d.reports || [])
        }
      })
      .catch(() => {})
      .finally(() => setArchiveLoading(false))
  }, [])

  // Load projects and saved reports for builder
  useEffect(() => {
    Promise.all([
      apiGet('/api/donor/projects').then(async r => {
        if (r.ok) {
          const d = await r.json()
          const ngos = d.ngos || []
          const allProjects: Project[] = ngos.flatMap((n: any) => (n.projects || []).map((p: any) => ({ id: p.id, name: p.name, tenantName: n.tenantName })))
          setProjects(allProjects)
          setSelectedProjects(new Set(allProjects.map(p => p.id)))
        }
      }),
      apiGet('/api/donor/reports/saved').then(async r => {
        if (r.ok) {
          const d = await r.json()
          setSavedReports(d.reports || [])
        }
      }).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  // Quick select date range
  const quickSelect = useCallback((range: string) => {
    const t = today()
    if (range === '30d') { setDateFrom(dateOffset(30)); setDateTo(t) }
    else if (range === '3m') { setDateFrom(dateOffset(90)); setDateTo(t) }
    else if (range === '6m') { setDateFrom(dateOffset(180)); setDateTo(t) }
    else if (range === 'year') { setDateFrom(startOfYear()); setDateTo(t) }
  }, [])

  // Toggle project
  const toggleProject = useCallback((id: string) => {
    setSelectedProjects(prev => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id); else s.add(id)
      return s
    })
  }, [])

  // Toggle section
  const toggleSection = useCallback((key: string) => {
    setSelectedSections(prev => {
      const s = new Set(prev)
      if (s.has(key)) s.delete(key); else s.add(key)
      return s
    })
  }, [])

  // Generate report
  const generateReport = useCallback(async () => {
    if (selectedProjects.size === 0 || selectedSections.size === 0) return
    setGenerating(true)
    setGenerated(null)
    try {
      const r = await apiPost('/api/donor/reports/generate', {
        name: reportName.trim() || `Report ${fmtDate(new Date())}`,
        dateFrom,
        dateTo,
        projectIds: Array.from(selectedProjects),
        sections: Array.from(selectedSections),
      })
      if (r.ok) {
        const d = await r.json()
        setGenerated({ downloadUrl: d.downloadUrl || d.reportUrl || '', sections: d.sections || {} })
        // Refresh saved reports + archive
        apiGet('/api/donor/reports/saved').then(async sr => {
          if (sr.ok) { const sd = await sr.json(); setSavedReports(sd.reports || []) }
        }).catch(() => {})
        apiGet('/api/donor/reports').then(async ar => {
          if (ar.ok) { const ad = await ar.json(); setArchiveReports(ad.reports || []) }
        }).catch(() => {})
      } else {
        const d = await r.json().catch(() => ({ error: t('reports.reportGenerationFailed') }))
        alert(d.error || t('reports.reportGenerationFailed'))
      }
    } catch {
      alert(t('reports.networkErrorServer'))
    }
    setGenerating(false)
  }, [reportName, dateFrom, dateTo, selectedProjects, selectedSections, t])

  // Regenerate saved report
  const regenerateReport = useCallback(async (report: SavedReport) => {
    setGenerating(true)
    setGenerated(null)
    try {
      const r = await apiPost('/api/donor/reports/generate', {
        name: report.name,
        projectIds: report.projects,
        sections: report.sections,
      })
      if (r.ok) {
        const d = await r.json()
        setGenerated({ downloadUrl: d.downloadUrl || '', sections: d.sections || {} })
      }
    } catch {}
    setGenerating(false)
  }, [])

  // Download report
  const handleDownload = (reportId: string) => {
    apiGet(`/api/donor/reports/${reportId}/download`)
      .then(async r => {
        if (r.ok) {
          const d = await r.json()
          if (d.url) {
            window.open(d.url, '_blank')
          }
        }
      })
      .catch(() => {})
  }

  // Filter archive reports
  const filteredReports = activeFilter === 'All'
    ? archiveReports
    : activeFilter === 'Institutional'
      ? archiveReports.filter(r => ['USAID', 'EU', 'DFID', 'WB'].includes(r.type))
      : archiveReports.filter(r => r.type === activeFilter)

  if (loading && archiveLoading) {
    return (
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div className="h-8 w-48 rounded animate-skeleton-pulse" />
        <div className="h-64 rounded-2xl animate-skeleton-pulse" />
        <div className="h-48 rounded-2xl animate-skeleton-pulse" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 animate-fade-up max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="text-[13px] flex items-center gap-1" style={{ color: 'var(--donor-muted)' }}>
        <Link href="/dashboard" className="hover:underline">{t('reports.breadcrumbHome')}</Link>
        <span>&gt;</span>
        <span style={{ color: 'var(--donor-dark)' }}>{t('reports.breadcrumbReports')}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--donor-dark)' }}>{t('reports.title')}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--donor-muted)' }}>{t('reports.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowBuilder(!showBuilder)}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all shrink-0"
          style={{ background: 'var(--donor-accent)' }}
        >
          {showBuilder ? t('reports.hideBuilder') : t('reports.buildReport')}
        </button>
      </div>

      {/* ── Reports Archive ────────────────────────────────── */}

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {FILTER_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className="px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={{
              background: activeFilter === tab.key ? 'var(--donor-accent)' : 'var(--donor-light)',
              color: activeFilter === tab.key ? '#FFFFFF' : 'var(--donor-accent)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Archive table */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
        {archiveLoading ? (
          <div className="px-8 py-12 text-center">
            <div className="inline-block w-6 h-6 border-2 border-[var(--donor-accent)] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm mt-3" style={{ color: 'var(--donor-muted)' }}>{t('reports.loadingReports')}</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="px-8 py-12 text-center">
            <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="var(--donor-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 opacity-50">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <p className="text-sm font-medium" style={{ color: 'var(--donor-dark)' }}>{t('reports.noReportsFound')}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--donor-muted)' }}>
              {activeFilter !== 'All' ? t('reports.tryDifferentFilter') : ''}{t('reports.useBuilderToGenerate')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--donor-light)' }}>
                  <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('reports.report')}</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('reports.project')}</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('reports.period')}</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('reports.generated')}</th>
                  <th className="text-center px-4 py-2.5 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('reports.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map(report => (
                  <tr key={report.id} className="border-t" style={{ borderColor: 'var(--donor-border)' }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <TypePill type={report.type} />
                        <span className="font-medium" style={{ color: 'var(--donor-dark)' }}>{report.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--donor-dark)' }}>{report.projectName}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--donor-muted)' }}>
                      {fmtDate(report.periodStart)} &mdash; {fmtDate(report.periodEnd)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs" style={{ color: 'var(--donor-dark)' }}>{fmtDate(report.generatedAt)}</span>
                      <br />
                      <span className="text-[11px]" style={{ color: 'var(--donor-muted)' }}>
                        {report.generatedBy ? `by ${report.generatedBy}` : t('reports.autoGenerated')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleDownload(report.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                          style={{ background: 'var(--donor-light)', color: 'var(--donor-accent)' }}
                          title={t('reports.download')}
                        >
                          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                          {t('reports.download')}
                        </button>
                        <button
                          onClick={() => setShareReportId(report.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                          style={{ background: 'var(--donor-light)', color: 'var(--donor-accent)' }}
                          title={t('reports.shareLink')}
                        >
                          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                          {t('reports.shareLink')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Report Builder (Collapsible) ──────────────────── */}
      {showBuilder && (
        <>
          <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
            <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--donor-border)' }}>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--donor-dark)' }}>{t('reports.reportBuilder')}</h2>
            </div>
            <div className="p-5 space-y-5">
              {/* Report name */}
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--donor-muted)' }}>{t('reports.reportName')}</label>
                <input
                  type="text"
                  value={reportName}
                  onChange={e => setReportName(e.target.value)}
                  placeholder={t('reports.reportNamePlaceholder')}
                  className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[var(--donor-accent)]"
                  style={{ borderColor: 'var(--donor-border)', color: 'var(--donor-dark)' }}
                />
              </div>

              {/* Date range */}
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--donor-muted)' }}>{t('reports.dateRange')}</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {[
                    { key: '30d', label: t('reports.last30Days') },
                    { key: '3m', label: t('reports.threeMonths') },
                    { key: '6m', label: t('reports.sixMonths') },
                    { key: 'year', label: t('reports.thisYear') },
                  ].map(q => (
                    <button key={q.key} onClick={() => quickSelect(q.key)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={{ background: 'var(--donor-light)', color: 'var(--donor-accent)' }}>
                      {q.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm" style={{ borderColor: 'var(--donor-border)', color: 'var(--donor-dark)' }} />
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm" style={{ borderColor: 'var(--donor-border)', color: 'var(--donor-dark)' }} />
                </div>
              </div>

              {/* Project selection */}
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--donor-muted)' }}>{t('reports.projectsLabel')}</label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {projects.map(p => (
                    <label key={p.id} className="flex items-center gap-2 cursor-pointer text-sm hover:bg-[var(--donor-light)] rounded-lg px-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={selectedProjects.has(p.id)}
                        onChange={() => toggleProject(p.id)}
                        className="rounded"
                        style={{ accentColor: 'var(--donor-accent)' }}
                      />
                      <span style={{ color: 'var(--donor-dark)' }}>{p.name}</span>
                      {p.tenantName && <span className="text-xs" style={{ color: 'var(--donor-muted)' }}>({p.tenantName})</span>}
                    </label>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => setSelectedProjects(new Set(projects.map(p => p.id)))} className="text-xs font-medium hover:underline" style={{ color: 'var(--donor-accent)' }}>{t('reports.selectAll')}</button>
                  <button onClick={() => setSelectedProjects(new Set())} className="text-xs font-medium hover:underline" style={{ color: 'var(--donor-muted)' }}>{t('reports.clearAll')}</button>
                </div>
              </div>

              {/* Section selection */}
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--donor-muted)' }}>{t('reports.reportSections')}</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {allSections.map(s => (
                    <label key={s.key} className="flex items-center gap-2 cursor-pointer text-sm hover:bg-[var(--donor-light)] rounded-lg px-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={selectedSections.has(s.key)}
                        onChange={() => toggleSection(s.key)}
                        className="rounded"
                        style={{ accentColor: 'var(--donor-accent)' }}
                      />
                      <span style={{ color: 'var(--donor-dark)' }}>{s.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Generate button */}
              <button
                onClick={generateReport}
                disabled={generating || selectedProjects.size === 0 || selectedSections.size === 0}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                style={{ background: 'var(--donor-accent)' }}
              >
                {generating ? t('reports.buildingReport') : t('reports.generateReport')}
              </button>
            </div>
          </div>

          {/* Generated result */}
          {generating && (
            <div className="rounded-2xl border px-8 py-12 text-center" style={{ background: 'var(--donor-light)', borderColor: 'var(--donor-border)' }}>
              <div className="animate-spin w-8 h-8 border-3 border-[var(--donor-accent)] border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-sm font-medium" style={{ color: 'var(--donor-dark)' }}>{t('reports.buildingReport')}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--donor-muted)' }}>{t('reports.mayTakeMoments')}</p>
            </div>
          )}

          {generated && !generating && (
            <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
              <div className="px-5 py-4 flex flex-col items-center gap-4 text-center">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'var(--donor-light)' }}>
                  <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="var(--donor-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-semibold" style={{ color: 'var(--donor-dark)' }}>{t('reports.reportGeneratedSuccess')}</h2>
                  <p className="text-xs mt-1" style={{ color: 'var(--donor-muted)' }}>{t('reports.pdfReady')}</p>
                </div>
                {generated.downloadUrl && (
                  <a href={generated.downloadUrl.startsWith('http') ? generated.downloadUrl : `${API_URL}${generated.downloadUrl}`}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                    style={{ background: 'var(--donor-accent)' }}>
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    {t('reports.downloadPdf')}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Saved Reports */}
          {savedReports.length > 0 && (
            <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
              <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--donor-border)' }}>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--donor-dark)' }}>{t('reports.savedReports')}</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'var(--donor-light)' }}>
                      <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('reports.name')}</th>
                      <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('reports.date')}</th>
                      <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('reports.projectsLabel')}</th>
                      <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('reports.sections')}</th>
                      <th className="text-center px-4 py-2 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--donor-muted)' }}>{t('reports.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedReports.map(report => (
                      <tr key={report.id} className="border-t" style={{ borderColor: 'var(--donor-border)' }}>
                        <td className="px-4 py-3 font-medium" style={{ color: 'var(--donor-dark)' }}>{report.name}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--donor-muted)' }}>{fmtDate(report.createdAt)}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--donor-muted)' }}>
                          {(report.projectNames || []).join(', ') || `${(report.projects || []).length} project${(report.projects || []).length !== 1 ? 's' : ''}`}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--donor-muted)' }}>{(report.sections || []).length} sections</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {report.downloadUrl && (
                              <a href={`${API_URL}${report.downloadUrl}`} target="_blank" rel="noopener noreferrer"
                                className="px-2.5 py-1 rounded-lg text-xs font-medium" style={{ background: 'var(--donor-light)', color: 'var(--donor-accent)' }}>
                                {t('reports.download')}
                              </a>
                            )}
                            <button
                              onClick={() => regenerateReport(report)}
                              disabled={generating}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium disabled:opacity-50"
                              style={{ background: 'var(--donor-light)', color: 'var(--donor-accent)' }}>
                              {t('reports.regenerate')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Share Modal */}
      {shareReportId && (
        <ReportShareModal
          reportId={shareReportId}
          open={true}
          onClose={() => setShareReportId(null)}
        />
      )}
    </div>
  )
}
