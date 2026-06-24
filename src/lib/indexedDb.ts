/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const DB_NAME = 'DzStoreIndexedDB';
const DB_VERSION = 1;
const STORE_NAME = 'keyval';

let dbInstance: IDBDatabase | null = null;

export function initIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

function getStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return initIndexedDB().then((db) => {
    const transaction = db.transaction(STORE_NAME, mode);
    return transaction.objectStore(STORE_NAME);
  });
}

export function idbGet(key: string): Promise<string | null> {
  return new Promise((resolve) => {
    getStore('readonly')
      .then((store) => {
        const req = store.get(key);
        req.onsuccess = () => {
          resolve((req.result as string) || null);
        };
        req.onerror = () => {
          console.warn(`IndexedDB get failed for key: ${key}`, req.error);
          resolve(null);
        };
      })
      .catch((err) => {
        console.warn(`IndexedDB getStore failed for key: ${key}`, err);
        resolve(null);
      });
  });
}

export function idbSet(key: string, value: string): Promise<void> {
  return new Promise((resolve, reject) => {
    getStore('readwrite')
      .then((store) => {
        const req = store.put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      })
      .catch((err) => reject(err));
  });
}

export function idbRemove(key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    getStore('readwrite')
      .then((store) => {
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      })
      .catch((err) => reject(err));
  });
}

export function idbClear(): Promise<void> {
  return new Promise((resolve, reject) => {
    getStore('readwrite')
      .then((store) => {
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      })
      .catch((err) => reject(err));
  });
}

export function idbGetAllEntries(): Promise<Record<string, string>> {
  return new Promise((resolve) => {
    const entries: Record<string, string> = {};
    getStore('readonly')
      .then((store) => {
        // Use standard cursor or getAll if supported, cursor is universally supported
        const request = store.openCursor();
        request.onsuccess = (event: any) => {
          const cursor = event.target.result;
          if (cursor) {
            entries[cursor.primaryKey as string] = cursor.value as string;
            cursor.continue();
          } else {
            resolve(entries);
          }
        };
        request.onerror = () => {
          console.warn("onsuccess cursor read failed");
          resolve(entries);
        };
      })
      .catch((err) => {
        console.warn("indexedDB getStore all entries failed:", err);
        resolve(entries);
      });
  });
}

/**
 * Migration helper to migrate keys from localStorage to IndexedDB once
 */
export async function migrateFromLocalStorage(): Promise<void> {
  try {
    await initIndexedDB();
    const keysToMigrate = Object.keys(localStorage);
    
    for (const key of keysToMigrate) {
      if (key.startsWith('dzstore_')) {
        const val = localStorage.getItem(key);
        if (val) {
          // Store in IndexedDB
          await idbSet(key, val);
          console.log(`[PWA Migration] Migrated key to IndexedDB: ${key}`);
        }
      }
    }
  } catch (error) {
    console.error('[PWA Migration] Failed during localStorage migration:', error);
  }
}
