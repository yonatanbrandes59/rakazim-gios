import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { positionsDb } from '@/lib/db'

export async function GET(req: NextRequest) {
  const user = await requireAuth(req)
  if (user instanceof NextResponse) return user
  const region = req.nextUrl.searchParams.get('region') ?? undefined
  const positions = await positionsDb.findAll(region)
  return NextResponse.json(positions)
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req)
  if (user instanceof NextResponse) return user
  if (user.role !== 'admin') return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })

  const body = await req.json()
  const position = await positionsDb.create({
    ...body,
    position_type: 'רכז/ת נוער / רכז/ת סניף',
    status: body.status || 'open',
  })
  return NextResponse.json(position, { status: 201 })
}
