import { useState, useCallback } from "react";
import { Target, Sparkles, RotateCcw, Paintbrush } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import RegionSelectCanvas from "./RegionSelectCanvas";

interface RegionalMaskPanelProps {
  currentImage: string;
  onApply: (region: "background" | "product" | "custom", filterType: string, intensity: number, maskDataUrl?: string) => void;
  isProcessing: boolean;
}

const regionOptions = [
  { id: "background" as const, label: "רקע בלבד", icon: "🖼️", desc: "החל פילטר רק על הרקע" },
  { id: "product" as const, label: "מוצר בלבד", icon: "📦", desc: "החל פילטר רק על המוצר" },
  { id: "custom" as const, label: "בחירה חופשית", icon: "🎨", desc: "צייר ידנית את האזור לעריכה" },
];

const filterOptions = [
  { id: "blur", label: "טשטוש", icon: "💨" },
  { id: "darken", label: "הכהה", icon: "🌑" },
  { id: "brighten", label: "בהיר", icon: "☀️" },
  { id: "desaturate", label: "שחור-לבן", icon: "◻️" },
  { id: "warm", label: "חם", icon: "🔥" },
  { id: "cool", label: "קריר", icon: "❄️" },
  { id: "vintage", label: "וינטג׳", icon: "📷" },
  { id: "dramatic", label: "דרמטי", icon: "🎭" },
];

type RegionType = "background" | "product" | "custom";

const RegionalMaskPanel = ({ currentImage, onApply, isProcessing }: RegionalMaskPanelProps) => {
  const [selectedRegion, setSelectedRegion] = useState<RegionType>("background");
  const [selectedFilter, setSelectedFilter] = useState("blur");
  const [intensity, setIntensity] = useState(70);
  const [maskDataUrl, setMaskDataUrl] = useState("");

  const handleMaskReady = useCallback((mask: string) => {
    setMaskDataUrl(mask);
  }, []);

  const canApplyCustom = selectedRegion !== "custom" || maskDataUrl;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-gold" />
          <h3 className="font-display text-sm font-semibold text-foreground">פילטרים אזוריים</h3>
        </div>
        {(selectedRegion !== "background" || selectedFilter !== "blur" || intensity !== 70) && (
          <button
            onClick={() => { setSelectedRegion("background"); setSelectedFilter("blur"); setIntensity(70); setMaskDataUrl(""); }}
            className="flex items-center gap-1 font-body text-xs text-primary hover:underline"
          >
            <RotateCcw className="h-3 w-3" /> איפוס
          </button>
        )}
      </div>

      <p className="font-body text-[10px] text-muted-foreground">
        החל פילטר על אזור מסוים — רקע, מוצר, או ציור ידני חופשי.
      </p>

      {/* Region selection */}
      <div className="grid grid-cols-3 gap-2">
        {regionOptions.map(r => (
          <button
            key={r.id}
            onClick={() => setSelectedRegion(r.id)}
            className={`rounded-lg border-2 p-2.5 text-center transition-all ${
              selectedRegion === r.id
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
          >
            <span className="text-lg">{r.icon}</span>
            <span className="block font-display text-[10px] font-bold text-foreground mt-1">{r.label}</span>
            <span className="block font-body text-[8px] text-muted-foreground">{r.desc}</span>
          </button>
        ))}
      </div>

      {/* Custom region drawing canvas */}
      {selectedRegion === "custom" && currentImage && (
        <RegionSelectCanvas
          imageSrc={currentImage}
          onMaskReady={handleMaskReady}
          active={selectedRegion === "custom"}
        />
      )}

      {/* Filter selection */}
      <div className="grid grid-cols-4 gap-1.5">
        {filterOptions.map(f => (
          <button
            key={f.id}
            onClick={() => setSelectedFilter(f.id)}
            className={`rounded-lg border-2 p-2 text-center transition-all ${
              selectedFilter === f.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
          >
            <span className="text-sm">{f.icon}</span>
            <span className="block font-body text-[8px] text-foreground mt-0.5">{f.label}</span>
          </button>
        ))}
      </div>

      {/* Intensity */}
      <div className="space-y-1.5 rounded-lg border border-border bg-card p-3">
        <div className="flex items-center justify-between">
          <label className="font-display text-xs font-semibold text-foreground">עוצמה</label>
          <div className="flex items-center gap-1">
            <span className="font-accent text-xs font-bold text-primary">{intensity}%</span>
            {intensity !== 70 && (
              <button onClick={() => setIntensity(70)} className="flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="איפוס"><RotateCcw className="h-2.5 w-2.5" /></button>
            )}
          </div>
        </div>
        <Slider
          value={[intensity]}
          onValueChange={([v]) => setIntensity(v)}
          min={10}
          max={100}
          step={5}
        />
      </div>

      {/* Preview hint for non-custom */}
      {selectedRegion !== "custom" && currentImage && (
        <div className="relative rounded-lg overflow-hidden border border-border aspect-video">
          <img src={currentImage} alt="preview" className="w-full h-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`rounded-full px-3 py-1.5 font-accent text-[10px] font-bold backdrop-blur-sm ${
              selectedRegion === "background" ? "bg-primary/20 text-primary border border-primary/30" : "bg-gold/20 text-gold border border-gold/30"
            }`}>
              {selectedRegion === "background" ? "🖼️ הרקע יושפע" : "📦 המוצר יושפע"}
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => onApply(selectedRegion, selectedFilter, intensity, selectedRegion === "custom" ? maskDataUrl : undefined)}
        disabled={isProcessing || !canApplyCustom}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-gold py-2.5 font-display text-sm font-semibold text-gold-foreground transition-all hover:brightness-110 disabled:opacity-50"
      >
        {selectedRegion === "custom" && <Paintbrush className="h-4 w-4" />}
        {selectedRegion !== "custom" && <Sparkles className="h-4 w-4" />}
        {isProcessing
          ? "מעבד..."
          : selectedRegion === "custom"
            ? `החל ${filterOptions.find(f => f.id === selectedFilter)?.label} על האזור המסומן`
            : `החל ${filterOptions.find(f => f.id === selectedFilter)?.label} על ${selectedRegion === "background" ? "הרקע" : "המוצר"}`
        }
      </button>
    </div>
  );
};

export default RegionalMaskPanel;
