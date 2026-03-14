import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Eraser, Sun, Type, Frame, Grid2X2, LayoutGrid, X,
  Trash2, Sparkles, PenTool, PackagePlus
} from "lucide-react";

interface AdvancedToolsPanelProps {
  originalImage: string;
  resultImage: string | null;
  onResult: (img: string) => void;
}

type ToolMode = null | "remove" | "shadow" | "text" | "frame" | "multi-bg" | "collage" | "add-elements";

const frameStyles = [
  { id: "gold-ornate", label: "מסגרת זהב מפוארת", icon: "✦" },
  { id: "silver-modern", label: "מסגרת כסף מודרנית", icon: "◇" },
  { id: "wood-rustic", label: "מסגרת עץ כפרית", icon: "▢" },
  { id: "floral-gold", label: "מסגרת פרחי זהב", icon: "❀" },
  { id: "holiday-passover", label: "מסגרת פסח", icon: "🍷" },
  { id: "holiday-sukkot", label: "מסגרת סוכות", icon: "🌿" },
  { id: "holiday-rosh", label: "מסגרת ראש השנה", icon: "🍎" },
];

const elementPresets = [
  { id: "shabbat-table", label: "שולחן שבת ערוך", icon: "🕯️", desc: "נרות, חלות, יין, מפה לבנה" },
  { id: "kiddush-cups", label: "גביעי קידוש", icon: "🥂", desc: "גביעי כסף/זהב לקידוש" },
  { id: "flowers", label: "סידור פרחים", icon: "💐", desc: "זר פרחים אלגנטי" },
  { id: "candles", label: "נרות", icon: "🕯️", desc: "נרות דקורטיביים" },
  { id: "gold-plate", label: "צלחת זהב", icon: "🍽️", desc: "צלחת הגשה מוזהבת" },
  { id: "greenery", label: "ירוק וצמחים", icon: "🌿", desc: "ענפי ירק, אקליפטוס" },
  { id: "seder-plate", label: "קערת סדר", icon: "🍷", desc: "קערת סדר עם כל הסימנים" },
  { id: "honey-apple", label: "דבש ותפוח", icon: "🍎", desc: "צנצנת דבש ותפוחים" },
  { id: "pomegranate", label: "רימונים", icon: "🍑", desc: "רימונים דקורטיביים" },
  { id: "linen-napkin", label: "מפית פשתן", icon: "🧵", desc: "מפית מקופלת בסטייל" },
  { id: "books", label: "ספרים", icon: "📚", desc: "ספרים דקורטיביים" },
  { id: "wooden-tray", label: "מגש עץ", icon: "🪵", desc: "מגש הגשה מעץ" },
];

