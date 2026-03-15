import { useState, useCallback, useRef, useEffect } from "react";
import {
  applyToneCurves, type ToneCurveSettings, type CurvePoint, defaultCurvePoints,
  applyHSL, type HSLSettings, type HSLChannel, defaultHSLSettings,
  applyWhiteBalance,
  applyPerspective, type PerspectivePoints,
  parseCubeLUT, applyLUT, type LUT3D,
  applyChannelMixer, type ChannelMixerSettings, defaultChannelMixer,
  applyGradientMap, type GradientStop, gradientMapPresets,
  applySelectiveColor, type SelectiveColorSettings, defaultSelectiveColorSettings,
  applyNoiseReduction,
  applyTiltShift,
  applyBlendMode, type BlendMode,
  applyTextOverlay, type TextOverlayOptions,
  applyGlitchEffect, type GlitchEffect,
} from "@/lib/advanced-filters";
import { toast } from "sonner";
import {
  Waves, Palette, Pipette, Move, FileUp, Blend, Type, Sparkles,
  ChevronDown, ChevronUp, RotateCcw, Loader2, Minus, Zap
} from "lucide-react";

interface Props {
  currentImage: string | null;
  onResult: (img: string) => void;
}

// ─── Accordion Section ───────────────────────────────────────
function Section({ title, icon, children, defaultOpen = false }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 text-sm font-semibold hover:bg-muted/50 transition-colors"
      >
        <span className="flex items-center gap-2">{icon}{title}</span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && <div className="p-3 pt-0 space-y-3 border-t border-border">{children}</div>}
    </div>
  );
}

// ─── Small Slider ────────────────────────────────────────────
function Slider({ label, value, onChange, min, max, step = 1 }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number;
}) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 h-1.5 accent-primary"
      />
      <span className="w-8 text-left font-mono text-muted-foreground">{value}</span>
    </label>
  );
}

