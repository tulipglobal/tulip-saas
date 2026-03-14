'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { apiGet, apiPost, apiDelete, apiFetch } from '@/lib/api'
import { UserPlus, ArrowLeft, Mail, Building2, FolderOpen, Clock, Settings, X, Check, AlertCircle, RefreshCw, Ban, Shield } from 'lucide-react'

interface ProjectAccess {
  projectId: string
  projectName: string
  grantedAt: string
  revokedAt: string | null
  active: boolean
}

interface ActiveDonor {
  memberId: string
  email: string
  name: string
  orgName: string
  orgId: string
  projects: ProjectAccess[]
}

interface Invite {
  id: string
  email: string
  donorOrgName: string
  projectName: string | null
  status: string
  sentAt: string
  expiresAt: string
}

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

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PENDING: 'bg-amber-100 text-amber-700',
    ACCEPTED: 'bg-green-100 text-green-700',
    EXPIRED: 'bg-gray-100 text-gray-500',
  }
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${colors[status] || colors.EXPIRED}`}>
      {status}
    </span>
  )
}

// ── Manage Projects Modal ─────────────────────────────────────
function ManageModal({
  donor, allProjects, onClose, onSaved
}: {
  donor: ActiveDonor
  allProjects: Project[]
  onClose: () => void
  onSaved: () => void
}) {
  const activeIds = donor.projects.filter(p => p.active).map(p => p.projectId)
  const [selected, setSelected] = useState<string[]>(activeIds)
  const [saving, setSaving] = useState(false)

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  const handleSave = async () => {
    setSaving(true)
    const toAdd = selected.filter(id => !activeIds.includes(id))
    const toRemove = activeIds.filter(id => !selected.includes(id))

    if (toAdd.length) {
      await apiPost('/api/donor/access/add', { donorEmail: donor.email, projectIds: toAdd })
    }
    for (const projectId of toRemove) {
      await apiFetch('/api/donor/access/remove', { method: 'DELETE', body: JSON.stringify({ donorEmail: donor.email, projectId }) })
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#fefbe9] rounded-2xl border border-[#c8d6c0] shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#c8d6c0]">
          <div>
            <h3 className="text-base font-bold text-[#183a1d]">Manage Projects</h3>
            <p className="text-xs text-[#183a1d]/50">{donor.email} — {donor.orgName}</p>
          </div>
          <button onClick={onClose} className="text-[#183a1d]/40 hover:text-[#183a1d] transition-all"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {allProjects.map(p => (
            <label
              key={p.id}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                selected.includes(p.id) ? 'border-[#f6c453] bg-[#f6c453]/10' : 'border-[#c8d6c0] hover:border-[#f6c453]/50'
              }`}
            >
              <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} className="accent-[#f6c453] w-4 h-4" />
              <span className="text-sm text-[#183a1d]">{p.name}</span>
            </label>
          ))}
          {allProjects.length === 0 && <p className="text-sm text-[#183a1d]/40">No projects found.</p>}
        </div>
        <div className="flex items-center gap-3 px-5 py-4 border-t border-[#c8d6c0]">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#f6c453] text-[#183a1d] hover:bg-[#f0a04b] disabled:opacity-50 transition-all">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-[#183a1d]/60 hover:text-[#183a1d] hover:bg-[#c8d6c0]/40 transition-all">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function DonorsPage() {
  const [donors, setDonors] = useState<ActiveDonor[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [allProjects, setAllProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [manageTarget, setManageTarget] = useState<ActiveDonor | null>(null)

  const fetchData = useCallback(() => {
    setLoading(true)
    Promise.all([
      apiGet('/api/donor/invites').then(r => r.ok ? r.json() : { data: [], donors: [] }),
      apiGet('/api/projects').then(r => r.ok ? r.json() : { data: [] }),
    ]).then(([inviteData, projectData]) => {
      setInvites(inviteData.data || [])
      setDonors(inviteData.donors || [])
      const list = projectData.data || projectData.projects || projectData || []
      setAllProjects(Array.isArray(list) ? list : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const pendingInvites = invites.filter(i => i.status === 'PENDING')

  const handleResend = async (inviteId: string) => {
    const res = await apiPost('/api/donor/invite/resend', { inviteId })
    if (res.ok) {
      setToast({ message: 'Invite resent', type: 'success' })
      fetchData()
    } else {
      const err = await res.json().catch(() => ({ error: 'Failed' }))
      setToast({ message: err.error || 'Failed to resend', type: 'error' })
    }
  }

  const handleCancel = async (inviteId: string) => {
    const res = await apiPost('/api/donor/invite/cancel', { inviteId })
    if (res.ok) {
      setToast({ message: 'Invite cancelled', type: 'success' })
      fetchData()
    } else {
      const err = await res.json().catch(() => ({ error: 'Failed' }))
      setToast({ message: err.error || 'Failed to cancel', type: 'error' })
    }
  }

  const handleRevokeAll = async (donor: ActiveDonor) => {
    const activeProjects = donor.projects.filter(p => p.active)
    for (const p of activeProjects) {
      await apiDelete('/api/donor/access/remove', { donorEmail: donor.email, projectId: p.projectId })
    }
    setToast({ message: 'All access revoked', type: 'success' })
    fetchData()
  }

  return (
    <div className="p-6 space-y-6 animate-fade-up max-w-4xl">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {manageTarget && (
        <ManageModal
          donor={manageTarget}
          allProjects={allProjects}
          onClose={() => setManageTarget(null)}
          onSaved={() => { setManageTarget(null); setToast({ message: 'Project access updated', type: 'success' }); fetchData() }}
        />
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/settings" className="text-[#183a1d]/40 hover:text-[#183a1d] transition-all">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[#183a1d]" style={{ fontFamily: 'Inter, sans-serif' }}>Donors</h1>
            <p className="text-[#183a1d]/60 text-sm mt-0.5">Manage donor access to your projects</p>
          </div>
        </div>
        <Link
          href="/dashboard/settings/donors/invite"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#f6c453] text-[#183a1d] hover:bg-[#f0a04b] transition-all"
        >
          <UserPlus size={14} />
          Invite Donor
        </Link>
      </div>

      {loading ? (
        <p className="text-[#183a1d]/40 text-sm">Loading...</p>
      ) : donors.length === 0 && pendingInvites.length === 0 ? (
        <div className="rounded-xl border border-[#c8d6c0] px-8 py-12 bg-[#e1eedd] text-center">
          <UserPlus size={32} className="mx-auto text-[#183a1d]/20 mb-3" />
          <p className="text-[#183a1d]/50 text-sm">No donors invited yet.</p>
          <Link
            href="/dashboard/settings/donors/invite"
            className="inline-block mt-4 px-4 py-2 rounded-lg text-sm font-medium bg-[#f6c453] text-[#183a1d] hover:bg-[#f0a04b] transition-all"
          >
            Invite your first donor
          </Link>
        </div>
      ) : (
        <>
          {/* ── Section 1: Active Donors ─────────────────── */}
          {donors.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-[#183a1d]/40" />
                <h2 className="text-sm font-semibold text-[#183a1d]/60 uppercase tracking-wide">Active Donors</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">{donors.length}</span>
              </div>

              <div className="space-y-3">
                {donors.map(donor => {
                  const activeProjects = donor.projects.filter(p => p.active)
                  return (
                    <div key={donor.memberId} className="rounded-xl border border-[#c8d6c0] bg-[#e1eedd] overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-[#183a1d] bg-[#f6c453] shrink-0">
                            {(donor.name || donor.email).charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#183a1d] truncate">{donor.orgName || donor.name || donor.email}</p>
                            <p className="text-xs text-[#183a1d]/50 truncate">{donor.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <button
                            onClick={() => setManageTarget(donor)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#c8d6c0] text-[#183a1d]/70 hover:bg-[#c8d6c0]/40 transition-all"
                          >
                            <Settings size={12} /> Manage Projects
                          </button>
                          {activeProjects.length > 0 && (
                            <button
                              onClick={() => handleRevokeAll(donor)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600/70 hover:bg-red-400/10 hover:text-red-600 transition-all"
                            >
                              <Ban size={12} /> Revoke All
                            </button>
                          )}
                        </div>
                      </div>
                      {activeProjects.length > 0 && (
                        <div className="px-4 pb-3">
                          <div className="flex flex-wrap gap-1.5">
                            {activeProjects.map(p => (
                              <span key={p.projectId} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#f6c453]/15 text-[#183a1d]/70">
                                <FolderOpen size={10} /> {p.projectName}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {activeProjects.length === 0 && (
                        <div className="px-4 pb-3">
                          <p className="text-xs text-[#183a1d]/30 italic">All access revoked</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Section 2: Pending Invites ────────────────── */}
          {pendingInvites.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-[#183a1d]/40" />
                <h2 className="text-sm font-semibold text-[#183a1d]/60 uppercase tracking-wide">Pending Invites</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">{pendingInvites.length}</span>
              </div>

              <div className="rounded-xl border border-[#c8d6c0] overflow-hidden bg-[#e1eedd]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#c8d6c0]">
                      <th className="text-left px-4 py-3 text-xs font-medium text-[#183a1d]/40 uppercase tracking-wide">
                        <div className="flex items-center gap-1.5"><Building2 size={12} /> Organisation</div>
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-[#183a1d]/40 uppercase tracking-wide">
                        <div className="flex items-center gap-1.5"><Mail size={12} /> Email</div>
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-[#183a1d]/40 uppercase tracking-wide">Sent</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-[#183a1d]/40 uppercase tracking-wide">Expires</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-[#183a1d]/40 uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingInvites.map(inv => (
                      <tr key={inv.id} className="border-b border-[#c8d6c0]/50 last:border-0">
                        <td className="px-4 py-3 font-medium text-[#183a1d]">{inv.donorOrgName || '—'}</td>
                        <td className="px-4 py-3 text-[#183a1d]/70">{inv.email}</td>
                        <td className="px-4 py-3 text-[#183a1d]/50 text-xs">
                          {inv.sentAt ? new Date(inv.sentAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}
                        </td>
                        <td className="px-4 py-3 text-[#183a1d]/50 text-xs">
                          {inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => handleResend(inv.id)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-[#183a1d]/60 hover:bg-[#c8d6c0]/40 transition-all">
                              <RefreshCw size={11} /> Resend
                            </button>
                            <button onClick={() => handleCancel(inv.id)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-red-600/60 hover:bg-red-400/10 hover:text-red-600 transition-all">
                              <X size={11} /> Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
