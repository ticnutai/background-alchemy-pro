

## תוכנית שיפוץ מערכתי — עיצוב, ניווט, וניקיון קוד

### סקירת מצב קיים
- **Tool.tsx** (1588 שורות) — עמוד ענק עם 9 טאבים בסיידבר, כפתורים רבים מפוזרים, הדר עמוס
- **Gallery.tsx** (1191 שורות) — כולל פונקציות כפולות (generateSimplePDF, generateTIFF, triggerDownload) שקיימות גם ב-Tool.tsx
- **Workspace.tsx** (467 שורות) — דף כניסה עם כלים וטעינה
- **CatalogBuilder.tsx** (2456 שורות) — בונה קטלוגים
- **CollageBuilder.tsx** (3245 שורות) — בונה קולאז׳ים
- דיאלוגים חלקם בנויים כ-`<div>` ידני (לא Radix Dialog) — למשל Save Dialog ב-Tool.tsx
- צבעים נוכחיים: מצב כהה עם גוני סגול/ירוק. **המשתמש רוצה: רקע לבן, מסגרת זהב, אייקונים כחול נייבי חזק**
- עמוד הבית (Index.tsx) — **לא לגעת**

---

### שלב 1: עדכון עיצוב גלובלי (CSS Variables)

שינוי ב-`src/index.css` — ה-Light theme יהיה ברירת המחדל:
- `--background`: לבן טהור
- `--card`: לבן
- `--border`: גוון זהב (`38 50% 80%`)
- `--primary`: כחול נייבי חזק (`220 70% 25%`)
- `--accent`: כחול נייבי (`220 70% 25%`)
- `--gold` נשאר כמו שהוא (מסגרות)
- אייקונים ישתמשו ב-`text-primary` (navy)
- מסגרות/borders ישתמשו ב-`border-gold/40`

שמירת ערכת Dark mode כמו שהיא (Index משתמש בה).

### שלב 2: ניקוי כפילויות קוד

יצירת `src/lib/export-utils.ts` חדש עם:
- `generateSimplePDF()` — אחד, משותף
- `generateTIFF()` — אחד, משותף  
- `triggerDownload()` — אחד, משותף
- `downloadBlob()` — אחד, משותף

הסרת הפונקציות הכפולות מ-Tool.tsx ו-Gallery.tsx.

### שלב 3: שיפוץ Tool.tsx — ניווט וטאבים

**Header מחודש:**
- רצועת ניווט עליונה נקייה: לוגו | כלים (Tool/Collage/Catalog/Gallery) | פעולות (היסטוריה/התחבר/הגדרות)
- טאבים עם אייקוני Lucide (לא אימוג׳י) — גדולים וברורים
- שימוש ברכיב `Tabs` של shadcn/ui במקום כפתורים ידניים

**סיידבר טאבים — שדרוג:**
- החלפת האימוג׳ים (🧠⚙️⚡🎛️✂️) באייקוני Lucide בצבע navy
- טאבים גדולים יותר (py-3 px-4) עם label ברור
- אייקונים בגודל h-5 w-5

**כפתורי פעולה (action bar):**
- ארגון מחדש — קיבוץ לוגי: [החלף רקע | שפר] | [מוקאפ | תבניות | שתף] | [שמור | השוואה]
- הקטנת כמות כפתורים גלויים — העברת חלק לתפריט dropdown

### שלב 4: דיאלוגים — Escape + עיצוב אחיד

- **Save Dialog** (שורות 1409-1457 ב-Tool.tsx): החלפה מ-`<div>` ידני ל-shadcn `<Dialog>` (תומך Escape מובנה)
- **כל דיאלוג קיים**: וידוא ש-`onEscapeKeyDown` לא חסום, סגירה עם Escape
- עיצוב אחיד: רקע לבן, מסגרת זהב, אייקונים navy

### שלב 5: Gallery.tsx — סידור וניקוי

- הסרת פונקציות כפולות (PDF/TIFF) — שימוש ב-`export-utils.ts`
- עיצוב אחיד עם שאר האתר (לבן/זהב/navy)
- Header עם ניווט זהה ל-Tool

### שלב 6: Workspace.tsx — סידור

- עיצוב אחיד: כרטיסי כלים עם מסגרת זהב ואייקונים navy
- Header עם ניווט זהה

### שלב 7: CatalogBuilder + CollageBuilder — עיצוב אחיד

- החלת ערכת צבעים (לבן/זהב/navy) על כל הדיאלוגים והטאבים
- וידוא שכל Dialog סוגר עם Escape

### שלב 8: שמירה ל-Memory

עדכון `mem://index.md` עם ערכת העיצוב החדשה:
- רקע לבן, מסגרת זהב, אייקונים navy `#1a2744`
- אין אימוג׳ים בטאבים — רק Lucide icons
- כל Dialog חייב לתמוך Escape

---

### פרטים טכניים

**ערכת צבעים (CSS vars):**
```
--primary: 220 70% 25%        /* navy blue */
--primary-foreground: 0 0% 100%
--border: 38 50% 80%           /* gold border */
--ring: 38 70% 55%             /* gold ring */
--background: 0 0% 100%        /* white */
--card: 0 0% 100%              /* white */
```

**סיידבר טאבים — מיפוי אייקונים:**
- רקעים → `ImageIcon`
- חכם → `Brain`
- Pro ללא AI → `Wrench`
- פילטרים → `SlidersHorizontal`
- מתקדם → `Settings2`
- חיתוך → `Crop`
- כלים → `Wand2`
- התאמות → `Sun`
- ייצוא → `Download`

**Migrations / Edge Functions**: כבר קיימים ומעודכנים — 9 migrations + 16 edge functions. לא נדרשים שינויים.

**קבצים שיושפעו** (Index.tsx לא ייגע):
- `src/index.css` — ערכת צבעים
- `src/lib/export-utils.ts` — חדש
- `src/pages/Tool.tsx` — שיפוץ מרכזי
- `src/pages/Gallery.tsx` — ניקוי + עיצוב
- `src/pages/Workspace.tsx` — עיצוב
- `src/components/CatalogBuilder.tsx` — עיצוב
- `src/components/CollageBuilder.tsx` — עיצוב
- `mem://index.md` — עדכון

