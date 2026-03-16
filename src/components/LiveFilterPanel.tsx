import { useState, useCallback, useMemo } from "react";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sun, Contrast, Droplets, Thermometer, RotateCcw, Sparkles, Monitor, Maximize2 } from "lucide-react";
import { toast } from "sonner";

interface LiveFilters {
  brightness: number;
  contrast: number;
  saturation: number;
  hueRotate: number;
  sepia: number;
  blur: number;
}

const defaultFilters: LiveFilters = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hueRotate: 0,
  sepia: 0,
  blur: 0,
};

type PreviewMode = "mini" | "main" | "fullscreen";

interface LiveFilterPanelProps {
  currentImage: string;
  onPreviewFilter: (cssFilter: string) => void;
  onApply: (filters: LiveFilters) => void;
  isProcessing: boolean;
}

const sliderConfig = [
  { key: "brightness" as const, label: "בהירות", icon: Sun, min: 30, max: 200, unit: "%" },
  { key: "contrast" as const, label: "ניגודיות", icon: Contrast, min: 30, max: 200, unit: "%" },
  { key: "saturation" as const, label: "רוויה", icon: Droplets, min: 0, max: 300, unit: "%" },
  { key: "hueRotate" as const, label: "גוון (Hue)", icon: Thermometer, min: -180, max: 180, unit: "°" },
  { key: "sepia" as const, label: "ספיה", icon: Thermometer, min: 0, max: 100, unit: "%" },
  { key: "blur" as const, label: "טשטוש", icon: Thermometer, min: 0, max: 10, unit: "px" },
];

export function buildCssFilter(f: LiveFilters): string {
  return [
    `brightness(${f.brightness}%)`,
    `contrast(${f.contrast}%)`,
    `saturate(${f.saturation}%)`,
    f.hueRotate !== 0 ? `hue-rotate(${f.hueRotate}deg)` : "",
    f.sepia > 0 ? `sepia(${f.sepia}%)` : "",
    f.blur > 0 ? `blur(${f.blur}px)` : "",
  ].filter(Boolean).join(" ");
}

const previewModes: { id: PreviewMode; label: string; icon: typeof Sun }[] = [
  { id: "mini", label: "מקומי", icon: Sun },
  { id: "main", label: "תמונה ראשית", icon: Monitor },
  { id: "fullscreen", label: "מסך מלא", icon: Maximize2 },
];

const LiveFilterPanel = ({ currentImage, onPreviewFilter, onApply, isProcessing }: LiveFilterPanelProps) => {
  const [filters, setFilters] = useState<LiveFilters>({ ...defaultFilters });
  const [previewMode, setPreviewMode] = useState<PreviewMode>("mini");
  const [showFullscreen, setShowFullscreen] = useState(false);

  const isDefault = useMemo(() => JSON.stringify(filters) === JSON.stringify(defaultFilters), [filters]);

  const updateFilter = useCallback((key: keyof LiveFilters, value: number) => {
    const updated = { ...filters, [key]: value };
    setFilters(updated);
    onPreviewFilter(buildCssFilter(updated));
  }, [filters, onPreviewFilter]);

  const handleReset = useCallback(() => {
    setFilters({ ...defaultFilters });
    onPreviewFilter("");
    setShowFullscreen(false);
  }, [onPreviewFilter]);

  const handleModeChange = useCallback((mode: PreviewMode) => {
    setPreviewMode(mode);
    if (mode === "fullscreen") {
      setShowFullscreen(true);
    } else {
      setShowFullscreen(false);
    }
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-foreground">
          ⚡ פילטרים בזמן אמת
        </h3>
        {!isDefault && (
          <button onClick={handleReset} className="flex items-center gap-1 font-body text-xs text-primary hover:underline">
            <RotateCcw className="h-3 w-3" /> איפוס
          </button>
        )}
      </div>

      <p className="font-body text-[10px] text-muted-foreground">
        כוון את הסליידרים — התצוגה המקדימה מיידית. לחץ "החל עם AI" לתוצאה סופית מקצועית.
      </p>

      {/* Preview mode selector */}
      <div className="flex gap-1 rounded-lg border border-border bg-muted/50 p-1">
        {previewModes.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => handleModeChange(id)}
            className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 font-accent text-[10px] font-semibold transition-colors ${
              (previewMode === id || (id === "fullscreen" && showFullscreen))
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
      </div>

      {/* Mini preview - only when mode is "mini" */}
      {previewMode === "mini" && currentImage && (
        <div className="relative rounded-lg overflow-hidden border border-border aspect-video">
          <img
            src={currentImage}
            alt="live preview"
            className="w-full h-full object-cover transition-all duration-150"
            style={{ filter: buildCssFilter(filters) }}
          />
          {!isDefault && (
            <div className="absolute top-1 left-1 rounded bg-primary/80 px-1.5 py-0.5 font-accent text-[8px] text-primary-foreground">
              תצוגה מקדימה
            </div>
          )}
        </div>
      )}

      {/* Main image mode hint */}
      {previewMode === "main" && !isDefault && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-2 text-center">
          <p className="font-accent text-[10px] text-primary font-semibold">
            📐 התצוגה המקדימה מוחלת על התמונה הראשית
          </p>
        </div>
      )}

      {sliderConfig.map(({ key, label, icon: Icon, min, max }) => (
        <div key={key} className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Icon className="h-3 w-3 text-muted-foreground" />
              <span className="font-body text-xs text-foreground">{label}</span>
            </div>
            <span className="font-accent text-xs text-muted-foreground tabular-nums">{filters[key]}</span>
          </div>
          <Slider
            value={[filters[key]]}
            onValueChange={([v]) => updateFilter(key, v)}
            min={min}
            max={max}
            step={1}
          />
        </div>
      ))}

      <button
        onClick={() => onApply(filters)}
        disabled={isProcessing || isDefault}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-gold py-2.5 font-display text-sm font-semibold text-gold-foreground transition-all hover:brightness-110 disabled:opacity-50"
      >
        <Sparkles className="h-4 w-4" />
        {isProcessing ? "מעבד עם AI..." : "החל עם AI"}
      </button>

      {/* Fullscreen dialog */}
      <Dialog open={showFullscreen} onOpenChange={(open) => {
        setShowFullscreen(open);
        if (!open) setPreviewMode("mini");
      }}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-2">
          <div className="relative rounded-lg overflow-hidden bg-muted">
            <img
              src={currentImage}
              alt="fullscreen preview"
              className="w-full h-full object-contain max-h-[75vh] transition-all duration-150"
              style={{ filter: buildCssFilter(filters) }}
            />
            {!isDefault && (
              <div className="absolute top-2 left-2 rounded bg-primary/80 px-2 py-1 font-accent text-xs text-primary-foreground">
                תצוגה מקדימה — מסך מלא
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LiveFilterPanel;
