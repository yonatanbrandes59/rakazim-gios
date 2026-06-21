import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { sendOpeningToCandidates, sendReminderToCandidate, processMessageQueue } from '@/services/messagingService'

export async function POST(req: NextRequest) {
  const user = await requireAdmin(req)
  if (user instanceof NextResponse) return user

  const { action, candidate_ids, candidate_id } = await req.json()

  try {
    if (action === 'send_opening' && Array.isArray(candidate_ids)) {
      await sendOpeningToCandidates(candidate_ids)
      return NextResponse.json({ ok: true, sent: candidate_ids.length })
    }

    if (action === 'send_reminder' && candidate_id) {
      await sendReminderToCandidate(candidate_id)
      return NextResponse.json({ ok: true })
    }

    if (action === 'process_queue') {
      const result = await processMessageQueue()
      return NextResponse.json({ ok: true, ...result })
    }

    return NextResponse.json({ error: 'פעולה לא מוכרת' }, { status: 400 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[messages/send]', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
