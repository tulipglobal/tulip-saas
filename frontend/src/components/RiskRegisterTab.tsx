'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api'
import { Plus, Edit2, Trash2, X, AlertTriangle, Shield } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

interface Risk {
  id: string
  description: string
  category: string
  likelihood: number
  impact: number
  score: number
  status: string
  mitigation: string
  owner: string | null
  reviewDate: string | null
  notes: string | null
  createdAt: string
}

interface RiskFormData {
  description: string
  category: string
  likelihood: number
  impact: number
  mitigation: string
  owner: string
  reviewDate: string
  notes: string
  status?: string
}

const CATEGORIES = ['Financial', 'Operational', 'Reputational', 'Safeguarding', 'Political', 'Environmental', 'Other']
const LIKELIHOOD_LABELS = ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost Certain']
const IMPACT_LABELS = ['Negligible', 'Minor', 'Moderate', 'Major', 'Catastrophic']
const STATUS_OPTIONS = ['OPEN', 'MITIGATED', 'CLOSED', 'ESCALATED']
const FILTER_TABS = ['All', 'Open', 'High', 'Escalated'] as const

// ── Helpers ────────────────────────────────────────────────────────────────

function scoreSeverity(score: number): { label: string; color: string; bg: string } {
  if (score <= 6) return { label: 'LOW', color: '#166534', bg: '#F0FDF4' }
  if (score <= 12) return { label: 'MEDIUM', color: '#92400E', bg: '#FFFBEB' }
  return { label: 'HIGH', color: '#991B1B', bg: '#FEF2F2' }
}

function statusPill(status: string) {
  const map: Record<string, { color: string; bg: string }> = {
    OPEN: { color: '#92400E', bg: '#FFFBEB' },
    MITIGATED: { color: '#1e40af', bg: '#eff6ff' },
    CLOSED: { color: '#166534', bg: '#F0FDF4' },
    ESCALATED: { color: '#991B1B', bg: '#FEF2F2' },
  }
  const s = map[status] ?? map.OPEN
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ color: s.color, backgroundColor: s.bg }}>
      {status}
    </span>
  )
}

function matrixCellColor(score: number): string {
  if (score <= 6) return '#dcfce7'
  if (score <= 12) return '#fef3c7'
  return '#fecaca'
}

// ── Component ──────────────────────────────────────────────────────────────

