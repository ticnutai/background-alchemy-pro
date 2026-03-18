import { useState, useCallback, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import EditableLabel from "@/components/EditableLabel";
import { useNavigate, Link, useLocation, useSearchParams } from "react-router-dom";
import { Sparkles, Shield, Wand2, Upload as UploadIcon, Tag, Eye, Layers, Clock, LogOut, LogIn, Share2, Brain, Home, ArrowRight, FlaskConical, Settings, Save, Undo2, Redo2, GitCompare, Crop, SlidersHorizontal, Frame, FileText, Settings2, Sun, Download, ImageIcon, Wrench, Ruler, Maximize2, Minimize2, Move, X, Lock, Unlock, Hand, FolderOpen, FolderPlus, LayoutGrid } from "lucide-react";
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
import FrameStylePanel, { type FramePresetDefinition, type FramePresetCategory, type FrameShape, type FrameStyle } from "@/components/FrameStylePanel";
import NonAiLabPanel from "@/components/NonAiLabPanel";
import SmartRemoveBgPanel from "@/components/SmartRemoveBgPanel";
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

const buildFramePath = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  inset: number,
  shape: FrameShape,
  radiusPercent: number,
) => {
  const w = Math.max(1, width - inset * 2);
  const h = Math.max(1, height - inset * 2);
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(w, h) * (Math.max(0, Math.min(50, radiusPercent)) / 100);
  const left = inset;
  const top = inset;
  const right = inset + w;
  const bottom = inset + h;

  ctx.beginPath();
  if (shape === "circle") {
    const rad = Math.max(1, Math.min(w, h) / 2);
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    return;
  }
  if (shape === "diamond") {
    ctx.moveTo(cx, top);
    ctx.lineTo(right, cy);
    ctx.lineTo(cx, bottom);
    ctx.lineTo(left, cy);
    ctx.closePath();
    return;
  }
  if (shape === "hexagon") {
    const dx = w * 0.25;
    ctx.moveTo(left + dx, top);
    ctx.lineTo(right - dx, top);
    ctx.lineTo(right, cy);
    ctx.lineTo(right - dx, bottom);
    ctx.lineTo(left + dx, bottom);
    ctx.lineTo(left, cy);
    ctx.closePath();
    return;
  }
  if (shape === "octagon") {
    const dx = w * 0.22;
    const dy = h * 0.22;
    ctx.moveTo(left + dx, top);
    ctx.lineTo(right - dx, top);
    ctx.lineTo(right, top + dy);
    ctx.lineTo(right, bottom - dy);
    ctx.lineTo(right - dx, bottom);
    ctx.lineTo(left + dx, bottom);
    ctx.lineTo(left, bottom - dy);
    ctx.lineTo(left, top + dy);
    ctx.closePath();
    return;
  }

  const rr = shape === "pill" ? Math.min(w, h) / 2 : Math.min(r, w / 2, h / 2);
  if (shape === "rounded" || shape === "pill") {
    ctx.moveTo(left + rr, top);
    ctx.lineTo(right - rr, top);
    ctx.quadraticCurveTo(right, top, right, top + rr);
    ctx.lineTo(right, bottom - rr);
    ctx.quadraticCurveTo(right, bottom, right - rr, bottom);
    ctx.lineTo(left + rr, bottom);
    ctx.quadraticCurveTo(left, bottom, left, bottom - rr);
    ctx.lineTo(left, top + rr);
    ctx.quadraticCurveTo(left, top, left + rr, top);
    ctx.closePath();
    return;
  }

  ctx.rect(left, top, w, h);
};

const drawFrameOnCanvas = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frameWidthPx: number,
  frameColor: string,
  frameStyle: FrameStyle,
  frameShape: FrameShape,
  frameRadius: number,
) => {
  const frame = Math.max(6, Math.min(frameWidthPx, Math.round(Math.min(width, height) * 0.08)));
  const drawStroke = (inset: number, lineWidth: number, color: string, dashed = false) => {
    ctx.save();
    buildFramePath(ctx, width, height, inset, frameShape, frameRadius);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    if (dashed) ctx.setLineDash([Math.max(6, lineWidth * 1.5), Math.max(4, lineWidth * 0.9)]);
    ctx.stroke();
    ctx.restore();
  };

  switch (frameStyle) {
    case "double": {
      drawStroke(frame / 2, frame, frameColor);
      drawStroke(frame * 1.6, Math.max(2, Math.round(frame * 0.45)), "rgba(255,255,255,0.85)");
      break;
    }
    case "shadow": {
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.35)";
      ctx.shadowBlur = Math.max(10, frame * 1.1);
      drawStroke(frame / 2, frame, frameColor);
      ctx.restore();
      break;
    }
    case "neon": {
      ctx.save();
      ctx.shadowColor = frameColor;
      ctx.shadowBlur = Math.max(12, frame * 1.6);
      drawStroke(frame / 2, frame, frameColor);
      ctx.restore();
      break;
    }
    case "dashed": {
      drawStroke(frame / 2, Math.max(3, Math.round(frame * 0.75)), frameColor, true);
      break;
    }
    case "vintage": {
      drawStroke(frame / 2, frame, frameColor);
      drawStroke(frame * 1.15, Math.max(2, Math.round(frame * 0.22)), "rgba(70,45,20,0.35)");
      break;
    }
    case "inner": {
      drawStroke(frame * 1.35, Math.max(3, Math.round(frame * 0.5)), frameColor);
      break;
    }
    case "soft": {
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.18)";
      ctx.shadowBlur = Math.max(8, frame);
      drawStroke(frame / 2, frame, frameColor);
      ctx.restore();
      break;
    }
    case "film": {
      drawStroke(frame / 2, frame, "#f5f3ef");
      drawStroke(frame * 0.75, Math.max(2, Math.round(frame * 0.35)), "#111111");
      break;
    }
    case "bold": {
      drawStroke(frame * 0.45, Math.round(frame * 1.3), frameColor);
      break;
    }
    case "clean":
    default: {
      drawStroke(frame / 2, frame, frameColor);
      break;
    }
  }
};

