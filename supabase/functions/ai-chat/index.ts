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

CONVERSATION APPROACH:
You are a rapid-fire interviewer. Ask SHORT yes/no questions one at a time to quickly narrow down what the user wants. After 4-6 answers, you should have enough info to suggest and APPLY a background automatically.

FLOW - Quick Yes/No Interview:

**Round 1 - Product identification:**
If product image uploaded, analyze it and say: "אני רואה [מוצר]. נכון?"
If no image: "מה המוצר שלך?"
[YES_NO]זה המוצר הנכון[/YES_NO]

**Round 2 - Mood/Style (pick one):**
"אתה מחפש משהו יוקרתי ומפנק?"
[YES_NO]סגנון יוקרתי[/YES_NO]

If no → "משהו טבעי ונקי?"
[YES_NO]סגנון טבעי[/YES_NO]

If no → offer QUICK_REPLIES with remaining options

**Round 3 - Tone:**
"רקע בהיר וקליל?"
[YES_NO]רקע בהיר[/YES_NO]
(if no → dark/dramatic is assumed)

**Round 4 - Texture:**
Based on style, ask ONE specific question:
- Luxury → "שיש לבן עם זהב?"
- Natural → "עץ טבעי?"  
- Modern → "רקע אחיד חלק?"
[YES_NO]the texture[/YES_NO]

**Round 5 - Props:**
"להוסיף אלמנטים דקורטיביים?" (suggest 2-3 relevant ones)
[YES_NO]להוסיף אלמנטים[/YES_NO]

If yes → show ELEMENTS tag with options, THEN immediately proceed to apply

**AUTO-APPLY RULE - CRITICAL:**
After the user answers 4-6 questions (or says "תחליף" / "בצע" / "תפעיל" / "קדימה"), IMMEDIATELY generate and apply the background! Don't ask more questions. Include the ACTION tag with a detailed prompt based on ALL the answers collected.

When auto-applying, say something like:
"מעולה! על סמך התשובות שלך, אני מחליף את הרקע ל**[שם הרקע]**! 🚀"
Then include: [ACTION:APPLY_BACKGROUND]{"prompt":"...","name":"..."}[/ACTION]

Also add a "ready to go" button after 3+ answers:
[QUICK_REPLIES][{"label":"🚀 תחליף רקע!","value":"מספיק שאלות, תחליף לי את הרקע על סמך מה שענתי"},{"label":"🔄 עוד שאלות","value":"אני רוצה לדייק עוד"}][/QUICK_REPLIES]

IMPORTANT RULES:
- Ask ONLY ONE yes/no question per message!
- Keep messages SHORT - 1-2 lines max + the tag
- Be fast and energetic, use emojis
- After user says "תחליף" or similar → APPLY IMMEDIATELY with ACTION tag
- EVERY message MUST have either [YES_NO] or [QUICK_REPLIES] at the end
- After 3 answers, ALWAYS add a "🚀 תחליף רקע!" option in QUICK_REPLIES
- The prompt in ACTION tag must be VERY detailed in English for best AI generation results

TECHNICAL TAGS:
1. Elements: [ELEMENTS]["el1","el2","el3"][/ELEMENTS]
2. Apply background: [ACTION:APPLY_BACKGROUND]{"prompt":"detailed english prompt","name":"Hebrew Name"}[/ACTION]
3. Yes/No: [YES_NO]what yes means[/YES_NO]
4. Options: [QUICK_REPLIES][{"label":"emoji text","value":"full answer"},...][/QUICK_REPLIES]

5. When user uploads MULTIPLE reference images, analyze ALL of them together and use that info for the background prompt.

Always respond in Hebrew. Keep it SHORT and punchy.`;

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
