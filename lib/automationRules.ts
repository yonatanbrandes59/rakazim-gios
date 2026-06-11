/**
 * Automation Rules — Default Seed & shouldFire Helper
 * ─────────────────────────────────────────────────────
 * DEFAULT_AUTOMATION_RULES is used to seed the DB on first run if empty.
 * shouldFire() decides whether a rule should execute for a given candidate.
 */

import { AutomationRule, Candidate } from './types'

export const DEFAULT_AUTOMATION_RULES: Omit<AutomationRule, 'id' | 'created_at'>[] = [
  // ── When a new candidate is created ─────────────────────────────────────
  {
    trigger: 'candidate_created',
    action: 'notify_admin',
    template_key: 'alert_to_coordinator',
    delay_hours: 0,
    active: true,
    condition_json: {},
  },
  // ── When a questionnaire is completed ────────────────────────────────────
  {
    trigger: 'questionnaire_completed',
    action: 'send_whatsapp',
    template_key: 'thank_you_candidate',
    delay_hours: 0,
    active: true,
    condition_json: {},
  },
  {
    trigger: 'questionnaire_completed',
    action: 'notify_coordinator',
    template_key: 'alert_to_coordinator',
    delay_hours: 0,
    active: true,
    condition_json: {},
  },
  {
    trigger: 'questionnaire_completed',
    action: 'notify_admin',
    template_key: 'alert_to_coordinator',
    delay_hours: 0,
    active: true,
    condition_json: {},
  },
  // ── When a candidate doesn't respond for 3 days ───────────────────────────
  {
    trigger: '3_days_no_response',
    action: 'send_whatsapp',
    template_key: 'reminder_to_candidate',
    delay_hours: 72,
    active: true,
    condition_json: {},
  },
  // ── When a coordinator is assigned ───────────────────────────────────────
  {
    trigger: 'coordinator_assigned',
    action: 'notify_coordinator',
    template_key: 'alert_to_coordinator',
    delay_hours: 0,
    active: true,
    condition_json: {},
  },
  // ── When interest level is very hot ──────────────────────────────────────
  {
    trigger: 'fit_score_high',
    action: 'flag_priority',
    template_key: 'alert_to_coordinator',
    delay_hours: 0,
    active: true,
    condition_json: { minInterestLevel: 'very_hot' },
  },
]

/**
 * Decide whether a rule should fire for a given candidate.
 * Always returns false for opted-out or inactive rules.
 */
const INTEREST_LEVEL_ORDER: string[] = [
  'not_interested', 'not_relevant_now', 'future', 'keep_warm',
  'needs_explanation', 'interested', 'very_hot',
]

export function shouldFire(rule: AutomationRule, candidate: Candidate): boolean {
  if (!rule.active) return false
  if (candidate.opt_out) return false

  const cond = rule.condition_json ?? {}

  if (rule.trigger === 'fit_score_high') {
    // Support both legacy fit_score and new interest_level checks
    if (typeof cond.minInterestLevel === 'string') {
      const minIdx = INTEREST_LEVEL_ORDER.indexOf(cond.minInterestLevel)
      const candIdx = candidate.interest_level
        ? INTEREST_LEVEL_ORDER.indexOf(candidate.interest_level)
        : -1
      return candIdx >= minIdx
    }
    // Legacy: numeric fit_score
    const minScore = typeof cond.minScore === 'number' ? cond.minScore : 70
    return (candidate.fit_score ?? 0) >= minScore
  }

  // No extra conditions for other triggers — caller controls which trigger to fire
  return true
}
