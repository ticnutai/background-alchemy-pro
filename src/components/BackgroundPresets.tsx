import marbleRef from "@/assets/marble-reference.jpeg";
import { Upload, ImagePlus, X } from "lucide-react";
import { useCallback } from "react";

interface Preset {
  id: string;
  label: string;
  prompt: string;
  preview: string;
  category: string;
  professionalName: string;
}

const presets: Preset[] = [
  // שיש / Marble
  {
    id: "white-marble-gray",
    label: "שיש לבן — גידים אפורים בהירים",
    professionalName: "Calacatta Bianco",
    prompt: "Clean white Calacatta marble surface with subtle light gray veins, elegant luxury feel, soft studio lighting, high resolution product photography background",
    preview: "linear-gradient(135deg, #f7f6f4 0%, #eae8e4 25%, #f5f4f2 45%, #e8e6e2 65%, #f7f6f4 100%)",
    category: "שיש",
  },
  {
    id: "white-marble-gold",
    label: "שיש לבן — גידים זהובים",
    professionalName: "Calacatta Oro",
    prompt: "White marble surface with elegant golden veins, luxurious Calacatta gold marble, warm studio lighting, high resolution",
    preview: "linear-gradient(135deg, #faf8f5 0%, #e8d5b0 30%, #f9f7f3 55%, #dcc9a0 80%, #faf8f5 100%)",
    category: "שיש",
  },
  {
    id: "dark-marble",
    label: "שיש שחור — גידים זהובים",
    professionalName: "Nero Marquina Gold",
    prompt: "Dark black Nero Marquina marble with dramatic gold veins, luxurious, studio lighting, high resolution",
    preview: "linear-gradient(135deg, #1a1a1a 0%, #2a2520 30%, #111 55%, #2a2520 80%, #1a1a1a 100%)",
    category: "שיש",
  },
  {
    id: "green-marble",
    label: "שיש ירוק",
    professionalName: "Verde Guatemala",
    prompt: "Green Verde Guatemala marble surface with white veins, elegant and natural, studio lighting",
    preview: "linear-gradient(135deg, #2d4a3e 0%, #3a5a4e 30%, #2a4238 55%, #3d5d50 80%, #2d4a3e 100%)",
    category: "שיש",
  },
  {
    id: "beige-marble",
    label: "שיש בז׳",
    professionalName: "Crema Marfil",
    prompt: "Warm beige Crema Marfil marble surface with soft cream veins, elegant, studio lighting, high resolution",
    preview: "linear-gradient(135deg, #f0e6d3 0%, #e5d8c3 30%, #efe4d0 55%, #e2d5bf 80%, #f0e6d3 100%)",
    category: "שיש",
  },
  {
    id: "pink-marble",
    label: "שיש ורוד",
    professionalName: "Rosa Portogallo",
    prompt: "Pink Rosa Portugal marble surface with subtle white veins, soft and elegant, studio lighting",
    preview: "linear-gradient(135deg, #f0d5d0 0%, #e8c5bf 30%, #efd3cd 55%, #e5c0ba 80%, #f0d5d0 100%)",
    category: "שיש",
  },
  {
    id: "statuario",
    label: "סטטואריו",
    professionalName: "Statuario Venato",
    prompt: "White Statuario marble with bold dramatic gray veins, Italian luxury, studio lighting, high resolution",
    preview: "linear-gradient(135deg, #fafafa 0%, #d8d8d8 25%, #f5f5f5 50%, #c8c8c8 75%, #fafafa 100%)",
    category: "שיש",
  },
  {
    id: "emperador",
    label: "אמפרדור חום",
    professionalName: "Emperador Dark",
    prompt: "Dark brown Emperador marble surface with cream veins, rich and warm, studio lighting",
    preview: "linear-gradient(135deg, #4a3528 0%, #3d2a1e 30%, #503b2d 55%, #3d2a1e 80%, #4a3528 100%)",
    category: "שיש",
  },

  // עץ / Wood
  {
    id: "light-oak",
    label: "אלון בהיר",
    professionalName: "Natural White Oak",
    prompt: "Light natural oak wood surface, warm honey tones, visible soft grain, professional product photography, studio lighting",
    preview: "linear-gradient(135deg, #d4a574 0%, #c4956a 50%, #dbb58e 100%)",
    category: "עץ",
  },
  {
    id: "walnut",
    label: "אגוז כהה",
    professionalName: "American Black Walnut",
    prompt: "Dark walnut wood surface, rich brown tones, elegant grain pattern, professional studio lighting",
    preview: "linear-gradient(135deg, #5c3a21 0%, #4a2e18 50%, #6b4429 100%)",
    category: "עץ",
  },
  {
    id: "birch",
    label: "ליבנה בהירה",
    professionalName: "Scandinavian Birch",
    prompt: "Light birch wood surface, pale creamy white with subtle grain, Scandinavian style, studio lighting",
    preview: "linear-gradient(135deg, #e8ddd0 0%, #ddd0c0 50%, #ede2d5 100%)",
    category: "עץ",
  },
  {
    id: "rustic-wood",
    label: "עץ כפרי",
    professionalName: "Rustic Barnwood",
    prompt: "Rustic reclaimed wood surface, weathered texture with character, warm tones, studio lighting",
    preview: "linear-gradient(135deg, #8b7355 0%, #7a6348 50%, #9a8262 100%)",
    category: "עץ",
  },
  {
    id: "teak",
    label: "טיק",
    professionalName: "Indonesian Teak",
    prompt: "Rich teak wood surface, golden-brown warm tones, tight grain, luxurious, studio lighting",
    preview: "linear-gradient(135deg, #a0744a 0%, #8d6340 50%, #b08558 100%)",
    category: "עץ",
  },
  {
    id: "ebony",
    label: "אבוני",
    professionalName: "African Ebony",
    prompt: "Dark ebony wood surface, near-black with subtle grain visible, dramatic and luxurious, studio lighting",
    preview: "linear-gradient(135deg, #1e1e1e 0%, #2a2a2a 50%, #1a1a1a 100%)",
    category: "עץ",
  },

  // רקע חלק / Solid
  {
    id: "pure-white",
    label: "לבן נקי",
    professionalName: "Studio White",
    prompt: "Pure seamless white background, clean professional product photography, perfectly even studio lighting",
    preview: "#ffffff",
    category: "חלק",
  },
  {
    id: "light-gray",
    label: "אפור בהיר",
    professionalName: "Soft Gray",
    prompt: "Light gray seamless background, professional product photography, soft even studio lighting",
    preview: "#e5e5e5",
    category: "חלק",
  },
  {
    id: "cream",
    label: "קרם",
    professionalName: "Warm Cream",
    prompt: "Warm cream off-white seamless background, soft and inviting, professional studio lighting",
    preview: "#f5f0e8",
    category: "חלק",
  },
  {
    id: "black",
    label: "שחור",
    professionalName: "Studio Black",
    prompt: "Pure black seamless background, dramatic professional product photography, controlled studio lighting",
    preview: "#111111",
    category: "חלק",
  },
  {
    id: "navy",
    label: "כחול כהה",
    professionalName: "Midnight Navy",
    prompt: "Deep navy blue seamless background, elegant and luxurious, professional studio lighting",
    preview: "#1a2744",
    category: "חלק",
  },
  {
    id: "blush",
    label: "ורוד עדין",
    professionalName: "Blush Pink",
    prompt: "Soft blush pink seamless background, feminine and elegant, professional studio lighting",
    preview: "#f5d5d0",
    category: "חלק",
  },
  {
    id: "sage",
    label: "ירוק מרווה",
    professionalName: "Sage Green",
    prompt: "Muted sage green seamless background, natural and calming, professional studio lighting",
    preview: "#b2c5a8",
    category: "חלק",
  },

  // טקסטורות / Textures
  {
    id: "concrete",
    label: "בטון",
    professionalName: "Polished Concrete",
    prompt: "Light gray smooth concrete surface, modern industrial minimalist, subtle texture, studio lighting",
    preview: "linear-gradient(135deg, #b0b0b0 0%, #a0a0a0 50%, #b8b8b8 100%)",
    category: "טקסטורה",
  },
  {
    id: "linen",
    label: "פשתן",
    professionalName: "Belgian Linen",
    prompt: "Natural linen fabric texture background, soft warm beige, organic and elegant, studio lighting",
    preview: "linear-gradient(135deg, #e8ddd0 0%, #d8cfc2 50%, #ece3d6 100%)",
    category: "טקסטורה",
  },
  {
    id: "velvet",
    label: "קטיפה כהה",
    professionalName: "Charcoal Velvet",
    prompt: "Dark charcoal velvet fabric background, luxurious soft texture, dramatic studio lighting",
    preview: "linear-gradient(135deg, #2a2a2e 0%, #222226 50%, #2e2e32 100%)",
    category: "טקסטורה",
  },
  {
    id: "terrazzo",
    label: "טרצו",
    professionalName: "Venetian Terrazzo",
    prompt: "White terrazzo surface with colorful stone chips, modern and playful, studio lighting, high resolution",
    preview: "linear-gradient(135deg, #f2efea 0%, #ede9e3 50%, #f4f1ec 100%)",
    category: "טקסטורה",
  },
  {
    id: "sand",
    label: "חול",
    professionalName: "Desert Sand",
    prompt: "Fine sand texture background, warm golden tones, natural and organic, soft studio lighting",
    preview: "linear-gradient(135deg, #d4bc8a 0%, #c8b080 50%, #dac492 100%)",
    category: "טקסטורה",
  },
  {
    id: "leather",
    label: "עור",
    professionalName: "Italian Leather",
    prompt: "Rich brown Italian leather surface, subtle grain texture, luxurious and warm, studio lighting",
    preview: "linear-gradient(135deg, #8b5e3c 0%, #7a4f30 50%, #9a6d48 100%)",
    category: "טקסטורה",
  },
  {
    id: "silk",
    label: "משי",
    professionalName: "Champagne Silk",
    prompt: "Smooth champagne silk fabric background, subtle sheen, elegant folds, soft studio lighting",
    preview: "linear-gradient(135deg, #f0e8d8 0%, #e5dcc8 50%, #f5eddd 100%)",
    category: "טקסטורה",
  },
  {
    id: "paper",
    label: "נייר מרקם",
    professionalName: "Handmade Paper",
    prompt: "Textured handmade paper background, warm white with subtle fibers visible, artisanal feel, studio lighting",
    preview: "linear-gradient(135deg, #f5f2ec 0%, #ede9e0 50%, #f8f5ef 100%)",
    category: "טקסטורה",
  },

  // טבע / Nature
  {
    id: "greenery",
    label: "ירוק טבעי",
    professionalName: "Botanical Garden",
    prompt: "Lush green foliage background, soft bokeh, natural daylight, product photography",
    preview: "linear-gradient(135deg, #4a7c59 0%, #3d6b4c 50%, #5a8c69 100%)",
    category: "טבע",
  },
  {
    id: "sunset",
    label: "שקיעה",
    professionalName: "Golden Hour",
    prompt: "Warm sunset gradient background, soft golden hour light, dreamy bokeh, product photography",
    preview: "linear-gradient(135deg, #f5a060 0%, #e8805a 50%, #fbb878 100%)",
    category: "טבע",
  },
  {
    id: "ocean",
    label: "אוקיינוס",
    professionalName: "Ocean Mist",
    prompt: "Calm turquoise ocean water background, soft light, serene and peaceful, product photography",
    preview: "linear-gradient(135deg, #4fa8b8 0%, #3d96a8 50%, #5dbac8 100%)",
    category: "טבע",
  },
  {
    id: "flowers",
    label: "פרחים",
    professionalName: "Floral Bloom",
    prompt: "Soft blurred floral background with pink and white flowers, romantic bokeh, natural daylight, product photography",
    preview: "linear-gradient(135deg, #f5c8d0 0%, #e8b0b8 50%, #fbd5dd 100%)",
    category: "טבע",
  },
  {
    id: "dried-flowers",
    label: "פרחים מיובשים",
    professionalName: "Dried Botanicals",
    prompt: "Dried flowers and pampas grass background, soft neutral tones, boho style, warm studio lighting",
    preview: "linear-gradient(135deg, #d8c8b0 0%, #c8b8a0 50%, #e0d0b8 100%)",
    category: "טבע",
  },

  // גרדיינט / Gradient
  {
    id: "gradient-peach",
    label: "גרדיינט אפרסק",
    professionalName: "Peach Glow",
    prompt: "Smooth gradient background from soft peach to light pink, elegant and modern, studio lighting",
    preview: "linear-gradient(135deg, #fdd5b1 0%, #f8b4b4 100%)",
    category: "גרדיינט",
  },
  {
    id: "gradient-blue",
    label: "גרדיינט כחול",
    professionalName: "Azure Dream",
    prompt: "Smooth gradient background from light blue to soft lavender, calm and professional, studio lighting",
    preview: "linear-gradient(135deg, #a8d4f0 0%, #c8b4e8 100%)",
    category: "גרדיינט",
  },
  {
    id: "gradient-mint",
    label: "גרדיינט מנטה",
    professionalName: "Mint Fresh",
    prompt: "Smooth gradient background from mint green to soft cyan, fresh and clean, studio lighting",
    preview: "linear-gradient(135deg, #a8e6cf 0%, #88d8e0 100%)",
    category: "גרדיינט",
  },
];

