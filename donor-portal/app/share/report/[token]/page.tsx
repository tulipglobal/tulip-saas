'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

interface SharedReportData {
  reportName: string
  reportType: string
  projectName: string
  periodStart: string | null
  periodEnd: string | null
  generatedAt: string
  generatedBy: string | null
  sharedBy: string | null
  downloadUrl: string | null
  sealStatus: string | null
  polygonTxHash: string | null
  viewCount: number
}

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '\u2014'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return '\u2014'
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

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
    <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: s.bg, color: s.text }}>
      {type}
    </span>
  )
}

export default function PublicReportSharePage() {
  const params = useParams()
  const token = params?.token as string

  const [data, setData] = useState<SharedReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    fetch(`${API_URL}/api/public/reports/${token}`)
      .then(async r => {
        if (r.ok) {
          setData(await r.json())
        } else {
          const err = await r.json().catch(() => ({ error: 'Failed to load' }))
          setError(err.error || 'Failed to load shared report')
        }
        setLoading(false)
      })
      .catch(() => {
        setError('Network error')
        setLoading(false)
      })
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <div className="text-center space-y-3">
          <div className="inline-block w-8 h-8 border-3 border-[var(--donor-accent)] border-t-transparent rounded-full animate-spin" style={{ borderWidth: 3 }} />
          <p className="text-sm" style={{ color: 'var(--donor-muted)' }}>Loading shared report...</p>
        </div>
      </div>
    )
  }

  if (error) {
    const isExpired = error.toLowerCase().includes('expired')
    const isRevoked = error.toLowerCase().includes('revoked')
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <div className="text-center space-y-4 max-w-md mx-auto px-6">
          <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center" style={{ background: '#FEE2E2' }}>
            <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--donor-dark)' }}>
            {isExpired ? 'Link Expired' : isRevoked ? 'Link Revoked' : 'Link Not Found'}
          </h1>
          <p className="text-sm" style={{ color: 'var(--donor-muted)' }}>{error}</p>
          <p className="text-xs" style={{ color: 'var(--donor-muted)' }}>
            Contact the person who shared this link for a new one.
          </p>
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      {/* Header */}
      <header className="border-b" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--donor-accent)' }}>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <span className="text-sm font-bold" style={{ color: 'var(--donor-dark)' }}>Sealayer</span>
              <span className="text-xs ml-2" style={{ color: 'var(--donor-muted)' }}>Shared Report</span>
            </div>
          </div>
          {data.sharedBy && (
            <span className="text-xs" style={{ color: 'var(--donor-muted)' }}>Report shared by {data.sharedBy}</span>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-8 space-y-6">
        {/* Report details card */}
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
          <div className="px-6 py-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <TypePill type={data.reportType} />
                  <h1 className="text-xl font-bold" style={{ color: 'var(--donor-dark)' }}>{data.reportName}</h1>
                </div>
                <p className="text-sm" style={{ color: 'var(--donor-muted)' }}>
                  Project: <span className="font-medium" style={{ color: 'var(--donor-dark)' }}>{data.projectName}</span>
                </p>
              </div>
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>Period</p>
                <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--donor-dark)' }}>
                  {fmtDate(data.periodStart)} &mdash; {fmtDate(data.periodEnd)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>Generated</p>
                <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--donor-dark)' }}>
                  {fmtDate(data.generatedAt)}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--donor-muted)' }}>
                  {data.generatedBy || 'Auto-generated'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>Report Type</p>
                <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--donor-dark)' }}>{data.reportType}</p>
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--donor-muted)' }}>Views</p>
                <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--donor-dark)' }}>
                  {data.viewCount} view{data.viewCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Seal status */}
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
          <div className="px-6 py-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{
                background: data.sealStatus === 'sealed' ? '#F0FDF4' : '#FFFBEB',
              }}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={data.sealStatus === 'sealed' ? '#166534' : '#92400E'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--donor-dark)' }}>
                  {data.sealStatus === 'sealed' ? 'Blockchain Sealed' : 'Seal Pending'}
                </p>
                <p className="text-xs" style={{ color: 'var(--donor-muted)' }}>
                  {data.sealStatus === 'sealed'
                    ? 'This report has been cryptographically sealed on the Polygon blockchain.'
                    : 'This report is awaiting blockchain anchoring.'}
                </p>
              </div>
            </div>
            {data.polygonTxHash && (
              <div className="mt-2 pl-11">
                <p className="text-xs" style={{ color: 'var(--donor-muted)' }}>Transaction:</p>
                <a
                  href={`https://polygonscan.com/tx/${data.polygonTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono break-all hover:underline"
                  style={{ color: 'var(--donor-accent)' }}
                >
                  {data.polygonTxHash}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Download button */}
        {data.downloadUrl && (
          <div className="flex justify-center">
            <a
              href={`${API_URL}${data.downloadUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: 'var(--donor-accent)' }}
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download Report PDF
            </a>
          </div>
        )}

        {/* Verification notice */}
        <div className="rounded-xl border px-5 py-4 text-center" style={{ background: 'var(--donor-light)', borderColor: 'var(--donor-border)' }}>
          <p className="text-xs" style={{ color: 'var(--donor-muted)' }}>
            This report is blockchain-sealed. Verify at{' '}
            <a
              href="https://verify.sealayer.io"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium hover:underline"
              style={{ color: 'var(--donor-accent)' }}
            >
              verify.sealayer.io
            </a>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto" style={{ borderColor: 'var(--donor-border)' }}>
        <div className="max-w-4xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: 'var(--donor-accent)' }}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <span className="text-xs font-medium" style={{ color: 'var(--donor-dark)' }}>Powered by Sealayer.io</span>
          </div>
          <span className="text-xs" style={{ color: 'var(--donor-muted)' }}>
            Read-only view
          </span>
        </div>
      </footer>
    </div>
  )
}
