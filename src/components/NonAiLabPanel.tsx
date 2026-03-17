import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Image, SlidersHorizontal, Layers, Crop, Download, X } from "lucide-react";
import { RotateCcw, Image, SlidersHorizontal, Layers, Crop, Download, X } from "lucide-react";
import {
  addFilmGrain,
  colorBasedRemoveBg,
  embossImage,
  medianDenoise,
  posterizeImage,
  removeWhiteBg,
  sharpenImage,
  smartRemoveBg,
  sobelEdgeDetect,
} from "@/lib/smart-image-tools";
import type { SmartBgMode } from "@/lib/smart-image-tools";

type NonAiLabPanelProps = {
  currentImage: string;
  onResult: (img: string) => void;
  onNavigate?: (tab: string) => void;
};

export default function NonAiLabPanel({ currentImage, onResult, onNavigate }: NonAiLabPanelProps) {
  const [busy, setBusy] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [edgeStrength, setEdgeStrength] = useState(1.1);
  const [denoiseRadius, setDenoiseRadius] = useState(1);
  const [posterizeLevels, setPosterizeLevels] = useState(6);
  const [filmGrain, setFilmGrain] = useState(0.08);
  const [sharpness, setSharpness] = useState(1.2);

  // Smart BG removal controls
  const [bgMode, setBgMode] = useState<SmartBgMode>("auto");
  const [bgSensitivity, setBgSensitivity] = useState(50);
  const [bgEdgeDetail, setBgEdgeDetail] = useState(70);
  const [bgNoiseClean, setBgNoiseClean] = useState(50);
  const [bgMorphStrength, setBgMorphStrength] = useState(1);
  const [bgForegroundBoost, setBgForegroundBoost] = useState(true);
  const [bgUseDE2000, setBgUseDE2000] = useState(true);
  const [bgSpillRemoval, setBgSpillRemoval] = useState(60);
  const [bgAutoThreshold, setBgAutoThreshold] = useState(true);
  const [bgBilateralSmooth, setBgBilateralSmooth] = useState(30);

  // Color-based removal controls
  const [chromaTolerance, setChromaTolerance] = useState(30);
  const [chromaSoftness, setChromaSoftness] = useState(2);
  const [chromaUseLab, setChromaUseLab] = useState(true);
  const [chromaRefine, setChromaRefine] = useState(true);

  // White BG removal controls
  const [whiteThreshold, setWhiteThreshold] = useState(240);
  const [whiteFeather, setWhiteFeather] = useState(15);

  const run = async (label: string, action: () => Promise<string>, isBgRemoval = false) => {
    if (!currentImage) {
      toast.error("אין תמונה לעיבוד");
      return;
    }
    setBusy(true);
    try {
      const out = await action();
      onResult(out);
      toast.success(`${label} הוחל`);
      if (isBgRemoval) setShowActions(true);
    } catch {
      toast.error(`שגיאה בהפעלת ${label}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Post-removal action menu ── */}
      {showActions && onNavigate && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold text-green-700 dark:text-green-400">✅ הרקע הוסר — המשך עריכה</Label>
            <button onClick={() => setShowActions(false)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Button variant="outline" size="sm" className="text-[11px] gap-1.5 h-8" onClick={() => { onNavigate("backgrounds"); setShowActions(false); }}>
              <Image className="h-3.5 w-3.5" />החלפת רקע
            </Button>
            <Button variant="outline" size="sm" className="text-[11px] gap-1.5 h-8" onClick={() => { onNavigate("adjust"); setShowActions(false); }}>
              <SlidersHorizontal className="h-3.5 w-3.5" />התאמות
            </Button>
            <Button variant="outline" size="sm" className="text-[11px] gap-1.5 h-8" onClick={() => { onNavigate("filters"); setShowActions(false); }}>
              <Layers className="h-3.5 w-3.5" />פילטרים
            </Button>
            <Button variant="outline" size="sm" className="text-[11px] gap-1.5 h-8" onClick={() => { onNavigate("crop"); setShowActions(false); }}>
              <Crop className="h-3.5 w-3.5" />חיתוך
            </Button>
            <Button variant="outline" size="sm" className="text-[11px] gap-1.5 h-8 col-span-2" onClick={() => { onNavigate("export"); setShowActions(false); }}>
              <Download className="h-3.5 w-3.5" />ייצוא תמונה
            </Button>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Non-AI Pro Lab</Label>
        <div className="flex items-center gap-2">
          {(edgeStrength !== 1.1 || denoiseRadius !== 1 || posterizeLevels !== 6 || filmGrain !== 0.08 || sharpness !== 1.2) && (
            <button
              onClick={() => { setEdgeStrength(1.1); setDenoiseRadius(1); setPosterizeLevels(6); setFilmGrain(0.08); setSharpness(1.2); }}
              className="flex items-center gap-1 font-body text-xs text-primary hover:underline"
            >
              <RotateCcw className="h-3 w-3" /> איפוס הכל
            </button>
          )}
          <Badge variant="secondary">ללא AI</Badge>
        </div>
      </div>

      {/* ── Smart Background Removal ── */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-bold text-primary">🎯 הסרת רקע חכמה</Label>
          <Badge variant="outline" className="text-[10px]">ΔE00 + GMM + Guided + Bilateral</Badge>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1 text-[10px]">
            <span>מצב:</span>
            {(["auto", "white", "color", "gradient"] as SmartBgMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setBgMode(m)}
                className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                  bgMode === m
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-muted hover:border-primary/50"
                }`}
              >
                {m === "auto" ? "אוטומטי" : m === "white" ? "רקע לבן" : m === "color" ? "צבע אחיד" : "גרדיאנט"}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[10px]">
            <span>רגישות</span><span>{bgSensitivity}%</span>
          </div>
          <Slider value={[bgSensitivity]} onValueChange={([v]) => setBgSensitivity(v)} min={10} max={90} step={5} />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[10px]">
            <span>פירוט קצוות</span><span>{bgEdgeDetail}%</span>
          </div>
          <Slider value={[bgEdgeDetail]} onValueChange={([v]) => setBgEdgeDetail(v)} min={0} max={100} step={5} />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[10px]">
            <span>ניקוי רעש</span><span>{bgNoiseClean}%</span>
          </div>
          <Slider value={[bgNoiseClean]} onValueChange={([v]) => setBgNoiseClean(v)} min={0} max={100} step={5} />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[10px]">
            <span>עוצמת מורפולוגיה</span><span>{bgMorphStrength}</span>
          </div>
          <Slider value={[bgMorphStrength]} onValueChange={([v]) => setBgMorphStrength(v)} min={0} max={3} step={1} />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="fg-boost"
            checked={bgForegroundBoost}
            onChange={(e) => setBgForegroundBoost(e.target.checked)}
            className="rounded border-muted"
          />
          <label htmlFor="fg-boost" className="text-[10px]">חיזוק קצוות (אנטי-הילה)</label>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="de2000"
            checked={bgUseDE2000}
            onChange={(e) => setBgUseDE2000(e.target.checked)}
            className="rounded border-muted"
          />
          <label htmlFor="de2000" className="text-[10px]">CIEDE2000 (מדויק יותר)</label>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="auto-thresh"
            checked={bgAutoThreshold}
            onChange={(e) => setBgAutoThreshold(e.target.checked)}
            className="rounded border-muted"
          />
          <label htmlFor="auto-thresh" className="text-[10px]">סף אוטומטי (Otsu)</label>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[10px]">
            <span>הסרת זליגת צבע</span><span>{bgSpillRemoval}%</span>
          </div>
          <Slider value={[bgSpillRemoval]} onValueChange={([v]) => setBgSpillRemoval(v)} min={0} max={100} step={5} />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[10px]">
            <span>החלקה דו-צדדית</span><span>{bgBilateralSmooth}%</span>
          </div>
          <Slider value={[bgBilateralSmooth]} onValueChange={([v]) => setBgBilateralSmooth(v)} min={0} max={100} step={5} />
        </div>

        <Button
          disabled={busy}
          className="w-full"
          onClick={() =>
            run("הסרת רקע חכמה", () =>
              smartRemoveBg(currentImage, {
                mode: bgMode,
                sensitivity: bgSensitivity,
                edgeDetail: bgEdgeDetail,
                noiseClean: bgNoiseClean,
                morphStrength: bgMorphStrength,
                foregroundBoost: bgForegroundBoost,
                useDE2000: bgUseDE2000,
                spillRemoval: bgSpillRemoval,
                autoThreshold: bgAutoThreshold,
                bilateralSmooth: bgBilateralSmooth,
              }),
              true
            )
          }
        >
          {busy ? "מעבד..." : "הפעל הסרת רקע חכמה"}
        </Button>
      </div>

      {/* ── Color Chromakey ── */}
      <div className="rounded-lg border p-3 space-y-2">
        <Label className="text-xs font-semibold">הסרת רקע לפי צבע (Lab)</Label>

        <div className="space-y-1">
          <div className="flex justify-between text-[10px]">
            <span>סבילות</span><span>{chromaTolerance}</span>
          </div>
          <Slider value={[chromaTolerance]} onValueChange={([v]) => setChromaTolerance(v)} min={5} max={80} step={1} />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[10px]">
            <span>רכות קצה</span><span>{chromaSoftness}</span>
          </div>
          <Slider value={[chromaSoftness]} onValueChange={([v]) => setChromaSoftness(v)} min={0} max={5} step={0.5} />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <input type="checkbox" id="lab-mode" checked={chromaUseLab} onChange={(e) => setChromaUseLab(e.target.checked)} className="rounded" />
            <label htmlFor="lab-mode" className="text-[10px]">Lab צבע</label>
          </div>
          <div className="flex items-center gap-1">
            <input type="checkbox" id="refine-edges" checked={chromaRefine} onChange={(e) => setChromaRefine(e.target.checked)} className="rounded" />
            <label htmlFor="refine-edges" className="text-[10px]">עידון קצוות</label>
          </div>
        </div>

        <Button
          disabled={busy}
          variant="outline"
          className="w-full"
          onClick={() =>
            run("Chromakey Lab", () =>
              colorBasedRemoveBg(currentImage, {
                tolerance: chromaTolerance,
                edgeSoftness: chromaSoftness,
                useLabColor: chromaUseLab,
                refineEdges: chromaRefine,
              }),
              true
            )
          }
        >
          הפעל Chromakey
        </Button>
      </div>

      {/* ── White BG Removal ── */}
      <div className="rounded-lg border p-3 space-y-2">
        <Label className="text-xs font-semibold">הסרת רקע לבן</Label>

        <div className="space-y-1">
          <div className="flex justify-between text-[10px]">
            <span>סף בהירות</span><span>{whiteThreshold}</span>
          </div>
          <Slider value={[whiteThreshold]} onValueChange={([v]) => setWhiteThreshold(v)} min={200} max={255} step={1} />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[10px]">
            <span>רכות מעבר</span><span>{whiteFeather}</span>
          </div>
          <Slider value={[whiteFeather]} onValueChange={([v]) => setWhiteFeather(v)} min={0} max={40} step={1} />
        </div>

        <Button
          disabled={busy}
          variant="outline"
          className="w-full"
          onClick={() =>
            run("הסרת רקע לבן", () =>
              removeWhiteBg(currentImage, {
                threshold: whiteThreshold,
                feather: whiteFeather,
              }),
              true
            )
          }
        >
          הפעל הסרת רקע לבן
        </Button>
      </div>

      {/* ── Original tools ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span>זיהוי קצוות (Sobel)</span>
          <div className="flex items-center gap-1">
            <span>{edgeStrength.toFixed(2)}</span>
            {edgeStrength !== 1.1 && (
              <button onClick={() => setEdgeStrength(1.1)} className="flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="איפוס"><RotateCcw className="h-2.5 w-2.5" /></button>
            )}
          </div>
        </div>
        <Slider value={[edgeStrength]} onValueChange={([v]) => setEdgeStrength(v)} min={0.4} max={2.8} step={0.1} />
        <Button disabled={busy} variant="outline" className="w-full" onClick={() => run("זיהוי קצוות", () => sobelEdgeDetect(currentImage, { strength: edgeStrength }))}>
          הפעל זיהוי קצוות
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span>הפחתת רעש (Median)</span>
          <div className="flex items-center gap-1">
            <span>רדיוס {denoiseRadius}</span>
            {denoiseRadius !== 1 && (
              <button onClick={() => setDenoiseRadius(1)} className="flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="איפוס"><RotateCcw className="h-2.5 w-2.5" /></button>
            )}
          </div>
        </div>
        <Slider value={[denoiseRadius]} onValueChange={([v]) => setDenoiseRadius(v)} min={1} max={3} step={1} />
        <Button disabled={busy} variant="outline" className="w-full" onClick={() => run("הפחתת רעש", () => medianDenoise(currentImage, { radius: denoiseRadius }))}>
          הפעל הפחתת רעש
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span>Posterize</span>
          <div className="flex items-center gap-1">
            <span>{posterizeLevels} רמות</span>
            {posterizeLevels !== 6 && (
              <button onClick={() => setPosterizeLevels(6)} className="flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="איפוס"><RotateCcw className="h-2.5 w-2.5" /></button>
            )}
          </div>
        </div>
        <Slider value={[posterizeLevels]} onValueChange={([v]) => setPosterizeLevels(v)} min={2} max={14} step={1} />
        <Button disabled={busy} variant="outline" className="w-full" onClick={() => run("Posterize", () => posterizeImage(currentImage, { levels: posterizeLevels }))}>
          הפעל Posterize
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span>Film Grain</span>
          <div className="flex items-center gap-1">
            <span>{Math.round(filmGrain * 100)}%</span>
            {filmGrain !== 0.08 && (
              <button onClick={() => setFilmGrain(0.08)} className="flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="איפוס"><RotateCcw className="h-2.5 w-2.5" /></button>
            )}
          </div>
        </div>
        <Slider value={[filmGrain]} onValueChange={([v]) => setFilmGrain(v)} min={0.01} max={0.25} step={0.01} />
        <Button disabled={busy} variant="outline" className="w-full" onClick={() => run("Film Grain", () => addFilmGrain(currentImage, { amount: filmGrain }))}>
          הוסף גרעיניות
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button disabled={busy} variant="outline" onClick={() => run("Emboss", () => embossImage(currentImage))}>
          Emboss
        </Button>
        <Button disabled={busy} variant="outline" onClick={() => run("Sharpen", () => sharpenImage(currentImage, { amount: sharpness }))}>
          חידוד
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span>עוצמת חידוד</span>
          <div className="flex items-center gap-1">
            <span>{sharpness.toFixed(1)}</span>
            {sharpness !== 1.2 && (
              <button onClick={() => setSharpness(1.2)} className="flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="איפוס"><RotateCcw className="h-2.5 w-2.5" /></button>
            )}
          </div>
        </div>
        <Slider value={[sharpness]} onValueChange={([v]) => setSharpness(v)} min={0.4} max={2.6} step={0.1} />
      </div>
    </div>
  );
}
