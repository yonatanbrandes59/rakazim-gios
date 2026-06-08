import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { positionsDb } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAdmin(req)
  if (user instanceof NextResponse) return user
  const updates = await req.json()
  const updated = await positionsDb.update(params.id, updates)
  if (!updated) return NextResponse.json({ error: 'לא נמצא' }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAdmin(req)
  if (user instanceof NextResponse) return user
  await positionsDb.delete(params.id)
  return NextResponse.json({ ok: true })
}
