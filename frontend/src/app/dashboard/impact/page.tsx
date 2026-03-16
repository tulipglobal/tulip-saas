'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { apiGet, apiPost } from '@/lib/api'
import { BarChart3, Plus, X, CheckCircle2, Loader2, TrendingUp, Target } from 'lucide-react'

interface Project {
  id: string
  name: string
}

interface Milestone {
  id: string
  projectId: string
  title: string
  description: string
  category: string
  currentValue: number
  targetValue: number
  targetUnit: string
  targetDate: string
  status: string
}

const CATEGORIES = [
  'People Reached',
  'Trained',
  'Employed',
  'Vaccinated',
  'Housed',
  'Sessions Conducted',
  'Custom',
]

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  'People Reached':     { bg: '#dbeafe', text: '#1e40af' },
  'Trained':            { bg: '#d1fae5', text: '#065f46' },
  'Employed':           { bg: '#fef3c7', text: '#92400e' },
  'Vaccinated':         { bg: '#f3e8ff', text: '#6b21a8' },
  'Housed':             { bg: '#fce7f3', text: '#9d174d' },
  'Sessions Conducted': { bg: 'var(--tulip-sage)', text: 'var(--tulip-forest)' },
  'Custom':             { bg: '#f1f5f9', text: '#475569' },
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'in_progress': { bg: '#fef3c7', text: '#92400e' },
  'completed':   { bg: '#d1fae5', text: '#065f46' },
  'not_started': { bg: 'var(--tulip-sage)', text: 'var(--tulip-forest)' },
  'overdue':     { bg: '#fee2e2', text: '#991b1b' },
}

