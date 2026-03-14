import { useState } from "react";
import { Download, FileImage, FileText, ChevronDown } from "lucide-react";

interface ExportPanelProps {
  resultImage: string | null;
  isExporting: boolean;
  onExport: (format: string, quality: number) => void;
}

const formats = [
  { id: "png", label: "PNG", desc: "Lossless, שקיפות", icon: FileImage },
  { id: "tiff", label: "TIFF", desc: "הכי איכותי, הדפסה", icon: FileImage },
  { id: "jpg", label: "JPG", desc: "קובץ קטן, שיתוף", icon: FileImage },
  { id: "webp", label: "WebP", desc: "מודרני, אינטרנט", icon: FileImage },
  { id: "pdf", label: "PDF", desc: "מסמך, הדפסה", icon: FileText },
];

const qualityOptions = [
  { value: 100, label: "מקסימום" },
  { value: 95, label: "גבוהה מאוד" },
  { value: 90, label: "גבוהה" },
  { value: 80, label: "טובה" },
];

const ExportPanel = ({ resultImage, isExporting, onExport }: ExportPanelProps) => {
  const [selectedFormat, setSelectedFormat] = useState("png");
  const [quality, setQuality] = useState(100);
  const [isOpen, setIsOpen] = useState(false);

  const currentFormat = formats.find((f) => f.id === selectedFormat)!;

  return (
    <div className="space-y-4">
      <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">
        ייצוא
      </h3>

      {/* Format selection */}
      <div className="space-y-2">
        {formats.map((fmt) => (
          <button
            key={fmt.id}
            onClick={() => setSelectedFormat(fmt.id)}
            className={`flex w-full items-center gap-3 rounded-lg border-2 p-2.5 transition-all ${
              selectedFormat === fmt.id
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/40"
            }`}
          >
            <fmt.icon className={`h-4 w-4 ${selectedFormat === fmt.id ? "text-primary" : "text-muted-foreground"}`} />
            <div className="text-right flex-1">
              <span className="font-display text-sm font-semibold text-foreground">{fmt.label}</span>
              <span className="font-body text-xs text-muted-foreground mr-2">{fmt.desc}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Quality (for lossy formats) */}
      {(selectedFormat === "jpg" || selectedFormat === "webp") && (
        <div className="space-y-2">
          <span className="font-display text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            איכות
          </span>
          <div className="grid grid-cols-2 gap-2">
            {qualityOptions.map((q) => (
              <button
                key={q.value}
                onClick={() => setQuality(q.value)}
                className={`rounded-md border px-3 py-1.5 font-body text-xs font-medium transition-all ${
                  quality === q.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-foreground hover:border-primary/40"
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Export button */}
      <button
        onClick={() => onExport(selectedFormat, quality)}
        disabled={!resultImage || isExporting}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-display text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Download className="h-4 w-4" />
        {isExporting ? "מייצא..." : `ייצא כ-${currentFormat.label}`}
      </button>
    </div>
  );
};

export default ExportPanel;
