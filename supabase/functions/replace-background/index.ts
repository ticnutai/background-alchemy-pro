import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, backgroundPrompt, referenceImages } = await req.json();

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let prompt: string;
    const isColorOnly = backgroundPrompt && backgroundPrompt.includes("Change ONLY the background color");
    
    if (referenceImages && referenceImages.length > 0) {
      prompt = `YOU ARE A BACKGROUND-ONLY EDITOR. FOLLOW THESE RULES WITH ZERO EXCEPTIONS:

## ABSOLUTE RULE — DO NOT CHANGE THE PRODUCTS
- The FIRST image contains products/objects. These are SACRED and UNTOUCHABLE.
- Do NOT regenerate, redraw, alter, modify, move, resize, distort, blur, sharpen, recolor, or change ANY product, object, embroidery, text, pattern, fabric texture, stitching, or design element.
- Every single pixel of every product must remain IDENTICAL to the original.
- The Hebrew text, the wreath/branch embroidery patterns, the fabric weave — ALL must be preserved exactly.

## YOUR ONLY TASK
- Look at the SECOND image — it shows a background texture/surface.
- Remove ONLY the background area (the surface behind and under the products) from the FIRST image.
- Replace that background area with the texture, color, veining pattern, and look that matches the SECOND image as closely as possible.
- The new background should tile/extend naturally to fill the entire background area.

## COMPOSITION RULES
- Products stay in the EXACT same position, angle, size, perspective, and proportions.
- Maintain natural shadows under the products (adjust shadow color to match new surface).
- Lighting direction stays the same, just adapt the surface reflection to match the new background material.

## WHAT COUNTS AS "BACKGROUND"
- The flat surface the products sit on
- The blurred area behind the products
- Any visible wall or backdrop
- NOT the products themselves, NOT their fabric, NOT their embroidery

${backgroundPrompt ? `Additional context: ${backgroundPrompt}` : "Match the reference background as precisely as possible."}

OUTPUT: The exact same composition with ONLY the background surface/backdrop changed.`;
    } else if (isColorOnly) {
      prompt = `CRITICAL INSTRUCTIONS:

1. Keep EVERY product, object, item, embroidery, text, pattern, design, and detail in this image COMPLETELY UNCHANGED. Do NOT alter any product in any way.

2. ${backgroundPrompt}

3. The products must stay in the EXACT same position, angle, size, and lighting.

ONLY the background area changes. Everything else stays pixel-perfect identical.`;
    } else {
      prompt = `YOU ARE A BACKGROUND-ONLY EDITOR. FOLLOW THESE RULES WITH ZERO EXCEPTIONS:

## ABSOLUTE RULE — DO NOT CHANGE THE PRODUCTS
- This image contains products/objects. These are SACRED and UNTOUCHABLE.
- Do NOT regenerate, redraw, alter, modify, move, resize, distort, blur, sharpen, recolor, or change ANY product, object, embroidery, text, pattern, fabric texture, stitching, or design element.
- Every single pixel of every product must remain IDENTICAL to the original.

## YOUR ONLY TASK
- Replace ONLY the background with: ${backgroundPrompt}
- The new background should look natural and professional.

## COMPOSITION RULES
- Products stay in the EXACT same position, angle, size, perspective, and proportions.
- Maintain natural shadows (adjust to match new surface).
- Lighting direction stays the same.

## WHAT COUNTS AS "BACKGROUND"
- The flat surface the products sit on
- The blurred area behind the products
- Any visible wall or backdrop
- NOT the products themselves

OUTPUT: The exact same products with ONLY the background changed.`;
    }

    // Build content array with main image + reference images
    const content: any[] = [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: imageBase64 } },
    ];

    if (referenceImages && referenceImages.length > 0) {
      for (const refImg of referenceImages) {
        content.push({ type: "image_url", image_url: { url: refImg } });
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [{ role: "user", content }],
        modalities: ["image", "text"],
      }),
    });

    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "נגמרו הקרדיטים. יש להוסיף קרדיטים בהגדרות Workspace." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "יותר מדי בקשות, נסה שוב בעוד רגע" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const resultImage = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    const textResponse = data.choices?.[0]?.message?.content || "";

    if (!resultImage) {
      return new Response(JSON.stringify({ error: "Failed to generate image", details: data }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ resultImage, textResponse }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
