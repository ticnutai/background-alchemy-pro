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
    const { imageUrl, operations } = await req.json();

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "No image URL provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const CLOUDINARY_CLOUD_NAME = Deno.env.get("CLOUDINARY_CLOUD_NAME");
    const CLOUDINARY_API_KEY = Deno.env.get("CLOUDINARY_API_KEY");
    const CLOUDINARY_API_SECRET = Deno.env.get("CLOUDINARY_API_SECRET");

    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      return new Response(JSON.stringify({ error: "Cloudinary credentials not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate SHA-1 signature for Cloudinary API
    const encoder = new TextEncoder();

    async function sha1Hex(data: string): Promise<string> {
      const hashBuffer = await crypto.subtle.digest("SHA-1", encoder.encode(data));
      return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }

    const timestamp = Math.floor(Date.now() / 1000);

    // Upload image to Cloudinary first
    const paramsToSign = `timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
    const signature = await sha1Hex(paramsToSign);

    const formData = new FormData();
    formData.append("file", imageUrl);
    formData.append("timestamp", timestamp.toString());
    formData.append("api_key", CLOUDINARY_API_KEY);
    formData.append("signature", signature);

    const uploadRes = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Cloudinary upload error: ${errText}`);
    }

    const uploadData = await uploadRes.json();
    const publicId = uploadData.public_id;

    // Build transformation URL based on requested operations
    const transformations: string[] = [];

    if (operations?.optimize) {
      transformations.push("q_auto", "f_auto");
    }

    if (operations?.resize) {
      const { width, height, crop } = operations.resize;
      transformations.push(
        `w_${width || "auto"}`,
        `h_${height || "auto"}`,
        `c_${crop || "fill"}`,
        "g_auto"
      );
    }

    if (operations?.social) {
      // Predefined social media sizes
      const socialSizes: Record<string, { w: number; h: number }> = {
        "instagram-post": { w: 1080, h: 1080 },
        "instagram-story": { w: 1080, h: 1920 },
        "facebook-post": { w: 1200, h: 630 },
        "pinterest": { w: 1000, h: 1500 },
        "twitter": { w: 1200, h: 675 },
        "linkedin": { w: 1200, h: 627 },
      };

      const size = socialSizes[operations.social];
      if (size) {
        transformations.push(`w_${size.w}`, `h_${size.h}`, "c_pad", "b_auto");
      }
    }

    if (operations?.watermark) {
      transformations.push(
        `l_text:Arial_24_bold:${encodeURIComponent(operations.watermark)}`,
        "o_40",
        "g_south_east",
        "x_20",
        "y_20"
      );
    }

    if (operations?.removeBackground) {
      transformations.push("e_background_removal");
    }

    if (operations?.enhance) {
      transformations.push("e_improve", "e_sharpen:80");
    }

    const transformUrl = transformations.length > 0
      ? `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${transformations.join(",")}/${publicId}.${operations?.format || "png"}`
      : uploadData.secure_url;

    return new Response(
      JSON.stringify({
        originalUrl: uploadData.secure_url,
        optimizedUrl: transformUrl,
        publicId,
        width: uploadData.width,
        height: uploadData.height,
        format: uploadData.format,
        bytes: uploadData.bytes,
        method: "cloudinary",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("cloudinary-optimize error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
