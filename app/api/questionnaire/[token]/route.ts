import { NextRequest, NextResponse } from 'next/server'
import { candidatesDb, activityDb } from '@/lib/db'

export async function GET(_: NextRequest, { params }: { params: { token: string } }) {
  const candidate = await candidatesDb.findByToken(params.token)
  if (!candidate) return NextResponse.json({ error: 'קישור לא תקין' }, { status: 404 })
  if (candidate.opt_out) return NextResponse.json({ error: 'הוסרת מהרשימה', opted_out: true }, { status: 410 })

  // Track questionnaire opened
  if (candidate.status === 'questionnaire_sent' || candidate.status === 'new') {
    await candidatesDb.update(candidate.id, { status: 'questionnaire_opened' })
    await activityDb.log({
      candidate_id: candidate.id,
      user_type: 'candidate',
      action: 'questionnaire_opened',
    })
  }

  // Return only the data the candidate needs to see (no sensitive admin data)
  return NextResponse.json({
    id: candidate.id,
    first_name: candidate.first_name,
    full_name: candidate.full_name,
    status: candidate.status,
    questionnaire_completed: !!candidate.questionnaire_completed_at,
  })
}
