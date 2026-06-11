/**
 * GET /api/automation-rules
 * Returns all automation rules (seeding defaults on first call if empty).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { automationRulesDb } from '@/lib/db'
import { DEFAULT_AUTOMATION_RULES } from '@/lib/automationRules'

const TRIGGER_LABELS: Record<string, string> = {
  candidate_created:       'מועמד חדש נוצר',
  questionnaire_completed: 'שאלון הושלם',
  '3_days_no_response':    '3 ימים ללא מענה',
  coordinator_assigned:    'שובץ רכז/ת לאזור',
  fit_score_high:          'מועמד חם / עניין גבוה',
}

const ACTION_LABELS: Record<string, string> = {
  send_whatsapp:       '💬 שלח WhatsApp למועמד',
  notify_coordinator:  '📣 הודעה לרכז/ת האזורי/ת',
  notify_admin:        '🔔 הודעה למנהל',
  flag_priority:       '🔴 סמן כעדיפות גבוהה',
}

const RULE_DESCRIPTIONS: Record<string, Record<string, string>> = {
  candidate_created: {
    notify_admin:       'כשנרשם מועמד חדש — מנהל המערכת מקבל התראה',
    send_whatsapp:      'כשנרשם מועמד חדש — נשלח אליו WhatsApp פתיחה',
    notify_coordinator: 'כשנרשם מועמד חדש — רכז/ת האזור מקבל/ת הודעה',
  },
  questionnaire_completed: {
    send_whatsapp:      'לאחר מילוי השאלון — נשלחת תודה אוטומטית למועמד',
    notify_coordinator: 'לאחר מילוי השאלון — רכז/ת האזור מקבל/ת עדכון',
    notify_admin:       'לאחר מילוי השאלון — מנהל המערכת מקבל התראה',
  },
  '3_days_no_response': {
    send_whatsapp:      'אחרי 3 ימים ללא מענה לשאלון — נשלחת תזכורת אוטומטית',
  },
  coordinator_assigned: {
    notify_coordinator: 'כששובץ/ה רכז/ת לאזור — רכז/ת מקבל/ת הודעה על מועמד חדש',
  },
  fit_score_high: {
    flag_priority:      'כשמועמד מסמן עניין גבוה — הוא מסומן אוטומטית כעדיפות גבוהה',
    notify_coordinator: 'כשמועמד מסמן עניין גבוה — רכז/ת האזור מקבל/ת התראה מיידית',
  },
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(req)
  if (authResult instanceof NextResponse) return authResult

  let rules = await automationRulesDb.findAll()

  // Seed default rules on first run. Best-effort: if the automation_rules
  // table is missing in Supabase, findAll already served the defaults
  // fallback — never let a failed seed 500 this route.
  if (rules.length === 0) {
    try {
      for (const r of DEFAULT_AUTOMATION_RULES) {
        await automationRulesDb.create(r)
      }
      rules = await automationRulesDb.findAll()
    } catch (err) {
      console.error('[automation-rules] seeding failed (serving defaults):', err)
      rules = await automationRulesDb.findAll()
    }
  }

  // Enrich with human-readable labels for the UI
  const enriched = rules.map(rule => ({
    ...rule,
    name: `${TRIGGER_LABELS[rule.trigger] ?? rule.trigger} → ${ACTION_LABELS[rule.action] ?? rule.action}`,
    description: RULE_DESCRIPTIONS[rule.trigger]?.[rule.action]
      ?? `תבנית: ${rule.template_key}${rule.delay_hours > 0 ? ` · עיכוב: ${rule.delay_hours} שעות` : ''}`,
  }))

  return NextResponse.json(enriched)
}
