/**
 * Automation Engine
 * ──────────────────
 * Fires automation rules in response to triggers and runs stale-candidate
 * checks. All actions are gated on FREE_MODE / ALLOW_PAID_MESSAGING through
 * the underlying services (sendMessage, alertCoordinator).
 */

import { automationRulesDb, automationLogDb, candidatesDb } from '@/lib/db'
import { Candidate, AutomationRule } from '@/lib/types'
import { shouldFire } from '@/lib/automationRules'
import { sendMessage } from './whatsappService'
import { alertCoordinator, alertAdmin, sendThankYouToCandidate, sendReminderToCandidate, remindCoordinatorToContact } from './messagingService'

// ── fireTrigger ────────────────────────────────────────────────────────────

export async function fireTrigger(
  trigger: AutomationRule['trigger'],
  candidate: Candidate,
): Promise<void> {
  const allRules = await automationRulesDb.findActive()
  const matching = allRules.filter(r => r.trigger === trigger)

  for (const rule of matching) {
    if (!shouldFire(rule, candidate)) continue

    const firedAt = new Date().toISOString()
    let result = 'ok'

    try {
      if (rule.action === 'send_whatsapp') {
        // Use dedicated helpers when available (better template variable support)
        if (rule.template_key === 'thank_you_candidate') {
          await sendThankYouToCandidate(candidate.id)
        } else if (rule.template_key === 'reminder_to_candidate') {
          await sendReminderToCandidate(candidate.id)
        } else {
          await sendMessage(
            candidate.id,
            rule.template_key,
            {
              firstName: candidate.first_name,
              fullName: candidate.full_name,
              garin: candidate.garin || '',
            },
            candidate.phone,
          )
        }
      } else if (rule.action === 'notify_coordinator') {
        await alertCoordinator(candidate)
      } else if (rule.action === 'notify_admin') {
        await alertAdmin(candidate)
      } else if (rule.action === 'flag_priority') {
        await candidatesDb.update(candidate.id, { interest_level: 'very_hot' })
      }
    } catch (err: unknown) {
      result = err instanceof Error ? err.message : String(err)
      console.error(`[automationEngine] rule ${rule.id} failed:`, result)
    }

    // Audit log is best-effort: a missing automation_log table must not stop
    // the remaining rules from firing.
    try {
      await automationLogDb.create({
        candidate_id: candidate.id,
        rule_id: rule.id,
        fired_at: firedAt,
        result,
      })
    } catch (err) {
      console.error('[automationEngine] failed to write automation_log:', err)
    }
  }
}

// ── checkStaleCandidates ───────────────────────────────────────────────────

export async function checkStaleCandidates(): Promise<void> {
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

  const allCandidates = await candidatesDb.findAll({ status: 'questionnaire_sent' })
  const stale = allCandidates.filter(
    c => !c.opt_out && c.updated_at < threeDaysAgo,
  )

  for (const candidate of stale) {
    await fireTrigger('3_days_no_response', candidate)
  }
}

// ── runDailyFollowups ──────────────────────────────────────────────────────
// Remind coordinators to contact candidates whose recommended_contact_date is
// today (or already passed and not yet contacted). This is the piece that makes
// recommended_contact_date actionable instead of just a stored field.

export async function runDailyFollowups(): Promise<{ reminded: number }> {
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

  const all = await candidatesDb.findAll()
  const due = all.filter(c => {
    if (c.opt_out) return false
    if (!c.assigned_coordinator_id) return false
    if (!c.recommended_contact_date) return false
    // Only remind for candidates still awaiting contact
    const awaiting = ['questionnaire_completed', 'contact_pending', 'follow_up_later'].includes(c.status)
    if (!awaiting) return false
    // Due today or overdue (compare date portion only)
    const recDate = c.recommended_contact_date.split('T')[0]
    return recDate <= today
  })

  let reminded = 0
  for (const candidate of due) {
    try {
      await remindCoordinatorToContact(candidate)
      reminded++
    } catch (err) {
      console.error(`[automationEngine] runDailyFollowups failed for ${candidate.id}:`, err)
    }
  }

  return { reminded }
}
