import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import {
  Plus, Trash2, Download, Eye, ChevronLeft, ChevronRight,
  GripVertical, Image as ImageIcon, Type, Palette, Settings2,
  FileText, Loader2, Upload, X, RotateCcw, Copy, BookOpen,
  Sparkles, FileDown, LayoutGrid, Home, Brain, Wand2,
  FolderOpen, ArrowUpCircle, Eraser, Zap, CheckCircle2,
  ChevronDown, ChevronUp, Frame, EyeOff, ALargeSmall, PenLine,
  Database, CloudDownload, Check, Star, SunMedium,
  Search, Pencil, EyeOff as EyeOffIcon, List, Grid3X3, ArrowDownAZ, ArrowUpAZ,
  RotateCw, TextCursorInput,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  colorBasedRemoveBg, removeWhiteBg, autoTrimTransparency,
  addDropShadow, extractColorPalette, autoEnhance, sharpenImage,
  compositeImages, adjustImage,
} from "@/lib/smart-image-tools";
import { supabase } from "@/integrations/supabase/client";
import {
  generateCatalog,
  catalogToPDF,
  defaultCatalogSettings,
  TEMPLATE_OPTIONS,
  BG_PATTERN_OPTIONS,
  FRAME_STYLE_OPTIONS,
  getItemsPerPage,
  type CatalogProduct,
  type CatalogSettings,
  type CatalogCategory,
  type CatalogPage,
  type CatalogTemplate,
  type CatalogTextOverlay,
  type FrameStyle,
  type PageSize,
  type BgPattern,
} from "@/lib/catalog-engine";
import {
  aiAnalyzeProduct,
  aiGenerateDescription,
  aiRemoveBackground,
  aiUpscaleImage,
  aiSuggestTheme,
  aiBatchAnalyze,
  aiGenerateTextOverlays,
  aiSuggestLayout,
  type AIBatchProgress,
} from "@/lib/catalog-ai";

