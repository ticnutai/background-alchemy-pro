import { forwardRef, useState, useMemo, useCallback } from "react";
import { Slider } from "@/components/ui/slider";
import {
  Sun, Contrast, Droplets, Focus, Thermometer, Aperture, SunDim,
  Highlighter, Moon, Flower2, CircleDot, Palette, Paintbrush,
  ChevronDown, ChevronUp, Sparkles, EyeOff, Blend, Layers,
  SlidersHorizontal, BarChart3, Pipette,
} from "lucide-react";

// ─── Interface ───────────────────────────────────────────────
export interface ImageAdjustments {
  // Light
  brightness: number;
  contrast: number;
  exposure: number;
  highlights: number;
  shadows: number;
  // Color
  saturation: number;
  vibrance: number;
  warmth: number;
  tint: number;
  hue: number;
  // Detail
  clarity: number;
  dehaze: number;
  sharpness: number;
  blur: number;
  // Effects
  fade: number;
  grain: number;
  vignette: number;
  blackAndWhite: number;
  sepiaTone: number;
  // Split toning
  splitHighlightColor: string;
  splitHighlightStrength: number;
  splitShadowColor: string;
  splitShadowStrength: number;
  // Levels
  levelsBlack: number;
  levelsWhite: number;
  levelsMidtones: number;
  // Color Balance
  cbShadowsR: number;
  cbShadowsG: number;
  cbShadowsB: number;
  cbMidtonesR: number;
  cbMidtonesG: number;
  cbMidtonesB: number;
  cbHighlightsR: number;
  cbHighlightsG: number;
  cbHighlightsB: number;
}

export const defaultAdjustments: ImageAdjustments = {
  brightness: 100,
  contrast: 100,
  exposure: 0,
  highlights: 0,
  shadows: 0,
  saturation: 100,
  vibrance: 0,
  warmth: 0,
  tint: 0,
  hue: 0,
  clarity: 0,
  dehaze: 0,
  sharpness: 0,
  blur: 0,
  fade: 0,
  grain: 0,
  vignette: 0,
  blackAndWhite: 0,
  sepiaTone: 0,
  splitHighlightColor: "#f5d78e",
  splitHighlightStrength: 0,
  splitShadowColor: "#4a6fa5",
  splitShadowStrength: 0,
  levelsBlack: 0,
  levelsWhite: 255,
  levelsMidtones: 1.0,
  cbShadowsR: 0, cbShadowsG: 0, cbShadowsB: 0,
  cbMidtonesR: 0, cbMidtonesG: 0, cbMidtonesB: 0,
  cbHighlightsR: 0, cbHighlightsG: 0, cbHighlightsB: 0,
};

interface ImageAdjustmentsProps {
  adjustments: ImageAdjustments;
  onChange: (adjustments: ImageAdjustments) => void;
  onReset: () => void;
  onApplyLocal?: () => void;
  isApplying?: boolean;
}

// ─── Color Presets ───────────────────────────────────────────
export interface ColorPreset {
  id: string;
  label: string;
  icon: string;
  adjustments: Partial<ImageAdjustments>;
}

