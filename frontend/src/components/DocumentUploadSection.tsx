'use client'

import { useState } from 'react'
import { Upload, FileCheck, X, Paperclip } from 'lucide-react'

interface Props {
  entityType: 'project' | 'expense'
  entityId: string
  onUploaded?: () => void
}

const DOC_TYPES = ['Invoice', 'Receipt', 'Contract', 'Report', 'Proposal', 'Registration', 'Tax Certificate', 'Donor Agreement', 'Payment Proof', 'Other']

export default function DocumentUploadSection({ entityType, entityId, onUploaded }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [docType, setDocType] = useState('')
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)

  const inputCls = "w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#0c7aed]/50 transition-all"
  const labelCls = "block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide"

  const handleFile = (f: File) => {
    setFile(f)
    if (!name) setName(f.name.replace(/\.[^.]+$/, ''))
    setSuccess(false)
    setError('')
  }

  const upload = async () => {
    if (!file) { setError('Please select a file'); return }
    if (!name.trim()) { setError('Document name is required'); return }
    setUploading(true)
    setError('')
    try {
      const token = localStorage.getItem('tulip_token')
      const fd = new FormData()
      fd.append('file', file)
      fd.append('name', name.trim())
      fd.append('documentType', docType || 'Other')
      fd.append('documentLevel', entityType)
      if (entityType === 'project') fd.append('projectId', entityId)
      if (entityType === 'expense') fd.append('expenseId', entityId)

      let url = `${process.env.NEXT_PUBLIC_API_URL}/api/documents`
      let res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })

      // Handle duplicate hash — ask user to confirm
      if (res.status === 409) {
        const dup = await res.json()
        const proceed = window.confirm(
          `${dup.message}\n\nDo you want to upload it anyway?`
        )
        if (!proceed) { setUploading(false); return }
        // Re-upload with allowDuplicate flag
        res = await fetch(`${url}?allowDuplicate=1`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        })
      }

      if (res.ok) {
        setSuccess(true)
        setFile(null)
        setName('')
        setDocType('')
        onUploaded?.()
      } else {
        const d = await res.json()
        setError(d.error || 'Upload failed')
      }
    } catch { setError('Network error') }
    setUploading(false)
  }

  return (
    <div className="rounded-xl border border-gray-200 p-5 space-y-4"
      style={{ background: '#FFFFFF' }}>
      <div className="flex items-center gap-2">
        <Paperclip size={14} className="text-[#0c7aed]" />
        <span className="text-sm font-medium text-gray-700">Attach Document <span className="text-gray-400 text-xs">(optional)</span></span>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
        onClick={() => document.getElementById(`file-input-${entityId}`)?.click()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
          dragOver ? 'border-[#0c7aed] bg-[#0c7aed]/5' : file ? 'border-green-500/40 bg-green-500/5' : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <input id={`file-input-${entityId}`} type="file" className="hidden"
          accept=".pdf,.doc,.docx,.xlsx,.xls,.jpg,.jpeg,.png,.csv"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        {file ? (
          <div className="flex items-center justify-center gap-2">
            <FileCheck size={16} className="text-green-400" />
            <span className="text-sm text-green-400">{file.name}</span>
            <button onClick={e => { e.stopPropagation(); setFile(null); setName('') }}
              className="text-gray-400 hover:text-gray-600 ml-1">
              <X size={14} />
            </button>
          </div>
        ) : (
          <div>
            <Upload size={20} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Drop file here or <span className="text-[#0c7aed]">browse</span></p>
            <p className="text-xs text-gray-300 mt-1">PDF, Word, Excel, Image — max 20MB</p>
          </div>
        )}
      </div>

      {file && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Document Name *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Invoice #1234" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Document Type</label>
            <select value={docType} onChange={e => setDocType(e.target.value)} className={inputCls}>
              <option value="">Select type</option>
              {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      {success && (
        <div className="flex items-center gap-2 text-green-400 text-sm">
          <FileCheck size={14} /> Document uploaded and SHA-256 fingerprinted ✓
        </div>
      )}

      {file && (
        <button onClick={upload} disabled={uploading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-all"
          style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
          <Upload size={14} />
          {uploading ? 'Uploading…' : 'Upload Document'}
        </button>
      )}
    </div>
  )
}
