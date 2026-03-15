import { useState, useRef, useCallback, useMemo, memo } from "react";
import DOMPurify from "dompurify";
import { getFilterString, getOverlayStyles, getSvgFilterId, getSvgFilterMarkup, type ImageAdjustments, defaultAdjustments } from "./ImageAdjustmentsPanel";

type CompareMode = "slider" | "side-by-side" | "fade" | "split";

interface ImageCanvasProps {
  originalImage: string;
  resultImage: string | null;
  isProcessing: boolean;
  adjustments: ImageAdjustments;
  compareMode?: CompareMode;
}

const compareModeLabels: Record<CompareMode, string> = {
  slider: "סליידר",
  "side-by-side": "צד-צד",
  fade: "דהייה",
  split: "פיצול",
};

const ImageCanvas = memo(({ originalImage, resultImage, isProcessing, adjustments, compareMode = "slider" }: ImageCanvasProps) => {
  const [sliderPos, setSliderPos] = useState(50);
  const [fadeOpacity, setFadeOpacity] = useState(1);
  const [localMode, setLocalMode] = useState<CompareMode>(compareMode);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

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
  const combinedFilter = svgFilterId ? `${filterStyle} url(#${svgFilterId})` : filterStyle;
  const overlayStyles = getOverlayStyles(adjustments);
  const hasAdjustments = JSON.stringify(adjustments) !== JSON.stringify(defaultAdjustments);

  const renderOverlay = () => {
    if (!overlayStyles) return null;
    return <div className="pointer-events-none absolute inset-0" style={overlayStyles} />;
  };

  const renderModeSelector = () => {
    if (!resultImage) return null;
    return (
      <div className="absolute bottom-3 right-3 z-10 flex gap-1 rounded-lg bg-background/80 p-1 backdrop-blur-sm border border-border/50">
        {(Object.keys(compareModeLabels) as CompareMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setLocalMode(mode)}
            className={`rounded-md px-2 py-1 font-accent text-[10px] font-semibold transition-colors ${
              localMode === mode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {compareModeLabels[mode]}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="relative w-full overflow-hidden rounded-lg bg-card shadow-lg">
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

      {resultImage ? (
        <>
          {localMode === "slider" && (
            <div
              ref={containerRef}
              className="relative cursor-col-resize select-none"
              onMouseMove={(e) => handleMove(e.clientX)}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchMove={(e) => handleMove(e.touches[0].clientX)}
              onTouchStart={handleMouseDown}
              onTouchEnd={handleMouseUp}
            >
              <img src={resultImage} alt="Result" className="block w-full" style={{ filter: combinedFilter }} />
              {renderOverlay()}

              <div className="absolute inset-0 overflow-hidden" style={{ width: `${sliderPos}%` }}>
                <img
                  src={originalImage}
                  alt="Original"
                  className="block w-full"
                  style={{ width: containerRef.current?.offsetWidth || "100%" }}
                />
              </div>

              <div className="absolute top-0 bottom-0 z-10" style={{ left: `${sliderPos}%` }}>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-primary shadow-lg">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M7 4L3 10L7 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-primary-foreground" />
                    <path d="M13 4L17 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-primary-foreground" />
                  </svg>
                </div>
              </div>

              <div className="absolute top-3 right-3 rounded-md bg-primary/90 px-2 py-1 font-display text-xs font-semibold text-primary-foreground">אחרי</div>
              <div className="absolute top-3 left-3 rounded-md bg-foreground/70 px-2 py-1 font-display text-xs font-semibold text-primary-foreground">לפני</div>
            </div>
          )}

          {localMode === "side-by-side" && (
            <div className="flex gap-1">
              <div className="flex-1 relative">
                <img src={originalImage} alt="Original" className="block w-full" />
                <div className="absolute top-3 left-3 rounded-md bg-foreground/70 px-2 py-1 font-display text-xs font-semibold text-primary-foreground">לפני</div>
              </div>
              <div className="flex-1 relative">
                <img src={resultImage} alt="Result" className="block w-full" style={{ filter: combinedFilter }} />
                {renderOverlay()}
                <div className="absolute top-3 right-3 rounded-md bg-primary/90 px-2 py-1 font-display text-xs font-semibold text-primary-foreground">אחרי</div>
              </div>
            </div>
          )}

          {localMode === "fade" && (
            <div className="relative">
              <img src={resultImage} alt="Result" className="block w-full" style={{ filter: combinedFilter }} />
              {renderOverlay()}
              <img
                src={originalImage}
                alt="Original"
                className="absolute inset-0 block w-full h-full object-cover transition-opacity duration-300"
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
            <div className="relative overflow-hidden">
              <img src={originalImage} alt="Original" className="block w-full" />
              <div className="absolute inset-0 overflow-hidden" style={{ clipPath: "inset(50% 0 0 0)" }}>
                <img src={resultImage} alt="Result" className="block w-full" style={{ filter: combinedFilter }} />
                {renderOverlay()}
              </div>
              <div className="absolute left-0 right-0 top-1/2 z-10 border-t-2 border-dashed border-primary/60" />
              <div className="absolute top-3 left-3 rounded-md bg-foreground/70 px-2 py-1 font-display text-xs font-semibold text-primary-foreground">לפני</div>
              <div className="absolute bottom-3 right-3 rounded-md bg-primary/90 px-2 py-1 font-display text-xs font-semibold text-primary-foreground">אחרי</div>
            </div>
          )}

          {hasAdjustments && (
            <div className="absolute bottom-3 right-3 rounded-md bg-accent/90 px-2 py-1 font-display text-xs font-semibold text-accent-foreground z-10">+ התאמות</div>
          )}
          {renderModeSelector()}
        </>
      ) : (
        <div className="relative">
          <img src={originalImage} alt="Original" className="block w-full" />
        </div>
      )}
    </div>
  );
});

ImageCanvas.displayName = "ImageCanvas";

export default ImageCanvas;