export const colorPresets: ColorPreset[] = [
  { id: "studio-warm", label: "סטודיו חם", icon: "🔥", adjustments: { warmth: 12, contrast: 108, saturation: 110, vibrance: 15, clarity: 10, highlights: -5 } },
  { id: "studio-cool", label: "סטודיו קריר", icon: "❄️", adjustments: { warmth: -12, tint: -5, contrast: 105, saturation: 95, clarity: 8 } },
  { id: "pastel-soft", label: "פסטל רך", icon: "🌸", adjustments: { saturation: 80, contrast: 90, fade: 25, brightness: 108, vibrance: -10, warmth: 5 } },
  { id: "vivid", label: "חד וחי", icon: "💎", adjustments: { saturation: 140, contrast: 115, vibrance: 30, clarity: 20, dehaze: 15 } },
  { id: "cinematic", label: "קולנועי", icon: "🎬", adjustments: { contrast: 120, saturation: 85, warmth: 8, tint: -3, shadows: -15, fade: 10, splitShadowColor: "#2c3e6b", splitShadowStrength: 20 } },
  { id: "vintage", label: "וינטג׳", icon: "📷", adjustments: { saturation: 75, contrast: 90, fade: 35, warmth: 15, grain: 25, sepiaTone: 15 } },
  { id: "moody-dark", label: "דרמטי", icon: "🌑", adjustments: { contrast: 125, brightness: 90, shadows: -25, saturation: 80, clarity: 15, vignette: 40 } },
  { id: "bright-airy", label: "בהיר ואוורירי", icon: "☁️", adjustments: { brightness: 115, contrast: 90, exposure: 15, saturation: 90, warmth: 5, fade: 15 } },
  { id: "gold-luxury", label: "זהב יוקרתי", icon: "👑", adjustments: { warmth: 20, saturation: 105, contrast: 110, splitHighlightColor: "#f5d78e", splitHighlightStrength: 30, vibrance: 10 } },
  { id: "bw-classic", label: "שחור-לבן קלאסי", icon: "⚫", adjustments: { blackAndWhite: 100, contrast: 115, clarity: 15, grain: 10 } },
  { id: "bw-high-contrast", label: "שחור-לבן דרמטי", icon: "🖤", adjustments: { blackAndWhite: 100, contrast: 140, clarity: 25, shadows: -20, highlights: 10 } },
  { id: "matte-film", label: "מאט פילם", icon: "🎞️", adjustments: { fade: 40, contrast: 95, saturation: 85, warmth: 8, grain: 15 } },
  { id: "clean-product", label: "מוצר נקי", icon: "✨", adjustments: { brightness: 105, contrast: 105, saturation: 105, clarity: 10, dehaze: 10, sharpness: 2 } },
  { id: "sunset-glow", label: "שקיעה זוהרת", icon: "🌅", adjustments: { warmth: 25, saturation: 120, vibrance: 20, splitHighlightColor: "#ff9f43", splitHighlightStrength: 25, splitShadowColor: "#6c3483", splitShadowStrength: 15 } },
  { id: "forest-green", label: "ירוק עמוק", icon: "🌲", adjustments: { hue: 10, tint: 8, saturation: 110, contrast: 108, splitShadowColor: "#1a5c38", splitShadowStrength: 15 } },
  { id: "ocean-blue", label: "כחול אוקיינוס", icon: "🌊", adjustments: { warmth: -15, tint: -8, saturation: 105, contrast: 110, splitHighlightColor: "#74b9ff", splitHighlightStrength: 20 } },
];

// ─── Slider Groups (collapsible sections) ────────────────────
type SliderDef = { key: keyof ImageAdjustments; label: string; icon: typeof Sun; min: number; max: number };

const lightSliders: SliderDef[] = [
  { key: "brightness", label: "בהירות", icon: Sun, min: 50, max: 150 },
  { key: "contrast", label: "ניגודיות", icon: Contrast, min: 50, max: 150 },
  { key: "exposure", label: "חשיפה", icon: SunDim, min: -50, max: 50 },
  { key: "highlights", label: "היילייטס", icon: Highlighter, min: -50, max: 50 },
  { key: "shadows", label: "צללים", icon: Moon, min: -50, max: 50 },
];

const colorSliders: SliderDef[] = [
  { key: "saturation", label: "רוויה", icon: Droplets, min: 0, max: 200 },
  { key: "vibrance", label: "עוצמת צבע", icon: Palette, min: -50, max: 50 },
  { key: "warmth", label: "חמימות", icon: Thermometer, min: -30, max: 30 },
  { key: "tint", label: "גוון (ירוק-מג׳נטה)", icon: Paintbrush, min: -30, max: 30 },
  { key: "hue", label: "סיבוב גוון", icon: Blend, min: -180, max: 180 },
];

