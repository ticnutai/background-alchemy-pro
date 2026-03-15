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
  AlignRight, AlignCenter, AlignLeft, Eye, Layers
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  generateCollage, type CollageLayout, type CollageOptions, type CollageTextOverlay, type FrameStyle,
  colorBasedRemoveBg, removeWhiteBg, autoTrimTransparency,
  addDropShadow, extractColorPalette, compositeImages, adjustImage,
  autoEnhance, addVignette, sharpenImage
} from "@/lib/smart-image-tools";

// ─── Constants ──────────────────────────────────────────────────
const LAYOUT_OPTIONS: { id: CollageLayout; label: string; icon: React.ReactNode; maxImages: number }[] = [
  { id: "grid-2x2", label: "רשת 2×2", icon: <Grid2X2 className="h-5 w-5" />, maxImages: 4 },
  { id: "grid-3x3", label: "רשת 3×3", icon: <Grid3X3 className="h-5 w-5" />, maxImages: 9 },
  { id: "hero-side", label: "Hero + צד", icon: <LayoutDashboard className="h-5 w-5" />, maxImages: 3 },
  { id: "strip", label: "סטריפ אופקי", icon: <Rows3 className="h-5 w-5" />, maxImages: 5 },
  { id: "masonry", label: "Masonry", icon: <GalleryHorizontalEnd className="h-5 w-5" />, maxImages: 6 },
  { id: "pinterest", label: "Pinterest", icon: <GalleryHorizontalEnd className="h-5 w-5 rotate-90" />, maxImages: 6 },
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
  { id: "hebrew-modern", label: "עברית מודרנית" },
  { id: "hebrew-classic", label: "עברית קלאסית" },
  { id: "hebrew-display", label: "עברית דיספליי" },
  { id: "hebrew-elegant", label: "עברית אלגנטית" },
  { id: "luxury", label: "Luxury" },
  { id: "elegant-serif", label: "Elegant Serif" },
  { id: "modern-sans", label: "Modern Sans" },
  { id: "classic-serif", label: "Classic Serif" },
  { id: "bold-display", label: "Bold Display" },
  { id: "handwritten", label: "כתב יד" },
  { id: "mono", label: "Mono" },
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

type CollageImage = { id: string; src: string; name: string };

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

  // Result
  const [result, setResult] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  // Gallery import
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryTab, setGalleryTab] = useState<"history" | "products">("history");
  const [galleryItems, setGalleryItems] = useState<{ id: string; image: string; name: string }[]>([]);
  const [gallerySelected, setGallerySelected] = useState<Set<string>>(new Set());
  const [galleryLoading, setGalleryLoading] = useState(false);

  // Smart tool processing
  const [toolProcessing, setToolProcessing] = useState<string | null>(null);

  // Active sidebar tab
  const [sidebarTab, setSidebarTab] = useState("images");

  const editingText = useMemo(() => textOverlays.find(t => t.id === editingTextId) || null, [textOverlays, editingTextId]);

  // ── File Upload ─────────────────────────────────────────────
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

  const openGalleryImport = useCallback(() => {
    setGalleryOpen(true);
    setGallerySelected(new Set());
    loadGalleryItems(galleryTab);
  }, [galleryTab, loadGalleryItems]);

  const importSelected = useCallback(() => {
    const selected = galleryItems.filter((i) => gallerySelected.has(i.id));
    const newImages = selected.map((item) => ({
      id: `gallery_${item.id}`,
      src: item.image,
      name: item.name,
    }));
    setImages((prev) => [...prev, ...newImages]);
    setGalleryOpen(false);
    toast.success(`${newImages.length} תמונות יובאו בהצלחה`);
  }, [galleryItems, gallerySelected]);

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

  // ── Generate ────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (images.length < 1) {
      toast.error("העלה לפחות תמונה אחת");
      return;
    }
    setProcessing(true);
    try {
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
      };
      const dataUrl = await generateCollage(images.map((img) => img.src), collageOptions);
      setResult(dataUrl);
      toast.success("הקולאז׳ נוצר בהצלחה!");
    } catch {
      toast.error("שגיאה ביצירת הקולאז׳");
    }
    setProcessing(false);
  }, [images, layout, canvasWidth, canvasHeight, gap, bgColor, borderRadius, fitMode, frameStyle, textOverlays, bgGradientEnabled, bgGradient]);

  // ── Download ────────────────────────────────────────────────
  const downloadCollage = useCallback(() => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result;
    a.download = `collage_${Date.now()}.png`;
    a.click();
  }, [result]);

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
              <TabsList className="w-full grid grid-cols-4">
                <TabsTrigger value="images" className="text-xs gap-1"><ImageIcon className="h-3.5 w-3.5" />תמונות</TabsTrigger>
                <TabsTrigger value="design" className="text-xs gap-1"><Palette className="h-3.5 w-3.5" />עיצוב</TabsTrigger>
                <TabsTrigger value="frames" className="text-xs gap-1"><Frame className="h-3.5 w-3.5" />מסגרות</TabsTrigger>
                <TabsTrigger value="text" className="text-xs gap-1"><Type className="h-3.5 w-3.5" />טקסט</TabsTrigger>
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
                      <Button variant="outline" className="w-full" onClick={openGalleryImport}>
                        <Database className="h-4 w-4 ml-2" />ייבוא מהגלריה / מהענן
                      </Button>
                    </div>
                    {images.length > 0 && <div className="text-xs text-muted-foreground">{images.length} תמונות נטענו</div>}
                  </CardContent>
                </Card>

                {images.length > 0 && (
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <h3 className="font-semibold text-sm">תמונות ({images.length})</h3>
                      <ScrollArea className="max-h-[200px]">
                        <div className="grid grid-cols-3 gap-2">
                          {images.map((img) => (
                            <div
                              key={img.id}
                              className={`relative border rounded cursor-pointer overflow-hidden aspect-square ${selectedImage === img.id ? "ring-2 ring-primary" : ""}`}
                              onClick={() => setSelectedImage(selectedImage === img.id ? null : img.id)}
                            >
                              <img src={img.src} alt={img.name} className="w-full h-full object-cover" />
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
                    </CardContent>
                  </Card>
                )}

                {/* Layout */}
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <h3 className="font-semibold text-sm">לייאאוט</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {LAYOUT_OPTIONS.map((opt) => (
                        <Button key={opt.id} variant={layout === opt.id ? "default" : "outline"} size="sm" className="flex-col h-auto py-2 text-[10px]" onClick={() => setLayout(opt.id)}>
                          {opt.icon}
                          {opt.label}
                        </Button>
                      ))}
                    </div>
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
                            <SelectContent>
                              {FONT_OPTIONS.map(f => <SelectItem key={f.id} value={f.id} className="text-xs">{f.label}</SelectItem>)}
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
            </Tabs>

            {/* Generate Button */}
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
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">תצוגה מקדימה</Badge>
                  <Button variant="outline" size="sm" onClick={downloadCollage}><Download className="h-4 w-4 ml-1" />הורד</Button>
                </div>
                <img src={result} alt="Collage preview" className="w-full rounded-lg border shadow-md" />
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
                  <Badge variant="outline">11 גופנים</Badge>
                  <Badge variant="outline">כלים חכמים</Badge>
                  <Badge variant="outline">6 לייאאוטים</Badge>
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
            <DialogTitle>ייבוא תמונות מהגלריה / מהענן</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 mb-3">
            <Button variant={galleryTab === "history" ? "default" : "outline"} size="sm" onClick={() => { setGalleryTab("history"); loadGalleryItems("history"); }}>תמונות מעובדות</Button>
            <Button variant={galleryTab === "products" ? "default" : "outline"} size="sm" onClick={() => { setGalleryTab("products"); loadGalleryItems("products"); }}>גלריית מוצרים</Button>
          </div>
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
                    onClick={() => { setGallerySelected((prev) => { const next = new Set(prev); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; }); }}
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
              <CloudDownload className="h-4 w-4 ml-2" />ייבא {gallerySelected.size} תמונות
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
