'use client'
import { useState, useMemo } from 'react'
import { Candidate, OpenPosition, CoordinatorUser, CANDIDATE_STATUS_LABELS, CANDIDATE_STATUS_COLORS, INTEREST_LEVEL_LABELS, REGION_LABELS } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatDate, createWhatsAppLink } from '@/lib/utils'
import { useRouter } from 'next/navigation'

interface Props {
  user: CoordinatorUser
  candidates: Candidate[]
  positions: OpenPosition[]
}

export function RegionDashboardClient({ user, candidates, positions }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!search) return candidates
    const q = search.toLowerCase()
    return candidates.filter(c =>
      c.full_name.toLowerCase().includes(q) || c.phone.includes(q) || (c.garin || '').toLowerCase().includes(q)
    )
  }, [candidates, search])

  async function logout() {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/region/login')
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/candidates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    router.refresh()
  }

  const stats = {
    total: candidates.length,
    hot: candidates.filter(c => c.interest_level === 'very_hot' || c.interest_level === 'interested').length,
    pending: candidates.filter(c => c.status === 'contact_pending' || c.status === 'questionnaire_completed').length,
    openPositions: positions.filter(p => p.status === 'open').length,
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-brand-800 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🗺️</span>
          <div>
            <div className="font-black">רכזים בדרך</div>
            <div className="text-brand-300 text-xs">אזור: {REGION_LABELS[user.region]} · {user.name}</div>
          </div>
        </div>
        <button onClick={logout} className="text-brand-300 hover:text-white text-sm transition-colors">יציאה 🚪</button>
      </header>

      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'מועמדים', value: stats.total, color: 'bg-white border-gray-200' },
            { label: 'חמים', value: stats.hot, color: 'bg-red-50 border-red-200' },
            { label: 'לטיפול', value: stats.pending, color: 'bg-amber-50 border-amber-200' },
            { label: 'תקנים פתוחים', value: stats.openPositions, color: 'bg-green-50 border-green-200' },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl border p-3 text-center ${s.color}`}>
              <p className="text-2xl font-black text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-600">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Positions */}
        {positions.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <h2 className="font-bold text-gray-800 mb-3">📍 תקנים באזורי ({positions.length})</h2>
            <div className="flex flex-wrap gap-2">
              {positions.map(p => (
                <span key={p.id} className={`text-xs px-3 py-1.5 rounded-full font-medium ${p.status === 'open' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                  {p.settlement_name} · {p.job_scope || '100%'}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <Input placeholder="🔍 חיפוש מועמד..." value={search} onChange={e => setSearch(e.target.value)} />

        {/* Candidates */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-2">📭</div>
              <p>אין מועמדים לאזורך כרגע</p>
            </div>
          ) : (
            filtered.map(c => (
              <div key={c.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <button
                  className="w-full text-right px-5 py-4 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                  onClick={() => setExpanded(prev => prev === c.id ? null : c.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900">{c.full_name}</div>
                    <div className="text-xs text-gray-500">
                      {c.garin ? `${c.garin} · ` : ''}
                      שחרור {formatDate(c.release_date)}
                      {c.interest_level ? ` · ${INTEREST_LEVEL_LABELS[c.interest_level]}` : ''}
                    </div>
                  </div>
                  <div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${CANDIDATE_STATUS_COLORS[c.status]}`}>
                      {CANDIDATE_STATUS_LABELS[c.status]}
                    </span>
                  </div>
                  <span className="text-gray-400">{expanded === c.id ? '▲' : '▼'}</span>
                </button>

                {expanded === c.id && (
                  <div className="px-5 pb-4 border-t border-gray-100 pt-4 space-y-3">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <InfoRow label="טלפון" value={c.phone} />
                      <InfoRow label="אימייל" value={c.email || '—'} />
                      <InfoRow label="רישיון" value={c.has_driving_license ? '✅' : '❌'} />
                      <InfoRow label="רכב" value={c.has_car ? '✅' : '❌'} />
                      <InfoRow label="פנייה" value={formatDate(c.recommended_contact_date)} />
                      <InfoRow label="אזור מבוקש" value={c.preferred_region ? REGION_LABELS[c.preferred_region] : '—'} />
                    </div>
                    {c.notes && (
                      <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600">{c.notes}</div>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      <a href={createWhatsAppLink(c.phone, `היי ${c.first_name}! 👋 אני ${user.name}, רכזת באזור ${REGION_LABELS[user.region]}`)} target="_blank" rel="noopener noreferrer">
                        <Button variant="whatsapp" size="sm">💬 וואטסאפ</Button>
                      </a>
                      <Button size="sm" variant="secondary" onClick={() => updateStatus(c.id, 'contacted')}>✅ יצרתי קשר</Button>
                      <Button size="sm" variant="secondary" onClick={() => updateStatus(c.id, 'call_scheduled')}>📅 נקבעה שיחה</Button>
                      <Button size="sm" variant="secondary" onClick={() => updateStatus(c.id, 'follow_up_later')}>⏳ מעקב עתידי</Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span className="text-gray-400 text-xs">{label}: </span>
      <span className="font-medium text-gray-700">{value}</span>
    </div>
  )
}
