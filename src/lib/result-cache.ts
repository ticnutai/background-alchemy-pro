/**
 * Two-tier cache: fast in-memory LRU + persistent IndexedDB for AI results.
 * In-memory = instant for slider-driven filter results.
 * IndexedDB = survives refresh for expensive AI operations.
 */
import { getPersistentCache, setPersistentCache, clearPersistentCache, makeCacheKey } from "./persistent-cache";

// ─── In-memory LRU ───────────────────────────────────────────
const MAX_MEMORY = 30;
const memoryCache = new Map<string, string>();

function touchMemory(key: string, value: string): void {
  // Move to end (most recently used)
  memoryCache.delete(key);
  memoryCache.set(key, value);
  // Evict oldest
  if (memoryCache.size > MAX_MEMORY) {
    const firstKey = memoryCache.keys().next().value;
    if (firstKey) memoryCache.delete(firstKey);
  }
}

// AI actions that are expensive and worth persisting
const PERSIST_ACTIONS = new Set([
  "remove-bg", "replace-bg", "upscale", "relight", "inpaint",
  "segment", "generate-bg", "cloudinary",
]);

// ─── Public API (drop-in replacement) ────────────────────────

export function getCachedResult(
  imageBase64: string,
  action: string,
  params: Record<string, unknown>,
): string | null {
  const key = makeCacheKey(imageBase64, action, params);
  return memoryCache.get(key) ?? null;
}

/**
 * Async version that also checks IndexedDB for AI results.
 * Use this for AI operations; use getCachedResult for local filters.
 */
export async function getCachedResultAsync(
  imageBase64: string,
  action: string,
  params: Record<string, unknown>,
): Promise<string | null> {
  const key = makeCacheKey(imageBase64, action, params);
  // Memory first
  const mem = memoryCache.get(key);
  if (mem) {
    touchMemory(key, mem);
    return mem;
  }
  // IndexedDB for AI actions
  if (PERSIST_ACTIONS.has(action)) {
    const persisted = await getPersistentCache(imageBase64, action, params);
    if (persisted) {
      touchMemory(key, persisted); // Promote to memory
      return persisted;
    }
  }
  return null;
}

export function setCachedResult(
  imageBase64: string,
  action: string,
  params: Record<string, unknown>,
  resultBase64: string,
): void {
  const key = makeCacheKey(imageBase64, action, params);
  touchMemory(key, resultBase64);

  // Persist AI results to IndexedDB (fire and forget)
  if (PERSIST_ACTIONS.has(action)) {
    setPersistentCache(imageBase64, action, params, resultBase64).catch(() => {});
  }
}

export function clearResultCache(): void {
  memoryCache.clear();
  clearPersistentCache().catch(() => {});
}
