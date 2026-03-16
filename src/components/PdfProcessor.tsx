import { useState, useCallback } from "react";
import { FileText, Download, Image as ImageIcon, Loader2, CheckCircle2, ArrowLeft, X, FileOutput } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { extractPdfPages, buildPdfFromImages, downloadBlob, type PdfPage } from "@/lib/pdf-utils";
import { downloadImagesAsZip } from "@/lib/zip-download";

interface PdfProcessorProps {
  /** Called when user selects a single page to edit in the main tool */
  onSelectPage: (dataUrl: string) => void;
  onClose: () => void;
}

type ProcessedPage = PdfPage & {
  processed?: string; // processed dataUrl if available
};

const PdfProcessor = ({ onSelectPage, onClose }: PdfProcessorProps) => {
  const [pages, setPages] = useState<ProcessedPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [fileName, setFileName] = useState("");

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
      setPages(extracted);
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

  // Upload zone (no pages yet)
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
            <p className="mt-0.5 font-body text-xs text-muted-foreground">
              עד 50MB
            </p>
          </div>
          <input
            type="file"
            accept="application/pdf"
            onChange={handleInputChange}
            className="hidden"
          />
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
          <button
            onClick={() => setPages([])}
            className="rounded-lg p-1.5 hover:bg-secondary transition-colors"
          >
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
        לחץ על עמוד כדי לפתוח אותו בעורך לעיבוד (החלפת רקע, פילטרים ועוד)
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
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="font-accent text-xs font-semibold text-foreground bg-card/80 px-2 py-1 rounded-md">
                פתח בעורך
              </span>
            </div>
            <span className="absolute bottom-1 right-1 rounded bg-background/70 px-1.5 py-0.5 font-accent text-[10px] text-foreground">
              {page.pageNumber}
            </span>
            {page.processed && (
              <CheckCircle2 className="absolute top-1 left-1 h-4 w-4 text-primary" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default PdfProcessor;
