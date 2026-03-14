import { useState, useCallback } from "react";

import { Upload, ImagePlus, X, Palette, ScanSearch, Loader2, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ColorInfo {
  hex: string;
  name: string;
  percentage: number;
}
interface AnalysisResult {
  colors: ColorInfo[];
  elements: string[];
  style: string;
  suggestedBackgrounds: { hex: string; name: string; reason: string }[];
}

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

  // בד וריקמה / Fabric & Embroidery
  {
    id: "white-cotton",
    label: "כותנה לבנה",
    professionalName: "Pure Cotton",
    prompt: "Clean white cotton fabric texture background, soft weave visible, natural and organic, studio lighting",
    preview: "linear-gradient(135deg, #faf9f7 0%, #f0eee9 50%, #fbfaf8 100%)",
    category: "בד וריקמה",
  },
  {
    id: "burlap",
    label: "יוטה / שק",
    professionalName: "Natural Burlap",
    prompt: "Natural burlap jute fabric texture background, coarse rustic weave, warm earthy tones, studio lighting",
    preview: "linear-gradient(135deg, #c4a87c 0%, #b89a6e 50%, #cdb488 100%)",
    category: "בד וריקמה",
  },
  {
    id: "canvas",
    label: "קנבס",
    professionalName: "Artist Canvas",
    prompt: "White artist canvas fabric texture background, visible weave pattern, clean and artistic, studio lighting",
    preview: "linear-gradient(135deg, #f2efe8 0%, #e8e4dc 50%, #f5f2eb 100%)",
    category: "בד וריקמה",
  },
  {
    id: "denim",
    label: "ג׳ינס",
    professionalName: "Indigo Denim",
    prompt: "Blue denim fabric texture background, classic indigo jean material, visible diagonal weave, studio lighting",
    preview: "linear-gradient(135deg, #4a6a8a 0%, #3d5a78 50%, #527294 100%)",
    category: "בד וריקמה",
  },
  {
    id: "muslin",
    label: "מוסלין",
    professionalName: "Soft Muslin",
    prompt: "Soft muslin gauze fabric texture background, light and airy, slightly transparent weave, warm white, studio lighting",
    preview: "linear-gradient(135deg, #f8f4ee 0%, #f0ebe2 50%, #faf6f0 100%)",
    category: "בד וריקמה",
  },
  {
    id: "tweed",
    label: "טוויד",
    professionalName: "Harris Tweed",
    prompt: "Classic tweed fabric texture background, herringbone pattern, warm brown and gray tones, British elegance, studio lighting",
    preview: "linear-gradient(135deg, #8a7d6a 0%, #7a6d5a 50%, #948772 100%)",
    category: "בד וריקמה",
  },
  {
    id: "embroidery-white",
    label: "ריקמה לבנה",
    professionalName: "White Embroidery",
    prompt: "White embroidered fabric background with delicate floral embroidery patterns, elegant lacework, textured needlework, studio lighting",
    preview: "linear-gradient(135deg, #fdfcfa 0%, #f0ede8 30%, #faf8f5 60%, #edeae4 100%)",
    category: "בד וריקמה",
  },
  {
    id: "embroidery-floral",
    label: "ריקמה פרחונית",
    professionalName: "Floral Needlework",
    prompt: "Vintage floral embroidery on linen fabric background, colorful thread flowers and leaves, folk art style, handcraft aesthetic, studio lighting",
    preview: "linear-gradient(135deg, #e8ddd0 0%, #d8cfc0 30%, #e5d8c8 60%, #d0c5b5 100%)",
    category: "בד וריקמה",
  },
  {
    id: "cross-stitch",
    label: "תפר צלב",
    professionalName: "Cross Stitch",
    prompt: "Cross stitch embroidery pattern on Aida cloth background, visible grid weave, traditional needlecraft texture, studio lighting",
    preview: "linear-gradient(135deg, #f0e8d8 0%, #e5dcc8 50%, #f2eadc 100%)",
    category: "בד וריקמה",
  },
  {
    id: "knit",
    label: "סריגה",
    professionalName: "Knit Texture",
    prompt: "Knitted fabric texture background, soft wool knit pattern, cozy and warm, cream white color, studio lighting",
    preview: "linear-gradient(135deg, #f0ebe0 0%, #e8e0d2 50%, #f2ede2 100%)",
    category: "בד וריקמה",
  },
  {
    id: "crochet",
    label: "סרוגה",
    professionalName: "Crochet Lace",
    prompt: "Crochet lace doily pattern on fabric background, intricate handmade lacework, vintage charm, white and cream, studio lighting",
    preview: "linear-gradient(135deg, #faf8f4 0%, #ede8e0 50%, #fcfaf6 100%)",
    category: "בד וריקמה",
  },
  {
    id: "damask",
    label: "דמשק",
    professionalName: "Royal Damask",
    prompt: "Damask fabric background with ornate woven pattern, luxurious jacquard weave, cream and gold tones, regal elegance, studio lighting",
    preview: "linear-gradient(135deg, #e8dcc8 0%, #d8ccb4 30%, #ece0cc 60%, #d5c8b0 100%)",
    category: "בד וריקמה",
  },
  {
    id: "tulle",
    label: "טול",
    professionalName: "French Tulle",
    prompt: "Delicate tulle mesh fabric background, sheer and ethereal, soft white netting, bridal elegance, studio lighting",
    preview: "linear-gradient(135deg, #fdfcfb 0%, #f2eeea 50%, #fefdfb 100%)",
    category: "בד וריקמה",
  },
  {
    id: "felt",
    label: "לבד",
    professionalName: "Wool Felt",
    prompt: "Thick wool felt fabric background, soft matte texture, warm gray color, handcraft aesthetic, studio lighting",
    preview: "linear-gradient(135deg, #b5b0a8 0%, #a8a298 50%, #bab5ad 100%)",
    category: "בד וריקמה",
  },
  {
    id: "brocade",
    label: "ברוקד",
    professionalName: "Gold Brocade",
    prompt: "Rich brocade fabric background with gold thread patterns on dark base, luxurious embossed textile, ornate and regal, studio lighting",
    preview: "linear-gradient(135deg, #3a2a18 0%, #c8a868 30%, #4a3a28 60%, #d0b070 100%)",
    category: "בד וריקמה",
  },
];

