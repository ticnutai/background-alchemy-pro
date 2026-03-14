import { useState, useRef } from "react";
import { toast } from "sonner";
import { Download, X, Instagram, Facebook } from "lucide-react";
import studioLogo from "@/assets/studio-logo.png";

interface SocialTemplatesProps {
  imageUrl: string;
  onClose: () => void;
}

const templates = [
  { id: "ig-square", label: "Instagram פוסט", w: 1080, h: 1080, icon: "📸", platform: "instagram" },
  { id: "ig-story", label: "Instagram סטורי", w: 1080, h: 1920, icon: "📱", platform: "instagram" },
  { id: "fb-post", label: "Facebook פוסט", w: 1200, h: 630, icon: "📘", platform: "facebook" },
  { id: "pin", label: "Pinterest", w: 1000, h: 1500, icon: "📌", platform: "pinterest" },
];

const SocialTemplates = ({ imageUrl, onClose }: SocialTemplatesProps) => {
  const [selectedTemplate, setSelectedTemplate] = useState(templates[0]);
  const [brandText, setBrandText] = useState("סטודיו רותי פרל");
  const [addWatermark, setAddWatermark] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generateTemplate = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = selectedTemplate.w;
    canvas.height = selectedTemplate.h;
    const ctx = canvas.getContext("2d")!;

    // Background
    ctx.fillStyle = "#f5f0e8";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

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
    const availW = canvas.width - padding * 2;
    const availH = canvas.height - padding * 2 - (addWatermark ? 80 : 0);
    const scale = Math.min(availW / img.naturalWidth, availH / img.naturalHeight);
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const x = (canvas.width - drawW) / 2;
    const y = padding + (availH - drawH) / 2;

    // Subtle border
    ctx.shadowColor = "rgba(0,0,0,0.1)";
    ctx.shadowBlur = 20;
    ctx.drawImage(img, x, y, drawW, drawH);
    ctx.shadowBlur = 0;

    // Brand text / watermark
    if (addWatermark && brandText) {
      const bottomY = canvas.height - 30;
      ctx.textAlign = "center";
      ctx.fillStyle = "#8b7355";
      ctx.font = `${Math.round(canvas.width * 0.025)}px serif`;
      ctx.fillText(brandText, canvas.width / 2, bottomY);
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
          <div className="grid grid-cols-4 gap-2">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTemplate(t)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-all ${
                  selectedTemplate.id === t.id
                    ? "border-gold bg-gold/5 shadow-md"
                    : "border-border hover:border-gold/40"
                }`}
              >
                <span className="text-xl">{t.icon}</span>
                <span className="font-display text-[10px] font-bold text-foreground">{t.label}</span>
                <span className="font-body text-[9px] text-muted-foreground">{t.w}×{t.h}</span>
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
            <div>
              <label className="font-accent text-xs text-muted-foreground mb-1 block">טקסט מיתוג</label>
              <input
                value={brandText}
                onChange={(e) => setBrandText(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 font-body text-sm text-foreground focus:border-gold/50 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={addWatermark}
                onChange={(e) => setAddWatermark(e.target.checked)}
                id="watermark"
                className="rounded border-border"
              />
              <label htmlFor="watermark" className="font-body text-sm text-foreground">הוסף חתימה/מיתוג</label>
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
