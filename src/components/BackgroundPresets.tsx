import { useState, useCallback } from "react";

import { Upload, ImagePlus, X, Palette, ScanSearch, Loader2, Eye } from "lucide-react";
import EditableLabel from "@/components/EditableLabel";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { presets, categories, colorOnlySwatches, categoryIcons, fidelityLevels, type Preset } from "@/data/presets";

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
  const [selectedFidelity, setSelectedFidelity] = useState("medium");
  const [searchQuery, setSearchQuery] = useState("");
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("bg-favorites") || "[]"); } catch { return []; }
  });
  const [recentlyUsed, setRecentlyUsed] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("bg-recent") || "[]"); } catch { return []; }
  });

  const toggleFavorite = useCallback((presetId: string) => {
    setFavorites(prev => {
      const next = prev.includes(presetId) ? prev.filter(id => id !== presetId) : [...prev, presetId];
      localStorage.setItem("bg-favorites", JSON.stringify(next));
      return next;
    });
  }, []);

  const addToRecent = useCallback((presetId: string) => {
    setRecentlyUsed(prev => {
      const next = [presetId, ...prev.filter(id => id !== presetId)].slice(0, 10);
      localStorage.setItem("bg-recent", JSON.stringify(next));
      return next;
    });
  }, []);

  const handleSelectWithRecent = useCallback((preset: Preset) => {
    addToRecent(preset.id);
    onSelect(preset);
  }, [addToRecent, onSelect]);

  // Search filter
  const searchResults = searchQuery.trim()
    ? presets.filter(p =>
        p.label.includes(searchQuery) ||
        p.professionalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.includes(searchQuery)
      )
    : [];

  const favoritePresets = presets.filter(p => favorites.includes(p.id));
  const recentPresets = recentlyUsed.map(id => presets.find(p => p.id === id)).filter(Boolean) as Preset[];

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
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "שגיאה בניתוח התמונה");
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

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="חפש רקע..."
          className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-8 font-body text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">🔍</span>
      </div>

      {/* Search results */}
      {searchQuery.trim() && searchResults.length > 0 && (
        <div className="space-y-2">
          <span className="font-accent text-[10px] text-muted-foreground">
            {searchResults.length} תוצאות ל-"{searchQuery}"
          </span>
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {searchResults.slice(0, 12).map((preset) => (
              <button
                key={preset.id}
                onClick={() => handleSelectWithRecent(preset)}
                className={`relative rounded-lg border-2 p-2 text-center transition-all ${
                  selectedId === preset.id ? "border-gold bg-gold/10" : "border-border hover:border-gold/40"
                }`}
              >
                <div className="text-xs font-display font-semibold text-foreground truncate">{preset.label}</div>
                <div className="text-[10px] text-muted-foreground truncate">{preset.professionalName}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Favorites */}
      {!searchQuery.trim() && favoritePresets.length > 0 && !activeCategory && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">⭐</span>
            <span className="font-display text-xs font-bold text-foreground">מועדפים</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {favoritePresets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handleSelectWithRecent(preset)}
                className={`shrink-0 rounded-lg border-2 px-3 py-1.5 transition-all ${
                  selectedId === preset.id ? "border-gold bg-gold/10" : "border-border hover:border-gold/40"
                }`}
              >
                <span className="font-display text-[10px] font-semibold text-foreground whitespace-nowrap">{preset.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recently Used */}
      {!searchQuery.trim() && recentPresets.length > 0 && !activeCategory && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">🕐</span>
            <span className="font-display text-xs font-bold text-foreground">אחרונים</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recentPresets.slice(0, 6).map((preset) => (
              <button
                key={preset.id}
                onClick={() => handleSelectWithRecent(preset)}
                className={`shrink-0 rounded-lg border-2 px-3 py-1.5 transition-all ${
                  selectedId === preset.id ? "border-gold bg-gold/10" : "border-border hover:border-gold/40"
                }`}
              >
                <span className="font-display text-[10px] font-semibold text-foreground whitespace-nowrap">{preset.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category grid */}
      {!activeCategory && !searchQuery.trim() ? (
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
          ) : activeCategory === "לפי תמונה" ? (
            <div className="space-y-4">
              <p className="font-body text-xs text-muted-foreground">
                העלה תמונת רקע לדוגמה ובחר כמה מדויק תרצה שהתוצאה תהיה
              </p>

              {/* Reference image upload */}
              <div className="space-y-2">
                <label className="font-display text-xs font-semibold text-foreground flex items-center gap-1.5">
                  🖼️ תמונת רקע לדוגמה
                </label>

                {referenceImages.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {referenceImages.map((img, i) => (
                      <div key={i} className="relative group">
                        <img
                          src={img}
                          alt={`דוגמה ${i + 1}`}
                          className="h-20 w-20 rounded-lg object-cover border-2 border-primary/30 shadow-sm"
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

                <label className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-primary/30 p-4 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
                  <Upload className="h-6 w-6 text-primary/60" />
                  <span className="font-body text-xs text-primary font-semibold">
                    {referenceImages.length > 0 ? "הוסף תמונה נוספת" : "העלה תמונת רקע"}
                  </span>
                  <span className="font-body text-[10px] text-muted-foreground">
                    שיש, עץ, בד, משטח — כל דוגמה שתרצה
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

              {/* Description */}
              <div className="space-y-2 pt-2 border-t border-border">
                <label className="font-display text-xs font-semibold text-foreground flex items-center gap-1.5">
                  ✏️ תיאור (אופציונלי)
                </label>
                <textarea
                  value={customPrompt}
                  onChange={(e) => onCustomPromptChange(e.target.value)}
                  placeholder="לדוגמה: שיש לבן עם גידים אפורים, עץ אלון בהיר, בטון חלק..."
                  className="w-full rounded-lg border border-input bg-card p-2.5 font-body text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  rows={2}
                  dir="rtl"
                />
              </div>

              {/* Fidelity levels */}
              <div className="space-y-2 pt-2 border-t border-border">
                <label className="font-display text-xs font-semibold text-foreground flex items-center gap-1.5">
                  🎯 רמת דיוק לתמונת הדוגמה
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {fidelityLevels.map((level) => (
                    <button
                      key={level.id}
                      onClick={() => {
                        setSelectedFidelity(level.id);
                        // Build a prompt combining fidelity + custom text
                        const fidelityPrompt = level.value;
                        const desc = customPrompt.trim();
                        const fullPrompt = desc
                          ? `${fidelityPrompt}\n\nAdditional description from user: ${desc}`
                          : fidelityPrompt;
                        const preset: Preset = {
                          id: `ref-${level.id}`,
                          label: `לפי תמונה — ${level.label}`,
                          professionalName: `Reference — ${level.label}`,
                          prompt: fullPrompt,
                          preview: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                          category: "לפי תמונה",
                        };
                        onSelect(preset);
                      }}
                      className={`flex items-start gap-3 rounded-xl border-2 p-3 text-right transition-all ${
                        selectedFidelity === level.id
                          ? "border-primary bg-primary/5 shadow-md"
                          : "border-border hover:border-primary/40 hover:bg-secondary/30"
                      }`}
                    >
                      <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                        selectedFidelity === level.id
                          ? "border-primary bg-primary"
                          : "border-muted-foreground/40"
                      }`}>
                        {selectedFidelity === level.id && (
                          <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="block font-display text-xs font-bold text-foreground">
                          {level.label}
                        </span>
                        <span className="block font-body text-[10px] text-muted-foreground mt-0.5">
                          {level.description}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick apply button */}
              {referenceImages.length > 0 && (
                <div className="pt-2">
                  <button
                    onClick={() => {
                      const level = fidelityLevels.find(l => l.id === selectedFidelity)!;
                      const desc = customPrompt.trim();
                      const fullPrompt = desc
                        ? `${level.value}\n\nAdditional description from user: ${desc}`
                        : level.value;
                      const preset: Preset = {
                        id: `ref-${level.id}`,
                        label: `לפי תמונה — ${level.label}`,
                        professionalName: `Reference — ${level.label}`,
                        prompt: fullPrompt,
                        preview: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                        category: "לפי תמונה",
                      };
                      onSelect(preset);
                      toast.success(`נבחר מצב "${level.label}" — לחץ "החלף רקע" להחיל`);
                    }}
                    className="w-full rounded-xl bg-primary px-4 py-3 font-display text-sm font-bold text-primary-foreground hover:brightness-110 transition-all"
                  >
                    ✨ החל רקע לפי תמונה — {fidelityLevels.find(l => l.id === selectedFidelity)?.label}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {activeCatPresets.map((preset) => {
                const isSelected = multiSelectMode
                  ? selectedPresets.includes(preset.id)
                  : selectedId === preset.id;
                const isFav = favorites.includes(preset.id);
                return (
                  <div key={preset.id} className="relative group">
                    <button
                      onClick={() => multiSelectMode && onTogglePreset ? onTogglePreset(preset) : handleSelectWithRecent(preset)}
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
                      {preset.type === "scene" && (
                        <div className="absolute top-1 right-1 rounded-full bg-emerald-500/90 px-1.5 py-0.5 font-accent text-[8px] font-bold text-white z-10">
                          סצנה
                        </div>
                      )}
                      <div
                        className="h-14 w-full rounded-md border border-border/50"
                        style={{ background: preset.preview }}
                      />
                      <EditableLabel
                        hebrewName={preset.label}
                        englishName={preset.professionalName}
                        onSave={(he, en) => {
                          // Update preset names in-place (runtime only)
                          preset.label = he;
                          preset.professionalName = en;
                          // Re-select to update parent
                          if (selectedId === preset.id) onSelect({ ...preset, label: he, professionalName: en });
                        }}
                        size="sm"
                      />
                    </button>
                    <button
                      onClick={() => setPreviewPreset(preset)}
                      className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-background/80 border border-border shadow-sm opacity-0 group-hover:opacity-100 hover:!opacity-100 transition-opacity z-10 hover:bg-primary/10"
                      title="תצוגה מקדימה"
                    >
                      <Eye className="h-3 w-3 text-muted-foreground" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(preset.id); }}
                      className={`absolute bottom-2 left-1 flex h-6 w-6 items-center justify-center rounded-full border shadow-sm transition-all z-10 ${
                        isFav ? "bg-gold/20 border-gold/50 opacity-100" : "bg-background/80 border-border opacity-0 group-hover:opacity-100"
                      }`}
                      title={isFav ? "הסר ממועדפים" : "הוסף למועדפים"}
                    >
                      <span className="text-[10px]">{isFav ? "⭐" : "☆"}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Custom background section - only show when NOT in color-only or ref-image category */}
      {activeCategory && activeCategory !== "צבע בלבד" && activeCategory !== "לפי תמונה" && (
        <div className="space-y-3 pt-3 border-t border-border">
          <label className="font-display text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {["חגים", "לייפסטייל", "מקצועי"].includes(activeCategory) ? "תאר סצנה מותאמת אישית" : "רקע מותאם אישית"}
          </label>

          <textarea
            value={customPrompt}
            onChange={(e) => onCustomPromptChange(e.target.value)}
            placeholder={["חגים", "לייפסטייל", "מקצועי"].includes(activeCategory)
              ? "תאר את הסצנה שאתה רוצה, לדוגמה: שולחן חג מעוצב עם כלי חרסינה, פרחים לבנים, נרות דולקים ומפות פשתן..."
              : "תאר את הרקע שאתה רוצה, לדוגמה: שיש ורוד עם גידים זהובים, עץ טיק כהה..."
            }
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
              {/* Edit names in preview modal too */}
              <div className="flex gap-2 pt-3 justify-center">
                <button
                  onClick={() => {
                    if (multiSelectMode && onTogglePreset) { onTogglePreset(previewPreset); } else { onSelect(previewPreset); }
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
