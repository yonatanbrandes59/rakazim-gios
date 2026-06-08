/**
 * Resend Email Provider
 * ─────────────────────
 * Free plan: 3,000 emails/month, no credit card required.
 * Only active when RESEND_API_KEY is configured.
 */

import type { SendResult } from './mockProvider'

export async function resendSendEmail(
  email: string,
  subject: string,
  body: string
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@yourdomain.com'

  if (!apiKey) {
    console.warn('RESEND_API_KEY not configured – falling back to mock')
    return { success: false, status: 'failed', error: 'RESEND_API_KEY not configured' }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject,
        text: body,
        html: body.replace(/\n/g, '<br/>'),
      }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Resend API error')

    return { success: true, status: 'sent', messageId: data.id }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Resend error:', message)
    return { success: false, status: 'failed', error: message }
  }
}
