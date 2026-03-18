import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Brain, Sparkles, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Suggestion {
  name: string;
  nameEn: string;
  prompt: string;
  reason: string;
}

interface ProductInfo {
  type: string;
  material: string;
  colors: string[];
  style: string;
}

interface SmartSuggestPanelProps {
  imageBase64: string | null;
  onSelectPrompt: (prompt: string, name: string) => void;
}

const SmartSuggestPanel = ({ imageBase64, onSelectPrompt }: SmartSuggestPanelProps) => {
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const analyze = async () => {
    if (!imageBase64) { toast.error("העלה תמונה קודם"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("smart-suggest", {
        body: { imageBase64 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setProduct(data.product);
      setSuggestions(data.suggestions || []);
      toast.success("ניתוח הושלם!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "שגיאה בניתוח");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={analyze}
        disabled={loading || !imageBase64}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-l from-primary to-accent px-4 py-3 font-display text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
        {loading ? "מנתח מוצר..." : "🧠 ניתוח חכם — הצע רקעים"}
      </button>

      <AnimatePresence>
        {product && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1"
          >
            <p className="font-display text-xs font-bold text-primary">🔍 זיהוי מוצר</p>
            <p className="font-body text-xs text-foreground">{product.type} • {product.material} • {product.style}</p>
            <div className="flex gap-1 flex-wrap">
              {product.colors.map((c, i) => (
                <span key={i} className="rounded-full bg-secondary px-2 py-0.5 font-accent text-[10px] text-muted-foreground">{c}</span>
              ))}
            </div>
          </motion.div>
        )}

        {suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-2"
          >
            <p className="font-display text-xs font-bold text-foreground">✨ רקעים מומלצים</p>
            {suggestions.map((s, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                onClick={() => onSelectPrompt(s.prompt, s.name)}
                className="w-full rounded-lg border border-border bg-card p-3 text-right transition-all hover:border-gold/50 hover:shadow-sm group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-display text-xs font-bold text-foreground">{s.name}</p>
                    <p className="font-accent text-[10px] text-muted-foreground">{s.nameEn}</p>
                    <p className="mt-1 font-body text-[10px] text-muted-foreground leading-relaxed">{s.reason}</p>
                  </div>
                  <Sparkles className="h-3.5 w-3.5 text-gold opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SmartSuggestPanel;
