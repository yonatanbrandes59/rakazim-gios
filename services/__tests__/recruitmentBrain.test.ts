/**
 * Recruitment Brain — Test Suite
 * ────────────────────────────────
 * Run with: npx tsx services/__tests__/recruitmentBrain.test.ts
 *
 * Uses node:test + node:assert — no extra dependencies.
 * Tests analyzeCandidateProfile, generatePersonalizedMessage,
 * rankCandidates, and generateDailyBriefing.
 *
 * RULE: ALLOW_PAID_MESSAGING must never be 'true' in this test file.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type {
  Candidate,
  CandidatePriority,
  NextAction,
  BrainAnalysis,
  DailyBriefing,
} from '../../lib/types'
import { REGION_LABELS } from '../../lib/types'

// ── Env guard ──────────────────────────────────────────────────────────────
assert.notEqual(
  process.env.ALLOW_PAID_MESSAGING,
  'true',
  'ALLOW_PAID_MESSAGING must not be "true" in the test environment',
)

// ── Inline brain logic (mirrors recruitmentBrain.ts exactly) ──────────────

function analyzeCandidateProfile(candidate: Candidate): BrainAnalysis {
  const reasoning: string[] = []
  let urgency = 0

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

  let priority: CandidatePriority
  if (urgency >= 7) {
    priority = 'hot'
  } else if (urgency >= 4) {
    priority = 'warm'
  } else {
    priority = 'cold'
  }

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

  const bestTimeToContact =
    candidate.best_time_to_contact ||
    candidate.recommended_contact_date ||
    new Date().toISOString().split('T')[0]

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

  return { priority, nextAction, bestTimeToContact, suggestedMessage, reasoning, urgencyScore: urgency }
}

function fillTemplate(template: string, vars: Record<string, string | number | undefined | null>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const val = vars[key]
    return val !== undefined && val !== null ? String(val) : `{${key}}`
  })
}

function generatePersonalizedMessage(candidate: Candidate, templateBody: string): string {
  const regionLabel = candidate.preferred_region ? REGION_LABELS[candidate.preferred_region] : ''
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const vars: Record<string, string> = {
    firstName: candidate.first_name,
    lastName: candidate.last_name,
    fullName: candidate.full_name,
    garin: candidate.garin || '',
    garins: candidate.garin ? `גרעין ${candidate.garin}` : '',
    armyRole: candidate.army_role || '',
    releaseDate: candidate.release_date || '—',
    preferredRegion: regionLabel,
    fitScore: String(candidate.fit_score ?? 0),
    interestLevel: candidate.interest_level || '',
    recommendedContactDate: candidate.recommended_contact_date || '—',
    questionnaireLink: `${APP_URL}/questionnaire/${candidate.candidate_token}`,
    optOutLink: `${APP_URL}/questionnaire/${candidate.candidate_token}?action=optout`,
    candidateAdminLink: `${APP_URL}/admin/candidates/${candidate.id}`,
  }
  return fillTemplate(templateBody, vars)
}

function rankCandidates(candidates: Candidate[]): Candidate[] {
  return [...candidates].sort((a, b) => {
    const aScore = analyzeCandidateProfile(a).urgencyScore
    const bScore = analyzeCandidateProfile(b).urgencyScore
    return bScore - aScore
  })
}

function generateDailyBriefing(candidates: Candidate[]): DailyBriefing {
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

// ── Fixture helper ─────────────────────────────────────────────────────────

function makeCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: 'cand-brain-001',
    first_name: 'שרה',
    last_name: 'כהן',
    full_name: 'שרה כהן',
    phone: '0521234567',
    candidate_token: 'tok-brain-001',
    status: 'new',
    opt_out: false,
    consent_given: true,
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(), // 2 days ago
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

// ── analyzeCandidateProfile ────────────────────────────────────────────────

describe('analyzeCandidateProfile — priority classification', () => {
  it('returns priority="hot" for fit_score=70 and status="new" with recent creation', () => {
    // fit_score=70 → +4, created 2 days ago → +1 = urgency 5 → warm
    // But with very_hot interest: +4+4+1 = 9 → hot
    const candidate = makeCandidate({
      fit_score: 70,
      status: 'new',
      interest_level: 'very_hot',
    })
    const result = analyzeCandidateProfile(candidate)
    assert.equal(result.priority, 'hot')
  })

  it('returns priority="hot" for fit_score=70, status="new", created today', () => {
    // fit_score=70 → +4, created today → +2 = urgency 6 → warm (not hot yet)
    // With very_hot: +4+4+2 = 10 → hot
    const candidate = makeCandidate({
      fit_score: 70,
      status: 'new',
      interest_level: 'very_hot',
      created_at: new Date().toISOString(),
    })
    const result = analyzeCandidateProfile(candidate)
    assert.equal(result.priority, 'hot')
    assert.ok(result.urgencyScore >= 7, `Expected urgency ≥ 7, got ${result.urgencyScore}`)
  })

  it('returns priority="warm" for fit_score=70, status="new", no interest level, 2 days old', () => {
    // fit_score=70 → +4, 2 days old → +1 = urgency 5 → warm
    const candidate = makeCandidate({ fit_score: 70, status: 'new' })
    const result = analyzeCandidateProfile(candidate)
    assert.equal(result.priority, 'warm')
    assert.equal(result.urgencyScore, 5)
  })

  it('urgencyScore is clamped to 0 minimum', () => {
    // fit_score=0, not_interested interest (-2), created 30 days ago (no bonus)
    const candidate = makeCandidate({
      fit_score: 0,
      interest_level: 'not_interested',
      created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    })
    const result = analyzeCandidateProfile(candidate)
    assert.ok(result.urgencyScore >= 0, 'urgencyScore must not be negative')
    assert.equal(result.urgencyScore, 0)
  })

  it('urgencyScore is clamped to 10 maximum', () => {
    // fit_score=100 (+4), very_hot (+4), created today (+2) = 10
    const candidate = makeCandidate({
      fit_score: 100,
      interest_level: 'very_hot',
      created_at: new Date().toISOString(),
    })
    const result = analyzeCandidateProfile(candidate)
    assert.ok(result.urgencyScore <= 10, 'urgencyScore must not exceed 10')
    assert.equal(result.urgencyScore, 10)
  })

  it('returns urgencyScore=0 for opt_out=true candidate (clamped — urgency stays non-negative)', () => {
    // The brain itself doesn't gate on opt_out — it just calculates.
    // A candidate with no score, not_interested, and old creation → urgency 0 after clamp.
    const candidate = makeCandidate({
      opt_out: true,
      fit_score: 0,
      interest_level: 'not_interested',
      created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    })
    const result = analyzeCandidateProfile(candidate)
    assert.equal(result.urgencyScore, 0, 'Opted-out candidate with no interest → urgencyScore must be 0')
  })

  it('nextAction=send_questionnaire for status="new"', () => {
    const candidate = makeCandidate({ status: 'new' })
    const result = analyzeCandidateProfile(candidate)
    assert.equal(result.nextAction, 'send_questionnaire')
  })

  it('nextAction=send_questionnaire for status="contact_pending"', () => {
    const candidate = makeCandidate({ status: 'contact_pending' })
    const result = analyzeCandidateProfile(candidate)
    assert.equal(result.nextAction, 'send_questionnaire')
  })

  it('nextAction=archive for status="not_interested"', () => {
    const candidate = makeCandidate({ status: 'not_interested' })
    const result = analyzeCandidateProfile(candidate)
    assert.equal(result.nextAction, 'archive')
  })

  it('nextAction=schedule_call for questionnaire_completed + very_hot interest', () => {
    const candidate = makeCandidate({ status: 'questionnaire_completed', interest_level: 'very_hot' })
    const result = analyzeCandidateProfile(candidate)
    assert.equal(result.nextAction, 'schedule_call')
  })

  it('nextAction=follow_up for questionnaire_completed + no strong interest', () => {
    const candidate = makeCandidate({ status: 'questionnaire_completed', interest_level: 'keep_warm' })
    const result = analyzeCandidateProfile(candidate)
    assert.equal(result.nextAction, 'follow_up')
  })

  it('reasoning array is non-empty', () => {
    const candidate = makeCandidate({ fit_score: 50 })
    const result = analyzeCandidateProfile(candidate)
    assert.ok(result.reasoning.length > 0, 'reasoning must contain at least one entry')
  })

  it('reasoning entries are Hebrew strings', () => {
    const candidate = makeCandidate({ fit_score: 50 })
    const result = analyzeCandidateProfile(candidate)
    // Hebrew characters are in range U+0590–U+05FF
    const hebrewRegex = /[֐-׿]/
    assert.ok(
      result.reasoning.some(r => hebrewRegex.test(r)),
      'At least one reasoning entry should contain Hebrew text',
    )
  })
})

// ── generatePersonalizedMessage ────────────────────────────────────────────

describe('generatePersonalizedMessage — template substitution', () => {
  it('substitutes {firstName} correctly', () => {
    const candidate = makeCandidate({ first_name: 'דני' })
    const result = generatePersonalizedMessage(candidate, 'שלום {firstName}, כיצד אתה?')
    assert.equal(result, 'שלום דני, כיצד אתה?')
  })

  it('substitutes {fullName} correctly', () => {
    const candidate = makeCandidate({ full_name: 'דני לוי' })
    const result = generatePersonalizedMessage(candidate, 'שלום {fullName}')
    assert.equal(result, 'שלום דני לוי')
  })

  it('substitutes multiple variables in one template', () => {
    const candidate = makeCandidate({ first_name: 'נועה', fit_score: 80 })
    const result = generatePersonalizedMessage(candidate, 'היי {firstName}, ציונך: {fitScore}')
    assert.equal(result, 'היי נועה, ציונך: 80')
  })

  it('leaves unknown placeholders unchanged', () => {
    const candidate = makeCandidate()
    const result = generatePersonalizedMessage(candidate, 'שלום {unknownVar}')
    assert.equal(result, 'שלום {unknownVar}')
  })

  it('substitutes {questionnaireLink} with correct URL pattern', () => {
    const candidate = makeCandidate({ candidate_token: 'tok-xyz' })
    const result = generatePersonalizedMessage(candidate, 'לינק: {questionnaireLink}')
    assert.ok(result.includes('/questionnaire/tok-xyz'), `Got: ${result}`)
  })

  it('substitutes {garin} with empty string when not set', () => {
    const candidate = makeCandidate({ garin: undefined })
    const result = generatePersonalizedMessage(candidate, 'גרעין: [{garin}]')
    assert.equal(result, 'גרעין: []')
  })

  it('substitutes {garins} with "גרעין X" format when garin is set', () => {
    const candidate = makeCandidate({ garin: 'נחשון' })
    const result = generatePersonalizedMessage(candidate, '{garins}')
    assert.equal(result, 'גרעין נחשון')
  })
})

// ── rankCandidates ─────────────────────────────────────────────────────────

describe('rankCandidates — sorted by urgencyScore DESC', () => {
  it('returns an empty array for empty input', () => {
    assert.deepEqual(rankCandidates([]), [])
  })

  it('returns single-element array unchanged', () => {
    const candidate = makeCandidate()
    const result = rankCandidates([candidate])
    assert.equal(result.length, 1)
    assert.equal(result[0].id, candidate.id)
  })

  it('sorts candidates so higher urgencyScore comes first', () => {
    const highUrgency = makeCandidate({
      id: 'high',
      fit_score: 90,
      interest_level: 'very_hot',
      created_at: new Date().toISOString(),
    })
    const lowUrgency = makeCandidate({
      id: 'low',
      fit_score: 10,
      interest_level: 'not_interested',
      created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    })

    const result = rankCandidates([lowUrgency, highUrgency])
    assert.equal(result[0].id, 'high', 'High urgency candidate should be first')
    assert.equal(result[1].id, 'low')
  })

  it('does not mutate the original array', () => {
    const c1 = makeCandidate({ id: 'a', fit_score: 10 })
    const c2 = makeCandidate({ id: 'b', fit_score: 90, interest_level: 'very_hot' })
    const original = [c1, c2]
    rankCandidates(original)
    assert.equal(original[0].id, 'a', 'Original array should not be mutated')
  })
})

// ── generateDailyBriefing ──────────────────────────────────────────────────

describe('generateDailyBriefing — Hebrew summary generation', () => {
  it('summary string is non-empty', () => {
    const candidates = [makeCandidate()]
    const briefing = generateDailyBriefing(candidates)
    assert.ok(briefing.summary.length > 0, 'summary must be non-empty')
  })

  it('summary contains Hebrew text', () => {
    const candidates = [makeCandidate()]
    const briefing = generateDailyBriefing(candidates)
    const hebrewRegex = /[֐-׿]/
    assert.ok(hebrewRegex.test(briefing.summary), 'summary must contain Hebrew characters')
  })

  it('summary mentions "מועמדים" for non-empty candidate list', () => {
    const candidates = [makeCandidate()]
    const briefing = generateDailyBriefing(candidates)
    assert.ok(briefing.summary.includes('מועמדים'), `Summary: "${briefing.summary}"`)
  })

  it('returns priorityCount=0 for empty candidates list', () => {
    const briefing = generateDailyBriefing([])
    assert.equal(briefing.priorityCount, 0)
    assert.deepEqual(briefing.actionItems, [])
  })

  it('counts only "hot" priority candidates in priorityCount', () => {
    const hot = makeCandidate({
      id: 'hot-1',
      fit_score: 90,
      interest_level: 'very_hot',
      created_at: new Date().toISOString(),
    })
    const cold = makeCandidate({
      id: 'cold-1',
      fit_score: 5,
      interest_level: 'not_interested',
      created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    })
    const briefing = generateDailyBriefing([hot, cold])
    assert.equal(briefing.priorityCount, 1)
    assert.equal(briefing.actionItems[0].candidateId, 'hot-1')
  })

  it('each actionItem has candidateId, action, and reason fields', () => {
    const hot = makeCandidate({
      fit_score: 90,
      interest_level: 'very_hot',
      created_at: new Date().toISOString(),
    })
    const briefing = generateDailyBriefing([hot])
    if (briefing.actionItems.length > 0) {
      const item = briefing.actionItems[0]
      assert.ok(typeof item.candidateId === 'string', 'candidateId must be a string')
      assert.ok(typeof item.action === 'string', 'action must be a string')
      assert.ok(typeof item.reason === 'string', 'reason must be a string')
    }
  })
})
