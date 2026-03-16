import { useState, useCallback, useEffect, useMemo, lazy, Suspense } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import EditableLabel from "@/components/EditableLabel";
import { useNavigate, Link, useLocation, useSearchParams } from "react-router-dom";
import { Sparkles, Shield, Wand2, Upload as UploadIcon, Tag, Eye, Layers, Clock, LogOut, LogIn, Share2, Brain, Home, ArrowRight, FlaskConical, Settings, Save, Undo2, Redo2, GitCompare, Crop, SlidersHorizontal, Frame } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { imageProcessingQueue } from "@/lib/job-queue";
import { compressImage } from "@/lib/image-compress";
import { useToolState, useToolDispatch, ToolProvider } from "@/lib/tool-context";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useAiMode } from "@/hooks/use-ai-mode";
import { downloadImagesAsZip } from "@/lib/zip-download";
import ImageUploader from "@/components/ImageUploader";
const PdfProcessor = lazy(() => import("@/components/PdfProcessor"));
import ImageCanvas from "@/components/ImageCanvas";
import BackgroundPresets, { type Preset, presets } from "@/components/BackgroundPresets";
import ImageAdjustmentsPanel, {
  defaultAdjustments,
  getFilterString,
  getOverlayStyles,
  getSvgFilterId,
  getSvgFilterMarkup,
} from "@/components/ImageAdjustmentsPanel";
import ExportPanel, { type ExportOptions } from "@/components/ExportPanel";
import ResultsStrip from "@/components/ResultsStrip";
import ThemeToggle from "@/components/ThemeToggle";
import LiveFilterPanel from "@/components/LiveFilterPanel";
import FilterLayersPanel from "@/components/FilterLayersPanel";
import ColorTransferPanel from "@/components/ColorTransferPanel";
import RegionalMaskPanel from "@/components/RegionalMaskPanel";
import LiveHistogram from "@/components/LiveHistogram";
import CropTransformPanel from "@/components/CropTransformPanel";
import FloatingSaveAction from "@/components/FloatingSaveAction";
import AdvancedFiltersPanel from "@/components/AdvancedFiltersPanel";
import NonAiLabPanel from "@/components/NonAiLabPanel";
import TooltipHelpButton from "@/components/TooltipHelpSystem";
import { applyCanvasFilters, type CanvasFilterOptions } from "@/lib/canvas-filters";
import { getCachedResult, setCachedResult } from "@/lib/result-cache";
import type { User } from "@supabase/supabase-js";
import { Switch } from "@/components/ui/switch";

// Lazy-load heavy components that aren't needed on initial render
const MockupPreview = lazy(() => import("@/components/MockupPreview"));
const BatchProcessor = lazy(() => import("@/components/BatchProcessor"));
const AIChatDialog = lazy(() => import("@/components/AIChatDialog"));
const HistoryPanel = lazy(() => import("@/components/HistoryPanel"));
const AdvancedToolsPanel = lazy(() => import("@/components/AdvancedToolsPanel"));
const SocialTemplates = lazy(() => import("@/components/SocialTemplates"));
const SmartSuggestPanel = lazy(() => import("@/components/SmartSuggestPanel"));
const ShareDialog = lazy(() => import("@/components/ShareDialog"));
const DevSettingsDialog = lazy(() => import("@/components/DevSettingsDialog"));
const ComparisonGallery = lazy(() => import("@/components/ComparisonGallery"));

/** Fire-and-forget: save processing result to history without blocking UI */
function saveToHistoryAsync(
  user: User,
  originalImage: string,
  resultImageUrl: string,
  prompt: string,
  name: string | null,
) {
  (async () => {
    try {
      const uid = user.id;
      const ts = Date.now();
      const [origBlob, resultBlob] = await Promise.all([
        fetch(originalImage).then((r) => r.blob()),
        fetch(resultImageUrl).then((r) => r.blob()),
      ]);

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
          background_name: name,
        });
      }
    } catch (err) {
      console.error("Failed to save to history:", err);
    }
  })();
}

const LazyFallback = () => (
  <div className="flex items-center justify-center p-8">
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  </div>
);

