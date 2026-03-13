'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import Link from 'next/link'
import { Receipt, Plus, Search, ExternalLink, Shield, Copy, Check, CheckCircle, ChevronDown, ChevronUp, FileCheck, Upload, AlertTriangle, Clock, WifiOff, XCircle } from 'lucide-react'
import DocumentUploadSection from '@/components/DocumentUploadSection'
import BlockchainStatusPill from '@/components/BlockchainStatusPill'
import TrustSealCard from '@/components/TrustSealCard'
import { useLiveQuery } from 'dexie-react-hooks'
import { offlineDb, type PendingExpense } from '@/lib/offlineDb'
import { useOfflineSync } from '@/hooks/useOfflineSync'

interface Document {
  id: string
  name: string
  sha256Hash: string | null
  fileType: string | null
  uploadedAt: string
  isDuplicate?: boolean
  duplicateOfName?: string | null
  crossTenantDuplicate?: boolean
  isVisualDuplicate?: boolean
  visualDuplicateOfName?: string | null
  crossTenantVisualDuplicate?: boolean
  duplicateConfidence?: string | null
  duplicateMethod?: string | null
  fraudRiskScore?: number | null
  fraudRiskLevel?: string | null
}

interface Expense {
  id: string
  title: string
  description: string
  amount: number
  currency: string
  category: string | null
  subCategory: string | null
  expenseType: string | null
  vendor: string | null
  expenseDate: string
  createdAt: string
  anchorStatus: string
  approvalStatus?: string
  dataHash: string | null
  blockchainTx: string | null
  receiptHash: string | null
  receiptFileKey: string | null
  receiptSealId: string | null
  ocrAmount: number | null
  ocrVendor: string | null
  ocrDate: string | null
  amountMismatch: boolean
  vendorMismatch: boolean
  dateMismatch: boolean
  mismatchNote: string | null
  fraudRiskScore?: number | null
  fraudRiskLevel?: string | null
  fraudSignals?: string[] | null
  project?: { id: string; name: string }
  fundingAgreement?: { id: string; title: string; donor: { name: string } | null } | null
  documents?: Document[]
}

function ApprovalBadge({ status }: { status?: string }) {
  if (!status || status === 'approved' || status === 'pending') return null
  const map: Record<string, string> = {
    pending_review: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
    rejected: 'bg-red-400/10 text-red-400 border-red-400/20',
  }
  const labels: Record<string, string> = {
    pending_review: 'Pending Review', rejected: 'Rejected',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border font-medium ${map[status] ?? 'bg-[#e1eedd] text-[#183a1d]/60 border-[#c8d6c0]'}`}>
      {labels[status] ?? status}
    </span>
  )
}

function HashCell({ hash }: { hash: string }) {
  const [copied, setCopied] = useState(false)
  const copy = (e: React.MouseEvent) => { e.stopPropagation(); navigator.clipboard.writeText(hash); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  return (
    <div className="flex items-center gap-1.5 group">
      <span className="hash-mono text-[#183a1d]/40" style={{ fontSize: 11 }}>{hash.slice(0, 10)}…{hash.slice(-6)}</span>
      <button onClick={copy} className="opacity-0 group-hover:opacity-100 transition-opacity">
        {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} className="text-[#183a1d]/40" />}
      </button>
    </div>
  )
}

function ExpenseTypeBadge({ type }: { type: string | null }) {
  if (!type) return null
  const cls = type === 'CAPEX'
    ? 'bg-purple-400/10 text-purple-400 border-purple-400/20'
    : 'bg-cyan-400/10 text-[#183a1d] border-cyan-400/20'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border font-medium ${cls}`}>
      {type === 'CAPEX' ? 'CapEx' : 'OpEx'}
    </span>
  )
}

