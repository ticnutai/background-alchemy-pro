/** Simple in-memory cache for processed image results to avoid re-processing */
const cache = new Map<string, string>();

/** FNV-1a 32-bit hash — much better distribution than djb2 */
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function makeKey(imageBase64: string, action: string, params: Record<string, unknown>): string {
  const paramsStr = JSON.stringify(params);
  // Sample 500 chars from start, middle and end for reliable fingerprint
  const len = imageBase64.length;
  const mid = Math.floor(len / 2);
  const sample = imageBase64.slice(0, 200)
    + imageBase64.slice(Math.max(0, mid - 100), mid + 100)
    + imageBase64.slice(Math.max(0, len - 200));
  const raw = `${sample}|${len}|${action}|${paramsStr}`;
  return `${action}_${fnv1a(raw)}`;
}

export function getCachedResult(
  imageBase64: string,
  action: string,
  params: Record<string, unknown>
): string | null {
  const key = makeKey(imageBase64, action, params);
  return cache.get(key) ?? null;
}

export function setCachedResult(
  imageBase64: string,
  action: string,
  params: Record<string, unknown>,
  resultBase64: string
): void {
  const key = makeKey(imageBase64, action, params);
  cache.set(key, resultBase64);
  // Limit cache size to 20 entries
  if (cache.size > 20) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
}

export function clearResultCache(): void {
  cache.clear();
}
