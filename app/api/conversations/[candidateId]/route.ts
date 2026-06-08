/**
 * Conversations API
 * ──────────────────
 * GET  /api/conversations/:candidateId — list messages sorted by sent_at ASC
 * POST /api/conversations/:candidateId — create outbound message record
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { conversationsDb, activityDb } from '@/lib/db'

const CreateMessageSchema = z.object({
  body: z.string().min(1, 'גוף ההודעה לא יכול להיות ריק'),
  template_key: z.string().optional(),
})

// ── GET ────────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ candidateId: string }> },
): Promise<NextResponse> {
  const authResult = await requireAuth(req)
  if (authResult instanceof NextResponse) return authResult

  const { candidateId } = await params
  const messages = await conversationsDb.findByCandidateId(candidateId)

  return NextResponse.json(messages)
}

// ── POST ───────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ candidateId: string }> },
): Promise<NextResponse> {
  const authResult = await requireAuth(req)
  if (authResult instanceof NextResponse) return authResult

  const { candidateId } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'גוף הבקשה אינו JSON תקין' }, { status: 400 })
  }

  const parsed = CreateMessageSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'נתונים לא תקינים', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { body: messageBody, template_key } = parsed.data
  const now = new Date().toISOString()

  const message = await conversationsDb.create({
    candidate_id: candidateId,
    direction: 'out',
    body: messageBody,
    sent_at: now,
    status: 'sent',
    template_key,
  })

  await activityDb.log({
    candidate_id: candidateId,
    user_type: authResult.role === 'admin' ? 'admin' : 'coordinator',
    action: 'manual_whatsapp_message_sent',
    details: { template_key, message_id: message.id },
  })

  return NextResponse.json(message, { status: 201 })
}
