# Supabase: מסד נתונים אמיתי (מוכן, לא מחובר)

מה יש כאן: סכמה, הרשאות (RLS) וכלי ייבוא, נבדקים אוטומטית (`tests/supabase.test.js`, על PGlite).
מה אין: פרויקט Supabase חי. פתיחת חשבון והעברת האתרים החיים דורשות את ישי ואישור החברה לנתונים.

## המבנה
- `sites`: אתר אחד לכל מופע (עין תמר, מולדת, באר טוביה).
- `members`: מי שייך לאיזה אתר ובאיזה תפקיד: `owner`, `editor`, `viewer`.
- `docs`: טבלה אחת שמחקה את מאגר המסמכים של הארטיפקט (`site_id`, `coll`, `id`, `data jsonb`), כדי שהקוד יעבור כמעט בלי שינוי.

## הרשאות (כמו ב-capabilities של הארטיפקט)
- viewer: קורא הכול חוץ מ-`settings/cba` ו-`settings/prices`.
- editor: כותב הכול חוץ מ-`settings`.
- owner: הכול, כולל מחירים ו-CBA. **מחירים נקראים רק ע״י owner** (סוגר את הדליפה שקיימת היום בארטיפקט).
- `updated_by` ו-`ts` נכתבים אוטומטית בטריגר.

## הקמה (כשיש אישור)
1. פרויקט חדש ב-Supabase, אזור אירופה.
2. SQL Editor: להריץ את `schema.sql`.
3. להוסיף משתמשים ב-Auth, ואז שורה ב-`members` לכל משתמש ואתר.

## ייבוא נתונים מגיבוי האפליקציה
```
node tools/supabase-import.js backup.json ein-tamar "אתר הקמה עין תמר" > /מחוץ-לריפו/ein-tamar.sql
```
**הפלט מכיל נתוני חברה. לא נכנס לריפו בשום מקרה.** מריצים אותו ב-SQL Editor.
פער ידוע: הגיבוי לא כולל ברקודים, כינויים, תמונות רחפן ויומן ייבוא; אותם מעבירים בנפרד.

## האפליקציה העצמאית (גרסה 25): הקמה פעם אחת, בערך 30 דקות
האפליקציה נבנית ב-`node tools/app.js` ל-`dist/app/<חברה>/` (S.E.E, MSE), ו-`src/app/shim.js` מחבר אותה ל-Supabase במקום ל-Claude.

1. **Supabase** (supabase.com, ישי): פרויקט חדש באזור אירופה. ב-SQL Editor מריצים את `schema.sql` כולו.
2. **כניסה בקוד:** Authentication → Email Templates → «Magic Link»: מחליפים את גוף ההודעה ל-`הקוד שלך: {{ .Token }}`. כך מגיע קוד בן 6 ספרות, ולא קישור שנפתח ב-Safari במקום באפליקציה.
3. **כתובת ומפתח:** Project Settings → API: את Project URL ואת anon public key מעתיקים ל-`src/app/apps.json` (לכל חברה). המפתח הזה ציבורי מטבעו. ההגנה היא ב-RLS שבסכמה.
4. **האתר הראשון והבעלים:** ישי נכנס לאפליקציה פעם אחת עם המייל שלו (כך נוצר משתמש), ואז מריץ ב-SQL Editor:
   ```sql
   insert into sites (slug, name, company, location) values ('see-ein-tamar', 'עין תמר', 'see', 'ערבה') returning id;
   insert into members values ('<id מהשורה הקודמת>', (select id from auth.users where email = '<המייל של הבעלים>'), 'owner');
   ```
   מכאן הבעלים מוסיף אתרים מהאפליקציה («+ אתר חדש») ומזמין אנשים לפי מייל (כפתור המשתמש בכותרת → «הזמנה לאתר הזה»).
5. **אחסון האפליקציה:** Cloudflare Pages (חינם, מותר לשימוש מסחרי): מחברים את הריפו, פקודת בנייה `npm ci && node tools/app.js`, תיקיית פלט `dist/app/see`. כל מיזוג ל-main מעדכן את האפליקציה.
6. **התקנה בטלפון / אייפד:** פותחים את הכתובת ב-Safari → שיתוף → «הוסף למסך הבית». נפתח במסך מלא עם אייקון משלו. במחשב: הכתובת בכל דפדפן.

מה עוד לא עובר מה-artifact: קריאת תעודות ודיווח בדיבור ב-AI (צריך פונקציה בשרת עם מפתח Claude API, עלות לפי שימוש), ושמות משתמשים ביומן הפעולות (טבלת profiles, ממלאים בהמשך).

## קריאת מסמכים עם Claude (פונקציית השרת `sample`)

תעודות משלוח, מדבקות, כתבי כמויות, תוכניות ודיבור נקראים דרך `supabase/functions/sample`. מפתח ה-API נשמר רק בשרת, ולא מגיע לטלפון. בלי מפתח, האפליקציה פשוט מסתירה את הקריאה האוטומטית.

הפעלה (פעם אחת, מהמק, בתיקיית הריפו):

```bash
npx supabase login
npx supabase link --project-ref ptyonidnvoeuipoauduo
npx supabase secrets set ANTHROPIC_API_KEY=<המפתח מ-console.anthropic.com>
npx supabase functions deploy sample
```

מודל: ברירת המחדל `claude-opus-5-5`. כדי לנסות את הזול (בערך פי 40 פחות): `npx supabase secrets set SAMPLE_MODEL=claude-haiku-5-5`. חזרה: `npx supabase secrets unset SAMPLE_MODEL`.
