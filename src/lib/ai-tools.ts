import { supabase } from "@/integrations/supabase/client";
import { getCachedResultAsync, setCachedResult } from "@/lib/result-cache";

// ─── Timeout & Abort ─────────────────────────────────────────
let _abortController: AbortController | null = null;

function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  ms = 90_000,
): Promise<T> {
  _abortController = new AbortController();
  const signal = _abortController.signal;
  const timeout = setTimeout(() => _abortController?.abort(), ms);
  return fn(signal).finally(() => {
    clearTimeout(timeout);
    _abortController = null;
  });
}

export function abortAiOperation(): void {
  _abortController?.abort();
}

export function isAiRunning(): boolean {
  return _abortController !== null;
}

// ─── Streaming fetch helper ──────────────────────────────────
/**
 * Invoke an edge function with streaming progress.
 * onProgress receives 0-100 based on bytes received vs Content-Length.
 */
async function invokeWithProgress(
  functionName: string,
  body: Record<string, unknown>,
  onProgress?: (percent: number) => void,
): Promise<Record<string, unknown>> {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const url = `https://${projectId}.supabase.co/functions/v1/${functionName}`;

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || anonKey;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
    },
    body: JSON.stringify(body),
    signal: _abortController?.signal,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Edge function error: ${errText}`);
  }

  // If streaming is supported, read with progress
  if (onProgress && res.body) {
    const contentLength = Number(res.headers.get("content-length") || 0);
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (contentLength > 0) {
        onProgress(Math.min(99, Math.round((received / contentLength) * 100)));
      } else {
        // Estimate progress without content-length
        onProgress(Math.min(90, Math.round(received / 10000)));
      }
    }

    const combined = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    onProgress(100);
    const text = new TextDecoder().decode(combined);
    return JSON.parse(text);
  }

  return res.json();
}

// ─── Cached AI operation wrapper ─────────────────────────────
async function cachedAiCall<T>(
  action: string,
  imageBase64: string,
  params: Record<string, unknown>,
  fn: () => Promise<T>,
): Promise<T> {
  // Check cache first
  const cached = await getCachedResultAsync(imageBase64, action, params);
  if (cached) {
    return { resultImage: cached, method: "cache" } as unknown as T;
  }

  const result = await fn();

  // Cache the result if it contains a resultImage
  const r = result as Record<string, unknown>;
  if (r.resultImage && typeof r.resultImage === "string") {
    setCachedResult(imageBase64, action, params, r.resultImage as string);
  }

  return result;
}

// ─── Cloudinary ──────────────────────────────────────────────

export interface CloudinaryOperations {
  optimize?: boolean;
  resize?: { width?: number; height?: number; crop?: string };
  social?: "instagram-post" | "instagram-story" | "facebook-post" | "pinterest" | "twitter" | "linkedin";
  watermark?: string;
  removeBackground?: boolean;
  enhance?: boolean;
  format?: "png" | "jpg" | "webp" | "avif";
}

export async function cloudinaryOptimize(imageUrl: string, operations: CloudinaryOperations) {
  return withTimeout(async () => {
    return cachedAiCall("cloudinary", imageUrl, operations as Record<string, unknown>, async () => {
      const { data, error } = await supabase.functions.invoke("cloudinary-optimize", {
        body: { imageUrl, operations },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as {
        originalUrl: string;
        optimizedUrl: string;
        publicId: string;
        width: number;
        height: number;
        format: string;
        bytes: number;
      };
    });
  });
}

// ─── AI tools with caching + streaming ───────────────────────

export async function removeBgPrecise(imageBase64: string, onProgress?: (p: number) => void) {
  return withTimeout(async () => {
    return cachedAiCall("remove-bg", imageBase64, {}, async () => {
      if (onProgress) {
        const data = await invokeWithProgress("remove-bg-precise", { imageBase64 }, onProgress);
        if (data.error) throw new Error(data.error as string);
        return data as { resultImage: string; method: string };
      }
      const { data, error } = await supabase.functions.invoke("remove-bg-precise", {
        body: { imageBase64 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { resultImage: string; method: string };
    });
  });
}

export async function upscaleImage(imageBase64: string, scale: number = 4, onProgress?: (p: number) => void) {
  return withTimeout(async () => {
    return cachedAiCall("upscale", imageBase64, { scale }, async () => {
      if (onProgress) {
        const data = await invokeWithProgress("upscale-image", { imageBase64, scale }, onProgress);
        if (data.error) throw new Error(data.error as string);
        return data as { resultImage: string; scale: number; method: string };
      }
      const { data, error } = await supabase.functions.invoke("upscale-image", {
        body: { imageBase64, scale },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { resultImage: string; scale: number; method: string };
    });
  }, 180_000);
}

export async function relightImage(imageBase64: string, lightingPrompt?: string, onProgress?: (p: number) => void) {
  return withTimeout(async () => {
    return cachedAiCall("relight", imageBase64, { lightingPrompt: lightingPrompt || "" }, async () => {
      if (onProgress) {
        const data = await invokeWithProgress("relight-image", { imageBase64, lightingPrompt }, onProgress);
        if (data.error) throw new Error(data.error as string);
        return data as { resultImage: string; method: string };
      }
      const { data, error } = await supabase.functions.invoke("relight-image", {
        body: { imageBase64, lightingPrompt },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { resultImage: string; method: string };
    });
  });
}

export async function inpaintRemove(imageBase64: string, maskBase64?: string, description?: string) {
  return withTimeout(async () => {
    return cachedAiCall("inpaint", imageBase64, { maskBase64: maskBase64 || "", description: description || "" }, async () => {
      const { data, error } = await supabase.functions.invoke("inpaint-remove", {
        body: { imageBase64, maskBase64, description },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { resultImage: string; method: string };
    });
  });
}

export async function segmentProduct(imageBase64: string, pointPrompts?: string) {
  return withTimeout(async () => {
    const { data, error } = await supabase.functions.invoke("segment-product", {
      body: { imageBase64, pointPrompts },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data as { detections: Record<string, unknown>; segmentation: Record<string, unknown>; method: string };
  });
}

export async function generateBgSdxl(
  imageBase64: string,
  backgroundPrompt: string,
  negativePrompt?: string,
  strength?: number,
  onProgress?: (p: number) => void,
) {
  return withTimeout(async () => {
    return cachedAiCall("generate-bg", imageBase64, { backgroundPrompt, negativePrompt: negativePrompt || "", strength: strength || 0.75 }, async () => {
      if (onProgress) {
        const data = await invokeWithProgress("generate-bg-sdxl", { imageBase64, backgroundPrompt, negativePrompt, strength }, onProgress);
        if (data.error) throw new Error(data.error as string);
        return data as { resultImage: string; method: string };
      }
      const { data, error } = await supabase.functions.invoke("generate-bg-sdxl", {
        body: { imageBase64, backgroundPrompt, negativePrompt, strength },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { resultImage: string; method: string };
    });
  });
}

// Lighting presets for IC-Light
export const lightingPresets = [
  { id: "studio-soft", label: "תאורת סטודיו רכה", prompt: "Soft diffused studio lighting from above, even lighting, product photography" },
  { id: "studio-dramatic", label: "תאורה דרמטית", prompt: "Dramatic side lighting with strong shadows, moody product photography" },
  { id: "golden-hour", label: "שעת הזהב", prompt: "Warm golden hour sunlight, natural window light, golden tones" },
  { id: "cool-daylight", label: "אור יום קריר", prompt: "Cool natural daylight, blue tones, clean bright lighting" },
  { id: "warm-ambient", label: "תאורה חמה", prompt: "Warm ambient indoor lighting, cozy atmosphere, subtle shadows" },
  { id: "backlit", label: "תאורה אחורית", prompt: "Backlit product with rim light, glowing edges, professional backlighting" },
  { id: "neon", label: "ניאון", prompt: "Colorful neon lighting, purple and blue neon glow, modern vibrant" },
  { id: "spotlight", label: "ספוטלייט", prompt: "Single spotlight from above, dark background, focused product spotlight" },
];

// Upscale options
export const upscaleOptions = [
  { scale: 2, label: "×2", desc: "הכפלה" },
  { scale: 4, label: "×4", desc: "פי 4 (מומלץ)" },
];
