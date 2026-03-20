'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

const languages = [
  { code: 'en', label: 'EN', flag: '\u{1F1EC}\u{1F1E7}' },
  { code: 'fr', label: 'FR', flag: '\u{1F1EB}\u{1F1F7}' },
  { code: 'es', label: 'ES', flag: '\u{1F1EA}\u{1F1F8}' },
  { code: 'pt', label: 'PT', flag: '\u{1F1F5}\u{1F1F9}' },
  { code: 'it', label: 'IT', flag: '\u{1F1EE}\u{1F1F9}' },
];

export default function LanguageSwitcher() {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('en');
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const match = document.cookie.match(/preferredLanguage=([^;]+)/);
    if (match) setCurrent(match[1]);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const switchLanguage = async (code: string) => {
    document.cookie = `preferredLanguage=${code};path=/;max-age=31536000`;
    setCurrent(code);
    setOpen(false);

    try {
      const token = localStorage.getItem('donor_token');
      if (token) {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/donor/auth/language`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ language: code })
        });
      }
    } catch {
      // fail silently — cookie already set
    }

    router.refresh();
  };

  const currentLang = languages.find(l => l.code === current) || languages[0];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm hover:bg-[var(--donor-light)] transition-all"
      >
        <span>{currentLang.flag}</span>
        <span className="font-medium text-sm" style={{ color: 'var(--donor-muted)' }}>{currentLang.label}</span>
        <svg className="w-3 h-3" style={{ color: 'var(--donor-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-44 rounded-lg shadow-lg z-50 overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--donor-border)' }}>
          {languages.map(lang => (
            <button
              key={lang.code}
              onClick={() => switchLanguage(lang.code)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-[var(--donor-light)] transition-colors ${
                current === lang.code ? 'bg-[var(--donor-light)] font-medium' : ''
              }`}
              style={{ color: 'var(--donor-dark)' }}
            >
              <span className="text-base">{lang.flag}</span>
              <span>{t('language.' + lang.code)}</span>
              {current === lang.code && (
                <svg className="w-4 h-4 ml-auto" style={{ color: 'var(--donor-accent)' }} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
