import { useState, useCallback, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Grid2X2, Grid3X3, LayoutDashboard, Rows3, GalleryHorizontalEnd,
  Plus, Download, Trash2, Database, CloudDownload, Check,
  Image as ImageIcon, Wand2, Palette, SunMedium, Contrast, Sparkles,
  Scissors, Eraser, RefreshCw, Type, Frame, Pencil, RotateCw, Bold,
  AlignRight, AlignCenter, AlignLeft, Eye, Layers, Save, FolderOpen,
  BookmarkPlus, Clock, SplitSquareVertical, LayoutGrid, Instagram,
  Columns3, PanelTop, ArrowDownUp, Sparkle, LayoutList, ChevronLeft, ChevronRight,
  FileDown, FilePlus2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  generateCollage, type CollageLayout, type CollageOptions, type CollageTextOverlay, type FrameStyle, type CollageWatermark,
  colorBasedRemoveBg, removeWhiteBg, autoTrimTransparency,
  addDropShadow, extractColorPalette, compositeImages, adjustImage,
  autoEnhance, addVignette, sharpenImage, COLLAGE_FONT_MAP
} from "@/lib/smart-image-tools";
import SplitImageDialog from "@/components/SplitImageDialog";

// ─── Constants ──────────────────────────────────────────────────
const LAYOUT_OPTIONS: { id: CollageLayout; label: string; icon: React.ReactNode; maxImages: number }[] = [
  { id: "grid-2x2", label: "רשת 2×2", icon: <Grid2X2 className="h-5 w-5" />, maxImages: 4 },
  { id: "grid-3x3", label: "רשת 3×3", icon: <Grid3X3 className="h-5 w-5" />, maxImages: 9 },
  { id: "grid-2x3", label: "רשת 2×3", icon: <LayoutGrid className="h-5 w-5" />, maxImages: 6 },
  { id: "grid-3x2", label: "רשת 3×2", icon: <Columns3 className="h-5 w-5" />, maxImages: 6 },
  { id: "grid-4x4", label: "רשת 4×4", icon: <Grid3X3 className="h-5 w-5" />, maxImages: 16 },
  { id: "hero-side", label: "Hero + צד", icon: <LayoutDashboard className="h-5 w-5" />, maxImages: 3 },
  { id: "hero-top", label: "Hero למעלה", icon: <PanelTop className="h-5 w-5" />, maxImages: 4 },
  { id: "strip", label: "סטריפ אופקי", icon: <Rows3 className="h-5 w-5" />, maxImages: 5 },
  { id: "strip-vertical", label: "סטריפ אנכי", icon: <ArrowDownUp className="h-5 w-5" />, maxImages: 5 },
  { id: "masonry", label: "Masonry", icon: <GalleryHorizontalEnd className="h-5 w-5" />, maxImages: 6 },
  { id: "pinterest", label: "Pinterest", icon: <GalleryHorizontalEnd className="h-5 w-5 rotate-90" />, maxImages: 6 },
  { id: "diagonal", label: "אלכסוני", icon: <Sparkle className="h-5 w-5" />, maxImages: 4 },
  { id: "l-shape", label: "צורת L", icon: <LayoutList className="h-5 w-5" />, maxImages: 5 },
  { id: "featured-grid", label: "מודגש + רשת", icon: <LayoutDashboard className="h-5 w-5 rotate-180" />, maxImages: 5 },
];

const SMART_TOOLS = [
  { id: "remove-white-bg", label: "הסר רקע לבן", icon: <Eraser className="h-4 w-4" /> },
  { id: "remove-color-bg", label: "הסר רקע לפי צבע", icon: <Scissors className="h-4 w-4" /> },
  { id: "auto-trim", label: "חיתוך אוטומטי", icon: <Wand2 className="h-4 w-4" /> },
  { id: "drop-shadow", label: "צל תלת-ממדי", icon: <SunMedium className="h-4 w-4" /> },
  { id: "auto-enhance", label: "שיפור אוטומטי", icon: <Sparkles className="h-4 w-4" /> },
  { id: "sharpen", label: "חידוד", icon: <Contrast className="h-4 w-4" /> },
  { id: "vignette", label: "וינייט", icon: <Palette className="h-4 w-4" /> },
];

const FRAME_PRESETS: { id: FrameStyle; label: string; description: string }[] = [
  { id: "none", label: "ללא", description: "ללא מסגרת" },
  { id: "thin-gold", label: "זהב דק", description: "מסגרת זהב אלגנטית" },
  { id: "double-gold", label: "זהב כפול", description: "מסגרת כפולה יוקרתית" },
  { id: "luxury-dark", label: "יוקרה כהה", description: "מסגרת כהה עם פס זהב" },
  { id: "ornate-corners", label: "פינות מעוטרות", description: "פינות דקורטיביות זהובות" },
  { id: "shadow-float", label: "צף עם צל", description: "אפקט צל ריחוף" },
  { id: "neon-glow", label: "ניאון זוהר", description: "מסגרת ניאון מודרנית" },
  { id: "vintage-border", label: "וינטאג׳", description: "מסגרת קלאסית מקווקוות" },
  { id: "marble-edge", label: "שיש זהב", description: "גרדיאנט שיש-זהב" },
];

const FONT_OPTIONS = [
  { id: "hebrew-modern", label: "עברית מודרנית", category: "עברית" },
  { id: "hebrew-classic", label: "עברית קלאסית", category: "עברית" },
  { id: "hebrew-display", label: "עברית דיספליי", category: "עברית" },
  { id: "hebrew-elegant", label: "עברית אלגנטית", category: "עברית" },
  { id: "hebrew-secular", label: "סקולר", category: "עברית" },
  { id: "hebrew-suez", label: "סואץ", category: "עברית" },
  { id: "hebrew-varela", label: "וארלה", category: "עברית" },
  { id: "hebrew-karantina", label: "קרנטינה", category: "עברית" },
  { id: "hebrew-noto", label: "נוטו", category: "עברית" },
  { id: "hebrew-fredoka", label: "פרדוקה", category: "עברית" },
  { id: "hebrew-amatic", label: "אמאטיק", category: "עברית" },
  { id: "luxury", label: "Luxury", category: "אנגלית" },
  { id: "elegant-serif", label: "Elegant Serif", category: "אנגלית" },
  { id: "modern-sans", label: "Modern Sans", category: "אנגלית" },
  { id: "classic-serif", label: "Classic Serif", category: "אנגלית" },
  { id: "bold-display", label: "Bold Display", category: "אנגלית" },
  { id: "display-bebas", label: "Bebas Neue", category: "אנגלית" },
  { id: "display-abril", label: "Abril Fatface", category: "אנגלית" },
  { id: "display-righteous", label: "Righteous", category: "אנגלית" },
  { id: "handwritten", label: "כתב יד", category: "דקורטיבי" },
  { id: "script-satisfy", label: "Satisfy", category: "דקורטיבי" },
  { id: "script-lobster", label: "Lobster", category: "דקורטיבי" },
  { id: "script-pacifico", label: "Pacifico", category: "דקורטיבי" },
  { id: "mono", label: "Mono", category: "אחר" },
];

