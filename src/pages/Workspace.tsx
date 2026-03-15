import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Sparkles, BookOpen, LayoutGrid, Image, ArrowLeft,
  Wand2, Palette, Layers, Scissors, SunMedium, Contrast,
  FileDown, Eraser, ArrowUpCircle, Home,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import studioLogo from "@/assets/studio-logo.png";

const TOOL_SECTIONS = [
  {
    title: "כלי עריכה",
    description: "כלים מקצועיים לעיבוד תמונות מוצר",
    tools: [
      {
        to: "/tool",
        icon: <Sparkles className="h-7 w-7" />,
        title: "כלי AI לרקעים",
        desc: "החלפת רקע חכמה עם AI — בחרו מתוך עשרות רקעים מקצועיים או צרו רקע מותאם",
        accent: true,
      },
      {
        to: "/gallery",
        icon: <Image className="h-7 w-7" />,
        title: "גלריית תמונות",
        desc: "כל התמונות המעובדות שלכם — מועדפים, תיקיות, השוואה וייצוא",
        accent: false,
      },
    ],
  },
  {
    title: "יצירת תוכן",
    description: "בניית חומרים שיווקיים מקצועיים",
    tools: [
      {
        to: "/collage",
        icon: <LayoutGrid className="h-7 w-7" />,
        title: "בונה קולאז׳",
        desc: "צרו קולאז׳ים מרהיבים מתמונות — 14 לייאאוטים, מסגרות, טקסט, ווטרמרק ועוד",
        accent: false,
      },
      {
        to: "/catalog",
        icon: <BookOpen className="h-7 w-7" />,
        title: "מחולל קטלוגים",
        desc: "בנו קטלוג מוצרים מקצועי עם עמוד שער, תוכן עניינים, קטגוריות ומחירון",
        accent: false,
      },
    ],
  },
];

const QUICK_FEATURES = [
  { icon: <Eraser className="h-4 w-4" />, label: "הסרת רקע" },
  { icon: <Wand2 className="h-4 w-4" />, label: "שיפור אוטומטי" },
  { icon: <ArrowUpCircle className="h-4 w-4" />, label: "הגדלה עם AI" },
  { icon: <Palette className="h-4 w-4" />, label: "החלפת רקע" },
  { icon: <Scissors className="h-4 w-4" />, label: "חיתוך חכם" },
  { icon: <SunMedium className="h-4 w-4" />, label: "צל תלת-ממדי" },
  { icon: <Contrast className="h-4 w-4" />, label: "חידוד" },
  { icon: <Layers className="h-4 w-4" />, label: "שכבות" },
  { icon: <FileDown className="h-4 w-4" />, label: "ייצוא מקצועי" },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

export default function Workspace() {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Compact nav */}
      <nav className="sticky top-0 z-50 border-b border-gold/20 bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-6 py-3">
          <Link to="/" className="flex items-center gap-3">
            <img src={studioLogo} alt="רותי פרל" className="h-10 w-auto" />
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              to="/"
              className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 font-accent text-xs font-semibold text-foreground transition-colors hover:border-gold/40"
            >
              <Home className="h-3.5 w-3.5" />
              דף הבית
            </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <div className="mx-auto max-w-5xl px-6 pt-12 pb-6 text-center">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="mb-4 inline-block rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5">
            <span className="font-accent text-xs font-semibold text-gold">סטודיו עריכה מקצועי</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground">
            כלי <span className="text-gold italic">העריכה</span>
          </h1>
          <p className="mt-3 mx-auto font-body text-base text-muted-foreground max-w-lg leading-relaxed">
            כל הכלים שצריך כדי ליצור תוכן מקצועי — עריכת תמונות, קולאז׳ים וקטלוגים
          </p>
        </motion.div>
      </div>

      {/* Quick feature tags */}
      <div className="mx-auto max-w-5xl px-6 pb-8">
        <motion.div
          className="flex flex-wrap justify-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {QUICK_FEATURES.map((f) => (
            <span
              key={f.label}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 font-accent text-[11px] text-muted-foreground"
            >
              {f.icon}
              {f.label}
            </span>
          ))}
        </motion.div>
      </div>

      {/* Tool sections */}
      <motion.div
        className="mx-auto max-w-5xl px-6 pb-20 space-y-12"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {TOOL_SECTIONS.map((section) => (
          <motion.div key={section.title} variants={itemVariants}>
            <div className="mb-4">
              <h2 className="font-display text-lg font-bold text-foreground">{section.title}</h2>
              <p className="font-body text-sm text-muted-foreground">{section.description}</p>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {section.tools.map((tool) => (
                <Link
                  key={tool.to}
                  to={tool.to}
                  className={`group relative rounded-2xl border p-6 transition-all hover:shadow-xl hover:shadow-gold/5 ${
                    tool.accent
                      ? "border-gold/40 bg-gradient-to-bl from-gold/10 via-gold/5 to-transparent hover:border-gold/60"
                      : "border-border bg-card hover:border-gold/40"
                  }`}
                >
                  <div className={`flex h-14 w-14 items-center justify-center rounded-xl ${
                    tool.accent ? "bg-gold/20 text-gold" : "bg-secondary text-foreground"
                  }`}>
                    {tool.icon}
                  </div>
                  <h3 className="mt-4 font-display text-xl font-bold text-foreground group-hover:text-gold transition-colors">
                    {tool.title}
                  </h3>
                  <p className="mt-2 font-body text-sm text-muted-foreground leading-relaxed">
                    {tool.desc}
                  </p>
                  <div className="mt-4 flex items-center gap-1 font-accent text-xs font-semibold text-gold opacity-0 group-hover:opacity-100 transition-opacity">
                    פתח כלי
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </div>
                  {tool.accent && (
                    <div className="absolute top-4 left-4 rounded-full bg-gold px-2.5 py-0.5 font-accent text-[10px] font-bold text-gold-foreground">
                      מומלץ
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
