
import { db } from './firebase';
import { collection, onSnapshot, doc, setDoc, getDocs, getDoc } from 'firebase/firestore';
import { DzStoreDB } from './db';
import { handleFirestoreError, OperationType, processSyncQueue, getSyncQueue } from './syncQueue';

/**
 * Safely merges Firestore items into DzStoreDB local memory and IndexedDB cache,
 * ensuring that any locally modified/unsynced entries in the sync queue are shielded
 * from remote overwrites (Last-Write-Wins and Conflict-Resolution).
 */
export async function mergeServerCollectionData(
  shopId: string,
  collName: string,
  serverItems: any[]
): Promise<void> {
  const storageKey = `dzstore_shop_${shopId}_${collName}`;
  const localData = DzStoreDB.getItem(storageKey);
  const serverJSON = JSON.stringify(serverItems);

  if (localData === serverJSON) {
    // If they match perfectly, we update confirmation tags and skip merging process to save CPU cycles
    DzStoreDB.setItem(`dzstore_synced_${shopId}_${collName}`, 'true');
    DzStoreDB.setItem(`dzstore_last_sync_ts_${shopId}_${collName}`, new Date().toISOString());
    return;
  }

  let finalJSON = serverJSON;

  if (localData) {
    try {
      const localItemsRaw = JSON.parse(localData);
      const localItems = Array.isArray(localItemsRaw) ? localItemsRaw.filter(x => x && typeof x === 'object' && x.id) : [];
      const localMap = new Map<string, any>(localItems.map((x: any) => [x.id, x]));

      // Load real-time pending changes queue to shield newly mutated, unsynced local data elements from overwrites
      const pendingSetIds = new Set<string>();
      try {
        const queue = await getSyncQueue();
        if (Array.isArray(queue)) {
          queue.forEach((op: any) => {
            if (op.type === 'set' && op.docPath) {
              const parts = op.docPath.split('/');
              const id = parts[parts.length - 1];
              if (id) {
                pendingSetIds.add(id);
              }
            }
          });
        }
      } catch (e) {
        console.error("[Sync] Failed to read sync queue for active conflict resolution:", e);
      }

      // Merge server modifications (Advanced Last-Write-Wins timestamp comparative logic)
      const cleanServerItems = (serverItems || []).filter(x => x && typeof x === 'object' && x.id);
      for (const sItem of cleanServerItems) {
        // CRITICAL: Protect local items that are currently in the queue being uploaded! No server overwrite!
        if (pendingSetIds.has(sItem.id)) {
          console.info(`[Conflict Resolution] Shielding pending-sync item "${sItem.id}" in "${collName}" from server overwrite.`);
          continue;
        }

        const lItem = localMap.get(sItem.id);
        if (!lItem) {
          // Not in local cache, adopt server version
          localMap.set(sItem.id, sItem);
        } else {
          const sTime = sItem.updatedAt || sItem.date || sItem.dateAdded || sItem.createdAt || '';
          const lTime = lItem.updatedAt || lItem.date || lItem.dateAdded || lItem.createdAt || '';
          
          // If remote is newer, adopt remote. Otherwise retain local.
          if (sTime > lTime) {
            localMap.set(sItem.id, sItem);
          } else if (sTime === lTime && JSON.stringify(sItem) !== JSON.stringify(lItem)) {
            // If timestamps match exactly but contents differ (e.g. concurrent edits), merge fields but prefer local edits
            localMap.set(sItem.id, { ...sItem, ...lItem });
          }
        }
      }

      // Sync server deletions (Delete vs Update Conflict Resolution)
      const serverIds = new Set(cleanServerItems.map((x: any) => x.id));
      const lastSyncKey = `dzstore_last_sync_ts_${shopId}_${collName}`;
      const lastSyncTimeStr = DzStoreDB.getItem(lastSyncKey) || '';

      // Guard against deleting local items that are pending sync, or belong to append-only collections
      const isAppendOnly = ['sales', 'expenses', 'audit_logs', 'assessments', 'bookings'].includes(collName);

      for (const lId of localMap.keys()) {
        if (!serverIds.has(lId)) {
          // If it's pending in sync queue, preserve it from deletion
          if (pendingSetIds.has(lId)) {
            console.info(`[Conflict Resolution] Preserved pending-sync item "${lId}" in "${collName}"`);
            continue;
          }

          // If it belongs to an append-only transaction collection, preserve it from deletion
          if (isAppendOnly) {
            continue;
          }

          // If last sync timestamp is empty, do NOT delete local items as this is an uninitialized/fresh state
          if (!lastSyncTimeStr) {
            continue;
          }

          // Item was deleted on the server. If local has been edited *after* the last known sync timestamp,
          // we reject the server's delete command and retain the item so it can sync back up.
          const lItem = localMap.get(lId);
          const lTime = lItem.updatedAt || lItem.date || lItem.dateAdded || lItem.createdAt || '';
          
          if (lTime && lastSyncTimeStr && lTime > lastSyncTimeStr) {
            console.info(`[Conflict Resolution] Preserved modified item "${lId}" over server deletion (Local: ${lTime} > Sync: ${lastSyncTimeStr})`);
          } else {
            localMap.delete(lId);
          }
        }
      }

      finalJSON = JSON.stringify(Array.from(localMap.values()));
    } catch (e) {
      console.error("Conflict merging failed, choosing server-first fallback:", e);
    }
  }

  DzStoreDB.setItem(storageKey, finalJSON);
  DzStoreDB.setItem(`dzstore_synced_${shopId}_${collName}`, 'true');
  DzStoreDB.setItem(`dzstore_last_sync_ts_${shopId}_${collName}`, new Date().toISOString());
}

