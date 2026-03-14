import marbleRef from "@/assets/marble-reference.jpeg";

interface Preset {
  id: string;
  label: string;
  prompt: string;
  preview: string;
  category: string;
}

const presets: Preset[] = [
  // שיש / Marble
  {
    id: "white-marble-gray",
    label: "שיש לבן — גידים אפורים בהירים",
    prompt: "Clean white Calacatta marble surface with subtle light gray veins, elegant luxury feel, soft studio lighting, high resolution product photography background",
    preview: "linear-gradient(135deg, #f7f6f4 0%, #eae8e4 25%, #f5f4f2 45%, #e8e6e2 65%, #f7f6f4 100%)",
    category: "שיש",
  },
  {
    id: "white-marble-gold",
    label: "שיש לבן — גידים זהובים",
    prompt: "White marble surface with elegant golden veins, luxurious Calacatta gold marble, warm studio lighting, high resolution",
    preview: "linear-gradient(135deg, #faf8f5 0%, #e8d5b0 30%, #f9f7f3 55%, #dcc9a0 80%, #faf8f5 100%)",
    category: "שיש",
  },
  {
    id: "dark-marble",
    label: "שיש שחור — גידים זהובים",
    prompt: "Dark black Nero Marquina marble with dramatic gold veins, luxurious, studio lighting, high resolution",
    preview: "linear-gradient(135deg, #1a1a1a 0%, #2a2520 30%, #111 55%, #2a2520 80%, #1a1a1a 100%)",
    category: "שיש",
  },
  {
    id: "green-marble",
    label: "שיש ירוק",
    prompt: "Green Verde Guatemala marble surface with white veins, elegant and natural, studio lighting",
    preview: "linear-gradient(135deg, #2d4a3e 0%, #3a5a4e 30%, #2a4238 55%, #3d5d50 80%, #2d4a3e 100%)",
    category: "שיש",
  },
  {
    id: "beige-marble",
    label: "שיש בז׳",
    prompt: "Warm beige Crema Marfil marble surface with soft cream veins, elegant, studio lighting, high resolution",
    preview: "linear-gradient(135deg, #f0e6d3 0%, #e5d8c3 30%, #efe4d0 55%, #e2d5bf 80%, #f0e6d3 100%)",
    category: "שיש",
  },
  {
    id: "pink-marble",
    label: "שיש ורוד",
    prompt: "Pink Rosa Portugal marble surface with subtle white veins, soft and elegant, studio lighting",
    preview: "linear-gradient(135deg, #f0d5d0 0%, #e8c5bf 30%, #efd3cd 55%, #e5c0ba 80%, #f0d5d0 100%)",
    category: "שיש",
  },

  // עץ / Wood
  {
    id: "light-oak",
    label: "אלון בהיר",
    prompt: "Light natural oak wood surface, warm honey tones, visible soft grain, professional product photography, studio lighting",
    preview: "linear-gradient(135deg, #d4a574 0%, #c4956a 50%, #dbb58e 100%)",
    category: "עץ",
  },
  {
    id: "walnut",
    label: "אגוז כהה",
    prompt: "Dark walnut wood surface, rich brown tones, elegant grain pattern, professional studio lighting",
    preview: "linear-gradient(135deg, #5c3a21 0%, #4a2e18 50%, #6b4429 100%)",
    category: "עץ",
  },
  {
    id: "birch",
    label: "ליבנה בהירה",
    prompt: "Light birch wood surface, pale creamy white with subtle grain, Scandinavian style, studio lighting",
    preview: "linear-gradient(135deg, #e8ddd0 0%, #ddd0c0 50%, #ede2d5 100%)",
    category: "עץ",
  },
  {
    id: "rustic-wood",
    label: "עץ כפרי",
    prompt: "Rustic reclaimed wood surface, weathered texture with character, warm tones, studio lighting",
    preview: "linear-gradient(135deg, #8b7355 0%, #7a6348 50%, #9a8262 100%)",
    category: "עץ",
  },

  // רקע חלק / Solid
  {
    id: "pure-white",
    label: "לבן נקי",
    prompt: "Pure seamless white background, clean professional product photography, perfectly even studio lighting",
    preview: "#ffffff",
    category: "חלק",
  },
  {
    id: "light-gray",
    label: "אפור בהיר",
    prompt: "Light gray seamless background, professional product photography, soft even studio lighting",
    preview: "#e5e5e5",
    category: "חלק",
  },
  {
    id: "cream",
    label: "קרם",
    prompt: "Warm cream off-white seamless background, soft and inviting, professional studio lighting",
    preview: "#f5f0e8",
    category: "חלק",
  },
  {
    id: "black",
    label: "שחור",
    prompt: "Pure black seamless background, dramatic professional product photography, controlled studio lighting",
    preview: "#111111",
    category: "חלק",
  },
  {
    id: "navy",
    label: "כחול כהה",
    prompt: "Deep navy blue seamless background, elegant and luxurious, professional studio lighting",
    preview: "#1a2744",
    category: "חלק",
  },

  // טקסטורות / Textures
  {
    id: "concrete",
    label: "בטון",
    prompt: "Light gray smooth concrete surface, modern industrial minimalist, subtle texture, studio lighting",
    preview: "linear-gradient(135deg, #b0b0b0 0%, #a0a0a0 50%, #b8b8b8 100%)",
    category: "טקסטורה",
  },
  {
    id: "linen",
    label: "פשתן",
    prompt: "Natural linen fabric texture background, soft warm beige, organic and elegant, studio lighting",
    preview: "linear-gradient(135deg, #e8ddd0 0%, #d8cfc2 50%, #ece3d6 100%)",
    category: "טקסטורה",
  },
  {
    id: "velvet",
    label: "קטיפה כהה",
    prompt: "Dark charcoal velvet fabric background, luxurious soft texture, dramatic studio lighting",
    preview: "linear-gradient(135deg, #2a2a2e 0%, #222226 50%, #2e2e32 100%)",
    category: "טקסטורה",
  },
  {
    id: "terrazzo",
    label: "טרצו",
    prompt: "White terrazzo surface with colorful stone chips, modern and playful, studio lighting, high resolution",
    preview: "linear-gradient(135deg, #f2efea 0%, #ede9e3 50%, #f4f1ec 100%)",
    category: "טקסטורה",
  },
  {
    id: "sand",
    label: "חול",
    prompt: "Fine sand texture background, warm golden tones, natural and organic, soft studio lighting",
    preview: "linear-gradient(135deg, #d4bc8a 0%, #c8b080 50%, #dac492 100%)",
    category: "טקסטורה",
  },

  // טבע / Nature
  {
    id: "greenery",
    label: "ירוק טבעי",
    prompt: "Lush green foliage background, soft bokeh, natural daylight, product photography",
    preview: "linear-gradient(135deg, #4a7c59 0%, #3d6b4c 50%, #5a8c69 100%)",
    category: "טבע",
  },
  {
    id: "sunset",
    label: "שקיעה",
    prompt: "Warm sunset gradient background, soft golden hour light, dreamy bokeh, product photography",
    preview: "linear-gradient(135deg, #f5a060 0%, #e8805a 50%, #fbb878 100%)",
    category: "טבע",
  },
  {
    id: "ocean",
    label: "אוקיינוס",
    prompt: "Calm turquoise ocean water background, soft light, serene and peaceful, product photography",
    preview: "linear-gradient(135deg, #4fa8b8 0%, #3d96a8 50%, #5dbac8 100%)",
    category: "טבע",
  },
];