export default function ImpactPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [milestones, setMilestones] = useState<Record<string, Milestone[]>>({})
  const [loading, setLoading] = useState(true)
  const [addModal, setAddModal] = useState<string | null>(null) // projectId
  const [updateModal, setUpdateModal] = useState<Milestone | null>(null)
  const [toast, setToast] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Add milestone form state
  const [newCategory, setNewCategory] = useState('People Reached')
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newTarget, setNewTarget] = useState('')
  const [newUnit, setNewUnit] = useState('')
  const [newTargetDate, setNewTargetDate] = useState('')

  // Update progress form state
  const [updateValue, setUpdateValue] = useState('')
  const [updateNote, setUpdateNote] = useState('')

  const fetchData = useCallback(async () => {
    try {
      const projectRes = await apiGet('/api/projects')
      if (!projectRes.ok) return
      const projectData = await projectRes.json()
      const projectList: Project[] = projectData.data || projectData.projects || projectData || []
      setProjects(Array.isArray(projectList) ? projectList : [])

      // Fetch milestones for each project
      const msMap: Record<string, Milestone[]> = {}
      await Promise.all(
        (Array.isArray(projectList) ? projectList : []).map(async (p: Project) => {
          try {
            const msRes = await apiGet(`/api/ngo/milestones/projects/${p.id}`)
            if (msRes.ok) {
              const msData = await msRes.json()
              msMap[p.id] = msData.milestones || msData.data || msData || []
            } else {
              msMap[p.id] = []
            }
          } catch {
            msMap[p.id] = []
          }
        })
      )
      setMilestones(msMap)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const openAddModal = (projectId: string) => {
    setAddModal(projectId)
    setNewCategory('People Reached')
    setNewTitle('')
    setNewDescription('')
    setNewTarget('')
    setNewUnit('')
    setNewTargetDate('')
  }

  const handleAddMilestone = async () => {
    if (!addModal || !newTitle || !newTarget) return
    setSubmitting(true)
    try {
      const res = await apiPost(`/api/ngo/milestones/projects/${addModal}`, {
        category: newCategory,
        title: newTitle,
        description: newDescription,
        targetValue: Number(newTarget),
        targetUnit: newUnit,
        targetDate: newTargetDate || undefined,
      })
      if (res.ok) {
        setToast('Milestone created successfully')
        setAddModal(null)
        fetchData()
        setTimeout(() => setToast(''), 4000)
      } else {
        const err = await res.json().catch(() => ({ error: 'Failed to create milestone' }))
        setToast(err.error || 'Failed to create milestone')
        setTimeout(() => setToast(''), 5000)
      }
    } catch {
      setToast('Network error — please try again')
      setTimeout(() => setToast(''), 5000)
    } finally {
      setSubmitting(false)
    }
  }

  const openUpdateModal = (milestone: Milestone) => {
    setUpdateModal(milestone)
    setUpdateValue(String(milestone.currentValue))
    setUpdateNote('')
  }

  const handleUpdateProgress = async () => {
    if (!updateModal) return
    setSubmitting(true)
    try {
      const res = await apiPost(`/api/ngo/milestones/${updateModal.id}/update`, {
        newValue: Number(updateValue),
        note: updateNote,
      })
      if (res.ok) {
        setToast('Progress updated')
        setUpdateModal(null)
        fetchData()
        setTimeout(() => setToast(''), 4000)
      } else {
        const err = await res.json().catch(() => ({ error: 'Failed to update progress' }))
        setToast(err.error || 'Failed to update progress')
        setTimeout(() => setToast(''), 5000)
      }
    } catch {
      setToast('Network error — please try again')
      setTimeout(() => setToast(''), 5000)
    } finally {
      setSubmitting(false)
    }
  }

  const progressPercent = (current: number, target: number) => {
    if (target <= 0) return 0
    return Math.min(100, Math.round((current / target) * 100))
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto" style={{ background: 'var(--tulip-cream)', minHeight: '100%' }}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--tulip-gold)' }}>
            <BarChart3 size={20} style={{ color: 'var(--tulip-forest)' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--tulip-forest)' }}>Impact Milestones</h1>
            <p className="text-sm" style={{ color: 'var(--tulip-forest)', opacity: 0.6 }}>Track the real-world impact of your projects</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--tulip-forest)' }} />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20 rounded-xl border" style={{ background: 'var(--tulip-sage)', borderColor: 'var(--tulip-sage-dark)' }}>
          <BarChart3 size={40} className="mx-auto mb-3" style={{ color: 'var(--tulip-forest)', opacity: 0.3 }} />
          <p className="text-sm" style={{ color: 'var(--tulip-forest)', opacity: 0.5 }}>No projects found. Create a project first to track milestones.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {projects.map(project => {
            const projectMilestones = milestones[project.id] || []
            return (
              <div key={project.id} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--tulip-sage-dark)' }}>
                {/* Project Header */}
                <div className="flex items-center justify-between px-5 py-4" style={{ background: 'var(--tulip-sage)' }}>
                  <h2 className="text-lg font-bold" style={{ color: 'var(--tulip-forest)' }}>{project.name}</h2>
                  <button
                    onClick={() => openAddModal(project.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                    style={{ background: 'var(--tulip-gold)', color: 'var(--tulip-forest)' }}
                  >
                    <Plus size={14} />
                    Add Milestone
                  </button>
                </div>

                {/* Milestone Cards */}
                {projectMilestones.length === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <Target size={28} className="mx-auto mb-2" style={{ color: 'var(--tulip-forest)', opacity: 0.2 }} />
                    <p className="text-sm" style={{ color: 'var(--tulip-forest)', opacity: 0.4 }}>No milestones yet. Add your first milestone to start tracking impact.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
                    {projectMilestones.map(ms => {
                      const pct = progressPercent(ms.currentValue, ms.targetValue)
                      const catStyle = CATEGORY_COLORS[ms.category] || CATEGORY_COLORS.Custom
                      const statStyle = STATUS_COLORS[ms.status] || STATUS_COLORS.not_started
                      return (
                        <div
                          key={ms.id}
                          className="rounded-xl p-4 space-y-3"
                          style={{ background: 'var(--tulip-cream)', border: '1px solid var(--tulip-sage-dark)' }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-sm font-semibold" style={{ color: 'var(--tulip-forest)' }}>{ms.title}</h3>
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap"
                              style={{ background: catStyle.bg, color: catStyle.text }}
                            >
                              {ms.category}
                            </span>
                          </div>

                          {/* Progress Bar */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium" style={{ color: 'var(--tulip-forest)', opacity: 0.6 }}>
                                {ms.currentValue} / {ms.targetValue} {ms.targetUnit}
                              </span>
                              <span className="text-xs font-bold" style={{ color: 'var(--tulip-forest)' }}>{pct}%</span>
                            </div>
                            <div className="w-full h-2 rounded-full" style={{ background: 'var(--tulip-sage)' }}>
                              <div
                                className="h-2 rounded-full transition-all"
                                style={{
                                  width: `${pct}%`,
                                  background: pct >= 100 ? '#22c55e' : 'var(--tulip-gold)',
                                }}
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                              style={{ background: statStyle.bg, color: statStyle.text }}
                            >
                              {ms.status.replace(/_/g, ' ')}
                            </span>
                            <button
                              onClick={() => openUpdateModal(ms)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                              style={{ background: 'var(--tulip-forest)', color: 'var(--tulip-cream)' }}
                            >
                              <TrendingUp size={12} />
                              Update Progress
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add Milestone Modal */}
      {addModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setAddModal(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
            style={{ background: 'var(--tulip-cream)', border: '1px solid var(--tulip-sage-dark)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--tulip-sage-dark)', background: 'var(--tulip-sage)' }}>
              <h2 className="text-lg font-bold" style={{ color: 'var(--tulip-forest)' }}>Add Milestone</h2>
              <button onClick={() => setAddModal(null)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--tulip-sage-dark)] transition-colors">
                <X size={16} style={{ color: 'var(--tulip-forest)' }} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--tulip-forest)' }}>Category</label>
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--tulip-sage)', border: '1px solid var(--tulip-sage-dark)', color: 'var(--tulip-forest)' }}
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--tulip-forest)' }}>Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="e.g. Train 500 farmers in sustainable methods"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--tulip-sage)', border: '1px solid var(--tulip-sage-dark)', color: 'var(--tulip-forest)' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--tulip-forest)' }}>Description</label>
                <textarea
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  placeholder="Describe this milestone..."
                  rows={2}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
                  style={{ background: 'var(--tulip-sage)', border: '1px solid var(--tulip-sage-dark)', color: 'var(--tulip-forest)' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--tulip-forest)' }}>Target Value</label>
                  <input
                    type="number"
                    value={newTarget}
                    onChange={e => setNewTarget(e.target.value)}
                    placeholder="500"
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ background: 'var(--tulip-sage)', border: '1px solid var(--tulip-sage-dark)', color: 'var(--tulip-forest)' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--tulip-forest)' }}>Target Unit</label>
                  <input
                    type="text"
                    value={newUnit}
                    onChange={e => setNewUnit(e.target.value)}
                    placeholder="people, sessions, etc."
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ background: 'var(--tulip-sage)', border: '1px solid var(--tulip-sage-dark)', color: 'var(--tulip-forest)' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--tulip-forest)' }}>Target Date</label>
                <input
                  type="date"
                  value={newTargetDate}
                  onChange={e => setNewTargetDate(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--tulip-sage)', border: '1px solid var(--tulip-sage-dark)', color: 'var(--tulip-forest)' }}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--tulip-sage-dark)' }}>
              <button
                onClick={() => setAddModal(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-80"
                style={{ background: 'var(--tulip-sage)', color: 'var(--tulip-forest)', border: '1px solid var(--tulip-sage-dark)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddMilestone}
                disabled={submitting || !newTitle || !newTarget}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-80 disabled:opacity-50"
                style={{ background: 'var(--tulip-gold)', color: 'var(--tulip-forest)' }}
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {submitting ? 'Creating...' : 'Create Milestone'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Progress Modal */}
      {updateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setUpdateModal(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
            style={{ background: 'var(--tulip-cream)', border: '1px solid var(--tulip-sage-dark)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--tulip-sage-dark)', background: 'var(--tulip-sage)' }}>
              <h2 className="text-lg font-bold" style={{ color: 'var(--tulip-forest)' }}>Update Progress</h2>
              <button onClick={() => setUpdateModal(null)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--tulip-sage-dark)] transition-colors">
                <X size={16} style={{ color: 'var(--tulip-forest)' }} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="rounded-xl p-3" style={{ background: 'var(--tulip-sage)', border: '1px solid var(--tulip-sage-dark)' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--tulip-forest)' }}>{updateModal.title}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--tulip-forest)', opacity: 0.5 }}>
                  Current: {updateModal.currentValue} / {updateModal.targetValue} {updateModal.targetUnit}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--tulip-forest)' }}>New Value</label>
                <input
                  type="number"
                  value={updateValue}
                  onChange={e => setUpdateValue(e.target.value)}
                  placeholder="Enter new value"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--tulip-sage)', border: '1px solid var(--tulip-sage-dark)', color: 'var(--tulip-forest)' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--tulip-forest)' }}>Note</label>
                <textarea
                  value={updateNote}
                  onChange={e => setUpdateNote(e.target.value)}
                  placeholder="Describe the progress..."
                  rows={3}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
                  style={{ background: 'var(--tulip-sage)', border: '1px solid var(--tulip-sage-dark)', color: 'var(--tulip-forest)' }}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--tulip-sage-dark)' }}>
              <button
                onClick={() => setUpdateModal(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-80"
                style={{ background: 'var(--tulip-sage)', color: 'var(--tulip-forest)', border: '1px solid var(--tulip-sage-dark)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateProgress}
                disabled={submitting || !updateValue}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-80 disabled:opacity-50"
                style={{ background: 'var(--tulip-gold)', color: 'var(--tulip-forest)' }}
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <TrendingUp size={14} />}
                {submitting ? 'Updating...' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2"
          style={{ background: 'var(--tulip-forest)', color: 'var(--tulip-cream)' }}
        >
          <CheckCircle2 size={16} style={{ color: 'var(--tulip-gold)' }} />
          {toast}
        </div>
      )}
    </div>
  )
}