const ToolInner = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const state = useToolState();
  const dispatch = useToolDispatch();
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveNewName, setSaveNewName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [filterProcessing, setFilterProcessing] = useState(false);
  const [liveFilterCss, setLiveFilterCss] = useState("");
  const [localApplying, setLocalApplying] = useState(false);
  const [showPdfProcessor, setShowPdfProcessor] = useState(false);
  const { aiEnabled, setAiMode } = useAiMode(true);

  const {
    originalImage, resultImage, adjustments, referenceImages,
    isProcessing, isEnhancing, isExporting,
    selectedPreset, selectedPresetName, selectedPresetType,
    customPrompt, activePrompt, suggestedName, preciseMode,
    activeTab, showMockup, showBatch, showHistory, showSocial, showShare, showDevSettings,
    multiSelectMode, selectedPresetIds, batchResults, batchProcessing, batchProgress,
    undoStack, redoStack, showComparison, comparisonImages, compareMode,
  } = state;

  const studioTopTabs = [
    { label: "קולאז", path: "/collage" },
    { label: "קטלוג", path: "/catalog" },
  ];

  const openWorkspaceWithSelectedImage = useCallback((path: "/collage" | "/catalog") => {
    const sourceImage = resultImage || originalImage;
    if (!sourceImage) {
      navigate(path);
      return;
    }
    const importKey = `tool-transfer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(importKey, sourceImage);
    navigate(`${path}?importKey=${encodeURIComponent(importKey)}`, {
      state: { importImage: sourceImage, importFrom: "tool" },
    });
  }, [resultImage, originalImage, navigate]);

  // ─── Keyboard Shortcuts ─────────────────────────────────────
  const shortcuts = useMemo(() => [
    { key: "z", ctrl: true, action: () => dispatch({ type: "UNDO" }), description: "בטל" },
    { key: "z", ctrl: true, shift: true, action: () => dispatch({ type: "REDO" }), description: "בצע שוב" },
    { key: "y", ctrl: true, action: () => dispatch({ type: "REDO" }), description: "בצע שוב" },
    { key: "e", ctrl: true, action: () => dispatch({ type: "SET_ACTIVE_TAB", payload: "export" }), description: "ייצוא" },
    { key: "n", ctrl: true, action: () => { if (originalImage) dispatch({ type: "RESET_IMAGE" }); }, description: "תמונה חדשה" },
  ], [dispatch, originalImage]);

  useKeyboardShortcuts(shortcuts);

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

  // Load image from query param (e.g. from gallery "edit" button)
  useEffect(() => {
    const editImageUrl = searchParams.get("editImage");
    if (editImageUrl && !originalImage) {
      fetch(editImageUrl)
        .then(res => res.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onloadend = () => {
            dispatch({ type: "SET_ORIGINAL_IMAGE", payload: reader.result as string });
            const resultUrl = searchParams.get("resultImage");
            if (resultUrl) {
              dispatch({ type: "SET_RESULT_IMAGE", payload: resultUrl });
            }
          };
          reader.readAsDataURL(blob);
        })
        .catch(() => {
          dispatch({ type: "SET_RESULT_IMAGE", payload: editImageUrl });
          dispatch({ type: "SET_ORIGINAL_IMAGE", payload: editImageUrl });
        });
    }
  }, [searchParams]);

  const handleImageSelect = useCallback((base64: string) => {
    dispatch({ type: "SET_ORIGINAL_IMAGE", payload: base64 });
  }, [dispatch]);

  const handlePresetSelect = useCallback((preset: Preset) => {
    dispatch({
      type: "SELECT_PRESET",
      payload: { id: preset.id, prompt: preset.prompt, name: preset.professionalName, type: preset.type || "surface" },
    });
  }, [dispatch]);

  // Apply adjustments locally using Canvas pixel engine (no AI)
  const handleApplyLocal = useCallback(async () => {
    const sourceImage = resultImage || originalImage;
    if (!sourceImage) return;
    setLocalApplying(true);
    try {
      const opts: CanvasFilterOptions = {
        brightness: adjustments.brightness,
        contrast: adjustments.contrast,
        saturation: adjustments.saturation,
        exposure: adjustments.exposure,
        highlights: adjustments.highlights,
        shadows: adjustments.shadows,
        warmth: adjustments.warmth,
        tint: adjustments.tint,
        hue: adjustments.hue,
        vibrance: adjustments.vibrance,
        clarity: adjustments.clarity,
        sharpness: adjustments.sharpness,
        grain: adjustments.grain,
        vignette: adjustments.vignette,
        fade: adjustments.fade,
        blackAndWhite: adjustments.blackAndWhite,
        sepiaTone: adjustments.sepiaTone,
        dehaze: adjustments.dehaze,
        levelsBlack: adjustments.levelsBlack,
        levelsWhite: adjustments.levelsWhite,
        levelsMidtones: adjustments.levelsMidtones,
        cbShadowsR: adjustments.cbShadowsR, cbShadowsG: adjustments.cbShadowsG, cbShadowsB: adjustments.cbShadowsB,
        cbMidtonesR: adjustments.cbMidtonesR, cbMidtonesG: adjustments.cbMidtonesG, cbMidtonesB: adjustments.cbMidtonesB,
        cbHighlightsR: adjustments.cbHighlightsR, cbHighlightsG: adjustments.cbHighlightsG, cbHighlightsB: adjustments.cbHighlightsB,
      };
      const result = await applyCanvasFilters(sourceImage, opts);
      dispatch({ type: "SET_RESULT_IMAGE", payload: result });
      dispatch({ type: "RESET_ADJUSTMENTS" });
      toast.success("ההתאמות הוחלו מקומית!");
    } catch {
      toast.error("שגיאה בהחלת ההתאמות");
    } finally {
      setLocalApplying(false);
    }
  }, [resultImage, originalImage, adjustments, dispatch]);

  // Floating save — Save as New (to gallery)
  const handleFloatingSaveNew = useCallback(() => {
    setSaveNewName(suggestedName || "");
    setShowSaveDialog(true);
  }, [suggestedName]);

  // Floating save — Replace (apply current adjustments and keep as result)
  const handleFloatingReplace = useCallback(async () => {
    const sourceImage = resultImage || originalImage;
    if (!sourceImage) return;
    const hasAdj = JSON.stringify(adjustments) !== JSON.stringify(defaultAdjustments);
    if (hasAdj) {
      await handleApplyLocal();
    }
    toast.success("השינויים נשמרו!");
  }, [resultImage, originalImage, adjustments, handleApplyLocal]);

  // Check if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    const hasAdj = JSON.stringify(adjustments) !== JSON.stringify(defaultAdjustments);
    return resultImage !== null || hasAdj;
  }, [adjustments, resultImage]);

  const handleProcess = useCallback(async () => {
    if (!originalImage) return toast.error("יש להעלות תמונה קודם");
    const prompt = customPrompt.trim() || activePrompt;
    if (!prompt) return toast.error("יש לבחור רקע או לכתוב תיאור");

    dispatch({ type: "SET_PROCESSING", payload: true });
    dispatch({ type: "SET_RESULT_IMAGE", payload: null });
    dispatch({ type: "SET_SUGGESTED_NAME", payload: null });
    try {
      // Compress image before sending to reduce bandwidth
      const compressed = await compressImage(originalImage);

      const isScene = selectedPresetType === "scene";
      const functionName = isScene
        ? "replace-bg-scene"
        : preciseMode
          ? "replace-bg-pipeline"
          : "replace-background";
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {
          imageBase64: compressed,
          backgroundPrompt: prompt,
          referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      dispatch({ type: "SET_RESULT_IMAGE", payload: data.resultImage });
      toast.success("הרקע הוחלף בהצלחה!");

      // Fire-and-forget: save to history without blocking UI
      if (user) {
        saveToHistoryAsync(
          user,
          originalImage,
          data.resultImage,
          prompt,
          selectedPresetName || customPrompt.trim().slice(0, 50) || null,
        );
      }
      // Get professional name suggestion (non-blocking)
      if (customPrompt.trim() && !selectedPresetName) {
        supabase.functions.invoke("suggest-name", {
          body: { backgroundDescription: customPrompt.trim() },
        }).then(({ data: nameData }) => {
          if (nameData?.name) dispatch({ type: "SET_SUGGESTED_NAME", payload: nameData.name });
        }).catch(() => {});
      } else if (selectedPresetName) {
        dispatch({ type: "SET_SUGGESTED_NAME", payload: selectedPresetName });
      }
    } catch (err) {
      toast.error(err.message || "שגיאה בעיבוד התמונה");
    } finally {
      dispatch({ type: "SET_PROCESSING", payload: false });
    }
  }, [originalImage, customPrompt, activePrompt, selectedPresetType, preciseMode, referenceImages, user, selectedPresetName, dispatch]);

  const handleMultiProcess = useCallback(async () => {
    if (!originalImage || selectedPresetIds.length === 0) {
      toast.error("יש לבחור לפחות רקע אחד");
      return;
    }
    const selectedBgs = selectedPresetIds.map(id => presets.find(p => p.id === id)!).filter(Boolean);
    dispatch({ type: "SET_BATCH_PROCESSING", payload: true });
    dispatch({ type: "SET_BATCH_RESULTS", payload: [] });
    dispatch({ type: "SET_BATCH_PROGRESS", payload: { current: 0, total: selectedBgs.length } });

    // Compress once, reuse for all presets
    const compressed = await compressImage(originalImage);
    let completed = 0;
    const results: Array<{ name: string; image: string; prompt: string }> = [];

    // Process all presets in parallel via job queue (max 3 concurrent)
    const jobs = selectedBgs.map((preset) => ({
      id: preset.id,
      fn: async () => {
        const { data, error } = await supabase.functions.invoke("replace-background", {
          body: { imageBase64: compressed, backgroundPrompt: preset.prompt },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        return { name: preset.professionalName, image: data.resultImage, prompt: preset.prompt };
      },
      onProgress: (status: string) => {
        if (status === "done") {
          completed++;
          dispatch({ type: "SET_BATCH_PROGRESS", payload: { current: completed, total: selectedBgs.length } });
        }
      },
    }));

    const settled = await imageProcessingQueue.addAll(jobs);

    settled.forEach((result, idx) => {
      if (result.status === "fulfilled") {
        const val = result.value as { name: string; image: string; prompt: string };
        results.push(val);
        // Fire-and-forget history save
        if (user) {
          saveToHistoryAsync(user, originalImage, val.image, val.prompt, val.name);
        }
      } else {
        toast.error(`שגיאה ב-${selectedBgs[idx].label}: ${(result.reason as Error)?.message}`);
      }
    });

    dispatch({ type: "SET_BATCH_RESULTS", payload: results });
    dispatch({ type: "SET_BATCH_PROCESSING", payload: false });
    toast.success(`הושלמו ${results.length}/${selectedBgs.length} רקעים!`);
  }, [originalImage, selectedPresetIds, user, dispatch]);

  const handleEnhance = useCallback(async () => {
    const img = resultImage || originalImage;
    if (!img) return;
    dispatch({ type: "SET_ENHANCING", payload: true });
    try {
      const { data, error } = await supabase.functions.invoke("replace-background", {
        body: {
          imageBase64: img,
          backgroundPrompt: "Enhance this image quality. Increase sharpness, improve lighting, fix any artifacts, make colors more vivid. Keep the composition exactly the same. Output the highest quality version possible.",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      dispatch({ type: "SET_RESULT_IMAGE", payload: data.resultImage });
      toast.success("התמונה שופרה!");
    } catch (err) {
      toast.error(err.message || "שגיאה בשיפור התמונה");
    } finally {
      dispatch({ type: "SET_ENHANCING", payload: false });
    }
  }, [resultImage, originalImage, dispatch]);

  const handleExport = useCallback(
    async (format: string, quality: number, options?: ExportOptions) => {
      const img = resultImage || originalImage;
      if (!img) return;
      dispatch({ type: "SET_EXPORTING", payload: true });

      try {
        const image = new Image();
        image.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = reject;
          image.src = img;
        });

        const filterStr = getFilterString(adjustments);
        const overlayStyles = getOverlayStyles(adjustments);

        // Determine final size (resize support)
        let finalW = image.naturalWidth;
        let finalH = image.naturalHeight;
        if (options?.resizeWidth || options?.resizeHeight) {
          if (options.resizeWidth && options.resizeHeight && !options.maintainAspect) {
            finalW = options.resizeWidth;
            finalH = options.resizeHeight;
          } else if (options.resizeWidth) {
            finalW = options.resizeWidth;
            finalH = Math.round(image.naturalHeight * (options.resizeWidth / image.naturalWidth));
          } else if (options.resizeHeight) {
            finalH = options.resizeHeight;
            finalW = Math.round(image.naturalWidth * (options.resizeHeight / image.naturalHeight));
          }
        }

        // Try to use Web Worker + OffscreenCanvas for non-blocking export
        if (format !== "pdf" && format !== "tiff" && typeof OffscreenCanvas !== "undefined" && !options?.watermark && !overlayStyles) {
          try {
            const bitmap = await createImageBitmap(image);
            const worker = new Worker(
              new URL("@/lib/export-worker.ts", import.meta.url),
              { type: "module" }
            );

            const blob = await new Promise<Blob>((resolve, reject) => {
              worker.onmessage = (e) => {
                worker.terminate();
                if (e.data.type === "result") resolve(e.data.blob);
                else reject(new Error(e.data.error));
              };
              worker.postMessage({
                type: "export",
                imageData: bitmap,
                width: finalW,
                height: finalH,
                filter: filterStr,
                format,
                quality,
              }, [bitmap]);
            });

            downloadBlob(blob, `result.${format}`, blob.type);
            toast.success("התמונה יוצאה בהצלחה!");
            return;
          } catch {
            // Fallback to main thread if worker fails
          }
        }

        // Fallback: main thread canvas export
        const canvas = document.createElement("canvas");
        canvas.width = finalW;
        canvas.height = finalH;
        const ctx = canvas.getContext("2d")!;
        ctx.filter = filterStr;
        ctx.drawImage(image, 0, 0, finalW, finalH);
        ctx.filter = "none";

        // Apply vignette overlay if present
        if (overlayStyles?.background) {
          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = finalW;
          tempCanvas.height = finalH;
          const tempCtx = tempCanvas.getContext("2d")!;
          const gradient = tempCtx.createRadialGradient(
            finalW / 2, finalH / 2, finalW * 0.3,
            finalW / 2, finalH / 2, finalW * 0.7
          );
          gradient.addColorStop(0, "transparent");
          gradient.addColorStop(1, `rgba(0,0,0,${(adjustments.vignette || 0) / 100})`);
          tempCtx.fillStyle = gradient;
          tempCtx.fillRect(0, 0, finalW, finalH);
          ctx.globalCompositeOperation = "multiply";
          ctx.drawImage(tempCanvas, 0, 0);
          ctx.globalCompositeOperation = "source-over";
        }

        // Apply grain noise on canvas
        if (adjustments.grain > 0) {
          const grainData = ctx.getImageData(0, 0, finalW, finalH);
          const d = grainData.data;
          const strength = adjustments.grain * 0.6;
          for (let i = 0; i < d.length; i += 4) {
            const noise = (Math.random() - 0.5) * strength;
            d[i] += noise;
            d[i + 1] += noise;
            d[i + 2] += noise;
          }
          ctx.putImageData(grainData, 0, 0);
        }

        // Apply split toning on canvas
        if (adjustments.splitHighlightStrength > 0) {
          ctx.globalCompositeOperation = "screen";
          ctx.fillStyle = adjustments.splitHighlightColor;
          ctx.globalAlpha = adjustments.splitHighlightStrength / 100;
          ctx.fillRect(0, 0, finalW, finalH);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = "source-over";
        }
        if (adjustments.splitShadowStrength > 0) {
          ctx.globalCompositeOperation = "multiply";
          ctx.fillStyle = adjustments.splitShadowColor;
          ctx.globalAlpha = adjustments.splitShadowStrength / 100;
          ctx.fillRect(0, 0, finalW, finalH);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = "source-over";
        }

        // Apply watermark
        if (options?.watermark) {
          const fontSize = Math.max(14, Math.round(finalW * 0.03));
          ctx.font = `${fontSize}px sans-serif`;
          ctx.fillStyle = `rgba(255,255,255,${(options.watermarkOpacity || 50) / 100})`;
          ctx.textBaseline = "bottom";
          const textW = ctx.measureText(options.watermark).width;
          let x: number;
          const y = finalH - fontSize * 0.8;
          switch (options.watermarkPosition) {
            case "bottom-left": x = fontSize * 0.5; break;
            case "bottom-right": x = finalW - textW - fontSize * 0.5; break;
            default: x = (finalW - textW) / 2; break;
          }
          // Shadow for readability
          ctx.shadowColor = "rgba(0,0,0,0.5)";
          ctx.shadowBlur = 4;
          ctx.shadowOffsetX = 1;
          ctx.shadowOffsetY = 1;
          ctx.fillText(options.watermark, x, y);
          ctx.shadowColor = "transparent";
        }

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
      } catch (err) {
        toast.error("שגיאה בייצוא");
      } finally {
        dispatch({ type: "SET_EXPORTING", payload: false });
      }
    },
    [resultImage, originalImage, adjustments, dispatch]
  );

  const handleSaveToGallery = useCallback(async (mode: "replace" | "new") => {
    if (!user) return;
    setIsSaving(true);
    try {
      let img = resultImage;
      const hasAdj = JSON.stringify(adjustments) !== JSON.stringify(defaultAdjustments);
      if (!img && originalImage && hasAdj) {
        const opts: CanvasFilterOptions = {
          brightness: adjustments.brightness,
          contrast: adjustments.contrast,
          saturation: adjustments.saturation,
          exposure: adjustments.exposure,
          highlights: adjustments.highlights,
          shadows: adjustments.shadows,
          warmth: adjustments.warmth,
          tint: adjustments.tint,
          hue: adjustments.hue,
          vibrance: adjustments.vibrance,
          clarity: adjustments.clarity,
          sharpness: adjustments.sharpness,
          grain: adjustments.grain,
          vignette: adjustments.vignette,
          fade: adjustments.fade,
          blackAndWhite: adjustments.blackAndWhite,
          sepiaTone: adjustments.sepiaTone,
          dehaze: adjustments.dehaze,
          levelsBlack: adjustments.levelsBlack,
          levelsWhite: adjustments.levelsWhite,
          levelsMidtones: adjustments.levelsMidtones,
          cbShadowsR: adjustments.cbShadowsR, cbShadowsG: adjustments.cbShadowsG, cbShadowsB: adjustments.cbShadowsB,
          cbMidtonesR: adjustments.cbMidtonesR, cbMidtonesG: adjustments.cbMidtonesG, cbMidtonesB: adjustments.cbMidtonesB,
          cbHighlightsR: adjustments.cbHighlightsR, cbHighlightsG: adjustments.cbHighlightsG, cbHighlightsB: adjustments.cbHighlightsB,
        };
        img = await applyCanvasFilters(originalImage, opts);
        dispatch({ type: "SET_RESULT_IMAGE", payload: img });
        dispatch({ type: "RESET_ADJUSTMENTS" });
      }
      if (!img) {
        toast.error("אין גרסה לשמירה. בצע שינוי או צור תוצאה קודם");
        return;
      }

      const uid = user.id;
      const ts = Date.now();
      const resultBlob = await fetch(img).then(r => r.blob());
      const upload = await supabase.storage.from("processed-images").upload(`${uid}/${ts}_result.png`, resultBlob, { contentType: "image/png" });
      if (!upload.data) throw new Error("Upload failed");
      const resultUrl = supabase.storage.from("processed-images").getPublicUrl(upload.data.path).data.publicUrl;

      if (mode === "new") {
        const origBlob = originalImage ? await fetch(originalImage).then(r => r.blob()) : resultBlob;
        const origUpload = await supabase.storage.from("processed-images").upload(`${uid}/${ts}_original.png`, origBlob, { contentType: "image/png" });
        const origUrl = origUpload.data ? supabase.storage.from("processed-images").getPublicUrl(origUpload.data.path).data.publicUrl : resultUrl;
        await supabase.from("processing_history").insert({
          user_id: uid,
          original_image_url: origUrl,
          result_image_url: resultUrl,
          background_prompt: customPrompt.trim() || activePrompt || "עריכת צבע/סגנון",
          background_name: saveNewName.trim() || suggestedName || "תמונה ערוכה",
        });
        toast.success("נשמר כתמונה חדשה בגלריה! 🎨");
      } else {
        const editImageUrl = searchParams.get("editImage");
        if (editImageUrl) {
          const { data: existing } = await supabase.from("processing_history")
            .select("id")
            .eq("result_image_url", editImageUrl)
            .limit(1);
          if (existing && existing.length > 0) {
            await supabase.from("processing_history")
              .update({ result_image_url: resultUrl, background_name: saveNewName.trim() || suggestedName || undefined })
              .eq("id", existing[0].id);
            toast.success("התמונה הוחלפה בגלריה! ✅");
          } else {
            await supabase.from("processing_history").insert({
              user_id: uid, original_image_url: editImageUrl, result_image_url: resultUrl,
              background_prompt: customPrompt.trim() || activePrompt || "עריכה",
              background_name: saveNewName.trim() || suggestedName || "תמונה ערוכה",
            });
            toast.success("נשמר בגלריה! ✅");
          }
        }
      }
    } catch (err) {
      toast.error(err.message || "שגיאה בשמירה");
    } finally {
      setIsSaving(false);
      setShowSaveDialog(false);
      setSaveNewName("");
    }
  }, [resultImage, originalImage, user, saveNewName, suggestedName, customPrompt, activePrompt, searchParams, adjustments, dispatch]);

  return (
    <div className="min-h-screen bg-background font-body" dir="rtl">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </Link>
            <h1 className="font-display text-base sm:text-xl font-bold text-foreground">AI Background Replacer</h1>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-1 rounded-full border border-gold/25 bg-gold/5 p-1">
              {studioTopTabs.map((tab) => {
                const isActive = location.pathname.startsWith(tab.path);
                return (
                  <button
                    type="button"
                    key={tab.path}
                    onClick={() => openWorkspaceWithSelectedImage(tab.path as "/collage" | "/catalog")}
                    className={`rounded-full px-4 py-1.5 font-body text-[12px] font-semibold leading-none tracking-[0.01em] transition-all ${
                      isActive
                        ? "bg-gold text-gold-foreground shadow-sm"
                        : "text-foreground/80 hover:bg-gold/15 hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
            {user && (
              <>
                <Link
                  to="/"
                  className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 font-accent text-xs font-semibold text-foreground transition-colors hover:border-gold/40"
                >
                  <Home className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">דף הבית</span>
                </Link>
                <button
                  onClick={() => dispatch({ type: "TOGGLE_MODAL", payload: { modal: "history", value: true } })}
                  className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 font-accent text-xs font-semibold text-foreground transition-colors hover:border-gold/40"
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">היסטוריה</span>
                </button>
                <Link
                  to="/gallery"
                  className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 font-accent text-xs font-semibold text-foreground transition-colors hover:border-gold/40"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">גלריה</span>
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
                onClick={() => dispatch({ type: "TOGGLE_MODAL", payload: { modal: "devSettings", value: true } })}
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
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-4 sm:py-8">
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-8">
          {/* Canvas */}
          <div className="flex-1 space-y-6">
            {originalImage ? (
              <div className="relative">
                <ImageCanvas
                  originalImage={originalImage}
                  resultImage={resultImage}
                  isProcessing={isProcessing || isEnhancing}
                  adjustments={adjustments}
                  liveFilterCss={liveFilterCss}
                />
                <FloatingSaveAction
                  visible={!!originalImage && hasUnsavedChanges && !!user}
                  onSaveNew={handleFloatingSaveNew}
                  onReplace={handleFloatingReplace}
                  isSaving={isSaving || localApplying}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <ImageUploader onImageSelect={handleImageSelect} />
                <div className="flex items-center justify-center">
                  <button
                    onClick={() => setShowPdfProcessor(true)}
                    className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 font-accent text-sm font-semibold text-foreground transition-all hover:bg-secondary hover:border-primary"
                  >
                    <FileText className="h-4 w-4 text-primary" />
                    העלאת קובץ PDF
                  </button>
                </div>
                {showPdfProcessor && (
                  <Suspense fallback={<FallbackSpinner />}>
                    <PdfProcessor
                      onSelectPage={(dataUrl) => {
                        handleImageSelect(dataUrl);
                        setShowPdfProcessor(false);
                      }}
                      onClose={() => setShowPdfProcessor(false)}
                    />
                  </Suspense>
                )}
              </div>
            )}

            {originalImage && (
              <div className="flex flex-wrap items-center gap-3">
                {/* Undo / Redo */}
                <div className="flex items-center gap-1 rounded-lg border border-border bg-card">
                  <button
                    onClick={() => dispatch({ type: "UNDO" })}
                    disabled={undoStack.length === 0}
                    className="flex h-9 w-9 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                    title="בטל (Ctrl+Z)"
                  >
                    <Undo2 className="h-4 w-4" />
                  </button>
                  <div className="h-5 w-px bg-border" />
                  <button
                    onClick={() => dispatch({ type: "REDO" })}
                    disabled={redoStack.length === 0}
                    className="flex h-9 w-9 items-center justify-center rounded-l-lg text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                    title="בצע שוב (Ctrl+Shift+Z)"
                  >
                    <Redo2 className="h-4 w-4" />
                  </button>
                </div>

                {!multiSelectMode ? (
                  <button
                    onClick={handleProcess}
                    disabled={!aiEnabled || isProcessing || (!activePrompt && !customPrompt.trim())}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2.5 sm:px-6 sm:py-3 font-display text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed ${
                      selectedPresetType === "scene"
                        ? "bg-gradient-to-l from-emerald-500 to-teal-600 text-white"
                        : preciseMode
                          ? "bg-gradient-to-l from-amber-500 to-accent text-white"
                          : "bg-accent text-accent-foreground"
                    }`}
                  >
                    <Sparkles className="h-4 w-4" />
                    {isProcessing ? "מעבד..." : selectedPresetType === "scene" ? "הצב בסצנה" : preciseMode ? "החלף רקע (מדויק)" : "החלף רקע"}
                  </button>
                ) : (
                  <button
                    onClick={handleMultiProcess}
                    disabled={!aiEnabled || batchProcessing || selectedPresetIds.length === 0}
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
                    dispatch({ type: "SET_MULTI_SELECT_MODE", payload: !multiSelectMode });
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
                  onClick={() => dispatch({ type: "SET_PRECISE_MODE", payload: !preciseMode })}
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
                  disabled={!aiEnabled || isEnhancing || isProcessing}
                  className="flex items-center gap-2 rounded-lg bg-primary px-5 py-3 font-display text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Wand2 className="h-4 w-4" />
                  {isEnhancing ? "משפר..." : "שפר איכות"}
                </button>

                {resultImage && (
                  <button
                  onClick={() => dispatch({ type: "TOGGLE_MODAL", payload: { modal: "mockup", value: true } })}
                    className="flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-3 font-display text-sm font-semibold text-foreground transition-all hover:bg-secondary"
                  >
                    <Frame className="h-4 w-4" />
                    מוקאפ
                  </button>
                )}

                {resultImage && (
                  <button
                    onClick={() => dispatch({ type: "TOGGLE_MODAL", payload: { modal: "social", value: true } })}
                    className="flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-3 font-display text-sm font-semibold text-foreground transition-all hover:bg-secondary"
                  >
                    <Share2 className="h-4 w-4" />
                    תבניות
                  </button>
                )}

                {resultImage && (
                  <button
                    onClick={() => dispatch({ type: "TOGGLE_MODAL", payload: { modal: "share", value: true } })}
                    className="flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/5 px-5 py-3 font-display text-sm font-semibold text-gold transition-all hover:bg-gold/10"
                  >
                    <Share2 className="h-4 w-4" />
                    שתף + QR
                  </button>
                )}

                {resultImage && user && (
                  <button
                    onClick={() => { setSaveNewName(suggestedName || ""); setShowSaveDialog(true); }}
                    className="flex items-center gap-2 rounded-lg bg-primary px-5 py-3 font-display text-sm font-semibold text-primary-foreground transition-all hover:brightness-110"
                  >
                    <Save className="h-4 w-4" />
                    שמור לגלריה
                  </button>
                )}

                {resultImage && (
                  <button
                    onClick={() => {
                      dispatch({ type: "ADD_COMPARISON_IMAGE", payload: { image: resultImage, label: suggestedName || selectedPresetName || "גרסה" } });
                      dispatch({ type: "TOGGLE_COMPARISON", payload: true });
                    }}
                    className="flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-3 font-display text-sm font-semibold text-foreground transition-all hover:bg-secondary"
                  >
                    <GitCompare className="h-4 w-4" />
                    השוואה
                    {comparisonImages.length > 0 && (
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 font-accent text-[10px] font-bold text-primary">{comparisonImages.length}</span>
                    )}
                  </button>
                )}

                <button
                  onClick={() => dispatch({ type: "TOGGLE_MODAL", payload: { modal: "batch", value: true } })}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-3 font-display text-sm font-semibold text-foreground transition-all hover:bg-secondary"
                >
                  <Layers className="h-4 w-4" />
                  עיבוד מרובה
                </button>

                <button
                  onClick={() => {
                    dispatch({ type: "RESET_IMAGE" });
                  }}
                  className="flex items-center gap-2 font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <UploadIcon className="h-4 w-4" />
                  תמונה חדשה
                </button>
              </div>
            )}

            {/* Recent results */}
            {user && (
              <ResultsStrip
                onSelectImage={(url) => dispatch({ type: "SET_RESULT_IMAGE", payload: url })}
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
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5">
                      <span className={`font-body text-[11px] ${aiEnabled ? "text-muted-foreground" : "text-primary font-semibold"}`}>ללא AI</span>
                      <Switch checked={aiEnabled} onCheckedChange={setAiMode} />
                      <span className={`font-body text-[11px] ${aiEnabled ? "text-primary font-semibold" : "text-muted-foreground"}`}>AI</span>
                    </div>
                    <button
                      onClick={() => {
                        downloadImagesAsZip(batchResults).then(() => toast.success("ZIP הורד בהצלחה!")).catch(() => toast.error("שגיאה בהורדה"));
                      }}
                      className="font-accent text-xs text-primary hover:text-primary/80 font-semibold"
                    >
                      📦 הורד ZIP
                    </button>
                    <button
                      onClick={() => dispatch({ type: "SET_BATCH_RESULTS", payload: [] })}
                      className="font-accent text-xs text-muted-foreground hover:text-foreground"
                    >
                      נקה
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {batchResults.map((r, i) => (
                    <div
                      key={i}
                      className="group relative rounded-xl border border-border overflow-hidden bg-card cursor-pointer hover:border-gold/50 hover:shadow-md transition-all"
                      onClick={() => dispatch({ type: "SET_RESULT_IMAGE", payload: r.image })}
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
                <div className="flex flex-col flex-1">
                  <span className="font-body text-xs text-muted-foreground">שם מקצועי מוצע למוצר:</span>
                  <EditableLabel
                    hebrewName={suggestedName}
                    englishName={selectedPresetName || suggestedName}
                    onSave={(he, en) => {
                      dispatch({ type: "SET_SUGGESTED_NAME", payload: he });
                      dispatch({ type: "SET_CUSTOM_PROMPT", payload: "" });
                      dispatch({ type: "APPLY_BACKGROUND", payload: { prompt: state.activePrompt, name: en } });
                    }}
                    size="md"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          {originalImage && (
            <div className="w-full lg:w-80 shrink-0">
              <div className="sticky top-8 space-y-0 rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                {/* Tabs */}
                <div className="overflow-x-auto scrollbar-hide border-b border-border">
                  {[
                    { key: "backgrounds" as const, label: "רקעים", icon: "" },
                    { key: "smart" as const, label: "חכם", icon: "🧠" },
                    { key: "nonai" as const, label: "Pro ללא AI", icon: "⚙️" },
                    { key: "filters" as const, label: "פילטרים", icon: "⚡" },
                    { key: "advanced" as const, label: "מתקדם", icon: "🎛️" },
                    { key: "crop" as const, label: "חיתוך", icon: "✂️" },
                    { key: "tools" as const, label: "כלים", icon: "" },
                    { key: "adjust" as const, label: "התאמות", icon: "" },
                    { key: "export" as const, label: "ייצוא", icon: "" },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => dispatch({ type: "SET_ACTIVE_TAB", payload: tab.key })}
                      className={`shrink-0 whitespace-nowrap flex-1 py-3 px-2 font-body text-[11px] font-semibold leading-normal tracking-[0.01em] transition-colors ${
                        activeTab === tab.key
                          ? "text-primary border-b-2 border-primary bg-primary/5"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {tab.icon && <span aria-hidden="true">{tab.icon}</span>}
                        <span>{tab.label}</span>
                      </span>
                    </button>
                  ))}
                </div>

                <div className="p-3 sm:p-5 max-h-[70vh] overflow-y-auto">
                  {/* Tooltip Help Button */}
                  <div className="flex justify-end mb-2">
                    <TooltipHelpButton page={activeTab} />
                  </div>

                  {activeTab === "backgrounds" && (
                    <BackgroundPresets
                      selectedId={selectedPreset}
                      onSelect={handlePresetSelect}
                      customPrompt={customPrompt}
                      onCustomPromptChange={(v) => {
                        dispatch({ type: "SET_CUSTOM_PROMPT", payload: v });
                      }}
                      referenceImages={referenceImages}
                      onReferenceImagesChange={(imgs) => dispatch({ type: "SET_REFERENCE_IMAGES", payload: imgs })}
                      multiSelectMode={multiSelectMode}
                      selectedPresets={selectedPresetIds}
                      onTogglePreset={(preset) => {
                        dispatch({ type: "TOGGLE_PRESET_ID", payload: preset.id });
                      }}
                    />
                  )}
                  {activeTab === "tools" && (
                    <ErrorBoundary>
                    <Suspense fallback={<LazyFallback />}>
                      <AdvancedToolsPanel
                        originalImage={originalImage}
                        resultImage={resultImage}
                        onResult={(img) => dispatch({ type: "SET_RESULT_IMAGE", payload: img })}
                      />
                    </Suspense>
                    </ErrorBoundary>
                  )}
                  {activeTab === "smart" && (
                    <ErrorBoundary>
                    <Suspense fallback={<LazyFallback />}>
                      {!aiEnabled ? (
                        <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                          מצב AI כבוי. להפעלת כלי AI העבר את המתג למצב AI.
                        </div>
                      ) : (
                      <SmartSuggestPanel
                        imageBase64={originalImage}
                        onSelectPrompt={(prompt, name) => {
                          dispatch({ type: "APPLY_BACKGROUND", payload: { prompt, name } });
                          toast.success(`רקע "${name}" הוגדר — לחץ "החלף רקע" להחיל`);
                        }}
                      />
                      )}
                    </Suspense>
                    </ErrorBoundary>
                  )}
                  {activeTab === "nonai" && (
                    <NonAiLabPanel
                      currentImage={resultImage || originalImage}
                      onResult={(img) => dispatch({ type: "SET_RESULT_IMAGE", payload: img })}
                    />
                  )}
                  {activeTab === "filters" && (
                    <div className="space-y-6">
                      <LiveHistogram
                        imageSrc={resultImage || originalImage}
                        liveFilterCss={liveFilterCss}
                      />

                      <div className="border-t border-border pt-4">
                      </div>
                      <LiveFilterPanel
                        currentImage={resultImage || originalImage}
                        onPreviewFilter={(css) => setLiveFilterCss(css)}
                        onApply={async (filters) => {
                          setFilterProcessing(true);
                          const currentImg = resultImage || originalImage;
                          const cached = currentImg ? getCachedResult(currentImg, "live-filter-apply", filters as unknown as Record<string, unknown>) : null;
                          if (cached) {
                            dispatch({ type: "SET_RESULT_IMAGE", payload: cached });
                            setLiveFilterCss("");
                            toast.success("נטען מ-cache!");
                            setFilterProcessing(false);
                            return;
                          }
                          try {
                            const { data, error } = await supabase.functions.invoke("image-tools", {
                              body: { imageBase64: currentImg, action: "live-filter-apply", actionParams: { filters } },
                            });
                            if (error) throw error;
                            if (data?.error) throw new Error(data.error);
                            if (data?.resultImage) {
                              dispatch({ type: "SET_RESULT_IMAGE", payload: data.resultImage });
                              if (currentImg) setCachedResult(currentImg, "live-filter-apply", filters as unknown as Record<string, unknown>, data.resultImage);
                              setLiveFilterCss("");
                              toast.success("הפילטרים הוחלו!");
                            }
                          } catch (err) {
                            toast.error(err.message || "שגיאה בעיבוד");
                          } finally {
                            setFilterProcessing(false);
                          }
                        }}
                        isProcessing={filterProcessing}
                      />

                      <div className="border-t border-border pt-4">
                        <FilterLayersPanel
                          currentImage={resultImage || originalImage}
                          onPreviewFilter={(css) => setLiveFilterCss(css)}
                          onApplyLayers={async (layers) => {
                            setFilterProcessing(true);
                            const currentImg = resultImage || originalImage;
                            const layerNames = layers.filter(l => l.visible).map(l => l.name);
                            try {
                              const { data, error } = await supabase.functions.invoke("image-tools", {
                                body: { imageBase64: currentImg, action: "apply-layers", actionParams: { layerNames } },
                              });
                              if (error) throw error;
                              if (data?.error) throw new Error(data.error);
                              if (data?.resultImage) {
                                dispatch({ type: "SET_RESULT_IMAGE", payload: data.resultImage });
                                setLiveFilterCss("");
                                toast.success("השכבות הוחלו!");
                              }
                            } catch (err) {
                              toast.error(err.message || "שגיאה בעיבוד");
                            } finally {
                              setFilterProcessing(false);
                            }
                          }}
                          isProcessing={filterProcessing}
                        />
                      </div>

                      <div className="border-t border-border pt-4">
                        <ColorTransferPanel
                          currentImage={resultImage || originalImage}
                          onApply={async (referenceBase64) => {
                            setFilterProcessing(true);
                            try {
                              const { data, error } = await supabase.functions.invoke("image-tools", {
                                body: {
                                  imageBase64: resultImage || originalImage,
                                  action: "color-transfer",
                                  actionParams: { referenceImage: referenceBase64 },
                                },
                              });
                              if (error) throw error;
                              if (data?.error) throw new Error(data.error);
                              if (data?.resultImage) {
                                dispatch({ type: "SET_RESULT_IMAGE", payload: data.resultImage });
                                toast.success("הפלטה הועברה בהצלחה!");
                              }
                            } catch (err) {
                              toast.error(err.message || "שגיאה בהעברת צבע");
                            } finally {
                              setFilterProcessing(false);
                            }
                          }}
                          isProcessing={filterProcessing}
                        />
                      </div>

                      <div className="border-t border-border pt-4">
                        <RegionalMaskPanel
                          currentImage={resultImage || originalImage}
                          onApply={async (region, filterType, intensity) => {
                            setFilterProcessing(true);
                            const currentImg = resultImage || originalImage;
                            const params = { region, filterType, intensity };
                            const cached = currentImg ? getCachedResult(currentImg, "regional-mask", params) : null;
                            if (cached) {
                              dispatch({ type: "SET_RESULT_IMAGE", payload: cached });
                              toast.success("נטען מ-cache!");
                              setFilterProcessing(false);
                              return;
                            }
                            try {
                              const { data, error } = await supabase.functions.invoke("image-tools", {
                                body: { imageBase64: currentImg, action: "regional-mask", actionParams: params },
                              });
                              if (error) throw error;
                              if (data?.error) throw new Error(data.error);
                              if (data?.resultImage) {
                                dispatch({ type: "SET_RESULT_IMAGE", payload: data.resultImage });
                                if (currentImg) setCachedResult(currentImg, "regional-mask", params, data.resultImage);
                                toast.success("הפילטר האזורי הוחל!");
                              }
                            } catch (err) {
                              toast.error(err.message || "שגיאה בעיבוד");
                            } finally {
                              setFilterProcessing(false);
                            }
                          }}
                          isProcessing={filterProcessing}
                        />
                      </div>
                    </div>
                  )}
                  {activeTab === "advanced" && (
                    <AdvancedFiltersPanel
                      currentImage={resultImage || originalImage}
                      onResult={(img) => dispatch({ type: "SET_RESULT_IMAGE", payload: img })}
                    />
                  )}
                  {activeTab === "crop" && (
                    <CropTransformPanel
                      currentImage={resultImage || originalImage}
                      onApply={(img) => dispatch({ type: "SET_RESULT_IMAGE", payload: img })}
                      isProcessing={isProcessing}
                    />
                  )}
                  {activeTab === "adjust" && (
                    <ImageAdjustmentsPanel
                      adjustments={adjustments}
                      onChange={(a) => dispatch({ type: "SET_ADJUSTMENTS", payload: a })}
                      onReset={() => dispatch({ type: "RESET_ADJUSTMENTS" })}
                      onApplyLocal={handleApplyLocal}
                      isApplying={localApplying}
                    />
                  )}
                  {activeTab === "export" && (
                    <ExportPanel
                      resultImage={resultImage}
                      isExporting={isExporting}
                      onExport={handleExport}
                      onResult={(img) => dispatch({ type: "SET_RESULT_IMAGE", payload: img })}
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Lazy-loaded modals — only rendered when shown */}
      <ErrorBoundary>
      <Suspense fallback={null}>
        {showMockup && resultImage && (
          <MockupPreview imageUrl={resultImage} onClose={() => dispatch({ type: "TOGGLE_MODAL", payload: { modal: "mockup", value: false } })} />
        )}

        {showBatch && (
          <BatchProcessor
            backgroundPrompt={customPrompt.trim() || activePrompt}
            referenceImages={referenceImages}
            onClose={() => dispatch({ type: "TOGGLE_MODAL", payload: { modal: "batch", value: false } })}
          />
        )}

        {showSocial && resultImage && (
          <SocialTemplates
            imageUrl={resultImage}
            onClose={() => dispatch({ type: "TOGGLE_MODAL", payload: { modal: "social", value: false } })}
          />
        )}

        {showShare && resultImage && (
          <ShareDialog
            imageUrl={resultImage}
            title={suggestedName || selectedPresetName || undefined}
            onClose={() => dispatch({ type: "TOGGLE_MODAL", payload: { modal: "share", value: false } })}
          />
        )}

        <AIChatDialog
          onApplyBackground={(prompt, name) => {
            dispatch({ type: "APPLY_BACKGROUND", payload: { prompt, name } });
            toast.success(`רקע "${name}" הוגדר — לחץ "החלף רקע" להחיל`);
          }}
          onEditWithImages={(productImg, refImg, fidelity, elements) => {
            dispatch({ type: "SET_ORIGINAL_IMAGE", payload: productImg });
            dispatch({ type: "SET_REFERENCE_IMAGES", payload: [refImg] });
            const editPrompt = `Replace background to match reference image exactly. Fidelity: ${fidelity}. ${elements ? `Include elements: ${elements}` : ""}`;
            dispatch({ type: "SET_CUSTOM_PROMPT", payload: editPrompt });
            dispatch({ type: "SET_ACTIVE_PROMPT", payload: editPrompt });
            dispatch({ type: "SET_PRECISE_MODE", payload: true });
            toast.success("התמונות נטענו — לחץ 'החלף רקע' להחיל!");
          }}
        />

        {showHistory && (
          <HistoryPanel
            onClose={() => dispatch({ type: "TOGGLE_MODAL", payload: { modal: "history", value: false } })}
            onSelectImage={(url) => {
              dispatch({ type: "SET_RESULT_IMAGE", payload: url });
              dispatch({ type: "TOGGLE_MODAL", payload: { modal: "history", value: false } });
            }}
          />
        )}

        {/* Dev Settings */}
        <DevSettingsDialog open={showDevSettings} onClose={() => dispatch({ type: "TOGGLE_MODAL", payload: { modal: "devSettings", value: false } })} />

        {/* Save to Gallery Dialog */}
        {showSaveDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 backdrop-blur-sm" dir="rtl">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Save className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-display text-sm font-bold text-foreground">שמירה לגלריה</h3>
                  <p className="font-body text-xs text-muted-foreground">בחר שם לתמונה ואופן שמירה</p>
                </div>
              </div>

              <input
                value={saveNewName}
                onChange={e => setSaveNewName(e.target.value)}
                placeholder="שם התמונה..."
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 font-body text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                dir="rtl"
                autoFocus
              />

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowSaveDialog(false)}
                  className="rounded-lg border border-border px-4 py-2.5 font-display text-xs font-semibold text-foreground transition-colors hover:bg-secondary"
                >
                  ביטול
                </button>
                {searchParams.get("editImage") && (
                  <button
                    onClick={() => handleSaveToGallery("replace")}
                    disabled={isSaving}
                    className="flex-1 rounded-lg border border-primary bg-primary/10 px-4 py-2.5 font-display text-xs font-semibold text-primary transition-all hover:bg-primary/20 disabled:opacity-50"
                  >
                    {isSaving ? "שומר..." : "🔄 החלף ושמור"}
                  </button>
                )}
                <button
                  onClick={() => handleSaveToGallery("new")}
                  disabled={isSaving}
                  className="flex-1 rounded-lg bg-gold px-4 py-2.5 font-display text-xs font-semibold text-gold-foreground transition-all hover:brightness-110 disabled:opacity-50"
                >
                  {isSaving ? "שומר..." : "🧬 שכפל ושמור"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Comparison Gallery */}
        {showComparison && (
          <ComparisonGallery
            images={comparisonImages}
            originalImage={originalImage}
            onClose={() => dispatch({ type: "TOGGLE_COMPARISON", payload: false })}
            onSelect={(img) => {
              dispatch({ type: "SET_RESULT_IMAGE", payload: img });
              dispatch({ type: "TOGGLE_COMPARISON", payload: false });
            }}
            onClear={() => dispatch({ type: "CLEAR_COMPARISON" })}
          />
        )}
      </Suspense>
      </ErrorBoundary>
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

const ToolPage = () => (
  <ToolProvider>
    <ToolInner />
  </ToolProvider>
);

export default ToolPage;
