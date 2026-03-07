'use client'

import { useState, useEffect } from 'react'
import { apiGet } from '@/lib/api'
import Link from 'next/link'
import { FolderOpen, Plus, ArrowUpRight, CheckCircle, Clock, AlertTriangle, Search } from 'lucide-react'

interface Project {
  id: string
  name: string
  description: string | null
  status: string
  budget: number | null
  currency: string
  startDate: string | null
  endDate: string | null
  createdAt: string
  _count?: { expenses: number; documents: number }
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active:    'bg-green-400/10 text-green-400 border-green-400/20',
    completed: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
    archived:  'bg-white/5 text-white/40 border-white/10',
    draft:     'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium capitalize ${map[status] ?? map.draft}`}>
      {status}
    </span>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#0c7aed]/10 flex items-center justify-center mb-4">
        <FolderOpen size={28} className="text-[#369bff]" />
      </div>
      <h3 className="text-white font-semibold text-lg mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>No projects yet</h3>
      <p className="text-white/40 text-sm mb-6 max-w-xs">Create your first project to start tracking expenses and documents with blockchain verification.</p>
      <Link href="/dashboard/projects/new"
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
        style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
        <Plus size={16} /> New Project
      </Link>
    </div>
  )
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    apiGet('/api/projects?limit=50')
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => { setProjects(d.items ?? d ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.description ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Projects</h1>
          <p className="text-white/40 text-sm mt-1">{projects.length} project{projects.length !== 1 ? 's' : ''} total</p>
        </div>
        <Link href="/dashboard/projects/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ background: 'linear-gradient(135deg, #0c7aed, #004ea8)' }}>
          <Plus size={16} /> New Project
        </Link>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 max-w-sm">
        <Search size={15} className="text-white/30" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search projects..."
          className="bg-transparent text-sm text-white/70 placeholder-white/30 outline-none w-full"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="rounded-xl border border-white/8 p-5 space-y-3 animate-pulse"
              style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="h-4 bg-white/5 rounded w-3/4" />
              <div className="h-3 bg-white/5 rounded w-1/2" />
              <div className="h-3 bg-white/5 rounded w-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(project => (
            <Link key={project.id} href={`/dashboard/projects/${project.id}`}
              className="group rounded-xl border border-white/8 hover:border-white/15 p-5 space-y-4 transition-all hover:bg-white/2"
              style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-lg bg-[#0c7aed]/10 flex items-center justify-center">
                  <FolderOpen size={18} className="text-[#369bff]" />
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={project.status} />
                  <ArrowUpRight size={14} className="text-white/20 group-hover:text-white/50 transition-colors" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-white text-sm" style={{ fontFamily: 'Syne, sans-serif' }}>{project.name}</h3>
                {project.description && (
                  <p className="text-white/40 text-xs mt-1 line-clamp-2">{project.description}</p>
                )}
              </div>
              <div className="flex items-center gap-4 pt-2 border-t border-white/5">
                <div className="flex items-center gap-1.5 text-xs text-white/30">
                  <CheckCircle size={12} className="text-green-400" />
                  {project._count?.documents ?? 0} docs
                </div>
                <div className="flex items-center gap-1.5 text-xs text-white/30">
                  <Clock size={12} className="text-blue-400" />
                  {project._count?.expenses ?? 0} expenses
                </div>
                {project.budget && (
                  <div className="ml-auto text-xs font-medium text-white/50">
                    {project.currency} {project.budget.toLocaleString()}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
