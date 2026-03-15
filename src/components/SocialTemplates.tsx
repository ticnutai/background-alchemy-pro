import { useState, useRef } from "react";
import { toast } from "sonner";
import { Download, X, Palette, Type, Move } from "lucide-react";
import studioLogo from "@/assets/studio-logo.png";

interface SocialTemplatesProps {
  imageUrl: string;
  onClose: () => void;
}

const templates = [
  { id: "ig-square", label: "Instagram פוסט", w: 1080, h: 1080, icon: "📸", platform: "instagram" },
  { id: "ig-story", label: "Instagram סטורי", w: 1080, h: 1920, icon: "📱", platform: "instagram" },
  { id: "ig-reel", label: "Instagram ריל", w: 1080, h: 1920, icon: "🎬", platform: "instagram" },
  { id: "fb-post", label: "Facebook פוסט", w: 1200, h: 630, icon: "📘", platform: "facebook" },
  { id: "fb-cover", label: "Facebook כיסוי", w: 820, h: 312, icon: "🖼️", platform: "facebook" },
  { id: "pin", label: "Pinterest", w: 1000, h: 1500, icon: "📌", platform: "pinterest" },
  { id: "twitter", label: "Twitter/X פוסט", w: 1200, h: 675, icon: "🐦", platform: "twitter" },
  { id: "linkedin", label: "LinkedIn פוסט", w: 1200, h: 627, icon: "💼", platform: "linkedin" },
  { id: "tiktok", label: "TikTok כיסוי", w: 1080, h: 1920, icon: "🎵", platform: "tiktok" },
  { id: "whatsapp", label: "WhatsApp סטטוס", w: 1080, h: 1920, icon: "💬", platform: "whatsapp" },
  { id: "etsy", label: "Etsy מוצר", w: 2700, h: 2025, icon: "🛍️", platform: "etsy" },
  { id: "amazon", label: "Amazon ליסטינג", w: 2000, h: 2000, icon: "📦", platform: "amazon" },
];

const bgColors = [
  { value: "#f5f0e8", label: "קרם" },
  { value: "#ffffff", label: "לבן" },
  { value: "#1a1a1a", label: "שחור" },
  { value: "#f0f4f8", label: "תכלת" },
  { value: "#fdf2f8", label: "ורוד" },
  { value: "#f0fdf4", label: "מנטה" },
  { value: "#fefce8", label: "צהבהב" },
  { value: "#0c0c0c", label: "כהה" },
];

const fontOptions = [
  { value: "serif", label: "סריף" },
  { value: "sans-serif", label: "סנס" },
  { value: "monospace", label: "מונו" },
];

type TextPosition = "bottom" | "top" | "center";

