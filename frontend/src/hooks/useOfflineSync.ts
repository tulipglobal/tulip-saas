'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { offlineDb } from '@/lib/offlineDb';
import { drainQueue, cacheProjects } from '@/lib/syncService';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050';

// Probe real connectivity — navigator.onLine is unreliable in Safari PWA
async function checkOnline(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    await fetch(`${API_URL}/`, {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}

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

  const goOnline = useCallback(() => {
    setOnline(true);
    drain();
  }, [drain]);

  // Pre-cache projects silently when online
  useEffect(() => {
    if (typeof window === 'undefined' || !online) return;
    const token = localStorage.getItem('tulip_token');
    if (token) cacheProjects(token).catch(() => {});
  }, [online]);

  // Initial connectivity check on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    checkOnline().then(up => {
      setOnline(up);
      if (up) drain();
    });
  }, [drain]);

  // Poll every 3s when offline — catches Safari stuck state
  useEffect(() => {
    if (typeof window === 'undefined' || online) return;
    const interval = setInterval(async () => {
      const up = await checkOnline();
      if (up) goOnline();
    }, 3000);
    return () => clearInterval(interval);
  }, [online, goOnline]);

  // Re-probe when app comes to foreground (Safari PWA resume)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onVisible = async () => {
      if (document.visibilityState !== 'visible') return;
      const up = await checkOnline();
      if (up && !online) goOnline();
      if (!up && online) setOnline(false);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [online, goOnline]);

  // Browser online/offline events as backup
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = async () => {
      const up = await checkOnline();
      if (up) goOnline();
    };
    const handleOffline = () => {
      setOnline(false);
      setJustSynced(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for background sync messages from SW
    let handleMessage: ((event: MessageEvent) => void) | null = null;
    if ('serviceWorker' in navigator) {
      handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'BACKGROUND_SYNC') drain();
      };
      navigator.serviceWorker.addEventListener('message', handleMessage);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (handleMessage && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      }
    };
  }, [drain, goOnline]);

  return { isOnline: online, pendingCount, isSyncing, justSynced, drain };
}
