/**
 * Debounced callback hook with cancellation support.
 * Used for slider → worker dispatch to avoid flooding.
 */
import { useRef, useCallback, useEffect } from "react";

export function useDebouncedCallback<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number,
): [T, () => void] {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cbRef = useRef(callback);
  cbRef.current = callback;

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const debounced = useCallback(
    (...args: unknown[]) => {
      cancel();
      timerRef.current = setTimeout(() => {
        cbRef.current(...args);
      }, delay);
    },
    [delay, cancel],
  ) as unknown as T;

  useEffect(() => cancel, [cancel]);

  return [debounced, cancel];
}
