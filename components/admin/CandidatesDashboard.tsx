'use client'
import { useState, useMemo } from 'react'
import { Candidate, RegionalCoordinator, CANDIDATE_STATUS_LABELS, CANDIDATE_STATUS_COLORS, INTEREST_LEVEL_LABELS, REGION_LABELS } from '@/lib/types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { formatDate, createWhatsAppLink } from '@/lib/utils'
import { CandidateDetailModal } from './CandidateDetailModal'
import { AddCandidateModal } from './AddCandidateModal'
import { CsvUploadModal } from './CsvUploadModal'

interface Props {
  initialCandidates: Candidate[]
  coordinators: RegionalCoordinator[]
  stats: { total: number; hot: number; completed: number; pending_contact: number; new_this_week: number }
}

const INTEREST_BADGE_COLORS: Record<string, string> = {
  very_hot: 'bg-red-100 text-red-800',
  interested: 'bg-green-100 text-green-800',
  needs_explanation: 'bg-yellow-100 text-yellow-800',
  keep_warm: 'bg-orange-100 text-orange-800',
  future: 'bg-blue-100 text-blue-800',
  not_relevant_now: 'bg-gray-100 text-gray-600',
  not_interested: 'bg-gray-200 text-gray-500',
}

export function CandidatesDashboard({ initialCandidates, coordinators, stats }: Props) {
  const [candidates, setCandidates] = useState(initialCandidates)
  const [selected, setSelected] = useState<Candidate | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showCsv, setShowCsv] = useState(false)
  const [sending, setSending] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Filters
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterRegion, setFilterRegion] = useState('')
  const [filterInterest, setFilterInterest] = useState('')

  const filtered = useMemo(() => {
    let list = candidates
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        c.full_name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.garin || '').toLowerCase().includes(q)
      )
    }
    if (filterStatus) list = list.filter(c => c.status === filterStatus)
    if (filterRegion) list = list.filter(c => c.preferred_region === filterRegion)
    if (filterInterest) list = list.filter(c => c.interest_level === filterInterest)
    return list
  }, [candidates, search, filterStatus, filterRegion, filterInterest])

  async function handleSendOpening() {
    if (selectedIds.size === 0) { alert('בחרי מועמדים לפני שליחה'); return }
    setSending(true)
    try {
      await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_opening', candidate_ids: Array.from(selectedIds) }),
      })
      alert(`✅ הועבר בהצלחה: ${selectedIds.size} הודעות. לחץ "פתח בוואטסאפ" בדשבורד ההודעות לשליחה.`)
      setSelectedIds(new Set())
    } finally {
      setSending(false)
    }
  }

  function toggleSelect(id: string) {
    const next = new Set(selectedIds)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelectedIds(next)
  }

  function toggleSelectAll() {
    setSelectedIds(selectedIds.size === filtered.length ? new Set<string>() : new Set<string>(filtered.map(c => c.id)))
  }

  const refreshCandidates = async () => {
    const res = await fetch('/api/candidates')
    if (res.ok) setCandidates(await res.json())
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">מועמדים</h1>
          <p className="text-gray-500 text-sm mt-0.5">ניהול וסינון מועמדים לתפקיד רכז/ת נוער / רכז/ת סניף</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowCsv(true)}>📤 ייבוא CSV</Button>
          <Button onClick={() => setShowAdd(true)}>+ הוסף מועמד</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'סה״כ מועמדים', value: stats.total, color: 'bg-white border border-gray-200' },
          { label: 'חדשים השבוע', value: stats.new_this_week, color: 'bg-blue-50 border border-blue-200' },
          { label: 'סיימו שאלון', value: stats.completed, color: 'bg-indigo-50 border border-indigo-200' },
          { label: 'חמים עכשיו', value: stats.hot, color: 'bg-red-50 border border-red-200' },
          { label: 'ממתינים לפנייה', value: stats.pending_contact, color: 'bg-amber-50 border border-amber-200' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl p-4 ${s.color}`}>
            <p className="text-2xl font-black text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-600 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="🔍 חיפוש שם, טלפון, גרעין..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select
          options={Object.entries(CANDIDATE_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))}
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          placeholder="כל הסטטוסים"
          className="w-44"
        />
        <Select
          options={Object.entries(REGION_LABELS).map(([v, l]) => ({ value: v, label: l }))}
          value={filterRegion}
          onChange={e => setFilterRegion(e.target.value)}
          placeholder="כל האזורים"
          className="w-44"
        />
        <Select
          options={Object.entries(INTEREST_LEVEL_LABELS).map(([v, l]) => ({ value: v, label: l }))}
          value={filterInterest}
          onChange={e => setFilterInterest(e.target.value)}
          placeholder="רמת עניין"
          className="w-44"
        />
        {selectedIds.size > 0 && (
          <Button variant="whatsapp" onClick={handleSendOpening} loading={sending}>
            📤 שלח שאלון ({selectedIds.size})
          </Button>
        )}
        <a href="/api/candidates?format=csv" className="text-sm text-brand-700 hover:underline self-center">
          ⬇️ ייצוא
        </a>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <div className="text-4xl mb-3">📭</div>
            <p>לא נמצאו מועמדים</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-right">
                    <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} className="rounded" />
                  </th>
                  <th className="px-4 py-3 text-right">שם</th>
                  <th className="px-4 py-3 text-right">טלפון</th>
                  <th className="px-4 py-3 text-right">גרעין</th>
                  <th className="px-4 py-3 text-right">שחרור</th>
                  <th className="px-4 py-3 text-right">אזור</th>
                  <th className="px-4 py-3 text-right">עניין</th>
                  <th className="px-4 py-3 text-right">פנייה</th>
                  <th className="px-4 py-3 text-right">סטטוס</th>
                  <th className="px-4 py-3 text-right">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr
                    key={c.id}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setSelected(c)}
                  >
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} className="rounded" />
                    </td>
                    <td className="px-4 py-3 font-semibold text-brand-800 whitespace-nowrap">{c.full_name}</td>
                    <td className="px-4 py-3 text-gray-600 ltr text-right">{c.phone}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[100px] truncate">{c.garin || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(c.release_date)}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{c.preferred_region ? REGION_LABELS[c.preferred_region] : '—'}</td>
                    <td className="px-4 py-3">
                      {c.interest_level ? (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${INTEREST_BADGE_COLORS[c.interest_level] || 'bg-gray-100 text-gray-600'}`}>
                          {INTEREST_LEVEL_LABELS[c.interest_level]}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">{formatDate(c.recommended_contact_date)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${CANDIDATE_STATUS_COLORS[c.status]}`}>
                        {CANDIDATE_STATUS_LABELS[c.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <a
                        href={createWhatsAppLink(c.phone, `היי ${c.first_name}! 👋\n\nפונה אליך כי היית בעבר בגרעין, ועכשיו כשאתה לקראת שחרור / אחרי שחרור מהצבא, אנחנו בודקים התאמות לתפקידי רכז/ת נוער / רכז/ת סניף.\n\nשאלון קצר ולא מחייב:\n${window.location.origin}/questionnaire/${c.candidate_token}\n\nאם זה לא רלוונטי, אפשר להשיב "לא מעוניין" 🙏`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 hover:text-green-700 text-lg"
                        title="פתח בוואטסאפ"
                      >💬</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {selected && (
        <CandidateDetailModal
          candidate={selected}
          coordinators={coordinators}
          onClose={() => setSelected(null)}
          onUpdate={updated => {
            setCandidates(prev => prev.map(c => c.id === updated.id ? updated : c))
            setSelected(null)
          }}
        />
      )}
      {showAdd && (
        <AddCandidateModal
          coordinators={coordinators}
          onClose={() => setShowAdd(false)}
          onCreated={c => { setCandidates(prev => [c, ...prev]); setShowAdd(false) }}
        />
      )}
      {showCsv && (
        <CsvUploadModal
          onClose={() => setShowCsv(false)}
          onUploaded={() => { refreshCandidates(); setShowCsv(false) }}
        />
      )}
    </div>
  )
}
