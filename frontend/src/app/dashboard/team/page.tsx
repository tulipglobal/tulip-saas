'use client'

import { useState, useEffect } from 'react'
import { Users, Plus, Shield, Trash2, Check, AlertCircle, X } from 'lucide-react'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'

interface Member {
  id: string
  name: string
  email: string
  createdAt: string
  roles: { id: string; name: string }[]
}

interface RoleOption {
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

const roleBadgeColors: Record<string, string> = {
  admin: 'bg-purple-400/10 text-purple-400 border-purple-400/20',
  member: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
  editor: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
  viewer: 'bg-gray-400/10 text-gray-400 border-gray-400/20',
}

const INVITE_ROLES = ['member', 'admin']

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [roles, setRoles] = useState<RoleOption[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string>('')

  // Invite modal
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviting, setInviting] = useState(false)

  // Remove confirmation
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null)
  const [removing, setRemoving] = useState(false)

  const fetchTeam = async () => {
    try {
      const [teamRes, rolesRes, meRes] = await Promise.all([
        apiGet('/api/team'),
        apiGet('/api/team/roles'),
        apiGet('/api/auth/me'),
      ])
      if (teamRes.ok) {
        const data = await teamRes.json()
        setMembers(data.data || [])
      }
      if (rolesRes.ok) {
        const data = await rolesRes.json()
        setRoles(data.data || [])
      }
      if (meRes.ok) {
        const me = await meRes.json()
        setCurrentUserId((me.user ?? me).id)
      }
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchTeam() }, [])

  const handleInvite = async () => {
    if (!inviteEmail) return
    setInviting(true)
    try {
      const sentTo = inviteEmail
      const res = await apiPost('/api/team/invite', { email: inviteEmail, roleName: inviteRole })
      if (res.ok) {
        setToast({ message: `Invitation sent to ${sentTo}`, type: 'success' })
        setInviteEmail('')
        setInviteRole('member')
        setShowInvite(false)
        fetchTeam()
      } else {
        const err = await res.json()
        setToast({ message: err.error || 'Failed to invite', type: 'error' })
      }
    } catch {
      setToast({ message: 'Failed to invite team member', type: 'error' })
    }
    setInviting(false)
  }

  const handleRoleChange = async (userId: string, roleName: string) => {
    try {
      const res = await apiPatch(`/api/team/${userId}/role`, { roleName })
      if (res.ok) {
        setToast({ message: 'Role updated', type: 'success' })
        fetchTeam()
      } else {
        const err = await res.json()
        setToast({ message: err.error || 'Failed to change role', type: 'error' })
      }
    } catch {
      setToast({ message: 'Failed to change role', type: 'error' })
    }
  }

  const handleRemove = async () => {
    if (!removeTarget) return
    setRemoving(true)
    try {
      const res = await apiDelete(`/api/team/${removeTarget.id}`)
      if (res.ok) {
        setToast({ message: `${removeTarget.name || removeTarget.email} removed`, type: 'success' })
        setRemoveTarget(null)
        fetchTeam()
      } else {
        const err = await res.json()
        setToast({ message: err.error || 'Failed to remove', type: 'error' })
      }
    } catch {
      setToast({ message: 'Failed to remove member', type: 'error' })
    }
    setRemoving(false)
  }

  const tableRoles = roles.length > 0 ? roles.map(r => r.name) : ['admin', 'member']

  if (loading) return (
    <div className="p-6 animate-fade-up">
      <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Syne, sans-serif' }}>Team</h1>
      <p className="text-gray-400 text-sm mt-4">Loading...</p>
    </div>
  )

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-up">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Syne, sans-serif' }}>Team</h1>
          <p className="text-gray-500 text-sm mt-1">{members.length} member{members.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-[#2563EB] text-white hover:bg-[#2563EB]/80 transition-all self-start">
          <Plus size={16} />
          Invite Member
        </button>
      </div>

      {/* Members — Desktop table, mobile card list */}
      <div className="rounded-xl border border-gray-200 overflow-hidden" style={{ background: '#FFFFFF' }}>
        {/* Desktop table */}
        <table className="w-full hidden md:table">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-5 py-3">Member</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-5 py-3">Role</th>
              <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-5 py-3">Joined</th>
              <th className="text-right text-xs font-medium text-gray-400 uppercase tracking-wide px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map(m => {
              const rawRole = m.roles[0]?.name || 'member'
              const roleName = rawRole === 'editor' ? 'member' : rawRole
              const isCurrentUser = m.id === currentUserId
              return (
                <tr key={m.id} className="border-b border-gray-100 last:border-0 hover:bg-white transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)' }}>
                        {m.name?.charAt(0)?.toUpperCase() || m.email.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{m.name}{isCurrentUser && <span className="text-gray-400 ml-2 text-xs">(you)</span>}</div>
                        <div className="text-xs text-gray-500">{m.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {isCurrentUser ? (
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${roleBadgeColors[roleName] || roleBadgeColors.viewer}`}>
                        {roleName}
                      </span>
                    ) : (
                      <select
                        value={roleName}
                        onChange={e => handleRoleChange(m.id, e.target.value)}
                        className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-800 outline-none focus:border-[#2563EB]/50 cursor-pointer"
                      >
                        {tableRoles.map(r => (
                          <option key={r} value={r} className="bg-white text-gray-900">{r}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-500">
                    {new Date(m.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {!isCurrentUser && (
                      <button onClick={() => setRemoveTarget(m)}
                        className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-400/5 transition-all">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            {members.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400 text-sm">No team members yet</td></tr>
            )}
          </tbody>
        </table>

        {/* Mobile card list */}
        <div className="md:hidden divide-y divide-gray-100">
          {members.map(m => {
            const rawRole = m.roles[0]?.name || 'member'
            const roleName = rawRole === 'editor' ? 'member' : rawRole
            const isCurrentUser = m.id === currentUserId
            return (
              <div key={m.id} className="px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)' }}>
                    {m.name?.charAt(0)?.toUpperCase() || m.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{m.name}{isCurrentUser && <span className="text-gray-400 ml-2 text-xs">(you)</span>}</div>
                    <div className="text-xs text-gray-500 truncate">{m.email}</div>
                  </div>
                  {!isCurrentUser && (
                    <button onClick={() => setRemoveTarget(m)}
                      className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-400/5 transition-all shrink-0">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-2 ml-11">
                  {isCurrentUser ? (
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${roleBadgeColors[roleName] || roleBadgeColors.viewer}`}>
                      {roleName}
                    </span>
                  ) : (
                    <select
                      value={roleName}
                      onChange={e => handleRoleChange(m.id, e.target.value)}
                      className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-800 outline-none focus:border-[#2563EB]/50 cursor-pointer"
                    >
                      {tableRoles.map(r => (
                        <option key={r} value={r} className="bg-white text-gray-900">{r}</option>
                      ))}
                    </select>
                  )}
                  <span className="text-xs text-gray-400">
                    {new Date(m.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
              </div>
            )
          })}
          {members.length === 0 && (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">No team members yet</div>
          )}
        </div>
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowInvite(false)}>
          <div className="bg-white border border-gray-200 rounded-none md:rounded-xl p-6 w-full h-full md:h-auto md:max-w-md space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Invite Team Member</h3>
              <button onClick={() => setShowInvite(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Email Address</label>
              <input
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#2563EB]/50"
                type="email" placeholder="colleague@example.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleInvite()}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Role</label>
              <select
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-[#2563EB]/50"
                value={inviteRole} onChange={e => setInviteRole(e.target.value)}
              >
                {INVITE_ROLES.map(r => (
                  <option key={r} value={r} className="bg-white text-gray-900">{r}</option>
                ))}
              </select>
            </div>
            <p className="text-xs text-gray-400">An email with temporary credentials will be sent. The user should change their password after logging in.</p>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowInvite(false)}
                className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-800 border border-gray-200 hover:bg-gray-50 transition-all">
                Cancel
              </button>
              <button onClick={handleInvite} disabled={inviting || !inviteEmail}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#2563EB] text-white hover:bg-[#2563EB]/80 disabled:opacity-50 transition-all">
                <Plus size={14} />
                {inviting ? 'Sending...' : 'Send Invite'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Confirmation Modal */}
      {removeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setRemoveTarget(null)}>
          <div className="bg-white border border-gray-200 rounded-none md:rounded-xl p-6 w-full h-full md:h-auto md:max-w-sm space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900">Remove Member</h3>
            <p className="text-sm text-gray-600">
              Are you sure you want to remove <strong className="text-gray-900">{removeTarget.name || removeTarget.email}</strong> from your team? They will lose access immediately.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setRemoveTarget(null)}
                className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-800 border border-gray-200 hover:bg-gray-50 transition-all">
                Cancel
              </button>
              <button onClick={handleRemove} disabled={removing}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-50 transition-all">
                <Trash2 size={14} />
                {removing ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