// ─── Apply Button ────────────────────────────────────────────
function ApplyBtn({ onClick, loading, label = "החל" }: { onClick: () => void; loading: boolean; label?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {label}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── MAIN COMPONENT ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
export default function AdvancedFiltersPanel({ currentImage, onResult }: Props) {
  const [processing, setProcessing] = useState(false);

  const run = useCallback(async (fn: () => Promise<string>) => {
    if (!currentImage) { toast.error("יש להעלות תמונה קודם"); return; }
    setProcessing(true);
    try {
      const result = await fn();
      onResult(result);
      toast.success("הוחל בהצלחה!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setProcessing(false);
    }
  }, [currentImage, onResult]);

  return (
    <div className="space-y-3">
      <ToneCurvesSection currentImage={currentImage} run={run} processing={processing} />
      <HSLSection currentImage={currentImage} run={run} processing={processing} />
      <WhiteBalanceSection currentImage={currentImage} run={run} processing={processing} />
      <ChannelMixerSection currentImage={currentImage} run={run} processing={processing} />
      <GradientMapSection currentImage={currentImage} run={run} processing={processing} />
      <SelectiveColorSection currentImage={currentImage} run={run} processing={processing} />
      <LUTSection currentImage={currentImage} run={run} processing={processing} />
      <NoiseReductionSection currentImage={currentImage} run={run} processing={processing} />
      <TiltShiftSection currentImage={currentImage} run={run} processing={processing} />
      <BlendModeSection currentImage={currentImage} run={run} processing={processing} />
      <TextOverlaySection currentImage={currentImage} run={run} processing={processing} />
      <GlitchSection currentImage={currentImage} run={run} processing={processing} />
      <PerspectiveSection currentImage={currentImage} run={run} processing={processing} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── 1. TONE CURVES ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
function ToneCurvesSection({ currentImage, run, processing }: {
  currentImage: string | null;
  run: (fn: () => Promise<string>) => void;
  processing: boolean;
}) {
  const [channel, setChannel] = useState<"rgb" | "red" | "green" | "blue">("rgb");
  const [curves, setCurves] = useState<ToneCurveSettings>({
    rgb: [...defaultCurvePoints],
    red: [...defaultCurvePoints],
    green: [...defaultCurvePoints],
    blue: [...defaultCurvePoints],
  });
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  const channelColors: Record<string, string> = {
    rgb: "#fff", red: "#ff4444", green: "#44ff44", blue: "#4488ff"
  };

  const points = curves[channel];

  const handleSvgClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (dragging !== null) return;
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 255);
    const y = Math.round((1 - (e.clientY - rect.top) / rect.height) * 255);
    const np = [...points, { x: Math.max(0, Math.min(255, x)), y: Math.max(0, Math.min(255, y)) }]
      .sort((a, b) => a.x - b.x);
    setCurves({ ...curves, [channel]: np });
  }, [points, curves, channel, dragging]);

  const handleDrag = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (dragging === null) return;
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 255);
    const y = Math.round((1 - (e.clientY - rect.top) / rect.height) * 255);
    const np = [...points];
    np[dragging] = { x: Math.max(0, Math.min(255, x)), y: Math.max(0, Math.min(255, y)) };
    setCurves({ ...curves, [channel]: np });
  }, [dragging, points, curves, channel]);

  const handlePointRightClick = useCallback((e: React.MouseEvent, idx: number) => {
    e.preventDefault();
    if (idx === 0 || idx === points.length - 1) return;
    const np = points.filter((_, i) => i !== idx);
    setCurves({ ...curves, [channel]: np });
  }, [points, curves, channel]);

  const curvePath = points.length >= 2
    ? `M ${points.map(p => `${(p.x / 255) * 200},${200 - (p.y / 255) * 200}`).join(" L ")}`
    : "";

  return (
    <Section title="עקומות טון" icon={<Waves className="h-4 w-4" />} defaultOpen>
      <div className="flex gap-1 mb-2">
        {(["rgb", "red", "green", "blue"] as const).map(ch => (
          <button
            key={ch}
            onClick={() => setChannel(ch)}
            className={`flex-1 py-1 text-xs rounded ${channel === ch ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            {ch === "rgb" ? "RGB" : ch === "red" ? "R" : ch === "green" ? "G" : "B"}
          </button>
        ))}
      </div>

      <div className="relative bg-black rounded-md overflow-hidden border border-border">
        <svg
          ref={svgRef}
          viewBox="0 0 200 200"
          className="w-full aspect-square cursor-crosshair"
          onClick={handleSvgClick}
          onMouseMove={handleDrag}
          onMouseUp={() => setDragging(null)}
          onMouseLeave={() => setDragging(null)}
        >
          {/* Grid */}
          {[50, 100, 150].map(v => (
            <g key={v}>
              <line x1={(v / 255) * 200} y1={0} x2={(v / 255) * 200} y2={200} stroke="#333" strokeWidth={0.5} />
              <line x1={0} y1={(v / 255) * 200} x2={200} y2={(v / 255) * 200} stroke="#333" strokeWidth={0.5} />
            </g>
          ))}
          {/* Diagonal reference */}
          <line x1={0} y1={200} x2={200} y2={0} stroke="#555" strokeWidth={0.5} strokeDasharray="4,4" />
          {/* Curve path */}
          <path d={curvePath} fill="none" stroke={channelColors[channel]} strokeWidth={2} />
          {/* Control points */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={(p.x / 255) * 200}
              cy={200 - (p.y / 255) * 200}
              r={5}
              fill={channelColors[channel]}
              stroke="#000"
              strokeWidth={1}
              className="cursor-grab active:cursor-grabbing"
              onMouseDown={(e) => { e.stopPropagation(); setDragging(i); }}
              onContextMenu={(e) => handlePointRightClick(e, i)}
            />
          ))}
        </svg>
      </div>

      <p className="text-[10px] text-muted-foreground text-center">לחץ להוספת נקודה • גרור לשינוי • קליק ימני למחיקה</p>

      <div className="flex gap-2">
        <button
          onClick={() => setCurves({
            rgb: [...defaultCurvePoints], red: [...defaultCurvePoints],
            green: [...defaultCurvePoints], blue: [...defaultCurvePoints],
          })}
          className="flex-1 py-1.5 text-xs rounded bg-muted hover:bg-muted/80 flex items-center justify-center gap-1"
        >
          <RotateCcw className="h-3 w-3" /> איפוס
        </button>
        <ApplyBtn onClick={() => run(() => applyToneCurves(currentImage!, curves))} loading={processing} />
      </div>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── 2. HSL PANEL ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
function HSLSection({ currentImage, run, processing }: {
  currentImage: string | null; run: (fn: () => Promise<string>) => void; processing: boolean;
}) {
  const [settings, setSettings] = useState<HSLSettings>({ ...defaultHSLSettings });
  const [activeChannel, setActiveChannel] = useState<keyof HSLSettings>("reds");

  const channels: { key: keyof HSLSettings; label: string; color: string }[] = [
    { key: "reds", label: "אדום", color: "#ef4444" },
    { key: "oranges", label: "כתום", color: "#f97316" },
    { key: "yellows", label: "צהוב", color: "#eab308" },
    { key: "greens", label: "ירוק", color: "#22c55e" },
    { key: "cyans", label: "תכלת", color: "#06b6d4" },
    { key: "blues", label: "כחול", color: "#3b82f6" },
    { key: "purples", label: "סגול", color: "#8b5cf6" },
    { key: "magentas", label: "מג׳נטה", color: "#ec4899" },
  ];

  const updateChannel = (key: keyof HSLChannel, val: number) => {
    setSettings(prev => ({
      ...prev,
      [activeChannel]: { ...prev[activeChannel], [key]: val },
    }));
  };

  const ch = settings[activeChannel];

  return (
    <Section title="HSL — גוון/רוויה/בהירות" icon={<Palette className="h-4 w-4" />}>
      <div className="grid grid-cols-4 gap-1">
        {channels.map(c => (
          <button
            key={c.key}
            onClick={() => setActiveChannel(c.key)}
            className={`py-1 text-[10px] rounded-md border transition-colors ${
              activeChannel === c.key
                ? "border-primary bg-primary/10 font-bold"
                : "border-transparent hover:bg-muted"
            }`}
          >
            <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: c.color }} />
            {c.label}
          </button>
        ))}
      </div>

      <Slider label="גוון" value={ch.hue} onChange={v => updateChannel("hue", v)} min={-180} max={180} />
      <Slider label="רוויה" value={ch.saturation} onChange={v => updateChannel("saturation", v)} min={-100} max={100} />
      <Slider label="בהירות" value={ch.luminance} onChange={v => updateChannel("luminance", v)} min={-100} max={100} />

      <div className="flex gap-2">
        <button
          onClick={() => setSettings({ ...defaultHSLSettings })}
          className="flex-1 py-1.5 text-xs rounded bg-muted hover:bg-muted/80 flex items-center justify-center gap-1"
        >
          <RotateCcw className="h-3 w-3" /> איפוס
        </button>
        <ApplyBtn onClick={() => run(() => applyHSL(currentImage!, settings))} loading={processing} />
      </div>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── 3. WHITE BALANCE PICKER ─────────────────────────────────
// ═══════════════════════════════════════════════════════════════
function WhiteBalanceSection({ currentImage, run, processing }: {
  currentImage: string | null; run: (fn: () => Promise<string>) => void; processing: boolean;
}) {
  const [pickMode, setPickMode] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [previewImg, setPreviewImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!currentImage || !pickMode) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setPreviewImg(img);
      const c = canvasRef.current;
      if (c) {
        const maxW = 260;
        const ratio = Math.min(maxW / img.naturalWidth, maxW / img.naturalHeight);
        c.width = Math.round(img.naturalWidth * ratio);
        c.height = Math.round(img.naturalHeight * ratio);
        const ctx = c.getContext("2d")!;
        ctx.drawImage(img, 0, 0, c.width, c.height);
      }
    };
    img.src = currentImage;
  }, [currentImage, pickMode]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!previewImg || !canvasRef.current || !currentImage) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = previewImg.naturalWidth / canvasRef.current.width;
    const scaleY = previewImg.naturalHeight / canvasRef.current.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    setPickMode(false);
    run(() => applyWhiteBalance(currentImage, x, y));
  };

  return (
    <Section title="איזון לבן (בלחיצה)" icon={<Pipette className="h-4 w-4" />}>
      <p className="text-xs text-muted-foreground">לחץ על נקודה שאמורה להיות אפורה/לבנה — המערכת תחשב את האיזון הנכון</p>
      {!pickMode ? (
        <ApplyBtn onClick={() => setPickMode(true)} loading={false} label="בחר נקודה בתמונה" />
      ) : (
        <div className="space-y-2">
          <canvas
            ref={canvasRef}
            className="w-full rounded border border-primary cursor-crosshair"
            onClick={handleCanvasClick}
          />
          <button
            onClick={() => setPickMode(false)}
            className="w-full py-1.5 text-xs rounded bg-muted hover:bg-muted/80"
          >
            ביטול
          </button>
        </div>
      )}
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── 4. CHANNEL MIXER ────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
function ChannelMixerSection({ currentImage, run, processing }: {
  currentImage: string | null; run: (fn: () => Promise<string>) => void; processing: boolean;
}) {
  const [mixer, setMixer] = useState<ChannelMixerSettings>({ ...defaultChannelMixer });
  const [outChannel, setOutChannel] = useState<"redOut" | "greenOut" | "blueOut">("redOut");

  const ch = mixer[outChannel];
  const update = (key: string, val: number) => {
    setMixer(prev => ({ ...prev, [outChannel]: { ...prev[outChannel], [key]: val } }));
  };

  const presets = [
    { label: "B&W אדום", value: { redOut: { red: 80, green: 15, blue: 5, constant: 0 }, greenOut: { red: 80, green: 15, blue: 5, constant: 0 }, blueOut: { red: 80, green: 15, blue: 5, constant: 0 } } },
    { label: "B&W ירוק", value: { redOut: { red: 10, green: 80, blue: 10, constant: 0 }, greenOut: { red: 10, green: 80, blue: 10, constant: 0 }, blueOut: { red: 10, green: 80, blue: 10, constant: 0 } } },
    { label: "ערוצים מוחלפים", value: { redOut: { red: 0, green: 0, blue: 100, constant: 0 }, greenOut: { red: 100, green: 0, blue: 0, constant: 0 }, blueOut: { red: 0, green: 100, blue: 0, constant: 0 } } },
  ];

  return (
    <Section title="מיקסר ערוצים" icon={<Blend className="h-4 w-4" />}>
      <div className="flex gap-1 mb-2">
        {(["redOut", "greenOut", "blueOut"] as const).map(ch => (
          <button
            key={ch}
            onClick={() => setOutChannel(ch)}
            className={`flex-1 py-1 text-xs rounded ${outChannel === ch ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            {ch === "redOut" ? "🔴 פלט אדום" : ch === "greenOut" ? "🟢 פלט ירוק" : "🔵 פלט כחול"}
          </button>
        ))}
      </div>

      <Slider label="אדום" value={ch.red} onChange={v => update("red", v)} min={-200} max={200} />
      <Slider label="ירוק" value={ch.green} onChange={v => update("green", v)} min={-200} max={200} />
      <Slider label="כחול" value={ch.blue} onChange={v => update("blue", v)} min={-200} max={200} />
      <Slider label="קבוע" value={ch.constant} onChange={v => update("constant", v)} min={-100} max={100} />

      <div className="flex flex-wrap gap-1">
        {presets.map(p => (
          <button
            key={p.label}
            onClick={() => setMixer(p.value)}
            className="px-2 py-1 text-[10px] rounded bg-muted hover:bg-muted/80"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button onClick={() => setMixer({ ...defaultChannelMixer })} className="flex-1 py-1.5 text-xs rounded bg-muted hover:bg-muted/80 flex items-center justify-center gap-1">
          <RotateCcw className="h-3 w-3" /> איפוס
        </button>
        <ApplyBtn onClick={() => run(() => applyChannelMixer(currentImage!, mixer))} loading={processing} />
      </div>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── 5. GRADIENT MAP ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
function GradientMapSection({ currentImage, run, processing }: {
  currentImage: string | null; run: (fn: () => Promise<string>) => void; processing: boolean;
}) {
  const [stops, setStops] = useState<GradientStop[]>(gradientMapPresets["זהב-שחור"]);
  const [intensity, setIntensity] = useState(80);

  const gradientCss = `linear-gradient(to right, ${stops.map(s => `${s.color} ${s.position * 100}%`).join(", ")})`;

  return (
    <Section title="מיפוי גרדיאנט" icon={<Palette className="h-4 w-4" />}>
      <div className="h-6 rounded-md border border-border" style={{ background: gradientCss }} />

      <div className="flex flex-wrap gap-1">
        {Object.entries(gradientMapPresets).map(([name, preset]) => (
          <button
            key={name}
            onClick={() => setStops(preset)}
            className="px-2 py-1 text-[10px] rounded bg-muted hover:bg-muted/80"
          >
            {name}
          </button>
        ))}
      </div>

      <Slider label="עוצמה" value={intensity} onChange={setIntensity} min={10} max={100} />

      <ApplyBtn onClick={() => run(() => applyGradientMap(currentImage!, stops, intensity / 100))} loading={processing} />
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── 6. SELECTIVE COLOR ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
function SelectiveColorSection({ currentImage, run, processing }: {
  currentImage: string | null; run: (fn: () => Promise<string>) => void; processing: boolean;
}) {
  const [settings, setSettings] = useState<SelectiveColorSettings>({ ...defaultSelectiveColorSettings });
  const [activeChannel, setActiveChannel] = useState<keyof SelectiveColorSettings>("reds");

  const channels: { key: keyof SelectiveColorSettings; label: string }[] = [
    { key: "reds", label: "אדום" }, { key: "yellows", label: "צהוב" },
    { key: "greens", label: "ירוק" }, { key: "cyans", label: "תכלת" },
    { key: "blues", label: "כחול" }, { key: "magentas", label: "מג׳נטה" },
    { key: "whites", label: "לבנים" }, { key: "neutrals", label: "ניטרלי" },
    { key: "blacks", label: "שחורים" },
  ];

  const ch = settings[activeChannel];
  const update = (key: string, val: number) => {
    setSettings(prev => ({
      ...prev,
      [activeChannel]: { ...prev[activeChannel], [key]: val },
    }));
  };

  return (
    <Section title="צבע סלקטיבי (CMYK)" icon={<Palette className="h-4 w-4" />}>
      <div className="grid grid-cols-3 gap-1">
        {channels.map(c => (
          <button
            key={c.key}
            onClick={() => setActiveChannel(c.key)}
            className={`py-1 text-[10px] rounded border transition-colors ${
              activeChannel === c.key ? "border-primary bg-primary/10 font-bold" : "border-transparent hover:bg-muted"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <Slider label="ציאן" value={ch.cyan} onChange={v => update("cyan", v)} min={-100} max={100} />
      <Slider label="מג׳נטה" value={ch.magenta} onChange={v => update("magenta", v)} min={-100} max={100} />
      <Slider label="צהוב" value={ch.yellow} onChange={v => update("yellow", v)} min={-100} max={100} />
      <Slider label="שחור" value={ch.black} onChange={v => update("black", v)} min={-100} max={100} />

      <div className="flex gap-2">
        <button onClick={() => setSettings({ ...defaultSelectiveColorSettings })} className="flex-1 py-1.5 text-xs rounded bg-muted hover:bg-muted/80 flex items-center justify-center gap-1">
          <RotateCcw className="h-3 w-3" /> איפוס
        </button>
        <ApplyBtn onClick={() => run(() => applySelectiveColor(currentImage!, settings))} loading={processing} />
      </div>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── 7. LUT IMPORT ───────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
function LUTSection({ currentImage, run, processing }: {
  currentImage: string | null; run: (fn: () => Promise<string>) => void; processing: boolean;
}) {
  const [lut, setLut] = useState<LUT3D | null>(null);
  const [intensity, setIntensity] = useState(100);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".cube")) {
      toast.error("קובץ LUT חייב להיות בפורמט .cube");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseCubeLUT(reader.result as string);
        setLut(parsed);
        toast.success(`LUT נטען: ${parsed.title || file.name} (${parsed.size}³)`);
      } catch {
        toast.error("שגיאה בקריאת קובץ LUT");
      }
    };
    reader.readAsText(file);
  };

  return (
    <Section title="ייבוא LUT (.cube)" icon={<FileUp className="h-4 w-4" />}>
      <p className="text-xs text-muted-foreground">ייבא קובץ .cube לצביעה קולנועית מקצועית</p>
      <input ref={fileRef} type="file" accept=".cube" onChange={handleFile} className="hidden" />
      <button
        onClick={() => fileRef.current?.click()}
        className="w-full py-2 rounded border-2 border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
      >
        {lut ? `✅ ${lut.title || "LUT"} (${lut.size}³)` : "📁 בחר קובץ .cube"}
      </button>

      {lut && (
        <>
          <Slider label="עוצמה" value={intensity} onChange={setIntensity} min={10} max={100} />
          <ApplyBtn onClick={() => run(() => applyLUT(currentImage!, lut, intensity / 100))} loading={processing} />
        </>
      )}
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── 8. NOISE REDUCTION ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
function NoiseReductionSection({ currentImage, run, processing }: {
  currentImage: string | null; run: (fn: () => Promise<string>) => void; processing: boolean;
}) {
  const [strength, setStrength] = useState(40);
  const [detail, setDetail] = useState(50);

  return (
    <Section title="הפחתת רעש" icon={<Minus className="h-4 w-4" />}>
      <Slider label="חוזק" value={strength} onChange={setStrength} min={10} max={100} />
      <Slider label="שימור פרטים" value={detail} onChange={setDetail} min={10} max={90} />
      <p className="text-[10px] text-muted-foreground">⚠️ עיבוד כבד — תמונות גדולות ייקחו זמן</p>
      <ApplyBtn onClick={() => run(() => applyNoiseReduction(currentImage!, strength, detail))} loading={processing} />
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── 9. TILT-SHIFT ───────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
function TiltShiftSection({ currentImage, run, processing }: {
  currentImage: string | null; run: (fn: () => Promise<string>) => void; processing: boolean;
}) {
  const [focusY, setFocusY] = useState(50);
  const [focusWidth, setFocusWidth] = useState(25);
  const [blurAmount, setBlurAmount] = useState(8);

  return (
    <Section title="Tilt-Shift (מיניאטורה)" icon={<Sparkles className="h-4 w-4" />}>
      <Slider label="מיקוד (Y)" value={focusY} onChange={setFocusY} min={10} max={90} />
      <Slider label="רוחב פוקוס" value={focusWidth} onChange={setFocusWidth} min={5} max={60} />
      <Slider label="טשטוש" value={blurAmount} onChange={setBlurAmount} min={2} max={20} />
      <ApplyBtn onClick={() => run(() => applyTiltShift(currentImage!, focusY / 100, focusWidth / 100, blurAmount))} loading={processing} />
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── 10. BLEND MODE / DOUBLE EXPOSURE ────────────────────────
// ═══════════════════════════════════════════════════════════════
function BlendModeSection({ currentImage, run, processing }: {
  currentImage: string | null; run: (fn: () => Promise<string>) => void; processing: boolean;
}) {
  const [overlayImage, setOverlayImage] = useState<string | null>(null);
  const [mode, setMode] = useState<BlendMode>("multiply");
  const [opacity, setOpacity] = useState(70);
  const fileRef = useRef<HTMLInputElement>(null);

  const modes: { value: BlendMode; label: string }[] = [
    { value: "multiply", label: "Multiply" },
    { value: "screen", label: "Screen" },
    { value: "overlay", label: "Overlay" },
    { value: "soft-light", label: "Soft Light" },
    { value: "hard-light", label: "Hard Light" },
    { value: "color-dodge", label: "Color Dodge" },
    { value: "color-burn", label: "Color Burn" },
    { value: "difference", label: "Difference" },
    { value: "exclusion", label: "Exclusion" },
    { value: "luminosity", label: "Luminosity" },
    { value: "color", label: "Color" },
  ];

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setOverlayImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <Section title="חשיפה כפולה / Blend Modes" icon={<Blend className="h-4 w-4" />}>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      <button
        onClick={() => fileRef.current?.click()}
        className="w-full py-2 rounded border-2 border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
      >
        {overlayImage ? "✅ תמונת שכבה נטענה" : "📁 בחר תמונת שכבה"}
      </button>

      {overlayImage && (
        <>
          <div className="grid grid-cols-3 gap-1">
            {modes.map(m => (
              <button
                key={m.value}
                onClick={() => setMode(m.value)}
                className={`py-1 text-[10px] rounded ${mode === m.value ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <Slider label="שקיפות" value={opacity} onChange={setOpacity} min={10} max={100} />
          <ApplyBtn onClick={() => run(() => applyBlendMode(currentImage!, overlayImage, mode, opacity / 100))} loading={processing} />
        </>
      )}
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── 11. TEXT OVERLAY ────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
function TextOverlaySection({ currentImage, run, processing }: {
  currentImage: string | null; run: (fn: () => Promise<string>) => void; processing: boolean;
}) {
  const [opts, setOpts] = useState<TextOverlayOptions>({
    text: "",
    x: 0.5,
    y: 0.5,
    fontSize: 48,
    fontFamily: "Arial",
    color: "#ffffff",
    strokeColor: "#000000",
    strokeWidth: 2,
    rotation: 0,
    opacity: 1,
    shadow: true,
  });

  const fonts = ["Arial", "Georgia", "Courier New", "Impact", "Verdana", "Tahoma", "David", "Miriam"];

  const update = (key: string, val: string | number | boolean) => setOpts(prev => ({ ...prev, [key]: val }));

  return (
    <Section title="טקסט על התמונה" icon={<Type className="h-4 w-4" />}>
      <input
        type="text"
        placeholder="הכנס טקסט..."
        value={opts.text}
        onChange={e => update("text", e.target.value)}
        className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
        dir="auto"
      />

      <div className="grid grid-cols-4 gap-1">
        {fonts.map(f => (
          <button
            key={f}
            onClick={() => update("fontFamily", f)}
            className={`py-1 text-[10px] rounded ${opts.fontFamily === f ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
            style={{ fontFamily: f }}
          >
            {f}
          </button>
        ))}
      </div>

      <Slider label="גודל" value={opts.fontSize} onChange={v => update("fontSize", v)} min={12} max={200} />
      <Slider label="מיקום X" value={Math.round(opts.x * 100)} onChange={v => update("x", v / 100)} min={0} max={100} />
      <Slider label="מיקום Y" value={Math.round(opts.y * 100)} onChange={v => update("y", v / 100)} min={0} max={100} />
      <Slider label="סיבוב" value={opts.rotation || 0} onChange={v => update("rotation", v)} min={-180} max={180} />
      <Slider label="שקיפות" value={Math.round((opts.opacity || 1) * 100)} onChange={v => update("opacity", v / 100)} min={10} max={100} />
      <Slider label="קו מתאר" value={opts.strokeWidth || 0} onChange={v => update("strokeWidth", v)} min={0} max={10} />

      <div className="flex gap-2 items-center">
        <label className="text-xs text-muted-foreground">צבע:</label>
        <input type="color" value={opts.color} onChange={e => update("color", e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
        <label className="text-xs text-muted-foreground">מתאר:</label>
        <input type="color" value={opts.strokeColor || "#000"} onChange={e => update("strokeColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={opts.shadow} onChange={e => update("shadow", e.target.checked)} />
          צל
        </label>
      </div>

      <ApplyBtn
        onClick={() => {
          if (!opts.text.trim()) { toast.error("הכנס טקסט"); return; }
          run(() => applyTextOverlay(currentImage!, opts));
        }}
        loading={processing}
      />
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── 12. GLITCH / CREATIVE EFFECTS ──────────────────────────
// ═══════════════════════════════════════════════════════════════
function GlitchSection({ currentImage, run, processing }: {
  currentImage: string | null; run: (fn: () => Promise<string>) => void; processing: boolean;
}) {
  const [effect, setEffect] = useState<GlitchEffect>("rgb-split");
  const [intensity, setIntensity] = useState(50);

  const effects: { value: GlitchEffect; label: string; emoji: string }[] = [
    { value: "rgb-split", label: "RGB Split", emoji: "🌈" },
    { value: "scanlines", label: "קווי סריקה", emoji: "📺" },
    { value: "pixelate", label: "פיקסלים", emoji: "🟩" },
    { value: "halftone", label: "Halftone", emoji: "⚫" },
    { value: "duotone", label: "Duotone", emoji: "🎨" },
  ];

  return (
    <Section title="אפקטים יצירתיים" icon={<Zap className="h-4 w-4" />}>
      <div className="grid grid-cols-3 gap-1">
        {effects.map(e => (
          <button
            key={e.value}
            onClick={() => setEffect(e.value)}
            className={`py-1.5 text-[10px] rounded ${effect === e.value ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
          >
            {e.emoji} {e.label}
          </button>
        ))}
      </div>
      <Slider label="עוצמה" value={intensity} onChange={setIntensity} min={10} max={100} />
      <ApplyBtn onClick={() => run(() => applyGlitchEffect(currentImage!, effect, intensity))} loading={processing} />
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── 13. PERSPECTIVE CORRECTION ──────────────────────────────
// ═══════════════════════════════════════════════════════════════
function PerspectiveSection({ currentImage, run, processing }: {
  currentImage: string | null; run: (fn: () => Promise<string>) => void; processing: boolean;
}) {
  const [vertical, setVertical] = useState(0);
  const [horizontal, setHorizontal] = useState(0);

  const buildPoints = (): PerspectivePoints => {
    // Simple keystone correction based on V/H sliders
    const vShift = vertical * 2;
    const hShift = horizontal * 2;
    return {
      topLeft: { x: Math.max(0, -hShift + vShift), y: Math.max(0, -vShift + hShift) },
      topRight: { x: 1000 + Math.min(0, hShift + vShift), y: Math.max(0, -vShift - hShift) },
      bottomLeft: { x: Math.max(0, -hShift - vShift), y: 1000 + Math.min(0, vShift + hShift) },
      bottomRight: { x: 1000 + Math.min(0, hShift - vShift), y: 1000 + Math.min(0, vShift - hShift) },
    };
  };

  return (
    <Section title="תיקון פרספקטיבה" icon={<Move className="h-4 w-4" />}>
      <Slider label="אנכי" value={vertical} onChange={setVertical} min={-50} max={50} />
      <Slider label="אופקי" value={horizontal} onChange={setHorizontal} min={-50} max={50} />
      <div className="flex gap-2">
        <button onClick={() => { setVertical(0); setHorizontal(0); }} className="flex-1 py-1.5 text-xs rounded bg-muted hover:bg-muted/80 flex items-center justify-center gap-1">
          <RotateCcw className="h-3 w-3" /> איפוס
        </button>
        <ApplyBtn onClick={() => run(() => {
          const pts = buildPoints();
          return applyPerspective(currentImage!, pts);
        })} loading={processing} />
      </div>
    </Section>
  );
}
