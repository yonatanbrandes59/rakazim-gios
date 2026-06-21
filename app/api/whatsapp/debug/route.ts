import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const user = await requireAdmin(req)
  if (user instanceof NextResponse) return user

  const apiKey = process.env.KAPSO_API_KEY
  const phoneNumberId = process.env.KAPSO_PHONE_NUMBER_ID
  const { phone = '972558835935', message = 'בדיקה' } = await req.json().catch(() => ({}))

  if (!apiKey || !phoneNumberId) {
    return NextResponse.json({ error: 'KAPSO_API_KEY or KAPSO_PHONE_NUMBER_ID not set', apiKey: !!apiKey, phoneNumberId: !!phoneNumberId })
  }

  const url = `https://api.kapso.ai/meta/whatsapp/v24.0/${phoneNumberId}/messages`
  const body = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'text',
    text: { body: message },
  }

  let rawStatus: number
  let rawBody: unknown
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    rawStatus = res.status
    rawBody = await res.json().catch(() => res.text())
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err), url, phoneNumberId, phone })
  }

  return NextResponse.json({ url, phoneNumberId, phone, status: rawStatus, response: rawBody })
}
