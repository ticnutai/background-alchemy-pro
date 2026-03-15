import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  Crop, RotateCcw, RotateCw, FlipHorizontal2, FlipVertical2,
  Check, X, RectangleHorizontal, Square, Smartphone, Monitor,
  Sliders, Lock, Unlock,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { applyTransform, type CropRect } from "@/lib/canvas-filters";
import { toast } from "sonner";

interface CropTransformPanelProps {
  currentImage: string;
  onApply: (resultBase64: string) => void;
  isProcessing?: boolean;
}

interface AspectOption {
  label: string;
  icon: typeof Square;
  ratio: number | null; // null = free
}

const aspectOptions: AspectOption[] = [
  { label: "חופשי", icon: Crop, ratio: null },
  { label: "1:1", icon: Square, ratio: 1 },
  { label: "4:5", icon: Smartphone, ratio: 4 / 5 },
  { label: "9:16", icon: Smartphone, ratio: 9 / 16 },
  { label: "16:9", icon: Monitor, ratio: 16 / 9 },
  { label: "3:4", icon: RectangleHorizontal, ratio: 3 / 4 },
  { label: "4:3", icon: RectangleHorizontal, ratio: 4 / 3 },
  { label: "2:3", icon: RectangleHorizontal, ratio: 2 / 3 },
];

