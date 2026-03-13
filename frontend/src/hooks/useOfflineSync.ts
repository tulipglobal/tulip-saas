'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { offlineDb } from '@/lib/offlineDb';
import { drainQueue, cacheProjects } from '@/lib/syncService';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050';

// Probe real connectivity — navigator.onLine is unreliable in Safari PWA
async function checkConnectivity(): Promise<boolean> {
  if (typeof navigator === 'undefined') return true;
  // Fast check first
  if (!navigator.onLine) return false;
  // Verify with a real network request (HEAD is lightweight)
  try {
    const res = await fetch(`${API_URL}/api/docs`, {
      method: 'HEAD',
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function useOfflineSync() {
  const [online, setOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState(false);
  const drainRef = useRef(false);
  const probeRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pendingCount = useLiveQuery(
    () => offlineDb.pending_expenses.where('status').equals('pending').count(),
    [],
    0
  );

  const drain = useCallback(async () => {
    if (drainRef.current) return;
    drainRef.current = true;
    const token = typeof window !== 'undefined' ? localStorage.getItem('tulip_token') : null;
    if (!token) { console.warn('[tulip-sync] No token, skipping drain'); drainRef.current = false; return; }

    console.log('[tulip-sync] Starting drain...');
    setIsSyncing(true);
    try {
      const synced = await drainQueue(token);
      console.log('[tulip-sync] Drain complete, synced:', synced);
      if (synced > 0) {
        setJustSynced(true);
        setTimeout(() => setJustSynced(false), 3000);
      }
    } catch (err) {
      console.error('[tulip-sync] Drain failed:', err);
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

  // Probe connectivity on mount + periodically when offline (Safari fix)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const probe = async () => {
      const isUp = await checkConnectivity();
      setOnline(prev => {
        if (!prev && isUp) {
          // Transitioning to online — trigger drain
          drain();
        }
        return isUp;
      });
    };

    // Initial probe
    probe();

    // Re-probe every 5s when we think we're offline (catches Safari stuck state)
    probeRef.current = setInterval(() => {
      if (!navigator.onLine) return; // truly offline, skip probe
      probe(); // navigator says online but state says offline — verify
    }, 5000);

    return () => {
      if (probeRef.current) clearInterval(probeRef.current);
    };
  }, [drain]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const goOnline = async () => {
      const isUp = await checkConnectivity();
      if (isUp) {
        setOnline(true);
        drain();
      }
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
