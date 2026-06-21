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
        <p className="text-gray-500 text-sm mb-8">עדכון אחרון: יוני 2025</p>

        <div className="space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">מי אנחנו</h2>
            <p>האיחוד החקלאי הוא הגוף האחראי לאיסוף ועיבוד הנתונים שתמסור/י בשאלון הגיוס. ניתן לפנות אלינו בכל עניין הנוגע לפרטיותך.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">אילו נתונים אנו אוספים</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>שם מלא ומספר טלפון</li>
              <li>כתובת אימייל (אם סופקה)</li>
              <li>תשובות לשאלות השאלון (ניסיון, זמינות, העדפות אזור וכדומה)</li>
              <li>תאריך ושעת מילוי השאלון</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">למה אנו משתמשים בנתונים</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>הערכת התאמה לתפקיד רכז/ת נוער</li>
              <li>יצירת קשר לצורך תיאום ראיון</li>
              <li>העברת פרטים לרכז/ת האזורי/ת הרלוונטי/ת</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">כמה זמן שומרים את הנתונים</h2>
            <p>הנתונים יישמרו עד שנתיים מתאריך מילוי השאלון, ולאחר מכן יימחקו. ניתן לבקש מחיקה מוקדמת יותר בכל עת.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">שיתוף עם צדדים שלישיים</h2>
            <p>הנתונים שלך <strong>לא יועברו</strong> לגורמים מסחריים חיצוניים. הנתונים נגישים בלבד לרכזים ומנהלים מורשים של האיחוד החקלאי.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">הזכויות שלך</h2>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>עיון:</strong> תוכל/י לבקש לראות את הנתונים שנשמרו עליך</li>
              <li><strong>תיקון:</strong> תוכל/י לבקש לתקן נתונים שגויים</li>
              <li><strong>מחיקה:</strong> תוכל/י לבקש מחיקת כל הנתונים שלך</li>
            </ul>
            <div className="mt-4">
              <Link
                href="/delete-request"
                className="inline-block bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
              >
                בקש/י מחיקת הנתונים שלי
              </Link>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">יצירת קשר</h2>
            <p>לכל שאלה בנוגע לפרטיותך, ניתן לפנות אלינו דרך הרכז/ת האזורי/ת שיצר/ה עמך קשר.</p>
          </section>

        </div>
      </div>
    </div>
  )
}
