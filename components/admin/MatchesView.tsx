'use client'
import { useState } from 'react'
import { Candidate, OpenPosition, RegionalCoordinator, REGION_LABELS, INTEREST_LEVEL_LABELS, CANDIDATE_STATUS_LABELS } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { createWhatsAppLink, formatDate } from '@/lib/utils'

interface Props {
  candidates: Candidate[]
  positions: OpenPosition[]
  coordinators: RegionalCoordinator[]
}

export function MatchesView({ candidates, positions, coordinators }: Props) {
  const [selectedPos, setSelectedPos] = useState<OpenPosition | null>(null)

  const openPositions = positions.filter(p => p.status === 'open' || p.status === 'in_progress')

  function matchScore(c: Candidate, p: OpenPosition): number {
    let score = c.fit_score ?? 0
    if (c.preferred_region === p.region) score += 15
    if (c.blocked_regions?.includes(p.region)) score -= 50
    if (p.requires_car && !c.has_car) score -= 20
    return Math.min(100, Math.max(0, score))
  }

  const candidatesForPos = selectedPos
    ? [...candidates]
        .map(c => ({ c, score: matchScore(c, selectedPos) }))
        .sort((a, b) => b.score - a.score)
    : []

  async function acceptMatch(c: Candidate, p: OpenPosition) {
    await fetch(`/api/candidates/${c.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'accepted', assigned_region_id: p.region }),
    })
    alert(`${c.full_name} שובצה לתקן ב${p.settlement_name}`)
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">התאמות</h1>
        <p className="text-gray-500 text-sm mt-0.5">בחרי תקן כדי לראות מועמדים מתאימים לפי אזור ועדפות</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Positions list */}
        <div>
          <h2 className="font-bold text-gray-700 mb-3 text-sm">📍 תקנים פתוחים ({openPositions.length})</h2>
          <div className="space-y-2">
            {openPositions.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedPos(prev => prev?.id === p.id ? null : p)}
                className={`w-full text-right rounded-xl border p-4 transition-colors ${selectedPos?.id === p.id ? 'border-brand-400 bg-brand-50' : 'border-gray-200 bg-white hover:border-brand-300'}`}
              >
                <div className="font-bold text-gray-900">{p.settlement_name}</div>
                <div className="text-xs text-gray-500 mt-0.5">{REGION_LABELS[p.region]} · {p.job_scope || '100%'} {p.requires_car ? '· 🚗 נדרש רכב' : ''}</div>
                <div className="text-xs mt-1">
                  <span className={`font-bold px-2 py-0.5 rounded-full ${p.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {p.status === 'open' ? 'פתוח' : 'בתהליך'}
                  </span>
                </div>
              </button>
            ))}
            {openPositions.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-8">אין תקנים פתוחים</p>
            )}
          </div>
        </div>

        {/* Candidates for selected position */}
        <div>
          {selectedPos ? (
            <>
              <h2 className="font-bold text-gray-700 mb-3 text-sm">👥 מועמדים מתאימים ל{selectedPos.settlement_name}</h2>
              {candidatesForPos.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">אין מועמדים חמים כרגע</p>
              ) : (
                <div className="space-y-2">
                  {candidatesForPos.map(({ c, score }) => (
                    <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-bold text-gray-900">{c.full_name}</div>
                          <div className="text-xs text-gray-500">
                            {c.preferred_region ? REGION_LABELS[c.preferred_region] : '—'} ·
                            {c.interest_level ? INTEREST_LEVEL_LABELS[c.interest_level] : '—'} ·
                            שחרור {formatDate(c.release_date)}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {CANDIDATE_STATUS_LABELS[c.status]}
                            {c.has_car ? ' · 🚗' : ''}
                            {c.has_driving_license ? ' · 🪪' : ''}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <a href={createWhatsAppLink(c.phone, `היי ${c.first_name}! 👋\n\nפונה אליך כי היית בעבר בגרעין, ועכשיו כשאתה לקראת שחרור / אחרי שחרור מהצבא, אנחנו בודקים התאמות לתפקידי רכז/ת נוער / רכז/ת סניף.\n\nשאלון קצר ולא מחייב:\n${typeof window !== 'undefined' ? window.location.origin : ''}/questionnaire/${c.candidate_token}\n\nאם זה לא רלוונטי, אפשר להשיב "לא מעוניין" 🙏`)} target="_blank" rel="noopener noreferrer">
                          <Button variant="whatsapp" size="sm">💬 וואטסאפ</Button>
                        </a>
                        <Button size="sm" variant="secondary" onClick={() => acceptMatch(c, selectedPos)}>✅ שבץ</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm py-16">
              <div className="text-center">
                <div className="text-4xl mb-2">🎯</div>
                <p>בחרי תקן מהרשימה</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