const SocialTemplates = ({ imageUrl, onClose }: SocialTemplatesProps) => {
  const [selectedTemplate, setSelectedTemplate] = useState(templates[0]);
  const [brandText, setBrandText] = useState("סטודיו רותי פרל");
  const [addWatermark, setAddWatermark] = useState(true);
  const [bgColor, setBgColor] = useState("#f5f0e8");
  const [textColor, setTextColor] = useState("#8b7355");
  const [font, setFont] = useState("serif");
  const [textPosition, setTextPosition] = useState<TextPosition>("bottom");
  const [fontSize, setFontSize] = useState(2.5); // % of canvas width
  const [addShadow, setAddShadow] = useState(true);
  const [addBorder, setAddBorder] = useState(false);
  const [subtitle, setSubtitle] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generateTemplate = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = selectedTemplate.w;
    canvas.height = selectedTemplate.h;
    const ctx = canvas.getContext("2d")!;

    // Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Optional border
    if (addBorder) {
      ctx.strokeStyle = textColor;
      ctx.lineWidth = canvas.width * 0.01;
      ctx.strokeRect(canvas.width * 0.02, canvas.height * 0.02, canvas.width * 0.96, canvas.height * 0.96);
    }

    // Load product image
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = imageUrl;
    });

    // Center product image with padding
    const padding = canvas.width * 0.08;
    const textSpace = addWatermark ? canvas.height * 0.08 : 0;
    const topSpace = textPosition === "top" ? textSpace : 0;
    const bottomSpace = textPosition === "bottom" ? textSpace : 0;
    const availW = canvas.width - padding * 2;
    const availH = canvas.height - padding * 2 - topSpace - bottomSpace;
    const scale = Math.min(availW / img.naturalWidth, availH / img.naturalHeight);
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const x = (canvas.width - drawW) / 2;
    const y = topSpace + padding + (availH - drawH) / 2;

    // Shadow
    if (addShadow) {
      ctx.shadowColor = "rgba(0,0,0,0.15)";
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = 10;
    }
    ctx.drawImage(img, x, y, drawW, drawH);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Brand text / watermark
    if (addWatermark && brandText) {
      const textFontSize = Math.round(canvas.width * (fontSize / 100));
      ctx.textAlign = "center";
      ctx.fillStyle = textColor;
      ctx.font = `${textFontSize}px ${font}`;

      let textY: number;
      if (textPosition === "top") {
        textY = padding + textFontSize;
      } else if (textPosition === "center") {
        textY = canvas.height / 2 + drawH / 2 + textFontSize + 20;
      } else {
        textY = canvas.height - padding;
      }
      ctx.fillText(brandText, canvas.width / 2, textY);

      // Subtitle
      if (subtitle) {
        ctx.font = `${Math.round(textFontSize * 0.6)}px ${font}`;
        ctx.fillStyle = textColor + "99";
        ctx.fillText(subtitle, canvas.width / 2, textY + textFontSize * 0.8);
      }
    }

    // Download
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), "image/png", 1)
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedTemplate.id}-${Date.now()}.png`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("תבנית הורדה בהצלחה!");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 backdrop-blur-sm p-4" dir="rtl">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-display text-lg font-bold text-foreground">תבניות לרשתות חברתיות</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-secondary transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Template selection */}
          <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTemplate(t)}
                className={`flex flex-col items-center gap-1 rounded-xl border-2 p-2 transition-all ${
                  selectedTemplate.id === t.id
                    ? "border-gold bg-gold/5 shadow-md"
                    : "border-border hover:border-gold/40"
                }`}
              >
                <span className="text-lg">{t.icon}</span>
                <span className="font-display text-[9px] font-bold text-foreground leading-tight text-center">{t.label}</span>
                <span className="font-body text-[8px] text-muted-foreground">{t.w}×{t.h}</span>
              </button>
            ))}
          </div>

          {/* Preview */}
          <div className="flex justify-center">
            <div
              className="border border-border rounded-lg overflow-hidden bg-secondary/30"
              style={{
                width: 200,
                height: 200 * (selectedTemplate.h / selectedTemplate.w),
                maxHeight: 300,
              }}
            >
              <img
                src={imageUrl}
                alt="preview"
                className="w-full h-full object-contain p-4"
              />
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3">
            {/* Background Color */}
            <div>
              <label className="font-accent text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                <Palette className="h-3 w-3" /> צבע רקע
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {bgColors.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setBgColor(c.value)}
                    className={`h-7 w-7 rounded-full border-2 transition-all ${bgColor === c.value ? "border-gold scale-110 shadow-md" : "border-border hover:border-gold/40"}`}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                  />
                ))}
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="h-7 w-7 rounded-full cursor-pointer border-2 border-border"
                  title="צבע מותאם"
                />
              </div>
            </div>

            {/* Text */}
            <div>
              <label className="font-accent text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Type className="h-3 w-3" /> טקסט מיתוג
              </label>
              <input
                value={brandText}
                onChange={(e) => setBrandText(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-1.5 font-body text-sm text-foreground focus:border-gold/50 focus:outline-none"
              />
            </div>

            {/* Subtitle */}
            <div>
              <label className="font-accent text-xs text-muted-foreground mb-1 block">כותרת משנה (אופציונלי)</label>
              <input
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="תיאור מוצר, מחיר..."
                className="w-full rounded-lg border border-border bg-background px-3 py-1.5 font-body text-sm text-foreground placeholder:text-muted-foreground focus:border-gold/50 focus:outline-none"
              />
            </div>

            {/* Text styling row */}
            <div className="flex gap-2">
              {/* Text color */}
              <div className="flex-1">
                <label className="font-accent text-[10px] text-muted-foreground mb-1 block">צבע טקסט</label>
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="h-8 w-full rounded-lg cursor-pointer border border-border"
                />
              </div>
              {/* Font */}
              <div className="flex-1">
                <label className="font-accent text-[10px] text-muted-foreground mb-1 block">גופן</label>
                <select
                  value={font}
                  onChange={(e) => setFont(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5 font-body text-xs text-foreground"
                >
                  {fontOptions.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
              {/* Position */}
              <div className="flex-1">
                <label className="font-accent text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                  <Move className="h-2.5 w-2.5" /> מיקום
                </label>
                <select
                  value={textPosition}
                  onChange={(e) => setTextPosition(e.target.value as TextPosition)}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5 font-body text-xs text-foreground"
                >
                  <option value="bottom">למטה</option>
                  <option value="top">למעלה</option>
                  <option value="center">מרכז</option>
                </select>
              </div>
            </div>

            {/* Toggles */}
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={addWatermark} onChange={(e) => setAddWatermark(e.target.checked)} className="rounded border-border" />
                <span className="font-body text-xs text-foreground">חתימה/מיתוג</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={addShadow} onChange={(e) => setAddShadow(e.target.checked)} className="rounded border-border" />
                <span className="font-body text-xs text-foreground">צל</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={addBorder} onChange={(e) => setAddBorder(e.target.checked)} className="rounded border-border" />
                <span className="font-body text-xs text-foreground">מסגרת</span>
              </label>
            </div>
          </div>

          <button
            onClick={generateTemplate}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-gold py-3 font-display text-sm font-semibold text-gold-foreground transition-all hover:brightness-110"
          >
            <Download className="h-4 w-4" />
            הורד תבנית
          </button>
        </div>
      </div>
    </div>
  );
};

export default SocialTemplates;
