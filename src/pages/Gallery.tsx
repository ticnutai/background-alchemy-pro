import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Sparkles, FolderPlus, Folder, Heart, Trash2, Download, ZoomIn, X, ArrowRight,
  ChevronLeft, ChevronRight, Maximize2, Minimize2, LogIn, Search, SlidersHorizontal,
  Grid, Columns2, Pin, Wand2, Eye, GripVertical, Home, Pencil,
} from "lucide-react";
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

type ViewMode = "grid" | "single" | "sideBySide";

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
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [showCompareView, setShowCompareView] = useState(false);

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

  const deleteItem = async (id: string) => {
    await supabase.from("processing_history").delete().eq("id", id);
    setItems(prev => prev.filter(i => i.id !== id));
    if (zoomedItem?.id === id) setZoomedItem(null);
    toast.success("נמחק");
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
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => setDraggedItemId(item.id)}
                    onDragEnd={() => setDraggedItemId(null)}
                    onMouseEnter={() => setHoveredItemId(item.id)}
                    onMouseLeave={() => setHoveredItemId(null)}
                    className={`group relative rounded-xl border overflow-hidden bg-card transition-all hover:shadow-lg cursor-pointer ${
                      draggedItemId === item.id ? "opacity-50 scale-95" :
                      compareMode && compareItems.find(c => c.id === item.id)
                        ? "border-primary ring-2 ring-primary/30"
                        : pinnedItem?.id === item.id
                        ? "border-gold ring-2 ring-gold/30"
                        : "border-border hover:border-gold/40"
                    }`}
                    onClick={() => compareMode ? toggleCompareItem(item) : setZoomedItem(item)}
                  >
                    <div className="aspect-square overflow-hidden">
                      <img src={item.result_image_url} alt={item.background_name || ""} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" draggable={false} />
                    </div>
                    <div className="p-2.5">
                      <p className="font-display text-xs font-semibold text-foreground truncate">{item.background_name || "רקע מותאם"}</p>
                      <p className="font-body text-[10px] text-muted-foreground">{new Date(item.created_at).toLocaleDateString("he-IL")}</p>
                    </div>

                    {/* Hover action popup - top center */}
                    {hoveredItemId === item.id && !compareMode && (
                      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 rounded-full bg-card/95 backdrop-blur-md shadow-lg border border-border px-2 py-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                        <button
                          onClick={e => { e.stopPropagation(); toggleFavorite(item); }}
                          className={`rounded-full p-1.5 transition-colors ${
                            item.is_favorite ? "bg-gold/20 text-gold" : "text-muted-foreground hover:text-gold hover:bg-gold/10"
                          }`}
                          title={item.is_favorite ? "הסר ממועדפים" : "הוסף למועדפים"}
                        >
                          <Heart className={`h-3.5 w-3.5 ${item.is_favorite ? "fill-current" : ""}`} />
                        </button>
                        <div className="w-px h-4 bg-border" />
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            if (!compareMode) {
                              setCompareMode(true);
                            }
                            toggleCompareItem(item);
                          }}
                          className={`rounded-full p-1.5 transition-colors ${
                            compareItems.find(c => c.id === item.id) ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                          }`}
                          title="הוסף להשוואה"
                        >
                          <SlidersHorizontal className="h-3.5 w-3.5" />
                        </button>
                        <div className="w-px h-4 bg-border" />
                        <button
                          onClick={e => { e.stopPropagation(); setPinnedItem(item); setSideBySideIndex(0); setViewMode("sideBySide"); }}
                          className={`rounded-full p-1.5 transition-colors ${
                            pinnedItem?.id === item.id ? "bg-gold/20 text-gold" : "text-muted-foreground hover:text-gold hover:bg-gold/10"
                          }`}
                          title="נעץ להשוואה"
                        >
                          <Pin className="h-3.5 w-3.5" />
                        </button>
                        <div className="w-px h-4 bg-border" />
                         <button
                          onClick={e => { e.stopPropagation(); setZoomedItem(item); }}
                          className="rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                          title="הגדל"
                        >
                          <ZoomIn className="h-3.5 w-3.5" />
                        </button>
                        <div className="w-px h-4 bg-border" />
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            navigate(`/tool?editImage=${encodeURIComponent(item.result_image_url)}`);
                          }}
                          className="rounded-full p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          title="ערוך בכלי העריכה"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <div className="w-px h-4 bg-border" />
                        <button
                          onClick={e => { e.stopPropagation(); deleteItem(item.id); }}
                          className="rounded-full p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="מחק"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Drag indicator */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-60 transition-opacity">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                    </div>

                    {item.is_favorite && hoveredItemId !== item.id && (
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
                    <a href={item.result_image_url} download className="rounded-full p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                      <Download className="h-4 w-4" />
                    </a>
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
                <a
                  href={zoomedItem.result_image_url}
                  download={zoomedItem.background_name || "image.png"}
                  target="_blank"
                  className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
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
    </div>
  );
};

export default Gallery;
