import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
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

    // PIPELINE APPROACH:
    // Step 1: Use Gemini to generate ONLY a clean background image (no products)
    // Step 2: Use Gemini to composite the original products onto the new background
    
    // ---- STEP 1: Generate the background ----
    const bgContent: any[] = [];
    
    if (referenceImages && referenceImages.length > 0) {
      bgContent.push({
        type: "text",
        text: `Look at this reference image. Generate a CLEAN, EMPTY background surface/texture image that matches this reference exactly.

REQUIREMENTS:
- Output should be ONLY the background surface — NO products, NO objects, NO items on it.
- Match the texture, color, veining, grain pattern, and overall look of the reference.
- The surface should fill the entire frame.
- Professional product photography surface/backdrop.
- Same lighting and angle as the reference.
${backgroundPrompt ? `- Additional context: ${backgroundPrompt}` : ""}

Output ONLY the clean empty background surface.`,
      });
      for (const refImg of referenceImages) {
        bgContent.push({ type: "image_url", image_url: { url: refImg } });
      }
    } else {
      bgContent.push({
        type: "text",
        text: `Generate a CLEAN, EMPTY background surface image for product photography.

REQUIREMENTS:
- Output should be ONLY the background surface — NO products, NO objects.
- Background: ${backgroundPrompt}
- Professional product photography surface/backdrop.
- The surface should fill the entire frame.
- Slight perspective angle as if viewed from above at ~30-45 degrees.

Output ONLY the clean empty background surface.`,
      });
    }

    const bgResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [{ role: "user", content: bgContent }],
        modalities: ["image", "text"],
      }),
    });

    if (!bgResponse.ok) {
      const errData = await bgResponse.json().catch(() => ({}));
      if (bgResponse.status === 402) {
        return new Response(JSON.stringify({ error: "נגמרו הקרדיטים" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Background generation failed: ${bgResponse.status}`);
    }

    const bgData = await bgResponse.json();
    const generatedBg = bgData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!generatedBg) {
      throw new Error("Failed to generate background image");
    }

    // ---- STEP 2: Composite — place original products onto new background ----
    const compositeContent = [
      {
        type: "text",
        text: `You have TWO images:

IMAGE 1 (FIRST): The original product photo with products on a background.
IMAGE 2 (SECOND): A clean empty background surface.

YOUR TASK — PRECISE COMPOSITING:
1. Take the EXACT products from IMAGE 1 — every product, every detail, every embroidery, every Hebrew text, every pattern, every stitch, every shadow must be PIXEL-PERFECT IDENTICAL.
2. Place these EXACT products onto the background from IMAGE 2.
3. Products must be in the EXACT same position, angle, size, and arrangement as in IMAGE 1.
4. Add natural shadows that match the new surface material.
5. Blend the lighting to look natural.

CRITICAL: You are essentially "cutting out" the products from IMAGE 1 and "pasting" them onto IMAGE 2's background. The products ARE NOT regenerated — they are PRESERVED from IMAGE 1 exactly.

DO NOT change any product. DO NOT alter any embroidery. DO NOT modify any text. DO NOT change fabric texture. ONLY the background surface changes.`,
      },
      { type: "image_url", image_url: { url: imageBase64 } },
      { type: "image_url", image_url: { url: generatedBg } },
    ];

    const compositeResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [{ role: "user", content: compositeContent }],
        modalities: ["image", "text"],
      }),
    });

    if (!compositeResponse.ok) {
      if (compositeResponse.status === 402) {
        return new Response(JSON.stringify({ error: "נגמרו הקרדיטים" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Compositing failed: ${compositeResponse.status}`);
    }

    const compositeData = await compositeResponse.json();
    const resultImage = compositeData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    const textResponse = compositeData.choices?.[0]?.message?.content || "";

    if (!resultImage) {
      // Fallback: return the generated background if compositing fails
      return new Response(JSON.stringify({ 
        resultImage: generatedBg, 
        textResponse: "ה-compositing נכשל, מוצג רקע בלבד. נסה שוב.",
        method: "pipeline-bg-only",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ 
      resultImage, 
      textResponse, 
      backgroundImage: generatedBg,
      method: "pipeline-2step",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