const detailSliders: SliderDef[] = [
  { key: "clarity", label: "בהירות אמצע", icon: Layers, min: -50, max: 50 },
  { key: "dehaze", label: "הסרת ערפל", icon: EyeOff, min: 0, max: 100 },
  { key: "sharpness", label: "חדות", icon: Focus, min: 0, max: 5 },
  { key: "blur", label: "טשטוש", icon: CircleDot, min: 0, max: 10 },
];

const effectSliders: SliderDef[] = [
  { key: "fade", label: "דהייה (Fade)", icon: Flower2, min: 0, max: 60 },
  { key: "grain", label: "גריין", icon: Flower2, min: 0, max: 100 },
  { key: "vignette", label: "וינייט", icon: Aperture, min: 0, max: 100 },
  { key: "blackAndWhite", label: "שחור-לבן", icon: Contrast, min: 0, max: 100 },
  { key: "sepiaTone", label: "ספיה", icon: Thermometer, min: 0, max: 100 },
];

// ─── Filter Generation ───────────────────────────────────────

/** Build CSS filter string from adjustments */
export function getFilterString(adj: ImageAdjustments): string {
  const filters: string[] = [];

  // Brightness: combine exposure properly (additive, not multiplicative)
  const brightPercent = adj.brightness + adj.exposure * 0.5;
  filters.push(`brightness(${brightPercent / 100})`);

  // Contrast + clarity (clarity = midtone contrast boost)
  const totalContrast = adj.contrast + (adj.clarity > 0 ? adj.clarity * 0.3 : adj.clarity * 0.15);
  filters.push(`contrast(${totalContrast}%)`);

  // Saturation + vibrance (vibrance = smart saturation that affects muted colors more)
  const totalSat = adj.saturation + adj.vibrance * 0.5;
  filters.push(`saturate(${totalSat}%)`);

  // B&W
  if (adj.blackAndWhite > 0) {
    filters.push(`grayscale(${adj.blackAndWhite}%)`);
  }

  // Sepia
  if (adj.sepiaTone > 0) {
    filters.push(`sepia(${adj.sepiaTone}%)`);
  }

  // Warmth: positive = warm via sepia tint, negative = cool via hue shift
  if (adj.warmth > 0) {
    filters.push(`sepia(${adj.warmth * 0.5}%)`);
    filters.push(`saturate(${100 + adj.warmth * 1.5}%)`);
  } else if (adj.warmth < 0) {
    filters.push(`hue-rotate(${adj.warmth * 2}deg)`);
  }

  // Tint (green-magenta): approximate via small hue rotation
  if (adj.tint !== 0) {
    filters.push(`hue-rotate(${adj.tint * 1.2}deg)`);
  }

  // Hue rotation
  if (adj.hue !== 0) {
    filters.push(`hue-rotate(${adj.hue}deg)`);
  }

  // Dehaze: boosts contrast and saturation
  if (adj.dehaze > 0) {
    filters.push(`contrast(${100 + adj.dehaze * 0.3}%)`);
    filters.push(`saturate(${100 + adj.dehaze * 0.2}%)`);
  }

  // Fade: reduce contrast, lighten blacks
  if (adj.fade > 0) {
    filters.push(`contrast(${100 - adj.fade * 0.5}%)`);
    filters.push(`brightness(${100 + adj.fade * 0.3}%)`);
  }

  // Highlights/shadows (improved: brightness curve approximation)
  if (adj.highlights !== 0) {
    // Positive highlights = brighter brights, negative = recover blown highlights
    filters.push(`brightness(${100 + adj.highlights * 0.15}%)`);
  }
  if (adj.shadows !== 0) {
    // Positive shadows = lift shadows, negative = crush blacks
    filters.push(`brightness(${100 + adj.shadows * 0.1}%)`);
  }

  // Blur
  if (adj.blur > 0) {
    filters.push(`blur(${adj.blur}px)`);
  }

  return filters.join(" ");
}

/** Build SVG filter ID for advanced effects (grain, split toning, sharpness).
 *  Returns the filter ID to use, or null if no SVG filter needed. */
