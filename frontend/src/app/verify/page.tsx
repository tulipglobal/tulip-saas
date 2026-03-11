'use client'
import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Shield, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp,
  FileText, Upload, Hash, Copy, Check, ExternalLink, Download, Archive,
  Building2, Calendar, Globe, Lock, AlertTriangle
} from 'lucide-react'

/* ─── Types ──────────────────────────────────────────────── */
interface VerifyResult {
  verified: boolean
  dataHash: string
  documentHash?: boolean
  documentId?: string
  batchId?: string
  entityType?: string
  entityId?: string
  action?: string
  recordedAt?: string
  entityDetails?: {
    organisationName?: string
    organisationType?: string
    documentName?: string
    fileType?: string
    projectName?: string
    expenseDescription?: string
    amount?: number
    currency?: string
    budget?: number
    status?: string
  }
  integrity?: {
    hashRecomputed?: string
    hashIntact?: boolean
    chainIntact?: boolean
    chainBreakReason?: string
  }
  blockchain?: {
    network?: string
    txHash?: string
    blockNumber?: number
    blockHash?: string
    anchorStatus?: string
    ancheredAt?: string
    onChainConfirmed?: boolean
    blockNumberMatch?: boolean
    onChainDetail?: string
  }
  audit?: { tenantId?: string; userId?: string }
  reason?: string
}

