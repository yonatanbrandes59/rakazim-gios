import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { coordinatorsDb } from '@/lib/db'

export async function GET(req: NextRequest) {
  const user = await requireAdmin(req)
  if (user instanceof NextResponse) return user
  const coordinators = await coordinatorsDb.findAll()
  return NextResponse.json(coordinators)
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin(req)
  if (user instanceof NextResponse) return user

  const { name, region, phone, email, password, settlements, notes } = await req.json()
  if (!name || !region || !phone || !email) {
    return NextResponse.json({ error: 'חסרים שדות חובה' }, { status: 400 })
  }

  const coordinator = await coordinatorsDb.create({
    name, region, phone, email,
    password_hash: password || 'demo',  // In production: hash the password
    settlements: settlements || [],
    notes: notes || '',
  })

  return NextResponse.json(coordinator, { status: 201 })
}
