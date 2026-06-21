/**
 * Green API WhatsApp Provider
 * ────────────────────────────
 * Connects via QR scan to a real WhatsApp number (no Meta approval needed).
 * Free plan available at green-api.com
 *
 * Required env vars:
 *   GREEN_API_INSTANCE_ID   - from Green API dashboard
 *   GREEN_API_TOKEN         - from Green API dashboard
 */

import type { SendResult } from './mockProvider'

function normalizePhone(phone: string): string {
  const d = phone.replace(/\D/g, '')
  const intl = d.startsWith('0') ? '972' + d.slice(1) : d
  return intl + '@c.us'
}

export function isGreenApiReady(): boolean {
  return !!(process.env.GREEN_API_INSTANCE_ID && process.env.GREEN_API_TOKEN)
}

export async function greenApiSend(phone: string, message: string): Promise<SendResult> {
  const instanceId = process.env.GREEN_API_INSTANCE_ID
  const token = process.env.GREEN_API_TOKEN

  if (!instanceId || !token) {
    return { success: false, status: 'failed', error: 'GREEN_API_INSTANCE_ID or GREEN_API_TOKEN not set' }
  }

  const chatId = normalizePhone(phone)

  try {
    const res = await fetch(
      `https://api.green-api.com/waInstance${instanceId}/sendMessage/${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, message }),
      }
    )
    const data = await res.json() as { idMessage?: string; error?: string }
    if (!res.ok || !data.idMessage) {
      throw new Error(data.error ?? JSON.stringify(data))
    }
    return { success: true, status: 'sent', messageId: data.idMessage }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Green API] Error:', msg)
    return { success: false, status: 'failed', error: msg }
  }
}
