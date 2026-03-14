import { useState, useCallback } from "react";
import { Upload, X, Sparkles, Download, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { type Preset } from "@/components/BackgroundPresets";

interface BatchItem {
  id: string;
  originalImage: string;
  resultImage: string | null;
  status: "pending" | "processing" | "done" | "error";
  fileName: string;
  error?: string;
}

interface BatchProcessorProps {
  backgroundPrompt: string;
  referenceImages: string[];
  onClose: () => void;
}

const BatchProcessor = ({ backgroundPrompt, referenceImages, onClose }: BatchProcessorProps) => {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFiles = useCallback((files: FileList) => {
    const newItems: BatchItem[] = [];
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const item: BatchItem = {
          id: crypto.randomUUID(),
          originalImage: e.target?.result as string,
          resultImage: null,
          status: "pending",
          fileName: file.name,
        };
        setItems((prev) => [...prev, item]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const processAll = useCallback(async () => {
    if (!backgroundPrompt) {
      toast.error("יש לבחור רקע לפני עיבוד");
      return;
    }

    setIsProcessing(true);
    const pending = items.filter((i) => i.status === "pending" || i.status === "error");

    for (const item of pending) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: "processing" as const } : i))
      );

      try {
        const { data, error } = await supabase.functions.invoke("replace-background", {
          body: {
            imageBase64: item.originalImage,
            backgroundPrompt,
            referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, status: "done" as const, resultImage: data.resultImage }
              : i
          )
        );
      } catch (err: any) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, status: "error" as const, error: err.message }
              : i
          )
        );
      }
    }

    setIsProcessing(false);
    toast.success("העיבוד הסתיים!");
  }, [items, backgroundPrompt, referenceImages]);

  const downloadAll = useCallback(() => {
    items
      .filter((i) => i.status === "done" && i.resultImage)
      .forEach((item, idx) => {
        setTimeout(() => {
          const link = document.createElement("a");
          link.href = item.resultImage!;
          link.download = `result_${item.fileName}`;
          link.click();
        }, idx * 300);
      });
  }, [items]);

  const downloadOne = useCallback((item: BatchItem) => {
    if (!item.resultImage) return;
    const link = document.createElement("a");
    link.href = item.resultImage;
    link.download = `result_${item.fileName}`;
    link.click();
  }, []);

  const doneCount = items.filter((i) => i.status === "done").length;
  const errorCount = items.filter((i) => i.status === "error").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative flex flex-col w-full max-w-5xl mx-6 max-h-[90vh] rounded-2xl bg-card shadow-2xl border border-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0">
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">עיבוד מרובה תמונות</h2>
            <p className="font-body text-xs text-muted-foreground mt-0.5">
              העלה כמה תמונות ועבד את כולן עם אותו הרקע
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-secondary transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Upload area */}
        <label
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="mx-6 mt-4 flex items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-secondary/30 p-6 cursor-pointer hover:border-primary/50 transition-colors shrink-0"
        >
          <Upload className="h-6 w-6 text-primary" />
          <span className="font-display text-sm font-semibold text-foreground">
            גרור תמונות או לחץ להעלאה
          </span>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
            className="hidden"
          />
        </label>

        {/* Status bar */}
        {items.length > 0 && (
          <div className="flex items-center gap-4 px-6 py-3 text-xs font-body text-muted-foreground shrink-0">
            <span>{items.length} תמונות</span>
            {doneCount > 0 && <span className="text-accent">✓ {doneCount} הושלמו</span>}
            {errorCount > 0 && <span className="text-destructive">✗ {errorCount} שגיאות</span>}
          </div>
        )}

        {/* Items grid */}
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="relative rounded-lg border border-border bg-secondary/20 overflow-hidden group"
              >
                <img
                  src={item.resultImage || item.originalImage}
                  alt={item.fileName}
                  className="w-full aspect-square object-cover"
                />

                {/* Status overlay */}
                {item.status === "processing" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-foreground/30 backdrop-blur-sm">
                    <Loader2 className="h-8 w-8 text-primary-foreground animate-spin" />
                  </div>
                )}
                {item.status === "done" && (
                  <div className="absolute top-2 left-2">
                    <CheckCircle2 className="h-5 w-5 text-accent drop-shadow" />
                  </div>
                )}
                {item.status === "error" && (
                  <div className="absolute top-2 left-2">
                    <AlertCircle className="h-5 w-5 text-destructive drop-shadow" />
                  </div>
                )}

                {/* Actions */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {item.status === "done" && (
                    <button
                      onClick={() => downloadOne(item)}
                      className="rounded-md bg-card/90 p-1.5 shadow hover:bg-card transition-colors"
                    >
                      <Download className="h-3.5 w-3.5 text-foreground" />
                    </button>
                  )}
                  <button
                    onClick={() => removeItem(item.id)}
                    className="rounded-md bg-card/90 p-1.5 shadow hover:bg-destructive/20 transition-colors"
                  >
                    <X className="h-3.5 w-3.5 text-foreground" />
                  </button>
                </div>

                {/* File name */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-foreground/60 to-transparent px-2 py-1.5">
                  <span className="font-body text-[10px] text-primary-foreground truncate block">
                    {item.fileName}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer actions */}
        {items.length > 0 && (
          <div className="flex items-center justify-between border-t border-border px-6 py-4 shrink-0">
            <button
              onClick={() => setItems([])}
              className="font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              נקה הכל
            </button>
            <div className="flex gap-3">
              {doneCount > 0 && (
                <button
                  onClick={downloadAll}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 font-display text-sm font-semibold text-foreground hover:bg-secondary transition-colors"
                >
                  <Download className="h-4 w-4" />
                  הורד הכל ({doneCount})
                </button>
              )}
              <button
                onClick={processAll}
                disabled={isProcessing || items.every((i) => i.status === "done")}
                className="flex items-center gap-2 rounded-lg bg-accent px-6 py-2.5 font-display text-sm font-semibold text-accent-foreground transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles className="h-4 w-4" />
                {isProcessing ? "מעבד..." : `עבד ${items.filter((i) => i.status === "pending" || i.status === "error").length} תמונות`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BatchProcessor;
