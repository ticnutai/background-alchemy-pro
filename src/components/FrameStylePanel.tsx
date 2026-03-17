import { useMemo, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Frame, Palette, Radius, Shapes, BookmarkPlus, Trash2 } from "lucide-react";

export type FrameStyle =
  | "clean"
  | "double"
  | "shadow"
  | "neon"
  | "dashed"
  | "vintage"
  | "inner"
  | "soft"
  | "film"
  | "bold";

export type FrameShape = "rect" | "rounded" | "pill" | "circle" | "diamond" | "hexagon" | "octagon";

export type FramePresetDefinition = {
  id: string;
  name: string;
  style: FrameStyle;
  shape: FrameShape;
  widthPx: number;
  radius: number;
  color: string;
};

type FrameStylePanelProps = {
  frameEnabled: boolean;
  onToggleEnabled: (next: boolean) => void;
  frameStyle: FrameStyle;
  onFrameStyleChange: (next: FrameStyle) => void;
  frameShape: FrameShape;
  onFrameShapeChange: (next: FrameShape) => void;
  frameWidthPx: number;
  onFrameWidthChange: (next: number) => void;
  frameRadius: number;
  onFrameRadiusChange: (next: number) => void;
  frameColor: string;
  onFrameColorChange: (next: string) => void;
  professionalPresets: FramePresetDefinition[];
  savedPresets: FramePresetDefinition[];
  onApplyPreset: (preset: FramePresetDefinition) => void;
  onSaveCurrentPreset: (name: string) => void;
  onDeleteSavedPreset: (presetId: string) => void;
};

const frameStyles: Array<{ id: FrameStyle; label: string }> = [
  { id: "clean", label: "זהב דק" },
  { id: "double", label: "זהב כפול" },
  { id: "shadow", label: "יוקרה כהה" },
  { id: "neon", label: "ניאון זוהר" },
  { id: "dashed", label: "וינטאג׳" },
  { id: "vintage", label: "שיש זהב" },
  { id: "inner", label: "פינות מעוטרות" },
  { id: "soft", label: "רך עם צל" },
  { id: "film", label: "מסגרת סרט" },
  { id: "bold", label: "קלאסי עבה" },
];

const frameShapes: Array<{ id: FrameShape; label: string }> = [
  { id: "rect", label: "מלבן" },
  { id: "rounded", label: "מעוגל" },
  { id: "pill", label: "קפסולה" },
  { id: "circle", label: "עיגול" },
  { id: "diamond", label: "יהלום" },
  { id: "hexagon", label: "משושה" },
  { id: "octagon", label: "מתומן" },
];