export function setupRealtimeSync(
  shopId: string,
  onSyncTriggered: () => void
): () => void {
  const unsubscribers: (() => void)[] = [];

  const syncCollection = (
    collName: string,
    storageKey: string
  ) => {
    const q = collection(db, 'shops', shopId, collName);
    const unsub = onSnapshot(q, async (snapshot) => {
      const serverItems: any[] = [];
      snapshot.forEach((docSnap) => {
        serverItems.push({ ...docSnap.data() });
      });

      const localData = DzStoreDB.getItem(storageKey);

      if (snapshot.empty) {
        const everSynced = DzStoreDB.getItem(`dzstore_synced_${shopId}_${collName}`);
        if (!everSynced) {
          // Auto-seed to remote Firestore if empty on first boot
          if (localData) {
            try {
              const localItems = JSON.parse(localData);
              if (localItems && localItems.length > 0) {
                console.log(`Auto-seeding empty Firestore collection "${collName}" with local items.`);
                localItems.forEach((item: any) => {
                  const docRef = doc(db, 'shops', shopId, collName, item.id);
                  setDoc(docRef, item).catch(err => {
                    console.warn("Auto-seed failed:", err);
                    try {
                      handleFirestoreError(err, OperationType.WRITE, `shops/${shopId}/${collName}/${item.id}`);
                    } catch {}
                  });
                });
                DzStoreDB.setItem(`dzstore_synced_${shopId}_${collName}`, 'true');
              }
            } catch (e) {
              console.error("Failed to seed to Firestore:", e);
            }
          }
          return;
        }
      }

      await mergeServerCollectionData(shopId, collName, serverItems);
      onSyncTriggered();
    }, (error) => {
      console.warn(`Firestore sync subscription failed for ${collName}:`, error);
      try {
        handleFirestoreError(error, OperationType.LIST, `shops/${shopId}/${collName}`);
      } catch {}
    });
    unsubscribers.push(unsub);
  };

  // Sync shop settings document with Last-Write-Wins (LWW) Conflict Resolution
  const syncSettings = () => {
    const docRef = doc(db, 'shops', shopId, 'settings', 'current');
    const unsub = onSnapshot(docRef, (docSnap) => {
      const storageKey = `dzstore_shop_${shopId}_settings`;
      const localData = DzStoreDB.getItem(storageKey);

      if (docSnap.exists()) {
        const sItem = docSnap.data();
        const serverJSON = JSON.stringify(sItem);

        if (localData !== serverJSON) {
          if (localData) {
            try {
              const lItem = JSON.parse(localData);
              const sTime = sItem.updatedAt || '';
              const lTime = lItem.updatedAt || '';

              if (sTime >= lTime) {
                DzStoreDB.setItem(storageKey, serverJSON);
                onSyncTriggered();
              } else {
                console.info(`[Conflict Resolution] Rejected server settings update (Local: ${lTime} is newer than Server: ${sTime})`);
              }
            } catch {
              DzStoreDB.setItem(storageKey, serverJSON);
              onSyncTriggered();
            }
          } else {
            DzStoreDB.setItem(storageKey, serverJSON);
            onSyncTriggered();
          }
        }
      } else {
        // Auto-seed settings if absent on Firestore
        if (localData) {
          try {
            setDoc(doc(db, 'shops', shopId, 'settings', 'current'), JSON.parse(localData))
              .catch(e => {
                console.warn("Auto-seed settings failed:", e);
                try {
                  handleFirestoreError(e, OperationType.WRITE, `shops/${shopId}/settings/current`);
                } catch {}
              });
          } catch (e) {
            console.error("Auto-seed settings error:", e);
          }
        }
      }
    }, (error) => {
      console.warn("Firestore settings sync subscription failed:", error);
      try {
        handleFirestoreError(error, OperationType.GET, `shops/${shopId}/settings/current`);
      } catch {}
    });
    unsubscribers.push(unsub);
  };

  // Subscriptions
  syncCollection('products', `dzstore_shop_${shopId}_products`);
  syncCollection('spare_parts', `dzstore_shop_${shopId}_spare_parts`);
  syncCollection('suppliers', `dzstore_shop_${shopId}_suppliers`);
  syncCollection('customers', `dzstore_shop_${shopId}_customers`);
  syncCollection('maintenance', `dzstore_shop_${shopId}_maintenance`);
  syncCollection('sales', `dzstore_shop_${shopId}_sales`);
  syncCollection('used_phones', `dzstore_shop_${shopId}_used_phones`);
  syncCollection('messages', `dzstore_shop_${shopId}_messages`);
  syncCollection('audit_logs', `dzstore_shop_${shopId}_audit_logs`);
  syncCollection('expenses', `dzstore_shop_${shopId}_expenses`);
  syncCollection('bookings', `dzstore_shop_${shopId}_bookings`);
  syncCollection('audits', `dzstore_shop_${shopId}_audits`);
  syncCollection('assessments', `dzstore_shop_${shopId}_assessments`);
  syncSettings();

  return () => {
    unsubscribers.forEach(unsub => unsub());
  };
}

