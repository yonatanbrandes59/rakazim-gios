/**
 * Recruitment Brain
 * ──────────────────
 * Rule-based intelligence layer. No external LLM API.
 * Derives urgency, priority, next action, and suggested messages
 * purely from candidate data and the scoring service.
 */

import { Candidate, BrainAnalysis, CandidatePriority, NextAction, DailyBriefing } from '@/lib/types'
import { calculateFitScore } from './scoringService'
import { templatesDb } from '@/lib/db'
import { fillTemplate, formatDate } from '@/lib/utils'
import { REGION_LABELS } from '@/lib/types'
import { getAppUrl } from '@/lib/appUrl'

// ── analyzeCandidateProfile ────────────────────────────────────────────────

export function analyzeCandidateProfile(candidate: Candidate): BrainAnalysis {
  const reasoning: string[] = []

  // ── Urgency score (0–10) ───────────────────────────────────────────────
  let urgency = 0

  // Fit score contribution (0–4)
  const fitScore = candidate.fit_score ?? 0
  if (fitScore >= 70) {
    urgency += 4
    reasoning.push(`ציון התאמה גבוה: ${fitScore}/100`)
  } else if (fitScore >= 40) {
    urgency += 2
    reasoning.push(`ציון התאמה בינוני: ${fitScore}/100`)
  } else if (fitScore > 0) {
    urgency += 1
    reasoning.push(`ציון התאמה נמוך: ${fitScore}/100`)
  }

  // Interest level contribution (0–4)
  const il = candidate.interest_level
  if (il === 'very_hot') {
    urgency += 4
    reasoning.push('רמת עניין: חם מאוד')
  } else if (il === 'interested') {
    urgency += 3
    reasoning.push('רמת עניין: מתעניין')
  } else if (il === 'needs_explanation') {
    urgency += 2
    reasoning.push('רמת עניין: צריך הסבר')
  } else if (il === 'keep_warm') {
    urgency += 1
    reasoning.push('רמת עניין: לשמור חם')
  } else if (il === 'not_interested' || il === 'not_relevant_now') {
    urgency -= 2
    reasoning.push('רמת עניין: לא מתאים כרגע')
  }

  // Days since created (recency bonus – 0–2)
  const daysSinceCreated = Math.floor(
    (Date.now() - new Date(candidate.created_at).getTime()) / 86400000,
  )
  if (daysSinceCreated <= 1) {
    urgency += 2
    reasoning.push('מועמד חדש – פניה מהירה חיונית')
  } else if (daysSinceCreated <= 7) {
    urgency += 1
    reasoning.push(`${daysSinceCreated} ימים מאז הרשמה`)
  } else {
    reasoning.push(`${daysSinceCreated} ימים מאז הרשמה – ממתין פנייה`)
  }

  urgency = Math.max(0, Math.min(10, urgency))

  // ── Priority ──────────────────────────────────────────────────────────
  let priority: CandidatePriority
  if (urgency >= 7) {
    priority = 'hot'
  } else if (urgency >= 4) {
    priority = 'warm'
  } else {
    priority = 'cold'
  }

  // ── Next action ───────────────────────────────────────────────────────
  let nextAction: NextAction
  const status = candidate.status
  if (status === 'new' || status === 'contact_pending') {
    nextAction = 'send_questionnaire'
  } else if (
    status === 'questionnaire_completed' ||
    status === 'questionnaire_started' ||
    status === 'questionnaire_opened'
  ) {
    nextAction = il === 'very_hot' || il === 'interested' ? 'schedule_call' : 'follow_up'
  } else if (status === 'contacted' || status === 'questionnaire_sent') {
    nextAction = 'follow_up'
  } else if (status === 'not_relevant' || status === 'not_interested') {
    nextAction = 'archive'
  } else {
    nextAction = 'follow_up'
  }

  // ── Best time to contact ───────────────────────────────────────────────
  const bestTimeToContact =
    candidate.best_time_to_contact ||
    candidate.recommended_contact_date ||
    new Date().toISOString().split('T')[0]

  // ── Suggested message (Hebrew) ─────────────────────────────────────────
  const regionLabel = candidate.preferred_region ? REGION_LABELS[candidate.preferred_region] : ''
  let suggestedMessage = `היי ${candidate.first_name}, `
  if (nextAction === 'send_questionnaire') {
    suggestedMessage += `פונה אליך לגבי תפקיד רכז/ת נוער / רכז/ת סניף${regionLabel ? ` באזור ${regionLabel}` : ''}. אשמח אם תמלא שאלון קצר.`
  } else if (nextAction === 'follow_up') {
    suggestedMessage += `רציתי לבדוק אם יש עדכונים לגבי הזמינות שלך לתפקיד רכז/ת נוער.`
  } else if (nextAction === 'schedule_call') {
    suggestedMessage += `אשמח לקבוע שיחה קצרה לסגור פרטים לגבי תפקיד רכז/ת נוער באזורך.`
  } else {
    suggestedMessage += `תודה על הזמן שלך. נשמור את פרטיך לעתיד.`
  }

  return {
    priority,
    nextAction,
    bestTimeToContact,
    suggestedMessage,
    reasoning,
    urgencyScore: urgency,
  }
}

