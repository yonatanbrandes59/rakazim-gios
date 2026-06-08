/**
 * GET /api/automation-rules
 * Returns all automation rules (seeding defaults on first call if empty).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { automationRulesDb } from '@/lib/db'
import { DEFAULT_AUTOMATION_RULES } from '@/lib/automationRules'

const TRIGGER_LABELS: Record<string, string> = {
  candidate_created:      'מועמד חדש נוצר',
  questionnaire_completed: 'שאלון הושלם',
  '3_days_no_response':   '3 ימים ללא מענה',
  coordinator_assigned:   'שובצה רכזת',
  fit_score_high:         'ציון התאמה גבוה',
}

const ACTION_LABELS: Record<string, string> = {
  send_whatsapp:       'שלח WhatsApp',
  notify_coordinator:  'התרע לרכזת',
  notify_admin:        'התרע למנהל',
  flag_priority:       'סמן כעדיפות',
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(req)
  if (authResult instanceof NextResponse) return authResult

  let rules = await automationRulesDb.findAll()

  // Seed default rules on first run
  if (rules.length === 0) {
    for (const r of DEFAULT_AUTOMATION_RULES) {
      await automationRulesDb.create(r)
    }
    rules = await automationRulesDb.findAll()
  }

  // Enrich with human-readable labels for the UI
  const enriched = rules.map(rule => ({
    ...rule,
    name: TRIGGER_LABELS[rule.trigger] ?? rule.trigger,
    description: `פעולה: ${ACTION_LABELS[rule.action] ?? rule.action} · תבנית: ${rule.template_key}`,
  }))

  return NextResponse.json(enriched)
}
