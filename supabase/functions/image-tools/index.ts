import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
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

      case "add-elements":
        prompt = `Add the following decorative elements/props around and near the product in this image: ${actionParams?.elements || "elegant decorative items"}. Keep the main product EXACTLY the same — same position, same size, same lighting, same details. The added elements should look natural, realistically placed, and elegantly styled as if in a professional product photography setup. The elements should complement the product, not cover or overlap it. Professional studio lighting.`;
        break;

      case "color-grade": {
        const intensity = actionParams?.intensity || 100;
        const intensityDesc = intensity < 50 ? "subtly" : intensity < 80 ? "moderately" : "strongly";
        const styleMap: Record<string, string> = {
          "warm-gold": `${intensityDesc} apply a warm golden color grading. Make tones warmer, add golden highlights, luxurious warm atmosphere.`,
          "cool-silver": `${intensityDesc} apply a cool silver/blue color grading. Cooler tones, silvery highlights, elegant cool atmosphere.`,
          "cool-blue": `${intensityDesc} apply a cool blue modern color grading. Blue-tinted highlights, contemporary clean feel.`,
          "bright-airy": `${intensityDesc} apply bright and airy color grading. Increase brightness, soften shadows, clean whites, fresh light feel.`,
          "moody-dark": `${intensityDesc} apply moody dark color grading. Deep shadows, high contrast, dramatic rich deep tones.`,
          "moody": `${intensityDesc} apply moody dramatic color grading. Dark shadows, cinematic contrast, atmospheric depth.`,
          "vintage": `${intensityDesc} apply vintage film color grading. Warm tint, slightly reduced saturation, subtle grain, nostalgic classic feel.`,
          "high-contrast": `${intensityDesc} apply high contrast color grading. Darker darks, lighter lights, punchy vibrant colors.`,
          "cinematic": `${intensityDesc} apply cinematic color grading. Teal shadows, orange highlights, film-like contrast, Hollywood color science.`,
          "pastel": `${intensityDesc} apply soft pastel color grading. Muted gentle colors, light pink/lavender/mint tones, dreamy soft feel.`,
          "dramatic-red": `${intensityDesc} apply dramatic red/crimson color grading. Rich deep reds, warm burgundy shadows, passionate bold atmosphere.`,
          "earthy-natural": `${intensityDesc} apply earthy natural color grading. Warm brown/olive/terracotta tones, organic natural feel, matte finish.`,
        };
        const style = actionParams?.style || "warm-gold";
        prompt = (styleMap[style] || styleMap["warm-gold"]) + " Keep the product details sharp and identical. Only change colors/tones.";
        break;
      }

      case "blur-background": {
        const strengthMap: Record<string, string> = {
          "light": "Apply a subtle background blur (like f/2.8 depth of field)",
          "medium": "Apply a moderate background blur (like f/1.8 depth of field)",
          "heavy": "Apply a strong background blur (like f/1.2 bokeh effect)",
        };
        const strength = actionParams?.strength || "medium";
        prompt = `${strengthMap[strength] || strengthMap["medium"]} to this product photo. Keep the main product perfectly sharp and in focus. Only blur the background behind/around the product. Create a professional shallow depth of field look.`;
        break;
      }

      case "style-transfer": {
        const styleTransferMap: Record<string, string> = {
          "oil-painting": "Transform this product photo into an oil painting style. Rich brushstrokes, textured canvas feel, vibrant pigments.",
          "watercolor": "Transform this product photo into a watercolor painting style. Soft washes, flowing colors, gentle paper texture.",
          "pop-art": "Transform this product photo into pop art style. Bold flat colors, thick outlines, Andy Warhol inspired.",
          "pencil-sketch": "Transform this product photo into a detailed pencil sketch. Fine crosshatching, realistic graphite shading.",
          "3d-render": "Transform this product photo into a 3D rendered style. Smooth surfaces, perfect lighting, CGI quality.",
          "anime": "Transform this product photo into anime/manga illustration style. Clean lines, cel-shading, vibrant anime colors.",
        };
        const transferStyle = actionParams?.style || "oil-painting";
        prompt = (styleTransferMap[transferStyle] || styleTransferMap["oil-painting"]) + " Keep the product recognizable and centered.";
        break;
      }

      case "smart-crop": {
        const ratio = actionParams?.ratio || "1:1";
        prompt = `Crop and reframe this product photo to a ${ratio} aspect ratio. Center the product perfectly, ensure it fills the frame well with appropriate padding. Maintain professional composition. Keep all product details identical.`;
        break;
      }

      case "live-filter-apply": {
        const filters = actionParams?.filters || {};
        prompt = `Apply these precise adjustments to this product photo: brightness ${filters.brightness || 100}%, contrast ${filters.contrast || 100}%, saturation ${filters.saturation || 100}%, hue shift ${filters.hueRotate || 0} degrees, sepia ${filters.sepia || 0}%. Keep the product details sharp and identical. Apply the color adjustments professionally.`;
        break;
      }

      case "apply-layers": {
        const layerNames = actionParams?.layerNames || [];
        prompt = `Apply these combined filter effects to this product photo: ${layerNames.join(", ")}. Apply them in order, stacking each effect. Keep the product details sharp and identical. Professional color grading result.`;
        break;
      }

      case "color-transfer": {
        prompt = `Transfer the color palette, tones, lighting mood, and overall color atmosphere from the SECOND image (reference) to the FIRST image (product). Keep the product composition, shape, and details identical — only change the colors, tones, and lighting to match the reference image's palette and mood.`;
        // Content will include both images
        break;
      }

      case "regional-mask": {
        const region = actionParams?.region || "background";
        const filterType = actionParams?.filterType || "blur";
        const maskIntensity = actionParams?.intensity || 70;
        const intensityWord = maskIntensity < 40 ? "subtly" : maskIntensity < 70 ? "moderately" : "strongly";
        const filterMap: Record<string, string> = {
          "blur": `${intensityWord} blur`,
          "darken": `${intensityWord} darken`,
          "brighten": `${intensityWord} brighten`,
          "desaturate": `${intensityWord} desaturate (make black and white)`,
          "warm": `${intensityWord} apply warm golden tones to`,
          "cool": `${intensityWord} apply cool blue tones to`,
          "vintage": `${intensityWord} apply vintage film effect to`,
          "dramatic": `${intensityWord} apply dramatic high-contrast moody effect to`,
        };
        const filterDesc = filterMap[filterType] || filterMap["blur"];
        if (region === "background") {
          prompt = `${filterDesc} ONLY the background of this product photo. Keep the product PERFECTLY sharp, unchanged, and unaffected. Only modify the background area behind and around the product.`;
        } else {
          prompt = `${filterDesc} ONLY the product/main subject in this photo. Keep the background PERFECTLY unchanged and unaffected. Only modify the product/main subject.`;
        }
        break;
      }

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

    // For color-transfer, add the reference image
    if (action === "color-transfer" && actionParams?.referenceImage) {
      content.push({ type: "image_url", image_url: { url: actionParams.referenceImage } });
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
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
