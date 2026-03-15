import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, pointPrompts } = await req.json();

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

    // Step 1: Use Grounding DINO to detect the product automatically
    const dinoRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "75e93e33e00b05072686a9e3b38b3e5eb59caf4d5a1de4c49e4b4b384a8ee980",
        input: {
          image: dataUri,
          query: pointPrompts || "product . item . object",
          box_threshold: 0.25,
          text_threshold: 0.25,
        },
      }),
    });

    if (!dinoRes.ok) {
      const errText = await dinoRes.text();
      throw new Error(`Grounding DINO API error: ${errText}`);
    }

    let dinoPrediction = await dinoRes.json();

    // Poll with exponential backoff, max 60 iterations (~4 min timeout)
    let pollDelay = 500;
    let pollCount = 0;
    while (dinoPrediction.status !== "succeeded" && dinoPrediction.status !== "failed") {
      if (++pollCount > 60) throw new Error("Timeout: detection took too long");
      await new Promise((r) => setTimeout(r, pollDelay));
      pollDelay = Math.min(pollDelay * 2, 4000);
      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${dinoPrediction.id}`, {
        headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}` },
      });
      dinoPrediction = await pollRes.json();
    }

    if (dinoPrediction.status === "failed") {
      throw new Error(dinoPrediction.error || "Object detection failed");
    }

    // Step 2: Use SAM 2 for precise segmentation based on detected boxes
    const detections = dinoPrediction.output;

    const samRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "fe97b453a6455861e3bec01b3e7ca0de0981f1f8f67db5cb0c30e10a02a48183",
        input: {
          image: dataUri,
          use_m2m: true,
          multimask_output: false,
        },
      }),
    });

    if (!samRes.ok) {
      const errText = await samRes.text();
      throw new Error(`SAM 2 API error: ${errText}`);
    }

    let samPrediction = await samRes.json();

    // Poll with exponential backoff, max 60 iterations (~4 min timeout)
    let samPollDelay = 500;
    let samPollCount = 0;
    while (samPrediction.status !== "succeeded" && samPrediction.status !== "failed") {
      if (++samPollCount > 60) throw new Error("Timeout: segmentation took too long");
      await new Promise((r) => setTimeout(r, samPollDelay));
      samPollDelay = Math.min(samPollDelay * 2, 4000);
      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${samPrediction.id}`, {
        headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}` },
      });
      samPrediction = await pollRes.json();
    }

    if (samPrediction.status === "failed") {
      throw new Error(samPrediction.error || "Segmentation failed");
    }

    return new Response(
      JSON.stringify({
        detections,
        segmentation: samPrediction.output,
        method: "grounding-dino + sam2",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("segment-product error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
