import { useState, useCallback, useMemo, useRef, useEffect } from "react";
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
  FileDown, FilePlus2, X, Film, Maximize2, Target, Hash, Footprints, Square,
  Ratio, Newspaper, RectangleHorizontal, SplitSquareHorizontal, PanelTopClose, GalleryVerticalEnd
} from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import ImageHoverMenu from "@/components/ImageHoverMenu";
import {
  generateCollage, type CollageLayout, type CollageOptions, type CollageTextOverlay, type FrameStyle, type CollageWatermark,
  colorBasedRemoveBg, removeWhiteBg, autoTrimTransparency,
  addDropShadow, extractColorPalette, compositeImages, adjustImage,
  autoEnhance, addVignette, sharpenImage, COLLAGE_FONT_MAP, calcOptimalCanvasHeight
} from "@/lib/smart-image-tools";
import SplitImageDialog from "@/components/SplitImageDialog";

// ─── Page Size Presets ───────────────────────────────────────
type CollagePageSize = "custom" | "A4" | "A3" | "A5" | "ig-post" | "ig-story" | "ig-reel" | "fb-post" | "fb-cover" | "square-hd";

const COLLAGE_PAGE_SIZES: { id: CollagePageSize; label: string; w: number; h: number; category: string }[] = [
  { id: "custom", label: "מותאם אישית", w: 1200, h: 1200, category: "אחר" },
  { id: "A4", label: "A4 עמוד", w: 2480, h: 3508, category: "הדפסה" },
  { id: "A3", label: "A3 פוסטר", w: 3508, h: 4961, category: "הדפסה" },
  { id: "A5", label: "A5 פלייר", w: 1748, h: 2480, category: "הדפסה" },
  { id: "ig-post", label: "IG פוסט", w: 1080, h: 1080, category: "סושיאל" },
  { id: "ig-story", label: "IG סטורי", w: 1080, h: 1920, category: "סושיאל" },
  { id: "ig-reel", label: "IG ריל", w: 1080, h: 1350, category: "סושיאל" },
  { id: "fb-post", label: "FB פוסט", w: 1200, h: 630, category: "סושיאל" },
  { id: "fb-cover", label: "FB כיסוי", w: 1640, h: 624, category: "סושיאל" },
  { id: "square-hd", label: "ריבוע HD", w: 2000, h: 2000, category: "אחר" },
];

// ─── Constants ──────────────────────────────────────────────────
const LAYOUT_OPTIONS: { id: CollageLayout; label: string; icon: React.ReactNode; maxImages: number; category: 'basic' | 'advanced' | 'special' }[] = [
  // ─── Basic ───
  { id: "grid-2x2", label: "רשת 2×2", icon: <Grid2X2 className="h-5 w-5" />, maxImages: 4, category: 'basic' },
  { id: "grid-3x3", label: "רשת 3×3", icon: <Grid3X3 className="h-5 w-5" />, maxImages: 9, category: 'basic' },
  { id: "grid-2x3", label: "רשת 2×3", icon: <LayoutGrid className="h-5 w-5" />, maxImages: 6, category: 'basic' },
  { id: "grid-3x2", label: "רשת 3×2", icon: <Columns3 className="h-5 w-5" />, maxImages: 6, category: 'basic' },
  { id: "grid-4x4", label: "רשת 4×4", icon: <Grid3X3 className="h-5 w-5" />, maxImages: 16, category: 'basic' },
  { id: "hero-side", label: "Hero + צד", icon: <LayoutDashboard className="h-5 w-5" />, maxImages: 3, category: 'basic' },
  { id: "hero-top", label: "Hero למעלה", icon: <PanelTop className="h-5 w-5" />, maxImages: 4, category: 'basic' },
  { id: "strip", label: "סטריפ אופקי", icon: <Rows3 className="h-5 w-5" />, maxImages: 5, category: 'basic' },
  { id: "strip-vertical", label: "סטריפ אנכי", icon: <ArrowDownUp className="h-5 w-5" />, maxImages: 5, category: 'basic' },
  { id: "masonry", label: "Masonry", icon: <GalleryHorizontalEnd className="h-5 w-5" />, maxImages: 6, category: 'basic' },
  { id: "pinterest", label: "Pinterest", icon: <GalleryHorizontalEnd className="h-5 w-5 rotate-90" />, maxImages: 6, category: 'basic' },
  { id: "diagonal", label: "אלכסוני", icon: <Sparkle className="h-5 w-5" />, maxImages: 4, category: 'basic' },
  { id: "l-shape", label: "צורת L", icon: <LayoutList className="h-5 w-5" />, maxImages: 5, category: 'basic' },
  { id: "featured-grid", label: "מודגש + רשת", icon: <LayoutDashboard className="h-5 w-5 rotate-180" />, maxImages: 5, category: 'basic' },
  // ─── Advanced ───
  { id: "t-shape", label: "צורת T", icon: <PanelTopClose className="h-5 w-5" />, maxImages: 4, category: 'advanced' },
  { id: "mosaic", label: "פסיפס", icon: <LayoutGrid className="h-5 w-5 rotate-45" />, maxImages: 5, category: 'advanced' },
  { id: "golden-ratio", label: "יחס הזהב", icon: <Ratio className="h-5 w-5" />, maxImages: 3, category: 'advanced' },
  { id: "magazine", label: "מגזין", icon: <Newspaper className="h-5 w-5" />, maxImages: 4, category: 'advanced' },
  { id: "filmstrip", label: "פילם סטריפ", icon: <Film className="h-5 w-5" />, maxImages: 6, category: 'advanced' },
  { id: "big-small", label: "גדול + קטנים", icon: <Maximize2 className="h-5 w-5" />, maxImages: 5, category: 'advanced' },
  { id: "zigzag", label: "זיגזג", icon: <Footprints className="h-5 w-5" />, maxImages: 5, category: 'advanced' },
  { id: "asymmetric-columns", label: "עמודות אסימטריות", icon: <Columns3 className="h-5 w-5" />, maxImages: 5, category: 'advanced' },
  { id: "triple-hero", label: "טריפל Hero", icon: <LayoutDashboard className="h-5 w-5" />, maxImages: 3, category: 'advanced' },
  { id: "quad-focus", label: "פוקוס 4", icon: <Grid2X2 className="h-5 w-5" />, maxImages: 4, category: 'advanced' },
  { id: "cross", label: "צלב", icon: <Plus className="h-5 w-5" />, maxImages: 5, category: 'advanced' },
  // ─── Special ───
  { id: "panoramic-stack", label: "פנורמי", icon: <RectangleHorizontal className="h-5 w-5" />, maxImages: 3, category: 'special' },
  { id: "focus-center", label: "מוקד מרכזי", icon: <Target className="h-5 w-5" />, maxImages: 5, category: 'special' },
  { id: "checkerboard", label: "שחמט", icon: <Hash className="h-5 w-5" />, maxImages: 5, category: 'special' },
  { id: "staircase", label: "מדרגות", icon: <GalleryVerticalEnd className="h-5 w-5" />, maxImages: 4, category: 'special' },
  { id: "frame-in-frame", label: "מסגרת במסגרת", icon: <Square className="h-5 w-5" />, maxImages: 2, category: 'special' },
  { id: "split-thirds", label: "חלוקת שלישים", icon: <SplitSquareHorizontal className="h-5 w-5" />, maxImages: 4, category: 'special' },
  { id: "diamond", label: "יהלום", icon: <Sparkle className="h-5 w-5 rotate-45" />, maxImages: 5, category: 'special' },
  { id: "spiral", label: "ספירלה", icon: <RefreshCw className="h-5 w-5" />, maxImages: 6, category: 'special' },
  { id: "ring", label: "טבעת", icon: <SplitSquareVertical className="h-5 w-5" />, maxImages: 6, category: 'special' },
  { id: "center-strip", label: "סטריפ מרכזי", icon: <Rows3 className="h-5 w-5" />, maxImages: 5, category: 'special' },
  { id: "offset-grid", label: "רשת מוזחת", icon: <LayoutGrid className="h-5 w-5" />, maxImages: 6, category: 'special' },
];

const LAYOUT_CATEGORY_LABELS: Record<string, string> = {
  basic: 'בסיסי',
  advanced: 'מתקדם',
  special: 'מיוחד',
};

type ComparePreviewItem = {
  layout: CollageLayout;
  label: string;
  pageIndex: number;
  totalPages: number;
  dataUrl: string;
  beforeDataUrl: string;
};

type CompareDialogSnapshot = {
  id: string;
  name: string;
  selectedLayouts: CollageLayout[];
  activeLayout: CollageLayout | null;
  activePage: number;
  zoom: number;
  split: number;
  beforeAfterEnabled: boolean;
};

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

