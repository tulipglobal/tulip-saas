'use client'

import { useState, useEffect } from 'react'
import { apiGet } from '@/lib/api'
import Link from 'next/link'
import { FolderOpen, Plus, ArrowUpRight, CheckCircle, Clock, AlertTriangle, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface BudgetSummary {
  budgetCapex: number
  budgetOpex: number
  budgetTotal: number
  actualCapex: number
  actualOpex: number
  actualTotal: number
}

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
  budgetSummary: BudgetSummary | null
  _count?: { expenses: number; documents: number }
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active:    'bg-green-400/10 text-green-400 border-green-400/20',
    completed: 'bg-[#f6c453]/10 text-[#183a1d] border-[#f6c453]/30',
    archived:  'bg-[#e1eedd] text-[#183a1d]/60 border-[#c8d6c0]',
    draft:     'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium capitalize ${map[status] ?? map.draft}`}>
      {status}
    </span>
  )
}

function EmptyState() {
  const t = useTranslations()
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#f6c453]/10 flex items-center justify-center mb-4">
        <FolderOpen size={28} className="text-[#183a1d]" />
      </div>
      <h3 className="text-[#183a1d] font-semibold text-lg mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>{t('projects.noProjectsYet')}</h3>
      <p className="text-[#183a1d]/60 text-sm mb-6 max-w-xs">{t('projects.noProjectsDesc')}</p>
      <Link href="/dashboard/projects/new"
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[#183a1d] bg-[#f6c453] hover:bg-[#f0a04b]">
        <Plus size={16} /> {t('projects.new')}
      </Link>
    </div>
  )
}

export default function ProjectsPage() {
  const t = useTranslations()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    apiGet('/api/projects?limit=50')
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => { setProjects(d.data ?? d.items ?? []); setLoading(false) })
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
          <h1 className="text-2xl font-bold text-[#183a1d]" style={{ fontFamily: 'Inter, sans-serif' }}>{t('projects.title')}</h1>
          <p className="text-[#183a1d]/60 text-sm mt-1">{projects.length} project{projects.length !== 1 ? 's' : ''} total</p>
        </div>
        <Link href="/dashboard/projects/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[#183a1d] bg-[#f6c453] hover:bg-[#f0a04b]">
          <Plus size={16} /> {t('projects.new')}
        </Link>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 bg-[#e1eedd] border border-[#c8d6c0] rounded-lg px-4 py-2.5 max-w-sm">
        <Search size={15} className="text-[#183a1d]/40" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('projects.searchProjects')}
          className="bg-transparent text-sm text-[#183a1d] placeholder-[#183a1d]/40 outline-none w-full"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="rounded-xl border border-[#c8d6c0] p-5 space-y-3 animate-pulse"
              style={{ background: '#e1eedd' }}>
              <div className="h-4 bg-[#e1eedd] rounded w-3/4" />
              <div className="h-3 bg-[#e1eedd] rounded w-1/2" />
              <div className="h-3 bg-[#e1eedd] rounded w-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(project => (
            <Link key={project.id} href={`/dashboard/projects/${project.id}`}
              className="group rounded-xl border border-[#c8d6c0] hover:border-[#c8d6c0] p-5 space-y-4 transition-all hover:bg-[#e1eedd]/50"
              style={{ background: '#e1eedd' }}>
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-lg bg-[#f6c453]/10 flex items-center justify-center">
                  <FolderOpen size={18} className="text-[#183a1d]" />
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={project.status} />
                  <ArrowUpRight size={14} className="text-[#183a1d]/30 group-hover:text-[#183a1d]/60 transition-colors" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-[#183a1d] text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>{project.name}</h3>
                {project.description && (
                  <p className="text-[#183a1d]/60 text-xs mt-1 line-clamp-2">{project.description}</p>
                )}
              </div>
              <div className="flex items-center gap-4 pt-2 border-t border-[#c8d6c0]">
                <div className="flex items-center gap-1.5 text-xs text-[#183a1d]/40">
                  <CheckCircle size={12} className="text-green-400" />
                  {project._count?.documents ?? 0} {t('projects.docs')}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[#183a1d]/40">
                  <Clock size={12} className="text-[#183a1d]" />
                  {project._count?.expenses ?? 0} {t('projects.expenses')}
                </div>
              </div>
              {project.budgetSummary && project.budgetSummary.budgetTotal > 0 && (
                <div className="pt-2 border-t border-[#c8d6c0] space-y-0.5">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-[#183a1d]/40">{t('budgets.budget')}</span>
                    <span className="text-[#183a1d]/60">
                      CapEx ${project.budgetSummary.budgetCapex.toLocaleString()} | OpEx ${project.budgetSummary.budgetOpex.toLocaleString()} | Total ${project.budgetSummary.budgetTotal.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-[#183a1d]/40">Actual</span>
                    <span className="text-[#183a1d]/60">
                      CapEx ${project.budgetSummary.actualCapex.toLocaleString()} | OpEx ${project.budgetSummary.actualOpex.toLocaleString()} | Total ${project.budgetSummary.actualTotal.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