/* ─── SHA-256 in browser ─────────────────────────────────── */
async function sha256File(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/* ─── PDF Certificate Generator ──────────────────────────── */
async function generateCertificate(result: VerifyResult, fileName?: string) {
  const { jsPDF } = await import('jspdf')
  const QRCode = (await import('qrcode')).default

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, H = 297
  const verifyUrl = `${window.location.origin}/verify?hash=${result.dataHash}`

  // QR code
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 300, margin: 0, color: { dark: '#2563EB', light: '#ffffff' } })

  // Background
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, W, H, 'F')

  // Top accent bar
  doc.setFillColor(12, 122, 237)
  doc.rect(0, 0, W, 4, 'F')

  // Header section
  let y = 20

  // Logo / brand
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(12, 122, 237)
  doc.text('TULIP DS', 20, y)
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.text('Verification Proof Certificate', 20, y + 7)

  // QR code top-right
  doc.addImage(qrDataUrl, 'PNG', W - 50, y - 8, 30, 30)
  doc.setFontSize(6.5)
  doc.setTextColor(148, 163, 184)
  doc.text('Scan to re-verify', W - 50, y + 25)

  y += 22

  // Divider
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)
  doc.line(20, y, W - 20, y)
  y += 10

  // Verification status banner
  if (result.verified) {
    doc.setFillColor(236, 253, 245)
    doc.roundedRect(20, y, W - 40, 18, 3, 3, 'F')
    doc.setDrawColor(16, 185, 129)
    doc.setLineWidth(0.4)
    doc.roundedRect(20, y, W - 40, 18, 3, 3, 'S')
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(5, 150, 105)
    doc.text('VERIFIED', 32, y + 11.5)
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(71, 85, 105)
    doc.text('This record has been independently verified on the blockchain.', 60, y + 11.5)
  } else {
    doc.setFillColor(254, 242, 242)
    doc.roundedRect(20, y, W - 40, 18, 3, 3, 'F')
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(220, 38, 38)
    doc.text('VERIFICATION FAILED', 32, y + 11.5)
  }
  y += 28

  // Details section
  doc.setCharSpace(0)
  const addField = (label: string, value: string, yPos: number): number => {
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 116, 139)
    doc.text(label.toUpperCase(), 20, yPos, { charSpace: 0 })
    doc.setFontSize(9.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 41, 59)
    const maxW = W / 2 - 25
    const lines = doc.splitTextToSize(value, maxW)
    doc.text(lines[0] || value, 20, yPos + 5.5, { charSpace: 0 })
    return yPos + 14
  }

  const addFieldRight = (label: string, value: string, yPos: number): number => {
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 116, 139)
    doc.text(label.toUpperCase(), W / 2 + 5, yPos, { charSpace: 0 })
    doc.setFontSize(9.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 41, 59)
    const maxW = W / 2 - 25
    const lines = doc.splitTextToSize(value, maxW)
    doc.text(lines[0] || value, W / 2 + 5, yPos + 5.5, { charSpace: 0 })
    return yPos + 14
  }

  // Record info
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text('RECORD DETAILS', 20, y)
  y += 8

  const org = result.entityDetails?.organisationName || '—'
  const project = result.entityDetails?.projectName || '—'
  const docName = result.entityDetails?.documentName || fileName || result.entityDetails?.expenseDescription || result.action || '—'
  const dateStr = result.recordedAt ? new Date(result.recordedAt).toLocaleString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) : '—'

  const rowY = y
  y = addField('Organisation', org, rowY)
  addFieldRight('Project', project, rowY)
  const row2Y = y
  y = addField('Document / Record', docName.length > 40 ? docName.slice(0, 40) + '...' : docName, row2Y)
  addFieldRight('Recorded', dateStr, row2Y)

  if (result.entityDetails?.amount) {
    const row3Y = y
    y = addField('Amount', `${result.entityDetails.currency || 'USD'} ${result.entityDetails.amount.toLocaleString()}`, row3Y)
    addFieldRight('Record Type', result.entityType || '—', row3Y)
  }

  y += 4

  // Divider
  doc.setDrawColor(226, 232, 240)
  doc.line(20, y, W - 20, y)
  y += 10

  // Cryptographic proof
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text('CRYPTOGRAPHIC PROOF', 20, y)
  y += 8

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(100, 116, 139)
  doc.text('SHA-256 DATA HASH', 20, y)
  doc.setFontSize(8)
  doc.setFont('courier', 'normal')
  doc.setTextColor(30, 41, 59)
  doc.text(result.dataHash, 20, y + 5)
  y += 14

  if (result.blockchain?.txHash) {
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 116, 139)
    doc.text('BLOCKCHAIN TRANSACTION (POLYGON)', 20, y)
    doc.setFontSize(8)
    doc.setFont('courier', 'normal')
    doc.setTextColor(30, 41, 59)
    doc.text(result.blockchain.txHash, 20, y + 5)
    y += 14
  }

  if (result.blockchain?.blockNumber) {
    const bY = y
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 116, 139)
    doc.text('BLOCK NUMBER', 20, bY)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 41, 59)
    doc.text(`#${result.blockchain.blockNumber.toLocaleString()}`, 20, bY + 5.5)

    if (result.blockchain.ancheredAt) {
      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(100, 116, 139)
      doc.text('ANCHORED AT', W / 2 + 5, bY)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(30, 41, 59)
      doc.text(new Date(result.blockchain.ancheredAt).toLocaleString('en-GB'), W / 2 + 5, bY + 5.5)
    }
    y += 14
  }

  y += 4
  doc.setDrawColor(226, 232, 240)
  doc.line(20, y, W - 20, y)
  y += 10

  // Footer
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(148, 163, 184)
  doc.text(`This certificate was generated on ${new Date().toLocaleString('en-GB')} from ${verifyUrl}`, 20, y)
  y += 5
  doc.text('Anyone can independently verify this record at the URL above or by scanning the QR code.', 20, y)
  y += 5
  doc.text('Tulip DS — NGO Financial Transparency Platform — tulipds.com', 20, y)

  // Bottom accent bar
  doc.setFillColor(12, 122, 237)
  doc.rect(0, H - 4, W, 4, 'F')
  doc.setFontSize(7)
  doc.setTextColor(148, 163, 184)
  doc.text('Powered by Tulip DS  •  Bright Bytes Technology  •  Dubai, UAE', W / 2, H - 8, { align: 'center' })

  doc.save(`tulipds-proof-${result.dataHash.slice(0, 12)}.pdf`)
}

/* ─── Proof Bundle (ZIP) Generator ────────────────────────── */
async function loadJSZip() {
  if ((window as unknown as Record<string, unknown>).JSZip) return (window as unknown as Record<string, { new(): { file(name: string, data: string | Blob): void; generateAsync(opts: { type: string }): Promise<Blob> } }>).JSZip
  return new Promise<{ new(): { file(name: string, data: string | Blob): void; generateAsync(opts: { type: string }): Promise<Blob> } }>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
    script.onload = () => resolve((window as unknown as Record<string, { new(): { file(name: string, data: string | Blob): void; generateAsync(opts: { type: string }): Promise<Blob> } }>).JSZip)
    script.onerror = () => reject(new Error('Failed to load JSZip'))
    document.head.appendChild(script)
  })
}

