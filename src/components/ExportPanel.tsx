import { useState, useRef, memo } from "react";
import { Download, FileImage, FileText, Cloud, ZoomIn, Sparkles, Type, Proportions, ImageIcon, X } from "lucide-react";
import { toast } from "sonner";
import { cloudinaryOptimize, upscaleImage } from "@/lib/ai-tools";

interface ExportPanelProps {
  resultImage: string | null;
  isExporting: boolean;
  onExport: (format: string, quality: number, options?: ExportOptions) => void;
  onResult?: (img: string) => void;
}

export interface ExportOptions {
  watermark?: string;
  watermarkPosition?: "bottom-center" | "bottom-right" | "bottom-left";
  watermarkOpacity?: number;
  watermarkImage?: string;
  resizeWidth?: number;
  resizeHeight?: number;
  maintainAspect?: boolean;
}

const formats = [
  { id: "png", label: "PNG", desc: "Lossless, שקיפות", icon: FileImage },
  { id: "tiff", label: "TIFF", desc: "הכי איכותי, הדפסה", icon: FileImage },
  { id: "jpg", label: "JPG", desc: "קובץ קטן, שיתוף", icon: FileImage },
  { id: "webp", label: "WebP", desc: "מודרני, אינטרנט", icon: FileImage },
  { id: "pdf", label: "PDF", desc: "מסמך, הדפסה", icon: FileText },
];

const qualityOptions = [
  { value: 100, label: "מקסימום" },
  { value: 95, label: "גבוהה מאוד" },
  { value: 90, label: "גבוהה" },
  { value: 80, label: "טובה" },
];

const quickExportPresets = [
  { id: "web-fast", label: "Web מהיר", format: "webp", quality: 82, resizeWidth: 1600, resizeHeight: undefined as number | undefined, maintainAspect: true },
  { id: "marketplace", label: "Marketplace חד", format: "jpg", quality: 95, resizeWidth: 2000, resizeHeight: undefined as number | undefined, maintainAspect: true },
  { id: "print-300", label: "Print 300DPI", format: "tiff", quality: 100, resizeWidth: undefined as number | undefined, resizeHeight: undefined as number | undefined, maintainAspect: true },
];

