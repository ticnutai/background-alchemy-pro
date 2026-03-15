import { useState, useCallback } from "react";
import { HelpCircle, X, ChevronLeft, ChevronRight } from "lucide-react";

// ─── Tooltip Data ────────────────────────────────────────────
interface TooltipItem {
  title: string;
  description: string;
  example: string;
  icon?: string;
}

const tooltipsByPage: Record<string, TooltipItem[]> = {
  backgrounds: [
    {
      title: "בחירת רקע",
      description: "בחר רקע מוכן מ-70+ פריסטים מקצועיים, או כתוב תיאור משלך. המערכת תחליף את הרקע תוך שמירה על המוצר.",
      example: "דוגמה: בחר ״שיש קלקטה ביאנקו״ ← לחץ ״החלף רקע״ ← המוצר ישב על משטח שיש לבן מפואר",
      icon: "🎨",
    },
    {
      title: "תיאור חופשי",
      description: "כתוב תיאור מילולי של הרקע שאתה רוצה. ככל שהתיאור מפורט יותר, התוצאה טובה יותר.",
      example: "דוגמה: ״שולחן עץ כהה עם פרחים טריים ואור שקיעה חם מהצד״",
      icon: "✏️",
    },
    {
      title: "תמונות השראה",
      description: "העלה תמונות השראה כדי שהמערכת תדע בדיוק איזה סגנון אתה מחפש. עד 3 תמונות.",
      example: "דוגמה: העלה תמונה של סטיילינג שראית בפינטרסט ← המערכת תיצור רקע בסגנון דומה",
      icon: "📸",
    },
    {
      title: "מצב מדויק",
      description: "הפעל ״מצב מדויק״ לשימור טוב יותר של פרטי המוצר. מומלץ לרקמות, תכשיטים ופריטים עדינים.",
      example: "דוגמה: מוצר עם רקמה עדינה → הפעל מצב מדויק → הפרטים נשמרים בצורה חדה יותר",
      icon: "🎯",
    },
  ],
  smart: [
    {
      title: "הצעות חכמות",
      description: "AI מנתח את התמונה שלך ומציע 6-8 רקעים מתאימים. זיהוי סוג מוצר, חומרים, צבעים וסגנון.",
      example: "דוגמה: העלה תמונה של תכשיט זהב ← המערכת מציעה רקעי שיש כהה, קטיפה שחורה, עץ אגוז",
      icon: "🧠",
    },
  ],
  filters: [
    {
      title: "פילטרים חיים",
      description: "כוונן brightness, contrast, saturation ועוד בזמן אמת. התצוגה המקדימה מיידית.",
      example: "דוגמה: הזז סליידר brightness שמאלה → התמונה מתכהה בזמן אמת → לחץ ״החל״",
      icon: "⚡",
    },
    {
      title: "שכבות פילטרים",
      description: "ערום מספר אפקטים CSS — זהב חם + ויניט + חידוד. שנה סדר, הפעל/כבה כל שכבה.",
      example: "דוגמה: הפעל ״זהב חם״ + ״ויניט״ ← שנה את סדר השכבות ← שמור כפריסט",
      icon: "📚",
    },
    {
      title: "העברת צבע",
      description: "העלה תמונת השראה והמערכת תעביר את פלטת הצבעים שלה לתמונה שלך.",
      example: "דוגמה: העלה תמונה עם גוונים חמים ← הצבעים של התמונה שלך יהפכו חמים יותר",
      icon: "🎨",
    },
    {
      title: "פילטר אזורי",
      description: "החל אפקט רק על הרקע או רק על המוצר. blur לרקע, חידוד למוצר.",
      example: "דוגמה: בחר ״רקע בלבד״ + ״טשטוש״ ← הרקע מטושטש והמוצר חד",
      icon: "🎭",
    },
  ],
  crop: [
    {
      title: "חיתוך",
      description: "חתוך את התמונה ליחס גובה-רוחב מותאם. גרור את הפינות לשינוי גודל.",
      example: "דוגמה: בחר 1:1 (ריבועי) לאינסטגרם ← גרור את האזור הרצוי ← לחץ ״חתוך״",
      icon: "✂️",
    },
    {
      title: "סיבוב ושיקוף",
      description: "סובב את התמונה בכל זווית, או שקף אופקית/אנכית.",
      example: "דוגמה: תמונה הפוכה → סובב 180° → שיקוף אופקי",
      icon: "🔄",
    },
  ],
  adjust: [
    {
      title: "התאמות מקצועיות",
      description: "כוונון מלא: בהירות, ניגודיות, רוויה, חשיפה, highlights, shadows, warmth, tint ועוד.",
      example: "דוגמה: תמונה כהה → הגבר exposure +30 → הוסף shadows +20 → התמונה מוארת בצורה טבעית",
      icon: "🎛️",
    },
    {
      title: "פריסטים",
      description: "16 פריסטים מקצועיים מוכנים עם כיוונון עוצמה. מסטודיו חם ועד שחור-לבן דרמטי.",
      example: "דוגמה: בחר ״קולנועי״ ← כוונן עוצמה ל-80% ← לחץ ״החל מקומית״ לשריפת הפילטר",
      icon: "✨",
    },
    {
      title: "Levels & Color Balance",
      description: "שלוט ב-Black Point, White Point ו-Midtones. Color Balance נפרד ל-shadows/midtones/highlights.",
      example: "דוגמה: תמונה דהויה → הורד levelsWhite ל-230 → הגבר levelsBlack ל-15 → ניגודיות מדויקת",
      icon: "📊",
    },
  ],
  tools: [
    {
      title: "הסרת רקע מדויקת",
      description: "הסר רקע ללא AI — שימוש במודל Rembg לחיתוך מדויק של המוצר.",
      example: "דוגמה: מוצר על רקע לבן ← הפעל ״הסרת רקע מדויקה״ ← מקבל מוצר שקוף",
      icon: "✂️",
    },
    {
      title: "הגדלת תמונה",
      description: "הגדל תמונה עד פי 4 תוך שמירה על חדות. השתמש במודל Real-ESRGAN.",
      example: "דוגמה: תמונה 500×500 ← הגדל ×4 ← תמונה 2000×2000 חדה",
      icon: "🔍",
    },
    {
      title: "תאורה מחדש",
      description: "שנה את כיוון ועוצמת התאורה על המוצר. מעולה לתיקון תאורה לא אחידה.",
      example: "דוגמה: מוצר עם צל מימין ← שנה כיוון אור לשמאל ← תאורה אחידה",
      icon: "💡",
    },
  ],
  export: [
    {
      title: "פורמטים",
      description: "ייצא ב-PNG (שקיפות), TIFF (הדפסה), JPG (אתרים), WebP (מהיר), PDF (מסמכים).",
      example: "דוגמה: לאינסטגרם → JPG באיכות 90% | להדפסה → TIFF באיכות מקסימלית | לאתר → WebP",
      icon: "📁",
    },
    {
      title: "שינוי גודל",
      description: "שנה את רזולוציית התמונה לפני ייצוא. שמור על יחס גובה-רוחב.",
      example: "דוגמה: תמונה 4000×3000 ← שנה לרוחב 1080 ← גובה מתעדכן אוטומטית ל-810",
      icon: "📐",
    },
    {
      title: "ווטרמרק",
      description: "הוסף טקסט מותאם אישית כסימן מים. שלוט במיקום ושקיפות.",
      example: "דוגמה: הכנס ״סטודיו רותי פרל״ ← מיקום: מרכז ← שקיפות 30%",
      icon: "💧",
    },
  ],
  advanced: [
    {
      title: "עקומות טון (Tone Curves)",
      description: "הכלי המקצועי ביותר לכיוונון טון. גרור נקודות על העקומה לשליטה מלאה ב-highlights, midtones ו-shadows. עקומות נפרדות ל-RGB, אדום, ירוק וכחול.",
      example: "דוגמה: S-Curve קלאסי → הוסף נקודה ב-shadows (למטה) ונקודה ב-highlights (למעלה) → ניגודיות עשירה",
      icon: "📈",
    },
    {
      title: "HSL — גוון/רוויה/בהירות",
      description: "שלוט בכל צבע בנפרד: אדום, כתום, צהוב, ירוק, תכלת, כחול, סגול, מג׳נטה. לכל צבע — גוון, רוויה ובהירות.",
      example: "דוגמה: תכשיט זהב שנראה חיוור → בחר ״כתום״ → הגבר רוויה +40 → הזהב חי ומבריק",
      icon: "🎨",
    },
    {
      title: "איזון לבן (White Balance)",
      description: "לחץ על נקודה בתמונה שאמורה להיות אפורה או לבנה. המערכת מחשבת אוטומטית את התיקון הנדרש.",
      example: "דוגמה: תמונה צהבהבה מתאורת ליבון → לחץ על פינת נייר לבן בתמונה → צבעים מתוקנים מיד",
      icon: "⚖️",
    },
    {
      title: "מיקסר ערוצים (Channel Mixer)",
      description: "ערבב ערוצי RGB ביניהם. הכלי הכי חזק ליצירת שחור-לבן מותאם אישית ואפקטים צבעוניים.",
      example: "דוגמה: B&W עם דגש אדום → בחר פריסט B&W אדום → המוצר האדום בולט מהשאר",
      icon: "🔀",
    },
    {
      title: "מיפוי גרדיאנט (Gradient Map)",
      description: "ממפה את בהירות התמונה לגרדיאנט צבע. הכלי הכי מהיר לצביעה יצירתית.",
      example: "דוגמה: בחר ״זהב-שחור״ → אזורים כהים הופכים שחורים, בהירים הופכים זהובים → מראה יוקרתי",
      icon: "🌈",
    },
    {
      title: "צבע סלקטיבי (CMYK)",
      description: "כוונון CMYK לכל טווח צבע בנפרד. שליטה כירורגית: ״יותר צהוב רק באדומים״.",
      example: "דוגמה: עלים ירוקים חיוורים → בחר ״ירוק״ → הוסף Cyan +30 → ירוקים עמוקים ועשירים",
      icon: "🎯",
    },
    {
      title: "ייבוא LUT (.cube)",
      description: "ייבא קבצי צביעה מקצועיים בפורמט .cube — תקן תעשייתי מ-DaVinci Resolve, Lightroom ועוד.",
      example: "דוגמה: הורד LUT ״Cinematic Teal & Orange״ מהאינטרנט → ייבא קובץ .cube → מראה קולנועי",
      icon: "📦",
    },
    {
      title: "הפחתת רעש",
      description: "מנקה גרעיניות ורעש מתמונות שצולמו בתאורה חלשה. שומר על קצוות.",
      example: "דוגמה: תמונת לילה גרעינית → חוזק 60, שימור פרטים 40 → תמונה נקייה עם פרטים שמורים",
      icon: "🔇",
    },
    {
      title: "Tilt-Shift (אפקט מיניאטורה)",
      description: "יוצר אפקט עומק שדה רדוד — הרצועה במרכז חדה והשאר מטושטש.",
      example: "דוגמה: מוצר על שולחן → מיקוד 50%, רוחב 25% → המוצר חד והשאר מטושטש כמו מיניאטורה",
      icon: "🔭",
    },
    {
      title: "חשיפה כפולה / Blend Modes",
      description: "שלב שתי תמונות עם 11 מצבי ערבוב: Multiply, Screen, Overlay ועוד.",
      example: "דוגמה: מוצר + טקסטורת שיש → Overlay → המוצר ״יושב״ על השיש עם מראה אמנותי",
      icon: "🔮",
    },
    {
      title: "טקסט על התמונה",
      description: "הוסף טקסט מעוצב עם גופנים, צבעים, קו מתאר, צל וסיבוב. תומך עברית.",
      example: "דוגמה: הקלד ״מבצע -30%״ → גופן Impact → צבע אדום → קו מתאר לבן → מוכן לסושיאל",
      icon: "✍️",
    },
    {
      title: "אפקטים יצירתיים",
      description: "RGB Split, Scanlines, פיקסלים, Halftone, Duotone — לסגנון ויזואלי ייחודי.",
      example: "דוגמה: בחר RGB Split → עוצמה 40 → אפקט רטרו-גליץ׳ מגניב לפוסט אינסטגרם",
      icon: "⚡",
    },
    {
      title: "תיקון פרספקטיבה",
      description: "תקן עיוותי פרספקטיבה מצילום בזווית. Keystone correction אנכי ואופקי.",
      example: "דוגמה: תמונה מלמטה שנראית מעוותת → הזז ״אנכי״ שמאלה → המוצר ישר ומקצועי",
      icon: "📐",
    },
  ],
};

