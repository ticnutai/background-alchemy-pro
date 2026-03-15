import { useState, memo } from "react";
import { X, ZoomIn, Download, Trash2 } from "lucide-react";

interface ComparisonImage {
  image: string;
  label: string;
}

interface ComparisonGalleryProps {
  images: ComparisonImage[];
  originalImage: string | null;
  onClose: () => void;
  onSelect: (image: string) => void;
  onClear: () => void;
}

const ComparisonGallery = memo(({ images, originalImage, onClose, onSelect, onClear }: ComparisonGalleryProps) => {
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "side-by-side">("grid");

  if (images.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 backdrop-blur-sm p-4" dir="rtl">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl p-8 text-center">
          <p className="font-display text-lg font-bold text-foreground mb-2">אין תמונות להשוואה</p>
          <p className="font-body text-sm text-muted-foreground mb-4">כל תוצאת עיבוד נשמרת כאן אוטומטית</p>
          <button onClick={onClose} className="rounded-lg bg-primary px-6 py-2 font-display text-sm text-primary-foreground">סגור</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 backdrop-blur-sm p-4" dir="rtl">
      <div className="w-full max-w-5xl max-h-[90vh] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-lg font-bold text-foreground">השוואת גרסאות</h2>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-accent text-xs font-semibold text-primary">
              {images.length} גרסאות
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === "grid" ? "side-by-side" : "grid")}
              className="rounded-lg border border-border px-3 py-1.5 font-accent text-xs text-foreground hover:bg-secondary transition-colors"
            >
              {viewMode === "grid" ? "📊 צד-צד" : "⊞ רשת"}
            </button>
            <button
              onClick={onClear}
              className="rounded-lg border border-destructive/30 px-3 py-1.5 font-accent text-xs text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1"
            >
              <Trash2 className="h-3 w-3" /> נקה הכל
            </button>
            <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-secondary transition-colors">
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {viewMode === "grid" ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {/* Original */}
              {originalImage && (
                <div className="relative group rounded-xl border-2 border-dashed border-border overflow-hidden bg-secondary/30">
                  <div className="aspect-square overflow-hidden">
                    <img src={originalImage} alt="מקור" className="h-full w-full object-contain p-2" />
                  </div>
                  <div className="p-2 text-center border-t border-border">
                    <p className="font-display text-xs font-semibold text-muted-foreground">🔵 מקור</p>
                  </div>
                </div>
              )}
              {/* Versions */}
              {images.map((img, i) => (
                <div key={i} className="relative group rounded-xl border-2 border-border overflow-hidden bg-card hover:border-gold/50 hover:shadow-lg transition-all cursor-pointer" onClick={() => onSelect(img.image)}>
                  <div className="aspect-square overflow-hidden">
                    <img src={img.image} alt={img.label} className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-105" />
                  </div>
                  <div className="p-2 text-center border-t border-border">
                    <p className="font-display text-xs font-semibold text-foreground truncate">{img.label || `גרסה ${i + 1}`}</p>
                  </div>
                  <div className="absolute top-1.5 left-1.5 rounded-full bg-primary/90 px-2 py-0.5 font-accent text-[10px] font-bold text-primary-foreground">
                    {i + 1}
                  </div>
                  <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); setZoomImage(img.image); }}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-background/80 border border-border shadow-sm hover:bg-primary/10"
                    >
                      <ZoomIn className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Side-by-side */
            <div className="flex gap-4 overflow-x-auto pb-4">
              {originalImage && (
                <div className="shrink-0 w-80">
                  <div className="rounded-xl border-2 border-dashed border-border overflow-hidden bg-secondary/30">
                    <img src={originalImage} alt="מקור" className="w-full object-contain" />
                    <div className="p-2 text-center border-t border-border">
                      <p className="font-display text-xs font-semibold text-muted-foreground">🔵 מקור</p>
                    </div>
                  </div>
                </div>
              )}
              {images.map((img, i) => (
                <div key={i} className="shrink-0 w-80 cursor-pointer" onClick={() => onSelect(img.image)}>
                  <div className="rounded-xl border-2 border-border overflow-hidden bg-card hover:border-gold/50 hover:shadow-lg transition-all">
                    <img src={img.image} alt={img.label} className="w-full object-contain" />
                    <div className="p-2 text-center border-t border-border">
                      <p className="font-display text-xs font-semibold text-foreground truncate">{img.label || `גרסה ${i + 1}`}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Zoom overlay */}
      {zoomImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/80 backdrop-blur-md p-8" onClick={() => setZoomImage(null)}>
          <img src={zoomImage} alt="zoom" className="max-h-full max-w-full rounded-xl shadow-2xl" />
        </div>
      )}
    </div>
  );
});

ComparisonGallery.displayName = "ComparisonGallery";

export default ComparisonGallery;