const ToolInner = () => {
  const navigate = useNavigate();
  // Force light mode on tool pages
  useEffect(() => {
    const wasDark = document.documentElement.classList.contains("dark");
    document.documentElement.classList.remove("dark");
    return () => { if (wasDark) document.documentElement.classList.add("dark"); };
  }, []);
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
  const [filterMode, setFilterMode] = useState<"ai" | "nonai">("ai");
  const [filterOutputMode, setFilterOutputMode] = useState<"replace" | "duplicate">("replace");
  const [liveFilterCss, setLiveFilterCss] = useState("");
  const [localApplying, setLocalApplying] = useState(false);
  const [showPdfProcessor, setShowPdfProcessor] = useState(false);
  const [showLayoutDialog, setShowLayoutDialog] = useState(false);
  const [pageWidthPercent, setPageWidthPercent] = useState(92);
  const [pageHeightPercent, setPageHeightPercent] = useState(100);
  const [pageAspectRatio, setPageAspectRatio] = useState("4/3");
  const [imageScaleXPercent, setImageScaleXPercent] = useState(100);
  const [imageScaleYPercent, setImageScaleYPercent] = useState(100);
  const [lockPageAspect, setLockPageAspect] = useState(false);
  const [lockImageAspect, setLockImageAspect] = useState(false);
  const [panMode, setPanMode] = useState(false);
  const [showBeforeAfter, setShowBeforeAfter] = useState(false);
  const [beforeAfterPos, setBeforeAfterPos] = useState(50);
  const [compareViewMode, setCompareViewMode] = useState<"slider" | "side-by-side" | "new-only">("slider");
  const [frameEnabled, setFrameEnabled] = useState(false);
  const [frameWidthPx, setFrameWidthPx] = useState(22);
  const [frameColor, setFrameColor] = useState("#ffffff");
  const [frameStyle, setFrameStyle] = useState<FrameStyle>("clean");
  const [frameShape, setFrameShape] = useState<FrameShape>("rect");
  const [frameRadius, setFrameRadius] = useState(6);
  const [savedFramePresets, setSavedFramePresets] = useState<FramePresetDefinition[]>([]);
  const [imageFitMode, setImageFitMode] = useState<"contain" | "cover">("contain");
  const [layoutDialogPos, setLayoutDialogPos] = useState({ x: 120, y: 90 });
  const [customWidthCm, setCustomWidthCm] = useState("21");
  const [customHeightCm, setCustomHeightCm] = useState("29.7");
  const [sizeUnit, setSizeUnit] = useState<"cm" | "mm" | "in" | "px">("cm");
  const [sizeDpi, setSizeDpi] = useState(300);
  const [customProfileName, setCustomProfileName] = useState("");
  const [savedSizeProfiles, setSavedSizeProfiles] = useState<Array<{ id: string; name: string; widthCm: number; heightCm: number }>>([]);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSizePx, setGridSizePx] = useState(20);
  const [sourceImageMeta, setSourceImageMeta] = useState<{ width: number; height: number } | null>(null);
  const projectFileInputRef = useRef<HTMLInputElement | null>(null);
  const dragStateRef = useRef<{ dragging: boolean; startX: number; startY: number; startLeft: number; startTop: number }>({
    dragging: false,
    startX: 0,
    startY: 0,
    startLeft: 120,
    startTop: 90,
  });
  const previousUnitRef = useRef<"cm" | "mm" | "in" | "px">("cm");
  const { aiEnabled, setAiMode } = useAiMode(true);

  const layoutProfilesStorageKey = "tool-layout-size-profiles-v1";
  const layoutSessionStorageKey = "tool-layout-session-v2";
  const projectSnapshotStorageKey = "tool-project-snapshot-v1";
  const framePresetsStorageKey = "tool-frame-presets-v1";

  const convertToCm = (value: number, unit: "cm" | "mm" | "in" | "px", dpi: number) => {
    if (unit === "cm") return value;
    if (unit === "mm") return value / 10;
    if (unit === "in") return value * 2.54;
    return (value / Math.max(1, dpi)) * 2.54;
  };

  const convertFromCm = (cmValue: number, unit: "cm" | "mm" | "in" | "px", dpi: number) => {
    if (unit === "cm") return cmValue;
    if (unit === "mm") return cmValue * 10;
    if (unit === "in") return cmValue / 2.54;
    return (cmValue / 2.54) * Math.max(1, dpi);
  };

  const formatUnitValue = (value: number) => {
    const fixed = value.toFixed(2);
    return fixed.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
  };

  const pagePresets = [
    { id: "1/1", label: "ריבוע" },
    { id: "4/3", label: "קלאסי" },
    { id: "3/4", label: "פורטרט" },
    { id: "16/9", label: "רחב" },
  ];

  const professionalLayoutPresets = [
    { id: "catalog-pro", label: "קטלוג Pro", ratio: "4/3", pageW: 94, pageH: 102, imgW: 102, imgH: 102, fit: "contain" as const },
    { id: "hero-wide", label: "Hero רחב", ratio: "16/9", pageW: 100, pageH: 90, imgW: 106, imgH: 106, fit: "cover" as const },
    { id: "story-portrait", label: "Story אנכי", ratio: "3/4", pageW: 82, pageH: 116, imgW: 104, imgH: 104, fit: "contain" as const },
    { id: "social-square", label: "Social ריבוע", ratio: "1/1", pageW: 90, pageH: 100, imgW: 98, imgH: 98, fit: "contain" as const },
  ];

  const professionalFramePresets: FramePresetDefinition[] = [
    { id: "lux-gold", name: "Luxury Gold", category: "luxury", style: "double", shape: "rounded", widthPx: 28, radius: 10, color: "#d4af37" },
    { id: "royal-platinum", name: "Royal Platinum", category: "luxury", style: "bold", shape: "rounded", widthPx: 26, radius: 14, color: "#e5e7eb" },
    { id: "jewel-neon", name: "Jewel Neon", category: "luxury", style: "neon", shape: "pill", widthPx: 18, radius: 20, color: "#7df9ff" },
    { id: "minimal-clean", name: "Minimal Clean", category: "catalog", style: "clean", shape: "rect", widthPx: 14, radius: 4, color: "#ffffff" },
    { id: "catalog-soft", name: "Catalog Soft", category: "catalog", style: "soft", shape: "rounded", widthPx: 16, radius: 8, color: "#f8fafc" },
    { id: "editorial-film", name: "Editorial Film", category: "catalog", style: "film", shape: "rect", widthPx: 26, radius: 2, color: "#f5f3ef" },
    { id: "brand-dashed", name: "Brand Dashed", category: "catalog", style: "dashed", shape: "rect", widthPx: 12, radius: 6, color: "#0f172a" },
    { id: "neon-pop", name: "Neon Pop", category: "social", style: "neon", shape: "pill", widthPx: 20, radius: 22, color: "#00e5ff" },
    { id: "social-ring", name: "Social Ring", category: "social", style: "clean", shape: "circle", widthPx: 18, radius: 50, color: "#ffffff" },
    { id: "story-glow", name: "Story Glow", category: "social", style: "shadow", shape: "rounded", widthPx: 22, radius: 18, color: "#fef3c7" },
    { id: "print-safe", name: "Print Safe", category: "print", style: "inner", shape: "rect", widthPx: 24, radius: 2, color: "#111827" },
    { id: "poster-classic", name: "Poster Classic", category: "print", style: "vintage", shape: "rect", widthPx: 20, radius: 4, color: "#c8a36a" },
    { id: "gallery-shadow", name: "Gallery Shadow", category: "print", style: "shadow", shape: "rounded", widthPx: 24, radius: 12, color: "#f8f8f8" },
    { id: "vintage-card", name: "Vintage Card", category: "print", style: "vintage", shape: "diamond", widthPx: 18, radius: 8, color: "#c8a36a" },
  ];

  const printPresetsCm = [
    { id: "A4-P", label: "A4 אנכי", w: 21, h: 29.7 },
    { id: "A4-L", label: "A4 רוחבי", w: 29.7, h: 21 },
    { id: "A3-P", label: "A3 אנכי", w: 29.7, h: 42 },
    { id: "A3-L", label: "A3 רוחבי", w: 42, h: 29.7 },
    { id: "A0-P", label: "A0 אנכי", w: 84.1, h: 118.9 },
    { id: "A0-L", label: "A0 רוחבי", w: 118.9, h: 84.1 },
  ];

  const startLayoutDialogDrag = (clientX: number, clientY: number) => {
    dragStateRef.current = {
      dragging: true,
      startX: clientX,
      startY: clientY,
      startLeft: layoutDialogPos.x,
      startTop: layoutDialogPos.y,
    };
  };

  const applyCustomCmSize = () => {
    const widthRaw = Number(customWidthCm);
    const heightRaw = Number(customHeightCm);
    const widthCm = convertToCm(widthRaw, sizeUnit, sizeDpi);
    const heightCm = convertToCm(heightRaw, sizeUnit, sizeDpi);
    if (!Number.isFinite(widthCm) || !Number.isFinite(heightCm) || widthCm <= 0 || heightCm <= 0) {
      toast.error("יש להזין מידות תקינות");
      return;
    }
    setPageAspectRatio(`${widthCm}/${heightCm}`);
    toast.success(`יחס דף הוגדר לפי ${formatUnitValue(widthRaw)} x ${formatUnitValue(heightRaw)} ${sizeUnit.toUpperCase()}`);
  };

  const applySavedProfile = (profile: { id: string; name: string; widthCm: number; heightCm: number }) => {
    setPageAspectRatio(`${profile.widthCm}/${profile.heightCm}`);
    setCustomWidthCm(formatUnitValue(convertFromCm(profile.widthCm, sizeUnit, sizeDpi)));
    setCustomHeightCm(formatUnitValue(convertFromCm(profile.heightCm, sizeUnit, sizeDpi)));
    toast.success(`הפרופיל ${profile.name} הוחל`);
  };

  const saveCurrentAsProfile = () => {
    const widthRaw = Number(customWidthCm);
    const heightRaw = Number(customHeightCm);
    const widthCm = convertToCm(widthRaw, sizeUnit, sizeDpi);
    const heightCm = convertToCm(heightRaw, sizeUnit, sizeDpi);
    const name = customProfileName.trim();

    if (!name) {
      toast.error("יש להזין שם לפרופיל");
      return;
    }
    if (!Number.isFinite(widthCm) || !Number.isFinite(heightCm) || widthCm <= 0 || heightCm <= 0) {
      toast.error("לא ניתן לשמור מידות לא תקינות");
      return;
    }

    setSavedSizeProfiles((prev) => {
      const next = [
        ...prev.filter((p) => p.name !== name),
        { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name, widthCm, heightCm },
      ];
      return next.slice(-12);
    });
    setCustomProfileName("");
    toast.success("הפרופיל נשמר");
  };

  const removeSavedProfile = (profileId: string) => {
    setSavedSizeProfiles((prev) => prev.filter((profile) => profile.id !== profileId));
  };

  const applyFramePreset = (preset: FramePresetDefinition) => {
    setFrameEnabled(true);
    setFrameStyle(preset.style);
    setFrameShape(preset.shape);
    setFrameWidthPx(preset.widthPx);
    setFrameRadius(preset.radius);
    setFrameColor(preset.color);
    toast.success(`פריסט המסגרת ${preset.name} הוחל`);
  };

  const saveCurrentFramePreset = (name: string) => {
    const nextName = name.trim();
    if (!nextName) {
      toast.error("יש להזין שם לפריסט");
      return;
    }

    setSavedFramePresets((prev) => {
      const next: FramePresetDefinition[] = [
        ...prev.filter((p) => p.name !== nextName),
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: nextName,
          category: "custom",
          style: frameStyle,
          shape: frameShape,
          widthPx: frameWidthPx,
          radius: frameRadius,
          color: frameColor,
        },
      ];
      return next.slice(-20);
    });
    toast.success("פריסט המסגרת נשמר");
  };

  const removeSavedFramePreset = (presetId: string) => {
    setSavedFramePresets((prev) => prev.filter((preset) => preset.id !== presetId));
  };

  const exportSavedFramePresets = () => {
    if (savedFramePresets.length === 0) {
      toast.error("אין פריסטים אישיים לייצוא");
      return;
    }

    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      presets: savedFramePresets,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `frame-presets-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("פריסטים יוצאו לקובץ JSON");
  };

  const importSavedFramePresets = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rawText = String(reader.result || "");
        const parsed = JSON.parse(rawText) as { presets?: FramePresetDefinition[] } | FramePresetDefinition[];
        const source = Array.isArray(parsed) ? parsed : parsed.presets;
        if (!Array.isArray(source)) {
          toast.error("קובץ JSON לא תקין");
          return;
        }

        const allowedStyles: FrameStyle[] = ["clean", "double", "shadow", "neon", "dashed", "vintage", "inner", "soft", "film", "bold"];
        const allowedShapes: FrameShape[] = ["rect", "rounded", "pill", "circle", "diamond", "hexagon", "octagon"];
        const allowedCategories: FramePresetCategory[] = ["luxury", "catalog", "social", "print", "custom"];
        const hexColorRegex = /^#([0-9a-fA-F]{6})$/;

        const imported: FramePresetDefinition[] = source
          .map((item) => {
            const style = allowedStyles.includes(item?.style) ? item.style : "clean";
            const shape = allowedShapes.includes(item?.shape) ? item.shape : "rect";
            const category = allowedCategories.includes(item?.category) ? item.category : "custom";
            const widthPx = Number.isFinite(item?.widthPx) ? Math.max(4, Math.min(80, Math.round(item.widthPx))) : 22;
            const radius = Number.isFinite(item?.radius) ? Math.max(0, Math.min(50, Math.round(item.radius))) : 6;
            const color = typeof item?.color === "string" && hexColorRegex.test(item.color) ? item.color : "#ffffff";
            const name = typeof item?.name === "string" ? item.name.trim() : "";
            if (!name) return null;
            return {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              name,
              category,
              style,
              shape,
              widthPx,
              radius,
              color,
            };
          })
          .filter((item): item is FramePresetDefinition => item !== null);

        if (imported.length === 0) {
          toast.error("לא נמצאו פריסטים תקינים לייבוא");
          return;
        }

        setSavedFramePresets((prev) => {
          const merged = [...prev];
          imported.forEach((preset) => {
            const idx = merged.findIndex((existing) => existing.name === preset.name);
            if (idx >= 0) merged[idx] = preset;
            else merged.push(preset);
          });
          return merged.slice(-50);
        });

        toast.success(`יובאו ${imported.length} פריסטים`);
      } catch {
        toast.error("נכשל בפענוח קובץ הפריסטים");
      }
    };
    reader.readAsText(file);
  };

  const clearSavedFramePresets = () => {
    setSavedFramePresets([]);
    toast.success("פריסטים אישיים נוקו");
  };

  const applyProfessionalLayoutPreset = (preset: typeof professionalLayoutPresets[number]) => {
    setPageAspectRatio(preset.ratio);
    setPageWidthPercent(preset.pageW);
    setPageHeightPercent(preset.pageH);
    setImageScaleXPercent(preset.imgW);
    setImageScaleYPercent(preset.imgH);
    setImageFitMode(preset.fit);
    setLockPageAspect(false);
    setLockImageAspect(true);
    toast.success(`הפריסט ${preset.label} הוחל`);
  };

  const applySmartAutoLayout = () => {
    if (!sourceImageMeta) {
      toast.error("לא זוהה יחס תמונת מקור עדיין");
      return;
    }
    const ratio = sourceImageMeta.width / Math.max(1, sourceImageMeta.height);
    const baseCmWidth = 21;
    const baseCmHeight = Math.max(8, Math.min(40, baseCmWidth / ratio));
    setCustomWidthCm(formatUnitValue(convertFromCm(baseCmWidth, sizeUnit, sizeDpi)));
    setCustomHeightCm(formatUnitValue(convertFromCm(baseCmHeight, sizeUnit, sizeDpi)));

    if (ratio >= 1.45) {
      applyProfessionalLayoutPreset(professionalLayoutPresets[1]);
      toast.success("Smart Layout: זוהה פורמט רחב");
      return;
    }
    if (ratio <= 0.82) {
      applyProfessionalLayoutPreset(professionalLayoutPresets[2]);
      toast.success("Smart Layout: זוהה פורמט אנכי");
      return;
    }
    if (ratio >= 0.95 && ratio <= 1.05) {
      applyProfessionalLayoutPreset(professionalLayoutPresets[3]);
      toast.success("Smart Layout: זוהה פורמט ריבועי");
      return;
    }

    applyProfessionalLayoutPreset(professionalLayoutPresets[0]);
    toast.success("Smart Layout: זוהה פורמט קטלוג קלאסי");
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(layoutProfilesStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Array<{ id: string; name: string; widthCm: number; heightCm: number }>;
      if (Array.isArray(parsed)) {
        setSavedSizeProfiles(parsed.filter((item) => Number.isFinite(item.widthCm) && Number.isFinite(item.heightCm) && !!item.name));
      }
    } catch (error) {
      console.error("Failed to load layout profiles", error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(layoutProfilesStorageKey, JSON.stringify(savedSizeProfiles));
  }, [savedSizeProfiles]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(framePresetsStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as FramePresetDefinition[];
      if (!Array.isArray(parsed)) return;
      setSavedFramePresets(
        parsed.filter(
          (item) =>
            !!item?.id &&
            !!item?.name &&
            typeof item.widthPx === "number" &&
            typeof item.radius === "number" &&
            typeof item.color === "string" &&
            typeof item.style === "string" &&
            typeof item.shape === "string",
        ),
      );
    } catch (error) {
      console.error("Failed to load frame presets", error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(framePresetsStorageKey, JSON.stringify(savedFramePresets));
  }, [savedFramePresets]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(layoutSessionStorageKey);
      if (!raw) return;
      const session = JSON.parse(raw) as Partial<{
        pageWidthPercent: number;
        pageHeightPercent: number;
        pageAspectRatio: string;
        imageScaleXPercent: number;
        imageScaleYPercent: number;
        lockPageAspect: boolean;
        lockImageAspect: boolean;
        panMode: boolean;
        imageFitMode: "contain" | "cover";
        sizeUnit: "cm" | "mm" | "in" | "px";
        sizeDpi: number;
      }>;

      if (typeof session.pageWidthPercent === "number") setPageWidthPercent(session.pageWidthPercent);
      if (typeof session.pageHeightPercent === "number") setPageHeightPercent(session.pageHeightPercent);
      if (typeof session.pageAspectRatio === "string") setPageAspectRatio(session.pageAspectRatio);
      if (typeof session.imageScaleXPercent === "number") setImageScaleXPercent(session.imageScaleXPercent);
      if (typeof session.imageScaleYPercent === "number") setImageScaleYPercent(session.imageScaleYPercent);
      if (typeof session.lockPageAspect === "boolean") setLockPageAspect(session.lockPageAspect);
      if (typeof session.lockImageAspect === "boolean") setLockImageAspect(session.lockImageAspect);
      if (typeof session.panMode === "boolean") setPanMode(session.panMode);
      if (session.imageFitMode === "contain" || session.imageFitMode === "cover") setImageFitMode(session.imageFitMode);
      if (session.sizeUnit === "cm" || session.sizeUnit === "mm" || session.sizeUnit === "in" || session.sizeUnit === "px") setSizeUnit(session.sizeUnit);
      if (typeof session.sizeDpi === "number") setSizeDpi(session.sizeDpi);
    } catch (error) {
      console.error("Failed to restore layout session", error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      layoutSessionStorageKey,
      JSON.stringify({
        pageWidthPercent,
        pageHeightPercent,
        pageAspectRatio,
        imageScaleXPercent,
        imageScaleYPercent,
        lockPageAspect,
        lockImageAspect,
        panMode,
        imageFitMode,
        sizeUnit,
        sizeDpi,
      }),
    );
  }, [
    pageWidthPercent,
    pageHeightPercent,
    pageAspectRatio,
    imageScaleXPercent,
    imageScaleYPercent,
    lockPageAspect,
    lockImageAspect,
    panMode,
    imageFitMode,
    sizeUnit,
    sizeDpi,
  ]);

  useEffect(() => {
    const previousUnit = previousUnitRef.current;
    if (previousUnit === sizeUnit) return;

    const widthRaw = Number(customWidthCm);
    const heightRaw = Number(customHeightCm);
    if (Number.isFinite(widthRaw) && widthRaw > 0 && Number.isFinite(heightRaw) && heightRaw > 0) {
      const widthCm = convertToCm(widthRaw, previousUnit, sizeDpi);
      const heightCm = convertToCm(heightRaw, previousUnit, sizeDpi);
      setCustomWidthCm(formatUnitValue(convertFromCm(widthCm, sizeUnit, sizeDpi)));
      setCustomHeightCm(formatUnitValue(convertFromCm(heightCm, sizeUnit, sizeDpi)));
    }

    previousUnitRef.current = sizeUnit;
  }, [sizeUnit, sizeDpi, customWidthCm, customHeightCm]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragStateRef.current.dragging) return;
      const dx = e.clientX - dragStateRef.current.startX;
      const dy = e.clientY - dragStateRef.current.startY;
      const rawX = Math.max(8, dragStateRef.current.startLeft + dx);
      const rawY = Math.max(8, dragStateRef.current.startTop + dy);
      const nextX = snapToGrid ? Math.round(rawX / Math.max(4, gridSizePx)) * Math.max(4, gridSizePx) : rawX;
      const nextY = snapToGrid ? Math.round(rawY / Math.max(4, gridSizePx)) * Math.max(4, gridSizePx) : rawY;
      setLayoutDialogPos({
        x: nextX,
        y: nextY,
      });
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!dragStateRef.current.dragging || e.touches.length === 0) return;
      const dx = e.touches[0].clientX - dragStateRef.current.startX;
      const dy = e.touches[0].clientY - dragStateRef.current.startY;
      const rawX = Math.max(8, dragStateRef.current.startLeft + dx);
      const rawY = Math.max(8, dragStateRef.current.startTop + dy);
      const nextX = snapToGrid ? Math.round(rawX / Math.max(4, gridSizePx)) * Math.max(4, gridSizePx) : rawX;
      const nextY = snapToGrid ? Math.round(rawY / Math.max(4, gridSizePx)) * Math.max(4, gridSizePx) : rawY;
      setLayoutDialogPos({
        x: nextX,
        y: nextY,
      });
    };
    const onUp = () => {
      dragStateRef.current.dragging = false;
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [layoutDialogPos.x, layoutDialogPos.y, snapToGrid, gridSizePx]);

  const {
    originalImage, resultImage, adjustments, referenceImages,
    isProcessing, isEnhancing, isExporting,
    selectedPreset, selectedPresetName, selectedPresetType,
    customPrompt, activePrompt, suggestedName, preciseMode,
    activeTab, showMockup, showBatch, showHistory, showSocial, showShare, showDevSettings,
    multiSelectMode, selectedPresetIds, batchResults, batchProcessing, batchProgress,
    undoStack, redoStack, showComparison, comparisonImages, compareMode,
  } = state;

  useEffect(() => {
    if (!originalImage) {
      setSourceImageMeta(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      setSourceImageMeta({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      setSourceImageMeta(null);
    };
    img.src = originalImage;
  }, [originalImage]);

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

  const applyFilterResult = useCallback((nextImage: string, actionName: string) => {
    const current = resultImage || originalImage;
    if (filterOutputMode === "duplicate" && current) {
      dispatch({ type: "ADD_COMPARISON_IMAGE", payload: { image: current, label: `לפני ${actionName}` } });
      dispatch({ type: "TOGGLE_COMPARISON", payload: true });
    }
    dispatch({ type: "SET_RESULT_IMAGE", payload: nextImage });
    toast.success(filterOutputMode === "duplicate" ? `${actionName} הוחל ונשמרה גרסה קודמת` : `${actionName} הוחל`);
  }, [dispatch, filterOutputMode, originalImage, resultImage]);

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
        ctx.save();
        if (frameEnabled && frameShape !== "rect") {
          buildFramePath(ctx, finalW, finalH, 0, frameShape, frameRadius);
          ctx.clip();
        }
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

        ctx.restore();

        if (frameEnabled) {
          drawFrameOnCanvas(ctx, finalW, finalH, frameWidthPx, frameColor, frameStyle, frameShape, frameRadius);
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
    [resultImage, originalImage, adjustments, dispatch, frameEnabled, frameWidthPx, frameColor, frameStyle, frameShape, frameRadius]
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

  const saveProjectSnapshot = useCallback(() => {
    if (!originalImage) {
      toast.error("אין פרויקט פעיל לשמירה");
      return;
    }

    const snapshot = {
      version: 1,
      savedAt: new Date().toISOString(),
      tool: {
        originalImage,
        resultImage,
        adjustments,
        referenceImages,
        selectedPreset,
        selectedPresetName,
        selectedPresetType,
        customPrompt,
        activePrompt,
        suggestedName,
        preciseMode,
        activeTab,
        compareMode,
        showComparison,
        comparisonImages,
      },
      layout: {
        pageWidthPercent,
        pageHeightPercent,
        pageAspectRatio,
        imageScaleXPercent,
        imageScaleYPercent,
        lockPageAspect,
        lockImageAspect,
        panMode,
        imageFitMode,
        frameEnabled,
        frameWidthPx,
        frameColor,
        frameStyle,
        frameShape,
        frameRadius,
        sizeUnit,
        sizeDpi,
      },
    };

    localStorage.setItem(projectSnapshotStorageKey, JSON.stringify(snapshot));

    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `project-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("הפרויקט נשמר בהצלחה");
  }, [
    activePrompt,
    activeTab,
    adjustments,
    compareMode,
    comparisonImages,
    customPrompt,
    frameColor,
    frameEnabled,
    frameRadius,
    frameShape,
    frameStyle,
    frameWidthPx,
    imageFitMode,
    imageScaleXPercent,
    imageScaleYPercent,
    lockImageAspect,
    lockPageAspect,
    originalImage,
    pageAspectRatio,
    pageHeightPercent,
    pageWidthPercent,
    panMode,
    preciseMode,
    referenceImages,
    resultImage,
    selectedPreset,
    selectedPresetName,
    selectedPresetType,
    showComparison,
    sizeDpi,
    sizeUnit,
  ]);

  const applyProjectSnapshot = useCallback((snapshot: any) => {
    if (!snapshot?.tool?.originalImage) {
      toast.error("קובץ פרויקט לא תקין");
      return;
    }

    dispatch({ type: "SET_ORIGINAL_IMAGE", payload: snapshot.tool.originalImage });
    if (snapshot.tool.resultImage) dispatch({ type: "SET_RESULT_IMAGE", payload: snapshot.tool.resultImage });
    if (snapshot.tool.adjustments) dispatch({ type: "SET_ADJUSTMENTS", payload: snapshot.tool.adjustments });
    if (Array.isArray(snapshot.tool.referenceImages)) dispatch({ type: "SET_REFERENCE_IMAGES", payload: snapshot.tool.referenceImages });
    if (typeof snapshot.tool.customPrompt === "string") dispatch({ type: "SET_CUSTOM_PROMPT", payload: snapshot.tool.customPrompt });
    if (typeof snapshot.tool.activePrompt === "string") dispatch({ type: "SET_ACTIVE_PROMPT", payload: snapshot.tool.activePrompt });
    if (typeof snapshot.tool.suggestedName === "string" || snapshot.tool.suggestedName === null) dispatch({ type: "SET_SUGGESTED_NAME", payload: snapshot.tool.suggestedName });
    if (typeof snapshot.tool.preciseMode === "boolean") dispatch({ type: "SET_PRECISE_MODE", payload: snapshot.tool.preciseMode });
    if (typeof snapshot.tool.activeTab === "string") dispatch({ type: "SET_ACTIVE_TAB", payload: snapshot.tool.activeTab });
    if (typeof snapshot.tool.compareMode === "string") dispatch({ type: "SET_COMPARE_MODE", payload: snapshot.tool.compareMode });
    if (typeof snapshot.tool.showComparison === "boolean") dispatch({ type: "TOGGLE_COMPARISON", payload: snapshot.tool.showComparison });
    if (Array.isArray(snapshot.tool.comparisonImages)) {
      dispatch({ type: "CLEAR_COMPARISON" });
      snapshot.tool.comparisonImages.forEach((item: { image: string; label: string }) => {
        if (item?.image) dispatch({ type: "ADD_COMPARISON_IMAGE", payload: item });
      });
    }

    if (snapshot.layout) {
      if (typeof snapshot.layout.pageWidthPercent === "number") setPageWidthPercent(snapshot.layout.pageWidthPercent);
      if (typeof snapshot.layout.pageHeightPercent === "number") setPageHeightPercent(snapshot.layout.pageHeightPercent);
      if (typeof snapshot.layout.pageAspectRatio === "string") setPageAspectRatio(snapshot.layout.pageAspectRatio);
      if (typeof snapshot.layout.imageScaleXPercent === "number") setImageScaleXPercent(snapshot.layout.imageScaleXPercent);
      if (typeof snapshot.layout.imageScaleYPercent === "number") setImageScaleYPercent(snapshot.layout.imageScaleYPercent);
      if (typeof snapshot.layout.lockPageAspect === "boolean") setLockPageAspect(snapshot.layout.lockPageAspect);
      if (typeof snapshot.layout.lockImageAspect === "boolean") setLockImageAspect(snapshot.layout.lockImageAspect);
      if (typeof snapshot.layout.panMode === "boolean") setPanMode(snapshot.layout.panMode);
      if (snapshot.layout.imageFitMode === "contain" || snapshot.layout.imageFitMode === "cover") setImageFitMode(snapshot.layout.imageFitMode);
      if (typeof snapshot.layout.frameEnabled === "boolean") setFrameEnabled(snapshot.layout.frameEnabled);
      if (typeof snapshot.layout.frameWidthPx === "number") setFrameWidthPx(snapshot.layout.frameWidthPx);
      if (typeof snapshot.layout.frameColor === "string") setFrameColor(snapshot.layout.frameColor);
      if (snapshot.layout.frameStyle) setFrameStyle(snapshot.layout.frameStyle as FrameStyle);
      if (snapshot.layout.frameShape) setFrameShape(snapshot.layout.frameShape as FrameShape);
      if (typeof snapshot.layout.frameRadius === "number") setFrameRadius(snapshot.layout.frameRadius);
      if (snapshot.layout.sizeUnit === "cm" || snapshot.layout.sizeUnit === "mm" || snapshot.layout.sizeUnit === "in" || snapshot.layout.sizeUnit === "px") setSizeUnit(snapshot.layout.sizeUnit);
      if (typeof snapshot.layout.sizeDpi === "number") setSizeDpi(snapshot.layout.sizeDpi);
    }

    toast.success("הפרויקט נטען בהצלחה");
  }, [dispatch]);

  const loadProjectSnapshot = useCallback((file?: File) => {
    const readAndApply = (content: string) => {
      try {
        const parsed = JSON.parse(content);
        applyProjectSnapshot(parsed);
      } catch {
        toast.error("נכשל בפענוח קובץ הפרויקט");
      }
    };

    if (file) {
      const reader = new FileReader();
      reader.onload = () => readAndApply(String(reader.result || ""));
      reader.readAsText(file);
      return;
    }

    const raw = localStorage.getItem(projectSnapshotStorageKey);
    if (!raw) {
      toast.error("לא נמצא פרויקט שמור");
      return;
    }
    readAndApply(raw);
  }, [applyProjectSnapshot]);

  return (
    <div className="min-h-screen bg-background font-body" dir="rtl">
      <input
        ref={projectFileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) loadProjectSnapshot(file);
          e.currentTarget.value = "";
        }}
      />
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

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-4 sm:py-6">
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
          {/* LEFT: Sidebar — tabs + content */}
          {originalImage && (
            <div className="w-full lg:w-[340px] shrink-0 order-2 lg:order-1">
              <div className="sticky top-4 rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="flex items-center justify-between border-b border-border/70 px-3 py-2">
                  <button
                    onClick={() => setShowLayoutDialog(true)}
                    className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 font-accent text-xs text-foreground hover:border-primary/40"
                    title="הגדרות גודל דף"
                  >
                    <Ruler className="h-3.5 w-3.5" />
                    גודל דף
                  </button>
                  <button
                    onClick={() => {
                      setPageWidthPercent(96);
                      setPageHeightPercent(100);
                      setImageScaleXPercent(100);
                      setImageScaleYPercent(100);
                      setImageFitMode("contain");
                    }}
                    className="rounded-lg border border-border bg-background px-3 py-1.5 font-accent text-xs text-muted-foreground hover:text-foreground"
                    title="תצוגה מהירה של גוף הדף"
                  >
                    תצוגה מהירה
                  </button>
                </div>
                {/* Tab grid — scrollable on mobile, fixed 3-col on desktop */}
                <div className="overflow-x-auto scrollbar-none border-b border-border">
                  <div className="grid grid-cols-9 min-w-[540px] gap-px bg-border/50">
                  {[
                    { key: "backgrounds" as const, label: "רקע", icon: <ImageIcon className="h-5 w-5" /> },
                    { key: "smart" as const, label: "AI", icon: <Brain className="h-5 w-5" /> },
                    { key: "nonai" as const, label: "ללא AI", icon: <Wrench className="h-5 w-5" /> },
                    { key: "filters" as const, label: "פילטר", icon: <SlidersHorizontal className="h-5 w-5" /> },
                    { key: "advanced" as const, label: "פרו", icon: <Settings2 className="h-5 w-5" /> },
                    { key: "crop" as const, label: "חיתוך", icon: <Crop className="h-5 w-5" /> },
                    { key: "tools" as const, label: "כלים", icon: <Wand2 className="h-5 w-5" /> },
                    { key: "adjust" as const, label: "התאמה", icon: <Sun className="h-5 w-5" /> },
                    { key: "export" as const, label: "יצוא", icon: <Download className="h-5 w-5" /> },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => dispatch({ type: "SET_ACTIVE_TAB", payload: tab.key })}
                      className={`flex flex-col items-center justify-center gap-1 px-1 py-2.5 font-body text-[12px] font-extrabold leading-none transition-all ${
                        activeTab === tab.key
                          ? "bg-primary/10 text-primary border-b-2 border-primary"
                          : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      <span className={activeTab === tab.key ? "text-primary" : "text-primary/60"}>{tab.icon}</span>
                      <span>{tab.label}</span>
                    </button>
                  ))}
                  </div>
                </div>

                <div className="p-3 sm:p-4 max-h-[calc(100vh-200px)] overflow-y-auto">
                  {/* Tooltip Help Button */}
                  <div className="flex justify-end mb-2">
                    <TooltipHelpButton page={activeTab} />
                  </div>

                  {activeTab === "backgrounds" && (
                    <div className="space-y-6">
                      <SmartRemoveBgPanel
                        currentImage={resultImage || originalImage}
                        onResult={(img) => {
                          if (originalImage) dispatch({ type: "ADD_COMPARISON_IMAGE", payload: { image: originalImage, label: "לפני הסרת רקע" } });
                          dispatch({ type: "SET_RESULT_IMAGE", payload: img });
                        }}
                      />
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
                    </div>
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
                      <div className="rounded-xl border border-border bg-muted/25 p-2">
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setFilterMode("ai")}
                            className={`rounded-lg px-3 py-2 text-xs font-bold ${filterMode === "ai" ? "bg-primary text-primary-foreground" : "border border-border bg-background text-muted-foreground"}`}
                          >
                            פילטרים עם AI
                          </button>
                          <button
                            onClick={() => setFilterMode("nonai")}
                            className={`rounded-lg px-3 py-2 text-xs font-bold ${filterMode === "nonai" ? "bg-primary text-primary-foreground" : "border border-border bg-background text-muted-foreground"}`}
                          >
                            פילטרים ללא AI
                          </button>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setFilterOutputMode("replace")}
                            className={`rounded-lg px-3 py-2 text-xs font-bold ${filterOutputMode === "replace" ? "border border-primary bg-primary/10 text-primary" : "border border-border bg-background text-muted-foreground"}`}
                          >
                            החלף תוצאה
                          </button>
                          <button
                            onClick={() => setFilterOutputMode("duplicate")}
                            className={`rounded-lg px-3 py-2 text-xs font-bold ${filterOutputMode === "duplicate" ? "border border-primary bg-primary/10 text-primary" : "border border-border bg-background text-muted-foreground"}`}
                          >
                            שכפל ושמור מקור
                          </button>
                        </div>
                      </div>

                      {filterMode === "nonai" && (
                        <div className="rounded-xl border border-border bg-card p-3">
                          <NonAiLabPanel
                            currentImage={resultImage || originalImage}
                            onResult={(img) => applyFilterResult(img, "פילטר ללא AI")}
                          />
                        </div>
                      )}

                      {filterMode === "ai" && (
                        <>
                          <LiveHistogram
                            imageSrc={resultImage || originalImage}
                            liveFilterCss={liveFilterCss}
                          />

                          <LiveFilterPanel
                            currentImage={resultImage || originalImage}
                            onPreviewFilter={(css) => setLiveFilterCss(css)}
                            onApply={async (filters) => {
                              setFilterProcessing(true);
                              const currentImg = resultImage || originalImage;
                              const cached = currentImg ? getCachedResult(currentImg, "live-filter-apply", filters as unknown as Record<string, unknown>) : null;
                              if (cached) {
                                applyFilterResult(cached, "פילטר AI");
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
                                  applyFilterResult(data.resultImage, "פילטר AI");
                                  if (currentImg) setCachedResult(currentImg, "live-filter-apply", filters as unknown as Record<string, unknown>, data.resultImage);
                                  setLiveFilterCss("");
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
                                    applyFilterResult(data.resultImage, "שכבות פילטר");
                                    setLiveFilterCss("");
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
                                    applyFilterResult(data.resultImage, "העברת פלטה");
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
                              onApply={async (region, filterType, intensity, maskDataUrl) => {
                                setFilterProcessing(true);
                                const currentImg = resultImage || originalImage;
                                const params: Record<string, any> = { region, filterType, intensity };
                                if (region === "custom" && maskDataUrl) {
                                  params.maskImage = maskDataUrl;
                                }
                                const cached = currentImg ? getCachedResult(currentImg, "regional-mask", params) : null;
                                if (cached) {
                                  applyFilterResult(cached, "פילטר אזורי");
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
                                    applyFilterResult(data.resultImage, region === "custom" ? "פילטר אזורי מותאם" : "פילטר אזורי");
                                    if (currentImg) setCachedResult(currentImg, "regional-mask", params, data.resultImage);
                                  }
                                } catch (err: any) {
                                  toast.error(err.message || "שגיאה בעיבוד");
                                } finally {
                                  setFilterProcessing(false);
                                }
                              }}
                              isProcessing={filterProcessing}
                            />
                          </div>
                        </>
                      )}
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
                    <div className="space-y-4">
                      <ImageAdjustmentsPanel
                        adjustments={adjustments}
                        onChange={(a) => dispatch({ type: "SET_ADJUSTMENTS", payload: a })}
                        onReset={() => dispatch({ type: "RESET_ADJUSTMENTS" })}
                        onApplyLocal={handleApplyLocal}
                        isApplying={localApplying}
                      />
                      <FrameStylePanel
                        frameEnabled={frameEnabled}
                        onToggleEnabled={setFrameEnabled}
                        frameStyle={frameStyle}
                        onFrameStyleChange={setFrameStyle}
                        frameShape={frameShape}
                        onFrameShapeChange={setFrameShape}
                        frameWidthPx={frameWidthPx}
                        onFrameWidthChange={setFrameWidthPx}
                        frameRadius={frameRadius}
                        onFrameRadiusChange={setFrameRadius}
                        frameColor={frameColor}
                        onFrameColorChange={setFrameColor}
                        professionalPresets={professionalFramePresets}
                        savedPresets={savedFramePresets}
                        onApplyPreset={applyFramePreset}
                        onSaveCurrentPreset={saveCurrentFramePreset}
                        onDeleteSavedPreset={removeSavedFramePreset}
                        onExportSavedPresets={exportSavedFramePresets}
                        onImportSavedPresets={importSavedFramePresets}
                        onClearSavedPresets={clearSavedFramePresets}
                      />
                    </div>
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

          {/* RIGHT: Canvas + Action Toolbar */}
          <div className="flex-1 order-1 lg:order-2 space-y-4">
            {originalImage ? (
              <>
                <div className="relative">
                  <div className="absolute -left-14 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-2 rounded-xl border border-border/70 bg-background/85 p-2 shadow-lg backdrop-blur-sm md:flex">
                    <button
                      onClick={() => setShowLayoutDialog(true)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background/90 text-muted-foreground shadow hover:text-foreground"
                      title="בקרת דף מהירה"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        const next = !(lockPageAspect && lockImageAspect);
                        setLockPageAspect(next);
                        setLockImageAspect(next);
                      }}
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-background/90 shadow ${lockPageAspect && lockImageAspect ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                      title={lockPageAspect && lockImageAspect ? "כיבוי נעילת יחס" : "הפעלת נעילת יחס"}
                    >
                      {lockPageAspect && lockImageAspect ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => setPanMode((v) => !v)}
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-background/90 shadow ${panMode ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                      title={panMode ? "מצב יד פעיל" : "הפעלת מצב יד"}
                    >
                      <Hand className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => dispatch({ type: "RESET_IMAGE" })}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background/90 text-muted-foreground shadow hover:text-foreground"
                      title="הוספת תמונה"
                    >
                      <UploadIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => dispatch({ type: "SET_ACTIVE_TAB", payload: "crop" })}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background/90 text-muted-foreground shadow hover:text-foreground"
                      title="מצב חיתוך"
                    >
                      <Crop className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        setFrameEnabled(true);
                        dispatch({ type: "SET_ACTIVE_TAB", payload: "adjust" });
                      }}
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-background/90 shadow ${frameEnabled ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                      title={frameEnabled ? "עריכת מסגרת" : "הוספת מסגרת"}
                    >
                      <Frame className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => openWorkspaceWithSelectedImage("/collage")}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background/90 text-muted-foreground shadow hover:text-foreground"
                      title="קולאז'ים מוכנים"
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => dispatch({ type: "SET_ACTIVE_TAB", payload: "backgrounds" })}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background/90 text-muted-foreground shadow hover:text-foreground"
                      title="שינוי רקע"
                    >
                      <Sparkles className="h-4 w-4" />
                    </button>
                  </div>
                  {/* Mobile quick-access toolbar — visible only on small screens */}
                  <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1 md:hidden">
                    {[
                      { icon: <Eye className="h-4 w-4" />, title: "תצוגה", onClick: () => setShowLayoutDialog(true) },
                      { icon: <UploadIcon className="h-4 w-4" />, title: "תמונה חדשה", onClick: () => dispatch({ type: "RESET_IMAGE" }) },
                      { icon: <Crop className="h-4 w-4" />, title: "חיתוך", onClick: () => dispatch({ type: "SET_ACTIVE_TAB", payload: "crop" }) },
                      { icon: <Frame className="h-4 w-4" />, title: "מסגרת", onClick: () => { setFrameEnabled(true); dispatch({ type: "SET_ACTIVE_TAB", payload: "adjust" }); } },
                      { icon: <LayoutGrid className="h-4 w-4" />, title: "קולאז׳", onClick: () => openWorkspaceWithSelectedImage("/collage") },
                      { icon: <Sparkles className="h-4 w-4" />, title: "רקע", onClick: () => dispatch({ type: "SET_ACTIVE_TAB", payload: "backgrounds" }) },
                    ].map((btn, i) => (
                      <button
                        key={i}
                        onClick={btn.onClick}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground shadow hover:text-foreground"
                        title={btn.title}
                      >
                        {btn.icon}
                      </button>
                    ))}
                  </div>
                  {showBeforeAfter && originalImage && resultImage ? (
                    compareViewMode === "new-only" ? (
                      <div className="relative w-full overflow-hidden rounded-xl border border-border bg-muted" style={{ aspectRatio: "4/3" }}>
                        <img src={resultImage} alt="תוצאה" className="h-full w-full object-contain" />
                        <span className="absolute top-2 right-2 rounded-md bg-primary/90 px-2 py-0.5 text-[11px] font-bold text-primary-foreground">אחרי</span>
                      </div>
                    ) : compareViewMode === "side-by-side" ? (
                      <div className="flex gap-2 w-full">
                        <div className="relative flex-1 overflow-hidden rounded-xl border border-border bg-muted" style={{ aspectRatio: "4/3" }}>
                          <img src={originalImage} alt="לפני" className="h-full w-full object-contain" />
                          <span className="absolute top-2 right-2 rounded-md bg-muted-foreground/70 px-2 py-0.5 text-[11px] font-bold text-white">לפני</span>
                        </div>
                        <div className="relative flex-1 overflow-hidden rounded-xl border border-primary/30 bg-muted" style={{ aspectRatio: "4/3" }}>
                          <img src={resultImage} alt="אחרי" className="h-full w-full object-contain" />
                          <span className="absolute top-2 right-2 rounded-md bg-primary/90 px-2 py-0.5 text-[11px] font-bold text-primary-foreground">אחרי</span>
                        </div>
                      </div>
                    ) : (
                    <div
                      className="relative w-full overflow-hidden rounded-xl border border-border bg-muted select-none touch-none"
                      style={{ aspectRatio: "4/3" }}
                      onMouseMove={(e) => {
                        if (e.buttons === 1) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setBeforeAfterPos(Math.min(98, Math.max(2, ((e.clientX - rect.left) / rect.width) * 100)));
                        }
                      }}
                      onTouchMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setBeforeAfterPos(Math.min(98, Math.max(2, ((e.touches[0].clientX - rect.left) / rect.width) * 100)));
                      }}
                    >
                      {/* After (full) */}
                      <img src={resultImage} alt="אחרי" className="absolute inset-0 h-full w-full object-contain" />
                      {/* Before (clipped) */}
                      <div
                        className="absolute inset-0 overflow-hidden"
                        style={{ clipPath: `inset(0 ${100 - beforeAfterPos}% 0 0)` }}
                      >
                        <img src={originalImage} alt="לפני" className="h-full w-full object-contain" />
                      </div>
                      {/* Divider line */}
                      <div
                        className="absolute top-0 bottom-0 z-20 w-0.5 bg-white shadow-lg pointer-events-none"
                        style={{ left: `${beforeAfterPos}%`, transform: "translateX(-50%)" }}
                      >
                        <div className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-primary shadow-xl cursor-ew-resize pointer-events-auto"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            const container = e.currentTarget.closest('[style*="aspect-ratio"]') as HTMLElement;
                            if (!container) return;
                            const onMove = (mv: MouseEvent) => {
                              const rect = container.getBoundingClientRect();
                              setBeforeAfterPos(Math.min(98, Math.max(2, ((mv.clientX - rect.left) / rect.width) * 100)));
                            };
                            const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
                            window.addEventListener("mousemove", onMove);
                            window.addEventListener("mouseup", onUp);
                          }}
                          onTouchStart={(e) => {
                            const container = e.currentTarget.closest('[style*="aspect-ratio"]') as HTMLElement;
                            if (!container) return;
                            const onMove = (tv: TouchEvent) => {
                              const rect = container.getBoundingClientRect();
                              setBeforeAfterPos(Math.min(98, Math.max(2, ((tv.touches[0].clientX - rect.left) / rect.width) * 100)));
                            };
                            const onEnd = () => { window.removeEventListener("touchmove", onMove); window.removeEventListener("touchend", onEnd); };
                            window.addEventListener("touchmove", onMove, { passive: false });
                            window.addEventListener("touchend", onEnd);
                          }}
                        >
                          <Move className="h-4 w-4 text-primary-foreground" />
                        </div>
                      </div>
                      {/* Labels */}
                      <span className="absolute top-2 left-3 rounded-md bg-muted-foreground/70 px-2 py-0.5 text-[11px] font-bold text-white">לפני</span>
                      <span className="absolute top-2 right-3 rounded-md bg-primary/90 px-2 py-0.5 text-[11px] font-bold text-primary-foreground">אחרי</span>
                    </div>
                    )
                  ) : (
                  <ImageCanvas
                    originalImage={originalImage}
                    resultImage={resultImage}
                    isProcessing={isProcessing || isEnhancing}
                    adjustments={adjustments}
                    liveFilterCss={liveFilterCss}
                    pageWidthPercent={pageWidthPercent}
                    pageHeightPercent={pageHeightPercent}
                    pageAspectRatio={pageAspectRatio}
                    imageScaleXPercent={imageScaleXPercent}
                    imageScaleYPercent={imageScaleYPercent}
                    imageFitMode={imageFitMode}
                    lockPageAspect={lockPageAspect}
                    lockImageAspect={lockImageAspect}
                    panMode={panMode}
                    frameEnabled={frameEnabled}
                    frameWidthPx={frameWidthPx}
                    frameColor={frameColor}
                    frameStyle={frameStyle}
                    frameShape={frameShape}
                    frameRadius={frameRadius}
                    onPageWidthChange={setPageWidthPercent}
                    onPageHeightChange={setPageHeightPercent}
                    onImageScaleXChange={setImageScaleXPercent}
                    onImageScaleYChange={setImageScaleYPercent}
                  />
                  )}
                  <FloatingSaveAction
                    visible={!!originalImage && hasUnsavedChanges && !!user}
                    onSaveNew={handleFloatingSaveNew}
                    onReplace={handleFloatingReplace}
                    isSaving={isSaving || localApplying}
                  />
                </div>

                {/* Compact Action Toolbar */}
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2.5 shadow-sm">
                  {/* Undo/Redo */}
                  <div className="flex items-center gap-0.5 rounded-lg border border-border">
                    <button onClick={() => dispatch({ type: "UNDO" })} disabled={undoStack.length === 0} className="flex h-9 w-9 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30" title="בטל">
                      <Undo2 className="h-4 w-4" />
                    </button>
                    <div className="h-5 w-px bg-border" />
                    <button onClick={() => dispatch({ type: "REDO" })} disabled={redoStack.length === 0} className="flex h-9 w-9 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30" title="בצע שוב">
                      <Redo2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="h-6 w-px bg-border mx-1" />

                  <button
                    onClick={saveProjectSnapshot}
                    className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs text-foreground hover:border-primary/40"
                    title="שמירת פרויקט"
                  >
                    <FolderPlus className="h-3.5 w-3.5" />
                    שמור פרויקט
                  </button>

                  <button
                    onClick={() => loadProjectSnapshot()}
                    className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs text-foreground hover:border-primary/40"
                    title="טעינת פרויקט שמור"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    טען אחרון
                  </button>

                  <button
                    onClick={() => projectFileInputRef.current?.click()}
                    className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs text-foreground hover:border-primary/40"
                    title="טעינה מקובץ"
                  >
                    <Download className="h-3.5 w-3.5" />
                    ייבוא קובץ
                  </button>

                  <div className="h-6 w-px bg-border mx-1" />

                  {/* Primary: Replace BG */}
                  {!multiSelectMode ? (
                    <button
                      onClick={handleProcess}
                      disabled={!aiEnabled || isProcessing || (!activePrompt && !customPrompt.trim())}
                      className={`flex items-center gap-2 rounded-lg px-4 py-2 font-display text-sm font-bold transition-all hover:brightness-110 disabled:opacity-50 ${
                        selectedPresetType === "scene"
                          ? "bg-gradient-to-l from-emerald-500 to-teal-600 text-white"
                          : preciseMode
                            ? "bg-gradient-to-l from-amber-500 to-accent text-white"
                            : "bg-accent text-accent-foreground"
                      }`}
                    >
                      <Sparkles className="h-4 w-4" />
                      {isProcessing ? "מעבד..." : "החלף רקע"}
                    </button>
                  ) : (
                    <button
                      onClick={handleMultiProcess}
                      disabled={!aiEnabled || batchProcessing || selectedPresetIds.length === 0}
                      className="flex items-center gap-2 rounded-lg bg-gradient-to-l from-accent to-primary px-4 py-2 font-display text-sm font-bold text-primary-foreground hover:brightness-110 disabled:opacity-50"
                    >
                      <Layers className="h-4 w-4" />
                      {batchProcessing ? `${batchProgress.current}/${batchProgress.total}` : `${selectedPresetIds.length} רקעים`}
                    </button>
                  )}

                  <button
                    onClick={handleEnhance}
                    disabled={!aiEnabled || isEnhancing || isProcessing}
                    className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-display text-sm font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50"
                  >
                    <Wand2 className="h-4 w-4" />
                    {isEnhancing ? "משפר..." : "שפר"}
                  </button>

                  <div className="h-6 w-px bg-border mx-1" />

                  {/* Toggle buttons — compact */}
                  <button
                    onClick={() => dispatch({ type: "SET_MULTI_SELECT_MODE", payload: !multiSelectMode })}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all ${multiSelectMode ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-foreground"}`}
                    title="בחירה מרובה"
                  >
                    <Layers className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => dispatch({ type: "SET_PRECISE_MODE", payload: !preciseMode })}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all ${preciseMode ? "bg-amber-500 text-white" : "border border-border text-muted-foreground hover:text-foreground"}`}
                    title="מצב מדויק"
                  >
                    <FlaskConical className="h-4 w-4" />
                  </button>

                  {resultImage && originalImage && (
                    <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
                      <button
                        onClick={() => { setShowBeforeAfter(true); setBeforeAfterPos(50); setCompareViewMode("slider"); }}
                        className={`flex h-8 items-center gap-1 rounded-md px-2 text-xs font-bold transition-all ${showBeforeAfter && compareViewMode === "slider" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
                        title="השוואה עם וילון"
                      >
                        <GitCompare className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => { setShowBeforeAfter(true); setCompareViewMode("side-by-side"); }}
                        className={`flex h-8 items-center gap-1 rounded-md px-2 text-xs font-bold transition-all ${showBeforeAfter && compareViewMode === "side-by-side" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
                        title="צד בצד"
                      >
                        <LayoutGrid className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => { setShowBeforeAfter(true); setCompareViewMode("new-only"); }}
                        className={`flex h-8 items-center gap-1 rounded-md px-2 text-xs font-bold transition-all ${showBeforeAfter && compareViewMode === "new-only" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
                        title="רק חדשה"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      {showBeforeAfter && (
                        <button
                          onClick={() => { setShowBeforeAfter(false); }}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"
                          title="סגור השוואה"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}

                  {resultImage && (
                    <>
                      <div className="h-6 w-px bg-border mx-1" />
                      <button onClick={() => dispatch({ type: "TOGGLE_MODAL", payload: { modal: "mockup", value: true } })} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground" title="מוקאפ">
                        <Frame className="h-4 w-4" />
                      </button>
                      <button onClick={() => dispatch({ type: "TOGGLE_MODAL", payload: { modal: "social", value: true } })} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground" title="תבניות">
                        <Share2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => dispatch({ type: "TOGGLE_MODAL", payload: { modal: "share", value: true } })} className="flex h-9 w-9 items-center justify-center rounded-lg border border-gold/40 text-gold hover:bg-gold/10" title="שתף + QR">
                        <Share2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => { dispatch({ type: "ADD_COMPARISON_IMAGE", payload: { image: resultImage, label: suggestedName || selectedPresetName || "גרסה" } }); dispatch({ type: "TOGGLE_COMPARISON", payload: true }); }}
                        className="flex h-9 items-center gap-1 rounded-lg border border-border px-2 text-muted-foreground hover:text-foreground"
                        title="השוואה"
                      >
                        <GitCompare className="h-4 w-4" />
                        {comparisonImages.length > 0 && <span className="rounded-full bg-primary/10 px-1 text-[10px] font-bold text-primary">{comparisonImages.length}</span>}
                      </button>
                      {user && (
                        <button
                          onClick={() => { setSaveNewName(suggestedName || ""); setShowSaveDialog(true); }}
                          className="flex items-center gap-1.5 rounded-lg bg-gold px-3 py-2 font-display text-xs font-bold text-gold-foreground hover:brightness-110"
                        >
                          <Save className="h-3.5 w-3.5" />
                          שמור
                        </button>
                      )}
                    </>
                  )}

                  <button onClick={() => dispatch({ type: "TOGGLE_MODAL", payload: { modal: "batch", value: true } })} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground" title="עיבוד מרובה">
                    <Layers className="h-4 w-4" />
                  </button>

                  <button onClick={() => dispatch({ type: "RESET_IMAGE" })} className="flex items-center gap-1 font-body text-xs text-muted-foreground hover:text-foreground mr-auto">
                    <UploadIcon className="h-3.5 w-3.5" />
                    חדש
                  </button>
                </div>

                {/* Suggested name */}
                {suggestedName && resultImage && (
                  <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
                    <Tag className="h-4 w-4 text-primary" />
                    <div className="flex flex-col flex-1">
                      <span className="font-body text-xs text-muted-foreground">שם מקצועי מוצע:</span>
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

                {/* Recent results */}
                {user && (
                  <ResultsStrip
                    onSelectImage={(url) => dispatch({ type: "SET_RESULT_IMAGE", payload: url })}
                    currentResultUrl={resultImage}
                  />
                )}

                {/* Batch results */}
                {batchResults.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-sm font-bold text-foreground">תוצאות — {batchResults.length} רקעים</h3>
                      <div className="flex items-center gap-2">
                        <button onClick={() => downloadImagesAsZip(batchResults).then(() => toast.success("ZIP הורד!")).catch(() => toast.error("שגיאה"))} className="font-accent text-xs text-primary hover:text-primary/80 font-semibold">הורד ZIP</button>
                        <button onClick={() => dispatch({ type: "SET_BATCH_RESULTS", payload: [] })} className="font-accent text-xs text-muted-foreground hover:text-foreground">נקה</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {batchResults.map((r, i) => (
                        <div key={i} className="group relative rounded-xl border border-border overflow-hidden bg-card cursor-pointer hover:border-gold/50 hover:shadow-md transition-all" onClick={() => dispatch({ type: "SET_RESULT_IMAGE", payload: r.image })}>
                          <div className="aspect-square overflow-hidden">
                            <img src={r.image} alt={r.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                          </div>
                          <div className="p-2 text-center"><p className="font-display text-xs font-semibold text-foreground truncate">{r.name}</p></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col gap-4">
                <ImageUploader onImageSelect={handleImageSelect} />
                <div className="flex items-center justify-center">
                  <button onClick={() => setShowPdfProcessor(true)} className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 font-accent text-sm font-semibold text-foreground hover:bg-secondary hover:border-primary">
                    <FileText className="h-4 w-4 text-primary" />
                    העלאת קובץ PDF
                  </button>
                </div>
                {showPdfProcessor && (
                  <Suspense fallback={<LazyFallback />}>
                    <PdfProcessor onSelectPage={(dataUrl) => { handleImageSelect(dataUrl); setShowPdfProcessor(false); }} onClose={() => setShowPdfProcessor(false)} backgroundPrompt={customPrompt.trim() || activePrompt} />
                  </Suspense>
                )}
              </div>
            )}
          </div>
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

        <Dialog open={showLayoutDialog} onOpenChange={setShowLayoutDialog} modal={false}>
          <DialogPortal>
            <DialogOverlay className="bg-transparent pointer-events-none" />
            <div
              className="fixed z-50 w-[min(95vw,700px)] max-h-[86vh] overflow-x-auto overflow-y-auto rounded-lg border border-border bg-background p-4 shadow-2xl"
              style={{ left: layoutDialogPos.x, top: layoutDialogPos.y }}
              dir="rtl"
            >
              <div
                className="mb-3 flex cursor-move items-center justify-between border-b border-border pb-2"
                onMouseDown={(e) => startLayoutDialogDrag(e.clientX, e.clientY)}
                onTouchStart={(e) => startLayoutDialogDrag(e.touches[0].clientX, e.touches[0].clientY)}
              >
                <DialogTitle className="flex items-center gap-2 font-display text-base font-bold">
                  <Move className="h-4 w-4 text-muted-foreground" />
                  <Ruler className="h-4 w-4 text-primary" />
                  מערכת גודל דף ותמונה
                </DialogTitle>
                <DialogClose asChild>
                  <button className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" title="סגירה">
                    <X className="h-4 w-4" />
                  </button>
                </DialogClose>
              </div>

              <div className="min-w-[640px] space-y-4">
              <div className="space-y-2">
                <p className="font-body text-xs text-muted-foreground">תבנית דף</p>
                <div className="grid grid-cols-4 gap-2">
                  {pagePresets.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => setPageAspectRatio(preset.id)}
                      className={`rounded-lg border px-2 py-2 font-accent text-xs ${pageAspectRatio === preset.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-display text-xs font-bold text-foreground">Smart Auto Layout</p>
                    <p className="font-body text-[11px] text-muted-foreground">
                      {sourceImageMeta ? `יחס מקור: ${sourceImageMeta.width}x${sourceImageMeta.height}` : "ממתין לניתוח תמונת מקור"}
                    </p>
                  </div>
                  <button
                    onClick={applySmartAutoLayout}
                    disabled={!sourceImageMeta}
                    className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    ניתוח אוטומטי
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="font-body text-xs text-muted-foreground">פריסטים מקצועיים</p>
                <div className="grid grid-cols-2 gap-2">
                  {professionalLayoutPresets.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => applyProfessionalLayoutPreset(preset)}
                      className="rounded-lg border border-border px-2 py-2 text-xs text-foreground hover:border-primary/50"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="font-body text-xs text-muted-foreground">מידות הדפסה (A-series)</p>
                <div className="grid grid-cols-3 gap-2">
                  {printPresetsCm.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => {
                        setPageAspectRatio(`${preset.w}/${preset.h}`);
                        setCustomWidthCm(formatUnitValue(convertFromCm(preset.w, sizeUnit, sizeDpi)));
                        setCustomHeightCm(formatUnitValue(convertFromCm(preset.h, sizeUnit, sizeDpi)));
                      }}
                      className="rounded-lg border border-border px-2 py-2 font-accent text-xs text-foreground hover:border-primary/50"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-body text-xs text-muted-foreground">יחידות עבודה</p>
                  <div className="flex items-center gap-1 rounded-md border border-border p-1 text-xs">
                    {(["cm", "mm", "in", "px"] as const).map((unit) => (
                      <button
                        key={unit}
                        onClick={() => setSizeUnit(unit)}
                        className={`rounded px-2 py-1 ${sizeUnit === unit ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        {unit.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                {sizeUnit === "px" && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">DPI</span>
                    <input
                      type="number"
                      min={72}
                      max={600}
                      step={1}
                      value={sizeDpi}
                      onChange={(e) => setSizeDpi(Math.min(600, Math.max(72, Number(e.target.value) || 300)))}
                      className="w-24 rounded-lg border border-border bg-background px-2 py-1 text-sm"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="font-body text-xs text-muted-foreground">הזנת מידות ידנית ({sizeUnit.toUpperCase()})</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    step="0.1"
                    value={customWidthCm}
                    onChange={(e) => setCustomWidthCm(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    placeholder={`רוחב ${sizeUnit.toUpperCase()}`}
                  />
                  <span className="text-xs text-muted-foreground">X</span>
                  <input
                    type="number"
                    min={1}
                    step="0.1"
                    value={customHeightCm}
                    onChange={(e) => setCustomHeightCm(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    placeholder={`גובה ${sizeUnit.toUpperCase()}`}
                  />
                  <button
                    onClick={applyCustomCmSize}
                    className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                  >
                    החל
                  </button>
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-border/70 bg-card/40 p-3">
                <p className="font-body text-xs text-muted-foreground">פרופילים מותאמים</p>
                <div className="flex items-center gap-2">
                  <input
                    value={customProfileName}
                    onChange={(e) => setCustomProfileName(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    placeholder="שם לפרופיל"
                  />
                  <button
                    onClick={saveCurrentAsProfile}
                    className="shrink-0 rounded-lg border border-primary/40 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10"
                  >
                    שמירה
                  </button>
                </div>
                {savedSizeProfiles.length > 0 && (
                  <div className="max-h-32 space-y-1 overflow-y-auto">
                    {savedSizeProfiles.map((profile) => (
                      <div key={profile.id} className="flex items-center gap-2 rounded-md border border-border/70 px-2 py-1">
                        <button
                          onClick={() => applySavedProfile(profile)}
                          className="flex-1 truncate text-right text-xs text-foreground hover:text-primary"
                          title={`${profile.name}: ${formatUnitValue(convertFromCm(profile.widthCm, sizeUnit, sizeDpi))} x ${formatUnitValue(convertFromCm(profile.heightCm, sizeUnit, sizeDpi))} ${sizeUnit.toUpperCase()}`}
                        >
                          {profile.name}
                        </button>
                        <button
                          onClick={() => removeSavedProfile(profile.id)}
                          className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
                          title="מחיקה"
                        >
                          מחק
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2 rounded-lg border border-border/70 bg-card/40 p-3">
                <div className="flex items-center justify-between">
                  <p className="font-body text-xs text-muted-foreground">גרירה חכמה</p>
                  <div className="flex items-center gap-2">
                    <Switch checked={snapToGrid} onCheckedChange={setSnapToGrid} />
                    <span className="text-xs text-muted-foreground">Snap לגריד</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">גודל גריד (px)</span>
                  <input
                    type="number"
                    min={4}
                    max={80}
                    step={2}
                    value={gridSizePx}
                    onChange={(e) => setGridSizePx(Math.min(80, Math.max(4, Number(e.target.value) || 20)))}
                    className="w-24 rounded-lg border border-border bg-background px-2 py-1 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span>רוחב דף</span>
                  <span>{Math.round(pageWidthPercent)}%</span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={100}
                  value={pageWidthPercent}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    if (lockPageAspect) {
                      const ratio = pageHeightPercent / Math.max(1, pageWidthPercent);
                      setPageHeightPercent(Math.max(50, Math.min(140, next * ratio)));
                    }
                    setPageWidthPercent(next);
                  }}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span>גובה דף</span>
                  <span>{Math.round(pageHeightPercent)}%</span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={140}
                  value={pageHeightPercent}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    if (lockPageAspect) {
                      const ratio = pageWidthPercent / Math.max(1, pageHeightPercent);
                      setPageWidthPercent(Math.max(50, Math.min(120, next * ratio)));
                    }
                    setPageHeightPercent(next);
                  }}
                  className="w-full"
                />
              </div>

              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <span className="text-xs text-muted-foreground">נעילת יחס דף</span>
                <Switch checked={lockPageAspect} onCheckedChange={setLockPageAspect} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span>רוחב תמונה</span>
                  <span>{Math.round(imageScaleXPercent)}%</span>
                </div>
                <input
                  type="range"
                  min={60}
                  max={190}
                  value={imageScaleXPercent}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    if (lockImageAspect) {
                      const ratio = imageScaleYPercent / Math.max(1, imageScaleXPercent);
                      setImageScaleYPercent(Math.max(60, Math.min(190, next * ratio)));
                    }
                    setImageScaleXPercent(next);
                  }}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span>גובה תמונה</span>
                  <span>{Math.round(imageScaleYPercent)}%</span>
                </div>
                <input
                  type="range"
                  min={60}
                  max={190}
                  value={imageScaleYPercent}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    if (lockImageAspect) {
                      const ratio = imageScaleXPercent / Math.max(1, imageScaleYPercent);
                      setImageScaleXPercent(Math.max(60, Math.min(190, next * ratio)));
                    }
                    setImageScaleYPercent(next);
                  }}
                  className="w-full"
                />
              </div>

              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <span className="text-xs text-muted-foreground">נעילת יחס תמונה</span>
                <Switch checked={lockImageAspect} onCheckedChange={setLockImageAspect} />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setImageFitMode("contain")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold ${imageFitMode === "contain" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                >
                  התאמה לדף (Contain)
                </button>
                <button
                  onClick={() => setImageFitMode("cover")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold ${imageFitMode === "cover" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                >
                  מילוי דף (Cover)
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setPageWidthPercent(100);
                    setPageHeightPercent(108);
                    setImageScaleXPercent(110);
                    setImageScaleYPercent(110);
                  }}
                  className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs text-foreground"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  הרחב
                </button>
                <button
                  onClick={() => {
                    setPageWidthPercent(78);
                    setPageHeightPercent(90);
                    setImageScaleXPercent(90);
                    setImageScaleYPercent(90);
                  }}
                  className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs text-foreground"
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                  הצר
                </button>
                <button
                  onClick={() => {
                    setPageWidthPercent(92);
                    setPageHeightPercent(100);
                    setPageAspectRatio("4/3");
                    setImageScaleXPercent(100);
                    setImageScaleYPercent(100);
                    setImageFitMode("contain");
                    setCustomWidthCm("21");
                    setCustomHeightCm("29.7");
                  }}
                  className="mr-auto rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                >
                  איפוס מהיר
                </button>
              </div>
            </div>
            </div>
          </DialogPortal>
        </Dialog>

        {/* Save to Gallery Dialog */}
        <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
          <DialogContent className="max-w-md border-border" dir="rtl">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Save className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="font-display text-sm font-bold text-foreground">שמירה לגלריה</DialogTitle>
                  <p className="font-body text-xs text-muted-foreground">בחר שם לתמונה ואופן שמירה</p>
                </div>
              </div>
            </DialogHeader>

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
                  {isSaving ? "שומר..." : "החלף ושמור"}
                </button>
              )}
              <button
                onClick={() => handleSaveToGallery("new")}
                disabled={isSaving}
                className="flex-1 rounded-lg bg-gold px-4 py-2.5 font-display text-xs font-semibold text-gold-foreground transition-all hover:brightness-110 disabled:opacity-50"
              >
                {isSaving ? "שומר..." : "שכפל ושמור"}
              </button>
            </div>
          </DialogContent>
        </Dialog>

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

// Helper functions — use shared export-utils
import { downloadBlob, generateSimplePDF as generatePDF, canvasToBlob } from "@/lib/export-utils";

const ToolPage = () => (
  <ToolProvider>
    <ToolInner />
  </ToolProvider>
);

export default ToolPage;