export function setupGlobalSaaSSync(onSyncTriggered: () => void): () => void {
  const unsubscribers: (() => void)[] = [];

  const syncGlobalCollection = (collName: string, storageKey: string) => {
    const unsub = onSnapshot(collection(db, collName), (snapshot) => {
      const serverItems: any[] = [];
      snapshot.forEach(docSnap => {
        serverItems.push({ ...docSnap.data() });
      });

      const localData = DzStoreDB.getItem(storageKey);
      const serverJSON = JSON.stringify(serverItems);

      if (snapshot.empty) {
        const everSynced = DzStoreDB.getItem(`dzstore_synced_global_${collName}`);
        if (!everSynced) {
          if (localData) {
            try {
              const localItems = JSON.parse(localData);
              if (localItems && localItems.length > 0) {
                localItems.forEach((item: any) => {
                  setDoc(doc(db, collName, item.id), item).catch(err => console.warn(err));
                });
                DzStoreDB.setItem(`dzstore_synced_global_${collName}`, 'true');
              }
            } catch (e) {
              console.error(e);
            }
          }
          return;
        }
      }

      DzStoreDB.setItem(`dzstore_synced_global_${collName}`, 'true');

      if (localData !== serverJSON) {
        let finalJSON = serverJSON;

        if (localData) {
          try {
            const localItems = JSON.parse(localData);
            const localMap = new Map<string, any>(localItems.map((x: any) => [x.id, x]));
            let hasMergeChanges = false;

            for (const sItem of serverItems) {
              const lItem = localMap.get(sItem.id);
              if (!lItem) {
                localMap.set(sItem.id, sItem);
                hasMergeChanges = true;
              } else {
                const sTime = sItem.updatedAt || sItem.date || sItem.createdAt || '';
                const lTime = lItem.updatedAt || lItem.date || lItem.createdAt || '';
                if (sTime > lTime || (sTime === lTime && JSON.stringify(sItem) !== JSON.stringify(lItem))) {
                  localMap.set(sItem.id, sItem);
                  hasMergeChanges = true;
                }
              }
            }

            const serverIds = new Set(serverItems.map((x: any) => x.id));
            for (const lId of localMap.keys()) {
              if (!serverIds.has(lId)) {
                localMap.delete(lId);
                hasMergeChanges = true;
              }
            }

            finalJSON = JSON.stringify(Array.from(localMap.values()));
          } catch {}
        }

        DzStoreDB.setItem(storageKey, finalJSON);
        onSyncTriggered();
      }
    }, (error) => {
      console.warn(`Firestore global sync subscription failed for ${collName}:`, error);
      try {
        handleFirestoreError(error, OperationType.LIST, collName);
      } catch {}
    });
    unsubscribers.push(unsub);
  };

  syncGlobalCollection('users', 'dzstore_saas_users');
  syncGlobalCollection('shops', 'dzstore_saas_shops');
  syncGlobalCollection('broadcasts', 'dzstore_broadcasts');

  return () => {
    unsubscribers.forEach(unsub => unsub());
  };
}

