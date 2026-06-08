'use client'
import { useState, useEffect } from 'react'
import { Candidate, RegionalCoordinator, ActivityLogItem, CANDIDATE_STATUS_LABELS, INTEREST_LEVEL_LABELS, REGION_LABELS } from '@/lib/types'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { formatDate, formatDateTime, createWhatsAppLink } from '@/lib/utils'

interface Props {
  candidate: Candidate
  coordinators: RegionalCoordinator[]
  onClose: () => void
  onUpdate: (c: Candidate) => void
}

const USER_TYPE_LABELS: Record<ActivityLogItem['user_type'], string> = {
  admin: 'מנהל',
  coordinator: 'רכזת',
  candidate: 'מועמד/ת',
  system: 'מערכת',
}

const USER_TYPE_COLORS: Record<ActivityLogItem['user_type'], string> = {
  admin: 'bg-purple-100 text-purple-700',
  coordinator: 'bg-brand-100 text-brand-700',
  candidate: 'bg-green-100 text-green-700',
  system: 'bg-gray-100 text-gray-600',
}

export function CandidateDetailModal({ candidate, coordinators, onClose, onUpdate }: Props) {
  const [tab, setTab] = useState<'info' | 'notes' | 'history'>('info')
  const [notes, setNotes] = useState(candidate.notes || '')
  const [status, setStatus] = useState(candidate.status)
  const [assignedCoord, setAssignedCoord] = useState(candidate.assigned_coordinator_id || '')
  const [saving, setSaving] = useState(false)
  const [activity, setActivity] = useState<ActivityLogItem[]>([])
  const [activityLoading, setActivityLoading] = useState(false)
  const [activityLoaded, setActivityLoaded] = useState(false)

  useEffect(() => {
    if (tab === 'history' && !activityLoaded) {
      setActivityLoading(true)
      fetch(`/api/candidates/${candidate.id}`)
        .then(r => r.json())
        .then(data => {
          setActivity(Array.isArray(data.activity) ? data.activity : [])
          setActivityLoaded(true)
        })
        .catch(() => setActivity([]))
        .finally(() => setActivityLoading(false))
    }
  }, [tab, activityLoaded, candidate.id])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/candidates/${candidate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes, status, assigned_coordinator_id: assignedCoord || undefined }),
      })
      if (res.ok) {
        const updated = await res.json()
        onUpdate(updated)
      }
    } finally {
      setSaving(false)
    }
  }

  const APP_URL = typeof window !== 'undefined' ? window.location.origin : ''
  const questionnaireLink = `${APP_URL}/questionnaire/${candidate.candidate_token}`
  const waMessage = `היי ${candidate.first_name}! 👋

פונה אליך כי היית בעבר בגרעין, ועכשיו כשאתה לקראת שחרור / אחרי שחרור מהצבא, אנחנו בודקים התאמות לתפקידי רכז/ת נוער / רכז/ת סניף.

זה שאלון קצר ולא מחייב שיעזור לנו להבין:
• אם זה מעניין אותך
• מתי נכון לדבר איתך
• איזה אזור בארץ רלוונטי לך

לשאלון:
${questionnaireLink}

אם זה לא רלוונטי, אפשר להשיב "לא מעוניין" 🙏`
  const wa = createWhatsAppLink(candidate.phone, waMessage)

  return (
    <Modal isOpen onClose={onClose} title={candidate.full_name} size="lg">
      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {(['info', 'notes', 'history'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-white shadow text-brand-700' : 'text-gray-600 hover:text-gray-800'}`}
          >
            {{ info: 'מידע', notes: 'הערות', history: 'היסטוריה' }[t]}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <div className="space-y-4">
          {/* Score + interest row */}
          <div className="flex gap-3">
            <div className="flex-1 bg-brand-50 border border-brand-200 rounded-xl p-4 text-center">
              <div className="text-3xl font-black text-brand-700">{candidate.fit_score ?? '—'}</div>
              <div className="text-xs text-brand-600 mt-0.5">ציון התאמה</div>
            </div>
            <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
              <div className="text-sm font-bold text-gray-800">{candidate.interest_level ? INTEREST_LEVEL_LABELS[candidate.interest_level] : '—'}</div>
              <div className="text-xs text-gray-500 mt-0.5">רמת עניין</div>
            </div>
            <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
              <div className="text-sm font-bold text-gray-800">{formatDate(candidate.recommended_contact_date)}</div>
              <div className="text-xs text-gray-500 mt-0.5">פנייה מומלצת</div>
            </div>
          </div>

          {/* Basic info */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <InfoRow label="טלפון" value={<a href={`tel:${candidate.phone}`} className="text-brand-700 hover:underline">{candidate.phone}</a>} />
            <InfoRow label="אימייל" value={candidate.email || '—'} />
            <InfoRow label="גרעין" value={candidate.garin || '—'} />
            <InfoRow label="שנת גרעין" value={candidate.garin_year || '—'} />
            <InfoRow label="תפקיד בצבא" value={candidate.army_role || '—'} />
            <InfoRow label="שחרור" value={formatDate(candidate.release_date)} />
            <InfoRow label="אזור מועדף" value={candidate.preferred_region ? REGION_LABELS[candidate.preferred_region] : '—'} />
            <InfoRow label="רישיון נהיגה" value={candidate.has_driving_license ? '✅ כן' : '❌ לא'} />
            <InfoRow label="רכב" value={candidate.has_car ? '✅ כן' : '❌ לא'} />
            <InfoRow label="ניסיון הדרכה" value={candidate.guidance_experience ? '✅ כן' : '❌ לא'} />
            <InfoRow label="ניסיון הנהגה" value={candidate.leadership_experience ? '✅ כן' : '❌ לא'} />
            <InfoRow label="נרשם" value={formatDateTime(candidate.created_at)} />
          </div>

          {/* Assign + status */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Select
              label="סטטוס"
              options={Object.entries(CANDIDATE_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))}
              value={status}
              onChange={e => setStatus(e.target.value as any)}
            />
            <Select
              label="רכזת אזורית"
              options={coordinators.map(c => ({ value: c.id, label: `${c.name} – ${REGION_LABELS[c.region]}` }))}
              value={assignedCoord}
              onChange={e => setAssignedCoord(e.target.value)}
              placeholder="לא שובצה"
            />
          </div>

          {/* Fit reason */}
          {candidate.fit_reason && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
              <strong className="block mb-1">נימוק ציון:</strong>
              {candidate.fit_reason}
            </div>
          )}
        </div>
      )}

      {tab === 'notes' && (
        <div className="space-y-4">
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={8}
            className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
            placeholder="הערות פנימיות על המועמד/ת..."
          />
        </div>
      )}

      {tab === 'history' && (
        <div className="min-h-[12rem]">
          {activityLoading && (
            <div className="text-sm text-gray-400 text-center py-8">
              <div className="text-2xl mb-2">⏳</div>
              <p>טוען היסטוריה...</p>
            </div>
          )}
          {!activityLoading && activity.length === 0 && (
            <div className="text-sm text-gray-500 text-center py-8">
              <div className="text-3xl mb-2">📋</div>
              <p>אין פעולות רשומות עדיין</p>
            </div>
          )}
          {!activityLoading && activity.length > 0 && (
            <ol className="relative border-r border-gray-200 space-y-4 pr-5 py-1">
              {activity.map(item => (
                <li key={item.id} className="relative">
                  <span className="absolute -right-[1.1rem] top-1 w-3.5 h-3.5 rounded-full bg-brand-400 border-2 border-white block" />
                  <div className="flex items-start gap-2 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${USER_TYPE_COLORS[item.user_type]}`}>
                      {USER_TYPE_LABELS[item.user_type]}
                    </span>
                    <span className="text-sm text-gray-800 font-medium flex-1">{item.action}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(item.created_at)}</p>
                  {item.details && Object.keys(item.details).length > 0 && (
                    <p className="text-xs text-gray-500 mt-0.5 break-words">
                      {Object.entries(item.details)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(' | ')}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center gap-2 mt-6 pt-4 border-t border-gray-100">
        <Button onClick={handleSave} loading={saving}>💾 שמור</Button>
        <a href={wa} target="_blank" rel="noopener noreferrer">
          <Button variant="whatsapp" type="button">💬 וואטסאפ</Button>
        </a>
        <div className="flex-1" />
        <Button variant="secondary" onClick={onClose}>סגור</Button>
      </div>
    </Modal>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span className="text-gray-500 text-xs">{label}: </span>
      <span className="font-medium text-gray-800">{value}</span>
    </div>
  )
}
