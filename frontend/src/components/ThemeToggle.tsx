'use client'
import { useState, useEffect } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { apiFetch } from '@/lib/api'

const themes = [
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'dark', icon: Moon, label: 'Dark' },
  { value: 'system', icon: Monitor, label: 'System' },
] as const

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<string>('system')

  useEffect(() => {
    const saved = localStorage.getItem('tulip_theme') || 'system'
    setTheme(saved)
    applyTheme(saved)

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      const current = localStorage.getItem('tulip_theme') || 'system'
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
    localStorage.setItem('tulip_theme', t)
    applyTheme(t)
    try {
      await apiFetch('/api/user/preferences/theme', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theme: t }) })
    } catch {}
  }

  if (compact) {
    const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
    const Icon = themes.find(t => t.value === theme)?.icon || Monitor
    return (
      <button onClick={() => changeTheme(next)} className="p-2 rounded-lg hover:bg-[var(--hover-bg)] transition-colors" title={`Theme: ${theme}`}>
        <Icon className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
      {themes.map(({ value, icon: Icon, label }) => (
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
      ))}
    </div>
  )
}
