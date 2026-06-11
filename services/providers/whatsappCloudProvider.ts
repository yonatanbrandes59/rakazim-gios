/**
 * WhatsApp Cloud API Provider
 * ────────────────────────────
 * ⚠️  PAID PROVIDER – disabled by default for OUTBOUND template messages.
 * Only active when ALLOW_PAID_MESSAGING=true AND WHATSAPP_CLOUD_API_TOKEN is set.
 * Set FREE_MODE=true to block outbound template messages.
 *
 * Chatbot helpers (sendWaChatbot*) bypass FREE_MODE — replies within a
 * customer-initiated 24-hour session window are FREE on WhatsApp Business.
 */

import type { SendResult } from './mockProvider'

// ── Raw API caller ─────────────────────────────────────────────────────────

function normalizePhone(phone: string): string {
  const d = phone.replace(/\D/g, '')
  return d.startsWith('0') ? '972' + d.slice(1) : d
}

async function callWaApi(payload: object): Promise<SendResult> {
  const token = process.env.WHATSAPP_CLOUD_API_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID

  if (!token || !phoneNumberId) {
    return { success: false, status: 'failed', error: 'WHATSAPP_CLOUD_API_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set' }
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
      }
    )
    const data = await res.json() as { messages?: Array<{ id: string }>; error?: { message: string } }
    if (!res.ok) throw new Error(data.error?.message ?? JSON.stringify(data))
    return { success: true, status: 'sent', messageId: data.messages?.[0]?.id }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[WA Cloud API] Error:', msg)
    return { success: false, status: 'failed', error: msg }
  }
}

// ── Outbound template messages (gated by FREE_MODE) ───────────────────────

export async function whatsappCloudSend(phone: string, message: string): Promise<SendResult> {
  const FREE_MODE = process.env.FREE_MODE !== 'false'
  const ALLOW_PAID = process.env.ALLOW_PAID_MESSAGING === 'true'

  if (FREE_MODE || !ALLOW_PAID) {
    console.warn('⚠️  WhatsApp Cloud API blocked: FREE_MODE=true or ALLOW_PAID_MESSAGING=false')
    return {
      success: false,
      status: 'blocked_paid_provider',
      error: 'מצב חינם פעיל – WhatsApp Cloud API חסום. ניתן לשלוח ידנית דרך הקישור.',
    }
  }

  const intl = normalizePhone(phone)
  return callWaApi({ to: intl, type: 'text', text: { body: message } })
}

// ── Chatbot helpers (FREE — customer-initiated 24h session window) ─────────

/** Check whether the chatbot can actually send (env vars configured) */
export function isWaChatbotReady(): boolean {
  return !!(process.env.WHATSAPP_CLOUD_API_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)
}

/**
 * Send a plain text message as part of a chatbot session.
 * Does NOT check FREE_MODE (session replies are free).
 */
export async function sendWaChatbotText(phone: string, text: string): Promise<SendResult> {
  if (!isWaChatbotReady()) {
    console.warn('[WA Chatbot] Not configured — WHATSAPP_CLOUD_API_TOKEN / WHATSAPP_PHONE_NUMBER_ID missing')
    return { success: false, status: 'failed', error: 'WhatsApp not configured' }
  }
  const intl = normalizePhone(phone)
  return callWaApi({ to: intl, type: 'text', text: { body: text } })
}

/**
 * Send interactive button message (2–3 choices).
 * WhatsApp button titles are capped at 20 chars; ids at 256 chars.
 */
export async function sendWaChatbotButtons(
  phone: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>,
): Promise<SendResult> {
  if (!isWaChatbotReady()) return { success: false, status: 'failed', error: 'WhatsApp not configured' }
  const intl = normalizePhone(phone)

  // Clamp to 3 buttons max (WA limit)
  const clamped = buttons.slice(0, 3)

  return callWaApi({
    to: intl,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText.slice(0, 1024) },
      action: {
        buttons: clamped.map(b => ({
          type: 'reply',
          reply: { id: b.id.slice(0, 256), title: b.title.slice(0, 20) },
        })),
      },
    },
  })
}

/**
 * Send interactive list message (≤10 choices in one section).
 * WA list row titles are capped at 24 chars.
 */
export async function sendWaChatbotList(
  phone: string,
  bodyText: string,
  buttonLabel: string,
  rows: Array<{ id: string; title: string; description?: string }>,
): Promise<SendResult> {
  if (!isWaChatbotReady()) return { success: false, status: 'failed', error: 'WhatsApp not configured' }
  const intl = normalizePhone(phone)

  return callWaApi({
    to: intl,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: bodyText.slice(0, 1024) },
      action: {
        button: buttonLabel.slice(0, 20),
        sections: [{
          title: 'אפשרויות',
          rows: rows.slice(0, 10).map(r => ({
            id: r.id.slice(0, 256),
            title: r.title.slice(0, 24),
            ...(r.description ? { description: r.description.slice(0, 72) } : {}),
          })),
        }],
      },
    },
  })
}
