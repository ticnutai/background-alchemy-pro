import { useState, useCallback } from "react";
import { Layers, Eye, EyeOff, Trash2, Plus, GripVertical, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface FilterLayer {
  id: string;
  name: string;
  type: string;
  params: Record<string, unknown>;
  visible: boolean;
  cssPreview: string;
}

interface SavedPreset {
  name: string;
  layers: Omit<FilterLayer, "id">[];
}

const PRESETS_KEY = "filter-layer-presets";

const availableFilters = [
  { type: "warm-gold", name: "זהב חם", css: "sepia(25%) saturate(140%) brightness(105%)" },
  { type: "cool-blue", name: "כחול קריר", css: "hue-rotate(15deg) saturate(120%)" },
  { type: "vintage", name: "וינטג׳", css: "sepia(35%) contrast(110%) brightness(105%) saturate(85%)" },
  { type: "bright-airy", name: "בהיר אוורירי", css: "brightness(115%) contrast(90%) saturate(90%)" },
  { type: "moody-dark", name: "כהה דרמטי", css: "brightness(80%) contrast(130%) saturate(115%)" },
  { type: "pastel", name: "פסטל", css: "saturate(65%) brightness(115%) contrast(90%)" },
  { type: "vignette", name: "ויניט", css: "contrast(105%) brightness(95%)" },
  { type: "sharpen", name: "חידוד", css: "contrast(110%)" },
  { type: "dramatic-red", name: "אדום דרמטי", css: "sepia(20%) hue-rotate(-10deg) saturate(160%) contrast(115%)" },
  { type: "earthy", name: "ארצי טבעי", css: "sepia(20%) saturate(85%) contrast(110%) brightness(95%)" },
];

function getSavedPresets(): SavedPreset[] {
  try {
    return JSON.parse(localStorage.getItem(PRESETS_KEY) || "[]");
  } catch { return []; }
}

interface FilterLayersPanelProps {
  currentImage: string;
  onPreviewFilter: (cssFilter: string) => void;
  onApplyLayers: (layers: FilterLayer[]) => void;
  isProcessing: boolean;
}

const FilterLayersPanel = ({ currentImage, onPreviewFilter, onApplyLayers, isProcessing }: FilterLayersPanelProps) => {
  const [layers, setLayers] = useState<FilterLayer[]>([]);
  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>(getSavedPresets());
  const [presetName, setPresetName] = useState("");

  const combinedCss = layers
    .filter(l => l.visible)
    .map(l => l.cssPreview)
    .join(" ");

  const addLayer = useCallback((filter: typeof availableFilters[0]) => {
    const newLayer: FilterLayer = {
      id: Date.now().toString(36),
      name: filter.name,
      type: filter.type,
      params: {},
      visible: true,
      cssPreview: filter.css,
    };
    const updated = [...layers, newLayer];
    setLayers(updated);
    onPreviewFilter(updated.filter(l => l.visible).map(l => l.cssPreview).join(" "));
  }, [layers, onPreviewFilter]);

  const toggleVisibility = useCallback((id: string) => {
    const updated = layers.map(l => l.id === id ? { ...l, visible: !l.visible } : l);
    setLayers(updated);
    onPreviewFilter(updated.filter(l => l.visible).map(l => l.cssPreview).join(" "));
  }, [layers, onPreviewFilter]);

  const removeLayer = useCallback((id: string) => {
    const updated = layers.filter(l => l.id !== id);
    setLayers(updated);
    onPreviewFilter(updated.filter(l => l.visible).map(l => l.cssPreview).join(" "));
  }, [layers, onPreviewFilter]);

  const moveLayer = useCallback((id: string, dir: -1 | 1) => {
    const idx = layers.findIndex(l => l.id === id);
    if ((dir === -1 && idx <= 0) || (dir === 1 && idx >= layers.length - 1)) return;
    const updated = [...layers];
    [updated[idx], updated[idx + dir]] = [updated[idx + dir], updated[idx]];
    setLayers(updated);
    onPreviewFilter(updated.filter(l => l.visible).map(l => l.cssPreview).join(" "));
  }, [layers, onPreviewFilter]);

  const savePreset = useCallback(() => {
    if (!presetName.trim() || layers.length === 0) {
      toast.error("הוסף שכבות ותן שם");
      return;
    }
    const preset: SavedPreset = {
      name: presetName.trim(),
      layers: layers.map(({ id, ...rest }) => rest),
    };
    const updated = [...savedPresets, preset];
    setSavedPresets(updated);
    localStorage.setItem(PRESETS_KEY, JSON.stringify(updated));
    setPresetName("");
    toast.success("הפריסט נשמר!");
  }, [presetName, layers, savedPresets]);

  const loadPreset = useCallback((preset: SavedPreset) => {
    const loaded = preset.layers.map((l, i) => ({ ...l, id: `${Date.now()}-${i}` }));
    setLayers(loaded);
    onPreviewFilter(loaded.filter(l => l.visible).map(l => l.cssPreview).join(" "));
    toast.success(`פריסט "${preset.name}" נטען`);
  }, [onPreviewFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-gold" />
        <h3 className="font-display text-sm font-semibold text-foreground">שכבות פילטרים</h3>
      </div>

      <p className="font-body text-[10px] text-muted-foreground">
        ערום מספר פילטרים זה על זה — הפעל/כבה כל שכבה בנפרד.
      </p>

      {/* Add filter */}
      <div className="space-y-1.5">
        <label className="font-body text-xs text-muted-foreground">הוסף שכבה:</label>
        <div className="grid grid-cols-2 gap-1.5">
          {availableFilters.map(f => (
            <button
              key={f.type}
              onClick={() => addLayer(f)}
              className="flex items-center gap-1.5 rounded-lg border border-border p-2 text-right transition-all hover:border-gold/40 hover:bg-secondary/30"
            >
              <Plus className="h-3 w-3 text-gold shrink-0" />
              <span className="font-body text-[10px] text-foreground truncate">{f.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Active layers */}
      {layers.length > 0 && (
        <div className="space-y-1.5">
          <label className="font-body text-xs font-semibold text-foreground">שכבות פעילות ({layers.length}):</label>
          {layers.map((layer, idx) => (
            <div
              key={layer.id}
              className={`flex items-center gap-2 rounded-lg border p-2 transition-all ${
                layer.visible ? "border-primary/30 bg-primary/5" : "border-border bg-card opacity-60"
              }`}
            >
              <div className="flex flex-col gap-0.5">
                <button onClick={() => moveLayer(layer.id, -1)} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                  <GripVertical className="h-3 w-3 rotate-90" />
                </button>
              </div>
              <span className="flex-1 font-body text-xs text-foreground truncate">{layer.name}</span>
              <button onClick={() => toggleVisibility(layer.id)} className="text-muted-foreground hover:text-foreground">
                {layer.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </button>
              <button onClick={() => removeLayer(layer.id)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Preview */}
      {currentImage && layers.length > 0 && (
        <div className="relative rounded-lg overflow-hidden border border-border aspect-video">
          <img
            src={currentImage}
            alt="layers preview"
            className="w-full h-full object-cover transition-all duration-200"
            style={{ filter: combinedCss }}
          />
          <div className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 font-accent text-[8px] text-white">
            {layers.filter(l => l.visible).length} שכבות פעילות
          </div>
        </div>
      )}

      {/* Save preset */}
      {layers.length > 0 && (
        <div className="flex gap-2">
          <input
            value={presetName}
            onChange={e => setPresetName(e.target.value)}
            placeholder="שם הפריסט..."
            className="flex-1 rounded-lg border border-border bg-card px-3 py-1.5 font-body text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            dir="rtl"
          />
          <button onClick={savePreset} className="flex items-center gap-1 rounded-lg bg-secondary px-3 py-1.5 font-body text-xs text-foreground hover:bg-secondary/80">
            <Save className="h-3 w-3" /> שמור
          </button>
        </div>
      )}

      {/* Saved presets */}
      {savedPresets.length > 0 && (
        <div className="space-y-1.5 border-t border-border pt-3">
          <label className="font-body text-xs font-semibold text-foreground">פריסטים שמורים:</label>
          {savedPresets.map((preset, i) => (
            <button
              key={i}
              onClick={() => loadPreset(preset)}
              className="w-full rounded-lg border border-border p-2 text-right transition-all hover:border-gold/40 hover:bg-secondary/30"
            >
              <span className="font-display text-xs font-bold text-foreground">{preset.name}</span>
              <span className="block font-body text-[9px] text-muted-foreground">{preset.layers.length} שכבות</span>
            </button>
          ))}
        </div>
      )}

      {/* Apply AI */}
      {layers.length > 0 && (
        <button
          onClick={() => onApplyLayers(layers)}
          disabled={isProcessing}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-gold py-2.5 font-display text-sm font-semibold text-gold-foreground transition-all hover:brightness-110 disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          {isProcessing ? "מעבד..." : "החל שכבות עם AI"}
        </button>
      )}
    </div>
  );
};

export default FilterLayersPanel;
