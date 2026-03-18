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

    // SCENE-AWARE PIPELINE:
    // Step 1: Generate a full scene background (with contextual elements, NO product)
    // Step 2: Composite the original product INTO the scene

    // ---- STEP 1: Generate the scene ----
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sceneContent: any[] = [];

    if (referenceImages && referenceImages.length > 0) {
      sceneContent.push({
        type: "text",
        text: `Look at this reference image for style and mood. Generate a COMPLETE SCENE image for product photography.

REQUIREMENTS:
- Create a full scene based on this description: ${backgroundPrompt}
- Include all the contextual elements, props, and decorations described.
- Leave a clear, prominent EMPTY SPACE in the center/foreground where a product will be placed later.
- Match the style/mood of the reference image.
- The scene should look natural, well-lit, and professionally styled.
- Do NOT include any product or main object in the center — just the scene, setting, and surrounding elements.

Output ONLY the complete scene image with an empty focal area for the product.`,
      });
      for (const refImg of referenceImages) {
        sceneContent.push({ type: "image_url", image_url: { url: refImg } });
      }
    } else {
      sceneContent.push({
        type: "text",
        text: `Generate a COMPLETE SCENE image for product photography.

REQUIREMENTS:
- Create this scene: ${backgroundPrompt}
- Include all the contextual elements, props, decorations, and atmosphere described.
- Leave a clear, prominent EMPTY SPACE in the center/foreground where a product will be placed.
- The scene should look natural, well-lit, and professionally styled.
- Include depth — foreground elements, middle ground, and background.
- Do NOT include any product or main object in the center — only the surrounding scene elements.

LAYOUT:
- Scene elements (cups, plates, candles, decorations, etc.) should be arranged AROUND the center.
- The center/foreground area should be clear and ready for product placement.
- Slight overhead camera angle (~30-45 degrees) works best.

Output ONLY the complete scene image.`,
      });
    }

    const sceneResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [{ role: "user", content: sceneContent }],
        modalities: ["image", "text"],
      }),
    });

    if (!sceneResponse.ok) {
      if (sceneResponse.status === 402) {
        return new Response(JSON.stringify({ error: "נגמרו הקרדיטים" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (sceneResponse.status === 429) {
        return new Response(JSON.stringify({ error: "יותר מדי בקשות, נסה שוב בעוד רגע" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Scene generation failed: ${sceneResponse.status}`);
    }

    const sceneData = await sceneResponse.json();
    const generatedScene = sceneData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!generatedScene) {
      throw new Error("Failed to generate scene image");
    }

    // ---- STEP 2: Composite — place original product INTO the scene ----
    const compositeContent = [
      {
        type: "text",
        text: `You have TWO images:

IMAGE 1 (FIRST): A product photo. Extract the EXACT product from this image.
IMAGE 2 (SECOND): A scene/setting with various contextual elements and an empty space for the product.

YOUR TASK — SCENE COMPOSITING:
1. Extract the EXACT product from IMAGE 1 — preserve every detail, texture, color, pattern, embroidery, text, and element PERFECTLY. Not a single pixel of the product should change.
2. Place this EXACT product naturally INTO the scene from IMAGE 2, in the prominent empty space.
3. The product should look like it BELONGS in the scene:
   - Scale it appropriately relative to the scene elements.
   - Match the lighting direction and color temperature of the scene.
   - Add natural shadows that match the scene's lighting.
   - The product should interact naturally with the surface it sits on.
4. The product is the HERO — it should be the focal point of the composition.
5. Scene elements from IMAGE 2 can be partially behind or beside the product (natural depth layering).

CRITICAL RULES:
- Do NOT alter, redraw, or modify the product in ANY way.
- Do NOT change any embroidery, text, pattern, or design on the product.
- The product from IMAGE 1 must be IDENTICAL — only its surroundings change.
- The final image should look like a professional styled product photo taken in this scene.

Output the final composed image — the product naturally placed in the scene.`,
      },
      { type: "image_url", image_url: { url: imageBase64 } },
      { type: "image_url", image_url: { url: generatedScene } },
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
      if (compositeResponse.status === 429) {
        return new Response(JSON.stringify({ error: "יותר מדי בקשות, נסה שוב בעוד רגע" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Fallback: return generated scene without compositing
      return new Response(JSON.stringify({
        resultImage: generatedScene,
        textResponse: "Scene generated but compositing failed. Showing scene only.",
        sceneImage: generatedScene,
        method: "scene-only-fallback",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const compositeData = await compositeResponse.json();
    const resultImage = compositeData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    const textResponse = compositeData.choices?.[0]?.message?.content || "";

    if (!resultImage) {
      // Fallback: return the scene image
      return new Response(JSON.stringify({
        resultImage: generatedScene,
        textResponse: "Compositing did not produce an image. Showing scene only.",
        sceneImage: generatedScene,
        method: "scene-only-fallback",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      resultImage,
      textResponse,
      sceneImage: generatedScene,
      method: "scene-2step",
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
