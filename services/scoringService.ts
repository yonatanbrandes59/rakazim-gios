/**
 * Scoring & Matching Service
 * ──────────────────────────
 * Calculates fit_score (0-100), interest_level, fit_reason,
 * recommended_contact_date, and assigns to regional coordinator.
 */

import { Candidate, InterestLevel, Region, REGION_LABELS } from '@/lib/types'
import { computeContactDate } from '@/lib/utils'
import { coordinatorsDb, positionsDb } from '@/lib/db'

interface ScoringInput {
  garin?: string
  guidance_experience?: boolean
  leadership_experience?: boolean
  interest_in_role?: string       // 'yes' | 'maybe' | 'not_sure' | 'not_relevant'
  looking_for_work?: string       // 'now' | 'one_two_months' | 'after_trip' | 'after_psychometric' | 'dont_know' | 'not_looking'
  can_commit_full_year?: boolean
  has_driving_license?: boolean
  has_car?: boolean
  preferred_region?: Region
  release_date?: string
  trip_return_date?: string
  studies_end_date?: string
  army_role?: string
}

export function calculateFitScore(input: ScoringInput): {
  score: number
  reason: string
  interestLevel: InterestLevel
  contactDate: string | null
} {
  let score = 0
  const reasons: string[] = []

  // ── Garin background ──────────────────────────────────────────────────
  if (input.garin) {
    score += 20
    reasons.push(`ניסיון גרעין (${input.garin})`)
  }

  // ── Guidance experience ───────────────────────────────────────────────
  if (input.guidance_experience) {
    score += 15
    reasons.push('ניסיון הדרכה')
  }

  // ── Leadership / command experience ───────────────────────────────────
  if (input.leadership_experience) {
    score += 15
    reasons.push('ניסיון הובלה / פיקוד')
  }

  // ── Interest in role ──────────────────────────────────────────────────
  const interest = input.interest_in_role
  if (interest === 'yes') {
    score += 20
    reasons.push('מתעניין בתפקיד')
  } else if (interest === 'maybe') {
    score += 10
    reasons.push('מתעניין בכפוף להסבר')
  } else if (interest === 'not_sure') {
    score += 5
  } else if (interest === 'not_relevant') {
    score -= 5
  }

  // ── Commitment ────────────────────────────────────────────────────────
  if (input.can_commit_full_year) {
    score += 10
    reasons.push('יכול להתחייב לשנה מלאה')
  }

  // ── Driving license + car ─────────────────────────────────────────────
  if (input.has_driving_license) {
    score += 5
    reasons.push('רישיון נהיגה')
  }
  if (input.has_car) {
    score += 5
    reasons.push('רכב זמין')
  }

  // ── Availability ──────────────────────────────────────────────────────
  const lfw = input.looking_for_work
  if (lfw === 'now') {
    score += 10
    reasons.push('מחפש עבודה עכשיו')
  } else if (lfw === 'one_two_months') {
    score += 8
    reasons.push('זמין בחודש-חודשיים')
  } else if (lfw === 'after_trip' || lfw === 'after_psychometric') {
    score += 4
  }

  // Cap at 100
  score = Math.min(100, Math.max(0, score))

  // ── Interest level ────────────────────────────────────────────────────
  let interestLevel: InterestLevel
  if (input.interest_in_role === 'not_relevant' || lfw === 'not_looking') {
    interestLevel = 'not_relevant_now'
  } else if (lfw === 'now' && interest === 'yes') {
    interestLevel = 'very_hot'
  } else if (interest === 'yes') {
    interestLevel = score >= 60 ? 'interested' : 'keep_warm'
  } else if (interest === 'maybe' || interest === 'not_sure') {
    interestLevel = 'needs_explanation'
  } else if (lfw === 'after_trip' || lfw === 'after_psychometric') {
    interestLevel = 'future'
  } else {
    interestLevel = 'keep_warm'
  }

  // ── Contact date ──────────────────────────────────────────────────────
  const { date: contactDate, interestLevel: dateBasedLevel } = computeContactDate(input)
  // Use the more urgent of the two interest levels
  const urgency: InterestLevel[] = ['very_hot', 'interested', 'needs_explanation', 'keep_warm', 'future', 'not_relevant_now', 'not_interested']
  const finalLevel = urgency.indexOf(interestLevel) <= urgency.indexOf(dateBasedLevel as InterestLevel)
    ? interestLevel
    : dateBasedLevel as InterestLevel

  // ── Reason text ───────────────────────────────────────────────────────
  let reasonText = ''
  if (score >= 70) {
    reasonText = `מתאים מאוד: ${reasons.join(', ')}.`
  } else if (score >= 40) {
    reasonText = `מתאים: ${reasons.join(', ')}.`
    if (!contactDate) reasonText += ' אך לא זמין כרגע.'
  } else {
    reasonText = reasons.length ? `פוטנציאל: ${reasons.join(', ')}.` : 'מידע חסר לחישוב התאמה.'
  }

  return { score, reason: reasonText, interestLevel: finalLevel, contactDate }
}

// Assign a candidate to the matching regional coordinator
export async function assignCoordinator(candidate: Candidate): Promise<string | null> {
  if (!candidate.preferred_region || candidate.preferred_region === 'open') {
    return null
  }
  const coordinators = await coordinatorsDb.findAll()
  const match = coordinators.find(c => c.region === candidate.preferred_region)
  return match?.id ?? null
}

// Get matching open positions for a candidate
export async function getMatchingPositions(candidate: Candidate) {
  if (!candidate.preferred_region) return []
  const positions = await positionsDb.findAll(candidate.preferred_region)
  return positions.filter(p => {
    if (p.status === 'closed') return false
    if (p.requires_car && !candidate.has_car) return false
    return true
  })
}

// Full scoring pipeline: score + assign + return updates
export async function scoreAndAssignCandidate(candidate: Candidate): Promise<Partial<Candidate>> {
  const { score, reason, interestLevel, contactDate } = calculateFitScore(candidate)
  const coordinatorId = await assignCoordinator(candidate)

  return {
    fit_score: score,
    fit_reason: reason,
    interest_level: interestLevel,
    recommended_contact_date: contactDate ?? undefined,
    assigned_coordinator_id: coordinatorId ?? undefined,
    assigned_region_id: candidate.preferred_region,
  }
}