const TEXT_PRESETS: { label: string; overlay: Partial<CollageTextOverlay> }[] = [
  { label: "כותרת זהב יוקרתית", overlay: { fontSize: 64, fontFamily: "luxury", fontWeight: "bold", color: "#c9a84c", shadow: { color: "rgba(0,0,0,0.5)", blur: 8, offsetX: 2, offsetY: 2 } } },
  { label: "כותרת לבנה עם צל", overlay: { fontSize: 56, fontFamily: "hebrew-display", fontWeight: "bold", color: "#ffffff", shadow: { color: "rgba(0,0,0,0.7)", blur: 12, offsetX: 3, offsetY: 3 } } },
  { label: "טקסט גרדיאנט זהב", overlay: { fontSize: 52, fontFamily: "luxury", fontWeight: "bold", gradient: { from: "#f7d77a", to: "#b8860b", angle: 135 } } },
  { label: "ניאון זוהר", overlay: { fontSize: 48, fontFamily: "modern-sans", fontWeight: "bold", color: "#00f0ff", shadow: { color: "#00f0ff", blur: 20, offsetX: 0, offsetY: 0 } } },
  { label: "קלאסי שחור", overlay: { fontSize: 44, fontFamily: "classic-serif", fontWeight: "normal", color: "#1a1a2e" } },
  { label: "כתב יד אישי", overlay: { fontSize: 40, fontFamily: "handwritten", fontWeight: "normal", color: "#6b4c3b" } },
  { label: "מודרני עם קו חיצוני", overlay: { fontSize: 60, fontFamily: "bold-display", fontWeight: "black", color: "#ffffff", stroke: { color: "#1a1a2e", width: 3 } } },
  { label: "אלגנטי עם סיבוב", overlay: { fontSize: 36, fontFamily: "elegant-serif", fontWeight: "normal", color: "#c9a84c", rotation: -5 } },
  // New presets
  { label: "סקולר כחול חזק", overlay: { fontSize: 58, fontFamily: "hebrew-secular", fontWeight: "bold", color: "#1e3a5f", shadow: { color: "rgba(0,0,0,0.3)", blur: 6, offsetX: 1, offsetY: 2 } } },
  { label: "קרנטינה דרמטית", overlay: { fontSize: 72, fontFamily: "hebrew-karantina", fontWeight: "bold", color: "#e63946", shadow: { color: "rgba(0,0,0,0.6)", blur: 10, offsetX: 3, offsetY: 3 } } },
  { label: "אמאטיק שמח", overlay: { fontSize: 68, fontFamily: "hebrew-amatic", fontWeight: "bold", color: "#ff6b6b" } },
  { label: "פרדוקה ילדותי", overlay: { fontSize: 50, fontFamily: "hebrew-fredoka", fontWeight: "bold", color: "#6c5ce7" } },
  { label: "וארלה נקי", overlay: { fontSize: 42, fontFamily: "hebrew-varela", fontWeight: "normal", color: "#2d3436" } },
  { label: "Bebas סינמטי", overlay: { fontSize: 70, fontFamily: "display-bebas", fontWeight: "bold", color: "#ffffff", stroke: { color: "#000000", width: 2 } } },
  { label: "ורוד גרדיאנט", overlay: { fontSize: 54, fontFamily: "hebrew-fredoka", fontWeight: "bold", gradient: { from: "#ee5a6f", to: "#f0a6ca", angle: 90 } } },
  { label: "ירוק טבעי", overlay: { fontSize: 46, fontFamily: "hebrew-suez", fontWeight: "bold", color: "#2d6a4f", shadow: { color: "rgba(0,0,0,0.3)", blur: 5, offsetX: 1, offsetY: 1 } } },
  { label: "Lobster רומנטי", overlay: { fontSize: 52, fontFamily: "script-lobster", fontWeight: "normal", color: "#d63384" } },
  { label: "זהב על שחור", overlay: { fontSize: 60, fontFamily: "hebrew-suez", fontWeight: "bold", color: "#ffd700", shadow: { color: "#000", blur: 15, offsetX: 0, offsetY: 0 } } },
];

const BG_GRADIENT_PRESETS = [
  { label: "זהב-שחור", from: "#1a1a2e", to: "#c9a84c" },
  { label: "לבן-אפור", from: "#ffffff", to: "#e5e5e5" },
  { label: "כחול עמוק", from: "#0f172a", to: "#1e3a5f" },
  { label: "שקיעה", from: "#ff6b6b", to: "#ffa500" },
  { label: "אלגנט כהה", from: "#1a1a2e", to: "#2d1b4e" },
  { label: "ירוק טבעי", from: "#134e5e", to: "#71b280" },
  { label: "ורוד זהב", from: "#f5e6d3", to: "#e8c7a7" },
  { label: "קרח", from: "#e0eafc", to: "#cfdef3" },
];

type CollageImage = { id: string; src: string; name: string; cellBgColor?: string };

interface CollageTemplate {
  id: string;
  name: string;
  createdAt: number;
  layout: CollageLayout;
  gap: number;
  borderRadius: number;
  bgColor: string;
  canvasHeight: number;
  fitMode: 'contain' | 'cover';
  frameStyle: FrameStyle;
  bgGradientEnabled: boolean;
  bgGradient: { from: string; to: string; angle: number };
  textOverlays: CollageTextOverlay[];
}

const TEMPLATES_STORAGE_KEY = 'collage-templates';

// Built-in smart templates
const BUILTIN_TEMPLATES: CollageTemplate[] = [
  {
    id: 'builtin-luxury-gold', name: '✨ יוקרה זהב', createdAt: 0,
    layout: 'grid-2x2', gap: 16, borderRadius: 12, bgColor: '#1a1a2e', canvasHeight: 1200,
    fitMode: 'contain', frameStyle: 'double-gold', bgGradientEnabled: true,
    bgGradient: { from: '#1a1a2e', to: '#2d1b4e', angle: 135 },
    textOverlays: [{ id: 'b1', text: 'קולקציה חדשה', x: 0.5, y: 0.08, fontSize: 52, fontFamily: 'luxury', fontWeight: 'bold', color: '#c9a84c', align: 'center', opacity: 1, rotation: 0, shadow: { color: 'rgba(0,0,0,0.5)', blur: 8, offsetX: 2, offsetY: 2 } }],
  },
  {
    id: 'builtin-minimal-white', name: '⬜ מינימל לבן', createdAt: 0,
    layout: 'grid-3x2', gap: 24, borderRadius: 0, bgColor: '#ffffff', canvasHeight: 1000,
    fitMode: 'contain', frameStyle: 'none', bgGradientEnabled: false,
    bgGradient: { from: '#fff', to: '#fff', angle: 0 },
    textOverlays: [],
  },
  {
    id: 'builtin-instagram-story', name: '📱 סטורי אינסטגרם', createdAt: 0,
    layout: 'hero-top', gap: 8, borderRadius: 16, bgColor: '#f5f0e8', canvasHeight: 1920,
    fitMode: 'cover', frameStyle: 'shadow-float', bgGradientEnabled: true,
    bgGradient: { from: '#f5e6d3', to: '#e8c7a7', angle: 180 },
    textOverlays: [{ id: 'b2', text: 'NEW IN', x: 0.5, y: 0.04, fontSize: 40, fontFamily: 'display-bebas', fontWeight: 'bold', color: '#1a1a2e', align: 'center', opacity: 1, rotation: 0 }],
  },
  {
    id: 'builtin-dark-cinema', name: '🎬 קולנועי כהה', createdAt: 0,
    layout: 'strip', gap: 4, borderRadius: 0, bgColor: '#000000', canvasHeight: 600,
    fitMode: 'cover', frameStyle: 'none', bgGradientEnabled: false,
    bgGradient: { from: '#000', to: '#000', angle: 0 },
    textOverlays: [{ id: 'b3', text: 'THE COLLECTION', x: 0.5, y: 0.9, fontSize: 48, fontFamily: 'display-bebas', fontWeight: 'bold', color: '#ffffff', align: 'center', opacity: 0.8, rotation: 0 }],
  },
  {
    id: 'builtin-pastel-soft', name: '🌸 פסטל רך', createdAt: 0,
    layout: 'featured-grid', gap: 14, borderRadius: 20, bgColor: '#fce4ec', canvasHeight: 1200,
    fitMode: 'contain', frameStyle: 'shadow-float', bgGradientEnabled: true,
    bgGradient: { from: '#fce4ec', to: '#f3e5f5', angle: 135 },
    textOverlays: [],
  },
  {
    id: 'builtin-neon-night', name: '🌃 ניאון לילי', createdAt: 0,
    layout: 'diagonal', gap: 0, borderRadius: 8, bgColor: '#0a0a1a', canvasHeight: 1200,
    fitMode: 'cover', frameStyle: 'neon-glow', bgGradientEnabled: true,
    bgGradient: { from: '#0a0a1a', to: '#1a0a2e', angle: 135 },
    textOverlays: [{ id: 'b4', text: 'NIGHT EDITION', x: 0.5, y: 0.5, fontSize: 56, fontFamily: 'modern-sans', fontWeight: 'bold', color: '#00f0ff', align: 'center', opacity: 1, rotation: -15, shadow: { color: '#00f0ff', blur: 25, offsetX: 0, offsetY: 0 } }],
  },
  {
    id: 'builtin-vintage-warm', name: '📜 וינטאג׳ חם', createdAt: 0,
    layout: 'l-shape', gap: 10, borderRadius: 4, bgColor: '#f5e6d3', canvasHeight: 1200,
    fitMode: 'contain', frameStyle: 'vintage-border', bgGradientEnabled: false,
    bgGradient: { from: '#f5e6d3', to: '#f5e6d3', angle: 0 },
    textOverlays: [{ id: 'b5', text: 'קלאסיקה', x: 0.5, y: 0.06, fontSize: 44, fontFamily: 'hebrew-suez', fontWeight: 'bold', color: '#6b4c3b', align: 'center', opacity: 1, rotation: 0 }],
  },
  {
    id: 'builtin-kids-fun', name: '🎉 ילדים שמח', createdAt: 0,
    layout: 'grid-2x3', gap: 10, borderRadius: 24, bgColor: '#fff3e0', canvasHeight: 1400,
    fitMode: 'cover', frameStyle: 'none', bgGradientEnabled: true,
    bgGradient: { from: '#fff3e0', to: '#e1f5fe', angle: 135 },
    textOverlays: [{ id: 'b6', text: '!יום הולדת שמח', x: 0.5, y: 0.05, fontSize: 52, fontFamily: 'hebrew-fredoka', fontWeight: 'bold', color: '#6c5ce7', align: 'center', opacity: 1, rotation: -3 }],
  },
  {
    id: 'builtin-marble-lux', name: '💎 שיש יוקרתי', createdAt: 0,
    layout: 'hero-side', gap: 12, borderRadius: 8, bgColor: '#f0ece3', canvasHeight: 1200,
    fitMode: 'contain', frameStyle: 'marble-edge', bgGradientEnabled: false,
    bgGradient: { from: '#f0ece3', to: '#f0ece3', angle: 0 },
    textOverlays: [],
  },
  {
    id: 'builtin-sale-bold', name: '🔥 מבצע בולט', createdAt: 0,
    layout: 'grid-2x2', gap: 6, borderRadius: 0, bgColor: '#e63946', canvasHeight: 1200,
    fitMode: 'cover', frameStyle: 'none', bgGradientEnabled: true,
    bgGradient: { from: '#e63946', to: '#d00000', angle: 180 },
    textOverlays: [
      { id: 'b7', text: 'SALE', x: 0.5, y: 0.5, fontSize: 120, fontFamily: 'display-bebas', fontWeight: 'bold', color: '#ffffff', align: 'center', opacity: 0.15, rotation: -30 },
      { id: 'b8', text: '50% הנחה', x: 0.5, y: 0.92, fontSize: 48, fontFamily: 'hebrew-karantina', fontWeight: 'bold', color: '#ffffff', align: 'center', opacity: 1, rotation: 0 },
    ],
  },
  {
    id: 'builtin-catalog-pro', name: '📋 קטלוג מקצועי', createdAt: 0,
    layout: 'grid-4x4', gap: 2, borderRadius: 0, bgColor: '#f8f9fa', canvasHeight: 1200,
    fitMode: 'contain', frameStyle: 'thin-gold', bgGradientEnabled: false,
    bgGradient: { from: '#f8f9fa', to: '#f8f9fa', angle: 0 },
    textOverlays: [],
  },
  {
    id: 'builtin-nature-green', name: '🌿 טבע ירוק', createdAt: 0,
    layout: 'masonry', gap: 10, borderRadius: 12, bgColor: '#1b4332', canvasHeight: 1200,
    fitMode: 'cover', frameStyle: 'none', bgGradientEnabled: true,
    bgGradient: { from: '#1b4332', to: '#2d6a4f', angle: 135 },
    textOverlays: [],
  },
];

