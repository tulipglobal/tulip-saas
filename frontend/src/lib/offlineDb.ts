import Dexie, { type Table } from 'dexie';

export interface SyncQueueItem {
  id?: number;
  action: string;
  endpoint: string;
  method: string;
  payload: object;
  fileBlob?: Blob;
  retries: number;
  createdAt: Date;
  status: 'pending' | 'syncing' | 'done' | 'failed';
}

export interface PendingExpense {
  id?: number;
  budgetId: string;
  projectId: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
  category: string;
  vendorName?: string;
  receiptBlob?: Blob;
  receiptName?: string;
  createdOffline: Date;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  retries: number;
  syncedExpenseId?: string;
}

export interface CachedProject {
  id: string;
  name: string;
  data: object;
  cachedAt: Date;
}

export interface CachedBudget {
  id: string;
  projectId: string;
  data: object;
  cachedAt: Date;
}

export interface PendingDocument {
  id?: number;
  entityType: string;
  entityId: string;
  documentName: string;
  documentType: string;
  fileBlob: Blob;
  fileType: string;
  fileName: string;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  createdAt: number;
  retries: number;
  error?: string;
}

export interface CachedDocument {
  id: string;
  name: string;
  data: object;
  cachedAt: Date;
}

export interface CachedExpense {
  id: string;
  data: object;
  cachedAt: Date;
}

class TulipOfflineDB extends Dexie {
  sync_queue!: Table<SyncQueueItem>;
  pending_expenses!: Table<PendingExpense>;
  pending_documents!: Table<PendingDocument>;
  cached_projects!: Table<CachedProject>;
  cached_budgets!: Table<CachedBudget>;
  cached_documents!: Table<CachedDocument>;
  cached_expenses!: Table<CachedExpense>;

  constructor() {
    super('tulip_offline_db');
    // Keep ALL version declarations so Dexie can upgrade from any previous version
    this.version(1).stores({
      sync_queue: '++id, status, createdAt',
      pending_expenses: '++id, budgetId, projectId, status, createdOffline',
      cached_projects: 'id, cachedAt',
      cached_budgets: 'id, projectId, cachedAt',
    });
    this.version(2).stores({
      sync_queue: '++id, status, createdAt',
      pending_expenses: '++id, budgetId, projectId, status, createdOffline',
      cached_projects: 'id, cachedAt',
      cached_budgets: 'id, projectId, cachedAt',
      cached_documents: 'id, cachedAt',
    });
    this.version(3).stores({
      sync_queue: '++id, status, createdAt',
      pending_expenses: '++id, budgetId, projectId, status, createdOffline',
      cached_projects: 'id, cachedAt',
      cached_budgets: 'id, projectId, cachedAt',
      cached_documents: 'id, cachedAt',
      cached_expenses: 'id, cachedAt',
    });
    this.version(4).stores({
      sync_queue: '++id, status, createdAt',
      pending_expenses: '++id, budgetId, projectId, status, createdOffline',
      pending_documents: '++id, entityType, entityId, status, createdAt',
      cached_projects: 'id, cachedAt',
      cached_budgets: 'id, projectId, cachedAt',
      cached_documents: 'id, cachedAt',
      cached_expenses: 'id, cachedAt',
    });
  }
}

export const offlineDb = new TulipOfflineDB();