async function generateProofBundle(result: VerifyResult, fileName?: string) {
  const JSZip = await loadJSZip()
  const zip = new JSZip()

  const verifyUrl = `https://tulipds.com/verify?hash=${result.dataHash}`
  const now = new Date().toISOString()
  const docName = result.entityDetails?.documentName || fileName || result.entityDetails?.expenseDescription || result.action?.replace(/_/g, ' ') || '—'
  const org = result.entityDetails?.organisationName || '—'
  const project = result.entityDetails?.projectName || '—'
  const recordedAt = result.recordedAt || '—'
  const anchoredAt = result.blockchain?.ancheredAt || '—'
  const txHash = result.blockchain?.txHash || '—'
  const blockNumber = result.blockchain?.blockNumber ? `#${result.blockchain.blockNumber}` : '—'

  // 1. audit-record.json
  const auditRecord = {
    hash: result.dataHash,
    documentName: docName,
    organisation: org,
    project: project,
    recordedAt: recordedAt,
    anchoredAt: anchoredAt,
    blockchainTx: txHash,
    blockNumber: result.blockchain?.blockNumber || null,
    network: 'Polygon',
    verifiedAt: now,
    verifyUrl: verifyUrl,
  }
  zip.file('audit-record.json', JSON.stringify(auditRecord, null, 2))

  // 2. blockchain-proof.txt
  const proofTxt = [
    'TULIP DS BLOCKCHAIN VERIFICATION PROOF',
    '=======================================',
    '',
    `Document:            ${docName}`,
    `Organisation:        ${org}`,
    `Project:             ${project}`,
    `SHA-256 Hash:        ${result.dataHash}`,
    `Blockchain Network:  Polygon`,
    `Transaction:         ${txHash}`,
    `Block:               ${blockNumber}`,
    `Anchored:            ${anchoredAt !== '—' ? new Date(anchoredAt).toISOString() : '—'}`,
    `Recorded:            ${recordedAt !== '—' ? new Date(recordedAt).toISOString() : '—'}`,
    `Verified:            ${now}`,
    `Verify URL:          ${verifyUrl}`,
    '',
    '---------------------------------------',
    'This proof was generated by Tulip DS.',
    'Anyone can independently verify this',
    'record at the URL above.',
    '',
    'Tulip DS — tulipds.com',
    'Bright Bytes Technology — Dubai, UAE',
    '=======================================',
  ].join('\n')
  zip.file('blockchain-proof.txt', proofTxt)

  // 3. proof-certificate.pdf (reuse existing generator)
  const { jsPDF } = await import('jspdf')
  const QRCode = (await import('qrcode')).default

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, H = 297

  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 300, margin: 0, color: { dark: '#2563EB', light: '#ffffff' } })

  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, W, H, 'F')
  doc.setFillColor(12, 122, 237)
  doc.rect(0, 0, W, 4, 'F')

  let y = 20
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(12, 122, 237)
  doc.text('TULIP DS', 20, y)
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.text('Verification Proof Certificate', 20, y + 7)
  doc.addImage(qrDataUrl, 'PNG', W - 50, y - 8, 30, 30)
  doc.setFontSize(6.5)
  doc.setTextColor(148, 163, 184)
  doc.text('Scan to re-verify', W - 50, y + 25)
  y += 22

  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)
  doc.line(20, y, W - 20, y)
  y += 10

  if (result.verified) {
    doc.setFillColor(236, 253, 245)
    doc.roundedRect(20, y, W - 40, 18, 3, 3, 'F')
    doc.setDrawColor(16, 185, 129)
    doc.setLineWidth(0.4)
    doc.roundedRect(20, y, W - 40, 18, 3, 3, 'S')
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(5, 150, 105)
    doc.text('VERIFIED', 32, y + 11.5)
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(71, 85, 105)
    doc.text('This record has been independently verified on the blockchain.', 60, y + 11.5)
  } else {
    doc.setFillColor(254, 242, 242)
    doc.roundedRect(20, y, W - 40, 18, 3, 3, 'F')
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(220, 38, 38)
    doc.text('VERIFICATION FAILED', 32, y + 11.5)
  }
  y += 28

  doc.setCharSpace(0)
  const addField = (label: string, value: string, yPos: number): number => {
    doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139)
    doc.text(label.toUpperCase(), 20, yPos, { charSpace: 0 })
    doc.setFontSize(9.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 41, 59)
    const maxW = W / 2 - 25
    const lines = doc.splitTextToSize(value, maxW)
    doc.text(lines[0] || value, 20, yPos + 5.5, { charSpace: 0 })
    return yPos + 14
  }
  const addFieldRight = (label: string, value: string, yPos: number): number => {
    doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139)
    doc.text(label.toUpperCase(), W / 2 + 5, yPos, { charSpace: 0 })
    doc.setFontSize(9.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 41, 59)
    const maxW = W / 2 - 25
    const lines = doc.splitTextToSize(value, maxW)
    doc.text(lines[0] || value, W / 2 + 5, yPos + 5.5, { charSpace: 0 })
    return yPos + 14
  }

  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59)
  doc.text('RECORD DETAILS', 20, y); y += 8

  const dateStr = result.recordedAt ? new Date(result.recordedAt).toLocaleString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) : '—'
  const rowY = y
  y = addField('Organisation', org, rowY)
  addFieldRight('Project', project, rowY)
  const row2Y = y
  y = addField('Document / Record', docName.length > 40 ? docName.slice(0, 40) + '...' : docName, row2Y)
  addFieldRight('Recorded', dateStr, row2Y)

  if (result.entityDetails?.amount) {
    const row3Y = y
    y = addField('Amount', `${result.entityDetails.currency || 'USD'} ${result.entityDetails.amount.toLocaleString()}`, row3Y)
    addFieldRight('Record Type', result.entityType || '—', row3Y)
  }

  y += 4
  doc.setDrawColor(226, 232, 240); doc.line(20, y, W - 20, y); y += 10

  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59)
  doc.text('CRYPTOGRAPHIC PROOF', 20, y); y += 8

  doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139)
  doc.text('SHA-256 DATA HASH', 20, y)
  doc.setFontSize(8); doc.setFont('courier', 'normal'); doc.setTextColor(30, 41, 59)
  doc.text(result.dataHash, 20, y + 5); y += 14

  if (result.blockchain?.txHash) {
    doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139)
    doc.text('BLOCKCHAIN TRANSACTION (POLYGON)', 20, y)
    doc.setFontSize(8); doc.setFont('courier', 'normal'); doc.setTextColor(30, 41, 59)
    doc.text(result.blockchain.txHash, 20, y + 5); y += 14
  }

  if (result.blockchain?.blockNumber) {
    const bY = y
    doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139)
    doc.text('BLOCK NUMBER', 20, bY)
    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 41, 59)
    doc.text(`#${result.blockchain.blockNumber.toLocaleString()}`, 20, bY + 5.5)
    if (result.blockchain.ancheredAt) {
      doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139)
      doc.text('ANCHORED AT', W / 2 + 5, bY)
      doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 41, 59)
      doc.text(new Date(result.blockchain.ancheredAt).toLocaleString('en-GB'), W / 2 + 5, bY + 5.5)
    }
    y += 14
  }

  y += 4; doc.setDrawColor(226, 232, 240); doc.line(20, y, W - 20, y); y += 10

  doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(148, 163, 184)
  doc.text(`This certificate was generated on ${new Date().toLocaleString('en-GB')} from ${verifyUrl}`, 20, y); y += 5
  doc.text('Anyone can independently verify this record at the URL above or by scanning the QR code.', 20, y); y += 5
  doc.text('Tulip DS — NGO Financial Transparency Platform — tulipds.com', 20, y)

  doc.setFillColor(12, 122, 237); doc.rect(0, H - 4, W, 4, 'F')
  doc.setFontSize(7); doc.setTextColor(148, 163, 184)
  doc.text('Powered by Tulip DS  •  Bright Bytes Technology  •  Dubai, UAE', W / 2, H - 8, { align: 'center' })

  const pdfBlob = doc.output('blob')
  zip.file('proof-certificate.pdf', pdfBlob)

  // Generate and download ZIP
  const zipBlob = await zip.generateAsync({ type: 'blob' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(zipBlob)
  link.download = `tulip-proof-${result.dataHash.slice(0, 8)}.zip`
  link.click()
  URL.revokeObjectURL(link.href)
}

/* ─── Main Component ─────────────────────────────────────── */
function VerifyPageInner() {
  const searchParams = useSearchParams()
  const [hash, setHash] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [hashing, setHashing] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [mode, setMode] = useState<'file' | 'hash'>('file')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const doVerify = useCallback(async (hashToVerify: string) => {
    const cleaned = hashToVerify.trim().toLowerCase()
    if (!cleaned) return

    // Validate hash format: must be exactly 64 hex characters
    if (!/^[a-f0-9]{64}$/.test(cleaned)) {
      setResult({ verified: false, dataHash: cleaned, reason: 'Invalid hash format. Expected 64 hex characters (SHA-256).' })
      return
    }

    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/verify/${cleaned}`)
      const data = await res.json()
      if (res.ok) {
        setResult(data)
      } else {
        setResult({ verified: false, dataHash: hashToVerify.trim(), reason: data.message || 'Hash not found' })
      }
    } catch {
      setResult({ verified: false, dataHash: hashToVerify.trim(), reason: 'Cannot connect to verification server' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const urlHash = searchParams.get('hash')
    if (urlHash) {
      setHash(urlHash)
      setMode('hash')
      doVerify(urlHash)
    }
  }, [searchParams, doVerify])

  const processFile = async (file: File) => {
    setFileName(file.name)
    setHashing(true)
    setResult(null)
    try {
      const fileHash = await sha256File(file)
      setHash(fileHash)
      setHashing(false)
      doVerify(fileHash)
    } catch {
      setHashing(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  const handleVerifyHash = (e: React.FormEvent) => {
    e.preventDefault()
    setFileName(null)
    doVerify(hash)
  }

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const details = result?.entityDetails
  const bc = result?.blockchain
  const isVerified = result?.verified === true

  return (
    <div className="min-h-screen bg-[#F9FAFB]" style={{ fontFamily: 'DM Sans, sans-serif' }}>

      {/* ── NAV ── */}
      <nav className="border-b border-gray-200 bg-white/95 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)' }}>
              <Shield className="w-3.5 h-3.5 text-gray-900" />
            </div>
            <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '17px', color: 'white' }}>
              tulip<span style={{ color: '#2563EB' }}>ds</span>
            </span>
          </Link>
          <Link href="/login" className="px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)' }}>
            Sign in
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-6 sm:pb-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 mb-5">
          <Lock className="w-3 h-3 text-blue-400" />
          <span className="text-slate-400 text-xs font-medium">Public verification · No login required</span>
        </div>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1 }}
          className="text-3xl sm:text-5xl text-gray-900">
          Verify a document
        </h1>
        <p className="text-slate-500 text-base sm:text-lg mt-3 max-w-xl mx-auto leading-relaxed">
          Drop any file to check if it has been registered and anchored on the blockchain. Nothing is uploaded — verification happens in your browser.
        </p>
      </div>

      {/* ── INPUT ── */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-8">

        {/* Mode tabs */}
        <div className="flex gap-1 mb-4 bg-gray-50 p-1 rounded-lg w-fit mx-auto">
          <button onClick={() => setMode('file')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'file' ? 'bg-[#2563EB] text-white' : 'text-gray-500 hover:text-gray-700'}`}>
            <span className="flex items-center gap-2"><Upload className="w-3.5 h-3.5" /> Drop a file</span>
          </button>
          <button onClick={() => setMode('hash')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'hash' ? 'bg-[#2563EB] text-white' : 'text-gray-500 hover:text-gray-700'}`}>
            <span className="flex items-center gap-2"><Hash className="w-3.5 h-3.5" /> Paste a hash</span>
          </button>
        </div>

        {/* File drop zone */}
        {mode === 'file' && (
          <div
            onDragOver={e => { e.preventDefault(); setDragActive(true) }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative rounded-2xl border-2 border-dashed transition-all cursor-pointer group
              ${dragActive
                ? 'border-[#2563EB] bg-[#2563EB]/10 scale-[1.01]'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              }`}
            style={{ minHeight: '200px' }}
          >
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
            <div className="flex flex-col items-center justify-center py-12 sm:py-16 px-6 text-center">
              {hashing ? (
                <>
                  <div className="w-10 h-10 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-gray-700 text-sm font-medium">Computing SHA-256 hash...</p>
                  <p className="text-gray-400 text-xs mt-1">{fileName}</p>
                </>
              ) : (
                <>
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors ${dragActive ? 'bg-[#2563EB]/20' : 'bg-gray-50'}`}>
                    <Upload className={`w-7 h-7 transition-colors ${dragActive ? 'text-[#2563EB]' : 'text-gray-300 group-hover:text-gray-500'}`} />
                  </div>
                  <p className="text-gray-700 text-base font-medium">
                    {dragActive ? 'Drop your file here' : 'Drag and drop any file here'}
                  </p>
                  <p className="text-gray-400 text-sm mt-1.5">or click to browse</p>
                  <p className="text-gray-300 text-xs mt-4">
                    PDF, Word, Excel, images, or any file type — your file never leaves your device
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Hash input */}
        {mode === 'hash' && (
          <form onSubmit={handleVerifyHash}>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input type="text" value={hash} onChange={e => setHash(e.target.value)}
                  placeholder="Paste SHA-256 hash (64 hex characters)..."
                  className="w-full pl-11 pr-4 py-4 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-all text-sm font-mono" />
              </div>
              <button type="submit" disabled={loading || !hash.trim()}
                className="px-6 py-4 rounded-xl text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
                style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)' }}>
                {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Verify'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ── LOADING ── */}
      {loading && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-8">
          <div className="flex items-center justify-center gap-3 p-6 rounded-xl bg-white border border-gray-100">
            <div className="w-5 h-5 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-500 text-sm">Verifying on the blockchain...</span>
          </div>
        </div>
      )}

      {/* ── RESULT ── */}
      {result && !loading && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-16 animate-fade-up">

          {/* Status banner */}
          <div className={`flex items-start sm:items-center gap-4 p-5 sm:p-6 rounded-2xl mb-6 ${
            isVerified ? 'bg-emerald-500/8 border border-emerald-500/20' : 'bg-red-500/8 border border-red-500/20'
          }`}>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isVerified ? 'bg-emerald-500/15' : 'bg-red-500/15'
            }`}>
              {isVerified
                ? <CheckCircle className="w-6 h-6 text-emerald-400" />
                : <XCircle className="w-6 h-6 text-red-400" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700 }}
                className={`text-xl sm:text-2xl ${isVerified ? 'text-emerald-400' : 'text-red-400'}`}>
                {isVerified ? 'Verified' : 'Not Verified'}
              </h2>
              <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                {isVerified
                  ? (result.documentHash
                    ? 'This document has been independently confirmed on the Polygon blockchain. It has not been altered since it was created.'
                    : 'No document — this is an activity log entry. The hash chain is intact and the record has not been tampered with.')
                  : result.reason || 'This hash was not found in the verification registry.'}
              </p>
            </div>
          </div>

          {isVerified && (
            <div className="space-y-4">

              {/* ── Record info card ── */}
              <div className="rounded-2xl border border-gray-200 overflow-hidden" style={{ background: '#FFFFFF' }}>
                <div className="p-5 sm:p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

                    {/* File / record name */}
                    {(details?.documentName || fileName || details?.expenseDescription || result.action) && (
                      <div className="sm:col-span-2">
                        <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1.5">
                          {result.documentHash ? 'Document' : 'Record'}
                        </p>
                        <div className="flex items-center gap-2.5">
                          <FileText className="w-5 h-5 text-[#2563EB] flex-shrink-0" />
                          <span className="text-gray-900 text-base font-medium truncate">
                            {details?.documentName || fileName || details?.expenseDescription || result.action?.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Organisation */}
                    {details?.organisationName && (
                      <div>
                        <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1.5">Organisation</p>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-800 text-sm font-medium">{details.organisationName}</span>
                          {details.organisationType && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">{details.organisationType}</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Date */}
                    {result.recordedAt && (
                      <div>
                        <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1.5">Date &amp; Time</p>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-800 text-sm">
                            {new Date(result.recordedAt).toLocaleString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Project */}
                    {details?.projectName && (
                      <div>
                        <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1.5">Project</p>
                        <span className="text-gray-800 text-sm">{details.projectName}</span>
                      </div>
                    )}

                    {/* Amount */}
                    {details?.amount && (
                      <div>
                        <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1.5">Amount</p>
                        <span className="text-emerald-400 text-lg font-bold">{details.currency || 'USD'} {details.amount.toLocaleString()}</span>
                      </div>
                    )}

                    {/* Anchor status */}
                    <div>
                      <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1.5">Status</p>
                      <div className="flex items-center gap-2">
                        {bc?.anchorStatus === 'confirmed'
                          ? <><CheckCircle className="w-4 h-4 text-emerald-400" /><span className="text-emerald-400 text-sm font-medium">Anchored on blockchain</span></>
                          : <><Clock className="w-4 h-4 text-yellow-400" /><span className="text-yellow-400 text-sm font-medium">{bc?.anchorStatus || 'Pending'}</span></>
                        }
                      </div>
                    </div>
                  </div>
                </div>

                {/* View document button */}
                {result.documentId && (
                  <div className="border-t border-gray-200 px-5 sm:px-6 py-4 flex items-center justify-between">
                    <span className="text-gray-400 text-xs">Original document available</span>
                    <button onClick={async () => {
                      try {
                        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.tulipds.com'
                        const res = await fetch(`${apiUrl}/api/verify/document/${result.documentId}/view`)
                        const data = await res.json()
                        if (data.url) window.open(data.url, '_blank')
                      } catch {}
                    }} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-opacity"
                      style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)' }}>
                      <ExternalLink className="w-4 h-4" /> View Document
                    </button>
                  </div>
                )}
              </div>

              {/* ── Download buttons ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button onClick={() => generateCertificate(result, fileName || undefined)}
                  className="flex items-center justify-center gap-2.5 py-3.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 text-sm font-medium hover:bg-gray-100 hover:text-gray-900 transition-all">
                  <Download className="w-4 h-4" /> Download PDF
                </button>
                <button onClick={() => generateProofBundle(result, fileName || undefined)}
                  className="flex items-center justify-center gap-2.5 py-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-400/80 text-sm font-medium hover:bg-emerald-500/10 hover:text-emerald-400 transition-all">
                  <Archive className="w-4 h-4" /> Download Proof Bundle (ZIP)
                </button>
              </div>

              {/* ── Advanced / Technical section ── */}
              <div className="rounded-2xl border border-gray-200 overflow-hidden" style={{ background: '#FFFFFF' }}>
                <button onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full flex items-center justify-between px-5 sm:px-6 py-4 text-left hover:bg-white transition-colors">
                  <span className="text-gray-500 text-sm font-medium">Technical Details</span>
                  {showAdvanced ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>

                {showAdvanced && (
                  <div className="px-5 sm:px-6 pb-6 space-y-5 border-t border-gray-100">

                    {/* Hash chain */}
                    <div className="pt-5">
                      <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Hash Chain</p>
                      <div className="space-y-3">
                        {[
                          { label: 'Data Hash (SHA-256)', value: result.dataHash, key: 'hash' },
                          { label: 'Recomputed Hash', value: result.integrity?.hashRecomputed, key: 'recomputed' },
                          { label: 'Batch / Merkle Root', value: result.batchId, key: 'batch' },
                        ].filter(r => r.value).map(row => (
                          <div key={row.key} className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-gray-400 text-xs mb-0.5">{row.label}</p>
                              <p className="font-mono text-gray-500 text-xs truncate">{row.value}</p>
                            </div>
                            <button onClick={() => copyText(row.value!, row.key)} className="flex-shrink-0 p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                              {copied === row.key ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-gray-300" />}
                            </button>
                          </div>
                        ))}
                        {result.integrity && (
                          <div className="flex items-center gap-4 pt-1">
                            <div className="flex items-center gap-1.5">
                              {result.integrity.hashIntact
                                ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                                : <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                              }
                              <span className={`text-xs ${result.integrity.hashIntact ? 'text-emerald-400' : 'text-red-400'}`}>
                                Hash {result.integrity.hashIntact ? 'intact' : 'mismatch'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {result.integrity.chainIntact
                                ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                                : <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                              }
                              <span className={`text-xs ${result.integrity.chainIntact ? 'text-emerald-400' : 'text-red-400'}`}>
                                Chain {result.integrity.chainIntact ? 'intact' : 'broken'}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Blockchain */}
                    {bc?.txHash && (
                      <div>
                        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Blockchain Anchor</p>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-gray-400 text-xs mb-0.5">Transaction Hash</p>
                              <p className="font-mono text-gray-500 text-xs truncate">{bc.txHash}</p>
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <button onClick={() => copyText(bc.txHash!, 'tx')} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                                {copied === 'tx' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-gray-300" />}
                              </button>
                              <a href={`https://polygonscan.com/tx/${bc.txHash}`} target="_blank" rel="noopener noreferrer"
                                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                                <ExternalLink className="w-3.5 h-3.5 text-gray-300" />
                              </a>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {bc.blockNumber && (
                              <div>
                                <p className="text-gray-400 text-xs">Block</p>
                                <p className="text-gray-600 text-sm font-mono">#{bc.blockNumber.toLocaleString()}</p>
                              </div>
                            )}
                            {bc.ancheredAt && (
                              <div>
                                <p className="text-gray-400 text-xs">Anchored</p>
                                <p className="text-gray-600 text-xs">{new Date(bc.ancheredAt).toLocaleString('en-GB')}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-gray-400 text-xs">Network</p>
                              <div className="flex items-center gap-1">
                                <Globe className="w-3 h-3 text-[#2563EB]" />
                                <p className="text-[#2563EB] text-xs font-medium">Polygon Amoy</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* RFC 3161 */}
                    {bc?.ancheredAt && (
                      <div>
                        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">RFC 3161 Timestamp</p>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-emerald-400" />
                          <span className="text-emerald-400 text-xs font-medium">RFC 3161 Compliant</span>
                          <span className="text-gray-300 text-xs">· eIDAS · ESIGN Act · Legally admissible</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── HOW IT WORKS (shown when no result) ── */}
      {!result && !loading && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-20">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: <FileText className="w-5 h-5" />, title: 'Drop any file', desc: 'PDF, image, Word, Excel — we compute a SHA-256 fingerprint locally. Your file never leaves your device.' },
              { icon: <Globe className="w-5 h-5" />, title: 'Blockchain check', desc: 'We look up the fingerprint on the Polygon blockchain to confirm the document was registered.' },
              { icon: <CheckCircle className="w-5 h-5" />, title: 'Instant proof', desc: 'Get a clear result with all the details, and download a printable proof certificate with QR code.' },
            ].map(item => (
              <div key={item.title} className="p-5 rounded-xl border border-gray-100 bg-white text-center">
                <div className="w-11 h-11 rounded-xl bg-blue-500/10 flex items-center justify-center mx-auto mb-3 text-blue-400">{item.icon}</div>
                <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '14px', color: 'white', marginBottom: '6px' }}>{item.title}</p>
                <p className="text-slate-500 text-xs leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 p-5 rounded-xl border border-gray-100 bg-white text-center">
            <p className="text-slate-500 text-sm">
              Want to verify your own records?{' '}
              <Link href="/login" className="text-[#2563EB] font-medium hover:underline">Sign in to your dashboard</Link>
              {' '}or{' '}
              <Link href="/register" className="text-[#2563EB] font-medium hover:underline">create an account</Link>
            </p>
          </div>
        </div>
      )}

      <footer className="border-t border-gray-100 py-6 sm:py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-slate-700 text-xs">© 2026 Tulip DS · Bright Bytes Technology · Dubai, UAE</p>
        </div>
      </footer>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center"><div className="w-6 h-6 border-2 border-gray-300 border-t-white rounded-full animate-spin" /></div>}>
      <VerifyPageInner />
    </Suspense>
  )
}
