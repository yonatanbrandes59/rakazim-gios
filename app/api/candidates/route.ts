import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { candidatesDb, coordinatorsDb, activityDb } from '@/lib/db'
import { scoreAndAssignCandidate } from '@/services/scoringService'
import { sendOpeningToCandidates } from '@/services/messagingService'
import { CandidateFilters, Region, REGIONS } from '@/lib/types'

// Israeli phone: starts with 05x or +9725x, 10 digits local / 12 with country code
const PHONE_REGEX = /^(\+972|0)(5[0-9])\d{7}$/

const CreateCandidateSchema = z.object({
  first_name:  z.string().min(1, 'שם פרטי חובה').max(50),
  last_name:   z.string().min(1, 'שם משפחה חובה').max(50),
  phone:       z.string().regex(PHONE_REGEX, 'מספר טלפון לא תקין'),
  email:       z.string().email('כתובת אימייל לא תקינה').optional().or(z.literal('')),
  garin:       z.string().max(100).optional(),
  garin_year:  z.string().max(10).optional(),
  army_role:   z.string().max(100).optional(),
  release_date:z.string().optional(),
  notes:       z.string().max(2000).optional(),
})

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
  const validationErrors: { index: number; errors: z.ZodIssue[] }[] = []

  for (let i = 0; i < items.length; i++) {
    const parseResult = CreateCandidateSchema.safeParse(items[i])
    if (!parseResult.success) {
      validationErrors.push({ index: i, errors: parseResult.error.issues })
      continue
    }
    const dto = parseResult.data
    const candidate = await candidatesDb.create(dto)
    created.push(candidate)

    await activityDb.log({
      candidate_id: candidate.id,
      user_type: 'admin',
      action: 'candidate_created',
      details: { source: 'manual' },
    })
  }

  // Return 400 if all items failed validation (single-item case)
  if (created.length === 0 && validationErrors.length > 0) {
    return NextResponse.json(
      { error: 'שגיאת ולידציה', details: validationErrors },
      { status: 400 }
    )
  }

  // If send_opening=true, queue the opening message
  if (req.nextUrl.searchParams.get('send_opening') === 'true') {
    await sendOpeningToCandidates(created.map(c => c.id))
  }

  return NextResponse.json(Array.isArray(body) ? created : created[0], { status: 201 })
}
