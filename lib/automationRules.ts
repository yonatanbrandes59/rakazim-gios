/**
 * Automation Rules — Default Seed & shouldFire Helper
 * ─────────────────────────────────────────────────────
 * DEFAULT_AUTOMATION_RULES is used to seed the DB on first run if empty.
 * shouldFire() decides whether a rule should execute for a given candidate.
 */

import { AutomationRule, Candidate } from './types'

export const DEFAULT_AUTOMATION_RULES: Omit<AutomationRule, 'id' | 'created_at'>[] = [
  {
    trigger: 'candidate_created',
    action: 'send_whatsapp',
    template_key: 'opening_to_candidate',
    delay_hours: 0,
    active: true,
    condition_json: {},
  },
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
    trigger: '3_days_no_response',
    action: 'send_whatsapp',
    template_key: 'reminder_to_candidate',
    delay_hours: 72,
    active: true,
    condition_json: {},
  },
  {
    trigger: 'coordinator_assigned',
    action: 'notify_coordinator',
    template_key: 'alert_to_coordinator',
    delay_hours: 0,
    active: true,
    condition_json: {},
  },
  {
    trigger: 'fit_score_high',
    action: 'flag_priority',
    template_key: 'alert_to_coordinator',
    delay_hours: 0,
    active: true,
    condition_json: { minScore: 70 },
  },
]

/**
 * Decide whether a rule should fire for a given candidate.
 * Always returns false for opted-out or inactive rules.
 */
export function shouldFire(rule: AutomationRule, candidate: Candidate): boolean {
  if (!rule.active) return false
  if (candidate.opt_out) return false

  const cond = rule.condition_json ?? {}

  if (rule.trigger === 'fit_score_high') {
    const minScore = typeof cond.minScore === 'number' ? cond.minScore : 70
    return (candidate.fit_score ?? 0) >= minScore
  }

  // No extra conditions for other triggers — caller controls which trigger to fire
  return true
}
