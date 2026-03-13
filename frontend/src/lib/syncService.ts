import { offlineDb, type PendingExpense } from './offlineDb';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050';

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
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

  let synced = 0;

  for (const expense of pending) {
    try {
      // Mark syncing
      await offlineDb.pending_expenses.update(expense.id!, { status: 'syncing' });

      // POST the expense
      const res = await fetch(`${API_URL}/api/expenses`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
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

      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      const expenseId = data.id;

      // Upload receipt if exists
      if (expense.receiptBlob && expenseId) {
        const fd = new FormData();
        fd.append('file', expense.receiptBlob, expense.receiptName || 'receipt.jpg');
        fd.append('title', expense.description || 'Receipt');
        fd.append('expenseId', expenseId);

        await fetch(`${API_URL}/api/expenses/upload-receipt`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        // Seal is issued automatically by the backend
      }

      // Mark synced
      await offlineDb.pending_expenses.update(expense.id!, {
        status: 'synced',
        syncedExpenseId: expenseId,
      });
      synced++;
    } catch {
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