const ExportPanel = memo(({ resultImage, isExporting, onExport, onResult }: ExportPanelProps) => {
  const [selectedFormat, setSelectedFormat] = useState("png");
  const [quality, setQuality] = useState(100);
  const [isOpen, setIsOpen] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [watermark, setWatermark] = useState("");
  const [watermarkPosition, setWatermarkPosition] = useState<"bottom-center" | "bottom-right" | "bottom-left">("bottom-center");
  const [watermarkOpacity, setWatermarkOpacity] = useState(50);
  const [watermarkImage, setWatermarkImage] = useState<string | null>(null);
  const watermarkFileRef = useRef<HTMLInputElement | null>(null);
  const [resizeWidth, setResizeWidth] = useState<number | "">("");
  const [resizeHeight, setResizeHeight] = useState<number | "">("");
  const [maintainAspect, setMaintainAspect] = useState(true);

  const currentFormat = formats.find((f) => f.id === selectedFormat)!;

  return (
    <div className="space-y-4">
      <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">
        ייצוא
      </h3>

      {/* Format selection */}
      <div className="space-y-2">
        {formats.map((fmt) => (
          <button
            key={fmt.id}
            onClick={() => setSelectedFormat(fmt.id)}
            className={`flex w-full items-center gap-3 rounded-lg border-2 p-2.5 transition-all ${
              selectedFormat === fmt.id
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/40"
            }`}
          >
            <fmt.icon className={`h-4 w-4 ${selectedFormat === fmt.id ? "text-primary" : "text-muted-foreground"}`} />
            <div className="text-right flex-1">
              <span className="font-display text-sm font-semibold text-foreground">{fmt.label}</span>
              <span className="font-body text-xs text-muted-foreground mr-2">{fmt.desc}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Quality (for lossy formats) */}
      {(selectedFormat === "jpg" || selectedFormat === "webp") && (
        <div className="space-y-2">
          <span className="font-display text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            איכות
          </span>
          <div className="grid grid-cols-2 gap-2">
            {qualityOptions.map((q) => (
              <button
                key={q.value}
                onClick={() => setQuality(q.value)}
                className={`rounded-md border px-3 py-1.5 font-body text-xs font-medium transition-all ${
                  quality === q.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-foreground hover:border-primary/40"
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Cloudinary Optimize */}
      <div className="space-y-2 border-t border-border pt-3">
        <span className="font-display text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          🚀 כלים מתקדמים
        </span>
        <button
          onClick={async () => {
            if (!resultImage) return;
            setIsOptimizing(true);
            try {
              const result = await cloudinaryOptimize(resultImage, {
                optimize: true,
                enhance: true,
                format: selectedFormat === "webp" ? "webp" : selectedFormat === "jpg" ? "jpg" : "png",
              });
              toast.success(`אופטימיזציה הושלמה! (${(result.bytes / 1024).toFixed(0)}KB)`);
              window.open(result.optimizedUrl, "_blank");
            } catch (err: unknown) {
              toast.error(err instanceof Error ? err.message : "שגיאה באופטימיזציה");
            } finally {
              setIsOptimizing(false);
            }
          }}
          disabled={!resultImage || isOptimizing}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 font-display text-xs font-semibold text-foreground transition-all hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Cloud className="h-4 w-4" />
          {isOptimizing ? "מייעל..." : "Cloudinary אופטימיזציה + CDN"}
        </button>
        <button
          onClick={async () => {
            if (!resultImage || !onResult) return;
            setIsUpscaling(true);
            try {
              const result = await upscaleImage(resultImage, 4);
              onResult(result.resultImage);
              toast.success("התמונה הוגדלה פי 4! (Real-ESRGAN)");
            } catch (err: unknown) {
              toast.error(err instanceof Error ? err.message : "שגיאה בהגדלה");
            } finally {
              setIsUpscaling(false);
            }
          }}
          disabled={!resultImage || isUpscaling}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 font-display text-xs font-semibold text-foreground transition-all hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ZoomIn className="h-4 w-4" />
          {isUpscaling ? "מגדיל..." : "הגדל ×4 לפני ייצוא (AI)"}
        </button>
      </div>

      {/* Watermark */}
      <div className="space-y-2 border-t border-border pt-3">
        <span className="font-display text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Type className="h-3 w-3" /> ווטרמרק
        </span>
        <input
          value={watermark}
          onChange={(e) => setWatermark(e.target.value)}
          placeholder="סטודיו רותי פרל"
          className="w-full rounded-lg border border-border bg-background px-3 py-1.5 font-body text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
        />
        {/* Logo / image watermark */}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[11px] text-muted-foreground shrink-0">או לוגו:</span>
          {watermarkImage ? (
            <div className="flex items-center gap-1.5">
              <img src={watermarkImage} className="h-8 max-w-[80px] rounded border border-border object-contain" alt="logo" />
              <button onClick={() => setWatermarkImage(null)} className="flex h-6 w-6 items-center justify-center rounded border border-border text-muted-foreground hover:text-destructive" title="הסר">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => watermarkFileRef.current?.click()}
              className="inline-flex h-7 items-center gap-1 rounded border border-border px-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
            >
              <ImageIcon className="h-3 w-3" />
              העלה לוגו
            </button>
          )}
          <input
            ref={watermarkFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) => setWatermarkImage(ev.target?.result as string);
              reader.readAsDataURL(file);
              e.currentTarget.value = "";
            }}
          />
        </div>
        {watermark && (
          <div className="flex gap-2">
            <select
              value={watermarkPosition}
              onChange={(e) => setWatermarkPosition(e.target.value as typeof watermarkPosition)}
              className="flex-1 rounded-md border border-border bg-background px-2 py-1 font-body text-xs text-foreground"
            >
              <option value="bottom-center">מרכז למטה</option>
              <option value="bottom-right">ימין למטה</option>
              <option value="bottom-left">שמאל למטה</option>
            </select>
            <div className="flex items-center gap-1 flex-1">
              <span className="font-body text-[10px] text-muted-foreground">שקיפות</span>
              <input
                type="range"
                min={10}
                max={100}
                value={watermarkOpacity}
                onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
                className="flex-1"
              />
              <span className="font-body text-[10px] text-muted-foreground tabular-nums w-6">{watermarkOpacity}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Resize */}
      <div className="space-y-2 border-t border-border pt-3">
        <span className="font-display text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Proportions className="h-3 w-3" /> שינוי גודל (אופציונלי)
        </span>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            value={resizeWidth}
            onChange={(e) => setResizeWidth(e.target.value ? Number(e.target.value) : "")}
            placeholder="רוחב"
            className="w-20 rounded-md border border-border bg-background px-2 py-1 font-body text-xs text-foreground placeholder:text-muted-foreground"
          />
          <span className="text-muted-foreground text-xs">×</span>
          <input
            type="number"
            value={resizeHeight}
            onChange={(e) => setResizeHeight(e.target.value ? Number(e.target.value) : "")}
            placeholder="גובה"
            className="w-20 rounded-md border border-border bg-background px-2 py-1 font-body text-xs text-foreground placeholder:text-muted-foreground"
          />
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={maintainAspect} onChange={(e) => setMaintainAspect(e.target.checked)} className="rounded border-border" />
            <span className="font-body text-[10px] text-muted-foreground">שמור יחס</span>
          </label>
        </div>
      </div>

      {/* Export button */}
      <div className="space-y-2 border-t border-border pt-3">
        <span className="font-display text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Sparkles className="h-3 w-3" /> פריסטי ייצוא מהירים
        </span>
        <div className="grid grid-cols-1 gap-2">
          {quickExportPresets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => onExport(preset.format, preset.quality, {
                watermark: watermark || undefined,
                watermarkPosition,
                watermarkOpacity,
                watermarkImage: watermarkImage || undefined,
                resizeWidth: preset.resizeWidth,
                resizeHeight: preset.resizeHeight,
                maintainAspect: preset.maintainAspect,
              })}
              disabled={!resultImage || isExporting}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 font-body text-xs text-foreground hover:border-primary/40 disabled:opacity-50"
            >
              <span>{preset.label}</span>
              <span className="text-muted-foreground">{preset.format.toUpperCase()} · {preset.quality}%</span>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => onExport(selectedFormat, quality, {
          watermark: watermark || undefined,
          watermarkPosition,
          watermarkOpacity,
          watermarkImage: watermarkImage || undefined,
          resizeWidth: typeof resizeWidth === "number" ? resizeWidth : undefined,
          resizeHeight: typeof resizeHeight === "number" ? resizeHeight : undefined,
          maintainAspect,
        })}
        disabled={!resultImage || isExporting}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-display text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Download className="h-4 w-4" />
        {isExporting ? "מייצא..." : `ייצא כ-${currentFormat.label}`}
      </button>
    </div>
  );
});

ExportPanel.displayName = "ExportPanel";

export default ExportPanel;
