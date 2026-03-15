import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Sparkles, FolderPlus, Folder, Heart, Trash2, Download, ZoomIn, X, ArrowRight,
  ChevronLeft, ChevronRight, Maximize2, Minimize2, LogIn, Search, SlidersHorizontal,
  Grid, Columns2, Pin, Wand2, Eye, GripVertical, Home, Pencil, ChevronDown, Copy,
  FolderInput, LayoutGrid, BookOpen, Info,
} from "lucide-react";
import ImageHoverMenu from "@/components/ImageHoverMenu";
import type { User } from "@supabase/supabase-js";
import ImageAdjustmentsPanel, { getFilterString, defaultAdjustments, type ImageAdjustments } from "@/components/ImageAdjustmentsPanel";

interface HistoryItem {
  id: string;
  original_image_url: string;
  result_image_url: string;
  background_prompt: string;
  background_name: string | null;
  is_favorite: boolean;
  created_at: string;
  folder_id: string | null;
}

interface ImageFolder {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

const EXPORT_FORMATS = [
  { id: "png", label: "PNG", mime: "image/png", desc: "שקיפות, lossless" },
  { id: "jpg", label: "JPG", mime: "image/jpeg", desc: "קובץ קטן" },
  { id: "webp", label: "WebP", mime: "image/webp", desc: "מודרני, קל" },
  { id: "tiff", label: "TIFF", mime: "image/tiff", desc: "איכות מקסימלית, הדפסה" },
  { id: "pdf", label: "PDF", mime: "application/pdf", desc: "מסמך להדפסה" },
];

async function downloadImage(url: string, filename: string, format: string = "png") {
  try {
    toast.loading("מוריד...", { id: "dl" });
    const response = await fetch(url);
    const blob = await response.blob();
    const img = new Image();
    img.crossOrigin = "anonymous";
    const blobUrl = URL.createObjectURL(blob);

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = blobUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(blobUrl);

    const baseName = (filename || "image").replace(/\.[^.]+$/, "");

    if (format === "pdf") {
      const dataUrl = canvas.toDataURL("image/png", 1);
      const pdfBlob = await generateSimplePDF(dataUrl, canvas.width, canvas.height);
      triggerDownload(pdfBlob, `${baseName}.pdf`);
    } else if (format === "tiff") {
      // Generate uncompressed TIFF from canvas pixel data
      const tiffBlob = generateTIFF(canvas);
      triggerDownload(tiffBlob, `${baseName}.tiff`);
    } else {
      const fmt = EXPORT_FORMATS.find(f => f.id === format) || EXPORT_FORMATS[0];
      const quality = format === "png" ? 1 : 0.95;
      const exportBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          b => b ? resolve(b) : reject(new Error("blob failed")),
          fmt.mime,
          quality
        );
      });
      triggerDownload(exportBlob, `${baseName}.${format}`);
    }

    toast.success("התמונה הורדה בהצלחה!", { id: "dl" });
  } catch {
    toast.error("שגיאה בהורדת התמונה", { id: "dl" });
  }
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function generateSimplePDF(imageDataUrl: string, w: number, h: number): Promise<Blob> {
  const imgData = imageDataUrl.split(",")[1];
  const binary = atob(imgData);
  const imgBytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) imgBytes[i] = binary.charCodeAt(i);
  const scale = Math.min(575 / w, 822 / h);
  const pw = Math.round(w * scale);
  const ph = Math.round(h * scale);
  const pageW = Math.max(pw + 20, 595);
  const pageH = Math.max(ph + 20, 842);
  const xOff = Math.round((pageW - pw) / 2);
  const yOff = Math.round((pageH - ph) / 2);
  const stream = `q ${pw} 0 0 ${ph} ${xOff} ${pageH - yOff - ph} cm /Img Do Q`;
  const streamLen = imgBytes.length;
  const objs: string[] = [];
  objs.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  objs.push(`2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`);
  objs.push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents 4 0 R /Resources << /XObject << /Img 5 0 R >> >> >>\nendobj\n`);
  objs.push(`4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`);
  const header = `%PDF-1.4\n`;
  const body = objs.join("");
  const imgObjH = `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${streamLen} >>\nstream\n`;
  const imgObjF = `\nendstream\nendobj\n`;
  const enc = new TextEncoder();
  const p1 = enc.encode(header + body + imgObjH);
  const p2 = enc.encode(imgObjF);
  const xrefPos = p1.length + imgBytes.length + p2.length;
  let xref = `xref\n0 6\n0000000000 65535 f \n`;
  let offset = header.length;
  for (const obj of objs) { xref += `${String(offset).padStart(10, "0")} 00000 n \n`; offset += obj.length; }
  xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  const p3 = enc.encode(xref + trailer);
  const final = new Uint8Array(p1.length + imgBytes.length + p2.length + p3.length);
  final.set(p1, 0);
  final.set(imgBytes, p1.length);
  final.set(p2, p1.length + imgBytes.length);
  final.set(p3, p1.length + imgBytes.length + p2.length);
  return new Blob([final], { type: "application/pdf" });
}

function generateTIFF(canvas: HTMLCanvasElement): Blob {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.getImageData(0, 0, w, h);
  const rgba = imageData.data;
  // Convert RGBA to RGB
  const rgb = new Uint8Array(w * h * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    rgb[j] = rgba[i];
    rgb[j + 1] = rgba[i + 1];
    rgb[j + 2] = rgba[i + 2];
  }
  const stripSize = rgb.length;
  const headerSize = 8;
  const ifdEntryCount = 10;
  const ifdSize = 2 + ifdEntryCount * 12 + 4;
  const dataOffset = headerSize + ifdSize;

  const buf = new ArrayBuffer(dataOffset + stripSize);
  const view = new DataView(buf);
  const arr = new Uint8Array(buf);

  // Header: little-endian TIFF
  view.setUint16(0, 0x4949, false); // 'II'
  view.setUint16(2, 42, true);
  view.setUint32(4, headerSize, true); // IFD offset

  let off = headerSize;
  // IFD entry count
  view.setUint16(off, ifdEntryCount, true); off += 2;

  const writeIFD = (tag: number, type: number, count: number, value: number) => {
    view.setUint16(off, tag, true); off += 2;
    view.setUint16(off, type, true); off += 2;
    view.setUint32(off, count, true); off += 4;
    view.setUint32(off, value, true); off += 4;
  };

  writeIFD(256, 3, 1, w);            // ImageWidth
  writeIFD(257, 3, 1, h);            // ImageLength
  writeIFD(258, 3, 3, 8 | (8 << 16)); // BitsPerSample (8,8,8 packed)
  writeIFD(259, 3, 1, 1);            // Compression: None
  writeIFD(262, 3, 1, 2);            // PhotometricInterpretation: RGB
  writeIFD(273, 4, 1, dataOffset);   // StripOffsets
  writeIFD(277, 3, 1, 3);            // SamplesPerPixel
  writeIFD(278, 4, 1, h);            // RowsPerStrip
  writeIFD(279, 4, 1, stripSize);    // StripByteCounts
  writeIFD(282, 5, 1, 0);            // XResolution (simplified)

  // Next IFD = 0
  view.setUint32(off, 0, true);

  // Write RGB data
  arr.set(rgb, dataOffset);

  return new Blob([buf], { type: "image/tiff" });
}

type ViewMode = "grid" | "single" | "sideBySide";

interface ImageMeta { width: number; height: number; sizeKB: number | null }

const ImageInfoBadge = ({ url }: { url: string }) => {
  const [meta, setMeta] = useState<ImageMeta | null>(null);
  const [show, setShow] = useState(false);
  const loaded = useRef(false);

  const loadMeta = () => {
    setShow(true);
    if (loaded.current) return;
    loaded.current = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // Try to get file size
      fetch(url, { method: "HEAD" }).then(r => {
        const cl = r.headers.get("content-length");
        setMeta({ width: img.naturalWidth, height: img.naturalHeight, sizeKB: cl ? Math.round(parseInt(cl) / 1024) : null });
      }).catch(() => {
        setMeta({ width: img.naturalWidth, height: img.naturalHeight, sizeKB: null });
      });
    };
    img.onerror = () => setMeta({ width: 0, height: 0, sizeKB: null });
    img.src = url;
  };

  const quality = meta ? (
    meta.width >= 3000 ? "גבוהה מאוד" :
    meta.width >= 2000 ? "גבוהה" :
    meta.width >= 1000 ? "טובה" : "בסיסית"
  ) : "";

  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={loadMeta}
        onMouseLeave={() => setShow(false)}
        onClick={e => { e.stopPropagation(); loadMeta(); }}
        className="rounded-full p-0.5 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
      >
        <Info className="h-3 w-3" />
      </button>
      {show && meta && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-30 whitespace-nowrap rounded-lg bg-foreground text-card px-2.5 py-1.5 text-[10px] font-accent shadow-lg animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center gap-2">
            <span>{meta.width}×{meta.height}</span>
            <span className="w-px h-3 bg-card/30" />
            <span>איכות: {quality}</span>
            {meta.sizeKB && <>
              <span className="w-px h-3 bg-card/30" />
              <span>{meta.sizeKB > 1024 ? `${(meta.sizeKB / 1024).toFixed(1)} MB` : `${meta.sizeKB} KB`}</span>
            </>}
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-foreground rotate-45 -mt-1" />
        </div>
      )}
    </div>
  );
};

const Gallery = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [folders, setFolders] = useState<ImageFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "favorites">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Zoom / comparison state
  const [zoomedItem, setZoomedItem] = useState<HistoryItem | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareItems, setCompareItems] = useState<HistoryItem[]>([]);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panPos, setPanPos] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [showOriginal, setShowOriginal] = useState(false);

  // New: view mode, adjustments, side-by-side
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [adjustments, setAdjustments] = useState<ImageAdjustments>(defaultAdjustments);
  const [showAdjustments, setShowAdjustments] = useState(false);
  const [pinnedItem, setPinnedItem] = useState<HistoryItem | null>(null);
  const [sideBySideIndex, setSideBySideIndex] = useState(0);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [showCompareView, setShowCompareView] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) loadData();
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadData();
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [histRes, foldRes] = await Promise.all([
      supabase.from("processing_history").select("*").order("created_at", { ascending: false }),
      supabase.from("image_folders").select("*").order("created_at", { ascending: false }),
    ]);
    if (histRes.data) setItems(histRes.data as HistoryItem[]);
    if (foldRes.data) setFolders(foldRes.data as ImageFolder[]);
    setLoading(false);
  };

  const createFolder = async () => {
    if (!newFolderName.trim() || !user) return;
    const { data, error } = await supabase.from("image_folders").insert({
      user_id: user.id,
      name: newFolderName.trim(),
    }).select().single();
    if (error) { toast.error("שגיאה ביצירת תיקייה"); return; }
    setFolders(prev => [data as ImageFolder, ...prev]);
    setNewFolderName("");
    setShowNewFolder(false);
    toast.success("תיקייה נוצרה!");
  };

  const deleteFolder = async (id: string) => {
    await supabase.from("image_folders").delete().eq("id", id);
    setFolders(prev => prev.filter(f => f.id !== id));
    if (activeFolder === id) setActiveFolder(null);
    toast.success("תיקייה נמחקה");
  };

  const moveToFolder = async (itemId: string, folderId: string | null) => {
    await supabase.from("processing_history").update({ folder_id: folderId }).eq("id", itemId);
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, folder_id: folderId } : i));
    toast.success(folderId ? "הועבר לתיקייה" : "הוסר מהתיקייה");
  };

  const toggleFavorite = async (item: HistoryItem) => {
    const newVal = !item.is_favorite;
    await supabase.from("processing_history").update({ is_favorite: newVal }).eq("id", item.id);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_favorite: newVal } : i));
    if (zoomedItem?.id === item.id) setZoomedItem({ ...item, is_favorite: newVal });
  };

  const confirmDeleteItem = (id: string) => {
    setDeleteConfirmId(id);
  };

  const deleteItem = async (id: string) => {
    await supabase.from("processing_history").delete().eq("id", id);
    setItems(prev => prev.filter(i => i.id !== id));
    if (zoomedItem?.id === id) setZoomedItem(null);
    setDeleteConfirmId(null);
    toast.success("נמחק");
  };

  const duplicateItem = async (item: HistoryItem, openInEditor = false) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("processing_history")
      .insert({
        user_id: user.id,
        original_image_url: item.original_image_url,
        result_image_url: item.result_image_url,
        background_prompt: item.background_prompt,
        background_name: item.background_name ? `${item.background_name} (עותק)` : "עותק",
        is_favorite: false,
        folder_id: item.folder_id,
      })
      .select()
      .single();
    if (error) {
      toast.error("שגיאה בשכפול");
    } else if (data) {
      setItems(prev => [data as HistoryItem, ...prev]);
      if (openInEditor) {
        toast.success("העותק נוצר! פותח בעורך... ✨");
        navigate(`/tool?editImage=${encodeURIComponent(item.result_image_url)}`);
      } else {
        toast.success("התמונה שוכפלה! ערוך את העותק בלי לפגוע במקור ✨");
      }
    }
  };

  const toggleCompareItem = (item: HistoryItem) => {
    setCompareItems(prev => {
      const exists = prev.find(i => i.id === item.id);
      if (exists) return prev.filter(i => i.id !== item.id);
      if (prev.length >= 4) { toast.info("ניתן להשוות עד 4 תמונות"); return prev; }
      return [...prev, item];
    });
  };

  const handleZoomWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoomLevel(prev => Math.max(1, Math.min(5, prev + (e.deltaY > 0 ? -0.3 : 0.3))));
  };

  const handlePanStart = (e: React.MouseEvent) => {
    if (zoomLevel <= 1) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - panPos.x, y: e.clientY - panPos.y });
  };

  const handlePanMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPanPos({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  };

  // Keyboard navigation in zoom modal
  useEffect(() => {
    if (!zoomedItem) return;
    const handler = (e: KeyboardEvent) => {
      const idx = filtered.findIndex(i => i.id === zoomedItem.id);
      if (e.key === "ArrowLeft" && idx < filtered.length - 1) {
        setZoomedItem(filtered[idx + 1]);
        setAdjustments(defaultAdjustments);
      } else if (e.key === "ArrowRight" && idx > 0) {
        setZoomedItem(filtered[idx - 1]);
        setAdjustments(defaultAdjustments);
      } else if (e.key === "Escape") {
        setZoomedItem(null);
        setZoomLevel(1);
        setPanPos({ x: 0, y: 0 });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [zoomedItem, items, activeFolder, filter, searchQuery]);

  // Side-by-side keyboard navigation
  useEffect(() => {
    if (viewMode !== "sideBySide" || !pinnedItem) return;
    const others = filtered.filter(i => i.id !== pinnedItem.id);
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setSideBySideIndex(prev => Math.min(others.length - 1, prev + 1));
      else if (e.key === "ArrowRight") setSideBySideIndex(prev => Math.max(0, prev - 1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [viewMode, pinnedItem, items, activeFolder, filter, searchQuery]);

  // Filtered items
  let filtered = items;
  if (activeFolder) filtered = filtered.filter(i => i.folder_id === activeFolder);
  if (filter === "favorites") filtered = filtered.filter(i => i.is_favorite);
  if (searchQuery.trim()) filtered = filtered.filter(i =>
    (i.background_name || i.background_prompt).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filterStyle = getFilterString(adjustments);

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <div className="text-center space-y-4">
          <h2 className="font-display text-2xl font-bold text-foreground">גלריית תמונות</h2>
          <p className="font-body text-muted-foreground">התחבר כדי לראות את התמונות שלך</p>
          <Link to="/auth" className="inline-flex items-center gap-2 rounded-lg bg-gold px-6 py-3 font-display text-sm font-semibold text-gold-foreground">
            <LogIn className="h-4 w-4" /> התחבר
          </Link>
        </div>
      </div>
    );
  }

  const sideBySideOthers = pinnedItem ? filtered.filter(i => i.id !== pinnedItem.id) : [];
  const sideBySideCurrent = sideBySideOthers[sideBySideIndex] || null;

  return (
    <div className="min-h-screen bg-background font-body" dir="rtl">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </Link>
            <h1 className="font-display text-xl font-bold text-foreground">גלריית תמונות</h1>
            <span className="rounded-full bg-gold/10 px-2.5 py-0.5 font-accent text-xs text-gold">{items.length} תמונות</span>
          </div>
          <div className="flex items-center gap-3">
            {/* View mode toggle */}
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 transition-colors ${viewMode === "grid" ? "bg-gold text-gold-foreground" : "text-muted-foreground hover:text-foreground"}`}
                title="תצוגת רשת"
              >
                <Grid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("sideBySide")}
                className={`p-2 transition-colors ${viewMode === "sideBySide" ? "bg-gold text-gold-foreground" : "text-muted-foreground hover:text-foreground"}`}
                title="תצוגה זו ליד זו"
              >
                <Columns2 className="h-4 w-4" />
              </button>
            </div>
            <Link to="/" className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 font-accent text-xs font-semibold text-foreground transition-colors hover:border-gold/40">
              <Home className="h-3.5 w-3.5" /> דף הבית
            </Link>
            <Link to="/tool" className="flex items-center gap-2 rounded-full bg-accent px-4 py-2 font-accent text-xs font-semibold text-accent-foreground transition-all hover:brightness-110">
              <Sparkles className="h-3.5 w-3.5" /> לכלי העריכה
            </Link>
            <button
              onClick={() => navigate(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:text-foreground hover:border-gold/40"
              title="חזור"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        <div className="flex gap-6">
          {/* Sidebar - Folders */}
          <div className="w-56 shrink-0 space-y-3">
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-bold text-foreground">תיקיות</h3>
                <button onClick={() => setShowNewFolder(!showNewFolder)} className="rounded-md p-1 hover:bg-secondary transition-colors">
                  <FolderPlus className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              {showNewFolder && (
                <div className="flex gap-2">
                  <input
                    value={newFolderName}
                    onChange={e => setNewFolderName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && createFolder()}
                    placeholder="שם התיקייה..."
                    className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 font-body text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold"
                  />
                  <button onClick={createFolder} className="rounded-md bg-gold px-2 py-1.5 font-accent text-xs text-gold-foreground">צור</button>
                </div>
              )}

              <button
                onClick={() => setActiveFolder(null)}
                onDragOver={e => { e.preventDefault(); setDragOverFolderId("__all__"); }}
                onDragLeave={() => setDragOverFolderId(null)}
                onDrop={e => { e.preventDefault(); setDragOverFolderId(null); if (draggedItemId) { moveToFolder(draggedItemId, null); setDraggedItemId(null); } }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 font-accent text-xs transition-colors ${
                  dragOverFolderId === "__all__" ? "bg-gold/20 border-2 border-dashed border-gold" :
                  !activeFolder ? "bg-gold/10 text-gold font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <Folder className="h-3.5 w-3.5" /> הכל ({items.length})
              </button>

              {folders.map(folder => {
                const count = items.filter(i => i.folder_id === folder.id).length;
                return (
                  <div key={folder.id} className="group flex items-center gap-1">
                    <button
                      onClick={() => setActiveFolder(folder.id)}
                      onDragOver={e => { e.preventDefault(); setDragOverFolderId(folder.id); }}
                      onDragLeave={() => setDragOverFolderId(null)}
                      onDrop={e => { e.preventDefault(); setDragOverFolderId(null); if (draggedItemId) { moveToFolder(draggedItemId, folder.id); setDraggedItemId(null); } }}
                      className={`flex flex-1 items-center gap-2 rounded-lg px-3 py-2 font-accent text-xs transition-colors ${
                        dragOverFolderId === folder.id ? "bg-gold/20 border-2 border-dashed border-gold" :
                        activeFolder === folder.id ? "bg-gold/10 text-gold font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                      }`}
                    >
                      <Folder className="h-3.5 w-3.5" style={{ color: folder.color }} />
                      <span className="truncate">{folder.name}</span>
                      <span className="mr-auto text-muted-foreground">({count})</span>
                    </button>
                    <button
                      onClick={() => deleteFolder(folder.id)}
                      className="rounded p-1 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-all"
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Filters */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <h3 className="font-display text-sm font-bold text-foreground">סינון</h3>
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => setFilter("all")}
                  className={`flex-1 px-3 py-1.5 font-accent text-xs transition-colors ${
                    filter === "all" ? "bg-gold text-gold-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >הכל</button>
                <button
                  onClick={() => setFilter("favorites")}
                  className={`flex-1 px-3 py-1.5 font-accent text-xs transition-colors ${
                    filter === "favorites" ? "bg-gold text-gold-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >⭐ מועדפים</button>
              </div>

              <div className="relative">
                <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="חפש לפי שם..."
                  className="w-full rounded-md border border-border bg-background py-1.5 pr-8 pl-2 font-body text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold"
                />
              </div>

              <button
                onClick={() => { setCompareMode(!compareMode); setCompareItems([]); }}
                className={`w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 font-accent text-xs transition-colors ${
                  compareMode ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {compareMode ? "ביטול השוואה" : "מצב השוואה"}
              </button>
            </div>
          </div>

          {/* Main content area */}
          <div className="flex-1">
            {/* Compare strip */}
            {compareMode && compareItems.length > 0 && (
              <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-display text-sm font-bold text-foreground">השוואה ({compareItems.length}/4)</span>
                  <div className="flex items-center gap-2">
                    {compareItems.length >= 2 && (
                      <button
                        onClick={() => setShowCompareView(true)}
                        className="rounded-lg bg-gold px-4 py-1.5 font-display text-xs font-semibold text-gold-foreground transition-all hover:brightness-110"
                      >
                        צור השוואה
                      </button>
                    )}
                    <button onClick={() => setCompareItems([])} className="font-accent text-xs text-muted-foreground hover:text-foreground">נקה</button>
                  </div>
                </div>
                <div className="flex gap-3">
                  {compareItems.map(item => (
                    <div key={item.id} className="relative w-40 aspect-square rounded-lg overflow-hidden border border-border group">
                      <img src={item.result_image_url} alt="" className="h-full w-full object-cover" />
                      <button
                        onClick={() => toggleCompareItem(item)}
                        className="absolute top-1 right-1 rounded-full bg-foreground/60 p-1 text-card opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <p className="absolute bottom-1 left-1 right-1 rounded bg-foreground/70 px-1.5 py-0.5 font-accent text-[10px] text-card truncate text-center">
                        {item.background_name || "רקע מותאם"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Side-by-side instructions */}
            {viewMode === "sideBySide" && !pinnedItem && (
              <div className="mb-4 rounded-xl border border-gold/30 bg-gold/5 p-4 text-center">
                <Pin className="h-5 w-5 text-gold mx-auto mb-2" />
                <p className="font-display text-sm font-bold text-foreground">בחר תמונה לנעוץ</p>
                <p className="font-body text-xs text-muted-foreground">לחץ על 📌 כדי לנעוץ תמונה בצד שמאל, ואז השתמש בחיצים כדי להחליף רקעים בצד ימין</p>
              </div>
            )}

            {/* Side-by-side view */}
            {viewMode === "sideBySide" && pinnedItem && (
              <div className="mb-6 rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Pin className="h-4 w-4 text-gold" />
                    <span className="font-display text-sm font-bold text-foreground">השוואה זו ליד זו</span>
                    <span className="font-accent text-xs text-muted-foreground">
                      (חיצים ← → להחלפה)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-accent text-xs text-muted-foreground">
                      {sideBySideOthers.length > 0 ? `${sideBySideIndex + 1}/${sideBySideOthers.length}` : ""}
                    </span>
                    <button onClick={() => { setPinnedItem(null); setSideBySideIndex(0); }} className="rounded-md p-1 hover:bg-secondary transition-colors">
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
                <div className="flex">
                  {/* Pinned (left) */}
                  <div className="flex-1 border-l border-border p-3">
                    <div className="aspect-square rounded-lg overflow-hidden bg-secondary mb-2">
                      <img src={pinnedItem.result_image_url} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Pin className="h-3 w-3 text-gold shrink-0" />
                      <p className="font-display text-xs font-semibold text-foreground truncate">{pinnedItem.background_name || "נעוץ"}</p>
                    </div>
                  </div>

                  {/* Comparison (right) with arrows */}
                  <div className="flex-1 p-3 relative">
                    {sideBySideCurrent ? (
                      <>
                        <div className="aspect-square rounded-lg overflow-hidden bg-secondary mb-2 relative">
                          <img src={sideBySideCurrent.result_image_url} alt="" className="h-full w-full object-cover" />
                          {/* Navigation arrows */}
                          {sideBySideIndex > 0 && (
                            <button
                              onClick={() => setSideBySideIndex(prev => prev - 1)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-card/90 shadow-md hover:bg-primary transition-colors"
                            >
                              <ChevronRight className="h-4 w-4 text-foreground" />
                            </button>
                          )}
                          {sideBySideIndex < sideBySideOthers.length - 1 && (
                            <button
                              onClick={() => setSideBySideIndex(prev => prev + 1)}
                              className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-card/90 shadow-md hover:bg-primary transition-colors"
                            >
                              <ChevronLeft className="h-4 w-4 text-foreground" />
                            </button>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="font-display text-xs font-semibold text-foreground truncate">{sideBySideCurrent.background_name || "רקע מותאם"}</p>
                          <div className="flex gap-1">
                            <button onClick={() => toggleFavorite(sideBySideCurrent)} className="rounded p-1 hover:bg-secondary transition-colors">
                              <Heart className={`h-3.5 w-3.5 ${sideBySideCurrent.is_favorite ? "fill-gold text-gold" : "text-muted-foreground"}`} />
                            </button>
                            <button onClick={() => { setPinnedItem(sideBySideCurrent); setSideBySideIndex(0); }} className="rounded p-1 hover:bg-secondary transition-colors" title="נעץ תמונה זו">
                              <Pin className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="aspect-square rounded-lg bg-secondary flex items-center justify-center">
                        <p className="font-body text-xs text-muted-foreground">אין עוד תמונות להשוואה</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Thumbnails strip */}
                {sideBySideOthers.length > 0 && (
                  <div className="flex gap-1.5 px-3 pb-3 overflow-x-auto">
                    {sideBySideOthers.map((item, idx) => (
                      <button
                        key={item.id}
                        onClick={() => setSideBySideIndex(idx)}
                        className={`shrink-0 w-14 h-14 rounded-md overflow-hidden border-2 transition-all ${
                          idx === sideBySideIndex ? "border-gold" : "border-transparent hover:border-border"
                        }`}
                      >
                        <img src={item.result_image_url} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20">
                <p className="font-body text-sm text-muted-foreground">
                  {activeFolder ? "אין תמונות בתיקייה הזו" : "אין תמונות עדיין — לך לכלי העריכה!"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filtered.map(item => (
                  <ImageHoverMenu
                    key={item.id}
                    imageUrl={item.result_image_url}
                    isFavorite={item.is_favorite}
                    isComparing={!!compareItems.find(c => c.id === item.id)}
                    folders={folders}
                    currentFolderId={item.folder_id}
                    hoverDelay={800}
                    className={`group rounded-xl border overflow-hidden bg-card transition-all hover:shadow-lg cursor-pointer ${
                      draggedItemId === item.id ? "opacity-50 scale-95" :
                      compareMode && compareItems.find(c => c.id === item.id)
                        ? "border-primary ring-2 ring-primary/30"
                        : pinnedItem?.id === item.id
                        ? "border-gold ring-2 ring-gold/30"
                        : "border-border hover:border-gold/40"
                    }`}
                    actions={{
                      onFavorite: () => toggleFavorite(item),
                      onZoom: () => setZoomedItem(item),
                      onEdit: () => navigate(`/tool?editImage=${encodeURIComponent(item.result_image_url)}`),
                      onDuplicate: () => duplicateItem(item),
                      onCompare: () => {
                        if (!compareMode) setCompareMode(true);
                        toggleCompareItem(item);
                      },
                      onCollage: () => navigate(`/collage?importImage=${encodeURIComponent(item.result_image_url)}`),
                      onCatalog: () => navigate(`/catalog?importImage=${encodeURIComponent(item.result_image_url)}`),
                      onDelete: () => confirmDeleteItem(item.id),
                      onDownload: () => downloadImage(item.result_image_url, item.background_name || "image"),
                      onMoveToFolder: (fId) => moveToFolder(item.id, fId),
                    }}
                  >
                    <div
                      draggable
                      onDragStart={() => setDraggedItemId(item.id)}
                      onDragEnd={() => setDraggedItemId(null)}
                      onClick={() => compareMode ? toggleCompareItem(item) : setZoomedItem(item)}
                    >
                      <div className="aspect-square overflow-hidden">
                        <img src={item.result_image_url} alt={item.background_name || ""} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" draggable={false} />
                      </div>
                      <div className="p-2.5">
                        <p className="font-display text-xs font-semibold text-foreground truncate">{item.background_name || "רקע מותאם"}</p>
                        <div className="flex items-center justify-between">
                          <p className="font-body text-[10px] text-muted-foreground">{new Date(item.created_at).toLocaleDateString("he-IL")}</p>
                          <ImageInfoBadge url={item.result_image_url} />
                        </div>
                      </div>

                      {/* Drag indicator */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-60 transition-opacity">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                      </div>

                      {item.is_favorite && (
                        <div className="absolute top-2 left-2"><span className="text-xs">⭐</span></div>
                      )}

                      {compareMode && compareItems.find(c => c.id === item.id) && (
                        <div className="absolute inset-0 bg-primary/10 flex items-center justify-center pointer-events-none">
                          <div className="rounded-full bg-primary text-primary-foreground w-6 h-6 flex items-center justify-center font-accent text-xs font-bold">
                            {compareItems.findIndex(c => c.id === item.id) + 1}
                          </div>
                        </div>
                      )}
                    </div>
                  </ImageHoverMenu>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Full Compare View Modal */}
      {showCompareView && compareItems.length >= 2 && (
        <div className="fixed inset-0 z-50 bg-foreground/80 backdrop-blur-sm flex flex-col" onClick={() => setShowCompareView(false)}>
          <div className="flex items-center justify-between bg-card px-6 py-4 border-b border-border" dir="rtl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <SlidersHorizontal className="h-5 w-5 text-gold" />
              <h2 className="font-display text-lg font-bold text-foreground">השוואת תמונות</h2>
              <span className="font-accent text-xs text-muted-foreground">{compareItems.length} תמונות</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setShowCompareView(false); setCompareMode(false); setCompareItems([]); }}
                className="rounded-lg border border-border px-4 py-2 font-accent text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                סיום השוואה
              </button>
              <button onClick={() => setShowCompareView(false)} className="rounded-lg p-2 hover:bg-secondary transition-colors">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
          </div>
          <div
            className={`flex-1 p-6 overflow-auto grid gap-4 ${
              compareItems.length === 2 ? "grid-cols-2" : compareItems.length === 3 ? "grid-cols-3" : "grid-cols-2 lg:grid-cols-4"
            }`}
            onClick={e => e.stopPropagation()}
          >
            {compareItems.map((item, idx) => (
              <div key={item.id} className="flex flex-col rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex-1 flex items-center justify-center bg-foreground/5 p-2">
                  <img src={item.result_image_url} alt="" className="max-h-[65vh] w-full object-contain" />
                </div>
                <div className="flex items-center justify-between p-3 border-t border-border">
                  <div>
                    <p className="font-display text-sm font-bold text-foreground">{item.background_name || "רקע מותאם"}</p>
                    <p className="font-body text-[10px] text-muted-foreground">{new Date(item.created_at).toLocaleDateString("he-IL")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-accent text-xs text-gold font-bold">{idx + 1}</span>
                    <button
                      onClick={() => toggleFavorite(item)}
                      className={`rounded-full p-1.5 transition-colors ${item.is_favorite ? "text-gold" : "text-muted-foreground hover:text-gold"}`}
                    >
                      <Heart className={`h-4 w-4 ${item.is_favorite ? "fill-current" : ""}`} />
                    </button>
                    <div className="relative">
                      <button onClick={() => setShowDownloadMenu(showDownloadMenu === item.id ? null : item.id)} className="rounded-full p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                        <Download className="h-4 w-4" />
                      </button>
                      {showDownloadMenu === item.id && (
                        <div className="absolute bottom-full left-0 mb-1 w-40 rounded-lg border border-border bg-card shadow-xl z-50 overflow-hidden">
                          {EXPORT_FORMATS.map(fmt => (
                            <button
                              key={fmt.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowDownloadMenu(null);
                                downloadImage(item.result_image_url, item.background_name || "image", fmt.id);
                              }}
                              className="flex w-full items-center justify-between px-3 py-2 font-accent text-xs hover:bg-secondary transition-colors"
                            >
                              <span className="font-semibold text-foreground">{fmt.label}</span>
                              <span className="text-muted-foreground">{fmt.desc}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Zoom Modal with editing tools */}
      {zoomedItem && (
        <div className="fixed inset-0 z-50 bg-foreground/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { setZoomedItem(null); setZoomLevel(1); setPanPos({ x: 0, y: 0 }); setShowOriginal(false); setAdjustments(defaultAdjustments); setShowAdjustments(false); }}>
          {/* Navigation arrows */}
          {filtered.findIndex(i => i.id === zoomedItem.id) < filtered.length - 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const idx = filtered.findIndex(i => i.id === zoomedItem.id);
                setZoomedItem(filtered[idx + 1]);
                setAdjustments(defaultAdjustments);
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-[60] flex h-12 w-12 items-center justify-center rounded-full bg-card/90 shadow-lg hover:bg-primary transition-colors"
            >
              <ChevronLeft className="h-6 w-6 text-foreground" />
            </button>
          )}
          {filtered.findIndex(i => i.id === zoomedItem.id) > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const idx = filtered.findIndex(i => i.id === zoomedItem.id);
                setZoomedItem(filtered[idx - 1]);
                setAdjustments(defaultAdjustments);
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-[60] flex h-12 w-12 items-center justify-center rounded-full bg-card/90 shadow-lg hover:bg-primary transition-colors"
            >
              <ChevronRight className="h-6 w-6 text-foreground" />
            </button>
          )}

          <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Controls */}
            <div className="flex items-center justify-between bg-card rounded-t-xl px-4 py-3 border border-border" dir="rtl">
              <div className="flex items-center gap-3">
                <h3 className="font-display text-sm font-bold text-foreground">{zoomedItem.background_name || "רקע מותאם"}</h3>
                <span className="font-body text-xs text-muted-foreground">{new Date(zoomedItem.created_at).toLocaleDateString("he-IL")}</span>
                <span className="font-accent text-xs text-muted-foreground">
                  ({filtered.findIndex(i => i.id === zoomedItem.id) + 1}/{filtered.length})
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* Favorite */}
                <button
                  onClick={() => toggleFavorite(zoomedItem)}
                  className={`rounded-lg px-3 py-1.5 font-accent text-xs transition-colors flex items-center gap-1.5 ${
                    zoomedItem.is_favorite ? "bg-gold text-gold-foreground" : "border border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Heart className={`h-3.5 w-3.5 ${zoomedItem.is_favorite ? "fill-current" : ""}`} />
                  {zoomedItem.is_favorite ? "מועדף" : "הוסף למועדפים"}
                </button>
                {/* Pin */}
                <button
                  onClick={() => {
                    setPinnedItem(zoomedItem);
                    setSideBySideIndex(0);
                    setViewMode("sideBySide");
                    setZoomedItem(null);
                    setZoomLevel(1);
                    setPanPos({ x: 0, y: 0 });
                    setAdjustments(defaultAdjustments);
                    setShowAdjustments(false);
                    toast.success("תמונה ננעצה — עבור לתצוגת השוואה");
                  }}
                  className="rounded-lg border border-border px-3 py-1.5 font-accent text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
                >
                  <Pin className="h-3.5 w-3.5" /> נעץ להשוואה
                </button>
                {/* Adjustments toggle */}
                <button
                  onClick={() => setShowAdjustments(!showAdjustments)}
                  className={`rounded-lg px-3 py-1.5 font-accent text-xs transition-colors flex items-center gap-1.5 ${
                    showAdjustments ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Wand2 className="h-3.5 w-3.5" /> כלי עריכה
                </button>
                {/* Edit in tool */}
                <button
                  onClick={() => {
                    navigate(`/tool?editImage=${encodeURIComponent(zoomedItem.result_image_url)}`);
                  }}
                  className="rounded-lg px-3 py-1.5 font-accent text-xs transition-colors flex items-center gap-1.5 bg-primary text-primary-foreground hover:brightness-110"
                >
                  <Pencil className="h-3.5 w-3.5" /> ערוך בכלי
                </button>
                {/* Duplicate */}
                <button
                  onClick={() => {
                    duplicateItem(zoomedItem);
                  }}
                  className="rounded-lg border border-border px-3 py-1.5 font-accent text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
                >
                  <Copy className="h-3.5 w-3.5" /> שכפל
                </button>
                {/* Duplicate & Edit */}
                <button
                  onClick={() => {
                    duplicateItem(zoomedItem, true);
                  }}
                  className="rounded-lg px-3 py-1.5 font-accent text-xs transition-colors flex items-center gap-1.5 bg-accent text-accent-foreground hover:brightness-110"
                >
                  <Copy className="h-3.5 w-3.5" /><Pencil className="h-3.5 w-3.5" /> שכפל וערוך
                </button>
                {/* Original/Result toggle */}
                <button
                  onClick={() => setShowOriginal(!showOriginal)}
                  className={`rounded-lg px-3 py-1.5 font-accent text-xs transition-colors ${
                    showOriginal ? "bg-gold text-gold-foreground" : "border border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {showOriginal ? "תוצאה" : "מקור"}
                </button>
                <button
                  onClick={() => setZoomLevel(prev => Math.min(5, prev + 0.5))}
                  className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
                <span className="font-accent text-xs text-muted-foreground min-w-[3rem] text-center">{Math.round(zoomLevel * 100)}%</span>
                <button
                  onClick={() => { setZoomLevel(prev => Math.max(1, prev - 0.5)); if (zoomLevel <= 1.5) setPanPos({ x: 0, y: 0 }); }}
                  className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                </button>
                <div className="relative">
                  <button
                    onClick={() => setShowDownloadMenu(showDownloadMenu === "zoom" ? null : "zoom")}
                    className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  {showDownloadMenu === "zoom" && (
                    <div className="absolute top-full left-0 mt-1 w-44 rounded-lg border border-border bg-card shadow-xl z-50 overflow-hidden">
                      {EXPORT_FORMATS.map(fmt => (
                        <button
                          key={fmt.id}
                          onClick={() => {
                            setShowDownloadMenu(null);
                            downloadImage(zoomedItem.result_image_url, zoomedItem.background_name || "image", fmt.id);
                          }}
                          className="flex w-full items-center justify-between px-3 py-2 font-accent text-xs hover:bg-secondary transition-colors"
                        >
                          <span className="font-semibold text-foreground">{fmt.label}</span>
                          <span className="text-muted-foreground">{fmt.desc}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Delete button in zoom */}
                <button
                  onClick={() => confirmDeleteItem(zoomedItem.id)}
                  className="rounded-lg border border-destructive/30 p-1.5 text-destructive hover:bg-destructive/10 transition-colors"
                  title="מחק תמונה"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => { setZoomedItem(null); setZoomLevel(1); setPanPos({ x: 0, y: 0 }); setShowOriginal(false); setAdjustments(defaultAdjustments); setShowAdjustments(false); }}
                  className="rounded-lg p-1.5 hover:bg-secondary transition-colors"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Content: image + optional adjustments panel */}
            <div className="flex flex-1 overflow-hidden border border-t-0 border-border rounded-b-xl">
              {/* Image */}
              <div
                className="flex-1 overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing"
                onWheel={handleZoomWheel}
                onMouseDown={handlePanStart}
                onMouseMove={handlePanMove}
                onMouseUp={() => setIsPanning(false)}
                onMouseLeave={() => setIsPanning(false)}
              >
                <div className="max-h-[75vh] max-w-full overflow-hidden rounded-md border border-border/60 shadow-sm">
                  <img
                    src={showOriginal ? zoomedItem.original_image_url : zoomedItem.result_image_url}
                    alt=""
                    className="block max-h-[75vh] max-w-full object-contain transition-transform duration-200 select-none"
                    style={{
                      transform: `scale(${zoomLevel}) translate(${panPos.x / zoomLevel}px, ${panPos.y / zoomLevel}px)`,
                      filter: showOriginal ? undefined : filterStyle,
                    }}
                    draggable={false}
                  />
                </div>
              </div>

              {/* Adjustments panel */}
              {showAdjustments && (
                <div className="w-64 shrink-0 border-r border-border bg-card p-4 overflow-y-auto" dir="rtl">
                  <ImageAdjustmentsPanel
                    adjustments={adjustments}
                    onChange={setAdjustments}
                    onReset={() => setAdjustments(defaultAdjustments)}
                  />
                </div>
              )}
            </div>

            {/* Before/After label */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              <span className={`rounded-full px-3 py-1 font-accent text-xs ${showOriginal ? "bg-foreground/70 text-card" : "bg-gold text-gold-foreground"}`}>
                {showOriginal ? "לפני" : "אחרי"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/60 backdrop-blur-sm" dir="rtl">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h3 className="font-display text-sm font-bold text-foreground">מחיקת תמונה</h3>
                <p className="font-body text-xs text-muted-foreground">האם אתה בטוח שברצונך למחוק את התמונה? פעולה זו לא ניתנת לביטול.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="rounded-lg border border-border px-4 py-2 font-display text-xs font-semibold text-foreground transition-colors hover:bg-secondary"
              >
                ביטול
              </button>
              <button
                onClick={() => deleteItem(deleteConfirmId)}
                className="rounded-lg bg-destructive px-4 py-2 font-display text-xs font-semibold text-destructive-foreground transition-all hover:brightness-110"
              >
                מחק
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Gallery;
