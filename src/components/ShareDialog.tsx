import { useState, useRef, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode-react";
import { X, Copy, Download, Share2, Check, Link2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

interface ShareDialogProps {
  imageUrl: string;
  title?: string;
  onClose: () => void;
}

async function createShareUrl(imageUrl: string): Promise<string | null> {
  try {
    // If already a public Supabase URL, use it directly
    if (imageUrl.includes("supabase.co/storage")) return imageUrl;

    // Upload base64 / blob URL to Supabase Storage → get short public URL
    let blob: Blob;
    if (imageUrl.startsWith("data:")) {
      const resp = await fetch(imageUrl);
      blob = await resp.blob();
    } else {
      const resp = await fetch(imageUrl);
      blob = await resp.blob();
    }

    const fileName = `shared/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
    const { error } = await supabase.storage
      .from("processing-results")
      .upload(fileName, blob, { contentType: "image/png", upsert: false });

    if (error) return null;

    const { data: publicData } = supabase.storage
      .from("processing-results")
      .getPublicUrl(fileName);

    return publicData?.publicUrl || null;
  } catch {
    return null;
  }
}

const ShareDialog = ({ imageUrl, title, onClose }: ShareDialogProps) => {
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const [shareUrl, setShareUrl] = useState<string>(imageUrl);
  const [shortening, setShortening] = useState(false);
  const [isShortened, setIsShortened] = useState(false);

  // Auto-generate short link for base64 URLs
  useEffect(() => {
    if (imageUrl.startsWith("data:") || imageUrl.length > 500) {
      generateShortLink();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  const generateShortLink = useCallback(async () => {
    setShortening(true);
    const url = await createShareUrl(imageUrl);
    if (url) {
      setShareUrl(url);
      setIsShortened(true);
    } else {
      toast.error("לא ניתן ליצור קישור קצר — משתמש בקישור מקורי");
    }
    setShortening(false);
  }, [imageUrl]);

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
              {shortening ? (
                <div className="w-[160px] h-[160px] flex items-center justify-center">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <QRCodeSVG value={shareUrl} size={160} level="M" />
              )}
            </div>
          </div>

          {/* Link */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                readOnly
                value={shortening ? "יוצר קישור..." : shareUrl}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 font-accent text-xs text-muted-foreground truncate focus:outline-none"
              />
              <button
                onClick={copyLink}
                disabled={shortening}
                className="flex items-center gap-1.5 rounded-lg bg-gold px-3 py-2 font-accent text-xs font-semibold text-gold-foreground transition-all hover:brightness-110 disabled:opacity-50"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "הועתק!" : "העתק"}
              </button>
            </div>
            {!isShortened && !shortening && shareUrl.length > 200 && (
              <button
                onClick={generateShortLink}
                className="flex items-center gap-1.5 text-[10px] text-primary hover:underline"
              >
                <Link2 className="h-3 w-3" />
                צור קישור קצר לשיתוף
              </button>
            )}
            {isShortened && (
              <span className="flex items-center gap-1 text-[10px] text-green-600">
                <Check className="h-3 w-3" />
                קישור קצר נוצר — מתאים ל-QR ושיתוף
              </span>
            )}
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
