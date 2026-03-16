import { useState } from "react";
import { Target, Sparkles, Image as ImageIcon, RotateCcw } from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface RegionalMaskPanelProps {
  currentImage: string;
  onApply: (region: "background" | "product", filterType: string, intensity: number) => void;
  isProcessing: boolean;
}

const regionOptions = [
  { id: "background" as const, label: "רקע בלבד", icon: "🖼️", desc: "החל פילטר רק על הרקע" },
  { id: "product" as const, label: "מוצר בלבד", icon: "📦", desc: "החל פילטר רק על המוצר" },
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

const RegionalMaskPanel = ({ currentImage, onApply, isProcessing }: RegionalMaskPanelProps) => {
  const [selectedRegion, setSelectedRegion] = useState<"background" | "product">("background");
  const [selectedFilter, setSelectedFilter] = useState("blur");
  const [intensity, setIntensity] = useState(70);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-gold" />
          <h3 className="font-display text-sm font-semibold text-foreground">פילטרים אזוריים</h3>
        </div>
        {(selectedRegion !== "background" || selectedFilter !== "blur" || intensity !== 70) && (
          <button
            onClick={() => { setSelectedRegion("background"); setSelectedFilter("blur"); setIntensity(70); }}
            className="flex items-center gap-1 font-body text-xs text-primary hover:underline"
          >
            <RotateCcw className="h-3 w-3" /> איפוס
          </button>
        )}
      </div>

      <p className="font-body text-[10px] text-muted-foreground">
        החל פילטר רק על אזור מסוים — הרקע או המוצר — עם זיהוי אוטומטי.
      </p>

      {/* Region selection */}
      <div className="grid grid-cols-2 gap-2">
        {regionOptions.map(r => (
          <button
            key={r.id}
            onClick={() => setSelectedRegion(r.id)}
            className={`rounded-lg border-2 p-3 text-center transition-all ${
              selectedRegion === r.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
          >
            <span className="text-lg">{r.icon}</span>
            <span className="block font-display text-[10px] font-bold text-foreground mt-1">{r.label}</span>
            <span className="block font-body text-[8px] text-muted-foreground">{r.desc}</span>
          </button>
        ))}
      </div>

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
          <span className="font-accent text-xs font-bold text-primary">{intensity}%</span>
        </div>
        <Slider
          value={[intensity]}
          onValueChange={([v]) => setIntensity(v)}
          min={10}
          max={100}
          step={5}
        />
      </div>

      {/* Preview hint */}
      {currentImage && (
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
        onClick={() => onApply(selectedRegion, selectedFilter, intensity)}
        disabled={isProcessing}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-gold py-2.5 font-display text-sm font-semibold text-gold-foreground transition-all hover:brightness-110 disabled:opacity-50"
      >
        <Sparkles className="h-4 w-4" />
        {isProcessing ? "מעבד..." : `החל ${filterOptions.find(f => f.id === selectedFilter)?.label} על ${selectedRegion === "background" ? "הרקע" : "המוצר"}`}
      </button>
    </div>
  );
};

export default RegionalMaskPanel;
