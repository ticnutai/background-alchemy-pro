import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Heart, Trash2, Clock, X, Download, Pencil } from "lucide-react";
import EditableLabel from "@/components/EditableLabel";

interface HistoryItem {
  id: string;
  original_image_url: string;
  result_image_url: string;
  background_prompt: string;
  background_name: string | null;
  is_favorite: boolean;
  created_at: string;
}

interface HistoryPanelProps {
  onClose: () => void;
  onSelectImage?: (url: string) => void;
}

const HistoryPanel = ({ onClose, onSelectImage }: HistoryPanelProps) => {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "favorites">("all");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("processing_history")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("שגיאה בטעינת ההיסטוריה");
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };

  const toggleFavorite = async (item: HistoryItem) => {
    const newVal = !item.is_favorite;
    const { error } = await supabase
      .from("processing_history")
      .update({ is_favorite: newVal })
      .eq("id", item.id);

    if (error) {
      toast.error("שגיאה בעדכון");
    } else {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_favorite: newVal } : i))
      );
      toast.success(newVal ? "נוסף למועדפים ⭐" : "הוסר מהמועדפים");
    }
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase
      .from("processing_history")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("שגיאה במחיקה");
    } else {
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success("נמחק מההיסטוריה");
    }
  };

  const downloadImage = async (url: string, name: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = name || "image.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      toast.success("התמונה הורדה בהצלחה!");
    } catch {
      toast.error("שגיאה בהורדת התמונה");
    }
  };

  const filtered = filter === "favorites" ? items.filter((i) => i.is_favorite) : items;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 backdrop-blur-sm p-4" dir="rtl">
      <div className="w-full max-w-4xl max-h-[85vh] rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-gold" />
            <h2 className="font-display text-lg font-bold text-foreground">היסטוריית עיבודים</h2>
            <span className="rounded-full bg-gold/10 px-2.5 py-0.5 font-accent text-xs text-gold">
              {items.length} תמונות
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setFilter("all")}
                className={`px-3 py-1.5 font-accent text-xs transition-colors ${
                  filter === "all" ? "bg-gold text-gold-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                הכל
              </button>
              <button
                onClick={() => setFilter("favorites")}
                className={`px-3 py-1.5 font-accent text-xs transition-colors ${
                  filter === "favorites" ? "bg-gold text-gold-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                ⭐ מועדפים
              </button>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-secondary transition-colors">
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <Clock className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="font-body text-sm text-muted-foreground">
                {filter === "favorites" ? "אין מועדפים עדיין" : "אין היסטוריה עדיין — עבד תמונה ראשונה!"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {filtered.map((item) => (
                <div
                  key={item.id}
                  className="group relative rounded-xl border border-border overflow-hidden bg-background transition-all hover:border-gold/40 hover:shadow-lg"
                >
                  <div className="aspect-square overflow-hidden">
                    <img
                      src={item.result_image_url}
                      alt={item.background_name || "תוצאה"}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 cursor-pointer"
                      onClick={() => onSelectImage?.(item.result_image_url)}
                    />
                  </div>
                  <div className="p-3">
                    <EditableLabel
                      hebrewName={item.background_name || "רקע מותאם"}
                      englishName={item.background_prompt?.slice(0, 30) || "Custom background"}
                      onSave={async (he) => {
                        const { error } = await supabase
                          .from("processing_history")
                          .update({ background_name: he })
                          .eq("id", item.id);
                        if (!error) {
                          setItems(prev => prev.map(it => it.id === item.id ? { ...it, background_name: he } : it));
                          toast.success("השם עודכן");
                        }
                      }}
                      size="sm"
                    />
                    <p className="font-body text-xs text-muted-foreground mt-0.5">
                      {new Date(item.created_at).toLocaleDateString("he-IL")}
                    </p>
                  </div>

                  {/* Actions overlay */}
                  <div className="absolute top-2 left-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => toggleFavorite(item)}
                      className={`rounded-full p-1.5 backdrop-blur-sm transition-colors ${
                        item.is_favorite
                          ? "bg-gold/90 text-gold-foreground"
                          : "bg-foreground/50 text-card hover:bg-gold/90"
                      }`}
                    >
                      <Heart className={`h-3.5 w-3.5 ${item.is_favorite ? "fill-current" : ""}`} />
                    </button>
                    <button
                      onClick={() => downloadImage(item.result_image_url, item.background_name || "image")}
                      className="rounded-full bg-foreground/50 p-1.5 text-card backdrop-blur-sm hover:bg-foreground/70 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(item.id)}
                      className="rounded-full bg-foreground/50 p-1.5 text-card backdrop-blur-sm hover:bg-destructive transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Favorite badge */}
                  {item.is_favorite && (
                    <div className="absolute top-2 right-2">
                      <span className="text-sm">⭐</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryPanel;
