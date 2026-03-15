import { useState, useCallback, useMemo } from "react";
import { Slider } from "@/components/ui/slider";
import { Sun, Contrast, Droplets, Thermometer, RotateCcw, Sparkles } from "lucide-react";
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

const LiveFilterPanel = ({ currentImage, onPreviewFilter, onApply, isProcessing }: LiveFilterPanelProps) => {
  const [filters, setFilters] = useState<LiveFilters>({ ...defaultFilters });

  const isDefault = useMemo(() => JSON.stringify(filters) === JSON.stringify(defaultFilters), [filters]);

  const updateFilter = useCallback((key: keyof LiveFilters, value: number) => {
    const updated = { ...filters, [key]: value };
    setFilters(updated);
    onPreviewFilter(buildCssFilter(updated));
  }, [filters, onPreviewFilter]);

  const handleReset = useCallback(() => {
    setFilters({ ...defaultFilters });
    onPreviewFilter("");
  }, [onPreviewFilter]);

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

      {/* Mini preview */}
      {currentImage && (
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
    </div>
  );
};

export default LiveFilterPanel;
