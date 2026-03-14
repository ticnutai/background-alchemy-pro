import { Slider } from "@/components/ui/slider";
import { Sun, Contrast, Droplets, Focus, Thermometer } from "lucide-react";

export interface ImageAdjustments {
  brightness: number;
  contrast: number;
  saturation: number;
  sharpness: number;
  warmth: number;
}

export const defaultAdjustments: ImageAdjustments = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  sharpness: 0,
  warmth: 0,
};

interface ImageAdjustmentsProps {
  adjustments: ImageAdjustments;
  onChange: (adjustments: ImageAdjustments) => void;
  onReset: () => void;
}

const sliders = [
  { key: "brightness" as const, label: "בהירות", icon: Sun, min: 50, max: 150, unit: "%" },
  { key: "contrast" as const, label: "ניגודיות", icon: Contrast, min: 50, max: 150, unit: "%" },
  { key: "saturation" as const, label: "רוויה", icon: Droplets, min: 0, max: 200, unit: "%" },
  { key: "sharpness" as const, label: "חדות", icon: Focus, min: 0, max: 5, unit: "px" },
  { key: "warmth" as const, label: "חמימות", icon: Thermometer, min: -30, max: 30, unit: "°" },
];

export function getFilterString(adj: ImageAdjustments): string {
  const filters: string[] = [
    `brightness(${adj.brightness}%)`,
    `contrast(${adj.contrast}%)`,
    `saturate(${adj.saturation}%)`,
  ];
  if (adj.warmth > 0) {
    filters.push(`sepia(${adj.warmth}%)`);
  } else if (adj.warmth < 0) {
    filters.push(`hue-rotate(${adj.warmth}deg)`);
  }
  return filters.join(" ");
}

const ImageAdjustmentsPanel = ({ adjustments, onChange, onReset }: ImageAdjustmentsProps) => {
  const isDefault = JSON.stringify(adjustments) === JSON.stringify(defaultAdjustments);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">
          התאמות תמונה
        </h3>
        {!isDefault && (
          <button
            onClick={onReset}
            className="font-body text-xs text-primary hover:underline"
          >
            איפוס
          </button>
        )}
      </div>

      {sliders.map(({ key, label, icon: Icon, min, max }) => (
        <div key={key} className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-body text-xs font-medium text-foreground">{label}</span>
            </div>
            <span className="font-body text-xs text-muted-foreground tabular-nums">
              {adjustments[key]}
            </span>
          </div>
          <Slider
            value={[adjustments[key]]}
            onValueChange={([v]) => onChange({ ...adjustments, [key]: v })}
            min={min}
            max={max}
            step={1}
            className="cursor-pointer"
          />
        </div>
      ))}
    </div>
  );
};

export default ImageAdjustmentsPanel;
