import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, maskBase64, description } = await req.json();

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

    let maskUri: string | undefined;
    if (maskBase64) {
      const maskData = maskBase64.includes(",") ? maskBase64.split(",")[1] : maskBase64;
      maskUri = `data:image/png;base64,${maskData}`;
    }

    // LaMa inpainting model for precise element removal
    const createRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "e3de65e4e7f627368e15e2a64e42ef1d8b1677e4c1b404e7e2cf8e12d8b3e096",
        input: {
          image: dataUri,
          ...(maskUri ? { mask: maskUri } : {}),
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
      throw new Error(result.error || "Inpainting failed");
    }

    const outputUrl = result.output;

    return new Response(
      JSON.stringify({ resultImage: outputUrl, method: "lama-inpainting" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    console.error("inpaint-remove error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