function AnchorBadge({ status }: { status: string }) {
  if (!status || status === 'pending') return null
  const map: Record<string, string> = {
    confirmed:  'bg-green-400/10 text-green-400 border-green-400/20',
    processing: 'bg-[#f6c453]/10 text-[#183a1d] border-[#f6c453]/30',
    failed:     'bg-red-400/10 text-red-400 border-red-400/20',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium capitalize ${map[status] ?? ''}`}>
      {status}
    </span>
  )
}

function DuplicateDocBadge({ doc }: { doc: Document }) {
  const conf = doc.duplicateConfidence
  const isCrossTenant = doc.crossTenantDuplicate || doc.crossTenantVisualDuplicate

  if (isCrossTenant) {
    return <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white" title="Same document found in another organisation — high fraud risk"><AlertTriangle size={9} /> HIGH RISK — Cross-Org</span>
  }
  if (conf === 'HIGH') {
    return <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white" title="Confirmed duplicate — text + visual match"><AlertTriangle size={9} /> DUPLICATE CONFIRMED</span>
  }
  if (conf === 'MEDIUM') {
    return <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500 text-white" title="OCR content matches another document"><AlertTriangle size={9} /> LIKELY DUPLICATE</span>
  }
  if (conf === 'LOW') {
    return <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500 text-white" title="Visually similar to another document"><AlertTriangle size={9} /> POSSIBLE DUPLICATE</span>
  }
  // Legacy fallback
  if (doc.isDuplicate) {
    return <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white" title={`Duplicate of "${doc.duplicateOfName}"`}><AlertTriangle size={9} /> Duplicate</span>
  }
  if (doc.isVisualDuplicate) {
    return <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500 text-white" title={`Visual duplicate of "${doc.visualDuplicateOfName}"`}><AlertTriangle size={9} /> Visual Duplicate</span>
  }
  return null
}

function RiskBadge({ score, level }: { score?: number | null; level?: string | null }) {
  if (!score || !level || level === 'LOW') return null
  const styles: Record<string, string> = {
    CRITICAL: 'bg-red-800 text-white',
    HIGH: 'bg-orange-500 text-white',
    MEDIUM: 'bg-yellow-500 text-white',
  }
  const labels: Record<string, string> = {
    CRITICAL: 'CRITICAL RISK',
    HIGH: 'HIGH RISK',
    MEDIUM: 'MEDIUM RISK',
  }
  return (
    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${styles[level] || ''}`} title={`Fraud risk score: ${score}/100`}>
      {labels[level]} &bull; {score}
    </span>
  )
}

interface OcrFields {
  amount: number | null
  currency: string | null
  vendor: string | null
  date: string | null
  extras: Record<string, string>
  ocrFingerprint?: string | null
  duplicateOf?: { id: string; name: string; uploadedAt: string } | null
  crossTenantDuplicate?: boolean
}

interface PHashResult {
  visualDuplicateOf?: { id: string; name: string } | null
  crossTenantVisualDuplicate?: boolean
}