function loadTemplatesFromStorage(): CollageTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveTemplatesToStorage(templates: CollageTemplate[]) {
  localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
}

let _tid = 0;
const newTextId = () => `txt_${Date.now()}_${++_tid}`;

export default function CollageBuilder() {
  // Images
  const [images, setImages] = useState<CollageImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Layout & design
  const [layout, setLayout] = useState<CollageLayout>("grid-2x2");
  const [gap, setGap] = useState(12);
  const [borderRadius, setBorderRadius] = useState(8);
  const [bgColor, setBgColor] = useState("#ffffff");
  const [canvasWidth] = useState(1200);
  const [canvasHeight, setCanvasHeight] = useState(1200);
  const [fitMode, setFitMode] = useState<'contain' | 'cover'>('contain');
  const [frameStyle, setFrameStyle] = useState<FrameStyle>('none');
  const [bgGradientEnabled, setBgGradientEnabled] = useState(false);
  const [bgGradient, setBgGradient] = useState({ from: "#1a1a2e", to: "#c9a84c", angle: 135 });

  // Text overlays
  const [textOverlays, setTextOverlays] = useState<CollageTextOverlay[]>([]);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  // Watermark
  const [watermarkEnabled, setWatermarkEnabled] = useState(false);
  const [watermark, setWatermark] = useState<CollageWatermark>({
    type: 'text',
    text: '',
    position: 'bottom-right',
    opacity: 0.3,
    scale: 0.15,
    fontFamily: 'hebrew-modern',
    fontSize: 36,
    color: '#ffffff',
    rotation: 0,
    repeat: false,
  });
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Result — multi-page
  const [pages, setPages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [processing, setProcessing] = useState(false);
  const result = pages[currentPage] || null;

  // Gallery import
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryTab, setGalleryTab] = useState<"history" | "products">("history");
  const [galleryItems, setGalleryItems] = useState<{ id: string; image: string; name: string }[]>([]);
  const [gallerySelected, setGallerySelected] = useState<Set<string>>(new Set());
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryImportMode, setGalleryImportMode] = useState<'collage' | 'split' | 'logo'>('collage');

  // Smart tool processing
  const [toolProcessing, setToolProcessing] = useState<string | null>(null);

  // Drag reorder
  const dragItemRef = useRef<number | null>(null);
  const dragOverRef = useRef<number | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // Active sidebar tab
  const [sidebarTab, setSidebarTab] = useState("images");

  // Templates
  const [savedTemplates, setSavedTemplates] = useState<CollageTemplate[]>(() => loadTemplatesFromStorage());
  const [templateName, setTemplateName] = useState("");

  // Split image
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const [splitSource, setSplitSource] = useState<string | null>(null);
  const splitFileRef = useRef<HTMLInputElement>(null);

  const editingText = useMemo(() => textOverlays.find(t => t.id === editingTextId) || null, [textOverlays, editingTextId]);

  // ── Template Save/Load ──────────────────────────────────────
  const saveTemplate = useCallback(() => {
    const name = templateName.trim() || `תבנית ${savedTemplates.length + 1}`;
    const template: CollageTemplate = {
      id: `tpl_${Date.now()}`,
      name,
      createdAt: Date.now(),
      layout,
      gap,
      borderRadius,
      bgColor,
      canvasHeight,
      fitMode,
      frameStyle,
      bgGradientEnabled,
      bgGradient,
      textOverlays,
    };
    const updated = [template, ...savedTemplates];
    setSavedTemplates(updated);
    saveTemplatesToStorage(updated);
    setTemplateName("");
    toast.success(`תבנית "${name}" נשמרה בהצלחה`);
  }, [templateName, savedTemplates, layout, gap, borderRadius, bgColor, canvasHeight, fitMode, frameStyle, bgGradientEnabled, bgGradient, textOverlays]);

  const loadTemplate = useCallback((template: CollageTemplate) => {
    setLayout(template.layout);
    setGap(template.gap);
    setBorderRadius(template.borderRadius);
    setBgColor(template.bgColor);
    setCanvasHeight(template.canvasHeight);
    setFitMode(template.fitMode);
    setFrameStyle(template.frameStyle);
    setBgGradientEnabled(template.bgGradientEnabled);
    setBgGradient(template.bgGradient);
    setTextOverlays(template.textOverlays);
    setEditingTextId(null);
    toast.success(`תבנית "${template.name}" נטענה`);
  }, []);

  const deleteTemplate = useCallback((id: string) => {
    const updated = savedTemplates.filter(t => t.id !== id);
    setSavedTemplates(updated);
    saveTemplatesToStorage(updated);
    toast.success("תבנית נמחקה");
  }, [savedTemplates]);

  const exportTemplates = useCallback(() => {
    if (savedTemplates.length === 0) { toast.error("אין תבניות לייצוא"); return; }
    const json = JSON.stringify(savedTemplates, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `collage-templates_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success(`${savedTemplates.length} תבניות יוצאו בהצלחה`);
  }, [savedTemplates]);

  const importTemplates = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target?.result as string) as CollageTemplate[];
        if (!Array.isArray(imported) || imported.length === 0) { toast.error("קובץ לא תקין"); return; }
        const existingIds = new Set(savedTemplates.map(t => t.id));
        const newOnes = imported.filter(t => !existingIds.has(t.id));
        if (newOnes.length === 0) { toast.info("כל התבניות כבר קיימות"); return; }
        const updated = [...newOnes, ...savedTemplates];
        setSavedTemplates(updated);
        saveTemplatesToStorage(updated);
        toast.success(`${newOnes.length} תבניות יובאו בהצלחה`);
      } catch { toast.error("שגיאה בקריאת הקובץ"); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [savedTemplates]);

  // ── Split Image ─────────────────────────────────────────────
  const handleSplitUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setSplitSource(ev.target?.result as string);
      setSplitDialogOpen(true);
    };
    reader.readAsDataURL(file);
    if (splitFileRef.current) splitFileRef.current.value = '';
  }, []);

  const handleSplitComplete = useCallback((parts: string[]) => {
    const newImages: CollageImage[] = parts.map((src, i) => ({
      id: `split_${Date.now()}_${i}`,
      src,
      name: `חלק ${i + 1}`,
    }));
    setImages(prev => [...prev, ...newImages]);
    if (parts.length === 4) setLayout('grid-2x2');
    else if (parts.length === 9) setLayout('grid-3x3');
    setSplitSource(null);
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const src = ev.target?.result as string;
        setImages((prev) => [...prev, { id: `img_${Date.now()}_${Math.random().toString(36).slice(2)}`, src, name: file.name }]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  // ── Gallery Import ──────────────────────────────────────────
  const loadGalleryItems = useCallback(async (tab: "history" | "products") => {
    setGalleryLoading(true);
    try {
      if (tab === "history") {
        const { data } = await supabase.from("processing_history").select("*").order("created_at", { ascending: false });
        setGalleryItems((data || []).map((item) => ({
          id: item.id,
          image: item.result_image_url || item.original_image_url || "",
          name: item.background_name || "תמונה מעובדת",
        })));
      } else {
        const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
        setGalleryItems((data || []).map((item) => ({
          id: item.id,
          image: item.image_url || "",
          name: item.title || "מוצר",
        })));
      }
    } catch {
      toast.error("שגיאה בטעינת גלריה");
    } finally {
      setGalleryLoading(false);
    }
  }, []);

  const openGalleryImport = useCallback((mode: 'collage' | 'split' | 'logo' = 'collage') => {
    setGalleryImportMode(mode);
    setGalleryOpen(true);
    setGallerySelected(new Set());
    loadGalleryItems(galleryTab);
  }, [galleryTab, loadGalleryItems]);

  const importSelected = useCallback(() => {
    const selected = galleryItems.filter((i) => gallerySelected.has(i.id));
    if (selected.length === 0) return;

    if (galleryImportMode === 'split') {
      // Use first selected image as split source
      setSplitSource(selected[0].image);
      setSplitDialogOpen(true);
    } else if (galleryImportMode === 'logo') {
      // Use first selected image as watermark logo
      setWatermark(w => ({ ...w, imageSrc: selected[0].image }));
    } else {
      // Default: add to collage
      const newImages = selected.map((item) => ({
        id: `gallery_${item.id}`,
        src: item.image,
        name: item.name,
      }));
      setImages((prev) => [...prev, ...newImages]);
    }

    setGalleryOpen(false);
    toast.success(
      galleryImportMode === 'split' ? "תמונה נבחרה לפיצול" :
      galleryImportMode === 'logo' ? "לוגו נטען מהגלריה" :
      `${selected.length} תמונות יובאו בהצלחה`
    );
  }, [galleryItems, gallerySelected, galleryImportMode]);

  // ── Smart Tools ─────────────────────────────────────────────
  const applySmartTool = useCallback(async (toolId: string, imageId: string) => {
    const img = images.find((i) => i.id === imageId);
    if (!img) return;
    setToolProcessing(toolId);
    try {
      let newSrc: string | null = null;
      switch (toolId) {
        case "remove-white-bg": newSrc = await removeWhiteBg(img.src); break;
        case "remove-color-bg": newSrc = await colorBasedRemoveBg(img.src); break;
        case "auto-trim": newSrc = await autoTrimTransparency(img.src); break;
        case "drop-shadow": newSrc = await addDropShadow(img.src); break;
        case "auto-enhance": newSrc = await autoEnhance(img.src); break;
        case "sharpen": newSrc = await sharpenImage(img.src); break;
        case "vignette": newSrc = await addVignette(img.src); break;
      }
      if (newSrc) {
        setImages((prev) => prev.map((i) => (i.id === imageId ? { ...i, src: newSrc! } : i)));
        toast.success("הכלי הוחל בהצלחה!");
      }
    } catch {
      toast.error("שגיאה בהפעלת הכלי");
    }
    setToolProcessing(null);
  }, [images]);

  // ── Text Overlay CRUD ───────────────────────────────────────
  const addTextOverlay = useCallback((preset?: Partial<CollageTextOverlay>) => {
    const newOverlay: CollageTextOverlay = {
      id: newTextId(),
      text: preset?.text || "הטקסט שלך",
      x: 0.5,
      y: 0.5,
      fontSize: 48,
      fontFamily: "hebrew-modern",
      fontWeight: "bold",
      color: "#ffffff",
      align: "center",
      opacity: 1,
      rotation: 0,
      ...preset,
    };
    setTextOverlays(prev => [...prev, newOverlay]);
    setEditingTextId(newOverlay.id);
  }, []);

  const updateTextOverlay = useCallback((id: string, updates: Partial<CollageTextOverlay>) => {
    setTextOverlays(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const removeTextOverlay = useCallback((id: string) => {
    setTextOverlays(prev => prev.filter(t => t.id !== id));
    if (editingTextId === id) setEditingTextId(null);
  }, [editingTextId]);

  // ── Generate (multi-page) ─────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (images.length < 1) {
      toast.error("העלה לפחות תמונה אחת");
      return;
    }
    setProcessing(true);
    try {
      const maxPerPage = LAYOUT_OPTIONS.find(l => l.id === layout)?.maxImages || 9;
      const allSrcs = images.map(img => img.src);
      const allCellColors = images.map(img => img.cellBgColor || null);
      const pageCount = Math.ceil(allSrcs.length / maxPerPage);
      const results: string[] = [];

      for (let p = 0; p < pageCount; p++) {
        const pageSrcs = allSrcs.slice(p * maxPerPage, (p + 1) * maxPerPage);
        const pageCellColors = allCellColors.slice(p * maxPerPage, (p + 1) * maxPerPage);
        const collageOptions: CollageOptions = {
          layout,
          width: canvasWidth,
          height: canvasHeight,
          gap,
          bgColor,
          borderRadius,
          fitMode,
          frameStyle,
          textOverlays,
          bgGradient: bgGradientEnabled ? bgGradient : undefined,
          cellBgColors: pageCellColors,
          watermark: watermarkEnabled ? watermark : undefined,
        };
        const dataUrl = await generateCollage(pageSrcs, collageOptions);
        results.push(dataUrl);
      }

      setPages(results);
      setCurrentPage(0);
      toast.success(results.length > 1 ? `${results.length} עמודי קולאז׳ נוצרו!` : "הקולאז׳ נוצר בהצלחה!");
    } catch {
      toast.error("שגיאה ביצירת הקולאז׳");
    }
    setProcessing(false);
  }, [images, layout, canvasWidth, canvasHeight, gap, bgColor, borderRadius, fitMode, frameStyle, textOverlays, bgGradientEnabled, bgGradient, watermarkEnabled, watermark]);

  // ── Download ────────────────────────────────────────────────
  const downloadCollage = useCallback(() => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result;
    a.download = `collage_${pages.length > 1 ? `page${currentPage + 1}_` : ''}${Date.now()}.png`;
    a.click();
  }, [result, pages.length, currentPage]);

  const downloadAllPages = useCallback(() => {
    pages.forEach((page, i) => {
      const a = document.createElement("a");
      a.href = page;
      a.download = `collage_page${i + 1}_${Date.now()}.png`;
      a.click();
    });
  }, [pages]);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">בונה קולאז׳ חכם</h1>
            <p className="text-sm text-muted-foreground">
              קולאז׳ מתקדם עם מסגרות יוקרתיות, טקסט מעוצב וכלים חכמים
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.history.back()}>חזור</Button>
            {result && (
              <Button onClick={downloadCollage}>
                <Download className="h-4 w-4 ml-2" />
                הורד קולאז׳
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
        {/* Sidebar */}
        <ScrollArea className="max-h-[calc(100vh-120px)]">
          <div className="space-y-3 pr-1">
            <Tabs value={sidebarTab} onValueChange={setSidebarTab}>
              <TabsList className="w-full grid grid-cols-5">
                <TabsTrigger value="images" className="text-xs gap-1"><ImageIcon className="h-3.5 w-3.5" />תמונות</TabsTrigger>
                <TabsTrigger value="design" className="text-xs gap-1"><Palette className="h-3.5 w-3.5" />עיצוב</TabsTrigger>
                <TabsTrigger value="frames" className="text-xs gap-1"><Frame className="h-3.5 w-3.5" />מסגרות</TabsTrigger>
                <TabsTrigger value="text" className="text-xs gap-1"><Type className="h-3.5 w-3.5" />טקסט</TabsTrigger>
                <TabsTrigger value="templates" className="text-xs gap-1"><BookmarkPlus className="h-3.5 w-3.5" />תבניות</TabsTrigger>
              </TabsList>

              {/* ─── Images Tab ─── */}
              <TabsContent value="images" className="space-y-3 mt-3">
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <h3 className="font-semibold text-sm">הוסף תמונות</h3>
                    <div className="flex flex-col gap-2">
                      <label className="cursor-pointer">
                        <Button variant="outline" className="w-full" asChild>
                          <span><Plus className="h-4 w-4 ml-2" />העלה מהמחשב</span>
                        </Button>
                        <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileUpload} />
                      </label>
                      <Button variant="outline" className="w-full" onClick={() => openGalleryImport('collage')}>
                        <Database className="h-4 w-4 ml-2" />ייבוא מהגלריה / מהענן
                      </Button>
                      <Button variant="outline" className="w-full" onClick={() => { setSplitSource(null); setSplitDialogOpen(true); }}>
                        <SplitSquareVertical className="h-4 w-4 ml-2" />פיצול תמונה לחלקים
                      </Button>
                    </div>
                    {images.length > 0 && <div className="text-xs text-muted-foreground">{images.length} תמונות נטענו</div>}
                  </CardContent>
                </Card>

                {images.length > 0 && (
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <h3 className="font-semibold text-sm flex items-center justify-between">
                        <span>תמונות ({images.length})</span>
                        <span className="text-[10px] text-muted-foreground font-normal">גרור לשינוי סדר</span>
                      </h3>
                      <ScrollArea className="max-h-[240px]">
                        <div className="grid grid-cols-3 gap-2">
                          {images.map((img, idx) => (
                            <div
                              key={img.id}
                              draggable
                              onDragStart={() => { dragItemRef.current = idx; setDragIdx(idx); }}
                              onDragEnter={() => { dragOverRef.current = idx; }}
                              onDragOver={(e) => e.preventDefault()}
                              onDragEnd={() => {
                                if (dragItemRef.current !== null && dragOverRef.current !== null && dragItemRef.current !== dragOverRef.current) {
                                  setImages(prev => {
                                    const updated = [...prev];
                                    const [dragged] = updated.splice(dragItemRef.current!, 1);
                                    updated.splice(dragOverRef.current!, 0, dragged);
                                    return updated;
                                  });
                                }
                                dragItemRef.current = null;
                                dragOverRef.current = null;
                                setDragIdx(null);
                              }}
                              className={`relative border rounded cursor-grab active:cursor-grabbing overflow-hidden aspect-square transition-all ${
                                selectedImage === img.id ? "ring-2 ring-primary" : ""
                              } ${dragIdx === idx ? "opacity-50 scale-95" : ""}`}
                              onClick={() => setSelectedImage(selectedImage === img.id ? null : img.id)}
                            >
                              <img src={img.src} alt={img.name} className="w-full h-full object-cover pointer-events-none" />
                              <div className="absolute top-0.5 right-0.5 bg-foreground/60 text-background rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold">
                                {idx + 1}
                              </div>
                              <button
                                className="absolute top-0.5 left-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5"
                                onClick={(e) => { e.stopPropagation(); setImages(prev => prev.filter(i => i.id !== img.id)); }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                )}

                {selectedImage && (
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <h3 className="font-semibold text-sm flex items-center gap-2"><Wand2 className="h-4 w-4" />כלים חכמים</h3>
                      <div className="grid grid-cols-1 gap-1.5">
                        {SMART_TOOLS.map((tool) => (
                          <Button key={tool.id} variant="outline" size="sm" className="justify-start text-xs" disabled={toolProcessing !== null} onClick={() => applySmartTool(tool.id, selectedImage)}>
                            {toolProcessing === tool.id ? <RefreshCw className="h-3 w-3 ml-1 animate-spin" /> : <span className="ml-1">{tool.icon}</span>}
                            {tool.label}
                          </Button>
                        ))}
                      </div>
                      {/* Per-cell background color */}
                      <div className="pt-2 border-t space-y-2">
                        <Label className="text-xs flex items-center gap-2">
                          <Palette className="h-3.5 w-3.5" />
                          צבע רקע לתא זה
                        </Label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={images.find(i => i.id === selectedImage)?.cellBgColor || bgColor}
                            onChange={e => setImages(prev => prev.map(i => i.id === selectedImage ? { ...i, cellBgColor: e.target.value } : i))}
                            className="w-10 h-7 rounded border cursor-pointer"
                          />
                          <span className="text-[10px] text-muted-foreground flex-1">
                            {images.find(i => i.id === selectedImage)?.cellBgColor ? 'צבע מותאם' : 'כמו הרקע הכללי'}
                          </span>
                          {images.find(i => i.id === selectedImage)?.cellBgColor && (
                            <Button
                              size="sm" variant="ghost" className="h-6 text-[10px] px-2"
                              onClick={() => setImages(prev => prev.map(i => i.id === selectedImage ? { ...i, cellBgColor: undefined } : i))}
                            >
                              איפוס
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Layout */}
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <h3 className="font-semibold text-sm">לייאאוט</h3>
                    <ScrollArea className="max-h-[280px]">
                      <div className="grid grid-cols-3 gap-1.5">
                        {LAYOUT_OPTIONS.map((opt) => (
                          <Button key={opt.id} variant={layout === opt.id ? "default" : "outline"} size="sm" className="flex-col h-auto py-1.5 text-[9px] gap-0.5" onClick={() => setLayout(opt.id)}>
                            {opt.icon}
                            {opt.label}
                            <span className="text-[8px] opacity-60">עד {opt.maxImages}</span>
                          </Button>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ─── Design Tab ─── */}
              <TabsContent value="design" className="space-y-3 mt-3">
                <Card>
                  <CardContent className="p-4 space-y-4">
                    <h3 className="font-semibold text-sm">עיצוב כללי</h3>
                    <div className="space-y-2">
                      <Label className="text-xs">מרווח: {gap}px</Label>
                      <Slider value={[gap]} onValueChange={([v]) => setGap(v)} min={0} max={40} step={2} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">רדיוס פינות: {borderRadius}px</Label>
                      <Slider value={[borderRadius]} onValueChange={([v]) => setBorderRadius(v)} min={0} max={30} step={2} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">גובה: {canvasHeight}px</Label>
                      <Slider value={[canvasHeight]} onValueChange={([v]) => setCanvasHeight(v)} min={600} max={2400} step={100} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">התאמת תמונה</Label>
                      <div className="flex gap-1">
                        <Button size="sm" variant={fitMode === "contain" ? "default" : "outline"} onClick={() => setFitMode("contain")} className="flex-1 text-xs">התאם (מלא)</Button>
                        <Button size="sm" variant={fitMode === "cover" ? "default" : "outline"} onClick={() => setFitMode("cover")} className="flex-1 text-xs">חיתוך למילוי</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Background */}
                <Card>
                  <CardContent className="p-4 space-y-4">
                    <h3 className="font-semibold text-sm">רקע</h3>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={bgGradientEnabled} onCheckedChange={(v) => setBgGradientEnabled(!!v)} />
                      <Label className="text-xs">גרדיאנט</Label>
                    </div>
                    {bgGradientEnabled ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-4 gap-1.5">
                          {BG_GRADIENT_PRESETS.map((preset, i) => (
                            <button
                              key={i}
                              className={`h-10 rounded-lg border-2 transition-all ${bgGradient.from === preset.from && bgGradient.to === preset.to ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/40'}`}
                              style={{ background: `linear-gradient(135deg, ${preset.from}, ${preset.to})` }}
                              onClick={() => setBgGradient({ from: preset.from, to: preset.to, angle: 135 })}
                              title={preset.label}
                            />
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1 space-y-1">
                            <Label className="text-[10px]">מ-</Label>
                            <input type="color" value={bgGradient.from} onChange={e => setBgGradient(p => ({ ...p, from: e.target.value }))} className="w-full h-7 rounded border cursor-pointer" />
                          </div>
                          <div className="flex-1 space-y-1">
                            <Label className="text-[10px]">ל-</Label>
                            <input type="color" value={bgGradient.to} onChange={e => setBgGradient(p => ({ ...p, to: e.target.value }))} className="w-full h-7 rounded border cursor-pointer" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">זווית: {bgGradient.angle}°</Label>
                          <Slider value={[bgGradient.angle]} onValueChange={([v]) => setBgGradient(p => ({ ...p, angle: v }))} min={0} max={360} step={15} />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label className="text-xs">צבע רקע</Label>
                        <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="w-full h-8 rounded border cursor-pointer" />
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Watermark / Logo */}
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm flex items-center gap-2">
                        <Eye className="h-4 w-4" />לוגו / סימן מים
                      </h3>
                      <Checkbox checked={watermarkEnabled} onCheckedChange={(v) => setWatermarkEnabled(!!v)} />
                    </div>
                    {watermarkEnabled && (
                      <div className="space-y-3">
                        <div className="flex gap-1">
                          <Button size="sm" variant={watermark.type === 'text' ? "default" : "outline"} className="flex-1 text-xs" onClick={() => setWatermark(w => ({ ...w, type: 'text' }))}>
                            <Type className="h-3 w-3 ml-1" />טקסט
                          </Button>
                          <Button size="sm" variant={watermark.type === 'image' ? "default" : "outline"} className="flex-1 text-xs" onClick={() => setWatermark(w => ({ ...w, type: 'image' }))}>
                            <ImageIcon className="h-3 w-3 ml-1" />לוגו
                          </Button>
                        </div>

                        {watermark.type === 'text' ? (
                          <div className="space-y-2">
                            <Input
                              value={watermark.text || ''}
                              onChange={e => setWatermark(w => ({ ...w, text: e.target.value }))}
                              placeholder="טקסט סימן מים..."
                              className="text-sm h-8"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[10px]">צבע</Label>
                                <input type="color" value={watermark.color || '#ffffff'} onChange={e => setWatermark(w => ({ ...w, color: e.target.value }))} className="w-full h-6 rounded border cursor-pointer" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px]">גודל: {watermark.fontSize}px</Label>
                                <Slider value={[watermark.fontSize || 36]} onValueChange={([v]) => setWatermark(w => ({ ...w, fontSize: v }))} min={12} max={120} step={2} />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex gap-1">
                              <label className="cursor-pointer flex-1">
                                <Button variant="outline" size="sm" className="w-full text-xs gap-1" asChild>
                                  <span><Plus className="h-3 w-3" />{watermark.imageSrc ? 'החלף' : 'העלה'}</span>
                                </Button>
                                <input
                                  ref={logoInputRef}
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={e => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const reader = new FileReader();
                                    reader.onload = ev => setWatermark(w => ({ ...w, imageSrc: ev.target?.result as string }));
                                    reader.readAsDataURL(file);
                                  }}
                                />
                              </label>
                              <Button variant="outline" size="sm" className="flex-1 text-xs gap-1" onClick={() => openGalleryImport('logo')}>
                                <Database className="h-3 w-3" />מהגלריה
                              </Button>
                            </div>
                            {watermark.imageSrc && (
                              <div className="flex items-center gap-2">
                                <img src={watermark.imageSrc} alt="logo" className="w-10 h-10 object-contain rounded border bg-muted" />
                                <span className="text-[10px] text-muted-foreground">לוגו נטען</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Common watermark settings */}
                        <div className="space-y-2">
                          <Label className="text-[10px]">מיקום</Label>
                          <Select value={watermark.position} onValueChange={v => setWatermark(w => ({ ...w, position: v as CollageWatermark['position'] }))}>
                            <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="top-right" className="text-xs">למעלה ימין</SelectItem>
                              <SelectItem value="top-left" className="text-xs">למעלה שמאל</SelectItem>
                              <SelectItem value="bottom-right" className="text-xs">למטה ימין</SelectItem>
                              <SelectItem value="bottom-left" className="text-xs">למטה שמאל</SelectItem>
                              <SelectItem value="center" className="text-xs">מרכז</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">שקיפות: {Math.round(watermark.opacity * 100)}%</Label>
                          <Slider value={[watermark.opacity]} onValueChange={([v]) => setWatermark(w => ({ ...w, opacity: v }))} min={0.05} max={1} step={0.05} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">גודל: {Math.round(watermark.scale * 100)}%</Label>
                          <Slider value={[watermark.scale]} onValueChange={([v]) => setWatermark(w => ({ ...w, scale: v }))} min={0.05} max={0.5} step={0.01} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">סיבוב: {watermark.rotation || 0}°</Label>
                          <Slider value={[watermark.rotation || 0]} onValueChange={([v]) => setWatermark(w => ({ ...w, rotation: v }))} min={-45} max={45} step={1} />
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox checked={!!watermark.repeat} onCheckedChange={(v) => setWatermark(w => ({ ...w, repeat: !!v }))} />
                          <Label className="text-[10px]">חזור על פני כל הקולאז' (טקסטורה)</Label>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ─── Frames Tab ─── */}
              <TabsContent value="frames" className="space-y-3 mt-3">
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2"><Frame className="h-4 w-4" />מסגרות יוקרתיות</h3>
                    <div className="grid grid-cols-1 gap-1.5">
                      {FRAME_PRESETS.map((fp) => (
                        <button
                          key={fp.id}
                          className={`flex items-center gap-3 p-2.5 rounded-lg border-2 text-right transition-all ${frameStyle === fp.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}
                          onClick={() => setFrameStyle(fp.id)}
                        >
                          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                            {fp.id === 'none' ? (
                              <span className="text-muted-foreground text-lg">✕</span>
                            ) : fp.id === 'thin-gold' ? (
                              <div className="w-7 h-7 border-2 border-yellow-600 rounded-sm" />
                            ) : fp.id === 'double-gold' ? (
                              <div className="w-7 h-7 border-2 border-yellow-600 rounded-sm p-0.5"><div className="w-full h-full border border-yellow-600 rounded-[1px]" /></div>
                            ) : fp.id === 'luxury-dark' ? (
                              <div className="w-7 h-7 border-[3px] border-foreground rounded-sm relative"><div className="absolute inset-[2px] border border-yellow-600 rounded-[1px]" /></div>
                            ) : fp.id === 'ornate-corners' ? (
                              <div className="w-7 h-7 relative">
                                <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-yellow-600" />
                                <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-yellow-600" />
                                <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-yellow-600" />
                                <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-yellow-600" />
                              </div>
                            ) : fp.id === 'neon-glow' ? (
                              <div className="w-7 h-7 border-2 border-cyan-400 rounded-sm shadow-[0_0_6px_#00f0ff]" />
                            ) : fp.id === 'vintage-border' ? (
                              <div className="w-7 h-7 border-2 border-dashed border-amber-700 rounded-sm" />
                            ) : fp.id === 'shadow-float' ? (
                              <div className="w-6 h-6 bg-card rounded-sm shadow-lg" />
                            ) : (
                              <div className="w-7 h-7 rounded-sm" style={{ border: '2px solid transparent', borderImage: 'linear-gradient(135deg, #e8e0d4, #c9a84c, #e8e0d4) 1' }} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold">{fp.label}</p>
                            <p className="text-[10px] text-muted-foreground">{fp.description}</p>
                          </div>
                          {frameStyle === fp.id && <Check className="h-4 w-4 text-primary shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ─── Text Tab ─── */}
              <TabsContent value="text" className="space-y-3 mt-3">
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm flex items-center gap-2"><Type className="h-4 w-4" />טקסטים</h3>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => addTextOverlay()}>
                        <Plus className="h-3 w-3" />הוסף טקסט
                      </Button>
                    </div>

                    {/* Text presets */}
                    <div className="space-y-1.5">
                      <Label className="text-[10px] text-muted-foreground font-medium">סגנונות מוכנים</Label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {TEXT_PRESETS.map((preset, i) => (
                          <button
                            key={i}
                            className="text-right p-2 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/50 transition-all"
                            onClick={() => addTextOverlay(preset.overlay)}
                          >
                            <p className="text-[10px] font-medium truncate">{preset.label}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Text overlays list */}
                    {textOverlays.length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t">
                        <Label className="text-[10px] text-muted-foreground font-medium">טקסטים פעילים ({textOverlays.length})</Label>
                        {textOverlays.map(overlay => (
                          <div
                            key={overlay.id}
                            className={`flex items-center gap-2 p-2 rounded-lg border-2 cursor-pointer transition-all ${editingTextId === overlay.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}
                            onClick={() => setEditingTextId(editingTextId === overlay.id ? null : overlay.id)}
                          >
                            <Type className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-xs truncate flex-1">{overlay.text}</span>
                            <button onClick={(e) => { e.stopPropagation(); removeTextOverlay(overlay.id); }} className="text-destructive hover:text-destructive/80 shrink-0">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Text editor */}
                {editingText && (
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <h3 className="font-semibold text-xs flex items-center gap-2"><Pencil className="h-3.5 w-3.5" />עריכת טקסט</h3>
                      <Input
                        value={editingText.text}
                        onChange={e => updateTextOverlay(editingText.id, { text: e.target.value })}
                        className="text-sm"
                        placeholder="הטקסט שלך..."
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px]">גופן</Label>
                          <Select value={editingText.fontFamily} onValueChange={v => updateTextOverlay(editingText.id, { fontFamily: v })}>
                            <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                              {['עברית', 'אנגלית', 'דקורטיבי', 'אחר'].map(cat => {
                                const fonts = FONT_OPTIONS.filter(f => f.category === cat);
                                if (fonts.length === 0) return null;
                                return (
                                  <div key={cat}>
                                    <div className="px-2 py-1 text-[9px] font-bold text-muted-foreground uppercase">{cat}</div>
                                    {fonts.map(f => (
                                      <SelectItem key={f.id} value={f.id} className="text-xs">
                                        <span style={{ fontFamily: COLLAGE_FONT_MAP[f.id] || 'inherit' }}>
                                          {f.label}
                                        </span>
                                      </SelectItem>
                                    ))}
                                  </div>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">גודל: {editingText.fontSize}px</Label>
                          <Slider value={[editingText.fontSize]} onValueChange={([v]) => updateTextOverlay(editingText.id, { fontSize: v })} min={12} max={120} step={2} />
                        </div>
                      </div>

                      <div className="flex gap-1">
                        {(['normal', 'bold', 'black'] as const).map(w => (
                          <Button key={w} size="sm" variant={editingText.fontWeight === w ? "default" : "outline"} className="flex-1 text-[10px]" onClick={() => updateTextOverlay(editingText.id, { fontWeight: w })}>
                            {w === 'normal' ? 'רגיל' : w === 'bold' ? 'בולט' : 'כבד'}
                          </Button>
                        ))}
                      </div>

                      <div className="flex gap-1">
                        <Button size="sm" variant={editingText.align === 'right' ? "default" : "outline"} className="flex-1" onClick={() => updateTextOverlay(editingText.id, { align: 'right' })}><AlignRight className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant={editingText.align === 'center' ? "default" : "outline"} className="flex-1" onClick={() => updateTextOverlay(editingText.id, { align: 'center' })}><AlignCenter className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant={editingText.align === 'left' ? "default" : "outline"} className="flex-1" onClick={() => updateTextOverlay(editingText.id, { align: 'left' })}><AlignLeft className="h-3.5 w-3.5" /></Button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px]">צבע</Label>
                          <input type="color" value={editingText.color} onChange={e => updateTextOverlay(editingText.id, { color: e.target.value })} className="w-full h-7 rounded border cursor-pointer" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">שקיפות: {Math.round(editingText.opacity * 100)}%</Label>
                          <Slider value={[editingText.opacity]} onValueChange={([v]) => updateTextOverlay(editingText.id, { opacity: v })} min={0.1} max={1} step={0.05} />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px]">מיקום X: {Math.round(editingText.x * 100)}%</Label>
                          <Slider value={[editingText.x]} onValueChange={([v]) => updateTextOverlay(editingText.id, { x: v })} min={0} max={1} step={0.01} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">מיקום Y: {Math.round(editingText.y * 100)}%</Label>
                          <Slider value={[editingText.y]} onValueChange={([v]) => updateTextOverlay(editingText.id, { y: v })} min={0} max={1} step={0.01} />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px]">סיבוב: {editingText.rotation}°</Label>
                        <Slider value={[editingText.rotation]} onValueChange={([v]) => updateTextOverlay(editingText.id, { rotation: v })} min={-45} max={45} step={1} />
                      </div>

                      {/* Shadow toggle */}
                      <div className="space-y-2 pt-2 border-t">
                        <div className="flex items-center gap-2">
                          <Checkbox checked={!!editingText.shadow} onCheckedChange={(v) => updateTextOverlay(editingText.id, { shadow: v ? { color: "rgba(0,0,0,0.5)", blur: 8, offsetX: 2, offsetY: 2 } : undefined })} />
                          <Label className="text-[10px]">צל טקסט</Label>
                        </div>
                        {editingText.shadow && (
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-[10px]">טשטוש: {editingText.shadow.blur}</Label>
                              <Slider value={[editingText.shadow.blur]} onValueChange={([v]) => updateTextOverlay(editingText.id, { shadow: { ...editingText.shadow!, blur: v } })} min={0} max={30} step={1} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px]">צבע צל</Label>
                              <input type="color" value={editingText.shadow.color.startsWith('rgba') ? '#000000' : editingText.shadow.color} onChange={e => updateTextOverlay(editingText.id, { shadow: { ...editingText.shadow!, color: e.target.value } })} className="w-full h-6 rounded border cursor-pointer" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Stroke toggle */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Checkbox checked={!!editingText.stroke} onCheckedChange={(v) => updateTextOverlay(editingText.id, { stroke: v ? { color: "#1a1a2e", width: 2 } : undefined })} />
                          <Label className="text-[10px]">קו חיצוני (Stroke)</Label>
                        </div>
                        {editingText.stroke && (
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-[10px]">עובי: {editingText.stroke.width}px</Label>
                              <Slider value={[editingText.stroke.width]} onValueChange={([v]) => updateTextOverlay(editingText.id, { stroke: { ...editingText.stroke!, width: v } })} min={1} max={8} step={0.5} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px]">צבע</Label>
                              <input type="color" value={editingText.stroke.color} onChange={e => updateTextOverlay(editingText.id, { stroke: { ...editingText.stroke!, color: e.target.value } })} className="w-full h-6 rounded border cursor-pointer" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Gradient toggle */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Checkbox checked={!!editingText.gradient} onCheckedChange={(v) => updateTextOverlay(editingText.id, { gradient: v ? { from: "#f7d77a", to: "#b8860b", angle: 135 } : undefined })} />
                          <Label className="text-[10px]">גרדיאנט טקסט</Label>
                        </div>
                        {editingText.gradient && (
                          <div className="flex gap-2">
                            <div className="flex-1 space-y-1">
                              <Label className="text-[10px]">מ-</Label>
                              <input type="color" value={editingText.gradient.from} onChange={e => updateTextOverlay(editingText.id, { gradient: { ...editingText.gradient!, from: e.target.value } })} className="w-full h-6 rounded border cursor-pointer" />
                            </div>
                            <div className="flex-1 space-y-1">
                              <Label className="text-[10px]">ל-</Label>
                              <input type="color" value={editingText.gradient.to} onChange={e => updateTextOverlay(editingText.id, { gradient: { ...editingText.gradient!, to: e.target.value } })} className="w-full h-6 rounded border cursor-pointer" />
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* ─── Templates Tab ─── */}
              <TabsContent value="templates" className="space-y-3 mt-3">
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <Save className="h-4 w-4" />שמור תבנית נוכחית
                    </h3>
                    <div className="flex gap-2">
                      <Input
                        value={templateName}
                        onChange={e => setTemplateName(e.target.value)}
                        placeholder="שם התבנית..."
                        className="text-sm h-8"
                        onKeyDown={e => { if (e.key === 'Enter') saveTemplate(); }}
                      />
                      <Button size="sm" className="shrink-0 gap-1" onClick={saveTemplate}>
                        <Save className="h-3.5 w-3.5" />
                        שמור
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      שומר את כל ההגדרות: לייאאוט, מסגרת, צבעים, טקסטים וסגנונות
                    </p>
                    <div className="flex gap-1.5 pt-1 border-t">
                      <Button variant="outline" size="sm" className="flex-1 text-[10px] gap-1" onClick={exportTemplates} disabled={savedTemplates.length === 0}>
                        <FileDown className="h-3 w-3" />ייצוא JSON
                      </Button>
                      <label className="flex-1 cursor-pointer">
                        <Button variant="outline" size="sm" className="w-full text-[10px] gap-1" asChild>
                          <span><FilePlus2 className="h-3 w-3" />ייבוא JSON</span>
                        </Button>
                        <input type="file" accept=".json" className="hidden" onChange={importTemplates} />
                      </label>
                    </div>
                  </CardContent>
                </Card>

                {/* Built-in Smart Templates */}
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />תבניות מוכנות ({BUILTIN_TEMPLATES.length})
                    </h3>
                    <ScrollArea className="max-h-[300px]">
                      <div className="grid grid-cols-2 gap-2">
                        {BUILTIN_TEMPLATES.map(tpl => (
                          <button
                            key={tpl.id}
                            onClick={() => loadTemplate(tpl)}
                            className="border rounded-lg p-2 text-right hover:border-primary/50 hover:bg-accent/30 transition-all space-y-1"
                          >
                            <div className="w-full h-8 rounded" style={{ background: tpl.bgGradientEnabled ? `linear-gradient(${tpl.bgGradient.angle}deg, ${tpl.bgGradient.from}, ${tpl.bgGradient.to})` : tpl.bgColor }} />
                            <p className="text-xs font-semibold truncate">{tpl.name}</p>
                            <div className="flex flex-wrap gap-0.5">
                              <Badge variant="outline" className="text-[8px] px-1 py-0">{LAYOUT_OPTIONS.find(l => l.id === tpl.layout)?.label || tpl.layout}</Badge>
                              {tpl.frameStyle !== 'none' && <Badge variant="outline" className="text-[8px] px-1 py-0">{FRAME_PRESETS.find(f => f.id === tpl.frameStyle)?.label}</Badge>}
                            </div>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 space-y-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <FolderOpen className="h-4 w-4" />תבניות שמורות ({savedTemplates.length})
                    </h3>
                    {savedTemplates.length === 0 ? (
                      <div className="text-center py-6">
                        <BookmarkPlus className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
                        <p className="text-xs text-muted-foreground">אין תבניות שמורות</p>
                        <p className="text-[10px] text-muted-foreground mt-1">הגדר את העיצוב הרצוי ולחץ "שמור"</p>
                      </div>
                    ) : (
                      <ScrollArea className="max-h-[400px]">
                        <div className="space-y-2">
                          {savedTemplates.map(tpl => (
                            <div
                              key={tpl.id}
                              className="border rounded-lg p-3 space-y-2 hover:border-primary/30 transition-all"
                            >
                              <div className="flex items-start justify-between">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold truncate">{tpl.name}</p>
                                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                    <Clock className="h-2.5 w-2.5" />
                                    {new Date(tpl.createdAt).toLocaleDateString('he-IL')}
                                  </p>
                                </div>
                                <button
                                  onClick={() => deleteTemplate(tpl.id)}
                                  className="text-destructive hover:text-destructive/80 shrink-0 p-1"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0">{LAYOUT_OPTIONS.find(l => l.id === tpl.layout)?.label || tpl.layout}</Badge>
                                {tpl.frameStyle !== 'none' && <Badge variant="outline" className="text-[9px] px-1.5 py-0">{FRAME_PRESETS.find(f => f.id === tpl.frameStyle)?.label || tpl.frameStyle}</Badge>}
                                {tpl.textOverlays.length > 0 && <Badge variant="outline" className="text-[9px] px-1.5 py-0">{tpl.textOverlays.length} טקסטים</Badge>}
                                {tpl.bgGradientEnabled && <Badge variant="outline" className="text-[9px] px-1.5 py-0">גרדיאנט</Badge>}
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0">{tpl.fitMode === 'contain' ? 'התאם' : 'חיתוך'}</Badge>
                              </div>
                              <div className="flex gap-1.5">
                                <div className="w-5 h-5 rounded border" style={{ background: tpl.bgGradientEnabled ? `linear-gradient(135deg, ${tpl.bgGradient.from}, ${tpl.bgGradient.to})` : tpl.bgColor }} title="צבע רקע" />
                                {tpl.frameStyle !== 'none' && (
                                  <div className="w-5 h-5 rounded border-2 border-yellow-600" title="מסגרת" />
                                )}
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full text-xs gap-1.5"
                                onClick={() => loadTemplate(tpl)}
                              >
                                <FolderOpen className="h-3.5 w-3.5" />
                                טען תבנית
                              </Button>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Generate Button */}
            {images.length > 0 && (
              <div className="text-xs text-muted-foreground text-center">
                {(() => {
                  const maxPerPage = LAYOUT_OPTIONS.find(l => l.id === layout)?.maxImages || 9;
                  const pageCount = Math.ceil(images.length / maxPerPage);
                  return pageCount > 1 ? `${images.length} תמונות → ${pageCount} עמודים (${maxPerPage} לכל עמוד)` : `${images.length} תמונות`;
                })()}
              </div>
            )}
            <Button className="w-full" size="lg" onClick={handleGenerate} disabled={processing || images.length < 1}>
              {processing ? <RefreshCw className="h-4 w-4 ml-2 animate-spin" /> : <Layers className="h-4 w-4 ml-2" />}
              {processing ? "מייצר..." : "צור קולאז׳"}
            </Button>
          </div>
        </ScrollArea>

        {/* Main Preview */}
        <Card className="min-h-[500px] flex items-center justify-center">
          <CardContent className="p-4 w-full">
            {result ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">תצוגה מקדימה</Badge>
                    {pages.length > 1 && (
                      <Badge variant="outline" className="text-xs">עמוד {currentPage + 1} / {pages.length}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={downloadCollage}><Download className="h-4 w-4 ml-1" />הורד</Button>
                    {pages.length > 1 && (
                      <Button variant="outline" size="sm" onClick={downloadAllPages}><FileDown className="h-4 w-4 ml-1" />הורד הכל</Button>
                    )}
                  </div>
                </div>

                {/* Page navigation */}
                {pages.length > 1 && (
                  <div className="flex items-center justify-center gap-2">
                    <Button size="icon" variant="outline" className="h-8 w-8" disabled={currentPage === 0} onClick={() => setCurrentPage(p => p - 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    {pages.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentPage(i)}
                        className={`w-8 h-8 rounded-md text-xs font-semibold transition-colors ${currentPage === i ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <Button size="icon" variant="outline" className="h-8 w-8" disabled={currentPage === pages.length - 1} onClick={() => setCurrentPage(p => p + 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                <img src={result} alt="Collage preview" className="w-full rounded-lg border shadow-md" />

                {/* Page thumbnails strip */}
                {pages.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {pages.map((page, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentPage(i)}
                        className={`shrink-0 rounded-md border-2 overflow-hidden transition-all ${currentPage === i ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/50'}`}
                      >
                        <img src={page} alt={`עמוד ${i + 1}`} className="w-20 h-20 object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : images.length > 0 ? (
              <div className="text-center space-y-3">
                <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
                  {images.slice(0, 6).map((img) => (
                    <img key={img.id} src={img.src} alt={img.name} className="w-full aspect-square object-cover rounded-lg border" />
                  ))}
                </div>
                <p className="text-muted-foreground text-sm">בחר עיצוב ולחץ "צור קולאז׳"</p>
              </div>
            ) : (
              <div className="text-center space-y-4 py-20">
                <ImageIcon className="h-16 w-16 mx-auto text-muted-foreground/30" />
                <div>
                  <h3 className="text-lg font-medium">בונה קולאז׳ חכם</h3>
                  <p className="text-sm text-muted-foreground mt-1">העלה תמונות או ייבא מהגלריה/מהענן כדי להתחיל</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center text-xs text-muted-foreground">
                  <Badge variant="outline">9 מסגרות יוקרתיות</Badge>
                  <Badge variant="outline">טקסט מעוצב</Badge>
                  <Badge variant="outline">8 סגנונות גרדיאנט</Badge>
                  <Badge variant="outline">25 גופנים</Badge>
                  <Badge variant="outline">כלים חכמים</Badge>
                  <Badge variant="outline">14 לייאאוטים</Badge>
                  <Badge variant="outline">מרובה עמודים</Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gallery Import Dialog */}
      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col" dir="rtl">
          <DialogHeader>
            <DialogTitle>{galleryImportMode === 'split' ? 'בחר תמונה לפיצול' : galleryImportMode === 'logo' ? 'בחר לוגו מהגלריה' : 'ייבוא תמונות מהגלריה / מהענן'}</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 mb-3">
            <Button variant={galleryTab === "history" ? "default" : "outline"} size="sm" onClick={() => { setGalleryTab("history"); loadGalleryItems("history"); }}>תמונות מעובדות</Button>
            <Button variant={galleryTab === "products" ? "default" : "outline"} size="sm" onClick={() => { setGalleryTab("products"); loadGalleryItems("products"); }}>גלריית מוצרים</Button>
          </div>
          {galleryImportMode === 'collage' && (
            <div className="flex items-center gap-2 mb-2">
              <Checkbox
                checked={galleryItems.length > 0 && gallerySelected.size === galleryItems.length}
                onCheckedChange={(checked) => {
                  if (checked) setGallerySelected(new Set(galleryItems.map((i) => i.id)));
                  else setGallerySelected(new Set());
                }}
              />
              <span className="text-sm">בחר הכל ({gallerySelected.size}/{galleryItems.length})</span>
            </div>
          )}
          {(galleryImportMode === 'split' || galleryImportMode === 'logo') && (
            <p className="text-xs text-muted-foreground mb-2">בחר תמונה אחת</p>
          )}
          <ScrollArea className="flex-1 min-h-0 max-h-[55vh] overflow-y-auto">
            {galleryLoading ? (
              <div className="flex items-center justify-center h-full"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : galleryItems.length === 0 ? (
              <div className="text-center text-muted-foreground py-10">אין תמונות</div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 p-1">
                {galleryItems.map((item) => (
                  <div
                    key={item.id}
                    className={`relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${gallerySelected.has(item.id) ? "border-primary ring-2 ring-primary/20" : "border-transparent hover:border-primary/30"}`}
                    onClick={() => {
                      if (galleryImportMode === 'split' || galleryImportMode === 'logo') {
                        // Single selection mode
                        setGallerySelected(new Set([item.id]));
                      } else {
                        setGallerySelected((prev) => { const next = new Set(prev); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; });
                      }
                    }}
                  >
                    <img src={item.image} alt={item.name} className="w-full aspect-square object-cover" loading="lazy" />
                    {gallerySelected.has(item.id) && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center"><Check className="h-6 w-6 text-primary" /></div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-foreground/60 text-background text-[10px] p-1 truncate">{item.name}</div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button disabled={gallerySelected.size === 0} onClick={importSelected}>
              <CloudDownload className="h-4 w-4 ml-2" />
              {galleryImportMode === 'split' ? 'בחר לפיצול' : galleryImportMode === 'logo' ? 'בחר כלוגו' : `ייבא ${gallerySelected.size} תמונות`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Split Image Dialog */}
      <SplitImageDialog
        open={splitDialogOpen}
        onOpenChange={setSplitDialogOpen}
        splitSource={splitSource}
        onSelectSource={() => { setSplitDialogOpen(false); openGalleryImport('split'); }}
        onUploadSource={handleSplitUpload}
        fileInputRef={splitFileRef}
        onSplitComplete={handleSplitComplete}
      />
    </div>
  );
}
