type TelemetryEvent = {
  type: "web-vital" | "error" | "unhandledrejection";
  name: string;
  value?: number;
  rating?: "good" | "needs-improvement" | "poor";
  detail?: string;
  timestamp: number;
  path: string;
};

const endpoint = import.meta.env.VITE_TELEMETRY_ENDPOINT as string | undefined;

function sendEvent(event: TelemetryEvent) {
  if (endpoint) {
    const payload = JSON.stringify(event);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, payload);
      return;
    }
    void fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    });
    return;
  }

  // Fallback for local/dev environments.
  if (import.meta.env.DEV) {
    console.info("[telemetry]", event);
  }
}

function ratingFor(name: string, value: number): "good" | "needs-improvement" | "poor" {
  const thresholds: Record<string, [number, number]> = {
    LCP: [2500, 4000],
    INP: [200, 500],
    CLS: [0.1, 0.25],
    FCP: [1800, 3000],
    TTFB: [800, 1800],
  };
  const [good, poor] = thresholds[name] || [1000, 2500];
  if (value <= good) return "good";
  if (value <= poor) return "needs-improvement";
  return "poor";
}

function emitVital(name: string, value: number) {
  sendEvent({
    type: "web-vital",
    name,
    value,
    rating: ratingFor(name, value),
    timestamp: Date.now(),
    path: window.location.pathname,
  });
}

export function initTelemetry() {
  window.addEventListener("error", (ev) => {
    sendEvent({
      type: "error",
      name: ev.error?.name || "Error",
      detail: ev.error?.message || ev.message,
      timestamp: Date.now(),
      path: window.location.pathname,
    });
  });

  window.addEventListener("unhandledrejection", (ev) => {
    const reason = ev.reason as Error | string | undefined;
    sendEvent({
      type: "unhandledrejection",
      name: "UnhandledPromiseRejection",
      detail: typeof reason === "string" ? reason : reason?.message || "Unknown rejection",
      timestamp: Date.now(),
      path: window.location.pathname,
    });
  });

  const po = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === "largest-contentful-paint") {
        emitVital("LCP", entry.startTime);
      }
      if (entry.entryType === "first-contentful-paint") {
        emitVital("FCP", entry.startTime);
      }
      if (entry.entryType === "event" && (entry as PerformanceEventTiming).name === "click") {
        emitVital("INP", (entry as PerformanceEventTiming).duration);
      }
    }
  });

  try {
    po.observe({ type: "largest-contentful-paint", buffered: true });
    po.observe({ type: "first-contentful-paint", buffered: true });
    po.observe({ type: "event", durationThreshold: 40, buffered: true });
  } catch {
    // Browser does not support one of the observers.
  }

  let clsValue = 0;
  const clsObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as LayoutShift[]) {
      if (!entry.hadRecentInput) clsValue += entry.value;
    }
  });

  try {
    clsObserver.observe({ type: "layout-shift", buffered: true });
  } catch {
    // Ignore unsupported browsers.
  }

  const navEntries = performance.getEntriesByType("navigation");
  const nav = navEntries[0] as PerformanceNavigationTiming | undefined;
  if (nav) {
    emitVital("TTFB", nav.responseStart);
  }

  window.addEventListener("beforeunload", () => {
    emitVital("CLS", clsValue);
  });
}