const categories = ["שיש", "עץ", "חלק", "צבע בלבד", "טקסטורה", "בד וריקמה", "טבע", "גרדיינט", "לפי תמונה"];

const colorOnlySwatches = [
  { hex: "#FFFFFF", label: "לבן", name: "Pure White" },
  { hex: "#F5F5F5", label: "לבן שבור", name: "Off White" },
  { hex: "#F5F0E8", label: "קרם", name: "Cream" },
  { hex: "#E8DDD0", label: "בז׳", name: "Beige" },
  { hex: "#D4BC8A", label: "חול", name: "Sand" },
  { hex: "#F5D5D0", label: "ורוד בהיר", name: "Light Pink" },
  { hex: "#FFB6C1", label: "ורוד", name: "Pink" },
  { hex: "#E8B0B8", label: "רוזה", name: "Rose" },
  { hex: "#FF6B6B", label: "אדום", name: "Red" },
  { hex: "#FF8C42", label: "כתום", name: "Orange" },
  { hex: "#FFD93D", label: "צהוב", name: "Yellow" },
  { hex: "#B2C5A8", label: "ירוק מרווה", name: "Sage Green" },
  { hex: "#4A7C59", label: "ירוק", name: "Green" },
  { hex: "#2D4A3E", label: "ירוק כהה", name: "Dark Green" },
  { hex: "#A8D4F0", label: "תכלת", name: "Light Blue" },
  { hex: "#4A6A8A", label: "כחול", name: "Blue" },
  { hex: "#1A2744", label: "כחול כהה", name: "Navy" },
  { hex: "#C8B4E8", label: "לילך", name: "Lilac" },
  { hex: "#7B5EA7", label: "סגול", name: "Purple" },
  { hex: "#E5E5E5", label: "אפור בהיר", name: "Light Gray" },
  { hex: "#999999", label: "אפור", name: "Gray" },
  { hex: "#555555", label: "אפור כהה", name: "Dark Gray" },
  { hex: "#111111", label: "שחור", name: "Black" },
  { hex: "#C8A868", label: "זהב", name: "Gold" },
  { hex: "#C0C0C0", label: "כסף", name: "Silver" },
  { hex: "#B87333", label: "נחושת", name: "Copper" },
];