export default function RiskRegisterTab({ projectId }: { projectId: string }) {
  const [risks, setRisks] = useState<Risk[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<typeof FILTER_TABS[number]>('All')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingRisk, setEditingRisk] = useState<Risk | null>(null)
  const [hoveredCell, setHoveredCell] = useState<{ l: number; i: number } | null>(null)

  const fetchRisks = useCallback(() => {
    apiGet(`/api/ngo/projects/${projectId}/risks`)
      .then(r => r.ok ? r.json() : { data: [] })
      .then(res => setRisks(res.data ?? res ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [projectId])

  useEffect(() => { fetchRisks() }, [fetchRisks])

  const handleDelete = async (riskId: string) => {
    if (!confirm('Delete this risk?')) return
    const res = await apiDelete(`/api/ngo/risks/${riskId}`)
    if (res.ok) fetchRisks()
  }

  // ── Counts ──
  const total = risks.length
  const highCount = risks.filter(r => r.score >= 13).length
  const mediumCount = risks.filter(r => r.score >= 7 && r.score <= 12).length
  const lowCount = risks.filter(r => r.score <= 6).length
  const openCount = risks.filter(r => r.status === 'OPEN').length
  const escalatedCount = risks.filter(r => r.status === 'ESCALATED').length

  // ── Filtered risks ──
  const filtered = risks.filter(r => {
    if (filter === 'Open') return r.status === 'OPEN'
    if (filter === 'High') return r.score >= 13
    if (filter === 'Escalated') return r.status === 'ESCALATED'
    return true
  })

  // ── Build matrix ──
  const matrixRisks: Record<string, Risk[]> = {}
  risks.forEach(r => {
    const key = `${r.likelihood}-${r.impact}`
    if (!matrixRisks[key]) matrixRisks[key] = []
    matrixRisks[key].push(r)
  })

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 border-[var(--tulip-gold)] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-xl p-4">
          <p className="text-[var(--tulip-forest)]/60 text-xs mb-1">Total Risks</p>
          <p className="text-[var(--tulip-forest)] font-semibold text-lg">{total}</p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: '#FEF2F2', border: '1px solid #fecaca' }}>
          <p className="text-xs mb-1" style={{ color: '#991B1B' }}>High Risk</p>
          <p className="font-semibold text-lg" style={{ color: '#991B1B' }}>{highCount}</p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: '#FFFBEB', border: '1px solid #fde68a' }}>
          <p className="text-xs mb-1" style={{ color: '#92400E' }}>Medium Risk</p>
          <p className="font-semibold text-lg" style={{ color: '#92400E' }}>{mediumCount}</p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: '#F0FDF4', border: '1px solid #bbf7d0' }}>
          <p className="text-xs mb-1" style={{ color: '#166534' }}>Low Risk</p>
          <p className="font-semibold text-lg" style={{ color: '#166534' }}>{lowCount}</p>
        </div>
        <div className="bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-xl p-4">
          <p className="text-[var(--tulip-forest)]/60 text-xs mb-1">Open | Escalated</p>
          <p className="text-[var(--tulip-forest)] font-semibold text-lg">{openCount} | {escalatedCount}</p>
        </div>
      </div>

      {/* Risk Matrix */}
      <div className="bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={16} className="text-[var(--tulip-forest)]" />
          <h3 className="text-sm font-semibold text-[var(--tulip-forest)]">Risk Matrix</h3>
        </div>
        <div className="flex">
          {/* Y-axis label */}
          <div className="flex flex-col justify-between pr-2 py-1" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
            <span className="text-[10px] text-[var(--tulip-forest)]/50 font-medium">Impact</span>
          </div>
          {/* Y-axis labels */}
          <div className="flex flex-col-reverse gap-1 pr-2 justify-between">
            {IMPACT_LABELS.map((label, idx) => (
              <div key={idx} className="h-12 flex items-center">
                <span className="text-[10px] text-[var(--tulip-forest)]/60 whitespace-nowrap">{label}</span>
              </div>
            ))}
          </div>
          {/* Grid */}
          <div className="flex-1">
            <div className="grid grid-cols-5 gap-1">
              {/* Rows: impact 5 down to 1 */}
              {[5, 4, 3, 2, 1].map(impact => (
                [1, 2, 3, 4, 5].map(likelihood => {
                  const cellScore = likelihood * impact
                  const key = `${likelihood}-${impact}`
                  const cellRisks = matrixRisks[key] || []
                  const isHovered = hoveredCell?.l === likelihood && hoveredCell?.i === impact
                  return (
                    <div
                      key={key}
                      className="h-12 rounded flex items-center justify-center gap-0.5 relative cursor-default"
                      style={{ backgroundColor: matrixCellColor(cellScore) }}
                      onMouseEnter={() => setHoveredCell({ l: likelihood, i: impact })}
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      {cellRisks.map((r, idx) => {
                        const riskIndex = risks.indexOf(r) + 1
                        return (
                          <div
                            key={r.id}
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                            style={{ backgroundColor: scoreSeverity(r.score).color }}
                            title={r.description}
                          >
                            {riskIndex}
                          </div>
                        )
                      })}
                      {isHovered && cellRisks.length > 0 && (
                        <div className="absolute z-10 bottom-full mb-1 left-1/2 -translate-x-1/2 bg-[var(--tulip-forest)] text-white text-[10px] rounded px-2 py-1 whitespace-nowrap shadow-lg max-w-[200px]">
                          {cellRisks.map((r, i) => (
                            <div key={r.id} className="truncate">{risks.indexOf(r) + 1}. {r.description}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
              ))}
            </div>
            {/* X-axis labels */}
            <div className="grid grid-cols-5 gap-1 mt-1">
              {LIKELIHOOD_LABELS.map((label, idx) => (
                <div key={idx} className="text-center">
                  <span className="text-[10px] text-[var(--tulip-forest)]/60">{label}</span>
                </div>
              ))}
            </div>
            <p className="text-center text-[10px] text-[var(--tulip-forest)]/50 font-medium mt-1">Likelihood</p>
          </div>
        </div>
      </div>

      {/* Filter tabs + Add button */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-[var(--tulip-sage)] p-1 rounded-lg">
          {FILTER_TABS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-md text-xs transition-all ${filter === f ? 'bg-white text-[var(--tulip-forest)] shadow-sm' : 'text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)]'}`}>
              {f}
            </button>
          ))}
        </div>
        <button onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 text-sm font-medium text-[var(--tulip-forest)] px-4 py-2 rounded-lg bg-[var(--tulip-gold)] hover:bg-[var(--tulip-orange)] transition-all">
          <Plus size={14} /> Add Risk
        </button>
      </div>

      {/* Risk Table */}
      <div className="bg-[var(--tulip-sage)] border border-[var(--tulip-sage-dark)] rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[var(--tulip-forest)]/40 gap-3">
            <AlertTriangle size={36} className="text-[var(--tulip-forest)]/30" />
            <p className="text-sm">No risks found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--tulip-sage-dark)]">
                  <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">#</th>
                  <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">CATEGORY</th>
                  <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">DESCRIPTION</th>
                  <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">L</th>
                  <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">I</th>
                  <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">SCORE</th>
                  <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">STATUS</th>
                  <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">MITIGATION</th>
                  <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">OWNER</th>
                  <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">REVIEW DATE</th>
                  <th className="text-left text-xs text-[var(--tulip-forest)]/40 font-normal px-4 py-3">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((risk, idx) => {
                  const sev = scoreSeverity(risk.score)
                  const globalIdx = risks.indexOf(risk) + 1
                  return (
                    <tr key={risk.id} className={`border-b border-[var(--tulip-sage-dark)] hover:bg-[var(--tulip-sage)]/50 transition-colors ${idx % 2 === 0 ? '' : 'bg-[var(--tulip-sage)]'}`}>
                      <td className="px-4 py-3 text-sm text-[var(--tulip-forest)]/60">{globalIdx}</td>
                      <td className="px-4 py-3 text-xs text-[var(--tulip-forest)]">{risk.category}</td>
                      <td className="px-4 py-3 text-sm text-[var(--tulip-forest)] max-w-[200px] truncate">{risk.description}</td>
                      <td className="px-4 py-3 text-sm text-[var(--tulip-forest)]/60">{risk.likelihood}</td>
                      <td className="px-4 py-3 text-sm text-[var(--tulip-forest)]/60">{risk.impact}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ color: sev.color, backgroundColor: sev.bg }}>
                          {risk.score} {sev.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">{statusPill(risk.status)}</td>
                      <td className="px-4 py-3 text-xs text-[var(--tulip-forest)]/60 max-w-[150px] truncate">{risk.mitigation}</td>
                      <td className="px-4 py-3 text-xs text-[var(--tulip-forest)]/60">{risk.owner ?? '-'}</td>
                      <td className="px-4 py-3 text-xs text-[var(--tulip-forest)]/60">{risk.reviewDate ? new Date(risk.reviewDate).toLocaleDateString() : '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setEditingRisk(risk)} className="text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)] transition-colors" title="Edit">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDelete(risk.id)} className="text-[var(--tulip-forest)]/60 hover:text-red-600 transition-colors" title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <RiskModal
          title="Add Risk"
          onClose={() => setShowAddModal(false)}
          onSave={async (data) => {
            const res = await apiPost(`/api/ngo/projects/${projectId}/risks`, data)
            if (res.ok) { fetchRisks(); setShowAddModal(false) }
          }}
        />
      )}

      {/* Edit Modal */}
      {editingRisk && (
        <RiskModal
          title="Edit Risk"
          initial={editingRisk}
          showStatus
          onClose={() => setEditingRisk(null)}
          onSave={async (data) => {
            const res = await apiPut(`/api/ngo/risks/${editingRisk.id}`, data)
            if (res.ok) { fetchRisks(); setEditingRisk(null) }
          }}
        />
      )}
    </div>
  )
}

// ── Risk Modal ─────────────────────────────────────────────────────────────

function RiskModal({ title, initial, showStatus, onClose, onSave }: {
  title: string
  initial?: Risk
  showStatus?: boolean
  onClose: () => void
  onSave: (data: RiskFormData) => Promise<void>
}) {
  const [form, setForm] = useState<RiskFormData>({
    description: initial?.description ?? '',
    category: initial?.category ?? 'Financial',
    likelihood: initial?.likelihood ?? 3,
    impact: initial?.impact ?? 3,
    mitigation: initial?.mitigation ?? '',
    owner: initial?.owner ?? '',
    reviewDate: initial?.reviewDate ? initial.reviewDate.slice(0, 10) : '',
    notes: initial?.notes ?? '',
    status: initial?.status ?? 'OPEN',
  })
  const [saving, setSaving] = useState(false)

  const score = form.likelihood * form.impact
  const sev = scoreSeverity(score)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  const set = (key: keyof RiskFormData, value: string | number) => setForm(prev => ({ ...prev, [key]: value }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-[var(--tulip-cream)] rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-[var(--tulip-forest)]">{title}</h2>
          <button onClick={onClose} className="text-[var(--tulip-forest)]/40 hover:text-[var(--tulip-forest)]"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Description */}
          <div>
            <label className="text-xs font-medium text-[var(--tulip-forest)]/70 block mb-1">Description *</label>
            <textarea required rows={2} value={form.description} onChange={e => set('description', e.target.value)}
              className="w-full rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] text-sm text-[var(--tulip-forest)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--tulip-gold)]/50" />
          </div>

          {/* Category */}
          <div>
            <label className="text-xs font-medium text-[var(--tulip-forest)]/70 block mb-1">Category</label>
            <select value={form.category} onChange={e => set('category', e.target.value)}
              className="w-full rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] text-sm text-[var(--tulip-forest)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--tulip-gold)]/50">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Likelihood slider */}
          <div>
            <label className="text-xs font-medium text-[var(--tulip-forest)]/70 block mb-1">
              Likelihood: {form.likelihood} — {LIKELIHOOD_LABELS[form.likelihood - 1]}
            </label>
            <input type="range" min={1} max={5} value={form.likelihood} onChange={e => set('likelihood', +e.target.value)}
              className="w-full accent-[var(--tulip-gold)]" />
            <div className="flex justify-between text-[9px] text-[var(--tulip-forest)]/40 -mt-1">
              {LIKELIHOOD_LABELS.map(l => <span key={l}>{l}</span>)}
            </div>
          </div>

          {/* Impact slider */}
          <div>
            <label className="text-xs font-medium text-[var(--tulip-forest)]/70 block mb-1">
              Impact: {form.impact} — {IMPACT_LABELS[form.impact - 1]}
            </label>
            <input type="range" min={1} max={5} value={form.impact} onChange={e => set('impact', +e.target.value)}
              className="w-full accent-[var(--tulip-gold)]" />
            <div className="flex justify-between text-[9px] text-[var(--tulip-forest)]/40 -mt-1">
              {IMPACT_LABELS.map(l => <span key={l}>{l}</span>)}
            </div>
          </div>

          {/* Risk Score */}
          <div className="rounded-lg px-3 py-2 text-sm font-medium" style={{ color: sev.color, backgroundColor: sev.bg }}>
            Risk Score: {score} — {sev.label}
          </div>

          {/* Status (edit only) */}
          {showStatus && (
            <div>
              <label className="text-xs font-medium text-[var(--tulip-forest)]/70 block mb-1">Status</label>
              <div className="flex gap-2">
                {STATUS_OPTIONS.map(s => (
                  <button key={s} type="button" onClick={() => set('status', s)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${form.status === s ? 'bg-[var(--tulip-gold)] border-[var(--tulip-gold)] text-[var(--tulip-forest)] font-medium' : 'border-[var(--tulip-sage-dark)] text-[var(--tulip-forest)]/60 hover:border-[var(--tulip-forest)]/30'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mitigation */}
          <div>
            <label className="text-xs font-medium text-[var(--tulip-forest)]/70 block mb-1">Mitigation *</label>
            <textarea required rows={2} value={form.mitigation} onChange={e => set('mitigation', e.target.value)}
              className="w-full rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] text-sm text-[var(--tulip-forest)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--tulip-gold)]/50" />
          </div>

          {/* Owner */}
          <div>
            <label className="text-xs font-medium text-[var(--tulip-forest)]/70 block mb-1">Owner</label>
            <input type="text" value={form.owner} onChange={e => set('owner', e.target.value)}
              className="w-full rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] text-sm text-[var(--tulip-forest)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--tulip-gold)]/50" />
          </div>

          {/* Review Date */}
          <div>
            <label className="text-xs font-medium text-[var(--tulip-forest)]/70 block mb-1">Review Date</label>
            <input type="date" value={form.reviewDate} onChange={e => set('reviewDate', e.target.value)}
              className="w-full rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] text-sm text-[var(--tulip-forest)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--tulip-gold)]/50" />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-[var(--tulip-forest)]/70 block mb-1">Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)}
              className="w-full rounded-lg border border-[var(--tulip-sage-dark)] bg-[var(--tulip-sage)] text-sm text-[var(--tulip-forest)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--tulip-gold)]/50" />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-[var(--tulip-sage-dark)] text-[var(--tulip-forest)]/60 hover:text-[var(--tulip-forest)] transition-all">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-[var(--tulip-gold)] hover:bg-[var(--tulip-orange)] text-[var(--tulip-forest)] font-medium transition-all disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Risk'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
