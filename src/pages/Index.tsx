import { useState, useCallback } from "react";
import { Sparkles, Shield, Wand2, Upload as UploadIcon, Tag } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ImageUploader from "@/components/ImageUploader";
import ImageCanvas from "@/components/ImageCanvas";
import BackgroundPresets, { type Preset } from "@/components/BackgroundPresets";
import ImageAdjustmentsPanel, {
  type ImageAdjustments,
  defaultAdjustments,
  getFilterString,
} from "@/components/ImageAdjustmentsPanel";
import ExportPanel from "@/components/ExportPanel";

const Index = () => {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [activePrompt, setActivePrompt] = useState("");
  const [adjustments, setAdjustments] = useState<ImageAdjustments>(defaultAdjustments);
  const [activeTab, setActiveTab] = useState<"backgrounds" | "adjust" | "export">("backgrounds");

  const handleImageSelect = useCallback((base64: string) => {
    setOriginalImage(base64);
    setResultImage(null);
    setAdjustments(defaultAdjustments);
  }, []);

  const handlePresetSelect = useCallback((preset: Preset) => {
    setSelectedPreset(preset.id);
    setActivePrompt(preset.prompt);
    setCustomPrompt("");
  }, []);

  const handleProcess = useCallback(async () => {
    if (!originalImage) return toast.error("יש להעלות תמונה קודם");
    const prompt = customPrompt.trim() || activePrompt;
    if (!prompt) return toast.error("יש לבחור רקע או לכתוב תיאור");

    setIsProcessing(true);
    setResultImage(null);
    try {
      const { data, error } = await supabase.functions.invoke("replace-background", {
        body: { imageBase64: originalImage, backgroundPrompt: prompt },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResultImage(data.resultImage);
      toast.success("הרקע הוחלף בהצלחה!");
    } catch (err: any) {
      toast.error(err.message || "שגיאה בעיבוד התמונה");
    } finally {
      setIsProcessing(false);
    }
  }, [originalImage, customPrompt, activePrompt]);

  const handleEnhance = useCallback(async () => {
    const img = resultImage || originalImage;
    if (!img) return;
    setIsEnhancing(true);
    try {
      const { data, error } = await supabase.functions.invoke("replace-background", {
        body: {
          imageBase64: img,
          backgroundPrompt: "Enhance this image quality. Increase sharpness, improve lighting, fix any artifacts, make colors more vivid. Keep the composition exactly the same. Output the highest quality version possible.",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResultImage(data.resultImage);
      toast.success("התמונה שופרה!");
    } catch (err: any) {
      toast.error(err.message || "שגיאה בשיפור התמונה");
    } finally {
      setIsEnhancing(false);
    }
  }, [resultImage, originalImage]);

  const handleExport = useCallback(
    async (format: string, quality: number) => {
      const img = resultImage || originalImage;
      if (!img) return;
      setIsExporting(true);

      try {
        // Apply adjustments by drawing to canvas
        const image = new Image();
        image.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = reject;
          image.src = img;
        });

        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.filter = getFilterString(adjustments);
        ctx.drawImage(image, 0, 0);

        if (format === "pdf") {
          // Simple PDF with embedded image
          const dataUrl = canvas.toDataURL("image/png", 1);
          const pdfContent = await generatePDF(dataUrl, canvas.width, canvas.height);
          downloadBlob(pdfContent, "result.pdf", "application/pdf");
        } else if (format === "tiff") {
          // Export as PNG (browser doesn't natively support TIFF, we use max quality PNG)
          const blob = await canvasToBlob(canvas, "image/png", 1);
          downloadBlob(blob, "result.tiff", "image/png");
          toast.info("TIFF ייוצא כ-PNG באיכות מקסימלית (lossless)");
        } else {
          const mimeType = format === "jpg" ? "image/jpeg" : format === "webp" ? "image/webp" : "image/png";
          const q = (format === "jpg" || format === "webp") ? quality / 100 : 1;
          const blob = await canvasToBlob(canvas, mimeType, q);
          downloadBlob(blob, `result.${format}`, mimeType);
        }

        toast.success("התמונה יוצאה בהצלחה!");
      } catch (err: any) {
        toast.error("שגיאה בייצוא");
      } finally {
        setIsExporting(false);
      }
    },
    [resultImage, originalImage, adjustments]
  );

  return (
    <div className="min-h-screen bg-background font-body" dir="rtl">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="font-display text-xl font-bold text-foreground">AI Background Replacer</h1>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-accent/20 px-3 py-1.5">
            <Shield className="h-4 w-4 text-accent" />
            <span className="font-display text-xs font-semibold text-accent">Lossless Export</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex gap-8">
          {/* Canvas */}
          <div className="flex-1 space-y-6">
            {originalImage ? (
              <ImageCanvas
                originalImage={originalImage}
                resultImage={resultImage}
                isProcessing={isProcessing || isEnhancing}
                adjustments={adjustments}
              />
            ) : (
              <ImageUploader onImageSelect={handleImageSelect} />
            )}

            {originalImage && (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleProcess}
                  disabled={isProcessing || (!activePrompt && !customPrompt.trim())}
                  className="flex items-center gap-2 rounded-lg bg-accent px-6 py-3 font-display text-sm font-semibold text-accent-foreground transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles className="h-4 w-4" />
                  {isProcessing ? "מעבד..." : "החלף רקע"}
                </button>

                <button
                  onClick={handleEnhance}
                  disabled={isEnhancing || isProcessing}
                  className="flex items-center gap-2 rounded-lg bg-primary px-5 py-3 font-display text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Wand2 className="h-4 w-4" />
                  {isEnhancing ? "משפר..." : "שפר איכות"}
                </button>

                <button
                  onClick={() => {
                    setOriginalImage(null);
                    setResultImage(null);
                    setAdjustments(defaultAdjustments);
                  }}
                  className="flex items-center gap-2 font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <UploadIcon className="h-4 w-4" />
                  תמונה חדשה
                </button>
              </div>
            )}
          </div>

          {/* Sidebar */}
          {originalImage && (
            <div className="w-80 shrink-0">
              <div className="sticky top-8 space-y-0 rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                {/* Tabs */}
                <div className="flex border-b border-border">
                  {[
                    { key: "backgrounds" as const, label: "רקעים" },
                    { key: "adjust" as const, label: "התאמות" },
                    { key: "export" as const, label: "ייצוא" },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`flex-1 py-3 font-display text-xs font-semibold transition-colors ${
                        activeTab === tab.key
                          ? "text-primary border-b-2 border-primary bg-primary/5"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="p-5 max-h-[70vh] overflow-y-auto">
                  {activeTab === "backgrounds" && (
                    <BackgroundPresets
                      selectedId={selectedPreset}
                      onSelect={handlePresetSelect}
                      customPrompt={customPrompt}
                      onCustomPromptChange={(v) => {
                        setCustomPrompt(v);
                        if (v.trim()) setSelectedPreset(null);
                      }}
                    />
                  )}
                  {activeTab === "adjust" && (
                    <ImageAdjustmentsPanel
                      adjustments={adjustments}
                      onChange={setAdjustments}
                      onReset={() => setAdjustments(defaultAdjustments)}
                    />
                  )}
                  {activeTab === "export" && (
                    <ExportPanel
                      resultImage={resultImage}
                      isExporting={isExporting}
                      onExport={handleExport}
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

// Helper functions
function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Failed to create blob"))),
      type,
      quality
    );
  });
}

function downloadBlob(blob: Blob | string, filename: string, mimeType: string) {
  const url = typeof blob === "string" ? blob : URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  if (typeof blob !== "string") URL.revokeObjectURL(url);
}

async function generatePDF(imageDataUrl: string, w: number, h: number): Promise<Blob> {
  // Minimal PDF generator
  const imgData = imageDataUrl.split(",")[1];
  const binary = atob(imgData);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  // Scale to fit A4-ish (595x842 points)
  const scale = Math.min(575 / w, 822 / h);
  const pw = Math.round(w * scale);
  const ph = Math.round(h * scale);
  const pageW = Math.max(pw + 20, 595);
  const pageH = Math.max(ph + 20, 842);
  const xOff = Math.round((pageW - pw) / 2);
  const yOff = Math.round((pageH - ph) / 2);

  const imgStream = bytes;
  const streamLen = imgStream.length;

  const objects: string[] = [];
  const offsets: number[] = [];
  let content = "%PDF-1.4\n";

  function addObj(s: string) {
    offsets.push(content.length);
    objects.push(s);
    content += s;
  }

  addObj(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  addObj(`2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`);
  addObj(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents 4 0 R /Resources << /XObject << /Img 5 0 R >> >> >>\nendobj\n`);

  const stream = `q ${pw} 0 0 ${ph} ${xOff} ${yOff} cm /Img Do Q`;
  addObj(`4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`);

  // We'll encode the image as a separate binary section
  const imgObjHeader = `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${streamLen} >>\nstream\n`;
  const imgObjFooter = `\nendstream\nendobj\n`;

  const headerBytes = new TextEncoder().encode(content + imgObjHeader);
  const footerBytes = new TextEncoder().encode(imgObjFooter);

  // Convert imageDataUrl to JPEG blob for DCTDecode
  const response = await fetch(imageDataUrl);
  const imgBlob = await response.blob();
  const jpegBlob = imgBlob; // already PNG, but let's use canvas
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const img = new Image();
  await new Promise<void>((resolve) => {
    img.onload = () => resolve();
    img.src = imageDataUrl;
  });
  ctx.drawImage(img, 0, 0);
  const jpegDataUrl = canvas.toDataURL("image/jpeg", 1.0);
  const jpegBase64 = jpegDataUrl.split(",")[1];
  const jpegBinary = atob(jpegBase64);
  const jpegBytes = new Uint8Array(jpegBinary.length);
  for (let i = 0; i < jpegBinary.length; i++) jpegBytes[i] = jpegBinary.charCodeAt(i);

  // Rebuild with correct length
  const realImgHeader = `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`;
  const realHeaderBytes = new TextEncoder().encode(content + realImgHeader);

  const xrefOffset = realHeaderBytes.length + jpegBytes.length + footerBytes.length;
  const xref = `xref\n0 6\n0000000000 65535 f \n${offsets.map((o) => String(o).padStart(10, "0") + " 00000 n ").join("\n")}\n${String(content.length).padStart(10, "0")} 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  const xrefBytes = new TextEncoder().encode(xref);

  const totalSize = realHeaderBytes.length + jpegBytes.length + footerBytes.length + xrefBytes.length;
  const pdfArray = new Uint8Array(totalSize);
  let offset = 0;
  pdfArray.set(realHeaderBytes, offset); offset += realHeaderBytes.length;
  pdfArray.set(jpegBytes, offset); offset += jpegBytes.length;
  pdfArray.set(footerBytes, offset); offset += footerBytes.length;
  pdfArray.set(xrefBytes, offset);

  return new Blob([pdfArray], { type: "application/pdf" });
}

export default Index;
