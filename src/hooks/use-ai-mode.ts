import { useCallback, useEffect, useState } from "react";

const AI_MODE_STORAGE_KEY = "ai-enabled";

export function useAiMode(defaultValue = true) {
  const [aiEnabled, setAiEnabled] = useState<boolean>(defaultValue);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(AI_MODE_STORAGE_KEY);
      if (raw === null) return;
      setAiEnabled(raw === "1");
    } catch {
      // Ignore storage read failures and keep runtime state.
    }
  }, []);

  const setAiMode = useCallback((enabled: boolean) => {
    setAiEnabled(enabled);
    try {
      localStorage.setItem(AI_MODE_STORAGE_KEY, enabled ? "1" : "0");
    } catch {
      // Ignore storage write failures and keep runtime state.
    }
  }, []);

  return { aiEnabled, setAiMode };
}
