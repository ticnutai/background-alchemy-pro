import { useEffect, useRef, useState, memo, useCallback } from "react";
import { BarChart3 } from "lucide-react";

type Channel = "rgb" | "r" | "g" | "b" | "luminance";

interface LiveHistogramProps {
  imageSrc: string | null;
  /** Optional CSS filter string applied live — triggers re-analysis */
  liveFilterCss?: string;
}

const CHANNEL_CONFIG: Record<Channel, { label: string; color: string; bgClass: string }> = {
  rgb: { label: "RGB", color: "hsl(var(--foreground))", bgClass: "bg-foreground/20" },
  r: { label: "אדום", color: "#ef4444", bgClass: "bg-red-500/20" },
  g: { label: "ירוק", color: "#22c55e", bgClass: "bg-green-500/20" },
  b: { label: "כחול", color: "#3b82f6", bgClass: "bg-blue-500/20" },
  luminance: { label: "בהירות", color: "hsl(var(--muted-foreground))", bgClass: "bg-muted/30" },
};

const CHANNELS: Channel[] = ["rgb", "r", "g", "b", "luminance"];

/**
 * Analyse an image source and return histogram data for R, G, B, and luminance.
 * Down-samples the image to max 256px for speed.
 */
function analyseImage(src: string, filterCss?: string): Promise<Record<"r" | "g" | "b" | "luminance", Uint32Array>> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const MAX = 256;
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > MAX || h > MAX) {
        const ratio = Math.min(MAX / w, MAX / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;

      if (filterCss) {
        ctx.filter = filterCss;
      }

      ctx.drawImage(img, 0, 0, w, h);
      const { data } = ctx.getImageData(0, 0, w, h);

      const rHist = new Uint32Array(256);
      const gHist = new Uint32Array(256);
      const bHist = new Uint32Array(256);
      const lumHist = new Uint32Array(256);

      for (let i = 0; i < data.length; i += 4) {
        const rv = data[i];
        const gv = data[i + 1];
        const bv = data[i + 2];
        rHist[rv]++;
        gHist[gv]++;
        bHist[bv]++;
        const lum = Math.round(0.2126 * rv + 0.7152 * gv + 0.0722 * bv);
        lumHist[lum]++;
      }

      resolve({ r: rHist, g: gHist, b: bHist, luminance: lumHist });
    };
    img.onerror = () => reject(new Error("Failed to load image for histogram"));
    img.src = src;
  });
}

const BAR_COUNT = 64; // number of bars to render (bins are grouped)

function binData(hist: Uint32Array, bins: number): number[] {
  const binSize = 256 / bins;
  const result: number[] = [];
  for (let i = 0; i < bins; i++) {
    let sum = 0;
    const start = Math.floor(i * binSize);
    const end = Math.floor((i + 1) * binSize);
    for (let j = start; j < end; j++) sum += hist[j];
    result.push(sum);
  }
  return result;
}

const LiveHistogram = memo(({ imageSrc, liveFilterCss }: LiveHistogramProps) => {
  const [histData, setHistData] = useState<Record<"r" | "g" | "b" | "luminance", Uint32Array> | null>(null);
  const [activeChannel, setActiveChannel] = useState<Channel>("rgb");
  const [collapsed, setCollapsed] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const compute = useCallback(() => {
    if (!imageSrc) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await analyseImage(imageSrc, liveFilterCss);
        setHistData(data);
      } catch {
        /* ignore */
      }
    }, 200);
  }, [imageSrc, liveFilterCss]);

  useEffect(() => {
    compute();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [compute]);

  if (!imageSrc) return null;

  const renderBars = () => {
    if (!histData) return null;

    if (activeChannel === "rgb") {
      const rBins = binData(histData.r, BAR_COUNT);
      const gBins = binData(histData.g, BAR_COUNT);
      const bBins = binData(histData.b, BAR_COUNT);
      const maxVal = Math.max(...rBins, ...gBins, ...bBins, 1);

      return (
        <div className="relative h-20 flex items-end gap-px">
          {rBins.map((_, i) => {
            const rH = (rBins[i] / maxVal) * 100;
            const gH = (gBins[i] / maxVal) * 100;
            const bH = (bBins[i] / maxVal) * 100;
            return (
              <div key={i} className="flex-1 relative h-full flex items-end">
                <div className="absolute bottom-0 w-full rounded-t-[1px] opacity-50" style={{ height: `${rH}%`, backgroundColor: "#ef4444" }} />
                <div className="absolute bottom-0 w-full rounded-t-[1px] opacity-50" style={{ height: `${gH}%`, backgroundColor: "#22c55e" }} />
                <div className="absolute bottom-0 w-full rounded-t-[1px] opacity-50" style={{ height: `${bH}%`, backgroundColor: "#3b82f6" }} />
              </div>
            );
          })}
        </div>
      );
    }

    const channelKey = activeChannel === "luminance" ? "luminance" : activeChannel;
    const bins = binData(histData[channelKey], BAR_COUNT);
    const maxVal = Math.max(...bins, 1);
    const color = CHANNEL_CONFIG[activeChannel].color;

    return (
      <div className="relative h-20 flex items-end gap-px">
        {bins.map((val, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-[1px] opacity-70"
            style={{ height: `${(val / maxVal) * 100}%`, backgroundColor: color }}
          />
        ))}
      </div>
    );
  };

  // Stats
  const stats = histData
    ? (() => {
        const ch = activeChannel === "rgb" ? "luminance" : activeChannel;
        const hist = histData[ch];
        let totalPixels = 0;
        let sum = 0;
        for (let i = 0; i < 256; i++) {
          totalPixels += hist[i];
          sum += hist[i] * i;
        }
        const mean = totalPixels > 0 ? Math.round(sum / totalPixels) : 0;
        // Find median
        let cumulative = 0;
        let median = 0;
        for (let i = 0; i < 256; i++) {
          cumulative += hist[i];
          if (cumulative >= totalPixels / 2) {
            median = i;
            break;
          }
        }
        return { mean, median };
      })()
    : null;

  return (
    <div className="space-y-2">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 w-full text-right"
      >
        <BarChart3 className="h-4 w-4 text-primary" />
        <span className="font-display text-sm font-semibold text-foreground">היסטוגרמה חיה</span>
        <span className="text-xs text-muted-foreground mr-auto">{collapsed ? "▸" : "▾"}</span>
      </button>

      {!collapsed && (
        <div className="space-y-2">
          {/* Channel selector */}
          <div className="flex gap-1">
            {CHANNELS.map((ch) => (
              <button
                key={ch}
                onClick={() => setActiveChannel(ch)}
                className={`flex-1 text-[10px] font-body py-1 rounded transition-colors ${
                  activeChannel === ch
                    ? `${CHANNEL_CONFIG[ch].bgClass} text-foreground font-semibold`
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {CHANNEL_CONFIG[ch].label}
              </button>
            ))}
          </div>

          {/* Histogram chart */}
          <div className="bg-muted/30 rounded-lg p-2 border border-border">
            {histData ? renderBars() : (
              <div className="h-20 flex items-center justify-center text-xs text-muted-foreground">
                מנתח...
              </div>
            )}
          </div>

          {/* Stats */}
          {stats && (
            <div className="flex justify-between text-[10px] text-muted-foreground font-body px-1">
              <span>ממוצע: {stats.mean}</span>
              <span>חציון: {stats.median}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

LiveHistogram.displayName = "LiveHistogram";
export default LiveHistogram;
