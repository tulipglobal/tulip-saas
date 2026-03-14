'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { apiGet } from '@/lib/api'
import { UserPlus, ArrowLeft, Mail, Building2, FolderOpen, Clock } from 'lucide-react'

interface Invite {
  id: string
  email: string
  donorOrgName: string
  projectName: string | null
  status: string
  sentAt: string
  expiresAt: string
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

export default function DonorsPage() {
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet('/api/donor/invites')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(d => { setInvites(d.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="p-6 space-y-6 animate-fade-up max-w-4xl">
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
      ) : invites.length === 0 ? (
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
                <th className="text-left px-4 py-3 text-xs font-medium text-[#183a1d]/40 uppercase tracking-wide">
                  <div className="flex items-center gap-1.5"><FolderOpen size={12} /> Projects</div>
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#183a1d]/40 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#183a1d]/40 uppercase tracking-wide">
                  <div className="flex items-center gap-1.5"><Clock size={12} /> Sent</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {invites.map(inv => (
                <tr key={inv.id} className="border-b border-[#c8d6c0]/50 last:border-0 hover:bg-[#d4e5cc]/40 transition-all">
                  <td className="px-4 py-3 font-medium text-[#183a1d]">{inv.donorOrgName || '—'}</td>
                  <td className="px-4 py-3 text-[#183a1d]/70">{inv.email}</td>
                  <td className="px-4 py-3 text-[#183a1d]/70">{inv.projectName || '—'}</td>
                  <td className="px-4 py-3"><StatusPill status={inv.status} /></td>
                  <td className="px-4 py-3 text-[#183a1d]/50 text-xs">
                    {inv.sentAt ? new Date(inv.sentAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
