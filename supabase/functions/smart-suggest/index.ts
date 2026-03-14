import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64 } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this product image. Identify the product type, material, colors, and style. Then suggest 6 ideal background types that would make this product look its best for e-commerce/catalog photography.

Return ONLY a valid JSON object with this structure:
{
  "product": { "type": "string", "material": "string", "colors": ["string"], "style": "string" },
  "suggestions": [
    { "name": "string (Hebrew)", "nameEn": "string", "prompt": "detailed prompt for AI background replacement", "reason": "why this background works (Hebrew)" }
  ]
}`
            },
            { type: "image_url", image_url: { url: imageBase64 } }
          ]
        }],
        tools: [{
          type: "function",
          function: {
            name: "suggest_backgrounds",
            description: "Return product analysis and background suggestions",
            parameters: {
              type: "object",
              properties: {
                product: {
                  type: "object",
                  properties: {
                    type: { type: "string" },
                    material: { type: "string" },
                    colors: { type: "array", items: { type: "string" } },
                    style: { type: "string" }
                  },
                  required: ["type", "material", "colors", "style"]
                },
                suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      nameEn: { type: "string" },
                      prompt: { type: "string" },
                      reason: { type: "string" }
                    },
                    required: ["name", "nameEn", "prompt", "reason"]
                  }
                }
              },
              required: ["product", "suggestions"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "suggest_backgrounds" } }
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "יותר מדי בקשות, נסה שוב בעוד רגע" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const result = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: try to parse from content
    const content = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return new Response(jsonMatch[0], {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Failed to analyze image", details: data }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
