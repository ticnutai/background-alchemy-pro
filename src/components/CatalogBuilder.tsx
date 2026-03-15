import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import {
  Plus, Trash2, Download, Eye, ChevronLeft, ChevronRight,
  GripVertical, Image as ImageIcon, Type, Palette, Settings2,
  FileText, Loader2, Upload, X, RotateCcw, Copy, BookOpen,
  Sparkles, FileDown, LayoutGrid, Home,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  generateCatalog,
  catalogToPDF,
  defaultCatalogSettings,
  TEMPLATE_OPTIONS,
  type CatalogProduct,
  type CatalogSettings,
  type CatalogPage,
  type CatalogTemplate,
  type PageSize,
} from "@/lib/catalog-engine";

// ─── Helpers ─────────────────────────────────────────────────
let idCounter = 0;
function newId(): string {
  return `prod_${Date.now()}_${++idCounter}`;
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

// ─── Component ───────────────────────────────────────────────
export default function CatalogBuilder() {
  // Products
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  // Settings
  const [settings, setSettings] = useState<CatalogSettings>({ ...defaultCatalogSettings });
  // Preview
  const [pages, setPages] = useState<CatalogPage[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [autoPreview, setAutoPreview] = useState(true);
  // Sidebar tab
  const [sideTab, setSideTab] = useState<"products" | "template" | "design" | "settings">("products");
  // Logo
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
      });
    }

    setProducts(prev => [...prev, ...newProducts]);
    toast.success(`${newProducts.length} תמונות נוספו`);
  }, []);

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
      });
      setPages(result);
      setCurrentPage(0);
      toast.success(`הקטלוג נוצר — ${result.length} עמודים`);
    } catch (err) {
      toast.error("שגיאה ביצירת הקטלוג");
      console.error(err);
    } finally {
      setGenerating(false);
    }
  }, [products, settings]);

  // Auto-generate preview
  useEffect(() => {
    if (!autoPreview || products.length === 0) return;
    const timeout = setTimeout(() => { generate(); }, 600);
    return () => clearTimeout(timeout);
  }, [products.length, settings.template, settings.columns, settings.pageSize, autoPreview]);

  // ─── Export ────────────────────────────────────────────────
  const exportPDF = useCallback(async () => {
    if (pages.length === 0) {
      await generate();
    }
    const latestPages = pages.length > 0 ? pages : await generateCatalog(products, settings);
    const blob = await catalogToPDF(latestPages);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${settings.title || "catalog"}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("PDF הורד בהצלחה");
  }, [pages, products, settings, generate]);

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

  // ─── Setting helpers ──────────────────────────────────────
  const updateSetting = useCallback(<K extends keyof CatalogSettings>(key: K, val: CatalogSettings[K]) => {
    setSettings(s => ({ ...s, [key]: val }));
  }, []);

  // ─── Product count info ────────────────────────────────────
  const templateInfo = useMemo(() => {
    const t = settings.template;
    let perPage: number;
    switch (t) {
      case "showcase": perPage = 1; break;
      case "lookbook": perPage = 2; break;
      case "magazine": perPage = settings.columns <= 2 ? 3 : 5; break;
      default: perPage = settings.columns * Math.ceil(settings.columns * 0.75);
    }
    const totalPages = products.length > 0 ? 1 + Math.ceil(products.length / perPage) : 0;
    return { perPage, totalPages };
  }, [settings.template, settings.columns, products.length]);

  // ─── Render ────────────────────────────────────────────────
  return (
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
          {templateInfo.totalPages > 0 && (
            <Badge variant="outline" className="text-xs">{templateInfo.totalPages} עמודים</Badge>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Label htmlFor="auto-preview" className="text-xs cursor-pointer">תצוגה מקדימה אוטומטית</Label>
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
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-3.5rem)]">
        {/* ── Sidebar ──────────────────────────────────────── */}
        <aside className="w-80 border-l bg-muted/30 flex flex-col">
          {/* Side tabs */}
          <div className="flex border-b">
            {[
              { id: "products" as const, icon: ImageIcon, label: "מוצרים" },
              { id: "template" as const, icon: LayoutGrid, label: "תבנית" },
              { id: "design" as const, icon: Palette, label: "עיצוב" },
              { id: "settings" as const, icon: Settings2, label: "הגדרות" },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSideTab(tab.id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs transition-colors border-b-2 ${
                  sideTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <tab.icon className="h-4 w-4" />
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
                    className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                  >
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
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

                  {products.length > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {products.length} מוצרים · {templateInfo.perPage} בעמוד
                      </span>
                      <Button variant="ghost" size="sm" onClick={clearAll} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                        <span className="text-xs">נקה הכול</span>
                      </Button>
                    </div>
                  )}

                  {/* Product list with reorder */}
                  <Reorder.Group axis="y" values={products} onReorder={setProducts} className="space-y-2">
                    <AnimatePresence>
                      {products.map((product) => (
                        <Reorder.Item key={product.id} value={product} className="group">
                          <motion.div
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                            className="bg-background rounded-lg border p-2 space-y-2"
                          >
                            <div className="flex gap-2">
                              {/* Drag handle */}
                              <div className="flex items-center cursor-grab active:cursor-grabbing text-muted-foreground">
                                <GripVertical className="h-4 w-4" />
                              </div>
                              {/* Thumbnail */}
                              <div className="w-14 h-14 rounded overflow-hidden bg-muted flex-shrink-0">
                                <img
                                  src={product.image}
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              {/* Name */}
                              <div className="flex-1 min-w-0">
                                <Input
                                  value={product.name}
                                  onChange={e => updateProduct(product.id, { name: e.target.value })}
                                  className="h-7 text-xs font-medium"
                                  placeholder="שם מוצר"
                                />
                                <div className="flex gap-1 mt-1">
                                  <Input
                                    value={product.price || ""}
                                    onChange={e => updateProduct(product.id, { price: e.target.value })}
                                    className="h-6 text-xs w-20"
                                    placeholder="מחיר"
                                  />
                                  <Input
                                    value={product.sku || ""}
                                    onChange={e => updateProduct(product.id, { sku: e.target.value })}
                                    className="h-6 text-xs w-20"
                                    placeholder="מק״ט"
                                  />
                                </div>
                              </div>
                              {/* Actions */}
                              <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => duplicateProduct(product.id)}>
                                  <Copy className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeProduct(product.id)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            {/* Expandable fields */}
                            <div className="space-y-1 hidden group-hover:block">
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
                            </div>
                          </motion.div>
                        </Reorder.Item>
                      ))}
                    </AnimatePresence>
                  </Reorder.Group>
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
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(["A4", "A3", "letter", "square", "landscape"] as PageSize[]).map(s => (
                          <Button
                            key={s}
                            size="sm"
                            variant={settings.pageSize === s ? "default" : "outline"}
                            onClick={() => updateSetting("pageSize", s)}
                            className="text-xs"
                          >
                            {s}
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
                      ]).map(f => (
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

                    <Label className="text-xs font-semibold">הצגה</Label>
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
                  הוסף תמונות מוצרים, בחר תבנית ועיצוב, וצור קטלוג מקצועי בלחיצה אחת.
                  ייצא ל-PDF או PNG.
                </p>
                <Button onClick={() => { setSideTab("products"); fileInputRef.current?.click(); }}>
                  <Plus className="h-4 w-4" />
                  התחל — הוסף תמונות
                </Button>
              </div>
            </div>
          ) : (
            /* Preview canvas */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Page navigation */}
              {pages.length > 0 && (
                <div className="flex items-center justify-center gap-3 py-2 border-b bg-background/80 backdrop-blur">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={currentPage <= 0}
                    onClick={() => setCurrentPage(p => p - 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <div className="flex gap-1">
                    {pages.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentPage(i)}
                        className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                          i === currentPage
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted hover:bg-muted-foreground/10"
                        }`}
                      >
                        {i === 0 ? "שער" : i}
                      </button>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={currentPage >= pages.length - 1}
                    onClick={() => setCurrentPage(p => p + 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Separator orientation="vertical" className="h-5" />
                  <Button variant="ghost" size="sm" onClick={exportImages}>
                    <ImageIcon className="h-3.5 w-3.5" />
                    <span className="text-xs">PNG</span>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={exportPDF}>
                    <FileText className="h-3.5 w-3.5" />
                    <span className="text-xs">PDF</span>
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
  );
}
