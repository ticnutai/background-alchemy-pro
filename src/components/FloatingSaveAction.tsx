import { useState, useCallback } from "react";
import { Save, ChevronUp, Replace, FilePlus2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface FloatingSaveActionProps {
  visible: boolean;
  onSaveNew: () => void;
  onReplace: () => void;
  isSaving?: boolean;
}

const FloatingSaveAction = ({ visible, onSaveNew, onReplace, isSaving }: FloatingSaveActionProps) => {
  const [expanded, setExpanded] = useState(false);

  const handleSaveNew = useCallback(() => {
    onSaveNew();
    setExpanded(false);
  }, [onSaveNew]);

  const handleReplace = useCallback(() => {
    onReplace();
    setExpanded(false);
  }, [onReplace]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          className="absolute bottom-4 left-4 z-30"
        >
          {expanded ? (
            <div className="flex flex-col gap-1.5 rounded-xl bg-card border border-border shadow-2xl p-2 min-w-[180px]">
              <div className="flex items-center justify-between px-2 py-1">
                <span className="font-display text-xs font-semibold text-foreground">שמירה</span>
                <button onClick={() => setExpanded(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <button
                onClick={handleSaveNew}
                disabled={isSaving}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 font-display text-xs font-semibold text-foreground bg-secondary hover:bg-secondary/80 transition disabled:opacity-50"
              >
                <FilePlus2 className="h-4 w-4 text-primary" />
                שמור כחדש
              </button>
              <button
                onClick={handleReplace}
                disabled={isSaving}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 font-display text-xs font-semibold text-primary-foreground bg-primary hover:brightness-110 transition disabled:opacity-50"
              >
                <Replace className="h-4 w-4" />
                החלף תמונה קיימת
              </button>
            </div>
          ) : (
            <button
              onClick={() => setExpanded(true)}
              className="group relative flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 font-display text-sm font-semibold text-primary-foreground shadow-lg hover:shadow-xl hover:brightness-110 transition-all"
            >
              {isSaving ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              שמור
              <ChevronUp className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100 transition" />
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-amber-400 animate-pulse" />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FloatingSaveAction;
