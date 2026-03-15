import { supabase } from "@/integrations/supabase/client";

/** Default timeout for AI operations (90 seconds) */
const AI_TIMEOUT_MS = 90_000;

/** Global AbortController for the current AI operation */
let _activeController: AbortController | null = null;

/** Abort any in-flight AI operation */
export function abortAiOperation() {
  if (_activeController) {
    _activeController.abort();
    _activeController = null;
  }
}

/** Check if an AI operation is currently running */
export function isAiRunning() {
  return _activeController !== null;
}

function withTimeout<T>(promise: Promise<T>, ms = AI_TIMEOUT_MS): Promise<T> {
  _activeController = new AbortController();
  const signal = _activeController.signal;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("הפעולה חרגה מזמן ההמתנה")), ms);
    const onAbort = () => { clearTimeout(timer); reject(new Error("הפעולה בוטלה")); };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (v) => { clearTimeout(timer); signal.removeEventListener("abort", onAbort); _activeController = null; resolve(v); },
      (e) => { clearTimeout(timer); signal.removeEventListener("abort", onAbort); _activeController = null; reject(e); },
    );
  });
}

// Cloudinary optimization and CDN delivery utility

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
  const { data, error } = await withTimeout(supabase.functions.invoke("cloudinary-optimize", {
    body: { imageUrl, operations },
  }));
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
}

// Replicate-based AI tools

export async function removeBgPrecise(imageBase64: string) {
  const { data, error } = await withTimeout(supabase.functions.invoke("remove-bg-precise", {
    body: { imageBase64 },
  }));
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as { resultImage: string; method: string };
}

export async function upscaleImage(imageBase64: string, scale: number = 4) {
  const { data, error } = await withTimeout(supabase.functions.invoke("upscale-image", {
    body: { imageBase64, scale },
  }), 180_000);
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as { resultImage: string; scale: number; method: string };
}

export async function relightImage(imageBase64: string, lightingPrompt?: string) {
  const { data, error } = await withTimeout(supabase.functions.invoke("relight-image", {
    body: { imageBase64, lightingPrompt },
  }));
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as { resultImage: string; method: string };
}

export async function inpaintRemove(imageBase64: string, maskBase64?: string, description?: string) {
  const { data, error } = await withTimeout(supabase.functions.invoke("inpaint-remove", {
    body: { imageBase64, maskBase64, description },
  }));
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as { resultImage: string; method: string };
}

export async function segmentProduct(imageBase64: string, pointPrompts?: string) {
  const { data, error } = await withTimeout(supabase.functions.invoke("segment-product", {
    body: { imageBase64, pointPrompts },
  }));
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as { detections: Record<string, unknown>; segmentation: Record<string, unknown>; method: string };
}

export async function generateBgSdxl(
  imageBase64: string,
  backgroundPrompt: string,
  negativePrompt?: string,
  strength?: number
) {
  const { data, error } = await withTimeout(supabase.functions.invoke("generate-bg-sdxl", {
    body: { imageBase64, backgroundPrompt, negativePrompt, strength },
  }));
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as { resultImage: string; method: string };
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
