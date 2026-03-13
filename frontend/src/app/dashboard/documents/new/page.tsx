'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Upload, FileText, CheckCircle, AlertCircle, Building2, FolderOpen, Receipt } from 'lucide-react'
import { apiGet } from '@/lib/api'

interface Project { id: string; name: string }
interface Expense { id: string; description: string; amount: number; currency: string }

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

export default function AddDocumentPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [level, setLevel] = useState<'ngo'|'project'|'expense'>('project')
  const [projects, setProjects] = useState<Project[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [selectedProject, setSelectedProject] = useState('')
  const [selectedExpense, setSelectedExpense] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [documentType, setDocumentType] = useState('')
  const [category, setCategory] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [file, setFile] = useState<File|null>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    apiGet('/api/projects').then(r => r.ok ? r.json() : null).then(d => setProjects(d?.data ?? d?.items ?? []))
  }, [])

  useEffect(() => {
    setExpenses([])
    setSelectedExpense('')
    if (level === 'expense' && selectedProject) {
      apiGet(`/api/expenses?projectId=${selectedProject}`).then(r => r.ok ? r.json() : null).then(d => {
        const items = d?.data ?? d?.items ?? []
        setExpenses(items)
      })
    }
  }, [level, selectedProject])

  const handleFile = (f: File) => { setFile(f); if (!name) setName(f.name.replace(/\.[^.]+$/, '')) }
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }

  const handleSubmit = async () => {
    if (!name) return setError('Document name is required')
    if (!file) return setError('Please select a file to upload')
    if (level === 'project' && !selectedProject) return setError('Please select a project')
    if (level === 'expense' && !selectedExpense) return setError('Please select an expense')
    setLoading(true); setError('')
    try {
      const token = localStorage.getItem('tulip_token')
      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', name)
      formData.append('description', description)
      formData.append('documentType', documentType)
      formData.append('documentLevel', level)
      if (category) formData.append('category', category)
      if (category && KEY_DOCUMENT_CATEGORIES.includes(category) && expiryDate) formData.append('expiryDate', expiryDate)
      if (level === 'project' || level === 'expense') formData.append('projectId', selectedProject)
      if (level === 'expense') formData.append('expenseId', selectedExpense)
      let res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/documents`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
      })
      // Handle duplicate hash
      if (res.status === 409) {
        const dup = await res.json()
        const proceed = window.confirm(`${dup.message}\n\nDo you want to upload it anyway?`)
        if (!proceed) { setLoading(false); return }
        res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/documents?allowDuplicate=1`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
        })
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setSuccess(true)
      setTimeout(() => router.push('/dashboard/documents'), 1500)
    } catch (err: any) { setError(err.message) } finally { setLoading(false) }
  }

  const levelConfig = {
    ngo: { icon: Building2, label: 'NGO Document', desc: 'Organisation-level documents', color: '#6366f1' },
    project: { icon: FolderOpen, label: 'Project Document', desc: 'Project reports, proposals', color: '#0d9488' },
    expense: { icon: Receipt, label: 'Expense Document', desc: 'Receipts, invoices, payment proof', color: '#f59e0b' },
  }

  if (success) return (
    <div style={{ minHeight:'100vh', background:'#F9FAFB', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ textAlign:'center' }}>
        <CheckCircle size={64} style={{ color:'#34d399', margin:'0 auto 16px' }} />
        <p style={{ color:'#111827', fontSize:20, fontWeight:600 }}>Document uploaded successfully</p>
        <p style={{ color:'#64748b', fontSize:14, marginTop:8 }}>SHA-256 hash generated and queued for blockchain anchoring</p>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#F9FAFB', padding:'32px' }}>
      <div style={{ maxWidth:720, margin:'0 auto' }}>
        <div style={{ marginBottom:32 }}>
          <Link href="/dashboard/documents" style={{ display:'inline-flex', alignItems:'center', gap:6, color:'#64748b', fontSize:14, textDecoration:'none', marginBottom:16 }}>
            <ArrowLeft size={16} /> Back to Documents
          </Link>
          <h1 style={{ color:'#111827', fontSize:28, fontWeight:700, margin:0 }}>Add Document</h1>
          <p style={{ color:'#64748b', fontSize:14, marginTop:4 }}>SHA-256 hash will be generated and anchored to blockchain</p>
        </div>

        <div style={{ marginBottom:24 }}>
          <p style={{ color:'#6B7280', fontSize:12, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:12 }}>Document Level</p>
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
            <label style={{ color:'#6B7280', fontSize:12, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:8 }}>Project *</label>
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
          <label style={{ color:'#6B7280', fontSize:12, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:8 }}>Document Type</label>
          <select value={documentType} onChange={e => setDocumentType(e.target.value)}
            style={{ width:'100%', padding:'10px 14px', borderRadius:8, border:'1px solid #E5E7EB', background:'#F9FAFB', color:'#111827', fontSize:14 }}>
            <option value="">Select type...</option>
            {DOCUMENT_TYPES[level].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div style={{ marginBottom:16 }}>
          <label style={{ color:'#6B7280', fontSize:12, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:8 }}>Category</label>
          <select value={category} onChange={e => { setCategory(e.target.value); if (!KEY_DOCUMENT_CATEGORIES.includes(e.target.value)) setExpiryDate('') }}
            style={{ width:'100%', padding:'10px 14px', borderRadius:8, border:'1px solid #E5E7EB', background:'#F9FAFB', color:'#111827', fontSize:14 }}>
            {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        {KEY_DOCUMENT_CATEGORIES.includes(category) && (
          <div style={{ marginBottom:16 }}>
            <label style={{ color:'#6B7280', fontSize:12, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:8 }}>Expiry Date</label>
            <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)}
              style={{ width:'100%', padding:'10px 14px', borderRadius:8, border:'1px solid #E5E7EB', background:'#F9FAFB', color:'#111827', fontSize:14, boxSizing:'border-box' }} />
          </div>
        )}

        <div style={{ marginBottom:16 }}>
          <label style={{ color:'#6B7280', fontSize:12, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:8 }}>Document Name *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Q1 2026 Financial Report"
            style={{ width:'100%', padding:'10px 14px', borderRadius:8, border:'1px solid #E5E7EB', background:'#F9FAFB', color:'#111827', fontSize:14, boxSizing:'border-box' }} />
        </div>

        <div style={{ marginBottom:24 }}>
          <label style={{ color:'#6B7280', fontSize:12, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:8 }}>Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Brief description..."
            style={{ width:'100%', padding:'10px 14px', borderRadius:8, border:'1px solid #E5E7EB', background:'#F9FAFB', color:'#111827', fontSize:14, resize:'vertical', boxSizing:'border-box' }} />
        </div>

        <div style={{ marginBottom:24 }}>
          <label style={{ color:'#6B7280', fontSize:12, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:8 }}>File *</label>
          <div onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={handleDrop} onClick={() => fileRef.current?.click()}
            style={{ border:`2px dashed ${dragging ? '#0d9488' : file ? '#34d399' : '#E5E7EB'}`, borderRadius:12, padding:'40px 24px', textAlign:'center', cursor:'pointer',
              background: dragging ? 'rgba(13,148,136,0.05)' : file ? 'rgba(52,211,153,0.05)' : '#FFFFFF' }}>
            {file ? (
              <div>
                <CheckCircle size={32} style={{ color:'#34d399', margin:'0 auto 8px' }} />
                <p style={{ color:'#111827', fontWeight:600, margin:0 }}>{file.name}</p>
                <p style={{ color:'#64748b', fontSize:12, marginTop:4 }}>{(file.size/1024).toFixed(1)} KB • SHA-256 will be computed on upload</p>
                <button onClick={e => { e.stopPropagation(); setFile(null) }} style={{ marginTop:8, background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize:12 }}>Remove</button>
              </div>
            ) : (
              <div>
                <Upload size={32} style={{ color:'#475569', margin:'0 auto 12px' }} />
                <p style={{ color:'#6B7280', fontWeight:500, margin:0 }}>Drop file here or click to browse</p>
                <p style={{ color:'#475569', fontSize:12, marginTop:4 }}>PDF, DOC, DOCX, XLSX, JPG, PNG — max 20MB</p>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" style={{ display:'none' }} accept=".pdf,.doc,.docx,.xlsx,.xls,.jpg,.jpeg,.png,.csv"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        </div>

        <div style={{ padding:'12px 16px', borderRadius:8, background:'rgba(13,148,136,0.08)', border:'1px solid rgba(13,148,136,0.2)', marginBottom:24, display:'flex', gap:10 }}>
          <FileText size={16} style={{ color:'#0d9488', marginTop:2, flexShrink:0 }} />
          <div>
            <p style={{ color:'#0d9488', fontSize:13, fontWeight:600, margin:0 }}>Blockchain Proof</p>
            <p style={{ color:'#64748b', fontSize:12, margin:'2px 0 0' }}>SHA-256 fingerprint anchored to Polygon. Donors can verify this document has not been altered.</p>
          </div>
        </div>

        {error && (
          <div style={{ padding:'12px 16px', borderRadius:8, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', marginBottom:16, display:'flex', gap:8, alignItems:'center' }}>
            <AlertCircle size={16} style={{ color:'#ef4444' }} />
            <p style={{ color:'#ef4444', fontSize:13, margin:0 }}>{error}</p>
          </div>
        )}

        <div style={{ display:'flex', gap:12 }}>
          <Link href="/dashboard/documents" style={{ flex:1, padding:'12px', borderRadius:8, border:'1px solid #E5E7EB', color:'#6B7280', fontSize:14, fontWeight:500, textAlign:'center', textDecoration:'none', display:'block' }}>Cancel</Link>
          <button onClick={handleSubmit} disabled={loading}
            style={{ flex:2, padding:'12px', borderRadius:8, background: loading ? '#1e293b' : '#0d9488', color:'#111827', fontSize:14, fontWeight:600, border:'none', cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Uploading & hashing...' : 'Upload Document'}
          </button>
        </div>
      </div>
    </div>
  )
}
