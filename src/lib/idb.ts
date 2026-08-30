/**
 * Tiny IndexedDB key/value cache used for offline map data (prompt 43).
 * Falls back to localStorage where IndexedDB is unavailable (private mode, etc).
 */

const DB_NAME = 'night-shield';
const STORE = 'cache';
const VERSION = 1;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    try {
      const request = indexedDB.open(DB_NAME, VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

interface CacheEnvelope<T> {
  cachedAt: string;
  value: T;
}

export async function cacheSet<T>(key: string, value: T): Promise<void> {
  const envelope: CacheEnvelope<T> = { cachedAt: new Date().toISOString(), value };
  const db = await openDb();
  if (!db) {
    try {
      localStorage.setItem(`ns.cache.${key}`, JSON.stringify(envelope));
    } catch {
      /* quota or disabled storage — caching is best-effort */
    }
    return;
  }
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(envelope, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
}

export async function cacheGet<T>(key: string): Promise<CacheEnvelope<T> | null> {
  const db = await openDb();
  if (!db) {
    try {
      const raw = localStorage.getItem(`ns.cache.${key}`);
      return raw ? (JSON.parse(raw) as CacheEnvelope<T>) : null;
    } catch {
      return null;
    }
  }
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(key);
    request.onsuccess = () => resolve((request.result as CacheEnvelope<T>) ?? null);
    request.onerror = () => resolve(null);
  });
}

/**
 * Run `loader`, caching a successful result. If it throws (offline, server down)
 * fall back to the last cached copy and report when it was taken.
 */
export async function withCache<T>(
  key: string,
  loader: () => Promise<T>,
): Promise<{ value: T; stale: boolean; cachedAt: string | null }> {
  try {
    const value = await loader();
    void cacheSet(key, value);
    return { value, stale: false, cachedAt: null };
  } catch (error) {
    const cached = await cacheGet<T>(key);
    if (cached) return { value: cached.value, stale: true, cachedAt: cached.cachedAt };
    throw error;
  }
}
