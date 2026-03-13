'use client';

import { useTranslations } from 'next-intl';
import { WifiOff, RefreshCw, CheckCircle } from 'lucide-react';
import { useOfflineSync } from '@/hooks/useOfflineSync';

export default function OfflineBanner() {
  const t = useTranslations();
  const { isOnline, pendingCount, isSyncing, justSynced } = useOfflineSync();

  if (justSynced) {
    return (
      <div className="bg-green-500 text-white text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-2">
        <CheckCircle size={14} /> {t('offline.allSynced')}
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="bg-amber-500 text-white text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-2">
        <WifiOff size={14} /> {t('offline.youreOffline')} {pendingCount > 0 && <>{t('offline.pendingSync', { count: pendingCount })}</>}
      </div>
    );
  }

  if (isSyncing && pendingCount > 0) {
    return (
      <div className="bg-blue-500 text-white text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-2">
        <RefreshCw size={14} className="animate-spin" /> {t('offline.backOnlineSyncing', { count: pendingCount })}
      </div>
    );
  }

  return null;
}
