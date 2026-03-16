import { useState, useCallback, useEffect, useMemo } from "react";
import { Monitor, Smartphone, Frame, ShoppingBag, X, Download, Newspaper, Image as ImageIcon, Laptop, Layers } from "lucide-react";
import { toast } from "sonner";
import { downloadImagesAsZip } from "@/lib/zip-download";

interface MockupPreviewProps {
  imageUrl: string;
  onClose: () => void;
}

type MockupType = "frame" | "phone" | "monitor" | "shopping" | "poster" | "magazine" | "laptop" | "polaroid" | "billboard" | "packaging";
type PlatformPresetId = "ig-post" | "ig-story" | "ig-reel" | "fb-post" | "shop-square" | "amazon-main";
type BackgroundScene = "studio" | "wood" | "concrete" | "luxury" | "night";

const mockups: { id: MockupType; label: string; icon: typeof Frame; category: "digital" | "print" | "commerce" }[] = [
  { id: "frame", label: "מסגרת", icon: Frame, category: "print" },
  { id: "phone", label: "טלפון", icon: Smartphone, category: "digital" },
  { id: "monitor", label: "מסך", icon: Monitor, category: "digital" },
  { id: "shopping", label: "חנות", icon: ShoppingBag, category: "commerce" },
  { id: "poster", label: "פוסטר", icon: ImageIcon, category: "print" },
  { id: "magazine", label: "מגזין", icon: Newspaper, category: "print" },
  { id: "laptop", label: "לפטופ", icon: Laptop, category: "digital" },
  { id: "polaroid", label: "פולרואיד", icon: Frame, category: "print" },
  { id: "billboard", label: "בילבורד", icon: Monitor, category: "print" },
  { id: "packaging", label: "אריזה", icon: Layers, category: "commerce" },
];

const platformPresets: { id: PlatformPresetId; label: string; width: number; height: number }[] = [
  { id: "ig-post", label: "Instagram Post", width: 1080, height: 1080 },
  { id: "ig-story", label: "Instagram Story", width: 1080, height: 1920 },
  { id: "ig-reel", label: "Instagram Reel", width: 1080, height: 1350 },
  { id: "fb-post", label: "Facebook Post", width: 1200, height: 630 },
  { id: "shop-square", label: "Shop Square", width: 2000, height: 2000 },
  { id: "amazon-main", label: "Amazon Main", width: 1600, height: 1600 },
];

const scenePresets: { id: BackgroundScene; label: string }[] = [
  { id: "studio", label: "סטודיו בהיר" },
  { id: "wood", label: "עץ טבעי" },
  { id: "concrete", label: "בטון מודרני" },
  { id: "luxury", label: "יוקרה זהב" },
  { id: "night", label: "לילה דרמטי" },
];

const proPackTypes: MockupType[] = ["frame", "phone", "monitor", "shopping", "poster", "magazine", "laptop", "packaging"];
const proPackScenes: BackgroundScene[] = ["studio", "wood", "luxury"];

