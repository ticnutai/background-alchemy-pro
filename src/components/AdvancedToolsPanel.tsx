import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Eraser, Sun, Type, Frame, Grid2X2, LayoutGrid, X,
  Trash2, Sparkles, PenTool, PackagePlus, Scissors,
  ZoomIn, Lightbulb, ImagePlus, Scan, Wand2
} from "lucide-react";
import {
  removeBgPrecise, upscaleImage, relightImage,
  inpaintRemove, segmentProduct, generateBgSdxl,
  lightingPresets, upscaleOptions,
} from "@/lib/ai-tools";

interface AdvancedToolsPanelProps {
  originalImage: string;
  resultImage: string | null;
  onResult: (img: string) => void;
}

type ToolMode = null | "remove" | "shadow" | "text" | "frame" | "multi-bg" | "collage" | "add-elements"
  | "remove-bg-precise" | "upscale" | "relight" | "inpaint" | "segment" | "sdxl-bg"
  | "color-grade" | "blur-bg" | "style-transfer" | "smart-crop";

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
  // שבת
  { id: "shabbat-table", label: "שולחן שבת ערוך", icon: "🕯️", desc: "נרות, חלות, יין, מפה לבנה" },
  { id: "kiddush-cups", label: "גביעי קידוש", icon: "🥂", desc: "גביעי כסף/זהב לקידוש" },
  { id: "challah-board", label: "קרש חלות", icon: "🍞", desc: "חלה קלועה על קרש עץ" },
  { id: "candles", label: "פמוטים ונרות שבת", icon: "🕯️", desc: "פמוטים דקורטיביים עם נרות דולקים" },
  { id: "wine-bottle", label: "בקבוק יין וכוס", icon: "🍷", desc: "בקבוק יין עם כוס קידוש" },
  { id: "shabbat-cloth", label: "מפת שבת", icon: "🧵", desc: "מפה לבנה/רקומה לשולחן" },

  // פסח
  { id: "seder-plate", label: "קערת סדר", icon: "🍽️", desc: "קערת סדר עם כל הסימנים" },
  { id: "matzah-stack", label: "מצות", icon: "🫓", desc: "ערימת מצות מסודרת" },
  { id: "charoset-bowl", label: "קערת חרוסת", icon: "🥣", desc: "קערית חרוסת מעוצבת" },
  { id: "maror-herbs", label: "מרור ועשבי תיבול", icon: "🌿", desc: "עלי חסה/עשבי תיבול טריים" },
  { id: "salt-water", label: "קערית מי מלח", icon: "💧", desc: "קערית זכוכית קטנה" },
  { id: "afikoman-bag", label: "שקית אפיקומן", icon: "🎁", desc: "שקית בד לאפיקומן" },
  { id: "haggadah-books", label: "ספרי הגדה", icon: "📚", desc: "הגדות פתוחות לצד המוצר" },
  { id: "passover-wine-set", label: "סט יין לפסח", icon: "🍷", desc: "בקבוק יין, גביעים וקנקן" },

  // כללי
  { id: "flowers", label: "סידור פרחים", icon: "💐", desc: "זר פרחים אלגנטי" },
  { id: "gold-plate", label: "צלחת זהב", icon: "🍽️", desc: "צלחת הגשה מוזהבת" },
  { id: "greenery", label: "ירוק וצמחים", icon: "🌿", desc: "ענפי ירק, אקליפטוס" },
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

  // New AI tools state
  const [upscaleScale, setUpscaleScale] = useState(4);
  const [selectedLighting, setSelectedLighting] = useState(lightingPresets[0].id);
  const [customLightingPrompt, setCustomLightingPrompt] = useState("");
  const [sdxlPrompt, setSdxlPrompt] = useState("");
  const [sdxlStrength, setSdxlStrength] = useState(0.85);
  const [segmentQuery, setSegmentQuery] = useState("");

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
    { id: "add-elements" as ToolMode, label: "הוספת אלמנטים", icon: PackagePlus, desc: "גביעים, נרות, פרחים..." },
    { id: "remove" as ToolMode, label: "מחיקת אלמנט", icon: Eraser, desc: "מחק חלקים לא רצויים" },
    { id: "shadow" as ToolMode, label: "צל ושיקוף", icon: Sun, desc: "הוסף צל או שיקוף" },
    { id: "text" as ToolMode, label: "טקסט וריקמה", icon: Type, desc: "הוסף כיתוב מוטבע" },
    { id: "frame" as ToolMode, label: "מסגרות", icon: Frame, desc: "מסגרות דקורטיביות" },
    { id: "multi-bg" as ToolMode, label: "שכפול רקעים", icon: Grid2X2, desc: "4 רקעים שונים" },
    { id: "collage" as ToolMode, label: "קולאז׳", icon: LayoutGrid, desc: "תצוגת קטלוג" },
    { id: "remove-bg-precise" as ToolMode, label: "הסרת רקע מדויקת", icon: Scissors, desc: "BRIA RMBG 2.0" },
    { id: "upscale" as ToolMode, label: "הגדלת רזולוציה", icon: ZoomIn, desc: "Real-ESRGAN AI" },
    { id: "relight" as ToolMode, label: "תאורה מחדש", icon: Lightbulb, desc: "IC-Light AI" },
    { id: "inpaint" as ToolMode, label: "מחיקה חכמה", icon: Wand2, desc: "LaMa Inpainting" },
    { id: "sdxl-bg" as ToolMode, label: "רקע SDXL", icon: ImagePlus, desc: "Stable Diffusion XL" },
    { id: "segment" as ToolMode, label: "סגמנטציה", icon: Scan, desc: "SAM 2 + DINO" },
  ];

  const toggleElement = (id: string) => {
    setSelectedElements(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

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

          {/* Add Elements */}
          {activeTool === "add-elements" && (
            <div className="space-y-3">
              <h4 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
                <PackagePlus className="h-4 w-4 text-gold" />
                הוספת אלמנטים לתמונה
              </h4>
              <p className="font-body text-xs text-muted-foreground">
                בחר אלמנטים להוסיף סביב המוצר — הם יתווספו בצורה טבעית ואלגנטית
              </p>

              <div className="grid grid-cols-2 gap-1.5">
                {elementPresets.map((el) => (
                  <button
                    key={el.id}
                    onClick={() => toggleElement(el.id)}
                    className={`flex items-center gap-2 rounded-lg border-2 p-2 text-right transition-all ${
                      selectedElements.includes(el.id)
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <span className="text-base shrink-0">{el.icon}</span>
                    <div className="min-w-0">
                      <span className="block font-display text-[10px] font-bold text-foreground truncate">{el.label}</span>
                      <span className="block font-body text-[8px] text-muted-foreground truncate">{el.desc}</span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="pt-2 border-t border-border">
                <label className="font-body text-xs text-muted-foreground mb-1 block">
                  או תאר אלמנטים משלך:
                </label>
                <textarea
                  value={customElementDesc}
                  onChange={(e) => setCustomElementDesc(e.target.value)}
                  placeholder="לדוגמה: מגש כסף עם עוגיות, כוס תה עם צלוחית..."
                  className="w-full rounded-lg border border-input bg-card p-3 font-body text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none"
                  rows={2}
                  dir="rtl"
                />
              </div>

              {selectedElements.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedElements.map((id) => {
                    const el = elementPresets.find(e => e.id === id);
                    return (
                      <span key={id} className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-body text-[10px] text-primary">
                        {el?.icon} {el?.label}
                        <button onClick={() => toggleElement(id)} className="hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              <button
                onClick={() => {
                  const chosenLabels = selectedElements
                    .map(id => elementPresets.find(e => e.id === id))
                    .filter(Boolean)
                    .map(e => `${e!.label} (${e!.desc})`);
                  const allElements = [
                    ...chosenLabels,
                    ...(customElementDesc.trim() ? [customElementDesc.trim()] : []),
                  ];
                  if (allElements.length === 0) {
                    toast.error("יש לבחור לפחות אלמנט אחד");
                    return;
                  }
                  runTool("add-elements", { elements: allElements.join(", ") });
                }}
                disabled={processing || (selectedElements.length === 0 && !customElementDesc.trim())}
                className="w-full rounded-lg bg-gold py-2.5 font-display text-sm font-semibold text-gold-foreground transition-all hover:brightness-110 disabled:opacity-50"
              >
                {processing ? "מעבד..." : `הוסף ${selectedElements.length + (customElementDesc.trim() ? 1 : 0)} אלמנטים`}
              </button>
            </div>
          )}

          {/* Remove Background Precise (BRIA RMBG 2.0) */}
          {activeTool === "remove-bg-precise" && (
            <div className="space-y-3">
              <h4 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
                <Scissors className="h-4 w-4 text-gold" />
                הסרת רקע מדויקת
              </h4>
              <p className="font-body text-xs text-muted-foreground">
                הסרת רקע מדויקת במיוחד באמצעות מודל BRIA RMBG 2.0 — מושלם למוצרים עם קצוות מורכבים
              </p>
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <p className="font-body text-xs text-primary">
                  💡 מודל ייעודי להסרת רקע (לא generative) — תוצאות מדויקות יותר מ-Gemini
                </p>
              </div>
              <button
                onClick={async () => {
                  setProcessing(true);
                  try {
                    const result = await removeBgPrecise(currentImage);
                    onResult(result.resultImage);
                    toast.success("הרקע הוסר בהצלחה! (BRIA RMBG 2.0)");
                  } catch (err: any) {
                    toast.error(err.message || "שגיאה בהסרת הרקע");
                  } finally {
                    setProcessing(false);
                  }
                }}
                disabled={processing}
                className="w-full rounded-lg bg-gold py-2.5 font-display text-sm font-semibold text-gold-foreground transition-all hover:brightness-110 disabled:opacity-50"
              >
                {processing ? "מסיר רקע..." : "הסר רקע (BRIA)"}
              </button>
            </div>
          )}

          {/* Upscale (Real-ESRGAN) */}
          {activeTool === "upscale" && (
            <div className="space-y-3">
              <h4 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
                <ZoomIn className="h-4 w-4 text-gold" />
                הגדלת רזולוציה AI
              </h4>
              <p className="font-body text-xs text-muted-foreground">
                הגדלת רזולוציה חכמה עם Real-ESRGAN — מושלם להדפסה באיכות גבוהה
              </p>
              <div className="grid grid-cols-2 gap-2">
                {upscaleOptions.map((opt) => (
                  <button
                    key={opt.scale}
                    onClick={() => setUpscaleScale(opt.scale)}
                    className={`rounded-lg border-2 p-3 text-center transition-all ${
                      upscaleScale === opt.scale ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                    }`}
                  >
                    <span className="text-lg font-bold text-foreground">{opt.label}</span>
                    <span className="block font-body text-[10px] mt-1 text-muted-foreground">{opt.desc}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={async () => {
                  setProcessing(true);
                  try {
                    const result = await upscaleImage(currentImage, upscaleScale);
                    onResult(result.resultImage);
                    toast.success(`התמונה הוגדלה פי ${result.scale}!`);
                  } catch (err: any) {
                    toast.error(err.message || "שגיאה בהגדלה");
                  } finally {
                    setProcessing(false);
                  }
                }}
                disabled={processing}
                className="w-full rounded-lg bg-gold py-2.5 font-display text-sm font-semibold text-gold-foreground transition-all hover:brightness-110 disabled:opacity-50"
              >
                {processing ? "מגדיל..." : `הגדל רזולוציה ${upscaleScale}×`}
              </button>
            </div>
          )}

          {/* Relight (IC-Light) */}
          {activeTool === "relight" && (
            <div className="space-y-3">
              <h4 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-gold" />
                תאורה מחדש — IC-Light
              </h4>
              <p className="font-body text-xs text-muted-foreground">
                שנה את התאורה של המוצר כך שתתאים לרקע — ההבדל בין תוצאה חובבנית למקצועית
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {lightingPresets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => setSelectedLighting(preset.id)}
                    className={`rounded-lg border-2 p-2 text-right transition-all ${
                      selectedLighting === preset.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                    }`}
                  >
                    <span className="block font-display text-[10px] font-bold text-foreground">{preset.label}</span>
                  </button>
                ))}
              </div>
              <div className="pt-2 border-t border-border">
                <label className="font-body text-xs text-muted-foreground mb-1 block">
                  או תאר תאורה מותאמת:
                </label>
                <input
                  value={customLightingPrompt}
                  onChange={(e) => setCustomLightingPrompt(e.target.value)}
                  placeholder="לדוגמה: תאורה חמה מהחלון..."
                  className="w-full rounded-lg border border-input bg-card p-2 font-body text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  dir="rtl"
                />
              </div>
              <button
                onClick={async () => {
                  setProcessing(true);
                  try {
                    const prompt = customLightingPrompt.trim() || lightingPresets.find(p => p.id === selectedLighting)?.prompt;
                    const result = await relightImage(currentImage, prompt);
                    onResult(result.resultImage);
                    toast.success("התאורה שונתה בהצלחה!");
                  } catch (err: any) {
                    toast.error(err.message || "שגיאה בשינוי תאורה");
                  } finally {
                    setProcessing(false);
                  }
                }}
                disabled={processing}
                className="w-full rounded-lg bg-gold py-2.5 font-display text-sm font-semibold text-gold-foreground transition-all hover:brightness-110 disabled:opacity-50"
              >
                {processing ? "מעבד תאורה..." : "שנה תאורה"}
              </button>
            </div>
          )}

          {/* Inpaint Remove (LaMa) */}
          {activeTool === "inpaint" && (
            <div className="space-y-3">
              <h4 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-gold" />
                מחיקה חכמה — LaMa
              </h4>
              <p className="font-body text-xs text-muted-foreground">
                מחיקת אלמנטים ומילוי חכם באמצעות LaMa — תוצאות נקיות ומדויקות
              </p>
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <p className="font-body text-xs text-primary">
                  🎯 מודל ייעודי — עדיף ל: כתמים, חוטים, שריטות, סימנים לא רצויים
                </p>
              </div>
              <button
                onClick={async () => {
                  setProcessing(true);
                  try {
                    const result = await inpaintRemove(currentImage);
                    onResult(result.resultImage);
                    toast.success("האלמנטים הוסרו בהצלחה!");
                  } catch (err: any) {
                    toast.error(err.message || "שגיאה במחיקה");
                  } finally {
                    setProcessing(false);
                  }
                }}
                disabled={processing}
                className="w-full rounded-lg bg-gold py-2.5 font-display text-sm font-semibold text-gold-foreground transition-all hover:brightness-110 disabled:opacity-50"
              >
                {processing ? "מוחק..." : "מחק חכם (LaMa)"}
              </button>
            </div>
          )}

          {/* SDXL Background Generation */}
          {activeTool === "sdxl-bg" && (
            <div className="space-y-3">
              <h4 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
                <ImagePlus className="h-4 w-4 text-gold" />
                רקע SDXL — Stable Diffusion
              </h4>
              <p className="font-body text-xs text-muted-foreground">
                יצירת רקע עם Stable Diffusion XL — שליטה מלאה בתוצאה עם Inpainting
              </p>
              <textarea
                value={sdxlPrompt}
                onChange={(e) => setSdxlPrompt(e.target.value)}
                placeholder="תאר את הרקע: White marble surface with gold veins, studio lighting..."
                className="w-full rounded-lg border border-input bg-card p-3 font-body text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none"
                rows={3}
                dir="ltr"
              />
              <div className="space-y-1">
                <label className="font-body text-xs text-muted-foreground">
                  עוצמת שינוי: {Math.round(sdxlStrength * 100)}%
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="1"
                  step="0.05"
                  value={sdxlStrength}
                  onChange={(e) => setSdxlStrength(parseFloat(e.target.value))}
                  className="w-full accent-gold"
                />
                <div className="flex justify-between font-body text-[9px] text-muted-foreground">
                  <span>שמרני</span>
                  <span>מלא</span>
                </div>
              </div>
              <button
                onClick={async () => {
                  if (!sdxlPrompt.trim()) {
                    toast.error("יש לתאר את הרקע הרצוי");
                    return;
                  }
                  setProcessing(true);
                  try {
                    const result = await generateBgSdxl(currentImage, sdxlPrompt, undefined, sdxlStrength);
                    onResult(result.resultImage);
                    toast.success("הרקע נוצר בהצלחה! (SDXL)");
                  } catch (err: any) {
                    toast.error(err.message || "שגיאה ביצירת רקע");
                  } finally {
                    setProcessing(false);
                  }
                }}
                disabled={processing || !sdxlPrompt.trim()}
                className="w-full rounded-lg bg-gold py-2.5 font-display text-sm font-semibold text-gold-foreground transition-all hover:brightness-110 disabled:opacity-50"
              >
                {processing ? "יוצר רקע..." : "צור רקע (SDXL)"}
              </button>
            </div>
          )}

          {/* Segment Product (SAM 2 + Grounding DINO) */}
          {activeTool === "segment" && (
            <div className="space-y-3">
              <h4 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
                <Scan className="h-4 w-4 text-gold" />
                סגמנטציה — SAM 2 + DINO
              </h4>
              <p className="font-body text-xs text-muted-foreground">
                זיהוי וחיתוך מדויק של המוצר מהרקע — Grounding DINO מזהה + SAM 2 חותך
              </p>
              <input
                value={segmentQuery}
                onChange={(e) => setSegmentQuery(e.target.value)}
                placeholder="מה לזהות: product, cup, tablecloth..."
                className="w-full rounded-lg border border-input bg-card p-2 font-body text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                dir="ltr"
              />
              <button
                onClick={async () => {
                  setProcessing(true);
                  try {
                    const result = await segmentProduct(currentImage, segmentQuery || undefined);
                    toast.success("הסגמנטציה הושלמה! המוצר זוהה וחותך");
                    // If segmentation returns a mask/cutout image, apply it
                    if (result.segmentation) {
                      const outputUrl = Array.isArray(result.segmentation) ? result.segmentation[0] : result.segmentation;
                      if (typeof outputUrl === "string") {
                        onResult(outputUrl);
                      }
                    }
                  } catch (err: any) {
                    toast.error(err.message || "שגיאה בסגמנטציה");
                  } finally {
                    setProcessing(false);
                  }
                }}
                disabled={processing}
                className="w-full rounded-lg bg-gold py-2.5 font-display text-sm font-semibold text-gold-foreground transition-all hover:brightness-110 disabled:opacity-50"
              >
                {processing ? "מנתח..." : "זהה וחתוך מוצר"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdvancedToolsPanel;
