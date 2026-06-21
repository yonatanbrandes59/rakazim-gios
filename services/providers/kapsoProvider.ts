/**
 * Kapso WhatsApp Provider
 * ────────────────────────
 * Wraps the Kapso API (https://api.kapso.ai/meta/whatsapp)
 * which proxies Meta's WhatsApp Cloud API with a Kapso API key.
 *
 * Required env vars:
 *   KAPSO_API_KEY          - from Kapso dashboard
 *   KAPSO_PHONE_NUMBER_ID  - phone number ID from Kapso project
 */

import type { SendResult } from './mockProvider'

function normalizePhone(phone: string): string {
  const d = phone.replace(/\D/g, '')
  return d.startsWith('0') ? '972' + d.slice(1) : d
}

async function callKapsoApi(payload: object): Promise<SendResult> {
  const apiKey = process.env.KAPSO_API_KEY
  const phoneNumberId = process.env.KAPSO_PHONE_NUMBER_ID

  if (!apiKey || !phoneNumberId) {
    return { success: false, status: 'failed', error: 'KAPSO_API_KEY or KAPSO_PHONE_NUMBER_ID not set' }
  }

  try {
    const res = await fetch(
      `https://api.kapso.ai/meta/whatsapp/v24.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
      }
    )
    const data = await res.json() as { messages?: Array<{ id: string }>; error?: { message: string } }
    if (!res.ok) throw new Error(data.error?.message ?? JSON.stringify(data))
    return { success: true, status: 'sent', messageId: data.messages?.[0]?.id }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Kapso WA] Error:', msg)
    return { success: false, status: 'failed', error: msg }
  }
}

export function isKapsoReady(): boolean {
  return !!(process.env.KAPSO_API_KEY && process.env.KAPSO_PHONE_NUMBER_ID)
}

export async function kapsoSend(phone: string, message: string): Promise<SendResult> {
  const intl = normalizePhone(phone)
  return callKapsoApi({ to: intl, type: 'text', text: { body: message } })
}

export async function kapsoSendButtons(
  phone: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>,
): Promise<SendResult> {
  if (!isKapsoReady()) return { success: false, status: 'failed', error: 'Kapso not configured' }
  const intl = normalizePhone(phone)
  const clamped = buttons.slice(0, 3)
  return callKapsoApi({
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

export async function kapsoSendList(
  phone: string,
  bodyText: string,
  buttonLabel: string,
  rows: Array<{ id: string; title: string; description?: string }>,
): Promise<SendResult> {
  if (!isKapsoReady()) return { success: false, status: 'failed', error: 'Kapso not configured' }
  const intl = normalizePhone(phone)
  return callKapsoApi({
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