const categories = ["שיש", "עץ", "חלק", "טקסטורה", "טבע"];

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
    <div className="space-y-5">
      <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">
        בחר רקע
      </h3>

      {/* Reference image */}
      <div className="rounded-lg overflow-hidden border border-border">
        <img src={marbleRef} alt="דוגמת שיש" className="w-full h-20 object-cover" />
        <div className="px-2 py-1.5 bg-secondary text-center">
          <span className="font-body text-xs text-muted-foreground">דוגמת שיש — גידים אפורים בהירים</span>
        </div>
      </div>

      {categories.map((cat) => {
        const catPresets = presets.filter((p) => p.category === cat);
        return (
          <div key={cat} className="space-y-2">
            <h4 className="font-display text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {cat}
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {catPresets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => onSelect(preset)}
                  className={`group relative flex flex-col items-center gap-1.5 rounded-lg border-2 p-2 transition-all ${
                    selectedId === preset.id
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border hover:border-primary/50 hover:shadow-sm"
                  }`}
                >
                  <div
                    className="h-10 w-full rounded-md border border-border/50"
                    style={{ background: preset.preview }}
                  />
                  <span className="font-body text-[10px] leading-tight font-medium text-foreground text-center">
                    {preset.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <div className="space-y-2 pt-2 border-t border-border">
        <label className="font-display text-xs font-semibold text-muted-foreground uppercase tracking-wider">
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
