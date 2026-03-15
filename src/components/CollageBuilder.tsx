import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Grid2X2, Grid3X3, LayoutDashboard, Rows3, GalleryHorizontalEnd,
  Plus, Download, Trash2, Database, CloudDownload, Check, Star,
  Image as ImageIcon, Wand2, Palette, SunMedium, Contrast, Sparkles,
  Scissors, Eraser, RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  generateCollage, type CollageLayout, type CollageOptions,
  colorBasedRemoveBg, removeWhiteBg, autoTrimTransparency,
  addDropShadow, extractColorPalette, compositeImages, adjustImage,
  autoEnhance, addVignette, sharpenImage
} from "@/lib/smart-image-tools";

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

type CollageImage = { id: string; src: string; name: string };

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

  // ── File Upload ─────────────────────────────────────────────
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const src = ev.target?.result as string;
        setImages((prev) => [...prev, { id: crypto.randomUUID(), src, name: file.name }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  }, []);

  // ── Gallery Import ──────────────────────────────────────────
  const loadGalleryItems = useCallback(async (tab: "history" | "products") => {
    setGalleryLoading(true);
    try {
      if (tab === "history") {
        const { data } = await supabase
          .from("processing_history")
          .select("id, result_image_url, background_name, original_image_url")
          .order("created_at", { ascending: false })
          .limit(50);
        setGalleryItems(
          (data || []).map((item) => ({
            id: item.id,
            image: item.result_image_url || item.original_image_url || "",
            name: item.background_name || "תמונה מעובדת",
          }))
        );
      } else {
        const { data } = await supabase
          .from("products")
          .select("id, title, image_url")
          .order("created_at", { ascending: false })
          .limit(50);
        setGalleryItems(
          (data || []).map((item) => ({
            id: item.id,
            image: item.image_url || "",
            name: item.title || "מוצר",
          }))
        );
      }
    } catch {
      toast.error("שגיאה בטעינת הגלריה");
    }
    setGalleryLoading(false);
  }, []);

  const openGalleryImport = useCallback(() => {
    setGalleryOpen(true);
    setGallerySelected(new Set());
    loadGalleryItems(galleryTab);
  }, [galleryTab, loadGalleryItems]);

  const importSelected = useCallback(() => {
    const selected = galleryItems.filter((item) => gallerySelected.has(item.id));
    const newImages: CollageImage[] = selected.map((item) => ({
      id: crypto.randomUUID(),
      src: item.image,
      name: item.name,
    }));
    setImages((prev) => [...prev, ...newImages]);
    setGalleryOpen(false);
    toast.success(`${newImages.length} תמונות יובאו בהצלחה`);
  }, [galleryItems, gallerySelected]);

  // ── Smart Tools ─────────────────────────────────────────────
  const applySmartTool = useCallback(async (toolId: string, imageId: string) => {
    const image = images.find((img) => img.id === imageId);
    if (!image) return;

    setToolProcessing(toolId);
    try {
      let result: string;
      switch (toolId) {
        case "remove-white-bg":
          result = await removeWhiteBg(image.src);
          break;
        case "remove-color-bg":
          result = await colorBasedRemoveBg(image.src, { tolerance: 35 });
          break;
        case "auto-trim":
          result = await autoTrimTransparency(image.src);
          break;
        case "drop-shadow":
          result = await addDropShadow(image.src);
          break;
        case "auto-enhance":
          result = await autoEnhance(image.src);
          break;
        case "sharpen":
          result = await sharpenImage(image.src);
          break;
        case "vignette":
          result = await addVignette(image.src);
          break;
        default:
          return;
      }
      setImages((prev) => prev.map((img) => (img.id === imageId ? { ...img, src: result } : img)));
      toast.success("הכלי הוחל בהצלחה");
    } catch {
      toast.error("שגיאה בהחלת הכלי");
    }
    setToolProcessing(null);
  }, [images]);

  // ── Generate Collage ────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (images.length < 2) {
      toast.error("יש להוסיף לפחות 2 תמונות");
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
      };
      const dataUrl = await generateCollage(images.map((img) => img.src), collageOptions);
      setResult(dataUrl);
      toast.success("הקולאז׳ נוצר בהצלחה!");
    } catch {
      toast.error("שגיאה ביצירת הקולאז׳");
    }
    setProcessing(false);
  }, [images, layout, canvasWidth, canvasHeight, gap, bgColor, borderRadius]);

  // ── Download ────────────────────────────────────────────────
  const downloadCollage = useCallback(() => {
    if (!result) return;
    const link = document.createElement("a");
    link.download = `collage-${Date.now()}.png`;
    link.href = result;
    link.click();
  }, [result]);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">בונה קולאז׳ חכם</h1>
            <p className="text-sm text-muted-foreground">
              יצירת קולאז׳ מתקדם — כלים חכמים ללא AI, ישירות בדפדפן
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.history.back()}>
              חזור
            </Button>
            {result && (
              <Button onClick={downloadCollage}>
                <Download className="h-4 w-4 ml-2" />
                הורד קולאז׳
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* Sidebar */}
        <div className="space-y-4">
          {/* Import Buttons */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="font-semibold text-sm">הוסף תמונות</h3>
              <div className="flex flex-col gap-2">
                <label className="cursor-pointer">
                  <Button variant="outline" className="w-full" asChild>
                    <span>
                      <Plus className="h-4 w-4 ml-2" />
                      העלה מהמחשב
                    </span>
                  </Button>
                  <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileUpload} />
                </label>
                <Button variant="outline" className="w-full" onClick={openGalleryImport}>
                  <Database className="h-4 w-4 ml-2" />
                  ייבוא מהגלריה / מהענן
                </Button>
              </div>
              {images.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  {images.length} תמונות נטענו
                </div>
              )}
            </CardContent>
          </Card>

          {/* Image Thumbnails */}
          {images.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="font-semibold text-sm">תמונות ({images.length})</h3>
                <ScrollArea className="max-h-[200px]">
                  <div className="grid grid-cols-3 gap-2">
                    {images.map((img) => (
                      <div
                        key={img.id}
                        className={`relative border rounded cursor-pointer overflow-hidden aspect-square ${
                          selectedImage === img.id ? "ring-2 ring-primary" : ""
                        }`}
                        onClick={() => setSelectedImage(selectedImage === img.id ? null : img.id)}
                      >
                        <img src={img.src} alt={img.name} className="w-full h-full object-cover" />
                        <button
                          className="absolute top-0.5 left-0.5 bg-red-500 text-white rounded-full p-0.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            setImages((prev) => prev.filter((i) => i.id !== img.id));
                          }}
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

          {/* Smart Tools (per-image) */}
          {selectedImage && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Wand2 className="h-4 w-4" />
                  כלים חכמים (ללא AI)
                </h3>
                <div className="grid grid-cols-1 gap-1.5">
                  {SMART_TOOLS.map((tool) => (
                    <Button
                      key={tool.id}
                      variant="outline"
                      size="sm"
                      className="justify-start text-xs"
                      disabled={toolProcessing !== null}
                      onClick={() => applySmartTool(tool.id, selectedImage)}
                    >
                      {toolProcessing === tool.id ? (
                        <RefreshCw className="h-3 w-3 ml-1 animate-spin" />
                      ) : (
                        <span className="ml-1">{tool.icon}</span>
                      )}
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
                  <Button
                    key={opt.id}
                    variant={layout === opt.id ? "default" : "outline"}
                    size="sm"
                    className="flex-col h-auto py-2 text-[10px]"
                    onClick={() => setLayout(opt.id)}
                  >
                    {opt.icon}
                    {opt.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Design Options */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <h3 className="font-semibold text-sm">עיצוב</h3>
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
                <Label className="text-xs">צבע רקע</Label>
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-full h-8 rounded border cursor-pointer"
                />
              </div>
            </CardContent>
          </Card>

          {/* Generate Button */}
          <Button className="w-full" size="lg" onClick={handleGenerate} disabled={processing || images.length < 2}>
            {processing ? (
              <RefreshCw className="h-4 w-4 ml-2 animate-spin" />
            ) : (
              <ImageIcon className="h-4 w-4 ml-2" />
            )}
            {processing ? "מייצר..." : "צור קולאז׳"}
          </Button>
        </div>

        {/* Main Preview */}
        <Card className="min-h-[500px] flex items-center justify-center">
          <CardContent className="p-4 w-full">
            {result ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">תצוגה מקדימה</Badge>
                  <Button variant="outline" size="sm" onClick={downloadCollage}>
                    <Download className="h-4 w-4 ml-1" />
                    הורד
                  </Button>
                </div>
                <img
                  src={result}
                  alt="Collage preview"
                  className="w-full rounded-lg border shadow-md"
                />
              </div>
            ) : images.length > 0 ? (
              <div className="text-center space-y-3">
                <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
                  {images.slice(0, 6).map((img) => (
                    <img
                      key={img.id}
                      src={img.src}
                      alt={img.name}
                      className="w-full aspect-square object-cover rounded-lg border"
                    />
                  ))}
                </div>
                <p className="text-muted-foreground text-sm">
                  בחר לייאאוט ולחץ "צור קולאז׳"
                </p>
              </div>
            ) : (
              <div className="text-center space-y-4 py-20">
                <ImageIcon className="h-16 w-16 mx-auto text-muted-foreground/30" />
                <div>
                  <h3 className="text-lg font-medium">בונה קולאז׳ חכם</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    העלה תמונות או ייבא מהגלריה/מהענן כדי להתחיל
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center text-xs text-muted-foreground">
                  <Badge variant="outline">הסרת רקע לבן</Badge>
                  <Badge variant="outline">הסרת רקע לפי צבע</Badge>
                  <Badge variant="outline">חיתוך אוטומטי</Badge>
                  <Badge variant="outline">צל תלת-ממדי</Badge>
                  <Badge variant="outline">שיפור אוטומטי</Badge>
                  <Badge variant="outline">6 לייאאוטים</Badge>
                  <Badge variant="outline">ללא AI — 100% בדפדפן</Badge>
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
            <Button
              variant={galleryTab === "history" ? "default" : "outline"}
              size="sm"
              onClick={() => { setGalleryTab("history"); loadGalleryItems("history"); }}
            >
              תמונות מעובדות
            </Button>
            <Button
              variant={galleryTab === "products" ? "default" : "outline"}
              size="sm"
              onClick={() => { setGalleryTab("products"); loadGalleryItems("products"); }}
            >
              גלריית מוצרים
            </Button>
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
              <div className="flex items-center justify-center h-full">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : galleryItems.length === 0 ? (
              <div className="text-center text-muted-foreground py-10">אין תמונות</div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 p-1">
                {galleryItems.map((item) => (
                  <div
                    key={item.id}
                    className={`relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                      gallerySelected.has(item.id) ? "border-primary ring-2 ring-primary/20" : "border-transparent hover:border-primary/30"
                    }`}
                    onClick={() => {
                      setGallerySelected((prev) => {
                        const next = new Set(prev);
                        if (next.has(item.id)) next.delete(item.id);
                        else next.add(item.id);
                        return next;
                      });
                    }}
                  >
                    <img src={item.image} alt={item.name} className="w-full aspect-square object-cover" loading="lazy" />
                    {gallerySelected.has(item.id) && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <Check className="h-6 w-6 text-primary" />
                      </div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] p-1 truncate">
                      {item.name}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button disabled={gallerySelected.size === 0} onClick={importSelected}>
              <CloudDownload className="h-4 w-4 ml-2" />
              ייבא {gallerySelected.size} תמונות
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
