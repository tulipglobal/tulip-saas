import { offlineDb, type PendingExpense, type PendingDocument } from './offlineDb';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050';

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

/** Try to refresh the access token using the stored refresh token */
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('tulip_refresh');
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.accessToken) {
      localStorage.setItem('tulip_token', data.accessToken);
      if (data.refreshToken) localStorage.setItem('tulip_refresh', data.refreshToken);
      console.log('[sync] Token refreshed successfully');
      return data.accessToken;
    }
    return null;
  } catch {
    return null;
  }
}

/** Get a valid access token, refreshing if needed */
async function getValidToken(): Promise<string | null> {
  const token = localStorage.getItem('tulip_token');
  if (!token) return null;

  // Quick check: try a lightweight authenticated request
  try {
    const res = await fetch(`${API_URL}/api/projects?limit=1`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (res.ok) return token;
    if (res.status === 401) {
      console.log('[sync] Token expired, attempting refresh...');
      return await refreshAccessToken();
    }
    return token; // other errors — try anyway
  } catch {
    return token; // network error — try anyway
  }
}

export async function cacheProjects(token: string) {
  try {
    const res = await fetch(`${API_URL}/api/projects?limit=100`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) return;
    const data = await res.json();
    const items = data.data ?? data.items ?? [];
    await offlineDb.cached_projects.clear();
    for (const p of items) {
      await offlineDb.cached_projects.put({
        id: p.id,
        name: p.name,
        data: p,
        cachedAt: new Date(),
      });
    }
  } catch {
    // silently fail — offline cache is best-effort
  }
}

export async function cacheDocuments(token: string) {
  try {
    const res = await fetch(`${API_URL}/api/documents?limit=100`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) return;
    const data = await res.json();
    const items = data.data ?? data.items ?? [];
    await offlineDb.cached_documents.clear();
    for (const d of items) {
      await offlineDb.cached_documents.put({
        id: d.id,
        name: d.name,
        data: d,
        cachedAt: new Date(),
      });
    }
  } catch {
    // silently fail
  }
}

export async function cacheExpenses(token: string) {
  try {
    const res = await fetch(`${API_URL}/api/expenses?limit=50`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) return;
    const data = await res.json();
    const items = data.data ?? data.items ?? [];
    await offlineDb.cached_expenses.clear();
    for (const e of items) {
      await offlineDb.cached_expenses.put({
        id: e.id,
        data: e,
        cachedAt: new Date(),
      });
    }
  } catch {
    // silently fail
  }
}

export async function cacheBudgets(projectId: string, token: string) {
  try {
    const res = await fetch(`${API_URL}/api/budgets?projectId=${projectId}&limit=50`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) return;
    const data = await res.json();
    const items = data.data ?? [];
    for (const b of items) {
      await offlineDb.cached_budgets.put({
        id: b.id,
        projectId,
        data: b,
        cachedAt: new Date(),
      });
    }
  } catch {
    // silently fail
  }
}

export async function queueExpense(expense: PendingExpense) {
  await offlineDb.pending_expenses.add(expense);
  // Update pending count in localStorage for quick reads
  const count = await offlineDb.pending_expenses.where('status').equals('pending').count();
  localStorage.setItem('pendingCount', String(count));

  // Register background sync if available
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const sw = await navigator.serviceWorker.ready;
      await (sw as any).sync.register('expense-sync');
    } catch {
      // Background sync not supported — will drain on online event
    }
  }
}

