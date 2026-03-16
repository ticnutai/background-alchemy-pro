

# תוכנית אופטימיזציה לביצועי עיבוד תמונות — מהירות × 3-5

## מצב נוכחי

המערכת כבר כוללת יסודות טובים:
- **JobQueue** עם concurrency=3 ו-retry
- **Web Worker** לפילטרים (filter-worker) ולייצוא (export-worker)
- **דחיסת תמונה** לפני שליחה ל-API (2048px, JPEG 85%)
- **Result cache** בזיכרון (20 entries)
- **Lazy loading** לקומפוננטות כבדות

## מה חסר — שיפורים מוצעים

### 1. Web Worker Pool לפילטרים מקומיים
**בעיה:** כרגע נוצר Worker חדש בכל קריאה ונהרס — יקר.
**פתרון:** יצירת `WorkerPool` שמחזיק 2-4 Workers חיים ומגלגל ביניהם.

```text
┌─ Main Thread ──────────────────────┐
│  slider change → debounce 50ms     │
│  → workerPool.dispatch(pixels)     │
│  ← onmessage → drawImage()        │
└────────────────────────────────────┘
     ↕         ↕         ↕
  Worker-1  Worker-2  Worker-3
```

**קבצים:** `src/lib/worker-pool.ts` (חדש), עדכון `ImageCanvas.tsx` ו-`Tool.tsx`

### 2. Streaming Response מ-Edge Functions
**בעיה:** AI edge functions (remove-bg, replace-bg) מחזירות base64 ענק בבת אחת — הדפדפן תקוע עד שנגמר.
**פתרון:** החזרת `ReadableStream` מה-edge functions — התמונה מתחילה להיטען כבר אחרי שניות, עם progress bar אמיתי.

**קבצים:** עדכון `supabase/functions/replace-background/index.ts`, `src/lib/ai-tools.ts`

### 3. OffscreenCanvas + ImageBitmap Pipeline
**בעיה:** העתקת פיקסלים בין Canvas ← Worker ← Canvas יקרה.
**פתרון:** שימוש ב-`createImageBitmap()` עם `transfer` (zero-copy) + `OffscreenCanvas` ב-Worker עצמו. כבר קיים חלקית ב-export — להרחיב לכל הפילטרים.

**קבצים:** עדכון `src/lib/filter-worker.ts`

### 4. Debounce + Throttle חכם לסליידרים
**בעיה:** כל תזוזת סליידר מפעילה עיבוד מלא.
**פתרון:** 
- CSS filter preview מיידי (0ms) כ-"draft"
- Worker processing אחרי 150ms debounce כ-"final"
- ביטול אוטומטי של עיבוד קודם שלא הסתיים

**קבצים:** עדכון `src/components/ImageAdjustmentsPanel.tsx`, `src/components/ImageCanvas.tsx`

### 5. Cache משודרג עם LRU + IndexedDB
**בעיה:** Cache נוכחי מוגבל ל-20 entries ב-RAM, נמחק ב-refresh.
**פתרון:** 
- **LRU Cache** עם סדר עדיפויות (תוצאות AI יקרות > פילטרים מקומיים)
- **IndexedDB** לשמירת תוצאות AI בין סשנים (remove-bg, replace-bg)
- Cache key מבוסס hash של התמונה + פרמטרים

**קבצים:** `src/lib/persistent-cache.ts` (חדש), עדכון `src/lib/result-cache.ts`

### 6. Batch: Chunk Upload + Parallel Edge Functions
**בעיה:** ב-batch processing, כל תמונה שולחת base64 מלא — 3 במקביל עלולות לחנוק.
**פתרון:**
- דחיסה ל-1024px (במקום 2048) ל-batch
- העלאת קבצים ל-Storage ושליחת URL בלבד ל-edge function
- הגדלת concurrency ל-5 ב-batch mode

**קבצים:** עדכון `src/components/BatchProcessor.tsx`, `src/lib/job-queue.ts`

### 7. Priority Queue שיפור
**בעיה:** תור עדיפויות קיים אבל לא מנצלים אותו.
**פתרון:** 
- פעולה שהמשתמש רואה עכשיו = priority גבוה
- Batch items שלא על המסך = priority נמוך
- Cancel אוטומטי אם המשתמש עבר לתמונה אחרת

**קבצים:** עדכון `src/lib/job-queue.ts`

## סיכום טכני

```text
שיפור                      │ השפעה   │ מורכבות
───────────────────────────┼─────────┼─────────
Worker Pool                │ ×2 מהיר │ בינונית
Streaming Responses        │ UX טוב  │ בינונית
OffscreenCanvas transfer   │ ×1.5    │ נמוכה
Debounce + CSS preview     │ UX מיידי│ נמוכה
IndexedDB cache            │ חוסך API│ בינונית
Batch chunk upload         │ ×2 batch│ בינונית
Priority + cancel          │ UX טוב  │ נמוכה
```

## סדר יישום מומלץ
1. Debounce + CSS preview (שיפור מורגש מיידי, מאמץ נמוך)
2. Worker Pool (שיפור ביצועים משמעותי)
3. IndexedDB cache (חוסך קריאות API יקרות)
4. OffscreenCanvas transfer (שיפור נוסף לפילטרים)
5. Batch optimizations (upload to storage + higher concurrency)
6. Streaming responses (UX שיפור ל-AI operations)
7. Priority + cancel (polish)

