'use client'

import { useState, useEffect, useCallback } from 'react'

type CheckState = 'ok' | 'warn' | 'missing'

interface Check {
  key: string
  label: string
  state: CheckState
  detail: string
  envVars: string[]
}

interface StatusResponse {
  checks: Check[]
  summary: { ok: number; warn: number; missing: number; total: number }
  generatedAt: string
}

const STATE_STYLES: Record<CheckState, { dot: string; badge: string; badgeText: string }> = {
  ok:      { dot: 'bg-green-500',              badge: 'bg-green-50 text-green-700',  badgeText: 'פעיל' },
  warn:    { dot: 'bg-yellow-400 animate-pulse', badge: 'bg-yellow-50 text-yellow-700', badgeText: 'חלקי' },
  missing: { dot: 'bg-gray-300',               badge: 'bg-gray-100 text-gray-500',   badgeText: 'לא מוגדר' },
}

export function SystemStatusView() {
  const [data, setData] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/system/status')
      if (!res.ok) {
        setError(res.status === 403 ? 'אין הרשאה' : 'שגיאה בטעינת הסטטוס')
        return
      }
      setData(await res.json() as StatusResponse)
    } catch {
      setError('שגיאת רשת')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchStatus() }, [fetchStatus])

  return (
    <div className="max-w-3xl space-y-6" dir="rtl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">מצב המערכת</h1>
          <p className="text-gray-500 mt-1">
            כל החיבורים והאינטגרציות במבט אחד — מה פעיל, מה חסר, ומה צריך כדי להדליק.
          </p>
        </div>
        <button
          onClick={fetchStatus}
          disabled={loading}
          className="text-sm px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors shrink-0 disabled:opacity-50"
        >
          {loading ? '...' : '🔄 רענן'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
      )}

      {loading && !data && (
        <div className="text-center text-gray-400 py-12">בודק את כל החיבורים…</div>
      )}

      {data && (
        <>
          {/* Summary strip */}
          <div className="flex gap-3">
            <div className="flex-1 bg-green-50 border border-green-100 rounded-2xl p-4 text-center">
              <div className="text-2xl font-black text-green-600">{data.summary.ok}</div>
              <div className="text-xs text-green-700 mt-0.5">פעילים</div>
            </div>
            <div className="flex-1 bg-yellow-50 border border-yellow-100 rounded-2xl p-4 text-center">
              <div className="text-2xl font-black text-yellow-600">{data.summary.warn}</div>
              <div className="text-xs text-yellow-700 mt-0.5">חלקיים</div>
            </div>
            <div className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center">
              <div className="text-2xl font-black text-gray-500">{data.summary.missing}</div>
              <div className="text-xs text-gray-500 mt-0.5">לא מוגדרים</div>
            </div>
          </div>

          {/* Checks */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {data.checks.map(check => {
              const s = STATE_STYLES[check.state]
              return (
                <div key={check.key} className="px-5 py-4 flex items-start gap-3">
                  <div className={`w-3 h-3 rounded-full mt-1.5 shrink-0 ${s.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-800">{check.label}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.badge}`}>
                        {s.badgeText}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{check.detail}</p>
                    {check.state !== 'ok' && (
                      <p className="text-xs text-gray-400 mt-1.5 font-mono" dir="ltr">
                        {check.envVars.join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* How to activate */}
          <div className="bg-brand-50 border border-brand-100 rounded-2xl p-5">
            <h2 className="font-bold text-brand-900 mb-2">💡 איך מדליקים רכיב?</h2>
            <p className="text-sm text-brand-800 leading-relaxed">
              כל רכיב שמסומן &quot;לא מוגדר&quot; צריך משתנה סביבה אחד או יותר (מוצגים באפור מתחתיו).
              מוסיפים אותם ב-Vercel ← Settings ← Environment Variables, עושים Redeploy —
              והנורה כאן נדלקת ירוק. <strong>אין צורך לגעת בקוד.</strong>
            </p>
          </div>

          <p className="text-xs text-gray-400 text-center">
            נבדק: {new Date(data.generatedAt).toLocaleString('he-IL')}
          </p>
        </>
      )}
    </div>
  )
}
