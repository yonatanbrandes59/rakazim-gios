'use client'

import { useState, useEffect } from 'react'

interface Insights {
  headline: {
    total: number
    completionRate: number
    acceptanceRate: number
    avgFitScore: number
    unassigned: number
    optedOut: number
  }
  funnel: Array<{ key: string; label: string; count: number }>
  byRegion: Array<{ region: string; label: string; count: number; completed: number; accepted: number }>
  byInterest: Array<{ level: string; label: string; count: number }>
  byGarinYear: Array<{ year: string; count: number }>
  coordinatorPerformance: Array<{ id: string; name: string; assigned: number; contacted: number; accepted: number }>
  generatedAt: string
}

const FUNNEL_COLORS = [
  'bg-brand-600', 'bg-brand-500', 'bg-sky-500', 'bg-indigo-500', 'bg-amber-500', 'bg-green-600',
]

function StatCard({ label, value, suffix, tone }: { label: string; value: number | string; suffix?: string; tone?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="text-xs text-gray-500 font-medium">{label}</div>
      <div className={`text-2xl font-black mt-1 ${tone ?? 'text-gray-900'}`}>
        {value}{suffix && <span className="text-base font-bold text-gray-400 mr-0.5">{suffix}</span>}
      </div>
    </div>
  )
}

