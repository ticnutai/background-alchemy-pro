import { useState, useRef } from "react";
import { QRCodeSVG } from "qrcode-react";
import { X, Copy, Download, Share2, Check } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface ShareDialogProps {
  imageUrl: string;
  title?: string;
  onClose: () => void;
}

const ShareDialog = ({ imageUrl, title, onClose }: ShareDialogProps) => {
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const shareUrl = imageUrl;

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("הקישור הועתק!");
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadQR = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([data], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "qr-code.svg";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("QR Code הורד!");
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: title || "תמונת מוצר", url: shareUrl });
      } catch {}
    } else {
      copyLink();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 backdrop-blur-sm p-4" dir="rtl" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-gold" />
            <h3 className="font-display text-lg font-bold text-foreground">שיתוף תמונה</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-secondary transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Preview */}
          <div className="aspect-square w-32 mx-auto rounded-xl overflow-hidden border border-border shadow-sm">
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          </div>

          {/* QR Code */}
          <div ref={qrRef} className="flex justify-center">
            <div className="rounded-xl border border-border bg-background p-4">
              <QRCodeSVG value={shareUrl} size={160} level="M" />
            </div>
          </div>

          {/* Link */}
          <div className="flex gap-2">
            <input
              readOnly
              value={shareUrl}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 font-accent text-xs text-muted-foreground truncate focus:outline-none"
            />
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 rounded-lg bg-gold px-3 py-2 font-accent text-xs font-semibold text-gold-foreground transition-all hover:brightness-110"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "הועתק!" : "העתק"}
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={shareNative}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 font-accent text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
            >
              <Share2 className="h-3.5 w-3.5" /> שתף
            </button>
            <button
              onClick={downloadQR}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 font-accent text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
            >
              <Download className="h-3.5 w-3.5" /> הורד QR
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ShareDialog;
