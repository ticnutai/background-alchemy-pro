import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Sparkles, FolderPlus, Folder, Heart, Trash2, Download, ZoomIn, X, ArrowRight,
  ChevronLeft, ChevronRight, Maximize2, Minimize2, LogIn, Search, SlidersHorizontal,
  Grid, Columns2, Pin, Wand2, Eye, GripVertical, Home, Pencil, ChevronDown, Copy,
  FolderInput, LayoutGrid, BookOpen, Info, Clock, LogOut, ImageIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ImageHoverMenu from "@/components/ImageHoverMenu";
import type { User } from "@supabase/supabase-js";
import ImageAdjustmentsPanel, { getFilterString, defaultAdjustments, type ImageAdjustments } from "@/components/ImageAdjustmentsPanel";
import { triggerDownload, generateSimplePDF, generateTIFF } from "@/lib/export-utils";

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
        className="rounded-full p-0.5 text-muted-foreground/60 hover:text-primary transition-colors"
      >
        <Info className="h-3 w-3" />
      </button>
      {show && meta && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-30 whitespace-nowrap rounded-lg bg-primary text-primary-foreground px-2.5 py-1.5 text-[10px] font-accent shadow-lg animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center gap-2">
            <span>{meta.width}×{meta.height}</span>
            <span className="w-px h-3 bg-primary-foreground/30" />
            <span>איכות: {quality}</span>
            {meta.sizeKB && <>
              <span className="w-px h-3 bg-primary-foreground/30" />
              <span>{meta.sizeKB > 1024 ? `${(meta.sizeKB / 1024).toFixed(1)} MB` : `${meta.sizeKB} KB`}</span>
            </>}
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-primary rotate-45 -mt-1" />
        </div>
      )}
    </div>
  );
};