export function InsightsView() {
  const [data, setData] = useState<Insights | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/insights')
        if (!res.ok) {
          setError(res.status === 403 ? 'אין הרשאה לצפייה בנתונים' : 'שגיאה בטעינת הנתונים')
          return
        }
        setData(await res.json() as Insights)
      } catch {
        setError('שגיאת רשת')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) {
    return <div className="p-8 text-center text-gray-400" dir="rtl">טוען נתונים…</div>
  }
  if (error || !data) {
    return <div className="p-8 text-center text-red-500" dir="rtl">{error ?? 'אין נתונים'}</div>
  }

  const funnelMax = Math.max(...data.funnel.map(f => f.count), 1)
  const regionMax = Math.max(...data.byRegion.map(r => r.count), 1)
  const interestMax = Math.max(...data.byInterest.map(i => i.count), 1)
  const yearMax = Math.max(...data.byGarinYear.map(y => y.count), 1)

  return (
    <div className="space-y-6 max-w-5xl" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">תובנות וניתוח</h1>
        <p className="text-gray-500 mt-1">תמונת מצב על כל מסע הגיוס — מהרשמה ועד קבלה.</p>
      </div>

      {/* Headline cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard label="סה״כ מועמדים" value={data.headline.total} />
        <StatCard label="אחוז השלמת שאלון" value={data.headline.completionRate} suffix="%" tone="text-indigo-600" />
        <StatCard label="אחוז קבלה" value={data.headline.acceptanceRate} suffix="%" tone="text-green-600" />
        <StatCard label="ציון התאמה ממוצע" value={data.headline.avgFitScore} suffix="/100" tone="text-brand-600" />
        <StatCard label="ממתינים לשיבוץ" value={data.headline.unassigned} tone="text-amber-600" />
        <StatCard label="הוסרו מהרשימה" value={data.headline.optedOut} tone="text-rose-500" />
      </div>

      {/* Funnel */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-bold text-gray-800 mb-4">משפך הגיוס</h2>
        <div className="space-y-2.5">
          {data.funnel.map((stage, i) => {
            const pct = Math.round((stage.count / funnelMax) * 100)
            const prevCount = i > 0 ? data.funnel[i - 1].count : stage.count
            const dropPct = prevCount > 0 ? Math.round((stage.count / prevCount) * 100) : 100
            return (
              <div key={stage.key} className="flex items-center gap-3">
                <div className="w-24 text-sm text-gray-600 shrink-0 text-left">{stage.label}</div>
                <div className="flex-1 bg-gray-100 rounded-lg h-8 overflow-hidden relative">
                  <div
                    className={`h-full ${FUNNEL_COLORS[i % FUNNEL_COLORS.length]} rounded-lg transition-all flex items-center px-2`}
                    style={{ width: `${Math.max(pct, 6)}%` }}
                  >
                    <span className="text-white text-xs font-bold">{stage.count}</span>
                  </div>
                </div>
                {i > 0 && (
                  <div className="w-12 text-xs text-gray-400 shrink-0">{dropPct}%</div>
                )}
                {i === 0 && <div className="w-12 shrink-0" />}
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* By region */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-800 mb-4">לפי אזור</h2>
          {data.byRegion.length === 0 ? (
            <p className="text-sm text-gray-400">אין נתונים</p>
          ) : (
            <div className="space-y-2.5">
              {data.byRegion.map(r => (
                <div key={r.region} className="flex items-center gap-3">
                  <div className="w-24 text-sm text-gray-600 shrink-0 text-left truncate">{r.label}</div>
                  <div className="flex-1 bg-gray-100 rounded-lg h-6 overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-lg flex items-center px-2" style={{ width: `${Math.max((r.count / regionMax) * 100, 8)}%` }}>
                      <span className="text-white text-xs font-bold">{r.count}</span>
                    </div>
                  </div>
                  <div className="w-16 text-xs text-gray-400 shrink-0">✓{r.completed} · ✅{r.accepted}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* By interest */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-800 mb-4">לפי רמת עניין</h2>
          {data.byInterest.length === 0 ? (
            <p className="text-sm text-gray-400">אין נתונים</p>
          ) : (
            <div className="space-y-2.5">
              {data.byInterest.map(it => (
                <div key={it.level} className="flex items-center gap-3">
                  <div className="w-28 text-sm text-gray-600 shrink-0 text-left truncate">{it.label}</div>
                  <div className="flex-1 bg-gray-100 rounded-lg h-6 overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-lg flex items-center px-2" style={{ width: `${Math.max((it.count / interestMax) * 100, 8)}%` }}>
                      <span className="text-white text-xs font-bold">{it.count}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* By garin year */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-bold text-gray-800 mb-4">לפי שנת גרעין (מקור)</h2>
        {data.byGarinYear.length === 0 ? (
          <p className="text-sm text-gray-400">אין נתונים</p>
        ) : (
          <div className="flex items-end gap-3 h-40">
            {data.byGarinYear.map(y => (
              <div key={y.year} className="flex-1 flex flex-col items-center justify-end gap-1">
                <span className="text-xs font-bold text-gray-700">{y.count}</span>
                <div className="w-full bg-sky-500 rounded-t-lg transition-all" style={{ height: `${Math.max((y.count / yearMax) * 100, 4)}%` }} />
                <span className="text-xs text-gray-500">{y.year}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Coordinator performance */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-bold text-gray-800 mb-4">ביצועי רכזים</h2>
        {data.coordinatorPerformance.length === 0 ? (
          <p className="text-sm text-gray-400">אין מועמדים משובצים עדיין</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-gray-100">
                  <th className="text-right font-medium py-2 px-2">רכז/ת</th>
                  <th className="text-center font-medium py-2 px-2">משובצים</th>
                  <th className="text-center font-medium py-2 px-2">נוצר קשר</th>
                  <th className="text-center font-medium py-2 px-2">התקבלו</th>
                  <th className="text-center font-medium py-2 px-2">יחס המרה</th>
                </tr>
              </thead>
              <tbody>
                {data.coordinatorPerformance.map(c => {
                  const conv = c.assigned > 0 ? Math.round((c.accepted / c.assigned) * 100) : 0
                  return (
                    <tr key={c.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-2.5 px-2 font-medium text-gray-800">{c.name}</td>
                      <td className="py-2.5 px-2 text-center text-gray-600">{c.assigned}</td>
                      <td className="py-2.5 px-2 text-center text-gray-600">{c.contacted}</td>
                      <td className="py-2.5 px-2 text-center text-green-600 font-bold">{c.accepted}</td>
                      <td className="py-2.5 px-2 text-center">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${conv >= 30 ? 'bg-green-100 text-green-700' : conv >= 10 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                          {conv}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center">
        עודכן: {new Date(data.generatedAt).toLocaleString('he-IL')}
      </p>
    </div>
  )
}
