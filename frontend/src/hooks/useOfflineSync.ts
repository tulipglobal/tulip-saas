'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { offlineDb } from '@/lib/offlineDb';
import { drainQueue, drainDocumentQueue, cacheProjects, cacheDocuments, cacheExpenses } from '@/lib/syncService';

// Warm the SW page cache so Android Chrome can serve pages offline.
// Next.js Link does client-side routing (RSC payloads) which workbox can't
// serve as HTML offline. Fetching the pages directly triggers workbox's
// NetworkFirst handler and caches the full HTML.
async function warmPageCache() {
  if (!('serviceWorker' in navigator)) return;
  const pages = [
    '/dashboard',
    '/dashboard/expenses',
    '/dashboard/expenses/new',
    '/dashboard/documents',
    '/dashboard/projects',
    '/dashboard/budgets',
    '/dashboard/audit',
  ];
  for (const page of pages) {
    try {
      await fetch(page, { cache: 'no-cache' });
    } catch {
      // best-effort — don't block on failures
    }
  }
  console.log('[tulip-sync] Page cache warmed');
}

// Android Chrome fires reliable online/offline events — the probe must not
// override navigator.onLine=false on these devices (the SW may serve a
// cached 200 for /api/ping even when truly offline).
const isAndroidChrome = typeof navigator !== 'undefined' &&
  /Android/.test(navigator.userAgent) &&
  /Chrome/.test(navigator.userAgent);

// Same-origin probe — avoids CORS issues on Android Chrome PWA
async function checkOnline(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('/api/ping', {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);
    // Only count as online if ping returns 200 (backend is reachable)
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

  const pendingCount = useLiveQuery(
    () => offlineDb.pending_expenses.where('status').equals('pending').count(),
    [],
    0
  );

  const drain = useCallback(async () => {
    if (drainRef.current) return;
    drainRef.current = true;
    const token = typeof window !== 'undefined' ? localStorage.getItem('tulip_token') : null;
    console.log('[tulip-sync] token:', token ? 'found' : 'MISSING');
    if (!token) { console.error('[tulip-sync] No token — cannot drain'); drainRef.current = false; return; }

    console.log('[tulip-sync] Starting drain...');
    setIsSyncing(true);
    try {
      const synced = await drainQueue(token);
      const docsSynced = await drainDocumentQueue(token);
      console.log('[tulip-sync] Drain complete, expenses:', synced, 'documents:', docsSynced);
      if (synced > 0 || docsSynced > 0) {
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
    console.log('[tulip-sync] Going online — triggering drain');
    setOnline(true);
    drain();
  }, [drain]);

  // Pre-cache projects + documents + expenses + pages silently when online
  useEffect(() => {
    if (typeof window === 'undefined' || !online) return;
    const token = localStorage.getItem('tulip_token');
    if (token) {
      cacheProjects(token).catch(() => {});
      cacheDocuments(token).catch(() => {});
      cacheExpenses(token).catch(() => {});
    }
    // Warm SW page cache for Android offline support
    warmPageCache().catch(() => {});
  }, [online]);

  // Initial connectivity check on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    checkOnline().then(up => {
      console.log('[tulip-sync] Initial probe:', up ? 'online' : 'offline',
        '| navigator.onLine:', navigator.onLine, '| android:', isAndroidChrome);
      if (isAndroidChrome && !navigator.onLine) {
        // Android says offline — trust it, don't let a cached SW response override
        console.log('[tulip-sync] Android offline — ignoring probe result');
        setOnline(false);
        return;
      }
      setOnline(up);
      if (up) drain();
    });
  }, [drain]);

  // Poll every 3s when offline — catches Safari/Android stuck state
  useEffect(() => {
    if (typeof window === 'undefined' || online) return;
    const interval = setInterval(async () => {
      // On Android, trust navigator.onLine — don't go online from probe if browser says offline
      if (isAndroidChrome && !navigator.onLine) return;
      const up = await checkOnline();
      if (up) goOnline();
    }, 3000);
    return () => clearInterval(interval);
  }, [online, goOnline]);

  // Re-probe when app comes to foreground (PWA resume)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onVisible = async () => {
      if (document.visibilityState !== 'visible') return;
      if (isAndroidChrome && !navigator.onLine) {
        // Android says offline — trust it immediately
        if (online) setOnline(false);
        return;
      }
      const up = await checkOnline();
      if (up && !online) goOnline();
      if (!up && online) setOnline(false);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [online, goOnline]);

  // Browser online/offline events — fires instantly on Android airplane toggle
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      console.log('[tulip-sync] window "online" event — setting online immediately');
      setOnline(true);
      // Verify backend is actually reachable, then drain
      checkOnline().then(up => {
        if (up) {
          drain();
        } else {
          // Browser says online but backend unreachable — stay online for UX
          // but don't drain (drain will fail gracefully anyway)
          console.log('[tulip-sync] Browser online but backend unreachable');
        }
      });
    };
    const handleOffline = () => {
      console.log('[tulip-sync] window "offline" event — setting offline immediately');
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
  }, [drain]);

  return { isOnline: online, pendingCount, isSyncing, justSynced, drain };
}
