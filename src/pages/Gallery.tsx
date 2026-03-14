import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Sparkles, FolderPlus, Folder, Heart, Trash2, Download, ZoomIn, X, ArrowRight,
  ChevronLeft, ChevronRight, Maximize2, Minimize2, LogIn, Search, SlidersHorizontal,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";

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
  };

  const deleteItem = async (id: string) => {
    await supabase.from("processing_history").delete().eq("id", id);
    setItems(prev => prev.filter(i => i.id !== id));
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

  // Filtered items
  let filtered = items;
  if (activeFolder) filtered = filtered.filter(i => i.folder_id === activeFolder);
  if (filter === "favorites") filtered = filtered.filter(i => i.is_favorite);
  if (searchQuery.trim()) filtered = filtered.filter(i =>
    (i.background_name || i.background_prompt).toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            <Link to="/tool" className="flex items-center gap-2 rounded-full bg-accent px-4 py-2 font-accent text-xs font-semibold text-accent-foreground transition-all hover:brightness-110">
              <Sparkles className="h-3.5 w-3.5" /> לכלי העריכה
            </Link>
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
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 font-accent text-xs transition-colors ${
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
                      className={`flex flex-1 items-center gap-2 rounded-lg px-3 py-2 font-accent text-xs transition-colors ${
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

          {/* Grid */}
          <div className="flex-1">
            {/* Compare strip */}
            {compareMode && compareItems.length > 0 && (
              <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-display text-sm font-bold text-foreground">השוואה ({compareItems.length}/4)</span>
                  <button onClick={() => setCompareItems([])} className="font-accent text-xs text-muted-foreground hover:text-foreground">נקה</button>
                </div>
                <div className="flex gap-3">
                  {compareItems.map(item => (
                    <div key={item.id} className="relative w-40 aspect-square rounded-lg overflow-hidden border border-border group">
                      <img src={item.result_image_url} alt="" className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/30 transition-colors flex items-center justify-center">
                        <button onClick={() => setZoomedItem(item)} className="opacity-0 group-hover:opacity-100 rounded-full bg-card p-2 transition-opacity">
                          <ZoomIn className="h-4 w-4 text-foreground" />
                        </button>
                      </div>
                      <p className="absolute bottom-1 left-1 right-1 rounded bg-foreground/70 px-1.5 py-0.5 font-accent text-[10px] text-card truncate text-center">
                        {item.background_name || "רקע מותאם"}
                      </p>
                    </div>
                  ))}
                </div>
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
                    className={`group relative rounded-xl border overflow-hidden bg-card transition-all hover:shadow-lg cursor-pointer ${
                      compareMode && compareItems.find(c => c.id === item.id)
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-border hover:border-gold/40"
                    }`}
                    onClick={() => compareMode ? toggleCompareItem(item) : setZoomedItem(item)}
                  >
                    <div className="aspect-square overflow-hidden">
                      <img src={item.result_image_url} alt={item.background_name || ""} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    </div>
                    <div className="p-2.5">
                      <p className="font-display text-xs font-semibold text-foreground truncate">{item.background_name || "רקע מותאם"}</p>
                      <p className="font-body text-[10px] text-muted-foreground">{new Date(item.created_at).toLocaleDateString("he-IL")}</p>
                    </div>

                    {/* Hover actions */}
                    <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={e => { e.stopPropagation(); toggleFavorite(item); }}
                        className={`rounded-full p-1.5 backdrop-blur-sm transition-colors ${
                          item.is_favorite ? "bg-gold/90 text-gold-foreground" : "bg-foreground/50 text-card hover:bg-gold/90"
                        }`}
                      >
                        <Heart className={`h-3 w-3 ${item.is_favorite ? "fill-current" : ""}`} />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); deleteItem(item.id); }}
                        className="rounded-full bg-foreground/50 p-1.5 text-card backdrop-blur-sm hover:bg-destructive transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Folder assign dropdown */}
                    {folders.length > 0 && !compareMode && (
                      <div className="absolute bottom-12 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <select
                          value={item.folder_id || ""}
                          onClick={e => e.stopPropagation()}
                          onChange={e => { e.stopPropagation(); moveToFolder(item.id, e.target.value || null); }}
                          className="rounded-md bg-foreground/70 px-1.5 py-1 font-accent text-[10px] text-card backdrop-blur-sm border-none focus:outline-none cursor-pointer"
                        >
                          <option value="">ללא תיקייה</option>
                          {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                      </div>
                    )}

                    {item.is_favorite && (
                      <div className="absolute top-2 right-2"><span className="text-xs">⭐</span></div>
                    )}

                    {compareMode && compareItems.find(c => c.id === item.id) && (
                      <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
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

      {/* Zoom Modal */}
      {zoomedItem && (
        <div className="fixed inset-0 z-50 bg-foreground/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { setZoomedItem(null); setZoomLevel(1); setPanPos({ x: 0, y: 0 }); setShowOriginal(false); }}>
          <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Controls */}
            <div className="flex items-center justify-between bg-card rounded-t-xl px-4 py-3 border border-border" dir="rtl">
              <div className="flex items-center gap-3">
                <h3 className="font-display text-sm font-bold text-foreground">{zoomedItem.background_name || "רקע מותאם"}</h3>
                <span className="font-body text-xs text-muted-foreground">{new Date(zoomedItem.created_at).toLocaleDateString("he-IL")}</span>
              </div>
              <div className="flex items-center gap-2">
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
                  onClick={() => { setZoomedItem(null); setZoomLevel(1); setPanPos({ x: 0, y: 0 }); setShowOriginal(false); }}
                  className="rounded-lg p-1.5 hover:bg-secondary transition-colors"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Image */}
            <div
              className="flex-1 overflow-hidden bg-foreground/5 rounded-b-xl border border-t-0 border-border flex items-center justify-center cursor-grab active:cursor-grabbing"
              onWheel={handleZoomWheel}
              onMouseDown={handlePanStart}
              onMouseMove={handlePanMove}
              onMouseUp={() => setIsPanning(false)}
              onMouseLeave={() => setIsPanning(false)}
            >
              <img
                src={showOriginal ? zoomedItem.original_image_url : zoomedItem.result_image_url}
                alt=""
                className="max-h-[75vh] object-contain transition-transform duration-200 select-none"
                style={{
                  transform: `scale(${zoomLevel}) translate(${panPos.x / zoomLevel}px, ${panPos.y / zoomLevel}px)`,
                }}
                draggable={false}
              />
            </div>

            {/* Before/After labels */}
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
