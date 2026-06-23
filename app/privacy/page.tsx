import Link from 'next/link'

export const metadata = {
  title: 'מדיניות פרטיות – האיחוד החקלאי',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="mb-8">
          <Link href="/apply" className="text-blue-600 text-sm hover:underline">← חזרה לשאלון</Link>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">מדיניות פרטיות</h1>
        <p className="text-gray-500 text-sm mb-2">עדכון אחרון: יוני 2025</p>
        <p className="text-gray-500 text-sm mb-8">בהתאם לחוק הגנת הפרטיות, התשמ"א–1981, ותיקון 13 לחוק (בתוקף מאוגוסט 2025)</p>

        <div className="space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">1. מי אנחנו (בעל מאגר המידע)</h2>
            <p>
              <strong>האיחוד החקלאי של ישראל</strong> הוא בעל מאגר המידע ואחראי לעיבוד הנתונים האישיים שנאספים במסגרת שאלון הגיוס לתפקיד רכז/ת נוער.
            </p>
            <p className="mt-2">
              <strong>פרטי יצירת קשר בענייני פרטיות:</strong><br />
              אימייל: <a href="mailto:privacy@haichud.co.il" className="text-blue-600 underline">privacy@haichud.co.il</a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">2. אילו נתונים אנו אוספים</h2>
            <p className="mb-3">במסגרת שאלון הגיוס נאספים הנתונים הבאים:</p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-3 py-2 text-right font-bold">שדה</th>
                    <th className="border border-gray-300 px-3 py-2 text-right font-bold">חובה / רשות</th>
                    <th className="border border-gray-300 px-3 py-2 text-right font-bold">מטרה</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-3 py-2">שם פרטי</td>
                    <td className="border border-gray-300 px-3 py-2 text-red-600 font-medium">חובה</td>
                    <td className="border border-gray-300 px-3 py-2">זיהוי המועמד/ת</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-300 px-3 py-2">שם משפחה</td>
                    <td className="border border-gray-300 px-3 py-2 text-green-700 font-medium">רשות</td>
                    <td className="border border-gray-300 px-3 py-2">זיהוי משלים</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-3 py-2">מספר טלפון</td>
                    <td className="border border-gray-300 px-3 py-2 text-red-600 font-medium">חובה</td>
                    <td className="border border-gray-300 px-3 py-2">יצירת קשר לצורך תיאום ראיון</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-300 px-3 py-2">כתובת אימייל</td>
                    <td className="border border-gray-300 px-3 py-2 text-green-700 font-medium">רשות</td>
                    <td className="border border-gray-300 px-3 py-2">יצירת קשר חלופית</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-3 py-2">תאריך שחרור מהצבא</td>
                    <td className="border border-gray-300 px-3 py-2 text-red-600 font-medium">חובה</td>
                    <td className="border border-gray-300 px-3 py-2">בדיקת זמינות לתפקיד</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-300 px-3 py-2">תפקיד בצבא</td>
                    <td className="border border-gray-300 px-3 py-2 text-green-700 font-medium">רשות</td>
                    <td className="border border-gray-300 px-3 py-2">הערכת ניסיון מנהיגות</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-3 py-2">ניסיון הדרכה / הנהגה</td>
                    <td className="border border-gray-300 px-3 py-2 text-red-600 font-medium">חובה</td>
                    <td className="border border-gray-300 px-3 py-2">הערכת התאמה לתפקיד</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-300 px-3 py-2">אזור מועדף, זמינות, רישיון נהיגה</td>
                    <td className="border border-gray-300 px-3 py-2 text-red-600 font-medium">חובה</td>
                    <td className="border border-gray-300 px-3 py-2">התאמה לתפקיד ואזור</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-3 py-2">תשובה חופשית</td>
                    <td className="border border-gray-300 px-3 py-2 text-green-700 font-medium">רשות</td>
                    <td className="border border-gray-300 px-3 py-2">מידע נוסף לפי שיקול דעתך</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-300 px-3 py-2">תאריך ושעת מילוי השאלון</td>
                    <td className="border border-gray-300 px-3 py-2 text-red-600 font-medium">אוטומטי</td>
                    <td className="border border-gray-300 px-3 py-2">רישום ומעקב תהליך גיוס</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">3. למה אנו משתמשים בנתונים (מטרות העיבוד)</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>הערכת התאמתך לתפקיד רכז/ת נוער ורכז/ת סניף</li>
              <li>יצירת קשר לתיאום ראיון עבודה</li>
              <li>העברת פרטיך לרכז/ת האזורי/ת הרלוונטי/ת לצורך ריאיון בלבד</li>
              <li>ניהול תהליך הגיוס הפנימי</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">4. הבסיס החוקי לעיבוד</h2>
            <p>עיבוד המידע מתבצע על בסיס <strong>הסכמתך המפורשת</strong> שניתנת בסיום שאלון הגיוס. ללא הסכמתך, לא יישמרו כל נתוניך.</p>
          </section>

          <section className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h2 className="text-xl font-bold text-gray-900 mb-3">5. תוצאות אי-מסירת המידע</h2>
            <p>
              <strong>מה קורה אם לא תמסור/י מידע?</strong><br />
              שדות החובה (שם פרטי, טלפון, תאריך שחרור) נדרשים לצורך יצירת קשר ובחינת מועמדותך. אי-מסירתם תמנע את הגשת המועמדות. שדות הרשות (שם משפחה, אימייל, תפקיד בצבא, תשובה חופשית) — ניתן לדלג עליהם ללא כל פגיעה בבחינת מועמדותך.
            </p>
            <p className="mt-2">
              <strong>ביטול הסכמה:</strong> אם לא תסכים/י לעיבוד בסיום השאלון, כל המידע שמסרת יימחק לאלתר ולא יישמר.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">6. העברת מידע לצדדים שלישיים</h2>
            <p className="mb-2">המידע שלך <strong>לא יועבר</strong> לגורמים מסחריים חיצוניים. המידע נגיש אך ורק ל:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>רכזים ומנהלים מורשים</strong> של האיחוד החקלאי — לצורך ניהול הגיוס</li>
              <li><strong>רכז/ת אזורי/ת</strong> הרלוונטי/ת לאזורך — לצורך תיאום ראיון</li>
              <li><strong>Supabase (ספק תשתית ענן)</strong> — שרת מסד הנתונים שמאחסן את המידע בצורה מאובטחת, בהתאם לסטנדרטים של GDPR</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">7. כמה זמן שומרים את הנתונים</h2>
            <p>הנתונים יישמרו עד <strong>שנתיים</strong> מתאריך מילוי השאלון, ולאחר מכן יימחקו. ניתן לבקש מחיקה מוקדמת יותר בכל עת.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">8. אבטחת מידע</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>כל התקשורת מוצפנת ב-HTTPS/TLS</li>
              <li>מסד הנתונים מוגן בהצפנה ובמנגנוני Row Level Security (RLS)</li>
              <li>גישה למידע מוגבלת למורשים בלבד באמצעות אימות JWT</li>
              <li>האתר מתארח על Vercel ומסד הנתונים על Supabase — שניהם עם תעודות אבטחה SOC 2</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">9. הזכויות שלך</h2>
            <p className="mb-3">בהתאם לחוק הגנת הפרטיות ותיקון 13, יש לך את הזכויות הבאות:</p>
            <ul className="list-disc list-inside space-y-2">
              <li><strong>עיון:</strong> לבקש לראות את כל הנתונים שנשמרו עליך</li>
              <li><strong>תיקון:</strong> לבקש לתקן נתונים שגויים או לא מדויקים</li>
              <li><strong>מחיקה:</strong> לבקש מחיקת כל הנתונים שלך ממאגר המידע</li>
              <li><strong>ביטול הסכמה:</strong> לבטל את הסכמתך בכל עת — ביטול ההסכמה לא ישפיע על כשרות עיבוד שנעשה לפני הביטול</li>
            </ul>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/delete-request"
                className="inline-block bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
              >
                בקש/י מחיקת הנתונים שלי
              </Link>
              <a
                href="mailto:privacy@haichud.co.il"
                className="inline-block bg-blue-50 text-blue-700 border border-blue-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
              >
                פנה/י לבירורים ועיון
              </a>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">10. דיווח על אירועי אבטחה</h2>
            <p>
              במקרה של פרצת מידע (data breach) שיש בה סיכון ממשי לפרטיות נשואי המידע, האיחוד החקלאי יפעל בהתאם לחובות הדיווח הקבועות בחוק — לרשות להגנת הפרטיות ולנשואי המידע המושפעים, בתוך המועדים הקבועים בחוק.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">11. יצירת קשר</h2>
            <p>לכל שאלה, בקשה או תלונה הנוגעת לפרטיותך, ניתן לפנות אלינו:</p>
            <ul className="mt-2 space-y-1">
              <li>אימייל: <a href="mailto:privacy@haichud.co.il" className="text-blue-600 underline">privacy@haichud.co.il</a></li>
              <li>דרך הרכז/ת האזורי/ת שיצר/ה עמך קשר</li>
            </ul>
            <p className="mt-3 text-sm text-gray-500">
              אם לא קיבלת מענה תוך 30 יום, תוכל/י לפנות ל<a href="https://www.gov.il/he/departments/israel_internet_association" className="text-blue-600 underline" target="_blank" rel="noopener">רשות הגנת הפרטיות</a> בישראל.
            </p>
          </section>

        </div>
      </div>
    </div>
  )
}