interface BackgroundPresetsProps {
  selectedId: string | null;
  onSelect: (preset: Preset) => void;
  customPrompt: string;
  onCustomPromptChange: (value: string) => void;
  referenceImages: string[];
  onReferenceImagesChange: (images: string[]) => void;
  multiSelectMode?: boolean;
  selectedPresets?: string[];
  onTogglePreset?: (preset: Preset) => void;
}

const categoryIcons: Record<string, string> = {
  "שיש": "◆",
  "עץ": "🪵",
  "חלק": "○",
  "צבע בלבד": "🎨",
  "טקסטורה": "▤",
  "בד וריקמה": "🧵",
  "טבע": "🌿",
  "גרדיינט": "◐",
};

const BackgroundPresets = ({
  selectedId,
  onSelect,
  customPrompt,
  onCustomPromptChange,
  referenceImages,
  onReferenceImagesChange,
  multiSelectMode = false,
  selectedPresets = [],
  onTogglePreset,
}: BackgroundPresetsProps) => {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [customColor, setCustomColor] = useState("#FFFFFF");
  const [selectedColorId, setSelectedColorId] = useState<string | null>(null);
  const [previewPreset, setPreviewPreset] = useState<Preset | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const handleAnalyzeImage = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      setAnalyzing(true);
      try {
        const { data, error } = await supabase.functions.invoke("analyze-image", {
          body: { imageBase64: base64 },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setAnalysisResult(data as AnalysisResult);
        toast.success("ניתוח הושלם!");
      } catch (err: any) {
        toast.error(err.message || "שגיאה בניתוח התמונה");
      } finally {
        setAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const handleColorSelect = useCallback((hex: string, label: string, name: string) => {
    setSelectedColorId(hex);
    const colorPreset: Preset = {
      id: `color-${hex}`,
      label: `צבע ${label}`,
      professionalName: `${name} Background`,
      prompt: `Change ONLY the background color to a solid flat ${name} color (${hex}). Keep the product, object, design, pattern, embroidery, and all other elements EXACTLY the same — same position, same lighting, same details. Only replace the background area with a smooth, even, solid ${hex} color. Do not alter the product in any way.`,
      preview: hex,
      category: "צבע בלבד",
    };
    onSelect(colorPreset);
  }, [onSelect]);

  const handleCustomColorSelect = useCallback(() => {
    const preset: Preset = {
      id: `color-custom-${customColor}`,
      label: `צבע מותאם`,
      professionalName: `Custom ${customColor} Background`,
      prompt: `Change ONLY the background color to a solid flat color ${customColor}. Keep the product, object, design, pattern, embroidery, and all other elements EXACTLY the same — same position, same lighting, same details. Only replace the background area with a smooth, even, solid ${customColor} color. Do not alter the product in any way.`,
      preview: customColor,
      category: "צבע בלבד",
    };
    onSelect(preset);
    setSelectedColorId(customColor);
  }, [customColor, onSelect]);

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

  const activeCatPresets = activeCategory
    ? presets.filter((p) => p.category === activeCategory)
    : [];

  return (
    <div className="space-y-4">
      <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">
        בחר רקע
      </h3>

      {/* Category grid */}
      {!activeCategory ? (
        <div className="grid grid-cols-2 gap-2">
          {categories.map((cat) => {
            const count = cat === "צבע בלבד" ? colorOnlySwatches.length : presets.filter((p) => p.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="flex flex-col items-center gap-2 rounded-xl border-2 border-border p-4 transition-all hover:border-gold/40 hover:shadow-md hover:bg-secondary/30"
              >
                <span className="text-2xl">{categoryIcons[cat] || "◎"}</span>
                <span className="font-display text-xs font-bold text-foreground">{cat}</span>
                <span className="font-body text-[10px] text-muted-foreground">{count} רקעים</span>
              </button>
            );
          })}
        </div>
      ) : (
        <>
          {/* Back button */}
          <button
            onClick={() => setActiveCategory(null)}
            className="flex items-center gap-2 font-display text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            <span>→</span>
            חזרה לקטגוריות
          </button>

          <h4 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
            <span>{categoryIcons[activeCategory]}</span>
            {activeCategory}
          </h4>

          {activeCategory === "צבע בלבד" ? (
            <div className="space-y-4">
              <p className="font-body text-xs text-muted-foreground">
                שנה רק את צבע הרקע — העיצוב, המוצר והפרטים נשארים זהים
              </p>
              <div className="grid grid-cols-4 gap-2">
                {colorOnlySwatches.map((swatch) => (
                  <button
                    key={swatch.hex}
                    onClick={() => handleColorSelect(swatch.hex, swatch.label, swatch.name)}
                    className={`group flex flex-col items-center gap-1.5 rounded-lg border-2 p-2 transition-all ${
                      selectedColorId === swatch.hex
                        ? "border-primary shadow-md"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div
                      className="h-12 w-full rounded-md border border-border/50"
                      style={{ backgroundColor: swatch.hex }}
                    />
                    <span className="font-body text-[10px] text-foreground leading-tight text-center">
                      {swatch.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Custom color picker */}
              <div className="flex items-center gap-3 pt-2 border-t border-border">
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-muted-foreground" />
                  <span className="font-body text-xs text-muted-foreground">צבע מותאם:</span>
                </div>
                <input
                  type="color"
                  value={customColor}
                  onChange={(e) => setCustomColor(e.target.value)}
                  className="h-8 w-10 rounded border border-border cursor-pointer"
                />
                <span className="font-body text-[10px] text-muted-foreground">{customColor}</span>
                <button
                  onClick={handleCustomColorSelect}
                  className="rounded-lg bg-primary px-3 py-1.5 font-display text-[10px] font-bold text-primary-foreground hover:brightness-110 transition-all"
                >
                  בחר
                </button>
              </div>

              {/* Describe your own style */}
              <div className="space-y-2 pt-3 border-t border-border">
                <label className="font-display text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  ✏️ תאר את הצבע / הסגנון שאתה רוצה
                </label>
                <textarea
                  value={customPrompt}
                  onChange={(e) => onCustomPromptChange(e.target.value)}
                  placeholder="לדוגמה: רקע בגוון פסטל ורוד עם טקסטורת שיש, גרדיינט מזהב לבז׳, צבע חום חמים עם מרקם עור..."
                  className="w-full rounded-lg border border-input bg-card p-2.5 font-body text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  rows={2}
                  dir="rtl"
                />
              </div>

              {/* Upload reference image for color matching */}
              <div className="space-y-2 pt-3 border-t border-border">
                <label className="font-display text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  📷 העלה תמונה להמחשה
                </label>
                <p className="font-body text-[10px] text-muted-foreground">
                  העלה תמונה עם הצבעים או הסגנון שאתה רוצה — המערכת תתאים את הרקע בהתאם
                </p>

                {referenceImages.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {referenceImages.map((img, i) => (
                      <div key={i} className="relative group">
                        <img
                          src={img}
                          alt={`דוגמה ${i + 1}`}
                          className="h-14 w-14 rounded-md object-cover border border-border"
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

                <label className="flex items-center gap-2 rounded-lg border border-dashed border-border p-2.5 cursor-pointer hover:border-primary/50 hover:bg-secondary/30 transition-colors">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <span className="font-body text-xs text-muted-foreground">
                    העלה תמונה לדוגמה
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

              {/* Image Analyzer */}
              <div className="space-y-2 pt-3 border-t border-border">
                <label className="font-display text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <ScanSearch className="h-3.5 w-3.5" />
                  זיהוי צבעים ואלמנטים מתמונה
                </label>
                <p className="font-body text-[10px] text-muted-foreground">
                  העלה תמונה מוכנה — המערכת תזהה צבעים, אלמנטים וסגנון ותציע רקעים מתאימים
                </p>

                <label className={`flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/30 p-3 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors ${analyzing ? 'opacity-60 pointer-events-none' : ''}`}>
                  {analyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 text-primary animate-spin" />
                      <span className="font-body text-xs text-primary">מנתח תמונה...</span>
                    </>
                  ) : (
                    <>
                      <ScanSearch className="h-4 w-4 text-primary" />
                      <span className="font-body text-xs text-primary font-semibold">העלה תמונה לניתוח</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAnalyzeImage}
                    className="hidden"
                    disabled={analyzing}
                  />
                </label>

                {analysisResult && (
                  <div className="space-y-3 rounded-lg border border-border bg-secondary/20 p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-display text-xs font-bold text-foreground">תוצאות ניתוח</span>
                      <button onClick={() => setAnalysisResult(null)} className="text-muted-foreground hover:text-destructive">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Detected colors */}
                    {analysisResult.colors.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="font-body text-[10px] text-muted-foreground font-semibold">צבעים שזוהו:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {analysisResult.colors.map((c, i) => (
                            <button
                              key={i}
                              onClick={() => handleColorSelect(c.hex, c.name, c.name)}
                              className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 hover:border-primary transition-colors"
                              title={`${c.name} (${c.percentage}%)`}
                            >
                              <div className="h-3 w-3 rounded-full border border-border/50" style={{ backgroundColor: c.hex }} />
                              <span className="font-body text-[9px] text-foreground">{c.name}</span>
                              <span className="font-body text-[8px] text-muted-foreground">{c.percentage}%</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Elements */}
                    {analysisResult.elements.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="font-body text-[10px] text-muted-foreground font-semibold">אלמנטים שזוהו:</span>
                        <div className="flex flex-wrap gap-1">
                          {analysisResult.elements.map((el, i) => (
                            <span key={i} className="rounded-full bg-accent/50 px-2 py-0.5 font-body text-[9px] text-accent-foreground">
                              {el}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Style */}
                    {analysisResult.style && (
                      <div className="space-y-1">
                        <span className="font-body text-[10px] text-muted-foreground font-semibold">סגנון:</span>
                        <p className="font-body text-[10px] text-foreground">{analysisResult.style}</p>
                      </div>
                    )}

                    {/* Suggested backgrounds */}
                    {analysisResult.suggestedBackgrounds.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="font-body text-[10px] text-muted-foreground font-semibold">רקעים מומלצים:</span>
                        <div className="grid grid-cols-2 gap-1.5">
                          {analysisResult.suggestedBackgrounds.map((bg, i) => (
                            <button
                              key={i}
                              onClick={() => handleColorSelect(bg.hex, bg.name, bg.name)}
                              className="flex items-center gap-2 rounded-lg border border-border p-2 hover:border-primary transition-colors text-right"
                            >
                              <div className="h-6 w-6 rounded-md border border-border/50 shrink-0" style={{ backgroundColor: bg.hex }} />
                              <div className="min-w-0">
                                <span className="block font-body text-[9px] font-bold text-foreground truncate">{bg.name}</span>
                                <span className="block font-body text-[8px] text-muted-foreground truncate">{bg.reason}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {activeCatPresets.map((preset) => {
                const isSelected = multiSelectMode
                  ? selectedPresets.includes(preset.id)
                  : selectedId === preset.id;
                return (
                  <div key={preset.id} className="relative">
                    <button
                      onClick={() => multiSelectMode && onTogglePreset ? onTogglePreset(preset) : onSelect(preset)}
                      className={`group relative flex flex-col items-center gap-1 rounded-lg border-2 p-2 transition-all w-full ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-md"
                          : "border-border hover:border-primary/50 hover:shadow-sm"
                      }`}
                    >
                      {multiSelectMode && isSelected && (
                        <div className="absolute top-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground font-accent text-[10px] font-bold z-10">
                          {selectedPresets.indexOf(preset.id) + 1}
                        </div>
                      )}
                      <div
                        className="h-14 w-full rounded-md border border-border/50"
                        style={{ background: preset.preview }}
                      />
                      <span className="font-body text-[10px] leading-tight font-medium text-foreground text-center">
                        {preset.label}
                      </span>
                      <span className="font-body text-[9px] text-muted-foreground italic">
                        {preset.professionalName}
                      </span>
                    </button>
                    <button
                      onClick={() => setPreviewPreset(preset)}
                      className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-background/80 border border-border shadow-sm opacity-0 group-hover:opacity-100 hover:!opacity-100 transition-opacity z-10 hover:bg-primary/10"
                      title="תצוגה מקדימה"
                    >
                      <Eye className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Custom background section - only show when NOT in color-only category */}
      {activeCategory && activeCategory !== "צבע בלבד" && (
        <div className="space-y-3 pt-3 border-t border-border">
          <label className="font-display text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            רקע מותאם אישית
          </label>

          <textarea
            value={customPrompt}
            onChange={(e) => onCustomPromptChange(e.target.value)}
            placeholder="תאר את הרקע שאתה רוצה, לדוגמה: שיש ורוד עם גידים זהובים, עץ טיק כהה..."
            className="w-full rounded-lg border border-input bg-card p-3 font-body text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            rows={2}
            dir="rtl"
          />

          <div className="space-y-2">
            <span className="font-body text-xs text-muted-foreground">
              העלה תמונות להמחשה (אופציונלי)
            </span>

            {referenceImages.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {referenceImages.map((img, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={img}
                      alt={`דוגמה ${i + 1}`}
                      className="h-14 w-14 rounded-md object-cover border border-border"
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

            <label className="flex items-center gap-2 rounded-lg border border-dashed border-border p-2.5 cursor-pointer hover:border-primary/50 hover:bg-secondary/30 transition-colors">
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
      )}

      {/* Preview Modal */}
      {previewPreset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setPreviewPreset(null)}
        >
          <div
            className="relative w-[85vw] max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="w-full h-64 sm:h-80"
              style={{ background: previewPreset.preview }}
            />
            <div className="p-4 text-center space-y-1">
              <h3 className="font-display text-base font-bold text-foreground">{previewPreset.label}</h3>
              <p className="font-body text-sm text-muted-foreground italic">{previewPreset.professionalName}</p>
              <div className="flex gap-2 pt-3 justify-center">
                <button
                  onClick={() => {
                    multiSelectMode && onTogglePreset ? onTogglePreset(previewPreset) : onSelect(previewPreset);
                    setPreviewPreset(null);
                  }}
                  className="rounded-lg bg-gold px-5 py-2 font-display text-sm font-semibold text-gold-foreground hover:brightness-110 transition-all"
                >
                  בחר רקע זה
                </button>
                <button
                  onClick={() => setPreviewPreset(null)}
                  className="rounded-lg border border-border px-4 py-2 font-body text-sm text-muted-foreground hover:bg-secondary transition-colors"
                >
                  סגור
                </button>
              </div>
            </div>
            <button
              onClick={() => setPreviewPreset(null)}
              className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 border border-border shadow hover:bg-destructive/10 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export { presets };
export type { Preset };
export default BackgroundPresets;
