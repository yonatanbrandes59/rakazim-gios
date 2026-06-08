/**
 * PUT /api/automation-rules/:id
 * Toggles or updates a single automation rule.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { automationRulesDb } from '@/lib/db'

const UpdateRuleSchema = z.object({
  active: z.boolean().optional(),
  delay_hours: z.number().int().min(0).optional(),
  template_key: z.string().min(1).optional(),
})

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const authResult = await requireAuth(req)
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'גוף הבקשה אינו JSON תקין' }, { status: 400 })
  }

  const parsed = UpdateRuleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'נתונים לא תקינים', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const updated = await automationRulesDb.update(id, parsed.data)
  if (!updated) {
    return NextResponse.json({ error: 'חוק לא נמצא' }, { status: 404 })
  }

  return NextResponse.json(updated)
}
