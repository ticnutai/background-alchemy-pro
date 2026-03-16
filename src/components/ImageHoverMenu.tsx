import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Heart, ZoomIn, Pencil, Copy, SlidersHorizontal,
  LayoutGrid, BookOpen, Trash2, FolderInput, Folder,
  Download,
} from "lucide-react";

export interface ImageHoverMenuActions {
  onFavorite?: () => void;
  onZoom?: () => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onCompare?: () => void;
  onCollage?: () => void;
  onCatalog?: () => void;
  onDelete?: () => void;
  onDownload?: () => void;
  onMoveToFolder?: (folderId: string | null) => void;
}

interface ImageHoverMenuProps {
  imageUrl: string;
  isFavorite?: boolean;
  isComparing?: boolean;
  actions: ImageHoverMenuActions;
  folders?: { id: string; name: string; color?: string }[];
  currentFolderId?: string | null;
  /** Delay in ms before showing popup (default 800) */
  hoverDelay?: number;
  children: React.ReactNode;
  className?: string;
}

const ImageHoverMenu = ({
  isFavorite = false,
  isComparing = false,
  actions,
  folders = [],
  currentFolderId,
  hoverDelay = 800,
  children,
  className = "",
}: ImageHoverMenuProps) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showFolderSub, setShowFolderSub] = useState(false);
  const [position, setPosition] = useState<"top" | "bottom">("top");
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const startHover = useCallback(() => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
    hoverTimer.current = setTimeout(() => {
      // Check if near top of viewport
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setPosition(rect.top < 160 ? "bottom" : "top");
      }
      setShowMenu(true);
    }, hoverDelay);
  }, [hoverDelay]);

  const cancelHover = useCallback(() => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  }, []);

  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseLeave = useCallback(() => {
    cancelHover();
    leaveTimer.current = setTimeout(() => {
      setShowMenu(false);
      setShowFolderSub(false);
    }, 300);
  }, [cancelHover]);

  const handleMouseEnterMenu = useCallback(() => {
    cancelHover();
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
    setShowMenu(true);
  }, [cancelHover]);

  useEffect(() => {
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    };
  }, []);

  const BTN =
    "flex flex-col items-center gap-0.5 rounded-lg p-1.5 transition-colors";

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      onMouseEnter={startHover}
      onMouseLeave={handleMouseLeave}
    >
      {children}

      {showMenu && (
        <div
          ref={menuRef}
          className={`absolute left-1/2 -translate-x-1/2 z-[100] animate-in fade-in duration-200 ${
            position === "top"
              ? "bottom-full mb-2 slide-in-from-bottom-2"
              : "top-full mt-2 slide-in-from-top-2"
          }`}
          onMouseEnter={handleMouseEnterMenu}
          onMouseLeave={handleMouseLeave}
          onClick={(e) => e.stopPropagation()}
          style={{ pointerEvents: "auto" }}
        >
          <div className="flex flex-col">
          <div className="grid grid-cols-4 gap-1 rounded-xl bg-card shadow-xl border border-border p-2 min-w-[180px]">
            {/* Favorite */}
            {actions.onFavorite && (
              <button
                onClick={actions.onFavorite}
                className={`${BTN} ${
                  isFavorite
                    ? "bg-gold/20 text-gold"
                    : "text-muted-foreground hover:text-gold hover:bg-gold/10"
                }`}
                title="מועדף"
              >
                <Heart className={`h-3.5 w-3.5 ${isFavorite ? "fill-current" : ""}`} />
                <span className="text-[8px] font-accent">מועדף</span>
              </button>
            )}

            {/* Zoom */}
            {actions.onZoom && (
              <button
                onClick={actions.onZoom}
                className={`${BTN} text-muted-foreground hover:text-foreground hover:bg-secondary`}
                title="הגדל"
              >
                <ZoomIn className="h-3.5 w-3.5" />
                <span className="text-[8px] font-accent">הגדל</span>
              </button>
            )}

            {/* Edit */}
            {actions.onEdit && (
              <button
                onClick={actions.onEdit}
                className={`${BTN} text-muted-foreground hover:text-primary hover:bg-primary/10`}
                title="ערוך"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span className="text-[8px] font-accent">ערוך</span>
              </button>
            )}

            {/* Duplicate */}
            {actions.onDuplicate && (
              <button
                onClick={actions.onDuplicate}
                className={`${BTN} text-muted-foreground hover:text-foreground hover:bg-secondary`}
                title="שכפל"
              >
                <Copy className="h-3.5 w-3.5" />
                <span className="text-[8px] font-accent">שכפל</span>
              </button>
            )}

            {/* Compare */}
            {actions.onCompare && (
              <button
                onClick={actions.onCompare}
                className={`${BTN} ${
                  isComparing
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                }`}
                title="השוואה"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span className="text-[8px] font-accent">השוואה</span>
              </button>
            )}

            {/* Collage */}
            {actions.onCollage && (
              <button
                onClick={actions.onCollage}
                className={`${BTN} text-muted-foreground hover:text-primary hover:bg-primary/10`}
                title="קולאז׳"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="text-[8px] font-accent">קולאז׳</span>
              </button>
            )}

            {/* Catalog */}
            {actions.onCatalog && (
              <button
                onClick={actions.onCatalog}
                className={`${BTN} text-muted-foreground hover:text-primary hover:bg-primary/10`}
                title="קטלוג"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span className="text-[8px] font-accent">קטלוג</span>
              </button>
            )}

            {/* Download */}
            {actions.onDownload && (
              <button
                onClick={actions.onDownload}
                className={`${BTN} text-muted-foreground hover:text-foreground hover:bg-secondary`}
                title="הורד"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="text-[8px] font-accent">הורד</span>
              </button>
            )}

            {/* Folder */}
            {actions.onMoveToFolder && folders.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowFolderSub(!showFolderSub)}
                  className={`${BTN} w-full text-muted-foreground hover:text-gold hover:bg-gold/10`}
                  title="תיקייה"
                >
                  <FolderInput className="h-3.5 w-3.5" />
                  <span className="text-[8px] font-accent">תיקייה</span>
                </button>
                {showFolderSub && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-40 bg-card border border-border rounded-lg shadow-xl py-1 min-w-[120px] animate-in fade-in slide-in-from-bottom-1 duration-150">
                    <button
                      onClick={() => { actions.onMoveToFolder!(null); setShowFolderSub(false); setShowMenu(false); }}
                      className="w-full text-right px-3 py-1.5 text-xs hover:bg-secondary transition-colors text-muted-foreground"
                    >
                      ללא תיקייה
                    </button>
                    {folders.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => { actions.onMoveToFolder!(f.id); setShowFolderSub(false); setShowMenu(false); }}
                        className={`w-full text-right px-3 py-1.5 text-xs hover:bg-secondary transition-colors flex items-center gap-1.5 ${
                          currentFolderId === f.id ? "text-gold font-semibold" : "text-foreground"
                        }`}
                      >
                        <Folder className="h-3 w-3" style={{ color: f.color || undefined }} />
                        {f.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Delete */}
            {actions.onDelete && (
              <button
                onClick={actions.onDelete}
                className={`${BTN} text-muted-foreground hover:text-destructive hover:bg-destructive/10`}
                title="מחק"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="text-[8px] font-accent">מחק</span>
              </button>
            )}
          </div>
          {/* Arrow */}
          {position === "top" ? (
            <div className="flex justify-center">
              <div className="w-3 h-3 bg-card border-b border-r border-border rotate-45 -mt-1.5" />
            </div>
          ) : (
            <div className="flex justify-center order-first">
              <div className="w-3 h-3 bg-card border-t border-l border-border rotate-45 -mb-1.5" />
            </div>
          )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageHoverMenu;
