import { useState, useRef, useCallback } from "react";

interface ImageCanvasProps {
  originalImage: string;
  resultImage: string | null;
  isProcessing: boolean;
}

const ImageCanvas = ({ originalImage, resultImage, isProcessing }: ImageCanvasProps) => {
  const [sliderPos, setSliderPos] = useState(50);
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

  return (
    <div className="relative w-full overflow-hidden rounded-lg bg-card shadow-lg">
      {/* Processing shimmer overlay */}
      {isProcessing && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-foreground/20 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="font-display text-sm font-semibold text-primary-foreground">
              מעבד תמונה...
            </p>
          </div>
          <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
        </div>
      )}

      {resultImage ? (
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
          {/* Result (full) */}
          <img src={resultImage} alt="Result" className="block w-full" />

          {/* Original (clipped) */}
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ width: `${sliderPos}%` }}
          >
            <img
              src={originalImage}
              alt="Original"
              className="block w-full"
              style={{ width: containerRef.current?.offsetWidth || "100%" }}
            />
          </div>

          {/* Slider line */}
          <div
            className="absolute top-0 bottom-0 z-10 w-0.5 bg-primary-foreground shadow-lg"
            style={{ left: `${sliderPos}%` }}
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-primary shadow-lg">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M7 4L3 10L7 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-primary-foreground" />
                <path d="M13 4L17 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-primary-foreground" />
              </svg>
            </div>
          </div>

          {/* Labels */}
          <div className="absolute top-3 left-3 rounded-md bg-foreground/70 px-2 py-1 font-display text-xs font-semibold text-primary-foreground">
            לפני
          </div>
          <div className="absolute top-3 right-3 rounded-md bg-primary/90 px-2 py-1 font-display text-xs font-semibold text-primary-foreground">
            אחרי
          </div>
        </div>
      ) : (
        <img src={originalImage} alt="Original" className="block w-full" />
      )}
    </div>
  );
};

export default ImageCanvas;
