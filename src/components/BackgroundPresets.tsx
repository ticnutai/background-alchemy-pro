interface Preset {
  id: string;
  label: string;
  prompt: string;
  preview: string; // CSS gradient/color to represent
}

const presets: Preset[] = [
  {
    id: "white-marble",
    label: "שיש לבן עם גידים אפורים",
    prompt: "Clean white marble surface with subtle light gray veins, elegant and luxurious, studio lighting, high resolution",
    preview: "linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 30%, #f9f9f9 50%, #e0e0e0 70%, #f5f5f5 100%)",
  },
  {
    id: "pure-white",
    label: "לבן נקי",
    prompt: "Pure clean white background, seamless, professional product photography, studio lighting",
    preview: "linear-gradient(135deg, #ffffff 0%, #f8f8f8 100%)",
  },
  {
    id: "light-wood",
    label: "עץ בהיר",
    prompt: "Light natural oak wood surface, warm tones, soft grain texture, professional product photography",
    preview: "linear-gradient(135deg, #d4a574 0%, #c4956a 50%, #dbb58e 100%)",
  },
  {
    id: "dark-marble",
    label: "שיש כהה",
    prompt: "Dark black marble with gold veins, luxurious and elegant, studio lighting",
    preview: "linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 30%, #333 50%, #1a1a1a 100%)",
  },
  {
    id: "concrete",
    label: "בטון",
    prompt: "Light gray concrete surface, minimal texture, modern industrial style, studio lighting",
    preview: "linear-gradient(135deg, #b0b0b0 0%, #a0a0a0 50%, #b8b8b8 100%)",
  },
  {
    id: "linen",
    label: "פשתן טבעי",
    prompt: "Natural linen fabric texture background, soft beige, elegant and organic, studio lighting",
    preview: "linear-gradient(135deg, #e8ddd0 0%, #d8cfc2 50%, #ece3d6 100%)",
  },
];

interface BackgroundPresetsProps {
  selectedId: string | null;
  onSelect: (preset: Preset) => void;
  customPrompt: string;
  onCustomPromptChange: (value: string) => void;
}

const BackgroundPresets = ({
  selectedId,
  onSelect,
  customPrompt,
  onCustomPromptChange,
}: BackgroundPresetsProps) => {
  return (
    <div className="space-y-4">
      <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">
        בחר רקע
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {presets.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onSelect(preset)}
            className={`group relative flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all ${
              selectedId === preset.id
                ? "border-primary bg-primary/5 shadow-md"
                : "border-border hover:border-primary/50 hover:shadow-sm"
            }`}
          >
            <div
              className="h-12 w-full rounded-md"
              style={{ background: preset.preview }}
            />
            <span className="font-body text-xs font-medium text-foreground">
              {preset.label}
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-2 pt-2">
        <label className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">
          או תאר רקע מותאם אישית
        </label>
        <textarea
          value={customPrompt}
          onChange={(e) => onCustomPromptChange(e.target.value)}
          placeholder="לדוגמה: שיש ורוד עם גידים זהובים..."
          className="w-full rounded-lg border border-input bg-card p-3 font-body text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          rows={3}
          dir="rtl"
        />
      </div>
    </div>
  );
};

export type { Preset };
export default BackgroundPresets;