const AdvancedToolsPanel = ({ originalImage, resultImage, onResult }: AdvancedToolsPanelProps) => {
  const [activeTool, setActiveTool] = useState<ToolMode>(null);
  const [processing, setProcessing] = useState(false);

  // Remove element
  const [removeDesc, setRemoveDesc] = useState("");

  // Shadow
  const [shadowType, setShadowType] = useState<"natural" | "reflection">("natural");

  // Text
  const [textContent, setTextContent] = useState("");
  const [textStyle, setTextStyle] = useState<"gold" | "silver">("gold");
  const [textPosition, setTextPosition] = useState("center");

  // Frame
  const [frameStyle, setFrameStyle] = useState("gold-ornate");

  // Add elements
  const [selectedElements, setSelectedElements] = useState<string[]>([]);
  const [customElementDesc, setCustomElementDesc] = useState("");

  const currentImage = resultImage || originalImage;

  const runTool = async (action: string, actionParams: Record<string, any>) => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("image-tools", {
        body: { imageBase64: currentImage, action, actionParams },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.resultImage) {
        onResult(data.resultImage);
        toast.success("הפעולה בוצעה בהצלחה!");
      }
    } catch (err: any) {
      toast.error(err.message || "שגיאה בעיבוד");
    } finally {
      setProcessing(false);
    }
  };

  const tools = [
    { id: "remove" as ToolMode, label: "מחיקת אלמנט", icon: Eraser, desc: "מחק חלקים לא רצויים" },
    { id: "shadow" as ToolMode, label: "צל ושיקוף", icon: Sun, desc: "הוסף צל או שיקוף" },
    { id: "text" as ToolMode, label: "טקסט וריקמה", icon: Type, desc: "הוסף כיתוב מוטבע" },
    { id: "frame" as ToolMode, label: "מסגרות", icon: Frame, desc: "מסגרות דקורטיביות" },
    { id: "multi-bg" as ToolMode, label: "שכפול רקעים", icon: Grid2X2, desc: "4 רקעים שונים" },
    { id: "collage" as ToolMode, label: "קולאז׳", icon: LayoutGrid, desc: "תצוגת קטלוג" },
  ];

  return (
    <div className="space-y-4">
      <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">
        כלים מתקדמים
      </h3>

      {/* Tool buttons grid */}
      {!activeTool && (
        <div className="grid grid-cols-2 gap-2">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id)}
              className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-border p-3 transition-all hover:border-gold/40 hover:shadow-md hover:bg-secondary/30"
            >
              <tool.icon className="h-5 w-5 text-gold" />
              <span className="font-display text-[10px] font-bold text-foreground">{tool.label}</span>
              <span className="font-body text-[9px] text-muted-foreground">{tool.desc}</span>
            </button>
          ))}
        </div>
      )}

      {/* Active tool panel */}
      {activeTool && (
        <div className="space-y-3">
          <button
            onClick={() => setActiveTool(null)}
            className="flex items-center gap-2 font-display text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            <span>→</span>
            חזרה לכלים
          </button>

          {/* Remove element */}
          {activeTool === "remove" && (
            <div className="space-y-3">
              <h4 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
                <Eraser className="h-4 w-4 text-gold" />
                מחיקת אלמנטים
              </h4>
              <textarea
                value={removeDesc}
                onChange={(e) => setRemoveDesc(e.target.value)}
                placeholder="תאר מה למחוק: כתם, חוט בולט, רקע לא נקי, סימן..."
                className="w-full rounded-lg border border-input bg-card p-3 font-body text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none"
                rows={3}
                dir="rtl"
              />
              <button
                onClick={() => runTool("remove-element", { description: removeDesc })}
                disabled={processing}
                className="w-full rounded-lg bg-gold py-2.5 font-display text-sm font-semibold text-gold-foreground transition-all hover:brightness-110 disabled:opacity-50"
              >
                {processing ? "מעבד..." : "מחק אלמנטים"}
              </button>
            </div>
          )}

          {/* Shadow & reflection */}
          {activeTool === "shadow" && (
            <div className="space-y-3">
              <h4 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
                <Sun className="h-4 w-4 text-gold" />
                צל ושיקוף
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {(["natural", "reflection"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setShadowType(t)}
                    className={`rounded-lg border-2 p-3 text-center transition-all ${
                      shadowType === t ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                    }`}
                  >
                    <span className="text-lg">{t === "natural" ? "☁️" : "🪞"}</span>
                    <span className="block font-body text-[10px] mt-1 text-foreground">
                      {t === "natural" ? "צל טבעי" : "שיקוף"}
                    </span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => runTool("add-shadow", { type: shadowType })}
                disabled={processing}
                className="w-full rounded-lg bg-gold py-2.5 font-display text-sm font-semibold text-gold-foreground transition-all hover:brightness-110 disabled:opacity-50"
              >
                {processing ? "מעבד..." : "הוסף צל"}
              </button>
            </div>
          )}

          {/* Text overlay */}
          {activeTool === "text" && (
            <div className="space-y-3">
              <h4 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
                <PenTool className="h-4 w-4 text-gold" />
                טקסט וריקמה
              </h4>
              <input
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="הכנס טקסט: פסח, שבת שלום..."
                className="w-full rounded-lg border border-input bg-card p-3 font-body text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                dir="rtl"
              />
              <div className="grid grid-cols-2 gap-2">
                {(["gold", "silver"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setTextStyle(s)}
                    className={`rounded-lg border-2 p-2 text-center transition-all ${
                      textStyle === s ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                    }`}
                  >
                    <span className="font-body text-xs text-foreground">
                      {s === "gold" ? "✦ ריקמת זהב" : "◇ ריקמת כסף"}
                    </span>
                  </button>
                ))}
              </div>
              <select
                value={textPosition}
                onChange={(e) => setTextPosition(e.target.value)}
                className="w-full rounded-lg border border-input bg-card p-2 font-body text-sm text-foreground"
              >
                <option value="center">מרכז</option>
                <option value="top">למעלה</option>
                <option value="bottom">למטה</option>
              </select>
              <button
                onClick={() => runTool("add-text", { text: textContent, style: textStyle, position: textPosition })}
                disabled={processing || !textContent.trim()}
                className="w-full rounded-lg bg-gold py-2.5 font-display text-sm font-semibold text-gold-foreground transition-all hover:brightness-110 disabled:opacity-50"
              >
                {processing ? "מעבד..." : "הוסף טקסט"}
              </button>
            </div>
          )}

          {/* Frames */}
          {activeTool === "frame" && (
            <div className="space-y-3">
              <h4 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
                <Frame className="h-4 w-4 text-gold" />
                מסגרות דקורטיביות
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {frameStyles.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFrameStyle(f.id)}
                    className={`rounded-lg border-2 p-2.5 text-center transition-all ${
                      frameStyle === f.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                    }`}
                  >
                    <span className="text-lg">{f.icon}</span>
                    <span className="block font-body text-[9px] mt-1 text-foreground">{f.label}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => runTool("add-frame", { frameStyle })}
                disabled={processing}
                className="w-full rounded-lg bg-gold py-2.5 font-display text-sm font-semibold text-gold-foreground transition-all hover:brightness-110 disabled:opacity-50"
              >
                {processing ? "מעבד..." : "הוסף מסגרת"}
              </button>
            </div>
          )}

          {/* Multi background */}
          {activeTool === "multi-bg" && (
            <div className="space-y-3">
              <h4 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
                <Grid2X2 className="h-4 w-4 text-gold" />
                שכפול על רקעים שונים
              </h4>
              <p className="font-body text-xs text-muted-foreground">
                יוצר 4 גרסאות של המוצר על רקעים שונים: שיש, עץ, פשתן, ירוק — בלחיצה אחת
              </p>
              <button
                onClick={() => runTool("multi-background", {})}
                disabled={processing}
                className="w-full rounded-lg bg-gold py-2.5 font-display text-sm font-semibold text-gold-foreground transition-all hover:brightness-110 disabled:opacity-50"
              >
                {processing ? "מעבד..." : "צור 4 גרסאות"}
              </button>
            </div>
          )}

          {/* Collage */}
          {activeTool === "collage" && (
            <div className="space-y-3">
              <h4 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-gold" />
                קולאז׳ מוצרים
              </h4>
              <p className="font-body text-xs text-muted-foreground">
                יוצר תצוגת קטלוג יוקרתית עם אביזרים דקורטיביים — צלחת זהב, ירק, מפית פשתן
              </p>
              <button
                onClick={() => runTool("collage", {})}
                disabled={processing}
                className="w-full rounded-lg bg-gold py-2.5 font-display text-sm font-semibold text-gold-foreground transition-all hover:brightness-110 disabled:opacity-50"
              >
                {processing ? "מעבד..." : "צור קולאז׳"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdvancedToolsPanel;
