import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, productImage } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userContent: any[] = [
      {
        type: "text",
        text: `Generate a professional product photography background preview based on this description: "${prompt}". 
Create ONLY the background scene without any product. Show the surface, textures, props, and lighting exactly as described. 
The image should be a realistic mockup of what the final background would look like. Make it photorealistic and high quality.
Render it as a square image suitable for product photography.`,
      },
    ];

    // If product image provided, include it for context
    if (productImage) {
      userContent.push({
        type: "image_url",
        image_url: { url: productImage },
      });
      userContent[0].text += "\nHere is the product that will be placed on this background - use it for scale and color harmony reference only.";
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [
          {
            role: "user",
            content: userContent,
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "יותר מדי בקשות, נסה שוב בעוד רגע" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "נגמרו הקרדיטים" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "שגיאה ביצירת תצוגה מקדימה" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    console.log("Preview response keys:", JSON.stringify(Object.keys(data)));

    // Extract image from response - Gemini image models return inline_data
    const choice = data.choices?.[0];
    const message = choice?.message;

    let imageBase64 = null;
    let textContent = "";

    if (message?.content) {
      // If content is an array (multimodal response)
      if (Array.isArray(message.content)) {
        for (const part of message.content) {
          if (part.type === "image_url" && part.image_url?.url) {
            imageBase64 = part.image_url.url;
          } else if (part.type === "text") {
            textContent = part.text || "";
          } else if (part.inline_data) {
            imageBase64 = `data:${part.inline_data.mime_type};base64,${part.inline_data.data}`;
          }
        }
      } else if (typeof message.content === "string") {
        textContent = message.content;
        // Check if there's a base64 image embedded
        const b64Match = message.content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
        if (b64Match) {
          imageBase64 = b64Match[0];
        }
      }
    }

    return new Response(
      JSON.stringify({
        image: imageBase64,
        text: textContent,
        raw_keys: Object.keys(data),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("preview error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "שגיאה לא ידועה" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
