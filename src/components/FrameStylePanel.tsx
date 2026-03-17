import { Slider } from "@/components/ui/slider";
import { Frame, Palette, Radius, Shapes } from "lucide-react";

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
}: FrameStylePanelProps) {
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
    </div>
  );
}
