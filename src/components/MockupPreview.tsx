import { useState, useRef, useCallback } from "react";
import { Monitor, Smartphone, Frame, ShoppingBag, X, Download } from "lucide-react";
import { toast } from "sonner";

interface MockupPreviewProps {
  imageUrl: string;
  onClose: () => void;
}

type MockupType = "frame" | "phone" | "monitor" | "shopping";

const mockups: { id: MockupType; label: string; icon: typeof Frame }[] = [
  { id: "frame", label: "מסגרת", icon: Frame },
  { id: "phone", label: "טלפון", icon: Smartphone },
  { id: "monitor", label: "מסך", icon: Monitor },
  { id: "shopping", label: "חנות", icon: ShoppingBag },
];

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function renderMockupToCanvas(type: MockupType, img: HTMLImageElement): HTMLCanvasElement {
  const cw = 1200;
  const ch = 1200;
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d")!;

  // Background
  ctx.fillStyle = "#f5f5f0";
  ctx.fillRect(0, 0, cw, ch);

  const iw = img.width;
  const ih = img.height;

  if (type === "frame") {
    // Wooden frame mockup
    const pad = 60;
    const frameW = 600;
    const frameH = 600;
    const fx = (cw - frameW) / 2;
    const fy = (ch - frameH) / 2;
    // Shadow
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 40;
    ctx.shadowOffsetX = 8;
    ctx.shadowOffsetY = 12;
    // Outer frame
    const grad = ctx.createLinearGradient(fx, fy, fx + frameW, fy + frameH);
    grad.addColorStop(0, "#8b7355");
    grad.addColorStop(0.5, "#d4b896");
    grad.addColorStop(1, "#6b5540");
    ctx.fillStyle = grad;
    ctx.fillRect(fx, fy, frameW, frameH);
    ctx.shadowColor = "transparent";
    // Inner gold trim
    ctx.strokeStyle = "#c8a96e";
    ctx.lineWidth = 3;
    ctx.strokeRect(fx + pad / 2, fy + pad / 2, frameW - pad, frameH - pad);
    // Image area
    const ix = fx + pad;
    const iy = fy + pad;
    const imgW = frameW - pad * 2;
    const imgH = frameH - pad * 2;
    const scale = Math.min(imgW / iw, imgH / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.drawImage(img, ix + (imgW - dw) / 2, iy + (imgH - dh) / 2, dw, dh);
  } else if (type === "phone") {
    // Phone mockup
    const pw = 360;
    const ph = 720;
    const px = (cw - pw) / 2;
    const py = (ch - ph) / 2;
    ctx.shadowColor = "rgba(0,0,0,0.3)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 10;
    // Phone body
    const r = 40;
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, r);
    ctx.fillStyle = "#1a1a1a";
    ctx.fill();
    ctx.shadowColor = "transparent";
    // Notch
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath();
    ctx.roundRect(px + pw / 2 - 60, py, 120, 28, [0, 0, 16, 16]);
    ctx.fill();
    // Screen
    const sx = px + 12;
    const sy = py + 40;
    const sw = pw - 24;
    const sh = ph - 80;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(sx, sy, sw, sh, 8);
    ctx.clip();
    const scale = Math.min(sw / iw, sh / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.drawImage(img, sx + (sw - dw) / 2, sy + (sh - dh) / 2, dw, dh);
    ctx.restore();
  } else if (type === "monitor") {
    // Monitor mockup
    const mw = 800;
    const mh = 520;
    const mx = (cw - mw) / 2;
    const my = (ch - mh) / 2 - 50;
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = 25;
    ctx.shadowOffsetY = 8;
    // Monitor body
    ctx.beginPath();
    ctx.roundRect(mx, my, mw, mh, 16);
    ctx.fillStyle = "#222";
    ctx.fill();
    ctx.shadowColor = "transparent";
    // Screen area
    const sx = mx + 16;
    const sy = my + 16;
    const sw = mw - 32;
    const sh = mh - 48;
    ctx.fillStyle = "#000";
    ctx.fillRect(sx, sy, sw, sh);
    ctx.save();
    ctx.beginPath();
    ctx.rect(sx, sy, sw, sh);
    ctx.clip();
    const scale = Math.min(sw / iw, sh / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.drawImage(img, sx + (sw - dw) / 2, sy + (sh - dh) / 2, dw, dh);
    ctx.restore();
    // Stand
    const standX = cw / 2 - 50;
    const standY = my + mh;
    ctx.fillStyle = "#333";
    ctx.fillRect(standX, standY, 100, 40);
    ctx.fillStyle = "#444";
    ctx.beginPath();
    ctx.roundRect(standX - 50, standY + 40, 200, 10, 4);
    ctx.fill();
  } else {
    // Shopping / product cards grid
    const cardW = 400;
    const cardH = 480;
    const gapX = 40;
    const gapY = 40;
    const startX = (cw - cardW * 2 - gapX) / 2;
    const startY = (ch - cardH * 2 - gapY) / 2;
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        const cx = startX + col * (cardW + gapX);
        const cy = startY + row * (cardH + gapY);
        ctx.shadowColor = "rgba(0,0,0,0.12)";
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 4;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.roundRect(cx, cy, cardW, cardH, 12);
        ctx.fill();
        ctx.shadowColor = "transparent";
        ctx.strokeStyle = "#e5e5e5";
        ctx.lineWidth = 1;
        ctx.stroke();
        // Image
        const imgArea = cardW - 32;
        const imgH = cardH - 120;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(cx + 16, cy + 16, imgArea, imgH, 8);
        ctx.clip();
        const sc = Math.min(imgArea / iw, imgH / ih);
        const dw2 = iw * sc;
        const dh2 = ih * sc;
        ctx.drawImage(img, cx + 16 + (imgArea - dw2) / 2, cy + 16 + (imgH - dh2) / 2, dw2, dh2);
        ctx.restore();
        // Placeholder text lines
        ctx.fillStyle = "#e0e0e0";
        ctx.beginPath(); ctx.roundRect(cx + 16, cy + cardH - 88, imgArea * 0.7, 14, 4); ctx.fill();
        ctx.beginPath(); ctx.roundRect(cx + 16, cy + cardH - 64, imgArea * 0.5, 14, 4); ctx.fill();
        ctx.fillStyle = "#d4b896";
        ctx.beginPath(); ctx.roundRect(cx + 16, cy + cardH - 36, imgArea * 0.3, 18, 4); ctx.fill();
      }
    }
  }

  return canvas;
}

const MockupPreview = ({ imageUrl, onClose }: MockupPreviewProps) => {
  const [activeMockup, setActiveMockup] = useState<MockupType>("frame");
  const [exporting, setExporting] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const downloadMockup = useCallback(async () => {
    setExporting(true);
    try {
      const img = await loadImg(imageUrl);
      const canvas = renderMockupToCanvas(activeMockup, img);
      const link = document.createElement("a");
      link.download = `mockup-${activeMockup}-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("המוקאפ הורד בהצלחה!");
    } catch {
      toast.error("שגיאה ביצירת המוקאפ");
    }
    setExporting(false);
  }, [imageUrl, activeMockup]);

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
              onClick={downloadMockup}
              disabled={exporting}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:brightness-110 transition-all disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              {exporting ? "מייצא..." : "הורד מוקאפ"}
            </button>
            <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-secondary transition-colors">
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Mockup selector */}
        <div className="flex gap-2 px-6 py-3 border-b border-border">
          {mockups.map((m) => (
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
        </div>

        {/* Mockup display */}
        <div ref={previewRef} className="flex items-center justify-center p-8 bg-secondary/30 min-h-[500px]">
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
        </div>
      </div>
    </div>
  );
};

export default MockupPreview;
