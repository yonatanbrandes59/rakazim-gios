'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function DeleteRequestPage() {
  const [phone, setPhone] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!phone.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/candidates/delete-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'שגיאה')
      }
      setSubmitted(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
        <div className="mb-6">
          <Link href="/privacy" className="text-blue-600 text-sm hover:underline">← מדיניות פרטיות</Link>
        </div>

        {submitted ? (
          <div className="text-center">
            <div className="text-4xl mb-4">✅</div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">הבקשה התקבלה</h1>
            <p className="text-gray-600 text-sm">בקשת המחיקה שלך נשלחה. הנתונים יימחקו תוך 30 יום עסקיים.</p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">בקשת מחיקת נתונים</h1>
            <p className="text-gray-600 text-sm mb-6">הכנס/י את מספר הטלפון שמסרת בשאלון ואנחנו נמחק את כל הנתונים שלך.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">מספר טלפון</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="05X-XXXXXXX"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  dir="ltr"
                  required
                />
              </div>

              {error && <p className="text-red-600 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={loading || !phone.trim()}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-lg text-sm disabled:opacity-50 transition-colors"
              >
                {loading ? 'שולח...' : 'שלח בקשת מחיקה'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
