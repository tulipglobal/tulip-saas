'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { apiGet, apiPut } from '@/lib/api'

interface Preference {
  alertType: string
  email: boolean
  inApp: boolean
}

interface PrefConfig {
  alertType: string
  label: string
}

interface Section {
  title: string
  prefs: PrefConfig[]
}

const allAlertTypes = [
  'expense.approved', 'expense.high_risk', 'expense.mismatch', 'expense.duplicate', 'expense.challenge_response',
  'budget.threshold_70', 'budget.threshold_80', 'budget.threshold_90', 'budget.threshold_100',
  'seal.anchored', 'seal.batch',
  'document.uploaded', 'document.expiring',
  'report.monthly_ready',
]

export default function NotificationPreferencesPage() {
  const t = useTranslations()
  const [preferences, setPreferences] = useState<Record<string, { email: boolean; inApp: boolean }>>({})
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sections: Section[] = [
    {
      title: t('notificationPreferences.expenseAlerts'),
      prefs: [
        { alertType: 'expense.approved', label: t('notificationPreferences.expenseApproved') },
        { alertType: 'expense.high_risk', label: t('notificationPreferences.highRiskExpense') },
        { alertType: 'expense.mismatch', label: t('notificationPreferences.ocrMismatch') },
        { alertType: 'expense.duplicate', label: t('notificationPreferences.duplicateDocument') },
        { alertType: 'expense.challenge_response', label: t('notificationPreferences.challengeResponse') },
      ],
    },
    {
      title: t('notificationPreferences.budgetAlerts'),
      prefs: [
        { alertType: 'budget.threshold_70', label: t('notificationPreferences.budget70') },
        { alertType: 'budget.threshold_80', label: t('notificationPreferences.budget80') },
        { alertType: 'budget.threshold_90', label: t('notificationPreferences.budget90') },
        { alertType: 'budget.threshold_100', label: t('notificationPreferences.budgetFull') },
      ],
    },
    {
      title: t('notificationPreferences.sealsBlockchain'),
      prefs: [
        { alertType: 'seal.anchored', label: t('notificationPreferences.newSealAnchored') },
        { alertType: 'seal.batch', label: t('notificationPreferences.weeklySealDigest') },
      ],
    },
    {
      title: t('notificationPreferences.documentsTitle'),
      prefs: [
        { alertType: 'document.uploaded', label: t('notificationPreferences.newDocumentUploaded') },
        { alertType: 'document.expiring', label: t('notificationPreferences.documentExpiring') },
      ],
    },
    {
      title: t('notificationPreferences.reportsTitle'),
      prefs: [
        { alertType: 'report.monthly_ready', label: t('notificationPreferences.monthlyReportReady') },
      ],
    },
  ]

  useEffect(() => {
    apiGet('/api/donor/notifications/preferences')
      .then(async r => {
        if (r.ok) {
          const d = await r.json()
          const prefs: Preference[] = d.preferences || []
          const map: Record<string, { email: boolean; inApp: boolean }> = {}
          for (const at of allAlertTypes) {
            const found = prefs.find(p => p.alertType === at)
            map[at] = found ? { email: found.email, inApp: found.inApp } : { email: true, inApp: true }
          }
          setPreferences(map)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const savePreferences = useCallback((updated: Record<string, { email: boolean; inApp: boolean }>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const prefsArray = Object.entries(updated).map(([alertType, vals]) => ({
        alertType,
        email: vals.email,
        inApp: vals.inApp,
      }))
      apiPut('/api/donor/notifications/preferences', { preferences: prefsArray })
        .then(() => {
          setToast(true)
          setTimeout(() => setToast(false), 2000)
        })
        .catch(() => {})
    }, 1000)
  }, [])

  const toggle = (alertType: string, channel: 'email' | 'inApp') => {
    setPreferences(prev => {
      const current = prev[alertType] || { email: true, inApp: true }
      const updated = { ...prev, [alertType]: { ...current, [channel]: !current[channel] } }
      savePreferences(updated)
      return updated
    })
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6 animate-fade-up">
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium text-white shadow-lg"
          style={{ background: 'var(--donor-accent)', animation: 'fade-up 0.3s ease-out' }}
        >
          {t('notificationPreferences.preferencesSaved')}
        </div>
      )}

      {/* Back link */}
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-medium hover:underline" style={{ color: 'var(--donor-accent)' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        {t('notificationPreferences.backToDashboard')}
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--donor-dark)' }}>{t('notificationPreferences.title')}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--donor-muted)' }}>{t('notificationPreferences.subtitle')}</p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-20 rounded-xl animate-skeleton-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map(section => (
            <div key={section.title} className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--donor-border)' }}>
              {/* Section header */}
              <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--donor-border)', background: 'var(--donor-light)' }}>
                <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--donor-dark)' }}>{section.title}</h2>
              </div>

              {/* Preference rows */}
              <div className="divide-y" style={{ borderColor: 'var(--donor-border)' }}>
                {section.prefs.map(pref => {
                  const val = preferences[pref.alertType] || { email: true, inApp: true }
                  return (
                    <div key={pref.alertType} className="px-5 py-3 flex items-center justify-between">
                      <span className="text-sm font-medium" style={{ color: 'var(--donor-dark)' }}>{pref.label}</span>
                      <div className="flex items-center gap-3">
                        {/* Email toggle */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs" style={{ color: 'var(--donor-muted)' }}>{t('notificationPreferences.email')}</span>
                          <button
                            onClick={() => toggle(pref.alertType, 'email')}
                            className="px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer"
                            style={{
                              background: val.email ? 'var(--donor-accent)' : 'var(--donor-border)',
                              color: val.email ? '#FFFFFF' : 'var(--donor-muted)',
                            }}
                          >
                            {val.email ? t('notificationPreferences.on') : t('notificationPreferences.off')}
                          </button>
                        </div>
                        {/* In-app toggle */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs" style={{ color: 'var(--donor-muted)' }}>{t('notificationPreferences.inApp')}</span>
                          <button
                            onClick={() => toggle(pref.alertType, 'inApp')}
                            className="px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer"
                            style={{
                              background: val.inApp ? 'var(--donor-accent)' : 'var(--donor-border)',
                              color: val.inApp ? '#FFFFFF' : 'var(--donor-muted)',
                            }}
                          >
                            {val.inApp ? t('notificationPreferences.on') : t('notificationPreferences.off')}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
