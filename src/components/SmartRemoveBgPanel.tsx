import { useState, useCallback } from "react";
import { Scissors, Sparkles, Eye, RotateCcw, CheckCircle2, Cpu, Cloud, Loader2, Save, Copy, X, Download, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { removeBgPrecise, segmentProduct } from "@/lib/ai-tools";
import { compressImage } from "@/lib/image-compress";
import { Progress } from "@/components/ui/progress";

interface SmartRemoveBgPanelProps {
  currentImage: string;
  onResult: (img: string) => void;
  onDuplicate?: (img: string) => void;
}

/** Crop a region [x1,y1,x2,y2] (0-1 normalized OR pixels) from an image URL */
async function cropElementFromImage(
  imageUrl: string,
  box: [number, number, number, number],
  normalised = false
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const iw = img.naturalWidth, ih = img.naturalHeight;
      const [rx1, ry1, rx2, ry2] = normalised
        ? [box[0] * iw, box[1] * ih, box[2] * iw, box[3] * ih]
        : box;
      const w = Math.max(1, Math.round(rx2 - rx1));
      const h = Math.max(1, Math.round(ry2 - ry1));
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, Math.round(rx1), Math.round(ry1), w, h, 0, 0, w, h);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = imageUrl;
  });
}

function downloadDataUrl(dataUrl: string, filename = "element.png") {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

type Method = "local" | "bria" | "segment";

const methods = [
  {
    id: "local" as Method,
    label: "הסרה מקומית (ללא AI ענן)",
    desc: "RMBG-1.4 ONNX — רץ ישירות בדפדפן שלך ללא שליחת נתונים לשרת. פרטיות מוחלטת, עובד אפילו אופליין",
    icon: "💻",
    badge: "מקומי",
    badgeColor: "bg-accent/15 text-accent",
    features: ["ללא API", "פרטיות מלאה", "עובד אופליין", "WebAssembly"],
  },
  {
    id: "bria" as Method,
    label: "הסרת רקע מדויקת (AI)",
    desc: "BRIA RMBG 2.0 — המודל המתקדם ביותר בענן. מזהה קצוות מורכבים, שיער, שקיפויות וצללים",
    icon: "✂️",
    badge: "AI מומלץ",
    badgeColor: "bg-primary/15 text-primary",
    features: ["קצוות מורכבים", "שיער ופרווה", "שקיפות חלקית", "צללים רכים"],
  },
  {
    id: "segment" as Method,
    label: "זיהוי אלמנטים חכם (AI)",
    desc: "Grounding DINO + SAM2 — מזהה כל אלמנט בתמונה בנפרד. מושלם למוצרים מרובים",
    icon: "🔍",
    badge: "AI מתקדם",
    badgeColor: "bg-gold/15 text-gold",
    features: ["זיהוי מרובה", "מיפוי אזורים", "חיתוך לפי אובייקט", "מסכה לכל אלמנט"],
  },
];

export default function SmartRemoveBgPanel({ currentImage, onResult, onDuplicate }: SmartRemoveBgPanelProps) {
  const [selectedMethod, setSelectedMethod] = useState<Method>("local");
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [segmentResults, setSegmentResults] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  /** Cropped per-element URLs for the segment method */
  const [elementImages, setElementImages] = useState<{ url: string; label: string }[]>([]);

  const handleLocalRemoveBg = useCallback(async (imageBase64: string) => {
    setProgressLabel("טוען מודל ONNX לדפדפן...");
    setProgress(10);

    // Dynamic import to avoid loading the heavy library until needed
    const { removeBackground } = await import("@imgly/background-removal");

    setProgressLabel("מעבד תמונה מקומית...");
    setProgress(30);

    // Convert base64 to blob for the library
    const response = await fetch(imageBase64);
    const blob = await response.blob();

    setProgress(40);
    setProgressLabel("מפעיל מודל הסרת רקע...");

    const resultBlob = await removeBackground(blob, {
      publicPath: "https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/",
      progress: (key: string, current: number, total: number) => {
        if (total > 0) {
          const pct = Math.round((current / total) * 100);
          if (key.includes("fetch") || key.includes("download")) {
            setProgress(10 + pct * 0.3); // 10-40%
            setProgressLabel("מוריד מודל...");
          } else if (key.includes("compute") || key.includes("inference")) {
            setProgress(40 + pct * 0.55); // 40-95%
            setProgressLabel("מעבד פיקסלים...");
          }
        }
      },
    });

    setProgress(95);
    setProgressLabel("מכין תוצאה...");

    // Convert blob to data URL
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProgress(100);
        resolve(reader.result as string);
      };
      reader.readAsDataURL(resultBlob);
    });
  }, []);

  const handleRemoveBg = useCallback(async () => {
    if (!currentImage) {
      toast.error("אין תמונה לעיבוד");
      return;
    }
    setProcessing(true);
    setPreviewUrl(null);
    setSegmentResults(null);
    setElementImages([]);
    setProgress(0);
    setProgressLabel("");

    try {
      if (selectedMethod === "local") {
        const resultUrl = await handleLocalRemoveBg(currentImage);
        setPreviewUrl(resultUrl);
        // ← do NOT call onResult here; wait for user confirmation
        toast.success("הרקע הוסר — בחר שמור או בטל");
      } else {
        const compressed = await compressImage(currentImage);

        if (selectedMethod === "bria") {
          setProgressLabel("שולח ל-AI...");
          setProgress(20);
          const result = await removeBgPrecise(compressed, (p) => setProgress(20 + p * 0.8));
          setPreviewUrl(result.resultImage);
          // ← wait for user confirmation
          toast.success("הרקע הוסר — בחר שמור או בטל");
        } else {
          setProgressLabel("מזהה אלמנטים...");
          setProgress(20);
          const result = await segmentProduct(compressed);
          setSegmentResults(result);

          // Resolve main preview URL
          let outputUrl: string | null = null;
          if (result.segmentation) {
            outputUrl = typeof result.segmentation === "string"
              ? result.segmentation
              : Array.isArray(result.segmentation) && result.segmentation[0]
                ? result.segmentation[0]
                : null;
          }
          if (outputUrl) setPreviewUrl(outputUrl);

          // Build per-element images from segmentation array or bounding boxes
          const elements: { url: string; label: string }[] = [];
          if (Array.isArray(result.segmentation) && result.segmentation.length > 1) {
            // Each item is already a separate masked image
            result.segmentation.forEach((url: string, i: number) => {
              const lbl = Array.isArray(result.detections) && result.detections[i]
                ? (result.detections[i] as any).label ?? `אלמנט ${i + 1}`
                : `אלמנט ${i + 1}`;
              elements.push({ url, label: lbl });
            });
          } else if (outputUrl && Array.isArray(result.detections) && result.detections.length > 0) {
            // Crop each bounding-box from the result image
            for (let i = 0; i < result.detections.length; i++) {
              const det = result.detections[i] as any;
              const box = det.box ?? det.bbox ?? det.bounding_box;
              if (!box) continue;
              // Support both [x1,y1,x2,y2] and {x,y,w,h} formats
              const rect: [number, number, number, number] = Array.isArray(box)
                ? box
                : [box.x, box.y, box.x + box.w, box.y + box.h];
              // Detect if normalised (all values 0-1)
              const isNorm = rect.every((v) => v <= 1);
              try {
                const cropped = await cropElementFromImage(outputUrl!, rect, isNorm);
                elements.push({ url: cropped, label: det.label ?? det.class ?? `אלמנט ${i + 1}` });
              } catch { /* skip */ }
            }
          }
          setElementImages(elements);
          toast.success(`זוהו ${result.detections?.length || 0} אלמנטים — בחר שמור או בטל`);
        }
      }
      setProgress(100);
    } catch (err: any) {
      toast.error(err.message || "שגיאה בהסרת הרקע");
    } finally {
      setProcessing(false);
    }
  }, [currentImage, selectedMethod, onResult, handleLocalRemoveBg]);

  return (
    <div className="space-y-4 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scissors className="h-5 w-5 text-primary" />
          <h3 className="font-display text-sm font-bold text-foreground">הסרת רקע חכמה</h3>
        </div>
        {previewUrl && (
          <button
            onClick={() => { setPreviewUrl(null); setSegmentResults(null); setElementImages([]); setProgress(0); }}
            className="flex items-center gap-1 font-body text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            <X className="h-3 w-3" /> נקה
          </button>
        )}
      </div>

      <p className="font-body text-[11px] text-muted-foreground leading-relaxed">
        הסרת רקע מקומית (בדפדפן) או באמצעות AI בענן — בחר את השיטה המתאימה לך.
      </p>

      {/* Method selection */}
      <div className="space-y-2">
        {methods.map((m) => (
          <button
            key={m.id}
            onClick={() => setSelectedMethod(m.id)}
            disabled={processing}
            className={`w-full rounded-lg border-2 p-3 text-right transition-all ${
              selectedMethod === m.id
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/40"
            } disabled:opacity-50`}
          >
            <div className="flex items-start gap-2">
              <span className="text-lg mt-0.5">{m.icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-display text-xs font-bold text-foreground">{m.label}</span>
                  <span className={`rounded-full px-1.5 py-0.5 font-accent text-[9px] font-bold ${m.badgeColor}`}>
                    {m.badge}
                  </span>
                  {m.id === "local" && <Cpu className="h-3 w-3 text-accent" />}
                  {(m.id === "bria" || m.id === "segment") && <Cloud className="h-3 w-3 text-primary" />}
                </div>
                <p className="font-body text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{m.desc}</p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {m.features.map((f) => (
                    <span key={f} className="rounded-md bg-muted px-1.5 py-0.5 font-body text-[9px] text-muted-foreground">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
              {selectedMethod === m.id && <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-1" />}
            </div>
          </button>
        ))}
      </div>

      {/* Progress */}
      {processing && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="flex items-center justify-between">
            <span className="font-body text-[10px] text-muted-foreground">{progressLabel}</span>
            <span className="font-accent text-[10px] font-bold text-primary">{Math.round(progress)}%</span>
          </div>
        </div>
      )}

      {/* Preview + action buttons */}
      {previewUrl && !processing && (
        <div className="space-y-3">
          {/* Checkerboard preview */}
          <div className="relative rounded-lg overflow-hidden border border-border bg-[repeating-conic-gradient(hsl(var(--muted))_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]">
            <img
              src={previewUrl}
              alt="bg removed"
              className="w-full h-auto max-h-48 object-contain"
            />
            <div className="absolute top-1.5 right-1.5 rounded-full bg-primary/90 px-2 py-0.5 font-accent text-[9px] font-bold text-primary-foreground flex items-center gap-1">
              <CheckCircle2 className="h-2.5 w-2.5" />
              הרקע הוסר
              {selectedMethod === "local" && " (מקומי)"}
            </div>
          </div>

          {/* ── Confirm action buttons ── */}
          <div className="grid grid-cols-3 gap-2">
            {/* Save */}
            <button
              onClick={() => {
                onResult(previewUrl);
                toast.success("התמונה נשמרה");
              }}
              className="flex flex-col items-center justify-center gap-1 rounded-lg bg-primary py-2.5 font-display text-[11px] font-bold text-primary-foreground hover:brightness-110 transition-all"
            >
              <Save className="h-4 w-4" />
              שמור
            </button>

            {/* Duplicate + Save */}
            <button
              onClick={() => {
                onResult(previewUrl);
                if (onDuplicate) {
                  onDuplicate(previewUrl);
                } else {
                  downloadDataUrl(previewUrl, "removed-bg.png");
                }
                toast.success("נשמר + הורד כקובץ PNG");
              }}
              className="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-primary bg-primary/10 py-2.5 font-display text-[11px] font-bold text-primary hover:bg-primary/20 transition-all"
            >
              <Copy className="h-4 w-4" />
              שכפל ושמור
            </button>

            {/* Cancel */}
            <button
              onClick={() => { setPreviewUrl(null); setSegmentResults(null); setElementImages([]); setProgress(0); }}
              className="flex flex-col items-center justify-center gap-1 rounded-lg border border-border py-2.5 font-display text-[11px] font-bold text-muted-foreground hover:bg-destructive/10 hover:border-destructive/40 hover:text-destructive transition-all"
            >
              <X className="h-4 w-4" />
              בטל
            </button>
          </div>
        </div>
      )}

      {/* ── Draggable element chips (segment method) ── */}
      {elementImages.length > 0 && !processing && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Eye className="h-3.5 w-3.5 text-gold" />
            <span className="font-display text-[11px] font-bold text-foreground">
              {elementImages.length} אלמנטים — גרור או לחץ להשתמש
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {elementImages.map((el, i) => (
              <div
                key={i}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/uri-list", el.url);
                  e.dataTransfer.setData("text/plain", el.url);
                  e.dataTransfer.effectAllowed = "copy";
                  // Ghost image
                  const ghost = document.createElement("img");
                  ghost.src = el.url;
                  ghost.style.width = "80px";
                  ghost.style.height = "80px";
                  ghost.style.objectFit = "contain";
                  document.body.appendChild(ghost);
                  e.dataTransfer.setDragImage(ghost, 40, 40);
                  setTimeout(() => document.body.removeChild(ghost), 0);
                }}
                className="group relative rounded-lg border border-border bg-[repeating-conic-gradient(hsl(var(--muted))_0%_25%,transparent_0%_50%)] bg-[length:12px_12px] cursor-grab active:cursor-grabbing overflow-hidden"
                title={`גרור את "${el.label}" לכלי אחר`}
              >
                <img
                  src={el.url}
                  alt={el.label}
                  className="w-full h-20 object-contain pointer-events-none"
                />
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                  <button
                    onClick={() => { onResult(el.url); toast.success(`"${el.label}" הוחל`); }}
                    className="rounded-md bg-primary px-2 py-1 font-display text-[10px] font-bold text-white"
                  >
                    השתמש
                  </button>
                  <button
                    onClick={() => downloadDataUrl(el.url, `${el.label}.png`)}
                    className="rounded-md bg-white/20 px-2 py-1 font-display text-[10px] font-bold text-white flex items-center gap-1"
                  >
                    <Download className="h-2.5 w-2.5" /> הורד
                  </button>
                </div>
                {/* Drag handle hint */}
                <div className="absolute bottom-0.5 left-0.5 opacity-40 group-hover:opacity-0 transition-opacity">
                  <GripVertical className="h-3 w-3 text-white drop-shadow" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 py-0.5 px-1">
                  <span className="font-body text-[9px] text-white/80 truncate block text-center">{el.label}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="font-body text-[9px] text-muted-foreground text-center">
            גרור אלמנט לכלי עיבוד אחר, או לחץ "השתמש" כדי לטעון אותו כתמונה
          </p>
        </div>
      )}

      {/* Segment results count */}
      {segmentResults?.detections && segmentResults.detections.length > 0 && elementImages.length === 0 && (
        <div className="rounded-lg border border-gold/30 bg-gold/5 p-2.5 space-y-1">
          <div className="flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5 text-gold" />
            <span className="font-display text-[11px] font-bold text-foreground">
              זוהו {segmentResults.detections.length} אלמנטים
            </span>
          </div>
          <p className="font-body text-[10px] text-muted-foreground">
            המערכת זיהתה {segmentResults.detections.length} אובייקטים בתמונה וחילצה אותם בדיוק גבוה.
          </p>
        </div>
      )}

      {/* Action button (run) — only when no pending preview */}
      {!previewUrl && (
        <button
          onClick={handleRemoveBg}
          disabled={processing || !currentImage}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-display text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
        >
          {processing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {selectedMethod === "local" ? "מעבד מקומית..." : selectedMethod === "bria" ? "מסיר רקע..." : "מזהה אלמנטים..."}
            </>
          ) : (
            <>
              {selectedMethod === "local" ? <Cpu className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              {selectedMethod === "local" ? "הסר רקע מקומית" : selectedMethod === "bria" ? "הסר רקע חכם (AI)" : "זהה וחלץ אלמנטים (AI)"}
            </>
          )}
        </button>
      )}

      <div className="rounded-lg border border-border bg-muted/30 p-2">
        <p className="font-body text-[9px] text-muted-foreground text-center leading-relaxed">
          {selectedMethod === "local"
            ? "💻 העיבוד מתבצע בדפדפן שלך — הנתונים לא נשלחים לשום שרת. בטעינה ראשונה יורד מודל של ~40MB."
            : "☁️ העיבוד מתבצע בענן — לתוצאות מיטביות השתמשו בתמונה באיכות גבוהה עם מוצר ברור"}
        </p>
      </div>
    </div>
  );
}

