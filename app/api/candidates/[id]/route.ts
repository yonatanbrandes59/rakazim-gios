import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { candidatesDb, answersDb, activityDb } from '@/lib/db'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req)
  if (user instanceof NextResponse) return user

  const candidate = await candidatesDb.findById(params.id)
  if (!candidate) return NextResponse.json({ error: 'לא נמצא' }, { status: 404 })

  if (user.role === 'coordinator' && candidate.assigned_coordinator_id !== user.id) {
    return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })
  }

  const answers = await answersDb.findByCandidateId(candidate.id)
  const activity = await activityDb.findByCandidateId(candidate.id)
  return NextResponse.json({ ...candidate, answers, activity })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req)
  if (user instanceof NextResponse) return user

  const candidate = await candidatesDb.findById(params.id)
  if (!candidate) return NextResponse.json({ error: 'לא נמצא' }, { status: 404 })

  if (user.role === 'coordinator' && candidate.assigned_coordinator_id !== user.id) {
    return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })
  }

  const updates = await req.json()
  const updated = await candidatesDb.update(params.id, updates)

  if (updates.status && updates.status !== candidate.status) {
    await activityDb.log({
      candidate_id: candidate.id,
      user_type: user.role,
      action: 'status_changed',
      details: { from: candidate.status, to: updates.status },
    })
  }

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req)
  if (user instanceof NextResponse) return user
  if (user.role !== 'admin') return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })

  await candidatesDb.delete(params.id)
  return NextResponse.json({ ok: true })
}
