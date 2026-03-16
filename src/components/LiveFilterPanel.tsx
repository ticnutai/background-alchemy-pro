import { useState, useCallback, useMemo } from "react";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sun, Contrast, Droplets, Thermometer, RotateCcw, Sparkles, Monitor, Maximize2, Save, Trash2, Star } from "lucide-react";
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

interface SavedFilterPreset {
  id: string;
  name: string;
  filters: LiveFilters;
}

const PRESETS_KEY = "live-filter-presets";

function getSavedPresets(): SavedFilterPreset[] {
  try {
    return JSON.parse(localStorage.getItem(PRESETS_KEY) || "[]");
  } catch { return []; }
}

function persistPresets(presets: SavedFilterPreset[]) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

const builtInPresets: { name: string; filters: LiveFilters }[] = [
  { name: "חם ורך", filters: { brightness: 105, contrast: 95, saturation: 120, hueRotate: 10, sepia: 15, blur: 0 } },
  { name: "קריר דרמטי", filters: { brightness: 95, contrast: 130, saturation: 80, hueRotate: -15, sepia: 0, blur: 0 } },
  { name: "וינטג׳", filters: { brightness: 105, contrast: 90, saturation: 70, hueRotate: 5, sepia: 40, blur: 0 } },
  { name: "שחור-לבן", filters: { brightness: 110, contrast: 120, saturation: 0, hueRotate: 0, sepia: 0, blur: 0 } },
  { name: "חד וחזק", filters: { brightness: 100, contrast: 140, saturation: 130, hueRotate: 0, sepia: 0, blur: 0 } },
  { name: "רך חלומי", filters: { brightness: 110, contrast: 85, saturation: 90, hueRotate: 0, sepia: 10, blur: 1 } },
];

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
  const [savedPresets, setSavedPresets] = useState<SavedFilterPreset[]>(getSavedPresets);
  const [presetName, setPresetName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);

  const isDefault = useMemo(() => JSON.stringify(filters) === JSON.stringify(defaultFilters), [filters]);

  const updateFilter = useCallback((key: keyof LiveFilters, value: number) => {
    const updated = { ...filters, [key]: value };
    setFilters(updated);
    onPreviewFilter(buildCssFilter(updated));
  }, [filters, onPreviewFilter]);

  const applyPreset = useCallback((f: LiveFilters) => {
    setFilters({ ...f });
    onPreviewFilter(buildCssFilter(f));
  }, [onPreviewFilter]);

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

  const savePreset = useCallback(() => {
    if (!presetName.trim()) { toast.error("הכנס שם לפריסט"); return; }
    const newPreset: SavedFilterPreset = { id: Date.now().toString(), name: presetName.trim(), filters: { ...filters } };
    const updated = [...savedPresets, newPreset];
    setSavedPresets(updated);
    persistPresets(updated);
    setPresetName("");
    setShowSaveInput(false);
    toast.success(`פריסט "${newPreset.name}" נשמר!`);
  }, [presetName, filters, savedPresets]);

  const deletePreset = useCallback((id: string) => {
    const updated = savedPresets.filter(p => p.id !== id);
    setSavedPresets(updated);
    persistPresets(updated);
    toast.success("פריסט נמחק");
  }, [savedPresets]);

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

      {/* Built-in presets */}
      <div className="space-y-1.5">
        <h4 className="font-display text-[11px] font-semibold text-foreground flex items-center gap-1">
          <Star className="h-3 w-3 text-primary" /> פריסטים מוכנים
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {builtInPresets.map((p) => (
            <button
              key={p.name}
              onClick={() => applyPreset(p.filters)}
              className="rounded-md border border-border bg-card px-2 py-1 font-accent text-[10px] text-foreground transition-colors hover:border-primary hover:bg-primary/5"
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Saved presets */}
      {savedPresets.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="font-display text-[11px] font-semibold text-foreground flex items-center gap-1">
            <Save className="h-3 w-3 text-accent-foreground" /> הפריסטים שלי
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {savedPresets.map((p) => (
              <div key={p.id} className="group relative">
                <button
                  onClick={() => applyPreset(p.filters)}
                  className="rounded-md border border-primary/30 bg-primary/5 px-2 py-1 font-accent text-[10px] text-primary font-semibold transition-colors hover:bg-primary/10"
                >
                  {p.name}
                </button>
                <button
                  onClick={() => deletePreset(p.id)}
                  className="absolute -top-1 -right-1 hidden group-hover:flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                >
                  <Trash2 className="h-2 w-2" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save current as preset */}
      {!isDefault && (
        <div>
          {showSaveInput ? (
            <div className="flex gap-1.5">
              <input
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && savePreset()}
                placeholder="שם הפריסט..."
                className="flex-1 rounded-md border border-border bg-card px-2 py-1 font-body text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus
              />
              <button onClick={savePreset} className="rounded-md bg-primary px-2 py-1 font-accent text-[10px] text-primary-foreground">שמור</button>
              <button onClick={() => setShowSaveInput(false)} className="rounded-md border border-border px-2 py-1 font-accent text-[10px] text-muted-foreground">ביטול</button>
            </div>
          ) : (
            <button
              onClick={() => setShowSaveInput(true)}
              className="flex items-center gap-1 font-accent text-[10px] text-primary hover:underline"
            >
              <Save className="h-3 w-3" /> שמור כפריסט
            </button>
          )}
        </div>
      )}

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

      {/* Mini preview */}
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