const CropTransformPanel = ({ currentImage, onApply, isProcessing }: CropTransformPanelProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [displayScale, setDisplayScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [applying, setApplying] = useState(false);

  // Crop rect in image coordinates
  const [cropRect, setCropRect] = useState<CropRect>({ x: 0, y: 0, width: 0, height: 0 });
  // Dragging state
  const dragState = useRef<{
    type: "move" | "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w" | null;
    startX: number; startY: number;
    startCrop: CropRect;
  }>({ type: null, startX: 0, startY: 0, startCrop: { x: 0, y: 0, width: 0, height: 0 } });

  // Load image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImgEl(img);
      setCropRect({ x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight });
      setIsCropping(false);
      setRotation(0);
      setFlipH(false);
      setFlipV(false);
    };
    img.src = currentImage;
  }, [currentImage]);

  // Draw canvas
  useEffect(() => {
    if (!imgEl || !canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const maxW = container.clientWidth;
    const maxH = 300;
    const scale = Math.min(maxW / imgEl.naturalWidth, maxH / imgEl.naturalHeight, 1);
    setDisplayScale(scale);

    canvas.width = Math.round(imgEl.naturalWidth * scale);
    canvas.height = Math.round(imgEl.naturalHeight * scale);
    const ctx = canvas.getContext("2d")!;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw image with rotation/flip preview
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    ctx.drawImage(imgEl, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
    ctx.restore();

    // Draw crop overlay
    if (isCropping) {
      const cx = cropRect.x * scale;
      const cy = cropRect.y * scale;
      const cw = cropRect.width * scale;
      const ch = cropRect.height * scale;

      // Darken outside
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(0, 0, canvas.width, cy);
      ctx.fillRect(0, cy, cx, ch);
      ctx.fillRect(cx + cw, cy, canvas.width - cx - cw, ch);
      ctx.fillRect(0, cy + ch, canvas.width, canvas.height - cy - ch);

      // Crop border
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.strokeRect(cx, cy, cw, ch);

      // Rule of thirds
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 1;
      for (let i = 1; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + (cw * i) / 3, cy);
        ctx.lineTo(cx + (cw * i) / 3, cy + ch);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy + (ch * i) / 3);
        ctx.lineTo(cx + cw, cy + (ch * i) / 3);
        ctx.stroke();
      }

      // Handles
      const handleSize = 8;
      ctx.fillStyle = "#fff";
      const handles = [
        [cx, cy], [cx + cw, cy],
        [cx, cy + ch], [cx + cw, cy + ch],
        [cx + cw / 2, cy], [cx + cw / 2, cy + ch],
        [cx, cy + ch / 2], [cx + cw, cy + ch / 2],
      ];
      handles.forEach(([hx, hy]) => {
        ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
      });
    }
  }, [imgEl, rotation, flipH, flipV, cropRect, isCropping, displayScale]);

  // Handle mouse events for crop dragging
  const getEventPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) / displayScale,
      y: (clientY - rect.top) / displayScale,
    };
  }, [displayScale]);

  const getHandleType = useCallback((x: number, y: number): typeof dragState.current.type => {
    const c = cropRect;
    const margin = 12 / displayScale;

    const nearLeft = Math.abs(x - c.x) < margin;
    const nearRight = Math.abs(x - (c.x + c.width)) < margin;
    const nearTop = Math.abs(y - c.y) < margin;
    const nearBottom = Math.abs(y - (c.y + c.height)) < margin;

    if (nearTop && nearLeft) return "nw";
    if (nearTop && nearRight) return "ne";
    if (nearBottom && nearLeft) return "sw";
    if (nearBottom && nearRight) return "se";
    if (nearTop) return "n";
    if (nearBottom) return "s";
    if (nearLeft) return "w";
    if (nearRight) return "e";
    if (x > c.x && x < c.x + c.width && y > c.y && y < c.y + c.height) return "move";
    return null;
  }, [cropRect, displayScale]);

  const handlePointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isCropping || !imgEl) return;
    const pos = getEventPos(e);
    const type = getHandleType(pos.x, pos.y);
    if (!type) return;
    dragState.current = { type, startX: pos.x, startY: pos.y, startCrop: { ...cropRect } };
  }, [isCropping, imgEl, getEventPos, getHandleType, cropRect]);

  const handlePointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!dragState.current.type || !imgEl) return;
    e.preventDefault();
    const pos = getEventPos(e);
    const dx = pos.x - dragState.current.startX;
    const dy = pos.y - dragState.current.startY;
    const sc = dragState.current.startCrop;
    const imgW = imgEl.naturalWidth;
    const imgH = imgEl.naturalHeight;

    let newCrop = { ...cropRect };

    if (dragState.current.type === "move") {
      newCrop.x = Math.max(0, Math.min(imgW - sc.width, sc.x + dx));
      newCrop.y = Math.max(0, Math.min(imgH - sc.height, sc.y + dy));
    } else {
      // Resize
      let nx = sc.x, ny = sc.y, nw = sc.width, nh = sc.height;
      const type = dragState.current.type;

      if (type.includes("w")) { nx = sc.x + dx; nw = sc.width - dx; }
      if (type.includes("e")) { nw = sc.width + dx; }
      if (type.includes("n")) { ny = sc.y + dy; nh = sc.height - dy; }
      if (type.includes("s")) { nh = sc.height + dy; }

      // Enforce minimum size
      if (nw < 20) { nw = 20; if (type.includes("w")) nx = sc.x + sc.width - 20; }
      if (nh < 20) { nh = 20; if (type.includes("n")) ny = sc.y + sc.height - 20; }

      // Enforce aspect ratio
      if (aspectRatio) {
        if (type.includes("w") || type.includes("e")) {
          nh = nw / aspectRatio;
        } else {
          nw = nh * aspectRatio;
        }
      }

      // Clamp to image bounds
      nx = Math.max(0, nx);
      ny = Math.max(0, ny);
      nw = Math.min(nw, imgW - nx);
      nh = Math.min(nh, imgH - ny);

      newCrop = { x: nx, y: ny, width: nw, height: nh };
    }
    setCropRect(newCrop);
  }, [imgEl, getEventPos, cropRect, aspectRatio]);

  const handlePointerUp = useCallback(() => {
    dragState.current.type = null;
  }, []);

  // Apply aspect ratio when changed
  useEffect(() => {
    if (!imgEl || !aspectRatio) return;
    const imgW = imgEl.naturalWidth;
    const imgH = imgEl.naturalHeight;
    let w = imgW, h = imgH;
    if (imgW / imgH > aspectRatio) {
      w = imgH * aspectRatio;
    } else {
      h = imgW / aspectRatio;
    }
    setCropRect({
      x: (imgW - w) / 2,
      y: (imgH - h) / 2,
      width: w,
      height: h,
    });
  }, [aspectRatio, imgEl]);

  const handleApply = useCallback(async () => {
    if (!imgEl) return;
    setApplying(true);
    try {
      const crop = isCropping ? cropRect : undefined;
      const result = await applyTransform(currentImage, {
        crop,
        rotation,
        flipH,
        flipV,
      });
      onApply(result);
      toast.success("החיתוך הוחל בהצלחה!");
    } catch {
      toast.error("שגיאה בחיתוך");
    } finally {
      setApplying(false);
    }
  }, [imgEl, currentImage, cropRect, rotation, flipH, flipV, isCropping, onApply]);

  const handleReset = useCallback(() => {
    if (!imgEl) return;
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setAspectRatio(null);
    setIsCropping(false);
    setCropRect({ x: 0, y: 0, width: imgEl.naturalWidth, height: imgEl.naturalHeight });
  }, [imgEl]);

  const hasChanges = rotation !== 0 || flipH || flipV || (isCropping && imgEl &&
    (cropRect.x > 1 || cropRect.y > 1 ||
      Math.abs(cropRect.width - imgEl.naturalWidth) > 1 ||
      Math.abs(cropRect.height - imgEl.naturalHeight) > 1));

  const cropDimensions = useMemo(() => {
    if (!isCropping) return null;
    return `${Math.round(cropRect.width)} × ${Math.round(cropRect.height)}`;
  }, [isCropping, cropRect]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Crop className="h-4 w-4 text-primary" />
          חיתוך וטרנספורם
        </h3>
        {hasChanges && (
          <button onClick={handleReset} className="flex items-center gap-1 font-body text-xs text-primary hover:underline">
            <RotateCcw className="h-3 w-3" /> איפוס
          </button>
        )}
      </div>

      {/* Canvas Preview */}
      <div ref={containerRef} className="relative rounded-lg overflow-hidden border border-border bg-muted/30">
        <canvas
          ref={canvasRef}
          className="w-full cursor-crosshair"
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
        />
        {cropDimensions && (
          <div className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-0.5 font-accent text-[10px] text-white">
            {cropDimensions} px
          </div>
        )}
      </div>

      {/* Crop Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            setIsCropping(!isCropping);
            if (!isCropping && imgEl) {
              setCropRect({ x: 0, y: 0, width: imgEl.naturalWidth, height: imgEl.naturalHeight });
            }
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 font-display text-xs font-semibold transition-colors
            ${isCropping ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/80"}`}
        >
          <Crop className="h-3.5 w-3.5" />
          {isCropping ? "חותך..." : "חיתוך"}
        </button>
      </div>

      {/* Aspect Ratios */}
      {isCropping && (
        <div className="space-y-2">
          <span className="font-body text-[11px] text-muted-foreground">יחס גובה-רוחב:</span>
          <div className="grid grid-cols-4 gap-1">
            {aspectOptions.map((opt) => (
              <button
                key={opt.label}
                onClick={() => setAspectRatio(opt.ratio)}
                className={`flex flex-col items-center rounded-md py-1.5 px-1 font-accent text-[10px] transition-colors
                  ${aspectRatio === opt.ratio ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:bg-secondary"}`}
              >
                <opt.icon className="h-3 w-3 mb-0.5" />
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Rotation Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-body text-xs text-foreground flex items-center gap-1.5">
            <Sliders className="h-3 w-3 text-muted-foreground" />
            סיבוב
          </span>
          <span className="font-accent text-xs text-muted-foreground tabular-nums">{rotation}°</span>
        </div>
        <Slider
          value={[rotation]}
          onValueChange={([v]) => setRotation(v)}
          min={-180}
          max={180}
          step={1}
        />
        <div className="flex gap-1.5">
          <button
            onClick={() => setRotation((r) => ((r - 90 + 360) % 360 === 0 ? 0 : r - 90))}
            className="flex-1 flex items-center justify-center gap-1 rounded-md bg-secondary/50 py-1.5 font-accent text-[10px] text-foreground hover:bg-secondary"
          >
            <RotateCcw className="h-3 w-3" /> -90°
          </button>
          <button
            onClick={() => setRotation((r) => ((r + 90) % 360 === 0 ? 0 : r + 90))}
            className="flex-1 flex items-center justify-center gap-1 rounded-md bg-secondary/50 py-1.5 font-accent text-[10px] text-foreground hover:bg-secondary"
          >
            <RotateCw className="h-3 w-3" /> +90°
          </button>
        </div>
      </div>

      {/* Flip Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setFlipH(!flipH)}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 font-display text-xs font-semibold transition-colors
            ${flipH ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/80"}`}
        >
          <FlipHorizontal2 className="h-3.5 w-3.5" />
          היפוך אופקי
        </button>
        <button
          onClick={() => setFlipV(!flipV)}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 font-display text-xs font-semibold transition-colors
            ${flipV ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/80"}`}
        >
          <FlipVertical2 className="h-3.5 w-3.5" />
          היפוך אנכי
        </button>
      </div>

      {/* Apply / Cancel */}
      {hasChanges && (
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleApply}
            disabled={applying || isProcessing}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-primary py-2.5 font-display text-sm font-semibold text-primary-foreground hover:brightness-110 transition disabled:opacity-50"
          >
            {applying ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            החל שינויים
          </button>
          <button
            onClick={handleReset}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-4 py-2.5 font-display text-sm font-semibold text-foreground hover:bg-secondary transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default CropTransformPanel;
