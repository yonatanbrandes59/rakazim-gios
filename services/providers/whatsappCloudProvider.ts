/**
 * WhatsApp Cloud API Provider
 * ────────────────────────────
 * ⚠️  PAID PROVIDER – disabled by default.
 * Only active when ALLOW_PAID_MESSAGING=true AND WHATSAPP_CLOUD_API_TOKEN is set.
 * Set FREE_MODE=true to block this provider.
 */

import type { SendResult } from './mockProvider'

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

  const token = process.env.WHATSAPP_CLOUD_API_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID

  if (!token || !phoneNumberId) {
    return { success: false, status: 'failed', error: 'WHATSAPP_CLOUD_API_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set' }
  }

  try {
    const cleaned = phone.replace(/\D/g, '')
    const intl = cleaned.startsWith('0') ? '972' + cleaned.slice(1) : cleaned

    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: intl,
          type: 'text',
          text: { body: message },
        }),
      }
    )
    const data = await res.json()
    if (!res.ok) throw new Error(JSON.stringify(data))
    return { success: true, status: 'sent', messageId: data.messages?.[0]?.id }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, status: 'failed', error: message }
  }
}
