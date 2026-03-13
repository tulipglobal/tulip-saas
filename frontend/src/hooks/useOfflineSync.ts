'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { offlineDb } from '@/lib/offlineDb';
import { drainQueue, cacheProjects } from '@/lib/syncService';

export function useOfflineSync() {
  const [online, setOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState(false);
  const drainRef = useRef(false);

  const pendingCount = useLiveQuery(
    () => offlineDb.pending_expenses.where('status').equals('pending').count(),
    [],
    0
  );

  const drain = useCallback(async () => {
    if (drainRef.current) return;
    drainRef.current = true;
    const token = typeof window !== 'undefined' ? localStorage.getItem('tulip_token') : null;
    if (!token) { drainRef.current = false; return; }

    setIsSyncing(true);
    try {
      const synced = await drainQueue(token);
      if (synced > 0) {
        setJustSynced(true);
        setTimeout(() => setJustSynced(false), 3000);
      }
    } catch {
      // silent
    }
    setIsSyncing(false);
    drainRef.current = false;
  }, []);

  // Pre-cache projects silently when online
  useEffect(() => {
    if (typeof window === 'undefined' || !online) return;
    const token = localStorage.getItem('tulip_token');
    if (token) cacheProjects(token).catch(() => {});
  }, [online]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setOnline(navigator.onLine);

    const goOnline = () => {
      setOnline(true);
      drain();
    };
    const goOffline = () => {
      setOnline(false);
      setJustSynced(false);
    };

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    // Listen for background sync messages from SW
    if ('serviceWorker' in navigator) {
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'BACKGROUND_SYNC') {
          drain();
        }
      };
      navigator.serviceWorker.addEventListener('message', handleMessage);
      return () => {
        window.removeEventListener('online', goOnline);
        window.removeEventListener('offline', goOffline);
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      };
    }

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [drain]);

  return { isOnline: online, pendingCount, isSyncing, justSynced, drain };
}