const categories = ["שיש", "עץ", "חלק", "טקסטורה", "טבע", "גרדיינט"];

interface BackgroundPresetsProps {
  selectedId: string | null;
  onSelect: (preset: Preset) => void;
  customPrompt: string;
  onCustomPromptChange: (value: string) => void;
  referenceImages: string[];
  onReferenceImagesChange: (images: string[]) => void;
}

const BackgroundPresets = ({
  selectedId,
  onSelect,
  customPrompt,
  onCustomPromptChange,
  referenceImages,
  onReferenceImagesChange,
}: BackgroundPresetsProps) => {
  const handleRefImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
      Array.from(files).forEach((file) => {
        if (!file.type.startsWith("image/")) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          onReferenceImagesChange([...referenceImages, ev.target?.result as string]);
        };
        reader.readAsDataURL(file);
      });
      e.target.value = "";
    },
    [referenceImages, onReferenceImagesChange]
  );

  const removeRefImage = useCallback(
    (index: number) => {
      onReferenceImagesChange(referenceImages.filter((_, i) => i !== index));
    },
    [referenceImages, onReferenceImagesChange]
  );

  return (
    <div className="space-y-5">
      <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">
        בחר רקע
      </h3>

      {/* Reference image */}
      <div className="rounded-lg overflow-hidden border border-border">
        <img src={marbleRef} alt="דוגמת שיש" className="w-full h-20 object-cover" />
        <div className="px-2 py-1.5 bg-secondary text-center">
          <span className="font-body text-xs text-muted-foreground">דוגמת שיש — Calacatta Bianco</span>
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
                  className={`group relative flex flex-col items-center gap-1 rounded-lg border-2 p-2 transition-all ${
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
                  <span className="font-body text-[9px] text-muted-foreground italic">
                    {preset.professionalName}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {/* Custom background section */}
      <div className="space-y-3 pt-3 border-t border-border">
        <label className="font-display text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          רקע מותאם אישית
        </label>

        {/* Text description */}
        <textarea
          value={customPrompt}
          onChange={(e) => onCustomPromptChange(e.target.value)}
          placeholder="תאר את הרקע שאתה רוצה, לדוגמה: שיש ורוד עם גידים זהובים, עץ טיק כהה..."
          className="w-full rounded-lg border border-input bg-card p-3 font-body text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          rows={3}
          dir="rtl"
        />

        {/* Reference image upload */}
        <div className="space-y-2">
          <span className="font-body text-xs text-muted-foreground">
            העלה תמונות להמחשה (אופציונלי)
          </span>

          {/* Uploaded reference images */}
          {referenceImages.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {referenceImages.map((img, i) => (
                <div key={i} className="relative group">
                  <img
                    src={img}
                    alt={`דוגמה ${i + 1}`}
                    className="h-16 w-16 rounded-md object-cover border border-border"
                  />
                  <button
                    onClick={() => removeRefImage(i)}
                    className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <label className="flex items-center gap-2 rounded-lg border border-dashed border-border p-3 cursor-pointer hover:border-primary/50 hover:bg-secondary/30 transition-colors">
            <ImagePlus className="h-4 w-4 text-muted-foreground" />
            <span className="font-body text-xs text-muted-foreground">
              העלה תמונות רקע לדוגמה
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleRefImageUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </div>
  );
};

export { presets };
export type { Preset };
export default BackgroundPresets;