function ReceiptUploader({ expenseId, expenseTitle, onUploaded }: { expenseId: string; expenseTitle: string; onUploaded: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [ocrResult, setOcrResult] = useState<OcrFields | null>(null)
  const [pHashResult, setPHashResult] = useState<PHashResult | null>(null)

  const upload = async () => {
    if (!file) return
    setUploading(true); setError(''); setOcrResult(null); setPHashResult(null)
    try {
      const token = localStorage.getItem('tulip_token')
      const fd = new FormData()
      fd.append('file', file)
      fd.append('title', expenseTitle || file.name)
      fd.append('expenseId', expenseId)
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050'}/api/expenses/upload-receipt`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: fd,
      })
      if (res.ok) {
        const data = await res.json()
        setFile(null)
        if (data.ocrFields) setOcrResult(data.ocrFields)
        if (data.pHashResult) setPHashResult(data.pHashResult)
        onUploaded()
      } else {
        const d = await res.json().catch(() => ({}))
        setError(d.error || 'Upload failed')
      }
    } catch { setError('Upload failed') }
    setUploading(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[#c8d6c0] hover:border-[#c8d6c0] cursor-pointer transition-all text-sm text-[#183a1d]/60">
          <Upload size={13} />
          <span>{file ? file.name : 'Choose receipt...'}</span>
          <input type="file" className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xlsx,.xls,.csv"
            onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]) }} />
        </label>
        {file && (
          <button onClick={upload} disabled={uploading}
            className="px-3 py-2 rounded-lg text-xs font-medium text-[#183a1d] disabled:opacity-50 shrink-0 bg-[#f6c453] hover:bg-[#f0a04b]">
            {uploading ? 'Scanning & Sealing...' : 'Upload & Seal'}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {ocrResult && (ocrResult.amount || ocrResult.vendor || ocrResult.currency || Object.keys(ocrResult.extras).length > 0) && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
            <FileCheck size={12} /> Fields auto-filled from OCR
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] text-emerald-700">
            {ocrResult.amount && <span className="px-1.5 py-0.5 bg-emerald-100 rounded">Amount: {ocrResult.amount}</span>}
            {ocrResult.currency && <span className="px-1.5 py-0.5 bg-emerald-100 rounded">Currency: {ocrResult.currency}</span>}
            {ocrResult.vendor && <span className="px-1.5 py-0.5 bg-emerald-100 rounded">Vendor: {ocrResult.vendor}</span>}
            {ocrResult.date && <span className="px-1.5 py-0.5 bg-emerald-100 rounded">Date: {ocrResult.date}</span>}
            {Object.entries(ocrResult.extras).map(([k, v]) => (
              <span key={k} className="px-1.5 py-0.5 bg-emerald-100 rounded">{k}: {v}</span>
            ))}
          </div>
          <p className="text-[10px] text-emerald-500">Fields are editable — OCR is a suggestion, not a lock</p>
        </div>
      )}
      {ocrResult?.crossTenantDuplicate && (
        <div className="rounded-lg bg-red-600 p-4">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <AlertTriangle size={18} /> HIGH RISK — This document was uploaded by another organisation
          </div>
        </div>
      )}
      {ocrResult?.duplicateOf && !ocrResult?.crossTenantDuplicate && (
        <div className="rounded-lg bg-red-600 p-4">
          <div className="flex items-start gap-2 text-white font-bold text-sm">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <span>DUPLICATE DOCUMENT DETECTED — This receipt was already uploaded as &quot;{ocrResult.duplicateOf.name}&quot; on {new Date(ocrResult.duplicateOf.uploadedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      )}
      {pHashResult?.crossTenantVisualDuplicate && (
        <div className="rounded-lg bg-red-600 p-4">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <AlertTriangle size={18} /> HIGH RISK — Visually similar document found in another organisation
          </div>
        </div>
      )}
      {pHashResult?.visualDuplicateOf && !pHashResult?.crossTenantVisualDuplicate && (
        <div className="rounded-lg bg-red-600 p-4">
          <div className="flex items-start gap-2 text-white font-bold text-sm">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <span>VISUAL DUPLICATE — This receipt looks identical to &quot;{pHashResult.visualDuplicateOf.name}&quot;</span>
          </div>
        </div>
      )}
      {!ocrResult && !pHashResult && <p className="text-[10px] text-[#183a1d]/30">File will be SHA-256 hashed, OCR scanned, and a Trust Seal created automatically</p>}
    </div>
  )
}

