import { useState, useCallback } from "react";
import { Download, Sparkles, Shield } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ImageUploader from "@/components/ImageUploader";
import ImageCanvas from "@/components/ImageCanvas";
import BackgroundPresets, { type Preset } from "@/components/BackgroundPresets";

const Index = () => {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [activePrompt, setActivePrompt] = useState("");

  const handleImageSelect = useCallback((base64: string) => {
    setOriginalImage(base64);
    setResultImage(null);
  }, []);

  const handlePresetSelect = useCallback((preset: Preset) => {
    setSelectedPreset(preset.id);
    setActivePrompt(preset.prompt);
    setCustomPrompt("");
  }, []);

  const handleProcess = useCallback(async () => {
    if (!originalImage) {
      toast.error("יש להעלות תמונה קודם");
      return;
    }

    const prompt = customPrompt.trim() || activePrompt;
    if (!prompt) {
      toast.error("יש לבחור רקע או לכתוב תיאור");
      return;
    }

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

  const handleDownload = useCallback(() => {
    if (!resultImage) return;
    const link = document.createElement("a");
    link.href = resultImage;
    link.download = "result.png";
    link.click();
  }, [resultImage]);

  return (
    <div className="min-h-screen bg-background font-body" dir="rtl">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="font-display text-xl font-bold text-foreground">
              AI Background Replacer
            </h1>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-accent/20 px-3 py-1.5">
            <Shield className="h-4 w-4 text-accent" />
            <span className="font-display text-xs font-semibold text-accent">
              Lossless Export
            </span>
          </div>
        </div>
      </header>

      {/* Main workspace */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex gap-8">
          {/* Canvas area */}
          <div className="flex-1 space-y-6">
            {originalImage ? (
              <ImageCanvas
                originalImage={originalImage}
                resultImage={resultImage}
                isProcessing={isProcessing}
              />
            ) : (
              <ImageUploader onImageSelect={handleImageSelect} />
            )}

            {/* Action buttons */}
            {originalImage && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleProcess}
                  disabled={isProcessing || (!activePrompt && !customPrompt.trim())}
                  className="flex items-center gap-2 rounded-lg bg-accent px-6 py-3 font-display text-sm font-semibold text-accent-foreground transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles className="h-4 w-4" />
                  {isProcessing ? "מעבד..." : "החלף רקע"}
                </button>

                {resultImage && (
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 rounded-lg border border-border bg-card px-6 py-3 font-display text-sm font-semibold text-foreground transition-all hover:bg-secondary"
                  >
                    <Download className="h-4 w-4" />
                    הורד תמונה
                  </button>
                )}

                <button
                  onClick={() => {
                    setOriginalImage(null);
                    setResultImage(null);
                  }}
                  className="font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  העלה תמונה חדשה
                </button>
              </div>
            )}
          </div>

          {/* Sidebar */}
          {originalImage && (
            <div className="w-72 shrink-0">
              <div className="sticky top-8 rounded-xl border border-border bg-card p-5 shadow-sm">
                <BackgroundPresets
                  selectedId={selectedPreset}
                  onSelect={handlePresetSelect}
                  customPrompt={customPrompt}
                  onCustomPromptChange={(v) => {
                    setCustomPrompt(v);
                    if (v.trim()) setSelectedPreset(null);
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;
