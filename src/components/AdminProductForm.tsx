import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, X, ImagePlus, Edit2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

interface Product {
  id: string;
  title: string;
  description: string | null;
  category: string;
  image_url: string;
  price: number | null;
  is_featured: boolean;
}

type ProductCategory = Database["public"]["Enums"]["product_category"];
const categories: ProductCategory[] = ["פסח", "שבועות", "סוכות", "ראש השנה", "חנוכה", "פורים", "שבת", "מתנות", "אחר"];

const AdminProductForm = ({ onClose }: { onClose: () => void }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("אחר");
  const [price, setPrice] = useState("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });
    setProducts((data as Product[]) || []);
    setLoading(false);
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setCategory("אחר");
    setPrice("");
    setIsFeatured(false);
    setImageFile(null);
    setImagePreview(null);
    setEditingId(null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return toast.error("יש להזין שם מוצר");
    if (!imageFile && !editingId) return toast.error("יש להעלות תמונה");

    setSaving(true);
    try {
      let imageUrl = imagePreview || "";

      if (imageFile) {
        const ext = imageFile.name.split(".").pop();
        const path = `${Date.now()}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(path, imageFile, { contentType: imageFile.type });

        if (uploadError) throw uploadError;
        imageUrl = supabase.storage.from("product-images").getPublicUrl(uploadData.path).data.publicUrl;
      }

      const productData = {
        title: title.trim(),
        description: description.trim() || null,
        category,
        image_url: imageUrl,
        price: price ? parseFloat(price) : null,
        is_featured: isFeatured,
      };

      if (editingId) {
        // Only include image_url if we uploaded a new image
        const updateData = imageFile
          ? productData
          : { ...productData, image_url: undefined };
        
        // Remove undefined fields
        const cleanData = Object.fromEntries(
          Object.entries(imageFile ? productData : { ...productData }).filter(([k, v]) => k !== 'image_url' || imageFile)
        );

        const { error } = await supabase
          .from("products")
          .update(imageFile ? productData : { title: productData.title, description: productData.description, category: productData.category, price: productData.price, is_featured: productData.is_featured })
          .eq("id", editingId);
        if (error) throw error;
        toast.success("המוצר עודכן!");
      } else {
        const { error } = await supabase.from("products").insert({
          ...productData,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        });
        if (error) throw error;
        toast.success("המוצר נוסף בהצלחה!");
      }

      resetForm();
      loadProducts();
    } catch (err: any) {
      toast.error(err.message || "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingId(product.id);
    setTitle(product.title);
    setDescription(product.description || "");
    setCategory(product.category);
    setPrice(product.price?.toString() || "");
    setIsFeatured(product.is_featured);
    setImagePreview(product.image_url);
    setImageFile(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("למחוק את המוצר?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      toast.error("שגיאה במחיקה");
    } else {
      toast.success("המוצר נמחק");
      setProducts((prev) => prev.filter((p) => p.id !== id));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 backdrop-blur-sm p-4" dir="rtl">
      <div className="w-full max-w-4xl max-h-[90vh] rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-display text-lg font-bold text-foreground">ניהול מוצרים</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-secondary transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <h3 className="font-display text-sm font-bold text-foreground">
                {editingId ? "✏️ ערוך מוצר" : "➕ הוסף מוצר חדש"}
              </h3>

              <div>
                <label className="font-accent text-xs text-muted-foreground mb-1 block">שם מוצר</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 font-body text-sm text-foreground focus:border-gold/50 focus:outline-none"
                  placeholder="שם המוצר"
                  required
                />
              </div>

              <div>
                <label className="font-accent text-xs text-muted-foreground mb-1 block">תיאור</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 font-body text-sm text-foreground focus:border-gold/50 focus:outline-none resize-none"
                  rows={3}
                  placeholder="תיאור המוצר..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-accent text-xs text-muted-foreground mb-1 block">קטגוריה</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 font-body text-sm text-foreground focus:border-gold/50 focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-accent text-xs text-muted-foreground mb-1 block">מחיר (₪)</label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 font-body text-sm text-foreground focus:border-gold/50 focus:outline-none"
                    placeholder="99.90"
                    step="0.01"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  id="featured"
                  className="rounded border-border"
                />
                <label htmlFor="featured" className="font-body text-sm text-foreground">⭐ מוצר מומלץ</label>
              </div>

              {/* Image upload */}
              <div>
                <label className="font-accent text-xs text-muted-foreground mb-1 block">תמונה</label>
                {imagePreview ? (
                  <div className="relative">
                    <img src={imagePreview} alt="preview" className="w-full h-32 object-cover rounded-lg border border-border" />
                    <button
                      type="button"
                      onClick={() => { setImageFile(null); setImagePreview(null); }}
                      className="absolute top-2 left-2 rounded-full bg-foreground/50 p-1 text-card"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-32 rounded-lg border-2 border-dashed border-border cursor-pointer hover:border-gold/40 transition-colors">
                    <ImagePlus className="h-6 w-6 text-muted-foreground mb-1" />
                    <span className="font-body text-xs text-muted-foreground">העלה תמונת מוצר</span>
                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  </label>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-gold py-2.5 font-display text-sm font-semibold text-gold-foreground transition-all hover:brightness-110 disabled:opacity-50"
                >
                  {saving ? "שומר..." : editingId ? "עדכן מוצר" : "הוסף מוצר"}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-lg border border-border px-4 py-2.5 font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    ביטול
                  </button>
                )}
              </div>
            </form>

            {/* Existing products list */}
            <div className="space-y-3">
              <h3 className="font-display text-sm font-bold text-foreground">
                מוצרים קיימים ({products.length})
              </h3>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
                </div>
              ) : products.length === 0 ? (
                <p className="font-body text-sm text-muted-foreground py-8 text-center">
                  אין מוצרים עדיין
                </p>
              ) : (
                <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center gap-3 rounded-lg border border-border p-2.5 hover:bg-secondary/30 transition-colors"
                    >
                      <img
                        src={product.image_url}
                        alt={product.title}
                        className="h-12 w-12 rounded-md object-cover shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-display text-xs font-bold text-foreground truncate">
                          {product.is_featured && "⭐ "}{product.title}
                        </p>
                        <p className="font-accent text-[10px] text-muted-foreground">{product.category}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => handleEdit(product)}
                          className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="rounded p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminProductForm;
