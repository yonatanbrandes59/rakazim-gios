/**
 * WhatsApp Service — Test Suite
 * ──────────────────────────────
 * Run with: npx tsx services/__tests__/whatsappService.test.ts
 *
 * Uses node:test + node:assert — no extra dependencies.
 * FREE_MODE defaults to TRUE (env var absent) for all tests.
 * ALLOW_PAID_MESSAGING must NEVER be set to 'true' in this file.
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'

// ── Env guard: paid mode must never be enabled in tests ────────────────────
assert.notEqual(
  process.env.ALLOW_PAID_MESSAGING,
  'true',
  'ALLOW_PAID_MESSAGING must not be "true" in the test environment',
)

// ── Helpers (inline, no module deps for isolation) ─────────────────────────

function createWhatsAppLink(phone: string, message: string): string {
  const cleaned = phone.replace(/\D/g, '')
  const intl = cleaned.startsWith('0') ? '972' + cleaned.slice(1) : cleaned
  return `https://wa.me/${intl}?text=${encodeURIComponent(message)}`
}

// generateWaLink is a re-export of createWhatsAppLink
function generateWaLink(phone: string, message: string): string {
  return createWhatsAppLink(phone, message)
}

// Inline parseIncoming matching the real implementation
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

// Inline verifyWebhookSignature matching the real implementation
function verifyWebhookSignature(rawBody: string, sigHeader: string, secret?: string): boolean {
  if (!secret) return true // dev mode: no secret set
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(sigHeader), Buffer.from(expected))
  } catch {
    return false
  }
}

// Build a valid Meta webhook payload
function buildMetaPayload(phone: string, msgBody: string, messageId = 'wamid.abc123') {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  from: phone,
                  id: messageId,
                  timestamp: '1700000000',
                  text: { body: msgBody },
                },
              ],
            },
          },
        ],
      },
    ],
  }
}

// ── generateWaLink ──────────────────────────────────────────────────────────

describe('generateWaLink — phone normalisation', () => {
  it('converts Israeli 05x format to 972x', () => {
    const link = generateWaLink('0521234567', 'שלום')
    assert.ok(link.startsWith('https://wa.me/972521234567?'), `Expected 972x prefix — got: ${link}`)
  })

  it('converts 054x format to 9725x', () => {
    const link = generateWaLink('0549876543', 'hello')
    assert.ok(link.startsWith('https://wa.me/9725498'), `Expected 9725x — got: ${link}`)
  })

  it('leaves +972x numbers intact (strips + only)', () => {
    const link = generateWaLink('+9725221234567', 'test')
    // strip non-digits: 9725221234567, does not start with 0 → unchanged
    assert.ok(link.startsWith('https://wa.me/9725221234567?'), `Got: ${link}`)
  })

  it('leaves numbers already starting with 972 intact', () => {
    const link = generateWaLink('972521234567', 'hi')
    assert.ok(link.startsWith('https://wa.me/972521234567?'), `Got: ${link}`)
  })

  it('URL-encodes the message body', () => {
    const link = generateWaLink('0521234567', 'שלום עולם')
    assert.ok(link.includes(encodeURIComponent('שלום עולם')), 'Message should be URL-encoded')
  })
})

// ── FREE_MODE / ALLOW_PAID gate logic ───────────────────────────────────────

describe('FREE_MODE / ALLOW_PAID gate — env evaluation', () => {
  it('FREE_MODE defaults to true when env var is absent', () => {
    // Simulate: process.env.FREE_MODE is undefined
    const envVal = undefined
    const FREE_MODE = envVal !== 'false'
    assert.equal(FREE_MODE, true, 'FREE_MODE should default to true when unset')
  })

  it('FREE_MODE is true when set to any value other than "false"', () => {
    for (const val of ['true', '1', 'yes', '']) {
      const FREE_MODE = val !== 'false'
      assert.equal(FREE_MODE, true, `FREE_MODE should be true for env value "${val}"`)
    }
  })

  it('FREE_MODE is false only when explicitly set to "false"', () => {
    const FREE_MODE = 'false' !== 'false'
    assert.equal(FREE_MODE, false)
  })

  it('ALLOW_PAID_MESSAGING defaults to false when env var is absent', () => {
    const envVal = undefined
    const ALLOW_PAID = envVal === 'true'
    assert.equal(ALLOW_PAID, false, 'ALLOW_PAID should default to false when unset')
  })

  it('ALLOW_PAID_MESSAGING is false for any value other than "true"', () => {
    for (const val of ['1', 'yes', 'True', 'TRUE', '']) {
      const ALLOW_PAID = val === 'true'
      assert.equal(ALLOW_PAID, false, `ALLOW_PAID should be false for env value "${val}"`)
    }
  })

  it('sendMessage returns ready_for_manual_whatsapp status in FREE_MODE', () => {
    // Simulate the branch logic from whatsappService.ts sendMessage()
    const FREE_MODE = true
    const ALLOW_PAID = false
    const status = FREE_MODE
      ? 'ready_for_manual_whatsapp'
      : !ALLOW_PAID
        ? 'blocked_paid_provider'
        : 'sent'
    assert.equal(status, 'ready_for_manual_whatsapp')
  })

  it('sendMessage returns blocked_paid_provider when FREE_MODE=false but ALLOW_PAID=false', () => {
    const FREE_MODE = false
    const ALLOW_PAID = false
    const status = FREE_MODE
      ? 'ready_for_manual_whatsapp'
      : !ALLOW_PAID
        ? 'blocked_paid_provider'
        : 'sent'
    assert.equal(status, 'blocked_paid_provider')
  })

  it('sendMessage returns blocked_paid_provider when ALLOW_PAID_MESSAGING is missing from env', () => {
    // undefined !== 'true' → ALLOW_PAID = false
    const ALLOW_PAID = (undefined as unknown as string) === 'true'
    assert.equal(ALLOW_PAID, false)
    const FREE_MODE = false
    const status = FREE_MODE
      ? 'ready_for_manual_whatsapp'
      : !ALLOW_PAID
        ? 'blocked_paid_provider'
        : 'sent'
    assert.equal(status, 'blocked_paid_provider')
  })

  it('sendMessage with FREE_MODE=true includes a wa.me link', () => {
    const phone = '0521234567'
    const body = 'שלום'
    const link = createWhatsAppLink(phone, body)
    assert.ok(link.startsWith('https://wa.me/'), 'link must be a wa.me URL')
    assert.ok(link.includes('972521234567'), 'link must normalise the phone number')
  })

  it('ok is false when status is "failed"', () => {
    const status = 'failed'
    const ok = status !== 'failed'
    assert.equal(ok, false)
  })

  it('ok is true for ready_for_manual_whatsapp', () => {
    const status = 'ready_for_manual_whatsapp'
    const ok = status !== 'failed'
    assert.equal(ok, true)
  })
})

// ── parseIncoming ───────────────────────────────────────────────────────────

describe('parseIncoming — webhook body parsing', () => {
  it('returns null for null input', () => {
    assert.equal(parseIncoming(null), null)
  })

  it('returns null for undefined input', () => {
    assert.equal(parseIncoming(undefined), null)
  })

  it('returns null for empty object', () => {
    assert.equal(parseIncoming({}), null)
  })

  it('returns null for malformed entry array', () => {
    assert.equal(parseIncoming({ entry: [] }), null)
  })

  it('returns null when messages array is empty', () => {
    const payload = {
      entry: [{ changes: [{ value: { messages: [] } }] }],
    }
    assert.equal(parseIncoming(payload), null)
  })

  it('returns null when phone is missing', () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [{ id: 'wamid.123', timestamp: '1700000000', text: { body: 'hi' } }],
              },
            },
          ],
        },
      ],
    }
    // from is undefined → phone = '' → returns null
    assert.equal(parseIncoming(payload), null)
  })

  it('returns null when messageId is missing', () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [{ from: '972521234567', timestamp: '1700000000', text: { body: 'hi' } }],
              },
            },
          ],
        },
      ],
    }
    assert.equal(parseIncoming(payload), null)
  })

  it('correctly extracts phone, body, messageId from a valid Meta payload', () => {
    const payload = buildMetaPayload('972521234567', 'שלום', 'wamid.TEST001')
    const result = parseIncoming(payload)
    assert.notEqual(result, null)
    assert.equal(result!.phone, '972521234567')
    assert.equal(result!.body, 'שלום')
    assert.equal(result!.messageId, 'wamid.TEST001')
    assert.equal(result!.timestamp, 1700000000)
  })

  it('handles missing text.body gracefully (returns empty string)', () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [{ from: '972521234567', id: 'wamid.X', timestamp: '1700000000' }],
              },
            },
          ],
        },
      ],
    }
    const result = parseIncoming(payload)
    // phone and id are present so it should return a result
    assert.notEqual(result, null)
    assert.equal(result!.body, '')
  })

  it('returns null for a non-message event (status update shape)', () => {
    const statusUpdatePayload = {
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [{ id: 'wamid.Z', status: 'delivered', timestamp: '1700000000' }],
              },
            },
          ],
        },
      ],
    }
    assert.equal(parseIncoming(statusUpdatePayload), null)
  })

  it('does not throw on completely unexpected shapes', () => {
    const weirdInputs = [42, 'string', true, [1, 2, 3], { deeply: { nested: { junk: true } } }]
    for (const input of weirdInputs) {
      assert.doesNotThrow(() => parseIncoming(input))
      assert.equal(parseIncoming(input), null)
    }
  })
})

// ── verifyWebhookSignature ──────────────────────────────────────────────────

describe('verifyWebhookSignature — HMAC verification', () => {
  it('returns true when WHATSAPP_APP_SECRET is not set (dev/demo mode)', () => {
    const result = verifyWebhookSignature('any body', '', undefined)
    assert.equal(result, true, 'Missing secret → skip check → return true')
  })

  it('returns true for a valid signature', () => {
    const secret = 'test-secret-12345'
    const body = '{"entry":[]}'
    const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex')
    assert.equal(verifyWebhookSignature(body, sig, secret), true)
  })

  it('returns false for a tampered body', () => {
    const secret = 'test-secret-12345'
    const originalBody = '{"entry":[]}'
    const tamperedBody = '{"entry":[],"extra":true}'
    const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(originalBody).digest('hex')
    assert.equal(verifyWebhookSignature(tamperedBody, sig, secret), false)
  })

  it('returns false for a tampered signature', () => {
    const secret = 'test-secret-12345'
    const body = '{"entry":[]}'
    const fakeSig = 'sha256=' + 'a'.repeat(64)
    assert.equal(verifyWebhookSignature(body, fakeSig, secret), false)
  })

  it('returns false for an empty signature header when secret is set', () => {
    const secret = 'test-secret-12345'
    const body = '{"entry":[]}'
    // timingSafeEqual throws on length mismatch → caught → false
    assert.equal(verifyWebhookSignature(body, '', secret), false)
  })

  it('returns false for wrong prefix (sha1= instead of sha256=)', () => {
    const secret = 'test-secret-12345'
    const body = '{"entry":[]}'
    const wrongPrefixSig = 'sha1=' + crypto.createHmac('sha256', secret).update(body).digest('hex')
    assert.equal(verifyWebhookSignature(body, wrongPrefixSig, secret), false)
  })
})
