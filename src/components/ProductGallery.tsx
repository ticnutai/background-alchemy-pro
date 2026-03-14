import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Filter, Star } from "lucide-react";

interface Product {
  id: string;
  title: string;
  description: string | null;
  category: string;
  image_url: string;
  price: number | null;
  is_featured: boolean;
  created_at: string;
}

const categoryLabels = [
  "הכל",
  "פסח",
  "שבועות",
  "סוכות",
  "ראש השנה",
  "חנוכה",
  "פורים",
  "שבת",
  "מתנות",
  "אחר",
];

const ProductGallery = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("הכל");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false });

    if (!error && data) {
      setProducts(data as Product[]);
    }
    setLoading(false);
  };

  const filtered =
    activeCategory === "הכל"
      ? products
      : products.filter((p) => p.category === activeCategory);

  // Get categories that actually have products
  const activeCategories = categoryLabels.filter(
    (c) => c === "הכל" || products.some((p) => p.category === c)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="font-body text-sm text-muted-foreground">
          עדיין לא נוספו מוצרים לגלריה
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Category filter */}
      <div className="flex flex-wrap justify-center gap-2">
        {activeCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`rounded-full px-5 py-2 font-display text-xs font-semibold transition-all ${
              activeCategory === cat
                ? "bg-gold text-gold-foreground shadow-md"
                : "bg-card border border-border text-foreground hover:border-gold/40"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
        {filtered.map((product) => (
          <div
            key={product.id}
            className="group relative overflow-hidden rounded-2xl border border-border bg-card transition-all hover:border-gold/30 hover:shadow-xl cursor-pointer"
            onClick={() => setSelectedProduct(product)}
          >
            <div className="aspect-square overflow-hidden">
              <img
                src={product.image_url}
                alt={product.title}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                loading="lazy"
              />
            </div>
            {product.is_featured && (
              <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-gold/90 px-2.5 py-1 backdrop-blur-sm">
                <Star className="h-3 w-3 fill-gold-foreground text-gold-foreground" />
                <span className="font-accent text-[10px] font-bold text-gold-foreground">מומלץ</span>
              </div>
            )}
            <div className="p-4">
              <span className="font-accent text-[10px] text-gold uppercase tracking-wider">
                {product.category}
              </span>
              <h3 className="mt-1 font-display text-sm font-bold text-foreground line-clamp-1">
                {product.title}
              </h3>
              {product.description && (
                <p className="mt-1 font-body text-xs text-muted-foreground line-clamp-2">
                  {product.description}
                </p>
              )}
              {product.price && (
                <p className="mt-2 font-display text-sm font-bold text-gold">
                  ₪{product.price}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Product detail modal */}
      {selectedProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 backdrop-blur-sm p-4"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="aspect-video overflow-hidden">
              <img
                src={selectedProduct.image_url}
                alt={selectedProduct.title}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="p-6 space-y-3">
              <span className="font-accent text-xs text-gold uppercase tracking-wider">
                {selectedProduct.category}
              </span>
              <h3 className="font-display text-2xl font-bold text-foreground">
                {selectedProduct.title}
              </h3>
              {selectedProduct.description && (
                <p className="font-body text-sm text-muted-foreground leading-relaxed">
                  {selectedProduct.description}
                </p>
              )}
              {selectedProduct.price && (
                <p className="font-display text-xl font-bold text-gold">
                  ₪{selectedProduct.price}
                </p>
              )}
              <div className="flex gap-3 pt-2">
                <a
                  href="#contact"
                  onClick={() => setSelectedProduct(null)}
                  className="rounded-full bg-gold px-6 py-2.5 font-display text-sm font-semibold text-gold-foreground transition-all hover:brightness-110"
                >
                  הזמן עכשיו
                </a>
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="rounded-full border border-border px-6 py-2.5 font-display text-sm font-semibold text-foreground transition-all hover:bg-secondary"
                >
                  סגור
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductGallery;