export async function forceManualSync(shopId: string, onSyncTriggered: () => void): Promise<void> {
  console.log('[ManualSync] Starting manual forced pull & push sync...');
  
  // 1. First trigger push of any pending offline queue items with force parameter bypass
  try {
    await processSyncQueue(true);
  } catch (err) {
    console.error('[ManualSync] Pending queue sync error:', err);
  }

  // 2. Fetch the latest from each tenant/shop collection on demand and merge safely or seed to remote Firestore
  const tenantCollections = [
    'products', 'spare_parts', 'suppliers', 'customers', 'maintenance', 
    'sales', 'used_phones', 'messages', 'audit_logs', 'expenses', 
    'bookings', 'audits', 'assessments'
  ];
  for (const collName of tenantCollections) {
    try {
      const q = collection(db, 'shops', shopId, collName);
      const snapshot = await getDocs(q);
      const serverItems: any[] = [];
      snapshot.forEach((docSnap) => {
        serverItems.push({ ...docSnap.data() });
      });

      await mergeServerCollectionData(shopId, collName, serverItems);
    } catch (err) {
      console.error(`[ManualSync] Failed to manually fetch collection ${collName}:`, err);
    }
  }

  // 3. Keep settings in sync
  try {
    const settingsDocRef = doc(db, 'shops', shopId, 'settings', 'current');
    const docSnap = await getDoc(settingsDocRef);
    if (docSnap.exists()) {
      const serverSettings = docSnap.data();
      const storageKey = `dzstore_shop_${shopId}_settings`;
      DzStoreDB.setItem(storageKey, JSON.stringify(serverSettings));
    }
  } catch (err) {
    console.error(`[ManualSync] Failed to manually fetch settings:`, err);
  }

  // 4. Global collections
  const globalCollections = [
    { name: 'users', key: 'dzstore_saas_users' },
    { name: 'shops', key: 'dzstore_saas_shops' },
    { name: 'broadcasts', key: 'dzstore_broadcasts' }
  ];

  for (const item of globalCollections) {
    try {
      const q = collection(db, item.name);
      const snapshot = await getDocs(q);
      const serverItems: any[] = [];
      snapshot.forEach((docSnap) => {
        serverItems.push({ ...docSnap.data() });
      });
      DzStoreDB.setItem(item.key, JSON.stringify(serverItems));
    } catch (err) {
      console.error(`[ManualSync] Failed to manually fetch global collection ${item.name}:`, err);
    }
  }

  // 5. Force UI refresh
  onSyncTriggered();
  console.log('[ManualSync] Manual sync completed successfully!');
}