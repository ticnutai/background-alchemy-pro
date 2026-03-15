import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();

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

    // Use BRIA RMBG 2.0 for precise background removal
    const base64Data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
    const dataUri = `data:image/png;base64,${base64Data}`;

    // Create prediction using model name endpoint (no version hash needed)
    const createRes = await fetch("https://api.replicate.com/v1/models/bria/remove-background/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
        "Prefer": "wait",
      },
      body: JSON.stringify({
        input: {
          image: dataUri,
          preserve_alpha: true,
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
      throw new Error(result.error || "Background removal failed");
    }

    const outputUrl = result.output;

    return new Response(
      JSON.stringify({ resultImage: outputUrl, method: "bria-rmbg-2.0" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("remove-bg-precise error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