export default function FrameStylePanel({
  frameEnabled,
  onToggleEnabled,
  frameStyle,
  onFrameStyleChange,
  frameShape,
  onFrameShapeChange,
  frameWidthPx,
  onFrameWidthChange,
  frameRadius,
  onFrameRadiusChange,
  frameColor,
  onFrameColorChange,
  professionalPresets,
  savedPresets,
  onApplyPreset,
  onSaveCurrentPreset,
  onDeleteSavedPreset,
}: FrameStylePanelProps) {
  const [presetName, setPresetName] = useState("");

  const frameRadiusCss = frameShape === "pill" ? "9999px" : frameShape === "circle" ? "50%" : `${frameRadius}%`;
  const shapePreviewClip = useMemo(() => {
    if (frameShape === "circle") return "circle(50% at 50% 50%)";
    if (frameShape === "diamond") return "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)";
    if (frameShape === "hexagon") return "polygon(25% 6%, 75% 6%, 100% 50%, 75% 94%, 25% 94%, 0% 50%)";
    if (frameShape === "octagon") return "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)";
    return undefined;
  }, [frameShape]);

  const activeFramePreviewStyle = useMemo(() => {
    const w = Math.max(4, Math.min(frameWidthPx, 80));
    if (frameStyle === "double") {
      return { boxShadow: `inset 0 0 0 ${w}px ${frameColor}, inset 0 0 0 ${Math.round(w * 1.8)}px rgba(255,255,255,0.75)` };
    }
    if (frameStyle === "shadow") {
      return { boxShadow: `inset 0 0 0 ${w}px ${frameColor}, 0 10px 22px rgba(0,0,0,0.25)` };
    }
    if (frameStyle === "neon") {
      return { boxShadow: `inset 0 0 0 ${w}px ${frameColor}, 0 0 20px ${frameColor}` };
    }
    if (frameStyle === "dashed") {
      return { border: `${Math.max(3, Math.round(w * 0.75))}px dashed ${frameColor}` };
    }
    if (frameStyle === "film") {
      return { boxShadow: `inset 0 0 0 ${w}px #f5f3ef, inset 0 0 0 ${Math.round(w * 0.4)}px #111111` };
    }
    if (frameStyle === "bold") {
      return { boxShadow: `inset 0 0 0 ${Math.round(w * 1.25)}px ${frameColor}` };
    }
    return { boxShadow: `inset 0 0 0 ${w}px ${frameColor}` };
  }, [frameColor, frameStyle, frameWidthPx]);

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Frame className="h-4 w-4 text-primary" />
          <h4 className="font-display text-sm font-bold text-foreground">מסגרות וקונטריות</h4>
        </div>
        <button
          onClick={() => onToggleEnabled(!frameEnabled)}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold ${frameEnabled ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}
        >
          {frameEnabled ? "פעיל" : "כבוי"}
        </button>
      </div>

      <div className="space-y-2 rounded-lg border border-border/80 bg-muted/20 p-2">
        <div className="text-xs font-bold text-foreground">תצוגת מסגרת פעילה</div>
        <div className="h-20 rounded-lg bg-gradient-to-br from-slate-100 to-slate-300 p-2">
          <div
            className="h-full w-full bg-white/60"
            style={{
              borderRadius: frameRadiusCss,
              clipPath: shapePreviewClip,
              ...activeFramePreviewStyle,
            }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-bold text-foreground">פריסטים מקצועיים</div>
        <div className="grid grid-cols-2 gap-2">
          {professionalPresets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => {
                onToggleEnabled(true);
                onApplyPreset(preset);
              }}
              className="rounded-lg border border-border bg-background p-2 text-right hover:border-primary/50"
            >
              <div className="text-xs font-bold text-foreground">{preset.name}</div>
              <div className="mt-1 h-8 rounded-md bg-gradient-to-br from-slate-100 to-slate-300 p-1">
                <div
                  className="h-full w-full bg-white/70"
                  style={{
                    borderRadius: preset.shape === "pill" ? "9999px" : preset.shape === "circle" ? "50%" : `${preset.radius}%`,
                    clipPath:
                      preset.shape === "circle"
                        ? "circle(50% at 50% 50%)"
                        : preset.shape === "diamond"
                          ? "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)"
                          : preset.shape === "hexagon"
                            ? "polygon(25% 6%, 75% 6%, 100% 50%, 75% 94%, 25% 94%, 0% 50%)"
                            : preset.shape === "octagon"
                              ? "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)"
                              : undefined,
                    boxShadow: `inset 0 0 0 ${Math.max(2, Math.min(preset.widthPx, 18))}px ${preset.color}`,
                  }}
                />
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {frameStyles.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              onToggleEnabled(true);
              onFrameStyleChange(item.id);
            }}
            className={`rounded-lg border px-3 py-2 text-xs font-bold ${frameStyle === item.id ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Shapes className="h-3.5 w-3.5" />
          צורת מסגרת
        </div>
        <div className="grid grid-cols-3 gap-2">
          {frameShapes.map((shape) => (
            <button
              key={shape.id}
              onClick={() => {
                onToggleEnabled(true);
                onFrameShapeChange(shape.id);
              }}
              className={`rounded-lg border px-2 py-2 text-xs font-bold ${frameShape === shape.id ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground"}`}
            >
              {shape.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-2 text-muted-foreground"><Frame className="h-3.5 w-3.5" /> עובי מסגרת</span>
          <span className="font-bold">{frameWidthPx}px</span>
        </div>
        <Slider value={[frameWidthPx]} onValueChange={([v]) => onFrameWidthChange(v)} min={4} max={80} step={1} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-2 text-muted-foreground"><Radius className="h-3.5 w-3.5" /> עיגול פינות</span>
          <span className="font-bold">{frameRadius}%</span>
        </div>
        <Slider value={[frameRadius]} onValueChange={([v]) => onFrameRadiusChange(v)} min={0} max={50} step={1} />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border p-2">
        <span className="flex items-center gap-2 text-xs text-muted-foreground"><Palette className="h-3.5 w-3.5" /> צבע מסגרת</span>
        <input
          type="color"
          value={frameColor}
          onChange={(e) => onFrameColorChange(e.target.value)}
          className="h-8 w-12 cursor-pointer rounded border border-border bg-transparent"
        />
      </div>

      <div className="space-y-2 rounded-lg border border-border/80 bg-muted/20 p-2">
        <div className="text-xs font-bold text-foreground">שמור כפריסט אישי</div>
        <div className="flex gap-2">
          <input
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="שם פריסט"
            className="h-9 flex-1 rounded-md border border-border bg-background px-2 text-xs"
          />
          <button
            onClick={() => {
              const next = presetName.trim();
              if (!next) return;
              onSaveCurrentPreset(next);
              setPresetName("");
            }}
            className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-xs font-bold hover:border-primary/40"
          >
            <BookmarkPlus className="h-3.5 w-3.5" />
            שמור
          </button>
        </div>
      </div>

      {savedPresets.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-bold text-foreground">פריסטים אישיים</div>
          <div className="space-y-1.5">
            {savedPresets.map((preset) => (
              <div key={preset.id} className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5">
                <button
                  onClick={() => {
                    onToggleEnabled(true);
                    onApplyPreset(preset);
                  }}
                  className="flex-1 text-right text-xs font-semibold text-foreground hover:text-primary"
                >
                  {preset.name}
                </button>
                <button
                  onClick={() => onDeleteSavedPreset(preset.id)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-border text-muted-foreground hover:text-destructive"
                  title="מחיקה"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
