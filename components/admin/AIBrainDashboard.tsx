'use client'
import { useState, useEffect } from 'react'
import { Candidate, INTEREST_LEVEL_LABELS } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { createWhatsAppLink } from '@/lib/utils'
import { ConversationThread } from './ConversationThread'

// ── Types ──────────────────────────────────────────────────────────────────

type Priority = 'hot' | 'warm' | 'cold'

interface RankedCandidate {
  candidate: Candidate
  analysis: {
    candidateId: string
    score: number
    priority: Priority
    recommendedAction: string
    suggestedMessage: string
    urgencyScore: number
    nextAction?: string
    reason?: string
  }
}

interface DailyBriefing {
  summary: string
  priorityCount: number
  rankedCandidates: RankedCandidate[]
  generatedAt: string
}

interface AutomationRule {
  id: string
  name: string
  description: string
  trigger: string
  active: boolean
}

interface ActivityItem {
  id: string
  candidateId?: string
  candidateName?: string
  action: string
  details?: string
  created_at: string
}

// ── Priority badge helpers ─────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<Priority, { label: string; icon: string; bg: string; text: string }> = {
  hot:  { label: 'חם',  icon: '🔴', bg: 'bg-red-100',   text: 'text-red-700' },
  warm: { label: 'חמים', icon: '🟡', bg: 'bg-amber-100', text: 'text-amber-700' },
  cold: { label: 'קר',  icon: '🔵', bg: 'bg-sky-100',   text: 'text-sky-700' },
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const cfg = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.cold
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      {cfg.icon} {cfg.label}
    </span>
  )
}

// ── Skeleton helpers ───────────────────────────────────────────────────────

function SkeletonLine({ w = 'w-full' }: { w?: string }) {
  return <div className={`h-4 ${w} bg-gray-100 animate-pulse rounded`} />
}

// ── Main component ─────────────────────────────────────────────────────────

