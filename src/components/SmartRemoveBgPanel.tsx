import { useState, useCallback } from "react";
import { Scissors, Sparkles, Eye, Layers, RotateCcw, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { removeBgPrecise, segmentProduct } from "@/lib/ai-tools";
import { compressImage } from "@/lib/image-compress";

interface SmartRemoveBgPanelProps {
  currentImage: string;
  onResult: (img: string) => void;
}

type Method = "bria" | "segment";

const methods = [
  {
    id: "bria" as Method,
    label: "הסרת רקע מדויקת",
    desc: "BRIA RMBG 2.0 — המודל המתקדם ביותר. מזהה קצוות מורכבים, שיער, שקיפויות וצללים",
    icon: "✂️",
    badge: "מומלץ",
    features: ["קצוות מורכבים", "שיער ופרווה", "שקיפות חלקית", "צללים רכים"],
  },
  {
    id: "segment" as Method,
    label: "זיהוי אלמנטים חכם",
    desc: "Grounding DINO + SAM2 — מזהה כל אלמנט בתמונה בנפרד. מושלם למוצרים מרובים",
    icon: "🔍",
    badge: "מתקדם",
    features: ["זיהוי מרובה", "מיפוי אזורים", "חיתוך לפי אובייקט", "מסכה לכל אלמנט"],
  },
];

export default function SmartRemoveBgPanel({ currentImage, onResult }: SmartRemoveBgPanelProps) {
  const [selectedMethod, setSelectedMethod] = useState<Method>("bria");
  const [processing, setProcessing] = useState(false);
  const [segmentResults, setSegmentResults] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleRemoveBg = useCallback(async () => {
    if (!currentImage) {
      toast.error("אין תמונה לעיבוד");
      return;
    }
    setProcessing(true);
    setPreviewUrl(null);
    setSegmentResults(null);

    try {
      const compressed = await compressImage(currentImage);

      if (selectedMethod === "bria") {
        const result = await removeBgPrecise(compressed);
        setPreviewUrl(result.resultImage);
        onResult(result.resultImage);
        toast.success("הרקע הוסר בהצלחה! (BRIA RMBG 2.0)");
      } else {
        const result = await segmentProduct(compressed);
        setSegmentResults(result);
        // If segmentation returns a combined mask/output
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
    } catch (err: any) {
      toast.error(err.message || "שגיאה בהסרת הרקע");
    } finally {
      setProcessing(false);
    }
  }, [currentImage, selectedMethod, onResult]);

  return (
    <div className="space-y-4 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scissors className="h-5 w-5 text-primary" />
          <h3 className="font-display text-sm font-bold text-foreground">הסרת רקע חכמה</h3>
        </div>
        {previewUrl && (
          <button
            onClick={() => { setPreviewUrl(null); setSegmentResults(null); }}
            className="flex items-center gap-1 font-body text-xs text-primary hover:underline"
          >
            <RotateCcw className="h-3 w-3" /> נקה
          </button>
        )}
      </div>

      <p className="font-body text-[11px] text-muted-foreground leading-relaxed">
        זיהוי אוטומטי של כל האלמנטים בתמונה והסרת הרקע בדיוק מרבי — כולל קצוות מורכבים, שיער, שקיפויות וצללים.
      </p>

      {/* Method selection */}
      <div className="space-y-2">
        {methods.map((m) => (
          <button
            key={m.id}
            onClick={() => setSelectedMethod(m.id)}
            className={`w-full rounded-lg border-2 p-3 text-right transition-all ${
              selectedMethod === m.id
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/40"
            }`}
          >
            <div className="flex items-start gap-2">
              <span className="text-lg mt-0.5">{m.icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-display text-xs font-bold text-foreground">{m.label}</span>
                  <span className={`rounded-full px-1.5 py-0.5 font-accent text-[9px] font-bold ${
                    m.id === "bria" ? "bg-primary/15 text-primary" : "bg-gold/15 text-gold"
                  }`}>
                    {m.badge}
                  </span>
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

      {/* Preview */}
      {previewUrl && (
        <div className="relative rounded-lg overflow-hidden border border-border bg-[repeating-conic-gradient(hsl(var(--muted))_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]">
          <img
            src={previewUrl}
            alt="bg removed"
            className="w-full h-auto max-h-48 object-contain"
          />
          <div className="absolute top-1.5 right-1.5 rounded-full bg-emerald-500/90 px-2 py-0.5 font-accent text-[9px] font-bold text-white flex items-center gap-1">
            <CheckCircle2 className="h-2.5 w-2.5" />
            הרקע הוסר
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
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            {selectedMethod === "bria" ? "מסיר רקע..." : "מזהה אלמנטים..."}
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            {selectedMethod === "bria" ? "הסר רקע חכם" : "זהה וחלץ אלמנטים"}
          </>
        )}
      </button>

      <div className="rounded-lg border border-border bg-muted/30 p-2">
        <p className="font-body text-[9px] text-muted-foreground text-center leading-relaxed">
          💡 לתוצאות מיטביות, השתמשו בתמונה באיכות גבוהה עם מוצר ברור
        </p>
      </div>
    </div>
  );
}