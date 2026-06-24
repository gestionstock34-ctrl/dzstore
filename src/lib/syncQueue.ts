
import { db, auth } from './firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { idbGet, idbSet } from './indexedDb';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface SyncOperation {
  id: string;
  timestamp: number;
  type: 'set' | 'delete';
  docPath: string;
  payload?: any;
}

const STORAGE_KEY = 'dzstore_sync_queue';
let isSyncing = false;
const listeners = new Set<(queue: SyncOperation[], isSyncing: boolean) => void>();

// Load the current queue from IndexedDB
export async function getSyncQueue(): Promise<SyncOperation[]> {
  try {
    const raw = await idbGet(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('[SyncQueue] Failed to read sync queue:', e);
    return [];
  }
}

// Save the queue to IndexedDB
async function saveSyncQueue(queue: SyncOperation[]): Promise<void> {
  try {
    await idbSet(STORAGE_KEY, JSON.stringify(queue));
    notifyListeners(queue);
  } catch (e) {
    console.error('[SyncQueue] Failed to write sync queue:', e);
  }
}

// Subscribe to queue change events (for live UI indicators)
export function subscribeToSyncQueue(callback: (queue: SyncOperation[], syncing: boolean) => void): () => void {
  listeners.add(callback);
  // Initial fire
  getSyncQueue().then((q) => callback(q, isSyncing));
  return () => {
    listeners.delete(callback);
  };
}

function notifyListeners(queue: SyncOperation[]) {
  listeners.forEach((cb) => {
    try {
      cb(queue, isSyncing);
    } catch (err) {
      console.error(err);
    }
  });
}

export interface BatchSyncOperation {
  type: 'set' | 'delete';
  docPath: string;
  payload?: any;
}

function sanitizePayload(val: any): any {
  if (val === undefined) return null;
  if (val === null) return null;
  if (Array.isArray(val)) {
    return val.map(sanitizePayload);
  }
  if (typeof val === 'object') {
    const cleaned: any = {};
    for (const key of Object.keys(val)) {
      const v = val[key];
      if (v !== undefined) {
        cleaned[key] = sanitizePayload(v);
      }
    }
    return cleaned;
  }
  return val;
}

// Enqueue a batch of mutations at once to prevent IndexedDB race conditions
export async function enqueueSyncBatch(
  operations: BatchSyncOperation[]
): Promise<void> {
  if (operations.length === 0) return;

  const queue = await getSyncQueue();

  for (const op of operations) {
    const { type, docPath, payload } = op;
    const cleanPayload = payload ? sanitizePayload(payload) : undefined;
    
    const existingIndex = queue.findIndex(item => item.docPath === docPath);
    if (existingIndex > -1) {
      const prevItem = queue[existingIndex];
      if (type === 'delete') {
        queue[existingIndex] = {
          id: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          timestamp: Date.now(),
          type,
          docPath,
          payload: cleanPayload
        };
      } else {
        queue[existingIndex] = {
          ...prevItem,
          timestamp: Date.now(),
          payload: {
            ...prevItem.payload,
            ...cleanPayload,
            updatedAt: new Date().toISOString()
          }
        };
      }
    } else {
      queue.push({
        id: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        timestamp: Date.now(),
        type,
        docPath,
        payload: cleanPayload
      });
    }
  }

  await saveSyncQueue(queue);

  // Attempt sync immediately in the background
  triggerBackgroundSync();
}

// Enqueue a new mutation
export async function enqueueSync(
  type: 'set' | 'delete',
  docPath: string,
  payload?: any
): Promise<void> {
  return enqueueSyncBatch([{ type, docPath, payload }]);
}

// Auto-run sync check helper
let syncTimeout: any = null;
export function triggerBackgroundSync() {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    processSyncQueue().catch(err => console.error('[SyncQueue] Background processing failed:', err));
  }, 1500);
}

// Process the Sync Queue
export async function processSyncQueue(force = false): Promise<boolean> {
  if (isSyncing) return false;
  
  // Quick pre-check on connection (allow force bypass for false negatives in webviews)
  if (!force && typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }

  // Prevent handling of queue items when auth isn't established, protecting unauthenticated writes from getting dropped or rejected
  if (!auth.currentUser) {
    console.log('[SyncQueue] No active auth session. Postponing sync execution.');
    return false;
  }

  const queue = await getSyncQueue();
  if (queue.length === 0) {
    return true; // nothing to sync
  }

  isSyncing = true;
  notifyListeners(queue);

  console.log(`[SyncQueue] Starting processing loop of ${queue.length} pending operations...`);
  
  let successCount = 0;
  const remainingQueue = [...queue];

  try {
    for (const op of queue) {
      // Verify connection is still alive before executing
      if (!force && typeof navigator !== 'undefined' && navigator.onLine === false) {
        console.warn('[SyncQueue] Went offline, pausing processing loop.');
        break;
      }

      try {
        const docRef = doc(db, op.docPath);
        
        if (op.type === 'set') {
          await setDoc(docRef, op.payload);
        } else if (op.type === 'delete') {
          await deleteDoc(docRef);
        }
        
        // Successfully processed! Remove from the active list
        successCount++;
        const index = remainingQueue.findIndex(item => item.id === op.id);
        if (index > -1) {
          remainingQueue.splice(index, 1);
        }
        
        // Update IndexedDB incrementally
        await idbSet(STORAGE_KEY, JSON.stringify(remainingQueue));
      } catch (error: any) {
        console.error(`[SyncQueue] Failed operation for path: ${op.docPath}`, error);

        // Analyze if it's a structural/auth permission failure or connection error
        const errStr = String(error).toLowerCase();
        const isConnectionError = 
          errStr.includes('offline') || 
          errStr.includes('network-error') || 
          errStr.includes('failed to fetch') ||
          errStr.includes('could not connect') ||
          errStr.includes('unavailable');

        const isPermissionError = 
          errStr.includes('permission') || 
          errStr.includes('insufficient') ||
          errStr.includes('unauthenticated');

        if (isConnectionError || isPermissionError) {
          // Transient connection/auth permission barrier. Halt processing loop immediately
          // to protect precious offline sales data from getting silent deleted/discarded.
          console.warn(`[SyncQueue] Connection/Auth barrier on item ${op.id}. Halting queue processing loop to protect local data.`);
          break;
        } else {
          // Relocate unrecognized structural format outliers to the end of the queue
          // to unblock normal transaction processing while strictly preserving user records
          console.warn(`[SyncQueue] Structural error on item ${op.id}. Deferring to end of queue.`);
          const index = remainingQueue.findIndex(item => item.id === op.id);
          if (index > -1) {
            const [itemToMove] = remainingQueue.splice(index, 1);
            if (itemToMove) {
              remainingQueue.push(itemToMove);
            }
          }
          await idbSet(STORAGE_KEY, JSON.stringify(remainingQueue));
          break;
        }
      }
    }
  } catch (err) {
    console.error("[SyncQueue] Unexpected error in processing loop:", err);
  } finally {
    isSyncing = false;
    await saveSyncQueue(remainingQueue);
  }
  
  console.log(`[SyncQueue] Safe processing phase finished. Synced ${successCount} mutations.`);
  return remainingQueue.length === 0;
}

// Auto triggers
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[SyncQueue] Net reconnection detected, launching background queue flush.');
    triggerBackgroundSync();
  });
}
