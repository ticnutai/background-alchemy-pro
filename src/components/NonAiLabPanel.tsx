import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  addFilmGrain,
  embossImage,
  medianDenoise,
  posterizeImage,
  sharpenImage,
  sobelEdgeDetect,
} from "@/lib/smart-image-tools";

type NonAiLabPanelProps = {
  currentImage: string;
  onResult: (img: string) => void;
};

export default function NonAiLabPanel({ currentImage, onResult }: NonAiLabPanelProps) {
  const [busy, setBusy] = useState(false);
  const [edgeStrength, setEdgeStrength] = useState(1.1);
  const [denoiseRadius, setDenoiseRadius] = useState(1);
  const [posterizeLevels, setPosterizeLevels] = useState(6);
  const [filmGrain, setFilmGrain] = useState(0.08);
  const [sharpness, setSharpness] = useState(1.2);

  const run = async (label: string, action: () => Promise<string>) => {
    if (!currentImage) {
      toast.error("אין תמונה לעיבוד");
      return;
    }
    setBusy(true);
    try {
      const out = await action();
      onResult(out);
      toast.success(`${label} הוחל`);
    } catch {
      toast.error(`שגיאה בהפעלת ${label}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Non-AI Pro Lab</Label>
        <Badge variant="secondary">ללא AI</Badge>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span>זיהוי קצוות (Sobel)</span>
          <span>{edgeStrength.toFixed(2)}</span>
        </div>
        <Slider value={[edgeStrength]} onValueChange={([v]) => setEdgeStrength(v)} min={0.4} max={2.8} step={0.1} />
        <Button disabled={busy} variant="outline" className="w-full" onClick={() => run("זיהוי קצוות", () => sobelEdgeDetect(currentImage, { strength: edgeStrength }))}>
          הפעל זיהוי קצוות
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span>הפחתת רעש (Median)</span>
          <span>רדיוס {denoiseRadius}</span>
        </div>
        <Slider value={[denoiseRadius]} onValueChange={([v]) => setDenoiseRadius(v)} min={1} max={3} step={1} />
        <Button disabled={busy} variant="outline" className="w-full" onClick={() => run("הפחתת רעש", () => medianDenoise(currentImage, { radius: denoiseRadius }))}>
          הפעל הפחתת רעש
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span>Posterize</span>
          <span>{posterizeLevels} רמות</span>
        </div>
        <Slider value={[posterizeLevels]} onValueChange={([v]) => setPosterizeLevels(v)} min={2} max={14} step={1} />
        <Button disabled={busy} variant="outline" className="w-full" onClick={() => run("Posterize", () => posterizeImage(currentImage, { levels: posterizeLevels }))}>
          הפעל Posterize
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span>Film Grain</span>
          <span>{Math.round(filmGrain * 100)}%</span>
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
          <span>{sharpness.toFixed(1)}</span>
        </div>
        <Slider value={[sharpness]} onValueChange={([v]) => setSharpness(v)} min={0.4} max={2.6} step={0.1} />
      </div>
    </div>
  );
}
