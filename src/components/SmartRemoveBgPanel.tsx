import { useState, useCallback } from "react";
import { Scissors, Sparkles, Eye, Layers, RotateCcw, CheckCircle2, Cpu, Cloud, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { removeBgPrecise, segmentProduct } from "@/lib/ai-tools";
import { compressImage } from "@/lib/image-compress";
import { Progress } from "@/components/ui/progress";

interface SmartRemoveBgPanelProps {
  currentImage: string;
  onResult: (img: string) => void;
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

export default function SmartRemoveBgPanel({ currentImage, onResult }: SmartRemoveBgPanelProps) {
  const [selectedMethod, setSelectedMethod] = useState<Method>("local");
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [segmentResults, setSegmentResults] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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
      progress: (key: string, current: number, total: number) => {
        if (total > 0) {
          const pct = Math.round((current / total) * 100);
          if (key.includes("fetch")) {
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
    setProgress(0);
    setProgressLabel("");

    try {
      if (selectedMethod === "local") {
        const resultUrl = await handleLocalRemoveBg(currentImage);
        setPreviewUrl(resultUrl);
        onResult(resultUrl);
        toast.success("הרקע הוסר בהצלחה! (מקומי — ללא AI ענן)");
      } else {
        const compressed = await compressImage(currentImage);

        if (selectedMethod === "bria") {
          setProgressLabel("שולח ל-AI...");
          setProgress(20);
          const result = await removeBgPrecise(compressed, (p) => setProgress(20 + p * 0.8));
          setPreviewUrl(result.resultImage);
          onResult(result.resultImage);
          toast.success("הרקע הוסר בהצלחה! (BRIA RMBG 2.0)");
        } else {
          setProgressLabel("מזהה אלמנטים...");
          setProgress(20);
          const result = await segmentProduct(compressed);
          setSegmentResults(result);
          if (result.segmentation) {
            const outputUrl = typeof result.segmentation === "string"
              ? result.segmentation
              : Array.isArray(result.segmentation) && result.segmentation[0]
                ? result.segmentation[0]
                : null;
            if (outputUrl) {
              setPreviewUrl(outputUrl);
              onResult(outputUrl);
            }
          }
          toast.success(`זוהו ${result.detections?.length || 0} אלמנטים בתמונה`);
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
            onClick={() => { setPreviewUrl(null); setSegmentResults(null); setProgress(0); }}
            className="flex items-center gap-1 font-body text-xs text-primary hover:underline"
          >
            <RotateCcw className="h-3 w-3" /> נקה
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
                  {m.id === "local" && (
                    <Cpu className="h-3 w-3 text-accent" />
                  )}
                  {(m.id === "bria" || m.id === "segment") && (
                    <Cloud className="h-3 w-3 text-primary" />
                  )}
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
              {selectedMethod === m.id && (
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-1" />
              )}
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

      {/* Preview */}
      {previewUrl && (
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
      )}

      {/* Segment results info */}
      {segmentResults?.detections && segmentResults.detections.length > 0 && (
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

      {/* Action button */}
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
