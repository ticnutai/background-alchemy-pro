/** Simple in-memory cache for processed image results to avoid re-processing */
const cache = new Map<string, string>();

function fnv1aHash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function makeKey(imageBase64: string, action: string, params: Record<string, unknown>): string {
  const paramsStr = JSON.stringify(params);
  const mid = Math.floor(imageBase64.length / 2);
  const sample = imageBase64.slice(0, 500) + imageBase64.slice(mid, mid + 500) + imageBase64.slice(-500);
  const raw = `${sample}|${action}|${paramsStr}`;
  return `${action}_${fnv1aHash(raw)}`;
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
