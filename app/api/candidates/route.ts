import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { candidatesDb, coordinatorsDb, activityDb } from '@/lib/db'
import { scoreAndAssignCandidate } from '@/services/scoringService'
import { sendOpeningToCandidates } from '@/services/messagingService'
import { CandidateFilters, Region } from '@/lib/types'

export async function GET(req: NextRequest) {
  const user = await requireAuth(req)
  if (user instanceof NextResponse) return user

  const sp = req.nextUrl.searchParams
  const filters: CandidateFilters = {}
  if (sp.get('region'))       filters.region       = sp.get('region') as Region
  if (sp.get('status'))       filters.status       = sp.get('status') as any
  if (sp.get('coordinator'))  filters.coordinator_id = sp.get('coordinator')!
  if (sp.get('interest'))     filters.interest_level = sp.get('interest') as any
  if (sp.get('search'))       filters.search       = sp.get('search')!

  // Coordinators only see their own region
  if (user.role === 'coordinator') {
    filters.coordinator_id = user.id
  }

  const candidates = await candidatesDb.findAll(filters)
  return NextResponse.json(candidates)
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req)
  if (user instanceof NextResponse) return user
  if (user.role !== 'admin') return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })

  const body = await req.json()

  // Support bulk create
  const items = Array.isArray(body) ? body : [body]
  const created = []

  for (const dto of items) {
    if (!dto.first_name || !dto.last_name || !dto.phone) {
      continue
    }
    const candidate = await candidatesDb.create(dto)
    created.push(candidate)

    await activityDb.log({
      candidate_id: candidate.id,
      user_type: 'admin',
      action: 'candidate_created',
      details: { source: 'manual' },
    })
  }

  // If send_opening=true, queue the opening message
  if (req.nextUrl.searchParams.get('send_opening') === 'true') {
    await sendOpeningToCandidates(created.map(c => c.id))
  }

  return NextResponse.json(Array.isArray(body) ? created : created[0], { status: 201 })
}