const TEXTURE_PRESETS: { id: 'none' | 'paper' | 'linen' | 'noise' | 'grain'; label: string }[] = [
  { id: 'none', label: 'ללא' },
  { id: 'paper', label: 'נייר' },
  { id: 'linen', label: 'פשתן' },
  { id: 'noise', label: 'רעש' },
  { id: 'grain', label: 'גרעיניות' },
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
  fitMode: 'contain' | 'cover' | 'smart-pad';
  frameStyle: FrameStyle;
  bgGradientEnabled: boolean;
  bgGradient: { from: string; to: string; angle: number };
  textOverlays: CollageTextOverlay[];
  imageScale?: number;
  frameInset?: number;
  pagePadding?: number;
  textureStyle?: 'none' | 'paper' | 'linen' | 'noise' | 'grain';
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
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  // Images
  const [images, setImages] = useState<CollageImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Layout & design
  const [layout, setLayout] = useState<CollageLayout>("grid-2x2");
  const [layoutCategoryFilter, setLayoutCategoryFilter] = useState<'all' | 'basic' | 'advanced' | 'special'>('all');
  const [gap, setGap] = useState(12);
  const [borderRadius, setBorderRadius] = useState(8);
  const [bgColor, setBgColor] = useState("#ffffff");
  const [canvasWidth, setCanvasWidth] = useState(1200);
  const [canvasHeight, setCanvasHeight] = useState(1200);
  const [lockAspectRatio, setLockAspectRatio] = useState(true);
  const [customAspectRatio, setCustomAspectRatio] = useState(1);
  const [selectedPageSize, setSelectedPageSize] = useState<CollagePageSize>("custom");
  const [fitMode, setFitMode] = useState<'contain' | 'cover' | 'smart-pad'>('contain');
  const [imageScale, setImageScale] = useState(1);
  const [frameInset, setFrameInset] = useState(0);
  const [pagePadding, setPagePadding] = useState(0);
  const [textureStyle, setTextureStyle] = useState<'none' | 'paper' | 'linen' | 'noise' | 'grain'>('none');
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
  const [pageReferenceIndex, setPageReferenceIndex] = useState(0);
  const [processing, setProcessing] = useState(false);
  const result = pages[currentPage] || null;
  const [autoFitProcessing, setAutoFitProcessing] = useState(false);
  const currentLayoutMaxImages = useMemo(() => LAYOUT_OPTIONS.find((l) => l.id === layout)?.maxImages || 9, [layout]);

  const estimatedPageCount = useMemo(
    () => Math.ceil(images.length / currentLayoutMaxImages),
    [images.length, currentLayoutMaxImages]
  );

  const safeReferencePageIndex = useMemo(
    () => Math.max(0, Math.min(pageReferenceIndex, Math.max(estimatedPageCount - 1, 0))),
    [pageReferenceIndex, estimatedPageCount]
  );

  const activePageForMapping = result ? currentPage : safeReferencePageIndex;
  const activePageStart = activePageForMapping * currentLayoutMaxImages;
  const activePageEnd = Math.min(activePageStart + currentLayoutMaxImages, images.length);
  const activePageImages = useMemo(
    () => images.slice(activePageStart, activePageEnd),
    [images, activePageStart, activePageEnd]
  );

  const pagePreviewCols = useMemo(() => {
    if (activePageImages.length <= 1) return 1;
    if (activePageImages.length <= 4) return 2;
    return 3;
  }, [activePageImages.length]);

  const estimateColsForLayout = useCallback((layoutId: CollageLayout) => {
    switch (layoutId) {
      case 'grid-2x2': return 2;
      case 'grid-3x3': return 3;
      case 'grid-2x3': return 2;
      case 'grid-3x2': return 3;
      case 'grid-4x4': return 4;
      case 'pinterest': return 2;
      case 'strip': return 5;
      case 'featured-grid': return 2;
      default: return 3;
    }
  }, []);

  const clampValue = useCallback((value: number, min: number, max: number) => {
    return Math.max(min, Math.min(max, value));
  }, []);

  const handleCanvasWidthChange = useCallback((nextWidth: number) => {
    setCanvasWidth(nextWidth);
    if (!lockAspectRatio) return;
    const ratio = customAspectRatio > 0 ? customAspectRatio : (canvasWidth / Math.max(canvasHeight, 1));
    const nextHeight = clampValue(Math.round(nextWidth / ratio), 600, 5000);
    setCanvasHeight(nextHeight);
  }, [lockAspectRatio, customAspectRatio, canvasWidth, canvasHeight, clampValue]);

  const handleCanvasHeightChange = useCallback((nextHeight: number) => {
    setCanvasHeight(nextHeight);
    if (!lockAspectRatio) return;
    const ratio = customAspectRatio > 0 ? customAspectRatio : (canvasWidth / Math.max(canvasHeight, 1));
    const nextWidth = clampValue(Math.round(nextHeight * ratio), 600, 4000);
    setCanvasWidth(nextWidth);
  }, [lockAspectRatio, customAspectRatio, canvasWidth, canvasHeight, clampValue]);

  const applyPagePreset = useCallback((size: { id: CollagePageSize; w: number; h: number }) => {
    setSelectedPageSize(size.id);
    setCanvasWidth(size.w);
    setCanvasHeight(size.h);
    setCustomAspectRatio(size.w / size.h);
    setPageReferenceIndex(0);
  }, []);

  const getTexturePreviewStyle = useCallback((style: 'none' | 'paper' | 'linen' | 'noise' | 'grain') => {
    switch (style) {
      case 'paper':
        return {
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.25) 0.6px, transparent 0.6px)',
          backgroundSize: '6px 6px',
        };
      case 'linen':
        return {
          backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.12), rgba(255,255,255,0.12) 1px, transparent 1px, transparent 6px), repeating-linear-gradient(90deg, rgba(255,255,255,0.07), rgba(255,255,255,0.07) 1px, transparent 1px, transparent 8px)',
        };
      case 'noise':
        return {
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.16) 0.5px, rgba(0,0,0,0) 0.5px)',
          backgroundSize: '4px 4px',
        };
      case 'grain':
        return {
          backgroundImage: 'radial-gradient(rgba(0,0,0,0.08) 0.5px, transparent 0.5px)',
          backgroundSize: '3px 3px',
        };
      default:
        return {};
    }
  }, []);

  const applyAutoFitToPage = useCallback(async () => {
    if (images.length === 0) {
      toast.error('אין תמונות להתאמה');
      return;
    }

    setAutoFitProcessing(true);
    try {
      const sample = images.slice(0, Math.min(images.length, 16));
      const dimensions = await Promise.all(sample.map((img) =>
        new Promise<{ width: number; height: number }>((resolve, reject) => {
          const imageEl = new Image();
          imageEl.onload = () => resolve({ width: imageEl.naturalWidth || imageEl.width, height: imageEl.naturalHeight || imageEl.height });
          imageEl.onerror = reject;
          imageEl.src = img.src;
        })
      ));

      const cols = estimateColsForLayout(layout);
      const optimalHeight = calcOptimalCanvasHeight(dimensions, canvasWidth, cols, gap);
      const clampedHeight = Math.max(600, Math.min(5000, Math.round(optimalHeight / 10) * 10));

      const avgAspect = dimensions.reduce((sum, d) => sum + (d.width / Math.max(d.height, 1)), 0) / dimensions.length;
      const nextCanvasAspect = canvasWidth / Math.max(clampedHeight, 1);
      const aspectDelta = Math.abs(avgAspect - nextCanvasAspect) / Math.max(nextCanvasAspect, 0.01);
      const denseLayout = currentLayoutMaxImages >= 9 || images.length > 8;
      const heroLayout = ['hero-side', 'hero-top', 'triple-hero', 'focus-center', 'featured-grid'].includes(layout);

      const recommendedFit: 'contain' | 'cover' | 'smart-pad' = heroLayout
        ? 'cover'
        : aspectDelta > 0.28
          ? 'smart-pad'
          : denseLayout
            ? 'contain'
            : 'smart-pad';

      const recommendedScale = clampValue(
        heroLayout ? 1.12 : denseLayout ? 0.94 : aspectDelta > 0.4 ? 0.9 : 1,
        0.7,
        1.6,
      );
      const recommendedInset = clampValue(
        denseLayout ? Math.round(Math.max(4, gap * 0.6)) : Math.round(Math.max(2, gap * 0.35)),
        0,
        40,
      );
      const recommendedPadding = clampValue(
        Math.round(denseLayout ? clampedHeight * 0.02 : clampedHeight * 0.012),
        0,
        120,
      );

      setSelectedPageSize('custom');
      setCanvasHeight(clampedHeight);
      setCustomAspectRatio(canvasWidth / Math.max(clampedHeight, 1));
      setFitMode(recommendedFit);
      setImageScale(recommendedScale);
      setFrameInset(recommendedInset);
      setPagePadding(recommendedPadding);

      toast.success(
        `Auto-Fit Pro: ${canvasWidth}×${clampedHeight}, מצב ${recommendedFit === 'cover' ? 'מילוי' : recommendedFit === 'contain' ? 'ללא חיתוך' : 'חכם'}, זום ${Math.round(recommendedScale * 100)}%`
      );
    } catch {
      toast.error('לא הצלחנו לנתח את התמונות להתאמה אוטומטית');
    }
    setAutoFitProcessing(false);
  }, [images, layout, canvasWidth, gap, estimateColsForLayout, currentLayoutMaxImages, clampValue]);

  // Comparison preview dialog
  const [compareItems, setCompareItems] = useState<ComparePreviewItem[]>([]);
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [compareSelectedLayouts, setCompareSelectedLayouts] = useState<CollageLayout[]>([
    'grid-2x2',
    'hero-top',
    'masonry',
    'featured-grid',
  ]);
  const [activeCompareLayout, setActiveCompareLayout] = useState<CollageLayout | null>(null);
  const [activeComparePage, setActiveComparePage] = useState(0);
  const [compareProcessing, setCompareProcessing] = useState(false);
  const [compareZoom, setCompareZoom] = useState(1);
  const [comparePan, setComparePan] = useState({ x: 0, y: 0 });
  const [comparePanning, setComparePanning] = useState(false);
  const [compareBeforeAfterEnabled, setCompareBeforeAfterEnabled] = useState(false);
  const [compareSplit, setCompareSplit] = useState(50);
  const [compareUndoStack, setCompareUndoStack] = useState<CompareDialogSnapshot[]>([]);
  const [compareRedoStack, setCompareRedoStack] = useState<CompareDialogSnapshot[]>([]);
  const [compareSavedSnapshots, setCompareSavedSnapshots] = useState<CompareDialogSnapshot[]>([]);
  const comparePanStartRef = useRef<{ x: number; y: number } | null>(null);
  const [imageDimensions, setImageDimensions] = useState<Record<string, { width: number; height: number }>>({});

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
  const transferredImageHandledRef = useRef(false);

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

  useEffect(() => {
    if (transferredImageHandledRef.current) return;
    const stateImage = (location.state as { importImage?: string } | null)?.importImage;
    const importKey = searchParams.get("importKey");
    const keyImage = importKey ? sessionStorage.getItem(importKey) : null;
    const incomingImage = stateImage || keyImage;
    if (!incomingImage) return;

    transferredImageHandledRef.current = true;
    const imported: CollageImage = {
      id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      src: incomingImage,
      name: "תמונה מהעורך",
    };

    setImages((prev) => {
      if (prev.some((img) => img.src === incomingImage)) return prev;
      return [imported, ...prev];
    });
    setSelectedImage(imported.id);
    toast.success("התמונה הועברה לקולאז׳");
    if (importKey) sessionStorage.removeItem(importKey);
  }, [location.state, searchParams]);

  useEffect(() => {
    let cancelled = false;
    const unresolved = images.filter((img) => !imageDimensions[img.id]);
    if (unresolved.length === 0) return;

    (async () => {
      const loaded = await Promise.all(unresolved.map((img) => (
        new Promise<{ id: string; width: number; height: number } | null>((resolve) => {
          const imageEl = new Image();
          imageEl.onload = () => resolve({
            id: img.id,
            width: imageEl.naturalWidth || imageEl.width,
            height: imageEl.naturalHeight || imageEl.height,
          });
          imageEl.onerror = () => resolve(null);
          imageEl.src = img.src;
        })
      )));

      if (cancelled) return;
      const next: Record<string, { width: number; height: number }> = {};
      loaded.forEach((entry) => {
        if (entry) next[entry.id] = { width: entry.width, height: entry.height };
      });

      if (Object.keys(next).length > 0) {
        setImageDimensions((prev) => ({ ...prev, ...next }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [images, imageDimensions]);

  const realTimeWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (images.length === 0) return warnings;

    if (fitMode === 'cover' && imageScale > 1.08) {
      warnings.push('יתכן חיתוך אגרסיבי: מצב "מילוי" יחד עם זום גבוה.');
    }
    if (pagePadding >= 80) {
      warnings.push('ריפוד דף גבוה מאוד. חלק גדול מהקנבס יישאר כרקע.');
    }
    if (frameInset >= 28 && gap >= 18) {
      warnings.push('Inset + רווח גדולים יחד עלולים לצופף את התמונה בתוך התאים.');
    }

    const measured = images
      .map((img) => imageDimensions[img.id])
      .filter((d): d is { width: number; height: number } => !!d);
    if (measured.length > 0) {
      const minPixels = Math.min(...measured.map((d) => d.width * d.height));
      const canvasPixels = canvasWidth * canvasHeight;
      if (canvasPixels > minPixels * 1.35) {
        warnings.push('איכות: לפחות תמונה אחת קטנה יחסית לגודל הקנבס, יתכן ריכוך ביצוא.');
      }
    }

    if (compareSelectedLayouts.length >= 9) {
      warnings.push('נבחרו הרבה לייאאוטים להשוואה. יצירת התצוגה עשויה לקחת יותר זמן.');
    }

    return warnings;
  }, [images, fitMode, imageScale, pagePadding, frameInset, gap, imageDimensions, canvasWidth, canvasHeight, compareSelectedLayouts.length]);

  const resetCompareView = useCallback(() => {
    setCompareZoom(1);
    setComparePan({ x: 0, y: 0 });
    setComparePanning(false);
    comparePanStartRef.current = null;
  }, []);

  const handleCompareWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    setCompareZoom((prev) => Math.max(0.6, Math.min(3, +(prev + delta).toFixed(2))));
  }, []);

  const handleCompareMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (compareZoom <= 1) return;
    setComparePanning(true);
    comparePanStartRef.current = {
      x: e.clientX - comparePan.x,
      y: e.clientY - comparePan.y,
    };
  }, [compareZoom, comparePan.x, comparePan.y]);

  const handleCompareMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!comparePanning || !comparePanStartRef.current) return;
    setComparePan({
      x: e.clientX - comparePanStartRef.current.x,
      y: e.clientY - comparePanStartRef.current.y,
    });
  }, [comparePanning]);

  const stopComparePanning = useCallback(() => {
    setComparePanning(false);
    comparePanStartRef.current = null;
  }, []);

  const captureCompareSnapshot = useCallback((name = 'מצב השוואה'): CompareDialogSnapshot => ({
    id: `cmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    selectedLayouts: [...compareSelectedLayouts],
    activeLayout: activeCompareLayout,
    activePage: activeComparePage,
    zoom: compareZoom,
    split: compareSplit,
    beforeAfterEnabled: compareBeforeAfterEnabled,
  }), [compareSelectedLayouts, activeCompareLayout, activeComparePage, compareZoom, compareSplit, compareBeforeAfterEnabled]);

  const applyCompareSnapshot = useCallback((snapshot: CompareDialogSnapshot) => {
    setCompareSelectedLayouts(snapshot.selectedLayouts);
    setActiveCompareLayout(snapshot.activeLayout);
    setActiveComparePage(snapshot.activePage);
    setCompareZoom(snapshot.zoom);
    setCompareSplit(snapshot.split);
    setCompareBeforeAfterEnabled(snapshot.beforeAfterEnabled);
    setComparePan({ x: 0, y: 0 });
  }, []);

  const recordCompareSnapshot = useCallback(() => {
    const snapshot = captureCompareSnapshot('היסטוריה');
    setCompareUndoStack((prev) => {
      const next = [...prev, snapshot];
      return next.length > 40 ? next.slice(next.length - 40) : next;
    });
    setCompareRedoStack([]);
  }, [captureCompareSnapshot]);

  const saveNamedCompareSnapshot = useCallback(() => {
    const layoutLabel = activeCompareLayout
      ? (LAYOUT_OPTIONS.find((l) => l.id === activeCompareLayout)?.label || activeCompareLayout)
      : 'כללי';
    const snapshot = captureCompareSnapshot(`${layoutLabel} · עמוד ${activeComparePage + 1}`);
    setCompareSavedSnapshots((prev) => {
      const next = [snapshot, ...prev];
      return next.length > 8 ? next.slice(0, 8) : next;
    });
    toast.success('Snapshot נשמר לדיאלוג ההשוואה');
  }, [captureCompareSnapshot, activeCompareLayout, activeComparePage]);

  const loadSavedCompareSnapshot = useCallback((snapshotId: string) => {
    const target = compareSavedSnapshots.find((s) => s.id === snapshotId);
    if (!target) return;
    recordCompareSnapshot();
    applyCompareSnapshot(target);
    toast.success(`נטען: ${target.name}`);
  }, [compareSavedSnapshots, recordCompareSnapshot, applyCompareSnapshot]);

  const deleteSavedCompareSnapshot = useCallback((snapshotId: string) => {
    setCompareSavedSnapshots((prev) => prev.filter((s) => s.id !== snapshotId));
  }, []);

  const handleCompareUndo = useCallback(() => {
    setCompareUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const previous = prev[prev.length - 1];
      setCompareRedoStack((redo) => {
        const current = captureCompareSnapshot();
        const nextRedo = [...redo, current];
        return nextRedo.length > 40 ? nextRedo.slice(nextRedo.length - 40) : nextRedo;
      });
      applyCompareSnapshot(previous);
      return prev.slice(0, -1);
    });
  }, [captureCompareSnapshot, applyCompareSnapshot]);

  const handleCompareRedo = useCallback(() => {
    setCompareRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const next = prev[prev.length - 1];
      setCompareUndoStack((undo) => {
        const current = captureCompareSnapshot();
        const nextUndo = [...undo, current];
        return nextUndo.length > 40 ? nextUndo.slice(nextUndo.length - 40) : nextUndo;
      });
      applyCompareSnapshot(next);
      return prev.slice(0, -1);
    });
  }, [captureCompareSnapshot, applyCompareSnapshot]);

  useEffect(() => {
    if (!compareDialogOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      if (!isCtrl) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleCompareUndo();
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        handleCompareRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [compareDialogOpen, handleCompareUndo, handleCompareRedo]);

  useEffect(() => {
    resetCompareView();
  }, [activeCompareLayout, activeComparePage, compareItems, resetCompareView]);

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
      imageScale,
      frameInset,
      pagePadding,
      textureStyle,
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
  }, [templateName, savedTemplates, layout, gap, borderRadius, bgColor, canvasHeight, fitMode, imageScale, frameInset, pagePadding, textureStyle, frameStyle, bgGradientEnabled, bgGradient, textOverlays]);

  const loadTemplate = useCallback((template: CollageTemplate) => {
    setLayout(template.layout);
    setGap(template.gap);
    setBorderRadius(template.borderRadius);
    setBgColor(template.bgColor);
    setCanvasHeight(template.canvasHeight);
    setFitMode(template.fitMode);
    setImageScale(template.imageScale ?? 1);
    setFrameInset(template.frameInset ?? 0);
    setPagePadding(template.pagePadding ?? 0);
    setTextureStyle(template.textureStyle ?? 'none');
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
          textureStyle,
          imageScale,
          frameInset,
          pagePadding,
        };
        const dataUrl = await generateCollage(pageSrcs, collageOptions);
        results.push(dataUrl);
      }

      setPages(results);
      setCurrentPage(0);
      setPageReferenceIndex(0);
      toast.success(results.length > 1 ? `${results.length} עמודי קולאז׳ נוצרו!` : "הקולאז׳ נוצר בהצלחה!");
    } catch {
      toast.error("שגיאה ביצירת הקולאז׳");
    }
    setProcessing(false);
  }, [images, layout, canvasWidth, canvasHeight, gap, bgColor, borderRadius, fitMode, frameStyle, textOverlays, bgGradientEnabled, bgGradient, watermarkEnabled, watermark, textureStyle, imageScale, frameInset, pagePadding]);

  const toggleCompareLayout = useCallback((layoutId: CollageLayout) => {
    recordCompareSnapshot();
    setCompareSelectedLayouts((prev) => {
      if (prev.includes(layoutId)) return prev.filter((id) => id !== layoutId);
      if (prev.length >= 12) {
        toast.error('אפשר לבחור עד 12 לייאאוטים להשוואה');
        return prev;
      }
      return [...prev, layoutId];
    });
  }, [recordCompareSnapshot]);

  const compareLayoutsWithResults = useMemo(
    () => compareSelectedLayouts.filter((layoutId) => compareItems.some((item) => item.layout === layoutId)),
    [compareSelectedLayouts, compareItems]
  );

  const activeLayoutItems = useMemo(
    () => (activeCompareLayout ? compareItems.filter((item) => item.layout === activeCompareLayout) : []),
    [compareItems, activeCompareLayout]
  );

  const activeCompareItem = activeLayoutItems[activeComparePage] || null;
  const activeCompareLayoutMaxImages = useMemo(
    () => (activeCompareLayout ? (LAYOUT_OPTIONS.find((l) => l.id === activeCompareLayout)?.maxImages || 9) : 9),
    [activeCompareLayout]
  );
  const comparePageStart = activeComparePage * activeCompareLayoutMaxImages;
  const comparePageEnd = Math.min(comparePageStart + activeCompareLayoutMaxImages, images.length);
  const comparePageImages = useMemo(
    () => images.slice(comparePageStart, comparePageEnd),
    [images, comparePageStart, comparePageEnd]
  );

  // ── Compare Layouts ─────────────────────────────────────────
  const handleCompareLayouts = useCallback(async () => {
    if (images.length < 1) {
      toast.error("העלה לפחות תמונה אחת");
      return;
    }
    if (compareSelectedLayouts.length < 1) {
      toast.error("בחר לפחות לייאאוט אחד להשוואה");
      return;
    }

    setCompareProcessing(true);
    setCompareDialogOpen(true);
    try {
      const allSrcs = images.map((img) => img.src);
      const allCellColors = images.map((img) => img.cellBgColor || null);
      const selectedLayoutDefs = LAYOUT_OPTIONS.filter((l) => compareSelectedLayouts.includes(l.id));
      const previewItems: ComparePreviewItem[] = [];
      const previewWidth = 900;
      const previewHeight = Math.max(540, Math.round((canvasHeight / canvasWidth) * previewWidth));

      for (const lo of selectedLayoutDefs) {
        const pageCount = Math.ceil(allSrcs.length / lo.maxImages);
        for (let p = 0; p < pageCount; p++) {
          const pageSrcs = allSrcs.slice(p * lo.maxImages, (p + 1) * lo.maxImages);
          const pageCellColors = allCellColors.slice(p * lo.maxImages, (p + 1) * lo.maxImages);

          const collageOptions: CollageOptions = {
            layout: lo.id,
            width: previewWidth,
            height: previewHeight,
            gap,
            bgColor,
            borderRadius,
            fitMode,
            frameStyle,
            textOverlays,
            bgGradient: bgGradientEnabled ? bgGradient : undefined,
            cellBgColors: pageCellColors,
            watermark: watermarkEnabled ? watermark : undefined,
            textureStyle,
            imageScale,
            frameInset,
            pagePadding,
          };

          const beforeOptions: CollageOptions = {
            layout: lo.id,
            width: previewWidth,
            height: previewHeight,
            gap,
            bgColor,
            borderRadius,
            fitMode: 'contain',
            frameStyle: 'none',
            textOverlays: [],
            cellBgColors: pageCellColors,
            textureStyle: 'none',
            imageScale: 1,
            frameInset: 0,
            pagePadding: 0,
          };

          try {
            const [dataUrl, beforeDataUrl] = await Promise.all([
              generateCollage(pageSrcs, collageOptions),
              generateCollage(pageSrcs, beforeOptions),
            ]);
            previewItems.push({
              layout: lo.id,
              label: lo.label,
              pageIndex: p,
              totalPages: pageCount,
              dataUrl,
              beforeDataUrl,
            });
          } catch {
            // Skip failed preview per layout page
          }
        }
      }

      setCompareItems(previewItems);
      const firstLayout = selectedLayoutDefs.find((l) => previewItems.some((item) => item.layout === l.id))?.id ?? null;
      setActiveCompareLayout(firstLayout);
      setActiveComparePage(0);
      setCompareUndoStack([]);
      setCompareRedoStack([]);
      setCompareSavedSnapshots([]);

      if (previewItems.length === 0) toast.error("לא הצלחנו ליצור תצוגות מקדימות");
    } catch {
      toast.error("שגיאה ביצירת תצוגות מקדימות");
    }
    setCompareProcessing(false);
  }, [images, compareSelectedLayouts, canvasWidth, canvasHeight, gap, bgColor, borderRadius, fitMode, frameStyle, textOverlays, bgGradientEnabled, bgGradient, watermarkEnabled, watermark, textureStyle, imageScale, frameInset, pagePadding]);

  const selectCompareLayout = useCallback((selectedLayout: CollageLayout) => {
    setLayout(selectedLayout);
    setCompareDialogOpen(false);
    toast.success("הלייאאוט נבחר! לחץ 'צור קולאז׳' ליצירה באיכות מלאה");
  }, []);


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

  // ── Save to Gallery ─────────────────────────────────────────
  const [savingToGallery, setSavingToGallery] = useState(false);

  const saveToGallery = useCallback(async () => {
    if (!result) return;
    setSavingToGallery(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("יש להתחבר כדי לשמור לגלריה");
        setSavingToGallery(false);
        return;
      }
      const ts = Date.now();
      const blob = await fetch(result).then(r => r.blob());
      const path = `${user.id}/${ts}_collage.png`;
      const { error: uploadError } = await supabase.storage.from("processed-images").upload(path, blob, { contentType: "image/png" });
      if (uploadError) throw uploadError;
      const publicUrl = supabase.storage.from("processed-images").getPublicUrl(path).data.publicUrl;

      // Use first image as "original"
      const origSrc = images[0]?.src || result;
      let origUrl = publicUrl;
      if (origSrc.startsWith('data:')) {
        const origBlob = await fetch(origSrc).then(r => r.blob());
        const origPath = `${user.id}/${ts}_collage_orig.png`;
        const { error: origErr } = await supabase.storage.from("processed-images").upload(origPath, origBlob, { contentType: "image/png" });
        if (!origErr) origUrl = supabase.storage.from("processed-images").getPublicUrl(origPath).data.publicUrl;
      }

      const layoutLabel = LAYOUT_OPTIONS.find(l => l.id === layout)?.label || layout;
      await supabase.from("processing_history").insert({
        user_id: user.id,
        original_image_url: origUrl,
        result_image_url: publicUrl,
        background_prompt: `קולאז׳ — ${layoutLabel} — ${images.length} תמונות`,
        background_name: `קולאז׳ ${layoutLabel}`,
      });

      toast.success("הקולאז׳ נשמר בגלריה!");
    } catch (err) {
      toast.error("שגיאה בשמירה לגלריה");
      console.error(err);
    } finally {
      setSavingToGallery(false);
    }
  }, [result, images, layout]);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">בונה קולאז׳ חכם</h1>
            <p className="text-sm text-muted-foreground">
              קולאז׳ מתקדם עם מסגרות יוקרתיות, טקסט מעוצב וכלים חכמים
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => window.history.back()}>חזור</Button>
            {result && (
              <>
                <Button variant="outline" onClick={saveToGallery} disabled={savingToGallery}>
                  {savingToGallery ? <RefreshCw className="h-4 w-4 ml-2 animate-spin" /> : <Save className="h-4 w-4 ml-2" />}
                  שמור לגלריה
                </Button>
                <Button onClick={downloadCollage}>
                  <Download className="h-4 w-4 ml-2" />
                  הורד קולאז׳
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
        {/* Sidebar */}
        <ScrollArea className="max-h-[50vh] sm:max-h-[calc(100vh-120px)]">
          <div className="space-y-3 pr-1">
            <Tabs value={sidebarTab} onValueChange={setSidebarTab}>
              <TabsList className="w-full grid grid-cols-5">
                <TabsTrigger value="images" className="text-[10px] sm:text-xs gap-1"><ImageIcon className="h-3.5 w-3.5" /><span className="hidden sm:inline">תמונות</span></TabsTrigger>
                <TabsTrigger value="design" className="text-[10px] sm:text-xs gap-1"><Palette className="h-3.5 w-3.5" /><span className="hidden sm:inline">עיצוב</span></TabsTrigger>
                <TabsTrigger value="frames" className="text-[10px] sm:text-xs gap-1"><Frame className="h-3.5 w-3.5" /><span className="hidden sm:inline">מסגרות</span></TabsTrigger>
                <TabsTrigger value="text" className="text-[10px] sm:text-xs gap-1"><Type className="h-3.5 w-3.5" /><span className="hidden sm:inline">טקסט</span></TabsTrigger>
                <TabsTrigger value="templates" className="text-[10px] sm:text-xs gap-1"><BookmarkPlus className="h-3.5 w-3.5" /><span className="hidden sm:inline">תבניות</span></TabsTrigger>
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
                            (() => {
                              const isOnCurrentPage = idx >= activePageStart && idx < activePageEnd;
                              return (
                            <ImageHoverMenu
                              key={img.id}
                              imageUrl={img.src}
                              hoverDelay={800}
                              className={`relative border rounded aspect-square transition-all ${
                                selectedImage === img.id ? "ring-2 ring-primary" : ""
                              } ${isOnCurrentPage ? "border-primary/70 bg-primary/5" : ""} ${dragIdx === idx ? "opacity-50 scale-95" : ""}`}
                              actions={{
                                onZoom: () => setSelectedImage(img.id),
                                onEdit: () => navigate(`/tool?editImage=${encodeURIComponent(img.src)}`),
                                onDelete: () => setImages(prev => prev.filter(i => i.id !== img.id)),
                                onCatalog: () => navigate(`/catalog?importImage=${encodeURIComponent(img.src)}`),
                                onDownload: () => {
                                  const link = document.createElement("a");
                                  link.href = img.src;
                                  link.download = img.name || "image.png";
                                  link.click();
                                },
                              }}
                            >
                              <div
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
                                className="w-full h-full cursor-grab active:cursor-grabbing overflow-hidden"
                                onClick={() => setSelectedImage(selectedImage === img.id ? null : img.id)}
                              >
                                <img src={img.src} alt={img.name} className="w-full h-full object-cover pointer-events-none" />
                                <div className="absolute top-0.5 right-0.5 bg-foreground/60 text-background rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold">
                                  {idx + 1}
                                </div>
                                {isOnCurrentPage && (
                                  <div className="absolute bottom-0.5 right-0.5 bg-primary text-primary-foreground rounded px-1 py-0.5 text-[8px] font-semibold">
                                    עמוד {activePageForMapping + 1}
                                  </div>
                                )}
                                <button
                                  className="absolute top-0.5 left-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5"
                                  onClick={(e) => { e.stopPropagation(); setImages(prev => prev.filter(i => i.id !== img.id)); }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </ImageHoverMenu>
                              );
                            })()
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
                    <div className="grid grid-cols-4 gap-1">
                      <Button size="sm" variant={layoutCategoryFilter === 'all' ? 'default' : 'outline'} className="text-[10px] h-7" onClick={() => setLayoutCategoryFilter('all')}>הכול</Button>
                      <Button size="sm" variant={layoutCategoryFilter === 'basic' ? 'default' : 'outline'} className="text-[10px] h-7" onClick={() => setLayoutCategoryFilter('basic')}>בסיסי</Button>
                      <Button size="sm" variant={layoutCategoryFilter === 'advanced' ? 'default' : 'outline'} className="text-[10px] h-7" onClick={() => setLayoutCategoryFilter('advanced')}>מתקדם</Button>
                      <Button size="sm" variant={layoutCategoryFilter === 'special' ? 'default' : 'outline'} className="text-[10px] h-7" onClick={() => setLayoutCategoryFilter('special')}>מיוחד</Button>
                    </div>
                    <ScrollArea className="max-h-[520px]">
                      {(['basic', 'advanced', 'special'] as const)
                        .filter((cat) => layoutCategoryFilter === 'all' || layoutCategoryFilter === cat)
                        .map((cat) => {
                          const catLayouts = LAYOUT_OPTIONS.filter(l => l.category === cat);
                          if (catLayouts.length === 0) return null;
                          return (
                            <div key={cat} className="mb-3">
                              <h4 className="text-[11px] font-bold text-muted-foreground mb-1.5 border-b pb-1">
                                {LAYOUT_CATEGORY_LABELS[cat]} ({catLayouts.length})
                              </h4>
                              <div className="grid grid-cols-3 gap-1.5 pt-1">
                                {catLayouts.map((opt) => (
                                  <Button key={opt.id} variant={layout === opt.id ? "default" : "outline"} size="sm" className="flex-col h-auto py-1.5 text-[9px] gap-0.5" onClick={() => setLayout(opt.id)}>
                                    {opt.icon}
                                    {opt.label}
                                    <span className="text-[8px] opacity-60">עד {opt.maxImages}</span>
                                  </Button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
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
                    {/* Page size selector */}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">📐 גודל דף / קנבס</Label>
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap gap-1">
                          {COLLAGE_PAGE_SIZES.filter(p => p.category === "הדפסה").map(p => (
                            <Button key={p.id} size="sm" variant={selectedPageSize === p.id ? "default" : "outline"}
                              onClick={() => applyPagePreset(p)}
                              className="text-[10px] px-2 h-7"
                            >{p.label}</Button>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {COLLAGE_PAGE_SIZES.filter(p => p.category === "סושיאל").map(p => (
                            <Button key={p.id} size="sm" variant={selectedPageSize === p.id ? "default" : "outline"}
                              onClick={() => applyPagePreset(p)}
                              className="text-[10px] px-2 h-7"
                            >{p.label}</Button>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {COLLAGE_PAGE_SIZES.filter(p => p.category === "אחר").map(p => (
                            <Button key={p.id} size="sm" variant={selectedPageSize === p.id ? "default" : "outline"}
                              onClick={() => {
                                if (p.id === "custom") {
                                  setSelectedPageSize("custom");
                                  setCustomAspectRatio(canvasWidth / Math.max(canvasHeight, 1));
                                  setPageReferenceIndex(0);
                                } else {
                                  applyPagePreset(p);
                                }
                              }}
                              className="text-[10px] px-2 h-7"
                            >{p.label}</Button>
                          ))}
                        </div>
                      </div>
                      {selectedPageSize === "custom" && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between rounded-md border p-2 bg-muted/20">
                            <div>
                              <p className="text-[10px] font-medium">נעילת יחס רוחב/גובה</p>
                              <p className="text-[10px] text-muted-foreground">יחס נוכחי: {canvasWidth}:{canvasHeight}</p>
                            </div>
                            <Checkbox
                              checked={lockAspectRatio}
                              onCheckedChange={(checked) => {
                                const enabled = !!checked;
                                setLockAspectRatio(enabled);
                                if (enabled) setCustomAspectRatio(canvasWidth / Math.max(canvasHeight, 1));
                              }}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-[10px]">רוחב: {canvasWidth}px</Label>
                              <Slider value={[canvasWidth]} onValueChange={([v]) => handleCanvasWidthChange(v)} min={600} max={4000} step={100} />
                            </div>
                            <div>
                              <Label className="text-[10px]">גובה: {canvasHeight}px</Label>
                              <Slider value={[canvasHeight]} onValueChange={([v]) => handleCanvasHeightChange(v)} min={600} max={5000} step={100} />
                            </div>
                          </div>
                        </div>
                      )}
                      {selectedPageSize !== "custom" && (
                        <p className="text-[10px] text-muted-foreground">{canvasWidth}×{canvasHeight}px</p>
                      )}
                      {images.length > 0 && (
                        <div className="rounded-md border bg-muted/30 p-2 space-y-2">
                          <p className="text-[10px] font-medium">התאמה לתמונות: {images.length} תמונות | {estimatedPageCount} דפים צפויים</p>
                          <p className="text-[10px] text-muted-foreground">עמוד פעיל: תמונות {activePageStart + 1}-{activePageEnd} מתוך {images.length}</p>
                          {estimatedPageCount > 1 && (
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-6 w-6"
                                disabled={safeReferencePageIndex === 0}
                                onClick={() => setPageReferenceIndex((p) => Math.max(0, p - 1))}
                              >
                                <ChevronRight className="h-3 w-3" />
                              </Button>
                              <Badge variant="outline" className="text-[10px]">ייחוס עמוד {safeReferencePageIndex + 1} / {estimatedPageCount}</Badge>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-6 w-6"
                                disabled={safeReferencePageIndex >= estimatedPageCount - 1}
                                onClick={() => setPageReferenceIndex((p) => Math.min(estimatedPageCount - 1, p + 1))}
                              >
                                <ChevronLeft className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs">התאמת תמונה</Label>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-[10px] h-7 border-gold/35 hover:border-gold/55"
                          onClick={applyAutoFitToPage}
                          disabled={autoFitProcessing || images.length === 0}
                        >
                          {autoFitProcessing ? <RefreshCw className="h-3 w-3 ml-1 animate-spin" /> : <Sparkles className="h-3 w-3 ml-1" />}
                          Auto-Fit Pro
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        <Button size="sm" variant={fitMode === "contain" ? "default" : "outline"} onClick={() => setFitMode("contain")} className="text-xs">ללא חיתוך</Button>
                        <Button size="sm" variant={fitMode === "cover" ? "default" : "outline"} onClick={() => setFitMode("cover")} className="text-xs">מילוי (חיתוך)</Button>
                        <Button size="sm" variant={fitMode === "smart-pad" ? "default" : "outline"} onClick={() => setFitMode("smart-pad")} className="text-xs">חכם</Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        מצב נוכחי: {fitMode === 'contain' ? 'ללא חיתוך - יתכנו שוליים' : fitMode === 'cover' ? 'מילוי מלא - יתכן חיתוך' : 'חכם - שומר תוכן ומאזן שוליים'}
                      </p>
                      {realTimeWarnings.length > 0 && (
                        <div className="rounded-md border border-amber-500/25 bg-amber-500/5 p-2 space-y-1">
                          <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">התראות חכמות</p>
                          <ul className="space-y-1">
                            {realTimeWarnings.map((warning) => (
                              <li key={warning} className="text-[10px] text-amber-700/90 dark:text-amber-200/90">• {warning}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="space-y-1">
                        <Label className="text-[10px]">ידית תמונה: {Math.round(imageScale * 100)}%</Label>
                        <Slider value={[imageScale]} onValueChange={([v]) => setImageScale(v)} min={0.7} max={1.6} step={0.05} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">ידית מסגרת/תא: {frameInset}px</Label>
                        <Slider value={[frameInset]} onValueChange={([v]) => setFrameInset(v)} min={0} max={40} step={1} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">ידית התאמה לדף: {pagePadding}px</Label>
                        <Slider value={[pagePadding]} onValueChange={([v]) => setPagePadding(v)} min={0} max={120} step={2} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">טקסטורת רקע (מקדימה + יצירה)</Label>
                        <div className="grid grid-cols-5 gap-1">
                          {TEXTURE_PRESETS.map((tx) => (
                            <Button
                              key={tx.id}
                              size="sm"
                              variant={textureStyle === tx.id ? 'default' : 'outline'}
                              className="text-[10px] h-7 px-1"
                              onClick={() => setTextureStyle(tx.id)}
                            >
                              {tx.label}
                            </Button>
                          ))}
                        </div>
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
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px]" onClick={() => setWatermark(w => ({ ...w, imageSrc: undefined }))}>
                                  הסר
                                </Button>
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
            <div className="flex gap-2">
              <Button className="flex-1" size="lg" onClick={handleGenerate} disabled={processing || compareProcessing || images.length < 1}>
                {processing ? <RefreshCw className="h-4 w-4 ml-2 animate-spin" /> : <Layers className="h-4 w-4 ml-2" />}
                {processing ? "מייצר..." : "צור קולאז׳"}
              </Button>
              <Button variant="outline" size="lg" onClick={handleCompareLayouts} disabled={processing || compareProcessing || images.length < 1} title="השוואת לייאאוטים">
                {compareProcessing ? <RefreshCw className="h-4 w-4 ml-2 animate-spin" /> : <Eye className="h-4 w-4 ml-2" />}
                {compareProcessing ? "טוען..." : "השווה"}
              </Button>
            </div>
          </div>
        </ScrollArea>

        {/* Main Preview */}
        <Card className="min-h-[500px] flex items-center justify-center">
          <CardContent className="p-4 w-full">
            {compareProcessing ? (
              <div className="text-center space-y-4 py-20">
                <RefreshCw className="h-12 w-12 mx-auto text-primary animate-spin" />
                <p className="text-muted-foreground">מייצר תצוגות מקדימות...</p>
              </div>
            ) : result ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">תצוגה מקדימה</Badge>
                    {pages.length > 1 && (
                      <Badge variant="outline" className="text-xs">עמוד {currentPage + 1} / {pages.length}</Badge>
                    )}
                    {images.length > 0 && (
                      <Badge variant="outline" className="text-xs">תמונות {activePageStart + 1}-{activePageEnd} מתוך {images.length}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={saveToGallery} disabled={savingToGallery}>
                      {savingToGallery ? <RefreshCw className="h-4 w-4 ml-1 animate-spin" /> : <Save className="h-4 w-4 ml-1" />}
                      שמור לגלריה
                    </Button>
                    <Button variant="outline" size="sm" onClick={downloadCollage}><Download className="h-4 w-4 ml-1" />הורד</Button>
                    {pages.length > 1 && (
                      <Button variant="outline" size="sm" onClick={downloadAllPages}><FileDown className="h-4 w-4 ml-1" />הורד הכל</Button>
                    )}
                  </div>
                </div>

                {/* Page navigation */}
                {pages.length > 1 && (
                  <div className="flex items-center justify-center gap-2">
                    <Button size="icon" variant="outline" className="h-8 w-8" disabled={currentPage === 0} onClick={() => { setCurrentPage(p => p - 1); setPageReferenceIndex(p => Math.max(0, p - 1)); }}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    {pages.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => { setCurrentPage(i); setPageReferenceIndex(i); }}
                        className={`w-8 h-8 rounded-md text-xs font-semibold transition-colors ${currentPage === i ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <Button size="icon" variant="outline" className="h-8 w-8" disabled={currentPage === pages.length - 1} onClick={() => { setCurrentPage(p => p + 1); setPageReferenceIndex(p => Math.min(Math.max(pages.length - 1, 0), p + 1)); }}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                <img src={result} alt="Collage preview" className="w-full rounded-lg border shadow-md" />

                {activePageImages.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">תמונות מקור בעמוד הנוכחי</p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {activePageImages.map((img, idx) => (
                        <div key={`${img.id}_${idx}`} className="shrink-0">
                          <img src={img.src} alt={img.name} className="w-14 h-14 object-cover rounded-md border" />
                          <p className="text-[10px] text-center text-muted-foreground mt-1">#{activePageStart + idx + 1}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Page thumbnails strip */}
                {pages.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {pages.map((page, i) => (
                      <button
                        key={i}
                        onClick={() => { setCurrentPage(i); setPageReferenceIndex(i); }}
                        className={`shrink-0 rounded-md border-2 overflow-hidden transition-all ${currentPage === i ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/50'}`}
                      >
                        <img src={page} alt={`עמוד ${i + 1}`} className="w-20 h-20 object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : images.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <Badge variant="secondary">תצוגת דף מקדימה (לפני יצירה)</Badge>
                  <Badge variant="outline" className="text-xs">עמוד {safeReferencePageIndex + 1} / {Math.max(estimatedPageCount, 1)}</Badge>
                </div>

                <div className="mx-auto w-full max-w-3xl">
                  <div
                    className="relative mx-auto rounded-lg border-2 border-dashed bg-muted/20 p-3"
                    style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}`, ...getTexturePreviewStyle(textureStyle) }}
                  >
                    <div className={`grid gap-2 h-full`} style={{ gridTemplateColumns: `repeat(${pagePreviewCols}, minmax(0, 1fr))`, padding: `${pagePadding / 2}px` }}>
                      {activePageImages.length > 0 ? (
                        activePageImages.map((img, idx) => (
                          <div key={`${img.id}_${idx}`} className="relative rounded-md border bg-background/70 overflow-hidden" style={{ padding: `${frameInset / 3}px` }}>
                            <img
                              src={img.src}
                              alt={img.name}
                              className={`w-full h-full ${fitMode === 'cover' ? 'object-cover' : 'object-contain'} ${fitMode === 'smart-pad' ? 'bg-muted/40 p-1' : ''}`}
                              style={{ transform: `scale(${imageScale})`, transformOrigin: 'center center' }}
                            />
                            <div className="absolute top-1 right-1 bg-foreground/70 text-background rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">
                              {activePageStart + idx + 1}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-full h-full flex items-center justify-center text-xs text-muted-foreground">
                          אין תמונות להצגה בעמוד הזה
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-muted-foreground text-sm text-center">תצוגת מודל לפי דף/קנבס נוכחי. לחץ "צור קולאז׳" כדי לייצר תוצאה מלאה.</p>
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
                  <Badge variant="outline">{LAYOUT_OPTIONS.length} לייאאוטים</Badge>
                  <Badge variant="outline">מרובה עמודים</Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Compare Dialog */}
      <Dialog open={compareDialogOpen} onOpenChange={setCompareDialogOpen} modal={false}>
        <DialogContent
          className="max-w-[96vw] xl:max-w-7xl h-auto max-h-[92vh] flex flex-col overflow-hidden p-0 border-gold/30 bg-gradient-to-b from-background via-background to-secondary/20 shadow-2xl"
          dir="rtl"
          onEscapeKeyDown={() => setCompareDialogOpen(false)}
        >
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-gold/20 bg-gradient-to-l from-gold/10 via-background to-background">
            <DialogTitle className="font-display text-xl font-bold tracking-tight text-foreground">תצוגה מקדימה חכמה לקולאז׳ים</DialogTitle>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5">
            <div className="grid grid-cols-12 gap-4 lg:gap-5 min-h-0">
              <Card className="col-span-12 lg:col-span-4 min-h-0 flex flex-col border-gold/20 bg-card/90 shadow-sm">
                <CardContent className="p-4 space-y-3 flex-1 min-h-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold tracking-wide">בחר לייאאוטים להשוואה</h4>
                  <Badge variant="outline" className="text-xs border-gold/35 bg-gold/10 text-gold">{compareSelectedLayouts.length} נבחרו</Badge>
                </div>
                <ScrollArea className="flex-1 min-h-0 max-h-[55vh] border border-gold/15 rounded-md p-2 bg-background/70">
                  <div className="space-y-3">
                    {(['basic', 'advanced', 'special'] as const).map((cat) => {
                      const catLayouts = LAYOUT_OPTIONS.filter((l) => l.category === cat);
                      return (
                        <div key={cat} className="space-y-1.5">
                          <h5 className="text-[11px] font-bold text-muted-foreground border-b border-gold/20 pb-1">{LAYOUT_CATEGORY_LABELS[cat]}</h5>
                          {catLayouts.map((opt) => (
                            <button
                              key={opt.id}
                              onClick={() => toggleCompareLayout(opt.id)}
                              className={`w-full text-right px-2 py-1.5 rounded-md border text-xs flex items-center justify-between gap-2 transition-colors ${compareSelectedLayouts.includes(opt.id) ? 'bg-primary/15 border-primary/60 text-foreground shadow-[0_0_0_1px_rgba(201,168,76,0.15)]' : 'hover:bg-muted/60 border-border/70'}`}
                            >
                              <span className="flex items-center gap-1.5">
                                {opt.icon}
                                {opt.label}
                              </span>
                              <span className="text-[10px] text-muted-foreground">עד {opt.maxImages}</span>
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
                <Button onClick={handleCompareLayouts} disabled={compareProcessing || compareSelectedLayouts.length === 0}>
                  {compareProcessing ? <RefreshCw className="h-4 w-4 ml-2 animate-spin" /> : <Eye className="h-4 w-4 ml-2" />}
                  {compareProcessing ? 'מייצר תצוגות...' : 'צור תצוגה מקדימה'}
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px]"
                    disabled={compareUndoStack.length === 0}
                    onClick={handleCompareUndo}
                  >
                    בטל
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px]"
                    disabled={compareRedoStack.length === 0}
                    onClick={handleCompareRedo}
                  >
                    בצע שוב
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px] border-gold/35 hover:border-gold/55"
                    disabled={compareItems.length === 0}
                    onClick={saveNamedCompareSnapshot}
                  >
                    שמור Snapshot
                  </Button>
                </div>
                {compareSavedSnapshots.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium text-muted-foreground">מצבים שמורים</p>
                    <div className="flex flex-wrap gap-1.5">
                      {compareSavedSnapshots.map((snapshot) => (
                        <div key={snapshot.id} className="inline-flex items-center rounded-full border border-gold/25 bg-gold/5">
                          <button
                            type="button"
                            onClick={() => loadSavedCompareSnapshot(snapshot.id)}
                            className="px-2 py-1 text-[10px] text-foreground hover:text-primary transition-colors"
                          >
                            {snapshot.name}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSavedCompareSnapshot(snapshot.id)}
                            className="px-1.5 py-1 text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                            aria-label={`מחק ${snapshot.name}`}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                </CardContent>
              </Card>

              <Card className="col-span-12 lg:col-span-8 min-h-0 flex flex-col border-gold/20 bg-card/90 shadow-sm">
                <CardContent className="p-4 space-y-3 flex-1 min-h-0">
                {compareProcessing ? (
                  <div className="text-center space-y-3 py-16">
                    <RefreshCw className="h-10 w-10 mx-auto animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">מייצר תצוגות מקדימות לכל הלייאאוטים שבחרת...</p>
                  </div>
                ) : compareItems.length === 0 ? (
                  <div className="text-center py-16 space-y-2">
                    <p className="font-medium">אין עדיין תצוגות מקדימות</p>
                    <p className="text-sm text-muted-foreground">בחר כמה לייאאוטים ולחץ "צור תצוגה מקדימה"</p>
                  </div>
                ) : (
                  <>
                    <ScrollArea className="w-full whitespace-nowrap pb-2">
                      <div className="flex gap-2">
                        {compareLayoutsWithResults.map((layoutId) => {
                          const layoutInfo = LAYOUT_OPTIONS.find((l) => l.id === layoutId);
                          const pagesCount = compareItems.filter((item) => item.layout === layoutId).length;
                          return (
                            <Button
                              key={layoutId}
                              size="sm"
                              variant={activeCompareLayout === layoutId ? 'default' : 'outline'}
                              className={activeCompareLayout === layoutId ? 'shadow-sm' : 'border-gold/25 hover:border-gold/40'}
                              onClick={() => {
                                recordCompareSnapshot();
                                setActiveCompareLayout(layoutId);
                                setActiveComparePage(0);
                              }}
                            >
                              {layoutInfo?.label || layoutId} ({pagesCount})
                            </Button>
                          );
                        })}
                      </div>
                    </ScrollArea>

                    {activeCompareItem ? (
                      <>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <Badge variant="secondary" className="bg-primary/15 text-primary border border-primary/20">{activeCompareItem.label}</Badge>
                          <Badge variant="outline" className="border-gold/35 bg-gold/5">עמוד {activeCompareItem.pageIndex + 1} / {activeCompareItem.totalPages}</Badge>
                          {images.length > 0 && (
                            <Badge variant="outline" className="text-xs border-border/80">תמונות {comparePageStart + 1}-{comparePageEnd} מתוך {images.length}</Badge>
                          )}
                        </div>

                        <div className="flex items-center justify-between flex-wrap gap-2 rounded-md border border-border/70 bg-background/70 px-2 py-1.5">
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span>זום: {Math.round(compareZoom * 100)}%</span>
                            <span>•</span>
                            <span>גלגלת = זום</span>
                            <span>•</span>
                            <span>גרירה = פאן</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="flex items-center gap-1 px-2">
                              <Checkbox
                                checked={compareBeforeAfterEnabled}
                                onCheckedChange={(checked) => {
                                  recordCompareSnapshot();
                                  setCompareBeforeAfterEnabled(!!checked);
                                }}
                              />
                              <Label className="text-[11px]">לפני/אחרי</Label>
                            </div>
                            {compareBeforeAfterEnabled && (
                              <div className="w-40" onMouseDown={recordCompareSnapshot}>
                                <Slider
                                  value={[compareSplit]}
                                  onValueChange={([v]) => setCompareSplit(v)}
                                  min={5}
                                  max={95}
                                  step={1}
                                />
                              </div>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              onClick={() => {
                                recordCompareSnapshot();
                                setCompareZoom((z) => Math.max(0.6, +(z - 0.1).toFixed(2)));
                              }}
                            >
                              -
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              onClick={() => {
                                recordCompareSnapshot();
                                setCompareZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)));
                              }}
                            >
                              +
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => {
                                recordCompareSnapshot();
                                resetCompareView();
                              }}
                            >
                              איפוס תצוגה
                            </Button>
                          </div>
                        </div>

                        {realTimeWarnings.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {realTimeWarnings.map((warning) => (
                              <Badge key={`compare_${warning}`} variant="outline" className="text-[10px] border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300">{warning}</Badge>
                            ))}
                          </div>
                        )}

                        <div
                          className={`flex-1 min-h-0 h-[52vh] max-h-[52vh] border border-gold/20 rounded-lg bg-gradient-to-b from-muted/20 to-muted/10 p-2 flex items-center justify-center overflow-hidden ${compareZoom > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'}`}
                          onWheel={handleCompareWheel}
                          onMouseDown={handleCompareMouseDown}
                          onMouseMove={handleCompareMouseMove}
                          onMouseUp={stopComparePanning}
                          onMouseLeave={stopComparePanning}
                          onDoubleClick={resetCompareView}
                        >
                          <div className="relative w-full h-full">
                            {compareBeforeAfterEnabled ? (
                              <>
                                <img
                                  src={activeCompareItem.beforeDataUrl}
                                  alt={`${activeCompareItem.label} before`}
                                  className="absolute inset-0 m-auto max-w-full max-h-full object-contain rounded-md select-none"
                                  draggable={false}
                                  style={{
                                    transform: `translate(${comparePan.x}px, ${comparePan.y}px) scale(${compareZoom})`,
                                    transformOrigin: 'center center',
                                    transition: comparePanning ? 'none' : 'transform 120ms ease-out',
                                  }}
                                />
                                <img
                                  src={activeCompareItem.dataUrl}
                                  alt={activeCompareItem.label}
                                  className="absolute inset-0 m-auto max-w-full max-h-full object-contain rounded-md select-none"
                                  draggable={false}
                                  style={{
                                    clipPath: `inset(0 ${100 - compareSplit}% 0 0)`,
                                    transform: `translate(${comparePan.x}px, ${comparePan.y}px) scale(${compareZoom})`,
                                    transformOrigin: 'center center',
                                    transition: comparePanning ? 'none' : 'transform 120ms ease-out',
                                  }}
                                />
                                <div className="pointer-events-none absolute inset-y-0" style={{ left: `${compareSplit}%`, transform: 'translateX(-50%)' }}>
                                  <div className="h-full w-[2px] bg-primary/70 shadow-[0_0_0_1px_rgba(255,255,255,0.35)]" />
                                </div>
                              </>
                            ) : (
                              <img
                                src={activeCompareItem.dataUrl}
                                alt={activeCompareItem.label}
                                className="absolute inset-0 m-auto max-w-full max-h-full object-contain rounded-md select-none"
                                draggable={false}
                                style={{
                                  transform: `translate(${comparePan.x}px, ${comparePan.y}px) scale(${compareZoom})`,
                                  transformOrigin: 'center center',
                                  transition: comparePanning ? 'none' : 'transform 120ms ease-out',
                                }}
                              />
                            )}
                          </div>
                        </div>

                        {comparePageImages.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">תמונות מקור בעמוד הזה</p>
                            <div className="flex gap-2 overflow-x-auto pb-1">
                              {comparePageImages.map((img, idx) => (
                                <div key={`${img.id}_${idx}`} className="shrink-0">
                                  <img src={img.src} alt={img.name} className="w-12 h-12 object-cover rounded-md border" />
                                  <p className="text-[10px] text-center text-muted-foreground mt-1">#{comparePageStart + idx + 1}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {activeLayoutItems.length > 1 && (
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8"
                              disabled={activeComparePage === 0}
                              onClick={() => {
                                recordCompareSnapshot();
                                setActiveComparePage((p) => p - 1);
                              }}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                            {activeLayoutItems.map((item, idx) => (
                              <button
                                key={`${item.layout}_${idx}`}
                                onClick={() => {
                                  recordCompareSnapshot();
                                  setActiveComparePage(idx);
                                }}
                                className={`w-8 h-8 rounded-md text-xs font-semibold transition-colors ${activeComparePage === idx ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
                              >
                                {idx + 1}
                              </button>
                            ))}
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8"
                              disabled={activeComparePage === activeLayoutItems.length - 1}
                              onClick={() => {
                                recordCompareSnapshot();
                                setActiveComparePage((p) => p + 1);
                              }}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">בחר לייאאוט עם תצוגה מקדימה מהרשימה למעלה</p>
                    )}
                  </>
                )}
                </CardContent>
              </Card>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-gold/20 bg-gradient-to-t from-background to-background/95">
            <Button variant="outline" className="border-gold/35 hover:border-gold/55" onClick={() => setCompareDialogOpen(false)}>סגור</Button>
            <Button onClick={() => activeCompareLayout && selectCompareLayout(activeCompareLayout)} disabled={!activeCompareLayout}>
              בחר לייאאוט זה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  <ImageHoverMenu
                    key={item.id}
                    imageUrl={item.image}
                    hoverDelay={800}
                    className={`relative rounded-lg border-2 cursor-pointer transition-all ${gallerySelected.has(item.id) ? "border-primary ring-2 ring-primary/20" : "border-transparent hover:border-primary/30"}`}
                    actions={{
                      onEdit: () => navigate(`/tool?editImage=${encodeURIComponent(item.image)}`),
                      onCatalog: () => navigate(`/catalog?importImage=${encodeURIComponent(item.image)}`),
                      onDownload: () => {
                        const link = document.createElement("a");
                        link.href = item.image;
                        link.download = item.name || "image.png";
                        link.click();
                      },
                    }}
                  >
                    <div
                      onClick={() => {
                        if (galleryImportMode === 'split' || galleryImportMode === 'logo') {
                          setGallerySelected(new Set([item.id]));
                        } else {
                          setGallerySelected((prev) => { const next = new Set(prev); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; });
                        }
                      }}
                    >
                      <img src={item.image} alt={item.name} className="w-full aspect-square object-cover rounded-t-lg" loading="lazy" />
                      {gallerySelected.has(item.id) && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center"><Check className="h-6 w-6 text-primary" /></div>
                      )}
                      <div className="absolute bottom-0 inset-x-0 bg-foreground/60 text-background text-[10px] p-1 truncate">{item.name}</div>
                    </div>
                  </ImageHoverMenu>
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