function ExpenseRow({ expense, onRefresh, onOpenSeal, sealMap, onVoid }: { expense: Expense; onRefresh: () => void; onOpenSeal: (sealId: string, expense: Expense) => void; sealMap: Record<string, { sealId: string; anchorStatus: string; txHash: string | null }>; onVoid: () => void }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <div
        className={`px-4 py-3.5 hover:bg-[#e1eedd]/50 transition-colors cursor-pointer lg:grid lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_50px] lg:gap-4 lg:items-center lg:px-5 ${(expense as any).voided ? 'opacity-50' : ''}`}
        onClick={() => setExpanded(e => !e)}
      >
        <div>
          <div className="flex items-center justify-between">
            <Link href={`/dashboard/expenses/${expense.id}`} className="text-sm font-medium text-[#183a1d] hover:text-[#183a1d] transition-colors" onClick={e => e.stopPropagation()}>{expense.title ?? expense.description}</Link>
            {/* Mobile-only amount + chevron */}
            <div className="flex items-center gap-2 lg:hidden">
              <span className="text-sm font-medium text-[#183a1d]">{expense.currency} {expense.amount.toLocaleString()}</span>
              <span className="text-[#183a1d]/30">
                {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <ExpenseTypeBadge type={expense.expenseType} />
            {(expense as any).voided && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-500 border border-red-500/20">VOIDED</span>
            )}
            {expense.category && (
              <span className="text-xs text-[#183a1d]/60">{expense.category}{expense.subCategory ? ` / ${expense.subCategory}` : ''}</span>
            )}
            {expense.project && (
              <span className="text-xs text-[#183a1d]/70">{expense.project.name}</span>
            )}
            {expense.fundingAgreement && (
              <span className="text-xs text-emerald-400/60">{expense.fundingAgreement.title}</span>
            )}
            {expense.vendor && <span className="text-xs text-[#183a1d]/40">{expense.vendor}</span>}
            {expense.description?.includes('[OCR]') && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-200">
                <FileCheck size={9} /> OCR
              </span>
            )}
            {(expense.amountMismatch || expense.vendorMismatch || expense.dateMismatch) && (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white" title={expense.mismatchNote || 'Mismatch detected'}>
                <AlertTriangle size={9} /> Mismatch
              </span>
            )}
            {expense.documents?.some(d => d.crossTenantDuplicate) && (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white">
                <AlertTriangle size={9} /> Cross-Org Duplicate
              </span>
            )}
            {expense.documents?.some(d => d.isDuplicate && !d.crossTenantDuplicate) && (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white">
                <AlertTriangle size={9} /> Duplicate
              </span>
            )}
            {expense.documents?.some(d => d.crossTenantVisualDuplicate) && (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white">
                <AlertTriangle size={9} /> Cross-Org Visual Match
              </span>
            )}
            {expense.documents?.some(d => d.isVisualDuplicate && !d.crossTenantVisualDuplicate) && (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white">
                <AlertTriangle size={9} /> Visual Duplicate
              </span>
            )}
            <RiskBadge score={expense.fraudRiskScore} level={expense.fraudRiskLevel} />
            {(expense.documents?.length ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-xs text-[#183a1d]/40">
                <FileCheck size={10} /> {expense.documents!.length} doc{expense.documents!.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {/* Mobile-only status row */}
          <div className="flex items-center gap-2 mt-1.5 lg:hidden">
            <span className="text-[10px] text-[#183a1d]/40">{new Date(expense.createdAt || expense.expenseDate).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            <ApprovalBadge status={expense.approvalStatus} />
            <AnchorBadge status={expense.anchorStatus} />
            {expense.receiptHash && (
              <span className="text-[10px] text-green-400 flex items-center gap-0.5"><CheckCircle size={10} /> Sealed</span>
            )}
            {expense.dataHash && (
              <Link href={`/verify?hash=${expense.dataHash}`} target="_blank"
                className="text-[#183a1d]/30 hover:text-[#183a1d] transition-colors" title="Verify" onClick={e => e.stopPropagation()}>
                <Shield size={13} />
              </Link>
            )}
            {expense.blockchainTx && (
              <Link href={`https://polygonscan.com/tx/${expense.blockchainTx}`} target="_blank"
                className="text-[#183a1d]/30 hover:text-[#34d399] transition-colors" title="Polygonscan" onClick={e => e.stopPropagation()}>
                <ExternalLink size={13} />
              </Link>
            )}
          </div>
        </div>
        <div className="hidden lg:block text-sm font-medium text-[#183a1d]">
          {expense.currency} {expense.amount.toLocaleString()}
        </div>
        <div className="hidden lg:block text-xs text-[#183a1d]/60 truncate">
          {expense.project?.name ?? '—'}
        </div>
        <div className="hidden lg:block text-xs text-[#183a1d]/50">
          {new Date(expense.createdAt || expense.expenseDate).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </div>
        <div className="hidden lg:flex lg:items-center lg:gap-1.5" onClick={e => e.stopPropagation()}>
          {expense.receiptSealId ? (
            <BlockchainStatusPill
              sealId={expense.receiptSealId}
              anchorStatus={expense.receiptHash && sealMap[expense.receiptHash] ? sealMap[expense.receiptHash].anchorStatus : undefined}
              txHash={expense.receiptHash && sealMap[expense.receiptHash] ? sealMap[expense.receiptHash].txHash : undefined}
              onClick={() => onOpenSeal(expense.receiptSealId!, expense)}
            />
          ) : (
            <span className="text-[#183a1d]/30 text-xs">No receipt</span>
          )}
        </div>
        <div className="hidden lg:flex lg:items-center lg:gap-1.5">
          <ApprovalBadge status={expense.approvalStatus} />
          <AnchorBadge status={expense.anchorStatus} />
        </div>
        <div className="hidden lg:flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {expense.dataHash && (
            <Link href={`/verify?hash=${expense.dataHash}`} target="_blank"
              className="text-[#183a1d]/30 hover:text-[#183a1d] transition-colors" title="Verify on blockchain">
              <Shield size={13} />
            </Link>
          )}
          {expense.blockchainTx && (
            <Link href={`https://polygonscan.com/tx/${expense.blockchainTx}`} target="_blank"
              className="text-[#183a1d]/30 hover:text-[#34d399] transition-colors" title="View on Polygonscan">
              <ExternalLink size={13} />
            </Link>
          )}
          <span className="text-[#183a1d]/30">
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </span>
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="px-5 pb-5 bg-[#e1eedd] border-t border-[#c8d6c0]">
          <div className="pt-4 space-y-4">

            {/* Receipt section */}
            <div className="rounded-lg border border-[#c8d6c0] p-4 space-y-3 bg-[#e1eedd]">
              <div className="text-xs font-medium text-[#183a1d]/60 uppercase tracking-wide">Receipt / Invoice</div>
              {expense.receiptHash ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-green-400 text-sm">
                    <CheckCircle size={14} /> Receipt Sealed
                  </div>
                  <div className="text-xs text-[#183a1d]/40 font-mono break-all">SHA-256: {expense.receiptHash}</div>
                  <div className="flex items-center gap-3">
                    {expense.receiptSealId && (
                      <button onClick={(e) => { e.stopPropagation(); onOpenSeal(expense.receiptSealId!, expense) }}
                        className="text-xs text-[#183a1d] hover:text-[#f6c453] flex items-center gap-1">
                        <Shield size={11} /> View Seal
                      </button>
                    )}
                    {expense.blockchainTx && (
                      <a href={`https://polygonscan.com/tx/${expense.blockchainTx}`} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <ExternalLink size={11} /> View on Polygon
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <ReceiptUploader expenseId={expense.id} expenseTitle={expense.title ?? expense.description} onUploaded={onRefresh} />
              )}
            </div>

            {/* Mismatch warnings */}
            {(expense.amountMismatch || expense.vendorMismatch || expense.dateMismatch) && (
              <div className="rounded-lg bg-red-600 p-4 space-y-2">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <AlertTriangle size={16} /> OCR Mismatch Detected
                </div>
                <div className="space-y-1 text-sm text-white/90">
                  {expense.amountMismatch && (
                    <div>Amount altered: OCR read <strong>{expense.ocrAmount?.toLocaleString()}</strong>, saved as <strong>{expense.amount.toLocaleString()}</strong></div>
                  )}
                  {expense.vendorMismatch && (
                    <div>Vendor altered: OCR read <strong>&quot;{expense.ocrVendor}&quot;</strong>, saved as <strong>&quot;{expense.vendor}&quot;</strong></div>
                  )}
                  {expense.dateMismatch && (
                    <div>Date altered: OCR read <strong>{expense.ocrDate}</strong>, expense date differs by 30+ days</div>
                  )}
                </div>
              </div>
            )}

            {/* Documents list */}
            {(expense.documents?.length ?? 0) > 0 && (
              <div className="rounded-lg border border-[#c8d6c0] overflow-hidden">
                <div className="grid grid-cols-[2fr_80px_1fr_1fr_40px] gap-3 px-4 py-2 border-b border-[#c8d6c0] text-xs text-[#183a1d]/40 uppercase tracking-wide">
                  <span>Document</span><span>Type</span><span>Hash</span><span>Date</span><span></span>
                </div>
                {expense.documents!.map(doc => (
                  <div key={doc.id} className="grid grid-cols-[2fr_80px_1fr_1fr_40px] gap-3 items-center px-4 py-2.5 border-b border-[#c8d6c0] last:border-0 hover:bg-[#e1eedd]/50">
                    <div className="flex items-center gap-2">
                      <FileCheck size={12} className="text-[#183a1d]" />
                      <span className="text-sm text-[#183a1d]">{doc.name}</span>
                      <DuplicateDocBadge doc={doc} />
                    </div>
                    <span className="text-xs text-[#183a1d]/60 uppercase">{doc.fileType ?? '—'}</span>
                    <div>
                      {doc.sha256Hash
                        ? <span className="hash-mono text-[#183a1d]/40" style={{ fontSize: 11 }}>{doc.sha256Hash.slice(0, 10)}…{doc.sha256Hash.slice(-6)}</span>
                        : <span className="text-[#183a1d]/30 text-xs">—</span>
                      }
                    </div>
                    <span className="text-xs text-[#183a1d]/40">{new Date(doc.uploadedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={async (e) => {
                        e.stopPropagation()
                        const token = localStorage.getItem('tulip_token')
                        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/documents/${doc.id}/view`, {
                          headers: { Authorization: `Bearer ${token}` }
                        })
                        const data = await res.json()
                        if (data.url) window.open(data.url, '_blank')
                      }} className="text-[#183a1d]/30 hover:text-[#34d399] transition-colors" title="View document">
                        <ExternalLink size={12} />
                      </button>
                      {doc.sha256Hash && (
                        <Link href={`/verify?hash=${doc.sha256Hash}`} target="_blank"
                          className="text-[#183a1d]/30 hover:text-[#183a1d] transition-colors" title="Verify hash">
                          <Shield size={12} />
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Upload additional documents */}
            <DocumentUploadSection entityType="expense" entityId={expense.id} onUploaded={onRefresh} />

            {/* Void button */}
            {!(expense as any).voided && (
              <button onClick={(e) => { e.stopPropagation(); onVoid() }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 border border-red-500/20 hover:bg-red-500/10 transition-all">
                <XCircle size={12} /> Void Expense
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function PendingSyncPill() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-300">
      <Clock size={9} /> Pending Sync
    </span>
  )
}

function VoidModal({ expenseId, expenseTitle, onClose, onVoided }: {
  expenseId: string; expenseTitle: string; onClose: () => void; onVoided: () => void
}) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleVoid = async () => {
    if (!reason.trim()) { setError('Reason is required'); return }
    setLoading(true)
    try {
      const token = localStorage.getItem('tulip_token')
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/expenses/${expenseId}/void`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      })
      if (res.ok) {
        onVoided()
        onClose()
      } else {
        const d = await res.json().catch(() => ({}))
        setError(d.error || 'Failed to void expense')
      }
    } catch { setError('Network error') }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#fefbe9] rounded-xl border border-[#c8d6c0] p-6 max-w-md w-full space-y-4 shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-[#183a1d]">Void Expense</h3>
        <p className="text-sm text-[#183a1d]/60">
          Void <strong>&quot;{expenseTitle}&quot;</strong>? This cannot be undone. The expense will remain in the audit trail but marked as voided.
        </p>
        <div>
          <label className="block text-xs font-medium text-[#183a1d]/60 mb-1.5 uppercase tracking-wide">Reason *</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)}
            placeholder="Why is this expense being voided?"
            rows={3} className="w-full bg-[#e1eedd] border border-[#c8d6c0] rounded-lg px-4 py-2.5 text-sm text-[#183a1d] placeholder-[#183a1d]/40 outline-none focus:border-[#f6c453] resize-none" />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex items-center gap-3 pt-2">
          <button onClick={handleVoid} disabled={loading || !reason.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 disabled:opacity-50">
            {loading ? 'Voiding...' : 'Confirm Void'}
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-[#183a1d]/60 hover:text-[#183a1d]">Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeSealId, setActiveSealId] = useState<string | null>(null)
  const [activeMismatch, setActiveMismatch] = useState<Expense | null>(null)
  const [sealMap, setSealMap] = useState<Record<string, { sealId: string; anchorStatus: string; txHash: string | null }>>({})
  const [voidTarget, setVoidTarget] = useState<{id: string, title: string} | null>(null)
  const { isOnline } = useOfflineSync()

  // Load offline pending expenses from IndexedDB
  const pendingExpenses = useLiveQuery(
    () => offlineDb.pending_expenses.where('status').anyOf(['pending', 'syncing']).toArray(),
    [],
    []
  )

  // Convert pending expenses to Expense-like objects for display
  const offlineExpenseRows: Expense[] = (pendingExpenses ?? []).map((pe: PendingExpense) => ({
    id: `offline-${pe.id}`,
    title: pe.description,
    description: pe.description,
    amount: pe.amount,
    currency: pe.currency,
    category: pe.category || null,
    subCategory: null,
    expenseType: null,
    vendor: pe.vendorName || null,
    expenseDate: pe.date,
    createdAt: pe.date,
    anchorStatus: 'pending',
    dataHash: null,
    blockchainTx: null,
    receiptHash: null,
    receiptFileKey: null,
    receiptSealId: null,
    ocrAmount: null,
    ocrVendor: null,
    ocrDate: null,
    amountMismatch: false,
    vendorMismatch: false,
    dateMismatch: false,
    mismatchNote: null,
    _isOffline: true,
    _offlineStatus: pe.status,
  } as Expense & { _isOffline?: boolean; _offlineStatus?: string }))

  const resolveSeals = useCallback((items: Expense[]) => {
    const hashes = items.map(e => e.receiptHash).filter(Boolean) as string[]
    if (hashes.length === 0) return
    apiPost('/api/trust-seal/resolve', { hashes })
      .then(r => r.ok ? r.json() : {})
      .then(map => setSealMap(map))
      .catch(() => {})
  }, [])

  const load = () => {
    if (!isOnline) {
      // Offline — load from IndexedDB cache
      offlineDb.cached_expenses.toArray()
        .then(cached => {
          setExpenses(cached.map(c => c.data as Expense))
          setLoading(false)
        })
        .catch(() => {
          setExpenses([])
          setLoading(false)
        })
      return
    }
    apiGet('/api/expenses?limit=50')
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => {
        const items = d.data ?? d.items ?? []
        setExpenses(items)
        setLoading(false)
        resolveSeals(items)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [isOnline])

  // Refresh expense list when offline sync completes
  useEffect(() => {
    const onSyncComplete = () => { load() }
    window.addEventListener('tulip-sync-complete', onSyncComplete)
    return () => window.removeEventListener('tulip-sync-complete', onSyncComplete)
  }, [])

  const filtered = expenses.filter(e =>
    (e.title ?? e.description ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (e.vendor ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (e.category ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (e.project?.name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const total = filtered.reduce((sum, e) => sum + e.amount, 0)

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#183a1d]" style={{ fontFamily: 'Inter, sans-serif' }}>Expenses</h1>
          <p className="text-[#183a1d]/60 text-sm mt-1">{expenses.length} expense{expenses.length !== 1 ? 's' : ''} — every entry blockchain anchored</p>
        </div>
        <Link href="/dashboard/expenses/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[#183a1d] self-start bg-[#f6c453] hover:bg-[#f0a04b]">
          <Plus size={16} /> Log Expense
        </Link>
      </div>

      {!isOnline && (
        <div className="rounded-xl border p-3.5 flex items-center gap-3"
          style={{ background: 'rgba(251,191,36,0.08)', borderColor: 'rgba(251,191,36,0.2)' }}>
          <WifiOff size={16} className="text-amber-400 shrink-0" />
          <p className="text-[#183a1d]/60 text-xs">You are offline — showing pending expenses only. Synced expenses will appear when back online.</p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Total Logged', value: `$${total.toLocaleString()}` },
            { label: 'Anchored', value: filtered.filter(e => e.receiptHash && sealMap[e.receiptHash]?.anchorStatus === 'confirmed').length },
            { label: 'Pending Anchor', value: filtered.filter(e => !e.receiptHash || !sealMap[e.receiptHash] || sealMap[e.receiptHash]?.anchorStatus === 'pending').length },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-[#c8d6c0] px-5 py-4" style={{ background: '#e1eedd' }}>
              <div className="text-xl font-bold text-[#183a1d]" style={{ fontFamily: 'Inter, sans-serif' }}>{value}</div>
              <div className="text-xs text-[#183a1d]/60 mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 bg-[#e1eedd] border border-[#c8d6c0] rounded-lg px-4 py-2.5 max-w-sm">
        <Search size={15} className="text-[#183a1d]/40" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search expenses..." className="bg-transparent text-sm text-[#183a1d] placeholder-[#183a1d]/40 outline-none w-full" />
      </div>

      <div className="rounded-xl border border-[#c8d6c0] overflow-hidden" style={{ background: '#e1eedd' }}>
        <div className="hidden lg:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_60px] gap-4 px-5 py-3 border-b border-[#c8d6c0] text-xs text-[#183a1d]/40 uppercase tracking-wide font-medium">
          <span>Expense</span><span>Amount</span><span>Project</span><span>Date</span><span>Seal</span><span>Status</span><span>Actions</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-[#183a1d]/40 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <Receipt size={32} className="text-[#183a1d]/30" />
            <p className="text-[#183a1d]/40 text-sm">No expenses logged yet</p>
            <Link href="/dashboard/expenses/new" className="text-[#183a1d] text-sm hover:underline">Log your first expense</Link>
          </div>
        ) : (
          <div className="divide-y divide-[#c8d6c0]">
            {offlineExpenseRows.map(expense => (
              <div key={expense.id} className="px-4 py-3.5 lg:grid lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_50px] lg:gap-4 lg:items-center lg:px-5 bg-amber-50/50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#183a1d]">{expense.title}</span>
                    <PendingSyncPill />
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {expense.vendor && <span className="text-xs text-[#183a1d]/40">{expense.vendor}</span>}
                    {expense.category && <span className="text-xs text-[#183a1d]/60">{expense.category}</span>}
                  </div>
                </div>
                <div className="text-sm font-medium text-[#183a1d]">{expense.currency} {expense.amount.toLocaleString()}</div>
                <div className="text-xs text-[#183a1d]/60">—</div>
                <div className="text-xs text-[#183a1d]/50">
                  {new Date(expense.expenseDate).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
                <div><PendingSyncPill /></div>
                <div><span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium bg-amber-100 text-amber-700 border-amber-300">Offline</span></div>
                <div />
              </div>
            ))}
            {filtered.map(expense => (
              <ExpenseRow key={expense.id} expense={expense} onRefresh={load} onOpenSeal={(sealId, exp) => { setActiveSealId(sealId); setActiveMismatch(exp) }} sealMap={sealMap} onVoid={() => setVoidTarget({ id: expense.id, title: expense.title ?? expense.description })} />
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-[#183a1d]/30 text-center">Click any expense row to view documents and upload receipts</p>

      {voidTarget && (
        <VoidModal
          expenseId={voidTarget.id}
          expenseTitle={voidTarget.title}
          onClose={() => setVoidTarget(null)}
          onVoided={load}
        />
      )}

      {activeSealId && (
        <TrustSealCard sealId={activeSealId} onClose={() => { setActiveSealId(null); setActiveMismatch(null); resolveSeals(expenses) }}
          mismatch={activeMismatch ? {
            amountMismatch: activeMismatch.amountMismatch,
            vendorMismatch: activeMismatch.vendorMismatch,
            dateMismatch: activeMismatch.dateMismatch,
            mismatchNote: activeMismatch.mismatchNote,
            ocrAmount: activeMismatch.ocrAmount,
            ocrVendor: activeMismatch.ocrVendor,
            ocrDate: activeMismatch.ocrDate,
            amount: activeMismatch.amount,
            vendor: activeMismatch.vendor,
          } : undefined}
          fraudRisk={activeMismatch ? {
            fraudRiskScore: activeMismatch.fraudRiskScore,
            fraudRiskLevel: activeMismatch.fraudRiskLevel,
            fraudSignals: activeMismatch.fraudSignals,
          } : undefined}
        />
      )}
    </div>
  )
}
