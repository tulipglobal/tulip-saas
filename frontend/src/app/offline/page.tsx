'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function OfflinePage() {
  const t = useTranslations();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const count = parseInt(localStorage.getItem('pendingCount') || '0', 10);
    setPendingCount(count);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--tulip-cream)' }}>
      <div className="max-w-md w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-100 mx-auto">
          <WifiOff size={36} className="text-amber-600" />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-[var(--tulip-forest)]" style={{ fontFamily: 'Inter, sans-serif' }}>
            {t('offlinePage.title')}
          </h1>
          <p className="text-[var(--tulip-forest)]/60 mt-2">
            {t('offlinePage.description')}
          </p>
        </div>

        {pendingCount > 0 && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 text-amber-700 text-sm font-medium">
            <RefreshCw size={14} />
            {t('offlinePage.pendingSync', { count: pendingCount })}
          </div>
        )}

        <div className="pt-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium text-[var(--tulip-forest)] bg-[var(--tulip-gold)] hover:bg-[var(--tulip-orange)] transition-colors"
          >
            {t('offlinePage.backToHome')}
          </Link>
        </div>

        <p className="text-xs text-[var(--tulip-forest)]/40">
          {t('offlinePage.offlineHint')}
        </p>
      </div>
    </div>
  );
}