// ─── Tooltip Dialog Component ────────────────────────────────
interface TooltipHelpDialogProps {
  page: string;
  open: boolean;
  onClose: () => void;
}

function TooltipHelpDialog({ page, open, onClose }: TooltipHelpDialogProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const items = tooltipsByPage[page] || [];

  if (!open || items.length === 0) return null;

  const item = items[currentIdx];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-[90vw] max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-primary/5">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{item.icon}</span>
            <h3 className="font-display text-lg font-bold">{item.title}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <p className="text-sm leading-relaxed">{item.description}</p>
          <div className="bg-muted/50 border border-border rounded-lg p-3">
            <p className="text-sm text-primary font-semibold mb-1">💡 {item.example.split(":")[0]}:</p>
            <p className="text-sm text-muted-foreground">{item.example.split(":").slice(1).join(":")}</p>
          </div>
        </div>

        {/* Dots + Navigation */}
        <div className="flex items-center justify-between p-4 border-t border-border bg-muted/30">
          <button
            onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
            disabled={currentIdx === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-muted disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
            הקודם
          </button>

          <div className="flex items-center gap-1.5">
            {items.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIdx(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === currentIdx ? "bg-primary w-4" : "bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>

          <button
            onClick={() => setCurrentIdx(Math.min(items.length - 1, currentIdx + 1))}
            disabled={currentIdx === items.length - 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-muted disabled:opacity-30 transition-colors"
          >
            הבא
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        {/* Page indicator */}
        <div className="text-center pb-3 text-[10px] text-muted-foreground">
          {currentIdx + 1} / {items.length}
        </div>
      </div>
    </div>
  );
}

// ─── Help Button (Floating Icon) ─────────────────────────────
interface TooltipHelpButtonProps {
  page: string;
}

export default function TooltipHelpButton({ page }: TooltipHelpButtonProps) {
  const [open, setOpen] = useState(false);

  if (!tooltipsByPage[page] || tooltipsByPage[page].length === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-all hover:scale-110"
        title="עזרה ודוגמאות"
      >
        <HelpCircle className="h-4 w-4" />
      </button>
      <TooltipHelpDialog page={page} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export { TooltipHelpDialog };
