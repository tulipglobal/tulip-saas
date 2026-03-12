'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Copy, Check, ExternalLink, Shield, Download, FileText, Image as ImageIcon, CheckCircle, Clock, AlertTriangle } from 'lucide-react'
import QRCode from 'qrcode'

interface SealData {
  id: string
  documentTitle: string
  documentType: string
  issuedTo: string
  issuedBy: string
  rawHash: string
  status: string
  s3Key?: string | null
  fileType?: string | null
  anchorTxHash?: string | null
  anchoredAt?: string | null
  blockNumber?: number | null
  createdAt: string
}

interface MismatchInfo {
  amountMismatch?: boolean
  vendorMismatch?: boolean
  dateMismatch?: boolean
  mismatchNote?: string | null
  ocrAmount?: number | null
  ocrVendor?: string | null
  ocrDate?: string | null
  amount?: number
  vendor?: string | null
}

interface FraudRiskInfo {
  fraudRiskScore?: number | null
  fraudRiskLevel?: string | null
  fraudSignals?: string[] | null
}

interface TrustSealCardProps {
  sealId: string
  onClose: () => void
  mismatch?: MismatchInfo
  fraudRisk?: FraudRiskInfo
}

export default function TrustSealCard({ sealId, onClose, mismatch, fraudRisk }: TrustSealCardProps) {
  const [seal, setSeal] = useState<SealData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [docUrl, setDocUrl] = useState<string | null>(null)
  const [docLoading, setDocLoading] = useState(false)
  const [docError, setDocError] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const verifyUrl = `https://verify.tulipds.com/seal/${sealId}`

  useEffect(() => {
    const token = localStorage.getItem('tulip_token')
    const headers: Record<string, string> = {}
    if (token) headers.Authorization = `Bearer ${token}`
    const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050'

    fetch(`${api}/api/trust-seal/${sealId}`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) { setError('Seal not found'); setLoading(false); return }
        setSeal(data)
        setLoading(false)

        // Get document preview URL if file exists
        if (data.s3Key) {
          setDocLoading(true)
          fetch(`${api}/api/trust-seal/${sealId}/preview-url`, { headers })
            .then(r => r.ok ? r.json() : null)
            .then(d => {
              if (d?.previewUrl) {
                console.log('[TrustSealCard] previewUrl:', d.previewUrl?.substring(0, 120), 'fileType:', d.fileType)
                setDocUrl(d.previewUrl)
              } else {
                console.warn('[TrustSealCard] No previewUrl returned')
                setDocError(true)
              }
              setDocLoading(false)
            })
            .catch((err) => { console.error('[TrustSealCard] preview fetch error:', err); setDocLoading(false); setDocError(true) })
        }
      })
      .catch(() => { setError('Failed to load seal'); setLoading(false) })

    // Generate QR code
    QRCode.toDataURL(verifyUrl, { width: 140, margin: 1, color: { dark: '#183a1d', light: '#fefbe9' } })
      .then(url => setQrDataUrl(url))
      .catch(() => {})
  }, [sealId, verifyUrl])

  const copyHash = useCallback(() => {
    if (!seal) return
    navigator.clipboard.writeText(seal.rawHash)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [seal])

  const downloadSealedPdf = useCallback(async () => {
    setDownloading(true)
    try {
      const token = localStorage.getItem('tulip_token')
      const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050'
      const resp = await fetch(`${api}/api/trust-seal/${sealId}/sealed-pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!resp.ok) throw new Error('Download failed')
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sealed_${seal?.documentTitle?.replace(/[^a-zA-Z0-9_-]/g, '_') || sealId}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Sealed PDF download failed:', err)
    } finally {
      setDownloading(false)
    }
  }, [sealId, seal])

  const isAnchored = seal?.anchorTxHash || seal?.status === 'anchored'
  const ft = (seal?.fileType || '').toLowerCase()
  const isImage = ft.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ft.replace('.', ''))
  const isPdf = ft === 'application/pdf' || ft.replace('.', '') === 'pdf'

  // Close on escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative bg-[#fefbe9] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button onClick={onClose} className="absolute top-4 right-4 z-10 p-1.5 rounded-full bg-[#e1eedd] hover:bg-[#c8d6c0] transition-colors">
          <X size={16} className="text-[#183a1d]/60" />
        </button>

        {loading ? (
          <div className="flex items-center justify-center w-full py-24">
            <div className="w-8 h-8 border-2 border-[#f6c453] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center w-full py-24 text-[#183a1d]/40">{error}</div>
        ) : seal ? (
          <>
            {/* LEFT — Document Preview */}
            <div className="md:w-[55%] bg-[#e1eedd] border-b md:border-b-0 md:border-r border-[#c8d6c0] flex items-center justify-center min-h-[300px] p-6">
              {docLoading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-[#f6c453] border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-[#183a1d]/40">Loading preview…</p>
                </div>
              ) : docUrl && isPdf ? (
                <iframe src={docUrl} className="w-full h-[500px] rounded-lg border border-[#c8d6c0]" title={seal.documentTitle} />
              ) : docUrl && isImage ? (
                <img
                  src={docUrl}
                  alt={seal.documentTitle}
                  crossOrigin="anonymous"
                  className="w-full h-full object-contain max-h-[500px] rounded-lg shadow-sm"
                  onError={() => { console.warn('[TrustSealCard] Image failed to load'); setDocError(true) }}
                />
              ) : docUrl ? (
                <div className="flex flex-col items-center gap-4 text-[#183a1d]/40">
                  <FileText size={56} className="text-[#183a1d]/30" />
                  <p className="text-sm font-medium text-[#183a1d]/60">{seal.documentTitle}</p>
                  <p className="text-xs text-[#183a1d]/40 uppercase">{seal.fileType || seal.documentType}</p>
                  <a href={docUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#f6c453] text-[#183a1d] text-sm font-medium hover:bg-[#f0a04b] transition-colors">
                    <Download size={14} /> Download
                  </a>
                </div>
              ) : docError ? (
                <div className="flex flex-col items-center gap-3 text-[#183a1d]/40">
                  <FileText size={56} className="text-[#183a1d]/30" />
                  <p className="text-sm font-medium text-[#183a1d]/60">Unable to preview</p>
                  <p className="text-xs text-[#183a1d]/40">{seal.documentTitle}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 text-[#183a1d]/40">
                  <FileText size={56} className="text-[#183a1d]/30" />
                  <p className="text-sm font-medium text-[#183a1d]/60">{seal.documentTitle}</p>
                  <p className="text-xs text-[#183a1d]/40 uppercase">{seal.fileType || seal.documentType}</p>
                </div>
              )}
            </div>

            {/* RIGHT — Seal Details */}
            <div className="md:w-[45%] p-6 overflow-y-auto space-y-5">
              {/* Title + type badge */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Shield size={18} className="text-[#183a1d]" />
                  <span className="text-xs font-medium uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#e1eedd] text-[#183a1d] border border-[#c8d6c0]">
                    {seal.documentType.replace(/-/g, ' ')}
                  </span>
                </div>
                <h2 className="text-lg font-semibold text-[#183a1d] mt-2">{seal.documentTitle}</h2>
              </div>

              {/* Issuer / Recipient */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-[#183a1d]/40 uppercase tracking-wide mb-0.5">Issued by</p>
                  <p className="text-sm font-medium text-[#183a1d]">{seal.issuedBy}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#183a1d]/40 uppercase tracking-wide mb-0.5">Issued to</p>
                  <p className="text-sm font-medium text-[#183a1d]">{seal.issuedTo}</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] text-[#183a1d]/40 uppercase tracking-wide mb-0.5">Issue date</p>
                <p className="text-sm text-[#183a1d]">{new Date(seal.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              </div>

              {/* Blockchain status */}
              <div className="rounded-xl border border-[#c8d6c0] p-4 space-y-3 bg-[#e1eedd]/50">
                <div className="flex items-center gap-2">
                  {isAnchored ? (
                    <span className="flex items-center gap-1.5 text-sm font-medium text-green-600">
                      <CheckCircle size={15} /> Confirmed on Polygon
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-sm font-medium text-[#f0a04b]">
                      <Clock size={15} /> Pending Anchor
                    </span>
                  )}
                </div>

                {/* SHA-256 */}
                <div>
                  <p className="text-[10px] text-[#183a1d]/40 uppercase tracking-wide mb-1">SHA-256 Hash</p>
                  <div className="flex items-center gap-2">
                    <code className="text-[11px] text-[#183a1d] bg-[#fefbe9] px-2 py-1 rounded border border-[#c8d6c0] break-all flex-1 font-mono">
                      {seal.rawHash}
                    </code>
                    <button onClick={copyHash} className="p-1 rounded hover:bg-[#c8d6c0] transition-colors shrink-0">
                      {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} className="text-[#183a1d]/40" />}
                    </button>
                  </div>
                </div>

                {/* TX hash */}
                {seal.anchorTxHash && (
                  <div>
                    <p className="text-[10px] text-[#183a1d]/40 uppercase tracking-wide mb-1">Transaction</p>
                    <a href={`https://polygonscan.com/tx/${seal.anchorTxHash}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[11px] text-[#183a1d] hover:text-[#f0a04b] font-mono">
                      {seal.anchorTxHash.slice(0, 16)}...{seal.anchorTxHash.slice(-8)}
                      <ExternalLink size={11} />
                    </a>
                  </div>
                )}

                {seal.anchoredAt && (
                  <div>
                    <p className="text-[10px] text-[#183a1d]/40 uppercase tracking-wide mb-0.5">Anchored at</p>
                    <p className="text-xs text-[#183a1d]/60">{new Date(seal.anchoredAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                )}
              </div>

              {/* Mismatch warnings */}
              {mismatch && (mismatch.amountMismatch || mismatch.vendorMismatch || mismatch.dateMismatch) && (
                <div className="rounded-xl border border-orange-300 p-4 space-y-2 bg-orange-50">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-orange-600">
                      <AlertTriangle size={15} /> OCR Mismatch
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs text-orange-700">
                    {mismatch.amountMismatch && (
                      <p>Amount altered: OCR read <strong>{mismatch.ocrAmount?.toLocaleString()}</strong>, saved as <strong>{mismatch.amount?.toLocaleString()}</strong></p>
                    )}
                    {mismatch.vendorMismatch && (
                      <p>Vendor altered: OCR read <strong>&quot;{mismatch.ocrVendor}&quot;</strong>, saved as <strong>&quot;{mismatch.vendor}&quot;</strong></p>
                    )}
                    {mismatch.dateMismatch && (
                      <p>Date altered: OCR read <strong>{mismatch.ocrDate}</strong>, expense date differs by 30+ days</p>
                    )}
                  </div>
                </div>
              )}

              {/* Fraud Risk */}
              {fraudRisk && fraudRisk.fraudRiskScore != null && fraudRisk.fraudRiskScore > 0 && (
                <div className={`rounded-xl border p-4 space-y-2 ${
                  fraudRisk.fraudRiskLevel === 'CRITICAL' ? 'border-red-400 bg-red-50' :
                  fraudRisk.fraudRiskLevel === 'HIGH' ? 'border-orange-400 bg-orange-50' :
                  fraudRisk.fraudRiskLevel === 'MEDIUM' ? 'border-yellow-400 bg-yellow-50' :
                  'border-gray-200 bg-gray-50'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`flex items-center gap-1.5 text-sm font-bold ${
                      fraudRisk.fraudRiskLevel === 'CRITICAL' ? 'text-red-700' :
                      fraudRisk.fraudRiskLevel === 'HIGH' ? 'text-orange-700' :
                      fraudRisk.fraudRiskLevel === 'MEDIUM' ? 'text-yellow-700' :
                      'text-gray-700'
                    }`}>
                      <AlertTriangle size={15} /> Fraud Risk: {fraudRisk.fraudRiskLevel}
                    </span>
                    <span className={`text-lg font-bold ${
                      fraudRisk.fraudRiskLevel === 'CRITICAL' ? 'text-red-700' :
                      fraudRisk.fraudRiskLevel === 'HIGH' ? 'text-orange-700' :
                      fraudRisk.fraudRiskLevel === 'MEDIUM' ? 'text-yellow-700' :
                      'text-gray-700'
                    }`}>{fraudRisk.fraudRiskScore}/100</span>
                  </div>
                  {fraudRisk.fraudSignals && fraudRisk.fraudSignals.length > 0 && (
                    <ul className="space-y-0.5 text-xs text-gray-600">
                      {fraudRisk.fraudSignals.map((signal, i) => (
                        <li key={i} className="flex items-start gap-1">
                          <span className="mt-0.5 shrink-0">•</span>
                          <span>{signal}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* QR Code */}
              <div className="flex flex-col items-center gap-2 py-2">
                {qrDataUrl && <img src={qrDataUrl} alt="Verify QR" className="w-[120px] h-[120px]" />}
                <a href={verifyUrl} target="_blank" rel="noopener noreferrer"
                  className="text-[11px] text-[#183a1d] hover:text-[#f0a04b] hover:underline font-mono">
                  {verifyUrl}
                </a>
              </div>

              {/* Download Seal PDF */}
              <button
                onClick={downloadSealedPdf}
                disabled={downloading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#f6c453] text-[#183a1d] text-sm font-medium hover:bg-[#f0a04b] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {downloading ? (
                  <div className="w-4 h-4 border-2 border-[#183a1d] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Download size={15} />
                )}
                {downloading ? 'Generating...' : 'Download Seal PDF'}
              </button>

              {/* Footer */}
              <div className="border-t border-[#c8d6c0] pt-3 flex items-center justify-center gap-2 text-xs text-[#183a1d]/40">
                <Shield size={12} className="text-[#183a1d]" />
                <span>Verified by <strong className="text-[#183a1d]">Tulip DS</strong></span>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
