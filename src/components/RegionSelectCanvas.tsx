import { useRef, useState, useCallback, useEffect } from "react";
import { Paintbrush, Eraser, RotateCcw, Circle } from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface RegionSelectCanvasProps {
  imageSrc: string;
  onMaskReady: (maskDataUrl: string) => void;
  active: boolean;
}

type Tool = "brush" | "eraser";

export default function RegionSelectCanvas({ imageSrc, onMaskReady, active }: RegionSelectCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  const [tool, setTool] = useState<Tool>("brush");
  const [brushSize, setBrushSize] = useState(30);
  const [hasStrokes, setHasStrokes] = useState(false);

  // Resize canvas to match displayed image size
  const syncCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const rect = img.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      // Save existing drawing
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext("2d")!;
      tempCtx.drawImage(canvas, 0, 0);

      canvas.width = rect.width;
      canvas.height = rect.height;

      // Restore drawing scaled
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(tempCanvas, 0, 0, rect.width, rect.height);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    const obs = new ResizeObserver(() => syncCanvasSize());
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [active, syncCanvasSize]);

  // When image loads, init canvas
  const handleImgLoad = useCallback(() => {
    syncCanvasSize();
  }, [syncCanvasSize]);

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const drawLine = useCallback((from: { x: number; y: number }, to: { x: number; y: number }) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (tool === "brush") {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "rgba(255, 80, 80, 0.5)";
    } else {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    }

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }, [brushSize, tool]);

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!active) return;
    e.preventDefault();
    isDrawing.current = true;
    const pos = getPos(e);
    lastPoint.current = pos;
    // Draw a dot
    drawLine(pos, pos);
    setHasStrokes(true);
  }, [active, getPos, drawLine]);

  const moveDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current || !lastPoint.current) return;
    e.preventDefault();
    const pos = getPos(e);
    drawLine(lastPoint.current, pos);
    lastPoint.current = pos;
  }, [getPos, drawLine]);

  const endDraw = useCallback(() => {
    isDrawing.current = false;
    lastPoint.current = null;
    // Export mask
    exportMask();
  }, []);

  const exportMask = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    // Create a clean black/white mask at the natural image resolution
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = img.naturalWidth;
    maskCanvas.height = img.naturalHeight;
    const mCtx = maskCanvas.getContext("2d")!;

    // Black background (unselected)
    mCtx.fillStyle = "#000";
    mCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

    // Draw user strokes as white (selected) scaled to natural size
    mCtx.globalCompositeOperation = "source-over";
    mCtx.drawImage(canvas, 0, 0, maskCanvas.width, maskCanvas.height);

    // Convert red overlay strokes to solid white
    const imageData = mCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      // If pixel has any red (from brush), make it white
      if (data[i] > 50 && data[i + 3] > 10) {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = 255;
      } else {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 255;
      }
    }
    mCtx.putImageData(imageData, 0, 0);

    onMaskReady(maskCanvas.toDataURL("image/png"));
  }, [onMaskReady]);

  const clearCanvas = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !canvasRef.current) return;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setHasStrokes(false);
    onMaskReady("");
  }, [onMaskReady]);

  if (!active) return null;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-2">
        <button
          onClick={() => setTool("brush")}
          className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 font-display text-[11px] font-semibold transition-colors ${
            tool === "brush" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <Paintbrush className="h-3.5 w-3.5" /> צייר
        </button>
        <button
          onClick={() => setTool("eraser")}
          className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 font-display text-[11px] font-semibold transition-colors ${
            tool === "eraser" ? "bg-destructive text-destructive-foreground" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <Eraser className="h-3.5 w-3.5" /> מחק
        </button>

        <div className="mx-1 h-5 w-px bg-border" />

        <div className="flex items-center gap-2 flex-1">
          <Circle className="h-3 w-3 text-muted-foreground" />
          <Slider
            value={[brushSize]}
            onValueChange={([v]) => setBrushSize(v)}
            min={5}
            max={80}
            step={1}
            className="flex-1"
          />
          <span className="font-accent text-[10px] text-muted-foreground w-6 text-center">{brushSize}</span>
        </div>

        <div className="mx-1 h-5 w-px bg-border" />

        <button
          onClick={clearCanvas}
          disabled={!hasStrokes}
          className="flex items-center gap-1 rounded-md px-2 py-1.5 font-display text-[11px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" /> נקה
        </button>
      </div>

      {/* Canvas overlay on image */}
      <div ref={containerRef} className="relative rounded-lg overflow-hidden border-2 border-dashed border-primary/40">
        <img
          ref={imgRef}
          src={imageSrc}
          alt="region-select"
          className="block w-full select-none pointer-events-none"
          onLoad={handleImgLoad}
          draggable={false}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
          onMouseDown={startDraw}
          onMouseMove={moveDraw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={moveDraw}
          onTouchEnd={endDraw}
        />
        {!hasStrokes && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="rounded-full bg-background/80 backdrop-blur-sm px-4 py-2 border border-border">
              <span className="font-body text-xs text-muted-foreground">🎨 צייר על האזור שברצונך לערוך</span>
            </div>
          </div>
        )}
      </div>

      <p className="font-body text-[10px] text-muted-foreground text-center">
        {tool === "brush" ? "צייר על האזור שרוצים לערוך" : "מחק חלקים מהסימון"} • גודל מכחול: {brushSize}px
      </p>
    </div>
  );
}