const Gallery = () => {
  const navigate = useNavigate();
  // Force light mode
  useEffect(() => {
    const wasDark = document.documentElement.classList.contains("dark");
    document.documentElement.classList.remove("dark");
    return () => { if (wasDark) document.documentElement.classList.add("dark"); };
  }, []);
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

  const confirmDeleteItem = (id: string) => setDeleteConfirmId(id);

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
        toast.success("העותק נוצר! פותח בעורך...");
        navigate(`/tool?editImage=${encodeURIComponent(item.result_image_url)}`);
      } else {
        toast.success("התמונה שוכפלה!");
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

  const closeZoom = useCallback(() => {
    setZoomedItem(null);
    setZoomLevel(1);
    setPanPos({ x: 0, y: 0 });
    setShowOriginal(false);
    setAdjustments(defaultAdjustments);
    setShowAdjustments(false);
    setShowDownloadMenu(null);
  }, []);

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
        <div className="text-center space-y-4 p-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-border">
            <ImageIcon className="h-8 w-8 text-primary" />
          </div>
          <h2 className="font-display text-2xl font-bold text-foreground">גלריית תמונות</h2>
          <p className="font-body text-muted-foreground">התחבר כדי לראות את התמונות שלך</p>
          <Link to="/auth" className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-display text-sm font-semibold text-primary-foreground transition-all hover:brightness-110">
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
      {/* ─── Header ─── */}
      <header className="border-b border-border bg-card sticky top-0 z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-3">
          {/* Left: Logo + Title */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </Link>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-lg font-bold text-foreground">הגלריה שלי</h1>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-accent text-xs font-semibold text-primary">{items.length}</span>
            </div>
          </div>

          {/* Center: Nav tabs */}
          <div className="hidden sm:flex items-center gap-1 rounded-full border border-border bg-secondary/50 p-1">
            <Link to="/tool" className="flex items-center gap-1.5 rounded-full px-4 py-1.5 font-body text-xs font-semibold text-muted-foreground hover:bg-background hover:text-foreground transition-all">
              <Wand2 className="h-3.5 w-3.5" /> עריכה
            </Link>
            <Link to="/collage" className="flex items-center gap-1.5 rounded-full px-4 py-1.5 font-body text-xs font-semibold text-muted-foreground hover:bg-background hover:text-foreground transition-all">
              <LayoutGrid className="h-3.5 w-3.5" /> קולאז׳
            </Link>
            <Link to="/catalog" className="flex items-center gap-1.5 rounded-full px-4 py-1.5 font-body text-xs font-semibold text-muted-foreground hover:bg-background hover:text-foreground transition-all">
              <BookOpen className="h-3.5 w-3.5" /> קטלוג
            </Link>
            <div className="rounded-full bg-primary px-4 py-1.5 font-body text-xs font-semibold text-primary-foreground">
              <span className="flex items-center gap-1.5"><ImageIcon className="h-3.5 w-3.5" /> גלריה</span>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 transition-colors ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
                title="תצוגת רשת"
              >
                <Grid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("sideBySide")}
                className={`p-2 transition-colors ${viewMode === "sideBySide" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
                title="השוואה"
              >
                <Columns2 className="h-4 w-4" />
              </button>
            </div>
            <Link to="/" className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors" title="דף הבית">
              <Home className="h-4 w-4" />
            </Link>
            {user && (
              <button
                onClick={async () => { await supabase.auth.signOut(); toast.success("התנתקת"); }}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
                title="התנתק"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          {/* ─── Sidebar ─── */}
          <div className="w-full md:w-56 shrink-0 space-y-3">
            {/* Folders */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Folder className="h-4 w-4 text-primary" /> תיקיות
                </h3>
                <button onClick={() => setShowNewFolder(!showNewFolder)} className="rounded-lg p-1.5 hover:bg-secondary transition-colors text-primary">
                  <FolderPlus className="h-4 w-4" />
                </button>
              </div>

              {showNewFolder && (
                <div className="flex gap-2">
                  <input
                    value={newFolderName}
                    onChange={e => setNewFolderName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && createFolder()}
                    placeholder="שם התיקייה..."
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 font-body text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                  />
                  <button onClick={createFolder} className="rounded-lg bg-primary px-3 py-2 font-accent text-xs font-semibold text-primary-foreground">צור</button>
                </div>
              )}

              <button
                onClick={() => setActiveFolder(null)}
                onDragOver={e => { e.preventDefault(); setDragOverFolderId("__all__"); }}
                onDragLeave={() => setDragOverFolderId(null)}
                onDrop={e => { e.preventDefault(); setDragOverFolderId(null); if (draggedItemId) { moveToFolder(draggedItemId, null); setDraggedItemId(null); } }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 font-accent text-xs transition-all ${
                  dragOverFolderId === "__all__" ? "bg-primary/10 border-2 border-dashed border-primary" :
                  !activeFolder ? "bg-primary/10 text-primary font-bold border border-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <Folder className="h-4 w-4" /> הכל
                <span className="mr-auto rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold">{items.length}</span>
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
                      className={`flex flex-1 items-center gap-2 rounded-lg px-3 py-2.5 font-accent text-xs transition-all ${
                        dragOverFolderId === folder.id ? "bg-primary/10 border-2 border-dashed border-primary" :
                        activeFolder === folder.id ? "bg-primary/10 text-primary font-bold border border-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                      }`}
                    >
                      <Folder className="h-4 w-4" style={{ color: folder.color || 'hsl(var(--primary))' }} />
                      <span className="truncate">{folder.name}</span>
                      <span className="mr-auto rounded-full bg-secondary px-2 py-0.5 text-[10px]">{count}</span>
                    </button>
                    <button
                      onClick={() => deleteFolder(folder.id)}
                      className="rounded-lg p-1.5 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Filters */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <h3 className="font-display text-sm font-bold text-foreground flex items-center gap-1.5">
                <SlidersHorizontal className="h-4 w-4 text-primary" /> סינון
              </h3>
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => setFilter("all")}
                  className={`flex-1 px-3 py-2 font-accent text-xs font-semibold transition-colors ${
                    filter === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >הכל</button>
                <button
                  onClick={() => setFilter("favorites")}
                  className={`flex-1 px-3 py-2 font-accent text-xs font-semibold transition-colors flex items-center justify-center gap-1 ${
                    filter === "favorites" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  <Heart className="h-3 w-3" /> מועדפים
                </button>
              </div>

              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="חפש לפי שם..."
                  className="w-full rounded-lg border border-border bg-background py-2.5 pr-9 pl-3 font-body text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                />
              </div>

              <button
                onClick={() => { setCompareMode(!compareMode); setCompareItems([]); }}
                className={`w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 font-accent text-xs font-semibold transition-all ${
                  compareMode ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-primary hover:border-primary/30"
                }`}
              >
                <Eye className="h-4 w-4" />
                {compareMode ? "ביטול השוואה" : "מצב השוואה"}
              </button>
            </div>
          </div>

          {/* ─── Main Content ─── */}
          <div className="flex-1">
            {/* Compare strip */}
            {compareMode && compareItems.length > 0 && (
              <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-display text-sm font-bold text-foreground flex items-center gap-2">
                    <Eye className="h-4 w-4 text-primary" /> השוואה ({compareItems.length}/4)
                  </span>
                  <div className="flex items-center gap-2">
                    {compareItems.length >= 2 && (
                      <button
                        onClick={() => setShowCompareView(true)}
                        className="rounded-lg bg-primary px-4 py-2 font-display text-xs font-semibold text-primary-foreground transition-all hover:brightness-110"
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
                        className="absolute top-1.5 right-1.5 rounded-full bg-card/80 p-1 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <p className="absolute bottom-0 inset-x-0 bg-card/90 px-2 py-1 font-accent text-[10px] text-foreground truncate text-center border-t border-border">
                        {item.background_name || "רקע מותאם"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Side-by-side instructions */}
            {viewMode === "sideBySide" && !pinnedItem && (
              <div className="mb-4 rounded-xl border border-border bg-card p-6 text-center">
                <Pin className="h-6 w-6 text-primary mx-auto mb-2" />
                <p className="font-display text-sm font-bold text-foreground">בחר תמונה לנעוץ</p>
                <p className="font-body text-xs text-muted-foreground mt-1">לחץ על סמל הנעיצה כדי לנעוץ תמונה בצד, ואז השתמש בחיצים כדי להחליף</p>
              </div>
            )}

            {/* Side-by-side view */}
            {viewMode === "sideBySide" && pinnedItem && (
              <div className="mb-6 rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/30">
                  <div className="flex items-center gap-2">
                    <Pin className="h-4 w-4 text-primary" />
                    <span className="font-display text-sm font-bold text-foreground">השוואה צד-ליד-צד</span>
                    <span className="font-accent text-xs text-muted-foreground">
                      (חיצים ← → להחלפה)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-accent text-xs text-muted-foreground">
                      {sideBySideOthers.length > 0 ? `${sideBySideIndex + 1}/${sideBySideOthers.length}` : ""}
                    </span>
                    <button onClick={() => { setPinnedItem(null); setSideBySideIndex(0); }} className="rounded-lg p-1.5 hover:bg-secondary transition-colors">
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
                <div className="flex">
                  {/* Pinned (left) */}
                  <div className="flex-1 border-l border-border p-3">
                    <div className="aspect-square rounded-lg overflow-hidden bg-secondary/30 mb-2">
                      <img src={pinnedItem.result_image_url} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Pin className="h-3.5 w-3.5 text-primary shrink-0" />
                      <p className="font-display text-xs font-semibold text-foreground truncate">{pinnedItem.background_name || "נעוץ"}</p>
                    </div>
                  </div>

                  {/* Comparison (right) */}
                  <div className="flex-1 p-3 relative">
                    {sideBySideCurrent ? (
                      <>
                        <div className="aspect-square rounded-lg overflow-hidden bg-secondary/30 mb-2 relative">
                          <img src={sideBySideCurrent.result_image_url} alt="" className="h-full w-full object-cover" />
                          {sideBySideIndex > 0 && (
                            <button
                              onClick={() => setSideBySideIndex(prev => prev - 1)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-card/90 border border-border shadow-md hover:bg-primary hover:text-primary-foreground transition-colors"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          )}
                          {sideBySideIndex < sideBySideOthers.length - 1 && (
                            <button
                              onClick={() => setSideBySideIndex(prev => prev + 1)}
                              className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-card/90 border border-border shadow-md hover:bg-primary hover:text-primary-foreground transition-colors"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="font-display text-xs font-semibold text-foreground truncate">{sideBySideCurrent.background_name || "רקע מותאם"}</p>
                          <div className="flex gap-1">
                            <button onClick={() => toggleFavorite(sideBySideCurrent)} className="rounded-lg p-1.5 hover:bg-secondary transition-colors">
                              <Heart className={`h-3.5 w-3.5 ${sideBySideCurrent.is_favorite ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                            </button>
                            <button onClick={() => { setPinnedItem(sideBySideCurrent); setSideBySideIndex(0); }} className="rounded-lg p-1.5 hover:bg-secondary transition-colors" title="נעץ תמונה זו">
                              <Pin className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="aspect-square rounded-lg bg-secondary/30 flex items-center justify-center">
                        <p className="font-body text-xs text-muted-foreground">אין עוד תמונות להשוואה</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Thumbnails strip */}
                {sideBySideOthers.length > 0 && (
                  <div className="flex gap-1.5 px-3 pb-3 overflow-x-auto border-t border-border pt-3">
                    {sideBySideOthers.map((item, idx) => (
                      <button
                        key={item.id}
                        onClick={() => setSideBySideIndex(idx)}
                        className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                          idx === sideBySideIndex ? "border-primary ring-1 ring-primary/30" : "border-transparent hover:border-border"
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
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 space-y-3">
                <ImageIcon className="h-12 w-12 text-muted-foreground/30 mx-auto" />
                <p className="font-display text-sm font-bold text-foreground">
                  {activeFolder ? "אין תמונות בתיקייה הזו" : "אין תמונות עדיין"}
                </p>
                <Link to="/tool" className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-accent text-xs font-semibold text-primary-foreground">
                  <Wand2 className="h-3.5 w-3.5" /> לכלי העריכה
                </Link>
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
                    className={`group rounded-xl border bg-card transition-all hover:shadow-lg cursor-pointer ${
                      draggedItemId === item.id ? "opacity-50 scale-95" :
                      compareMode && compareItems.find(c => c.id === item.id)
                        ? "border-primary ring-2 ring-primary/30"
                        : pinnedItem?.id === item.id
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border hover:border-primary/30"
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
                      <div className="aspect-square overflow-hidden rounded-t-xl">
                        <img src={item.result_image_url} alt={item.background_name || ""} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" draggable={false} />
                      </div>
                      <div className="p-3 border-t border-border/50">
                        <p className="font-display text-xs font-bold text-foreground truncate">{item.background_name || "רקע מותאם"}</p>
                        <div className="flex items-center justify-between mt-1">
                          <p className="font-body text-[10px] text-muted-foreground">{new Date(item.created_at).toLocaleDateString("he-IL")}</p>
                          <div className="flex items-center gap-1">
                            {item.is_favorite && <Heart className="h-3 w-3 fill-primary text-primary" />}
                            <ImageInfoBadge url={item.result_image_url} />
                          </div>
                        </div>
                      </div>

                      {/* Drag indicator */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-60 transition-opacity">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                      </div>

                      {compareMode && compareItems.find(c => c.id === item.id) && (
                        <div className="absolute inset-0 bg-primary/10 flex items-center justify-center pointer-events-none rounded-xl">
                          <div className="rounded-full bg-primary text-primary-foreground w-7 h-7 flex items-center justify-center font-accent text-xs font-bold">
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

      {/* ─── Compare View Dialog ─── */}
      <Dialog open={showCompareView && compareItems.length >= 2} onOpenChange={(open) => { if (!open) { setShowCompareView(false); } }}>
        <DialogContent className="max-w-6xl max-h-[90vh] border-border p-0 overflow-hidden" dir="rtl">
          <DialogHeader className="px-6 py-4 border-b border-border bg-secondary/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Eye className="h-5 w-5 text-primary" />
                <DialogTitle className="font-display text-lg font-bold text-foreground">השוואת תמונות</DialogTitle>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-accent text-xs font-semibold text-primary">{compareItems.length} תמונות</span>
              </div>
              <button
                onClick={() => { setShowCompareView(false); setCompareMode(false); setCompareItems([]); }}
                className="rounded-lg border border-border px-4 py-2 font-accent text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                סיום השוואה
              </button>
            </div>
          </DialogHeader>
          <div
            className={`p-6 overflow-auto grid gap-4 ${
              compareItems.length === 2 ? "grid-cols-2" : compareItems.length === 3 ? "grid-cols-3" : "grid-cols-2 lg:grid-cols-4"
            }`}
          >
            {compareItems.map((item, idx) => (
              <div key={item.id} className="flex flex-col rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex-1 flex items-center justify-center bg-secondary/20 p-2">
                  <img src={item.result_image_url} alt="" className="max-h-[55vh] w-full object-contain" />
                </div>
                <div className="flex items-center justify-between p-3 border-t border-border">
                  <div>
                    <p className="font-display text-sm font-bold text-foreground">{item.background_name || "רקע מותאם"}</p>
                    <p className="font-body text-[10px] text-muted-foreground">{new Date(item.created_at).toLocaleDateString("he-IL")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 font-accent text-xs font-bold text-primary">{idx + 1}</span>
                    <button
                      onClick={() => toggleFavorite(item)}
                      className={`rounded-lg p-1.5 transition-colors ${item.is_favorite ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
                    >
                      <Heart className={`h-4 w-4 ${item.is_favorite ? "fill-current" : ""}`} />
                    </button>
                    <div className="relative">
                      <button onClick={() => setShowDownloadMenu(showDownloadMenu === item.id ? null : item.id)} className="rounded-lg p-1.5 text-muted-foreground hover:text-primary transition-colors">
                        <Download className="h-4 w-4" />
                      </button>
                      {showDownloadMenu === item.id && (
                        <div className="absolute bottom-full left-0 mb-1 w-44 rounded-xl border border-border bg-card shadow-xl z-50 overflow-hidden">
                          {EXPORT_FORMATS.map(fmt => (
                            <button
                              key={fmt.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowDownloadMenu(null);
                                downloadImage(item.result_image_url, item.background_name || "image", fmt.id);
                              }}
                              className="flex w-full items-center justify-between px-3 py-2.5 font-accent text-xs hover:bg-secondary transition-colors"
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
        </DialogContent>
      </Dialog>

      {/* ─── Zoom Modal Dialog ─── */}
      <Dialog open={!!zoomedItem} onOpenChange={(open) => { if (!open) closeZoom(); }}>
        <DialogContent className="max-w-5xl max-h-[95vh] border-border p-0 overflow-hidden [&>button]:hidden" dir="rtl">
          {zoomedItem && (
            <>
              {/* Toolbar */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/30">
                <div className="flex items-center gap-3">
                  <h3 className="font-display text-sm font-bold text-foreground">{zoomedItem.background_name || "רקע מותאם"}</h3>
                  <span className="font-body text-xs text-muted-foreground">{new Date(zoomedItem.created_at).toLocaleDateString("he-IL")}</span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 font-accent text-[10px] font-semibold text-primary">
                    {filtered.findIndex(i => i.id === zoomedItem.id) + 1}/{filtered.length}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {/* Group 1: Quick actions */}
                  <button
                    onClick={() => toggleFavorite(zoomedItem)}
                    className={`rounded-lg p-2 transition-colors ${zoomedItem.is_favorite ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-primary hover:bg-secondary"}`}
                    title={zoomedItem.is_favorite ? "הסר ממועדפים" : "הוסף למועדפים"}
                  >
                    <Heart className={`h-4 w-4 ${zoomedItem.is_favorite ? "fill-current" : ""}`} />
                  </button>
                  <button
                    onClick={() => setShowOriginal(!showOriginal)}
                    className={`rounded-lg p-2 transition-colors ${showOriginal ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-primary hover:bg-secondary"}`}
                    title={showOriginal ? "הצג תוצאה" : "הצג מקור"}
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setShowAdjustments(!showAdjustments)}
                    className={`rounded-lg p-2 transition-colors ${showAdjustments ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-primary hover:bg-secondary"}`}
                    title="כלי עריכה"
                  >
                    <Wand2 className="h-4 w-4" />
                  </button>

                  <div className="w-px h-6 bg-border mx-1" />

                  {/* Group 2: Edit actions */}
                  <button
                    onClick={() => navigate(`/tool?editImage=${encodeURIComponent(zoomedItem.result_image_url)}`)}
                    className="rounded-lg px-3 py-2 font-accent text-xs font-semibold bg-primary text-primary-foreground hover:brightness-110 transition-all flex items-center gap-1.5"
                  >
                    <Pencil className="h-3.5 w-3.5" /> ערוך
                  </button>
                  <button
                    onClick={() => duplicateItem(zoomedItem)}
                    className="rounded-lg p-2 text-muted-foreground hover:text-primary hover:bg-secondary transition-colors"
                    title="שכפל"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => { setPinnedItem(zoomedItem); setSideBySideIndex(0); setViewMode("sideBySide"); closeZoom(); toast.success("תמונה ננעצה"); }}
                    className="rounded-lg p-2 text-muted-foreground hover:text-primary hover:bg-secondary transition-colors"
                    title="נעץ להשוואה"
                  >
                    <Pin className="h-4 w-4" />
                  </button>

                  <div className="w-px h-6 bg-border mx-1" />

                  {/* Group 3: Zoom controls */}
                  <button onClick={() => setZoomLevel(prev => Math.min(5, prev + 0.5))} className="rounded-lg p-2 text-muted-foreground hover:text-primary hover:bg-secondary transition-colors">
                    <Maximize2 className="h-4 w-4" />
                  </button>
                  <span className="font-accent text-xs text-muted-foreground min-w-[2.5rem] text-center">{Math.round(zoomLevel * 100)}%</span>
                  <button onClick={() => { setZoomLevel(prev => Math.max(1, prev - 0.5)); if (zoomLevel <= 1.5) setPanPos({ x: 0, y: 0 }); }} className="rounded-lg p-2 text-muted-foreground hover:text-primary hover:bg-secondary transition-colors">
                    <Minimize2 className="h-4 w-4" />
                  </button>

                  <div className="w-px h-6 bg-border mx-1" />

                  {/* Group 4: Download + Delete + Close */}
                  <div className="relative">
                    <button
                      onClick={() => setShowDownloadMenu(showDownloadMenu === "zoom" ? null : "zoom")}
                      className="rounded-lg p-2 text-muted-foreground hover:text-primary hover:bg-secondary transition-colors flex items-center gap-0.5"
                    >
                      <Download className="h-4 w-4" />
                      <ChevronDown className="h-3 w-3" />
                    </button>
                    {showDownloadMenu === "zoom" && (
                      <div className="absolute top-full left-0 mt-1 w-44 rounded-xl border border-border bg-card shadow-xl z-50 overflow-hidden">
                        {EXPORT_FORMATS.map(fmt => (
                          <button
                            key={fmt.id}
                            onClick={() => {
                              setShowDownloadMenu(null);
                              downloadImage(zoomedItem.result_image_url, zoomedItem.background_name || "image", fmt.id);
                            }}
                            className="flex w-full items-center justify-between px-3 py-2.5 font-accent text-xs hover:bg-secondary transition-colors"
                          >
                            <span className="font-semibold text-foreground">{fmt.label}</span>
                            <span className="text-muted-foreground">{fmt.desc}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => confirmDeleteItem(zoomedItem.id)}
                    className="rounded-lg p-2 text-destructive hover:bg-destructive/10 transition-colors"
                    title="מחק"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button onClick={closeZoom} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Content: image + optional adjustments panel */}
              <div className="flex flex-1 overflow-hidden relative">
                {/* Navigation arrows */}
                {filtered.findIndex(i => i.id === zoomedItem.id) < filtered.length - 1 && (
                  <button
                    onClick={() => {
                      const idx = filtered.findIndex(i => i.id === zoomedItem.id);
                      setZoomedItem(filtered[idx + 1]);
                      setAdjustments(defaultAdjustments);
                    }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-card/90 border border-border shadow-md hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                )}
                {filtered.findIndex(i => i.id === zoomedItem.id) > 0 && (
                  <button
                    onClick={() => {
                      const idx = filtered.findIndex(i => i.id === zoomedItem.id);
                      setZoomedItem(filtered[idx - 1]);
                      setAdjustments(defaultAdjustments);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-card/90 border border-border shadow-md hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                )}

                {/* Image */}
                <div
                  className="flex-1 overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing bg-secondary/20 p-4"
                  onWheel={handleZoomWheel}
                  onMouseDown={handlePanStart}
                  onMouseMove={handlePanMove}
                  onMouseUp={() => setIsPanning(false)}
                  onMouseLeave={() => setIsPanning(false)}
                >
                  <div className="max-h-[70vh] max-w-full overflow-hidden rounded-lg border border-border shadow-sm">
                    <img
                      src={showOriginal ? zoomedItem.original_image_url : zoomedItem.result_image_url}
                      alt=""
                      className="block max-h-[70vh] max-w-full object-contain transition-transform duration-200 select-none"
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
                  <div className="w-64 shrink-0 border-r border-border bg-card p-4 overflow-y-auto">
                    <ImageAdjustmentsPanel
                      adjustments={adjustments}
                      onChange={setAdjustments}
                      onReset={() => setAdjustments(defaultAdjustments)}
                    />
                  </div>
                )}
              </div>

              {/* Before/After label */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-none">
                <span className={`rounded-full px-3 py-1.5 font-accent text-xs font-semibold shadow-md ${showOriginal ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"}`}>
                  {showOriginal ? "לפני" : "אחרי"}
                </span>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation ─── */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <DialogContent className="max-w-sm border-border" dir="rtl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <DialogTitle className="font-display text-sm font-bold text-foreground">מחיקת תמונה</DialogTitle>
                <p className="font-body text-xs text-muted-foreground">האם אתה בטוח? פעולה זו לא ניתנת לביטול.</p>
              </div>
            </div>
          </DialogHeader>
          <div className="flex items-center gap-3 justify-end pt-2">
            <button
              onClick={() => setDeleteConfirmId(null)}
              className="rounded-lg border border-border px-4 py-2 font-display text-xs font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              ביטול
            </button>
            <button
              onClick={() => deleteConfirmId && deleteItem(deleteConfirmId)}
              className="rounded-lg bg-destructive px-4 py-2 font-display text-xs font-semibold text-destructive-foreground transition-all hover:brightness-110"
            >
              מחק
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Gallery;
