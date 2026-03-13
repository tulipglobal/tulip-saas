'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

const languages = [
  { code: 'en', label: 'EN', flag: '🇬🇧' },
  { code: 'fr', label: 'FR', flag: '🇫🇷' },
  { code: 'es', label: 'ES', flag: '🇪🇸' },
  { code: 'pt', label: 'PT', flag: '🇵🇹' },
  { code: 'it', label: 'IT', flag: '🇮🇹' },
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

  // Close on click outside
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
      const token = localStorage.getItem('tulip_token');
      if (token) {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/language`, {
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
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm hover:bg-[#e1eedd] border border-transparent hover:border-[#c8d6c0] transition-all"
      >
        <span>{currentLang.flag}</span>
        <span className="font-medium text-[#183a1d]/70">{currentLang.label}</span>
        <svg className="w-3 h-3 text-[#183a1d]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-44 bg-[#fefbe9] rounded-lg shadow-lg border border-[#c8d6c0] z-50">
          {languages.map(lang => (
            <button
              key={lang.code}
              onClick={() => switchLanguage(lang.code)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-[#e1eedd] first:rounded-t-lg last:rounded-b-lg transition-colors ${
                current === lang.code ? 'bg-[#e1eedd] text-[#183a1d] font-medium' : 'text-[#183a1d]/70'
              }`}
            >
              <span className="text-base">{lang.flag}</span>
              <span>{t('language.' + lang.code)}</span>
              {current === lang.code && (
                <svg className="w-4 h-4 ml-auto text-[#183a1d]" fill="currentColor" viewBox="0 0 20 20">
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
