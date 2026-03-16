import { useState, useCallback, useRef } from "react";
import { FileText, Download, Image as ImageIcon, Loader2, CheckCircle2, ArrowLeft, X, FileOutput, Sparkles, AlertCircle, Eye, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { extractPdfPages, buildPdfFromImages, downloadBlob, type PdfPage } from "@/lib/pdf-utils";
import { downloadImagesAsZip } from "@/lib/zip-download";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compress";

interface PdfProcessorProps {
  onSelectPage: (dataUrl: string) => void;
  onClose: () => void;
  backgroundPrompt?: string;
}

type ProcessedPage = PdfPage & {
  processed?: string;
  status?: "pending" | "processing" | "done" | "error";
  error?: string;
};

const PdfProcessor = ({ onSelectPage, onClose, backgroundPrompt }: PdfProcessorProps) => {
  const [pages, setPages] = useState<ProcessedPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [fileName, setFileName] = useState("");
  const [previewPage, setPreviewPage] = useState<ProcessedPage | null>(null);

  const handleFile = useCallback(async (file: File) => {
    if (file.type !== "application/pdf") {
      toast.error("יש להעלות קובץ PDF בלבד");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error("גודל הקובץ חורג מ-50MB");
      return;
    }

    setLoading(true);
    setFileName(file.name.replace(/\.pdf$/i, ""));
    try {
      const extracted = await extractPdfPages(file, 2, (current, total) => {
        setProgress({ current, total });
      });
      setPages(extracted.map(p => ({ ...p, status: "pending" as const })));
      toast.success(`חולצו ${extracted.length} עמודים בהצלחה`);
    } catch (err: any) {
      console.error("PDF extraction error:", err);
      toast.error("שגיאה בחילוץ עמודי ה-PDF");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const processAllPages = useCallback(async () => {
    if (!backgroundPrompt?.trim()) {
      toast.error("יש לבחור רקע לפני עיבוד אצווה");
      return;
    }

    setBatchProcessing(true);
    const toProcess = pages.filter(p => p.status !== "done");
    setBatchProgress({ current: 0, total: toProcess.length });

    for (let i = 0; i < toProcess.length; i++) {
      const page = toProcess[i];
      const pageIndex = pages.findIndex(p => p.pageNumber === page.pageNumber);

      // Mark processing
      setPages(prev => prev.map((p, idx) => idx === pageIndex ? { ...p, status: "processing" } : p));

      try {
        const compressed = await compressImage(page.dataUrl);
        const { data, error } = await supabase.functions.invoke("replace-background", {
          body: {
            imageBase64: compressed,
            backgroundPrompt: backgroundPrompt.trim(),
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        setPages(prev => prev.map((p, idx) =>
          idx === pageIndex ? { ...p, processed: data.resultImage, status: "done" } : p
        ));
      } catch (err: any) {
        console.error(`Error processing page ${page.pageNumber}:`, err);
        setPages(prev => prev.map((p, idx) =>
          idx === pageIndex ? { ...p, status: "error", error: err?.message || "שגיאה" } : p
        ));
      }

      setBatchProgress({ current: i + 1, total: toProcess.length });
    }

    setBatchProcessing(false);
    const doneCount = toProcess.length;
    toast.success(`הושלם עיבוד ${doneCount} עמודים!`);
  }, [pages, backgroundPrompt]);

  const downloadAllAsImages = useCallback(async () => {
    const images = pages.map((p, i) => ({
      name: `${fileName}_page_${i + 1}`,
      image: p.processed || p.dataUrl,
    }));
    await downloadImagesAsZip(images, `${fileName}_pages.zip`);
    toast.success("התמונות הורדו בהצלחה");
  }, [pages, fileName]);

  const downloadAsPdf = useCallback(() => {
    try {
      const imgs = pages.map(p => ({
        dataUrl: p.processed || p.dataUrl,
        width: p.width,
        height: p.height,
      }));
      const blob = buildPdfFromImages(imgs, `${fileName}_processed.pdf`);
      downloadBlob(blob, `${fileName}_processed.pdf`);
      toast.success("ה-PDF הורד בהצלחה");
    } catch (err: any) {
      toast.error("שגיאה ביצירת PDF");
    }
  }, [pages, fileName]);

  const doneCount = pages.filter(p => p.status === "done").length;
  const errorCount = pages.filter(p => p.status === "error").length;

  // Upload zone
  if (pages.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            עיבוד PDF
          </h3>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-secondary transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <label
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-card p-8 cursor-pointer transition-colors hover:border-primary hover:bg-secondary/50"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div className="text-center">
            <p className="font-display text-base font-semibold text-foreground">
              גרור קובץ PDF לכאן או לחץ להעלאה
            </p>
            <p className="mt-0.5 font-body text-xs text-muted-foreground">עד 50MB</p>
          </div>
          <input type="file" accept="application/pdf" onChange={handleInputChange} className="hidden" />
        </label>

        {loading && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              מחלץ עמודים... {progress.current}/{progress.total}
            </div>
            <Progress value={progress.total > 0 ? (progress.current / progress.total) * 100 : 0} className="h-2" />
          </div>
        )}
      </div>
    );
  }

  // Pages gallery
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setPages([])} className="rounded-lg p-1.5 hover:bg-secondary transition-colors">
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <h3 className="font-display text-sm font-bold text-foreground">
            {fileName}.pdf — {pages.length} עמודים
          </h3>
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-secondary transition-colors">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Batch process button */}
      <button
        onClick={processAllPages}
        disabled={batchProcessing || !backgroundPrompt?.trim() || pages.every(p => p.status === "done")}
        className="flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 font-display text-sm font-semibold text-accent-foreground transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {batchProcessing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            מעבד... {batchProgress.current}/{batchProgress.total}
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            {backgroundPrompt?.trim()
              ? `החלף רקע לכל ${pages.filter(p => p.status !== "done").length} העמודים`
              : "בחר רקע לפני עיבוד אצווה"}
          </>
        )}
      </button>

      {batchProcessing && (
        <Progress value={batchProgress.total > 0 ? (batchProgress.current / batchProgress.total) * 100 : 0} className="h-2" />
      )}

      {/* Status */}
      {(doneCount > 0 || errorCount > 0) && (
        <div className="flex items-center gap-3 text-xs font-body text-muted-foreground">
          {doneCount > 0 && <span className="text-accent flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> {doneCount} הושלמו</span>}
          {errorCount > 0 && <span className="text-destructive flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" /> {errorCount} שגיאות</span>}
        </div>
      )}

      {/* Export buttons */}
      <div className="flex gap-2">
        <button
          onClick={downloadAllAsImages}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 font-accent text-xs font-semibold text-foreground transition-all hover:bg-secondary"
        >
          <ImageIcon className="h-3.5 w-3.5" />
          הורד הכל כתמונות (ZIP)
        </button>
        <button
          onClick={downloadAsPdf}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 font-accent text-xs font-semibold text-primary-foreground transition-all hover:brightness-110"
        >
          <FileOutput className="h-3.5 w-3.5" />
          הורד כ-PDF חדש
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        לחץ על עמוד כדי לפתוח אותו בעורך לעיבוד בודד
      </p>

      {/* Thumbnails grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto pr-1">
        {pages.map((page) => (
          <button
            key={page.pageNumber}
            onClick={() => onSelectPage(page.processed || page.dataUrl)}
            className="group relative overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-primary hover:ring-2 hover:ring-primary/30"
          >
            <img
              src={page.processed || page.dataUrl}
              alt={`עמוד ${page.pageNumber}`}
              className="w-full h-auto object-contain"
              loading="lazy"
            />
            {/* Processing overlay */}
            {page.status === "processing" && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="font-accent text-xs font-semibold text-foreground bg-card/80 px-2 py-1 rounded-md">
                פתח בעורך
              </span>
            </div>
            <span className="absolute bottom-1 right-1 rounded bg-background/70 px-1.5 py-0.5 font-accent text-[10px] text-foreground">
              {page.pageNumber}
            </span>
            {page.status === "done" && (
              <CheckCircle2 className="absolute top-1 left-1 h-4 w-4 text-accent" />
            )}
            {page.status === "error" && (
              <AlertCircle className="absolute top-1 left-1 h-4 w-4 text-destructive" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default PdfProcessor;
