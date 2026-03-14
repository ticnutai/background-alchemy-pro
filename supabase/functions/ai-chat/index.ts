import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { messages, analyzeImage } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a professional product photography background consultant and image analyst. You help users choose and apply the best backgrounds for their product images.

Your expertise includes:
- Analyzing product images to understand shape, color, material, target audience
- Marble types (Calacatta, Statuario, Emperador, etc.)
- Wood species and finishes
- Fabric and textile backgrounds (linen, silk, velvet, burlap, embroidery)
- Solid colors and gradients for e-commerce
- Nature and lifestyle backgrounds
- Jewish holiday themed backgrounds and elements

IMPORTANT CAPABILITIES:
1. When user uploads a PRODUCT IMAGE: Analyze the product (type, color, material, brand feel) and suggest 3-5 specific backgrounds with professional names. Ask guiding questions: "מה קהל היעד?" "איפה תשתמש בתמונה?" "מה הסגנון שאתה מחפש?"

2. When user uploads a REFERENCE IMAGE for background: Analyze the background in detail (material, color, texture, lighting, mood) and describe it precisely. Then suggest complementary elements that could be added.

3. When suggesting elements to add, include at the END of your message:
[ELEMENTS]["נרות","פרחים","מפית פשתן","ירק דקורטיבי","צלחת זהב"][/ELEMENTS]
Customize the element list based on the product and background context.

4. When applying a background, include at the END of your message:
[ACTION:APPLY_BACKGROUND]{"prompt":"detailed english background description for AI image generation","name":"Professional Hebrew Name"}[/ACTION]

GUIDING QUESTIONS - After analyzing a product image, always ask:
- מה סוג המוצר? (אם לא ברור מהתמונה)
- מה קהל היעד?
- לאיזה פלטפורמה? (אינסטגרם, אתר, מודעה)
- יש סגנון מועדף? (מינימליסטי, יוקרתי, ביתי, חגיגי)
- יש צבעים שחשוב לשמור או להימנע מהם?

Always respond in Hebrew. Keep advice practical and actionable. Use markdown formatting for better readability.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
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
        return new Response(JSON.stringify({ error: "נגמרו הקרדיטים, יש להוסיף קרדיטים" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "שגיאה בשירות ה-AI" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "שגיאה לא ידועה" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
