# סיכום Migration - e-control CRM Pro

## 📊 טבלאות בסיס הנתונים

### 👥 משתמשים ותפקידים
- **profiles** - פרופילי משתמשים
- **user_roles** - תפקידי משתמשים (admin, manager, employee, client)
- **user_preferences** - העדפות משתמש

### 🏢 לקוחות ופרויקטים
- **clients** - לקוחות
- **projects** - פרויקטים
- **project_updates** - עדכוני פרויקטים

### ⏱️ ניהול זמן
- **time_entries** - רישום שעות עבודה
- **tasks** - משימות
- **meetings** - פגישות

### 💰 פיננסים
- **invoices** - חשבוניות
- **invoice_payments** - תשלומים על חשבוניות
- **quotes** - הצעות מחיר
- **quote_payments** - תשלומים על הצעות מחיר
- **expenses** - הוצאות
- **budgets** - תקציבים
- **financial_alerts** - התראות פיננסיות

### 📋 טבלאות מותאמות אישית
- **custom_tables** - הגדרות טבלאות מותאמות
- **custom_table_data** - נתוני טבלאות מותאמות
- **custom_table_permissions** - הרשאות לטבלאות
- **table_custom_columns** - עמודות מותאמות
- **data_types** - סוגי נתונים

### 📁 לקוחות - טאבים מותאמים
- **client_custom_tabs** - טאבים מותאמים ללקוחות
- **client_tab_columns** - עמודות בטאבים
- **client_tab_data** - נתונים בטאבים
- **client_tab_files** - קבצים בטאבים

### 📄 לקוחות - קבצים והודעות
- **client_files** - קבצים של לקוחות
- **client_messages** - הודעות ללקוחות
- **whatsapp_messages** - הודעות WhatsApp

### 🎯 שלבי לקוח
- **client_stages** - שלבי תהליך לקוח
- **client_stage_tasks** - משימות לפי שלב

### ⚙️ מערכת
- **app_settings** - הגדרות אפליקציה
- **activity_log** - לוג פעילות
- **reminders** - תזכורות

## 🔧 פונקציות מרכזיות

### בדיקת הרשאות
- `is_admin(user_id)` - בדיקה אם משתמש הוא אדמין
- `is_admin_or_manager(user_id)` - בדיקה אם משתמש הוא אדמין או מנהל
- `is_client(user_id)` - בדיקה אם משתמש הוא לקוח
- `has_role(user_id, role)` - בדיקה אם למשתמש יש תפקיד מסוים

### ניהול משתמשים
- `handle_new_user()` - יצירת פרופיל וקיצוב תפקיד לאחר רישום

### אחרות
- `get_client_id(user_id)` - שליפת ID של לקוח לפי משתמש
- `update_invoice_paid_amount()` - עדכון סכום ששולם בחשבונית
- `log_table_activity()` - רישום פעילות בטבלאות

## 📝 הוראות העלאה ל-Lovable

1. היכנס ל-[Lovable Project](https://lovable.dev)
2. עבור ל-Database / Supabase
3. העלה את הקובץ:
   ```
   supabase/migrations/20260114154200_remix_migration_from_pg_dump.sql
   ```
4. הקובץ כולל **3,211 שורות** של הגדרות מלאות

## ⚠️ חשוב לדעת

- המערכת כוללת **31 טבלאות** שונות
- יש **8 פונקציות** מותאמות אישית
- התמיכה ב-**RLS (Row Level Security)** מוגדרת
- יש **triggers** לעדכון אוטומטי של `updated_at`
- המערכת תומכת ב-**4 תפקידים**: admin, manager, employee, client