const MockupPreview = ({ imageUrl, onClose }: MockupPreviewProps) => {
  const [activeMockup, setActiveMockup] = useState<MockupType>("frame");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "digital" | "print" | "commerce">("all");
  const [exportFormat, setExportFormat] = useState<"png" | "webp">("png");
  const [exportQuality, setExportQuality] = useState(92);
  const [platformPresetId, setPlatformPresetId] = useState<PlatformPresetId>("ig-post");
  const [scene, setScene] = useState<BackgroundScene>("studio");

  const filteredMockups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mockups.filter((m) => {
      const categoryOk = categoryFilter === "all" || m.category === categoryFilter;
      const searchOk = q.length === 0 || m.label.toLowerCase().includes(q);
      return categoryOk && searchOk;
    });
  }, [search, categoryFilter]);

  useEffect(() => {
    if (!filteredMockups.some((m) => m.id === activeMockup)) {
      setActiveMockup(filteredMockups[0]?.id || "frame");
    }
  }, [filteredMockups, activeMockup]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (filteredMockups.length === 0) return;
      const idx = filteredMockups.findIndex((m) => m.id === activeMockup);
      if (e.key === "ArrowLeft") {
        const next = filteredMockups[(idx + 1 + filteredMockups.length) % filteredMockups.length];
        setActiveMockup(next.id);
      }
      if (e.key === "ArrowRight") {
        const next = filteredMockups[(idx - 1 + filteredMockups.length) % filteredMockups.length];
        setActiveMockup(next.id);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, filteredMockups, activeMockup]);

  const activePlatformPreset = useMemo(
    () => platformPresets.find((p) => p.id === platformPresetId) || platformPresets[0],
    [platformPresetId]
  );

  const previewAspectRatio = useMemo(() => `${activePlatformPreset.width} / ${activePlatformPreset.height}`, [activePlatformPreset]);

  const paintSceneBackground = useCallback((ctx: CanvasRenderingContext2D, size: number, activeScene: BackgroundScene) => {
    if (activeScene === "studio") {
      const g = ctx.createLinearGradient(0, 0, size, size);
      g.addColorStop(0, "#f8f8f6");
      g.addColorStop(1, "#e7e6e1");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      return;
    }

    if (activeScene === "wood") {
      const g = ctx.createLinearGradient(0, 0, 0, size);
      g.addColorStop(0, "#d3b997");
      g.addColorStop(1, "#b38f64");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 14; i++) {
        ctx.strokeStyle = `rgba(120,80,45,${0.12 + Math.random() * 0.12})`;
        ctx.lineWidth = 2 + Math.random() * 2;
        ctx.beginPath();
        ctx.moveTo(0, (size / 14) * i + Math.random() * 8);
        ctx.lineTo(size, (size / 14) * i + Math.random() * 8);
        ctx.stroke();
      }
      return;
    }

    if (activeScene === "concrete") {
      const g = ctx.createLinearGradient(0, 0, size, size);
      g.addColorStop(0, "#d9d9d9");
      g.addColorStop(1, "#bdbdbd");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 260; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = Math.random() * 1.8;
        ctx.fillStyle = `rgba(80,80,80,${0.05 + Math.random() * 0.08})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    if (activeScene === "luxury") {
      const g = ctx.createLinearGradient(0, 0, size, size);
      g.addColorStop(0, "#171821");
      g.addColorStop(1, "#2b2431");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = "rgba(201,168,76,0.25)";
      for (let i = -size; i < size * 2; i += 64) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + size, size);
        ctx.stroke();
      }
      return;
    }

    const g = ctx.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, "#111827");
    g.addColorStop(1, "#2b3648");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 120; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = 0.6 + Math.random() * 1.4;
      ctx.fillStyle = `rgba(255,255,255,${0.05 + Math.random() * 0.25})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }, []);

  const loadImage = useCallback(async () => {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = imageUrl;
    });
    return img;
  }, [imageUrl]);

  const renderMockupCanvas = useCallback((ctx: CanvasRenderingContext2D, img: HTMLImageElement, type: MockupType, size: number, activeScene: BackgroundScene) => {
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const containScale = Math.min((size * 0.7) / iw, (size * 0.7) / ih);
    const dw = iw * containScale;
    const dh = ih * containScale;
    const dx = (size - dw) / 2;
    const dy = (size - dh) / 2;

    paintSceneBackground(ctx, size, activeScene);

    if (type === "frame") {
      const pad = 40;
      ctx.fillStyle = "#8b7355";
      ctx.fillRect(dx - pad, dy - pad, dw + pad * 2, dh + pad * 2);
      ctx.fillStyle = "#d4b896";
      ctx.fillRect(dx - pad + 8, dy - pad + 8, dw + pad * 2 - 16, dh + pad * 2 - 16);
      ctx.drawImage(img, dx, dy, dw, dh);
      return;
    }

    if (type === "phone") {
      const pw = 360;
      const ph = 720;
      const px = (size - pw) / 2;
      const py = (size - ph) / 2;
      ctx.fillStyle = "#1a1a1a";
      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, 40);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(px + 12, py + 60, pw - 24, ph - 120, 8);
      ctx.clip();
      ctx.drawImage(img, px + 12, py + 60, pw - 24, ph - 120);
      ctx.restore();
      return;
    }

    if (type === "monitor") {
      const mw = size * 0.8;
      const mh = mw * 0.6;
      const mx = (size - mw) / 2;
      const my = size * 0.08;
      ctx.fillStyle = "#222";
      ctx.fillRect(mx, my, mw, mh);
      ctx.drawImage(img, mx + 16, my + 16, mw - 32, mh - 32);
      ctx.fillRect(size / 2 - 40, my + mh, 80, 50);
      ctx.fillRect(size / 2 - 100, my + mh + 50, 200, 10);
      return;
    }

    if (type === "shopping") {
      const cw = size * 0.4;
      const ch = cw * 1.3;
      const positions = [[size * 0.05, size * 0.05], [size * 0.55, size * 0.05], [size * 0.05, size * 0.52], [size * 0.55, size * 0.52]];
      for (const [cx, cy] of positions) {
        ctx.fillStyle = "#fafafa";
        ctx.strokeStyle = "#e0e0e0";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(cx, cy, cw, ch, 12);
        ctx.fill();
        ctx.stroke();
        ctx.drawImage(img, cx + 8, cy + 8, cw - 16, cw - 16);
      }
      return;
    }

    if (type === "poster") {
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(0,0,0,0.2)";
      ctx.shadowBlur = 16;
      ctx.fillRect(size * 0.2, size * 0.1, size * 0.6, size * 0.8);
      ctx.shadowBlur = 0;
      ctx.drawImage(img, size * 0.24, size * 0.14, size * 0.52, size * 0.72);
      return;
    }

    if (type === "magazine") {
      ctx.fillStyle = "#fff";
      ctx.fillRect(size * 0.1, size * 0.15, size * 0.36, size * 0.7);
      ctx.fillRect(size * 0.54, size * 0.15, size * 0.36, size * 0.7);
      ctx.drawImage(img, size * 0.13, size * 0.22, size * 0.3, size * 0.48);
      ctx.drawImage(img, size * 0.57, size * 0.22, size * 0.3, size * 0.48);
      return;
    }

    if (type === "laptop") {
      const sw = size * 0.78;
      const sh = size * 0.5;
      const sx = (size - sw) / 2;
      const sy = size * 0.12;
      ctx.fillStyle = "#2b2f36";
      ctx.fillRect(sx, sy, sw, sh);
      ctx.drawImage(img, sx + 18, sy + 18, sw - 36, sh - 36);
      ctx.fillStyle = "#8f98a3";
      ctx.beginPath();
      ctx.moveTo(size * 0.15, size * 0.68);
      ctx.lineTo(size * 0.85, size * 0.68);
      ctx.lineTo(size * 0.92, size * 0.78);
      ctx.lineTo(size * 0.08, size * 0.78);
      ctx.closePath();
      ctx.fill();
      return;
    }

    if (type === "polaroid") {
      ctx.fillStyle = "#fff";
      ctx.translate(size * 0.5, size * 0.5);
      ctx.rotate(-0.09);
      ctx.fillRect(-size * 0.23, -size * 0.28, size * 0.46, size * 0.56);
      ctx.drawImage(img, -size * 0.2, -size * 0.24, size * 0.4, size * 0.36);
      ctx.resetTransform();
      return;
    }

    if (type === "billboard") {
      ctx.fillStyle = "#333";
      ctx.fillRect(size * 0.47, size * 0.5, size * 0.06, size * 0.35);
      ctx.fillStyle = "#1d1d1d";
      ctx.fillRect(size * 0.15, size * 0.18, size * 0.7, size * 0.35);
      ctx.drawImage(img, size * 0.18, size * 0.21, size * 0.64, size * 0.29);
      return;
    }

    ctx.fillStyle = "#d4c3a2";
    ctx.fillRect(size * 0.2, size * 0.22, size * 0.62, size * 0.5);
    ctx.fillStyle = "#c7b28d";
    ctx.fillRect(size * 0.22, size * 0.24, size * 0.58, size * 0.46);
    ctx.drawImage(img, size * 0.28, size * 0.3, size * 0.46, size * 0.34);
  }, [paintSceneBackground]);

  const buildMockupDataUrl = useCallback(async (type: MockupType, overrides?: { scene?: BackgroundScene; platform?: PlatformPresetId }) => {
    const selectedPlatform = overrides?.platform
      ? platformPresets.find((p) => p.id === overrides.platform) || activePlatformPreset
      : activePlatformPreset;
    const selectedScene = overrides?.scene || scene;

    const maxSize = 1800;
    const scale = Math.min(maxSize / Math.max(selectedPlatform.width, selectedPlatform.height), 1);
    const WIDTH = Math.max(700, Math.round(selectedPlatform.width * scale));
    const HEIGHT = Math.max(700, Math.round(selectedPlatform.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext("2d")!;
    const img = await loadImage();
    const workSize = Math.min(WIDTH, HEIGHT);
    ctx.save();
    if (WIDTH !== HEIGHT) {
      const dx = (WIDTH - workSize) / 2;
      const dy = (HEIGHT - workSize) / 2;
      ctx.translate(dx, dy);
      renderMockupCanvas(ctx, img, type, workSize, selectedScene);
    } else {
      renderMockupCanvas(ctx, img, type, workSize, selectedScene);
    }
    ctx.restore();

    const mime = exportFormat === "webp" ? "image/webp" : "image/png";
    const quality = Math.max(0.4, Math.min(1, exportQuality / 100));
    return canvas.toDataURL(mime, quality);
  }, [loadImage, renderMockupCanvas, exportFormat, exportQuality, activePlatformPreset, scene]);

  const downloadMockup = useCallback(async (type?: MockupType) => {
    try {
      const mockupType = type || activeMockup;
      const dataUrl = await buildMockupDataUrl(mockupType);
      const ext = exportFormat === "webp" ? "webp" : "png";

      const link = document.createElement("a");
      link.download = `mockup-${mockupType}.${ext}`;
      link.href = dataUrl;
      link.click();
      toast.success("המוקאפ הורד בהצלחה!");
    } catch {
      toast.error("שגיאה ביצירת המוקאפ");
    }
  }, [activeMockup, buildMockupDataUrl, exportFormat]);

  const downloadAllMockups = useCallback(async () => {
    try {
      const targets = filteredMockups.length > 0 ? filteredMockups : mockups;
      const files = await Promise.all(targets.map(async (mk) => ({
        name: `mockup-${mk.id}`,
        image: await buildMockupDataUrl(mk.id),
      })));
      await downloadImagesAsZip(files, `mockups-${Date.now()}.zip`);
      toast.success(`הורדו ${files.length} מוקאפים ב-ZIP`);
    } catch {
      toast.error("שגיאה בהורדת חבילת מוקאפים");
    }
  }, [filteredMockups, buildMockupDataUrl]);

  const downloadProVariationPack = useCallback(async () => {
    try {
      const files: Array<{ name: string; image: string }> = [];
      for (const mk of proPackTypes) {
        for (const sc of proPackScenes) {
          const image = await buildMockupDataUrl(mk, { scene: sc, platform: platformPresetId });
          files.push({
            name: `pro-${mk}-${sc}-${platformPresetId}`,
            image,
          });
        }
      }
      await downloadImagesAsZip(files, `mockup-pro-pack-${platformPresetId}-${Date.now()}.zip`);
      toast.success(`חבילת PRO הוכנה: ${files.length} וריאציות`);
    } catch {
      toast.error("שגיאה ביצירת חבילת PRO");
    }
  }, [buildMockupDataUrl, platformPresetId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-4xl mx-6 rounded-2xl bg-card shadow-2xl border border-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-display text-lg font-bold text-foreground">תצוגה מקדימה — מוקאפ</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadProVariationPack}
              className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 font-accent text-xs font-semibold text-primary transition-all hover:bg-primary/20"
            >
              <Layers className="h-3.5 w-3.5" />
              הורד PRO Pack (24)
            </button>
            <button
              onClick={downloadAllMockups}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 font-accent text-xs font-semibold text-foreground transition-all hover:bg-secondary"
            >
              <Layers className="h-3.5 w-3.5" />
              הורד הכל ZIP
            </button>
            <button
              onClick={downloadMockup}
              className="flex items-center gap-1.5 rounded-lg bg-gold px-3 py-1.5 font-accent text-xs font-semibold text-gold-foreground transition-all hover:brightness-110"
            >
              <Download className="h-3.5 w-3.5" />
              הורד מוקאפ
            </button>
            <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-secondary transition-colors">
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="px-6 py-3 border-b border-border flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש מוקאפ..."
            className="h-8 rounded-lg border border-border bg-background px-3 text-xs"
          />
          {[
            { id: "all", label: "הכול" },
            { id: "digital", label: "דיגיטל" },
            { id: "print", label: "פרינט" },
            { id: "commerce", label: "מסחר" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id as "all" | "digital" | "print" | "commerce")}
              className={`h-8 rounded-lg px-3 text-xs font-semibold transition-colors ${categoryFilter === cat.id ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/80"}`}
            >
              {cat.label}
            </button>
          ))}
          <div className="ms-auto flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">יעד</span>
            <select
              value={platformPresetId}
              onChange={(e) => setPlatformPresetId(e.target.value as PlatformPresetId)}
              className="h-8 rounded-md border border-border bg-background px-2"
            >
              {platformPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>{preset.label}</option>
              ))}
            </select>
            <span className="text-muted-foreground">רקע</span>
            <select
              value={scene}
              onChange={(e) => setScene(e.target.value as BackgroundScene)}
              className="h-8 rounded-md border border-border bg-background px-2"
            >
              {scenePresets.map((preset) => (
                <option key={preset.id} value={preset.id}>{preset.label}</option>
              ))}
            </select>
            <span className="text-muted-foreground">פורמט</span>
            <button
              onClick={() => setExportFormat("png")}
              className={`rounded-md px-2 py-1 ${exportFormat === "png" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
            >
              PNG
            </button>
            <button
              onClick={() => setExportFormat("webp")}
              className={`rounded-md px-2 py-1 ${exportFormat === "webp" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
            >
              WEBP
            </button>
            <span className="text-muted-foreground">איכות</span>
            <input
              type="range"
              min={70}
              max={100}
              value={exportQuality}
              onChange={(e) => setExportQuality(Number(e.target.value))}
            />
            <span className="w-8 text-right text-muted-foreground">{exportQuality}</span>
          </div>
        </div>

        {/* Mockup selector */}
        <div className="flex gap-2 px-6 py-3 border-b border-border overflow-x-auto">
          {filteredMockups.map((m) => (
            <button
              key={m.id}
              onClick={() => setActiveMockup(m.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 font-display text-xs font-semibold transition-all ${
                activeMockup === m.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-foreground hover:bg-secondary/80"
              }`}
            >
              <m.icon className="h-4 w-4" />
              {m.label}
            </button>
          ))}
          {filteredMockups.length === 0 && (
            <div className="text-xs text-muted-foreground py-2">לא נמצאו מוקאפים לחיפוש זה</div>
          )}
        </div>

        {/* Mockup display */}
        <div className="flex items-center justify-center p-8 bg-secondary/30 min-h-[500px]">
          <div className="w-full max-w-[860px]" style={{ aspectRatio: previewAspectRatio }}>
            <div className="w-full h-full flex items-center justify-center rounded-xl overflow-hidden border border-border/50 bg-background/20">
          {activeMockup === "frame" && (
            <div className="relative p-6 bg-gradient-to-br from-[#8b7355] to-[#6b5540] rounded-lg shadow-2xl">
              <div className="p-1 bg-gradient-to-br from-[#d4b896] to-[#a08060] rounded">
                <img src={imageUrl} alt="Mockup" className="max-h-[400px] w-auto rounded shadow-inner" />
              </div>
            </div>
          )}

          {activeMockup === "phone" && (
            <div className="relative w-[280px] rounded-[40px] bg-foreground p-3 shadow-2xl">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[28px] bg-foreground rounded-b-2xl z-10" />
              <div className="rounded-[32px] overflow-hidden bg-card">
                <img src={imageUrl} alt="Mockup" className="w-full" />
              </div>
            </div>
          )}

          {activeMockup === "monitor" && (
            <div className="flex flex-col items-center">
              <div className="rounded-t-xl border-[8px] border-foreground bg-foreground p-0 shadow-xl">
                <img src={imageUrl} alt="Mockup" className="max-h-[380px] w-auto rounded-sm" />
              </div>
              <div className="w-24 h-6 bg-foreground rounded-b-sm" />
              <div className="w-40 h-2 bg-muted-foreground/50 rounded-b-lg mt-0" />
            </div>
          )}

          {activeMockup === "shopping" && (
            <div className="grid grid-cols-2 gap-4 max-w-lg">
              {/* Product card mockup */}
              <div className="rounded-xl border border-border bg-card shadow-lg overflow-hidden">
                <img src={imageUrl} alt="Product" className="w-full aspect-square object-cover" />
                <div className="p-3 space-y-1">
                  <div className="h-3 w-3/4 rounded bg-muted" />
                  <div className="h-3 w-1/2 rounded bg-muted" />
                  <div className="h-4 w-1/3 rounded bg-primary/20 mt-2" />
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card shadow-lg overflow-hidden">
                <img src={imageUrl} alt="Product" className="w-full aspect-square object-cover" />
                <div className="p-3 space-y-1">
                  <div className="h-3 w-2/3 rounded bg-muted" />
                  <div className="h-3 w-1/2 rounded bg-muted" />
                  <div className="h-4 w-1/3 rounded bg-accent/20 mt-2" />
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card shadow-lg overflow-hidden">
                <img src={imageUrl} alt="Product" className="w-full aspect-square object-cover" />
                <div className="p-3 space-y-1">
                  <div className="h-3 w-4/5 rounded bg-muted" />
                  <div className="h-3 w-2/5 rounded bg-muted" />
                  <div className="h-4 w-1/3 rounded bg-primary/20 mt-2" />
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card shadow-lg overflow-hidden">
                <img src={imageUrl} alt="Product" className="w-full aspect-square object-cover" />
                <div className="p-3 space-y-1">
                  <div className="h-3 w-3/5 rounded bg-muted" />
                  <div className="h-3 w-1/2 rounded bg-muted" />
                  <div className="h-4 w-1/3 rounded bg-accent/20 mt-2" />
                </div>
              </div>
            </div>
          )}

          {activeMockup === "poster" && (
            <div className="rounded-xl bg-[#ece7df] p-8 shadow-inner">
              <div className="bg-white p-4 shadow-xl">
                <img src={imageUrl} alt="Poster Mockup" className="max-h-[420px] w-auto object-contain" />
              </div>
            </div>
          )}

          {activeMockup === "magazine" && (
            <div className="grid grid-cols-2 gap-4 rounded-xl bg-[#e6dfd3] p-6 shadow-inner">
              <div className="bg-white p-3 shadow-lg"><img src={imageUrl} alt="Magazine Left" className="w-[220px] h-[320px] object-cover" /></div>
              <div className="bg-white p-3 shadow-lg"><img src={imageUrl} alt="Magazine Right" className="w-[220px] h-[320px] object-cover" /></div>
            </div>
          )}

          {activeMockup === "laptop" && (
            <div className="flex flex-col items-center">
              <div className="rounded-lg bg-[#1f242c] p-4 shadow-2xl">
                <img src={imageUrl} alt="Laptop Mockup" className="max-h-[320px] w-auto rounded" />
              </div>
              <div className="mt-2 h-4 w-48 rounded-b-xl bg-[#8f98a3]" />
            </div>
          )}

          {activeMockup === "polaroid" && (
            <div className="rotate-[-6deg] rounded-sm bg-white p-4 pb-10 shadow-2xl">
              <img src={imageUrl} alt="Polaroid Mockup" className="max-h-[330px] w-auto" />
            </div>
          )}

          {activeMockup === "billboard" && (
            <div className="relative h-[420px] w-[760px] rounded-xl bg-gradient-to-b from-blue-200 to-blue-50 p-6 shadow-inner">
              <div className="absolute bottom-0 left-1/2 h-28 w-8 -translate-x-1/2 bg-[#333]" />
              <div className="mx-auto mt-6 rounded-lg border-8 border-[#1d1d1d] bg-black p-3 shadow-xl">
                <img src={imageUrl} alt="Billboard Mockup" className="h-[220px] w-[560px] object-cover" />
              </div>
            </div>
          )}

          {activeMockup === "packaging" && (
            <div className="grid grid-cols-2 gap-6">
              <div className="rounded-lg bg-[#ccb894] p-4 shadow-xl"><img src={imageUrl} alt="Package Front" className="h-[220px] w-[220px] object-cover" /></div>
              <div className="rounded-lg bg-[#b8a078] p-4 shadow-xl"><img src={imageUrl} alt="Package Side" className="h-[220px] w-[220px] object-cover" /></div>
            </div>
          )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MockupPreview;
