import { useState, useRef, useCallback, useMemo, useEffect, memo, type CSSProperties } from "react";
import DOMPurify from "dompurify";
import { getFilterString, getOverlayStyles, getSvgFilterId, getSvgFilterMarkup, type ImageAdjustments, defaultAdjustments } from "./ImageAdjustmentsPanel";
import type { FrameShape, FrameStyle } from "./FrameStylePanel";

type CompareMode = "slider" | "side-by-side" | "fade" | "split" | "toggle";

interface ImageCanvasProps {
  originalImage: string;
  resultImage: string | null;
  isProcessing: boolean;
  adjustments: ImageAdjustments;
  compareMode?: CompareMode;
  liveFilterCss?: string;
  pageWidthPercent?: number;
  pageHeightPercent?: number;
  pageAspectRatio?: string;
  imageScaleXPercent?: number;
  imageScaleYPercent?: number;
  imageFitMode?: "contain" | "cover";
  lockPageAspect?: boolean;
  lockImageAspect?: boolean;
  panMode?: boolean;
  frameEnabled?: boolean;
  frameWidthPx?: number;
  frameColor?: string;
  frameStyle?: FrameStyle;
  frameShape?: FrameShape;
  frameRadius?: number;
  onPageWidthChange?: (next: number) => void;
  onPageHeightChange?: (next: number) => void;
  onImageScaleXChange?: (next: number) => void;
  onImageScaleYChange?: (next: number) => void;
}