export function getSvgFilterId(adj: ImageAdjustments): string | null {
  const needsGrain = adj.grain > 0;
  const needsSplit = adj.splitHighlightStrength > 0 || adj.splitShadowStrength > 0;
  const needsSharp = adj.sharpness > 0;
  if (!needsGrain && !needsSplit && !needsSharp) return null;
  return "bg-alchemy-fx";
}

/** Generate the SVG filter element markup (inject once per render).
 *  This handles grain (feTurbulence), sharpness (convolution matrix),
 *  and split toning (feFlood + feBlend). */
export function getSvgFilterMarkup(adj: ImageAdjustments): string | null {
  const id = getSvgFilterId(adj);
  if (!id) return null;

  let filters = "";

  // Merge result tracker
  let lastResult = "SourceGraphic";

  // Sharpness via unsharp mask approximation
  if (adj.sharpness > 0) {
    const amount = adj.sharpness * 0.5;
    filters += `
      <feConvolveMatrix
        in="${lastResult}"
        order="3"
        kernelMatrix="0 -${amount} 0 -${amount} ${1 + 4 * amount} -${amount} 0 -${amount} 0"
        result="sharpened"
      />`;
    lastResult = "sharpened";
  }

  // Grain via feTurbulence + noise blend
  if (adj.grain > 0) {
    const opacity = adj.grain / 250;
    filters += `
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" result="noise"/>
      <feColorMatrix in="noise" type="saturate" values="0" result="grayNoise"/>
      <feBlend in="${lastResult}" in2="grayNoise" mode="overlay" result="grained"/>
      <feComposite in="grained" in2="SourceGraphic" operator="in" result="grainClipped"/>`;
    // Use opacity to control strength
    filters += `
      <feMerge result="grainMerge">
        <feMergeNode in="${lastResult}"/>
      </feMerge>
      <feBlend in="grainClipped" in2="${lastResult}" mode="normal" result="grainFinal"/>`;
    // Actually simpler: just set opacity on the grain via feComponentTransfer
    filters = filters.replace(/grainFinal/, "grainFinal"); // keep as-is
    lastResult = "grainClipped";
  }

  // Split toning
  if (adj.splitHighlightStrength > 0) {
    const c = adj.splitHighlightColor;
    const r = parseInt(c.slice(1, 3), 16) / 255;
    const g = parseInt(c.slice(3, 5), 16) / 255;
    const b = parseInt(c.slice(5, 7), 16) / 255;
    const a = adj.splitHighlightStrength / 100;
    filters += `
      <feFlood flood-color="${c}" flood-opacity="${a}" result="hlFlood"/>
      <feBlend in="${lastResult}" in2="hlFlood" mode="screen" result="hlToned"/>`;
    lastResult = "hlToned";
  }
  if (adj.splitShadowStrength > 0) {
    const c = adj.splitShadowColor;
    const a = adj.splitShadowStrength / 100;
    filters += `
      <feFlood flood-color="${c}" flood-opacity="${a}" result="shFlood"/>
      <feBlend in="${lastResult}" in2="shFlood" mode="multiply" result="shToned"/>`;
    lastResult = "shToned";
  }

  return `<svg width="0" height="0" style="position:absolute"><defs><filter id="${id}" color-interpolation-filters="sRGB">${filters}</filter></defs></svg>`;
}

/** CSS for vignette overlay — use in a wrapper div */
export function getOverlayStyles(adj: ImageAdjustments): React.CSSProperties | null {
  if (adj.vignette === 0) return null;
  return {
    position: "absolute" as const,
    inset: 0,
    pointerEvents: "none" as const,
    background: `radial-gradient(ellipse at center, transparent ${100 - adj.vignette}%, rgba(0,0,0,${adj.vignette / 120}) 100%)`,
    mixBlendMode: "multiply" as const,
  };
}