// ─── Helpers ─────────────────────────────────────────────────
let idCounter = 0;
function newId(): string {
  return `prod_${Date.now()}_${++idCounter}`;
}
function catId(): string {
  return `cat_${Date.now()}_${++idCounter}`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const COLOR_PRESETS = [
  { name: "אינדיגו", brand: "#6366f1", accent: "#f59e0b", bg: "#ffffff", text: "#1a1a2e" },
  { name: "אדום", brand: "#ef4444", accent: "#f59e0b", bg: "#ffffff", text: "#1a1a2e" },
  { name: "ירוק", brand: "#22c55e", accent: "#06b6d4", bg: "#ffffff", text: "#1a1a2e" },
  { name: "כחול", brand: "#3b82f6", accent: "#f97316", bg: "#ffffff", text: "#1a1a2e" },
  { name: "סגול", brand: "#a855f7", accent: "#ec4899", bg: "#ffffff", text: "#1a1a2e" },
  { name: "יוקרה", brand: "#d4af37", accent: "#d4af37", bg: "#0d0d1a", text: "#e5e5e5" },
  { name: "מונוכרום", brand: "#374151", accent: "#6b7280", bg: "#ffffff", text: "#111827" },
  { name: "פסטל", brand: "#c084fc", accent: "#f9a8d4", bg: "#faf5ff", text: "#3b0764" },
];

const CATEGORY_COLORS = [
  "#6366f1", "#ef4444", "#22c55e", "#3b82f6", "#a855f7",
  "#f59e0b", "#ec4899", "#06b6d4", "#f97316", "#84cc16",
];

// ─── Component ───────────────────────────────────────────────
export default function CatalogBuilder() {
  // Products & Categories
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  // Settings
  const [settings, setSettings] = useState<CatalogSettings>({ ...defaultCatalogSettings });
  // Preview
  const [pages, setPages] = useState<CatalogPage[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [autoPreview, setAutoPreview] = useState(true);
  // Sidebar tab
  const [sideTab, setSideTab] = useState<"products" | "categories" | "template" | "design" | "settings" | "ai">("products");
  // AI state
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiBatchProgress, setAiBatchProgress] = useState<AIBatchProgress | null>(null);
  const [aiSingleLoading, setAiSingleLoading] = useState<string | null>(null);
  // Expanded product
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  // Text overlay editing
  const [editingOverlay, setEditingOverlay] = useState<string | null>(null);
  // Gallery import
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryTab, setGalleryTab] = useState<"history" | "products">("history");
  const [galleryItems, setGalleryItems] = useState<{ id: string; image: string; name: string; description?: string; price?: string; source: "history" | "products" }[]>([]);
  const [gallerySelected, setGallerySelected] = useState<Set<string>>(new Set());
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [gallerySearch, setGallerySearch] = useState("");
  const [galleryNameEdits, setGalleryNameEdits] = useState<Record<string, string>>({});
  const [galleryEditingId, setGalleryEditingId] = useState<string | null>(null);
  const [galleryHideText, setGalleryHideText] = useState<{ name: boolean; description: boolean; price: boolean }>({ name: false, description: false, price: false });
  const [gallerySortDir, setGallerySortDir] = useState<"asc" | "desc">("desc");
  const [galleryViewMode, setGalleryViewMode] = useState<"grid" | "list">("grid");
  // Refs
  const logoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Add products from files ─────────────────────────────
  const handleAddImages = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newProducts: CatalogProduct[] = [];

    for (const file of fileArray) {
      if (!file.type.startsWith("image/")) continue;
      const base64 = await fileToBase64(file);
      const name = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      newProducts.push({
        id: newId(),
        image: base64,
        name,
        description: "",
        price: "",
        sku: "",
        badge: "",
        category: categories.length > 0 ? categories[0].id : undefined,
      });
    }

    setProducts(prev => [...prev, ...newProducts]);
    toast.success(`${newProducts.length} תמונות נוספו`);
  }, [categories]);

  // ─── Drag & Drop ──────────────────────────────────────────
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files.length > 0) {
      handleAddImages(e.dataTransfer.files);
    }
  }, [handleAddImages]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // ─── Product CRUD ─────────────────────────────────────────
  const updateProduct = useCallback((id: string, updates: Partial<CatalogProduct>) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const removeProduct = useCallback((id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  }, []);

  const duplicateProduct = useCallback((id: string) => {
    setProducts(prev => {
      const idx = prev.findIndex(p => p.id === id);
      if (idx < 0) return prev;
      const clone = { ...prev[idx], id: newId() };
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setProducts([]);
    setPages([]);
    setCurrentPage(0);
  }, []);

  // ─── Category CRUD ────────────────────────────────────────
  const addCategory = useCallback(() => {
    const colorIdx = categories.length % CATEGORY_COLORS.length;
    setCategories(prev => [...prev, {
      id: catId(),
      name: `קטגוריה ${prev.length + 1}`,
      color: CATEGORY_COLORS[colorIdx],
    }]);
  }, [categories.length]);

  const updateCategory = useCallback((id: string, updates: Partial<CatalogCategory>) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);

  const removeCategory = useCallback((id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id));
    setProducts(prev => prev.map(p => p.category === id ? { ...p, category: undefined } : p));
  }, []);

  // ─── Gallery Import ────────────────────────────────────────
  const loadGalleryItems = useCallback(async (tab: "history" | "products") => {
    setGalleryLoading(true);
    setGalleryItems([]);
    setGallerySelected(new Set());
    try {
      if (tab === "history") {
        const { data, error } = await supabase
          .from("processing_history")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        setGalleryItems((data || []).map(item => ({
          id: item.id,
          image: item.result_image_url || item.original_image_url || "",
          name: item.background_name || item.background_prompt?.slice(0, 40) || "תמונה מעובדת",
          description: item.background_prompt || "",
          source: "history" as const,
        })));
      } else {
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        setGalleryItems((data || []).map(item => ({
          id: item.id,
          image: item.image_url || "",
          name: item.title || "מוצר",
          description: item.description || "",
          price: item.price ? `₪${item.price}` : undefined,
          source: "products" as const,
        })));
      }
    } catch (err) {
      console.error(err);
      toast.error("שגיאה בטעינת גלריה");
    } finally {
      setGalleryLoading(false);
    }
  }, []);

  const openGalleryImport = useCallback(() => {
    setGalleryOpen(true);
    setGallerySearch("");
    setGalleryNameEdits({});
    setGalleryEditingId(null);
    loadGalleryItems(galleryTab);
  }, [galleryTab, loadGalleryItems]);

  // Filtered + sorted gallery items
  const filteredGalleryItems = useMemo(() => {
    let items = galleryItems;
    if (gallerySearch.trim()) {
      const q = gallerySearch.trim().toLowerCase();
      items = items.filter(i =>
        i.name.toLowerCase().includes(q) ||
        (i.description?.toLowerCase().includes(q)) ||
        (i.price?.toLowerCase().includes(q))
      );
    }
    if (gallerySortDir === "asc") {
      items = [...items].reverse();
    }
    return items;
  }, [galleryItems, gallerySearch, gallerySortDir]);

  const toggleGalleryItem = useCallback((id: string) => {
    setGallerySelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAllGallery = useCallback(() => {
    const currentIds = filteredGalleryItems.map(i => i.id);
    const allSelected = currentIds.every(id => gallerySelected.has(id));
    if (allSelected) {
      setGallerySelected(prev => {
        const next = new Set(prev);
        currentIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setGallerySelected(prev => {
        const next = new Set(prev);
        currentIds.forEach(id => next.add(id));
        return next;
      });
    }
  }, [filteredGalleryItems, gallerySelected]);

  const getGalleryItemName = useCallback((item: typeof galleryItems[0]) => {
    return galleryNameEdits[item.id] ?? item.name;
  }, [galleryNameEdits]);

  const importSelectedGallery = useCallback(() => {
    const selected = galleryItems.filter(i => gallerySelected.has(i.id));
    if (selected.length === 0) return;
    const newProducts: CatalogProduct[] = selected.map(item => ({
      id: newId(),
      image: item.image,
      name: galleryHideText.name ? "" : (galleryNameEdits[item.id] ?? item.name),
      description: galleryHideText.description ? "" : (item.description || ""),
      price: galleryHideText.price ? "" : (item.price || ""),
      sku: "",
      badge: "",
      category: categories.length > 0 ? categories[0].id : undefined,
      hideElements: {
        showName: !galleryHideText.name,
        showDescription: !galleryHideText.description,
        showPrice: !galleryHideText.price,
      },
    }));
    setProducts(prev => [...prev, ...newProducts]);
    toast.success(`${newProducts.length} פריטים יובאו מהגלריה`);
    setGalleryOpen(false);
    setGallerySelected(new Set());
  }, [galleryItems, gallerySelected, categories, galleryNameEdits, galleryHideText]);

  const bulkRenameGalleryPrefix = useCallback((prefix: string) => {
    const edits: Record<string, string> = {};
    galleryItems.forEach((item, i) => {
      if (gallerySelected.has(item.id)) {
        edits[item.id] = `${prefix} ${i + 1}`;
      }
    });
    setGalleryNameEdits(prev => ({ ...prev, ...edits }));
    toast.success(`שמות עודכנו ל-${Object.keys(edits).length} פריטים`);
  }, [galleryItems, gallerySelected]);

  // ─── Logo upload ──────────────────────────────────────────
  const handleLogoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await fileToBase64(file);
    setSettings(s => ({ ...s, logo: base64 }));
  }, []);

  // ─── Generate Preview ─────────────────────────────────────
  const generate = useCallback(async () => {
    if (products.length === 0) {
      toast.error("הוסף לפחות תמונה אחת");
      return;
    }
    setGenerating(true);
    setProgress(0);
    try {
      const result = await generateCatalog(products, settings, (page, total) => {
        setProgress(Math.round(((page + 1) / total) * 100));
      }, categories);
      setPages(result);
      setCurrentPage(0);
      toast.success(`הקטלוג נוצר — ${result.length} עמודים`);
    } catch (err) {
      toast.error("שגיאה ביצירת הקטלוג");
      console.error(err);
    } finally {
      setGenerating(false);
    }
  }, [products, settings, categories]);

  // Auto-generate preview
  useEffect(() => {
    if (!autoPreview || products.length === 0) return;
    const timeout = setTimeout(() => { generate(); }, 800);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products.length, settings.template, settings.columns, settings.pageSize,
      settings.showToc, settings.showBackCover, settings.showPriceList,
      settings.showCategoryDividers, settings.bgPattern, settings.globalFrame,
      settings.productNameSize, settings.productDescSize, settings.productPriceSize,
      autoPreview, categories.length]);

  // ─── Export ────────────────────────────────────────────────
  const exportPDF = useCallback(async () => {
    let pagesToExport = pages;
    if (pagesToExport.length === 0) {
      pagesToExport = await generateCatalog(products, settings, undefined, categories);
    }
    const blob = await catalogToPDF(pagesToExport);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${settings.title || "catalog"}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("PDF הורד בהצלחה");
  }, [pages, products, settings, categories]);

  const exportImages = useCallback(async () => {
    if (pages.length === 0) return;
    // Download each page as PNG
    for (let i = 0; i < pages.length; i++) {
      const a = document.createElement("a");
      a.href = pages[i].dataUrl;
      a.download = `${settings.title}_page_${i + 1}.png`;
      a.click();
    }
    toast.success(`${pages.length} עמודים הורדו`);
  }, [pages, settings.title]);

  // ─── Save to Gallery ──────────────────────────────────────
  const [savingToGallery, setSavingToGallery] = useState(false);

  const saveCatalogToGallery = useCallback(async () => {
    if (pages.length === 0) {
      toast.error("יש ליצור תצוגה מקדימה לפני שמירה");
      return;
    }
    setSavingToGallery(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("יש להתחבר כדי לשמור לגלריה");
        setSavingToGallery(false);
        return;
      }
      const ts = Date.now();
      // Save each page
      for (let i = 0; i < pages.length; i++) {
        const blob = await fetch(pages[i].dataUrl).then(r => r.blob());
        const path = `${user.id}/${ts}_catalog_p${i + 1}.png`;
        const { error: upErr } = await supabase.storage.from("processed-images").upload(path, blob, { contentType: "image/png" });
        if (upErr) throw upErr;
        const publicUrl = supabase.storage.from("processed-images").getPublicUrl(path).data.publicUrl;
        await supabase.from("processing_history").insert({
          user_id: user.id,
          original_image_url: publicUrl,
          result_image_url: publicUrl,
          background_prompt: `קטלוג — ${settings.title || 'ללא שם'} — עמוד ${i + 1}/${pages.length}`,
          background_name: `קטלוג: ${settings.title || 'ללא שם'}`,
        });
      }
      toast.success(`${pages.length} עמודי קטלוג נשמרו בגלריה!`);
    } catch (err) {
      toast.error("שגיאה בשמירה לגלריה");
      console.error(err);
    } finally {
      setSavingToGallery(false);
    }
  }, [pages, settings.title]);

  // ─── Setting helpers ──────────────────────────────────────
  const updateSetting = useCallback(<K extends keyof CatalogSettings>(key: K, val: CatalogSettings[K]) => {
    setSettings(s => ({ ...s, [key]: val }));
  }, []);

  // ─── Text Overlay CRUD ────────────────────────────────────
  const addTextOverlay = useCallback(() => {
    const overlay: CatalogTextOverlay = {
      id: `ov_${Date.now()}_${++idCounter}`,
      text: "טקסט חדש",
      page: -1, // all pages
      x: 0.5,
      y: 0.5,
      fontSize: 32,
      fontFamily: "sans",
      fontWeight: "normal",
      color: "#000000",
      align: "center",
      opacity: 1,
      rotation: 0,
    };
    setSettings(s => ({ ...s, textOverlays: [...(s.textOverlays || []), overlay] }));
    setEditingOverlay(overlay.id);
  }, []);

  const updateOverlay = useCallback((id: string, updates: Partial<CatalogTextOverlay>) => {
    setSettings(s => ({
      ...s,
      textOverlays: (s.textOverlays || []).map(o => o.id === id ? { ...o, ...updates } : o),
    }));
  }, []);

  const removeOverlay = useCallback((id: string) => {
    setSettings(s => ({
      ...s,
      textOverlays: (s.textOverlays || []).filter(o => o.id !== id),
    }));
    if (editingOverlay === id) setEditingOverlay(null);
  }, [editingOverlay]);

  // ─── AI Operations ────────────────────────────────────────
  const aiAnalyzeSingle = useCallback(async (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    setAiSingleLoading(productId);
    try {
      const analysis = await aiAnalyzeProduct(product.image);
      updateProduct(productId, {
        description: analysis.suggestedDescription,
        colors: analysis.colors.map(c => c.hex),
        name: product.name && !product.name.includes("_") ? product.name : analysis.productType,
      });
      toast.success("ניתוח AI הושלם");
    } catch (err) {
      toast.error("שגיאה בניתוח AI");
      console.error(err);
    } finally {
      setAiSingleLoading(null);
    }
  }, [products, updateProduct]);

  const aiDescribeSingle = useCallback(async (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    setAiSingleLoading(productId);
    try {
      const desc = await aiGenerateDescription(product, settings.title);
      updateProduct(productId, { aiDescription: desc, description: desc });
      toast.success("תיאור AI נוצר");
    } catch (err) {
      toast.error("שגיאה ביצירת תיאור");
      console.error(err);
    } finally {
      setAiSingleLoading(null);
    }
  }, [products, settings.title, updateProduct]);

  const aiRemoveBgSingle = useCallback(async (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    setAiSingleLoading(productId);
    try {
      const noBg = await aiRemoveBackground(product.image);
      updateProduct(productId, { noBgImage: noBg, image: `data:image/png;base64,${noBg}` });
      toast.success("רקע הוסר בהצלחה");
    } catch (err) {
      toast.error("שגיאה בהסרת רקע");
      console.error(err);
    } finally {
      setAiSingleLoading(null);
    }
  }, [products, updateProduct]);

  const aiUpscaleSingle = useCallback(async (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    setAiSingleLoading(productId);
    try {
      const upscaled = await aiUpscaleImage(product.image, 2);
      updateProduct(productId, { upscaledImage: upscaled, image: `data:image/png;base64,${upscaled}` });
      toast.success("תמונה שודרגה ×2");
    } catch (err) {
      toast.error("שגיאה בשדרוג תמונה");
      console.error(err);
    } finally {
      setAiSingleLoading(null);
    }
  }, [products, updateProduct]);

  const aiSuggestColors = useCallback(async () => {
    if (products.length === 0) return;
    setAiProcessing(true);
    try {
      const theme = await aiSuggestTheme(products);
      if (theme.brandColor || theme.accentColor) {
        setSettings(s => ({ ...s, ...theme }));
        toast.success("ערכת צבעים עודכנה לפי המוצרים");
      }
    } catch (err) {
      toast.error("שגיאה בניתוח צבעים");
      console.error(err);
    } finally {
      setAiProcessing(false);
    }
  }, [products]);

  const aiBatchProcess = useCallback(async (ops: {
    descriptions?: boolean;
    removeBg?: boolean;
    upscale?: boolean;
    analyzeColors?: boolean;
  }) => {
    if (products.length === 0) return;
    setAiProcessing(true);
    setAiBatchProgress(null);
    try {
      const updated = await aiBatchAnalyze(products, ops, (prog) => {
        setAiBatchProgress(prog);
      });
      setProducts(updated);
      toast.success(`עיבוד AI הושלם ל-${products.length} מוצרים`);
    } catch (err) {
      toast.error("שגיאה בעיבוד אצווה");
      console.error(err);
    } finally {
      setAiProcessing(false);
      setAiBatchProgress(null);
    }
  }, [products]);

  // ─── Product count info ────────────────────────────────────
  const templateInfo = useMemo(() => {
    const perPage = getItemsPerPage(settings.template, settings.columns);
    let totalPages = products.length > 0 ? 1 + Math.ceil(products.length / perPage) : 0;
    if (settings.showToc && categories.length > 0) totalPages++;
    if (settings.showBackCover) totalPages++;
    if (settings.showPriceList) totalPages += Math.ceil(products.filter(p => p.price).length / 22) || 0;
    if (settings.showCategoryDividers) totalPages += categories.length;
    return { perPage, totalPages };
  }, [settings, products, categories.length]);

  const pageTypeLabel = useCallback((page: CatalogPage): string => {
    switch (page.type) {
      case "cover": return "שער";
      case "toc": return "תוכן";
      case "divider": return "מפריד";
      case "products": return String(page.pageNumber);
      case "price-list": return "מחירון";
      case "back-cover": return "אחורי";
      default: return String(page.pageNumber);
    }
  }, []);

  // ─── Render ────────────────────────────────────────────────
  return (
    <>
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center gap-3 px-4">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <Home className="h-4 w-4" />
          </Link>
          <Separator orientation="vertical" className="h-5" />
          <BookOpen className="h-5 w-5 text-primary" />
          <h1 className="font-bold text-lg">מחולל קטלוגים</h1>
          <Badge variant="secondary" className="text-xs">{products.length} מוצרים</Badge>
          {categories.length > 0 && (
            <Badge variant="outline" className="text-xs">{categories.length} קטגוריות</Badge>
          )}
          {templateInfo.totalPages > 0 && (
            <Badge variant="outline" className="text-xs">{templateInfo.totalPages} עמודים</Badge>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Label htmlFor="auto-preview" className="text-xs cursor-pointer">תצוגה אוטומטית</Label>
              <Switch id="auto-preview" checked={autoPreview} onCheckedChange={setAutoPreview} />
            </div>
            <Button variant="outline" size="sm" onClick={generate} disabled={generating || products.length === 0}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
              תצוגה מקדימה
            </Button>
            <Button size="sm" onClick={exportPDF} disabled={products.length === 0}>
              <FileDown className="h-4 w-4" />
              ייצוא PDF
            </Button>
            <Button size="sm" variant="outline" onClick={saveCatalogToGallery} disabled={savingToGallery || pages.length === 0}>
              {savingToGallery ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
              שמור לגלריה
            </Button>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-3.5rem)]">
        {/* ── Sidebar ──────────────────────────────────────── */}
        <aside className="w-80 border-l bg-muted/30 flex flex-col">
          {/* Side tabs */}
          <div className="flex border-b overflow-x-auto">
            {[
              { id: "products" as const, icon: ImageIcon, label: "מוצרים" },
              { id: "categories" as const, icon: FolderOpen, label: "קטגוריות" },
              { id: "template" as const, icon: LayoutGrid, label: "תבנית" },
              { id: "design" as const, icon: Palette, label: "עיצוב" },
              { id: "ai" as const, icon: Brain, label: "AI" },
              { id: "settings" as const, icon: Settings2, label: "הגדרות" },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSideTab(tab.id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] transition-colors border-b-2 min-w-0 ${
                  sideTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          <ScrollArea className="flex-1">
            <div className="p-3 space-y-3">
              {/* ── Products Tab ──────────────────────────── */}
              {sideTab === "products" && (
                <>
                  {/* Upload zone */}
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed rounded-lg p-5 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                  >
                    <Upload className="h-7 w-7 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium">גרור תמונות או לחץ להעלאה</p>
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={e => e.target.files && handleAddImages(e.target.files)}
                    />
                  </div>

                  {/* Import from gallery */}
                  <Button
                    variant="outline"
                    className="w-full gap-2 h-9"
                    onClick={openGalleryImport}
                  >
                    <Database className="h-4 w-4 text-primary" />
                    <span className="text-xs font-medium">ייבוא מהגלריה / מהענן</span>
                  </Button>

                  {products.length > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {products.length} מוצרים · {templateInfo.perPage} בעמוד
                      </span>
                      <Button variant="ghost" size="sm" onClick={clearAll} className="text-destructive hover:text-destructive h-7">
                        <Trash2 className="h-3 w-3" />
                        <span className="text-xs">נקה</span>
                      </Button>
                    </div>
                  )}

                  {/* Product list with reorder */}
                  <Reorder.Group axis="y" values={products} onReorder={setProducts} className="space-y-1.5">
                    <AnimatePresence>
                      {products.map((product) => {
                        const isExpanded = expandedProduct === product.id;
                        const isLoading = aiSingleLoading === product.id;
                        return (
                          <Reorder.Item key={product.id} value={product} className="group">
                            <motion.div
                              layout
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, x: -50 }}
                              className={`bg-background rounded-lg border p-2 space-y-1.5 ${isLoading ? "ring-2 ring-primary/30 animate-pulse" : ""}`}
                            >
                              <div className="flex gap-2">
                                <div className="flex items-center cursor-grab active:cursor-grabbing text-muted-foreground">
                                  <GripVertical className="h-4 w-4" />
                                </div>
                                <div className="w-12 h-12 rounded overflow-hidden bg-muted flex-shrink-0 relative">
                                  <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                                  {product.noBgImage && (
                                    <div className="absolute bottom-0 right-0 bg-green-500 rounded-tl px-0.5">
                                      <CheckCircle2 className="h-2.5 w-2.5 text-white" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <Input
                                    value={product.name}
                                    onChange={e => updateProduct(product.id, { name: e.target.value })}
                                    className="h-6 text-xs font-medium"
                                    placeholder="שם מוצר"
                                  />
                                  <div className="flex gap-1 mt-1">
                                    <Input
                                      value={product.price || ""}
                                      onChange={e => updateProduct(product.id, { price: e.target.value })}
                                      className="h-5 text-[10px] w-16"
                                      placeholder="מחיר"
                                    />
                                    <Input
                                      value={product.sku || ""}
                                      onChange={e => updateProduct(product.id, { sku: e.target.value })}
                                      className="h-5 text-[10px] w-16"
                                      placeholder="מק״ט"
                                    />
                                    {categories.length > 0 && (
                                      <Select
                                        value={product.category || "none"}
                                        onValueChange={v => updateProduct(product.id, { category: v === "none" ? undefined : v })}
                                      >
                                        <SelectTrigger className="h-5 text-[10px] flex-1 min-w-0">
                                          <SelectValue placeholder="קטגוריה" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="none">ללא</SelectItem>
                                          {categories.map(c => (
                                            <SelectItem key={c.id} value={c.id}>
                                              <span className="flex items-center gap-1">
                                                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: c.color }} />
                                                {c.name}
                                              </span>
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <Button
                                    variant="ghost" size="icon" className="h-5 w-5"
                                    onClick={() => setExpandedProduct(isExpanded ? null : product.id)}
                                  >
                                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => duplicateProduct(product.id)}>
                                    <Copy className="h-2.5 w-2.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => removeProduct(product.id)}>
                                    <Trash2 className="h-2.5 w-2.5" />
                                  </Button>
                                </div>
                              </div>

                              {/* Expanded details */}
                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="space-y-1.5 overflow-hidden"
                                  >
                                    <Input
                                      value={product.description || ""}
                                      onChange={e => updateProduct(product.id, { description: e.target.value })}
                                      className="h-6 text-xs"
                                      placeholder="תיאור מוצר"
                                    />
                                    <Input
                                      value={product.badge || ""}
                                      onChange={e => updateProduct(product.id, { badge: e.target.value })}
                                      className="h-6 text-xs"
                                      placeholder='תגית (למשל: "חדש", "מבצע")'
                                    />
                                    <div className="flex flex-wrap gap-1">
                                      <Button
                                        variant="outline" size="sm" className="h-6 text-[10px] gap-1"
                                        disabled={isLoading}
                                        onClick={() => aiAnalyzeSingle(product.id)}
                                      >
                                        {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
                                        ניתוח AI
                                      </Button>
                                      <Button
                                        variant="outline" size="sm" className="h-6 text-[10px] gap-1"
                                        disabled={isLoading}
                                        onClick={() => aiDescribeSingle(product.id)}
                                      >
                                        <Type className="h-3 w-3" />
                                        תיאור AI
                                      </Button>
                                      <Button
                                        variant="outline" size="sm" className="h-6 text-[10px] gap-1"
                                        disabled={isLoading}
                                        onClick={() => aiRemoveBgSingle(product.id)}
                                      >
                                        <Eraser className="h-3 w-3" />
                                        הסר רקע
                                      </Button>
                                      <Button
                                        variant="outline" size="sm" className="h-6 text-[10px] gap-1"
                                        disabled={isLoading}
                                        onClick={() => aiUpscaleSingle(product.id)}
                                      >
                                        <ArrowUpCircle className="h-3 w-3" />
                                        שדרג ×2
                                      </Button>
                                    </div>
                                    {product.colors && product.colors.length > 0 && (
                                      <div className="flex gap-1 items-center">
                                        <span className="text-[10px] text-muted-foreground">צבעים:</span>
                                        {product.colors.map((c, i) => (
                                          <span key={i} className="w-4 h-4 rounded-full border" style={{ backgroundColor: c }} />
                                        ))}
                                      </div>
                                    )}
                                    {/* Per-product frame */}
                                    <div className="space-y-1">
                                      <Label className="text-[10px] text-muted-foreground">מסגרת מוצר</Label>
                                      <Select
                                        value={product.frameStyle || "none"}
                                        onValueChange={v => updateProduct(product.id, { frameStyle: v as FrameStyle })}
                                      >
                                        <SelectTrigger className="h-6 text-[10px]">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {FRAME_STYLE_OPTIONS.map(f => (
                                            <SelectItem key={f.id} value={f.id}>
                                              <span>{f.icon} {f.label}</span>
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    {/* Per-product font size */}
                                    <div className="space-y-1">
                                      <Label className="text-[10px] text-muted-foreground">גודל גופן שם ({((product.customFontSize ?? 1) * 100).toFixed(0)}%)</Label>
                                      <Slider
                                        value={[product.customFontSize ?? 1]}
                                        min={0.5}
                                        max={2}
                                        step={0.1}
                                        onValueChange={([v]) => updateProduct(product.id, { customFontSize: v })}
                                      />
                                    </div>
                                    {/* Per-product element visibility */}
                                    <div className="space-y-1">
                                      <Label className="text-[10px] text-muted-foreground flex items-center gap-1"><EyeOff className="h-3 w-3" /> הסתר אלמנטים</Label>
                                      <div className="flex flex-wrap gap-1">
                                        {([
                                          { key: "showImage" as const, label: "תמונה" },
                                          { key: "showName" as const, label: "שם" },
                                          { key: "showPrice" as const, label: "מחיר" },
                                          { key: "showDescription" as const, label: "תיאור" },
                                          { key: "showBadge" as const, label: "תגית" },
                                        ]).map(el => {
                                          const isHidden = product.hideElements?.[el.key] === false;
                                          return (
                                            <button
                                              key={el.key}
                                              onClick={() => updateProduct(product.id, {
                                                hideElements: {
                                                  ...product.hideElements,
                                                  [el.key]: isHidden ? true : false,
                                                },
                                              })}
                                              className={`px-1.5 py-0.5 rounded text-[10px] border transition-colors ${
                                                isHidden ? "bg-destructive/10 text-destructive border-destructive/30 line-through" : "bg-muted border-transparent"
                                              }`}
                                            >
                                              {el.label}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          </Reorder.Item>
                        );
                      })}
                    </AnimatePresence>
                  </Reorder.Group>
                </>
              )}

              {/* ── Categories Tab ────────────────────────── */}
              {sideTab === "categories" && (
                <>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">קטגוריות מוצרים</Label>
                    <Button variant="outline" size="sm" onClick={addCategory} className="h-7">
                      <Plus className="h-3 w-3" />
                      <span className="text-xs">הוסף</span>
                    </Button>
                  </div>

                  {categories.length === 0 && (
                    <div className="text-center py-6 text-muted-foreground">
                      <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">הוסף קטגוריות לארגון המוצרים בקטלוג</p>
                      <p className="text-[10px] mt-1">קטגוריות יוצרות דפי מפריד ותוכן עניינים</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    {categories.map(cat => {
                      const catProductCount = products.filter(p => p.category === cat.id).length;
                      return (
                        <div key={cat.id} className="bg-background border rounded-lg p-2.5 space-y-2">
                          <div className="flex gap-2 items-center">
                            <input
                              type="color"
                              value={cat.color || "#6366f1"}
                              onChange={e => updateCategory(cat.id, { color: e.target.value })}
                              className="w-7 h-7 rounded border cursor-pointer"
                            />
                            <Input
                              value={cat.name}
                              onChange={e => updateCategory(cat.id, { name: e.target.value })}
                              className="h-7 text-xs font-medium flex-1"
                            />
                            <Badge variant="secondary" className="text-[10px]">{catProductCount}</Badge>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeCategory(cat.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <Input
                            value={cat.description || ""}
                            onChange={e => updateCategory(cat.id, { description: e.target.value })}
                            className="h-6 text-xs"
                            placeholder="תיאור קטגוריה (אופציונלי)"
                          />
                        </div>
                      );
                    })}
                  </div>

                  {categories.length > 0 && (
                    <>
                      <Separator />
                      <p className="text-[10px] text-muted-foreground">
                        שייך מוצרים לקטגוריות דרך לשונית "מוצרים"
                      </p>
                    </>
                  )}
                </>
              )}

              {/* ── Template Tab ─────────────────────────── */}
              {sideTab === "template" && (
                <>
                  <Label className="text-sm font-semibold">בחר תבנית</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {TEMPLATE_OPTIONS.map(t => (
                      <button
                        key={t.id}
                        onClick={() => updateSetting("template", t.id)}
                        className={`rounded-lg border p-3 text-center transition-all hover:shadow-md ${
                          settings.template === t.id
                            ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                            : "hover:border-primary/30"
                        }`}
                      >
                        <span className="text-2xl block mb-1">{t.icon}</span>
                        <span className="text-xs font-medium block">{t.label}</span>
                        <span className="text-[10px] text-muted-foreground block mt-0.5">{t.desc}</span>
                      </button>
                    ))}
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">עמודות</Label>
                      <div className="flex gap-1 mt-1">
                        {([1, 2, 3, 4] as const).map(n => (
                          <Button
                            key={n}
                            size="sm"
                            variant={settings.columns === n ? "default" : "outline"}
                            onClick={() => updateSetting("columns", n)}
                            className="flex-1"
                            disabled={settings.template === "showcase" || settings.template === "lookbook"}
                          >
                            {n}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs">גודל עמוד</Label>
                      <div className="space-y-1.5 mt-1">
                        <p className="text-[10px] text-muted-foreground font-semibold">🖨️ הדפסה</p>
                        <div className="flex flex-wrap gap-1">
                          {(["A4", "A3", "A5", "letter"] as PageSize[]).map(s => (
                            <Button key={s} size="sm" variant={settings.pageSize === s ? "default" : "outline"} onClick={() => updateSetting("pageSize", s)} className="text-xs">
                              {s === "A5" ? "A5" : s === "letter" ? "Letter" : s}
                            </Button>
                          ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground font-semibold">📱 רשתות חברתיות</p>
                        <div className="flex flex-wrap gap-1">
                          {(["ig-post", "ig-story", "fb-post", "fb-cover"] as PageSize[]).map(s => (
                            <Button key={s} size="sm" variant={settings.pageSize === s ? "default" : "outline"} onClick={() => updateSetting("pageSize", s)} className="text-[10px] px-2">
                              {s === "ig-post" ? "IG פוסט" : s === "ig-story" ? "IG סטורי" : s === "fb-post" ? "FB פוסט" : "FB כיסוי"}
                            </Button>
                          ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground font-semibold">📐 אחר</p>
                        <div className="flex flex-wrap gap-1">
                          {(["square", "landscape"] as PageSize[]).map(s => (
                            <Button key={s} size="sm" variant={settings.pageSize === s ? "default" : "outline"} onClick={() => updateSetting("pageSize", s)} className="text-xs">
                              {s === "square" ? "ריבוע" : "לרוחב"}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs">דוגמת רקע</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {BG_PATTERN_OPTIONS.map(p => (
                          <Button
                            key={p.id}
                            size="sm"
                            variant={settings.bgPattern === p.id ? "default" : "outline"}
                            onClick={() => updateSetting("bgPattern", p.id)}
                            className="text-xs"
                          >
                            {p.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ── Design Tab ───────────────────────────── */}
              {sideTab === "design" && (
                <>
                  <Label className="text-sm font-semibold">ערכת צבעים</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {COLOR_PRESETS.map(cp => (
                      <button
                        key={cp.name}
                        onClick={() => setSettings(s => ({
                          ...s,
                          brandColor: cp.brand,
                          accentColor: cp.accent,
                          bgColor: cp.bg,
                          textColor: cp.text,
                        }))}
                        className={`rounded-lg border p-2 text-center transition-all hover:shadow ${
                          settings.brandColor === cp.brand && settings.bgColor === cp.bg
                            ? "ring-2 ring-primary"
                            : ""
                        }`}
                      >
                        <div className="flex gap-0.5 justify-center mb-1">
                          <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: cp.brand }} />
                          <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: cp.accent }} />
                        </div>
                        <span className="text-[10px]">{cp.name}</span>
                      </button>
                    ))}
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label className="text-xs">צבעים מותאמים</Label>
                    {[
                      { key: "brandColor" as const, label: "צבע מותג" },
                      { key: "accentColor" as const, label: "צבע הדגשה" },
                      { key: "bgColor" as const, label: "צבע רקע" },
                      { key: "textColor" as const, label: "צבע טקסט" },
                    ].map(c => (
                      <div key={c.key} className="flex items-center gap-2">
                        <input
                          type="color"
                          value={settings[c.key]}
                          onChange={e => updateSetting(c.key, e.target.value)}
                          className="w-8 h-8 rounded border cursor-pointer"
                        />
                        <span className="text-xs flex-1">{c.label}</span>
                        <code className="text-[10px] text-muted-foreground">{settings[c.key]}</code>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  <div>
                    <Label className="text-xs">גופן</Label>
                    <div className="flex gap-1 mt-1">
                      {([
                        { id: "sans" as const, label: "Sans" },
                        { id: "serif" as const, label: "Serif" },
                        { id: "mono" as const, label: "Mono" },
                      ] as const).map(f => (
                        <Button
                          key={f.id}
                          size="sm"
                          variant={settings.fontFamily === f.id ? "default" : "outline"}
                          onClick={() => updateSetting("fontFamily", f.id)}
                          className="flex-1"
                        >
                          {f.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Frame selection */}
                  <div>
                    <Label className="text-xs font-semibold flex items-center gap-1"><Frame className="h-3 w-3" /> מסגרת מוצרים</Label>
                    <div className="grid grid-cols-4 gap-1.5 mt-2">
                      {FRAME_STYLE_OPTIONS.map(f => (
                        <button
                          key={f.id}
                          onClick={() => updateSetting("globalFrame", f.id)}
                          className={`rounded-md border p-1.5 text-center transition-all ${
                            settings.globalFrame === f.id
                              ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                              : "hover:border-primary/30"
                          }`}
                        >
                          <span className="text-base block">{f.icon}</span>
                          <span className="text-[9px] block mt-0.5 leading-tight">{f.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Font sizes */}
                  <div className="space-y-3">
                    <Label className="text-xs font-semibold flex items-center gap-1"><ALargeSmall className="h-3 w-3" /> גדלי טקסט</Label>
                    {([
                      { key: "productNameSize" as const, label: "שם מוצר" },
                      { key: "productDescSize" as const, label: "תיאור" },
                      { key: "productPriceSize" as const, label: "מחיר" },
                    ]).map(s => (
                      <div key={s.key}>
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px]">{s.label}</Label>
                          <span className="text-[10px] text-muted-foreground">{((settings[s.key] || 1) * 100).toFixed(0)}%</span>
                        </div>
                        <Slider
                          value={[settings[s.key] || 1]}
                          min={0.5}
                          max={2}
                          step={0.1}
                          onValueChange={([v]) => updateSetting(s.key, v)}
                          className="mt-1"
                        />
                      </div>
                    ))}
                  </div>

                  <Separator />

                  {/* Text overlays */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold flex items-center gap-1"><PenLine className="h-3 w-3" /> שכבות טקסט</Label>
                      <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={addTextOverlay}>
                        <Plus className="h-3 w-3" />
                        הוסף
                      </Button>
                    </div>
                    {(settings.textOverlays || []).map(ov => (
                      <div key={ov.id} className="bg-background border rounded-lg p-2 space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <Input
                            value={ov.text}
                            onChange={e => updateOverlay(ov.id, { text: e.target.value })}
                            className="h-6 text-xs flex-1"
                            placeholder="טקסט..."
                          />
                          <Button
                            variant="ghost" size="icon" className="h-5 w-5"
                            onClick={() => setEditingOverlay(editingOverlay === ov.id ? null : ov.id)}
                          >
                            <Settings2 className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => removeOverlay(ov.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <AnimatePresence>
                          {editingOverlay === ov.id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="space-y-1.5 overflow-hidden"
                            >
                              <div className="grid grid-cols-2 gap-1.5">
                                <div>
                                  <Label className="text-[10px]">X ({(ov.x * 100).toFixed(0)}%)</Label>
                                  <Slider value={[ov.x]} min={0} max={1} step={0.01} onValueChange={([v]) => updateOverlay(ov.id, { x: v })} />
                                </div>
                                <div>
                                  <Label className="text-[10px]">Y ({(ov.y * 100).toFixed(0)}%)</Label>
                                  <Slider value={[ov.y]} min={0} max={1} step={0.01} onValueChange={([v]) => updateOverlay(ov.id, { y: v })} />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-1.5">
                                <div>
                                  <Label className="text-[10px]">גודל ({ov.fontSize})</Label>
                                  <Slider value={[ov.fontSize]} min={12} max={120} step={1} onValueChange={([v]) => updateOverlay(ov.id, { fontSize: v })} />
                                </div>
                                <div>
                                  <Label className="text-[10px]">שקיפות ({(ov.opacity * 100).toFixed(0)}%)</Label>
                                  <Slider value={[ov.opacity]} min={0.05} max={1} step={0.05} onValueChange={([v]) => updateOverlay(ov.id, { opacity: v })} />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-1.5">
                                <div>
                                  <Label className="text-[10px]">סיבוב ({ov.rotation}°)</Label>
                                  <Slider value={[ov.rotation || 0]} min={-180} max={180} step={1} onValueChange={([v]) => updateOverlay(ov.id, { rotation: v })} />
                                </div>
                                <div>
                                  <Label className="text-[10px]">עמוד</Label>
                                  <Select value={String(ov.page)} onValueChange={v => updateOverlay(ov.id, { page: Number(v) })}>
                                    <SelectTrigger className="h-6 text-[10px]"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="-1">כל העמודים</SelectItem>
                                      {pages.map((_, i) => (
                                        <SelectItem key={i} value={String(i)}>עמוד {i + 1}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div className="flex gap-1.5">
                                <Select value={ov.fontFamily} onValueChange={v => updateOverlay(ov.id, { fontFamily: v as CatalogTextOverlay["fontFamily"] })}>
                                  <SelectTrigger className="h-6 text-[10px] flex-1"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="sans">Sans</SelectItem>
                                    <SelectItem value="serif">Serif</SelectItem>
                                    <SelectItem value="mono">Mono</SelectItem>
                                    <SelectItem value="decorative">דקורטיבי</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Select value={ov.fontWeight} onValueChange={v => updateOverlay(ov.id, { fontWeight: v as "normal" | "bold" })}>
                                  <SelectTrigger className="h-6 text-[10px] w-16"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="normal">רגיל</SelectItem>
                                    <SelectItem value="bold">בולט</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Select value={ov.align} onValueChange={v => updateOverlay(ov.id, { align: v as "left" | "center" | "right" })}>
                                  <SelectTrigger className="h-6 text-[10px] w-16"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="right">ימין</SelectItem>
                                    <SelectItem value="center">מרכז</SelectItem>
                                    <SelectItem value="left">שמאל</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex gap-1.5 items-center">
                                <input type="color" value={ov.color} onChange={e => updateOverlay(ov.id, { color: e.target.value })} className="w-6 h-6 rounded border cursor-pointer" />
                                <span className="text-[10px]">צבע</span>
                                <input type="color" value={ov.backgroundColor || "#ffffff"} onChange={e => updateOverlay(ov.id, { backgroundColor: e.target.value })} className="w-6 h-6 rounded border cursor-pointer" />
                                <span className="text-[10px]">רקע</span>
                                <button
                                  onClick={() => updateOverlay(ov.id, { backgroundColor: ov.backgroundColor ? undefined : "rgba(255,255,255,0.7)" })}
                                  className={`text-[10px] px-1.5 py-0.5 rounded border ${ov.backgroundColor ? "bg-primary/10 border-primary" : ""}`}
                                >
                                  {ov.backgroundColor ? "עם רקע" : "ללא רקע"}
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  {/* Logo */}
                  <div>
                    <Label className="text-xs">לוגו</Label>
                    <div className="flex items-center gap-2 mt-1">
                      {settings.logo ? (
                        <div className="relative w-12 h-12 rounded-lg border overflow-hidden">
                          <img src={settings.logo} alt="Logo" className="w-full h-full object-contain" />
                          <button
                            onClick={() => updateSetting("logo", undefined)}
                            className="absolute top-0 right-0 bg-destructive text-white rounded-bl p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()}>
                          <Upload className="h-3 w-3" />
                          העלה לוגו
                        </Button>
                      )}
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoUpload}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* ── AI Tab ───────────────────────────────── */}
              {sideTab === "ai" && (
                <>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <Label className="text-sm font-semibold">כלי AI לקטלוג</Label>
                  </div>

                  {products.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">הוסף תמונות תחילה כדי להשתמש בכלי AI</p>
                    </div>
                  ) : (
                    <>
                      {aiProcessing && aiBatchProgress && (
                        <div className="bg-primary/10 rounded-lg p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            <span className="text-xs font-medium">
                              מעבד {aiBatchProgress.current} / {aiBatchProgress.total}
                            </span>
                          </div>
                          <Progress value={(aiBatchProgress.current / aiBatchProgress.total) * 100} className="h-1.5" />
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">פעולות על מוצר בודד</Label>
                        <p className="text-[10px] text-muted-foreground">
                          פתח מוצר בלשונית "מוצרים" — כפתורי AI מופיעים בהרחבה
                        </p>
                      </div>

                      <Separator />

                      <Label className="text-xs font-semibold">עיבוד אצוותי (כל המוצרים)</Label>

                      <div className="space-y-2">
                        <Button
                          variant="outline"
                          className="w-full justify-start gap-2 h-9"
                          disabled={aiProcessing}
                          onClick={() => aiBatchProcess({ descriptions: true, analyzeColors: true })}
                        >
                          <Brain className="h-4 w-4 text-purple-500" />
                          <div className="text-right">
                            <span className="text-xs font-medium block">ניתוח AI + תיאורים</span>
                            <span className="text-[10px] text-muted-foreground">זיהוי מוצרים, צבעים, יצירת תיאורים</span>
                          </div>
                        </Button>

                        <Button
                          variant="outline"
                          className="w-full justify-start gap-2 h-9"
                          disabled={aiProcessing}
                          onClick={() => aiBatchProcess({ removeBg: true })}
                        >
                          <Eraser className="h-4 w-4 text-green-500" />
                          <div className="text-right">
                            <span className="text-xs font-medium block">הסרת רקע לכולם</span>
                            <span className="text-[10px] text-muted-foreground">BRIA RMBG — הסרה מדויקת</span>
                          </div>
                        </Button>

                        <Button
                          variant="outline"
                          className="w-full justify-start gap-2 h-9"
                          disabled={aiProcessing}
                          onClick={() => aiBatchProcess({ upscale: true })}
                        >
                          <ArrowUpCircle className="h-4 w-4 text-blue-500" />
                          <div className="text-right">
                            <span className="text-xs font-medium block">שדרוג תמונות ×2</span>
                            <span className="text-[10px] text-muted-foreground">Real-ESRGAN — הגדלה חכמה</span>
                          </div>
                        </Button>

                        <Button
                          variant="outline"
                          className="w-full justify-start gap-2 h-9"
                          disabled={aiProcessing}
                          onClick={() => aiBatchProcess({ descriptions: true, removeBg: true, analyzeColors: true })}
                        >
                          <Zap className="h-4 w-4 text-amber-500" />
                          <div className="text-right">
                            <span className="text-xs font-medium block">עיבוד מלא</span>
                            <span className="text-[10px] text-muted-foreground">ניתוח + תיאורים + הסרת רקע</span>
                          </div>
                        </Button>
                      </div>

                      <Separator />

                      <Label className="text-xs font-semibold">עיצוב חכם</Label>
                      <Button
                        variant="outline"
                        className="w-full justify-start gap-2 h-9"
                        disabled={aiProcessing}
                        onClick={aiSuggestColors}
                      >
                        <Palette className="h-4 w-4 text-pink-500" />
                        <div className="text-right">
                          <span className="text-xs font-medium block">ערכת צבעים מהמוצרים</span>
                          <span className="text-[10px] text-muted-foreground">AI ינתח את המוצר הראשון ויציע צבעים</span>
                        </div>
                      </Button>

                      <Button
                        variant="outline"
                        className="w-full justify-start gap-2 h-9"
                        disabled={aiProcessing}
                        onClick={async () => {
                          setAiProcessing(true);
                          try {
                            const layout = await aiSuggestLayout(products);
                            setSettings(s => ({
                              ...s,
                              globalFrame: layout.suggestedFrame as FrameStyle,
                              fontFamily: layout.suggestedFont as CatalogSettings["fontFamily"],
                              columns: layout.suggestedColumns as 1 | 2 | 3 | 4,
                              template: layout.suggestedTemplate as CatalogTemplate,
                            }));
                            toast.success("פריסה חכמה הוחלה");
                          } catch { toast.error("שגיאה בהצעת פריסה"); }
                          finally { setAiProcessing(false); }
                        }}
                      >
                        <LayoutGrid className="h-4 w-4 text-teal-500" />
                        <div className="text-right">
                          <span className="text-xs font-medium block">הצע פריסה חכמה</span>
                          <span className="text-[10px] text-muted-foreground">AI יבחר תבנית, מסגרת, גופן ועמודות</span>
                        </div>
                      </Button>

                      <Button
                        variant="outline"
                        className="w-full justify-start gap-2 h-9"
                        disabled={aiProcessing}
                        onClick={async () => {
                          setAiProcessing(true);
                          try {
                            const texts = await aiGenerateTextOverlays(settings.title, products);
                            const newOverlays: CatalogTextOverlay[] = [];
                            if (texts.tagline) {
                              newOverlays.push({
                                id: `ov_${Date.now()}_tag`, text: texts.tagline, page: 0,
                                x: 0.5, y: 0.88, fontSize: 24, fontFamily: "sans", fontWeight: "bold",
                                color: settings.brandColor, align: "center", opacity: 0.9, rotation: 0,
                              });
                            }
                            if (texts.slogan) {
                              newOverlays.push({
                                id: `ov_${Date.now()}_slo`, text: texts.slogan, page: -1,
                                x: 0.5, y: 0.03, fontSize: 16, fontFamily: "serif", fontWeight: "normal",
                                color: settings.textColor, align: "center", opacity: 0.5, rotation: 0,
                              });
                            }
                            if (texts.callToAction) {
                              newOverlays.push({
                                id: `ov_${Date.now()}_cta`, text: texts.callToAction, page: -1,
                                x: 0.85, y: 0.95, fontSize: 18, fontFamily: "sans", fontWeight: "bold",
                                color: "#ffffff", align: "center", opacity: 0.8, rotation: 0,
                                backgroundColor: settings.brandColor,
                              });
                            }
                            setSettings(s => ({ ...s, textOverlays: [...(s.textOverlays || []), ...newOverlays] }));
                            toast.success(`${newOverlays.length} שכבות טקסט נוצרו`);
                          } catch { toast.error("שגיאה ביצירת טקסטים"); }
                          finally { setAiProcessing(false); }
                        }}
                      >
                        <Type className="h-4 w-4 text-orange-500" />
                        <div className="text-right">
                          <span className="text-xs font-medium block">צור טקסטים שיווקיים</span>
                          <span className="text-[10px] text-muted-foreground">סלוגן, טאגליין וקריאה לפעולה</span>
                        </div>
                      </Button>

                      <Separator />

                      <Label className="text-xs font-semibold">🔧 כלים חכמים (ללא AI — בדפדפן)</Label>
                      <div className="space-y-2">
                        <Button
                          variant="outline"
                          className="w-full justify-start gap-2 h-9"
                          disabled={aiProcessing || products.length === 0}
                          onClick={async () => {
                            setAiProcessing(true);
                            let count = 0;
                            for (const p of products) {
                              try {
                                const result = await removeWhiteBg(p.image);
                                setProducts(prev => prev.map(pr => pr.id === p.id ? { ...pr, noBgImage: result } : pr));
                                count++;
                              } catch { /* skip */ }
                            }
                            toast.success(`רקע לבן הוסר מ-${count} תמונות (ללא AI)`);
                            setAiProcessing(false);
                          }}
                        >
                          <Eraser className="h-4 w-4 text-emerald-500" />
                          <div className="text-right">
                            <span className="text-xs font-medium block">הסר רקע לבן (ללא AI)</span>
                            <span className="text-[10px] text-muted-foreground">אלגוריתם Luminance — מהיר, בדפדפן</span>
                          </div>
                        </Button>

                        <Button
                          variant="outline"
                          className="w-full justify-start gap-2 h-9"
                          disabled={aiProcessing || products.length === 0}
                          onClick={async () => {
                            setAiProcessing(true);
                            let count = 0;
                            for (const p of products) {
                              try {
                                const result = await colorBasedRemoveBg(p.image, { tolerance: 35 });
                                setProducts(prev => prev.map(pr => pr.id === p.id ? { ...pr, noBgImage: result } : pr));
                                count++;
                              } catch { /* skip */ }
                            }
                            toast.success(`רקע צבעוני הוסר מ-${count} תמונות (ללא AI)`);
                            setAiProcessing(false);
                          }}
                        >
                          <Wand2 className="h-4 w-4 text-violet-500" />
                          <div className="text-right">
                            <span className="text-xs font-medium block">הסר רקע לפי צבע (Chromakey)</span>
                            <span className="text-[10px] text-muted-foreground">זיהוי צבע שולי — ללא שרת</span>
                          </div>
                        </Button>

                        <Button
                          variant="outline"
                          className="w-full justify-start gap-2 h-9"
                          disabled={aiProcessing || products.length === 0}
                          onClick={async () => {
                            setAiProcessing(true);
                            let count = 0;
                            for (const p of products) {
                              try {
                                const src = p.noBgImage || p.image;
                                const result = await addDropShadow(src);
                                setProducts(prev => prev.map(pr => pr.id === p.id ? { ...pr, image: result } : pr));
                                count++;
                              } catch { /* skip */ }
                            }
                            toast.success(`צל נוסף ל-${count} תמונות`);
                            setAiProcessing(false);
                          }}
                        >
                          <SunMedium className="h-4 w-4 text-amber-500" />
                          <div className="text-right">
                            <span className="text-xs font-medium block">הוסף צל לכולם</span>
                            <span className="text-[10px] text-muted-foreground">צל תלת-ממדי אלגוריתמי</span>
                          </div>
                        </Button>

                        <Button
                          variant="outline"
                          className="w-full justify-start gap-2 h-9"
                          disabled={aiProcessing || products.length === 0}
                          onClick={async () => {
                            setAiProcessing(true);
                            let count = 0;
                            for (const p of products) {
                              try {
                                const result = await autoEnhance(p.image);
                                setProducts(prev => prev.map(pr => pr.id === p.id ? { ...pr, image: result } : pr));
                                count++;
                              } catch { /* skip */ }
                            }
                            toast.success(`${count} תמונות שופרו (Auto-Levels)`);
                            setAiProcessing(false);
                          }}
                        >
                          <Sparkles className="h-4 w-4 text-cyan-500" />
                          <div className="text-right">
                            <span className="text-xs font-medium block">שיפור אוטומטי (Auto-Levels)</span>
                            <span className="text-[10px] text-muted-foreground">התאמת טווח צבעים — Canvas API</span>
                          </div>
                        </Button>

                        <Button
                          variant="outline"
                          className="w-full justify-start gap-2 h-9"
                          disabled={aiProcessing || products.length === 0}
                          onClick={async () => {
                            setAiProcessing(true);
                            let count = 0;
                            for (const p of products) {
                              try {
                                const result = await sharpenImage(p.image);
                                setProducts(prev => prev.map(pr => pr.id === p.id ? { ...pr, image: result } : pr));
                                count++;
                              } catch { /* skip */ }
                            }
                            toast.success(`${count} תמונות חודדו`);
                            setAiProcessing(false);
                          }}
                        >
                          <Eye className="h-4 w-4 text-indigo-500" />
                          <div className="text-right">
                            <span className="text-xs font-medium block">חידוד לכולם</span>
                            <span className="text-[10px] text-muted-foreground">Unsharp Mask — ללא AI</span>
                          </div>
                        </Button>

                        <Button
                          variant="outline"
                          className="w-full justify-start gap-2 h-9"
                          disabled={aiProcessing || products.length === 0}
                          onClick={async () => {
                            if (products.length === 0) return;
                            setAiProcessing(true);
                            try {
                              const colors = await extractColorPalette(products[0].image, { count: 5 });
                              if (colors.length >= 2) {
                                setSettings(s => ({
                                  ...s,
                                  brandColor: colors[0],
                                  accentColor: colors[1],
                                }));
                                toast.success(`ערכת צבעים חולצה: ${colors.slice(0, 3).join(', ')}`);
                              }
                            } catch { toast.error("שגיאה בחילוץ צבעים"); }
                            setAiProcessing(false);
                          }}
                        >
                          <Palette className="h-4 w-4 text-rose-500" />
                          <div className="text-right">
                            <span className="text-xs font-medium block">חלץ ערכת צבעים (K-Means)</span>
                            <span className="text-[10px] text-muted-foreground">ניתוח פיקסלים — ללא AI</span>
                          </div>
                        </Button>
                      </div>

                      <Separator />

                      <div className="bg-muted/50 rounded-lg p-2.5 text-[10px] text-muted-foreground space-y-1">
                        <p className="font-medium text-xs text-foreground">מנועי AI בשימוש:</p>
                        <p>🧠 Gemini 2.5 Flash — ניתוח תמונות וטקסט</p>
                        <p>🎨 BRIA RMBG 2.0 — הסרת רקע מדויקת</p>
                        <p>🔍 Real-ESRGAN — שדרוג רזולוציה</p>
                        <p>💬 Gemini — תיאורי מוצרים שיווקיים</p>
                        <p className="font-medium text-xs text-foreground mt-2">כלים חכמים (ללא AI):</p>
                        <p>✂️ Chromakey — הסרת רקע לפי צבע</p>
                        <p>⚡ Luminance — הסרת רקע לבן</p>
                        <p>🎨 K-Means — חילוץ ערכת צבעים</p>
                        <p>🔧 Auto-Levels — שיפור אוטומטי</p>
                        <p>🖼️ Unsharp Mask — חידוד</p>
                        <p>💡 Drop Shadow — צל אלגוריתמי</p>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* ── Settings Tab ─────────────────────────── */}
              {sideTab === "settings" && (
                <>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">כותרת קטלוג</Label>
                      <Input
                        value={settings.title}
                        onChange={e => updateSetting("title", e.target.value)}
                        className="mt-1"
                        placeholder="קטלוג מוצרים"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">תת-כותרת</Label>
                      <Input
                        value={settings.subtitle || ""}
                        onChange={e => updateSetting("subtitle", e.target.value)}
                        className="mt-1"
                        placeholder="קולקציה חדשה 2025"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">פרטי קשר</Label>
                      <Input
                        value={settings.contactInfo || ""}
                        onChange={e => updateSetting("contactInfo", e.target.value)}
                        className="mt-1"
                        placeholder="info@example.com · 050-1234567"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">סימן מים</Label>
                      <Input
                        value={settings.watermark || ""}
                        onChange={e => updateSetting("watermark", e.target.value)}
                        className="mt-1"
                        placeholder="טקסט סימן מים (אופציונלי)"
                      />
                    </div>

                    <Separator />

                    <Label className="text-xs font-semibold">תצוגת מוצרים</Label>
                    {[
                      { key: "showPrices" as const, label: "הצג מחירים" },
                      { key: "showSku" as const, label: 'הצג מק"ט' },
                      { key: "showDescriptions" as const, label: "הצג תיאורים" },
                      { key: "showPageNumbers" as const, label: "מספרי עמודים" },
                      { key: "showHeader" as const, label: "כותרת עליונה" },
                    ].map(s => (
                      <div key={s.key} className="flex items-center justify-between">
                        <Label className="text-xs">{s.label}</Label>
                        <Switch
                          checked={settings[s.key]}
                          onCheckedChange={v => updateSetting(s.key, v)}
                        />
                      </div>
                    ))}

                    <Separator />

                    <Label className="text-xs font-semibold flex items-center gap-1"><EyeOff className="h-3 w-3" /> נראות אלמנטים (גלובלי)</Label>
                    {([
                      { key: "showImage" as const, label: "תמונת מוצר" },
                      { key: "showName" as const, label: "שם מוצר" },
                      { key: "showDescription" as const, label: "תיאור" },
                      { key: "showPrice" as const, label: "מחיר" },
                      { key: "showSku" as const, label: "מק״ט" },
                      { key: "showBadge" as const, label: "תגית" },
                    ]).map(el => (
                      <div key={el.key} className="flex items-center justify-between">
                        <Label className="text-xs">{el.label}</Label>
                        <Switch
                          checked={settings.globalElementToggle?.[el.key] !== false}
                          onCheckedChange={v => updateSetting("globalElementToggle", {
                            ...settings.globalElementToggle,
                            [el.key]: v,
                          })}
                        />
                      </div>
                    ))}

                    <Separator />

                    <Label className="text-xs font-semibold">עמודים מיוחדים</Label>
                    {[
                      { key: "showToc" as const, label: "תוכן עניינים", desc: "דרוש קטגוריות" },
                      { key: "showCategoryDividers" as const, label: "דפי מפריד לקטגוריות", desc: "" },
                      { key: "showPriceList" as const, label: "עמוד מחירון", desc: "" },
                      { key: "showBackCover" as const, label: "כריכה אחורית", desc: "" },
                    ].map(s => (
                      <div key={s.key} className="flex items-center justify-between">
                        <div>
                          <Label className="text-xs">{s.label}</Label>
                          {s.desc && <p className="text-[10px] text-muted-foreground">{s.desc}</p>}
                        </div>
                        <Switch
                          checked={settings[s.key]}
                          onCheckedChange={v => updateSetting(s.key, v)}
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </aside>

        {/* ── Main Preview Area ────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden bg-muted/10">
          {/* Progress bar during generation */}
          {generating && (
            <div className="px-4 pt-2">
              <Progress value={progress} className="h-1.5" />
              <p className="text-xs text-muted-foreground mt-1 text-center">יוצר קטלוג… {progress}%</p>
            </div>
          )}

          {pages.length === 0 && !generating ? (
            /* Empty state */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-sm space-y-4">
                <div className="w-20 h-20 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
                  <BookOpen className="h-10 w-10 text-primary" />
                </div>
                <h2 className="text-xl font-bold">מחולל קטלוגים מקצועי</h2>
                <p className="text-sm text-muted-foreground">
                  הוסף תמונות מוצרים, בחר תבנית ועיצוב, וצור קטלוג מקצועי.
                  כולל כלי AI להסרת רקע, תיאורים אוטומטיים, ושדרוג תמונות.
                </p>
                <div className="flex gap-2 justify-center">
                  <Button onClick={() => { setSideTab("products"); fileInputRef.current?.click(); }}>
                    <Plus className="h-4 w-4" />
                    הוסף תמונות
                  </Button>
                  <Button variant="outline" onClick={() => setSideTab("ai")}>
                    <Brain className="h-4 w-4" />
                    כלי AI
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* Preview canvas */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Page navigation */}
              {pages.length > 0 && (
                <div className="flex items-center justify-center gap-2 py-2 border-b bg-background/80 backdrop-blur">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={currentPage <= 0}
                    onClick={() => setCurrentPage(p => p - 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <ScrollArea className="max-w-[50vw]">
                    <div className="flex gap-1 px-1">
                      {pages.map((page, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentPage(i)}
                          className={`min-w-[2rem] h-7 px-1.5 rounded text-[10px] font-medium transition-colors whitespace-nowrap ${
                            i === currentPage
                              ? "bg-primary text-primary-foreground"
                              : page.type === "divider" ? "bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200"
                              : page.type === "toc" ? "bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200"
                              : page.type === "price-list" ? "bg-green-100 dark:bg-green-900/30 hover:bg-green-200"
                              : page.type === "back-cover" ? "bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200"
                              : "bg-muted hover:bg-muted-foreground/10"
                          }`}
                        >
                          {pageTypeLabel(page)}
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={currentPage >= pages.length - 1}
                    onClick={() => setCurrentPage(p => p + 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Separator orientation="vertical" className="h-5" />
                  <Button variant="ghost" size="sm" className="h-7" onClick={exportImages}>
                    <ImageIcon className="h-3 w-3" />
                    <span className="text-[10px]">PNG</span>
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7" onClick={exportPDF}>
                    <FileText className="h-3 w-3" />
                    <span className="text-[10px]">PDF</span>
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7" onClick={saveCatalogToGallery} disabled={savingToGallery}>
                    {savingToGallery ? <Loader2 className="h-3 w-3 animate-spin" /> : <Star className="h-3 w-3" />}
                    <span className="text-[10px]">גלריה</span>
                  </Button>
                </div>
              )}

              {/* Canvas display */}
              <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
                {pages[currentPage] && (
                  <motion.img
                    key={currentPage}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2 }}
                    src={pages[currentPage].dataUrl}
                    alt={`Page ${currentPage + 1}`}
                    className="max-h-full max-w-full shadow-2xl rounded-sm"
                    style={{ objectFit: "contain" }}
                  />
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>

      {/* ── Gallery Import Dialog ───────────────────────── */}
      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CloudDownload className="h-5 w-5 text-primary" />
            ייבוא תמונות מהגלריה
          </DialogTitle>
        </DialogHeader>

        {/* Source tabs + toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={galleryTab === "history" ? "default" : "outline"}
              onClick={() => { setGalleryTab("history"); loadGalleryItems("history"); }}
              className="gap-1.5"
            >
              <ImageIcon className="h-3.5 w-3.5" />
              תמונות מעובדות
            </Button>
            <Button
              size="sm"
              variant={galleryTab === "products" ? "default" : "outline"}
              onClick={() => { setGalleryTab("products"); loadGalleryItems("products"); }}
              className="gap-1.5"
            >
              <Star className="h-3.5 w-3.5" />
              גלריית מוצרים
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost" size="icon" className="h-7 w-7"
              onClick={() => setGalleryViewMode(galleryViewMode === "grid" ? "list" : "grid")}
              title={galleryViewMode === "grid" ? "תצוגת רשימה" : "תצוגת רשת"}
            >
              {galleryViewMode === "grid" ? <List className="h-3.5 w-3.5" /> : <Grid3X3 className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost" size="icon" className="h-7 w-7"
              onClick={() => setGallerySortDir(d => d === "desc" ? "asc" : "desc")}
              title={gallerySortDir === "desc" ? "מהישן לחדש" : "מהחדש לישן"}
            >
              {gallerySortDir === "desc" ? <ArrowDownAZ className="h-3.5 w-3.5" /> : <ArrowUpAZ className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost" size="icon" className="h-7 w-7"
              onClick={() => loadGalleryItems(galleryTab)}
              title="רענן"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={gallerySearch}
            onChange={e => setGallerySearch(e.target.value)}
            placeholder="חיפוש לפי שם, תיאור..."
            className="h-8 text-xs pr-8"
          />
        </div>

        {/* Select all + text visibility toggles */}
        {galleryItems.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 px-1">
            <button onClick={selectAllGallery} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Checkbox checked={filteredGalleryItems.length > 0 && filteredGalleryItems.every(i => gallerySelected.has(i.id))} />
              {filteredGalleryItems.every(i => gallerySelected.has(i.id)) && filteredGalleryItems.length > 0 ? "בטל הכל" : `בחר הכל (${filteredGalleryItems.length})`}
            </button>
            <Badge variant="secondary" className="text-xs">
              {gallerySelected.size} נבחרו
            </Badge>
            <Separator orientation="vertical" className="h-4" />
            <span className="text-[10px] text-muted-foreground font-medium">הסתר בייבוא:</span>
            <button
              onClick={() => setGalleryHideText(prev => ({ ...prev, name: !prev.name }))}
              className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                galleryHideText.name ? "bg-destructive/10 border-destructive/30 text-destructive" : "border-border text-muted-foreground hover:border-primary/30"
              }`}
            >
              {galleryHideText.name ? <EyeOffIcon className="h-2.5 w-2.5" /> : <Type className="h-2.5 w-2.5" />}
              שם
            </button>
            <button
              onClick={() => setGalleryHideText(prev => ({ ...prev, description: !prev.description }))}
              className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                galleryHideText.description ? "bg-destructive/10 border-destructive/30 text-destructive" : "border-border text-muted-foreground hover:border-primary/30"
              }`}
            >
              {galleryHideText.description ? <EyeOffIcon className="h-2.5 w-2.5" /> : <FileText className="h-2.5 w-2.5" />}
              תיאור
            </button>
            <button
              onClick={() => setGalleryHideText(prev => ({ ...prev, price: !prev.price }))}
              className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                galleryHideText.price ? "bg-destructive/10 border-destructive/30 text-destructive" : "border-border text-muted-foreground hover:border-primary/30"
              }`}
            >
              {galleryHideText.price ? <EyeOffIcon className="h-2.5 w-2.5" /> : <span className="text-[10px]">₪</span>}
              מחיר
            </button>
            {gallerySelected.size > 0 && (
              <>
                <Separator orientation="vertical" className="h-4" />
                <Button
                  variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-2"
                  onClick={() => {
                    const prefix = prompt("הכנס קידומת לשם (מספור אוטומטי):", "מוצר");
                    if (prefix) bulkRenameGalleryPrefix(prefix);
                  }}
                >
                  <TextCursorInput className="h-2.5 w-2.5" />
                  שינוי שם קבוצתי
                </Button>
              </>
            )}
          </div>
        )}

        {/* Grid / List */}
        <ScrollArea className="flex-1 min-h-0 max-h-[55vh] overflow-y-auto">
          {galleryLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground mr-3">טוען גלריה...</span>
            </div>
          ) : filteredGalleryItems.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Database className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">{gallerySearch ? "אין תוצאות לחיפוש" : "אין תמונות בגלריה זו"}</p>
              <p className="text-xs mt-1">{gallerySearch ? "נסה מילות חיפוש אחרות" : "עבד תמונות בכלי העריכה כדי שיופיעו כאן"}</p>
            </div>
          ) : galleryViewMode === "grid" ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 p-1">
              {filteredGalleryItems.map(item => {
                const isSelected = gallerySelected.has(item.id);
                const isEditing = galleryEditingId === item.id;
                const displayName = getGalleryItemName(item);
                return (
                  <div
                    key={item.id}
                    className={`relative rounded-lg border-2 overflow-hidden transition-all group ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-transparent hover:border-primary/30"
                    }`}
                  >
                    <button
                      onClick={() => toggleGalleryItem(item.id)}
                      className="w-full"
                    >
                      <div className="aspect-square bg-muted">
                        <img
                          src={item.image}
                          alt={displayName}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    </button>
                    <div className="p-1.5 bg-background flex items-center gap-1 min-h-[28px]">
                      {isEditing ? (
                        <Input
                          autoFocus
                          className="h-5 text-[10px] px-1"
                          value={displayName}
                          onChange={e => setGalleryNameEdits(prev => ({ ...prev, [item.id]: e.target.value }))}
                          onBlur={() => setGalleryEditingId(null)}
                          onKeyDown={e => { if (e.key === "Enter") setGalleryEditingId(null); }}
                        />
                      ) : (
                        <>
                          <p className="text-[10px] font-medium truncate flex-1">{displayName}</p>
                          <button
                            onClick={(e) => { e.stopPropagation(); setGalleryEditingId(item.id); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity h-4 w-4 flex items-center justify-center hover:text-primary shrink-0"
                            title="ערוך שם"
                          >
                            <Pencil className="h-2.5 w-2.5" />
                          </button>
                        </>
                      )}
                    </div>
                    {item.price && !isEditing && (
                      <div className="px-1.5 pb-1 bg-background">
                        <p className="text-[10px] text-primary font-bold">{item.price}</p>
                      </div>
                    )}
                    {/* Selection indicator */}
                    <div className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                      isSelected
                        ? "bg-primary text-white"
                        : "bg-black/40 text-white opacity-0 group-hover:opacity-100"
                    }`}>
                      <Check className="h-3 w-3" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* List view */
            <div className="flex flex-col gap-1 p-1">
              {filteredGalleryItems.map(item => {
                const isSelected = gallerySelected.has(item.id);
                const isEditing = galleryEditingId === item.id;
                const displayName = getGalleryItemName(item);
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-2 rounded-lg border-2 p-1.5 transition-all group cursor-pointer ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-transparent hover:border-primary/30 hover:bg-muted/50"
                    }`}
                    onClick={() => toggleGalleryItem(item.id)}
                  >
                    <div className="w-12 h-12 rounded bg-muted shrink-0 overflow-hidden">
                      <img src={item.image} alt={displayName} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <Input
                          autoFocus
                          className="h-6 text-xs px-1"
                          value={displayName}
                          onClick={e => e.stopPropagation()}
                          onChange={e => setGalleryNameEdits(prev => ({ ...prev, [item.id]: e.target.value }))}
                          onBlur={() => setGalleryEditingId(null)}
                          onKeyDown={e => { if (e.key === "Enter") setGalleryEditingId(null); }}
                        />
                      ) : (
                        <p className="text-xs font-medium truncate">{displayName}</p>
                      )}
                      {item.description && <p className="text-[10px] text-muted-foreground truncate">{item.description}</p>}
                    </div>
                    {item.price && <span className="text-xs text-primary font-bold shrink-0">{item.price}</span>}
                    <button
                      onClick={(e) => { e.stopPropagation(); setGalleryEditingId(item.id); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 flex items-center justify-center hover:text-primary shrink-0"
                      title="ערוך שם"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                      isSelected ? "bg-primary text-white" : "border border-muted-foreground/30"
                    }`}>
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="flex gap-2 pt-2 border-t">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mr-auto">
            {(galleryHideText.name || galleryHideText.description || galleryHideText.price) && (
              <span className="flex items-center gap-1 text-amber-600">
                <EyeOffIcon className="h-3 w-3" />
                {[galleryHideText.name && "שם", galleryHideText.description && "תיאור", galleryHideText.price && "מחיר"].filter(Boolean).join(", ")} — יוסתרו
              </span>
            )}
            {Object.keys(galleryNameEdits).length > 0 && (
              <span className="flex items-center gap-1 text-blue-600">
                <Pencil className="h-3 w-3" />
                {Object.keys(galleryNameEdits).length} שמות שונו
              </span>
            )}
          </div>
          <Button variant="outline" onClick={() => setGalleryOpen(false)}>ביטול</Button>
          <Button
            onClick={importSelectedGallery}
            disabled={gallerySelected.size === 0}
            className="gap-1.5"
          >
            <CloudDownload className="h-4 w-4" />
            ייבא {gallerySelected.size > 0 ? `${gallerySelected.size} פריטים` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
