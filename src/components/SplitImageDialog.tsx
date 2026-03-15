import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  SplitSquareVertical, Plus, Database, Scissors, RefreshCw,
  LayoutGrid, Columns, Rows, GripVertical, GripHorizontal,
  Instagram, Move,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { splitImage, type SplitMode, type SplitOptions } from "@/lib/smart-image-tools";
import { toast } from "sonner";

type GridDirection = 'grid' | 'columns' | 'rows';

interface SplitImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  splitSource: string | null;
  onSelectSource: () => void;
  onUploadSource: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onSplitComplete: (parts: string[]) => void;
}

interface GridRect {
  /** Percentage 0-100 of the image from left */
  x: number;
  /** Percentage 0-100 of the image from top */
  y: number;
  /** Percentage 0-100 width */
  w: number;
  /** Percentage 0-100 height */
  h: number;
}

type HandleType = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se' | 'move' | null;

const CURSOR_MAP: Record<string, string> = {
  n: 'ns-resize', s: 'ns-resize',
  e: 'ew-resize', w: 'ew-resize',
  nw: 'nwse-resize', se: 'nwse-resize',
  ne: 'nesw-resize', sw: 'nesw-resize',
  move: 'grab',
};

export default function SplitImageDialog({
  open, onOpenChange, splitSource, onSelectSource, onUploadSource, fileInputRef, onSplitComplete,
}: SplitImageDialogProps) {
  const [splitMode, setSplitMode] = useState<SplitMode>('grid');
  const [gridDirection, setGridDirection] = useState<GridDirection>('grid');
  const [cols, setCols] = useState(3);
  const [rows, setRows] = useState(3);
  const [instagramAspect, setInstagramAspect] = useState<'1:1' | '4:5' | '16:9'>('1:1');
  const [processing, setProcessing] = useState(false);

  // Grid overlay rect (percentage of image)
  const [gridRect, setGridRect] = useState<GridRect>({ x: 0, y: 0, w: 100, h: 100 });

  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ type: HandleType; startX: number; startY: number; startRect: GridRect } | null>(null);

  // Reset grid rect when source changes
  useEffect(() => {
    setGridRect({ x: 0, y: 0, w: 100, h: 100 });
  }, [splitSource]);

  const effectiveCols = useMemo(() => gridDirection === 'rows' ? 1 : cols, [gridDirection, cols]);
  const effectiveRows = useMemo(() => gridDirection === 'columns' ? 1 : rows, [gridDirection, rows]);

  // Mouse handling for draggable grid
  const getRelativePos = useCallback((e: React.MouseEvent | MouseEvent) => {
    const container = containerRef.current;
    if (!container) return { px: 0, py: 0 };
    const rect = container.getBoundingClientRect();
    return {
      px: ((e.clientX - rect.left) / rect.width) * 100,
      py: ((e.clientY - rect.top) / rect.height) * 100,
    };
  }, []);

  const getHandleAtPos = useCallback((px: number, py: number): HandleType => {
    const g = gridRect;
    const margin = 4; // % tolerance
    const inX = px >= g.x - margin && px <= g.x + g.w + margin;
    const inY = py >= g.y - margin && py <= g.y + g.h + margin;
    const nearLeft = Math.abs(px - g.x) < margin && inY;
    const nearRight = Math.abs(px - (g.x + g.w)) < margin && inY;
    const nearTop = Math.abs(py - g.y) < margin && inX;
    const nearBottom = Math.abs(py - (g.y + g.h)) < margin && inX;

    if (nearTop && nearLeft) return 'nw';
    if (nearTop && nearRight) return 'ne';
    if (nearBottom && nearLeft) return 'sw';
    if (nearBottom && nearRight) return 'se';
    if (nearTop) return 'n';
    if (nearBottom) return 's';
    if (nearLeft) return 'w';
    if (nearRight) return 'e';
    if (px > g.x && px < g.x + g.w && py > g.y && py < g.y + g.h) return 'move';
    return null;
  }, [gridRect]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const { px, py } = getRelativePos(e);
    const type = getHandleAtPos(px, py);
    if (!type) return;
    e.preventDefault();
    dragRef.current = { type, startX: px, startY: py, startRect: { ...gridRect } };
  }, [getRelativePos, getHandleAtPos, gridRect]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) {
      // Just update cursor
      const { px, py } = getRelativePos(e);
      const handle = getHandleAtPos(px, py);
      const container = containerRef.current;
      if (container) container.style.cursor = handle ? CURSOR_MAP[handle] || 'default' : 'default';
      return;
    }
    e.preventDefault();
    const { px, py } = getRelativePos(e);
    const { type, startX, startY, startRect: sr } = dragRef.current;
    const dx = px - startX;
    const dy = py - startY;

    let newRect = { ...gridRect };

    if (type === 'move') {
      newRect.x = Math.max(0, Math.min(100 - sr.w, sr.x + dx));
      newRect.y = Math.max(0, Math.min(100 - sr.h, sr.y + dy));
      newRect.w = sr.w;
      newRect.h = sr.h;
    } else {
      let { x, y, w, h } = sr;
      if (type!.includes('w')) { x = sr.x + dx; w = sr.w - dx; }
      if (type!.includes('e')) { w = sr.w + dx; }
      if (type!.includes('n')) { y = sr.y + dy; h = sr.h - dy; }
      if (type!.includes('s')) { h = sr.h + dy; }

      // Min 10%
      if (w < 10) { w = 10; if (type!.includes('w')) x = sr.x + sr.w - 10; }
      if (h < 10) { h = 10; if (type!.includes('n')) y = sr.y + sr.h - 10; }

      // Clamp
      x = Math.max(0, x);
      y = Math.max(0, y);
      w = Math.min(w, 100 - x);
      h = Math.min(h, 100 - y);

      newRect = { x, y, w, h };
    }
    setGridRect(newRect);
  }, [getRelativePos, getHandleAtPos, gridRect]);

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // Execute split
  const handleSplit = useCallback(async () => {
    if (!splitSource) return;
    setProcessing(true);
    try {
      // Build regions based on gridRect and direction
      const regions: { x: number; y: number; w: number; h: number }[] = [];
      const ec = effectiveCols;
      const er = effectiveRows;
      const cellW = gridRect.w / ec;
      const cellH = gridRect.h / er;

      for (let r = 0; r < er; r++) {
        for (let c = 0; c < ec; c++) {
          regions.push({
            x: gridRect.x + c * cellW,
            y: gridRect.y + r * cellH,
            w: cellW,
            h: cellH,
          });
        }
      }

      const options: SplitOptions = {
        mode: 'free',
        cols: ec,
        rows: er,
        regions,
      };

      if (splitMode === 'instagram') {
        options.mode = 'instagram';
        options.cols = cols;
        options.instagramAspect = instagramAspect;
        const parts = await splitImage(splitSource, options);
        onSplitComplete(parts);
      } else {
        const parts = await splitImage(splitSource, options);
        onSplitComplete(parts);
      }

      toast.success(`פוצל ל-${regions.length} חלקים!`);
      onOpenChange(false);
    } catch {
      toast.error("שגיאה בפיצול");
    } finally {
      setProcessing(false);
    }
  }, [splitSource, splitMode, effectiveCols, effectiveRows, gridRect, cols, instagramAspect, onSplitComplete, onOpenChange]);

  const handleResetGrid = useCallback(() => {
    setGridRect({ x: 0, y: 0, w: 100, h: 100 });
  }, []);

  // Generate grid cell positions for the visual overlay
  const gridCells = useMemo(() => {
    if (splitMode === 'instagram') return [];
    const ec = effectiveCols;
    const er = effectiveRows;
    const cells: { left: string; top: string; width: string; height: string; index: number }[] = [];
    const cellW = gridRect.w / ec;
    const cellH = gridRect.h / er;
    let idx = 0;
    for (let r = 0; r < er; r++) {
      for (let c = 0; c < ec; c++) {
        cells.push({
          left: `${gridRect.x + c * cellW}%`,
          top: `${gridRect.y + r * cellH}%`,
          width: `${cellW}%`,
          height: `${cellH}%`,
          index: ++idx,
        });
      }
    }
    return cells;
  }, [effectiveCols, effectiveRows, gridRect, splitMode]);

  // Handle positions for visual indicators
  const handles = useMemo(() => {
    const g = gridRect;
    return [
      // Corners
      { type: 'nw', left: `${g.x}%`, top: `${g.y}%`, cursor: 'nwse-resize' },
      { type: 'ne', left: `${g.x + g.w}%`, top: `${g.y}%`, cursor: 'nesw-resize' },
      { type: 'sw', left: `${g.x}%`, top: `${g.y + g.h}%`, cursor: 'nesw-resize' },
      { type: 'se', left: `${g.x + g.w}%`, top: `${g.y + g.h}%`, cursor: 'nwse-resize' },
      // Edges
      { type: 'n', left: `${g.x + g.w / 2}%`, top: `${g.y}%`, cursor: 'ns-resize' },
      { type: 's', left: `${g.x + g.w / 2}%`, top: `${g.y + g.h}%`, cursor: 'ns-resize' },
      { type: 'w', left: `${g.x}%`, top: `${g.y + g.h / 2}%`, cursor: 'ew-resize' },
      { type: 'e', left: `${g.x + g.w}%`, top: `${g.y + g.h / 2}%`, cursor: 'ew-resize' },
    ];
  }, [gridRect]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SplitSquareVertical className="h-5 w-5" />פיצול תמונה לחלקים
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto">
          {/* Source selection */}
          {!splitSource && (
            <div className="flex gap-2">
              <label className="cursor-pointer flex-1">
                <Button variant="outline" className="w-full text-xs gap-1" asChild>
                  <span><Plus className="h-3.5 w-3.5" />העלה תמונה</span>
                </Button>
                <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={onUploadSource} />
              </label>
              <Button variant="outline" className="flex-1 text-xs gap-1" onClick={onSelectSource}>
                <Database className="h-3.5 w-3.5" />מהגלריה / ענן
              </Button>
            </div>
          )}

          {/* Image with interactive grid overlay */}
          {splitSource && (
            <div
              ref={containerRef}
              className="relative rounded-lg overflow-hidden border border-border bg-muted select-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <img src={splitSource} alt="source" className="w-full max-h-64 object-contain pointer-events-none" />

              {/* Darkened area outside grid */}
              <div className="absolute inset-0 pointer-events-none">
                {/* Top */}
                <div className="absolute bg-black/40" style={{ top: 0, left: 0, right: 0, height: `${gridRect.y}%` }} />
                {/* Bottom */}
                <div className="absolute bg-black/40" style={{ bottom: 0, left: 0, right: 0, height: `${100 - gridRect.y - gridRect.h}%` }} />
                {/* Left */}
                <div className="absolute bg-black/40" style={{ top: `${gridRect.y}%`, left: 0, width: `${gridRect.x}%`, height: `${gridRect.h}%` }} />
                {/* Right */}
                <div className="absolute bg-black/40" style={{ top: `${gridRect.y}%`, right: 0, width: `${100 - gridRect.x - gridRect.w}%`, height: `${gridRect.h}%` }} />
              </div>

              {/* Grid cells */}
              {splitMode !== 'instagram' && gridCells.map((cell) => (
                <div
                  key={cell.index}
                  className="absolute border border-primary/50 pointer-events-none flex items-center justify-center"
                  style={{ left: cell.left, top: cell.top, width: cell.width, height: cell.height }}
                >
                  <span className="bg-primary/70 text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-[9px] font-bold">
                    {cell.index}
                  </span>
                </div>
              ))}

              {/* Grid border */}
              <div
                className="absolute border-2 border-primary pointer-events-none"
                style={{ left: `${gridRect.x}%`, top: `${gridRect.y}%`, width: `${gridRect.w}%`, height: `${gridRect.h}%` }}
              />

              {/* Drag handles */}
              {handles.map((h) => (
                <div
                  key={h.type}
                  className="absolute w-3 h-3 bg-primary border-2 border-primary-foreground rounded-sm pointer-events-none -translate-x-1/2 -translate-y-1/2 shadow-md"
                  style={{ left: h.left, top: h.top }}
                />
              ))}

              {/* Dimensions badge */}
              <div className="absolute bottom-1 left-1 bg-black/70 text-white text-[9px] px-1.5 py-0.5 rounded font-mono pointer-events-none">
                {Math.round(gridRect.w)}% × {Math.round(gridRect.h)}%
              </div>
            </div>
          )}

          {/* Mode selection */}
          <div className="flex gap-1">
            <Button size="sm" variant={splitMode === 'grid' ? 'default' : 'outline'} className="flex-1 text-xs gap-1"
              onClick={() => setSplitMode('grid')}>
              <LayoutGrid className="h-3.5 w-3.5" />רשת
            </Button>
            <Button size="sm" variant={splitMode === 'instagram' ? 'default' : 'outline'} className="flex-1 text-xs gap-1"
              onClick={() => setSplitMode('instagram')}>
              <Instagram className="h-3.5 w-3.5" />אינסטגרם
            </Button>
          </div>

          {splitMode === 'grid' && (
            <div className="space-y-3">
              {/* Grid direction */}
              <div className="flex gap-1">
                <Button size="sm" variant={gridDirection === 'grid' ? 'default' : 'outline'} className="flex-1 text-[10px] gap-1"
                  onClick={() => setGridDirection('grid')}>
                  <LayoutGrid className="h-3 w-3" />שורות + עמודות
                </Button>
                <Button size="sm" variant={gridDirection === 'columns' ? 'default' : 'outline'} className="flex-1 text-[10px] gap-1"
                  onClick={() => setGridDirection('columns')}>
                  <Columns className="h-3 w-3" />עמודות בלבד
                </Button>
                <Button size="sm" variant={gridDirection === 'rows' ? 'default' : 'outline'} className="flex-1 text-[10px] gap-1"
                  onClick={() => setGridDirection('rows')}>
                  <Rows className="h-3 w-3" />שורות בלבד
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {gridDirection !== 'rows' && (
                  <div className="space-y-1">
                    <Label className="text-xs">עמודות: {cols}</Label>
                    <Slider value={[cols]} onValueChange={([v]) => setCols(v)} min={2} max={8} step={1} />
                  </div>
                )}
                {gridDirection !== 'columns' && (
                  <div className="space-y-1">
                    <Label className="text-xs">שורות: {rows}</Label>
                    <Slider value={[rows]} onValueChange={([v]) => setRows(v)} min={2} max={8} step={1} />
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  סה״כ {effectiveCols * effectiveRows} חלקים
                </span>
                <Button variant="ghost" size="sm" className="text-[10px] gap-1 h-6" onClick={handleResetGrid}>
                  <Move className="h-3 w-3" />איפוס מיקום
                </Button>
              </div>
            </div>
          )}

          {splitMode === 'instagram' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">מספר שקופיות: {cols}</Label>
                <Slider value={[cols]} onValueChange={([v]) => setCols(v)} min={2} max={10} step={1} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">יחס תצוגה</Label>
                <Select value={instagramAspect} onValueChange={(v) => setInstagramAspect(v as '1:1' | '4:5' | '16:9')}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1:1" className="text-xs">1:1 (ריבוע)</SelectItem>
                    <SelectItem value="4:5" className="text-xs">4:5 (פורטרט)</SelectItem>
                    <SelectItem value="16:9" className="text-xs">16:9 (רוחבי)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[10px] text-muted-foreground">
                פיצול לקרוסלה של {cols} תמונות לאינסטגרם
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={handleSplit} disabled={processing || !splitSource}>
            {processing ? <RefreshCw className="h-4 w-4 ml-2 animate-spin" /> : <Scissors className="h-4 w-4 ml-2" />}
            פצל והוסף לקולאז'
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