export async function drainQueue(token: string): Promise<number> {
  const pending = await offlineDb.pending_expenses
    .where('status')
    .equals('pending')
    .toArray();

  console.log('[sync] draining', pending.length, 'items');

  if (pending.length === 0) return 0;

  // Ensure we have a valid (non-expired) token before syncing
  let activeToken = await getValidToken();
  if (!activeToken) {
    console.error('[sync] No valid token available — cannot drain');
    return 0;
  }
  console.log('[sync] Using valid token for drain');

  let synced = 0;

  for (const expense of pending) {
    try {
      console.log('[sync] syncing expense:', expense.id, expense.description, expense.amount);
      // Mark syncing
      await offlineDb.pending_expenses.update(expense.id!, { status: 'syncing' });

      // POST the expense
      const res = await fetch(`${API_URL}/api/expenses`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${activeToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: expense.description,
          amount: expense.amount,
          currency: expense.currency,
          expenseDate: expense.date,
          category: expense.category || null,
          vendor: expense.vendorName || null,
          projectId: expense.projectId,
          budgetId: expense.budgetId || null,
          notes: '[Offline] Created offline and auto-synced',
        }),
      });

      // If 401, try refreshing token once and retry
      if (res.status === 401) {
        console.log('[sync] Got 401 on expense create — refreshing token...');
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
          console.error('[sync] Token refresh failed — aborting drain');
          await offlineDb.pending_expenses.update(expense.id!, { status: 'pending' });
          break;
        }
        activeToken = refreshed;
        // Retry with new token
        const retryRes = await fetch(`${API_URL}/api/expenses`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${activeToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: expense.description,
            amount: expense.amount,
            currency: expense.currency,
            expenseDate: expense.date,
            category: expense.category || null,
            vendor: expense.vendorName || null,
            projectId: expense.projectId,
            budgetId: expense.budgetId || null,
            notes: '[Offline] Created offline and auto-synced',
          }),
        });
        if (!retryRes.ok) {
          const errBody = await retryRes.json().catch(() => ({}));
          console.error('[sync] Retry failed:', retryRes.status, errBody);
          throw new Error('API error after token refresh');
        }
        const retryData = await retryRes.json();
        // Continue with the retried response
        await handleExpenseCreated(expense, retryData.id, activeToken);
        synced++;
        continue;
      }

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        console.error('[tulip-sync] API rejected expense:', res.status, errBody);
        throw new Error('API error');
      }
      const data = await res.json();
      await handleExpenseCreated(expense, data.id, activeToken);
      synced++;
    } catch (err) {
      console.error('[sync] Failed to sync expense', expense.id, ':', err instanceof Error ? err.message : err);
      // Increment retries
      const retries = (expense.retries ?? 0) + 1;
      await offlineDb.pending_expenses.update(expense.id!, {
        status: retries >= 3 ? 'failed' : 'pending',
        retries,
      });
    }
  }

  // Update localStorage count
  const remaining = await offlineDb.pending_expenses
    .where('status')
    .equals('pending')
    .count();
  localStorage.setItem('pendingCount', String(remaining));

  // Fire custom event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tulip-sync-complete', { detail: { synced } }));
  }

  return synced;
}

export async function queueDocument(doc: PendingDocument) {
  await offlineDb.pending_documents.add(doc);
  // Register background sync if available
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const sw = await navigator.serviceWorker.ready;
      await (sw as any).sync.register('document-sync');
    } catch {
      // Background sync not supported — will drain on online event
    }
  }
}

export async function drainDocumentQueue(token: string): Promise<number> {
  const pending = await offlineDb.pending_documents
    .where('status')
    .equals('pending')
    .toArray();

  console.log('[sync] draining', pending.length, 'documents');
  if (pending.length === 0) return 0;

  let activeToken = await getValidToken();
  if (!activeToken) {
    console.error('[sync] No valid token — cannot drain documents');
    return 0;
  }

  let synced = 0;

  for (const doc of pending) {
    try {
      await offlineDb.pending_documents.update(doc.id!, { status: 'syncing' });

      const fd = new FormData();
      fd.append('file', doc.fileBlob, doc.fileName);
      fd.append('name', doc.documentName);
      fd.append('documentType', doc.documentType);
      fd.append('documentLevel', doc.entityType);
      if (doc.entityType === 'project') fd.append('projectId', doc.entityId);
      if (doc.entityType === 'expense') fd.append('expenseId', doc.entityId);

      let res = await fetch(`${API_URL}/api/documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${activeToken}` },
        body: fd,
      });

      // Handle 401 — refresh token and retry once
      if (res.status === 401) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
          await offlineDb.pending_documents.update(doc.id!, { status: 'pending' });
          break;
        }
        activeToken = refreshed;
        res = await fetch(`${API_URL}/api/documents`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${activeToken}` },
          body: fd,
        });
      }

      // Handle 409 duplicate — auto-retry with allowDuplicate
      if (res.status === 409) {
        res = await fetch(`${API_URL}/api/documents?allowDuplicate=1`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${activeToken}` },
          body: fd,
        });
      }

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        console.error('[sync] Document upload failed:', res.status, errBody);
        throw new Error('API error');
      }

      await offlineDb.pending_documents.update(doc.id!, { status: 'synced' });
      synced++;
    } catch (err) {
      console.error('[sync] Failed to sync document', doc.id, ':', err instanceof Error ? err.message : err);
      const retries = (doc.retries ?? 0) + 1;
      await offlineDb.pending_documents.update(doc.id!, {
        status: retries >= 3 ? 'failed' : 'pending',
        retries,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return synced;
}

/** Upload receipt and mark expense as synced */
async function handleExpenseCreated(expense: PendingExpense, expenseId: string, token: string) {
  // Upload receipt if exists
  if (expense.receiptBlob && expenseId) {
    const fd = new FormData();
    fd.append('file', expense.receiptBlob, expense.receiptName || 'receipt.jpg');
    fd.append('title', expense.description || 'Receipt');
    fd.append('expenseId', expenseId);

    const uploadRes = await fetch(`${API_URL}/api/expenses/upload-receipt`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    if (!uploadRes.ok) {
      const err = await uploadRes.json().catch(() => ({}));
      console.error('[sync] Receipt upload failed:', uploadRes.status, err);
      // Don't fail the expense — it was created successfully, receipt can be re-uploaded
    }
  }

  // Mark synced
  await offlineDb.pending_expenses.update(expense.id!, {
    status: 'synced',
    syncedExpenseId: expenseId,
  });
}
