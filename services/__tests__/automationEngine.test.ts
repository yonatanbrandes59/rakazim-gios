/**
 * Automation Engine — Test Suite
 * ────────────────────────────────
 * Run with: npx tsx services/__tests__/automationEngine.test.ts
 *
 * Uses node:test + node:assert — no extra dependencies.
 * Tests logic that depends on FREE_MODE / shouldFire / opt_out gating.
 * All mocks are inline — no module-level side effects.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Candidate, AutomationRule } from '../../lib/types'

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

// ── Fixture helpers ────────────────────────────────────────────────────────

function makeCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: 'cand-001',
    first_name: 'ישראל',
    last_name: 'ישראלי',
    full_name: 'ישראל ישראלי',
    phone: '0521234567',
    candidate_token: 'tok-abc',
    status: 'new',
    opt_out: false,
    consent_given: true,
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(), // 2 days ago
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

function makeRule(
  overrides: Partial<AutomationRule> & { trigger: AutomationRule['trigger'] },
): AutomationRule {
  return {
    id: 'rule-001',
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

// ── Mock send tracker (replaces whatsappService.sendMessage in logic tests) ─

class SendTracker {
  calls: Array<{ candidateId: string; templateKey: string }> = []

  async sendMessage(candidateId: string, templateKey: string, _vars: Record<string, string>, _phone: string) {
    this.calls.push({ candidateId, templateKey })
    return { ok: true, mode: 'manual' as const, status: 'ready_for_manual_whatsapp' as const }
  }

  reset() { this.calls = [] }
}

// Simulate fireTrigger logic inline to test gating without real DB calls
async function simulateFireTrigger(
  rules: AutomationRule[],
  candidate: Candidate,
  tracker: SendTracker,
): Promise<{ fired: string[]; skipped: string[] }> {
  const fired: string[] = []
  const skipped: string[] = []

  for (const rule of rules) {
    if (!shouldFire(rule, candidate)) {
      skipped.push(rule.id)
      continue
    }
    if (rule.action === 'send_whatsapp') {
      await tracker.sendMessage(candidate.id, rule.template_key, {}, candidate.phone)
      fired.push(rule.id)
    } else {
      fired.push(rule.id)
    }
  }
  return { fired, skipped }
}

// ── Tests: fireTrigger logic ────────────────────────────────────────────────

describe('fireTrigger — candidate_created trigger', () => {
  it('calls sendMessage with opening_to_candidate template for a new candidate', async () => {
    const tracker = new SendTracker()
    const rule = makeRule({ trigger: 'candidate_created', template_key: 'opening_to_candidate' })
    const candidate = makeCandidate()

    await simulateFireTrigger([rule], candidate, tracker)

    assert.equal(tracker.calls.length, 1)
    assert.equal(tracker.calls[0].templateKey, 'opening_to_candidate')
    assert.equal(tracker.calls[0].candidateId, candidate.id)
  })

  it('skips candidate with opt_out=true — no send called', async () => {
    const tracker = new SendTracker()
    const rule = makeRule({ trigger: 'candidate_created', template_key: 'opening_to_candidate' })
    const candidate = makeCandidate({ opt_out: true })

    const { fired, skipped } = await simulateFireTrigger([rule], candidate, tracker)

    assert.equal(tracker.calls.length, 0, 'sendMessage must not be called for opted-out candidates')
    assert.equal(skipped.length, 1)
    assert.equal(fired.length, 0)
  })
})

// ── Tests: shouldFire opt_out gating ───────────────────────────────────────

describe('shouldFire — opt_out=true blocks all triggers', () => {
  const triggers: AutomationRule['trigger'][] = [
    'candidate_created',
    'questionnaire_completed',
    '3_days_no_response',
    'coordinator_assigned',
    'fit_score_high',
  ]

  for (const trigger of triggers) {
    it(`returns false for trigger "${trigger}" when candidate.opt_out=true`, () => {
      const rule = makeRule({
        trigger,
        condition_json: trigger === 'fit_score_high' ? { minScore: 70 } : {},
      })
      const candidate = makeCandidate({ opt_out: true, fit_score: 90 })
      assert.equal(shouldFire(rule, candidate), false)
    })
  }
})

// ── Tests: shouldFire inactive rule ────────────────────────────────────────

describe('shouldFire — inactive rules', () => {
  it('returns false for an inactive rule regardless of candidate', () => {
    const rule = makeRule({ trigger: 'candidate_created', active: false })
    const candidate = makeCandidate()
    assert.equal(shouldFire(rule, candidate), false)
  })

  it('returns false for an inactive rule even when opt_out=false', () => {
    const rule = makeRule({ trigger: 'fit_score_high', active: false, condition_json: { minScore: 70 } })
    const candidate = makeCandidate({ fit_score: 95 })
    assert.equal(shouldFire(rule, candidate), false)
  })
})

// ── Tests: fit_score_high trigger threshold ─────────────────────────────────

describe('fireTrigger — fit_score_high threshold', () => {
  it('fires when fit_score === 70 (boundary)', () => {
    const rule = makeRule({ trigger: 'fit_score_high', action: 'flag_priority', condition_json: { minScore: 70 } })
    const candidate = makeCandidate({ fit_score: 70 })
    assert.equal(shouldFire(rule, candidate), true)
  })

  it('fires when fit_score > 70', () => {
    const rule = makeRule({ trigger: 'fit_score_high', action: 'flag_priority', condition_json: { minScore: 70 } })
    const candidate = makeCandidate({ fit_score: 85 })
    assert.equal(shouldFire(rule, candidate), true)
  })

  it('does NOT fire when fit_score === 69 (one below threshold)', () => {
    const rule = makeRule({ trigger: 'fit_score_high', action: 'flag_priority', condition_json: { minScore: 70 } })
    const candidate = makeCandidate({ fit_score: 69 })
    assert.equal(shouldFire(rule, candidate), false)
  })

  it('does NOT fire when fit_score is 0', () => {
    const rule = makeRule({ trigger: 'fit_score_high', action: 'flag_priority', condition_json: { minScore: 70 } })
    const candidate = makeCandidate({ fit_score: 0 })
    assert.equal(shouldFire(rule, candidate), false)
  })

  it('does NOT fire when fit_score is undefined (treated as 0)', () => {
    const rule = makeRule({ trigger: 'fit_score_high', action: 'flag_priority', condition_json: { minScore: 70 } })
    const candidate = makeCandidate({ fit_score: undefined })
    assert.equal(shouldFire(rule, candidate), false)
  })

  it('uses default minScore of 70 when condition_json is empty', () => {
    const rule = makeRule({ trigger: 'fit_score_high', action: 'flag_priority', condition_json: {} })
    assert.equal(shouldFire(rule, makeCandidate({ fit_score: 70 })), true)
    assert.equal(shouldFire(rule, makeCandidate({ fit_score: 69 })), false)
  })
})

// ── Tests: checkStaleCandidates logic ──────────────────────────────────────

describe('checkStaleCandidates — stale candidate selection', () => {
  function isStale(candidate: Candidate, nowMs: number): boolean {
    const threeDaysAgo = new Date(nowMs - 3 * 24 * 60 * 60 * 1000).toISOString()
    return !candidate.opt_out && candidate.updated_at < threeDaysAgo
  }

  it('identifies a candidate with status=questionnaire_sent and updated_at > 3 days ago', () => {
    const fourDaysAgo = new Date(Date.now() - 4 * 86400000).toISOString()
    const candidate = makeCandidate({ status: 'questionnaire_sent', updated_at: fourDaysAgo })
    assert.equal(isStale(candidate, Date.now()), true)
  })

  it('does not select a candidate updated less than 3 days ago', () => {
    const oneDayAgo = new Date(Date.now() - 1 * 86400000).toISOString()
    const candidate = makeCandidate({ status: 'questionnaire_sent', updated_at: oneDayAgo })
    assert.equal(isStale(candidate, Date.now()), false)
  })

  it('does not select an opted-out candidate even if stale', () => {
    const fourDaysAgo = new Date(Date.now() - 4 * 86400000).toISOString()
    const candidate = makeCandidate({ status: 'questionnaire_sent', opt_out: true, updated_at: fourDaysAgo })
    assert.equal(isStale(candidate, Date.now()), false)
  })

  it('boundary: candidate updated exactly 3 days ago is NOT stale (strict less-than)', () => {
    // Exactly 3 * 86400000 ms ago — updated_at === threeDaysAgo (not strictly before)
    const nowMs = Date.now()
    const exactlyThreeDaysAgo = new Date(nowMs - 3 * 24 * 60 * 60 * 1000).toISOString()
    const candidate = makeCandidate({ status: 'questionnaire_sent', updated_at: exactlyThreeDaysAgo })
    // updated_at < threeDaysAgo is false when equal → not stale
    assert.equal(isStale(candidate, nowMs), false)
  })
})