const compareModeLabels: Record<CompareMode, string> = {
  slider: "סליידר",
  "side-by-side": "צד-צד",
  fade: "דהייה",
  split: "פיצול",
  toggle: "החלפה",
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const parseRatio = (ratio: string): number => {
  const [w, h] = ratio.split("/").map(Number);
  if (!w || !h) return 4 / 3;
  return w / h;
};

const shapeClipPath: Record<FrameShape, string | undefined> = {
  rect: undefined,
  rounded: undefined,
  pill: undefined,
  circle: "circle(50% at 50% 50%)",
  diamond: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
  hexagon: "polygon(25% 6%, 75% 6%, 100% 50%, 75% 94%, 25% 94%, 0% 50%)",
  octagon: "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",
};

function getFrameVisualStyle(frameStyle: FrameStyle, frameWidthPx: number, frameColor: string): CSSProperties {
  const width = Math.max(4, Math.min(frameWidthPx, 80));
  switch (frameStyle) {
    case "double":
      return { boxShadow: `inset 0 0 0 ${width}px ${frameColor}, inset 0 0 0 ${Math.round(width * 1.9)}px color-mix(in srgb, ${frameColor} 55%, #ffffff 45%)` };
    case "shadow":
      return { boxShadow: `inset 0 0 0 ${width}px ${frameColor}, 0 12px 24px rgba(0,0,0,0.25)` };
    case "neon":
      return { boxShadow: `inset 0 0 0 ${width}px ${frameColor}, 0 0 24px color-mix(in srgb, ${frameColor} 70%, #00e5ff 30%)` };
    case "dashed":
      return { border: `${Math.max(3, Math.round(width * 0.75))}px dashed ${frameColor}` };
    case "vintage":
      return { boxShadow: `inset 0 0 0 ${width}px ${frameColor}, inset 0 0 18px rgba(0,0,0,0.22)` };
    case "inner":
      return { boxShadow: `inset 0 0 0 ${Math.max(2, Math.round(width * 0.45))}px ${frameColor}, inset 0 0 0 ${width}px color-mix(in srgb, ${frameColor} 35%, #222 65%)` };
    case "soft":
      return { boxShadow: `inset 0 0 0 ${width}px color-mix(in srgb, ${frameColor} 70%, #fff 30%), 0 6px 18px rgba(0,0,0,0.14)` };
    case "film":
      return { boxShadow: `inset 0 0 0 ${width}px #f5f3ef, inset 0 0 0 ${Math.round(width * 0.4)}px #111` };
    case "bold":
      return { boxShadow: `inset 0 0 0 ${Math.round(width * 1.25)}px ${frameColor}` };
    case "clean":
    default:
      return { boxShadow: `inset 0 0 0 ${width}px ${frameColor}` };
  }
}

const ImageCanvas = memo(({
  originalImage,
  resultImage,
  isProcessing,
  adjustments,
  compareMode = "slider",
  liveFilterCss,
  pageWidthPercent = 92,
  pageHeightPercent = 100,
  pageAspectRatio = "4/3",
  imageScaleXPercent = 100,
  imageScaleYPercent = 100,
  imageFitMode = "contain",
  lockPageAspect = false,
  lockImageAspect = false,
  panMode = false,
  frameEnabled = false,
  frameWidthPx = 22,
  frameColor = "#ffffff",
  frameStyle = "clean",
  frameShape = "rect",
  frameRadius = 6,
  onPageWidthChange,
  onPageHeightChange,
  onImageScaleXChange,
  onImageScaleYChange,
}: ImageCanvasProps) => {
  const [sliderPos, setSliderPos] = useState(0);
  const [fadeOpacity, setFadeOpacity] = useState(1);
  const [localMode, setLocalMode] = useState<CompareMode>(compareMode);
  const [showBeforeInToggle, setShowBeforeInToggle] = useState(false);

  // Reset slider to 0 (full "before") whenever a new result arrives
  useEffect(() => {
    setSliderPos(0);
  }, [resultImage]);
  const [activeGuide, setActiveGuide] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const dragModeRef = useRef<null | "page-left" | "page-right" | "page-top" | "page-bottom" | "image-x" | "image-y">(null);
  const dragStartXRef = useRef(0);
  const dragStartYRef = useRef(0);
  const startPageWidthRef = useRef(pageWidthPercent);
  const startPageHeightRef = useRef(pageHeightPercent);
  const startImageScaleXRef = useRef(imageScaleXPercent);
  const startImageScaleYRef = useRef(imageScaleYPercent);

  const snapValue = (value: number, points: number[], threshold: number) => {
    let best = value;
    let bestPoint: number | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const point of points) {
      const distance = Math.abs(value - point);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = distance <= threshold ? point : value;
        bestPoint = distance <= threshold ? point : null;
      }
    }
    return { value: best, snappedTo: bestPoint };
  };

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current || !isDragging.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    setSliderPos(Math.max(0, Math.min(100, x)));
  }, []);

  const handleMouseDown = () => { isDragging.current = true; };
  const handleMouseUp = () => { isDragging.current = false; };

  const filterStyle = getFilterString(adjustments);
  const svgFilterId = getSvgFilterId(adjustments);
  const svgMarkup = useMemo(() => getSvgFilterMarkup(adjustments), [adjustments]);
  const combinedFilter = [svgFilterId ? `${filterStyle} url(#${svgFilterId})` : filterStyle, liveFilterCss].filter(Boolean).join(" ");
  const overlayStyles = getOverlayStyles(adjustments);
  const hasAdjustments = JSON.stringify(adjustments) !== JSON.stringify(defaultAdjustments);
  const baseRatio = parseRatio(pageAspectRatio);
  const ratio = clamp(baseRatio * (pageWidthPercent / Math.max(1, pageHeightPercent)), 0.2, 8);
  const mediaClass = imageFitMode === "cover" ? "block h-full w-full object-cover" : "block h-full w-full object-contain";
  const frameRadiusCss = frameShape === "pill" ? "9999px" : frameShape === "circle" ? "50%" : `${frameRadius}%`;
  const clipPath = shapeClipPath[frameShape];
  const frameVisualStyle = getFrameVisualStyle(frameStyle, frameWidthPx, frameColor);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isPanningRef.current) {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        const stageW = stageRef.current?.clientWidth || 1;
        const stageH = stageRef.current?.clientHeight || 1;
        const rawX = clamp(panStartRef.current.offsetX + dx, -stageW * 0.6, stageW * 0.6);
        const rawY = clamp(panStartRef.current.offsetY + dy, -stageH * 0.6, stageH * 0.6);
        const xSnap = snapValue(rawX, [0, -stageW / 6, stageW / 6], 14);
        const ySnap = snapValue(rawY, [0, -stageH / 6, stageH / 6], 14);
        setPanOffset({ x: xSnap.value, y: ySnap.value });
        setActiveGuide({
          x: xSnap.snappedTo === null ? null : xSnap.snappedTo === 0 ? 50 : xSnap.snappedTo < 0 ? 33.33 : 66.67,
          y: ySnap.snappedTo === null ? null : ySnap.snappedTo === 0 ? 50 : ySnap.snappedTo < 0 ? 33.33 : 66.67,
        });
        return;
      }
      if (!dragModeRef.current || !stageRef.current) return;
      const dx = e.clientX - dragStartXRef.current;
      const dy = e.clientY - dragStartYRef.current;
      if (dragModeRef.current === "image-x") {
        const nextX = clamp(startImageScaleXRef.current + dx * 0.2, 60, 190);
        onImageScaleXChange?.(nextX);
        if (lockImageAspect) {
          const ratio = startImageScaleYRef.current / Math.max(1, startImageScaleXRef.current);
          onImageScaleYChange?.(clamp(nextX * ratio, 60, 190));
        }
        return;
      }
      if (dragModeRef.current === "image-y") {
        const nextY = clamp(startImageScaleYRef.current + dy * 0.2, 60, 190);
        onImageScaleYChange?.(nextY);
        if (lockImageAspect) {
          const ratio = startImageScaleXRef.current / Math.max(1, startImageScaleYRef.current);
          onImageScaleXChange?.(clamp(nextY * ratio, 60, 190));
        }
        return;
      }
      const stageWidth = stageRef.current.parentElement?.clientWidth || stageRef.current.clientWidth || 1;
      const stageHeight = stageRef.current.parentElement?.clientHeight || stageRef.current.clientHeight || 1;
      if (dragModeRef.current === "page-left" || dragModeRef.current === "page-right") {
        const dir = dragModeRef.current === "page-right" ? 1 : -1;
        const nextWidth = clamp(startPageWidthRef.current + ((dx / stageWidth) * 100 * dir), 50, 120);
        onPageWidthChange?.(nextWidth);
        if (lockPageAspect) {
          const ratio = startPageHeightRef.current / Math.max(1, startPageWidthRef.current);
          onPageHeightChange?.(clamp(nextWidth * ratio, 50, 140));
        }
        return;
      }
      const dirY = dragModeRef.current === "page-bottom" ? 1 : -1;
      const nextHeight = clamp(startPageHeightRef.current + ((dy / stageHeight) * 100 * dirY), 50, 140);
      onPageHeightChange?.(nextHeight);
      if (lockPageAspect) {
        const ratio = startPageWidthRef.current / Math.max(1, startPageHeightRef.current);
        onPageWidthChange?.(clamp(nextHeight * ratio, 50, 120));
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isPanningRef.current && e.touches.length > 0) {
        const dx = e.touches[0].clientX - panStartRef.current.x;
        const dy = e.touches[0].clientY - panStartRef.current.y;
        const stageW = stageRef.current?.clientWidth || 1;
        const stageH = stageRef.current?.clientHeight || 1;
        const rawX = clamp(panStartRef.current.offsetX + dx, -stageW * 0.6, stageW * 0.6);
        const rawY = clamp(panStartRef.current.offsetY + dy, -stageH * 0.6, stageH * 0.6);
        const xSnap = snapValue(rawX, [0, -stageW / 6, stageW / 6], 14);
        const ySnap = snapValue(rawY, [0, -stageH / 6, stageH / 6], 14);
        setPanOffset({ x: xSnap.value, y: ySnap.value });
        setActiveGuide({
          x: xSnap.snappedTo === null ? null : xSnap.snappedTo === 0 ? 50 : xSnap.snappedTo < 0 ? 33.33 : 66.67,
          y: ySnap.snappedTo === null ? null : ySnap.snappedTo === 0 ? 50 : ySnap.snappedTo < 0 ? 33.33 : 66.67,
        });
        return;
      }
      if (!dragModeRef.current || !stageRef.current || e.touches.length === 0) return;
      const dx = e.touches[0].clientX - dragStartXRef.current;
      const dy = e.touches[0].clientY - dragStartYRef.current;
      if (dragModeRef.current === "image-x") {
        const nextX = clamp(startImageScaleXRef.current + dx * 0.2, 60, 190);
        onImageScaleXChange?.(nextX);
        if (lockImageAspect) {
          const ratio = startImageScaleYRef.current / Math.max(1, startImageScaleXRef.current);
          onImageScaleYChange?.(clamp(nextX * ratio, 60, 190));
        }
        return;
      }
      if (dragModeRef.current === "image-y") {
        const nextY = clamp(startImageScaleYRef.current + dy * 0.2, 60, 190);
        onImageScaleYChange?.(nextY);
        if (lockImageAspect) {
          const ratio = startImageScaleXRef.current / Math.max(1, startImageScaleYRef.current);
          onImageScaleXChange?.(clamp(nextY * ratio, 60, 190));
        }
        return;
      }
      const stageWidth = stageRef.current.parentElement?.clientWidth || stageRef.current.clientWidth || 1;
      const stageHeight = stageRef.current.parentElement?.clientHeight || stageRef.current.clientHeight || 1;
      if (dragModeRef.current === "page-left" || dragModeRef.current === "page-right") {
        const dir = dragModeRef.current === "page-right" ? 1 : -1;
        const nextWidth = clamp(startPageWidthRef.current + ((dx / stageWidth) * 100 * dir), 50, 120);
        onPageWidthChange?.(nextWidth);
        if (lockPageAspect) {
          const ratio = startPageHeightRef.current / Math.max(1, startPageWidthRef.current);
          onPageHeightChange?.(clamp(nextWidth * ratio, 50, 140));
        }
        return;
      }
      const dirY = dragModeRef.current === "page-bottom" ? 1 : -1;
      const nextHeight = clamp(startPageHeightRef.current + ((dy / stageHeight) * 100 * dirY), 50, 140);
      onPageHeightChange?.(nextHeight);
      if (lockPageAspect) {
        const ratio = startPageWidthRef.current / Math.max(1, startPageHeightRef.current);
        onPageWidthChange?.(clamp(nextHeight * ratio, 50, 120));
      }
    };

    const stopDrag = () => {
      dragModeRef.current = null;
      isPanningRef.current = false;
      setActiveGuide({ x: null, y: null });
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopDrag);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", stopDrag);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopDrag);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", stopDrag);
    };
  }, [lockImageAspect, lockPageAspect, onImageScaleXChange, onImageScaleYChange, onPageHeightChange, onPageWidthChange]);

  const startPan = (clientX: number, clientY: number, target: EventTarget | null) => {
    if (!panMode) return;
    if (target instanceof Element && target.closest("button, input, a")) return;
    isPanningRef.current = true;
    panStartRef.current = {
      x: clientX,
      y: clientY,
      offsetX: panOffset.x,
      offsetY: panOffset.y,
    };
  };

  const startDragHandle = (
    mode: "page-left" | "page-right" | "page-top" | "page-bottom" | "image-x" | "image-y",
    clientX: number,
    clientY: number,
  ) => {
    dragModeRef.current = mode;
    dragStartXRef.current = clientX;
    dragStartYRef.current = clientY;
    startPageWidthRef.current = pageWidthPercent;
    startPageHeightRef.current = pageHeightPercent;
    startImageScaleXRef.current = imageScaleXPercent;
    startImageScaleYRef.current = imageScaleYPercent;
  };

  const renderOverlay = () => {
    if (!overlayStyles) return null;
    return <div className="pointer-events-none absolute inset-0" style={overlayStyles} />;
  };



  return (
    <div className="relative w-full overflow-hidden rounded-lg bg-card p-3 shadow-lg">
      {/* ── לפני / אחרי tabs above canvas ── */}
      {resultImage && (
        <div className="mb-2 flex gap-1 rounded-lg border border-border/60 bg-muted/40 p-1" dir="rtl">
          <button
            onClick={() => { setLocalMode("slider"); setSliderPos(0); }}
            className={`flex-1 rounded-md py-1.5 px-3 font-display text-sm font-bold transition-all ${
              localMode === "slider" && sliderPos < 50
                ? "bg-foreground/80 text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
            }`}
          >
            לפני
          </button>
          <button
            onClick={() => { setLocalMode("slider"); setSliderPos(100); }}
            className={`flex-1 rounded-md py-1.5 px-3 font-display text-sm font-bold transition-all ${
              localMode === "slider" && sliderPos >= 50
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
            }`}
          >
            אחרי
          </button>
        </div>
      )}

      {svgMarkup && (
        <div
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(svgMarkup, {
              USE_PROFILES: { svg: true, svgFilters: true },
              ADD_TAGS: ["filter", "feGaussianBlur", "feTurbulence", "feDisplacementMap", "feConvolveMatrix", "feFlood", "feBlend", "feComposite", "feMerge", "feMergeNode"],
              ADD_ATTR: ["stdDeviation", "baseFrequency", "numOctaves", "seed", "kernelMatrix", "order", "divisor", "flood-color", "flood-opacity", "mode", "in", "in2", "result", "operator"],
            }),
          }}
        />
      )}
      {isProcessing && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-foreground/20 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="font-display text-sm font-semibold text-primary-foreground">מעבד תמונה...</p>
          </div>
          <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
        </div>
      )}

      <div
        ref={stageRef}
        className="relative mx-auto overflow-hidden rounded-lg border border-border/70 bg-muted/20"
        style={{ width: `${pageWidthPercent}%`, aspectRatio: `${ratio}` }}
      >
        <div
          className="absolute inset-0 overflow-hidden"
          style={{
            borderRadius: frameRadiusCss,
            clipPath,
          }}
        >
          {panMode && (
            <div className="pointer-events-none absolute inset-0 z-10">
              <div className="absolute left-1/3 top-0 h-full border-l border-dashed border-primary/20" />
              <div className="absolute left-2/3 top-0 h-full border-l border-dashed border-primary/20" />
              <div className="absolute top-1/3 left-0 w-full border-t border-dashed border-primary/20" />
              <div className="absolute top-2/3 left-0 w-full border-t border-dashed border-primary/20" />
              {activeGuide.x !== null && <div className="absolute top-0 h-full border-l border-primary/60" style={{ left: `${activeGuide.x}%` }} />}
              {activeGuide.y !== null && <div className="absolute left-0 w-full border-t border-primary/60" style={{ top: `${activeGuide.y}%` }} />}
            </div>
          )}
          <div
            className={`h-full w-full origin-center transition-transform duration-150 ${panMode ? "cursor-grab active:cursor-grabbing" : ""}`}
            style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px) scaleX(${imageScaleXPercent / 100}) scaleY(${imageScaleYPercent / 100})` }}
            onMouseDown={(e) => startPan(e.clientX, e.clientY, e.target)}
            onTouchStart={(e) => startPan(e.touches[0].clientX, e.touches[0].clientY, e.target)}
          >
      {resultImage ? (
        <>
          {localMode === "slider" && (
            <div
              ref={containerRef}
              className={`relative h-full select-none ${panMode ? "cursor-grab" : "cursor-col-resize"}`}
              onMouseMove={(e) => { if (!panMode) handleMove(e.clientX); }}
              onMouseDown={() => { if (!panMode) handleMouseDown(); }}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchMove={(e) => { if (!panMode) handleMove(e.touches[0].clientX); }}
              onTouchStart={() => { if (!panMode) handleMouseDown(); }}
              onTouchEnd={handleMouseUp}
            >
              {/* Result (אחרי) fills the full canvas — shows on the LEFT in RTL */}
              <img src={resultImage} alt="Result" className={mediaClass} style={{ filter: combinedFilter }} />
              {renderOverlay()}

              {/* Original (לפני) clips from the left, revealing the RIGHT portion — RTL natural direction */}
              <div
                className="absolute inset-0 overflow-hidden transition-[clip-path] duration-150"
                style={{ clipPath: `inset(0 0 0 ${sliderPos}%)` }}
              >
                <img
                  src={originalImage}
                  alt="Original"
                  className={mediaClass}
                />
              </div>

              <div className="absolute top-0 bottom-0 z-10 transition-[left] duration-150" style={{ left: `${sliderPos}%` }}>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-primary shadow-lg">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M7 4L3 10L7 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-primary-foreground" />
                    <path d="M13 4L17 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-primary-foreground" />
                  </svg>
                </div>
              </div>

              {/* RTL: לפני on the RIGHT, אחרי on the LEFT */}
              <div className="absolute top-3 left-3 rounded-md bg-primary/90 px-2 py-1 font-display text-xs font-semibold text-primary-foreground">אחרי</div>
              <div className="absolute top-3 right-3 rounded-md bg-foreground/70 px-2 py-1 font-display text-xs font-semibold text-primary-foreground">לפני</div>
            </div>
          )}

          {localMode === "side-by-side" && (
            /* RTL: אחרי on the LEFT, לפני on the RIGHT */
            <div className="flex h-full gap-1">
              <div className="relative flex-1">
                <img src={resultImage} alt="Result" className={mediaClass} style={{ filter: combinedFilter }} />
                {renderOverlay()}
                <div className="absolute top-3 left-3 rounded-md bg-primary/90 px-2 py-1 font-display text-xs font-semibold text-primary-foreground">אחרי</div>
              </div>
              <div className="relative flex-1">
                <img src={originalImage} alt="Original" className={mediaClass} />
                <div className="absolute top-3 right-3 rounded-md bg-foreground/70 px-2 py-1 font-display text-xs font-semibold text-primary-foreground">לפני</div>
              </div>
            </div>
          )}

          {localMode === "fade" && (
            <div className="relative h-full">
              <img src={resultImage} alt="Result" className={mediaClass} style={{ filter: combinedFilter }} />
              {renderOverlay()}
              <img
                src={originalImage}
                alt="Original"
                className={`absolute inset-0 transition-opacity duration-300 ${mediaClass}`}
                style={{ opacity: 1 - fadeOpacity }}
              />
              <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-lg bg-background/80 px-3 py-2 backdrop-blur-sm border border-border/50">
                <span className="font-accent text-[10px] text-muted-foreground">לפני</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={fadeOpacity * 100}
                  onChange={(e) => setFadeOpacity(Number(e.target.value) / 100)}
                  className="w-32"
                />
                <span className="font-accent text-[10px] text-muted-foreground">אחרי</span>
              </div>
            </div>
          )}

          {localMode === "split" && (
            <div className="relative h-full overflow-hidden">
              <img src={originalImage} alt="Original" className={mediaClass} />
              <div className="absolute inset-0 overflow-hidden" style={{ clipPath: "inset(50% 0 0 0)" }}>
                <img src={resultImage} alt="Result" className={mediaClass} style={{ filter: combinedFilter }} />
                {renderOverlay()}
              </div>
              <div className="absolute left-0 right-0 top-1/2 z-10 border-t-2 border-dashed border-primary/60" />
              <div className="absolute top-3 left-3 rounded-md bg-foreground/70 px-2 py-1 font-display text-xs font-semibold text-primary-foreground">לפני</div>
              <div className="absolute bottom-3 right-3 rounded-md bg-primary/90 px-2 py-1 font-display text-xs font-semibold text-primary-foreground">אחרי</div>
            </div>
          )}

          {localMode === "toggle" && (
            <div className="relative h-full">
              <img
                src={showBeforeInToggle ? originalImage : resultImage}
                alt={showBeforeInToggle ? "Original" : "Result"}
                className={`${mediaClass} transition-opacity duration-300`}
                style={!showBeforeInToggle ? { filter: combinedFilter } : undefined}
              />
              {!showBeforeInToggle && renderOverlay()}
              <button
                onClick={() => setShowBeforeInToggle((b) => !b)}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-full bg-background/90 px-4 py-1.5 font-display text-xs font-semibold border border-border shadow-lg hover:bg-secondary transition-all"
              >
                🔄 {showBeforeInToggle ? "הצג אחרי" : "הצג לפני"}
              </button>
              <div className={`absolute top-3 right-3 rounded-md px-2 py-1 font-display text-xs font-semibold text-primary-foreground ${showBeforeInToggle ? "bg-foreground/70" : "bg-primary/90"}`}>
                {showBeforeInToggle ? "לפני" : "אחרי"}
              </div>
            </div>
          )}

          {hasAdjustments && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded-md bg-accent/90 px-2 py-1 font-display text-xs font-semibold text-accent-foreground z-10">+ התאמות</div>
          )}
        </>
      ) : (
        <div className="relative h-full">
          <img src={originalImage} alt="Original" className={mediaClass} style={liveFilterCss ? { filter: liveFilterCss } : undefined} />
        </div>
      )}
          </div>
        </div>

        {frameEnabled && (
          <div
            className="pointer-events-none absolute inset-0 z-[15]"
            style={{ borderRadius: frameRadiusCss, clipPath, ...frameVisualStyle }}
          />
        )}

        {onPageWidthChange && (
          <>
            <button
              type="button"
              onMouseDown={(e) => startDragHandle("page-left", e.clientX, e.clientY)}
              onTouchStart={(e) => startDragHandle("page-left", e.touches[0].clientX, e.touches[0].clientY)}
              className="absolute left-1 top-1/2 z-20 h-10 w-2 -translate-y-1/2 cursor-ew-resize rounded bg-primary/40 hover:bg-primary/70"
              title="ידית רוחב דף"
            />
            <button
              type="button"
              onMouseDown={(e) => startDragHandle("page-right", e.clientX, e.clientY)}
              onTouchStart={(e) => startDragHandle("page-right", e.touches[0].clientX, e.touches[0].clientY)}
              className="absolute right-1 top-1/2 z-20 h-10 w-2 -translate-y-1/2 cursor-ew-resize rounded bg-primary/40 hover:bg-primary/70"
              title="ידית רוחב דף"
            />
          </>
        )}

        {onPageHeightChange && (
          <>
            <button
              type="button"
              onMouseDown={(e) => startDragHandle("page-top", e.clientX, e.clientY)}
              onTouchStart={(e) => startDragHandle("page-top", e.touches[0].clientX, e.touches[0].clientY)}
              className="absolute top-1 left-1/2 z-20 h-2 w-10 -translate-x-1/2 cursor-ns-resize rounded bg-primary/40 hover:bg-primary/70"
              title="ידית גובה דף"
            />
            <button
              type="button"
              onMouseDown={(e) => startDragHandle("page-bottom", e.clientX, e.clientY)}
              onTouchStart={(e) => startDragHandle("page-bottom", e.touches[0].clientX, e.touches[0].clientY)}
              className="absolute bottom-1 left-1/2 z-20 h-2 w-10 -translate-x-1/2 cursor-ns-resize rounded bg-primary/40 hover:bg-primary/70"
              title="ידית גובה דף"
            />
          </>
        )}

        {(onImageScaleXChange || onImageScaleYChange) && (
          <>
            {onImageScaleXChange && (
              <button
                type="button"
                onMouseDown={(e) => startDragHandle("image-x", e.clientX, e.clientY)}
                onTouchStart={(e) => startDragHandle("image-x", e.touches[0].clientX, e.touches[0].clientY)}
                className="absolute bottom-2 left-2 z-20 flex h-7 w-7 cursor-ew-resize items-center justify-center rounded-full border border-primary/60 bg-background/90 text-primary shadow"
                title="ידית רוחב תמונה"
              >
                <span className="text-[10px] font-bold">↔</span>
              </button>
            )}
            {onImageScaleYChange && (
              <button
                type="button"
                onMouseDown={(e) => startDragHandle("image-y", e.clientX, e.clientY)}
                onTouchStart={(e) => startDragHandle("image-y", e.touches[0].clientX, e.touches[0].clientY)}
                className="absolute bottom-2 left-11 z-20 flex h-7 w-7 cursor-ns-resize items-center justify-center rounded-full border border-primary/60 bg-background/90 text-primary shadow"
                title="ידית גובה תמונה"
              >
                <span className="text-[10px] font-bold">↕</span>
              </button>
            )}
          </>
        )}

        <div className="absolute top-2 right-2 z-20 rounded bg-foreground/70 px-2 py-0.5 font-accent text-[10px] text-primary-foreground">
          דף {Math.round(pageWidthPercent)}% x {Math.round(pageHeightPercent)}%
        </div>
        <div className="absolute top-2 left-2 z-20 rounded bg-primary/80 px-2 py-0.5 font-accent text-[10px] text-primary-foreground">
          תמונה {Math.round(imageScaleXPercent)}% x {Math.round(imageScaleYPercent)}%
        </div>
      </div>

      {/* ── Before/After mode tab bar — below the canvas ── */}
      {resultImage && (
        <div className="mt-2 flex gap-1 rounded-lg border border-border/60 bg-muted/50 p-1" dir="rtl">
          {(Object.keys(compareModeLabels) as CompareMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setLocalMode(mode)}
              className={`flex-1 rounded-md py-1.5 px-1 font-display text-[11px] font-semibold transition-all ${
                localMode === mode
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
              }`}
            >
              {compareModeLabels[mode]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

ImageCanvas.displayName = "ImageCanvas";

export default ImageCanvas;
