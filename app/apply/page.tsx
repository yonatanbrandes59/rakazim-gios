import Link from 'next/link'
import Image from 'next/image'

export const metadata = {
  title: 'הצטרף/י לצוות הרכזים – האיחוד החקלאי',
  description: 'הגש/י מועמדות לתפקיד רכז/ת נוער באיחוד החקלאי',
}

export default function ApplyLandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-800 via-brand-700 to-blue-600 flex flex-col items-center justify-center p-6" dir="rtl">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center">
          <Image src="/logo.png" alt="האיחוד החקלאי" width={72} height={72} className="mx-auto rounded-full bg-white p-1 shadow-lg mb-4" />
          <h1 className="text-white text-3xl font-black">האיחוד החקלאי</h1>
          <p className="text-blue-200 mt-2">גיוס רכזי ורכזות נוער</p>
        </div>

        {/* Cards */}
        <div className="space-y-4">
          <Link href="/apply/garin" className="block bg-white rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.99]">
            <div className="text-4xl mb-3">🌾</div>
            <h2 className="text-xl font-black text-gray-900">הייתי בגרעין</h2>
            <p className="text-gray-500 text-sm mt-1">בוגר/ת גרעין חקלאי שמשתחרר/ת מהצבא</p>
            <div className="mt-4 bg-brand-600 text-white text-sm font-bold px-4 py-2 rounded-xl inline-block">
              התחל/י שאלון ←
            </div>
          </Link>

          <Link href="/apply/open" className="block bg-white rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.99]">
            <div className="text-4xl mb-3">👋</div>
            <h2 className="text-xl font-black text-gray-900">לא הייתי בגרעין</h2>
            <p className="text-gray-500 text-sm mt-1">מעוניין/ת בתפקיד רכז/ת נוער בקיבוץ / מושב</p>
            <div className="mt-4 bg-brand-600 text-white text-sm font-bold px-4 py-2 rounded-xl inline-block">
              התחל/י שאלון ←
            </div>
          </Link>
        </div>

        <p className="text-white/40 text-xs text-center">
          <Link href="/privacy" className="underline hover:text-white/60">מדיניות פרטיות</Link>
        </p>
      </div>
    </div>
  )
}
