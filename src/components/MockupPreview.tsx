import { useState, useCallback } from "react";
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

const MockupPreview = ({ imageUrl, onClose }: MockupPreviewProps) => {
  const [activeMockup, setActiveMockup] = useState<MockupType>("frame");

  const downloadMockup = useCallback(async () => {
    try {
      const SIZE = 1200;
      const canvas = document.createElement("canvas");
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext("2d")!;

      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.crossOrigin = "anonymous";
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = imageUrl;
      });

      const iw = img.naturalWidth, ih = img.naturalHeight;
      const scale = Math.min(SIZE * 0.7 / iw, SIZE * 0.7 / ih);
      const dw = iw * scale, dh = ih * scale;
      const dx = (SIZE - dw) / 2, dy = (SIZE - dh) / 2;

      if (activeMockup === "frame") {
        ctx.fillStyle = "#f5f0eb";
        ctx.fillRect(0, 0, SIZE, SIZE);
        const pad = 40;
        ctx.fillStyle = "#8b7355";
        ctx.fillRect(dx - pad, dy - pad, dw + pad * 2, dh + pad * 2);
        ctx.fillStyle = "#d4b896";
        ctx.fillRect(dx - pad + 8, dy - pad + 8, dw + pad * 2 - 16, dh + pad * 2 - 16);
        ctx.drawImage(img, dx, dy, dw, dh);
      } else if (activeMockup === "phone") {
        ctx.fillStyle = "#f0f0f0";
        ctx.fillRect(0, 0, SIZE, SIZE);
        const pw = 360, ph = 720;
        const px = (SIZE - pw) / 2, py = (SIZE - ph) / 2;
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
      } else if (activeMockup === "monitor") {
        ctx.fillStyle = "#e8e8e8";
        ctx.fillRect(0, 0, SIZE, SIZE);
        const mw = SIZE * 0.8, mh = mw * 0.6;
        const mx = (SIZE - mw) / 2, my = SIZE * 0.08;
        ctx.fillStyle = "#222";
        ctx.fillRect(mx, my, mw, mh);
        ctx.drawImage(img, mx + 16, my + 16, mw - 32, mh - 32);
        ctx.fillStyle = "#222";
        ctx.fillRect(SIZE / 2 - 40, my + mh, 80, 50);
        ctx.fillRect(SIZE / 2 - 100, my + mh + 50, 200, 10);
      } else {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, SIZE, SIZE);
        const cw = SIZE * 0.4, ch = cw * 1.3;
        const positions = [[SIZE * 0.05, SIZE * 0.05], [SIZE * 0.55, SIZE * 0.05], [SIZE * 0.05, SIZE * 0.52], [SIZE * 0.55, SIZE * 0.52]];
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
      }

      const link = document.createElement("a");
      link.download = `mockup-${activeMockup}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("המוקאפ הורד בהצלחה!");
    } catch {
      toast.error("שגיאה ביצירת המוקאפ");
    }
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
        <div className="flex items-center justify-center p-8 bg-secondary/30 min-h-[500px]">
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
