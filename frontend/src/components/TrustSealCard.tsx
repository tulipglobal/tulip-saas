'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Copy, Check, ExternalLink, Shield, Download, FileText, Image as ImageIcon, CheckCircle, Clock } from 'lucide-react'
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

interface TrustSealCardProps {
  sealId: string
  onClose: () => void
}

export default function TrustSealCard({ sealId, onClose }: TrustSealCardProps) {
  const [seal, setSeal] = useState<SealData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [docUrl, setDocUrl] = useState<string | null>(null)
  const [docLoading, setDocLoading] = useState(false)
  const [docError, setDocError] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

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
    QRCode.toDataURL(verifyUrl, { width: 140, margin: 1, color: { dark: '#0c7aed', light: '#FFFFFF' } })
      .then(url => setQrDataUrl(url))
      .catch(() => {})
  }, [sealId, verifyUrl])

  const copyHash = useCallback(() => {
    if (!seal) return
    navigator.clipboard.writeText(seal.rawHash)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [seal])

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
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button onClick={onClose} className="absolute top-4 right-4 z-10 p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
          <X size={16} className="text-gray-500" />
        </button>

        {loading ? (
          <div className="flex items-center justify-center w-full py-24">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center w-full py-24 text-gray-400">{error}</div>
        ) : seal ? (
          <>
            {/* LEFT — Document Preview */}
            <div className="md:w-[55%] bg-gray-50 border-b md:border-b-0 md:border-r border-gray-200 flex items-center justify-center min-h-[300px] p-6">
              {docLoading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-gray-400">Loading preview…</p>
                </div>
              ) : docUrl && isPdf ? (
                <iframe src={docUrl} className="w-full h-[500px] rounded-lg border border-gray-200" title={seal.documentTitle} />
              ) : docUrl && isImage ? (
                <img
                  src={docUrl}
                  alt={seal.documentTitle}
                  crossOrigin="anonymous"
                  className="w-full h-full object-contain max-h-[500px] rounded-lg shadow-sm"
                  onError={() => { console.warn('[TrustSealCard] Image failed to load'); setDocError(true) }}
                />
              ) : docUrl ? (
                <div className="flex flex-col items-center gap-4 text-gray-400">
                  <FileText size={56} className="text-gray-300" />
                  <p className="text-sm font-medium text-gray-500">{seal.documentTitle}</p>
                  <p className="text-xs text-gray-400 uppercase">{seal.fileType || seal.documentType}</p>
                  <a href={docUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors">
                    <Download size={14} /> Download
                  </a>
                </div>
              ) : docError ? (
                <div className="flex flex-col items-center gap-3 text-gray-400">
                  <FileText size={56} className="text-gray-300" />
                  <p className="text-sm font-medium text-gray-500">Unable to preview</p>
                  <p className="text-xs text-gray-400">{seal.documentTitle}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 text-gray-400">
                  <FileText size={56} className="text-gray-300" />
                  <p className="text-sm font-medium text-gray-500">{seal.documentTitle}</p>
                  <p className="text-xs text-gray-400 uppercase">{seal.fileType || seal.documentType}</p>
                </div>
              )}
            </div>

            {/* RIGHT — Seal Details */}
            <div className="md:w-[45%] p-6 overflow-y-auto space-y-5">
              {/* Title + type badge */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Shield size={18} className="text-blue-600" />
                  <span className="text-xs font-medium uppercase tracking-wide px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                    {seal.documentType.replace(/-/g, ' ')}
                  </span>
                </div>
                <h2 className="text-lg font-semibold text-gray-900 mt-2">{seal.documentTitle}</h2>
              </div>

              {/* Issuer / Recipient */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Issued by</p>
                  <p className="text-sm font-medium text-gray-700">{seal.issuedBy}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Issued to</p>
                  <p className="text-sm font-medium text-gray-700">{seal.issuedTo}</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Issue date</p>
                <p className="text-sm text-gray-700">{new Date(seal.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              </div>

              {/* Blockchain status */}
              <div className="rounded-xl border border-gray-200 p-4 space-y-3 bg-gray-50/50">
                <div className="flex items-center gap-2">
                  {isAnchored ? (
                    <span className="flex items-center gap-1.5 text-sm font-medium text-green-600">
                      <CheckCircle size={15} /> Confirmed on Polygon
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-sm font-medium text-yellow-600">
                      <Clock size={15} /> Pending Anchor
                    </span>
                  )}
                </div>

                {/* SHA-256 */}
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">SHA-256 Hash</p>
                  <div className="flex items-center gap-2">
                    <code className="text-[11px] text-gray-600 bg-white px-2 py-1 rounded border border-gray-200 break-all flex-1 font-mono">
                      {seal.rawHash}
                    </code>
                    <button onClick={copyHash} className="p-1 rounded hover:bg-gray-200 transition-colors shrink-0">
                      {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} className="text-gray-400" />}
                    </button>
                  </div>
                </div>

                {/* TX hash */}
                {seal.anchorTxHash && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Transaction</p>
                    <a href={`https://polygonscan.com/tx/${seal.anchorTxHash}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[11px] text-blue-600 hover:text-blue-700 font-mono">
                      {seal.anchorTxHash.slice(0, 16)}...{seal.anchorTxHash.slice(-8)}
                      <ExternalLink size={11} />
                    </a>
                  </div>
                )}

                {seal.anchoredAt && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Anchored at</p>
                    <p className="text-xs text-gray-500">{new Date(seal.anchoredAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                )}
              </div>

              {/* QR Code */}
              <div className="flex flex-col items-center gap-2 py-2">
                {qrDataUrl && <img src={qrDataUrl} alt="Verify QR" className="w-[120px] h-[120px]" />}
                <a href={verifyUrl} target="_blank" rel="noopener noreferrer"
                  className="text-[11px] text-blue-600 hover:text-blue-700 hover:underline font-mono">
                  {verifyUrl}
                </a>
              </div>

              {/* Footer */}
              <div className="border-t border-gray-200 pt-3 flex items-center justify-center gap-2 text-xs text-gray-400">
                <Shield size={12} className="text-blue-500" />
                <span>Verified by <strong className="text-gray-600">Tulip DS</strong></span>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
