import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ZoomIn, ArrowLeft, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

interface ResultItem {
  id: string;
  result_image_url: string;
  original_image_url: string;
  background_name: string | null;
  created_at: string;
}

interface ResultsStripProps {
  onSelectImage?: (url: string) => void;
  currentResultUrl?: string | null;
}

const ResultsStrip = ({ onSelectImage, currentResultUrl }: ResultsStripProps) => {
  const [items, setItems] = useState<ResultItem[]>([]);
  const [zoomedItem, setZoomedItem] = useState<ResultItem | null>(null);
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  useEffect(() => {
    supabase.from("processing_history")
      .select("id, result_image_url, original_image_url, background_name, created_at")
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) setItems(data);
      });
  }, [currentResultUrl]);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current || !isDragging.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    setSliderPos(Math.max(0, Math.min(100, x)));
  }, []);

  const navigateZoom = useCallback((direction: "prev" | "next") => {
    if (!zoomedItem) return;
    const idx = items.findIndex(i => i.id === zoomedItem.id);
    const nextIdx = direction === "next" ? idx + 1 : idx - 1;
    if (nextIdx >= 0 && nextIdx < items.length) {
      setZoomedItem(items[nextIdx]);
      setSliderPos(50);
    }
  }, [zoomedItem, items]);

  useEffect(() => {
    if (!zoomedItem) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") navigateZoom("next");
      else if (e.key === "ArrowRight") navigateZoom("prev");
      else if (e.key === "Escape") setZoomedItem(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [zoomedItem, navigateZoom]);

  if (items.length === 0) return null;

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-bold text-foreground">רקעים אחרונים</h3>
          <Link to="/gallery" className="flex items-center gap-1 font-accent text-xs text-gold hover:underline">
            לגלריה המלאה <ArrowLeft className="h-3 w-3" />
          </Link>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {items.map(item => (
            <div key={item.id} className="group/thumb relative shrink-0 w-20 h-20">
              <button
                onClick={() => onSelectImage?.(item.result_image_url)}
                className="w-full h-full rounded-lg overflow-hidden border border-border hover:border-gold/50 transition-all"
              >
                <img src={item.result_image_url} alt={item.background_name || ""} className="h-full w-full object-cover" />
                <p className="absolute bottom-0 inset-x-0 bg-foreground/60 px-1 py-0.5 font-accent text-[8px] text-card truncate text-center">
                  {item.background_name || "מותאם"}
                </p>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setZoomedItem(item); setSliderPos(50); }}
                className="absolute top-1 left-1 flex h-6 w-6 items-center justify-center rounded-full bg-foreground/60 text-card opacity-0 group-hover/thumb:opacity-100 transition-opacity backdrop-blur-sm hover:bg-primary"
              >
                <ZoomIn className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Zoom overlay with slider */}
      {zoomedItem && (
        <div className="fixed inset-0 z-50 bg-foreground/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setZoomedItem(null)}>
          <div className="relative w-full max-w-3xl" onClick={e => e.stopPropagation()}>
            <button onClick={() => setZoomedItem(null)} className="absolute -top-10 left-0 rounded-full bg-card p-2 hover:bg-secondary transition-colors z-20">
              <X className="h-4 w-4 text-foreground" />
            </button>
            <p className="absolute -top-10 right-0 font-display text-sm font-bold text-card">{zoomedItem.background_name || "רקע מותאם"}</p>

            <div
              ref={containerRef}
              className="relative rounded-xl overflow-hidden cursor-col-resize select-none shadow-2xl"
              onMouseMove={(e) => handleMove(e.clientX)}
              onMouseDown={() => { isDragging.current = true; }}
              onMouseUp={() => { isDragging.current = false; }}
              onMouseLeave={() => { isDragging.current = false; }}
              onTouchMove={(e) => handleMove(e.touches[0].clientX)}
              onTouchStart={() => { isDragging.current = true; }}
              onTouchEnd={() => { isDragging.current = false; }}
            >
              {/* Result (full) */}
              <img src={zoomedItem.result_image_url} alt="Result" className="block w-full" />

              {/* Original (clipped) */}
              <div className="absolute inset-0 overflow-hidden" style={{ width: `${sliderPos}%` }}>
                <img
                  src={zoomedItem.original_image_url}
                  alt="Original"
                  className="block w-full"
                  style={{ width: containerRef.current?.offsetWidth || "100%" }}
                />
              </div>

              {/* Slider handle */}
              <div className="absolute top-0 bottom-0 z-10" style={{ left: `${sliderPos}%` }}>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-primary shadow-lg">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M7 4L3 10L7 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-primary-foreground" />
                    <path d="M13 4L17 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-primary-foreground" />
                  </svg>
                </div>
              </div>

              {/* Labels */}
              <div className="absolute top-3 left-3 rounded-md bg-primary/90 px-2 py-1 font-display text-xs font-semibold text-primary-foreground">אחרי</div>
              <div className="absolute top-3 right-3 rounded-md bg-foreground/70 px-2 py-1 font-display text-xs font-semibold text-card">לפני</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ResultsStrip;
