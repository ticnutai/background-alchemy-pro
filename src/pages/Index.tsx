import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Phone, Mail, MapPin, Instagram, ArrowLeft, Settings } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import studioLogo from "@/assets/studio-logo.png";
import heroImage from "@/assets/hero-image.jpg";
import gallery1 from "@/assets/gallery-1.jpg";
import gallery2 from "@/assets/gallery-2.jpg";
import gallery3 from "@/assets/gallery-3.jpg";
import ProductGallery from "@/components/ProductGallery";
import AdminProductForm from "@/components/AdminProductForm";

const Index = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();
        setIsAdmin(!!data);
      }
    };
    checkAdmin();
  }, []);
  return (
    <div className="min-h-screen bg-background font-body" dir="rtl">
      {/* Navigation */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-gold/20 bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-6 py-3">
          <img src={studioLogo} alt="רותי פרל" className="h-14 w-auto" />
          <div className="hidden md:flex items-center gap-8">
            <a href="#home" className="font-display text-sm font-medium text-foreground hover:text-gold transition-colors">דף הבית</a>
            <a href="#about" className="font-display text-sm font-medium text-foreground hover:text-gold transition-colors">אודות</a>
            <a href="#gallery" className="font-display text-sm font-medium text-foreground hover:text-gold transition-colors">גלריה</a>
            <a href="#services" className="font-display text-sm font-medium text-foreground hover:text-gold transition-colors">שירותים</a>
            <a href="#contact" className="font-display text-sm font-medium text-foreground hover:text-gold transition-colors">צור קשר</a>
          </div>
          <Link
            to="/tool"
            className="flex items-center gap-2 rounded-full bg-gold px-5 py-2 font-accent text-xs font-semibold text-gold-foreground transition-all hover:brightness-110"
          >
            <Sparkles className="h-3.5 w-3.5" />
            כלי AI לרקעים
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="home" className="relative pt-24">
        <div className="relative h-[85vh] overflow-hidden">
          <img
            src={heroImage}
            alt="מוצרי יוקרה"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />
        </div>
        <div className="bg-background py-16">
          <div className="mx-auto max-w-7xl px-6 text-center">
            <div className="mb-6 inline-block rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5">
              <span className="font-accent text-xs font-semibold text-gold">עיצוב יוקרתי בעבודת יד</span>
            </div>
            <h1 className="font-display text-5xl md:text-7xl font-bold text-foreground leading-tight">
              סטודיו מעצבים
              <br />
              <span className="text-gold italic">רותי פרל</span>
            </h1>
            <p className="mt-6 mx-auto font-body text-lg text-muted-foreground max-w-lg leading-relaxed">
              עיצוב מוצרי יוקרה בעבודת יד, ריקמה אומנותית, וצילום מוצרים מקצועי ברמה הגבוהה ביותר
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <a
                href="#contact"
                className="rounded-full bg-gold px-8 py-3.5 font-display text-sm font-semibold text-gold-foreground transition-all hover:brightness-110"
              >
                צור קשר
              </a>
              <a
                href="#gallery"
                className="rounded-full border border-border bg-card px-8 py-3.5 font-display text-sm font-semibold text-foreground transition-all hover:border-gold/40"
              >
                צפה בעבודות
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 bg-card">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <span className="font-accent text-xs font-semibold text-gold uppercase tracking-[0.2em]">אודות הסטודיו</span>
              <h2 className="mt-4 font-display text-4xl md:text-5xl font-bold text-foreground leading-tight">
                יצירה מתוך
                <br />
                <span className="text-gold italic">אהבה לפרטים</span>
              </h2>
              <div className="mt-6 space-y-4 font-body text-base text-muted-foreground leading-relaxed">
                <p>
                  סטודיו רותי פרל מתמחה בעיצוב מוצרי יוקרה ייחודיים בעבודת יד. כל מוצר נוצר מתוך תשומת לב לכל פרט, משילוב חומרים איכותיים וריקמה אומנותית.
                </p>
                <p>
                  הסטודיו מציע גם שירותי צילום מוצרים מקצועי הכולל כלי AI מתקדם להחלפת רקעים — כך שכל מוצר מוצג באור הטוב ביותר, על הרקע המושלם.
                </p>
              </div>
              <div className="mt-10 grid grid-cols-3 gap-6">
                {[
                  { num: "15+", label: "שנות ניסיון" },
                  { num: "500+", label: "מוצרים יוקרתיים" },
                  { num: "100%", label: "עבודת יד" },
                ].map((stat) => (
                  <div key={stat.label} className="text-center">
                    <div className="font-display text-3xl font-bold text-gold">{stat.num}</div>
                    <div className="mt-1 font-body text-xs text-muted-foreground">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <img
                src={gallery2}
                alt="ריקמה"
                className="rounded-2xl shadow-2xl"
              />
              <div className="absolute -bottom-6 -left-6 h-48 w-48 rounded-2xl border-4 border-card overflow-hidden shadow-xl">
                <img src={gallery1} alt="עבודות" className="h-full w-full object-cover" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Product Gallery Section */}
      <section id="gallery" className="py-24 bg-background">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-16">
            <span className="font-accent text-xs font-semibold text-gold uppercase tracking-[0.2em]">גלריה</span>
            <h2 className="mt-4 font-display text-4xl md:text-5xl font-bold text-foreground">
              המוצרים <span className="text-gold italic">שלנו</span>
            </h2>
            <p className="mt-4 mx-auto font-body text-base text-muted-foreground max-w-lg">
              מוצרי יוקרה בעבודת יד לכל חג ואירוע — בחרו קטגוריה לסינון
            </p>
            {isAdmin && (
              <button
                onClick={() => setShowAdminPanel(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2 font-accent text-xs font-semibold text-gold-foreground transition-all hover:brightness-110"
              >
                <Settings className="h-3.5 w-3.5" />
                ניהול מוצרים
              </button>
            )}
          </div>
          <ProductGallery />
        </div>
      </section>

      {/* Admin Panel */}
      {showAdminPanel && <AdminProductForm onClose={() => setShowAdminPanel(false)} />}

      {/* Services Section */}
      <section id="services" className="py-24 bg-card">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-16">
            <span className="font-accent text-xs font-semibold text-gold uppercase tracking-[0.2em]">שירותים</span>
            <h2 className="mt-4 font-display text-4xl md:text-5xl font-bold text-foreground">
              מה אנחנו <span className="text-gold italic">מציעים</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: "✦",
                title: "עיצוב מוצרים",
                desc: "עיצוב מוצרי יוקרה ייחודיים לאירועים, חגים ומתנות — ריקמה בעבודת יד על בדים איכותיים",
              },
              {
                icon: "◈",
                title: "צילום מוצרים",
                desc: "צילום מקצועי עם כלי AI מתקדם להחלפת רקעים, כדי שכל מוצר יראה מושלם",
              },
              {
                icon: "❖",
                title: "עיצוב אישי",
                desc: "התאמה אישית של כל מוצר — בחירת בד, צבע חוט, טקסט ריקמה ועיצוב ייחודי",
              },
            ].map((service) => (
              <div
                key={service.title}
                className="group rounded-2xl border border-border bg-background p-8 transition-all hover:border-gold/40 hover:shadow-xl hover:shadow-gold/5"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gold/10 text-2xl text-gold">
                  {service.icon}
                </div>
                <h3 className="mt-5 font-display text-xl font-bold text-foreground">{service.title}</h3>
                <p className="mt-3 font-body text-sm text-muted-foreground leading-relaxed">{service.desc}</p>
              </div>
            ))}
          </div>

          {/* CTA to tool */}
          <div className="mt-16 rounded-2xl bg-gradient-to-l from-gold/20 via-gold/10 to-transparent border border-gold/20 p-10 flex items-center justify-between">
            <div>
              <h3 className="font-display text-2xl font-bold text-foreground">
                נסו את כלי ה-AI להחלפת רקעים
              </h3>
              <p className="mt-2 font-body text-sm text-muted-foreground">
                העלו תמונת מוצר ובחרו מתוך עשרות רקעים מקצועיים — שיש, עץ, בד, ריקמה ועוד
              </p>
            </div>
            <Link
              to="/tool"
              className="flex items-center gap-2 rounded-full bg-gold px-8 py-3.5 font-display text-sm font-semibold text-gold-foreground transition-all hover:brightness-110 shrink-0"
            >
              <Sparkles className="h-4 w-4" />
              לכלי AI
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-24 bg-foreground text-card">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid md:grid-cols-2 gap-16">
            <div>
              <span className="font-accent text-xs font-semibold text-gold uppercase tracking-[0.2em]">צור קשר</span>
              <h2 className="mt-4 font-display text-4xl md:text-5xl font-bold leading-tight">
                נשמח לשמוע
                <br />
                <span className="text-gold italic">ממך</span>
              </h2>
              <p className="mt-6 font-body text-base text-card/60 leading-relaxed max-w-md">
                מעוניינים בהזמנה מותאמת אישית? רוצים לשמוע עוד על השירותים שלנו? צרו קשר ונחזור אליכם בהקדם.
              </p>

              <div className="mt-10 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/20">
                    <Phone className="h-5 w-5 text-gold" />
                  </div>
                  <div>
                    <div className="font-accent text-xs text-card/50">טלפון</div>
                    <div className="font-body text-base text-card" dir="ltr">+972-50-000-0000</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/20">
                    <Mail className="h-5 w-5 text-gold" />
                  </div>
                  <div>
                    <div className="font-accent text-xs text-card/50">דוא״ל</div>
                    <div className="font-body text-base text-card" dir="ltr">studio@rutipearl.com</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/20">
                    <MapPin className="h-5 w-5 text-gold" />
                  </div>
                  <div>
                    <div className="font-accent text-xs text-card/50">כתובת</div>
                    <div className="font-body text-base text-card">תל אביב, ישראל</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/20">
                    <Instagram className="h-5 w-5 text-gold" />
                  </div>
                  <div>
                    <div className="font-accent text-xs text-card/50">אינסטגרם</div>
                    <div className="font-body text-base text-card">@rutipearl.studio</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact form */}
            <div className="rounded-2xl border border-card/10 bg-card/5 p-8">
              <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
                <div>
                  <label className="font-accent text-xs text-card/50 mb-1.5 block">שם מלא</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-card/10 bg-card/5 px-4 py-3 font-body text-sm text-card placeholder:text-card/30 focus:border-gold/50 focus:outline-none"
                    placeholder="הכנס שם מלא"
                  />
                </div>
                <div>
                  <label className="font-accent text-xs text-card/50 mb-1.5 block">דוא״ל</label>
                  <input
                    type="email"
                    className="w-full rounded-lg border border-card/10 bg-card/5 px-4 py-3 font-body text-sm text-card placeholder:text-card/30 focus:border-gold/50 focus:outline-none"
                    placeholder="example@email.com"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="font-accent text-xs text-card/50 mb-1.5 block">הודעה</label>
                  <textarea
                    className="w-full rounded-lg border border-card/10 bg-card/5 px-4 py-3 font-body text-sm text-card placeholder:text-card/30 focus:border-gold/50 focus:outline-none resize-none"
                    rows={5}
                    placeholder="ספרו לנו על מה שאתם מחפשים..."
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-lg bg-gold py-3.5 font-display text-sm font-semibold text-gold-foreground transition-all hover:brightness-110"
                >
                  שלח הודעה
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-card/10 bg-foreground py-8">
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <img src={studioLogo} alt="רותי פרל" className="h-10 w-auto brightness-0 invert opacity-60" />
          <p className="font-body text-xs text-card/40">
            © {new Date().getFullYear()} סטודיו מעצבים רותי פרל. כל הזכויות שמורות.
          </p>
          <div className="flex gap-4">
            <a href="#" className="font-body text-xs text-card/40 hover:text-gold transition-colors">מדיניות פרטיות</a>
            <a href="#" className="font-body text-xs text-card/40 hover:text-gold transition-colors">תנאי שימוש</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
