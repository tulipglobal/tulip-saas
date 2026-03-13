'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Upload, FileCheck, X, Paperclip, WifiOff, Clock, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { queueDocument } from '@/lib/syncService'

interface Props {
  entityType: 'project' | 'expense'
  entityId: string
  onUploaded?: () => void
}

interface FileEntry {
  file: File
  name: string
  status: 'queued' | 'uploading' | 'sealed' | 'failed' | 'offline_queued'
  error?: string
}

const DOC_TYPES = ['Invoice', 'Receipt', 'Contract', 'Report', 'Proposal', 'Registration', 'Tax Certificate', 'Donor Agreement', 'Payment Proof', 'Photo', 'Other']
const MAX_FILES = 10
const MAX_SIZE = 20 * 1024 * 1024

function formatSize(bytes: number) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(1)} KB`
}

export default function DocumentUploadSection({ entityType, entityId, onUploaded }: Props) {
  const t = useTranslations()
  const [isOnline, setIsOnline] = useState(
    typeof window !== 'undefined' ? navigator.onLine : true
  )
  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline) }
  }, [])

  const [entries, setEntries] = useState<FileEntry[]>([])
  const [docType, setDocType] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)

  const inputCls = "w-full bg-[#e1eedd] border border-[#c8d6c0] rounded-lg px-4 py-2.5 text-sm text-[#183a1d] placeholder-[#183a1d]/40 outline-none focus:border-[#f6c453] transition-all"
  const labelCls = "block text-xs font-medium text-[#183a1d]/60 mb-1.5 uppercase tracking-wide"

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList)
    setError('')
    setEntries(prev => {
      const space = MAX_FILES - prev.length
      if (space <= 0) { setError(`Maximum ${MAX_FILES} files`); return prev }
      const toAdd = files.slice(0, space)
      const newEntries: FileEntry[] = []
      for (const f of toAdd) {
        if (f.size > MAX_SIZE) { setError(`${f.name} exceeds 20MB`); continue }
        if (prev.some(e => e.file.name === f.name && e.file.size === f.size)) continue
        const autoName = f.name.replace(/\.[^.]+$/, '')
        newEntries.push({ file: f, name: autoName, status: 'queued' })
      }
      return [...prev, ...newEntries]
    })
  }, [])

  const removeFile = (index: number) => {
    setEntries(prev => prev.filter((_, i) => i !== index))
  }

  const updateName = (index: number, name: string) => {
    setEntries(prev => prev.map((e, i) => i === index ? { ...e, name } : e))
  }

  const upload = async () => {
    const queuedEntries = entries.filter(e => e.status === 'queued')
    if (queuedEntries.length === 0) { setError('Please select files'); return }
    if (queuedEntries.some(e => !e.name.trim())) { setError('All files need a name'); return }
    setUploading(true)
    setError('')

    for (let i = 0; i < entries.length; i++) {
      if (entries[i].status !== 'queued') continue

      // Offline → queue each file in IndexedDB
      if (!isOnline) {
        try {
          const blob = new Blob([await entries[i].file.arrayBuffer()], { type: entries[i].file.type })
          await queueDocument({
            entityType, entityId,
            documentName: entries[i].name.trim(),
            documentType: docType || 'Other',
            fileBlob: blob, fileType: entries[i].file.type, fileName: entries[i].file.name,
            status: 'pending', createdAt: Date.now(), retries: 0,
          })
          setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, status: 'offline_queued' } : e))
        } catch {
          setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, status: 'failed', error: 'Failed to save offline' } : e))
        }
        continue
      }

      // Online → upload
      setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, status: 'uploading' } : e))
      try {
        const token = localStorage.getItem('tulip_token')
        const fd = new FormData()
        fd.append('file', entries[i].file)
        fd.append('name', entries[i].name.trim())
        fd.append('documentType', docType || 'Other')
        fd.append('documentLevel', entityType)
        if (entityType === 'project') fd.append('projectId', entityId)
        if (entityType === 'expense') fd.append('expenseId', entityId)

        let url = `${process.env.NEXT_PUBLIC_API_URL}/api/documents`
        let res = await fetch(url, {
          method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
        })
        if (res.status === 409) {
          res = await fetch(`${url}?allowDuplicate=1`, {
            method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
          })
        }

        if (res.ok) {
          setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, status: 'sealed' } : e))
        } else {
          const d = await res.json()
          setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, status: 'failed', error: d.error || 'Upload failed' } : e))
        }
      } catch {
        setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, status: 'failed', error: 'Network error' } : e))
      }
    }

    setUploading(false)
    onUploaded?.()
  }

  const sealedCount = entries.filter(e => e.status === 'sealed').length
  const queuedOfflineCount = entries.filter(e => e.status === 'offline_queued').length
  const allDone = entries.length > 0 && entries.every(e => e.status !== 'queued' && e.status !== 'uploading')

  return (
    <div className="rounded-xl border border-[#c8d6c0] p-5 space-y-4"
      style={{ background: '#e1eedd' }}>
      <div className="flex items-center gap-2">
        <Paperclip size={14} className="text-[#183a1d]" />
        <span className="text-sm font-medium text-[#183a1d]">{t('documents.attachDocuments')} <span className="text-[#183a1d]/40 text-xs">({t('documents.upToFiles', { count: MAX_FILES })})</span></span>
      </div>

      {!isOnline && (
        <div className="rounded-lg bg-amber-100 border border-amber-300 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
          <WifiOff size={14} /> {t('documents.offlineQueued')}
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files) }}
        onClick={() => document.getElementById(`file-input-${entityId}`)?.click()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
          dragOver ? 'border-[#f6c453] bg-[#f6c453]/10' : 'border-[#c8d6c0] hover:border-[#183a1d]/30'
        }`}
      >
        <input id={`file-input-${entityId}`} type="file" multiple className="hidden"
          accept="image/*,video/*,.pdf,.doc,.docx,.xlsx,.xls,.csv"
          onChange={e => { if (e.target.files && e.target.files.length > 0) { addFiles(e.target.files); e.target.value = '' } }} />
        <Upload size={20} className="text-[#183a1d]/30 mx-auto mb-2" />
        <p className="text-sm text-[#183a1d]/60">{t('documents.dropOrBrowse')}</p>
        <p className="text-xs text-[#183a1d]/30 mt-1">{t('documents.fileFormats')}</p>
      </div>

      {/* File list */}
      {entries.length > 0 && (
        <div className="space-y-2">
          {entries.map((entry, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2" style={{
              background: entry.status === 'sealed' ? 'rgba(52,211,153,0.1)' : entry.status === 'failed' ? 'rgba(239,68,68,0.1)' : entry.status === 'offline_queued' ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.5)',
              border: '1px solid rgba(0,0,0,0.06)' }}>
              {entry.status === 'queued' && <FileCheck size={14} className="text-[#183a1d]/40 shrink-0" />}
              {entry.status === 'uploading' && <Loader2 size={14} className="text-[#0d9488] shrink-0 animate-spin" />}
              {entry.status === 'sealed' && <CheckCircle size={14} className="text-green-500 shrink-0" />}
              {entry.status === 'failed' && <AlertCircle size={14} className="text-red-500 shrink-0" />}
              {entry.status === 'offline_queued' && <Clock size={14} className="text-amber-600 shrink-0" />}
              <div className="flex-1 min-w-0">
                {entry.status === 'queued' && !uploading ? (
                  <input value={entry.name} onChange={e => updateName(i, e.target.value)}
                    className={inputCls} style={{ padding:'4px 8px', fontSize:12 }} />
                ) : (
                  <p className="text-xs text-[#183a1d] font-medium truncate m-0">{entry.name}</p>
                )}
                <p className="text-[10px] m-0 mt-0.5" style={{ color: entry.status === 'failed' ? '#ef4444' : '#183a1d80' }}>
                  {formatSize(entry.file.size)}
                  {entry.status === 'sealed' && ` — ${t('documents.sealed')}`}
                  {entry.status === 'failed' && ` — ${entry.error}`}
                  {entry.status === 'offline_queued' && ` — ${t('documents.queuedOffline')}`}
                </p>
              </div>
              {entry.status === 'queued' && !uploading && (
                <button onClick={() => removeFile(i)} className="text-[#183a1d]/30 hover:text-[#183a1d] shrink-0">
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Doc type selector — shared across all files */}
      {entries.length > 0 && entries.some(e => e.status === 'queued') && (
        <div>
          <label className={labelCls}>{t('documents.docTypeAll')}</label>
          <select value={docType} onChange={e => setDocType(e.target.value)} className={inputCls}>
            <option value="">{t('common.selectType')}</option>
            {DOC_TYPES.map(dt => <option key={dt} value={dt}>{dt}</option>)}
          </select>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      {allDone && sealedCount > 0 && (
        <div className="flex items-center gap-2 text-green-400 text-sm">
          <FileCheck size={14} /> {t('documents.docsSealed', { count: sealedCount })}
        </div>
      )}

      {allDone && queuedOfflineCount > 0 && (
        <div className="flex items-center gap-2 text-amber-600 text-sm">
          <Clock size={14} /> {t('documents.docsSavedOffline', { count: queuedOfflineCount })}
        </div>
      )}

      {entries.some(e => e.status === 'queued') && (
        <button onClick={upload} disabled={uploading}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[#183a1d] disabled:opacity-50 transition-all ${
            isOnline ? 'bg-[#f6c453] hover:bg-[#f0a04b]' : 'bg-amber-400 hover:bg-amber-500'
          }`}>
          {isOnline ? <Upload size={14} /> : <WifiOff size={14} />}
          {uploading ? t('expenses.uploading') : isOnline
            ? entries.filter(e => e.status === 'queued').length > 1
              ? t('documents.uploadAll', { count: entries.filter(e => e.status === 'queued').length })
              : t('documents.uploadDocument')
            : t('documents.saveOffline', { count: entries.filter(e => e.status === 'queued').length })}
        </button>
      )}
    </div>
  )
}
