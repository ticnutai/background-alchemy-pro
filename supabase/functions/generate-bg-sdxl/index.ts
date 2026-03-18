import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, backgroundPrompt, negativePrompt, strength } = await req.json();

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
    if (!REPLICATE_API_TOKEN) {
      return new Response(JSON.stringify({ error: "Replicate API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const base64Data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
    const dataUri = `data:image/png;base64,${base64Data}`;

    // Stable Diffusion XL Inpainting for high-quality background generation
    const createRes = await fetch("https://api.replicate.com/v1/models/stability-ai/sdxl/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          image: dataUri,
          prompt: `${backgroundPrompt || "Professional product photography background, studio lighting"}, high quality, detailed, 8k`,
          negative_prompt: negativePrompt || "blurry, low quality, distorted, text, watermark, deformed product",
          num_inference_steps: 30,
          guidance_scale: 7.5,
          prompt_strength: strength || 0.85,
          scheduler: "K_EULER_ANCESTRAL",
          width: 1024,
          height: 1024,
        },
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`Replicate API error: ${errText}`);
    }

    const prediction = await createRes.json();
    let result = prediction;

    // Poll with exponential backoff, max 60 iterations (~4 min timeout)
    let pollDelay = 500;
    let pollCount = 0;
    while (result.status !== "succeeded" && result.status !== "failed") {
      if (++pollCount > 60) throw new Error("Timeout: processing took too long");
      await new Promise((r) => setTimeout(r, pollDelay));
      pollDelay = Math.min(pollDelay * 2, 4000);
      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`, {
        headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}` },
      });
      result = await pollRes.json();
    }

    if (result.status === "failed") {
      throw new Error(result.error || "Background generation failed");
    }

    const outputUrl = Array.isArray(result.output) ? result.output[0] : result.output;

    return new Response(
      JSON.stringify({ resultImage: outputUrl, method: "sdxl-inpainting" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    console.error("generate-bg-sdxl error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
