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

    let prompt: string;
    const isColorOnly = backgroundPrompt && backgroundPrompt.includes("Change ONLY the background color");
    
    if (referenceImages && referenceImages.length > 0) {
      prompt = `CRITICAL INSTRUCTIONS — follow ALL of them precisely:

1. The FIRST image is the product photo. You MUST keep EVERY product, object, item, embroidery, text, pattern, design, shape, and detail in the FIRST image COMPLETELY UNCHANGED. Do NOT alter, move, resize, distort, remove, or regenerate any product or element.

2. The SECOND image (and any additional images) are REFERENCE images showing the desired background style.

3. Your ONLY task: Remove the existing background from the FIRST image and replace it with a NEW background that matches the texture, color, pattern, veining, and overall look of the REFERENCE image(s) as closely as possible.

4. The products must remain in the EXACT same position, angle, size, and lighting as in the original.

5. Additional context: ${backgroundPrompt || "Match the reference background exactly"}.

REMEMBER: Products = untouched. Background only = changed to match reference.`;
    } else if (isColorOnly) {
      prompt = `CRITICAL INSTRUCTIONS:

1. Keep EVERY product, object, item, embroidery, text, pattern, design, and detail in this image COMPLETELY UNCHANGED. Do NOT alter any product in any way.

2. ${backgroundPrompt}

3. The products must stay in the EXACT same position, angle, size, and lighting.

ONLY the background area changes. Everything else stays pixel-perfect identical.`;
    } else {
      prompt = `CRITICAL INSTRUCTIONS:

1. Keep EVERY product, object, item, embroidery, text, pattern, design, and detail in this image COMPLETELY UNCHANGED. Do NOT alter, move, resize, or regenerate any product.

2. Replace ONLY the background with: ${backgroundPrompt}

3. The products must remain in the EXACT same position, angle, size, and lighting as the original.

ONLY the background behind and around the products should change.`;
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
