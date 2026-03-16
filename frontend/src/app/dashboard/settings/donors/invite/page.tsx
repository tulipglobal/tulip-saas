'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiGet, apiPost } from '@/lib/api'
import { ArrowLeft, Send, Check, AlertCircle } from 'lucide-react'

interface Project {
  id: string
  name: string
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t) }, [onClose])
  return (
    <div className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium shadow-lg ${type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
      {type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
      {message}
    </div>
  )
}

export default function InviteDonorPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const [donorOrgName, setDonorOrgName] = useState('')
  const [email, setEmail] = useState('')
  const [selectedProjects, setSelectedProjects] = useState<string[]>([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    apiGet('/api/projects')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(d => {
        const list = d.data || d.projects || d || []
        setProjects(Array.isArray(list) ? list : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const toggleProject = (id: string) => {
    setSelectedProjects(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!donorOrgName || !email || !selectedProjects.length) {
      setToast({ message: 'Please fill all required fields and select at least one project', type: 'error' })
      return
    }
    setSubmitting(true)
    try {
      const res = await apiPost('/api/donor/invite', {
        email,
        donorOrgName,
        projectIds: selectedProjects,
        message: message || undefined
      })
      if (res.ok) {
        router.push('/dashboard/settings/donors')
      } else {
        const err = await res.json()
        setToast({ message: err.error || 'Failed to send invite', type: 'error' })
      }
    } catch {
      setToast({ message: 'Failed to send invite', type: 'error' })
    }
    setSubmitting(false)
  }

  const inputClass = 'w-full bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-lg px-4 py-2.5 text-sm text-[var(--tulip-forest)] placeholder-[var(--tulip-forest)]/40 outline-none focus:border-[var(--tulip-gold)] focus:ring-1 focus:ring-[var(--tulip-gold)] transition-all'

  return (
    <div className="p-6 space-y-6 animate-fade-up max-w-2xl">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings/donors" className="text-[var(--tulip-forest)]/40 hover:text-[var(--tulip-forest)] transition-all">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[var(--tulip-forest)]" style={{ fontFamily: 'Inter, sans-serif' }}>Invite Donor</h1>
          <p className="text-[var(--tulip-forest)]/60 text-sm mt-0.5">Share project access with a donor organisation</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-xl border border-[var(--tulip-sage-dark)] px-5 py-5 space-y-4 bg-[var(--tulip-sage)]">
          <div>
            <label className="text-xs text-[var(--tulip-forest)]/40 block mb-1">Donor Organisation Name *</label>
            <input
              className={inputClass}
              value={donorOrgName}
              onChange={e => setDonorOrgName(e.target.value)}
              placeholder="e.g. Gates Foundation"
              required
            />
          </div>

          <div>
            <label className="text-xs text-[var(--tulip-forest)]/40 block mb-1">Contact Email *</label>
            <input
              className={inputClass}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="contact@donor.org"
              required
            />
          </div>

          <div>
            <label className="text-xs text-[var(--tulip-forest)]/40 block mb-1.5">Select Projects * </label>
            {loading ? (
              <p className="text-[var(--tulip-forest)]/40 text-sm">Loading projects...</p>
            ) : projects.length === 0 ? (
              <p className="text-[var(--tulip-forest)]/40 text-sm">No projects found. Create a project first.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {projects.map(p => (
                  <label
                    key={p.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                      selectedProjects.includes(p.id)
                        ? 'border-[var(--tulip-gold)] bg-[var(--tulip-gold)]/10'
                        : 'border-[var(--tulip-sage-dark)] hover:border-[var(--tulip-gold)]/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedProjects.includes(p.id)}
                      onChange={() => toggleProject(p.id)}
                      className="accent-[var(--tulip-gold)] w-4 h-4"
                    />
                    <span className="text-sm text-[var(--tulip-forest)]">{p.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs text-[var(--tulip-forest)]/40 block mb-1">Message (optional)</label>
            <textarea
              className={inputClass + ' min-h-[80px] resize-y'}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Optional message to include in the invite email..."
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting || !donorOrgName || !email || !selectedProjects.length}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-[var(--tulip-gold)] text-[var(--tulip-forest)] hover:bg-[var(--tulip-orange)] disabled:opacity-50 transition-all"
          >
            <Send size={14} />
            {submitting ? 'Sending...' : 'Send Invite'}
          </button>
          <Link href="/dashboard/settings/donors" className="px-4 py-2.5 rounded-lg text-sm text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)] hover:bg-[var(--tulip-sage-dark)]/40 transition-all">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
