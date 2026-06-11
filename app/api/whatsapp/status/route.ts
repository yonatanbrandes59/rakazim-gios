/**
 * GET /api/whatsapp/status
 * ────────────────────────
 * Returns the current WhatsApp Business API connection status.
 * Checks env vars and optionally verifies the phone number via Graph API.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(req)
  if (authResult instanceof NextResponse) return authResult

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
  const token = process.env.WHATSAPP_CLOUD_API_TOKEN?.trim()
  const webhookToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim()
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim()

  const configured = !!(phoneNumberId && token && webhookToken)

  // Determine the app's public URL for webhook
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
    || process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`
    || 'https://your-app.vercel.app'
  const webhookUrl = `${appUrl}/api/whatsapp/webhook`

  if (!configured) {
    return NextResponse.json({
      connected: false,
      configured: false,
      webhookUrl,
      missing: [
        !phoneNumberId && 'WHATSAPP_PHONE_NUMBER_ID',
        !token && 'WHATSAPP_CLOUD_API_TOKEN',
        !webhookToken && 'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
      ].filter(Boolean),
      webhookVerifyToken: webhookToken || null,
      appSecretSet: !!appSecret,
    })
  }

  // Try a lightweight call to verify credentials
  let connected = false
  let phoneInfo: { display_phone_number?: string; verified_name?: string } | null = null
  let apiError: string | null = null

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}?fields=display_phone_number,verified_name`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      }
    )
    const data = await res.json() as Record<string, unknown>
    if (res.ok && data.display_phone_number) {
      connected = true
      phoneInfo = {
        display_phone_number: data.display_phone_number as string,
        verified_name: data.verified_name as string | undefined,
      }
    } else {
      apiError = (data.error as { message?: string } | undefined)?.message ?? 'Unknown API error'
    }
  } catch (err) {
    apiError = err instanceof Error ? err.message : 'Connection timeout'
  }

  return NextResponse.json({
    connected,
    configured: true,
    webhookUrl,
    webhookVerifyToken: webhookToken,
    appSecretSet: !!appSecret,
    phoneInfo,
    apiError,
  })
}
