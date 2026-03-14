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
    if (referenceImages && referenceImages.length > 0) {
      prompt = `Replace ONLY the background of the FIRST image (the product photo). Keep the product/object completely intact, untouched, and in the exact same position with the same lighting on it. Use the OTHER image(s) as reference for what the new background should look like — match their texture, color, pattern, and style as closely as possible. Additional instructions: ${backgroundPrompt || "Match the reference background exactly"}. The product must remain pixel-perfect and unchanged. Only the background behind and around the product should change.`;
    } else {
      prompt = `Replace ONLY the background of this product image. Keep the product/object completely intact, untouched, and in the exact same position with the same lighting on it. The new background should be: ${backgroundPrompt}. The product must remain pixel-perfect and unchanged. Only the background behind and around the product should change.`;
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
        model: "google/gemini-3.1-flash-image-preview",
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
