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
import { alertCoordinator } from './messagingService'

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
      } else if (rule.action === 'notify_coordinator') {
        await alertCoordinator(candidate)
      } else if (rule.action === 'flag_priority') {
        await candidatesDb.update(candidate.id, { interest_level: 'very_hot' })
      }
      // notify_admin: future implementation
    } catch (err: unknown) {
      result = err instanceof Error ? err.message : String(err)
      console.error(`[automationEngine] rule ${rule.id} failed:`, result)
    }

    await automationLogDb.create({
      candidate_id: candidate.id,
      rule_id: rule.id,
      fired_at: firedAt,
      result,
    })
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
