'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { apiGet, apiPost } from '@/lib/api'

// ── Helpers ──────────────────────────────────────────────────
function timeAgo(d: string | Date): string {
  const now = Date.now()
  const dt = new Date(d).getTime()
  const diff = Math.floor((now - dt) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDateFull(d: string | Date): string {
  const dt = new Date(d)
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function alertIcon(alertType: string): string {
  if (alertType.startsWith('expense.')) return '\uD83D\uDCB0'
  if (alertType.startsWith('budget.')) return '\uD83D\uDCCA'
  if (alertType.startsWith('seal.')) return '\uD83D\uDD17'
  if (alertType.startsWith('document.')) return '\uD83D\uDCC4'
  if (alertType.startsWith('report.')) return '\uD83D\uDCC8'
  if (alertType.startsWith('challenge.')) return '\uD83D\uDD14'
  return '\uD83D\uDD14'
}

interface Notification {
  id: string
  alertType: string
  title: string
  body: string
  read: boolean
  entityId: string | null
  projectId: string | null
  createdAt: string
}

type FilterTab = 'all' | 'unread' | 'expenses' | 'budget' | 'seals' | 'documents'

function notificationRoute(n: Notification): string | null {
  if (n.alertType.startsWith('expense.') && n.entityId && n.projectId) return `/projects/${n.projectId}?expense=${n.entityId}`
  if (n.alertType.startsWith('budget.') && n.projectId) return `/projects/${n.projectId}`
  if (n.alertType.startsWith('seal.') && n.projectId) return `/projects/${n.projectId}`
  if (n.alertType.startsWith('document.') && n.projectId) return `/projects/${n.projectId}`
  if (n.alertType.startsWith('challenge.') && n.entityId && n.projectId) return `/projects/${n.projectId}?expense=${n.entityId}`
  if (n.alertType.startsWith('report.')) return null
  return null
}

export default function NotificationsPage() {
  const router = useRouter()
  const t = useTranslations()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: t('notifications.all') },
    { key: 'unread', label: t('notifications.unread') },
    { key: 'expenses', label: t('notifications.expenses') },
    { key: 'budget', label: t('notifications.budget') },
    { key: 'seals', label: t('notifications.seals') },
    { key: 'documents', label: t('notifications.documents') },
  ]

  const fetchNotifications = useCallback(async (append = false, currentOffset = 0) => {
    if (append) setLoadingMore(true)
    else setLoading(true)

    const unreadParam = activeTab === 'unread' ? '&unread=true' : ''
    try {
      const r = await apiGet(`/api/donor/notifications?limit=20&offset=${currentOffset}${unreadParam}`)
      if (r.ok) {
        const d = await r.json()
        const fetched: Notification[] = d.notifications || []
        if (append) {
          setNotifications(prev => [...prev, ...fetched])
        } else {
          setNotifications(fetched)
        }
        setHasMore(fetched.length === 20)
      }
    } catch {}
    setLoading(false)
    setLoadingMore(false)
  }, [activeTab])

  useEffect(() => {
    setOffset(0)
    setHasMore(true)
    fetchNotifications(false, 0)
  }, [activeTab, fetchNotifications])

  const loadMore = () => {
    const newOffset = offset + 20
    setOffset(newOffset)
    fetchNotifications(true, newOffset)
  }

  const markAllRead = async () => {
    await apiPost('/api/donor/notifications/mark-all-read', {})
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const markOneRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await apiPost(`/api/donor/notifications/${id}/mark-read`, {})
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const handleClick = (n: Notification) => {
    if (!n.read) {
      apiPost(`/api/donor/notifications/${n.id}/mark-read`, {})
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
    }
    const route = notificationRoute(n)
    if (route) router.push(route)
  }

  // Client-side filtering for category tabs
  const filtered = notifications.filter(n => {
    if (activeTab === 'all' || activeTab === 'unread') return true
    if (activeTab === 'expenses') return n.alertType.startsWith('expense.')
    if (activeTab === 'budget') return n.alertType.startsWith('budget.')
    if (activeTab === 'seals') return n.alertType.startsWith('seal.')
    if (activeTab === 'documents') return n.alertType.startsWith('document.')
    return true
  })

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6 animate-fade-up">
      {/* Breadcrumb */}
      <div className="text-[13px]" style={{ color: 'var(--donor-muted)' }}>
        <Link href="/dashboard" className="hover:underline">{t('dashboard.breadcrumbHome')}</Link>
        <span className="mx-1">/</span>
        <span>{t('notifications.title')}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--donor-dark)' }}>{t('notifications.title')}</h1>
        <button
          onClick={markAllRead}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
          style={{ background: 'var(--donor-accent)' }}
        >
          {t('notifications.markAllRead')}
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: activeTab === tab.key ? 'var(--donor-accent)' : 'var(--donor-light)',
              color: activeTab === tab.key ? '#FFFFFF' : 'var(--donor-muted)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notification list */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-16 rounded-lg animate-skeleton-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--donor-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <p className="text-sm mt-3" style={{ color: 'var(--donor-muted)' }}>{t('notifications.noNotifications')}</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--donor-border)' }}>
            {filtered.map(n => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className="w-full text-left px-5 py-4 flex items-start gap-3 hover:opacity-90 transition-all cursor-pointer"
                style={{
                  background: n.read ? 'var(--donor-light)' : 'var(--bg-card)',
                  borderLeft: n.read ? 'none' : '3px solid var(--donor-accent)',
                }}
              >
                <span className="text-lg shrink-0 mt-0.5">{alertIcon(n.alertType)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm" style={{ color: 'var(--donor-dark)', fontWeight: n.read ? 400 : 700 }}>{n.title}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--donor-dark)' }}>{n.body}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--donor-muted)' }} title={fmtDateFull(n.createdAt)}>{timeAgo(n.createdAt)}</p>
                </div>
                {!n.read && (
                  <button
                    onClick={(e) => markOneRead(n.id, e)}
                    className="shrink-0 px-3 py-1 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                    style={{ background: 'var(--donor-light)', color: 'var(--donor-accent)' }}
                  >
                    {t('notifications.markAsRead')}
                  </button>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Load more */}
        {hasMore && !loading && filtered.length > 0 && (
          <div className="px-5 py-4 border-t text-center" style={{ borderColor: 'var(--donor-border)' }}>
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="px-6 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--donor-light)', color: 'var(--donor-accent)' }}
            >
              {loadingMore ? t('notifications.loadingMore') : t('notifications.loadMore')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