// ── generatePersonalizedMessage ────────────────────────────────────────────

export async function generatePersonalizedMessage(
  candidate: Candidate,
  templateKey: string,
): Promise<string> {
  const template = await templatesDb.findByKey(templateKey)
  if (!template) return ''

  const regionLabel = candidate.preferred_region ? REGION_LABELS[candidate.preferred_region] : ''
  const APP_URL = getAppUrl()

  const vars: Record<string, string> = {
    firstName: candidate.first_name,
    lastName: candidate.last_name,
    fullName: candidate.full_name,
    garin: candidate.garin || '',
    garins: candidate.garin ? `גרעין ${candidate.garin}` : '',
    armyRole: candidate.army_role || '',
    releaseDate: formatDate(candidate.release_date),
    preferredRegion: regionLabel,
    fitScore: String(candidate.fit_score ?? 0),
    interestLevel: candidate.interest_level || '',
    recommendedContactDate: formatDate(candidate.recommended_contact_date),
    questionnaireLink: `${APP_URL}/questionnaire/${candidate.candidate_token}`,
    optOutLink: `${APP_URL}/questionnaire/${candidate.candidate_token}?action=optout`,
    candidateAdminLink: `${APP_URL}/admin/candidates/${candidate.id}`,
  }

  return fillTemplate(template.body, vars)
}

// ── rankCandidates ─────────────────────────────────────────────────────────

export function rankCandidates(candidates: Candidate[]): Candidate[] {
  return [...candidates].sort((a, b) => {
    const aScore = analyzeCandidateProfile(a).urgencyScore
    const bScore = analyzeCandidateProfile(b).urgencyScore
    return bScore - aScore
  })
}

// ── generateDailyBriefing ──────────────────────────────────────────────────

export function generateDailyBriefing(candidates: Candidate[]): DailyBriefing {
  const analyzed = candidates.map(c => ({
    candidate: c,
    analysis: analyzeCandidateProfile(c),
  }))

  const hot = analyzed.filter(a => a.analysis.priority === 'hot')
  const priorityCount = hot.length

  const actionItems = hot.map(a => ({
    candidateId: a.candidate.id,
    action: a.analysis.nextAction,
    reason: a.analysis.reasoning[0] ?? '',
  }))

  const waitingFirst = hot.filter(a => a.analysis.nextAction === 'send_questionnaire').length
  const summary =
    `נמצאו ${priorityCount} מועמדים בעדיפות גבוהה. ` +
    (waitingFirst > 0
      ? `${waitingFirst} ממתינים לפנייה ראשונה.`
      : 'כל המועמדים בתהליך.')

  return { priorityCount, actionItems, summary }
}
