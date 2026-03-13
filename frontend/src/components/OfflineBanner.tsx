'use client';

import { WifiOff, RefreshCw, CheckCircle } from 'lucide-react';
import { useOfflineSync } from '@/hooks/useOfflineSync';

export default function OfflineBanner() {
  const { isOnline, pendingCount, isSyncing, justSynced } = useOfflineSync();

  if (justSynced) {
    return (
      <div className="bg-green-500 text-white text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-2">
        <CheckCircle size={14} /> All synced
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="bg-amber-500 text-white text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-2">
        <WifiOff size={14} /> You&apos;re offline {pendingCount > 0 && <>— {pendingCount} item{pendingCount !== 1 ? 's' : ''} pending sync</>}
      </div>
    );
  }

  if (isSyncing && pendingCount > 0) {
    return (
      <div className="bg-blue-500 text-white text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-2">
        <RefreshCw size={14} className="animate-spin" /> Back online — syncing {pendingCount} item{pendingCount !== 1 ? 's' : ''}...
      </div>
    );
  }

  return null;
}
