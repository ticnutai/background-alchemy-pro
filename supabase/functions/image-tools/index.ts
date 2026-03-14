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
    const { imageBase64, action, actionParams } = await req.json();

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

    let prompt = "";

    switch (action) {
      case "remove-element":
        prompt = `Look at this product photo. ${actionParams?.description || "Remove any unwanted elements, stains, spots, or imperfections"} from the image. Keep everything else exactly the same — same product, same position, same lighting. Only remove the specified elements and fill the area naturally.`;
        break;

      case "add-shadow":
        const shadowType = actionParams?.type || "natural";
        prompt = `Add a ${shadowType === "reflection" ? "realistic mirror-like reflection" : "natural soft shadow"} underneath the product in this image. The shadow should look realistic and match the lighting direction. Keep the product and background exactly the same. Only add the ${shadowType === "reflection" ? "reflection" : "shadow"} effect.`;
        break;

      case "add-text":
        prompt = `Add elegant ${actionParams?.style || "gold embroidery"} text that says "${actionParams?.text || ""}" on the product in this image. The text should look like it's actually ${actionParams?.style === "silver" ? "silver metallic thread" : "gold thread embroidery"} on the fabric. Keep everything else the same. The text should be in ${actionParams?.language || "Hebrew"} and positioned ${actionParams?.position || "center"} on the product.`;
        break;

      case "add-frame":
        const frameStyle = actionParams?.frameStyle || "gold-ornate";
        const framePrompts: Record<string, string> = {
          "gold-ornate": "Add an elegant ornate gold picture frame around this product image. The frame should be luxurious with detailed molding and a warm golden finish.",
          "silver-modern": "Add a sleek modern silver frame around this product image. Clean lines, minimalist metallic border.",
          "wood-rustic": "Add a rustic wooden frame around this product image. Natural wood grain, warm brown tones.",
          "floral-gold": "Add a decorative gold frame with floral motifs around this product image. Elegant flowers and leaves in the frame design.",
          "holiday-passover": "Add a decorative Passover-themed border with matzah, wine cups, and Seder plate elements around this product image.",
          "holiday-sukkot": "Add a Sukkot-themed border with lulav, etrog, and sukkah decorations around this product image.",
          "holiday-rosh": "Add a Rosh Hashana border with pomegranates, apples, honey jar, and shofar around this product image.",
        };
        prompt = framePrompts[frameStyle] || framePrompts["gold-ornate"];
        prompt += " Keep the original product image intact in the center.";
        break;

      case "multi-background":
        const bgStyle = actionParams?.style || "marble";
        prompt = `Create a grid of 4 versions of this product on different backgrounds: 1) White marble surface, 2) Dark wood table, 3) Soft linen fabric, 4) Light sage green solid background. Keep the product identical in each, only change the background. Arrange in a 2x2 grid layout.`;
        break;

      case "collage":
        prompt = `Create a luxurious product display collage with this product. Show it from the main angle on a marble surface, with elegant styling — add a gold plate, some greenery/flowers, and a folded linen napkin as props. Make it look like a high-end catalog layout. Studio lighting.`;
        break;

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const content: any[] = [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: imageBase64 } },
    ];

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

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "יותר מדי בקשות, נסה שוב בעוד רגע" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const resultImage = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!resultImage) {
      return new Response(JSON.stringify({ error: "Failed to process image", details: data }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ resultImage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
