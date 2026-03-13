'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Upload, FileText, CheckCircle, AlertCircle, Building2, FolderOpen, Receipt, X, Loader2 } from 'lucide-react'
import { apiGet } from '@/lib/api'
import { useTranslations } from 'next-intl'

interface Project { id: string; name: string }
interface Expense { id: string; description: string; amount: number; currency: string }

interface FileEntry {
  file: File
  name: string
  status: 'queued' | 'uploading' | 'sealed' | 'failed'
  error?: string
  documentId?: string
  sealId?: string
}

const DOCUMENT_TYPES = {
  ngo: ['Registration Certificate','Tax Exemption Certificate','Audited Financial Statement','Annual Report','Board Resolution','MOU / Agreement','Photo','Other'],
  project: ['Project Proposal','Donor Agreement','Progress Report','Completion Certificate','Budget Plan','Procurement Document','Photo','Other'],
  expense: ['Invoice','Receipt','Payment Proof','Purchase Order','Bank Transfer','Petty Cash Voucher','Photo','Other'],
}

const KEY_DOCUMENT_CATEGORIES = ['licence','certificate','contract','permit','insurance','visa','id_document','mou']
const CATEGORY_OPTIONS = [
  { value: '', label: 'General' },
  { value: 'licence', label: 'Licence' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'contract', label: 'Contract' },
  { value: 'permit', label: 'Permit' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'visa', label: 'Visa' },
  { value: 'id_document', label: 'ID Document' },
  { value: 'mou', label: 'MOU' },
]

const MAX_FILES = 10
const MAX_SIZE = 20 * 1024 * 1024

