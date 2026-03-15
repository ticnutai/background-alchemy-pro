/** Simple in-memory cache for processed image results to avoid re-processing */
const cache = new Map<string, string>();

function makeKey(imageBase64: string, action: string, params: Record<string, unknown>): string {
  // Use a short hash of the image + action + params as the cache key
  const paramsStr = JSON.stringify(params);
  const raw = `${imageBase64.slice(0, 100)}|${action}|${paramsStr}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }
  return `${action}_${hash}`;
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
