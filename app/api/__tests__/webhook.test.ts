/**
 * WhatsApp Webhook Route — Test Suite
 * ─────────────────────────────────────
 * Run with: npx tsx app/api/__tests__/webhook.test.ts
 *
 * Uses node:test + node:assert — no extra dependencies.
 * Tests the GET (hub verification) and POST (incoming message) handlers
 * using the inline logic extracted from app/api/whatsapp/webhook/route.ts.
 *
 * Key security checks:
 *   - GET and POST must NOT require auth cookies (Meta calls without them)
 *   - POST with invalid signature → 403
 *   - POST opt-out keyword detection ('לא מעוניין', 'stop' case-insensitive)
 *   - POST always returns 200 even if candidate not found
 *   - POST persists ConversationMessage with direction='in'
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import type { Candidate, ConversationMessage } from '../../../lib/types'

// ── Env guard ──────────────────────────────────────────────────────────────
assert.notEqual(
  process.env.ALLOW_PAID_MESSAGING,
  'true',
  'ALLOW_PAID_MESSAGING must not be "true" in the test environment',
)

// ── Phone normalisation (mirrors the route's inline function exactly) ──────

function normalizePhone(phone: string): string {
  const d = phone.replace(/\D/g, '')
  return d.startsWith('0') ? '972' + d.slice(1) : d
}

// ── parseIncoming (mirrors whatsappService.ts) ─────────────────────────────

function parseIncoming(
  webhookBody: unknown,
): { phone: string; messageId: string; body: string; timestamp: number } | null {
  try {
    const payload = webhookBody as Record<string, unknown>
    const entry = (payload.entry as unknown[])?.[0] as Record<string, unknown>
    const changes = (entry?.changes as unknown[])?.[0] as Record<string, unknown>
    const value = changes?.value as Record<string, unknown>
    const messages = value?.messages as unknown[]
    const msg = messages?.[0] as Record<string, unknown>
    if (!msg) return null
    const phone = (msg.from as string) ?? ''
    const messageId = (msg.id as string) ?? ''
    const timestamp = Number(msg.timestamp ?? 0)
    const text = msg.text as Record<string, unknown> | undefined
    const body = (text?.body as string) ?? ''
    if (!phone || !messageId) return null
    return { phone, messageId, body, timestamp }
  } catch {
    return null
  }
}

// ── verifyWebhookSignature ─────────────────────────────────────────────────

function verifyWebhookSignature(rawBody: string, sigHeader: string, secret?: string): boolean {
  if (!secret) return true
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(sigHeader), Buffer.from(expected))
  } catch {
    return false
  }
}

// ── Simulate GET handler ────────────────────────────────────────────────────

function simulateGET(params: Record<string, string | null>, verifyToken: string | undefined): { status: number; body: string } {
  const mode = params['hub.mode']
  const token = params['hub.verify_token']
  const challenge = params['hub.challenge']

  if (mode === 'subscribe' && token === verifyToken) {
    return { status: 200, body: challenge ?? '' }
  }
  return { status: 403, body: 'Forbidden' }
}

// ── Opt-out keyword detection (mirrors the route exactly) ──────────────────

function detectOptOut(body: string): boolean {
  const optOutKeywords = ['לא מעוניין', 'הסר', 'בטל', 'stop', 'STOP']
  return optOutKeywords.some(kw => body.toLowerCase().includes(kw.toLowerCase()))
}

// ── In-memory conversation store for POST tests ───────────────────────────

class ConversationStore {
  messages: ConversationMessage[] = []

  create(data: Omit<ConversationMessage, 'id' | 'created_at'>): ConversationMessage {
    const msg: ConversationMessage = {
      ...data,
      id: `msg-${this.messages.length + 1}`,
      created_at: new Date().toISOString(),
    }
    this.messages.push(msg)
    return msg
  }

  findByDirection(direction: 'in' | 'out'): ConversationMessage[] {
    return this.messages.filter(m => m.direction === direction)
  }

  reset() { this.messages = [] }
}

// ── Simulate POST handler ──────────────────────────────────────────────────

interface SimulatedCandidate extends Partial<Candidate> {
  id: string
  phone: string
  opt_out: boolean
}

function simulatePOST(opts: {
  rawBody: string
  sigHeader: string
  appSecret?: string
  candidates: SimulatedCandidate[]
  store: ConversationStore
  optOutCalls: Array<{ id: string; opt_out: boolean }>
}): { status: number; body: string; optOutCalls: Array<{ id: string; opt_out: boolean }> } {
  const { rawBody, sigHeader, appSecret, candidates, store, optOutCalls } = opts

  // Signature check
  if (!verifyWebhookSignature(rawBody, sigHeader, appSecret)) {
    return { status: 403, body: 'Forbidden', optOutCalls }
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return { status: 200, body: 'OK', optOutCalls }
  }

  const parsed = parseIncoming(payload)
  if (!parsed) {
    return { status: 200, body: 'OK', optOutCalls }
  }

  const { phone, messageId, body, timestamp } = parsed
  const normalizedIncoming = normalizePhone(phone)

  // Find candidate
  const candidate = candidates.find(c => normalizePhone(c.phone) === normalizedIncoming)
  const candidateId = candidate?.id ?? 'unknown'
  const sentAt = timestamp
    ? new Date(timestamp * 1000).toISOString()
    : new Date().toISOString()

  // Always persist the incoming message
  store.create({
    candidate_id: candidateId,
    direction: 'in',
    body,
    sent_at: sentAt,
    status: 'received',
    wa_message_id: messageId,
  })

  if (candidate) {
    if (detectOptOut(body)) {
      optOutCalls.push({ id: candidate.id, opt_out: true })
    }
  }

  // Always 200
  return { status: 200, body: 'OK', optOutCalls }
}

// ── Build a valid Meta payload ─────────────────────────────────────────────

function buildMetaPayload(phone: string, body: string, msgId = 'wamid.test001') {
  return JSON.stringify({
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  from: phone,
                  id: msgId,
                  timestamp: '1700000000',
                  text: { body },
                },
              ],
            },
          },
        ],
      },
    ],
  })
}

// ── GET — webhook verification tests ───────────────────────────────────────

describe('GET /api/whatsapp/webhook — hub challenge verification', () => {
  it('returns 200 with challenge when mode=subscribe and token matches', () => {
    const result = simulateGET(
      { 'hub.mode': 'subscribe', 'hub.verify_token': 'mySecret', 'hub.challenge': '12345' },
      'mySecret',
    )
    assert.equal(result.status, 200)
    assert.equal(result.body, '12345')
  })

  it('returns 403 when verify_token does not match', () => {
    const result = simulateGET(
      { 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong', 'hub.challenge': '12345' },
      'mySecret',
    )
    assert.equal(result.status, 403)
  })

  it('returns 403 when mode is not "subscribe"', () => {
    const result = simulateGET(
      { 'hub.mode': 'unsubscribe', 'hub.verify_token': 'mySecret', 'hub.challenge': '12345' },
      'mySecret',
    )
    assert.equal(result.status, 403)
  })

  it('returns 403 when both mode and token are null', () => {
    const result = simulateGET(
      { 'hub.mode': null, 'hub.verify_token': null, 'hub.challenge': null },
      'mySecret',
    )
    assert.equal(result.status, 403)
  })

  it('does NOT check auth cookie (no requireAuth in GET handler)', () => {
    // The route file has no requireAuth call in GET — verify by inspecting the logic:
    // simulateGET only checks hub.verify_token, not any auth header or cookie.
    // This test documents the contract: it must work without a cookie.
    const result = simulateGET(
      { 'hub.mode': 'subscribe', 'hub.verify_token': 'tok', 'hub.challenge': 'abc' },
      'tok',
    )
    assert.equal(result.status, 200, 'GET must not require auth cookie')
  })
})

// ── POST — incoming message handler tests ─────────────────────────────────

describe('POST /api/whatsapp/webhook — incoming message handling', () => {
  const store = new ConversationStore()
  const candidates: SimulatedCandidate[] = [
    { id: 'cand-001', phone: '0521234567', opt_out: false },
    { id: 'cand-002', phone: '0541111111', opt_out: false },
  ]

  it('returns 403 when HMAC signature is invalid', () => {
    store.reset()
    const secret = 'webhook-secret'
    const rawBody = buildMetaPayload('0521234567', 'שלום')
    const fakeSignature = 'sha256=' + 'a'.repeat(64)
    const { status } = simulatePOST({ rawBody, sigHeader: fakeSignature, appSecret: secret, candidates, store, optOutCalls: [] })
    assert.equal(status, 403)
  })

  it('returns 200 for valid signature', () => {
    store.reset()
    const secret = 'webhook-secret'
    const rawBody = buildMetaPayload('0521234567', 'שלום')
    const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
    const { status } = simulatePOST({ rawBody, sigHeader: sig, appSecret: secret, candidates, store, optOutCalls: [] })
    assert.equal(status, 200)
  })

  it('returns 200 even when candidate is not found in DB', () => {
    store.reset()
    const rawBody = buildMetaPayload('0599999999', 'hello') // unknown phone
    const { status } = simulatePOST({ rawBody, sigHeader: '', appSecret: undefined, candidates, store, optOutCalls: [] })
    assert.equal(status, 200, 'Meta webhook must always receive 200')
  })

  it('returns 200 for unparseable JSON body', () => {
    store.reset()
    const { status } = simulatePOST({ rawBody: 'not json', sigHeader: '', appSecret: undefined, candidates, store, optOutCalls: [] })
    assert.equal(status, 200)
  })

  it('persists ConversationMessage with direction="in"', () => {
    store.reset()
    const rawBody = buildMetaPayload('0521234567', 'תגובה')
    simulatePOST({ rawBody, sigHeader: '', appSecret: undefined, candidates, store, optOutCalls: [] })
    const inbound = store.findByDirection('in')
    assert.equal(inbound.length, 1)
    assert.equal(inbound[0].direction, 'in')
    assert.equal(inbound[0].body, 'תגובה')
  })

  it('persists message with wa_message_id from webhook payload', () => {
    store.reset()
    const rawBody = buildMetaPayload('0521234567', 'hi', 'wamid.SPECIFIC001')
    simulatePOST({ rawBody, sigHeader: '', appSecret: undefined, candidates, store, optOutCalls: [] })
    assert.equal(store.messages[0].wa_message_id, 'wamid.SPECIFIC001')
  })

  it('persists message with candidate_id="unknown" when candidate not found', () => {
    store.reset()
    const rawBody = buildMetaPayload('0599000000', 'mystery')
    simulatePOST({ rawBody, sigHeader: '', appSecret: undefined, candidates, store, optOutCalls: [] })
    assert.equal(store.messages[0].candidate_id, 'unknown')
  })

  it('sets opt_out=true on "לא מעוניין" keyword', () => {
    store.reset()
    const optOutCalls: Array<{ id: string; opt_out: boolean }> = []
    const rawBody = buildMetaPayload('0521234567', 'לא מעוניין')
    simulatePOST({ rawBody, sigHeader: '', appSecret: undefined, candidates, store, optOutCalls })
    assert.equal(optOutCalls.length, 1)
    assert.equal(optOutCalls[0].id, 'cand-001')
    assert.equal(optOutCalls[0].opt_out, true)
  })

  it('sets opt_out=true on "stop" keyword (case-insensitive)', () => {
    store.reset()
    const optOutCalls: Array<{ id: string; opt_out: boolean }> = []
    const rawBody = buildMetaPayload('0521234567', 'Stop please')
    simulatePOST({ rawBody, sigHeader: '', appSecret: undefined, candidates, store, optOutCalls })
    assert.equal(optOutCalls.length, 1)
    assert.equal(optOutCalls[0].opt_out, true)
  })

  it('sets opt_out=true on "STOP" keyword', () => {
    store.reset()
    const optOutCalls: Array<{ id: string; opt_out: boolean }> = []
    const rawBody = buildMetaPayload('0521234567', 'STOP')
    simulatePOST({ rawBody, sigHeader: '', appSecret: undefined, candidates, store, optOutCalls })
    assert.equal(optOutCalls.length, 1)
  })

  it('does NOT set opt_out for non-opt-out messages', () => {
    store.reset()
    const optOutCalls: Array<{ id: string; opt_out: boolean }> = []
    const rawBody = buildMetaPayload('0521234567', 'שלום, אני מתעניין!')
    simulatePOST({ rawBody, sigHeader: '', appSecret: undefined, candidates, store, optOutCalls })
    assert.equal(optOutCalls.length, 0, 'Should not opt out for a normal message')
  })

  it('does NOT set opt_out when candidate is unknown', () => {
    store.reset()
    const optOutCalls: Array<{ id: string; opt_out: boolean }> = []
    const rawBody = buildMetaPayload('0599000000', 'stop')
    simulatePOST({ rawBody, sigHeader: '', appSecret: undefined, candidates, store, optOutCalls })
    assert.equal(optOutCalls.length, 0, 'Cannot opt out an unknown candidate')
  })

  it('normalizes 05x phone format to match 9725x in candidate lookup', () => {
    store.reset()
    const optOutCalls: Array<{ id: string; opt_out: boolean }> = []
    // cand-001 has phone '0521234567' → normalized to '972521234567'
    // incoming phone is already '972521234567'
    const rawBody = buildMetaPayload('972521234567', 'שלום')
    simulatePOST({ rawBody, sigHeader: '', appSecret: undefined, candidates, store, optOutCalls })
    // Message should be linked to cand-001
    assert.equal(store.messages[0].candidate_id, 'cand-001')
  })

  it('does NOT require auth cookie (no requireAuth in POST handler)', () => {
    // Document contract: POST processes without any Authorization / cookie header.
    // The simulatePOST function does not check for auth — this is intentional.
    store.reset()
    const rawBody = buildMetaPayload('0541111111', 'היי')
    const { status } = simulatePOST({
      rawBody,
      sigHeader: '',
      appSecret: undefined, // no secret → dev mode → passes signature check
      candidates,
      store,
      optOutCalls: [],
    })
    assert.equal(status, 200, 'POST webhook must not require auth cookie')
  })
})

// ── Opt-out keyword detection ──────────────────────────────────────────────

describe('detectOptOut — keyword matching', () => {
  it('detects "לא מעוניין" exactly', () => {
    assert.equal(detectOptOut('לא מעוניין'), true)
  })

  it('detects "לא מעוניין" within a longer sentence', () => {
    assert.equal(detectOptOut('אני לא מעוניין להמשיך'), true)
  })

  it('detects "stop" case-insensitively', () => {
    assert.equal(detectOptOut('Stop'), true)
    assert.equal(detectOptOut('STOP'), true)
    assert.equal(detectOptOut('stop'), true)
    assert.equal(detectOptOut('please stop now'), true)
  })

  it('detects "הסר"', () => {
    assert.equal(detectOptOut('הסר אותי'), true)
  })

  it('detects "בטל"', () => {
    assert.equal(detectOptOut('בטל הרשמה'), true)
  })

  it('returns false for normal messages', () => {
    assert.equal(detectOptOut('שלום, אני מעוניין לשמוע עוד'), false)
    assert.equal(detectOptOut('מה שלומך?'), false)
    assert.equal(detectOptOut(''), false)
  })
})

// ── normalizePhone — both directions ──────────────────────────────────────

describe('normalizePhone — phone normalisation for webhook matching', () => {
  it('converts 05x to 9725x', () => {
    assert.equal(normalizePhone('0521234567'), '972521234567')
  })

  it('leaves 9725x unchanged', () => {
    assert.equal(normalizePhone('972521234567'), '972521234567')
  })

  it('strips non-digit characters', () => {
    assert.equal(normalizePhone('+972-52-1234567'), '972521234567')
  })

  it('05x and +9725x normalize to the same value', () => {
    // 0521234567 → strip non-digits → '0521234567' → starts with 0 → '972521234567'
    // +972521234567 → strip non-digits → '972521234567' → doesn't start with 0 → '972521234567'
    assert.equal(normalizePhone('0521234567'), normalizePhone('+972521234567'))
  })
})
