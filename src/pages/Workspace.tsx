import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, BookOpen, LayoutGrid, Image, ArrowLeft,
  Wand2, Palette, Scissors, SunMedium,
  Eraser, ArrowUpCircle, Home, Upload, FolderOpen,
  Clock, Star, ChevronRight, X, FileImage,
} from "lucide-react";
import ImageHoverMenu from "@/components/ImageHoverMenu";
import { supabase } from "@/integrations/supabase/client";
import ThemeToggle from "@/components/ThemeToggle";
import studioLogo from "@/assets/studio-logo.png";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

interface RecentImage {
  id: string;
  result_image_url: string;
  background_name: string | null;
  created_at: string;
  is_favorite: boolean;
  folder_id?: string | null;
}

export default function Workspace() {
  const navigate = useNavigate();
  // Force light mode
  useEffect(() => {
    const wasDark = document.documentElement.classList.contains("dark");
    document.documentElement.classList.remove("dark");
    return () => { if (wasDark) document.documentElement.classList.add("dark"); };
  }, []);
  const [user, setUser] = useState<User | null>(null);
  const [recentImages, setRecentImages] = useState<RecentImage[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [uploadedFiles, setUploadedFiles] = useState<{ id: string; src: string; name: string }[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) loadRecent();
      else setLoadingRecent(false);
    });
  }, []);

  const loadRecent = async () => {
    setLoadingRecent(true);
    const { data } = await supabase
      .from("processing_history")
      .select("id, result_image_url, background_name, created_at, is_favorite, folder_id")
      .order("created_at", { ascending: false })
      .limit(8);
    if (data) setRecentImages(data as RecentImage[]);
    setLoadingRecent(false);
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArr = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (fileArr.length === 0) {
      toast.error("לא נמצאו תמונות בקבצים שהועלו");
      return;
    }
    const newUploads: typeof uploadedFiles = [];
    for (const file of fileArr) {
      const src = await fileToBase64(file);
      const name = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      newUploads.push({ id: `up_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, src, name });
    }
    setUploadedFiles(prev => [...prev, ...newUploads]);
    toast.success(`${newUploads.length} תמונות הועלו בהצלחה!`);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      setIsDragging(false);
      dragCounter.current = 0;
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const removeUpload = (id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  };

  const hasUploads = uploadedFiles.length > 0;

  // Tools data
  const TOOLS = [
    {
      to: "/tool",
      icon: <Sparkles className="h-6 w-6" />,
      title: "החלפת רקע AI",
      desc: "החלפת רקע חכמה עם בינה מלאכותית",
      color: "bg-gold/15 text-gold",
      query: hasUploads ? `?images=${encodeURIComponent(JSON.stringify(uploadedFiles.map(f => f.src).slice(0, 1)))}` : "",
    },
    {
      to: "/collage",
      icon: <LayoutGrid className="h-6 w-6" />,
      title: "בונה קולאז׳",
      desc: "צרו קולאז׳ מקצועי עם 14 לייאאוטים",
      color: "bg-primary/15 text-primary",
      query: "",
    },
    {
      to: "/catalog",
      icon: <BookOpen className="h-6 w-6" />,
      title: "מחולל קטלוגים",
      desc: "קטלוג מוצרים מקצועי עם PDF",
      color: "bg-accent/20 text-accent-foreground",
      query: "",
    },
    {
      to: "/gallery",
      icon: <Image className="h-6 w-6" />,
      title: "גלריית תמונות",
      desc: "כל התמונות, תיקיות והשוואה",
      color: "bg-secondary text-foreground",
      query: "",
    },
  ];

  const QUICK_ACTIONS = [
    { icon: <Eraser className="h-4 w-4" />, label: "הסרת רקע", to: "/tool" },
    { icon: <ArrowUpCircle className="h-4 w-4" />, label: "הגדלה AI", to: "/tool" },
    { icon: <Palette className="h-4 w-4" />, label: "החלפת רקע", to: "/tool" },
    { icon: <Scissors className="h-4 w-4" />, label: "חיתוך חכם", to: "/tool" },
    { icon: <SunMedium className="h-4 w-4" />, label: "צל תלת-ממדי", to: "/tool" },
    { icon: <Wand2 className="h-4 w-4" />, label: "שיפור אוטומטי", to: "/tool" },
  ];

  return (
    <div
      className="min-h-screen bg-background"
      dir="rtl"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Full-screen drag overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="flex flex-col items-center gap-4 rounded-3xl border-2 border-dashed border-gold bg-gold/5 px-8 py-8 sm:px-16 sm:py-12"
            >
              <Upload className="h-16 w-16 text-gold" />
              <p className="font-display text-2xl font-bold text-foreground">שחררו את הקבצים כאן</p>
              <p className="font-body text-sm text-muted-foreground">תמונות בודדות או תיקיות שלמות</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-gold/20 bg-background/80 backdrop-blur-md">
          <div className="mx-auto max-w-6xl flex items-center justify-between px-4 sm:px-6 py-3">
          <Link to="/" className="flex items-center gap-3">
            <img src={studioLogo} alt="רותי פרל" className="h-10 w-auto" />
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/" className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 font-accent text-xs font-semibold text-foreground transition-colors hover:border-gold/40">
              <Home className="h-3.5 w-3.5" /> דף הבית
            </Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        {/* Upload zone */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all ${
              hasUploads
                ? "border-gold/40 bg-gold/5"
                : "border-border bg-card hover:border-gold/40 hover:bg-gold/5"
            } p-6`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => e.target.files && handleFiles(e.target.files)}
              // @ts-expect-error webkitdirectory is valid
              webkitdirectory=""
              directory=""
            />

            {!hasUploads ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gold/15">
                    <Upload className="h-8 w-8 text-gold" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="font-display text-lg font-bold text-foreground">גררו תמונות או תיקיות לכאן</p>
                  <p className="font-body text-sm text-muted-foreground mt-1">
                    או לחצו לבחירת קבצים • JPG, PNG, WebP
                  </p>
                </div>
                <div className="flex flex-wrap justify-center items-center gap-3 sm:gap-6 mt-2">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = "image/*";
                      input.multiple = true;
                      input.onchange = () => input.files && handleFiles(input.files);
                      input.click();
                    }}
                    className="flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 font-display text-sm font-semibold text-gold-foreground transition-all hover:brightness-110"
                  >
                    <FileImage className="h-4 w-4" /> בחרו תמונות
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 font-display text-sm font-semibold text-foreground transition-all hover:border-gold/40"
                  >
                    <FolderOpen className="h-4 w-4" /> בחרו תיקייה
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileImage className="h-4 w-4 text-gold" />
                    <span className="font-display text-sm font-bold text-foreground">{uploadedFiles.length} תמונות הועלו</span>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); setUploadedFiles([]); }}
                    className="rounded-full border border-border px-3 py-1 font-accent text-[10px] text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
                  >
                    נקה הכל
                  </button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1" onClick={e => e.stopPropagation()}>
                  {uploadedFiles.map(f => (
                    <div key={f.id} className="relative shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-border group">
                      <img src={f.src} alt={f.name} className="h-full w-full object-cover" />
                      <button
                        onClick={() => removeUpload(f.id)}
                        className="absolute top-0.5 right-0.5 rounded-full bg-foreground/70 p-0.5 text-card opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = "image/*";
                      input.multiple = true;
                      input.onchange = () => input.files && handleFiles(input.files);
                      input.click();
                    }}
                    className="shrink-0 flex w-20 h-20 items-center justify-center rounded-xl border-2 border-dashed border-border text-muted-foreground hover:border-gold/40 hover:text-gold transition-colors"
                  >
                    <Upload className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Tools section — always visible, highlighted when uploads exist */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold text-foreground">
              {hasUploads ? "🚀 לאן לקחת את התמונות?" : "כלי עריכה"}
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {TOOLS.map(tool => (
              <Link
                key={tool.to}
                to={tool.to + tool.query}
                className={`group relative rounded-2xl border p-5 transition-all hover:shadow-lg ${
                  hasUploads
                    ? "border-gold/30 bg-gradient-to-b from-gold/5 to-transparent hover:border-gold/50 hover:shadow-gold/10"
                    : "border-border bg-card hover:border-gold/40"
                }`}
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${tool.color} mb-3`}>
                  {tool.icon}
                </div>
                <h3 className="font-display text-sm font-bold text-foreground group-hover:text-gold transition-colors">
                  {tool.title}
                </h3>
                <p className="mt-1 font-body text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                  {tool.desc}
                </p>
                <div className="mt-3 flex items-center gap-1 font-accent text-[10px] font-semibold text-gold opacity-0 group-hover:opacity-100 transition-opacity">
                  {hasUploads ? "העבר תמונות" : "פתח"}
                  <ArrowLeft className="h-3 w-3" />
                </div>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Quick actions */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
          <h2 className="font-display text-base font-bold text-foreground mb-3">פעולות מהירות</h2>
          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map(a => (
              <Link
                key={a.label}
                to={a.to}
                className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 font-accent text-xs text-muted-foreground transition-all hover:border-gold/40 hover:text-gold"
              >
                {a.icon}
                {a.label}
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Recent images */}
        {user && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-display text-base font-bold text-foreground">תמונות אחרונות</h2>
              </div>
              <Link
                to="/gallery"
                className="flex items-center gap-1 font-accent text-xs text-gold hover:underline"
              >
                לכל הגלריה
                <ChevronRight className="h-3 w-3 rotate-180" />
              </Link>
            </div>
            {loadingRecent ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
              </div>
            ) : recentImages.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-8 text-center">
                <Image className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="font-body text-sm text-muted-foreground">עדיין אין תמונות — התחילו לעבוד!</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-8 gap-2">
                {recentImages.map(img => (
                  <ImageHoverMenu
                    key={img.id}
                    imageUrl={img.result_image_url}
                    isFavorite={img.is_favorite}
                    hoverDelay={800}
                    className="group aspect-square rounded-xl border border-border hover:border-gold/40 transition-all hover:shadow-md"
                    actions={{
                      onFavorite: async () => {
                        const newValue = !img.is_favorite;
                        const { error } = await supabase
                          .from("processing_history")
                          .update({ is_favorite: newValue })
                          .eq("id", img.id);
                        if (error) {
                          toast.error("שגיאה בעדכון מועדף");
                          return;
                        }
                        setRecentImages((prev) => prev.map((item) => item.id === img.id ? { ...item, is_favorite: newValue } : item));
                        toast.success(newValue ? "נוסף למועדפים" : "הוסר ממועדפים");
                      },
                      onZoom: () => navigate("/gallery"),
                      onEdit: () => navigate(`/tool?editImage=${encodeURIComponent(img.result_image_url)}`),
                      onCollage: () => navigate(`/collage?importImage=${encodeURIComponent(img.result_image_url)}`),
                      onCatalog: () => navigate(`/catalog?importImage=${encodeURIComponent(img.result_image_url)}`),
                      onDelete: async () => {
                        const { error } = await supabase
                          .from("processing_history")
                          .delete()
                          .eq("id", img.id);
                        if (error) {
                          toast.error("שגיאה במחיקת תמונה");
                          return;
                        }
                        setRecentImages((prev) => prev.filter((item) => item.id !== img.id));
                        toast.success("התמונה נמחקה");
                      },
                      onDownload: () => {
                        const link = document.createElement("a");
                        link.href = img.result_image_url;
                        link.download = `${img.background_name || "image"}.png`;
                        link.click();
                      },
                    }}
                  >
                    <div className="h-full w-full cursor-pointer overflow-hidden rounded-xl" onClick={() => navigate("/gallery")}>
                      <img
                        src={img.result_image_url}
                        alt={img.background_name || ""}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                        loading="lazy"
                      />
                    </div>
                    {img.is_favorite && (
                      <div className="absolute top-1 right-1">
                        <Star className="h-3 w-3 fill-gold text-gold" />
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/60 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="font-accent text-[8px] text-card truncate text-center">
                        {img.background_name || "רקע מותאם"}
                      </p>
                    </div>
                  </ImageHoverMenu>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}