function formatSize(bytes: number) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(1)} KB`
}

export default function AddDocumentPage() {
  const router = useRouter()
  const t = useTranslations()
  const fileRef = useRef<HTMLInputElement>(null)
  const [level, setLevel] = useState<'ngo'|'project'|'expense'>('project')
  const [projects, setProjects] = useState<Project[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [selectedProject, setSelectedProject] = useState('')
  const [selectedExpense, setSelectedExpense] = useState('')
  const [description, setDescription] = useState('')
  const [documentType, setDocumentType] = useState('')
  const [category, setCategory] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    apiGet('/api/projects').then(r => r.ok ? r.json() : null).then(d => setProjects(d?.data ?? d?.items ?? []))
  }, [])

  useEffect(() => {
    setExpenses([])
    setSelectedExpense('')
    if (level === 'expense' && selectedProject) {
      apiGet(`/api/expenses?projectId=${selectedProject}`).then(r => r.ok ? r.json() : null).then(d => {
        setExpenses(d?.data ?? d?.items ?? [])
      })
    }
  }, [level, selectedProject])

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList)
    setError('')
    setEntries(prev => {
      const existing = prev.length
      const space = MAX_FILES - existing
      if (space <= 0) { setError(`Maximum ${MAX_FILES} files per batch`); return prev }
      const toAdd = files.slice(0, space)
      if (files.length > space) setError(`Only ${space} more file(s) can be added (max ${MAX_FILES})`)
      const newEntries: FileEntry[] = []
      for (const f of toAdd) {
        if (f.size > MAX_SIZE) { setError(`${f.name} exceeds 20MB limit`); continue }
        if (prev.some(e => e.file.name === f.name && e.file.size === f.size)) continue
        newEntries.push({ file: f, name: f.name.replace(/\.[^.]+$/, ''), status: 'queued' })
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files)
  }

  const handleSubmit = async () => {
    if (entries.length === 0) return setError('Please select files to upload')
    if (level === 'project' && !selectedProject) return setError('Please select a project')
    if (level === 'expense' && !selectedExpense) return setError('Please select an expense')
    const hasEmptyName = entries.some(e => !e.name.trim())
    if (hasEmptyName) return setError('All files need a document name')

    setUploading(true); setError('')
    const token = localStorage.getItem('tulip_token')

    // Upload files one at a time so we can show per-file progress
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      if (entry.status !== 'queued') continue
      setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, status: 'uploading' } : e))

      try {
        const fd = new FormData()
        fd.append('file', entry.file)
        fd.append('name', entry.name.trim())
        fd.append('description', description)
        fd.append('documentType', documentType)
        fd.append('documentLevel', level)
        if (category) fd.append('category', category)
        if (category && KEY_DOCUMENT_CATEGORIES.includes(category) && expiryDate) fd.append('expiryDate', expiryDate)
        if (level === 'project' || level === 'expense') fd.append('projectId', selectedProject)
        if (level === 'expense') fd.append('expenseId', selectedExpense)

        let res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/documents`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
        })

        // Auto-allow duplicates in bulk mode
        if (res.status === 409) {
          res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/documents?allowDuplicate=1`, {
            method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
          })
        }

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Upload failed')
        setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, status: 'sealed', documentId: data.id } : e))
      } catch (err: any) {
        setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, status: 'failed', error: err.message } : e))
      }
    }

    setUploading(false)
    setDone(true)
  }

  const sealedCount = entries.filter(e => e.status === 'sealed').length
  const failedCount = entries.filter(e => e.status === 'failed').length

  const levelConfig = {
    ngo: { icon: Building2, label: t('documents.ngoDocument'), desc: t('documents.ngoDocDesc'), color: '#6366f1' },
    project: { icon: FolderOpen, label: t('documents.projectDocument'), desc: t('documents.projectDocDesc'), color: '#0d9488' },
    expense: { icon: Receipt, label: t('documents.expenseDocument'), desc: t('documents.expenseDocDesc'), color: '#f59e0b' },
  }

  if (done && failedCount === 0) return (
    <div style={{ minHeight:'100vh', background:'#F9FAFB', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ textAlign:'center' }}>
        <CheckCircle size={64} style={{ color:'#34d399', margin:'0 auto 16px' }} />
        <p style={{ color:'#111827', fontSize:20, fontWeight:600 }}>{t('documents.sealedCount', { sealed: sealedCount, total: entries.length })}</p>
        <p style={{ color:'#64748b', fontSize:14, marginTop:8 }}>{t('documents.hashesQueued')}</p>
        <button onClick={() => router.push('/dashboard/documents')}
          style={{ marginTop:24, padding:'10px 24px', borderRadius:8, background:'#0d9488', color:'#fff', border:'none', cursor:'pointer', fontSize:14, fontWeight:500 }}>
          {t('documents.viewDocuments')}
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#F9FAFB', padding:'32px' }}>
      <div style={{ maxWidth:720, margin:'0 auto' }}>
        <div style={{ marginBottom:32 }}>
          <Link href="/dashboard/documents" style={{ display:'inline-flex', alignItems:'center', gap:6, color:'#64748b', fontSize:14, textDecoration:'none', marginBottom:16 }}>
            <ArrowLeft size={16} /> {t('documents.backToDocuments')}
          </Link>
          <h1 style={{ color:'#111827', fontSize:28, fontWeight:700, margin:0 }}>{t('documents.addDocuments')}</h1>
          <p style={{ color:'#64748b', fontSize:14, marginTop:4 }}>{t('documents.addDocsDesc', { count: MAX_FILES })}</p>
        </div>

        <div style={{ marginBottom:24 }}>
          <p style={{ color:'#6B7280', fontSize:12, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:12 }}>{t('documents.documentLevel')}</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
            {(Object.entries(levelConfig) as any[]).map(([key, cfg]) => {
              const Icon = cfg.icon; const active = level === key
              return (
                <button key={key} onClick={() => { setLevel(key); setDocumentType('') }}
                  style={{ padding:'16px', borderRadius:12, border:`2px solid ${active ? cfg.color : '#E5E7EB'}`, background: active ? `${cfg.color}15` : '#FFFFFF', cursor:'pointer', textAlign:'left' }}>
                  <Icon size={20} style={{ color: active ? cfg.color : '#475569', marginBottom:8 }} />
                  <p style={{ color: active ? 'white' : '#6B7280', fontSize:13, fontWeight:600, margin:0 }}>{cfg.label}</p>
                  <p style={{ color:'#475569', fontSize:11, margin:'4px 0 0' }}>{cfg.desc}</p>
                </button>
              )
            })}
          </div>
        </div>

        {(level === 'project' || level === 'expense') && (
          <div style={{ marginBottom:16 }}>
            <label style={{ color:'#6B7280', fontSize:12, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:8 }}>{t('expenses.project')}</label>
            <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)}
              style={{ width:'100%', padding:'10px 14px', borderRadius:8, border:'1px solid #E5E7EB', background:'#F9FAFB', color:'#111827', fontSize:14 }}>
              <option value="">Select a project...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}

        {level === 'expense' && selectedProject && (
          <div style={{ marginBottom:16 }}>
            <label style={{ color:'#6B7280', fontSize:12, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:8 }}>Expense *</label>
            <select value={selectedExpense} onChange={e => setSelectedExpense(e.target.value)}
              style={{ width:'100%', padding:'10px 14px', borderRadius:8, border:'1px solid #E5E7EB', background:'#F9FAFB', color:'#111827', fontSize:14 }}>
              <option value="">Select an expense...</option>
              {expenses.map(e => <option key={e.id} value={e.id}>{e.description}</option>)}
            </select>
          </div>
        )}

        <div style={{ marginBottom:16 }}>
          <label style={{ color:'#6B7280', fontSize:12, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:8 }}>{t('documents.documentType')}</label>
          <select value={documentType} onChange={e => setDocumentType(e.target.value)}
            style={{ width:'100%', padding:'10px 14px', borderRadius:8, border:'1px solid #E5E7EB', background:'#F9FAFB', color:'#111827', fontSize:14 }}>
            <option value="">Select type...</option>
            {DOCUMENT_TYPES[level].map(dt => <option key={dt} value={dt}>{dt}</option>)}
          </select>
        </div>

        <div style={{ marginBottom:16 }}>
          <label style={{ color:'#6B7280', fontSize:12, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:8 }}>{t('common.category')}</label>
          <select value={category} onChange={e => { setCategory(e.target.value); if (!KEY_DOCUMENT_CATEGORIES.includes(e.target.value)) setExpiryDate('') }}
            style={{ width:'100%', padding:'10px 14px', borderRadius:8, border:'1px solid #E5E7EB', background:'#F9FAFB', color:'#111827', fontSize:14 }}>
            {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        {KEY_DOCUMENT_CATEGORIES.includes(category) && (
          <div style={{ marginBottom:16 }}>
            <label style={{ color:'#6B7280', fontSize:12, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:8 }}>{t('documents.expiryDate')}</label>
            <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)}
              style={{ width:'100%', padding:'10px 14px', borderRadius:8, border:'1px solid #E5E7EB', background:'#F9FAFB', color:'#111827', fontSize:14, boxSizing:'border-box' }} />
          </div>
        )}

        <div style={{ marginBottom:16 }}>
          <label style={{ color:'#6B7280', fontSize:12, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:8 }}>{t('documents.description')}</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Brief description (applies to all files)..."
            style={{ width:'100%', padding:'10px 14px', borderRadius:8, border:'1px solid #E5E7EB', background:'#F9FAFB', color:'#111827', fontSize:14, resize:'vertical', boxSizing:'border-box' }} />
        </div>

        {/* File drop zone */}
        <div style={{ marginBottom:24 }}>
          <label style={{ color:'#6B7280', fontSize:12, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:8 }}>{t('documents.files')} <span style={{ fontWeight:400, textTransform:'none' }}>({entries.length}/{MAX_FILES})</span></label>
          <div onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={handleDrop} onClick={() => fileRef.current?.click()}
            style={{ border:`2px dashed ${dragging ? '#0d9488' : '#E5E7EB'}`, borderRadius:12, padding:'32px 24px', textAlign:'center', cursor:'pointer',
              background: dragging ? 'rgba(13,148,136,0.05)' : '#FFFFFF' }}>
            <Upload size={32} style={{ color:'#475569', margin:'0 auto 12px' }} />
            <p style={{ color:'#6B7280', fontWeight:500, margin:0 }}>{t('documents.dropOrClickBrowse')}</p>
            <p style={{ color:'#475569', fontSize:12, marginTop:4 }}>{t('documents.fileFormats2', { count: MAX_FILES })}</p>
          </div>
          <input ref={fileRef} type="file" multiple style={{ display:'none' }} accept=".pdf,.doc,.docx,.xlsx,.xls,.jpg,.jpeg,.png,.csv"
            onChange={e => { if (e.target.files && e.target.files.length > 0) { addFiles(e.target.files); e.target.value = '' } }} />
        </div>

        {/* File list */}
        {entries.length > 0 && (
          <div style={{ marginBottom:24 }}>
            <div style={{ border:'1px solid #E5E7EB', borderRadius:12, overflow:'hidden' }}>
              {entries.map((entry, i) => (
                <div key={i} style={{ padding:'12px 16px', borderBottom: i < entries.length - 1 ? '1px solid #E5E7EB' : 'none', display:'flex', alignItems:'center', gap:12,
                  background: entry.status === 'sealed' ? 'rgba(52,211,153,0.05)' : entry.status === 'failed' ? 'rgba(239,68,68,0.05)' : '#FFFFFF' }}>
                  {entry.status === 'queued' && <FileText size={16} style={{ color:'#475569', flexShrink:0 }} />}
                  {entry.status === 'uploading' && <Loader2 size={16} style={{ color:'#0d9488', flexShrink:0, animation:'spin 1s linear infinite' }} />}
                  {entry.status === 'sealed' && <CheckCircle size={16} style={{ color:'#34d399', flexShrink:0 }} />}
                  {entry.status === 'failed' && <AlertCircle size={16} style={{ color:'#ef4444', flexShrink:0 }} />}
                  <div style={{ flex:1, minWidth:0 }}>
                    {entry.status === 'queued' && !uploading ? (
                      <input value={entry.name} onChange={e => updateName(i, e.target.value)}
                        style={{ width:'100%', padding:'4px 8px', borderRadius:6, border:'1px solid #E5E7EB', background:'#F9FAFB', color:'#111827', fontSize:13, boxSizing:'border-box' }} />
                    ) : (
                      <p style={{ color:'#111827', fontSize:13, fontWeight:500, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{entry.name}</p>
                    )}
                    <p style={{ color: entry.status === 'failed' ? '#ef4444' : '#64748b', fontSize:11, margin:'2px 0 0' }}>
                      {entry.file.name} — {formatSize(entry.file.size)}
                      {entry.status === 'uploading' && ' — uploading...'}
                      {entry.status === 'sealed' && ` — ${t('documents.sealed')}`}
                      {entry.status === 'failed' && ` — ${entry.error || t('documents.failed')}`}
                    </p>
                  </div>
                  {entry.status === 'queued' && !uploading && (
                    <button onClick={() => removeFile(i)} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:4 }}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary when done with some failures */}
        {done && failedCount > 0 && (
          <div style={{ padding:'12px 16px', borderRadius:8, background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', marginBottom:16, display:'flex', gap:8, alignItems:'center' }}>
            <AlertCircle size={16} style={{ color:'#f59e0b' }} />
            <p style={{ color:'#92400e', fontSize:13, margin:0 }}>{sealedCount} of {entries.length} documents sealed. {failedCount} failed.</p>
          </div>
        )}

        <div style={{ padding:'12px 16px', borderRadius:8, background:'rgba(13,148,136,0.08)', border:'1px solid rgba(13,148,136,0.2)', marginBottom:24, display:'flex', gap:10 }}>
          <FileText size={16} style={{ color:'#0d9488', marginTop:2, flexShrink:0 }} />
          <div>
            <p style={{ color:'#0d9488', fontSize:13, fontWeight:600, margin:0 }}>{t('documents.blockchainProof')}</p>
            <p style={{ color:'#64748b', fontSize:12, margin:'2px 0 0' }}>{t('documents.blockchainProofDesc')}</p>
          </div>
        </div>

        {error && (
          <div style={{ padding:'12px 16px', borderRadius:8, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', marginBottom:16, display:'flex', gap:8, alignItems:'center' }}>
            <AlertCircle size={16} style={{ color:'#ef4444' }} />
            <p style={{ color:'#ef4444', fontSize:13, margin:0 }}>{error}</p>
          </div>
        )}

        <div style={{ display:'flex', gap:12 }}>
          <Link href="/dashboard/documents" style={{ flex:1, padding:'12px', borderRadius:8, border:'1px solid #E5E7EB', color:'#6B7280', fontSize:14, fontWeight:500, textAlign:'center', textDecoration:'none', display:'block' }}>{t('common.cancel')}</Link>
          {done && failedCount > 0 ? (
            <button onClick={() => router.push('/dashboard/documents')}
              style={{ flex:2, padding:'12px', borderRadius:8, background:'#0d9488', color:'#fff', fontSize:14, fontWeight:600, border:'none', cursor:'pointer' }}>
              {t('common.done')}
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={uploading || entries.length === 0}
              style={{ flex:2, padding:'12px', borderRadius:8, background: uploading ? '#1e293b' : '#0d9488', color:'#111827', fontSize:14, fontWeight:600, border:'none', cursor: uploading ? 'not-allowed' : 'pointer' }}>
              {uploading ? t('documents.uploadingProgress', { current: entries.filter(e => e.status === 'sealed').length + 1, total: entries.length }) : entries.length > 1 ? t('documents.uploadAll', { count: entries.length }) : t('documents.uploadDocument')}
            </button>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
