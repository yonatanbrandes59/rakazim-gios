/**
 * POST /api/whatsapp/test
 * ───────────────────────
 * Sends a test WhatsApp message to a given phone number.
 * Only available to admin/manager-level users.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, hasAdminAccess } from '@/lib/auth'
import { sendWaChatbotText } from '@/services/providers/whatsappCloudProvider'

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await requireAuth(req)
  if (user instanceof NextResponse) return user
  if (user.role !== 'admin' && !hasAdminAccess(user)) {
    return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })
  }

  const token = process.env.WHATSAPP_CLOUD_API_TOKEN?.trim()
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()

  if (!token || !phoneNumberId) {
    return NextResponse.json(
      { ok: false, error: 'WhatsApp לא מוגדר — חסרים WHATSAPP_CLOUD_API_TOKEN ו-WHATSAPP_PHONE_NUMBER_ID' },
      { status: 400 }
    )
  }

  let phone: string
  try {
    const body = await req.json() as { phone?: string }
    phone = (body.phone ?? '').trim()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  if (!phone) {
    return NextResponse.json({ ok: false, error: 'נא לציין מספר טלפון' }, { status: 400 })
  }

  const result = await sendWaChatbotText(
    phone,
    '✅ הודעת בדיקה מ*האיחוד החקלאי* — החיבור לWhatsApp Business API עובד! 🌾',
  )

  return NextResponse.json({
    ok: result.success,
    messageId: result.messageId,
    error: result.success ? undefined : result.error,
  })
}
