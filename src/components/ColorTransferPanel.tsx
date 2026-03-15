import { useState, useCallback, useRef } from "react";
import { Pipette, Upload, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

interface ColorTransferPanelProps {
  currentImage: string;
  onApply: (referenceBase64: string) => void;
  isProcessing: boolean;
}

const ColorTransferPanel = ({ currentImage, onApply, isProcessing }: ColorTransferPanelProps) => {
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("יש לבחור קובץ תמונה");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setReferenceImage(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Pipette className="h-4 w-4 text-gold" />
        <h3 className="font-display text-sm font-semibold text-foreground">העברת צבע מתמונת השראה</h3>
      </div>

      <p className="font-body text-[10px] text-muted-foreground">
        העלה תמונת השראה — הפלטה והטון שלה יועברו לתמונת המוצר שלך.
      </p>

      {/* Reference upload */}
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

      {!referenceImage ? (
        <button
          onClick={() => fileRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-6 transition-all hover:border-gold/40 hover:bg-secondary/20"
        >
          <Upload className="h-6 w-6 text-muted-foreground" />
          <span className="font-body text-xs text-muted-foreground">העלה תמונת השראה</span>
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="font-body text-xs font-semibold text-foreground">תמונת השראה:</label>
            <button onClick={() => setReferenceImage(null)} className="text-muted-foreground hover:text-destructive">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <span className="font-body text-[9px] text-muted-foreground">מקור</span>
              <div className="rounded-lg overflow-hidden border border-border aspect-square">
                <img src={currentImage} alt="source" className="w-full h-full object-cover" />
              </div>
            </div>
            <div className="space-y-1">
              <span className="font-body text-[9px] text-muted-foreground">השראה</span>
              <div className="rounded-lg overflow-hidden border border-gold/30 aspect-square">
                <img src={referenceImage} alt="reference" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => referenceImage && onApply(referenceImage)}
        disabled={isProcessing || !referenceImage}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-gold py-2.5 font-display text-sm font-semibold text-gold-foreground transition-all hover:brightness-110 disabled:opacity-50"
      >
        <Sparkles className="h-4 w-4" />
        {isProcessing ? "מעביר צבעים..." : "העבר פלטת צבעים"}
      </button>
    </div>
  );
};

export default ColorTransferPanel;
