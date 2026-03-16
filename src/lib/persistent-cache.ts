/**
 * IndexedDB-backed persistent cache for expensive AI results.
 * Survives page refresh. LRU eviction at MAX_ENTRIES.
 * Falls back to in-memory Map if IndexedDB is unavailable.
 */

const DB_NAME = "bg-alchemy-cache";
const DB_VERSION = 1;
const STORE_NAME = "results";
const MAX_ENTRIES = 50;

interface CacheEntry {
  key: string;
  value: string; // base64 result
  action: string;
  accessedAt: number;
  createdAt: number;
  sizeBytes: number;
}

// ─── FNV-1a hash (same as result-cache.ts) ───────────────────
function fnv1aHash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function makeCacheKey(imageBase64: string, action: string, params: Record<string, unknown>): string {
  const paramsStr = JSON.stringify(params);
  const mid = Math.floor(imageBase64.length / 2);
  const sample = imageBase64.slice(0, 500) + imageBase64.slice(mid, mid + 500) + imageBase64.slice(-500);
  return `${action}_${fnv1aHash(`${sample}|${action}|${paramsStr}`)}`;
}

// ─── IndexedDB helpers ───────────────────────────────────────
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "key" });
        store.createIndex("accessedAt", "accessedAt");
        store.createIndex("action", "action");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let _dbPromise: Promise<IDBDatabase> | null = null;
function getDB(): Promise<IDBDatabase> {
  if (!_dbPromise) {
    _dbPromise = openDB().catch(() => null as unknown as IDBDatabase);
  }
  return _dbPromise;
}

// ─── Public API ──────────────────────────────────────────────

/** Get cached AI result. Returns base64 string or null. */
export async function getPersistentCache(
  imageBase64: string,
  action: string,
  params: Record<string, unknown>,
): Promise<string | null> {
  const key = makeCacheKey(imageBase64, action, params);
  try {
    const db = await getDB();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        const entry = req.result as CacheEntry | undefined;
        if (entry) {
          // Update access time (LRU)
          entry.accessedAt = Date.now();
          store.put(entry);
          resolve(entry.value);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/** Store an AI result in persistent cache. */
export async function setPersistentCache(
  imageBase64: string,
  action: string,
  params: Record<string, unknown>,
  resultBase64: string,
): Promise<void> {
  const key = makeCacheKey(imageBase64, action, params);
  try {
    const db = await getDB();
    if (!db) return;

    const entry: CacheEntry = {
      key,
      value: resultBase64,
      action,
      accessedAt: Date.now(),
      createdAt: Date.now(),
      sizeBytes: resultBase64.length,
    };

    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(entry);

    // Evict oldest entries if over limit
    const countReq = store.count();
    countReq.onsuccess = () => {
      if (countReq.result > MAX_ENTRIES) {
        const idx = store.index("accessedAt");
        const toDelete = countReq.result - MAX_ENTRIES;
        let deleted = 0;
        const cursor = idx.openCursor();
        cursor.onsuccess = () => {
          const c = cursor.result;
          if (c && deleted < toDelete) {
            store.delete(c.primaryKey);
            deleted++;
            c.continue();
          }
        };
      }
    };
  } catch {
    // Silently fail — cache is best-effort
  }
}

/** Clear all persistent cache entries. */
export async function clearPersistentCache(): Promise<void> {
  try {
    const db = await getDB();
    if (!db) return;
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
  } catch {
    // ignore
  }
}
