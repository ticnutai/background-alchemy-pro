import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ZoomIn, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

interface ResultItem {
  id: string;
  result_image_url: string;
  background_name: string | null;
  created_at: string;
}

interface ResultsStripProps {
  onSelectImage?: (url: string) => void;
  currentResultUrl?: string | null;
}

const ResultsStrip = ({ onSelectImage, currentResultUrl }: ResultsStripProps) => {
  const [items, setItems] = useState<ResultItem[]>([]);

  useEffect(() => {
    supabase.from("processing_history")
      .select("id, result_image_url, background_name, created_at")
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) setItems(data);
      });
  }, [currentResultUrl]);

  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-bold text-foreground">רקעים אחרונים</h3>
        <Link to="/gallery" className="flex items-center gap-1 font-accent text-xs text-gold hover:underline">
          לגלריה המלאה <ArrowLeft className="h-3 w-3" />
        </Link>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => onSelectImage?.(item.result_image_url)}
            className="group relative shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-border hover:border-gold/50 transition-all"
          >
            <img src={item.result_image_url} alt={item.background_name || ""} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/30 transition-colors flex items-center justify-center">
              <ZoomIn className="h-3.5 w-3.5 text-card opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="absolute bottom-0 inset-x-0 bg-foreground/60 px-1 py-0.5 font-accent text-[8px] text-card truncate text-center">
              {item.background_name || "מותאם"}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ResultsStrip;
