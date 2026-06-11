/**
 * GET /api/insights
 * ─────────────────
 * Aggregated analytics for the admin/management dashboard:
 *  - Recruitment funnel (sent → opened → completed → contacted → accepted)
 *  - Breakdown by region, by interest level, by garin year
 *  - Coordinator performance (assigned / contacted / accepted per coordinator)
 *  - Headline totals
 *
 * Admin-level access only. Computed in-memory from candidates + coordinators.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, hasAdminAccess } from '@/lib/auth'
import { candidatesDb, coordinatorsDb } from '@/lib/db'
import {
  Candidate, CandidateStatus, Region, REGION_LABELS,
  InterestLevel, INTEREST_LEVEL_LABELS,
} from '@/lib/types'

// Status ordering for the funnel — each stage counts candidates who reached
// AT LEAST that stage.
const REACHED: Record<string, CandidateStatus[]> = {
  registered: [
    'new', 'questionnaire_sent', 'questionnaire_opened', 'questionnaire_started',
    'questionnaire_completed', 'contact_pending', 'contacted', 'call_scheduled',
    'accepted', 'not_relevant', 'not_interested', 'follow_up_later',
  ],
  sent: [
    'questionnaire_sent', 'questionnaire_opened', 'questionnaire_started',
    'questionnaire_completed', 'contact_pending', 'contacted', 'call_scheduled',
    'accepted', 'follow_up_later',
  ],
  engaged: [
    'questionnaire_opened', 'questionnaire_started', 'questionnaire_completed',
    'contact_pending', 'contacted', 'call_scheduled', 'accepted', 'follow_up_later',
  ],
  completed: [
    'questionnaire_completed', 'contact_pending', 'contacted', 'call_scheduled',
    'accepted', 'follow_up_later',
  ],
  contacted: ['contacted', 'call_scheduled', 'accepted'],
  accepted: ['accepted'],
}

function countReached(cands: Candidate[], stage: keyof typeof REACHED): number {
  const set = new Set(REACHED[stage])
  return cands.filter(c => set.has(c.status)).length
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const user = await requireAuth(req)
  if (user instanceof NextResponse) return user
  if (user.role !== 'admin' && !hasAdminAccess(user)) {
    return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })
  }

  const candidates = await candidatesDb.findAll()
  const coordinators = await coordinatorsDb.findAll()

  const total = candidates.length

  // ── Funnel ────────────────────────────────────────────────────────────────
  const funnel = [
    { key: 'registered', label: 'נרשמו',          count: countReached(candidates, 'registered') },
    { key: 'sent',       label: 'נשלח שאלון',      count: countReached(candidates, 'sent') },
    { key: 'engaged',    label: 'פתחו/התחילו',     count: countReached(candidates, 'engaged') },
    { key: 'completed',  label: 'סיימו שאלון',      count: countReached(candidates, 'completed') },
    { key: 'contacted',  label: 'נוצר קשר',        count: countReached(candidates, 'contacted') },
    { key: 'accepted',   label: 'התקבלו',          count: countReached(candidates, 'accepted') },
  ]

  // ── By region ──────────────────────────────────────────────────────────────
  const regionMap = new Map<Region, { count: number; completed: number; accepted: number }>()
  for (const c of candidates) {
    const region = (c.preferred_region ?? c.assigned_region_id) as Region | undefined
    if (!region) continue
    const cur = regionMap.get(region) ?? { count: 0, completed: 0, accepted: 0 }
    cur.count++
    if (REACHED.completed.includes(c.status)) cur.completed++
    if (c.status === 'accepted') cur.accepted++
    regionMap.set(region, cur)
  }
  const byRegion = Array.from(regionMap.entries())
    .map(([region, v]) => ({ region, label: REGION_LABELS[region] ?? region, ...v }))
    .sort((a, b) => b.count - a.count)

  // ── By interest level ────────────────────────────────────────────────────
  const interestMap = new Map<InterestLevel, number>()
  for (const c of candidates) {
    if (!c.interest_level) continue
    interestMap.set(c.interest_level, (interestMap.get(c.interest_level) ?? 0) + 1)
  }
  const byInterest = Array.from(interestMap.entries())
    .map(([level, count]) => ({ level, label: INTEREST_LEVEL_LABELS[level] ?? level, count }))
    .sort((a, b) => b.count - a.count)

  // ── By garin year (source) ───────────────────────────────────────────────
  const yearMap = new Map<string, number>()
  for (const c of candidates) {
    const y = c.garin_year || 'לא ידוע'
    yearMap.set(y, (yearMap.get(y) ?? 0) + 1)
  }
  const byGarinYear = Array.from(yearMap.entries())
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year.localeCompare(b.year))

  // ── Coordinator performance ──────────────────────────────────────────────
  const coordMap = new Map<string, { assigned: number; contacted: number; accepted: number }>()
  for (const c of candidates) {
    if (!c.assigned_coordinator_id) continue
    const cur = coordMap.get(c.assigned_coordinator_id) ?? { assigned: 0, contacted: 0, accepted: 0 }
    cur.assigned++
    if (REACHED.contacted.includes(c.status)) cur.contacted++
    if (c.status === 'accepted') cur.accepted++
    coordMap.set(c.assigned_coordinator_id, cur)
  }
  const coordinatorPerformance = Array.from(coordMap.entries())
    .map(([id, v]) => {
      const coord = coordinators.find(co => co.id === id)
      return { id, name: coord?.name ?? 'לא ידוע', ...v }
    })
    .sort((a, b) => b.assigned - a.assigned)

  // ── Headline metrics ───────────────────────────────────────────────────────
  const completedCount = countReached(candidates, 'completed')
  const sentCount = countReached(candidates, 'sent')
  const acceptedCount = countReached(candidates, 'accepted')
  const avgFitScore = (() => {
    const scored = candidates.filter(c => typeof c.fit_score === 'number')
    if (scored.length === 0) return 0
    return Math.round(scored.reduce((s, c) => s + (c.fit_score ?? 0), 0) / scored.length)
  })()

  const headline = {
    total,
    completionRate: sentCount > 0 ? Math.round((completedCount / sentCount) * 100) : 0,
    acceptanceRate: completedCount > 0 ? Math.round((acceptedCount / completedCount) * 100) : 0,
    avgFitScore,
    unassigned: candidates.filter(c => !c.assigned_coordinator_id && !c.opt_out).length,
    optedOut: candidates.filter(c => c.opt_out).length,
  }

  return NextResponse.json({
    headline,
    funnel,
    byRegion,
    byInterest,
    byGarinYear,
    coordinatorPerformance,
    generatedAt: new Date().toISOString(),
  })
}