export function AIBrainDashboard() {
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null)
  const [briefingLoading, setBriefingLoading] = useState(true)
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([])
  const [rulesLoading, setRulesLoading] = useState(true)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [activityLoading, setActivityLoading] = useState(true)
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null)
  const [togglingRuleId, setTogglingRuleId] = useState<string | null>(null)

  // Load daily briefing
  useEffect(() => {
    setBriefingLoading(true)
    fetch('/api/brain/briefing')
      .then(r => r.ok ? r.json() : null)
      .then(data => setBriefing(data))
      .catch(() => setBriefing(null))
      .finally(() => setBriefingLoading(false))
  }, [])

  // Load automation rules
  useEffect(() => {
    setRulesLoading(true)
    fetch('/api/automation-rules')
      .then(r => r.ok ? r.json() : [])
      .then(data => setAutomationRules(Array.isArray(data) ? data : []))
      .catch(() => setAutomationRules([]))
      .finally(() => setRulesLoading(false))
  }, [])

  // Load recent activity feed
  useEffect(() => {
    setActivityLoading(true)
    fetch('/api/candidates?status=contacted')
      .then(r => r.ok ? r.json() : [])
      .then((candidates: Candidate[]) => {
        const recent = candidates.slice(0, 5).map(c => ({
          id: c.id,
          candidateId: c.id,
          candidateName: c.full_name,
          action: `סטטוס: ${c.status}`,
          details: c.interest_level ? INTEREST_LEVEL_LABELS[c.interest_level] : undefined,
          created_at: c.updated_at,
        }))
        setActivity(recent)
      })
      .catch(() => setActivity([]))
      .finally(() => setActivityLoading(false))
  }, [])

  async function handleToggleRule(rule: AutomationRule) {
    setTogglingRuleId(rule.id)
    try {
      const res = await fetch(`/api/automation-rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !rule.active }),
      })
      if (res.ok) {
        setAutomationRules(prev =>
          prev.map(r => r.id === rule.id ? { ...r, active: !r.active } : r)
        )
      }
    } finally {
      setTogglingRuleId(null)
    }
  }

  function handleSendWhatsApp(candidate: Candidate, suggestedMessage: string) {
    const link = createWhatsAppLink(candidate.phone, suggestedMessage)
    window.open(link, '_blank')
    fetch(`/api/conversations/${candidate.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: suggestedMessage, direction: 'out' }),
    }).catch(() => null)
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto" dir="rtl">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <span className="text-3xl">🧠</span>
        <div>
          <h1 className="text-2xl font-black text-gray-900">מוח AI</h1>
          <p className="text-sm text-gray-500">ניתוח יומי, עדיפויות ואוטומציה</p>
        </div>
        {briefing && !briefingLoading && (
          <span className="mr-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-700 text-sm font-semibold">
            🔴 {briefing.priorityCount} מועמדים בעדיפות גבוהה
          </span>
        )}
      </div>

      {/* Daily Briefing Widget */}
      <section className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <h2 className="text-base font-bold text-gray-800 mb-3">📋 תדריך יומי</h2>
        {briefingLoading ? (
          <div className="space-y-2">
            <SkeletonLine w="w-3/4" />
            <SkeletonLine w="w-1/2" />
            <SkeletonLine w="w-2/3" />
          </div>
        ) : briefing ? (
          <div className="bg-brand-50 border border-brand-200 rounded-xl p-4">
            <p className="text-sm text-brand-900 leading-relaxed">{briefing.summary}</p>
            {briefing.generatedAt && (
              <p className="text-xs text-brand-400 mt-2">עודכן: {new Date(briefing.generatedAt).toLocaleString('he-IL')}</p>
            )}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-500">
            לא ניתן לטעון את התדריך. בדוק את חיבור ה-API.
          </div>
        )}
      </section>

      {/* Priority Candidates Table */}
      <section className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-800">🎯 מועמדים בעדיפות</h2>
        </div>
        {briefingLoading ? (
          <div className="divide-y divide-gray-100">
            {[1, 2, 3].map(i => (
              <div key={i} className="px-5 py-4 flex items-center gap-3">
                <SkeletonLine w="w-24" />
                <SkeletonLine w="w-12" />
                <SkeletonLine w="w-20" />
                <SkeletonLine w="w-32" />
                <SkeletonLine w="w-16" />
              </div>
            ))}
          </div>
        ) : !briefing || briefing.rankedCandidates.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <div className="text-3xl mb-2">✅</div>
            <p className="text-sm">אין מועמדים בעדיפות כרגע</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-right">
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500">שם</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">עדיפות</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">פעולה מומלצת</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">דחיפות</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500">פעולה</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {briefing.rankedCandidates.map(({ candidate, analysis }) => (
                  <tr key={candidate.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <button
                        type="button"
                        className="text-brand-700 font-medium hover:underline text-right"
                        onClick={() => setSelectedCandidate(candidate)}
                      >
                        {candidate.full_name}
                      </button>
                    </td>
                    <td className="px-4 py-3.5">
                      <PriorityBadge priority={analysis.priority} />
                    </td>
                    <td className="px-4 py-3.5 max-w-[180px]">
                      <span className="text-gray-700 text-xs leading-snug">{analysis.recommendedAction}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-600 rounded-full transition-all"
                            style={{ width: `${Math.min(100, analysis.urgencyScore ?? 0)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{analysis.urgencyScore ?? 0}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <Button
                        variant="whatsapp"
                        size="sm"
                        onClick={() => handleSendWhatsApp(candidate, analysis.suggestedMessage)}
                      >
                        💬 WhatsApp
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Two-column: Automation Rules + Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Automation Rules Panel */}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-800">⚙️ חוקי אוטומציה</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {rulesLoading ? (
              <div className="p-5 space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-3">
                    <SkeletonLine w="flex-1" />
                    <div className="h-5 w-9 bg-gray-100 animate-pulse rounded-full" />
                  </div>
                ))}
              </div>
            ) : automationRules.length === 0 ? (
              <div className="p-5 text-sm text-gray-400 text-center">אין חוקי אוטומציה מוגדרים</div>
            ) : (
              automationRules.map(rule => (
                <div key={rule.id} className="px-5 py-3.5 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{rule.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{rule.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleRule(rule)}
                    disabled={togglingRuleId === rule.id}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 disabled:opacity-50 ${
                      rule.active ? 'bg-brand-700' : 'bg-gray-200'
                    }`}
                    role="switch"
                    aria-checked={rule.active}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        rule.active ? 'translate-x-0' : '-translate-x-4'
                      }`}
                    />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Recent Activity Feed */}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-800">📡 פעילות אחרונה</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {activityLoading ? (
              <div className="p-5 space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex gap-3">
                    <div className="w-8 h-8 bg-gray-100 animate-pulse rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <SkeletonLine w="w-32" />
                      <SkeletonLine w="w-48" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activity.length === 0 ? (
              <div className="p-5 text-sm text-gray-400 text-center">אין פעילות אחרונה</div>
            ) : (
              activity.map(item => (
                <div key={item.id} className="px-5 py-3.5 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm flex-shrink-0">
                    👤
                  </div>
                  <div className="flex-1 min-w-0">
                    {item.candidateName && (
                      <p className="text-sm font-medium text-gray-800 truncate">{item.candidateName}</p>
                    )}
                    <p className="text-xs text-gray-600">{item.action}</p>
                    {item.details && (
                      <p className="text-xs text-gray-400 mt-0.5">{item.details}</p>
                    )}
                  </div>
                  <time className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                    {new Date(item.created_at).toLocaleDateString('he-IL')}
                  </time>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Conversation Thread Modal */}
      {selectedCandidate && (
        <Modal
          isOpen
          onClose={() => setSelectedCandidate(null)}
          title={`💬 שיחה עם ${selectedCandidate.full_name}`}
          size="lg"
        >
          <div className="px-6 pb-6">
            <ConversationThread
              candidate={selectedCandidate}
              onClose={() => setSelectedCandidate(null)}
            />
          </div>
        </Modal>
      )}
    </div>
  )
}
