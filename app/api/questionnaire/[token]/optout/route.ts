import { NextRequest, NextResponse } from 'next/server'
import { candidatesDb, activityDb } from '@/lib/db'

/**
 * POST /api/questionnaire/[token]/optout
 *
 * Processes an explicit candidate opt-out. Using POST (not GET) prevents
 * accidental triggering by link prefetchers in browsers, email clients, or
 * WhatsApp/Telegram crawlers (GDPR Article 7 — consent must be an affirmative act).
 */
export async function POST(_: NextRequest, { params }: { params: { token: string } }) {
  const candidate = await candidatesDb.findByToken(params.token)
  if (!candidate) return NextResponse.json({ error: 'קישור לא תקין' }, { status: 404 })

  // Idempotent — already opted out
  if (candidate.opt_out) return NextResponse.json({ ok: true, opted_out: true })

  await candidatesDb.update(candidate.id, { opt_out: true, status: 'not_interested' })
  await activityDb.log({
    candidate_id: candidate.id,
    user_type: 'candidate',
    action: 'opt_out',
  })

  return NextResponse.json({ ok: true, opted_out: true })
}
