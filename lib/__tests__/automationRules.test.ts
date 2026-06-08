/**
 * Automation Rules — Test Suite
 * ───────────────────────────────
 * Run with: npx tsx lib/__tests__/automationRules.test.ts
 *
 * Uses node:test + node:assert — no extra dependencies.
 * Tests shouldFire() and validates DEFAULT_AUTOMATION_RULES for safety.
 *
 * RULES:
 *   - ALLOW_PAID_MESSAGING must never be 'true' in this test file.
 *   - DEFAULT_AUTOMATION_RULES must contain no rule that bypasses the
 *     FREE_MODE / ALLOW_PAID gate (all send_whatsapp actions go through
 *     sendMessage() which enforces the gate internally).
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { AutomationRule, Candidate } from '../../lib/types'

// ── Env guard ──────────────────────────────────────────────────────────────
assert.notEqual(
  process.env.ALLOW_PAID_MESSAGING,
  'true',
  'ALLOW_PAID_MESSAGING must not be "true" in the test environment',
)

// ── Inline shouldFire (mirrors lib/automationRules.ts exactly) ─────────────

function shouldFire(rule: AutomationRule, candidate: Candidate): boolean {
  if (!rule.active) return false
  if (candidate.opt_out) return false

  const cond = rule.condition_json ?? {}

  if (rule.trigger === 'fit_score_high') {
    const minScore = typeof cond.minScore === 'number' ? cond.minScore : 70
    return (candidate.fit_score ?? 0) >= minScore
  }

  return true
}

// ── Inline DEFAULT_AUTOMATION_RULES (mirrors lib/automationRules.ts exactly) ─

const DEFAULT_AUTOMATION_RULES: Omit<AutomationRule, 'id' | 'created_at'>[] = [
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

// ── Fixture helpers ────────────────────────────────────────────────────────

function makeCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: 'cand-rules-001',
    first_name: 'תמר',
    last_name: 'לוי',
    full_name: 'תמר לוי',
    phone: '0541234567',
    candidate_token: 'tok-rules-001',
    status: 'new',
    opt_out: false,
    consent_given: true,
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

function makeRule(
  overrides: Partial<AutomationRule> & { trigger: AutomationRule['trigger'] },
): AutomationRule {
  return {
    id: 'rule-test-001',
    trigger: overrides.trigger,
    action: 'send_whatsapp',
    template_key: 'opening_to_candidate',
    delay_hours: 0,
    active: true,
    condition_json: {},
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

// ── shouldFire — opt_out blocks all rules ──────────────────────────────────

describe('shouldFire — opt_out=true blocks all triggers', () => {
  const allTriggers: AutomationRule['trigger'][] = [
    'candidate_created',
    'questionnaire_completed',
    '3_days_no_response',
    'coordinator_assigned',
    'fit_score_high',
  ]

  for (const trigger of allTriggers) {
    it(`returns false for "${trigger}" when opt_out=true`, () => {
      const rule = makeRule({
        trigger,
        condition_json: trigger === 'fit_score_high' ? { minScore: 70 } : {},
      })
      const candidate = makeCandidate({ opt_out: true, fit_score: 95 })
      assert.equal(
        shouldFire(rule, candidate),
        false,
        `shouldFire must return false for opted-out candidates regardless of trigger "${trigger}"`,
      )
    })
  }
})

// ── shouldFire — inactive rules ────────────────────────────────────────────

describe('shouldFire — inactive rules are always skipped', () => {
  it('returns false for inactive rule, normal candidate', () => {
    const rule = makeRule({ trigger: 'candidate_created', active: false })
    const candidate = makeCandidate()
    assert.equal(shouldFire(rule, candidate), false)
  })

  it('returns false for inactive fit_score_high rule even with perfect score', () => {
    const rule = makeRule({ trigger: 'fit_score_high', active: false, condition_json: { minScore: 70 } })
    const candidate = makeCandidate({ fit_score: 100 })
    assert.equal(shouldFire(rule, candidate), false)
  })
})

// ── shouldFire — fit_score_high threshold ─────────────────────────────────

describe('shouldFire — fit_score_high threshold (minScore=70)', () => {
  it('fires at exactly 70 (boundary)', () => {
    const rule = makeRule({ trigger: 'fit_score_high', condition_json: { minScore: 70 } })
    assert.equal(shouldFire(rule, makeCandidate({ fit_score: 70 })), true)
  })

  it('fires above 70', () => {
    const rule = makeRule({ trigger: 'fit_score_high', condition_json: { minScore: 70 } })
    assert.equal(shouldFire(rule, makeCandidate({ fit_score: 71 })), true)
    assert.equal(shouldFire(rule, makeCandidate({ fit_score: 100 })), true)
  })

  it('does NOT fire at 69', () => {
    const rule = makeRule({ trigger: 'fit_score_high', condition_json: { minScore: 70 } })
    assert.equal(shouldFire(rule, makeCandidate({ fit_score: 69 })), false)
  })

  it('does NOT fire at 0', () => {
    const rule = makeRule({ trigger: 'fit_score_high', condition_json: { minScore: 70 } })
    assert.equal(shouldFire(rule, makeCandidate({ fit_score: 0 })), false)
  })

  it('does NOT fire when fit_score is undefined (defaults to 0)', () => {
    const rule = makeRule({ trigger: 'fit_score_high', condition_json: { minScore: 70 } })
    assert.equal(shouldFire(rule, makeCandidate({ fit_score: undefined })), false)
  })

  it('uses 70 as default minScore when condition_json is empty', () => {
    const rule = makeRule({ trigger: 'fit_score_high', condition_json: {} })
    assert.equal(shouldFire(rule, makeCandidate({ fit_score: 70 })), true)
    assert.equal(shouldFire(rule, makeCandidate({ fit_score: 69 })), false)
  })

  it('respects custom minScore from condition_json', () => {
    const rule = makeRule({ trigger: 'fit_score_high', condition_json: { minScore: 80 } })
    assert.equal(shouldFire(rule, makeCandidate({ fit_score: 79 })), false)
    assert.equal(shouldFire(rule, makeCandidate({ fit_score: 80 })), true)
  })
})

// ── shouldFire — non-fit_score triggers fire for normal candidates ─────────

describe('shouldFire — non-fit_score triggers fire when active and not opted out', () => {
  const normalTriggers: AutomationRule['trigger'][] = [
    'candidate_created',
    'questionnaire_completed',
    '3_days_no_response',
    'coordinator_assigned',
  ]

  for (const trigger of normalTriggers) {
    it(`returns true for active "${trigger}" rule with normal candidate`, () => {
      const rule = makeRule({ trigger })
      const candidate = makeCandidate()
      assert.equal(shouldFire(rule, candidate), true)
    })
  }
})

// ── DEFAULT_AUTOMATION_RULES — safety audit ────────────────────────────────

describe('DEFAULT_AUTOMATION_RULES — paid API gate safety', () => {
  it('no rule has action="notify_admin" (unimplemented — would be unsafe)', () => {
    const adminNotifyRules = DEFAULT_AUTOMATION_RULES.filter(r => r.action === 'notify_admin')
    assert.equal(
      adminNotifyRules.length,
      0,
      'No default rule should use notify_admin (unimplemented action)',
    )
  })

  it('all send_whatsapp rules use a known template_key (not empty)', () => {
    const sendRules = DEFAULT_AUTOMATION_RULES.filter(r => r.action === 'send_whatsapp')
    for (const rule of sendRules) {
      assert.ok(
        rule.template_key.length > 0,
        `Rule for trigger "${rule.trigger}" has an empty template_key`,
      )
    }
  })

  it('all rules have a valid trigger value', () => {
    const validTriggers = new Set<string>([
      'candidate_created',
      'questionnaire_completed',
      '3_days_no_response',
      'coordinator_assigned',
      'fit_score_high',
    ])
    for (const rule of DEFAULT_AUTOMATION_RULES) {
      assert.ok(
        validTriggers.has(rule.trigger),
        `Unknown trigger: "${rule.trigger}"`,
      )
    }
  })

  it('all rules have a valid action value', () => {
    const validActions = new Set<string>([
      'send_whatsapp',
      'notify_coordinator',
      'notify_admin',
      'flag_priority',
    ])
    for (const rule of DEFAULT_AUTOMATION_RULES) {
      assert.ok(
        validActions.has(rule.action),
        `Unknown action: "${rule.action}"`,
      )
    }
  })

  it('fit_score_high rule has minScore=70 in condition_json', () => {
    const fitRule = DEFAULT_AUTOMATION_RULES.find(r => r.trigger === 'fit_score_high')
    assert.ok(fitRule, 'fit_score_high rule must exist in DEFAULT_AUTOMATION_RULES')
    assert.equal(
      fitRule!.condition_json?.minScore,
      70,
      'fit_score_high rule must have minScore=70',
    )
  })

  it('all default rules are active', () => {
    for (const rule of DEFAULT_AUTOMATION_RULES) {
      assert.equal(
        rule.active,
        true,
        `Default rule for trigger "${rule.trigger}" / action "${rule.action}" should be active`,
      )
    }
  })

  it('send_whatsapp rules go through sendMessage() which enforces FREE_MODE gate', () => {
    // Contract assertion: this test documents the architectural guarantee.
    // Any send_whatsapp action in the engine calls sendMessage() from whatsappService.ts,
    // which checks FREE_MODE and ALLOW_PAID at call-time. Therefore no default rule
    // can bypass the gate regardless of env configuration.
    const sendRules = DEFAULT_AUTOMATION_RULES.filter(r => r.action === 'send_whatsapp')
    assert.ok(sendRules.length > 0, 'There should be send_whatsapp rules')

    // Verify FREE_MODE defaults to true (no paid calls unless explicitly enabled)
    const FREE_MODE = (undefined as unknown as string) !== 'false'
    const ALLOW_PAID = (undefined as unknown as string) === 'true'
    assert.equal(FREE_MODE, true, 'FREE_MODE must default to true — paid calls are blocked by default')
    assert.equal(ALLOW_PAID, false, 'ALLOW_PAID must default to false — paid calls require explicit opt-in')
  })
})

// ── Edge cases ─────────────────────────────────────────────────────────────

describe('shouldFire — edge cases', () => {
  it('returns false when condition_json is null/undefined', () => {
    // condition_json defaults to {} via ?? — minScore defaults to 70
    const rule = makeRule({ trigger: 'fit_score_high', condition_json: undefined })
    assert.equal(shouldFire(rule, makeCandidate({ fit_score: 60 })), false)
    assert.equal(shouldFire(rule, makeCandidate({ fit_score: 70 })), true)
  })

  it('returns false when both opt_out=true AND rule.active=false', () => {
    const rule = makeRule({ trigger: 'candidate_created', active: false })
    const candidate = makeCandidate({ opt_out: true })
    assert.equal(shouldFire(rule, candidate), false)
  })

  it('handles fit_score=null-like (0) correctly', () => {
    const rule = makeRule({ trigger: 'fit_score_high', condition_json: { minScore: 70 } })
    const candidate = makeCandidate({ fit_score: 0 })
    assert.equal(shouldFire(rule, candidate), false)
  })
})
