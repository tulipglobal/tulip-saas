'use client'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { apiFetch } from '@/lib/api'

const themeValues = ['light', 'dark', 'system'] as const

// Inline SVG icons to avoid lucide dependency issues
function SunIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function MoonIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function MonitorIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}

const iconMap = { light: SunIcon, dark: MoonIcon, system: MonitorIcon }

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const t = useTranslations()
  const [theme, setTheme] = useState<string>('system')

  const themes = [
    { value: 'light' as const, label: t('theme.light') },
    { value: 'dark' as const, label: t('theme.dark') },
    { value: 'system' as const, label: t('theme.system') },
  ]

  useEffect(() => {
    const saved = localStorage.getItem('tulip_donor_theme') || 'system'
    setTheme(saved)
    applyTheme(saved)

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      const current = localStorage.getItem('tulip_donor_theme') || 'system'
      if (current === 'system') {
        applyTheme('system')
      }
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  function applyTheme(t: string) {
    const root = document.documentElement
    if (t === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light')
    } else {
      root.setAttribute('data-theme', t)
    }
  }

  async function changeTheme(t: string) {
    setTheme(t)
    localStorage.setItem('tulip_donor_theme', t)
    applyTheme(t)
    try {
      await apiFetch('/api/donor/preferences/theme', { method: 'PUT', body: JSON.stringify({ theme: t }) })
    } catch {}
  }

  if (compact) {
    const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
    const Icon = iconMap[theme as keyof typeof iconMap] || MonitorIcon
    return (
      <button onClick={() => changeTheme(next)} className="p-2 rounded-lg hover:bg-[var(--hover-bg)] transition-colors" title={`Theme: ${theme}`}>
        <Icon className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
      {themes.map(({ value, label }) => {
        const Icon = iconMap[value]
        return (
          <button
            key={value}
            onClick={() => changeTheme(value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              theme === value ? 'shadow-sm' : 'hover:opacity-70'
            }`}
            style={{
              background: theme === value ? 'var(--bg-card)' : 'transparent',
              color: theme === value ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        )
      })}
    </div>
  )
}
