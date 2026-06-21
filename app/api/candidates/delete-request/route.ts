import { NextRequest, NextResponse } from 'next/server'
import { candidatesDb, activityDb } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { phone } = await req.json()
  if (!phone?.trim()) {
    return NextResponse.json({ error: 'מספר טלפון נדרש' }, { status: 400 })
  }

  const normalized = phone.trim().replace(/[-\s]/g, '')
  const all = await candidatesDb.findAll()
  const candidate = all.find(c => c.phone.replace(/[-\s]/g, '') === normalized)

  if (!candidate) {
    // Return success anyway to avoid phone enumeration
    return NextResponse.json({ ok: true })
  }

  await activityDb.log({
    candidate_id: candidate.id,
    user_type: 'candidate',
    action: 'delete_request',
    details: { phone: normalized },
  })

  await candidatesDb.update(candidate.id, {
    status: 'delete_requested',
    notes: (candidate.notes ? candidate.notes + ' | ' : '') + 'בקשת מחיקה התקבלה ב-' + new Date().toLocaleDateString('he-IL'),
  })

  return NextResponse.json({ ok: true })
}