// ─── Collapsible Section ─────────────────────────────────────
function Section({ title, icon: Icon, children, defaultOpen = true }: {
  title: string;
  icon: typeof Sun;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border/50 pb-3 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-1.5 group"
      >
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-primary/70" />
          <span className="font-display text-[11px] font-bold text-foreground uppercase tracking-wider">{title}</span>
        </div>
        {open ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
      </button>
      {open && <div className="mt-2 space-y-3">{children}</div>}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────
const ImageAdjustmentsPanel = forwardRef<HTMLDivElement, ImageAdjustmentsProps>(
  ({ adjustments, onChange, onReset, onApplyLocal, isApplying }, ref) => {
    const isDefault = useMemo(() => JSON.stringify(adjustments) === JSON.stringify(defaultAdjustments), [adjustments]);
    const [showPresets, setShowPresets] = useState(true);
    const [presetStrength, setPresetStrength] = useState(100);
    const [activePresetId, setActivePresetId] = useState<string | null>(null);

    const applyPreset = useCallback((preset: ColorPreset) => {
      setActivePresetId(preset.id);
      const strength = presetStrength / 100;
      const blended: Partial<ImageAdjustments> = {};
      for (const [key, val] of Object.entries(preset.adjustments)) {
        const defVal = defaultAdjustments[key as keyof ImageAdjustments];
        if (typeof val === "number" && typeof defVal === "number") {
          (blended as Record<string, unknown>)[key] = Math.round(defVal + (val - defVal) * strength);
        } else {
          (blended as Record<string, unknown>)[key] = val;
        }
      }
      onChange({ ...defaultAdjustments, ...blended });
    }, [presetStrength, onChange]);

    const renderSlider = ({ key, label, icon: Icon, min, max }: SliderDef) => (
      <div key={key} className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Icon className="h-3 w-3 text-muted-foreground" />
            <span className="font-body text-[11px] font-medium text-foreground">{label}</span>
          </div>
          <span className="font-body text-[10px] text-muted-foreground tabular-nums w-8 text-left">
            {adjustments[key] as number}
          </span>
        </div>
        <Slider
          value={[adjustments[key] as number]}
          onValueChange={([v]) => onChange({ ...adjustments, [key]: v })}
          min={min}
          max={max}
          step={1}
          className="cursor-pointer"
        />
      </div>
    );

    return (
      <div ref={ref} className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">
            התאמות תמונה
          </h3>
          {!isDefault && (
            <button onClick={onReset} className="font-body text-xs text-primary hover:underline">
              איפוס
            </button>
          )}
        </div>

        {/* Color Presets */}
        <div className="border-b border-border/50 pb-3">
          <button
            onClick={() => setShowPresets(!showPresets)}
            className="flex w-full items-center justify-between py-1 group"
          >
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-gold" />
              <span className="font-display text-[11px] font-bold text-foreground uppercase tracking-wider">פילטרים חכמים</span>
              <span className="rounded-full bg-primary/10 px-1.5 font-accent text-[9px] text-primary">{colorPresets.length}</span>
            </div>
            {showPresets ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
          </button>
          {showPresets && (
            <div className="mt-2 space-y-2">
              {/* Preset Strength */}
              <div className="flex items-center gap-2 px-1">
                <span className="font-body text-[9px] text-muted-foreground shrink-0">עוצמה</span>
                <Slider
                  value={[presetStrength]}
                  onValueChange={([v]) => {
                    setPresetStrength(v);
                    if (activePresetId) {
                      const p = colorPresets.find(pr => pr.id === activePresetId);
                      if (p) {
                        const strength = v / 100;
                        const blended: Partial<ImageAdjustments> = {};
                        for (const [key, val] of Object.entries(p.adjustments)) {
                          const defVal = defaultAdjustments[key as keyof ImageAdjustments];
                          if (typeof val === "number" && typeof defVal === "number") {
                            (blended as Record<string, unknown>)[key] = Math.round(defVal + (val - defVal) * strength);
                          } else {
                            (blended as Record<string, unknown>)[key] = val;
                          }
                        }
                        onChange({ ...defaultAdjustments, ...blended });
                      }
                    }
                  }}
                  min={10}
                  max={150}
                  step={5}
                />
                <span className="font-accent text-[9px] text-muted-foreground tabular-nums w-8">{presetStrength}%</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                {colorPresets.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => applyPreset(p)}
                    className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-right transition-all hover:border-gold/50 hover:bg-gold/5 active:scale-95 ${
                      activePresetId === p.id ? "border-primary bg-primary/10" : "border-border"
                    }`}
                  >
                    <span className="text-sm shrink-0">{p.icon}</span>
                    <span className="font-body text-[10px] font-medium text-foreground leading-tight truncate">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Light */}
        <Section title="אור" icon={Sun}>
          {lightSliders.map(renderSlider)}
        </Section>

        {/* Color */}
        <Section title="צבע" icon={Palette}>
          {colorSliders.map(renderSlider)}
        </Section>

        {/* Detail */}
        <Section title="פרטים" icon={Focus} defaultOpen={false}>
          {detailSliders.map(renderSlider)}
        </Section>

        {/* Effects */}
        <Section title="אפקטים" icon={Sparkles} defaultOpen={false}>
          {effectSliders.map(renderSlider)}
        </Section>

        {/* Levels */}
        <Section title="רמות (Levels)" icon={BarChart3} defaultOpen={false}>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-body text-[11px] font-medium text-foreground">נקודה שחורה</span>
              <span className="font-body text-[10px] text-muted-foreground tabular-nums w-8 text-left">{adjustments.levelsBlack}</span>
            </div>
            <Slider value={[adjustments.levelsBlack]} onValueChange={([v]) => onChange({ ...adjustments, levelsBlack: v })} min={0} max={100} step={1} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-body text-[11px] font-medium text-foreground">אמצע (Gamma)</span>
              <span className="font-body text-[10px] text-muted-foreground tabular-nums w-8 text-left">{adjustments.levelsMidtones.toFixed(1)}</span>
            </div>
            <Slider value={[adjustments.levelsMidtones * 100]} onValueChange={([v]) => onChange({ ...adjustments, levelsMidtones: v / 100 })} min={10} max={400} step={5} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-body text-[11px] font-medium text-foreground">נקודה לבנה</span>
              <span className="font-body text-[10px] text-muted-foreground tabular-nums w-8 text-left">{adjustments.levelsWhite}</span>
            </div>
            <Slider value={[adjustments.levelsWhite]} onValueChange={([v]) => onChange({ ...adjustments, levelsWhite: v })} min={155} max={255} step={1} />
          </div>
        </Section>

        {/* Color Balance */}
        <Section title="איזון צבע" icon={Pipette} defaultOpen={false}>
          <div className="space-y-3">
            <div>
              <span className="font-body text-[10px] font-semibold text-muted-foreground mb-1 block">צללים</span>
              {[
                { key: "cbShadowsR" as const, label: "ציאן ↔ אדום", color: "text-red-400" },
                { key: "cbShadowsG" as const, label: "מג׳נטה ↔ ירוק", color: "text-green-400" },
                { key: "cbShadowsB" as const, label: "צהוב ↔ כחול", color: "text-blue-400" },
              ].map(({ key, label, color }) => (
                <div key={key} className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className={`font-body text-[10px] ${color}`}>{label}</span>
                    <span className="font-body text-[9px] text-muted-foreground tabular-nums">{adjustments[key]}</span>
                  </div>
                  <Slider value={[adjustments[key]]} onValueChange={([v]) => onChange({ ...adjustments, [key]: v })} min={-30} max={30} step={1} />
                </div>
              ))}
            </div>
            <div>
              <span className="font-body text-[10px] font-semibold text-muted-foreground mb-1 block">אמצע</span>
              {[
                { key: "cbMidtonesR" as const, label: "ציאן ↔ אדום", color: "text-red-400" },
                { key: "cbMidtonesG" as const, label: "מג׳נטה ↔ ירוק", color: "text-green-400" },
                { key: "cbMidtonesB" as const, label: "צהוב ↔ כחול", color: "text-blue-400" },
              ].map(({ key, label, color }) => (
                <div key={key} className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className={`font-body text-[10px] ${color}`}>{label}</span>
                    <span className="font-body text-[9px] text-muted-foreground tabular-nums">{adjustments[key]}</span>
                  </div>
                  <Slider value={[adjustments[key]]} onValueChange={([v]) => onChange({ ...adjustments, [key]: v })} min={-30} max={30} step={1} />
                </div>
              ))}
            </div>
            <div>
              <span className="font-body text-[10px] font-semibold text-muted-foreground mb-1 block">היילייטס</span>
              {[
                { key: "cbHighlightsR" as const, label: "ציאן ↔ אדום", color: "text-red-400" },
                { key: "cbHighlightsG" as const, label: "מג׳נטה ↔ ירוק", color: "text-green-400" },
                { key: "cbHighlightsB" as const, label: "צהוב ↔ כחול", color: "text-blue-400" },
              ].map(({ key, label, color }) => (
                <div key={key} className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className={`font-body text-[10px] ${color}`}>{label}</span>
                    <span className="font-body text-[9px] text-muted-foreground tabular-nums">{adjustments[key]}</span>
                  </div>
                  <Slider value={[adjustments[key]]} onValueChange={([v]) => onChange({ ...adjustments, [key]: v })} min={-30} max={30} step={1} />
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* Split Toning */}
        <Section title="פיצול טונים" icon={Blend} defaultOpen={false}>
          <div className="space-y-2">
            <div>
              <span className="font-body text-[10px] text-muted-foreground">היילייטס</span>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={adjustments.splitHighlightColor}
                  onChange={(e) => onChange({ ...adjustments, splitHighlightColor: e.target.value })}
                  className="h-7 w-7 rounded cursor-pointer border border-border shrink-0"
                />
                <Slider
                  value={[adjustments.splitHighlightStrength]}
                  onValueChange={([v]) => onChange({ ...adjustments, splitHighlightStrength: v })}
                  min={0}
                  max={50}
                  step={1}
                  className="cursor-pointer flex-1"
                />
                <span className="font-body text-[9px] text-muted-foreground tabular-nums w-5">{adjustments.splitHighlightStrength}</span>
              </div>
            </div>
            <div>
              <span className="font-body text-[10px] text-muted-foreground">צללים</span>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={adjustments.splitShadowColor}
                  onChange={(e) => onChange({ ...adjustments, splitShadowColor: e.target.value })}
                  className="h-7 w-7 rounded cursor-pointer border border-border shrink-0"
                />
                <Slider
                  value={[adjustments.splitShadowStrength]}
                  onValueChange={([v]) => onChange({ ...adjustments, splitShadowStrength: v })}
                  min={0}
                  max={50}
                  step={1}
                  className="cursor-pointer flex-1"
                />
                <span className="font-body text-[9px] text-muted-foreground tabular-nums w-5">{adjustments.splitShadowStrength}</span>
              </div>
            </div>
          </div>
        </Section>

        {/* Apply Locally Button */}
        {!isDefault && onApplyLocal && (
          <div className="pt-3 border-t border-border/50">
            <button
              onClick={onApplyLocal}
              disabled={isApplying}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 font-display text-sm font-semibold text-primary-foreground hover:brightness-110 transition disabled:opacity-50"
            >
              {isApplying ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : (
                <SlidersHorizontal className="h-4 w-4" />
              )}
              החל מקומית (ללא AI)
            </button>
            <p className="mt-1.5 font-body text-[9px] text-center text-muted-foreground">
              מעבד פיקסלים ישירות בדפדפן — תוצאה מדויקת ללא שרת
            </p>
          </div>
        )}
      </div>
    );
  }
);

ImageAdjustmentsPanel.displayName = "ImageAdjustmentsPanel";

export default ImageAdjustmentsPanel;
