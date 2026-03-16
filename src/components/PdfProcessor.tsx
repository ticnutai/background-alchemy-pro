import { useState, useCallback, useRef } from "react";
import { FileText, Download, Image as ImageIcon, Loader2, CheckCircle2, ArrowLeft, X, FileOutput, Sparkles, AlertCircle, Eye, GripVertical, FolderInput, Save, CheckSquare, Square, Folder, FolderPlus, ArrowUpDown } from "lucide-react";
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

interface ImageFolder {
  id: string;
  name: string;
  color: string | null;
}

const PdfProcessor = ({ onSelectPage, onClose, backgroundPrompt }: PdfProcessorProps) => {
  const [pages, setPages] = useState<ProcessedPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [fileName, setFileName] = useState("");
  const [previewPage, setPreviewPage] = useState<ProcessedPage | null>(null);

  // Selection & save state
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [showSaveOptions, setShowSaveOptions] = useState(false);
  const [folders, setFolders] = useState<ImageFolder[]>([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState({ current: 0, total: 0 });

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
    toast.success(`הושלם עיבוד ${toProcess.length} עמודים!`);
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

  // ─── Selection ─────────────────────────────────────────────
  const togglePageSelect = useCallback((pageNum: number) => {
    setSelectedPages(prev => {
      const next = new Set(prev);
      if (next.has(pageNum)) next.delete(pageNum);
      else next.add(pageNum);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedPages(new Set(pages.map(p => p.pageNumber)));
  }, [pages]);

  const deselectAll = useCallback(() => {
    setSelectedPages(new Set());
  }, []);

  // ─── Load folders ──────────────────────────────────────────
  const loadFolders = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("image_folders")
      .select("id, name, color")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setFolders(data);
  }, []);

  // ─── Save to gallery ──────────────────────────────────────
  const saveToGallery = useCallback(async (folderId: string | null) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("יש להתחבר כדי לשמור לגלריה");
      return;
    }

    const pagesToSave = selectMode && selectedPages.size > 0
      ? pages.filter(p => selectedPages.has(p.pageNumber))
      : pages;

    if (pagesToSave.length === 0) {
      toast.error("אין עמודים לשמירה");
      return;
    }

    setSaving(true);
    setSaveProgress({ current: 0, total: pagesToSave.length });
    let saved = 0;

    try {
      for (const page of pagesToSave) {
        const imageUrl = page.processed || page.dataUrl;
        const ts = Date.now();

        // Upload to storage
        const blob = await fetch(imageUrl).then(r => r.blob());
        const path = `${user.id}/${ts}_pdf_page_${page.pageNumber}.png`;
        const { error: upErr } = await supabase.storage
          .from("processed-images")
          .upload(path, blob, { contentType: "image/png" });
        if (upErr) throw upErr;

        const publicUrl = supabase.storage
          .from("processed-images")
          .getPublicUrl(path).data.publicUrl;

        // Save to processing_history
        await supabase.from("processing_history").insert({
          user_id: user.id,
          original_image_url: publicUrl,
          result_image_url: publicUrl,
          background_prompt: `PDF: ${fileName} — עמוד ${page.pageNumber}`,
          background_name: fileName,
          folder_id: folderId,
        });

        saved++;
        setSaveProgress({ current: saved, total: pagesToSave.length });
      }

      toast.success(`נשמרו ${saved} עמודים לגלריה! ✅`);
      setShowSaveOptions(false);
      setSelectMode(false);
      setSelectedPages(new Set());
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error(`שגיאה בשמירה: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }, [pages, selectedPages, selectMode, fileName]);

  // ─── Create folder + save ──────────────────────────────────
  const createFolderAndSave = useCallback(async () => {
    if (!newFolderName.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("image_folders")
      .insert({ user_id: user.id, name: newFolderName.trim(), color: "#6366f1" })
      .select("id")
      .single();

    if (error || !data) {
      toast.error("שגיאה ביצירת תיקייה");
      return;
    }

    setNewFolderName("");
    await saveToGallery(data.id);
  }, [newFolderName, saveToGallery]);

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

      {/* ─── Selection & Save Bar ─────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => { setSelectMode(!selectMode); if (selectMode) deselectAll(); }}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-accent text-xs font-semibold transition-all ${
            selectMode
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-card text-foreground hover:bg-secondary"
          }`}
        >
          <CheckSquare className="h-3.5 w-3.5" />
          {selectMode ? `נבחרו ${selectedPages.size}` : "בחירה מרובה"}
        </button>

        {selectMode && (
          <>
            <button
              onClick={selectAll}
              className="rounded-lg border border-border bg-card px-2.5 py-1.5 font-accent text-[10px] font-semibold text-foreground hover:bg-secondary transition-colors"
            >
              בחר הכל
            </button>
            <button
              onClick={deselectAll}
              className="rounded-lg border border-border bg-card px-2.5 py-1.5 font-accent text-[10px] font-semibold text-muted-foreground hover:bg-secondary transition-colors"
            >
              נקה בחירה
            </button>
          </>
        )}

        <div className="flex-1" />

        {/* Save to gallery button */}
        <button
          onClick={() => { loadFolders(); setShowSaveOptions(!showSaveOptions); }}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 font-accent text-xs font-semibold text-primary-foreground transition-all hover:brightness-110"
        >
          <Save className="h-3.5 w-3.5" />
          {selectMode && selectedPages.size > 0
            ? `שמור ${selectedPages.size} לגלריה`
            : "שמור הכל לגלריה"}
        </button>
      </div>

      {/* ─── Save Options Panel ───────────────────────────────── */}
      {showSaveOptions && (
        <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
          <h4 className="font-display text-xs font-bold text-foreground flex items-center gap-1.5">
            <FolderInput className="h-4 w-4 text-primary" />
            שמירה לגלריה — {selectMode && selectedPages.size > 0 ? `${selectedPages.size} עמודים נבחרים` : `כל ${pages.length} העמודים`}
          </h4>

          {saving && (
            <div className="space-y-1.5">
              <Progress value={saveProgress.total > 0 ? (saveProgress.current / saveProgress.total) * 100 : 0} className="h-2" />
              <p className="font-body text-[10px] text-muted-foreground">
                שומר... {saveProgress.current}/{saveProgress.total}
              </p>
            </div>
          )}

          {/* Save to root gallery */}
          <button
            onClick={() => saveToGallery(null)}
            disabled={saving}
            className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 font-accent text-xs font-semibold text-foreground transition-all hover:bg-secondary disabled:opacity-50"
          >
            <ImageIcon className="h-4 w-4 text-primary" />
            שמור לגלריה הראשית (ללא תיקייה)
          </button>

          {/* Existing folders */}
          {folders.length > 0 && (
            <div className="space-y-1.5">
              <p className="font-body text-[10px] text-muted-foreground">או שמור לתיקייה קיימת:</p>
              <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto">
                {folders.map(f => (
                  <button
                    key={f.id}
                    onClick={() => saveToGallery(f.id)}
                    disabled={saving}
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-2 font-accent text-[11px] font-semibold text-foreground transition-all hover:bg-secondary hover:border-primary/40 disabled:opacity-50 text-right"
                  >
                    <Folder className="h-3.5 w-3.5 shrink-0" style={{ color: f.color || "hsl(var(--primary))" }} />
                    <span className="truncate">{f.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Create new folder */}
          <div className="flex gap-2">
            <input
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              placeholder="שם תיקייה חדשה..."
              className="flex-1 rounded-lg border border-border bg-card px-3 py-2 font-body text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              onKeyDown={e => e.key === "Enter" && createFolderAndSave()}
            />
            <button
              onClick={createFolderAndSave}
              disabled={!newFolderName.trim() || saving}
              className="flex items-center gap-1 rounded-lg bg-accent px-3 py-2 font-accent text-xs font-semibold text-accent-foreground transition-all hover:brightness-110 disabled:opacity-50"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              צור ושמור
            </button>
          </div>
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

      {/* Before/After Preview Modal */}
      {previewPage && previewPage.processed && (
        <BeforeAfterPreview
          page={previewPage}
          onClose={() => setPreviewPage(null)}
          onOpenEditor={() => {
            onSelectPage(previewPage.processed || previewPage.dataUrl);
            setPreviewPage(null);
          }}
        />
      )}

      {/* Thumbnails grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto pr-1">
        {pages.map((page) => (
          <div key={page.pageNumber} className="relative">
            {/* Selection checkbox */}
            {selectMode && (
              <button
                onClick={(e) => { e.stopPropagation(); togglePageSelect(page.pageNumber); }}
                className="absolute top-2 right-2 z-10 flex h-6 w-6 items-center justify-center rounded-md bg-card/90 border border-border shadow-sm transition-colors hover:bg-primary/20"
              >
                {selectedPages.has(page.pageNumber) ? (
                  <CheckSquare className="h-4 w-4 text-primary" />
                ) : (
                  <Square className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            )}

            <button
              onClick={() => {
                if (selectMode) {
                  togglePageSelect(page.pageNumber);
                } else if (page.processed) {
                  setPreviewPage(page);
                } else {
                  onSelectPage(page.dataUrl);
                }
              }}
              className={`group relative w-full overflow-hidden rounded-lg border transition-all hover:border-primary hover:ring-2 hover:ring-primary/30 ${
                selectMode && selectedPages.has(page.pageNumber)
                  ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                  : "border-border bg-card"
              }`}
            >
              <img
                src={page.processed || page.dataUrl}
                alt={`עמוד ${page.pageNumber}`}
                className="w-full h-auto object-contain"
                loading="lazy"
              />
              {page.status === "processing" && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
              {!selectMode && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="font-accent text-xs font-semibold text-foreground bg-card/80 px-2 py-1 rounded-md">
                    {page.processed ? "לפני / אחרי" : "פתח בעורך"}
                  </span>
                </div>
              )}
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
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── Before / After slider component ── */
function BeforeAfterPreview({
  page,
  onClose,
  onOpenEditor,
}: {
  page: ProcessedPage;
  onClose: () => void;
  onOpenEditor: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sliderPos, setSliderPos] = useState(50);
  const dragging = useRef(false);

  const updateSlider = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(pct);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateSlider(e.clientX);
  }, [updateSlider]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    updateSlider(e.clientX);
  }, [updateSlider]);

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative flex flex-col w-full max-w-3xl mx-6 max-h-[90vh] rounded-2xl bg-card shadow-2xl border border-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3 shrink-0">
          <h3 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            לפני / אחרי — עמוד {page.pageNumber}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenEditor}
              className="rounded-lg bg-primary px-3 py-1.5 font-accent text-xs font-semibold text-primary-foreground transition-all hover:brightness-110"
            >
              פתח בעורך
            </button>
            <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-secondary transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden p-4">
          <div className="flex items-center justify-center gap-4 mb-3 text-xs font-accent text-muted-foreground">
            <span>אחרי ←</span>
            <span>גרור את הסליידר</span>
            <span>→ לפני</span>
          </div>
          <div
            ref={containerRef}
            className="relative w-full overflow-hidden rounded-lg border border-border select-none touch-none cursor-col-resize"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <img
              src={page.processed}
              alt="אחרי"
              className="w-full h-auto object-contain block"
              draggable={false}
            />
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${sliderPos}%` }}
            >
              <img
                src={page.dataUrl}
                alt="לפני"
                className="h-full object-contain block"
                style={{ width: containerRef.current ? `${containerRef.current.offsetWidth}px` : "100%" }}
                draggable={false}
              />
            </div>
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-primary shadow-lg"
              style={{ left: `${sliderPos}%`, transform: "translateX(-50%)" }}
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center h-8 w-8 rounded-full bg-primary shadow-lg">
                <GripVertical className="h-4 w-4 text-primary-foreground" />
              </div>
            </div>
            <span className="absolute top-2 left-2 rounded bg-background/80 px-2 py-0.5 font-accent text-[10px] text-foreground">
              לפני
            </span>
            <span className="absolute top-2 right-2 rounded bg-background/80 px-2 py-0.5 font-accent text-[10px] text-foreground">
              אחרי
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PdfProcessor;
