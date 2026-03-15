/**
 * Catalog AI Tools — AI-powered features for the catalog system.
 * Uses existing Supabase Edge Functions for all AI operations.
 */

import { supabase } from "@/integrations/supabase/client";
import type { CatalogProduct, CatalogSettings } from "./catalog-engine";

// ─── Types ───────────────────────────────────────────────────
export interface AIAnalysisResult {
  productType: string;
  material: string;
  colors: { hex: string; name: string }[];
  style: string;
  suggestedDescription: string;
  suggestedName: string;
  suggestedPrice?: string;
}

export interface AIBatchProgress {
  current: number;
  total: number;
  productId: string;
  status: "processing" | "done" | "error";
}

// ─── Helpers ─────────────────────────────────────────────────

function imageToBase64(imageStr: string): string {
  // Already base64 with prefix — strip prefix for API
  if (imageStr.startsWith("data:")) {
    return imageStr.split(",")[1];
  }
  return imageStr;
}

// ─── AI: Analyze Product Image ───────────────────────────────
export async function aiAnalyzeProduct(image: string): Promise<AIAnalysisResult> {
  const base64 = imageToBase64(image);

  // Use the analyze-image edge function
  const { data, error } = await supabase.functions.invoke("analyze-image", {
    body: { imageBase64: base64 },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  // Also get a smart-suggest for richer analysis
  const { data: suggestData } = await supabase.functions.invoke("smart-suggest", {
    body: { imageBase64: base64 },
  });

  const colors = (data.colors || []).map((c: { hex: string; name: string }) => ({
    hex: c.hex,
    name: c.name,
  }));

  return {
    productType: suggestData?.product?.type || "מוצר",
    material: suggestData?.product?.material || "",
    colors,
    style: suggestData?.product?.style || data.style || "",
    suggestedDescription: data.elements?.join(", ") || "",
    suggestedName: suggestData?.product?.type || "",
  };
}

// ─── AI: Generate Product Description ────────────────────────
export async function aiGenerateDescription(
  product: CatalogProduct,
  _catalogTitle: string,
): Promise<string> {
  const base64 = imageToBase64(product.image);

  const messages = [
    {
      role: "user",
      content: `אתה כותב תיאורי מוצרים מקצועיים לקטלוגים. 
צור תיאור קצר ומקצועי (2-3 משפטים בעברית) עבור המוצר הזה.
שם המוצר: ${product.name}
${product.price ? `מחיר: ${product.price}` : ""}
תאר את המוצר בצורה שיווקית ומושכת.`,
    },
  ];

  const { data, error } = await supabase.functions.invoke("ai-chat", {
    body: { messages, imageBase64: base64 },
  });
  if (error) throw error;

  // ai-chat returns streaming — collect the text
  const text = typeof data === "string" ? data : data?.text || data?.message || "";
  // Strip any special tags
  return text
    .replace(/\[ACTION:.*?\].*?\[\/ACTION\]/gs, "")
    .replace(/\[ELEMENTS\].*?\[\/ELEMENTS\]/gs, "")
    .replace(/\[QUICK_REPLIES\].*?\[\/QUICK_REPLIES\]/gs, "")
    .replace(/\[COLOR_PALETTE\].*?\[\/COLOR_PALETTE\]/gs, "")
    .replace(/\[VISUAL_OPTIONS\].*?\[\/VISUAL_OPTIONS\]/gs, "")
    .trim()
    .slice(0, 200);
}

// ─── AI: Remove Background ──────────────────────────────────
export async function aiRemoveBackground(image: string): Promise<string> {
  const base64 = imageToBase64(image);

  const { data, error } = await supabase.functions.invoke("remove-bg-precise", {
    body: { imageBase64: base64 },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.resultImage; // base64 with transparent background
}

// ─── AI: Upscale Image ──────────────────────────────────────
export async function aiUpscaleImage(image: string, scale: number = 2): Promise<string> {
  const base64 = imageToBase64(image);

  const { data, error } = await supabase.functions.invoke("upscale-image", {
    body: { imageBase64: base64, scale },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.resultImage;
}

// ─── AI: Suggest Catalog Theme ──────────────────────────────
export async function aiSuggestTheme(
  products: CatalogProduct[],
): Promise<Partial<CatalogSettings>> {
  // Analyze first product image to derive colors
  if (products.length === 0) return {};

  const base64 = imageToBase64(products[0].image);

  const { data, error } = await supabase.functions.invoke("analyze-image", {
    body: { imageBase64: base64 },
  });
  if (error) throw error;

  const colors: { hex: string; percentage: number }[] = data?.colors || [];

  if (colors.length >= 2) {
    // Use dominant color as brand, second as accent
    return {
      brandColor: colors[0].hex,
      accentColor: colors[1].hex,
    };
  }

  return {};
}

// ─── AI: Generate Smart Name ─────────────────────────────────
export async function aiGenerateName(image: string): Promise<string> {
  const base64 = imageToBase64(image);

  const { data, error } = await supabase.functions.invoke("suggest-name", {
    body: { backgroundDescription: `Product in image: base64 attached`, imageBase64: base64 },
  });
  if (error) throw error;
  return data?.name || "מוצר ללא שם";
}

// ─── AI: Batch Operations ────────────────────────────────────
export async function aiBatchAnalyze(
  products: CatalogProduct[],
  operations: {
    descriptions?: boolean;
    removeBg?: boolean;
    upscale?: boolean;
    analyzeColors?: boolean;
  },
  onProgress?: (progress: AIBatchProgress) => void,
): Promise<CatalogProduct[]> {
  const results = [...products];

  for (let i = 0; i < results.length; i++) {
    const product = results[i];
    onProgress?.({ current: i + 1, total: results.length, productId: product.id, status: "processing" });

    try {
      // AI Description
      if (operations.descriptions) {
        try {
          const analysis = await aiAnalyzeProduct(product.image);
          results[i] = {
            ...results[i],
            aiDescription: analysis.suggestedDescription,
            colors: analysis.colors.map(c => c.hex),
          };
          // Update name if empty
          if (!product.name || product.name.includes("_")) {
            results[i].name = analysis.productType || analysis.suggestedName || product.name;
          }
        } catch { /* continue with other ops */ }
      }

      // Remove Background
      if (operations.removeBg) {
        try {
          const noBg = await aiRemoveBackground(product.image);
          results[i] = { ...results[i], noBgImage: noBg };
        } catch { /* continue */ }
      }

      // Upscale
      if (operations.upscale) {
        try {
          const upscaled = await aiUpscaleImage(product.image, 2);
          results[i] = { ...results[i], upscaledImage: upscaled };
        } catch { /* continue */ }
      }

      onProgress?.({ current: i + 1, total: results.length, productId: product.id, status: "done" });
    } catch {
      onProgress?.({ current: i + 1, total: results.length, productId: product.id, status: "error" });
    }
  }

  return results;
}

// ─── AI Text Overlay Generation ──────────────────────────────
export async function aiGenerateTextOverlays(
  catalogTitle: string,
  products: CatalogProduct[],
  language: "he" | "en" = "he",
): Promise<{ tagline: string; slogan: string; callToAction: string }> {
  const productNames = products.slice(0, 10).map(p => p.name).join(", ");
  const prompt = language === "he"
    ? `אתה כותב שיווקי. בהנתן קטלוג בשם "${catalogTitle}" עם מוצרים: ${productNames}.
צור 3 טקסטים קצרים בעברית:
1. tagline - משפט שיווקי קצר (עד 6 מילים)
2. slogan - סלוגן מותג (עד 10 מילים)
3. callToAction - קריאה לפעולה (עד 5 מילים)
החזר JSON בלבד: {"tagline":"...","slogan":"...","callToAction":"..."}`
    : `You are a marketing copywriter. Given a catalog "${catalogTitle}" with products: ${productNames}.
Create 3 short texts:
1. tagline - short marketing tagline (up to 6 words)
2. slogan - brand slogan (up to 10 words)
3. callToAction - call to action (up to 5 words)
Return JSON only: {"tagline":"...","slogan":"...","callToAction":"..."}`;

  const { data, error } = await supabase.functions.invoke("ai-chat", {
    body: { messages: [{ role: "user", content: prompt }] },
  });
  if (error) throw error;

  const text = data?.reply || data?.message || "";
  const jsonMatch = text.match(/\{[^}]+\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  return { tagline: catalogTitle, slogan: "", callToAction: "צרו קשר" };
}

// ─── AI Layout Suggestion ────────────────────────────────────
export async function aiSuggestLayout(
  products: CatalogProduct[],
): Promise<{
  suggestedFrame: string;
  suggestedFont: string;
  suggestedColumns: number;
  suggestedTemplate: string;
}> {
  const hasMany = products.length > 20;
  const hasPrices = products.some(p => p.price);
  const hasDescriptions = products.some(p => p.description);

  const prompt = `אתה מעצב קטלוגים מקצועי. יש לי ${products.length} מוצרים.
${hasPrices ? "יש מחירים." : "אין מחירים."}
${hasDescriptions ? "יש תיאורים." : "אין תיאורים."}
${hasMany ? "הרבה מוצרים — צריך תצוגה צפופה." : "מעט מוצרים — יכול להיות מרווח."}

הצע פריסה אופטימלית. החזר JSON בלבד:
{"suggestedFrame":"rounded|shadow-box|polaroid|modern-float|ornate-gold|thin|none","suggestedFont":"sans|serif|mono|decorative","suggestedColumns":2,"suggestedTemplate":"grid-shadow|grid-clean|luxury|minimal|magazine|lookbook|showcase|catalog-pro"}`;

  const { data, error } = await supabase.functions.invoke("ai-chat", {
    body: { messages: [{ role: "user", content: prompt }] },
  });
  if (error) throw error;

  const text = data?.reply || data?.message || "";
  const jsonMatch = text.match(/\{[^}]+\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  return {
    suggestedFrame: hasMany ? "thin" : "rounded",
    suggestedFont: "sans",
    suggestedColumns: hasMany ? 3 : 2,
    suggestedTemplate: hasMany ? "grid-clean" : "grid-shadow",
  };
}
