import { useState, useCallback, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Sparkles, Shield, Wand2, Upload as UploadIcon, Tag, Eye, Layers, Clock, LogOut, LogIn, Share2, Brain, Home, ArrowRight, FlaskConical, Settings } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import ImageUploader from "@/components/ImageUploader";
import ImageCanvas from "@/components/ImageCanvas";
import BackgroundPresets, { type Preset, presets } from "@/components/BackgroundPresets";
import ImageAdjustmentsPanel, {
  type ImageAdjustments,
  defaultAdjustments,
  getFilterString,
} from "@/components/ImageAdjustmentsPanel";
import ExportPanel from "@/components/ExportPanel";
import MockupPreview from "@/components/MockupPreview";
import BatchProcessor from "@/components/BatchProcessor";
import AIChatDialog from "@/components/AIChatDialog";
import HistoryPanel from "@/components/HistoryPanel";
import AdvancedToolsPanel from "@/components/AdvancedToolsPanel";
import SocialTemplates from "@/components/SocialTemplates";
import ResultsStrip from "@/components/ResultsStrip";
import SmartSuggestPanel from "@/components/SmartSuggestPanel";
import ShareDialog from "@/components/ShareDialog";
import ThemeToggle from "@/components/ThemeToggle";
import DevSettingsDialog from "@/components/DevSettingsDialog";
import type { User } from "@supabase/supabase-js";

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [activePrompt, setActivePrompt] = useState("");
  const [adjustments, setAdjustments] = useState<ImageAdjustments>(defaultAdjustments);
  const [activeTab, setActiveTab] = useState<"backgrounds" | "adjust" | "tools" | "export" | "smart">("backgrounds");
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [suggestedName, setSuggestedName] = useState<string | null>(null);
  const [selectedPresetName, setSelectedPresetName] = useState<string | null>(null);
  const [showMockup, setShowMockup] = useState(false);
  const [showBatch, setShowBatch] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSocial, setShowSocial] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedPresetIds, setSelectedPresetIds] = useState<string[]>([]);
  const [batchResults, setBatchResults] = useState<Array<{ name: string; image: string; prompt: string }>>([]);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [preciseMode, setPreciseMode] = useState(false);
  const [showDevSettings, setShowDevSettings] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) {
        supabase.rpc("has_role", { _user_id: data.user.id, _role: "admin" }).then(({ data: hasRole }) => {
          setIsAdmin(!!hasRole);
        });
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        supabase.rpc("has_role", { _user_id: session.user.id, _role: "admin" }).then(({ data: hasRole }) => {
          setIsAdmin(!!hasRole);
        });
      } else {
        setIsAdmin(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleImageSelect = useCallback((base64: string) => {
    setOriginalImage(base64);
    setResultImage(null);
    setAdjustments(defaultAdjustments);
  }, []);

  const handlePresetSelect = useCallback((preset: Preset) => {
    setSelectedPreset(preset.id);
    setActivePrompt(preset.prompt);
    setCustomPrompt("");
    setReferenceImages([]);
    setSelectedPresetName(preset.professionalName);
    setSuggestedName(null);
  }, []);

  const handleProcess = useCallback(async () => {
    if (!originalImage) return toast.error("יש להעלות תמונה קודם");
    const prompt = customPrompt.trim() || activePrompt;
    if (!prompt) return toast.error("יש לבחור רקע או לכתוב תיאור");

    setIsProcessing(true);
    setResultImage(null);
    setSuggestedName(null);
    try {
      const functionName = preciseMode ? "replace-bg-pipeline" : "replace-background";
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {
          imageBase64: originalImage,
          backgroundPrompt: prompt,
          referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResultImage(data.resultImage);
      toast.success("הרקע הוחלף בהצלחה!");

      // Save to history if user is logged in
      if (user) {
        try {
          // Upload both images to storage
          const uid = user.id;
          const ts = Date.now();
          const origBlob = await fetch(originalImage).then(r => r.blob());
          const resultBlob = await fetch(data.resultImage).then(r => r.blob());

          const [origUpload, resultUpload] = await Promise.all([
            supabase.storage.from("processed-images").upload(`${uid}/${ts}_original.png`, origBlob, { contentType: "image/png" }),
            supabase.storage.from("processed-images").upload(`${uid}/${ts}_result.png`, resultBlob, { contentType: "image/png" }),
          ]);

          if (origUpload.data && resultUpload.data) {
            const origUrl = supabase.storage.from("processed-images").getPublicUrl(origUpload.data.path).data.publicUrl;
            const resultUrl = supabase.storage.from("processed-images").getPublicUrl(resultUpload.data.path).data.publicUrl;

            await supabase.from("processing_history").insert({
              user_id: uid,
              original_image_url: origUrl,
              result_image_url: resultUrl,
              background_prompt: prompt,
              background_name: selectedPresetName || customPrompt.trim().slice(0, 50) || null,
            });
          }
        } catch (saveErr) {
          console.error("Failed to save to history:", saveErr);
        }
      }
      // Get professional name suggestion
      if (customPrompt.trim() && !selectedPresetName) {
        supabase.functions.invoke("suggest-name", {
          body: { backgroundDescription: customPrompt.trim() },
        }).then(({ data: nameData }) => {
          if (nameData?.name) setSuggestedName(nameData.name);
        }).catch(() => {});
      } else if (selectedPresetName) {
        setSuggestedName(selectedPresetName);
      }
    } catch (err: any) {
      toast.error(err.message || "שגיאה בעיבוד התמונה");
    } finally {
      setIsProcessing(false);
    }
  }, [originalImage, customPrompt, activePrompt]);

  const handleMultiProcess = useCallback(async () => {
    if (!originalImage || selectedPresetIds.length === 0) {
      toast.error("יש לבחור לפחות רקע אחד");
      return;
    }
    const selectedBgs = selectedPresetIds.map(id => presets.find(p => p.id === id)!).filter(Boolean);
    setBatchProcessing(true);
    setBatchResults([]);
    setBatchProgress({ current: 0, total: selectedBgs.length });

    const results: Array<{ name: string; image: string; prompt: string }> = [];

    for (let i = 0; i < selectedBgs.length; i++) {
      const preset = selectedBgs[i];
      setBatchProgress({ current: i + 1, total: selectedBgs.length });
      try {
        const { data, error } = await supabase.functions.invoke("replace-background", {
          body: { imageBase64: originalImage, backgroundPrompt: preset.prompt },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        results.push({ name: preset.professionalName, image: data.resultImage, prompt: preset.prompt });
        setBatchResults([...results]);

        // Save to history
        if (user) {
          try {
            const uid = user.id;
            const ts = Date.now() + i;
            const resultBlob = await fetch(data.resultImage).then(r => r.blob());
            const upload = await supabase.storage.from("processed-images").upload(`${uid}/${ts}_result.png`, resultBlob, { contentType: "image/png" });
            if (upload.data) {
              const resultUrl = supabase.storage.from("processed-images").getPublicUrl(upload.data.path).data.publicUrl;
              await supabase.from("processing_history").insert({
                user_id: uid,
                original_image_url: originalImage.substring(0, 200),
                result_image_url: resultUrl,
                background_prompt: preset.prompt,
                background_name: preset.professionalName,
              });
            }
          } catch {}
        }
      } catch (err: any) {
        toast.error(`שגיאה ב-${preset.label}: ${err.message}`);
      }
    }

    setBatchProcessing(false);
    toast.success(`הושלמו ${results.length}/${selectedBgs.length} רקעים!`);
  }, [originalImage, selectedPresetIds, user]);

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
            <Link to="/" className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </Link>
            <h1 className="font-display text-xl font-bold text-foreground">AI Background Replacer</h1>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <>
                <Link
                  to="/"
                  className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 font-accent text-xs font-semibold text-foreground transition-colors hover:border-gold/40"
                >
                  <Home className="h-3.5 w-3.5" />
                  דף הבית
                </Link>
                <button
                  onClick={() => setShowHistory(true)}
                  className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 font-accent text-xs font-semibold text-foreground transition-colors hover:border-gold/40"
                >
                  <Clock className="h-3.5 w-3.5" />
                  היסטוריה
                </button>
                <Link
                  to="/gallery"
                  className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 font-accent text-xs font-semibold text-foreground transition-colors hover:border-gold/40"
                >
                  <Eye className="h-3.5 w-3.5" />
                  גלריה
                </Link>
              </>
            )}
            {user ? (
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  toast.success("התנתקת בהצלחה");
                }}
                className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 font-accent text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <LogOut className="h-3.5 w-3.5" />
                התנתק
              </button>
            ) : (
              <Link
                to="/auth"
                className="flex items-center gap-2 rounded-full bg-gold px-4 py-2 font-accent text-xs font-semibold text-gold-foreground transition-all hover:brightness-110"
              >
                <LogIn className="h-3.5 w-3.5" />
                התחבר לשמירה
              </Link>
            )}
            {isAdmin && (
              <button
                onClick={() => setShowDevSettings(true)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/5 text-amber-500 transition-colors hover:bg-amber-500/10 hover:border-amber-500/50"
                title="הגדרות פיתוח"
              >
                <Settings className="h-4 w-4" />
              </button>
            )}
            <ThemeToggle />
            <button
              onClick={() => navigate(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:text-foreground hover:border-gold/40"
              title="חזור"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
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

            {/* Suggested name badge */}
            {user && (
              <ResultsStrip
                onSelectImage={(url) => setResultImage(url)}
                currentResultUrl={resultImage}
              />
            )}

            {/* Batch results grid */}
            {batchResults.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-bold text-foreground">
                    תוצאות — {batchResults.length} רקעים
                  </h3>
                  <button
                    onClick={() => setBatchResults([])}
                    className="font-accent text-xs text-muted-foreground hover:text-foreground"
                  >
                    נקה
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {batchResults.map((r, i) => (
                    <div
                      key={i}
                      className="group relative rounded-xl border border-border overflow-hidden bg-card cursor-pointer hover:border-gold/50 hover:shadow-md transition-all"
                      onClick={() => setResultImage(r.image)}
                    >
                      <div className="aspect-square overflow-hidden">
                        <img src={r.image} alt={r.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                      </div>
                      <div className="p-2 text-center">
                        <p className="font-display text-xs font-semibold text-foreground truncate">{r.name}</p>
                      </div>
                      <div className="absolute top-1.5 right-1.5 rounded-full bg-gold/90 px-2 py-0.5 font-accent text-[10px] font-bold text-gold-foreground">
                        {i + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {suggestedName && resultImage && (
              <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
                <Tag className="h-4 w-4 text-primary" />
                <div className="flex flex-col">
                  <span className="font-body text-xs text-muted-foreground">שם מקצועי מוצע למוצר:</span>
                  <span className="font-display text-sm font-bold text-primary">{suggestedName}</span>
                </div>
              </div>
            )}

            {originalImage && (
              <div className="flex flex-wrap items-center gap-3">
                {!multiSelectMode ? (
                  <button
                    onClick={handleProcess}
                    disabled={isProcessing || (!activePrompt && !customPrompt.trim())}
                    className={`flex items-center gap-2 rounded-lg px-6 py-3 font-display text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed ${
                      preciseMode
                        ? "bg-gradient-to-l from-amber-500 to-accent text-white"
                        : "bg-accent text-accent-foreground"
                    }`}
                  >
                    <Sparkles className="h-4 w-4" />
                    {isProcessing ? "מעבד..." : preciseMode ? "החלף רקע (מדויק)" : "החלף רקע"}
                  </button>
                ) : (
                  <button
                    onClick={handleMultiProcess}
                    disabled={batchProcessing || selectedPresetIds.length === 0}
                    className="flex items-center gap-2 rounded-lg bg-gradient-to-l from-accent to-primary px-6 py-3 font-display text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Layers className="h-4 w-4" />
                    {batchProcessing
                      ? `מעבד ${batchProgress.current}/${batchProgress.total}...`
                      : `החלף ${selectedPresetIds.length} רקעים`}
                  </button>
                )}

                <button
                  onClick={() => {
                    setMultiSelectMode(!multiSelectMode);
                    setSelectedPresetIds([]);
                    setBatchResults([]);
                  }}
                  className={`flex items-center gap-2 rounded-lg px-5 py-3 font-display text-sm font-semibold transition-all ${
                    multiSelectMode
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-card text-foreground hover:bg-secondary"
                  }`}
                >
                  <Layers className="h-4 w-4" />
                  {multiSelectMode ? "בחירה מרובה ✓" : "בחירה מרובה"}
                </button>

                <button
                  onClick={() => setPreciseMode(!preciseMode)}
                  className={`flex items-center gap-2 rounded-lg px-5 py-3 font-display text-sm font-semibold transition-all ${
                    preciseMode
                      ? "bg-amber-500 text-white ring-2 ring-amber-300"
                      : "border border-border bg-card text-foreground hover:bg-secondary"
                  }`}
                  title="מצב מדויק: Pipeline דו-שלבי שמבטיח שהמוצרים לא ישתנו"
                >
                  <FlaskConical className="h-4 w-4" />
                  {preciseMode ? "מצב מדויק ✓" : "מצב מדויק"}
                </button>

                <button
                  onClick={handleEnhance}
                  disabled={isEnhancing || isProcessing}
                  className="flex items-center gap-2 rounded-lg bg-primary px-5 py-3 font-display text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Wand2 className="h-4 w-4" />
                  {isEnhancing ? "משפר..." : "שפר איכות"}
                </button>

                {resultImage && (
                  <button
                    onClick={() => setShowMockup(true)}
                    className="flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-3 font-display text-sm font-semibold text-foreground transition-all hover:bg-secondary"
                  >
                    <Eye className="h-4 w-4" />
                    מוקאפ
                  </button>
                )}

                {resultImage && (
                  <button
                    onClick={() => setShowSocial(true)}
                    className="flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-3 font-display text-sm font-semibold text-foreground transition-all hover:bg-secondary"
                  >
                    <Share2 className="h-4 w-4" />
                    תבניות
                  </button>
                )}

                {resultImage && (
                  <button
                    onClick={() => setShowShare(true)}
                    className="flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/5 px-5 py-3 font-display text-sm font-semibold text-gold transition-all hover:bg-gold/10"
                  >
                    <Share2 className="h-4 w-4" />
                    שתף + QR
                  </button>
                )}

                <button
                  onClick={() => setShowBatch(true)}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-3 font-display text-sm font-semibold text-foreground transition-all hover:bg-secondary"
                >
                  <Layers className="h-4 w-4" />
                  עיבוד מרובה
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
                    { key: "smart" as const, label: "🧠 חכם" },
                    { key: "tools" as const, label: "כלים" },
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
                        if (v.trim()) {
                          setSelectedPreset(null);
                          setSelectedPresetName(null);
                        }
                      }}
                      referenceImages={referenceImages}
                      onReferenceImagesChange={setReferenceImages}
                      multiSelectMode={multiSelectMode}
                      selectedPresets={selectedPresetIds}
                      onTogglePreset={(preset) => {
                        setSelectedPresetIds(prev =>
                          prev.includes(preset.id)
                            ? prev.filter(id => id !== preset.id)
                            : [...prev, preset.id]
                        );
                      }}
                    />
                  )}
                  {activeTab === "tools" && (
                    <AdvancedToolsPanel
                      originalImage={originalImage}
                      resultImage={resultImage}
                      onResult={setResultImage}
                    />
                  )}
                  {activeTab === "smart" && (
                    <SmartSuggestPanel
                      imageBase64={originalImage}
                      onSelectPrompt={(prompt, name) => {
                        setCustomPrompt(prompt);
                        setActivePrompt(prompt);
                        setSelectedPreset(null);
                        setSelectedPresetName(name);
                        setSuggestedName(name);
                        toast.success(`רקע "${name}" הוגדר — לחץ "החלף רקע" להחיל`);
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
                      onResult={setResultImage}
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Mockup Modal */}
      {showMockup && resultImage && (
        <MockupPreview imageUrl={resultImage} onClose={() => setShowMockup(false)} />
      )}

      {/* Batch Processing Modal */}
      {showBatch && (
        <BatchProcessor
          backgroundPrompt={customPrompt.trim() || activePrompt}
          referenceImages={referenceImages}
          onClose={() => setShowBatch(false)}
        />
      )}

      {/* Social Templates */}
      {showSocial && resultImage && (
        <SocialTemplates
          imageUrl={resultImage}
          onClose={() => setShowSocial(false)}
        />
      )}

      {/* Share Dialog */}
      {showShare && resultImage && (
        <ShareDialog
          imageUrl={resultImage}
          title={suggestedName || selectedPresetName || undefined}
          onClose={() => setShowShare(false)}
        />
      )}

      <AIChatDialog
        onApplyBackground={(prompt, name) => {
          setCustomPrompt(prompt);
          setActivePrompt(prompt);
          setSelectedPreset(null);
          setSelectedPresetName(name);
          setSuggestedName(name);
          toast.success(`רקע "${name}" הוגדר — לחץ "החלף רקע" להחיל`);
        }}
      />

      {/* History Panel */}
      {showHistory && (
        <HistoryPanel
          onClose={() => setShowHistory(false)}
          onSelectImage={(url) => {
            setResultImage(url);
            setShowHistory(false);
          }}
        />
      )}

      {/* Dev Settings */}
      <DevSettingsDialog open={showDevSettings} onClose={() => setShowDevSettings(false)} />
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
