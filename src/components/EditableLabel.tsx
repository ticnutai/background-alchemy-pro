import { useState, useRef, useEffect } from "react";
import { Pencil, Check, X } from "lucide-react";

interface EditableLabelProps {
  hebrewName: string;
  englishName: string;
  onSave: (hebrewName: string, englishName: string) => void;
  size?: "sm" | "md";
  className?: string;
}

const EditableLabel = ({ hebrewName, englishName, onSave, size = "sm", className = "" }: EditableLabelProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [heVal, setHeVal] = useState(hebrewName);
  const [enVal, setEnVal] = useState(englishName);
  const heRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) heRef.current?.focus();
  }, [isEditing]);

  useEffect(() => {
    setHeVal(hebrewName);
    setEnVal(englishName);
  }, [hebrewName, englishName]);

  const handleSave = () => {
    if (heVal.trim() || enVal.trim()) {
      onSave(heVal.trim(), enVal.trim());
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setHeVal(hebrewName);
    setEnVal(englishName);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") handleCancel();
  };

  if (isEditing) {
    return (
      <div className={`flex flex-col gap-1 ${className}`} onClick={(e) => e.stopPropagation()}>
        <input
          ref={heRef}
          value={heVal}
          onChange={(e) => setHeVal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="שם בעברית"
          dir="rtl"
          className={`w-full rounded-md border border-primary/50 bg-background px-2 py-0.5 font-body text-foreground focus:outline-none focus:ring-1 focus:ring-primary ${
            size === "sm" ? "text-[10px]" : "text-sm"
          }`}
        />
        <input
          value={enVal}
          onChange={(e) => setEnVal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="English name"
          dir="ltr"
          className={`w-full rounded-md border border-primary/50 bg-background px-2 py-0.5 font-body text-muted-foreground italic focus:outline-none focus:ring-1 focus:ring-primary ${
            size === "sm" ? "text-[9px]" : "text-xs"
          }`}
        />
        <div className="flex items-center gap-1 justify-center">
          <button
            onClick={handleSave}
            className="rounded-md bg-primary p-0.5 text-primary-foreground hover:brightness-110 transition-all"
          >
            <Check className="h-3 w-3" />
          </button>
          <button
            onClick={handleCancel}
            className="rounded-md border border-border bg-background p-0.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`group/edit relative flex flex-col items-center ${className}`}>
      <div className="flex items-center gap-1">
        <span className={`font-body leading-tight font-medium text-foreground text-center ${
          size === "sm" ? "text-[10px]" : "text-sm font-semibold"
        }`}>
          {hebrewName}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
          className="opacity-0 group-hover/edit:opacity-100 transition-opacity shrink-0"
          title="ערוך שם"
        >
          <Pencil className={`text-muted-foreground hover:text-primary transition-colors ${
            size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"
          }`} />
        </button>
      </div>
      <span className={`text-muted-foreground italic ${
        size === "sm" ? "font-body text-[9px]" : "font-body text-xs"
      }`}>
        {englishName}
      </span>
    </div>
  );
};

export default EditableLabel;
